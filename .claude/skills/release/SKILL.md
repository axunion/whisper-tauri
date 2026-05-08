---
name: release
description: Drive a whisper-tauri release end-to-end from the local side — version-bump consistency across package.json / Cargo.toml / tauri.conf.json, preflight checks, release-notes draft from the commit log, tag creation, and CI monitoring. Use whenever the user wants to release, ship, cut a version, bump version, or tag a release — even when they only mention "v0.x" or "shipping".
argument-hint: "<version>  e.g. 0.2.0"
user-invocable: true
---

# /release — Release Driver

Releases are fully automated by `.github/workflows/release.yml`, triggered by pushing a `v*` tag. This skill handles the **local** side: keeping the three version manifests in sync, validating preflight, composing release notes from git history, creating and pushing the tag, and watching the CI run.

All user-facing output and confirmations are in **Japanese**.

## Argument Parsing

`$ARGUMENTS` should be the target version in semver form (`MAJOR.MINOR.PATCH`, no `v` prefix).

If absent or malformed, derive a suggestion from the latest tag (`git describe --tags --abbrev=0` then bump patch) and confirm via `AskUserQuestion`. Never proceed without an explicit version.

## Phase 0 — Preflight

Run all checks; abort on any failure.

| Check | Command |
|-------|---------|
| On `main` | `git rev-parse --abbrev-ref HEAD` → must equal `main` |
| Up to date with origin | `git fetch origin main && git status -sb` → no `behind` |
| Clean working tree | `git status --porcelain` → empty |
| Tag does not exist | `git rev-parse "v$VERSION"` → must fail |
| `gh` authenticated | `gh auth status` |

If any check fails, report in Japanese and stop. Do not attempt to "fix" by stashing or resetting.

## Phase 1 — Version Consistency Check

Read the current version from each of:

1. `package.json` → `.version`
2. `src-tauri/Cargo.toml` → `[package].version`
3. `src-tauri/tauri.conf.json` → `.version`

Report all three values in a table. They must be identical to each other (the *current* version, before bump). If they diverge, stop and ask the user to reconcile manually — do not auto-fix divergence.

## Phase 2 — Bump Version

If the requested version differs from the current version:

1. Show a confirmation diff (current → requested) and require explicit user approval.
2. Update all three files using exact-match string edits (do not regex over them):
   - `package.json`: replace `"version": "<old>"` with `"version": "<new>"`
   - `src-tauri/Cargo.toml`: replace the `version = "<old>"` line under `[package]` only — be careful not to touch `[dependencies]` versions
   - `src-tauri/tauri.conf.json`: replace `"version": "<old>"` with `"version": "<new>"`
3. Verify the diff is exactly what was intended (`git diff -- package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json`).

## Phase 3 — Verify Build Locally

Recommend running `/verify all` before tagging. Ask the user whether to invoke it now or whether they have already done so. Do not proceed until they confirm.

This is intentionally manual — `/verify` is heavy (cargo build + pnpm build) and the user may have just run it.

## Phase 4 — Release Notes Draft

Generate notes from the commit log since the last tag:

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
git log "$LAST_TAG"..HEAD --pretty=format:"- %s" --no-merges
```

Group commits by conventional-commit prefix when possible (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). Present the draft in Japanese to the user for review.

The CI workflow (`release.yml`) writes a fixed installation guide as the release body, so these notes are for the user to paste into the GitHub draft release manually after CI completes. Save them where the user can find them — print to terminal is sufficient.

## Phase 5 — Commit and Tag

After explicit user confirmation of the bump diff and release notes:

1. Stage and commit:
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "Release v$VERSION"
   ```
   Follow project commit convention (English, imperative). Confirm the message before running per the project's commit-confirmation rule.

2. Create an annotated tag:
   ```bash
   git tag -a "v$VERSION" -m "Release v$VERSION"
   ```

3. Push (require separate explicit user confirmation — pushing a tag triggers production CI):
   ```bash
   git push origin main
   git push origin "v$VERSION"
   ```

If anything fails between commit and push, do not auto-revert. Report the state and ask.

## Phase 6 — CI Monitoring

After the tag push:

```bash
gh run watch --exit-status
```

If unavailable or the user prefers async: `gh run list --workflow release.yml --limit 1`.

On CI success, point the user to the draft release: `gh release list --limit 5` and remind them to paste the Phase 4 notes into the draft body and publish.

On CI failure, fetch logs (`gh run view <id> --log-failed`) and report. Do not retry automatically.

## Output Format

User-facing summaries in Japanese. Use a phase header per phase, e.g.:

```
## Phase 0: プリフライト
- main ブランチ: ✅
- リモートと同期: ✅
- 作業ツリー clean: ✅
- タグ未存在: ✅
- gh 認証: ✅
```

End-of-skill summary:

```
## リリース実行サマリ
- バージョン: 0.1.0 → 0.2.0
- コミット: <sha>
- タグ: v0.2.0 (push 完了)
- CI: <成功 or 失敗 with link>
- 次のアクション: GitHub の draft release に上記のリリースノートを貼り付けて publish
```
