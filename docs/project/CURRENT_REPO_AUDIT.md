# Current Repository Audit

This is a snapshot of the repository supplied for review. It is intentionally blunt. It exists to prevent agents from assuming that comments or old documentation describe implemented behavior.

## 1. Important observations

The repository contains multiple generations of ML and solver code.

Relevant examples include:

- `training/model.py`
- `training/train.py`
- `training/engine.py`
- `solver-model/model.py`
- `solver-model/train.py`
- `app/src/ml/engine.js`

These should not be treated as interchangeable.

## 2. Current training-data problem

`training/train.py` currently contains a mock/random data-generation path.

It creates random tensors for state features and random policy/value targets instead of deriving targets from an actual CFR traversal.

Therefore:

- it is not a genuine CFR data pipeline
- training duration does not imply strategic progress
- comments referring to a CFR-generated dataset must be treated as aspirational unless verified

## 3. Current model duplication

`training/model.py` contains `PokerNet`.

`solver-model/model.py` contains `DeepCFRNet`.

Other training scripts define additional architectures.

These architectures have different input sizes, action assumptions, and semantics.

Do not combine them casually.

## 4. Current solver limitations

The existing `solver-model` CFR implementation is a prototype and should not be treated as a production Hold'em solver.

Before calling it a solver, verify:

- legal Hold'em betting transitions
- chance nodes
- board progression
- terminal conditions
- pot accounting
- information-set construction
- regret accumulation
- average-strategy calculation
- utility calculation

## 5. Evaluator concerns

`training/engine.py` contains a Numba/mmap-oriented evaluation path and stack/action abstractions.

It also contains placeholder/mock comments.

Do not assume the evaluator or LUT is valid merely because it loads.

Add known-answer tests and fail loudly if the LUT is missing or invalid.

Do not silently create a zero-filled production LUT.

## 6. Existing lazy loading

`app/src/ml/engine.js` already contains a lazy loader.

It caches ONNX sessions and prevents duplicate concurrent loads.

Therefore lazy loading is not a future architecture problem. Preserve and improve it only when necessary.

## 7. Documentation policy

Historical documents such as `POST_MORTEM.md` are useful as history but must not override the architecture contract.

Claims such as "Deep CFR", "solved", "Nash", or exploitability figures require verification from executable code and reproducible evaluation.

## 8. Immediate recommendation

Do not start with a repository-wide rewrite.

First establish:

1. canonical state
2. canonical action schema
3. canonical evaluator/equity path
4. canonical model path
5. tests
6. only then the real preflop solver experiment
