import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import { openSync, closeSync } from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import type { ModelDefinition, RuntimeInstallation } from './type.js'
const execFileAsync = promisify(execFile)
export class LocalEngine {
  status: 'stopped' | 'starting' | 'ready' = 'stopped'
  private child?: ChildProcess
  private modelId?: string
  private endpoint?: string
  private idle?: NodeJS.Timeout
  private stopping?: Promise<void>
  constructor(
    private root: string,
    private changed: () => void
  ) {}
  async reapOrphan() {
    const file = path.join(this.root, 'engine-pid.json')
    try {
      const { pid, config } = JSON.parse(await fs.readFile(file, 'utf8'))
      if (!Number.isInteger(pid) || pid < 2 || config !== path.join(this.root, 'server.json'))
        return
      const { stdout } =
        process.platform === 'win32'
          ? await execFileAsync(
              'powershell.exe',
              [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`
              ],
              { timeout: 5000, windowsHide: true }
            )
          : await execFileAsync('/bin/ps', ['-p', String(pid), '-o', 'command='], { timeout: 5000 })
      if (stdout.includes(config) && stdout.includes('audiocpp_server')) await this.kill(pid)
    } catch {
      /* Missing or exited process. */
    } finally {
      await fs.rm(file, { force: true })
    }
  }
  private async kill(pid: number) {
    if (process.platform === 'win32')
      await execFileAsync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true
      }).catch(() => {})
    else {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* already exited */
        }
      }
    }
  }
  async stop() {
    if (this.stopping) return this.stopping
    this.stopping = this.stopProcess().finally(() => {
      this.stopping = undefined
    })
    return this.stopping
  }
  private async stopProcess() {
    clearTimeout(this.idle)
    const child = this.child
    this.child = undefined
    this.modelId = undefined
    this.endpoint = undefined
    this.status = 'stopped'
    this.changed()
    if (child?.pid && child.exitCode === null) {
      const closed = new Promise<void>((resolve) => child.once('close', () => resolve()))
      await this.kill(child.pid)
      await Promise.race([closed, delay(5000, undefined, { ref: false })])
    }
    await fs.rm(path.join(this.root, 'engine-pid.json'), { force: true })
  }
  async generate(
    runtime: RuntimeInstallation,
    model: ModelDefinition,
    modelPath: string,
    payload: unknown,
    signal: AbortSignal
  ) {
    clearTimeout(this.idle)
    const abort = () => {
      void this.stop()
    }
    signal.addEventListener('abort', abort, { once: true })
    try {
      signal.throwIfAborted()
      if (!this.child || this.modelId !== model.id)
        await this.start(runtime, model, modelPath, signal)
      const response = await fetch(`${this.endpoint}/v1/tasks/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)])
      })
      if (!response.ok) throw new Error(`Local inference HTTP ${response.status}; see engine.log`)
      const chunks: Uint8Array[] = []
      let bytes = 0
      if (!response.body) throw new Error('Engine returned no body')
      const reader = response.body.getReader()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.length
          if (bytes > 256 * 1024 ** 2) throw new Error('Engine response too large')
          chunks.push(value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (typeof result.audio !== 'string' || !result.audio)
        throw new Error('Engine returned empty audio')
      signal.throwIfAborted()
      this.idle = setTimeout(() => {
        void this.stop()
      }, 5 * 60_000)
      return Buffer.from(result.audio, 'base64')
    } catch (error) {
      await this.stop()
      throw error
    } finally {
      signal.removeEventListener('abort', abort)
    }
  }
  private async start(
    runtime: RuntimeInstallation,
    model: ModelDefinition,
    modelPath: string,
    signal: AbortSignal
  ) {
    await this.stop()
    signal.throwIfAborted()
    this.status = 'starting'
    this.changed()
    const server = net.createServer()
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
    })
    await new Promise<void>((resolve) => server.close(() => resolve()))
    const config = path.join(this.root, 'server.json')
    await fs.writeFile(
      config,
      JSON.stringify({
        host: '127.0.0.1',
        port,
        backend: process.platform === 'darwin' ? 'metal' : 'cpu',
        device: 0,
        threads: Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2))),
        lazy_load: true,
        max_loaded_models: 1,
        idle_unload_ms: 300000,
        log_request_body: false,
        max_request_body_bytes: 1048576,
        models: [
          {
            id: 'index',
            family: model.family,
            path: modelPath,
            task: model.task || 'tts',
            mode: 'offline'
          }
        ]
      }),
      { mode: 0o600 }
    )
    const env = { ...process.env }
    if (model.family === 'kokoro_tts') {
      env.AUDIOCPP_ESPEAK_LIBRARY = path.join(
        runtime.tools,
        'kokoro',
        process.platform === 'darwin' ? 'libespeak-ng.dylib' : 'espeak-ng.dll'
      )
      env.AUDIOCPP_MECAB_LIBRARY = path.join(
        runtime.tools,
        'kokoro',
        process.platform === 'darwin' ? 'libmecab.2.dylib' : 'libmecab.dll'
      )
      env.AUDIOCPP_ESPEAK_DATA = path.join(runtime.tools, 'kokoro', 'espeak-ng-data')
    }
    const log = openSync(path.join(this.root, 'engine.log'), 'a', 0o600)
    let child: ChildProcess
    try {
      child = spawn(runtime.executable, ['--config', config, '--no-ui'], {
        cwd: path.dirname(runtime.executable),
        env,
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', log, log]
      })
    } finally {
      closeSync(log)
    }
    this.child = child
    let failure: Error | undefined
    child.once('error', (error) => {
      failure = error
    })
    child.once('close', () => {
      if (this.child === child) {
        this.child = undefined
        this.status = 'stopped'
        this.changed()
      }
    })
    if (child.pid)
      await fs.writeFile(
        path.join(this.root, 'engine-pid.json'),
        JSON.stringify({ pid: child.pid, config }),
        { mode: 0o600 }
      )
    this.endpoint = `http://127.0.0.1:${port}`
    const deadline = Date.now() + (model.family === 'kokoro_tts' ? 300_000 : 60_000)
    while (Date.now() < deadline) {
      signal.throwIfAborted()
      if (failure || child.exitCode !== null || child.signalCode)
        throw failure || new Error('Engine exited; see engine.log')
      const response = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1500)])
      }).catch(() => undefined)
      await response?.body?.cancel()
      if (response?.ok) {
        this.modelId = model.id
        this.status = 'ready'
        this.changed()
        return
      }
      await delay(250, undefined, { signal })
    }
    throw new Error('Engine startup timed out; see engine.log')
  }
}
