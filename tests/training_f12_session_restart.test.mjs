import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveTrainingSchedulingProposal } from '../app/src/application/training-intelligence.mjs';
import { bootApp } from './helpers/app-under-test.mjs';

// TRAINING-F12-001: a completed bounded Varied session marks the workspace
// data-training-session-complete, which hides the answer buttons. Every way of
// starting the next session must clear that state so it can be answered.
const app = await bootApp();
await app.navigate('training');
const training = () => app.window.app.training;
const workspace = () => app.$('.training-workspace');

/** Complete a 10-exercise Varied session and return its last Memory record. */
async function completeVariedSession({ uncertainLast = false } = {}) {
  if (app.call('trainingSameSpotIsActive')) await app.call('exitTrainingSameSpot');
  app.call('clearTrainingSessionState');
  await app.settle(300);
  await app.click('[data-training-session-mode="varied"]');
  await app.setValue('#trainingSessionLength', '10');
  await app.training.start('varied');
  for (let index = 0; index < 10; index += 1) {
    if (uncertainLast && index === 9) app.byId('trainingUncertain').checked = true;
    await app.training.answer();
    const next = app.byId('trainingNextHandBtn');
    if (!next.disabled && app.isShown(next)) await app.training.next();
  }
  assert.equal(workspace().dataset.trainingSessionComplete, 'true', 'the Varied session completed');
  assert.deepEqual(app.training.answerButtons(), [], 'completion hides the answers');
  const record = await training().memoryCurrentRecordPromise;
  await app.settle(500);
  return record;
}

function assertAnswerable(label) {
  assert.equal(workspace().hasAttribute('data-training-session-complete'), false, `${label} clears completion`);
  assert.equal(app.isShown(app.byId('trainingSessionCompletion')), false, `${label} hides the completion card`);
  assert.ok(app.training.answerButtons().length > 0, `${label} shows answer buttons`);
}

test('Varied: another Varied session after a completed one can be answered', async () => {
  await completeVariedSession();
  await app.training.start('varied');
  assertAnswerable('Varied');
  assert.equal(training().practiceSession?.completed, false);
  await app.training.answer();
  assert.ok(training().currentEvaluation, 'the new Varied exercise was answered');
});

test('Varied: Start another session from the completion card can be answered', async () => {
  await completeVariedSession();
  await app.click('#trainingRestartSession');
  await app.settle(500);
  assertAnswerable('Start another session');
  await app.training.answer();
  assert.ok(training().currentEvaluation);
});

test('Focused: a Focused Drill after a completed Varied session can be answered', async () => {
  await completeVariedSession();
  await app.training.start('focused');
  assertAnswerable('Focused');
  await app.training.answer();
  assert.ok(training().currentEvaluation);
});

test('Full Hand: a Full Hand after a completed Varied session can be answered', async () => {
  await completeVariedSession();
  await app.training.start('full_hand');
  assert.equal(workspace().hasAttribute('data-training-session-complete'), false, 'Full Hand clears completion');
  await app.waitFor(() => workspace().dataset.trainingFullHandPhase !== 'live'
    || (workspace().dataset.trainingState === 'ready' && app.training.answerButtons().length > 0),
  'a Hero decision or the end of the hand');
  if (workspace().dataset.trainingFullHandPhase === 'live') {
    assertAnswerable('Full Hand');
    await app.training.answer();
  }
  await app.call('clearTrainingSessionState');
  await app.click('[data-training-session-mode="varied"]');
});

test('Same Spot: re-drilling a decision after a completed Varied session can be answered', async () => {
  const record = await completeVariedSession();
  assert.equal(record?.status, 'answered');
  const result = await app.call('openTrainingMemorySameSpot', record.id);
  await app.settle(500);
  assert.ok(result, 'Same Spot opened');
  assertAnswerable('Same Spot');
  await app.training.answer();
  assert.ok(training().currentEvaluation);
  await app.call('exitTrainingSameSpot');
  await app.settle(300);
});

test('Similar Spot: a similar re-drill after a completed Varied session can be answered', async () => {
  const record = await completeVariedSession();
  const result = await app.call('openTrainingMemoryRedrill', record.id, 'similar_spot');
  await app.settle(500);
  assert.ok(result?.ok, 'Similar Spot opened');
  assertAnswerable('Similar Spot');
  await app.training.answer();
  assert.ok(training().currentEvaluation);
});

test('Revisit: practising a requested revisit after a completed Varied session can be answered', async () => {
  const record = await completeVariedSession({ uncertainLast: true });
  const requested = await app.call('callTrainingMemoryBridge', 'requestUncertainRevisit', record.id);
  const proposal = deriveTrainingSchedulingProposal(requested, new Date());
  assert.ok(proposal?.handoff, 'the revisit was scheduled');
  const result = await app.call('openTrainingMemorySameSpot', record.id, proposal.handoff);
  await app.settle(500);
  assert.ok(result?.revisit, 'the revisit opened');
  assertAnswerable('Revisit');
  await app.training.answer();
  assert.ok(training().currentEvaluation);
  await app.call('exitTrainingSameSpot');
  await app.settle(300);
});
