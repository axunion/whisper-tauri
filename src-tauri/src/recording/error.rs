/// Errors that can occur during audio recording operations.
#[derive(Debug, thiserror::Error)]
pub enum RecordingError {
    /// The specified audio device was not found.
    #[error("Device not found: {0}")]
    DeviceNotFound(String),

    /// A device-related error occurred.
    #[error("Device error: {0}")]
    DeviceError(String),

    /// A recording is already in progress.
    #[error("Already recording")]
    AlreadyRecording,

    /// No recording is currently in progress.
    #[error("Not recording")]
    NotRecording,

    /// An I/O error occurred.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// A WAV encoding error occurred.
    #[error("WAV error: {0}")]
    WavError(String),
}

impl From<RecordingError> for String {
    fn from(err: RecordingError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_display_device_not_found() {
        let err = RecordingError::DeviceNotFound("USB Mic".to_string());
        assert_eq!(err.to_string(), "Device not found: USB Mic");
    }

    #[test]
    fn error_display_device_error() {
        let err = RecordingError::DeviceError("stream failed".to_string());
        assert_eq!(err.to_string(), "Device error: stream failed");
    }

    #[test]
    fn error_display_already_recording() {
        let err = RecordingError::AlreadyRecording;
        assert_eq!(err.to_string(), "Already recording");
    }

    #[test]
    fn error_display_not_recording() {
        let err = RecordingError::NotRecording;
        assert_eq!(err.to_string(), "Not recording");
    }

    #[test]
    fn error_display_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let err = RecordingError::Io(io_err);
        assert_eq!(err.to_string(), "IO error: file missing");
    }

    #[test]
    fn error_display_wav_error() {
        let err = RecordingError::WavError("invalid header".to_string());
        assert_eq!(err.to_string(), "WAV error: invalid header");
    }

    #[test]
    fn error_converts_to_string() {
        let err = RecordingError::AlreadyRecording;
        let s: String = err.into();
        assert_eq!(s, "Already recording");
    }

    #[test]
    fn error_converts_io_to_string() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let err = RecordingError::Io(io_err);
        let s: String = err.into();
        assert_eq!(s, "IO error: access denied");
    }
}
