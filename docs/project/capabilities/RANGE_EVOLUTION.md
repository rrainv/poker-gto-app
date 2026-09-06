# Range evolution

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning navigation: [PRODUCT_BACKLOG.md](../PRODUCT_BACKLOG.md), [CURRENT_PHASE.md](../CURRENT_PHASE.md), and [ROADMAP.md](../ROADMAP.md).

## Product purpose

Range Evolution should let Riverline follow a provenance-bearing combo-level range through exact actions, sizes, board cards, and streets. A user should be able to inspect what remains, what changed, why it changed, and which facts are known, partial, inferred, or unavailable at every point in a hand.

The central direction is:

```text
canonical weighted preflop range
  -> exact action conditioning
  -> flop range
  -> exact action conditioning
  -> turn range
  -> exact action conditioning
  -> river range
```

This is a derived analytical trajectory, not a new poker state, action history, strategy source, or evidence store.

## User jobs / why it matters

- See how an explicitly sourced preflop range narrows or changes after each exact action and size.
- Inspect the effect of flop, turn, and river card removal without treating unknown combos as folds.
- Compare reference, Personal Strategy, observed, and opponent-model trajectories without merging them.
- Understand which combo classes, hand categories, value/bluff regions, or draws gained or lost mass.
- Trace every derived range back to its prior range, action strategy, board, and source versions.
- Keep partial evidence partial and see why a range or conclusion is unavailable.
- Review one hand street by street with ranges synchronized to the canonical timeline.
- Ask for concise explanation of a meaningful change while retaining dense combo facts.

## Existing foundation

Current implemented contracts remain in:

- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md): the canonical 52-card deck, 1,326 unordered Hold'em combos, `HoldemWeightedRange v1`, known-versus-unknown weights, provenance, blocker conditioning, normalization, deterministic serialization, and derived Matrix projection;
- [ANALYSIS_RANGE_SPEC.md](../ANALYSIS_RANGE_SPEC.md): named supplied-range attachments, independent subject/role/provenance, exact blocker effects, partial coverage, and structural range composition;
- [UNIFIED_RANGE_INTELLIGENCE_SPEC.md](../UNIFIED_RANGE_INTELLIGENCE_SPEC.md): the semantics-safe action-conditioning formula and later postflop direction;
- [PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md](../PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md): intended action precision and exact-versus-dominant boundaries;
- [RANGE_CONTEXT_TRANSFER_SPEC.md](../RANGE_CONTEXT_TRANSFER_SPEC.md): a bounded derived RFI context overlay that remains separate from street propagation;
- [DECISION_CONTEXT_SPEC.md](../DECISION_CONTEXT_SPEC.md): exact action role, price, size, legality, history, pot, stack, and position facts where canonical Hand evidence exists.

The range core and the explicitly authorized `PERSONAL-STRATEGY-COACH-001` + `RANGE-EVOLUTION-001A` + [Teach-through-a-Hand foundation](../PERSONAL_STRATEGY_COACH_V1_SPEC.md) now support a bounded exact-action-conditioned Personal Strategy range study, awaiting human acceptance. The hypothetical hidden-private BTN 2.5bb open / BB call / checked-flop branch supports selected 3-10-player BTN setups at 10-500bb without ante/collection/rake. Explicit new exact-size preflop class answers supply action probabilities; canonical multiplication and public-card removal derive known positive physical flop combos for exact/preferred teaching. Exact-node intent alone is durable (store/export v3, IndexedDB v4); weighted ranges, trajectories and summaries remain derived. Historical family frequencies cannot identify a selected raise size and are never silently promoted. Core continuation is tested through an actual turn, but full preflop-to-river UI rollout, bots, weighted Equity and normative reference assessment remain absent. Current StrategyProvider resolves one concrete decision/combo at a time and does not supply a complete source-owned range. Current production Analysis attaches no weighted range; `equity-request/v1` cannot accept weighted opponents. Structural real-application save/reload UI tests do not replace pending human browser acceptance; browser inventory again returned no enabled apps/browsers.

## Desired future behavior

### Canonical trajectory

For one named subject and source role, a trajectory should preserve:

```text
starting range
  + exact observed or hypothetical action node
  + exact per-combo action frequencies where known
  -> action-conditioned range
  + new public/dead cards
  -> next-street blocker-conditioned range
```

Repeat that process for each action and street. Every node should identify its prior node, canonical hand/timeline position, board, action, size, source, and derivation version.

The UI may group or summarize nodes, but chronological and mathematical identity comes from canonical Hand/action evidence, not presentation labels.

### Combo-level action conditioning

For an eligible combo `c` and exact selected action `a`:

```text
priorRangeWeight(c)
  × strategyFrequency(a | c, exact context)
  = unnormalizedActionConditionedMass(c)
```

This multiplication is legitimate only when both terms are quantitatively known with compatible semantics.

- Known zero remains a known exclusion.
- Unknown prior weight or unknown action frequency produces unknown conditioned mass.
- Dominant-only or inferred categorical action is not an exact frequency.
- A frequency for `raise` at one size/tree cannot condition a different raise size/tree.
- A generalized source cannot silently become exact for an unmatched node.
- Derived mass may be normalized only when the eligible source is complete and has positive known mass.

A future adapter may define a versioned, explicit mapping from exact class-level strategy frequencies to physical combos. It must not assume dominant-only class evidence is uniform 100% action across every combo.

### Card removal and street progression

When public or known-dead cards appear:

- physically impossible combos become blocked/ineligible through canonical Range Core conditioning;
- source unknowns remain unknown rather than becoming known zero;
- combo identity and source provenance remain attached;
- exact before/after counts, known mass, coverage, and normalization availability remain inspectable;
- multiway subjects retain distinct ranges and card-removal constraints.

Board cards do not prove how a player acted. Actions do not invent missing board or private cards. Street state and range state remain related but separate authorities.

### Exact actions and sizes

Every conditioning step should retain:

- canonical action identity;
- amount semantics: call commitment, bet-to, raise-to, or all-in-to as applicable;
- exact size and unit;
- current pot, price, contribution, and live/effective stacks when relevant;
- preflop role/action-tree identity and postflop street/history;
- legal action set and source coverage for that exact node;
- whether the action is observed, selected reference, intended Personal Strategy, opponent-policy, or user hypothetical.

Broad labels such as `facing open`, `large bet`, or `aggressive action` may be derived grouping facts. They are not sufficient historical identity for conditioning.

### Distinct source trajectories

Reference, Personal Strategy, observed, and opponent-model ranges must remain distinct:

- **Reference range:** derived from a named source under exact/generalized/unsupported coverage.
- **Personal Strategy range:** derived only from quantitatively sufficient intended evidence and a versioned adapter.
- **Observed range:** a posterior or retained candidate set based on actual actions and an explicitly chosen prior/policy; it is not intended strategy.
- **Opponent-model range:** conditioned by a versioned population/environment/person policy with evidence and uncertainty.

An exploit projection may compare these ranges but cannot merge their weights or authorities into one `recommended range` without an explicit derivation.

### Visual range evolution

Future projections may show:

- a street/action trajectory with selectable nodes;
- 13×13 class summaries backed by exact combo entries;
- exact combo inspection and source/unknown state;
- known mass, coverage, and normalization state at each node;
- classes or categories whose mass increased, decreased, appeared, disappeared, or became unknown;
- the contribution of action conditioning versus card removal;
- side-by-side source trajectories where scopes match.

The Matrix remains a derived view. It may not hide combo-specific deviations or become range storage.

### Categories gained and lost

Where structural analysis supports it, a node comparison may describe changes in:

- pair/suited/offsuit preflop structure;
- made-hand categories;
- draw and redraw families;
- showdown-value regions;
- value, thin-value, bluff, semibluff, and bluff-catcher regions;
- blockers/unblockers and nut-tier distribution;
- range-relative Equity or advantage only through a separately approved factual boundary.

Category mass should identify known coverage and overlap semantics. Value/bluff roles require a strategic partition; evaluator category alone cannot supply them.

### Natural-language summaries

Evidence-grounded summaries may eventually say, for example:

> The flop call removes most low-equity offsuit combinations in the selected opponent model, while suited draws remain well represented.

Such a statement is allowed only when exact before/after range facts and the named model support it. The explanation should expose the affected combos/categories, action/size, source, coverage, and uncertainty.

Do not invent causal poker reasons from visual shape alone. Advanced users may view only the range facts and formulas.

## Structured facts / evidence required

- Stable trajectory, subject, source-role, and node identities.
- Canonical starting `HoldemWeightedRange v1`, including every known/unknown combo and provenance.
- Exact DecisionContext, PokerState/replay point, board/dead cards, street, position, table structure, Game Rules identity, and action history.
- Canonical selected/observed/hypothetical action and exact size semantics.
- Per-combo action frequency with source ID/version, coverage, capabilities, and uncertainty.
- Prior-node identity, transformation order, derivation version, and deterministic fingerprint.
- Blocker-conditioning facts, known/unknown coverage, known mass, and normalization availability.
- Personal Strategy evidence/snapshot precision or opponent-policy version when those roles are used.
- Range composition/value-bluff partition versions for any category-level interpretation.
- Equity request/result identity when a separately calculated range-relative outcome is shown.

## Authority, provenance and uncertainty rules

- Range Core remains the sole production authority for combo identity, inclusion weights, blockers, normalization, and range serialization.
- PokerState/Replay remain the sole canonical action/card history; a range trajectory does not replace them.
- StrategyProvider/reference, Personal Strategy, observed behavior, and opponent policy retain distinct roles and source identities.
- Inclusion weight, action frequency, inference uncertainty, and opponent-model confidence are different quantities.
- Unknown is not zero. A partial range remains partial after conditioning even if a later filter happens to remove unresolved combos.
- Derived ranges are not evidence and must not be recursively reused as if directly observed.
- Exact action-tree and sizing mismatches remain unsupported or explicitly mapped; no silent nearest-node substitution.
- Natural-language and UI layers consume structured range facts and cannot perform conditioning math independently.
- Historical review must preserve enough source/version/derivation identity that later algorithm changes do not silently rewrite what the trajectory meant.

## Preserved interactions and microfeatures

- Select any street/action node and keep the canonical table/replay selection synchronized without mutating live state.
- Hover/focus/tap a Matrix class or exact combo to inspect its prior weight, action frequency, conditioned mass, blocker state, and provenance.
- Toggle starting range, post-action range, post-card-removal range, or a side-by-side delta without changing the underlying objects.
- Filter by known, unknown, increased, decreased, removed, conflict, or source role while keeping totals truthful.
- Keep hypothetical branches visibly distinct from the actual canonical path.
- Save/bookmark only through the shared Saved Study authority after an approved range/trajectory payload exists.
- Allow a facts-only mode that exposes exact combo rows and transformation math.

## Cross-surface applicability

- **Analyze:** inspect a selected source range at one decision or compare compatible source roles.
- **Deep Hand Review:** synchronize street-by-street trajectory nodes with canonical Replay and selected Hero decisions.
- **Training:** expose range evolution after an answer when the generator/source supplies legitimate ranges; never leak a hidden answer before submission.
- **Personal Strategy:** project intended ranges only through a semantics-safe quantitative adapter.
- **Opponent Intelligence:** consume explicit opponent policies/action observations without becoming the policy authority.
- **Bluff/Exploit:** provide value/bluff/calling-region evolution when semantic partitions exist.
- **Equity:** later range-vs-range calculations require a separate weighted Equity request; Range Evolution does not calculate Equity itself.
- **Saved Study:** future Saved Range/Review relations only after their versioned payload owners exist.

## Presentation depth

- **Facts:** combo weights, action frequencies, before/after mass, known coverage, blockers, exact action/size, source, and transformation versions.
- **Explain:** concise supported description of the largest meaningful changes and their exact cause—action conditioning, card removal, or source difference.
- **Coach / Summary:** cross-hand or cross-session range-pattern synthesis only when durable evidence and compatible trajectories are sufficient.

Users can choose facts-only dense presentation. A summary must never obscure unknown mass or incompatible sources.

## Dependencies

- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md) for canonical range math.
- [DECISION_CONTEXT_SPEC.md](../DECISION_CONTEXT_SPEC.md), [GAME_RULES_V1_SPEC.md](../GAME_RULES_V1_SPEC.md), and canonical Replay for exact action/state identity.
- [STRATEGY_SOURCE_AUTHORITY_SPEC.md](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) and a future combo-aware source/provider boundary.
- [PERSONAL_STRATEGY_INTELLIGENCE.md](./PERSONAL_STRATEGY_INTELLIGENCE.md) for intended evidence and precision.
- [OPPONENT_INTELLIGENCE.md](./OPPONENT_INTELLIGENCE.md) for opponent-policy semantics.
- [EQUITY_HAND_ANALYSIS.md](./EQUITY_HAND_ANALYSIS.md) for factual hand/runout analysis and a future weighted comparison boundary.
- [BLUFF_EXPLOIT_ANALYSIS.md](./BLUFF_EXPLOIT_ANALYSIS.md) for semantic value/bluff partitions.
- [LEARNING_EVIDENCE_FOUNDATION.md](./LEARNING_EVIDENCE_FOUNDATION.md) for durable trajectory/source identity.
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md) for evidence-grounded summaries.

## Suggested implementation slices

These are possible future ticket boundaries, not roadmap priority:

1. Pure DOM-free action-conditioning contract with exhaustive known/unknown/provenance invariants.
2. One bounded exact source and preflop action node proving coverage/size matching and blocker order.
3. Versioned range-trajectory node/edge projection over canonical Hand/Replay identity.
4. Flop/turn/river card-removal progression and Matrix/combo delta inspection.
5. Deep Hand Review synchronization and facts-only trajectory presentation.
6. Personal Strategy and opponent-policy adapters, each in independent role-specific tickets.
7. Value/bluff-category and natural-language projections after semantic partitions exist.
8. Saved Range/trajectory portability and weighted Equity integration through separate approved schemas.

## Competitive/reference lessons

No new market research is performed by this dossier. Existing Riverline reference work supports dense Matrix information when hierarchy is strict, exact source assumptions remain visible, and selected-hand detail is available. Riverline should differentiate through unknown-preserving provenance and cross-surface continuity rather than imitating a solver tree without owning its data or assumptions.

## Failure modes / non-goals

- Do not treat a missing/unknown combo as known zero.
- Do not normalize a partial range into complete truth.
- Do not convert dominant-only or categorical inference into numeric action mass.
- Do not reuse a frequency across a different action tree, size, rules context, or street.
- Do not conflate reference, Personal Strategy, observed, or opponent-model trajectories.
- Do not use a Matrix average as canonical combo truth.
- Do not let card removal erase provenance or rewrite blocked unknowns as folds.
- Do not infer value/bluff roles from evaluator category alone.
- Do not describe a derived trajectory as direct evidence or recursively train inference from it.
- Do not let UI or natural-language code implement conditioning, normalization, or card-removal math.
- Do not create a second range, action-history, PokerState, Equity, or strategy authority.
- Do not present range or nut advantage until the exact statistic/reference frame is approved and calculated.

## Open product questions

- Which first source can supply trustworthy complete per-combo action frequencies for one exact node?
- Should trajectory nodes be cached/recomputed, stored durably, or frozen only for selected historical reviews?
- What minimal node/edge contract supports hypothetical branches without becoming a solver-tree upload format?
- How should multiway subjects and interdependent private-card removal be represented and computed?
- Which category/delta summaries remain useful on partial ranges?
- What versioned action-size representation is required across reference, Personal Strategy, and opponent-policy sources?
- When should an observed action update a posterior range, and which prior/policy owns that derivation?
- What is the first approved Saved Range/trajectory payload and conflict policy?
- What performance, cancellation, and invalidation budgets are appropriate for multi-node 1,326-combo analysis?

## Legacy/recovered IDs and ideas

- `RANGE-EVOLUTION-001` — **PRESERVED** as the canonical action-conditioned preflop-to-river capability family.
- `RANGE-TRAJECTORY-001` — **PRESERVED / EVOLVED** into the versioned node/edge trajectory direction here.
- `POSTFLOP-RANGE-PROPAGATION-001` — **PRESERVED / EVOLVED** under exact action, card-removal, provenance, and unknown rules.
- `RANGE-VS-RANGE-001` — **PRESERVED**, shared with [EQUITY_HAND_ANALYSIS.md](./EQUITY_HAND_ANALYSIS.md); it requires a weighted Equity/Analysis boundary.
- `RANGE-ADVANTAGE-001` — **PRESERVED**, dependency-gated on transparent range-relative statistics rather than visual inference.
- `RANGE-CORE-001` — **IMPLEMENTED FOUNDATION**; it supplies combo/range math but not trajectory behavior.

## Related specs/capabilities

- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md)
- [ANALYSIS_RANGE_SPEC.md](../ANALYSIS_RANGE_SPEC.md)
- [UNIFIED_RANGE_INTELLIGENCE_SPEC.md](../UNIFIED_RANGE_INTELLIGENCE_SPEC.md)
- [PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md](../PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md)
- [PERSONAL_STRATEGY_INTELLIGENCE.md](./PERSONAL_STRATEGY_INTELLIGENCE.md)
- [EQUITY_HAND_ANALYSIS.md](./EQUITY_HAND_ANALYSIS.md)
- [BLUFF_EXPLOIT_ANALYSIS.md](./BLUFF_EXPLOIT_ANALYSIS.md)
- [DEEP_HAND_REVIEW.md](./DEEP_HAND_REVIEW.md)
- [OPPONENT_INTELLIGENCE.md](./OPPONENT_INTELLIGENCE.md)
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md)
