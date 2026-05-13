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
- **Settings/dev rows**: route every "label + trailing control" row through `<SectionRow title description right />` (from `~/components/ui/SectionRow`). `title` accepts JSX so badges or accent icons can sit alongside text. Do not re-introduce inner `rounded-lg border p-4` panels inside a `Card` — the `Card` is the only border.
- **Cards with multiple logical items**: split items with `<Separator />` (from `~/components/ui/Separator`) and use `CardContent class="space-y-6"`. Reserve this pattern for Cards where two or more independently configurable settings live side by side (e.g. General settings, Data Reset). Cards that hold a list (model lists) or a single state-switched panel keep `space-y-4` (or no explicit class).
