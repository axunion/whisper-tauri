# Getting Started

This guide walks you through everything from first launch to your first transcription, AI post-processing, and the optional Notion integration.

## 1. Install the app

Follow the [Installation Guide](install.md) for your OS. Builds are currently unsigned, so macOS and Windows show a one-time security warning — the guide covers the approval steps.

## 2. First launch: setup wizard

On first launch, a short setup wizard downloads the components the app needs. Everything is stored in the app's local data directory.

1. **Welcome** — choose the interface language (Japanese / English) and theme.
2. **Whisper model** — download at least one transcription model. This step is required:
   - `small` (~466 MB): lightweight and fast.
   - `large-v3-turbo` (~1.6 GB): higher accuracy, still fast thanks to distillation.
3. **FFmpeg** — used to convert audio files other than WAV (MP3, M4A, and so on). Skippable, but recommended.
4. **AI Text Processing** — download a local LLM to enable summarization, rewriting, and title generation. Skippable.
5. **All Set!** — review what's installed and start using the app.

Anything you skip can be downloaded later from **Settings**. The dashboard shows a setup banner listing whatever is still missing.

## 3. Transcribe an audio file

1. Open the **Transcription** page and stay on the **File** tab.
2. Click the file area to select an audio or video file (WAV, MP3, M4A, FLAC, OGG, AAC, MP4, MOV, etc.). The app shows the duration and an estimated processing time.
3. Pick a **model**, and set **Audio Language** if you know it (Auto-detect works well, but an explicit language is more reliable).
4. Leave **VAD** enabled to skip silent sections — it can shorten processing considerably.
5. Click **Start Transcription**. Non-WAV files are converted with FFmpeg first, then transcribed with a progress bar and remaining-time estimate. You can cancel at any time.

When it finishes, the result opens automatically and is saved to **History**.

## 4. Record from the microphone

1. On the **Transcription** page, switch to the **Record** tab.
2. Choose an input device (or keep **Default**) and press the microphone button to start. The first time you record, the OS asks for microphone permission.
3. Press stop when you're done. You can save the recording as a WAV file or discard it.
4. Click **Start Transcription** to transcribe the recording.

## 5. Work with the result

The result viewer has two tabs by default:

- **Text** — the plain transcript.
- **Timeline** — segments with timestamps.

The toolbar in the top-right corner offers:

- **AI Processing** — see the next section.
- **Share** — send to Notion (once configured).
- **Save** — export the current tab: Plain Text (`.txt`), Subtitles (`.srt`), or Web Subtitles (`.vtt`).
- **Copy** — copy the current tab's content to the clipboard.

Click the file name to edit the entry's title.

## 6. AI text processing

With an AI model installed (wizard step 4, or **Settings → Language Model Management**), the **AI Processing** menu offers:

- **Summarize** — a structured summary with TL;DR, key points, keywords, and action items. Appears as a **Summary** tab; exports as Markdown.
- **Rewrite** — a cleaned-up version of the transcript (filler words removed, punctuation fixed). Appears as a **Rewrite** tab.
- **Generate Title** — a concise title for the entry.

Everything runs on a local `llama-server` process — no text is sent to any external API. If the AI model isn't installed yet, the app shows a setup dialog that takes you to Settings.

## 7. History

Every transcription is stored locally in the **History** page:

- **Search** the full text of all transcripts (3+ characters).
- Filter by period (7 days / 30 days / all) and sort by date, length, or name.
- Click an entry to reopen it in the same result viewer — you can run AI processing, export, or send to Notion on past entries at any time.
- Use **Select** to delete multiple entries at once. Deletion is permanent.

## 8. Notion export (optional)

The Notion integration is opt-in and disabled until you configure it:

1. In Notion, create an internal integration (Settings → Connections → Develop or manage integrations) and copy its token.
2. Share the target database with that integration, and copy the database ID from its URL.
3. In the app, open **Settings → Notion Integration → Connect**, paste the **API Token** and **Database ID**, and click **Save & Connect**. The app verifies the connection immediately.
4. From any result, use **Share → Send to Notion**. The content of the currently active tab (Text, Timeline, Summary, or Rewrite) is sent as a new page, along with basic metadata.

The token is stored only on your device. See [Privacy](privacy.md#the-notion-integration) for details.

## 9. Settings and updates

The **Settings** page covers everything else:

- **General** — interface language, theme, VAD default, and **App Updates**: click **Check Now** to compare your version against the latest GitHub release. The app never checks automatically.
- **Audio Model Management** — download or delete Whisper models.
- **Language Model Management** — download or delete AI models and the inference server.
- **Tool Management** — manage the FFmpeg binary.
- **Notion Integration** — as described above.

Updating the app itself is a manual download — see [Updating](install.md#updating).
