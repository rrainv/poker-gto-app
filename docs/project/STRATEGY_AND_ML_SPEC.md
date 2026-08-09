# Strategy and ML Specification

## 1. Product goal

The ML system provides fast strategic approximations. It is not required to produce exact equilibrium.

## 2. Strategy hierarchy

Current intended hierarchy:

```text
Preflop → trained strategy model
Flop    → trained approximation
Turn    → trained approximation + fallback
River   → deterministic range/equity mathematics
```

Future:

```text
MCCFR / solver → training-data source
depth-limited solver → optional runtime enhancement
```

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

## 10. Browser model

Models are lazy-loaded by street/type.

Do not optimize model size prematurely.

First make the model useful and measurable.

Then evaluate:

- file size
- cold load
- inference latency
- memory
- accuracy/calibration
