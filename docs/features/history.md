# 履歴管理

**カテゴリ**: 基本機能強化 | **優先度**: 推奨

文字起こし結果を保存・管理する基本履歴機能。

---

## 目的

- 過去の文字起こし結果を閲覧・再利用
- 履歴の日付フィルタ
- 不要な履歴の削除

---

## データ保存

### 保存先

OS標準のアプリデータフォルダを使用：
- macOS: `~/Library/Application Support/com.whisper-tauri.app/`
- Windows: `%APPDATA%/com.whisper-tauri.app/`
- Linux: `~/.local/share/com.whisper-tauri.app/`

### 保存形式

| データ | 形式 | 説明 |
|--------|------|------|
| メタデータ | SQLite | ID、日時、ファイル名、言語、モデル |
| テキスト | SQLite (gzip BLOB) | 圧縮して保存 |
| セグメント | SQLite (gzip BLOB) | タイムスタンプ付きセグメント（圧縮JSON） |

### テーブル構成

| テーブル | 用途 |
|----------|------|
| `history` | メタデータ + 圧縮テキスト（BLOB） |

---

## 機能

### 1. 履歴一覧

- 日時順で一覧表示
- サムネイル情報（日時、ファイル名、テキスト冒頭）

### 2. 日付フィルタ

- 日付範囲でフィルタ

### 3. 履歴詳細

- 文字起こし結果の全文表示
- エクスポート機能との連携（TXT/SRT/VTT）
- SLM処理機能との連携（校正・要約）

### 4. 削除

- 個別削除
- 複数選択削除
- 全削除（確認ダイアログ付き）

---

## テスト要件

### TypeScript (Vitest)

| テスト | 内容 |
|--------|------|
| 履歴一覧取得 | 日時降順でソートされる |
| フィルタ | 日付範囲で絞り込める |

### Rust (cargo test)

| テスト | 内容 |
|--------|------|
| DB初期化 | historyテーブルが作成される |
| 保存 | テキストが圧縮されてDBに保存される |
| 取得 | 圧縮テキストが展開されて取得できる |
| 削除 | 履歴が削除される |

---

## 実装内容

### Backend (Rust)

1. **履歴モジュール** (`src-tauri/src/history/`)
   - 保存・読み込み・削除
   - gzip圧縮・展開

2. **Tauriコマンド**
   - `history:list` - 履歴一覧取得
   - `history:get` - 履歴詳細取得
   - `history:save` - 履歴保存
   - `history:delete` - 履歴削除

### Frontend (TypeScript)

1. **型定義** (`src/types/history.ts`)
   - HistoryEntry, HistoryMeta

2. **Primitives** (`src/primitives/createHistory.ts`)
   - 履歴一覧の状態管理
   - フィルタ状態
   - 削除操作

3. **UIコンポーネント**
   - HistoryPage - 履歴ページ全体
   - HistoryList - 履歴一覧
   - HistoryItem - 履歴アイテム
   - HistoryDetail - 履歴詳細表示

---

## 依存関係

### Rust crates

| Crate | 用途 |
|-------|------|
| rusqlite | SQLite操作 |
| flate2 | gzip圧縮・展開（テキストBLOB用） |

### 既存機能との連携

- エクスポート機能: 履歴からエクスポート可能
- SLMテキスト処理: 履歴データに対して校正・要約

---

## 拡張機能

- **全文検索**: `history-search.md` - FTS5による高速テキスト検索

---

## 作成ファイル

| ファイル | 説明 |
|----------|------|
| `src-tauri/src/history/` | 履歴モジュール（Rust） |
| `src/types/history.ts` | 型定義 |
| `src/primitives/createHistory.ts` | SolidJS Primitive |
| `src/components/history/` | UIコンポーネント |
| `src/pages/HistoryPage.tsx` | 履歴ページ |

---

## 完了条件

- [ ] 文字起こし結果がSQLiteに圧縮保存される
- [ ] 履歴一覧を表示できる
- [ ] 日付フィルタができる
- [ ] 個別削除ができる
- [ ] 複数選択削除ができる
- [ ] `pnpm test` で全テストが通る
- [ ] `cargo test` で全テストが通る
