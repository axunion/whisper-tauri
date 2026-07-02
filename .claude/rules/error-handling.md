---
paths:
  - "src-tauri/src/*/error.rs"
  - "src-tauri/src/download.rs"
  - "src-tauri/src/update.rs"
  - "src/lib/errors.ts"
  - "src/types/errors.ts"
---

# Error Definition & Sync Rules

Rust-side errors are stringified before crossing into the frontend. The frontend matches by prefix to convert them into `ErrorCode` values, so both sides must stay in sync.

Top-level single-file modules (`download.rs`, `update.rs`) define their error enums inline rather than in a dedicated `error.rs` — the same rules apply there (e.g. `UpdateError` reuses the existing `"HTTP error:"` prefix).

## Rust side (`src-tauri/src/*/error.rs`)

- Define an enum that derives `thiserror::Error`
- Message format: `"Prefix: {0}"` (or just `"Prefix"` for variants without payload). Prefixes start with an uppercase letter
- Do not introduce a new prefix that is synonymous with an existing one (`File not found:`, `IO error:`, `HTTP error:`, `Download failed:`, `Cancelled` family, etc.) — reuse instead
- Always implement `From<XxxError> for String` (because `#[tauri::command]` returns `Result<T, String>`)
- Absorb upstream errors via `#[from]` or hand-written `From` (e.g., `From<std::io::Error>`, `From<reqwest::Error>`, `From<crate::download::DownloadError>`)
- Add a unit test that exercises each variant's `Display` output (mirror the existing `#[cfg(test)] mod tests` block in any current `error.rs`)

## Frontend side (`src/lib/errors.ts` / `src/types/errors.ts`)

When a new error message prefix is introduced on the Rust side, update all of the following:

1. Confirm `ErrorCode` in `src/types/errors.ts` has a matching identifier; add one if not
2. Confirm `ErrorCategory` in `src/types/errors.ts` has the appropriate category; add one if not
3. Add `[<rust-prefix>, ErrorCode]` to `PREFIX_MAP` in `src/lib/errors.ts`
   - **The key string must match the Rust `#[error("...")]` prefix exactly** (including the colon)
   - Matching uses `startsWith`, so place longer prefixes earlier
4. When a new `ErrorCode` is added, add corresponding entries to `CATEGORY_MAP` and `MESSAGE_MAP` (these are `Record<ErrorCodeType, ...>` and require exhaustive coverage)
5. If the error is non-recoverable, add it to the `NON_RECOVERABLE` set

## Symptoms of Forgetting to Sync

- Rust raises an error but the frontend shows `UNKNOWN_ERROR` (displays: "Unexpected error occurred") → the prefix is missing from `PREFIX_MAP`
- A new `ErrorCode` is added and `CATEGORY_MAP` / `MESSAGE_MAP` produce type errors → the `Record` exhaustiveness check is enforcing coverage; fill in both maps
