# Random Spot Generator

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning authority remains in the [Product Backlog](../PRODUCT_BACKLOG.md), [Current Phase](../CURRENT_PHASE.md), and [Roadmap](../ROADMAP.md).

## Product purpose

Riverline should eventually offer a small, reusable randomization utility for constructing legal study states quickly. Users should be able to lock the parts they care about and randomize only the requested cards or bounded spot components while Riverline preserves canonical deck legality, known/dead/excluded cards, hidden-card privacy, and reproducibility where useful.

Randomization is input assistance. It is not a new poker-state authority, strategy source, opponent model, range sampler, or claim that a generated spot is representative.

## User jobs / why it matters

- Keep a specific Hero hand and generate a legal random Flop.
- Keep the Flop and explore a random Turn, River, or complete runout.
- Keep Hero and Board and generate a legal hypothetical opponent hand.
- Randomize only one component without losing carefully entered stacks, actions, cards, or locks.
- Reproduce a useful random state later with a seed and algorithm version where promised.
- Use the same Randomize/Lock language across Equity, Analyze, study Hand setup, and a future Runout Explorer.
- Understand exactly what was randomized, what stayed locked, and which unavailable cards constrained the result.

## Existing foundation

- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) identifies `shared/poker-domain/` as the one production authority for cards, PokerState, actions, evaluator, and Equity.
- [Game Rules](../GAME_RULES_V1_SPEC.md) owns immutable rules facts for canonical live states.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md) is the current strategy-facing decision snapshot; a randomizer must not invent missing authority merely to fill it.
- [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md) plans Training target envelopes, while canonical Training generation owns legal trajectories. Neither becomes a generic Random Spot Generator.
- Existing Hand, Scenario, Equity, and Analysis controllers own their source-state selection and validation.

There is no current generic random-spot capability implied by these foundations. Future work should reuse them rather than copy deck arrays, card parsing, PokerState construction, or legal-action logic into a UI helper.

## Desired future behavior

### Card-component randomization

Potential bounded actions include:

- random Hero hand;
- random opponent hand for an explicit hypothetical/study role;
- random Flop;
- random Turn;
- random River;
- random Turn and River runout;
- random complete board where the requested street structure permits it;
- random simple spot through an approved canonical builder or generator.

Examples:

- Keep `A♠ K♠`; randomize the Flop.
- Keep the Flop; randomize Turn and River.
- Keep Hero and Board; generate one legal hypothetical opponent hand.

### Lock semantics

A lock means that the represented semantic component is unchanged by the next randomization request. Locks should be explicit and scoped:

- individual Hero, opponent, board, dead, or other exposed card slots where useful;
- a complete Hero hand or opponent hand;
- Flop as an ordered three-card street unit;
- Turn or River;
- non-card spot facts only when the owning surface defines safe component randomization.

Randomize must change only requested, unlocked components. It must not clear or normalize unrelated values as a side effect. If the request cannot be satisfied under current locks and exclusions, it should fail with a clear unavailable reason rather than unlock something silently.

### Canonical legality and street structure

- Draw only from the canonical available deck.
- Never duplicate a card across Hero, known opponents, board, dead/burned/excluded facts, or other role-specific unavailable cards.
- Respect the existing board prefix and street order. A River cannot exist without a legal Flop and Turn unless the request explicitly asks an owning canonical builder to create the missing components.
- Preserve exact rank/suit identity and poker-order presentation.
- Treat known dead, burned, and explicitly excluded cards according to the owning contract; do not collapse different provenance merely because all are unavailable for drawing.
- Validate the final request/state through the owning canonical boundary before presenting success.

### Hidden-card and privacy semantics

Unknown is not the same as an available public slot, and hidden is not permission to reveal a live value.

- Randomization must never inspect or expose hidden live opponent cards that the current observer cannot know.
- “Random opponent hand” creates an explicit hypothetical/study holding from the remaining legal deck; it does not reveal, replace, or predict a real hidden holding.
- A hypothetical holding must be visually and semantically distinct from actual canonical state.
- Observer-safe Saved/Replay states remain observer-safe after using a random utility.
- Multi-user or shared surfaces must not transmit private card identity merely because another surface can generate a hypothetical card.

### Seed and reproduction

Where reproducibility matters, a randomization result should retain:

- normalized seed or seed identity;
- randomizer algorithm/version;
- input source identity or fingerprint;
- exact locked components;
- exact requested randomization targets;
- relevant rules identity and exclusion facts;
- resulting canonical cards or state identity.

The same supported version, input, locks, exclusions, targets, and seed should reproduce the same result. A later algorithm change must not silently claim to reproduce an older recipe. Security-sensitive randomness is not implied; deterministic study reproduction and fair public randomness are different requirements.

### Simple spot generation

“Random simple spot” should be introduced only when its scope is explicit. Cards alone do not establish legal actions, pots, stacks, price, or history. A simple-spot action must call an approved canonical Scenario or Hand/Training builder for supported fields and leave unsupported facts unknown. It must not assemble a plausible-looking `DecisionContext` directly in the renderer.

## Structured facts / evidence required

A reusable randomization request/result may need:

- request and result schema version;
- source surface and source-state identity/fingerprint;
- Game Rules identity where relevant;
- observer/privacy role;
- canonical known cards by semantic role;
- dead, burned, excluded, or otherwise unavailable cards with provenance where the source distinguishes them;
- requested randomization targets;
- locked components and lock granularity;
- requested street/runout shape;
- seed and randomizer algorithm version;
- generated cards in canonical notation/order;
- final canonical validation result;
- unavailable reason when locks, exclusions, street structure, or source authority prevent generation;
- hypothetical-versus-actual provenance.

For durable reproduction, store the compact recipe plus any source/version identity that cannot be derived safely later. Do not persist a second giant copy of PokerState when the canonical source plus recipe is sufficient, and do not rely on recomputation if an older algorithm/version must remain historically exact.

## Authority, provenance and uncertainty rules

- Canonical card/deck operations and PokerState validation remain under `shared/poker-domain/`.
- A randomizer selects from legal possibilities; it does not rank hands, calculate Equity, choose strategy, grade actions, or construct opponent policy.
- Random does not mean uniform over strategically meaningful ranges unless an explicit weighted-range source and sampling contract say so.
- Uniform physical-card sampling, uniform hand-class sampling, range-weighted sampling, and policy-conditioned sampling are different operations and must never share an ambiguous “random” claim.
- Locks and targets are semantic input facts, not renderer-only decoration.
- Known, dead, burned, excluded, hidden, and unknown retain their source meanings.
- Hypothetical generated state must be clearly distinct from actual canonical state.
- A seed provides reproduction only with the matching algorithm version, input, locks, exclusions, and targets.
- Failure to satisfy locks or legality is an unavailable result, not permission to relax constraints silently.
- Consumers must use one shared randomization contract and interaction language; they do not implement local deck math.

## Preserved interactions and microfeatures

- Lock/unlock an individual supported component with a programmatic label and visible state.
- Randomize only the selected component or component group.
- “Keep Hero → randomize Flop,” “Keep Flop → randomize Turn + River,” and “Keep Hero + Board → random legal opponent hand.”
- Show which cards/facts were preserved, generated, or unavailable.
- Provide keyboard and pointer equivalence for lock and randomize actions.
- Preserve card rank+suit identity across themes, languages, and RTL chrome.
- Visually distinguish generated hypothetical state from current actual state.
- Copy or reveal a reproducibility seed/recipe where the product promises reproduction.
- Re-run the same recipe or request a new seed deliberately.
- Fail clearly when too many cards are locked/excluded or street prerequisites are missing.
- Keep Randomize/Lock semantics consistent across applicable consumers through the [Interaction Grammar](../INTERACTION_GRAMMAR.md).

## Cross-surface applicability

- **Equity:** applicable to Hero/opponent hands, board/runout, and possibly dead-card-aware inputs through the canonical Equity request path.
- **Analyze:** applicable to hypothetical exact cards, boards, or supported simple Spots; never mutates the analyzed actual state silently.
- **Study Hand setup:** applicable through canonical Hand initialization or an approved setup builder.
- **Runout Explorer:** natural future consumer for legal Turn/River card or class exploration.
- **Deep Hand Review:** may generate an explicitly hypothetical alternate runout or branch without altering the historical Hand.
- **Training:** not automatically a consumer. Canonical Training generation already owns legal exercise trajectories; a later study-facing random action must not bypass curriculum/generator authority.
- **Saved knowledge:** may persist a random recipe only after a payload owner defines reproduction, versioning, and privacy semantics.

A random control should appear only where the owning source can validate and consume its output without creating a second state path.

## Presentation depth

- **Facts:** locked components, requested targets, unavailable-card counts and roles, seed/version, generated cards, source, and hypothetical status.
- **Explain:** why a request is unavailable, which constraints shaped the result, and what “random” distribution was used.
- **Coach / Summary:** generally not required. If a future learning surface summarizes randomized study, it must use actual session evidence and must not infer learning value from randomness alone.

## Dependencies

- Canonical deck/card identity, unavailable-card handling, Game Rules, and PokerState validation.
- Owning Scenario, Hand, Training, Equity, or Analysis application builders for non-card state.
- [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) for runout/outcome consumers.
- [Deep Hand Review](DEEP_HAND_REVIEW.md) for alternate historical branches.
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) for durable recipes or shared randomized objects.
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) if randomized study results enter durable session/review history.
- [Interaction Grammar](../INTERACTION_GRAMMAR.md) for Randomize/Lock, hypothetical state, card identity, and unavailable semantics.

## Suggested implementation slices

These are possible future boundaries, not execution priority:

1. Pure canonical card-component request/result contract with lock and exclusion validation.
2. Hero/opponent two-card and Flop/Turn/River randomization over explicit study inputs.
3. Shared Randomize/Lock interaction controller and accessible presentation.
4. Equity integration using existing request validation and dead-card semantics.
5. Analyze/study-Hand adapters through existing application builders.
6. Versioned deterministic seed/recipe and reproduction tests.
7. Privacy-safe hypothetical opponent-hand handling.
8. Runout Explorer integration.
9. Separately specified simple-spot generation only for a proven supported state family.

## Competitive/reference lessons

Riverline's existing architecture establishes the relevant lesson: reusable convenience features should consume canonical state authorities rather than recreate poker math in renderers. Existing deterministic Training and Replay work also shows that a seed or cursor is meaningful only with the versioned source and generation contract that interprets it.

No new web research is introduced by this dossier.

## Failure modes / non-goals

- No duplicate cards or draws from known dead/burned/excluded cards.
- No randomizing locked or unrequested components.
- No revealing, replacing, or predicting actual hidden opponent cards.
- No local deck arrays or poker-state construction in UI code.
- No parallel Scenario, Hand, Training, Equity, or DecisionContext authority.
- No treating random physical cards as a strategically representative opponent range.
- No hidden weighted sampling or opponent-policy assumption under a generic Random button.
- No silently generating missing Flop/Turn prerequisites for a River-only request.
- No claiming seed reproduction without algorithm/input/lock/exclusion identity.
- No mutation of an actual analyzed or historical state without an explicit apply action owned by that surface.
- No strategy recommendation, GTO claim, Equity implication, or training grade from randomization alone.
- No broad procedural hand generator disguised as a small card utility.

## Open product questions

- Which first consumer and smallest component set demonstrate enough value?
- Should seeds be generated and retained automatically, exposed only on demand, or absent until Save/Share requires them?
- Which deterministic random algorithm/versioning contract is appropriate for long-lived reproduction?
- Should Flop order be preserved as dealt order, canonical display order, or both facts separately?
- Which dead, burned, and excluded-card categories are supported by each consumer?
- Is opponent-hand generation always uniform over remaining physical combos, or may a separately selected weighted range supply an explicit alternative?
- How should a hypothetical opponent hand be displayed without suggesting knowledge of a real hidden hand?
- Which non-card facts, if any, may a “random simple spot” vary in its first bounded version?
- Can a generated result be previewed before applying it to an input surface?
- Which random recipes may be saved or shared, and what source/privacy facts must travel with them?

## Legacy/recovered IDs and ideas

- `RANDOM-SPOT-GENERATOR-001` — **PRESERVED** as a future legal study-state utility.
- Random Hero hand, random opponent hand, random Flop, random Turn, random River, random board/runout, and random simple Spot — **PRESERVED** behind canonical owners.
- Component locks, requested-component-only randomization, known/dead/burned/excluded-card legality, hidden-card privacy, and deterministic seed/reproduction — **PRESERVED invariants**.
- A separate randomizer-owned poker state, renderer deck math, or implied strategic representativeness — **REJECTED**.

## Related specs/capabilities

- [Architecture Contract](../ARCHITECTURE_CONTRACT.md)
- [Game Rules](../GAME_RULES_V1_SPEC.md)
- [DecisionContext](../DECISION_CONTEXT_SPEC.md)
- [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md)
- [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Interaction Grammar](../INTERACTION_GRAMMAR.md)

