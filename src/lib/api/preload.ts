import { ipcRenderer } from 'electron'
import type { ApiServerAPI, ApiServerConfig } from './type.js'

export function initApiServerPreload(obj: any = {}) {
  const apiServer: ApiServerAPI = {
    getState: () => ipcRenderer.invoke('api-server:get-state'),
    apply: (config: ApiServerConfig) => ipcRenderer.invoke('api-server:apply', config)
  }
  return Object.assign(obj, { apiServer })
}
