import { ipcMain, dialog, session } from 'electron'
import { Communicate, listVoices } from '../../../edge-tts-universal/index.js'
import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'
import { voices as dataVoices } from '../res/voices.js'
import { generateLocal } from '../ai/main.js'
import { randomUUID } from 'node:crypto'
import { db, ensureDatabaseReady } from '../../main/db.js'
import { speakRecords } from '../schema.js'
import { eq, desc } from 'drizzle-orm'
import { synthesizeWithSystemVoice, sniffAudio } from './system.js'
import type { TTSGenerateParams, TTSGenerateResult, VoiceInfo, TTSRecord } from './type.js'

// 音频文件存储目录
let audioDir: string
let voices: VoiceInfo[]
let currentMainWindow: any = null
let isTTSMainInitialized = false

// 单个分片的空闲超时：超过该时间未收到任何数据即视为失败，避免 Promise 永远挂起
const TTS_IDLE_TIMEOUT = 20_000
const TTS_CONNECT_TIMEOUT = 10_000
const TTS_SERVICE_URL = 'https://speech.platform.bing.com'

type Prosody = { rate: string; volume: string; pitch: string }

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * 解析代理地址
 * Node 的 ws/axios 不会读取系统代理（Windows 下常见的 Clash/v2rayN 等仅设置系统代理），
 * 因此借助 Chromium 的代理解析拿到系统代理，再显式传给 edge-tts-universal
 */
async function resolveProxy(): Promise<string | undefined> {
  const envProxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  if (envProxy) return envProxy

  try {
    // 返回格式如: "PROXY 127.0.0.1:7890; DIRECT" 或 "DIRECT"
    const result = await session.defaultSession.resolveProxy(TTS_SERVICE_URL)
    for (const item of result.split(';')) {
      const [type, host] = item.trim().split(/\s+/)
      // https-proxy-agent 仅支持 HTTP(S) 代理
      if (type === 'PROXY' && host) return `http://${host}`
      if (type === 'HTTPS' && host) return `https://${host}`
    }
  } catch (error) {
    console.warn('解析系统代理失败:', error)
  }
  return undefined
}

async function synthesizeOnce(
  text: string,
  voice: string,
  prosody: Prosody,
  proxy?: string
): Promise<Buffer> {
  const communicate = new Communicate(text, {
    voice,
    ...prosody,
    proxy,
    connectionTimeout: TTS_CONNECT_TIMEOUT
  })
  const iterator = communicate.stream()
  const chunks: Buffer[] = []
  try {
    while (true) {
      // edge-tts-universal 在 WebSocket 握手失败时不会 reject，需要自行加超时
      const { value, done } = await withTimeout(iterator.next(), TTS_IDLE_TIMEOUT, '语音服务无响应')
      if (done) break
      if (value.type === 'audio' && value.data) {
        chunks.push(value.data)
      }
    }
  } finally {
    iterator.return(undefined).catch(() => {})
  }
  return Buffer.concat(chunks)
}

/**
 * 合成音频（带代理、超时、时钟校准重试）
 */
async function synthesize(text: string, voice: string, prosody: Prosody): Promise<Buffer> {
  const proxy = await resolveProxy()
  try {
    return await synthesizeOnce(text, voice, prosody, proxy)
  } catch (error) {
    console.warn('TTS 首次合成失败，校准时钟后重试:', error)
    // Sec-MS-GEC 令牌依赖本机时间（5 分钟窗口），Windows 时钟偏差会导致握手 403，
    // 而库内只对 axios 的 403 做了时钟校准，WebSocket 的 403 不会触发。
    // listVoices 遇到 403 会根据服务端 Date 头校准共享的时钟偏移，之后再重试合成；
    // 同时它走 HTTPS，可用来区分「网络不通」与「合成通道被服务端拒绝」
    let networkReachable = true
    await listVoices(proxy).catch((e) => {
      networkReachable = false
      console.warn('时钟校准失败:', e)
    })
    try {
      return await synthesizeOnce(text, voice, prosody, proxy)
    } catch (retryError) {
      console.error('TTS 重试仍失败:', retryError)
      throw new Error(
        networkReachable
          ? '语音服务拒绝了合成连接（服务端可能已更新鉴权协议，并非网络问题），请稍后重试或更新应用'
          : '无法连接语音服务，请检查网络或代理设置'
      )
    }
  }
}

/**
 * 合成音频：优先使用 Edge 在线语音，失败时回退到系统自带语音
 * @param opts 语速/音量倍率，供系统语音使用
 */
async function synthesizeWithFallback(
  text: string,
  voice: string,
  prosody: Prosody,
  opts: { rate: number; volume: number }
): Promise<Buffer> {
  try {
    return await synthesize(text, voice, prosody)
  } catch (edgeError) {
    console.warn('在线语音不可用，回退到系统语音:', edgeError)
    try {
      return await synthesizeWithSystemVoice(text, voice, opts)
    } catch (systemError) {
      console.error('系统语音也失败:', systemError)
      const edgeMsg = edgeError instanceof Error ? edgeError.message : String(edgeError)
      throw new Error(
        `${edgeMsg}；系统语音兜底也失败：${systemError instanceof Error ? systemError.message : systemError}`
      )
    }
  }
}

/**
 * 生成语音并写入历史记录（IPC 与本地 API 服务共用）
 * @param owner 发起方标识，本地引擎任务据此归属
 */
export async function generateSpeech(
  params: TTSGenerateParams,
  owner: number
): Promise<TTSGenerateResult> {
  try {
    await ensureDatabaseReady()
    if (
      !params ||
      typeof params.text !== 'string' ||
      !params.text.trim() ||
      params.text.length > 5000
    )
      throw new Error('Text must contain 1–5000 characters')
    const text = params.text
    const local = params.engine === 'local' ? params.local : undefined
    if (params.engine && !['edge', 'local'].includes(params.engine))
      throw new Error('Unsupported engine')
    const voiceName =
      params.engine === 'local' ? local?.speaker || local?.modelId || '' : params.voiceName
    const options =
      params.engine === 'local'
        ? { rate: local?.speed ?? 1, volume: 1, pitch: 0 }
        : params.options
    if (
      !voiceName ||
      !options ||
      !Number.isFinite(options.rate) ||
      options.rate < 0.5 ||
      options.rate > 2 ||
      !Number.isFinite(options.volume) ||
      options.volume < 0 ||
      options.volume > 1 ||
      !Number.isFinite(options.pitch) ||
      Math.abs(options.pitch) > 50
    )
      throw new Error('Invalid TTS parameters')

    // 格式化参数为 edge-tts-universal 所需格式
    // rate: 基于 1.0，范围 0.5-2.0 -> -25% 到 +50%
    const rateValue = Math.round((options.rate - 1) * 50)
    const rate = rateValue >= 0 ? `+${rateValue}%` : `${rateValue}%`

    // volume: 基于 0.5，范围 0-1.0 -> -50% 到 +50%
    const volumeValue = Math.round((options.volume - 0.5) * 100)
    const volume = volumeValue >= 0 ? `+${volumeValue}%` : `${volumeValue}%`

    // pitch: 范围 -50 到 +50 Hz
    const pitchValue = Math.round(options.pitch)
    const pitch = pitchValue >= 0 ? `+${pitchValue}Hz` : `${pitchValue}Hz`

    const saveGeneratedAudio = async (
      buffer: Buffer,
      duration: number,
      signal?: AbortSignal
    ): Promise<TTSGenerateResult> => {
      signal?.throwIfAborted()
      if (!buffer.length) throw new Error('音频生成失败')
      await fs.mkdir(audioDir, { recursive: true })
      const audioPath = path.join(audioDir, `tts_${randomUUID()}.${sniffAudio(buffer).ext}`)
      const temporary = `${audioPath}.part`
      try {
        await fs.writeFile(temporary, buffer)
        signal?.throwIfAborted()
        await fs.rename(temporary, audioPath)
        signal?.throwIfAborted()
        const now = Math.floor(Date.now() / 1000)
        await db.insert(speakRecords).values({
          text,
          engine: local ? 'local' : 'edge',
          modelId: local?.modelId,
          generationParams: JSON.stringify(local || options),
          voiceName,
          rate: options.rate,
          volume: options.volume,
          pitch: options.pitch,
          language: local ? local.language || 'zh' : voiceName.split('-').slice(0, 2).join('-'),
          audioPath,
          duration: Math.ceil(duration),
          wordCount: text.length,
          createdAt: now,
          updatedAt: now
        })
        return { success: true, data: { audioPath, duration } }
      } catch (error) {
        await Promise.all([
          fs.rm(temporary, { force: true }),
          fs.rm(audioPath, { force: true })
        ])
        throw error
      }
    }
    if (params.engine === 'local') {
      if (!params.local || typeof params.local.modelId !== 'string')
        throw new Error('请选择本地模型')
      return await generateLocal(
        text,
        params.local,
        params.taskId,
        owner,
        ({ buffer, duration }, signal) => saveGeneratedAudio(buffer, duration, signal)
      )
    }
    return await saveGeneratedAudio(
      await synthesizeWithFallback(text, voiceName, { rate, volume, pitch }, options),
      Math.ceil(text.length / 3)
    )
  } catch (error) {
    console.error('TTS 生成失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/** 获取可用语音列表（IPC 与本地 API 服务共用） */
export async function getVoices(): Promise<VoiceInfo[]> {
  try {
    if (!voices || voices.length == 0) {
      let allVoices = await listVoices(await resolveProxy())
      const itemMap = new Map<
        string,
        {
          country: string
          countryNative: string
          language: string
          languageNative: string
        }
      >(
        dataVoices.map((item) => [
          item.name,
          {
            country: item.country,
            countryNative: item.countryNative,
            language: item.language,
            languageNative: item.languageNative
          }
        ])
      )

      voices = allVoices.map((v: any) => {
        let item: any = itemMap.get(v.ShortName) ?? {}
        return {
          name: v.Name,
          displayName: v.FriendlyName || v.Name,
          locale: v.Locale,
          gender: v.Gender === 'Male' ? 'Male' : 'Female',
          description: v.Description,
          country: item.country,
          countryNative: item.countryNative,
          language: item.language,
          languageNative: item.languageNative
        }
      })
      console.log('allVoices', JSON.stringify(itemMap))
    }
    return voices
  } catch (error) {
    console.error('获取语音列表失败:', error)
    return dataVoices.map((v) => ({
      name: v.name,
      displayName: v.name,
      locale: v.locale,
      gender: v.gender === 'Male' ? 'Male' : 'Female',
      description: v.name,
      country: v.country,
      countryNative: v.countryNative,
      language: v.language,
      languageNative: v.languageNative
    }))
  }
}

export function initTTSMain(mainWindow: any) {
  currentMainWindow = mainWindow

  // 允许重复调用以更新窗口引用，但避免重复注册 IPC handler
  if (isTTSMainInitialized) {
    return
  }
  isTTSMainInitialized = true

  // 初始化音频目录
  audioDir = path.join(app.getPath('userData'), 'audio')
  fs.mkdir(audioDir, { recursive: true }).catch(console.error)

  // 生成音频
  // 生成音频
  ipcMain.handle(
    'tts:generate',
    async (event, params: TTSGenerateParams): Promise<TTSGenerateResult> => {
      if (event.senderFrame !== event.sender.mainFrame) {
        return { success: false, error: 'Untrusted TTS sender' }
      }
      return generateSpeech(params, event.sender.id)
    }
  )

  // 获取可用语音列表
  ipcMain.handle('tts:get-voices', (): Promise<VoiceInfo[]> => getVoices())

  // 试听语音
  ipcMain.handle(
    'tts:preview-voice',
    async (
      _,
      voiceName: string
    ): Promise<{ success: boolean; dataUrl?: string; error?: string }> => {
      try {
        // 根据语音确定试听文本
        const locale = voiceName.split('-')[0] + '-' + voiceName.split('-')[1]
        const sampleTexts: Record<string, string> = {
          'zh-CN': '你好，这是语音试听。',
          'zh-TW': '你好，這是語音試聽。',
          'en-US': 'Hello, this is a voice preview.',
          'en-GB': 'Hello, this is a voice preview.',
          'ja-JP': 'こんにちは、これは音声プレビューです。',
          'ko-KR': '안녕하세요, 이것은 음성 미리보기입니다.',
          'fr-FR': 'Bonjour, ceci est un aperçu vocal.',
          'de-DE': 'Hallo, dies ist eine Sprachvorschau.',
          'es-ES': 'Hola, esta es una vista previa de voz.',
          'ru-RU': 'Привет, это предварительный просмотр голоса.'
        }

        const text = sampleTexts[locale] || 'Hello, this is a voice preview.'

        // 合成音频（使用默认参数）
        const buffer = await synthesizeWithFallback(
          text,
          voiceName,
          { rate: '+0%', volume: '+0%', pitch: '+0Hz' },
          { rate: 1, volume: 0.5 }
        )

        if (buffer.length === 0) {
          return { success: false, error: '音频生成失败' }
        }

        // 转换为 base64 data URL
        const base64 = buffer.toString('base64')
        const dataUrl = `data:${sniffAudio(buffer).mime};base64,${base64}`

        return { success: true, dataUrl }
      } catch (error) {
        console.error('试听语音失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    }
  )

  // 保存音频文件
  ipcMain.handle(
    'tts:save-audio',
    async (_, audioData: Buffer | Uint8Array, customPath?: string) => {
      try {
        let savePath: string

        if (customPath) {
          savePath = customPath
        } else {
          // 显示保存对话框
          const kind = sniffAudio(Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData))
          const result = await dialog.showSaveDialog(currentMainWindow, {
            defaultPath: path.join(app.getPath('downloads'), `tts_${Date.now()}.${kind.ext}`),
            filters: [
              { name: kind.ext === 'wav' ? 'WAV Audio' : 'MP3 Audio', extensions: [kind.ext] }
            ],
            properties: ['createDirectory']
          })

          if (result.canceled || !result.filePath) {
            return { success: false }
          }

          savePath = result.filePath
        }

        // 将 audioData 转换为 Buffer（支持 Buffer 或 Uint8Array）
        const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData)
        await fs.writeFile(savePath, buffer)

        return { success: true, path: savePath }
      } catch (error) {
        console.error('保存音频失败:', error)
        return { success: false }
      }
    }
  )

  // 获取历史记录
  ipcMain.handle('tts:get-history', async (_, limit: number = 50): Promise<TTSRecord[]> => {
    try {
      await ensureDatabaseReady()
      const records = await db
        .select()
        .from(speakRecords)
        .orderBy(desc(speakRecords.createdAt))
        .limit(limit)

      return records as TTSRecord[]
    } catch (error) {
      console.error('获取历史记录失败:', error)
      return []
    }
  })

  // 删除记录
  ipcMain.handle('tts:delete-record', async (_, id: number): Promise<{ success: boolean }> => {
    try {
      // 先获取记录信息
      const [record] = await db.select().from(speakRecords).where(eq(speakRecords.id, id))

      if (record && record.audioPath) {
        // 删除音频文件
        fs.unlink(record.audioPath).catch(() => {
          // 忽略文件删除失败
        })
      }

      // 删除数据库记录
      await db.delete(speakRecords).where(eq(speakRecords.id, id))

      return { success: true }
    } catch (error) {
      console.error('删除记录失败:', error)
      return { success: false }
    }
  })

  // 加载音频文件为 data URL
  ipcMain.handle('tts:load-audio', async (_, audioPath: string): Promise<string> => {
    try {
      const buffer = await fs.readFile(audioPath)
      const base64 = buffer.toString('base64')
      return `data:${sniffAudio(buffer).mime};base64,${base64}`
    } catch (error) {
      console.error('加载音频文件失败:', error)
      throw error
    }
  })

  // 读取音频文件为 ArrayBuffer（用于下载）
  ipcMain.handle('tts:read-audio-file', async (_, audioPath: string): Promise<Buffer> => {
    try {
      const buffer = await fs.readFile(audioPath)
      // 直接返回 Buffer，它在 Electron IPC 中可以被正确传输
      return buffer
    } catch (error) {
      console.error('读取音频文件失败:', error)
      throw error
    }
  })

  console.log('TTS 主进程模块已初始化')
}
