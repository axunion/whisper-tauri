use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use super::downloader;
use super::error::ConverterError;
use super::ffmpeg;
use super::types::{ConversionResult, FfmpegDownloadProgress, SupportedFormat};

/// Store filename for settings.
const SETTINGS_STORE: &str = "settings.json";

/// Store key for custom ffmpeg download URL.
const FFMPEG_DOWNLOAD_URL_KEY: &str = "ffmpegDownloadUrl";

/// Resolves the app data directory from a Tauri `AppHandle`.
fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, ConverterError> {
    app.path()
        .app_data_dir()
        .map_err(|e| ConverterError::PathError(e.to_string()))
}

/// Resolves the ffmpeg binary path, checking bundled then system PATH.
///
/// Returns the path to a working ffmpeg binary, or an error if none found.
fn resolve_ffmpeg_path(app_data_dir: &Path) -> Result<PathBuf, ConverterError> {
    // 1. Check bundled ffmpeg
    let bundled_path = downloader::get_ffmpeg_path(app_data_dir);
    if ffmpeg::check_available(&bundled_path).is_ok() {
        return Ok(bundled_path);
    }

    // 2. Check system PATH
    if ffmpeg::check_system_available().is_ok() {
        return Ok(PathBuf::from("ffmpeg"));
    }

    Err(ConverterError::FfmpegNotFound(
        "ffmpeg is not available. Please download it from settings.".to_string(),
    ))
}

/// Checks whether ffmpeg is available (bundled or system PATH).
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved.
#[tauri::command]
pub async fn check_ffmpeg_available(app: AppHandle) -> Result<bool, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    Ok(resolve_ffmpeg_path(&app_data_dir).is_ok())
}

/// Checks whether the bundled ffmpeg binary exists (ignores system PATH).
///
/// Used by the settings page to show download status independently of
/// whether the user happens to have ffmpeg installed system-wide.
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved.
#[tauri::command]
pub async fn check_ffmpeg_bundled(app: AppHandle) -> Result<bool, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    let bundled_path = downloader::get_ffmpeg_path(&app_data_dir);
    Ok(ffmpeg::check_available(&bundled_path).is_ok())
}

/// Checks whether the bundled ffmpeg needs a version update.
///
/// Returns `true` if ffmpeg is installed but does not match the pinned version.
/// Returns `false` if ffmpeg is not installed or already matches.
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved.
#[tauri::command]
pub async fn check_ffmpeg_needs_update(app: AppHandle) -> Result<bool, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    Ok(downloader::ffmpeg_needs_update(&app_data_dir))
}

/// Deletes the bundled ffmpeg binary and its version marker.
///
/// # Errors
///
/// Returns an error if the app data directory cannot be resolved or
/// the file cannot be deleted.
#[tauri::command]
pub async fn delete_ffmpeg(app: AppHandle) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    let bundled_path = downloader::get_ffmpeg_path(&app_data_dir);

    if bundled_path.exists() {
        std::fs::remove_file(&bundled_path).map_err(|e| format!("Failed to delete ffmpeg: {e}"))?;
    }

    // Also remove version marker
    let version_path = downloader::ffmpeg_version_path(&app_data_dir);
    let _ = std::fs::remove_file(version_path);

    Ok(())
}

/// Downloads the ffmpeg binary and reports progress via events.
///
/// # Errors
///
/// Returns an error if the download fails.
#[tauri::command]
pub async fn download_ffmpeg(app: AppHandle) -> Result<String, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;

    // Get custom URL if configured
    let custom_url = get_ffmpeg_download_url_internal(&app)?;

    let app_clone = app.clone();
    let path = downloader::download_ffmpeg(
        &app_data_dir,
        custom_url.as_deref(),
        move |downloaded, total, progress| {
            let _ = app_clone.emit(
                "ffmpeg:download-progress",
                FfmpegDownloadProgress {
                    downloaded_bytes: downloaded,
                    total_bytes: total,
                    progress,
                },
            );
        },
    )
    .await
    .map_err::<String, _>(Into::into)?;

    path.to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| ConverterError::PathError("Invalid path encoding".to_string()).into())
}

/// Gets the custom ffmpeg download URL from settings.
fn get_ffmpeg_download_url_internal(app: &AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| ConverterError::StoreError(e.to_string()))?;

    let value = store
        .get(FFMPEG_DOWNLOAD_URL_KEY)
        .and_then(|v| v.as_str().map(std::string::ToString::to_string));

    Ok(value)
}

/// Gets the custom ffmpeg download base URL from settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be accessed.
#[tauri::command]
pub async fn get_ffmpeg_download_url(app: AppHandle) -> Result<Option<String>, String> {
    get_ffmpeg_download_url_internal(&app)
}

/// Sets or clears the custom ffmpeg download base URL in settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be accessed.
#[tauri::command]
pub async fn set_ffmpeg_download_url(app: AppHandle, url: Option<String>) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| ConverterError::StoreError(e.to_string()))?;

    match url {
        Some(u) => {
            store.set(FFMPEG_DOWNLOAD_URL_KEY, serde_json::Value::String(u));
        }
        None => {
            store.delete(FFMPEG_DOWNLOAD_URL_KEY);
        }
    }

    Ok(())
}

/// Converts an audio/video file to WAV format using ffmpeg.
///
/// The output file is placed in the system temp directory.
///
/// # Errors
///
/// Returns an error if ffmpeg is not available, the format is unsupported,
/// or the conversion fails.
#[tauri::command]
pub async fn convert_audio_file(
    app: AppHandle,
    input_path: String,
) -> Result<ConversionResult, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    let ffmpeg_path = resolve_ffmpeg_path(&app_data_dir)?;

    let input = std::path::Path::new(&input_path);

    // Validate format
    let extension = input.extension().and_then(|e| e.to_str()).unwrap_or("");

    if !super::is_supported_format(extension) {
        return Err(ConverterError::UnsupportedFormat(extension.to_string()).into());
    }

    if !super::needs_conversion(extension) {
        // WAV files don't need conversion
        return Ok(ConversionResult {
            output_path: input_path.clone(),
            original_path: input_path,
        });
    }

    // Generate output path in temp directory
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("audio");
    let output_name = format!("{stem}_converted.wav");
    let output_path = std::env::temp_dir().join(output_name);

    // Run conversion on a blocking thread (ffmpeg is CPU-bound)
    let ffmpeg_path_clone = ffmpeg_path.clone();
    let input_clone = input.to_path_buf();
    let output_clone = output_path.clone();

    tokio::task::spawn_blocking(move || {
        ffmpeg::convert_to_wav(&ffmpeg_path_clone, &input_clone, &output_clone)
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
    .map_err::<String, _>(Into::into)?;

    let output_str = output_path
        .to_str()
        .map(std::string::ToString::to_string)
        .ok_or_else(|| ConverterError::PathError("Invalid output path encoding".to_string()))?;

    Ok(ConversionResult {
        output_path: output_str,
        original_path: input_path,
    })
}

/// Returns the list of supported audio/video formats.
///
/// # Errors
///
/// This command does not produce errors.
#[tauri::command]
pub async fn get_supported_formats() -> Result<Vec<SupportedFormat>, String> {
    Ok(super::get_supported_formats())
}

/// Cleans up a converted temporary WAV file.
///
/// Only deletes files in the system temp directory for safety.
///
/// # Errors
///
/// Returns an error if the file cannot be deleted.
#[tauri::command]
pub async fn cleanup_converted_file(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);

    // Safety check: only delete files in temp directory
    let temp_dir = std::env::temp_dir();
    if !path.starts_with(&temp_dir) {
        return Err("Cannot delete files outside of temp directory".to_string());
    }

    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("Failed to cleanup: {e}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn cleanup_converted_file_deletes_temp_file() {
        let temp_file = std::env::temp_dir().join("whisper-test-cleanup.wav");
        std::fs::write(&temp_file, b"dummy wav").expect("create temp file");
        assert!(temp_file.exists());

        let result = cleanup_converted_file(temp_file.to_string_lossy().to_string()).await;
        assert!(result.is_ok());
        assert!(!temp_file.exists(), "file should be deleted");
    }

    #[tokio::test]
    async fn cleanup_converted_file_rejects_non_temp_path() {
        let result = cleanup_converted_file("/usr/local/bin/ffmpeg".to_string()).await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Cannot delete files outside of temp directory"));
    }

    #[tokio::test]
    async fn cleanup_converted_file_succeeds_for_nonexistent_file() {
        let temp_file = std::env::temp_dir().join("whisper-test-nonexistent-cleanup.wav");
        assert!(!temp_file.exists());

        let result = cleanup_converted_file(temp_file.to_string_lossy().to_string()).await;
        assert!(result.is_ok(), "should succeed silently for missing files");
    }
}
