import { ipcRenderer } from 'electron'
import type {
  TTSGenerateParams,
  TTSGenerateResult,
  VoiceInfo,
  TTSRecord,
  TTSAPI
} from './type.js'

export function initTTSPreload(obj: any = {}) {
  const tts: TTSAPI = {
    generate: (params: TTSGenerateParams) => {
      return ipcRenderer.invoke('tts:generate', params)
    },
    getVoices: () => {
      return ipcRenderer.invoke('tts:get-voices')
    },
    previewVoice: (voiceName: string) => {
      return ipcRenderer.invoke('tts:preview-voice', voiceName)
    },
    saveAudio: (audioData: Uint8Array, path?: string) => {
      return ipcRenderer.invoke('tts:save-audio', audioData, path)
    },
    getHistory: (limit?: number) => {
      return ipcRenderer.invoke('tts:get-history', limit)
    },
    deleteRecord: (id: number) => {
      return ipcRenderer.invoke('tts:delete-record', id)
    },
    loadAudio: (audioPath: string) => {
      return ipcRenderer.invoke('tts:load-audio', audioPath)
    },
    readAudioFile: (audioPath: string) => {
      return ipcRenderer.invoke('tts:read-audio-file', audioPath)
    }
  }

  return Object.assign(obj, { tts })
}
