# Saved Study Object cloud sync

Status: `ACCOUNT-002B-A` implemented with `GAME-RULES-001C` nested v2 payload compatibility; live Supabase migration and two-browser Firefox acceptance remain required

Date: August 17, 2026

## Scope and authority

This sync domain is explicit, reversible, and limited to canonical `SavedStudyObject v1` Hand and Spot records. Personal Strategy and Range Calibration use the separate domain reconciliation in `PERSONAL_STRATEGY_SYNC_SPEC.md`; Training history, Saved Ranges, device preferences, provider mappings, auth sessions, and credentials are not synced.

```text
Saved Study application/repository (local authority)
                  |
       post-commit mutation stream
                  v
SyncCoordinator v1 -> durable sidecar/outbox -> RemoteSyncAdapter -> Supabase/RLS
                  ^                                      |
                  +------ pull + Saved-domain reconcile -+
```

`app/src/sync/` owns the transport protocol, durable sidecar, outbox, coordinator, retry behavior, adapter contracts, and Saved-domain reconciliation. `app/src/saved-study-objects/` remains the canonical Saved domain. Supabase calls do not enter Saved renderers or UI code.

## Versions

| Concern | Version |
|---|---|
| transport/coordinator protocol | `riverline-sync/v1` |
| outbox operation | `riverline-sync-operation/v1` |
| Saved reconciliation policy | `saved-study-reconciliation/v1` |
| remote portable document | `remote-saved-study-object/v1` |
| local sync database | `riverline-sync-indexeddb/v1` |
| remote Saved object | existing `saved-study-object/v1` semantics |

Future domains may reuse the coordinator, repository, retry, and RemoteSyncAdapter boundary, but each domain must supply its own serializer, local application port, and conflict policy. `ACCOUNT-002B-B` must not apply the Saved reconciliation policy to Personal Strategy histories.

## Explicit opt-in

The preference is scoped by stable Riverline identity and sync domain. Authentication alone never enables sync and never uploads study data.

- `Enable sync` shows the number of local Saved Hands/Spots that will be considered for initial sync.
- `Not now` persists the disabled choice and performs no remote study operation.
- turning sync off stops future processing but retains local cache, outbox, sidecars, tombstones, and remote data;
- remote deletion and local forgetting are separate future destructive actions.

Eligibility requires all three conditions:

1. an active authenticated Riverline identity;
2. a currently validated provider session;
3. the identity-scoped Saved Study sync preference enabled.

Guest Mode, an unvalidated cached identity, or a disabled preference produces zero remote Saved queries or writes.

## Local-first guarantee

Save, note/tag edits, Review Later, Mistake, resolved-state changes, imports, and archive commit through the existing local repository first. Only after that transaction succeeds does the application publish a mutation to sync. A sidecar/outbox failure or remote failure cannot roll back or make the already committed local action appear lost.

Pulled objects enter the existing repository through the additive sync-authorized reconciliation operation. That operation validates the complete `SavedStudyObject v1`, rehomes the remote document to the current device's domain-owner binding, and writes through the existing object/index/metadata transaction. Home continues to read the normal local repository and receives the normal saved-data invalidation event.

## Remote representation

Migration `supabase/migrations/202608170002_saved_study_object_sync.sql` creates `public.saved_study_objects`.

The primary key is `(owner_auth_user_id, object_id)`. Important columns include:

- Auth UUID ownership and stable Riverline identity binding;
- stable Riverline Saved object ID;
- remote/object schema versions, kind, revision, and domain timestamps;
- nullable archive timestamp;
- the complete versioned remote JSON document;
- the last idempotent operation ID and server-side change timestamp.

The portable remote document intentionally omits the device-local `ownerRef`. It contains the stable ID, kind, revision, created/updated timestamps, annotations, source/provenance, complete Hand/Spot payload, and lifecycle tombstone. On pull, the canonical application boundary injects the active device's domain owner reference. Provider IDs, username, email, tokens, credentials, account registry data, and sync/outbox internals are absent.

## RLS and ownership

RLS is enabled. Select, insert, and update policies require both:

- `owner_auth_user_id = auth.uid()`; and
- `riverline_identity_id` equals the caller's bound `public.profiles.riverline_identity_id`.

Ownership never derives from username or device ID. Authenticated clients receive no delete grant or delete policy. Archive is an update to a versioned tombstone. Direct row updates are guarded against changing ownership/identity or failing to advance revision.

The versioned RPCs are:

- `sync_saved_study_object_v1`: atomic expected-revision compare plus idempotent operation acknowledgement;
- `pull_saved_study_objects_v1`: bounded ordered change pull by `(server_updated_at, object_id)` cursor.

Both RPCs execute with the authenticated caller's normal privileges/RLS. No service-role key is used by the renderer.

## Durable sidecar and outbox

The separate `riverline-sync` IndexedDB database contains:

- identity/domain preference;
- per-record base document, local/remote revision, status, and sanitized error code;
- one coalesced pending operation per identity/domain/object;
- explicit conflict records containing local, remote, and optional shared-base versions;
- the bounded pull cursor.

An outbox operation contains a stable operation ID, protocol/domain versions, identity ID, object ID, operation kind, expected remote revision, the credential-free remote document, timestamps, attempts, and next retry time. Repeated edits coalesce onto the same pending object operation and retain its original expected remote revision. Acknowledged operations are deleted atomically with the synced sidecar update, so reload does not upload them again.

## Push and retry

Local mutation flow is:

1. commit the local Saved transaction;
2. enqueue/coalesce the remote document;
3. publish `Saved locally` or offline status;
4. schedule bounded foreground work.

Push uses expected remote revision `0` for creation and the last acknowledged/pulled revision for update/tombstone. The server atomically rejects a stale base as a conflict. Operation IDs make retry after an ambiguous acknowledgement idempotent.

Transient network failure uses exponential backoff from one second, capped at five minutes. Manual `Sync now`/`Retry sync`, reconnect, foreground return, sign-in, or startup may retry immediately. Auth failure pauses until a validated session is restored. Schema/policy/invalid-response failures remain visible and persistent. Conflicts leave the retry queue and never loop automatically.

There is no aggressive polling. Work runs on opt-in, startup/sign-in for an already enabled identity, local mutation, manual sync, online return, and bounded foreground return.

## Pull and reconciliation

Pull is ordered by the server change cursor and bounded to at most five 100-row batches per run. Each document is fully domain-validated before local application.

For one stable object ID:

- identical local/remote documents become synced without a duplicate;
- no local copy means cold local materialization;
- local equals the shared base and remote changed means remote-only pull;
- remote equals the shared base and local changed means local push;
- both differ from the shared base means explicit conflict;
- different local/remote values without a known base also conflict rather than guessing ancestry;
- a remote revision older than the acknowledged base is ignored.

No universal last-write-wins or automatic field merge is used. Notes/tags are kept inside the full explicit version because their simultaneous semantics can be intentional. Replay payload changes and archive-versus-edit are always unsafe to merge silently.

## Conflict choices

The compact keyboard-accessible dialog says that the item changed on another device and offers:

- **Keep this device**: advance the chosen local version above both revisions and push against the current cloud revision;
- **Keep cloud version**: explicitly replace the local version with the validated cloud document;
- **Keep both**: keep the cloud version at the original stable ID and create a new active local object with a fresh Riverline ID, `source.surface = conflict_copy`, and `parentObjectId` provenance, then sync that copy.

Escape or the close control safely dismisses only the dialog. The durable conflict remains, the visible status stays `Conflict`, and no version is discarded. Focus is trapped while the dialog is open and status text is announced without color-only meaning.

## Tombstones

Archive remains the existing immutable `SavedStudyObject v1` lifecycle tombstone. It increments revision and syncs as an update. Absence is never interpreted as deletion, and remote rows are not hard-deleted. A stale active client pushing from an older revision receives a conflict and cannot resurrect the archived record. Eventual tombstone purge is future maintenance.

## Multiple devices and identity switching

The stable Riverline object ID is canonical across devices. Device-local Saved owner references are never remote ownership authority.

Every run captures an identity/generation token. Sign-out, Guest transition, account switch, or sync disable increments the generation and cancels scheduled work. A stale response may already have reached Supabase, but it cannot update the newly active identity's local repository, sidecar, cursor, or UI. Queues remain stored per original identity and resume only after that identity is authenticated again.

## Saved Hand replay

The remote Hand document contains a complete validated `saved-hand-snapshot/v1` or `saved-hand-snapshot/v2`, including the matching versioned canonical Replay source. A v2 document therefore transports its self-contained `GameRulesSnapshot v1` inside the PokerState and Replay initialization without changing `remote-saved-study-object/v1`, the SQL schema, cursor, outbox, or reconciliation policy. A cold pull onto an empty device validates and materializes that complete object. The existing Saved opener reconstructs the source only through the canonical poker domain and opens detached read-only Replay; it never looks up a live preset. No renderer frames, animation state, playback cursor, or hidden-card data outside the observer snapshot are added by sync.

## Security and privacy

- HTTPS Supabase transport only outside local development;
- public publishable key only; no service-role/database/OAuth secret;
- RLS plus bound Riverline identity checks;
- no token, session, provider mapping, username, email, or credential in remote documents/outbox;
- sanitized error categories and no study payload logging;
- no anonymous/public table or RPC access;
- no hard-delete path;
- export/import remains independent and excludes sidecar/outbox/provider session data.

Local browser storage is not encryption at rest. Cloud sync is user-selected transfer/storage, not end-to-end encryption.

## Payload measurements

`node tests/tooling/account002b_payload_sizes.mjs` measures UTF-8 bytes of the versioned remote JSON before transport compression:

| Representative object | Bytes |
|---|---:|
| typical Saved Spot | 1,734 |
| typical canonical Saved Hand | 3,405 |
| larger Saved Hand with a 20.8 KB long-form note and 24 tags | 26,124 |

These sizes are comfortable for one Postgres JSONB row. Premature replay/blob splitting is not justified by current representative data. A later measured payload problem must preserve the same application and replay contracts.

## Performance boundary

Sync never invokes StrategyProvider, Equity, Matrix, Training, solver, or poker calculation. Initial opt-in/import may deliberately enumerate the relevant local library once. Ordinary UI render reads cached coordinator status; pending work uses identity/domain indexes and one coalesced operation per dirty object. Pull changes flow through normal local invalidation and do not create a separate cloud Home.

## Unsupported and next scope

`ACCOUNT-002B-A` itself does not sync Personal Strategy, Range Calibration, Training history, Saved Ranges, account/profile preferences, or current runtime Scenario/Hand state. `ACCOUNT-002B-B` now reuses this transport/outbox/retry/identity-cancellation foundation for Personal Strategy and Range Calibration while leaving every Saved serializer, conflict choice, tombstone, Replay, and reconciliation rule unchanged. See `PERSONAL_STRATEGY_SYNC_SPEC.md`.
