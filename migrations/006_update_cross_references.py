import sqlite3
import urllib.request
import zipfile
import io
import sys

DB_PATH = "rhema.db"

OPENBIBLE_TO_RHEMA = {
    "Gen": "GEN", "Exod": "EXO", "Lev": "LEV", "Num": "NUM", "Deut": "DEU",
    "Josh": "JOS", "Judg": "JDG", "Ruth": "RUT", "1Sam": "1SA", "2Sam": "2SA",
    "1Kgs": "1KI", "2Kgs": "2KI", "1Chr": "1CH", "2Chr": "2CH", "Ezra": "EZR",
    "Neh": "NEH", "Esth": "EST", "Job": "JOB", "Ps": "PSA", "Prov": "PRO",
    "Eccl": "ECC", "Song": "SNG", "Isa": "ISA", "Jer": "JER", "Lam": "LAM",
    "Ezek": "EZK", "Dan": "DAN", "Hos": "HOS", "Joel": "JOL", "Amos": "AMO",
    "Obad": "OBD", "Jonah": "JON", "Mic": "MIC", "Nah": "NAM", "Hab": "HAB",
    "Zeph": "ZEP", "Hag": "HAG", "Zech": "ZEC", "Mal": "MAL",
    # NT Books
    "Matt": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
    "Rom": "ROM", "1Cor": "1CO", "2Cor": "2CO", "Gal": "GAL", "Eph": "EPH",
    "Phil": "PHP", "Col": "COL", "1Thess": "1TH", "2Thess": "2TH", "1Tim": "1TI",
    "2Tim": "2TI", "Titus": "TIT", "Phlm": "PHM", "Heb": "HEB", "Jas": "JAS",
    "1Pet": "1PE", "2Pet": "2PE", "1John": "1JN", "2John": "2JN", "3John": "3JN",
    "Jude": "JUD", "Rev": "REV"
}

def parse_verse_id(ref_str):
    parts = ref_str.split('.')
    if len(parts) == 3:
        b_name = parts[0]
        chap = parts[1]
        v_num = parts[2]
        mapped_book = OPENBIBLE_TO_RHEMA.get(b_name)
        if mapped_book:
            return f"{mapped_book}.{chap}.{v_num}"
    return None

def main():
    print("Fetching valid verse IDs from database...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM verses")
    valid_verse_ids = {row[0] for row in cursor.fetchall()}
    conn.close()
    
    print(f"Found {len(valid_verse_ids)} valid verses in database.")
    
    url = "https://a.openbible.info/data/cross-references.zip"
    print(f"Downloading OpenBible cross-references from {url}...")
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            zip_data = response.read()
    except Exception as e:
        print(f"Error downloading zip file: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("Download completed. Unzipping data...")
    records = []
    
    try:
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            print("Files in ZIP:", zf.namelist())
            with zf.open("cross_references.txt") as f:
                # Read line-by-line
                header = f.readline() # Skip header row
                for line_bytes in f:
                    line = line_bytes.decode('utf-8').strip()
                    if not line:
                        continue
                        
                    parts = line.split('\t')
                    if len(parts) >= 3:
                        from_ref = parts[0]
                        to_ref = parts[1]
                        votes = parts[2]
                        
                        from_verse = parse_verse_id(from_ref)
                        to_verse = parse_verse_id(to_ref)
                        
                        if from_verse and to_verse:
                            if from_verse in valid_verse_ids and to_verse in valid_verse_ids:
                                try:
                                    records.append((from_verse, to_verse, int(votes)))
                                except ValueError:
                                    pass
    except Exception as e:
        print(f"Error parsing cross-references: {e}", file=sys.stderr)
        sys.exit(1)
        
    print(f"Parsed {len(records)} cross-reference links. Updating database...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Clear existing cross-references
        print("Clearing old cross-references...")
        cursor.execute("DELETE FROM cross_references")
        
        print("Inserting new cross-references...")
        cursor.executemany("""
        INSERT INTO cross_references (from_verse, to_verse, votes)
        VALUES (?, ?, ?)
        """, records)
        
        conn.commit()
        print(f"Successfully committed {len(records)} cross-reference records.")
    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
