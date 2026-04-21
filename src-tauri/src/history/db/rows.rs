use super::super::error::HistoryError;
use super::super::types::{AiContent, HistoryMeta};
use super::compression::decompress_text;

/// Row type returned by [`meta_row_mapper`].
pub type MetaRow = (String, String, String, String, String, u64, Vec<u8>);

/// Row type returned by [`ai_content_row_mapper`].
pub type AiContentRow = (
    String,
    String,
    String,
    String,
    Vec<u8>,
    Option<String>,
    String,
);

/// Extracts a [`MetaRow`] tuple from a rusqlite row.
///
/// Expects columns: `id(0)`, `created_at(1)`, `file_name(2)`, `language(3)`,
/// `model_id(4)`, `duration(5)`, `text_compressed(6)`.
///
/// # Errors
///
/// Returns an error if any column extraction fails.
pub fn meta_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<MetaRow> {
    Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
        row.get::<_, u64>(5)?,
        row.get::<_, Vec<u8>>(6)?,
    ))
}

/// Converts a [`MetaRow`] into a [`HistoryMeta`], decompressing text for preview.
///
/// # Errors
///
/// Returns an error if text decompression fails.
pub fn meta_from_row(row: MetaRow) -> Result<HistoryMeta, HistoryError> {
    let (id, created_at, file_name, language, model_id, duration, text_compressed) = row;
    let text = decompress_text(&text_compressed)?;
    let preview = text_preview(&text, 100);
    Ok(HistoryMeta {
        id,
        created_at,
        file_name,
        language,
        model_id,
        duration,
        text_preview: preview,
    })
}

/// Extracts an [`AiContentRow`] tuple from a rusqlite row.
///
/// Expects columns: `id(0)`, `history_id(1)`, `content_type(2)`, `created_at(3)`,
/// `text_compressed(4)`, `options_json(5)`, `text_model_id(6)`.
///
/// # Errors
///
/// Returns an error if column extraction fails.
pub fn ai_content_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<AiContentRow> {
    Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, Vec<u8>>(4)?,
        row.get::<_, Option<String>>(5)?,
        row.get::<_, String>(6)?,
    ))
}

/// Converts an [`AiContentRow`] into an [`AiContent`], decompressing text.
///
/// # Errors
///
/// Returns an error if text decompression fails.
pub fn ai_content_from_row(row: AiContentRow) -> Result<AiContent, HistoryError> {
    let (id, history_id, content_type, created_at, text_compressed, options_json, text_model_id) =
        row;
    let text = decompress_text(&text_compressed)?;
    Ok(AiContent {
        id,
        history_id,
        content_type,
        created_at,
        text,
        options_json,
        text_model_id,
    })
}

/// Returns a preview of text, truncated to `max_len` characters.
#[must_use]
fn text_preview(text: &str, max_len: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_len {
        trimmed.to_string()
    } else {
        let preview: String = trimmed.chars().take(max_len).collect();
        format!("{preview}...")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_preview_short_text() {
        assert_eq!(text_preview("Hello", 100), "Hello");
    }

    #[test]
    fn text_preview_truncates_long_text() {
        let long_text = "a".repeat(200);
        let preview = text_preview(&long_text, 100);
        assert_eq!(preview.chars().count(), 103); // 100 + "..."
        assert!(preview.ends_with("..."));
    }

    #[test]
    fn text_preview_trims_whitespace() {
        assert_eq!(text_preview("  hello  ", 100), "hello");
    }
}
