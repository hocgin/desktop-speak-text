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
let startupCheckTimer: NodeJS.Timeout | null = null
// 启动后延迟检查，避免与启动流程抢占资源
const STARTUP_CHECK_DELAY_MS = 5000
// 默认周期检查间隔（小时）
const DEFAULT_CHECK_INTERVAL_HOURS = 6
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

// 静默检查：正在检查/下载/安装或已下载待安装时跳过，避免打断当前流程
async function silentCheck(reason: string) {
  if (['checking', 'downloading', 'downloaded', 'installing'].includes(currentState.status)) {
    console.log(`[Updater] ${reason}：当前状态为 ${currentState.status}，跳过检查`)
    return
  }
  console.log(`[Updater] ${reason}`)
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    console.error(`[Updater] ${reason}失败:`, error)
  }
}

function stopAutoCheck() {
  if (startupCheckTimer) {
    clearTimeout(startupCheckTimer)
    startupCheckTimer = null
  }
  if (autoCheckTimer) {
    clearInterval(autoCheckTimer)
    autoCheckTimer = null
  }
}

// 启动检查 + 周期性检查
function startAutoCheck(intervalHours: number) {
  stopAutoCheck()
  startupCheckTimer = setTimeout(() => {
    startupCheckTimer = null
    void silentCheck('启动时检查更新')
  }, STARTUP_CHECK_DELAY_MS)
  autoCheckTimer = setInterval(
    () => void silentCheck(`定时检查更新 (间隔: ${intervalHours}小时)`),
    intervalHours * 60 * 60 * 1000
  )
  console.log(`[Updater] 已启用自动检查，间隔: ${intervalHours}小时`)
}

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

  // 获取当前应用版本
  ipcMain.handle('updater:get-version', async (): Promise<ApiResponse<string>> => {
    return { success: true, data: app.getVersion() }
  })

  // 获取状态
  ipcMain.handle('updater:get-status', async (): Promise<ApiResponse<UpdaterState>> => {
    return {
      success: true,
      data: currentState
    }
  })

  // 启用自动检查
  ipcMain.handle(
    'updater:enable-auto-check',
    async (_, intervalHours: number = DEFAULT_CHECK_INTERVAL_HOURS): Promise<ApiResponse<void>> => {
      if (!Number.isFinite(intervalHours) || intervalHours <= 0) {
        return { success: false, error: '检查间隔必须大于 0' }
      }
      startAutoCheck(intervalHours)
      return { success: true }
    }
  )

  // 禁用自动检查
  ipcMain.handle('updater:disable-auto-check', async (): Promise<ApiResponse<void>> => {
    stopAutoCheck()
    console.log('[Updater] 已禁用自动检查')
    return { success: true }
  })

  // 应用启动时开启自动检查：启动延迟检查一次，之后周期性检查
  startAutoCheck(DEFAULT_CHECK_INTERVAL_HOURS)

  console.log('[Updater] 主进程模块已初始化')
}
