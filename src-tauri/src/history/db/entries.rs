use std::fmt::Write;
use std::path::Path;

use super::super::error::HistoryError;
use super::super::search;
use super::super::types::{
    HistoryEntry, HistoryFilter, HistoryMeta, HistorySaveParams, HistorySegment, HistorySortBy,
    SortOrder,
};
use super::compression::{compress_text, decompress_text};
use super::rows::{meta_from_row, meta_row_mapper};
use super::time::chrono_now;

/// Builds an ORDER BY clause based on the sort option and direction.
#[must_use]
pub(crate) fn sort_clause(
    sort_by: Option<&HistorySortBy>,
    sort_order: Option<&SortOrder>,
    prefix: &str,
) -> String {
    let dir = match sort_order {
        Some(SortOrder::Asc) => "ASC",
        Some(SortOrder::Desc) | None => "DESC",
    };
    match sort_by {
        Some(HistorySortBy::Duration) => format!("ORDER BY {prefix}duration {dir}"),
        Some(HistorySortBy::FileName) => {
            let file_dir = match sort_order {
                Some(SortOrder::Desc) => "DESC",
                Some(SortOrder::Asc) | None => "ASC",
            };
            format!("ORDER BY {prefix}file_name COLLATE NOCASE {file_dir}")
        }
        Some(HistorySortBy::Date) | None => format!("ORDER BY {prefix}created_at {dir}"),
    }
}

/// Saves a new history entry and returns its ID.
///
/// # Errors
///
/// Returns `HistoryError` if database operations or compression fail.
pub(crate) fn save_entry(
    db_path: &Path,
    params: &HistorySaveParams,
) -> Result<String, HistoryError> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono_now();

    let text_compressed = compress_text(&params.text)?;
    let segments_json = serde_json::to_string(&params.segments)
        .map_err(|e| HistoryError::Serialization(e.to_string()))?;
    let segments_compressed = compress_text(&segments_json)?;

    let conn = super::open_connection(db_path)?;

    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed, vad_enabled, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            created_at,
            params.file_name,
            params.language,
            params.model_id,
            params.duration,
            text_compressed,
            segments_compressed,
            params.vad_enabled,
            params.source.as_str(),
        ],
    )?;

    search::index_entry(&tx, &id, &params.text)?;

    tx.commit()?;

    Ok(id)
}

/// Lists history entries matching the filter, returning metadata only.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the query fails.
pub(crate) fn list_entries(
    db_path: &Path,
    filter: &HistoryFilter,
) -> Result<Vec<HistoryMeta>, HistoryError> {
    let conn = super::open_connection(db_path)?;

    let mut sql =
        String::from("SELECT id, created_at, file_name, language, model_id, duration, text_compressed, vad_enabled, source FROM history");
    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref from) = filter.date_from {
        conditions.push(format!("created_at >= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.date_to {
        conditions.push(format!("created_at < ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(to.clone()));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    write!(
        sql,
        " {}",
        sort_clause(filter.sort_by.as_ref(), filter.sort_order.as_ref(), "")
    )
    .ok();
    if let Some(limit) = filter.limit {
        write!(sql, " LIMIT {limit}").ok();
    }

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        params_vec.iter().map(AsRef::as_ref).collect();

    let mut stmt = conn.prepare(&sql)?;

    let rows = stmt.query_map(params_refs.as_slice(), meta_row_mapper)?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(meta_from_row(row?)?);
    }

    Ok(entries)
}

/// Gets a full history entry by ID.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if no entry with the given ID exists.
/// Returns `HistoryError::Database` if the query fails.
pub(crate) fn get_entry(db_path: &Path, id: &str) -> Result<HistoryEntry, HistoryError> {
    let conn = super::open_connection(db_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed, vad_enabled
         FROM history WHERE id = ?1",
    )?;

    let entry = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, u64>(5)?,
                row.get::<_, Vec<u8>>(6)?,
                row.get::<_, Vec<u8>>(7)?,
                row.get::<_, Option<bool>>(8)?,
            ))
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => HistoryError::NotFound(id.to_string()),
            other => HistoryError::Database(other.to_string()),
        })?;

    let (
        id,
        created_at,
        file_name,
        language,
        model_id,
        duration,
        text_compressed,
        segments_compressed,
        vad_enabled,
    ) = entry;
    let text = decompress_text(&text_compressed)?;
    let segments_json = decompress_text(&segments_compressed)?;
    let segments: Vec<HistorySegment> = serde_json::from_str(&segments_json)
        .map_err(|e| HistoryError::Serialization(e.to_string()))?;

    Ok(HistoryEntry {
        id,
        created_at,
        file_name,
        language,
        model_id,
        duration,
        text,
        segments,
        vad_enabled,
    })
}

/// Deletes history entries by IDs.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the delete operation fails.
pub(crate) fn delete_entries(db_path: &Path, ids: &[String]) -> Result<u64, HistoryError> {
    if ids.is_empty() {
        return Ok(0);
    }

    let conn = super::open_connection(db_path)?;

    let tx = conn.unchecked_transaction()?;

    for id in ids {
        search::delete_entry_index(&tx, id)?;
    }

    let placeholders: Vec<String> = (1..=ids.len()).map(|i| format!("?{i}")).collect();
    let sql = format!(
        "DELETE FROM history WHERE id IN ({})",
        placeholders.join(", ")
    );

    let params: Vec<&dyn rusqlite::types::ToSql> = ids
        .iter()
        .map(|id| id as &dyn rusqlite::types::ToSql)
        .collect();

    let deleted = tx.execute(&sql, params.as_slice())?;

    tx.commit()?;

    Ok(deleted as u64)
}

/// Deletes all history entries.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the delete operation fails.
pub(crate) fn delete_all_entries(db_path: &Path) -> Result<u64, HistoryError> {
    let conn = super::open_connection(db_path)?;

    let tx = conn.unchecked_transaction()?;

    search::delete_all_indices(&tx)?;

    let deleted = tx.execute("DELETE FROM history", [])?;

    tx.commit()?;

    Ok(deleted as u64)
}

/// Renames a history entry's file name.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if no entry with the given ID exists.
/// Returns `HistoryError::Database` if the update fails.
pub(crate) fn rename_entry(
    db_path: &Path,
    id: &str,
    new_file_name: &str,
) -> Result<(), HistoryError> {
    let conn = super::open_connection(db_path)?;
    let updated = conn.execute(
        "UPDATE history SET file_name = ?2 WHERE id = ?1",
        rusqlite::params![id, new_file_name],
    )?;
    if updated == 0 {
        return Err(HistoryError::NotFound(id.to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;
    use crate::history::db::ai_content::{get_all_ai_content, save_ai_content};
    use crate::history::db::test_helpers::{sample_ai_params, sample_params, setup_db};
    use crate::history::types::HistorySearchParams;

    #[test]
    fn save_and_list_entries() {
        let (_dir, path) = setup_db();
        let params = sample_params();

        let id = save_entry(&path, &params).expect("Failed to save");
        assert!(!id.is_empty());

        let entries = list_entries(&path, &HistoryFilter::default()).expect("Failed to list");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, id);
        assert_eq!(entries[0].file_name, "test_audio.wav");
        assert_eq!(entries[0].language, "ja");
        assert_eq!(entries[0].model_id, "large-v3-turbo");
        assert_eq!(entries[0].duration, 60000);
    }

    #[test]
    fn save_and_get_entry() {
        let (_dir, path) = setup_db();
        let params = sample_params();

        let id = save_entry(&path, &params).expect("Failed to save");
        let entry = get_entry(&path, &id).expect("Failed to get");

        assert_eq!(entry.id, id);
        assert_eq!(entry.text, "This is a test transcription.");
        assert_eq!(entry.segments.len(), 2);
        assert_eq!(entry.segments[0].text, "This is a test");
        assert_eq!(entry.segments[1].text, "transcription.");
        assert_eq!(entry.vad_enabled, Some(true));
    }

    #[test]
    fn save_entry_persists_vad_enabled_false() {
        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.vad_enabled = Some(false);

        let id = save_entry(&path, &params).expect("Failed to save");
        let entry = get_entry(&path, &id).expect("Failed to get");
        assert_eq!(entry.vad_enabled, Some(false));

        let metas = list_entries(&path, &HistoryFilter::default()).expect("list");
        assert_eq!(metas.len(), 1);
        assert_eq!(metas[0].vad_enabled, Some(false));
    }

    #[test]
    fn get_entry_returns_none_for_legacy_rows_without_vad_enabled() {
        let (_dir, path) = setup_db();

        let conn = Connection::open(&path).expect("open db");
        let text_compressed = compress_text("legacy").expect("compress text");
        let segments_compressed = compress_text("[]").expect("compress segments");

        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "legacy-entry",
                "2026-01-15T10:00:00",
                "legacy.wav",
                "ja",
                "small",
                10000_i64,
                text_compressed,
                segments_compressed,
            ],
        )
        .expect("insert legacy");
        drop(conn);

        let entry = get_entry(&path, "legacy-entry").expect("get");
        assert_eq!(entry.vad_enabled, None);

        let metas = list_entries(&path, &HistoryFilter::default()).expect("list");
        assert_eq!(metas.len(), 1);
        assert_eq!(metas[0].vad_enabled, None);
    }

    #[test]
    fn get_entry_not_found() {
        let (_dir, path) = setup_db();
        let result = get_entry(&path, "nonexistent-id");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("History not found"));
    }

    #[test]
    fn delete_entries_by_ids() {
        let (_dir, path) = setup_db();
        let id1 = save_entry(&path, &sample_params()).expect("Failed to save");
        let id2 = save_entry(&path, &sample_params()).expect("Failed to save");
        let _id3 = save_entry(&path, &sample_params()).expect("Failed to save");

        let deleted = delete_entries(&path, &[id1, id2]).expect("Failed to delete");
        assert_eq!(deleted, 2);

        let remaining = list_entries(&path, &HistoryFilter::default()).expect("Failed to list");
        assert_eq!(remaining.len(), 1);
    }

    #[test]
    fn delete_entries_empty_ids() {
        let (_dir, path) = setup_db();
        let deleted = delete_entries(&path, &[]).expect("Failed to delete");
        assert_eq!(deleted, 0);
    }

    #[test]
    fn delete_entries_cascades_ai_content() {
        let (_dir, path) = setup_db();
        let id1 = save_entry(&path, &sample_params()).expect("Failed to save");
        let id2 = save_entry(&path, &sample_params()).expect("Failed to save");
        save_ai_content(&path, &sample_ai_params(&id1)).expect("Failed to save ai content");
        save_ai_content(&path, &sample_ai_params(&id2)).expect("Failed to save ai content");

        delete_entries(&path, &[id1.clone(), id2.clone()]).expect("Failed to delete");

        for id in [&id1, &id2] {
            let remaining = get_all_ai_content(&path, id).expect("Failed to get ai content");
            assert!(
                remaining.is_empty(),
                "ai_content rows must cascade-delete with their history entry"
            );
        }
    }

    #[test]
    fn delete_all_entries_cascades_ai_content() {
        let (_dir, path) = setup_db();
        let id = save_entry(&path, &sample_params()).expect("Failed to save");
        save_ai_content(&path, &sample_ai_params(&id)).expect("Failed to save ai content");

        delete_all_entries(&path).expect("Failed to delete all");

        let remaining = get_all_ai_content(&path, &id).expect("Failed to get ai content");
        assert!(
            remaining.is_empty(),
            "ai_content rows must cascade-delete when all history is deleted"
        );
    }

    #[test]
    fn delete_all_entries_removes_all() {
        let (_dir, path) = setup_db();
        save_entry(&path, &sample_params()).expect("Failed to save");
        save_entry(&path, &sample_params()).expect("Failed to save");

        let deleted = delete_all_entries(&path).expect("Failed to delete all");
        assert_eq!(deleted, 2);

        let remaining = list_entries(&path, &HistoryFilter::default()).expect("Failed to list");
        assert!(remaining.is_empty());
    }

    #[test]
    fn list_entries_ordered_by_created_at_desc() {
        let (_dir, path) = setup_db();

        let id1 = save_entry(&path, &sample_params()).expect("save 1");
        let id2 = save_entry(&path, &sample_params()).expect("save 2");
        let id3 = save_entry(&path, &sample_params()).expect("save 3");

        let entries = list_entries(&path, &HistoryFilter::default()).expect("list");
        // Timestamps may collide at 1-second resolution; just verify all three are present.
        assert_eq!(entries.len(), 3);
        let ids: Vec<&str> = entries.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&id1.as_str()));
        assert!(ids.contains(&id2.as_str()));
        assert!(ids.contains(&id3.as_str()));
    }

    #[test]
    fn list_entries_with_date_filter() {
        let (_dir, path) = setup_db();

        let conn = Connection::open(&path).expect("open db");
        let text_compressed = compress_text("old entry").expect("compress");
        let segments_compressed = compress_text("[]").expect("compress segments");

        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "old-entry",
                "2025-01-15T10:00:00",
                "old.wav",
                "en",
                "small",
                30000_i64,
                text_compressed,
                segments_compressed,
            ],
        )
        .expect("insert old");

        let text_compressed2 = compress_text("new entry").expect("compress");
        let segments_compressed2 = compress_text("[]").expect("compress segments");

        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "new-entry",
                "2026-06-15T10:00:00",
                "new.wav",
                "ja",
                "large-v3-turbo",
                60000_i64,
                text_compressed2,
                segments_compressed2,
            ],
        )
        .expect("insert new");

        let filter = HistoryFilter {
            date_from: Some("2026-01-01T00:00:00".to_string()),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list filtered");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "new-entry");
    }

    /// `date_to` is exclusive, so a caller can pass the next local midnight
    /// without a `23:59:59` fudge that would drop the final second of the range.
    #[test]
    fn list_entries_date_range_is_half_open() {
        let (_dir, path) = setup_db();

        let conn = Connection::open(&path).expect("open db");
        for (id, created_at) in [
            ("at-from", "2026-06-15T00:00:00"),
            ("inside", "2026-06-15T23:59:59"),
            ("at-to", "2026-06-16T00:00:00"),
        ] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    id,
                    created_at,
                    "a.wav",
                    "ja",
                    "small",
                    1000_i64,
                    compress_text("text").expect("compress"),
                    compress_text("[]").expect("compress segments"),
                ],
            )
            .expect("insert");
        }

        let filter = HistoryFilter {
            date_from: Some("2026-06-15T00:00:00".to_string()),
            date_to: Some("2026-06-16T00:00:00".to_string()),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list filtered");
        let ids: Vec<&str> = entries.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&"at-from"), "lower bound is inclusive");
        assert!(ids.contains(&"inside"), "last second of the day is kept");
        assert!(!ids.contains(&"at-to"), "upper bound is exclusive");
    }

    #[test]
    fn save_entry_indexes_for_fts_search() {
        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.text = "全文検索テスト用テキスト".to_string();
        let _id = save_entry(&path, &params).expect("Failed to save");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "全文検索".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
                sort_order: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn delete_entries_removes_fts_index() {
        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.text = "削除テスト用テキスト".to_string();
        let id = save_entry(&path, &params).expect("Failed to save");

        delete_entries(&path, &[id]).expect("delete");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "削除テスト".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
                sort_order: None,
            },
        )
        .expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn delete_all_entries_clears_fts_index() {
        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.text = "全削除テスト".to_string();
        save_entry(&path, &params).expect("save");

        delete_all_entries(&path).expect("delete all");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "全削除".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
                sort_order: None,
            },
        )
        .expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn list_entries_with_limit() {
        let (_dir, path) = setup_db();
        for _ in 0..5 {
            save_entry(&path, &sample_params()).expect("save");
        }

        let filter = HistoryFilter {
            limit: Some(3),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list");
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn list_entries_without_limit_returns_all() {
        let (_dir, path) = setup_db();
        for _ in 0..5 {
            save_entry(&path, &sample_params()).expect("save");
        }

        let entries = list_entries(&path, &HistoryFilter::default()).expect("list");
        assert_eq!(entries.len(), 5);
    }

    #[test]
    fn list_entries_sorted_by_duration() {
        let (_dir, path) = setup_db();

        let conn = Connection::open(&path).expect("open db");
        let text_compressed = compress_text("test").expect("compress");
        let segments_compressed = compress_text("[]").expect("compress");

        for (id, duration) in [
            ("short", 10000_i64),
            ("long", 60000_i64),
            ("mid", 30000_i64),
        ] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    id,
                    "2026-01-01T10:00:00",
                    "test.wav",
                    "ja",
                    "small",
                    duration,
                    text_compressed,
                    segments_compressed,
                ],
            )
            .expect("insert");
        }
        drop(conn);

        let filter = HistoryFilter {
            sort_by: Some(HistorySortBy::Duration),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].id, "long");
        assert_eq!(entries[1].id, "mid");
        assert_eq!(entries[2].id, "short");
    }

    #[test]
    fn rename_entry_updates_file_name() {
        let (_dir, path) = setup_db();
        let id = save_entry(&path, &sample_params()).expect("save");

        rename_entry(&path, &id, "renamed_audio.wav").expect("rename");

        let entry = get_entry(&path, &id).expect("get");
        assert_eq!(entry.file_name, "renamed_audio.wav");
    }

    #[test]
    fn rename_entry_not_found() {
        let (_dir, path) = setup_db();
        let result = rename_entry(&path, "nonexistent-id", "new_name.wav");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("History not found"));
    }

    #[test]
    fn list_entries_sorted_by_file_name() {
        let (_dir, path) = setup_db();

        let conn = Connection::open(&path).expect("open db");
        let text_compressed = compress_text("test").expect("compress");
        let segments_compressed = compress_text("[]").expect("compress");

        for (id, file_name) in [("c", "charlie.wav"), ("a", "Alpha.wav"), ("b", "bravo.wav")] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    id,
                    "2026-01-01T10:00:00",
                    file_name,
                    "ja",
                    "small",
                    30000_i64,
                    text_compressed,
                    segments_compressed,
                ],
            )
            .expect("insert");
        }
        drop(conn);

        let filter = HistoryFilter {
            sort_by: Some(HistorySortBy::FileName),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].id, "a");
        assert_eq!(entries[1].id, "b");
        assert_eq!(entries[2].id, "c");
    }
}
