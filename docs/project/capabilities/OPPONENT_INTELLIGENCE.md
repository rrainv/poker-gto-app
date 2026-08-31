# Opponent Intelligence

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

## Product purpose

Opponent Intelligence is Riverline's future capability for describing and using explicit, evidence-bounded behavior assumptions about populations, configurable policies, recurring opponents, and Training agents. Its purpose is to help a user reason about how an opponent may differ from a selected reference while keeping observation, approximation, and strategic authority honest.

It is not poker astrology, surveillance, or permission to turn a nickname such as “aggressive player” into a strategy fact. This dossier creates no runtime. A bounded `OpponentPolicy v1` contract and deterministic `basic` Full Hand policy already exist in code; the broader evidence/model product described here does not.

## User jobs / why it matters

Users should eventually be able to:

- record or import context-conditioned observations without overgeneralizing them;
- see what sample, environment, time period, and assumptions support a tendency;
- distinguish population behavior, a configured Training policy, and a model of a recurring real person;
- understand how observed actions reweight a supplied range;
- compare reference strategy, opponent assumptions, exploit analysis, and Personal Strategy without merging them;
- practice against a transparent behavioral policy and review where its assumptions mattered;
- see uncertainty and ask what Riverline needs to observe next;
- update, version, pause, delete, or roll back user-owned opponent assumptions.

## Existing foundation

- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) separates source identity, authority, coverage, capabilities, and permitted claims. Opponent behavior must remain a distinct semantic role.
- [Range Core](../RANGE_CORE_SPEC.md) owns canonical combo identity, weighted ranges, conditioning, provenance, and unknown-versus-zero semantics.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md) supplies bounded decision facts without inventing missing Scenario history.
- [Personal Strategy Foundation](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md) demonstrates stable profile/mode identity, immutable evidence, explicit observation semantics, contradictions, and privacy boundaries; opponent evidence cannot reuse Personal Strategy authority implicitly.
- [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md) owns structural Training targets only; a future opponent policy cannot bypass the canonical legal generator.
- [Analysis Range specification](../ANALYSIS_RANGE_SPEC.md) permits analysis of explicitly supplied ranges but does not infer a missing range or choose strategy.
- [Home Game Organizer](../HOME_GAME_ORGANIZER_SPEC.md) remains a separate accounting/session domain. Any friend-profile relation requires an explicit, privacy-safe link rather than coupling ledgers to poker models.
- `app/src/application/opponent-policy.mjs` implements a strict DOM-free `OpponentPolicy v1` interface with explicit heuristic-archetype provenance, deterministic legal action selection, and a built-in `basic` policy. `automated-hand-progression.mjs` assigns and applies it for Full Hand progression through canonical legality.

Riverline therefore has a bounded production bot-policy foundation, but no approved real-person profiling store, population evidence model, custom-policy persistence, user-facing archetype system, or claim that a bot predicts a human opponent. The `basic` policy is not reference strategy and is not a product-complete bot personality system.

## Desired future behavior

Opponent observations should be context-conditioned and auditable. Prefer:

> In 43 comparable BTN-versus-BB flop decisions, this player check-raised 21%.

Avoid:

> This is an aggressive player.

Where appropriate a tendency should include:

- the exact or mapped context family;
- observed opportunity count and action count;
- sample size and uncertainty/confidence method;
- comparison baseline or reference population;
- source and collection provenance;
- environment, table/rules identity, stack/position/street/action conditions;
- observation time range, recency policy, and model version;
- known selection bias, missing observations, and incompatible contexts.

Potential model types include:

- **population/environment model:** a bounded description of an environment or pool;
- **generic configurable policy:** user-selected behavioral parameters for study;
- **recurring real-opponent model:** consent/privacy-aware observations tied to a stable user-owned identity;
- **Home Game/friend profile:** an optional explicit relation to an organizer identity, never implicit from accounting data;
- **custom Training policy:** a transparent policy used to generate opponent decisions in legal full-hand practice.

### Action-conditioned range calibration

The long-term direction is:

```text
starting range
    -> observed action
    -> explicitly reweighted range
    -> next observed action
    -> further explicitly reweighted range
```

Each transition needs the action, sizing, state context, policy/model identity, method, provenance, and uncertainty. Reference range, opponent-model range, observed empirical distribution, and Personal Strategy range remain distinct.

### Bot personalities

Labels such as Calling Station, Nit, TAG, or Aggressive Reg may be friendly presentation shorthand only after they map to explicit behavioral policy parameters and bounded context behavior. The label does not determine actions by itself and is not evidence about a real person.

A future Training choice such as “Train against Alex — Home Game model” must show the evidence scope and warn that the policy is an approximation, not a prediction of Alex.

## Structured facts / evidence required

An opponent observation or policy result should be able to identify:

- stable model/policy identity, owner, version, model type, and lifecycle state;
- the subject boundary: population, synthetic policy, recurring person, or imported/manual evidence;
- consent/privacy/source rules and whether hidden information was legitimately known;
- exact or mapped table/rules, positions, stacks, street, board family, prior actions, sizing, and opportunity definition;
- observation count, eligible opportunity count, action distribution, and missing/filtered cases;
- time range, recency/decay assumptions, environment, and collection method;
- baseline/reference population and whether it is comparable;
- starting range identity/provenance and each action-conditioned reweighting step;
- uncertainty method, data sparsity, conflicting evidence, and unsupported contexts;
- the output behavior/range estimate separately from any exploit recommendation;
- the versioned strategy or analysis authority used for an exploit comparison;
- links to contributing Hands/decisions where privacy and ownership allow inspection.

Raw observations, model estimates, and user configuration are different evidence classes and should not be collapsed into one score.

## Authority, provenance and uncertainty rules

- Keep **reference strategy**, **opponent model**, **exploit analysis**, and **Personal Strategy** separate.
- An opponent model describes assumed or estimated behavior; it does not define correct poker strategy.
- Exploit recommendations require explicit opponent assumptions, a compatible strategy/analysis authority, and visible uncertainty.
- Observing an action may condition a range only through a named, versioned method. It cannot reveal the opponent's actual hidden cards.
- Unknown range mass remains unknown; sparse data does not become zero-frequency behavior.
- Real-person observations require explicit ownership, privacy, consent, deletion, export, and sharing decisions before persistence.
- Home Game participation or an account relationship does not imply consent to profiling.
- A population baseline, opponent label, model confidence, or sample size does not grant normative authority.
- Current versus historical model results must remain distinguishable when a policy changes.
- Imported or manually entered claims retain their source identity and are not silently treated as Riverline-observed evidence.
- A bot policy must use canonical legal actions/state and cannot become a second PokerState, Training generator, or strategy provider.

## Preserved interactions and microfeatures

- Inspect a tendency with numerator, denominator, context, time window, baseline, provenance, and uncertainty.
- Expand from a summary to contributing compatible decisions when privacy permits.
- Compare model versions or temporarily disable/roll back an experiment without deleting evidence.
- Show the action-conditioned range before and after a selected observation.
- Select a transparent opponent policy for Training and see its assumptions before practice.
- Explain which policy assumption affected a post-hand exploit comparison.
- Distinguish a generic archetype from a named real-person approximation visually and in copy.
- Mark incompatible context, insufficient sample, stale evidence, or unavailable policy explicitly.
- Provide “Teach Riverline Next” suggestions for the contexts where another observation would reduce uncertainty.

## Cross-surface applicability

- **Analyze:** applicable for explicit opponent-range/model facts and source-separated exploit analysis.
- **Deep Hand Review:** applicable to street-by-street opponent assumptions and alternate reference-versus-exploit comparisons.
- **Training / full-hand bots:** applicable through a future versioned policy adapter while the canonical generator and grader keep their authority.
- **Range Evolution:** central to action-conditioned reweighting, with model and reference ranges kept distinct.
- **Equity:** applicable only when an explicit weighted opponent range is supplied through an approved Equity boundary; Equity does not infer the model.
- **Saved / Home:** applicable to user-owned model metadata, saved comparisons, and bounded summaries only after approved payload/privacy contracts.
- **Home Game:** optional identity relation may be applicable; accounting, settlement, and chip state are not opponent evidence automatically.
- **Personal Strategy:** may be used as an explicit synthetic opponent mode; it remains intended user strategy, not a real-person prediction.
- **Live Hand:** normally facts-first and unobtrusive; no covert real-time profiling or unsupported advice overlay.

## Presentation depth

- **Facts:** exact context, observations/opportunities, action distribution, model version, baseline, time window, provenance, and uncertainty.
- **Explain:** concise supported account of what the tendency means in this context and how it changes an explicit range/model estimate.
- **Coach / Summary:** cross-hand or cross-session pattern and study recommendation only after sufficient comparable evidence; it must state approximation and uncertainty.

Facts-only inspection remains available. Presentation labels never replace explicit policy parameters.

## Dependencies

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md);
- [Range Evolution](RANGE_EVOLUTION.md) and canonical Range Core;
- an approved versioned `OpponentPolicy`/opponent-evidence contract;
- canonical Hand/DecisionContext history and action/sizing identity;
- explicit privacy, consent, ownership, retention, deletion, export, and sharing rules;
- source-separated exploit-analysis facts;
- Training policy adapter that preserves canonical legal generation and deterministic replay;
- compatible weighted-range-to-Equity boundary before range-relative Equity claims;
- natural-language projection only after structured facts and uncertainty exist.

## Suggested implementation slices

These are possible future boundaries, not roadmap priority:

1. Define a generic configurable policy with explicit parameters and no real-person identity.
2. Add a Training-only policy adapter over canonical legal full-hand generation and post-hand review.
3. Define context-conditioned observation and opportunity facts with transparent sample/uncertainty calculations.
4. Add action-conditioned range reweighting through the Range Evolution boundary.
5. Introduce user-owned recurring-opponent identity only after privacy/consent/lifecycle decisions.
6. Add reference-versus-opponent exploit analysis as a separate facts contract.
7. Add evidence-grounded summaries and “Teach Riverline Next” only after sufficient durable observations.

## Competitive/reference lessons

Existing Riverline competitive material notes the value of rapid play against AI opponents, targeted repetition, advice, reports, and clear transitions from play to analysis. It also rejects generic coaching claims, casino-like avatar presentation, and unsupported correctness theater. See [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md).

Riverline should adapt the useful practice loop while differentiating through explicit policy parameters, provenance, uncertainty, canonical Hand continuity, and honest separation between a synthetic policy and a real person. No new competitive research was performed for this dossier.

## Failure modes / non-goals

- No vague “aggressive/passive” label as the evidence or action authority.
- No prediction claim about a real person from a configured archetype or sparse sample.
- No covert tracking, automatic Home Game profiling, or hidden-card leakage.
- No single opponent score that erases context, sample, time, and uncertainty.
- No collapse of opponent, reference, exploit, Personal Strategy, and observation roles.
- No opponent-specific strategy recommendation without an explicit model assumption and compatible analysis authority.
- No duplicate range math, PokerState, Training generator, grader, or StrategyProvider.
- No cartoon difficulty personalities whose behavior is not defined by parameters.
- No fabricated fold frequency, action response, or range when evidence is unavailable.
- No leaderboards, public player ratings, or social exposure authorized by this dossier.

## Open product questions

- What is the first useful generic policy parameter set and context scope?
- What minimum sample and comparability threshold is needed before a tendency is summarized?
- How should recency, environment shifts, and contradictory evidence affect an estimate?
- Which real-opponent observations may be stored, and what consent/deletion/export controls are required?
- Should Home Game identities ever link to opponent models, and how is explicit consent represented?
- What baseline populations are legitimate, versioned, and reproducible?
- How should users compare or roll back policy experiments without rewriting observation history?
- Which action-conditioning method is transparent enough for early Range Evolution?
- When may an exploit suggestion graduate from facts-only to Explain or Coach presentation?

## Legacy/recovered IDs and ideas

- **OPPONENT-PROFILES-001:** preserved and evolved into context-conditioned, provenance-aware opponent evidence and policy identity.
- **PROD-TABLE-003:** preserved as user-controlled table identity; a displayed name does not establish a recurring-opponent model without an explicit stable link and privacy decision.
- **PROD-TABLE-005 / PROD-TABLE-006:** preserved as notes/tendencies and later versioned opponent policies, never as unsupported labels or a second reference-strategy authority.
- **Bot personalities / recognizable player archetypes:** preserved only as presentation over explicit policy parameters; cartoon labels are not authority.
- **Custom Training policy / “Train against Alex”:** preserved with approximation, privacy, sample, and consent warnings.
- **ANALYSIS-PERSONALIZED-001:** opponent-aware analysis is a separate role from Personal Strategy personalization and selected reference strategy.

## Related specs/capabilities

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Training Intelligence](TRAINING_INTELLIGENCE.md)
- [Range Evolution](RANGE_EVOLUTION.md)
- [Bluff / Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
