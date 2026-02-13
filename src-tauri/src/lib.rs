pub mod whisper;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

/// Run the Tauri application.
///
/// # Panics
///
/// Panics if the Tauri application fails to initialize.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::expect_used)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            whisper::commands::get_available_models,
            whisper::commands::check_model_exists,
            whisper::commands::download_model,
            whisper::commands::delete_model,
            whisper::commands::get_model_download_url,
            whisper::commands::set_model_download_url,
            whisper::commands::transcribe_audio,
            whisper::commands::cancel_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
