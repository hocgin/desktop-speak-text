# AI integration

AI model manager contains local speech models and language-model providers.

## Local speech

Install the engine, download or import a supported Q8 GGUF, then select Local
speech in the narration page. Supported platforms: Apple Silicon macOS (Metal)
and Windows x64 (CPU). The default narration engine remains Edge TTS.

Supported model IDs:

- `kokoro-82m-q8`: built-in voices; Chinese default `zf_xiaobei`.
- `qwen3-tts-customvoice-q8`: built-in voices with optional delivery instructions.
- `qwen3-tts-voicedesign-q8`: requires a voice description.
- `index-2.5-q8`: requires reference audio; optional speed and emotion description.

Reference WAV/MP3 files must be 1–60 seconds and at most 20 MB. The application
converts them with its downloaded FFmpeg, disables network decoding, and keeps
only temporary references. Local inference failure is shown without automatically
switching voice engines. Generated WAV files share playback/export/history with
Edge TTS. History stores the engine, model ID, and generation-parameter snapshot.

The runtime is audio.cpp v0.9.1. Supporting tools are extracted from fixed
SHA-256-verified yovoice v0.2.0 CLI archives. Installation validates required
resources and retains per-file hashes for startup integrity verification. Repair
reinstalls into staging before replacing the previous registration.

Data lives in `userData/ai/` (models, downloads, runtime installations, temporary
references, and `engine.log`). Configuration uses the separate `ai-config`
electron-store file. An imported model is registered in place and never deleted
by the application. Managed model removal deletes only its designated GGUF.
Interrupted downloads retain `.part` files for Range-based resumption.

## Text assistant

Add a compatible provider, API URL, key and model ID. Save before fetching its
model list or testing a completion. Listing failures do not prevent manual model
IDs. Ollama is connected through its `/v1` compatibility API; install its models
with Ollama itself. HTTPS is required except for loopback HTTP services.

Keys are stored separately in `userData/ai/keys.json`, encrypted with Electron
safeStorage. The renderer and generic store API never receive stored keys. When
secure encryption is unavailable, newly entered keys last only for the session.

Polish, translate, summarize, and custom instructions produce a streamed preview.
They never automatically replace the manuscript. Applying a result requires a
second confirmation if the manuscript changed during generation. Responses over
5000 characters cannot be applied to the 5000-character narration editor.

## Interfaces and cancellation

`window.electron.ai` provides typed model/provider operations, state snapshots,
reference selection, text processing and task cancellation. Main-frame IPC is
validated. `onTask` and `onStateChanged` return unsubscribe functions. Task IDs
are supplied before requests so listeners can observe the first event. Tasks
are owned by their requesting web contents; one window cannot cancel another's
task. Closing its contents cancels outstanding tasks.

`TTSGenerateParams` supports the existing Edge request and a discriminated local
request `{ engine: 'local', text, taskId, local }`. SQLite migration 0002 defaults
old history to `edge`. Generation waits for migration completion.

## Validation

- `pnpm test:ai`: deterministic download, integrity, archive, secret, adapter,
  streaming, compatible-service, cancellation, and subprocess lifecycle checks.
- `pnpm build`: both TypeScript projects and Electron renderer/main/preload builds.
- `pnpm exec tsx tests/ai/native-smoke.ts`: opt-in actual runtime installation and
  Chinese Kokoro generation. Downloads runtime/tools and a ~190 MB model to a
  temporary directory. Set `SPEAKTEXT_AI_SMOKE_DIR` to reuse a designated cache.

Real inference of every model on both supported platforms is a separate release
acceptance check. Mock subprocess tests do not establish model quality, hardware
compatibility, Windows signing behavior, or performance of the multi-GB models.

### Electron integration smoke test

After building, run:

```sh
NODE_ENV=development pnpm exec electron tests/ai/electron-smoke.cjs
```

It uses isolated temporary user data and a loopback mock provider. It checks
actual preload/IPC calls, safe key storage, migration of an old history record,
manager rendering at normal/compact widths, preview-only text processing, applying
results, and confirmation after subsequent manuscript edits. It produces screenshots.
The development environment here enables the repository's locale-file lookup;
it still loads the production build from `out/`.

To additionally exercise actual local TTS through Electron, first run native-smoke
with `SPEAKTEXT_AI_SMOKE_DIR` set to a designated temporary directory, then use that
same variable for electron-smoke. Runtime resources are copied into the isolated
application directory. This adds real WAV generation/loading/history, reference
conversion, model import, cached download registration, and managed/imported
model-removal checks.

### Verified on 2026-10-14

- Both TypeScript projects and `pnpm build` passed.
- All 13 deterministic AI tests passed; targeted ESLint passed.
- Electron IPC, provider requests, streaming, key isolation, old-record migration,
  normal/compact manager layouts, text application and overwrite confirmation passed.
- Apple Silicon Metal: fixed runtime/tool archives and Kokoro Q8 weights verified;
  Chinese speech generated successfully (3.75-second WAV). The same model passed
  the Electron TTS/history/load workflow, reference conversion, GGUF import and
  safe model-removal checks.
- Windows inference, Qwen CustomVoice/VoiceDesign and IndexTTS actual inference,
  real cloud-provider accounts, and signed installer distribution were not tested.
  Their adapters/manifests are implemented; mocked tests are not hardware validation.
