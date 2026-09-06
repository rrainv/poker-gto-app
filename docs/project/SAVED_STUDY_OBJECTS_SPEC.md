# Saved Study Objects Foundation

September 6 additive [Deep Review / Study Inbox](DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md)
consumer: canonical reviewed decisions preserve their parent Saved Hand when
needed, and Inbox reopens that exact decision through the existing source ID.
Review later/Situational retain existing annotations. The shared annotation editor
captures the selected Saved object and owner, so a changing current Hand cannot
retarget a decision note. Detached decision editing exposes no current-Hand archive.
No Saved schema or new evidence store is introduced.

September 6 additive import extension: [Hand History Import v1](HAND_HISTORY_IMPORT_V1_SPEC.md)
adds `saved-hand-snapshot/v3` with recorded-settlement PokerState/Replay v3 and
durable structured provenance. Outer SavedStudyObject v1, database, ownership
and historical records are unchanged. Raw history text is not stored.

Status: implemented through `SAVED-OBJECTS-002`, `GAME-RULES-001C`, and human-accepted `SAVED-VISUAL-KNOWLEDGE-001`, with optional account sync added by `ACCOUNT-002B-A`

Date: August 30, 2026

## Purpose and authority

Saved / Noted Study Objects are a user-owned application domain. They are not a Dashboard model, a renderer cache, a Personal Strategy extension, or a PokerState replacement.

The dependency path is:

```text
future Save / Note / Review UI
            |
            v
Saved Study application service + canonical Hand Replay source
            |
            v
SavedStudyObject v1 domain + repository
            |
            v
native IndexedDB
```

`app/src/saved-study-objects/` owns the domain, portability contract, repository, and physical persistence adapter. `app/src/application/saved-study-object-service.mjs` is the application builder boundary. Future Home/Dashboard, Hand/Replay, Training review, Matrix, and Range tools are consumers only.

The subsystem is lazy. Constructing the application service performs no local-owner bootstrap and opens no database. First use activates the owner and repository.

## SavedStudyObject v1

Schema: `saved-study-object/v1`

```text
SavedStudyObject
  schemaVersion
  id                       stable portable ID
  ownerRef                 saved-study-owner/v1
  kind                     extensible discriminator
  createdAt / updatedAt    normalized ISO timestamps
  revision                 positive conflict-detection revision
  annotations              shared user metadata
  source                   source surface + opaque source identity
  payload                  versioned kind payload
  lifecycle                active or archived
```

Object creation starts at revision `1`. Annotation and archive mutations increment the revision. Repository updates can require `expectedRevision`, preventing silent last-writer overwrite. Creation is idempotent when an identical object is retried with the same ID and timestamps; conflicting ID reuse fails.

Known outer-v1 kinds and nested payloads are:

- `hand` with `saved-hand-snapshot/v1` or `saved-hand-snapshot/v2`
- `spot` with `saved-spot-snapshot/v1` or `saved-spot-snapshot/v2`

Future `range`, `drill`, `session_review`, and other payloads are not implemented prematurely. An older client can validate, preserve, query, export, and re-import an unknown future kind as opaque versioned JSON, but does not interpret it.

## Shared annotations

Schema: `saved-study-annotations/v1`

All kinds share:

- optional title;
- optional user-authored note;
- normalized user tags;
- review state: `none`, `review_later`, or `resolved`;
- optional controlled classification, currently `mistake`.

Tags retain a normalized display value and a stable NFKC, whitespace-collapsed, lowercase key. Tags are de-duplicated and deterministically sorted by key. Notes, tags, review state, mistake classification, and title are one metadata model; there are no separate bookmark/note/review storage systems.

## Source and navigation identity

Schema: `saved-study-source/v1`

Source records contain:

- a stable source-surface discriminator such as `hand`, `replay`, `playbook`, `training`, `range_calibration`, or `matrix`;
- an optional opaque source ID;
- an optional parent SavedStudyObject ID.

Source records deliberately contain no UI route or DOM state. A future navigator resolves the source identity through its application controller if the source still exists.

## Saved Hand snapshot

Schemas: `saved-hand-snapshot/v1`, `saved-hand-snapshot/v2`

A v1 Hand payload stores one validated observer-level `poker-state/v1` value snapshot, the Hero player ID, privacy metadata, and a `canonical-hand-replay-source/v1`. A v2 Hand has the same outer fields with `poker-state/v2` and `canonical-hand-replay-source/v2`; the immutable `GameRulesSnapshot v1` is owned by the PokerState and Replay initialization rather than duplicated as another payload field. The PokerState contains the stable terminal/current view facts required for an independent read-only view:

- game/table configuration, seats, button, positions, and starting/current stacks;
- canonical board and dead cards;
- observer-known private cards and canonical dealt-but-hidden markers;
- action history, ledger/accounting, pot, contributions, current actor, phase, and street;
- terminal, refund, payout, and showdown facts when reached.

`PokerState.actionHistory` remains the canonical betting-action record. It is intentionally action-only and does not become a chance/reveal history. Deterministic historical Replay instead comes from the durable source journal.

### Canonical Hand Replay source

Source schemas: `canonical-hand-replay-source/v1`, `canonical-hand-replay-source/v2`

Event schemas: `canonical-hand-replay-event/v1`, `canonical-hand-replay-event/v2`

The source contains the fixed observer/Hero player ID and a contiguous, zero-based event sequence. Each event stores one canonical transition input:

| Operation | Durable payload | Canonical reconstruction |
|---|---|---|
| `initialize_hand` | hand ID, game/blind/ante configuration, button, seats, starting stacks | `initializeHand(configuration)`; this deterministically reconstructs posted blinds, antes/forced contributions, ledger, deal order, and initial chance state |
| `deal_hole` | complete known `deal_hole` chance input | `applyChance` |
| `deal_hole_observed` | observer-known `cardsByPlayer` plus `hiddenPlayerIds` | `applyChance` |
| `action` | exact canonical submitted Action v1 | `applyAction` |
| `deal_board` | exact pending `deal_flop`, `deal_turn`, or `deal_river` chance input and cards | `applyChance` |
| `reveal_hole` | exact player ID and two revealed cards | `applyPrivateReveal` |
| `showdown` | no payload | `resolveShowdown` |

V1 initialization remains byte- and behavior-compatible. V2 initialization replaces the legacy `game` configuration with the exact `rulesSnapshot` and calls `initializeHandFromGameRulesSnapshot`; later operations retain the existing canonical transition inputs. A source version and all of its event versions must agree. Unknown or mixed versions, malformed snapshots/fingerprints, and missing v2 rules fail explicitly.

The Replay projection controller derives an event only from adjacent successful canonical states. It immediately reapplies the derived input through the canonical poker domain and requires exact equality with the recorded next PokerState. On save, the complete source is replayed again; its observer must equal the Saved Hand Hero and its final state must equal the embedded PokerState. Event envelopes and operation-specific payloads use strict keys.

After a cold reload, `reconstructCanonicalHandReplaySource` runs the ordered events through the same poker-domain functions and returns canonical state transitions. `ReplayProjectionController.replaceFromCanonicalHandReplaySource` recaptures its private presentation frames from those states. Thus ordering comes only from persisted contiguous sequence numbers and engine legality, while chance events remain exact even though `actionHistory` stays action-only.

The persisted representation contains no renderer projection, CSS class, DOM state, animation duration, Replay cursor, selected frame, timer, or playback state.

### Hand privacy

Schema: `saved-hand-privacy/v1`

The snapshot copies the canonical observer state, not renderer internals. In the Replay source, an observed private deal stores only cards known to that observer and uses `hiddenPlayerIds` for every other dealt hand. A later `reveal_hole` event stores cards only when the trusted canonical session actually revealed them. Reconstructing earlier events therefore preserves hidden markers; a reveal never leaks backward into earlier frames. An opponent hand that was never revealed has no card identities anywhere in the Saved Hand.

Privacy metadata lists player IDs known and hidden in the embedded final/current PokerState and must validate against it. The source observer must be the same Hero perspective.

Saved data remains local by default. `ACCOUNT-002B-A` adds a separate explicit account-sync adapter for complete validated Hand/Spot objects; there is still no telemetry or sharing path. See `SAVED_OBJECT_SYNC_SPEC.md`.

## Saved Spot snapshot

Schemas: `saved-spot-snapshot/v1`, `saved-spot-snapshot/v2`

Both spot derivations store a validated `DecisionContext v1`, but their truth boundaries remain distinct.

The v1 payload remains unchanged. A rules-aware Hand-derived or standalone Spot uses v2 and adds one validated immutable `rulesSnapshot`. Its seated-player setup and neutral `off`/`fixed` accounting facts must agree with the DecisionContext and, when present, the Scenario input. It does not embed a PokerState or require live preset lookup.

### Hand-derived spot

- The application service derives DecisionContext through `deriveDecisionContextFromPokerState`.
- Exact opponent count, call amount, and current-street contribution are required.
- `saved-hand-reference/v1` may identify a parent saved Hand, canonical hand ID, and action-history count.
- The spot declares `canonical_decision_context` and `canonical_reference`; it does not embed a second poker engine.

### Scenario-derived spot

- The application accepts historical `playbook-scenario/v1` or snapshot-authoritative `playbook-scenario/v2` plus its DecisionContext.
- A Scenario v2 spot uses the existing `saved-spot-snapshot/v2` payload, and its nested Scenario snapshot must exactly equal the outer Saved Spot rules snapshot, including provenance and setup. No new SavedStudyObject, export, IndexedDB, or sync schema is introduced.
- Exact live-opponent count and Hero historical contribution remain `null`; a zero call amount is permitted only as the existing lossless free-check fact.
- No hand reference, PokerState, action history, or replay frames are allowed.
- The spot declares `lossy_scenario` and `not_available` history.

This preserves Scenario's intentionally arbitrary study semantics without inventing historical legality.

## Saved preview and library presentation

Schema: `saved-study-preview-facts/v1`

`SavedStudyObject v1` remains the sole persistence/schema authority. The DOM-free preview projection consumes a validated Saved object and emits bounded presentation facts; it is not stored, exported, synced, or treated as a second Saved, PokerState, Replay, Equity, Training, or strategy authority.

Current interpretation is deliberately limited:

- `hand` previews preserve canonical observer-safe Hero cards, board/dead cards, known revealed opponent hands, street, pot, and declared Replay/history truth without exposing unrevealed holdings;
- `spot` previews preserve only facts present in the stored DecisionContext and derivation metadata; Scenario-derived Spots remain visibly lossy/schematic and never manufacture canonical Hand history, players, contributions, or opponent holdings;
- unknown future kinds remain present but render unsupported/unavailable; they are never coerced into Hand or Spot;
- card faces reuse `card-presentation/v1`; preview renderers do not own rank/suit styling or poker evaluation.

The human-accepted Saved presentation keeps the compact object grid primary. All / Hands / Spots are the visible supported category model and remain visible when their count is zero; the current implementation filters only the already-bounded result set. This is not full-library retrieval. `SAVED-LIBRARY-001` owns a repository-backed retrieval/query contract for existing Hand/Spot objects with search, filters, sorting, and pagination, without creating another Saved authority or adding payload kinds. Hover and keyboard focus use the same viewport-aware body-level bounded overlay, while click/Enter expands one bounded detail surface. Identity/account changes clear private preview and detail state before another owner can render.

This presentation checkpoint does not change Saved Hand or Spot reopening, persistence, annotations, archive, portability, or sync behavior. No Saved Training Experience or Saved Equity Snapshot kind exists today; each requires a future explicit payload, authority, privacy/versioning, and reopen decision.

## Ownership

Schema: `saved-study-owner/v1`

V1 supports `{ kind: "local", id }`. The local owner ID is stable under `riverline.savedStudyObjects.owner.v1` and is created only on first Saved Study activation. The `kind + id` boundary, stable object IDs, timestamps, and revisions support the implemented account identity and optional sync adapter without making a Dashboard or backend the domain authority. Remote documents omit this device-local owner reference and are rehomed through the active account binding on pull.

Export/import defaults to deterministic `adopt_local`: imported local objects keep their globally safe object IDs and timestamps but are re-owned by the current local library. `require_match` is available for strict same-owner restore.

## IndexedDB persistence

Database: `riverline-saved-study-objects`

Database version: `1`

Backend schema: `saved-study-indexeddb/v1`

| Store | Key | Purpose |
|---|---|---|
| `metadata` | `key` | backend/domain versions, owner, repository revision, timestamps |
| `objects` | `id` | one wrapper around each complete SavedStudyObject value |

The object wrapper contains storage-only index keys. They do not enter domain exports.

| Index | Key | Query |
|---|---|---|
| `ownerStateUpdatedAt` | owner, lifecycle, updatedAt | active recent items |
| `ownerStateKindUpdatedAt` | owner, lifecycle, kind, updatedAt | active items by kind |
| `ownerStateReviewUpdatedAt` | owner, lifecycle, review state, updatedAt | review queue |
| `tagKeys` | normalized tag key, multi-entry | tag filter |
| `classificationKeys` | classification, multi-entry | mistake queue |

Recent, kind, and review queries use reverse bounded cursors and stop at the requested limit. A note edit replaces one object record and metadata record; it never reads or rewrites the whole library. Tag/classification queries scan only records matching their multi-entry index key and then apply owner/lifecycle ordering.

The repository owns all IndexedDB calls. Renderer code does not touch the database.

## Repository and application API

The repository provides:

- `initialize()`
- `save(object)`
- `getById(id)`
- `updateAnnotations(id, changes, options)`
- `archive(id, options)`
- `listRecent(options)`
- `listByKind(kind, options)`
- `listForReview(options)`
- `listByTag(tag, options)`
- `listByClassification(classification, options)`
- `exportLibrary(options)`
- `importLibrary(value, options)`

The application service provides trusted builders and consumer-facing operations:

- `saveHand(...)`, requiring the canonical PokerState and its matching canonical Hand Replay source
- `saveSpot(...)`, `saveHandDerivedSpot(...)`, `saveScenarioDerivedSpot(...)`
- annotation, lookup, query, archive, export, and import methods
- `listMistakes(...)` as the controlled mistake-classification query

No renderer constructs persistence wrappers or raw IndexedDB records.

## Source-surface identity and duplicate policy

`SAVED-OBJECTS-002` adds `saved-study-source-controller/v1` between the Playbook renderer and the Saved Study application service. The controller, not DOM copy, owns whether the current source is already saved.

- Every newly initialized live Hand receives an application-session source ID. Replay keeps that same ID because it is a historical projection of the same live Hand. Starting another Hand receives a new source ID even though the current canonical Hand controller uses a stable internal PokerState hand ID.
- A Scenario spot uses a deterministic fingerprint of its supported `playbook-scenario/v1` or `playbook-scenario/v2` value. The localized `lastActionLabel` is excluded; the canonical action value, immutable rules snapshot for v2, and remaining Scenario facts own identity. Editing a Scenario/rules fact therefore identifies a different spot, while changing language does not.
- The local source reference stores only source key, SavedStudyObject ID, and original creation timestamp under `riverline.savedStudyObjects.sourceRef.v1:*`. It is application/session navigation state, not a second saved-object schema, and it is not exported.
- The first save establishes a stable operation ID/timestamp before the repository write. Concurrent clicks share one in-flight promise; a retry reuses the operation identity. A resolved source reference is reopened with one bounded `getById` call and never with a recent/full-library query.
- Metadata mutations target the referenced SavedStudyObject with `expectedRevision`. Archive writes the existing v1 tombstone and clears the active source reference. It does not delete durable bytes or make an archived object mutable.

This policy prevents repeated Hand, historical Replay, or unchanged Scenario clicks from creating accidental duplicates while allowing a genuinely new Hand session or changed Scenario to create a new SavedStudyObject.

## Source-surface UX

Hand/Replay exposes a compact `Save hand` / `Saved` action; Scenario exposes `Save spot` / `Saved`. Both open one modal editor for optional title, line-preserving note, normalized comma/newline-separated tags, Review later, and Mistake. Changes persist only on `Save changes`; Cancel and Escape discard form edits. Archive requires an inline accessible confirmation. EN, RU, and HE use the normal Riverline translation lifecycle, with `dir=auto` text fields inside RTL UI.

This is not a Saved Library or Home surface. It exposes only the current source reference and performs no hidden polling, whole-library read, strategy resolution, Equity calculation, Matrix work, or Training render.

## Export and import

Envelope: `saved-study-library-export/v1`

The envelope contains only:

- schema version;
- export timestamp;
- owner reference;
- deterministically ordered SavedStudyObjects.

Serialization recursively sorts object keys. Import parses and validates the complete envelope before one transaction. Malformed JSON, old/unsupported envelope versions, unknown Hand/Spot nested versions, invalid known payloads, unsafe non-JSON values, duplicate envelope IDs, and conflicting durable IDs fail atomically. Re-importing identical IDs is an idempotent skip. Unknown future kinds remain opaque and round-trippable.

There are no IndexedDB store names, index keys, routes, DOM objects, or runtime controller instances in an export.

## Archive decision

V1 uses a lightweight archive tombstone instead of hard delete. Archive sets `lifecycle.state = archived`, records `archivedAt`, and increments the object revision. Active queries exclude archived records; direct lookup and library export retain them. Archived objects are immutable and there is no recycle-bin UI or restore flow in this ticket.

This is the smallest v1 choice that preserves future sync deletion intent without building sync, a CRDT, or a complex recycle bin.

`ACCOUNT-002B-A` consumes this decision directly: archive is a versioned remote tombstone update, absence is never deletion, and a stale active client cannot overwrite the newer archived revision. Remote rows are not hard-deleted; eventual purge remains future maintenance.

## Migration and failure policy

Physical database migrations are an ordered registry. Version `1` deterministically creates the metadata/object stores and indexes. A future physical change adds the next database migration; a semantic object change uses a new domain schema. These version axes remain independent.

A clean database receives ownership/version metadata in one transaction. Records without metadata, owner mismatches, future backend versions, unsupported domain versions, transaction aborts, quota failures, and malformed imports fail closed. Initialization can retry after incidental open/transaction failure. Existing durable bytes are never reset as recovery behavior.

`SAVED-OBJECTS-001R` corrected the uncommitted `saved-hand-snapshot/v1` payload before release by replacing incomplete Replay compatibility metadata with the canonical source journal. The outer Saved Hand schema and IndexedDB physical version remain v1; there is no released v1 data to migrate and no database-store/index change.

## Performance evidence

One bounded Electron 30 / Chromium native IndexedDB benchmark ran on August 16, 2026 with 3,001 small synthetic objects:

| Operation | Result |
|---|---:|
| clean database activation | 96.9 ms |
| populated activation | 0.6 ms |
| bulk import of 3,000 objects | 998.3 ms |
| create one object after seed | 2.3 ms |
| update one note | 2.6 ms |
| recent query, limit 20 | 6.7 ms |
| review query, limit 50 | 6.3 ms |
| export 3,001 objects | 182.6 ms |
| deterministic export size | 2,062,029 bytes |

The automated 2,000-object structural performance test additionally proves that recent/review index reads return only their requested 20/25-record windows and a note update writes exactly the object plus repository metadata.

These figures establish comfortable thousands-of-objects behavior; they are not a promise for extreme scale or large future range payloads.

## Deferred UX and platform work

`SAVED-OBJECTS-001/001R/002` add no Dashboard, Home redesign, full saved-hand browser, global search, Training auto-save, Range integration, sharing, or backend. Optional account cloud sync is now owned exclusively by `ACCOUNT-002B-A` and `SAVED_OBJECT_SYNC_SPEC.md`; it does not change the Saved object/export schemas. `SAVED-LIBRARY-001` is the activated consumer/retrieval owner for current Hand/Spot records only. It must reuse this repository/application authority and does not authorize Range, Drill, Review, Session, Training, or Equity payloads.

The existing Saved opener loads a Hand, version-validates and reconstructs `payload.replaySource`, and feeds the reconstruction to the Replay projection/playback controllers. Both supported Hand versions open through that detached read-only path; it never persists or invents renderer frames, playback cursor/timers, or hidden cards.

## Device Guest and lifecycle scope

Slice B makes local Saved creation, annotations, archive, reopen, and existing library import/export available to Device Guest without sign-in. Payloads and SavedStudyObject v1 remain unchanged. Saved resolves the lifecycle-owned domain binding; its repository, source-reference preferences, in-flight deduplication, and cache are bound to that generation. Queued stale operations cannot begin, reads cannot adopt after revocation, and in-flight writes abort before commit. Account and Guest libraries stay separate; no Guest sync is permitted. Human browser acceptance remains pending.
