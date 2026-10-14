import React, { useCallback } from 'react'
import { FileText, Eraser, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button.js'
import { Textarea } from '@/renderer/components/ui/textarea.js'
import { cn } from '@/renderer/lib/utils.js'

interface TextEditorProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  placeholder?: string
}

export const TextEditor: React.FC<TextEditorProps> = ({
  value,
  onChange,
  maxLength = 5000,
  placeholder
}) => {
  const { t } = useTranslation()
  const handleImport = useCallback(async () => {
    try {
      // 从剪贴板导入
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText && clipboardText.length <= maxLength) {
        onChange(clipboardText)
      } else if (clipboardText) {
        toast.warning(t('editor.tooLong'))
      }
    } catch (error) {
      console.error('从剪贴板导入失败:', error)
    }
  }, [onChange, maxLength, t])

  const wordCount = value.length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          {t('editor.title')}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs tabular-nums text-muted-foreground',
              wordCount > maxLength * 0.9 && 'text-destructive'
            )}
          >
            {wordCount} / {maxLength}
          </span>
          <Button variant="outline" size="sm" onClick={handleImport} title={t('editor.pasteTitle')}>
            <ClipboardPaste /> {t('editor.paste')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange('')} disabled={!value}>
            <Eraser /> {t('editor.clear')}
          </Button>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => e.target.value.length <= maxLength && onChange(e.target.value)}
        placeholder={placeholder ?? t('editor.placeholder')}
        maxLength={maxLength}
        className="min-h-72 resize-y p-3.5 text-[15px] leading-7"
      />
    </div>
  )
}
