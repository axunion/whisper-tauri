use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use super::db;
use super::error::HistoryError;
use super::types::{
    HistoryEntry, HistoryFilter, HistoryMeta, HistorySaveParams, HistorySearchParams,
};

/// Resolves the app data directory from a Tauri `AppHandle`.
fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, HistoryError> {
    app.path()
        .app_data_dir()
        .map_err(|e| HistoryError::PathError(e.to_string()))
}

/// Returns the database path, initializing the database if needed.
fn get_db_path(app: &AppHandle) -> Result<PathBuf, HistoryError> {
    let app_data_dir = resolve_app_data_dir(app)?;
    std::fs::create_dir_all(&app_data_dir).map_err(HistoryError::from)?;
    let path = db::db_path(&app_data_dir);
    db::init_db(&path)?;
    Ok(path)
}

/// Saves a transcription result to history and returns the new entry ID.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the entry cannot be saved.
#[tauri::command]
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
pub async fn history_get(app: AppHandle, id: String) -> Result<HistoryEntry, String> {
    let db_path = get_db_path(&app)?;
    db::get_entry(&db_path, &id).map_err(Into::into)
}

/// Deletes history entries by their IDs.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
pub async fn history_delete(app: AppHandle, ids: Vec<String>) -> Result<u64, String> {
    let db_path = get_db_path(&app)?;
    db::delete_entries(&db_path, &ids).map_err(Into::into)
}

/// Deletes all history entries.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed.
#[tauri::command]
pub async fn history_delete_all(app: AppHandle) -> Result<u64, String> {
    let db_path = get_db_path(&app)?;
    db::delete_all_entries(&db_path).map_err(Into::into)
}

/// Searches history entries using full-text search.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the search fails.
#[tauri::command]
pub async fn history_search(
    app: AppHandle,
    params: HistorySearchParams,
) -> Result<Vec<HistoryMeta>, String> {
    let db_path = get_db_path(&app)?;
    let conn =
        rusqlite::Connection::open(&db_path).map_err(|e| HistoryError::Database(e.to_string()))?;
    super::search::search_entries(&conn, &params).map_err(Into::into)
}
