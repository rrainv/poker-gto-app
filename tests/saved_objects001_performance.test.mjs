import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_REVIEW_STATES,
  createMemorySavedStudyDatabase,
  createSavedStudyAnnotations,
  createSavedStudyLibraryExport,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
  createSavedStudySource,
} from '../app/src/saved-study-objects/index.mjs';

const OWNER = createSavedStudyOwnerRef('saved-objects-performance-owner');
const BASE_TIME = Date.parse('2026-08-16T10:00:00.000Z');
const LIBRARY_SIZE = 2_000;

function timestamp(index) {
  return new Date(BASE_TIME + index * 1_000).toISOString();
}

function objectAt(index) {
  const review = index % 4 === 0;
  return createSavedStudyObject({
    id: `perf-saved-${String(index).padStart(5, '0')}`,
    ownerRef: OWNER,
    kind: index % 2 === 0 ? 'future_hand_summary' : 'future_spot_summary',
    createdAt: timestamp(index),
    annotations: createSavedStudyAnnotations({
      tags: index % 10 === 0 ? ['benchmark-tag'] : [],
      reviewState: review
        ? SAVED_STUDY_REVIEW_STATES.REVIEW_LATER
        : SAVED_STUDY_REVIEW_STATES.NONE,
      classifications: index % 20 === 0 ? [SAVED_STUDY_CLASSIFICATIONS.MISTAKE] : [],
    }),
    source: createSavedStudySource({ surface: 'benchmark' }),
    payload: { schemaVersion: 'benchmark-payload/v1', index },
  });
}

test('meaningful library uses bounded indexed recent/review reads and one-record note updates', async () => {
  const database = createMemorySavedStudyDatabase();
  const repo = createSavedStudyRepository({
    database,
    ownerRef: OWNER,
    clock: () => timestamp(LIBRARY_SIZE + 2),
  });
  const objects = Array.from({ length: LIBRARY_SIZE }, (_, index) => objectAt(index));
  await repo.importLibrary(createSavedStudyLibraryExport({
    ownerRef: OWNER,
    objects,
    exportedAt: timestamp(LIBRARY_SIZE),
  }));

  const beforeRecent = database.getMetrics();
  const recent = await repo.listRecent({ limit: 20 });
  const afterRecent = database.getMetrics();
  assert.equal(recent.length, 20);
  assert.equal(recent[0].id, `perf-saved-${String(LIBRARY_SIZE - 1).padStart(5, '0')}`);
  assert.equal(afterRecent.indexRecordsReturned - beforeRecent.indexRecordsReturned, 20);

  const beforeReview = database.getMetrics();
  const review = await repo.listForReview({ limit: 25 });
  const afterReview = database.getMetrics();
  assert.equal(review.length, 25);
  assert.equal(afterReview.indexRecordsReturned - beforeReview.indexRecordsReturned, 25);

  const beforeUpdate = database.getMetrics();
  const updated = await repo.updateAnnotations(objects[777].id, { note: 'isolated edit' }, {
    expectedRevision: 1,
    updatedAt: timestamp(LIBRARY_SIZE + 1),
  });
  const afterUpdate = database.getMetrics();
  assert.equal(updated.object.annotations.note, 'isolated edit');
  assert.equal(afterUpdate.recordsWritten - beforeUpdate.recordsWritten, 2);
  assert.equal((await repo.exportLibrary({ exportedAt: timestamp(LIBRARY_SIZE + 2) })).objects.length, LIBRARY_SIZE);
});

