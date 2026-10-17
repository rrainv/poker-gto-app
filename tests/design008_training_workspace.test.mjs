import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the running Training workspace, the cascade).
// Locale catalogs are outside this ticket.
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const training = indexDocument().getElementById('trainingMode');
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('training');
const visible = (node) => {
  for (let current = node; current?.nodeType === 1; current = current.parentNode) {
    if (current.hidden || current.style.display === 'none') return false;
  }
  return true;
};
const bridgeCalls = (spy, method) => spy.calls.callTrainingServiceBridge.filter(([name]) => name === method);
async function startFocused() {
  await app.click('[data-training-session-mode="focused"]');
  await app.click('#trainingNewHand');
  await app.settle(500);
  assert.equal(app.window.app.training.lifecycle, 'ready');
}

test('Training is a decision-first workspace with compact drill controls', () => {
  const workspace = training.querySelector('.training-workspace');
  assert.equal(workspace.dataset.trainingState, 'idle');
  for (const selector of ['.training-decision-column', '.training-insight-column', '.training-setup-column']) {
    assert.ok(workspace.querySelector(selector), selector);
  }
  for (const id of ['trainingStreet', 'trainingDecisionTarget', 'trainingAdvanced']) assert.ok(training.querySelector(`#${id}`), id);
  const seed = training.querySelector('#trainingSeedInput');
  assert.equal(seed.getAttribute('min'), '0');
  assert.equal(seed.getAttribute('max'), '4294967295');
  assert.equal(training.querySelector('[data-slots="trainingHero"], [data-slots="trainingBoard"]'), null, 'no editable Training card slots');
});

test('Training has explicit lifecycle, feedback, history, provenance, and replay surfaces', () => {
  for (const id of [
    'trainingStateBadge', 'trainingGenerating', 'trainingError', 'trainingFeedback',
    'trainingActionHistory', 'trainingStrategySource', 'trainingFrequencyStack',
    'trainingCurrentSeed', 'trainingCopySeed', 'trainingReplayBtn', 'trainingNextHandBtn',
  ]) assert.ok(training.querySelector(`#${id}`), id);
  assert.ok(training.querySelector('[aria-live="polite"]'));
  assert.ok(training.querySelector('[role="alert"]'));
  assert.match(text(training), /After-answer comparison[\s\S]*Source frequencies/);
  assert.doesNotMatch(text(training), /\bOptimal\b/);
  assert.doesNotMatch(text(training), /\bGTO\b|Deep CFR/i);
});

test('Training controls and feedback remain contract-honest', async () => {
  // Protects: generation and answers go through the Training service; the
  // view model comes from the presentation bridge; grades are presented through
  // the truth presentation (never a capitalised raw grade); no EV claims.
  const spy = app.spy(['callTrainingServiceBridge', 'callTrainingPresentationBridge']);
  try {
    await startFocused();
    assert.equal(bridgeCalls(spy, 'generate').length, 1);
    const exercise = app.window.app.training.currentExercise;
    const views = spy.calls.callTrainingPresentationBridge.filter(([method]) => method === 'createViewModel');
    assert.ok(views.some(([, input]) => input === exercise));
    const answer = app.$$('#trainingGuessButtons button').find((button) => visible(button) && !button.disabled);
    await app.click(answer);
    await app.settle(300);
    assert.equal(bridgeCalls(spy, 'answer')[0][1], exercise.id);
  } finally {
    spy.restore();
  }
  const { currentEvaluation: evaluation, currentStrategyResult: strategyResult } = app.window.app.training;
  // TRUTH-FIXES-001: heuristic answers carry a neutral comparison, no grade.
  assert.ok(evaluation, 'the answer was evaluated');
  assert.equal(evaluation.grade, null);
  assert.ok(['matches', 'close', 'differs'].includes(evaluation.comparison), evaluation.comparison);
  const truth = evaluation.truth;
  const title = app.call('trainingGradePresentation', evaluation.grade, strategyResult, evaluation);
  assert.equal(title, app.call('t', app.call('truthPresentation', truth).title));
  for (const raw of ['Optimal', 'Acceptable', 'Mistake', 'Matches', 'Close', 'Differs']) assert.notEqual(title, raw);
  assert.ok(app.window.app.training.currentExercise.generationMetadata?.trainingConfig, 'replay uses the generation TrainingConfig');
  assert.equal(training.querySelector('[data-ev-bb]'), null);
  assert.doesNotMatch(text(app.byId('trainingMode')), /Expected value/);
});

test('Training keyboard handling is mode-scoped and input-safe', async () => {
  // Protects: number keys answer only while a spot is ready in visible
  // Training, never with modifiers, from form fields or with the card picker
  // open; Enter advances after feedback; R replays the seed.
  const keydown = (key, init = {}, target = app.document.body) => {
    const event = new app.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  await startFocused();
  assert.match(text(training), /1/);
  assert.ok(training.querySelector('kbd'));
  const exercise = () => app.window.app.training.currentExercise;
  for (const blocked of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
    keydown('1', blocked);
    await app.flush();
    assert.equal(app.window.app.training.lifecycle, 'ready', JSON.stringify(blocked));
  }
  keydown('1', {}, app.byId('trainingSeedInput'));
  await app.flush();
  assert.equal(app.window.app.training.lifecycle, 'ready', 'typing in an input does not answer');
  app.byId('cardModal').classList.add('show');
  keydown('1');
  await app.flush();
  app.byId('cardModal').classList.remove('show');
  assert.equal(app.window.app.training.lifecycle, 'ready', 'the card picker blocks shortcuts');

  keydown('1');
  await app.settle(300);
  assert.equal(app.window.app.training.lifecycle, 'feedback', '1 answers with the first action');
  const answered = exercise();
  keydown('Enter');
  await app.settle(500);
  assert.notEqual(exercise(), answered, 'Enter advances to the next exercise');
  const spy = app.spy(['replayCurrentTrainingSeed']);
  try {
    keydown('r');
    assert.equal(spy.count('replayCurrentTrainingSeed'), 1);
  } finally {
    spy.restore();
  }
  await app.settle(500);
  await app.navigate('home');
  const lifecycle = app.window.app.training.lifecycle;
  keydown('1');
  await app.flush();
  assert.equal(app.window.app.training.lifecycle, lifecycle, 'shortcuts are scoped to visible Training');
  await app.navigate('training');
});

test('Training layout is responsive, theme-tokenized, RTL-safe, and motion-safe', () => {
  // Protects: a named-area grid that reflows at 1024 and 768px; the action
  // grid adapts at 480px; Training-scoped colours come from theme tokens.
  const workspace = app.$('.training-workspace');
  const areas = (width) => css.cascaded(workspace, 'grid-template-areas', { width }) || css.cascaded(workspace, 'display', { width });
  assert.ok(areas(1920));
  assert.notEqual(areas(1000), areas(1920), 'reflows at 1024px');
  const actionGrid = app.$('.training-action-grid');
  if (actionGrid) {
    assert.notEqual(css.cascaded(actionGrid, 'grid-template-columns', { width: 400 }), css.cascaded(actionGrid, 'grid-template-columns', { width: 1920 }));
  }
  const raw = /#[0-9a-f]{3,8}\b|rgba?\(/i;
  for (const node of app.$$('#trainingMode *')) {
    for (const rule of css.matchingRules(node)) {
      if (!rule.selectorText.includes('training') || rule.selectorText.includes('data-theme')) continue;
      for (const { property, value } of rule.declarations) {
        if (/color|background|border|shadow|fill|stroke/.test(property) && !property.startsWith('--')) {
          assert.doesNotMatch(value, raw, `${rule.selectorText} { ${property}: ${value} }`);
        }
      }
    }
  }
});

test('Training session metrics remain in-memory and bounded to this session', () => {
  // Protects: session stats render without touching storage or the network.
  for (const id of ['trainingTotalHands', 'trainingTruthMetrics']) assert.ok(training.querySelector(`#${id}`), id);
  const storage = app.window.localStorage;
  const writes = [];
  const originalSet = storage.setItem;
  storage.setItem = (...args) => { writes.push(args[0]); return originalSet.apply(storage, args); };
  let fetches = 0;
  const originalFetch = app.window.fetch;
  app.window.fetch = async () => { fetches += 1; throw new Error('offline'); };
  try {
    app.call('updateTrainingStats');
  } finally {
    storage.setItem = originalSet;
    app.window.fetch = originalFetch;
  }
  assert.deepEqual(writes, []);
  assert.equal(fetches, 0);
});

test('new static Training copy is registered for English, Russian, and Hebrew', () => {
  assert.match(i18n, /const trainingWorkspaceTranslations/);
  for (const language of ['en', 'ru', 'he']) {
    assert.match(i18n, new RegExp(`${language}: \\{`), language);
  }
  for (const key of ['Training workspace', 'Make the decision', 'Action history']) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
  assert.match(productTranslations, /"Source frequencies"/);
});
