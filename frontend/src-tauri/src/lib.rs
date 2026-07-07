use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tts::Tts;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

mod research;

struct WhisperModelState {
    context: Mutex<Option<WhisperContext>>,
    initialization_error: Option<String>,
}

pub(crate) struct DatabaseState {
    path: PathBuf,
}

struct SidecarState {
    child: Mutex<Option<CommandChild>>,
}

#[derive(Debug, Serialize)]
struct Session {
    session_id: String,
    title: String,
    content: String,
    updated_at: String,
}

#[derive(Serialize)]
struct SessionsResponse {
    sessions: Vec<Session>,
}

#[derive(Serialize)]
struct CreateSessionResponse {
    status: &'static str,
    session_id: String,
    title: String,
    content: String,
}

#[derive(Serialize)]
struct UpdateSessionResponse {
    status: &'static str,
    session: Session,
}

#[derive(Serialize)]
struct DeleteSessionResponse {
    status: &'static str,
    session_id: String,
}

#[derive(Debug, Serialize)]
struct ChapterVerse {
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

struct ChapterVerseRecord {
    id: String,
    book: String,
    chapter: i64,
    verse: i64,
    text_en: Option<String>,
    text_original: Option<String>,
    text_hi: Option<String>,
    text_te: Option<String>,
    text_ml: Option<String>,
    text_ta: Option<String>,
    cross_references_count: i64,
    places_count: i64,
    morphology: Option<String>,
}

#[derive(Serialize)]
struct ChapterResponse {
    verses: Vec<ChapterVerse>,
    translation_code: &'static str,
}

#[derive(Deserialize)]
struct BackendHealth {
    status: String,
    database_path: String,
    boot_token: String,
}

pub(crate) fn open_database(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path)
        .map_err(|error| format!("Failed to open the Rhelo database: {error}"))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| format!("Failed to configure SQLite busy timeout: {error}"))?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| format!("Failed to configure SQLite: {error}"))?;
    Ok(connection)
}

fn read_session(connection: &Connection, session_id: &str) -> Result<Option<Session>, String> {
    connection
        .query_row(
            "SELECT session_id, title, content, updated_at FROM sessions WHERE session_id = ?1",
            [session_id],
            |row| {
                Ok(Session {
                    session_id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| format!("Failed to read the study session: {error}"))
}

pub(crate) fn normalize_english_translation(translation_code: Option<&str>) -> &'static str {
    match translation_code {
        Some("en_web") => "en_web",
        Some("en_kjv") => "en_kjv",
        _ => "en_bsb",
    }
}

#[tauri::command]
fn fetch_chapter(
    book: String,
    chapter: i64,
    translation_code: Option<String>,
    state: tauri::State<'_, DatabaseState>,
) -> Result<ChapterResponse, String> {
    let book = book.trim().to_ascii_uppercase();
    if book.is_empty() {
        return Err("A Scripture book code is required.".to_string());
    }
    if chapter < 1 {
        return Err("The chapter number must be greater than zero.".to_string());
    }

    let translation_code = normalize_english_translation(translation_code.as_deref());
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare(
            "SELECT
                v.id,
                v.book,
                v.chapter,
                v.verse,
                COALESCE(et.text, v.text_en) AS active_text_en,
                v.text_original,
                v.text_hi,
                v.text_te,
                v.text_ml,
                v.text_ta,
                (SELECT COUNT(*) FROM cross_references cr WHERE cr.from_verse = v.id),
                (SELECT COUNT(*) FROM verse_geography vg WHERE vg.verse_id = v.id),
                v.morphology
             FROM verses v
             LEFT JOIN verse_translations et
               ON et.verse_id = v.id AND et.translation_code = ?1
             WHERE v.book = ?2 AND v.chapter = ?3
             ORDER BY v.verse",
        )
        .map_err(|error| format!("Failed to prepare the chapter query: {error}"))?;

    let records = statement
        .query_map(params![translation_code, book, chapter], |row| {
            Ok(ChapterVerseRecord {
                id: row.get(0)?,
                book: row.get(1)?,
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text_en: row.get(4)?,
                text_original: row.get(5)?,
                text_hi: row.get(6)?,
                text_te: row.get(7)?,
                text_ml: row.get(8)?,
                text_ta: row.get(9)?,
                cross_references_count: row.get(10)?,
                places_count: row.get(11)?,
                morphology: row.get(12)?,
            })
        })
        .map_err(|error| format!("Failed to read {book} {chapter}: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode {book} {chapter}: {error}"))?;
    drop(statement);

    let mut commentary_statement = connection
        .prepare("SELECT text FROM commentaries WHERE verse_id = ?1")
        .map_err(|error| format!("Failed to prepare the commentary query: {error}"))?;
    let mut verses = Vec::with_capacity(records.len());

    for record in records {
        let commentaries = commentary_statement
            .query_map([&record.id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Failed to read commentaries for {}: {error}", record.id))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to decode commentaries for {}: {error}", record.id))?;
        let morphology = record
            .morphology
            .as_deref()
            .and_then(|value| serde_json::from_str(value).ok())
            .filter(serde_json::Value::is_array)
            .unwrap_or_else(|| serde_json::Value::Array(Vec::new()));

        verses.push(ChapterVerse {
            id: record.id,
            book: record.book,
            chapter: record.chapter,
            verse: record.verse,
            text_en: record.text_en.unwrap_or_default(),
            text_original: record.text_original.unwrap_or_default(),
            text_hi: record.text_hi.unwrap_or_default(),
            text_te: record.text_te.unwrap_or_default(),
            text_ml: record.text_ml.unwrap_or_default(),
            text_ta: record.text_ta.unwrap_or_default(),
            cross_references_count: record.cross_references_count,
            places_count: record.places_count,
            commentaries,
            morphology,
        });
    }

    Ok(ChapterResponse {
        verses,
        translation_code,
    })
}

#[tauri::command]
fn fetch_sessions(state: tauri::State<'_, DatabaseState>) -> Result<SessionsResponse, String> {
    let connection = open_database(&state.path)?;
    let mut statement = connection
        .prepare(
            "SELECT session_id, title, content, updated_at FROM sessions ORDER BY updated_at DESC",
        )
        .map_err(|error| format!("Failed to prepare the sessions query: {error}"))?;
    let sessions = statement
        .query_map([], |row| {
            Ok(Session {
                session_id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| format!("Failed to fetch study sessions: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to decode study sessions: {error}"))?;
    Ok(SessionsResponse { sessions })
}

#[tauri::command]
fn create_session(
    title: String,
    content: String,
    state: tauri::State<'_, DatabaseState>,
) -> Result<CreateSessionResponse, String> {
    let mut connection = open_database(&state.path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start the create-session transaction: {error}"))?;
    let session_id = uuid::Uuid::new_v4().to_string();
    transaction
        .execute(
            "INSERT INTO sessions (session_id, title, content) VALUES (?1, ?2, ?3)",
            params![session_id, title, content],
        )
        .map_err(|error| format!("Failed to create the study session: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit the study session: {error}"))?;
    Ok(CreateSessionResponse {
        status: "success",
        session_id,
        title,
        content,
    })
}

#[tauri::command]
fn update_session(
    session_id: String,
    title: String,
    content: String,
    state: tauri::State<'_, DatabaseState>,
) -> Result<UpdateSessionResponse, String> {
    let mut connection = open_database(&state.path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start the update-session transaction: {error}"))?;
    let changed = transaction
        .execute(
            "UPDATE sessions SET title = ?1, content = ?2, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?3",
            params![title, content, session_id],
        )
        .map_err(|error| format!("Failed to update the study session: {error}"))?;
    if changed == 0 {
        return Err("The selected study session no longer exists.".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit the study session: {error}"))?;
    let session = read_session(&connection, &session_id)?
        .ok_or_else(|| "The updated study session could not be reloaded.".to_string())?;
    Ok(UpdateSessionResponse {
        status: "success",
        session,
    })
}

#[tauri::command]
fn delete_session(
    session_id: String,
    state: tauri::State<'_, DatabaseState>,
) -> Result<DeleteSessionResponse, String> {
    let mut connection = open_database(&state.path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start the delete-session transaction: {error}"))?;
    let changed = transaction
        .execute("DELETE FROM sessions WHERE session_id = ?1", [&session_id])
        .map_err(|error| format!("Failed to delete the study session: {error}"))?;
    if changed == 0 {
        return Err("The selected study session no longer exists.".to_string());
    }
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit the session deletion: {error}"))?;
    Ok(DeleteSessionResponse {
        status: "success",
        session_id,
    })
}

fn wait_for_backend(
    port: u16,
    expected_database: &Path,
    boot_token: &str,
    timeout: Duration,
) -> Result<(), String> {
    let address = format!("127.0.0.1:{port}")
        .parse()
        .map_err(|error| format!("Invalid backend address: {error}"))?;
    let started = Instant::now();

    while started.elapsed() < timeout {
        if let Ok(mut stream) =
            std::net::TcpStream::connect_timeout(&address, Duration::from_millis(200))
        {
            let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
            let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
            if stream
                .write_all(
                    b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
                )
                .is_ok()
            {
                let mut response = String::new();
                if stream.read_to_string(&mut response).is_ok() {
                    if let Some(body) = response.split("\r\n\r\n").nth(1) {
                        if let Ok(health) = serde_json::from_str::<BackendHealth>(body) {
                            if health.status == "ready"
                                && health.boot_token == boot_token
                                && Path::new(&health.database_path) == expected_database
                            {
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Err("Rhelo's local study service did not become ready in time.".to_string())
}

fn prepare_database(app: &mut tauri::App) -> Result<PathBuf, String> {
    // 1. Resolve source and destination DB paths
    let db_src = app
        .path()
        .resolve("rhelo.db", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve source DB path: {}", e))?;

    let db_dest = app
        .path()
        .resolve("rhelo.db", tauri::path::BaseDirectory::AppData)
        .map_err(|e| format!("Failed to resolve destination DB path: {}", e))?;

    // 2. Copy the DB if it doesn't exist in writable AppData yet
    if !db_dest.exists() {
        if let Some(parent) = db_dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create AppData directories: {}", e))?;
        }
        std::fs::copy(&db_src, &db_dest).map_err(|e| {
            format!(
                "Failed to copy DB from {:?} to {:?}: {}",
                db_src, db_dest, e
            )
        })?;
    }

    Ok(db_dest)
}

fn spawn_sidecar(app: &mut tauri::App, db_path: &Path) -> Result<CommandChild, String> {
    let boot_token = uuid::Uuid::new_v4().to_string();
    let sidecar = app
        .shell()
        .sidecar("server")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("RHELO_DB_PATH", db_path.to_string_lossy().to_string())
        .env("RHELO_API_PORT", "5050")
        .env("RHELO_BOOT_TOKEN", &boot_token)
        .env("RHELO_MODE", "http");

    let (_rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar server: {}", e))?;

    if let Err(error) = wait_for_backend(5050, db_path, &boot_token, Duration::from_secs(30)) {
        let _ = child.kill();
        return Err(error);
    }
    Ok(child)
}

#[tauri::command]
fn speak_text(
    text: String,
    lang: String,
    tts_state: tauri::State<'_, Mutex<Tts>>,
) -> Result<(), String> {
    let mut tts = tts_state.lock().map_err(|_| "Failed to lock TTS state")?;
    let target_lang = lang.to_lowercase().replace('_', "-");
    let base_lang = target_lang.split('-').next().unwrap_or("");
    if !matches!(base_lang, "en" | "he" | "el") {
        return Err("Rhelo TTS supports English, Hebrew, and Greek only.".to_string());
    }

    let mut voice_found = false;
    if let Ok(voices) = tts.voices() {
        if base_lang == "en" {
            voice_found = true;
        } else if let Some(voice) = voices.into_iter().find(|v| {
            let v_lang = v.language().to_lowercase().replace('_', "-");
            v_lang == target_lang
                || v_lang.starts_with(&target_lang)
                || target_lang.starts_with(&v_lang)
        }) {
            let _ = tts.set_voice(&voice);
            voice_found = true;
        }

        if !voice_found {
            let mut available = Vec::new();
            if let Ok(all_voices) = tts.voices() {
                for av in all_voices {
                    let av_lang = av.language().to_string();
                    if !available.contains(&av_lang) {
                        available.push(av_lang);
                    }
                }
            }
            return Err(format!(
                "No voice found for language '{}'. Available languages: {}.",
                target_lang,
                available.join(", ")
            ));
        }
    }

    tts.speak(text, true)
        .map_err(|e| format!("Speech synthesis failed: {}", e))?;
    Ok(())
}

#[tauri::command]
fn stop_speech(tts_state: tauri::State<'_, Mutex<Tts>>) -> Result<(), String> {
    let mut tts = tts_state.lock().map_err(|_| "Failed to lock TTS state")?;
    tts.stop()
        .map_err(|e| format!("Failed to stop speech: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn transcribe_audio(
    audio_samples: Vec<f32>,
    model_state: tauri::State<'_, WhisperModelState>,
) -> Result<String, String> {
    let ctx_guard = model_state
        .context
        .lock()
        .map_err(|_| "Failed to lock Whisper context")?;
    let ctx = ctx_guard.as_ref().ok_or_else(|| {
        model_state.initialization_error.clone().unwrap_or_else(|| {
            "Whisper model is not initialized. Please ensure ggml-base.bin is in resources."
                .to_string()
        })
    })?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {:?}", e))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 0 });
    params.set_language(Some("auto"));
    params.set_n_threads(4);
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state
        .full(params, &audio_samples[..])
        .map_err(|e| format!("Whisper execution failed: {:?}", e))?;

    let mut result = String::new();
    let num_segments = state
        .full_n_segments()
        .map_err(|e| format!("Failed to get segment count: {:?}", e))?;
    for i in 0..num_segments {
        if let Ok(text) = state.full_get_segment_text(i) {
            result.push_str(&text);
        }
    }

    Ok(result.trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                if let Err(err) = app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                ) {
                    eprintln!("BOOT DIAGNOSTIC: failed to initialize logging: {err:?}");
                }
            }

            match prepare_database(app) {
                Ok(database_path) => {
                    app.manage(DatabaseState {
                        path: database_path.clone(),
                    });

                    match spawn_sidecar(app, &database_path) {
                        Ok(sidecar_child) => {
                            app.manage(SidecarState {
                                child: Mutex::new(Some(sidecar_child)),
                            });

                            if let Ok(mut home) = app.path().home_dir() {
                                home.push("rhelo_boot_error.log");
                                let _ = std::fs::remove_file(home);
                            }
                        }
                        Err(err) => {
                            eprintln!("CRITICAL BOOT ERROR: {:?}", err);
                            if let Ok(mut home) = app.path().home_dir() {
                                home.push("rhelo_boot_error.log");
                                let log_content = format!("Boot Error: {err}\n");
                                let _ = std::fs::write(home, log_content);
                            }
                        }
                    }
                }
                Err(err) => {
                    eprintln!("CRITICAL BOOT ERROR: {:?}", err);
                    if let Ok(mut home) = app.path().home_dir() {
                        home.push("rhelo_boot_error.log");
                        let log_content = format!("Boot Error: {err}\n");
                        let _ = std::fs::write(home, log_content);
                    }
                }
            }

            // 1. Initialize native TTS and manage it in Tauri State
            match Tts::default() {
                Ok(tts_instance) => {
                    app.manage(Mutex::new(tts_instance));
                }
                Err(err) => {
                    eprintln!("BOOT DIAGNOSTIC: failed to initialize TTS: {err:?}");
                }
            }

            // 2. Resolve and load Whisper model context
            let model_path = app
                .path()
                .resolve("ggml-base.bin", tauri::path::BaseDirectory::Resource);
            let (whisper_ctx, initialization_error) = match model_path {
                Ok(path) if path.exists() => match WhisperContext::new_with_params(
                    &path.to_string_lossy(),
                    WhisperContextParameters::default(),
                ) {
                    Ok(context) => (Some(context), None),
                    Err(error) => (
                        None,
                        Some(format!(
                            "Failed to load Whisper model at {:?}: {:?}",
                            path, error
                        )),
                    ),
                },
                Ok(path) => (
                    None,
                    Some(format!(
                        "Whisper model resource was not found at {:?}",
                        path
                    )),
                ),
                Err(error) => (
                    None,
                    Some(format!(
                        "Failed to resolve Whisper model resource: {}",
                        error
                    )),
                ),
            };

            app.manage(WhisperModelState {
                context: Mutex::new(whisper_ctx),
                initialization_error,
            });

            if let Some(window) = app.get_webview_window("main") {
                if let Err(err) = window.show() {
                    eprintln!("BOOT DIAGNOSTIC: failed to show the main window: {err:?}");
                }
                if let Err(err) = window.set_focus() {
                    eprintln!("BOOT DIAGNOSTIC: failed to focus the main window: {err:?}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_chapter,
            research::search_scripture,
            research::lookup_lexicon,
            research::fetch_research_meta,
            research::fetch_verse_details,
            research::fetch_chapter_map,
            research::fetch_geography_routes,
            research::fetch_route_points,
            research::fetch_stats,
            research::search_sessions,
            fetch_sessions,
            create_session,
            update_session,
            delete_session,
            speak_text,
            stop_speech,
            transcribe_audio
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(sidecar) = app_handle.try_state::<SidecarState>() {
                    if let Ok(mut child) = sidecar.child.lock() {
                        if let Some(child) = child.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
