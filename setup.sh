#!/bin/bash
set -e

echo "=== Rhelo Study Engine Setup Script ==="

# Run the standard-library migration scripts to build rhelo.db from scratch.
echo "Building the Rhelo database (rhelo.db) by running migrations sequentially..."

echo "[0/12] Running New Testament & schema setup..."
python3 migrations/000_setup_new_testament.py

echo "[1/12] Ingesting geography and spatial mapping..."
python3 migrations/001_add_geography.py

echo "[2/12] Ingesting Strong's Lexicon root definitions..."
python3 migrations/002_add_strongs_lexicon.py

echo "[3/12] Ingesting historical commentaries..."
python3 migrations/003_add_commentaries.py

echo "[4/12] Ingesting chronological timeline event records..."
python3 migrations/004_add_timeline.py

echo "[5/12] Expanding database to include the Old Testament..."
python3 migrations/005_add_old_testament.py

echo "[6/12] Generating complete Bible cross-references..."
python3 migrations/006_update_cross_references.py

echo "[7/12] Ingesting Easton's and Smith's Bible Dictionaries..."
python3 migrations/007_add_dictionary.py

echo "[8/12] Ingesting biblical genealogy and relationships..."
python3 migrations/008_add_genealogy.py

echo "[9/12] Ingesting Nave's Topical Index and name etymologies..."
python3 migrations/009_add_naves_and_hitchcocks.py

echo "[10/12] Normalizing multilingual translations..."
python3 migrations/010_normalize_translations.py

echo "[11/12] Creating study sessions and search indexes..."
python3 migrations/011_sessions_schema.py

echo "[12/12] Adding BSB, WEB, and KJV English translations..."
python3 migrations/012_add_english_translations.py

echo "Finalizing the seed database schema version..."
python3 scripts/finalize_seed_database.py

echo "=== Setup Completed! Database is fully populated. ==="
echo "Run the native app with: cd frontend && npm run tauri dev"
