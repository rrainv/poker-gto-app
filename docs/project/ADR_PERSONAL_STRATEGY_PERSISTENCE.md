# ADR: Personal Strategy persistence

Status: accepted by `RANGE-CAL-001C-A`; additive evidence-head projection extended by `ACCOUNT-002B-B`

Date: August 14, 2026

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

The one durable Personal Strategy authority is native IndexedDB database `riverline-personal-strategy`, database version `2`, behind `createPersonalStrategyRepository`.

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
| `rangeObservations` | `id` | `profileId`, `logicalKey`, `scopeKey`, `calibrationSessionId`; immutable direct history |
| `currentRangeObservations` | `logicalKey` | `profileId`, `scopeKey`; current leaf materialization |
| `conflictingRangeObservations` | `observationId` | `profileId`, `logicalKey`, `scopeKey`; additional immutable heads created by offline sync conflicts |
| `trainingObservations` | `id` | `profileId`, `logicalKey`; separate Training evidence |
| `calibrationSessions` | `id` | `profileId`, `scopeKey`; resumable progress/cursor |

Storage-only wrapper fields provide indexes around an unchanged domain `value`. They are not domain fields and never enter portable exports.

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
4. parse and apply the ordered `personal-strategy-store/v0 -> v1` domain migration if needed;
5. validate owner and the complete v1 graph;
6. write normalized records and derived current leaves in one database transaction;
7. count the imported record families inside that transaction;
8. write completed migration metadata only after counts match.

Successful migration retains the legacy bytes indefinitely under this ADR. They are a recovery copy, not a second live authority; subsequent opens use completed database metadata and do not re-import. A later cleanup policy requires a separate decision with backup UX/evidence.

Malformed JSON, invalid graph, owner mismatch, unsupported domain/backend version, open failure, quota failure, and transaction abort fail closed. The legacy source is never deleted or replaced. An aborted/partially created database has no completed metadata and retries initialization safely.

## Export and import

`personal-strategy-export/v1` remains a domain envelope, not an IndexedDB dump. It contains no object-store name, index key, database version, or backend schema.

Selected-profile export queries record stores by `profileId` and includes complete direct revision history, Training evidence, modes, and sessions. Import validates the portable envelope and merged domain graph before one atomic IndexedDB transaction. Existing collision, owner-mismatch, tied-mix, and revision-chain policies are unchanged.

This boundary is suitable for a future account/sync adapter because it consumes stable domain records rather than browser-database internals.

## Versioning

The following versions are independent:

- domain objects/store/export: existing v1 identifiers;
- physical backend schema: `personal-strategy-indexeddb/v2`;
- IndexedDB database version: `2`.

Database v2 is additive: it creates the conflicting-head store and advances physical metadata without rewriting v1 profiles, modes, evidence, sessions, or portable exports. Single-device edits retain the original linear selected-head transaction. Sync-created sibling/root evidence remains immutable in full history and receives a separate indexed head rather than being forced into a fabricated linear order.

Moving storage does not bump `StrategyProfile`, `RangeObservation`, `CalibrationSession`, or export schemas. A later IndexedDB object-store/index upgrade increments the database version. A semantic domain change requires its own approved schema migration.

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
