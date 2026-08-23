pub mod commands;
pub mod downloader;
pub mod duration;
pub mod error;
pub mod ffmpeg;
pub mod types;

pub use types::*;

/// Protocols ffmpeg may resolve for an input path.
///
/// ffmpeg treats `-i` as a URL, so without this it would happily fetch
/// `http://…` or stitch `concat:…` inputs. `crypto` and `data` stay in the list
/// because local demuxers legitimately use them for embedded streams.
pub(crate) const LOCAL_PROTOCOLS: &str = "file,crypto,data";

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
pub(crate) fn is_supported_format(extension: &str) -> bool {
    let ext = extension.to_lowercase();
    NATIVE_FORMATS.contains(&ext.as_str())
        || CONVERTIBLE_AUDIO_FORMATS.contains(&ext.as_str())
        || CONVERTIBLE_VIDEO_FORMATS.contains(&ext.as_str())
}

/// Checks whether a file with the given extension needs conversion to WAV.
///
/// Returns `true` for all supported formats except WAV.
#[must_use]
pub(crate) fn needs_conversion(extension: &str) -> bool {
    let ext = extension.to_lowercase();
    if !is_supported_format(&ext) {
        return false;
    }
    !NATIVE_FORMATS.contains(&ext.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- LOCAL_PROTOCOLS ---

    #[test]
    fn local_protocols_excludes_network_and_stitching_protocols() {
        for protocol in ["http", "https", "tcp", "concat", "subfile", "rtmp", "hls"] {
            assert!(
                !LOCAL_PROTOCOLS.split(',').any(|p| p == protocol),
                "{protocol} must not be whitelisted"
            );
        }
        assert!(LOCAL_PROTOCOLS.split(',').any(|p| p == "file"));
    }

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
}
