use std::path::{Path, PathBuf};

use super::error::ConverterError;

/// macOS download URL (evermeet.cx — recommended by ffmpeg.org).
/// Redirects to the latest release zip containing a single ffmpeg binary.
#[cfg(target_os = "macos")]
const MACOS_DEFAULT_URL: &str = "https://evermeet.cx/ffmpeg/getrelease/zip";

/// Windows download URL (`BtbN/FFmpeg-Builds` LGPL — GitHub hosted).
#[cfg(target_os = "windows")]
const WINDOWS_DEFAULT_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl.zip";

/// Linux x64 download URL (`BtbN/FFmpeg-Builds` LGPL — GitHub hosted).
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const LINUX_X64_DEFAULT_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-lgpl.tar.xz";

/// Linux arm64 download URL (`BtbN/FFmpeg-Builds` LGPL — GitHub hosted).
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
const LINUX_ARM64_DEFAULT_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-lgpl.tar.xz";

/// Archive format of the download.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveFormat {
    /// Zip archive (macOS, Windows)
    Zip,
    /// tar.xz archive (Linux)
    TarXz,
}

/// Returns the default download URL for the current platform.
#[must_use]
pub fn get_default_download_url() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        MACOS_DEFAULT_URL
    }
    #[cfg(target_os = "windows")]
    {
        WINDOWS_DEFAULT_URL
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        LINUX_X64_DEFAULT_URL
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        LINUX_ARM64_DEFAULT_URL
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
    )))]
    {
        compile_error!("Unsupported platform: no default ffmpeg download URL available");
    }
}

/// Returns the expected archive format for the current platform.
#[must_use]
pub fn get_archive_format() -> ArchiveFormat {
    #[cfg(target_os = "linux")]
    {
        ArchiveFormat::TarXz
    }
    #[cfg(not(target_os = "linux"))]
    {
        ArchiveFormat::Zip
    }
}

/// Returns the path where the ffmpeg binary will be stored.
///
/// Located in the `bin/` subdirectory of the app data directory.
#[must_use]
pub fn get_ffmpeg_path(app_data_dir: &Path) -> PathBuf {
    let binary_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    app_data_dir.join("bin").join(binary_name)
}

/// Checks whether the bundled ffmpeg binary exists.
#[must_use]
pub fn ffmpeg_exists(app_data_dir: &Path) -> bool {
    get_ffmpeg_path(app_data_dir).exists()
}

/// Returns the bin directory under the app data directory.
#[must_use]
pub fn bin_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("bin")
}

/// Extracts the ffmpeg binary from a zip archive.
///
/// Searches for a file named `ffmpeg` or `ffmpeg.exe` in the archive
/// (at any depth) and extracts it to `output_path`.
///
/// # Errors
///
/// Returns an error if the archive cannot be read or the binary is not found.
fn extract_ffmpeg_from_zip(archive_path: &Path, output_path: &Path) -> Result<(), ConverterError> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| ConverterError::ConversionFailed(e.to_string()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| ConverterError::ConversionFailed(e.to_string()))?;

    let target_name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| ConverterError::ConversionFailed(e.to_string()))?;

        let entry_name = entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|f| f.to_string_lossy().to_string()));

        if let Some(name) = entry_name {
            if name == target_name && entry.is_file() {
                let mut out_file = std::fs::File::create(output_path)
                    .map_err(|e| ConverterError::ConversionFailed(e.to_string()))?;
                std::io::copy(&mut entry, &mut out_file)
                    .map_err(|e| ConverterError::ConversionFailed(e.to_string()))?;
                return Ok(());
            }
        }
    }

    Err(ConverterError::ConversionFailed(
        "ffmpeg binary not found in archive".to_string(),
    ))
}

/// Extracts the ffmpeg binary from a tar.xz archive using the system `tar` command.
///
/// # Errors
///
/// Returns an error if extraction fails.
fn extract_ffmpeg_from_tar_xz(
    archive_path: &Path,
    output_path: &Path,
) -> Result<(), ConverterError> {
    use std::process::Command;

    // List archive contents to find the ffmpeg binary path
    let list_output = Command::new("tar")
        .args(["tf", &archive_path.to_string_lossy()])
        .output()
        .map_err(|e| ConverterError::ConversionFailed(format!("Failed to list archive: {e}")))?;

    if !list_output.status.success() {
        return Err(ConverterError::ConversionFailed(
            "Failed to list tar.xz archive".to_string(),
        ));
    }

    let contents = String::from_utf8_lossy(&list_output.stdout);
    let ffmpeg_entry = contents
        .lines()
        .find(|line| {
            let path = Path::new(line);
            path.file_name()
                .is_some_and(|f| f == "ffmpeg" || f == "ffmpeg.exe")
        })
        .ok_or_else(|| {
            ConverterError::ConversionFailed("ffmpeg binary not found in archive".to_string())
        })?
        .to_string();

    // Extract the specific file
    let temp_dir = archive_path.parent().unwrap_or(Path::new("/tmp"));
    let extract_output = Command::new("tar")
        .args([
            "xf",
            &archive_path.to_string_lossy(),
            "-C",
            &temp_dir.to_string_lossy(),
            &ffmpeg_entry,
        ])
        .output()
        .map_err(|e| ConverterError::ConversionFailed(format!("Failed to extract: {e}")))?;

    if !extract_output.status.success() {
        return Err(ConverterError::ConversionFailed(
            "Failed to extract ffmpeg from tar.xz".to_string(),
        ));
    }

    // Move extracted binary to output path
    let extracted_path = temp_dir.join(&ffmpeg_entry);
    std::fs::rename(&extracted_path, output_path)
        .or_else(|_| {
            // rename may fail across filesystems, fall back to copy + remove
            std::fs::copy(&extracted_path, output_path)?;
            std::fs::remove_file(&extracted_path)?;
            Ok::<(), std::io::Error>(())
        })
        .map_err(|e: std::io::Error| {
            ConverterError::ConversionFailed(format!("Failed to move ffmpeg binary: {e}"))
        })?;

    // Clean up extracted directory structure
    if let Some(top_dir) = ffmpeg_entry.split('/').next() {
        let top_path = temp_dir.join(top_dir);
        if top_path.is_dir() {
            let _ = std::fs::remove_dir_all(&top_path);
        }
    }

    Ok(())
}

/// Downloads the ffmpeg binary with progress reporting.
///
/// Downloads the platform-specific archive, extracts the ffmpeg binary,
/// and places it in `{app_data_dir}/bin/`.
///
/// # Errors
///
/// Returns an error if the download fails or the file cannot be written.
pub async fn download_ffmpeg<F>(
    app_data_dir: &Path,
    custom_url: Option<&str>,
    on_progress: F,
) -> Result<PathBuf, ConverterError>
where
    F: Fn(u64, u64, f64),
{
    use futures_util::StreamExt;
    use std::time::Instant;
    use tokio::io::AsyncWriteExt;

    let url = custom_url.unwrap_or(get_default_download_url());
    let format = if custom_url.is_some() {
        // Custom URL: guess format from extension
        if url.ends_with(".tar.xz") {
            ArchiveFormat::TarXz
        } else {
            ArchiveFormat::Zip
        }
    } else {
        get_archive_format()
    };

    let dir = bin_dir(app_data_dir);
    std::fs::create_dir_all(&dir).map_err(ConverterError::from)?;

    // Download to a temporary archive file
    let archive_ext = match format {
        ArchiveFormat::Zip => "zip",
        ArchiveFormat::TarXz => "tar.xz",
    };
    let archive_path = dir.join(format!("ffmpeg-download.{archive_ext}"));

    let response = reqwest::get(url).await.map_err(ConverterError::from)?;

    let status = response.status();
    if !status.is_success() {
        return Err(ConverterError::DownloadFailed(format!(
            "HTTP {status} for {url}"
        )));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(&archive_path)
        .await
        .map_err(ConverterError::from)?;
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(ConverterError::from)?;
        file.write_all(&chunk).await.map_err(ConverterError::from)?;
        downloaded_bytes += chunk.len() as u64;

        // Throttle progress callbacks to 100ms
        if last_emit.elapsed().as_millis() >= 100 {
            let progress = if total_bytes > 0 {
                #[allow(clippy::cast_precision_loss)]
                {
                    (downloaded_bytes as f64 / total_bytes as f64) * 100.0
                }
            } else {
                0.0
            };
            on_progress(downloaded_bytes, total_bytes, progress);
            last_emit = Instant::now();
        }
    }

    file.flush().await.map_err(ConverterError::from)?;
    drop(file);

    // Extract ffmpeg binary from archive
    let final_path = get_ffmpeg_path(app_data_dir);

    match format {
        ArchiveFormat::Zip => extract_ffmpeg_from_zip(&archive_path, &final_path)?,
        ArchiveFormat::TarXz => extract_ffmpeg_from_tar_xz(&archive_path, &final_path)?,
    }

    // Clean up the archive
    let _ = std::fs::remove_file(&archive_path);

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o755);
        std::fs::set_permissions(&final_path, perms).map_err(ConverterError::from)?;
    }

    // Emit final 100% progress
    on_progress(downloaded_bytes, total_bytes, 100.0);

    Ok(final_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_default_download_url_returns_https_url() {
        let url = get_default_download_url();
        assert!(url.starts_with("https://"));
    }

    #[test]
    fn get_default_download_url_contains_ffmpeg() {
        let url = get_default_download_url();
        assert!(url.to_lowercase().contains("ffmpeg"));
    }

    #[test]
    fn get_archive_format_returns_valid_format() {
        let format = get_archive_format();
        assert!(format == ArchiveFormat::Zip || format == ArchiveFormat::TarXz);
    }

    #[test]
    fn get_ffmpeg_path_is_in_bin_directory() {
        let path = get_ffmpeg_path(Path::new("/tmp/test-app-data"));
        assert!(path.starts_with("/tmp/test-app-data/bin"));
        let filename = path.file_name().expect("should have filename");
        assert!(filename.to_string_lossy().starts_with("ffmpeg"));
    }

    #[test]
    fn ffmpeg_exists_returns_false_when_missing() {
        let exists = ffmpeg_exists(Path::new("/tmp/nonexistent-app-data-dir"));
        assert!(!exists);
    }

    #[test]
    fn bin_dir_returns_correct_path() {
        let dir = bin_dir(Path::new("/app-data"));
        assert_eq!(dir, PathBuf::from("/app-data/bin"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_evermeet_url() {
        let url = get_default_download_url();
        assert!(url.contains("evermeet.cx"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_zip_format() {
        assert_eq!(get_archive_format(), ArchiveFormat::Zip);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_uses_btbn_lgpl_url() {
        let url = get_default_download_url();
        assert!(url.contains("BtbN"));
        assert!(url.contains("lgpl"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_uses_zip_format() {
        assert_eq!(get_archive_format(), ArchiveFormat::Zip);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_uses_btbn_lgpl_url() {
        let url = get_default_download_url();
        assert!(url.contains("BtbN"));
        assert!(url.contains("lgpl"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_uses_tar_xz_format() {
        assert_eq!(get_archive_format(), ArchiveFormat::TarXz);
    }

    /// Creates a zip archive containing a file at `entry_path` with the given content.
    fn create_test_zip(archive_path: &Path, entry_path: &str, content: &[u8]) {
        use std::io::Write;
        let file = std::fs::File::create(archive_path).expect("create zip file");
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        zip.start_file(entry_path, options)
            .expect("start zip entry");
        zip.write_all(content).expect("write zip content");
        zip.finish().expect("finish zip");
    }

    #[test]
    fn extract_ffmpeg_from_zip_finds_binary_at_root() {
        let dir = std::env::temp_dir().join("whisper-test-zip-root");
        let _ = std::fs::create_dir_all(&dir);
        let archive_path = dir.join("test.zip");
        let output_path = dir.join("ffmpeg");

        create_test_zip(&archive_path, "ffmpeg", b"fake-ffmpeg-binary");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_ok(), "extraction should succeed");
        assert!(output_path.exists(), "output file should exist");
        assert_eq!(
            std::fs::read(&output_path).expect("read output"),
            b"fake-ffmpeg-binary"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_ffmpeg_from_zip_finds_binary_in_nested_directory() {
        let dir = std::env::temp_dir().join("whisper-test-zip-nested");
        let _ = std::fs::create_dir_all(&dir);
        let archive_path = dir.join("test.zip");
        let output_path = dir.join("ffmpeg");

        create_test_zip(
            &archive_path,
            "ffmpeg-6.1-amd64/bin/ffmpeg",
            b"nested-binary",
        );

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_ok(), "extraction should succeed for nested path");
        assert_eq!(
            std::fs::read(&output_path).expect("read output"),
            b"nested-binary"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_ffmpeg_from_zip_fails_when_binary_not_found() {
        let dir = std::env::temp_dir().join("whisper-test-zip-missing");
        let _ = std::fs::create_dir_all(&dir);
        let archive_path = dir.join("test.zip");
        let output_path = dir.join("ffmpeg");

        create_test_zip(&archive_path, "README.txt", b"no ffmpeg here");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_err(), "should fail when ffmpeg not in archive");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn extract_ffmpeg_from_zip_fails_with_invalid_archive() {
        let dir = std::env::temp_dir().join("whisper-test-zip-invalid");
        let _ = std::fs::create_dir_all(&dir);
        let archive_path = dir.join("not-a-zip.zip");
        let output_path = dir.join("ffmpeg");

        std::fs::write(&archive_path, b"this is not a zip file").expect("write fake file");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_err(), "should fail with invalid archive");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
