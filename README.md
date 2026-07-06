# Rhelo Study Engine

Rhelo is a local-first, offline Bible study workspace and Model Context Protocol (MCP) server. It aligns BSB, WEB, KJV, Hebrew/Greek source text, and Hindi, Telugu, Malayalam, and Tamil translations with lexical, geographical, chronological, biographical, commentary, and cross-reference data.

## Architecture

- `rhelo_backend/`: configuration, database access, application services, and MCP transport registration.
- `server.py`: backward-compatible HTTP API host and process entrypoint.
- `rhelo.db`: generated SQLite knowledge base with FTS5 search indexes.
- `frontend/`: Next.js static web application.
- `frontend/src-tauri/`: Tauri desktop host, Python sidecar lifecycle, native TTS, and Whisper STT.
- `migrations/`: ordered database ingestion and schema migrations.

The frontend uses the HTTP API at `http://127.0.0.1:5050`. MCP clients launch the same `server.py` process over stdio. An interactive terminal runs both transports for development. Packaged and container processes set `RHELO_MODE=http`; generated MCP client configurations set `RHELO_MODE=mcp`.

## Setup

The full database build downloads public/open-source datasets and may take some time:

```bash
./setup.sh
```

Run the backend:

```bash
./.venv/bin/python3 server.py
```

Run the web application:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The MCP page in the sidebar tests the backend connection, lists registered tools, and generates client configuration.

## MCP client configuration

Use absolute paths for your installation:

```json
{
  "mcpServers": {
    "rhelo": {
      "command": "/absolute/path/to/rhelo_mcp/.venv/bin/python3",
      "args": ["/absolute/path/to/rhelo_mcp/server.py"],
      "env": {
        "RHELO_DB_PATH": "/absolute/path/to/rhelo_mcp/rhelo.db",
        "RHELO_MODE": "mcp"
      }
    }
  }
}
```

Registered tools:

- `search_scriptures`
- `get_verse_details`
- `search_dictionary_and_lexicon`
- `search_topics`
- `get_biography`
- `get_chapter_map_data`
- `list_geography_routes`
- `get_route_points`

## Verification

```bash
python3 -m unittest discover -s tests
cd frontend
npm run typecheck
npm run lint
npm run build
```

Desktop builds additionally run `npm run verify:desktop`. This deliberately fails when `rhelo.db` or `ggml-base.bin` is missing or incomplete, preventing distribution of an installer with broken offline data or dictation.

## Docker

```bash
docker compose up --build
```

The web UI is served at `http://localhost:3000` and the backend at `http://localhost:5050`. The local `rhelo.db` is mounted read/write at `/data/rhelo.db` so study sessions remain persistent.

## Data model

`verses_base` stores canonical verse identity and original-language data. `verse_translations` stores translations by language code. The `verses` compatibility view preserves the existing API shape. Related tables connect verses to Strong's entries, commentaries, places, routes, timeline events, people, relationships, topics, and cross-references. See [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

English translation provenance and fallback behavior are documented in [docs/ENGLISH_TRANSLATIONS.md](docs/ENGLISH_TRANSLATIONS.md).
