use std::fmt::Write;

use rusqlite::Connection;

use super::error::HistoryError;
use super::types::{HistoryMeta, HistorySearchParams};

/// Initializes the `history_fts` table that holds each entry's uncompressed text.
///
/// Searching scans this text with `LIKE` (see [`search_entries`]); the trigram
/// index the table also maintains is not queried.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the table cannot be created.
pub(crate) fn init_fts(conn: &Connection) -> Result<(), HistoryError> {
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
pub(crate) fn index_entry(conn: &Connection, id: &str, text: &str) -> Result<(), HistoryError> {
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
pub(crate) fn delete_entry_index(conn: &Connection, id: &str) -> Result<(), HistoryError> {
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
pub(crate) fn delete_all_indices(conn: &Connection) -> Result<(), HistoryError> {
    conn.execute("DELETE FROM history_fts", [])?;
    Ok(())
}

/// Splits user input into whitespace-separated keywords.
fn parse_keywords(query: &str) -> Vec<String> {
    query.split_whitespace().map(str::to_string).collect()
}

/// Wraps a keyword into a `LIKE` substring pattern, escaping the wildcard
/// characters with `\` (the queries pair this with `ESCAPE '\'`).
fn like_pattern(keyword: &str) -> String {
    let mut pattern = String::with_capacity(keyword.len() + 2);
    pattern.push('%');
    for c in keyword.chars() {
        if matches!(c, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(c);
    }
    pattern.push('%');
    pattern
}

/// Searches history entries, optionally filtered by date range.
///
/// Every keyword must appear in the transcript or the file name. Matching is
/// `LIKE` over the uncompressed text held in `history_fts` rather than FTS5
/// `MATCH`: the trigram tokenizer cannot match keywords shorter than three
/// characters, which rules out most two-kanji Japanese words ("会議", "予算").
/// A scan is cheap at the size of a personal history.
///
/// The preview of each result is an excerpt around the first keyword hit.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the search query fails.
pub(crate) fn search_entries(
    conn: &Connection,
    params: &HistorySearchParams,
) -> Result<Vec<HistoryMeta>, HistoryError> {
    let keywords = parse_keywords(&params.query);
    if keywords.is_empty() {
        return Ok(Vec::new());
    }

    let mut sql = String::from(
        "SELECT h.id, h.created_at, h.file_name, h.language, h.model_id, h.duration, h.text_preview, h.vad_enabled, h.source, f.text
         FROM history_fts f
         JOIN history h ON h.id = f.history_id
         WHERE 1 = 1",
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    for keyword in &keywords {
        let n = param_values.len() + 1;
        write!(
            sql,
            " AND (f.text LIKE ?{n} ESCAPE '\\' OR h.file_name LIKE ?{n} ESCAPE '\\')"
        )
        .ok();
        param_values.push(Box::new(like_pattern(keyword)));
    }

    if let Some(ref from) = params.date_from {
        write!(sql, " AND h.created_at >= ?{}", param_values.len() + 1).ok();
        param_values.push(Box::new(from.clone()));
    }
    if let Some(ref to) = params.date_to {
        write!(sql, " AND h.created_at < ?{}", param_values.len() + 1).ok();
        param_values.push(Box::new(to.clone()));
    }

    write!(
        sql,
        " {}",
        super::db::sort_clause(params.sort_by.as_ref(), params.sort_order.as_ref(), "h.")
    )
    .ok();
    super::db::push_paging(&mut sql, &mut param_values, params.limit, params.offset);

    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(AsRef::as_ref).collect();

    let mut stmt = conn.prepare(&sql)?;

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok((super::db::meta_row_mapper(row)?, row.get::<_, String>(9)?))
    })?;

    let mut entries = Vec::new();
    for row in rows {
        let (meta, text) = row?;
        entries.push(super::db::meta_from_row_matching(meta, &text, &keywords));
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
pub(crate) fn rebuild_fts_index(conn: &Connection) -> Result<(), HistoryError> {
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
pub(crate) fn needs_fts_migration(conn: &Connection) -> Result<bool, HistoryError> {
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
    use crate::history::db::{compression::compress_text, init_db};
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

        let params = HistorySearchParams {
            query: "会議の".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            offset: None,
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
            offset: None,
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

        let params = HistorySearchParams {
            query: "会議の 議事録".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "entry-1");
    }

    fn search_params(query: &str) -> HistorySearchParams {
        HistorySearchParams {
            query: query.to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            offset: None,
            sort_by: None,
            sort_order: None,
        }
    }

    #[test]
    fn search_matches_two_character_keyword() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "今日の会議の議事録です",
            "2026-02-20T10:00:00",
        );
        insert_history(&conn, "entry-2", "天気の話です", "2026-02-20T11:00:00");
        index_entry(&conn, "entry-1", "今日の会議の議事録です").expect("index");
        index_entry(&conn, "entry-2", "天気の話です").expect("index");

        let results = search_entries(&conn, &search_params("会議")).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "entry-1");
    }

    #[test]
    fn search_matches_single_character_keyword() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "税の話", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "税の話").expect("index");

        let results = search_entries(&conn, &search_params("税")).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_short_keywords_are_anded_with_long_ones() {
        let (_dir, conn) = setup();
        insert_history(&conn, "both", "会議の議事録です", "2026-02-20T10:00:00");
        insert_history(&conn, "one", "議事録だけです", "2026-02-20T11:00:00");
        index_entry(&conn, "both", "会議の議事録です").expect("index");
        index_entry(&conn, "one", "議事録だけです").expect("index");

        let results = search_entries(&conn, &search_params("会議 議事録")).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "both");
    }

    #[test]
    fn search_matches_file_name() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "本文です", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "本文です").expect("index");

        // insert_history names every entry "test.wav".
        let results = search_entries(&conn, &search_params("test")).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_treats_like_wildcards_literally() {
        let (_dir, conn) = setup();
        insert_history(&conn, "percent", "達成率は100%です", "2026-02-20T10:00:00");
        insert_history(&conn, "plain", "達成率は高いです", "2026-02-20T11:00:00");
        index_entry(&conn, "percent", "達成率は100%です").expect("index");
        index_entry(&conn, "plain", "達成率は高いです").expect("index");

        let results = search_entries(&conn, &search_params("%")).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "percent");

        let underscore = search_entries(&conn, &search_params("_")).expect("search");
        assert_eq!(underscore.len(), 0);
    }

    #[test]
    fn search_is_ascii_case_insensitive() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "entry-1",
            "The Quick Brown Fox",
            "2026-02-20T10:00:00",
        );
        index_entry(&conn, "entry-1", "The Quick Brown Fox").expect("index");

        let results = search_entries(&conn, &search_params("quick")).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_preview_is_an_excerpt_around_the_hit() {
        let (_dir, conn) = setup();
        let text = format!(
            "{}ここで予算の話をします{}",
            "あ".repeat(300),
            "い".repeat(300)
        );
        insert_history(&conn, "entry-1", &text, "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", &text).expect("index");

        let results = search_entries(&conn, &search_params("予算")).expect("search");
        assert_eq!(results.len(), 1);
        assert!(results[0].text_preview.contains("予算"));
        assert!(results[0].text_preview.starts_with("..."));
        assert!(results[0].text_preview.ends_with("..."));
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
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 0);
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
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn delete_entry_index_removes_from_search() {
        let (_dir, conn) = setup();
        insert_history(&conn, "entry-1", "削除テストデータ", "2026-02-20T10:00:00");
        index_entry(&conn, "entry-1", "削除テストデータ").expect("index");

        // Verify it's findable
        let params = HistorySearchParams {
            query: "削除テスト".to_string(),
            date_from: None,
            date_to: None,
            limit: None,
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        assert_eq!(search_entries(&conn, &params).expect("search").len(), 1);

        // Delete and verify it's gone
        delete_entry_index(&conn, "entry-1").expect("delete index");
        assert_eq!(search_entries(&conn, &params).expect("search").len(), 0);
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
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        assert_eq!(search_entries(&conn, &params).expect("search").len(), 0);
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
            offset: None,
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
            offset: None,
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
            offset: None,
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
            offset: None,
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
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn parse_keywords_splits_on_whitespace() {
        assert_eq!(
            parse_keywords("  議事録   作成した  "),
            ["議事録", "作成した"]
        );
        assert_eq!(parse_keywords("   ").len(), 0);
    }

    #[test]
    fn like_pattern_escapes_wildcards() {
        assert_eq!(like_pattern("会議"), "%会議%");
        assert_eq!(like_pattern("100%"), "%100\\%%");
        assert_eq!(like_pattern("a_b"), "%a\\_b%");
        assert_eq!(like_pattern("a\\b"), "%a\\\\b%");
    }

    #[test]
    fn search_entries_pages_with_limit_and_offset() {
        let (_dir, conn) = setup();
        for i in 0..5 {
            let id = format!("entry-{i}");
            let text = format!("検索対象テキスト{i}");
            let created_at = format!("2026-02-20T1{i}:00:00");
            insert_history(&conn, &id, &text, &created_at);
            index_entry(&conn, &id, &text).expect("index");
        }

        // Newest first: entry-4, entry-3 | entry-2, entry-1 | entry-0
        let page = |offset: u32| {
            let params = HistorySearchParams {
                query: "検索対象".to_string(),
                limit: Some(2),
                offset: Some(offset),
                ..Default::default()
            };
            search_entries(&conn, &params)
                .expect("search")
                .into_iter()
                .map(|e| e.id)
                .collect::<Vec<_>>()
        };
        assert_eq!(page(0), ["entry-4", "entry-3"]);
        assert_eq!(page(2), ["entry-2", "entry-1"]);
        assert_eq!(page(4), ["entry-0"]);
        assert_eq!(page(6).len(), 0);
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
            offset: None,
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
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 5);
    }

    #[test]
    fn search_matches_keyword_containing_backslash_or_quote() {
        let (_dir, conn) = setup();
        insert_history(
            &conn,
            "backslash",
            r"保存先 C:\temp です",
            "2026-02-20T10:00:00",
        );
        insert_history(
            &conn,
            "quote",
            "彼は\"はい\"と答えた",
            "2026-02-20T11:00:00",
        );
        insert_history(
            &conn,
            "plain",
            "保存先は別の場所です",
            "2026-02-20T12:00:00",
        );
        index_entry(&conn, "backslash", r"保存先 C:\temp です").expect("index");
        index_entry(&conn, "quote", "彼は\"はい\"と答えた").expect("index");
        index_entry(&conn, "plain", "保存先は別の場所です").expect("index");

        let backslash = search_entries(&conn, &search_params(r"\temp")).expect("search");
        assert_eq!(backslash.len(), 1);
        assert_eq!(backslash[0].id, "backslash");

        let lone_backslash = search_entries(&conn, &search_params(r"\")).expect("search");
        assert_eq!(lone_backslash.len(), 1);
        assert_eq!(lone_backslash[0].id, "backslash");

        let quote = search_entries(&conn, &search_params("\"はい\"")).expect("search");
        assert_eq!(quote.len(), 1);
        assert_eq!(quote[0].id, "quote");
    }

    #[test]
    fn search_keywords_may_hit_file_name_and_text_separately() {
        let (_dir, conn) = setup();
        // insert_history names every entry "test.wav".
        insert_history(&conn, "match", "議事録です", "2026-02-20T10:00:00");
        insert_history(&conn, "no-text", "会議です", "2026-02-20T11:00:00");
        index_entry(&conn, "match", "議事録です").expect("index");
        index_entry(&conn, "no-text", "会議です").expect("index");

        let results = search_entries(&conn, &search_params("test 議事録")).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "match");
    }

    #[test]
    fn search_short_keyword_combined_with_date_filter() {
        let (_dir, conn) = setup();
        insert_history(&conn, "old", "税の話 2025", "2025-06-15T10:00:00");
        insert_history(&conn, "new", "税の話 2026", "2026-06-15T10:00:00");
        index_entry(&conn, "old", "税の話 2025").expect("index");
        index_entry(&conn, "new", "税の話 2026").expect("index");

        let params = HistorySearchParams {
            query: "税".to_string(),
            date_from: Some("2026-01-01".to_string()),
            date_to: None,
            limit: None,
            offset: None,
            sort_by: None,
            sort_order: None,
        };
        let results = search_entries(&conn, &params).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "new");
    }
}
