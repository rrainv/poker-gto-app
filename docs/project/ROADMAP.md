# Riverline Roadmap

Last refreshed: August 26, 2026 (`TABLE-PHYSICALITY-003` completed as an accepted implementation checkpoint with explicit presentation debt; `HOME-GAME-001B` is active next).

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

1. Finish visible product quality before returning to deep reference work; structural correctness alone did not satisfy human acceptance.
2. Establish one trusted bounded reference provider before treating Training disagreement as normative or expanding model ambitions.
3. Preserve durable learning evidence before building longitudinal summaries, re-drill, or mastery claims.
4. Review the unified Personal Strategy experience before integrating it into provider and Training paths.
5. Propagate ranges and expand Saved object types only through approved combo/evidence/persistence contracts.
6. Add opponent policies after Hand, Review, Training, and reference foundations can use them truthfully.
7. Keep release/mobile/social/PLO behind product, privacy, data, and game-domain maturity.

The completed dossier migration records more possibilities; it does not promote them.

## Current directional sequence

1. **COMPLETED — `DOCS-CAPABILITY-DOSSIERS-001`** — one-time recovery, dossier architecture, interaction grammar, and planning simplification; no product implementation.
2. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT — `TABLE-PHYSICALITY-003`** — human acceptance passed scale and overall table coherence as sufficient to move on; revealed-opponent card inspectability remains explicit return debt.
3. **ACTIVE NEXT — `HOME-GAME-001B`** — complete the next organizer-management and browser-acceptance slice.
4. **`SETTINGS-IA-001`** — simplify Settings information architecture and help discovery.
5. **`PREMIUM-CLOSEOUT-001`** — whole-app visual, responsive, localization, accessibility, Guide, and human closeout.
6. **First trusted bounded reference pack/provider** — exact assumptions, coverage, validation, licensing/provenance, capabilities, and fallback.
7. **Training Memory / re-drill** — durable history, review queue, same/similar spot, scheduling, filters, and truthful trends.
8. **`PERSONAL-STRATEGY-002R`** — independent real-user review.
9. **Personal Strategy integration** — preserve intended/reference/observed roles and explicit Training-evidence opt-in.
10. **`PERSONAL-INSIGHTS-001`** — evidence-aware Teach Riverline Next and supported summaries.
11. **`RANGE-EVOLUTION-001`** — canonical combo-level action-conditioned range propagation.
12. **`HOME-002B`** — Saved Study Library over approved versioned payloads.
13. **OpponentPolicy / bots** — provenance-aware behavior contracts and later full-hand practice.
14. **Release/mobile/social/PLO later** — only after their prerequisites and explicit decisions.

## Phase A — visible product closeout

Completed `TABLE-PHYSICALITY-003`, followed by active-next `HOME-GAME-001B`, then `SETTINGS-IA-001` and `PREMIUM-CLOSEOUT-001`, forms the current visible-product sequence. Accepted table/card and Review-navigation debt stays routed through the Return Queue rather than reopening the completed table ticket. The default must be strong before more customization. Controls First, the ineffective density selector, arbitrary layout editing, casino spectacle, fake cinematic 3D, avatars by default, and reward theater remain rejected.

Real-browser/human judgment remains required for hierarchy, balance, readability, and aesthetics. Known acceptance debt stays in the QA Backlog and Return Queue rather than expanding this roadmap.

## Phase B — trusted reference strategy

Choose one reproducible bounded preflop family and prove exact Game Rules/rake, stacks, sizing tree, coverage matching, provenance/licensing, validation, and unsupported fallback. Source branding never grants authority; private benchmark observations never become production packs. Broader coverage and learned models follow only when measured evidence justifies them.

Detailed direction: [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

## Phase C — persistent learning

Training evolves from legal deterministic exercises into a history-aware learning loop. Durable decision/session evidence enables review queues, same/similar re-drill, spaced/adaptive scheduling, Saved/Home continuity, and summaries that remain honest about the selected source.

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

Security, data-integrity, or release blockers may interrupt the sequence. These include live Supabase migrations/RLS and multi-profile acceptance, targeted architecture extraction when real work touches the seam, privacy/legal/packaging/offline/observability decisions, and human EN/RU/HE/RTL/responsive/accessibility acceptance.

Mobile receives a deliberate composition, not stacked desktop panels. PLO remains a separate game/evaluator/range/reference domain. Public release, monetization, telemetry, restrained study goals/streaks, sharing permissions, and table customization remain explicit product decisions.

## Priority rule

Alternate visible product progress with trustworthy intelligence/foundation work. A dossier, audit, competitor, or attractive microfeature cannot become priority by documentation alone. Reprioritization updates Current Phase, this Roadmap, and the affected Backlog record together.
