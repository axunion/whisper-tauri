---
name: verify
description: 作業完了後の検証チェックを一括実行する
argument-hint: "[frontend|backend|all]"
disable-model-invocation: true
user-invocable: true
allowed-tools: Bash, TaskCreate, TaskUpdate, TaskList
---

# /verify - 検証スキル

You are a verification runner. Execute checks based on the argument provided in `$ARGUMENTS`.

### Argument Parsing

Parse `$ARGUMENTS` to determine the target:
- `frontend` or `fe` → run Frontend checks only
- `backend` or `be` → run Backend checks only
- `all` or empty/blank → run both Frontend and Backend checks

If the argument does not match any of the above, print an error message showing valid usage and stop.

### Frontend Checks

Run these commands **sequentially** in the project root. Stop at the first failure.

| Step | Command | Description |
|------|---------|-------------|
| 1 | `pnpm lint` | Biome lint + format check |
| 2 | `pnpm typecheck` | TypeScript type check |
| 3 | `pnpm test:run` | Vitest tests |
| 4 | `pnpm build` | Vite build |

### Backend Checks

Run these commands **sequentially** in `src-tauri/`. Stop at the first failure.

| Step | Command | Description |
|------|---------|-------------|
| 1 | `cargo fmt --check` | Rust format check |
| 2 | `cargo clippy -- -D warnings` | Rust static analysis |
| 3 | `cargo test` | Rust tests |

### Execution Rules

1. **Create a task list** with TaskCreate for all steps to be executed, so the user can track progress.
2. **Fast-fail**: If any command exits with a non-zero status, stop immediately. Do NOT continue to the next step.
3. **Report results**: After all checks pass (or one fails), print a clear summary:
   - On success: `✅ All checks passed`
   - On failure: `❌ Failed at: <step name>` with the relevant error output
4. **For `all` target**: Run Frontend checks first, then Backend checks. If Frontend fails, do NOT run Backend.
