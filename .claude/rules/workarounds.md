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

## CI Build: GGML_NATIVE and SOURCE_DATE_EPOCH

On CI runners, `GGML_NATIVE=ON` (the default) enables newer instruction sets and produces compile errors.

**Workaround** (`.github/workflows/release.yml`): set the `SOURCE_DATE_EPOCH` environment variable — ggml then forces `GGML_NATIVE=OFF` internally.

**Note**: setting `GGML_NATIVE=OFF` directly via environment variable or `CFLAGS` does not work due to cmake-rs limitations. Local builds can stay on the defaults.
