use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;

use super::error::TextProcessingError;
use super::inference;
use super::models;
use super::server::LlamaServerManager;
use super::types::{ServerStatus, SummaryOptions, TextDownloadProgress, TextModelInfo};

/// Store filename for settings.
const SETTINGS_STORE: &str = "settings.json";

/// Store key for custom text model download URL.
const TEXT_MODEL_URL_KEY: &str = "textModelDownloadBaseUrl";

/// Store key for custom llama-server download URL.
const TEXT_SERVER_URL_KEY: &str = "textServerDownloadUrl";

/// Resolves the app data directory from a Tauri `AppHandle`.
fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, TextProcessingError> {
    app.path()
        .app_data_dir()
        .map_err(|e| TextProcessingError::PathError(e.to_string()))
}

/// Returns available text models with download status.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_list_models(app: AppHandle) -> Result<Vec<TextModelInfo>, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    let mut model_list = models::get_model_list();

    for model in &mut model_list {
        if let Some(path) = models::text_model_path(&app_data_dir, &model.id) {
            if path.exists() {
                model.downloaded = true;
                model.path = path.to_str().map(std::string::ToString::to_string);
            }
        }
    }

    Ok(model_list)
}

/// Downloads a text model file with progress reporting.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_download_model(
    app: AppHandle,
    model_id: String,
    base_url: Option<String>,
) -> Result<String, String> {
    if !models::is_valid_model_id(&model_id) {
        return Err(TextProcessingError::ModelNotFound(model_id).into());
    }

    let app_data_dir = resolve_app_data_dir(&app)?;
    let dir = models::text_models_dir(&app_data_dir);
    std::fs::create_dir_all(&dir).map_err(TextProcessingError::from)?;

    let url = models::get_model_url(&model_id, base_url.as_deref())
        .ok_or_else(|| TextProcessingError::ModelNotFound(model_id.clone()).to_string())?;

    let final_path = models::text_model_path(&app_data_dir, &model_id)
        .ok_or_else(|| TextProcessingError::ModelNotFound(model_id.clone()).to_string())?;
    let part_path = final_path.with_extension("gguf.part");

    let model_id_cb = model_id.clone();
    let app_cb = app.clone();
    crate::download::download_file(
        &url,
        &part_path,
        move |downloaded_bytes, total_bytes, progress| {
            let _ = app_cb.emit(
                "text-processing:download-progress",
                TextDownloadProgress {
                    model_id: model_id_cb.clone(),
                    downloaded_bytes,
                    total_bytes,
                    progress,
                },
            );
        },
    )
    .await
    .map_err(TextProcessingError::from)?;

    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(TextProcessingError::from)?;

    let _ = app.emit(
        "text-processing:download-progress",
        TextDownloadProgress {
            model_id,
            downloaded_bytes: 0,
            total_bytes: 0,
            progress: 100.0,
        },
    );

    final_path
        .to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| TextProcessingError::PathError("Invalid path encoding".to_string()).into())
}

/// Deletes a downloaded text model file.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    if let Some(path) = models::text_model_path(&app_data_dir, &model_id) {
        if path.exists() {
            std::fs::remove_file(&path).map_err(TextProcessingError::from)?;
        }
    }
    Ok(())
}

/// Downloads the llama-server binary.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_download_server(app: AppHandle) -> Result<String, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;

    let custom_url = get_custom_server_url(&app)?;
    let url = custom_url
        .as_deref()
        .unwrap_or_else(|| models::get_default_server_url());

    let bin_dir = app_data_dir.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(TextProcessingError::from)?;

    let archive_path = bin_dir.join("llama-server-download.zip");
    download_file(url, &archive_path, &app).await?;

    let final_path = models::llama_server_path(&app_data_dir);
    extract_llama_server_from_zip(&archive_path, &final_path)?;

    let _ = std::fs::remove_file(&archive_path);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&final_path, perms).map_err(TextProcessingError::from)?;
    }

    final_path
        .to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| TextProcessingError::PathError("Invalid path encoding".to_string()).into())
}

/// Checks whether the llama-server binary exists.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_check_server(app: AppHandle) -> Result<bool, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    Ok(models::llama_server_path(&app_data_dir).exists())
}

/// Returns the current server status.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_server_status(
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
) -> Result<ServerStatus, String> {
    let manager = manager.lock().await;
    Ok(ServerStatus {
        running: manager.is_running(),
        port: manager.port(),
        model_id: manager.model_id().map(std::string::ToString::to_string),
    })
}

/// Runs a simple chat response (for dev testing).
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_chat(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    model_id: Option<String>,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let token = inference::INFERENCE_TASK_MANAGER.create_task(&task_id);
    let _guard = TaskGuard {
        task_id: task_id.clone(),
    };

    let port = ensure_server_running(&app, &manager, model_id.as_deref()).await?;

    let messages = inference::build_chat_messages(&text);
    let result = inference::run_inference(port, &messages, 0.7, &task_id, &token, &app)
        .await
        .map_err::<String, _>(Into::into)?;

    Ok(result)
}

/// Runs proofreading on the given text.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_proofread(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    model_id: Option<String>,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let token = inference::INFERENCE_TASK_MANAGER.create_task(&task_id);
    let _guard = TaskGuard {
        task_id: task_id.clone(),
    };

    let port = ensure_server_running(&app, &manager, model_id.as_deref()).await?;

    let chunks = inference::chunk_text(&text, inference::default_max_chunk_chars());
    let mut result = String::new();

    for chunk in &chunks {
        if token.is_cancelled() {
            return Err(TextProcessingError::Cancelled.into());
        }

        let messages = inference::build_proofread_messages(chunk);
        let chunk_result = inference::run_inference(port, &messages, 0.3, &task_id, &token, &app)
            .await
            .map_err::<String, _>(Into::into)?;
        result.push_str(&chunk_result);
    }

    Ok(result)
}

/// Runs summarization on the given text.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_summarize(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    options: Option<SummaryOptions>,
    model_id: Option<String>,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let token = inference::INFERENCE_TASK_MANAGER.create_task(&task_id);
    let _guard = TaskGuard {
        task_id: task_id.clone(),
    };

    let port = ensure_server_running(&app, &manager, model_id.as_deref()).await?;

    let opts = options.unwrap_or_default();
    let chunks = inference::chunk_text(&text, inference::default_max_chunk_chars());

    let result = if chunks.len() == 1 {
        let messages = inference::build_summarize_messages(&text, &opts);
        inference::run_inference(port, &messages, 0.3, &task_id, &token, &app)
            .await
            .map_err::<String, _>(Into::into)?
    } else {
        let mut chunk_summaries = Vec::new();
        for chunk in &chunks {
            if token.is_cancelled() {
                return Err(TextProcessingError::Cancelled.into());
            }

            let messages = inference::build_summarize_messages(chunk, &opts);
            let summary = inference::run_inference(port, &messages, 0.3, &task_id, &token, &app)
                .await
                .map_err::<String, _>(Into::into)?;
            chunk_summaries.push(summary);
        }

        let combined = chunk_summaries.join("\n\n");
        let messages = inference::build_summarize_messages(&combined, &opts);
        inference::run_inference(port, &messages, 0.3, &task_id, &token, &app)
            .await
            .map_err::<String, _>(Into::into)?
    };

    Ok(result)
}

/// Cancels an in-progress inference task.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_cancel(task_id: String) -> Result<bool, String> {
    Ok(inference::INFERENCE_TASK_MANAGER.cancel_task(&task_id))
}

/// RAII guard that removes a task from the inference task manager on drop.
struct TaskGuard {
    task_id: String,
}

impl Drop for TaskGuard {
    fn drop(&mut self) {
        inference::INFERENCE_TASK_MANAGER.remove_task(&self.task_id);
    }
}

/// Gets the custom text model download URL from settings.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn get_text_processing_model_url(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| TextProcessingError::StoreError(e.to_string()))?;
    let value = store
        .get(TEXT_MODEL_URL_KEY)
        .and_then(|v| v.as_str().map(std::string::ToString::to_string));
    Ok(value)
}

/// Sets or clears the custom text model download URL.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn set_text_processing_model_url(
    app: AppHandle,
    url: Option<String>,
) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| TextProcessingError::StoreError(e.to_string()))?;
    match url {
        Some(u) => store.set(TEXT_MODEL_URL_KEY, serde_json::Value::String(u)),
        None => {
            store.delete(TEXT_MODEL_URL_KEY);
        }
    }
    Ok(())
}

/// Gets the custom llama-server download URL from settings.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn get_text_processing_server_url(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| TextProcessingError::StoreError(e.to_string()))?;
    let value = store
        .get(TEXT_SERVER_URL_KEY)
        .and_then(|v| v.as_str().map(std::string::ToString::to_string));
    Ok(value)
}

/// Sets or clears the custom llama-server download URL.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn set_text_processing_server_url(
    app: AppHandle,
    url: Option<String>,
) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| TextProcessingError::StoreError(e.to_string()))?;
    match url {
        Some(u) => store.set(TEXT_SERVER_URL_KEY, serde_json::Value::String(u)),
        None => {
            store.delete(TEXT_SERVER_URL_KEY);
        }
    }
    Ok(())
}

// --- Helper functions ---

/// Ensures the server is running with the given (or first available) model.
async fn ensure_server_running(
    app: &AppHandle,
    manager: &State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    model_id: Option<&str>,
) -> Result<u16, String> {
    let app_data_dir = resolve_app_data_dir(app)?;

    let model_id = if let Some(id) = model_id {
        id.to_string()
    } else {
        let models = models::get_model_list();
        let mut found = None;
        for model in &models {
            if let Some(path) = models::text_model_path(&app_data_dir, &model.id) {
                if path.exists() {
                    found = Some(model.id.clone());
                    break;
                }
            }
        }
        found.ok_or_else(|| {
            TextProcessingError::ModelNotFound("No downloaded model found".to_string()).to_string()
        })?
    };

    let mut mgr = manager.lock().await;

    // Already running with the same model
    if mgr.is_running() && mgr.model_id() == Some(model_id.as_str()) {
        if let Some(port) = mgr.port() {
            mgr.touch_activity();
            return Ok(port);
        }
    }

    // Start the server
    let port = mgr
        .start(&app_data_dir, &model_id, None)
        .await
        .map_err::<String, _>(Into::into)?;

    Ok(port)
}

/// Downloads a file from a URL to a local path.
async fn download_file(url: &str, output_path: &Path, app: &AppHandle) -> Result<(), String> {
    let app_cb = app.clone();
    crate::download::download_file(
        url,
        output_path,
        move |downloaded_bytes, total_bytes, progress| {
            let _ = app_cb.emit(
                "text-processing:download-progress",
                TextDownloadProgress {
                    model_id: "llama-server".to_string(),
                    downloaded_bytes,
                    total_bytes,
                    progress,
                },
            );
        },
    )
    .await
    .map_err(|e| TextProcessingError::DownloadFailed(e.to_string()).to_string())
}

/// Gets the custom server URL from settings store.
fn get_custom_server_url(app: &AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| TextProcessingError::StoreError(e.to_string()))?;
    let value = store
        .get(TEXT_SERVER_URL_KEY)
        .and_then(|v| v.as_str().map(std::string::ToString::to_string));
    Ok(value)
}

/// Extracts the llama-server binary from a zip archive.
fn extract_llama_server_from_zip(archive_path: &Path, output_path: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| TextProcessingError::DownloadFailed(e.to_string()).to_string())?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| TextProcessingError::DownloadFailed(e.to_string()).to_string())?;

    let target_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| TextProcessingError::DownloadFailed(e.to_string()).to_string())?;

        let entry_name = entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|f| f.to_string_lossy().to_string()));

        if let Some(name) = entry_name {
            if name == target_name && entry.is_file() {
                let mut out_file = std::fs::File::create(output_path)
                    .map_err(|e| TextProcessingError::Io(e).to_string())?;
                std::io::copy(&mut entry, &mut out_file)
                    .map_err(|e| TextProcessingError::Io(e).to_string())?;
                return Ok(());
            }
        }
    }

    Err(
        TextProcessingError::DownloadFailed("llama-server binary not found in archive".to_string())
            .to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_models_dir_returns_correct_path() {
        let app_data = Path::new("/tmp/test-app-data");
        let dir = models::text_models_dir(app_data);
        assert_eq!(dir, PathBuf::from("/tmp/test-app-data/text-models"));
    }

    #[test]
    fn text_model_path_returns_correct_path() {
        let app_data = Path::new("/tmp/test-app-data");
        let path = models::text_model_path(app_data, "qwen3.5-4b");
        assert!(path.is_some());
        assert!(path
            .expect("path")
            .to_string_lossy()
            .contains("Qwen3.5-4B-Q4_K_M.gguf"));
    }

    #[test]
    fn llama_server_path_correct() {
        let app_data = Path::new("/tmp/test-app-data");
        let path = models::llama_server_path(app_data);
        assert!(path.starts_with("/tmp/test-app-data/bin"));
    }
}
