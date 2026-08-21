# Personal Strategy action-aware contract

Status: implemented by `PERSONAL-STRATEGY-ACTION-CONTRACT-001`

Date: August 21, 2026

## 1. Scope and authority

This specification defines the action-aware read-contract seam for Personal Strategy. It does not replace the durable `RangeObservation v1`, `TrainingObservation v1`, `CalibrationContext v1`, repository, IndexedDB layout, export envelope, or Personal Strategy sync schema.

The bounded dependency path is:

```text
durable RangeObservation v1 / TrainingObservation v1
                    |
                    v
    PersonalStrategyActionEvidence v2 adapter
                    |
                    v
       PersonalStrategyActionEstimate v2
                    |
                    v
       current Fold/Raise RFI projection
                    |
        +-----------+-----------+
        |           |           |
      Matrix      Builder     Teacher / Calibration
```

Current RFI inference remains deliberately RFI-specific. The new contract gives it an explicit action-set boundary; it does not claim that the current inference algorithm is generic.

## 2. Canonical action identities

Personal Strategy v1 action sets may use these stable identities from the canonical poker domain:

| Contract name | Stored identity |
|---|---|
| `FOLD` | `fold` |
| `CHECK` | `check` |
| `CALL` | `call` |
| `RAISE` | `raise` |
| `ALL_IN` | `all_in` |

`bet` is not part of this bounded Personal Strategy preflop contract. A future postflop action-family ticket must decide whether and how it enters Personal Strategy rather than acquiring authority from the broader poker action enum automatically.

`COMPLETE` or `LIMP` is not introduced as a separate canonical ID. Current canonical poker behavior represents a preflop limp/complete as `call`; UI labels may say Limp or Complete contextually. Inspection found no durable Personal Strategy distinction that would be lost by retaining `call`. A future ticket may add a separate identity only if a concrete evidence/key/inference requirement proves that `call` is semantically insufficient.

Labels such as Defend, Limp, Complete, Open, 3-bet, and 4-bet are presentation. They are not stored action identities.

## 3. PersonalStrategyActionSet v1

Schema: `personal-strategy-action-set/v1`.

```text
schemaVersion
actionSetId
decisionFamily
legalActions[]
```

An action set belongs to one decision family. It is not a universal list of every poker action. `actionSetId` is derived from the schema, decision family, and canonical legal-action identity order. Supplied legal actions are unique and normalized into that canonical identity order.

The only registered production family is:

```text
preflop_rfi -> [fold, raise]
```

The contract can validate explicitly supplied future-family sets so 3- and 4-action distributions can be tested without implementing those decision families. Names such as `preflop_facing_open` and `preflop_bb_option` are seams only: they do not create Calibration UI, context validation, repository keys, or inference behavior.

Canonical identity order and display order are separate. `getPersonalStrategyActionPresentationOrder(...)` validates an explicit presentation order without changing the action set or its serialized identity. JavaScript object-key order is never action order.

## 4. PersonalStrategyActionEvidence v2

Schema: `personal-strategy-action-evidence/v2`.

The read representation contains:

```text
schemaVersion
evidenceId
actionSet
target
claimKind
valueState
dominantAction | null
exactDistribution | null
observedAction | null
legacyValue | null
sourceType
sourceRecordSchema
provenance
contradictions[]
occurredAt
recordedAt
```

Supported claim kinds are:

- `dominant_action`;
- `exact_distribution`;
- `observed_action`;
- `retraction`;
- `unsupported_legacy_action`.

`unsupported_legacy_action` is a compatibility state, not legal guidance. Historical v1 validators accepted any canonical poker action inside an RFI observation. Such a record remains readable and retains its original value, but the v2 RFI action set does not silently legalize it. Current inference continues to return its established unsupported-action abstention.

Direct and Training source types remain distinct. Adapting a Training record does not grant it direct-intent authority.

This v2 evidence representation is a read adapter. It is not persisted, exported, or synced.

## 5. PersonalStrategyActionEstimate v2

Schema: `personal-strategy-estimate/v2`.

```text
schemaVersion
actionSet
target
valueState
dominantAction | null
exactDistribution | null
uncertainty | null
provenance
sourceType
contradictions[]
sourceEvidenceIds[]
```

`valueState` is one of:

- `available`;
- `uncertain`;
- `conflicting`;
- `unknown`;
- `unavailable`.

Current `directly_known`, `inferred_high`, and `inferred_medium` RFI estimates map to `available` while retaining their original uncertainty/provenance facts. `uncertain`, `conflicting`, and `unknown` remain distinct. An unavailable or abstained estimate contains neither dominant guidance nor an exact distribution.

A conflicting estimate must preserve structured contradiction references. Contradictory heads are never averaged, counted into a vote, or rewritten as one synthetic claim.

## 6. Exact distribution contract

An exact distribution is a complete array in canonical action-set order:

```json
[
  { "action": { "type": "fold" }, "probability": 0 },
  { "action": { "type": "raise" }, "probability": 1 }
]
```

Rules:

1. Every output entry belongs to the context's legal action set.
2. Every legal action appears exactly once in normalized output.
3. Values are finite and inside `[0, 1]`.
4. The sum must already be 1 within the strict exported tolerance `1e-12`.
5. Normalization fills omitted legal keys with deterministic explicit zero and closes only a tolerance-sized floating-point residual on the last positive action in canonical order.
6. Arbitrary weights or an invalid sum are rejected rather than silently renormalized.
7. An exact distribution's omitted legal action therefore means known zero after normalization.
8. `exactDistribution = null` means exact frequencies are absent/unknown; it never means every action is zero.

Input may be an action-keyed object or an array. Canonical output and serialization do not depend on object insertion order.

## 7. Dominant and exact semantics

- Dominant does not mean pure.
- `dominantAction = raise` with `exactDistribution = null` is qualitative guidance only.
- Exact pure Raise is the complete distribution Fold 0 / Raise 1.
- A unique exact maximum deterministically derives the matching dominant action.
- A tied exact maximum sets `dominantAction = null`.
- A supplied dominant action must be legal and equal the exact distribution's derived maximum.
- No exact frequencies are manufactured from dominant-only input.
- No uncertainty/confidence is manufactured from an action-frequency margin.

## 8. Deterministic serialization

Action sets serialize by version, decision family, canonical action identities, and derived action-set ID. Action estimates serialize after recursively ordering object keys while preserving contract-defined array order.

Therefore these do not affect identity:

- object property insertion order;
- supplied legal-action order;
- supplied action-key order inside an exact distribution;
- provenance object property order.

Presentation order remains outside semantic serialization.

## 9. v1 RFI compatibility

Existing durable RFI records remain `range-observation/v1` and retain their bytes and meaning.

| Existing v1 input | Action-aware read | Current RFI projection |
|---|---|---|
| quick Fold | `[fold, raise]`, dominant Fold, exact null | unchanged quick Fold |
| quick Raise | `[fold, raise]`, dominant Raise, exact null | unchanged quick Raise |
| explicit pure Raise | complete Fold 0 / Raise 1 | compact v1 positive-entry array retained |
| exact Fold/Raise mix | complete canonical distribution | identical v1 probabilities and legacy entry order retained |
| exact 50/50 tie | complete exact tie, dominant null | unchanged tied v1 mix |
| retraction | unavailable action value | unchanged retraction/history meaning |
| unsupported old RFI action | unavailable legacy claim with original value | unchanged unsupported-action abstention |
| contradictory heads | separate evidence plus contradiction references | unchanged conflicting/abstained RFI result |

The compatibility projection deliberately retains compact positive-only v1 exact-frequency arrays, including their historical entry order. That projection is not the v2 canonical serialization.

## 10. Inference compatibility

`deterministic-rfi-local-graph/v1` remains the sole current inference implementation. It still reasons only over Fold/Raise RFI evidence. Its supported action set now comes from `PersonalStrategyActionSet v1`.

The current estimate path validates/projects through `personal-strategy-estimate/v2` and then returns `personal-strategy-estimate/v1` to existing consumers. Numerical results, categorical abstention, direct precedence, exact mixes, tied mixes, uncertainty facts, evidence IDs, reason codes, and 002A compatibility results remain unchanged.

This is a seam for broader action-aware inference; it is not that broader inference.

## 11. Matrix, Builder, Teacher, and Calibration

Current surfaces retain their RFI behavior:

- Matrix consumes the existing `PersonalStrategySnapshot v1` compatibility view and still renders Fold/Raise presentation only.
- Builder continues to write immutable `RangeObservation v1` records and offers its existing Fold/Raise commands only.
- Teacher consumes current snapshot/evidence projections and preserves exact mixes and contradictions.
- Calibration question families and controls are unchanged.

No new action buttons, columns, labels, questions, or visible behavior are introduced by this ticket.

## 12. Repository, export, and sync impact

There is no IndexedDB migration, new object store, index, repository key, export version, Supabase migration, or remote entity version.

Repository logical keys remain:

```text
profile + mode + CalibrationContext v1 key + hand class
```

Sync continues to send immutable `range-observation/v1` and `training-observation/v1` JSON payloads. It does not sync action-aware evidence, action-aware estimates, normalized distributions, inference, contradiction projections, or action sets. No old evidence is rewritten or re-keyed.

## 13. Deferred to PREFLOP-ACTION-SPACE-001

The follow-up ticket must own these exact requirements before broader preflop Personal Strategy can ship:

1. versioned durable context contracts and canonical serializers for each approved decision family;
2. proven legal action-set resolution from canonical poker facts, including when Check, Call, Raise, and All-in are legal;
3. a deliberate decision on whether `call` remains sufficient for Limp/Complete in durable evidence;
4. action-history and price semantics that preserve raise-to amount versus incremental call amount;
5. context/repository key compatibility without reinterpreting `CalibrationContext v1` RFI evidence;
6. new direct-evidence schema only if a new durable family cannot be expressed without changing v1 meaning;
7. complete repository/export/import/IndexedDB and sync/Supabase handling for any newly persisted schema;
8. family-specific Calibration, Matrix, Builder, and Teacher application contracts and presentation order;
9. family-specific contradiction, retraction, exact-mix, and unsupported-legacy behavior;
10. action-aware inference or explicit abstention per family, with RFI parity retained behind its adapter;
11. no dominant-only-to-pure conversion in any provider, Training, Analysis, or range-conditioning consumer;
12. focused legal-state, action-order, exact-distribution, compatibility, persistence, sync, and consumer tests.

Postflop action families, `bet`, sizing abstractions, cross-context inference, StrategyProvider integration, Training evidence UI, and range propagation remain outside this contract and require their own approved boundaries.
