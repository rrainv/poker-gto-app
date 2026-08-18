import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  CALIBRATION_ENVIRONMENTS,
  RANGE_CALIBRATION_QUESTION_ORDER,
  RFI_CALIBRATION_ACTIONS,
  createRangeCalibrationApplication,
  normalizeRfiMix,
} from '../app/src/application/range-calibration-service.mjs';
import {
  PERSONAL_STRATEGY_STORAGE_KEY,
  PersonalStrategyStorageError,
  createMemoryPersonalStrategyDatabase,
} from '../app/src/personal-strategy/index.mjs';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.writes = [];
    this.failNextPersonalWrite = false;
    this.database = createMemoryPersonalStrategyDatabase();
  }

  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }

  setItem(key, value) {
    if (key === PERSONAL_STRATEGY_STORAGE_KEY && this.failNextPersonalWrite) {
      this.failNextPersonalWrite = false;
      throw new Error('synthetic quota failure');
    }
    this.writes.push({ key, value: String(value) });
    this.values.set(key, String(value));
  }
}

function idFactory() {
  let next = 0;
  return (prefix) => `${prefix}-${++next}`;
}

function applicationFor(storage) {
  let tick = 0;
  return createRangeCalibrationApplication({
    storage,
    database: storage.database,
    idFactory: idFactory(),
    clock: () => new Date(Date.parse('2026-08-14T10:00:00.000Z') + tick++ * 1000),
  });
}

async function createConfiguredApplication(storage = new MemoryStorage()) {
  const application = applicationFor(storage);
  const bundle = await application.createProfile({
    displayName: 'Home Game',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const selection = {
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context: { environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 },
    intent: 'exhaustive',
  };
  return { application, bundle, selection, storage };
}

test('RFI question policy is the canonical deterministic 169-cell row-major order with only Fold and Raise', () => {
  assert.equal(RANGE_CALIBRATION_QUESTION_ORDER, PREFLOP_HAND_CLASSES);
  assert.equal(RANGE_CALIBRATION_QUESTION_ORDER.length, 169);
  assert.deepEqual(RANGE_CALIBRATION_QUESTION_ORDER.slice(0, 5), ['AA', 'AKs', 'AQs', 'AJs', 'ATs']);
  assert.deepEqual(RFI_CALIBRATION_ACTIONS.map((entry) => entry.type), [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
});

test('session start, atomic quick answer, pause, and reconstruction resume the same next unanswered hand', async () => {
  const { application, selection, storage } = await createConfiguredApplication();
  let state = await application.startOrResumeSession(selection);
  assert.equal(state.session.state, 'active');
  assert.equal(state.prompt.handClass, 'AA');
  assert.deepEqual(state.progress, { answered: 0, remaining: 169, total: 169 });

  const revisionBefore = state.snapshot.revision;
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  assert.equal(state.snapshot.revision, revisionBefore + 1, 'observation and cursor use one database transaction');
  assert.equal(state.acceptedObservation.dominantAction.type, ACTION_TYPES.RAISE);
  assert.equal(state.acceptedObservation.hasExplicitFrequencies, false);
  assert.equal(state.acceptedObservation.frequencies, null);
  assert.equal(state.prompt.handClass, 'AKs');
  assert.deepEqual(state.progress, { answered: 1, remaining: 168, total: 169 });
  assert.deepEqual(state.session.observationIds, [state.acceptedObservation.id]);

  const paused = await application.pauseSession(state);
  assert.equal(paused.session.state, 'paused');
  const reconstructed = await applicationFor(storage).startOrResumeSession(selection);
  assert.equal(reconstructed.session.id, state.session.id);
  assert.equal(reconstructed.session.state, 'active');
  assert.equal(reconstructed.prompt.handClass, 'AKs');
});

test('explicit mixes preserve pure and unique-dominant semantics without fabricating a 50/50 dominant action', async () => {
  assert.throws(() => normalizeRfiMix({ fold: 25, raise: 70 }), /total 100/);
  assert.deepEqual(normalizeRfiMix({ fold: 25, raise: 75 }).dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(normalizeRfiMix({ fold: 50, raise: 50 }).dominantAction, null);
  const { application, selection } = await createConfiguredApplication();
  let state = await application.startOrResumeSession(selection);
  state = await application.answerCalibrationQuestion(state, { mix: { fold: 0, raise: 100 } });
  assert.equal(state.acceptedObservation.dominantAction.type, ACTION_TYPES.RAISE);
  assert.equal(state.acceptedObservation.hasExplicitFrequencies, true);
  assert.deepEqual(state.acceptedObservation.frequencies, [
    { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
  ]);

  state = await application.answerCalibrationQuestion(state, { mix: { fold: 50, raise: 50 } });
  assert.equal(state.acceptedObservation.dominantAction, null);
  assert.deepEqual(state.acceptedObservation.frequencies, [
    { action: { type: ACTION_TYPES.FOLD }, probability: 0.5 },
    { action: { type: ACTION_TYPES.RAISE }, probability: 0.5 },
  ]);
});

test('undo appends a retraction, restores the hand, and leaves the audit chain intact', async () => {
  const { application, selection } = await createConfiguredApplication();
  let state = await application.startOrResumeSession(selection);
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.FOLD });
  const answeredId = state.acceptedObservation.id;
  state = await application.undoPreviousAnswer(state);
  assert.equal(state.prompt.handClass, 'AA');
  assert.deepEqual(state.progress, { answered: 0, remaining: 169, total: 169 });
  assert.equal((await application.repository.loadSnapshot()).rangeObservations.length, 2);
  const retraction = state.snapshot.rangeObservations.at(-1);
  assert.equal(retraction.state, 'retracted');
  assert.equal(retraction.revision.supersedesObservationId, answeredId);
  assert.equal(state.session.observationIds.at(-1), retraction.id);
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  assert.equal((await application.repository.loadSnapshot()).rangeObservations.length, 3);
  assert.equal(state.acceptedObservation.revision.supersedesObservationId, retraction.id);
  assert.equal(state.progress.answered, 1);
  assert.equal(state.prompt.handClass, 'AKs');
});

test('a persistence failure does not advance the durable session or the presented state', async () => {
  const { application, selection, storage } = await createConfiguredApplication();
  const state = await application.startOrResumeSession(selection);
  const durableBefore = await application.repository.loadSnapshot();
  storage.database.failNextTransaction('before_commit', new Error('synthetic quota failure'));
  await assert.rejects(
    application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE }),
    (error) => error instanceof PersonalStrategyStorageError && error.code === 'transaction_failed',
  );
  assert.deepEqual(await application.repository.loadSnapshot(), durableBefore);
  assert.equal(state.prompt.handClass, 'AA');
  assert.equal(state.progress.answered, 0);
});

test('169 accepted direct answers complete the session without a 170th prompt', async () => {
  const { application, selection } = await createConfiguredApplication();
  let state = await application.startOrResumeSession(selection);
  for (let index = 0; index < 169; index += 1) {
    assert.equal(state.prompt.handClass, PREFLOP_HAND_CLASSES[index]);
    state = await application.answerCalibrationQuestion(state, {
      actionType: index % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE,
    });
  }
  assert.equal(state.prompt, null);
  assert.equal(state.session.state, 'completed');
  assert.deepEqual(state.progress, { answered: 169, remaining: 0, total: 169 });
  await assert.rejects(
    application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE }),
    /not accepting answers/,
  );
});
