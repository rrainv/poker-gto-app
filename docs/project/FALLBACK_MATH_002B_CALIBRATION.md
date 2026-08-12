# FALLBACK-MATH-002B calibration baseline

Date: 2026-08-12

Status: evidence baseline and reusable tooling implemented; no broad strategic
frequency tuning performed.

## Evidence policy

- **Level A**: mechanically or canonically provable.
- **Level B**: directly supported by Riverline's bounded solver or validated
  reference data inside its documented game.
- **Level C**: robust qualitative poker invariant suitable for guardrails and,
  at most, very small corrections.
- **Level D**: plausible heuristic judgment without trusted calibration.

Only the Level A defects listed below changed production behavior. There is no
validated Hold'em strategy fixture in the repository, so this ticket found no
Level B frequency correction.

## 1. Strategic-assumption inventory

| Subsystem / assumption | Current rule | Evidence | Disposition |
| --- | --- | --- | --- |
| Preflop rank scoring | High rank starts the score; pairs receive `+6`; gaps, offsuit structure, low cards, suitedness, connectivity, broadways, and wheel Aces add hand-coded terms. | D for magnitudes; C only for broad playability direction. | Characterized, not tuned. |
| Preflop positional modifiers | Non-blind values rise from UTG `-4` to BTN `+1`, with blind/action overrides. | C for later unopened widening; D for every magnitude and blind override. | Positional-widening guardrail retained. |
| Preflop anchors/interpolation | Pair and non-pair score anchors interpolate smooth open/call/fold weights. | D. Smoothness itself is a C guardrail. | Characterized, not tuned. |
| Stack-depth modifiers | Short stacks slightly favor pairs/high cards and penalize low suited connectors; deep stacks slightly favor suited connectors and lower pairs. | C for broad direction; D for size, buckets, and formula. | Tiny-boundary continuity tested; no tuning. |
| Facing-action tightness | Raise, 3-bet, and 4-bet categories progressively subtract score, with exact call commitment used when known. | C for tighter continuation under more aggression; D for formula/magnitude. Exact-price source is A. | Characterized, not tuned. |
| Known preflop call price | A trusted `callAmountBb` can move some fold mass to call; unknown price does nothing. | A for source/semantics; D for elasticity. | Price truthfulness retained. |
| Unopened passive collapse | Non-blind unopened passive mass becomes raise or fold, leaving zero passive frequency. | D. | Reported; not tuned. |
| Preflop table-size effect | `tableSize` and `opponentCount` are not inputs to the preflop formula. | A code fact; strategic adequacy is D without references. | Architectural limitation reported. |
| Preflop Play/Opponent Style | Both controls are neutral. | A product/code fact; future semantics uncalibrated. | Preserved; no invented effect. |
| Opponent combo score | Postflop candidate ranges rank pairs/high cards/suited/connective hands with a hand-coded score. | D. | Disclosed candidate-range assumption; not canonical Equity. |
| Opponent range width | Base target is 15%-45% by Opponent Style, multiplied by `0.7` after aggression and `0.9` at six or more players. Sampling is uniform inside the selected range. | D for widths/distribution. A for deterministic selection and physical card exclusion. | Measured, not tuned. |
| Opponent Style | Higher values select a wider assumed candidate range. | A for implemented direction; C for the qualitative label; D for strength and slider mapping. | Width direction tested; no redesign. |
| Play Style | Postflop only, adds at most `0.05` to aggression score. | D for magnitude/semantics; A for continuity and preflop neutrality as implemented. | Measured, not extended. |
| Postflop sampled strength | 250 deterministic trials allocate every opponent, sample runouts without replacement, use the canonical evaluator, and award exact split shares. | A for mechanics conditional on the assumed range; D for the assumed range. | Kept separate from canonical Equity. |
| Postflop hand features | Canonical rank is authoritative; Hero-specific category, draw, texture, and board-play features are heuristic. | A for canonical ordering and draw/made-hand mechanics covered by tests; D for strategic category use. | Characterized, not recalibrated. |
| Postflop category offsets | Monster through air offsets, draw offsets, wet-board adjustments, and compatibility stack-to-pot adjustments alter aggression score. | D. | Reported, not tuned. |
| Postflop thresholds/interpolation | Continuous anchors convert aggression/sample strength into bet/check or raise/call/fold frequencies. | D; C only for continuity and coherent action-family guardrails. | Boundary/normalization tests retained. |
| Position relation | No postflop position adjustment is applied because DecisionContext v1 lacks a trusted relation. | A truthful omission. | Preserved. |
| Bet/raise frequencies | Derived from the uncalibrated preflop anchors or postflop aggression interpolation. | D. | No frequency calibration. |
| Preflop sizing | Unopened raises emit safe amount-to values from 2bb to 2.5bb when below the stack cap; facing-aggression size is omitted. | A for amount-to/bounds/omission semantics; D for chosen open size. | Mechanical edge defects fixed; size not solver-calibrated. |
| Postflop sizing | Exact `amountBb` and `potFraction` are omitted. | A safe omission because legal bounds are incomplete. | Preserved. |
| Multiway sampling | Exact live opponent count is used when available; every sampled trial allocates all opponents and split shares are exact. | A for mechanics; D for shared ranges and strategy; C for the broad expectation that strength/aggression should not perversely rise with many comparable opponents. | HU/3-way/6-way diagnostic added; no equilibrium claim. |

## 2. Calibration harness

The reusable harness is under `tests/tooling` and is not a production runtime
dependency. It provides:

- exact `DecisionContext v1` evaluation through the real `StrategyProvider`;
- all 169 preflop classes with caller-selected positions, table sizes, stacks,
  facing categories, and optional exact call amounts;
- representative range summaries and optional full class action maps;
- named flop/turn/river corpora;
- price, Play Style, Opponent Style, multiway, neighbor/dominance, continuity,
  and sizing diagnostics;
- quality-gated reference comparison with L1 distance, maximum action error,
  dominant-action disagreement, and aggression/passive/fold errors;
- deterministic JSON baseline output, with non-deterministic runtime output kept
  separate.

Commands:

```powershell
node tests/tooling/run-strategy-calibration.mjs --pretty
node tests/tooling/run-strategy-calibration.mjs --full --pretty
node tests/tooling/run-strategy-calibration.mjs --runtime --runs=3 --pretty
```

## 3. Bounded-solver overlap

The bounded game is `riverline-hu-preflop-100bb/v1`: heads-up, BTN/SB versus BB,
100bb, 0.5bb/1bb blinds, no rake/ante/ClubGG contribution, exact private combos,
a fixed bounded raise tree, and a showdown-equity terminal leaf with no postflop
betting.

| Public state | DecisionContext overlap | Permitted comparison |
| --- | --- | --- |
| BTN root | Exact public pricing/position facts; fallback's 2.5bb open matches the bounded non-all-in root size. | Structural vector, while retaining explicit zero fallback mass for solver-only all-in. |
| BB facing BTN 2.5bb open | Actor, price, contribution, pot, and prior aggression overlap; fallback lacks legal raise sizes. | Fold/passive/aggression only after explicit solver-size aggregation. |
| BTN facing BB 8bb 3-bet | Public pricing facts overlap; fallback again lacks explicit legal raise sizes. | Fold/passive/aggression only. |
| Later open branch | Pricing can overlap, but fallback cannot distinguish every explicit bounded size. | Coarse families only, case by case. |
| Limp branch | Not lossless: DecisionContext v1 projects limp to `check` and does not retain the distinct 4bb branch. | Excluded. |

No comparison is extrapolated to 6-max, 9-max, other stacks, ClubGG, postflop,
or unsupported sizes.

## 4. Solver-reference quality and convergence

There is no Hold'em CFR/MCCFR trainer, trained table, fixed strategy profile, or
validated strategy fixture in the current repository. The parity JSON validates
betting transitions, not strategy. Consequently:

- Hold'em reference iterations: **0**;
- Hold'em reference runtime: **not applicable**;
- Hold'em exploitability/convergence metric: **unavailable**;
- reproducible calibration reference: **unavailable**;
- reference quality: **insufficient for calibration**.

The independent Kuhn sanity trainer is not a Hold'em reference. On this machine,
20,000 deterministic full-deal iterations took 3.489s, produced value
`-0.055555108` (known `-1/18`), NashConv `0.003215710`, and exploitability
`0.001607855`. This validates that small-game CFR sanity code converges; it says
nothing about a Riverline Hold'em policy.

Current bounded-game characterization measured 46 public nodes, 16 decision
nodes, 30 terminal nodes, and 21,216 exact-combo infosets. Local smoke timings
were 8.334ms/tree enumeration, 17.739us/legal-action call, 11.106us/sparse-equity
lookup, 10.038ms/two-deal profile evaluation, and 36.494ms/two-deal best response.
These exclude the 1,624,350 ordered deals and exact board enumeration.

## 5. Fallback-versus-reference metrics and worst HU mismatches

No metrics are reported. The machine report returns:

```json
{
  "status": "unavailable",
  "comparableRowCount": 0,
  "metrics": null,
  "worstMismatches": []
}
```

This is intentional. Reporting an accuracy percentage, L1 distance, dominant
disagreement, or worst mismatch without a validated reference would create fake
evidence.

## 6. Preflop range-shape baseline

Each of the 169 classes has equal weight in this diagnostic; these are heuristic
summaries, not solved or combo-weighted GTO ranges. Near-pure means probability
at least 95%.

| Configuration | Avg aggression | Avg passive | Avg fold | Pure-ish aggression | Pure-ish passive | Pure-ish fold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HU BTN, 100bb, unopened | 0.574941 | 0.000000 | 0.425059 | 33 | 0 | 54 |
| 6-max UTG, 100bb, unopened | 0.257375 | 0.000000 | 0.742625 | 3 | 0 | 95 |
| 6-max BTN, 100bb, unopened | 0.574941 | 0.000000 | 0.425059 | 33 | 0 | 54 |
| 9-max UTG, 100bb, unopened | 0.257375 | 0.000000 | 0.742625 | 3 | 0 | 95 |
| 9-max BTN, 100bb, unopened | 0.574941 | 0.000000 | 0.425059 | 33 | 0 | 54 |
| 6-max BTN, 30bb, unopened | 0.576245 | 0.000000 | 0.423755 | 33 | 0 | 53 |
| 6-max BTN, 200bb, unopened | 0.575193 | 0.000000 | 0.424807 | 33 | 0 | 54 |
| 6-max BB, 100bb, facing 2.5bb open | 0.308473 | 0.191417 | 0.500110 | 0 | 0 | 58 |
| 6-max BTN, 100bb, facing 8bb 3-bet | 0.277304 | 0.185171 | 0.537526 | 0 | 0 | 59 |

The full machine report includes all 169 classes ordered by aggression. A notable
Level D shape is saturation: several medium/high pairs tie at the top BTN anchor.
Another is zero passive mass for every non-blind unopened class. Neither was
tuned without trusted range evidence.

## 7. Robust preflop anomalies

Across BTN unopened, BB facing an open, and BTN facing a 3-bet:

- material premium-versus-trash fold inversions: 0;
- material stronger-pair-versus-lower-pair continuation inversions: 0;
- suited-versus-offsuit material continuation inversions: 0;
- global positional-widening inversions from UTG through BTN: 0;
- maximum action-probability change across a 0.002bb boundary sweep: `3.60228e-7`.

The diagnostic deliberately does not impose global hand-strength monotonicity;
blockers, action mixing, and range construction can make such a rule false.

## 8. Postflop corpus baseline

All rows used Play Style 0 and Opponent Style 0. The range fraction is the actual
uniformly sampled selected share of unblocked combos. No exact size is emitted.

| Spot | Canonical / strategic | Draw | Sampled share | Dominant | Aggression / passive / fold | Opponents | Range fraction |
| --- | --- | --- | ---: | --- | --- | ---: | ---: |
| Flop nut straight | straight / monster | - | 0.892 | bet | 1.000 / 0.000 / 0.000 | 1 | 0.1499 |
| Dry-flop overpair | one pair / overpair | - | 0.838 | bet | 1.000 / 0.000 / 0.000 | 1 | 0.1499 |
| Dry-flop top pair | one pair / top pair | - | 0.882 | bet | 1.000 / 0.000 / 0.000 | 1 | 0.1499 |
| Middle pair | one pair / middle pair | - | 0.542 | check | 0.423 / 0.577 / 0.000 | 1 | 0.1499 |
| Weak pair | one pair / weak pair | - | 0.168 | check | 0.100 / 0.900 / 0.000 | 1 | 0.1499 |
| Nut flush draw | high card / flush draw | NFD | 0.522 | check | 0.490 / 0.510 / 0.000 | 1 | 0.1499 |
| Open-ended draw | high card / air plus draw feature | OESD | 0.378 | check | 0.080 / 0.920 / 0.000 | 1 | 0.1499 |
| Dry-flop air | high card / air | - | 0.154 | check | 0.000 / 1.000 / 0.000 | 1 | 0.1499 |
| Top pair facing small bet | one pair / top pair | - | 0.846 | raise | 0.930 / 0.070 / 0.000 | 1 | 0.1045 |
| Air facing large bet | high card / air | - | 0.160 | fold | 0.000 / 0.000 / 1.000 | 1 | 0.1045 |
| Turn two pair | two pair / two pair | - | 0.790 | bet | 1.000 / 0.000 / 0.000 | 2 | 0.1498 |
| Turn nut flush draw | high card / flush draw | NFD | 0.303 | check | 0.250 / 0.750 / 0.000 | 2 | 0.1498 |
| River plays board | straight flush / board-made air category | - | 0.500 | check | 0.217 / 0.783 / 0.000 | 1 | 0.1495 |
| River top pair facing bet | one pair / top pair | - | 0.870 | raise | 0.850 / 0.150 / 0.000 | 1 | 0.1040 |

No Level A action-family/allocation defect or clear Level C stronger-made-hand
fold inversion appeared in this corpus. Exact frequencies, category offsets,
range assumptions, and the OESD taxonomy remain Level D calibration unknowns.

## 9. Price response

With pot fixed at 10bb, nominal facing context fixed, and only trusted call price
swept through 0.5/1/2/5/10/20bb:

- air sampled share stayed 0.130; fold rose from 0.0219 to 1.000;
- nut-flush-draw sampled share stayed 0.460; fold stayed 0 through 5bb, then
  rose to 0.784 at 10bb and 1.000 at 20bb;
- set sampled share stayed 0.924; fold stayed 0 and aggression stayed 1.000;
- weak-hand fold-direction anomalies: 0.

Cheap prices did not force every weak hand to defend, expensive prices did not
increase weak-hand calls, and premium behavior remained coherent. Elasticity is
still Level D rather than solver-validated.

## 10. Style controls

Opponent Style 0/0.25/0.5/0.75/1 widened the actual candidate range monotonically
from 0.14986 to 0.44958. Adjacent action-vector changes in the diagnostic spot
were 3.3-9.0 percentage points. Sampled strength was non-monotone because
Opponent Style also participates in the deterministic sample seed; those values
mix sampling noise with range effects and are not causal calibration evidence.

Play Style 0 to 1 left the sampled share exactly unchanged, increased aggression
score by exactly 0.05, and shifted aggression probability by 7.667 percentage
points in the selected OESD spot. All distributions normalized. It did not
overpower hand strength in the named corpus and remains neutral preflop.

## 11. Multiway

| Players | Sampled Hero share | Aggression | Passive | Fold | 250-trial runtime |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 0.8740 | 1.0000 | 0.0000 | 0.0000 | 55.1ms |
| 3 | 0.7920 | 1.0000 | 0.0000 | 0.0000 | 99.9ms |
| 6 | 0.5793 | 0.7311 | 0.2689 | 0.0000 | 174.7ms |

Every row completed 250 fully allocated trials and normalized to 1. Sampled
strength and aggression moved in the expected broad direction. This is a
heuristic multiway diagnostic, not multiplayer equilibrium evidence.

## 12. Sizing findings and objective defects fixed

The post-fix scan found no negative, over-stack, impossible amount-to, or
label/type mismatch. Explicit unopened preflop raise-to values observed were
2bb, 2.037bb, and 2.5bb. Facing-aggression preflop sizes and all postflop sizes
remain omitted because DecisionContext does not prove complete legal bounds.

Level A fixes:

1. An unopened action consuming an exact 2bb stack is now structural `all_in`,
   not a raise-to equal to the stack cap.
2. Short-stack structural all-ins use the existing localized label `All-In`,
   not `Open`.
3. When exact preflop call amount plus Hero street contribution proves that a
   call reaches the stack cap, unavailable raise mass is projected to call and
   no illegal raise is emitted.
4. At the HU root, canonical BTN is also the small blind, so its passive action
   is labeled `Limp` rather than `Call`.

No anchor, score, style, opponent-range, or general frequency parameter changed.

## 13. Architecture conclusion

One global preflop parameterization is too coarse as a future calibrated
fallback. HU BTN, 6-max BTN, and 9-max BTN are exactly identical at 100bb
unopened; 6-max UTG and 9-max UTG are also identical. This follows directly from
the code: preflop does not consume table size or opponent count. The 30/100/200bb
BTN averages also differ by less than 0.14 percentage points, despite the very
different games those depths can create.

Future calibration should use explicit anchor families keyed by at least:

- table-size bucket (HU, short-handed, full-ring);
- stack bucket;
- action family (unopened, facing open, facing 3-bet, later aggression).

This ticket does not implement a giant parameter table. Anchor families need
documented reference provenance, testable interpolation, and configuration-local
parameters so a bounded HU result cannot silently retune 6-max or 9-max.

## 14. Recommended bounded-solver role

Once a Hold'em trainer and sufficiently converged profiles exist, use the bounded
solver as:

1. a regression oracle for only `riverline-hu-preflop-100bb/v1`;
2. a reproducible dataset generator with abstraction/leaf/convergence metadata;
3. a sanity checker for exact overlapping public states;
4. a possible source for the HU/100bb/action-family anchor, never a universal
   fallback parameter source.

Do not connect it to production runtime. Keep exact-size strategies until an
explicit adapter aggregates them, and preserve its showdown-equity leaf warning.

## 15. FALLBACK-MATH-002B decision

**D: no further fallback tuning until solver/reference data improves.**

The current evidence can prove mechanics and expose an architectural inability
to distinguish configurations, but it cannot identify better frequencies. The
next architecture after trustworthy multi-configuration data exists should be
the option-B anchor-family redesign; targeted HU tuning of shared global
parameters would risk degrading unsupported 6-max/9-max contexts.

## 16. Performance

Three full summary-report runs took 4,975.8ms, 4,265.4ms, and 3,390.7ms (mean
4,210.6ms). This is tooling runtime only. No tooling module is imported by the
browser. Production adds only narrow preflop action-boundary comparisons and no
sampling, solver, I/O, or Python dependency; interactive performance is
preserved.

## 17. Verification

Results on 2026-08-12:

- `node --test tests/*.test.js tests/*.test.mjs`: **694 passed, 0 failed**;
- `$env:PYTHONPATH='solver;.'; python -B -m unittest discover -s tests/solver -p 'test_*.py'`:
  **26 passed, 0 failed**;
- `node --check app/src/core/logic.js`: passed;
- `node --check app/main.js`: passed;
- all three new calibration `.mjs` tooling files: syntax checks passed;
- `git diff --check -- app shared solver tests docs README.md`: passed (Git
  emitted only the existing Windows LF/CRLF working-copy warning);
- the dedicated calibration/preflop run passed 19/19 tests before the full
  suite.

## 18. QA/product backlog preservation

This ticket does not implement or remove any known product/QA backlog item. The
preserved backlog is:

- Action Path clipping/shadows;
- Betting Context size/alignment;
- Matrix readability;
- analysis-tab placement;
- table card corners / 10 rendering;
- Facing Size lag;
- Equity spacing/street labels/ETA/throughput;
- Training clipping and post-answer design;
- Daylight black inputs;
- badges/pills;
- Settings icon;
- teacher renderer;
- Guide;
- i18n diagnostics;
- multi-resolution desktop QA;
- future mobile composition;
- replay;
- richer table/dealer/chips;
- saved/bookmarked spots;
- Training filters/mistake review;
- Range Builder/Profiler;
- weighted range analysis;
- range-vs-range Equity;
- session review/history/comparison;
- poker math tools;
- keyboard expert mode;
- beginner/expert modes.
