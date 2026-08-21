# Personal Strategy RFI context transfer

Status: implementation authority for `RANGE-INTELLIGENCE-003A`

Date: August 21, 2026

## Purpose and authority

`RANGE-INTELLIGENCE-003A` adds the first cross-context Personal Strategy inference layer. Direct intended-strategy evidence in one compatible preflop RFI context may provide a bounded derived estimate in another nearby RFI context within the same stable Profile ID and Mode ID.

The authority chain is:

```text
immutable direct evidence in exact donor contexts
                    |
                    v
same-context PersonalStrategySnapshot v1 per donor
                    |
                    v
personal-strategy-rfi-transfer-relationship/v1
                    |
                    v
personal-strategy-rfi-transfer-projection/v1 for one target
                    |
             +------+------+
             |             |
           Matrix        Teacher
```

The transfer projection is a recomputable overlay. It is not an observation, correction, snapshot replacement, sync entity, export entity, StrategyProvider result, or Range Core weight. `deterministic-rfi-local-graph/v1` remains the sole same-context inference authority and its output is unchanged.

## Relationship contract

`personal-strategy-rfi-transfer-relationship/v1` exposes for every evaluated donor-to-target pair:

- donor and target Profile ID, Mode ID, and canonical context key;
- explicit `eligible` state and rejection reason;
- profile, mode, decision-family, action-set, Game Rules, table-size, position/order, stack, and opponent-count dimensions;
- integer relationship strength from 0 through 100 and `strong`, `moderate`, `weak`, or `none` band;
- machine-readable reasons and `bounded-rfi-context-transfer/v1` provenance.

Relationship strength is a deterministic similarity coefficient. It is not confidence, probability, action frequency, EV, range weight, or poker strength.

## Implemented eligibility

Transfer requires:

- the same stable Profile ID;
- the same stable Mode ID;
- `preflop_rfi` on both sides;
- exactly compatible canonical `[fold, raise]` action sets;
- equal game variant and equal mathematical Game Rules identity/facts;
- equal effective-stack basis;
- table-size distance at most one, excluding the heads-up/non-heads-up discontinuity;
- the same named position, one adjacent non-blind position at the same table size, or a comparable relative non-blind role across adjacent table sizes;
- stack ratio at most 1.25, or at most 1.5 inside the same explicit stack bucket;
- compatible known live-opponent counts when canonical v2 facts exist.

Examples:

- BTN 100bb to BTN 110bb under identical rules is strong;
- CO to BTN at the same table/stack is moderate;
- an adjacent table size with the same named or equivalent relative role is bounded strong/moderate;
- early position to BTN, a material stack jump, different rules, different action sets, another mode, another profile, or another decision family is rejected.

Profile and Mode display names never participate. Renaming either object while retaining its stable ID leaves transfer semantics unchanged. Modes are not placed on a Tight/Loose or numeric interpolation axis.

## Estimate and combination semantics

`personal-strategy-rfi-transfer-estimate/v1` is projected for all 169 canonical classes. A donor context can contribute at most once per hand, even when it contains multiple compatible direct heads. Only a `directly_known` donor point or its explicit donor conflict is considered. Donor local inference is never recursively transferred.

Donors are ordered by relationship strength and canonical context key. At most four donor contexts are loaded and at most three contribute to one hand. Input order cannot change output.

Agreeing donors produce qualitative Fold or Raise transfer. The strongest relationship band is retained; multiple donors never invent numeric confidence. Opposing donor actions, a conflicting donor point, or a tied exact donor mix forces abstention for that target. Transfer fills only a locally `unknown` point. Direct, local inferred-high/medium, local uncertain, and local conflicting states all retain precedence.

## Precision

- dominant-only donor evidence remains dominant-only;
- an exact donor distribution remains exact in the donor contribution/provenance;
- the target transfer is always qualitative and has `exactFrequencies = null`;
- a tied exact donor has no dominant action and therefore forces transfer abstention;
- no cross-context result manufactures a pure or mixed target distribution.

This deliberate precision downgrade reflects that context similarity does not prove identical action frequencies.

## Repository, sync, and performance

`personal-strategy-evidence-scope-catalog/v1` discovers contexts with active direct heads through the existing `profileId` indexes on current/conflicting head stores, then filters one Mode ID. It does not scan immutable history or other profiles. The projection service ranks relationships first and loads full indexed scope history only for the capped eligible donor set.

Cached target entries are keyed by the exact target evidence fingerprint and donor-catalog fingerprint. A changed donor head changes catalog identity and causes recomputation; each resulting projection also records its donor revision fingerprint, relationship strengths, and model version for inspection. There is no IndexedDB, export, Supabase, or sync schema change.

Matrix uses a distinct `transferred` status/marker and retains the underlying local status. Its inspector carries donor contexts, direct evidence IDs, source precision, relationship reasons, and transfer band. Teacher exposes a transferred count, ordered transfer insights, selected-hand transfer provenance, and an explanation that transfer is derived rather than direct.

## Deferred broader `RANGE-INTELLIGENCE-003`

- cross-mode or evidence-backed mode relationships;
- non-RFI and postflop decision-family transfer;
- sizing-family transfer or action sets beyond exact Fold/Raise RFI compatibility;
- quantitative cross-context frequency models;
- combo-specific transfer;
- Training evidence as a donor;
- StrategyProvider, Training grading, Analysis, Compare Spots, or range propagation integration;
- learned similarity, real-user calibration, solver/reference truth, or numeric confidence;
- writable multi-head conflict resolution.
