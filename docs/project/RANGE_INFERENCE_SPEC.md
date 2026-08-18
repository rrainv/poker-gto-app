# Personal Strategy deterministic RFI inference

Status: implementation authority for `RANGE-CAL-002B`

Date: August 18, 2026

## Scope and authority

`RANGE-CAL-002B` implements one DOM-free Personal Strategy inference authority for preflop raise-first-in decisions with the Fold/Raise action universe.

```text
immutable RangeObservation / TrainingObservation source records
                         |
                         v
          PersonalStrategyEvidenceView v1
                         |
                         v
      direct/conflict projection + local graph inference
                         |
                         v
 PersonalStrategyEstimate v1 / PersonalStrategySnapshot v1
```

Source evidence remains authoritative. Evidence views, conflict markers, estimates, support diagnostics, uncertainty bands, and snapshots are derived in memory. They are not persisted as observations, exported as source truth, or sent through cloud sync.

The inference authority does not integrate Personal Strategy with StrategyProvider, Training UI, Matrix UI, Analysis, Equity, or Range Core weights. `RANGE-CAL-002C` consumes its read-only snapshot/support API in a separate question-selection policy and does not redefine inference.

## Implemented contracts

| Contract | Schema/version | Role |
|---|---|---|
| Strategy spot context | `strategy-spot-context/v1` | Generic derived objective context; current adapter is lossless from `CalibrationContext v1` RFI facts |
| Normalized evidence | `personal-strategy-evidence/v1` | Source-preserving read item for direct or Training evidence |
| Evidence view | `personal-strategy-evidence-view/v1` | One exact Profile × Mode × context projection with history, heads, conflicts, Training evidence, and 169 direct point states |
| Conflict | `personal-strategy-conflict/v1` | Deterministic unresolved incompatible-head projection; not evidence |
| Estimate | `personal-strategy-estimate/v1` | One class result with strategy precision, ordinal state, reasons, evidence IDs, and support facts |
| Uncertainty | `personal-strategy-uncertainty/v1` / `rfi-ordinal-uncertainty/v1` | Versioned ordinal band metadata; never numeric confidence |
| Inference support | `personal-strategy-inference-support/v1` | 002C-ready density, direction, disagreement, boundary, conflict, and neighbor facts |
| Snapshot | `personal-strategy-snapshot/v1` | Recomputable canonical-order 169-estimate scope read model with an empty sparse combo-override seam |
| Model | `deterministic-rfi-local-graph/v1` | Sole active inference algorithm; 002A API delegates through a compatibility adapter |

No durable evidence or IndexedDB schema version changed.

## Evidence projection

The repository loads one exact scope through the existing immutable-history `scopeKey` index. Current Training v1 has a profile index only, so the query reads that profile's Training records and filters by exact mode/context. It never scans other profiles for inference.

The evidence view retains:

- source record schema, stable evidence ID, calibration/Training provenance and session references;
- Profile, Mode, context key, hand-class target, created/updated timestamps;
- dominant-only versus exact-frequency claims without reinterpretation;
- correction lineage (`supersedesEvidenceId`);
- active, retracted, and superseded direct records;
- independent current heads and derived conflicts;
- separate observed-behavior Training items.

Persisted Training evidence appears in the unified view but is excluded from 002B intended-strategy inference, per `UNIFIED_RANGE_INTELLIGENCE_SPEC.md`. It cannot overwrite, vote against, or outnumber direct intent. A later policy may use it only after a separate validation ticket.

## Correction, retraction, and contradiction

A correction is defined only by explicit lineage. A new record superseding the selected prior head makes the prior record historical while the new leaf becomes current. A retraction is also an immutable leaf and removes only its branch's active claim.

Independent roots or siblings remain separate heads. Compatible heads may coexist:

- repeated dominant-only claims are compatible when their canonical action matches;
- identical exact mixes are compatible;
- an exact mix and dominant-only claim are compatible only when the exact mix has the same unique dominant action.

The exact mix has greater quantitative authority in a compatible group. Heads conflict when dominant actions disagree, exact mixes differ, a tied exact mix coexists with a dominant-only claim, or another combination cannot be reconciled without inventing user intent. Recency and sync order never select a winner.

An unresolved target conflict yields:

```text
status = conflicting
dominantAction = null
exactFrequencies = null
provenance = conflict
sourceEvidenceIds = every incompatible current head
```

The conflict ID is derived from stable sorted evidence IDs. It is not stored evidence. Writable multi-head resolution remains deferred because `RangeObservation v1` has only one supersession parent.

## Strategy precision

Direct dominant-only evidence returns `directly_known`, the supplied structured action, and `exactFrequencies = null`.

Direct exact evidence returns `directly_known` and the normalized source frequencies exactly. An exact tie retains `dominantAction = null`.

Inferred v1 output is categorical only. `inferred_high` and `inferred_medium` return Fold or Raise with `exactFrequencies = null`. Exact-frequency inference is deliberately deferred: categorical evidence cannot justify a numeric mix, and neighboring exact mixes are used only as boundary signals.

`uncertain`, `conflicting`, and `unknown` abstain with no strategy value. This keeps a tentative support direction available for question selection without presenting it as an estimate.

## Local neighborhood graph

The graph uses canonical 169 hand-class identity and no global poker-strength ordering.

| Relation | Tier/influence | Examples and use |
|---|---:|---|
| adjacent pair | primary / 4 | `55` ↔ `44`, `66` |
| two/three-rank pair neighbor | secondary / 2, tertiary / 1 | wider pair context only |
| adjacent same suited/offsuit family axis | primary / 4 | `A8s` ↔ `A7s`, `A9s`; `K9o` ↔ `K8o`, `KTo` |
| connectivity shift | primary / 3 | `T9s` ↔ `98s`, `JTs` when gap is preserved |
| nearby same family | secondary / 2 or tertiary / 1 | bounded two/three-axis distance |
| exact suited/offsuit counterpart | secondary / 1 | weak cross-shape evidence only |

Influence is an integer vote coefficient, not confidence, action frequency, range weight, probability, EV, or poker strength. Pair and non-pair families do not vote across one another.

## Boundary and instability facts

Exact tied mixes and exact mixes whose top two action frequencies differ by at most `0.20` are boundary evidence rather than categorical votes about a neighbor. Direct conflict is also a boundary/conflict signal.

The model measures observed local instability only among directly known points connected by a primary relation:

- fewer than four comparable direct pairs: `unknown` stability;
- disagreements at or below 25% of comparable pairs: `stable`;
- disagreements above 25% and at or below 50%: `mixed`;
- disagreements above 50%: `unstable`.

This is not a monotonic constraint. Direct anomalies remain authoritative. The band determines whether sparse local patterns are safe enough to extrapolate; unstable scopes abstain instead of forcing a smooth chart.

## Ordinal uncertainty rules

All thresholds below are deterministic and versioned by `deterministic-rfi-local-graph/v1`.

`directly_known`:

- one compatible current direct claim group determines the target;
- precision is whatever the source supplied, not upgraded.

`inferred_high`:

- scope stability is `stable`;
- at least four primary/secondary categorical neighbors support one action;
- at least two supporting neighbors are primary;
- there are no opposing categorical neighbors, nearby exact-boundary points, or nearby conflicts;
- supporting evidence spans at least two relation types.

`inferred_medium`:

- scope stability is not `unstable`;
- at least three primary/secondary categorical neighbors support one action;
- at least one supporting neighbor is primary and no primary neighbor opposes it;
- boundary likelihood is not high;
- either opposition is absent or winning integer influence is at least three times opposing influence.

`uncertain`:

- structurally relevant evidence exists, but high/medium criteria fail because it is sparse, conflicting nearby, boundary-adjacent, balanced, or unstable.

`conflicting`:

- the target itself has incompatible active direct heads.

`unknown`:

- no supported structurally relevant direct evidence exists, or the target direct action lies outside the current Fold/Raise family.

Synthetic fixture validation is recorded as the band cohort, but it is not real-user calibration and does not justify numeric or universal user-facing confidence claims.

## Reasons and 002C support facts

Machine-readable reasons include direct dominant/exact/tied, multiple consistent neighbors, adjacent-family, pair, suited-run, connectivity, cross-shape, boundary-nearby, conflicting-neighbor, locally unstable scope, insufficient support, no relevant evidence, unsupported action, and Training-excluded.

For every class, `support` exposes:

- `evidenceDensity = none | sparse | moderate | dense`;
- `supportDirection = fold | raise | balanced | none`;
- categorical and primary support counts;
- nearby disagreement count;
- `boundaryLikelihood = unknown | low | medium | high`;
- `conflictProximity = none | near | immediate`;
- nearby boundary/conflict counts;
- local stability band and pair counts;
- deterministic influential neighbors, relation types/tiers, point state, and source evidence IDs.

These facts are reusable inputs for 002C. They do not rank or choose a next question in 002B.

## Snapshot, cache, and invalidation

One snapshot contains exactly 169 estimates in canonical order, scope/context, action universe, evidence fingerprint, all derivation versions, status totals, and `comboOverrides: []`.

The projection service exposes:

```text
getEvidenceView(scope)
getStrategyEstimate(scope, handClass)
getStrategySnapshot(scope)
getInferenceSupport(scope, handClass)
invalidateScope(scope)
```

The cache key is exact Profile + Mode + canonical context. The source evidence fingerprint includes direct history and persisted Training evidence in that scope. A local answer/retraction invalidates only its scope. A remote pull is detected by the next scope read's changed evidence fingerprint. Repeated snapshot reads reuse the frozen snapshot. No 1,326-combo materialization occurs.

## Range Core and sync boundary

No adapter converts these estimates to `HoldemWeightedRange v1`.

```text
range inclusion weight != action frequency != inference uncertainty
```

An action-conditioned range remains valid only with a known prior inclusion range and an exact complete action mix. Dominant-only or inferred categorical output is insufficient.

Cloud sync continues to serialize source profiles, modes, direct observations, opted-in Training observations, and calibration sessions only. Evidence views, conflicts, estimates, uncertainty, support, snapshots, and cache state are local and recomputable.

## Validation and performance

The deterministic harness uses three fixed seeds and answer budgets 10, 20, 30, 40, 50, and 75 over eight synthetic mechanics fixtures: smooth tight/loose, reproducible irregular, islands/gaps, suited/offsuit anomaly, pair anomaly, contradictory direct heads, and sparse exact-frequency boundary.

Hidden labels are used only after estimates are produced. Tests verify a held-out label change cannot change source observations or output. Metrics include direct/attempted coverage, attempted/high/medium accuracy, abstention, false-high errors, boundary localization mismatch, stability under nested additional evidence, reasons, and runtime. Full results are in `RANGE_CAL_002B_VALIDATION_REPORT.md` and reproducible with:

```powershell
node tests/tooling/evaluate_range_cal002b.mjs
```

Observed implementation-machine timings were approximately 0.47 ms median for one estimate, 7–20 ms for a 169 snapshot after graph warmup, about 1.35 ms for a repeated cached snapshot, and about 11 ms for invalidation plus recomputation. These are regression evidence, not universal latency promises.

## Limitations and next gate

- only preflop RFI Fold/Raise and 169 class baselines are implemented;
- inference never creates exact action frequencies or combo deviations;
- synthetic ranges validate mechanics and known failure behavior, not real-user uncertainty calibration or poker correctness;
- the deliberately non-local fixture correctly produces near-total abstention and does not become learnable merely from local evidence;
- writable multi-head resolution, Personal Strategy Matrix, Builder/Teacher, Training inference, provider integration, postflop contexts, and action-conditioned Range Core adapters remain deferred;
- adaptive selection/stopping is implemented by `RANGE-CAL-002C` in `rfi-question-selection.mjs`; it consumes this authority, persists no inferred output, and is specified in `ADAPTIVE_RANGE_CALIBRATION_SPEC.md`.

`RANGE-CAL-002D` may consume the same snapshot/support/provenance API together with 002C question-value and boundary facts for Matrix inspection. It must not create another inference authority.
