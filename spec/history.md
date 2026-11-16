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
    vad_enabled INTEGER,
    source TEXT NOT NULL DEFAULT 'file',      -- "recording" | "file"
    text_preview TEXT NOT NULL DEFAULT ''     -- 一覧用の冒頭 100 文字
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

`PRAGMA user_version` で適用済みステップ数を管理する連番マイグレーション (`db/mod.rs::MIGRATIONS`)。`init_db` が未適用分を順に、ステップごとに 1 トランザクション (スキーマ変更 + バージョン更新) で実行する。**リリース済みのステップは編集・並べ替えしない** — 新しい変更は末尾に追加する。

| バージョン | 内容 |
|---|---|
| 1 (`migrate_v1_baseline`) | バージョン管理導入時点のスキーマ。導入前の DB は `user_version` 0 のまま複数の形 (`vad_enabled` / `source` / FTS の有無) があり得るため、このステップだけは全文が条件付き (`add_column_if_missing`、`needs_fts_migration` → `rebuild_fts_index`) |
| 2 (`migrate_v2_text_preview`) | `history.text_preview` 列を追加し、既存行を本文から埋める。一覧 (`list_entries`) は本文 BLOB を読まずこの列だけを返す。検索結果の抜粋は `history_fts.text` (非圧縮) から作る |

## 検索 (`search.rs`)

- FTS5 仮想テーブル `history_fts (history_id, text)` (tokenizer は `trigram`) に非圧縮の本文を持ち、保存/削除時に同期する。trigram インデックス自体は現在クエリに使っていない
- マッチングは `MATCH` ではなく **`LIKE` による部分一致** (`f.text LIKE ? OR h.file_name LIKE ?`)。trigram は 3 文字未満の語にマッチできず、「会議」「予算」のような 2 文字の日本語が検索できなかったため。個人の履歴規模ではスキャンで十分速い
- クエリは空白区切りの AND。各語は本文またはファイル名のどちらかに含まれればよい。`%` `_` `\` はエスケープしてリテラル扱い。大文字小文字は ASCII のみ同一視 (SQLite `LIKE` の仕様)
- 検索結果の `textPreview` は最初のヒットの 20 文字前から始まる 100 文字の抜粋 (`rows.rs::match_preview`)。ファイル名だけでヒットした場合は通常の冒頭プレビュー
- FE (`HistoryList`) は検索語を `src/lib/highlight.ts::splitHighlights` でハイライトする

## ページング

`history_list` / `history_search` は `limit` + `offset` を受け取る (`entries.rs::push_paging`)。FE (`createHistory.ts`) は 50 件ずつ取得し、満杯のページが返ったときだけ「さらに読み込む」を出す。ページ間で行が重複・欠落しないよう、`sort_clause` は常に `id` を最終ソートキーに付ける (`created_at` は秒精度で同値があり得る)。

## セグメントの編集 (`entries.rs::update_segment`)

誤認識の修正はセグメント単位 (履歴詳細のタイムライン → `history_update_segment`)。全文テキストはセグメントの連結で作り直す (whisper が全文を作るのと同じ方法) ので、全文・タイムライン・SRT/VTT・一覧プレビュー・検索インデックスが常に同じ内容を指す。更新は 1 トランザクション。

- セグメント先頭の空白は保持する (連結したときに前のセグメントとの区切りになるため)
- `history_update_segment` は変更後の全文・セグメント本文・一覧プレビューを返し (`SegmentUpdate`)、FE は再読み込みなしで詳細と一覧に反映する
- 編集できるのは履歴詳細のみ。文字起こし直後の結果画面は対象外 (表示元が履歴ではなく実行結果のため)
- 要約・整形は作り直さない。編集後は該当タブに「編集前の内容」である旨を表示し、再生成で解消する (この表示はセッション限りで、保存はしない)

## 録音音声 (`audio.rs`)

マイク録音の WAV は、文字起こしが履歴に保存された時点で `recordings/` から `{app_data}/audio/{history_id}.wav` へ rename で移動し、履歴と一緒に残す。ファイル由来の履歴は音声を持たない。

- パスは履歴 ID から導出し、DB には参照を持たない。ID はファイル名になるため **UUID として検証してから**結合する (パス区切りや `..` を持てない)
- `HistoryEntry.audioPath` は `history_get` がディスクを見て埋める (DB 層は常に `None`)。一覧 (`HistoryMeta`) は持たない
- 履歴の削除 (`history_delete` / `history_delete_all`) は音声ファイルも削除する。行の削除後なのでファイル削除はベストエフォート (失敗はログのみ — エラーを返すと FE が消えた行を表示し続ける)
- `history_attach_recording` は移動元が `recordings/` 直下であることを canonicalize して検証する (`RecordingManager::cleanup` と同じ理由)
- 移動に失敗しても文字起こしは保存済み。WAV は未処理の録音として残り、FE (`createTranscriptionJob`) がエラーを表示する
- **再生**: 履歴詳細 (`HistoryDetail` → `ResultViewer` の `audio` prop) が `convertFileSrc(audioPath)` を `<audio>` に渡す。タイムラインの行をクリックするとその開始位置から再生し、再生位置を含むセグメントをハイライトする (`ResultTimelineTab` の `onSeek` / `positionMs`)。音声は 32-bit float WAV のままなので、WebView で再生できるかは実機確認が必要
- **再文字起こし**: 履歴詳細から保存済み音声を文字起こし画面に渡す (`createTranscriptionJob.prepareRetranscription`)。結果は新しい履歴として保存され、`history_copy_audio` で音声のコピーを持つ (元の履歴と独立に削除できる)。変換の要否は表示名ではなくパスの拡張子で決める (保存済み音声の表示名は履歴タイトルで拡張子がない)
- 設定画面の「データ管理」(`DataManagement.tsx` / `createStorage.ts`): 音声の件数と容量 (`history_storage_stats`)、全音声の削除、未処理の録音の件数と削除 (セッションが保持中の 1 件は件数にも削除にも含めない)、全履歴の削除

## コマンド一覧

`history_save` / `history_list` (フィルタ + ソート) / `history_get` / `history_delete` / `history_delete_all` / `history_search` / `history_rename` / `history_update_segment` / `history_save_ai_content` / `history_get_ai_content` / `history_get_all_ai_content` / `history_attach_recording` / `history_copy_audio` / `history_delete_audio` / `history_delete_all_audio` / `history_delete_pending_recordings` / `history_storage_stats`
