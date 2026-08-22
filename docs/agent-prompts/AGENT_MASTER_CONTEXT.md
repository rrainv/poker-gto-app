# Agent Master Context

## Product

Riverline is a browser-first Texas Hold'em analysis and training application for personal use, friends, and a possible future public release.

Primary workspaces:

- Playbook Scenario Analysis
- Playbook canonical Hand Mode
- Equity / win probability
- Training
- Guide and Settings
- multiway analysis where supported
- thin Electron desktop host

The product should feel like a coherent analytical workstation, not a research demo or casino game.

## Current runtime map

```text
app/index.html
├─ classic UI/application orchestration: app/src/core/logic.js
├─ Playbook mode/state controllers
├─ StrategyProvider v1
│  └─ deterministic heuristic strategy modules under app/src/strategy/
├─ AnalysisExplanation v1
├─ canonical Equity controller + worker
│  └─ shared/poker-domain Equity/evaluator
├─ canonical Training generator/session/grading/presentation
│  └─ same StrategyProvider
├─ TableRenderer / SoundFX / i18n
└─ product-performance scheduling and invalidation
```

Electron:

```text
app/main.js → BrowserWindow → app/index.html
```

The Electron process has no inference, model, IPC strategy, or second poker implementation.

## Canonical authorities

- `shared/poker-domain/`: cards, PokerState, actions, legality, accounting, evaluator, canonical Equity
- `DecisionContext v1`: application strategy snapshot
- `StrategyProvider v1`: sole application strategy entry point
- `StrategyResult v1`: canonical strategy result/provenance contract
- `StrategySourceDescriptor v1` / `StrategyContextCoverage v1`: source identity, authority, capabilities, and per-decision coverage
- `StrategyClaimPolicy v1`: sole authority for comparative, normative, exactness, sizing, EV, and limitation claims
- `app/src/strategy/`: current deterministic heuristic implementation
- canonical Training modules: legal generated states, seeded replay, grading
- `AnalysisExplanation v1`: structured explanatory facts; UI renders but does not recompute strategy or poker math
- `product-performance/v1`: interaction scheduling and hidden-surface invalidation
- `solver/riverline_solver/`: bounded research only, never production runtime

## DecisionContext facts

- `facingSizeBb`: nominal/current wager-to context, not call price
- `callAmountBb`: actor's incremental stack-capped call amount when known
- `heroStreetContributionBb`: current-street investment when known
- `opponentCount`: exact live opponents for canonical state; `null` for lossy Scenario state
- `tableSize`: seated players; do not reinterpret as live opponents

## Strategy truth

Current production sources:

- `heuristic_preflop`
- `heuristic_postflop`
- `equity_fallback`
- `unavailable`

There is no trusted production model and no validated Hold'em strategy reference in the repository. The bounded solver currently serves as isolated infrastructure and a future exact-game oracle/dataset source once it produces validated converged strategies.

Do not tune heuristic frequencies from intuition. The calibration baseline concluded that broad further tuning should wait for trustworthy reference data.

The current heuristic has generalized comparative authority. It may support scoped recommendation, strategy presentation, Matrix frequencies, and comparison, but not objective correctness, optimality, exact-frequency, EV-loss, or normative curriculum claims. Future reference/model/personal sources must provide descriptors and context coverage; consumers must not branch on provider IDs. See `docs/project/STRATEGY_SOURCE_AUTHORITY_SPEC.md`.

## Equity truth

Canonical Equity is separate from strategy sampling:

- exact enumeration when practical
- seeded Monte Carlo for larger spaces
- 2–10 players
- unknown hands and dead cards
- cancellation/progress support

A postflop heuristic conditional sample is not canonical Equity.

## Training truth

Training:

- generates legal canonical trajectories
- uses deterministic seeds and replay metadata
- resolves strategy through the same StrategyProvider as Playbook and Matrix
- grades action families by StrategyResult probabilities
- does not prove exact EV loss or GTO correctness

## Deliberately retired

Do not revive without a new approved architecture:

- browser or Electron ONNX strategy runtime
- native preload inference bridge
- remote strategy API
- arbitrary solver-tree upload
- root legacy `training/`, `solver-model/`, or checked-in tree data
- synthetic Training generator/grader
- duplicate Equity worker/evaluator authority
- arbitrary drag-and-drop layout editor

## Current development direction

The project is in the Product UI repair/polish era. Strategy-integrity, authority, extraction, mathematical-integrity, calibration-baseline, and initial performance phases are complete.

Read `../project/CURRENT_PHASE.md`, `../project/QA_BACKLOG.md`, and `../project/ROADMAP.md` for the active ticket and next work.

## Budget and deployment

- Project budget for optional compute/services is approximately US$75 total unless the user explicitly changes it.
- No cloud run, paid service, or deployment spend starts without explicit approval and a cap.
- Public release is later. Product quality comes before deployment work.
