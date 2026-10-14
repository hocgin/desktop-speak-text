import i18next from 'i18next'
import backend from 'i18next-fs-backend'
import i18nextBackend from 'i18next-electron-fs-backend'
import path from 'path'
import { fallbackLng, languages, defaultNS } from './config.js'
import { ipcMain } from 'electron/main'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import { Channel } from '../uikit/constant.js'

const isMac = process.platform === 'darwin'
const isDev = process.env.NODE_ENV === 'development'
const prependPath = path.join(!isDev ? path.join(process.resourcesPath, '..') : '.', 'src/lib/i18n')

i18next.use(backend).init({
  backend: {
    loadPath: path.join(prependPath, './locales/{{lng}}/{{ns}}.json'),
    addPath: path.join(prependPath, './locales/{{lng}}/{{ns}}.missing.json'),
    contextBridgeApiKey: 'api' // needs to match first parameter of contextBridge.exposeInMainWorld in preload file; defaults to "api"
  },
  // other options you might configure
  debug: isDev,
  supportedLngs: languages,
  fallbackLng,
  lng: fallbackLng, // app ready 前无法可靠获取系统语言，在 initMain 中再切换
  fallbackNS: defaultNS,
  saveMissing: true,
  saveMissingTo: 'current'
})

export default i18next

export function initMain(win: BrowserWindow) {
  i18nextBackend.mainBindings(ipcMain, win, fs)

  // Set up necessary bindings to update the menu items
  // based on the current language selected
  i18next.on('initialized', () => {
    // 默认英文，渲染进程启动后会按用户偏好同步语言
    i18next.changeLanguage(fallbackLng)
    i18next.off('initialized') // Remove listener to this event as it's not needed anymore
    console.log('i18next.main initialized')
    console.log("i18next t('page.test') = ", i18next.t('page.test'))
  })
  i18next.on('languageChanged', (lng) => {
    console.log('i18next.main languageChanged', lng)
    if (i18next.isInitialized) {
      // init
    }
    console.log("i18next.main languageChanged t('page.test') = ", i18next.t('page.test'))
  })
  ipcMain.on('ChangeLanguage-Request', (_, args) => {
    i18next.changeLanguage(args.lng, (error, _t) => {
      if (error) {
        console.error(error)
      }
    })
  })
  ipcMain.on('CurrentLanguage-Request', (event, _) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.webContents.send(
      Channel.TOAST_ERROR,
      `current = ${i18next.language}, t('page.test') ${i18next.t('page.test')}`
    )
  })
}
