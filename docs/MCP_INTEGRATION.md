# Rhema Model Context Protocol (MCP) Integration

This document describes how to configure and integrate the Python-based FastMCP server with desktop clients (Tauri) or terminal/editor agents.

---

## ⚙️ Configuration & Execution

To run the MCP server locally within the Python virtual environment:
```bash
./.venv/bin/python3 server.py
```

### Server Dependencies
Listed in `requirements.txt`:
*   `mcp>=1.28.1` (includes `FastMCP`)
*   `sqlite3` (built-in)

---

## 🛠️ Exposed MCP Tools

The server registers the following tools for the LLM client:

### 1. `search_scriptures`
*   **Description**: Search the English Bible text using FTS5.
*   **Arguments**:
    *   `query` (string, required): The search string or keyword.
    *   `book` (string, optional): A 3-letter uppercase book code (e.g. `GEN`, `MAT`) to restrict results.
*   **Returns**: A newline-separated list of matches: `[VERSE_ID] Verse text`.

### 2. `get_verse_details`
*   **Description**: Retrieve comprehensive exegesis details for a specific verse.
*   **Arguments**:
    *   `verse_id` (string, required): The uppercase verse ID (e.g. `GEN.1.1`).
*   **Returns**: All translations (English, Hebrew/Greek, Hindi, Telugu, Malayalam, Tamil), associated commentaries, geocoded places, chronological events, and top cross-references.

### 3. `search_dictionary_and_lexicon`
*   **Description**: Search Easton's + Smith's dictionaries and Strong's Greek/Hebrew concordances.
*   **Arguments**:
    *   `query` (string, required): The lexical search query.
*   **Returns**: Matching dictionary entries (with definitions) and lexicon lemmas.

### 4. `search_topics`
*   **Description**: Search Nave's Topical Index.
*   **Arguments**:
    *   `query` (string, required): The topic keyword.
*   **Returns**: Matches showing topics and their scripture reference strings.

### 5. `get_biography`
*   **Description**: Retrieve biographical info and family relationships for a person.
*   **Arguments**:
    *   `person_id` (string, required): The person ID (e.g. `Adam_1` or name like `David`).
*   **Returns**: Biographical notes, Hitchcock name meanings, and all parsed relationships.

### 6. `get_chapter_map_data`
*   **Description**: Get geographical coordinates mentioned in a chapter.
*   **Arguments**:
    *   `book` (string, required): 3-letter uppercase book code.
    *   `chapter` (integer, required): Chapter number.
*   **Returns**: List of locations with latitudes/longitudes and the verses referencing them.

### 7. `list_geography_routes`
*   **Description**: Retrieve the list of sequential biblical journeys (e.g. Abraham's Journey, Exodus Journey).
*   **Arguments**: None.
*   **Returns**: List of routes containing `route_id`, `title`, and `description`.

### 8. `get_route_points`
*   **Description**: Retrieve sequential coordinates for a specific biblical route path.
*   **Arguments**:
    *   `route_id` (string, required): The journey route ID.
*   **Returns**: List of points ordered by `sequence_order` containing latitude, longitude, and description.
