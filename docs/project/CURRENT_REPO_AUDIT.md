# Current Repository Audit

Snapshot refreshed August 13, 2026 from the architecture-focused repository dump and accepted ticket reports. Verify against executable code, tests, and Git history.

## 1. Browser runtime

Production loads one browser application from `app/index.html`.

Major paths:

- Playbook Scenario and canonical Hand state controllers
- DecisionContext v1 projection
- one StrategyProvider / StrategyResult authority
- deterministic heuristic strategy under `app/src/strategy/`
- AnalysisExplanation v1
- canonical Equity controller/worker backed by `shared/poker-domain`
- canonical Training generator/session/grading/presentation
- product-performance scheduling and hidden-surface invalidation
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

## 5. Training

Training uses legal canonical trajectories, deterministic seeds, replay metadata, one StrategyProvider, and one grading path. Session persistence, mistake review, adaptive curriculum, and range profiling remain future features.

## 6. Analysis and UI

AnalysisExplanation is structurally clean, but its visual presentation is the next major Product UI target.

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
