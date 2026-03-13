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
}

/// Downloads a file from a URL to a local path, reporting progress via a callback.
///
/// The callback receives `(downloaded_bytes, total_bytes, progress_percent)`.
/// Progress is throttled to at most once per 100ms.
///
/// **Does not** perform atomic rename or emit a final 100% callback — those
/// are the caller's responsibility.
///
/// # Errors
///
/// Returns `DownloadError` if the HTTP request fails, the server returns a
/// non-success status, or an I/O error occurs while writing the file.
pub async fn download_file<F>(
    url: &str,
    output_path: &Path,
    on_progress: F,
) -> Result<(), DownloadError>
where
    F: Fn(u64, u64, f64),
{
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
}
