use serde::{Deserialize, Serialize};

/// A segment of transcribed text with timing information (for history storage).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistorySegment {
    /// Start time in milliseconds
    pub start: u64,
    /// End time in milliseconds
    pub end: u64,
    /// Transcribed text
    pub text: String,
}

/// Metadata for a history entry (used in list views, without full text/segments).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMeta {
    /// Unique identifier
    pub id: String,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
    /// Original file name
    pub file_name: String,
    /// Detected language code
    pub language: String,
    /// Model used for transcription
    pub model_id: String,
    /// Total duration in milliseconds
    pub duration: u64,
    /// Preview of the transcribed text
    pub text_preview: String,
}

/// Full history entry including text and segments.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    /// Unique identifier
    pub id: String,
    /// Creation timestamp (ISO 8601)
    pub created_at: String,
    /// Original file name
    pub file_name: String,
    /// Detected language code
    pub language: String,
    /// Model used for transcription
    pub model_id: String,
    /// Total duration in milliseconds
    pub duration: u64,
    /// Full transcribed text
    pub text: String,
    /// Segments with timing information
    pub segments: Vec<HistorySegment>,
}

/// Parameters for saving a new history entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistorySaveParams {
    /// Original file name
    pub file_name: String,
    /// Detected language code
    pub language: String,
    /// Model used for transcription
    pub model_id: String,
    /// Total duration in milliseconds
    pub duration: u64,
    /// Full transcribed text
    pub text: String,
    /// Segments with timing information
    pub segments: Vec<HistorySegment>,
}

/// Filter for listing history entries.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFilter {
    /// Start date (ISO 8601 date string, e.g. "2026-01-01")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_from: Option<String>,
    /// End date (ISO 8601 date string, e.g. "2026-12-31")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_to: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_segment_serializes_to_camel_case() {
        let segment = HistorySegment {
            start: 0,
            end: 5000,
            text: "Hello".to_string(),
        };
        let json = serde_json::to_string(&segment).expect("Failed to serialize");
        assert!(json.contains("\"start\":0"));
        assert!(json.contains("\"end\":5000"));
        assert!(json.contains("\"text\":\"Hello\""));
    }

    #[test]
    fn history_meta_serializes_to_camel_case() {
        let meta = HistoryMeta {
            id: "abc-123".to_string(),
            created_at: "2026-01-15T10:30:00Z".to_string(),
            file_name: "audio.wav".to_string(),
            language: "ja".to_string(),
            model_id: "large-v3-turbo".to_string(),
            duration: 60000,
            text_preview: "Hello world...".to_string(),
        };
        let json = serde_json::to_string(&meta).expect("Failed to serialize");
        assert!(json.contains("\"createdAt\":\"2026-01-15T10:30:00Z\""));
        assert!(json.contains("\"fileName\":\"audio.wav\""));
        assert!(json.contains("\"modelId\":\"large-v3-turbo\""));
        assert!(json.contains("\"textPreview\":\"Hello world...\""));
    }

    #[test]
    fn history_entry_serializes_with_segments() {
        let entry = HistoryEntry {
            id: "abc-123".to_string(),
            created_at: "2026-01-15T10:30:00Z".to_string(),
            file_name: "audio.wav".to_string(),
            language: "ja".to_string(),
            model_id: "large-v3-turbo".to_string(),
            duration: 60000,
            text: "Hello world".to_string(),
            segments: vec![HistorySegment {
                start: 0,
                end: 2000,
                text: "Hello world".to_string(),
            }],
        };
        let json = serde_json::to_string(&entry).expect("Failed to serialize");
        assert!(json.contains("\"segments\":["));
        assert!(json.contains("\"text\":\"Hello world\""));
    }

    #[test]
    fn history_save_params_serializes_to_camel_case() {
        let params = HistorySaveParams {
            file_name: "test.wav".to_string(),
            language: "en".to_string(),
            model_id: "small".to_string(),
            duration: 30000,
            text: "Test text".to_string(),
            segments: vec![],
        };
        let json = serde_json::to_string(&params).expect("Failed to serialize");
        assert!(json.contains("\"fileName\":\"test.wav\""));
        assert!(json.contains("\"modelId\":\"small\""));
    }

    #[test]
    fn history_filter_skips_none_fields() {
        let filter = HistoryFilter::default();
        let json = serde_json::to_string(&filter).expect("Failed to serialize");
        assert!(!json.contains("dateFrom"));
        assert!(!json.contains("dateTo"));
    }
}
