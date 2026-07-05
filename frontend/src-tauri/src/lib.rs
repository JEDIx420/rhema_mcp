use tauri::Manager;
use tauri_plugin_shell::ShellExt;

fn setup_database_and_sidecar(app: &mut tauri::App) -> Result<(), String> {
  // 1. Resolve source and destination DB paths
  let db_src = app.path().resolve("targum.db", tauri::path::BaseDirectory::Resource)
      .map_err(|e| format!("Failed to resolve source DB path: {}", e))?;
  
  let db_dest = app.path().resolve("targum.db", tauri::path::BaseDirectory::AppData)
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
  std::env::set_var("TARGUM_DB_PATH", db_dest.to_string_lossy().to_string());

  // 4. Spawn the sidecar server process
  let sidecar = app.shell().sidecar("server")
      .map_err(|e| format!("Failed to create sidecar command: {}", e))?;
  
  let (_rx, _child) = sidecar.spawn()
      .map_err(|e| format!("Failed to spawn sidecar server: {}", e))?;

  Ok(())
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

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
