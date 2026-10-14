import data from './catalog-data.json'
import type { ModelDefinition, DownloadSource } from './type.js'
const modelOrder = [
  'kokoro-82m-q8',
  'qwen3-tts-customvoice-q8',
  'qwen3-tts-voicedesign-q8',
  'index-2.5-q8'
]
export const CATALOG: ModelDefinition[] = [...data]
  .sort((a, b) => modelOrder.indexOf(a.id) - modelOrder.indexOf(b.id))
  .map((m) => ({
    ...m,
    task: 'task' in m ? m.task : 'tts',
    mode:
      m.family === 'index_tts2'
        ? 'clone'
        : 'variant' in m && m.variant === 'voicedesign'
          ? 'design'
          : 'speaker',
    voices:
      m.family === 'qwen3_tts' && 'variant' in m && m.variant === 'customvoice'
        ? ['Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ryan', 'Aiden', 'Ono_Anna', 'Sohee']
        : 'voices' in m
          ? m.voices
          : undefined,
    languages:
      m.family === 'kokoro_tts'
        ? ['zh', 'en', 'es', 'fr', 'hi', 'it', 'pt']
        : m.family === 'index_tts2'
          ? ['zh', 'en', 'ja', 'es', 'ar']
          : ['zh', 'en', 'ja', 'ko', 'de', 'fr', 'ru', 'pt', 'es', 'it'],
    licenseURL:
      m.family === 'index_tts2'
        ? 'https://huggingface.co/IndexTeam/IndexTTS-2.5'
        : m.family === 'kokoro_tts'
          ? 'https://huggingface.co/hexgrad/Kokoro-82M'
          : 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'
  }))
export function modelById(id: string): ModelDefinition {
  const model = CATALOG.find((m) => m.id === id)
  if (!model) throw new Error('Unsupported model')
  return model
}
/** 估算运行所需内存：模型权重 × 1.5 + 1GB 运行时开销 */
export function requiredMemory(model: ModelDefinition): number {
  return Math.ceil(model.size * 1.5 + 1000 ** 3)
}
export function modelURL(model: ModelDefinition, source: DownloadSource): string {
  return source === 'modelscope'
    ? `https://modelscope.cn/models/HereIsMark/audio.cpp-gguf/resolve/master/${model.remotePath}`
    : `https://huggingface.co/audio-cpp/audio.cpp-gguf/resolve/${model.revision || '6d5436fc85f7a20c2e9f4e472b7f3a532f686444'}/${model.remotePath}`
}
export const RUNTIME_VERSION = 'v0.9.1'
export function runtimePackage(platform: string, arch: string) {
  if (platform === 'darwin' && arch === 'arm64')
    return {
      backend: 'metal',
      name: 'audio-v0.9.1-bin-macos-arm64-metal.tar.gz',
      hash: '960436787b84bf137a70ea1713ac460207ef2ac7b2617380fb7a1f4650d1100d',
      toolsName: 'yovoice-v0.2.0-cli-macos-arm64.zip',
      toolsHash: '3ae526485c8681a1c985be03ce92db1d46eac460e2faddbe71201ee7997756d5'
    }
  if (platform === 'win32' && arch === 'x64')
    return {
      backend: 'cpu',
      name: 'audio-v0.9.1-bin-windows-x64-cpu-portable.zip',
      hash: '2fccc73dc97af84da1e81c3af545fa619348a46d023ea7d927ba80bc8680d2a0',
      toolsName: 'yovoice-v0.2.0-cli-windows-x64.zip',
      toolsHash: 'abcaa3678c1b57b18394f4cde1dc330d8f5affa474afde4f1055c1bc58a62aa3'
    }
  return undefined
}
export const PROVIDER_PRESETS = [
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com' },
  { id: 'qwen', name: '通义千问', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'kimi', name: 'Kimi', baseURL: 'https://api.moonshot.cn/v1' },
  { id: 'ollama', name: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1' },
  { id: 'custom', name: 'Custom', baseURL: '' }
]

export function kokoroLanguage(speaker: string): string {
  return (
    (
      { a: 'en', b: 'en', e: 'es', f: 'fr', h: 'hi', i: 'it', p: 'pt', z: 'zh' } as Record<
        string,
        string
      >
    )[speaker[0]] || ''
  )
}
