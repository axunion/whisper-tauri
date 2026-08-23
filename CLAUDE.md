@AGENTS.md

## Claude Code

The import above pulls in `AGENTS.md`, which holds the project context shared with other AI coding tools. The sections below are Claude Code specific.

### Rules (`.claude/rules/`)

Project-specific rules that are auto-injected as system reminders when a matching path is edited.

| File | Purpose |
|---|---|
| `error-handling.md` | Rust `error.rs` prefix naming and sync with `errors.ts::PREFIX_MAP` on the FE side |
| `frontend-conventions.md` | Error-handling consolidation (`parseError` / `ErrorDisplay` / `toast`), `cn()` class composition, SolidJS patterns |
| `i18n.md` | `types.ts` / all locales / `t("…")` sync when UI strings are added or changed |
| `tauri-permissions.md` | `capabilities/default.json` permission checks when using `@tauri-apps/plugin-*` |
| `tuning.md` | Tuning policy — prefer standard settings; do not mask model weaknesses with bespoke processing |
| `ui-design.md` | Glassmorphism / `SectionRow` / `Separator` and other shared UI conventions |
| `workarounds.md` | Workarounds for known bugs (whisper-rs FFI UB / `SOURCE_DATE_EPOCH`, etc.) |
