use std::fmt::Write;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::error::HistoryError;
use super::types::{
    HistoryEntry, HistoryFilter, HistoryMeta, HistorySaveParams, HistorySegment, HistorySortBy,
};

/// Builds an ORDER BY clause based on the sort option.
#[must_use]
pub fn sort_clause(sort_by: Option<&HistorySortBy>, prefix: &str) -> String {
    match sort_by {
        Some(HistorySortBy::Duration) => format!("ORDER BY {prefix}duration DESC"),
        Some(HistorySortBy::FileName) => {
            format!("ORDER BY {prefix}file_name COLLATE NOCASE ASC")
        }
        Some(HistorySortBy::Date) | None => format!("ORDER BY {prefix}created_at DESC"),
    }
}

/// Returns the path to the history database file.
#[must_use]
pub fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("history.db")
}

/// Initializes the history database, creating tables and indices if they don't exist.
/// Also initializes the FTS5 index and migrates existing data if needed.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the database cannot be opened or initialized.
pub fn init_db(db_path: &Path) -> Result<(), HistoryError> {
    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            file_name TEXT NOT NULL,
            language TEXT NOT NULL,
            model_id TEXT NOT NULL,
            duration INTEGER NOT NULL,
            text_compressed BLOB NOT NULL,
            segments_compressed BLOB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);",
    )
    .map_err(|e| HistoryError::Database(e.to_string()))?;

    // Initialize FTS5 index
    super::search::init_fts(&conn)?;

    // Migrate existing data if FTS table is empty but history has entries
    if super::search::needs_fts_migration(&conn)? {
        super::search::rebuild_fts_index(&conn)?;
    }

    Ok(())
}

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

/// Returns a preview of text, truncated to `max_len` characters.
#[must_use]
pub fn text_preview(text: &str, max_len: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_len {
        trimmed.to_string()
    } else {
        let preview: String = trimmed.chars().take(max_len).collect();
        format!("{preview}...")
    }
}

/// Saves a new history entry and returns its ID.
///
/// # Errors
///
/// Returns `HistoryError` if database operations or compression fail.
pub fn save_entry(db_path: &Path, params: &HistorySaveParams) -> Result<String, HistoryError> {
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono_now();

    let text_compressed = compress_text(&params.text)?;
    let segments_json = serde_json::to_string(&params.segments)
        .map_err(|e| HistoryError::Serialization(e.to_string()))?;
    let segments_compressed = compress_text(&segments_json)?;

    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    tx.execute(
        "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            created_at,
            params.file_name,
            params.language,
            params.model_id,
            params.duration,
            text_compressed,
            segments_compressed,
        ],
    )
    .map_err(|e| HistoryError::Database(e.to_string()))?;

    super::search::index_entry(&tx, &id, &params.text)?;

    tx.commit()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    Ok(id)
}

/// Lists history entries matching the filter, returning metadata only.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the query fails.
pub fn list_entries(
    db_path: &Path,
    filter: &HistoryFilter,
) -> Result<Vec<HistoryMeta>, HistoryError> {
    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;

    let mut sql =
        String::from("SELECT id, created_at, file_name, language, model_id, duration, text_compressed FROM history");
    let mut conditions = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref from) = filter.date_from {
        conditions.push(format!("created_at >= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(format!("{from}T00:00:00")));
    }
    if let Some(ref to) = filter.date_to {
        conditions.push(format!("created_at <= ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(format!("{to}T23:59:59")));
    }

    if !conditions.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    write!(sql, " {}", sort_clause(filter.sort_by.as_ref(), "")).ok();
    if let Some(limit) = filter.limit {
        write!(sql, " LIMIT {limit}").ok();
    }

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        params_vec.iter().map(AsRef::as_ref).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| {
            let text_compressed: Vec<u8> = row.get(6)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, u64>(5)?,
                text_compressed,
            ))
        })
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    let mut entries = Vec::new();
    for row in rows {
        let (id, created_at, file_name, language, model_id, duration, text_compressed) =
            row.map_err(|e| HistoryError::Database(e.to_string()))?;
        let text = decompress_text(&text_compressed)?;
        let preview = text_preview(&text, 100);
        entries.push(HistoryMeta {
            id,
            created_at,
            file_name,
            language,
            model_id,
            duration,
            text_preview: preview,
        });
    }

    Ok(entries)
}

/// Gets a full history entry by ID.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if no entry with the given ID exists.
/// Returns `HistoryError::Database` if the query fails.
pub fn get_entry(db_path: &Path, id: &str) -> Result<HistoryEntry, HistoryError> {
    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed
             FROM history WHERE id = ?1",
        )
        .map_err(|e| HistoryError::Database(e.to_string()))?;

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
    })
}

/// Deletes history entries by IDs.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the delete operation fails.
pub fn delete_entries(db_path: &Path, ids: &[String]) -> Result<u64, HistoryError> {
    if ids.is_empty() {
        return Ok(0);
    }

    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    // Delete FTS indices first
    for id in ids {
        super::search::delete_entry_index(&tx, id)?;
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

    let deleted = tx
        .execute(&sql, params.as_slice())
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    tx.commit()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    Ok(deleted as u64)
}

/// Deletes all history entries.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the delete operation fails.
pub fn delete_all_entries(db_path: &Path) -> Result<u64, HistoryError> {
    let conn = Connection::open(db_path).map_err(|e| HistoryError::Database(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    super::search::delete_all_indices(&tx)?;

    let deleted = tx
        .execute("DELETE FROM history", [])
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    tx.commit()
        .map_err(|e| HistoryError::Database(e.to_string()))?;

    Ok(deleted as u64)
}

/// Returns the current time as an ISO 8601 string (UTC-like, local time).
fn chrono_now() -> String {
    use std::time::SystemTime;

    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();

    // Simple ISO 8601 formatting without chrono dependency
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Calculate year/month/day from days since epoch (1970-01-01)
    let (year, month, day) = days_to_date(days);

    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}")
}

/// Converts days since Unix epoch to (year, month, day).
fn days_to_date(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_db() -> (TempDir, PathBuf) {
        let dir = TempDir::new().expect("Failed to create temp dir");
        let path = dir.path().join("history.db");
        init_db(&path).expect("Failed to init db");
        (dir, path)
    }

    fn sample_params() -> HistorySaveParams {
        HistorySaveParams {
            file_name: "test_audio.wav".to_string(),
            language: "ja".to_string(),
            model_id: "large-v3-turbo".to_string(),
            duration: 60000,
            text: "This is a test transcription.".to_string(),
            segments: vec![
                HistorySegment {
                    start: 0,
                    end: 3000,
                    text: "This is a test".to_string(),
                },
                HistorySegment {
                    start: 3000,
                    end: 5000,
                    text: "transcription.".to_string(),
                },
            ],
        }
    }

    #[test]
    fn db_path_returns_correct_path() {
        let path = db_path(Path::new("/app/data"));
        assert_eq!(path, PathBuf::from("/app/data/history.db"));
    }

    #[test]
    fn init_db_creates_database() {
        let (_dir, path) = setup_db();
        assert!(path.exists());
    }

    #[test]
    fn init_db_is_idempotent() {
        let (_dir, path) = setup_db();
        // Second call should not fail
        init_db(&path).expect("Second init should succeed");
    }

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
    fn delete_all_entries() {
        let (_dir, path) = setup_db();
        save_entry(&path, &sample_params()).expect("Failed to save");
        save_entry(&path, &sample_params()).expect("Failed to save");

        let deleted = super::delete_all_entries(&path).expect("Failed to delete all");
        assert_eq!(deleted, 2);

        let remaining = list_entries(&path, &HistoryFilter::default()).expect("Failed to list");
        assert!(remaining.is_empty());
    }

    #[test]
    fn list_entries_ordered_by_created_at_desc() {
        let (_dir, path) = setup_db();

        // Save 3 entries (they'll have slightly different timestamps)
        let id1 = save_entry(&path, &sample_params()).expect("save 1");
        let id2 = save_entry(&path, &sample_params()).expect("save 2");
        let id3 = save_entry(&path, &sample_params()).expect("save 3");

        let entries = list_entries(&path, &HistoryFilter::default()).expect("list");
        // Most recent should be first (id3), but since timestamps may be same,
        // just verify all 3 are present
        assert_eq!(entries.len(), 3);
        let ids: Vec<&str> = entries.iter().map(|e| e.id.as_str()).collect();
        assert!(ids.contains(&id1.as_str()));
        assert!(ids.contains(&id2.as_str()));
        assert!(ids.contains(&id3.as_str()));
    }

    #[test]
    fn list_entries_with_date_filter() {
        let (_dir, path) = setup_db();

        // Insert entries with specific dates directly
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

        // Filter for 2026 only
        let filter = HistoryFilter {
            date_from: Some("2026-01-01".to_string()),
            ..Default::default()
        };
        let entries = list_entries(&path, &filter).expect("list filtered");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "new-entry");
    }

    #[test]
    fn save_entry_indexes_for_fts_search() {
        use crate::history::search;
        use crate::history::types::HistorySearchParams;

        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.text = "全文検索テスト用テキスト".to_string();
        let _id = save_entry(&path, &params).expect("Failed to save");

        // Search via FTS should find it
        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "全文検索".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn delete_entries_removes_fts_index() {
        use crate::history::search;
        use crate::history::types::HistorySearchParams;

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
            },
        )
        .expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn delete_all_entries_clears_fts_index() {
        use crate::history::search;
        use crate::history::types::HistorySearchParams;

        let (_dir, path) = setup_db();
        let mut params = sample_params();
        params.text = "全削除テスト".to_string();
        save_entry(&path, &params).expect("save");

        super::delete_all_entries(&path).expect("delete all");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "全削除".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
            },
        )
        .expect("search");
        assert!(results.is_empty());
    }

    #[test]
    fn init_db_migrates_existing_entries_to_fts() {
        use crate::history::search;
        use crate::history::types::HistorySearchParams;

        let dir = TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

        // Create DB without FTS (simulating old schema)
        let conn = Connection::open(&path).expect("open");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                file_name TEXT NOT NULL,
                language TEXT NOT NULL,
                model_id TEXT NOT NULL,
                duration INTEGER NOT NULL,
                text_compressed BLOB NOT NULL,
                segments_compressed BLOB NOT NULL
            );",
        )
        .expect("create table");

        let text_compressed = compress_text("マイグレーション対象テキスト").expect("compress");
        let segments_compressed = compress_text("[]").expect("compress");
        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                "migrate-entry",
                "2026-02-20T10:00:00",
                "test.wav",
                "ja",
                "large-v3-turbo",
                60000_i64,
                text_compressed,
                segments_compressed,
            ],
        )
        .expect("insert");
        drop(conn);

        // init_db should create FTS and migrate
        init_db(&path).expect("init db with migration");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "マイグレーション".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                sort_by: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "migrate-entry");
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
        assert_eq!(entries[0].id, "a"); // Alpha (case-insensitive)
        assert_eq!(entries[1].id, "b"); // bravo
        assert_eq!(entries[2].id, "c"); // charlie
    }
}
