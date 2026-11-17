#![cfg_attr(
    test,
    allow(
        clippy::unwrap_used,
        clippy::expect_used,
        clippy::float_cmp,
        clippy::const_is_empty,
        clippy::inefficient_to_string,
        clippy::case_sensitive_file_extension_comparisons,
    )
)]

use tauri::Manager;

pub mod converter;
pub mod download;
pub mod history;
pub mod ipc_error;
pub mod mirrors;
pub mod notion;
pub mod paths;
pub mod recording;
pub mod settings;
pub mod text_processing;
pub mod update;
pub mod whisper;

/// Id of the Quit item that replaces the predefined one in the macOS app menu.
#[cfg(target_os = "macos")]
const QUIT_MENU_ID: &str = "quit";

/// Builds the default menu with the app menu's Quit swapped for a custom item.
///
/// The predefined Quit terminates the process directly, without a
/// close-requested event, so Cmd+Q would skip the frontend's close guard and
/// silently drop a recording in progress. The custom item closes the window
/// instead, which runs the guard and then exits as the last window goes away.
#[cfg(target_os = "macos")]
fn build_menu(app: &tauri::AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{Menu, MenuItem, MenuItemKind};

    let menu = Menu::default(app)?;
    // `Menu::default` puts the app submenu first and Quit last within it.
    if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
        let quit_position = app_menu.items()?.len().saturating_sub(1);
        app_menu.remove_at(quit_position)?;
        app_menu.append(&MenuItem::with_id(
            app,
            QUIT_MENU_ID,
            format!("Quit {}", app.package_info().name),
            true,
            Some("CmdOrCtrl+Q"),
        )?)?;
    }
    Ok(menu)
}

/// The IPC surface: every command the frontend can call and every event it
/// can receive.
///
/// `src/bindings.ts` is generated from this by the `bindings_are_up_to_date`
/// test, so the frontend's types cannot drift from the Rust signatures.
fn ipc_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        // Durations, sizes and counts stay far below 2^53.
        .dangerously_cast_bigints_to_number()
        .events(tauri_specta::collect_events![
            whisper::types::TranscriptionProgress,
            whisper::types::DownloadProgress,
            converter::types::FfmpegDownloadProgress,
            recording::types::RecordingLevel,
            text_processing::types::TextDownloadProgress,
            text_processing::types::InferenceProgress,
        ])
        .commands(tauri_specta::collect_commands![
            whisper::commands::get_available_models,
            whisper::commands::check_model_exists,
            whisper::commands::download_model,
            whisper::commands::delete_model,
            whisper::commands::transcribe_audio,
            whisper::commands::cancel_transcription,
            whisper::commands::ensure_vad_model,
            converter::commands::check_ffmpeg_bundled,
            converter::commands::check_ffmpeg_needs_update,
            converter::commands::delete_ffmpeg,
            converter::commands::download_ffmpeg,
            converter::commands::get_audio_duration,
            converter::commands::convert_audio_file,
            converter::commands::cleanup_converted_file,
            history::commands::history_save,
            history::commands::history_list,
            history::commands::history_get,
            history::commands::history_delete,
            history::commands::history_delete_all,
            history::commands::history_search,
            history::commands::history_rename,
            history::commands::history_update_segment,
            history::commands::history_save_ai_content,
            history::commands::history_get_ai_content,
            history::commands::history_get_all_ai_content,
            history::commands::history_attach_recording,
            history::commands::history_copy_audio,
            history::commands::history_delete_audio,
            history::commands::history_delete_all_audio,
            history::commands::history_delete_pending_recordings,
            history::commands::history_storage_stats,
            recording::commands::list_audio_devices,
            recording::commands::start_recording,
            recording::commands::pause_recording,
            recording::commands::resume_recording,
            recording::commands::stop_recording,
            recording::commands::cleanup_recording,
            text_processing::commands::text_processing_list_models,
            text_processing::commands::text_processing_download_model,
            text_processing::commands::text_processing_delete_model,
            text_processing::commands::text_processing_download_server,
            text_processing::commands::text_processing_delete_server,
            text_processing::commands::text_processing_check_server,
            text_processing::commands::text_processing_chat,
            text_processing::commands::text_processing_summarize,
            text_processing::commands::text_processing_cancel,
            text_processing::commands::text_processing_generate_title,
            text_processing::commands::text_processing_clean_text,
            notion::commands::notion_get_settings,
            notion::commands::notion_set_settings,
            notion::commands::notion_test_connection,
            notion::commands::notion_create_page,
            update::check_latest_version,
        ])
}

/// Run the Tauri application.
///
/// # Panics
///
/// Panics if the Tauri application fails to initialize.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::expect_used)]
pub fn run() {
    let ipc = ipc_builder();
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.menu(build_menu).on_menu_event(|app, event| {
        if event.id() == QUIT_MENU_ID {
            match app.get_webview_window("main") {
                Some(window) => {
                    let _ = window.close();
                }
                None => app.exit(0),
            }
        }
    });

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .manage(std::sync::Mutex::new(
            recording::capture::RecordingManager::new(),
        ))
        .manage(tokio::sync::Mutex::new(
            text_processing::server::LlamaServerManager::new(),
        ))
        .invoke_handler(ipc.invoke_handler())
        .setup(move |app| {
            ipc.mount_events(app);
            Ok(())
        })
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

#[cfg(test)]
mod tests {
    use super::ipc_builder;

    /// Regenerates `src/bindings.ts` when it is stale and fails, so a changed
    /// command or type cannot be committed without its regenerated bindings.
    #[test]
    fn bindings_are_up_to_date() {
        let committed = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/bindings.ts");
        let dir = tempfile::TempDir::new().unwrap();
        let fresh = dir.path().join("bindings.ts");
        ipc_builder()
            .export(specta_typescript::Typescript::default(), &fresh)
            .expect("export bindings");

        let generated = std::fs::read_to_string(&fresh).unwrap();
        if std::fs::read_to_string(&committed).ok().as_deref() != Some(generated.as_str()) {
            std::fs::write(&committed, generated).unwrap();
            panic!("src/bindings.ts was out of date and has been regenerated; commit it");
        }
    }
}
