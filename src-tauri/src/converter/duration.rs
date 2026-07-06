use std::path::Path;

use super::error::ConverterError;

/// Gets the duration of an audio/video file using `Symphonia`.
///
/// Supports WAV, MP3, FLAC, OGG, M4A, AAC, MP4, `WebM`, MKV.
/// Returns duration in milliseconds.
///
/// # Errors
///
/// Returns `ConverterError::ConversionFailed` if the file cannot be probed or
/// duration cannot be determined.
pub(crate) fn get_duration_via_symphonia(input_path: &Path) -> Result<u64, ConverterError> {
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(input_path).map_err(|e| {
        ConverterError::ConversionFailed(format!(
            "Failed to open file {}: {e}",
            input_path.display()
        ))
    })?;

    let mss = MediaSourceStream::new(
        Box::new(file),
        symphonia::core::io::MediaSourceStreamOptions::default(),
    );

    let mut hint = Hint::new();
    if let Some(ext) = input_path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| {
            ConverterError::ConversionFailed(format!(
                "Failed to probe {}: {e}",
                input_path.display()
            ))
        })?;

    let reader = probed.format;

    // Find the default (first) track
    let track = reader.tracks().first().ok_or_else(|| {
        ConverterError::ConversionFailed(format!("No tracks found in {}", input_path.display()))
    })?;

    let params = &track.codec_params;

    // Try to get duration from codec params
    #[allow(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss
    )]
    if let (Some(n_frames), Some(sample_rate)) = (params.n_frames, params.sample_rate) {
        if sample_rate > 0 {
            let duration_ms = n_frames as f64 / f64::from(sample_rate) * 1000.0;
            return Ok(duration_ms.max(0.0) as u64);
        }
    }

    // Fallback: try time_base + n_frames
    #[allow(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss
    )]
    if let (Some(time_base), Some(n_frames)) = (params.time_base, params.n_frames) {
        let duration_secs =
            f64::from(time_base.numer) / f64::from(time_base.denom) * n_frames as f64;
        let duration_ms = duration_secs * 1000.0;
        return Ok(duration_ms.max(0.0) as u64);
    }

    Err(ConverterError::ConversionFailed(format!(
        "Could not determine duration of {}",
        input_path.display()
    )))
}

/// Gets the duration of an audio/video file by parsing `ffmpeg -i` stderr output.
///
/// Looks for `Duration: HH:MM:SS.ss` in the stderr output.
/// Returns duration in milliseconds.
///
/// # Errors
///
/// Returns `ConverterError::ConversionFailed` if ffmpeg fails or duration cannot be parsed.
pub(crate) fn get_duration_via_ffmpeg(
    ffmpeg_path: &Path,
    input_path: &Path,
) -> Result<u64, ConverterError> {
    let output = std::process::Command::new(ffmpeg_path)
        .args(["-i", &input_path.to_string_lossy()])
        .output()
        .map_err(|e| ConverterError::ConversionFailed(format!("Failed to run ffmpeg: {e}")))?;

    // ffmpeg -i without output file exits with error, but duration is in stderr
    let stderr = String::from_utf8_lossy(&output.stderr);

    parse_ffmpeg_duration(&stderr).ok_or_else(|| {
        ConverterError::ConversionFailed(format!(
            "Could not parse duration from ffmpeg output for {}",
            input_path.display()
        ))
    })
}

/// Parses `Duration: HH:MM:SS.ss` from ffmpeg stderr output.
///
/// Returns duration in milliseconds, or `None` if not found.
fn parse_ffmpeg_duration(stderr: &str) -> Option<u64> {
    // Look for "Duration: HH:MM:SS.ss" pattern
    let duration_prefix = "Duration: ";
    let start = stderr.find(duration_prefix)? + duration_prefix.len();
    let rest = &stderr[start..];

    // Extract "HH:MM:SS.ss" part (up to comma or end)
    let end = rest.find(',')?;
    let time_str = rest[..end].trim();

    // Parse "HH:MM:SS.ss"
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return None;
    }

    let hours: u64 = parts[0].parse().ok()?;
    let minutes: u64 = parts[1].parse().ok()?;

    // Seconds may have decimal: "SS.ss"
    let seconds_parts: Vec<&str> = parts[2].split('.').collect();
    let seconds: u64 = seconds_parts.first().and_then(|s| s.parse().ok())?;
    let centiseconds: u64 = seconds_parts
        .get(1)
        .and_then(|s| {
            // Normalize to centiseconds via arithmetic (avoid string allocation)
            let val: u64 = s.get(..s.len().min(2))?.parse().ok()?;
            Some(if s.len() == 1 { val * 10 } else { val })
        })
        .unwrap_or(0);

    Some(hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + centiseconds * 10)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- parse_ffmpeg_duration ---

    #[test]
    fn parse_ffmpeg_duration_typical_output() {
        let stderr = "  Duration: 00:03:24.56, start: 0.000000, bitrate: 128 kb/s";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, Some(204_560)); // 3*60*1000 + 24*1000 + 560
    }

    #[test]
    fn parse_ffmpeg_duration_hours() {
        let stderr = "  Duration: 01:23:45.00, start: 0.000000";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, Some(5_025_000)); // 1*3600*1000 + 23*60*1000 + 45*1000
    }

    #[test]
    fn parse_ffmpeg_duration_short_file() {
        let stderr = "  Duration: 00:00:01.50, start: 0.000000";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, Some(1_500));
    }

    #[test]
    fn parse_ffmpeg_duration_no_duration() {
        let stderr = "ffmpeg version 6.1 Copyright (c) 2000-2023";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, None);
    }

    #[test]
    fn parse_ffmpeg_duration_single_decimal() {
        let stderr = "  Duration: 00:01:30.5, start: 0.000000";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, Some(90_500));
    }

    #[test]
    fn parse_ffmpeg_duration_zero() {
        let stderr = "  Duration: 00:00:00.00, start: 0.000000";
        let result = parse_ffmpeg_duration(stderr);
        assert_eq!(result, Some(0));
    }

    // --- get_duration_via_ffmpeg ---

    #[test]
    fn get_duration_via_ffmpeg_nonexistent_binary() {
        let result =
            get_duration_via_ffmpeg(Path::new("/nonexistent/ffmpeg"), Path::new("/test.mp3"));
        assert!(result.is_err());
    }

    // --- get_duration_via_symphonia ---

    #[test]
    fn get_duration_via_symphonia_nonexistent_file() {
        let result = get_duration_via_symphonia(Path::new("/nonexistent/audio.wav"));
        assert!(result.is_err());
    }
}
