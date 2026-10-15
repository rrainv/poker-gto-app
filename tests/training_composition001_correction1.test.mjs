import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (the running Training workspace, Training Memory toggles, a live
// Full Hand, the cascade). teacher.js, SoundFX.js, table-presentation.mjs and
// range-calibration-bootstrap.mjs sources are outside this ticket.
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const tablePresentation = fs.readFileSync(
  new URL('../app/src/application/table-presentation.mjs', import.meta.url),
  'utf8',
);
const rangeBootstrap = fs.readFileSync(
  new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url),
  'utf8',
);
const training = indexDocument().getElementById('trainingMode');
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('training');
const workspace = () => app.byId('trainingWorkspace');

function sourceBetween(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

test('accepted Varied skeleton stays intact while idle state yields fake vertical space', () => {
  // Protects: in idle, the decision panel and state message take no forced
  // height and the session/reference/history/assistance panels are hidden;
  // the Memory summary keeps a 46px row.
  assert.equal(training.querySelector('.training-decision-column').localName, 'main');
  assert.equal(training.querySelector('.training-insight-column').localName, 'aside');
  assert.equal(training.querySelectorAll('#trainingNewHand').length, 1);
  assert.equal(workspace().dataset.trainingState, 'idle');
  assert.equal(css.cascaded(app.$('#trainingWorkspace .training-decision-panel'), 'min-block-size'), '0');
  // TRAINING-COMPOSITION-001 final hardening keeps a modest floor for the
  // idle lineup preview (superseding 0); it never reserves tall fake space.
  assert.ok(Number.parseFloat(css.cascaded(app.$('#trainingWorkspace .training-state-message'), 'min-block-size')) <= 128);
  for (const selector of ['.training-session-panel', '.training-reference-summary', '.training-history-panel', '.training-assistance-panel']) {
    assert.equal(css.cascaded(app.$(`#trainingWorkspace ${selector}`), 'display'), 'none', selector);
  }
  assert.equal(css.cascaded(app.$('.training-memory-panel > summary.panel-head'), 'min-block-size'), '46px');
});

test('Review later and Mark difficult are persisted, reversible, and visibly acknowledged', async () => {
  // Protects: both toggles start unpressed; pressing persists through Training
  // Memory, flips the pressed state/label, announces the update and refreshes
  // the Memory panel; pressing again reverses it.
  const review = training.querySelector('#trainingMarkReview');
  assert.equal(review.getAttribute('aria-pressed'), 'false');
  assert.match(text(review), /Review later/);
  const difficult = training.querySelector('#trainingMarkDifficult');
  assert.equal(difficult.getAttribute('aria-pressed'), 'false');
  assert.match(text(difficult), /Mark difficult/);
  const status = training.querySelector('#trainingMemoryDecisionStatus');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');

  await app.training.start('focused');
  await app.training.answer();
  await app.settle(500);
  app.byId('trainingMemoryPanel').open = true;
  const spy = app.spy(['callTrainingMemoryBridge', 'refreshTrainingMemoryPanel']);
  try {
    for (const [id, field, active] of [['trainingMarkReview', 'review', /Added to review|Remove from review/], ['trainingMarkDifficult', 'difficult', /Marked difficult|Clear difficult mark/]]) {
      await app.click(`#${id}`);
      await app.settle(500);
      const button = app.byId(id);
      assert.equal(button.getAttribute('aria-pressed'), 'true', id);
      assert.match(text(button) + (button.getAttribute('aria-label') || ''), active, id);
      const update = spy.calls.callTrainingMemoryBridge.filter(([method]) => method === 'updateStudyMetadata').at(-1);
      assert.equal(update[1], app.window.app.training.memoryCurrentRecordId);
      assert.equal(update[2][field], true);
      assert.ok(css.matchingRules(button).some((rule) => rule.selectorText.includes('.training-memory-decision-actions .ui-button[aria-pressed="true"]')));
      if (field === 'review') assert.match(text(app.byId('trainingMemoryDecisionStatus')), /Training Memory review queue updated/);
      await app.click(`#${id}`);
      await app.settle(500);
      assert.equal(app.byId(id).getAttribute('aria-pressed'), 'false', `${id} is reversible`);
    }
    assert.ok(spy.count('refreshTrainingMemoryPanel') >= 4);
  } finally {
    spy.restore();
  }
});

test('Training Facts project direct decision facts without creating poker authority', async () => {
  assert.ok(training.querySelector('#trainingRelevantFacts'));
  const projector = sourceBetween(teacher, 'const TRAINING_RELEVANT_FACT_PRIORITY', 'function studyHintDefinition(');
  for (const key of ['made_hand', 'draws', 'pot_before_action', 'call_amount', 'required_raw_equity', 'spr']) {
    assert.match(projector, new RegExp(`'${key}'`), key);
  }
  assert.doesNotMatch(projector, /hero_blocker_structure|range_blocker_effect|physical combos removed/);
  assert.match(projector, /analysisFactByKey\(explanation, key\)/);
  // Facts are projected after the decision analysis renders.
  const spy = app.spy(['renderDecisionAnalysis', 'renderTrainingRelevantFacts']);
  try {
    await app.training.next();
    await app.training.answer();
  } finally {
    spy.restore();
  }
  assert.ok(spy.sequence.indexOf('renderDecisionAnalysis') >= 0);
  assert.ok(spy.sequence.indexOf('renderDecisionAnalysis') < spy.sequence.lastIndexOf('renderTrainingRelevantFacts'));
});

test('generic blocker evidence remains available only inside Training supporting detail', () => {
  const renderer = sourceBetween(teacher, 'function renderAnalysisExplanation(', 'window.renderDecisionAnalysis');
  assert.match(renderer, /surface === 'training'[\s\S]*\['bluff_pressure', 'range'\]/);
  assert.match(renderer, /\['bluff_pressure', 'blockers', 'range'\]/);
  assert.match(renderer, /analysisDisclosure = 'supporting-detail'/);
  assert.match(renderer, /explanation\.sections\.forEach/);
  assert.match(renderer, /facts = analysisSection\.facts\.filter/);
});

test('Full Hand keeps one shared table and moves the one canonical action surface beside it', async () => {
  // Protects: one table mount and one action surface; a live Full Hand
  // mounts the shared table there and moves the action controls into the dock
  // beside it (back to the decision mount afterwards); live layout sizing.
  assert.equal(training.querySelectorAll('#trainingFullHandTableMount').length, 1);
  assert.equal(training.querySelectorAll('#trainingDecisionControls').length, 1);
  assert.match(tablePresentation, /TABLE_PRESENTATION_SCHEMA_VERSION/);
  assert.ok(app.byId('trainingDecisionActionMount').contains(app.byId('trainingDecisionControls')));
  await app.training.start('full_hand');
  for (let round = 0; round < 30 && workspace().dataset.trainingState !== 'ready'; round += 1) await app.settle(1000);
  assert.ok(app.byId('trainingFullHandTableMount').querySelector('.riverline-poker-table, #visual-table-container'), 'the shared table is mounted beside Training');
  assert.ok(app.byId('trainingFullHandActionDockMount').contains(app.byId('trainingDecisionControls')));
  const node = workspace();
  assert.equal(node.dataset.trainingFullHandPhase, 'live');
  assert.equal(css.cascaded(node, 'grid-template-columns'), 'minmax(0, 1fr) minmax(380px, 410px)');
  const table = app.$('#trainingFullHandTableMount #visual-table-container');
  if (table) {
    assert.match(css.cascaded(table, 'inline-size'), /1320px/);
    assert.match(css.cascaded(table, 'inline-size'), /100dvh/);
  }
  assert.equal(css.cascaded(app.$('.training-full-hand-action-dock'), 'order'), '1');
});

test('Full Hand action family selection gates canonical amount-to sizing', async () => {
  // Protects: bet/raise open canonical amount-to sizing bounded by the
  // service's sizing model; Apply commits; all-in is not a sizing preset;
  // clearing hides the surface.
  const sizingSurface = app.byId('trainingFullHandSizing');
  assert.equal(sizingSurface.hidden, true);
  const sized = app.training.answerButtons().find((button) => ['bet', 'raise'].includes(button.dataset.action));
  assert.ok(sized);
  await app.click(sized);
  assert.equal(sizingSurface.hidden, false);
  const model = app.call('callTrainingServiceBridge', 'getFullHandSizingModel').actions[sized.dataset.action];
  const input = sizingSurface.querySelector('input[type="number"]');
  assert.equal(String(input.min), String(model.minValueBb));
  assert.equal(String(input.max), String(model.maxValueBb));
  assert.ok(sizingSurface.querySelectorAll('button').some((button) => text(button) === 'Apply'));
  assert.ok(!sizingSurface.querySelector('[data-preset-kind="all_in"]'));
  app.call('clearFullHandTrainingSizingControls');
  assert.equal(sizingSurface.hidden, true);
});

test('Full Hand answer keeps table continuity while deferring normative feedback to Review', async () => {
  const feedback = training.querySelector('#trainingFullHandDecisionFeedback');
  assert.equal(feedback.hidden, true);
  assert.ok(training.querySelector('#trainingFullHandDecisionFacts'));
  assert.ok(training.querySelector('details.training-full-hand-decision-explain'));
  assert.equal(app.evaluate('typeof renderFullHandDecisionFeedback'), 'undefined');
  const spy = app.spy(['restoreSharedPokerTable', 'canonicalTrainingFeedback', 'renderTrainingRelevantFacts', 'renderDecisionAnalysis']);
  try {
    await app.training.answer('call');
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
  }
  assert.match(text(app.byId('trainingFullHandDecisionFeedbackTitle')), /Decision recorded/);
  assert.equal(app.byId('trainingFullHandDecisionFacts').hidden, true);
  const explain = app.$('#trainingFullHandDecisionFeedback details');
  explain.open = true;
  explain.hidden = false;
  assert.ok(css.cascaded(explain.querySelector(':scope > :not(summary)') || explain, 'max-block-size') || css.cascaded(explain, 'max-block-size'));
  explain.open = false;
  explain.hidden = true;
});

test('Training feedback event precedes deep render and a prepared Study cue avoids async readiness delay', async () => {
  await app.training.start('focused');
  const spy = app.spy(['emitTrainingDecisionResultExperience', 'renderTrainingDecisionAnalysis']);
  try {
    await app.training.answer();
  } finally {
    spy.restore();
  }
  assert.ok(spy.sequence.indexOf('emitTrainingDecisionResultExperience') >= 0);
  assert.ok(spy.sequence.indexOf('emitTrainingDecisionResultExperience') < spy.sequence.indexOf('renderTrainingDecisionAnalysis'));
  const playCue = sourceBetween(sound, 'async function playCue(', 'function setSoundEnabled(');
  assert.match(playCue, /preparedContext\?\.state === 'running'[\s\S]*preparedContext[\s\S]*await ensureAudioReady/);
  assert.match(playCue, /definition\.category === CATEGORIES\.POKER[\s\S]*renderRecordedFoleyCue/);
  assert.match(playCue, /renderProceduralCue\(ctx, cueName\)/);
});

test('Personal Strategy still owns its authenticated lazy bootstrap and recoverable shell', () => {
  assert.match(rangeBootstrap, /createRangeCalibrationLifecycle/);
  assert.match(rangeBootstrap, /async mountAuthenticated\(options\)[\s\S]*mountRangeCalibrationWorkspace\(options\)/);
  assert.match(rangeBootstrap, /calibrationErrorState/);
  assert.match(rangeBootstrap, /lifecycle\.start\(\)/);
  for (const name of ['rangeCalibrationRepository', 'loadSnapshot']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
});
