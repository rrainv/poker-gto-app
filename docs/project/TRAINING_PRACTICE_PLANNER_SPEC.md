# Training Practice Planner specification

## Purpose and authority boundary

`TRAINING-SAMPLER-002A` adds a DOM-free deterministic planning layer that asks:

> What kind of Training decision should Riverline ask next?

The authority chain is:

```text
TrainingSessionIntent v1
        -> TrainingPracticePlanner
        -> TrainingScenarioRequest v1
        -> deferred 002B generator adapter
        -> canonical Training generator
```

The planner selects only a structural target envelope. It does not construct
cards, actions, button/seat assignments, bets, raises, pots, stacks after
actions, PokerState, DecisionContext, StrategyResult, or grades. The existing
canonical Training generator remains the only legal-trajectory authority and
is unchanged by 002A.

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
planning reason/relaxation/score metadata.

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
measurement remains meaningful.

Planner-only seed mixing hashes the session seed, ordinal, candidate key,
policy/stream name, and then avalanches the result. Seed `0` remains distinct;
there is no wall clock; adjacent seeds do not share the generator's weak first
draw; and no canonical generator RNG value is consumed. Final ties use the
mixed unsigned value and then the fixed candidate key.

## Deferred to TRAINING-SAMPLER-002B

002B must own all integration work:

1. map every planner target value exactly to the canonical generator target
   vocabulary and fail on drift;
2. create a candidate-specific validated Game Rules snapshot whose setup table
   size matches the request while preserving semantic identity/provenance;
3. adapt one request to `training-config/v2` without changing generator RNG or
   legal-trajectory behavior;
4. coordinate bounded generation failures/retries without incrementing served
   coverage until an exercise is actually delivered;
5. retain session/request/policy/fingerprint metadata needed for deterministic
   replay and diagnostics;
6. integrate the planner with the canonical Training session lifecycle before
   any Varied Session UI is exposed.

UI, persistence, mistake history, spaced repetition, board/sizing families,
opponent-count targeting, generator RNG redesign, and Training grading changes
remain outside 002A.
