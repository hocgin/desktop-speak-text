import './user-data.js'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { execute, runMigrate } from './db.js'
import { createMainWindow, createMenubarWindow } from './factories.js'
import {
  registerDeeplinkProtocol,
  registerDeeplinkHandle,
  deepLink
} from '../lib/deeplink/deeplink.js'
import { initStoreMain } from '../lib/store/main.js'
import Store from 'electron-store'
import { StoreType } from '../lib/store/type.js'
import { registerToolbarControl } from '../lib/toolbar/main.js'
import { TokenKit } from '../lib/user/index.js'
import { initMain } from '../lib/i18n/main.js'
import { initShellMain } from '../lib/shell/main.js'
import { initAIMain } from '../lib/ai/main.js'
import { initTTSMain } from '../lib/tts/main.js'
import { initUpdaterMain } from '../lib/updater/main.js'
import { initApiServerMain } from '../lib/api/main.js'

// 配置[配置存储]
const store = new Store<StoreType>({
  defaults: {
    userinfo: undefined
  }
})

/// 配置[深度链接]
registerDeeplinkProtocol(app)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ============================ IPC ============================
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on('openExternal', (_, url) => shell.openExternal(url))
  ipcMain.handle('db:execute', execute)
  registerToolbarControl()
  initAIMain()
  initTTSMain(null)
  initUpdaterMain(null as any)
  // ============================ IPC ============================

  initStoreMain(store)
  initApiServerMain(store)
  let mainWindow = createMainWindow() /// 主界面
  createMenubarWindow() /// 小窗口界面
  initMain(mainWindow)
  initShellMain(mainWindow)
  initTTSMain(mainWindow)
  initUpdaterMain(mainWindow)

  try {
    // 主进程能力先完成注册，避免迁移失败时 IPC handler 未挂载
    // 数据库迁移失败只记录日志，不阻断应用继续启动
    await runMigrate()
  } catch (error) {
    console.error('[DB] 数据库迁移失败，应用将继续启动:', error)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

registerDeeplinkHandle(app)

deepLink.on('login', async (payload) => {
  let token = payload.token
  if (!token) {
    return
  }

  /// 1. 解析用户信息
  let userinfo = await TokenKit.decode({ token })
  if (!userinfo) {
    return
  }
  let name = 'userinfo'
  let userdata = { ...userinfo, token }
  store.set(name, userdata)

  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(`store:${name}:update`, userdata)
  })
})
