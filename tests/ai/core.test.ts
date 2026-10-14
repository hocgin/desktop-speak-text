import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import * as tar from 'tar'
import { CATALOG, modelById, runtimePackage } from '../../src/lib/ai/catalog.js'
import { buildLocalRequest, wavDuration } from '../../src/lib/ai/audio.js'
import { downloadFile, extractArchive, hashFile, within } from '../../src/lib/ai/files.js'
import { SecretVault } from '../../src/lib/ai/secrets.js'
import { streamCompletion, promptFor, validateBaseURL, endpoint } from '../../src/lib/ai/llm.js'
import { TaskManager } from '../../src/lib/ai/tasks.js'
import { LocalEngine } from '../../src/lib/ai/engine.js'
import { checkRuntime } from '../../src/lib/ai/runtime.js'
async function temporary(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'speaktext-ai-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  return root
}
const digest = (value: Buffer) => createHash('sha256').update(value).digest('hex')
function wave() {
  const b = Buffer.alloc(44 + 48000)
  b.write('RIFF')
  b.writeUInt32LE(b.length - 8, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(24000, 24)
  b.writeUInt32LE(48000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(48000, 40)
  return b
}
test('catalog covers only four approved models and supported platforms', () => {
  assert.equal(CATALOG.length, 4)
  assert.equal(runtimePackage('darwin', 'arm64')?.backend, 'metal')
  assert.equal(runtimePackage('win32', 'x64')?.backend, 'cpu')
  assert.equal(runtimePackage('darwin', 'x64'), undefined)
  assert.throws(() => modelById('../unknown'))
})
test('model adapters enforce required inputs without leaking Edge parameters', () => {
  const kokoro = buildLocalRequest(modelById('kokoro-82m-q8'), '你好', {
    modelId: 'kokoro-82m-q8',
    speaker: 'zf_xiaobei'
  })
  assert.equal(kokoro.request.voice_id, 'zf_xiaobei')
  assert.deepEqual(kokoro.request.options, { text_chunk_size: 64 })
  assert.throws(() =>
    buildLocalRequest(modelById('kokoro-82m-q8'), 'hello', {
      modelId: 'kokoro-82m-q8',
      speaker: 'not-a-voice'
    })
  )
  assert.throws(() =>
    buildLocalRequest(modelById('qwen3-tts-voicedesign-q8'), 'hello', {
      modelId: 'qwen3-tts-voicedesign-q8'
    })
  )
  const design = buildLocalRequest(modelById('qwen3-tts-voicedesign-q8'), '你好', {
    modelId: 'qwen3-tts-voicedesign-q8',
    description: 'calm'
  })
  assert.equal(design.request.language, 'Chinese')
  assert.throws(() =>
    buildLocalRequest(modelById('index-2.5-q8'), 'hello', { modelId: 'index-2.5-q8' })
  )
  const clone = buildLocalRequest(
    modelById('index-2.5-q8'),
    'hello',
    { modelId: 'index-2.5-q8', speed: 2, emotion: 'happy' },
    '/reference.wav'
  )
  assert.equal((clone.request.options as any).duration_factor, 0.5)
  assert.equal(clone.request.voice_ref, '/reference.wav')
})
test('WAV parser measures actual duration and rejects truncated or empty audio', () => {
  assert.equal(wavDuration(wave()), 1)
  assert.throws(() => wavDuration(wave().subarray(0, 48)))
  assert.throws(() => wavDuration(Buffer.alloc(44)))
})
test('download resumes partial files, ignores unsupported Range, and rejects bad hashes', async (t) => {
  const root = await temporary(t),
    file = path.join(root, 'model'),
    content = Buffer.from('test-model-bytes')
  await fs.writeFile(`${file}.part`, content.subarray(0, 5))
  let range: string | null = null
  const mock: typeof fetch = async (_url, init) => {
    range = new Headers(init?.headers).get('range')
    return new Response(content.subarray(5), {
      status: 206,
      headers: { 'content-range': `bytes 5-${content.length - 1}/${content.length}` }
    })
  }
  await downloadFile(
    'https://example.com/model',
    file,
    digest(content),
    content.length,
    new AbortController().signal,
    () => {},
    mock
  )
  assert.equal(range, 'bytes=5-')
  assert.deepEqual(await fs.readFile(file), content)
  await fs.rm(file)
  await fs.writeFile(`${file}.part`, Buffer.from('wrong'))
  await downloadFile(
    'https://example.com/model',
    file,
    digest(content),
    content.length,
    new AbortController().signal,
    () => {},
    async () => new Response(content)
  )
  assert.deepEqual(await fs.readFile(file), content)
  await fs.rm(file)
  await assert.rejects(
    downloadFile(
      'https://example.com/model',
      file,
      '0'.repeat(64),
      content.length,
      new AbortController().signal,
      () => {},
      async () => new Response(content)
    ),
    /mismatch/
  )
  await assert.rejects(fs.stat(`${file}.part`))
})
test('cancelled downloads retain resumable bytes without publishing a final file', async (t) => {
  const root = await temporary(t),
    file = path.join(root, 'model'),
    controller = new AbortController()
  const content = Buffer.from('abcdefgh')
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(content.subarray(0, 4))
    },
    cancel() {
      /* Test stream has no backing resources. */
    }
  })
  const operation = downloadFile(
    'https://example.com/model',
    file,
    digest(content),
    8,
    controller.signal,
    () => controller.abort(),
    async () => new Response(stream)
  )
  // Fetch implementations must abort blocked reads when their signal fires.
  setTimeout(() => controller.abort(), 30)
  await assert.rejects(operation, /abort/i)
  await assert.rejects(fs.stat(file))
  assert.equal((await fs.stat(`${file}.part`)).size, 4)
})
test('archive extraction rejects symlinks and paths remain contained', async (t) => {
  const root = await temporary(t),
    source = path.join(root, 'source'),
    archive = path.join(root, 'bad.tar.gz')
  await fs.mkdir(source)
  await fs.writeFile(path.join(source, 'a'), 'safe')
  await fs.symlink('/etc/passwd', path.join(source, 'link'))
  await tar.c({ gzip: true, cwd: source, file: archive }, ['a', 'link'])
  await assert.rejects(
    extractArchive(archive, path.join(root, 'out'), new AbortController().signal),
    /links/
  )
  assert.equal(within(root, path.join(root, 'a')), true)
  assert.equal(within(root, root), false)
  assert.equal(within(root, path.join(root, '../a')), false)
})
test('vault persists ciphertext, preserves keys across restart, and uses session fallback', async (t) => {
  const root = await temporary(t),
    file = path.join(root, 'keys.json')
  const codec = {
    available: () => true,
    encrypt: (v: string) => Buffer.from(v.split('').reverse().join('')),
    decrypt: (v: Buffer) => v.toString().split('').reverse().join('')
  }
  const vault = new SecretVault(file, codec)
  await vault.load()
  await vault.set('provider', 'private-key')
  assert.equal((await fs.readFile(file, 'utf8')).includes('private-key'), false)
  const restarted = new SecretVault(file, codec)
  await restarted.load()
  assert.equal(restarted.get('provider'), 'private-key')
  const session = new SecretVault(file, { ...codec, available: () => false })
  await session.load()
  await session.set('provider', 'session-key')
  assert.equal(session.get('provider'), 'session-key')
  assert.equal(session.info('provider').sessionOnly, true)
  assert.equal((await fs.readFile(file, 'utf8')).includes('session-key'), false)
  await session.set('provider')
  assert.equal(session.get('provider'), undefined)
})
test('stream parser handles fragmented UTF-8, CRLF, DONE, and provider errors', async () => {
  const raw = Buffer.from(
    'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"。"}}]}\n\ndata: [DONE]\n\n'
  )
  const chunks = new ReadableStream({
    start(c) {
      for (const byte of raw) c.enqueue(Uint8Array.of(byte))
      c.close()
    }
  })
  let preview = ''
  assert.equal(
    await streamCompletion(new Response(chunks), new AbortController().signal, (text) => {
      preview = text
    }),
    '你好。'
  )
  assert.equal(preview, '你好。')
  await assert.rejects(
    streamCompletion(
      new Response('data: {"error":{}}\n\n'),
      new AbortController().signal,
      () => {}
    ),
    /error/
  )
  await assert.rejects(
    streamCompletion(
      new Response('denied', { status: 401 }),
      new AbortController().signal,
      () => {}
    ),
    /401/
  )
})
test('compatible service integration handles streamed completions and authentication failures', async (t) => {
  const server = createServer((request, response) => {
    if (request.headers.authorization !== 'Bearer key') {
      response.writeHead(401)
      response.end()
      return
    }
    if (request.url === '/v1/models') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ data: [{ id: 'test' }] }))
      return
    }
    response.setHeader('Content-Type', 'text/event-stream')
    response.end('data: {"choices":[{"delta":{"content":"polished"}}]}\n\ndata: [DONE]\n\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1`
  const listing = await fetch(endpoint(base, 'models'), {
    headers: { Authorization: 'Bearer key' }
  })
  assert.equal((await listing.json()).data[0].id, 'test')
  const response = await fetch(endpoint(base, 'chat/completions'), {
    method: 'POST',
    headers: { Authorization: 'Bearer key' },
    body: '{}'
  })
  assert.equal(await streamCompletion(response, new AbortController().signal, () => {}), 'polished')
  await assert.rejects(
    streamCompletion(
      await fetch(endpoint(base, 'chat/completions')),
      new AbortController().signal,
      () => {}
    ),
    /401/
  )
  assert.throws(() => validateBaseURL('http://api.example.com/v1'))
  assert.throws(() => validateBaseURL('https://key:secret@example.com/v1'))
  assert.throws(() => promptFor({ taskId: 'task', text: 'hello', action: 'custom' }))
})
test('task cancellation respects owner and terminal tasks report errors', async () => {
  const events: any[] = [],
    manager = new TaskManager((task) => events.push(task))
  const work = manager.run({ id: 'first', kind: 'download' }, 1, async (signal) => {
    manager.cancel('first', 2)
    assert.equal(signal.aborted, false)
    manager.cancel('first', 1)
    signal.throwIfAborted()
  })
  await assert.rejects(work)
  assert.equal(events.at(-1).status, 'cancelled')
  await assert.rejects(
    manager.run({ id: 'error', kind: 'text' }, 1, async () => {
      throw new Error('service failed')
    })
  )
  assert.equal(events.at(-1).error, 'service failed')
  assert.equal(manager.list(2).length, 0)
})
test('runtime integrity checks detect damaged installed resources', async (t) => {
  const root = await temporary(t),
    installed = path.join(root, 'runtime'),
    executable = path.join(installed, 'server')
  await fs.mkdir(installed)
  await fs.mkdir(path.join(installed, 'tools'))
  await fs.writeFile(executable, 'server')
  const runtime = {
    root: installed,
    executable,
    tools: path.join(installed, 'tools'),
    files: { server: await hashFile(executable) }
  }
  assert.equal(await checkRuntime(runtime, root), true)
  await fs.writeFile(executable, 'damaged')
  assert.equal(await checkRuntime(runtime, root), false)
})
test(
  'engine reuses model process, switches models, cancels and recovers',
  { skip: process.platform === 'win32' },
  async (t) => {
    const root = await temporary(t),
      executable = path.join(root, 'audiocpp_server')
    await fs.writeFile(
      executable,
      `#!${process.execPath}\nconst fs=require('fs'),http=require('http');const cfg=JSON.parse(fs.readFileSync(process.argv[process.argv.indexOf('--config')+1]));http.createServer((req,res)=>{if(req.url==='/health'){res.end('ok');return}let b='';req.on('data',c=>b+=c);req.on('end',()=>{const send=()=>res.end(JSON.stringify({audio:'${wave().toString('base64')}'}));if(JSON.parse(b).slow)setTimeout(send,30000);else send()})}).listen(cfg.port,cfg.host)\n`,
      { mode: 0o755 }
    )
    const engine = new LocalEngine(root, () => {})
    t.after(() => engine.stop())
    const runtime = { root, executable, tools: root, files: {} },
      signal = new AbortController().signal
    const first = modelById('kokoro-82m-q8'),
      second = modelById('qwen3-tts-customvoice-q8')
    const result = await engine.generate(runtime, first, '/fake-model', {}, signal)
    assert.equal(wavDuration(result), 1)
    const pid1 = JSON.parse(await fs.readFile(path.join(root, 'engine-pid.json'), 'utf8')).pid
    await engine.generate(runtime, first, '/fake-model', {}, signal)
    assert.equal(
      JSON.parse(await fs.readFile(path.join(root, 'engine-pid.json'), 'utf8')).pid,
      pid1
    )
    await engine.generate(runtime, second, '/fake-model', {}, signal)
    assert.notEqual(
      JSON.parse(await fs.readFile(path.join(root, 'engine-pid.json'), 'utf8')).pid,
      pid1
    )
    const controller = new AbortController(),
      work = engine.generate(runtime, second, '/fake-model', { slow: true }, controller.signal)
    setTimeout(() => controller.abort(), 50)
    await assert.rejects(work)
    assert.equal(engine.status, 'stopped')
    await engine.generate(runtime, first, '/fake-model', {}, signal)
    assert.equal(engine.status, 'ready')
    await engine.stop()
    assert.equal(engine.status, 'stopped')
  }
)

test('stream cancellation interrupts a stalled reader without applying partial output', async () => {
  const controller = new AbortController()
  const stalled = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'))
    }
  })
  const work = streamCompletion(new Response(stalled), controller.signal, () => {})
  setTimeout(() => controller.abort(), 10)
  await assert.rejects(work, /abort/i)
})
