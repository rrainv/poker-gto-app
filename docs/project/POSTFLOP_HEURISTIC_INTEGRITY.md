# Postflop Heuristic Integrity Audit

## Scope and vocabulary

This audit covers the deterministic browser postflop fallback only. It does not
calibrate strategy, create weighted ranges, alter canonical Equity, or claim
multiplayer equilibrium.

Classification:

- **A** mathematically correct
- **B** objectively incorrect
- **C** sampling defect
- **D** heuristic but defensible as an approximation
- **E** arbitrary and awaiting calibration
- **F** action/sizing semantic defect

## Pipeline before and after

Before:

```text
DecisionContext
  -> heuristic options
  -> sorted "top X%" opponent candidates
  -> up to 20 allocation attempts per opponent
  -> sampled runout
  -> shared evaluator scores
  -> wins + heads-up half-ties
  -> classifier multipliers described as modified equity
  -> discontinuous thresholds
  -> label-to-structured action mapping
  -> independent explanation sample
  -> StrategyResult
```

After:

```text
DecisionContext (exact opponentCount in Hand/Training; null in Scenario)
  -> explicit heuristic options
  -> disclosed uniform assumed candidate range
  -> complete conflict-free opponent allocation or uncounted retry
  -> dead-card-safe runout
  -> shared evaluator scores
  -> exact 1 / winnerCount Hero showdown share
  -> separate canonical rank / Hero-specific category / draw features
  -> continuous heuristic action interpolation using trusted callAmountBb only
  -> structural legal action family with sizing omitted
  -> one heuristic_conditional_sample in StrategyResult.details
  -> AnalysisExplanation consumes that same fact
```

## Rule classification and disposition

| Pipeline rule | Before | Disposition |
| --- | --- | --- |
| `facingSizeBb` is wager-to and `callAmountBb` is incremental price | A | Preserved. Only finite non-negative `callAmountBb` creates exact price math. |
| Postflop opponents equal `tableSize - 1` for every source | B | Canonical projections now provide exact `opponentCount`; Scenario fallback is explicitly labeled an approximation. |
| Dead cards are removed from the initial sampling deck | A | Preserved and covered by allocation/runout invariants. |
| Select a deterministic high-card/pair/suited candidate subset | D | Retained as an assumed range, not canonical equity or solved range. |
| Uniform sampling inside that selected subset | D | Retained as a valid distribution and disclosed. |
| "Top 15/25/40%" explanation independent of actual population | B | Removed. The result reports the actual selected fraction of unblocked combinations. |
| Every opponent uses the same crude assumed range | D | Retained and explicitly documented; a weighted/per-opponent range engine remains future work. |
| Stop after 20 rejected combos and count a short-handed trial | B/C | Removed. Counted trials contain every intended opponent; failed whole-trial allocation is retried and bounded exhaustion throws. |
| Runout sampling without replacement | A | Preserved after complete opponent allocation. |
| Final hand ordering uses the shared evaluator | A | Preserved; tests compare the adapter with the canonical evaluator. |
| Every Hero tie contributes one half | B | Replaced by exact `1 / numberOfWinners`. |
| Sampled showdown share is canonical Equity | B | It is now `heuristic_conditional_sample`, conditional on assumed ranges. |
| Wheel detection checks rank 12 as Ace | B | Removed; canonical evaluator handles made straights and draw sequences include Ace-low explicitly. |
| Flush draw requires exactly two suited Hero cards on a two-suit board | B | Replaced by combined-card suit accounting with Hero contribution, made-flush separation, and nut-draw feature. |
| Gap-of-at-most-two chains identify straights/draws | B | Replaced by explicit five-rank straight sequences, including wheel, OESD, gutshot, and double-gutshot features. |
| Board-made hands imply Hero-specific monster/pair strength | B | River plays-board and board-pair/two-pair/trips cases are distinguished from Hero improvements. |
| Set/trips kicker multipliers alter a value called equity | B/E | Removed. Set/trips remain classifier features; strategic offsets are separate from sampled equity. |
| Suited/high-card/style and texture adjustments | E | Reduced to explicit continuous aggression-score offsets awaiting calibration. They never alter the sampled fact. |
| Fabricated villain position from Hero's label | B | Removed. No postflop position adjustment is applied until a trusted relation exists. |
| Starting-stack compatibility value is exact effective SPR | B | Details call it a compatibility stack-to-pot ratio; its small heuristic effect remains disclosed. |
| Hard equity/category strategy thresholds | E | Replaced with continuous piecewise/smooth interpolation; legal action boundaries remain discrete. |
| Hand-level MDF forces defense | A (absent) | No postflop fallback MDF input/use exists; MDF remains educational range-level copy only. |
| Manual flat drop increases pot and lowers thresholds | B/F | Removed. The UI control had no other legitimate purpose and was removed. ClubGG accounting is unchanged. |
| `facingSizeBb === 0` selects Check/Bet; otherwise Fold/Call/Raise | F at free-action edge | Action family now treats trusted `callAmountBb === 0` as Check/Bet even if nominal compatibility data is stale. |
| Exact postflop sizes are null | A/F | Preserved intentionally: omitting a size is safer than inventing legal precision without bounds. |
| Strategy and explanation run independent 250/800 samples | C | Replaced by one 250-trial resolved sample stored in `StrategyResult.details`. |
| Local injected RNG, separate from Training and canonical Equity RNG | A | Preserved; range-affecting options and exact opponent count participate in the local seed. |

## Explicit strategy inputs

Used by the postflop fallback:

- Hero cards, board, and dead cards;
- exact `opponentCount` when present, otherwise disclosed `tableSize - 1` Scenario approximation;
- pot, nominal facing context, and exact call amount when available;
- street through board length;
- compatibility stack depth (not guaranteed effective stack);
- Play Style as a continuous aggression bias;
- Opponent Style as looser assumed candidate-range selection.

Not currently used:

- exact postflop position relation, because DecisionContext v1 does not supply one;
- ClubGG forced contribution as a strategy penalty;
- the removed manual flat-drop control;
- MDF;
- exact postflop bet/raise sizing, because legal bounds are incomplete.

## Remaining strategic limitations

Candidate range scoring, range width, category offsets, stack/texture adjustments,
and frequency anchors remain heuristic and uncalibrated. All opponents share the
same crude range assumption. The result models showdown share, not future action
EV, fold equity, range-vs-range strategy, blockers beyond physical card removal,
or multiplayer equilibrium. Postflop Matrix remains unavailable.

Canonical `equity-request/v1` and its exact/seeded-Monte-Carlo implementation are
not dependencies of this fallback and were not changed by this work.
