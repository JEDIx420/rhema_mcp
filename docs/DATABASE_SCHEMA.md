# Rhema Database Schema Specification

This document defines the schema, table details, virtual search indices, and relationships of `rhema.db`.

---

## 📊 Database Schema Entity Relationship

```mermaid
erDiagram
    VERSES {
        string id PK
        string book
        int chapter
        int verse
        string text_en
        string text_original
        string morphology
        string text_hi
        string text_te
        string text_ml
        string text_ta
    }

    COMMENTARIES {
        string commentary_id PK
        string verse_id PK, FK
        string text
    }

    GEOGRAPHY_PLACES {
        string place_id PK
        string name
        real latitude
        real longitude
        string type
    }

    VERSE_GEOGRAPHY {
        string verse_id PK, FK
        string place_id PK, FK
    }

    TIMELINE_EVENTS {
        string event_id PK
        string title
        int year
        string location
        string description
    }

    EVENT_VERSES {
        string event_id PK, FK
        string verse_id PK, FK
    }

    CROSS_REFERENCES {
        string from_verse PK, FK
        string to_verse PK, FK
        int votes
    }

    PEOPLE {
        string id PK
        string name
        string sex
        string tribe
        string unique_attribute
        string notes
    }

    RELATIONSHIPS {
        string id PK
        string person_id_1 FK
        string relationship_type
        string person_id_2 FK
        string verse_id FK
        string notes
    }

    PEOPLE_VERSES {
        string person_id PK, FK
        string verse_id PK, FK
    }

    BIBLE_NAMES_DICTIONARY {
        string name PK
        string meaning
    }

    NAVES_TOPICAL_DICTIONARY {
        int id PK
        string subject
        string entry
    }

    VERSES ||--o{ COMMENTARIES : has
    VERSES ||--o{ VERSE_GEOGRAPHY : mentions
    GEOGRAPHY_PLACES ||--o{ VERSE_GEOGRAPHY : mapped_at
    VERSES ||--o{ EVENT_VERSES : linked_in
    TIMELINE_EVENTS ||--o{ EVENT_VERSES : groups
    VERSES ||--o{ CROSS_REFERENCES : references
    PEOPLE ||--o{ RELATIONSHIPS : relates_from
    PEOPLE ||--o{ RELATIONSHIPS : relates_to
    PEOPLE ||--o{ PEOPLE_VERSES : links
    VERSES ||--o{ PEOPLE_VERSES : mentioned_in
```

---

## ⚡ Virtual FTS5 tables (Lightning-Fast Search)

Three virtual FTS5 indices exist to perform instant lookups:
1.  **`search_en`**: Indexes `id`, `book`, `chapter`, `verse`, and `text_en` for scriptures.
2.  **`dictionary_fts`**: Indexes `slug`, `name`, and `definition_text` combining Easton's and Smith's Bible dictionaries.
3.  **`naves_fts`**: Indexes `subject` and `entry` for Nave's Topical Index.
4.  **`lexicon_fts`**: Indexes `strongs_id`, `lemma`, and `definition` for Strong's lexicon.
