# Riverline Roadmap

Last refreshed: August 27, 2026 (`HANDS-ON-DEFECTS-001` is a completed/accepted bounded repair checkpoint with explicit debt; `CORE-FLOW-CORRECTNESS-001` is active next, followed by Replay rail, Training composition, and `PERSONAL-STRATEGY-003A` before a whole-app mini-pass).

This roadmap explains major directional sequencing and why phases are ordered. [Current Phase](CURRENT_PHASE.md) owns the exact current checkpoint and execution order; [Product Backlog](PRODUCT_BACKLOG.md) owns concise capability/status. The [capability dossiers](capabilities/README.md) preserve detailed long-term intent without setting priority.

## Product north star

Riverline is becoming a local-first personal poker learning workstation:

```text
Play a complete canonical hand
  -> review important decisions and Replay
  -> compare with a selected trusted reference where available
  -> compare with intended Personal Strategy and observed behavior
  -> preserve evidence, notes, provenance, and uncertainty
  -> re-drill mistakes and similar spots
  -> learn recurring patterns over time
```

Reference strategy, intended Personal Strategy, observed behavior, opponent policy, and exploit analysis remain distinct roles. Evidence-grounded language helps users understand those roles; it never becomes their authority.

## Sequencing principles

1. Keep the visible product usable and record non-blocking visual debt, but do not repeatedly polish intermediate surfaces ahead of higher-value reference and learning work.
2. Use the checkpointed bounded-provider gate before treating Training disagreement as normative or expanding model ambitions; no accepted source means comparative semantics only.
3. Preserve durable learning evidence before building longitudinal summaries, re-drill, or mastery claims.
4. Repair confirmed high-impact visible defects before expanding another user-facing product surface.
5. Review the unified Personal Strategy experience before integrating it into provider and Training paths.
6. Do not accumulate a long run of user-facing implementation tickets without human whole-product inspection; after roughly two or three substantial visible tickets, perform a short hands-on pass and checkpoint discussion.
7. Propagate ranges and expand Saved object types only through approved combo/evidence/persistence contracts.
8. Add opponent policies after Hand, Review, Training, and reference foundations can use them truthfully.
9. Keep release/mobile/social/PLO behind product, privacy, data, and game-domain maturity.

The completed dossier migration records more possibilities; it does not promote them.

## Current directional sequence

1. **COMPLETED — `DOCS-CAPABILITY-DOSSIERS-001`** — one-time recovery, dossier architecture, interaction grammar, and planning simplification; no product implementation.
2. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT — `TABLE-PHYSICALITY-003`** — human acceptance passed scale and overall table coherence as sufficient to move on; revealed-opponent card inspectability remains explicit return debt.
3. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT — `HOME-GAME-001B`** — organizer management, visible correction/lifecycle history, safe archive semantics, and export-only portability are implemented; unavailable live acceptance remains routed debt.
4. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT — `SETTINGS-IA-001`** — four focused Settings categories, preserved preference authorities, and secondary help/tutorial discovery; live Firefox acceptance remains routed debt.
5. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `REFERENCE-PACK-001`** — pack contract, validation, strict matcher, provider/fallback, and generic consumers are implemented; production-safe source data and independent acceptance remain a named return dependency.
6. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT — `TRAINING-MEMORY-001`** — durable source-aware decision/session evidence, bounded recent history, transparent review lifecycle, exact historical Same Spot, and planner/generator-backed current Similar Spot; advanced scheduling and cross-surface continuity remain later work.
7. **COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED — `PERSONAL-STRATEGY-002R`** — accepted Game setup/Approach, local-first Guest use, RFI-first five-question value, understanding vocabulary, surface consolidation, permanent source-role separation, and bounded versioning direction; live browser/real-user acceptance remains routed debt.
8. **COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED — `HANDS-ON-PRODUCT-REVIEW-001`** — all 59 independently originated findings were manually reproduced by the product owner, preserved in one [durable evidence artifact](HANDS_ON_PRODUCT_REVIEW_2026_08.md), and routed without implementation or false closure.
9. **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT — `HANDS-ON-DEFECTS-001`** — useful local repairs are accepted after the second human pass; the anti-loop rule ends bounded corrections without claiming all HPR, Hand, or Training composition accepted.
10. **ACTIVE NEXT — `CORE-FLOW-CORRECTNESS-001`** — completed Hand to fresh Hand, accessible append-only Home Game correction/reversal, complete two-card opponent entry, and canonical min-raise verification with runtime change only if the reconstructed rule path is wrong.
11. **PLANNED NEXT — `REPLAY-RAIL-NAV-001`** — vertical street-grouped history, first-class rail actions and Current Legal Actions, compact Hand Stage, coherent cards/seat/player ownership, folded-seat readability, physical Dealer placement, contribution-line clarity, table/history/action integration, and timeline typography.
12. **PLANNED NEXT — `TRAINING-COMPOSITION-001`** — one start CTA, stable pre/post skeleton, top packing, Action History, Assistance, Memory, setup/status, and explanation depth.
13. **PLANNED NEXT — `PERSONAL-STRATEGY-003A`** — versioned migration and first-value reset with broad sparse/high-information coverage before boundary refinement.
14. **HUMAN WHOLE-APP MINI-PASS** — short freeform inspection after those four visible tickets.
15. **LIKELY NEXT / EXACT ORDER REASSESS —** `EQUITY-COMPOSITION-001`, `ANALYZE-RANGE-UX-001`, and `GAME-SETUP-EVOLUTION-001`.
16. **PLANNED LATER —** Personal Strategy provider/reference/observed integration plus explicit First Use/Home, Guide, Home Game presentation, Random Spot, Saved visual, customization, audio, and global-quality owners.
17. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`** — whole-product manual QA and release-quality acceptance after nearer visible owners; it is not the next visual ticket.
18. **Release/mobile/social/PLO later** — only after their prerequisites and explicit decisions.

## Phase A — usable visible-product foundation

Completed `TABLE-PHYSICALITY-003`, `HOME-GAME-001B`, `SETTINGS-IA-001`, and the bounded `HANDS-ON-DEFECTS-001` repair remain useful visible-product foundations. The second defect-ticket acceptance preserves successful local repairs and activates one correctness ticket for newly discovered lifecycle/input issues before structural Replay work. Repeated local Welcome/card/warning polishing stops: launch semantics move to `FIRST-USE-HOME-001`, warning presentation to `HOME-GAME-PRESENTATION-001`, and coherent table/card/seat/rail design to `REPLAY-RAIL-NAV-001`. The checkpoints do not close broader HPR findings.

Several upcoming intelligence features will materially change Training, Review, Personal Strategy, Equity, and Analysis. A release-quality polish pass therefore has higher value after those features exist. Riverline's anti-loop rule applies: repeated subjective polish must not indefinitely delay the core learning/intelligence product. `PREMIUM-CLOSEOUT-001` is deferred, not cancelled, and remains the later pre-release quality gate. Controls First, the ineffective density selector, arbitrary layout editing, casino spectacle, fake cinematic 3D, avatars by default, and reward theater remain rejected.

Real-browser/human judgment remains required for hierarchy, balance, readability, and aesthetics. Known acceptance debt stays in the QA Backlog and Return Queue rather than expanding this roadmap.

## Phase B — trusted reference strategy

The `reference-pack/v1` checkpoint proves exact Game Rules/stack/tree/legality matching, declarative validation and integrity, provider selection, policy-gated consumers, and unsupported heuristic fallback for a preferred six-max BB-versus-BTN 2.5bb intake family. No production-safe frequency corpus has been accepted, so production registration and all stronger authority/capability claims remain blocked. Resume only when exact immutable source data, compatible license/redistribution rights, reproducible or strong provenance, and independent validation evidence are available. Source branding never grants authority; private benchmark observations never become production packs. Broader coverage and learned models follow only when measured evidence justifies them.

Detailed direction: [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

## Phase C — persistent learning

Training has evolved from isolated legal deterministic exercises into a first history-aware learning loop. `TRAINING-MEMORY-001` durably preserves exact decision/session and answer-time source/claim evidence, derives bounded recent/review views, and supports historical Same Spot plus current Similar Spot without creating new poker or strategy authority. Advanced spaced/adaptive scheduling, Saved/Home/Replay/Analyze continuity, rich filters/trends, sync/export, and Personal Strategy observation remain later slices.

Detailed direction: [Learning Evidence Foundation](capabilities/LEARNING_EVIDENCE_FOUNDATION.md), [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md), and [Deep Hand Review](capabilities/DEEP_HAND_REVIEW.md).

## Phase D — Personal Strategy integration and insight

After independent review, add intended-strategy comparison without turning personal intent into normative truth. Keep selected reference and observed play explicit, preserve contradictions and sparse evidence, make Training evidence opt-in, then add evidence-backed uncertainty queues and summaries.

Detailed direction: [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md) and [Natural-Language Intelligence](capabilities/NATURAL_LANGUAGE_INTELLIGENCE.md).

## Phase E — range evolution and saved knowledge

Action-conditioned range propagation must preserve combo-level weights, exact actions, card removal, provenance, and unknowns. Saved then grows into a master-detail knowledge workspace only as approved Hand, Spot, Range, Drill, Review, and Session payload owners exist.

Detailed direction: [Range Evolution](capabilities/RANGE_EVOLUTION.md) and [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md).

## Phase F — opponent policies and full-hand learning

Create an explicit opponent-behavior contract separate from reference strategy and claims about real people. Generic, environment, custom, and Personal-Strategy-as-opponent policies may then feed legal full-hand Training, Review, Save, and re-drill continuity.

Detailed direction: [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md).

## Dependency-gated preserved capabilities

Equity/hand/runout depth, range-aware bluff/exploit work, and shared legal randomization are valuable but do not displace the current sequence. Their eventual slices depend on canonical evaluator/Equity/range evidence and the shared interaction grammar.

- [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md)
- [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md)
- [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md)
- [Home Game Evolution](capabilities/HOME_GAME_EVOLUTION.md)

## Parallel maintenance and release gates

Security, data-integrity, or release blockers may interrupt the sequence. These include live Supabase migrations/RLS and multi-profile acceptance, targeted architecture extraction when real work touches the seam, and privacy/legal/packaging/offline/observability decisions.

`PREMIUM-CLOSEOUT-001` is the planned-later pre-release quality gate for whole-product manual QA, final high-value visual debt, Guide, responsive desktop, EN/RU/HE/RTL, accessibility, cards/table/replay/Settings/theme consistency, Return Queue visual debt, and release-quality Core Flow acceptance. It should run when the product feature set is materially more mature, before a public or equivalent release-quality milestone.

Mobile receives a deliberate composition, not stacked desktop panels. PLO remains a separate game/evaluator/range/reference domain. Public release, monetization, telemetry, restrained study goals/streaks, sharing permissions, and table customization remain explicit product decisions.

## Priority rule

Advance the highest-value trustworthy product foundation while keeping visible debt explicit and non-blocking unless evidence proves otherwise. A dossier, audit, competitor, or attractive microfeature cannot become priority by documentation alone, and subjective polish cannot become an indefinite loop. Reprioritization updates Current Phase, this Roadmap, and the affected Backlog record together.
