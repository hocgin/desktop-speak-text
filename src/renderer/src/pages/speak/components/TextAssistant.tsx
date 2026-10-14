import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/renderer/components/ui/dialog.js'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/renderer/components/ui/alert-dialog.js'
import { useTranslation } from 'react-i18next'
import type { AIState, TextRequest } from '@/lib/ai/type.js'
interface Props {
  text: string
  onChange(text: string): void
  state?: AIState
}
export function TextAssistant({ text, onChange, state }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<TextRequest['action']>('polish')
  const [providerId, setProviderId] = useState<string>()
  const [instruction, setInstruction] = useState('')
  const [targetLanguage, setTargetLanguage] = useState(() => (i18n.language.startsWith('zh') ? '中文' : 'English'))
  const [preview, setPreview] = useState('')
  const [error, setError] = useState<string>()
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const original = useRef(''),
    taskId = useRef<string | undefined>(undefined),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const remove = window.electron.ai.onTask((task) => {
      if (task.id !== taskId.current) return
      if (task.text !== undefined) setPreview(task.text)
      if (task.status === 'failed') setError(task.error)
    })
    return () => {
      mounted.current = false
      remove()
      if (taskId.current) void window.electron.ai.cancelTask(taskId.current)
    }
  }, [])
  async function process() {
    const id = crypto.randomUUID()
    taskId.current = id
    original.current = text
    setRunning(true)
    setCompleted(false)
    setError(undefined)
    setPreview('')
    try {
      await window.electron.ai.processText({
        taskId: id,
        providerId: providerId || state?.defaultProvider,
        text,
        action,
        instruction,
        targetLanguage
      })
      if (mounted.current && taskId.current === id) setCompleted(true)
    } catch (error) {
      if (mounted.current) setError(String(error))
    } finally {
      if (mounted.current) setRunning(false)
    }
  }
  function replace() {
    onChange(preview)
    setOpen(false)
    setConfirmOpen(false)
  }
  function apply() {
    if (preview.length > 5000) {
      toast.warning(t('ai.resultTooLong'))
      return
    }
    // 原文在生成期间被修改时，需要二次确认
    if (text !== original.current) setConfirmOpen(true)
    else replace()
  }
  const canProcess = !!text.trim() && !!(providerId || state?.defaultProvider)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles /> {t('ai.assistant')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (o) return
          if (running && taskId.current) void window.electron.ai.cancelTask(taskId.current)
          setOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{t('ai.assistant')}</DialogTitle>
            <DialogDescription>{t('ai.remoteTextHelp')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!state?.providers.length && <Alert variant="info">{t('ai.configureProvider')}</Alert>}

            <div className="space-y-1.5">
              <Label>{t('ai.provider')}</Label>
              <Select
                value={providerId || state?.defaultProvider}
                disabled={running}
                onValueChange={setProviderId}
              >
                <SelectTrigger aria-label={t('ai.provider')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state?.providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select
              value={action}
              disabled={running}
              onValueChange={(v) => setAction(v as TextRequest['action'])}
            >
              <SelectTrigger aria-label={t('ai.actionLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['polish', 'translate', 'summarize', 'custom'] as const).map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`ai.action.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {action === 'translate' && (
              <Input
                aria-label={t('ai.targetLanguage')}
                disabled={running}
                value={targetLanguage}
                maxLength={100}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder={t('ai.targetLanguage')}
              />
            )}
            {action === 'custom' && (
              <Textarea
                aria-label={t('ai.instruction')}
                disabled={running}
                value={instruction}
                maxLength={2000}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t('ai.instruction')}
              />
            )}

            <div className="flex gap-2">
              <Button variant="outline" loading={running} disabled={!canProcess} onClick={process}>
                {error ? t('ai.retry') : t('ai.process')}
              </Button>
              {running && (
                <Button
                  variant="ghost"
                  onClick={() => taskId.current && window.electron.ai.cancelTask(taskId.current)}
                >
                  {t('ai.cancel')}
                </Button>
              )}
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}
            <div
              aria-live="polite"
              role="status"
              className="min-h-24 max-h-80 overflow-y-auto rounded-lg border bg-muted/40 p-4 text-sm leading-6 break-words whitespace-pre-wrap"
            >
              {preview || <span className="text-muted-foreground">{t('ai.previewPlaceholder')}</span>}
            </div>
            {preview.length > 5000 && <Alert variant="destructive">{t('ai.resultTooLong')}</Alert>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              {t('ai.close')}
            </Button>
            <Button
              disabled={!completed || !preview.trim() || preview.length > 5000 || running}
              onClick={apply}
            >
              {t('ai.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ai.textChanged')}</AlertDialogTitle>
            <AlertDialogDescription>{t('ai.confirmOverwrite')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ai.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={replace}>{t('ai.apply')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
