# Reference Strategy Evolution

Source intake continuation is specified in [Reference Source Foundation v1](../REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md)
with [acquisition research](../REFERENCE_SOURCE_ACQUISITION_2026_09.md). Preserve
local user-source ownership and rights separately from source authority, exact
coverage and assessment. Future durable import must define historical evidence,
export/sync exclusions and owner lifecycle before activation; it must not infer
these from a private flag or the solver brand.

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning authority remains in the [Product Backlog](../PRODUCT_BACKLOG.md), [Current Phase](../CURRENT_PHASE.md), and [Roadmap](../ROADMAP.md).

## Product purpose

Riverline should evolve from its useful deterministic heuristic fallback toward trustworthy, bounded reference strategy without overstating what any source knows. The first production step is a validated reference pack/provider for a deliberately narrow poker context, with exact assumptions, explicit coverage, declared capabilities, and honest fallback everywhere else.

This capability is an evidence and product-authority program. It is not a promise that Riverline currently contains solved GTO strategy, and it is not a solver implementation plan.

## User jobs / why it matters

- Know which strategy source produced a recommendation and which version was used.
- See whether that source covers the exact rules, positions, stacks, action sequence, and sizing tree in the current decision.
- Compare Riverline with a trusted bounded reference without turning a nearby-but-different solution into false precision.
- Understand when Riverline has fallen back to a generalized heuristic and what that limitation means.
- Reproduce a historical comparison without silently substituting a newer source or policy.
- Benefit from future learned providers only when trustworthy data proves a measurable improvement.

## Existing foundation

- [Strategy Source Authority and Claim Policy](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) owns source identity, provenance, authority, coverage, capabilities, and permitted product claims.
- [Reference Benchmark](../REFERENCE_BENCHMARK_SPEC.md) owns source-agnostic research observations and comparison. Benchmark observations are evidence, not production strategy data.
- [Reference Benchmark First Capture Plan](../REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN.md) records the bounded first manual comparison design and its limitations.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md) is the current versioned strategy input boundary.
- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) keeps every production source behind `StrategyProvider v1` and keeps solver, dataset, and model research outside the production runtime.
- The deterministic heuristic under `app/src/strategy/` remains a generalized comparative fallback. Its usefulness does not grant solved, Nash, GTO, exact-EV, or objective-correctness authority.

These foundations do not establish a validated general reference provider. Current capability and limitation status remains in the [Product Backlog](../PRODUCT_BACKLOG.md).

## Durable accepted decisions from `REFERENCE-PACK-001`

- `reference-pack/v1` is the declarative bounded pack contract; its first
  representation is exactly the canonical 169 preflop classes.
- Exact pack selection is centralized in StrategyProvider through
  `reference-pack-context-matcher/v1`; consumers remain source-agnostic.
- The matcher requires canonical DecisionContext v1.1 history plus an additive
  exact Game Rules projection, stacks, positions, tree, economics, cold-action
  semantics, legality, and hand class. It never interpolates.
- A validated pack is indexed by canonical hand class and returns a normal
  StrategyResult. Any mismatch uses the separately labelled existing heuristic
  fallback without mixing data.
- Synthetic fixtures require an explicit test gate and never become production
  truth. Production registration requires accepted validation and explicit
  permitted redistribution/repository inclusion.
- V1 never grants optimality. Normative grading requires an independently
  accepted `validated_reference`; distribution, sizing, EV, grading, and
  optimality remain separate capabilities.
- The preferred first intake remains six-max BB cold response to a BTN 2.5bb
  open at exact no-rake/no-ante 100bb assumptions, but no production source has
  been accepted. Source acquisition resumes only with defensible legal rights,
  exact assumptions, immutable data, and predeclared independent validation.

The implementation contract and current blocker are owned by
[Reference Pack v1](../REFERENCE_PACK_V1_SPEC.md).

## Desired future behavior

### Trusted bounded reference first

The first reference pack/provider should cover one exact, reproducible family rather than claim broad poker knowledge. Its manifest and matcher should make all material assumptions explicit, including:

- game and mathematical-rules identity;
- table size and exact decision role;
- positions and action sequence;
- starting and effective stacks;
- blinds, antes, rake or collection policy;
- supported open, call, raise, and all-in sizes;
- sizing-tree and terminal-action assumptions;
- card or hand representation where relevant;
- multiway or heads-up boundary;
- source version, production version, license, redistribution rights, and provenance.

An exact match may use only the capabilities justified by validation. A mismatch is unsupported for that pack and routes to another approved provider or the existing fallback. Coverage must never be widened merely because a result looks plausible.

### Reference intake and validation

Research intake may accept manual observations, public references, properly licensed data, or reproducible solver-derived observations through a validated versioned format. Intake should:

- preserve the original source and visible assumptions;
- validate structure before comparison;
- distinguish exact, comparable-with-caveats, and incomparable contexts;
- retain raw observations as well as normalized comparison values;
- record missing or unknown assumptions rather than invent them;
- keep proprietary observations private unless redistribution is explicitly permitted;
- produce validation evidence without registering the input as a production provider.

The old generic source-intake idea is therefore preserved only through this bounded research-to-production gate. Arbitrary solver-tree upload is not revived.

### Systematic fallback calibration

Reference evidence may reveal systematic fallback failures by role, position family, stack, price, sizing family, or hand structure. Improvements should target causal families and permanent invariant/quality corpora, not one-off hand exceptions. Calibration does not upgrade heuristic authority and must not blur exact reference coverage with generalized fallback behavior.

### Datasets and learned providers

A dataset is justified only after trustworthy reference or independently validated target data exists, its assumptions and licensing are known, and it supports a concrete evaluation question. A learned provider enters only behind `StrategyProvider v1`, with:

- stable model/source identity and version;
- reproducible training and evaluation provenance;
- explicit input and output contract;
- held-out validation against trustworthy labels;
- exact declared coverage and abstention behavior;
- measured comparison with simpler deterministic alternatives;
- declared capabilities and limitations.

Heuristic-generated labels must never be repackaged as GTO truth. Being learned, solver-derived, or commercially branded grants no authority by itself.

## Structured facts / evidence required

For a production reference source, retain enough structured evidence to answer:

- What source, version, family, authority, and method produced the result?
- What exact rules, rake, table, positions, stacks, actions, and sizes does it support?
- Which context matcher version established coverage?
- Which capabilities are independently justified: dominant action, quantitative distribution, normative grading, sizing, EV, or none of these?
- What validation corpus, metrics, sample boundaries, and known failure regions support those capabilities?
- What licensing, redistribution, and privacy restrictions apply?
- What pack or artifact identity and integrity information allow reproduction?
- Which provider or fallback handled unsupported contexts?

Where a historical judgment or review is stored, source identity, source version, resolved authority, coverage, relevant capabilities, and limitations must be preserved with that judgment. A future Riverline version must not silently reinterpret old evidence using only today's registry.

## Authority, provenance and uncertainty rules

- Source identity, provenance, authority, coverage, capabilities, validation, and confidence are separate facts.
- Provenance says where something came from; it does not prove that it is correct.
- A source family such as `reference_pack`, `learned`, or `solver-derived` grants no claim on its own.
- Exact claims require exact-enough context coverage and the corresponding declared, validated capability.
- Unknown assumptions remain unknown. A nearby stack, size, rake model, or action tree is not an exact match.
- Benchmark observations remain research evidence until a separate production-pack review establishes licensing, validation, coverage, authority, fallback, and claim policy.
- Consumers use the shared claim policy. They do not branch on source IDs or infer authority from branding, probability shape, or a confidence number.
- Reference strategy, intended Personal Strategy, observed behavior, and opponent policy remain distinct semantic roles.
- Unsupported output must remain visibly unsupported or use a truthfully labelled fallback; it must not be interpolated silently.

## Preserved interactions and microfeatures

- Inspect source name, version, assumptions, coverage, precision, limitations, and licensing-safe provenance.
- Compare the current result with a named bounded reference while retaining both contexts and differences.
- Explain why a pack does not cover the current decision and which fallback is active.
- Reproduce a benchmark or stored comparison from versioned source/context facts.
- Filter validation findings by role, stack, size, action family, discrepancy type, and coverage reason.
- Preserve raw observations beside normalized mappings so normalization never erases source evidence.
- Keep source selection and fallback semantics consistent across Playbook, Training, Matrix, Analysis, and Review.
- Surface high-risk unsupported assumptions without flooding every cell or action with repeated disclaimers.

## Cross-surface applicability

- **Playbook:** recommendation, source, coverage, precision, and concise limitation.
- **Training:** source-aware comparison and grading language; no objective-correctness claim unless authorized.
- **Matrix:** one provider-backed projection with workspace-level source/coverage facts; no per-cell source guessing.
- **Analysis:** structured source facts, assumptions, limitations, and supported comparisons.
- **Full Hand / Deep Review:** decision-by-decision reference comparison only for reconstructable, covered contexts.
- **Saved knowledge:** if a resolved strategy judgment is frozen, preserve the exact source/version/coverage/capability snapshot rather than merely a current source name.
- **Personal Strategy:** compare as a separate role; never overwrite intended evidence or call it the reference.
- **Opponent Intelligence:** exploit or opponent-policy evidence stays separate from reference authority.

## Presentation depth

- **Facts:** exact source/version, assumptions, coverage result, capabilities, raw distributions or supported values, validation provenance, and limitations.
- **Explain:** why the source covers or misses this spot, what the fallback means, and which differences materially affect comparison.
- **Coach / Summary:** cross-decision patterns only when enough comparable, version-consistent evidence exists. It must distinguish reference alignment from objective poker correctness.

Advanced users must be able to inspect the facts without mandatory narrative.

## Dependencies

- Stable `DecisionContext`, `StrategyProvider`, `StrategyResult`, source-authority, and claim-policy contracts.
- Canonical Game Rules and PokerState facts for exact context matching.
- Legal/licensing approval for any distributable source data.
- Reproducible validation fixtures and evidence before a provider gains stronger authority.
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) for durable source/version identity in historical learning records.
- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md) for evidence-grounded explanations that remain downstream of structured facts.
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) and [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) for strict comparison-role separation.

## Suggested implementation slices

These are capability boundaries, not execution priority. Slices 2 through 5
are checkpointed as architecture with synthetic tests; production source review
within slices 1/2 remains open:

1. Versioned research-intake manifest and validation hardening around the existing benchmark path.
2. Selection of one exact first intake family and an implementation-ready coverage contract; production data remains source-blocked.
3. Pack descriptor, integrity/provenance manifest, and exact context matcher — checkpointed.
4. Provider adapter behind `StrategyProvider v1`, with unsupported fallback and no consumer-specific branches — checkpointed.
5. Validation and claim-policy acceptance across Playbook, Training, Matrix, Analysis, and Review — checkpointed with synthetic data only.
6. Bounded expansion to neighboring contexts only when independently validated.
7. Dataset feasibility study with licensing, label quality, baseline, metrics, and stop criteria.
8. Learned-provider experiment only if it beats an appropriate deterministic baseline on trustworthy held-out evidence.

## Competitive/reference lessons

Existing Riverline reference work establishes that competitor or external output is evidence, not product authority. Exact assumptions and action mappings matter more than a familiar brand name. Paid or proprietary observations can inform private comparison, but they do not become repository fixtures or production data without permission. A single observation, aggregate range width, or similar-looking frequency never proves GTO correctness, exploitability, or production coverage.

No new web research is introduced by this dossier.

## Failure modes / non-goals

- No solver implementation program in this dossier.
- No production ONNX/model runtime, remote strategy API, or arbitrary tree loader.
- No training a model on heuristic labels and marketing the output as GTO.
- No source-name or solver-brand authority shortcuts.
- No extrapolating exact coverage across different rules, rake, stacks, roles, actions, sizes, or street families.
- No copying or redistributing proprietary strategy data.
- No UI-specific reference math, coverage matching, or claim policy.
- No hand-specific heuristic patches presented as reference calibration.
- No requirement that learned models be used if a simpler provider remains more accurate, transparent, or maintainable.

## Open product questions

- Can the preferred exact BB-versus-BTN family acquire a production-safe,
  independently defensible source, or should a better licensed/reproducible
  bounded family replace it?
- What licensing and redistribution model is acceptable for that family?
- Which validation evidence and acceptance thresholds justify each declared capability?
- How should users select a source, and when should fallback selection be automatic versus explicit?
- Which assumptions and limitations belong in concise UI versus expanded facts?
- When must Saved review freeze the historical `StrategyResult` rather than re-resolve the current provider?
- What concrete evidence would justify a dataset program or learned provider over deterministic expansion?
- Which neighboring contexts should remain unsupported instead of interpolated?

## Legacy/recovered IDs and ideas

- `POKER-SOURCE-INTAKE-001` — **SUPERSEDED** by validated research intake, source authority, benchmark evidence, and a separately approved bounded provider; arbitrary tree upload stays rejected.
- `PROD-IMPORT-001` — **PRESERVED / EVOLVED** as that validated, provenance-aware intake path; unlike arbitrary upload, the historical idea already required validation.
- `REFERENCE-PACK-001` — **CHECKPOINTED / INTENTIONALLY INCOMPLETE**: contract,
  validation, strict matcher, provider adapter, fallback, and consumer path are
  implemented; production source acquisition remains open.
- `FALLBACK-CALIBRATION-002` — **PRESERVED** as systematic evidence-driven family calibration; completed narrow repairs do not imply broad completion.
- `DATASET-001` — **PRESERVED**, dependency-gated by trustworthy labels, licensing, and a measurable evaluation purpose.
- `MODEL-PROVIDER-001` — **PRESERVED**, dependency-gated; the provider contract exists, but no production learned provider is implied.
- `PROD-SOLVER-001` / `PROD-CLOUD-001` — **PRESERVED** only as isolated, bounded, reproducible research; optional external compute must be measured and explicitly spend-capped and never becomes production authority.
- Historical benchmark/reference-pack ideas are preserved as versioned, provenance-rich evidence, never as authority by filename or branding.

## Related specs/capabilities

- [Strategy Source Authority and Claim Policy](../STRATEGY_SOURCE_AUTHORITY_SPEC.md)
- [Reference Benchmark](../REFERENCE_BENCHMARK_SPEC.md)
- [Reference Benchmark First Capture Plan](../REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN.md)
- [DecisionContext](../DECISION_CONTEXT_SPEC.md)
- [Architecture Contract](../ARCHITECTURE_CONTRACT.md)
- [Reference Pack v1](../REFERENCE_PACK_V1_SPEC.md)
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md)
