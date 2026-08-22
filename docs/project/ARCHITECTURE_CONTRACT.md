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

- PokerState, Action, legality, accounting, evaluator, canonical Equity, canonical Hold'em combos, and weighted range math: `shared/poker-domain/`
- Scenario/Hand selection and projection: Playbook application layer
- Decision strategy entry point: `StrategyProvider v1`
- Strategy result/provenance: `StrategyResult v1`
- strategy source identity/authority/coverage/capabilities: `StrategySourceDescriptor v1` and `StrategyContextCoverage v1`
- permitted strategy claims: `StrategyClaimPolicy v1`
- current heuristic implementation: `app/src/strategy/`
- Training generation/session/grading: canonical application modules
- explanation data: `AnalysisExplanation v1`
- exact-hand, board-structure, blocker, and optional supplied-range facts for Analysis: `RangeAnalysisFacts v1`
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

`StrategyResult v1` additively carries a source descriptor, source version, provenance, context coverage, and capabilities. Source identity, provenance, authority, coverage, capabilities, and claim policy are distinct facts. Legacy numeric confidence/coverage metadata grants no authority.

All consumers must obtain user-facing claim semantics from `StrategyClaimPolicy v1`. They must not infer correctness, optimality, exactness, EV loss, or normative grading from a source ID, family, solver/model branding, probability distribution, or confidence number. The current heuristic has generalized comparative authority only. See `STRATEGY_SOURCE_AUTHORITY_SPEC.md`.

A future model/reference provider must enter behind this boundary with a versioned descriptor, explicit context matcher, declared capabilities, and validation-backed authority. Exact bounded coverage must not extrapolate. Do not revive retired loaders.

## 7. Equity

Canonical Equity is a separate product service. Worker and in-process execution must use the same shared implementation.

Heuristic conditional samples inside strategy are not canonical Equity and must be labelled separately.

## 8. Hold'em range core

`shared/poker-domain/holdem-combos.js` is the one production authority for the 52-card deck's 1,326 unordered Hold'em hole-card combos and their mapping to the existing 169 hand classes. `shared/poker-domain/holdem-range.js` owns `HoldemWeightedRange v1`, explicit known-versus-unknown combo weights, combo mass, provenance, blocker conditioning, complete-range normalization, deterministic serialization, and DOM-free Matrix projection.

Combo-level truth is canonical; a 13x13 Matrix is a derived presentation. UI, Personal Strategy storage, heuristic candidate ranges, Equity, and solver research must not create a second production weighted-range contract. Current `equity-request/v1` has no weighted-opponent shape, so range-to-Equity integration requires a separately approved versioned boundary.

See `RANGE_CORE_SPEC.md`.

## 9. Training

Training must:

- generate legal canonical states
- use deterministic seed/replay behavior
- call the same StrategyProvider as Playbook
- grade from StrategyResult
- interpret internal grades through StrategyClaimPolicy for public wording and statistics
- avoid Training-only strategy fallbacks

Training modules do not become browser strategy authorities.

## 10. AnalysisExplanation

AnalysisExplanation consumes DecisionContext, StrategyResult, StrategyClaimPolicy facts, and trusted facts. It may explain structured authority/limitations but must not invent source semantics. Renderers must not recreate poker math, strategy, or claim policy.

Range-aware Analysis follows this dependency direction:

```text
trusted cards / DecisionContext / optional HoldemWeightedRange v1
                              -> RangeAnalysisFacts v1
                              -> AnalysisExplanation v1
                              -> renderer
```

`RangeAnalysisFacts v1` reuses the canonical evaluator and range core. It may classify exact hands, draws, board structure, raw exact-card removal, and the conditioned composition of explicitly supplied ranges. It must not select actions, call StrategyProvider or Equity, infer a missing range, claim range/nut advantage, or label a blocker as strategically good or bad. `AnalysisExplanation v1` consumes these facts; it does not recompute them. See `ANALYSIS_RANGE_SPEC.md`.

## 11. Performance contract

Preserve PERF-001 guarantees:

- one primary strategy resolution per decision update
- coalesced rapid inputs
- no hidden 169-cell Matrix computation
- keyed Matrix reuse
- hidden surfaces use dirty/visible invalidation
- no forced-layout animation restart
- Training and Equity do not rerender inactive workspaces unnecessarily
- range analysis runs only for a visible/requested Analysis surface and never causes an additional StrategyProvider or Equity invocation

## 12. Research isolation and legacy policy

The bounded solver remains under `solver/` and is not a production dependency.

Obsolete prototypes are removed. Do not create a new generic `legacy/` runtime. Historical documentation must be marked historical.
