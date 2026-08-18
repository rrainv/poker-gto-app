import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  CALIBRATION_ENVIRONMENTS,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import {
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  RFI_COLD_START_ANCHORS,
  RFI_QUESTION_SELECTION_POLICY_VERSION,
} from '../app/src/personal-strategy/rfi-question-selection.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function appHarness() {
  const storage = memoryStorage();
  const database = createMemoryPersonalStrategyDatabase({ name: 'range-cal002c-session' });
  let nextId = 0;
  let tick = 0;
  const create = () => createRangeCalibrationApplication({
    storage,
    database,
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(Date.parse('2026-08-18T15:00:00.000Z') + tick++ * 1000),
  });
  return { create, storage, database };
}

async function configured() {
  const harness = appHarness();
  const application = harness.create();
  const bundle = await application.createProfile({
    displayName: 'Adaptive session',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const selection = {
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context: { environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 },
  };
  return { harness, application, bundle, selection };
}

test('adaptive is the default, cold anchors lead, and accepted answers rerank through the 002B snapshot', async () => {
  const { application, selection } = await configured();
  let state = await application.startOrResumeSession(selection);
  assert.equal(state.prompt.handClass, RFI_COLD_START_ANCHORS[0]);
  assert.equal(state.session.cursor.selectionPolicyVersion, RFI_QUESTION_SELECTION_POLICY_VERSION);
  assert.equal(state.prompt.questionValueSemantics, 'deterministic_question_value_not_confidence_or_probability');
  assert.ok(state.questionExplanation.messageKey);
  const revision = state.snapshot.revision;
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  assert.equal(state.snapshot.revision, revision + 1, 'answer and selected cursor stay one atomic commit');
  assert.equal(state.prompt.handClass, RFI_COLD_START_ANCHORS[1]);
  assert.equal(state.personalStrategySnapshot.summary.directlyKnownCount, 1);
  assert.equal(state.progressAssessment.directCount, 1);
});

test('adaptive pause/reconstruction preserves intent/history and recomputes the same next question', async () => {
  const { harness, application, selection } = await configured();
  let state = await application.startOrResumeSession({ ...selection, intent: RFI_CALIBRATION_INTENTS.DEEP });
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.FOLD });
  const expected = state.prompt.handClass;
  const paused = await application.pauseSession(state);
  assert.equal(paused.session.state, 'paused');
  assert.equal(paused.progressAssessment.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_PAUSED);

  const resumed = await harness.create().startOrResumeSession(selection);
  assert.equal(resumed.session.id, state.session.id);
  assert.equal(resumed.session.cursor.calibrationIntent, RFI_CALIBRATION_INTENTS.DEEP);
  assert.deepEqual(resumed.session.cursor.askedHandClasses, state.session.cursor.askedHandClasses);
  assert.equal(resumed.prompt.handClass, expected);
});

test('skip and Not sure are session-only markers, persist across resume, and never create strategy evidence', async () => {
  const { harness, application, selection } = await configured();
  let state = await application.startOrResumeSession(selection);
  const skipped = state.prompt.handClass;
  state = await application.skipCalibrationQuestion(state);
  assert.notEqual(state.prompt.handClass, skipped);
  assert.ok(state.session.cursor.skippedHandClasses.includes(skipped));
  assert.equal((await application.repository.loadSnapshot()).rangeObservations.length, 0);
  const unsure = state.prompt.handClass;
  state = await application.skipCalibrationQuestion(state, { notSure: true });
  assert.ok(state.session.cursor.notSureHandClasses.includes(unsure));
  assert.equal((await application.repository.loadSnapshot()).rangeObservations.length, 0);
  const expected = state.prompt.handClass;
  const resumed = await harness.create().startOrResumeSession(selection);
  assert.equal(resumed.prompt.handClass, expected);
  assert.ok(resumed.session.cursor.skippedHandClasses.includes(skipped));
  assert.doesNotMatch(JSON.stringify(resumed.session), /candidateRanking|questionValueScore/);
});

test('Quick stops truthfully at its deterministic question budget and Ask another grants one question', async () => {
  const { application, selection } = await configured();
  let state = await application.startOrResumeSession({ ...selection, intent: RFI_CALIBRATION_INTENTS.QUICK });
  for (let index = 0; index < 5; index += 1) {
    assert.ok(state.prompt);
    state = await application.answerCalibrationQuestion(state, {
      actionType: index % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE,
    });
  }
  assert.equal(state.prompt, null);
  assert.equal(state.session.state, 'completed');
  assert.equal(state.progressAssessment.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED);
  assert.equal(state.progressAssessment.directCount, 5);
  assert.equal(Object.hasOwn(state.progressAssessment, 'confidence'), false);

  state = await application.requestAdditionalQuestion(state);
  assert.ok(state.prompt);
  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  assert.equal(state.prompt, null);
  assert.equal(state.progressAssessment.directCount, 6);
  assert.equal(state.progressAssessment.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED);
});

test('explicit Stop for now remains resumable without changing any evidence', async () => {
  const { application, selection } = await configured();
  const state = await application.startOrResumeSession(selection);
  const stopped = await application.stopSession(state);
  assert.equal(stopped.session.state, 'paused');
  assert.equal(stopped.progressAssessment.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_STOPPED);
  assert.equal((await application.repository.loadSnapshot()).rangeObservations.length, 0);
});

test('advanced exhaustive mode preserves the canonical all-169 fallback', async () => {
  const { application, selection } = await configured();
  let state = await application.startOrResumeSession({
    ...selection,
    intent: RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
  });
  for (let index = 0; index < PREFLOP_HAND_CLASSES.length; index += 1) {
    assert.equal(state.prompt.handClass, PREFLOP_HAND_CLASSES[index]);
    state = await application.answerCalibrationQuestion(state, {
      actionType: index % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE,
    });
  }
  assert.equal(state.prompt, null);
  assert.equal(state.progressAssessment.stopReason, RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE);
  assert.deepEqual(state.progress, { answered: 169, remaining: 0, total: 169 });
});

