from mcp.server.fastmcp import FastMCP
import sqlite3
import json
import os

mcp = FastMCP("Rhema Study Engine")
DB_PATH = os.path.join(os.path.dirname(__file__), "rhema.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def compile_html_to_pdf(html_content: str, title: str, output_path: str):
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    import re

    doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor='#1e293b',
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor='#2563eb',
        spaceBefore=12,
        spaceAfter=6
    )

    h3_style = ParagraphStyle(
        'DocH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor='#0f172a',
        spaceBefore=10,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor='#334155',
        spaceAfter=8
    )

    quote_style = ParagraphStyle(
        'DocQuote',
        parent=styles['BodyText'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=13,
        textColor='#475569',
        leftIndent=15,
        spaceAfter=10
    )

    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 10))

    # Parse simple HTML tags
    blocks = re.split(r'(</?(?:h1|h2|h3|p|li|blockquote|ul|ol)>)', html_content)
    
    current_tag = None
    for item in blocks:
        if not item:
            continue
        item_lower = item.lower()
        if item_lower in ['<h1>', '<h2>', '<h3>', '<p>', '<li>', '<blockquote>', '<ul>', '<ol>']:
            current_tag = item_lower
            continue
        elif item_lower in ['</h1>', '</h2>', '</h3>', '</p>', '</li>', '</blockquote>', '</ul>', '</ol>']:
            current_tag = None
            continue
        
        # Clean text
        text = re.sub(r'<[^>]+>', '', item).strip()
        if not text:
            continue
            
        if current_tag == '<h2>':
            story.append(Paragraph(text, h2_style))
        elif current_tag == '<h3>':
            story.append(Paragraph(text, h3_style))
        elif current_tag == '<blockquote>':
            story.append(Paragraph(text, quote_style))
        elif current_tag == '<li>':
            story.append(Paragraph(f"&bull; {text}", body_style))
        else:
            story.append(Paragraph(text, body_style))

    doc.build(story)

@mcp.tool()
def search_scriptures(query: str, book: str = None) -> str:
    """
    Search the English Bible text using full-text search (FTS5).
    Optionally filter by book abbreviation (e.g. 'GEN', 'MAT').
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if book:
            cursor.execute("""
                SELECT id, book, chapter, verse, text_en 
                FROM search_en 
                WHERE text_en MATCH ? AND book = ? 
                LIMIT 50
            """, (query, book.upper()))
        else:
            cursor.execute("""
                SELECT id, book, chapter, verse, text_en 
                FROM search_en 
                WHERE text_en MATCH ? 
                LIMIT 50
            """, (query,))
        
        rows = cursor.fetchall()
        if not rows:
            return f"No results found for query: '{query}'"
        
        results = []
        for r in rows:
            results.append(f"[{r['id']}] {r['text_en']}")
        return "\n".join(results)
    except Exception as e:
        return f"Error executing search: {e}"
    finally:
        conn.close()

@mcp.tool()
def get_verse_details(verse_id: str) -> str:
    """
    Retrieve comprehensive details for a specific verse ID (e.g. 'GEN.1.1' or 'MAT.1.1').
    Includes all translations, commentary, linked places, timeline events, and cross-references.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get translations
        cursor.execute("SELECT * FROM verses WHERE id = ?", (verse_id.upper(),))
        verse = cursor.fetchone()
        if not verse:
            return f"Verse '{verse_id}' not found in database."
        
        # Get commentaries
        cursor.execute("SELECT commentary_id, text FROM commentaries WHERE verse_id = ?", (verse_id.upper(),))
        commentaries = cursor.fetchall()
        
        # Get geocoded places
        cursor.execute("""
            SELECT gp.name, gp.latitude, gp.longitude, gp.type 
            FROM geography_places gp
            JOIN verse_geography vg ON gp.place_id = vg.place_id
            WHERE vg.verse_id = ?
        """, (verse_id.upper(),))
        places = cursor.fetchall()
        
        # Get timeline events
        cursor.execute("""
            SELECT te.title, te.year, te.location, te.description 
            FROM timeline_events te
            JOIN event_verses ev ON te.event_id = ev.event_id
            WHERE ev.verse_id = ?
        """, (verse_id.upper(),))
        events = cursor.fetchall()
        
        # Get cross-references
        cursor.execute("""
            SELECT to_verse, votes FROM cross_references 
            WHERE from_verse = ? 
            ORDER BY votes DESC LIMIT 10
        """, (verse_id.upper(),))
        cross_refs = cursor.fetchall()
        
        # Format output
        output = []
        output.append(f"=== Verse Details: {verse['id']} ===")
        output.append(f"English (KJV): {verse['text_en']}")
        output.append(f"Original Text (Hebrew/Greek): {verse['text_original']}")
        output.append(f"Hindi: {verse['text_hi']}")
        output.append(f"Telugu: {verse['text_te']}")
        output.append(f"Malayalam: {verse['text_ml']}")
        output.append(f"Tamil: {verse['text_ta']}")
        output.append("")
        
        if commentaries:
            output.append("--- Commentaries ---")
            for c in commentaries:
                output.append(f"[{c['commentary_id']}]: {c['text']}")
            output.append("")
            
        if places:
            output.append("--- Geography (Geocoded Places) ---")
            for p in places:
                output.append(f"- {p['name']} ({p['type']}) at Coordinates: ({p['latitude']}, {p['longitude']})")
            output.append("")
            
        if events:
            output.append("--- Chronological Timeline Events ---")
            for e in events:
                year_str = f"{abs(e['year'])} BC" if e['year'] < 0 else f"AD {e['year']}"
                output.append(f"- {e['title']} ({year_str}) at {e['location']}: {e['description']}")
            output.append("")
            
        if cross_refs:
            output.append("--- Top Cross-References ---")
            for cr in cross_refs:
                output.append(f"- {cr['to_verse']} (votes: {cr['votes']})")
            output.append("")
            
        return "\n".join(output)
    except Exception as e:
        return f"Error retrieving verse details: {e}"
    finally:
        conn.close()

@mcp.tool()
def search_dictionary_and_lexicon(query: str) -> str:
    """
    Search Easton's/Smith's Bible Dictionaries and Strong's Concordance Greek/Hebrew lexicon.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Search Dictionary FTS
        cursor.execute("""
            SELECT name, definition_text 
            FROM dictionary_fts 
            WHERE dictionary_fts MATCH ? 
            LIMIT 15
        """, (query,))
        dict_rows = cursor.fetchall()
        
        # Search Strong's Lexicon FTS
        cursor.execute("""
            SELECT strongs_id, lemma, definition 
            FROM lexicon_fts 
            WHERE lexicon_fts MATCH ? 
            LIMIT 15
        """, (query,))
        lex_rows = cursor.fetchall()
        
        output = []
        if dict_rows:
            output.append("=== Bible Dictionary Matches ===")
            for r in dict_rows:
                output.append(f"Term: {r['name']}")
                output.append(f"Definition: {r['definition_text'][:300]}...")
                output.append("-" * 30)
            output.append("")
            
        if lex_rows:
            output.append("=== Strong's Lexicon Matches ===")
            for r in lex_rows:
                output.append(f"Strong's ID: {r['strongs_id']} | Lemma: {r['lemma']}")
                output.append(f"Definition: {r['definition']}")
                output.append("-" * 30)
            output.append("")
            
        if not output:
            return f"No dictionary or lexicon matches found for: '{query}'"
            
        return "\n".join(output)
    except Exception as e:
        return f"Error executing lookup: {e}"
    finally:
        conn.close()

@mcp.tool()
def search_topics(query: str) -> str:
    """
    Search subjects and entries in Nave's Topical Index.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT subject, entry 
            FROM naves_fts 
            WHERE naves_fts MATCH ? 
            LIMIT 15
        """, (query,))
        rows = cursor.fetchall()
        
        if not rows:
            return f"No topical matches found in Nave's Index for: '{query}'"
            
        output = []
        output.append("=== Nave's Topical Index Matches ===")
        for r in rows:
            output.append(f"Subject: {r['subject']}")
            output.append(f"Entry References: {r['entry']}")
            output.append("-" * 40)
            
        return "\n".join(output)
    except Exception as e:
        return f"Error executing topical search: {e}"
    finally:
        conn.close()

@mcp.tool()
def get_biography(person_id: str) -> str:
    """
    Retrieve biographical profile, unique attributes, and family relationships for a person ID (e.g. 'Adam_1', 'David_1').
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get person profile
        cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
        person = cursor.fetchone()
        if not person:
            # Try searching by name case-insensitive
            cursor.execute("SELECT * FROM people WHERE name LIKE ? LIMIT 1", (f"{person_id}%",))
            person = cursor.fetchone()
            if not person:
                return f"Person '{person_id}' not found in database."
        
        # Get relationships
        cursor.execute("""
            SELECT r.relationship_type, p.name AS relation_name, r.person_id_2 AS relation_id, r.verse_id 
            FROM relationships r
            JOIN people p ON r.person_id_2 = p.id
            WHERE r.person_id_1 = ?
        """, (person['id'],))
        relations = cursor.fetchall()
        
        # Get Hitchcock name meaning if matches
        cursor.execute("SELECT meaning FROM bible_names_dictionary WHERE name = ?", (person['name'],))
        name_meaning = cursor.fetchone()
        
        output = []
        output.append(f"=== Biographical Profile: {person['name']} ===")
        output.append(f"ID: {person['id']}")
        output.append(f"Sex: {person['sex']}")
        if person['tribe']:
            output.append(f"Tribe: {person['tribe']}")
        if person['unique_attribute']:
            output.append(f"Attribute: {person['unique_attribute']}")
        if person['notes']:
            output.append(f"Notes: {person['notes']}")
        if name_meaning:
            output.append(f"Name Meaning (Hitchcock's): {name_meaning['meaning']}")
        output.append("")
        
        if relations:
            output.append("--- Family & Social Relationships ---")
            for r in relations:
                ref_str = f" in {r['verse_id']}" if r['verse_id'] else ""
                output.append(f"- {person['name']} is the {r['relationship_type']} of {r['relation_name']} ({r['relation_id']}){ref_str}")
                
        return "\n".join(output)
    except Exception as e:
        return f"Error retrieving biography: {e}"
    finally:
        conn.close()

@mcp.tool()
def list_geography_routes() -> str:
    """
    Retrieve a list of available historical biblical routes/journeys (e.g. Abraham's journey, Exodus, Paul's missionary trips).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT route_id, title, description FROM geography_routes ORDER BY route_id")
        rows = cursor.fetchall()
        if not rows:
            return "No historical routes found in the database."
        output = ["=== Historical Biblical Routes ==="]
        for r in rows:
            output.append(f"- ID: {r['route_id']} | Title: {r['title']}")
            if r['description']:
                output.append(f"  Description: {r['description']}")
        return "\n".join(output)
    except Exception as e:
        return f"Error listing routes: {e}"
    finally:
        conn.close()

@mcp.tool()
def get_route_points(route_id: str) -> str:
    """
    Retrieve the ordered list of coordinates, place names, and scripture references for a specific route ID.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check route details
        cursor.execute("SELECT title, description FROM geography_routes WHERE route_id = ?", (route_id.lower(),))
        route = cursor.fetchone()
        if not route:
            return f"Route '{route_id}' not found."

        cursor.execute("""
            SELECT sequence_order, latitude, longitude, place_name, associated_verse_id
            FROM route_points
            WHERE route_id = ?
            ORDER BY sequence_order
        """, (route_id.lower(),))
        rows = cursor.fetchall()

        output = [f"=== Route: {route['title']} ==="]
        if route['description']:
            output.append(route['description'])
        output.append("")

        for r in rows:
            ref_str = f" (Ref: {r['associated_verse_id']})" if r['associated_verse_id'] else ""
            output.append(f"{r['sequence_order']}. {r['place_name']}{ref_str} at Coordinates: ({r['latitude']}, {r['longitude']})")
        return "\n".join(output)
    except Exception as e:
        return f"Error getting route points: {e}"
    finally:
        conn.close()

@mcp.tool()
def get_chapter_map_data(book: str, chapter: int) -> str:
    """
    Retrieve geocoded coordinates and place names mentioned in a specific book and chapter (e.g. book='GEN', chapter=12).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Fetch places in chapter
        cursor.execute("""
            SELECT DISTINCT gp.name, gp.latitude, gp.longitude, gp.type, vg.verse_id
            FROM geography_places gp
            JOIN verse_geography vg ON gp.place_id = vg.place_id
            JOIN verses v ON vg.verse_id = v.id
            WHERE v.book = ? AND v.chapter = ?
            ORDER BY vg.verse_id
        """, (book.upper(), chapter))
        rows = cursor.fetchall()
        
        if not rows:
            return f"No geocoded places found in {book.upper()} chapter {chapter}."
            
        output = []
        output.append(f"=== Geocoded Places in {book.upper()} Chapter {chapter} ===")
        for r in rows:
            output.append(f"[{r['verse_id']}] {r['name']} ({r['type']}) at Coordinates: ({r['latitude']}, {r['longitude']})")
        return "\n".join(output)
    except Exception as e:
        return f"Error retrieving chapter maps: {e}"
    finally:
        conn.close()

# --- Built-in HTTP JSON API Server for Next.js Frontend ---
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import unicodedata

# In-memory lexicon lookup dictionary
LEXICON_LOOKUP = {}

def normalize_text(text):
    if not text:
        return ""
    normalized = unicodedata.normalize('NFD', text)
    stripped = ''.join(c for c in normalized if not (unicodedata.combining(c) or (0x0591 <= ord(c) <= 0x05C7)))
    return stripped.lower().strip('.,;:!?\'\"()[]{}׃.-')

def get_language(text):
    for c in text:
        val = ord(c)
        if 0x0590 <= val <= 0x05FF:
            return "hebrew"
        if 0x0370 <= val <= 0x03FF or 0x1F00 <= val <= 0x1FFF:
            return "greek"
    return "english"

def find_matching_strongs(word):
    w = normalize_text(word)
    if not w:
        return []
    
    # Try direct lookup
    if w in LEXICON_LOOKUP:
        return LEXICON_LOOKUP[w]
    
    lang = get_language(word)
    if lang == "hebrew":
        # Try prefix stripping for Hebrew words
        prefixes = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש', 'י', 'ת', 'א', 'נ']
        for p in prefixes:
            if w.startswith(p) and len(w) > 2:
                sub = w[1:]
                if sub in LEXICON_LOOKUP:
                    return LEXICON_LOOKUP[sub]
                # Try secondary prefix combinations
                for p2 in prefixes:
                    if sub.startswith(p2) and len(sub) > 2:
                        sub2 = sub[1:]
                        if sub2 in LEXICON_LOOKUP:
                            return LEXICON_LOOKUP[sub2]
    return []

def build_lexicon_lookup():
    global LEXICON_LOOKUP
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT strongs_id, lemma FROM lexicon_fts")
        rows = cursor.fetchall()
        
        temp_lookup = {}
        for strongs_id, lemma in rows:
            norm = normalize_text(lemma)
            if norm:
                if norm not in temp_lookup:
                    temp_lookup[norm] = []
                temp_lookup[norm].append(strongs_id)
        
        LEXICON_LOOKUP = temp_lookup
        print(f"Successfully cached {len(rows)} lexicon lemmas into {len(temp_lookup)} lookup keys.")
    except Exception as e:
        print(f"Error caching lexicon lemmas: {e}")
    finally:
        conn.close()

OT_BOOKS = [
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', 
    '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 
    'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBD', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 
    'HAG', 'ZEC', 'MAL'
]
NT_BOOKS = [
    'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', 
    '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', 
    '3JN', 'JUD', 'REV'
]
ALL_BOOKS = OT_BOOKS + NT_BOOKS
BOOK_ORDER = {code: i for i, code in enumerate(ALL_BOOKS)}

class JSONAPIHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress logging to stdout to prevent polluting stdio MCP traffic
        pass

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        data = {}
        conn = get_db_connection()
        cursor = conn.cursor()
        
        response_data = {"error": "Endpoint not found"}
        status_code = 404
        is_binary = False
        binary_data = b""
        response_content_type = 'application/json'
        
        try:
            if path == "/api/sessions/create":
                import uuid
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                title = data.get("title", "Untitled Session")
                content = data.get("content", "")
                session_id = str(uuid.uuid4())
                
                cursor.execute("""
                    INSERT INTO sessions (session_id, title, content)
                    VALUES (?, ?, ?)
                """, (session_id, title, content))
                conn.commit()
                
                response_data = {"status": "success", "session_id": session_id, "title": title, "content": content}
                status_code = 200

            elif path == "/api/sessions/update":
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                session_id = data.get("session_id")
                title = data.get("title")
                content = data.get("content")
                
                if session_id:
                    cursor.execute("""
                        UPDATE sessions
                        SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE session_id = ?
                    """, (title, content, session_id))
                    conn.commit()
                    response_data = {"status": "success", "session_id": session_id}
                    status_code = 200
                else:
                    response_data = {"error": "Missing session_id"}
                    status_code = 400

            elif path == "/api/sessions/delete":
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                session_id = data.get("session_id")
                
                if session_id:
                    cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
                    conn.commit()
                    response_data = {"status": "success", "session_id": session_id}
                    status_code = 200
                else:
                    response_data = {"error": "Missing session_id"}
                    status_code = 400

            elif path == "/api/tts":
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                text = data.get("text", "")
                language_code = data.get("language_code", "en")
                
                if text:
                    if language_code == "en":
                        import tempfile
                        import subprocess
                        import os
                        
                        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
                        os.close(temp_fd)
                        try:
                            subprocess.run([
                                "say",
                                "-o", temp_path,
                                "--file-format=WAVE",
                                "--data-format=LEI16@22050",
                                text
                            ], check=True)
                            
                            with open(temp_path, "rb") as f:
                                binary_data = f.read()
                            is_binary = True
                            response_content_type = "audio/wav"
                            status_code = 200
                        finally:
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
                    else:
                        from gtts import gTTS
                        import io
                        
                        tts = gTTS(text=text, lang=language_code)
                        fp = io.BytesIO()
                        tts.write_to_fp(fp)
                        fp.seek(0)
                        binary_data = fp.read()
                        is_binary = True
                        response_content_type = "audio/mpeg"
                        status_code = 200
                else:
                    response_data = {"error": "Missing text"}
                    status_code = 400

            elif path == "/api/stt":
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                audio_b64 = data.get("audio")
                language_code = data.get("language_code", "en-US")
                
                if len(language_code) == 2:
                    lang_map = {"en": "en-US", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "ml": "ml-IN"}
                    language_code = lang_map.get(language_code, "en-US")
                
                if audio_b64:
                    import base64
                    import tempfile
                    import os
                    import speech_recognition as sr
                    
                    audio_bytes = base64.b64decode(audio_b64)
                    temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
                    os.close(temp_fd)
                    try:
                        with open(temp_path, "wb") as f:
                            f.write(audio_bytes)
                            
                        r = sr.Recognizer()
                        with sr.AudioFile(temp_path) as source:
                            audio_data = r.record(source)
                            try:
                                text = r.recognize_google(audio_data, language=language_code)
                                response_data = {"text": text}
                                status_code = 200
                            except Exception as e:
                                response_data = {"text": "", "error": f"Speech recognition failed: {e}"}
                                status_code = 200
                    finally:
                        if os.path.exists(temp_path):
                            os.remove(temp_path)
                else:
                    response_data = {"error": "Missing audio data"}
                    status_code = 400

            elif path == "/api/sessions/pdf":
                if post_data:
                    data = json.loads(post_data.decode('utf-8'))
                session_id = data.get("session_id", "session")
                title = data.get("title", "Study Session Summary")
                html_content = data.get("content", "")
                
                import os
                pdf_dir = "/Users/vincyvincent/rhema_mcp/frontend/public/documents"
                os.makedirs(pdf_dir, exist_ok=True)
                
                pdf_filename = f"{session_id}.pdf"
                pdf_path = os.path.join(pdf_dir, pdf_filename)
                
                compile_html_to_pdf(html_content, title, pdf_path)
                
                import uuid
                doc_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO session_documents (document_id, session_id, file_path)
                    VALUES (?, ?, ?)
                """, (doc_id, session_id, pdf_path))
                conn.commit()
                
                response_data = {
                    "status": "success",
                    "pdf_url": f"/documents/{pdf_filename}",
                    "document_id": doc_id
                }
                status_code = 200

        except Exception as e:
            response_data = {"error": str(e)}
            status_code = 500
        finally:
            conn.close()

        self.send_response(status_code)
        self.send_header('Content-Type', response_content_type)
        self.send_cors_headers()
        self.end_headers()
        if is_binary:
            self.wfile.write(binary_data)
        else:
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        conn = get_db_connection()
        cursor = conn.cursor()
        response_data = {"error": "Endpoint not found"}
        status_code = 404

        try:
            if path == "/api/read":
                book = query_params.get("book", [None])[0]
                chapter = query_params.get("chapter", [None])[0]
                if book and chapter:
                    cursor.execute("""
                        SELECT * FROM verses 
                        WHERE book = ? AND chapter = ?
                        ORDER BY verse
                    """, (book.upper(), int(chapter)))
                    rows = cursor.fetchall()
                    
                    verses_list = []
                    for r in rows:
                        # Fetch cross refs count
                        cursor.execute("SELECT count(*) FROM cross_references WHERE from_verse = ?", (r['id'],))
                        cross_ref_count = cursor.fetchone()[0]
                        
                        # Fetch places count
                        cursor.execute("SELECT count(*) FROM verse_geography WHERE verse_id = ?", (r['id'],))
                        places_count = cursor.fetchone()[0]
                        
                        # Fetch commentaries
                        cursor.execute("SELECT text FROM commentaries WHERE verse_id = ?", (r['id'],))
                        commentary_rows = cursor.fetchall()
                        commentaries = [c[0] for c in commentary_rows]
                        
                        # Parse morphology
                        try:
                            morph = json.loads(r['morphology']) if r['morphology'] else []
                        except:
                            morph = []
                        
                        verses_list.append({
                            "id": r['id'], "book": r['book'], "chapter": r['chapter'], "verse": r['verse'],
                            "text_en": r['text_en'], "text_original": r['text_original'],
                            "text_hi": r['text_hi'], "text_te": r['text_te'],
                            "text_ml": r['text_ml'], "text_ta": r['text_ta'],
                            "cross_references_count": cross_ref_count,
                            "places_count": places_count,
                            "commentaries": commentaries,
                            "morphology": morph
                        })
                    response_data = {"verses": verses_list}
                    status_code = 200

            elif path == "/api/search":
                q = query_params.get("q", [""])[0]
                book = query_params.get("book", [None])[0]
                testament = query_params.get("testament", [None])[0]
                sort = query_params.get("sort", ["relevance"])[0]
                page = int(query_params.get("page", ["1"])[0])
                limit = int(query_params.get("limit", ["50"])[0])

                if q:
                    cursor.execute("""
                        SELECT id, book, chapter, verse, text_en, rank 
                        FROM search_en 
                        WHERE text_en MATCH ?
                    """, (q,))
                    rows = [dict(r) for r in cursor.fetchall()]

                    # Apply filters
                    filtered_rows = rows
                    if book and book.strip() and book.upper() != "ALL":
                        filtered_rows = [r for r in filtered_rows if r["book"].upper() == book.upper()]
                    if testament and testament.strip() and testament.upper() != "ALL":
                        if testament.upper() == "OT":
                            filtered_rows = [r for r in filtered_rows if r["book"].upper() in OT_BOOKS]
                        elif testament.upper() == "NT":
                            filtered_rows = [r for r in filtered_rows if r["book"].upper() in NT_BOOKS]

                    # Apply sorting
                    if sort == "canonical":
                        filtered_rows.sort(key=lambda r: (BOOK_ORDER.get(r["book"].upper(), 999), r["chapter"], r["verse"]))
                    else:
                        # rank values are float in sqlite fts5; relevance: smallest rank first
                        filtered_rows.sort(key=lambda r: r.get("rank", 0.0))

                    total_results = len(filtered_rows)
                    offset = (page - 1) * limit
                    paginated_rows = filtered_rows[offset : offset + limit]

                    matching_books = sorted(list(set(r["book"].upper() for r in rows)))
                    matching_testaments = []
                    has_ot = any(b in OT_BOOKS for b in matching_books)
                    has_nt = any(b in NT_BOOKS for b in matching_books)
                    if has_ot:
                        matching_testaments.append("OT")
                    if has_nt:
                        matching_testaments.append("NT")

                    response_data = {
                        "results": paginated_rows,
                        "total": total_results,
                        "page": page,
                        "limit": limit,
                        "matching_books": matching_books,
                        "matching_testaments": matching_testaments
                    }
                    status_code = 200

            elif path == "/api/verse":
                verse_id = query_params.get("id", [""])[0]
                if verse_id:
                    cursor.execute("SELECT * FROM verses WHERE id = ?", (verse_id.upper(),))
                    row = cursor.fetchone()
                    if row:
                        verse_dict = dict(row)
                        try:
                            verse_dict['morphology'] = json.loads(verse_dict['morphology']) if verse_dict['morphology'] else []
                        except:
                            verse_dict['morphology'] = []
                        
                        # Get commentaries
                        cursor.execute("SELECT commentary_id, text FROM commentaries WHERE verse_id = ?", (verse_id.upper(),))
                        comms = [dict(c) for c in cursor.fetchall()]
                        
                        # Get places
                        cursor.execute("""
                            SELECT gp.name, gp.latitude, gp.longitude, gp.type 
                            FROM geography_places gp
                            JOIN verse_geography vg ON gp.place_id = vg.place_id
                            WHERE vg.verse_id = ?
                        """, (verse_id.upper(),))
                        places = [dict(p) for p in cursor.fetchall()]
                        
                        # Get timeline
                        cursor.execute("""
                            SELECT te.title, te.year, te.location, te.description 
                            FROM timeline_events te
                            JOIN event_verses ev ON te.event_id = ev.event_id
                            WHERE ev.verse_id = ?
                        """, (verse_id.upper(),))
                        events = [dict(e) for e in cursor.fetchall()]
                        
                        # Get cross-references
                        cursor.execute("""
                            SELECT cr.to_verse, cr.votes, v.text_en AS text_en
                            FROM cross_references cr
                            LEFT JOIN verses v ON cr.to_verse = v.id
                            WHERE cr.from_verse = ? 
                            ORDER BY cr.votes DESC LIMIT 15
                        """, (verse_id.upper(),))
                        cross_refs = [dict(cr) for cr in cursor.fetchall()]
                        
                        response_data = {
                            "verse": verse_dict,
                            "commentaries": comms,
                            "places": places,
                            "events": events,
                            "cross_references": cross_refs
                        }
                        status_code = 200

            elif path == "/api/lexicon":
                q = query_params.get("q", [""])[0]
                if q:
                    cursor.execute("""
                        SELECT strongs_id, lemma, definition 
                        FROM lexicon_fts 
                        WHERE lexicon_fts MATCH ? 
                        LIMIT 30
                    """, (q,))
                    lex_rows = [dict(r) for r in cursor.fetchall()]
                    
                    cursor.execute("""
                        SELECT name, definition_text 
                        FROM dictionary_fts 
                        WHERE dictionary_fts MATCH ? 
                        LIMIT 30
                    """, (q,))
                    dict_rows = [dict(r) for r in cursor.fetchall()]
                    
                    response_data = {"lexicon": lex_rows, "dictionary": dict_rows}
                    status_code = 200

            elif path == "/api/lexicon/lookup":
                q = query_params.get("q", [""])[0]
                results = []
                if q:
                    matched_ids = find_matching_strongs(q)
                    for sid in matched_ids:
                        cursor.execute("""
                            SELECT strongs_id, lemma, definition 
                            FROM lexicon_fts 
                            WHERE strongs_id = ?
                        """, (sid,))
                        row = cursor.fetchone()
                        if row:
                            results.append(dict(row))
                response_data = {"results": results}
                status_code = 200

            elif path == "/api/lexicon/occurrences":
                lemma = query_params.get("lemma", [""])[0]
                results = []
                if lemma:
                    cursor.execute("""
                        SELECT id, book, chapter, verse, text_en, text_original
                        FROM verses 
                        WHERE morphology LIKE ? 
                        LIMIT 20
                    """, (f'%"lemma": "{lemma}"%',))
                    rows = cursor.fetchall()
                    if not rows:
                        cursor.execute("""
                            SELECT id, book, chapter, verse, text_en, text_original
                            FROM verses 
                            WHERE text_original LIKE ? 
                            LIMIT 20
                        """, (f'%{lemma}%',))
                        rows = cursor.fetchall()
                    results = [dict(r) for r in rows]
                response_data = {"occurrences": results}
                status_code = 200

            elif path == "/api/topics":
                q = query_params.get("q", [""])[0]
                if q:
                    cursor.execute("""
                        SELECT subject, entry 
                        FROM naves_fts 
                        WHERE naves_fts MATCH ? 
                        LIMIT 30
                    """, (q,))
                    rows = [dict(r) for r in cursor.fetchall()]
                    response_data = {"topics": rows}
                    status_code = 200

            elif path == "/api/biography":
                person_id = query_params.get("id", [""])[0]
                if person_id:
                    cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                    person = cursor.fetchone()
                    if not person:
                        cursor.execute("SELECT * FROM people WHERE name LIKE ? LIMIT 1", (f"{person_id}%",))
                        person = cursor.fetchone()
                    
                    if person:
                        # Get relationships
                        cursor.execute("""
                            SELECT r.relationship_type, p.name AS relation_name, r.person_id_2 AS relation_id, p.sex AS relation_sex, r.verse_id 
                            FROM relationships r
                            JOIN people p ON r.person_id_2 = p.id
                            WHERE r.person_id_1 = ?
                        """, (person['id'],))
                        relations = [dict(r) for r in cursor.fetchall()]
                        
                        # Get name meaning
                        cursor.execute("SELECT meaning FROM bible_names_dictionary WHERE name = ?", (person['name'],))
                        meaning_row = cursor.fetchone()
                        meaning = meaning_row[0] if meaning_row else None
                        
                        response_data = {
                            "profile": dict(person),
                            "relationships": relations,
                            "name_meaning": meaning
                        }
                        status_code = 200

            elif path == "/api/chapter_map":
                book = query_params.get("book", [None])[0]
                chapter = query_params.get("chapter", [None])[0]
                if book and chapter:
                    cursor.execute("""
                        SELECT DISTINCT gp.name, gp.latitude, gp.longitude, gp.type, vg.verse_id
                        FROM geography_places gp
                        JOIN verse_geography vg ON gp.place_id = vg.place_id
                        JOIN verses v ON vg.verse_id = v.id
                        WHERE v.book = ? AND v.chapter = ?
                        ORDER BY vg.verse_id
                    """, (book.upper(), int(chapter)))
                    rows = [dict(r) for r in cursor.fetchall()]
                    
                    if not rows:
                        import re
                        cursor.execute("SELECT id, text_en FROM verses WHERE book = ? AND chapter = ?", (book.upper(), int(chapter)))
                        chapter_verses = cursor.fetchall()
                        if chapter_verses:
                            cursor.execute("SELECT name, latitude, longitude, type FROM geography_places")
                            all_places = cursor.fetchall()
                            
                            chapter_text = " ".join([v[1] for v in chapter_verses])
                            chapter_words = set(re.findall(r"\b\w+\b", chapter_text.lower()))
                            
                            common_stops = {"no", "so", "on", "am", "all", "but", "up", "red", "of", "in", "at", "by", "to", "for", "with", "the", "a", "an", "and", "or", "if", "be", "is", "are", "was", "were"}
                            
                            for place_name, lat, lon, p_type in all_places:
                                clean_name = re.sub(r"\s+\d+$", "", place_name)
                                place_lower = clean_name.lower()
                                first_word = re.findall(r"\b\w+\b", place_lower)
                                if not first_word or first_word[0] not in chapter_words:
                                    continue
                                
                                is_stop = place_lower in common_stops or len(clean_name) <= 3
                                if is_stop:
                                    regex = re.compile(r"\b" + re.escape(clean_name) + r"\b")
                                else:
                                    regex = re.compile(r"\b" + re.escape(clean_name) + r"\b", re.IGNORECASE)
                                    
                                for verse_id, text_en in chapter_verses:
                                    if regex.search(text_en):
                                        if not any(x["name"] == clean_name and x["verse_id"] == verse_id for x in rows):
                                            rows.append({
                                                "name": clean_name,
                                                "latitude": lat,
                                                "longitude": lon,
                                                "type": p_type,
                                                "verse_id": verse_id
                                            })
                            
                    # Numerical verse-aware sorting
                    def parse_verse_key(verse_id):
                        parts = verse_id.split(".")
                        if len(parts) == 3:
                            try:
                                return (parts[0], int(parts[1]), int(parts[2]))
                            except ValueError:
                                pass
                        return (verse_id, 0, 0)
                        
                    rows.sort(key=lambda x: parse_verse_key(x["verse_id"]))

                    # Decorate place items with text content, original terms, and etymology details
                    for row in rows:
                        cursor.execute("SELECT text_en, text_original FROM verses WHERE id = ?", (row["verse_id"],))
                        v_row = cursor.fetchone()
                        if v_row:
                            row["text_en"] = v_row[0]
                            row["text_original"] = v_row[1]
                        else:
                            row["text_en"] = ""
                            row["text_original"] = ""

                        # Fetch Name Meaning (Hitchcock)
                        cursor.execute("SELECT meaning FROM bible_names_dictionary WHERE name = ?", (row["name"],))
                        m_row = cursor.fetchone()
                        row["meaning"] = m_row[0] if m_row else None

                        # Fetch Matthew Henry Commentary
                        cursor.execute("SELECT text FROM commentaries WHERE verse_id = ? LIMIT 1", (row["verse_id"],))
                        c_row = cursor.fetchone()
                        row["commentary"] = c_row[0] if c_row else None

                        # Fetch Dictionary Definition
                        cursor.execute("""
                            SELECT d.definition_text
                            FROM dictionary_definitions d
                            JOIN dictionary_entries e ON d.entry_slug = e.slug
                            WHERE LOWER(e.name) = LOWER(?) LIMIT 1
                        """, (row["name"],))
                        d_row = cursor.fetchone()
                        row["dict_definition"] = d_row[0] if d_row else None
                    
                    response_data = {"places": rows}
                    status_code = 200

            elif path == "/api/geography/routes":
                cursor.execute("SELECT route_id, title, description FROM geography_routes ORDER BY route_id")
                rows = [dict(r) for r in cursor.fetchall()]
                response_data = {"routes": rows}
                status_code = 200

            elif path == "/api/geography/routes/points":
                route_id = query_params.get("route_id", [None])[0]
                if route_id:
                    cursor.execute("""
                        SELECT sequence_order, latitude, longitude, place_name, associated_verse_id
                        FROM route_points
                        WHERE route_id = ?
                        ORDER BY sequence_order
                    """, (route_id.lower(),))
                    rows = [dict(r) for r in cursor.fetchall()]

                    # Fetch verse details for each point
                    for r in rows:
                        if r["associated_verse_id"]:
                            cursor.execute("SELECT text_en, text_original FROM verses WHERE id = ?", (r["associated_verse_id"].upper(),))
                            v_row = cursor.fetchone()
                            if v_row:
                                r["text_en"] = v_row[0]
                                r["text_original"] = v_row[1]
                            else:
                                r["text_en"] = ""
                                r["text_original"] = ""
                        else:
                            r["text_en"] = ""
                            r["text_original"] = ""

                    response_data = {"points": rows}
                    status_code = 200

            elif path == "/api/stats":
                cursor.execute("SELECT count(*) FROM verses")
                verses_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM lexicon_fts")
                lexicon_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM dictionary_entries")
                dict_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM geography_places")
                places_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM timeline_events")
                events_count = cursor.fetchone()[0]
                cursor.execute("SELECT count(*) FROM people")
                people_count = cursor.fetchone()[0]
                
                response_data = {
                    "status": "connected",
                    "stats": {
                        "verses": verses_count,
                        "lexicon": lexicon_count,
                        "dictionaries": dict_count,
                        "places": places_count,
                        "events": events_count,
                        "people": people_count
                    }
                }
                status_code = 200

            elif path == "/api/timeline":
                cursor.execute("SELECT * FROM timeline_events ORDER BY year")
                events_list = []
                for e in cursor.fetchall():
                    event_dict = dict(e)
                    cursor.execute("SELECT verse_id FROM event_verses WHERE event_id = ?", (e['event_id'],))
                    event_dict['verses'] = [row[0] for row in cursor.fetchall()]
                    events_list.append(event_dict)
                response_data = {"events": events_list}
                status_code = 200

            elif path == "/api/sessions":
                cursor.execute("SELECT session_id, title, content, updated_at FROM sessions ORDER BY updated_at DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                response_data = {"sessions": rows}
                status_code = 200

            elif path == "/api/sessions/search":
                q = query_params.get("q", [None])[0]
                if q:
                    match_query = f"{q}*"
                    cursor.execute("""
                        SELECT s.session_id, s.title, s.content, s.updated_at
                        FROM sessions s
                        JOIN sessions_fts f ON s.session_id = f.session_id
                        WHERE sessions_fts MATCH ?
                        ORDER BY s.updated_at DESC
                    """, (match_query,))
                else:
                    cursor.execute("SELECT session_id, title, content, updated_at FROM sessions ORDER BY updated_at DESC")
                rows = [dict(r) for r in cursor.fetchall()]
                response_data = {"sessions": rows}
                status_code = 200

        except Exception as e:
            response_data = {"error": str(e)}
            status_code = 500
        finally:
            conn.close()

        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode('utf-8'))

def start_http_server():
    server = HTTPServer(('0.0.0.0', 5050), JSONAPIHandler)
    print("Built-in HTTP JSON API Server running on port 5050...")
    server.serve_forever()

if __name__ == "__main__":
    # Cache lexicon lemmas first
    build_lexicon_lookup()

    import sys
    # If stdin is not a TTY (running in background, redirect, or daemon), run HTTP server in the main thread
    if not sys.stdin.isatty():
        print("Non-interactive mode detected. Running HTTP JSON API Server on main thread...")
        start_http_server()
    else:
        print("Interactive mode detected. Running HTTP JSON API Server on thread and MCP stdio on main thread...")
        api_thread = threading.Thread(target=start_http_server, daemon=True)
        api_thread.start()
        # Start the MCP server (blocks on stdio)
        mcp.run()

