use super::super::error::HistoryError;

/// Compresses text using gzip.
///
/// # Errors
///
/// Returns `HistoryError::Compression` if compression fails.
pub fn compress_text(text: &str) -> Result<Vec<u8>, HistoryError> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(text.as_bytes())
        .map_err(|e| HistoryError::Compression(e.to_string()))?;
    encoder
        .finish()
        .map_err(|e| HistoryError::Compression(e.to_string()))
}

/// Decompresses gzip data to text.
///
/// # Errors
///
/// Returns `HistoryError::Compression` if decompression fails.
pub fn decompress_text(data: &[u8]) -> Result<String, HistoryError> {
    use flate2::read::GzDecoder;
    use std::io::Read;

    let mut decoder = GzDecoder::new(data);
    let mut result = String::new();
    decoder
        .read_to_string(&mut result)
        .map_err(|e| HistoryError::Compression(e.to_string()))?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compress_decompress_roundtrip() {
        let original = "Hello, this is a test string for compression!";
        let compressed = compress_text(original).expect("Failed to compress");
        let decompressed = decompress_text(&compressed).expect("Failed to decompress");
        assert_eq!(original, decompressed);
    }

    #[test]
    fn compress_decompress_empty_string() {
        let original = "";
        let compressed = compress_text(original).expect("Failed to compress");
        let decompressed = decompress_text(&compressed).expect("Failed to decompress");
        assert_eq!(original, decompressed);
    }

    #[test]
    fn compress_decompress_unicode() {
        let original = "日本語テスト。これは圧縮テストです。";
        let compressed = compress_text(original).expect("Failed to compress");
        let decompressed = decompress_text(&compressed).expect("Failed to decompress");
        assert_eq!(original, decompressed);
    }
}
