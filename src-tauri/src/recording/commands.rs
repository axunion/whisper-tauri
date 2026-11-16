use crate::ipc_error::IpcError;
use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::paths;

use super::capture::RecordingManager;
use super::types::{AudioDevice, RecordingStopResult};

/// Lists available audio input devices.
///
/// # Errors
///
/// Returns an error string if device enumeration fails.
#[tauri::command]
#[specta::specta]
pub async fn list_audio_devices(
    _state: State<'_, Mutex<RecordingManager>>,
) -> Result<Vec<AudioDevice>, IpcError> {
    RecordingManager::list_devices().map_err(Into::into)
}

/// Starts recording audio from the specified device.
///
/// If `device_id` is `None`, the system default input device is used.
///
/// # Errors
///
/// Returns an error string if a recording is already in progress,
/// the device cannot be found, or the stream cannot be created.
#[tauri::command]
#[specta::specta]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, Mutex<RecordingManager>>,
    device_id: Option<String>,
) -> Result<(), IpcError> {
    let manager = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager.start(device_id, app).map_err(Into::into)
}

/// Pauses the current recording; audio captured while paused is discarded.
///
/// # Errors
///
/// Returns an error string if no recording is in progress.
#[tauri::command]
#[specta::specta]
pub async fn pause_recording(state: State<'_, Mutex<RecordingManager>>) -> Result<(), IpcError> {
    let manager = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager.set_paused(true).map_err(Into::into)
}

/// Resumes a paused recording.
///
/// # Errors
///
/// Returns an error string if no recording is in progress.
#[tauri::command]
#[specta::specta]
pub async fn resume_recording(state: State<'_, Mutex<RecordingManager>>) -> Result<(), IpcError> {
    let manager = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager.set_paused(false).map_err(Into::into)
}

/// Stops the current recording and returns the result.
///
/// The recorded audio is saved as a 16 kHz mono WAV file in the
/// app data directory under `recordings/`.
///
/// # Errors
///
/// Returns an error string if no recording is in progress or the
/// WAV file cannot be written.
#[tauri::command]
#[specta::specta]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, Mutex<RecordingManager>>,
) -> Result<RecordingStopResult, IpcError> {
    let app_data_dir = paths::app_data_dir(&app)?;
    let manager = state.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager.stop(&app_data_dir).map_err(Into::into)
}

/// Deletes a temporary recording file.
///
/// # Errors
///
/// Returns an error string if the path is outside the recordings directory
/// or the file cannot be deleted.
#[tauri::command]
#[specta::specta]
pub async fn cleanup_recording(app: AppHandle, path: String) -> Result<(), IpcError> {
    let app_data_dir = paths::app_data_dir(&app)?;
    RecordingManager::cleanup(&app_data_dir, std::path::Path::new(&path)).map_err(Into::into)
}
