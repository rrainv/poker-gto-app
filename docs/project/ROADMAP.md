# Riverline Roadmap

Last refreshed: September 1, 2026 (`AUTH-SUPABASE-SINGLETON-001` is accepted; `ANALYZE-SCENARIO-READINESS-001` now leads the remaining foundational gates).

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
10. **COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT — `CORE-FLOW-CORRECTNESS-001`** — final hands-on acceptance preserves the fresh-Hand lifecycle, generalized session-level append-only corrections with optional reason, continuous two-card known-opponent picker, and verified canonical min-raise/reopening semantics without a poker-domain change.
11. **COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT — `REPLAY-RAIL-NAV-001`** — final hands-on use accepts compact Hand context/state on the left, the primary poker table in the center, and legal/chance controls, distinct Replay, and bounded vertical History on the right. Table-first hierarchy, canvas use, live/Replay stability, chronology, collapse/scroll, seeking, Return to live, canonical actions, no-dongle cards, contributions, Abort/Raise/all-in/invalid-size behavior, EN/RU/HE/RTL, Daylight contrast, and Review are accepted. This is not perfect polish: dense/10-max seat placement, a possible ownership-safe hidden-back tuck, full-ring Dealer-presence explainability, and History micro-polish remain later debt without reopening composition or chronology.
12. **COMPLETED / HUMAN ACCEPTED — `TRAINING-COMPOSITION-001`** — the accepted normal decision + study-rail skeleton, Correction #1, and final hardening remain intact. Lean closeout makes decision replay exact and headline-stat/planner-neutral while retaining evidence, and keeps terminal Full Hand Review on the live-scale shared table with vertical canonical History and no horizontal timeline. Focused/domain and Firefox 154 / 1920×1080 evidence pass; the product owner human accepted the checkpoint.
13. **COMPLETED / HUMAN ACCEPTED — `EQUITY-COMPOSITION-001`** — bounded 2–10-player input, presentation-only inline names, adjacent Board/Dead/Method, compact empty/running state, a dedicated dominant completed comparison, accepted transactional card-set editing, and truthful separation of structural completions from exact-entered-hand catch-up cards are human accepted. Richer dossier-owned Hand Analysis capabilities remain future.
14. **COMPLETED / HUMAN ACCEPTED — `ANALYZE-RANGE-UX-001`** — accepted Matrix-local selected-hand inspection and legend, canonical Range Core card-removal presentation, Facts → Explain depth, complete primary comparison matrices, independent Hero/opponent percentages on one shared 0–100% scale, and explicit representative-class-sample limits. Weighted ranges, range-vs-range Equity, nut advantage/distribution, and action-conditioned propagation remain future Range Evolution work.
15. **COMPLETED / HUMAN ACCEPTED — `FIRST-USE-HOME-001`** — Home is the permanent recurring startup/study destination; optional Welcome orientation is route-independent, defaults to unsuppressed, affects orientation only, and selects no destination. Guest Home is useful without sign-in. Continue uses only an explicit live canonical Hand or active/paused Personal Strategy contract; otherwise Home provides Start without fabricated recency. Training, Analyze, Equity, and last-route continuation remain unsupported pending explicit contracts. One canonical brand-spade asset serves current Riverline identity surfaces separately from poker-card suits.
16. **COMPLETED / HUMAN ACCEPTED — `SAVED-VISUAL-KNOWLEDGE-001`** — the compact Saved grid now uses DOM-free `saved-study-preview-facts/v1`, visible All / Hands / Spots categories, a viewport-bounded body overlay for hover/focus, bounded click/Enter detail, shared `card-presentation/v1`, privacy-safe identity clearing, truthful Hand/Scenario previews, unsupported unknown kinds, and unchanged `SavedStudyObject v1` persistence/reopen boundaries.
17. **COMPLETED / HUMAN ACCEPTED — `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` —** canonical `PokerState` semantics were correct. Application/UI fixes align fully known hole-deal Replay labeling, remove stale committed/consumed board drafts, and use the canonical available-card query excluding current board, known hole cards, dead cards, and pending selections. Explicit Turn → River → Showdown remains intact; Replay/live terminal states agree and runout events occur exactly once. Hand composition remains closed.
18. **COMPLETED / HUMAN ACCEPTED — `GUIDE-CONTENT-001` —** Guide is the durable workflow-first product reference for Hand, Analyze, Training, Equity, and Personal Strategy. Welcome / Learn Riverline remains orientation; workspace tutorials remain contextual interactive teaching. Actions reuse navigation authority, no tutorial/persistence authority was added, and current authority/truth boundaries remain explicit.
19. **COMPLETED / HUMAN SECURITY ACCEPTED — `AUTH-TRAINING-MEMORY-001` —** Training Memory now uses authentication-aware owner scope and generation; Guest cannot reach a retained prior account, sign-out revokes local access before provider cleanup, stale reads/intents and in-flight writes fail closed, and prior-account bytes remain intact for authenticated return. Durable anonymous Device Guest remains future lifecycle work.
20. **COMPLETED / HUMAN ACCEPTED FOUNDATION — `DECISION-ECONOMICS-001`, `STRATEGY-TRUST-001`, AND `DECISION-CONTEXT-SINGLE-AUTHORITY-001`.** Canonical ledger-pot accounting remains authoritative and actor-relative strategic pricing is exact only where canonical evidence exists. Strategy authority now requires structural/source validation followed by application-owned, identity/version/fingerprint-bound acceptance; provider declarations and manifest statuses cannot self-authorize, live trust tokens are not persisted, and historical answer-time authority/ClaimPolicy evidence is frozen. Scenario and Hand now use their canonical DecisionContext projectors through one selector, with missing/failed Playbook dependencies clearing stale state instead of invoking local construction. No production Reference Pack exists.
21. **COMPLETED / ACCEPTED — `AUDIT-CHEAP-FIX-BATCH-001`** — Training Memory now preserves Full Hand evidence while embargoing answer/reference/review presentation until terminal Review; the Hand action dock follows the current actor and stack without erasing Hero identity; Equity structural completion identities use the complete entered known-card set while exact entered-hand outcome authority remains unchanged.
22. **COMPLETED / ACCEPTED — `AUTH-SUPABASE-SINGLETON-001`** — one browser-runtime Supabase client owner serves Authentication, Account/Profile, Saved sync, and Personal Strategy sync. Equivalent normalized configuration and repeated acquisition reuse it; materially different in-runtime configuration fails closed; auth/identity transitions do not recreate it; missing/invalid configuration remains Guest/local-only.
23. **ACTIVE NEXT — `ANALYZE-SCENARIO-READINESS-001`** — resolve the confirmed Analyze Scenario chronology/readiness audit finding without broad Analyze redesign.
24. **IDENTITY AND PRODUCT-TRUTH GATES —** `IDENTITY-LIFECYCLE-001` → `HEURISTIC-BASELINE-TRUTH-001` → `TRAINING-NORMATIVE-001`.
25. **PORTABLE TEST/LIFECYCLE PLATFORM — `BROWSER-TEST-PLATFORM-001`.**
26. **BOUNDED UI COMPOSITION EXTRACTION —** `UI-COMPOSITION-ROOT-001` → one workspace extraction pilot. This is risk-driven incremental decomposition, not React/Redux or a framework rewrite.
27. **CURRENT SAVED RETRIEVAL — `SAVED-LIBRARY-001`** — full current Hand/Spot retrieval before any new Saved payload kind.
28. **STUDY CONTINUITY — `HOME-STUDY-CONTINUITY-001`.**
29. **BOUNDED REFERENCE-SOURCE DECISION —** after read-only source research, which may run in parallel.
30. **LEARNING-LOOP EXPANSION.**
31. **PERSONAL STRATEGY — `PERSONAL-STRATEGY-003A`.**
32. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`** — whole-product release-quality acceptance after nearer foundational owners.
33. **Release/mobile/social/PLO later** — only after their prerequisites and explicit decisions.

## Phase A — usable visible-product foundation

Completed `TABLE-PHYSICALITY-003`, `HOME-GAME-001B`, `SETTINGS-IA-001`, and the bounded `HANDS-ON-DEFECTS-001` repair remain useful visible-product foundations. Core Flow, Hand Replay, the all-in runout regression repair, Training composition, Equity, Analyze/Range, First Use/Home, Saved Visual Knowledge, and the workflow-first Guide remain accepted checkpoints. The completed audits found foundational debt beneath some checkpoint claims. Training Memory ownership, actor-relative decision economics, and the declaration-versus-acceptance strategy trust boundary are now repaired and accepted; DecisionContext convergence, heuristic-consumer truth and normative grading, generalized lifecycle disposal including durable anonymous Device Guest, portable browser testing, Saved retrieval, and root composition remain. Those owners now lead; no broad polish or expansion wave begins first.

The current product decision puts the human-triaged foundation gates ahead of another large feature/product-model implementation or broad polish wave. Bounded secondary polish remains routed debt, Home Game presentation and Audio Design remain conditional, and `PREMIUM-CLOSEOUT-001` remains the later pre-release quality gate. Controls First, the ineffective density selector, arbitrary layout editing, casino spectacle, fake cinematic 3D, avatars by default, and reward theater remain rejected.

Real-browser/human judgment remains required for hierarchy, balance, readability, and aesthetics. Known acceptance debt stays in the QA Backlog and Return Queue rather than expanding this roadmap.

## September Alpha — internal high-quality milestone

The September Alpha evidence checkpoint captured a coherent desktop build, synchronized documentation, a whole-product manual pass, independent cross-model blind hands-on and white-box theoretical/architecture audits, and authoritative human triage. Triage completion is not a claim that the resulting foundation debts or eleven blind findings are fixed; their named owners now gate continuation.

September Alpha is not public beta readiness, production reference coverage, completed live account/sync validation, finished mobile/social/PLO, or completion of the long-term capability roadmap. The audit checkpoint is complete; its human-triaged foundational owners now gate continuation. The dossier layer remains durable intent and does not override this sequence.

## Phase B — trusted reference strategy

The `reference-pack/v1` checkpoint proves exact Game Rules/stack/tree/legality matching, declarative validation and integrity, provider selection, policy-gated consumers, and unsupported heuristic fallback for a preferred six-max BB-versus-BTN 2.5bb intake family. No production-safe frequency corpus has been accepted, so production registration and all stronger authority/capability claims remain blocked. Resume only when exact immutable source data, compatible license/redistribution rights, reproducible or strong provenance, and independent validation evidence are available. Source branding never grants authority; private benchmark observations never become production packs. Broader coverage and learned models follow only when measured evidence justifies them.

Detailed direction: [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

## Phase C — persistent learning

Training has evolved from isolated legal deterministic exercises into a first history-aware learning loop. `TRAINING-MEMORY-001` preserves exact decision/session and answer-time source/claim evidence and supports historical Same Spot plus current Similar Spot, but audit evidence invalidates the claim that owner indexing alone establishes authentication isolation. The heuristic baseline is comparative only, and its agreement/disagreement cannot stand in for skill, accuracy, mastery, correctness, GTO, or automatic remediation. Auth isolation and normative-grading repair precede advanced scheduling, Saved/Home/Replay/Analyze continuity, rich filters/trends, sync/export, and Personal Strategy observation.

Detailed direction: [Learning Evidence Foundation](capabilities/LEARNING_EVIDENCE_FOUNDATION.md), [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md), and [Deep Hand Review](capabilities/DEEP_HAND_REVIEW.md).

## Phase D — Personal Strategy integration and insight

After the foundational gates and learning-loop expansion, add intended-strategy comparison without turning personal intent into normative truth. Keep selected reference and observed play explicit, preserve contradictions and sparse evidence, make Training evidence opt-in, then add evidence-backed uncertainty queues and summaries. The current legacy exactly-three-mode UI is not the accepted future model.

Detailed direction: [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md) and [Natural-Language Intelligence](capabilities/NATURAL_LANGUAGE_INTELLIGENCE.md).

## Phase E — range evolution and saved knowledge

Action-conditioned range propagation must preserve combo-level weights, exact actions, card removal, provenance, and unknowns. Saved then grows into a master-detail knowledge workspace only as approved Hand, Spot, Range, Drill, Review, and Session payload owners exist.

Detailed direction: [Range Evolution](capabilities/RANGE_EVOLUTION.md) and [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md).

## Phase F — opponent policies and full-hand learning

Evolve the existing bounded `OpponentPolicy v1` contract and deterministic `basic` Full Hand policy without conflating them with reference strategy or claims about real people. Richer generic, environment, custom, and Personal-Strategy-as-opponent policies may later feed legal full-hand Training, Review, Save, and re-drill continuity.

Detailed direction: [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md).

## Dependency-gated preserved capabilities

Equity/hand/runout depth, range-aware bluff/exploit work, and shared legal randomization are valuable but do not displace the current sequence. Their eventual slices depend on canonical evaluator/Equity/range evidence and the shared interaction grammar.

- [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md)
- [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md)
- [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md)
- [Home Game Evolution](capabilities/HOME_GAME_EVOLUTION.md)

## Parallel maintenance and release gates

Security, data-integrity, or release blockers may interrupt the sequence. Training Memory auth isolation and authenticated sign-out inaccessibility are current blockers rather than later beta polish. The accepted long-term Guest model is a durable anonymous device-local profile, distinct from every authenticated owner. Live Supabase migrations/RLS and multi-profile acceptance, privacy/legal/packaging/offline/observability decisions, and evidence-triggered bounded extraction remain important without authorizing a rewrite.

`PREMIUM-CLOSEOUT-001` is the planned-later pre-release quality gate for whole-product manual QA, final high-value visual debt, Guide, responsive desktop, EN/RU/HE/RTL, accessibility, cards/table/replay/Settings/theme consistency, Return Queue visual debt, and accepted Core Flow regression continuity. It should run when the product feature set is materially more mature, before a public or equivalent release-quality milestone.

Mobile receives a deliberate composition, not stacked desktop panels. PLO remains a separate game/evaluator/range/reference domain. Public release, monetization, telemetry, restrained study goals/streaks, sharing permissions, and table customization remain explicit product decisions.

## Priority rule

Advance the highest-value trustworthy product foundation while keeping visible debt explicit and non-blocking unless evidence proves otherwise. A dossier, audit, competitor, or attractive microfeature cannot become priority by documentation alone, and subjective polish cannot become an indefinite loop. Reprioritization updates Current Phase, this Roadmap, and the affected Backlog record together.
