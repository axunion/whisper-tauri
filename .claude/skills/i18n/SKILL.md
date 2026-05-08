---
name: i18n
description: Audit and improve i18n dictionaries (ja/en). Checks structural consistency, placeholder parity, Japanese expression quality, translation quality, and detects hardcoded UI strings. Use after adding/modifying translations or when adding features that touch UI text.
user-invocable: true
---

# /i18n — i18n Audit & Fix

Comprehensively audits the dictionary files in `src/i18n/dictionaries/` and their usage sites, then fixes the issues found.

All user-facing output and confirmations are in **Japanese**.

## Principles

- **Japanese is the master language**: take Japanese as the source of truth and translate from there
- **Confirm ambiguous translations**: when Japanese has multiple plausible interpretations or you are unsure of a translation, confirm with `AskUserQuestion`
- **Future-proofing**: every locale file must be checked, not just ja/en — the codebase is set up to extend

## Checks

### 1. Structural Consistency

Verify that all locale dictionaries share the same key structure.

- **Missing keys**: keys present in one locale but absent in another
- **Type alignment**: keys must match the `Dictionary` interface in `src/i18n/types.ts`
- **Empty strings**: no values should be `""`

### 2. Placeholder Parity

Verify that `{param}`-style placeholders are consistent across locales for the same key.

- Example: if `ja` has `{count}`, `en` must also have `{count}` for the same key
- Both placeholder count and names must match

### 3. Japanese Expression Quality

Check the naturalness and consistency of `ja.ts`.

- **Honorific endings (です/ます調)**: consistent within UI text
  - Button labels and short noun phrases may use bare form (e.g., 「キャンセル」「文字起こし」)
  - Descriptions and confirmation messages: です/ます style
- **Toast notifications**: completion toasts use the 「〜しました」 pattern
- **Confirmation dialogs**: destructive-action confirmations use the 「〜されます。この操作は取り消せません。」 pattern
- **Verbosity**: prefer concise wording where the meaning is preserved
- **Terminology**: same concept should not have multiple Japanese renderings (e.g., 「削除」 vs 「消去」)

### 4. Translation Quality

Audit each non-master locale against the Japanese source.

- **Semantic accuracy**: the Japanese nuance is conveyed
- **Style consistency** (for English):
  - Button labels and headings: Title Case (e.g., "Start Transcription")
  - Descriptions and notifications: Sentence case (e.g., "Transcription completed")
- **Conciseness**: no unnecessarily verbose translations
- **Technical-term consistency**: model names, tool names, proper nouns are uniform

### 5. Usage Sites

Verify that components use i18n properly.

- **Hardcoded strings**: any user-visible Japanese or English string in `src/components/` or `src/pages/` that bypasses i18n
  - Includes `aria-label`, `title`, `placeholder`, button labels, headings
  - Excludes CSS class names, test fixtures, technical strings (URLs, file paths)
- **Unused keys**: keys defined in dictionaries but not referenced in code

## Procedure

### Phase 1 — Information Gathering

1. Read `src/i18n/types.ts` to learn the `Dictionary` shape
2. Read all locale files under `src/i18n/dictionaries/`
3. Search for i18n key usage in `src/components/` and `src/pages/`
   - Pattern: `t("...")`, `t('...')`

### Phase 2 — Run Checks

Execute each check above and collect findings into a list. Format each issue as:

```
[category] file:line — issue description
  current:  <current value>
  proposed: <suggested fix>
```

### Phase 3 — Confirm with User (when needed)

Use `AskUserQuestion` when:

- Multiple natural Japanese phrasings exist and the right choice is unclear
- The Japanese intent is ambiguous, blocking translation
- Substantial rewording (not a typo fix) is proposed

Auto-fix without confirmation when:

- Obvious typos
- Placeholder mismatches
- Missing keys (mechanical, type-driven)
- Style inconsistencies that match an established pattern

### Phase 4 — Apply Fixes

1. Report the consolidated issue list to the user
2. Adjust Japanese first (master language)
3. Update other locale dictionaries based on the master
4. Update `types.ts` if keys changed shape

### Phase 5 — Verify

```bash
pnpm lint && pnpm typecheck && pnpm test:run
```

Repeat fixes until everything passes.

## Decision Reference

### Auto-fix without asking

| Type | Example |
|------|---------|
| Typo | 「文字お起こし」→「文字起こし」 |
| Placeholder mismatch | ja: `{count}` / en: `{num}` → en: `{count}` |
| Style consistency | toast: 「削除された」→「削除しました」 |
| Missing keys | type defines a key the dictionary lacks → add it |

### Confirm with user

| Type | Example |
|------|---------|
| Semantic ambiguity | 「処理」→ "Process" or "Processing" or "Operation"? |
| Phrasing choice | 「文字起こしを開始」→ "Start Transcription" or "Begin Transcription"? |
| Substantial rewording | rewriting a confirmation dialog body |
| New-key translation | translating newly-added keys when migrating hardcoded strings |
