pub mod commands;
pub mod downloader;
pub mod duration;
pub mod error;
pub mod ffmpeg;
pub mod types;

pub use types::*;

/// Audio formats that are natively supported (no conversion needed).
const NATIVE_FORMATS: &[&str] = &["wav"];

/// Audio formats that require conversion via ffmpeg.
const CONVERTIBLE_AUDIO_FORMATS: &[&str] = &[
    "mp3", "m4a", "flac", "ogg", "aac", "wma", "opus", "aiff", "caf", "amr",
];

/// Video formats that require conversion via ffmpeg.
const CONVERTIBLE_VIDEO_FORMATS: &[&str] = &[
    "mp4", "mov", "webm", "avi", "mkv", "ts", "mts", "wmv", "flv", "3gp",
];

/// Checks whether the given file extension is a supported format.
#[must_use]
pub fn is_supported_format(extension: &str) -> bool {
    let ext = extension.to_lowercase();
    NATIVE_FORMATS.contains(&ext.as_str())
        || CONVERTIBLE_AUDIO_FORMATS.contains(&ext.as_str())
        || CONVERTIBLE_VIDEO_FORMATS.contains(&ext.as_str())
}

/// Checks whether a file with the given extension needs conversion to WAV.
///
/// Returns `true` for all supported formats except WAV.
#[must_use]
pub fn needs_conversion(extension: &str) -> bool {
    let ext = extension.to_lowercase();
    if !is_supported_format(&ext) {
        return false;
    }
    !NATIVE_FORMATS.contains(&ext.as_str())
}

/// Returns the list of all supported formats with metadata.
#[must_use]
pub fn get_supported_formats() -> Vec<SupportedFormat> {
    let native = NATIVE_FORMATS.iter().map(|&ext| (ext, false));
    let convertible = CONVERTIBLE_AUDIO_FORMATS
        .iter()
        .chain(CONVERTIBLE_VIDEO_FORMATS.iter())
        .map(|&ext| (ext, true));

    native
        .chain(convertible)
        .map(|(ext, needs_conversion)| SupportedFormat {
            extension: ext.to_string(),
            description: format_description(ext),
            needs_conversion,
        })
        .collect()
}

/// Returns a human-readable description for a file extension.
fn format_description(ext: &str) -> String {
    match ext {
        "wav" => "WAV Audio".to_string(),
        "mp3" => "MP3 Audio".to_string(),
        "m4a" => "M4A Audio (AAC)".to_string(),
        "flac" => "FLAC Audio".to_string(),
        "ogg" => "OGG Audio".to_string(),
        "aac" => "AAC Audio".to_string(),
        "wma" => "WMA Audio".to_string(),
        "opus" => "Opus Audio".to_string(),
        "mp4" => "MP4 Video".to_string(),
        "mov" => "MOV Video".to_string(),
        "webm" => "WebM Video".to_string(),
        "avi" => "AVI Video".to_string(),
        "mkv" => "MKV Video".to_string(),
        "aiff" => "AIFF Audio".to_string(),
        "caf" => "CAF Audio (Core Audio)".to_string(),
        "amr" => "AMR Audio".to_string(),
        "ts" => "MPEG-TS Video".to_string(),
        "mts" => "MTS Video (AVCHD)".to_string(),
        "wmv" => "WMV Video".to_string(),
        "flv" => "FLV Video".to_string(),
        "3gp" => "3GP Video".to_string(),
        _ => format!("{} file", ext.to_uppercase()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- is_supported_format ---

    #[test]
    fn is_supported_format_wav() {
        assert!(is_supported_format("wav"));
    }

    #[test]
    fn is_supported_format_audio_formats() {
        assert!(is_supported_format("mp3"));
        assert!(is_supported_format("m4a"));
        assert!(is_supported_format("flac"));
        assert!(is_supported_format("ogg"));
        assert!(is_supported_format("aac"));
        assert!(is_supported_format("wma"));
        assert!(is_supported_format("opus"));
        assert!(is_supported_format("aiff"));
        assert!(is_supported_format("caf"));
        assert!(is_supported_format("amr"));
    }

    #[test]
    fn is_supported_format_video_formats() {
        assert!(is_supported_format("mp4"));
        assert!(is_supported_format("mov"));
        assert!(is_supported_format("webm"));
        assert!(is_supported_format("avi"));
        assert!(is_supported_format("mkv"));
        assert!(is_supported_format("ts"));
        assert!(is_supported_format("mts"));
        assert!(is_supported_format("wmv"));
        assert!(is_supported_format("flv"));
        assert!(is_supported_format("3gp"));
    }

    #[test]
    fn is_supported_format_case_insensitive() {
        assert!(is_supported_format("MP3"));
        assert!(is_supported_format("WAV"));
        assert!(is_supported_format("Mp4"));
    }

    #[test]
    fn is_supported_format_rejects_unsupported() {
        assert!(!is_supported_format("txt"));
        assert!(!is_supported_format("pdf"));
        assert!(!is_supported_format("jpg"));
        assert!(!is_supported_format("doc"));
    }

    // --- needs_conversion ---

    #[test]
    fn needs_conversion_wav_returns_false() {
        assert!(!needs_conversion("wav"));
        assert!(!needs_conversion("WAV"));
    }

    #[test]
    fn needs_conversion_audio_returns_true() {
        assert!(needs_conversion("mp3"));
        assert!(needs_conversion("m4a"));
        assert!(needs_conversion("flac"));
        assert!(needs_conversion("ogg"));
    }

    #[test]
    fn needs_conversion_video_returns_true() {
        assert!(needs_conversion("mp4"));
        assert!(needs_conversion("mov"));
        assert!(needs_conversion("webm"));
    }

    #[test]
    fn needs_conversion_unsupported_returns_false() {
        assert!(!needs_conversion("txt"));
        assert!(!needs_conversion("pdf"));
    }

    // --- get_supported_formats ---

    #[test]
    fn get_supported_formats_is_not_empty() {
        let formats = get_supported_formats();
        assert!(!formats.is_empty());
    }

    #[test]
    fn get_supported_formats_contains_wav() {
        let formats = get_supported_formats();
        let wav = formats.iter().find(|f| f.extension == "wav");
        assert!(wav.is_some());
        assert!(!wav.expect("wav should exist").needs_conversion);
    }

    #[test]
    fn get_supported_formats_contains_mp3() {
        let formats = get_supported_formats();
        let mp3 = formats.iter().find(|f| f.extension == "mp3");
        assert!(mp3.is_some());
        assert!(mp3.expect("mp3 should exist").needs_conversion);
    }

    #[test]
    fn get_supported_formats_contains_video() {
        let formats = get_supported_formats();
        let mp4 = formats.iter().find(|f| f.extension == "mp4");
        assert!(mp4.is_some());
        assert!(mp4.expect("mp4 should exist").needs_conversion);
    }
}
