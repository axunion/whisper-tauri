---
name: add-command
description: 新しいTauriコマンドをRust+TypeScript両側に追加する。コマンド定義、型定義、エラー型、lib.rsへの登録、フロントエンド型、invoke呼び出しまで一貫して生成する。新機能追加やバックエンドAPIの追加時に使用すること。
argument-hint: "<モジュール名> <コマンド名> [説明]"
user-invocable: true
---

# /add-command — Tauri コマンド追加

`$ARGUMENTS` で指定されたモジュールとコマンド名に基づいて、Rust バックエンドから TypeScript フロントエンドまで一貫してコマンドを追加する。

## Argument Parsing

`$ARGUMENTS` から以下を抽出する:

- **モジュール名**: 既存モジュール（`whisper`, `converter`, `history`, `recording`, `text_processing`）またはリネーム
- **コマンド名**: snake_case で指定（例: `get_status`, `save_entry`）
- **説明**（任意）: コマンドの目的

不明な場合は `AskUserQuestion` で確認する。

## 既存モジュールへの追加

既存モジュールにコマンドを追加する場合の手順。

### Step 1: 型定義（Rust）

`src-tauri/src/<module>/types.rs` にリクエスト/レスポンス型を追加する。

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MyParams {
    pub some_field: String,
}
```

規約:
- `#[serde(rename_all = "camelCase")]` は必須
- Optional フィールドには `#[serde(skip_serializing_if = "Option::is_none")]`
- doc コメントで各フィールドを説明

### Step 2: エラー型（Rust）

必要に応じて `src-tauri/src/<module>/error.rs` にバリアントを追加する。

```rust
#[error("Prefix message: {0}")]
NewVariant(String),
```

規約:
- エラーメッセージは `"Prefix: {0}"` 形式（フロントエンドの PREFIX_MAP でマッチングされる）
- 新しいプレフィックスを追加した場合、Step 5 で `src/lib/errors.ts` の PREFIX_MAP にも追加する

### Step 3: コマンド実装（Rust）

`src-tauri/src/<module>/commands.rs` にコマンド関数を追加する。

```rust
/// コマンドの説明
///
/// # Errors
///
/// Returns an error if ...
#[tauri::command]
pub async fn my_command(app: AppHandle, params: MyParams) -> Result<MyResult, String> {
    // 実装
}
```

規約:
- `#[tauri::command]` 属性
- 戻り値は `Result<T, String>`
- `AppHandle` が必要な場合のみ第一引数に指定
- doc コメントに `# Errors` セクション
- エラー変換は `.map_err(Into::into)` または `.map_err(|e| ...)`

### Step 4: コマンド登録

`src-tauri/src/lib.rs` の `invoke_handler` にコマンドを登録する。

```rust
.invoke_handler(tauri::generate_handler![
    // ... 既存コマンド
    module::commands::my_command,  // ← 追加
])
```

該当モジュールの他のコマンドの近くに配置する。

### Step 5: TypeScript 型定義

`src/types/<module>.ts` に対応する型を追加する。

```typescript
export interface MyParams {
  someField: string;  // camelCase
}
```

規約:
- Rust の `snake_case` フィールドは TypeScript では `camelCase`
- `src/types/index.ts` から export する

### Step 6: エラーマッピング（必要な場合）

Step 2 で新しいエラープレフィックスを追加した場合、`src/lib/errors.ts` を更新する:

- `PREFIX_MAP` にプレフィックスと `ErrorCode` のマッピングを追加
- 必要に応じて `ErrorCode` enum に新しいコードを追加（`src/types/errors.ts`）
- `CATEGORY_MAP`, `MESSAGE_MAP` にも対応するエントリを追加

### Step 7: フロントエンド呼び出し

`src/primitives/` または呼び出し元で `invoke` を使用する。

```typescript
import { invoke } from "@tauri-apps/api/core";
import { parseError } from "~/lib/errors";

const result = await invoke<MyResult>("my_command", { params });
```

規約:
- コマンド名は Rust の関数名そのまま（snake_case）
- `invoke<ReturnType>` でジェネリクス指定
- try/catch で囲み、`parseError()` でエラーを変換

## 新規モジュールの作成

既存モジュールに該当しない場合、新規モジュールを作成する。

### ディレクトリ構成

```
src-tauri/src/<module>/
├── mod.rs        — サブモジュール宣言
├── commands.rs   — #[tauri::command] 関数
├── types.rs      — Serde 型定義
└── error.rs      — thiserror エラー型 + From<Error> for String
```

### 追加手順

1. 上記4ファイルを作成
2. `src-tauri/src/lib.rs` に `pub mod <module>;` を追加
3. `invoke_handler` にコマンドを登録
4. `src/types/<module>.ts` を作成し `src/types/index.ts` から export
5. 必要に応じて `src/lib/errors.ts` を更新

## 検証

全ステップ完了後、以下を実行する:

```bash
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

```bash
pnpm lint && pnpm typecheck && pnpm test:run
```

両方パスするまで修正を繰り返す。
