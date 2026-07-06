#!/bin/bash
set -e

echo "=== Rhelo Study Engine Setup Script ==="

# 1. Setup python virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

echo "Installing package dependencies..."
./.venv/bin/pip install -r requirements.txt

# 2. Run sequential migrations to build rhelo.db from scratch
echo "Building the Rhelo database (rhelo.db) by running migrations sequentially..."

echo "[0/12] Running New Testament & schema setup..."
./.venv/bin/python3 migrations/000_setup_new_testament.py

echo "[1/12] Ingesting geography and spatial mapping..."
./.venv/bin/python3 migrations/001_add_geography.py

echo "[2/12] Ingesting Strong's Lexicon root definitions..."
./.venv/bin/python3 migrations/002_add_strongs_lexicon.py

echo "[3/12] Ingesting historical commentaries..."
./.venv/bin/python3 migrations/003_add_commentaries.py

echo "[4/12] Ingesting chronological timeline event records..."
./.venv/bin/python3 migrations/004_add_timeline.py

echo "[5/12] Expanding database to include the Old Testament..."
./.venv/bin/python3 migrations/005_add_old_testament.py

echo "[6/12] Generating complete Bible cross-references..."
./.venv/bin/python3 migrations/006_update_cross_references.py

echo "[7/12] Ingesting Easton's and Smith's Bible Dictionaries..."
./.venv/bin/python3 migrations/007_add_dictionary.py

echo "[8/12] Ingesting biblical genealogy and relationships..."
./.venv/bin/python3 migrations/008_add_genealogy.py

echo "[9/12] Ingesting Nave's Topical Index and name etymologies..."
./.venv/bin/python3 migrations/009_add_naves_and_hitchcocks.py

echo "[10/12] Normalizing multilingual translations..."
./.venv/bin/python3 migrations/010_normalize_translations.py

echo "[11/12] Creating study sessions and search indexes..."
./.venv/bin/python3 migrations/011_sessions_schema.py

echo "[12/12] Adding BSB, WEB, and KJV English translations..."
./.venv/bin/python3 migrations/012_add_english_translations.py

echo "=== Setup Completed! Database is fully populated. ==="
echo "To test the MCP server, run:"
echo "  npx @modelcontextprotocol/inspector ./.venv/bin/python3 server.py"
echo "To run the server in production, run:"
echo "  ./.venv/bin/python3 server.py"
