# Personal Strategy Intelligence v1

Implementation ticket: `PERSONAL-STRATEGY-INTELLIGENCE-001` plus the shared natural-language foundation. The user explicitly authorized this versioned migration and product redesign. Implementation and focused integration verification are complete; human acceptance remains pending. This specification does not declare an accepted checkpoint or change roadmap sequencing. QA ownership remains in [QA_BACKLOG.md](QA_BACKLOG.md).

## Product and authority

The explicitly authorized `PERSONAL-STRATEGY-COACH-001` + `RANGE-EVOLUTION-001A` continuation adds [Coach and Teach-through-a-Hand](PERSONAL_STRATEGY_COACH_V1_SPEC.md): exact-node intended evidence in the existing repository, exact-size action conditioning, canonical public-card removal, first reached-flop physical-combo teaching, structured summaries and concept dependencies. Its approved additive store/export v3 and backend/database v4 migration preserves all legacy precision. Full turn/river UI, weighted Equity, opponent policies and unsupported Training generation remain unavailable; human acceptance is pending.

The primary object is **What Riverline understands**, an editable projection of intended strategy. Conversation, quick dominant-action answers, structured teaching, exact mixes, and secondary Matrix Edit feed the same owned evidence. Conversation history is not a strategy database.

Game Setup is an arbitrary user-named environment. Approach is an independently named intended strategy within that setup. A setup starts with one Approach and may have any positive number. Home Game, ClubGG, cash, tournament, stack-depth, player names, and exploit experiments are examples, not enums or poker accounting authority. No universal Tight/Loose coordinate or fixed anchor count is introduced.

Personal intended strategy, selected reference strategy, observed Hero behavior, opponent policy, and normative assessment remain separate. Observations never silently update intent. Reference disagreement never grants permission to judge the user's strategy wrong. No live Training observation collection or second observation store is activated.

## Durable contracts and migration

`app/src/personal-strategy/domain.mjs`, `qualitative-evidence.mjs`, `exact-node-intent.mjs`, and `repository.mjs` own the domain and persistence changes. Internal `profileId` and `modeId` names remain stable compatibility identities for Game Setup and Approach.

| Contract | Current schema | Change |
|---|---|---|
| Game Setup / StrategyProfile | `strategy-profile/v2` | One or more unique mode IDs; user name; opaque `setupAssumptions`; `setupVersion`; immutable prior metadata snapshots in `versionHistory` |
| Approach / StrategyMode | `strategy-mode/v2` | Independent name/order; `approachVersion`; prior metadata snapshots; optional frozen `forkProvenance` |
| Qualitative intended proposition | `personal-qualitative-evidence/v1` | Confirmed immutable wording, interpretation, scope, uncertainty, and correction lineage |
| Exact-node intended action | `personal-exact-node-intent/v1` | Canonical Hand node, exact subject/action/size, preferred or exact precision, snapshot and immutable correction lineage |
| Logical store | `personal-strategy-store/v3` | Adds `exactNodeIntents`; retains qualitative and legacy evidence, v2 profiles and modes |
| Portable export | `personal-strategy-export/v3` | Preserves all selected profile evidence and histories |
| IndexedDB backend | `personal-strategy-indexeddb/v4`, database version 4 | Adds `exactNodeIntents`, indexed by profile and mode, within the existing database |

Existing `range-observation/v1`, `training-observation/v1`, calibration context identities, and session contracts retain their meanings. Dominant-only direct evidence has no exact frequency. Names and opaque setup assumptions never select Game Rules or replace canonical decision contexts.

The repository accepts legacy store v0/v1/v2 and export v1/v2 through ordered explicit migration; v2-to-v3 adds an empty exact-node collection without synthesizing node/size semantics. Legacy exactly-three profile/mode records become v2 without ID remapping or truncation. Names, descriptions, tags, ownership, direct answers, exact mixes, corrections, contradictory histories, sessions, and observed evidence remain intact. Existing IndexedDB backend versions 1/2/3 upgrade through ordered atomic metadata/evidence steps. Unsupported versions and incompatible graphs fail closed. Legacy Web Storage recovery bytes remain retained. New database and portable versions prevent old clients from silently discarding new records.

A metadata update appends the unchanged previous version and increments the applicable version. Approach addition/duplication also records changed setup membership. Legacy evidence applicability still follows actual assumptions/context compatibility. The first exact-node slice deliberately requires the current exact setup/Approach version when deriving a teaching range; older exact records remain readable in history but need explicit revalidation for use after a metadata version changes. Immutable direct/qualitative evidence history is separate from metadata version history; each ordinary answer does not manufacture a new metadata version.

`addApproach(profileId, { id, displayName, description })` adds a mode and its setup relationship in one transaction. `duplicateApproach(profileId, sourceModeId, { id, displayName, description })` copies complete direct and qualitative histories with new IDs and remapped supersession links. The fork records source approach/version, source evidence IDs, copied time, and repository revision. Copied direct records retain their original evidence and point to the source record; they do not retain a live calibration-session dependency. Later source or fork edits are independent. Training observations are not copied into intent. No live inheritance is supported.

`loadApproachHistory({ profileId, modeId })` returns setup/mode metadata history, immutable direct/qualitative history, and a repository revision watermark. Named checkpoint UX and arbitrary historical rollback are not established by this metadata foundation.

Portable import validates the complete graph and all IDs before a single transaction. `ownerPolicy: 'adopt_active'` explicitly rehomes the import under the active repository owner; `require_match` requires exact ownership. Colliding IDs or incompatible direct roots abort. Existing historical provenance remains inspectable. Identity lifecycle guards and abort signals protect every repository transaction.

### Sync compatibility

Personal Strategy sync v1 has no transport/schema contract for v2 profiles or qualitative evidence. The sync boundary must report upgrade-required before queued uploads or pulls can run against the new local store. No Supabase migration, new remote evidence collection, or automatic upload is introduced here. Local editing and validated portable transfer remain available. Legacy opt-in sync implementation and acceptance debt remain owned by their existing specification and QA rows.

## Qualitative teaching and corrections

`previewPersonalStrategyIntent` supplies a bounded deterministic local interpretation in `personal-intent-interpretation/v1`. EN/RU/HE preserve the original wording and negation; topic detection suggests a follow-up without inventing exact hands/actions. Unsupported meaning stays unresolved. There is no general language-model runtime or remote request.

The application path is:

```text
user wording -> provisional preview -> explicit confirmation/correction
             -> immutable intended evidence -> refreshed understanding
```

A durable qualitative record preserves `originalWording`, `language`, `profileId`, `modeId`, `approachVersion`, `statedScope`, `inferredScope`, `unresolvedTerms`, the original interpretation, confirmed state/time, `supersedesEvidenceIds`, `correctionGroupId`, provenance, and creation time. Only `confirmation.state = confirmed` and `provenance.source = user_intent` pass the durable validator. The nested interpretation may preserve the original provisional preview for audit; its top-level confirmation is the durable intent boundary.

"I don't like weak offsuit hands" stays a qualitative preference with unresolved hand boundaries and action split. It does not create Fold, frequency, range inclusion mass, or a statistical confidence score. "Pretty wide" does not imply VPIP or any percentage. Self-assessment phrasing such as "overfold" is recorded as user wording, not accepted normative analysis.

`previewQualitativeIntent` owns an ephemeral draft in the application instance. `confirmQualitativeIntent` checks the active setup/Approach generation before creating a record. Discarded drafts never reach storage. A draft can influence the next clarification within the interaction; it cannot appear as settled intent or alter quantitative ranges.

`appendQualitativeEvidence(recordOrGroup, { expectedHeadIds })` validates one Approach/group and appends all records atomically. Supersession must reference current heads. Optional expected-head comparison detects any intervening qualitative change. The transaction verifies current Approach version and, when present in stated scope, setup version. A failed transaction retains the prior evidence. Corrections preserve previous wording and scope; superseded records remain inspectable. Scope narrowing and exceptions are explicit statements, not inferred rewriting of all neighboring hands.

## Understanding, teaching, and precision

The understanding projection distinguishes specified dominant/exact actions, confirmed qualitative tendencies, supported/tentative estimates, unknown, conflicting, unresolved, and historical evidence. These are separate evidence/precision/applicability dimensions, not a single confidence number. Existing RFI inference remains the canonical estimate authority; qualitative wording does not seed exact action frequencies.

The onboarding/range-mapping product correction replaces the five-question target with `intent: mapping`. A fresh Approach opens on one concrete question with a growing understanding alongside it. Family coverage, nearby probes and unresolved boundaries determine the initial checkpoint; no fixed onboarding quota is shown or enforced. Users can pause or stop at any time. Existing explicit legacy quick/standard/deep session APIs retain compatibility, but do not define product onboarding. Exact/mixed answers remain explicit refinement and Matrix Edit stays secondary.

`structural-range-mapping.mjs` projects deterministic overlapping hand-family coverage and boundary probe facts over canonical hand semantics. The existing `rfi-question-selection.mjs` owns ranking: explicit focus, unmapped families, unresolved boundaries, conflicts, nearby probes and coverage gaps, with repetition avoidance. `getRangeMappingProjection` and mapping sessions use that same ranking. `choosePersonalTeachingNext` only presents its first candidate, without a second ranking policy. Provisional wording can steer the next hand; only explicit user-selected focus persists as a session preference. Natural reasons name poker families/boundaries and make no optimal-information-gain claim. Initial sampling is not permission for complete-region frequency language.

Creation foregrounds name, table size and stack; optional descriptions, format, notes and Approach naming sit behind More setup options. Add context is a secondary disclosure, and notes referring to the current question preserve its canonical hand class in stated scope. Range language now reports supported preferred-action consistency, adjacent transitions, unresolved gaps, tied mixes, and regional added/removed/preserved continues. The recorded GTO Wizard/DTO product review in `TABLE_PRESENCE_COMPETITIVE_REFERENCE.md` informed the decision-first hierarchy and explicit transition to detailed inspection; no competitor interface or normative authority was imported.

## Deterministic range language and comparison

`createPersonalRangeLanguageFacts` consumes validated evidence views and compatible current RFI snapshots. `personal-range-language-facts/v1` classifies canonical hand families: suited, offsuit, pairs, Broadway/suited Broadway/offsuit Broadway, Ax/Kx/Qx, suited connectors/one-gappers, and low-card hands. Each region preserves exact/dominant/estimated/conflicting/unknown coverage, selected direct examples, action counts, evidence IDs, and a named permission criterion.

Whole-region frequency language requires complete explicit class-mix coverage. It uses canonical combo counts for weighting and does not introduce another Range Core authority. Sparse direct examples permit only an explicitly bounded sample description. Unknowns do not become folds; estimates and qualitative tendencies do not become quantitative mass. Card-removal analysis, polarization/linear-shape assessment, and invented causal explanations are excluded.

`comparePersonalRangeLanguageFacts` compares any two user Approaches with compatible exact decision contexts. It reports shared direct classes and specific action differences; whole-region participation/aggression/call differences require complete explicit evidence on both sides. No style axis or ordering between Approaches is assumed.

`createStrategyRangeLanguageFacts` / `comparePersonalRangeToSource` receive explicit heuristic/reference role, provider results, and canonical decision contexts. They reproject each result through shared Strategy Truth and require compatible source identity/coverage across a region. Source comparison remains dominant-action comparison over representative classes; a representative result does not establish suit invariance or whole-range frequency. Sparse or mixed-source coverage fails closed. Accepted action-level assessment does not grant normative range permission.

The application source adapter runs only on an explicit visible comparison request, uses canonical legal generated decisions and StrategyProvider, checks scope throughout, yields between batches, and performs no Equity work. The visible v1 comparison uses the production heuristic baseline; the reference adapter supports explicitly supplied accepted provider results, but no new reference catalog or acceptance registry is installed. No result is extrapolated into range-level normative authority.

## Shared natural-language envelope

`createNaturalLanguageEnvelope` in `app/src/application/natural-language-envelope.mjs` defines `natural-language-envelope/v1`:

- claim class: factual, interpretive, user-intent inference, or strategic/normative;
- subject/role, evidence references, scope, uncertainty, and current/historical/provisional basis;
- descriptive/provisional/comparative wording strength;
- named derivation and permission, optional structured correction command, and supporting facts.

Interpretive claims require a named criterion. Intent inference requires provisional basis/wording. Strategic claims require explicit comparative permission with `normative: false`. No caller flag can authorize "too tight," "too loose," "mistake," or other normative region language in v1. A future accepted domain assessment contract must own that extension.

This is reusable infrastructure for Analyze, Deep Review, Training, Saved/Home/Study Inbox, Equity/Range/Hand Analysis, Import, Reference Strategy, and Opponent Intelligence. Those surfaces are not migrated by this ticket. Existing domain command/evidence owners retain authority. Personal Strategy is not automatically an OpponentPolicy or bot policy; `OPPONENT-ACTOR-INFORMATION-001` remains binding.

## Verification and acceptance

Onboarding/range-mapping correction: 323/323 focused Personal Strategy, range, language, identity and performance tests pass; ten changed runtime modules pass syntax checks and diff checks are clean. Browser inventory again returned no enabled browsers. This is bounded correction verification, not a checkpoint/docs closeout. New correction coverage is in `tests/personal_strategy_structural_mapping.test.mjs` and `tests/personal_strategy_mapping_ui.test.mjs`, with extended language, application and DOM tests.

The focused integration run passed **305/305 tests** across Personal Strategy action contracts, preflop UI, intelligence, range calibration/inference/selection, Matrix/Builder/Teacher, identity lifecycle, sync, performance and i18n. After the final fixes, a targeted run passed **104/104 tests** across intelligence application/workspace/localization/persistence/sync, domain/storage/recovery, workspace composition and identity lifecycle. These are overlapping runs, not 409 distinct tests. The final persistence/domain subset passes 38 tests; the event/DOM understanding harness passes 12; the Personal EN/RU/HE and tutorial-anchor suite passes 3. Twenty changed runtime modules passed `node --check`; `git diff --check -- app shared tests docs` passed.

Behavioral evidence includes six Approaches, five structurally varied dominant answers, no qualitative frequency conversion, real heuristic comparisons, complete/sparse region permission gates, stale preview/load/confirmation results, owner invalidation, grouped correction/reload/restore, independent frozen duplication, immutable metadata histories, real legacy v1 fixtures, interrupted IndexedDB upgrades, and portable ownership adoption. Final fixes preserve unrelated Approach versions when setup metadata changes, rebind copied scope/exception references while preserving the source interpretation, retain newer typed text during an earlier confirmation, discard older same-scope loads, apply setup defaults on switching, and remove a duplicate description DOM ID that misrouted the setup editor.

The separate `tutorial002_current_app_coverage.test.mjs` run is **6 passed / 2 failed** for pre-existing unrelated changes: the Home Guest data sentence is missing from the tutorial locale catalog, and the Training feedback assertion still expects the old universal-optimality sentence. Personal tutorial v2 and its EN/RU/HE keys/anchors pass dedicated checks. Existing i18n/Training tutorial owners retain these failures; they are not silently closed or absorbed into this ticket. The full repository checkpoint gate was not run.

Browser automation inventory was unavailable (no enabled apps or browsers at inspection); no browser/visual acceptance is claimed. Human QA must exercise arbitrary setup creation, four or more Approaches, adaptive family/boundary mapping and early stop, qualitative preview/confirm/correct/narrow/exception, understanding, exact/mixed edits, personal/source comparisons and sparse abstention, reload/history/fork independence, owner transitions, and EN/RU/HE keyboard/RTL at supported desktop sizes. Check that custom format/notes remain user assumptions and the exact canonical context/rules are visible before comparing. `QA-PERSONAL-INTELLIGENCE-001` remains **PARTIAL / HUMAN ACCEPTANCE PENDING**. Nothing is staged or committed.

## Ticket file inventory

Paths below are relative to the repository. Some already contained uncommitted identity/truth/Training work when this ticket began; only the Personal Strategy changes belong to this ticket.

| Area | Ticket files |
|---|---|
| Understanding and teaching | `app/src/application/personal-strategy-understanding-workspace.mjs`, `personal-strategy-intelligence.mjs`, `range-calibration-service.mjs`, `range-calibration-workspace.mjs`; `app/index.html`, `app/styles.css` |
| Evidence, language and storage | `app/src/personal-strategy/domain.mjs`, `qualitative-evidence.mjs`, `intent-interpretation.mjs`, `range-language-facts.mjs`, `repository.mjs`, `indexeddb-storage.mjs`; `app/src/application/natural-language-envelope.mjs` |
| Schema compatibility | `app/src/application/personal-strategy-sync-port.mjs`, `saved-study-sync-bootstrap.mjs`; `app/src/sync/personal-strategy-domain-adapters.mjs`, `coordinator.mjs` |
| Localization and tutorial | `app/src/locales/range-calibration-translations.js`, `account-translations.js`, `product-translations.js`, `tutorial-translations.js`; `app/src/tutorial/current-app-tutorials.mjs` |
| New verification | `tests/personal_strategy_intelligence_application.test.mjs`, `personal_strategy_intelligence_workspace.test.mjs`, `personal_strategy_intelligence_language.test.mjs`, `personal_strategy_intelligence_localization.test.mjs`, `personal_strategy_intelligence_persistence.test.mjs`, `personal_strategy_intelligence_sync.test.mjs` |
| Updated regression fixtures | `tests/range_cal000_personal_strategy_domain.test.mjs`, `range_cal000_personal_strategy_persistence.test.mjs`, `range_cal001c_persistence_recovery.test.mjs`, `range_cal001a_workspace.test.mjs`, `range_cal001b_workspace.test.mjs`, `range_teacher001_personal_strategy.test.mjs`, `account002bb_personal_strategy_sync.test.mjs`, `identity_lifecycle001b.test.mjs`, `tutorial002_current_app_coverage.test.mjs` |
| Live contract documentation | This specification, `PERSONAL_STRATEGY_FOUNDATION_SPEC.md`, `QA_BACKLOG.md`, `capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md`, `capabilities/NATURAL_LANGUAGE_INTELLIGENCE.md` under `docs/project/` |
