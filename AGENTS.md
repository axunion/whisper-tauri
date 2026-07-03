# AGENTS.md

> **Sync note:** This file is a mirror of `CLAUDE.md`. When you edit this file, apply the identical change to `CLAUDE.md` in the same commit.

Behavioral rules first, project reference below. Bias toward caution over speed; on trivial tasks, use judgment.

## Project Overview

Whisper Tauri — a local audio transcription desktop app. Whisper models run entirely on-device; no audio data is sent to external services.

## Approach

- **Think before coding.** State assumptions; if uncertain, ask. When multiple interpretations exist, surface them rather than silently picking one. If a simpler path exists, say so and push back when warranted.
- **Simplest thing that works.** Write the minimum code that solves the stated problem — nothing speculative. No unasked-for abstractions, flexibility, or error handling for impossible cases. If 200 lines could be 50, rewrite it.
- **Surgical changes.** Every changed line should trace to the request. Don't refactor, reformat, or "improve" adjacent code that isn't broken; match the surrounding style. Remove only the imports and symbols your change orphaned; leave unrelated dead code alone and mention it.
- **Goal-driven.** Turn each task into a verifiable outcome ("fix the bug" → "write a failing test that reproduces it, then make it pass"). For multi-step work, state a brief plan with a verification check per step, then loop until it passes.

## Language

Write in **English only**: in-code comments, console output, error and log messages, and AI-readable config files (CLAUDE.md, AGENT.md, etc.).
Exceptions:
- User-facing UI strings go through the i18n dictionaries (ja/en) — never hardcode them (see `.claude/rules/i18n.md`).
- Documentation trees: `docs/` is the public tree and English-only (future GitHub Pages source); `spec/` holds internal dev/spec documentation and is written in **Japanese**.

## Testing

- **TDD**: write tests before or alongside implementation — they are your success criteria. Visual UI verification is the only exception.
- Test observable outcomes and edge cases, not implementation details.
- Each test is fully self-contained; no shared mutable state between tests.

## Hard Constraints

- **Type sync**: TypeScript types (`src/types/`) and Rust types (`src-tauri/src/*/types.rs`) must stay in sync. `#[serde(rename_all = "camelCase")]` converts Rust `snake_case` fields to `camelCase` at the IPC boundary.
- **TypeScript Strict**: `noUncheckedIndexedAccess` / `noImplicitOverride` / `exactOptionalPropertyTypes` are enabled.

## Development Commands

```bash
pnpm tauri dev                  # Dev server
pnpm test:run / cargo test      # Tests (pnpm test is interactive; test:run for one-shot runs)
pnpm check / cargo clippy       # Biome (lint + format) + tsc / Rust lint
pnpm fix / cargo fmt            # Auto-fix
pnpm typecheck                  # Type-check only (tsc --noEmit)
pnpm tauri build                # Production build

/verify [frontend|backend|all]  # Validate — run before every commit
/refactor-fe <target>           # Frontend refactoring
/refactor-be <target>           # Backend refactoring
/add-command <mod> <cmd>        # Add a Tauri command (FE + BE in one pass)
/add-module <name>              # Scaffold a new backend module
/i18n                           # i18n quality audit
/smoke [skip-build]             # Pre-release smoke test on a real build
/release [version]              # Release driver (tag push → CI monitoring)
```

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS v4
- **UI**: solid-ui (Kobalte-based, copy-paste model) — https://www.solid-ui.com/docs
- **Backend**: Rust + Tauri 2 + whisper-rs
- **State**: SolidJS Primitives (createSignal, createStore)
- **Persistence**: tauri-plugin-store / SQLite (history)
- **Package Manager**: pnpm

## Architecture

### Frontend (src/)

```
src/
├── components/    # ui, layout, dashboard, onboarding, settings, history, transcription, text-processing, dev
├── pages/         # Transcription, History, Settings, DevMenu
├── primitives/    # State management primitives
├── i18n/          # Internationalization (ja/en)
├── lib/           # Utilities
├── types/         # Type definitions
└── styles/        # Custom CSS
```

`AppLayout` + `@solidjs/router` with a sidebar layout. `collapsible="icon"` enables icon-only collapse.

### Backend (src-tauri/src/)

```
src-tauri/src/
├── lib.rs / main.rs   # Entry points · invoke_handler registration
├── download.rs        # Generic download helper
├── paths.rs           # App directory resolution
├── settings.rs        # tauri-plugin-store wrapper
├── whisper/           # Transcription (whisper-rs)
├── converter/         # File conversion (ffmpeg)
├── history/           # History (SQLite)
├── recording/         # Real-time recording (cpal)
├── text_processing/   # Text processing (llama-server + LLM)
└── notion/            # Notion API integration (reqwest)
```

Domain modules follow a shared structure: `commands.rs` / `types.rs` / `error.rs` / `mod.rs`. Larger modules such as `text_processing` extend this with `extract.rs` / `inference.rs` / `models.rs` / `server.rs`.

## Code Structure

- Name variables, functions, and files to communicate intent.
- One concern per file; split when a file exceeds ~300 lines.
- Extract a helper only when used in 3+ places; otherwise inline it.
- Delete dead code you create; never comment it out.

## Git Commits

- Title: one-line imperative English summary, ≤70 chars, no trailing period. No Conventional Commits prefix (`feat:` / `fix:` etc.) and no AX-tags.
- **For non-obvious changes** (new features, design decisions, refactor rationale, behavior fixes) add a blank line then a 2–3 paragraph body:
  - What changed (summary of major hunks)
  - Why (background, alternatives considered and rejected)
  - Items explicitly left out / follow-up tasks
- For simpler commits, a short body is enough: a one-sentence Why (only when the motivation is not evident from the diff) plus a bullet per distinct change (only for 2+ distinct changes).
- If the commit includes a `spec/improvements.md` status update, mention it briefly at the end.
- Good past examples: `7a48eed` (saving + permission), `574f270` (legacy cleanup), `416803b` (model drop).
- Never commit secrets (`*.key`, `*.pem`, `credentials*`).
- Never use `--no-verify` or `--amend`; always create a new commit.

## Rules (`.claude/rules/`)

Project-specific rules that are auto-injected as system reminders when a matching path is edited.

| File | Purpose |
|---|---|
| `error-handling.md` | Rust `error.rs` prefix naming and sync with `errors.ts::PREFIX_MAP` on the FE side |
| `i18n.md` | `types.ts` / all locales / `t("…")` sync when UI strings are added or changed |
| `ipc-events.md` | Reference of Rust → TS event names (`whisper:progress`, etc.) |
| `tauri-permissions.md` | `capabilities/default.json` permission checks when using `@tauri-apps/plugin-*` |
| `tuning.md` | Tuning policy — prefer standard settings; do not mask model weaknesses with bespoke processing |
| `ui-design.md` | Glassmorphism / `SectionRow` / `Separator` and other shared UI conventions |
| `workarounds.md` | Workarounds for known bugs (whisper-rs FFI UB / `SOURCE_DATE_EPOCH`, etc.) |
