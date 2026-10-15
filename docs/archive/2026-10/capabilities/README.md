# Riverline capability dossiers

Capability dossiers preserve durable, long-term product intent at a level of detail that does not belong in live planning or implementation contracts.

The documentation roles are deliberately separate:

- **Dossier:** long-term intent, dependencies, interactions, recovered microfeatures, and open design questions.
- **Product Backlog:** concise accepted capability and status record.
- **Current Phase / Roadmap:** current sequence and the reason major phases are ordered.
- **Specification and code:** current implemented contract and final implementation truth.

Dossiers do not set `ACTIVE NEXT`, close bugs, describe checkpoint debt, or prove that a feature exists. See the [Product Backlog](../PRODUCT_BACKLOG.md), [Current Phase](../CURRENT_PHASE.md), [Roadmap](../ROADMAP.md), [QA Backlog](../QA_BACKLOG.md), and [Return Queue](../PRODUCT_RETURN_QUEUE.md) for those roles.

## Capability navigation

| Capability | Purpose | Major related current specifications |
|---|---|---|
| [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) | Preserve or reconstruct the evidence needed for longitudinal learning without building redundant records. | [DecisionContext](../DECISION_CONTEXT_SPEC.md), [Game Rules](../GAME_RULES_V1_SPEC.md), [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md) |
| [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md) | Project approved structured evidence into useful explanation and synthesis without becoming poker authority. | [Architecture Contract](../ARCHITECTURE_CONTRACT.md), [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md), [Analysis Range](../ANALYSIS_RANGE_SPEC.md) |
| [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md) | Evolve from generalized fallback to validated, bounded reference providers with exact coverage and provenance. | [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md), [Reference Benchmark](../REFERENCE_BENCHMARK_SPEC.md), [DecisionContext](../DECISION_CONTEXT_SPEC.md) |
| [Equity and Hand Analysis](EQUITY_HAND_ANALYSIS.md) | Build exact hand, draw, runout, nut, blocker, standing, and outcome-preview intelligence over canonical poker facts. | [Analysis Range](../ANALYSIS_RANGE_SPEC.md), [Range Core](../RANGE_CORE_SPEC.md), [Architecture Contract](../ARCHITECTURE_CONTRACT.md) |
| [Bluff and Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md) | Extend structural bluff facts into range-aware value, bluff-catcher, candidate-quality, and explicit exploit analysis. | [Bluff Analysis](../BLUFF_ANALYSIS_SPEC.md), [Analysis Range](../ANALYSIS_RANGE_SPEC.md), [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) |
| [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) | Represent context-conditioned opponent evidence and policies without vague labels or false certainty about people. | [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md), [Analysis Range](../ANALYSIS_RANGE_SPEC.md), [Home Game Organizer](../HOME_GAME_ORGANIZER_SPEC.md) |
| [Deep Hand Review](DEEP_HAND_REVIEW.md) | Evolve canonical Replay and shared decision review into evidence-rich street-by-street study. | [Table Presence brief](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md), [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md), [Game Rules](../GAME_RULES_V1_SPEC.md) |
| [Training Intelligence](TRAINING_INTELLIGENCE.md) | Add durable decision memory, review queues, re-drill, adaptive scheduling, and truthful learning summaries. | [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md), [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md), [Tutorials](../TUTORIAL_ONBOARDING_SPEC.md) |
| [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md) | Extend the shared intended-strategy evidence model into comparison, insight, uncertainty, and later postflop work. | [Personal Strategy Foundation](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md), [Unified Range Intelligence](../UNIFIED_RANGE_INTELLIGENCE_SPEC.md), [Range Inference](../RANGE_INFERENCE_SPEC.md) |
| [Range Evolution](RANGE_EVOLUTION.md) | Propagate distinct, provenance-aware weighted ranges through exact actions from preflop to river. | [Range Core](../RANGE_CORE_SPEC.md), [Personal Strategy Action Contract](../PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md), [Analysis Range](../ANALYSIS_RANGE_SPEC.md) |
| [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) | Grow versioned local study objects into a searchable knowledge workspace and privacy-safe sharing model. | [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md), [Saved Sync](../SAVED_OBJECT_SYNC_SPEC.md), [Home Dashboard](../HOME_DASHBOARD_SPEC.md) |
| [Home Game Evolution](HOME_GAME_EVOLUTION.md) | Continue the separate exact-accounting organizer into richer session, settlement, history, and optional Hand linkage. | [Home Game Organizer](../HOME_GAME_ORGANIZER_SPEC.md) |
| [Random Spot Generator](RANDOM_SPOT_GENERATOR.md) | Provide legal, lock-aware, reproducible study-state randomization without creating another card or state authority. | [Game Rules](../GAME_RULES_V1_SPEC.md), [Range Core](../RANGE_CORE_SPEC.md), [Architecture Contract](../ARCHITECTURE_CONTRACT.md) |

## Shared navigation

- [Interaction Grammar](../INTERACTION_GRAMMAR.md) defines cross-surface semantic and interaction integrity.
- [Legacy ID Index](LEGACY_ID_INDEX.md) maps recovered names to current owners and classifications; it is not a backlog.
- [Documentation Governance](../DOCUMENTATION_GOVERNANCE.md) defines authority and coordinated-update rules.

