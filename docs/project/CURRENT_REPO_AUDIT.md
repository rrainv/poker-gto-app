# Current Repository Audit

This is a snapshot of the repository supplied for review. It is intentionally blunt. It exists to prevent agents from assuming that comments or old documentation describe implemented behavior.

## 1. Current architecture boundary

CLEANUP-001D removed the obsolete root prototype training pipeline, pseudo-CFR model pipeline, and checked-in strategy-tree data. They were not runtime, package-script, or bounded-solver dependencies.

The retained bounded solver is `solver/riverline_solver`; it is intentionally separate from browser runtime code. The legacy browser ONNX/model stack was retired in CLEANUP-001E1. Browser strategy now resolves directly from `DecisionContext` through the deterministic fallback to `StrategyResult`.

## 2. Training and solver evidence

Training targets must have a documented, reproducible source. Random labels, heuristic thresholds, and unverified model artifacts are not CFR or equilibrium data.

Before describing a new component as a Hold'em solver, verify legal betting transitions, chance nodes, terminal conditions, pot accounting, information sets, regret accumulation, average strategy, and utility calculation.

## 3. Evaluator boundary

The bounded solver uses the maintained evaluator adapter and parity coverage. Do not silently create a zero-filled production lookup table; missing or invalid evaluator data must fail loudly.

## 4. Current browser strategy authority

The browser has no trusted production strategy model and no model loader.

The deterministic fallback is the only current browser production strategy authority. The generic, versioned `StrategyResult` and provenance fields remain so a future validated provider can be introduced without reviving the removed implementation.

The distinct Electron-native experiment is reserved for a separate cleanup decision and is not browser strategy authority.

## 5. Documentation policy

Historical documents such as `POST_MORTEM.md` are useful as history but must not override the architecture contract.

Claims such as "Deep CFR", "solved", "Nash", or exploitability figures require verification from executable code and reproducible evaluation.

## 6. Immediate recommendation

Do not start with a repository-wide rewrite.

First establish:

1. canonical state
2. canonical action schema
3. canonical evaluator/equity path
4. a new versioned strategy-provider contract before any production model path
5. tests
6. only then the real preflop solver experiment
