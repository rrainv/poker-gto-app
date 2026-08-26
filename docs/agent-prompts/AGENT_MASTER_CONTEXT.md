# Agent Master Context

Last refreshed: August 26, 2026 (`SETTINGS-IA-001` completed as an accepted implementation checkpoint with explicit manual Firefox debt; the first trusted bounded reference pack/provider is active next; `PREMIUM-CLOSEOUT-001` is deferred to the pre-release quality gate).

This is compact agent execution context, not a Product Backlog. `CURRENT_PHASE.md` owns execution order, `PRODUCT_BACKLOG.md` owns accepted capability/status, and `DOCUMENTATION_GOVERNANCE.md` owns update rules.

## Product and runtime

Riverline is a browser-first personal poker learning workstation connecting full-hand play, Review/Replay, Analyze, selected-reference comparison, Personal Strategy, Saved continuity, Training/re-drill, and later opponent policies. It should feel calm, serious, state-aware, and non-casino.

```text
app/index.html
├─ classic orchestration: app/src/core/logic.js
├─ GameRulesSnapshot v1 -> PokerState v2 for new live Hands
├─ Scenario or PokerState -> DecisionContext v1.1
├─ StrategyProvider v1 -> StrategyResult v1 -> StrategyClaimPolicy v1
├─ canonical Equity and range/evaluator facts under shared/poker-domain
├─ TrainingPracticePlanner -> canonical Training generator/session/grading
├─ table-presentation/v1 -> shared renderer
├─ hand-review/v1 -> shared Hand/Full Hand Training review
├─ experience-event/v1 -> riverline-audio/v1 + riverline-motion/v1
├─ Saved/Home, Personal Strategy, account/sync, and Home Game application domains
└─ product-performance/v1 scheduling and invalidation
```

Electron is a thin host for the same app. Solver research stays isolated under `solver/riverline_solver/`.

## Canonical authorities

- **Game Rules:** `GameRulesDefinition v1` / immutable `GameRulesSnapshot v1`; brand/operator provenance never selects accounting.
- **Poker:** `shared/poker-domain/` owns PokerState v1/v2, cards, actions, legality, accounting, evaluator, Equity, combos, and weighted ranges.
- **Decision strategy:** `DecisionContext v1` with additive `decision-context/v1.1` -> `StrategyProvider v1` -> `StrategyResult v1` -> `StrategyClaimPolicy v1`.
- **Current strategy:** deterministic generalized heuristic under `app/src/strategy/`; no validated general Hold'em production reference.
- **Training:** planner/intents/requests own structural curriculum targets only; canonical generator owns legal trajectories; sizing families are generation targets, not recommendations.
- **Analysis:** `AnalysisExplanation v1` and `RangeAnalysisFacts v1` consume trusted facts without recreating poker/strategy/Equity.
- **Presentation:** `table-presentation/v1` and `hand-review/v1` are ephemeral projections only.
- **Experience:** `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- **Saved:** `SavedStudyObject v1` with strict versioned Hand/Spot and Replay sources; consumers do not invent bookmark/note/review stores.
- **Personal Strategy:** sparse immutable intended-strategy evidence; reference and observed behavior stay separate.
- **Home Game:** exact-money organizer domain separate from poker/study authorities.

## Critical semantic facts

- Scenario is lossy; Hand is canonical legal history.
- New live Hands use snapshot-authoritative `poker-state/v2`; v1 is historical compatibility.
- `facingSizeBb` is wager-to context; `callAmountBb` is exact incremental price when known.
- Exact pot/SPR uses `currentPotBb`; live stack reasoning uses Hero/effective-stack fields, never compatibility `potBb`/`stackBb`.
- Exact preflop decision role stays distinct from generalized fallback calibration.
- The v4 bounded BB-vs-BTN cold-response policy remains generalized comparative evidence, not solved or independently validated reference truth.
- Source identity, provenance, authority, coverage, capabilities, and permitted claims are distinct.
- Personal dominant-only evidence is never fake 100% frequency.
- Structural tests do not replace human visual acceptance.

## Current execution snapshot

`DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, `WORKSPACE-COMPOSITION-002`, `DOCS-CAPABILITY-DOSSIERS-001`, `TABLE-PHYSICALITY-003`, `HOME-GAME-001B`, and `SETTINGS-IA-001` are completed/accepted checkpoints. Settings now has four focused categories over the existing preference authorities, with its unavailable live Firefox acceptance retained as routed debt. Detailed future intent now lives in `../project/capabilities/`; status remains in `PRODUCT_BACKLOG.md`. The directional order is:

1. **ACTIVE NEXT — first trusted bounded reference pack/provider**
2. **PLANNED NEXT — Training Memory / re-drill**
3. **PLANNED NEXT — `PERSONAL-STRATEGY-002R`**
4. **PLANNED NEXT — Personal Strategy provider/reference/observed integration**
5. **NEXT INTELLIGENCE WAVE / ORDER TO REASSESS —** `PERSONAL-INSIGHTS-001`, `EQUITY-HAND-ANALYSIS-001A`, `RANGE-EVOLUTION-001`, deeper Bluff/Exploit analysis, Opponent Intelligence / OpponentPolicy, and `HOME-002B`
6. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**
7. release/mobile/social/PLO later

This order is directional and may move after accepted checkpoints. Reprioritization updates affected live planning documents together; a tiny patch with no product-state change requires no Roadmap churn.

## Current checkpoint boundaries

- `AUDIO-MOTION-001` is accepted; subjective Study/UI/Check polish remains `RET-AUDIO-001` debt, not current scope.
- `SETTINGS-IA-001` is accepted structurally; its unavailable real Firefox category/viewport/theme/language matrix remains `QA-HANDSON-010` / `RET-PREMIUM-001` debt.
- `PREMIUM-CLOSEOUT-001` is not cancelled: it is the later whole-product manual, visual, responsive, localization, accessibility, Guide, Core Flow, and release-quality gate after the feature set is materially more mature.
- `UX-REGRESSION-001` is accepted: the eleven owned hands-on IDs are closed with a 1,773/1,773 Node baseline and bounded Firefox 154 acceptance; unowned composition/product debt remains open.
- Training Varied/Focused and the Practice Planner are implemented foundations; Training Memory/re-drill is separate future work.
- Personal Strategy is checkpointed through Calibration/Matrix/Builder/Teacher; resume at independent `002R`, then integration, then Personal Insights.
- Saved Hand/Spot and `HOME-002A` exist; the full `HOME-002B` library does not.
- Home Game `001B` is an accepted implementation checkpoint over the separate 001A accounting authority; hard delete/import remain deliberately deferred and real Firefox/provider acceptance remains `RET-HOMEGAME-001` debt.
- Workspace composition is accepted as a useful implementation checkpoint, not a visual-polish closeout: Training support distribution/Session Progress, bounded left-anchored Equity allocation, and surviving specialized-layout polish remain `RET-COMPOSITION-002` debt. Known-card inspectability is separately owned by `RET-CARDS-THEMES-001`.
- `TABLE-PHYSICALITY-003` is accepted with explicit presentation debt: legitimately revealed opponent cards can be obscured by seat/action/cradle chrome, owned by `RET-CARDS-THEMES-001`; Review timeline orientation remains an open Riverline product-fit comparison owned by `RET-REVIEW-NAV-001`, not a permanent horizontal-layout decision.

## Deliberately retired

Do not revive browser/Electron ONNX inference, native strategy IPC, remote strategy API, arbitrary solver-tree upload, root legacy Training/model/tree prototypes, duplicate Equity, synthetic Training, or arbitrary drag/drop layout editing without a new approved architecture.

## Read routes

Always read `CODEX_WORKFLOW.md`, `../project/CURRENT_PHASE.md`, and the relevant subsystem spec. UI/product work also reads `../project/QA_BACKLOG.md`, `../project/PRODUCT_RETURN_QUEUE.md`, and `../project/PRODUCT_SPEC.md`. Future capability work reads `../project/PRODUCT_BACKLOG.md`. Documentation/state changes read `../project/DOCUMENTATION_GOVERNANCE.md`.

Budget remains approximately US$75 total unless explicitly changed. No paid/cloud experiment without a cap, runtime, artifact, success criteria, and stop criteria.
