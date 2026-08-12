use serde::{Deserialize, Serialize};

/// Result of an audio file conversion.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConversionResult {
    /// Path to the converted WAV file
    pub output_path: String,
    /// Original file path
    pub original_path: String,
}

/// `FFmpeg` download progress event payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegDownloadProgress {
    /// Downloaded bytes
    pub downloaded_bytes: u64,
    /// Total bytes
    pub total_bytes: u64,
    /// Progress percentage (0-100)
    pub progress: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversion_result_serializes_to_camel_case() {
        let result = ConversionResult {
            output_path: "/tmp/output.wav".to_string(),
            original_path: "/path/to/input.mp3".to_string(),
        };

        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("\"outputPath\":\"/tmp/output.wav\""));
        assert!(json.contains("\"originalPath\":\"/path/to/input.mp3\""));
    }

    #[test]
    fn ffmpeg_download_progress_serializes_to_camel_case() {
        let progress = FfmpegDownloadProgress {
            downloaded_bytes: 50_000_000,
            total_bytes: 100_000_000,
            progress: 50.0,
        };

        let json = serde_json::to_string(&progress).expect("Failed to serialize");
        assert!(json.contains("\"downloadedBytes\":50000000"));
        assert!(json.contains("\"totalBytes\":100000000"));
        assert!(json.contains("\"progress\":50.0"));
    }
}
