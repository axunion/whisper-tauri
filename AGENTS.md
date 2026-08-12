# AGENTS.md

> Shared project context for AI coding tools. Claude Code reads it through `@AGENTS.md` at the top of `CLAUDE.md`, which carries the Claude-specific sections below the import.

Behavioral defaults plus house conventions. Bias toward caution over speed; on trivial
tasks, use judgment.

## Project Overview

Whisper Tauri — a local audio transcription desktop app. Whisper models run entirely on-device; no audio data is sent to external services.

## Approach

- **Think before coding.** State assumptions. Make routine judgment calls yourself and
  note them; ask only when different interpretations would lead to materially different
  work. If a simpler path exists, say so and push back when warranted.
- **Simplest thing that works.** Write the minimum code that solves the stated problem —
  nothing speculative. No unasked-for abstractions, flexibility, or error handling for
  impossible cases. If 200 lines could be 50, rewrite it.
- **Surgical changes.** Every changed line should trace to the request. Don't refactor,
  reformat, or "improve" adjacent code that isn't broken; match the surrounding style.
  Remove only the imports and symbols your change orphaned; leave unrelated dead code alone
  and mention it.
- **Goal-driven.** Turn each task into a verifiable outcome ("fix the bug" → "write a
  failing test that reproduces it, then make it pass"). For multi-step work, state a brief
  plan before starting.

## Language

Write all durable artifacts in **English** — in-code comments, console output, error and
log messages, AI-readable instruction files, and docs meant for readers (README and the
like).

Everything else follows the user's language: chat replies, and any document that only
exists during development (scratch notes, planning notes, temporary docs not meant to
ship).

## Code Structure

- Name variables, functions, and files to communicate intent.
- One concern per file; split new code when a file exceeds ~300 lines. Don't split
  existing files unless asked.
- Extract a helper only when used in 3+ places; otherwise inline it.
- Delete dead code you create; never comment it out.

## Testing

- Write tests before or alongside implementation — they are your success criteria.
- If the project has no test setup, ask briefly: introduce one, or verify another way?
- Test observable outcomes and edge cases, not implementation details.
- Each test is fully self-contained; no shared mutable state between tests.

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

## Development Commands

```bash
pnpm tauri dev                  # Dev server
pnpm test:run / cargo test      # Tests (pnpm test is interactive; test:run for one-shot runs)
pnpm check / cargo clippy       # Biome (lint + format) + tsc / Rust lint
pnpm fix / cargo fmt            # Auto-fix
pnpm typecheck                  # Type-check only (tsc --noEmit)
pnpm tauri build                # Production build
```

## UI

solid-ui (Kobalte-based, copy-paste model) — https://www.solid-ui.com/docs

## Architecture

`AppLayout` + `@solidjs/router` with a sidebar layout. `collapsible="icon"` enables icon-only collapse.

Backend domain modules under `src-tauri/src/` follow a shared structure: `commands.rs` / `types.rs` / `error.rs` / `mod.rs`. Larger modules such as `text_processing` extend this with `extract.rs` / `inference.rs` / `models.rs` / `server.rs`.
