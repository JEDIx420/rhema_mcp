use crate::{normalize_english_translation, open_database, DatabaseState};
use regex::{Regex, RegexBuilder};
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use tauri::Manager;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

const OLD_TESTAMENT: &[&str] = &[
    "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH",
    "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK",
    "DAN", "HOS", "JOL", "AMO", "OBD", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
];

const NEW_TESTAMENT: &[&str] = &[
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH",
    "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
    "REV",
];

#[derive(Serialize)]
struct ScriptureSearchResult {
    id: String,
    book: String,
    chapter: i64,
    verse: i64,
    text_en: String,
    rank: f64,
}

#[derive(Serialize)]
pub(crate) struct ScriptureSearchResponse {
    results: Vec<ScriptureSearchResult>,
    total: usize,
    page: usize,
    limit: usize,
    matching_books: Vec<String>,
    matching_testaments: Vec<&'static str>,
    translation_code: &'static str,
}

fn canonical_book_index(book: &str) -> usize {
    OLD_TESTAMENT
        .iter()
        .chain(NEW_TESTAMENT.iter())
        .position(|candidate| *candidate == book)
        .unwrap_or(usize::MAX)
}

#[tauri::command]
pub(crate) fn search_scripture(
    query: String,
    book: Option<String>,
    testament: Option<String>,
    sort: Option<String>,
    page: Option<usize>,
    limit: Option<usize>,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ScriptureSearchResponse, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("A Scripture search query is required.".to_string());
    }

    let translation_code = normalize_english_translation(translation_code.as_deref());
    let page = page.unwrap_or(1).max(1);
    let limit = limit.unwrap_or(50).clamp(1, 200);
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, book, chapter, verse, text, rank
             FROM search_english_translations
             WHERE search_english_translations MATCH ?1 AND translation_code = ?2",
        )
        .map_err(|error| format!("Failed to prepare Scripture search: {error}"))?;

    let all_results = statement
        .query_map(params![query, translation_code], |row| {
            Ok(ScriptureSearchResult {
                id: row.get(0)?,
                book: row.get(1)?,
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text_en: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                rank: row.get::<_, Option<f64>>(5)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Scripture search failed for '{query}': {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode Scripture search results: {error}"))?;

    let matching_books = all_results
        .iter()
        .map(|result| result.book.to_ascii_uppercase())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let mut matching_testaments = Vec::new();
    if matching_books
        .iter()
        .any(|candidate| OLD_TESTAMENT.contains(&candidate.as_str()))
    {
        matching_testaments.push("OT");
    }
    if matching_books
        .iter()
        .any(|candidate| NEW_TESTAMENT.contains(&candidate.as_str()))
    {
        matching_testaments.push("NT");
    }

    let requested_book = book
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("ALL"))
        .map(str::to_ascii_uppercase);
    let requested_testament = testament
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("ALL"))
        .map(str::to_ascii_uppercase);
    let mut filtered = all_results
        .into_iter()
        .filter(|result| {
            requested_book.as_ref().map_or(true, |candidate| {
                result.book.eq_ignore_ascii_case(candidate)
            })
        })
        .filter(|result| match requested_testament.as_deref() {
            Some("OT") => OLD_TESTAMENT.contains(&result.book.as_str()),
            Some("NT") => NEW_TESTAMENT.contains(&result.book.as_str()),
            _ => true,
        })
        .collect::<Vec<_>>();

    if sort.as_deref() == Some("canonical") {
        filtered.sort_by_key(|result| {
            (
                canonical_book_index(&result.book),
                result.chapter,
                result.verse,
            )
        });
    } else {
        filtered.sort_by(|left, right| {
            left.rank
                .partial_cmp(&right.rank)
                .unwrap_or(Ordering::Equal)
        });
    }

    let total = filtered.len();
    let offset = page.saturating_sub(1).saturating_mul(limit);
    let results = filtered.into_iter().skip(offset).take(limit).collect();

    Ok(ScriptureSearchResponse {
        results,
        total,
        page,
        limit,
        matching_books,
        matching_testaments,
        translation_code,
    })
}

#[derive(Serialize)]
struct LexiconEntry {
    strongs_id: String,
    lemma: String,
    definition: String,
}

#[derive(Serialize)]
struct DictionaryEntry {
    name: String,
    definition_text: String,
}

#[derive(Serialize)]
struct LexiconOccurrence {
    id: String,
    book: String,
    chapter: i64,
    verse: i64,
    text_en: String,
    text_original: String,
}

#[derive(Serialize)]
pub(crate) struct LexiconLookupResponse {
    results: Vec<LexiconEntry>,
    occurrences: Vec<LexiconOccurrence>,
    lexicon: Vec<LexiconEntry>,
    dictionary: Vec<DictionaryEntry>,
}

fn query_occurrences(
    connection: &rusqlite::Connection,
    word: &str,
    translation_code: &str,
) -> Result<Vec<LexiconOccurrence>, String> {
    let select = "SELECT v.id, v.book, v.chapter, v.verse,
                         COALESCE(et.text, v.text_en), v.text_original
                  FROM verses v
                  LEFT JOIN verse_translations et
                    ON et.verse_id = v.id AND et.translation_code = ?1";
    let morphology_pattern = format!("%\"lemma\": \"{word}\"%");
    let mut morphology_statement = connection
        .prepare(&format!("{select} WHERE v.morphology LIKE ?2 LIMIT 20"))
        .map_err(|error| format!("Failed to prepare the occurrence query: {error}"))?;
    let decode = |row: &rusqlite::Row<'_>| {
        Ok(LexiconOccurrence {
            id: row.get(0)?,
            book: row.get(1)?,
            chapter: row.get(2)?,
            verse: row.get(3)?,
            text_en: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            text_original: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
        })
    };
    let mut occurrences = morphology_statement
        .query_map(params![translation_code, morphology_pattern], decode)
        .map_err(|error| format!("Failed to find morphology occurrences: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode morphology occurrences: {error}"))?;

    if occurrences.is_empty() {
        let original_pattern = format!("%{word}%");
        let mut original_statement = connection
            .prepare(&format!("{select} WHERE v.text_original LIKE ?2 LIMIT 20"))
            .map_err(|error| format!("Failed to prepare the original-text query: {error}"))?;
        occurrences = original_statement
            .query_map(params![translation_code, original_pattern], decode)
            .map_err(|error| format!("Failed to find original-text occurrences: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode original-text occurrences: {error}"))?;
    }

    Ok(occurrences)
}

fn normalize_lexicon_text(value: &str) -> String {
    value
        .nfd()
        .filter(|character| {
            !is_combining_mark(*character) && !('\u{0591}'..='\u{05c7}').contains(character)
        })
        .collect::<String>()
        .to_lowercase()
        .trim_matches(
            &[
                '.', ',', ';', ':', '!', '?', '\'', '"', '(', ')', '[', ']', '{', '}', '׃', '-',
            ][..],
        )
        .to_string()
}

fn find_matching_strongs(
    connection: &rusqlite::Connection,
    word: &str,
) -> Result<Vec<String>, String> {
    let normalized_word = normalize_lexicon_text(word);
    if normalized_word.is_empty() {
        return Ok(Vec::new());
    }

    let mut statement = connection
        .prepare("SELECT strongs_id, lemma FROM lexicon_fts")
        .map_err(|error| format!("Failed to prepare normalized lexicon lookup: {error}"))?;
    let entries = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("Failed to scan lexicon lemmas: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode lexicon lemmas: {error}"))?;

    let lookup = |candidate: &str| {
        entries
            .iter()
            .filter(|(_, lemma)| normalize_lexicon_text(lemma) == candidate)
            .map(|(strongs_id, _)| strongs_id.clone())
            .collect::<Vec<_>>()
    };
    let direct = lookup(&normalized_word);
    if !direct.is_empty() {
        return Ok(direct);
    }

    let is_hebrew = word
        .chars()
        .any(|character| ('\u{0590}'..='\u{05ff}').contains(&character));
    if is_hebrew {
        let prefixes = ['ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש', 'י', 'ת', 'א', 'נ'];
        let chars = normalized_word.chars().collect::<Vec<_>>();
        if chars.len() > 2 && prefixes.contains(&chars[0]) {
            let once = chars[1..].iter().collect::<String>();
            let matches = lookup(&once);
            if !matches.is_empty() {
                return Ok(matches);
            }
            let once_chars = once.chars().collect::<Vec<_>>();
            if once_chars.len() > 2 && prefixes.contains(&once_chars[0]) {
                return Ok(lookup(&once_chars[1..].iter().collect::<String>()));
            }
        }
    }

    Ok(Vec::new())
}

#[tauri::command]
pub(crate) fn lookup_lexicon(
    word_id: String,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<LexiconLookupResponse, String> {
    let word = word_id.trim();
    if word.is_empty() {
        return Err("A lexicon word or Strong's identifier is required.".to_string());
    }

    let translation_code = normalize_english_translation(translation_code.as_deref());
    let connection = open_database(&state.path)?;
    let mut exact_statement = connection
        .prepare(
            "SELECT strongs_id, lemma, definition
             FROM lexicon_fts
             WHERE strongs_id = ?1 OR lemma = ?1
             LIMIT 30",
        )
        .map_err(|error| format!("Failed to prepare the lexicon lookup: {error}"))?;
    let mut results = exact_statement
        .query_map([word], |row| {
            Ok(LexiconEntry {
                strongs_id: row.get(0)?,
                lemma: row.get(1)?,
                definition: row.get(2)?,
            })
        })
        .map_err(|error| format!("Failed to look up '{word}': {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode lexicon definitions: {error}"))?;
    if results.is_empty() {
        let matching_ids = find_matching_strongs(&connection, word)?;
        let mut by_id_statement = connection
            .prepare("SELECT strongs_id, lemma, definition FROM lexicon_fts WHERE strongs_id = ?1")
            .map_err(|error| format!("Failed to prepare Strong's lookup: {error}"))?;
        for strongs_id in matching_ids {
            if let Some(entry) = by_id_statement
                .query_row([strongs_id], |row| {
                    Ok(LexiconEntry {
                        strongs_id: row.get(0)?,
                        lemma: row.get(1)?,
                        definition: row.get(2)?,
                    })
                })
                .optional()
                .map_err(|error| format!("Failed to read normalized lexicon result: {error}"))?
            {
                results.push(entry);
            }
        }
    }

    let mut lexicon_statement = connection
        .prepare(
            "SELECT strongs_id, lemma, definition
             FROM lexicon_fts
             WHERE lexicon_fts MATCH ?1
             LIMIT 30",
        )
        .map_err(|error| format!("Failed to prepare lexicon search: {error}"))?;
    let lexicon = lexicon_statement
        .query_map([word], |row| {
            Ok(LexiconEntry {
                strongs_id: row.get(0)?,
                lemma: row.get(1)?,
                definition: row.get(2)?,
            })
        })
        .map_err(|error| format!("Lexicon search failed for '{word}': {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode lexicon search results: {error}"))?;
    if results.is_empty() {
        results = lexicon
            .iter()
            .filter(|entry| {
                entry.strongs_id.eq_ignore_ascii_case(word)
                    || entry.lemma.eq_ignore_ascii_case(word)
            })
            .map(|entry| LexiconEntry {
                strongs_id: entry.strongs_id.clone(),
                lemma: entry.lemma.clone(),
                definition: entry.definition.clone(),
            })
            .collect();
    }

    let mut dictionary_statement = connection
        .prepare(
            "SELECT name, definition_text
             FROM dictionary_fts
             WHERE dictionary_fts MATCH ?1
             LIMIT 30",
        )
        .map_err(|error| format!("Failed to prepare dictionary search: {error}"))?;
    let dictionary = dictionary_statement
        .query_map([word], |row| {
            Ok(DictionaryEntry {
                name: row.get(0)?,
                definition_text: row.get(1)?,
            })
        })
        .map_err(|error| format!("Dictionary search failed for '{word}': {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode dictionary results: {error}"))?;
    let occurrences = query_occurrences(&connection, word, translation_code)?;

    Ok(LexiconLookupResponse {
        results,
        occurrences,
        lexicon,
        dictionary,
    })
}

#[derive(Serialize)]
struct TopicEntry {
    subject: String,
    entry: String,
}

#[derive(Serialize)]
pub(crate) struct TopicsResponse {
    topics: Vec<TopicEntry>,
}

#[derive(Serialize)]
struct BiographyProfile {
    id: String,
    name: String,
    sex: String,
    tribe: Option<String>,
    unique_attribute: Option<String>,
    notes: Option<String>,
    children_count: i64,
    spouse_count: i64,
}

#[derive(Serialize)]
struct BiographyRelationship {
    relationship_type: String,
    relation_name: String,
    relation_id: String,
    relation_sex: String,
    verse_id: Option<String>,
    children_count: i64,
    spouse_count: i64,
}

#[derive(Serialize)]
pub(crate) struct BiographyResponse {
    profile: BiographyProfile,
    relationships: Vec<BiographyRelationship>,
    name_meaning: Option<String>,
}

#[derive(Serialize)]
struct TimelineEvent {
    event_id: String,
    title: String,
    year: i64,
    location: String,
    description: String,
    verses: Vec<String>,
}

#[derive(Serialize)]
pub(crate) struct TimelineResponse {
    events: Vec<TimelineEvent>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub(crate) enum ResearchMetaResponse {
    Topics(TopicsResponse),
    Biography(BiographyResponse),
    Timeline(TimelineResponse),
}

fn relationship_count(
    connection: &rusqlite::Connection,
    person_id: &str,
    kinds: &[&str],
) -> Result<i64, String> {
    let (first, second, third) = (kinds[0], kinds[1], kinds[2]);
    connection
        .query_row(
            "SELECT COUNT(*) FROM relationships
             WHERE person_id_1 = ?1 AND relationship_type IN (?2, ?3, ?4)",
            params![person_id, first, second, third],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to count relationships for {person_id}: {error}"))
}

fn fetch_biography(
    connection: &rusqlite::Connection,
    person_id: &str,
) -> Result<BiographyResponse, String> {
    let person = connection
        .query_row(
            "SELECT id, name, sex, tribe, unique_attribute, notes
             FROM people WHERE id = ?1",
            [person_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|error| format!("Failed to read biography '{person_id}': {error}"))?
        .or_else(|| {
            let prefix = format!("{person_id}%");
            connection
                .query_row(
                    "SELECT id, name, sex, tribe, unique_attribute, notes
                     FROM people WHERE name LIKE ?1 LIMIT 1",
                    [prefix],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, Option<String>>(3)?,
                            row.get::<_, Option<String>>(4)?,
                            row.get::<_, Option<String>>(5)?,
                        ))
                    },
                )
                .optional()
                .ok()
                .flatten()
        })
        .ok_or_else(|| format!("No biographical record was found for '{person_id}'."))?;

    let (id, name, sex, tribe, unique_attribute, notes) = person;
    let children_count = relationship_count(connection, &id, &["father", "mother", "Creator"])?;
    let spouse_count = relationship_count(connection, &id, &["wife", "husband", "concubine"])?;
    let mut relationship_statement = connection
        .prepare(
            "SELECT r.relationship_type, p.name, r.person_id_2, p.sex, r.verse_id
             FROM relationships r
             JOIN people p ON r.person_id_2 = p.id
             WHERE r.person_id_1 = ?1",
        )
        .map_err(|error| format!("Failed to prepare biography relationships: {error}"))?;
    let relation_records = relationship_statement
        .query_map([&id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| format!("Failed to read biography relationships: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode biography relationships: {error}"))?;
    let mut relationships = Vec::with_capacity(relation_records.len());
    for (relationship_type, relation_name, relation_id, relation_sex, verse_id) in relation_records
    {
        relationships.push(BiographyRelationship {
            children_count: relationship_count(
                connection,
                &relation_id,
                &["father", "mother", "Creator"],
            )?,
            spouse_count: relationship_count(
                connection,
                &relation_id,
                &["wife", "husband", "concubine"],
            )?,
            relationship_type,
            relation_name,
            relation_id,
            relation_sex,
            verse_id,
        });
    }
    let name_meaning = connection
        .query_row(
            "SELECT meaning FROM bible_names_dictionary WHERE name = ?1",
            [&name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Failed to read the name meaning for {name}: {error}"))?;

    Ok(BiographyResponse {
        profile: BiographyProfile {
            id,
            name,
            sex,
            tribe,
            unique_attribute,
            notes,
            children_count,
            spouse_count,
        },
        relationships,
        name_meaning,
    })
}

#[tauri::command]
pub(crate) fn fetch_research_meta(
    category: String,
    value: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ResearchMetaResponse, String> {
    let category = category.trim().to_ascii_lowercase();
    let connection = open_database(&state.path)?;

    match category.as_str() {
        "topics" => {
            let query = value.as_deref().map(str::trim).unwrap_or_default();
            if query.is_empty() {
                return Err("A topical research query is required.".to_string());
            }
            let mut statement = connection
                .prepare(
                    "SELECT subject, entry FROM naves_fts
                     WHERE naves_fts MATCH ?1 LIMIT 30",
                )
                .map_err(|error| format!("Failed to prepare topical search: {error}"))?;
            let topics = statement
                .query_map([query], |row| {
                    Ok(TopicEntry {
                        subject: row.get(0)?,
                        entry: row.get(1)?,
                    })
                })
                .map_err(|error| format!("Topical search failed for '{query}': {error}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Failed to decode topical results: {error}"))?;
            Ok(ResearchMetaResponse::Topics(TopicsResponse { topics }))
        }
        "biography" => {
            let person_id = value.as_deref().map(str::trim).unwrap_or_default();
            if person_id.is_empty() {
                return Err("A person identifier or name is required.".to_string());
            }
            fetch_biography(&connection, person_id).map(ResearchMetaResponse::Biography)
        }
        "timeline" => {
            let mut statement = connection
                .prepare(
                    "SELECT event_id, title, year, location, description
                     FROM timeline_events ORDER BY year",
                )
                .map_err(|error| format!("Failed to prepare the timeline query: {error}"))?;
            let records = statement
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<i64>>(2)?.unwrap_or_default(),
                        row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                        row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    ))
                })
                .map_err(|error| format!("Failed to read timeline events: {error}"))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| format!("Failed to decode timeline events: {error}"))?;
            drop(statement);

            let mut verse_statement = connection
                .prepare("SELECT verse_id FROM event_verses WHERE event_id = ?1")
                .map_err(|error| format!("Failed to prepare timeline references: {error}"))?;
            let mut events = Vec::with_capacity(records.len());
            for (event_id, title, year, location, description) in records {
                let verses = verse_statement
                    .query_map([&event_id], |row| row.get::<_, String>(0))
                    .map_err(|error| format!("Failed to read references for {event_id}: {error}"))?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|error| {
                        format!("Failed to decode references for {event_id}: {error}")
                    })?;
                events.push(TimelineEvent {
                    event_id,
                    title,
                    year,
                    location,
                    description,
                    verses,
                });
            }
            Ok(ResearchMetaResponse::Timeline(TimelineResponse { events }))
        }
        _ => Err(format!(
            "Unsupported research category '{category}'. Expected topics, biography, or timeline."
        )),
    }
}

#[derive(Serialize)]
struct VerseDetailVerse {
    id: String,
    book: String,
    chapter: i64,
    verse: i64,
    text_en: String,
    text_original: String,
    text_hi: String,
    text_te: String,
    text_ml: String,
    text_ta: String,
    cross_references_count: i64,
    places_count: i64,
    commentaries: Vec<String>,
    morphology: serde_json::Value,
}

#[derive(Serialize)]
struct VerseCommentary {
    commentary_id: String,
    text: String,
}

#[derive(Serialize)]
struct VersePlace {
    name: String,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(rename = "type")]
    place_type: String,
}

#[derive(Serialize)]
struct VerseEvent {
    title: String,
    year: i64,
    location: String,
    description: String,
}

#[derive(Serialize)]
struct CrossReference {
    to_verse: String,
    votes: i64,
    text_en: String,
}

#[derive(Serialize)]
pub(crate) struct VerseDetailsResponse {
    verse: VerseDetailVerse,
    commentaries: Vec<VerseCommentary>,
    places: Vec<VersePlace>,
    events: Vec<VerseEvent>,
    cross_references: Vec<CrossReference>,
    translation_code: &'static str,
}

#[tauri::command]
pub(crate) fn fetch_verse_details(
    verse_id: String,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<VerseDetailsResponse, String> {
    let verse_id = verse_id.trim().to_ascii_uppercase();
    if verse_id.is_empty() {
        return Err("A verse identifier is required.".to_string());
    }
    let translation_code = normalize_english_translation(translation_code.as_deref());
    let connection = open_database(&state.path)?;
    let mut verse = connection
        .query_row(
            "SELECT v.id, v.book, v.chapter, v.verse,
                    COALESCE(et.text, v.text_en), v.text_original,
                    v.text_hi, v.text_te, v.text_ml, v.text_ta, v.morphology
             FROM verses v
             LEFT JOIN verse_translations et
               ON et.verse_id = v.id AND et.translation_code = ?1
             WHERE v.id = ?2",
            params![translation_code, verse_id],
            |row| {
                let morphology = row
                    .get::<_, Option<String>>(10)?
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok())
                    .filter(serde_json::Value::is_array)
                    .unwrap_or_else(|| serde_json::Value::Array(Vec::new()));
                Ok(VerseDetailVerse {
                    id: row.get(0)?,
                    book: row.get(1)?,
                    chapter: row.get(2)?,
                    verse: row.get(3)?,
                    text_en: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    text_original: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                    text_hi: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                    text_te: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                    text_ml: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                    text_ta: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                    cross_references_count: 0,
                    places_count: 0,
                    commentaries: Vec::new(),
                    morphology,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Failed to read verse {verse_id}: {error}"))?
        .ok_or_else(|| format!("Verse '{verse_id}' was not found."))?;

    let mut commentary_statement = connection
        .prepare("SELECT commentary_id, text FROM commentaries WHERE verse_id = ?1")
        .map_err(|error| format!("Failed to prepare verse commentaries: {error}"))?;
    let commentaries = commentary_statement
        .query_map([&verse_id], |row| {
            Ok(VerseCommentary {
                commentary_id: row.get(0)?,
                text: row.get(1)?,
            })
        })
        .map_err(|error| format!("Failed to read verse commentaries: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode verse commentaries: {error}"))?;

    let mut place_statement = connection
        .prepare(
            "SELECT gp.name, gp.latitude, gp.longitude, gp.type
             FROM geography_places gp
             JOIN verse_geography vg ON gp.place_id = vg.place_id
             WHERE vg.verse_id = ?1",
        )
        .map_err(|error| format!("Failed to prepare verse places: {error}"))?;
    let places = place_statement
        .query_map([&verse_id], |row| {
            Ok(VersePlace {
                name: row.get(0)?,
                latitude: row.get(1)?,
                longitude: row.get(2)?,
                place_type: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Failed to read verse places: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode verse places: {error}"))?;

    let mut event_statement = connection
        .prepare(
            "SELECT te.title, te.year, te.location, te.description
             FROM timeline_events te
             JOIN event_verses ev ON te.event_id = ev.event_id
             WHERE ev.verse_id = ?1",
        )
        .map_err(|error| format!("Failed to prepare verse events: {error}"))?;
    let events = event_statement
        .query_map([&verse_id], |row| {
            Ok(VerseEvent {
                title: row.get(0)?,
                year: row.get::<_, Option<i64>>(1)?.unwrap_or_default(),
                location: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                description: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Failed to read verse events: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode verse events: {error}"))?;

    let mut cross_reference_statement = connection
        .prepare(
            "SELECT cr.to_verse, cr.votes, COALESCE(et.text, v.text_en)
             FROM cross_references cr
             LEFT JOIN verses v ON cr.to_verse = v.id
             LEFT JOIN verse_translations et
               ON et.verse_id = v.id AND et.translation_code = ?1
             WHERE cr.from_verse = ?2
             ORDER BY cr.votes DESC LIMIT 15",
        )
        .map_err(|error| format!("Failed to prepare cross-references: {error}"))?;
    let cross_references = cross_reference_statement
        .query_map(params![translation_code, verse_id], |row| {
            Ok(CrossReference {
                to_verse: row.get(0)?,
                votes: row.get::<_, Option<i64>>(1)?.unwrap_or_default(),
                text_en: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Failed to read cross-references: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode cross-references: {error}"))?;

    verse.cross_references_count = connection
        .query_row(
            "SELECT COUNT(*) FROM cross_references WHERE from_verse = ?1",
            [&verse_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to count cross-references: {error}"))?;
    verse.places_count = places.len() as i64;
    verse.commentaries = commentaries.iter().map(|item| item.text.clone()).collect();

    Ok(VerseDetailsResponse {
        verse,
        commentaries,
        places,
        events,
        cross_references,
        translation_code,
    })
}

#[derive(Serialize)]
struct ChapterMapPlace {
    name: String,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(rename = "type")]
    place_type: String,
    verse_id: String,
    text_en: String,
    text_original: String,
    meaning: Option<String>,
    commentary: Option<String>,
    dict_definition: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct ChapterMapResponse {
    places: Vec<ChapterMapPlace>,
}

fn verse_sort_key(verse_id: &str) -> (String, i64, i64) {
    let mut parts = verse_id.split('.');
    let book = parts.next().unwrap_or_default().to_string();
    let chapter = parts
        .next()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    let verse = parts
        .next()
        .and_then(|value| value.parse().ok())
        .unwrap_or(0);
    (book, chapter, verse)
}

#[tauri::command]
pub(crate) fn fetch_chapter_map(
    book: String,
    chapter: i64,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ChapterMapResponse, String> {
    let book = book.trim().to_ascii_uppercase();
    if book.is_empty() || chapter < 1 {
        return Err("A valid book and chapter are required for the chapter map.".to_string());
    }
    let translation_code = normalize_english_translation(translation_code.as_deref());
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare(
            "SELECT DISTINCT gp.name, gp.latitude, gp.longitude, gp.type, vg.verse_id
             FROM geography_places gp
             JOIN verse_geography vg ON gp.place_id = vg.place_id
             JOIN verses v ON vg.verse_id = v.id
             WHERE v.book = ?1 AND v.chapter = ?2",
        )
        .map_err(|error| format!("Failed to prepare chapter map: {error}"))?;
    let mut places = statement
        .query_map(params![book, chapter], |row| {
            Ok(ChapterMapPlace {
                name: row.get(0)?,
                latitude: row.get(1)?,
                longitude: row.get(2)?,
                place_type: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                verse_id: row.get(4)?,
                text_en: String::new(),
                text_original: String::new(),
                meaning: None,
                commentary: None,
                dict_definition: None,
            })
        })
        .map_err(|error| format!("Failed to read chapter map: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode chapter map: {error}"))?;
    drop(statement);

    if places.is_empty() {
        let mut verse_statement = connection
            .prepare("SELECT id, text_en FROM verses WHERE book = ?1 AND chapter = ?2")
            .map_err(|error| format!("Failed to prepare chapter-place fallback: {error}"))?;
        let chapter_verses = verse_statement
            .query_map(params![book, chapter], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                ))
            })
            .map_err(|error| format!("Failed to read chapter text: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode chapter text: {error}"))?;
        let word_regex = Regex::new(r"\b\w+\b").map_err(|error| error.to_string())?;
        let suffix_regex = Regex::new(r"\s+\d+$").map_err(|error| error.to_string())?;
        let chapter_words = chapter_verses
            .iter()
            .flat_map(|(_, text)| {
                word_regex
                    .find_iter(&text.to_lowercase())
                    .map(|item| item.as_str().to_string())
                    .collect::<Vec<_>>()
            })
            .collect::<HashSet<_>>();
        let common_stops = [
            "no", "so", "on", "am", "all", "but", "up", "red", "of", "in", "at", "by", "to", "for",
            "with", "the", "a", "an", "and", "or", "if", "be", "is", "are", "was", "were",
        ]
        .into_iter()
        .collect::<HashSet<_>>();
        let mut all_places_statement = connection
            .prepare("SELECT name, latitude, longitude, type FROM geography_places")
            .map_err(|error| format!("Failed to prepare place fallback: {error}"))?;
        let all_places = all_places_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<f64>>(1)?,
                    row.get::<_, Option<f64>>(2)?,
                    row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                ))
            })
            .map_err(|error| format!("Failed to read fallback places: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode fallback places: {error}"))?;
        let mut seen = HashSet::new();

        for (name, latitude, longitude, place_type) in all_places {
            let clean_name = suffix_regex.replace(&name, "").to_string();
            let place_lower = clean_name.to_lowercase();
            let first_word = word_regex.find(&place_lower).map(|item| item.as_str());
            if first_word.map_or(true, |word| !chapter_words.contains(word)) {
                continue;
            }
            let case_sensitive =
                common_stops.contains(place_lower.as_str()) || clean_name.len() <= 3;
            let place_regex = RegexBuilder::new(&format!(r"\b{}\b", regex::escape(&clean_name)))
                .case_insensitive(!case_sensitive)
                .build()
                .map_err(|error| format!("Failed to compile place matcher: {error}"))?;
            for (verse_id, text) in &chapter_verses {
                if place_regex.is_match(text) && seen.insert((clean_name.clone(), verse_id.clone()))
                {
                    places.push(ChapterMapPlace {
                        name: clean_name.clone(),
                        latitude,
                        longitude,
                        place_type: place_type.clone(),
                        verse_id: verse_id.clone(),
                        text_en: String::new(),
                        text_original: String::new(),
                        meaning: None,
                        commentary: None,
                        dict_definition: None,
                    });
                }
            }
        }
    }

    places.sort_by_key(|place| verse_sort_key(&place.verse_id));
    for place in &mut places {
        if let Some((text_en, text_original)) = connection
            .query_row(
                "SELECT COALESCE(et.text, v.text_en), v.text_original
                 FROM verses v LEFT JOIN verse_translations et
                   ON et.verse_id = v.id AND et.translation_code = ?1
                 WHERE v.id = ?2",
                params![translation_code, place.verse_id],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?.unwrap_or_default(),
                        row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    ))
                },
            )
            .optional()
            .map_err(|error| format!("Failed to decorate map verse: {error}"))?
        {
            place.text_en = text_en;
            place.text_original = text_original;
        }
        place.meaning = connection
            .query_row(
                "SELECT meaning FROM bible_names_dictionary WHERE name = ?1",
                [&place.name],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Failed to read place meaning: {error}"))?;
        place.commentary = connection
            .query_row(
                "SELECT text FROM commentaries WHERE verse_id = ?1 LIMIT 1",
                [&place.verse_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Failed to read place commentary: {error}"))?;
        place.dict_definition = connection
            .query_row(
                "SELECT d.definition_text
                 FROM dictionary_definitions d
                 JOIN dictionary_entries e ON d.entry_slug = e.slug
                 WHERE LOWER(e.name) = LOWER(?1) LIMIT 1",
                [&place.name],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Failed to read place definition: {error}"))?;
    }

    Ok(ChapterMapResponse { places })
}

#[derive(Serialize)]
struct GeographyRoute {
    route_id: String,
    title: String,
    description: String,
}

#[derive(Serialize)]
pub(crate) struct GeographyRoutesResponse {
    routes: Vec<GeographyRoute>,
}

#[tauri::command]
pub(crate) fn fetch_geography_routes(
    state: tauri::State<'_, DatabaseState>,
) -> Result<GeographyRoutesResponse, String> {
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare("SELECT route_id, title, description FROM geography_routes ORDER BY route_id")
        .map_err(|error| format!("Failed to prepare geography routes: {error}"))?;
    let routes = statement
        .query_map([], |row| {
            Ok(GeographyRoute {
                route_id: row.get(0)?,
                title: row.get(1)?,
                description: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Failed to read geography routes: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode geography routes: {error}"))?;
    Ok(GeographyRoutesResponse { routes })
}

#[derive(Serialize)]
struct RoutePoint {
    sequence_order: i64,
    latitude: f64,
    longitude: f64,
    place_name: String,
    associated_verse_id: String,
    text_en: String,
    text_original: String,
}

#[derive(Serialize)]
pub(crate) struct RoutePointsResponse {
    points: Vec<RoutePoint>,
}

#[tauri::command]
pub(crate) fn fetch_route_points(
    route_id: String,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<RoutePointsResponse, String> {
    let route_id = route_id.trim().to_ascii_lowercase();
    if route_id.is_empty() {
        return Err("A geography route identifier is required.".to_string());
    }
    let translation_code = normalize_english_translation(translation_code.as_deref());
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare(
            "SELECT rp.sequence_order, rp.latitude, rp.longitude, rp.place_name,
                    rp.associated_verse_id, COALESCE(et.text, v.text_en), v.text_original
             FROM route_points rp
             LEFT JOIN verses v ON UPPER(rp.associated_verse_id) = v.id
             LEFT JOIN verse_translations et
               ON et.verse_id = v.id AND et.translation_code = ?1
             WHERE rp.route_id = ?2 ORDER BY rp.sequence_order",
        )
        .map_err(|error| format!("Failed to prepare route points: {error}"))?;
    let points = statement
        .query_map(params![translation_code, route_id], |row| {
            Ok(RoutePoint {
                sequence_order: row.get(0)?,
                latitude: row.get(1)?,
                longitude: row.get(2)?,
                place_name: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                associated_verse_id: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                text_en: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                text_original: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            })
        })
        .map_err(|error| format!("Failed to read route points: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode route points: {error}"))?;
    Ok(RoutePointsResponse { points })
}

#[derive(Serialize)]
struct DatabaseStats {
    verses: i64,
    lexicon: i64,
    dictionaries: i64,
    places: i64,
    events: i64,
    people: i64,
}

#[derive(Serialize)]
pub(crate) struct StatsResponse {
    status: &'static str,
    stats: DatabaseStats,
}

#[tauri::command]
pub(crate) fn fetch_stats(state: tauri::State<'_, DatabaseState>) -> Result<StatsResponse, String> {
    let connection = open_database(&state.path)?;
    let count = |table: &str| -> Result<i64, String> {
        connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .map_err(|error| format!("Failed to count {table}: {error}"))
    };
    Ok(StatsResponse {
        status: "connected",
        stats: DatabaseStats {
            verses: count("verses")?,
            lexicon: count("lexicon_fts")?,
            dictionaries: count("dictionary_entries")?,
            places: count("geography_places")?,
            events: count("timeline_events")?,
            people: count("people")?,
        },
    })
}

#[derive(Serialize)]
struct SessionSearchResult {
    session_id: String,
    title: String,
    content: String,
    updated_at: String,
}

#[derive(Serialize)]
pub(crate) struct SessionSearchResponse {
    sessions: Vec<SessionSearchResult>,
}

#[tauri::command]
pub(crate) fn search_sessions(
    query: String,
    state: tauri::State<'_, DatabaseState>,
) -> Result<SessionSearchResponse, String> {
    let connection = open_database(&state.path)?;
    let query = query.trim();
    let (sql, match_query) = if query.is_empty() {
        (
            "SELECT session_id, title, content, updated_at FROM sessions ORDER BY updated_at DESC",
            None,
        )
    } else {
        (
            "SELECT s.session_id, s.title, s.content, s.updated_at
             FROM sessions s JOIN sessions_fts f ON s.session_id = f.session_id
             WHERE sessions_fts MATCH ?1 ORDER BY s.updated_at DESC",
            Some(format!("{query}*")),
        )
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("Failed to prepare session search: {error}"))?;
    let decode = |row: &rusqlite::Row<'_>| {
        Ok(SessionSearchResult {
            session_id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            updated_at: row.get(3)?,
        })
    };
    let sessions = match match_query {
        Some(value) => statement
            .query_map([value], decode)
            .map_err(|error| format!("Session search failed for '{query}': {error}"))?
            .collect::<Result<Vec<_>, _>>(),
        None => statement
            .query_map([], decode)
            .map_err(|error| format!("Failed to list sessions: {error}"))?
            .collect::<Result<Vec<_>, _>>(),
    }
    .map_err(|error| format!("Failed to decode session search results: {error}"))?;
    Ok(SessionSearchResponse { sessions })
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
enum PdfFontKind {
    Base,
    Hebrew,
    Devanagari,
    Telugu,
    Malayalam,
    Tamil,
}

const PDF_FONTS: &[(PdfFontKind, &str)] = &[
    (PdfFontKind::Base, "NotoSans-Regular.ttf"),
    (PdfFontKind::Hebrew, "NotoSansHebrew-Regular.ttf"),
    (PdfFontKind::Devanagari, "NotoSansDevanagari-Regular.ttf"),
    (PdfFontKind::Telugu, "NotoSansTelugu-Regular.ttf"),
    (PdfFontKind::Malayalam, "NotoSansMalayalam-Regular.ttf"),
    (PdfFontKind::Tamil, "NotoSansTamil-Regular.ttf"),
];

#[derive(Debug)]
struct PdfBlock {
    text: String,
    heading_level: u8,
}

fn decode_html_entities(value: &str) -> String {
    value
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
}

fn session_html_to_blocks(content: &str) -> Vec<PdfBlock> {
    let mut text = content.to_string();
    for (pattern, replacement) in [
        (r"(?is)<h1[^>]*>", "\n# "),
        (r"(?is)<h2[^>]*>", "\n## "),
        (r"(?is)<h3[^>]*>", "\n### "),
        (r"(?is)<blockquote[^>]*>", "\n> "),
        (r"(?is)<li[^>]*>", "\n• "),
        (r"(?is)<br\s*/?>", "\n"),
        (r"(?is)</(p|div|h1|h2|h3|blockquote|li|ul|ol)>", "\n"),
    ] {
        text = Regex::new(pattern)
            .expect("the PDF HTML normalization patterns are valid")
            .replace_all(&text, replacement)
            .into_owned();
    }
    text = Regex::new(r"(?is)<[^>]+>")
        .expect("the PDF tag pattern is valid")
        .replace_all(&text, "")
        .into_owned();

    decode_html_entities(&text)
        .lines()
        .filter_map(|line| {
            let normalized = line.split_whitespace().collect::<Vec<_>>().join(" ");
            if normalized.is_empty() {
                return None;
            }
            let (heading_level, text) = if let Some(value) = normalized.strip_prefix("### ") {
                (3, value)
            } else if let Some(value) = normalized.strip_prefix("## ") {
                (2, value)
            } else if let Some(value) = normalized.strip_prefix("# ") {
                (1, value)
            } else {
                (0, normalized.as_str())
            };
            Some(PdfBlock {
                text: text.to_string(),
                heading_level,
            })
        })
        .collect()
}

fn font_kind_for_char(character: char) -> PdfFontKind {
    match character as u32 {
        0x0590..=0x05FF => PdfFontKind::Hebrew,
        0x0900..=0x097F => PdfFontKind::Devanagari,
        0x0B80..=0x0BFF => PdfFontKind::Tamil,
        0x0C00..=0x0C7F => PdfFontKind::Telugu,
        0x0D00..=0x0D7F => PdfFontKind::Malayalam,
        _ => PdfFontKind::Base,
    }
}

fn font_runs(text: &str) -> Vec<(PdfFontKind, String)> {
    let mut runs: Vec<(PdfFontKind, String)> = Vec::new();
    for character in text.chars() {
        let kind = font_kind_for_char(character);
        if let Some((last_kind, value)) = runs.last_mut() {
            if *last_kind == kind || (character.is_whitespace() && *last_kind != PdfFontKind::Base)
            {
                value.push(character);
                continue;
            }
        }
        runs.push((kind, character.to_string()));
    }
    runs
}

fn mostly_hebrew(text: &str) -> bool {
    let visible = text
        .chars()
        .filter(|character| !character.is_whitespace())
        .count();
    let hebrew = text
        .chars()
        .filter(|character| matches!(*character as u32, 0x0590..=0x05FF))
        .count();
    visible > 0 && hebrew * 2 >= visible
}

fn reverse_rtl_clusters(text: &str) -> String {
    let mut clusters: Vec<String> = Vec::new();
    for character in text.chars() {
        if is_combining_mark(character) {
            if let Some(cluster) = clusters.last_mut() {
                cluster.push(character);
                continue;
            }
        }
        clusters.push(character.to_string());
    }
    clusters.reverse();
    clusters.concat()
}

fn wrap_pdf_text(text: &str, max_characters: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let projected =
            current.chars().count() + usize::from(!current.is_empty()) + word.chars().count();
        if projected > max_characters && !current.is_empty() {
            lines.push(current);
            current = String::new();
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn pdf_color(red: u8, green: u8, blue: u8) -> printpdf::Color {
    printpdf::Color::Rgb(printpdf::Rgb::new(
        red as f32 / 255.0,
        green as f32 / 255.0,
        blue as f32 / 255.0,
        None,
    ))
}

fn push_pdf_line(
    operations: &mut Vec<printpdf::Op>,
    text: &str,
    y_mm: f32,
    size: f32,
    color: printpdf::Color,
    fonts: &BTreeMap<PdfFontKind, printpdf::FontId>,
) {
    let rtl = mostly_hebrew(text);
    let rendered = if rtl {
        reverse_rtl_clusters(text)
    } else {
        text.to_string()
    };
    let estimated_width_mm = rendered.chars().count() as f32 * size * 0.19;
    let x_mm = if rtl {
        (192.0 - estimated_width_mm).max(18.0)
    } else {
        18.0
    };

    operations.push(printpdf::Op::StartTextSection);
    operations.push(printpdf::Op::SetTextCursor {
        pos: printpdf::Point::new(printpdf::Mm(x_mm), printpdf::Mm(y_mm)),
    });
    operations.push(printpdf::Op::SetFillColor { col: color });
    for (kind, value) in font_runs(&rendered) {
        if let Some(font_id) = fonts.get(&kind).or_else(|| fonts.get(&PdfFontKind::Base)) {
            operations.push(printpdf::Op::SetFont {
                font: printpdf::PdfFontHandle::External(font_id.clone()),
                size: printpdf::Pt(size),
            });
            operations.push(printpdf::Op::ShowText {
                items: vec![printpdf::TextItem::Text(value)],
            });
        }
    }
    operations.push(printpdf::Op::EndTextSection);
}

fn finish_pdf_page(
    pages: &mut Vec<printpdf::PdfPage>,
    mut operations: Vec<printpdf::Op>,
    fonts: &BTreeMap<PdfFontKind, printpdf::FontId>,
) {
    let page_number = pages.len() + 1;
    push_pdf_line(
        &mut operations,
        &format!("rhelo · {page_number}"),
        10.0,
        8.0,
        pdf_color(100, 116, 139),
        fonts,
    );
    pages.push(printpdf::PdfPage::new(
        printpdf::Mm(210.0),
        printpdf::Mm(297.0),
        operations,
    ));
}

fn render_session_pdf(
    title: &str,
    content: &str,
    font_bytes: BTreeMap<PdfFontKind, Vec<u8>>,
) -> Result<Vec<u8>, String> {
    let mut document = printpdf::PdfDocument::new(title);
    let mut font_warnings = Vec::new();
    let mut fonts = BTreeMap::new();
    for (kind, bytes) in font_bytes {
        let parsed = printpdf::ParsedFont::from_bytes(&bytes, 0, &mut font_warnings)
            .ok_or_else(|| format!("Failed to parse the bundled {kind:?} PDF font"))?;
        fonts.insert(kind, document.add_font(&parsed));
    }

    let mut pages = Vec::new();
    let mut operations = Vec::new();
    let mut y_mm = 278.0;
    push_pdf_line(
        &mut operations,
        "RHELO · STUDY SESSION",
        y_mm,
        8.5,
        pdf_color(37, 99, 235),
        &fonts,
    );
    y_mm -= 12.0;
    for line in wrap_pdf_text(title, 42) {
        push_pdf_line(
            &mut operations,
            &line,
            y_mm,
            24.0,
            pdf_color(15, 23, 42),
            &fonts,
        );
        y_mm -= 11.0;
    }
    y_mm -= 5.0;

    for block in session_html_to_blocks(content) {
        let (size, line_height, color, width) = match block.heading_level {
            1 => (18.0, 9.0, pdf_color(15, 23, 42), 50),
            2 => (15.0, 8.0, pdf_color(15, 23, 42), 60),
            3 => (13.0, 7.5, pdf_color(37, 99, 235), 68),
            _ => (11.0, 6.5, pdf_color(51, 65, 85), 82),
        };
        if block.heading_level > 0 {
            y_mm -= 2.0;
        }
        for line in wrap_pdf_text(&block.text, width) {
            if y_mm < 22.0 {
                finish_pdf_page(&mut pages, operations, &fonts);
                operations = Vec::new();
                y_mm = 278.0;
            }
            push_pdf_line(&mut operations, &line, y_mm, size, color.clone(), &fonts);
            y_mm -= line_height;
        }
        y_mm -= if block.heading_level > 0 { 2.0 } else { 3.0 };
    }

    finish_pdf_page(&mut pages, operations, &fonts);
    document.with_pages(pages);
    Ok(document.save(&printpdf::PdfSaveOptions::default(), &mut Vec::new()))
}

/// Generates a self-contained PDF in memory so the frontend can preview it and
/// let the native Tauri save dialog choose the final destination.
#[tauri::command]
pub(crate) fn generate_session_pdf(
    title: String,
    content: String,
    app: tauri::AppHandle,
) -> Result<Vec<u8>, String> {
    let title = title.trim();
    let safe_title = if title.is_empty() {
        "Study Session"
    } else {
        title
    };

    let mut fonts = BTreeMap::new();
    for (kind, filename) in PDF_FONTS {
        let resource_name = format!("fonts/{filename}");
        let font_path = app
            .path()
            .resolve(&resource_name, tauri::path::BaseDirectory::Resource)
            .map_err(|error| format!("Failed to resolve PDF font {filename}: {error}"))?;
        let bytes = std::fs::read(&font_path)
            .map_err(|error| format!("Failed to load PDF font at {:?}: {error}", font_path))?;
        fonts.insert(*kind, bytes);
    }

    render_session_pdf(safe_title, &content, fonts)
}

#[cfg(test)]
mod tests {
    use super::{find_matching_strongs, normalize_lexicon_text, render_session_pdf, PDF_FONTS};
    use rusqlite::Connection;
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    #[test]
    fn normalizes_original_language_diacritics() {
        assert_eq!(normalize_lexicon_text("רֵאשִׁית"), "ראשית");
        assert_eq!(normalize_lexicon_text("ἀρχή"), "αρχη");
    }

    #[test]
    fn strips_hebrew_prefixes_during_lexicon_lookup() {
        let database = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../rhelo.db");
        let connection = Connection::open(database).expect("test database should open");
        let matches = find_matching_strongs(&connection, "בְּרֵאשִׁית")
            .expect("normalized lexicon lookup should succeed");
        assert!(matches.iter().any(|strongs_id| strongs_id == "H7225"));
    }

    #[test]
    fn renders_multilingual_session_pdf() {
        let font_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/fonts");
        let fonts = PDF_FONTS
            .iter()
            .map(|(kind, filename)| {
                let bytes = std::fs::read(font_root.join(filename))
                    .unwrap_or_else(|error| panic!("failed to load {filename}: {error}"));
                (*kind, bytes)
            })
            .collect::<BTreeMap<_, _>>();
        let bytes = render_session_pdf(
            "Languages",
            "<p>English · Ελληνικά · עברית</p><p>हिन्दी · తెలుగు · മലയാളം · தமிழ்</p>",
            fonts,
        )
        .expect("multilingual PDF should render");

        assert!(bytes.starts_with(b"%PDF"));
        assert!(bytes.len() > 1_000);
    }
}
