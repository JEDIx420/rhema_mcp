import sqlite3
import csv
import urllib.request
import io
import sys
from concurrent.futures import ThreadPoolExecutor

DB_PATH = "rhelo.db"

def fetch_csv(url):
    print(f"Downloading {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read().decode('utf-8-sig')
    except Exception as e:
        print(f"Error downloading {url}: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    # Initialize DB schema
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS bible_names_dictionary (
        name TEXT PRIMARY KEY,
        meaning TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS naves_topical_dictionary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        entry TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS naves_fts USING fts5(
        subject,
        entry
    );
    """)
    conn.commit()
    conn.close()

    urls = {
        "hitchcocks": "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/HitchcocksBibleNamesDictionary.csv",
        "naves": "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/NavesTopicalDictionary.csv"
    }

    # Fetch CSVs
    csv_data = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_to_key = {executor.submit(fetch_csv, url): key for key, url in urls.items()}
        for future in future_to_key:
            key = future_to_key[future]
            csv_data[key] = future.result()

    print("Parsing Hitchcock's Bible Names Dictionary...")
    hitchcocks_records = []
    f = io.StringIO(csv_data["hitchcocks"])
    reader = csv.DictReader(f)
    seen_names = set()
    for row in reader:
        name = row.get("Name", "").strip()
        meaning = row.get("Meaning", "").strip()
        if name and meaning:
            name_lower = name.lower()
            if name_lower not in seen_names:
                seen_names.add(name_lower)
                hitchcocks_records.append((name, meaning))

    print("Parsing Nave's Topical Dictionary...")
    naves_records = []
    naves_fts_records = []
    f = io.StringIO(csv_data["naves"])
    reader = csv.DictReader(f)
    for row in reader:
        subject = row.get("subject", "").strip()
        entry = row.get("entry", "").strip()
        if subject and entry:
            naves_records.append((subject, entry))
            naves_fts_records.append((subject, entry))

    print(f"Parsed {len(hitchcocks_records)} name meanings and {len(naves_records)} topical entries.")

    # Write to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Clear existing tables for idempotency
        cursor.execute("DELETE FROM bible_names_dictionary")
        cursor.execute("DELETE FROM naves_topical_dictionary")
        cursor.execute("DELETE FROM naves_fts")
        
        print("Inserting Hitchcock's names...")
        cursor.executemany("""
        INSERT INTO bible_names_dictionary (name, meaning) VALUES (?, ?)
        """, hitchcocks_records)
        
        print("Inserting Nave's topics...")
        cursor.executemany("""
        INSERT INTO naves_topical_dictionary (subject, entry) VALUES (?, ?)
        """, naves_records)
        
        print("Populating naves_fts...")
        cursor.executemany("""
        INSERT INTO naves_fts (subject, entry) VALUES (?, ?)
        """, naves_fts_records)
        
        conn.commit()
        print("Successfully committed Nave's and Hitchcock's database updates.")
    except Exception as e:
        conn.rollback()
        print(f"Database insertion failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
