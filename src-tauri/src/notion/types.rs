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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notion_settings_serializes_to_camel_case() {
        let settings = NotionSettings {
            enabled: true,
            token: Some("secret-token".to_string()),
            database_id: Some("db-123".to_string()),
            title_property: Some("Name".to_string()),
        };

        let json = serde_json::to_string(&settings).expect("Failed to serialize");
        assert!(json.contains("\"enabled\":true"));
        assert!(json.contains("\"databaseId\":\"db-123\""));
        assert!(json.contains("\"titleProperty\":\"Name\""));
    }

    #[test]
    fn notion_settings_deserializes_from_camel_case() {
        let json = r#"{"enabled":false,"token":null,"databaseId":"db-123","titleProperty":null}"#;
        let settings: NotionSettings = serde_json::from_str(json).expect("Failed to deserialize");
        assert!(!settings.enabled);
        assert_eq!(settings.token, None);
        assert_eq!(settings.database_id, Some("db-123".to_string()));
        assert_eq!(settings.title_property, None);
    }

    #[test]
    fn notion_page_payload_serializes_to_camel_case() {
        let payload = NotionPagePayload {
            title: "Meeting notes".to_string(),
            meta: vec![NotionMetaField {
                label: "Model".to_string(),
                value: "large-v3-turbo".to_string(),
            }],
            summary: None,
            body_text: "Full transcript".to_string(),
        };

        let json = serde_json::to_string(&payload).expect("Failed to serialize");
        assert!(json.contains("\"title\":\"Meeting notes\""));
        assert!(json.contains("\"meta\":["));
        assert!(json.contains("\"bodyText\":\"Full transcript\""));
    }

    #[test]
    fn notion_page_payload_deserializes_with_defaults() {
        let json = r#"{"title":"Meeting notes","bodyText":"Full transcript"}"#;
        let payload: NotionPagePayload = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(payload.title, "Meeting notes");
        assert_eq!(payload.body_text, "Full transcript");
        assert!(payload.meta.is_empty());
        assert!(payload.summary.is_none());
    }

    #[test]
    fn notion_summary_serializes_to_camel_case() {
        let summary = NotionSummary {
            headline: "Headline".to_string(),
            tldr: "Short summary".to_string(),
            key_points: vec!["Point 1".to_string()],
            action_items: vec![NotionActionItem {
                what: "Do the thing".to_string(),
                due: None,
            }],
            keywords: vec!["whisper".to_string()],
            labels: NotionSummaryLabels::default(),
        };

        let json = serde_json::to_string(&summary).expect("Failed to serialize");
        assert!(json.contains("\"keyPoints\":[\"Point 1\"]"));
        assert!(json.contains("\"actionItems\":["));
        assert!(json.contains("\"keywords\":[\"whisper\"]"));
    }

    #[test]
    fn notion_summary_deserializes_without_headline() {
        let json = r#"{"tldr":"Short summary","keyPoints":[],"actionItems":[],"keywords":[],"labels":{"tldr":"TL;DR","keyPoints":"Key points","actionItems":"Action items","keywords":"Keywords","due":"due"}}"#;
        let summary: NotionSummary = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(summary.headline, "");
        assert_eq!(summary.tldr, "Short summary");
        assert_eq!(summary.labels.key_points, "Key points");
    }

    #[test]
    fn notion_summary_labels_serializes_to_camel_case() {
        let labels = NotionSummaryLabels {
            tldr: "TL;DR".to_string(),
            key_points: "Key points".to_string(),
            action_items: "Action items".to_string(),
            keywords: "Keywords".to_string(),
            due: "due".to_string(),
        };

        let json = serde_json::to_string(&labels).expect("Failed to serialize");
        assert!(json.contains("\"keyPoints\":\"Key points\""));
        assert!(json.contains("\"actionItems\":\"Action items\""));
        assert!(json.contains("\"due\":\"due\""));
    }

    #[test]
    fn notion_action_item_serializes_due_when_some() {
        let item = NotionActionItem {
            what: "Send the report".to_string(),
            due: Some("2026-07-10".to_string()),
        };

        let json = serde_json::to_string(&item).expect("Failed to serialize");
        assert!(json.contains("\"what\":\"Send the report\""));
        assert!(json.contains("\"due\":\"2026-07-10\""));
    }

    #[test]
    fn notion_action_item_skips_none_due() {
        let item = NotionActionItem {
            what: "Send the report".to_string(),
            due: None,
        };

        let json = serde_json::to_string(&item).expect("Failed to serialize");
        assert!(!json.contains("\"due\""));
    }

    #[test]
    fn notion_action_item_deserializes_without_due() {
        let json = r#"{"what":"Send the report"}"#;
        let item: NotionActionItem = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(item.what, "Send the report");
        assert_eq!(item.due, None);
    }

    #[test]
    fn notion_page_ref_serializes_to_camel_case() {
        let page_ref = NotionPageRef {
            page_id: "page-123".to_string(),
            url: "https://notion.so/page-123".to_string(),
            partial: true,
        };

        let json = serde_json::to_string(&page_ref).expect("Failed to serialize");
        assert!(json.contains("\"pageId\":\"page-123\""));
        assert!(json.contains("\"url\":\"https://notion.so/page-123\""));
        assert!(json.contains("\"partial\":true"));
    }

    #[test]
    fn notion_page_ref_deserializes_without_partial() {
        let json = r#"{"pageId":"page-123","url":"https://notion.so/page-123"}"#;
        let page_ref: NotionPageRef = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(page_ref.page_id, "page-123");
        assert!(!page_ref.partial);
    }

    #[test]
    fn notion_database_info_serializes_to_camel_case() {
        let info = NotionDatabaseInfo {
            id: "db-123".to_string(),
            title: "Transcripts".to_string(),
            title_property: "Name".to_string(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"id\":\"db-123\""));
        assert!(json.contains("\"titleProperty\":\"Name\""));
    }
}
