---
name: add-module
description: Add a new backend module under src-tauri/src/<module>/. Generates the standard four-file scaffold (mod.rs / commands.rs / types.rs / error.rs), registers the module in lib.rs, and creates the matching TypeScript types file under src/types/<module>.ts. Sister skill of /add-command — use this first when introducing a new domain area, then /add-command for individual commands.
argument-hint: "<module-name> [description]"
user-invocable: true
---

# /add-module — Backend Module Scaffold

Creates a new backend module that follows the project's standard layout (see `CLAUDE.md` → Architecture). Use this when introducing a new domain area before adding any commands. For adding individual commands to an existing module, use `/add-command` instead.

All user-facing output and confirmations are in **Japanese**.

## Argument Parsing

`$ARGUMENTS` format: `<module-name> [description]`

- **module-name**: required, snake_case (alphanumeric + underscore, no leading digit). Reject `kebab-case` / `camelCase`.
- **description**: optional one-line summary used in doc comments.

If absent or malformed, prompt via `AskUserQuestion`.

## Phase 0 — Conflict Check

Abort with a clear message on any of:

- `src-tauri/src/<module>/` already exists
- `<module>` matches an existing module (`whisper`, `converter`, `history`, `recording`, `text_processing`, `notion`) — tell the user to use `/add-command` instead
- `src/types/<module>.ts` already exists

## Phase 1 — Read the Reference Module

Read the four files of the `notion` module — it's the canonical small module and the source of truth for current conventions (this skill's templates can drift):

- `src-tauri/src/notion/{mod,types,error,commands}.rs`

Mirror its patterns in Phase 2.

## Phase 2 — Generate Backend Scaffold

Create the four files at `src-tauri/src/<module>/`. Match what Phase 1 read; the bullets below are the minimum every file must satisfy.

- **`mod.rs`** — declare `pub mod commands; pub mod error; pub mod types;` and `pub use error::Error;`. Leading `//!` doc comment with the description.
- **`types.rs`** — `use serde::{Deserialize, Serialize};`. Every struct crossing the IPC boundary uses `#[derive(Debug, Clone, Serialize, Deserialize)]` + `#[serde(rename_all = "camelCase")]`. Empty placeholder is fine; `/add-command` fills it in later.
- **`error.rs`** — `thiserror::Error` enum + `impl From<Error> for String { fn from(e: Error) -> Self { e.to_string() } }`. Variant messages use the form `"<MODULE_PREFIX>_<KIND>: {0}"` so the frontend `PREFIX_MAP` in `src/lib/errors.ts` can dispatch on them. Empty enum is fine until commands need variants.
- **`commands.rs`** — `#[allow(unused_imports)] use super::{error::Error, types::*};` placeholder. `/add-command` adds `#[tauri::command]` functions later.

## Phase 3 — Register in lib.rs

Edit `src-tauri/src/lib.rs`:

1. Add `pub mod <module>;` to the `pub mod` block, alphabetically.
2. Do **not** touch `invoke_handler` — there are no commands yet. `/add-command` will register them.

Show the diff and confirm.

## Phase 4 — TypeScript Types Scaffold

- **`src/types/<module>.ts`** — placeholder header comment explaining that it mirrors the Rust types; export `{}` so the file is a module. `/add-command` fills it in.
- **`src/types/index.ts`** — add `export * from "./<module>";` alphabetically. Read the file first to match its existing style.

## Phase 5 — Error Prefix (Optional, default skip)

Skip unless the user explicitly asked. When they do:

1. Read `src/lib/errors.ts` to see the `PREFIX_MAP` / `CATEGORY_MAP` / `MESSAGE_MAP` shape.
2. Add a placeholder `<MODULE>_GENERIC` entry mapped to a generic `ErrorCode`.
3. Add the matching `ErrorCode` member to `src/types/errors.ts` if needed.

When `/add-command` introduces the first variant it will surface this prompt again, so deferring is safe.

## Phase 6 — Recommend Verification

Print the recommendation (do not auto-run):

```
次のアクション:
1. /add-command <module> <command-name> で最初のコマンドを追加
2. /verify all で検証
```

`/verify all` catches missing imports, lib.rs registration mistakes, and `types/index.ts` syntax errors.

## Output Format

Phase headers in Japanese. End with:

```
## モジュール追加完了
- バックエンド: src-tauri/src/<module>/{mod,types,error,commands}.rs
- 登録: src-tauri/src/lib.rs (pub mod <module>)
- フロントエンド: src/types/<module>.ts + src/types/index.ts
- エラープレフィックス: <登録 or 未登録>
```
