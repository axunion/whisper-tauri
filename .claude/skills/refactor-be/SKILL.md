---
name: refactor-be
description: Refactor Rust/Tauri 2 code under src-tauri/ — extraction, consolidation, pub minimization, dead-code removal, unwrap/expect eradication. Use proactively when modifying backend files for cleanup, when a feature implementation has settled and needs a polishing pass, or when the user asks for refactoring without specifying the target.
argument-hint: "<file or description>"
user-invocable: true
---

# /refactor-be — Backend Refactoring

Refactor the file or target specified by `$ARGUMENTS` against project conventions.

**Conventions**: see `.claude/agents/rust-backend.md` (Rust patterns, error handling, module structure, Tauri commands) and `CLAUDE.md` (architecture, type definitions). This skill does not duplicate them; it focuses on the **refactoring decisions** below. For error mapping specifics, see `.claude/rules/error-handling.md`.

## Refactoring Decisions

### Dead-Code Removal

- Remove unused `use`, variables, functions, type definitions
- Do **not** suppress with `#[allow(dead_code)]` — delete the code instead
- Drop backwards-compatibility re-exports and stale `// removed: ...` comments

### Function Granularity

- One function = one responsibility
- Long functions: extract helpers
- Do **not** split aggressively if helpers gain no reuse

### Code Duplication

- Extract a shared helper when the same logic appears in 2+ places
- Do **not** merge code that only looks similar but has different context

### Simplification

- Remove unnecessary `.clone()`
- Flatten redundant pattern matches
- Drop redundant type annotations
- Prefer `?` over `match { Err(e) => return Err(e), ... }`

### `pub` Minimization

Visibility is API surface. Anything `pub` is something a future change has to preserve, document, or break. Keep that surface as small as the call graph requires.

- Remove `pub` on items not used outside the module
- Prefer `pub(crate)` over `pub` when the item must cross module boundaries but does not need to be public to external consumers — this keeps the crate boundary as the contract surface
- Module-private types should not be `pub`

### unwrap / expect Eradication

- `unwrap_used` / `expect_used` are `warn` in `Cargo.toml`
- Replace residual hits with `?` propagation, `map_err`, or pattern matching
- Acceptable only inside `#[cfg(test)]` blocks

## Procedure

1. Read the target file(s) and identify violations
2. Apply refactoring
3. Verify in `src-tauri/`:

```bash
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

4. If anything fails, fix and repeat until everything passes.
