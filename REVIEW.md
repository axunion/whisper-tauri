# Review instructions

## What Important means here

Reserve Important for findings that break behavior or ship broken UX:
incorrect logic, a Rust IPC change without the regenerated
src/bindings.ts, an error variant mapped to the wrong ErrorCode (frontend
shows the wrong message or hides the retry),
plugin calls not covered by capabilities/default.json (silent fail),
and Notion token leakage into logs/errors/IPC payloads.

## Always check

- Changed commands, events or IPC types come with the regenerated src/bindings.ts, and src/bindings.ts is never edited by hand
- New commands carry #[specta::specta] and are listed in lib.rs::ipc_builder
- New error variants are given a deliberate ErrorCode in the enum's From<...> for IpcError
- The frontend calls the backend through commands.* / events.*, not invoke() / listen()
- New UI strings go through t() and exist in ALL locales (ja and en)
- New @tauri-apps/plugin-* calls have capabilities entries
- No unwrap()/expect() outside #[cfg(test)]
- reqwest URLs are built with Url::parse + query_pairs_mut, not format!
- SQL uses ? parameter binding, never string concatenation
- Child-process arguments use Command::arg array form, never shell strings
- User-supplied paths are validated against traversal (no raw .. joins)

## Do not report

- src/components/ui/** (vendored solid-ui copy-paste code)
- pnpm-lock.yaml, src/bindings.ts and generated files under src-tauri/gen/
- Plaintext Notion token storage in settings.json (intentional decision)
- Whisper/VAD parameter values (tuning policy lives in .claude/rules/tuning.md)
- Missing rate limiting on the Notion client (single-user desktop app)
- Unsigned/unverified Whisper model downloads (user-initiated large binaries)

## Nits

Report every Nit you find, grouped under a single Nit section so the list stays skimmable.
