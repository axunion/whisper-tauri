use crate::ipc_error::IpcError;
use tauri::AppHandle;

use super::client;
use super::error::NotionError;
use super::types::{NotionDatabaseInfo, NotionPagePayload, NotionPageRef, NotionSettings};
use crate::settings::{get_strings, set_or_delete_string, set_or_delete_strings};

const KEY_ENABLED: &str = "notionEnabled";
const KEY_TOKEN: &str = "notionToken";
const KEY_DATABASE_ID: &str = "notionDatabaseId";
const KEY_TITLE_PROPERTY: &str = "notionTitleProperty";

fn read_settings(app: &AppHandle) -> Result<NotionSettings, NotionError> {
    let values = get_strings(
        app,
        &[KEY_ENABLED, KEY_TOKEN, KEY_DATABASE_ID, KEY_TITLE_PROPERTY],
    )?;
    let enabled = values[0].as_deref() == Some("true");
    Ok(NotionSettings {
        enabled,
        token: values[1].clone(),
        database_id: values[2].clone(),
        title_property: values[3].clone(),
    })
}

/// Returns the persisted Notion integration settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be read.
#[tauri::command]
#[specta::specta]
pub async fn notion_get_settings(app: AppHandle) -> Result<NotionSettings, IpcError> {
    read_settings(&app).map_err(Into::into)
}

/// Persists Notion integration settings.
///
/// # Errors
///
/// Returns an error if the settings store cannot be written.
#[tauri::command]
#[specta::specta]
pub async fn notion_set_settings(app: AppHandle, settings: NotionSettings) -> Result<(), IpcError> {
    set_or_delete_strings(
        &app,
        &[
            (
                KEY_ENABLED,
                Some(if settings.enabled { "true" } else { "false" }.to_string()),
            ),
            (KEY_TOKEN, settings.token),
            (KEY_DATABASE_ID, settings.database_id),
            (KEY_TITLE_PROPERTY, settings.title_property),
        ],
    )
    .map_err(Into::into)
}

/// Verifies the API token and database ID and discovers the title property.
///
/// On success, the discovered title property is persisted so subsequent
/// page-creation calls don't need to refetch the database schema.
///
/// # Errors
///
/// Returns an error if the HTTP request fails, the database lacks a
/// title property, or the response cannot be parsed.
#[tauri::command]
#[specta::specta]
pub async fn notion_test_connection(
    app: AppHandle,
    token: String,
    database_id: String,
) -> Result<NotionDatabaseInfo, IpcError> {
    let info = client::fetch_database(&token, &database_id).await?;
    set_or_delete_string(&app, KEY_TITLE_PROPERTY, Some(info.title_property.clone()))?;
    Ok(info)
}

/// Creates a new Notion page using the persisted settings.
///
/// # Errors
///
/// Returns an error when Notion is not configured, the HTTP request
/// fails, the API returns a non-2xx status, or the response cannot be parsed.
#[tauri::command]
#[specta::specta]
pub async fn notion_create_page(
    app: AppHandle,
    payload: NotionPagePayload,
) -> Result<NotionPageRef, IpcError> {
    let settings = read_settings(&app)?;
    let token = settings.token.ok_or(NotionError::NotConfigured)?;
    let database_id = settings.database_id.ok_or(NotionError::NotConfigured)?;
    let title_property = settings.title_property.ok_or(NotionError::NotConfigured)?;
    let page_ref = client::create_page(&token, &database_id, &title_property, &payload).await?;
    Ok(page_ref)
}
