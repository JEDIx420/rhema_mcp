import sqlite3
import json
import urllib.request
import re
import sys

DB_PATH = "rhema.db"

BOOK_MAP = {
    "Matt": "MAT", "Matthew": "MAT",
    "Mark": "MRK",
    "Luke": "LUK",
    "John": "JHN",
    "Acts": "ACT",
    "Rom": "ROM", "Romans": "ROM",
    "1Cor": "1CO", "1Corinthians": "1CO",
    "2Cor": "2CO", "2Corinthians": "2CO",
    "Gal": "GAL", "Galatians": "GAL",
    "Eph": "EPH", "Ephesians": "EPH",
    "Phil": "PHP", "Philippians": "PHP",
    "Col": "COL", "Colossians": "COL",
    "1Thess": "1TH", "1Thessalonians": "1TH",
    "2Thess": "2TH", "2Thessalonians": "2TH",
    "1Tim": "1TI", "1Timothy": "1TI",
    "2Tim": "2TI", "2Timothy": "2TI",
    "Titus": "TIT",
    "Phlm": "PHM", "Philemon": "PHM",
    "Heb": "HEB", "Hebrews": "HEB",
    "Jas": "JAS", "James": "JAS",
    "1Pet": "1PE", "1Peter": "1PE",
    "2Pet": "2PE", "2Peter": "2PE",
    "1John": "1JN",
    "2John": "2JN",
    "3John": "3JN",
    "Jude": "JUD",
    "Rev": "REV", "Revelation": "REV"
}

def parse_scripture_range(ref_str, valid_verse_ids):
    ref_str = ref_str.strip()
    sub_refs = ref_str.split(";")
    linked_verses = []
    
    for sub_ref in sub_refs:
        sub_ref = sub_ref.strip()
        
        # Match e.g., "Luke 2:1-20" or "Luke 2:1"
        m = re.match(r'^([1-3]?\s*[A-Za-z]+)\s+(\d+):(\d+)(?:\s*[\–\-]\s*(\d+))?', sub_ref)
        if not m:
            # Match chapter-only reference, e.g. "Matthew 2"
            m2 = re.match(r'^([1-3]?\s*[A-Za-z]+)\s+(\d+)$', sub_ref)
            if m2:
                b_name = m2.group(1).replace(" ", "")
                mapped_book = BOOK_MAP.get(b_name)
                if mapped_book:
                    chap = int(m2.group(2))
                    for v_id in valid_verse_ids:
                        if v_id.startswith(f"{mapped_book}.{chap}."):
                            linked_verses.append(v_id)
            continue
            
        b_name = m.group(1).replace(" ", "")
        mapped_book = BOOK_MAP.get(b_name)
        if not mapped_book:
            continue
            
        chap = int(m.group(2))
        start_v = int(m.group(3))
        end_v = int(m.group(4)) if m.group(4) else start_v
        
        for v in range(start_v, end_v + 1):
            v_id = f"{mapped_book}.{chap}.{v}"
            if v_id in valid_verse_ids:
                linked_verses.append(v_id)
                
    return linked_verses

def setup_schema(cursor):
    print("Setting up timeline tables...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS timeline_events (
        event_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        year INTEGER,
        location TEXT,
        description TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS event_verses (
        event_id TEXT,
        verse_id TEXT,
        PRIMARY KEY(event_id, verse_id),
        FOREIGN KEY(event_id) REFERENCES timeline_events(event_id),
        FOREIGN KEY(verse_id) REFERENCES verses(id)
    );
    """)

def fetch_events(url):
    print(f"Fetching timeline era from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching era: {e}", file=sys.stderr)
        return None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    setup_schema(cursor)
    
    # Fetch valid verses
    cursor.execute("SELECT id FROM verses")
    valid_verse_ids = {row[0] for row in cursor.fetchall()}
    
    era_urls = [
        "https://raw.githubusercontent.com/theonize/timeline/main/src/data/eras/09-life-of-christ.json",
        "https://raw.githubusercontent.com/theonize/timeline/main/src/data/eras/10-early-church.json"
    ]
    
    all_events = []
    all_links = []
    
    for url in era_urls:
        era_data = fetch_events(url)
        if era_data:
            events = era_data.get("events", [])
            for entry in events:
                event_id = entry.get("id")
                title = entry.get("title")
                year = entry.get("year")
                location = entry.get("location")
                description = entry.get("description")
                scripture = entry.get("scripture", "")
                
                if not event_id or not title:
                    continue
                    
                all_events.append((event_id, title, year, location, description))
                
                # Parse and collect links
                if scripture:
                    linked_v = parse_scripture_range(scripture, valid_verse_ids)
                    for v_id in linked_v:
                        all_links.append((event_id, v_id))
                        
    print(f"Parsed {len(all_events)} events and {len(all_links)} verse links. Inserting into database...")
    
    try:
        cursor.execute("DELETE FROM timeline_events")
        cursor.execute("DELETE FROM event_verses")
        
        cursor.executemany("""
        INSERT OR REPLACE INTO timeline_events (event_id, title, year, location, description)
        VALUES (?, ?, ?, ?, ?)
        """, all_events)
        
        cursor.executemany("""
        INSERT OR IGNORE INTO event_verses (event_id, verse_id)
        VALUES (?, ?)
        """, all_links)
        
        conn.commit()
        print(f"Successfully populated {len(all_events)} timeline events and {len(all_links)} verse connections.")
    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
