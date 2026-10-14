import { ElectronAPI } from '@electron-toolkit/preload'
import type { AIAPI } from '../lib/ai/type.js'
import type { TTSAPI } from '../lib/tts/type.js'
import type { UpdaterAPI } from '../lib/updater/type.js'

// Store API
export interface StoreAPI {
  get: <T = any>(key: string) => T | undefined
  set: (key: string, value: any) => void
}

// Shell API
export interface ShellAPI {
  exec: (cmd: string) => void
  getLog: () => void
  onUpdate: (callback: (data: any) => void) => void
}

// API 类型（用于 i18n）
export interface WindowAPI {
  i18next?: any
  i18nextElectronBackend?: any
}

declare global {
  interface Window {
    electron: ElectronAPI & {
      store: StoreAPI
      shell: ShellAPI
      ai: AIAPI
      tts: TTSAPI
      updater: UpdaterAPI
    }
    api: WindowAPI
  }
}
