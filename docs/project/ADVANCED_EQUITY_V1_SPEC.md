# Advanced Equity v1

September 7, 2026 — implementation for `ADVANCED-EQUITY-001` +
`WEIGHTED-RANGE-EQUITY-001` + `RUNOUT-EXPLORER-001`; human acceptance pending.
This is the first bounded slice, not completion of every capability in the
[Equity dossier](capabilities/EQUITY_HAND_ANALYSIS.md).

## Authority and supported product flow

`shared/poker-domain/weighted-equity.js` extends canonical Equity within the
same poker domain. It consumes unchanged `HoldemWeightedRange v1`; `equity.js`
supplies its seeded RNG, unordered card enumeration and evaluator/winner path.
The existing `equity-request/v1` and its known/uniform-unknown behavior are
unchanged. No provider, solver, persistence migration or second evaluator exists.

Equity's secondary **Ranges & runouts** disclosure uses the current roster,
board and dead cards. Each hand can remain exact/uniform unknown or be replaced
for this analysis with explicit range weights. `AA:1, AKs:0.5, AsKh:0.2` accepts
class and physical-combo weights; a combo override wins over its class. Unlisted
entries default to unknown. Excluding them is an explicit input choice.
This small input adapter expands immediately into Range Core; it is not range
storage, a complete poker-notation editor, or a second range model.

Calculation is explicit. The result and its partial qualification precede the
secondary Runout Explorer. Hand-input/seed/range changes and cancellation fence
old results. Collapsed analysis does not perform Equity or provider work. The
same disclosure is available over a Personal Hand trajectory and over a sized
Exploit candidate. Hypothetical analysis never changes live Hand or intent.

## Request and source boundary

`weighted-equity-request/v1` contains `players` (2–10), `board`, `deadCards`,
`method` (`auto`, `exact`, `monte_carlo`), `samples` (1–1,000,000), unsigned 32-bit
`seed` and `partialPolicy` (`reject` by default, or explicit `known_only`).

Players have unique IDs and one discriminator:

- `exact`: exactly two canonical `cards`;
- `uniform_unknown`: explicitly uniform physical unknown cards;
- `range`: canonical `range`, `weightSemantics = relative_combo_likelihood`,
  nonempty `sourceId`, and `sourceRole` (`user_supplied`, `personal_intended`,
  `explicit_opponent_model`, `reference`).

Source roles are descriptive and remain distinct. The mathematical service
does not authenticate a source, register a reference or grant strategy claims.
Reference acceptance remains application-owned; this slice adds no production
reference picker/corpus. Action-selection policy weights and ambiguous
hand/range inputs fail closed. No weighted input becomes a uniform unknown.

## Result and partial semantics

`weighted-equity-result/v1` has `status = exact | estimated | partial |
unavailable | incomparable`. Numerical exactness is separately `method`.
Partial known-only exact enumeration still has **partial** status.
Refusal/failure results have no numerical player results.

Coverage is per range after board/dead/exact-hand conditioning, before joint
variable-hole collision conditioning:

- `knownMass`: sum of eligible known weights;
- `unknownMass`: null when unresolved entries exist, otherwise zero;
- `unknownMassBounds`: `[0, eligibleUnknownComboCount]`, in inclusion-weight units;
- `blockedKnownMass`, `blockedUnknownCombos`;
- known/unknown/eligible counts and `comboCoverage` (counts, including known zero);
- full and conditional normalization availability;
- source role, ID and original Range Core provenance.

Combo coverage is **not** probability-mass coverage. This representation cannot
justify “68% of Villain's probability mass is known.” Unknown weight is not
zero, so no such sentence is generated. Explicit known-only calculation
conditions every partial range on its known positive support and says so.
If every unknown entry is physically blocked, the eligible mathematical
distribution can be complete; source entries stay unknown and unchanged.
Range Core's stricter general-purpose normalization helper remains unchanged.

Results retain the full normalized request as a replay recipe, method,
seed/sample count, attempted samples, conservative workload estimate and source
facts. Equity means equal showdown pot share, excluding rake, side-pot/pricing
effects, future decisions and strategic recommendations.

## Joint distribution and bounded computation

The joint holding law is proportional to the product of independent range
weights, conditioned on no shared cards. Exact enumeration accumulates weighted
pot shares across every compatible tuple and uniform legal final board.
The conservative product-count × runout upper bound must be at most 100,000;
explicit exact above that bound is unavailable, while auto chooses Monte Carlo.

Monte Carlo independently draws all variable hands against fixed blockers and
rejects the **whole tuple** on collision. Sequentially renormalizing later
players is prohibited because it biases earlier players. After acceptance,
canonical partial Fisher–Yates sampling supplies uniform conditional runouts.
Sampling allows at most `min(2,000,000, max(10,000, samples * 100))` attempts.
Failure to collect the requested samples returns unavailable, not a truncated
estimate. Attempt-based yielding makes even incompatible ranges cancellable.

The existing worker/controller dispatches the additive request. Cancelled
worker and fallback results are fenced even if a backend resolves after cancel.
There is no global result cache or invalidation/provider expansion.
Application dispatch attaches a separate `weighted-equity-presentation/v1`
projection for current exact-Hero range standing, computed inside the worker.
The canonical mathematical result does not acquire presentation authority.

## Runout and card facts

`runout-request/v1` wraps a canonical exact or weighted request plus optional
selected sequences. `runout-explorer/v1` supports flop/turn next-card scans and
selected ordered turn→river sequences. It accepts at most 52 paths and at most
2,000 samples per path (UI: 500); each path and baseline uses auto with a 2,000
exact-realization cap. Thus it does not multiply every combo by every runout by
every trial. Exhaustive ordered flop paths are deliberately not exposed.

Each row has conditional Equity and baseline delta, actual method, category
transition, evaluator-selected best five for an exact Hero, exact entered-hand
standing where available and separate Range Core before/after removal facts.
Rank/suit/category grouping, selected-path comparison and hover/focus/click
inspection share the same facts. All available cards remain visible; unused
cards are de-emphasized. Approximate deltas disclose sampling noise, including
uncertain sign. A category improvement never implies an Equity improvement.

For exact Hero against one weighted opponent, current made-hand standing is
the known-weight fraction ahead/tied/behind; category mass composition is also
available. Range Hero has no fabricated single hand category. Candidate cards
are not assumed equally likely; no probability-weighted aggregate is inferred
from their unweighted list. All-support-blocked runouts remain unavailable.
Action conditioning and public-card removal are separate derivations.

## Personal and Exploit consumers

`weighted-equity-consumers.mjs` accepts fingerprint-validated
`personal-range-trajectory/v1` with exact action-conditioned reach weights.
The Personal Hand UI inspects that region against an explicitly selected
opponent input; unknown entries stay partial. The older action-family bridge
cannot masquerade as a sized reached range. A/B Equity comparison is an API
over identical nodes and opponent inputs; partial comparisons keep both
conditional results and withhold a full-range delta. A/B UI remains future.

Exploit's candidate disclosure requires the user to enter an explicit calling
or facing-bet range. The hypothetical model is separate from OpponentPolicy;
policy weights never supply combos. Current context/action is retained in
source identity, and changing the candidate disposes the old analysis. The
DOM-free consumer also accepts explicit calling/value/bluff/facing-bet model
ranges with model/version/evidence references. Numbers are assumption-labelled
showdown Equity. No bluff/value partition, call recommendation, role verdict,
fold response, action EV, optimization or automatic Personal rewrite is added.

## Verification and remaining acceptance

Focused invariant tests cover collision-weight examples, MC convergence and
seed replay, totals/splits, partial/zero/unknown distinctions, blockers,
validation, runout legality/categories/removal, dispatch/cancel/stale behavior
and Personal/Exploit boundaries. Existing Equity, Range Core, Personal Range
Evolution, Exploit and language regressions remain required.

`QA-ADVANCED-EQUITY-001` owns visual/manual acceptance. Browser inventory was
empty on September 7; automated/mounted tests are not visual acceptance.
Human matrix: Equity exact/range-vs-range/partial/zero inputs; cancel and edit
during scan; all-next and selected turn→river paths; focus/hover/tap best-five
preview; source details; Personal trajectory changes; Exploit size/policy changes;
EN/RU/HE, RTL, narrow desktop and Midnight/Daylight.

Development-machine profile (`tests/tooling/benchmark_advanced_equity001.mjs`):
two full weighted ranges, 2,000 Monte Carlo samples: 314 ms / 2,205 attempts;
exact Hero versus QQ/AKs on the turn, all 46 candidate rivers: 578 ms.
These bounded fixture measurements are not general latency guarantees. One
top-level runout recipe owns range/provenance content; per-card results omit
repeated full ranges to bound worker serialization. The measured all-river
result serialized to approximately 338 KB.

Deferred facts remain explicit null/unavailable: rigorous clean/dirty taxonomy,
draw/redraw enumeration beyond calculated category transitions, percentile,
universal nuts/locks, range/nut advantage, response-mixture inference, production
reference selection and broader cross-surface/durable runout continuity.
