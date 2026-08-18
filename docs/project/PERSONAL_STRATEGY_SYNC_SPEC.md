# Personal Strategy and Range Calibration cloud sync

Status: `ACCOUNT-002B-B` implemented; live Supabase migration/RLS and two-profile Firefox acceptance remain required

Date: August 17, 2026

## Scope and authority

Personal Strategy and Range Calibration use the existing `riverline-sync/v1` coordinator, durable IndexedDB outbox, retry/backoff, remote adapter boundary, identity generation cancellation, and compact account status introduced by `ACCOUNT-002B-A`. They do not create another transport or outbox.

```text
Personal Strategy repository (local authority)
        | post-commit profile/evidence/session mutations
        v
SyncCoordinator v1 -> shared durable outbox -> RemoteSyncAdapter -> Supabase/RLS
        ^                        |                       |
        |                        |                       v
PersonalStrategySyncAdapter + RangeCalibrationSyncAdapter <- domain pull/reconcile
```

`app/src/personal-strategy/` remains the durable local domain authority. `app/src/sync/personal-strategy-domain-adapters.mjs` owns credential-free remote serialization and domain reconciliation. UI and renderers do not call Supabase or implement merge rules.

Generic Training history, Saved Ranges, inferred output, provider mappings, sessions/tokens, preferences, and transient DOM state are not synced.

## Versions

| Concern | Version |
|---|---|
| shared transport/coordinator | `riverline-sync/v1` |
| durable outbox operation | `riverline-sync-operation/v1` |
| remote Personal Strategy entity | `remote-personal-strategy-entity/v1` |
| reconciliation | `personal-strategy-reconciliation/v1` |
| mutable metadata conflict | `personal-strategy-metadata-conflict/v1` |
| Personal Strategy local domain objects | existing profile/mode/evidence/session v1 schemas |
| Personal Strategy physical IndexedDB | `personal-strategy-indexeddb/v2`, database version `2` |

Database v2 adds `conflictingRangeObservations`, an indexed local projection of additional immutable evidence heads. Existing v1 records and portable object schemas are unchanged. The v1 physical metadata upgrade is additive and does not rewrite evidence history.

## Consent

Authentication never enables upload. Account/Profile exposes two identity-scoped choices:

1. Saved Hands and Spots;
2. Personal Strategy and Range Calibration.

An existing Saved sync preference is preserved exactly. The new strategy/calibration preference starts undecided and disabled, so an earlier Saved consent cannot silently upload Personal Strategy. Each choice can be disabled independently; disabling stops remote work without deleting local cache, outbox, tombstones, or cloud rows.

Before strategy sync is enabled, the visible summary counts profiles, active direct observations, and active calibration sessions. The summary is loaded when Account/Profile opens rather than opening Personal Strategy storage during ordinary startup.

Eligibility still requires an authenticated active Riverline identity, a currently validated provider session, and the domain preference. Guest, expired restoration, an identity mismatch, or disabled consent performs zero remote queries/writes.

## Remote schema

Migration `supabase/migrations/202608170003_personal_strategy_sync.sql` creates four private tables:

- `personal_strategy_profiles`: stable profile ID, bound Riverline identity, expected revision, schema/timestamps, archive tombstone, and validated profile JSON;
- `personal_strategy_modes`: stable mode ID, profile relationship, display order, schema/timestamps, and mode JSON;
- `personal_strategy_evidence`: stable evidence ID, profile/mode/context/hand indexes, provenance/source, direct-versus-Training type, optional dominant action/exact-mix flag/session ID, and immutable evidence JSON;
- `range_calibration_sessions`: stable session/profile/mode IDs, context key, expected revision, state/cursor/timestamps, and session JSON.

Profile and its exactly three modes travel in one versioned remote `profile_bundle` operation so a cold device never observes an invalid half-profile. Supabase still stores profiles and modes relationally and reconstructs the bundle in the pull RPC. Evidence and sessions remain separate rows, not one opaque Personal Strategy document.

The versioned RPCs are:

- `sync_personal_strategy_entity_v1`: identity-bound expected-revision/idempotent write;
- `pull_personal_strategy_entities_v1`: bounded ordered cursor pull across profile bundles, evidence, and sessions.

The combined Personal Strategy cursor is deliberate: one domain-ordered batch applies profile bundles, sessions, direct evidence, then Training evidence, preserving local foreign relationships during cold reconstruction. Saved objects retain their separate Saved cursor.

## Evidence serialization and reconciliation

Direct `RangeObservation v1` and persisted `TrainingObservation v1` rows are append-oriented and immutable by stable evidence ID.

`RANGE-BUILDER-001` uses the same direct row contract and transport. Additive `provenance.source = range_builder`, `actionGroupId`, and optional `undoesActionGroupId` remain inside the immutable evidence payload; one local Builder command notifies one batch of source rows, while the existing outbox retains one stable immutable operation per row. No Builder selection, preview, session history, Matrix, inferred snapshot, or separate sync protocol exists.

- the same ID and exact payload deduplicates;
- reusing an ID with different bytes fails closed;
- distinct IDs are both retained even when profile/mode/context/hand match;
- provenance, timestamps, direct/Training source, dominant action, exact frequencies, revision parent, and calibration-session ID are preserved;
- a retraction remains a new immutable direct-evidence row, never a delete;
- generic Training exercises/history do not enter this table.

Offline roots or sibling revisions can create multiple current direct-evidence heads. Physical IndexedDB v2 keeps one selected local editing head plus indexed additional heads; full snapshots/exports contain every record. Workspace/Home progress counts unique answered hand classes, not evidence-row count. No evidence conflict dialog asks the user to delete one observation.

Sparse RFI inference is not synced. It is deterministic and cheap enough to recompute from local direct evidence. A direct answer remains higher authority than inferred output. If synced direct heads disagree for the requested hand, inference returns explicit `contradictory_direct_evidence` abstention with all stable evidence references; stale inferred output cannot override it. Remote application is change-driven and UI invalidation is debounced, avoiding a 169-hand recomputation per pulled row.

## Profile and mode metadata conflicts

Profile identity is stable ID, never display name. Mode identity is stable ID, never display name or display order.

The adapter performs a bounded three-way field merge against the last shared remote base:

- identical or one-sided field changes merge;
- safe edits to different fields merge structurally;
- divergent edits to the same profile/mode field create a durable metadata conflict;
- the compact existing conflict dialog offers Keep this device or Keep cloud for metadata;
- Keep both is intentionally unavailable because cloning/merging profiles by display name would change structural identity.

Archive state is a versioned profile tombstone. A stale active edit cannot clear it silently; safe unrelated metadata may merge while state remains archived, and same-field state disagreement conflicts.

## Calibration-session merge and handoff

Existing opaque randomly generated session IDs are globally stable across devices and are preserved. Display labels are not identifiers.

For the same stable session ID, reconciliation separates evidence from mutable session metadata:

- `observationIds` are a stable deduplicated union;
- independent/contradictory answers remain separate immutable evidence;
- selected state follows the newer metadata unless completion evidence requires completed;
- pause remains paused while unanswered work remains unless a later active update resumes it;
- cursor/progress are recomputed after evidence application from unique active direct hand classes;
- completion occurs only when all 169 RFI hand classes are answered in the merged local projection.

Cold pull ordering applies profile/modes, then session identity/scope, then evidence. Device B therefore resumes the merged next unanswered prompt. Answers from B enqueue locally first; Device A later pulls them and recomputes the same progress. Session merge never last-write-wins the evidence collection.

## Local-first, import/export, and invalidation

Profile creation/edit, accepted answer plus session cursor, undo/retraction, pause/resume, and portable import commit through the canonical Personal Strategy repository before outbox notification. A sidecar or remote failure cannot roll back the local action.

Portable exports remain backend-independent. They include the complete direct revision forest, Training evidence already persisted in Personal Strategy, and calibration sessions, but exclude cursors, outbox, remote revisions, provider mappings/sessions, auth tokens, and credentials. Import adopts the active owner through existing semantics, validates/commits locally, then enqueues only successfully added entities.

Remote changes dispatch the normal Personal Strategy invalidation. Home remains a consumer of the local repository. An open Range Calibration workspace remounts for the active identity after a debounced remote batch; no cloud-specific strategy model or hidden Matrix render exists.

## Guest, switching, and cancellation

Guest performs no Personal Strategy or Range Calibration repository query through sync and no remote work. Sign-out preserves account-scoped local cache but makes it unreachable. Sign-back-in restores the mapped identity.

Each coordinator run captures identity plus generation. Disable, sign-out, Guest transition, or account switch invalidates scheduled work. A response already accepted remotely may finish for its original account, but cannot update another identity's repository, sidecar, cursor, or UI. Account A/B use distinct domain databases, owner refs, preferences, queues, conflicts, and cursors.

## RLS and security

Every remote row carries both Auth UUID ownership and stable Riverline identity binding. RLS select/insert/update policies require:

```text
owner_auth_user_id = auth.uid()
and riverline_identity_id = caller's public.profiles.riverline_identity_id
```

Anonymous/public access is revoked. Username/display name are not ownership authority. Evidence has no update/delete grant. Mutable rows have guarded advancing revisions and immutable owner/identity. There is no client hard-delete policy. The renderer uses only the public Supabase client/RLS; no service-role key exists in code or payload.

Remote documents/outbox exclude password, email, token, provider subject/mapping, username, service key, sync cursor, and provider session. Personal Strategy is private study data, not public/shareable content. Cloud sync is not end-to-end encryption, and browser-local storage is not encryption at rest.

## Outbox, retry, and status

The shared `riverline-sync` IndexedDB stores domain-keyed preferences, records/bases, one coalesced operation per mutable stable entity, conflicts, and cursor. Operation kinds include:

- `upsert_profile_bundle` / `tombstone_strategy_profile`;
- `upsert_range_observation`;
- `upsert_training_observation`;
- `upsert_calibration_session`.

Immutable evidence IDs normally enqueue once. Repeated local session/profile edits coalesce while retaining the original expected remote revision. Retry/backoff, idempotent operation IDs, auth pause, manual retry, online/visibility triggers, bounded pull batches, and persistent sanitized errors are shared with Saved sync.

The account/header status aggregates Saved and Personal Strategy pending/conflict/error counts with priority `Conflict > Error/Auth > Offline > Syncing > Saved locally > Synced`. Evidence contradictions are not counted as metadata conflicts; they remain domain facts.

## Performance measurements

`node tests/tooling/account002bb_payload_sizes.mjs` measures UTF-8 remote JSON before compression on the current Node runtime:

| Fixture | Operations | Total JSON | Largest operation | Serialization |
|---|---:|---:|---:|---:|
| 3 profiles, 3 modes/profile, 100 observations, 1 active session | 104 | 106,782 bytes | 1,346 bytes | about 4–5 ms observed |
| 3 profiles, 3 modes/profile, 500 observations, 1 active session | 504 | 515,052 bytes | 1,346 bytes | about 13–18 ms observed |

These are first-sync operation counts. Ordinary work is change-driven and coalesces mutable entities; it does not repeatedly upload the full library. Sync invokes no StrategyProvider, Equity, solver, Training generator, or hidden Matrix render. Inference artifacts are not payload cost.

## Verification boundary

Deterministic fake-adapter tests cover opt-in, local-first upload/pull, cold reconstruction, evidence dedupe/contradictions, inference abstention, profile/mode conflicts, cross-device session resume, tombstone non-resurrection, import/export, Guest/account isolation, and aggregated status. The existing Saved sync suite remains unchanged and passing.

Applying migration 003 and real two-account/two-profile Firefox QA are external acceptance steps. Until completed, RLS behavior and rendered EN/HE 1024/1366 lifecycle remain `PARTIAL`, not visually/live accepted.
