---
paths:
  - "src-tauri/src/whisper/**"
  - "src-tauri/src/recording/**"
  - "src-tauri/src/text_processing/**"
  - "src-tauri/Cargo.toml"
---

# Configuration & Tuning Policy

Avoid bespoke tuning, post-processing, and input preprocessing whose only purpose is to mask weaknesses in the model or the library — post-processing filters, initial-prompt injection, audio padding, unusual thresholds. They are costly to maintain and tend to backfire after a model or library update. If standard settings are not good enough, accept the weakness as a specification or change the model.

- Match the library CLI defaults or the official recommended values. When a value equals the default, leave it unspecified so upgrades stay easy to track.
- When proposing a setting, state whether it is **standard practice** or **a workaround for a weakness**, and keep "accept as specification", "use a different model", and "go back to defaults" on the table.

## When Tuning Is Acceptable

Only when experimentation confirms that standard settings are clearly unsuitable for the intended use case (Japanese speech, lecture audio, etc.). Record what fails and in which use case it reproduces — in a code comment or the commit message — so the choice can be re-evaluated after a library update.

Current example: Silero VAD `threshold=0.3` / `speech_pad=100`. The defaults `0.5 / 30` were experimentally confirmed to lose substantial speech and clip the start of utterances on lecture audio.
