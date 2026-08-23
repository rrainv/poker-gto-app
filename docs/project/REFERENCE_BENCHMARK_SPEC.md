# External reference benchmark v1

Status: `REFERENCE-BENCH-001` research and validation tooling.

## 1. Purpose and boundary

The external reference benchmark measures how Riverline differs from a legitimately
available poker reference. It accepts manual observations, public references,
Riverline-owned data, licensed data, and independent solver output. GTO Wizard is
the first intended manual source, but no source name is embedded in the benchmark
logic.

The dependency direction is:

```text
local/external observation JSON
              +
DecisionContext v1.1 -> StrategyProvider v1 -> StrategyResult v1
              +
optional canonical Equity or heuristic sample
              |
              v
tests/tooling reference benchmark -> deterministic report
```

Everything is under `tests/tooling` and `tests/fixtures`. Browser, Electron,
StrategyProvider, StrategyResult, and canonical Equity do not import it. External
observations are research evidence, not application strategy data. The runner does
not tune the heuristic and the report sets `productionReferencePack: false` and
`automaticRetuning: false`.

## 2. Versioned observation pack

The input discriminator is:

```json
{ "schemaVersion": "riverline-reference-benchmark-input/v1" }
```

A pack contains one source and one or more nodes. Each node contains shared game
assumptions, one Riverline `DecisionContext v1.1`, a context-match declaration,
and one or more hand observations.

### Source and provenance

Required source facts are:

- stable source ID and product name;
- type: `manually_observed`, `public_reference`, `riverline_owned`, `licensed`,
  or `independent_solver`;
- observation date and visible solution/version label when available;
- a provenance note explaining who or what produced the values;
- redistribution status and storage policy.

`private_not_for_redistribution` plus `external_local_file` is the normal setting
for a user's manual observation from a paid product. A repository fixture must be
Riverline-owned synthetic data or otherwise clearly redistributable.

### Game assumptions

Both `referenceContext` and `riverline.gameAssumptions` record:

- game type, table size, ordered positions, stack depth;
- blinds, ante, rake, and cash/tournament format;
- prior action tree with raw labels, canonical families, and exact sizes;
- available reference sizes;
- street, board, current pot, call amount, and effective stack;
- legal action families and sizes.

The separate `riverline.decisionContext` is the exact application input used to
resolve Riverline. Game-assumption fields outside DecisionContext are not inferred
from lossy state.

### Hand identity

Each observation is exactly one of:

- `preflop_169_class`: carries a canonical class such as `AJs` and an explicit
  representative Riverline combo;
- `exact_combo`: carries two exact cards and no 169-class claim;
- `postflop_exact_combo`: carries two exact cards and is rejected preflop.

An `AJs` preflop observation is not treated as every exact suited ace-jack combo
postflop. Optional `rangeWeight` is retained for reference-weighted node metrics;
it is not reinterpreted as confidence or action frequency.

## 3. Context provenance and match gate

The collector declares one of `exact`, `mapped`, `approximate`, or `unknown`.
The benchmark independently compares every required game-assumption dimension and
returns one of:

| Outcome | Numerical strategy | Numerical equity | Meaning |
|---|---:|---:|---|
| `EXACT` | yes | yes | Every required fact is known and equal. |
| `USABLE_MAPPED` | level 1/2 only | no | Only explicitly recorded, verified stack/price/tree/size mappings differ. |
| `DIRECTIONAL_ONLY` | no | no | A required fact is unknown or the approximation is not a safe mapped comparison. |
| `INCOMPARABLE` | no | no | A critical fact differs, coverage is unsupported, or an exact claim is false. |

Critical comparisons include game type, table size, ordered positions, ante,
rake, format, street, board, and legal action families. Bounded mappings may
cover stack depth, blinds, action-tree amounts, available sizes, pot, call amount,
effective stack, and legal-action sizes. Every mapped discrepancy must carry the
actual Riverline value, reference solution value, and a note. An unverified or
incomplete mapping falls back to `DIRECTIONAL_ONLY`.

Unknown rake, pot, price, or effective stack prevents an exact result. A reference
node explicitly marked unsupported is `INCOMPARABLE`; the runner never fills it
from another game family.

### GTO Wizard-specific capture caution

Study and Analyzer output can come from a presolved solution whose stack or action
size is the nearest available match rather than the original hand's exact value.
Every manual observation must record the visible solution assumptions. For example:

```json
{
  "kind": "mapped",
  "mappings": [{
    "field": "actionTree[0].size.value",
    "riverlineValue": 2.5,
    "referenceValue": 2.3,
    "note": "Original open 2.5bb; displayed presolved reference node uses 2.3bb."
  }]
}
```

Do not compare that node as exact. If the product omits a multiway or postflop
solution family, record `referenceCoverage: "unsupported"`.

## 4. Raw actions and normalization

Every reference action retains:

- the visible raw label;
- frequency and whether the unit is percent or probability;
- explicit canonical type used by the comparison projection;
- size and basis (`amount_to_bb`, `pot_fraction`, or `stack_fraction`) when visible;
- action EV when visible.

Raw records are copied unchanged into the report before normalization. Percent or
probability mass need only be positive; the report records its original total and
the applied normalization factor.

The same observation is projected at three levels:

1. `FOLD / PASSIVE_CONTINUE / AGGRESSION`;
2. `FOLD / CHECK / CALL / BET / RAISE / ALL_IN`;
3. exact size keys such as `BET@pot_fraction:0.25`.

Level 3 requires an exact context and explicit sizes for every positive aggressive
action on both sides. Current Riverline postflop strategy is unsized, so a visible
reference bet size remains raw evidence while level 3 is blocked. Level 1 or 2
does not pretend that this sizing precision exists.

## 5. Strategy metrics

For comparable rows, with Riverline distribution `P` and reference distribution
`Q`, total variation distance is:

```text
TVD(P,Q) = 0.5 * sum_a |P(a) - Q(a)|
```

Each level also reports:

- dominant-action agreement and reference-dominant action delta;
- signed Fold, passive, aggression, and continuation bias (`Riverline - reference`);
- per-action absolute and signed frequency deltas;
- maximum action delta;
- level-3 sizing-distribution TVD when available.

Node and whole-pack aggregates report mean, median, p90, and p95 TVD, dominant
agreement rate, aggression bias, and continuation bias. When `rangeWeight` exists,
the report adds separate weighted means, weighted percentiles, and weighted
agreement/bias values. It never emits a synthetic “GTO score.”

## 6. Equity and sampling metrics

Equity stays separate from action frequency. A reference and Riverline equity are
numeric-comparable only when:

1. the context gate is `EXACT`;
2. both values exist; and
3. their complete semantics match.

Semantics include equity share, exact-combo versus range populations, range IDs,
weighting, opponent count, board/runout treatment, and split-pot treatment. Thus
combo-versus-sampled-range equity cannot be compared to whole-range equity merely
because both are percentages.

Comparable rows report absolute and signed equity delta. Aggregates report
mean/median/p95 absolute delta and mean signed directional bias.

The optional Riverline equity source is either:

- `heuristic_conditional_sample`: the sample already consumed by the postflop
  heuristic; or
- `canonical_equity_service`: an explicit `equity-request/v1` plus Hero player ID.

Heuristic metadata includes requested/attempted/completed trials, opponent range
assumption and uniform selected-combo construction, selected/unblocked combo counts,
opponent count/source, deterministic seed family, and heuristic evaluator path.
Canonical Equity metadata includes method, exactness, trials, unknown-player
construction, seed, and canonical evaluator path. These paths remain visibly
different in the report.

## 7. Diagnostic classification

The lightweight diagnostic layer uses fixed report-visible hints:

- strategy is “far” at level-1 TVD `>= 0.25`;
- equity is “close” at absolute delta `<= 0.03`.

Possible primary results include:

- `EQUITY_CLOSE_STRATEGY_FAR`: inspect policy/transformation first;
- `EQUITY_FAR_STRATEGY_FAR`: range, sampling, or evaluator may be upstream;
- `EQUITY_FAR_STRATEGY_CLOSE`: possible compensating policy behavior;
- `ACTION_SUPPORT_MISMATCH`: reference action/sizing is unsupported;
- `CONTEXT_MISMATCH`: the comparison gate blocks inference;
- close/close and equity-unavailable variants for complete reporting.

These thresholds prioritize investigation. Every diagnosis sets `proof: false`.
Nothing automatically retunes a frequency.

## 8. Spot checks, nodes, and report shape

A node can contain one observation for a spot check, selected combos, a legitimate
169-class preflop matrix, or a complete licensed/owned range. No minimum matrix is
required. The report contains full evidence rows plus a compact discrepancy table:

```text
id   hand  context  TVD   Riverline dominant  reference dominant  equity delta  diagnosis
```

Every row also answers:

- what the reference does;
- where Riverline differs;
- whether equity also differs;
- which layer is a likely investigation target;
- what to investigate next;
- what must not be concluded.

## 9. Manual capture workflow

1. Copy `tests/tooling/reference-bench-capture-template.json` to a private local
   path outside the repository.
2. Choose the exact visible reference solution and record its label/date.
3. Record table, blinds/ante/rake, ordered seats, stack, and every visible action
   size before navigating the action tree.
4. Record original-to-solution mapping immediately if Analyzer or another tool
   selects a nearby stack/size.
5. Record street, board, pot, call amount, effective stack, and legal actions.
6. Paste the corresponding exact `DecisionContext v1.1` and Riverline assumptions.
7. For each hand/combo, enter range weight, raw action labels/frequencies/sizes,
   optional EV, equity, and EQR. Do not make up missing values.
8. Declare equity semantics separately for the reference and Riverline. If they
   are not identical quantities, leave the comparison blocked.
9. Run the CLI and review context limitations before reading TVD or diagnosis.

The template deliberately contains `REPLACE` placeholders and an `unknown` match.
It does not contain GTO Wizard values.

## 10. CLI

Input may be an arbitrary local path; no repository copy is required:

```powershell
node tests/tooling/run-reference-bench.mjs --input C:\private\riverline\capture.json --pretty
```

Without `--output`, machine JSON goes to stdout and the concise summary goes to
stderr. To save JSON and print only the summary:

```powershell
node tests/tooling/run-reference-bench.mjs `
  --input C:\private\riverline\capture.json `
  --output C:\private\riverline\report.json `
  --pretty
```

The output discriminator is `riverline-reference-benchmark-report/v1`. It has no
runtime timestamp or duration, so identical code and input produce identical JSON.

## 11. Synthetic example

The repository-owned fixture is
`tests/fixtures/reference-bench001-synthetic.json`. Its frequencies are invented
to test mechanics and are not poker truth. A shortened result is:

```text
CONTEXT hu_btn_rfi_100bb_synthetic: EXACT
STRATEGY comparable: 2/2
Mean/median/p95 TVD: 0.35 / 0.25 / 0.45
Dominant agreement: 100%
EQUITY: no comparable observations
DIAGNOSIS EQUITY_UNAVAILABLE_STRATEGY_FAR=2
```

## 12. Proprietary-data and production-reference boundaries

The tooling must not automate login, scrape, crawl, bulk-export paid matrices, or
reconstruct a proprietary strategy database. This ticket does not change the
protected/local `.gitignore`. Private manual data remains outside the repository
and uncommitted. Only synthetic, Riverline-owned, clearly public/licensable, or
properly licensed fixtures belong in version control.

A benchmark observation is research evidence. It is not a production reference
pack and is never registered as a `StrategyProvider`. A future production pack
requires separate licensing, validation, coverage, authority, versioning,
redistribution, fallback, and claim-policy review.

The first recommended manual collection is specified in
`REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN.md`.

