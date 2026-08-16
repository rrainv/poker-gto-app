import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  SAVED_STUDY_BACKEND_SCHEMA_VERSION,
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_DATABASE_MIGRATIONS,
  SAVED_STUDY_DATABASE_VERSION,
  SAVED_STUDY_INDEXES,
  SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION,
  SAVED_STUDY_OBJECT_SCHEMA_VERSION,
  SAVED_STUDY_OBJECT_STORES,
  SAVED_STUDY_REVIEW_STATES,
  SavedStudyStorageError,
  createMemorySavedStudyDatabase,
  createSavedStudyAnnotations,
  createSavedStudyLibraryExport,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
  createSavedStudySource,
  parseSavedStudyLibraryExport,
  serializeSavedStudyLibraryExport,
} from '../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-16T09:00:00.000Z';
const T1 = '2026-08-16T09:01:00.000Z';
const T2 = '2026-08-16T09:02:00.000Z';
const OWNER = createSavedStudyOwnerRef('saved-objects-repository-owner');
const OTHER_OWNER = createSavedStudyOwnerRef('saved-objects-portable-owner');

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.reads = 0;
    this.writes = 0;
  }
  getItem(key) {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.writes += 1;
    this.values.set(key, String(value));
  }
}

function opaqueObject({
  id,
  ownerRef = OWNER,
  kind = 'future_item',
  createdAt = T0,
  updatedAt = createdAt,
  title = null,
  note = null,
  tags = [],
  reviewState = SAVED_STUDY_REVIEW_STATES.NONE,
  classifications = [],
  marker = id,
} = {}) {
  return createSavedStudyObject({
    id,
    ownerRef,
    kind,
    createdAt,
    updatedAt,
    annotations: createSavedStudyAnnotations({
      title, note, tags, reviewState, classifications,
    }),
    source: createSavedStudySource({ surface: 'future_surface', sourceId: `source-${id}` }),
    payload: { schemaVersion: `${kind}/v1`, marker },
  });
}

function repository({ database = createMemorySavedStudyDatabase(), ownerRef = OWNER, clock = () => T2 } = {}) {
  return createSavedStudyRepository({ database, ownerRef, clock });
}

test('application activation is lazy across owner bootstrap and database open', async () => {
  const storage = new MemoryStorage();
  const database = createMemorySavedStudyDatabase();
  let counter = 0;
  const app = createSavedStudyObjectApplication({
    storage,
    database,
    clock: () => T0,
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });

  assert.equal(storage.reads, 0);
  assert.equal(storage.writes, 0);
  assert.equal(database.getMetrics().transactions, 0);
  await app.listRecent();
  assert.equal(storage.reads, 1);
  assert.equal(storage.writes, 1);
  assert.ok(database.getMetrics().transactions > 0);
  await app.listRecent();
  assert.equal(storage.reads, 1);
});

test('repository creates, reads, updates annotations, and serves Dashboard-ready queries', async () => {
  const database = createMemorySavedStudyDatabase();
  const repo = repository({ database });
  const hand = opaqueObject({
    id: 'saved-repo-hand',
    kind: 'hand_summary',
    createdAt: T0,
    tags: ['BTN vs BB', '3-Bet Pot'],
  });
  const spot = opaqueObject({
    id: 'saved-repo-spot',
    kind: 'spot_summary',
    createdAt: T1,
    tags: ['BTN vs BB'],
    reviewState: SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
    classifications: [SAVED_STUDY_CLASSIFICATIONS.MISTAKE],
  });
  await repo.save(hand);
  await repo.save(spot);

  assert.deepEqual(await repo.getById(hand.id), hand);
  assert.deepEqual((await repo.listRecent()).map((entry) => entry.id), [spot.id, hand.id]);
  assert.deepEqual((await repo.listByKind('spot_summary')).map((entry) => entry.id), [spot.id]);
  assert.deepEqual((await repo.listForReview()).map((entry) => entry.id), [spot.id]);
  assert.deepEqual((await repo.listByTag('  btn VS bb  ')).map((entry) => entry.id), [spot.id, hand.id]);
  assert.deepEqual((await repo.listByClassification()).map((entry) => entry.id), [spot.id]);

  const metricsBefore = database.getMetrics();
  const updated = await repo.updateAnnotations(hand.id, {
    note: 'One-record note edit',
    tags: ['BTN vs BB'],
    reviewState: SAVED_STUDY_REVIEW_STATES.RESOLVED,
  }, { updatedAt: T2, expectedRevision: 1 });
  const metricsAfter = database.getMetrics();
  assert.equal(updated.object.revision, 2);
  assert.equal(updated.object.annotations.note, 'One-record note edit');
  assert.deepEqual(updated.object.payload, hand.payload);
  assert.equal(metricsAfter.recordsWritten - metricsBefore.recordsWritten, 2);
  await assert.rejects(
    repo.updateAnnotations(hand.id, { note: 'stale' }, { updatedAt: T2, expectedRevision: 1 }),
    /changed since it was read/,
  );
});

test('create retry is idempotent, conflicting reuse fails, and transaction failure preserves prior data', async () => {
  const database = createMemorySavedStudyDatabase();
  const repo = repository({ database });
  const object = opaqueObject({ id: 'saved-repo-idempotent' });
  const first = await repo.save(object);
  const retry = await repo.save(JSON.parse(JSON.stringify(object)));
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.repositoryRevision, first.repositoryRevision);

  await assert.rejects(
    repo.save(opaqueObject({ id: object.id, marker: 'conflict' })),
    /ID collision/,
  );
  database.failNextTransaction('before_commit', new Error('quota exceeded'), 'readwrite');
  await assert.rejects(
    repo.updateAnnotations(object.id, { note: 'not durable' }, { updatedAt: T1 }),
    (error) => error instanceof SavedStudyStorageError && error.code === 'transaction_failed',
  );
  assert.equal((await repo.getById(object.id)).annotations.note, null);
});

test('archive is idempotent, excluded from active queries, and durable across activation', async () => {
  const database = createMemorySavedStudyDatabase();
  const first = repository({ database });
  const object = opaqueObject({
    id: 'saved-repo-archive',
    reviewState: SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
    tags: ['archive-me'],
  });
  await first.save(object);
  const archived = await first.archive(object.id, { archivedAt: T1, expectedRevision: 1 });
  assert.equal(archived.object.lifecycle.state, 'archived');
  assert.equal((await first.archive(object.id, { archivedAt: T2 })).idempotent, true);
  assert.deepEqual(await first.listRecent(), []);
  assert.deepEqual(await first.listForReview(), []);
  assert.deepEqual(await first.listByTag('archive-me'), []);
  assert.equal((await first.getById(object.id)).lifecycle.state, 'archived');
  assert.equal(await first.getById(object.id, { includeArchived: false }), null);

  await first.close();
  database.reopen();
  const reopened = repository({ database });
  assert.equal((await reopened.getById(object.id)).lifecycle.archivedAt, T1);
});

test('portable export is deterministic, round-trips across local owners, and repeat import skips identical IDs', async () => {
  const source = repository({ ownerRef: OTHER_OWNER });
  await source.save(opaqueObject({
    id: 'portable-future-kind',
    ownerRef: OTHER_OWNER,
    kind: 'future_range',
    tags: ['Portable'],
  }));
  const portable = await source.exportLibrary({ exportedAt: T2 });
  const encoded = serializeSavedStudyLibraryExport(portable);
  assert.equal(portable.schemaVersion, SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION);
  assert.deepEqual(parseSavedStudyLibraryExport(encoded), portable);
  assert.equal(encoded, serializeSavedStudyLibraryExport(portable));
  assert.equal('backendSchemaVersion' in portable, false);

  const target = repository();
  const imported = await target.importLibrary(encoded);
  assert.deepEqual(imported, { importedCount: 1, skippedCount: 0, repositoryRevision: 1 });
  const restored = await target.getById('portable-future-kind');
  assert.deepEqual(restored.ownerRef, OWNER);
  assert.equal(restored.kind, 'future_range');
  assert.deepEqual(restored.payload, { schemaVersion: 'future_range/v1', marker: 'portable-future-kind' });
  assert.deepEqual(await target.importLibrary(encoded), {
    importedCount: 0,
    skippedCount: 1,
    repositoryRevision: 1,
  });
  await assert.rejects(
    target.importLibrary(encoded, { ownerPolicy: 'require_match' }),
    /owner does not match/,
  );
});

test('malformed/old envelopes and conflicting imports fail atomically', async () => {
  const target = repository();
  const conflict = opaqueObject({ id: 'portable-conflict', marker: 'durable' });
  await target.save(conflict);
  const before = await target.exportLibrary({ exportedAt: T2 });

  await assert.rejects(target.importLibrary('{not-json'), /not valid JSON/);
  await assert.rejects(target.importLibrary({ schemaVersion: 'saved-study-library-export/v0' }), /export\/v1/);

  const portable = createSavedStudyLibraryExport({
    ownerRef: OWNER,
    exportedAt: T2,
    objects: [
      opaqueObject({ id: 'portable-new', marker: 'would-have-been-new' }),
      opaqueObject({ id: conflict.id, marker: 'different' }),
    ],
  });
  await assert.rejects(target.importLibrary(portable), /ID collision/);
  assert.equal(await target.getById('portable-new'), null);
  assert.deepEqual(await target.exportLibrary({ exportedAt: T2 }), before);
});

test('clean database initialization and future-version seam fail closed', async () => {
  assert.deepEqual(SAVED_STUDY_DATABASE_MIGRATIONS.map((entry) => entry.version), [1]);
  assert.ok(Object.values(SAVED_STUDY_INDEXES).includes('ownerStateUpdatedAt'));
  const clean = repository();
  const cleanStatus = await clean.getRepositoryStatus();
  assert.equal(cleanStatus.backendSchemaVersion, SAVED_STUDY_BACKEND_SCHEMA_VERSION);
  assert.equal(cleanStatus.databaseVersion, SAVED_STUDY_DATABASE_VERSION);
  assert.equal(cleanStatus.domainSchemaVersion, SAVED_STUDY_OBJECT_SCHEMA_VERSION);
  assert.equal(cleanStatus.revision, 0);

  const database = createMemorySavedStudyDatabase();
  await database.runTransaction([SAVED_STUDY_OBJECT_STORES.METADATA], 'readwrite', (transaction) => (
    transaction.put(SAVED_STUDY_OBJECT_STORES.METADATA, {
      key: 'state',
      backendSchemaVersion: 'saved-study-indexeddb/v99',
      databaseVersion: 99,
      domainSchemaVersion: SAVED_STUDY_OBJECT_SCHEMA_VERSION,
      revision: 8,
      ownerRef: OWNER,
      createdAt: T0,
      updatedAt: T1,
    })
  ));
  await assert.rejects(repository({ database }).initialize(), {
    code: 'unsupported_database_version',
  });
  const raw = await database.runTransaction(
    [SAVED_STUDY_OBJECT_STORES.METADATA],
    'readonly',
    (transaction) => transaction.get(SAVED_STUDY_OBJECT_STORES.METADATA, 'state'),
  );
  assert.equal(raw.revision, 8);
});

test('Saved Study subsystem remains isolated from renderer, strategy, Equity, Training, and Personal Strategy schemas', async () => {
  const files = [
    '../app/src/saved-study-objects/domain.mjs',
    '../app/src/saved-study-objects/repository.mjs',
    '../app/src/saved-study-objects/indexeddb-storage.mjs',
    '../app/src/application/saved-study-object-service.mjs',
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  const source = sources.join('\n');
  assert.doesNotMatch(source, /document\.|window\.|HTMLElement|querySelector|StrategyProvider|Equity|training-generator|personal-strategy/u);
  assert.doesNotMatch(source, /riverline-personal-strategy|personal-strategy-(?:store|export)/u);
  assert.match(source, /deriveDecisionContextFromPokerState/);
  assert.match(source, /validatePokerState/);
});

