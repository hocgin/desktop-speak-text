import React, { useState } from 'react'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { applyLanguagePreference, currentPreference } from '@/lib/i18n/renderer.js'
import { resolveLanguage, type LanguagePreference } from '@/lib/i18n/config.js'
import { Card } from '@/renderer/components/ui/card.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'

// 语言名称使用各自的本地名称，不随界面语言变化
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', zh: '简体中文' }

export default function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [pref, setPref] = useState<LanguagePreference>(() => currentPreference())
  const systemLang = LANGUAGE_NAMES[resolveLanguage(navigator.language)]

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
      </Card>
    </div>
  )
}
