# AGENTS.md

Bias toward caution over speed; on trivial tasks, use judgment.

## Project Overview

Whisper Tauri — a local audio transcription desktop app. Whisper models run entirely on-device; no audio data is sent to external services.

## Approach

- **Change scope.** Change only what was requested. Don't "improve" adjacent code,
  comments, or formatting; match the existing style. Delete code your own change makes
  unused, never leave it commented out. Point out pre-existing dead code only; don't
  delete, split, or refactor it unless asked.
- **Implementation size.** Don't add unrequested features, abstractions, or
  configurability. Extract a helper only when it's used in 3+ places; otherwise inline
  it. Don't write error handling for cases that can't happen.
- **Uncertainty.** When more than one interpretation is possible, present the options
  instead of silently picking one.

## Language

Default to the user's language for everything interactive — chat replies, plan-mode
proposals, clarifying questions, and any other back-and-forth during the session.

Switch to English only for durable artifacts: things other people or tools will read
after the session ends — in-code comments, console/log/error output, AI-readable
instruction files, and reader-facing docs (README and the like). Scratch notes and other
throwaway dev artifacts stay in the user's language.

## Code Structure

- Name variables, functions, and files to communicate intent.
- One concern per file; split new code when a file exceeds ~300 lines.
- Rust: keep visibility minimal — no `pub` on items unused outside their module; prefer
  `pub(crate)` when an item crosses module boundaries but not the crate boundary.

## Testing

- Write tests before or alongside implementation — they are your success criteria.
- Test observable outcomes and edge cases, not implementation details.
- Each test is fully self-contained; no shared mutable state between tests.

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

## Commits

Format — plain prose, no prefixes or labels (`feat:`, `fix:`, and the like):

```
<summary: imperative mood, ≤70 chars, no trailing period>

<motivation: one sentence, only when not evident from the diff>

- <change bullets: only for 2+ distinct changes>
```

- Never commit secrets (`*.key`, `*.pem`, `credentials*`).
- Never use `--no-verify`. Use `--amend` only when explicitly asked; default to a new
  commit.

## Hard Constraints

- **Type sync**: TypeScript types (`src/types/`) and Rust types (`src-tauri/src/*/types.rs`) must stay in sync. `#[serde(rename_all = "camelCase")]` converts Rust `snake_case` fields to `camelCase` at the IPC boundary.
- **TypeScript Strict**: `noUncheckedIndexedAccess` / `noImplicitOverride` / `exactOptionalPropertyTypes` are enabled.
- **Doc trees**: `docs/` is the public tree (English); `spec/` is internal dev documentation (Japanese).

## UI

solid-ui (Kobalte-based, copy-paste model) — https://www.solid-ui.com/docs

## Architecture

`AppLayout` + `@solidjs/router` with a sidebar layout.

Backend domain modules under `src-tauri/src/` follow a shared structure: `commands.rs` / `types.rs` / `error.rs` / `mod.rs`. Larger modules such as `text_processing` extend this with `extract.rs` / `inference.rs` / `models.rs` / `server.rs`.
