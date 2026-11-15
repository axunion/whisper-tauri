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

## 検索 (`search.rs`)

- FTS5 仮想テーブル `history_fts (history_id, text)` (tokenizer は `trigram`) に非圧縮の本文を持ち、保存/削除時に同期する。trigram インデックス自体は現在クエリに使っていない
- マッチングは `MATCH` ではなく **`LIKE` による部分一致** (`f.text LIKE ? OR h.file_name LIKE ?`)。trigram は 3 文字未満の語にマッチできず、「会議」「予算」のような 2 文字の日本語が検索できなかったため。個人の履歴規模ではスキャンで十分速い
- クエリは空白区切りの AND。各語は本文またはファイル名のどちらかに含まれればよい。`%` `_` `\` はエスケープしてリテラル扱い。大文字小文字は ASCII のみ同一視 (SQLite `LIKE` の仕様)
- 検索結果の `textPreview` は最初のヒットの 20 文字前から始まる 100 文字の抜粋 (`rows.rs::match_preview`)。ファイル名だけでヒットした場合は通常の冒頭プレビュー
- FE (`HistoryList`) は検索語を `src/lib/highlight.ts::splitHighlights` でハイライトする

## ページング

`history_list` / `history_search` は `limit` + `offset` を受け取る (`entries.rs::push_paging`)。FE (`createHistory.ts`) は 50 件ずつ取得し、満杯のページが返ったときだけ「さらに読み込む」を出す。ページ間で行が重複・欠落しないよう、`sort_clause` は常に `id` を最終ソートキーに付ける (`created_at` は秒精度で同値があり得る)。

## コマンド一覧

`history_save` / `history_list` (フィルタ + ソート) / `history_get` / `history_delete` / `history_delete_all` / `history_search` / `history_rename` / `history_save_ai_content` / `history_get_ai_content` / `history_get_all_ai_content`
