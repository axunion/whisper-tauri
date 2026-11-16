use std::path::PathBuf;

use tauri::AppHandle;

use crate::paths;

use super::audio;
use super::db;
use super::error::HistoryError;
use super::types::{
    AiContent, AiContentSaveParams, HistoryEntry, HistoryFilter, HistoryMeta, HistorySaveParams,
    HistorySearchParams, SegmentUpdate, StorageStats,
};

/// Returns the database path, initializing the database on first use.
///
/// Schema setup and migrations run once per process rather than on every
/// history command. The lock is held across `init_db` so that two commands
/// arriving together cannot both run a migration: a step such as `ALTER TABLE
/// … ADD COLUMN` fails if it runs twice.
fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    static INITIALIZED: std::sync::Mutex<bool> = std::sync::Mutex::new(false);

    let app_data_dir = paths::app_data_dir(app)?;
    let path = db::db_path(&app_data_dir);

    // The flag is only set after a successful init, so a poisoned lock still
    // guards a consistent value.
    let mut initialized = INITIALIZED
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !*initialized {
        std::fs::create_dir_all(&app_data_dir).map_err(HistoryError::from)?;
        db::init_db(&path)?;
        *initialized = true;
    }
    Ok(path)
}

/// Saves a transcription result to history and returns the new entry ID.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the entry cannot be saved.
#[tauri::command]
#[specta::specta]
pub async fn history_save(app: AppHandle, params: HistorySaveParams) -> Result<String, String> {
    let db_path = get_db_path(&app)?;
    db::save_entry(&db_path, &params).map_err(Into::into)
}

/// Lists history entries matching the given filter.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_list(
    app: AppHandle,
    filter: HistoryFilter,
) -> Result<Vec<HistoryMeta>, String> {
    let db_path = get_db_path(&app)?;
    db::list_entries(&db_path, &filter).map_err(Into::into)
}

/// Gets a full history entry by ID.
///
/// # Errors
///
/// Returns an error if the entry is not found or the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_get(app: AppHandle, id: String) -> Result<HistoryEntry, String> {
    let db_path = get_db_path(&app)?;
    let mut entry = db::get_entry(&db_path, &id)?;
    entry.audio_path = audio::existing_audio(&paths::app_data_dir(&app)?, &entry.id)
        .map(|path| paths::path_to_owned_string(&path))
        .transpose()?;
    Ok(entry)
}

/// Deletes history entries by their IDs.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_delete(app: AppHandle, ids: Vec<String>) -> Result<u64, String> {
    let db_path = get_db_path(&app)?;
    let deleted = db::delete_entries(&db_path, &ids)?;
    // The rows are gone at this point, so a file that cannot be removed must
    // not turn the delete into a failure: the caller would keep showing
    // entries that no longer exist. A leftover file only costs disk, and
    // "delete all audio" in Settings reclaims it.
    let app_data_dir = paths::app_data_dir(&app)?;
    for id in &ids {
        if let Err(e) = audio::delete_audio(&app_data_dir, id) {
            eprintln!("[history] failed to delete audio of {id}: {e}");
        }
    }
    Ok(deleted)
}

/// Deletes all history entries.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_delete_all(app: AppHandle) -> Result<u64, String> {
    let db_path = get_db_path(&app)?;
    let deleted = db::delete_all_entries(&db_path)?;
    // Best-effort for the same reason as in `history_delete`.
    if let Err(e) = audio::delete_all_audio(&paths::app_data_dir(&app)?) {
        eprintln!("[history] failed to delete audio: {e}");
    }
    Ok(deleted)
}

/// Keeps a just-transcribed recording as the audio of history entry `id`.
///
/// # Errors
///
/// Returns an error if `recording_path` is outside the recordings directory
/// or the file cannot be moved.
#[tauri::command]
#[specta::specta]
pub async fn history_attach_recording(
    app: AppHandle,
    id: String,
    recording_path: String,
) -> Result<(), String> {
    let app_data_dir = paths::app_data_dir(&app)?;
    audio::attach_recording(&app_data_dir, &id, std::path::Path::new(&recording_path))
        .map_err(Into::into)
}

/// Gives history entry `to_id` a copy of the audio of entry `from_id`.
///
/// # Errors
///
/// Returns an error if the source entry has no audio or the copy fails.
#[tauri::command]
#[specta::specta]
pub async fn history_copy_audio(
    app: AppHandle,
    from_id: String,
    to_id: String,
) -> Result<(), String> {
    audio::copy_audio(&paths::app_data_dir(&app)?, &from_id, &to_id).map_err(Into::into)
}

/// Deletes the audio of history entry `id`, keeping the entry itself.
///
/// # Errors
///
/// Returns an error if the file cannot be deleted.
#[tauri::command]
#[specta::specta]
pub async fn history_delete_audio(app: AppHandle, id: String) -> Result<(), String> {
    audio::delete_audio(&paths::app_data_dir(&app)?, &id).map_err(Into::into)
}

/// Deletes the audio of every history entry, keeping the entries.
///
/// # Errors
///
/// Returns an error if a file cannot be deleted.
#[tauri::command]
#[specta::specta]
pub async fn history_delete_all_audio(app: AppHandle) -> Result<(), String> {
    audio::delete_all_audio(&paths::app_data_dir(&app)?).map_err(Into::into)
}

/// Deletes recordings that were never transcribed, except `keep_path` — the
/// recording the current session still holds.
///
/// # Errors
///
/// Returns an error if a file cannot be deleted.
#[tauri::command]
#[specta::specta]
pub async fn history_delete_pending_recordings(
    app: AppHandle,
    keep_path: Option<String>,
) -> Result<(), String> {
    audio::delete_pending_recordings(
        &paths::app_data_dir(&app)?,
        keep_path.as_deref().map(std::path::Path::new),
    )
    .map_err(Into::into)
}

/// Reports the disk used by kept audio and by untranscribed recordings other
/// than `keep_path` — the recording the current session still holds.
///
/// # Errors
///
/// Returns an error if the directories cannot be read.
#[tauri::command]
#[specta::specta]
pub async fn history_storage_stats(
    app: AppHandle,
    keep_path: Option<String>,
) -> Result<StorageStats, String> {
    audio::storage_stats(
        &paths::app_data_dir(&app)?,
        keep_path.as_deref().map(std::path::Path::new),
    )
    .map_err(Into::into)
}

/// Renames a history entry's file name.
///
/// # Errors
///
/// Returns an error if the entry is not found or the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_rename(app: AppHandle, id: String, file_name: String) -> Result<(), String> {
    let db_path = get_db_path(&app)?;
    db::rename_entry(&db_path, &id, &file_name).map_err(Into::into)
}

/// Replaces the text of segment `index` of entry `id` and returns what
/// changed with it.
///
/// # Errors
///
/// Returns an error if the entry or segment does not exist or the database
/// cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_update_segment(
    app: AppHandle,
    id: String,
    index: usize,
    text: String,
) -> Result<SegmentUpdate, String> {
    let db_path = get_db_path(&app)?;
    db::update_segment(&db_path, &id, index, &text).map_err(Into::into)
}

/// Searches history entries using full-text search.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the search fails.
#[tauri::command]
#[specta::specta]
pub async fn history_search(
    app: AppHandle,
    params: HistorySearchParams,
) -> Result<Vec<HistoryMeta>, String> {
    let db_path = get_db_path(&app)?;
    let conn = db::open_connection(&db_path)?;
    super::search::search_entries(&conn, &params).map_err(Into::into)
}

/// Saves AI-generated content for a history entry.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the content cannot be saved.
#[tauri::command]
#[specta::specta]
pub async fn history_save_ai_content(
    app: AppHandle,
    params: AiContentSaveParams,
) -> Result<String, String> {
    let db_path = get_db_path(&app)?;
    db::save_ai_content(&db_path, &params).map_err(Into::into)
}

/// Gets AI-generated content by history ID and content type.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_get_ai_content(
    app: AppHandle,
    history_id: String,
    content_type: String,
) -> Result<Option<AiContent>, String> {
    let db_path = get_db_path(&app)?;
    db::get_ai_content(&db_path, &history_id, &content_type).map_err(Into::into)
}

/// Gets all AI-generated content for a history entry.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
#[specta::specta]
pub async fn history_get_all_ai_content(
    app: AppHandle,
    history_id: String,
) -> Result<Vec<AiContent>, String> {
    let db_path = get_db_path(&app)?;
    db::get_all_ai_content(&db_path, &history_id).map_err(Into::into)
}
