# RANGE-CAL-002B deterministic validation report

Date: August 18, 2026

Model: `deterministic-rfi-local-graph/v1`

Fixture version: `range-cal002b-hard-fixtures/v1`

All fixtures are synthetic user-strategy mechanics tests. They are not GTO, solver, Nash, EV, exploitability, or poker-reference truth.

## Protocol

- three fixed seeds: 17, 43, 89;
- direct-answer budgets: 10, 20, 30, 40, 50, 75;
- 144 fixture/seed/budget runs;
- deterministic random-looking visible subsets, nested by budget;
- held-out labels are not passed to the evidence view, inference, snapshot, or question logic;
- only `inferred_high` and `inferred_medium` count as attempted predictions;
- `uncertain`, `conflicting`, and `unknown` count as abstentions;
- high and medium are ordinal validation policies, not numeric confidence;
- `boundaryLocalizationError` measures disagreement between truth-boundary membership and a projected `high` boundary likelihood; it is diagnostic and not poker error.

Reproduce:

```powershell
node tests/tooling/evaluate_range_cal002b.mjs
```

## Fixture and budget results

`High n` is the number of held-out high-band attempts over three seeds. `False high` is the count of wrong high-band predictions.

| Fixture | Direct budget | Attempted coverage | Attempted accuracy | High n | High accuracy | False high | Abstention |
|---|---:|---:|---:|---:|---:|---:|---:|
| smooth-tight | 10 | 2.9% | 92.9% | 1 | 100.0% | 0 | 97.1% |
| smooth-tight | 20 | 8.3% | 97.3% | 2 | 100.0% | 0 | 91.7% |
| smooth-tight | 30 | 19.4% | 100.0% | 12 | 100.0% | 0 | 80.6% |
| smooth-tight | 40 | 32.8% | 100.0% | 42 | 100.0% | 0 | 67.2% |
| smooth-tight | 50 | 38.9% | 97.8% | 66 | 100.0% | 0 | 61.1% |
| smooth-tight | 75 | 58.2% | 97.0% | 105 | 99.0% | 1 | 41.8% |
| smooth-loose | 10 | 2.3% | 100.0% | 2 | 100.0% | 0 | 97.7% |
| smooth-loose | 20 | 13.0% | 98.3% | 9 | 100.0% | 0 | 87.0% |
| smooth-loose | 30 | 20.1% | 100.0% | 28 | 100.0% | 0 | 79.9% |
| smooth-loose | 40 | 28.4% | 100.0% | 50 | 100.0% | 0 | 71.6% |
| smooth-loose | 50 | 35.0% | 100.0% | 61 | 100.0% | 0 | 65.0% |
| smooth-loose | 75 | 55.7% | 99.4% | 92 | 100.0% | 0 | 44.3% |
| irregular-reproducible | 10 | 0.2% | 0.0% | 0 | n/a | 0 | 99.8% |
| irregular-reproducible | 20 | 0.0% | n/a | 0 | n/a | 0 | 100.0% |
| irregular-reproducible | 30 | 0.0% | n/a | 0 | n/a | 0 | 100.0% |
| irregular-reproducible | 40 | 1.8% | 28.6% | 0 | n/a | 0 | 98.2% |
| irregular-reproducible | 50 | 0.0% | n/a | 0 | n/a | 0 | 100.0% |
| irregular-reproducible | 75 | 2.5% | 57.1% | 0 | n/a | 0 | 97.5% |
| islands-gapped | 10 | 1.5% | 100.0% | 4 | 100.0% | 0 | 98.5% |
| islands-gapped | 20 | 6.5% | 93.1% | 6 | 100.0% | 0 | 93.5% |
| islands-gapped | 30 | 16.8% | 91.4% | 10 | 100.0% | 0 | 83.2% |
| islands-gapped | 40 | 28.7% | 93.7% | 27 | 100.0% | 0 | 71.3% |
| islands-gapped | 50 | 41.7% | 93.3% | 41 | 100.0% | 0 | 58.3% |
| islands-gapped | 75 | 73.8% | 92.8% | 95 | 100.0% | 0 | 26.2% |
| suited-offsuit-anomaly | 10 | 1.9% | 100.0% | 4 | 100.0% | 0 | 98.1% |
| suited-offsuit-anomaly | 20 | 7.2% | 100.0% | 6 | 100.0% | 0 | 92.8% |
| suited-offsuit-anomaly | 30 | 14.6% | 90.2% | 14 | 100.0% | 0 | 85.4% |
| suited-offsuit-anomaly | 40 | 26.6% | 94.2% | 19 | 100.0% | 0 | 73.4% |
| suited-offsuit-anomaly | 50 | 40.1% | 95.8% | 46 | 100.0% | 0 | 59.9% |
| suited-offsuit-anomaly | 75 | 63.5% | 94.4% | 112 | 99.1% | 1 | 36.5% |
| pair-anomaly | 10 | 2.5% | 100.0% | 0 | n/a | 0 | 97.5% |
| pair-anomaly | 20 | 8.1% | 100.0% | 2 | 100.0% | 0 | 91.9% |
| pair-anomaly | 30 | 16.8% | 98.6% | 6 | 100.0% | 0 | 83.2% |
| pair-anomaly | 40 | 31.0% | 99.2% | 18 | 100.0% | 0 | 69.0% |
| pair-anomaly | 50 | 45.7% | 98.2% | 44 | 100.0% | 0 | 54.3% |
| pair-anomaly | 75 | 64.9% | 94.5% | 113 | 99.1% | 1 | 35.1% |
| contradictory-direct | 10 | 2.5% | 100.0% | 0 | n/a | 0 | 97.5% |
| contradictory-direct | 20 | 10.1% | 97.8% | 10 | 100.0% | 0 | 89.9% |
| contradictory-direct | 30 | 15.3% | 98.4% | 29 | 100.0% | 0 | 84.7% |
| contradictory-direct | 40 | 23.0% | 97.8% | 35 | 100.0% | 0 | 77.0% |
| contradictory-direct | 50 | 32.2% | 96.5% | 49 | 100.0% | 0 | 67.8% |
| contradictory-direct | 75 | 47.2% | 100.0% | 71 | 100.0% | 0 | 52.8% |
| sparse-exact-boundary | 10 | 1.0% | 100.0% | 0 | n/a | 0 | 99.0% |
| sparse-exact-boundary | 20 | 6.7% | 100.0% | 1 | 100.0% | 0 | 93.3% |
| sparse-exact-boundary | 30 | 14.9% | 100.0% | 12 | 100.0% | 0 | 85.1% |
| sparse-exact-boundary | 40 | 23.8% | 100.0% | 26 | 100.0% | 0 | 76.2% |
| sparse-exact-boundary | 50 | 28.9% | 100.0% | 44 | 100.0% | 0 | 71.1% |
| sparse-exact-boundary | 75 | 51.8% | 99.3% | 75 | 100.0% | 0 | 48.2% |

## Aggregate safety curve

| Direct budget | Attempted coverage | Attempted accuracy | High n | High accuracy | False high | Medium accuracy | Abstention |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 1.9% | 97.2% | 11 | 100.0% | 0 | 96.7% | 98.1% |
| 20 | 7.5% | 98.1% | 36 | 100.0% | 0 | 97.8% | 92.5% |
| 30 | 14.7% | 97.2% | 111 | 100.0% | 0 | 96.3% | 85.3% |
| 40 | 24.5% | 97.2% | 217 | 100.0% | 0 | 96.1% | 75.5% |
| 50 | 32.8% | 97.2% | 351 | 100.0% | 0 | 95.6% | 67.2% |
| 75 | 52.2% | 96.2% | 663 | 99.5% | 3 | 91.8% | 47.8% |

The aggregate number is not used to hide fixture failures. In particular, the irregular fixture is intentionally reported as essentially unlearnable by this local model: attempted coverage stays at or below 2.5%, attempted accuracy is poor when a rare medium attempt occurs, and the model makes zero high-band predictions. This is accepted honest behavior, not a claim that the fixture was solved.

## Stability and runtime

Across nested answer budgets, every comparison in which the same held-out hand was attempted before and after additional evidence retained the same categorical prediction in this deterministic corpus. Tests require at least 95% rather than an exact 100% snapshot.

Representative implementation-machine measurements from the committed harness shape:

| Operation | Observed |
|---|---:|
| one estimate median | approximately 0.47 ms |
| one estimate maximum in benchmark sample | approximately 1.87 ms |
| one 169 snapshot | approximately 7.2 ms after graph warmup |
| repeated cached snapshot | approximately 1.35 ms |
| invalidation plus 169 recomputation | approximately 10.7 ms |
| complete 144-run validation matrix | approximately 1.6 s |

Cold/warm timing varies by machine and concurrent load. Dedicated regression tests use deliberately wider bounds: 5 ms median for one estimate, 100 ms for snapshot/invalidation, and 15 seconds for the full matrix. Individual per-run wall time remains reported but is not asserted because an unrelated parallel test can preempt one measurement.

## Acceptance interpretation

- smooth, gapped, and anomaly fixtures materially beat chance among attempted predictions;
- high-band accuracy is at least medium/overall aggregate accuracy at each budget;
- false-high errors are zero through 50 direct answers and 3 of 663 high attempts at budget 75;
- direct contradictions always remain a target conflict;
- sparse exact/tied boundary evidence reduces attempted coverage without creating inferred numeric mixes;
- reproducible irregular evidence drives near-total abstention instead of false certainty;
- output is deterministic, scope-isolated, source-referenced, and versioned;
- no result establishes poker correctness or real-user calibration.
