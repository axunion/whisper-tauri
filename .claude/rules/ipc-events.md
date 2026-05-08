---
paths:
  - "src/types/**"
  - "src/primitives/**"
  - "src-tauri/src/*/commands.rs"
---

# IPC Events (Rust → TypeScript)

| Event | Purpose |
|-------|---------|
| `whisper:progress` | Transcription progress |
| `model:download-progress` | Whisper model download progress |
| `ffmpeg:download-progress` | ffmpeg download progress |
| `recording:level` | Recording level (50ms interval) |
| `text-processing:download-progress` | Text-processing model / llama-server download progress |
| `text-processing:inference-progress` | Inference progress (streaming tokens) |
