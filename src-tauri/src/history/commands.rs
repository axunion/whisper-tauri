use std::path::PathBuf;

use tauri::AppHandle;

use crate::paths;

use super::db;
use super::error::HistoryError;
use super::types::{
    AiContent, AiContentSaveParams, HistoryEntry, HistoryFilter, HistoryMeta, HistorySaveParams,
    HistorySearchParams,
};

/// Returns the database path, initializing the database if needed.
fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = paths::app_data_dir(app)?;
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

/// Renames a history entry's file name.
///
/// # Errors
///
/// Returns an error if the entry is not found or the database cannot be accessed.
#[tauri::command]
pub async fn history_rename(app: AppHandle, id: String, file_name: String) -> Result<(), String> {
    let db_path = get_db_path(&app)?;
    db::rename_entry(&db_path, &id, &file_name).map_err(Into::into)
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
    let conn = db::open_connection(&db_path)?;
    super::search::search_entries(&conn, &params).map_err(Into::into)
}

/// Saves AI-generated content for a history entry.
///
/// # Errors
///
/// Returns an error if the database cannot be accessed or the content cannot be saved.
#[tauri::command]
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
pub async fn history_get_all_ai_content(
    app: AppHandle,
    history_id: String,
) -> Result<Vec<AiContent>, String> {
    let db_path = get_db_path(&app)?;
    db::get_all_ai_content(&db_path, &history_id).map_err(Into::into)
}
