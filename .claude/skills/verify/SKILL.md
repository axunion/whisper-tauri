---
name: verify
description: Run all validation checks (lint, type check, tests, optionally build) in a single pass. Auto-fixes mechanical errors and runs independent checks in parallel. Use before commits, after feature implementation or refactoring, or whenever the user asks "is everything green?", "does it pass?", "run the checks", or expresses any uncertainty about CI readiness.
argument-hint: "[frontend|backend|all] [--with-build]"
user-invocable: true
---

# /verify — Validation Skill

Runs static analysis and tests in parallel. Formatting is handled by the `.githooks/pre-commit` hook (`biome --write` + `cargo fmt` on staged files) so this skill does not mutate code preemptively — it only fixes on retry when a check fails.

## Argument Parsing

From `$ARGUMENTS`:

- target: `frontend` / `fe`, `backend` / `be`, `all` (default if empty)
- flag: `--with-build` opts into Phase 3 (Vite build). Off by default — `tsc --noEmit` already covers types, and `pnpm build` is meaningful mainly before release.

Reject any other token with an error and stop.

## Phase 1 — Static Analysis (parallel)

Run the target's checks in parallel.

| Target | Commands |
|--------|----------|
| Frontend | `pnpm check` (Biome lint + `tsc --noEmit`) |
| Backend  | `cd src-tauri && cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` (parallel within backend) |
| All      | Frontend and backend in parallel |

**Retry on failure (max 1 attempt per failing check):**

- Biome step in `pnpm check` failed → run `pnpm fix`, then re-run `pnpm check`
- `cargo fmt --check` failed → run `cargo fmt`, then re-check
- `tsc` / `cargo clippy` failed with a **mechanical** error → edit and re-check
- Re-run only the failing check; do not re-run already-passing ones
- After the single retry, stop and report

## Phase 2 — Tests (parallel)

Runs only after Phase 1 fully passes.

| Target | Command |
|--------|---------|
| Frontend | `pnpm test:run` |
| Backend  | `cd src-tauri && cargo test` |
| All      | Both in parallel |

On failure: if the fix is mechanical, edit and re-run once. Otherwise stop and report.

## Phase 3 — Build (opt-in via `--with-build`)

Only runs when the flag is present and the target includes frontend.

- `pnpm build`
- On failure: report and stop. No auto-fix attempts.

## What Counts as a "Mechanical" Fix

Try to auto-fix:

- Unused imports / variables
- Missing `override`, simple type mismatches, undefined-handling
- Clippy suggestions (redundant clone, unnecessary `&`, `?` over verbose match)
- Formatting drift

Do **not** auto-fix — report and stop:

- Changes that require architectural decisions
- Changes that imply business-logic intent
- Tests whose expectation itself may be wrong
- Errors with multiple ambiguous fix paths

## Procedure

1. Parse target + flag from `$ARGUMENTS`
2. Run Phase 1 in parallel; apply the retry rule on any failure
3. Run Phase 2 in parallel; apply the retry rule on any failure
4. If `--with-build`, run Phase 3
5. Report result

## Report Format

```
✅ All checks passed
```

```
✅ All checks passed (auto-fixed: <one-line summary>)
```

```
❌ Failed at: <Phase — check>
<error excerpt>
```
