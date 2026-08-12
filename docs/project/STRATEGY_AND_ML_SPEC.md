# Strategy and ML Specification

## 1. Product goal

The ML system provides fast strategic approximations. It is not required to produce exact equilibrium.

## 2. Strategy hierarchy

Current browser production hierarchy:

```text
DecisionContext → deterministic fallback → StrategyResult
```

Target hierarchy after validated providers exist:

```text
MCCFR / solver → training-data source
validated, versioned model provider → optional strategy source
depth-limited solver → optional runtime enhancement
```

### Current preflop fallback limitations

The production preflop source is a deterministic heuristic, not solved GTO,
Nash, or solver-derived strategy. Its frequencies are intended to be smooth,
legal, and internally coherent pending validated preflop data.

- Exact price adjustments use `callAmountBb` only. When Scenario cannot prove
  the incremental call price, exact-price adjustments are omitted.
- A finite preflop `StrategyResult.action.amountBb` means amount-to: Hero's
  total preflop contribution after acting. Facing-aggression sizing is omitted
  when DecisionContext does not prove a legal raise-to bound.
- The ClubGG fixed 0.1bb-per-seated-player deduction remains an accounting fact
  outside the pot. The current heuristic applies no invented strategy penalty
  for it, so otherwise identical Home and ClubGG decisions resolve identically.
- Play Style and Opponent Style controls are not applied to preflop frequencies.
  Their strategy semantics require a separate calibrated product design.

### Current postflop fallback limitations

The production postflop source remains a deterministic heuristic, not solved
GTO, Nash, equilibrium strategy, or canonical Equity.

- Its sampled showdown share is conditional on a crude assumed opponent range.
  Each opponent currently uses the same uniformly sampled candidate-range model;
  card removal makes allocations dependent, but no weighted range engine exists.
- Canonical Hand and Training contexts use exact live-opponent counts. Scenario
  contexts disclose a seated-table approximation because they have no legal
  fold history.
- Every counted trial allocates every intended opponent, excludes known/dead
  cards, uses the shared evaluator, and awards Hero exactly `1 / winners` in a
  split pot.
- `StrategyResult.details.heuristicSample` is the one sample used by both the
  strategy decision and AnalysisExplanation. It is labeled
  `heuristic_conditional_sample` and remains separate from `equity-request/v1`.
- Postflop action frequencies use continuous heuristic interpolation. The
  category/style offsets remain assumptions awaiting calibration.
- Exact price adjustment uses `callAmountBb` only. Unknown Scenario prices do
  not become zero or create exact pot odds.
- Postflop exact bet/raise amounts are omitted because DecisionContext v1 does
  not prove complete legal sizing bounds.
- The former manual flat-drop threshold penalty was removed. ClubGG's fixed
  0.1bb-per-seated-player deduction is outside the contested pot and does not
  receive an invented strategy penalty.

## 3. Training truth

Training targets must have a documented source.

Allowed sources:

- verified solver output
- verified CFR/MCCFR output
- curated strategy data
- deterministic mathematical labels for explicitly non-equilibrium features

Random policy/value tensors are not strategy data.

## 4. Preflop experiment

First serious solver experiment:

- heads-up
- 100bb
- no rake
- preflop only
- small action abstraction
- correct Hold'em chance/betting logic
- reproducible seed
- bounded compute

The purpose is to validate the pipeline, not solve all configurations.

## 5. Model outputs

Prefer a policy/value design when supported by the training source.

Policy:

```text
P(action | state)
```

Value:

```text
V(state)
```

For later solver integration, action-conditioned values are useful:

```text
Q(state, action)
```

## 6. Interpolation

Do not assume action probabilities interpolate linearly across stack depth.

Prefer interpolating value-like quantities when possible, then derive the policy.

Test hidden stack sizes explicitly.

Example:

```text
train: 20bb, 50bb, 100bb
test: 35bb, 70bb, 80bb
```

## 7. Uncertainty

A strategy result should eventually expose a coverage/confidence signal based on:

- distance from training distribution
- interpolation distance
- model uncertainty where available

High-uncertainty states can use a fallback.

## 8. Multiway

Multiway strategy should be described as approximate.

Do not claim a simple Nash-equilibrium guarantee for 6-10 player Hold'em.

The system should distinguish:

- equity correctness
- strategy approximation
- equilibrium evidence

These are different properties.

## 9. River fallback

Do not use hand-equity thresholds alone.

A useful river fallback should consider:

- hero range
- opponent range
- board
- pot
- effective stack
- bet size
- blockers
- value/bluff composition

A future small river CFR solver is optional.

## 10. Future browser model

There is no current browser production model. Do not reconnect the retired browser ONNX stack.

A future model must use a new versioned StrategyProvider/model contract and must be validated against its documented training source before it can become production authority.

Do not optimize model size prematurely.

First make the model useful and measurable.

Then evaluate:

- file size
- cold load
- inference latency
- memory
- accuracy/calibration
