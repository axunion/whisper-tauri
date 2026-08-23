---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/primitives/**"
  - "src/lib/**"
---

# Frontend Conventions

## Error Handling Consolidation

- In primitives: unify errors via `parseError()` into `AppError`, store with `setError()`
- In components: display via `ErrorDisplay`; use `toast` for action feedback
- Never surface the same error twice (ErrorDisplay + toast)

## Styling

- Compose classes with `cn()` from `~/lib/utils` — no template strings or manual concatenation

## SolidJS Patterns

- Forward props with `splitProps`, not spread
- No React patterns (`useState`, virtual DOM assumptions)
