use std::path::{Path, PathBuf};
use std::process::Command;

use super::error::ConverterError;

/// Checks whether ffmpeg is available at the given path.
///
/// # Errors
///
/// Returns `ConverterError::FfmpegNotFound` if the binary is not found or
/// cannot be executed.
pub(crate) fn check_available(ffmpeg_path: &Path) -> Result<(), ConverterError> {
    let output = Command::new(ffmpeg_path)
        .arg("-version")
        .output()
        .map_err(|e| ConverterError::FfmpegNotFound(format!("{}: {e}", ffmpeg_path.display())))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(ConverterError::FfmpegNotFound(format!(
            "ffmpeg exited with status: {}",
            output.status
        )))
    }
}

/// Builds the ffmpeg command-line arguments for converting audio to WAV.
///
/// Output format: WAV PCM, 16kHz, mono, 16-bit
#[must_use]
fn build_convert_args(input_path: &Path, output_path: &Path) -> Vec<String> {
    vec![
        // Defense in depth behind `validate_input_file`: ffmpeg reads `-i` as a
        // URL, so restrict it to local protocols, and never let it block on
        // stdin.
        "-nostdin".to_string(),
        "-protocol_whitelist".to_string(),
        super::LOCAL_PROTOCOLS.to_string(),
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
        "-ar".to_string(),
        "16000".to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-sample_fmt".to_string(),
        "s16".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]
}

/// Converts an audio/video file to WAV using ffmpeg.
///
/// Output: WAV PCM, 16kHz, mono, 16-bit (optimal for Whisper).
///
/// # Errors
///
/// Returns `ConverterError::ConversionFailed` if ffmpeg fails.
pub(crate) fn convert_to_wav(
    ffmpeg_path: &Path,
    input_path: &Path,
    output_path: &Path,
) -> Result<PathBuf, ConverterError> {
    let args = build_convert_args(input_path, output_path);

    let output = Command::new(ffmpeg_path)
        .args(&args)
        .output()
        .map_err(|e| ConverterError::ConversionFailed(format!("Failed to run ffmpeg: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ConverterError::ConversionFailed(format!(
            "ffmpeg exited with {}: {}",
            output.status,
            stderr.lines().last().unwrap_or("unknown error")
        )));
    }

    Ok(output_path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_convert_args_produces_correct_arguments() {
        let input = Path::new("/path/to/input.mp3");
        let output = Path::new("/tmp/output.wav");
        let args = build_convert_args(input, output);

        assert_eq!(args[0], "-nostdin");
        assert_eq!(args[1], "-protocol_whitelist");
        assert_eq!(args[2], super::super::LOCAL_PROTOCOLS);
        assert_eq!(args[3], "-i");
        assert_eq!(args[4], "/path/to/input.mp3");
        assert_eq!(args[5], "-ar");
        assert_eq!(args[6], "16000");
        assert_eq!(args[7], "-ac");
        assert_eq!(args[8], "1");
        assert_eq!(args[9], "-sample_fmt");
        assert_eq!(args[10], "s16");
        assert_eq!(args[11], "-y");
        assert_eq!(args[12], "/tmp/output.wav");
    }

    #[test]
    fn build_convert_args_restricts_protocols_to_local() {
        let args = build_convert_args(Path::new("/i.mp3"), Path::new("/o.wav"));
        let whitelist = args
            .iter()
            .position(|a| a == "-protocol_whitelist")
            .and_then(|i| args.get(i + 1))
            .expect("protocol whitelist must be present");
        assert!(!whitelist.contains("http"));
        assert!(!whitelist.contains("concat"));
    }

    #[test]
    fn build_convert_args_has_correct_count() {
        let input = Path::new("/input.mp3");
        let output = Path::new("/output.wav");
        let args = build_convert_args(input, output);
        assert_eq!(args.len(), 13);
    }

    #[test]
    fn check_available_with_nonexistent_path_returns_error() {
        let result = check_available(Path::new("/nonexistent/ffmpeg-binary"));
        assert!(result.is_err());
        let err = result.expect_err("should be an error");
        assert!(err.to_string().contains("FFmpeg not found"));
    }

    #[test]
    fn convert_to_wav_with_nonexistent_ffmpeg_returns_error() {
        let result = convert_to_wav(
            Path::new("/nonexistent/ffmpeg"),
            Path::new("/input.mp3"),
            Path::new("/output.wav"),
        );
        assert!(result.is_err());
    }
}
