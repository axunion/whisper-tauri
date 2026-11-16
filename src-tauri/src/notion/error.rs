use crate::ipc_error::{ErrorCode, IpcError};
use crate::settings::SettingsError;

#[derive(Debug, thiserror::Error)]
pub enum NotionError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Notion API error ({status}): {message}")]
    Api { status: u16, message: String },
    #[error("Notion is not configured")]
    NotConfigured,
    #[error("Database has no title property")]
    NoTitleProperty,
    #[error("Invalid response from Notion API")]
    InvalidResponse,
    #[error("Settings error: {0}")]
    Settings(#[from] SettingsError),
}

impl From<reqwest::Error> for NotionError {
    fn from(err: reqwest::Error) -> Self {
        NotionError::Http(err.to_string())
    }
}

impl From<NotionError> for IpcError {
    fn from(err: NotionError) -> Self {
        let code = match &err {
            NotionError::Http(_)
            | NotionError::Api { .. }
            | NotionError::NoTitleProperty
            | NotionError::InvalidResponse => ErrorCode::NetworkError,
            NotionError::NotConfigured | NotionError::Settings(_) => ErrorCode::UnknownError,
        };
        Self::new(code, err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn http_display() {
        let err = NotionError::Http("connection refused".to_string());
        assert_eq!(err.to_string(), "HTTP error: connection refused");
    }

    #[test]
    fn api_display() {
        let err = NotionError::Api {
            status: 401,
            message: "unauthorized".to_string(),
        };
        assert_eq!(err.to_string(), "Notion API error (401): unauthorized");
    }

    #[test]
    fn not_configured_display() {
        assert_eq!(
            NotionError::NotConfigured.to_string(),
            "Notion is not configured"
        );
    }

    #[test]
    fn no_title_property_display() {
        assert_eq!(
            NotionError::NoTitleProperty.to_string(),
            "Database has no title property"
        );
    }

    #[test]
    fn invalid_response_display() {
        assert_eq!(
            NotionError::InvalidResponse.to_string(),
            "Invalid response from Notion API"
        );
    }

    #[test]
    fn settings_display() {
        let err = NotionError::Settings(SettingsError::Store("locked".to_string()));
        assert_eq!(err.to_string(), "Settings error: Store error: locked");
    }

    #[test]
    fn classifies_for_ipc() {
        let err = NotionError::NotConfigured;
        assert_eq!(
            IpcError::from(err),
            IpcError::new(ErrorCode::UnknownError, "Notion is not configured")
        );
    }
}
