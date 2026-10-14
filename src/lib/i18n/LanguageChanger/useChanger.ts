'use client'

import { languages } from '../config.js'
import { useBoolean } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { changeLanguageRequest } from 'i18next-electron-fs-backend'

export function useChanger() {
  let [loading, { setTrue, setFalse }] = useBoolean(false)
  const { i18n } = useTranslation()
  const currentLocale = i18n.language

  let changeLocale = (newLocale: string) => {
    try {
      setTrue()
      i18n.changeLanguage(newLocale)
      window.electron.ipcRenderer.send(changeLanguageRequest, { lng: newLocale })
    } catch (e) {
      console.error(e)
    } finally {
      setFalse()
    }
  }
  return {
    currentLocale,
    changeLocale,
    loading,
    supportLocales: languages ?? []
  } as const
}
