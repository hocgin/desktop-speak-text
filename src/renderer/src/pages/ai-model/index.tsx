import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Cpu,
  Download,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Upload
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAIState } from '@/lib/ai/renderer.js'
import { PROVIDER_PRESETS, requiredMemory } from '@/lib/ai/catalog.js'
import type { AITask, ProviderConfig, ProviderInput } from '@/lib/ai/type.js'
import { Alert } from '@/renderer/components/ui/alert.js'
import { Tooltip } from '@/renderer/components/ui/tooltip.js'
import { Badge } from '@/renderer/components/ui/badge.js'
import { Button } from '@/renderer/components/ui/button.js'
import { Card } from '@/renderer/components/ui/card.js'
import { Checkbox } from '@/renderer/components/ui/checkbox.js'
import { Input } from '@/renderer/components/ui/input.js'
import { Label } from '@/renderer/components/ui/label.js'
import { Progress } from '@/renderer/components/ui/progress.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs.js'
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

/** 带二次确认的删除按钮（替代 antd Popconfirm） */
function ConfirmButton({
  title,
  description,
  onConfirm,
  disabled,
  children
}: {
  title: string
  description?: string
  onConfirm: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ai.cancel')}</AlertDialogCancel>
            <AlertDialogAction destructive onClick={onConfirm}>
              {t('ai.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Field({
  label,
  help,
  children
}: {
  label?: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

export default function AiModelPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { state, error, refresh } = useAIState()
  const [editing, setEditing] = useState<ProviderInput>()
  const [savedProvider, setSavedProvider] = useState<ProviderConfig>()
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState<string>()
  const [models, setModels] = useState<string[]>([])
  const [invalid, setInvalid] = useState(false)

  async function action(work: () => Promise<unknown>) {
    try {
      await work()
      await refresh()
    } catch (error) {
      toast.error(String(error))
    }
  }
  function edit(provider?: ProviderConfig) {
    const value: ProviderInput = provider
      ? {
          id: provider.id,
          name: provider.name,
          model: provider.model,
          baseURL: provider.baseURL,
          preset: provider.preset
        }
      : {
          id: crypto.randomUUID(),
          name: '',
          preset: 'deepseek',
          baseURL: PROVIDER_PRESETS[1].baseURL,
          model: ''
        }
    setEditing(value)
    setSavedProvider(provider)
    setModels([])
    setInvalid(false)
  }
  const patchEditing = (p: Partial<ProviderInput>) => setEditing((v) => (v ? { ...v, ...p } : v))

  async function saveProvider() {
    if (!editing) return
    if (!editing.name?.trim() || !editing.baseURL?.trim() || !editing.model?.trim()) {
      setInvalid(true)
      return
    }
    setSaving(true)
    try {
      await window.electron.ai.saveProvider(editing)
      setEditing(undefined)
      await refresh()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  const taskProgress = (task?: AITask) =>
    task && (
      <div className="mt-3 flex flex-col gap-2" role="status" aria-live="polite">
        <span
          className={task.status === 'failed' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
        >
          {task.error || t(`ai.status.${task.status}`)}
          {task.stage ? ` · ${t(`ai.stage.${task.stage}`, { defaultValue: task.stage })}` : ''}
        </span>
        {task.status === 'running' && (
          <div className="flex items-center gap-3">
            <Progress
              className="min-w-40 flex-1"
              value={
                task.total ? Math.min(100, Math.floor(((task.completed || 0) / task.total) * 100)) : 0
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => action(() => window.electron.ai.cancelTask(task.id))}
            >
              {t('ai.cancel')}
            </Button>
          </div>
        )}
      </div>
    )

  if (error)
    return (
      <div className="p-6">
        <Alert variant="destructive" className="flex items-center justify-between gap-4">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refresh}>
            {t('ai.retry')}
          </Button>
        </Alert>
      </div>
    )
  if (!state)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )

  const active =
    state.localBusy || state.tasks.some((t) => t.status === 'running' && t.kind !== 'text')
  const installTask = state.tasks.filter((t) => t.kind === 'install').at(-1)
  const importTask = state.tasks.filter((t) => t.kind === 'import').at(-1)

  return (
    <div className="h-full overflow-y-auto px-6 pt-5 pb-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium tracking-[0.14em] text-primary">SPEAKTEXT / AI</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('ai.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('ai.subtitle')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={refresh} aria-label={t('ai.refresh')}>
          <RefreshCw />
        </Button>
      </header>

      <Tabs defaultValue="local">
        <TabsList>
          <TabsTrigger value="local">
            <Cpu /> {t('ai.localModels')}
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Server /> {t('ai.languageModels')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="local" className="space-y-4">
          {!state.supported && <Alert variant="info">{t('ai.unsupported')}</Alert>}

          <Card className="bg-gradient-to-br from-card to-accent/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{t('ai.engine')}</span>
                <Badge variant={state.runtimeReady ? 'success' : 'secondary'}>
                  {state.runtimeReady ? t('ai.ready') : t('ai.notInstalled')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {state.runtimeVersion} · {state.backend} · {t(`ai.engineState.${state.engineStatus}`)}
                </span>
              </div>
              <Button
                disabled={!state.supported || active}
                onClick={() => action(() => window.electron.ai.installRuntime(crypto.randomUUID()))}
              >
                <Download />
                {state.runtimeReady ? t('ai.repair') : t('ai.installEngine')}
              </Button>
            </div>
            {taskProgress(installTask)}
          </Card>

          <Card className="gap-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">{t('ai.source')}</span>
              <Select
                value={state.source}
                onValueChange={(v) => action(() => window.electron.ai.setSource(v as typeof state.source))}
              >
                <SelectTrigger aria-label={t('ai.source')} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modelscope">ModelScope</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => action(() => window.electron.ai.openModelDirectory())}>
                <FolderOpen /> {t('ai.modelDirectory')}
              </Button>
              <Button
                variant="outline"
                disabled={!state.supported || active}
                onClick={() => action(() => window.electron.ai.importModel(crypto.randomUUID()))}
              >
                <Upload /> {t('ai.import')}
              </Button>
            </div>
            <span className="text-xs break-all text-muted-foreground">{state.modelDirectory}</span>
            {taskProgress(importTask)}
          </Card>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
            {state.models.map((model) => {
              const task = state.tasks
                .filter((t) => t.target === model.id && t.kind === 'download')
                .at(-1)
              return (
                <Card
                  key={model.id}
                  className="gap-0 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{model.precision}</Badge>
                    {model.id.startsWith('kokoro') && <Badge variant="info">{t('ai.recommended')}</Badge>}
                    {state.defaultModel === model.id && <Badge variant="success">{t('ai.default')}</Badge>}
                    {(() => {
                      const need = requiredMemory(model)
                      const gb = (n: number) => (n / 1000 ** 3).toFixed(1)
                      const ok = state.supported && state.totalMemory >= need
                      const tip = !state.supported
                        ? t('ai.compat.unsupported')
                        : t(ok ? 'ai.compat.okTip' : 'ai.compat.lowTip', {
                            need: gb(need),
                            have: gb(state.totalMemory)
                          })
                      return (
                        <Tooltip title={tip}>
                          <Badge variant={ok ? 'success' : 'destructive'}>
                            {t(ok ? 'ai.compat.ok' : 'ai.compat.no')}
                          </Badge>
                        </Tooltip>
                      )
                    })()}
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{model.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`ai.mode.${model.mode}`)}</p>
                  <div className="my-4 flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-xs">
                    <span className="font-medium">{(model.size / 1000 ** 3).toFixed(2)} GB</span>
                    <Tooltip
                      title={model.languages.map((l) => t(`ai.langName.${l}`, l)).join('、')}
                    >
                      <span className="cursor-help text-muted-foreground underline decoration-dotted">
                        {model.languages.length} {t('ai.langCount')}
                      </span>
                    </Tooltip>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!model.installed ? (
                      <Button
                        size="sm"
                        disabled={!state.supported || active}
                        onClick={() =>
                          action(() => window.electron.ai.downloadModel(model.id, crypto.randomUUID()))
                        }
                      >
                        <Download />
                        {task?.status === 'cancelled' || task?.status === 'failed'
                          ? t('ai.resume')
                          : t('ai.download')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={active || state.defaultModel === model.id}
                          onClick={() => action(() => window.electron.ai.setDefaultModel(model.id))}
                        >
                          {t('ai.setDefault')}
                        </Button>
                        <ConfirmButton
                          title={t('ai.removeModel')}
                          description={
                            model.installed.managed ? t('ai.removeManaged') : t('ai.removeImported')
                          }
                          disabled={active}
                          onConfirm={() => action(() => window.electron.ai.removeModel(model.id))}
                        >
                          <Trash2 /> {t('ai.remove')}
                        </ConfirmButton>
                      </>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() =>
                        window.electron.ipcRenderer.send('openExternal', model.licenseURL)
                      }
                    >
                      {t('ai.license')}
                    </Button>
                  </div>
                  {model.installed && (
                    <p className="mt-3 text-xs break-all text-muted-foreground">
                      {model.installed.managed ? t('ai.managed') : t('ai.imported')} ·{' '}
                      {model.installed.path}
                    </p>
                  )}
                  {taskProgress(task)}
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('ai.providerHelp')}</p>
            <Button onClick={() => edit()}>
              <Plus /> {t('ai.addProvider')}
            </Button>
          </div>
          {!state.providers.length && <Alert variant="info">{t('ai.noProviders')}</Alert>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
            {state.providers.map((p) => (
              <Card
                key={p.id}
                className="gap-0 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  {state.defaultProvider === p.id && <Badge variant="success">{t('ai.default')}</Badge>}
                </div>
                <p className="mt-2 text-xs break-all text-muted-foreground">{p.baseURL}</p>
                <code className="mt-2 w-fit rounded bg-muted px-1.5 py-0.5 text-xs">{p.model}</code>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.hasKey
                    ? t(p.sessionOnly ? 'ai.sessionKey' : 'ai.encryptedKey')
                    : t('ai.noKey')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => edit(p)}>
                    {t('ai.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={checking === p.id}
                    onClick={async () => {
                      setChecking(p.id)
                      try {
                        await window.electron.ai.testProvider(p.id)
                        toast.success(t('ai.connectionOK'))
                      } catch (error) {
                        toast.error(String(error))
                      } finally {
                        setChecking(undefined)
                      }
                    }}
                  >
                    {t('ai.test')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={state.defaultProvider === p.id}
                    onClick={() => action(() => window.electron.ai.setDefaultProvider(p.id))}
                  >
                    {t('ai.setDefault')}
                  </Button>
                  <ConfirmButton
                    title={t('ai.removeProvider')}
                    onConfirm={() => action(() => window.electron.ai.removeProvider(p.id))}
                  >
                    {t('ai.remove')}
                  </ConfirmButton>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !saving && setEditing(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(editing && savedProvider ? 'ai.editProvider' : 'ai.addProvider')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('ai.providerHelp')}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <Field label={t('ai.preset')}>
                <Select
                  value={editing.preset}
                  onValueChange={(id) => {
                    const p = PROVIDER_PRESETS.find((p) => p.id === id)!
                    patchEditing({ preset: id as ProviderInput['preset'], baseURL: p.baseURL, name: p.name, model: '' })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('ai.name')}>
                <Input
                  maxLength={100}
                  aria-invalid={invalid && !editing.name?.trim()}
                  value={editing.name ?? ''}
                  onChange={(e) => patchEditing({ name: e.target.value })}
                />
              </Field>
              <Field label={t('ai.baseURL')}>
                <Input
                  placeholder="https://api.example.com/v1"
                  aria-invalid={invalid && !editing.baseURL?.trim()}
                  value={editing.baseURL ?? ''}
                  onChange={(e) => patchEditing({ baseURL: e.target.value })}
                />
              </Field>
              <Field
                label={t('ai.apiKey')}
                help={savedProvider?.hasKey ? t('ai.keepKey') : t('ai.keyHelp')}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  maxLength={4096}
                  value={editing.apiKey ?? ''}
                  onChange={(e) => patchEditing({ apiKey: e.target.value })}
                />
              </Field>
              {savedProvider?.hasKey && (
                <Label className="cursor-pointer font-normal">
                  <Checkbox
                    checked={!!editing.clearKey}
                    onCheckedChange={(c) => patchEditing({ clearKey: c === true })}
                  />
                  {t('ai.clearKey')}
                </Label>
              )}
              <Field label={t('ai.modelID')} help={t('ai.fetchHelp')}>
                <Input
                  list="provider-models"
                  placeholder={t('ai.manualModel')}
                  aria-invalid={invalid && !editing.model?.trim()}
                  value={editing.model ?? ''}
                  onChange={(e) => patchEditing({ model: e.target.value })}
                />
                <datalist id="provider-models">
                  {models.map((id) => (
                    <option key={id} value={id} />
                  ))}
                </datalist>
              </Field>
              <Button
                variant="outline"
                size="sm"
                disabled={!savedProvider || saving}
                onClick={() =>
                  action(async () => {
                    const list = await window.electron.ai.listProviderModels(savedProvider!.id)
                    setModels(list)
                    if (!list.length) toast.info(t('ai.manualModel'))
                  })
                }
              >
                {t('ai.fetchModels')}
              </Button>
              {invalid && <p className="text-sm text-destructive">{t('providerForm.invalid')}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setEditing(undefined)}>
              {t('ai.cancel')}
            </Button>
            <Button loading={saving} onClick={saveProvider}>
              {t('ai.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
