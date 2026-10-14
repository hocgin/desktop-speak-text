import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  UpdaterState,
  UpdateInfo,
  DownloadProgress,
  UpdaterStatus
} from './type.js'

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    status: 'idle'
  })
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 初始化时获取状态并监听更新
  useEffect(() => {
    const initialize = async () => {
      try {
        const response = await window.electron.updater.getStatus()
        if (response.success && response.data) {
          setState(response.data)
        }
      } catch (error) {
        console.error('获取更新状态失败:', error)
      }
    }

    initialize()

    // 监听状态更新
    const unsubscribe = window.electron.updater.onStatusUpdate((newState) => {
      setState(newState)
    })
    unsubscribeRef.current = unsubscribe

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  // 检查更新
  const checkUpdate = useCallback(async (): Promise<{ success: boolean; updateInfo?: UpdateInfo; error?: string }> => {
    try {
      const response = await window.electron.updater.checkUpdate()
      return {
        success: response.success,
        updateInfo: response.data || undefined,
        error: response.error
      }
    } catch (error) {
      console.error('检查更新失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查更新失败'
      }
    }
  }, [])

  // 下载更新
  const downloadUpdate = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await window.electron.updater.downloadUpdate()
      return {
        success: response.success,
        error: response.error
      }
    } catch (error) {
      console.error('下载更新失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载更新失败'
      }
    }
  }, [])

  // 安装更新
  const installUpdate = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await window.electron.updater.installUpdate()
      return {
        success: response.success,
        error: response.error
      }
    } catch (error) {
      console.error('安装更新失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装更新失败'
      }
    }
  }, [])

  // 启用自动检查
  const enableAutoCheck = useCallback(async (intervalHours: number = 24): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await window.electron.updater.enableAutoCheck(intervalHours)
      return {
        success: response.success,
        error: response.error
      }
    } catch (error) {
      console.error('启用自动检查失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '启用自动检查失败'
      }
    }
  }, [])

  // 禁用自动检查
  const disableAutoCheck = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await window.electron.updater.disableAutoCheck()
      return {
        success: response.success,
        error: response.error
      }
    } catch (error) {
      console.error('禁用自动检查失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '禁用自动检查失败'
      }
    }
  }, [])

  return {
    // 状态
    state,
    status: state.status,
    updateInfo: state.updateInfo,
    downloadProgress: state.downloadProgress,
    error: state.error,

    // 帮助方法
    hasUpdate: state.status === 'update-available' || state.status === 'downloaded',
    isChecking: state.status === 'checking',
    isDownloading: state.status === 'downloading',
    isDownloaded: state.status === 'downloaded',
    isInstalling: state.status === 'installing',
    hasError: state.status === 'error',

    // 操作方法
    checkUpdate,
    downloadUpdate,
    installUpdate,
    enableAutoCheck,
    disableAutoCheck
  }
}

export type UseUpdaterReturn = ReturnType<typeof useUpdater>
