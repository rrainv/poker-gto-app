import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  DIRECT_COMPARISON_RELATIONS,
  PERSONAL_STRATEGY_STORAGE_KEY,
  createLocalOwnerRef,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  createTrainingObservation,
  parsePersonalStrategyExport,
  serializePersonalStrategyExport,
  validateRangeObservation,
} from '../app/src/personal-strategy/index.mjs';

const T0 = '2026-08-14T12:00:00.000Z';
const T1 = '2026-08-14T12:01:00.000Z';
const T2 = '2026-08-14T12:02:00.000Z';
const T3 = '2026-08-14T12:03:00.000Z';
const OWNER = createLocalOwnerRef('truthful-tie-owner');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function context() {
  return createRfiCalibrationContext({
    gameRulesId: 'home/v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  });
}

function observation({ id, dominantAction, frequencies = null, supersedesObservationId = null, createdAt = T1 }) {
  return createRangeObservation({
    id,
    profileId: 'profile-1',
    modeId: 'mode-1',
    context: context(),
    handClass: 'AKs',
    dominantAction,
    frequencies,
    supersedesObservationId,
    createdAt,
  });
}

function configuredRepository(storage, now = T3) {
  const repository = createPersonalStrategyRepository({ storage, ownerRef: OWNER, clock: () => now });
  repository.saveProfileBundle(createStrategyProfileBundle({
    profileId: 'profile-1',
    ownerRef: OWNER,
    displayName: 'Home Game',
    modes: ['Standard', 'Cautious', 'Pressure'],
    modeIds: ['mode-1', 'mode-2', 'mode-3'],
    createdAt: T0,
  }));
  return repository;
}

test('RangeObservation v1 distinguishes quick, pure, unique-dominant, and tied explicit answers', () => {
  const quickRaise = observation({ id: 'quick', dominantAction: { type: ACTION_TYPES.RAISE } });
  const pureRaise = observation({
    id: 'pure',
    dominantAction: { type: ACTION_TYPES.RAISE },
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 0 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 100 },
    ],
  });
  const uniqueRaise = observation({
    id: 'unique',
    dominantAction: { type: ACTION_TYPES.RAISE },
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 25 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 75 },
    ],
  });
  const tied = observation({
    id: 'tied',
    dominantAction: null,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 50 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 50 },
    ],
  });

  assert.deepEqual(quickRaise.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(quickRaise.frequencies, null);
  assert.deepEqual(pureRaise.frequencies, [{ action: { type: ACTION_TYPES.RAISE }, probability: 1 }]);
  assert.deepEqual(uniqueRaise.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(tied.dominantAction, null);
  assert.deepEqual(tied.frequencies.map((entry) => entry.probability), [0.5, 0.5]);
  assert.deepEqual(JSON.parse(JSON.stringify(tied)), tied);
  validateRangeObservation(JSON.parse(JSON.stringify(tied)));

  assert.throws(() => observation({
    id: 'fake-tie',
    dominantAction: { type: ACTION_TYPES.FOLD },
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 50 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 50 },
    ],
  }), /tied explicit.*cannot claim/i);
  assert.throws(() => observation({
    id: 'missing-unique',
    dominantAction: null,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 25 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 75 },
    ],
  }), /dominantAction/);
});

test('repository persists, revises, exports, and imports tied and non-tied mixes', () => {
  const storage = new MemoryStorage();
  const repository = configuredRepository(storage);
  const tied = observation({
    id: 'tie-1', dominantAction: null,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 50 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 50 },
    ],
  });
  const unique = observation({
    id: 'unique-2', dominantAction: { type: ACTION_TYPES.RAISE },
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 25 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 75 },
    ],
    supersedesObservationId: tied.id,
    createdAt: T2,
  });
  repository.saveRangeObservation(tied);
  repository.saveRangeObservation(unique);

  const reopened = createPersonalStrategyRepository({ storage, ownerRef: OWNER, clock: () => T3 });
  assert.equal(reopened.loadSnapshot().rangeObservations[0].dominantAction, null);
  assert.equal(reopened.getCurrentRangeObservation({
    profileId: 'profile-1', modeId: 'mode-1', context: context(), handClass: 'AKs',
  }).id, unique.id);

  const exported = reopened.exportPortable({ exportedAt: T3 });
  const roundTrip = parsePersonalStrategyExport(serializePersonalStrategyExport(exported));
  assert.deepEqual(roundTrip, exported);
  const targetStorage = new MemoryStorage();
  const target = createPersonalStrategyRepository({ storage: targetStorage, ownerRef: OWNER, clock: () => T3 });
  target.importPortable(roundTrip);
  assert.deepEqual(target.loadSnapshot().rangeObservations, reopened.loadSnapshot().rangeObservations);
  assert.ok(targetStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY));
});

test('a tied direct mix has no fabricated Training comparison relation', () => {
  const storage = new MemoryStorage();
  const repository = configuredRepository(storage);
  const tied = observation({
    id: 'tie-training', dominantAction: null,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, weight: 50 },
      { action: { type: ACTION_TYPES.RAISE }, weight: 50 },
    ],
  });
  repository.saveRangeObservation(tied);
  const training = createTrainingObservation({
    id: 'training-1',
    profileId: 'profile-1',
    modeId: 'mode-1',
    context: context(),
    handClass: 'AKs',
    chosenAction: { type: ACTION_TYPES.RAISE },
    trainingExerciseId: 'exercise-1',
    directCalibrationComparison: null,
    createdAt: T2,
  });
  repository.saveTrainingObservation(training);

  assert.throws(() => repository.saveTrainingObservation(createTrainingObservation({
    id: 'training-2',
    profileId: 'profile-1',
    modeId: 'mode-1',
    context: context(),
    handClass: 'AKs',
    chosenAction: { type: ACTION_TYPES.RAISE },
    trainingExerciseId: 'exercise-2',
    directCalibrationComparison: {
      observationId: tied.id,
      relation: DIRECT_COMPARISON_RELATIONS.MATCHES,
    },
    createdAt: T3,
  })), /tied direct mix/);
});
