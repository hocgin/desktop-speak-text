import { contextBridge, ipcRenderer } from 'electron'
import backend from 'i18next-electron-fs-backend'

export function initI18Next() {
  contextBridge.exposeInMainWorld('api', {
    i18nextElectronBackend: backend.preloadBindings(ipcRenderer, process)
  })
}
