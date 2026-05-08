---
name: add-command
description: Add a new Tauri command on both Rust and TypeScript sides — command definition, types, error variants, lib.rs registration, frontend types, and invoke calls in one pass. Use when adding any IPC entry point, new backend API, action handler, or anything callable from the frontend via invoke(). For introducing a new domain module, run /add-module first.
argument-hint: "<module> <command-name> [description]"
user-invocable: true
---

# /add-command — Add a Tauri Command

Add a command end-to-end (Rust backend → TypeScript frontend) for the given module and command name in `$ARGUMENTS`.

All user-facing output and confirmations are in **Japanese**.

## Argument Parsing

Extract from `$ARGUMENTS`:

- **module**: an existing module (`whisper`, `converter`, `history`, `recording`, `text_processing`, `notion`)
- **command name**: snake_case (e.g. `get_status`, `save_entry`)
- **description** (optional): purpose of the command

If unclear, confirm via `AskUserQuestion`.

## Phase 0 — Module Existence Check

If the requested module does **not** exist under `src-tauri/src/`, stop and tell the user to run `/add-module <module>` first. Do not attempt to scaffold a new module here — module creation is the responsibility of `/add-module`.

## Step 1 — Type Definitions (Rust)

Add request/response types to `src-tauri/src/<module>/types.rs`.

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MyParams {
    pub some_field: String,
}
```

Conventions:
- `#[serde(rename_all = "camelCase")]` is required
- Optional fields: `#[serde(skip_serializing_if = "Option::is_none")]`
- Doc comments on each field

## Step 2 — Error Type (Rust)

Extend `src-tauri/src/<module>/error.rs` with a variant when needed.

```rust
#[error("Prefix message: {0}")]
NewVariant(String),
```

Conventions:
- Error message format: `"Prefix: {0}"` (the frontend `PREFIX_MAP` matches by prefix)
- If a new prefix is introduced, also update `src/lib/errors.ts` in Step 6
- See `.claude/rules/error-handling.md` for the full sync rules

## Step 3 — Command Implementation (Rust)

Add the command function to `src-tauri/src/<module>/commands.rs`.

```rust
/// Description of the command.
///
/// # Errors
///
/// Returns an error if ...
#[tauri::command]
pub async fn my_command(app: AppHandle, params: MyParams) -> Result<MyResult, String> {
    // implementation
}
```

Conventions:
- `#[tauri::command]` attribute
- Return `Result<T, String>`
- `AppHandle` only as the first argument when actually needed
- `# Errors` section in the doc comment
- Convert errors with `.map_err(Into::into)` or `.map_err(|e| ...)`

## Step 4 — Command Registration

Register the command in `src-tauri/src/lib.rs` under `invoke_handler`.

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    module::commands::my_command,  // ← add
])
```

Place it near the module's other commands.

## Step 5 — TypeScript Types

Add the matching types to `src/types/<module>.ts`.

```typescript
export interface MyParams {
  someField: string;  // camelCase
}
```

Conventions:
- Rust `snake_case` fields become TypeScript `camelCase`
- Re-export from `src/types/index.ts`

## Step 6 — Error Mapping (when needed)

When Step 2 introduced a new error prefix, update `src/lib/errors.ts`:

- Add `[<rust-prefix>, ErrorCode]` to `PREFIX_MAP`
- If a new `ErrorCode` is needed, add it to `src/types/errors.ts` and add corresponding entries to `CATEGORY_MAP` and `MESSAGE_MAP`
- For non-recoverable errors, add to the `NON_RECOVERABLE` set

See `.claude/rules/error-handling.md` for the full procedure.

## Step 7 — Frontend Invocation

Use `invoke` in `src/primitives/` or at the call site.

```typescript
import { invoke } from "@tauri-apps/api/core";
import { parseError } from "~/lib/errors";

const result = await invoke<MyResult>("my_command", { params });
```

Conventions:
- Command name matches the Rust function name (snake_case)
- Use the `invoke<ReturnType>` generic
- Wrap in try/catch and convert errors with `parseError()`

## Verify

After all steps, run both:

```bash
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

```bash
pnpm lint && pnpm typecheck && pnpm test:run
```

Or use `/verify all`. Repeat fixes until both pass.
