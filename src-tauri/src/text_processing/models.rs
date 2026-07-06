use std::path::{Path, PathBuf};

use super::types::TextModelInfo;

/// Pinned llama-server release version (verified to work).
const LLAMA_SERVER_VERSION: &str = "b8672";

/// Valid text model IDs.
const VALID_MODEL_IDS: [&str; 2] = ["gemma-4-e2b", "qwen3.5-4b"];

/// Model filenames (GGUF `Q4_K_M` quantization).
fn get_model_filename(model_id: &str) -> Option<&'static str> {
    match model_id {
        "gemma-4-e2b" => Some("google_gemma-4-E2B-it-Q4_K_M.gguf"),
        "qwen3.5-4b" => Some("Qwen3.5-4B-Q4_K_M.gguf"),
        _ => None,
    }
}

/// Default download base URLs for each model.
fn get_default_model_base_url(model_id: &str) -> Option<&'static str> {
    match model_id {
        "gemma-4-e2b" => {
            Some("https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF/resolve/main")
        }
        "qwen3.5-4b" => Some("https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main"),
        _ => None,
    }
}

/// Returns whether the given model ID is valid.
#[must_use]
pub(crate) fn is_valid_model_id(model_id: &str) -> bool {
    VALID_MODEL_IDS.contains(&model_id)
}

/// Returns the filename for a valid text model ID, if any.
#[must_use]
pub(crate) fn known_model_filename(model_id: &str) -> Option<&'static str> {
    get_model_filename(model_id)
}

/// Returns the on-disk path for a valid text model ID.
#[must_use]
pub(crate) fn known_model_path(app_data_dir: &Path, model_id: &str) -> Option<PathBuf> {
    let filename = known_model_filename(model_id)?;
    Some(text_models_dir(app_data_dir).join(filename))
}

/// Returns the download URL for a given model ID and optional custom base URL.
#[must_use]
pub(crate) fn get_model_url(model_id: &str, custom_base_url: Option<&str>) -> Option<String> {
    let filename = get_model_filename(model_id)?;
    let base = custom_base_url.or_else(|| get_default_model_base_url(model_id))?;
    let base = base.trim_end_matches('/');
    Some(format!("{base}/{filename}"))
}

/// Returns the text models directory under the app data directory.
#[must_use]
pub(crate) fn text_models_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("text-models")
}

/// Returns the path to a specific text model file.
#[must_use]
pub(crate) fn text_model_path(app_data_dir: &Path, model_id: &str) -> Option<PathBuf> {
    let filename = get_model_filename(model_id)?;
    Some(text_models_dir(app_data_dir).join(filename))
}

/// Returns the path to the llama-server version marker file.
#[must_use]
pub(crate) fn llama_server_version_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("bin").join("llama-server.version")
}

/// Writes the current pinned version to the version marker file.
///
/// # Errors
///
/// Returns an error if the version file cannot be written.
pub(crate) fn write_server_version(app_data_dir: &Path) -> Result<(), std::io::Error> {
    std::fs::write(
        llama_server_version_path(app_data_dir),
        LLAMA_SERVER_VERSION,
    )
}

/// Deletes the version marker file (best-effort, ignores errors).
pub(crate) fn delete_server_version(app_data_dir: &Path) {
    let _ = std::fs::remove_file(llama_server_version_path(app_data_dir));
}

/// Returns `true` if the version marker matches the pinned version.
#[must_use]
pub(crate) fn is_server_version_current(app_data_dir: &Path) -> bool {
    std::fs::read_to_string(llama_server_version_path(app_data_dir))
        .is_ok_and(|v| v.trim() == LLAMA_SERVER_VERSION)
}

/// Returns the path where the llama-server binary will be stored.
#[must_use]
pub(crate) fn llama_server_path(app_data_dir: &Path) -> PathBuf {
    let binary_name = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };
    app_data_dir.join("bin").join(binary_name)
}

/// Returns the default llama-server download URL for the current platform.
#[must_use]
pub(crate) fn get_default_server_url() -> &'static str {
    use std::sync::OnceLock;

    static URL: OnceLock<String> = OnceLock::new();
    let version = LLAMA_SERVER_VERSION;

    URL.get_or_init(|| {
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            format!(
                "https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-macos-arm64.tar.gz"
            )
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            format!(
                "https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-macos-x64.tar.gz"
            )
        }
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            format!(
                "https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-win-cpu-x64.zip"
            )
        }
        #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
        {
            format!(
                "https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-win-cpu-arm64.zip"
            )
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            format!(
                "https://github.com/ggml-org/llama.cpp/releases/download/{version}/llama-{version}-bin-ubuntu-x64.tar.gz"
            )
        }
        #[cfg(not(any(
            all(target_os = "macos", target_arch = "aarch64"),
            all(target_os = "macos", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "x86_64"),
            all(target_os = "windows", target_arch = "aarch64"),
            all(target_os = "linux", target_arch = "x86_64"),
        )))]
        {
            compile_error!("Unsupported platform: no default llama-server download URL available");
        }
    })
}

/// Returns the list of available text models.
///
/// All models have `downloaded` set to `false` by default.
#[must_use]
pub(crate) fn get_model_list() -> Vec<TextModelInfo> {
    vec![
        TextModelInfo {
            id: "gemma-4-e2b".to_string(),
            name: "Gemma 4 E2B".to_string(),
            size: "3.5GB".to_string(),
            size_bytes: 3_460_000_000,
            description: "Google Gemma 4. Apache 2.0, 128K context, CJK optimized".to_string(),
            downloaded: false,
            path: None,
        },
        TextModelInfo {
            id: "qwen3.5-4b".to_string(),
            name: "Qwen3.5 4B".to_string(),
            size: "2.7GB".to_string(),
            size_bytes: 2_900_000_000,
            description: "Alibaba Qwen3.5. 201 languages, excellent Japanese benchmarks"
                .to_string(),
            downloaded: false,
            path: None,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_list_returns_two_models() {
        let models = get_model_list();
        assert_eq!(models.len(), 2);
    }

    #[test]
    fn model_list_contains_expected_ids() {
        let models = get_model_list();
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"gemma-4-e2b"));
        assert!(ids.contains(&"qwen3.5-4b"));
    }

    #[test]
    fn model_list_alphabetical_order() {
        let models = get_model_list();
        assert_eq!(models[0].id, "gemma-4-e2b");
        assert_eq!(models[1].id, "qwen3.5-4b");
    }

    #[test]
    fn model_list_all_not_downloaded() {
        let models = get_model_list();
        for model in &models {
            assert!(!model.downloaded);
            assert!(model.path.is_none());
        }
    }

    #[test]
    fn is_valid_model_id_accepts_known() {
        assert!(is_valid_model_id("gemma-4-e2b"));
        assert!(is_valid_model_id("qwen3.5-4b"));
    }

    #[test]
    fn is_valid_model_id_rejects_unknown() {
        assert!(!is_valid_model_id("llama-3"));
        assert!(!is_valid_model_id(""));
    }

    #[test]
    fn known_model_filename_returns_for_valid() {
        assert_eq!(
            known_model_filename("qwen3.5-4b"),
            Some("Qwen3.5-4B-Q4_K_M.gguf")
        );
    }

    #[test]
    fn known_model_filename_returns_none_for_unknown() {
        assert!(known_model_filename("unknown").is_none());
    }

    #[test]
    fn known_model_path_returns_for_valid() {
        let path = known_model_path(Path::new("/app-data"), "qwen3.5-4b");
        assert_eq!(
            path,
            Some(PathBuf::from(
                "/app-data/text-models/Qwen3.5-4B-Q4_K_M.gguf"
            ))
        );
    }

    #[test]
    fn known_model_path_returns_none_for_unknown() {
        assert!(known_model_path(Path::new("/app-data"), "unknown").is_none());
    }

    #[test]
    fn get_model_filename_known_models() {
        assert_eq!(
            get_model_filename("gemma-4-e2b"),
            Some("google_gemma-4-E2B-it-Q4_K_M.gguf")
        );
        assert_eq!(
            get_model_filename("qwen3.5-4b"),
            Some("Qwen3.5-4B-Q4_K_M.gguf")
        );
    }

    #[test]
    fn get_model_filename_unknown_returns_none() {
        assert_eq!(get_model_filename("unknown"), None);
    }

    #[test]
    fn get_model_url_with_default() {
        let url = get_model_url("qwen3.5-4b", None);
        assert!(url.is_some());
        let url = url.expect("should have URL");
        assert!(url.contains("huggingface.co"));
        assert!(url.contains("Qwen3.5-4B-Q4_K_M.gguf"));
    }

    #[test]
    fn get_model_url_with_custom_base() {
        let url = get_model_url("gemma-4-e2b", Some("https://example.com/models"));
        assert_eq!(
            url,
            Some("https://example.com/models/google_gemma-4-E2B-it-Q4_K_M.gguf".to_string())
        );
    }

    #[test]
    fn get_model_url_strips_trailing_slash() {
        let url = get_model_url("gemma-4-e2b", Some("https://example.com/models/"));
        assert_eq!(
            url,
            Some("https://example.com/models/google_gemma-4-E2B-it-Q4_K_M.gguf".to_string())
        );
    }

    #[test]
    fn get_model_url_unknown_returns_none() {
        let url = get_model_url("unknown", None);
        assert!(url.is_none());
    }

    #[test]
    fn text_models_dir_returns_correct_path() {
        let dir = text_models_dir(Path::new("/app-data"));
        assert_eq!(dir, PathBuf::from("/app-data/text-models"));
    }

    #[test]
    fn text_model_path_returns_correct_path() {
        let path = text_model_path(Path::new("/app-data"), "qwen3.5-4b");
        assert_eq!(
            path,
            Some(PathBuf::from(
                "/app-data/text-models/Qwen3.5-4B-Q4_K_M.gguf"
            ))
        );
    }

    #[test]
    fn text_model_path_unknown_returns_none() {
        let path = text_model_path(Path::new("/app-data"), "unknown");
        assert!(path.is_none());
    }

    #[test]
    fn llama_server_path_is_in_bin_directory() {
        let path = llama_server_path(Path::new("/app-data"));
        assert!(path.starts_with("/app-data/bin"));
        let filename = path
            .file_name()
            .expect("should have filename")
            .to_string_lossy();
        assert!(filename.starts_with("llama-server"));
    }

    #[test]
    fn get_default_server_url_returns_github_url() {
        let url = get_default_server_url();
        assert!(url.starts_with("https://github.com/ggml-org/llama.cpp"));
        assert!(url.contains(LLAMA_SERVER_VERSION));
    }

    #[test]
    fn llama_server_version_is_not_empty() {
        assert!(!LLAMA_SERVER_VERSION.is_empty());
    }
}
