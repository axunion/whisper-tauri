# Review instructions

## What Important means here

Reserve Important for findings that break behavior or ship broken UX:
incorrect logic, Rust/TS type mismatches at the IPC boundary, error
prefixes missing from PREFIX_MAP (frontend shows UNKNOWN_ERROR),
plugin calls not covered by capabilities/default.json (silent fail),
and Notion token leakage into logs/errors/IPC payloads.

## Always check

- New/changed serde structs have a matching TypeScript type in src/types/
- New Rust error prefixes are registered in src/lib/errors.ts PREFIX_MAP
- New UI strings go through t() and exist in ALL locales (ja and en)
- New @tauri-apps/plugin-* calls have capabilities entries
- No unwrap()/expect() outside #[cfg(test)]

## Do not report

- src/components/ui/** (vendored solid-ui copy-paste code)
- pnpm-lock.yaml and generated files under src-tauri/gen/
- Plaintext Notion token storage in settings.json (intentional decision)
- Whisper/VAD parameter values (tuning policy lives in .claude/rules/tuning.md)

## Cap the nits

Report at most five Nits per review.
