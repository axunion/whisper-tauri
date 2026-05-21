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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPagePayload {
    pub title: String,
    #[serde(default)]
    pub meta: Vec<NotionMetaField>,
    #[serde(default)]
    pub summary: Option<NotionSummary>,
    pub body_text: String,
}

/// Single label/value entry rendered inside the metadata callout.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionMetaField {
    pub label: String,
    pub value: String,
}

/// Structured summary block contents derived from `StructuredSummary`.
/// Empty vectors / empty strings mark sections to skip in rendering.
/// `labels` carries the user-facing heading text in the caller's locale so
/// the page renders in the same language the user saw in the summary tab.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSummary {
    #[serde(default)]
    pub headline: String,
    pub tldr: String,
    pub key_points: Vec<String>,
    pub action_items: Vec<NotionActionItem>,
    pub keywords: Vec<String>,
    pub labels: NotionSummaryLabels,
}

/// Localized section headings used when rendering a `NotionSummary` into
/// `heading_2` blocks. `due` is the per-item "due:" prefix.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSummaryLabels {
    pub tldr: String,
    pub key_points: String,
    pub action_items: String,
    pub keywords: String,
    pub due: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionActionItem {
    pub what: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
}

/// Reference to a freshly created Notion page.
///
/// `partial` is true when the page was created but some appended children
/// blocks failed to send — the URL is still valid and openable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPageRef {
    pub page_id: String,
    pub url: String,
    #[serde(default)]
    pub partial: bool,
}

/// Information about a database returned by a successful connection test.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionDatabaseInfo {
    pub id: String,
    pub title: String,
    pub title_property: String,
}
