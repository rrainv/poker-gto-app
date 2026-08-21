import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const training = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="infoMode"'));

test('Varied Session is the accessible default and Focused Drill retains its exact controls', () => {
  assert.match(training, /id="trainingModeSwitch"[^>]+role="group"/);
  assert.match(training, /data-training-session-mode="varied"[^>]+aria-pressed="true"/);
  assert.match(training, /data-training-session-mode="focused"[^>]+aria-pressed="false"/);
  assert.match(training, /id="trainingVariedControls"/);
  assert.match(training, /id="trainingFocusedControls"[^>]+hidden/);
  for (const id of [
    'trainingStreet', 'trainingDecisionTarget', 'trainingHeroPos', 'trainingPlayers', 'trainingStack',
  ]) assert.match(training, new RegExp(`id="${id}"`), id);
  assert.match(logic, /sessionMode: 'varied'/);
  assert.match(logic, /function setTrainingSessionMode/);
  assert.match(logic, /callTrainingServiceBridge\('reset'\)/);
});

test('Varied controls map only broad preferences to one planned TrainingSessionIntent', () => {
  for (const id of [
    'trainingSessionLength', 'trainingVariedEmphasis', 'trainingVariedStackPreference', 'trainingDifficulty',
  ]) assert.match(training, new RegExp(`id="${id}"`), id);
  assert.match(training, /value="10"[\s\S]*value="20"[\s\S]*value="50"[\s\S]*value="open"/);
  assert.match(logic, /mode: 'varied'/);
  assert.match(logic, /profile: \$\('#trainingVariedEmphasis'\)\?\.value/);
  assert.match(logic, /stackPreference: \$\('#trainingVariedStackPreference'\)\?\.value/);
  assert.match(logic, /allowedTableSizeFamilies: \['heads_up', 'short_handed', 'full_ring'\]/);
  assert.match(logic, /callTrainingServiceBridge\('startPracticeSession', session\.intent\)/);
  assert.match(logic, /callTrainingServiceBridge\('generatePlanned', \{ strategyProvider \}\)/);
  assert.doesNotMatch(training.slice(
    training.indexOf('id="trainingVariedControls"'),
    training.indexOf('id="trainingFocusedControls"'),
  ), /trainingHeroPos|trainingStreet|trainingDecisionTarget|trainingPlayers|trainingStack/);
});

test('bounded and open sessions have truthful continuation and completion states', () => {
  assert.match(training, /id="trainingSessionProgress"[^>]+hidden/);
  assert.match(training, /id="trainingSessionCompletion"[^>]+hidden/);
  assert.match(training, /id="trainingRestartSession"/);
  assert.match(logic, /sessionLength: length === null \? 100000 : length/);
  assert.match(logic, /if \(!progress \|\| !session \|\| session\.mode !== 'varied' \|\| session\.isOpen\)/);
  assert.match(logic, /function completeVariedTrainingSession/);
  assert.match(logic, /completeVariedTrainingSession\(\);/);
  assert.match(logic, /function requestNextTrainingExercise/);
});

test('planned bridge APIs, session-safe replay, errors, and localizations are exposed', () => {
  for (const method of [
    'createPracticeIntent', 'resolveRulesCapability', 'startPracticeSession',
    'generatePlanned', 'getPracticePlannerState', 'replay',
  ]) assert.match(bootstrap, new RegExp(`${method}\\(`), method);
  assert.match(logic, /unsupported_rules/);
  assert.match(logic, /no_eligible_candidates/);
  assert.match(logic, /callTrainingServiceBridge\('replay', config, \{ strategyProvider \}\)/);
  for (const language of ['en', 'ru', 'he']) {
    assert.match(i18n, new RegExp(`trainingWorkspaceTranslations\\.${language}`), language);
  }
  for (const key of ['Varied Session', 'Focused Drill', 'Session complete', 'Start a new session']) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
});
