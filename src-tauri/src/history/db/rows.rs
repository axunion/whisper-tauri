use super::super::error::HistoryError;
use super::super::types::{AiContent, HistoryMeta};
use super::compression::decompress_text;

/// Row shape for the list/meta query against the `history` table.
pub struct MetaRow {
    pub(super) id: String,
    pub(super) created_at: String,
    pub(super) file_name: String,
    pub(super) language: String,
    pub(super) model_id: String,
    pub(super) duration: u64,
    pub(super) text_compressed: Vec<u8>,
    pub(super) vad_enabled: Option<bool>,
}

/// Row shape for a query against the `ai_content` table.
pub struct AiContentRow {
    pub(super) id: String,
    pub(super) history_id: String,
    pub(super) content_type: String,
    pub(super) created_at: String,
    pub(super) text_compressed: Vec<u8>,
    pub(super) options_json: Option<String>,
    pub(super) text_model_id: String,
}

/// Extracts a [`MetaRow`] from a rusqlite row.
///
/// Expects columns: `id(0)`, `created_at(1)`, `file_name(2)`, `language(3)`,
/// `model_id(4)`, `duration(5)`, `text_compressed(6)`, `vad_enabled(7)`.
///
/// # Errors
///
/// Returns an error if any column extraction fails.
pub fn meta_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<MetaRow> {
    Ok(MetaRow {
        id: row.get(0)?,
        created_at: row.get(1)?,
        file_name: row.get(2)?,
        language: row.get(3)?,
        model_id: row.get(4)?,
        duration: row.get(5)?,
        text_compressed: row.get(6)?,
        vad_enabled: row.get(7)?,
    })
}

/// Converts a [`MetaRow`] into a [`HistoryMeta`], decompressing text for preview.
///
/// # Errors
///
/// Returns an error if text decompression fails.
pub fn meta_from_row(row: MetaRow) -> Result<HistoryMeta, HistoryError> {
    let text = decompress_text(&row.text_compressed)?;
    let preview = text_preview(&text, 100);
    Ok(HistoryMeta {
        id: row.id,
        created_at: row.created_at,
        file_name: row.file_name,
        language: row.language,
        model_id: row.model_id,
        duration: row.duration,
        text_preview: preview,
        vad_enabled: row.vad_enabled,
    })
}

/// Extracts an [`AiContentRow`] from a rusqlite row.
///
/// Expects columns: `id(0)`, `history_id(1)`, `content_type(2)`, `created_at(3)`,
/// `text_compressed(4)`, `options_json(5)`, `text_model_id(6)`.
///
/// # Errors
///
/// Returns an error if column extraction fails.
pub fn ai_content_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<AiContentRow> {
    Ok(AiContentRow {
        id: row.get(0)?,
        history_id: row.get(1)?,
        content_type: row.get(2)?,
        created_at: row.get(3)?,
        text_compressed: row.get(4)?,
        options_json: row.get(5)?,
        text_model_id: row.get(6)?,
    })
}

/// Converts an [`AiContentRow`] into an [`AiContent`], decompressing text.
///
/// # Errors
///
/// Returns an error if text decompression fails.
pub fn ai_content_from_row(row: AiContentRow) -> Result<AiContent, HistoryError> {
    let text = decompress_text(&row.text_compressed)?;
    Ok(AiContent {
        id: row.id,
        history_id: row.history_id,
        content_type: row.content_type,
        created_at: row.created_at,
        text,
        options_json: row.options_json,
        text_model_id: row.text_model_id,
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
