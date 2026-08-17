# Current Repository Audit

Snapshot refreshed August 16, 2026 from the architecture-focused repository dump and accepted ticket reports. Verify against executable code, tests, and Git history.

## 1. Browser runtime

Production loads one browser application from `app/index.html`.

Major paths:

- Playbook Scenario and canonical Hand state controllers
- DecisionContext v1 projection
- one StrategyProvider / StrategyResult authority
- deterministic heuristic strategy under `app/src/strategy/`
- AnalysisExplanation v1
- canonical Equity controller/worker backed by `shared/poker-domain`
- canonical 52-card / 1,326-combo Hold'em registry and immutable weighted/partial range foundation under `shared/poker-domain`; Analysis can condition an explicitly attached range, but no current production decision source attaches one
- canonical Training generator/session/grading/presentation
- product-performance scheduling and hidden-surface invalidation
- lazy local-first SavedStudyObject v1 domain/repository for saved Hands, Spots, annotations, review state, and portable export/import; Saved Hands include an exact observer-safe canonical event source for cold deterministic Replay reconstruction
- classic UI/application orchestration in `app/src/core/logic.js`

## 2. Desktop

`app/main.js` is a thin Electron BrowserWindow host. No preload, IPC strategy, ONNX, model, or second poker implementation remains.

Packaging layout/version reproducibility still requires a later Desktop ticket.

## 3. Strategy

The deterministic heuristic fallback is the only current production strategy source. Playbook, Training, and preflop Matrix consume it through the same provider.

Preflop/postflop mathematical-integrity work is complete. A calibration harness exists, but the repository has no validated general Hold'em strategy reference. Further broad tuning is paused pending reference data.

Postflop Matrix remains unavailable rather than using a second fast heuristic.

## 4. Equity

Canonical Equity is singular at product-service level and supports exact enumeration or seeded Monte Carlo, 2–10 players, unknown hands, dead cards, progress, and cancellation.

A separate legacy evaluator remains in `logic.js` only for the current Outs display. It is not canonical Equity and is an extraction/migration candidate if Outs is redesigned.

## 4.1 Hold'em range core

`shared/poker-domain/holdem-combos.js` is the production authority for all 1,326 unordered Hold'em hole-card combos and their exact mapping to the canonical 169 hand classes. `shared/poker-domain/holdem-range.js` defines `HoldemWeightedRange v1`, explicit known/unknown combo entries, provenance, combo mass, blocker conditioning, complete positive-mass normalization, deterministic portability, and a DOM-free 169-cell projection.

The current production Matrix, fixed Range Comparison samples, Personal Strategy action evidence, postflop heuristic candidate subset, and isolated solver combo utilities retain their existing bounded meanings; none is a second canonical weighted-range format. `equity-request/v1` cannot express weighted opponents, so no lossy adapter or Equity behavior change was introduced.

## 4.2 Range-aware Analysis

`app/src/application/range-analysis.mjs` owns immutable `RangeAnalysisRequest v1` and `RangeAnalysisFacts v1`. It reuses the canonical evaluator and `HoldemWeightedRange v1` to derive exact-hand and draw structure, board structure, raw Hero-card removal, and conditioned composition for any explicitly supplied named range. Partial ranges stay partial and are never normalized into invented whole-range shares. Provenance for strategy, cards, board, and each range remains separate.

The Playbook Analysis render seam computes these facts only while Analysis is requested. The explanation layer consumes them and the presentation layer only localizes/formats them. Current production callers attach no range, so the UI truthfully shows structural blockers and an unavailable supplied-range state; Matrix representatives and heuristic strategy samples are not promoted into range truth.

## 5. Training

Training uses legal canonical trajectories, deterministic seeds, replay metadata, one StrategyProvider, and one grading path. Session persistence, mistake review, adaptive curriculum, and range profiling remain future features.

## 5.1 Saved Study Objects

`app/src/saved-study-objects/` is the canonical user-owned Saved / Noted Study Object authority. V1 supports strict Hand and Spot snapshots, shared title/note/tag/review/mistake metadata, local ownership, archive tombstones, Dashboard-ready queries, and deterministic portable export/import behind native IndexedDB. Hand snapshots retain observer-level PokerState privacy markers; Scenario spots remain lossy and contain no invented history. No current renderer or Dashboard UI consumes the foundation yet.

## 6. Analysis and UI

AnalysisExplanation consumes canonical range-analysis facts and presents compact Hand & Board, Blockers, Supplied Range, and fact-source sections. Structural and localization tests are complete; final human viewport/theme/language acceptance remains tracked in `QA_BACKLOG.md`.

PERF-001 removed duplicate slider updates, hidden Matrix computation, unnecessary theme recomputation, duplicate Training init, duplicate Equity readiness, and forced layout reads.

Product UI repair is active. `QA_BACKLOG.md` is the authoritative issue/status map.

## 7. Deliberately absent

- browser/Electron ONNX strategy runtime
- model artifacts and loaders
- remote strategy API
- uploaded solver-tree authority
- root legacy Training/model/tree prototypes
- duplicate Equity worker
- arbitrary drag-and-drop layout editor

## 8. Research

The bounded HU 100bb no-rake preflop solver is isolated under `solver/riverline_solver/`. It is useful infrastructure, not current production strategy and not a universal calibration source.

## 9. Current debt

- `logic.js` remains a large classic orchestration/rendering file
- many user-facing strings still bypass i18n
- Guide copy is stale
- workspace composition and responsive acceptance remain incomplete
- settings/theme catalog includes legacy/experimental presentation debt
- hidden DOM was remeasured by PERF-RL18: cold Decision is 1,423 elements/91 buttons; a warmed Decision retaining Matrix and Range caches is 2,575/598, and the 52-button picker deck now detaches on close
- Electron clean install/package flow needs a later repair

## 10. Documentation rule

Current contracts, code, tests, and accepted ticket reports override historical DeepCFR/model/ONNX documents. Claims require executable evidence.
