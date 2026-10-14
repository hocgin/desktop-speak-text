import { createElectronRouter } from 'electron-router-dom'

// 检测是否在开发环境
// process.env.NODE_ENV 在 electron-vite dev 时为 'development'
// 在 electron-vite build 和 preview 时为 undefined 或 'production'
const isDev = process.env.NODE_ENV === 'development'

export const { Router, registerRoute, settings } = createElectronRouter({
  // 只在开发环境设置端口
  // 生产环境（pnpm start）不设置端口，使用 file:// 协议
  port: isDev ? 5173 : undefined,
  types: {
    ids: ['main', 'menubar']
  }
})
