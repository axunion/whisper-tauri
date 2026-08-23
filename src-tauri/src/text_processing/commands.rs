use std::path::Path;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use crate::mirrors;
use crate::paths;
use crate::whisper::process::CancellationToken;

use super::error::TextProcessingError;
use super::extract;
use super::inference;
use super::models;
use super::server::LlamaServerManager;
use super::types::{StructuredSummary, TextDownloadProgress, TextModelInfo};

/// Returns available text models with download status.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_list_models(app: AppHandle) -> Result<Vec<TextModelInfo>, String> {
    let app_data_dir = paths::app_data_dir(&app)?;
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
) -> Result<String, String> {
    if !models::is_valid_model_id(&model_id) {
        return Err(TextProcessingError::ModelNotFound(model_id).into());
    }

    let app_data_dir = paths::app_data_dir(&app)?;
    let dir = models::text_models_dir(&app_data_dir);
    std::fs::create_dir_all(&dir).map_err(TextProcessingError::from)?;

    let base_url = mirrors::get(&app_data_dir, mirrors::TEXT_MODEL_BASE_URL);
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

    paths::path_to_owned_string(&final_path).map_err(Into::into)
}

/// Deletes a downloaded text model file.
///
/// # Errors
///
/// Returns [`TextProcessingError::ModelNotFound`] if `model_id` is unknown,
/// or an IO error if removal fails.
#[tauri::command]
pub async fn text_processing_delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let path = models::known_model_path(&app_data_dir, &model_id)
        .ok_or_else(|| TextProcessingError::ModelNotFound(model_id.clone()).to_string())?;

    if path.exists() {
        std::fs::remove_file(&path).map_err(TextProcessingError::from)?;
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
    let app_data_dir = paths::app_data_dir(&app)?;

    let custom_url = mirrors::get(&app_data_dir, mirrors::TEXT_SERVER_URL);
    let url = custom_url
        .as_deref()
        .unwrap_or_else(|| models::get_default_server_url());

    // The archive is chmod'd 0o755 and spawned below, so the source has to be
    // trusted before a single byte is fetched.
    crate::download::validate_executable_url(url).map_err(TextProcessingError::from)?;

    let bin_dir = app_data_dir.join("bin");
    std::fs::create_dir_all(&bin_dir).map_err(TextProcessingError::from)?;

    // Select archive filename and extraction method based on platform
    let (archive_filename, use_tar_gz) = if cfg!(target_os = "windows") {
        ("llama-server-download.zip", false)
    } else {
        ("llama-server-download.tar.gz", true)
    };

    let archive_path = bin_dir.join(archive_filename);
    download_file(url, &archive_path, &app).await?;

    let extract_result = if use_tar_gz {
        extract::extract_from_tar_gz(&archive_path, &bin_dir)
    } else {
        extract::extract_from_zip(&archive_path, &bin_dir)
    };

    // Always clean up archive, even on extraction failure
    let _ = std::fs::remove_file(&archive_path);
    extract_result?;

    let final_path = models::llama_server_path(&app_data_dir);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&final_path, perms).map_err(TextProcessingError::from)?;
    }

    models::write_server_version(&app_data_dir).map_err(TextProcessingError::from)?;

    paths::path_to_owned_string(&final_path).map_err(Into::into)
}

/// Deletes the llama-server binary.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_delete_server(app: AppHandle) -> Result<(), String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let bin_dir = app_data_dir.join("bin");

    let path = models::llama_server_path(&app_data_dir);
    if path.exists() {
        std::fs::remove_file(&path).map_err(TextProcessingError::from)?;
    }
    models::delete_server_version(&app_data_dir);

    if bin_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&bin_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if extract::is_extracted_artifact(&name) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }

    Ok(())
}

/// Checks whether the llama-server binary exists.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_check_server(app: AppHandle) -> Result<bool, String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let exists = models::llama_server_path(&app_data_dir).exists()
        && models::is_server_version_current(&app_data_dir);
    Ok(exists)
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
    let task = begin_task(
        &app,
        &manager,
        model_id.as_deref(),
        ProgressReporting::Enabled,
    )
    .await?;

    let messages = inference::build_chat_messages(&text);
    let result = inference::run_inference(
        task.port,
        &messages,
        task.sampling,
        2048,
        task.progress_id(),
        &task.token,
        &app,
    )
    .await
    .map_err::<String, _>(Into::into)?;

    Ok(result)
}
/// Runs structured summarization on the given text.
///
/// Long inputs are condensed chunk-by-chunk first (plain text), then a final
/// structured pass produces the JSON object validated against
/// [`inference::summary_json_schema`].
///
/// # Errors
///
/// Returns an error string if the operation fails or the model returns JSON
/// that does not match the schema.
#[tauri::command]
pub async fn text_processing_summarize(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    model_id: Option<String>,
) -> Result<StructuredSummary, String> {
    let task = begin_task(
        &app,
        &manager,
        model_id.as_deref(),
        ProgressReporting::Enabled,
    )
    .await?;

    // Scale the keyPoints target and max_tokens to the original transcript
    // length — chunked condensation shortens the final structured-pass input,
    // but the user-facing signal is still the raw transcript size.
    let params = inference::summary_params_for_length(text.chars().count());

    let chunks = inference::chunk_text(&text, inference::default_max_chunk_chars());

    let final_input = if chunks.len() == 1 {
        text
    } else {
        let mut chunk_summaries = Vec::new();
        for chunk in &chunks {
            if task.token.is_cancelled() {
                return Err(TextProcessingError::Cancelled.into());
            }

            let messages = inference::build_chunk_condense_messages(chunk);
            let summary = inference::run_inference(
                task.port,
                &messages,
                task.sampling,
                1024,
                task.progress_id(),
                &task.token,
                &app,
            )
            .await
            .map_err::<String, _>(Into::into)?;
            chunk_summaries.push(summary);
        }
        chunk_summaries.join("\n\n")
    };

    let messages = inference::build_summarize_messages(
        &final_input,
        params.key_points_min,
        params.key_points_max,
    );
    let json = inference::run_inference_blocking(
        task.port,
        &messages,
        task.sampling,
        params.max_tokens,
        Some(inference::summary_response_format()),
        task.progress_id(),
        &task.token,
        &app,
    )
    .await
    .map_err::<String, _>(Into::into)?;

    serde_json::from_str::<StructuredSummary>(&json).map_err(|e| {
        TextProcessingError::InferenceError(format!("summary JSON parse failed: {e}")).to_string()
    })
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

/// Generates a short title from the given text.
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_generate_title(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    model_id: Option<String>,
) -> Result<String, String> {
    // Silent: no UI shows the title stream, and reporting would let it override
    // the progress signal (and therefore the cancel target) of a summarize or
    // clean-text run happening at the same time.
    let task = begin_task(
        &app,
        &manager,
        model_id.as_deref(),
        ProgressReporting::Silent,
    )
    .await?;

    // Use only the first 1000 chars for title generation
    let truncated: String = text.chars().take(1000).collect();
    let messages = inference::build_title_messages(&truncated);
    let result = inference::run_inference(
        task.port,
        &messages,
        task.sampling,
        64,
        task.progress_id(),
        &task.token,
        &app,
    )
    .await
    .map_err::<String, _>(Into::into)?;

    // Clean up: trim whitespace, remove surrounding quotes if present
    let title = result
        .trim()
        .trim_matches('"')
        .trim_matches('「')
        .trim_matches('」')
        .to_string();
    Ok(title)
}

/// Cleans up transcribed text (removes fillers, adds punctuation, formats paragraphs).
///
/// # Errors
///
/// Returns an error string if the operation fails.
#[tauri::command]
pub async fn text_processing_clean_text(
    app: AppHandle,
    manager: State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    text: String,
    model_id: Option<String>,
) -> Result<String, String> {
    let task = begin_task(
        &app,
        &manager,
        model_id.as_deref(),
        ProgressReporting::Enabled,
    )
    .await?;

    let chunks = inference::chunk_text(&text, inference::default_max_chunk_chars());

    let result = if chunks.len() == 1 {
        let max_tokens = inference::clean_text_max_tokens(&text);
        let messages = inference::build_clean_text_messages(&text);
        inference::run_inference(
            task.port,
            &messages,
            task.sampling,
            max_tokens,
            task.progress_id(),
            &task.token,
            &app,
        )
        .await
        .map_err::<String, _>(Into::into)?
    } else {
        let mut cleaned_chunks = Vec::new();
        for chunk in &chunks {
            if task.token.is_cancelled() {
                return Err(TextProcessingError::Cancelled.into());
            }
            let max_tokens = inference::clean_text_max_tokens(chunk);
            let messages = inference::build_clean_text_messages(chunk);
            let chunk_result = inference::run_inference(
                task.port,
                &messages,
                task.sampling,
                max_tokens,
                task.progress_id(),
                &task.token,
                &app,
            )
            .await
            .map_err::<String, _>(Into::into)?;
            cleaned_chunks.push(chunk_result);
        }
        cleaned_chunks.join("\n\n")
    };

    Ok(result)
}

/// Whether a task streams `text-processing:inference-progress` to the frontend.
///
/// The frontend keeps a single module-level progress signal and derives the
/// cancel target from it, so two reporting tasks running at once are
/// indistinguishable: the later one wins and `cancel()` stops the wrong task
/// while the visible stream shows the wrong tokens. Only the operations a user
/// can watch and cancel report; the rest run silently.
#[derive(Clone, Copy, PartialEq, Eq)]
enum ProgressReporting {
    Enabled,
    Silent,
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

/// Bundle of state shared by every inference command. The `_guard` field is
/// the RAII handle that removes the task from `INFERENCE_TASK_MANAGER` on
/// Drop — keep this struct alive for the full duration of the inference
/// call. Prefer field-access (`task.token`) over destructuring; a partial
/// destructure like `let InferenceTask { token, .. } = ...;` would drop the
/// guard early and silently disable cancellation.
struct InferenceTask {
    task_id: String,
    reporting: ProgressReporting,
    token: Arc<CancellationToken>,
    port: u16,
    /// Official recommended sampling for the effective model (`None` falls
    /// back to llama-server defaults).
    sampling: Option<models::SamplingParams>,
    // Held for its Drop side-effect only. The leading underscore documents
    // intent and silences the `dead_code` lint without `#[allow]`.
    _guard: TaskGuard,
}

impl InferenceTask {
    /// The id to report progress under, or `None` when the task runs silently.
    /// The task stays registered for cancellation either way.
    fn progress_id(&self) -> Option<&str> {
        match self.reporting {
            ProgressReporting::Enabled => Some(&self.task_id),
            ProgressReporting::Silent => None,
        }
    }
}

/// Standard preamble shared by every inference command: allocate a task id,
/// register it with the inference task manager, emit the initial progress event
/// so the frontend sees the taskId immediately (when `reporting` is
/// [`ProgressReporting::Enabled`]), ensure the llama-server is running with the
/// requested model, and bail out early if the task was cancelled while the
/// server was starting.
async fn begin_task(
    app: &AppHandle,
    manager: &State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    model_id: Option<&str>,
    reporting: ProgressReporting,
) -> Result<InferenceTask, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let token = inference::INFERENCE_TASK_MANAGER.create_task(&task_id);
    let guard = TaskGuard {
        task_id: task_id.clone(),
    };
    if reporting == ProgressReporting::Enabled {
        inference::emit_initial_progress(app, &task_id);
    }
    let (port, effective_model_id) = ensure_server_running(app, manager, model_id).await?;
    if token.is_cancelled() {
        return Err(TextProcessingError::Cancelled.into());
    }
    Ok(InferenceTask {
        task_id,
        reporting,
        token,
        port,
        sampling: models::sampling_params(&effective_model_id),
        _guard: guard,
    })
}

// --- Helper functions ---

/// Ensures the server is running with the given (or first available) model.
/// Returns the port together with the effective model id so callers can
/// resolve model-specific request parameters.
async fn ensure_server_running(
    app: &AppHandle,
    manager: &State<'_, tokio::sync::Mutex<LlamaServerManager>>,
    model_id: Option<&str>,
) -> Result<(u16, String), String> {
    let app_data_dir = paths::app_data_dir(app)?;

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

    if mgr.is_running() && mgr.model_id() == Some(model_id.as_str()) {
        if let Some(port) = mgr.port() {
            if quick_health_check(port).await {
                return Ok((port, model_id));
            }
            // Server process alive but unresponsive — stop and restart
            eprintln!("llama-server process alive but unresponsive, restarting");
            let _ = mgr.stop().await;
        }
    }

    // Start the server
    let port = mgr
        .start(&app_data_dir, &model_id)
        .await
        .map_err::<String, _>(Into::into)?;

    Ok((port, model_id))
}

/// Quick health check with a short timeout to verify the server is responsive.
async fn quick_health_check(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{port}/health");
    let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
    else {
        return false;
    };
    matches!(client.get(&url).send().await, Ok(resp) if resp.status().is_success())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

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
