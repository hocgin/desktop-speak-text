import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  safeStorage,
  net,
  type IpcMainInvokeEvent
} from 'electron'
import Store from 'electron-store'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  AIState,
  InstalledModel,
  ProviderInput,
  ProviderConfig,
  RuntimeInstallation,
  TextRequest,
  LocalTTSInput,
  DownloadSource
} from './type.js'
import { CATALOG, modelById, modelURL, runtimePackage, RUNTIME_VERSION } from './catalog.js'
import { downloadFile, validFile, within } from './files.js'
import { TaskManager } from './tasks.js'
import { LocalEngine } from './engine.js'
import { SecretVault } from './secrets.js'
import { installRuntime, checkRuntime } from './runtime.js'
import { endpoint, headers, streamCompletion, promptFor, validateBaseURL } from './llm.js'
import { buildLocalRequest, wavDuration } from './audio.js'
const execFileAsync = promisify(execFile)
interface Config {
  models: InstalledModel[]
  providers: Omit<ProviderConfig, 'hasKey' | 'sessionOnly'>[]
  defaultModel?: string
  defaultProvider?: string
  source: DownloadSource
  runtime?: RuntimeInstallation
}
let config: Store<Config>,
  root: string,
  modelDirectory: string,
  engine: LocalEngine,
  vault: SecretVault,
  tasks: TaskManager
let readiness: Promise<void>,
  runtimeReady = false,
  installationBusy = false,
  generating = false,
  providerBusy = false
const references = new Map<string, { path: string; owner: number }>()
const fetcher: typeof fetch = (url, options) => net.fetch(url as string, options)
function changed() {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('ai:state-changed')
}
function knownId(id: string) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid ID')
  return id
}
function provider(id: string) {
  knownId(id)
  const p = config.get('providers').find((p) => p.id === id)
  if (!p) throw new Error('Provider not found')
  return p
}
function availableRuntime(): RuntimeInstallation {
  const runtime = config.get('runtime')
  if (!runtimeReady || !runtime)
    throw new Error('Install or repair the local inference engine first')
  return runtime
}
async function state(owner: number): Promise<AIState> {
  const installed = config.get('models')
  const models = await Promise.all(
    CATALOG.map(async (m) => {
      const i = installed.find((i) => i.id === m.id)
      const exists =
        i &&
        (await fs
          .stat(i.path)
          .then((s) => s.isFile() && s.size === m.size)
          .catch(() => false))
      return { ...m, installed: exists ? i : undefined }
    })
  )
  return {
    models,
    providers: config.get('providers').map((p) => ({ ...p, ...vault.info(p.id) })),
    defaultModel: config.get('defaultModel'),
    defaultProvider: config.get('defaultProvider'),
    source: config.get('source'),
    modelDirectory,
    supported: !!runtimePackage(process.platform, process.arch),
    backend: runtimePackage(process.platform, process.arch)?.backend || 'unsupported',
    totalMemory: os.totalmem(),
    localBusy: installationBusy || generating,
    runtimeReady,
    runtimeVersion: RUNTIME_VERSION,
    engineStatus: engine.status,
    tasks: tasks.list(owner)
  }
}
async function exclusiveInstall<T>(work: () => Promise<T>) {
  if (installationBusy || generating)
    throw new Error('A model operation or generation is already running')
  installationBusy = true
  changed()
  try {
    return await work()
  } finally {
    installationBusy = false
    changed()
  }
}
async function exclusiveProvider(work: () => Promise<void>) {
  if (providerBusy) throw new Error('Another provider change is in progress')
  providerBusy = true
  try {
    await work()
  } finally {
    providerBusy = false
    changed()
  }
}
/** 已安装的本地模型（供本地 API 服务列出与选择） */
export async function listInstalledModels() {
  await readiness
  const models = (await state(0)).models
    .filter((m) => m.installed)
    .map((m) => ({
      id: m.id,
      name: m.name,
      family: m.family,
      mode: m.mode,
      voices: m.voices ?? [],
      languages: m.languages
    }))
  return { models, defaultModel: config.get('defaultModel') as string | undefined }
}

export function initAIMain() {
  root = path.join(app.getPath('userData'), 'ai')
  modelDirectory = path.join(root, 'models')
  config = new Store<Config>({
    name: 'ai-config',
    defaults: { models: [], providers: [], source: 'modelscope' }
  })
  engine = new LocalEngine(root, changed)
  tasks = new TaskManager((task, owner) => {
    const web = BrowserWindow.getAllWindows().find((w) => w.webContents.id === owner)?.webContents
    web?.send('ai:task', task)
  })
  vault = new SecretVault(path.join(root, 'keys.json'), {
    available: () =>
      safeStorage.isEncryptionAvailable() &&
      (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (bytes) => safeStorage.decryptString(bytes)
  })
  readiness = (async () => {
    await fs.mkdir(modelDirectory, { recursive: true })
    await fs.mkdir(path.join(root, 'references'), { recursive: true })
    // References are temporary; never retain manuscripts or source audio across sessions.
    for (const f of await fs.readdir(path.join(root, 'references')))
      await fs.rm(path.join(root, 'references', f), { force: true })
    await vault.load()
    await engine.reapOrphan()
    runtimeReady = await checkRuntime(config.get('runtime'), root)
    changed()
  })()
  void readiness.catch((error) => console.error('[AI] Initialization failed:', error))
  function handle(name: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => any) {
    ipcMain.handle(`ai:${name}`, async (event, ...args) => {
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !BrowserWindow.fromWebContents(event.sender)
      )
        throw new Error('Untrusted AI IPC sender')
      await readiness
      if (event.sender.isDestroyed()) throw new Error('Requesting window was closed')
      return fn(event, ...args)
    })
  }
  app.on('web-contents-created', (_, web) =>
    web.once('destroyed', () => {
      tasks.cancelOwner(web.id)
      for (const [id, r] of references)
        if (r.owner === web.id) {
          references.delete(id)
          void fs.rm(r.path, { force: true })
        }
    })
  )
  handle('state', (e) => state(e.sender.id))
  handle('install', (e, id: string) =>
    exclusiveInstall(() =>
      tasks.run({ id, kind: 'install' }, e.sender.id, async (signal) => {
        await engine.stop()
        const previous = config.get('runtime')
        const runtime = await installRuntime(
          root,
          signal,
          (completed, total, stage) => tasks.update(id, { completed, total, stage }),
          fetcher
        )
        config.set('runtime', runtime)
        runtimeReady = true
        if (previous && within(root, previous.root) && previous.root !== runtime.root)
          await fs.rm(previous.root, { recursive: true, force: true })
      })
    )
  )
  handle('download', (e, modelId: string, id: string) =>
    exclusiveInstall(() =>
      tasks.run({ id, kind: 'download', target: modelId }, e.sender.id, async (signal) => {
        const m = modelById(modelId),
          file = path.join(modelDirectory, `${m.id}.gguf`)
        await engine.stop()
        const disk = await fs.statfs(modelDirectory)
        const partial = await fs
          .stat(`${file}.part`)
          .then((s) => s.size)
          .catch(() => 0)
        if (disk.bavail * disk.bsize < Math.max(0, m.size - partial) + 100 * 1024 ** 2)
          throw new Error('Not enough disk space')
        await downloadFile(
          modelURL(m, config.get('source')),
          file,
          m.sha256,
          m.size,
          signal,
          (completed, total, stage) => tasks.update(id, { completed, total, stage }),
          fetcher
        )
        config.set('models', [
          ...config.get('models').filter((m) => m.id !== modelId),
          { id: modelId, path: file, managed: true }
        ])
      })
    )
  )
  handle('import', (e, id: string) =>
    exclusiveInstall(() =>
      tasks.run({ id, kind: 'import' }, e.sender.id, async (signal) => {
        const w = BrowserWindow.fromWebContents(e.sender)!
        const selection = await dialog.showOpenDialog(w, {
          properties: ['openFile'],
          filters: [{ name: 'GGUF', extensions: ['gguf'] }]
        })
        signal.throwIfAborted()
        if (selection.canceled) return
        const file = await fs.realpath(selection.filePaths[0]),
          size = (await fs.stat(file)).size
        const candidates = CATALOG.filter((m) => m.size === size)
        tasks.update(id, { stage: 'verifying' })
        for (const m of candidates)
          if (await validFile(file, m.sha256, m.size, signal)) {
            signal.throwIfAborted()
            config.set('models', [
              ...config.get('models').filter((i) => i.id !== m.id),
              { id: m.id, path: file, managed: false }
            ])
            return
          }
        throw new Error('File does not match a supported Q8 model')
      })
    )
  )
  handle('remove-model', (_, id: string) =>
    exclusiveInstall(async () => {
      modelById(id)
      const model = config.get('models').find((m) => m.id === id)
      await engine.stop()
      if (model?.managed) {
        const expected = path.join(modelDirectory, `${id}.gguf`)
        if (model.path !== expected || !within(modelDirectory, model.path))
          throw new Error('Unsafe managed model path')
        const realDirectory = await fs.realpath(modelDirectory)
        const actual = await fs.realpath(model.path).catch(() => model.path)
        if (!within(realDirectory, actual)) throw new Error('Unsafe managed model path')
        await fs.rm(model.path, { force: true })
        await fs.rm(`${model.path}.part`, { force: true })
      }
      config.set(
        'models',
        config.get('models').filter((m) => m.id !== id)
      )
      if (config.get('defaultModel') === id) config.delete('defaultModel')
    })
  )
  handle('default-model', (_, id: string) => {
    modelById(id)
    if (!config.get('models').some((m) => m.id === id)) throw new Error('Model is not installed')
    config.set('defaultModel', id)
    changed()
  })
  handle('source', (_, source: DownloadSource) => {
    if (!['modelscope', 'huggingface'].includes(source)) throw new Error('Unsupported source')
    config.set('source', source)
    changed()
  })
  handle('open-directory', () => shell.openPath(modelDirectory))
  handle('save-provider', (_, input: ProviderInput) =>
    exclusiveProvider(async () => {
      knownId(input.id)
      if (
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.length > 100 ||
        typeof input.model !== 'string' ||
        input.model.length > 200 ||
        !input.model.trim()
      )
        throw new Error('Provider name and model are required')
      const baseURL = validateBaseURL(input.baseURL)
      if (
        input.apiKey !== undefined &&
        (typeof input.apiKey !== 'string' ||
          input.apiKey.length > 4096 ||
          /[\r\n]/.test(input.apiKey))
      )
        throw new Error('Invalid API key')
      if (input.clearKey || input.apiKey)
        await vault.set(input.id, input.clearKey ? undefined : input.apiKey)
      const saved = {
        id: input.id,
        name: input.name.trim(),
        preset: typeof input.preset === 'string' ? input.preset.slice(0, 50) : 'custom',
        baseURL,
        model: input.model.trim()
      }
      config.set('providers', [...config.get('providers').filter((p) => p.id !== input.id), saved])
      if (!config.get('defaultProvider')) config.set('defaultProvider', input.id)
    })
  )
  handle('remove-provider', (_, id: string) =>
    exclusiveProvider(async () => {
      provider(id)
      await vault.set(id)
      config.set(
        'providers',
        config.get('providers').filter((p) => p.id !== id)
      )
      if (config.get('defaultProvider') === id) config.delete('defaultProvider')
    })
  )
  handle('default-provider', (_, id: string) => {
    provider(id)
    config.set('defaultProvider', id)
    changed()
  })
  handle('provider-models', async (_, id: string) => {
    const p = provider(id)
    const response = await fetcher(endpoint(p.baseURL, 'models'), {
      headers: headers(vault.get(id)),
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok)
      throw new Error(
        `Model list HTTP ${response.status}; enter a model ID manually if unsupported`
      )
    const body = await response.text()
    if (body.length > 2_000_000) throw new Error('Model list too large')
    const result = JSON.parse(body)
    if (!Array.isArray(result.data)) throw new Error('Invalid model list')
    return result.data
      .map((m: any) => m.id)
      .filter((id: unknown) => typeof id === 'string')
      .slice(0, 1000)
  })
  handle('test-provider', async (_, id: string) => {
    const p = provider(id)
    const response = await fetcher(endpoint(p.baseURL, 'chat/completions'), {
      method: 'POST',
      headers: headers(vault.get(id)),
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 8,
        stream: false
      })
    })
    if (!response.ok) throw new Error(`Connection test HTTP ${response.status}`)
    const result = await response.json()
    if (!result.choices?.length) throw new Error('Invalid completion response')
  })
  handle('text', (e, request: TextRequest) =>
    tasks.run({ id: request.taskId, kind: 'text' }, e.sender.id, async (signal) => {
      if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 5000)
        throw new Error('Text must contain 1–5000 characters')
      const p = provider(request.providerId || config.get('defaultProvider') || '')
      const response = await fetcher(endpoint(p.baseURL, 'chat/completions'), {
        method: 'POST',
        headers: headers(vault.get(p.id)),
        signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
        body: JSON.stringify({
          model: p.model,
          stream: true,
          messages: [
            { role: 'system', content: promptFor(request) },
            { role: 'user', content: request.text }
          ]
        })
      })
      let last = 0
      const text = await streamCompletion(response, signal, (text) => {
        if (Date.now() - last > 80) {
          tasks.update(request.taskId, { text })
          last = Date.now()
        }
      })
      tasks.update(request.taskId, { text })
    })
  )
  handle('cancel', (e, id: string) => tasks.cancel(knownId(id), e.sender.id))
  handle('reference', (e) =>
    exclusiveInstall(async () => {
      const runtime = availableRuntime()
      const selected = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender)!, {
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3'] }]
      })
      if (selected.canceled) return null
      const file = selected.filePaths[0]
      if (
        !['.wav', '.mp3'].includes(path.extname(file).toLowerCase()) ||
        (await fs.stat(file)).size > 20 * 1024 ** 2
      )
        throw new Error('Select WAV or MP3 up to 20 MB')
      const id = randomUUID(),
        output = path.join(root, 'references', `${id}.wav`)
      try {
        await execFileAsync(
          path.join(runtime.tools, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
          [
            '-nostdin',
            '-v',
            'error',
            '-xerror',
            '-protocol_whitelist',
            'file',
            '-format_whitelist',
            'wav,mp3',
            '-i',
            file,
            '-map',
            '0:a:0',
            '-vn',
            '-t',
            '61',
            '-ac',
            '1',
            '-ar',
            '24000',
            '-c:a',
            'pcm_s16le',
            '-map_metadata',
            '-1',
            '-y',
            output
          ],
          { timeout: 30_000, windowsHide: true }
        )
        const duration = wavDuration(await fs.readFile(output))
        if (duration < 1 || duration > 60) throw new Error('Reference audio must be 1–60 seconds')
        for (const [key, r] of references)
          if (r.owner === e.sender.id) {
            references.delete(key)
            await fs.rm(r.path, { force: true })
          }
        references.set(id, { path: output, owner: e.sender.id })
        return { id, name: path.basename(file), duration }
      } catch (error) {
        await fs.rm(output, { force: true })
        throw error
      }
    })
  )
  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    tasks.stop()
    void engine.stop().finally(() => {
      quitting = true
      app.quit()
    })
  })
}
export async function generateLocal<T>(
  text: string,
  input: LocalTTSInput,
  taskId: string,
  owner: number,
  persist: (result: { buffer: Buffer; duration: number }, signal: AbortSignal) => Promise<T>
) {
  await readiness
  if (generating || installationBusy) throw new Error('Local engine is busy')
  generating = true
  changed()
  try {
    return await tasks.run(
      { id: taskId, kind: 'generate', target: input.modelId },
      owner,
      async (signal) => {
        const model = modelById(input.modelId),
          installed = config.get('models').find((m) => m.id === model.id)
        if (!installed) throw new Error('Model is not installed')
        tasks.update(taskId, { stage: 'verifying-model' })
        if (!(await validFile(installed.path, model.sha256, model.size, signal)))
          throw new Error('Model is missing or damaged; download or import it again')
        const reference = input.referenceId ? references.get(input.referenceId) : undefined
        if (reference && reference.owner !== owner) throw new Error('Invalid reference audio')
        const payload = buildLocalRequest(model, text, input, reference?.path)
        tasks.update(taskId, { stage: 'generating' })
        const buffer = await engine.generate(
          availableRuntime(),
          model,
          installed.path,
          payload,
          signal
        )
        signal.throwIfAborted()
        tasks.update(taskId, { stage: 'saving' })
        return persist({ buffer, duration: wavDuration(buffer) }, signal)
      }
    )
  } finally {
    generating = false
    changed()
  }
}
