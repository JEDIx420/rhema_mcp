import sqlite3
import json
import urllib.request
import sys

DB_PATH = "rhema.db"

OSIS_TO_RHEMA = {
    "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
    "Acts": "ACT", "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO",
    "Gal": "GAL", "Eph": "EPH", "Phil": "PHP", "Col": "COL",
    "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI", "2Tim": "2TI",
    "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB", "Jas": "JAS",
    "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN", "2John": "2JN",
    "3John": "3JN", "Jude": "JUD", "Rev": "REV"
}

def setup_schema(cursor):
    print("Setting up geography tables...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geography_places (
        place_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        longitude REAL,
        latitude REAL,
        url_slug TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS verse_geography (
        verse_id TEXT,
        place_id TEXT,
        FOREIGN KEY(verse_id) REFERENCES verses(id),
        FOREIGN KEY(place_id) REFERENCES geography_places(place_id),
        PRIMARY KEY(verse_id, place_id)
    );
    """)

def get_valid_verse_ids(cursor):
    cursor.execute("SELECT id FROM verses")
    return {row[0] for row in cursor.fetchall()}

def ingest_modern_places(cursor):
    url = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/modern.jsonl"
    print(f"Fetching modern places from {url}...")
    
    count = 0
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        for line_bytes in response:
            line = line_bytes.decode('utf-8').strip()
            if not line:
                continue
            
            try:
                obj = json.loads(line)
                place_id = obj.get("id")
                name = obj.get("friendly_id") or obj.get("names", [None])[0]
                place_type = obj.get("type")
                url_slug = obj.get("url_slug")
                lonlat = obj.get("lonlat")
                
                if not place_id or not name:
                    continue
                
                longitude, latitude = None, None
                if lonlat and "," in lonlat:
                    parts = lonlat.split(",")
                    longitude = float(parts[0])
                    latitude = float(parts[1])
                
                cursor.execute("""
                INSERT OR REPLACE INTO geography_places (place_id, name, type, longitude, latitude, url_slug)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (place_id, name, place_type, longitude, latitude, url_slug))
                count += 1
            except Exception as e:
                print(f"Error parsing modern line: {e}", file=sys.stderr)
                
    print(f"Successfully ingested {count} modern places.")

def ingest_ancient_places(cursor, valid_verse_ids):
    url = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl"
    print(f"Fetching ancient places from {url}...")
    
    place_count = 0
    link_count = 0
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        for line_bytes in response:
            line = line_bytes.decode('utf-8').strip()
            if not line:
                continue
            
            try:
                obj = json.loads(line)
                place_id = obj.get("id")
                name = obj.get("friendly_id")
                place_types = obj.get("types", [])
                place_type = place_types[0] if place_types else None
                url_slug = obj.get("url_slug")
                
                if not place_id or not name:
                    continue
                
                # Extract coordinates from identifications/resolutions
                longitude, latitude = None, None
                identifications = obj.get("identifications", [])
                if identifications:
                    # Look at resolutions in the first identification
                    resolutions = identifications[0].get("resolutions", [])
                    if resolutions:
                        lonlat = resolutions[0].get("lonlat")
                        if lonlat and "," in lonlat:
                            parts = lonlat.split(",")
                            longitude = float(parts[0])
                            latitude = float(parts[1])
                
                # Insert the ancient place
                cursor.execute("""
                INSERT OR REPLACE INTO geography_places (place_id, name, type, longitude, latitude, url_slug)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (place_id, name, place_type, longitude, latitude, url_slug))
                place_count += 1
                
                # Insert links to New Testament verses
                verses = obj.get("verses", [])
                for v in verses:
                    osis = v.get("osis")
                    if osis and "." in osis:
                        parts = osis.split(".")
                        book_osis = parts[0]
                        if book_osis in OSIS_TO_RHEMA:
                            rhema_book = OSIS_TO_RHEMA[book_osis]
                            chap = parts[1]
                            verse_num = parts[2]
                            verse_id = f"{rhema_book}.{chap}.{verse_num}"
                            
                            if verse_id in valid_verse_ids:
                                cursor.execute("""
                                INSERT OR IGNORE INTO verse_geography (verse_id, place_id)
                                VALUES (?, ?)
                                """, (verse_id, place_id))
                                link_count += 1
            except Exception as e:
                print(f"Error parsing ancient line: {e}", file=sys.stderr)
                
    print(f"Successfully ingested {place_count} ancient places and mapped {link_count} verse-geography connections.")

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        setup_schema(cursor)
        valid_verse_ids = get_valid_verse_ids(cursor)
        print(f"Found {len(valid_verse_ids)} valid verses in database.")
        
        ingest_modern_places(cursor)
        ingest_ancient_places(cursor, valid_verse_ids)
        
        conn.commit()
        print("Database transaction committed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Transaction rolled back due to error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
