# Strategy calibration tooling

This directory contains deterministic, non-production diagnostics for Riverline's
current `StrategyProvider v1` authority. Nothing under `tests/tooling` is imported
by the browser or Electron runtime.

Run the summary report from the repository root:

```powershell
node tests/tooling/run-strategy-calibration.mjs --pretty
```

Add `--full` to include action summaries for every one of the 169 preflop hand
classes in every representative configuration. Runtime is intentionally a
separate, non-deterministic report:

```powershell
node tests/tooling/run-strategy-calibration.mjs --runtime --runs=3 --pretty
```

The importable harness supports:

- one exact `DecisionContext v1` through `evaluateDecisionContext`;
- caller-selected 169 classes, positions, stack values, table sizes, facing
  categories, and exact call amounts through `evaluatePreflopGrid`;
- standard 169-class range summaries through `summarizePreflopConfiguration`;
- named flop/turn/river corpora and price, style, multiway, and sizing sweeps;
- eleven DecisionContext v1.1 fact fixtures covering live/effective stacks,
  legacy `potBb` versus exact `currentPotBb`, position relation, legal
  aggressive-to bounds, prior-action summaries, and Scenario-versus-Hand
  provenance;
- defined L1, maximum-action-error, dominant-action, aggression, passive, and
  fold comparisons against a bounded-HU reference.

## Product performance profile

PERF-001's non-production Node profile covers application/context resolution,
preflop and postflop provider resolution, 169-cell preflop Matrix preparation,
and deterministic Training generation:

```powershell
node tests/tooling/run-product-performance-profile.mjs --pretty
```

Use `--quick` for a smaller local sample. The report deliberately excludes DOM,
layout, paint, and browser interaction timing; those require a browser harness
and must not be inferred from Node measurements.

## Training practice sampler

TRAINING-SAMPLER-002A's planner-only benchmark measures deterministic structural
selection without generating PokerState, calling StrategyProvider, or touching
the DOM:

```powershell
node tests/tooling/benchmark-training-sampler.mjs --count 1000
node tests/tooling/benchmark-training-sampler.mjs --count 10000
node tests/tooling/benchmark-training-sampler.mjs --count 100000
```

Add `--verify-determinism` to repeat the selected count and compare sequence
digests. The 100,000-selection run is a manual development gate, not normal CI.

## Bounded-HU reference boundary

The current repository does not contain a solved or sufficiently converged
Hold'em strategy fixture. The default report therefore returns
`status: "unavailable"` and no mismatch metrics.

A future fixture can be supplied with:

```powershell
node tests/tooling/run-strategy-calibration.mjs --reference=path/to/reference.json --pretty
```

It must use `riverline-hu-preflop-calibration-reference/v1`, identify
`riverline-hu-preflop-100bb/v1`, and explicitly set
`quality.sufficientForCalibration` to `true`. Each row supplies an exact
`DecisionContext`, a normalized structural reference action vector, and either
the `structural` or `strategic_families` projection. The latter collapses explicit
solver sizes into fold/passive/aggression. DecisionContext v1.1 now exposes legal
aggressive-to bounds, but the current heuristic and bounded comparison do not
consume those additive facts.

The limp branch remains excluded from comparison even though DecisionContext
v1.1 preserves a canonical limp summary: the current heuristic does not consume
that summary, and the context does not retain the branch's prior-action 4bb size
anchor. Reference quality metadata is a gate, not an informational label:
insufficient references produce no calibration metrics.
