//! The error every command returns to the frontend.

use serde::Serialize;

/// How the frontend classifies a failure: which message it shows and whether
/// a retry is offered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    FileNotFound,
    FileReadError,
    UnsupportedFormat,
    ModelNotFound,
    ModelLoadError,
    ModelDownloadError,
    TranscriptionError,
    InferenceError,
    NetworkError,
    Cancelled,
    UnknownError,
}

/// A command failure: a code to branch on and the detail text to show.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
pub struct IpcError {
    pub code: ErrorCode,
    pub message: String,
}

impl IpcError {
    pub(crate) fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

/// Failures with no error type of their own (a poisoned lock, a failed task
/// join) carry no classification.
impl From<String> for IpcError {
    fn from(message: String) -> Self {
        Self::new(ErrorCode::UnknownError, message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_code_and_message() {
        let err = IpcError::new(ErrorCode::FileNotFound, "File not found: a.wav");
        assert_eq!(
            serde_json::to_string(&err).unwrap(),
            r#"{"code":"FILE_NOT_FOUND","message":"File not found: a.wav"}"#
        );
    }

    #[test]
    fn a_bare_message_is_unclassified() {
        let err = IpcError::from("Lock error: poisoned".to_string());
        assert_eq!(err.code, ErrorCode::UnknownError);
        assert_eq!(err.message, "Lock error: poisoned");
    }
}
