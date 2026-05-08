---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/styles/**"
---

# UI Design Rules

## Glassmorphism

- Purple/violet accents + translucency + `backdrop-blur`
- Layer structure: background (mesh gradient) → sidebar (`blur-xl`) → card (`blur-lg`) → content (opaque)

## Component Conventions

- **No heading tags**: do not use `<h1>`–`<h6>`. `CardTitle` renders as a `<div>`.
- **Uniform card height**: assign a fixed height to `Card` and let an inner flex layout (`flex-1`) drive sizing. Do not switch pixel heights based on conditional branches.
- **solid-ui**: copy-paste model (not an npm package).
