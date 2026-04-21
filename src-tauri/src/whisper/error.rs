/// Errors that can occur during whisper operations.
#[derive(Debug, thiserror::Error)]
pub enum WhisperError {
    /// The specified model was not found.
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    /// The model download failed.
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    /// An I/O error occurred.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// An HTTP error occurred.
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// The specified file was not found.
    #[error("File not found: {0}")]
    FileNotFound(String),

    /// A file read error occurred.
    #[error("File read error: {0}")]
    FileReadError(String),

    /// The audio format is not supported.
    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    /// The model could not be loaded.
    #[error("Model load error: {0}")]
    ModelLoadError(String),

    /// A transcription error occurred.
    #[error("Transcription error: {0}")]
    TranscriptionError(String),

    /// The transcription was cancelled.
    #[error("Transcription cancelled")]
    Cancelled,
}

impl From<WhisperError> for String {
    fn from(err: WhisperError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_file_not_found() {
        let err = WhisperError::FileNotFound("/path/to/file.wav".to_string());
        assert_eq!(err.to_string(), "File not found: /path/to/file.wav");
    }

    #[test]
    fn error_display_file_read_error() {
        let err = WhisperError::FileReadError("corrupt data".to_string());
        assert_eq!(err.to_string(), "File read error: corrupt data");
    }

    #[test]
    fn error_display_unsupported_format() {
        let err = WhisperError::UnsupportedFormat("mp3".to_string());
        assert_eq!(err.to_string(), "Unsupported format: mp3");
    }

    #[test]
    fn error_display_model_not_found() {
        let err = WhisperError::ModelNotFound("nonexistent".to_string());
        assert_eq!(err.to_string(), "Model not found: nonexistent");
    }

    #[test]
    fn error_display_model_load_error() {
        let err = WhisperError::ModelLoadError("invalid format".to_string());
        assert_eq!(err.to_string(), "Model load error: invalid format");
    }

    #[test]
    fn error_display_transcription_error() {
        let err = WhisperError::TranscriptionError("decode failed".to_string());
        assert_eq!(err.to_string(), "Transcription error: decode failed");
    }

    #[test]
    fn error_display_cancelled() {
        let err = WhisperError::Cancelled;
        assert_eq!(err.to_string(), "Transcription cancelled");
    }

    #[test]
    fn error_display_download_failed() {
        let err = WhisperError::DownloadFailed("timeout".to_string());
        assert_eq!(err.to_string(), "Download failed: timeout");
    }

    #[test]
    fn error_converts_to_string() {
        let err = WhisperError::Cancelled;
        let s: String = err.into();
        assert_eq!(s, "Transcription cancelled");
    }
}
