import test from 'node:test';
import assert from 'node:assert/strict';

import { createTutorialDefinition } from '../app/src/tutorial/domain.mjs';
import {
  TUTORIAL_PREFERENCES_SCHEMA_VERSION,
  TUTORIAL_PREFERENCES_STORAGE_KEY,
  createTutorialPersistence,
} from '../app/src/tutorial/persistence.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function definition(version = 1) {
  return createTutorialDefinition({
    id: 'home.tour', version, workspace: 'home', titleKey: 'Title', descriptionKey: 'Description',
    firstUsePolicy: 'prompt', restartPolicy: 'always',
    steps: [
      { id: 'one', anchor: 'home-one', titleKey: 'One', bodyKey: 'One body' },
      { id: 'two', anchor: 'home-two', titleKey: 'Two', bodyKey: 'Two body' },
    ],
  });
}

test('completion and skip persist per tutorial ID and version without repeated offers', () => {
  const storage = new MemoryStorage();
  const persistence = createTutorialPersistence({ storage, clock: () => '2026-08-16T10:00:00.000Z' });
  const completed = definition(1);
  assert.equal(persistence.shouldOffer(completed), true);
  persistence.begin(completed);
  persistence.progress(completed, 'two');
  persistence.complete(completed);
  assert.equal(persistence.getRecord(completed).firstUseStatus, 'completed');
  assert.equal(persistence.shouldOffer(completed), false);

  const skipped = createTutorialDefinition({ ...definition(1), id: 'home.second-tour' });
  persistence.skip(skipped);
  assert.equal(persistence.getRecord(skipped).firstUseStatus, 'skipped');
  assert.equal(persistence.shouldOffer(skipped), false);
});

test('a version bump is offerable while earlier version history remains intact', () => {
  const persistence = createTutorialPersistence({ storage: new MemoryStorage() });
  const v1 = definition(1);
  const v2 = definition(2);
  persistence.complete(v1);
  assert.equal(persistence.shouldOffer(v1), false);
  assert.equal(persistence.shouldOffer(v2), true);
  persistence.begin(v2);
  const snapshot = persistence.snapshot();
  assert.equal(snapshot.schemaVersion, TUTORIAL_PREFERENCES_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(snapshot.tutorials['home.tour'].versions).sort(), ['1', '2']);
});

test('resume retains the last step and manual replay does not erase a terminal first-use decision', () => {
  const persistence = createTutorialPersistence({ storage: new MemoryStorage() });
  const tour = definition();
  persistence.begin(tour);
  persistence.progress(tour, 'two');
  assert.equal(persistence.getRecord(tour).lastStepId, 'two');
  persistence.complete(tour);
  persistence.begin(tour, { manualRestart: true, stepId: 'one' });
  persistence.skip(tour);
  const record = persistence.getRecord(tour);
  assert.equal(record.firstUseStatus, 'completed');
  assert.equal(record.lastRunStatus, 'skipped');
});

test('invalid or unavailable Web Storage recovers to a safe local preference state', () => {
  const storage = new MemoryStorage();
  storage.setItem(TUTORIAL_PREFERENCES_STORAGE_KEY, '{broken');
  const persistence = createTutorialPersistence({ storage });
  assert.equal(persistence.shouldOffer(definition()), true);
  assert.equal(persistence.diagnostics().recoveredInvalidState, true);
  assert.doesNotThrow(() => persistence.begin(definition()));
});

