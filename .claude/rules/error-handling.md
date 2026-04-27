---
paths:
  - "src-tauri/src/*/error.rs"
  - "src/lib/errors.ts"
  - "src/types/errors.ts"
---

# エラー定義・同期ルール

Rust 側のエラーは文字列化されてフロントに渡る。プレフィックスマッチでフロント側の `ErrorCode` に変換するため、両側を必ず同期させる。

## Rust 側 (`src-tauri/src/*/error.rs`)

- `thiserror::Error` を派生した enum で定義する
- メッセージは `"Prefix: {0}"` 形式（バリアントなしの場合は `"Prefix"` のみ）。プレフィックスは大文字始まり
- 既存プレフィックス（`File not found:` / `IO error:` / `HTTP error:` / `Download failed:` / `Cancelled` 系など）と同義のものは新設せず再利用する
- `From<XxxError> for String` を必ず実装する（`#[tauri::command]` が `Result<T, String>` を返すため）
- `From<std::io::Error>` / `From<reqwest::Error>` / `From<crate::download::DownloadError>` などは `#[from]` または手書き `From` で吸収する
- 各バリアントの `Display` 出力を確認する単体テストを書く（既存 `error.rs` の `#[cfg(test)] mod tests` を踏襲）

## フロント側 (`src/lib/errors.ts` / `src/types/errors.ts`)

新しいエラーメッセージプレフィックスを Rust 側に追加したら、以下を必ず更新する:

1. `src/types/errors.ts` の `ErrorCode` に対応する識別子があるか確認。なければ追加
2. `src/types/errors.ts` の `ErrorCategory` に該当カテゴリがあるか確認
3. `src/lib/errors.ts` の `PREFIX_MAP` に `[Rust 側プレフィックス文字列, ErrorCode]` を追加
   - **キー文字列は Rust 側の `#[error("...")]` の prefix と完全一致させる**（コロンの有無まで含めて）
   - `startsWith` でマッチするため、より長いプレフィックスを先に並べる
4. 新しい `ErrorCode` を追加した場合は `CATEGORY_MAP` / `MESSAGE_MAP` のエントリも追加（`Record<ErrorCodeType, ...>` のため網羅必須）
5. 復帰不可能なエラーは `NON_RECOVERABLE` セットに追加する

## 同期忘れの典型症状

- Rust 側でエラーが出ているのにフロントが `UNKNOWN_ERROR`（「予期しないエラー」）として表示する → `PREFIX_MAP` にプレフィックスが未登録
- 新 `ErrorCode` を追加したが `CATEGORY_MAP` / `MESSAGE_MAP` が型エラー → `Record` の網羅性チェックが効いている。両 Map を埋める
