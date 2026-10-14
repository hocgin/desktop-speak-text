import { ElectronAPI } from '@electron-toolkit/preload'

// src/types/store.d.ts
interface StoreAPI {
  get: (key: string) => any
  set: (key: string, value: any) => void
}

declare global {
  interface Window {
    electron: ElectronAPI & {
      store: StoreAPI
      shell: any
    }
  }
}

export {}
