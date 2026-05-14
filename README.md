# Whisper Tauri

A privacy-first desktop app for local audio transcription. All inference runs on-device — audio data never leaves your machine.

## Features

- **Transcription** from audio files (MP3, M4A, FLAC, OGG, AAC, MP4, MKV, WAV) and direct microphone recording
- **On-device Whisper inference** with model selection from `small` to `large-v3` (Metal acceleration on Apple Silicon)
- **Silero VAD** for skipping silence during transcription, significantly reducing processing time
- **AI text post-processing** via local LLM — summarization, transcript cleanup, automatic title generation
- **History management** with full-text search, AI-content reuse, and export
- **Notion export** — send transcripts or AI-generated text to a Notion database as new pages, using your own integration token
- **Internationalization** (Japanese / English) with system locale detection

## Privacy & Architecture

Whisper Tauri is designed around an **offline-first** principle: there is no telemetry, no cloud transcription, no external LLM API. The only network traffic is one-time downloads of the Whisper / VAD / LLM model files and supporting binaries (FFmpeg, `llama-server`).

After initial setup, the app runs fully offline. The optional **Notion export** is the only feature that contacts an external service — and it only does so when the user explicitly clicks "Send to Notion", using the user's own integration token stored locally on the device.

## Tech Stack

### Frontend

- [SolidJS](https://www.solidjs.com/) + TypeScript with the `@solidjs/router` for routing
- [solid-ui](https://www.solid-ui.com/) (Kobalte / Corvu) for accessible primitives
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- Vite (bundler) + Vitest (tests) + [Biome](https://biomejs.dev/) (lint / format)

### Backend

- [Tauri 2](https://tauri.app/) for the application shell and IPC
- [whisper-rs](https://crates.io/crates/whisper-rs) `0.16` — bindings to `whisper.cpp`, with the `metal` feature enabled on macOS
- [cpal](https://crates.io/crates/cpal) for cross-platform microphone capture
- [Symphonia](https://crates.io/crates/symphonia) for audio decoding (MP3, FLAC, OGG, AAC, ISO/MP4, MKV, WAV)
- [rusqlite](https://crates.io/crates/rusqlite) (`bundled-full`) for the local history database
- [tokio](https://tokio.rs/), [reqwest](https://crates.io/crates/reqwest), [thiserror](https://crates.io/crates/thiserror)

`unsafe_code = "forbid"` is enforced project-wide; clippy is run with `pedantic` plus `unwrap_used` / `expect_used` warnings.

### Bundled / Auto-downloaded Components

These components are downloaded into the app's data directory on first use, not bundled inside the binary:

| Component | Source | Purpose |
| --- | --- | --- |
| **FFmpeg** (LGPL) | [evermeet.cx](https://evermeet.cx/ffmpeg/) (macOS), [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) (Windows / Linux) | Decoding non-WAV inputs and resampling to Whisper's 16 kHz mono PCM format |
| **`llama-server`** (MIT) | [`ggml-org/llama.cpp` releases](https://github.com/ggml-org/llama.cpp/releases) — pinned at `b8672` | Local LLM inference HTTP server, managed as a child process with idle timeout |
| **Whisper models** (MIT) | [`ggerganov/whisper.cpp` on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp) | GGML format (`.bin`), user-selectable size |
| **Silero VAD** | [`ggml-org/whisper-vad` on Hugging Face](https://huggingface.co/ggml-org/whisper-vad) | Voice activity detection for skipping silence |
| **LLM models** | [Hugging Face GGUF mirrors](https://huggingface.co/) | User-selectable, see below |

## Models

### Whisper (transcription)

| ID | Size | Notes |
| --- | --- | --- |
| `small` | ~466 MB | Lightweight, fast |
| `medium` | ~1.4 GB | Balanced accuracy and speed |
| `large-v3-turbo` | ~1.6 GB | Distilled — fast with good accuracy |
| `large-v3` | ~2.9 GB | Highest accuracy, best for demanding multilingual use |

Apple Silicon Metal acceleration delivers roughly 10× the throughput of x86_64 CPU inference for the same model.

### LLM (text post-processing)

| ID | Size | Notes |
| --- | --- | --- |
| `gemma-4-e2b` | ~3.5 GB | Google Gemma — Apache 2.0, 128K context, CJK-optimized |
| `qwen3.5-4b` | ~2.7 GB | Alibaba Qwen — 201 languages, strong Japanese benchmarks |

Both are distributed in `Q4_K_M` GGUF quantization. `llama-server` is started on demand and shut down after an idle period.

## Installation

End-user installation guide: **[docs/install.md](docs/install.md)**.

Releases are published to the [GitHub Releases page](../../releases). macOS builds are unsigned; the included `Install.command` strips the quarantine attribute and copies the app to `/Applications`.

## Development

```bash
pnpm install            # Install frontend dependencies
pnpm tauri dev          # Start the dev server (hot reload for both Rust and TS)
pnpm tauri build        # Production build

pnpm test:run           # Frontend tests (single run)
pnpm check              # Biome (lint + format) + tsc --noEmit
pnpm fix                # Biome auto-fix
pnpm typecheck          # tsc --noEmit (standalone)

cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt   --manifest-path src-tauri/Cargo.toml
```

See [CLAUDE.md](CLAUDE.md) for project conventions, directory layout, and the full command reference.

## Project Structure

```
src/                       # SolidJS frontend
├── components/            # ui, layout, dashboard, onboarding, settings, history, ...
├── pages/                 # Transcription, History, Settings, DevMenu
├── primitives/            # State management primitives (signals / stores)
├── i18n/                  # ja / en dictionaries
├── lib/                   # Utilities
└── types/                 # Shared TypeScript types (mirroring Rust serde shapes)

src-tauri/                 # Rust backend
└── src/
    ├── whisper/           # Transcription with whisper-rs (+ Silero VAD)
    ├── recording/         # Microphone capture (cpal) and sleep prevention
    ├── converter/         # Audio format conversion via FFmpeg
    ├── history/           # SQLite history database with full-text search
    ├── text_processing/   # llama-server lifecycle and LLM inference
    └── notion/            # Notion API client for exporting pages

docs/                      # End-user and contributor documentation
```

## Platform Support

- **macOS**: Apple Silicon, macOS 10.15 (Catalina) or later. Whisper inference uses Metal.
- **Windows**: x64. CPU inference.
- **Linux**: x64. CPU inference.

## License

This project is licensed under the [MIT License](#) (see `package.json`).

Bundled and downloaded third-party components retain their respective licenses:

- **whisper.cpp / whisper-rs / llama.cpp**: MIT
- **FFmpeg**: LGPL — distributed binaries from evermeet.cx and BtbN are LGPL builds
- **Whisper models** (OpenAI): MIT
- **Tauri / SolidJS / Tailwind**: MIT
- **Silero VAD**, **Gemma**, **Qwen**: subject to their upstream licenses — review terms before redistribution or commercial use
