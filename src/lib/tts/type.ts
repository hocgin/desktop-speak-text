import type { LocalTTSInput } from '../ai/type.js'
// TTS 类型定义

export interface VoiceInfo {
  name: string
  displayName: string
  locale: string
  gender: 'Male' | 'Female'
  description?: string
  ///
  countryNative: string
  country: string
  language: string
  languageNative: string
}

export interface TTSOptions {
  rate: number // 0.5 - 2.0
  volume: number // 0.0 - 1.0
  pitch: number // -50.0 - 50.0
}

export interface EdgeTTSGenerateParams {
  engine?: 'edge'
  text: string
  voiceName: string
  options: TTSOptions
}

export interface LocalTTSGenerateParams {
  engine: 'local'
  text: string
  taskId: string
  local: LocalTTSInput
}
export type TTSGenerateParams = EdgeTTSGenerateParams | LocalTTSGenerateParams

export interface TTSGenerateResult {
  success: boolean
  data?: {
    audioPath: string
    duration: number
  }
  error?: string
}

export interface TTSRecord {
  engine: string
  modelId: string | null
  generationParams: string | null
  id: number
  text: string
  voiceName: string
  rate: number
  volume: number
  pitch: number
  language: string
  audioPath: string | null
  duration: number | null
  wordCount: number
  createdAt: number
  updatedAt: number
}

export interface TTSAPI {
  generate: (params: TTSGenerateParams) => Promise<TTSGenerateResult>
  getVoices: () => Promise<VoiceInfo[]>
  previewVoice: (
    voiceName: string
  ) => Promise<{ success: boolean; dataUrl?: string; error?: string }>
  saveAudio: (audioData: Uint8Array, path?: string) => Promise<{ success: boolean; path?: string }>
  getHistory: (limit?: number) => Promise<TTSRecord[]>
  deleteRecord: (id: number) => Promise<{ success: boolean }>
  loadAudio: (audioPath: string) => Promise<string>
  readAudioFile: (audioPath: string) => Promise<Buffer>
}
