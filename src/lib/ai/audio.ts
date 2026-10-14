import { kokoroLanguage } from './catalog.js'
import type { ModelDefinition, LocalTTSInput } from './type.js'
export function wavDuration(buffer: Buffer): number {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('Invalid WAV audio')
  let rate = 0,
    bytes = 0
  for (let offset = 12; offset + 8 <= buffer.length; ) {
    const kind = buffer.toString('ascii', offset, offset + 4),
      size = buffer.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > buffer.length) throw new Error('Truncated WAV audio')
    if (kind === 'fmt ' && size >= 16) {
      const format = buffer.readUInt16LE(start)
      if (format !== 1 && format !== 3) throw new Error('Unsupported WAV encoding')
      rate = buffer.readUInt32LE(start + 8)
    }
    if (kind === 'data') bytes += size
    offset = start + size + (size % 2)
  }
  if (!rate || !bytes) throw new Error('Empty WAV audio')
  return bytes / rate
}
export function buildLocalRequest(
  model: ModelDefinition,
  text: string,
  input: LocalTTSInput,
  reference?: string
) {
  if (typeof text !== 'string' || !text.trim() || text.length > 5000)
    throw new Error('Text must contain 1–5000 characters')
  const language = input.language || 'zh'
  if (!model.languages.includes(language)) throw new Error('Unsupported synthesis language')
  const options: Record<string, unknown> = {}
  const request: Record<string, unknown> = { text, options }
  if (model.mode === 'speaker') {
    if (!input.speaker || !model.voices?.includes(input.speaker))
      throw new Error('Select a supported speaker')
    if (model.family === 'kokoro_tts') {
      if (kokoroLanguage(input.speaker) !== language)
        throw new Error('Language must match the Kokoro speaker')
      request.voice_id = input.speaker
      options.text_chunk_size = 64
    } else {
      options.speaker = input.speaker
      if (input.description) options.instruct = input.description
    }
  }
  if (model.mode === 'design') {
    if (typeof input.description !== 'string' || !input.description.trim())
      throw new Error('Voice description is required')
    options.instruct = input.description
  }
  if (
    input.description &&
    (typeof input.description !== 'string' || input.description.length > 2000)
  )
    throw new Error('Voice description too long')
  if (model.family === 'qwen3_tts')
    request.language = (
      {
        zh: 'Chinese',
        en: 'English',
        ja: 'Japanese',
        ko: 'Korean',
        de: 'German',
        fr: 'French',
        ru: 'Russian',
        pt: 'Portuguese',
        es: 'Spanish',
        it: 'Italian'
      } as Record<string, string>
    )[language]
  if (model.mode === 'clone') {
    if (!reference) throw new Error('Reference audio is required')
    const speed = input.speed ?? 1
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
      throw new Error('Speed must be between 0.5 and 2')
    request.voice_ref = reference
    options.duration_factor = 1 / speed
    options.language = language
    if (input.emotion) {
      if (typeof input.emotion !== 'string' || input.emotion.length > 1000)
        throw new Error('Emotion description too long')
      options.use_emotion_text = true
      options.emotion_text = input.emotion
      options.emotion_alpha = 1
    }
  }
  return { model: 'index', request }
}
