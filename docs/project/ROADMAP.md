# Riverline Roadmap

Last refreshed: August 24, 2026 (`WELCOME-INTRO-001` completed at an accepted implementation checkpoint; `WORKSPACE-COMPOSITION-002` active next).

This roadmap explains directional sequencing. `CURRENT_PHASE.md` owns the exact current checkpoint and execution order; `PRODUCT_BACKLOG.md` owns detailed accepted capability/status. The order may move after later accepted checkpoints.

## Product north star

Riverline is becoming a local-first **personal poker learning workstation**:

```text
Play a complete hand
  -> review important decisions and Replay
  -> compare with a selected trusted reference where available
  -> compare with intended Personal Strategy and observed behavior
  -> preserve notes, uncertainty, and provenance
  -> save useful study objects
  -> re-drill mistakes and similar spots
  -> learn recurring patterns over time
```

Reference strategy, intended Personal Strategy, observed behavior, and opponent policy remain distinct roles.

## Accepted foundation

The current checkpoint includes:

- GameRulesSnapshot/PokerState v2 adoption and strict versioned Scenario/Training/Replay/Saved durability;
- one DecisionContext/StrategyProvider/StrategyResult/StrategyClaimPolicy path and generalized heuristic fallback;
- canonical Equity, range core, and structural range-aware/Bluff Analysis;
- Training Practice Planner plus Varied/Focused/Full Hand foundations;
- Personal Strategy Calibration/Matrix/Builder/Teacher automated checkpoints;
- Saved Hand/Spot, My Riverline, account/Guest/sync foundations, and Home Game Organizer `001A`;
- adaptive Table Presence, canonical Replay, shared Full Hand Review, and accepted audio/motion architecture.

The accepted Node baseline at `UX-REGRESSION-001` is 1,773/1,773. The ticket also completed bounded Firefox 154 acceptance for its owned states; this does not convert unrelated implementation tests into visual sign-off, and remaining manual/live-provider debt stays in QA and the Return Queue.

## Why visible product work was extended

Hands-on QA found real functional regressions, visibly weak compositions, first-use/onboarding problems, a broken Home Game Create flow, Training semantic problems, card/board/table readability defects, and weak layout/density value. Passing structural/no-overlap tests does not make those defects acceptable.

Riverline therefore should not immediately return to deep reference/math work. It first executes a bounded visible-product repair and closeout sequence. After Premium Closeout, it alternates back into trusted reference strategy and learning intelligence so neither polish nor infrastructure becomes endless.

## Current directional sequence

`DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, and `WELCOME-INTRO-001` are completed/accepted. The later roadmap order is preserved:

1. **COMPLETED — `UX-REGRESSION-001`** — eleven immediate functional, semantic, persistence, and legibility regressions repaired without changing poker authority or absorbing subjective audio debt.
2. **COMPLETED — `WELCOME-INTRO-001`** — the bounded local-first orientation passed automated gates and human Firefox/manual visual acceptance, including obvious `Learn Riverline` discovery outside Settings.
3. **ACTIVE NEXT — `WORKSPACE-COMPOSITION-002`** — repair hierarchy, dead space, control grouping, density value, weak presets, Training facts, Equity composition, and table balance.
4. **PLANNED NEXT — `TABLE-PHYSICALITY-003`** — improve the default table/felt/rail/seat/card/chip/contribution/pot/readability composition over the existing presentation/experience seams.
5. **`HOME-GAME-001B`** — continue organizer management, correction history, lifecycle, import/export decision, and Firefox acceptance.
6. **`SETTINGS-IA-001`** — decompose the Settings god menu and improve help/tutorial discovery; transactional theme editing and immutable built-ins are already repaired.
7. **`PREMIUM-CLOSEOUT-001`** — whole-app Core Flow, Guide, responsive/theme/density/card, EN/RU/HE/RTL, accessibility, and human visual closeout.
8. **First trusted bounded reference pack/provider** — exact assumptions, versioning, validation, licensing/provenance, capabilities, exact coverage, fallback elsewhere.
9. **Training Memory / re-drill** — canonical DecisionRecord/session history, review queue, same/similar spot, spaced/adaptive study, filters and truthful trends.
10. **`PERSONAL-STRATEGY-002R`** — independent real-user review of Calibration/Matrix/Builder/Teacher.
11. **Personal Strategy provider/reference/observed integration** — preserve intended/reference/observed semantic roles and explicit Training evidence opt-in.
12. **`PERSONAL-INSIGHTS-001`** — cross-profile Teach Riverline Next uncertainty queue and evidence/provenance/uncertainty-aware natural-language summaries.
13. **`RANGE-EVOLUTION-001`** — canonical combo-level action-conditioned preflop-to-flop-to-turn-to-river range propagation.
14. **`HOME-002B` Saved Study Library** — dense master-detail library over approved payloads.
15. **OpponentPolicy / bots** — separate provenance-aware behavior contract and later full-hand bot learning.
16. **Release/mobile/social/PLO later** — deliberate platform and separate game-domain work after foundations are ready.

## Phase A — visible product repair and closeout

The phase owns the seven visible tickets above. Permanent constraints:

- functional correctness is necessary but not sufficient;
- card picker/known-card/board/sizing/tutorial/save/control-grid invariants remain durable;
- presets and density must create real task value or be simplified;
- Table Focus must materially increase table readability;
- default table quality comes before more customization;
- no casino scene, avatars by default, fake cinematic 3D, spectacle, confetti, or reward loops;
- visible acceptance requires real-browser/human judgment where composition matters.

`WELCOME-INTRO-001` introduces the product and major jobs. It does not replace contextual workspace tutorials, which keep their own versioned completion/persistence contract.

## Phase B — trusted reference strategy

Choose one reproducible bounded preflop family. Define exact Game Rules/rake, stack, sizing tree, context matcher, provenance/licensing, validation evidence, declared capabilities, and unsupported fallback behavior. Source branding alone grants no authority. Broader coverage follows only after measurable validation.

Private paid-product observations remain research evidence and cannot become production packs.

## Phase C — Training becomes a persistent learning system

The implemented Practice Planner remains structural curriculum authority only; the canonical generator stays legal-trajectory authority. Add durable decision/session records, review/mistake queues, same/similar re-drill, spaced/adaptive scheduling, filters/saved drills, honest summaries/trends, and Home/Replay continuity.

Comparative heuristic disagreement is not objective poker correctness. Study streaks/goals remain an open restrained decision; mastery waits for valid history; XP/badges/levels/achievements are rejected by default.

## Phase D — Personal Strategy integration and insight

After independent `002R` review:

- add a personal/intended provider/comparison adapter without turning intent into normative truth;
- keep selected reference, intended strategy, and observed play distinct;
- make Training evidence explicit opt-in and preserve contradictions;
- implement `PERSONAL-INSIGHTS-001` with transparent cross-profile uncertainty ranking and evidence-backed summaries;
- preserve profile snapshots/experiments/rollback and data portability as future work.

## Phase E — action-conditioned ranges and Saved knowledge

`RANGE-EVOLUTION-001` must propagate canonical combo-level ranges through exact actions with provenance and unknown-preserving semantics. Reference and Personal Strategy roles remain separate. `HOME-002B` then expands Saved discovery using only approved versioned payloads—Hands/Spots first, then Ranges/Drills/Reviews/Sessions as their owning tickets exist.

## Phase F — opponent policies and full-hand learning

Create a versioned opponent-behavior contract separate from reference strategy. Generic/environment/custom policies and Personal Strategy-as-opponent keep explicit provenance. Full-hand bot Training may then feed the existing legal Hand, Review, Save, and re-drill loop without claiming a bot accurately models a real person.

## Parallel maintenance and release gates

These may interrupt only for real security/data/release blockers:

- live Supabase migrations/RLS and two-profile Firefox acceptance;
- username adapter decision and trusted-server implementation if still required;
- targeted `logic.js` extraction behind stable seams when touched by real work;
- packaging/hosting/offline/privacy/legal/observability before public release;
- human EN/RU/HE/RTL, responsive, theme, accessibility, and live-provider acceptance.

## Preserved branches and decisions

- sharing/forking/friends/study groups and friend challenges/shared drills after privacy/versioning maturity;
- user-visible personal-data export/import;
- restrained table/felt/chip presentation choices as a later design question, never compensation for a poor default;
- deliberate mobile composition, not stacked desktop;
- PLO as a separate game/evaluation/range/reference domain;
- model/interpolation only after trustworthy datasets demonstrate value;
- public release, monetization, telemetry, and restrained gamification remain explicit product decisions.

## Priority rule

Alternate visible product progress with intelligence/foundation work. Do not let audits, strategy infrastructure, premium polish, or one competitor become the roadmap. Follow `DOCUMENTATION_GOVERNANCE.md`: accepted priority/status/debt changes update the affected live documents together; a tiny patch with no product-state change does not churn this roadmap.
