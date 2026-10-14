import { BrowserWindow, shell } from 'electron'
import path from 'node:path'
import icon from '../../resources/icon.png?asset'
import { menubar } from 'menubar'

import { registerRoute } from '../lib/electron-router-dom.js'
import * as url from 'node:url'
import { initMain } from '../lib/i18n/main.js'

type Route = Parameters<typeof registerRoute>[0]

interface WindowProps extends Electron.BrowserWindowConstructorOptions {
  id: Route['id']
  query?: Route['query']
}

export function createWindow({ id, query, ...options }: WindowProps) {
  const window = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    resizable: false,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      // contextIsolation: false,
      // nodeIntegration: true,
      webviewTag: true,
      sandbox: false
    },
    ...options
  })

  registerRoute({
    id,
    query,
    browserWindow: window,
    htmlFile: path.join(__dirname, '../renderer/index.html')
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  initMain(window)
  return window
}

export function createMainWindow() {
  let id: any = 'main'
  const mainWindow = createWindow({
    id,
    resizable: true,
    frame: false
  })

  mainWindow.on('closed', () => {
    BrowserWindow.getAllWindows().forEach((browserWindow) => {
      browserWindow.close()
    })
  })
  // F12 open dev tools
  if (import.meta.env.DEV) {
    mainWindow.webContents.openDevTools()
  }
  return mainWindow
}

export function createMenubarWindow(props: any = {}) {
  const port = props.port || 5173
  let htmlFile =
    props.htmlFile ||
    url.format({
      pathname: path.join(__dirname, '../renderer/index.html'),
      protocol: 'file:',
      slashes: true
    })
  let id = props.id || 'menubar'
  let query = props.query

  /// ==============

  const mb = menubar({
    browserWindow: {
      width: 400,
      height: 500,
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.mjs'),
        contextIsolation: true,
        sandbox: false,

        backgroundThrottling: false
      },
      fullscreenable: false,
      resizable: false,
      alwaysOnTop: true
    },
    index: false,
    showOnRightClick: false
  })
  mb.on('before-load', () => {
    registerRoute({
      id,
      query,
      browserWindow: mb.window as any,
      htmlFile: path.join(__dirname, '../renderer/index.html')
    })
  })
  return mb
}
