# Configuration & Tuning Policy

Avoid bespoke tuning, post-processing, and input preprocessing whose only purpose is to mask weaknesses in the model or the library. If standard settings are not good enough, accept the weakness as a specification rather than working around it.

## Principles

- **Prefer general, standard settings**. Match the library CLI defaults or the official recommended values.
- When parameters are made explicit, **prefer leaving them unspecified (defer to defaults)** if the value is identical to the standard. Not writing it makes future upgrades easier to track.
- Be **especially careful with post-processing filters, initial-prompt injection, audio padding, and unusual threshold settings**. These carry heavy maintenance burden and tend to become counter-productive after model/library updates.

## Reasoning

- Bespoke tuning loses meaning — or actively backfires — across model/library updates.
- Maintenance burden rarely matches the trade-off.
- When better quality is needed, **changing the model itself** is preferable to tuning.

## When Considering a New Setting

- State explicitly whether the setting is **standard practice** or **a workaround for a weakness**.
- Place workaround-shaped options on the not-recommended side, or do not propose them at all.
- "Accept as specification", "use a different model", and "go back to defaults" should always be on the table as valid options.

## When Tuning Is Acceptable

If experimentation confirms that standard settings are clearly unsuitable for the intended use case (Japanese speech, lecture audio, etc.), tuning is acceptable, but:

- Record the rationale (what behavior fails, in what use case it reproduces) in code comments, the commit message, or memory.
- Make it possible to re-evaluate the choice after future library updates.

### Current Tuning Examples

- Silero VAD `threshold=0.3` / `speech_pad=100`: The defaults `0.5 / 30` were experimentally confirmed to lose substantial speech and clip the start of utterances on lecture audio.
- whisper-rs 0.16 `set_abort_callback_safe` wrapped in `Box<dyn FnMut()>`: Workaround for an FFI type-mismatch bug. See `workarounds.md`.
