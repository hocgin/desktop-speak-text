// 本地 API 服务类型定义

export const API_DEFAULT_PORT = 23456

export interface ApiServerConfig {
  enabled: boolean
  port: number
}

export interface ApiServerState extends ApiServerConfig {
  running: boolean
  error?: string
}

export interface ApiServerAPI {
  getState: () => Promise<ApiServerState>
  // 应用新配置：持久化并立即启停服务
  apply: (config: ApiServerConfig) => Promise<ApiServerState>
}
