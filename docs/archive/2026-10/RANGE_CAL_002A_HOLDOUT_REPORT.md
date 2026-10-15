# RANGE-CAL-002A sparse RFI inference holdout report

Status: synthetic holdout evidence for `RANGE-CAL-002A`

Date: August 14, 2026

Model: `sparse-rfi-local-neighbors/v1`

## Scope and interpretation

All truth ranges in this report are synthetic evaluation instruments. They are not GTO charts, solver output, poker truth, or production strategy references. The experiment measures whether a transparent local-similarity rule can recover hidden dominant Fold/Raise labels from sparse direct observations without receiving the hidden labels.

The result is promising for locally structured ranges and deliberately limited for irregular ranges. From 30, 40, and 50 answers, the proposed method covers 49.6%, 60.0%, and 64.3% of eligible holdouts at 89.5%, 89.4%, and 91.0% accuracy among attempted predictions. It does not solve the deliberately non-monotonic fixture: it abstains on 72.2% to 80.1% of those holdouts at 30–50 answers, but the predictions it still attempts remain near chance. This limitation must not be hidden by aggregate results or converted into user-facing certainty.

## Method

Each hand class is represented by pair/suited/offsuit kind, high- and low-rank indices, and rank gap. Distance is rank-index Manhattan distance plus a 0.75 suited/offsuit penalty, a 1.5 pair/non-pair penalty, and a small gap-difference penalty.

For an unanswered hand, the method:

1. materializes at most one current direct leaf per logical key;
2. keeps only the exact profile, mode, and canonical context;
3. gives an exact direct leaf precedence;
4. excludes retracted, unsupported, and tied observations from categorical voting;
5. treats a tied observation within distance 1.25 as boundary evidence requiring abstention;
6. selects 3–9 categorical neighbors within distance 4.25 and within 1.5 of the closest neighbor;
7. weights each selected neighbor by `1 / (1 + distance)^2`;
8. requires at least two winning observations and normalized support-weight difference of at least 0.40;
9. otherwise abstains.

The support difference is an internal deterministic diagnostic, not calibrated confidence and not an action frequency.

## Holdout design

- Fixtures: smooth baseline, tight, loose, boundary-heavy, irregular/non-monotonic, exploitative/gapped, and tied/mixed boundary.
- Answer counts: 10, 20, 30, 40, 50, 75, and 100.
- Fixed seeds: 11, 29, 47, 71, and 97.
- Each fixture/answer-count row below aggregates five independent deterministic subsets.
- Visible observations are newly constructed from only the selected direct subset.
- Prediction generation receives visible observations and requested hand classes, but no fixture object or hidden action labels.
- Hidden categorical labels enter only after prediction, in the scoring function.
- Tied hidden cells are not categorical scoring targets; visible tied cells remain truthful boundary evidence.

Metrics use eligible categorical holdouts. Coverage is attempted predictions divided by eligible holdouts. Attempted accuracy excludes abstentions. Total held-out accuracy counts abstentions as unresolved. Boundary errors are incorrect predictions whose orthogonally adjacent matrix cells contain a different synthetic label.

## Proposed method: fixture-specific quality curves

| Fixture | Answers | Holdouts | Attempted | Abstained | Coverage | Correct | Incorrect | Attempted accuracy | Total held-out accuracy | Error rate | Boundary errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| boundary-heavy | 10 | 795 | 148 | 647 | 18.6% | 133 | 15 | 89.9% | 16.7% | 10.1% | 12 |
| boundary-heavy | 20 | 745 | 281 | 464 | 37.7% | 252 | 29 | 89.7% | 33.8% | 10.3% | 26 |
| boundary-heavy | 30 | 695 | 401 | 294 | 57.7% | 364 | 37 | 90.8% | 52.4% | 9.2% | 33 |
| boundary-heavy | 40 | 645 | 424 | 221 | 65.7% | 387 | 37 | 91.3% | 60.0% | 8.7% | 35 |
| boundary-heavy | 50 | 595 | 436 | 159 | 73.3% | 394 | 42 | 90.4% | 66.2% | 9.6% | 40 |
| boundary-heavy | 75 | 470 | 372 | 98 | 79.1% | 340 | 32 | 91.4% | 72.3% | 8.6% | 31 |
| boundary-heavy | 100 | 345 | 266 | 79 | 77.1% | 257 | 9 | 96.6% | 74.5% | 3.4% | 8 |
| exploitative-gapped | 10 | 795 | 110 | 685 | 13.8% | 84 | 26 | 76.4% | 10.6% | 23.6% | 12 |
| exploitative-gapped | 20 | 745 | 210 | 535 | 28.2% | 175 | 35 | 83.3% | 23.5% | 16.7% | 26 |
| exploitative-gapped | 30 | 695 | 297 | 398 | 42.7% | 262 | 35 | 88.2% | 37.7% | 11.8% | 33 |
| exploitative-gapped | 40 | 645 | 373 | 272 | 57.8% | 321 | 52 | 86.1% | 49.8% | 13.9% | 48 |
| exploitative-gapped | 50 | 595 | 356 | 239 | 59.8% | 319 | 37 | 89.6% | 53.6% | 10.4% | 34 |
| exploitative-gapped | 75 | 470 | 307 | 163 | 65.3% | 276 | 31 | 89.9% | 58.7% | 10.1% | 29 |
| exploitative-gapped | 100 | 345 | 237 | 108 | 68.7% | 217 | 20 | 91.6% | 62.9% | 8.4% | 19 |
| irregular-non-monotonic | 10 | 795 | 66 | 729 | 8.3% | 29 | 37 | 43.9% | 3.6% | 56.1% | 37 |
| irregular-non-monotonic | 20 | 745 | 109 | 636 | 14.6% | 54 | 55 | 49.5% | 7.2% | 50.5% | 55 |
| irregular-non-monotonic | 30 | 695 | 138 | 557 | 19.9% | 66 | 72 | 47.8% | 9.5% | 52.2% | 72 |
| irregular-non-monotonic | 40 | 645 | 179 | 466 | 27.8% | 80 | 99 | 44.7% | 12.4% | 55.3% | 99 |
| irregular-non-monotonic | 50 | 595 | 154 | 441 | 25.9% | 75 | 79 | 48.7% | 12.6% | 51.3% | 79 |
| irregular-non-monotonic | 75 | 470 | 125 | 345 | 26.6% | 56 | 69 | 44.8% | 11.9% | 55.2% | 69 |
| irregular-non-monotonic | 100 | 345 | 84 | 261 | 24.3% | 28 | 56 | 33.3% | 8.1% | 66.7% | 56 |
| loose | 10 | 795 | 138 | 657 | 17.4% | 125 | 13 | 90.6% | 15.7% | 9.4% | 8 |
| loose | 20 | 745 | 284 | 461 | 38.1% | 258 | 26 | 90.8% | 34.6% | 9.2% | 21 |
| loose | 30 | 695 | 371 | 324 | 53.4% | 340 | 31 | 91.6% | 48.9% | 8.4% | 24 |
| loose | 40 | 645 | 424 | 221 | 65.7% | 393 | 31 | 92.7% | 60.9% | 7.3% | 27 |
| loose | 50 | 595 | 432 | 163 | 72.6% | 406 | 26 | 94.0% | 68.2% | 6.0% | 24 |
| loose | 75 | 470 | 364 | 106 | 77.4% | 351 | 13 | 96.4% | 74.7% | 3.6% | 12 |
| loose | 100 | 345 | 288 | 57 | 83.5% | 282 | 6 | 97.9% | 81.7% | 2.1% | 6 |
| smooth-baseline | 10 | 795 | 152 | 643 | 19.1% | 127 | 25 | 83.6% | 16.0% | 16.4% | 17 |
| smooth-baseline | 20 | 745 | 316 | 429 | 42.4% | 284 | 32 | 89.9% | 38.1% | 10.1% | 23 |
| smooth-baseline | 30 | 695 | 405 | 290 | 58.3% | 377 | 28 | 93.1% | 54.2% | 6.9% | 22 |
| smooth-baseline | 40 | 645 | 436 | 209 | 67.6% | 410 | 26 | 94.0% | 63.6% | 6.0% | 19 |
| smooth-baseline | 50 | 595 | 431 | 164 | 72.4% | 408 | 23 | 94.7% | 68.6% | 5.3% | 21 |
| smooth-baseline | 75 | 470 | 393 | 77 | 83.6% | 376 | 17 | 95.7% | 80.0% | 4.3% | 17 |
| smooth-baseline | 100 | 345 | 295 | 50 | 85.5% | 282 | 13 | 95.6% | 81.7% | 4.4% | 12 |
| tied-mixed-boundary | 10 | 721 | 120 | 601 | 16.6% | 119 | 1 | 99.2% | 16.5% | 0.8% | 1 |
| tied-mixed-boundary | 20 | 675 | 255 | 420 | 37.8% | 242 | 13 | 94.9% | 35.9% | 5.1% | 10 |
| tied-mixed-boundary | 30 | 629 | 343 | 286 | 54.5% | 323 | 20 | 94.2% | 51.4% | 5.8% | 14 |
| tied-mixed-boundary | 40 | 587 | 370 | 217 | 63.0% | 353 | 17 | 95.4% | 60.1% | 4.6% | 10 |
| tied-mixed-boundary | 50 | 541 | 393 | 148 | 72.6% | 378 | 15 | 96.2% | 69.9% | 3.8% | 10 |
| tied-mixed-boundary | 75 | 428 | 329 | 99 | 76.9% | 320 | 9 | 97.3% | 74.8% | 2.7% | 6 |
| tied-mixed-boundary | 100 | 314 | 255 | 59 | 81.2% | 250 | 5 | 98.0% | 79.6% | 2.0% | 3 |
| tight | 10 | 795 | 202 | 593 | 25.4% | 196 | 6 | 97.0% | 24.7% | 3.0% | 5 |
| tight | 20 | 745 | 322 | 423 | 43.2% | 307 | 15 | 95.3% | 41.2% | 4.7% | 11 |
| tight | 30 | 695 | 424 | 271 | 61.0% | 398 | 26 | 93.9% | 57.3% | 6.1% | 17 |
| tight | 40 | 645 | 466 | 179 | 72.2% | 444 | 22 | 95.3% | 68.8% | 4.7% | 15 |
| tight | 50 | 595 | 440 | 155 | 73.9% | 423 | 17 | 96.1% | 71.1% | 3.9% | 12 |
| tight | 75 | 470 | 400 | 70 | 85.1% | 393 | 7 | 98.3% | 83.6% | 1.8% | 7 |
| tight | 100 | 345 | 311 | 34 | 90.1% | 309 | 2 | 99.4% | 89.6% | 0.6% | 2 |

## Aggregate baseline comparison

These rows aggregate all seven fixtures and five seeds at each answer count.

| Method | Answers | Holdouts | Attempted | Abstained | Coverage | Correct | Incorrect | Attempted accuracy | Total held-out accuracy | Error rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| abstain-everywhere | 10 | 5491 | 0 | 5491 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 10 | 5491 | 5491 | 0 | 100.0% | 4104 | 1387 | 74.7% | 74.7% | 25.3% |
| sparse-local-neighbors | 10 | 5491 | 936 | 4555 | 17.0% | 813 | 123 | 86.9% | 14.8% | 13.1% |
| visible-majority | 10 | 5491 | 4393 | 1098 | 80.0% | 2415 | 1978 | 55.0% | 44.0% | 45.0% |
| abstain-everywhere | 20 | 5145 | 0 | 5145 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 20 | 5145 | 5145 | 0 | 100.0% | 4052 | 1093 | 78.8% | 78.8% | 21.2% |
| sparse-local-neighbors | 20 | 5145 | 1777 | 3368 | 34.5% | 1572 | 205 | 88.5% | 30.6% | 11.5% |
| visible-majority | 20 | 5145 | 4102 | 1043 | 79.7% | 2398 | 1704 | 58.5% | 46.6% | 41.5% |
| abstain-everywhere | 30 | 4799 | 0 | 4799 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 30 | 4799 | 4799 | 0 | 100.0% | 3916 | 883 | 81.6% | 81.6% | 18.4% |
| sparse-local-neighbors | 30 | 4799 | 2379 | 2420 | 49.6% | 2130 | 249 | 89.5% | 44.4% | 10.5% |
| visible-majority | 30 | 4799 | 4382 | 417 | 91.3% | 2570 | 1812 | 58.6% | 53.6% | 41.4% |
| abstain-everywhere | 40 | 4457 | 0 | 4457 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 40 | 4457 | 4457 | 0 | 100.0% | 3693 | 764 | 82.9% | 82.9% | 17.1% |
| sparse-local-neighbors | 40 | 4457 | 2672 | 1785 | 60.0% | 2388 | 284 | 89.4% | 53.6% | 10.6% |
| visible-majority | 40 | 4457 | 3941 | 516 | 88.4% | 2334 | 1607 | 59.2% | 52.4% | 40.8% |
| abstain-everywhere | 50 | 4111 | 0 | 4111 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 50 | 4111 | 4111 | 0 | 100.0% | 3447 | 664 | 83.8% | 83.8% | 16.2% |
| sparse-local-neighbors | 50 | 4111 | 2642 | 1469 | 64.3% | 2403 | 239 | 91.0% | 58.5% | 9.0% |
| visible-majority | 50 | 4111 | 3635 | 476 | 88.4% | 2155 | 1480 | 59.3% | 52.4% | 40.7% |
| abstain-everywhere | 75 | 3248 | 0 | 3248 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 75 | 3248 | 3248 | 0 | 100.0% | 2788 | 460 | 85.8% | 85.8% | 14.2% |
| sparse-local-neighbors | 75 | 3248 | 2290 | 958 | 70.5% | 2112 | 178 | 92.2% | 65.0% | 7.8% |
| visible-majority | 75 | 3248 | 3162 | 86 | 97.4% | 1835 | 1327 | 58.0% | 56.5% | 42.0% |
| abstain-everywhere | 100 | 2384 | 0 | 2384 | 0.0% | 0 | 0 | n/a | 0.0% | n/a |
| nearest-observation | 100 | 2384 | 2384 | 0 | 100.0% | 2061 | 323 | 86.5% | 86.5% | 13.5% |
| sparse-local-neighbors | 100 | 2384 | 1736 | 648 | 72.8% | 1625 | 111 | 93.6% | 68.2% | 6.4% |
| visible-majority | 100 | 2384 | 2108 | 276 | 88.4% | 1270 | 838 | 60.2% | 53.3% | 39.8% |

## Failure analysis

- Nearest observation wins on total held-out accuracy because it predicts every cell. The proposed method instead reduces attempted error by abstaining: at 30–50 answers its attempted error is 9.0%–10.6%, versus 16.2%–18.4% for nearest observation.
- The aggregate total held-out accuracy of the proposed method remains below nearest observation because abstentions count as unresolved. This tradeoff is intentional and must remain visible.
- The irregular fixture is a negative result. Local evidence cannot reconstruct its deliberately non-local pattern, and attempted accuracy remains 33.3%–49.5% across the curve. The method avoids filling most cells but does not identify every unsafe local coincidence.
- The exploitative/gapped fixture is partially recoverable: at 30–50 answers coverage is 42.7%–59.8% and attempted accuracy is 86.1%–89.6%. Most errors are on synthetic boundaries.
- Errors concentrate near boundaries. For the smooth fixture at 30–50 answers, 19–22 of 23–28 errors are boundary errors. For the exploitative/gapped fixture, 33–48 of 35–52 errors are boundary errors.
- The tied-boundary fixture shows that tied evidence can suppress unsafe local predictions without being converted into Fold or Raise labels.

## Representative performance

Measured in Node on the development machine after the final threshold selection:

| Work | Runtime |
|---|---:|
| One requested hand, median over 101 calls | 0.156 ms |
| One requested hand, observed min–max | 0.102–0.573 ms |
| All 129 unanswered cells with 40 visible observations | 76.6 ms |
| Complete 7 fixtures × 7 counts × 5 seeds × 4 methods matrix | 22.58 s |

The complete matrix contains 980 aggregate run records and tens of thousands of individual holdout predictions. No worker is justified by these measurements for the isolated, on-demand inference operation. The evaluation harness is intentionally outside the production dependency graph.

## Reproduction

```powershell
node --test tests/range_cal002a_sparse_rfi_inference.test.mjs
node tests/tooling/evaluate_range_cal002a.mjs
```

Use `--full` on the evaluation command to include every seed-level record in the JSON output.

## Recommendation

Proceed to `RANGE-CAL-002B` for calibrated confidence/validation, but do not integrate inferred values into Matrix, StrategyProvider, or live question selection. `002B` should treat irregular/local-coincidence detection and boundary errors as primary calibration failures. It should preserve abstention and must not convert the internal support-weight difference into user confidence.
