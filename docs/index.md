---
layout: home

hero:
  name: Whisper Tauri
  text: Local audio transcription, private by design
  tagline: A privacy-first desktop app. All inference runs on-device — your audio never leaves your machine.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Install
      link: /install
    - theme: alt
      text: GitHub
      link: https://github.com/axunion/whisper-tauri

features:
  - icon: 🎙️
    title: Transcribe files and recordings
    details: Transcribe audio and video files (MP3, M4A, FLAC, OGG, AAC, MP4, MKV, WAV) or record directly from your microphone.
  - icon: 💻
    title: On-device Whisper inference
    details: Choose between the small and large-v3-turbo models, with Metal acceleration on Apple Silicon. No cloud, no API keys.
  - icon: ⏩
    title: Silence skipping (VAD)
    details: Silero voice activity detection skips silent sections, significantly reducing transcription time.
  - icon: ✨
    title: AI text post-processing
    details: Summarize, rewrite, and generate titles for transcripts — powered by a local LLM that also runs entirely on your device.
  - icon: 🗂️
    title: History with full-text search
    details: Every transcription is saved locally in a searchable history. Reopen past results to export or post-process them later.
  - icon: 📤
    title: Notion export
    details: Optionally send transcripts or AI-generated text to a Notion database as new pages, using your own integration token.
---

## Private by default

Whisper Tauri is built around an **offline-first** principle: no telemetry, no analytics, no cloud transcription, no external LLM API. After the initial model downloads, everything works fully offline. The only feature that contacts an external service is the opt-in Notion export — and only when you explicitly send a page.

See [Privacy](privacy.md) for the complete list of network connections, and [Licenses](licenses.md) for third-party components.

The interface is available in **Japanese and English**, following your system locale.
