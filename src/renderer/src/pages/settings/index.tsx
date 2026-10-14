import React, { useEffect, useState } from 'react'
import { ExternalLink, Languages, MessageSquare, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applyLanguagePreference, currentPreference } from '@/lib/i18n/renderer.js'
import { resolveLanguage, type LanguagePreference } from '@/lib/i18n/config.js'
import { useUpdater } from '@/lib/updater/renderer.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Card } from '@/renderer/components/ui/card.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'

// 语言名称使用各自的本地名称，不随界面语言变化
const FEEDBACK_URL = 'https://logspot.hocgin.top/addone-speak-text/?active=feedback'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', zh: '简体中文' }

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [pref, setPref] = useState<LanguagePreference>(() => currentPreference())
  const systemLang = LANGUAGE_NAMES[resolveLanguage(navigator.language)]
  const updater = useUpdater()
  const [version, setVersion] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    window.electron.updater.getVersion().then((res) => {
      if (res.success && res.data) setVersion(res.data)
    })
  }, [])

  // 根据更新状态生成提示文案
  const { status, updateInfo, downloadProgress, error } = updater
  let message = ''
  if (status === 'error') message = t('settings.checkFailed', { error })
  else if (status === 'update-available')
    message = t('settings.updateAvailable', { version: updateInfo?.version })
  else if (status === 'downloading')
    message = t('settings.downloading', { percent: Math.round(downloadProgress?.percent ?? 0) })
  else if (status === 'downloaded')
    message = t('settings.downloaded', { version: updateInfo?.version })
  else if (status === 'installing') message = t('settings.installing')
  else if (checked && status === 'update-not-available') message = t('settings.upToDate')

  const busy = ['checking', 'downloading', 'installing'].includes(status)
  const handleCheck = async (): Promise<void> => {
    setChecked(true)
    await updater.checkUpdate()
  }

  return (
    <div className="h-full overflow-y-auto px-6 pt-5 pb-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </header>

      <Card className="max-w-2xl gap-0 p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Languages className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium">{t('settings.language')}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.languageHelp')}</p>
            </div>
          </div>
          <Select
            value={pref}
            onValueChange={(v) => {
              const next = v as LanguagePreference
              setPref(next)
              applyLanguagePreference(next)
            }}
          >
            <SelectTrigger className="w-52" aria-label={t('settings.language')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                {t('settings.system')} · {systemLang}
              </SelectItem>
              <SelectItem value="en">{LANGUAGE_NAMES.en}</SelectItem>
              <SelectItem value="zh">{LANGUAGE_NAMES.zh}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium">
                {t('settings.version')} {version && `v${version}`}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {message || t('settings.versionHelp')}
              </p>
            </div>
          </div>
          {status === 'update-available' ? (
            <Button onClick={() => updater.downloadUpdate()}>{t('settings.download')}</Button>
          ) : status === 'downloaded' ? (
            <Button onClick={() => updater.installUpdate()}>{t('settings.install')}</Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={handleCheck}>
              {status === 'checking' ? t('settings.checking') : t('settings.checkUpdate')}
            </Button>
          )}
        </div>

        <div className="border-t" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <div className="text-sm font-medium">{t('settings.feedback')}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.feedbackHelp')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.electron.ipcRenderer.send('openExternal', FEEDBACK_URL)}
          >
            <ExternalLink />
            {t('settings.feedbackOpen')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
