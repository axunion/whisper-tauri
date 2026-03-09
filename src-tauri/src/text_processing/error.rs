/// Errors that can occur during text processing operations.
#[derive(Debug, thiserror::Error)]
pub enum TextProcessingError {
    /// The specified model was not found.
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    /// The model download failed.
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    /// The server failed to start.
    #[error("Server start failed: {0}")]
    ServerStartFailed(String),

    /// The server is not running.
    #[error("Server not running")]
    ServerNotRunning,

    /// An inference error occurred.
    #[error("Inference error: {0}")]
    InferenceError(String),

    /// The operation was cancelled.
    #[error("Inference cancelled")]
    Cancelled,

    /// An I/O error occurred.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// An HTTP error occurred.
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// A path resolution error occurred.
    #[error("Path error: {0}")]
    PathError(String),

    /// A store operation error occurred.
    #[error("Store error: {0}")]
    StoreError(String),

    /// A JSON parsing error occurred.
    #[error("JSON error: {0}")]
    JsonError(String),
}

impl From<TextProcessingError> for String {
    fn from(err: TextProcessingError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_model_not_found() {
        let err = TextProcessingError::ModelNotFound("nonexistent".to_string());
        assert_eq!(err.to_string(), "Model not found: nonexistent");
    }

    #[test]
    fn error_display_download_failed() {
        let err = TextProcessingError::DownloadFailed("timeout".to_string());
        assert_eq!(err.to_string(), "Download failed: timeout");
    }

    #[test]
    fn error_display_server_start_failed() {
        let err = TextProcessingError::ServerStartFailed("port in use".to_string());
        assert_eq!(err.to_string(), "Server start failed: port in use");
    }

    #[test]
    fn error_display_server_not_running() {
        let err = TextProcessingError::ServerNotRunning;
        assert_eq!(err.to_string(), "Server not running");
    }

    #[test]
    fn error_display_inference_error() {
        let err = TextProcessingError::InferenceError("decode failed".to_string());
        assert_eq!(err.to_string(), "Inference error: decode failed");
    }

    #[test]
    fn error_display_cancelled() {
        let err = TextProcessingError::Cancelled;
        assert_eq!(err.to_string(), "Inference cancelled");
    }

    #[test]
    fn error_display_path_error() {
        let err = TextProcessingError::PathError("invalid".to_string());
        assert_eq!(err.to_string(), "Path error: invalid");
    }

    #[test]
    fn error_display_store_error() {
        let err = TextProcessingError::StoreError("access denied".to_string());
        assert_eq!(err.to_string(), "Store error: access denied");
    }

    #[test]
    fn error_display_json_error() {
        let err = TextProcessingError::JsonError("parse failed".to_string());
        assert_eq!(err.to_string(), "JSON error: parse failed");
    }

    #[test]
    fn error_converts_to_string() {
        let err = TextProcessingError::Cancelled;
        let s: String = err.into();
        assert_eq!(s, "Inference cancelled");
    }
}
