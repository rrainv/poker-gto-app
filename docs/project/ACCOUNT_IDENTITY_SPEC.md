# Riverline account identity and ownership foundation

Status: `ACCOUNT-001` foundation, extended by `ACCOUNT-002A/002AR`

Date: August 17, 2026

## Purpose and boundary

Riverline is local-first. `ACCOUNT-001` added a stable application identity and explicit ownership mapping. `ACCOUNT-002A/AR` implemented a non-persistent Guest product state while retaining the original local identity only as a non-destructive migration/claim record. The September Alpha human disposition now accepts a different long-term model: Guest is a durable anonymous device-local profile, distinct from every authenticated owner. `IDENTITY-LIFECYCLE-001` owns that migration and the cross-surface owner/generation/disposal contract; this documentation change does not claim the runtime already implements it.

`AUTHENTICATION_SPEC.md` is authoritative for the current provider adapter, mapping, linking, switching, sign-out, and session behavior. Statements below describing ACCOUNT-001's former lack of auth are foundation history and are superseded where that specification says otherwise.

The foundation dependency path is:

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
| Training Memory decision/session evidence | `training-memory/v1` IndexedDB | authenticated owner scope | The accepted bridge resolves ownership through authentication plus owner generation rather than raw registry storage routing. Guest cannot access a retained authenticated identity; sign-out invalidates stale reads/writes while leaving prior-account bytes intact. |
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

`authenticated_future` began as a structural vocabulary value. ACCOUNT-002A uses that existing v1 value for authenticated Riverline identities rather than introducing an unapproved RiverlineIdentity schema migration. Provider metadata, credentials, tokens, email, and usernames remain outside RiverlineIdentity.

## Registry identity and active identity

On first account-domain initialization, Riverline creates exactly one persistent legacy local identity and selects it as the registry's internal `activeIdentityId`. This is a storage/migration implementation detail, not Guest session state or permission to query its domains. Reload restores the same record. Initialization and legacy binding creation commit in one IndexedDB transaction; an interrupted transaction has no completed registry and retries safely.

The central service exposes:

- `initialize()` / `ensureLocalIdentity()`;
- `getActiveIdentity()` / `getActiveIdentityId()`;
- `getProfileSummary()` for authenticated consumers after the auth gate;
- `setDisplayName(value)`;
- `getDomainOwnership(domain)`;
- a non-UI `activateIdentity(identityId)` seam;
- `activateLocalIdentity()` for the explicit authenticated legacy-claim decision only.

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

## Multiple identities and Guest sign-out

The registry and storage naming permit a legacy Local identity, Account A, and Account B on one device without sharing a domain storage target. ACCOUNT-002AR exposes account state from the global header and Account/Profile modal; Settings is secondary. The legacy identity is shown only during an explicit authenticated claim decision.

The accepted target sign-out behavior is fixed at the data-model level and owned by `IDENTITY-LIFECYCLE-001`:

1. keep authenticated-identity data locally stored under its binding;
2. activate a durable anonymous device-local Guest profile without exposing any authenticated identity;
3. stop querying the authenticated identity's namespaces;
4. do not delete, merge, or re-own its data;
5. re-authentication may activate that identity again; a different account requires fresh provider validation;
6. purge is a separate explicit destructive user action, not sign-out.

The Guest profile and every authenticated identity require distinct storage/owner targets. No sign-out, sign-in, or account switch may silently point one identity at another's data. Claiming Guest/local data requires an explicit, atomic ownership-binding transfer/link contract with failure recovery and user-visible consent.

## Local to authenticated linkage

ACCOUNT-002 should keep the Riverline identity ID independent from any provider subject ID. A provider mapping belongs to the authentication layer. Credentials and refresh/access tokens never belong in `RiverlineIdentity`, ownership refs, SavedStudyObjects, StrategyProfiles, exports, renderer logs, or debug views.

The implemented claim flow is:

```text
existing local Riverline identity + owned-domain bindings
                         |
                 explicit user consent
                         |
          authenticated Riverline identity/provider map
                         |
       atomic link or binding transfer with rollback
```

The account IndexedDB v2 transaction retains the existing Riverline identity ID, transitions it to the authenticated v1 kind, rebinds its unchanged domain owner/storage targets, creates a fresh legacy Local identity, and adds ProviderIdentityMapping v1 atomically. The new local record remains hidden from Guest but preserves a future explicit claim path. Offline bytes remain stored, and a failed local link transaction leaves them untouched.

The remote `AccountProfile v1` binds the Auth UUID to the stable Riverline identity ID. It is account metadata only: normalized username, Unicode display name, timestamps, and the identity binding. It does not replace `RiverlineIdentity`, own poker-domain records, or create cloud study-data sync.

## Implemented study-sync seams and domain conflicts

ACCOUNT-001 itself performs no sync and deliberately defines no universal merge rule. `ACCOUNT-002B-A` consumes the stable identity/binding seam for explicit Saved Hand/Spot sync. `ACCOUNT-002B-B` reuses the same versioned coordinator, sidecar, outbox, pull cursor, retry, and generation-cancellation transport for separately consented Personal Strategy / Range Calibration sync. Each domain keeps its remote schema and reconciliation outside the account registry.

- Saved Study uses stable object IDs, positive revisions, `updatedAt`, expected-revision writes, and archive tombstones. Notes/tags and lifecycle conflicts need a Saved-domain policy rather than blind last-write-wins.
- Personal Strategy preserves immutable direct revision chains, retractions, Training evidence, and contradictions. The implemented adapter retains divergent valid heads and makes inference abstain when direct evidence conflicts; it never discards a direct answer silently.
- Calibration sessions/cursors use stable session IDs, union compatible evidence references, and recompute progress from unique answered hand classes. A generic timestamp overwrite remains forbidden.
- Account display-name conflicts are cosmetic and may use an explicit profile choice or a later bounded last-write policy.
- Saved deletions use the implemented archive tombstone semantics; no sync adapter may infer deletion from absence.

Stable IDs, timestamps, revisions, domain-specific tombstones/history, and the ownership binding form the sync seam. `ACCOUNT-002B-A` provides the versioned cloud transport, queue, retry engine, and Saved conflict UI documented in `SAVED_OBJECT_SYNC_SPEC.md`. `ACCOUNT-002B-B` adds the Personal Strategy relational schema, profile-bundle and immutable-evidence adapters, calibration-session merge, separate consent, and metadata-only profile/mode conflicts documented in `PERSONAL_STRATEGY_SYNC_SPEC.md`.

## Privacy and security boundary

- all Account, Saved, Personal Strategy, preference, and poker-history data remains local by default;
- account-identity initialization itself performs no fetch, WebSocket, beacon, telemetry, or upload; the separate optional authentication service may contact Supabase to restore and validate a provider session;
- no sign-in is required for core analysis, Training, Equity, Guide, or device settings; the accepted target may retain device-local Guest history only under the anonymous Guest owner, never an authenticated owner;
- persistent Saved/Review/Mistakes/Personal Strategy/Range Calibration require a validated persistent account identity;
- the header and Account/Profile surface distinguish `Guest Mode` from `Signed in`, while separately stating the Saved and Personal Strategy / Range Calibration sync choices and their current status;
- a functional Supabase email/password surface is owned by the separate authentication boundary;
- local browser storage is not encryption, and anyone with operating-system access to the application profile may inspect it;
- future tokens belong in a privileged authentication layer and must not be exposed to the Electron renderer unnecessarily;
- no opponent/player/person object is part of Riverline account identity.

## Visible account surfaces

ACCOUNT-002AR makes the top-right header control the primary discovery surface. Guest sees Guest/Sign in/Create account. Signed-in users see an initial/display name; the menu and modal expose `@username`, status, Account/Profile, use-another-account, and sign-out. The Account/Profile modal owns email/password sign-in, required username/display-name signup/recovery, display-name editing, and explicit legacy claim/start-separate consent. Settings retains only a truthful secondary summary and launcher.

Authentication failures are presented in a persistent visible status region and become an assertive alert when actionable. Provider errors map to stable privacy-safe notice codes for invalid credentials, signup conflict, expired session, and provider unavailability; raw provider messages and account-existence details are not rendered. Signup password confirmation is validated locally, marks the confirmation input invalid, announces the mismatch, and does not call the provider until the values match.

The form uses semantic labels, a live status region, keyboard submission, visible existing focus styles, `dir=auto` for user-authored names, and `textContent`/input values rather than HTML injection. Stable copy is localized in EN/RU/HE; account status layout uses logical CSS and normal RTL inheritance.

## Performance and activation

Account startup does one bounded registry read. First launch writes one metadata record, one identity, and two ownership bindings atomically. Completed migration does not scan or rewrite either user library on later launches. Domain databases remain lazy except where HOME-001 already requests bounded current-user summaries. No strategy, Equity, Training, Matrix, solver, or poker-domain computation is introduced.

## Unsupported current features

The current account platform still does not implement:

- Training Memory sync, Saved Range, or cross-device preference sync. Only explicit Saved Hand/Spot and Personal Strategy / Range Calibration study sync are implemented;
- the durable anonymous Guest migration and one cross-surface owner/generation/disposal lifecycle; these are owned by `IDENTITY-LIFECYCLE-001`;
- remote deletion, local forgetting, account recovery, OAuth, magic links, passkeys, or provider-to-provider linking;
- sharing, friends, study groups, public links, or social identity;
- telemetry;
- encryption-at-rest;
- username changes and secure username/password login (owned by immediate follow-up `ACCOUNT-002A2`);
- opponent/person profiles inside the account model.
