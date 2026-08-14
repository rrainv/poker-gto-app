# Riverline Roadmap

This roadmap is directional, not a rigid waterfall. Insert bounded features before release when they fit architecture, budget, and product quality.

## Completed foundation

### Legacy and architecture

- repository/runtime audit
- removal of obsolete servers, entrypoints, model/ONNX paths, tree upload, legacy Training, duplicate Equity worker, and prototypes
- canonical PokerState/Action/evaluator/Equity authority
- Scenario versus Hand state separation

### Strategy integrity

- truthful call-price and actor-contribution semantics
- removal of fake EV/Equity analytical views
- one StrategyProvider and StrategyResult path
- heuristic engine extracted from `logic.js`
- preflop and postflop mathematical-integrity repairs
- calibration harness and evidence boundary
- broad tuning paused until trustworthy reference data exists

### Performance

- rAF input coalescing
- hidden-surface invalidation
- Matrix model reuse
- one primary strategy resolution per decision update
- removal of forced-layout animation restarts

## Personal Strategy checkpoint — COMPLETED and DEFERRED

Completed: `RANGE-CAL-000`, `RANGE-CAL-001A`, `RANGE-CAL-001B/001BR`, `RANGE-CAL-001C-A`, `RANGE-CAL-UI-001R`, and `RANGE-CAL-002A`. The completed foundation provides named profiles, exactly three user-named discrete modes, direct RFI calibration, truthful optional mixes/ties, pause/resume/undo, durable local storage with recovery/migration, export/import groundwork, and an isolated deterministic inference research module.

`RANGE-CAL-002A` selectively covered approximately 49.6%/60.0%/64.3% at 30/40/50 answers and reached approximately 89.5%/89.4%/91.0% attempted accuracy on synthetic holdouts. Its irregular/non-monotonic fixture remained near chance on attempted predictions; it abstains rather than filling every cell. These results are synthetic research, not real-user validation; support differences are not confidence and inferred dominant actions are not action frequencies. See `RANGE_CAL_002A_HOLDOUT_REPORT.md`.

Deferred, not canceled: `RANGE-CAL-002B`–`002D`, `RANGE-CAL-002R`, mode interpolation, StrategyProvider integration, Training-to-profile evidence, and broader Personal Strategy integration. Preserve current contracts/data and the usable Range Calibration workspace. Resume at `RANGE-CAL-002B`, without redesigning the foundation.

## Current phase: Table Presence, then Replay

1. **ACTIVE NEXT — `TABLE-PRESENCE-001A`:** a richer static canonical Hand Mode table state layer: dealer/button, player identity/stacks, current actor, folded/all-in states, street contributions/chips, central pot, completed/current action state, and a reusable table view model. Rendering consumes trusted state and never calculates poker rules, pots, contributions, legality, or replay states. No replay controls or playback animation.
2. **PLANNED — `REPLAY-001A`:** accepted Table Presence first; then a read-only current-hand action timeline grouped by street with canonical identities/actions/amounts, Hero emphasis, and current-decision marker.
3. **PLANNED LATER — `REPLAY-001B`:** deterministic previous/next projected-state step-through via the Table Presence layer.
4. **PLANNED LATER — `REPLAY-001C`:** restrained playback/motion with reduced-motion behavior and no casino/jackpot aesthetic.

Maintain EN/RU/HE, RTL, themes, desktop responsiveness, Firefox-first acceptance, the polished baseline, and one bounded ticket at a time. Scenario Mode and canonical Hand Mode remain distinct; PokerState remains the poker-rule authority.

## Product completion sequence

### Equity UX

- progress startup state
- ETA/throughput for long Monte Carlo runs
- narrow-width result readability
- preserve canonical Equity math

### Guide

- replace stale interface terminology
- document Scenario versus Hand, provenance, Training, seeds, Home/ClubGG, Matrix limits

### I18N

- runtime missing/unapplied-key diagnostics
- hardcoded dynamic copy inventory
- bounded EN/RU/HE workspace passes
- RTL and translation-length acceptance

### Responsive and mobile

- formal desktop/zoom acceptance
- 1024, 1080p, 1440p, 1600p, 4K, and 16:10
- later distinct mobile composition rather than a compressed desktop clone

## Product Lab: new UI capabilities

After the active Table Presence → Replay direction:

- safe layout presets
- card-first/config-first variants
- compact/comfortable density modes
- additional theme families
- beginner/expert presentation modes
- richer table, dealer, chips, contributions, and restrained motion
- safe persistence/reset for workspace preferences

## Feature Lab

Later priorities may be inserted flexibly:

- replay timeline with animated actions
- bookmarks/saved spots/hands/ranges
- Training filters
- mistake review and targeted re-drilling
- Range Builder
- Range Profiler / user-range inference
- session review/history/comparison
- weighted range and range-vs-range analysis
- poker math/board tools
- expert keyboard workflow

## Desktop, web, and release

Only after the product meets the chosen quality bar:

- reproducible Electron install/package layout
- proper portable/installer targets and assets
- web hosting choice
- offline/cache/service-worker decision if useful
- release documentation
- privacy/legal/product review
- optional telemetry only with explicit decision

## Solver/model return

Do not resume broad fallback tuning from intuition.

Later options:

- complete/validate bounded solver iterations
- use exact covered game as regression oracle/dataset source
- configuration-specific preflop anchors only when data supports them
- validated model behind StrategyProvider
- bounded cloud benchmark with explicit budget cap

No model is required for Riverline to become a polished useful product.
