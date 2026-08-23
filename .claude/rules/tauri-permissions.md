---
paths:
  - "src-tauri/capabilities/**"
  - "src/components/**"
  - "src/pages/**"
  - "src/primitives/**"
  - "src/lib/**"
---

# Tauri 2 Plugin Permissions

When calling `@tauri-apps/plugin-*` APIs from the frontend, always verify that the required commands are registered in `src-tauri/capabilities/default.json`.

## Background

- `fs:default` / `dialog:default` / `store:default` and similar `*:default` bundles include only a core subset of commands.
- In particular, `fs:default` does **not** include write operations such as `writeTextFile` / `writeFile` / `copyFile` / `renameFile` / `removeFile`.
- Write operations must be added individually as explicit permission entries. An `allow` scope is needed only for paths the app derives itself; dialog-picked paths are covered at runtime (see below).

## Example: saving a user-selected file

```json
{
  "permissions": [
    "fs:default",
    "fs:allow-write-text-file",
    {
      "identifier": "fs:allow-copy-file",
      "allow": [{ "path": "$APPDATA/recordings/*" }]
    }
  ]
}
```

Grant the identifier with **no `allow` scope** when every target path comes from a
native dialog. `tauri-plugin-dialog`'s `open`/`save` commands call
`fs_scope.allow_file(path)` on the picked path, and `tauri-plugin-fs::resolve_path`
accepts a path allowed by *either* the runtime scope or the static one — so the
dialog result is writable while nothing else is. A non-existent path (the normal
case for `save`) is matched literally rather than canonicalized, so new files work.

- A static `allow` scope is a fallback for paths the app itself derives, not for
  dialog results. Prefer no scope over a broad one.
- Never write a static `$HOME/**` or `**` scope for a write command: it also covers
  `~/Library/LaunchAgents`, `~/.zshrc`, and `~/.ssh`, so any future script
  injection in the webview would reach persistence-grade code execution.
- `copyFile` resolves **both** arguments against the scope, so the `from` side
  needs its own entry when it is not dialog-picked — hence `$APPDATA/recordings/*`
  above for the recording WAV. A command scope and the runtime dialog scope are
  OR-ed, so adding one does not disable the other.

## Checklist (when adding a new plugin API)

1. Check official docs or `src-tauri/gen/schemas/` to confirm whether the command is included in the plugin's `*:default` bundle.
2. If not included, add the individual `fs:allow-<command>` (or equivalent) identifier to `capabilities/default.json`.
3. Keep scope as narrow as possible — no `allow` scope at all when the path always comes from a dialog.
4. **Restart the dev server** after editing capabilities — changes are read at Tauri startup and are not picked up by HMR.
5. Test the actual API call on a real device to confirm there are no silent failures.

## Common Pitfalls

- **Silent fail**: insufficient permission causes a Promise rejection such as `<command> not allowed`. If the frontend swallows errors in a `try/catch`, the failure is invisible. Always log with `catch (err) { console.error(err); ... }` during debugging.
- **Scope mismatch**: the identifier is registered but the `allow` scope does not cover the target path — produces the same rejection as a missing identifier.
- **HMR does not apply**: capabilities files are unrelated to hot module replacement. A dev-server restart is mandatory.

## Past Incidents

- **2026-08-21** — Security review follow-up: the `$HOME/**` write scope on
  `fs:allow-write-text-file` / `fs:allow-copy-file` was removed in favour of the
  dialog plugin's runtime scope. **Requires device verification** of the three
  save paths (text/timeline tab save, summary & clean-text tab save, recording
  WAV save) — the failure mode is exactly the 2026-05-20 silent failure below.
- **2026-05-20** — While implementing #16 (enable save button in summary/clean-text tabs), silent failures were discovered in the text and timeline tab saves (`writeTextFile`) and the recording WAV save (`copyFile`) as well. Root cause: `fs:default` does not include write operations, a requirement that had been overlooked. Earlier device testing at the completion of #2 (file-dialog locale consistency, 2026-05-13) would have caught this sooner.
