"""Seed BSB, WEB, and KJV into verse_translations and build translation FTS."""

from __future__ import annotations

import io
import json
import re
import sqlite3
import urllib.request
import zipfile


DB_PATH = "rhelo.db"
BSB_URL = "https://bereanbible.com/bsb.txt"
WEB_URL = "https://ebible.org/Scriptures/engwebp_vpl.zip"
KJV_URL = "https://github.com/aruljohn/Bible-kjv/archive/refs/heads/master.zip"

WEB_BOOK_CODES = {
    "1JO": "1JN", "2JO": "2JN", "3JO": "3JN", "EZE": "EZK", "JAM": "JAS",
    "JOE": "JOL", "JOH": "JHN", "MAR": "MRK", "NAH": "NAM", "OBA": "OBD",
    "PHI": "PHP", "SOL": "SNG",
}

BOOK_CODES = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM", "Deuteronomy": "DEU",
    "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR",
    "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA", "Psalm": "PSA",
    "Proverbs": "PRO", "Ecclesiastes": "ECC", "Song of Solomon": "SNG", "Isaiah": "ISA", "Jeremiah": "JER",
    "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL",
    "Amos": "AMO", "Obadiah": "OBD", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM",
    "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
    "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT", "Romans": "ROM",
    "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL", "Ephesians": "EPH",
    "Philippians": "PHP", "Colossians": "COL", "1 Thessalonians": "1TH", "2 Thessalonians": "2TH",
    "1 Timothy": "1TI", "2 Timothy": "2TI", "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB",
    "James": "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN",
    "3 John": "3JN", "Jude": "JUD", "Revelation": "REV",
}


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Rhelo/0.1 translation importer"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def parse_bsb(raw: bytes) -> dict[str, str]:
    verses: dict[str, str] = {}
    pattern = re.compile(r"^(.+?) (\d+):(\d+)$")
    for line in raw.decode("utf-8-sig").splitlines()[3:]:
        if "\t" not in line:
            continue
        reference, text = line.split("\t", 1)
        match = pattern.match(reference.strip())
        if not match or match.group(1) not in BOOK_CODES:
            continue
        book, chapter, verse = match.groups()
        verses[f"{BOOK_CODES[book]}.{int(chapter)}.{int(verse)}"] = text.strip()
    return verses


def parse_web(raw: bytes) -> dict[str, str]:
    verses: dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        content = archive.read("engwebp_vpl.txt").decode("utf-8-sig")
    pattern = re.compile(r"^([1-3A-Z]{3}) (\d+):(\d+) (.+)$")
    for line in content.splitlines():
        match = pattern.match(line)
        if match:
            book, chapter, verse, text = match.groups()
            book = WEB_BOOK_CODES.get(book, book)
            verses[f"{book}.{int(chapter)}.{int(verse)}"] = text.strip()
    return verses


def parse_kjv(raw: bytes) -> dict[str, str]:
    verses: dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for filename in archive.namelist():
            if not filename.endswith(".json") or filename.endswith("Books.json"):
                continue
            document = json.loads(archive.read(filename))
            book_code = BOOK_CODES.get(document.get("book"))
            if not book_code:
                continue
            for chapter in document.get("chapters", []):
                for verse in chapter.get("verses", []):
                    verse_id = f"{book_code}.{int(chapter['chapter'])}.{int(verse['verse'])}"
                    verses[verse_id] = verse["text"].strip()
    return verses


def seed_translation(cursor: sqlite3.Cursor, code: str, verses: dict[str, str], valid_ids: set[str]) -> int:
    rows = [(verse_id, code, text) for verse_id, text in verses.items() if verse_id in valid_ids and text]
    if len(rows) < int(len(valid_ids) * 0.99):
        raise RuntimeError(f"{code} coverage is unexpectedly low: {len(rows)}/{len(valid_ids)}")
    cursor.executemany(
        "INSERT OR REPLACE INTO verse_translations (verse_id, translation_code, text) VALUES (?, ?, ?)", rows
    )
    return len(rows)


def main() -> None:
    print("Downloading official public-domain English translation datasets...")
    datasets = {
        "en_bsb": parse_bsb(download(BSB_URL)),
        "en_web": parse_web(download(WEB_URL)),
        "en_kjv": parse_kjv(download(KJV_URL)),
    }
    connection = sqlite3.connect(DB_PATH)
    try:
        cursor = connection.cursor()
        valid_ids = {row[0] for row in cursor.execute("SELECT id FROM verses_base")}
        counts = {code: seed_translation(cursor, code, verses, valid_ids) for code, verses in datasets.items()}

        cursor.execute("DROP TABLE IF EXISTS search_english_translations")
        cursor.execute("""
            CREATE VIRTUAL TABLE search_english_translations USING fts5(
                id UNINDEXED, book UNINDEXED, chapter UNINDEXED, verse UNINDEXED,
                translation_code UNINDEXED, text
            )
        """)
        cursor.execute("""
            INSERT INTO search_english_translations(id, book, chapter, verse, translation_code, text)
            WITH codes(translation_code) AS (VALUES ('en_bsb'), ('en_web'), ('en_kjv'))
            SELECT vb.id, vb.book, vb.chapter, vb.verse, codes.translation_code,
                   COALESCE(selected.text, kjv.text, legacy.text)
            FROM verses_base vb CROSS JOIN codes
            LEFT JOIN verse_translations selected
              ON selected.verse_id = vb.id AND selected.translation_code = codes.translation_code
            LEFT JOIN verse_translations kjv
              ON kjv.verse_id = vb.id AND kjv.translation_code = 'en_kjv'
            LEFT JOIN verse_translations legacy
              ON legacy.verse_id = vb.id AND legacy.translation_code = 'en'
        """)
        connection.commit()
        print("Seeded English translations:", ", ".join(f"{code}={count}" for code, count in counts.items()))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
