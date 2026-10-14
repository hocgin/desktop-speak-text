# Edge TTS Local Vendoring Design

## Goal

Use the customized `edge-tts-universal` build from the sibling `bun-api` project without resolving or downloading the published npm package.

## Design

- Copy `/Users/hocgin/Projects/_Web/bun-api/edge-tts-universal` into the repository root as `edge-tts-universal/`.
- Treat the copied directory as checked-in application source. It contains the JavaScript runtime files, CommonJS variants, type declarations, and source maps used by the customized build.
- Change `src/lib/tts/main.ts` to import the local ESM entry point by a relative path ending in `edge-tts-universal/index.js`.
- Remove `edge-tts-universal` from `package.json` and regenerate `pnpm-lock.yaml` so no registry resolution for that package remains.
- Promote the vendored build's runtime dependencies to direct application dependencies, using the versions declared by the reference package: `axios@^1.12.1`, `cross-fetch@^4.1.0`, `https-proxy-agent@^7.0.6`, `isomorphic-ws@^5.0.0`, `uuid@^11.1.0`, `ws@^8.18.3`, and `xml-escape@^1.1.0`. This preserves clean-install and optional proxy/runtime-detection behavior after the parent npm package is removed.
- Do not modify the vendored implementation while adopting it; the source project remains the reference for future manual refreshes.

## Runtime and Packaging

The Electron main-process build will encounter the vendored implementation as a relative module rather than a bare package import. This keeps it in the local module graph and avoids a runtime dependency on an installed `node_modules/edge-tts-universal` package.

## Error Handling

No TTS behavior or error handling changes are introduced. Existing callers continue to use `EdgeTTS` and `listVoices`; only module resolution changes.

## Verification

- Reinstall dependencies with pnpm and verify the lockfile no longer contains an `edge-tts-universal` package entry while retaining the vendored build's direct runtime dependencies.
- Run the project's TypeScript checks.
- Run the production build to verify Electron/Vite resolves and bundles the vendored ESM entry point.
- Confirm no source file retains a bare `edge-tts-universal` import.

## Non-goals

- Rebuilding or refactoring the vendored library.
- Publishing the vendored library as a workspace package.
- Changing TTS APIs or application behavior.
