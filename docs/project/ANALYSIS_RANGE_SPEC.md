# Range-Aware Analysis and Blocker Foundation

Status: implementation authority for `ANALYSIS-RANGE-001`

Schema generation: v1

## 1. Purpose and dependency direction

Range-aware Analysis converts trusted card, decision, and optional canonical range inputs into structural facts that `AnalysisExplanation v1` can explain.

```text
DecisionContext / exact cards / board / dead cards
                         +
       optional HoldemWeightedRange v1 inputs
                         |
                         v
               RangeAnalysisFacts v1
                         |
                         v
              AnalysisExplanation v1
                         |
                         v
                presentation renderer
```

`RangeAnalysisFacts v1` is not a strategy engine. It does not select an action, call StrategyProvider, calculate Equity, infer a missing range, or interpret a blocker as strategically good or bad.

Canonical responsibilities remain separate:

- `shared/poker-domain/evaluator.js` owns hand ranking;
- `HoldemWeightedRange v1` and its conditioning operations own combo-level range truth;
- `DecisionContext v1` owns the decision snapshot supplied to strategy and Analysis;
- `StrategyResult v1` owns current action probabilities and strategy provenance;
- canonical Equity remains a separate service;
- `AnalysisExplanation v1` remains the only layer that turns trusted facts into explanatory copy;
- the renderer formats and localizes but performs no poker mathematics.

## 2. Contracts

### RangeAnalysisRequest v1

Schema: `range-analysis-request/v1`

The request contains:

```text
heroCards                 zero or two canonical cards
board                     zero through five canonical cards
deadCards                 zero or more canonical known-dead cards
decisionContext           optional DecisionContext v1
ranges[key]               optional named range attachments
  key / subjectId / label stable caller-owned identity
  role                    hero or opponent
  range                   canonical HoldemWeightedRange v1
  source                  attachment provenance
provenance
  exactHand
  board
  deadCards
```

When DecisionContext is supplied, omitted card fields are derived from it. Explicit card fields must match it. All known card groups are validated together and duplicate physical cards fail closed.

The keyed `ranges` map is the future source seam. A caller may attach a manual, imported, Personal Strategy, provider-conditioned, or solver/reference range without changing Analysis core. Current production callers attach no range. A named opponent attachment describes only that subject; it is never presented as every opponent in a multiway hand.

### RangeAnalysisFacts v1

Schema: `range-analysis-facts/v1`

The immutable DOM-free result contains:

- exact-hand facts;
- board-structure facts;
- structural exact-card blocker facts;
- one independently named analysis per supplied range;
- selected DecisionContext economics for later consumers;
- separate exact-hand, board, dead-card, and range provenance;
- explicit limitations.

Each supplied range analysis uses `range-analysis-range-facts/v1` and retains its role, subject identity, source, canonical range provenance, inspection, eligibility, normalization state, blocker effects, and composition.

## 3. Exact-hand classification

Postflop primary strength is the canonical evaluator category: high card, one pair, two pair, three of a kind, straight, flush, full house, four of a kind, or straight flush.

Five-card states call the canonical five-card evaluator. Seven-card states call the canonical seven-card evaluator. Six-card turn states enumerate their six possible five-card subsets through the same canonical five-card evaluator. No evaluator ranking is duplicated.

Canonical straight and straight-flush results additionally expose a structural `madeHandSubtype` derived from the evaluator's winning high-card tiebreaker. A five-high straight is `wheel`, an ace-high straight is `broadway`, a five-high straight flush is `wheel`, and an ace-high straight flush is `royal`; other results are `ordinary`. Royal flush remains a presentation subtype of canonical straight flush, never a separate evaluator rank.

Structural relationship facts are separate from the primary category. They include, where deterministically supported: pocket pair; board pair; overpair; top, middle, or lower pair; two pair or two pair on board; set, trips, or trips on board; and plays-the-board on a river tie with the five-card board.

The result also records whether a canonical best-five selection uses a Hero card and relevant components such as pairing a board rank. A board-made result is not attributed to Hero merely because Hero cards were present in the seven-card input.

Preflop exact-hand facts use the canonical 169-class mapping and identify pair, suited, or offsuit structure.

## 4. Draw semantics

Draw analysis is available on flop and turn. River returns an explicit unavailable draw state. Backdoor draws are deliberately omitted from v1. Draw attributes overlap.

### Flush draw

A Hero flush draw requires:

1. exactly four cards of one suit across Hero plus board;
2. at least one Hero card of that suit;
3. no already-made flush or straight flush.

A monotone board without a Hero card in that suit is not labelled a Hero flush draw.

Nut-flush-draw status is true when the classified holding contains the highest card of the draw suit that is not already unavailable. For the exact Hero hand and supplied Hero-range alternatives, unavailable cards are the board plus known dead cards. For a supplied opponent range, Hero's exact private cards are additionally unavailable to that opponent. The exact Hero holding never self-blocks alternative holdings in a supplied Hero range. This is a structural current-card fact, not a future Equity estimate.

### Straight draws

Straight analysis uses the ten exact five-rank windows, including the wheel. A candidate window must contain exactly four current ranks and at least one Hero-contributed rank that is not already on the board. Board-only four-straight patterns therefore do not become Hero draws.

- open-ended straight draw: at least two distinct missing ranks occur at window ends;
- gutshot: at least one internal missing rank, or one single-ended completion rank when no OESD exists;
- double-gutshot: at least two distinct internal missing ranks.

These flags may overlap. A made straight suppresses same-rank straight-draw labels, while another draw family may coexist with a made hand.

### Direct straight-flush draws and overlapping outs

For flop and turn states, Analysis enumerates each legal unseen single card after Hero, board, known dead cards, and any role-specific unavailable private cards. A card is a direct straight-flush completion only when adding that card makes the canonical best hand a straight flush, the completing card belongs to the winning best five, and the result uses at least one private card from the classified holding. Already-made straight flushes and two-card backdoor possibilities do not receive a direct draw label.

Straight-flush draw geometry is classified independently from the prospective made-hand result. `straightFlushDrawSubtype` is `gutshot`, `open_ended`, or `double_gutshot`; `straightFlushCompletionSubtype` is `ordinary`, `wheel`, `royal`, or `mixed`. A five-suited-card turn state can contain two distinct internal missing ranks, so a genuine double-gutshot straight-flush draw is supported rather than invented or suppressed. The result also exposes exact `straightFlushCompletions`, canonical card IDs, and explicit `royalFlushDraw` and `wheelStraightFlushDraw` flags. A royal-flush draw is therefore also structurally a straight-flush draw and shares the same physical completion card rather than creating another out.

`exactHand.drawOuts` is the reusable, DOM-free structured-outs contract. It contains separate `flush`, `straight`, and `straightFlush` families; the straight geometry subtype; prospective straight-flush completion results; explicit multi-family overlap records; and a deterministic `uniqueCompletionCards` union. Every physical card occurs once in that union even when it belongs to several families. Known dead cards are excluded before every family and union is built.

These are structural direct-improvement/completion cards, not clean outs, guaranteed winning cards, probability, or Equity. The contract includes `equityCalculated: false`, and Analysis never adds family counts or performs four-and-two arithmetic. Supplied-range draw mass remains a separate per-combo composition fact; no range-level outs count is synthesized.

An Equity consumer may combine `RangeAnalysisFacts v1` with the separate immutable application projection `exact-entered-hand-outcomes/v1`. That projection uses the canonical evaluator and every entered exact hand to classify legal next cards as strict-ahead outcomes, tie outcomes, structural category improvements that still remain behind, or non-catch-up cards. It is not part of `RangeAnalysisFacts v1`, is unavailable when an opponent hand is unknown, and does not convert structural completion cards into clean outs, guaranteed final-pot wins, or Equity. On the flop, being ahead after the next card still leaves the River unresolved; on the turn, the next card is the final one-card runout.

### Other attributes

Overcards are reported only for an unpaired high-card state and count distinct Hero ranks above the highest board rank. `madeHandAndDraw` is an overlapping attribute when a non-high-card made hand coexists with a primary flush or straight draw.

## 5. Board structure

Board facts require three through five unique canonical cards and include pairing multiplicity, suit texture, flush-completion state, connectivity, high-card/Broadway structure, a completed board straight, and one-card ranks that would complete a straight on board.

Suit texture definitions are:

- `monotone`: one suit;
- `two_tone`: exactly two suits;
- `rainbow`: at least three suits with no repeated suit;
- `multi_suit`: later-street three-or-more-suit state with a repeated suit.

Flush-completion states are `none`, `three_flush`, `four_flush`, and `board_flush` according to the largest board-suit count.

Connectivity is structural:

- `connected`: a consecutive run of at least three ranks, with Ace also usable low;
- `coordinated`: at least three board ranks fit in one five-rank straight window;
- `disconnected`: neither condition.

None of these facts means the board is good for Hero or establishes range or nut advantage.

## 6. Structural blocker facts

With no range supplied, the service reports raw physical card removal only. One exact card appears in 51 of 1,326 Hold'em combos. Two distinct Hero cards remove 101 raw combos in total.

For a supplied opponent range:

1. board and dead cards create the pre-Hero eligible baseline;
2. Hero cards are applied through canonical `conditionHoldemRange`;
3. the result reports exact eligible combo counts and known weighted mass before and after Hero conditioning;
4. removed combo count, removed known combo count, removed known mass, and the most affected 169 classes are retained.

Each Hero card has a direct effect relative to the board/dead baseline and an incremental effect in deterministic Hero-card order. Direct per-card effects may overlap on the one combo containing both Hero cards. Incremental effects do not overlap and sum to the exact combined Hero effect.

Visible blocker facts keep three quantities distinct: physical combo count, known combo count, and known combo mass (the sum of known weights). A fully unknown range still has exact physical before/after/removal counts, while its affected weights remain explicitly unknown and are never presented as zero range removal.

A supplied Hero range represents alternative Hero holdings and is conditioned by board/dead cards, not by the one exact Hero holding. This prevents the exact hand from deleting alternatives from its own range.

The Matrix and sample range-comparison presentation use the same canonical Range Core conditioning through one application projection. Matrix and Hero-range alternatives use `DecisionContext.board + DecisionContext.deadCards`; an opponent comparison additionally uses the exact Hero cards because those cards are unavailable to the opponent. Scenario-known burned or otherwise excluded physical cards participate only when the canonical scenario represents them in `DecisionContext.deadCards`; these presentation surfaces do not define a second burn-card field or removal rule. Fully removed 169 classes remain visibly unavailable, and the presentation does not invent a new frequency-normalization policy.

Blocker output is labelled `structural_only`. Bluff quality and profitability belong to `BLUFF-001`.

## 7. Range composition

Only eligible known range entries contribute weighted composition mass. Unknown entries remain unknown and are never treated as zero.

Preflop composition reports mutually exclusive pair, suited, and offsuit mass plus eligible, known, fully known, and positive-weight class coverage.

Postflop composition reports one mutually exclusive primary evaluator category per known eligible combo, separate overlapping relationship attributes, and separate overlapping draw attributes. Straight-flush made hands remain only in the straight-flush primary category. Direct straight-flush, royal-flush, and wheel-straight-flush draw mass is reported as overlapping draw metadata. Primary category masses sum to known eligible mass. Relationship and draw masses need not sum to that mass or to 100%.

## 8. Partial ranges and normalization

Every range result retains known and unknown eligible combo counts, eligible coverage ratio, known eligible combo mass, and original complete/partial state.

Normalized shares are available only when the original `HoldemWeightedRange v1` is complete and eligible known mass is positive. A partial range is not normalized even if blockers happen to remove every unresolved combo. This matches the canonical range-core normalization boundary and avoids changing source truth through conditioning.

For partial or fully unknown ranges, Analysis shows known mass and coverage. It does not extrapolate unknown combos or label a percentage as whole-range composition.

Visible composition and draw lists render every positive category in v1. They do not silently truncate the list. Numeric mass and normalized shares are separate LTR data tokens; partial and fully unknown ranges never receive normalized whole-range shares.

## 9. Provenance

Provenance is grouped, not collapsed into a global confidence score:

- exact hand: Scenario, canonical PokerState, or canonical Training cards;
- board and dead cards: their supplied card authority;
- range: attachment source plus original HoldemWeightedRange provenance;
- strategy: StrategyResult provenance;
- Equity: an already-supplied canonical Equity result, if present.

Direct Personal Strategy, inferred Personal Strategy, manual, imported, provider, reference, mixed, external, and unknown sources remain distinguishable. Provenance does not imply trust, confidence, Equity, or action frequency.

## 10. AnalysisExplanation and UI integration

The application creates `RangeAnalysisFacts v1` before calling `createAnalysisExplanation`. `AnalysisExplanation` formats the structured facts into Hand & Board, Decision Economics, Blockers, Range, Context, supporting detail, source, and limitation content. It does not import the evaluator or canonical range-conditioning functions.

The renderer exposes richer exact hand/draw/board facts, including concise wheel/Broadway/royal made-hand names and a compact first-class Outs area. Flush, straight, and straight-flush completion families remain separate rows; straight-flush rows include their exact prospective result, overlaps are called out, and the unique direct-improvement total counts each physical card once. It also exposes exact structural Hero-card removal, conditional supplied-range blocker/composition facts, a compact unavailable Range state when no explicit source exists, separate fact-source rows, and readable partial coverage.

When dead cards materially participate, their provenance appears as its own visible fact-source row. DecisionContext, exact cards, board, dead cards, strategy, and each named supplied range remain distinct sources rather than being collapsed into one confidence label.

All visible stable copy is localized in EN, RU, and HE. Hebrew prose follows the page's RTL direction. Only card IDs, ranks/classes, physical and known combo counts, combo mass, percentages, and related poker data are local LTR isolates. Sections use semantic headings and do not rely on color alone.

No Range Builder or manual range editor is introduced. The current product supplies no production weighted range, so the conditional range result remains dormant until a future caller attaches one through the named request seam.

## 11. Performance and invalidation

The range-analysis module is pure and DOM-free. Current Analysis calls it only inside the existing visible Analysis render path:

- hidden Playbook Analysis remains dirty rather than computing;
- Training Analysis computes only when its existing result or hint surface requests an explanation;
- no StrategyProvider call is added;
- no Equity calculation is added;
- no worker, global cache, or speculative memoization is introduced.

Focused tests exercise a complete 1,326-combo river analysis within a conservative two-second development-machine bound. Typical focused measurements are substantially lower and do not justify a cache architecture.

## 12. BLUFF-001 handoff

`RangeAnalysisFacts v1` exposes pot/call/facing/stack/opponent context where known, exact Hero hand and board, made-hand relationship, draws, raw blockers, optional named opponent range, exact removed known mass/classes, known composition/coverage, and grouped provenance.

`ANALYSIS-RANGE-001` deliberately does not classify value or bluff combos, estimate fold equity, calculate bluff profitability, compare EV, or call a blocker strategically good or bad.

## 13. Non-goals

V1 does not implement Range Builder, Range Teacher, Personal Strategy activation, action-conditioned range construction, weighted range-vs-range Equity, range advantage, nut advantage, value/bluff classification, bluff profitability, solver EV, Compare Spots, Saved Range UI, accounts/cloud, or solver/model work.
