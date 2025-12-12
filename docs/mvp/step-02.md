# Step 2: 型システム構築

**Phase 1: MVP** | 必須

Rust / TypeScript 間の型定義を統一する。

---

## 目的

- フロントエンドとバックエンド間で一貫した型定義を確立
- 型安全なIPC通信を実現

---

## テスト要件

### TypeScript (Vitest)

`src/types/__tests__/whisper.test.ts`:

| テスト | 内容 |
|-------|------|
| ModelInfo の必須プロパティ | id, name, size, sizeBytes, description, downloaded が存在する |
| ModelInfo のオプショナルプロパティ | path がオプショナルである |
| TranscriptionSegment のタイミング情報 | start, end, text が存在する |
| TranscriptionResult のセグメント配列 | segments が配列である |

### Rust (cargo test)

`src-tauri/src/whisper/types.rs`:

| テスト | 内容 |
|-------|------|
| ModelInfo のシリアライズ | JSON出力がcamelCaseになる |
| Option フィールドのスキップ | path が None の場合 JSON に含まれない |

---

## 実装内容

### 1. TypeScript型定義

`src/types/whisper.ts` に以下の型を定義：

#### ModelInfo
モデル情報を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| id | string | モデル識別子 (base, small, medium, large) |
| name | string | 表示名 |
| size | string | サイズ表示 (例: "142MB") |
| sizeBytes | number | バイト数 |
| description | string | 説明文 |
| downloaded | boolean | ダウンロード済みか（バンドル含む） |
| bundled | boolean | アプリにバンドルされているか |
| path? | string | モデルファイルのパス（利用可能な場合） |

#### TranscriptionProgress
文字起こし進捗を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| taskId | string | タスク識別子 |
| progress | number | 進捗率 (0-100) |
| currentSegment? | string | 現在処理中のセグメント |
| elapsedMs | number | 経過時間（ミリ秒） |

#### TranscriptionResult
文字起こし結果を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| taskId | string | タスク識別子 |
| text | string | 全文テキスト |
| segments | TranscriptionSegment[] | セグメント配列 |
| language | string | 検出された言語 |
| duration | number | 音声の長さ（秒） |

#### TranscriptionSegment
セグメント情報を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| start | number | 開始時間（ミリ秒） |
| end | number | 終了時間（ミリ秒） |
| text | string | セグメントのテキスト |

#### DownloadProgress
ダウンロード進捗を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| modelId | string | モデル識別子 |
| downloadedBytes | number | ダウンロード済みバイト数 |
| totalBytes | number | 総バイト数 |
| progress | number | 進捗率 (0-100) |

#### FileInfo
ファイル情報を表す型。

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| path | string | ファイルパス |
| name | string | ファイル名 |
| size | number | ファイルサイズ |
| duration? | number | 音声の長さ（秒） |

### 2. Rust型定義

`src-tauri/src/whisper/types.rs` にTypeScriptと対応する型を定義。

- `#[serde(rename_all = "camelCase")]` を使用してRustのsnake_caseをTypeScriptのcamelCaseに変換
- `#[serde(skip_serializing_if = "Option::is_none")]` でOption型のNoneをスキップ

### 3. モジュール構成

`src-tauri/src/whisper/mod.rs` で types モジュールを公開。

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/types/__tests__/whisper.test.ts` | **テスト（先に作成）** |
| `src/types/whisper.ts` | TypeScript型定義 |
| `src/types/index.ts` | 型エクスポート |
| `src-tauri/src/whisper/types.rs` | Rust型定義（テスト含む） |
| `src-tauri/src/whisper/mod.rs` | モジュール定義 |

---

## 技術的注意点

- Rust側の `snake_case` フィールドは `serde` で `camelCase` に変換される
- TypeScriptとRustの型が一致していることを両方のテストで確認する
- number型の精度（Rust: u32/u64/i64/f64 vs TypeScript: number）に注意

---

## 完了条件

- [ ] `pnpm test` で型テストが通る
- [ ] `cargo test` でRust型テストが通る
- [ ] TypeScriptとRustの型が対応している

---

## 次のステップ

[Step 3: モデル管理（Rust）](./step-03.md)
