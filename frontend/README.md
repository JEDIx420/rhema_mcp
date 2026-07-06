# Rhelo frontend and desktop host

This directory contains the Rhelo interface: a Next.js 16 App Router application configured for static export, plus a Tauri 2 host for the offline desktop build.

## Development

Start the Python API from the repository root:

```bash
RHELO_MODE=http ./.venv/bin/python3 server.py
```

Then run the interface:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The web API and packaged desktop sidecar both default to `http://127.0.0.1:5050`, matching the original working application topology. Set `NEXT_PUBLIC_API_URL` before building for another web default, or change the web endpoint at runtime from the MCP page; browser choices are stored under `rhelo-api-base` in local storage.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next development server |
| `npm run typecheck` | TypeScript check without output |
| `npm run lint` | ESLint across the frontend |
| `npm run build` | Webpack-backed static export to `out/` |
| `npm run verify:desktop` | Ensure database and Whisper assets are present/non-empty |
| `npm run tauri dev` | Run the Tauri development shell |
| `npm run tauri build` | Verify assets, export the frontend, and package desktop targets |

The production frontend is static. `npm start` is retained from Next's standard scripts but is not the normal deployment path for `output: "export"`; use the generated `out/` directory with a static server.

## Source map

- `src/app/page.tsx` — global application state, navigation coordinates, drag target, command center, microphone, and transcription review.
- `src/components/AppViewRouter.tsx` — view selection.
- `src/components/EnglishTranslationProvider.tsx` — persistent BSB/WEB/KJV choice.
- `src/components/ReadingDesk.tsx` and `StudyPane.tsx` — aligned reading and exegesis.
- `src/components/SessionsView.tsx` — TipTap session editor and PDF workflow.
- `src/components/McpView.tsx` — local connection/configuration screen.
- `src/lib/api.ts` — runtime transport adapter: native Tauri IPC for desktop session CRUD and HTTP for browser/API features.
- `src/lib/speech.ts` — browser/Tauri speech bridge with English/Hebrew/Greek enforcement.
- `src/lib/verseDrop.ts` — safe, separate-line multilingual session insertion.
- `src-tauri/` — sidecar lifecycle, writable database setup, native TTS, and Whisper transcription.

## Desktop assets and lifecycle

Tauri expects these repository-level resources:

- `rhelo.db`, larger than the verifier's minimum size;
- `ggml-base.bin`, a real Whisper model rather than an empty placeholder;
- `src-tauri/binaries/server-<target-triple>`, the PyInstaller sidecar for the target platform.

On first launch, the bundled database is copied to the platform application-data directory. Later launches reuse that writable copy so sessions survive application updates. Desktop session create/read/update/delete operations use `rusqlite` commands in the Tauri host and do not depend on the Python HTTP process. The web app retains the session HTTP endpoints because a browser cannot invoke Tauri commands.

The sidecar remains responsible for scripture, search, dictionary, map, timeline, PDF, and MCP-supporting HTTP features. It receives the writable path through `RHELO_DB_PATH` and a per-launch `RHELO_BOOT_TOKEN`. Rust validates `/api/health`, the token, and the resolved database path before showing the main window, and retains the child handle for shutdown cleanup.

The Tauri resource map must keep both files at the bundle resource root as `rhelo.db` and `ggml-base.bin`. The desktop verifier checks this mapping because nested `_up_` resource paths prevent both the writable database copy and Whisper initialization.

TTS supports English (`en`), Hebrew (`he`), and Greek (`el`) in both browser and Tauri bridges. Hebrew/Greek require a matching system voice in Tauri. STT uses the bundled Whisper model in Tauri and browser speech recognition as the web fallback.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
cd src-tauri
cargo fmt --check
cargo check
```

Run `npm run verify:desktop` only when preparing a desktop bundle; failure is expected when the intentionally untracked Whisper model is absent.

## Build notes

- `next.config.ts` enables static export, unoptimized images, and the React compiler.
- `npm run build` explicitly uses Webpack for reproducibility with the current dependency set.
- The Dockerfile builds `out/` with Node 22 and serves it from Nginx.
- Do not commit `node_modules`, `.next`, `out`, Rust `target`, TypeScript build metadata, databases, generated PDFs, or models.
