# Binary Updates

Manual update flow for bundled binaries (ffmpeg / llama-server) and LLM models (GGUF).
**Bundled at major releases**; no in-app auto-update.

Follow this checklist top to bottom before each release.

---

## 1. Scope

| Target | Role | Source | Constants in |
|---|---|---|---|
| **ffmpeg** | Audio format conversion | evermeet.cx (macOS) / BtbN/FFmpeg-Builds (Win/Linux) | `src-tauri/src/converter/downloader.rs` |
| **llama-server** | LLM inference server | github.com/ggml-org/llama.cpp Releases | `src-tauri/src/text_processing/models.rs` |
| **GGUF text models** | LLM weights (gemma-4-e2b / qwen3.5-4b) | HuggingFace | `src-tauri/src/text_processing/models.rs` |

**Out of this flow:**
- Whisper models (`ggml-*.bin`): user-downloaded via Settings, managed inside `whisper` module
- Silero VAD (`ggml-silero-v5.1.2.bin`): pinned, rarely updated

---

## 2. Policy

- **Manual only.** No in-app auto-update — local LLMs are too sensitive to silent regressions
- **Track major releases.** Wait 1–2 cycles before adopting to avoid unreleased breakage
- **CVE alerts override the cadence** (both ffmpeg and llama.cpp have history here)
- **LGPL builds for ffmpeg.** GPL codecs (x264 / x265 / aac-fdk) are not needed for audio → wav
- **Skip incremental `b<N>` releases** of llama.cpp; the upgrade cost outweighs the gain

---

## 3. Files to Update

### ffmpeg

`src-tauri/src/converter/downloader.rs`:

| Constant | Example | Purpose |
|---|---|---|
| `FFMPEG_MACOS_VERSION` | `"8.1"` | evermeet.cx release version |
| `FFMPEG_BTBN_TAG` | `"autobuild-2026-03-26-13-16"` | BtbN/FFmpeg-Builds release tag |
| `FFMPEG_BTBN_BUILD_ID` | `"N-123625-gfd9f1e9c52"` | Build ID in BtbN asset filenames |

Sources:
- macOS: <https://evermeet.cx/ffmpeg/>
- Win/Linux: <https://github.com/BtbN/FFmpeg-Builds/releases>
  - Pick the newest `autobuild-*` tag that ships `*-lgpl.{zip,tar.xz}`
  - Read `build_id` from asset names: `ffmpeg-<BUILD_ID>-<suffix>`

### llama-server

`src-tauri/src/text_processing/models.rs`:

| Constant | Example | Purpose |
|---|---|---|
| `LLAMA_SERVER_VERSION` | `"b8672"` | llama.cpp release tag (`b<N>`) |

Source: <https://github.com/ggml-org/llama.cpp/releases>

Notes:
- `b<N>` increases monotonically. Per-platform asset names (e.g. `llama-{version}-bin-macos-arm64.tar.gz`) are assembled by `get_default_server_url()`
- **Verify CLI flags.** Confirm that flags in `src-tauri/src/text_processing/server.rs` (`--port` / `--ctx-size` / `--threads` etc.) still work with the new version — covered in §4

### GGUF text models

`src-tauri/src/text_processing/models.rs`:

| Location | Purpose |
|---|---|
| `VALID_MODEL_IDS` | Supported IDs — add/remove here |
| `get_model_filename` | ID → GGUF filename mapping |
| `get_default_model_base_url` | HuggingFace base URL (up to `/resolve/main`) |
| `LEGACY_MODEL_IDS` / `legacy_model_filename` | Retired-model cleanup (see `docs/improvements.md` #8) |

Keep i18n in sync:
- `src/i18n/dict-ja.ts` / `src/i18n/dict-en.ts` — `models.text.<id>` (`name` / `description`)

---

## 4. Update Procedure

### 4.1 Pre-flight

- [ ] **Read release notes**
  - [ ] ffmpeg: prioritize any CVE; check for rare backward-incompatible changes
  - [ ] llama-server: check breaking changes (CLI flags / REST API / GGUF format). A `b<N>` jump can span hundreds of commits
  - [ ] GGUF model: check the HuggingFace repo for re-quantization or metadata fixes
- [ ] **License unchanged** (see §5)
- [ ] **CI worker deps unchanged** (e.g. `libwebkit2gtk-4.x` major bump)

### 4.2 Bump constants

- [ ] Update `src-tauri/src/converter/downloader.rs` (ffmpeg, 3 constants)
- [ ] Update `LLAMA_SERVER_VERSION` in `src-tauri/src/text_processing/models.rs` (llama-server)
- [ ] Update model definitions in `src-tauri/src/text_processing/models.rs` (GGUF add/remove)
- [ ] Update i18n in lockstep (`models.text.<id>`)

### 4.3 Re-download locally

The app auto-re-downloads when the version marker (`bin/.ffmpeg-version` / `bin/llama-server.version`) is stale.

- [ ] Launch the app and trigger re-download from DevMenu / Settings, **or** wipe app data and let it re-download on start:
  ```bash
  rm "~/Library/Application Support/com.whisper-tauri.desktop/bin/ffmpeg"
  rm "~/Library/Application Support/com.whisper-tauri.desktop/bin/.ffmpeg-version"
  rm "~/Library/Application Support/com.whisper-tauri.desktop/bin/llama-server"
  rm "~/Library/Application Support/com.whisper-tauri.desktop/bin/llama-server.version"
  ```

### 4.4 Smoke test (golden path)

- [ ] **ffmpeg**: convert several formats (mp3 / m4a / mov / mp4) → wav
- [ ] **llama-server**: launches without crashing via the `text_processing` startup path
- [ ] **clean_text**: short input passes
- [ ] **summary**: short (<1500 chars), medium (1500–5000), long (>5000, chunked path) all pass
- [ ] **chat / generate_title**: both pass
- [ ] **VAD path**: recording → transcription with VAD on and off (sanity-checks the ffmpeg path)

### 4.5 CI / release checks

- [ ] `cargo fmt --all -- --check` / `cargo clippy --all-targets -- -D warnings` / `cargo test`
- [ ] `pnpm check` / `pnpm test:run`
- [ ] Trigger `release.yml` `workflow_dispatch` (build-only) and confirm all 3 OS builds pass
- [ ] Note the update in CHANGELOG / release notes
- [ ] Append any new workaround to `.claude/rules/workarounds.md`

---

## 5. License

| Binary / model | License | Notes |
|---|---|---|
| ffmpeg (BtbN LGPL) | LGPL 2.1+ | No x264 / x265 / aac-fdk; sufficient for wav conversion |
| ffmpeg (evermeet.cx) | LGPL-based (build-dependent) | Re-check the build flags on evermeet.cx before each release |
| llama.cpp | MIT | Permissive for redistribution |
| Gemma | Gemma Terms of Use | Commercial use allowed; some repos require Google account consent on first download |
| Qwen | Apache 2.0 | Commercial use allowed |

If GPL codecs become necessary (video encoding, advanced audio codecs), revisit the distribution model.

---

## 6. API Stability Notes

### llama.cpp

- **REST API is stable** (OpenAI-compatible endpoints such as `/v1/chat/completions`)
- **CLI flags change.** Re-verify flags in `src-tauri/src/text_processing/server.rs` (`--port` / `--ctx-size` / `--threads` / `--n-gpu-layers`) per release
- **GGUF format is largely backward-compatible**, but major bumps (e.g. v3 → v4) can require re-quantization

### ffmpeg

- **CLI flags** (`-i` / `-ar` / `-ac` / `-f wav` / `-vn`) are stable; no incompatibilities expected
- **URL paths on evermeet.cx shift on major version jumps** (path layout changed across 7.x → 8.x)
- **BtbN autobuild tag scheme is stable** (`autobuild-YYYY-MM-DD-HH-MM`); `build_id` (`N-<numeric>-g<hash>`) is derived from a git short hash

---

## 7. Out of Scope

Defer until a concrete need:

- **SHA256 integrity check** (ffmpeg / llama-server / GGUF): requires pulling hashes from 4 sources (evermeet.cx / BtbN / ggml-org / HuggingFace) on every bump. HTTPS is considered sufficient for now; revisit if a CVE or tampering incident appears
- **Startup UI banner**: the comparison API (`ffmpeg_needs_update` / `is_server_version_current`) already exists; a "re-download recommended" banner in Settings is a separate task
- **In-app auto-update**: intentionally avoided to keep behavior reproducible
- **`scripts/check-binary-updates.sh`** (diff pinned vs. latest from each source): not worth the maintenance cost at the current release cadence; revisit if this checklist starts to be skipped
- **Dependabot integration**: ffmpeg / llama-server are pinned outside Dependabot's GitHub-release model; HuggingFace models likewise
