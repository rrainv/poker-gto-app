# Riverline state

The **one live status file**: where the project is and what is next. Direction: [NORTH_STAR.md](NORTH_STAR.md). Context: [BRIEF.md](BRIEF.md). Issues: [ISSUE_REGISTER.md](ISSUE_REGISTER.md). Decisions with reasons (including the open and resolved ones): [design/decisions/OWNER_DECISIONS.md](design/decisions/OWNER_DECISIONS.md). A guide, not an ultimatum: the owner decides order and scope.

Last updated: 2026-11-04 (SETTINGS-001). **Truth source for status is `git log`**; commit titles are not owner acceptance (acceptance lives in the register). The previous 33 KB STATE (queue phases 0–6, accepted-work table, "what exists today", research table) is archived as [STATE_SNAPSHOT_2026-10-31](archive/2026-10/STATE_SNAPSHOT_2026-10-31.md); mockup links are in [design/CANVASES.md](design/CANVASES.md).

**Update rule.** The Manager (or a ticket that owns it) updates this file when a ticket lands or the queue changes. Replace rows; do not append history. Keep it under 8 KB.

## Milestone: M1, trustworthy and beautiful base (design-first)

Goal: docs and truth fixed, design and motion foundation, Training and Settings redesigned, Home redesigned, every other workspace on the new foundation, trust package, i18n complete, a clean QA sweep. Scope rule: anything new goes to a later milestone unless it fixes a P0/P1 or is tiny and inside a screen already being redesigned. Details: [NORTH_STAR §9](NORTH_STAR.md#9-milestones-and-gates). Branch: `codex/stabilization` (becomes `main`; the owner runs the move).

## Done (latest first, from git log)

| Ticket | Commit | Note |
|---|---|---|
| SETTINGS-001 | `4ee37f1` | Settings is a workspace: rail, search, modified markers with per-row reset, sticky preview, Language cards, Shortcuts list, Account counts. Owner accepted; full suite 2951 pass, 0 fail; report [SETTINGS-001](archive/agent-reports/2026-11/SETTINGS-001.md); new register rows SETTINGS-* |
| MERGE-NIGHT-001 | merges `e06d707` … `56170fe` | Night batch merged into `codex/stabilization`: HOME-INVENTORY-001 (`e943a8b`, report only), ASSETS-SHIP-001 (`e75400d`), CSS-DEADTHEME-001 (`fc25e93`), LOCALE-NUMBERS-003 (`be5a782`), TERMS-HEURISTIC-001 (`7fd1b38`), night summary (`0437ac2`). Full suite 2879 tests, 0 fail. Owner acceptance pending |
| EXTRACT-QUICKDRILL-001 | `8c31945` | Quick drill is a mounted module; rows QUICKDRILL-* in the register |
| HOUSEKEEPING-001 | `e884ce6` | CI on PRs, archive of old tooling, repo hygiene |
| SHELL-002 | `7904a23` | Hub sidebar, hub screens, workspace header with context chip |
| DS-TOKENS-001 | `ddd4840` | Style v4 values, contrast pass, Slate preset, self-hosted Rubik |
| MOTION-FOUNDATION-001 | `7ab2bfe` | One motion system, Motion setting, keyboard-instant |
| MERGE-003 | `b3ef6d4`, `245d7d1` | Argon batch 3 (B7 locale numbers, B8 keyboard access, B9 Full Hand quality, B10 Saved flake); Hero-fold title and Equity formatter fix |
| TRAINING-QUICK-001 | `432c27b` | Quick refresher on the prototype, correction 1 delivered 2026-10-30; report [TRAINING-QUICK-001](archive/agent-reports/2026-10/TRAINING-QUICK-001.md). Owner acceptance pending |
| HOME-001 | `7ae46dc` | Home card grid, owner-leak fixes, Start something; owner accepted 2026-11-04; report [HOME-001](archive/agent-reports/2026-11/HOME-001.md) |
| EXTRACT-HOME-001 | `311bc5e` | Home moved out of `logic.js` into `home-workspace.mjs` |
| COMPONENTS-001 | folded in | Not a separate ticket: `app/src/ui/drill-components.mjs` (from TRAINING-QUICK-001) is the seed of the shared component set; further components land with the tickets that need them |

Earlier work (MERGE-001/002, batch 1 and 2, TRAINING-F12-001, SKILLS-001, DOCS-PHASE1/SMALL-001, ANALYZE-COMPOSITION-001): git log and the snapshot.

## Ordered queue (next, in order)

| # | Ticket | Outcome | Class / tier |
|---|---|---|---|
| 1 | EXTRACT-ANALYZE-000 to 004 | Analyze moved out of `logic.js` into mounted modules, in five steps, starting with the inventory | Correctness/Architecture · T1 each |
| 2 | TRAINING-QUICK-002 | Quick drill follow-ups from the owner review (register TRAINING-QUICK-* and QUICKDRILL-* rows) | Product Contract First · T2 |
| 3 | WELCOME-001 | Welcome / first-run flow | Product Contract First · T2 |
| 4 | NOTICES-001 | About & legal and the mandatory notices | Product Contract First · T1 |
| 5 | SETTINGS-TEXT-SIZE | Text size setting on a rem type scale (register SETTINGS-TEXT-SIZE) | Product Contract First · T1 |

Then the rest of M1 per the build plan (full queue in the snapshot, phases 2–6): TRAINING-LONG-001 (with Training Memory extraction), ANALYZE-POLISH-001, HG-LEDGER-EDITS-001, Argon batch 4 (AUDIO-RESEARCH-001, GOLDEN-SPOTS-001, A11Y-AUDIT-001), foundation passes (REVIEW/HAND/FULLHAND/EQUITY/PS/GAMENIGHT/LIBRARY/LEARN-FOUND), trust package (EXACT-LABELS-001, BASELINE-MEASURE-001), then I18N-COMPLETE-001, LAYOUT-AUDIT-001 and the T3 QA sweep. M2 (Personal Strategy flow, Hand, Review, Equity, Learn, Game night, Table rules) starts after the gate.

## Gates (owner judgement, not hard blockers)

1. No open P0/P1 (data loss, wrong money, false strategy claims, broken core flows): not met; see register section A (OWNER-12, OWNER-17, HG-002).
2. Every in-scope screen meets the design standard and the automated audit (LAYOUT-AUDIT-001): not started.
3. Clean hands-on QA sweep: not started.
4. Trust package and notices in place (NOTICES-001): not started.

## Open decisions

The owner's open decisions (D-23 … D-38, Rust toolchain, Daylight values, Game night wording, and others) live in the [decision log](design/decisions/OWNER_DECISIONS.md#open-decisions-from-statemd-as-of-2026-10-27), not here.

## Waiting on the owner

Branch move (`codex/stabilization` → `main`); RU/HE native review of the Baseline wording; DEAD-THEME-FELT and EXPLAIN-HEURISTIC-WORDS decisions; back up `Riverline_archive`; paste research round 5 into `docs/_incoming/` (not yet present); acceptance of TRAINING-QUICK-001 and of the DS-TOKENS-001 / SHELL-002 / MOTION-FOUNDATION-001 visuals; Rust toolchain yes/no (SOLVER-PILOT-001); the open decisions above.

## Pointers

[NORTH_STAR](NORTH_STAR.md) · [area direction](project/AREA_DIRECTION.md) · [project spec index](project/README.md) · [DESIGN_SYSTEM](project/DESIGN_SYSTEM.md) · [TERMINOLOGY](TERMINOLOGY.md) · [IDEA_BANK](IDEA_BANK.md) · [THIRD_PARTY](THIRD_PARTY.md) · [research](research/README.md) · [archive](archive/README.md)
