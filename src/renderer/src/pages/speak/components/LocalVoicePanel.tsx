import React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { kokoroLanguage } from '@/lib/ai/catalog.js'
import type { AIState, LocalTTSInput } from '@/lib/ai/type.js'
import { Alert } from '@/renderer/components/ui/alert.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Input } from '@/renderer/components/ui/input.js'
import { Label } from '@/renderer/components/ui/label.js'
import { Textarea } from '@/renderer/components/ui/textarea.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/renderer/components/ui/select.js'

interface Props {
  state?: AIState
  value: LocalTTSInput
  onChange(value: LocalTTSInput): void
  disabled: boolean
  referenceName?: string
  onReferenceName(name: string): void
}

function Field({
  label,
  required,
  help,
  children
}: {
  label: string
  required?: boolean
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

export function LocalVoicePanel({
  state,
  value,
  onChange,
  disabled,
  referenceName,
  onReferenceName
}: Props) {
  const { t } = useTranslation()
  const model = state?.models.find((m) => m.id === value.modelId)
  const patch = (p: Partial<LocalTTSInput>) => onChange({ ...value, ...p })
  return (
    <div className="space-y-4">
      {!state?.runtimeReady && <Alert variant="info">{t('ai.installFirst')}</Alert>}
      <Field label={t('ai.localModel')}>
        <Select
          value={value.modelId || undefined}
          disabled={disabled}
          onValueChange={(id) => {
            const m = state!.models.find((m) => m.id === id)!
            onChange({
              modelId: id,
              speaker: m.family === 'kokoro_tts' ? 'zf_xiaobei' : m.voices?.[0],
              language: 'zh',
              speed: 1
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('ai.selectModel')} />
          </SelectTrigger>
          <SelectContent>
            {state?.models
              .filter((m) => m.installed)
              .map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      {model && (
        <>
          {model.family !== 'kokoro_tts' && (
            <Field label={t('ai.language')}>
              <Select
                value={value.language || 'zh'}
                disabled={disabled}
                onValueChange={(language) => patch({ language })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {model.languages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {model.mode === 'speaker' && (
            <Field label={t('ai.speaker')} required>
              <Select
                value={value.speaker}
                disabled={disabled}
                onValueChange={(speaker) =>
                  patch({
                    speaker,
                    ...(model.family === 'kokoro_tts' ? { language: kokoroLanguage(speaker) } : {})
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {model.voices?.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {model.family === 'qwen3_tts' && (
            <Field label={t('ai.voiceDescription')} required={model.mode === 'design'}>
              <Textarea
                value={value.description ?? ''}
                maxLength={2000}
                disabled={disabled}
                className="min-h-20"
                onChange={(e) => patch({ description: e.target.value })}
                placeholder={t('ai.descriptionPlaceholder')}
              />
            </Field>
          )}
          {model.mode === 'clone' && (
            <>
              <Field label={t('ai.reference')} required help={t('ai.referenceHelp')}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    disabled={!state?.runtimeReady || disabled}
                    onClick={async () => {
                      try {
                        const ref = await window.electron.ai.selectReference()
                        if (ref) {
                          patch({ referenceId: ref.id })
                          onReferenceName(ref.name)
                        }
                      } catch (error) {
                        toast.error(String(error))
                      }
                    }}
                  >
                    {t('ai.selectReference')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {value.referenceId ? referenceName : t('ai.noReference')}
                  </span>
                </div>
              </Field>
              <Field label={t('ai.speed')}>
                <Input
                  type="number"
                  min={0.5}
                  max={2}
                  step={0.1}
                  disabled={disabled}
                  value={value.speed || 1}
                  onChange={(e) => patch({ speed: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label={t('ai.emotion')}>
                <Input
                  value={value.emotion ?? ''}
                  maxLength={1000}
                  disabled={disabled}
                  onChange={(e) => patch({ emotion: e.target.value })}
                />
              </Field>
            </>
          )}
        </>
      )}
    </div>
  )
}
