import sqlite3
import json
import urllib.request
import sys
from concurrent.futures import ThreadPoolExecutor

DB_PATH = "rhelo.db"

# KJV abbreviations for NT books
KJV_NT_ABBREV_MAP = {
    "mt": "MAT", "mk": "MRK", "lk": "LUK", "jo": "JHN", "act": "ACT",
    "rm": "ROM", "1co": "1CO", "2co": "2CO", "gl": "GAL", "eph": "EPH",
    "ph": "PHP", "cl": "COL", "1ts": "1TH", "2ts": "2TH", "1tm": "1TI",
    "2tm": "2TI", "tt": "TIT", "phm": "PHM", "hb": "HEB", "jm": "JAS",
    "1pe": "1PE", "2pe": "2PE", "1jo": "1JN", "2jo": "2JN", "3jo": "3JN",
    "jd": "JUD", "re": "REV"
}

def fetch_json(url, decode_sig=False):
    print(f"Downloading from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw_data = response.read()
            if decode_sig:
                text_data = raw_data.decode('utf-8-sig')
            else:
                text_data = raw_data.decode('utf-8')
            return json.loads(text_data)
    except Exception as e:
        print(f"Error downloading {url}: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    urls = {
        "kjv": ("https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json", True),
        "byz": ("https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/grc/Byz/Byz.json", False),
        "hi": ("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Hindi/bible.json", False),
        "ml": ("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Malayalam/bible.json", False),
        "ta": ("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Tamil/bible.json", False),
        "te": ("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Telugu/bible.json", False)
    }
    
    # Download datasets in parallel
    datasets = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_key = {executor.submit(fetch_json, url, decode_sig): key for key, (url, decode_sig) in urls.items()}
        for future in future_to_key:
            key = future_to_key[future]
            datasets[key] = future.result()
            
    print("All datasets downloaded. Setting up database...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Drop existing tables to ensure clean initialization
    cursor.executescript("""
    DROP TABLE IF EXISTS verses;
    DROP TABLE IF EXISTS search_en;
    
    CREATE TABLE verses (
        id TEXT PRIMARY KEY,
        book TEXT,
        chapter INTEGER,
        verse INTEGER,
        text_en TEXT,
        text_original TEXT,
        morphology JSON,
        text_hi TEXT,
        text_te TEXT,
        text_ml TEXT,
        text_ta TEXT
    ) WITHOUT ROWID;
    
    CREATE INDEX IF NOT EXISTS idx_book_chapter ON verses (book, chapter);
    
    CREATE VIRTUAL TABLE search_en USING fts5(
        id UNINDEXED,
        book UNINDEXED,
        chapter UNINDEXED,
        verse UNINDEXED,
        text_en
    );
    """)
    conn.commit()

    # Map Greek BYZ text by book_idx -> chapter -> verse
    greek_db = {}
    for book_idx in range(39, 66):
        book_obj = datasets["byz"]["books"][book_idx]
        greek_db[book_idx] = {}
        for chap_obj in book_obj.get("chapters", []):
            chap_num = int(chap_obj.get("chapter", 1))
            greek_db[book_idx][chap_num] = {}
            for verse_obj in chap_obj.get("verses", []):
                verse_num = int(verse_obj.get("verse", 1))
                text = verse_obj.get("text", "").strip()
                greek_db[book_idx][chap_num][verse_num] = text

    verses_records = []
    search_records = []

    print("Aligning New Testament verses...")
    # Loop through NT books (Matthew=39 to Revelation=65)
    for book_idx in range(39, 66):
        book_obj = datasets["kjv"][book_idx]
        abbrev = book_obj.get("abbrev")
        book_code = KJV_NT_ABBREV_MAP.get(abbrev)
        if not book_code:
            continue
            
        chapters = book_obj.get("chapters", [])
        for chap_idx, chapter_verses in enumerate(chapters):
            chap_num = chap_idx + 1
            for verse_idx, text_en in enumerate(chapter_verses):
                verse_num = verse_idx + 1
                verse_id = f"{book_code}.{chap_num}.{verse_num}"
                
                # Fetch Greek text
                text_original = greek_db.get(book_idx, {}).get(chap_num, {}).get(verse_num, "").strip()
                
                # Fetch Indic texts
                text_hi, text_te, text_ml, text_ta = "", "", "", ""
                try:
                    indic_book_obj = datasets["hi"]["Book"][book_idx]
                    indic_chap_obj = indic_book_obj["Chapter"][chap_idx]
                    text_hi = indic_chap_obj["Verse"][verse_idx]["Verse"].strip()
                except IndexError:
                    pass
                    
                try:
                    indic_book_obj = datasets["te"]["Book"][book_idx]
                    indic_chap_obj = indic_book_obj["Chapter"][chap_idx]
                    text_te = indic_chap_obj["Verse"][verse_idx]["Verse"].strip()
                except IndexError:
                    pass
                    
                try:
                    indic_book_obj = datasets["ml"]["Book"][book_idx]
                    indic_chap_obj = indic_book_obj["Chapter"][chap_idx]
                    text_ml = indic_chap_obj["Verse"][verse_idx]["Verse"].strip()
                except IndexError:
                    pass
                    
                try:
                    indic_book_obj = datasets["ta"]["Book"][book_idx]
                    indic_chap_obj = indic_book_obj["Chapter"][chap_idx]
                    text_ta = indic_chap_obj["Verse"][verse_idx]["Verse"].strip()
                except IndexError:
                    pass
                
                # Ingest morphology as empty list for NT initialization (SBLGNT morph is added in subsequent steps)
                morphology_json = "[]"
                
                verses_records.append((
                    verse_id, book_code, chap_num, verse_num,
                    text_en, text_original, morphology_json,
                    text_hi, text_te, text_ml, text_ta
                ))
                
                search_records.append((
                    verse_id, book_code, chap_num, verse_num, text_en
                ))
                
    print(f"NT Alignment completed. Total NT verses prepared: {len(verses_records)}")
    
    try:
        print("Inserting records into 'verses' table...")
        cursor.executemany("""
        INSERT INTO verses (
            id, book, chapter, verse, text_en, text_original, morphology,
            text_hi, text_te, text_ml, text_ta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, verses_records)
        
        print("Inserting records into 'search_en' FTS table...")
        cursor.executemany("""
        INSERT INTO search_en (id, book, chapter, verse, text_en)
        VALUES (?, ?, ?, ?, ?)
        """, search_records)
        
        conn.commit()
        print(f"Successfully committed {len(verses_records)} New Testament verses to database.")
    except Exception as e:
        conn.rollback()
        print(f"Database transaction error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
