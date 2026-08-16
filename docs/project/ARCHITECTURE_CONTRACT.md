# Riverline Architecture Contract

This document is authoritative for implementation decisions unless an approved ticket explicitly supersedes it.

## 1. Dependency direction

```text
UI / renderers
      ↓
Application controllers and versioned contracts
      ↓
Poker domain and service modules
      ↓
Isolated research/data/model tooling
```

Production must not import solver experiments, training scripts, cloud tooling, notebooks, or generated datasets.

## 2. Canonical production authorities

- PokerState, Action, legality, accounting, evaluator, canonical Equity: `shared/poker-domain/`
- Scenario/Hand selection and projection: Playbook application layer
- Decision strategy entry point: `StrategyProvider v1`
- Strategy result/provenance: `StrategyResult v1`
- current heuristic implementation: `app/src/strategy/`
- Training generation/session/grading: canonical application modules
- explanation data: `AnalysisExplanation v1`
- user-owned saved hands/spots/notes/review metadata: `SavedStudyObject v1` under `app/src/saved-study-objects/`
- performance scheduling/invalidation: `product-performance/v1`
- desktop host: `app/main.js`

A consumer must not bypass these authorities to compute its own alternative answer.

Home/Dashboard, Hand/Replay, Training review, Matrix, and future Range tools are consumers of the Saved Study application/repository boundary. They must not define parallel bookmark, note, review, or saved-object persistence models. Saved Hand payloads preserve canonical observer-level PokerState facts plus a versioned canonical transition source that replays only through `shared/poker-domain`; they never persist Replay presentation frames. Saved Scenario spots remain explicitly lossy and cannot claim canonical history.

## 3. UI boundary

UI may:

- render
- format
- collect inputs
- manage interaction, focus, responsive state, accessibility, localization, and loading/errors
- invoke application/services and consume versioned results

UI must not implement:

- hand evaluation
- Equity calculation
- pot accounting
- betting legality
- strategy mathematics
- solver/model training

## 4. Scenario versus canonical Hand

Scenario:

- arbitrary, intentionally lossy study snapshot
- does not claim a legal PokerState/history
- preserves unknown facts as `null`

Hand Mode:

- legal canonical PokerState transitions only
- exact actor/legal-action/accounting facts when available

Do not merge their state or silently fall back across modes.

## 5. DecisionContext v1

Key semantics:

- `facingSizeBb`: nominal/current wager-to context
- `callAmountBb`: incremental stack-capped call amount when known
- `heroStreetContributionBb`: actor investment this street when known
- `tableSize`: seated players
- `opponentCount`: exact live opponents for canonical state; `null` in Scenario when unknown

Pot-odds or commitment math must use `callAmountBb`, not `facingSizeBb`.

Additive fields may remain in v1 only when backward-compatible and explicitly documented/tested. Breaking changes require an approved schema migration.

## 6. StrategyProvider and StrategyResult

All current strategy-consuming surfaces use:

```text
DecisionContext v1 → StrategyProvider v1 → StrategyResult v1
```

Current source vocabulary:

- `heuristic_preflop`
- `heuristic_postflop`
- `equity_fallback`
- `unavailable`

Actions use structured canonical action types; labels are presentation data. Probabilities normalize through the StrategyResult contract.

A future model/provider must enter behind this boundary with versioned metadata and validation. Do not revive retired loaders.

## 7. Equity

Canonical Equity is a separate product service. Worker and in-process execution must use the same shared implementation.

Heuristic conditional samples inside strategy are not canonical Equity and must be labelled separately.

## 8. Training

Training must:

- generate legal canonical states
- use deterministic seed/replay behavior
- call the same StrategyProvider as Playbook
- grade from StrategyResult
- avoid Training-only strategy fallbacks

Training modules do not become browser strategy authorities.

## 9. AnalysisExplanation

AnalysisExplanation consumes DecisionContext, StrategyResult, and trusted facts. Renderers must not recreate poker math or strategy.

## 10. Performance contract

Preserve PERF-001 guarantees:

- one primary strategy resolution per decision update
- coalesced rapid inputs
- no hidden 169-cell Matrix computation
- keyed Matrix reuse
- hidden surfaces use dirty/visible invalidation
- no forced-layout animation restart
- Training and Equity do not rerender inactive workspaces unnecessarily

## 11. Research isolation and legacy policy

The bounded solver remains under `solver/` and is not a production dependency.

Obsolete prototypes are removed. Do not create a new generic `legacy/` runtime. Historical documentation must be marked historical.
