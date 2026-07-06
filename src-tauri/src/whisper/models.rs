//! Whisper model definitions and utilities.
//!
//! # Model selection rationale
//!
//! This app targets multilingual transcription with accurate punctuation.
//! Two model tiers are offered so users can pick the trade-off that fits
//! their use case.
//!
//! - **small**: Lightweight, fast option that runs comfortably on modest hardware
//! - **large-v3-turbo**: Distilled large model — fast with high accuracy

use super::types::ModelInfo;

/// Default base URL for downloading Whisper models (`HuggingFace`).
const DEFAULT_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// Filename for the Silero VAD model (GGML format).
const VAD_MODEL_FILENAME: &str = "ggml-silero-v5.1.2.bin";

/// Download URL for the Silero VAD model.
const VAD_MODEL_URL: &str =
    "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin";

/// Valid model IDs.
const VALID_MODEL_IDS: [&str; 2] = ["small", "large-v3-turbo"];

/// Returns the default base URL for downloading Whisper models.
#[must_use]
pub(crate) fn get_default_base_url() -> &'static str {
    DEFAULT_BASE_URL
}

/// Returns the filename for a given model ID.
///
/// Format: `ggml-{model_id}.bin`
#[must_use]
pub(crate) fn get_model_filename(model_id: &str) -> String {
    format!("ggml-{model_id}.bin")
}

/// Returns the download URL for a given model ID and base URL.
///
/// Strips trailing slashes from the base URL before constructing.
#[must_use]
pub(crate) fn get_model_url(model_id: &str, base_url: &str) -> String {
    let base = base_url.trim_end_matches('/');
    format!("{base}/{}", get_model_filename(model_id))
}

/// Returns whether the given model ID is a known valid model.
#[must_use]
pub(crate) fn is_valid_model_id(model_id: &str) -> bool {
    VALID_MODEL_IDS.contains(&model_id)
}

/// Returns the filename for the Silero VAD model.
#[must_use]
pub(crate) fn get_vad_model_filename() -> &'static str {
    VAD_MODEL_FILENAME
}

/// Returns the download URL for the Silero VAD model.
#[must_use]
pub(crate) fn get_vad_model_url() -> &'static str {
    VAD_MODEL_URL
}

/// Returns speed factor estimates (seconds per minute of audio) for the given model/arch.
///
/// Returns `(0.0, 0.0)` for unknown combinations.
#[must_use]
pub(crate) fn get_speed_factors(model_id: &str, arch: &str) -> (f64, f64) {
    match (model_id, arch) {
        ("large-v3-turbo", "aarch64") => (3.0, 7.0),
        ("small", "aarch64") => (1.5, 3.5),
        ("large-v3-turbo", "x86_64") => (30.0, 90.0),
        ("small", "x86_64") => (10.0, 30.0),
        _ => (0.0, 0.0),
    }
}

/// Returns the list of available models.
///
/// All models have `downloaded` and `bundled` set to `false`.
/// Use [`get_model_list_with_speed_factors`] for architecture-aware speed estimates.
#[must_use]
fn get_model_list() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "small".to_string(),
            name: "Small".to_string(),
            size: "466MB".to_string(),
            size_bytes: 488_636_416,
            description: "Lightweight and fast. Saves storage".to_string(),
            downloaded: false,
            bundled: false,
            speed_seconds_per_minute_low: 0.0,
            speed_seconds_per_minute_high: 0.0,
            path: None,
        },
        ModelInfo {
            id: "large-v3-turbo".to_string(),
            name: "Large v3 Turbo".to_string(),
            size: "1.6GB".to_string(),
            size_bytes: 1_739_587_584,
            description: "Fast and accurate. Distilled model".to_string(),
            downloaded: false,
            bundled: false,
            speed_seconds_per_minute_low: 0.0,
            speed_seconds_per_minute_high: 0.0,
            path: None,
        },
    ]
}

/// Returns the model list with architecture-aware speed factor estimates.
#[must_use]
pub(crate) fn get_model_list_with_speed_factors() -> Vec<ModelInfo> {
    let arch = std::env::consts::ARCH;
    let mut models = get_model_list();
    for model in &mut models {
        let (low, high) = get_speed_factors(&model.id, arch);
        model.speed_seconds_per_minute_low = low;
        model.speed_seconds_per_minute_high = high;
    }
    models
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- get_default_base_url ---

    #[test]
    fn get_default_base_url_returns_huggingface_url() {
        let url = get_default_base_url();
        assert!(url.contains("huggingface.co"));
        assert!(url.contains("whisper.cpp"));
    }

    // --- get_model_filename ---

    #[test]
    fn get_model_filename_returns_ggml_format() {
        assert_eq!(get_model_filename("small"), "ggml-small.bin");
        assert_eq!(
            get_model_filename("large-v3-turbo"),
            "ggml-large-v3-turbo.bin"
        );
    }

    // --- get_model_url ---

    #[test]
    fn get_model_url_with_default_base_url() {
        let url = get_model_url("small", get_default_base_url());
        assert_eq!(
            url,
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
        );
    }

    #[test]
    fn get_model_url_with_custom_base_url() {
        let url = get_model_url("small", "https://internal.example.com/models");
        assert_eq!(url, "https://internal.example.com/models/ggml-small.bin");
    }

    #[test]
    fn get_model_url_strips_trailing_slash() {
        let url = get_model_url("small", "https://internal.example.com/models/");
        assert_eq!(url, "https://internal.example.com/models/ggml-small.bin");
    }

    // --- get_model_list ---

    #[test]
    fn get_model_list_returns_non_empty() {
        let models = get_model_list();
        assert!(!models.is_empty());
    }

    #[test]
    fn get_model_list_contains_only_recommended_models() {
        let models = get_model_list();
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"small"));
        assert!(ids.contains(&"large-v3-turbo"));
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn get_model_list_excludes_legacy_models() {
        let models = get_model_list();
        let ids: Vec<&str> = models.iter().map(|m| m.id.as_str()).collect();
        assert!(!ids.contains(&"tiny"));
        assert!(!ids.contains(&"base"));
        assert!(!ids.contains(&"medium"));
        assert!(!ids.contains(&"large-v3"));
    }

    #[test]
    fn get_model_list_has_correct_sizes() {
        let models = get_model_list();
        for model in &models {
            match model.id.as_str() {
                "large-v3-turbo" => {
                    assert_eq!(model.size_bytes, 1_739_587_584);
                    assert_eq!(model.size, "1.6GB");
                }
                "small" => {
                    assert_eq!(model.size_bytes, 488_636_416);
                    assert_eq!(model.size, "466MB");
                }
                _ => panic!("Unexpected model: {}", model.id),
            }
        }
    }

    #[test]
    fn get_model_list_all_not_downloaded_by_default() {
        let models = get_model_list();
        for model in &models {
            assert!(
                !model.downloaded,
                "model {} should not be downloaded",
                model.id
            );
            assert!(!model.bundled, "model {} should not be bundled", model.id);
            assert!(
                model.path.is_none(),
                "model {} should have no path",
                model.id
            );
        }
    }

    // --- get_speed_factors ---

    #[test]
    fn get_speed_factors_aarch64_large_v3_turbo() {
        assert_eq!(get_speed_factors("large-v3-turbo", "aarch64"), (3.0, 7.0));
    }

    #[test]
    fn get_speed_factors_aarch64_small() {
        assert_eq!(get_speed_factors("small", "aarch64"), (1.5, 3.5));
    }

    #[test]
    fn get_speed_factors_x86_64_large_v3_turbo() {
        assert_eq!(get_speed_factors("large-v3-turbo", "x86_64"), (30.0, 90.0));
    }

    #[test]
    fn get_speed_factors_x86_64_small() {
        assert_eq!(get_speed_factors("small", "x86_64"), (10.0, 30.0));
    }

    #[test]
    fn get_speed_factors_unknown_model() {
        assert_eq!(get_speed_factors("unknown", "aarch64"), (0.0, 0.0));
        assert_eq!(get_speed_factors("medium", "aarch64"), (0.0, 0.0));
        assert_eq!(get_speed_factors("large-v3", "x86_64"), (0.0, 0.0));
    }

    #[test]
    fn get_speed_factors_unknown_arch() {
        assert_eq!(get_speed_factors("small", "riscv64"), (0.0, 0.0));
    }

    // --- get_model_list speed_seconds_per_minute ---

    #[test]
    fn get_model_list_has_zero_speed_factors() {
        let models = get_model_list();
        for model in &models {
            assert_eq!(
                model.speed_seconds_per_minute_low, 0.0,
                "model {} should have zero speed_seconds_per_minute_low",
                model.id
            );
            assert_eq!(
                model.speed_seconds_per_minute_high, 0.0,
                "model {} should have zero speed_seconds_per_minute_high",
                model.id
            );
        }
    }

    // --- is_valid_model_id ---

    #[test]
    fn is_valid_model_id_accepts_known_models() {
        assert!(is_valid_model_id("small"));
        assert!(is_valid_model_id("large-v3-turbo"));
    }

    #[test]
    fn is_valid_model_id_rejects_unknown_models() {
        assert!(!is_valid_model_id("tiny"));
        assert!(!is_valid_model_id("base"));
        assert!(!is_valid_model_id("medium"));
        assert!(!is_valid_model_id("large-v3"));
        assert!(!is_valid_model_id("nonexistent"));
    }

    // --- VAD model helpers ---

    #[test]
    fn get_vad_model_filename_returns_silero_bin() {
        let filename = get_vad_model_filename();
        assert!(filename.contains("silero"));
        assert!(filename.ends_with(".bin"));
    }

    #[test]
    fn get_vad_model_url_returns_huggingface_url() {
        let url = get_vad_model_url();
        assert!(url.contains("huggingface.co"));
        assert!(url.contains("silero"));
        assert!(url.ends_with(".bin"));
    }
}
