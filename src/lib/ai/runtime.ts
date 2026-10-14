import fs from 'node:fs/promises'
import path from 'node:path'
import { runtimePackage } from './catalog.js'
import { downloadFile, extractArchive, hashFile, validFile, walkFiles, within } from './files.js'
import type { RuntimeInstallation } from './type.js'
export async function checkRuntime(
  runtime: RuntimeInstallation | undefined,
  root: string,
  signal?: AbortSignal
) {
  if (
    !runtime ||
    !within(root, runtime.root) ||
    !within(runtime.root, runtime.executable) ||
    !within(runtime.root, runtime.tools)
  )
    return false
  const entries = Object.entries(runtime.files)
  if (!entries.length) return false
  for (const [relative, hash] of entries) {
    const file = path.join(runtime.root, relative)
    if (!within(runtime.root, file) || !(await validFile(file, hash, undefined, signal)))
      return false
  }
  return entries.some(([p]) => path.join(runtime.root, p) === runtime.executable)
}
export async function installRuntime(
  root: string,
  signal: AbortSignal,
  progress: (done: number, total: number, stage: string) => void,
  fetcher: typeof fetch
): Promise<RuntimeInstallation> {
  const pkg = runtimePackage(process.platform, process.arch)
  if (!pkg) throw new Error('Local inference supports Apple Silicon macOS and Windows x64')
  const archives = path.join(root, 'downloads')
  await fs.mkdir(archives, { recursive: true })
  const staging = await fs.mkdtemp(path.join(root, 'runtime-'))
  try {
    const engineFile = path.join(archives, pkg.name)
    await downloadFile(
      `https://github.com/0xShug0/audio.cpp/releases/download/v0.9.1/${pkg.name}`,
      engineFile,
      pkg.hash,
      undefined,
      signal,
      (a, b, stage) => progress(a, b, stage || 'downloading'),
      fetcher
    )
    progress(0, 0, 'extracting-engine')
    await extractArchive(engineFile, path.join(staging, 'engine'), signal)
    const toolsFile = path.join(archives, pkg.toolsName)
    await downloadFile(
      `https://github.com/leemysw/yovoice/releases/download/v0.2.0/${pkg.toolsName}`,
      toolsFile,
      pkg.toolsHash,
      undefined,
      signal,
      (a, b, stage) => progress(a, b, stage || 'downloading'),
      fetcher
    )
    progress(0, 0, 'extracting-tools')
    const unpacked = path.join(staging, 'package')
    await extractArchive(toolsFile, unpacked, signal)
    const files = await walkFiles(staging)
    const executableName = process.platform === 'win32' ? 'audiocpp_server.exe' : 'audiocpp_server'
    const executables = files.filter(
      (p) => within(path.join(staging, 'engine'), p) && path.basename(p) === executableName
    )
    if (executables.length !== 1) throw new Error('Engine archive must contain exactly one server')
    const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    const converters = files.filter(
      (p) => path.basename(p) === ffmpegName && path.basename(path.dirname(p)) === 'tools'
    )
    if (converters.length !== 1) throw new Error('Missing audio converter')
    const tools = path.join(staging, 'tools')
    await fs.rename(path.dirname(converters[0]), tools)
    await fs.rm(unpacked, { recursive: true, force: true })
    const required = [
      path.join(tools, ffmpegName),
      path.join(
        tools,
        'kokoro',
        process.platform === 'win32' ? 'espeak-ng.dll' : 'libespeak-ng.dylib'
      ),
      path.join(
        tools,
        'kokoro',
        process.platform === 'win32' ? 'libmecab.dll' : 'libmecab.2.dylib'
      ),
      path.join(tools, 'kokoro', 'espeak-ng-data', 'phontab')
    ]
    for (const file of required)
      if (!(await fs.stat(file)).isFile()) throw new Error('Incomplete native resources')
    if (process.platform === 'win32') {
      for (const file of await walkFiles(path.join(staging, 'engine'))) {
        if (path.extname(file).toLowerCase() === '.dll') {
          const target = path.join(path.dirname(executables[0]), path.basename(file))
          if (target.toLowerCase() !== file.toLowerCase()) await fs.copyFile(file, target)
        }
      }
    }
    await fs.chmod(executables[0], 0o755)
    await fs.chmod(required[0], 0o755)
    progress(0, 0, 'verifying-resources')
    const hashes: Record<string, string> = {}
    for (const file of await walkFiles(staging))
      hashes[path.relative(staging, file)] = await hashFile(file, signal)
    signal.throwIfAborted()
    return { root: staging, executable: executables[0], tools, files: hashes }
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true })
    throw error
  }
}
