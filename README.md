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

## 🎨 Next.js 15 Web Application

Rhema includes a highly polished, responsive frontend built with **Next.js 15** and **Tailwind CSS v4**, utilizing the premium "Zenrev" design system aesthetic.

### Features
* **Reading Desk**: An advanced scripture reader supporting side-by-side English and original (Hebrew/Greek) interlinear translation. Click any original word to instantly view Strong's definitions and exhaustive occurrences.
* **Study Pane (Exegesis Drawer)**: A unified, multi-tab exegesis engine providing instant access to:
  * **Lexicon**: Strong's Concordance definitions and cross-chapter verse occurrences.
  * **Commentary**: Treasury of Scriptural Knowledge and classic commentaries.
  * **Geography**: Interactive Leaflet maps detailing geocoded locations mentioned in the verse.
  * **Timeline**: Historical timeline milestones.
  * **Cross-References**: Deep-linked scriptural cross-references.
* **Split-Pane Search Center**: Lightning-fast FTS5 full-text search across all Testaments with an embedded right-side Study Pane for immediate verse analysis without losing search context.

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
