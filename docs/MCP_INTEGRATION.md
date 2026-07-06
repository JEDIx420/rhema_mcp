# Model Context Protocol integration

Rhelo exposes its local study database to MCP-compatible AI clients through a FastMCP stdio server. This is separate from the HTTP API used by the Rhelo interface: both transports share the same Python entrypoint and SQLite database, but HTTP is not an MCP transport.

## Starting MCP mode

```bash
RHELO_MODE=mcp ./.venv/bin/python3 server.py
```

MCP communicates over standard input/output, so informational startup text is written carefully and clients should launch the process rather than connect to port 5050.

Example client configuration:

```json
{
  "mcpServers": {
    "rhelo": {
      "command": "/absolute/path/to/rhema_mcp/.venv/bin/python3",
      "args": ["/absolute/path/to/rhema_mcp/server.py"],
      "env": {
        "RHELO_DB_PATH": "/absolute/path/to/rhema_mcp/rhelo.db",
        "RHELO_MODE": "mcp"
      }
    }
  }
}
```

Dependencies are declared in `requirements.txt`; `mcp` supplies `FastMCP`, while SQLite is part of Python.

## In-app MCP page

The sidebar's MCP page manages the interface's connection to the local HTTP companion service. It can:

- store and test an API base URL;
- call `/api/mcp/status` to show database and tool registration state;
- call `/api/mcp/config` to generate an absolute-path client configuration;
- copy that configuration to the clipboard.

In a normal browser, security rules prevent the page from launching or stopping local programs; the Python backend must already be running. In Tauri, the desktop host launches the bundled sidecar in HTTP mode on the application's default local endpoint. A separate MCP client still starts its own MCP-mode process when using the generated configuration.

## Registered tools

### `search_scriptures`

Full-text search across the selected English edition.

- `query: str` — FTS5 search expression.
- `book: str | None` — optional uppercase three-character book code.
- `translation_code: str` — optional `en_bsb`, `en_web`, or `en_kjv`; defaults to BSB.
- Returns up to 50 `[VERSE_ID] text` lines or a no-results/error message.

### `get_verse_details`

Returns a formatted study packet for one verse.

- `verse_id: str` — ID such as `GEN.1.1`.
- `translation_code: str` — optional English edition.
- Includes selected English text, original text, four Indic translations, commentaries, places, timeline events, and ten leading cross-references.

### `search_dictionary_and_lexicon`

- `query: str` — FTS5 query.
- Searches the combined Easton's/Smith's dictionary index and Strong's lexicon.
- Returns up to 15 results from each index.

### `search_topics`

- `query: str` — topical keyword or FTS5 expression.
- Searches Nave's Topical Index and returns up to 15 subject/reference entries.

### `get_biography`

- `person_id: str` — exact dataset ID or a name prefix such as `David`.
- Returns profile fields, Hitchcock's name meaning when available, and directed family/social relationships.

### `get_chapter_map_data`

- `book: str` — three-character book code.
- `chapter: int` — chapter number.
- Returns distinct geocoded places linked to verses in canonical order.

### `list_geography_routes`

- No arguments.
- Returns route IDs, titles, and descriptions.

### `get_route_points`

- `route_id: str` — one ID returned by `list_geography_routes`.
- Returns ordered coordinates, place names, and associated verse IDs.

## Code ownership

- `rhelo_backend/mcp_server.py` creates the FastMCP instance and registers the public names.
- `rhelo_backend/services/mcp_service.py` implements tool behavior.
- `rhelo_backend/translations.py` validates edition codes.
- `rhelo_backend/database.py` creates short-lived SQLite connections.
- `server.py` selects `mcp`, `http`, `both`, or `auto` runtime mode.

MCP functions currently return human-readable strings rather than structured resource objects. This is stable behavior for existing clients; a future structured API should be additive or versioned.

## Troubleshooting

- If a client shows no tools, verify the command and `server.py` path are absolute and that `RHELO_MODE=mcp` is set.
- If tools report missing tables, point `RHELO_DB_PATH` to a fully migrated `rhelo.db`.
- If the UI MCP page is disconnected, start `RHELO_MODE=http ./.venv/bin/python3 server.py`; do not point the browser at the stdio process.
- Avoid printing arbitrary diagnostics to stdout in MCP mode because stdout carries protocol messages.
