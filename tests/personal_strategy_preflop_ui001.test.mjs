import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  CALIBRATION_ENVIRONMENTS,
  PREFLOP_CALIBRATION_DECISION_FAMILIES,
  createCanonicalPreflopContextFromSelection,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import {
  openCalibrationProfileReview,
  rebalanceCalibrationMixPercentages,
} from '../app/src/application/range-calibration-workspace.mjs';
import { createPersonalStrategyScopeLifecycle } from '../app/src/application/personal-strategy-scope-lifecycle.mjs';
import { rangeCal002bFixtureById } from './fixtures/range_cal002b_synthetic_truth.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

async function configured() {
  let id = 0;
  let tick = 0;
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name: 'personal-strategy-preflop-ui001' }),
    idFactory: (prefix) => `${prefix}-${++id}`,
    clock: () => new Date(Date.parse('2026-08-22T10:00:00.000Z') + tick++ * 1000),
  });
  const bundle = await application.createProfile({
    displayName: 'Preflop families',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  return {
    application,
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
  };
}

function selection(decisionFamily, heroPosition = decisionFamily === 'preflop_bb_option' ? 'BB' : 'BTN') {
  return {
    environment: 'home',
    tableSize: 6,
    heroPosition,
    effectiveStackBb: 100,
    decisionFamily,
    actionAware: true,
  };
}

test('all bounded preflop families derive canonical facts and contextual legal actions', () => {
  const contexts = PREFLOP_CALIBRATION_DECISION_FAMILIES.map((decisionFamily) => (
    createCanonicalPreflopContextFromSelection(selection(decisionFamily))
  ));
  assert.deepEqual(contexts.map((context) => context.decisionFamily), PREFLOP_CALIBRATION_DECISION_FAMILIES);
  assert.deepEqual(contexts[0].legalActions.map((action) => action.type), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.deepEqual(contexts[2].legalActions.map((action) => action.type), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.deepEqual(contexts[5].legalActions.map((action) => action.type), [
    ACTION_TYPES.CHECK, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  assert.equal(contexts[2].priorAction.lastAggression.level, 'open');
  assert.equal(contexts[3].priorAction.lastAggression.level, 'three_bet');
  assert.equal(contexts[4].priorAction.lastAggression.level, 'four_bet');
  for (const context of contexts.slice(2, 5)) {
    assert.ok(context.facing.sizeBb > 0);
    assert.ok(context.facing.callAmountBb > 0);
  }
  assert.equal(contexts[5].facing.callAmountBb, 0);
});

test('multi-action editor rebalances every edit to a valid 100 percent distribution', () => {
  let values = { fold: 25, call: 25, raise: 25, all_in: 25 };
  values = rebalanceCalibrationMixPercentages(values, 'call', 70);
  assert.equal(Object.values(values).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(values.call, 70);
  values = rebalanceCalibrationMixPercentages(values, 'all_in', 100);
  assert.deepEqual(values, { fold: 0, call: 0, raise: 0, all_in: 100 });
  values = rebalanceCalibrationMixPercentages(values, 'fold', 40);
  assert.deepEqual(values, { fold: 40, call: 0, raise: 0, all_in: 60 });
  assert.equal(Object.values(values).reduce((sum, value) => sum + value, 0), 100);
  for (const [action, value] of [
    ['raise', 33.333333], ['call', 77.777777], ['fold', 1], ['all_in', 0],
  ]) {
    values = rebalanceCalibrationMixPercentages(values, action, value);
    assert.ok(Math.abs(Object.values(values).reduce((sum, entry) => sum + entry, 0) - 100) < 1e-9);
  }
});

test('Review profile leaves the checkpoint and opens the existing Matrix surface', async () => {
  const workspaceSource = await readFile(
    new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    workspaceSource,
    /#calibrationCompleteOpenMatrix'[\s\S]*?void reviewCompletedProfile\(\)/,
  );
  const effects = [];
  const reviewed = await openCalibrationProfileReview({
    leaveCheckpoint: async (options) => {
      effects.push(['leave', options]);
      return true;
    },
    openMatrix: async (view) => { effects.push(['open', view]); },
    matrixPanel: {
      scrollIntoView(options) { effects.push(['scroll', options]); },
    },
    matrixTab: {
      focus(options) { effects.push(['focus', options]); },
    },
  });
  assert.equal(reviewed, true);
  assert.deepEqual(effects, [
    ['leave', { restoreFocus: false }],
    ['open', 'matrix'],
    ['scroll', { block: 'start' }],
    ['focus', { preventScroll: true }],
  ]);

  effects.length = 0;
  const failed = await openCalibrationProfileReview({
    leaveCheckpoint: async () => false,
    openMatrix: async () => { effects.push(['open']); },
  });
  assert.equal(failed, false);
  assert.deepEqual(effects, []);
});

test('decision-family scope changes reject stale presentation results', () => {
  const lifecycle = createPersonalStrategyScopeLifecycle();
  const base = { profileId: 'profile-1', modeId: 'mode-1' };
  const facingOpen = {
    ...base,
    context: createCanonicalPreflopContextFromSelection(selection('preflop_facing_open')),
  };
  const facingThreeBet = {
    ...base,
    context: createCanonicalPreflopContextFromSelection(selection('preflop_facing_3bet')),
  };
  lifecycle.activate(facingOpen);
  const stale = lifecycle.capture(facingOpen);
  lifecycle.activate(facingThreeBet);
  assert.equal(lifecycle.isCurrent(stale, facingThreeBet), false);
});

test('sparse action-aware First-in answers reuse adaptive RFI inference without fabricating extra-action mixes', async () => {
  const configuredApp = await configured();
  const fixture = rangeCal002bFixtureById('smooth-tight');
  let state = await configuredApp.application.startOrResumeSession({
    ...configuredApp,
    context: selection('preflop_rfi'),
    intent: 'standard',
  });
  assert.equal(state.projectionMode, 'first_in_rfi_subspace');
  const asked = [];
  const modeledAfterAnswer = [];
  while (state.prompt && asked.length < 20) {
    const handClass = state.prompt.handClass;
    asked.push(handClass);
    state = await configuredApp.application.answerCalibrationQuestion(state, {
      actionType: fixture.labels[handClass],
    });
    modeledAfterAnswer.push(state.progressAssessment.modeledHandCount);
  }
  assert.ok(asked.length >= 15 && asked.length <= 20);
  assert.ok(modeledAfterAnswer[2] > 0);
  assert.notDeepEqual(asked, [...asked].sort((left, right) => (
    state.personalStrategyMatrixProjection.cells.findIndex((cell) => cell.handClass === left)
      - state.personalStrategyMatrixProjection.cells.findIndex((cell) => cell.handClass === right)
  )));
  assert.ok(state.progressAssessment.modeledHandCount > 0);
  assert.ok(state.personalStrategyMatrixProjection.summary.inferredHighCount
    + state.personalStrategyMatrixProjection.summary.inferredMediumCount > 0);
  assert.ok(state.personalStrategyMatrixProjection.summary.unknownCount
    < 169 - state.personalStrategyMatrixProjection.summary.directlyKnownCount);
  const inferred = state.personalStrategyMatrixProjection.cells.find((cell) => (
    cell.status === 'inferred_high' || cell.status === 'inferred_medium'
  ));
  assert.ok(inferred);
  assert.ok([ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(inferred.action.dominantAction));
  assert.equal(inferred.action.exactFrequencies, null);
  assert.ok(inferred.reasons.includes('additional_first_in_actions_unmodeled'));
  assert.equal(state.progressAssessment.profileReadiness.inferenceAvailable, true);
  assert.deepEqual(state.progressAssessment.profileReadiness.unmodeledActions, [
    ACTION_TYPES.CALL, ACTION_TYPES.ALL_IN,
  ]);

  state = await configuredApp.application.requestPersonalStrategyMatrixQuestion(
    state,
    inferred.handClass,
  );
  state = await configuredApp.application.answerCalibrationQuestion(state, {
    actionType: ACTION_TYPES.CALL,
  });
  const corrected = state.personalStrategyMatrixProjection.cells.find((cell) => (
    cell.handClass === inferred.handClass
  ));
  assert.equal(corrected.status, 'directly_known');
  assert.equal(corrected.action.dominantAction, ACTION_TYPES.CALL);
  assert.equal(corrected.action.exactFrequencies, null);
  assert.equal(state.candidateRanking.some((candidate) => (
    candidate.handClass === inferred.handClass
  )), false);
});

test('action-aware family sessions store direct canonical actions and exact multi-action mixes', async () => {
  const configuredApp = await configured();
  let state = await configuredApp.application.startOrResumeSession({
    ...configuredApp,
    context: selection('preflop_facing_open'),
    intent: 'quick',
  });
  assert.equal(state.projectionMode, 'direct_only');
  assert.equal(state.progressAssessment.profileReadiness.inferenceAvailable, false);
  assert.deepEqual(state.availableActions.map((action) => action.type), [
    ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN,
  ]);
  const firstHand = state.prompt.handClass;
  state = await configuredApp.application.answerCalibrationQuestion(state, {
    actionType: ACTION_TYPES.CALL,
  });
  assert.equal(state.personalStrategyMatrixProjection.scope.context.decisionFamily, 'preflop_facing_open');
  assert.equal(
    state.personalStrategyMatrixProjection.cells.find((cell) => cell.handClass === firstHand)
      .action.dominantAction,
    ACTION_TYPES.CALL,
  );
  const mixedHand = state.prompt.handClass;
  state = await configuredApp.application.answerCalibrationQuestion(state, {
    mix: [
      { action: { type: ACTION_TYPES.FOLD }, probability: 0.1 },
      { action: { type: ACTION_TYPES.CALL }, probability: 0.2 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.3 },
      { action: { type: ACTION_TYPES.ALL_IN }, probability: 0.4 },
    ],
  });
  const mixed = state.personalStrategyMatrixProjection.cells.find((cell) => cell.handClass === mixedHand);
  assert.equal(mixed.action.exactFrequencies.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.equal(mixed.action.dominantAction, ACTION_TYPES.ALL_IN);
  assert.equal(state.rangeTeacherView.scope.context.decisionFamily, 'preflop_facing_open');

  state = await configuredApp.application.requestPersonalStrategyMatrixQuestion(state, firstHand);
  assert.equal(state.prompt.handClass, firstHand);
  state = await configuredApp.application.answerCalibrationQuestion(state, {
    actionType: ACTION_TYPES.RAISE,
  });
  assert.equal(
    state.personalStrategyMatrixProjection.cells.find((cell) => cell.handClass === firstHand)
      .action.dominantAction,
    ACTION_TYPES.RAISE,
  );
  state = await configuredApp.application.undoPreviousAnswer(state);
  assert.equal(state.projectionMode, 'direct_only');
  assert.equal(state.prompt.handClass, firstHand);
  state = await configuredApp.application.skipCalibrationQuestion(state, { notSure: true });
  assert.equal(state.projectionMode, 'direct_only');
  assert.notEqual(state.prompt.handClass, firstHand);

  const profileId = state.session.profileId;
  const modeId = state.session.modeId;
  state = await configuredApp.application.switchCalibrationContext(state, {
    context: selection('preflop_facing_3bet'),
    reasonKey: 'Checking whether your range differs in this context.',
  });
  assert.equal(state.contextTransition.kind, 'automatic');
  assert.equal(state.contextTransition.toSelection.decisionFamily, 'preflop_facing_3bet');
  assert.equal(state.session.profileId, profileId);
  assert.equal(state.session.modeId, modeId);
  assert.equal(state.session.contextScope.decisionFamily, 'preflop_facing_3bet');
  assert.equal(state.personalStrategyMatrixProjection.scope.context.decisionFamily, 'preflop_facing_3bet');
  assert.equal(state.rangeTeacherView.scope.context.decisionFamily, 'preflop_facing_3bet');
  assert.equal(state.progressAssessment.profileReadiness.inferenceAvailable, false);
});

test('legacy Fold/Raise RFI remains on its compatibility path', async () => {
  const configuredApp = await configured();
  const legacySelection = {
    environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  };
  let state = await configuredApp.application.startOrResumeSession({
    ...configuredApp,
    context: legacySelection,
  });
  assert.equal(state.projectionMode, 'rfi_inference');
  assert.deepEqual(state.availableActions.map((action) => action.type), [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
  const handClass = state.prompt.handClass;
  state = await configuredApp.application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.FOLD });
  assert.equal(state.personalStrategySnapshot.estimates.find((estimate) => estimate.handClass === handClass).status, 'directly_known');
  const expanded = await configuredApp.application.startOrResumeSession({
    ...configuredApp,
    context: selection('preflop_rfi'),
  });
  const preserved = expanded.personalStrategyMatrixProjection.cells.find((cell) => (
    cell.handClass === handClass
  ));
  assert.equal(expanded.projectionMode, 'first_in_rfi_subspace');
  assert.equal(preserved.status, 'directly_known');
  assert.equal(preserved.action.dominantAction, ACTION_TYPES.FOLD);
  assert.equal(expanded.candidateRanking.some((candidate) => candidate.handClass === handClass), false);
});

test('workspace exposes family selection, a balanced responsive action row, and contextual EN/RU/HE copy', async () => {
  const [html, workspace, translations, styles] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  ]);
  for (const family of PREFLOP_CALIBRATION_DECISION_FAMILIES) {
    assert.match(html, new RegExp(`value="${family}"`));
  }
  assert.match(html, /id="calibrationContextChanged"/);
  assert.match(html, /id="calibrationContextFacts"/);
  assert.match(html, /id="calibrationQuestionContextFacts"/);
  assert.match(html, /id="calibrationActionGrid"/);
  assert.match(html, /id="calibrationMatrixActionLegend"/);
  assert.match(html, /id="calibrationMultiMix"/);
  assert.match(workspace, /actionType === 'call'[\s\S]*PREFLOP_RFI[\s\S]*'Limp'/);
  assert.match(workspace, /heroPosition === 'SB' \? 'Complete' : 'Limp'/);
  assert.match(workspace, /setMultiMixValue/);
  assert.match(workspace, /application\.switchCalibrationContext/);
  assert.match(workspace, /--calibration-action-count/);
  assert.match(styles, /grid-template-columns: repeat\(var\(--calibration-action-count, 2\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container calibration-question \(max-width: 520px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@container calibration-question \(max-width: 330px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /\.calibration-action-grid[^}]*auto-fit/);
  for (const key of [
    'First in / Unopened pot', 'Facing open', 'Facing 3-bet', 'Facing 4-bet',
    'BB option', 'Limp', 'Complete', 'Context changed',
    'Fold/Raise is modeled here; Limp and All-in remain unmodeled.',
    'Fold/Raise patterns are modeled; Limp/Complete and All-in remain uncertain unless answered directly.',
  ]) {
    assert.equal((translations.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) ?? []).length, 2);
  }
});
