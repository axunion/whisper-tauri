---
paths:
  - "src/types/**"
  - "src/primitives/**"
  - "src-tauri/src/*/commands.rs"
---

# IPC イベント (Rust → TypeScript)

| イベント | 用途 |
|---------|------|
| `whisper:progress` | 文字起こし進捗 |
| `whisper:result` | 文字起こし結果 |
| `model:download-progress` | Whisperモデル DL進捗 |
| `ffmpeg:download-progress` | ffmpeg DL進捗 |
| `recording:level` | 録音レベル (50ms間隔) |
| `text-processing:download-progress` | テキストモデル/llama-server DL進捗 |
| `text-processing:inference-progress` | 推論進捗（ストリーミングトークン） |
