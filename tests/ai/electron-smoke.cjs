/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
// Built-app integration check with isolated userData and a local compatible API.
const { app, BrowserWindow, dialog } = require('electron')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'speaktext-electron-'))
  app.setPath('userData', root)
  const nativeRoot = process.env.SPEAKTEXT_AI_SMOKE_DIR
  if (nativeRoot) {
    const runtime = JSON.parse(
      await fs.readFile(path.join(nativeRoot, 'installed-runtime.json'), 'utf8')
    )
    const installed = path.join(root, 'ai', 'runtime-smoke')
    await fs.cp(runtime.root, installed, { recursive: true })
    const adopted = {
      ...runtime,
      root: installed,
      executable: path.join(installed, path.relative(runtime.root, runtime.executable)),
      tools: path.join(installed, path.relative(runtime.root, runtime.tools))
    }
    await fs.writeFile(
      path.join(root, 'ai-config.json'),
      JSON.stringify({
        runtime: adopted,
        source: 'modelscope',
        models: [
          { id: 'kokoro-82m-q8', path: path.join(nativeRoot, 'kokoro-82m-q8.gguf'), managed: false }
        ],
        defaultModel: 'kokoro-82m-q8',
        providers: []
      })
    )
  }
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer smoke-key') {
      res.writeHead(401)
      res.end()
      return
    }
    if (req.url === '/v1/models') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ data: [{ id: 'smoke-model' }] }))
      return
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (JSON.parse(body).stream) {
        res.setHeader('Content-Type', 'text/event-stream')
        res.end('data: {"choices":[{"delta":{"content":"润色后的文字"}}]}\n\ndata: [DONE]\n\n')
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await app.whenReady()
    // Seed the previous schema and a history record before importing the application.
    const Database = require('better-sqlite3')
    const { drizzle } = require('drizzle-orm/better-sqlite3')
    const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
    const seed = path.join(root, 'old-migrations')
    await fs.mkdir(path.join(seed, 'meta'), { recursive: true })
    const journal = JSON.parse(await fs.readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.slice(0, 2)
    await fs.writeFile(path.join(seed, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries)
      await fs.copyFile(`drizzle/${entry.tag}.sql`, path.join(seed, `${entry.tag}.sql`))
    const previous = new Database(path.join(root, 'data.db'))
    migrate(drizzle(previous), { migrationsFolder: seed })
    previous
      .prepare(
        'INSERT INTO speak_records(text,voice_name,word_count,created_at,updated_at) VALUES(?,?,?,?,?)'
      )
      .run('旧记录', 'zh-CN-XiaoxiaoNeural', 3, 1, 1)
    previous.close()
    await import(pathToFileURL(path.resolve('out/main/index.js')).href)
    let win
    for (let i = 0; i < 80; i++) {
      win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('main'))
      if (win && !win.webContents.isLoading()) break
      await wait(100)
    }
    assert.ok(win, 'Main window created')
    await wait(800)
    const run = (code) => win.webContents.executeJavaScript(code)
    const state = await run('window.electron.ai.getState()')
    assert.equal(state.models.length, 4)
    assert.equal(state.providers.length, 0)
    const history = await run('window.electron.tts.getHistory()')
    assert.equal(history[0].engine, 'edge')
    assert.equal(history[0].modelId, null)
    await run(
      `window.electron.ai.saveProvider(${JSON.stringify({ id: 'smoke-provider', name: 'Smoke', preset: 'custom', baseURL: `http://127.0.0.1:${server.address().port}/v1`, model: 'smoke-model', apiKey: 'smoke-key' })})`
    )
    const models = await run('window.electron.ai.listProviderModels("smoke-provider")')
    assert.deepEqual(models, ['smoke-model'])
    await run('window.electron.ai.testProvider("smoke-provider")')
    const text = await run(
      `(async()=>{let result='';const off=window.electron.ai.onTask(t=>{if(t.id==='text-smoke'&&t.text)result=t.text});try{await window.electron.ai.processText({taskId:'text-smoke',text:'测试',action:'polish'});return result}finally{off()}})()`
    )
    assert.equal(text, '润色后的文字')
    const persisted = await run('window.electron.ai.getState()')
    assert.equal(persisted.providers[0].hasKey, true)
    assert.equal(JSON.stringify(persisted).includes('smoke-key'), false)
    assert.equal(
      (await fs.readFile(path.join(root, 'ai-config.json'), 'utf8')).includes('smoke-key'),
      false
    )
    const clicked = await run(
      `(()=>{const item=Array.from(document.querySelectorAll('[role="menuitem"]')).find(el=>el.textContent.includes('AI 模型'));if(item){item.click();return true}return false})()`
    )
    assert.equal(clicked, true, 'AI manager navigation exists')
    await wait(600)
    const body = await run('document.body.innerText')
    if (!body.includes('Kokoro')) console.log('Renderer content:', body.slice(0, 3000))
    assert.ok(body.includes('Kokoro'), 'AI manager is rendered')
    const image = await win.webContents.capturePage()
    const screenshot = path.join(root, 'ai-manager.png')
    await fs.writeFile(screenshot, image.toPNG())
    // Check compact layout without changing user preferences or real app data.
    win.setSize(460, 670)
    await wait(250)
    const compact = await win.webContents.capturePage()
    await fs.writeFile(path.join(root, 'ai-manager-compact.png'), compact.toPNG())
    win.setSize(900, 670)
    await run(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find(el=>el.textContent.includes('文本转语音'))?.click()`
    )
    await wait(600)
    const setText = (value) =>
      run(
        `(()=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`
      )
    const clickButton = (label) =>
      run(
        `(()=>{const b=Array.from(document.querySelectorAll('button')).find(el=>el.textContent.trim()===${JSON.stringify(label)});if(!b)throw new Error('Missing button '+${JSON.stringify(label)});b.click()})()`
      )
    await setText('待润色的正文')
    await clickButton('AI text assistant')
    await wait(100)
    await clickButton('Process text')
    await wait(400)
    assert.equal(
      await run(`document.querySelector('textarea').value`),
      '待润色的正文',
      'AI never auto-replaces text'
    )
    await clickButton('Apply to text')
    await wait(100)
    assert.equal(await run(`document.querySelector('textarea').value`), '润色后的文字')
    await setText('第二次请求')
    await clickButton('AI text assistant')
    await clickButton('Process text')
    await wait(250)
    await setText('用户后续修改')
    await clickButton('Apply to text')
    await wait(100)
    assert.ok(
      (await run('document.body.innerText')).includes('Your text has changed'),
      'Overwrite requires confirmation'
    )
    assert.equal(await run(`document.querySelector('textarea').value`), '用户后续修改')
    if (nativeRoot) {
      const result = await run(
        `window.electron.tts.generate({engine:'local',taskId:'local-smoke',text:'你好，欢迎使用本地语音。',local:{modelId:'kokoro-82m-q8',speaker:'zf_xiaobei',language:'zh'}})`
      )
      assert.equal(result.success, true, result.error)
      assert.ok(result.data.duration > 0)
      const records = await run('window.electron.tts.getHistory()')
      assert.equal(records[0].engine, 'local')
      assert.equal(records[0].modelId, 'kokoro-82m-q8')
      const audio = await run(
        `window.electron.tts.loadAudio(${JSON.stringify(result.data.audioPath)})`
      )
      assert.ok(audio.startsWith('data:audio/wav;base64,'))
      const referenceDialog = dialog.showOpenDialog
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path.join(nativeRoot, 'smoke.wav')]
      })
      try {
        const ref = await run('window.electron.ai.selectReference()')
        assert.ok(ref.duration >= 1)
      } finally {
        dialog.showOpenDialog = referenceDialog
      }
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [path.join(nativeRoot, 'kokoro-82m-q8.gguf')]
      })
      try {
        await run('window.electron.ai.importModel("import-smoke")')
      } finally {
        dialog.showOpenDialog = referenceDialog
      }
      await run('window.electron.ai.removeModel("kokoro-82m-q8")')
      assert.ok(
        (await fs.stat(path.join(nativeRoot, 'kokoro-82m-q8.gguf'))).isFile(),
        'Imported model is never deleted'
      )
      const managed = path.join(root, 'ai', 'models', 'kokoro-82m-q8.gguf')
      await fs.copyFile(path.join(nativeRoot, 'kokoro-82m-q8.gguf'), managed)
      await run('window.electron.ai.downloadModel("kokoro-82m-q8", "cached-download-smoke")')
      await run('window.electron.ai.removeModel("kokoro-82m-q8")')
      await assert.rejects(fs.stat(managed))
      assert.ok((await fs.stat(path.join(nativeRoot, 'kokoro-82m-q8.gguf'))).isFile())
      console.log(
        'PASS: Real local TTS IPC, WAV loading, history snapshot, reference conversion, import and safe model removal'
      )
    }
    console.log(
      'PASS: Electron IPC, compatible service, stream events, key isolation, legacy migration, manager UI, assistant apply and overwrite guard'
    )
    console.log('Screenshots:', screenshot, path.join(root, 'ai-manager-compact.png'))
    console.log('Test userData:', root)
  } finally {
    server.close()
    app.quit()
  }
}
main().catch((error) => {
  console.error(error)
  app.exit(1)
})
