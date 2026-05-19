use serde::{Deserialize, Serialize};

/// Text processing model information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextModelInfo {
    /// Model identifier (e.g., "gemma-4-e2b", "qwen3.5-4b")
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable size (e.g., "2.7GB")
    pub size: String,
    /// Size in bytes
    pub size_bytes: u64,
    /// Model description
    pub description: String,
    /// Whether the model is downloaded
    pub downloaded: bool,
    /// Path to the model file (if downloaded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// Information about a legacy (retired) text model file present on disk.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LegacyTextModelInfo {
    /// Model identifier (e.g., the retired model ID)
    pub id: String,
    /// Size in bytes
    pub size_bytes: u64,
    /// Path to the model file
    pub path: String,
}

/// Text model download progress.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextDownloadProgress {
    /// Model identifier being downloaded
    pub model_id: String,
    /// Downloaded bytes
    pub downloaded_bytes: u64,
    /// Total bytes
    pub total_bytes: u64,
    /// Progress percentage (0-100)
    pub progress: f64,
}

/// Inference progress update (streaming tokens).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InferenceProgress {
    /// Task identifier
    pub task_id: String,
    /// Latest token
    pub token: String,
    /// Full accumulated text so far
    pub accumulated_text: String,
    /// Whether inference is complete
    pub done: bool,
}

/// Server status information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    /// Whether the server is running
    pub running: bool,
    /// The port the server is listening on
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    /// The model ID loaded on the server
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
}

/// OpenAI-compatible chat message.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    /// Message role (system, user, assistant)
    pub role: String,
    /// Message content
    pub content: String,
}

/// A single action item extracted from a transcription.
///
/// Assignee inference is intentionally not supported — speaker identification
/// is unreliable from transcripts alone. Only the task itself and an optional
/// due date / timeframe are captured.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionItem {
    /// The task itself.
    pub what: String,
    /// Due date or timeframe phrase. None when unspecified.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
}

/// Structured summary returned by `text_processing_summarize`.
///
/// Every field is required in the JSON schema. `tldr` is a 1–2 sentence
/// paragraph that summarises the whole transcription, while `keyPoints` is a
/// bullet-style list of sub-topics. Arrays may be empty when the
/// transcription does not yield that kind of content (e.g. a monologue with
/// no action items).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StructuredSummary {
    /// Single-line title.
    pub headline: String,
    /// 1–2 sentence overall recap (lead paragraph).
    pub tldr: String,
    /// Salient keywords / topical noun phrases.
    pub keywords: Vec<String>,
    /// Extracted action items, possibly empty.
    pub action_items: Vec<ActionItem>,
    /// Sub-topic bullets, 2–5 entries detailing the body of the discussion.
    pub key_points: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_model_info_serializes_to_camel_case() {
        let model = TextModelInfo {
            id: "qwen3.5-4b".to_string(),
            name: "Qwen3.5 4B".to_string(),
            size: "2.7GB".to_string(),
            size_bytes: 2_900_000_000,
            description: "Test model".to_string(),
            downloaded: true,
            path: Some("/path/to/model.gguf".to_string()),
        };

        let json = serde_json::to_string(&model).expect("Failed to serialize");
        assert!(json.contains("\"sizeBytes\":2900000000"));
        assert!(json.contains("\"path\":\"/path/to/model.gguf\""));
    }

    #[test]
    fn text_model_info_skips_none_path() {
        let model = TextModelInfo {
            id: "test".to_string(),
            name: "Test".to_string(),
            size: "1GB".to_string(),
            size_bytes: 1_000_000_000,
            description: "Test".to_string(),
            downloaded: false,
            path: None,
        };

        let json = serde_json::to_string(&model).expect("Failed to serialize");
        assert!(!json.contains("\"path\""));
    }

    #[test]
    fn legacy_text_model_info_serializes_to_camel_case() {
        let info = LegacyTextModelInfo {
            id: "retired-model".to_string(),
            size_bytes: 1_234_567_890,
            path: "/path/to/retired-model.gguf".to_string(),
        };

        let json = serde_json::to_string(&info).expect("Failed to serialize");
        assert!(json.contains("\"id\":\"retired-model\""));
        assert!(json.contains("\"sizeBytes\":1234567890"));
        assert!(json.contains("\"path\":\"/path/to/retired-model.gguf\""));
    }

    #[test]
    fn text_download_progress_serializes_correctly() {
        let progress = TextDownloadProgress {
            model_id: "qwen3.5-4b".to_string(),
            downloaded_bytes: 500_000_000,
            total_bytes: 2_900_000_000,
            progress: 17.2,
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"modelId\":\"qwen3.5-4b\""));
        assert!(json.contains("\"downloadedBytes\":500000000"));
        assert!(json.contains("\"totalBytes\":2900000000"));
    }

    #[test]
    fn inference_progress_serializes_correctly() {
        let progress = InferenceProgress {
            task_id: "task-123".to_string(),
            token: "hello".to_string(),
            accumulated_text: "hello world".to_string(),
            done: false,
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"taskId\":\"task-123\""));
        assert!(json.contains("\"accumulatedText\":\"hello world\""));
    }

    #[test]
    fn server_status_serializes_correctly() {
        let status = ServerStatus {
            running: true,
            port: Some(8080),
            model_id: Some("qwen3.5-4b".to_string()),
        };

        let json = serde_json::to_string(&status).expect("Failed to serialize");
        assert!(json.contains("\"running\":true"));
        assert!(json.contains("\"port\":8080"));
        assert!(json.contains("\"modelId\":\"qwen3.5-4b\""));
    }

    #[test]
    fn server_status_skips_none_fields() {
        let status = ServerStatus {
            running: false,
            port: None,
            model_id: None,
        };

        let json = serde_json::to_string(&status).expect("Failed to serialize");
        assert!(!json.contains("\"port\""));
        assert!(!json.contains("\"modelId\""));
    }

    #[test]
    fn chat_message_serializes_correctly() {
        let msg = ChatMessage {
            role: "system".to_string(),
            content: "You are a helpful assistant.".to_string(),
        };

        let json = serde_json::to_string(&msg).expect("Failed to serialize");
        assert!(json.contains("\"role\":\"system\""));
        assert!(json.contains("\"content\":\"You are a helpful assistant.\""));
    }

    #[test]
    fn structured_summary_roundtrips_full() {
        let summary = StructuredSummary {
            headline: "週次ミーティング".to_string(),
            tldr: "進捗共有と課題整理を行った会議。".to_string(),
            keywords: vec!["進捗".to_string(), "課題".to_string()],
            action_items: vec![ActionItem {
                what: "資料をまとめる".to_string(),
                due: Some("金曜".to_string()),
            }],
            key_points: vec!["バックエンド完了".to_string()],
        };

        let json = serde_json::to_string(&summary).expect("Failed to serialize");
        assert!(json.contains("\"actionItems\""));
        assert!(json.contains("\"keyPoints\""));
        assert!(json.contains("\"tldr\":\"進捗共有と課題整理を行った会議。\""));

        let parsed: StructuredSummary = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(parsed, summary);
    }

    #[test]
    fn structured_summary_roundtrips_empty() {
        let summary = StructuredSummary {
            headline: String::new(),
            tldr: String::new(),
            keywords: Vec::new(),
            action_items: Vec::new(),
            key_points: Vec::new(),
        };

        let json = serde_json::to_string(&summary).expect("Failed to serialize");
        let parsed: StructuredSummary = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(parsed, summary);
    }

    #[test]
    fn action_item_omits_none_due() {
        let item = ActionItem {
            what: "後で確認".to_string(),
            due: None,
        };

        let json = serde_json::to_string(&item).expect("Failed to serialize");
        assert!(!json.contains("\"due\""));
        assert!(json.contains("\"what\":\"後で確認\""));
    }

    #[test]
    fn action_item_accepts_missing_due() {
        let parsed: ActionItem =
            serde_json::from_str(r#"{"what":"フォローアップ"}"#).expect("Failed to deserialize");
        assert_eq!(parsed.what, "フォローアップ");
        assert_eq!(parsed.due, None);
    }
}
