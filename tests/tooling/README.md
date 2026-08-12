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
- defined L1, maximum-action-error, dominant-action, aggression, passive, and
  fold comparisons against a bounded-HU reference.

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
solver sizes into fold/passive/aggression and is required where
`DecisionContext v1` does not retain legal raise-size bounds.

The limp branch is excluded because `DecisionContext v1` projects a limp to
`check` and cannot identify the bounded solver's distinct 4bb branch. Reference
quality metadata is a gate, not an informational label: insufficient references
produce no calibration metrics.

