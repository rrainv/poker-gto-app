// TEST-HYGIENE-001: behavioural rewrite. Drives the running Training workspace
// and spies on page functions instead of slicing logic.js / index.html text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

const markup = indexDocument();
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const nativeRandom = Math.random;
const app = await bootApp();
// Imported after boot: the adapter loads a self-installing bootstrap module.
const { createProductionPickerHarness } = await import('./uiqa001r_card_picker_adapter.mjs');
await app.navigate('training');

const visible = (node) => {
  for (let current = node; current?.nodeType === 1; current = current.parentNode) {
    if (current.hidden || current.style.display === 'none') return false;
  }
  return true;
};
const bridgeCalls = (spy, method) => spy.calls.callTrainingServiceBridge.filter(([name]) => name === method);
const actionButtons = () => app.$$('#trainingMode .training-action-button[data-action]').filter((button) => visible(button));

test('production Training route uses the canonical bridge and shared StrategyProvider instance', async () => {
  // Protects: Focused and Varied generation go through the Training service
  // with the Playbook's StrategyProvider instance; answers go through the
  // service; Start is guarded by a confirm while a session is active and an
  // abandoned session is finished in Training Memory; answer buttons call
  // handleTrainingGuess; Math.random is never replaced.
  const provider = app.evaluate('strategyProvider');
  const spy = app.spy(['callTrainingServiceBridge', 'startConfiguredTrainingSessionWithGuard', 'handleTrainingGuess', 'finishTrainingMemorySession']);
  try {
    await app.click('[data-training-session-mode="focused"]');
    await app.click('#trainingNewHand');
    await app.settle(500);
    assert.equal(spy.count('startConfiguredTrainingSessionWithGuard'), 1);
    const [generate] = bridgeCalls(spy, 'generate');
    assert.equal(generate[1].schemaVersion?.startsWith('training-config/'), true);
    assert.equal(generate[2].strategyProvider, provider, 'the shared StrategyProvider instance');

    const exercise = app.window.app.training.currentExercise;
    const button = actionButtons().find((candidate) => !candidate.disabled);
    await app.click(button);
    await app.settle(300);
    assert.deepEqual(spy.calls.handleTrainingGuess.map(([type]) => type), [button.dataset.action]);
    const [answer] = bridgeCalls(spy, 'answer');
    assert.equal(answer[1], exercise.id);

    // An active session asks before starting over; declining keeps it.
    await app.click('#trainingNextHandBtn');
    await app.settle(300);
    const active = app.window.app.training.currentExercise;
    app.window.confirm = () => false;
    await app.click('#trainingNewHand');
    await app.settle(300);
    assert.equal(app.window.app.training.currentExercise, active, 'declining keeps the active session');
    app.window.confirm = () => true;
    spy.reset();
    await app.click('[data-training-session-mode="varied"]');
    assert.deepEqual(spy.calls.finishTrainingMemorySession.map(([status]) => status), ['abandoned']);
    await app.click('#trainingNewHand');
    await app.settle(500);
    const [planned] = bridgeCalls(spy, 'generatePlanned');
    assert.equal(planned[1].strategyProvider, provider);
  } finally {
    spy.restore();
  }
  assert.equal(Math.random, nativeRandom, 'Training never replaces Math.random');
  // SOURCE-SHAPE: classic-script function declarations are window properties
  // at runtime either way, so "no explicit window.X export" is only visible in
  // the source text.
  assert.doesNotMatch(logic, /window\.(?:newRandomTrainingHand|handleTrainingGuess|replayTrainingExercise|resetTrainingStats)\s*=/);
});

test('Full Hand sizing actions open the sizing choice instead of answering directly', async () => {
  // Protects: in Full Hand, bet/raise go to the sizing chooser; other actions answer.
  await app.click('[data-training-session-mode="full_hand"]');
  await app.click('#trainingNewHand');
  await app.settle(2000);
  const spy = app.spy(['handleTrainingGuess', 'chooseFullHandTrainingSizedAction']);
  try {
    const sized = actionButtons().find((button) => ['bet', 'raise'].includes(button.dataset.action) && !button.disabled);
    assert.ok(sized, 'a sized action is offered');
    await app.click(sized);
    assert.deepEqual(spy.sequence, ['chooseFullHandTrainingSizedAction']);
  } finally {
    spy.restore();
  }
  await app.click('[data-training-session-mode="focused"]');
  await app.click('#trainingNewHand');
  await app.settle(500);
});

test('Training controls become TrainingConfig filters instead of synthetic final-state fields', () => {
  // Protects: controls map to TrainingConfig filters; the decision context is
  // projected for presentation (call amount) and the guided hint names MDF as a
  // range-level reference.
  const spy = app.spy(['callTrainingServiceBridge']);
  let config;
  try {
    config = app.call('readTrainingConfig', 1234);
  } finally {
    spy.restore();
  }
  const [[, filters]] = bridgeCalls(spy, 'createConfigFromLegacyCompatibility');
  assert.deepEqual(Object.keys(filters).filter((key) => key !== 'schemaVersion').sort(),
    ['allowedDecisionTypes', 'difficulty', 'gameMode', 'heroPositions', 'seed', 'stackBb', 'streets', 'tableSize']);
  assert.equal(filters.tableSize, Number(app.byId('trainingPlayers').value));
  assert.equal(filters.stackBb, Number(app.byId('trainingStack').value));
  assert.equal(filters.difficulty, app.byId('trainingDifficulty').value);
  assert.equal(filters.seed, 1234);
  assert.ok(filters.allowedDecisionTypes.length > 0);
  assert.ok(config && config.schemaVersion, 'the service returns a TrainingConfig');
  const context = app.window.app.training.currentExercise.decisionContext;
  const legacy = app.call('trainingContextPresentationAdapter', context);
  assert.ok('callAmount' in legacy);

  const saved = app.window.app.training.currentContext;
  const difficulty = app.byId('trainingDifficulty');
  const previous = difficulty.value;
  app.window.app.training.currentContext = { hero_pos: 'BB', facingSize: 2.5, callAmount: 1.5, potOdds: 30, mdf: 60 };
  difficulty.value = 'guided';
  app.call('updateAssistanceDisplay');
  assert.match(text(app.byId('trainingHintText')), /range-level reference, not a threshold for this hand/);
  difficulty.value = previous;
  app.window.app.training.currentContext = saved;
  app.call('updateAssistanceDisplay');
});

test('answer controls are rendered only from canonical legal-action availability', () => {
  // Protects: the rendered answer buttons are exactly the canonical legal
  // actions of the exercise.
  const exercise = app.window.app.training.currentExercise;
  const legal = app.call('canonicalTrainingLegalActionTypes', exercise);
  assert.ok(legal.length >= 2);
  assert.deepEqual(actionButtons().map((button) => button.dataset.action), legal);
  const spec = exercise.legalActions;
  for (const type of ['fold', 'check', 'call', 'bet', 'raise']) {
    assert.equal(legal.includes(type), Boolean(spec[type]?.available), type);
  }
  assert.equal(legal.includes('all_in'), Boolean(spec.allIn?.available));
});

test('Training cards are generated read-only projections and manual mutation paths are guarded', () => {
  // Protects: the picker refuses Training groups; Training cards mirror the
  // generated presentation.
  const picker = createProductionPickerHarness();
  picker.openPicker('trainingHero', 0);
  assert.equal(picker.app.picker, null);
  const training = app.window.app.training;
  assert.deepEqual(training.hero, [...training.currentPresentation.heroCards]);
  assert.deepEqual(training.board, [...training.currentPresentation.board]);
  app.call('openPicker', 'trainingHero', 0);
  assert.equal(app.window.app.picker ?? null, null, 'the real picker refuses Training cards');
});

test('canonical feedback retains source provenance and avoids unsupported GTO or solver claims', () => {
  // Protects: feedback copy is the truth presentation of the evaluation and
  // never claims GTO/solver authority; Training shows a source element.
  const training = app.window.app.training;
  if (training.currentEvaluation) {
    const feedback = app.call('canonicalTrainingFeedback', training.currentEvaluation, training.currentStrategyResult);
    const truth = app.call('truthPresentation', app.call('trainingTruth', training.currentEvaluation));
    assert.equal(feedback.title, truth.title);
    assert.doesNotMatch(`${feedback.title} ${feedback.text}`, /Riverline reference|Correct action|Mistake|\bGTO\b|\bsolver\b|Deep CFR/i);
  }
  for (const verdict of ['agreement', 'close', 'difference', 'unavailable']) {
    const feedback = app.call('canonicalTrainingFeedback', { truth: { verdict } }, null);
    assert.doesNotMatch(`${feedback.title} ${feedback.text}`, /\bGTO\b|\bsolver\b|Deep CFR/i);
  }
  assert.ok(markup.getElementById('trainingStrategySource'));
  assert.doesNotMatch(text(markup.getElementById('trainingMode')), /\bGTO\b|Deep CFR/i);
});

test('Training module bridge loads before classic application logic', () => {
  const sources = markup.querySelectorAll('script[src]');
  const bridge = sources.find((script) => script.getAttribute('src').includes('src/application/training-mode-bootstrap.mjs'));
  const logicScript = sources.find((script) => script.getAttribute('src').includes('src/core/logic.js'));
  assert.ok(bridge && logicScript && precedes(bridge, logicScript));
});

test('canonical Training errors remain explicit without an alternate fallback route', async () => {
  // Protects: a failed or missing Training service renders an explicit error
  // state instead of falling back to another generator.
  const bridge = app.window.RiverlineTrainingService ?? null;
  const spy = app.spy(['renderTrainingGenerationError']);
  const original = app.window.callTrainingServiceBridge;
  app.window.callTrainingServiceBridge = (method, ...args) => (method === 'generatePlanned' || method === 'generate' ? null : original(method, ...args));
  try {
    await app.click('#trainingNewHand');
    await app.settle(500);
    assert.equal(spy.calls.renderTrainingGenerationError.at(-1)[0].code, 'service_unavailable');
    assert.equal(app.$('.training-workspace').dataset.trainingState, 'error');
  } finally {
    app.window.callTrainingServiceBridge = original;
    spy.restore();
  }
  assert.equal(app.window.RiverlineTrainingService ?? null, bridge);
});
