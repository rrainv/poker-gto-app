# Personal Strategy Foundation Specification

Status: durable evidence/persistence authority through `RANGE-BUILDER-001`

Schema generation: v1

## 1. Purpose and authority

Personal Strategy is Riverline's local-first domain for recording how a person intends to play in a relatable poker environment. It is evidence storage, not a strategy engine. This specification and the contracts under `app/src/personal-strategy/` govern the subsystem until an approved, versioned migration supersedes them.

`UNIFIED_RANGE_INTELLIGENCE_SPEC.md` is the architecture authority for proposed inference, uncertainty, adaptive questioning, Personal Strategy Matrix, Range Builder, Range Teacher, combo overrides, and later consumer adapters. It does not replace or migrate the implemented v1 records in this specification. Sparse immutable evidence remains durable truth; proposed snapshots and inferred outputs are recomputable read models rather than new stored authority.

The active dependency boundary is:

```text
Range Calibration UI
        |
        v
async Range Calibration application service
        |
        v
Personal Strategy repository
        |
        v
record-oriented IndexedDB storage
```

The Range Calibration bootstrap dynamically imports this path only when its workspace is opened. There is no Personal Strategy import or database work in normal application startup, Playbook, Matrix, Training, Analysis, Equity, or StrategyProvider.

## 2. Terminology and locked semantics

### Strategy Profile

A `StrategyProfile` is a real, user-relatable poker environment or strategic identity, such as "Home Game with Friends", "ClubGG Freeroll", "6-max Online Cash", or "Live MTT". It is not a table position, stack, action history, or universal play-style coordinate.

Profile identity is its stable ID. Renaming a profile never changes its ID. A v1 profile has one local owner reference, a user-facing name, optional description and tags, a no-limit Hold'em domain identifier, lifecycle timestamps/state, and exactly three mode IDs.

### Strategy Mode

A `StrategyMode` is one of the profile's three user-named, discrete strategic anchors. Names such as "Normal", "Cautious", and "Pressure" are examples only. The domain stores the user's name rather than translated presentation labels.

V1 deliberately has no tight/loose enum, numeric style value, interpolation coordinate, or claim that two modes lie on a continuum. Ordering is presentation order only. Any future mathematical relationship between modes requires an explicit, versioned contract based on evidence.

The mode is the v1 range anchor; there is no separate empty `RangeAnchor` object.

### Calibration Context / Spot Context

A `CalibrationContext` contains objective facts that give an answer strategic meaning. The first supported family is `preflop_rfi`: preflop, unopened, raise-first-in calibration.

V1 context contains:

- game variant and opaque rules identifier;
- table size and valid Hero position;
- effective stack in big blinds;
- relevant ante, forced-contribution, and rake-mode facts;
- decision family.

Profile and mode IDs are not context fields. The preflop hand class is stored on each evidence record, so the addressed decision is:

```text
profile ID + mode ID + CalibrationContext + hand class
```

The hand-class vocabulary is the canonical 169-cell notation in `shared/poker-domain/hand-class.js`: pairs such as `AA`, suited classes such as `AKs`, and offsuit classes such as `AKo`.

### Direct calibration

Direct calibration means: "This is how I intend this named profile and mode to play this decision."

A one-click `raise` answer is a dominant/preferred action assertion. It does not mean raise with probability 1. Direct evidence has higher semantic authority than observed Training behavior, but v1 does not implement inference weights.

### Training observation

Training observation means: "This is the action I actually chose in a Training exercise while opting to refine this profile and mode."

It is an immutable behavioral observation, not a direct range edit. It has its own schema and collection. A Training choice can never replace or revise a direct answer.

## 3. Contract inventory

| Contract | Schema identifier | Role |
|---|---|---|
| `StrategyProfile` | `strategy-profile/v1` | Stable local-owned environment/identity and its three mode IDs |
| `StrategyMode` | `strategy-mode/v1` | User-named discrete anchor belonging to one profile |
| `CalibrationContext` | `calibration-context/v1` | Objective RFI spot facts |
| `RangeObservation` | `range-observation/v1` | Direct preferred-action evidence and its revision link |
| `TrainingObservation` | `training-observation/v1` | Actual Training choice and direct-answer comparison |
| `CalibrationSession` | `calibration-session/v1` | Resumable elicitation scope and cursor |
| Personal Strategy logical snapshot / legacy document | `personal-strategy-store/v1` | Validated domain aggregate used by migration, tests, and full snapshots; not the physical IndexedDB layout |
| Portable export | `personal-strategy-export/v1` | Validated local transfer representation |

There is no v1 `InferredRange`, confidence score, `SavedSpot`, derived range cache, solver reference, or separate profile-range snapshot. Those objects acquire authority only when a future ticket implements their behavior and validation.

`RANGE-CAL-002B` adds only recomputable read contracts over these unchanged durable records: `PersonalStrategyEvidenceView v1`, `PersonalStrategyEstimate v1`, ordinal `PersonalStrategyUncertainty v1`, inference support facts, and `PersonalStrategySnapshot v1`. They remain in memory, are excluded from portable evidence exports/cloud sync, and are specified in `RANGE_INFERENCE_SPEC.md`. No profile, mode, context, evidence, session, export, IndexedDB, or Supabase schema was migrated.

## 4. StrategyProfile v1

Required fields:

```text
schemaVersion
id
ownerRef { kind, id }
displayName
description | null
createdAt
updatedAt
gameDomain
tags[]
modeIds[3]
state = active | archived
```

`gameDomain` is `no_limit_texas_holdem` in v1. Display name is presentation text supplied by the user and is never used as identity. Tags are local metadata, not permissions or public discovery attributes.

The profile factory requires exactly three unique mode IDs. Adding or removing anchors is not an unversioned v1 edit.

## 5. StrategyMode v1

Required fields:

```text
schemaVersion
id
profileId
displayName
description | null
createdAt
updatedAt
displayOrder
state = active | archived
```

`displayOrder` is a non-negative integer and must be unique among the profile's three modes. It is not a mathematical coordinate. Validators explicitly reject `styleValue` and `interpolationCoordinate` fields to prevent accidental tight-to-loose semantics.

Profile and mode lifecycle state does not delete evidence. Archival only controls future selection/presentation.

## 6. CalibrationContext v1 and DecisionContext v1

`CalibrationContext` and `DecisionContext` overlap but are not interchangeable.

`DecisionContext v1` is an application strategy snapshot for one concrete decision. It contains cards, board, dead cards, pot, prior action projection, price facts, and a compatibility `stackBb`. It is the input to `StrategyProvider v1`.

`CalibrationContext v1` is a durable key for a family of direct answers. It stores the smaller set of objective facts required to distinguish one RFI range. In particular:

- `effectiveStackBb` is explicitly effective stack; it must not be copied from `DecisionContext.stackBb` unless the caller has separately proved the equivalence;
- `preflop_rfi` implies a preflop/unopened decision, but it does not synthesize a legal PokerState or a StrategyProvider input;
- `gameRulesId` is a durable rules identity; accounting fields preserve the strategic distinctions currently known to matter;
- hand class is the observation's 169-class key, not representative hole cards;
- profile and mode remain outside both objective context and PokerState.

A future adapter may project a proven RFI decision into a CalibrationContext or construct a DecisionContext from a complete legal source plus calibration facts. Such an adapter must be versioned and tested. This ticket provides no StrategyProvider integration and does not feed personal answers into production strategy.

## 7. RangeObservation v1

A direct observation contains:

```text
schemaVersion
id
profileId
modeId
context
handClass
dominantAction | null
hasExplicitFrequencies
frequencies[] | null
state = active | retracted
provenance {
  type = direct_calibration
  calibrationSessionId | null
  source = calibration | matrix | range_builder | absent on legacy records
  actionGroupId | absent
  undoesActionGroupId | absent
}
revision { supersedesObservationId | null }
createdAt
updatedAt
```

An active record without explicit frequencies requires a structured canonical action identity such as `{ type: "raise" }`. An active explicit mix has that identity only when one action has the unique maximum frequency. An exact maximum-frequency tie stores `dominantAction = null`; it must not invent a dominant action. Labels such as "Raise", "Open", or translated UI text are never persisted as action identity.

A retraction is a new record in the same revision chain with `state = retracted`, no dominant action, `hasExplicitFrequencies = false`, and `frequencies = null`. It removes the current answer without deleting history.

### Dominant action versus explicit mix

The following records are intentionally different:

```json
{
  "dominantAction": { "type": "raise" },
  "hasExplicitFrequencies": false,
  "frequencies": null
}
```

```json
{
  "dominantAction": { "type": "raise" },
  "hasExplicitFrequencies": true,
  "frequencies": [
    { "action": { "type": "raise" }, "probability": 1 }
  ]
}
```

The first means preferred/dominant raise with unknown mix. The second is an explicit pure raise strategy. No consumer may infer a missing mix from the dominant action.

When a mix is supplied, the factory accepts non-negative structured weights, removes zero-weight entries, normalizes positive entries to exactly one in stable input order, and closes the final floating-point residual. Action identities must be unique. A unique maximum requires the matching `dominantAction`; a maximum-frequency tie requires `dominantAction = null`.

Sizing is not encoded as a translated label or parsed string. V1 evidence uses canonical action-family identity. A future sizing-aware family must add a structured, versioned action-sizing contract.

## 8. ProfileEvidence and provenance

`ProfileEvidence` is the conceptual union of the two implemented record types:

```text
RangeObservation      provenance.type = direct_calibration
TrainingObservation   provenance.type = training_observation
```

No generic bag of evidence fields is stored. Separate contracts prevent a Training choice from acquiring direct-calibration semantics accidentally.

`TrainingObservation v1` stores its chosen canonical action, Training exercise ID, optional Training session ID, context and hand class, and an optional direct-calibration comparison. When a current direct answer with a unique dominant action exists at write time, the repository requires a comparison that references it and records `matches` or `deviates`. The relation is validated from action identities. If there is no current direct answer, or the current explicit mix is tied and therefore has no dominant action, the comparison is null.

Later direct revisions do not rewrite historical Training comparisons. This preserves what the user intended and what they did at the time. Future clarification UX can query contradictory evidence without inference being part of v1.

`RANGE-CAL-002D` and `RANGE-BUILDER-001` add source-specific direct-intent metadata inside the existing direct `RangeObservation v1` contract. They do not add a new evidence authority: `provenance.type` remains `direct_calibration`, while `source` distinguishes calibration, Matrix, and Builder UX and Builder rows may share an action group. Legacy records without `source` retain calibration semantics. Future provenance authorities such as imported, coach review, solver reference, or inferred are not accepted by v1 validators. Each needs an approved schema change with authority and trust semantics.

## 9. Revision, conflict, and deletion policy

Direct evidence is append-only revision evidence per:

```text
profile + mode + canonical context key + hand class
```

Policy:

- create: the first record has no superseded ID;
- edit/change of mind: append a new active record that supersedes the current leaf;
- retract/delete answer: append a retracted record that supersedes the current leaf;
- history: retain every prior record;
- ordinary single-device editing remains linear: a new record supersedes the selected current leaf;
- `ACCOUNT-002B-B` may preserve multiple roots/sibling leaves created independently offline; these are explicit contradictory evidence heads, not a silently selected winner;
- current answer: the selected local editing leaf plus any preserved contradictory heads; consumers count unique hands and must abstain/surface disagreement rather than fabricate confidence;
- hard deletion: not part of ordinary editing and not exposed in v1.

Repeated Training choices are separate immutable observations, not revisions of the direct chain. They can agree or conflict without changing current direct calibration.

Portable import rejects both ID collisions and a second root for an existing logical direct key before writing. It never merges histories heuristically.

## 10. CalibrationSession v1

A session stores:

```text
schemaVersion
id
profileId
modeId
contextScope
startedAt
updatedAt
state = active | paused | completed
completedAt | null
observationIds[]
cursor { nextPromptIndex }
```

This is enough to pause, close, reload, and resume a future deterministic elicitation order. The session does not embed a 169-cell derived range, inference output, statistics cache, or prompt objects. Answer counts and completion statistics are derived from observation IDs. A future adaptive order requires a versioned cursor/policy change rather than silently changing v1 meaning.

## 11. Local-first persistence

### Technology choice

`RANGE-CAL-001C-A` uses a hybrid browser-native model:

- IndexedDB database `riverline-personal-strategy`, database version `2`, is the one durable Personal Strategy record authority; v2 adds indexed conflicting evidence heads without changing v1 domain record schemas;
- Web Storage retains only the stable local-owner bootstrap, Range Calibration workspace preferences, and any pre-migration recovery source under `riverline.personalStrategy.v1`;
- domain schema identifiers remain v1; `personal-strategy-indexeddb/v2` and IndexedDB database version `2` separately version physical storage.

The decision follows measured evidence. Whole-document Web Storage remained fast for one 169-hand mode, but the supplied benchmark reached about 194 ms median at 3,042 observations and 452 ms median at 7,605 observations with a roughly 5.7 MB document. Every answer parsed, graph-validated, serialized, and synchronously replaced all history, so quota and main-thread time grew with total store size.

Whole-document Web Storage therefore fails the demonstrated scale. Chunked/journaled Web Storage would reimplement transactions, indexes, and crash recovery on a synchronous preference API. Electron-only storage would violate Firefox parity, while a server, cloud database, or third-party framework is unnecessary. Native IndexedDB supplies Firefox/Electron compatibility, atomic multi-record transactions, and indexed lookup without a new dependency.

### Repository authority

`createPersonalStrategyRepository` remains the only persistence owner. Domain objects contain no storage calls. UI calls the asynchronous Range Calibration application service and never reads IndexedDB or Web Storage directly.

The physical object stores are:

```text
metadata
profiles
modes                         index: profileId
rangeObservations             indexes: profileId, logicalKey, scopeKey, calibrationSessionId
currentRangeObservations      indexes: profileId, scopeKey
conflictingRangeObservations  indexes: profileId, logicalKey, scopeKey
trainingObservations          indexes: profileId, logicalKey
calibrationSessions           indexes: profileId, scopeKey
```

Evidence/session records use stable domain IDs. Storage-only wrappers carry index keys and an unmodified domain `value`; storage fields never enter portable exports. `currentRangeObservations` materializes the selected editing leaf of each `profile + mode + canonical context + hand` chain, including retracted leaves. `conflictingRangeObservations` materializes additional synced heads by stable evidence ID. Immutable history remains in `rangeObservations`.

An accepted answer runs one strict read/write transaction over metadata, immutable history, the current-leaf index, and the session:

1. validate the domain observation/session;
2. verify profile, mode, session, and expected session timestamp;
3. verify that the observation supersedes the indexed current leaf;
4. append immutable history;
5. replace the current-leaf record;
6. replace session progress/cursor;
7. increment repository metadata;
8. commit all records atomically.

`RANGE-BUILDER-001` adds a bounded sibling transaction that validates one exact scope, unique canonical strategic points/IDs, and each current supersession head; appends all class evidence rows; replaces their current-leaf records; increments metadata once; and commits or aborts the whole group. It does not change the physical stores or database version.

The operation ID is also the observation ID. Repeating the exact same committed observation/session pair returns idempotent success rather than duplicating it. Conflicting ID reuse fails closed. Transaction abort or quota failure leaves all prior records authoritative.

`loadWorkspaceSnapshot` loads profiles, modes, sessions, and current leaves only. Full history is read only for full snapshots, migration validation, or export. Answer writes and one-hand lookup are therefore bounded independently from total immutable history.

## 12. Export and import

`personal-strategy-export/v1` is a portable JSON envelope containing export time, owner reference, selected profiles, their modes, direct evidence, Training evidence, and sessions. Export can select profile IDs and includes full direct history for those profiles.

Import behavior is deliberately conservative:

- parse and validate the complete envelope before mutation;
- require the exact supported export schema;
- require the same local owner in v1;
- reject any object-ID collision;
- reject a second root for an existing direct-calibration key;
- merge all collections in memory, validate the combined graph, then perform one IndexedDB transaction;
- leave current data unchanged on any error.

V1 does not silently regenerate IDs or adopt another owner. A future explicit "import as copy" flow may remap all IDs and references under a target owner, but that is a separate contract and UX decision.

## 13. Versioning and migrations

Every durable object and envelope has an exact schema identifier. Domain schema and physical database/backend versions are independent. The ordered synthetic domain migration remains:

```text
personal-strategy-store/v0 -> personal-strategy-store/v1
```

The v0 fixture exercises envelope changes: `ownerId` becomes structured `ownerRef`, `observations` becomes `rangeObservations`, `sessions` becomes `calibrationSessions`, and an empty `trainingObservations` collection is introduced.

On first IndexedDB activation, the repository detects the legacy `riverline.personalStrategy.v1` document. It parses, applies the ordered domain migration if necessary, validates the complete graph and owner, then imports profiles, modes, immutable evidence, current leaves, Training evidence, and sessions in one IndexedDB transaction. Counts are verified inside that transaction before completed migration metadata is written.

The legacy source is retained after success as a recovery copy; this ticket never deletes it. Completed database metadata makes repeated activation idempotent even while the source remains. If parsing, validation, quota, open, or transaction work fails, the legacy bytes remain untouched, the database transaction aborts, a typed actionable error is returned, and activation can retry. A database without completed metadata is treated as an interrupted initialization and retried.

Migration rules:

- apply migrations in declared order, one version at a time;
- validate after the final step before exposing data;
- never partially write a domain or backend migration;
- reject unknown/incompatible schema identifiers without altering stored data;
- require an approved ticket for a breaking contract change;
- additive unknown fields on recognized objects are tolerated and preserved through store cloning; the portable envelope imports only its recognized collections;
- do not reinterpret an old field when its semantics changed—introduce a new version and explicit transform.

## 14. Ownership and account readiness

V1 owner identity is structured:

```json
{ "kind": "local", "id": "stable-local-owner-id" }
```

Objects do not derive ownership from display name, browser locale, machine path, or DOM state. Modes/evidence inherit ownership through their profile relationship. The store and profile owner must match.

Only `local` is operational in v1. A future `account` owner kind requires a versioned migration and explicit transfer/merge policy, but the structured boundary avoids embedding a local username throughout child objects.

## 15. Privacy and security assumptions

Personal Strategy data is private local user data by default.

- no telemetry, upload, sync, fetch, WebSocket, remote API, or sharing behavior exists;
- export occurs only through an explicit future user action;
- import is validated and collision-safe;
- translated action labels are not treated as trusted domain values;
- malformed records fail closed rather than becoming code or UI markup;
- authentication, permissions, friends, public links, and cloud retention are outside v1.

Local browser storage is not encryption. Anyone with access to the application profile may be able to inspect it. Encryption and account security require a separately approved threat model.

## 16. Isolation, activation, and performance

The foundation modules are side-effect free at import except for constant construction. The Range Calibration bootstrap dynamically imports the workspace and creates/opens the repository only after workspace activation. Normal Riverline startup performs no Personal Strategy database open, profile read, migration, range recomputation, inference, or storage scan.

The repeatable benchmark matrix covers empty, 169, approximately 1k, approximately 3k, approximately 10k, and revision-heavy histories. In Firefox 153 with 10,140 current leaves, the accepted-answer path measured 15 ms median / 31 ms p95 / 33 ms worst; its IndexedDB transaction measured 13 ms median / 30 ms p95 / 33 ms worst. Current-leaf lookup was 1 ms median / 5 ms p95. Workspace activation intentionally grows with current-leaf count (about 1.0 s at the 10k upper fixture), while answer writes do not grow with immutable history. A 3,042-record legacy migration plus workspace activation took about 5.2 s.

Those large one-time/on-activation costs are explicit scaling triggers. If realistic profile libraries make activation or profile export disruptive, the next smallest change is profile/context-scoped workspace loading and streamed export; it does not require a domain-contract or answer-transaction change.

Future incomplete features remain isolated by:

- importing the service only from the future feature's activation boundary;
- keeping Labs data under a distinct experimental schema/key unless it passes validated import into the canonical repository;
- never making an experiment a StrategyProvider, Training, Matrix, PokerState, or Equity authority;
- storing source observations rather than unbounded derived caches;
- permitting removal of a failed Lab surface without changing the canonical Personal Strategy store.

PERF-001 remains unchanged: persistence does not resolve strategy, render Matrix cells, alter invalidation, or add a hidden surface. The accepted-answer budget is median below 50 ms and p95 below 100 ms for realistic libraries.

## 17. Integration gates for future tickets

A later ticket must not cross an integration gate without owning it explicitly:

- Range Calibration UI: collect and render these contracts; do not compute poker math;
- Training opt-in: create `TrainingObservation` only after explicit profile/mode selection and user consent;
- StrategyProvider: requires a validated personal-strategy provider/source contract and truthful coverage/provenance;
- Matrix: personal rendering must consume a validated provider result, not read repository internals in UI code;
- inference/uncertainty: crossed for preflop RFI Fold/Raise by `RANGE-CAL-002B`; the deterministic derived contracts, evidence policy, validation, and measured performance live in `RANGE_INFERENCE_SPEC.md`, while durable source schemas remain unchanged;
- adaptive questions: requires a versioned selection/cursor policy and deterministic resume behavior;
- accounts/sync: crossed by `ACCOUNT-002B-B` under `PERSONAL_STRATEGY_SYNC_SPEC.md`; later schema/domain additions still require their own sync semantics;
- import-as-copy/sharing: requires complete ID/reference remapping and explicit ownership transfer.

Follow-on work must also preserve the unified architecture gates in `UNIFIED_RANGE_INTELLIGENCE_SPEC.md`: range inclusion weight, action frequency, and inference uncertainty remain distinct; dominant-only evidence never becomes a pure frequency; inferred output and conflict markers never become evidence; the 169 Matrix is inspection/correction rather than storage; and combo-aware projections reuse Range Core identity/math without creating another `HoldemWeightedRange` authority.

## 18. Explicit non-goals

`RANGE-CAL-000` does not implement:

- Range Calibration workspace, navigation, or question UI;
- inference, confidence, adaptive elicitation, or style interpolation;
- Matrix personal-profile rendering or range recomputation;
- Training integration, profile-learning opt-in UI, or grading changes;
- StrategyProvider personal source or fallback changes;
- Range Builder, Range Teacher, mistake drilling, or saved spots;
- postflop calibration families or generalized decision-family machinery;
- accounts, authentication, permissions, friends, sync, sharing, backend, or cloud;
- solver/model/reference imports;
- telemetry or network behavior.

## 19. Foundation invariants

The following are release-blocking for this subsystem:

1. Profile, mode, objective context, and hand class retain separate meanings.
2. A profile ID remains stable across renames.
3. V1 has exactly three user-named discrete modes and no numeric style axis.
4. `dominantAction = raise` plus `frequencies = null` is not a pure raise mix.
5. Explicit mixes use structured canonical action identities and normalize to one.
6. An exact maximum-frequency tie has `dominantAction = null`; no action is fabricated.
7. Direct calibration and Training behavior use separate schemas/collections.
8. Training conflict records a comparison and never rewrites direct evidence.
9. Direct edits/retractions append without deleting history; ordinary editing is linear and synced offline contradictions preserve every independent head.
10. One repository owns durable IndexedDB records, legacy migration reads, and backend-independent export/import; UI has no storage access.
11. Invalid, corrupt, incompatible, or colliding data cannot partially overwrite valid data.
12. Existing Playbook, Matrix, Training, Equity, Analysis, settings, and StrategyProvider behavior remains unchanged.
13. Personal Strategy has no startup cost until a future feature explicitly activates it.
