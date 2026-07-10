# FAQ

## Installation

### macOS says the app "could not be verified" — is it safe?

Yes, this is expected. Pre-release builds are not signed with an Apple Developer certificate, so macOS blocks the first launch of anything downloaded from the internet. The [Installation Guide](install.md#macos-apple-silicon) walks through the one-time approval (**System Settings → Privacy & Security → Open Anyway**).

### Windows SmartScreen blocks the installer

Also expected for unsigned builds. Click **More info → Run anyway**. See the [Installation Guide](install.md#windows).

### How do I update the app?

Install the new version over the old one — your settings, history, and models are kept. See [Updating](install.md#updating). You can check for new versions from within the app: **Settings → App Updates → Check Now**.

## Models and disk space

### How much disk space do I need?

It depends on what you download:

| Component | Size |
| --- | --- |
| Whisper `small` | ~466 MB |
| Whisper `large-v3-turbo` | ~1.6 GB |
| LLM `gemma-4-e2b` (optional) | ~3.5 GB |
| LLM `qwen3.5-4b` (optional) | ~2.7 GB |
| FFmpeg + `llama-server` binaries | tens of MB |

A minimal setup (Whisper `small` + FFmpeg) is around 0.5 GB; a full setup with `large-v3-turbo` and an LLM is 3–5 GB. Models can be deleted from Settings at any time.

### Which Whisper model should I choose?

Start with `large-v3-turbo` if you have the disk space — it is distilled, so it is both fast and accurate. Use `small` on tight disk space or slower machines.

### What is VAD?

Voice activity detection (Silero VAD). It detects silent sections and skips them during transcription, which can shorten processing time significantly on recordings with pauses. It is enabled by default and can be toggled per run or in Settings.

## Privacy and offline use

### Does the app work offline?

Yes. After the initial downloads (models and binaries), transcription, recording, AI processing, and history all work fully offline. See [Privacy](privacy.md) for the complete list of network connections the app can make — each one is user-initiated.

### Is my audio or text uploaded anywhere?

No. All transcription and AI inference runs on your device. The only feature that sends content to an external service is the opt-in [Notion export](getting-started.md#_8-notion-export-optional), and only when you explicitly click "Send to Notion".

## Usage

### Which audio formats are supported?

WAV directly; MP3, M4A, FLAC, OGG, AAC, MP4, MOV, MKV and similar formats via FFmpeg conversion (downloaded during setup or from Settings).

### The app asks for microphone access

macOS (and other OSes) show a system permission prompt the first time you start a recording. This is standard for any app that records audio — audio is processed locally only.

### Which languages are supported?

- **Interface**: Japanese and English, following your system locale (changeable in Settings).
- **Audio**: auto-detection, or an explicit language (Japanese, English, Chinese, Korean, French, German, Spanish). Whisper itself supports many more languages via auto-detect.

### Where is my data stored?

Everything lives in a per-user application data directory (settings, history database, models, binaries). The exact paths per OS are listed in the [Uninstall section](install.md#uninstall) of the Installation Guide. Updates never touch this directory.

### AI features say "AI Setup Required"

The AI actions need a local language model. Download one from **Settings → Language Model Management** (or during the setup wizard). The inference server is fetched automatically together with the model.
