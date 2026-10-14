import React from 'react'
import { Gauge, Volume2, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Slider } from '@/renderer/components/ui/slider.js'
import type { TTSOptions } from '@/lib/tts/type.js'

interface ParameterPanelProps {
  value: TTSOptions
  onChange?: (options: TTSOptions) => void
  disabled?: boolean
}

function Row({
  icon,
  label,
  display,
  children
}: {
  icon: React.ReactNode
  label: string
  display: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
          {display}
        </span>
      </div>
      {children}
    </div>
  )
}

export const ParameterPanel: React.FC<ParameterPanelProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation()
  const handleChange = (key: keyof TTSOptions, val: number) => onChange?.({ ...value, [key]: val })

  return (
    <div className="space-y-5">
      <Row icon={<Zap />} label={t('params.rate')} display={`${value.rate.toFixed(1)}x`}>
        <Slider
          min={0.5}
          max={2}
          step={0.1}
          value={value.rate}
          disabled={disabled}
          onValueChange={([v]) => handleChange('rate', v)}
        />
      </Row>
      <Row icon={<Volume2 />} label={t('params.volume')} display={`${Math.round(value.volume * 100)}%`}>
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={value.volume}
          disabled={disabled}
          onValueChange={([v]) => handleChange('volume', v)}
        />
      </Row>
      <Row icon={<Gauge />} label={t('params.pitch')} display={`${value.pitch > 0 ? '+' : ''}${value.pitch}Hz`}>
        <Slider
          min={-50}
          max={50}
          step={5}
          value={value.pitch}
          disabled={disabled}
          onValueChange={([v]) => handleChange('pitch', v)}
        />
      </Row>
    </div>
  )
}
