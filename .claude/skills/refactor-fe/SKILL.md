---
name: refactor-fe
description: Refactor SolidJS/TypeScript code under src/ — extraction, consolidation, dead-code removal, error-handling consolidation, Tailwind class organization. Use proactively when modifying frontend files for cleanup, when a feature implementation has settled and needs a polishing pass, or when the user asks for refactoring without specifying the target.
argument-hint: "<file or description>"
user-invocable: true
---

# /refactor-fe — Frontend Refactoring

Refactor the file or target specified by `$ARGUMENTS` against project conventions.

**Conventions**: see `CLAUDE.md` (architecture, TypeScript strict flags). Key SolidJS patterns to preserve while refactoring:

- `createSignal` for simple state, `createStore` for objects/arrays, `createMemo` for derived values
- `splitProps` for forwarding props, not spread; no React patterns (`useState`, virtual DOM assumptions)
- solid-ui components with their default styles; minimize custom CSS — prefer Tailwind utilities
- IPC types in `src/types/` must match `src-tauri/src/*/types.rs`

## Refactoring Decisions

### Dead-Code Removal

- Remove unused imports, variables, functions, type definitions
- No backwards-compatibility re-exports, no `_`-prefixed placeholder variables
- Remove `// removed: ...` comments instead of leaving them

### Function Granularity

- One function = one responsibility
- Functions exceeding ~30 lines: consider splitting — long functions usually braid orchestration with leaf logic, and a reader cannot hold the whole flow in head at once
- Do **not** split aggressively if the inner steps have no other caller — premature extraction makes navigation worse than inline code

### Component Granularity

- Split components that contain multiple independent UI blocks
- Do **not** split tiny single-use elements just for hierarchy aesthetics

### Code Duplication

- Extract a shared helper when the same logic appears in 2+ places
- Do **not** force-merge code that only looks similar but has different context

### Simplification

- Remove unnecessary intermediate variables
- Flatten redundant conditionals
- Reduce excessive nesting (early returns, guard clauses)

### Tailwind Class Organization

- Use `cn()` from `~/lib/utils` for class composition (no template strings, no manual concatenation)
- Group related utility classes (layout / spacing / color / state) for readability

### Error Handling Consolidation

- In primitives: unify errors via `parseError()` into `AppError`, store with `setError()`
- In components: display via `ErrorDisplay` and use `toast` for action feedback
- Avoid double-surfacing the same error (ErrorDisplay + toast)

## Procedure

1. Read the target file(s) and identify violations
2. Apply refactoring
3. Verify by running `/verify fe` — the check commands are defined there (single source of truth); do not re-implement them inline
4. If anything fails, fix and repeat until everything passes.
