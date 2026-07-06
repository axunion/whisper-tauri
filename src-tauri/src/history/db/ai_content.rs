use std::path::Path;

use super::super::error::HistoryError;
use super::super::types::{AiContent, AiContentSaveParams};
use super::compression::compress_text;
use super::rows::{ai_content_from_row, ai_content_row_mapper};
use super::time::chrono_now;

/// Saves AI-generated content (upsert: replaces existing content of same type).
///
/// # Errors
///
/// Returns `HistoryError` if database operations or compression fail.
pub(crate) fn save_ai_content(
    db_path: &Path,
    params: &AiContentSaveParams,
) -> Result<String, HistoryError> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono_now();
    let text_compressed = compress_text(&params.text)?;

    let conn = super::open_connection(db_path)?;

    conn.execute(
        "INSERT OR REPLACE INTO ai_content (id, history_id, content_type, created_at, text_compressed, options_json, text_model_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            params.history_id,
            params.content_type,
            created_at,
            text_compressed,
            params.options_json,
            params.text_model_id,
        ],
    )?;

    Ok(id)
}

/// Gets AI-generated content by history ID and content type.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the query fails.
pub(crate) fn get_ai_content(
    db_path: &Path,
    history_id: &str,
    content_type: &str,
) -> Result<Option<AiContent>, HistoryError> {
    let conn = super::open_connection(db_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, history_id, content_type, created_at, text_compressed, options_json, text_model_id
         FROM ai_content WHERE history_id = ?1 AND content_type = ?2",
    )?;

    let result = stmt.query_row(
        rusqlite::params![history_id, content_type],
        ai_content_row_mapper,
    );

    match result {
        Ok(row) => Ok(Some(ai_content_from_row(row)?)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(HistoryError::Database(e.to_string())),
    }
}

/// Gets all AI-generated content for a history entry.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the query fails.
pub(crate) fn get_all_ai_content(
    db_path: &Path,
    history_id: &str,
) -> Result<Vec<AiContent>, HistoryError> {
    let conn = super::open_connection(db_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, history_id, content_type, created_at, text_compressed, options_json, text_model_id
         FROM ai_content WHERE history_id = ?1",
    )?;

    let rows = stmt.query_map(rusqlite::params![history_id], ai_content_row_mapper)?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(ai_content_from_row(row?)?);
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::db::entries::save_entry;
    use crate::history::db::test_helpers::{sample_params, setup_db};

    #[test]
    fn save_and_get_ai_content() {
        let (_dir, path) = setup_db();
        let entry_id = save_entry(&path, &sample_params()).expect("save entry");

        let params = AiContentSaveParams {
            history_id: entry_id.clone(),
            content_type: "summary".to_string(),
            text: "This is a summary of the transcription.".to_string(),
            options_json: Some(r#"{"length":"medium","bulletPoints":false}"#.to_string()),
            text_model_id: "gemma-4-e2b".to_string(),
        };

        let ai_id = save_ai_content(&path, &params).expect("save ai content");
        assert!(!ai_id.is_empty());

        let content = get_ai_content(&path, &entry_id, "summary").expect("get ai content");
        assert!(content.is_some());
        let content = content.unwrap();
        assert_eq!(content.history_id, entry_id);
        assert_eq!(content.content_type, "summary");
        assert_eq!(content.text, "This is a summary of the transcription.");
        assert_eq!(content.text_model_id, "gemma-4-e2b");
    }

    #[test]
    fn get_ai_content_not_found() {
        let (_dir, path) = setup_db();
        let entry_id = save_entry(&path, &sample_params()).expect("save entry");

        let content = get_ai_content(&path, &entry_id, "summary").expect("get");
        assert!(content.is_none());
    }

    #[test]
    fn save_ai_content_upsert() {
        let (_dir, path) = setup_db();
        let entry_id = save_entry(&path, &sample_params()).expect("save entry");

        let params1 = AiContentSaveParams {
            history_id: entry_id.clone(),
            content_type: "summary".to_string(),
            text: "First summary".to_string(),
            options_json: None,
            text_model_id: "gemma-4-e2b".to_string(),
        };
        save_ai_content(&path, &params1).expect("save first");

        let params2 = AiContentSaveParams {
            history_id: entry_id.clone(),
            content_type: "summary".to_string(),
            text: "Updated summary".to_string(),
            options_json: None,
            text_model_id: "qwen3.5-4b".to_string(),
        };
        save_ai_content(&path, &params2).expect("save second");

        let content = get_ai_content(&path, &entry_id, "summary")
            .expect("get")
            .unwrap();
        assert_eq!(content.text, "Updated summary");
        assert_eq!(content.text_model_id, "qwen3.5-4b");
    }

    #[test]
    fn get_all_ai_content_multiple_types() {
        let (_dir, path) = setup_db();
        let entry_id = save_entry(&path, &sample_params()).expect("save entry");

        for content_type in &["summary", "cleanText", "title"] {
            let params = AiContentSaveParams {
                history_id: entry_id.clone(),
                content_type: content_type.to_string(),
                text: format!("Content for {content_type}"),
                options_json: None,
                text_model_id: "gemma-4-e2b".to_string(),
            };
            save_ai_content(&path, &params).expect("save");
        }

        let all = get_all_ai_content(&path, &entry_id).expect("get all");
        assert_eq!(all.len(), 3);
    }
}
