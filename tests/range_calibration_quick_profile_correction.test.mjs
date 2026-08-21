import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION,
  complementaryRfiMixFromFold,
  createRangeCalibrationApplication,
  normalizeRfiMix,
} from '../app/src/application/range-calibration-service.mjs';
import { createPersonalStrategyScopeLifecycle } from '../app/src/application/personal-strategy-scope-lifecycle.mjs';
import { createRfiCalibrationContext } from '../app/src/personal-strategy/domain.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { representativeCardsForHandClass } from '../app/src/ui/representative-hand-cards.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

let applicationSequence = 0;
async function configuredApplication() {
  applicationSequence += 1;
  let nextId = 0;
  let tick = 0;
  const application = createRangeCalibrationApplication({
    storage: new MemoryStorage(),
    database: createMemoryPersonalStrategyDatabase({
      name: `quick-profile-correction-${applicationSequence}`,
    }),
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(Date.parse('2026-08-22T08:00:00.000Z') + tick++ * 1000),
  });
  const bundle = await application.createProfile({
    displayName: 'Quick profile correction',
    description: '',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const selection = {
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context: {
      environment: 'home',
      tableSize: 6,
      heroPosition: 'BTN',
      effectiveStackBb: 100,
    },
  };
  return { application, bundle, selection };
}

test('one RFI slider value always creates a complementary valid distribution including pure boundaries', () => {
  for (const fold of [0, 25, 50, 75, 100]) {
    const mix = complementaryRfiMixFromFold(fold);
    assert.equal(mix.fold, fold);
    assert.equal(mix.raise, 100 - fold);
    assert.equal(mix.fold + mix.raise, 100);
    assert.doesNotThrow(() => normalizeRfiMix(mix));
  }
  assert.deepEqual(complementaryRfiMixFromFold(0), { fold: 0, raise: 100 });
  assert.deepEqual(complementaryRfiMixFromFold(100), { fold: 100, raise: 0 });
  assert.deepEqual(complementaryRfiMixFromFold(33.333333), {
    fold: 33.333333,
    raise: 66.666667,
  });
});

test('malformed non-100 exact distributions are bounded and zero-write for question and Matrix sources', async () => {
  const { application, selection } = await configuredApplication();
  const state = await application.startOrResumeSession(selection);
  const before = await application.repository.loadSnapshot();

  await assert.rejects(
    application.answerCalibrationQuestion(state, { mix: { fold: 40, raise: 40 } }),
    (error) => error.code === RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION,
  );
  await assert.rejects(
    application.recordPersonalStrategyMatrixEvidence(state, {
      profileId: state.session.profileId,
      modeId: state.session.modeId,
      context: state.session.contextScope,
      handClass: state.prompt.handClass,
      mix: { fold: 70, raise: 20 },
    }),
    (error) => error.code === RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION,
  );

  assert.deepEqual(await application.repository.loadSnapshot(), before);
  assert.equal(state.prompt.handClass, 'AA');
  assert.equal(state.progress.answered, 0);
});

test('an existing exact mix initializes and round-trips through the complementary slider model', async () => {
  const { application, selection } = await configuredApplication();
  let state = await application.startOrResumeSession(selection);
  const handClass = state.prompt.handClass;
  state = await application.answerCalibrationQuestion(state, {
    mix: complementaryRfiMixFromFold(25),
  });
  const cell = state.personalStrategyMatrixProjection.cells
    .find((entry) => entry.handClass === handClass);
  const percentages = Object.fromEntries(cell.action.exactFrequencies.map((entry) => [
    entry.action.type,
    entry.probability * 100,
  ]));
  const sliderMix = complementaryRfiMixFromFold(percentages.fold ?? 0);
  assert.deepEqual(sliderMix, { fold: 25, raise: 75 });
  assert.deepEqual(normalizeRfiMix(sliderMix).frequencies.map((entry) => entry.probability), [25, 75]);
});

test('Matrix selection is a one-shot current-question override and adaptive selection resumes after answer', async () => {
  const { application, selection } = await configuredApplication();
  let state = await application.startOrResumeSession(selection);
  const adaptiveHand = state.prompt.handClass;
  const evidenceBefore = state.snapshot.rangeObservations.length;

  state = await application.requestPersonalStrategyMatrixQuestion(state, 'J4s');
  assert.equal(state.prompt.handClass, 'J4s');
  assert.equal(state.prompt.questionKind, 'user_directed_matrix');
  assert.equal(state.questionExplanation.messageKey, 'Selected from your Matrix');
  assert.equal(state.session.cursor.userDirectedHandClass, 'J4s');
  assert.equal(state.snapshot.rangeObservations.length, evidenceBefore, 'selection must not fabricate evidence');

  state = await application.answerCalibrationQuestion(state, { actionType: 'fold' });
  assert.equal(state.acceptedObservation.handClass, 'J4s');
  assert.equal(state.session.cursor.userDirectedHandClass, null);
  assert.equal(state.prompt.handClass, adaptiveHand);
  assert.notEqual(state.prompt.questionKind, 'user_directed_matrix');

  const evidenceAfterAnswer = state.snapshot.rangeObservations.length;
  state = await application.requestPersonalStrategyMatrixQuestion(state, 'J4s');
  assert.equal(state.prompt.handClass, 'J4s', 'an answered Matrix hand remains revisitable');
  assert.equal(state.snapshot.rangeObservations.length, evidenceAfterAnswer);
  state = await application.skipCalibrationQuestion(state, { notSure: true });
  assert.equal(state.skippedQuestion.handClass, 'J4s');
  assert.equal(state.skippedQuestion.reason, 'not_sure');
  assert.equal(state.session.cursor.userDirectedHandClass, null);
  assert.notEqual(state.prompt?.handClass, 'J4s');
});

test('a scope switch invalidates a pending Matrix override adoption path', () => {
  let currentQuestion = 'AA';
  const lifecycle = createPersonalStrategyScopeLifecycle({
    onInvalidate() { currentQuestion = null; },
  });
  const context = createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
  });
  const scopeA = { profileId: 'a', modeId: 'normal', context };
  const scopeB = { profileId: 'b', modeId: 'normal', context };
  lifecycle.activate(scopeA);
  currentQuestion = 'J4s';
  const pendingOverride = lifecycle.capture(scopeA);
  lifecycle.activate(scopeB);
  assert.equal(currentQuestion, null);
  assert.equal(lifecycle.isCurrent(pendingOverride, scopeA), false);
});

test('representative suited, offsuit, and pair cards are stable and preserve canonical identity', async () => {
  assert.deepEqual(
    representativeCardsForHandClass('J4s').cards.map((card) => card.id),
    ['Js', '4s'],
  );
  assert.deepEqual(
    representativeCardsForHandClass('K7o').cards.map((card) => card.id),
    ['Ks', '7h'],
  );
  assert.deepEqual(
    representativeCardsForHandClass('88').cards.map((card) => card.id),
    ['8s', '8h'],
  );
  assert.deepEqual(representativeCardsForHandClass('J4s'), representativeCardsForHandClass('J4s'));

  const { application, selection } = await configuredApplication();
  let state = await application.startOrResumeSession(selection);
  state = await application.requestPersonalStrategyMatrixQuestion(state, 'J4s');
  const contextBefore = state.session.contextScope;
  state = await application.answerCalibrationQuestion(state, { actionType: 'raise' });
  assert.equal(state.acceptedObservation.handClass, 'J4s');
  assert.deepEqual(state.acceptedObservation.context, contextBefore);
  assert.equal(Object.hasOwn(state.acceptedObservation, 'cards'), false);
  assert.equal(Object.hasOwn(state.acceptedObservation, 'suits'), false);
});

test('workspace routes Matrix cell activation through the guarded user-directed question flow', async () => {
  const source = await readFile(
    new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /selectMatrixHand\(cell\.dataset\.handClass\);\s*void askSelectedMatrixHandNext\(cell\.dataset\.handClass\)/);
  assert.match(source, /beginPersonalStrategyMutation\(scope\)[\s\S]*?requestPersonalStrategyMatrixQuestion[\s\S]*?personalStrategyScopeLifecycle\.isCurrent/);
  assert.match(source, /matrixFollowQuestion = true;\s*renderQuestion\(\)/);
});
