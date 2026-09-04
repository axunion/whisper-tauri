@AGENTS.md

## Claude Code

The import above pulls in `AGENTS.md`, which holds the project context shared with other AI coding tools. The sections below are Claude Code specific.

### Rules (`.claude/rules/`)

Project-specific rules that are auto-injected as system reminders when a matching path is edited.

| File | Purpose |
|---|---|
| `error-handling.md` | Rust `error.rs` prefix naming and sync with `errors.ts::PREFIX_MAP` on the FE side |
| `frontend-conventions.md` | Error-handling consolidation (`parseError` / `ErrorDisplay` / `toast`), `cn()` class composition, SolidJS patterns |
| `i18n.md` | `types.ts` / all locales / `t("…")` sync when UI strings are added or changed |
| `tauri-permissions.md` | `capabilities/default.json` permission checks when using `@tauri-apps/plugin-*` |
| `tuning.md` | Tuning policy — prefer standard settings; do not mask model weaknesses with bespoke processing |
| `ui-design.md` | Glassmorphism / `SectionRow` / `Separator` and other shared UI conventions |
| `workarounds.md` | Workarounds for known bugs (whisper-rs FFI UB / `SOURCE_DATE_EPOCH`, etc.) |

### Subagents (`.claude/agents/`)

Three read-only/test-only agents, scaled by how risky the change is. **The main
conversation writes the code at every tier** — there is deliberately no `implementer`
agent. A write agent enforces no useful tool restriction, its real product is the working
tree rather than the summary it returns, and each retry pass would respawn it with no
memory of the code it just wrote. What the agents below provide is the opposite: an
opinion from something that didn't write the code and never saw the conversation.

Codebase exploration has no agent here either — the built-in `Explore` covers it.
`researcher` deliberately covers only the half `Explore` can't reach: external, third-party
API knowledge.

- **Trivial** (one-line fixes, typos, config tweaks): implement directly, no agents.
- **Non-trivial but contained** (a self-contained change in one area): implement
  directly. Optionally run one research agent first — `Explore` to confirm an existing
  convention, `researcher` for an unfamiliar or version-sensitive external API.
  Afterward, run `reviewer` and `tester` in parallel **without asking first** — both are
  read-only or test-only, so the cost of running them is low and they exist precisely to
  cover the blind spot of reviewing your own work.
- **Large, ambiguous, or high-risk** (spans many files, substantially touches the risk
  areas below, or the task itself is genuinely ambiguous): **propose** that the user
  drive it with `/goal`. This is a command the user types, so the deliverable is a
  ready-to-use completion condition, not an autonomous action — and it must name the
  agents explicitly ("… done when `reviewer` reports no findings and `tester` passes"),
  because `/goal`'s evaluator only matches the condition text against the transcript and
  has no built-in knowledge that these agents exist. Always propose rather than assume:
  the reason is cost and duration, not risk.

**Risk areas** (what makes a change tier 3, and what `reviewer` and `tester` scrutinize
hardest). Each has a recorded incident behind it:

| Area | Failure mode |
|---|---|
| `src-tauri/src/whisper/` | whisper-rs 0.16 FFI UB and the standalone VAD path — see `workarounds.md`; "simplifying" either one regresses it |
| `src-tauri/src/history/db/` | stored UTC timestamps read back as local time |
| `src-tauri/src/notion/` | token leaking into logs, error strings, or IPC payloads |
| IPC sync points | `src/types/` ↔ `src-tauri/src/*/types.rs`, `errors.ts::PREFIX_MAP` ↔ `*/error.rs`, `capabilities/default.json` ↔ every `@tauri-apps/plugin-*` call — every one of these fails **silently at runtime**, not at build time |

**Visual verification is a separate axis from the tiers above**, keyed to whether the
change touches rendered UI at all rather than to how risky it is: a tier-2 CSS tweak may
need a look, a tier-3 backend migration renders nothing. No `inspector` agent exists here
because the UI runs in a WKWebView, not a headless browser, and there is no `isTauri`
guard — every `invoke()` fails if the Vite dev server is opened in a plain browser. So:

- No rendered surface touched → skip.
- Small, isolated, single-property tweak → a glance at `pnpm tauri dev` is enough.
- Viewport-dependent layout, a change spanning components that share styles, or chasing
  a reported visual bug → actually run `pnpm tauri dev` and look. If capabilities or
  bundle-only behavior is involved, use `/smoke` instead — those failures don't reproduce
  under `tauri dev`.

Note how `tester` and the `/verify` skill differ: `/verify` runs in the main conversation
and auto-fixes mechanical errors in implementation code; `tester` runs as a subagent and
may only edit test files, reporting anything else back.
