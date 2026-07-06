import sqlite3
import json
import urllib.request
import re
import sys
from concurrent.futures import ThreadPoolExecutor

DB_PATH = "rhelo.db"

BOOK_NORMALIZER = {
    "Genesis": "GEN", "Gen.": "GEN", "Gen": "GEN",
    "Exodus": "EXO", "Ex.": "EXO", "Ex": "EXO", "Exod.": "EXO", "Exod": "EXO",
    "Leviticus": "LEV", "Lev.": "LEV", "Lev": "LEV",
    "Numbers": "NUM", "Num.": "NUM", "Num": "NUM",
    "Deuteronomy": "DEU", "Deut.": "DEU", "Deut": "DEU",
    "Joshua": "JOS", "Josh.": "JOS", "Josh": "JOS",
    "Judges": "JDG", "Judg.": "JDG", "Judg": "JDG",
    "Ruth": "RUT",
    "1 Samuel": "1SA", "1 Sam.": "1SA", "1 Sam": "1SA", "1Sam.": "1SA", "1Sam": "1SA",
    "2 Samuel": "2SA", "2 Sam.": "2SA", "2 Sam": "2SA", "2Sam.": "2SA", "2Sam": "2SA",
    "1 Kings": "1KI", "1 Kings.": "1KI", "1 Ki.": "1KI", "1Ki.": "1KI", "1Ki": "1KI", "1Kgs.": "1KI", "1Kgs": "1KI",
    "2 Kings": "2KI", "2 Kings.": "2KI", "2 Ki.": "2KI", "2Ki.": "2KI", "2Ki": "2KI", "2Kgs.": "2KI", "2Kgs": "2KI",
    "1 Chronicles": "1CH", "1 Chr.": "1CH", "1 Chr": "1CH", "1Chr.": "1CH", "1Chr": "1CH",
    "2 Chronicles": "2CH", "2 Chr.": "2CH", "2 Chr": "2CH", "2Chr.": "2CH", "2Chr": "2CH",
    "Ezra": "EZR",
    "Nehemiah": "NEH", "Neh.": "NEH", "Neh": "NEH",
    "Esther": "EST", "Esth.": "EST", "Esth": "EST",
    "Job": "JOB",
    "Psalms": "PSA", "Ps.": "PSA", "Ps": "PSA", "Psa.": "PSA", "Psa": "PSA", "Psalm": "PSA",
    "Proverbs": "PRO", "Prov.": "PRO", "Prov": "PRO",
    "Ecclesiastes": "ECC", "Eccl.": "ECC", "Eccl": "ECC",
    "Song of Solomon": "SNG", "Song.": "SNG", "Song": "SNG",
    "Isaiah": "ISA", "Isa.": "ISA", "Isa": "ISA",
    "Jeremiah": "JER", "Jer.": "JER", "Jer": "JER",
    "Lamentations": "LAM", "Lam.": "LAM", "Lam": "LAM",
    "Ezekiel": "EZK", "Ezek.": "EZK", "Ezek": "EZK",
    "Daniel": "DAN", "Dan.": "DAN", "Dan": "DAN",
    "Hosea": "HOS", "Hos.": "HOS", "Hos": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obadiah": "OBD", "Obad.": "OBD", "Obad": "OBD",
    "Jonah": "JON",
    "Micah": "MIC", "Mic.": "MIC", "Mic": "MIC",
    "Nahum": "NAM", "Nah.": "NAM", "Nah": "NAM",
    "Habakkuk": "HAB", "Hab.": "HAB", "Hab": "HAB",
    "Zephaniah": "ZEP", "Zeph.": "ZEP", "Zeph": "ZEP",
    "Haggai": "HAG", "Hag.": "HAG", "Hag": "HAG",
    "Zechariah": "ZEC", "Zech.": "ZEC", "Zech": "ZEC",
    "Malachi": "MAL", "Mal.": "MAL", "Mal": "MAL",
    # NT
    "Matthew": "MAT", "Matt.": "MAT", "Matt": "MAT",
    "Mark": "MRK",
    "Luke": "LUK", "Luk.": "LUK", "Luk": "LUK",
    "John": "JHN", "Joh.": "JHN", "Joh": "JHN",
    "Acts": "ACT",
    "Romans": "ROM", "Rom.": "ROM", "Rom": "ROM",
    "1 Corinthians": "1CO", "1 Cor.": "1CO", "1 Cor": "1CO", "1Cor.": "1CO", "1Cor": "1CO",
    "2 Corinthians": "2CO", "2 Cor.": "2CO", "2 Cor": "2CO", "2Cor.": "2CO", "2Cor": "2CO",
    "Galatians": "GAL", "Gal.": "GAL", "Gal": "GAL",
    "Ephesians": "EPH", "Eph.": "EPH", "Eph": "EPH",
    "Philippians": "PHP", "Phil.": "PHP", "Phil": "PHP",
    "Colossians": "COL", "Col.": "COL", "Col": "COL",
    "1 Thessalonians": "1TH", "1 Thess.": "1TH", "1 Thess": "1TH", "1Thess.": "1TH", "1Thess": "1TH",
    "2 Thessalonians": "2TH", "2 Thess.": "2TH", "2 Thess": "2TH", "2Thess.": "2TH", "2Thess": "2TH",
    "1 Timothy": "1TI", "1 Tim.": "1TI", "1 Tim": "1TI", "1Tim.": "1TI", "1Tim": "1TI",
    "2 Timothy": "2TI", "2 Tim.": "2TI", "2 Tim": "2TI", "2Tim.": "2TI", "2Tim": "2TI",
    "Titus": "TIT", "Tit.": "TIT", "Tit": "TIT",
    "Philemon": "PHM", "Phlm.": "PHM", "Phlm": "PHM",
    "Hebrews": "HEB", "Heb.": "HEB", "Heb": "HEB",
    "James": "JAS", "Jas.": "JAS", "Jas": "JAS",
    "1 Peter": "1PE", "1 Pet.": "1PE", "1 Pet": "1PE", "1Pet.": "1PE", "1Pet": "1PE",
    "2 Peter": "2PE", "2 Pet.": "2PE", "2 Pet": "2PE", "2Pet.": "2PE", "2Pet": "2PE",
    "1 John": "1JN", "1 John.": "1JN", "1 Joh.": "1JN", "1 Joh": "1JN", "1Jn.": "1JN", "1Jn": "1JN",
    "2 John": "2JN", "2 John.": "2JN", "2 Joh.": "2JN", "2 Joh": "2JN", "2Jn.": "2JN", "2Jn": "2JN",
    "3 John": "3JN", "3 John.": "3JN", "3 Joh.": "3JN", "3 Joh": "3JN", "3Jn.": "3JN", "3Jn": "3JN",
    "Jude": "JUD",
    "Revelation": "REV", "Rev.": "REV", "Rev": "REV"
}

def parse_ref_to_id(ref_str):
    # Matches patterns like "2 Sam. 23:31" or "Genesis 1:1"
    m = re.match(r'^(.+?)\s+(\d+)[:\s]+(\d+)$', ref_str.strip())
    if m:
        book_name = m.group(1).strip()
        chap = m.group(2)
        verse = m.group(3)
        book_code = BOOK_NORMALIZER.get(book_name)
        if book_code:
            return f"{book_code}.{chap}.{verse}"
    return None

def fetch_json(letter):
    url = f"https://raw.githubusercontent.com/neuu-org/bible-dictionary-dataset/main/data/01_parsed/{letter}.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return letter, json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error downloading {letter}.json: {e}", file=sys.stderr)
        return letter, {}

def main():
    print("Fetching valid verse IDs from database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM verses")
    valid_verse_ids = {row[0] for row in cursor.fetchall()}
    
    # Initialize DB schema
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS dictionary_entries (
        slug TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sources TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dictionary_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_slug TEXT NOT NULL REFERENCES dictionary_entries(slug) ON DELETE CASCADE,
        source TEXT NOT NULL,
        definition_text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dictionary_scripture_refs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_slug TEXT NOT NULL REFERENCES dictionary_entries(slug) ON DELETE CASCADE,
        verse_id TEXT NOT NULL REFERENCES verses(id) ON DELETE CASCADE
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
        slug UNINDEXED,
        name,
        definition_text
    );
    """)
    conn.commit()
    conn.close()

    print("Downloading dictionary files (A-Z) in parallel...")
    letters = [chr(i) for i in range(ord('a'), ord('z') + 1)]
    dictionary_data = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        for letter, data in executor.map(fetch_json, letters):
            dictionary_data[letter] = data

    print("Parsing dictionary entries...")
    entries_to_insert = []
    definitions_to_insert = []
    refs_to_insert = []
    fts_to_insert = []
    seen_slugs = set()

    for letter, data in dictionary_data.items():
        if not data:
            continue
        for term_upper, term_obj in data.items():
            slug = term_obj.get("slug", term_upper.lower())
            name = term_obj.get("name", term_upper.title())
            sources_list = term_obj.get("sources", [])
            
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            
            entries_to_insert.append((slug, name, json.dumps(sources_list)))
            
            combined_def_text = []
            for definition in term_obj.get("definitions", []):
                source = definition.get("source", "UNKNOWN")
                text = definition.get("text", "").strip()
                if text:
                    definitions_to_insert.append((slug, source, text))
                    combined_def_text.append(text)
            
            # Map scripture references
            seen_refs = set()
            for ref_obj in term_obj.get("scripture_refs", []):
                ref_str = ref_obj.get("reference", "")
                verse_id = parse_ref_to_id(ref_str)
                if verse_id and verse_id in valid_verse_ids:
                    if verse_id not in seen_refs:
                        seen_refs.add(verse_id)
                        refs_to_insert.append((slug, verse_id))
            
            if combined_def_text:
                combined_def_text_str = "\n".join(combined_def_text)
                fts_to_insert.append((slug, name, combined_def_text_str))

    print(f"Parsed {len(entries_to_insert)} terms, {len(definitions_to_insert)} definitions, and {len(refs_to_insert)} verse links.")

    # Write to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Clear existing dictionary tables to support idempotency
        cursor.execute("DELETE FROM dictionary_entries")
        cursor.execute("DELETE FROM dictionary_definitions")
        cursor.execute("DELETE FROM dictionary_scripture_refs")
        cursor.execute("DELETE FROM dictionary_fts")
        
        print("Inserting entries...")
        cursor.executemany("""
        INSERT INTO dictionary_entries (slug, name, sources) VALUES (?, ?, ?)
        """, entries_to_insert)
        
        print("Inserting definitions...")
        cursor.executemany("""
        INSERT INTO dictionary_definitions (entry_slug, source, definition_text) VALUES (?, ?, ?)
        """, definitions_to_insert)
        
        print("Inserting scripture references...")
        cursor.executemany("""
        INSERT INTO dictionary_scripture_refs (entry_slug, verse_id) VALUES (?, ?)
        """, refs_to_insert)
        
        print("Populating dictionary_fts...")
        cursor.executemany("""
        INSERT INTO dictionary_fts (slug, name, definition_text) VALUES (?, ?, ?)
        """, fts_to_insert)
        
        conn.commit()
        print("Successfully committed dictionary database update.")
    except Exception as e:
        conn.rollback()
        print(f"Database insertion failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
