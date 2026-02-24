/// Errors that can occur during history operations.
#[derive(Debug, thiserror::Error)]
pub enum HistoryError {
    /// A database operation failed.
    #[error("Database error: {0}")]
    Database(String),

    /// A compression or decompression operation failed.
    #[error("Compression error: {0}")]
    Compression(String),

    /// The requested history entry was not found.
    #[error("History not found: {0}")]
    NotFound(String),

    /// An I/O error occurred.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// A path resolution error occurred.
    #[error("Path error: {0}")]
    PathError(String),

    /// A serialization or deserialization error occurred.
    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl From<HistoryError> for String {
    fn from(err: HistoryError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_database() {
        let err = HistoryError::Database("table locked".to_string());
        assert_eq!(err.to_string(), "Database error: table locked");
    }

    #[test]
    fn error_display_compression() {
        let err = HistoryError::Compression("invalid gzip data".to_string());
        assert_eq!(err.to_string(), "Compression error: invalid gzip data");
    }

    #[test]
    fn error_display_not_found() {
        let err = HistoryError::NotFound("abc-123".to_string());
        assert_eq!(err.to_string(), "History not found: abc-123");
    }

    #[test]
    fn error_display_path_error() {
        let err = HistoryError::PathError("invalid path".to_string());
        assert_eq!(err.to_string(), "Path error: invalid path");
    }

    #[test]
    fn error_display_serialization() {
        let err = HistoryError::Serialization("invalid JSON".to_string());
        assert_eq!(err.to_string(), "Serialization error: invalid JSON");
    }

    #[test]
    fn error_converts_to_string() {
        let err = HistoryError::Database("connection failed".to_string());
        let s: String = err.into();
        assert_eq!(s, "Database error: connection failed");
    }
}
