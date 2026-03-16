use std::fmt::Write;

use rusqlite::Connection;

use super::error::HistoryError;
use super::types::{HistoryMeta, HistorySearchParams};

/// Initializes the FTS5 virtual table for full-text search.
///
/// Uses the trigram tokenizer for language-agnostic substring matching
/// (works with Japanese, English, etc. without a morphological analyzer).
///
/// # Errors
///
/// Returns `HistoryError::Database` if the table cannot be created.
pub fn init_fts(conn: &Connection) -> Result<(), HistoryError> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
            history_id UNINDEXED,
            text,
            tokenize='trigram'
        );",
    )?;
    Ok(())
}

/// Adds a text entry to the FTS index.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the index entry cannot be inserted.
pub fn index_entry(conn: &Connection, id: &str, text: &str) -> Result<(), HistoryError> {
    conn.execute(
        "INSERT INTO history_fts (history_id, text) VALUES (?1, ?2)",
        rusqlite::params![id, text],
    )?;
    Ok(())
}

/// Removes an entry from the FTS index.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the index entry cannot be deleted.
pub fn delete_entry_index(conn: &Connection, id: &str) -> Result<(), HistoryError> {
    conn.execute(
        "DELETE FROM history_fts WHERE history_id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

/// Removes all entries from the FTS index.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the index cannot be cleared.
pub fn delete_all_indices(conn: &Connection) -> Result<(), HistoryError> {
    conn.execute("DELETE FROM history_fts", [])?;
    Ok(())
}

/// Builds a FTS5 query string from user input.
///
/// Splits the query by whitespace and joins with AND.
/// Each keyword is wrapped in double quotes for exact substring matching.
fn build_fts_query(query: &str) -> String {
    let keywords: Vec<String> = query
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .map(|s| {
            let escaped = s.replace('"', "\"\"");
            format!("\"{escaped}\"")
        })
        .collect();
    keywords.join(" AND ")
}

/// Searches history entries using FTS5, optionally filtered by date range.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the search query fails.
pub fn search_entries(
    conn: &Connection,
    params: &HistorySearchParams,
) -> Result<Vec<HistoryMeta>, HistoryError> {
    let fts_query = build_fts_query(&params.query);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let mut sql = String::from(
        "SELECT h.id, h.created_at, h.file_name, h.language, h.model_id, h.duration, h.text_compressed
         FROM history_fts f
         JOIN history h ON h.id = f.history_id
         WHERE history_fts MATCH ?1",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    param_values.push(Box::new(fts_query));

    if let Some(ref from) = params.date_from {
        write!(sql, " AND h.created_at >= ?{}", param_values.len() + 1).ok();
        param_values.push(Box::new(format!("{from}T00:00:00")));
    }
    if let Some(ref to) = params.date_to {
        write!(sql, " AND h.created_at <= ?{}", param_values.len() + 1).ok();
        param_values.push(Box::new(format!("{to}T23:59:59")));
    }

    write!(
        sql,
        " {}",
        super::db::sort_clause(params.sort_by.as_ref(), params.sort_order.as_ref(), "h.")
    )
    .ok();
    if let Some(limit) = params.limit {
        write!(sql, " LIMIT {limit}").ok();
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(AsRef::as_ref).collect();

    let mut stmt = conn.prepare(&sql)?;

    let rows = stmt.query_map(param_refs.as_slice(), super::db::meta_row_mapper)?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(super::db::meta_from_row(row?)?);
    }

    Ok(entries)
}

/// Rebuilds the FTS index from all existing history entries.
///
/// Used for migration when FTS is first enabled on an existing database.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the rebuild fails.
pub fn rebuild_fts_index(conn: &Connection) -> Result<(), HistoryError> {
    // Clear existing index
    delete_all_indices(conn)?;

    // Re-index all entries
    let mut stmt = conn.prepare("SELECT id, text_compressed FROM history")?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
    })?;

    for row in rows {
        let (id, text_compressed) = row?;
        let text = super::db::decompress_text(&text_compressed)?;
        index_entry(conn, &id, &text)?;
    }

    Ok(())
}

/// Checks if the FTS table needs to be populated (migration case).
///
/// Returns true if the history table has rows but `history_fts` is empty.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the query fails.
pub fn needs_fts_migration(conn: &Connection) -> Result<bool, HistoryError> {
    let history_count: u64 =
        conn.query_row("SELECT COUNT(*) FROM history", [], |row| row.get(0))?;

    if history_count == 0 {
        return Ok(false);
    }

    let fts_count: u64 =
        conn.query_row("SELECT COUNT(*) FROM history_fts", [], |row| row.get(0))?;

    Ok(fts_count == 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::db::{compress_text, init_db};
    use tempfile::TempDir;

    fn setup() -> (TempDir, Connection) {
        let dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = dir.path().join("history.db");
        init_db(&db_path).expect("Failed to init db");
        let conn = Connection::open(&db_path).expect("Failed to open db");
        init_fts(&conn).expect("Failed to init fts");
        (dir, conn)
    }

    fn insert_history(conn: &Connection, id: &str, text: &str, created_at: &str) {
        let text_compressed = compress_text(text).expect("compress");
        let segments_compressed = compress_text("[]").expect("compress segments");
        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id,
                created_at,
                "test.wav",
                "ja",
                "large-v3-turbo",
                60000_i64,
                text_compressed,
                segments_compressed,
            ],
        )
        .expect("insert history");
    }

    #[test]
    fn init_fts_creates_table() {
        let (_dir, _conn) = setup();
        // If we get here without error, the table was created
    }

    #[test]
    fn init_fts_is_idempotent() {
        let (_dir, conn) = setup();
        // Second call should not fail
        init_fts(&conn).expect("Second init should succeed");
    }

    #[test]
    fn index_and_search_entry() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "今日の会議の議事録です",
            "2026-02-20T10:00:00",
        );
        index_entry(&conn, "entry-1", "今日の会議の議事録です").expect("index");

        // trigram tokenizer requires at least 3 characters
        let params = HistorySearchParams {
            query: "会議の".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "entry-1");
    }

    #[test]
    fn search_japanese_text() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "音声文字起こしのテスト",
            "2026-02-20T10:00:00",
        );
        index_entry(&conn, "entry-1", "音声文字起こしのテスト").expect("index");

        let params = HistorySearchParams {
            query: "文字起こし".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_multiple_keywords_and() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "会議の議事録を作成しました",
            "2026-02-20T10:00:00",
        );
        insert_history(
            &conn,
            "entry-2",
            "会議に参加しました",
            "2026-02-20T11:00:00",
        );
        index_entry(&conn, "entry-1", "会議の議事録を作成しました").expect("index");
        index_entry(&conn, "entry-2", "会議に参加しました").expect("index");

        // trigram tokenizer requires at least 3 characters per keyword
        let params = HistorySearchParams {
            query: "会議の 議事録".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "entry-1");
    }

    #[test]
    fn search_no_match_returns_empty() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "今日の天気は晴れです",
            "2026-02-20T10:00:00",
        );
        index_entry(&conn, "entry-1", "今日の天気は晴れです").expect("index");

        let params = HistorySearchParams {
            query: "会議の議".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn search_empty_query_returns_empty() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "テストデータ", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "テストデータ").expect("index");

        let params = HistorySearchParams {
            query: "   ".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn delete_entry_index_removes_from_search() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "削除テストデータ", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "削除テストデータ").expect("index");

        // Verify it's findable (trigram requires >= 3 chars)
        let params = HistorySearchParams {
            query: "削除テスト".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        assert_eq!(search_entries(&conn, &params).expect("search").len(), 1);

        // Delete and verify it's gone
        delete_entry_index(&conn, "entry-1").expect("delete index");
        assert!(search_entries(&conn, &params).expect("search").is_empty());
    }

    #[test]
    fn delete_all_indices_clears_index() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "テスト1", "2026-02-20T10:00:00");
        insert_history(&conn, "entry-2", "テスト2", "2026-02-20T11:00:00");
        index_entry(&conn, "entry-1", "テスト1").expect("index");
        index_entry(&conn, "entry-2", "テスト2").expect("index");

        delete_all_indices(&conn).expect("delete all");

        let params = HistorySearchParams {
            query: "テスト".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        assert!(search_entries(&conn, &params).expect("search").is_empty());
    }

    #[test]
    fn search_with_date_filter() {
        let (_dir, conn) = setup();
        insert_history(&conn, "old", "テストデータ古い", "2025-06-15T10:00:00");
        insert_history(&conn, "new", "テストデータ新しい", "2026-06-15T10:00:00");
        index_entry(&conn, "old", "テストデータ古い").expect("index");
        index_entry(&conn, "new", "テストデータ新しい").expect("index");

        // Search with date_from only
        let params = HistorySearchParams {
            query: "テストデータ".to_string(),
            date_from: Some("2026-01-01".to_string()),
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "new");

        // Search with date_to only
        let params = HistorySearchParams {
            query: "テストデータ".to_string(),
            date_from: None,
            date_to: Some("2025-12-31".to_string()),
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "old");

        // Search with both
        let params = HistorySearchParams {
            query: "テストデータ".to_string(),
            date_from: Some("2026-01-01".to_string()),
            date_to: Some("2026-12-31".to_string()),
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "new");
    }

    #[test]
    fn rebuild_fts_index_migrates_existing_data() {
        let (_dir, conn) = setup();
        // Insert data without indexing
        insert_history(
            &conn,
            "entry-1",
            "マイグレーションテスト",
            "2026-02-20T10:00:00",
        );
        insert_history(&conn, "entry-2", "別のエントリ", "2026-02-20T11:00:00");

        // Rebuild should index all existing data
        rebuild_fts_index(&conn).expect("rebuild");

        let params = HistorySearchParams {
            query: "マイグレーション".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "entry-1");
    }

    #[test]
    fn needs_fts_migration_empty_db() {
        let (_dir, conn) = setup();
        assert!(!needs_fts_migration(&conn).expect("check migration"));
    }

    #[test]
    fn needs_fts_migration_with_unindexed_data() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "テスト", "2026-02-20T10:00:00");
        assert!(needs_fts_migration(&conn).expect("check migration"));
    }

    #[test]
    fn needs_fts_migration_already_indexed() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "テスト", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "テスト").expect("index");
        assert!(!needs_fts_migration(&conn).expect("check migration"));
    }

    #[test]
    fn search_english_text() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "The quick brown fox jumps over the lazy dog",
            "2026-02-20T10:00:00",
        );
        index_entry(
            &conn,
            "entry-1",
            "The quick brown fox jumps over the lazy dog",
        )
        .expect("index");

        let params = HistorySearchParams {
            query: "brown fox".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn build_fts_query_single_keyword() {
        assert_eq!(build_fts_query("会議"), "\"会議\"");
    }

    #[test]
    fn build_fts_query_multiple_keywords() {
        assert_eq!(build_fts_query("会議 議事録"), "\"会議\" AND \"議事録\"");
    }

    #[test]
    fn build_fts_query_extra_whitespace() {
        assert_eq!(
            build_fts_query("  会議   議事録  "),
            "\"会議\" AND \"議事録\""
        );
    }

    #[test]
    fn build_fts_query_empty() {
        assert_eq!(build_fts_query(""), "");
        assert_eq!(build_fts_query("   "), "");
    }

    #[test]
    fn search_entries_with_limit() {
        let (_dir, conn) = setup();
        for i in 0..5 {
            let id = format!("entry-{i}");
            let text = format!("検索対象テキスト{i}");
            let created_at = format!("2026-02-20T1{i}:00:00");
            insert_history(&conn, &id, &text, &created_at);
            index_entry(&conn, &id, &text).expect("index");
        }

        let params = HistorySearchParams {
            query: "検索対象".to_string(),
            date_from: None,
            date_to: None,
            limit: Some(3),
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn search_entries_without_limit_returns_all() {
        let (_dir, conn) = setup();
        for i in 0..5 {
            let id = format!("entry-{i}");
            let text = format!("全件取得テスト{i}");
            let created_at = format!("2026-02-20T1{i}:00:00");
            insert_history(&conn, &id, &text, &created_at);
            index_entry(&conn, &id, &text).expect("index");
        }

        let params = HistorySearchParams {
            query: "全件取得".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 5);
    }
}
