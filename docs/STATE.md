# Riverline state

The **one live status file**: where the project is, what is next, what is waiting on a decision. It replaces `CURRENT_PHASE.md`, `ROADMAP.md`, `PRODUCT_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md` as status owners (archived under `docs/archive/2026-10/`). Direction lives in [NORTH_STAR.md](NORTH_STAR.md); bugs, debt and small wants in [ISSUE_REGISTER.md](ISSUE_REGISTER.md). A guide, not an ultimatum: the owner decides order and scope.

Last updated: 2026-10-15 (DOCS-RESET-001 Part 2).

**Update rule.** The Manager (or a ticket that owns it) updates this file when a ticket is accepted, the queue changes, or a decision is made. Keep it short: replace rows, don't append history. Accepted-work rows keep only the latest ~15; older history is git log.

---

## Current milestone: M1, trustworthy and beautiful base (design-first)

M1's first job is a **very good design refresh** (Style v4, calm surface and deep data, no real or pseudo dead space, smooth motion and pointer feedback, sound) before the heavy feature work of M2/M3. Feature work in M1 is limited to honesty and usability: truth fixes, trust package, data safety, i18n completeness. The owner QAs heavily on the PC; expect several correction rounds per screen. Details: [NORTH_STAR §9](NORTH_STAR.md#9-milestones-and-gates).

Sizes: S (one session), M (one session plus corrections), L (two or more sessions or parts). Tiers T0–T3 per [AGENTS.md](../AGENTS.md#verification-tiers).

### Gates (checkpoints for judgement, not hard blockers; the owner decides)

| Gate | Status 2026-10-15 |
|---|---|
| 1. No open P0/P1 issues (data loss, wrong money, false strategy claims, broken core flows) | Not met: open P1s in [ISSUE_REGISTER › Truth, correctness and money](ISSUE_REGISTER.md#a-truth-correctness-and-money) (OWNER-12 sliders, OWNER-17 spot table, HG-002) |
| 2. Every in-scope screen meets the design standard and passes the automated audit | Not started (audit is LAYOUT-AUDIT-001) |
| 3. Clean hands-on QA sweep (independent Claude Code review after the M1 foundation lands) | Not started |
| 4. Trust package (not a hard gate; exact maths and honest labels in M1, reference measurement may trail into early M2) | Not started |
| 5. i18n complete and natural enough (native polish later) | Not met (see [TERMINOLOGY › Applying this sheet](TERMINOLOGY.md#applying-this-sheet-code-still-differs)) |
| 6. "I use it by choice", checked monthly | Monthly check running from 2026-10; gate meaningful after M2 |

Data safety is planned work, not a gate. Scope rule: anything new goes to a later milestone unless it fixes a P0/P1 or is tiny and inside a screen already being redesigned.

---

## Ordered queue (M1, design-first)

From the Manager's M1 plan (2026-10-15). The top unfinished row is next.

### Phase 0: safe start

| ID | Outcome | Depends | Tier | Size | Status |
|---|---|---|---|---|---|
| WIP-BACKUP-001 | Uncommitted Analyze work backed up on a wip branch | none | T0 | S | Done: `wip/analyze-composition-2026-10` @ `956ca6e` (unaccepted backup) |
| DOCS-RESET-001 | Compact agent docs: AGENTS, NORTH_STAR, STATE, ISSUE_REGISTER, TERMINOLOGY, DESIGN_SYSTEM (merging Design Language v2) + invariant ledger | backup | T0 | L | Done and accepted (2026-10-15): committed `d1c826e` |
| ANALYZE-ACCEPT | Owner accepts or corrects the Analyze composition work, then commit | docs reset | human | S | Done (2026-10-15): accepted, committed `4e3e11a` (COMMIT-001) |
| TRUTH-FIXES-001 | Heuristic comparisons never graded as mistakes; one provenance indicator on Analyze; hide strategy sliders; honest spot table; reject 0 buy-in; 650 weights | docs reset | T1 | M | Built, committed `51c115d`; awaiting owner acceptance (TRAINING-GRADE-TRUTH-001, OWNER-12, OWNER-17 partial, OWNER-19 partial, HG-004) |
| AGENT-POLICY-001 | Multi-agent work policy in AGENTS.md (isolated worktrees/branches, risk-tier cross-agent review, report path) | docs reset | T0 | S | Done on `argon/m1-batch-1` (2026-10-18) |
| MOCKUP-ASSETS-001 | Real card backs, icons, table measurements for the design kit | none | T0 | S | Done on `argon/m1-batch-1` (2026-10-18) |
| I18N-RESIDUE-001 | Finish RU/HE terminology alignment per TERMINOLOGY.md across `.mjs` language/strategy modules and locale catalogs (`I18N-TERMS-RESIDUE`) | none | T1 | S | Done on `argon/m1-batch-1` (2026-10-18) |
| CLEANUP-PREP-001 | Guard unbundled Supabase UMD script, replace exact-match CSS colours/fallbacks with `:root` tokens, remove 106 redundant `!important` rules, fix F04 and F06 (`DS-CSS-DEBT`) | none | T1 | S | Done on `argon/m1-batch-1` (2026-10-18) |
| TRUTH-SURFACES-002 | Single provenance indicator per surface (Analyze, Training feedback, Hand Review, Personal Strategy comparison), 5% estimated mix rounding and <5% hiding, strict two-state verdict dominance rule (`QA-SHELL-004`, `OWNER-19`, `REVIEW-MATH-03`) | truth fixes | T1 | S | Done on `argon/m1-batch-2` (2026-10-26) |
| DOMAIN-MATH-001 | Move pot-before-action, SPR, and MDF calculations out of UI code into `shared/poker-domain` selectors and carry numeric bet amounts in `training-presentation.mjs` instead of parsing localized display labels (`REPO-AUDIT-011`) | none | T1 | S | Done on `argon/m1-batch-2` (2026-10-26) |
| DATA-SAFETY-001 | Request persistent storage (`navigator.storage.persist()`) once with honest `persisted` vs `temporary` status and iOS tab install/back-up note in Settings › Account & Data; strongly guard "Delete all data" with warning list and localized type-to-confirm (`DATA-SAFETY-M1`) | none | T1 | S | Done on `argon/m1-batch-2` (2026-10-26) |

### Phase 1: design decisions on the PC (before any screen build; mockups only, no code)

| ID | Decision | Input |
|---|---|---|
| DES-SHELL | Shell and sidebar (variant 4 with hub screens, 2, or current); Home vs Study vs Tools vs Library split; My poker placement | shell canvas, kit screens |
| DES-STYLE | Style v4 final: tokens, heading face (UI font or Rubik), card back (real or modernised), Daylight values, table theme scope | design kit, typeface test |
| DES-COMPONENTS | Component state sheet signed off (idle, hover, pressed, held, selected, disabled, loading, error) with timings | to be drawn |
| DES-MOTION | Motion and sound spec from the motion prototype: timings, easing, what moves, what sounds, reduced motion | motion prototype, optional Gemini research |
| DES-CONTROLS | Decision controls per mode (cards for quick drills, seat buttons at the table) | controls canvases |

### Phase 2: design foundation in code

| ID | Outcome | Depends | Tier | Size |
|---|---|---|---|---|
| DS-TOKENS-V4 | Style v4 tokens (panels, radii, gradients, shadows, buttons, pills, tiers, mix bar), Midnight + Daylight, heading face | DES-STYLE | T2 | M |
| SHELL-002 | New shell and sidebar, hub screens if chosen, About & legal footer link | DES-SHELL, tokens | T2 | L |
| DS-COMPONENTS-V4 | Shared components rebuilt once: buttons, pills, tabs, segmented, switch, fields, hero answer card, number tiles, tier pill, labelled mix bar, history rail, cards and backs, seats, ledger rows, labelled matrix with hover card, empty/loading/error states | tokens, DES-COMPONENTS | T2 | L |
| MOTION-001 | Functional motion layer: in-place swaps with reserved heights, deal/flip, chip and pot moves, counters, hover/press/hold feedback, skeletons; in-app reduced-motion toggle | components, DES-MOTION | T2 | M |
| SOUND-001 | First sound set (cards, chips, neutral study cues) with master volume and mute | DES-MOTION | T1 | M |
| LAYOUT-AUDIT-001 | Automated audit: overflow, clipping, reflow, dead space where reliable | components | T1 | M |

### Phase 3: screens in Style v4 (each: approved mockup first, then build, then owner QA)

Full redesigns first, then foundation passes that keep M2 reworks cheap. Screen order follows the logical time axis (screens with big reworks ahead get light passes now).

| Order | Screen | Treatment | Notes |
|---|---|---|---|
| 1 | Training (quick refresher + long session + feedback) | full redesign | core loop; panels: opener range, session results, plan after answering |
| 2 | Analyze | finish in v4 | spot as sentence, hero answer card, tiles, You here, labelled matrix |
| 3 | Home (+ Study hub if chosen) | redesign | Home = app-wide; Study = coverage, drills, queue, path |
| 4 | Settings | full redesign | all categories, table preview, Chippy and About & legal categories (only when they work) |
| 5 | Review | foundation pass | rail, walkthrough, key moments, luck panel in v4 |
| 6 | Hand | foundation pass | realistic table, input, rail |
| 7 | Full Hand / Orbit table | quality pass | realistic table size, seat buttons, Watch Rest skip |
| 8 | Equity | foundation pass | players, inputs, result in v4 |
| 9 | Personal Strategy | foundation pass | coverage, matrix, edges in v4 |
| 10 | Game night | foundation pass | ledger in v4, Edit, expandable buy-ins |
| 11 | Library / Saved (+ My poker if chosen) | foundation pass | list, inspector |
| 12 | Guide / Learn | foundation pass | until the M2 Learn hub |

### Phase 4: honesty and completeness (alongside phase 3, small tickets)

Trust package (reference measurement, exact maths everywhere, scoped tier labels); persistent storage + guarded "Delete all data"; i18n completeness (RU length, HE RTL with LTR poker data, [TERMINOLOGY](TERMINOLOGY.md) applied); issue-register M1 items; test hygiene; Hebrew mix-bar decision applied.

### Phase 5: close M1

Owner design pass over every screen (expect correction rounds); optional independent design critique (Gemini Argon) before the pass; RU / HE / Daylight QA; milestone gates; monthly "would I use it by choice?" check.

Owner answers on the plan (2026-10-15): the trust package is not a hard M1 gate; the Full Hand table visual pass stays in M1; screen order follows the logical time axis.

---

## Accepted and recent work

Commits on `codex/stabilization`. Per NORTH_STAR §10, a commit title is not acceptance evidence; acceptance status for each item is in the register.

| Commit | Date | Work | Acceptance |
|---|---|---|---|
| `0919e62` | 2026-10-03 | SAVED-COMPOSITION-002: Saved list + inspector; Midnight = mockup palette, mockup weights | Treated as accepted (D-01, 2026-10-15); the M1 owner design pass catches remaining issues |
| `bf90a55` | 2026-10-02 | SHELL-001: one header bar, shared canvas grid, compact sidebar footer, one accent action per view | same |
| `71b7ccb` | 2026-10-02 | DS-FOUNDATION-001: design-system foundation; override stylesheet retired | same |
| `1e23638` | 2026-10-02 | REPO-HYGIENE-001: LF via `.gitattributes`, Node engines (≥22, `.nvmrc` 24), portable Electron test, non-flaky range-analysis timing | Committed |
| `a0bc491` | 2026-10-02 | LANGUAGE-SWITCH-EVENT-001: language switch is presentation-only; source claims survive re-translation | same as D-01 |
| `da78be7` | 2026-10-01 | DECISION-INPUT-TRUTH-001: typed numbers kept, truthful facing wording, frame-true Replay | same as D-01 |
| `5ae58de` | 2026-10-01 | HOMEGAME-LEDGER-INPUT-001: amount validation, drafts kept across actions, Guest truth | same as D-01 |
| `2a444e2` | 2026-09-30 | SAVED-TRAINING-HISTORY-001: Training history view in Saved | same as D-01 |
| `cedf241` | 2026-09-29 | SAVED-LIBRARY-001: Saved library (search, filters, sort; 200 bound); first extraction pilot | same as D-01 |
| `8541e76` | 2026-09-29 | REFERENCE-INTEGRITY-RECOVERY-001: unsupported HRC pilot removed; strict reference coverage restored | Committed |
| `67b6713` | 2026-09-13 | Solver: local tree-building and memory benchmarks (46-node toy tree) | Committed |
| `ef902ba` … `b36999b` | 2026-09-07 → 09-13 | Beta candidate checkpoints (intelligence foundations, beta repair sweeps, modernization, browser smoke) | Checkpoint commits; detailed acceptance rows pending in the register |
| `d1c826e` | 2026-10-15 | DOCS-RESET-001: agent docs reset (AGENTS, NORTH_STAR, STATE, ISSUE_REGISTER, TERMINOLOGY, IDEA_BANK, DESIGN_SYSTEM); superseded planning docs archived | Accepted (owner, 2026-10-15) |
| `4e3e11a` | 2026-10-15 | ANALYZE-COMPOSITION-001 incl. amendments 1–2: composition, verdict dominance, fact omission, inline Explain | Accepted (owner, 2026-10-15; D-21); known follow-up for TRUTH-FIXES-001: heuristic provenance shown more than once |

### What exists today (one line per area; contracts in `docs/project/`)

| Area | State |
|---|---|
| Poker domain | `shared/poker-domain/`: Game Rules v1/v2, PokerState v1/v2/v3 (new live Hands v2; v3 recorded-settlement import), legality, accounting, evaluator, canonical Equity (incl. weighted Advanced Equity slice), 1,326-combo Range Core |
| Strategy | Deterministic heuristic baseline behind DecisionContext → StrategyProvider → StrategyResult → StrategyClaimPolicy; `reference-pack/v1` infrastructure with **no production pack registered**; no normative assessment policy registered |
| Hand / Replay / Review | Canonical Hand, table-first workspace, vertical street-grouped rail, Replay, shared Review; PokerStars English cash import |
| Analyze | Scenario/Hand analysis, verdict, facts, Explain, range matrix, category comparison, bluff/exploit teaching slices |
| Training | Varied, Focused, Full Hand vs synthetic policies; Training Memory, Same/Similar Spot, Unsure + 24h Revisit |
| Personal Strategy | Games/Approaches, question-driven RFI mapping, Understanding, Matrix Edit, Teach-through-a-Hand (BTN/BB) |
| Saved / Home | Saved Hand/Spot library + Training history view; Home with Continue, Study Inbox; Guide |
| Game night | Separate exact-money organizer (players, groups, sessions, append-only ledger, settlement) |
| Accounts | Local-first; Device Guest + account isolation; Supabase auth and opt-in sync built but **live provider/RLS acceptance not done** (M1/M2 stay local-only) |
| Experience | Audio/motion event layer; themes (Midnight = mockup palette, Graphite, Daylight, custom); EN/RU/HE with RTL |
| Solver research | `solver/` isolated bounded HU preflop solver and benchmarks; not a production dependency |

---

## Open decisions

Decisions the owner (or Manager) still has to make. Mockup-derived items are design questions, not facts; mockup numbers are illustrative only.

| ID | Decision | Source / note |
|---|---|---|
| D-02 | Bulk disposition of ~60 pre-reset "human acceptance pending / partial" rows (Beta-era, Firefox-matrix debts): close as superseded by the M1 redesign + owner design pass, or keep individually | ISSUE_REGISTER §G |
| D-03 | Shell and sidebar direction (variant 4 with hubs, 2, or current refreshed); whether Tools/Study hubs become screens. Decide before M1 screen work | NORTH_STAR §13; mockups 12, 14, 16, 18 |
| D-04 | "My poker": own sidebar slot vs merge with Saved into "Library"; final name | NORTH_STAR §13; mockup 11 |
| D-05 | Decision controls: Slabs + Choice cards mix (big action-tinted cards with sizes inside) vs at-your-seat round buttons; per mode | mockups 15, 16 |
| D-06 | Drill presentation: table vs table-less (both modes exist: quick refresher and atmospheric session); which panels Training gets without leaking answers | mockups 1, 20; NORTH_STAR §13 |
| D-07 | Equity layout A (rows) vs B (columns); runouts per player | mockup 5 |
| D-08 | Learn hub: B's concept path + quick trainers with A's order and features (details) | mockup 9 |
| D-09 | Personal Strategy answer methods (brush, thresholds, buckets, table questions) and the two hand groupings (rows for asking, roles for teaching) | mockup 2; research item |
| D-10 | Heading face: current UI font vs Rubik (owner leans Rubik; serifs rejected) | mockup 17 |
| D-11 | Card back: the app's real back vs the kit's modernised proposal | mockups 19, 20 |
| D-12 | Daylight values (first draft only) and table-theme picker scope | DESIGN_SYSTEM; mockup 13 |
| D-13 | Mix bar direction in Hebrew: left-to-right data island (Manager leans) vs mirrored | NORTH_STAR §13; mockup 13 |
| D-15 | Game night workspace name ("Game night" applied; owner may revisit) | NORTH_STAR §13 |
| D-16 | Baseline for 30–60 bb multiway home play: how to reference-check (may stay Estimated); exact "Verified" tolerances per spot type (worker proposes, owner approves) | NORTH_STAR §3, §13 |
| D-17 | Open-source vs closed (keeps AGPL out until decided) | NORTH_STAR §3.4, §13 |
| D-18 | Pre-dependency versions of screens (an M1/M2 screen never relies on an M3 feature); Manager handles per redesign ticket | NORTH_STAR §13 |
| D-20 | Historical pilot-era Training Memory records (2026-09 HRC pilot): zero affected records found on the owner's origins; field-path control not run. Close, or run the control | NORTH_STAR §2; RET-REFERENCE-PACK-001 |
| D-22 | Older carried-over product questions: Training `Not sure` behaviour; Training-evidence opt-in placement/default; default comparison source; Home Game settlement preference (fewest transfers first per NORTH_STAR §7.9); username login before release; card-outcome preview touch/click semantics | archived PRODUCT_BACKLOG §14 |

### Resolved (owner, 2026-10-15)

| ID | Decision |
|---|---|
| D-01 | Tickets committed but never formally accepted (SHELL-001, DS-FOUNDATION-001, SAVED-*, DECISION-INPUT-TRUTH-001, LANGUAGE-SWITCH-EVENT-001, HOMEGAME-LEDGER-INPUT-001, token tuning) are treated as accepted for now; the M1 owner design pass catches remaining issues |
| D-14 | Style v4 values win: panel radius 16 px, panel padding 22 px, content max width ~1640 px, buttons 40 px (44–48 px for the main action). Recorded in [DESIGN_SYSTEM](project/DESIGN_SYSTEM.md) |
| D-19 | Analyze workspace name: RU «Анализ», HE «ניתוח». Hebrew "Hero" = «הירו»; Russian keeps Latin "Hero", as in [TERMINOLOGY](TERMINOLOGY.md#applying-this-sheet-code-still-differs). String changes are done in I18N-TERMS-001 |
| D-21 | Analyze work accepted; committed in order Analyze `4e3e11a`, then docs reset `d1c826e` (backup `956ca6e` superseded) |

Answered and recorded in NORTH_STAR (not open): verdict states, confidence tier names, Equity input types, streaks dropped, achievements reopened, Table rules naming, data-safety staging, 650 weights.

---

## Pointers

- Direction and decisions: [NORTH_STAR.md](NORTH_STAR.md) (§12 lists decisions that changed recently).
- Bugs, debt, small wants, pending acceptance: [ISSUE_REGISTER.md](ISSUE_REGISTER.md) (search by ID).
- Visual contract: [project/DESIGN_SYSTEM.md](project/DESIGN_SYSTEM.md).
- Terms: [TERMINOLOGY.md](TERMINOLOGY.md). Ideas: [IDEA_BANK.md](IDEA_BANK.md).
- Reference specs (read only when a ticket names them): [project/](project/); guardrails for future capabilities: [project/CAPABILITY_GUARDRAILS.md](project/CAPABILITY_GUARDRAILS.md).
- History: [archive/](archive/README.md).
