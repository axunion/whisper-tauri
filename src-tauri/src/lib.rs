use tauri::Manager;

pub mod converter;
pub mod download;
pub mod history;
pub mod recording;
pub mod text_processing;
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
        .manage(tokio::sync::Mutex::new(
            text_processing::server::LlamaServerManager::new(),
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
            converter::commands::check_ffmpeg_bundled,
            converter::commands::check_ffmpeg_needs_update,
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
            history::commands::history_rename,
            history::commands::history_save_ai_content,
            history::commands::history_get_ai_content,
            history::commands::history_get_all_ai_content,
            recording::commands::list_audio_devices,
            recording::commands::start_recording,
            recording::commands::stop_recording,
            recording::commands::cleanup_recording,
            text_processing::commands::text_processing_list_models,
            text_processing::commands::text_processing_download_model,
            text_processing::commands::text_processing_delete_model,
            text_processing::commands::text_processing_download_server,
            text_processing::commands::text_processing_delete_server,
            text_processing::commands::text_processing_check_server,
            text_processing::commands::text_processing_server_status,
            text_processing::commands::text_processing_chat,
            text_processing::commands::text_processing_summarize,
            text_processing::commands::text_processing_cancel,
            text_processing::commands::text_processing_generate_title,
            text_processing::commands::text_processing_clean_text,
            text_processing::commands::get_text_processing_model_url,
            text_processing::commands::set_text_processing_model_url,
            text_processing::commands::get_text_processing_server_url,
            text_processing::commands::set_text_processing_server_url,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(manager) = app_handle
                    .try_state::<tokio::sync::Mutex<text_processing::server::LlamaServerManager>>()
                {
                    // Use Tauri's async runtime to ensure we operate on the same
                    // runtime that owns the Mutex and Child process.
                    tauri::async_runtime::block_on(async {
                        let mut mgr = manager.lock().await;
                        mgr.shutdown().await;
                    });
                }
            }
        });
}
