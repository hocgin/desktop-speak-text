import { ipcRenderer } from 'electron'
import type {
  UpdateInfo,
  UpdaterState,
  UpdaterAPI,
  ApiResponse
} from './type.js'

export function initUpdaterPreload(obj: any = {}) {
  const updater: UpdaterAPI = {
    // 手动检查更新
    checkUpdate: (): Promise<ApiResponse<UpdateInfo | null>> => {
      return ipcRenderer.invoke('updater:check-update')
    },

    // 下载更新
    downloadUpdate: (): Promise<ApiResponse<void>> => {
      return ipcRenderer.invoke('updater:download-update')
    },

    // 安装更新
    installUpdate: (): Promise<ApiResponse<void>> => {
      return ipcRenderer.invoke('updater:install-update')
    },

    // 获取状态
    getStatus: (): Promise<ApiResponse<UpdaterState>> => {
      return ipcRenderer.invoke('updater:get-status')
    },

    // 启用自动检查
    enableAutoCheck: (intervalHours?: number): Promise<ApiResponse<void>> => {
      return ipcRenderer.invoke('updater:enable-auto-check', intervalHours)
    },

    // 禁用自动检查
    disableAutoCheck: (): Promise<ApiResponse<void>> => {
      return ipcRenderer.invoke('updater:disable-auto-check')
    },

    // 监听状态更新
    onStatusUpdate: (callback: (state: UpdaterState) => void): (() => void) => {
      const listener = (_event: any, state: UpdaterState) => {
        callback(state)
      }
      ipcRenderer.on('updater:status-update', listener)

      // 返回取消订阅函数
      return () => {
        ipcRenderer.removeListener('updater:status-update', listener)
      }
    }
  }

  return Object.assign(obj, { updater })
}
