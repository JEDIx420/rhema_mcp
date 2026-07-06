# English translation integration and provenance

Rhelo offers three globally selectable, offline English editions. BSB is the application default; WEB and KJV can be chosen from the **Translation** tab of the book/chapter modal. The choice is stored in browser local storage under `rhelo-english-translation` and appended to frontend API requests.

## Sources and rights

| Code | Full name | Import source | Rights note |
|---|---|---|---|
| `en_bsb` | Berean Standard Bible | [Berean Bible download](https://berean.bible/downloads.htm), imported from `https://bereanbible.com/bsb.txt` | Public domain since April 30, 2023 |
| `en_web` | World English Bible, Protestant canon | [eBible.org WEB files](https://ebible.org/Scriptures/details.php?id=engwebp), imported from `engwebp_vpl.zip` | Public domain; “World English Bible” is an eBible.org trademark |
| `en_kjv` | King James Version | [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv) repository archive | Public-domain KJV text; repository packaging is MIT licensed |

The Brady Stephenson `bible-data` project is used elsewhere for people, relationships, Nave's entries, and name data. It is not used as the WEB verse source because it is not a WEB scripture corpus.

## Import pipeline

`migrations/012_add_english_translations.py`:

1. Downloads the three upstream artifacts with a Rhelo user agent.
2. Parses each source's reference convention.
3. Maps source book names to Rhelo's three-character codes.
4. Produces IDs such as `GEN.1.1`.
5. Upserts direct source rows into `verse_translations`.
6. Rebuilds `search_english_translations` with one effective row for every canonical verse and edition.

The migration is repeatable: it replaces rows for these three edition codes and recreates their search index instead of widening `verses_base` or the compatibility view.

## Coverage and fallback

The current source rows cover 31,080 BSB verses, 31,089 WEB verses, and 31,096 KJV verses against 31,100 canonical verse slots. Modern editions and source files differ in how they number a small set of traditional verses.

Rhelo handles this in two places:

- Chapter/detail queries use `COALESCE(selected_edition_text, legacy_text_en)`.
- The edition FTS migration fills missing edition slots from KJV before indexing.

This means callers always receive a complete canonical chapter and complete edition search index. A fallback row remains labeled with the edition the user requested because it occupies only a missing traditional verse number; it does not silently switch the entire chapter or global selection.

## API behavior

Accepted codes are centralized in both `rhelo_backend/translations.py` and `frontend/src/lib/englishTranslations.ts`. Unknown or absent values normalize to `en_bsb`.

Edition-aware HTTP endpoints include chapter reading, search, verse details/cross-references, lexicon occurrences, chapter map decoration, and route-point decoration. MCP's `search_scriptures` and `get_verse_details` accept the same optional code.

Indic text is independent of the active English edition. Hindi, Telugu, Malayalam, and Tamil remain parallel reading columns. TTS is intentionally limited to English plus Hebrew/Greek source text.

## Reproducibility limitation

The migration currently downloads live upstream URLs and does not verify pinned checksums. For deterministic releases, capture source versions, hashes, retrieval dates, and license snapshots in a generated data manifest before producing the release database.
