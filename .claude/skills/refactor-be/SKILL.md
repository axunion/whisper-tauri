---
name: refactor-be
description: Rust/Tauri 2バックエンドコードをプロジェクト規約に基づいてリファクタリングする。エラーハンドリング統一、型定義整理、モジュール構成、clippy警告解消、pub最小化など。src-tauri/配下のコード品質改善やリファクタリング依頼時に使用すること。
argument-hint: "<file or description>"
user-invocable: true
---

# /refactor-be — バックエンドリファクタリング

`$ARGUMENTS` で指定されたファイルまたは対象を、プロジェクト規約に基づいてリファクタリングする。

## プロジェクト規約

### エラーハンドリング

- `unwrap()` / `expect()` は禁止。`?` 演算子または `map_err` を使用する
- `unsafe` コードは全面禁止（`unsafe_code = "forbid"`）
- エラー型は `thiserror` で定義し、`From<XxxError> for String` を実装する
- エラーメッセージは `"Prefix: {0}"` 形式。フロント側 `src/lib/errors.ts` の `PREFIX_MAP` と同期する

```rust
// ✅ Good
#[derive(Debug, thiserror::Error)]
pub enum WhisperError {
    #[error("File not found: {0}")]
    FileNotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<WhisperError> for String {
    fn from(err: WhisperError) -> Self {
        err.to_string()
    }
}
```

### 型定義

- `#[serde(rename_all = "camelCase")]` 必須 — TypeScript 側と camelCase で同期
- Optional フィールド: `#[serde(skip_serializing_if = "Option::is_none")]`
- TypeScript 側の型定義 (`src/types/`) と一致させる

### Tauri コマンド

- `#[tauri::command]` で定義し `Result<T, String>` を返す
- `AppHandle` は引数で受け取る

### モジュール構成

- `commands.rs` — Tauri コマンド
- `types.rs` — 型定義（Serde 対応）
- `error.rs` — エラー型（thiserror）
- `mod.rs` — 再エクスポート

### コード整理

- **未使用コードの除去**: 未使用の `use`、変数、関数、型定義を削除する。`#[allow(dead_code)]` で抑制しない
- **関数の粒度**: 1つの関数は1つの責務に絞る。長い関数はヘルパーに分離する
- **重複コードの統合**: 同一ロジックが2箇所以上にあれば共通関数に抽出する。ただし、文脈が異なるコードを無理に統合しない
- **冗長な記述の簡素化**: 不要な `.clone()`、冗長なパターンマッチ、過剰な型アノテーションを整理する
- **pub の最小化**: モジュール外から不要な `pub` を除去する

### Clippy 設定

- `all = warn`, `pedantic = warn` が有効
- `unwrap_used = warn`, `expect_used = warn`

### スタイルガイド

- `rustfmt` 準拠、インデント幅 4

## 手順

1. 対象ファイルを読み込み、規約違反を特定する
2. リファクタリングを実施する
3. 検証コマンドを `src-tauri/` 内で実行する:

```bash
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

4. 失敗があれば修正し、全パスするまで繰り返す
