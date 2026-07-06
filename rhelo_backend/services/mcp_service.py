from __future__ import annotations

from rhelo_backend.database import connection
from rhelo_backend.translations import normalize_translation_code


def search_scriptures(query: str, book: str | None = None, translation_code: str = "en_bsb") -> str:
    """Search an English Bible edition, optionally limited to one book code."""
    translation_code = normalize_translation_code(translation_code)
    sql = "SELECT id, text FROM search_english_translations WHERE search_english_translations MATCH ? AND translation_code = ?"
    params: list[object] = [query, translation_code]
    if book:
        sql += " AND book = ?"
        params.append(book.upper())
    sql += " LIMIT 50"
    try:
        with connection() as database:
            rows = database.execute(sql, params).fetchall()
        return "\n".join(f"[{row['id']}] {row['text']}" for row in rows) or f"No results found for query: '{query}'"
    except Exception as error:
        return f"Error executing search: {error}"


def get_verse_details(verse_id: str, translation_code: str = "en_bsb") -> str:
    """Return multilingual text and linked study material for one verse."""
    verse_id = verse_id.upper()
    translation_code = normalize_translation_code(translation_code)
    try:
        with connection() as database:
            verse = database.execute("""
                SELECT v.*, COALESCE(et.text, v.text_en) AS active_text_en
                FROM verses v LEFT JOIN verse_translations et
                  ON et.verse_id = v.id AND et.translation_code = ?
                WHERE v.id = ?
            """, (translation_code, verse_id)).fetchone()
            if not verse:
                return f"Verse '{verse_id}' not found in database."
            commentaries = database.execute("SELECT commentary_id, text FROM commentaries WHERE verse_id = ?", (verse_id,)).fetchall()
            places = database.execute("""SELECT gp.name, gp.latitude, gp.longitude, gp.type FROM geography_places gp JOIN verse_geography vg ON gp.place_id = vg.place_id WHERE vg.verse_id = ?""", (verse_id,)).fetchall()
            events = database.execute("""SELECT te.title, te.year, te.location, te.description FROM timeline_events te JOIN event_verses ev ON te.event_id = ev.event_id WHERE ev.verse_id = ?""", (verse_id,)).fetchall()
            cross_refs = database.execute("SELECT to_verse, votes FROM cross_references WHERE from_verse = ? ORDER BY votes DESC LIMIT 10", (verse_id,)).fetchall()
        output = [f"=== Verse Details: {verse['id']} ===", f"English ({translation_code}): {verse['active_text_en']}", f"Original Text (Hebrew/Greek): {verse['text_original']}"]
        for label, column in (("Hindi", "text_hi"), ("Telugu", "text_te"), ("Malayalam", "text_ml"), ("Tamil", "text_ta")):
            output.append(f"{label}: {verse[column]}")
        if commentaries:
            output.extend(["", "--- Commentaries ---", *(f"[{row['commentary_id']}]: {row['text']}" for row in commentaries)])
        if places:
            output.extend(["", "--- Geography (Geocoded Places) ---", *(f"- {row['name']} ({row['type']}) at Coordinates: ({row['latitude']}, {row['longitude']})" for row in places)])
        if events:
            output.append("\n--- Chronological Timeline Events ---")
            for row in events:
                year = f"{abs(row['year'])} BC" if row['year'] < 0 else f"AD {row['year']}"
                output.append(f"- {row['title']} ({year}) at {row['location']}: {row['description']}")
        if cross_refs:
            output.extend(["", "--- Top Cross-References ---", *(f"- {row['to_verse']} (votes: {row['votes']})" for row in cross_refs)])
        return "\n".join(output)
    except Exception as error:
        return f"Error retrieving verse details: {error}"


def search_dictionary_and_lexicon(query: str) -> str:
    """Search Bible dictionaries and the Hebrew/Greek Strong's lexicon."""
    try:
        with connection() as database:
            dictionaries = database.execute("SELECT name, definition_text FROM dictionary_fts WHERE dictionary_fts MATCH ? LIMIT 15", (query,)).fetchall()
            lexicon = database.execute("SELECT strongs_id, lemma, definition FROM lexicon_fts WHERE lexicon_fts MATCH ? LIMIT 15", (query,)).fetchall()
        output: list[str] = []
        if dictionaries:
            output.append("=== Bible Dictionary Matches ===")
            for row in dictionaries:
                output.extend((f"Term: {row['name']}", f"Definition: {row['definition_text'][:300]}...", "-" * 30))
        if lexicon:
            output.append("\n=== Strong's Lexicon Matches ===")
            for row in lexicon:
                output.extend((f"Strong's ID: {row['strongs_id']} | Lemma: {row['lemma']}", f"Definition: {row['definition']}", "-" * 30))
        return "\n".join(output) or f"No dictionary or lexicon matches found for: '{query}'"
    except Exception as error:
        return f"Error executing lookup: {error}"


def search_topics(query: str) -> str:
    """Search Nave's Topical Index for subjects and scripture references."""
    try:
        with connection() as database:
            rows = database.execute("SELECT subject, entry FROM naves_fts WHERE naves_fts MATCH ? LIMIT 15", (query,)).fetchall()
        if not rows:
            return f"No topical matches found in Nave's Index for: '{query}'"
        return "\n".join(["=== Nave's Topical Index Matches ===", *(f"Subject: {row['subject']}\nEntry References: {row['entry']}\n{'-' * 40}" for row in rows)])
    except Exception as error:
        return f"Error executing topical search: {error}"


def get_biography(person_id: str) -> str:
    """Return a biblical person's profile, name meaning, and relationships."""
    try:
        with connection() as database:
            person = database.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()
            if not person:
                person = database.execute("SELECT * FROM people WHERE name LIKE ? LIMIT 1", (f"{person_id}%",)).fetchone()
            if not person:
                return f"Person '{person_id}' not found in database."
            relations = database.execute("""SELECT r.relationship_type, p.name relation_name, r.person_id_2 relation_id, r.verse_id FROM relationships r JOIN people p ON r.person_id_2 = p.id WHERE r.person_id_1 = ?""", (person['id'],)).fetchall()
            meaning = database.execute("SELECT meaning FROM bible_names_dictionary WHERE name = ?", (person['name'],)).fetchone()
        output = [f"=== Biographical Profile: {person['name']} ===", f"ID: {person['id']}", f"Sex: {person['sex']}"]
        for label, column in (("Tribe", "tribe"), ("Attribute", "unique_attribute"), ("Notes", "notes")):
            if person[column]: output.append(f"{label}: {person[column]}")
        if meaning: output.append(f"Name Meaning (Hitchcock's): {meaning['meaning']}")
        if relations:
            output.append("\n--- Family & Social Relationships ---")
            for row in relations:
                reference = f" in {row['verse_id']}" if row['verse_id'] else ""
                output.append(f"- {person['name']} is the {row['relationship_type']} of {row['relation_name']} ({row['relation_id']}){reference}")
        return "\n".join(output)
    except Exception as error:
        return f"Error retrieving biography: {error}"


def list_geography_routes() -> str:
    """List the curated biblical journeys available in the local atlas."""
    try:
        with connection() as database:
            rows = database.execute("SELECT route_id, title, description FROM geography_routes ORDER BY route_id").fetchall()
        if not rows: return "No historical routes found in the database."
        output = ["=== Historical Biblical Routes ==="]
        for row in rows:
            output.append(f"- ID: {row['route_id']} | Title: {row['title']}")
            if row['description']: output.append(f"  Description: {row['description']}")
        return "\n".join(output)
    except Exception as error:
        return f"Error listing routes: {error}"


def get_route_points(route_id: str) -> str:
    """Return the ordered locations and scripture references for a route."""
    try:
        with connection() as database:
            route = database.execute("SELECT title, description FROM geography_routes WHERE route_id = ?", (route_id.lower(),)).fetchone()
            if not route: return f"Route '{route_id}' not found."
            rows = database.execute("SELECT sequence_order, latitude, longitude, place_name, associated_verse_id FROM route_points WHERE route_id = ? ORDER BY sequence_order", (route_id.lower(),)).fetchall()
        output = [f"=== Route: {route['title']} ===", route['description'] or "", ""]
        for row in rows:
            reference = f" (Ref: {row['associated_verse_id']})" if row['associated_verse_id'] else ""
            output.append(f"{row['sequence_order']}. {row['place_name']}{reference} at Coordinates: ({row['latitude']}, {row['longitude']})")
        return "\n".join(output)
    except Exception as error:
        return f"Error getting route points: {error}"


def get_chapter_map_data(book: str, chapter: int) -> str:
    """Return geocoded places associated with a Bible book and chapter."""
    try:
        with connection() as database:
            rows = database.execute("""SELECT DISTINCT gp.name, gp.latitude, gp.longitude, gp.type, vg.verse_id FROM geography_places gp JOIN verse_geography vg ON gp.place_id = vg.place_id JOIN verses v ON vg.verse_id = v.id WHERE v.book = ? AND v.chapter = ? ORDER BY vg.verse_id""", (book.upper(), chapter)).fetchall()
        if not rows: return f"No geocoded places found in {book.upper()} chapter {chapter}."
        return "\n".join([f"=== Geocoded Places in {book.upper()} Chapter {chapter} ===", *(f"[{row['verse_id']}] {row['name']} ({row['type']}) at Coordinates: ({row['latitude']}, {row['longitude']})" for row in rows)])
    except Exception as error:
        return f"Error retrieving chapter maps: {error}"
