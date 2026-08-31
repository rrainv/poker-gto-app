# Current Repository Audit

Status: **HISTORICAL / SUPERSEDED AS CURRENT-STATE AUTHORITY — DATED EVIDENCE SNAPSHOT**

Snapshot refreshed August 31, 2026 through `STRATEGY-TRUST-001` from the `DOCS-INTEGRITY-001` audit baseline. This is a dated evidence snapshot, not planning or current-state authority. Its measurements and then-current observations remain evidence; any live status, identity/isolation claim, or execution order is superseded by `CURRENT_PHASE.md`, `PRODUCT_BACKLOG.md`, `QA_BACKLOG.md`, `PRODUCT_RETURN_QUEUE.md`, and the relevant current specification. Executable code and passing tests remain final implementation truth.

No browser/manual acceptance was performed for the Training Memory checkpoint because browser discovery returned no available browser. Existing manual and live-provider gaps remain in `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

## 1. Runtime and canonical poker domain

Production loads one browser application from `app/index.html`; `app/main.js` is a thin Electron `BrowserWindow` host with no preload strategy bridge, model runtime, or second poker implementation. Classic application/UI orchestration remains concentrated in `app/src/core/logic.js` with extracted versioned application seams.

`shared/poker-domain/` is canonical for cards, structured actions, betting/chance transitions, legality, accounting, evaluator, Equity, Hold'em combo identity, and weighted range math.

`GameRulesDefinition v1`, preset validation, and immutable self-contained `GameRulesSnapshot v1` live in `shared/poker-domain/game-rules.js`; the legacy Home/ClubGG compatibility bridge is separate. Mathematical behavior comes from snapshot definitions, never brand/operator/preset provenance. New production Hand initialization uses snapshot-authoritative `poker-state/v2`; historical v1 state remains readable without rewrite.

## 2. Versioned Scenario, Training, Replay, and Saved rules durability

Current snapshot-aware paths are present and tested:

- `playbook-scenario/v2` remains a strict lossy study snapshot with `GameRulesSnapshot v1` and no invented legal history;
- `training-config/v2` / `training-exercise/v2` use snapshot-authoritative generation where supported;
- `canonical-hand-replay-source/v2` / events reconstruct `poker-state/v2` through canonical transitions;
- `saved-hand-snapshot/v2` and `saved-spot-snapshot/v2` preserve matching rules semantics inside the unchanged outer `saved-study-object/v1` envelope;
- historical v1 Scenario, Replay, Saved, and Training readers remain explicit and strict.

Cold Replay/import does not require a live preset repository or operator lookup. Presentation frames, playback cursors, DOM state, and animation timing are never persisted.

## 3. Decision and strategy authority

The production decision path is:

```text
Scenario or canonical PokerState
  -> DecisionContext v1 + additive contractVersion decision-context/v1.1
  -> StrategyProvider v1
  -> StrategyResult v1
  -> StrategyClaimPolicy v1
  -> Playbook / Training / Matrix / Analysis / in-memory Review
```

DecisionContext v1.1 exposes exact current pot, starting/live Hero stack, HU or per-opponent effective stacks, postflop position relation, canonical legal raise/all-in bounds, bounded action history, and derivation quality. Live logic uses `currentPotBb` and live/effective stack fields; legacy `potBb` and `stackBb` remain compatibility values. Scenario preserves unavailable facts instead of manufacturing canonical evidence.

Exact preflop role semantics distinguish unopened RFI, isolation, BB option after limps, cold response to open, blind-vs-blind response, opened-facing-3bet, cold-4bet opportunity, ordinary/cold four-bet response roles, opener facing cold 4bet, limper facing isolation, deeper unclassified aggression, and unknown. Actual semantic role stays separate from any generalized fallback calibration family.

The only current production strategy is the deterministic heuristic under `app/src/strategy/`. The v4 preflop source adds a bounded six-max BB-vs-BTN, roughly 80–120bb, 2–3bb-open cold-response policy using distinct `continueValue`, `passiveRealization`, and `aggressionSuitability`; other contexts retain explicitly generalized fallbacks. Postflop remains a source-aware generalized approximation. No validated general Hold'em reference pack exists in production.

Source identity, version/provenance, authority, exact/generalized/unsupported coverage, capabilities, and claim policy remain distinct. The heuristic has generalized comparative authority only and cannot authorize solved-GTO, Nash, exact-frequency, EV-loss, exploitability, or optimality claims.

`STRATEGY-TRUST-001` adds the accepted boundary between declaration and
authority: provider declaration -> structural/source validation ->
application-owned acceptance -> effective bounded authority -> StrategyResult
-> StrategyClaimPolicy. Reference Pack authority requires exact registered
source ID/version/content fingerprint; manifest validation status is evidence
only. Live opaque acceptance is process-local and non-persistent. Durable
Training Memory freezes answer-time authority metadata and ClaimPolicy, and
exploratory/unaccepted sources cannot create reference-comparison/remediation
states. No production Reference Pack is registered.

## 4. Training

The canonical Training generator/session/grading/presentation path generates legal deterministic trajectories and resolves the same StrategyProvider as other consumers.

The implemented `TrainingPracticePlanner` foundation includes immutable `TrainingSessionIntent v1`, `TrainingScenarioRequest v1`, serializable planner state, Varied and Focused planning, coverage/recency accounting, the 002B generator adapter, and generation sizing-family diversity. The planner owns only the structural target envelope. The canonical generator owns cards, actions, amounts, PokerState, DecisionContext, and legal trajectories; served coverage advances only after successful delivery. Sizing families are generation targets, not poker recommendations.

Varied and Focused Training are live current UI foundations; Full Hand Training uses the shared table/review path. `app/src/training-memory/` now owns versioned, owner-scoped durable encountered-decision/session evidence, frozen source/claim snapshots, indexed recent/review queries, explicit review lifecycle, and versioned similarity. `training-memory-service.mjs` integrates exact historical Same Spot and current-provider Similar Spot through the existing planner/generator. Saved remains intentional bookmarking, and advanced spaced/adaptive scheduling remains future work.

## 5. Presentation, Replay, Review, audio, and motion

`table-presentation/v1` is an immutable, DOM-free, non-persisted projection over canonical table/replay/legality facts. It supplies deliberate HU, sparse, six-max, and full-ring geometry; prominence; table projection; timeline; and decision-dock presentation without becoming PokerState or legality authority.

`hand-review/v1` derives one shared canonical Hand/Full Hand Training review from the Hero decision journal, Replay, recorded StrategyResults, and StrategyClaimPolicy. It uses explicit pre-action Replay frames, source-gated comparisons, compact provenance/limitations, and existing Analyze/Save/Repeat/Next routes. It is not a second Hand, Replay history, grader, Analysis implementation, or Saved schema.

`experience-event/v1` separates poker-world from study/application events and records origin so direct seek, hydration, initial render, and review selection do not replay historical physical consequences. `riverline-motion/v1` is a compact reduced-motion-safe intent policy over TablePresentation anchors.

`riverline-audio/v1` is the one audio authority. Physical visible poker-world actions use recorded CC0 Ogg foley as primary material; procedural Web Audio is limited to mixing/presentation and restrained study/UI feedback. The repository records fifteen provenance-documented CC0 assets, with eleven selected for coherent production use, explicit hashes/trims/windows/gain, bounded variation, caching, cooldowns, polyphony, sound-off, and graceful silence. `AUDIO-MOTION-001` is an accepted implementation checkpoint; subjective Study/UI/Check polish and unperformed Firefox acceptance remain open debt.

## 6. Analysis, ranges, and Equity

Canonical Equity remains one product service backed by the shared evaluator, supporting exact enumeration where practical and seeded Monte Carlo for larger incomplete multiway states. Heuristic conditional samples are not canonical Equity.

`HoldemWeightedRange v1` owns canonical known/unknown weights over all 1,326 Hold'em combos; the 169-cell Matrix is derived presentation. `RangeAnalysisFacts v1` reuses canonical evaluator/range facts for exact hand, draws, board structure, raw card removal, and explicitly supplied range composition. It never selects strategy, invokes Equity, infers a missing range, or claims range/nut advantage.

Personal Strategy remains a separate intended-strategy evidence authority. Calibration, deterministic inference/uncertainty, Matrix, Range Builder, Range Teacher, context transfer, and optional sync foundations are present through their automated checkpoints. Provider/reference/observed integration and independent `PERSONAL-STRATEGY-002R` review remain future work.

## 7. Saved, Home, accounts, and sync

`app/src/saved-study-objects/` owns local-first `SavedStudyObject v1`, strict Hand/Spot nested payloads, shared annotations/tags/review/mistake metadata, archive tombstones, deterministic export/import, IndexedDB repository behavior, and optional sync adaptation. Saved Hand v2 retains exact observer-safe Replay reconstruction; Saved Spot v2 remains explicitly lossy where Scenario-derived.

`HOME-002A` / My Riverline is a consumer checkpoint for Guest/account composition, Continue, Saved/Recent/Review/Mistakes, Personal Strategy facts, and sync status. It does not invent Training/Analysis history or own persistence. `HOME-002B` full Saved Study Library does not yet exist.

Account foundations include persistent opaque local identity, Guest semantics, Supabase email/password auth/profile mapping, claim/start-separate behavior, account switching/sign-out, local-first Saved Hand/Spot opt-in sync, separate Personal Strategy/Calibration opt-in sync, durable outbox/retry/tombstones/conflict foundations, and fail-closed ownership. Live Supabase migrations/RLS and two-profile Firefox lifecycle acceptance remain incomplete; no live-provider acceptance is claimed here.

## 8. Home Game Organizer

`HOME-GAME-001A` is a separate domain under `app/src/home-game/`: players/groups/sessions, exact integer minor-unit ledger, immutable transactions, append-only corrections, chip snapshots separate from money, lifecycle/reopen, exact balance rejection, deterministic settlement, account-scoped IndexedDB, and Guest runtime memory. It does not depend on PokerState, strategy, Equity, Training, Personal Strategy, or Saved Study.

Player management polish, visible correction history, session archive/delete, import/export decision, and Firefox acceptance remain for `HOME-GAME-001B`. The currently reported Create Game routing blocker is open QA; this audit does not claim the flow is usable end to end.

## 9. Verification baselines

`TRAINING-MEMORY-001` reports its focused suite green at **10/10** and the complete Node suite green at **1,844/1,844** with bounded concurrency. The first default-parallel run reached **1,843/1,844** with only the already-routed load-sensitive Range Calibration wall-clock assertion failing; no threshold was changed.

`STRATEGY-TRUST-001` reports **78/78** focused StrategySource,
StrategyResult, StrategyProvider, ClaimPolicy, Reference Pack, Training grading,
Training Memory, and persistence/clone tests green. Changed JavaScript/MJS
syntax checks and `git diff --check` passed; no full Node suite was run before
human acceptance, as required by the bounded ticket.

The current solver research baseline remains the isolated `solver/riverline_solver/` bounded HU 100bb no-rake preflop game/validation harness with public-tree, parity, exact small-fixture best-response/exploitability, and independent Kuhn validation tests. It is not solved full-game Hold'em, a production provider, a dataset, or a model. The Python solver suite is green at **26/26** for this checkpoint when `solver/` is supplied on the Python import path.

## 10. Deliberately absent and current debt

Deliberately absent:

- production ONNX/model runtime or remote strategy API;
- arbitrary solver-tree upload authority;
- synthetic legacy Training generator/grader;
- duplicate Equity worker/evaluator authority;
- renderer-owned PokerState, Replay, review, Saved, or audio semantics;
- arbitrary drag-and-drop layout editor.

Current material debt includes large `logic.js` orchestration, unperformed visual/language/live-provider acceptance, known strategy/reference limitations, advanced Training Memory scheduling/cross-surface continuity, incomplete Saved Library/Home Game follow-ups, and the stable hands-on issues in `QA_BACKLOG.md`. Historical plans and old audits do not change these facts.
