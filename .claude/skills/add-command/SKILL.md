---
name: add-command
description: Add a new Tauri command on both Rust and TypeScript sides — command definition, types, error variants, lib.rs registration, frontend types, and invoke calls in one pass. Use when adding any IPC entry point, new backend API, action handler, or anything callable from the frontend via invoke(). For introducing a new domain module, run /add-module first.
argument-hint: "<module> <command-name> [description]"
user-invocable: true
---

# /add-command — Add a Tauri Command

Add a command end-to-end (Rust backend → TypeScript frontend) for the module and command name in `$ARGUMENTS`.

All user-facing output and confirmations are in **Japanese**.

## Argument Parsing

- **module**: an existing module (`whisper`, `converter`, `history`, `recording`, `text_processing`, `notion`)
- **command name**: snake_case (e.g. `get_status`, `save_entry`)
- **description** (optional)

If unclear, confirm via `AskUserQuestion`.

## Phase 0 — Module Existence Check

If `src-tauri/src/<module>/` doesn't exist, stop and tell the user to run `/add-module <module>` first. Do not scaffold modules here.

## Step 1 — Rust Types

Add request/response structs to `src-tauri/src/<module>/types.rs`. Requirements:

- `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]` (drop `PartialEq` if not needed)
- `#[serde(rename_all = "camelCase")]`
- Optional fields: `#[serde(skip_serializing_if = "Option::is_none")]`
- One-line doc comment per non-obvious field

## Step 2 — Error Variant (when needed)

Extend `src-tauri/src/<module>/error.rs`:

```rust
#[error("PREFIX: {0}")]
NewVariant(String),
```

The frontend `PREFIX_MAP` matches by prefix. If a new prefix is introduced, also update `src/lib/errors.ts` in Step 6. See `.claude/rules/error-handling.md` for full sync rules.

## Step 3 — Command Implementation

Add to `src-tauri/src/<module>/commands.rs`:

```rust
#[tauri::command]
pub async fn my_command(params: MyParams) -> Result<MyResult, String> { ... }
```

Conventions:

- Return `Result<T, String>`
- Take `AppHandle` only when actually needed; place it first if used
- Doc comment with `# Errors` section
- Convert errors via `.map_err(Into::into)` or an explicit closure

## Step 4 — Register the Command

In `src-tauri/src/lib.rs` add `module::commands::my_command` to the `tauri::generate_handler![...]` list, near the module's existing commands.

## Step 5 — TypeScript Types

Mirror Rust types in `src/types/<module>.ts` (`camelCase` field names). Re-export through `src/types/index.ts` if not already.

## Step 6 — Error Mapping (when Step 2 added a new prefix)

In `src/lib/errors.ts`:

- Add `[<rust-prefix>, ErrorCode]` to `PREFIX_MAP`
- Add the matching `ErrorCode` to `src/types/errors.ts` with `CATEGORY_MAP` / `MESSAGE_MAP` entries
- For non-recoverable errors, add to the `NON_RECOVERABLE` set

See `.claude/rules/error-handling.md` for the full procedure.

## Step 7 — Frontend Invocation

In `src/primitives/` or at the call site:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { parseError } from "~/lib/errors";

const result = await invoke<MyResult>("my_command", { params });
```

- Command name uses the Rust function's snake_case
- Always pass error catches through `parseError()`

## Verify

Recommend the user run `/verify all` (or `/verify all --with-build` if a release is imminent). Repeat fixes until checks pass.
