import sqlite3
import csv
import urllib.request
import re
import io
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
    "1 Samuel": "1SA", "1 Sam.": "1SA", "1 Sam": "1SA", "1Sam.": "1SA", "1Sam": "1SA", "1SA": "1SA",
    "2 Samuel": "2SA", "2 Sam.": "2SA", "2 Sam": "2SA", "2Sam.": "2SA", "2Sam": "2SA", "2SA": "2SA",
    "1 Kings": "1KI", "1 Kings.": "1KI", "1 Ki.": "1KI", "1Ki.": "1KI", "1Ki": "1KI", "1Kgs.": "1KI", "1Kgs": "1KI", "1KI": "1KI",
    "2 Kings": "2KI", "2 Kings.": "2KI", "2 Ki.": "2KI", "2Ki.": "2KI", "2Ki": "2KI", "2Kgs.": "2KI", "2Kgs": "2KI", "2KI": "2KI",
    "1 Chronicles": "1CH", "1 Chr.": "1CH", "1 Chr": "1CH", "1Chr.": "1CH", "1Chr": "1CH", "1CH": "1CH",
    "2 Chronicles": "2CH", "2 Chr.": "2CH", "2 Chr": "2CH", "2Chr.": "2CH", "2Chr": "2CH", "2CH": "2CH",
    "Ezra": "EZR",
    "Nehemiah": "NEH", "Neh.": "NEH", "Neh": "NEH",
    "Esther": "EST", "Esth.": "EST", "Esth": "EST",
    "Job": "JOB",
    "Psalms": "PSA", "Ps.": "PSA", "Ps": "PSA", "Psa.": "PSA", "Psa": "PSA", "Psalm": "PSA", "PSA": "PSA",
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

def normalize_csv_ref(ref_str):
    m = re.match(r'^(.+?)\s+(\d+)[:\s]+(\d+)$', ref_str.strip())
    if m:
        book_name = m.group(1).strip()
        chap = m.group(2)
        verse = m.group(3)
        book_code = BOOK_NORMALIZER.get(book_name)
        if not book_code:
            if len(book_name) == 3 and book_name.isupper():
                book_code = book_name
            elif book_name.upper() in BOOK_NORMALIZER:
                book_code = BOOK_NORMALIZER[book_name.upper()]
            else:
                book_code = book_name.upper()
        return f"{book_code}.{chap}.{verse}"
    return None

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
    print("Fetching valid verse IDs from database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM verses")
    valid_verse_ids = {row[0] for row in cursor.fetchall()}
    
    # Initialize DB schema
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sex TEXT,
        tribe TEXT,
        unique_attribute TEXT,
        notes TEXT
    );
    CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        person_id_1 TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL,
        person_id_2 TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        verse_id TEXT REFERENCES verses(id) ON DELETE SET NULL,
        notes TEXT
    );
    CREATE TABLE IF NOT EXISTS people_verses (
        person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        verse_id TEXT NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
        PRIMARY KEY (person_id, verse_id)
    );
    """)
    conn.commit()
    conn.close()

    urls = {
        "person": "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/BibleData-Person.csv",
        "relationship": "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/BibleData-PersonRelationship.csv",
        "person_verse": "https://raw.githubusercontent.com/BradyStephenson/bible-data/main/BibleData-PersonVerse.csv"
    }

    # Fetch CSVs
    csv_data = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_key = {executor.submit(fetch_csv, url): key for key, url in urls.items()}
        for future in future_to_key:
            key = future_to_key[future]
            csv_data[key] = future.result()

    print("Parsing people...")
    people_records = []
    # Read CSV
    f = io.StringIO(csv_data["person"])
    reader = csv.DictReader(f)
    for row in reader:
        person_id = row.get("person_id")
        name = row.get("person_name")
        sex = row.get("sex")
        tribe = row.get("tribe")
        attrib = row.get("unique_attribute")
        notes = row.get("person_notes")
        if person_id and name:
            people_records.append((person_id, name, sex, tribe, attrib, notes))

    print("Parsing relationships...")
    relationship_records = []
    f = io.StringIO(csv_data["relationship"])
    reader = csv.DictReader(f)
    for row in reader:
        rel_id = row.get("person_relationship_id")
        p1 = row.get("person_id_1")
        rel_type = row.get("relationship_type")
        p2 = row.get("person_id_2")
        ref_id = row.get("reference_id")
        notes = row.get("relationship_notes")
        
        verse_id = None
        if ref_id:
            verse_id = normalize_csv_ref(ref_id)
            if verse_id not in valid_verse_ids:
                verse_id = None
                
        if rel_id and p1 and rel_type and p2:
            relationship_records.append((rel_id, p1, rel_type, p2, verse_id, notes))

    print("Parsing people to verse mappings...")
    people_verse_records = set()
    f = io.StringIO(csv_data["person_verse"])
    reader = csv.DictReader(f)
    for row in reader:
        person_id = row.get("person_id")
        ref_id = row.get("reference_id")
        if person_id and ref_id:
            verse_id = normalize_csv_ref(ref_id)
            if verse_id and verse_id in valid_verse_ids:
                people_verse_records.add((person_id, verse_id))

    print(f"Parsed {len(people_records)} people, {len(relationship_records)} relationships, and {len(people_verse_records)} verse mappings.")

    # Write to DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Clear existing tables to support idempotency
        cursor.execute("DELETE FROM people")
        cursor.execute("DELETE FROM relationships")
        cursor.execute("DELETE FROM people_verses")
        
        print("Inserting people...")
        cursor.executemany("""
        INSERT INTO people (id, name, sex, tribe, unique_attribute, notes) VALUES (?, ?, ?, ?, ?, ?)
        """, people_records)
        
        print("Inserting relationships...")
        cursor.executemany("""
        INSERT INTO relationships (id, person_id_1, relationship_type, person_id_2, verse_id, notes) VALUES (?, ?, ?, ?, ?, ?)
        """, relationship_records)
        
        print("Inserting people_verses...")
        cursor.executemany("""
        INSERT INTO people_verses (person_id, verse_id) VALUES (?, ?)
        """, list(people_verse_records))
        
        conn.commit()
        print("Successfully committed genealogy database update.")
    except Exception as e:
        conn.rollback()
        print(f"Database insertion failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
