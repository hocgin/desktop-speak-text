import { contextBridge, ipcRenderer } from 'electron'

export function initStorePreload(obj: any = {}) {
  let store = {
    get(key) {
      return ipcRenderer.sendSync('electron-store-get', key)
    },
    set(property, val) {
      ipcRenderer.send('electron-store-set', property, val)
    }
  }
  return Object.assign(obj, { store })
}
