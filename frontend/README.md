# Rhelo native interface

This directory contains Rhelo's Next.js interface and Tauri 2 native host. The Next.js output is an embedded application surface, not a standalone web deployment. All application data and native features are accessed through Tauri IPC.

## Development

```bash
cd frontend
npm ci
npm run tauri dev
```

No Python process or localhost API is required.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the embedded interface during Tauri development |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | ESLint validation |
| `npm run build` | Build the static interface into `out/` |
| `npm run verify:desktop` | Validate native database, speech model, fonts, and Tauri configuration |
| `npm run tauri dev` | Run the native development application |
| `npm run tauri build` | Build and package Rhelo |

## Native architecture

- `src/lib/api.ts` is the typed Tauri IPC client.
- `src-tauri/src/lib.rs` owns database setup, session CRUD, scripture reads, TTS, and Whisper STT.
- `src-tauri/src/research.rs` owns search, lexicon, maps, research metadata, statistics, and PDF generation.
- `src/components/SessionsView.tsx` previews the PDF bytes returned by Rust.
- `src/components/PdfViewer.tsx` uses the native save dialog and filesystem plugin.

Tauri bundles `rhelo.db`, `ggml-base.bin`, and the Noto font family. On first launch the seed database is copied to the platform app-data directory. PDF generation embeds the bundled Noto fonts so English, Greek, Hebrew, Devanagari, Telugu, Malayalam, and Tamil remain offline and portable.

`dragDropEnabled: false` in `tauri.conf.json` is mandatory on macOS; otherwise Tauri's native file-drop handler intercepts Rhelo's internal HTML drag events.

## Verification

```bash
npm run build
cd src-tauri
cargo fmt --check
cargo test
cargo check
```
