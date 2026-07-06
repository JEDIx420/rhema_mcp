use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;
use tts::Tts;
use whisper_rs::{WhisperContext, WhisperContextParameters, FullParams, SamplingStrategy};

struct WhisperModelState {
  context: Mutex<Option<WhisperContext>>,
}

fn setup_database_and_sidecar(app: &mut tauri::App) -> Result<(), String> {
  // 1. Resolve source and destination DB paths
  let db_src = app.path().resolve("rhelo.db", tauri::path::BaseDirectory::Resource)
      .map_err(|e| format!("Failed to resolve source DB path: {}", e))?;
  
  let db_dest = app.path().resolve("rhelo.db", tauri::path::BaseDirectory::AppData)
      .map_err(|e| format!("Failed to resolve destination DB path: {}", e))?;

  // 2. Copy the DB if it doesn't exist in writable AppData yet
  if !db_dest.exists() {
      if let Some(parent) = db_dest.parent() {
          std::fs::create_dir_all(parent)
              .map_err(|e| format!("Failed to create AppData directories: {}", e))?;
      }
      std::fs::copy(&db_src, &db_dest)
          .map_err(|e| format!("Failed to copy DB from {:?} to {:?}: {}", db_src, db_dest, e))?;
  }

  // 3. Expose the writable database path to the PyInstaller process environment
  std::env::set_var("RHELO_DB_PATH", db_dest.to_string_lossy().to_string());
  std::env::set_var("TARGUM_DB_PATH", db_dest.to_string_lossy().to_string());

  // 4. Spawn the sidecar server process
  let sidecar = app.shell().sidecar("server")
      .map_err(|e| format!("Failed to create sidecar command: {}", e))?
      .env("TARGUM_DB_PATH", db_dest.to_string_lossy().to_string());
  
  let (_rx, _child) = sidecar.spawn()
      .map_err(|e| format!("Failed to spawn sidecar server: {}", e))?;

  Ok(())
}

#[tauri::command]
fn speak_text(
    text: String,
    lang: String,
    tts_state: tauri::State<'_, Mutex<Tts>>,
) -> Result<(), String> {
    let mut tts = tts_state.lock().map_err(|_| "Failed to lock TTS state")?;

    let mut voice_found = false;
    if let Ok(voices) = tts.voices() {
        let target_lang = lang.to_lowercase().replace('_', "-");
        
        // Don't enforce check for English (en) because it's the system default fallback
        if target_lang == "en" {
            voice_found = true;
        } else if let Some(voice) = voices.into_iter().find(|v| {
            let v_lang = v.language().to_lowercase().replace('_', "-");
            v_lang == target_lang || v_lang.starts_with(&target_lang) || target_lang.starts_with(&v_lang)
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
                "No voice found for language '{}'. Available languages: {}. Please install the Malayalam (ml) voice in macOS Settings -> Accessibility -> Spoken Content -> System Voice.",
                target_lang,
                available.join(", ")
            ));
        }
    }

    tts.speak(text, true).map_err(|e| format!("Speech synthesis failed: {}", e))?;
    Ok(())
}

#[tauri::command]
fn stop_speech(tts_state: tauri::State<'_, Mutex<Tts>>) -> Result<(), String> {
    let mut tts = tts_state.lock().map_err(|_| "Failed to lock TTS state")?;
    tts.stop().map_err(|e| format!("Failed to stop speech: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn transcribe_audio(
    audio_samples: Vec<f32>,
    model_state: tauri::State<'_, WhisperModelState>,
) -> Result<String, String> {
    let ctx_guard = model_state.context.lock().map_err(|_| "Failed to lock Whisper context")?;
    let ctx = ctx_guard.as_ref().ok_or("Whisper model is not initialized. Please ensure ggml-base.bin is in resources.")?;

    let mut state = ctx.create_state().map_err(|e| format!("Failed to create Whisper state: {:?}", e))?;
    
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 0 });
    params.set_language(Some("auto"));
    params.set_n_threads(4);
    params.set_translate(false);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state.full(params, &audio_samples[..]).map_err(|e| format!("Whisper execution failed: {:?}", e))?;

    let mut result = String::new();
    let num_segments = state.full_n_segments().map_err(|e| format!("Failed to get segment count: {:?}", e))?;
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
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if let Err(err_msg) = setup_database_and_sidecar(app) {
        if let Ok(mut home) = app.path().home_dir() {
          home.push("targum_boot_error.log");
          let log_content = format!("Boot Error: {}\n", err_msg);
          let _ = std::fs::write(home, log_content);
        }
      }

      // 1. Initialize native TTS and manage it in Tauri State
      if let Ok(tts_instance) = Tts::default() {
          if let Ok(voices) = tts_instance.voices() {
              let mut log_content = String::from("=== System TTS Voices ===\n");
              for v in &voices {
                  log_content.push_str(&format!("Name: {}, Language: {}\n", v.name(), v.language()));
              }
              let _ = std::fs::write("../../tts_voices.log", log_content);
          }
          app.manage(Mutex::new(tts_instance));
      } else {
          // Fallback if system speech init fails
          let tts_instance = Tts::default().expect("TTS initialization is required");
          app.manage(Mutex::new(tts_instance));
      }

      // 2. Resolve and load Whisper model context
      let model_path = app.path().resolve("ggml-base.bin", tauri::path::BaseDirectory::Resource);
      let whisper_ctx = if let Ok(path) = model_path {
          if path.exists() {
              WhisperContext::new_with_params(
                  &path.to_string_lossy(),
                  WhisperContextParameters::default()
              ).ok()
          } else {
              None
          }
      } else {
          None
      };

      app.manage(WhisperModelState {
          context: Mutex::new(whisper_ctx),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![speak_text, stop_speech, transcribe_audio])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
