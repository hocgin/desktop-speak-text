import { randomUUID } from 'node:crypto'
import { listInstalledModels } from '../ai/main.js'
import type { TTSGenerateParams } from '../tts/type.js'

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'

export type SpeakParamsResult = { params: TTSGenerateParams } | { error: string }

/**
 * 将外部请求（HTTP / MCP 共用）转换为生成参数
 * 指定 model（或 engine 为 local）时使用本地 AI 模型，否则使用 Edge 在线语音
 * 数值范围的校验交给 generateSpeech，这里只做类型检查与缺省值填充
 */
export async function buildSpeakParams(payload: any): Promise<SpeakParamsResult> {
  if (!payload || typeof payload !== 'object') return { error: '参数必须是对象' }
  if (payload.engine !== undefined && !['edge', 'local'].includes(payload.engine)) {
    return { error: 'engine 只能是 edge 或 local' }
  }
  if (typeof payload.text !== 'string') return { error: 'text 必须是字符串' }

  if (payload.engine === 'local' || payload.model !== undefined) {
    // 未指定 model 时使用应用中配置的默认模型
    const modelId = payload.model ?? (await listInstalledModels()).defaultModel
    const speaker = payload.speaker ?? payload.voice
    const optionalStrings = [payload.language, speaker, payload.description, payload.emotion]
    if (
      typeof modelId !== 'string' ||
      !modelId ||
      optionalStrings.some((v) => v !== undefined && typeof v !== 'string') ||
      (payload.speed !== undefined && typeof payload.speed !== 'number')
    ) {
      return { error: '请通过 model 指定已安装的本地模型（可从 list_models / GET /v1/models 获取）' }
    }
    return {
      params: {
        engine: 'local',
        text: payload.text,
        taskId: randomUUID(),
        local: {
          modelId,
          speaker,
          language: payload.language,
          speed: payload.speed ?? 1,
          description: payload.description,
          emotion: payload.emotion
        }
      }
    }
  }

  const voice = payload.voice ?? DEFAULT_VOICE
  if (typeof voice !== 'string') return { error: 'voice 必须是字符串' }
  return {
    params: {
      engine: 'edge',
      text: payload.text,
      voiceName: voice,
      options: {
        rate: payload.rate ?? 1,
        volume: payload.volume ?? 1,
        pitch: payload.pitch ?? 0
      }
    }
  }
}
