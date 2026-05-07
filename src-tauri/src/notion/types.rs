use serde::{Deserialize, Serialize};

/// User-configurable Notion integration settings persisted in the settings store.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSettings {
    pub enabled: bool,
    pub token: Option<String>,
    pub database_id: Option<String>,
    /// Title property name discovered when the connection was tested.
    pub title_property: Option<String>,
}

/// Payload for creating a single Notion page.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPagePayload {
    pub title: String,
    pub body_text: String,
}

/// Reference to a freshly created Notion page.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPageRef {
    pub page_id: String,
    pub url: String,
}

/// Information about a database returned by a successful connection test.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionDatabaseInfo {
    pub id: String,
    pub title: String,
    pub title_property: String,
}
