# Riverline Product and Feature Backlog

Last consolidated: August 26, 2026 (`SETTINGS-IA-001` completed as an accepted implementation checkpoint with explicit manual Firefox debt; `PREMIUM-CLOSEOUT-001` is active next).

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
| 1 | ACTIVE NEXT | `PREMIUM-CLOSEOUT-001` |
| 2 | PLANNED NEXT | first trusted bounded reference pack/provider |
| 3 | PLANNED NEXT | Training Memory / re-drill |
| 4 | PLANNED NEXT | `PERSONAL-STRATEGY-002R` |
| 5 | PLANNED NEXT | Personal Strategy provider/reference/observed integration |
| 6 | PLANNED LATER | `PERSONAL-INSIGHTS-001` |
| 7 | PLANNED LATER | `RANGE-EVOLUTION-001` |
| 8 | PLANNED LATER | `HOME-002B` Saved Study Library |
| 9 | PRESERVED FUTURE | OpponentPolicy / bots |
| 10 | PRESERVED FUTURE | release/mobile/social/PLO later |

Documented Equity, bluff, opponent, natural-language, Home Game, sharing, and randomization depth remains in its existing status; the dossier migration does not pull it forward.

## 1. Strategy / Reference

| Capability | Status | Accepted scope |
|---|---|---|
| source authority, DecisionContext, fallback repair, role semantics, benchmark, and bounded calibration | COMPLETED FOUNDATION | One `DecisionContext → StrategyProvider → StrategyResult → StrategyClaimPolicy` path; current v4 remains generalized/comparative and narrowly calibrated. |
| first trusted bounded reference pack/provider | PLANNED NEXT after visible closeout | Exact rules/rake/stacks/sizing tree, version, licensing/provenance, validation, declared capabilities, coverage matcher, and unsupported fallback. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| broader preflop/postflop reference and evidence-driven fallback calibration | PRESERVED FUTURE | Expand only through measurable validation; exact coverage never extrapolates. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| trustworthy datasets and learned/model providers | PRESERVED FUTURE / dependency-gated | Only after validated anchors demonstrate value; never train on heuristic labels and market the result as GTO. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |

Known limitations remain explicit: no validated general reference, coarse postflop opponent ranges, no trustworthy general sizing strategy, no solved multiway equilibrium, and narrow v4 calibration.

## 2. Full Hand / Replay / Review

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Hand, Table Presence, Replay, and shared Full Hand Review | COMPLETED FOUNDATION | Legal Hand history, deterministic read-only Replay, `table-presentation/v1`, `hand-review/v1`, Hero decisions, pre-action frames, source-gated comparison, provenance, Analyze/Save/Repeat/Next continuity. |
| deeper evidence-rich Hand Review | PRESERVED FUTURE / dependency-gated | Street-by-street Equity/hand/range/reference/Personal/observed/opponent evidence and supported synthesis without another history or grader. Chronology/navigation orientation remains an explicit Riverline product-fit question, not a permanently accepted horizontal pattern. See [Deep Hand Review](capabilities/DEEP_HAND_REVIEW.md). |

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
| Training Memory / DecisionRecord / review and re-drill | PLANNED NEXT | Durable shown/answered/source/version/context/session history, mistake/review queue, same/similar re-drill, spaced/adaptive review, filters, saved drills, truthful trends, and Home/Replay continuity. See [Learning Evidence Foundation](capabilities/LEARNING_EVIDENCE_FOUNDATION.md) and [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |
| profile-aware Training evidence and opponent-policy drills | PLANNED LATER / dependency-gated | Explicit opt-in, immutable observed provenance, no overwrite of intended strategy, later explicit opponent policy. |
| study goals | PRESERVED FUTURE / mechanics open | Restrained goals derived from real history; XP/badges/levels/achievements remain rejected by default. See [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |

Training `Not sure` behavior remains an open product question; Calibration's existing no-evidence behavior is not inherited automatically.

## 5. Personal Strategy

| Capability | Status | Accepted scope |
|---|---|---|
| Foundation / Calibration / inference / Matrix / Builder / Teacher | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Three user-named modes per profile, sparse immutable intended evidence, dominant-only ≠ pure, contradictions, categorical uncertainty, adaptive questions, and one shared evidence authority. |
| `PERSONAL-STRATEGY-002R` | PLANNED NEXT | Independent real-user review before provider integration or more inference machinery. |
| provider/reference/observed integration | PLANNED NEXT | Keep intended Personal Strategy, selected reference, and observed play explicit; Training evidence is opt-in. |
| `PERSONAL-INSIGHTS-001` | PLANNED LATER after integration | Cross-profile Teach Riverline Next queue and evidence/provenance/uncertainty-aware summaries. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |
| profile snapshots/experiments/rollback and later postflop/combo depth | PRESERVED FUTURE | Preserve evidence history, uncertainty, discrete mode semantics, and source roles. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |

## 6. Analysis / Matrix / Ranges / Equity

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Equity | COMPLETED | One exact/seeded Monte Carlo 2–10-player service with win/tie/share accounting; no weighted-opponent request yet. |
| `RANGE-CORE-001` | COMPLETED | 52 cards → 1,326 combos → `HoldemWeightedRange v1` → blocker/normalization/Matrix projections; unknown ≠ zero. |
| `ANALYSIS-RANGE-001` and `BLUFF-001` | CHECKPOINTED | Structural exact-hand/draw/board/blocker/range and bounded bluff economics/removal facts; no invented ranges, response, EV, advantage, or verdict. |
| `EQUITY-HAND-ANALYSIS-001` | PLANNED LATER / dependency-gated | Structured hand/runout/nut/blocker/standing intelligence and shared card-outcome preview. See [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md). |
| `BLUFF-ANALYSIS-002` | PLANNED LATER / dependency-gated | Range-aware value/bluff/bluff-catcher/candidate-quality and explicit exploit analysis. See [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md). |
| `RANGE-EVOLUTION-001` | PLANNED LATER | Canonical combo-level action-conditioned preflop-to-river propagation with distinct reference/Personal/opponent roles. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| weighted range-vs-range / range and nut distribution | PRESERVED FUTURE / dependency-gated | Requires approved Equity/Analysis boundaries, explicit weighted ranges, provenance, and unknown-preserving semantics. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| `RANDOM-SPOT-GENERATOR-001` | PRESERVED FUTURE | Legal lock-aware randomized study-state utility for supported consumers. See [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md). |

## 7. Saved / Home

| Capability | Status | Accepted scope |
|---|---|---|
| Saved Hand / Spot | COMPLETED | Versioned local-first objects, shared title/note/tags/review/mistake metadata, archive, observer-safe canonical Replay, and portability foundations. |
| `HOME-002A` My Riverline | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account-aware Continue and bounded Saved/Recent/Review/Mistakes/Personal Strategy previews; human acceptance remains open. |
| `HOME-002B` Saved Study Library | PLANNED LATER | Dense master-detail Hands/Spots first, then approved Range/Drill/Review/Session payloads with search/filter/tags and explicit Open/Study. See [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |
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
| `PREMIUM-CLOSEOUT-001` | ACTIVE NEXT | Whole-app hierarchy/Core Flow, Guide, desktop, themes/cards, EN/RU/HE/RTL, accessibility, Settings Firefox verification, and human visual closeout. |
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

- exact first trusted reference-pack family;
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
