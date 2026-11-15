# AGENTS.md

## Project Overview

Whisper Tauri — a local audio transcription desktop app. Whisper models run entirely on-device; no audio data is sent to external services.

## Testing

Two kinds of checking stay separate here, and only one of them is automatable:

- **Structural correctness** — state transitions, IPC responses, stored rows, formatted
  output: anything with a right answer. Belongs in Vitest or `cargo test` and runs as
  part of verification.
- **Subjective judgment** — "does this look right", spacing, color, UX feel. No
  assertion reliably checks this, and the UI only renders in a WKWebView under
  `pnpm tauri dev`, not in a headless browser. It stays a human-in-the-loop check
  against the running app; don't try to automate it away.

Persist a regression test only for a durable flow worth protecting — ideally one with
evidence it can break. A one-off "let me verify this specific change" check did its job
once and doesn't need to become a permanent file. When unsure whether something is worth
making permanent, ask rather than deciding unilaterally.

## Hard Constraints

- **Type sync**: TypeScript types (`src/types/`) and Rust types (`src-tauri/src/*/types.rs`) must stay in sync. `#[serde(rename_all = "camelCase")]` converts Rust `snake_case` fields to `camelCase` at the IPC boundary.
- **Rust visibility**: no `pub` on items unused outside their module; prefer `pub(crate)` when an item crosses module boundaries but not the crate boundary.
- **Doc trees**: `docs/` is the public tree (English); `spec/` is internal dev documentation (Japanese).

## UI

solid-ui (Kobalte-based, copy-paste model) — https://www.solid-ui.com/docs
