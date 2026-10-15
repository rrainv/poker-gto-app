# Legacy and recovered capability ID index

This index makes compressed historical ideas and ticket-provided recovery aliases searchable. It is a recovery map, not a backlog, priority list, status authority, or proof of implementation.

The `PROD-*` identifiers in the first table occur literally in reachable Git history. The ticket-supplied recovery aliases in the second table do not; they are mapped to concepts found in the original `PROD-*` backlog, the historical strategy archive, the detailed pre-compression planning documents, current specifications, and current code. Classification describes the concept's disposition only:

- **IMPLEMENTED:** a current implementation/specification owns the recovered intent.
- **PRESERVED:** the intent remains desired, possibly evolved or dependency-gated.
- **SUPERSEDED:** a newer product direction owns the underlying job.
- **REJECTED:** do not revive without new evidence and an approved product decision.

Recovery evidence included the `PROD-*` backlog at `64f2213`, the detailed pre-consolidation backlog immediately before `4ed3417`, the consolidation around `77c7b9a`, the historical master strategy archive, later subsystem commits/specifications, and current code/tests. Commit history is evidence for origin and evolution, not current status authority.

## Reachable historical `PROD-*` identifiers

| Historical ID | Current owner | Classification | Disposition |
|---|---|---|---|
| `PROD-BLUFF-001` | [Bluff Analysis specification](../BLUFF_ANALYSIS_SPEC.md) and [Bluff / Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md) | IMPLEMENTED | The bounded structural bluff-analysis foundation exists; range-aware candidate and exploit depth remains a separately preserved evolution. |
| `PROD-CLOUD-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | External research compute remains optional, measured, bounded, and spend-capped; it grants no runtime or strategy authority. |
| `PROD-COMPARE-001` | [Deep Hand Review](DEEP_HAND_REVIEW.md) and [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | PRESERVED | Evolved into source-separated comparison of decisions, references, Personal Strategy, observed play, and supported history. |
| `PROD-DATA-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Reproducible datasets wait for trustworthy labels, licensing, and a measurable validation purpose. |
| `PROD-DENSITY-001` | [Product Specification](../PRODUCT_SPEC.md) | REJECTED | The ineffective user-facing Comfortable/Compact choice was removed; responsive internal density remains an implementation concern. |
| `PROD-DESKTOP-001` | [Architecture Contract](../ARCHITECTURE_CONTRACT.md) | IMPLEMENTED | Riverline has one browser-first application with a thin Electron host and reproducible package configuration. |
| `PROD-DESKTOP-002` | [Product Backlog](../PRODUCT_BACKLOG.md) | PRESERVED | Installer/portable target and asset quality remains part of later packaging and release acceptance. |
| `PROD-IMPORT-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | The original validated, provenance-aware strategy-source intake direction is preserved and evolved; arbitrary solver-tree upload remains rejected. |
| `PROD-KEYBOARD-001` | [Interaction Grammar](../INTERACTION_GRAMMAR.md) and [Product Specification](../PRODUCT_SPEC.md) | SUPERSEDED | A global expert keyboard mode is replaced by universal keyboard efficiency, accessibility parity, and facts-only depth where useful. |
| `PROD-LAYOUT-001` | [Product Specification](../PRODUCT_SPEC.md) | IMPLEMENTED | Safe task-specific workspace presets remain; weak options and arbitrary layout editing do not. |
| `PROD-LAYOUT-002` | [Product Specification](../PRODUCT_SPEC.md) | SUPERSEDED | A binary card-first/configuration-first option became state-aware, job-specific composition; Controls First was removed. |
| `PROD-MATH-001` | [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) and [Architecture Contract](../ARCHITECTURE_CONTRACT.md) | PRESERVED | Board, pot, hand, draw, and runout study continues through named canonical analysis capabilities, never a second UI math authority. |
| `PROD-MOBILE-001` | [Product Backlog](../PRODUCT_BACKLOG.md) | PRESERVED | Mobile remains a deliberate future composition rather than stacked or compressed desktop panels. |
| `PROD-MODE-001` | [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md) and [Product Specification](../PRODUCT_SPEC.md) | SUPERSEDED | Global Beginner/Expert mode became strong defaults plus local Facts / Explain / Coach depth. |
| `PROD-MODEL-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | A learned provider remains dependency-gated by trustworthy data and bounded validation behind StrategyProvider. |
| `PROD-MOTION-001` | [Audio and Motion specification](../AUDIO_MOTION_001_SPEC.md) | IMPLEMENTED | Restrained semantic motion and user controls are established over one presentation-only event boundary. |
| `PROD-PERSONALIZE-001` | [Product Specification](../PRODUCT_SPEC.md) | IMPLEMENTED | Bounded workspace/theme preferences persist and reset safely; arbitrary drag/drop serialization remains rejected. |
| `PROD-RANGE-000` | [Range Core specification](../RANGE_CORE_SPEC.md) | IMPLEMENTED | Canonical combo identity, weighted/partial ranges, provenance, blockers, normalization, and Matrix projection exist. |
| `PROD-RANGE-001` | [Range Builder specification](../RANGE_BUILDER_SPEC.md) | IMPLEMENTED | The class-level Personal Strategy Builder foundation exists over the shared immutable evidence authority. |
| `PROD-RANGE-002` | [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | SUPERSEDED | Crude tight/loose profiling became evidence-grounded Calibration, inference, uncertainty, comparisons, and supported summaries. |
| `PROD-RANGE-003` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Named Saved Ranges and sharing wait for an approved payload owner, privacy, versioning, and provenance. |
| `PROD-RANGE-004` | [Analysis Range specification](../ANALYSIS_RANGE_SPEC.md) | IMPLEMENTED | Supplied weighted-range composition and blocker facts exist as a bounded foundation; broader comparisons remain separate. |
| `PROD-RANGE-005` | [Range Evolution](RANGE_EVOLUTION.md) and [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) | PRESERVED | Weighted range-vs-range Equity/category analysis requires approved request and evidence boundaries. |
| `PROD-RANGE-006` | [Range Evolution](RANGE_EVOLUTION.md) and [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Provider-backed postflop full-range views require exact board-aware combo coverage and validated source authority. |
| `PROD-RELEASE-001` | [Product Backlog](../PRODUCT_BACKLOG.md) | PRESERVED | Documentation, privacy/legal, observability, telemetry decisions, and release acceptance remain explicit later gates. |
| `PROD-REPLAY-001` | [Architecture Contract](../ARCHITECTURE_CONTRACT.md) and [Deep Hand Review](DEEP_HAND_REVIEW.md) | IMPLEMENTED | Canonical deterministic Replay, timeline, step-through, and restrained event consequences exist; deeper review is separate. |
| `PROD-SAVE-001` | [Saved Study Objects specification](../SAVED_STUDY_OBJECTS_SPEC.md) and [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | IMPLEMENTED | Save Hand/Spot, annotations, review/mistake state, archive, and replayable canonical payloads form the current foundation; future object kinds remain separate. |
| `PROD-SESSION-001` | [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) and [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Durable decision/session history, review continuity, and longitudinal evidence remain the next learning substrate. |
| `PROD-SOLVER-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) and [Architecture Contract](../ARCHITECTURE_CONTRACT.md) | PRESERVED | Bounded solver validation remains isolated research and cannot become production authority by proximity. |
| `PROD-TABLE-001` | [Product Backlog](../PRODUCT_BACKLOG.md) and [Table Presence brief](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md) | PRESERVED | Table Presence is an implemented foundation; richer default felt/rail/seat/card/chip/pot physicality remains a named product evolution. |
| `PROD-TABLE-002` | [Audio and Motion specification](../AUDIO_MOTION_001_SPEC.md) and [Product Backlog](../PRODUCT_BACKLOG.md) | PRESERVED | Restrained dealing/chip/contribution consequences have a foundation; further physical refinement remains bounded by presentation authority. |
| `PROD-TABLE-003` | [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) | PRESERVED | User-controlled table identity may replace generic labels, but linking a name to an opponent model requires explicit identity and privacy semantics. |
| `PROD-TABLE-004` | [Architecture Contract](../ARCHITECTURE_CONTRACT.md) | IMPLEMENTED | Canonical starting/current stacks are state facts and current table projections consume them without a second stack authority. |
| `PROD-TABLE-005` | [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) and [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Notes and context-conditioned tendencies require explicit ownership, evidence, privacy, and provenance. |
| `PROD-TABLE-006` | [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) | PRESERVED | Per-opponent policy/model work remains versioned, context-conditioned, uncertain, and separate from reference strategy. |
| `PROD-THEME-001` | [Product Specification](../PRODUCT_SPEC.md) | IMPLEMENTED | A curated semantic theme system and transactional custom-theme editing exist; catalog expansion is not an automatic goal. |
| `PROD-TRAIN-001` | [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Existing structural filters/planning are a foundation; richer evidence-backed history filters remain future. |
| `PROD-TRAIN-002` | [Training Intelligence](TRAINING_INTELLIGENCE.md) and [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Mistake/review queues and a study library wait for durable decision/session evidence. |
| `PROD-TRAIN-003` | [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Same/similar re-drill and spaced/adaptive review remain desired. |
| `PROD-TRAIN-004` | [Training Practice Planner specification](../TRAINING_PRACTICE_PLANNER_SPEC.md) and [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Deterministic curriculum planning exists; history-aware adaptation and range-profile use remain dependency-gated. |
| `PROD-TRAIN-005` | [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) and [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Cross-session decision memory remains future and must retain the source/version known at decision time. |
| `PROD-TUTORIAL-001` | [Tutorial and Onboarding specification](../TUTORIAL_ONBOARDING_SPEC.md) | IMPLEMENTED | Versioned contextual tutorials, skip/restart, accessibility, localization, and per-feature extension ownership exist. |
| `PROD-WEB-001` | [Product Backlog](../PRODUCT_BACKLOG.md) | PRESERVED | Public hosting remains a later release branch after product, privacy, offline, and operational readiness. |

## Ticket-supplied recovery aliases and named concepts

| Recovery alias or historical name | Current owner | Classification | Disposition |
|---|---|---|---|
| `CARD-OUTCOME-PREVIEW-001` | [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) | PRESERVED | Exact hovered/focused hypothetical card, all available Hero cards, canonical best five, kickers, and distinct hypothetical state; never implied Equity. |
| `UI-CARD-SEMANTICS-001` | [Interaction Grammar](../INTERACTION_GRAMMAR.md) | PRESERVED | Visible card identity uses the shared rank/suit language rather than leaking internal IDs. |
| `BEGINNER-EXPERT-001` | [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md) and [Product Spec](../PRODUCT_SPEC.md) | SUPERSEDED | Global mode replaced by strong defaults plus local Facts / Explain / Coach depth; expert keyboard efficiency remains independently valid. |
| `PROFILE-SUMMARY-001` | [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | PRESERVED | Evidence-backed profile comparisons, uncertainty, and summaries; no invented personality prose. |
| `RANGE-BUILDER-002` | [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) and [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Evolves beyond implemented class-level Builder into approved combo-aware/general Saved Range work without a second evidence authority. |
| `GUIDED-TUTORIALS-002` | [Tutorial and Onboarding Specification](../TUTORIAL_ONBOARDING_SPEC.md) | IMPLEMENTED | Contextual first-use, skip, restart, localization, accessibility, and per-feature ownership are established; new features extend the existing system. |
| `NOTES-TAGS-001` | [Saved Study Objects Specification](../SAVED_STUDY_OBJECTS_SPEC.md) | IMPLEMENTED | Shared notes/tags exist for current Hand/Spot objects; future object types reuse the same authority. |
| `STUDY-GOALS-001` | [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Restrained goals based on real study history; exact goal/streak mechanics remain open. |
| `PROFILE-SNAPSHOT-001` | [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | PRESERVED | Duplicate/version/compare/roll back experiments while retaining immutable evidence history. |
| `EXPORT-IMPORT-001` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Domain portability foundations exist; a coherent user-visible personal-data flow remains future. |
| `SOCIAL-SHARE-001` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Explicit, private-by-default sharing after identity, privacy, and versioning maturity. |
| `SHAREABLE-SPOT-001` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Share versioned Riverline state and provenance, not merely a screenshot. |
| `SOCIAL-FORK-001` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Clone/fork with parent and source provenance; permissions remain an explicit decision. |
| `COLLAB-REVIEW-001` | [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | PRESERVED | Later comments, annotations, and collaborative review over approved shared objects. |
| `RANGE-VS-RANGE-001` | [Range Evolution](RANGE_EVOLUTION.md) and [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) | PRESERVED | Weighted range-vs-range facts and Equity require an approved request boundary and complete range semantics. |
| `RANGE-TRAJECTORY-001` | [Range Evolution](RANGE_EVOLUTION.md) | PRESERVED | Evolved into visual, action-conditioned range evolution. |
| `POSTFLOP-RANGE-PROPAGATION-001` | [Range Evolution](RANGE_EVOLUTION.md) | PRESERVED | Evolved into exact combo-level preflop-to-river propagation with provenance and unknown preservation. |
| `ANALYSIS-PERSONALIZED-001` | [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | PRESERVED | Compare intended, reference, and observed roles without collapsing them. |
| `RANGE-ADVANTAGE-001` | [Range Evolution](RANGE_EVOLUTION.md) | PRESERVED | Range/nut distribution claims only from explicit, sufficiently complete weighted ranges. |
| `BLOCKER-QUALITY-001` | [Bluff and Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md) | PRESERVED | Strategic blocker quality requires an explicit reference frame or value/bluff/continue/fold partition. |
| `BLUFF-VALUE-002` | [Bluff and Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md) | PRESERVED | Evolved into range-aware value, bluff, semibluff, and bluff-catcher roles. |
| `BLUFF-COACHING-002` | [Bluff and Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md) | PRESERVED | Evidence-grounded candidate construction and recurring-pattern coaching. |
| `OPPONENT-PROFILES-001` | [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) | PRESERVED | Evolved into context-conditioned opponent observations and explicit policy parameters. |
| `POKER-SOURCE-INTAKE-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | SUPERSEDED | The generic intake concept is replaced by source authority, research-only benchmark observations, and validated bounded provider intake; arbitrary source upload is not authority. |
| `REFERENCE-PACK-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Versioned bounded pack/provider with exact assumptions, coverage, licensing, provenance, and validation. |
| `FALLBACK-CALIBRATION-002` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Evidence-driven family calibration remains valid; the narrow implemented calibration does not complete the broad program. |
| `DATASET-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Reproducible datasets only after trustworthy anchors demonstrate value. |
| `MODEL-PROVIDER-001` | [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | PRESERVED | Validated learned provider behind StrategyProvider only after trustworthy data and bounded evaluation. |
| `HOME-GAME-SETTLEMENT-001` | [Home Game Organizer Specification](../HOME_GAME_ORGANIZER_SPEC.md) | IMPLEMENTED | Exact deterministic debtor-to-creditor settlement is derived from the canonical ledger. |
| `HOME-GAME-SETTLEMENT-UX-001` | [Home Game Organizer Specification](../HOME_GAME_ORGANIZER_SPEC.md) | IMPLEMENTED | Bounded Receives/Owes/Even and settlement transfer presentation exists; richer preference/history/payment work remains separate. |
| `HOME-GAME-TABLE-LINK-001` | [Home Game Evolution](HOME_GAME_EVOLUTION.md) | PRESERVED | Stable Hand/session linkage applied exactly once, with reconciliation for untracked real-world hands. |
| `RANDOM-SPOT-GENERATOR-001` | [Random Spot Generator](RANDOM_SPOT_GENERATOR.md) | PRESERVED | Legal, lock-aware, known/dead-card-aware, reproducible random study-state utility. |
| Training `Not sure` | [Training Intelligence](TRAINING_INTELLIGENCE.md) | PRESERVED | Open product question; Calibration's implemented no-evidence behavior is not automatically Training behavior. |
| Fewest Transfers vs Banker / preferred banker | [Home Game Evolution](HOME_GAME_EVOLUTION.md) | PRESERVED | Open product choice; do not relabel the current deterministic stable-order algorithm as either preference. |
| `CONTROLS-FIRST` | [Product Spec](../PRODUCT_SPEC.md) | REJECTED | Removed after repeated human QA; do not revive the weak preset. |
| `COMFORTABLE-COMPACT` user-facing selector | [Product Spec](../PRODUCT_SPEC.md) | REJECTED | Removed as an ineffective product choice; safe internal compatibility is not a reason to expose it again. |
| `ARBITRARY-LAYOUT-EDITOR` | [Product Spec](../PRODUCT_SPEC.md) | REJECTED | Arbitrary drag/drop composition conflicts with deliberate task hierarchy. |
| XP / badges / levels / achievements | [Training Intelligence](TRAINING_INTELLIGENCE.md) | REJECTED | Rejected by default as engagement theater unless materially new evidence changes the product decision. |
| Fake cinematic 3D / casino spectacle | [Product Spec](../PRODUCT_SPEC.md) | REJECTED | Restrained table depth and physical relationships remain valid; casino scenery and spectacle do not. |
