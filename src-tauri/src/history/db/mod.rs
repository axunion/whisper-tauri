pub mod ai_content;
pub mod compression;
pub mod entries;
pub mod rows;
pub mod time;

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::error::HistoryError;

pub use ai_content::{get_ai_content, get_all_ai_content, save_ai_content};
pub use compression::{compress_text, decompress_text};
pub use entries::{
    delete_all_entries, delete_entries, get_entry, list_entries, rename_entry, save_entry,
    sort_clause,
};
pub use rows::{meta_from_row, meta_row_mapper};

/// Returns the path to the history database file.
#[must_use]
pub fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("history.db")
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    column_type: &str,
) -> Result<(), HistoryError> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name == column);

    if !exists {
        conn.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {column_type}"),
            [],
        )?;
    }

    Ok(())
}

/// Initializes the history database, creating tables and indices if they don't exist.
/// Also initializes the FTS5 index and migrates existing data if needed.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the database cannot be opened or initialized.
pub fn init_db(db_path: &Path) -> Result<(), HistoryError> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            file_name TEXT NOT NULL,
            language TEXT NOT NULL,
            model_id TEXT NOT NULL,
            duration INTEGER NOT NULL,
            text_compressed BLOB NOT NULL,
            segments_compressed BLOB NOT NULL,
            vad_enabled INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);",
    )?;

    add_column_if_missing(&conn, "history", "vad_enabled", "INTEGER")?;

    super::search::init_fts(&conn)?;

    if super::search::needs_fts_migration(&conn)? {
        super::search::rebuild_fts_index(&conn)?;
    }

    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ai_content (
            id TEXT PRIMARY KEY,
            history_id TEXT NOT NULL,
            content_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            text_compressed BLOB NOT NULL,
            options_json TEXT,
            text_model_id TEXT NOT NULL,
            UNIQUE(history_id, content_type),
            FOREIGN KEY (history_id) REFERENCES history(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ai_content_history ON ai_content(history_id);",
    )?;

    Ok(())
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use super::init_db;
    use crate::history::types::{HistorySaveParams, HistorySegment};
    use std::path::PathBuf;
    use tempfile::TempDir;

    pub fn setup_db() -> (TempDir, PathBuf) {
        let dir = TempDir::new().expect("Failed to create temp dir");
        let path = dir.path().join("history.db");
        init_db(&path).expect("Failed to init db");
        (dir, path)
    }

    pub fn sample_params() -> HistorySaveParams {
        HistorySaveParams {
            file_name: "test_audio.wav".to_string(),
            language: "ja".to_string(),
            model_id: "large-v3".to_string(),
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
            vad_enabled: Some(true),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::history::search;
    use crate::history::types::HistorySearchParams;
    use test_helpers::setup_db;

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
        init_db(&path).expect("Second init should succeed");
    }

    #[test]
    fn init_db_adds_vad_enabled_column_to_old_schema() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

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
        .expect("create old table");
        drop(conn);

        init_db(&path).expect("init db with migration");

        let conn = Connection::open(&path).expect("open");
        let mut stmt = conn
            .prepare("PRAGMA table_info(history)")
            .expect("prepare pragma");
        let names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query")
            .filter_map(Result::ok)
            .collect();
        assert!(names.contains(&"vad_enabled".to_string()));
    }

    #[test]
    fn init_db_migrates_existing_entries_to_fts() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
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
                "large-v3",
                60000_i64,
                text_compressed,
                segments_compressed,
            ],
        )
        .expect("insert");
        drop(conn);

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
                sort_order: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "migrate-entry");
    }
}
