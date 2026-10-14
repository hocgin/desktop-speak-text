import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Loader2, Play, Star } from 'lucide-react'
import { Badge } from '@/renderer/components/ui/badge.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Checkbox } from '@/renderer/components/ui/checkbox.js'
import { Label } from '@/renderer/components/ui/label.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'
import { useTranslation } from 'react-i18next'
import { cn } from '@/renderer/lib/utils.js'
import type { VoiceInfo } from '@/lib/tts/type.js'

interface VoiceSelectorProps {
  voices: VoiceInfo[]
  value?: string
  onChange?: (voiceName: string) => void
  disabled?: boolean
  onPreview?: (voiceName: string) => Promise<{ success: boolean; error?: string }>
  previewing?: string
}

const COUNTRY_CODES = ['CN', 'HK', 'TW', 'US', 'GB', 'JP', 'KR', 'FR', 'DE', 'ES', 'RU', 'CA', 'AU']
const LANGUAGE_CODES = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']

function Filter({
  label,
  value,
  onChange,
  options,
  disabled
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  disabled?: boolean
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  value,
  onChange,
  disabled = false,
  onPreview,
  previewing
}) => {
  const { t } = useTranslation()
  const all = { label: t('voice.all'), value: 'all' }
  const countryGroups = [
    all,
    ...COUNTRY_CODES.map((c) => ({ label: t(`voice.country.${c}`), value: c }))
  ]
  const languageGroups = [
    all,
    ...LANGUAGE_CODES.map((l) => ({ label: t(`voice.lang.${l}`), value: l }))
  ]
  const genderGroups = [
    all,
    { label: t('voice.female'), value: 'Female' },
    { label: t('voice.male'), value: 'Male' }
  ]
  const [languageFilter, setLanguageFilter] = useState('zh')
  const [countryFilter, setCountryFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  useEffect(() => {
    setFavorites(window.electron.store.get('voiceFavorites') || [])
  }, [])

  const toggleFavorite = useCallback(
    (voiceName: string) => {
      const next = favorites.includes(voiceName)
        ? favorites.filter((name) => name !== voiceName)
        : [...favorites, voiceName]
      setFavorites(next)
      window.electron.store.set('voiceFavorites', next)
    },
    [favorites]
  )

  const filteredVoices = useMemo(() => {
    return voices.filter((voice) => {
      if (languageFilter !== 'all' && !voice.locale.startsWith(languageFilter)) return false
      if (countryFilter !== 'all') {
        const parts = voice.locale.split('-')
        if (parts[parts.length - 1] !== countryFilter) return false
      }
      if (genderFilter !== 'all' && voice.gender !== genderFilter) return false
      if (showFavoritesOnly && !favorites.includes(voice.name)) return false
      return true
    })
  }, [voices, languageFilter, countryFilter, genderFilter, showFavoritesOnly, favorites])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="text-xs font-semibold tracking-wider text-muted-foreground">{t('voice.title')}</div>

      <div className="grid grid-cols-3 gap-2">
        <Filter label={t('voice.language')} value={languageFilter} onChange={setLanguageFilter} options={languageGroups} disabled={disabled} />
        <Filter label={t('voice.region')} value={countryFilter} onChange={setCountryFilter} options={countryGroups} disabled={disabled} />
        <Filter label={t('voice.gender')} value={genderFilter} onChange={setGenderFilter} options={genderGroups} disabled={disabled} />
      </div>

      <div className="flex items-center justify-between">
        <Label className="cursor-pointer text-xs text-muted-foreground">
          <Checkbox
            checked={showFavoritesOnly}
            onCheckedChange={(c) => setShowFavoritesOnly(c === true)}
            disabled={disabled}
          />
          {t('voice.favoritesOnly')}
        </Label>
        <span className="text-xs text-muted-foreground">{t('voice.count', { count: filteredVoices.length })}</span>
      </div>

      <div className="max-h-48 min-h-32 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-1">
        {filteredVoices.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('voice.none')}</div>
        )}
        {filteredVoices.map((voice) => {
          const selected = voice.name === value
          const fav = favorites.includes(voice.name)
          return (
            <div
              key={voice.name}
              role="option"
              aria-selected={selected}
              onClick={() => !disabled && onChange?.(voice.name)}
              className={cn(
                'group flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                selected ? 'bg-accent text-accent-foreground' : 'hover:bg-card',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={voice.gender === 'Male' ? 'info' : 'destructive'} className="px-1.5 text-[11px]">
                  {voice.gender === 'Male' ? t('voice.genderM') : t('voice.genderF')}
                </Badge>
                <span className="truncate text-xs">{voice.displayName}</span>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t('voice.preview')}
                  disabled={disabled || !!previewing}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPreview?.(voice.name)
                  }}
                >
                  {previewing === voice.name ? <Loader2 className="animate-spin" /> : <Play />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={fav ? t('voice.unfavorite') : t('voice.favorite')}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(voice.name)
                  }}
                >
                  <Star className={cn(fav && 'fill-amber-400 text-amber-400')} />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
