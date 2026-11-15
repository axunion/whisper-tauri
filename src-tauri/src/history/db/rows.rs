use super::super::error::HistoryError;
use super::super::types::{AiContent, HistoryMeta, HistorySource};
use super::compression::decompress_text;

/// Row shape for the list/meta query against the `history` table.
pub(crate) struct MetaRow {
    pub(super) id: String,
    pub(super) created_at: String,
    pub(super) file_name: String,
    pub(super) language: String,
    pub(super) model_id: String,
    pub(super) duration: u64,
    pub(super) text_preview: String,
    pub(super) vad_enabled: Option<bool>,
    pub(super) source: HistorySource,
}

/// Row shape for a query against the `ai_content` table.
pub(crate) struct AiContentRow {
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
/// `model_id(4)`, `duration(5)`, `text_preview(6)`, `vad_enabled(7)`,
/// `source(8)`.
///
/// # Errors
///
/// Returns an error if any column extraction fails.
pub(crate) fn meta_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<MetaRow> {
    Ok(MetaRow {
        id: row.get(0)?,
        created_at: row.get(1)?,
        file_name: row.get(2)?,
        language: row.get(3)?,
        model_id: row.get(4)?,
        duration: row.get(5)?,
        text_preview: row.get(6)?,
        vad_enabled: row.get(7)?,
        source: HistorySource::from_db(row.get_ref(8)?.as_str()?),
    })
}

/// Converts a [`MetaRow`] into a [`HistoryMeta`] with its stored preview.
#[must_use]
pub(crate) fn meta_from_row(mut row: MetaRow) -> HistoryMeta {
    let preview = std::mem::take(&mut row.text_preview);
    meta_with_preview(row, preview)
}

/// Like [`meta_from_row`], but the preview is an excerpt of `text` around the
/// first occurrence of any of `keywords`, so a search result shows why it
/// matched.
#[must_use]
pub(crate) fn meta_from_row_matching(row: MetaRow, text: &str, keywords: &[String]) -> HistoryMeta {
    let preview = match_preview(text, keywords, PREVIEW_CHARS);
    meta_with_preview(row, preview)
}

fn meta_with_preview(row: MetaRow, text_preview: String) -> HistoryMeta {
    HistoryMeta {
        id: row.id,
        created_at: row.created_at,
        file_name: row.file_name,
        language: row.language,
        model_id: row.model_id,
        duration: row.duration,
        text_preview,
        vad_enabled: row.vad_enabled,
        source: row.source,
    }
}

/// Extracts an [`AiContentRow`] from a rusqlite row.
///
/// Expects columns: `id(0)`, `history_id(1)`, `content_type(2)`, `created_at(3)`,
/// `text_compressed(4)`, `options_json(5)`, `text_model_id(6)`.
///
/// # Errors
///
/// Returns an error if column extraction fails.
pub(crate) fn ai_content_row_mapper(row: &rusqlite::Row) -> rusqlite::Result<AiContentRow> {
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
pub(crate) fn ai_content_from_row(row: AiContentRow) -> Result<AiContent, HistoryError> {
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

/// Length of a list preview, in characters.
const PREVIEW_CHARS: usize = 100;

/// Characters of context kept before the hit in a search excerpt.
const MATCH_LEAD_CHARS: usize = 20;

/// Returns a `max_len`-character excerpt of `text` positioned around the
/// earliest occurrence of any keyword. Falls back to the leading preview when
/// no keyword occurs in the text (the entry matched on its file name).
///
/// Matching folds ASCII case only, mirroring `SQLite`'s `LIKE`.
#[must_use]
fn match_preview(text: &str, keywords: &[String], max_len: usize) -> String {
    let chars: Vec<char> = text.trim().chars().collect();
    let folded: Vec<char> = chars.iter().map(char::to_ascii_lowercase).collect();

    let hit = keywords
        .iter()
        .filter_map(|keyword| {
            let needle: Vec<char> = keyword.chars().map(|c| c.to_ascii_lowercase()).collect();
            if needle.is_empty() {
                return None;
            }
            folded
                .windows(needle.len())
                .position(|window| window == needle.as_slice())
        })
        .min();

    let Some(hit) = hit else {
        return text_preview(text, max_len);
    };

    let end = (hit.saturating_sub(MATCH_LEAD_CHARS) + max_len).min(chars.len());
    // Anchored on `end` so a hit near the end of the text still yields a full
    // excerpt instead of a few trailing characters.
    let start = end.saturating_sub(max_len);
    let mut excerpt = String::new();
    if start > 0 {
        excerpt.push_str("...");
    }
    excerpt.extend(&chars[start..end]);
    if end < chars.len() {
        excerpt.push_str("...");
    }
    excerpt
}

/// Returns the preview stored with an entry and shown in list views.
#[must_use]
pub(crate) fn stored_preview(text: &str) -> String {
    text_preview(text, PREVIEW_CHARS)
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

    #[test]
    fn match_preview_starts_shortly_before_the_earliest_hit() {
        let text = format!("{}予算と会議{}", "a".repeat(50), "b".repeat(200));
        let keywords = ["会議".to_string(), "予算".to_string()];
        let preview = match_preview(&text, &keywords, 100);
        assert!(preview.starts_with("...aaaaaaaaaaaaaaaaaaaa予算と会議"));
        assert!(preview.ends_with("..."));
        assert_eq!(preview.chars().count(), 106); // 100 + both ellipses
    }

    #[test]
    fn match_preview_has_no_leading_ellipsis_for_an_early_hit() {
        assert_eq!(
            match_preview("会議を始めます", &["会議".to_string()], 100),
            "会議を始めます"
        );
    }

    #[test]
    fn match_preview_folds_ascii_case() {
        let text = format!("{}Budget review", "x".repeat(200));
        let preview = match_preview(&text, &["budget".to_string()], 100);
        assert!(preview.contains("Budget review"));
        assert!(preview.starts_with("..."));
    }

    #[test]
    fn match_preview_falls_back_when_text_has_no_hit() {
        assert_eq!(
            match_preview("本文です", &["test".to_string()], 100),
            "本文です"
        );
    }

    #[test]
    fn match_preview_near_the_end_has_leading_but_no_trailing_ellipsis() {
        let text = format!("{}予算の話", "あ".repeat(300));
        let preview = match_preview(&text, &["予算".to_string()], 100);
        assert!(preview.starts_with("..."));
        assert!(!preview.ends_with("..."));
        assert!(preview.ends_with("予算の話"));
    }
}
