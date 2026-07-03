---
paths:
  - "src-tauri/src/whisper/**"
  - ".github/workflows/**"
  - "src-tauri/Cargo.toml"
---

# Known Issues & Workarounds

## whisper-rs 0.15.1–0.16.0: `set_abort_callback_safe` UB Bug

Passing a closure directly to `set_abort_callback_safe` triggers undefined behavior because of a type mismatch in the FFI trampoline. The bug is still present in 0.16.0 source (`whisper_params.rs:621-655`): the trampoline is monomorphized as `trampoline::<F>`, but `user_data` points to a `Box<dyn FnMut() -> bool>`. By contrast, `set_progress_callback_safe` is correctly monomorphized as `trampoline::<Box<dyn FnMut(i32)>>` and is safe.

**Workaround** (`src-tauri/src/whisper/process.rs`):

```rust
// NG: UB
params.set_abort_callback_safe(move || token.is_cancelled());

// OK: boxing into Box<dyn> aligns the trampoline type
let abort_fn: Box<dyn FnMut() -> bool> = Box::new(move || token.is_cancelled());
params.set_abort_callback_safe(abort_fn);
```

**Removal condition**: drop once whisper-rs ships a fixed release.

## whisper.cpp Built-in VAD Ignores `vad_params`

The built-in VAD integration (`enable_vad(true)` + `set_vad_params` on `FullParams`) silently ignores the configured `vad_params` — setting threshold to 0.01 produced results identical to the default (verified experimentally, 2026-05).

**Workaround** (`src-tauri/src/whisper/process.rs`): run Silero VAD standalone via `WhisperVadContext` in `preprocess_with_vad()` — extract speech segments, concatenate, feed the result to whisper, and map timestamps back to the original timeline via `TimestampMap`. Do not "simplify" this back to the built-in integration: it looks cleaner but regresses to having no effective VAD control. Parameter values and their rationale live in `tuning.md` (Current Tuning Examples).

**Removal condition**: whisper.cpp / whisper-rs honors `vad_params` in the built-in integration path.

## CI Build: GGML_NATIVE and SOURCE_DATE_EPOCH

On CI runners, `GGML_NATIVE=ON` (the default) enables newer instruction sets and produces compile errors.

**Workaround** (`.github/workflows/release.yml`): set the `SOURCE_DATE_EPOCH` environment variable — ggml then forces `GGML_NATIVE=OFF` internally.

**Note**: setting `GGML_NATIVE=OFF` directly via environment variable or `CFLAGS` does not work due to cmake-rs limitations. Local builds can stay on the defaults.

## tauri-action 0.5: codesign Auto-Trigger on macOS

`tauri-apps/tauri-action@v0.5` runs the macOS codesign path whenever any of `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` is *present* on the step env — empty strings count as present. This makes "merge build-only and build+release into one step via conditional env values" structurally impossible: an expression like

```yaml
APPLE_CERTIFICATE: ${{ env.IS_RELEASE == 'true' && secrets.APPLE_CERTIFICATE || '' }}
```

still produces an env var, the action invokes `security import` on an empty payload, and the run fails with:

```
security: SecKeychainItemImport: One or more parameters passed to a function were not valid.
failed to bundle project failed codesign application
```

**Implication** (`.github/workflows/release.yml`): keep two `tauri-apps/tauri-action` steps — one for `build-only` with `env: { GITHUB_TOKEN }`, one for `build and release` with the Apple env vars. Do not try to collapse them with `${{ ... || '' }}` env patterns; that was attempted and reverted (see `c906d97` → `f4fee36`).

**Removal condition**: a future tauri-action release adds an explicit `skipCodesign` / `--no-codesign` option, or starts treating empty env values as "skip codesign."
