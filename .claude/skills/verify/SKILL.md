---
name: verify
description: Run all validation checks (lint, type check, tests, build) in a single pass. Auto-fixes correctable errors and runs independent checks in parallel. Use before commits, after feature implementation or refactoring, or whenever the user asks "is everything green?", "does it pass?", "run the checks", or expresses any uncertainty about CI readiness.
argument-hint: "[frontend|backend|all]"
user-invocable: true
---

# /verify — Validation Skill

Runs validation in phases. Auto-fixes recoverable errors and parallelizes independent checks.

## Argument Parsing

Determine target from `$ARGUMENTS`:
- `frontend` or `fe` → frontend only
- `backend` or `be` → backend only
- `all` or empty → both frontend and backend

For invalid arguments, print an error and stop.

## Command Map by Target

| Phase | Frontend (`fe`) | Backend (`be`) | All |
|-------|----------------|----------------|-----|
| 0: Auto-fix | `pnpm lint:fix` | `cargo fmt` | both in parallel |
| 1: Static analysis | `pnpm lint` + `pnpm typecheck` (parallel) | `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` (parallel) | all four in parallel |
| 2: Tests | `pnpm test:run` | `cargo test` | both in parallel |
| 3: Build | `pnpm build` | (none) | `pnpm build` |

## Phase Rules

### Phase 0: Auto-fix

Phase that mutates files. Run target commands **in parallel**.

- Frontend: `pnpm lint:fix` (Biome lint + format auto-fix; superset of `pnpm format`)
- Backend: `cargo fmt` (Rust formatter)

This phase is always treated as success (it just applies fixes).

### Phase 1: Static Analysis

Read-only static analysis. Run all target commands **in parallel**.

- Frontend: `pnpm lint` + `pnpm typecheck`
- Backend: `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings`

**Auto-fix on failure (max 2 retries):**

1. Read the failing check's error output
2. Attempt auto-fix:
   - `pnpm lint` failed → re-run `pnpm lint:fix`, then re-check
   - `cargo fmt --check` failed → re-run `cargo fmt`, then re-check
   - `pnpm typecheck` failed → read errors; if the fix is **clear**, edit code and re-check
   - `cargo clippy` failed → read warnings; if the fix is **clear**, edit code and re-check
3. Re-check **only the failed check** (do not re-run already-passing checks)
4. After 2 retries, stop and report

### Phase 2: Tests

Runs after Phase 1 fully passes. Run target commands **in parallel**.

- Frontend: `pnpm test:run`
- Backend: `cargo test`

**Auto-fix on failure (max 1 retry):**

1. Read the failing test output
2. If the fix is **clear**, edit code and re-test
3. After 1 retry, stop and report

### Phase 3: Build

Runs after Phase 2 fully passes.

- Frontend: `pnpm build`

**On failure**: report and stop without attempting fixes.

## What Counts as a "Clear Fix"

Auto-fix is appropriate for:
- Removing unused imports / unused variables
- Type mismatches (missing field, wrong type, `undefined` handling, etc.)
- Missing `override` keyword
- Following clippy suggestions (redundant clone, unnecessary `&`, etc.)
- Formatting issues

Do **not** auto-fix (report and stop):
- Errors requiring architectural changes
- Errors requiring business-logic decisions
- Cases where the test expectation may itself be wrong
- Errors with multiple ambiguous fix paths

## Procedure

1. **Build task list**: create all steps via TaskCreate based on the target
2. **Run Phase 0**: run target auto-fix commands in parallel; flip task in_progress → completed
3. **Run Phase 1**: run target static analysis in parallel; on failure follow auto-fix rules
4. **Run Phase 2**: run target tests in parallel; on failure follow auto-fix rules
5. **Run Phase 3**: run the build command
6. **Report**: print summary

## Report Format

All passed:
```
✅ All checks passed
```

Recovered via auto-fix:
```
✅ All checks passed (auto-fixed: <summary of fixes>)
```

Failed:
```
❌ Failed at: <Phase name — check name>
<error output summary>
```
