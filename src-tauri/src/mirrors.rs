//! Download-source overrides for internal mirrors.
//!
//! Deliberately kept out of the `tauri-plugin-store` `settings.json`: the
//! webview holds `store:default`, which includes `allow-set` / `allow-save`, so
//! every key in that file is frontend-writable. These keys decide which archive
//! the app downloads — and for `llama-server` / `ffmpeg`, later makes executable
//! and runs — so they live in a plain file that no plugin permission exposes.
//! Populated by hand-editing `mirrors.json`, never from the UI.

use std::path::Path;

/// Filename of the mirror-override file inside the app data directory.
const MIRRORS_FILE: &str = "mirrors.json";

/// Override key for the Whisper model download base URL.
pub const WHISPER_MODEL_BASE_URL: &str = "modelDownloadBaseUrl";

/// Override key for the text (GGUF) model download base URL.
pub const TEXT_MODEL_BASE_URL: &str = "textModelDownloadBaseUrl";

/// Override key for the llama-server archive URL.
pub const TEXT_SERVER_URL: &str = "textServerDownloadUrl";

/// Override key for the ffmpeg archive URL.
pub const FFMPEG_URL: &str = "ffmpegDownloadUrl";

/// Reads a mirror override, returning `None` when the file, the key, or a
/// string value is absent.
///
/// A malformed file falls back to the pinned default URL rather than failing
/// the download: this is a hand-edited escape hatch, and a typo should not
/// leave the app unable to fetch anything. The fallback is logged so the
/// mistake is not silent.
#[must_use]
pub fn get(app_data_dir: &Path, key: &str) -> Option<String> {
    let path = app_data_dir.join(MIRRORS_FILE);
    let raw = std::fs::read_to_string(&path).ok()?;

    let value = match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(value) => value,
        Err(e) => {
            eprintln!("Warning: ignoring {} (not valid JSON: {e})", path.display());
            return None;
        }
    };

    value
        .get(key)?
        .as_str()
        .map(std::string::ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_mirrors(dir: &Path, contents: &str) {
        std::fs::write(dir.join(MIRRORS_FILE), contents).expect("write mirrors.json");
    }

    #[test]
    fn get_returns_none_when_file_missing() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        assert_eq!(get(dir.path(), FFMPEG_URL), None);
    }

    #[test]
    fn get_returns_configured_string() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        write_mirrors(
            dir.path(),
            r#"{"ffmpegDownloadUrl":"https://mirror.example.com/ffmpeg.zip"}"#,
        );
        assert_eq!(
            get(dir.path(), FFMPEG_URL),
            Some("https://mirror.example.com/ffmpeg.zip".to_string())
        );
    }

    #[test]
    fn get_returns_none_for_absent_key() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        write_mirrors(dir.path(), r#"{"ffmpegDownloadUrl":"https://a/b.zip"}"#);
        assert_eq!(get(dir.path(), TEXT_SERVER_URL), None);
    }

    #[test]
    fn get_returns_none_for_non_string_value() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        write_mirrors(dir.path(), r#"{"ffmpegDownloadUrl":42}"#);
        assert_eq!(get(dir.path(), FFMPEG_URL), None);
    }

    #[test]
    fn get_returns_none_for_malformed_json() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        write_mirrors(dir.path(), "{not json");
        assert_eq!(get(dir.path(), FFMPEG_URL), None);
    }

    #[test]
    fn override_keys_match_the_legacy_settings_key_names() {
        // Keys keep their `settings.json` names so an existing hand-edited
        // override can be moved to `mirrors.json` verbatim.
        assert_eq!(WHISPER_MODEL_BASE_URL, "modelDownloadBaseUrl");
        assert_eq!(TEXT_MODEL_BASE_URL, "textModelDownloadBaseUrl");
        assert_eq!(TEXT_SERVER_URL, "textServerDownloadUrl");
        assert_eq!(FFMPEG_URL, "ffmpegDownloadUrl");
    }
}
