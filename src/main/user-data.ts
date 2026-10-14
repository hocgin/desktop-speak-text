import { app } from 'electron'
import path from 'path'

// 开发态使用独立的 userData 目录，避免与已安装的正式版抢占单实例锁、共用数据
// 注意：必须在其他模块读取 userData 之前执行，因此需要作为 index.ts 的第一个 import
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), `${app.getName()}-dev`))
}
