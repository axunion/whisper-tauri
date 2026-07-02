---
name: smoke
description: Pre-release smoke test on a real build. Builds the app with `tauri build --debug`, then walks the user through an on-device checklist covering transcription, recording, file saves, integrations, and settings persistence. Use before tagging a release, or after changes to capabilities, Info.plist-related config, recording, or file-save paths. Catches silent failures that `tauri dev` cannot reproduce.
argument-hint: "[skip-build]"
user-invocable: true
---

# /smoke — Pre-Release Smoke Test

Drives a manual smoke test against a **real build**. Two classes of bugs do not reproduce under `pnpm tauri dev`:

- **Capabilities silent failures**: a missing permission in `src-tauri/capabilities/default.json` rejects the Promise (`<command> not allowed`), and a `try/catch` can swallow it. See `.claude/rules/tauri-permissions.md` — the 2026-05-20 incident shipped three broken save paths that dev-time testing missed.
- **Bundle-only behavior**: `tauri dev` does not produce a `.app`, so Info.plist-driven behavior (permission prompt wording, file associations, etc.) only appears in a built bundle.

Claude drives the checklist and records results; the user performs each step in the running app and reports back.

## Phase 0 — Build

Skip this phase only when `$ARGUMENTS` contains `skip-build` (the user already has a fresh build).

```bash
pnpm tauri build --debug
```

- `--debug` skips release optimization for faster turnaround while still producing a real bundle.
- On build failure: report and stop. Suggest `/verify all --with-build` to isolate the cause.
- On success: print the bundle path (`src-tauri/target/debug/bundle/macos/`) and ask the user to launch the `.app` (not the dev server).

## Phase 1 — Checklist

Walk through the groups below **one group at a time**, collecting pass/fail via `AskUserQuestion` (multiSelect over the group's items, asking which items passed) or free-form notes. If the release only touched a specific area, the user may skip unrelated groups — record every skip with its reason.

### A. Launch & Shell
- App launches from the built bundle
- Sidebar navigation works; UI locale matches the OS / setting (ja/en)

### B. Transcription (core)
- Audio file transcription completes; progress updates render
- Non-WAV input converts via ffmpeg (first-run download prompt appears if applicable)
- Cancel mid-transcription works without a crash

### C. Recording
- Mic permission prompt appears with correct wording (bundle-only behavior)
- Level meter animates; stopping yields a transcribable take
- WAV save to a user-selected location writes a real file (capabilities: `copyFile`)

### D. Saves & Export (capabilities-sensitive)
- Text tab save writes a real file — verify on disk (`writeTextFile`)
- Timeline tab save writes a real file — verify on disk
- Summary / clean-text tab save writes a real file — verify on disk
- Copy-to-clipboard copies the active tab's content

### E. Integrations
- Notion send succeeds — or fails with a readable error, never silently
- Text processing (summary / clean text) runs; llama-server starts and streams
- Manual update check reports a result (GitHub Releases API)

### F. Settings & History
- Model download progress renders; switching models takes effect
- History entries survive an app restart
- Settings survive an app restart

## Phase 2 — Report

```
## Smoke Test Result
- Build:   debug bundle v<version>
- Passed:  <n>/<total>
- Failed:  <item — symptom notes>
- Skipped: <item — reason>
- Verdict: GO / NO-GO
```

Triage hints:

- Any failure in group C/D save paths → check `src-tauri/capabilities/default.json` first; see `.claude/rules/tauri-permissions.md`.
- A permission prompt or bundle-behavior anomaly → remember `tauri dev` cannot reproduce it; iterate with `tauri build --debug`.
- Record newly discovered known issues in `notes/improvements.md` or `.claude/rules/workarounds.md` (with removal conditions) as appropriate.
