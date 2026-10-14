import { contextBridge } from 'electron'
import { electronAPI as _electronAPI } from '@electron-toolkit/preload'
import { initStorePreload } from '../lib/store/preload.js'
import { initShellPreload } from '../lib/shell/preload.js'
import { initI18Next } from '../lib/i18n/preload.js'
import { initAIPreload } from '../lib/ai/preload.js'
import { initTTSPreload } from '../lib/tts/preload.js'
import { initUpdaterPreload } from '../lib/updater/preload.js'

let electronAPI = initStorePreload(_electronAPI)
electronAPI = initShellPreload(electronAPI)
electronAPI = initAIPreload(electronAPI)
electronAPI = initTTSPreload(electronAPI)
electronAPI = initUpdaterPreload(electronAPI)
let _ = initI18Next()

// Custom APIs for renderer
const api = {}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
