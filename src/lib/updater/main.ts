import { ipcMain, app, BrowserWindow } from 'electron'
import pkg from 'electron-updater'
import path from 'path'
const { autoUpdater } = pkg
import type {
  UpdateInfo,
  DownloadProgress,
  UpdaterState,
  ApiResponse
} from './type.js'

// 主窗口引用
let mainWindow: BrowserWindow | null = null

// 当前状态
let currentState: UpdaterState = {
  status: 'idle'
}

// 自动检查定时器
let autoCheckTimer: NodeJS.Timeout | null = null
let isUpdaterMainInitialized = false

// 标记是否处于开发态更新调试模式，避免误执行安装流程
const isDevUpdaterMode = !app.isPackaged

// 状态更新通知函数
function notifyStatusUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status-update', currentState)
  }
}

// 格式化更新信息
function formatUpdateInfo(info: any): UpdateInfo {
  return {
    version: info.version,
    releaseDate: info.releaseDate ? new Date(info.releaseDate).toISOString() : new Date().toISOString(),
    currentVersion: app.getVersion(),
    releaseName: info.releaseName,
    releaseNotes: info.releaseNotes,
    files: info.files
  }
}

// 格式化下载进度
function formatDownloadProgress(progress: any): DownloadProgress {
  return {
    total: progress.total || 0,
    delta: progress.delta || 0,
    transferred: progress.transferred || 0,
    percent: progress.percent || 0,
    bytesPerSecond: progress.bytesPerSecond || 0
  }
}

// 配置 autoUpdater
autoUpdater.autoDownload = false // 不自动下载
autoUpdater.autoInstallOnAppQuit = false // 不在退出时自动安装

if (!app.isPackaged) {
  Object.defineProperty(app, 'isPackaged', { get: () => true });
  autoUpdater.forceDevUpdateConfig = true
  autoUpdater.updateConfigPath = path.join(__dirname, "../../dev-app-update.yml");
  console.warn('[Updater] 当前处于开发态更新调试模式，仅支持检查和下载，不支持安装')
}

// 事件监听器
autoUpdater.on('checking-for-update', () => {
  console.log('[Updater] 正在检查更新...')
  currentState = {
    ...currentState,
    status: 'checking',
    error: undefined
  }
  notifyStatusUpdate()
})

autoUpdater.on('update-available', (info) => {
  console.log('[Updater] 发现新版本:', info.version)
  currentState = {
    status: 'update-available',
    updateInfo: formatUpdateInfo(info),
    lastCheckTime: Date.now()
  }
  notifyStatusUpdate()
})

autoUpdater.on('update-not-available', (info) => {
  console.log('[Updater] 已是最新版本:', info.version)
  currentState = {
    ...currentState,
    status: 'update-not-available',
    lastCheckTime: Date.now()
  }
  notifyStatusUpdate()
})

autoUpdater.on('error', (error) => {
  console.error('[Updater] 更新错误:', error)
  currentState = {
    ...currentState,
    status: 'error',
    error: error?.message || '未知错误'
  }
  notifyStatusUpdate()
})

autoUpdater.on('download-progress', (progress) => {
  if (currentState.status !== 'downloading') {
    currentState = {
      ...currentState,
      status: 'downloading'
    }
  }
  currentState.downloadProgress = formatDownloadProgress(progress)
  notifyStatusUpdate()
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] 更新下载完成')
  currentState = {
    status: 'downloaded',
    updateInfo: formatUpdateInfo(info),
    downloadProgress: undefined,
    lastCheckTime: Date.now()
  }
  notifyStatusUpdate()
})

// 初始化函数
export function initUpdaterMain(window: BrowserWindow) {
  mainWindow = window

  // 允许重复调用以更新窗口引用，但避免重复注册 IPC handler
  if (isUpdaterMainInitialized) {
    return
  }
  isUpdaterMainInitialized = true

  // 检查更新
  ipcMain.handle('updater:check-update', async (): Promise<ApiResponse<UpdateInfo | null>> => {
    try {
      currentState = {
        ...currentState,
        status: 'checking',
        error: undefined
      }
      notifyStatusUpdate()

      await autoUpdater.checkForUpdates()

      // 等待一下让事件处理完成
      await new Promise(resolve => setTimeout(resolve, 500))

      if (currentState.status === 'update-available' && currentState.updateInfo) {
        return {
          success: true,
          data: currentState.updateInfo
        }
      } else if (currentState.status === 'update-not-available') {
        return {
          success: true,
          data: null
        }
      } else if (currentState.status === 'error') {
        return {
          success: false,
          error: currentState.error || '检查更新失败'
        }
      }

      // 仍在检查中
      return {
        success: true,
        data: null
      }
    } catch (error) {
      console.error('[Updater] 检查更新失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '检查更新失败'
      }
    }
  })

  // 下载更新
  ipcMain.handle('updater:download-update', async (): Promise<ApiResponse<void>> => {
    try {
      if (currentState.status !== 'update-available') {
        return {
          success: false,
          error: '当前没有可下载的更新'
        }
      }

      currentState = {
        ...currentState,
        status: 'downloading',
        error: undefined
      }
      notifyStatusUpdate()

      await autoUpdater.downloadUpdate()

      return { success: true }
    } catch (error) {
      console.error('[Updater] 下载更新失败:', error)
      currentState = {
        ...currentState,
        status: 'error',
        error: error instanceof Error ? error.message : '下载更新失败'
      }
      notifyStatusUpdate()
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载更新失败'
      }
    }
  })

  // 安装更新
  ipcMain.handle('updater:install-update', async (): Promise<ApiResponse<void>> => {
    try {
      if (currentState.status !== 'downloaded') {
        return {
          success: false,
          error: '没有已下载的更新'
        }
      }

      // 开发态使用的是 Electron 壳（bundle id 为 com.github.Electron），
      // 与正式打包应用的 bundle id 不一致，直接安装会触发 ShipIt 定位失败。
      if (isDevUpdaterMode) {
        const errorMessage = '开发模式不支持安装更新，请使用 dist/mac-arm64/*.app 或正式安装包验证更新流程'
        console.warn(`[Updater] ${errorMessage}`)
        currentState = {
          ...currentState,
          status: 'error',
          error: errorMessage
        }
        notifyStatusUpdate()
        return {
          success: false,
          error: errorMessage
        }
      }

      currentState = {
        ...currentState,
        status: 'installing'
      }
      notifyStatusUpdate()

      // 通知所有窗口即将重启
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('updater:before-quit')
      })

      // 短暂延迟以允许 UI 显示"安装中"状态
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 退出并安装
      autoUpdater.quitAndInstall(false, true)

      return { success: true }
    } catch (error) {
      console.error('[Updater] 安装更新失败:', error)
      currentState = {
        ...currentState,
        status: 'error',
        error: error instanceof Error ? error.message : '安装更新失败'
      }
      notifyStatusUpdate()
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装更新失败'
      }
    }
  })

  // 获取状态
  ipcMain.handle('updater:get-status', async (): Promise<ApiResponse<UpdaterState>> => {
    return {
      success: true,
      data: currentState
    }
  })

  // 启用自动检查
  ipcMain.handle('updater:enable-auto-check', async (_, intervalHours: number = 24): Promise<ApiResponse<void>> => {
    try {
      // 清除现有定时器
      if (autoCheckTimer) {
        clearInterval(autoCheckTimer)
        autoCheckTimer = null
      }

      // 立即检查一次
      await autoUpdater.checkForUpdates()

      // 设置定时检查
      const intervalMs = intervalHours * 60 * 60 * 1000
      autoCheckTimer = setInterval(async () => {
        console.log(`[Updater] 定时检查更新 (间隔: ${intervalHours}小时)`)
        try {
          await autoUpdater.checkForUpdates()
        } catch (error) {
          console.error('[Updater] 定时检查失败:', error)
        }
      }, intervalMs)

      console.log(`[Updater] 已启用自动检查，间隔: ${intervalHours}小时`)
      return { success: true }
    } catch (error) {
      console.error('[Updater] 启用自动检查失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '启用自动检查失败'
      }
    }
  })

  // 禁用自动检查
  ipcMain.handle('updater:disable-auto-check', async (): Promise<ApiResponse<void>> => {
    try {
      if (autoCheckTimer) {
        clearInterval(autoCheckTimer)
        autoCheckTimer = null
        console.log('[Updater] 已禁用自动检查')
      }
      return { success: true }
    } catch (error) {
      console.error('[Updater] 禁用自动检查失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '禁用自动检查失败'
      }
    }
  })

  // 应用启动时自动检查更新（仅在打包后）
  if (app.isPackaged) {
    // 延迟5秒后检查，避免启动时过于繁忙
    setTimeout(async () => {
      console.log('[Updater] 启动时自动检查更新')
      try {
        await autoUpdater.checkForUpdates()
        // 启用24小时定时检查
        const intervalMs = 24 * 60 * 60 * 1000
        autoCheckTimer = setInterval(async () => {
          console.log('[Updater] 定时检查更新')
          try {
            await autoUpdater.checkForUpdates()
          } catch (error) {
            console.error('[Updater] 定时检查失败:', error)
          }
        }, intervalMs)
      } catch (error) {
        console.error('[Updater] 启动时检查失败:', error)
      }
    }, 5000)
  }

  console.log('[Updater] 主进程模块已初始化')
}
