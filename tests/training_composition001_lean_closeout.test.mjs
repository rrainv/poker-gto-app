// TEST-HYGIENE-001: behavioural rewrite. Replays, answers and a complete Full
// Hand are driven in the running Training workspace; styles are resolved
// through the cascade. The Training bridge source is outside this ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const bridge = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('training');
const training = () => app.window.app.training;
const visible = (node) => {
  for (let current = node; current?.nodeType === 1; current = current.parentNode) {
    if (current.hidden || current.style.display === 'none') return false;
  }
  return true;
};
const answerButtons = () => app.$$('#trainingMode .training-action-button[data-action]').filter((button) => visible(button) && !button.disabled);
async function answer() {
  await app.click(answerButtons()[0]);
  await app.settle(500);
}
const memoryWrites = (spy, method) => spy.calls.callTrainingMemoryBridge.filter(([name]) => name === method).map(([, input]) => input);

test('Replay this decision remounts the current canonical exercise instead of a generation path', async () => {
  // Protects: the replay button remounts the same exercise through the
  // service's replayExercise as a 'replay' attempt, without generating or
  // advancing the seed.
  await app.click('[data-training-session-mode="focused"]');
  await app.click('#trainingNewHand');
  await app.settle(500);
  await answer();
  const exercise = training().currentExercise;
  const nextSeed = training().nextSeed;
  const spy = app.spy(['callTrainingServiceBridge', 'newRandomTrainingHand', 'replayTrainingExercise']);
  try {
    await app.click('#trainingReplayDecisionBtn');
    await app.settle(300);
    const methods = spy.calls.callTrainingServiceBridge.map(([method]) => method);
    assert.ok(methods.includes('replayExercise'));
    assert.equal(spy.calls.callTrainingServiceBridge.find(([method]) => method === 'replayExercise')[1], exercise);
    assert.ok(!methods.includes('generatePlanned') && !methods.includes('generate'));
    assert.equal(spy.count('newRandomTrainingHand') + spy.count('replayTrainingExercise'), 0);
  } finally {
    spy.restore();
  }
  assert.equal(training().currentAttemptKind, 'replay');
  assert.equal(training().currentExercise.id, exercise.id);
  assert.equal(training().nextSeed, nextSeed);
  assert.match(bridge, /replayExercise\(exercise\)[\s\S]*controller\.replayExercise\(exercise\)/);
});

test('replay answers retain evidence but are excluded from all headline session counters', async () => {
  // Protects: a replay answer is still recorded in Training Memory but changes
  // no headline counters and never completes the session; a primary answer
  // does count.
  const snapshot = () => JSON.stringify({
    stats: training().stats, bestStreak: training().bestStreak, grades: training().gradeStats,
  });
  const before = snapshot();
  const spy = app.spy(['recordTrainingExerciseAnswered', 'completeVariedTrainingSession']);
  try {
    await answer();
    assert.equal(spy.count('recordTrainingExerciseAnswered'), 1, 'replay evidence is recorded');
    assert.equal(spy.count('completeVariedTrainingSession'), 0);
  } finally {
    spy.restore();
  }
  assert.equal(snapshot(), before, 'replay answers leave every headline counter untouched');

  await app.click('#trainingNextHandBtn');
  await app.settle(500);
  const total = training().stats.totalHands;
  await answer();
  assert.equal(training().stats.totalHands, total + 1, 'primary answers count');
});

test('repeated replay evidence keeps same-spot provenance rooted in the primary record', async () => {
  // Protects: each replay records a same_spot redrill whose parent is the
  // primary decision record, also for a replay of a replay.
  const spy = app.spy(['callTrainingMemoryBridge']);
  try {
    await app.click('#trainingNextHandBtn');
    await app.settle(500);
    await answer();
    await app.click('#trainingReplayDecisionBtn');
    await app.settle(500);
    await answer();
    await app.click('#trainingReplayDecisionBtn');
    await app.settle(500);
  } finally {
    spy.restore();
  }
  const shown = memoryWrites(spy, 'recordExerciseShown');
  assert.equal(shown.length, 3);
  assert.equal(shown[0].parentDecisionRecordId, null);
  assert.equal(shown[0].redrillKind, null);
  const primaryRecord = await training().replaySourceRecordPromise;
  assert.ok(primaryRecord?.id);
  for (const replay of shown.slice(1)) {
    assert.equal(replay.redrillKind, 'same_spot');
    assert.equal(replay.parentDecisionRecordId, primaryRecord.id, 'rooted in the primary record');
  }
});

async function playFullHand() {
  await app.click('[data-training-session-mode="full_hand"]');
  await app.click('#trainingNewHand');
  const workspace = app.$('.training-workspace');
  for (let round = 0; round < 200 && workspace.dataset.trainingFullHandPhase === 'live'; round += 1) {
    await app.settle(1000);
    if (workspace.dataset.trainingState !== 'ready') continue;
    const buttons = answerButtons();
    const pick = buttons.find((button) => button.dataset.action === 'check')
      || buttons.find((button) => button.dataset.action === 'call') || buttons[0];
    await app.click(pick);
  }
  assert.equal(workspace.dataset.trainingFullHandPhase, 'complete');
}

test('Full Hand Review suppresses the horizontal timeline and opens canonical vertical History', async () => {
  // Protects: reviewing a finished Full Hand hides the compact timeline,
  // opens History, scrolls the Training recommendation (not the Hand review
  // surface) into view and labels each decision with its comparison.
  await playFullHand();
  const historyPanel = app.byId('trainingHistoryPanel');
  app.byId('trainingRecommendation')._scrolledIntoView = undefined;
  const surface = app.byId('handReviewSurface');
  if (surface) surface._scrolledIntoView = undefined;
  const reference = app.byId('trainingReferenceSummaryValue');
  const spy = app.spy(['reviewComparisonLabel']);
  try {
    await app.click('#trainingReviewHand');
    await app.settle(300);
    assert.ok(spy.count('reviewComparisonLabel') >= 1, 'decisions carry comparison labels');
  } finally {
    spy.restore();
  }
  assert.doesNotMatch(reference.textContent, /Hidden until review/, 'the reference summary is revealed in review');
  assert.equal(app.$('.training-workspace').dataset.trainingFullHandPhase, 'review');
  assert.equal(app.window.app.handReview.source, 'training_full_hand');
  assert.equal(app.byId('trainingFullHandTimeline').hidden, true);
  assert.equal(historyPanel.open, true);
  assert.ok(app.byId('trainingRecommendation')._scrolledIntoView);
  assert.equal(surface?._scrolledIntoView, undefined);
});

test('Full Hand Review retains the live shared-table desktop scale and study rail', () => {
  // Protects: live and review phases keep the wide two-column layout with a
  // sticky study rail in review; the review table keeps the live scale.
  const workspace = app.$('.training-workspace');
  for (const phase of ['live', 'review']) {
    workspace.dataset.trainingFullHandPhase = phase;
    assert.equal(css.cascaded(workspace, 'grid-template-columns'), 'minmax(0, 1fr) minmax(380px, 410px)', phase);
  }
  workspace.dataset.trainingFullHandPhase = 'review';
  const rail = workspace.querySelector(':scope > .training-study-rail');
  assert.ok(rail);
  assert.equal(css.cascaded(rail, 'position'), 'sticky');
  const table = workspace.querySelector('.training-full-hand-table-wrapper #visual-table-container')
    || (() => {
      const wrapper = app.document.createElement('div');
      wrapper.className = 'training-full-hand-table-wrapper';
      wrapper.dataset.tableProjection = 'review';
      wrapper.innerHTML = '<div id="visual-table-container-probe"></div>';
      workspace.appendChild(wrapper);
      const probe = wrapper.firstElementChild;
      probe.id = 'visual-table-container';
      return probe;
    })();
  const wrapper = table.closest('.training-full-hand-table-wrapper');
  const scale = () => [css.cascaded(table, '--play-stage-reserve'), css.cascaded(table, 'inline-size')];
  workspace.dataset.trainingFullHandPhase = 'live';
  wrapper.dataset.tableProjection = 'play';
  const live = scale();
  workspace.dataset.trainingFullHandPhase = 'review';
  wrapper.dataset.tableProjection = 'review';
  assert.deepEqual(scale(), live, 'review keeps the live table scale');
  assert.match(live[1], /1320px/);
  assert.match(live[1], /100dvh/);
  assert.match(live[0], /^\d+px$/);
});
