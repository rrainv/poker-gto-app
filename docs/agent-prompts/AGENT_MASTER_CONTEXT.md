# Agent Master Context

Last refreshed: August 31, 2026 (`CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` joins Saved, Core Flow, Replay, Training, Equity, Analyze/Range, and First Use/Home as completed and human accepted; the cheap Saved global-preview console guard is active next, followed by `GUIDE-CONTENT-001` and September Alpha closure/audit preparation; `PERSONAL-STRATEGY-003A` remains preserved for a post-audit activation decision and `PREMIUM-CLOSEOUT-001` remains a later pre-release quality gate).

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
- **Current strategy:** deterministic generalized heuristic under `app/src/strategy/`; `reference-pack/v1` validation/matching/provider infrastructure exists, but no production pack or validated general Hold'em production reference is registered.
- **Training:** planner/intents/requests own structural curriculum targets only; canonical generator owns legal trajectories; sizing families are generation targets, not recommendations. Training Memory v1 owns durable encountered-decision/session evidence and frozen answer-time source/claim snapshots, not grading or Saved intent.
- **Analysis:** `RangeAnalysisFacts v1` owns canonical factual classification; DOM-free `range-comparison-facts/v1` projects representative-class comparison facts over Range Core card-removal truth; `AnalysisExplanation v1` consumes trusted facts without recreating poker/strategy/Equity.
- **Presentation:** `table-presentation/v1` and `hand-review/v1` are ephemeral projections only.
- **Experience:** `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- **Saved:** `SavedStudyObject v1` remains persistence/schema authority for current Hand/Spot objects; DOM-free `saved-study-preview-facts/v1` is the bounded preview projection, unknown future kinds remain unsupported, and consumers do not invent bookmark/note/review stores.
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

`DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, `WORKSPACE-COMPOSITION-002`, `DOCS-CAPABILITY-DOSSIERS-001`, `TABLE-PHYSICALITY-003`, `HOME-GAME-001B`, `SETTINGS-IA-001`, and `TRAINING-MEMORY-001` are completed/accepted checkpoints. `REFERENCE-PACK-001` is checkpointed/intentionally incomplete: its contract, strict matcher, provider/fallback, and synthetic consumer tests are accepted, while production source acquisition remains `RET-REFERENCE-PACK-001`.

`HANDS-ON-PRODUCT-REVIEW-001` is completed documentation/product triage. An independent outside-user review originated 59 findings, and the product owner manually reproduced all 59 in the current build. [The durable review](../project/HANDS_ON_PRODUCT_REVIEW_2026_08.md) owns detailed evidence and row-level ownership; no finding is closed by the review. Detailed future intent lives in `../project/capabilities/`; status remains in `PRODUCT_BACKLOG.md`. The directional order is:

1. **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT — `HANDS-ON-DEFECTS-001`**
2. **COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT — `CORE-FLOW-CORRECTNESS-001`**
3. **COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT — `REPLAY-RAIL-NAV-001`**
4. **COMPLETED / HUMAN ACCEPTED — `TRAINING-COMPOSITION-001`**
5. **COMPLETED / HUMAN ACCEPTED — `EQUITY-COMPOSITION-001`, `ANALYZE-RANGE-UX-001`, and `FIRST-USE-HOME-001`**
6. **COMPLETED / HUMAN ACCEPTED — `SAVED-VISUAL-KNOWLEDGE-001`**
7. **COMPLETED / HUMAN ACCEPTED — `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001`**
8. **ACTIVE NEXT — cheap Saved global-preview console guard**
9. **PLANNED NEXT — `GUIDE-CONTENT-001`**
10. **SEPTEMBER ALPHA CLOSURE — human whole-app pass → documentation integrity/continuity freeze → human clean commit/audit tag → cross-model blind hands-on and white-box architecture audits → human triage → P0/P1 fixes**
11. **PRESERVED MAJOR FEATURES / ACTIVATE ONLY FROM POST-AUDIT EVIDENCE — `PERSONAL-STRATEGY-003A`, `GAME-SETUP-EVOLUTION-001`, `RANGE-EVOLUTION-001`, and the documented capability roadmap**
12. **RETURN DEPENDENCIES — `REFERENCE-PACK-001` production source acquisition/review and `TRAINING-MEMORY-001` manual Firefox acceptance**
13. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**
14. release/mobile/social/PLO later

This order is directional and may move after accepted checkpoints. Reprioritization updates affected live planning documents together; a tiny patch with no product-state change requires no Roadmap churn.

## Current checkpoint boundaries

- `AUDIO-MOTION-001` is accepted; subjective Study/UI/Check polish remains `RET-AUDIO-001` debt, not current scope.
- `SETTINGS-IA-001` is accepted structurally; its unavailable real Firefox category/viewport/theme/language matrix remains `QA-HANDSON-010` / `RET-PREMIUM-001` debt.
- `PREMIUM-CLOSEOUT-001` is not cancelled: it is the later whole-product manual, visual, responsive, localization, accessibility, Guide, Core Flow, and release-quality gate after the feature set is materially more mature.
- `UX-REGRESSION-001` is accepted: the eleven owned hands-on IDs are closed with a 1,773/1,773 Node baseline and bounded Firefox 154 acceptance; unowned composition/product debt remains open.
- Training Varied/Focused/Full Hand, the Practice Planner, and Training Memory v1 are implemented foundations. Advanced scheduling/cross-surface memory work and `Not sure` remain future; exact source/claim snapshots and historical/current labels are binding.
- `reference-pack/v1` has no production data registration. Never promote its synthetic test fixture, benchmark observations, or generalized heuristic curves into trusted reference truth.
- Personal Strategy is checkpointed through legacy-named Calibration/Matrix/Builder/Teacher. The [independent `002R` review and human disposition](../project/PERSONAL_STRATEGY_002R_REVIEW.md) are accepted; `003A` remains the preserved versioned Game setup/Approach migration and local-first RFI-first first-value reset, but is not immediately next and may be activated only from post-September-Alpha audit evidence. Provider/reference/observed integration still follows 003A acceptance.
- Saved Hand/Spot and `HOME-002A` exist. `SAVED-VISUAL-KNOWLEDGE-001` is human accepted: compact grid primary; All / Hands / Spots visible at zero; DOM-free observer-safe Hand and lossy Scenario Spot previews; body-level bounded hover/focus overlay; click/Enter detail; shared cards; identity clearing; unknown-kind unavailable state; unchanged reopen behavior. Full `HOME-002B` search/pagination and new payload kinds do not exist.
- Saved Training Experience, Saved Equity Snapshot, and learner-facing Full Hand Hero-fold termination are preserved future work only; they are not activated, prioritized, or current Saved kinds.
- `FIRST-USE-HOME-001` is human accepted. Home is the permanent recurring startup/study destination; optional Welcome orientation is separate presentation state, defaults to shown with suppression unchecked, suppresses only itself, and has zero selected sidebar destinations. Navigation always reflects the real destination. Guest Home is useful without sign-in. Continue uses only a live canonical Hand or active/paused Personal Strategy; all other current states receive Start. Training, Analyze, Equity, and last-route continuation remain unsupported pending explicit contracts. Current identity surfaces share one canonical brand-spade asset separately from poker-card suits.
- Home Game `001B` is an accepted implementation checkpoint over the separate 001A accounting authority; hard delete/import remain deliberately deferred and real Firefox/provider acceptance remains `RET-HOMEGAME-001` debt.
- Workspace composition is accepted as a useful implementation checkpoint, not a whole-product visual-polish closeout: surviving specialized-layout polish remains `RET-COMPOSITION-002` debt. `EQUITY-COMPOSITION-001` is human accepted with bounded 2–10-player input, presentation-only inline names, adjacent Board/Dead/Method setup, compact lifecycle states, a dominant completed comparison, shared transactional card-set editing, and exact-entered-hand next-card outcomes that keep strict-ahead cards separate from structural completions still behind. Richer Equity/Hand Analysis remains preserved future work. Known-card inspectability is separately owned by `RET-CARDS-THEMES-001`.
- `HANDS-ON-DEFECTS-001` is accepted only as a bounded repair checkpoint. Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, card-removal parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry are accepted; this is not whole-product or Hand/Training composition acceptance.
- `CORE-FLOW-CORRECTNESS-001` is the completed, human-accepted Core Flow correctness checkpoint. Preserve the fresh-Hand lifecycle; generalized session-level append-only correction over eligible buy-in/rebuy/add-on/cash-out facts with optional reason; continuous two-card known-opponent picker with logical focus and duplicate-card exclusion; and verified canonical minimum-raise/reopening semantics, including a legal 7bb → 13bb reraise from a 6bb last full increment. No human gate remains and no poker-domain rule changed.
- `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` is completed and human accepted. Canonical `PokerState` semantics were correct; the root cause was application/UI coordination: fully known hole deals were mislabeled as hidden/observed Replay events, Replay transition rejection left a stale committed flop draft, and the consumed card could reappear as a later chance candidate. Preserve the accepted explicit Turn → River → Showdown flow, the canonical available-card exclusion of current board, known hole cards, dead cards, and pending selections, stale consumed-draft removal before picker open, Replay/live terminal agreement, and exact-once runout events. Do not reopen Hand composition.
- `REPLAY-RAIL-NAV-001` is the human-accepted Hand/Replay composition checkpoint: compact Hand context/state on the left, the primary poker table in the center, and legal/chance controls, distinct Replay, and bounded vertical History on the right. Preserve table-first hierarchy, stable live/Replay structure, accepted chronology and seeking, Return to live, canonical actions, no-dongle cards, contributions, Abort/Raise/all-in/invalid-size behavior, EN/RU/HE/RTL, Daylight contrast, and Review. Minor debt remains explicit: dense/10-max lower side panels sit slightly too far inward and the top player slightly too far outward/high; hidden backs may later tuck under their owning player if privacy, ownership, inspectability, and non-obstruction remain intact; full-ring Dealer presence/explainability belongs to table physicality/Game Setup rather than a fake dealer; and History padding/weight/contrast/density/event-row polish belongs to global/premium quality. Do not reopen the accepted architecture for those debts.
- **September Alpha** is the near-term internal/high-quality-alpha milestone: a coherent, trustworthy, human-tested desktop build with accepted Hand/Replay, Training, Equity, Analyze/Range, materially improved First Use/Home and systemic polish, synchronized documentation, a whole-product manual pass, independent cross-model hands-on and theoretical audits, and serious findings triaged/fixed. It does not claim public beta readiness, production reference coverage, completed live account/sync validation, mobile/social/PLO completion, or completion of the long-term capability roadmap.
- The 59 confirmed August findings supersede any broad claim that accepted UI checkpoints equal current whole-product visual acceptance. Existing foundations remain accepted; remaining problems stay open under their named correctness, redesign, and quality owners in the review artifact.

## Hands-on product workflow

For user-facing feature work, use: agent implementation → automated verification → human hands-on use → product discussion → correction/acceptance → checkpoint. After roughly two or three substantial user-facing tickets, perform a short freeform whole-product hands-on pass even if ticket-level automation passed. Backend/foundation tickets with no meaningful visible surface may be checkpointed without artificial browser QA.

## Deliberately retired

Do not revive browser/Electron ONNX inference, native strategy IPC, remote strategy API, arbitrary solver-tree upload, root legacy Training/model/tree prototypes, duplicate Equity, synthetic Training, or arbitrary drag/drop layout editing without a new approved architecture.

## Read routes

Always read `CODEX_WORKFLOW.md`, `../project/CURRENT_PHASE.md`, and the relevant subsystem spec. UI/product work also reads `../project/QA_BACKLOG.md`, `../project/PRODUCT_RETURN_QUEUE.md`, and `../project/PRODUCT_SPEC.md`. Future capability work reads `../project/PRODUCT_BACKLOG.md`. Documentation/state changes read `../project/DOCUMENTATION_GOVERNANCE.md`.

Budget remains approximately US$75 total unless explicitly changed. No paid/cloud experiment without a cap, runtime, artifact, success criteria, and stop criteria.
