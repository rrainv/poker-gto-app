# ADR: Personal Strategy persistence

Status: accepted storage decision; extended by `ACCOUNT-002B-B`, `PERSONAL-STRATEGY-INTELLIGENCE-001`, and the explicitly authorized exact-node migration in `PERSONAL-STRATEGY-COACH-001` / `RANGE-EVOLUTION-001A`. Exact-node implementation remains subject to ticket acceptance.

Date: August 14, 2026; persistence contract updated September 5, 2026.

## Context

The accepted `RANGE-CAL-000/001A/001B` baseline persisted one validated `personal-strategy-store/v1` JSON document under `riverline.personalStrategy.v1`. One `setItem` made a small mutation appear atomic, but every answer synchronously read, parsed, graph-validated, serialized, and replaced all profiles, sessions, evidence, and revision history.

The supplied benchmark showed the structural limit:

| Direct observations | Median answer write | p95 | Serialized store |
|---:|---:|---:|---:|
| approximately 0 | approximately 0.9 ms | — | small |
| 169 | approximately 11.9 ms | approximately 30.4 ms | approximately 0.13 MB |
| 3,042 | approximately 193.6 ms | approximately 271.3 ms | approximately 2.3 MB |
| 7,605 | approximately 452.1 ms | approximately 533.8 ms | approximately 5.7 MB |

The 169-hand use case was good, but planned multiple profiles, modes, contexts, revision histories, Training evidence, and future families make O(total history) synchronous rewrites and Web Storage quota pressure unacceptable as the long-term authority.

## Options considered

### Whole-document Web Storage

Smallest code change, simple injected tests, and adequate for 169 hands. Rejected because interaction time and quota grow with the complete store. Validation/serialization tuning cannot remove that scaling law.

### Chunked or journaled Web Storage

Could reduce individual values, but would require Riverline to invent multi-key transactions, indexes, journals, crash recovery, compaction, and cross-tab rules on a synchronous preference API. Rejected as more custom persistence machinery with weaker guarantees.

### IndexedDB behind the repository

Native in Firefox and Electron, asynchronous, transactional across records, indexed, local-first, and dependency-free. Selected.

### Hybrid Web Storage plus IndexedDB

Selected as the concrete form of the IndexedDB option. Tiny values that are useful before database activation remain in Web Storage; durable Personal Strategy records move to IndexedDB. This avoids moving preferences for architectural purity and preserves zero database work before Range Calibration activation.

No server, remote database, Electron IPC/filesystem authority, database framework, cloud sync, or new dependency is introduced.

## Decision

The one durable Personal Strategy authority is native IndexedDB database `riverline-personal-strategy`, database version `4`, behind `createPersonalStrategyRepository`.

The dependency path is:

```text
Range Calibration UI
        |
        v
async application service
        |
        v
Personal Strategy repository
        |
        v
IndexedDB transaction adapter
```

Web Storage owns only:

- `riverline.personalStrategy.owner.v1`: stable local-owner bootstrap;
- `riverline.rangeCalibration.preferences.v1`: tiny workspace selection/context preferences;
- `riverline.personalStrategy.v1`: retained legacy recovery source when one exists.

The UI has no direct storage access. The asynchronous boundary is real: the application and workspace await repository work, keep answer controls disabled while persistence is pending, advance only after durable success, and expose a safe retry after an unconfirmed answer.

## Physical layout

| Object store | Key | Indexes / purpose |
|---|---|---|
| `metadata` | `key` | backend/domain versions, owner, repository revision, migration status |
| `profiles` | `id` | profile domain records |
| `modes` | `id` | `profileId` |
| `qualitativeEvidence` | `id` | `profileId`, `modeId`; immutable confirmed qualitative intent |
| `exactNodeIntents` | `id` | `profileId`, `modeId`; immutable exact-node intended evidence |
| `rangeObservations` | `id` | `profileId`, `logicalKey`, `scopeKey`, `calibrationSessionId`; immutable direct history |
| `currentRangeObservations` | `logicalKey` | `profileId`, `scopeKey`; current leaf materialization |
| `conflictingRangeObservations` | `observationId` | `profileId`, `logicalKey`, `scopeKey`; additional immutable heads created by offline sync conflicts |
| `trainingObservations` | `id` | `profileId`, `logicalKey`; separate Training evidence |
| `calibrationSessions` | `id` | `profileId`, `scopeKey`; resumable progress/cursor |

Direct/Training/session storage-only wrapper fields provide indexes around an unchanged domain `value`. Qualitative and exact-node records are stored directly under their domain IDs. They are not domain fields and never enter portable exports.

`logicalKey` is the existing `profile + mode + canonical context + hand` identity. `scopeKey` omits the hand. Immutable revision records are never compacted or deleted. `currentRangeObservations` points to the selected active or retracted editing leaf; `conflictingRangeObservations` indexes additional synced evidence heads, so one-hand and one-scope work does not scan history.

## Atomicity and retry

One accepted answer writes the observation, current leaf, CalibrationSession cursor/progress, and repository metadata in one strict IndexedDB transaction.

The transaction verifies:

- the profile/mode/session relationship;
- the expected session timestamp;
- exactly one appended session observation ID;
- the expected superseded current leaf;
- global stable-ID uniqueness.

The observation ID is also the operation ID. Retrying the exact already-committed observation/session pair succeeds idempotently without incrementing revision or duplicating evidence. A conflicting reuse fails. An abort/quota failure changes none of the records, so forbidden half-answer states cannot become durable.

## Migration and recovery

On first repository initialization:

1. open/create IndexedDB without touching unrelated application data;
2. read completed database metadata if present;
3. otherwise detect `riverline.personalStrategy.v1`;
4. parse and apply the ordered `personal-strategy-store/v0 -> v1 -> v2 -> v3` domain migration if needed;
5. validate owner and the complete current graph;
6. write normalized records and derived current leaves in one database transaction;
7. count the imported record families inside that transaction;
8. write completed migration metadata only after counts match.

Successful migration retains the legacy bytes indefinitely under this ADR. They are a recovery copy, not a second live authority; subsequent opens use completed database metadata and do not re-import. A later cleanup policy requires a separate decision with backup UX/evidence.

Malformed JSON, invalid graph, owner mismatch, unsupported domain/backend version, open failure, quota failure, and transaction abort fail closed. The legacy source is never deleted or replaced. An aborted/partially created database has no completed metadata and retries initialization safely.

## Export and import

`personal-strategy-export/v3` is the current domain envelope, not an IndexedDB dump. It contains no object-store name, index key, database version, or backend schema.

Selected-profile export queries record stores by `profileId` and includes complete direct revision history, Training evidence, modes, sessions, qualitative evidence, and exact-node intent including its corrections and original provenance. Export v1/v2 passes ordered domain migration; current exports never downgrade exact-node records. Import validates the portable envelope and merged domain graph before one atomic IndexedDB transaction. Existing collision, owner-mismatch, tied-mix, and revision-chain policies are unchanged.

This boundary is suitable for a future account/sync adapter because it consumes stable domain records rather than browser-database internals.

## Versioning

The following versions are independent:

- Profile/Mode domain objects: v2; direct/Training/session evidence: existing v1 identifiers;
- store/export envelopes: v3; exact-node intent: `personal-exact-node-intent/v1`;
- physical backend schema: `personal-strategy-indexeddb/v4`;
- IndexedDB database version: `4`.

Historical database v2 was additive: it creates the conflicting-head store and advances physical metadata without rewriting v1 profiles, modes, evidence, sessions, or portable exports. Single-device edits retain the original linear selected-head transaction. Sync-created sibling/root evidence remains immutable in full history and receives a separate indexed head rather than being forced into a fabricated linear order.

The approved Intelligence v1-to-v2 domain migration upgrades Profile/Mode metadata and adds an empty qualitative collection; physical backend v3 supplies its store. The approved exact-node v2-to-v3 domain migration adds an empty `exactNodeIntents` collection without modifying any existing evidence; physical backend v4 supplies its store. Existing backend versions 1/2/3 upgrade atomically, with ordered domain transforms and completion metadata. Unexpected exact-node records in older schemas, corrupt histories, incompatible versions, and interrupted writes fail closed.

Exact-node intent binds canonical replay/node identity, board/street/history, exact action amount semantics, physical combo (or explicitly expanded preflop class), preferred-only or exact-mix precision, Approach/Setup versions, immutable provenance, and correction lineage. The repository verifies current versions and current supersession heads before appending, then increments metadata in the same identity-fenced transaction. Duplicate IDs fail closed. Exact-node reads validate the complete addressed Approach history; their cost scales with that history. The earlier direct-answer benchmark below does not measure exact-node validation.

Existing ?Raise 75%? remains action-family evidence and never becomes ?raise to 2.5bb 75%.? Dominant-only remains unknown frequency. Weighted ranges, conditioning, card removal, trajectories, and summaries are derived and are never added to this evidence collection. Forks create independently identified records with copied-source provenance and remapped correction IDs; the source records remain untouched. Owner adoption changes the existing store/profile owner only, preserving child intent/provenance. The legacy remote transport remains upgrade-required; this migration creates no remote schema or second store.

## Performance evidence

The repeatable Node harness covers empty, 169, approximately 1k, approximately 3k, approximately 10k, and revision-heavy fixtures. It measures legacy bytes, estimated record storage, migration, workspace open/load, answer transaction, next-question resolution, current-leaf query, and profile export.

The definitive Firefox 153 audit used 10,140 current leaves:

| Measure | Median | p95 | Worst |
|---|---:|---:|---:|
| IndexedDB answer transaction | 13 ms | 30 ms | 33 ms |
| Total accepted answer to rendered next prompt | 15 ms | 31 ms | 33 ms |
| Current-leaf query | 1 ms | 5 ms | 9 ms |

Additional measured costs:

- 10,140-leaf Range Calibration activation: approximately 1.0 s;
- one full approximately 10k-record profile export: approximately 1.84 s / 7.63 MB;
- 3,042-record legacy migration plus workspace activation: approximately 5.17 s;
- Firefox origin usage after the approximately 10k stress fixture: approximately 160 MB by `navigator.storage.estimate()` (browser-level estimate; record wrappers plus immutable/current copies dominate);
- Electron one-answer path: approximately 7.8 ms in the acceptance audit.

The answer path is materially better than whole-store rewriting and meets median below 50 ms / p95 below 100 ms. Migration, full activation, and full-profile export intentionally scale with processed records and are not on every answer.

## Lazy activation and compatibility

The static bootstrap does not import Personal Strategy or open IndexedDB. Firefox and Electron audits both observed no database and no owner bootstrap before first Range Calibration activation in a fresh profile. Existing Playbook, Training, Matrix, Analysis, Equity, and StrategyProvider remain outside this dependency path.

Firefox 153 verified database creation, migration, answer transaction, reload recovery, current-leaf lookup, export, and the 10,140-leaf performance path. Electron 30/Chromium verified creation and durable recovery across two separate Electron processes sharing one temporary user-data profile.

## Tradeoffs and future trigger

IndexedDB adds an honest async boundary, transaction adapter, physical metadata, and browser-specific QA. Record wrappers and current-leaf materialization use more physical space than one compact JSON document. Full workspace activation currently loads all current leaves; a very large single-profile export still materializes that profile's history.

The next scaling trigger is measured activation/export disruption in realistic libraries. The next bounded response is profile/context-scoped workspace loading and streamed/chunked domain export—not a domain rewrite and not another persistence authority. Postflop evidence or much larger histories may also justify storage-estimate warnings or explicit archival/backup UX in a separately approved ticket.

## Consequences

- Accepted answers are durable before UI advancement.
- Answer/session half-commits and ambiguous duplicate retries are prevented.
- Revision truth, tied-mix semantics, Training separation, owner policy, and portable exports are preserved.
- Existing valid Web Storage v1 users migrate automatically and retain a recovery source.
- Personal Strategy remains dormant until Range Calibration activation.
- No `RANGE-CAL-001D`, inference, StrategyProvider integration, account, sync, or product-library expansion is introduced.
