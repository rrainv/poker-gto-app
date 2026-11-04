# Riverline agent rules

Riverline is a local-first, browser-first No-Limit Hold'em learning workstation with a thin Electron host. These rules are a guide, not an ultimatum. **The owner's judgement is final.** If a rule or document seems wrong, raise it in your report instead of silently working around it.

## Roles

- **Manager:** the owner's Claude Project chat. Priorities, decisions, tickets, report review. No repository edits.
- **Work:** one Claude Code session per ticket. Inspect, implement, verify, report, stop. Corrections stay in the session; a new ticket gets a new one.
- **Review:** independent read-only session for money, maths, identity, persistence, migrations, source authority or claim changes, by a different agent.
- **Agents:** Claude Code (default implementer), Gemini Argon (batch implementer, reviewer). One writer per folder: each agent has its own worktree and branch; the owner merges after review. Reports: `docs/archive/agent-reports/<yyyy-mm>/<TICKET-ID>.md`.

## What to read

Minimum: this file plus the files the ticket names. Context: [docs/BRIEF.md](docs/BRIEF.md). Live queue: [docs/STATE.md](docs/STATE.md). Decisions with reasons: [docs/design/decisions/OWNER_DECISIONS.md](docs/design/decisions/OWNER_DECISIONS.md). Direction: [docs/NORTH_STAR.md](docs/NORTH_STAR.md). Visual contract: [docs/project/DESIGN_SYSTEM.md](docs/project/DESIGN_SYSTEM.md). Terms: [docs/TERMINOLOGY.md](docs/TERMINOLOGY.md). Issues: [docs/ISSUE_REGISTER.md](docs/ISSUE_REGISTER.md). Specs: [docs/project/README.md](docs/project/README.md), when a ticket names one. Licences: [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) (record one before use). `docs/archive/` is history only. Skills in `.agents/skills/`: `riverline-design` for any UI work, `/review-animations` before merging motion, `/break-ui` for data-heavy components.

Never read giants whole (`app/src/core/logic.js`, `app/styles.css`, `docs/ISSUE_REGISTER.md`, `docs/NORTH_STAR.md`): search by ID, function or heading. Do not re-read unchanged files during same-session corrections.

## Architecture

```text
Scenario input or canonical PokerState
  -> DecisionContext -> StrategyProvider -> StrategyResult -> StrategyClaimPolicy
  -> Analyze / Training / Review / Personal Strategy / Saved (consumers only)
```

- Poker rules, state, legality, accounting, evaluator, Equity, combos, ranges: `shared/poker-domain/` only. UI never does poker maths.
- Strategy is a deterministic baseline (`app/src/strategy/`); no production reference pack, solver or remote strategy API. Never call its output GTO, solved, Nash, CFR, exact EV or "correct".
- Scenario is lossy; Hand is canonical legal history. Unknown is never zero, fold or excluded.
- One canonical owner per concept; never create a second poker, Equity, Training, strategy, Saved or state authority.
- Preserve versioned contracts and PERF-001 (one strategy resolution per decision update, coalesced input, no hidden Matrix/Equity work). Schema or persistence migrations need explicit approval.
- Solver, model and data experiments stay under `solver/`.

### Module rule (decided 2026-10-31)

- **New UI code goes into mounted modules in `app/src/application/` (or `app/src/ui/`), never into `app/src/core/logic.js`. `logic.js` only shrinks** (about 14,900 lines at 2026-11-04).
- Controller interface for a mounted workspace: `mount(container, deps)` returns `{ dispose, refreshLanguage, handleKey, setVisible }`. `deps` are injected (never the whole `window.app`). Write characterization tests with `bootApp()` before moving existing code.
- Extraction order and the no-framework decision: [OWNER_DECISIONS](docs/design/decisions/OWNER_DECISIONS.md).

### Area map

| Area | Modules | Specs |
|---|---|---|
| Training | `app/src/application/training-*.mjs`, `full-hand-training-*`, `opponent-*`, `app/src/training-memory/`, `app/src/ui/drill-components.mjs` | [TRAINING_INTELLIGENCE_V1](docs/project/TRAINING_INTELLIGENCE_V1_SPEC.md), [TRAINING_MEMORY_V1](docs/project/TRAINING_MEMORY_V1_SPEC.md), [TRAINING_PRACTICE_PLANNER](docs/project/TRAINING_PRACTICE_PLANNER_SPEC.md) |
| Analyze | `app/src/application/analyze-*`, `analysis-*`, `strategy-*`, `app/src/strategy/` | [DECISION_CONTEXT](docs/project/DECISION_CONTEXT_SPEC.md), [ANALYSIS_RANGE](docs/project/ANALYSIS_RANGE_SPEC.md), [STRATEGY_SOURCE_AUTHORITY](docs/project/STRATEGY_SOURCE_AUTHORITY_SPEC.md) |
| Equity | `app/src/application/equity-*`, `advanced-equity-*`, `range-*`; maths in `shared/poker-domain/` | [ADVANCED_EQUITY_V1](docs/project/ADVANCED_EQUITY_V1_SPEC.md), [RANGE_CORE](docs/project/RANGE_CORE_SPEC.md) |
| Hand / Review | `app/src/application/canonical-hand-*`, `hand-*`, `replay-*`; rules in `shared/poker-domain/` | [GAME_RULES_V1](docs/project/GAME_RULES_V1_SPEC.md), [HAND_HISTORY_IMPORT_V1](docs/project/HAND_HISTORY_IMPORT_V1_SPEC.md), [DEEP_REVIEW_STUDY_INBOX_V1](docs/project/DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md) |
| Personal Strategy | `app/src/personal-strategy/`, `app/src/application/personal-*` | [PERSONAL_STRATEGY_FOUNDATION](docs/project/PERSONAL_STRATEGY_FOUNDATION_SPEC.md), [..._MATRIX](docs/project/PERSONAL_STRATEGY_MATRIX_SPEC.md), [ADR persistence](docs/project/ADR_PERSONAL_STRATEGY_PERSISTENCE.md) |
| Saved | `app/src/saved-study-objects/`, `app/src/application/saved-*`, `study-*` | [SAVED_STUDY_OBJECTS](docs/project/SAVED_STUDY_OBJECTS_SPEC.md) |
| Home | `app/src/application/home-view-model.mjs`, `home-workspace-bootstrap.mjs` | [HOME_DASHBOARD](docs/project/HOME_DASHBOARD_SPEC.md) |
| Game night | `app/src/home-game/`, `app/src/application/home-game-*` | [HOME_GAME_ORGANIZER](docs/project/HOME_GAME_ORGANIZER_SPEC.md) (dormant) |
| Settings / shell | `app/index.html`, `app/styles.css`, `app/src/locales/`, `shell-navigation.mjs`, `workspace-header.mjs`, `presentation-*` | [DESIGN_SYSTEM](docs/project/DESIGN_SYSTEM.md), [INTERACTION_GRAMMAR](docs/project/INTERACTION_GRAMMAR.md) |

Search `app/src/` for the current file before editing.

## Tickets

- One bounded outcome; no unrelated cleanup. Use register IDs; do not silently close or absorb others.
- Every ticket states an execution class (Mechanical Fast · Product Contract First · Correctness/Architecture · Heavy Future Design), a verification tier and a suggested model/effort.
- Redesigns need an approved mockup first; mockup numbers are illustrative, real numbers come from the engine.
- If behaviour has several readings, ask 1–4 focused questions first.
- A newly found issue joins the ticket only if it caused or blocks it; otherwise add a register row and continue.
- **Stop and report** on an unapproved schema migration, architecture rewrite, poker-rule interpretation, paid/cloud resources, big scope growth, or conflicting canonical implementations. After ~two corrections rejected for the same reason, stop patching and rethink with the owner.

## Verification tiers

| Tier | For | Tests | Browser | Full suite |
|---|---|---|---|---|
| T0 | docs, mechanical, read-only | touched only | none | no |
| T1 | fixes, small features | focused | 1920 EN Midnight; HE if layout/direction affected | only if shared modules changed |
| T2 | redesigns, big features | focused | mockup comparison: 1920+1366 EN, 1920 HE, one Daylight shot | once, at the end |
| T3 | milestones only | all | full matrix | yes, plus beta smoke |

Commands: focused `node --test <files>`; syntax `node --check <changed .js/.mjs>`; hygiene `git diff --check`; full suite `node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs`; solver suite, only when domain/solver/strategy changed (PowerShell): `$env:PYTHONPATH='solver;.'; py -3.12 -B -m unittest discover -s tests/solver -p 'test_*.py'`. Poker-maths changes need invariant/property tests. Without a real browser check, report visual status as `UNVERIFIED`, `PARTIAL` or `STRUCTURAL ONLY`. Human acceptance is the owner's. Visible features also own tutorial, EN/RU/HE + RTL, accessibility, reduced motion and responsive behaviour (minimum desktop 1366×768).

## Git and file safety

- Never stage, commit, push, reset, clean, stash, rebase or switch branches unless the ticket authorizes it. Never broad-stage (`git add .`, `-A`). Commit with exact file lists.
- Protected unless the ticket owns them: `.codex/config.toml`, `.claude/`, `.gitignore`, `repo_dump.*`, local auth config (`app/auth-config.js`), helper/backup artifacts.
- Never print secrets, invent credentials or copy local auth config. Do not revert changes you did not make; report pre-existing dirty files separately.
- **LF only** (`.gitattributes`, `core.autocrlf=false`). A small edit showing every line changed is line-ending churn: fix before reporting (`git ls-files --eol <file>`).
- Windows: write files with the file tools, not shell heredocs or here-strings; forward slashes in Bash.
- Start every ticket with `git fetch` and base on `origin/codex/stabilization`, never on the local branch; report the base hash.
- Worktree sessions have no `.claude/skills` junctions: read `.agents/skills/<name>/SKILL.md` directly.
- Node ≥22 (`.nvmrc` 24). Dev server: `node tools/dev-web-server.mjs` in its own terminal (`http://127.0.0.1:3000`; component sheet at `/__dev/component-sheet.html`).
- Cloud sessions and paid compute only with explicit authorization, a pushed base, a separate branch and an approved spend, runtime and stop criteria.

## Docs you may touch

Update the register rows your ticket owns. Update a reference spec only when your ticket changes the truth it describes. `docs/STATE.md` and `docs/NORTH_STAR.md` are the Manager's unless the ticket says so. New decisions go in the decision log only. Never create a second roadmap, backlog, status file or architecture authority.

## Report (every ticket, then STOP)

1. **Outcome** in plain words. 2. **Root causes / design choices.** 3. **Files:** changed by this ticket vs pre-existing dirty. 4. **Verification:** exact commands and results incl. failures and skips; browser checks with viewport/theme/language, or `UNVERIFIED`. 5. **Limitations and debt** with register IDs. 6. **Disagreements or doc conflicts.** 7. **Git status** and confirmation of what was or was not staged or committed. Then stop; do not start the next ticket.
