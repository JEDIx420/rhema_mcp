# Rhema Study Engine & MCP Server

Rhema is a high-fidelity, local-first, offline-first Bible study search engine and exegesis machine, packaged as a Model Context Protocol (MCP) server.

The engine aligns canonical scripture texts across English (KJV), original languages (Biblical Hebrew WLC / Koine Greek BYZ), and multiple Indian language translations (Hindi, Telugu, Malayalam, Tamil). It enriches scripture with extensive geocoded coordinates, historical timelines, biographical lineage profiles, and 4 major dictionaries (Easton's, Smith's, Hitchcock's Name Meanings, and Nave's Topical Index).

---

## 🚀 One-Command Quick Start

The repository contains a helper script to automatically configure a Python virtual environment, install dependencies, download open-source datasets, and construct the complete SQLite database from scratch.

Run the following in your terminal:
```bash
./setup.sh
```

*(This compiles the entire ~200MB `rhema.db` SQLite engine sequentially.)*

---

## 🛠️ Running the MCP Server

Once the setup is complete, you can start the server locally:

### 1. In Development/Inspection Mode
To run the server with an interactive browser-based testing console:
```bash
npx @modelcontextprotocol/inspector ./.venv/bin/python3 server.py
```
This opens a local GUI (usually `http://localhost:5173`) where you can run queries and inspect tool returns.

### 2. In Production (e.g. for Claude Desktop)
Add the server configuration to your Claude Desktop config file (located at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rhema": {
      "command": "/absolute/path/to/rhema_mcp/.venv/bin/python3",
      "args": ["/absolute/path/to/rhema_mcp/server.py"]
    }
  }
}
```

---

## ⚙️ Exposed Tools

*   `search_scriptures(query, book)`: Instant English full-text search (FTS5) with optional book filtering.
*   `get_verse_details(verse_id)`: Exposes side-by-side translations, commentary paragraphs, coordinates, chronological events, and top cross-references.
*   `search_dictionary_and_lexicon(query)`: Searches entries in Easton's, Smith's, and Strong's Concordance.
*   `search_topics(query)`: Searches subjects and entries in Nave's Topical Index.
*   `get_biography(person_id)`: Details biographical summaries and social relationships (parentage, marriages, tribal lineage) for historical figures.
*   `get_chapter_map_data(book, chapter)`: Exposes geocoded coordinates for places mentioned in the chapter.

---

## 🗺️ Future Roadmap & Product Architecture

See **[rhemamcp_plan.md](file:///Users/vincyvincent/rhema_mcp/rhemamcp_plan.md)** and **[UI_UX_SPEC.md](file:///Users/vincyvincent/rhema_mcp/docs/UI_UX_SPEC.md)** for detailed specifications on building:
1.  **Tauri Desktop App & Docker Compose Bundle**: Delivering the study app as a standalone local client or NAS self-hosted docker service.
2.  **Interlinear Reading Desk Panel**: Dynamic side-by-side scrolls with word-level hovering for lexicon lookups.
3.  **Cross-Reference Network Graph Canvas**: Visualizing scripture connection networks.
4.  **Genealogical Tree Chart**: Displaying lineages interactively.
