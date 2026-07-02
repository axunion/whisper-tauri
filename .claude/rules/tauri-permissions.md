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
- Write operations must be added individually as explicit permission entries with an `identifier` and an `allow` scope (path restriction).

## Example: saving a user-selected file

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$HOME/**" }]
    },
    {
      "identifier": "fs:allow-copy-file",
      "allow": [{ "path": "$HOME/**" }]
    }
  ]
}
```

- Restrict scope to `$HOME/**` or narrower — avoid `**` (all paths). Writes to `/etc` or `/System` are never needed.
- `$HOME/**` covers `~/Documents`, `~/Desktop`, and `~/Downloads` on macOS.
- Add `/Volumes/**` only when external-drive support is explicitly requested.

## Checklist (when adding a new plugin API)

1. Check official docs or `src-tauri/gen/schemas/` to confirm whether the command is included in the plugin's `*:default` bundle.
2. If not included, add the individual `fs:allow-<command>` (or equivalent) identifier to `capabilities/default.json`.
3. Keep scope as narrow as possible — prefer `$HOME/**` over `**`.
4. **Restart the dev server** after editing capabilities — changes are read at Tauri startup and are not picked up by HMR.
5. Test the actual API call on a real device to confirm there are no silent failures.

## Common Pitfalls

- **Silent fail**: insufficient permission causes a Promise rejection such as `<command> not allowed`. If the frontend swallows errors in a `try/catch`, the failure is invisible. Always log with `catch (err) { console.error(err); ... }` during debugging.
- **Scope mismatch**: the identifier is registered but the `allow` scope does not cover the target path — produces the same rejection as a missing identifier.
- **HMR does not apply**: capabilities files are unrelated to hot module replacement. A dev-server restart is mandatory.

## Past Incidents

- **2026-05-20** — While implementing #16 (enable save button in summary/clean-text tabs), silent failures were discovered in the text and timeline tab saves (`writeTextFile`) and the recording WAV save (`copyFile`) as well. Root cause: `fs:default` does not include write operations, a requirement that had been overlooked. Earlier device testing at the completion of #2 (file-dialog locale consistency, 2026-05-13) would have caught this sooner.
