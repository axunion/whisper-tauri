pub mod converter;
pub mod history;
pub mod recording;
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
        .manage(std::sync::Mutex::new(
            recording::capture::RecordingManager::new(),
        ))
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
            converter::commands::check_ffmpeg_available,
            converter::commands::check_ffmpeg_bundled,
            converter::commands::delete_ffmpeg,
            converter::commands::download_ffmpeg,
            converter::commands::get_ffmpeg_download_url,
            converter::commands::set_ffmpeg_download_url,
            converter::commands::convert_audio_file,
            converter::commands::get_supported_formats,
            converter::commands::cleanup_converted_file,
            history::commands::history_save,
            history::commands::history_list,
            history::commands::history_get,
            history::commands::history_delete,
            history::commands::history_delete_all,
            history::commands::history_search,
            recording::commands::list_audio_devices,
            recording::commands::start_recording,
            recording::commands::stop_recording,
            recording::commands::cleanup_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
