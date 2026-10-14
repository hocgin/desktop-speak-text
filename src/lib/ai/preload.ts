import { ipcRenderer } from 'electron'
import type { AIAPI } from './type.js'
export function initAIPreload(obj: any = {}) {
  const ai: AIAPI = {
    getState: () => ipcRenderer.invoke('ai:state'),
    installRuntime: (id) => ipcRenderer.invoke('ai:install', id),
    downloadModel: (model, id) => ipcRenderer.invoke('ai:download', model, id),
    importModel: (id) => ipcRenderer.invoke('ai:import', id),
    removeModel: (id) => ipcRenderer.invoke('ai:remove-model', id),
    setDefaultModel: (id) => ipcRenderer.invoke('ai:default-model', id),
    setSource: (source) => ipcRenderer.invoke('ai:source', source),
    openModelDirectory: () => ipcRenderer.invoke('ai:open-directory'),
    saveProvider: (input) => ipcRenderer.invoke('ai:save-provider', input),
    removeProvider: (id) => ipcRenderer.invoke('ai:remove-provider', id),
    setDefaultProvider: (id) => ipcRenderer.invoke('ai:default-provider', id),
    listProviderModels: (id) => ipcRenderer.invoke('ai:provider-models', id),
    testProvider: (id) => ipcRenderer.invoke('ai:test-provider', id),
    selectReference: () => ipcRenderer.invoke('ai:reference'),
    processText: (request) => ipcRenderer.invoke('ai:text', request),
    cancelTask: (id) => ipcRenderer.invoke('ai:cancel', id),
    onTask: (callback) => {
      const listener = (_event, task) => callback(task)
      ipcRenderer.on('ai:task', listener)
      return () => ipcRenderer.removeListener('ai:task', listener)
    },
    onStateChanged: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('ai:state-changed', listener)
      return () => ipcRenderer.removeListener('ai:state-changed', listener)
    }
  }
  return Object.assign(obj, { ai })
}
