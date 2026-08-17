# Riverline account identity and ownership foundation

Status: `ACCOUNT-001` implementation authority

Date: August 17, 2026

## Purpose and boundary

Riverline is local-first. `ACCOUNT-001` adds a stable application identity, explicit ownership mapping, active-identity scoping, and a truthful local profile surface. It does not add authentication, a cloud backend, sync, telemetry, sharing, passwords, OAuth/provider SDKs, or a network requirement.

The current dependency path is:

```text
Settings / Home / owned-domain application consumers
                         |
                         v
           Account identity application service
                         |
                         v
        Riverline identity + ownership registry v1
                         |
                         v
               local IndexedDB only
                         |
                         v
    Saved Study / Personal Strategy compatibility bindings
```

`app/src/account-identity/` owns the identity, ownership reference, domain-binding, registry, and physical persistence contracts. `app/src/application/account-identity-service.mjs` is the application authority. Other domains do not read account storage keys directly.

## Persisted-domain inventory and scope decisions

| Persisted state | Current authority | Scope in ACCOUNT-001 | Reason / behavior |
|---|---|---|---|
| Riverline identity, display name, active identity, ownership bindings | `account-identity` IndexedDB | user/identity | Central account authority; initialized locally at app startup |
| Saved Hand / Spot objects, annotations, tags, review/mistake state, replay source, archive tombstones | `saved-study-objects` IndexedDB | user/identity | Queried through the active identity's binding; object IDs/revisions/payloads are unchanged |
| Personal Strategy profiles, modes, direct revisions, Training evidence, contradictions, sessions | `personal-strategy` IndexedDB | user/identity | Queried through the active identity's binding; profile/evidence/session IDs and relationships are unchanged |
| Range Calibration selected profile/mode/context | Web Storage preference behind the Personal Strategy application boundary | user/identity | The legacy local identity retains its old key; future identity namespaces use their ownership storage scope |
| Tutorial completion/skip history | tutorial preference authority | device | Preserves current first-use behavior; ACCOUNT-002 may propose an explicit cross-device preference migration |
| language | i18n preference authority | device | Presentation preference remains stable when identities change |
| theme, four-color deck, card/rank style, audio, sidebar collapse | existing Settings/presentation authorities | device | Hardware/presentation choice; no account migration in this ticket |
| Saved source-reference keys | Saved source controller | device/application navigation | Bounded reopen hint, not durable owned study data; owner-scoped repository lookup prevents cross-identity disclosure |
| Training history | none | unsupported | No persistent Training-history domain exists yet |
| window geometry, filesystem paths, cache/performance state | host/runtime where applicable | device | Never account-owned |

This classification deliberately avoids moving every preference merely because identity now exists. A later cross-device preference change requires its own versioned migration and explicit product decision.

## RiverlineIdentity v1

Schema: `riverline-identity/v1`

```text
RiverlineIdentity
  schemaVersion
  identityId                 stable opaque local Riverline ID
  kind                       local | authenticated_future
  displayName                cosmetic Unicode text, 1–80 code points
  localDeviceIdentityId      stable registry/device boundary
  createdAt / updatedAt      normalized ISO timestamps
```

Identity IDs are locally generated opaque random IDs. They are never derived from display name, locale, email, profile name, machine path, or poker data. Display-name edits trim surrounding whitespace, preserve arbitrary Unicode, and cannot change the ID or ownership.

`authenticated_future` is a structural vocabulary value only. ACCOUNT-001 creates only `local` identities and has no provider metadata, credential, token, email, username, or authentication behavior.

## Local identity and active identity

On first account-domain initialization, Riverline creates exactly one persistent local identity and selects it as `activeIdentityId`. Reload restores the same record. Initialization and legacy binding creation commit in one IndexedDB transaction; an interrupted transaction has no completed registry and retries safely.

The central service exposes:

- `initialize()` / `ensureLocalIdentity()`;
- `getActiveIdentity()` / `getActiveIdentityId()`;
- `getProfileSummary()` for Settings and future richer Home;
- `setDisplayName(value)`;
- `getDomainOwnership(domain)`;
- a non-UI `activateIdentity(identityId)` seam;
- `activateLocalIdentity()` as the future sign-out return seam.

Changing `activeIdentityId` changes which ownership binding and physical storage namespace application queries resolve. It never rewrites a Saved object or Personal Strategy profile merely to switch views.

## Reusable ownership reference

Schema: `riverline-ownership-ref/v1`

```text
RiverlineOwnershipRef
  schemaVersion
  ownerType                   local_identity | account_identity
  ownerId                     RiverlineIdentity.identityId
```

This is the account-platform ownership vocabulary. It contains a stable reference, not an embedded Account object and not an external-provider user ID.

Existing `SavedStudyObject v1` and `StrategyProfile v1` already have versioned local owner references. ACCOUNT-001 does not destructively rewrite those released domain contracts. Instead it uses a compatibility binding.

## Domain ownership binding

Schema: `riverline-domain-ownership-binding/v1`

Each identity has one binding for each current owned domain:

```text
RiverlineDomainOwnershipBinding
  bindingId
  identityId
  domain                       saved_study_objects | personal_strategy
  ownershipRef                 RiverlineOwnershipRef v1
  domainOwnerId                existing domain-v1 local owner ID
  storageScope                 legacy_default | stable namespaced scope
  provenance                   legacy_adopted | identity_initialized
  createdAt / updatedAt
```

For the first local identity, `storageScope = legacy_default` preserves the existing database names. If a legacy domain owner ID exists, the binding adopts it. A fresh domain uses the Riverline identity ID as its v1 domain-owner ID. Future additional identities receive separate stable database namespaces, because the current Saved and Personal Strategy physical metadata contracts each describe one owner per database.

The registry rejects two identities sharing the same domain storage target or domain-owner target. Data cannot become visible to another identity through an accidental duplicate binding.

## Legacy migration

Account migration version: `1`, recorded as `riverline-account-migration/v1` in `riverline-account-metadata/v1`.

The migration reads the two established legacy owner pointers:

- `riverline.savedStudyObjects.owner.v1`;
- `riverline.personalStrategy.owner.v1`.

It creates bindings to those IDs in one account-registry transaction. It does not scan or rewrite SavedStudyObjects, Personal Strategy profiles, modes, immutable direct-revision history, Training evidence, contradictions, or calibration sessions. This is the smallest non-destructive adoption because both existing repositories already validate owner metadata and every owned record is reachable through that stable owner.

Consequences:

- all object/profile/evidence/session IDs remain stable;
- Saved annotations, revisions, archive tombstones, and canonical replay sources are byte-for-byte domain values;
- Personal Strategy direct evidence, tied mixes, contradictions, Training comparisons, and resume cursors remain intact;
- repeated initialization reads the completed version marker and performs no migration writes or library scan;
- malformed/incompatible domain data continues to fail closed in its own repository and is never reset by Account initialization.

## Query scoping and Home

Saved Study application activation resolves the current account binding for every operation and caches one repository per ownership/storage scope. Recent, Review, Mistakes, lookup, mutation, export, and import therefore operate only on the active identity's physical namespace and owner indexes.

Personal Strategy Home queries resolve the active binding and its identity-scoped Range Calibration preference before loading the bounded selected-scope summary. Range Calibration itself opens the active identity's repository and preference namespace on workspace mount. A future live identity switch while Range Calibration is already mounted must explicitly remount that workspace; ACCOUNT-001 provides no account switcher UI.

`HomeViewModel v1` receives an additive truthful account profile seam (`displayName`, identity kind/status, local-storage status, and `syncEnabled: false`). HOME-001 does not render a richer identity dashboard and no statistic is invented.

## Import and export

Exports remain backend-independent domain envelopes:

- Saved Study export keeps its domain owner provenance, stable object IDs, timestamps, revisions, annotations, payloads, and tombstones.
- Personal Strategy export keeps its domain owner provenance, profiles, modes, complete direct history, Training evidence, contradictions, and sessions.
- neither export contains IndexedDB names, account-registry records, provider credentials, tokens, or secrets.

Imports default to `adopt_active`:

- the complete source envelope is parsed and validated before a write;
- the envelope and top-level owned records are re-owned to the active identity's domain binding;
- stable content IDs and every non-ownership relationship remain unchanged;
- collision and graph checks still fail atomically;
- `require_match` remains available for strict same-owner restore;
- Saved Study retains `adopt_local` as a compatibility alias.

An import can never activate a foreign identity or impersonate a future authenticated account. Imported bytes become data explicitly owned by the currently active Riverline identity.

## Multiple identities and future sign-out

The registry and storage naming permit a local identity, future Account A, and future Account B on one device without sharing a domain storage target. ACCOUNT-001 exposes only the current local profile in UI.

Future sign-out behavior is fixed at the data-model level:

1. keep authenticated-identity data locally stored under its binding;
2. activate the persistent local identity (or create one through a separately approved migration if missing);
3. stop querying the authenticated identity's namespaces;
4. do not delete, merge, or re-own its data;
5. re-authentication may activate that identity again;
6. purge is a separate explicit destructive user action, not sign-out.

ACCOUNT-002 must not create a second identity that points silently at the local identity's storage. Claiming local data requires an explicit, atomic ownership-binding transfer/link contract with failure recovery and user-visible consent.

## Local to authenticated linkage

ACCOUNT-002 should keep the Riverline identity ID independent from any provider subject ID. A provider mapping belongs to the authentication layer. Credentials and refresh/access tokens never belong in `RiverlineIdentity`, ownership refs, SavedStudyObjects, StrategyProfiles, exports, renderer logs, or debug views.

The safe future claim flow is:

```text
existing local Riverline identity + owned-domain bindings
                         |
                 explicit user consent
                         |
          authenticated Riverline identity/provider map
                         |
       atomic link or binding transfer with rollback
```

Offline local bytes remain available, and a failed sign-in/link operation leaves the local identity and its data authoritative.

## Future conflict and sync seam

ACCOUNT-001 performs no sync and deliberately defines no universal merge rule.

- Saved Study uses stable object IDs, positive revisions, `updatedAt`, expected-revision writes, and archive tombstones. Notes/tags and lifecycle conflicts need a Saved-domain policy rather than blind last-write-wins.
- Personal Strategy preserves immutable direct revision chains, retractions, Training evidence, and contradictions. Sync must retain both valid histories or surface a conflict; it must never discard a direct answer or contradictory observation silently.
- Calibration sessions/cursors require session-aware reconciliation; a generic timestamp overwrite is unsafe.
- Account display-name conflicts are cosmetic and may use an explicit profile choice or a later bounded last-write policy.
- Future deletions require domain tombstone semantics. No sync adapter may infer deletion from absence.

Stable IDs, timestamps, revisions, domain-specific tombstones/history, and the ownership binding form the sync seam. A cloud transport, queue, remote schema, retry engine, and conflict UI are ACCOUNT-002+ work.

## Privacy and security boundary

- all Account, Saved, Personal Strategy, preference, and poker-history data remains local by default;
- account initialization performs no fetch, WebSocket, beacon, telemetry, upload, or background network work;
- no sign-in is required for any Riverline feature;
- the Settings surface says `Local only`, `Stored on this device`, and `Account sync not enabled`;
- no functional or fake Sign in button is shown;
- local browser storage is not encryption, and anyone with operating-system access to the application profile may inspect it;
- future tokens belong in a privileged authentication layer and must not be exposed to the Electron renderer unnecessarily;
- no opponent/player/person object is part of Riverline account identity.

## Visible Settings surface

Settings contains one bounded Account & Profile group with:

- current local display name;
- truthful `Local profile` / `Local only` status;
- an editable Unicode display-name field with a length bound;
- `Stored on this device` and sync-unavailable copy;
- no Home redesign and no inactive action disguised as sign-in.

The form uses semantic labels, a live status region, keyboard submission, visible existing focus styles, `dir=auto` for user-authored names, and `textContent`/input values rather than HTML injection. Stable copy is localized in EN/RU/HE; account status layout uses logical CSS and normal RTL inheritance.

## Performance and activation

Account startup does one bounded registry read. First launch writes one metadata record, one identity, and two ownership bindings atomically. Completed migration does not scan or rewrite either user library on later launches. Domain databases remain lazy except where HOME-001 already requests bounded current-user summaries. No strategy, Equity, Training, Matrix, solver, or poker-domain computation is introduced.

## Unsupported current features

ACCOUNT-001 does not implement:

- real authentication or provider selection;
- email, passwords, OAuth, passkeys, tokens, or credential storage;
- cloud backup/sync or cross-device state;
- account switching UI, sign-out UI, remote deletion, or account recovery;
- sharing, friends, study groups, public links, or social identity;
- telemetry;
- encryption-at-rest;
- richer Home identity presentation;
- opponent/person profiles inside the account model.

