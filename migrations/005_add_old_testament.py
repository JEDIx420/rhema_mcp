import sqlite3
import json
import urllib.request
import sys
from concurrent.futures import ThreadPoolExecutor

DB_PATH = "rhelo.db"

# KJV abbreviations from en_kjv.json mapped to standard 3-letter codes
KJV_ABBREV_MAP = {
    "gn": "GEN", "ex": "EXO", "lv": "LEV", "nm": "NUM", "dt": "DEU",
    "js": "JOS", "jud": "JDG", "rt": "RUT", "1sm": "1SA", "2sm": "2SA",
    "1kgs": "1KI", "2kgs": "2KI", "1ch": "1CH", "2ch": "2CH", "ezr": "EZR",
    "ne": "NEH", "et": "EST", "job": "JOB", "ps": "PSA", "prv": "PRO",
    "ec": "ECC", "so": "SNG", "is": "ISA", "jr": "JER", "lm": "LAM",
    "ez": "EZK", "dn": "DAN", "ho": "HOS", "jl": "JOL", "am": "AMO",
    "ob": "OBD", "jn": "JON", "mi": "MIC", "na": "NAM", "hk": "HAB",
    "zp": "ZEP", "hg": "HAG", "zc": "ZEC", "ml": "MAL"
}

# WLC book names mapped to standard 3-letter codes
WLC_BOOK_MAP = {
    'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
    'Joshua': 'JOS', 'Judges': 'JDG', 'I Samuel': '1SA', 'II Samuel': '2SA', 'I Kings': '1KI', 'II Kings': '2KI',
    'Isaiah': 'ISA', 'Jeremiah': 'JER', 'Ezekiel': 'EZK', 'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO',
    'Obadiah': 'OBD', 'Jonah': 'JON', 'Micah': 'MIC', 'Nahum': 'NAM', 'Habakkuk': 'HAB', 'Zephaniah': 'ZEP',
    'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL', 'I Chronicles': '1CH', 'II Chronicles': '2CH',
    'Psalms': 'PSA', 'Job': 'JOB', 'Proverbs': 'PRO', 'Ruth': 'RUT', 'Song of Solomon': 'SNG',
    'Ecclesiastes': 'ECC', 'Lamentations': 'LAM', 'Esther': 'EST', 'Daniel': 'DAN', 'Ezra': 'EZR', 'Nehemiah': 'NEH'
}

# Ordered list of the 39 Old Testament books (by standard 3-letter codes)
OT_BOOKS = [
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
    "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
    "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
    "OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"
]

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
        "wlc": ("https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/hbo/WLC/WLC.json", False),
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
            
    print("All datasets downloaded. Starting alignment...")
    
    # Map Hebrew WLC text by book -> chapter -> verse
    hebrew_db = {}
    for book_obj in datasets["wlc"].get("books", []):
        book_name = book_obj.get("name")
        book_code = WLC_BOOK_MAP.get(book_name)
        if not book_code:
            continue
            
        hebrew_db[book_code] = {}
        for chap_obj in book_obj.get("chapters", []):
            chap_num = int(chap_obj.get("chapter", 1))
            hebrew_db[book_code][chap_num] = {}
            for verse_obj in chap_obj.get("verses", []):
                verse_num = int(verse_obj.get("verse", 1))
                text = verse_obj.get("text", "").strip()
                hebrew_db[book_code][chap_num][verse_num] = text
                
    # Prepare lists of rows to insert
    verses_records = []
    search_records = []
    
    # Loop through the 39 OT books in the KJV JSON
    for book_idx, book_obj in enumerate(datasets["kjv"]):
        abbrev = book_obj.get("abbrev")
        book_code = KJV_ABBREV_MAP.get(abbrev)
        
        # Ingest only the 39 Old Testament books
        if not book_code or book_code not in OT_BOOKS:
            continue
            
        chapters = book_obj.get("chapters", [])
        print(f"Processing book {book_code} ({len(chapters)} chapters)...")
        
        for chap_idx, chapter_verses in enumerate(chapters):
            chap_num = chap_idx + 1
            for verse_idx, text_en in enumerate(chapter_verses):
                verse_num = verse_idx + 1
                verse_id = f"{book_code}.{chap_num}.{verse_num}"
                
                # Fetch Hebrew text
                text_original = hebrew_db.get(book_code, {}).get(chap_num, {}).get(verse_num, "").strip()
                
                # Fetch Indic texts using indices
                text_hi, text_te, text_ml, text_ta = "", "", "", ""
                try:
                    # Index in Indic files: book_idx corresponds directly to the book index in godlytalias/Bible-Database
                    # (verified Genesis=0, Malachi=38, Matthew=39, Revelation=65)
                    # We check array bounds to prevent out-of-range errors
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
                
                # Ingest morphology as empty list for OT (since it's Hebrew)
                morphology_json = "[]"
                
                verses_records.append((
                    verse_id, book_code, chap_num, verse_num,
                    text_en, text_original, morphology_json,
                    text_hi, text_te, text_ml, text_ta
                ))
                
                search_records.append((
                    verse_id, book_code, chap_num, verse_num, text_en
                ))
                
    print(f"Alignment completed. Total OT verses prepared: {len(verses_records)}")
    
    # Insert records into database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Delete existing OT verses in verses and search_en to allow safe re-runs
        for book_code in OT_BOOKS:
            cursor.execute("DELETE FROM verses WHERE book = ?", (book_code,))
            cursor.execute("DELETE FROM search_en WHERE book = ?", (book_code,))
            
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
        print(f"Successfully committed {len(verses_records)} Old Testament verses to database.")
    except Exception as e:
        conn.rollback()
        print(f"Database transaction error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
