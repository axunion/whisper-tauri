use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

/// Errors that can occur during path resolution.
#[derive(Debug, thiserror::Error)]
pub enum PathError {
    /// The app data directory could not be resolved.
    #[error("Path error: {0}")]
    Resolve(String),

    /// A path could not be converted to a UTF-8 string.
    #[error("Path error: Invalid path encoding")]
    InvalidEncoding,
}

impl From<PathError> for String {
    fn from(err: PathError) -> Self {
        err.to_string()
    }
}

/// Resolves the app data directory from a Tauri `AppHandle`.
///
/// # Errors
///
/// Returns [`PathError::Resolve`] if the app data directory cannot be resolved.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, PathError> {
    app.path()
        .app_data_dir()
        .map_err(|e| PathError::Resolve(e.to_string()))
}

/// Converts a [`Path`] to an owned `String`.
///
/// # Errors
///
/// Returns [`PathError::InvalidEncoding`] if the path is not valid UTF-8.
pub fn path_to_owned_string(path: &Path) -> Result<String, PathError> {
    path.to_str()
        .map(std::string::ToString::to_string)
        .ok_or(PathError::InvalidEncoding)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_error_resolve_display() {
        let err = PathError::Resolve("not found".to_string());
        assert_eq!(err.to_string(), "Path error: not found");
    }

    #[test]
    fn path_error_invalid_encoding_display() {
        let err = PathError::InvalidEncoding;
        assert_eq!(err.to_string(), "Path error: Invalid path encoding");
    }

    #[test]
    fn path_error_converts_to_string() {
        let err = PathError::Resolve("missing".to_string());
        let s: String = err.into();
        assert_eq!(s, "Path error: missing");
    }

    #[test]
    fn path_to_owned_string_roundtrip() {
        let path = Path::new("/tmp/example.txt");
        let s = path_to_owned_string(path).expect("valid utf-8");
        assert_eq!(s, "/tmp/example.txt");
    }
}
