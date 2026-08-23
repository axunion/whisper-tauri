use std::path::Path;
use std::time::Instant;

use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

/// Progress event throttle interval in milliseconds.
const PROGRESS_THROTTLE_MS: u128 = 100;

/// Errors that can occur during file downloads.
#[derive(Debug, thiserror::Error)]
pub enum DownloadError {
    /// The server returned a non-success HTTP status.
    #[error("HTTP {0} for {1}")]
    HttpStatus(u16, String),

    /// An HTTP transport error occurred.
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// An I/O error occurred while writing the file.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// The stream ended before the advertised number of bytes arrived.
    #[error("Incomplete transfer: got {0} of {1} bytes")]
    Incomplete(u64, u64),

    /// The URL could not be parsed.
    #[error("Invalid download URL: {0}")]
    InvalidUrl(String),

    /// The URL uses a scheme other than HTTPS.
    #[error("Insecure download URL: {0}")]
    InsecureUrl(String),

    /// The URL host is not trusted to serve an executable artifact.
    #[error("Untrusted download host: {0}")]
    UntrustedHost(String),
}

/// Hosts trusted to serve binaries the app makes executable and then runs.
///
/// ffmpeg and llama-server are chmod'd `0o755` and spawned, so overriding
/// *their* download source is a code-execution decision rather than a mirror
/// preference. Data-only downloads (Whisper models, GGUF models) are not
/// restricted this way and keep the free-form mirror override.
const EXECUTABLE_HOSTS: &[&str] = &[
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "evermeet.cx",
];

/// Parses `url` and rejects any scheme other than HTTPS.
fn require_https(url: &str) -> Result<reqwest::Url, DownloadError> {
    let parsed =
        reqwest::Url::parse(url).map_err(|e| DownloadError::InvalidUrl(format!("{url}: {e}")))?;
    if parsed.scheme() == "https" {
        Ok(parsed)
    } else {
        Err(DownloadError::InsecureUrl(url.to_string()))
    }
}

/// Validates a download URL for an artifact that will be executed.
///
/// Callers must run this *before* downloading; [`download_file`] only enforces
/// the HTTPS requirement, which is not enough for a binary that gets spawned.
///
/// # Errors
///
/// Returns [`DownloadError::InvalidUrl`] if `url` cannot be parsed,
/// [`DownloadError::InsecureUrl`] if it is not HTTPS, or
/// [`DownloadError::UntrustedHost`] if its host is not trusted.
pub fn validate_executable_url(url: &str) -> Result<(), DownloadError> {
    let parsed = require_https(url)?;
    let host = parsed.host_str().unwrap_or_default();
    if EXECUTABLE_HOSTS.contains(&host) {
        Ok(())
    } else {
        Err(DownloadError::UntrustedHost(host.to_string()))
    }
}

/// Downloads a file from a URL to a local path, reporting progress via a callback.
///
/// The callback receives `(downloaded_bytes, total_bytes, progress_percent)`.
/// Progress is throttled to at most once per 100ms.
///
/// **Does not** perform atomic rename or emit a final 100% callback — those
/// are the caller's responsibility.
///
/// Rejects non-HTTPS URLs so a mirror override cannot downgrade the transfer
/// to cleartext. Artifacts that get executed need [`validate_executable_url`]
/// on top of this.
///
/// # Errors
///
/// Returns `DownloadError` if the URL is not HTTPS, the HTTP request fails, the
/// server returns a non-success status, an I/O error occurs while writing the
/// file, or the stream ends before the advertised `Content-Length` was received.
pub async fn download_file<F>(
    url: &str,
    output_path: &Path,
    on_progress: F,
) -> Result<(), DownloadError>
where
    F: Fn(u64, u64, f64),
{
    require_https(url)?;

    let response = reqwest::get(url).await?;

    let status = response.status();
    if !status.is_success() {
        return Err(DownloadError::HttpStatus(status.as_u16(), url.to_string()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(output_path).await?;
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded_bytes += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= PROGRESS_THROTTLE_MS {
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

    file.flush().await?;

    // A stream can end cleanly before the advertised length (proxy or
    // connection cut mid-transfer). Without this check the caller renames a
    // truncated file into place and reports the download as successful.
    if total_bytes > 0 && downloaded_bytes != total_bytes {
        return Err(DownloadError::Incomplete(downloaded_bytes, total_bytes));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_error_http_status_display() {
        let err = DownloadError::HttpStatus(404, "https://example.com/file".to_string());
        assert_eq!(err.to_string(), "HTTP 404 for https://example.com/file");
    }

    #[test]
    fn download_error_io_display() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = DownloadError::Io(io_err);
        assert_eq!(err.to_string(), "IO error: file not found");
    }

    #[test]
    fn download_error_incomplete_display() {
        let err = DownloadError::Incomplete(1024, 2048);
        assert_eq!(
            err.to_string(),
            "Incomplete transfer: got 1024 of 2048 bytes"
        );
    }

    #[test]
    fn download_error_invalid_url_display() {
        let err = DownloadError::InvalidUrl("nope: relative URL without a base".to_string());
        assert_eq!(
            err.to_string(),
            "Invalid download URL: nope: relative URL without a base"
        );
    }

    #[test]
    fn download_error_insecure_url_display() {
        let err = DownloadError::InsecureUrl("http://example.com/a.zip".to_string());
        assert_eq!(
            err.to_string(),
            "Insecure download URL: http://example.com/a.zip"
        );
    }

    #[test]
    fn download_error_untrusted_host_display() {
        let err = DownloadError::UntrustedHost("attacker.example".to_string());
        assert_eq!(err.to_string(), "Untrusted download host: attacker.example");
    }

    // --- require_https ---

    #[test]
    fn require_https_accepts_https() {
        assert!(require_https("https://example.com/a.zip").is_ok());
    }

    #[test]
    fn require_https_rejects_plain_http() {
        let err = require_https("http://example.com/a.zip").expect_err("http must be rejected");
        assert!(matches!(err, DownloadError::InsecureUrl(_)));
    }

    #[test]
    fn require_https_rejects_file_scheme() {
        let err = require_https("file:///etc/passwd").expect_err("file must be rejected");
        assert!(matches!(err, DownloadError::InsecureUrl(_)));
    }

    #[test]
    fn require_https_rejects_unparseable_url() {
        let err = require_https("not a url").expect_err("garbage must be rejected");
        assert!(matches!(err, DownloadError::InvalidUrl(_)));
    }

    // --- validate_executable_url ---

    #[test]
    fn validate_executable_url_accepts_trusted_hosts() {
        for url in [
            "https://github.com/ggml-org/llama.cpp/releases/download/b1/x.tar.gz",
            "https://objects.githubusercontent.com/x",
            "https://release-assets.githubusercontent.com/x",
            "https://evermeet.cx/ffmpeg/ffmpeg-8.1.zip",
        ] {
            assert!(
                validate_executable_url(url).is_ok(),
                "{url} should be allowed"
            );
        }
    }

    #[test]
    fn validate_executable_url_rejects_untrusted_host() {
        let err = validate_executable_url("https://attacker.example/llama.tar.gz")
            .expect_err("untrusted host must be rejected");
        assert!(matches!(err, DownloadError::UntrustedHost(_)));
    }

    #[test]
    fn validate_executable_url_rejects_lookalike_host() {
        // Suffix matching would accept this; membership must be exact.
        let err = validate_executable_url("https://github.com.attacker.example/x.zip")
            .expect_err("lookalike host must be rejected");
        assert!(matches!(err, DownloadError::UntrustedHost(_)));
    }

    #[test]
    fn validate_executable_url_rejects_plain_http_on_trusted_host() {
        let err = validate_executable_url("http://github.com/x.zip")
            .expect_err("http must be rejected even for a trusted host");
        assert!(matches!(err, DownloadError::InsecureUrl(_)));
    }

    #[test]
    fn validate_executable_url_rejects_userinfo_host_confusion() {
        // The authority's host is `attacker.example`; `github.com` is userinfo.
        let err = validate_executable_url("https://github.com@attacker.example/x.zip")
            .expect_err("userinfo must not be mistaken for the host");
        assert!(matches!(err, DownloadError::UntrustedHost(_)));
    }
}
