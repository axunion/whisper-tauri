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

- **module-name**: required, snake_case, alphanumeric + underscore only. Reject `kebab-case`, `camelCase`, leading digits.
- **description**: optional one-line summary used in doc comments and the error enum's doc comment.

If absent or malformed, prompt via `AskUserQuestion`.

## Phase 0 — Conflict Check

Abort on any of:

- `src-tauri/src/<module>/` already exists
- `<module>` is reserved (`whisper`, `converter`, `history`, `recording`, `text_processing`, `notion` already exist — but reuse is the wrong tool here; tell the user to use `/add-command` instead)
- `src/types/<module>.ts` already exists

Show what was found and stop.

## Phase 1 — Reference Existing Module

Before generating, read the most-recently-added module as a structural reference. The `notion` module is the current canonical small module — read its four files and mirror the patterns:

- `src-tauri/src/notion/mod.rs`
- `src-tauri/src/notion/types.rs`
- `src-tauri/src/notion/commands.rs`
- `src-tauri/src/notion/error.rs`

This step exists because the project conventions evolve and the existing module is the source of truth, not this skill's templates.

## Phase 2 — Generate Backend Scaffold

Create the four files. Templates below show the *minimum* — adapt to match what Phase 1 read from `notion`.

### `src-tauri/src/<module>/mod.rs`

```rust
//! <description>

pub mod commands;
pub mod error;
pub mod types;

pub use error::Error;
```

### `src-tauri/src/<module>/types.rs`

```rust
//! Types for the <module> module.

use serde::{Deserialize, Serialize};

// Add request/response types here. Every struct crossing the IPC boundary needs:
// #[derive(Debug, Clone, Serialize, Deserialize)]
// #[serde(rename_all = "camelCase")]
```

### `src-tauri/src/<module>/error.rs`

```rust
//! Error type for the <module> module.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    // Variants use the format "<PREFIX>: {0}" so that the frontend
    // PREFIX_MAP in src/lib/errors.ts can dispatch on them.
    // Example:
    // #[error("<MODULE>_NETWORK: {0}")]
    // Network(String),
}

impl From<Error> for String {
    fn from(err: Error) -> Self {
        err.to_string()
    }
}
```

### `src-tauri/src/<module>/commands.rs`

```rust
//! Tauri commands for the <module> module.

#[allow(unused_imports)]
use super::{error::Error, types::*};

// Add #[tauri::command] functions here. Each returns Result<T, String>.
// Use /add-command to add commands following project conventions.
```

## Phase 3 — Register Module in lib.rs

Edit `src-tauri/src/lib.rs`:

1. Add `pub mod <module>;` to the module declaration block. Place it alphabetically among the existing `pub mod` lines.
2. Do **not** add anything to `invoke_handler` yet — there are no commands to register. `/add-command` will add entries later.

Show the diff and confirm.

## Phase 4 — TypeScript Types Scaffold

### `src/types/<module>.ts`

```typescript
// Types for the <module> module.
// Mirror Rust structs in src-tauri/src/<module>/types.rs.
// Field names use camelCase (Rust snake_case is transformed via #[serde(rename_all = "camelCase")]).

export {};
```

### `src/types/index.ts`

Add a re-export. Read the existing file first to match its style (some projects use `export *`, others named exports). Insert alphabetically.

```typescript
export * from "./<module>";
```

## Phase 5 — Error Prefix (Optional)

If the user indicated the module will produce errors, prompt whether to register a prefix in `src/lib/errors.ts` now. If yes:

1. Read `src/lib/errors.ts` to see the current `PREFIX_MAP` / `CATEGORY_MAP` / `MESSAGE_MAP` shape.
2. Add a placeholder entry with `<MODULE>_GENERIC` mapped to a generic error code.
3. Add corresponding entry to `src/types/errors.ts` `ErrorCode` enum.

Show the diff and confirm.

If no, skip — `/add-command` will surface the prompt again when the first command introduces an error variant.

## Phase 6 — Verify

After all files exist, recommend the user run:

```
/verify all
```

This catches:
- Missing imports / unused imports
- Module registration errors in `lib.rs`
- `src/types/index.ts` syntax errors

Do not auto-run `/verify` — the user may want to add commands first.

## Output Format

Phase-by-phase progress in Japanese. End with:

```
## モジュール追加完了
- バックエンド: src-tauri/src/<module>/{mod,types,error,commands}.rs
- 登録: src-tauri/src/lib.rs (pub mod <module>)
- フロントエンド: src/types/<module>.ts + src/types/index.ts
- エラープレフィックス: <登録 or 未登録>

次のアクション:
1. /add-command <module> <command-name> で最初のコマンドを追加
2. /verify all で検証
```
