use serde::{Deserialize, Serialize};

/// Whisper model information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    /// Model identifier (e.g., "small", "medium", "large-v3-turbo")
    pub id: String,
    /// Display name
    pub name: String,
    /// Human-readable size (e.g., "142MB")
    pub size: String,
    /// Size in bytes
    pub size_bytes: u64,
    /// Model description
    pub description: String,
    /// Whether the model is downloaded
    pub downloaded: bool,
    /// Whether the model is bundled with the app
    pub bundled: bool,
    /// Whether the model is recommended for this system
    pub recommended: bool,
    /// Estimated processing speed for this hardware
    pub speed_note: String,
    /// Path to the model file (if downloaded)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// A segment of transcribed text with timing information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    /// Start time in milliseconds
    pub start: u64,
    /// End time in milliseconds
    pub end: u64,
    /// Transcribed text
    pub text: String,
}

/// Transcription result with full text and segments.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    /// Task identifier
    pub task_id: String,
    /// Full transcribed text
    pub text: String,
    /// Segments with timing information
    pub segments: Vec<TranscriptionSegment>,
    /// Detected language code
    pub language: String,
    /// Total duration in milliseconds
    pub duration: u64,
}

/// Transcription progress update.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionProgress {
    /// Task identifier
    pub task_id: String,
    /// Progress percentage (0-100)
    pub progress: f64,
    /// Elapsed time in milliseconds
    pub elapsed_ms: u64,
    /// Current segment being processed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_segment: Option<String>,
}

/// Model download progress.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    /// Model identifier being downloaded
    pub model_id: String,
    /// Downloaded bytes
    pub downloaded_bytes: u64,
    /// Total bytes
    pub total_bytes: u64,
    /// Progress percentage (0-100)
    pub progress: f64,
}

/// Audio file information.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    /// Full file path
    pub path: String,
    /// File name
    pub name: String,
    /// File size in bytes
    pub size: u64,
    /// Duration in milliseconds (if known)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_info_serializes_to_camel_case() {
        let model = ModelInfo {
            id: "base".to_string(),
            name: "Base".to_string(),
            size: "142MB".to_string(),
            size_bytes: 148_897_792,
            description: "Base model".to_string(),
            downloaded: true,
            bundled: false,
            recommended: false,
            speed_note: "~5-15s/min".to_string(),
            path: Some("/path/to/model.bin".to_string()),
        };

        let json = serde_json::to_string(&model).expect("Failed to serialize");
        assert!(json.contains("\"sizeBytes\":148897792"));
        assert!(json.contains("\"speedNote\":\"~5-15s/min\""));
        assert!(json.contains("\"path\":\"/path/to/model.bin\""));
    }

    #[test]
    fn model_info_skips_none_path() {
        let model = ModelInfo {
            id: "base".to_string(),
            name: "Base".to_string(),
            size: "142MB".to_string(),
            size_bytes: 148_897_792,
            description: "Base model".to_string(),
            downloaded: false,
            bundled: false,
            recommended: false,
            speed_note: String::new(),
            path: None,
        };

        let json = serde_json::to_string(&model).expect("Failed to serialize");
        assert!(!json.contains("\"path\""));
    }

    #[test]
    fn transcription_segment_serializes_correctly() {
        let segment = TranscriptionSegment {
            start: 0,
            end: 5000,
            text: "Hello, world!".to_string(),
        };

        let json = serde_json::to_string(&segment).expect("Failed to serialize");
        assert!(json.contains("\"start\":0"));
        assert!(json.contains("\"end\":5000"));
        assert!(json.contains("\"text\":\"Hello, world!\""));
    }

    #[test]
    fn transcription_result_serializes_with_segments() {
        let result = TranscriptionResult {
            task_id: "task-123".to_string(),
            text: "Hello, world!".to_string(),
            segments: vec![TranscriptionSegment {
                start: 0,
                end: 2000,
                text: "Hello, world!".to_string(),
            }],
            language: "en".to_string(),
            duration: 2000,
        };

        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("\"taskId\":\"task-123\""));
        assert!(json.contains("\"segments\":["));
    }

    #[test]
    fn transcription_progress_skips_none_current_segment() {
        let progress = TranscriptionProgress {
            task_id: "task-123".to_string(),
            progress: 50.0,
            elapsed_ms: 1500,
            current_segment: None,
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"taskId\":\"task-123\""));
        assert!(json.contains("\"elapsedMs\":1500"));
        assert!(!json.contains("\"currentSegment\""));
    }

    #[test]
    fn transcription_progress_includes_current_segment_when_present() {
        let progress = TranscriptionProgress {
            task_id: "task-123".to_string(),
            progress: 75.0,
            elapsed_ms: 2000,
            current_segment: Some("Processing...".to_string()),
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"currentSegment\":\"Processing...\""));
    }

    #[test]
    fn download_progress_serializes_correctly() {
        let progress = DownloadProgress {
            model_id: "base".to_string(),
            downloaded_bytes: 50_000_000,
            total_bytes: 148_897_792,
            progress: 33.6,
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"modelId\":\"base\""));
        assert!(json.contains("\"downloadedBytes\":50000000"));
        assert!(json.contains("\"totalBytes\":148897792"));
    }

    #[test]
    fn file_info_skips_none_duration() {
        let file = FileInfo {
            path: "/path/to/audio.wav".to_string(),
            name: "audio.wav".to_string(),
            size: 1_024_000,
            duration: None,
        };

        let json = serde_json::to_string(&file).expect("Failed to serialize");
        assert!(!json.contains("\"duration\""));
    }

    #[test]
    fn file_info_includes_duration_when_present() {
        let file = FileInfo {
            path: "/path/to/audio.wav".to_string(),
            name: "audio.wav".to_string(),
            size: 1_024_000,
            duration: Some(60_000),
        };

        let json = serde_json::to_string(&file).expect("Failed to serialize");
        assert!(json.contains("\"duration\":60000"));
    }
}
