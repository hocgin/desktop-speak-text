// Opt-in integration check. Downloads fixed runtime assets and a 190 MB Kokoro model.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { installRuntime, checkRuntime } from '../../src/lib/ai/runtime.js'
import { modelById, modelURL } from '../../src/lib/ai/catalog.js'
import { downloadFile } from '../../src/lib/ai/files.js'
import { buildLocalRequest, wavDuration } from '../../src/lib/ai/audio.js'
import { LocalEngine } from '../../src/lib/ai/engine.js'
const root =
  process.env.SPEAKTEXT_AI_SMOKE_DIR ||
  (await fs.mkdtemp(path.join(os.tmpdir(), 'speaktext-native-')))
console.log('Smoke directory:', root)
let stage = ''
const progress = (done: number, total: number, next = '') => {
  if (next !== stage) {
    stage = next
    console.log(next, done, total)
  }
}
const signal = AbortSignal.timeout(20 * 60_000)
const engine = new LocalEngine(root, () => console.log('Engine:', engine.status))
try {
  const runtime = await installRuntime(root, signal, progress, fetch)
  console.log('Runtime verified:', await checkRuntime(runtime, root))
  await fs.writeFile(path.join(root, 'installed-runtime.json'), JSON.stringify(runtime))
  const model = modelById('kokoro-82m-q8'),
    file = path.join(root, `${model.id}.gguf`)
  await downloadFile(
    modelURL(model, 'modelscope'),
    file,
    model.sha256,
    model.size,
    signal,
    progress
  )
  const audio = await engine.generate(
    runtime,
    model,
    file,
    buildLocalRequest(model, '你好，欢迎使用本地语音。', {
      modelId: model.id,
      speaker: 'zf_xiaobei'
    }),
    signal
  )
  const out = path.join(root, 'smoke.wav')
  await fs.writeFile(out, audio)
  console.log('Generated:', out, 'duration:', wavDuration(audio))
} finally {
  await engine.stop()
}
