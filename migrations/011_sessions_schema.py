import sqlite3
import os

DB_PATH = "rhelo.db"

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file '{DB_PATH}' not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Creating sessions, session_documents, and sessions_fts tables...")
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS session_documents (
                document_id TEXT PRIMARY KEY,
                session_id TEXT,
                file_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
                session_id UNINDEXED,
                title,
                content
            );
        """)
        conn.commit()

        print("Creating FTS triggers for automatic search indexing...")
        cursor.executescript("""
            CREATE TRIGGER IF NOT EXISTS trg_sessions_ai AFTER INSERT ON sessions BEGIN
                INSERT INTO sessions_fts (session_id, title, content) VALUES (new.session_id, new.title, new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS trg_sessions_ad AFTER DELETE ON sessions BEGIN
                DELETE FROM sessions_fts WHERE session_id = old.session_id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_sessions_au AFTER UPDATE ON sessions BEGIN
                UPDATE sessions_fts SET title = new.title, content = new.content WHERE session_id = old.session_id;
            END;
        """)
        conn.commit()

        # Seed welcome session
        cursor.execute("SELECT count(*) FROM sessions")
        count = cursor.fetchone()[0]
        if count == 0:
            print("Seeding welcome session...")
            welcome_id = "welcome_session_001"
            welcome_title = "Welcome to Rhelo Study Workspace"
            welcome_content = """<h2>Getting Started with Rhelo Active Study</h2>
<p>This interactive workspace is designed for deep scripture reflection and note-taking.</p>
<h3>Workspace Features:</h3>
<ul>
  <li><strong>Drag-and-Drop Scripture Saving</strong>: Drag any verse from the Reading Desk and drop it anywhere into this editor. It will automatically save as a structured quote blocks!</li>
  <li><strong>Local Dictation (STT)</strong>: Click the microphone floating widget to speak your thoughts, and see them appended as text.</li>
  <li><strong>Text-to-Speech (TTS)</strong>: Listen to comparative translations by clicking the volume icon in the reading desk columns.</li>
  <li><strong>Searchable Sessions</strong>: Search your study files instantly using the Left Pane filter.</li>
  <li><strong>PDF Compiled Logs</strong>: Export your notes to print-ready PDF summaries by clicking the PDF compiler button in the header.</li>
</ul>
<p>Select another study session or create a new one using the left panel controls.</p>"""
            cursor.execute("""
                INSERT OR REPLACE INTO sessions (session_id, title, content)
                VALUES (?, ?, ?)
            """, (welcome_id, welcome_title, welcome_content))
            conn.commit()
            print("Welcome session seeded successfully.")

        # Repair the pre-rebrand seed title without changing user-created sessions.
        cursor.execute("""
            UPDATE sessions
            SET title = 'Welcome to Rhelo Study Workspace'
            WHERE session_id = 'welcome_session_001'
              AND title = 'Welcome to Targum Study Workspace'
        """)

        # Rebuild the contentless FTS index so rerunning this migration is
        # deterministic and historical duplicate seed rows are removed.
        cursor.execute("DELETE FROM sessions_fts")
        cursor.execute("""
            INSERT INTO sessions_fts (session_id, title, content)
            SELECT session_id, title, content FROM sessions
        """)
        conn.commit()
        
        print("Sessions schema migration completed successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    main()
