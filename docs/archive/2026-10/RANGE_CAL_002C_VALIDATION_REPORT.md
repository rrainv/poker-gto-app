# RANGE-CAL-002C validation report

Date: August 18, 2026

Schema: `range-cal002c-adaptive-comparison/v1`

Fixture version: `range-cal002b-hard-fixtures/v1`

These fixtures are synthetic user-strategy mechanics tests. They are not GTO, solver, Nash, EV, exploitability, or poker-reference truth.

## Design

- methods: deterministic adaptive v1 versus the canonical sequential 169-class fallback;
- accepted 002B fixtures: smooth tight, smooth loose, deliberately irregular, islands/gapped, suited/offsuit anomaly, pair anomaly, contradictory direct evidence, and sparse exact boundary;
- direct-question budgets: 10, 20, 30, 40, 50, 75;
- fixed seed labels: 17, 43, 89;
- 288 fixture/seed/method/budget records;
- the production selector has no random input, so all three seed-labelled replications intentionally produce the same sequence;
- hidden target labels are revealed only after a method selects a question;
- a held-out-label mutation test requires the adaptive question sequence to remain unchanged;
- inferred-high and inferred-medium count as attempted; uncertain, conflicting, and unknown count as abstentions;
- contradictory evidence is supplied identically to both methods and remains an explicit conflict;
- exact mixes use the fixture’s explicit mix only when that hand is selected.

The deterministic boundary-recovery metric is the fraction of target hand classes on a matrix-adjacency action boundary that were directly asked by the budget. It measures direct boundary discovery, not poker error.

The question-efficiency proxy is:

```text
(unique initially-unresolved hands that become inferred high/medium
 + 2 * directly discovered truth-boundary hands)
/ direct questions
```

It is an interpretable deterministic proxy, not Shannon information gain.

Reproduce the report with:

```powershell
node tests/tooling/evaluate_range_cal002c.mjs
```

## Aggregate comparison

Paired values are adaptive / canonical sequential.

| Budget | Attempted coverage | Attempted accuracy | Boundary recovery | Efficiency proxy | False-high errors |
|---:|---:|---:|---:|---:|---:|
| 10 | 0.8% / 3.4% | 100.0% / 88.4% | 8.6% / 4.2% | 1.00 / 1.09 | 0 / 0 |
| 20 | 4.6% / 4.6% | 89.1% / 81.8% | 20.8% / 9.4% | 1.42 / 1.15 | 0 / 3 |
| 30 | 8.9% / 5.9% | 93.9% / 93.9% | 33.1% / 18.0% | 1.56 / 1.32 | 0 / 0 |
| 40 | 14.3% / 8.0% | 95.3% / 92.8% | 48.1% / 23.6% | 1.67 / 1.39 | 0 / 6 |
| 50 | 21.0% / 7.0% | 96.5% / 94.0% | 58.7% / 30.8% | 1.70 / 1.37 | 0 / 6 |
| 75 | 46.7% / 8.5% | 99.4% / 90.6% | 78.8% / 51.8% | 1.73 / 1.41 | 3 / 3 |

The 10-question adaptive policy deliberately spends its cold start on structural diversity and boundary discovery. It therefore has less immediate inferred coverage than the sequential premium-heavy prefix. From 30 questions onward it has both more attempted coverage and substantially more direct boundary recovery in aggregate.

## Fixture and budget results

Paired values in every metric are adaptive / canonical sequential. `High errors` is the exact false-high count across the three fixed seed replications.

| Fixture | Budget | Attempted coverage | Attempted accuracy | Boundary recovery | Abstention | High errors |
|---|---:|---:|---:|---:|---:|---:|
| smooth-tight | 10 | 0.0% / 4.4% | n/a / 85.7% | 16.0% / 8.0% | 100.0% / 95.6% | 0 / 0 |
| smooth-tight | 20 | 4.7% / 4.7% | 100.0% / 85.7% | 36.0% / 12.0% | 95.3% / 95.3% | 0 / 3 |
| smooth-tight | 30 | 12.2% / 7.2% | 100.0% / 90.0% | 52.0% / 24.0% | 87.8% / 92.8% | 0 / 0 |
| smooth-tight | 40 | 17.1% / 9.3% | 100.0% / 91.7% | 80.0% / 32.0% | 82.9% / 90.7% | 0 / 0 |
| smooth-tight | 50 | 29.4% / 8.4% | 100.0% / 100.0% | 84.0% / 44.0% | 70.6% / 91.6% | 0 / 0 |
| smooth-tight | 75 | 77.7% / 10.6% | 100.0% / 90.0% | 88.0% / 92.0% | 22.3% / 89.4% | 0 / 0 |
| smooth-loose | 10 | 0.0% / 4.4% | n/a / 100.0% | 6.3% / 0.0% | 100.0% / 95.6% | 0 / 0 |
| smooth-loose | 20 | 9.4% / 6.0% | 100.0% / 100.0% | 9.4% / 0.0% | 90.6% / 94.0% | 0 / 0 |
| smooth-loose | 30 | 19.4% / 7.9% | 100.0% / 100.0% | 18.8% / 0.0% | 80.6% / 92.1% | 0 / 0 |
| smooth-loose | 40 | 27.1% / 10.1% | 100.0% / 100.0% | 40.6% / 0.0% | 72.9% / 89.9% | 0 / 0 |
| smooth-loose | 50 | 39.5% / 9.2% | 100.0% / 100.0% | 53.1% / 0.0% | 60.5% / 90.8% | 0 / 0 |
| smooth-loose | 75 | 61.7% / 9.6% | 100.0% / 77.8% | 84.4% / 18.8% | 38.3% / 90.4% | 0 / 0 |
| irregular-reproducible | 10 | 0.6% / 0.0% | 100.0% / n/a | 5.9% / 5.9% | 99.4% / 100.0% | 0 / 0 |
| irregular-reproducible | 20 | 6.0% / 0.0% | 33.3% / n/a | 11.8% / 11.8% | 94.0% / 100.0% | 0 / 0 |
| irregular-reproducible | 30 | 5.8% / 0.0% | 25.0% / n/a | 17.8% / 17.8% | 94.2% / 100.0% | 0 / 0 |
| irregular-reproducible | 40 | 7.0% / 0.0% | 22.2% / n/a | 23.7% / 23.7% | 93.0% / 100.0% | 0 / 0 |
| irregular-reproducible | 50 | 6.7% / 0.0% | 12.5% / n/a | 29.6% / 29.6% | 93.3% / 100.0% | 0 / 0 |
| irregular-reproducible | 75 | 0.0% / 0.0% | n/a / n/a | 44.4% / 44.4% | 100.0% / 100.0% | 0 / 0 |
| islands-gapped | 10 | 1.9% / 3.1% | 100.0% / 80.0% | 13.0% / 11.1% | 98.1% / 96.9% | 0 / 0 |
| islands-gapped | 20 | 4.7% / 5.4% | 100.0% / 50.0% | 31.5% / 22.2% | 95.3% / 94.6% | 0 / 0 |
| islands-gapped | 30 | 7.9% / 7.2% | 100.0% / 100.0% | 46.3% / 38.9% | 92.1% / 92.8% | 0 / 0 |
| islands-gapped | 40 | 10.9% / 10.1% | 100.0% / 100.0% | 61.1% / 38.9% | 89.1% / 89.9% | 0 / 0 |
| islands-gapped | 50 | 12.6% / 9.2% | 100.0% / 81.8% | 68.5% / 48.1% | 87.4% / 90.8% | 0 / 6 |
| islands-gapped | 75 | 68.1% / 8.5% | 100.0% / 100.0% | 74.1% / 66.7% | 31.9% / 91.5% | 0 / 0 |
| suited-offsuit-anomaly | 10 | 0.6% / 4.4% | 100.0% / 57.1% | 14.9% / 8.5% | 99.4% / 95.6% | 0 / 0 |
| suited-offsuit-anomaly | 20 | 4.0% / 4.7% | 100.0% / 42.9% | 34.0% / 19.1% | 96.0% / 95.3% | 0 / 0 |
| suited-offsuit-anomaly | 30 | 8.6% / 6.5% | 100.0% / 100.0% | 51.1% / 31.9% | 91.4% / 93.5% | 0 / 0 |
| suited-offsuit-anomaly | 40 | 17.8% / 9.3% | 100.0% / 100.0% | 55.3% / 36.2% | 82.2% / 90.7% | 0 / 0 |
| suited-offsuit-anomaly | 50 | 27.7% / 8.4% | 100.0% / 100.0% | 66.0% / 40.4% | 72.3% / 91.6% | 0 / 0 |
| suited-offsuit-anomaly | 75 | 51.1% / 9.6% | 100.0% / 100.0% | 89.4% / 51.1% | 48.9% / 90.4% | 0 / 0 |
| pair-anomaly | 10 | 0.0% / 4.4% | n/a / 100.0% | 4.5% / 0.0% | 100.0% / 95.6% | 0 / 0 |
| pair-anomaly | 20 | 0.0% / 6.0% | n/a / 88.9% | 18.2% / 4.5% | 100.0% / 94.0% | 0 / 0 |
| pair-anomaly | 30 | 0.0% / 6.5% | n/a / 88.9% | 36.4% / 11.4% | 100.0% / 93.5% | 0 / 0 |
| pair-anomaly | 40 | 11.6% / 9.3% | 100.0% / 83.3% | 50.0% / 18.2% | 88.4% / 90.7% | 0 / 3 |
| pair-anomaly | 50 | 21.0% / 8.4% | 100.0% / 90.0% | 56.8% / 27.3% | 79.0% / 91.6% | 0 / 0 |
| pair-anomaly | 75 | 54.3% / 10.6% | 100.0% / 80.0% | 81.8% / 50.0% | 45.7% / 89.4% | 0 / 3 |
| contradictory-direct | 10 | 3.1% / 1.9% | 100.0% / 100.0% | 2.9% / 0.0% | 96.9% / 98.1% | 0 / 0 |
| contradictory-direct | 20 | 7.4% / 4.7% | 100.0% / 100.0% | 2.9% / 2.9% | 92.6% / 95.3% | 0 / 0 |
| contradictory-direct | 30 | 11.5% / 5.8% | 100.0% / 87.5% | 5.7% / 8.6% | 88.5% / 94.2% | 0 / 0 |
| contradictory-direct | 40 | 14.7% / 9.3% | 100.0% / 83.3% | 28.6% / 17.1% | 85.3% / 90.7% | 0 / 3 |
| contradictory-direct | 50 | 17.6% / 6.7% | 100.0% / 87.5% | 48.6% / 25.7% | 82.4% / 93.3% | 0 / 0 |
| contradictory-direct | 75 | 29.8% / 10.6% | 92.9% / 90.0% | 77.1% / 42.9% | 70.2% / 89.4% | 3 / 0 |
| sparse-exact-boundary | 10 | 0.0% / 4.4% | n/a / 100.0% | 5.7% / 0.0% | 100.0% / 95.6% | 0 / 0 |
| sparse-exact-boundary | 20 | 0.7% / 5.4% | 100.0% / 100.0% | 22.9% / 2.9% | 99.3% / 94.6% | 0 / 0 |
| sparse-exact-boundary | 30 | 5.8% / 6.5% | 100.0% / 88.9% | 37.1% / 11.4% | 94.2% / 93.5% | 0 / 0 |
| sparse-exact-boundary | 40 | 8.5% / 7.0% | 100.0% / 88.9% | 45.7% / 22.9% | 91.5% / 93.0% | 0 / 0 |
| sparse-exact-boundary | 50 | 13.4% / 5.9% | 100.0% / 100.0% | 62.9% / 31.4% | 86.6% / 94.1% | 0 / 0 |
| sparse-exact-boundary | 75 | 30.9% / 8.5% | 100.0% / 100.0% | 91.4% / 48.6% | 69.1% / 91.5% | 0 / 0 |

## Findings

### Structured and boundary targets

At budget 30, adaptive direct boundary recovery versus sequential is:

- smooth tight: 52.0% versus 24.0%;
- smooth loose: 18.8% versus 0%;
- suited/offsuit anomaly: 51.1% versus 31.9%;
- pair anomaly: 36.4% versus 11.4%;
- sparse exact boundary: 37.1% versus 11.4%.

At budget 50, every structured fixture has greater adaptive attempted coverage than sequential, with adaptive attempted accuracy at 100% and zero false-high errors. The islands fixture improves boundary recovery from 48.1% to 68.5% at that budget.

### Irregular behavior

The deliberately non-local fixture is not made learnable by adaptive selection. Intermediate budgets attempt only 5.8-7.0% of held-out hands with poor medium-band accuracy, retain more than 93% abstention, and make no high-band predictions. At budget 75 it returns to 100% abstention. This is accepted honest failure behavior and is not hidden by aggregate results.

### Conflict behavior

The contradictory fixture starts both methods with the same two incompatible direct heads. The conflict remains explicit at every checkpoint and is excluded from ordinary question selection. Adaptive does not loop on that cell. At budget 75 it makes three false-high errors across three deterministic seed replications, matching the accepted 002B order of magnitude rather than claiming perfect safety.

### High-band safety

Adaptive false-high errors are zero through budget 50 across all 24 fixture/seed runs per budget. At budget 75 there are 3 errors, all in the contradictory fixture; aggregate attempted accuracy is 99.4%. This preserves the conservative 002B safety profile while improving structured coverage.

## Performance

Observed on the implementation machine with 31 repetitions:

| Operation | Median | Maximum observed |
|---|---:|---:|
| cold 169-candidate ranking | 1.28 ms | 3.30 ms |
| consume state-local ranked list | 0.001 ms | not material |
| rerank after one answer | 1.72 ms | 2.81 ms |
| progress assessment using ranked list | 0.11 ms | 1.42 ms |

The cached measurement means reuse of the already ranked list within one application state/render. Profiling did not justify a global memoization layer; the 002B snapshot cache remains the relevant source cache. Timings are regression evidence, not universal device promises.

The optimized full comparison takes approximately 14 seconds on the implementation machine. Fixed seed replications reuse the deterministic sequence because observation IDs do not affect the production inference or selection policy.

## Accepted limitations

- Synthetic mechanics evidence does not establish poker correctness, real-user uncertainty calibration, or ideal UX thresholds.
- Boundary recovery uses direct target-boundary hand discovery. It does not claim every adjacent edge is resolved or that an inferred range is exact.
- Cold-start diversity can temporarily reduce attempted coverage relative to the sequential premium prefix at 10 questions.
- The pair-anomaly target remains fully abstained through 30 adaptive questions, then becomes accurately inferable; this is safer than forcing early coverage.
- Conflict resolution, exact-frequency inference, combo-level calibration, Personal Strategy Matrix, Builder/Teacher, Training, provider integration, and postflop remain outside 002C.
- Firefox visual/manual acceptance is reported separately; structural tests do not substitute for it.
