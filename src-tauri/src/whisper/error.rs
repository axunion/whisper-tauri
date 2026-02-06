/// Errors that can occur during whisper model operations.
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

    /// A path resolution error occurred.
    #[error("Path error: {0}")]
    PathError(String),

    /// A store operation error occurred.
    #[error("Store error: {0}")]
    StoreError(String),
}

impl From<WhisperError> for String {
    fn from(err: WhisperError) -> Self {
        err.to_string()
    }
}
