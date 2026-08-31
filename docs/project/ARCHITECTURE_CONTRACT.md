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

- `GameRulesDefinition v1` / `GameRulesSnapshot v1`: mathematical game-rules authority under `shared/poker-domain/`; brand/operator/preset provenance never selects accounting semantics
- PokerState v1/v2, Action, legality, accounting, evaluator, canonical Equity, canonical Hold'em combos, and weighted range math: `shared/poker-domain/`
- Scenario/Hand selection and projection: Playbook application layer
- Decision strategy entry point: `StrategyProvider v1`
- Strategy result/provenance: `StrategyResult v1`
- strategy source identity/authority/coverage/capabilities: `StrategySourceDescriptor v1` and `StrategyContextCoverage v1`
- permitted strategy claims: `StrategyClaimPolicy v1`
- current heuristic implementation: `app/src/strategy/`
- Training generation/session/grading: canonical application modules
- durable encountered-decision/session learning evidence, review lifecycle, and re-drill identity: `training-decision-record/v1` / `training-session-record/v1` under `app/src/training-memory/`
- explanation data: `AnalysisExplanation v1`
- exact-hand, board-structure, blocker, and optional supplied-range facts for Analysis: `RangeAnalysisFacts v1`
- Equity workspace factual projection and exact-entered-hand next-card comparison: `equity-hand-analysis/v1` and `exact-entered-hand-outcomes/v1` under the application layer
- user-owned saved hands/spots/notes/review metadata: `SavedStudyObject v1` under `app/src/saved-study-objects/`
- Saved Hand/Spot preview facts: DOM-free `saved-study-preview-facts/v1` under the application layer; ephemeral only, never persistence or poker authority
- performance scheduling/invalidation: `product-performance/v1`
- desktop host: `app/main.js`

A consumer must not bypass these authorities to compute its own alternative answer.

Home/Dashboard, Hand/Replay, Training review, Matrix, and future Range tools are consumers of the Saved Study application/repository boundary. They must not define parallel bookmark, note, review, or saved-object persistence models. `saved-study-preview-facts/v1` is the DOM-free bounded presentation projection for currently interpreted Hand/Spot objects; it never becomes a stored Saved schema, repository query authority, PokerState reconstruction, or reopen path. Saved Hand payloads preserve canonical observer-level PokerState facts plus a versioned canonical transition source that replays only through `shared/poker-domain`; they never persist Replay presentation frames. Saved Scenario spots remain explicitly lossy and cannot claim canonical history. Unknown future kinds remain unsupported/unavailable until an approved payload interpreter exists.

New live Hands use the snapshot-authoritative `poker-state/v2` path. Versioned `playbook-scenario/v2`, `training-config/v2`, `canonical-hand-replay-source/v2`, `saved-hand-snapshot/v2`, and `saved-spot-snapshot/v2` carry or preserve the exact immutable rules snapshot where their specifications require it. Historical v1 readers remain strict and are not silently rewritten. See `GAME_RULES_V1_SPEC.md` and `SAVED_STUDY_OBJECTS_SPEC.md`.

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

## 4.1 Game Rules and PokerState

`GameRulesDefinition v1` and self-contained `GameRulesSnapshot v1` own mathematical game mechanics. Preset IDs, display names, operator/brand provenance, and legacy compatibility labels cannot choose deductions, antes, blinds, collection, or accounting behavior.

`PokerState v2` consumes a validated copied snapshot and projects resolved brand-free game mechanics into canonical transitions. Unsupported mechanics fail explicitly. `PokerState v1` remains a historical compatibility reader, not the initialization path for new live Hands.

## 5. DecisionContext v1 / additive v1.1 contract

Key semantics:

- `facingSizeBb`: nominal/current wager-to context
- `callAmountBb`: incremental stack-capped call amount when known
- `heroStreetContributionBb`: actor investment this street when known
- `tableSize`: seated players
- `opponentCount`: exact live opponents for canonical state; `null` in Scenario when unknown

Extended contexts retain `schemaVersion: decision-context/v1` and add
`contractVersion: decision-context/v1.1`. They expose an unclamped exact
`currentPotBb`, explicit starting/live and
bounded per-opponent effective stacks, postflop `in_position` /
`out_of_position` / `mixed` relation, canonical legal aggressive-to bounds,
bounded semantic prior-action facts, and compact derivation provenance. Scenario
keeps facts unavailable when it lacks canonical seat, stack, legality, price, or
history evidence. Existing providers remain valid and may ignore additive fields.

The bounded history includes additive preflop-role facts for Hero's prior
voluntary action, initial/latest aggressor identity, distinct aggressor count,
and cold-action semantics. These facts come only from canonical Hand history;
lossy Scenario inputs must not infer them from a broad prior-action label.

See `DECISION_CONTEXT_SPEC.md` for precise field and evidence semantics.

Pot-odds or commitment math must use `callAmountBb`, not `facingSizeBb`.
Current-pot/SPR logic must use `currentPotBb`, not compatibility `potBb`.
Live-stack logic must use `heroStackBb` and the appropriate effective-stack
fact, not compatibility `stackBb`.

Those v1.1 facts do not yet constitute a complete actor-relative decision-economics contract. `DECISION-ECONOMICS-001` owns exact contestable-pot pricing, contribution, and effective-stack semantics for whichever actor is deciding, while `shared/poker-domain` remains the only accounting authority. `DECISION-CONTEXT-SINGLE-AUTHORITY-001` owns removal of the classic `logic.js` constructor and any fail-open bridge path; until it closes, documentation must not claim every production consumer already uses one projector.

Additive fields may remain in v1 only when backward-compatible and explicitly documented/tested. Breaking changes require an approved schema migration.

## 6. StrategyProvider and StrategyResult

The required production dependency is:

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

All consumers must obtain user-facing claim semantics from `StrategyClaimPolicy v1`. They must not infer correctness, optimality, exactness, EV loss, normative grading, skill, accuracy, mastery, or GTO from a source ID, family, solver/model branding, probability distribution, agreement, disagreement, or confidence number. The current heuristic is exploratory/comparative baseline evidence only, and its disagreement alone must not create remediation. See `STRATEGY_SOURCE_AUTHORITY_SPEC.md`.

`reference-pack/v1` is the accepted declarative bounded-provider foundation.
It validates source/licensing facts, complete data, capabilities, integrity, and
exact assumptions before registration; its v1 matcher requires canonical
DecisionContext v1.1 history and exact Game Rules, positions, stack, tree,
price, and legality. A match emits a normal StrategyResult; a mismatch invokes
the separately labelled existing fallback without blending. No production pack
is currently registered because no production-safe source has been accepted.
See `REFERENCE_PACK_V1_SPEC.md`.

Any future model/reference provider must enter behind this boundary with a versioned descriptor, explicit context matcher, declared capabilities, and validation-backed authority. Descriptor fields and automated validation do not self-authorize production trust: `STRATEGY-TRUST-001` must define and satisfy the human acceptance, evidence, licensing, registration, and revocation gate. Exact bounded coverage must not extrapolate. Do not revive retired loaders.

## 7. Equity

Canonical Equity is a separate product service. Worker and in-process execution must use the same shared implementation.

Heuristic conditional samples inside strategy are not canonical Equity and must be labelled separately.

`equity-hand-analysis/v1` is an immutable application projection over canonical evaluator results plus `RangeAnalysisFacts v1`. Its `exact-entered-hand-outcomes/v1` facts compare every entered exact hand against every legal next card and keep current standing, strict-ahead cards, tie cards, and structural improvements that still leave the player behind as separate outcome families. It is unavailable when an opponent is unknown. A structural completion is not a clean out, guaranteed winner, or Equity claim, and UI renderers may not collapse it into a card that puts the player ahead.

## 8. Hold'em range core

`shared/poker-domain/holdem-combos.js` is the one production authority for the 52-card deck's 1,326 unordered Hold'em hole-card combos and their mapping to the existing 169 hand classes. `shared/poker-domain/holdem-range.js` owns `HoldemWeightedRange v1`, explicit known-versus-unknown combo weights, combo mass, provenance, blocker conditioning, complete-range normalization, deterministic serialization, and DOM-free Matrix projection.

Combo-level truth is canonical; a 13x13 Matrix is a derived presentation. UI, Personal Strategy storage, heuristic candidate ranges, Equity, and solver research must not create a second production weighted-range contract. Current `equity-request/v1` has no weighted-opponent shape, so range-to-Equity integration requires a separately approved versioned boundary.

See `RANGE_CORE_SPEC.md`.

## 9. Training

Training must:

- generate legal canonical states
- use deterministic seed/replay behavior
- call the same StrategyProvider as Playbook
- preserve comparison evidence from StrategyResult
- interpret internal grades through StrategyClaimPolicy for public wording and statistics
- avoid Training-only strategy fallbacks

Comparative baseline practice and normative grading are separate contracts. Probability gap to the modal action is not an accepted normative correctness rule. Normative grading requires an accepted trusted source, exact-enough coverage, an explicit normative capability, and a grading method justified by that source; `TRAINING-NORMATIVE-001` owns the change. Heuristic agreement/disagreement must never become skill, accuracy, mastery, correctness, GTO, or automatic remediation.

Training modules do not become browser strategy authorities.

`TrainingPracticePlanner`, `TrainingSessionIntent v1`, and `TrainingScenarioRequest v1` own structural curriculum/target planning only. They select a target envelope, including generation sizing families where applicable, but never construct cards, actions, bets, pots, PokerState, DecisionContext, StrategyResult, or grades. Sizing families are generation targets, not recommendations. The canonical Training generator remains the only legal-trajectory authority and advances planner coverage only after an exercise is successfully served. See `TRAINING_PRACTICE_PLANNER_SPEC.md`.

`training-decision-record/v1` and `training-session-record/v1` are the durable Training Memory authority for what an owner was shown and answered. They preserve canonical reproduction identity plus the frozen StrategyResult/StrategyClaimPolicy at answer time; they do not re-grade history with today's provider. Review reasons, summaries, priority, and `training-similarity/v1` are deterministic projections. Exact Same Spot uses frozen historical comparison; Similar Spot must route a versioned envelope through the Practice Planner and canonical generator and is labelled current. SavedStudyObject remains intentional bookmarking, while Training Memory remains encountered-decision evidence. Full Hand stores one session-level replay source with per-decision replay references. Current owner-indexed storage is not proof of authentication isolation: `AUTH-TRAINING-MEMORY-001` must route every read/write through validated session scope and make authenticated-owner data inaccessible on sign-out. See `TRAINING_MEMORY_V1_SPEC.md`.

## 10. AnalysisExplanation

AnalysisExplanation consumes DecisionContext, StrategyResult, StrategyClaimPolicy facts, and trusted facts. It may explain structured authority/limitations but must not invent source semantics. Renderers must not recreate poker math, strategy, or claim policy.

Range-aware Analysis follows this dependency direction:

```text
trusted cards / DecisionContext / optional HoldemWeightedRange v1
                              -> RangeAnalysisFacts v1
                              -> AnalysisExplanation v1
                              -> renderer
```

`RangeAnalysisFacts v1` reuses the canonical evaluator and range core. It may classify exact hands, draws, board structure, raw exact-card removal, and the conditioned composition of explicitly supplied ranges. It must not select actions, call StrategyProvider or Equity, infer a missing range, claim range/nut advantage, or label a blocker as strategically good or bad. `range-comparison-facts/v1` is the DOM-free representative-class comparison projection: it consumes canonical Range Core card-removal output, delegates category/draw facts to `RangeAnalysisFacts v1`, preserves fully removed versus not-in-sample truth, and supplies independent Hero/opponent shares on one shared 0–100% scale. One canonical surviving representative per eligible sampled class does not characterize every combo in that class. Renderers consume these structured facts only. `AnalysisExplanation v1` consumes trusted facts; it does not recompute them. See `ANALYSIS_RANGE_SPEC.md`.

### 10.1 Natural-language projection boundary

Natural-language consumers are presentation and synthesis only. They never become poker, legality, accounting, strategy, Equity, range, opponent-model, Personal Strategy, or Training-grading authority.

The permitted direction is:

```text
canonical state and evidence
        -> approved structured factual analysis
        -> role-separated reference / Personal / observed / opponent evidence
        -> provenance and uncertainty
        -> structured explanation model
        -> user-facing facts, explanation, or synthesis
```

There is no permitted `cards -> language model guesses poker -> plausible advice` path. Missing or unsupported evidence remains unknown or unavailable. A language model or other narrative component may summarize only the approved structured facts and claims supplied to it, and its output must retain the relevant evidence roles, source/version identity, and uncertainty.

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

## 11.1 Presentation and experience contracts

- `table-presentation/v1` is a pure ephemeral table geometry/hierarchy/projection over canonical state, Replay, legality, and surface context.
- `hand-review/v1` is a pure ephemeral selected-decision/review projection over the canonical Hero journal, Replay, StrategyResult, and StrategyClaimPolicy.
- `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` translate completed canonical transitions or explicit study actions into presentation consequences.

These contracts may format, project, animate, or sound already-established facts. They never become poker state, Game Rules, legality, accounting, strategy, grading, Replay history, Saved, or persistence authority. Direct seek, hydration, initial render, and review selection must not recreate historical poker-world consequences. See `TABLE_PRESENCE_COMPETITIVE_REFERENCE.md` and `AUDIO_MOTION_001_SPEC.md`.

## 12. Research isolation and legacy policy

The bounded solver remains under `solver/` and is not a production dependency.

Obsolete prototypes are removed. Do not create a new generic `legacy/` runtime. Historical documentation must be marked historical.
