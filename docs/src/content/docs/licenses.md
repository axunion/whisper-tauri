---
title: Licenses and credits
---

Whisper Tauri bundles no third-party binaries or model weights inside the app itself. Instead, the components below are downloaded on demand — during onboarding or the first time you use a feature — and stored in the app's local data directory. This page lists each redistributed component, its license, and where it comes from.

## Third-party components

| Component | Role | License | Source |
| --- | --- | --- | --- |
| FFmpeg (LGPL build) | Audio format conversion to WAV | [LGPL-2.1-or-later](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) | [ffmpeg.org](https://ffmpeg.org/) · macOS build: [evermeet.cx](https://evermeet.cx/ffmpeg/) · Windows/Linux build: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) |
| llama.cpp (`llama-server`) | Local LLM inference server | [MIT](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE) | [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp) |
| whisper.cpp (via [whisper-rs](https://github.com/tazz4843/whisper-rs)) | Speech-to-text engine | [MIT](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE) | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) |
| Silero VAD model | Voice activity detection | [MIT](https://github.com/snakers4/silero-vad/blob/master/LICENSE) | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) |
| Whisper models (ggml `*.bin`) | Transcription weights | [MIT](https://github.com/openai/whisper/blob/main/LICENSE) | [Hugging Face](https://huggingface.co/) (originally [openai/whisper](https://github.com/openai/whisper)) |
| Gemma models | LLM weights | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) | [Hugging Face](https://huggingface.co/) |
| Qwen models | LLM weights | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | [Hugging Face](https://huggingface.co/) |

## FFmpeg (LGPL)

Whisper Tauri uses an unmodified LGPL build of FFmpeg (without the GPL-licensed `x264` / `x265` / `fdk-aac` encoders, which are not needed for converting audio to WAV). FFmpeg is not statically linked into the app: it is downloaded as a separate executable and invoked as a child process.

The complete corresponding source for the FFmpeg builds is available from [ffmpeg.org](https://ffmpeg.org/download.html), and the exact prebuilt binaries the app downloads come from [evermeet.cx](https://evermeet.cx/ffmpeg/) (macOS) and [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) (Windows / Linux). The full text of the license is available at the [LGPL-2.1 link](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html) above.

## Gemma models

Gemma models are provided under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms), which permit commercial use. Depending on the repository, downloading some Gemma weights from Hugging Face may require a one-time acceptance of the terms while signed in to a Google account.

## Scope

This page covers only the third-party binaries and model weights that Whisper Tauri redistributes or downloads on your behalf. The open-source libraries compiled into the application from source (for example Tauri, SolidJS, and the Rust and TypeScript dependency trees) are ordinary build-time dependencies, not redistributed artifacts, and are governed by their own licenses in their respective repositories.
