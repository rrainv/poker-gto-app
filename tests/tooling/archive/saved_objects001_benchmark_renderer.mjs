import {
  SAVED_STUDY_REVIEW_STATES,
  createIndexedDbSavedStudyDatabase,
  createSavedStudyAnnotations,
  createSavedStudyLibraryExport,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
  createSavedStudySource,
  serializeSavedStudyLibraryExport,
} from '../../app/src/saved-study-objects/index.mjs';

const LIBRARY_SIZE = 3_000;
const BASE_TIME = Date.parse('2026-08-16T11:00:00.000Z');
const OWNER = createSavedStudyOwnerRef('saved-objects-benchmark-owner');

function now() {
  return performance.now();
}

function timestamp(index) {
  return new Date(BASE_TIME + index * 1_000).toISOString();
}

function duration(startedAt) {
  return Number((now() - startedAt).toFixed(3));
}

function objectAt(index) {
  return createSavedStudyObject({
    id: `benchmark-saved-${String(index).padStart(5, '0')}`,
    ownerRef: OWNER,
    kind: index % 2 === 0 ? 'benchmark_hand' : 'benchmark_spot',
    createdAt: timestamp(index),
    annotations: createSavedStudyAnnotations({
      tags: index % 8 === 0 ? ['benchmark-tag'] : [],
      reviewState: index % 4 === 0
        ? SAVED_STUDY_REVIEW_STATES.REVIEW_LATER
        : SAVED_STUDY_REVIEW_STATES.NONE,
    }),
    source: createSavedStudySource({ surface: 'benchmark' }),
    payload: { schemaVersion: 'benchmark-snapshot/v1', index, summary: `item-${index}` },
  });
}

async function deleteDatabase(name) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener('success', resolve, { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Benchmark database deletion blocked')), { once: true });
  });
}

async function runBenchmark() {
  const databaseName = `riverline-saved-study-benchmark-${Date.now()}`;
  const clock = () => timestamp(LIBRARY_SIZE + 10);
  const database = createIndexedDbSavedStudyDatabase({ name: databaseName });
  const repo = createSavedStudyRepository({ database, ownerRef: OWNER, clock });
  const activationStartedAt = now();
  await repo.initialize();
  const cleanActivationMs = duration(activationStartedAt);

  const objects = Array.from({ length: LIBRARY_SIZE }, (_, index) => objectAt(index));
  const portable = createSavedStudyLibraryExport({
    ownerRef: OWNER,
    objects,
    exportedAt: timestamp(LIBRARY_SIZE),
  });
  const importStartedAt = now();
  await repo.importLibrary(portable);
  const bulkImportMs = duration(importStartedAt);

  const created = objectAt(LIBRARY_SIZE);
  const createStartedAt = now();
  await repo.save(created);
  const createMs = duration(createStartedAt);

  const updateStartedAt = now();
  await repo.updateAnnotations(objects[777].id, { note: 'bounded benchmark note edit' }, {
    expectedRevision: 1,
    updatedAt: timestamp(LIBRARY_SIZE + 1),
  });
  const updateNoteMs = duration(updateStartedAt);

  const recentStartedAt = now();
  const recent = await repo.listRecent({ limit: 20 });
  const recentQueryMs = duration(recentStartedAt);

  const reviewStartedAt = now();
  const review = await repo.listForReview({ limit: 50 });
  const reviewQueryMs = duration(reviewStartedAt);

  await repo.close();
  const reopenedDatabase = createIndexedDbSavedStudyDatabase({ name: databaseName });
  const reopened = createSavedStudyRepository({ database: reopenedDatabase, ownerRef: OWNER, clock });
  const reopenStartedAt = now();
  await reopened.initialize();
  const populatedActivationMs = duration(reopenStartedAt);

  const exportStartedAt = now();
  const exported = await reopened.exportLibrary({ exportedAt: timestamp(LIBRARY_SIZE + 2) });
  const exportMs = duration(exportStartedAt);
  const exportBytes = new TextEncoder().encode(serializeSavedStudyLibraryExport(exported)).byteLength;
  await reopened.close();
  await deleteDatabase(databaseName);

  return {
    schemaVersion: 'saved-objects001-benchmark/v1',
    adapter: 'Electron Chromium native IndexedDB',
    librarySize: exported.objects.length,
    cleanActivationMs,
    populatedActivationMs,
    bulkImportMs,
    createMs,
    updateNoteMs,
    recentQueryMs,
    recentResultCount: recent.length,
    reviewQueryMs,
    reviewResultCount: review.length,
    exportMs,
    exportBytes,
  };
}

globalThis.savedObjectsBenchmarkPromise = runBenchmark();

