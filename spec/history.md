# 履歴 (history)

Source: `src-tauri/src/history/` (`db/mod.rs` / `db/ai_content.rs` / `db/compression.rs` / `search.rs` / `commands.rs`)

文字起こし結果と AI 生成テキストを SQLite (`{app_data}/history.db`、rusqlite) に保存する。DB は最初のコマンド実行時に遅延初期化。

## スキーマ

```sql
CREATE TABLE history (
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
CREATE INDEX idx_history_created_at ON history(created_at);

CREATE TABLE ai_content (
    id TEXT PRIMARY KEY,
    history_id TEXT NOT NULL,
    content_type TEXT NOT NULL,        -- "summary" など
    created_at TEXT NOT NULL,
    text_compressed BLOB NOT NULL,
    options_json TEXT,
    text_model_id TEXT NOT NULL,
    UNIQUE(history_id, content_type),  -- 1履歴 × 1種別につき1件 (INSERT OR REPLACE)
    FOREIGN KEY (history_id) REFERENCES history(id) ON DELETE CASCADE
);
CREATE INDEX idx_ai_content_history ON ai_content(history_id);
```

- 本文とセグメントは **gzip 圧縮 BLOB** (`compress_text` / `decompress_text`、flate2)
- FK 制約と CASCADE 削除 (履歴削除で `ai_content` も消える) は、**すべてのコネクションを `db/mod.rs::open_connection` ヘルパー経由で開き、そこで `PRAGMA foreign_keys = ON` を設定する**ことで保証する。SQLite のこの pragma はコネクション単位で標準デフォルトは OFF のため、素の `Connection::open` を直接使ってはいけない (rusqlite `bundled-full` の同梱 SQLite はデフォルト ON だが、ビルド構成に依存させない)。本番削除経路の CASCADE は `entries.rs` の `delete_entries_cascades_ai_content` / `delete_all_entries_cascades_ai_content` テストが回帰ガードする

## マイグレーション

スキーマバージョン管理は持たず、起動時にランタイムで補正する:

- `add_column_if_missing`: `PRAGMA table_info` を見て `vad_enabled` 列がなければ `ALTER TABLE` で追加
- FTS インデックス: `needs_fts_migration` が真なら `rebuild_fts_index` で全再構築

## 全文検索 (`search.rs`)

- FTS5 仮想テーブル `history_fts (history_id, text)`、**tokenizer は `trigram`** — 形態素解析なしで日本語を含む言語非依存の部分一致検索を実現する (この選定が日本語対応の要)
- 保存/削除時に FTS 行を同期。検索は `history_fts MATCH ?` を history と JOIN

## コマンド一覧

`history_save` / `history_list` (フィルタ + ソート) / `history_get` / `history_delete` / `history_delete_all` / `history_search` / `history_rename` / `history_save_ai_content` / `history_get_ai_content` / `history_get_all_ai_content`
