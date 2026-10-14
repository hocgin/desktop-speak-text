import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import * as tar from 'tar'
import yauzl from 'yauzl'
export function within(root: string, file: string) {
  const relative = path.relative(path.resolve(root), path.resolve(file))
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  )
}
export async function hashFile(file: string, signal?: AbortSignal) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) {
    signal?.throwIfAborted()
    hash.update(chunk)
  }
  signal?.throwIfAborted()
  return hash.digest('hex')
}
export async function validFile(file: string, hash: string, size?: number, signal?: AbortSignal) {
  try {
    const stat = await fs.lstat(file)
    return stat.isFile() && (!size || stat.size === size) && (await hashFile(file, signal)) === hash
  } catch (error) {
    if (signal?.aborted) throw error
    return false
  }
}
export async function downloadFile(
  url: string,
  destination: string,
  hash: string,
  size: number | undefined,
  signal: AbortSignal,
  progress: (done: number, total: number, stage?: string) => void,
  fetcher: typeof fetch = fetch
) {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  if (await validFile(destination, hash, size, signal)) return
  const part = `${destination}.part`
  let offset = await fs
    .stat(part)
    .then((s) => s.size)
    .catch(() => 0)
  if (size && offset > size) {
    await fs.rm(part, { force: true })
    offset = 0
  }
  if (!size || offset !== size) {
    let response = await fetcher(url, {
      signal,
      headers: offset ? { Range: `bytes=${offset}-` } : {}
    })
    if (response.status === 416) {
      await response.body?.cancel()
      offset = 0
      response = await fetcher(url, { signal })
    }
    if (!response.ok || !response.body) throw new Error(`Download HTTP ${response.status}`)
    if (response.status === 206) {
      const range = response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
      if (!range || Number(range[1]) !== offset || (size && Number(range[3]) !== size)) {
        await response.body.cancel()
        await fs.rm(part, { force: true })
        throw new Error('Invalid download range; please retry')
      }
    } else offset = 0
    const total = size || offset + Number(response.headers.get('content-length') || 0)
    const handle = await fs.open(part, offset ? 'a' : 'w')
    let last = 0
    try {
      for await (const chunk of Readable.fromWeb(response.body as any, { signal })) {
        signal.throwIfAborted()
        await handle.write(chunk)
        offset += chunk.length
        if (size && offset > size) throw new Error('Download exceeds expected size')
        if (Date.now() - last > 150) {
          progress(offset, total, 'downloading')
          last = Date.now()
        }
      }
    } finally {
      await handle.close()
    }
  }
  progress(offset, size || offset, 'verifying')
  if (!(await validFile(part, hash, size, signal))) {
    await fs.rm(part, { force: true })
    throw new Error('SHA-256 or file size mismatch; please retry')
  }
  signal.throwIfAborted()
  await fs.rename(part, destination)
}
function archivePath(root: string, name: string) {
  if (
    name.includes('\\') ||
    /^[a-zA-Z]:/.test(name) ||
    name.split('/').includes('..') ||
    path.posix.isAbsolute(name)
  )
    throw new Error('Unsafe archive path')
  const output = path.join(root, name)
  if (name !== '.' && name !== './' && !within(root, output)) throw new Error('Unsafe archive path')
  return output
}
export async function extractArchive(file: string, root: string, signal: AbortSignal) {
  await fs.mkdir(root, { recursive: true })
  if (file.endsWith('.tar.gz')) {
    let invalid: unknown
    await tar.t({
      file,
      onReadEntry: (entry) => {
        try {
          signal.throwIfAborted()
          archivePath(root, entry.path)
          if (!['File', 'Directory'].includes(entry.type))
            throw new Error('Archive links are not allowed')
        } catch (error) {
          invalid = error
        }
      }
    })
    if (invalid) throw invalid
    await tar.x({
      file,
      cwd: root,
      strict: true,
      filter: (name, entry) => {
        archivePath(root, name)
        return !signal.aborted && 'type' in entry && ['File', 'Directory'].includes(entry.type)
      }
    })
  } else {
    const zip = await new Promise<yauzl.ZipFile>((resolve, reject) =>
      yauzl.open(file, { lazyEntries: true }, (error, zip) =>
        error || !zip ? reject(error) : resolve(zip)
      )
    )
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const finish = (error?: unknown) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', abort)
        zip.close()
        error ? reject(error) : resolve()
      }
      const abort = () => finish(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      zip.on('error', finish)
      zip.on('end', () => finish())
      zip.on('entry', (entry: yauzl.Entry) => {
        void (async () => {
          signal.throwIfAborted()
          const output = archivePath(root, entry.fileName)
          const mode = (entry.externalFileAttributes >>> 16) & 0o170000
          if (mode && mode !== 0o100000 && mode !== 0o040000)
            throw new Error('Archive links are not allowed')
          if (entry.fileName.endsWith('/')) await fs.mkdir(output, { recursive: true })
          else {
            if (entry.uncompressedSize > 2 * 1024 ** 3) throw new Error('Archive entry too large')
            await fs.mkdir(path.dirname(output), { recursive: true })
            const stream = await new Promise<Readable>((resolve, reject) =>
              zip.openReadStream(entry, (err, stream) =>
                err || !stream ? reject(err) : resolve(stream)
              )
            )
            await pipeline(stream, createWriteStream(output, { mode: 0o700, flags: 'wx' }), {
              signal
            })
          }
          zip.readEntry()
        })().catch(finish)
      })
      if (signal.aborted) abort()
      else zip.readEntry()
    })
  }
  signal.throwIfAborted()
}
export async function walkFiles(root: string): Promise<string[]> {
  const output: string[] = []
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) output.push(...(await walkFiles(file)))
    else if (entry.isFile()) output.push(file)
    else throw new Error('Unexpected symbolic link')
  }
  return output
}
