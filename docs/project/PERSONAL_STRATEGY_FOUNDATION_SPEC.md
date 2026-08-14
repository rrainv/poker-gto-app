# Personal Strategy Foundation Specification

Status: implementation authority for `RANGE-CAL-000`

Schema generation: v1

## 1. Purpose and authority

Personal Strategy is Riverline's local-first domain for recording how a person intends to play in a relatable poker environment. It is evidence storage, not a strategy engine. This specification and the contracts under `app/src/personal-strategy/` govern the subsystem until an approved, versioned migration supersedes them.

The v1 dependency boundary is:

```text
future Personal Strategy UI or Training opt-in
                    |
                    v
          Personal Strategy service/repository
                    |
                    v
 versioned profiles, modes, contexts, and evidence
```

There is no Personal Strategy import in current application startup, Playbook, Matrix, Training, Analysis, Equity, or StrategyProvider. The subsystem is dormant until a later ticket owns activation.

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
| Personal Strategy store | `personal-strategy-store/v1` | Durable aggregate and repository revision |
| Portable export | `personal-strategy-export/v1` | Validated local transfer representation |

There is no v1 `InferredRange`, confidence score, `SavedSpot`, derived range cache, solver reference, or separate profile-range snapshot. Those objects acquire authority only when a future ticket implements their behavior and validation.

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
provenance { type = direct_calibration, calibrationSessionId | null }
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

Future provenance types such as imported, coach review, solver reference, or inferred are not accepted by v1 validators. Each needs an approved schema change with authority and trust semantics.

## 9. Revision, conflict, and deletion policy

Direct evidence is an immutable, linear chain per:

```text
profile + mode + canonical context key + hand class
```

Policy:

- create: the first record has no superseded ID;
- edit/change of mind: append a new active record that supersedes the current leaf;
- retract/delete answer: append a retracted record that supersedes the current leaf;
- history: retain every prior record;
- branch prevention: a record may have at most one child and a key may have exactly one root/leaf;
- current answer: the unique leaf when it is active; no current answer when the leaf is retracted;
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

V1 uses one injected Web Storage-compatible adapter, normally browser `localStorage`, under:

```text
riverline.personalStrategy.v1
```

This choice fits the first RFI-only scope and the current browser-first application:

- the product already relies on local browser persistence for small preferences;
- profile/mode/RFI observation documents are JSON-serializable and modest at the foundation stage;
- one `setItem` replaces a fully validated document atomically from the application's perspective;
- no asynchronous database, Electron IPC, server, account, or startup service is required;
- the injected adapter keeps tests deterministic and permits a later storage technology migration behind one repository boundary.

IndexedDB is not justified until measured record volume, serialization time, or quota pressure makes whole-document localStorage unsuitable. Postflop evidence, large histories, or derived caches could trigger that future migration; none are stored now.

### Repository authority

`createPersonalStrategyRepository` is the only persistence owner. Domain objects contain no storage calls. Future UI must call an application service/repository rather than reading or writing localStorage directly.

The store document contains:

```text
schemaVersion
revision
ownerRef
updatedAt
profiles[]
modes[]
rangeObservations[]
trainingObservations[]
calibrationSessions[]
```

Every mutation performs:

1. read and parse the current document;
2. migrate in memory if supported;
3. validate the complete graph;
4. apply one bounded change to a clone;
5. increment repository revision and validate again;
6. serialize before touching durable storage;
7. issue one namespaced `setItem`.

If serialization, quota, or write fails, the prior durable record remains authoritative. The repository does not update unrelated settings keys.

Malformed JSON, invalid graphs, owner mismatch, and unsupported schema versions fail closed with typed storage errors. Raw stored bytes are left untouched for diagnosis/recovery; the repository never replaces them with an empty store silently.

## 12. Export and import

`personal-strategy-export/v1` is a portable JSON envelope containing export time, owner reference, selected profiles, their modes, direct evidence, Training evidence, and sessions. Export can select profile IDs and includes full direct history for those profiles.

Import behavior is deliberately conservative:

- parse and validate the complete envelope before mutation;
- require the exact supported export schema;
- require the same local owner in v1;
- reject any object-ID collision;
- reject a second root for an existing direct-calibration key;
- merge all collections in memory, validate the combined graph, then perform one store write;
- leave current data unchanged on any error.

V1 does not silently regenerate IDs or adopt another owner. A future explicit "import as copy" flow may remap all IDs and references under a target owner, but that is a separate contract and UX decision.

## 13. Versioning and migrations

Every durable object and envelope has an exact schema identifier. The repository currently has one ordered synthetic migration:

```text
personal-strategy-store/v0 -> personal-strategy-store/v1
```

The v0 fixture exercises envelope changes: `ownerId` becomes structured `ownerRef`, `observations` becomes `rangeObservations`, `sessions` becomes `calibrationSessions`, and an empty `trainingObservations` collection is introduced. Migration occurs in memory on read; durable bytes are rewritten only by the next successful user mutation or an explicit future migration command.

Migration rules:

- apply migrations in declared order, one version at a time;
- validate after the final step before exposing data;
- never partially write a migration;
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

The foundation modules are side-effect free at import except for constant construction. The repository performs no read until a caller invokes it and no write until an explicit mutation/import. Normal Riverline startup performs no Personal Strategy initialization, range recomputation, inference, or storage scan.

Future incomplete features remain isolated by:

- importing the service only from the future feature's activation boundary;
- keeping Labs data under a distinct experimental schema/key unless it passes validated import into the canonical repository;
- never making an experiment a StrategyProvider, Training, Matrix, PokerState, or Equity authority;
- storing source observations rather than unbounded derived caches;
- permitting removal of a failed Lab surface without changing the canonical Personal Strategy store.

PERF-001 remains unchanged: this foundation does not resolve strategy, render Matrix cells, alter invalidation, or add a hidden surface. Future RANGE-CAL tickets must define measured profile-load and prompt-to-next budgets before activation.

## 17. Integration gates for future tickets

A later ticket must not cross an integration gate without owning it explicitly:

- Range Calibration UI: collect and render these contracts; do not compute poker math;
- Training opt-in: create `TrainingObservation` only after explicit profile/mode selection and user consent;
- StrategyProvider: requires a validated personal-strategy provider/source contract and truthful coverage/provenance;
- Matrix: personal rendering must consume a validated provider result, not read repository internals in UI code;
- inference/confidence: requires an `InferredRange`/metadata schema, evidence policy, validation, and measured performance;
- adaptive questions: requires a versioned selection/cursor policy and deterministic resume behavior;
- accounts/sync: requires owner migration, conflict resolution, privacy/security, and offline behavior;
- import-as-copy/sharing: requires complete ID/reference remapping and explicit ownership transfer.

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
9. Direct edits/retractions append to one linear history.
10. One repository owns all persistence and touches one namespaced key.
11. Invalid, corrupt, incompatible, or colliding data cannot partially overwrite valid data.
12. Existing Playbook, Matrix, Training, Equity, Analysis, settings, and StrategyProvider behavior remains unchanged.
13. Personal Strategy has no startup cost until a future feature explicitly activates it.
