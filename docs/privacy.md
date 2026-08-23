# Privacy

Whisper Tauri is built around an **offline-first** principle: your audio and text stay on your machine.

## What never leaves your device

- Audio files and microphone recordings
- Transcription results and timestamps
- AI-generated text (summaries, cleaned transcripts, titles) — the LLM runs locally as a `llama-server` child process on `127.0.0.1`
- Transcription history (a local SQLite database)
- All settings

There is **no telemetry, no analytics, no cloud transcription, and no external LLM API**. Nothing is uploaded anywhere in the normal transcription workflow.

## Every network connection the app can make

The complete list. Each connection is either a one-time download you trigger, or an explicit user action — the app never contacts the network on its own.

| Endpoint | What | When |
| --- | --- | --- |
| `huggingface.co` | Whisper models, Silero VAD model, LLM models (GGUF) | When you download a model (the small VAD model is fetched automatically before your first transcription) |
| `evermeet.cx` | FFmpeg binary (macOS) | When you download FFmpeg during onboarding or from Settings |
| `github.com` | FFmpeg binary (Windows / Linux), `llama-server` binary | Same as above |
| `api.github.com` | Latest release version (`tag_name` only) | Only when you click **Check for updates** in Settings — there is no automatic update check |
| `api.notion.com` | Creating pages in your Notion database | Only when you have configured the Notion integration and explicitly click "Send to Notion" |

After the initial downloads, transcription, recording, AI text processing, and history all work fully offline.

For advanced setups, model download sources can be overridden (for example, to point at an internal mirror) by hand-editing `mirrors.json` in the app's data directory, so even the model download traffic can be kept inside your own network. The two downloads the app makes executable and runs — FFmpeg and `llama-server` — are restricted to their pinned release hosts over HTTPS and cannot be redirected to an arbitrary mirror.

## The Notion integration

The Notion export is **opt-in** and disabled until you configure it:

- It uses your own Notion integration token, which is stored **locally on your device** in the app's settings file (in plain text — treat the file like any other local credential store, and remove the token from Settings if you stop using the integration).
- The token is sent only to `api.notion.com`, only when you test the connection or send a page.
- Only the content you choose to send (the currently selected result tab, plus basic metadata such as recording date and model name) is transmitted.

## Updates

The app does not update itself and does not phone home. Checking for a new version is a manual, user-initiated action, and installing an update is a manual download — see [install.md](install.md).
