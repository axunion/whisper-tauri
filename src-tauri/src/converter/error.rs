use crate::ipc_error::{ErrorCode, IpcError};

/// Errors that can occur during audio conversion operations.
#[derive(Debug, thiserror::Error)]
pub enum ConverterError {
    /// `FFmpeg` was not found on the system or in the bundled location.
    #[error("FFmpeg not found: {0}")]
    FfmpegNotFound(String),

    /// The audio conversion failed.
    #[error("Conversion failed: {0}")]
    ConversionFailed(String),

    /// The file format is not supported.
    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),

    /// The input path does not point at an existing regular file.
    #[error("File not found: {0}")]
    FileNotFound(String),

    /// The `FFmpeg` download failed.
    #[error("Download failed: {0}")]
    DownloadFailed(String),

    /// An I/O error occurred.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// An HTTP error occurred.
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

impl From<crate::download::DownloadError> for ConverterError {
    fn from(err: crate::download::DownloadError) -> Self {
        Self::DownloadFailed(err.to_string())
    }
}

impl From<ConverterError> for IpcError {
    fn from(err: ConverterError) -> Self {
        let code = match &err {
            ConverterError::FfmpegNotFound(_) | ConverterError::FileNotFound(_) => {
                ErrorCode::FileNotFound
            }
            ConverterError::ConversionFailed(_) => ErrorCode::TranscriptionError,
            ConverterError::UnsupportedFormat(_) => ErrorCode::UnsupportedFormat,
            ConverterError::DownloadFailed(_) => ErrorCode::ModelDownloadError,
            ConverterError::Io(_) => ErrorCode::FileReadError,
            ConverterError::Http(_) => ErrorCode::NetworkError,
        };
        Self::new(code, err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_ffmpeg_not_found() {
        let err = ConverterError::FfmpegNotFound("not installed".to_string());
        assert_eq!(err.to_string(), "FFmpeg not found: not installed");
    }

    #[test]
    fn error_display_conversion_failed() {
        let err = ConverterError::ConversionFailed("exit code 1".to_string());
        assert_eq!(err.to_string(), "Conversion failed: exit code 1");
    }

    #[test]
    fn error_display_unsupported_format() {
        let err = ConverterError::UnsupportedFormat("pdf".to_string());
        assert_eq!(err.to_string(), "Unsupported format: pdf");
    }

    #[test]
    fn error_display_file_not_found() {
        let err = ConverterError::FileNotFound("/nope/a.mp3".to_string());
        assert_eq!(err.to_string(), "File not found: /nope/a.mp3");
    }

    #[test]
    fn error_display_download_failed() {
        let err = ConverterError::DownloadFailed("timeout".to_string());
        assert_eq!(err.to_string(), "Download failed: timeout");
    }

    #[test]
    fn error_classifies_for_ipc() {
        let err = ConverterError::FfmpegNotFound("missing".to_string());
        assert_eq!(
            IpcError::from(err),
            IpcError::new(ErrorCode::FileNotFound, "FFmpeg not found: missing")
        );
    }
}
