import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { default as i18nBackend } from 'i18next-electron-fs-backend'
import {
  fallbackLng,
  languages,
  defaultNS,
  defaultLanguagePreference,
  languagePreferenceKey,
  resolvePreference,
  type LanguagePreference
} from './config.js'

const isMac = window.api.i18nextElectronBackend.clientOptions.platform === 'darwin'
const isDev = window.api.i18nextElectronBackend.clientOptions.environment === 'development'
// const prependPath =
//   isMac && !isDev ? window.api.i18nextElectronBackend.clientOptions.resourcesPath : '.'
const prependPath = !isDev ? window.api.i18nextElectronBackend.clientOptions.resourcesPath : '.'

console.log('renderer.ts prependPath', window.api)

i18next
  .use(i18nBackend as any)
  .use(initReactI18next)
  .init(
    {
      backend: {
        loadPath: prependPath + '/src/lib/i18n/locales/{{lng}}/{{ns}}.json',
        addPath: prependPath + '/src/lib/i18n/locales/{{lng}}/{{ns}}.missing.json',
        contextBridgeApiKey: 'api' // needs to match first parameter of contextBridge.exposeInMainWorld in preload file; defaults to "api"
      },
      debug: isDev,
      fallbackNS: defaultNS,
      lng: resolvePreference(window.electron.store.get(languagePreferenceKey), navigator.language),
      fallbackLng: fallbackLng,
      supportedLngs: languages,
      saveMissing: true,
      saveMissingTo: 'current'
    },
    undefined
  )

window.api.i18nextElectronBackend.onLanguageChange((args) => {
  i18next.changeLanguage(args.lng, (error, _t) => {
    if (error) {
      console.error(error)
    }
  })
})

function currentPreference(): LanguagePreference {
  return (window.electron.store.get(languagePreferenceKey) as LanguagePreference) || defaultLanguagePreference
}

// 启动时把当前语言同步给主进程
window.electron.ipcRenderer.send('ChangeLanguage-Request', {
  lng: resolvePreference(window.electron.store.get(languagePreferenceKey), navigator.language)
})

// 系统语言变化时，仅在“跟随系统”下自动切换
window.addEventListener('languagechange', () => {
  if (currentPreference() !== 'system') return
  void i18next.changeLanguage(resolvePreference('system', navigator.language))
})

/** 保存并应用语言偏好，同步给主进程 */
export function applyLanguagePreference(pref: LanguagePreference) {
  window.electron.store.set(languagePreferenceKey, pref)
  const lng = resolvePreference(pref, navigator.language)
  void i18next.changeLanguage(lng)
  window.electron.ipcRenderer.send('ChangeLanguage-Request', { lng })
}

export { currentPreference }

export default i18next
