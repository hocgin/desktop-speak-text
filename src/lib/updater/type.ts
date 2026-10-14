// Updater 类型定义

export interface UpdateInfo {
  version: string // 新版本号
  releaseDate: string // 发布日期
  currentVersion: string // 当前版本
  releaseName?: string // 版本名称
  releaseNotes?: string // 更新日志
  files?: Array<{
    url: string
    sha512: string
    size: number
  }>
}

export interface DownloadProgress {
  total: number // 总字节数
  delta: number // 本次下载字节数
  transferred: number // 已传输字节数
  percent: number // 下载百分比 (0-100)
  bytesPerSecond: number // 下载速度 (字节/秒)
}

export type UpdaterStatus =
  | 'idle' // 空闲状态
  | 'checking' // 检查更新中
  | 'update-available' // 有更新可用
  | 'update-not-available' // 无更新
  | 'downloading' // 下载中
  | 'downloaded' // 下载完成
  | 'installing' // 安装中
  | 'error' // 错误

export interface UpdaterState {
  status: UpdaterStatus
  updateInfo?: UpdateInfo
  downloadProgress?: DownloadProgress
  error?: string
  lastCheckTime?: number // 上次检查时间戳
}

// API 响应格式
export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

// Updater API 接口
export interface UpdaterAPI {
  // 手动检查更新
  checkUpdate: () => Promise<ApiResponse<UpdateInfo | null>>

  // 下载更新
  downloadUpdate: () => Promise<ApiResponse<void>>

  // 安装更新（会重启应用）
  installUpdate: () => Promise<ApiResponse<void>>

  // 获取当前应用版本
  getVersion: () => Promise<ApiResponse<string>>

  // 获取当前状态
  getStatus: () => Promise<ApiResponse<UpdaterState>>

  // 启用自动检查（启动延迟检查一次，之后定时检查，默认6小时）
  enableAutoCheck: (intervalHours?: number) => Promise<ApiResponse<void>>

  // 禁用自动检查
  disableAutoCheck: () => Promise<ApiResponse<void>>

  // 监听状态更新事件（由主进程主动推送）
  onStatusUpdate: (callback: (state: UpdaterState) => void) => () => void
}
