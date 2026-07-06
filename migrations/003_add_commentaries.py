import sqlite3
import json
import urllib.request
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

DB_PATH = "rhelo.db"

def setup_schema(cursor):
    print("Setting up commentaries table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS commentaries (
        commentary_id TEXT,
        verse_id TEXT,
        text TEXT,
        PRIMARY KEY(commentary_id, verse_id),
        FOREIGN KEY(verse_id) REFERENCES verses(id)
    );
    """)

def fetch_chapter_commentary(book, chapter):
    url = f"https://bible.helloao.org/api/c/matthew-henry/{book}/{chapter}.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return book, chapter, json.loads(response.read().decode('utf-8'))
    except Exception as e:
        # Some chapters or books might fail if they don't exist in the commentary
        return book, chapter, None

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    setup_schema(cursor)
    
    # Get all valid verse IDs
    cursor.execute("SELECT id FROM verses")
    valid_verse_ids = {row[0] for row in cursor.fetchall()}
    
    # Get unique book and chapter combinations
    cursor.execute("SELECT DISTINCT book, chapter FROM verses ORDER BY book, chapter")
    chapters_to_fetch = cursor.fetchall()
    conn.close() # Close connection while fetching over network
    
    print(f"Need to fetch commentary for {len(chapters_to_fetch)} New Testament chapters.")
    
    commentary_records = []
    failed_chapters = []
    
    # Use ThreadPoolExecutor to download in parallel
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = [executor.submit(fetch_chapter_commentary, bk, ch) for bk, ch in chapters_to_fetch]
        
        for i, future in enumerate(as_completed(futures), 1):
            book, chapter, data = future.result()
            if data:
                # Process the commentary JSON
                content_items = data.get("chapter", {}).get("content", [])
                for item in content_items:
                    if item.get("type") == "verse":
                        verse_num = item.get("number")
                        paragraphs = item.get("content", [])
                        text = "\n\n".join(paragraphs).strip()
                        
                        if verse_num and text:
                            verse_id = f"{book}.{chapter}.{verse_num}"
                            if verse_id in valid_verse_ids:
                                commentary_records.append(("matthew-henry", verse_id, text))
            else:
                failed_chapters.append((book, chapter))
                
            if i % 20 == 0 or i == len(chapters_to_fetch):
                print(f"Progress: {i}/{len(chapters_to_fetch)} chapters processed.")
                
    print(f"Fetched and parsed commentary data. Total records to insert: {len(commentary_records)}")
    if failed_chapters:
        print(f"Failed to fetch {len(failed_chapters)} chapters: {failed_chapters}")
        
    # Reconnect and insert
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Clear existing Matthew Henry commentary
        cursor.execute("DELETE FROM commentaries WHERE commentary_id = 'matthew-henry'")
        
        cursor.executemany("""
        INSERT OR REPLACE INTO commentaries (commentary_id, verse_id, text)
        VALUES (?, ?, ?)
        """, commentary_records)
        
        conn.commit()
        print(f"Successfully committed {len(commentary_records)} Matthew Henry commentary entries.")
    except Exception as e:
        conn.rollback()
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
