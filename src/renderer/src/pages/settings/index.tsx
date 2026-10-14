import React, { useEffect, useState } from 'react'
import { ExternalLink, Languages, MessageSquare, RefreshCw, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applyLanguagePreference, currentPreference } from '@/lib/i18n/renderer.js'
import { resolveLanguage, type LanguagePreference } from '@/lib/i18n/config.js'
import { useUpdater } from '@/lib/updater/renderer.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Card } from '@/renderer/components/ui/card.js'
import { Input } from '@/renderer/components/ui/input.js'
import { cn } from '@/renderer/lib/utils.js'
import { API_DEFAULT_PORT, type ApiServerState } from '@/lib/api/type.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'

// 语言名称使用各自的本地名称，不随界面语言变化
const FEEDBACK_URL = 'https://logspot.hocgin.top/addone-speak-text/?active=feedback'

const API_DOCS_URL = 'https://logspot.hocgin.top/addone-speak-text/?active=api'

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', zh: '简体中文', 'zh-TW': '繁體中文' }

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [pref, setPref] = useState<LanguagePreference>(() => currentPreference())
  const systemLang = LANGUAGE_NAMES[resolveLanguage(navigator.language)]
  const updater = useUpdater()
  const [version, setVersion] = useState('')
  const [checked, setChecked] = useState(false)

  // 本地 API 服务
  const [api, setApi] = useState<ApiServerState>({
    enabled: false,
    port: API_DEFAULT_PORT,
    running: false
  })
  const [portInput, setPortInput] = useState(String(API_DEFAULT_PORT))
  const [apiBusy, setApiBusy] = useState(false)

  useEffect(() => {
    window.electron.apiServer.getState().then((state) => {
      setApi(state)
      setPortInput(String(state.port))
    })
  }, [])

  const applyApi = async (enabled: boolean, port: number): Promise<void> => {
    setApiBusy(true)
    try {
      const state = await window.electron.apiServer.apply({ enabled, port })
      setApi(state)
      setPortInput(String(state.port))
    } finally {
      setApiBusy(false)
    }
  }
  const portNumber = Number(portInput)
  const portValid = Number.isInteger(portNumber) && portNumber >= 1024 && portNumber <= 65535
  const portDirty = portNumber !== api.port
  const apiBase = `http://127.0.0.1:${api.port}`

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
              <SelectItem value="zh-TW">{LANGUAGE_NAMES['zh-TW']}</SelectItem>
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
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Server className="size-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{t('settings.apiServer')}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {api.error
                    ? t('settings.apiError', { error: api.error })
                    : api.running
                      ? t('settings.apiRunning', { url: apiBase })
                      : t('settings.apiHelp')}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={api.enabled}
              aria-label={t('settings.apiServer')}
              disabled={apiBusy || !portValid}
              onClick={() => void applyApi(!api.enabled, portNumber)}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
                api.enabled ? 'bg-primary' : 'bg-input'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow transition-transform',
                  api.enabled && 'translate-x-5'
                )}
              />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pl-12">
            <label htmlFor="api-port" className="text-sm text-muted-foreground">
              {t('settings.apiPort')}
            </label>
            <Input
              id="api-port"
              inputMode="numeric"
              className="w-28"
              value={portInput}
              aria-invalid={!portValid}
              onChange={(e) => setPortInput(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={apiBusy || !portValid || !portDirty}
              onClick={() => void applyApi(api.enabled, portNumber)}
            >
              {t('settings.apiApply')}
            </Button>
            {!portValid && (
              <span className="text-xs text-destructive">{t('settings.apiPortInvalid')}</span>
            )}
            <Button
              variant="link"
              size="sm"
              className="ml-auto"
              onClick={() => window.electron.ipcRenderer.send('openExternal', API_DOCS_URL)}
            >
              <ExternalLink />
              {t('settings.apiDocs')}
            </Button>
          </div>

          {api.running && (
            <pre className="ml-12 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5">
              {`curl -X POST ${apiBase}/v1/tts \\
  -H 'Content-Type: application/json' \\
  -d '{"text":"你好，世界","voice":"zh-CN-XiaoxiaoNeural"}' \\
  -o speech.mp3`}
            </pre>
          )}
          {api.running && (
            <div className="ml-12 space-y-1.5">
              <div className="text-xs text-muted-foreground">{t('settings.apiMcp')}</div>
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5">
                {`claude mcp add --transport http speak-text ${apiBase}/mcp`}
              </pre>
            </div>
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
