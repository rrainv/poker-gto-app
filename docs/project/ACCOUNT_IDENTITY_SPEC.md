# Riverline account identity and ownership foundation

Status: `ACCOUNT-001` foundation, extended by `ACCOUNT-002A/002AR` and `IDENTITY-LIFECYCLE-001A/001B/001C`

Date: September 4, 2026

## Purpose and boundary

Riverline is local-first. `ACCOUNT-001` added a stable application identity and explicit ownership mapping. `ACCOUNT-002A/AR` added authentication and provider mapping. `IDENTITY-LIFECYCLE-001A` now establishes the durable anonymous Device Guest, fail-closed v2 registry migration, and the application-owned identity generation/scope authority. Slice B enables local durable Guest Saved, Personal Strategy, and Training Memory. Slice C implements first-sign-in Move / Keep Separate and durable transition recovery; human browser/provider acceptance remains pending.

`AUTHENTICATION_SPEC.md` is authoritative for the current provider adapter, mapping, linking, switching, sign-out, and session behavior. Statements below describing ACCOUNT-001's former lack of auth are foundation history and are superseded where that specification says otherwise.

The foundation dependency path is:

```text
Settings / Home / owned-domain application consumers
                         |
                         v
           Account identity application service
                         |
                         v
        Riverline identity + ownership registry v2
                         |
                         v
          local account IndexedDB v3 only
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
| Training Memory decision/session evidence | `training-memory/v1` IndexedDB | current lifecycle owner scope | The bridge resolves the stable Training Memory binding under current auth/identity generation. Guest cannot access a retained authenticated identity; sign-out invalidates stale reads/writes while leaving prior-account bytes intact. |
| window geometry, filesystem paths, cache/performance state | host/runtime where applicable | device | Never account-owned |

This classification deliberately avoids moving every preference merely because identity now exists. A later cross-device preference change requires its own versioned migration and explicit product decision.

## RiverlineIdentity v2

Schema: `riverline-identity/v2`

```text
RiverlineIdentity
  schemaVersion
  identityId                 stable opaque local Riverline ID
  kind                       device_guest | authenticated_account
  displayName                cosmetic Unicode text, 1–80 code points
  localDeviceIdentityId      stable registry/device boundary
  createdAt / updatedAt      normalized ISO timestamps
```

Identity IDs are locally generated opaque random IDs. They are never derived from display name, locale, email, profile name, machine path, or poker data. Display-name edits trim surrounding whitespace, preserve arbitrary Unicode, and cannot change the ID or ownership.

Exactly one identity in a healthy local registry has kind `device_guest`; it is the stable anonymous profile for that browser/Electron profile and has no provider mapping. `authenticated_account` identities require provider-authenticated activation. Provider metadata, credentials, tokens, email, and usernames remain outside RiverlineIdentity, so Device Guest never acquires account-profile semantics.

## Registry identity and active identity

On a fresh account-domain initialization, Riverline creates exactly one Device Guest and selects it as the registry's internal `activeIdentityId`. Reload restores the same identity. `activeIdentityId` is durable bookkeeping, not authorization: application startup establishes Device Guest first, and an authenticated account becomes accessible only after the current provider identity, remote profile binding when configured, local provider mapping, identity kind, and all local domain bindings validate.

The central service exposes:

- `initialize()` / `ensureDeviceGuestIdentity()`;
- `getActiveIdentity()` / `getActiveIdentityId()`;
- `getLifecycleState()` / `captureLifecycleScope(domain)`;
- `getProfileSummary()` for authenticated consumers after the auth gate;
- `setDisplayName(value)`;
- `getDomainOwnership(domain)`;
- provider-validated account activation and explicit `activateDeviceGuest()`.

Each live scope contains the current `identityId`, `identityKind`, monotonic `lifecycleGeneration`, optional domain ownership binding, abort signal, and validity/adoption checks. A transition aborts the prior scope before a new owner can publish data. Changing `activeIdentityId` changes which binding and physical storage namespace a current application scope may resolve; it never independently authorizes access and never rewrites a Saved object or Personal Strategy profile merely to switch views.

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

Schema: `riverline-domain-ownership-binding/v1` for Saved/Personal Strategy; additive `riverline-domain-ownership-binding/v2` for Training Memory.

Each identity has one binding for each current owned domain:

```text
RiverlineDomainOwnershipBinding
  bindingId
  identityId
  domain                       saved_study_objects | personal_strategy | training_memory
  ownershipRef                 RiverlineOwnershipRef v1
  domainOwnerId                existing domain-v1 local owner ID
  domainOwnerRef               Training Memory v2 only: stable persisted owner reference
  storageScope                 legacy_default | stable namespaced scope
  provenance                   legacy_adopted | identity_initialized
  createdAt / updatedAt
```

For the adopted Device Guest, `storageScope = legacy_default` preserves the existing database names. If a legacy domain owner ID exists, the binding adopts it. A fresh domain uses the Riverline identity ID as its v1 domain-owner ID. Additional authenticated identities receive separate stable database namespaces, because the current Saved and Personal Strategy physical metadata contracts each describe one owner per database.

The registry rejects two identities sharing the same domain storage target or domain-owner target. Data cannot become visible to another identity through an accidental duplicate binding.

## Legacy migration

Account migration version: `2`, recorded as `riverline-account-migration/v2` in `riverline-account-metadata/v2`. The physical account database is `riverline-account-indexeddb/v3`; its v2â†’v3 IndexedDB upgrade adds only the reserved `lifecycleTransitions` store and does not rewrite records during `versionchange`.

The migration reads the two established legacy owner pointers:

- `riverline.savedStudyObjects.owner.v1`;
- `riverline.personalStrategy.owner.v1`.

For a pre-registry install, it creates one Device Guest with bindings to those IDs in one account-registry transaction. For an existing v1 registry, startup first validates the complete metadata/identity/binding/provider-mapping graph, requires exactly one valid unbound legacy `local` identity, and only then commits identity-v1â†’v2 records plus metadata v2. It preserves the adopted identity ID and does not rewrite domain-binding records, storage scopes, SavedStudyObjects, Personal Strategy records, or either domain database.

If candidates are multiple, missing, provider-bound, or conflict through identity, mapping, owner, or storage targets, migration returns `recovery_required`. It writes no registry record, preserves all stored bytes, exposes no retained active account, and leaves recovery/export tooling to a later ticket rather than guessing ownership.

Consequences:

- all object/profile/evidence/session IDs remain stable;
- Saved annotations, revisions, archive tombstones, and canonical replay sources are byte-for-byte domain values;
- Personal Strategy direct evidence, tied mixes, contradictions, Training comparisons, and resume cursors remain intact;
- repeated initialization reads the completed version marker and performs no migration writes or library scan;
- malformed/incompatible domain data continues to fail closed in its own repository and is never reset by Account initialization;
- metadata v2 records exactly one `deviceGuestIdentityId`, `lifecycleGeneration`, and nullable `pendingTransitionId`; Slice C uses the reserved transition store for versioned first-sign-in reservations and recovery.

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

The registry and storage naming permit one Device Guest, Account A, and Account B on one device without sharing a domain storage target. ACCOUNT-002AR exposes account state from the global header and Account/Profile modal; Settings is secondary.

The implemented Slice A sign-out foundation is:

1. keep authenticated-identity data locally stored under its binding;
2. activate a durable anonymous device-local Guest profile without exposing any authenticated identity;
3. stop querying the authenticated identity's namespaces;
4. do not delete, merge, or re-own its data;
5. re-authentication may activate that identity again; a different account requires fresh provider validation;
6. purge is a separate explicit destructive user action, not sign-out.

The Guest profile and every authenticated identity require distinct storage/owner targets. Sign-out invalidates the account scope and account-owned presentation before awaiting provider cleanup; provider failure cannot restore the account. Account switching requires Account A â†’ Device Guest â†’ authenticated Account B, and direct cached A â†’ B activation is rejected. First sign-in for a never-bound account follows the journaled Move / Keep Separate contract below.

## Local to authenticated linkage

ACCOUNT-002 should keep the Riverline identity ID independent from any provider subject ID. A provider mapping belongs to the authentication layer. Credentials and refresh/access tokens never belong in `RiverlineIdentity`, ownership refs, SavedStudyObjects, StrategyProfiles, exports, renderer logs, or debug views.

First sign-in for a never-bound account uses bounded domain existence queries. Active or archived Saved objects, Personal Strategy profiles/evidence/sessions, and Training Memory sessions/decisions (including abandoned/unanswered work) count. Empty metadata, bindings, preferences, tutorial state and navigation do not. Missing/incompatible ownership or failed queries never imply empty Guest.

A meaningful Guest requires explicit **Move local work to account**, **Keep separate**, or **Cancel sign-in**. An empty Guest automatically uses Keep Separate without a dialog. Already-bound accounts never inspect Guest for migration, and remote/local binding disagreement enters recovery without reconstructing an identity or matching email.

Move promotes the existing Guest identity. Its ID and all domain-native owners, storage scopes, Training Memory `domainOwnerRef`, and domain bytes remain unchanged. Only registry identity kind/current ownership references change. The same transaction adds the reserved fresh Guest and its unique bindings. Keep Separate adds a distinct reserved account and bindings while leaving the Guest identity, bindings and domain bytes unchanged. Cancel before a remote request commits no mapping and requests provider cleanup; local Guest remains authoritative even if cleanup fails.

### Lifecycle transition journal v1

`app/src/account-identity/lifecycle-transition.mjs` validates `riverline-identity-transition/v1` in the existing v4 account database's `lifecycleTransitions` store. No database version or domain schema changes are required. Each entry stores a stable transition ID, explicit choice, lifecycle generation, original Guest and bindings, reserved account and bindings, optional reserved replacement Guest and bindings, and the exact provider/project/subject mapping. It contains no credentials, email, tokens, or domain records.

At most one entry is active. Phases are `prepared`, `binding_remote` (a remote request may have committed), `remote_bound`, `locally_finalized`, `recovery_required`, and terminal `cancelled`. Metadata's `pendingTransitionId` references the active entry. Validation checks the unchanged original graph and the complete proposed final graph, including all three domains and unique namespaces/owner targets.

The commit boundaries are separate:

1. Prepare reservations and revoke the prior lifecycle generation; expose no new owner.
2. Revalidate the provider subject and bind the remote Account Profile idempotently to the reserved ID.
3. Confirm the binding and atomically finalize local identity/mapping/bindings/active owner/journal completion. The transaction accepts the transition abort signal through commit. Only then publish authenticated access.

This is not a globally atomic local/remote transaction. Once a remote request may have committed, a failure keeps the same reservations in recovery. Failed preparation or cancellation before a remote request returns safely to Guest. Cancellation after confirmed local completion returns to the designated Guest without pretending the account binding was rolled back.

Startup with an active journal exposes no domain owner. A matching validated provider subject and remote binding resume that same transition; mismatches/corruption preserve bytes and remain recovery-only. If provider cleanup or expiry removed the session, recovery allows sign-in to the recorded account, then resumes the same journal without a new choice or identity. Repeated recovery cannot allocate new reservations. Raw legacy claim/separate methods are no longer exposed by the browser identity bridge.

Move does not enable sync, create consent, or touch an account sidecar/outbox. Normal separately consented Saved/Personal Strategy sync may operate only after authenticated publication. Training Memory remains local-only.

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

Account startup performs bounded registry reads and, when a retained account was last active, a local Guest-activation commit before provider restoration. First launch writes one metadata record, one identity, and three ownership bindings atomically. Completed migration does not scan or rewrite either user library on later launches. Domain databases remain lazy except where HOME-001 already requests bounded current-user summaries. No strategy, Equity, Training, Matrix, solver, or poker-domain computation is introduced.

## Unsupported current features

The current account platform still does not implement:

- Training Memory sync, Saved Range, or cross-device preference sync. Only explicit Saved Hand/Spot and Personal Strategy / Range Calibration study sync are implemented;
- remote deletion, local forgetting, account recovery, OAuth, magic links, passkeys, or provider-to-provider linking;
- sharing, friends, study groups, public links, or social identity;
- telemetry;
- encryption-at-rest;
- username changes and secure username/password login (owned by immediate follow-up `ACCOUNT-002A2`);
- opponent/person profiles inside the account model.

## Device Guest learning durability - Slice B

Implementation awaiting human acceptance. Device Guest owns durable local Saved, Personal Strategy, and Training Memory across reload/restart and Account A -> Guest -> Account B -> Guest. Home reads only the current owner's bounded Saved and Personal Strategy projections; its unsupported Training/Analysis history seams remain unsupported. Home Game remains runtime-only for Guest.

The account database is version 4 (`riverline-account-indexeddb/v4`). The existing complete v3 registry is validated before a single account-registry transaction adds one Training Memory binding per identity and advances backend metadata. Missing or conflicting prior bindings fail closed without changing stored records. V2 legacy registry migration validates the original Saved/Personal Strategy graph before adding Training bindings. No domain data database or historical evidence record is rewritten.

Saved/Personal Strategy retain `riverline-domain-ownership-binding/v1`, domain-native owner IDs, and database namespaces. Training Memory uses `riverline-domain-ownership-binding/v2` with a stable `domainOwnerRef` in addition to current-authority `ownershipRef`. Existing accounts adopt `account_identity:<existing identity ID>`; Guest adopts `local_identity:<Guest identity ID>`. Rebinding an identity preserves `domainOwnerRef`, so a later approved identity-kind transition cannot strand history. Authorization uses the current lifecycle identity, generation, and binding, never the persisted compatibility owner type.

Saved controllers/source-reference preferences, repositories, Personal Strategy workspace/listeners/preferences/projection caches, and Home queries are generation-scoped. Revocation clears private UI synchronously, rejects queued operations, prevents stale reads/cache adoption, and aborts in-flight domain transactions. The shared operation guard does not own domain persistence.

Guest never activates sync ports, reads account preferences/queues, runs outbox work, adopts remote data/cursors/conflicts, or inherits account cloud status. Account sidecar bytes and consent remain stored for matching authenticated return. Scoped sidecar transactions abort on revocation. Slice C adds the journaled promotion contract above; Guest-to-existing-account merging remains excluded.
