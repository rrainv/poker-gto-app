# Riverline Product and Feature Backlog

Last consolidated: August 31, 2026 (`GUIDE-CONTENT-001` is **COMPLETED / HUMAN ACCEPTED**; the September Alpha whole-app human sanity pass is active next, followed by documentation/continuity freeze, full verification, the clean audit commit and immutable audit tag, independent cross-model audits, and human triage before further structural, refactor, or feature work).

This is the concise accepted capability/status registry. [Current Phase](CURRENT_PHASE.md) owns exact execution order; [Roadmap](ROADMAP.md) owns major directional sequencing; [capability dossiers](capabilities/README.md) own detailed long-term intent and recovered microfeatures; specs/code own current contracts and implementation truth. `QA_BACKLOG.md` owns issue-level defects and manual acceptance; `PRODUCT_RETURN_QUEUE.md` owns accepted must-return debt.

## Status vocabulary

- **COMPLETED:** accepted bounded implementation or documentation outcome.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE:** accepted foundation with an explicit resume point.
- **ACTIVE NEXT:** accepted next bounded ticket.
- **PLANNED NEXT:** ordered accepted work after the active-next ticket.
- **PLANNED LATER:** accepted and ordered behind nearer work.
- **PRESERVED FUTURE:** accepted direction without immediate commitment.
- **SHELVED FOR LATER:** deliberately paused.
- **OPEN PRODUCT DECISION:** requires a later explicit choice.
- **REJECTED / REMOVED:** do not revive without new evidence and an approved ticket.

## Product north star and permanent rules

Riverline is a local-first personal poker learning workstation connecting full-hand play, Review/Replay, selected-reference comparison, Personal Strategy, Saved continuity, targeted re-drill, and recurring-pattern learning.

Reference strategy, intended Personal Strategy, observed behavior, opponent policy, and exploit analysis remain distinct roles. UI and natural-language consumers use canonical structured facts and never invent poker math. Strategy claims require source authority, capabilities, and exact-enough coverage. Functionally correct but visibly sloppy is a product defect.

## Current delivery order

| Order | Status | Ticket / outcome |
|---:|---|---|
| checkpoint | COMPLETED | `DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, `WELCOME-INTRO-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN DEBT | `WORKSPACE-COMPOSITION-002` |
| checkpoint | COMPLETED / ACCEPTED DOCUMENTATION ARCHITECTURE CHECKPOINT | `DOCS-CAPABILITY-DOSSIERS-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT | `TABLE-PHYSICALITY-003` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT | `HOME-GAME-001B` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | `SETTINGS-IA-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | `TRAINING-MEMORY-001` |
| return dependency | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `REFERENCE-PACK-001` production source acquisition and acceptance |
| checkpoint | COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED | `PERSONAL-STRATEGY-002R` |
| checkpoint | COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED | `HANDS-ON-PRODUCT-REVIEW-001` / all 59 findings preserved and owned |
| checkpoint | COMPLETED / ACCEPTED BOUNDED REPAIR WITH EXPLICIT DEBT | `HANDS-ON-DEFECTS-001`; no whole-product, Hand-composition, or Training-composition acceptance claim |
| 1 | COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT | `CORE-FLOW-CORRECTNESS-001` fresh lifecycle, generalized corrections, two-card opponent picker, and canonical min-raise verification |
| 2 | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | `REPLAY-RAIL-NAV-001` table-first Hand workspace, vertical street-grouped rail, and final geometry/lifecycle/Daylight hardening |
| 3 | COMPLETED / HUMAN ACCEPTED | `TRAINING-COMPOSITION-001` accepted normal skeleton plus Correction #1, final hardening, and lean closeout |
| 4 | COMPLETED / HUMAN ACCEPTED | `EQUITY-COMPOSITION-001` |
 | 5 | COMPLETED / HUMAN ACCEPTED | `ANALYZE-RANGE-UX-001` |
 | 6 | COMPLETED / HUMAN ACCEPTED | `FIRST-USE-HOME-001` |
| 7 | COMPLETED / HUMAN ACCEPTED | `SAVED-VISUAL-KNOWLEDGE-001` |
| 8 | COMPLETED / HUMAN ACCEPTED | `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001`; canonical `PokerState` semantics correct, application/UI root cause repaired, explicit all-in chance flow and exact-once Replay/live agreement accepted |
| 9 | COMPLETED / HUMAN ACCEPTED | `GUIDE-CONTENT-001` workflow-first durable product reference over existing navigation and tutorial authorities |
| conditional | PRESERVED CONDITIONAL / NOT IN CURRENT ORDER | `HOME-GAME-PRESENTATION-001`, `AUDIO-DESIGN-001` |
| active next | ACTIVE NEXT | September Alpha whole-app human sanity pass |
| September Alpha continuity | DOCS / CONTINUITY FREEZE → FULL VERIFICATION GATE | freeze coherent project truth, then verify the complete checkpoint |
| September Alpha audit checkpoint | HUMAN CLEAN AUDIT COMMIT → IMMUTABLE AUDIT TAG | human-owned clean audit baseline |
| September Alpha audit | CROSS-MODEL DEEP AUDIT → HUMAN TRIAGE | blind hands-on product audit plus white-box theoretical/architecture audit before further structural, refactor, or feature work |
| post-audit | PRESERVED MAJOR FEATURES / EVIDENCE-BASED ACTIVATION | `PERSONAL-STRATEGY-003A`, `GAME-SETUP-EVOLUTION-001`, `RANGE-EVOLUTION-001`, or another documented major capability |
| later gate | PLANNED LATER / PRE-RELEASE QUALITY GATE | `PREMIUM-CLOSEOUT-001` |
| future | PRESERVED FUTURE | release/mobile/social/PLO later |

The **September Alpha** milestone is an internal/high-quality alpha: a coherent, trustworthy, human-tested desktop build with accepted Hand/Replay, Training, Equity, Analyze/Range, materially improved First Use/Home and systemic polish, synchronized documentation, a whole-product manual pass, independent cross-model hands-on and theoretical audits, and serious findings triaged/fixed. It is not public beta readiness, production reference coverage, completed live account/sync validation, finished mobile/social/PLO, or completion of the long-term roadmap.

Learning Evidence, Natural-Language Intelligence, Reference Strategy Evolution, Equity/Hand Analysis, Bluff/Exploit Analysis, Opponent Intelligence, Deep Hand Review, Training Intelligence, Personal Strategy Intelligence, Range Evolution, Saved Knowledge/Sharing, Home Game Evolution, and Random Spot Generator remain preserved in capability dossiers; the closure/audit phase does not compress or delete them.

## Confirmed August 2026 product-review owners

Detailed evidence and row-level traceability remain in [Hands-On Product Review — August 2026](HANDS_ON_PRODUCT_REVIEW_2026_08.md). This registry records only accepted owners and status.

| Ticket / owner | Status | Concise accepted outcome |
|---|---|---|
| `HANDS-ON-DEFECTS-001` | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT | Accept Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, card-removal parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry. Repeated Welcome selection, warning prominence, and card/seat visual failures remain with structural owners; no third correction cycle. |
| `CORE-FLOW-CORRECTNESS-001` | COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT | Review and `Start new hand` are the two primary terminal actions while lifecycle/new identity remains unchanged; `Correct entries` surfaces every eligible buy-in, rebuy, add-on, and cash-out with optional reason and append-only replacement or reversal-only atomicity; the continuous two-card picker preserves the expanded known-opponent workflow, first card, focus, and duplicate exclusion; canonical minimum-raise and short-all-in reopening rules remain verified correct without poker-math changes. Final hands-on acceptance passed before Replay began. No Hand/rail/table redesign. |
| `FIRST-USE-HOME-001` | COMPLETED / HUMAN ACCEPTED | Home is the permanent recurring startup/study destination. Optional Welcome orientation is separate from routing, defaults to shown with suppression unchecked, affects orientation only, and has zero selected sidebar destinations; active navigation always reflects the true destination. Guest Home is useful without sign-in. Continue is truthful only for a live canonical Hand or active/paused Personal Strategy; otherwise Home provides Start. Training, Analyze, Equity, and last-route continuation remain unsupported pending explicit contracts, and future dashboard evolution must not fabricate recency, recommendations, streaks, sync/cloud claims, or cross-workspace history. Current Riverline identity surfaces share one canonical brand-spade asset while poker-card suits remain separate. |
| `REPLAY-RAIL-NAV-001` | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | Final hands-on use at 1920×1080 / 100% accepts compact Hand context/state on the left, the primary poker table in the center, and legal/chance controls, distinct Replay, and bounded vertical History on the right. Table-first hierarchy, canvas use, stable live/Replay, chronology, collapse/scroll, exact seeking, Return to live, canonical actions, no-dongle cards, contributions, live-only Abort, Raise/all-in/invalid-size behavior, EN/RU/HE/RTL, Daylight contrast, and Review are accepted. This is not perfect-polish acceptance: dense/10-max lower side panels remain slightly too far inward and the top player slightly too far outward/high; hidden backs may later tuck behind the owning player only without harming privacy, ownership, inspectability, known-card readability, non-obstruction, or the no-dongle grammar; full-ring Dealer presence/explainability belongs to table physicality/Game Setup without a fake dealer; and History padding/weight/contrast/density/event-row polish belongs to global/premium quality. |
| `TRAINING-COMPOSITION-001` | COMPLETED / HUMAN ACCEPTED | The accepted one-CTA normal decision + study-rail skeleton and Correction #1 remain intact. Final hardening preserves immediate Varied/Focused feedback but anchors primary progression above study labels, Facts, and optional Explain; sparse normal modes use content-driven height. Full Hand keeps the shared table and canonical sizing, records live decisions neutrally, reveals comparison/source/Facts/depth only in shared terminal Review, and provides confirmed live-only Abort that abandons Memory without losing evidence or fabricating completion. The lean closeout remounts exact canonical decisions for replay, excludes replay answers from headline session statistics/planner progress while retaining truthful evidence, and keeps terminal Review on the live-scale shared table with vertical canonical History. Focused tests and Firefox 154 / 1920×1080 evidence pass; the product owner human accepted the checkpoint. |
| `EQUITY-COMPOSITION-001` | COMPLETED / HUMAN ACCEPTED | Bounded 2–10-player input with presentation-only inline names, adjacent Board/Dead/Method, compact empty/running presentation, and a separate dominant completed comparison are accepted. Canonical method/progress/cancel/stale behavior remains preserved; shared transactional card-set editing is accepted; exact-entered-hand next-card outcomes distinguish cards that put a player ahead from structural completions that may leave that player behind. Richer Equity/Hand Analysis capability remains preserved in its dossier. |
| `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` | COMPLETED / HUMAN ACCEPTED | Canonical `PokerState` semantics were correct. The application/UI root cause combined mislabeled fully known hole-deal Replay events, a rejected Replay transition that left a stale committed flop draft, and reuse of that consumed draft as a later chance candidate. The canonical available-card query excludes current board, known hole cards, dead cards, and pending selections; stale consumed drafts are removed before the picker opens. Explicit Turn → River → Showdown remains intact, Replay/live terminal states agree, and runout events occur exactly once. Hand composition remains closed. |
| `GUIDE-CONTENT-001` | COMPLETED / HUMAN ACCEPTED | Guide is the durable workflow-first product reference for Hand, Analyze, Training, Equity, and Personal Strategy. Welcome / Learn Riverline remains orientation and workspace tutorials remain contextual interactive teaching. Guide actions route through existing navigation authority; no tutorial or persistence authority was added. Hand/Scenario, reference/Personal Strategy, Facts/Explain, Equity/strategy, heuristic/solved-GTO, Saved object limitations, and sign-in/cloud-sync boundaries remain explicit. |
| `GAME-SETUP-EVOLUTION-001` | PRESERVED MAJOR FEATURE / POST-AUDIT ACTIVATION CANDIDATE | Reusable configurable game setups/presets and physical seat/button/Dealer interaction. |
| `HOME-GAME-PRESENTATION-001` | CONDITIONAL / BOUNDED BY TIME AND IMPACT | Denser Riverline-integrated organizer, useful table/session representation, stronger proximate imbalance/toast presentation, and broader lifecycle feedback. |
| `AUDIO-DESIGN-001` | CONDITIONAL / BOUNDED BY TIME AND IMPACT | Subjective poker/Study/UI listening quality over the accepted `riverline-audio/v1` authority; no second audio authority. |
| `RANDOM-SPOT-GENERATOR-001` | PRESERVED FUTURE / REASSESS AT CHECKPOINT | Shared legal Randomize/Lock capability with card-removal truth and later reproduction. |
| `ANALYZE-RANGE-UX-001` | COMPLETED / HUMAN ACCEPTED | Matrix-local selected-hand inspector and compact legend; canonical Range Core card-removal conditioning; Facts → Explain depth; primary complete Hero/opponent comparison matrices; independent percentages on one shared 0–100% scale; and truthful one-representative-per-eligible-sampled-class limits. DOM-free `range-comparison-facts/v1` supplies structured comparison facts. Weighted ranges, range-vs-range Equity, nut advantage/distribution, and action-conditioned propagation remain future Range Evolution work. |
| `PERSONAL-STRATEGY-TEACHING-001` | PRESERVED FUTURE / REASSESS AT CHECKPOINT | Evidence-grounded concepts/reference/reasoning that genuinely teach; not a claim about the current Teacher. |
| `SAVED-VISUAL-KNOWLEDGE-001` | COMPLETED / HUMAN ACCEPTED | `SavedStudyObject v1` remains persistence/schema authority. DOM-free `saved-study-preview-facts/v1` projects observer-safe canonical Hand facts and visibly lossy/schematic Scenario Spot facts. The compact grid is primary; All / Hands / Spots remain visible at zero; hover/focus use one viewport-bounded body overlay; click/Enter expands bounded detail; cards reuse `card-presentation/v1`; unknown kinds remain unavailable; identity changes clear private presentation; reopen behavior is unchanged. |
| `GLOBAL-PRODUCT-QUALITY-001` | BOUNDED SECONDARY POLISH / ACCEPTED QUALITY DEBT | Spacing, sizing, typography/casing, iconography, account hierarchy, intro/logo, non-poker audio, Royal Flush presentation. |
| `CUSTOMIZATION-UX-001` | BOUNDED SECONDARY POLISH / ACCEPTED CUSTOMIZATION DEBT | Card backs, custom-theme creation, Daylight comfort, compact controls, and manual reduced-motion override. |

## 1. Strategy / Reference

| Capability | Status | Accepted scope |
|---|---|---|
| source authority, DecisionContext, fallback repair, role semantics, benchmark, and bounded calibration | COMPLETED FOUNDATION | One `DecisionContext → StrategyProvider → StrategyResult → StrategyClaimPolicy` path; current v4 remains generalized/comparative and narrowly calibrated. |
| `REFERENCE-PACK-001` bounded reference pack/provider | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `reference-pack/v1`, exact rules/history/stack/legality matcher, deterministic validation/integrity, provider adapter, unchanged labelled fallback, and generic Playbook/Training/Matrix/Analyze/Review consumption are implemented with synthetic test-only data. No production corpus is registered; resume with exact immutable source data, compatible license/redistribution, reproducible or strong provenance, and independent validation evidence. See [Reference Pack v1](REFERENCE_PACK_V1_SPEC.md) and [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| broader preflop/postflop reference and evidence-driven fallback calibration | PRESERVED FUTURE | Expand only through measurable validation; exact coverage never extrapolates. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| trustworthy datasets and learned/model providers | PRESERVED FUTURE / dependency-gated | Only after validated anchors demonstrate value; never train on heuristic labels and market the result as GTO. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |

Known limitations remain explicit: no production reference pack or validated general reference, coarse postflop opponent ranges, no trustworthy general sizing strategy, no solved multiway equilibrium, and narrow v4 calibration.

## 2. Full Hand / Replay / Review

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Hand, Table Presence, Replay, and shared Full Hand Review | COMPLETED FOUNDATION | Legal Hand history, deterministic read-only Replay, `table-presentation/v1`, `hand-review/v1`, Hero decisions, pre-action frames, source-gated comparison, provenance, Analyze/Save/Repeat/Next continuity. |
| deeper evidence-rich Hand Review | PRESERVED FUTURE / dependency-gated | Street-by-street Equity/hand/range/reference/Personal/observed/opponent evidence and supported synthesis without another history or grader. The vertical street-grouped chronology direction is implemented and human accepted under `REPLAY-RAIL-NAV-001`; deeper evidence remains future work. See [Deep Hand Review](capabilities/DEEP_HAND_REVIEW.md). |

Independent visual/interaction acceptance remains in QA and the Return Queue; implementation checkpoints are not visual sign-off.

## 3. Audio / Motion

| Capability | Status | Accepted scope |
|---|---|---|
| `AUDIO-MOTION-001` | COMPLETED / ACCEPTED CHECKPOINT | One semantic event boundary, independent audio/motion policies, physical poker-world foley, restrained Study/UI feedback, origin suppression, reduced motion, and sound-off behavior. |
| subjective audio polish | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Study/UI, optional Check refinement, fatigue review, and unperformed Firefox acceptance remain `RET-AUDIO-001`. |
| richer ambience | SHELVED FOR LATER | Optional and subtle only; no casino noise, reward loops, or engagement manipulation. |

## 4. Training

| Capability | Status | Accepted scope |
|---|---|---|
| deterministic Training and Practice Planner | COMPLETED FOUNDATION | Legal canonical generator, shared provider/grading path, Varied/Focused structural planning, Full Hand mode, reproducible seeds, and generation-only sizing families. |
| Training Memory / DecisionRecord / review and re-drill | COMPLETED / ACCEPTED V1 CHECKPOINT WITH MANUAL FIREFOX DEBT | Durable shown/answered/source/version/context/session evidence, owner-isolated IndexedDB, bounded recent history, transparent Review lifecycle, exact historical Same Spot, current planner/generator-backed Similar Spot, factual source-aware summaries, and Full Hand replay sharing are implemented. The heuristic remains comparative. See [Training Memory v1](TRAINING_MEMORY_V1_SPEC.md), [Learning Evidence Foundation](capabilities/LEARNING_EVIDENCE_FOUNDATION.md), and [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |
| Training Memory scheduling and cross-surface continuation | PLANNED LATER | Principled spaced/adaptive scheduling, rich filters/trends, Saved Drill payloads, Home/Replay/Analyze continuity, export/import, sync, and explicit Personal Strategy observation require later bounded tickets; `Not sure` remains open. |
| Full Hand Training Hero-fold termination | PRESERVED FUTURE / NOT ACTIVATED | Learner-facing Full Hand Training should end when Hero folds instead of autoplaying an opponent-only remainder. This requires a bounded Training lifecycle decision and must not change canonical Hand settlement/history. See [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |
| profile-aware Training evidence and opponent-policy drills | PLANNED LATER / dependency-gated | Explicit opt-in, immutable observed provenance, no overwrite of intended strategy, later explicit opponent policy. |
| study goals | PRESERVED FUTURE / mechanics open | Restrained goals derived from real history; XP/badges/levels/achievements remain rejected by default. See [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |

Training `Not sure` behavior remains an open product question; Calibration's existing no-evidence behavior is not inherited automatically.

## 5. Personal Strategy

| Capability | Status | Accepted scope |
|---|---|---|
| Foundation / Calibration / inference / Matrix / Builder / Teacher | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Three user-named modes per profile, sparse immutable intended evidence, dominant-only ≠ pure, contradictions, categorical uncertainty, adaptive questions, and one shared evidence authority. |
| `PERSONAL-STRATEGY-002R` | COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED | The [independent review and human disposition](PERSONAL_STRATEGY_002R_REVIEW.md) preserve the intended-evidence authority and accept the Game setup/Approach, local-first, RFI-first, first-value product reset before integration. Browser/real-user acceptance remains routed debt. |
| `PERSONAL-STRATEGY-003A` | PRESERVED MAJOR FEATURE / ACTIVATE ONLY AFTER SEPTEMBER ALPHA AUDIT AND HUMAN TRIAGE | Own the versioned legacy migration and deliver one Game setup, one initial Approach, approximately five supported RFI questions, broad sparse/high-information coverage before fine boundary refinement, What Riverline understands, Teach Riverline Next, and secondary Strategy Matrix/Matrix Edit. It is not immediately next; no provider/reference/observed integration. |
| provider/reference/observed integration | PLANNED LATER / AFTER 003A AND HUMAN CHECKPOINT | Keep intended Personal Strategy, selected reference, source-labelled observed behavior, and opponent policy explicit; Training comparison/adoption is opt-in and Training Memory remains the observed authority. |
| `PERSONAL-INSIGHTS-001` | PLANNED LATER after integration | Cross-profile Teach Riverline Next queue and evidence/provenance/uncertainty-aware summaries. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |
| bounded versioning and later postflop/combo depth | ACCEPTED DIRECTION / LATER SLICES | Duplicate Approach, immutable material Game setup versions, and restore-through-new-correction/version are accepted; branches, arbitrary rollback, and Git-like management are deferred. Postflop remains exact-fact future work. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |

## 6. Analysis / Matrix / Ranges / Equity

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Equity | COMPLETED | One exact/seeded Monte Carlo 2–10-player service with win/tie/share accounting; no weighted-opponent request yet. |
| `RANGE-CORE-001` | COMPLETED | 52 cards → 1,326 combos → `HoldemWeightedRange v1` → blocker/normalization/Matrix projections; unknown ≠ zero. |
| `ANALYSIS-RANGE-001` and `BLUFF-001` | CHECKPOINTED | Structural exact-hand/draw/board/blocker/range and bounded bluff economics/removal facts; no invented ranges, response, EV, advantage, or verdict. |
| `EQUITY-HAND-ANALYSIS-001` | PLANNED LATER / dependency-gated | Current exact-entered-hand next-card outcomes are implemented; broader runout/nut/blocker/standing/vulnerability, clean/dirty, split-pot, range-relative, and shared card-outcome-preview intelligence remains future. See [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md). |
| `BLUFF-ANALYSIS-002` | PLANNED LATER / dependency-gated | Range-aware value/bluff/bluff-catcher/candidate-quality and explicit exploit analysis. See [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md). |
| `RANGE-EVOLUTION-001` | PLANNED LATER | Canonical combo-level action-conditioned preflop-to-river propagation with distinct reference/Personal/opponent roles. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| weighted range-vs-range / range and nut distribution | PRESERVED FUTURE / dependency-gated | Requires approved Equity/Analysis boundaries, explicit weighted ranges, provenance, and unknown-preserving semantics. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| `RANDOM-SPOT-GENERATOR-001` | PRESERVED FUTURE | Legal lock-aware randomized study-state utility for supported consumers. See [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md). |

## 7. Saved / Home

| Capability | Status | Accepted scope |
|---|---|---|
| Saved Hand / Spot | COMPLETED | Versioned local-first objects, shared title/note/tags/review/mistake metadata, archive, observer-safe canonical Replay, and portability foundations. |
| `SAVED-VISUAL-KNOWLEDGE-001` | COMPLETED / HUMAN ACCEPTED | Compact Hand/Spot grid with visible All / Hands / Spots categories, DOM-free truthful previews, bounded hover/focus overlay and explicit detail, shared cards, privacy clearing, unsupported unknown kinds, and unchanged reopen/persistence authority. |
| `HOME-002A` My Riverline | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account-aware Continue and bounded Saved/Recent/Review/Mistakes/Personal Strategy previews; human acceptance remains open. |
| `HOME-002B` Saved Study Library | PLANNED LATER | Dense master-detail Hands/Spots first, then approved Range/Drill/Review/Session payloads with search/filter/tags and explicit Open/Study. See [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |
| Saved Training Experience | PRESERVED FUTURE / dependency-gated / NOT ACTIVATED | Preserve a Full Hand Training experience as canonical Hand plus its Training decisions/evidence rather than degrading it to a bare Hand; requires an approved payload, ownership, privacy, versioning, and reopen contract. |
| Saved Equity Snapshot | PRESERVED FUTURE / dependency-gated / NOT ACTIVATED | Preserve exact inputs and unknowns, board/dead cards, calculation method/version/result, and instant-reopen semantics through a future approved payload; current Saved kinds remain Hand and Spot. |
| user-visible export/import, version history, share/fork/collaborate | PRESERVED FUTURE / dependency-gated | Private by default; share actual versioned state/provenance, with read-only-first acceptable. See [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |

Home remains a consumer and must not invent accuracy, mastery, streaks, or history.

## 8. Accounts / Sync / Social

| Capability | Status | Accepted scope |
|---|---|---|
| identity/auth plus Saved and Personal Strategy sync | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest-first local identity, Supabase email/password/profile, explicit opt-in local-first sync, outbox/retry/tombstones/conflicts; live migrations/RLS and lifecycle acceptance remain. |
| username/password adapter | OPEN PRODUCT DECISION | Trusted rate-limited server/Edge Function only if still required; never client-side username-to-email lookup. |
| recovery/deletion/local forgetting and cross-device preferences | PRESERVED FUTURE | Explicit privacy/lifecycle work after core sync stability. |
| social identity and study sharing | PRESERVED FUTURE / dependency-gated | After privacy/versioning maturity; sharing semantics live in [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |

Authentication never silently enables upload; Riverline remains useful offline.

## 9. Home Game Organizer

| Capability | Status | Accepted scope |
|---|---|---|
| `HOME-GAME-001A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Separate players/groups/sessions, exact integer money, append-only corrections, chips separate from money, lifecycle/reopen, balance rejection, deterministic settlement, account IndexedDB/Guest memory. |
| Create Game routing blocker | COMPLETED | Creation stays in Home Game and opens the intended active session. |
| `HOME-GAME-001B` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT | Stable reusable player edit/archive/restore; ordered group management and roster reuse; session archive/restore and lifecycle inspection; atomic visible correction/replacement history; account-only canonical export. Hard delete/import are deliberately deferred for missing safety contracts. |
| settlement/history/Hand-link/mobile evolution | PRESERVED FUTURE / decisions open | Fewest Transfers vs Banker/preferred banker, payment tracking, recurring games, stable Hand linkage, reconciliation, and later sharing. See [Home Game Evolution](capabilities/HOME_GAME_EVOLUTION.md). |

The current settlement algorithm is deterministic; it is not a selected Fewest Transfers or Banker product preference.

## 10. Product Experience / Settings / Themes / Layout / Cards

| Capability | Status | Accepted scope |
|---|---|---|
| `UX-REGRESSION-001` and `WELCOME-INTRO-001` | COMPLETED | Repaired owned functional/semantic/legibility regressions and established versioned first-use orientation with human acceptance. |
| `WORKSPACE-COMPOSITION-002` | COMPLETED / ACCEPTED CHECKPOINT WITH KNOWN DEBT | Stronger state-aware composition; Controls First and ineffective density selector removed; only useful specialized presets survive; debt remains `RET-COMPOSITION-002`. |
| `DOCS-CAPABILITY-DOSSIERS-001` | COMPLETED / ACCEPTED DOCUMENTATION ARCHITECTURE CHECKPOINT | Durable dossier layer, Legacy ID Index, Interaction Grammar, recovered intent, anti-loop governance, and concise live planning; no runtime feature work. |
| `TABLE-PHYSICALITY-003` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT | Human acceptance passed table scale, HU/normal Hand composition, felt/rail coherence, Hero-card readability, and contribution-to-pot presentation as sufficient to move on. Revealed-opponent card inspectability remains `RET-CARDS-THEMES-001` debt; no perfect-polish claim is made. |
| `SETTINGS-IA-001` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | Replaced the god menu with Appearance, Audio & Motion, Language & Help, and Account & Data categories; retained one authority per existing preference, demoted previews to actions, exposed truthful OS motion status, and kept Learn Riverline primary. Automated coverage is complete; live Firefox acceptance remains routed debt. |
| `HANDS-ON-PRODUCT-REVIEW-001` | COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED | An independent outside-user review originated 59 findings; the product owner manually reproduced all 59; detailed evidence and ownership live in the review artifact. No finding is closed. |
| `HANDS-ON-DEFECTS-001` | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT DEBT | Successful bounded repairs are preserved; repeated structural failures and newly discovered functional defects remain explicitly routed rather than cosmetically patched again. |
| `PREMIUM-CLOSEOUT-001` | PLANNED LATER / PRE-RELEASE QUALITY GATE | Whole-product manual QA, final high-value visual-debt burn, Guide finalization, responsive desktop matrix, EN/RU/HE/RTL, accessibility, cards/table/replay/Settings polish, theme consistency, applicable Return Queue debt, and release-quality Core Flow acceptance after the feature set is materially more mature. |
| evidence-grounded natural-language intelligence | PRESERVED FUTURE / first concrete slice `PERSONAL-INSIGHTS-001` | Facts / Explain / Coach depth over approved structured evidence, with facts-only use always available. See [Natural-Language Intelligence](capabilities/NATURAL_LANGUAGE_INTELLIGENCE.md). |
| shared interaction integrity | COMPLETED | Accepted product rule: one semantic owner and interaction language across applicable surfaces; see [Interaction Grammar](INTERACTION_GRAMMAR.md). |
| restrained felt/table/chip customization | OPEN PRODUCT DECISION | Default quality first; customization cannot compensate for a bad default. |
| arbitrary layout editor, Controls First, ineffective density choice | REJECTED / REMOVED | Do not revive without materially new evidence. Global Beginner/Expert mode is superseded by strong defaults plus local Facts/Explain/Coach depth. |

## 11. Opponent Policies / Bots

| Capability | Status | Accepted scope |
|---|---|---|
| `OPPONENT-POLICY-ARCH-001` and opponent intelligence | PRESERVED FUTURE / high strategic value | Context-conditioned observations and versioned population/generic/real/custom policies separate from reference, exploit, Personal Strategy, and claims about people. See [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md). |
| full-hand bot Training | PRESERVED FUTURE / dependency-gated | Legal complete hands, post-hand review, Save/re-drill continuity, and explicit policy assumptions after table/Training/reference maturity. |

## 12. Platform / Release / Mobile

| Capability | Status | Accepted scope |
|---|---|---|
| browser runtime / thin Electron / CI | COMPLETED FOUNDATION | Same dependency-free browser application in Electron; Node 24 syntax/full-suite CI. |
| targeted architecture decomposition | PRESERVED MAINTENANCE | Extract stable seams only when real tickets touch them; no rewrite program. |
| live Supabase verification | PLANNED LATER / release gate | Migrations, RLS, idempotency, conflicts, and multi-profile Firefox lifecycle. |
| packaging/hosting/offline/privacy/legal/observability | PRESERVED FUTURE | Before public release as applicable. |
| deliberate mobile | PRESERVED FUTURE | A distinct composition, not compressed/stacked desktop. |
| telemetry and public release/monetization | OPEN PRODUCT DECISION | Privacy-first and no implied commitment. |

## 13. PLO / Other Game Domains

| Branch | Status | Accepted path |
|---|---|---|
| PLO | PRESERVED FUTURE | Separate four-card domain, exactly-two-hole evaluation, dedicated ranges/Equity/Training/reference/UI; never a Hold'em toggle. |
| tournament/ICM depth | PRESERVED FUTURE | Explicit tournament assumptions and reference/accounting pipeline. |
| other variants | OPEN PRODUCT DECISION | No generic framework until a real need exists. |

## 14. Open Product Decisions

- whether the preferred exact BB-versus-BTN family can acquire a production-safe source or must yield to a better licensed/reproducible bounded family;
- Training `Not sure` behavior, Training-evidence opt-in placement/default, and future default comparison source;
- first OpponentPolicy archetypes and custom-policy UX;
- Saved folders/collections and sharing/forking permissions, read-only-first scope, comments, friends, study groups, and shared drills;
- Home Game Fewest Transfers vs Banker/preferred banker settlement preference and later payment workflow;
- whether username login is required before release;
- restrained table/felt/chip customization only after default quality is strong;
- card-outcome preview touch/click semantics;
- study goals/streaks based on real activity; mastery waits for valid history; XP/badges/levels/achievements remain rejected by default;
- mobile timing, public release/monetization, PLO priority, and telemetry.

## Pull-forward rule

A preserved item moves earlier only through explicit reprioritization and a bounded owner. Touching a related file or documenting an idea does not authorize implementation. Priority changes update Current Phase, Roadmap, and the affected row here together.
