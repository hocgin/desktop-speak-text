import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

// 系统语音合成超时（毫秒）
const SYSTEM_TTS_TIMEOUT = 60_000

export type SystemProsody = {
  /** 语速倍率，1.0 为正常 */
  rate: number
  /** 音量 0.0 - 1.0 */
  volume: number
}

/** 从 Edge 语音名（如 zh-CN-XiaoxiaoNeural）提取 locale（zh-CN） */
function localeOf(voiceName: string): string {
  const [lang, region] = voiceName.split('-')
  return region ? `${lang}-${region}` : lang
}

/** macOS: 通过 `say -v ?` 找到与 locale 匹配的系统语音 */
async function pickMacVoice(locale: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('say', ['-v', '?'], { timeout: 10_000 })
    const wanted = locale.replace('-', '_').toLowerCase()
    for (const line of stdout.split('\n')) {
      // 格式: "Tingting            zh_CN    # 你好，我叫婷婷。"
      const m = line.match(/^(.+?)\s{2,}([a-z]{2,3}_[A-Za-z]{2,4})\s+#/)
      if (m && m[2].toLowerCase() === wanted) return m[1].trim()
    }
  } catch {
    // 忽略，回退到系统默认语音
  }
  return undefined
}

async function synthesizeMac(text: string, locale: string, p: SystemProsody, out: string): Promise<void> {
  const args: string[] = []
  const voice = await pickMacVoice(locale)
  if (voice) args.push('-v', voice)
  // say 默认约 175 词/分钟
  args.push('-r', String(Math.round(175 * p.rate)))
  args.push('--file-format=WAVE', '--data-format=LEI16@22050', '-o', out, '--', text)
  await execFileAsync('say', args, { timeout: SYSTEM_TTS_TIMEOUT })
}

// 文本、路径等均通过环境变量传入，避免拼接进脚本造成命令注入
const WIN_SCRIPT = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$locale = $env:TTS_LOCALE
$match = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq $locale } | Select-Object -First 1
if (-not $match) {
  $lang = $locale.Split('-')[0]
  $match = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $lang } | Select-Object -First 1
}
if ($match) { $synth.SelectVoice($match.VoiceInfo.Name) }
$synth.Rate = [int]$env:TTS_RATE
$synth.Volume = [int]$env:TTS_VOLUME
$synth.SetOutputToWaveFile($env:TTS_OUT)
$synth.Speak([System.IO.File]::ReadAllText($env:TTS_TEXT_FILE, [System.Text.Encoding]::UTF8))
$synth.Dispose()
`

async function synthesizeWindows(
  text: string,
  locale: string,
  p: SystemProsody,
  out: string,
  textFile: string
): Promise<void> {
  await fs.writeFile(textFile, text, 'utf8')
  // System.Speech Rate 范围 -10..10，约 1.0 倍对应 0
  const rate = Math.max(-10, Math.min(10, Math.round((p.rate - 1) * 10)))
  const volume = Math.max(0, Math.min(100, Math.round(p.volume * 100)))
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_SCRIPT],
    {
      timeout: SYSTEM_TTS_TIMEOUT,
      windowsHide: true,
      env: {
        ...process.env,
        TTS_LOCALE: locale,
        TTS_RATE: String(rate),
        TTS_VOLUME: String(volume),
        TTS_OUT: out,
        TTS_TEXT_FILE: textFile
      }
    }
  )
}

async function synthesizeLinux(text: string, locale: string, p: SystemProsody, out: string, textFile: string) {
  await fs.writeFile(textFile, text, 'utf8')
  const lang = locale.split('-')[0]
  await execFileAsync(
    'espeak-ng',
    ['-v', lang, '-s', String(Math.round(175 * p.rate)), '-a', String(Math.round(p.volume * 200)), '-w', out, '-f', textFile],
    { timeout: SYSTEM_TTS_TIMEOUT }
  )
}

/**
 * 使用系统自带语音合成，返回 WAV 数据
 * macOS: say；Windows: System.Speech；Linux: espeak-ng
 */
export async function synthesizeWithSystemVoice(
  text: string,
  voiceName: string,
  prosody: SystemProsody
): Promise<Buffer> {
  const id = randomUUID()
  const out = path.join(os.tmpdir(), `speaktext_${id}.wav`)
  const textFile = path.join(os.tmpdir(), `speaktext_${id}.txt`)
  const locale = localeOf(voiceName)
  try {
    if (process.platform === 'darwin') {
      await synthesizeMac(text, locale, prosody, out)
    } else if (process.platform === 'win32') {
      await synthesizeWindows(text, locale, prosody, out, textFile)
    } else {
      await synthesizeLinux(text, locale, prosody, out, textFile)
    }
    const buffer = await fs.readFile(out)
    if (buffer.length === 0) throw new Error('系统语音未生成音频')
    return buffer
  } finally {
    fs.unlink(out).catch(() => {})
    fs.unlink(textFile).catch(() => {})
  }
}

/** 根据文件头判断音频格式 */
export function sniffAudio(buffer: Buffer): { mime: string; ext: string } {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'RIFF') {
    return { mime: 'audio/wav', ext: 'wav' }
  }
  return { mime: 'audio/mpeg', ext: 'mp3' }
}
