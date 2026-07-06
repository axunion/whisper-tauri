use std::io::Read;
use std::path::{Path, PathBuf};

use super::error::TextProcessingError;

/// Target binary name for the current platform.
const LLAMA_SERVER_BINARY_NAME: &str = if cfg!(target_os = "windows") {
    "llama-server.exe"
} else {
    "llama-server"
};

/// Returns whether the filename is a shared library the server binary depends on.
///
/// Covers `.dylib` (macOS), `.so` / `.so.N` (Linux), `.dll` (Windows).
fn is_shared_library(filename: &str) -> bool {
    let ext_matches = |ext_name: &str| {
        Path::new(filename)
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case(ext_name))
    };
    ext_matches("dylib")
        || ext_matches("so")
        || filename.contains(".so.")
        || (cfg!(target_os = "windows") && ext_matches("dll"))
}

/// Returns whether a filename should be extracted from the archive —
/// the main binary or any shared library it depends on.
fn should_extract(filename: &str) -> bool {
    filename == LLAMA_SERVER_BINARY_NAME || is_shared_library(filename)
}

/// Returns whether a filename is an auxiliary artifact extracted alongside the
/// main binary (shared libraries), excluding the main binary itself.
#[must_use]
pub(crate) fn is_extracted_artifact(filename: &str) -> bool {
    is_shared_library(filename)
}

fn dl_err<E: std::fmt::Display>(e: E) -> String {
    TextProcessingError::DownloadFailed(e.to_string()).to_string()
}

fn io_err(e: std::io::Error) -> String {
    TextProcessingError::Io(e).to_string()
}

fn write_file(reader: &mut impl Read, out_path: &Path) -> Result<(), String> {
    let mut out_file = std::fs::File::create(out_path).map_err(io_err)?;
    std::io::copy(reader, &mut out_file).map_err(io_err)?;
    Ok(())
}

/// Extracts the llama-server binary and shared libraries from a tar.gz archive.
///
/// Handles both regular files and symlinks (common for versioned `.dylib` on macOS).
///
/// # Errors
///
/// Returns an error string if the archive cannot be read or the binary is missing.
pub(crate) fn extract_from_tar_gz(archive_path: &Path, bin_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path).map_err(dl_err)?;
    let decoder = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);

    let mut found_binary = false;
    let mut symlinks: Vec<(String, PathBuf)> = Vec::new();

    for entry in archive.entries().map_err(dl_err)? {
        let mut entry = entry.map_err(dl_err)?;
        let path = entry.path().map_err(dl_err)?;

        let Some(filename) = path.file_name().map(|f| f.to_string_lossy().to_string()) else {
            continue;
        };

        if !should_extract(&filename) {
            continue;
        }

        if filename == LLAMA_SERVER_BINARY_NAME {
            found_binary = true;
        }

        let entry_type = entry.header().entry_type();
        let out_path = bin_dir.join(&filename);

        if entry_type.is_symlink() {
            if let Ok(Some(target)) = entry.link_name() {
                let target_name = target
                    .file_name()
                    .unwrap_or(target.as_os_str())
                    .to_string_lossy()
                    .to_string();
                symlinks.push((target_name, out_path));
            }
        } else if entry_type.is_file() {
            write_file(&mut entry, &out_path)?;
        }
    }

    create_symlinks(&symlinks, bin_dir)?;

    if found_binary {
        Ok(())
    } else {
        Err(dl_err("llama-server binary not found in archive"))
    }
}

/// Extracts the llama-server binary and shared libraries from a zip archive.
///
/// # Errors
///
/// Returns an error string if the archive cannot be read or the binary is missing.
pub(crate) fn extract_from_zip(archive_path: &Path, bin_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path).map_err(dl_err)?;
    let mut archive = zip::ZipArchive::new(file).map_err(dl_err)?;

    let mut found_binary = false;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(dl_err)?;

        if !entry.is_file() {
            continue;
        }

        let Some(filename) = entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|f| f.to_string_lossy().to_string()))
        else {
            continue;
        };

        if !should_extract(&filename) {
            continue;
        }

        if filename == LLAMA_SERVER_BINARY_NAME {
            found_binary = true;
        }

        write_file(&mut entry, &bin_dir.join(&filename))?;
    }

    if found_binary {
        Ok(())
    } else {
        Err(dl_err("llama-server binary not found in archive"))
    }
}

fn create_symlinks(symlinks: &[(String, PathBuf)], bin_dir: &Path) -> Result<(), String> {
    for (target_name, link_path) in symlinks {
        let target_path = bin_dir.join(target_name);
        if !target_path.exists() {
            continue;
        }
        // A symlink entry may have been written earlier as a 0-byte placeholder
        // (before its target was seen); drop it so we can replace with a real symlink.
        let _ = std::fs::remove_file(link_path);
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&target_path, link_path).map_err(io_err)?;
        }
        #[cfg(not(unix))]
        {
            std::fs::copy(&target_path, link_path).map_err(io_err)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_extract_includes_binary() {
        assert!(should_extract(LLAMA_SERVER_BINARY_NAME));
    }

    #[test]
    fn should_extract_includes_shared_libs() {
        assert!(should_extract("libfoo.so"));
        assert!(should_extract("libfoo.so.1"));
        assert!(should_extract("libfoo.dylib"));
    }

    #[test]
    fn should_extract_rejects_unrelated() {
        assert!(!should_extract("readme.txt"));
        assert!(!should_extract("config.json"));
    }

    #[test]
    fn is_extracted_artifact_excludes_binary() {
        assert!(!is_extracted_artifact(LLAMA_SERVER_BINARY_NAME));
    }

    #[test]
    fn is_extracted_artifact_includes_shared_libs() {
        assert!(is_extracted_artifact("libfoo.so"));
        assert!(is_extracted_artifact("libggml.so.1"));
        assert!(is_extracted_artifact("libllama.dylib"));
    }

    #[test]
    fn is_extracted_artifact_rejects_unrelated() {
        assert!(!is_extracted_artifact("readme.txt"));
    }
}
