---
name: release
description: Drive a whisper-tauri release end-to-end from the local side — version-bump consistency across package.json / Cargo.toml / tauri.conf.json, preflight checks, release-notes draft from the commit log, tag creation, and CI monitoring. Use whenever the user wants to release, ship, cut a version, bump version, or tag a release — even when they only mention "v0.x" or "shipping".
argument-hint: "<version>  e.g. 0.2.0"
user-invocable: true
---

# /release — Release Driver

Releases are fully automated by `.github/workflows/release.yml`, triggered by pushing a `v*` tag. This skill handles the **local** side: keeping the three version manifests in sync, validating preflight, composing release notes from git history, creating and pushing the tag, and watching the CI run.

Git artifacts (commit messages, tags, release notes) are in **English**; conversational reports and confirmations follow the session language.

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

If any check fails, report and stop. Do not attempt to "fix" by stashing or resetting.

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

Recommend running `/verify all --with-build` before tagging — the `--with-build` flag runs `pnpm build`, which CI also runs and which catches Vite/asset issues `tsc` misses. Ask the user whether to invoke it now or whether they have already done so. Do not proceed until they confirm.

When the release contains user-facing changes (UI, file saves, permissions, recording, integrations), also recommend `/smoke` — a real-build smoke-test checklist that catches what `tauri dev` cannot reproduce (capabilities silent failures, Info.plist-driven behavior). Ask whether it has been run for this release; a skipped smoke test is acceptable only with explicit user confirmation.

This is intentionally manual — the build step is slow and the user may have just run it.

## Phase 4 — Release Notes Draft

Generate notes from the commit log since the last tag:

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
git log "$LAST_TAG"..HEAD --pretty=format:"- %s" --no-merges
```

Commit titles follow the project convention (one-line imperative English, **no** Conventional Commits prefixes — see `AGENTS.md` → Commits), so infer each commit's change type from its content and group the notes under headings such as Features / Fixes / Improvements / Internal. Present the draft to the user for review.

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

The `gh` CLI is not authenticated in this environment — do not use it. After the tag push, hand monitoring to the user in the browser:

1. Point them to the workflow run: `https://github.com/<owner>/<repo>/actions/workflows/release.yml`
2. On CI success, remind them to open the Releases page, paste the Phase 4 notes into the draft body, and publish.
3. On CI failure, ask them to share the failing step's log from the Actions UI, then diagnose. Do not retry automatically.

## Output Format

Use a phase header per phase, e.g.:

```
## Phase 0: Preflight
- main branch:      ✅
- Synced with remote: ✅
- Clean working tree: ✅
- Tag does not exist: ✅
```

End-of-skill summary:

```
## Release Summary
- Version:     0.1.0 → 0.2.0
- Commit:      <sha>
- Tag:         v0.2.0 (pushed)
- CI:          <succeeded | failed — link>
- Next action: Paste the Phase 4 release notes into the GitHub draft release and publish.
```
