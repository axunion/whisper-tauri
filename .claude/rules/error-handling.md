---
paths:
  - "src-tauri/src/*/error.rs"
  - "src-tauri/src/ipc_error.rs"
  - "src-tauri/src/download.rs"
  - "src-tauri/src/update.rs"
  - "src/lib/errors.ts"
  - "src/types/errors.ts"
---

# Error Definition Rules

Every command returns `Result<T, IpcError>`. `IpcError` (`src-tauri/src/ipc_error.rs`) carries an `ErrorCode` the frontend branches on and a `message` it shows as detail. `ErrorCode` is generated into `src/bindings.ts`, so the two sides cannot drift; what still needs judgment is which code each failure gets.

Top-level single-file modules (`update.rs`, `settings.rs`, `paths.rs`) define their error enums inline rather than in a dedicated `error.rs` — the same rules apply there. `download.rs`'s `DownloadError` never reaches a command: each caller absorbs it into its own error enum.

## Rust side (`src-tauri/src/*/error.rs`)

- Define an enum that derives `thiserror::Error`
- Message format: `"Prefix: {0}"` (or just `"Prefix"` for variants without payload). Prefixes start with an uppercase letter. The text is shown to the user as the error's detail line
- Always implement `From<XxxError> for IpcError` with a `match` that names every variant — no `_` arm, so adding a variant fails to compile until it is given a code
- Pick the code by what the user should be told and whether a retry makes sense, not by where the error came from
- Absorb upstream errors via `#[from]` or hand-written `From` (e.g., `From<std::io::Error>`, `From<reqwest::Error>`, `From<crate::download::DownloadError>`)
- Keep a typed error typed until it reaches the command's return: `err.to_string()` followed by `?` goes through `From<String> for IpcError` and silently becomes `UnknownError`. That fallback exists only for failures with no error type (a poisoned lock, a task join, a one-off message such as "Could not determine audio duration")
- Add a unit test that exercises each variant's `Display` output, and one that checks the `IpcError` conversion (mirror the existing `#[cfg(test)] mod tests` block in any current `error.rs`)

## Adding an `ErrorCode`

1. Add the variant to `ErrorCode` in `src-tauri/src/ipc_error.rs`, then run `cargo test` in `src-tauri/` to regenerate `src/bindings.ts`
2. Add the name to the `ErrorCode` object in `src/types/errors.ts`
3. Add entries to `CATEGORY_MAP` and `MESSAGE_KEY_MAP` in `src/lib/errors.ts` (both are `Record<ErrorCode, ...>` and require exhaustive coverage). `MESSAGE_KEY_MAP` points at an `errors.*` dictionary key, so the new message also needs an entry in every locale
4. Confirm `ErrorCategory` in `src/types/errors.ts` has the appropriate category; add one if not
5. If the error is non-recoverable, add it to the `NON_RECOVERABLE` set

## Symptoms

- The frontend shows `UNKNOWN_ERROR` ("An unexpected error occurred") for a failure that has an error type → it was stringified before reaching the command's return, or its variant is mapped to `UnknownError`
- The frontend shows `UNKNOWN_ERROR` for a rejection that never reached the command (a denied permission, an unknown command) → expected; Tauri rejects those with a plain string
- A new `ErrorCode` produces type errors in `src/types/errors.ts` or `src/lib/errors.ts` → the exhaustiveness checks are enforcing coverage; fill in the object and both maps
