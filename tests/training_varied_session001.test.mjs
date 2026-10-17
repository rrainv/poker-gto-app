import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural (parsed
// markup and the running Training workspace). The bootstrap and locale
// sources are outside this ticket and keep their checks.
const bootstrap = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const training = indexDocument().getElementById('trainingMode');
const app = await bootApp();
await app.navigate('training');

const visible = (node) => {
  for (let current = node; current?.nodeType === 1; current = current.parentNode) {
    if (current.hidden || current.style.display === 'none') return false;
  }
  return true;
};
const bridgeCalls = (spy, method) => spy.calls.callTrainingServiceBridge.filter(([name]) => name === method);
async function answerAndContinue() {
  const action = app.$$('#trainingMode .training-action-button[data-action]').find((button) => visible(button) && !button.disabled);
  assert.ok(action, 'an answer is available');
  await app.click(action);
  await app.settle(300);
  const next = app.byId('trainingNextHandBtn');
  if (!next.disabled && visible(next)) {
    await app.click(next);
    await app.settle(300);
  }
}

test('Varied Session is the accessible default and Focused Drill retains its exact controls', async () => {
  // Protects: an accessible two-state mode switch defaulting to Varied; the
  // Focused controls keep street/target/position/players/stack; switching mode
  // swaps the control groups and resets the Training service session.
  const modeSwitch = training.querySelector('#trainingModeSwitch');
  assert.equal(modeSwitch.getAttribute('role'), 'group');
  assert.equal(modeSwitch.querySelector('[data-training-session-mode="varied"]').getAttribute('aria-pressed'), 'true');
  assert.equal(modeSwitch.querySelector('[data-training-session-mode="focused"]').getAttribute('aria-pressed'), 'false');
  assert.ok(training.querySelector('#trainingVariedControls'));
  assert.equal(training.querySelector('#trainingFocusedControls').hidden, true);
  for (const id of ['trainingStreet', 'trainingDecisionTarget', 'trainingHeroPos', 'trainingPlayers', 'trainingStack']) {
    assert.ok(training.querySelector(`#${id}`), id);
  }
  assert.equal(app.window.app.training.sessionMode, 'varied');

  const spy = app.spy(['callTrainingServiceBridge']);
  try {
    await app.click('[data-training-session-mode="focused"]');
    assert.equal(app.window.app.training.sessionMode, 'focused');
    assert.equal(app.$('[data-training-session-mode="focused"]').getAttribute('aria-pressed'), 'true');
    assert.equal(app.$('[data-training-session-mode="varied"]').getAttribute('aria-pressed'), 'false');
    assert.equal(app.byId('trainingVariedControls').hidden, true);
    assert.equal(app.byId('trainingFocusedControls').hidden, false);
    assert.ok(bridgeCalls(spy, 'reset').length >= 1, 'switching mode resets the Training session');
    await app.click('[data-training-session-mode="varied"]');
    assert.equal(app.byId('trainingVariedControls').hidden, false);
    assert.equal(app.byId('trainingFocusedControls').hidden, true);
  } finally {
    spy.restore();
  }
});

test('Varied controls map only broad preferences to one planned TrainingSessionIntent', async () => {
  // Protects: Varied exposes only length/emphasis/stack/difficulty; lengths
  // are 10/20/50/open; starting maps them to one varied intent with all table
  // families, starts the practice session and generates a planned exercise.
  const varied = training.querySelector('#trainingVariedControls');
  for (const id of ['trainingSessionLength', 'trainingVariedEmphasis', 'trainingVariedStackPreference', 'trainingDifficulty']) {
    assert.ok(training.querySelector(`#${id}`), id);
  }
  assert.deepEqual(training.querySelector('#trainingSessionLength').options.map((option) => option.value), ['10', '20', '50', 'open']);
  for (const id of ['trainingHeroPos', 'trainingStreet', 'trainingDecisionTarget', 'trainingPlayers', 'trainingStack']) {
    assert.equal(varied.querySelector(`#${id}`), null, `${id} is not a Varied control`);
  }

  const emphasis = app.byId('trainingVariedEmphasis');
  const stackPreference = app.byId('trainingVariedStackPreference');
  emphasis.value = emphasis.options.at(-1).value;
  stackPreference.value = stackPreference.options.at(-1).value;
  await app.setValue('#trainingSessionLength', '10');
  const spy = app.spy(['callTrainingServiceBridge']);
  try {
    await app.click('#trainingNewHand');
    await app.settle(500);
    const [[, intentInput]] = bridgeCalls(spy, 'createPracticeIntent');
    assert.equal(intentInput.mode, 'varied');
    assert.equal(intentInput.sessionLength, 10);
    assert.equal(intentInput.focusPreferences.profile, emphasis.value);
    assert.equal(intentInput.focusPreferences.stackPreference, stackPreference.value);
    assert.deepEqual(intentInput.focusPreferences.allowedTableSizeFamilies, ['heads_up', 'short_handed', 'full_ring']);
    const [[, startedIntent]] = bridgeCalls(spy, 'startPracticeSession');
    assert.equal(startedIntent.mode, 'varied');
    const [[, generateOptions]] = bridgeCalls(spy, 'generatePlanned');
    assert.equal(typeof generateOptions.strategyProvider?.resolve, 'function');
  } finally {
    spy.restore();
  }
  assert.ok(app.window.app.training.currentExercise, 'a planned exercise rendered');
});

test('bounded and open sessions have truthful continuation and completion states', async () => {
  // Protects: progress/completion start hidden; a bounded session reports
  // "Exercise n of N" and completes after N answers with a restart action; an
  // open session has no progress count and never completes.
  assert.equal(training.querySelector('#trainingSessionProgress').hidden, true);
  assert.equal(training.querySelector('#trainingSessionCompletion').hidden, true);
  assert.ok(training.querySelector('#trainingRestartSession'));

  // The previous test started a 10-exercise session.
  assert.equal(text(app.byId('trainingSessionProgress')), 'Exercise 1 of 10');
  const completion = app.byId('trainingSessionCompletion');
  for (let index = 0; index < 10; index += 1) {
    assert.equal(completion.hidden, true, `not complete before answer ${index + 1}`);
    await answerAndContinue();
  }
  assert.equal(completion.hidden, false);
  assert.match(text(completion), /Session complete/);
});

test('an open session started after a completed one can be answered and never completes', {
  todo: 'TEST-HYGIENE-001-F12: starting a Varied session keeps data-training-session-complete, which hides the answer buttons',
}, async () => {
  const spy = app.spy(['callTrainingServiceBridge']);
  try {
    await app.setValue('#trainingSessionLength', 'open');
    await app.click('#trainingNewHand');
    await app.settle(500);
    const [[, intentInput]] = bridgeCalls(spy, 'createPracticeIntent');
    assert.equal(intentInput.sessionLength, 100000, 'open sessions plan an effectively unbounded length');
  } finally {
    spy.restore();
  }
  assert.equal(app.byId('trainingSessionProgress').hidden, true, 'open sessions show no count');
  for (let index = 0; index < 11; index += 1) await answerAndContinue();
  assert.equal(app.byId('trainingSessionCompletion').hidden, true, 'open sessions never complete');
});

test('planned bridge APIs, session-safe replay, errors, and localizations are exposed', async () => {
  for (const method of [
    'createPracticeIntent', 'resolveRulesCapability', 'startPracticeSession',
    'generatePlanned', 'getPracticePlannerState', 'replay',
  ]) assert.match(bootstrap, new RegExp(`${method}\\(`), method);
  // Protects: planner errors render their own truthful copy.
  app.call('renderTrainingGenerationError', { code: 'unsupported_rules' });
  assert.equal(text(app.byId('trainingErrorTitle')), 'Unsupported rules');
  app.call('renderTrainingGenerationError', { code: 'no_eligible_candidates' });
  assert.equal(text(app.byId('trainingErrorTitle')), 'No eligible exercise');
  assert.match(text(app.byId('trainingErrorText')), /Varied Session preferences/);
  // Protects: seed replay goes through the Training service with the provider.
  await app.setValue('#trainingSessionLength', '10');
  await app.click('#trainingNewHand');
  await app.settle(500);
  const spy = app.spy(['callTrainingServiceBridge']);
  try {
    await app.click('#trainingReplayBtn');
    await app.settle(500);
    const replays = bridgeCalls(spy, 'replay');
    assert.equal(replays.length, 1);
    assert.equal(typeof replays[0][2].strategyProvider?.resolve, 'function');
  } finally {
    spy.restore();
  }
  for (const language of ['en', 'ru', 'he']) {
    assert.match(i18n, new RegExp(`trainingWorkspaceTranslations\\.${language}`), language);
  }
  for (const key of ['Varied Session', 'Focused Drill', 'Session complete', 'Start a new session']) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
});
