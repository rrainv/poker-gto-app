# Canonical Weighted Hold'em Range Foundation

Status: implementation authority for `RANGE-CORE-001`

Schema generation: v1

## 1. Purpose and authority

`shared/poker-domain/holdem-combos.js` and `shared/poker-domain/holdem-range.js` are Riverline's canonical combo-level Texas Hold'em range authority.

The dependency direction is:

```text
canonical Card IDs + canonical 169 hand classes
                    |
                    v
     1,326 canonical unordered combos
                    |
                    v
         HoldemWeightedRange v1
                    |
                    v
 blocker views / normalized distributions / Matrix projections
                    |
                    v
       future application and UI consumers
```

The 13x13 Matrix is a derived presentation. It is not range storage or mathematical truth. The range core is DOM-free, source-agnostic, immutable, JSON-compatible, and independent of StrategyProvider, Equity, Personal Strategy persistence, Saved Study Objects, and solver research.

`RANGE-CORE-001` is domain-only. It changes no current user-facing workspace and requires no tutorial content. The first future visible Analysis or Range Builder integration owns the corresponding tutorial update.

## 2. Existing representations and their boundaries

The implementation audit found these existing representations:

- `shared/poker-domain/cards.js`: canonical two-character Card syntax and duplicate-card validation. Reused directly.
- `shared/poker-domain/hand-class.js`: canonical 169-class vocabulary and 13x13 ordering. Reused directly.
- production Matrix in `app/src/core/logic.js`: resolves one representative unblocked combo per class through StrategyProvider. It remains presentation logic and is not a range authority.
- Range Comparison in `app/src/core/logic.js`: fixed, approximate, unweighted hand-class `Set` samples evaluated through one representative available combo. It remains explicitly heuristic and is not migrated by this ticket.
- Personal Strategy `RangeObservation v1`: durable direct action evidence keyed by one hand class. It is evidence, not a combo-weighted range and not automatically convertible to one.
- `app/src/personal-strategy/rfi-inference.mjs`: isolated hand-class dominant-action inference. It is not range weight, is not live, and remains outside the new production authority.
- postflop heuristic candidate ranges: private uniform subsets of currently unblocked combos used only by the heuristic fallback. They are not canonical Equity or persisted range truth.
- `equity-request/v1`: accepts known two-card hands or `null`, where `null` means uniform unknown physical cards. It cannot express weighted opponent combos.
- solver `hu_preflop/cards.py`: isolated research combo utilities. Production must not import solver code.
- `AnalysisExplanation v1`: consumes trusted facts and current strategy output; it owns no range representation.
- `SavedStudyObject v1`: no `range` payload exists yet, by design.

Those representations are not silently translated or migrated in this ticket.

## 3. Canonical Card and combo identity

The canonical deck is 52 structural Card IDs from the existing Card vocabulary.

Persistence-relevant order is:

1. ranks `2` through `A`, using `CARD_RANKS`;
2. within each rank, suits `s`, `h`, `d`, `c`, using `CARD_SUITS`.

Unordered two-card combinations are enumerated lexicographically by those deck indexes. The registry therefore contains exactly `C(52, 2) = 1,326` frozen combos.

Combo schema: `holdem-hole-card-combo/v1`

Combo ID form:

```text
holdem-combo/v1:<lower-deck-index-card>:<higher-deck-index-card>
```

Example:

```text
holdem-combo/v1:Kh:Ah
```

The ID is derived from two canonical structural Card IDs. It is not a localized or display-only hand label. Reversing input cards resolves the same registry object and ID. A combo cannot contain the same physical card twice.

## 4. Relationship to the canonical 169 classes

Every canonical combo maps through `preflopHandClassForCards` to exactly one existing class:

- 13 pair classes with 6 physical combos each;
- 78 suited non-pair classes with 4 combos each;
- 78 offsuit non-pair classes with 12 combos each.

The exhaustive total is:

```text
13 * 6 + 78 * 4 + 78 * 12 = 1,326
```

No second class-label convention is introduced.

## 5. HoldemWeightedRange v1

Schema: `holdem-weighted-range/v1`

Game discriminator: `holdem`

The persisted domain value contains:

```text
schemaVersion
game
rangeId                  string or null
provenance
  schemaVersion          holdem-range-provenance/v1
  sources[]
entries[1326]            exact canonical combo order
```

Every combo appears exactly once. This fixed, deterministic coverage prevents a missing entry from acquiring accidental zero semantics.

A known entry is:

```text
comboId
state = known
weight in [0, 1]
provenanceId             source reference or null
```

An unresolved entry is:

```text
comboId
state = unknown
provenanceId             source reference or null
```

An unknown entry must not contain `weight`.

## 6. Weight semantics

A combo weight is source-agnostic inclusion mass:

- `0`: known excluded;
- `1`: known fully included;
- between `0` and `1`: included at that asserted frequency/weight.

It is not automatically:

- the probability that Hero holds the combo;
- an action probability;
- strategy frequency;
- confidence;
- trust;
- Equity.

Range combo mass is the sum of known combo weights. It is not divided by 1,326 and is not a normalized probability.

Examples:

- `AA` at 1 contributes mass 6;
- `AKs` at 0.5 contributes mass 2;
- `AKo` at 0.25 contributes mass 3.

## 7. Unknown is not zero

`known, weight = 0` is an assertion that a combo is excluded. `unknown` means no weight has been asserted.

Inspection schema `holdem-range-inspection/v1` derives:

- total, known, unknown, known-zero, and positive-weight combo counts;
- coverage ratio;
- total known combo mass;
- complete or partial state;
- fully unknown state;
- empty-but-complete state.

Coverage is not confidence. Unknown entries never contribute an implicit zero to combo mass, normalization, or Matrix aggregates.

## 8. Construction and revision helpers

The domain provides safe constructors for:

- an empty complete range: all 1,326 combos known at zero;
- a fully unknown range: all 1,326 combos unresolved;
- sparse or complete canonical combo entries;
- 169-class weights expanded across physical combos;
- immutable combo-specific overrides.

Unlisted class or combo input defaults to `unknown`. A caller that means zero must explicitly select the `known_zero` policy. There is no poker notation parser in v1.

## 9. Provenance

Provenance schema: `holdem-range-provenance/v1`

Sources have stable range-local IDs and an extensible lowercase `kind`. Recommended kinds include:

- `manual`;
- `imported`;
- `personal_direct`;
- `personal_inferred`;
- `strategy_provider`;
- `solver_reference`;
- `derived_filter`;
- `external`.

A source can identify its upstream object/schema, canonical creation timestamp, parent range, and derivation operation. Each combo entry can reference a different source. This is the minimum needed to distinguish direct, inferred, manual/imported, and unresolved facts without a speculative evidence graph.

Provenance is not trust, confidence, action frequency, or Equity. The v1 provenance record has no universal confidence field. Source-specific uncertainty requires a future explicit contract.

## 10. Blocker conditioning

Conditioning schema: `holdem-conditioned-range/v1`

Input is a validated range and zero or more canonical known/dead cards. Duplicate or invalid blockers fail closed. Blockers are canonicalized to deck order.

Output contains:

- eligible source entries;
- blocked source entries;
- retained entry states and provenance references;
- retained range provenance;
- `derived_filter` / `blocker_conditioning` provenance;
- exact before/after counts, coverage, and known combo mass.

A combo is blocked if either physical card appears among the blockers. Conditioning never mutates the source range and never rewrites a blocked unknown combo to known zero.

For any one blocker, exactly 51 of the 1,326 combos are blocked.

## 11. Normalized distribution

Distribution schema: `holdem-combo-distribution/v1`

For a complete range with positive eligible combo mass:

```text
P(combo | range, blockers) = comboWeight / totalEligibleWeight
```

This probability is derived and is never persisted as range truth. Zero-weight eligible combos remain in the distribution with zero probability.

Normalization rejects:

- every partial source range;
- zero eligible mass;
- duplicate or invalid blockers.

V1 deliberately supplies no policy that fills unknown values.

## 12. Matrix projection

Projection schema: `holdem-range-matrix-projection/v1`

The DOM-free projection emits all 169 canonical cells in row-major Matrix order. Each cell includes:

- class, kind, row, and column;
- physical combo count;
- known and unknown counts;
- known coverage fraction;
- total known combo mass;
- explicitly derived average known weight;
- a derived uniform weight only when every combo is known and equal;
- complete/partial state;
- intra-class variation flag;
- all exact combo entries.

The exact combo entries remain present, so a derived average cannot erase combo-specific deviations. Composition summaries separately aggregate pair, suited, and offsuit structural facts.

The current production Matrix is not migrated by this ticket.

## 13. Personal Strategy boundary

The range core can represent future Personal Strategy outputs with per-combo `personal_direct` and `personal_inferred` provenance while leaving unanswered combos unknown.

Current `RangeObservation v1` semantics remain authoritative:

- a dominant-only answer is a preferred action assertion, not a pure action frequency;
- an explicit mix contains actual action probabilities;
- tied mixes have no fabricated dominant action.

Therefore no live adapter converts dominant-only Fold/Raise observations to range weights. An approved future application adapter may derive an action-conditioned range only when its evidence supplies the required quantitative semantics. `RANGE-CAL-002A` remains unexported, unpersisted, and unused by production.

## 14. StrategyResult action-conditioning boundary

Range inclusion weight and per-action strategy frequency are different values.

A future combo-aware provider may derive unnormalized action-conditioned mass as:

```text
priorRangeWeight(combo)
  * strategyFrequency(action | combo)
  = unnormalizedActionConditionedComboMass(combo)
```

The result may then be normalized only under the complete-range rules above. `RANGE-CORE-001` does not implement this operation because current StrategyResult resolves one concrete combo at a time and StrategyProvider semantics are unchanged.

## 15. Equity boundary

Canonical `equity-request/v1` represents an opponent as either:

- one exact known two-card hand; or
- `cards = null`, sampled uniformly from remaining physical cards.

It has no weighted-combo field. Adapting a weighted range to `null` would discard its weights; selecting one fixed combo would discard its distribution. No adapter is therefore implemented, and canonical Equity behavior is unchanged.

A future Equity ticket must own a versioned weighted-opponent request or a separate exact weighted enumeration boundary, including multi-opponent card-removal semantics, progress, cancellation, and performance validation.

## 16. Future consumers

The range core safely exposes structural facts for future work:

- richer Analysis: coverage, combo mass, class composition, blocker effects, and complete normalized distributions;
- bluff analysis: exact card-containing combos and mass removed by blockers/unblockers;
- Range Builder: class painting, exact combo editing, partial cells, and preserved deviations;
- Range Teacher/Profiler: direct/inferred provenance and unresolved entries;
- Compare Spots: deterministic per-combo values plus Matrix aggregates before or after caller-owned conditioning;
- Saved Ranges: deterministic portable payload groundwork without adding a SavedStudyObject kind in this ticket.

The core does not infer range advantage, nut advantage, bluffs, EV, fold equity, or strategic correctness.

## 17. Validation, serialization, and immutability

Validation fails closed on unsupported schema/game values, noncanonical order, missing/duplicate/invalid combo IDs, invalid state/weight relationships, non-finite or out-of-range weights, invalid provenance, dangling provenance references, and malformed JSON.

Serialization recursively sorts object keys while retaining canonical array order. Deserialization validates the complete value before returning a deeply frozen clone. Constructors and derived operations return new deeply frozen values; there is no global range state.

## 18. Performance evidence

The focused Node acceptance run on August 16, 2026 measured one 1,326-combo operation at approximately:

| Operation | Time |
|---|---:|
| complete construction | 1.9 ms |
| five-card blocker conditioning | 3.1 ms |
| 169-cell Matrix projection | 4.0 ms |
| three-card normalized distribution | 4.7 ms |

These are bounded development-machine measurements, not universal latency promises. The exhaustive per-card blocker property test also completes in the focused suite. No worker or speculative optimization is justified at this scale.

## 19. Explicit non-goals

V1 does not implement Range Builder UI, Range Teacher logic, Personal Strategy inference integration, StrategyProvider migration, Equity migration, Saved Range objects, range notation parsing, postflop propagation, bluff classification, Compare Spots UI, accounts/cloud, or solver/model imports.
