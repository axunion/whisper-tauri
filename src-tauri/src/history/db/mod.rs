pub mod ai_content;
pub mod compression;
pub mod entries;
pub mod rows;
pub mod time;

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::error::HistoryError;

pub(crate) use ai_content::{get_ai_content, get_all_ai_content, save_ai_content};
pub(crate) use compression::decompress_text;
pub(crate) use entries::{
    delete_all_entries, delete_entries, get_entry, list_entries, push_paging, rename_entry,
    save_entry, sort_clause, update_segment,
};
pub(crate) use rows::{meta_from_row_matching, meta_row_mapper};

/// Returns the path to the history database file.
#[must_use]
pub(crate) fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("history.db")
}

/// Opens a connection with foreign-key enforcement enabled.
///
/// The `foreign_keys` pragma is connection-scoped and stock `SQLite`
/// defaults it to OFF, so every connection must opt in for the FK constraint
/// (and `ON DELETE CASCADE` on `ai_content`) to be enforced. Always open
/// history-db connections through this helper.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the database cannot be opened.
pub(crate) fn open_connection(db_path: &Path) -> Result<Connection, HistoryError> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(conn)
}

/// Returns `true` when the column was actually added, i.e. an existing database
/// was just migrated — the caller can use that to run a one-time backfill.
fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<bool, HistoryError> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name == column);

    if exists {
        return Ok(false);
    }

    conn.execute(
        &format!("ALTER TABLE {table} ADD COLUMN {column} {column_def}"),
        [],
    )?;
    Ok(true)
}

/// A schema migration step. Runs inside a transaction that also records the
/// new version, so a failed step leaves the database at the previous version.
type Migration = fn(&Connection) -> Result<(), HistoryError>;

/// Schema migrations in order; `PRAGMA user_version` counts how many have run.
///
/// Append new steps — never edit or reorder a released one, since databases
/// that already ran it will not run it again.
const MIGRATIONS: &[Migration] = &[migrate_v1_baseline, migrate_v2_text_preview];

/// Initializes the history database, bringing its schema up to date.
///
/// # Errors
///
/// Returns `HistoryError::Database` if the database cannot be opened or migrated.
pub(crate) fn init_db(db_path: &Path) -> Result<(), HistoryError> {
    let conn = open_connection(db_path)?;
    let applied: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let applied = usize::try_from(applied).unwrap_or(0);

    for (index, migrate) in MIGRATIONS.iter().enumerate().skip(applied) {
        let tx = conn.unchecked_transaction()?;
        migrate(&tx)?;
        tx.pragma_update(None, "user_version", index + 1)?;
        tx.commit()?;
    }

    Ok(())
}

/// Version 1: the schema as it stood when versioning was introduced.
///
/// Databases created before that carry `user_version` 0 in any of several
/// shapes (with or without `vad_enabled`, `source`, the FTS table), so every
/// statement here is conditional and the step is safe to run over all of them.
fn migrate_v1_baseline(conn: &Connection) -> Result<(), HistoryError> {
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
            vad_enabled INTEGER,
            source TEXT NOT NULL DEFAULT 'file'
        );
        CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);",
    )?;

    add_column_if_missing(conn, "history", "vad_enabled", "INTEGER")?;

    // Rows written before `source` existed carry the old convention that
    // recordings were saved without a file extension. Backfill once from that,
    // then the column — not the file name — is the source of truth.
    if add_column_if_missing(conn, "history", "source", "TEXT NOT NULL DEFAULT 'file'")? {
        conn.execute(
            "UPDATE history SET source = ?1 WHERE instr(file_name, '.') = 0",
            [super::types::HistorySource::Recording.as_str()],
        )?;
    }

    super::search::init_fts(conn)?;

    if super::search::needs_fts_migration(conn)? {
        super::search::rebuild_fts_index(conn)?;
    }

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

/// Version 2: stores each entry's list preview in `history.text_preview`, so
/// listing no longer decompresses every transcript to show its first line.
///
/// A transcript that cannot be decompressed keeps the empty default preview:
/// failing here would abort the migration on every launch and lock the whole
/// history for the sake of one bad row.
fn migrate_v2_text_preview(conn: &Connection) -> Result<(), HistoryError> {
    conn.execute_batch("ALTER TABLE history ADD COLUMN text_preview TEXT NOT NULL DEFAULT ''")?;

    let entries: Vec<(String, Vec<u8>)> = conn
        .prepare("SELECT id, text_compressed FROM history")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<_, _>>()?;
    for (id, text_compressed) in entries {
        let Ok(text) = decompress_text(&text_compressed) else {
            continue;
        };
        conn.execute(
            "UPDATE history SET text_preview = ?1 WHERE id = ?2",
            rusqlite::params![rows::stored_preview(&text), id],
        )?;
    }

    Ok(())
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use super::init_db;
    use crate::history::types::{
        AiContentSaveParams, HistorySaveParams, HistorySegment, HistorySource,
    };
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
            vad_enabled: Some(true),
            source: HistorySource::File,
        }
    }

    pub fn sample_ai_params(history_id: &str) -> AiContentSaveParams {
        AiContentSaveParams {
            history_id: history_id.to_string(),
            content_type: "summary".to_string(),
            text: "Summary text".to_string(),
            options_json: None,
            text_model_id: "gemma-4-e2b".to_string(),
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

    fn user_version(path: &Path) -> usize {
        Connection::open(path)
            .expect("open")
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("read user_version")
    }

    #[test]
    fn init_db_records_every_migration_as_applied() {
        let (_dir, path) = setup_db();
        assert_eq!(user_version(&path), MIGRATIONS.len());
    }

    #[test]
    fn init_db_leaves_a_newer_schema_version_alone() {
        let (_dir, path) = setup_db();
        let newer = MIGRATIONS.len() + 5;
        Connection::open(&path)
            .expect("open")
            .pragma_update(None, "user_version", newer)
            .expect("bump version");

        init_db(&path).expect("init over a newer database");

        assert_eq!(user_version(&path), newer);
    }

    #[test]
    fn init_db_backfills_source_from_the_legacy_file_name_convention() {
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
        let text_compressed = compression::compress_text("レガシー行").expect("compress");
        let segments_compressed = compression::compress_text("[]").expect("compress");
        for (id, file_name) in [("rec-1", "録音"), ("file-1", "audio.wav")] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, '2026-01-01T00:00:00Z', ?2, 'ja', 'small', 1000, ?3, ?4)",
                rusqlite::params![id, file_name, text_compressed, segments_compressed],
            )
            .expect("insert legacy row");
        }
        drop(conn);

        init_db(&path).expect("init db with migration");

        let read_source = |id: &str| -> String {
            Connection::open(&path)
                .expect("open")
                .query_row("SELECT source FROM history WHERE id = ?1", [id], |row| {
                    row.get(0)
                })
                .expect("read source")
        };
        assert_eq!(read_source("rec-1"), "recording");
        assert_eq!(read_source("file-1"), "file");

        // A second init must not re-run the backfill over corrected values.
        Connection::open(&path)
            .expect("open")
            .execute("UPDATE history SET source = 'file' WHERE id = 'rec-1'", [])
            .expect("correct source");
        init_db(&path).expect("second init");

        assert_eq!(read_source("rec-1"), "file");
    }

    #[test]
    fn init_db_backfills_text_preview_for_entries_saved_before_it_existed() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

        // Bring a database to version 1 only, then add a row the way v1 wrote it.
        let conn = open_connection(&path).expect("open");
        migrate_v1_baseline(&conn).expect("baseline");
        conn.pragma_update(None, "user_version", 1)
            .expect("mark v1");
        let long_text = "あ".repeat(250);
        for (id, text) in [("short", "短い本文"), ("long", long_text.as_str())] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, '2026-01-01T00:00:00', 'a.wav', 'ja', 'small', 1000, ?2, ?3)",
                rusqlite::params![
                    id,
                    compression::compress_text(text).expect("compress"),
                    compression::compress_text("[]").expect("compress"),
                ],
            )
            .expect("insert v1 row");
        }
        drop(conn);

        init_db(&path).expect("migrate to current");

        let entries =
            list_entries(&path, &crate::history::types::HistoryFilter::default()).expect("list");
        let preview = |id: &str| {
            entries
                .iter()
                .find(|e| e.id == id)
                .map(|e| e.text_preview.clone())
                .expect("entry listed")
        };
        assert_eq!(preview("short"), "短い本文");
        assert_eq!(preview("long"), format!("{}...", "あ".repeat(100)));
    }

    #[test]
    fn init_db_survives_an_undecodable_transcript_while_backfilling_previews() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

        let conn = open_connection(&path).expect("open");
        migrate_v1_baseline(&conn).expect("baseline");
        conn.pragma_update(None, "user_version", 1)
            .expect("mark v1");
        for (id, text_compressed) in [
            ("broken", b"not a compressed transcript".to_vec()),
            (
                "fine",
                compression::compress_text("無事な本文").expect("compress"),
            ),
        ] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, '2026-01-01T00:00:00', 'a.wav', 'ja', 'small', 1000, ?2, ?3)",
                rusqlite::params![
                    id,
                    text_compressed,
                    compression::compress_text("[]").expect("compress"),
                ],
            )
            .expect("insert v1 row");
        }
        drop(conn);

        init_db(&path).expect("one bad row must not block the migration");

        let entries =
            list_entries(&path, &crate::history::types::HistoryFilter::default()).expect("list");
        let preview = |id: &str| {
            entries
                .iter()
                .find(|e| e.id == id)
                .map(|e| e.text_preview.clone())
                .expect("entry listed")
        };
        assert_eq!(preview("broken"), "");
        assert_eq!(preview("fine"), "無事な本文");
    }

    #[test]
    fn init_db_migrates_pre_versioning_database_with_rows_and_fts() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

        // Pre-versioning shape: v1 tables and a populated FTS index, but
        // user_version left at 0.
        let conn = open_connection(&path).expect("open");
        migrate_v1_baseline(&conn).expect("baseline");
        let long_text = format!("{}予算の話{}", "あ".repeat(200), "い".repeat(200));
        for (id, text) in [("short", "短い本文"), ("long", long_text.as_str())] {
            conn.execute(
                "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
                 VALUES (?1, '2026-01-01T00:00:00', 'a.wav', 'ja', 'small', 1000, ?2, ?3)",
                rusqlite::params![
                    id,
                    compression::compress_text(text).expect("compress"),
                    compression::compress_text("[]").expect("compress"),
                ],
            )
            .expect("insert row");
            search::index_entry(&conn, id, text).expect("index");
        }
        drop(conn);
        assert_eq!(user_version(&path), 0);

        init_db(&path).expect("migrate to current");

        assert_eq!(user_version(&path), MIGRATIONS.len());
        let entries =
            list_entries(&path, &crate::history::types::HistoryFilter::default()).expect("list");
        let preview = |id: &str| {
            entries
                .iter()
                .find(|e| e.id == id)
                .map(|e| e.text_preview.clone())
                .expect("entry listed")
        };
        assert_eq!(preview("short"), "短い本文");
        assert_eq!(preview("long"), format!("{}...", "あ".repeat(100)));

        let conn = open_connection(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "予算".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                offset: None,
                sort_by: None,
                sort_order: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "long");
        assert!(results[0].text_preview.contains("予算"));
    }

    #[test]
    fn failed_migration_leaves_version_and_schema_unchanged() {
        let dir = tempfile::TempDir::new().expect("create temp dir");
        let path = dir.path().join("history.db");

        let conn = open_connection(&path).expect("open");
        migrate_v1_baseline(&conn).expect("baseline");
        conn.pragma_update(None, "user_version", 1)
            .expect("mark v1");
        conn.execute(
            "INSERT INTO history (id, created_at, file_name, language, model_id, duration, text_compressed, segments_compressed)
             VALUES ('row', '2026-01-01T00:00:00', 'a.wav', 'ja', 'small', 1000, ?1, ?2)",
            rusqlite::params![
                compression::compress_text("本文").expect("compress"),
                compression::compress_text("[]").expect("compress"),
            ],
        )
        .expect("insert row");
        // Fails the v2 backfill's UPDATE after its ALTER TABLE already ran.
        conn.execute_batch(
            "CREATE TRIGGER block_update BEFORE UPDATE ON history
             BEGIN SELECT RAISE(ABORT, 'blocked'); END;",
        )
        .expect("create trigger");
        drop(conn);

        assert!(init_db(&path).is_err());

        assert_eq!(user_version(&path), 1);
        let conn = Connection::open(&path).expect("open");
        let mut stmt = conn
            .prepare("PRAGMA table_info(history)")
            .expect("prepare pragma");
        let names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query")
            .filter_map(Result::ok)
            .collect();
        assert!(!names.contains(&"text_preview".to_string()));
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

        let text_compressed =
            compression::compress_text("マイグレーション対象テキスト").expect("compress");
        let segments_compressed = compression::compress_text("[]").expect("compress");
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

        init_db(&path).expect("init db with migration");

        let conn = Connection::open(&path).expect("open");
        let results = search::search_entries(
            &conn,
            &HistorySearchParams {
                query: "マイグレーション".to_string(),
                date_from: None,
                date_to: None,
                limit: None,
                offset: None,
                sort_by: None,
                sort_order: None,
            },
        )
        .expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "migrate-entry");
    }
}
