# Rhema Study Engine & MCP Server

Rhema is a high-fidelity, local-first, offline-first Bible study search engine and exegesis machine. It operates as both a Model Context Protocol (MCP) server for AI assistants and a standalone Next.js 15 web application.

The engine aligns canonical scripture texts across English (KJV), original languages (Biblical Hebrew WLC / Koine Greek BYZ), and multiple Indian language translations (Hindi, Telugu, Malayalam, Tamil). It enriches scripture with extensive geocoded coordinates, historical timelines, biographical lineage profiles, and 4 major dictionaries (Easton's, Smith's, Hitchcock's Name Meanings, and Nave's Topical Index).

---

## 🚀 System Setup

The repository contains a helper script to automatically configure a Python virtual environment, install dependencies, download open-source datasets, and construct the complete SQLite database from scratch.

Run the following in your terminal:
```bash
./setup.sh
```

*(This compiles the entire ~200MB `rhema.db` SQLite engine sequentially.)*

---

## 🎨 Next.js Web Application

Rhema includes a highly polished, responsive frontend built with **Next.js** and **Tailwind CSS**, utilizing the premium "Zenrev" design system aesthetic.

### Features
* **Reading Desk**: An advanced scripture reader supporting side-by-side English and original (Hebrew/Greek) interlinear translation. Click any original word to instantly view Strong's definitions and exhaustive occurrences. Includes TTS voice synthesis for translated verses.
* **Sessions Note Workspace**: A built-in TipTap editor for exegesis logging. Features auto-saving, drag-and-drop scripture quoting, speech dictation (STT), and one-click PDF generation.
* **Map & Biblical Routes View**: Displays interactive Leaflet maps with two modes:
  * *Chapter Atlas*: Mapped coordinates for references mentioned in the active reading context.
  * *Biblical Routes*: Visualizes sequential historical routes (e.g. Abraham's Journey, the Exodus Journey) with connecting dashed dashed polyline paths.
* **Study Pane (Exegesis Drawer)**: A unified, multi-tab exegesis engine providing instant access to Lexicon, Commentary, Geography, Chronology Timelines, and Cross-References.
* **Split-Pane Search Center**: Lightning-fast FTS5 full-text search across all Testaments with dynamic book/testament filters and an embedded study pane.

### Running the Frontend
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:3000` to launch the study engine.

---

## 🛠️ Running the MCP Server (Backend)

The core database engine is powered by a FastAPI backend exposed as an MCP Server.

### 1. In Development/Inspection Mode
To run the server with an interactive browser-based testing console:
```bash
npx @modelcontextprotocol/inspector ./.venv/bin/python3 server.py
```

### 2. In Production (e.g. for Claude Desktop)
Add the server configuration to your Claude Desktop config file:

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

## ⚙️ Exposed MCP Tools

*   `search_scriptures(query, book)`: Instant English full-text search (FTS5) with optional book filtering.
*   `get_verse_details(verse_id)`: Exposes side-by-side translations, commentary paragraphs, coordinates, chronological events, and top cross-references.
*   `search_dictionary_and_lexicon(query)`: Searches entries in Easton's, Smith's, and Strong's Concordance.
*   `search_topics(query)`: Searches subjects and entries in Nave's Topical Index.
*   `get_biography(person_id)`: Details biographical summaries and social relationships (parentage, marriages, tribal lineage).
*   `get_chapter_map_data(book, chapter)`: Exposes geocoded coordinates for places mentioned in the chapter.
*   `list_geography_routes()`: Lists biblical historical journey routes.
*   `get_route_points(route_id)`: Lists sequential coordinates and places for a journey path.

