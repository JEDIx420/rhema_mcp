import sqlite3
import os

DB_PATH = "rhema.db"

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file '{DB_PATH}' not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Create verse_translations table
        print("Creating verse_translations table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS verse_translations (
                verse_id TEXT,
                translation_code TEXT,
                text TEXT,
                PRIMARY KEY (verse_id, translation_code)
            );
        """)

        # 2. Check if already normalized by checking if verses is a VIEW
        cursor.execute("SELECT type FROM sqlite_master WHERE name = 'verses'")
        res = cursor.fetchone()
        is_view = res and res[0] == 'view'

        if not is_view:
            print("Migrating translation data from verses to verse_translations...")
            # We migrate the translations if they are available
            for code, col in [('en', 'text_en'), ('hi', 'text_hi'), ('te', 'text_te'), ('ml', 'text_ml'), ('ta', 'text_ta')]:
                cursor.execute(f"SELECT count(*) FROM sqlite_master WHERE name='verses' AND sql LIKE '%{col}%'")
                has_col = cursor.fetchone()[0] > 0
                if has_col:
                    cursor.execute(f"""
                        INSERT OR REPLACE INTO verse_translations (verse_id, translation_code, text)
                        SELECT id, ?, {col} FROM verses WHERE {col} IS NOT NULL AND {col} != ''
                    """, (code,))
            conn.commit()

            print("Recreating verses table as verses_base and creating verses view...")
            # Drop index on verses if exists
            cursor.execute("DROP INDEX IF EXISTS idx_book_chapter")
            
            # Create verses_new
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS verses_new (
                    id TEXT PRIMARY KEY,
                    book TEXT,
                    chapter INTEGER,
                    verse INTEGER,
                    text_original TEXT,
                    morphology JSON
                ) WITHOUT ROWID;
            """)

            # Copy core fields
            cursor.execute("""
                INSERT INTO verses_new (id, book, chapter, verse, text_original, morphology)
                SELECT id, book, chapter, verse, text_original, morphology FROM verses;
            """)

            # Drop old verses table
            cursor.execute("DROP TABLE verses;")

            # Rename verses_new to verses_base
            cursor.execute("ALTER TABLE verses_new RENAME TO verses_base;")

            # Create index on verses_base
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_chapter ON verses_base (book, chapter);")

            # Create view verses
            cursor.execute("""
                CREATE VIEW verses AS
                SELECT 
                    vb.id,
                    vb.book,
                    vb.chapter,
                    vb.verse,
                    (SELECT text FROM verse_translations WHERE verse_id = vb.id AND translation_code = 'en') AS text_en,
                    vb.text_original,
                    vb.morphology,
                    (SELECT text FROM verse_translations WHERE verse_id = vb.id AND translation_code = 'hi') AS text_hi,
                    (SELECT text FROM verse_translations WHERE verse_id = vb.id AND translation_code = 'te') AS text_te,
                    (SELECT text FROM verse_translations WHERE verse_id = vb.id AND translation_code = 'ml') AS text_ml,
                    (SELECT text FROM verse_translations WHERE verse_id = vb.id AND translation_code = 'ta') AS text_ta
                FROM verses_base vb;
            """)
            conn.commit()
            print("Database translations normalized successfully.")
        else:
            print("Database translations already normalized.")

        # 3. Create routes tables
        print("Creating geography routes and points tables...")
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS geography_routes (
                route_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS route_points (
                route_id TEXT,
                sequence_order INTEGER,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                place_name TEXT,
                associated_verse_id TEXT,
                PRIMARY KEY (route_id, sequence_order),
                FOREIGN KEY (route_id) REFERENCES geography_routes(route_id)
            );
        """)
        conn.commit()

        # 4. Seed historical routes
        print("Seeding historical routes...")
        routes = [
            ("abraham", "Abraham's Journey of Faith", "The journey of Abraham from Ur of the Chaldeans to Haran, Shechem, Bethel, and down to Egypt as recounted in Genesis 11-12."),
            ("paul_1", "Paul's First Missionary Journey", "The first missionary journey of the Apostle Paul and Barnabas from Antioch in Syria to Cyprus and Galatia as recorded in Acts 13-14."),
            ("exodus", "The Exodus Wilderness Wanderings", "The historical journey of the Israelites out of Egypt, through Succoth, Mount Sinai, Kadesh Barnea, and arriving at Mount Nebo before entering Canaan.")
        ]
        for rid, title, desc in routes:
            cursor.execute("INSERT OR REPLACE INTO geography_routes (route_id, title, description) VALUES (?, ?, ?)", (rid, title, desc))

        points = [
            # Abraham's journey points
            ("abraham", 1, 31.04, 46.25, "Ur of the Chaldeans", "GEN.11.31"),
            ("abraham", 2, 36.86, 39.02, "Haran", "GEN.11.31"),
            ("abraham", 3, 32.21, 35.28, "Shechem", "GEN.12.6"),
            ("abraham", 4, 31.93, 35.22, "Bethel", "GEN.12.8"),
            ("abraham", 5, 30.05, 31.23, "Egypt", "GEN.12.10"),

            # Paul's First Missionary Journey points
            ("paul_1", 1, 36.20, 36.15, "Antioch (Syria)", "ACT.13.1"),
            ("paul_1", 2, 36.12, 35.92, "Seleucia", "ACT.13.4"),
            ("paul_1", 3, 35.18, 33.90, "Salamis (Cyprus)", "ACT.13.5"),
            ("paul_1", 4, 34.77, 32.42, "Paphos (Cyprus)", "ACT.13.6"),
            ("paul_1", 5, 36.95, 30.85, "Perga (Pamphylia)", "ACT.13.13"),
            ("paul_1", 6, 38.30, 31.18, "Pisidian Antioch", "ACT.13.14"),
            ("paul_1", 7, 37.87, 32.48, "Iconium", "ACT.13.51"),
            ("paul_1", 8, 37.57, 32.44, "Lystra", "ACT.14.6"),
            ("paul_1", 9, 37.35, 33.20, "Derbe", "ACT.14.6"),

            # Exodus points
            ("exodus", 1, 30.79, 31.83, "Rameses (Egypt)", "EXO.12.37"),
            ("exodus", 2, 30.60, 32.15, "Succoth", "EXO.12.37"),
            ("exodus", 3, 28.53, 33.97, "Mount Sinai", "EXO.19.1"),
            ("exodus", 4, 30.63, 34.42, "Kadesh Barnea", "NUM.13.26"),
            ("exodus", 5, 31.76, 35.72, "Mount Nebo", "DEU.34.1")
        ]
        for rid, seq, lat, lon, name, vid in points:
            cursor.execute("""
                INSERT OR REPLACE INTO route_points (route_id, sequence_order, latitude, longitude, place_name, associated_verse_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (rid, seq, lat, lon, name, vid))

        conn.commit()
        print("Routes seeded successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    main()
