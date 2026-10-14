import { app } from 'electron'
import { generateSpeech, getVoices } from '../tts/main.js'
import { listInstalledModels } from '../ai/main.js'
import { buildSpeakParams } from './speak.js'

// 最小 MCP（Streamable HTTP，无状态）实现：仅提供 tools
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const MCP_OWNER = 0

const TOOLS = [
  {
    name: 'speak',
    description:
      '将文本合成为语音并保存为音频文件，返回文件路径与时长。不传 model 使用 Edge 在线语音，传 model 使用已安装的本地 AI 模型。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要合成的文本，1–5000 字符' },
        voice: {
          type: 'string',
          description: 'Edge 语音名称，默认 zh-CN-XiaoxiaoNeural（见 list_voices）；本地模型下等同 speaker'
        },
        rate: { type: 'number', description: 'Edge 语速 0.5–2，默认 1' },
        volume: { type: 'number', description: 'Edge 音量 0–1，默认 1' },
        pitch: { type: 'number', description: 'Edge 音调 -50–50，默认 0' },
        model: { type: 'string', description: '本地 AI 模型 id（见 list_models），指定后使用本地引擎' },
        speaker: { type: 'string', description: '本地模型的说话人' },
        language: { type: 'string', description: '本地模型合成语言，默认 zh' },
        speed: { type: 'number', description: '本地模型语速，默认 1' },
        description: { type: 'string', description: '声音设计模型的音色描述' },
        emotion: { type: 'string', description: '情感描述（视模型支持）' }
      },
      required: ['text']
    }
  },
  {
    name: 'list_voices',
    description: '列出可用的 Edge 在线语音',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_models',
    description: '列出已安装的本地 AI 模型及默认模型',
    inputSchema: { type: 'object', properties: {} }
  }
]

const text = (value: string, isError = false) => ({
  content: [{ type: 'text', text: value }],
  ...(isError ? { isError: true } : {})
})
const json = (value: unknown) => text(JSON.stringify(value, null, 2))

async function callTool(name: string, args: any) {
  if (name === 'list_voices') {
    const voices = await getVoices()
    return json(voices.map((v) => ({ name: v.name, locale: v.locale, gender: v.gender })))
  }
  if (name === 'list_models') return json(await listInstalledModels())
  if (name === 'speak') {
    const built = await buildSpeakParams(args)
    if ('error' in built) return text(built.error, true)
    const result = await generateSpeech(built.params, MCP_OWNER)
    if (!result.success || !result.data) return text(result.error || '生成失败', true)
    return json(result.data)
  }
  return null
}

const rpcError = (id: unknown, code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message }
})

/** 处理一条 JSON-RPC 消息；通知类消息返回 null（无需响应） */
async function handleMessage(msg: any): Promise<object | null> {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request')
  }
  const isNotification = msg.id === undefined
  const respond = (result: unknown) => (isNotification ? null : { jsonrpc: '2.0', id: msg.id, result })

  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params?.protocolVersion
      return respond({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'speak-text', version: app.getVersion() }
      })
    }
    case 'ping':
      return respond({})
    case 'tools/list':
      return respond({ tools: TOOLS })
    case 'tools/call': {
      try {
        const result = await callTool(msg.params?.name, msg.params?.arguments ?? {})
        if (!result) return rpcError(msg.id, -32602, `Unknown tool: ${msg.params?.name}`)
        return respond(result)
      } catch (error) {
        return respond(text(error instanceof Error ? error.message : '未知错误', true))
      }
    }
    default:
      if (msg.method.startsWith('notifications/')) return null
      return isNotification ? null : rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

/** 处理 MCP 请求体（单条或批量），返回需要响应的内容，无需响应时为 null */
export async function handleMcpPayload(payload: unknown): Promise<object | object[] | null> {
  if (Array.isArray(payload)) {
    if (!payload.length) return rpcError(null, -32600, 'Invalid Request')
    const results = (await Promise.all(payload.map(handleMessage))).filter(
      (r): r is object => r !== null
    )
    return results.length ? results : null
  }
  return handleMessage(payload)
}
