# Structural Bluff and Semibluff Analysis

Status: implementation authority for `BLUFF-001`

The additive [Bluff / Exploit Teacher v1](BLUFF_EXPLOIT_TEACHER_V1_SPEC.md) reuses these facts for explicit sized hypotheses, policy-conditioned lesson cards and comparison. It requires DecisionContext v1.1 for exact economics and preserves this v1 contract. Quantitative roles/Equity and normative exploits remain unavailable.

Schema generation: v1

## 1. Purpose and dependency direction

Bluff Analysis explains exact mathematical pressure and structural hand facts without becoming a strategy, opponent-response, Equity, or EV source.

```text
DecisionContext v1 + StrategyResult v1
                         +
             RangeAnalysisFacts v1
                         |
                         v
             BluffAnalysisFacts v1
                         |
                         v
            AnalysisExplanation v1
                         |
                         v
                    renderer
```

`app/src/application/bluff-analysis.mjs` is pure, DOM-free, immutable, and versioned. It does not call StrategyProvider, the evaluator, Equity, or Hold'em range conditioning. It consumes the current StrategyResult action without changing it and reuses exact hand, draw-outs, blocker, and supplied-range facts already produced by `RangeAnalysisFacts v1`.

## 2. BluffAnalysisFacts v1

Schema: `bluff-analysis-facts/v1`

The contract contains:

- source schema versions;
- the analyzed action and whether it came from the current StrategyResult recommendation or an explicit trusted caller action;
- trusted action economics or an exact unavailability reason;
- structural hand/semibluff classification and the unchanged `drawOuts` facts;
- neutral Hero-card removal facts;
- exact effects for explicitly supplied opponent ranges;
- an unavailable future seam for continue/fold or value/bluff partitions;
- a tightly scoped river balanced-range reference;
- explicit opponent-response and unsupported-claim limitations.

All nested values are deeply frozen. The facts contain no localized prose and no mutable global state.

## 3. Action selection and StrategyResult boundary

The production integration analyzes the highest-probability current StrategyResult action. This does not reinterpret its probability as an opponent fold probability, expected value, or bluff frequency. StrategyProvider remains the sole strategy authority.

A caller may supply one explicit trusted action to the fact constructor for bounded analysis or tests. That seam does not create a second recommendation source: the caller owns which candidate action is being inspected.

The current postflop heuristic supplies action families but no bet size. Therefore its live Bluff section truthfully reports that the break-even fold requirement is unavailable. BLUFF-001 does not add a heuristic size or change StrategyProvider behavior.

## 4. Bet risk and reward

For a bet:

- `potBeforeActionBb` is the contestable pot before Hero's wager enters;
- `riskBb` is Hero's incremental wager;
- `immediateRewardBb` is the pre-action pot won if every relevant opponent folds.

An absolute bet amount is treated as incremental risk. A supplied pot fraction derives the risk from `potBeforeActionBb`. If both are supplied, they must agree. Missing or conflicting size facts make economics unavailable.

For a zero-showdown-equity bluff:

```text
EV = F * reward - (1 - F) * risk

F_break_even = risk / (risk + reward)
```

Example: betting `5bb` into `10bb` risks `5bb`, can win `10bb` immediately, and requires `5 / 15 = 33.33%` folds to break even. Hero's new wager is not added to the reward.

Zero incremental risk is rejected as a bluff wager. A positive bet into a zero pot has a mathematical break-even requirement of `100%`. All results reject non-finite inputs and never emit `NaN` or `Infinity`.

## 5. Raise risk and reward

A raise amount is an amount-to: Hero's total current-street contribution after acting. Raise economics are available only when both the amount-to and trusted `heroStreetContributionBb` exist.

```text
riskBb = raiseToBb - heroStreetContributionBb
rewardBb = potBeforeActionBb
```

The raise-to amount must add chips and, when the trusted call amount is known, must exceed the call boundary. The nominal `facingSizeBb`, the full raise-to amount, and Hero's already-invested street chips are never substituted for incremental risk.

Canonical Hand Mode can provide the contribution fact. Lossy Scenario state normally cannot, so a Scenario raise reports `hero_street_contribution_unavailable`. BLUFF-001 does not reconstruct action history. An undifferentiated all-in remains unavailable because StrategyResult v1 does not prove whether it is a bet, raise, or call and DecisionContext's stack field is configured starting depth rather than exact remaining chips.

## 6. Multiway semantics

The event in the break-even formula is that all relevant opponents fold. When `opponentCount > 1`, presentation uses **Required all-opponents-fold frequency**. It does not infer each opponent's fold rate, average individual rates, independence, or a product of assumed response frequencies.

When the exact live opponent count is unavailable, the result still states that every relevant opponent must fold but does not manufacture a per-player interpretation.

## 7. Structural semibluff classification

Classification consumes `RangeAnalysisFacts.exactHand` only. It does not grade whether betting is correct.

V1 distinguishes:

- semibluff structure;
- pair + draw;
- made hand with redraw;
- limited direct-improvement structure;
- overcards without a direct draw;
- made hand without a direct draw;
- river hand structure, where no future card remains.

Displayed draw labels reuse the exact flush, nut-flush, straight, combo, and direct straight-flush geometry already present in Range Analysis. Terms such as profitable, mandatory, strong bluff, and optimal semibluff are unsupported.

## 8. Structural outs

`handStructure.drawOuts` is a frozen copy of `RangeAnalysisFacts.exactHand.drawOuts`. BLUFF-001 performs no second enumeration and no evaluator sweep.

Unique completion cards, flush/straight/straight-flush families, prospective straight-flush results, and overlap are preserved exactly. They are structural direct-improvement cards, not clean outs, Equity, or winning probability. BLUFF-001 never applies the rule of 2, rule of 4, `outs / 47`, or additive family formulas.

## 9. Range-free blocker facts

Without a supplied range, Hero cards are neutral physical-removal facts. The contract retains each Hero card's raw physical effect and the exact combined 101-combo removal for two distinct cards.

It does not say that a blocker is good or bad, blocks calls, unblocks folds, or removes value. The visible existing card-token presentation remains the authority for displaying cards; BLUFF-001 introduces no new raw `As`/`5h` prose.

## 10. Explicit-range blocker facts

For each explicitly supplied opponent `HoldemWeightedRange v1`, Bluff Analysis reuses the already conditioned Range Analysis facts and exposes:

- physical combos before and after Hero-card conditioning;
- physical combos removed;
- known combo counts before, after, and removed;
- known combo mass before, after, and removed;
- known coverage and complete/partial/fully-unknown state;
- normalization availability;
- existing structural composition and most-affected classes.

Before values are the exact sum of existing after and removed facts; no combo traversal is repeated. A fully unknown range can have exact physical removal while known mass remains unavailable in meaning. A partial range stays partial and is not normalized. A complete zero-mass range is not normalized.

Generic range composition remains structural. It does not become a behavioral fold estimate or a blocker-quality verdict.

## 11. Future strategic range partitions

`strategicPartitions` reserves an account-ready/source-ready seam for explicit semantic continue/fold or value/bluff partitions. V1 always reports it unavailable because no such current source exists.

Strategic blocker quality requires one of those meaningful partitions or another future validated strategic source. A generic opponent range is insufficient.

## 12. River balanced-range reference

The educational river reference appears only for a sized single bet, an exact heads-up context (`opponentCount === 1`), and trusted bet economics.

Under the explicit simplified assumptions that bluffs have zero showdown value when called, value bets always win when called, and the defender calls at the indifferent boundary:

```text
bluff / value ratio = B / (P + B)
bluff share of betting range = B / (P + 2B)
```

A pot-size bet gives a `1:2` bluff:value ratio and `1/3` bluff share. A half-pot bet gives `1:3` and `1/4`. This is labelled a simplified river balanced-range reference, never a prescription for the actual spot and never a solver result. It is unavailable on earlier streets, for raises, for unknown sizing, and when heads-up status is not proven.

## 13. Provenance and performance

The fact contract records the DecisionContext, StrategyResult, and RangeAnalysisFacts schema sources. Range provenance remains attached inside each reused range effect. AnalysisExplanation continues to present grouped strategy, exact-card, board, dead-card, and supplied-range sources.

Bluff construction is constant work plus one pass over the small map of already analyzed named ranges. With no supplied range it performs no 1,326-combo traversal. It does not call StrategyProvider, Equity, or the evaluator. The visible Analysis path memoizes both Range Analysis and Bluff Analysis by source-object identity, so language/theme rerendering does not recalculate strategy or structural poker facts.

## 14. Unsupported claims

BLUFF-001 does not provide:

- an opponent fold-frequency estimate;
- action EV or bluff profitability;
- an optimal bluff frequency;
- equilibrium, Nash, CFR, exploitability, or solved-strategy evidence;
- clean-out or Equity estimates from structural outs;
- good/bad blocker quality without an explicit strategic partition;
- inferred current ranges;
- a new strategy or sizing recommendation.
