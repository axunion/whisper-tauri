---
name: i18n
description: Audit and improve i18n dictionaries (ja/en). Checks structural consistency, placeholder parity, Japanese expression quality, translation quality, and detects hardcoded UI strings. Use after adding/modifying translations or when adding features that touch UI text.
user-invocable: true
---

# /i18n — i18n Audit & Fix

Audits the dictionary files in `src/i18n/dictionaries/` and their usage sites, then fixes the issues found.

## Principles

- **Japanese is the master language**: take Japanese as the source of truth and translate from there
- **Confirm ambiguous translations**: when Japanese has multiple plausible interpretations or you are unsure of a translation, ask via `AskUserQuestion`
- **Future-proofing**: every locale file must be checked, not just `ja`/`en` — the codebase is set up to extend

## Checks

### 1. Structural Consistency

- Missing keys (present in one locale but absent in another)
- Empty `""` values
- Type alignment with the `Dictionary` interface in `src/i18n/types.ts`

### 2. Placeholder Parity

`{param}`-style placeholders must match across locales for the same key — both count and names.

### 3. Japanese Expression Quality (`ja.ts`)

- **Honorific endings**: です/ます調 for descriptions and confirmation messages; bare form is fine for button labels and short noun phrases (「キャンセル」「文字起こし」)
- **Toast notifications**: completion toasts use 「〜しました」
- **Confirmation dialogs**: destructive-action confirmations use 「〜されます。この操作は取り消せません。」
- **Verbosity**: prefer concise wording where the meaning is preserved
- **Terminology**: one concept → one Japanese rendering (e.g., 「削除」 vs 「消去」)

### 4. Translation Quality (non-master locales)

- **Semantic accuracy** vs the Japanese source
- **English style**: Title Case for button labels and headings (e.g., "Start Transcription"); Sentence case for descriptions and notifications (e.g., "Transcription completed")
- **Conciseness**: no unnecessarily verbose translations
- **Technical-term consistency**: model names, tool names, proper nouns are uniform

### 5. Usage Sites

- **Hardcoded strings**: user-visible Japanese or English in `src/components/` or `src/pages/` that bypasses `t(...)` — including `aria-label`, `title`, `placeholder`, button labels, headings. Excludes CSS class names, test fixtures, URLs, file paths.
- **Unused keys**: defined but never referenced

## Procedure

### Phase 1 — Information Gathering

1. Read `src/i18n/types.ts` (the `Dictionary` shape)
2. Read every locale file under `src/i18n/dictionaries/`
3. Search for `t("...")` / `t('...')` usage in `src/components/` and `src/pages/`

### Phase 2 — Run Checks and Collect Findings

For each issue:

```
[category] file:line — issue description
  current:  <current value>
  proposed: <suggested fix>
```

### Phase 3 — Decide What Needs Confirmation

**Auto-fix without asking:**

- Typos (「文字お起こし」→「文字起こし」)
- Placeholder mismatches (`ja: {count}` / `en: {num}` → align)
- Missing keys that the type system requires
- Style drift against an established pattern (e.g., toast 「削除された」→「削除しました」)

**Confirm via `AskUserQuestion`:**

- Semantic ambiguity (「処理」→ "Process" / "Processing" / "Operation"?)
- Phrasing choices between equally valid options
- Substantial rewording (not a typo fix)
- Translations for newly-added keys when migrating hardcoded strings

### Phase 4 — Apply Fixes

1. Adjust Japanese first (master)
2. Update other locales based on the master
3. Update `types.ts` if the key shape changed

### Phase 5 — Verify

Run `/verify fe`. Repeat fixes until it passes.
