use std::path::{Path, PathBuf};
use std::time::Instant;

use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::download;
use crate::paths;
use crate::settings;

use super::error::WhisperError;
use super::models;
use super::process;
use super::types::{DownloadProgress, ModelInfo, TranscriptionProgress, TranscriptionResult};

/// Progress event throttle interval in milliseconds.
const PROGRESS_THROTTLE_MS: u128 = 100;

/// Store key for custom model download base URL.
const MODEL_DOWNLOAD_URL_KEY: &str = "modelDownloadBaseUrl";

/// Returns the models directory under the app data directory.
///
/// # Errors
///
/// Returns an error if the path cannot be constructed.
pub fn models_dir(app_data_dir: &Path) -> Result<PathBuf, WhisperError> {
    let dir = app_data_dir.join("models");
    Ok(dir)
}

/// Returns the path to a specific model file.
///
/// # Errors
///
/// Returns `WhisperError::ModelNotFound` if the model ID is invalid.
pub fn model_path(app_data_dir: &Path, model_id: &str) -> Result<PathBuf, WhisperError> {
    if !models::is_valid_model_id(model_id) {
        return Err(WhisperError::ModelNotFound(model_id.to_string()));
    }
    let dir = models_dir(app_data_dir)?;
    Ok(dir.join(models::get_model_filename(model_id)))
}

/// Checks whether a model file exists on disk.
///
/// # Errors
///
/// Returns `WhisperError::ModelNotFound` if the model ID is invalid.
pub fn model_exists(app_data_dir: &Path, model_id: &str) -> Result<bool, WhisperError> {
    let path = model_path(app_data_dir, model_id)?;
    Ok(path.exists())
}

/// Returns available models with download status.
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved.
#[tauri::command]
pub async fn get_available_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let mut model_list = models::get_model_list_with_speed_factors();

    for model in &mut model_list {
        match model_exists(&app_data_dir, &model.id) {
            Ok(true) => {
                model.downloaded = true;
                if let Ok(path) = model_path(&app_data_dir, &model.id) {
                    model.path = path.to_str().map(std::string::ToString::to_string);
                }
            }
            Ok(false) => {}
            Err(e) => return Err(e.into()),
        }
    }

    Ok(model_list)
}

/// Checks whether a specific model file exists.
///
/// # Errors
///
/// Returns an error if the model ID is invalid or the app data directory
/// cannot be resolved.
#[tauri::command]
pub async fn check_model_exists(app: AppHandle, model_id: String) -> Result<bool, String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    model_exists(&app_data_dir, &model_id).map_err(Into::into)
}

/// Downloads a model file with progress reporting.
///
/// Uses a `.bin.part` temporary file during download, renaming to `.bin` on
/// completion.
///
/// # Errors
///
/// Returns an error if the model ID is invalid, the download fails, or
/// the file cannot be written.
#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    model_id: String,
    base_url: Option<String>,
) -> Result<String, String> {
    if !models::is_valid_model_id(&model_id) {
        return Err(WhisperError::ModelNotFound(model_id).into());
    }

    let app_data_dir = paths::app_data_dir(&app)?;
    let dir = models_dir(&app_data_dir)?;

    // Create models directory if it doesn't exist
    std::fs::create_dir_all(&dir).map_err(WhisperError::from)?;

    let base = base_url
        .as_deref()
        .unwrap_or_else(|| models::get_default_base_url());
    let url = models::get_model_url(&model_id, base);

    let final_path = model_path(&app_data_dir, &model_id)?;
    let part_path = final_path.with_extension("bin.part");

    // Start download
    let response = reqwest::get(&url).await.map_err(WhisperError::from)?;

    let status = response.status();
    if !status.is_success() {
        return Err(WhisperError::DownloadFailed(format!("HTTP {status} for {url}")).into());
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(&part_path)
        .await
        .map_err(WhisperError::from)?;
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(WhisperError::from)?;
        file.write_all(&chunk).await.map_err(WhisperError::from)?;
        downloaded_bytes += chunk.len() as u64;

        // Throttle progress events
        if last_emit.elapsed().as_millis() >= PROGRESS_THROTTLE_MS {
            let progress = if total_bytes > 0 {
                #[allow(clippy::cast_precision_loss)]
                {
                    (downloaded_bytes as f64 / total_bytes as f64) * 100.0
                }
            } else {
                0.0
            };

            let _ = app.emit(
                "model:download-progress",
                DownloadProgress {
                    model_id: model_id.clone(),
                    downloaded_bytes,
                    total_bytes,
                    progress,
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush().await.map_err(WhisperError::from)?;
    drop(file);

    // Rename .part to final path
    tokio::fs::rename(&part_path, &final_path)
        .await
        .map_err(WhisperError::from)?;

    // Emit final 100% progress
    let _ = app.emit(
        "model:download-progress",
        DownloadProgress {
            model_id,
            downloaded_bytes,
            total_bytes,
            progress: 100.0,
        },
    );

    paths::path_to_owned_string(&final_path).map_err(Into::into)
}

/// Deletes a downloaded model file.
///
/// # Errors
///
/// Returns an error if the model ID is invalid or the file cannot be deleted.
#[tauri::command]
pub async fn delete_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let path = model_path(&app_data_dir, &model_id)?;

    if path.exists() {
        std::fs::remove_file(&path).map_err(WhisperError::from)?;
    }

    Ok(())
}

/// Gets the custom model download base URL from settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be accessed.
#[tauri::command]
pub async fn get_model_download_url(app: AppHandle) -> Result<Option<String>, String> {
    settings::get_string(&app, MODEL_DOWNLOAD_URL_KEY).map_err(Into::into)
}

/// Sets or clears the custom model download base URL in settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be accessed.
#[tauri::command]
pub async fn set_model_download_url(app: AppHandle, url: Option<String>) -> Result<(), String> {
    settings::set_or_delete_string(&app, MODEL_DOWNLOAD_URL_KEY, url).map_err(Into::into)
}

/// Returns the path to the VAD model file.
///
/// # Errors
///
/// Returns an error if the models directory path cannot be constructed.
pub fn vad_model_path(app_data_dir: &Path) -> Result<PathBuf, WhisperError> {
    let dir = models_dir(app_data_dir)?;
    Ok(dir.join(models::get_vad_model_filename()))
}

/// Ensures the Silero VAD model is downloaded, downloading it if necessary.
///
/// Returns the path to the VAD model file.
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved or the
/// download fails.
#[tauri::command]
pub async fn ensure_vad_model(app: AppHandle) -> Result<String, String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let path = vad_model_path(&app_data_dir)?;

    if path.exists() {
        return paths::path_to_owned_string(&path).map_err(Into::into);
    }

    let dir = models_dir(&app_data_dir)?;
    std::fs::create_dir_all(&dir).map_err(WhisperError::from)?;

    let part_path = path.with_extension("bin.part");
    let url = models::get_vad_model_url();

    download::download_file(url, &part_path, |_, _, _| {})
        .await
        .map_err(|e| WhisperError::DownloadFailed(e.to_string()))?;

    tokio::fs::rename(&part_path, &path)
        .await
        .map_err(WhisperError::from)?;

    paths::path_to_owned_string(&path).map_err(Into::into)
}

/// Transcribes a WAV audio file using the specified Whisper model.
///
/// Runs the transcription on a blocking thread to avoid blocking the
/// async runtime. Emits `whisper:progress` events during processing.
///
/// # Errors
///
/// Returns an error if the audio file cannot be read, the model cannot
/// be loaded, or the transcription fails.
#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    model_path: String,
    language: Option<String>,
    vad_model_path: Option<String>,
) -> Result<TranscriptionResult, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let token = process::TASK_MANAGER.create_task(&task_id);
    let _guard = TaskGuard {
        task_id: task_id.clone(),
    };

    // Emit an initial progress event so the frontend receives the task_id
    // and can enable the cancel button before heavy work begins.
    let _ = app.emit(
        "whisper:progress",
        TranscriptionProgress {
            task_id: task_id.clone(),
            progress: 0.0,
            elapsed_ms: 0,
        },
    );

    if token.is_cancelled() {
        return Err(WhisperError::Cancelled.into());
    }

    // Load WAV file on current thread (I/O bound)
    let path = PathBuf::from(&audio_path);
    let samples = process::load_wav_file(&path).map_err::<String, _>(Into::into)?;

    if token.is_cancelled() {
        return Err(WhisperError::Cancelled.into());
    }

    let task_id_clone = task_id.clone();

    // Run transcription on a blocking thread (CPU bound)
    tokio::task::spawn_blocking(move || {
        process::transcribe(
            &model_path,
            &samples,
            &task_id_clone,
            &token,
            &app,
            language.as_deref(),
            vad_model_path.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
    .map_err::<String, _>(Into::into)
}

/// RAII guard that removes a task from the transcription task manager on drop.
struct TaskGuard {
    task_id: String,
}

impl Drop for TaskGuard {
    fn drop(&mut self) {
        process::TASK_MANAGER.remove_task(&self.task_id);
    }
}

/// Cancels an in-progress transcription task.
///
/// # Errors
///
/// This command does not produce errors but returns `false` if the
/// task ID was not found.
#[tauri::command]
pub async fn cancel_transcription(task_id: String) -> Result<bool, String> {
    Ok(process::TASK_MANAGER.cancel_task(&task_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn models_dir_returns_models_subdirectory() {
        let app_data = Path::new("/tmp/test-app-data");
        let dir = models_dir(app_data).unwrap();
        assert_eq!(dir, PathBuf::from("/tmp/test-app-data/models"));
    }

    #[test]
    fn model_path_returns_correct_path() {
        let app_data = Path::new("/tmp/test-app-data");
        let path = model_path(app_data, "small").unwrap();
        assert_eq!(
            path,
            PathBuf::from("/tmp/test-app-data/models/ggml-small.bin")
        );
    }

    #[test]
    fn model_path_rejects_invalid_model_id() {
        let app_data = Path::new("/tmp/test-app-data");
        let result = model_path(app_data, "nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn model_exists_returns_false_when_file_missing() {
        let app_data = Path::new("/tmp/test-whisper-nonexistent");
        let exists = model_exists(app_data, "small").unwrap();
        assert!(!exists);
    }

    #[test]
    fn model_exists_returns_true_when_file_present() {
        let app_data = Path::new("/tmp/claude/test-whisper-exists");
        let dir = app_data.join("models");
        fs::create_dir_all(&dir).unwrap();

        let file_path = dir.join("ggml-small.bin");
        fs::write(&file_path, b"fake model data").unwrap();

        let exists = model_exists(app_data, "small").unwrap();
        assert!(exists);

        // Cleanup
        let _ = fs::remove_dir_all(app_data);
    }

    #[test]
    fn model_exists_rejects_invalid_model_id() {
        let app_data = Path::new("/tmp/test-whisper-invalid");
        let result = model_exists(app_data, "tiny");
        assert!(result.is_err());
    }

    // --- vad_model_path ---

    #[test]
    fn vad_model_path_returns_correct_path() {
        let app_data = Path::new("/tmp/test-app-data");
        let path = vad_model_path(app_data).unwrap();
        assert_eq!(
            path,
            PathBuf::from("/tmp/test-app-data/models/ggml-silero-v5.1.2.bin")
        );
    }

    #[test]
    fn vad_model_path_is_in_models_dir() {
        let app_data = Path::new("/tmp/test-app-data");
        let path = vad_model_path(app_data).unwrap();
        let dir = models_dir(app_data).unwrap();
        assert!(path.starts_with(&dir));
    }
}
