import sqlite3
import json
import urllib.request
import sys

DB_PATH = "rhema.db"

def ingest_strongs():
    url = "https://raw.githubusercontent.com/mormon-documentation-project/strongs/master/strongs.json"
    print(f"Fetching Strong's Lexicon from {url}...")
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        sys.exit(1)
        
    print(f"Parsed {len(data)} Strong's entries. Connecting to database...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Clear existing virtual table entries
        cursor.execute("DELETE FROM lexicon_fts")
        
        count = 0
        for entry in data:
            strongs_id = entry.get("number")
            lemma = entry.get("lemma")
            definition = entry.get("description")
            
            if not strongs_id:
                continue
                
            cursor.execute("""
            INSERT INTO lexicon_fts (strongs_id, lemma, definition)
            VALUES (?, ?, ?)
            """, (strongs_id, lemma, definition))
            count += 1
            
        conn.commit()
        print(f"Successfully populated {count} entries into lexicon_fts.")
    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    ingest_strongs()
