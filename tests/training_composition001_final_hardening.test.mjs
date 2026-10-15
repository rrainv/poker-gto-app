import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: Training (drills, a live and completed Full Hand, Abort) is
// driven in the running app and styles are resolved through the cascade.
// teacher.js and the archived Random Spot spec are outside this ticket.
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const randomSpot = fs.readFileSync(
  new URL('../docs/archive/2026-10/capabilities/RANDOM_SPOT_GENERATOR.md', import.meta.url),
  'utf8',
);
const training = indexDocument().getElementById('trainingMode');
const css = appStyleSheet();
const app = await bootApp();
const workspace = () => app.byId('trainingWorkspace');

test('accepted Training skeleton and its one start/answer/progression authorities remain intact', () => {
  for (const id of [
    'trainingSetupPanel', 'trainingExerciseSurface', 'trainingDecisionControls',
    'trainingFeedback', 'trainingContinuationRow',
    'trainingNextHandBtn', 'trainingMemoryPanel',
  ]) assert.equal(training.querySelectorAll(`#${id}`).length, 1, id);
  assert.equal(training.querySelectorAll('#trainingNewHand').length, 1);
  assert.equal(training.querySelectorAll('.training-insight-column').length, 1);
});

test('live Full Hand records neutrally and cannot render verdict, source, Facts, or deep analysis', async () => {
  // Protects: a live Full Hand answer only says "Decision recorded"; no
  // verdict, source, Facts or analysis is rendered until Review.
  await app.training.start('full_hand');
  for (let round = 0; round < 30 && workspace().dataset.trainingState !== 'ready'; round += 1) await app.settle(1000);
  assert.equal(workspace().dataset.trainingFullHandPhase, 'live');
  assert.match(text(app.byId('trainingReferenceSummaryValue')), /Hidden until review/);
  assert.match(text(app.byId('trainingReferenceSummaryNote')), /Comparison and source details are available after the Hand in Review/);
  assert.equal(app.evaluate('typeof renderFullHandDecisionFeedback'), 'undefined', 'no live verdict renderer exists');
  const verdictRenderers = ['canonicalTrainingFeedback', 'renderTrainingRelevantFacts', 'renderDecisionAnalysis', 'showTrainingSolution'];
  const spy = app.spy(['renderFullHandDecisionRecorded', ...verdictRenderers]);
  try {
    await app.training.answer('call');
    assert.equal(spy.count('renderFullHandDecisionRecorded'), 1);
    for (const name of verdictRenderers) assert.equal(spy.count(name), 0, name);
  } finally {
    spy.restore();
  }
  assert.match(text(app.byId('trainingFullHandDecisionFeedbackTitle')), /Decision recorded/);
  assert.equal(app.byId('trainingFullHandDecisionFacts').hidden, true);
  assert.equal(app.$('#trainingFullHandDecisionFeedback details').hidden, true);
});

test('Abort is live-only, confirmed, resets transient Full Hand state, and never fabricates completion', async () => {
  // Protects: Abort is hidden outside a live hand and lives in the Full Hand
  // dock; it asks first; declining keeps the hand; confirming clears the
  // session without completing it and says decisions remain recorded.
  const button = training.querySelector('#trainingFullHandEndHand');
  assert.equal(button.hidden, true);
  assert.equal(button.dataset.i18n, 'Abort hand');
  assert.equal(workspace().dataset.trainingFullHandPhase, 'live');
  assert.equal(app.byId('trainingFullHandEndHand').hidden, false, 'shown while live');
  assert.ok(app.byId('trainingFullHandActionDock').contains(app.byId('trainingFullHandCompactControls')));

  let asked = 0;
  app.window.confirm = () => { asked += 1; return false; };
  await app.click('#trainingFullHandEndHand');
  assert.equal(asked, 1);
  assert.equal(workspace().dataset.trainingFullHandPhase, 'live', 'declining keeps the hand');

  const completion = app.byId('trainingFullHandCompletion');
  const spy = app.spy(['clearTrainingSessionState', 'finishTrainingMemorySession']);
  app.window.confirm = () => true;
  try {
    await app.click('#trainingFullHandEndHand');
    assert.equal(spy.count('clearTrainingSessionState'), 1);
    assert.ok(!completion || completion.hidden, 'no completion is shown');
    assert.ok(spy.calls.finishTrainingMemorySession.every(([status]) => status !== 'completed'));
  } finally {
    spy.restore();
  }
  assert.match(text(app.byId('trainingFilterMessage')), /Recorded decisions remain in Training Memory/);
  assert.notEqual(workspace().dataset.trainingFullHandPhase, 'complete');
  assert.equal(app.byId('trainingFullHandEndHand').hidden, true, 'hidden once the hand is not live');
  assert.equal(app.call('abortFullHandTraining'), false, 'no-op outside a live hand');
});

test('completed Full Hand still enters the shared evidence-rich Review contract', async () => {
  // Protects: reviewing a completed Full Hand goes through the service's
  // Full Hand review and the shared Hand review model/renderer.
  for (const id of [
    'handReviewChosenAction', 'handReviewComparisonBadge', 'handReviewFrequencyRows',
    'handReviewPreviousDecision', 'handReviewNextDecision',
    'handReviewPreviousEvent', 'handReviewNextEvent',
  ]) assert.ok(indexDocument().getElementById(id), id);
  assert.ok(indexDocument().querySelector('.hand-review-decision-facts'));
  await app.training.playFullHand();
  const spy = app.spy(['callTrainingServiceBridge', 'refreshActiveHandReviewModel', 'selectActiveHandReviewDecision', 'renderActiveHandReview']);
  try {
    await app.click('#trainingReviewHand');
    await app.settle(300);
    assert.ok(spy.calls.callTrainingServiceBridge.some(([method]) => method === 'getFullHandReview'));
    for (const name of ['refreshActiveHandReviewModel', 'selectActiveHandReviewDecision', 'renderActiveHandReview']) {
      assert.ok(spy.count(name) >= 1, name);
    }
  } finally {
    spy.restore();
  }
  assert.equal(workspace().dataset.trainingFullHandPhase, 'review');
});

test('answered Varied/Focused puts one primary progression row before study controls, Facts, and Explain', async () => {
  // Protects: in feedback the single continuation row moves into the
  // feedback progression mount, ahead of memory actions, Facts and Explain.
  const feedback = training.querySelector('#trainingFeedback');
  const ordered = ['trainingFeedbackProgressionMount', 'trainingMemoryDecisionActions', 'trainingRelevantFacts', 'trainingAnalysis']
    .map((id) => feedback.querySelector(`#${id}`));
  assert.ok(ordered.every(Boolean));
  ordered.slice(1).forEach((node, index) => assert.ok(precedes(ordered[index], node), node.id));
  await app.training.start('focused');
  assert.ok(app.byId('trainingDecisionProgressionMount').contains(app.byId('trainingContinuationRow')));
  await app.training.answer();
  assert.equal(workspace().dataset.trainingState, 'feedback');
  assert.ok(app.byId('trainingFeedbackProgressionMount').contains(app.byId('trainingContinuationRow')));
  assert.equal(app.$$('#trainingNextHandBtn').length, 1);
});

test('normal drills remain immediate-feedback consumers with relevant Facts and optional Explain', async () => {
  await app.training.next();
  const spy = app.spy(['showTrainingFeedback', 'renderTrainingDecisionAnalysis', 'showTrainingSolution']);
  try {
    await app.training.answer();
    for (const name of ['showTrainingFeedback', 'renderTrainingDecisionAnalysis', 'showTrainingSolution']) assert.equal(spy.count(name), 1, name);
  } finally {
    spy.restore();
  }
  assert.match(teacher, /TRAINING_RELEVANT_FACT_PRIORITY/);
  assert.match(teacher, /analysisDisclosure = 'supporting-detail'/);
});

test('normal modes are content-height while Full Hand retains its large shared-table sizing', () => {
  const node = workspace();
  const previous = node.dataset.trainingFullHandPhase;
  node.dataset.trainingFullHandPhase = 'off';
  assert.equal(css.cascaded(node.querySelector('.training-decision-column'), 'align-self'), 'start');
  assert.equal(css.cascaded(node.querySelector('.training-decision-panel'), 'min-block-size'), '0');
  node.dataset.trainingFullHandPhase = 'live';
  const wrapper = node.querySelector('.training-full-hand-table-wrapper') || (() => {
    const created = app.document.createElement('div');
    created.className = 'training-full-hand-table-wrapper';
    node.appendChild(created);
    return created;
  })();
  const probe = app.document.createElement('div');
  probe.id = 'visual-table-container';
  const existing = wrapper.querySelector('#visual-table-container');
  const table = existing || wrapper.appendChild(probe);
  const size = css.cascaded(table, 'inline-size');
  assert.match(size, /1320px/);
  assert.match(size, /100dvh/);
  if (!existing) probe.remove();
  node.dataset.trainingFullHandPhase = previous;
});

test('future stack randomization is bounded under one shared reproducible Random Spot authority', () => {
  for (const phrase of [
    'Bounded effective-stack randomization', 'shared randomization contract',
    'legal minimum and maximum', 'short / medium / standard / deep',
    'Stack lock', 'deterministic', 'Training-specific stack randomizer',
    'not implemented',
  ]) assert.match(randomSpot, new RegExp(phrase.replaceAll('/', '\\/'), 'i'), phrase);
});
