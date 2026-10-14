import http from 'node:http'
import { app, ipcMain } from 'electron'
import fs from 'fs/promises'
import type Store from 'electron-store'
import { generateSpeech, getVoices } from '../tts/main.js'
import { listInstalledModels } from '../ai/main.js'
import { buildSpeakParams } from './speak.js'
import { handleMcpPayload } from './mcp.js'
import { sniffAudio } from '../tts/system.js'
import { API_DEFAULT_PORT } from './type.js'
import type { ApiServerConfig, ApiServerState } from './type.js'

const STORE_KEY = 'apiServer'
const MAX_BODY_BYTES = 256 * 1024
// 本地 API 没有本地引擎的 owner 概念，使用固定值
const API_OWNER = 0
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

let server: http.Server | null = null
let config: ApiServerConfig = { enabled: false, port: API_DEFAULT_PORT }
let lastError: string | undefined
let initialized = false

function isValidPort(port: unknown): port is number {
  return Number.isInteger(port) && (port as number) >= 1024 && (port as number) <= 65535
}

function getState(): ApiServerState {
  return { ...config, running: !!server?.listening, error: lastError }
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleSpeak(req: http.IncomingMessage, res: http.ServerResponse) {
  let payload: any
  try {
    payload = JSON.parse(await readBody(req))
  } catch (error) {
    return sendJson(res, 400, {
      success: false,
      error: error instanceof Error && error.message === '请求体过大' ? error.message : '请求体不是合法 JSON'
    })
  }
  if (!payload || typeof payload !== 'object') {
    return sendJson(res, 400, { success: false, error: '请求体必须是 JSON 对象' })
  }

  const built = await buildSpeakParams(payload)
  if ('error' in built) return sendJson(res, 400, { success: false, error: built.error })
  const params = built.params
  const result = await generateSpeech(params, API_OWNER)
  if (!result.success || !result.data) {
    return sendJson(res, 500, { success: false, error: result.error || '生成失败' })
  }

  // format=json 时返回文件路径与时长，默认直接返回音频二进制
  if (payload.format === 'json') {
    return sendJson(res, 200, { success: true, ...result.data })
  }
  const audio = await fs.readFile(result.data.audioPath)
  res.writeHead(200, {
    'Content-Type': sniffAudio(audio).mime,
    'Content-Length': audio.length
  })
  res.end(audio)
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  // 防 DNS 重绑定：只接受以本机地址访问
  const hostname = (req.headers.host ?? '').replace(/:\d+$/, '')
  if (!LOCAL_HOSTS.has(hostname)) {
    return sendJson(res, 403, { success: false, error: 'Forbidden host' })
  }
  // 防浏览器页面跨站调用：非浏览器客户端不会携带 Origin
  if (req.headers.origin) {
    return sendJson(res, 403, { success: false, error: 'Cross-origin requests are not allowed' })
  }

  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { success: true, version: app.getVersion() })
    }
    if (req.method === 'GET' && pathname === '/v1/voices') {
      const voices = await getVoices()
      return sendJson(res, 200, {
        success: true,
        data: voices.map((v) => ({
          name: v.name,
          locale: v.locale,
          gender: v.gender
        }))
      })
    }
    if (pathname === '/mcp') {
      // 无状态 Streamable HTTP：仅支持 POST，不提供服务端推送流
      if (req.method !== 'POST') {
        res.writeHead(405, { Allow: 'POST' })
        return res.end()
      }
      let payload: unknown
      try {
        payload = JSON.parse(await readBody(req))
      } catch {
        return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      }
      const reply = await handleMcpPayload(payload)
      if (!reply) {
        res.writeHead(202)
        return res.end()
      }
      return sendJson(res, 200, reply)
    }
    if (req.method === 'GET' && pathname === '/v1/models') {
      return sendJson(res, 200, { success: true, ...(await listInstalledModels()) })
    }
    if (req.method === 'POST' && pathname === '/v1/tts') {
      return await handleSpeak(req, res)
    }
    return sendJson(res, 404, { success: false, error: 'Not found' })
  } catch (error) {
    console.error('[ApiServer] 请求处理失败:', error)
    return sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    const current = server
    server = null
    if (!current) return resolve()
    current.close(() => resolve())
    current.closeAllConnections()
  })
}

function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const next = http.createServer((req, res) => void handleRequest(req, res))
    next.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE' ? new Error(`端口 ${port} 已被占用`) : error
      )
    })
    // 仅监听回环地址，不对局域网暴露
    next.listen(port, '127.0.0.1', () => {
      server = next
      console.log(`[ApiServer] 已启动: http://127.0.0.1:${port}`)
      resolve()
    })
  })
}

async function applyConfig(next: ApiServerConfig): Promise<ApiServerState> {
  await stopServer()
  config = next
  lastError = undefined
  if (config.enabled) {
    try {
      await startServer(config.port)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      console.error('[ApiServer] 启动失败:', error)
    }
  }
  return getState()
}

export function initApiServerMain(store: Store<any>) {
  if (initialized) return
  initialized = true

  const saved = store.get(STORE_KEY) as Partial<ApiServerConfig> | undefined
  config = {
    enabled: saved?.enabled === true,
    port: isValidPort(saved?.port) ? saved.port : API_DEFAULT_PORT
  }

  ipcMain.handle('api-server:get-state', (): ApiServerState => getState())
  ipcMain.handle(
    'api-server:apply',
    async (_, input: ApiServerConfig): Promise<ApiServerState> => {
      if (!input || typeof input.enabled !== 'boolean' || !isValidPort(input.port)) {
        return { ...getState(), error: '端口必须是 1024–65535 之间的整数' }
      }
      const next = { enabled: input.enabled, port: input.port }
      store.set(STORE_KEY, next)
      return applyConfig(next)
    }
  )

  app.on('before-quit', () => void stopServer())

  if (config.enabled) void applyConfig(config)
}
