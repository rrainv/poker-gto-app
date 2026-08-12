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

## Current phase: Product UI repair

Reported status at this refresh:

- `PRODUCT-UI-001` complete
- `PRODUCT-UI-002R` implemented, pending manual visual acceptance and commit

Next:

1. `PRODUCT-UI-003` — shared Playbook/Training analysis presentation
2. `PRODUCT-UI-004` — card geometry, themes, and micro-polish
3. `PRODUCT-UI-005` — workspace composition and responsive fit
4. fresh live UI QA checkpoint

Issue ownership lives in `QA_BACKLOG.md`.

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

After the repair baseline is stable:

- safe layout presets
- card-first/config-first variants
- compact/comfortable density modes
- additional theme families
- beginner/expert presentation modes
- richer table, dealer, chips, contributions, and restrained motion
- safe persistence/reset for workspace preferences

## Feature Lab

Priorities may be inserted flexibly:

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
