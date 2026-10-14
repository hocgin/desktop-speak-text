export const fallbackLng = 'en'
export const languages = [fallbackLng, 'zh', 'zh-TW']
export const defaultNS = 'translation'
export const cookieName = 'i18next'
export const headerName = 'x-next-i18n-router-locale'
export const prefixDefault = false
export const noPrefix = false

/**
 * 根据系统语言解析应用语言：繁体中文地区使用 zh-TW，其余中文使用 zh，其余统一回退到英文
 */
export function resolveLanguage(locale?: string): string {
  const value = locale || ''
  if (/^zh[-_](tw|hk|mo|hant)/i.test(value)) return 'zh-TW'
  return /^zh(?![a-z])/i.test(value) ? 'zh' : fallbackLng
}

/** 语言偏好：system 表示跟随系统 */
export type LanguagePreference = 'system' | 'en' | 'zh' | 'zh-TW'
export const languagePreferenceKey = 'language'
// 未设置偏好时的默认值
export const defaultLanguagePreference: LanguagePreference = 'en'

const explicitLanguages = ['en', 'zh', 'zh-TW']

/** 根据用户偏好与系统语言得出最终使用的语言；未设置偏好时使用默认语言（英文） */
export function resolvePreference(pref: unknown, systemLocale?: string): string {
  if (typeof pref === 'string' && explicitLanguages.includes(pref)) return pref
  return pref === 'system' ? resolveLanguage(systemLocale) : fallbackLng
}
