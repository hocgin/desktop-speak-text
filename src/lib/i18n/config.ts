export const fallbackLng = 'en'
export const languages = [fallbackLng, 'zh']
export const defaultNS = 'translation'
export const cookieName = 'i18next'
export const headerName = 'x-next-i18n-router-locale'
export const prefixDefault = false
export const noPrefix = false

/**
 * 根据系统语言解析应用语言：中文系统使用 zh，其余统一回退到英文
 */
export function resolveLanguage(locale?: string): string {
  return /^zh(?![a-z])/i.test(locale || '') ? 'zh' : fallbackLng
}

/** 语言偏好：system 表示跟随系统 */
export type LanguagePreference = 'system' | 'en' | 'zh'
export const languagePreferenceKey = 'language'

/** 根据用户偏好与系统语言得出最终使用的语言 */
export function resolvePreference(pref: unknown, systemLocale?: string): string {
  return pref === 'en' || pref === 'zh' ? pref : resolveLanguage(systemLocale)
}
