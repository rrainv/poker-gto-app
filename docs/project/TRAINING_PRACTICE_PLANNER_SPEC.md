# Training Practice Planner specification

Status: implemented through `TRAINING-SAMPLER-002A`, `TRAINING-SAMPLER-002B`, `TRAINING-SIZING-DIVERSITY-001`, and the Varied/Focused Training foundation.

## Purpose and authority boundary

The Training sampler program adds a DOM-free deterministic planning layer that asks:

> What kind of Training decision should Riverline ask next?

The authority chain is:

```text
TrainingSessionIntent v1
        -> TrainingPracticePlanner
        -> TrainingScenarioRequest v1
        -> strict 002B generator adapter
        -> canonical Training generator
```

The planner selects only a structural target envelope. It does not construct
cards, actions, button/seat assignments, bets, raises, pots, stacks after
actions, PokerState, DecisionContext, StrategyResult, or grades. The canonical
Training generator remains the only legal-trajectory authority. Current Varied
and Focused sessions consume this planner/adapter foundation; Full Hand Training
remains a separate visible-hand mode.

## Contracts

### TrainingSessionIntent v1

Schema version: `training-session-intent/v1`.

The strict immutable contract contains exactly:

- `schemaVersion`
- `mode`: `varied` or `focused`
- `sessionSeed`: unsigned 32-bit integer, including distinct seed `0`
- `sessionLength`: 1 through 100,000
- `difficulty`: the current `hard`, `easy`, or `guided` compatibility value
- `focusPreferences`
- immutable `GameRulesSnapshot v1`
- the actual `training-rules-capability/v1` result supplied by the caller
- `plannerPolicyVersion`

Varied preferences are intentionally broad: balanced/more-preflop/more-
postflop curriculum profile, optional street emphasis, broad stack preference,
and allowed table-size families. They do not expose every scoring dimension.

Focused preferences contain the exact current generator-facing structural
controls: table size, canonical Hero position, starting stack, street, and
target decision type. Well-formed but mutually impossible Focused constraints
produce an explicit planning failure; they are never substituted.

### TrainingScenarioRequest v1

Schema version: `training-scenario-request/v1`.

The strict immutable request contains the session/mode/ordinal identity,
planner-only `exerciseSeed`, legal table/position target, starting stack and
bucket, street, target decision type, derived facing category, difficulty,
exact Game Rules semantic fingerprint, planner policy version, and transparent
planning reason/relaxation/score metadata. Under planner policy v2 it also
contains a generation-only `requestedSizingFamily` for facing-size targets;
legacy-default Focused requests and targets without a facing size use `null`.

It contains no concrete action, amount-to, pot, button seat, card, board,
fabricated history, PokerState, DecisionContext, StrategyResult, or grade.

### TrainingPracticePlanner state v1

Schema version: `training-practice-planner-state/v1`.

State is ephemeral, deterministic, serializable, storage-independent, and
bound to one intent fingerprint. It contains:

- served count and relaxation count;
- sparse sorted marginal and joint coverage counters;
- at most 32 recent structural records;
- at most 64 recent exact fingerprints;
- the planner policy version.

Planning is read-only. `recordServedTrainingScenario()` is the sole coverage
advance operation and is called only after a downstream exercise is
successfully served. Planning or generation failures therefore never count as
coverage.

## Candidate eligibility

`shared/poker-domain/positions.js` is the only table/position identity
authority. The planner constructs legal pairs for all supported 2-10 handed
tables and never samples table size independently from position.

Known structural impossibilities are excluded, including a non-BB check-option
target, an unopened BB target, and prior-action targets assigned to the first
preflop actor. This is static planning eligibility only; the generator remains
responsible for constructing and validating the legal trajectory.

The default Varied stack anchors are:

```text
10, 15, 20
25, 30, 40
50, 60, 75, 80
100, 125, 150
200, 250, 300
```

Focused mode retains exact current generator-compatible stacks from 10 through
500bb when aligned to the rules snapshot's chip unit. Values above 300bb are
not part of default Varied selection.

The planner consumes the existing `training-rules-capability/v1` contract. An
unsupported capability, including current fixed-per-seated-player collection,
returns `unsupported_rules` with the original reason and semantic fingerprint.
No no-collection fallback is synthesized.

## Coverage and bounded proposals

Coverage tracks these marginals:

- street
- target decision type
- table size
- canonical Hero position
- stack bucket
- derived facing category
- realized sizing family (`none` when sizing does not apply)

Only these justified joints are tracked:

- table size x Hero position
- street x target decision type

The planner does not materialize a Cartesian cube. Each decision builds a
bounded proposal pool by deterministically combining proposals rooted in every
eligible table/position marginal, every street/target marginal, every allowed
stack anchor, plus a small fixed set of mixed proposals. Impossible categories
are absent from the eligible denominator.

## Scoring, recency, and determinism

Candidate scoring is stable integer arithmetic:

```text
score = weighted marginal/joint coverage deficit
      + Riverline study-curriculum base
      + future-priority seam (zero in v1)
      - bounded recency penalty
      - known static retry-risk penalty
```

These are curriculum weights, not GTO frequency, real-world population
frequency, probability, confidence, EV, or solver evidence.

Recency penalizes exact identity, grouped structural identity, target family,
Hero position, table size, and stack bucket. Varied mode avoids exact recent
repeats whenever its bounded pool contains an alternative. Structural repeat
remains a strong penalty rather than an illegality so a materially under-
covered category can win. When every candidate violates an exact or structural
recency preference, the request records a controlled relaxation. Focused mode
ignores recency for its fixed dimensions.

Exact and structural fingerprints use fixed field order and a compact derived
rules identity. They exclude cards, generated actions, and StrategyResult. The
exact envelope fingerprint also excludes ordinal/exercise seed so repetition
measurement remains meaningful. Planner policy v2 includes the requested
sizing family in both fingerprints and applies a bounded sizing-family recency
penalty.

## Facing-size generation policy

`TRAINING-SIZING-DIVERSITY-001` adds the `training-sizing-family/v1`
vocabulary and `training-sizing-policy/v1` realization policy behind the
planner/request boundary. Preflop facing targets use `minimum`, `small`,
`medium`, `large`, and structurally eligible `all_in`. Postflop facing targets
use `small`, `medium`, `large`, `overbet`, and structurally eligible `all_in`.
These values describe legal scenario construction only; they are not answer
controls, grades, strategy recommendations, GTO claims, or solver evidence.

The planner proposes only families that are structurally eligible and
distinct under its rules/stack/table envelope. The generator remains the
authority for actual realization: it rounds through the configured chip unit,
uses canonical legal-action minimum/maximum specifications, deduplicates
families that collapse to one legal amount, and uses the canonical `ALL_IN`
action. An unrealizable requested family fails explicitly and is never
substituted. Retries keep the request's family fixed. Served coverage advances
the marginal realized-family counter only after successful generation.

Planner-only seed mixing hashes the session seed, ordinal, candidate key,
policy/stream name, and then avalanches the result. Seed `0` remains distinct;
there is no wall clock; adjacent seeds do not share the generator's weak first
draw; and no canonical generator RNG value is consumed. Final ties use the
mixed unsigned value and then the fixed candidate key.

## Implemented generator adapter and product integration

`TRAINING-SAMPLER-002B` owns the integration boundary and now:

1. maps every planner target value exactly to the canonical generator target
   vocabulary and fails on drift;
2. creates a candidate-specific validated Game Rules snapshot whose setup table
   size matches the request while preserving semantic identity/provenance;
3. adapts one request to `training-config/v2` without changing generator RNG or
   legal-trajectory behavior;
4. coordinates bounded generation failures/retries without incrementing served
   coverage until an exercise is actually delivered;
5. retains session/request/policy/fingerprint metadata needed for deterministic
   replay and diagnostics;
6. integrates the planner with the canonical Training session lifecycle used by
   the current Varied/Focused surfaces.

Training Memory/DecisionRecord persistence, mistake/review history, same/similar
re-drill, spaced repetition, board-family expansion, opponent-count targeting,
generator RNG redesign, and Training grading changes remain separate future
work. No planner sizing family is a strategy recommendation.
