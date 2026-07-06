# English translation sources

Rhelo ships three offline English translations in `verse_translations`:

| Code | Translation | Source | Rights |
|---|---|---|---|
| `en_bsb` | Berean Standard Bible | https://berean.bible/downloads.htm (`bsb.txt`) | Public domain since April 30, 2023 |
| `en_web` | World English Bible, Protestant canon | https://ebible.org/Scriptures/details.php?id=engwebp (`engwebp_vpl.zip`) | Public domain; “World English Bible” is an eBible.org trademark |
| `en_kjv` | King James Version | https://github.com/aruljohn/Bible-kjv | Public-domain KJV text; repository code/data packaging is MIT licensed |

`migrations/012_add_english_translations.py` downloads these exact upstream files, maps references to Rhelo IDs such as `GEN.1.1`, and inserts them idempotently. Modern translations do not number every traditional KJV verse. Reads and the translation-specific FTS5 index therefore fall back to KJV for missing verse numbers.

The Brady Stephenson `bible-data` repository was evaluated but is not used for WEB scripture text because it contains relational biblical people, place, and reference data rather than a WEB verse corpus.
