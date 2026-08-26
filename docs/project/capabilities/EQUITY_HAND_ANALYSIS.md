# Equity and hand analysis

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning navigation: [PRODUCT_BACKLOG.md](../PRODUCT_BACKLOG.md), [CURRENT_PHASE.md](../CURRENT_PHASE.md), and [ROADMAP.md](../ROADMAP.md).

## Product purpose

Riverline should turn canonical cards and Equity outcomes into transparent, street-aware hand intelligence. A user should be able to see exactly what a hand is now, how the canonical best five is formed, which future cards change it, how strong it is in a stated reference frame, and why win, tie, and Equity numbers differ.

This is factual analysis over canonical poker authorities. It is not a strategy source and does not turn an attractive draw, blocker, percentile, or current result into advice by itself.

## User jobs / why it matters

- Identify the exact current made hand without mentally reconstructing kickers or the best five.
- Distinguish a direct draw or direct out from a redraw, backdoor path, runner-runner path, or conditional improvement.
- Understand whether current nuts are vulnerable and whether a hand is merely strong, locked against entered hands, or universally locked.
- Inspect what a specific future card would actually produce before attaching strategic meaning to it.
- Understand blockers, domination, and range-relative standing in an explicit reference frame.
- Explain split-pot outcomes such as nonzero Equity with zero outright wins.
- Keep the default result concise while making rigorous detail available on demand.

## Existing foundation

Current implemented contracts remain in:

- [ANALYSIS_RANGE_SPEC.md](../ANALYSIS_RANGE_SPEC.md): `RangeAnalysisFacts v1`, current made-hand relationships, board facts, structural direct completions, overlap-safe unique completion cards, raw card removal, and explicitly supplied-range facts;
- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md): canonical 1,326-combo identity, known-versus-unknown weights, blocker conditioning, provenance, normalization, and derived Matrix projections;
- [ARCHITECTURE_CONTRACT.md](../ARCHITECTURE_CONTRACT.md): canonical evaluator, Equity, range, and UI authority boundaries;
- [evaluator.js](../../../shared/poker-domain/evaluator.js): canonical five- and seven-card hand ranking and evaluator-selected best five;
- [equity.js](../../../shared/poker-domain/equity.js): canonical 2-10-player exact or seeded Monte Carlo Equity, win/tie/share accounting, cancellation, and progress.

The current Equity request accepts exact two-card hands or a uniform unknown hand, board cards, and dead cards. It does not accept weighted opponent ranges. Current Range Analysis deliberately omits backdoor draws and does not claim clean outs, nut advantage, range standing, vulnerability, or Equity. No current Runout Explorer or card-outcome preview contract exists.

## Desired future behavior

### Current hand facts

For each known player, Riverline should support exact descriptions such as:

- `Two Pair — Jacks and Tens`, including `top two pair` where the board relationship proves it;
- `Pair of Queens — top pair`;
- `Pocket Tens — overpair`;
- `K-high — King overcard, no made pair`;
- `J-high Straight — 7 through J`;
- `Ace-high Flush — hearts`;
- `Full House — Queens full of Sevens`.

Where canonical evidence supports them, detailed facts may include:

- the canonical best five and exact ranks that form it;
- kicker structure;
- straight sequence and high card;
- flush suit and high-card structure;
- full-house trips and pair structure;
- whether and how each hole card contributes;
- board-made versus hole-card-made results;
- top, middle, or bottom pair;
- overpair or underpair;
- top or bottom two pair;
- overcards.

These facts must follow evaluator output. Presentation may name or organize the result but may not select a different best five.

### Draw and improvement taxonomy

Keep these concepts separate:

1. **Made hand** — the canonical hand now.
2. **Direct draw** — a one-card completion structure available on the current street.
3. **Direct out** — a currently unseen next card that produces the defined immediate result.
4. **Redraw** — a path to a stronger result when a made hand already exists.
5. **Backdoor draw** — a two-card path from the flop that needs both remaining streets.
6. **Runner-runner path** — an explicit legal Turn then River sequence.
7. **Conditional out / conditional improvement** — a card that creates later outs or improves category without necessarily winning.

Conditional future outs must never enter the current direct-out count.

Example:

```text
Hero T♥ 9♥
Board J♥ 8♥ 7♠

Current: J-high Straight
Redraw: Straight Flush

Q♥ -> Q-high Straight Flush
7♥ -> J-high Straight Flush
```

The straight is the current made hand. The heart completions are redraw cards; they are not a reason to hide the already-made straight.

### Runner-runner and conditional paths

On the flop, Riverline may enumerate legal `Turn -> River` pathways where that detail is useful. A Turn card that merely creates River outs is not a current direct out.

Useful output may include:

- qualifying Turn cards or equivalent Turn classes;
- River outs created by each class;
- the resulting hand or hand family;
- exact path probability where tractable;
- overlap and card-removal handling.

Equivalent paths should be grouped instead of flooding the user with raw permutations. Exact card-level inspection remains available when requested.

### Frontdoor, backdoor, and street semantics

- **Flop:** direct/frontdoor draws and backdoor flush, straight, or straight-flush paths may coexist.
- **Turn:** describe one-card remaining improvements; do not use misleading two-card backdoor language.
- **River:** show final hand facts only; no future-draw language remains.

Street transitions must update the taxonomy rather than carrying stale flop labels forward.

### Nut status and locks

Keep separate:

- **Current nuts** — no legal current holding is strictly better now in the stated universe.
- **Current nuts but vulnerable** — best now, but a legal future runout can overtake or tie it.
- **Nth-nut / nut-tier status** — a transparent ordering or band under an explicit holding universe.
- **Locked versus entered hands** — cannot lose against the exact hands actually entered for this calculation, subject to any remaining runout.
- **Absolute / universal lock** — no legal opponent holding consistent with known information and no legal future runout can beat or tie the player.

Current nuts never implies a lock. Universal lock is an exhaustive claim and must be withheld unless every legal holding and future runout in scope has been established. A lock against entered hands is not a lock against every legal hidden hand.

### Vulnerability

Where tractable, factual vulnerability may identify:

- stronger current legal holdings;
- legal next cards or full runouts that overtake or tie the hand;
- one-card threats versus runner-runner threats;
- exact overtake/tie probability under the stated holding and runout universe.

Vulnerability is not automatically a recommendation to bet, call, protect, or fold.

### Blockers

Support factual descriptions of:

- nut blockers;
- made-hand blockers;
- flush blockers;
- straight blockers;
- draw blockers;
- redraw blockers;
- later unblockers where meaningful.

Every blocker statement must state its reference frame. For example:

> `A♥` removes all legal opponent `A♥X♥` heart combinations.

Do not say `good blocker`, `bad blocker`, or `blocks folds` unless a separate strategy or opponent-response authority supports that interpretation.

### Hand standing

Keep five questions separate:

1. Nut status.
2. Absolute current-hand standing versus all legal opponent holdings.
3. Range-relative standing versus a supplied weighted range.
4. Entered-hand standing versus exact opponent cards.
5. Future Equity across legal runouts.

Transparent qualitative bands such as Crushing, Very strong, Strong, Marginal, Weak, and Very weak may summarize a stated statistic, but the underlying statistic and reference frame must remain visible.

```text
Strong vs selected range
Ahead 78%
Tied 3%
Behind 19%
```

No percentile or band becomes universal strategic truth.

### Domination

Structural domination is separate from percentile standing. Facts may include:

- dominates weaker `Ax` structures;
- is dominated by stronger same-pair/kicker structures;
- removes combinations that would otherwise dominate Hero.

A dominated hand can still have meaningful Equity in a wider range context, and a high percentile does not by itself prove structural domination.

### Clean and dirty improvements

Future analysis may distinguish cards or paths that:

- improve Hero and win often in the stated comparison;
- improve Hero's category but leave Hero behind;
- complete Hero while creating a stronger opponent result;
- create later outs rather than an immediate improvement.

One physical card must not be counted twice when it belongs to overlapping draw or outcome families. `Clean` and `dirty` require an opponent holding/range and runout reference; absent that evidence, Riverline should show structural completion only.

### Split-pot explanation

Riverline should explain results such as:

```text
Win 0.0%
Tie 2.8%
Equity 1.4%
```

In a two-way tie, the player receives half of the tied pot share, so `2.8% × 1/2 = 1.4%` Equity. Multiway explanations must use the actual split share rather than assuming every tie is heads-up. This is explanation over canonical Equity math, not a second calculation.

### Runout Explorer

A future Runout Explorer may let the user inspect a Turn card, River card, or equivalent card class and see:

```text
hypothetical card/runout
  -> canonical resulting hand
  -> new draws and redraws
  -> newly created direct or conditional outs
  -> resulting Equity, only when separately calculated
```

It must respect known, dead, excluded, and already selected cards and clearly separate a single-card structural preview from a full Equity calculation.

## Structured facts / evidence required

- Canonical Hero/opponent cards, board, dead/excluded cards, and street.
- Canonical evaluator result, score/tiebreakers, and evaluator-selected best five.
- Exact opponent cards or an explicitly supplied, provenance-bearing weighted range when a comparison requires them.
- The complete holding universe used for nut, lock, domination, or absolute-standing claims.
- Canonical Equity request/result, actual method, exactness, seed/sample facts, runout universe, and split-pot semantics.
- Direct-draw, redraw, conditional-path, and overlap records with stable card identities.
- Game Rules and deck constraints required to establish legal holdings and runouts.
- Source/version identity and uncertainty for every range, abstraction, or derived qualitative band.

Unknown holdings, partial ranges, or an unperformed Equity calculation remain unknown. They are never represented as zero, false, or a strategically neutral fact.

## Authority, provenance and uncertainty rules

- `shared/poker-domain/` remains the sole evaluator, card, deck, and Equity authority.
- `RangeAnalysisFacts` or a future shared factual successor owns structured hand/runout analysis; UI consumers do not reimplement ranking or out enumeration.
- A hypothetical state must be produced through approved canonical facts/transitions or an explicitly versioned hypothetical-analysis boundary.
- Structural improvement, Equity, strategy recommendation, and opponent response are four different claims.
- Supplied ranges retain subject, role, source, version, known coverage, and uncertainty. Partial range output is not normalized into whole-range truth.
- Natural-language consumers may explain these facts but cannot guess missing cards, ranges, outs, lock status, or strategic meaning.
- Expensive exhaustive claims require an explicit workload, cancellation, and unavailable state rather than a shortcut label.

## Preserved interactions and microfeatures

### `CARD-OUTCOME-PREVIEW-001`

This historically preserved interaction remains desired and must not disappear again.

Hovering or keyboard-focusing a concrete out or hypothetical card should:

1. preview the hypothetical canonical resulting state;
2. show every available Hero card in that state, up to seven total cards;
3. visually emphasize the canonical evaluator-selected best five;
4. dim or de-emphasize unused cards instead of hiding context;
5. show the exact resulting hand and kicker/tiebreak structure;
6. provide keyboard-focus functionality equivalent to mouse hover, with an appropriate tap/disclosure equivalent where needed;
7. make the hypothetical state visually and semantically distinct from the actual canonical state;
8. avoid implying Equity unless Equity has been separately calculated for that hypothetical state.

This is a structural hand-outcome preview, not an alternate evaluator, a strategy recommendation, or a hidden Equity calculation.

### Concise default result

Default result tiles should remain concise:

```text
J-high Straight
Current nuts
Redraw: Straight Flush · 2 direct cards
```

Expanded Hand Details may expose the deeper facts in this dossier. Avoid badge soup, repeated labels, or presenting every structural fact at equal visual weight.

### Workspace composition

Player inputs should use a bounded composition that scales from two through ten players without pushing Board, Dead Cards, method, progress, or the principal result out of practical reach. Side rails or stacked groups are valid candidates when they improve the job. Optional player names should follow one consistent identity/display rule where useful.

After calculation, the Equity result is the primary output and should visually dominate supporting configuration. Expanding result detail must not make every player tile grow or unnecessarily recompose the workspace. Input, running, result, and expanded-detail states should preserve orientation and direct access to method/provenance.

## Cross-surface applicability

- **Equity:** applicable for current hands, exact results, split-pot explanation, and runout inspection.
- **Analyze:** applicable when exact cards and concrete outs/runouts exist.
- **Deep Hand Review:** applicable to a selected street or hypothetical runout inspection.
- **Training:** applicable after an answer when factual post-answer analysis exposes concrete outs; it must not leak answers prematurely.
- **Runout Explorer:** primary future consumer.
- **Personal Strategy Matrix/Builder:** normally not applicable; those surfaces model intended action evidence, not current seven-card outcomes.

Every consumer uses one semantic owner and interaction language. None may reimplement poker ranking or silently attach strategic meaning.

## Presentation depth

- **Facts:** dense exact hand, best-five, draw/path, blocker, standing, method, and provenance data for advanced users.
- **Explain:** concise supported explanation of how the hand is formed, what a completion card does, or why tie and Equity differ.
- **Coach / Summary:** only cross-decision or study synthesis supported by saved evidence; never generic motivational prose or invented advice.

Advanced users must be able to remain in facts-only presentation.

## Dependencies

- Canonical cards, evaluator, Equity, and Game Rules under `shared/poker-domain/`.
- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md) for supplied weighted ranges and unknown-preserving conditioning.
- [ANALYSIS_RANGE_SPEC.md](../ANALYSIS_RANGE_SPEC.md) for the current factual analysis boundary.
- [DECISION_CONTEXT_SPEC.md](../DECISION_CONTEXT_SPEC.md) when price, pot, live stacks, or decision history participate.
- [LEARNING_EVIDENCE_FOUNDATION.md](./LEARNING_EVIDENCE_FOUNDATION.md) for durable historical evidence and source identity.
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md) for evidence-grounded explanation.
- [INTERACTION_GRAMMAR.md](../INTERACTION_GRAMMAR.md) for hover/focus/inspect, hypothetical state, card identity, and unavailable semantics.

Weighted range-to-Equity work requires a separately approved versioned request boundary; current `equity-request/v1` cannot express weighted opponents.

## Suggested implementation slices

These are possible future ticket boundaries, not roadmap priority:

1. Canonical exact-hand description and best-five detail contract.
2. Draw taxonomy hardening: made hand, direct completion, redraw, and conditional path separation.
3. Nut-tier, vulnerability, entered-hand lock, and exhaustive universal-lock contracts.
4. `CARD-OUTCOME-PREVIEW-001` over the shared hypothetical outcome boundary.
5. Runner-runner path grouping and Runout Explorer.
6. Range-relative standing, domination, and clean/dirty improvement analysis after weighted comparison inputs exist.
7. Facts/Explain projections and split-pot explanations over canonical results.

## Competitive/reference lessons

No new market research is performed by this dossier. Existing Riverline product lessons favor a compact principal result, strict hierarchy, expandable rigor, visible source/method facts, and advanced-user access to dense information. Competitor-like score theater, badge accumulation, or unsupported solver certainty is rejected.

## Failure modes / non-goals

- Do not count a Turn card that only creates River outs as a current direct out.
- Do not call current nuts a lock or universal lock without exhaustive proof.
- Do not turn a range percentile, hand-strength band, or Equity percentage into strategy truth.
- Do not call a blocker good or bad without a strategic reference frame.
- Do not normalize partial/unknown range evidence into a full distribution.
- Do not double-count overlapping physical completion cards.
- Do not use a category improvement as proof that Hero wins.
- Do not let a renderer or natural-language layer evaluate hands or enumerate outs.
- Do not imply Equity in a structural card preview.
- Do not persist redundant evaluator/Equity projections when they can be deterministically derived from canonical evidence and source versions.
- Do not introduce another Equity engine, deck, range, or poker-state authority.

## Open product questions

- Which exact detail belongs in the default tile versus expanded Hand Details?
- How should equivalent runner-runner paths be grouped while retaining exact-card inspection?
- Which reference statistic, if any, should define qualitative standing bands?
- What exhaustive workload limits, cancellation, and caching policy are appropriate for universal-lock and vulnerability analysis?
- How should touch disclosure preserve `CARD-OUTCOME-PREVIEW-001` without making hypothetical state look current?
- Which first weighted-range and multi-opponent comparison boundary is valuable enough to version?
- When should a hypothetical card trigger a separate Equity request versus remain structural only?

## Legacy/recovered IDs and ideas

- `CARD-OUTCOME-PREVIEW-001` — **PRESERVED** here with all-cards context, evaluator-selected best-five emphasis, unused-card dimming, exact result/kickers, keyboard parity, and distinct hypothetical-state semantics.
- `EQUITY-HAND-ANALYSIS-001` — **PRESERVED** as the broader structured hand/runout/nut/blocker direction.
- `RANGE-VS-RANGE-001` — **PRESERVED**, shared with [RANGE_EVOLUTION.md](./RANGE_EVOLUTION.md); it requires a versioned weighted Equity/Analysis boundary.
- Existing exact/seeded Equity and the current direct-outs foundation — **IMPLEMENTED**, but they do not imply the future depth above.

## Related specs/capabilities

- [ANALYSIS_RANGE_SPEC.md](../ANALYSIS_RANGE_SPEC.md)
- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md)
- [ARCHITECTURE_CONTRACT.md](../ARCHITECTURE_CONTRACT.md)
- [BLUFF_EXPLOIT_ANALYSIS.md](./BLUFF_EXPLOIT_ANALYSIS.md)
- [RANGE_EVOLUTION.md](./RANGE_EVOLUTION.md)
- [DEEP_HAND_REVIEW.md](./DEEP_HAND_REVIEW.md)
- [RANDOM_SPOT_GENERATOR.md](./RANDOM_SPOT_GENERATOR.md)
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md)
