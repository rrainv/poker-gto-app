import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTrainingSameSpotLifecycle,
} from '../app/src/application/training-same-spot-lifecycle.mjs';
import { bootApp, indexDocument, strategyProviderProbe, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: the Same Spot flow runs in the booted app with real
// Training Memory (fake IndexedDB); page functions are observed through spies
// and the strategy provider through a probe, instead of regex-matching and
// vm-evaluating slices of logic.js. Markup is checked on the parsed document.
const markup = indexDocument();
const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
const training = () => app.window.app.training;
const pageFunctions = (names) => names.filter((name) => app.evaluate(`typeof ${name}`) === 'function');

/** Answer one Focused decision, return to idle, and return its Memory record. */
async function historicalRecord() {
  await app.training.start('focused');
  await app.training.answer();
  await app.settle(500);
  const record = await training().memoryCurrentRecordPromise;
  assert.equal(record?.status, 'answered');
  app.call('clearTrainingSessionState');
  await app.settle(500);
  assert.equal(app.call('trainingSessionIsActive'), false);
  return record;
}

async function leaveSameSpot() {
  if (app.call('trainingSameSpotIsActive')) await app.call('exitTrainingSameSpot');
  await app.settle(300);
}

test('standalone Same Spot is explicit and separate from ordinary session state', () => {
  const lifecycle = createTrainingSameSpotLifecycle();
  const state = lifecycle.begin({
    sourceDecisionRecordId: 'historical-decision',
  });
  assert.equal(state.active, true);
  assert.equal(state.sourceDecisionRecordId, 'historical-decision');
  lifecycle.markAnswered();
  assert.equal(lifecycle.release().answered, true);
  assert.equal(lifecycle.getState().active, false);
});

test('Same Spot presentation is read-only and never impersonates Focused Drill', async () => {
  const setup = markup.getElementById('trainingSameSpotSetup');
  assert.equal(setup.hidden, true);
  assert.match(text(markup.body), /Re-drill from Training Memory/);
  for (const id of ['trainingSameSpotStreet', 'trainingSameSpotPosition', 'trainingSameSpotTable', 'trainingSameSpotStack', 'trainingSameSpotFacing', 'trainingSameSpotExit']) {
    assert.ok(markup.getElementById(id), id);
  }
  assert.ok(markup.querySelector('[data-i18n="Back to Training"]'));
  assert.doesNotMatch(text(markup.body), /Return to session/);
  const record = await historicalRecord();
  const spy = app.spy(pageFunctions([
    'setTrainingSessionMode', 'startPracticeSession', 'startTemporaryTrainingMemoryReviewSession', 'renderCanonicalTrainingExercise',
  ]));
  try {
    const resolves = await probe.count(async () => {
      await app.call('openTrainingMemorySameSpot', record.id);
      await app.settle(500);
    });
    assert.equal(resolves.length, 0, 'no strategy is resolved for a Same Spot');
    assert.equal(spy.count('setTrainingSessionMode'), 0);
    if (spy.calls.startPracticeSession) assert.equal(spy.count('startPracticeSession'), 0);
    assert.equal(spy.count('startTemporaryTrainingMemoryReviewSession'), 1);
    assert.equal(spy.calls.startTemporaryTrainingMemoryReviewSession[0][0].mode, 'review');
    assert.equal(spy.calls.renderCanonicalTrainingExercise[0][1].attemptKind, 'redrill');
  } finally {
    spy.restore();
    await leaveSameSpot();
  }
});

test('Same Spot answer is linked, completes review evidence, and stays headline-neutral', async () => {
  const record = await historicalRecord();
  const shown = app.spy(['callTrainingMemoryBridge']);
  try {
    await app.call('openTrainingMemorySameSpot', record.id);
    await app.settle(500);
  } finally {
    shown.restore();
  }
  // The shown re-drill is linked to the historical decision.
  const [, link] = shown.calls.callTrainingMemoryBridge.find(([name]) => name === 'recordExerciseShown');
  assert.equal(link.parentDecisionRecordId, record.id);
  assert.equal(link.redrillKind, 'same_spot');
  const stats = { ...training().stats };
  const spy = app.spy(['callTrainingServiceBridge', 'callTrainingMemoryBridge', 'finishTrainingMemorySession']);
  try {
    await app.training.answer();
    await app.settle(500);
    assert.deepEqual(spy.calls.callTrainingServiceBridge.map(([name]) => name).filter((name) => name === 'markSameSpotAnswered'), ['markSameSpotAnswered']);
    assert.deepEqual(spy.calls.finishTrainingMemorySession, [['completed']]);
    const memoryCalls = spy.calls.callTrainingMemoryBridge.map(([name]) => name);
    assert.ok(memoryCalls.includes('recordExerciseAnswered'));
    for (const name of ['markReviewed', 'reviewAgain', 'updateStudyMetadata']) assert.ok(!memoryCalls.includes(name), name);
    assert.deepEqual({ ...training().stats }, stats, 'a re-drill does not count toward the session headline');
  } finally {
    spy.restore();
    await leaveSameSpot();
  }
});

test('standalone Same Spot exit drains its review, returns idle, and refreshes Memory', async () => {
  for (const answered of [true, false]) {
    const record = await historicalRecord();
    await app.call('openTrainingMemorySameSpot', record.id);
    await app.settle(500);
    if (answered) await app.training.answer();
    const spy = app.spy(['finishTrainingMemorySession', 'discardSameSpotMemoryRuntime', 'returnSameSpotToIdleTraining', 'refreshTrainingMemoryPanel']);
    try {
      if (!answered) training().memorySessionPromise ||= Promise.resolve(null);
      assert.equal(await app.call('exitTrainingSameSpot'), true);
      await app.settle(300);
      if (!answered) assert.deepEqual(spy.calls.finishTrainingMemorySession, [['abandoned']]);
      else assert.ok(spy.calls.finishTrainingMemorySession.every(([status]) => status === 'completed'));
      const order = ['discardSameSpotMemoryRuntime', 'returnSameSpotToIdleTraining', 'refreshTrainingMemoryPanel'].map((name) => spy.sequence.indexOf(name));
      assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1])), JSON.stringify(spy.sequence));
      assert.equal(app.call('trainingSameSpotIsActive'), false);
      assert.equal(app.$('.training-workspace').dataset.trainingState, 'idle');
    } finally {
      spy.restore();
    }
  }
  for (const name of ['captureSuspendedTrainingState', 'restoreSuspendedTraining', 'reacquireSuspendedTrainingMemory', 'captureSessionState', 'restoreSessionState']) {
    assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  }
});

test('owner invalidation releases Same Spot and restores only ordinary idle presentation', async () => {
  const record = await historicalRecord();
  await app.call('openTrainingMemorySameSpot', record.id);
  await app.settle(500);
  assert.equal(app.call('trainingSameSpotIsActive'), true);
  const spy = app.spy(['clearTrainingSessionState', 'showOrdinaryTrainingSetupAfterSameSpot', 'callTrainingServiceBridge', 'startTemporaryTrainingMemoryReviewSession']);
  try {
    app.call('clearTrainingMemoryOwnerPresentation');
    await app.settle(300);
    assert.equal(app.call('trainingSameSpotIsActive'), false);
    assert.equal(spy.count('clearTrainingSessionState'), 1);
    assert.equal(spy.count('showOrdinaryTrainingSetupAfterSameSpot'), 1);
    assert.ok(!spy.calls.callTrainingServiceBridge.some(([name]) => name === 'beginSameSpot'));
    assert.equal(spy.count('startTemporaryTrainingMemoryReviewSession'), 0);
  } finally {
    spy.restore();
    await leaveSameSpot();
  }
});

test('frozen earlier evidence and this try remain separately labelled', async () => {
  assert.ok(markup.querySelector('[data-i18n="Earlier answer"]'));
  assert.ok(markup.querySelector('[data-i18n="This try"]'));
  const bridge = app.window.requireStrategyProviderBridge;
  try {
    for (const [state, label] of [
      ['heuristic_comparison', 'Historical heuristic baseline'],
      ['accepted_reference_comparison', 'Historical selected reference'],
      ['normative_assessment', 'Historical selected reference'],
    ]) {
      app.window.requireStrategyProviderBridge = () => ({ ...bridge(), historicalTruth: () => ({ state }) });
      assert.equal(app.call('sameSpotSourceRole', { strategyEvidence: {} }), label);
    }
  } finally {
    app.window.requireStrategyProviderBridge = bridge;
  }
  const record = await historicalRecord();
  const spy = app.spy(['callTrainingMemoryBridge']);
  try {
    const resolves = await probe.count(async () => {
      await app.call('openTrainingMemorySameSpot', record.id);
      await app.settle(500);
    });
    assert.equal(resolves.length, 0);
    const calls = spy.calls.callTrainingMemoryBridge;
    assert.deepEqual(calls.find(([name]) => name === 'createSameSpot'), ['createSameSpot', record.id, { handoff: null }]);
    assert.deepEqual(calls.find(([name]) => name === 'getDecision'), ['getDecision', record.id]);
  } finally {
    spy.restore();
    await leaveSameSpot();
  }
  assert.equal(app.evaluate('typeof generateSimilarSpot'), 'undefined');
});

for (const mode of ['varied', 'focused', 'full_hand']) {
  test(`active ${mode} blocks Same Spot before any session or planner mutation`, async () => {
    await app.training.start(mode);
    assert.equal(app.call('trainingSessionIsActive'), true);
    const spy = app.spy(['setTrainingMemoryStatus', 'callTrainingMemoryBridge', 'callTrainingServiceBridge']);
    try {
      assert.equal(await app.call('openTrainingMemorySameSpot', 'record'), null);
      assert.deepEqual(spy.sequence, ['setTrainingMemoryStatus']);
      assert.deepEqual(spy.calls.setTrainingMemoryStatus, [['Finish or leave your current session before re-drilling this spot.']]);
    } finally {
      spy.restore();
      app.call('clearTrainingSessionState');
      await app.settle(300);
    }
  });
}

test('Same Spot never changes or starts a planner mode', async () => {
  const record = await historicalRecord();
  const spy = app.spy(pageFunctions(['trainingSessionIsActive', 'callTrainingMemoryBridge', 'setTrainingSessionMode', 'startPracticeSession']));
  try {
    await app.call('openTrainingMemorySameSpot', record.id);
    await app.settle(500);
    assert.equal(spy.count('setTrainingSessionMode'), 0);
    if (spy.calls.startPracticeSession) assert.equal(spy.count('startPracticeSession'), 0);
    // The session gate runs before the Memory handoff is created.
    const createIndex = spy.sequence.findIndex((name, index) => name === 'callTrainingMemoryBridge' && spy.calls.callTrainingMemoryBridge[spy.sequence.slice(0, index).filter((entry) => entry === 'callTrainingMemoryBridge').length][0] === 'createSameSpot');
    assert.ok(spy.sequence.indexOf('trainingSessionIsActive') >= 0 && spy.sequence.indexOf('trainingSessionIsActive') < createIndex);
  } finally {
    spy.restore();
    await leaveSameSpot();
  }
});

test('a settled Memory persistence handle cannot block idle Same Spot', async () => {
  const previous = training().memorySessionPromise;
  training().memorySessionPromise = Promise.resolve({ id: 'settled-session' });
  try {
    assert.equal(app.$('.training-workspace').dataset.trainingState, 'idle');
    assert.equal(app.call('trainingSessionIsActive'), false);
  } finally {
    training().memorySessionPromise = previous;
  }
});

test('canonical ordinary Training states still block Same Spot without relying on Memory writes', () => {
  const workspace = app.$('.training-workspace');
  const previous = [workspace.dataset.trainingState, training().memorySessionPromise, training().practiceSession];
  training().memorySessionPromise = null;
  training().practiceSession = null;
  try {
    for (const trainingState of ['generating', 'automating', 'ready', 'grading', 'feedback']) {
      workspace.dataset.trainingState = trainingState;
      assert.equal(app.call('trainingSessionIsActive'), true, trainingState);
    }
  } finally {
    [workspace.dataset.trainingState, training().memorySessionPromise, training().practiceSession] = previous;
  }
});

test('rendered and rerendered Recent-session Same Spot actions resolve the live launch path once', async () => {
  const record = await historicalRecord();
  const find = (element) => element.localName === 'button' && text(element) === 'Same Spot'
    ? element
    : [...element.children].map(find).find(Boolean);
  const first = find(app.call('renderTrainingMemoryDecisionItem', record));
  const rerendered = find(app.call('renderTrainingMemoryDecisionItem', record));
  assert.ok(first && rerendered);
  // The handler resolves the launch path when clicked, not when rendered.
  const live = app.window.openTrainingMemoryRedrill;
  const calls = [];
  app.window.openTrainingMemoryRedrill = (recordId, kind) => { calls.push({ recordId, kind }); };
  try {
    rerendered.click();
    await app.settle(50);
  } finally {
    app.window.openTrainingMemoryRedrill = live;
  }
  assert.deepEqual(calls, [{ recordId: record.id, kind: 'same_spot' }]);
});

test('idle Same Spot calls createSameSpot once and opens the standalone lifecycle', async () => {
  const record = await historicalRecord();
  const spy = app.spy(['callTrainingMemoryBridge']);
  let result;
  try {
    result = await app.call('openTrainingMemorySameSpot', record.id);
    await app.settle(500);
    assert.equal(spy.calls.callTrainingMemoryBridge.filter(([name]) => name === 'createSameSpot').length, 1);
  } finally {
    spy.restore();
  }
  assert.ok(result.exercise);
  const state = app.window.RiverlineTraining.getSameSpotState();
  assert.equal(state.active, true);
  assert.equal(state.sourceDecisionRecordId, record.id);
  await leaveSameSpot();
});
