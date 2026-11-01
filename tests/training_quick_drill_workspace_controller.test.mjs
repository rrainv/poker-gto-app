import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { bootApp } from './helpers/app-under-test.mjs';

// EXTRACT-QUICKDRILL-001: the mounted controller's contract
// (mount(container, deps) -> { dispose, refreshLanguage, handleKey, setVisible })
// and the one-way dependency: the module never reaches for window.app.

const app = await bootApp();
const $ = (selector) => app.$(selector);
const live = () => app.window.app.training;
const page = (code) => vm.runInThisContext(code);
const listenersOn = (node) => [...(node._listeners?.values() ?? [])].reduce((sum, list) => sum + list.length, 0);
const documentCount = (type) => app.window.document.listenerCount(type);

async function startVaried() {
  app.window.localStorage.removeItem('riverline_training_answer_mode');
  await app.training.start('varied');
  await app.waitFor(() => live().lifecycle === 'ready', 'a ready exercise');
}

test('logic.js mounts one controller with the contract methods', async () => {
  await startVaried();
  const controller = page('quickDrillController');
  assert.ok(controller, 'mounted by bindEvents');
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) {
    assert.equal(typeof controller[method], 'function', method);
  }
  assert.equal(controller.applies(), true, 'quick refresher is active in Varied');
});

test('setVisible shows and hides the drill container', async () => {
  const controller = page('quickDrillController');
  controller.setVisible(false);
  assert.equal($('#trainingQuickDrill').hidden, true);
  controller.setVisible(true);
  assert.equal($('#trainingQuickDrill').hidden, false);
});

test('handleKey reports whether it consumed the key', async () => {
  const controller = page('quickDrillController');
  const types = app.$$('#trainingGuessButtons .rl-action-card').map((card) => card.dataset.action);
  const key = (name) => ({ key: name, target: app.window.document.body });
  assert.equal(controller.handleKey(key('z')), false, 'unknown key is not consumed');
  assert.equal(controller.handleKey(key('1')), false, 'digits are not consumed by the drill');
  const letter = types.includes('fold') ? 'f' : types.includes('check') ? 'c' : 'a';
  assert.equal(controller.handleKey(key(letter)), true);
  assert.ok(live().quick.selected);
});

test('refreshLanguage rebuilds text and records nothing', async () => {
  const controller = page('quickDrillController');
  const before = live().quick.results.length;
  $('#quickDrillKeys').textContent = '';
  controller.refreshLanguage(live().currentExercise);
  assert.match($('#quickDrillKeys').textContent, /^Keys: F fold/);
  assert.equal(live().quick.results.length, before);
});

test('dispose removes every listener the drill added and clears the bound flag', async () => {
  const controller = page('quickDrillController');
  await app.training.answer();
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  const owned = () => [
    $('#quickDrillFeelButton'), $('#quickDrillAdjust'), $('#quickDrillConfirm'), $('#quickDrillSkip'),
    ...app.$$('[data-answer-mode-option]'),
    ...app.$$('#trainingGuessButtons .rl-action-card'),
    ...app.$$('#quickDrillPanels .rl-panel-card__toggle'),
  ];
  assert.ok(owned().every((node) => listenersOn(node) >= 1), 'every owned control is bound while mounted');
  const clicks = documentCount('click');
  const keydowns = documentCount('keydown');
  const controls = owned();

  controller.dispose();

  assert.equal(app.window.document.documentElement.dataset.quickDrillBound, undefined);
  assert.equal(documentCount('click'), clicks - 1, 'the outside-click listener is gone');
  assert.equal(documentCount('keydown'), keydowns - 1, 'the Escape listener is gone');
  assert.deepEqual(controls.filter((node) => listenersOn(node) > 0).map((node) => node.id || node.className), [],
    'no owned control keeps a listener');
  // Idempotent.
  controller.dispose();
  assert.equal(documentCount('click'), clicks - 1);
  // The Feel popover no longer reacts, and the old answer-mode subscription is released.
  await app.click('#quickDrillFeelButton');
  assert.equal($('#quickDrillFeel').hidden, true);
  const store = live().quick.answerMode;
  assert.ok(store);
  store.setMode('one_click');
  assert.equal($('[data-answer-mode-option="one_click"]').getAttribute('aria-pressed') !== 'true', true,
    'a disposed controller no longer syncs the controls');
  store.setMode('select');
});

test('a fresh mount after dispose works again and keeps the learner state', async () => {
  const results = live().quick.results.length;
  page('quickDrillController = null; mountQuickDrill();');
  assert.equal(app.window.document.documentElement.dataset.quickDrillBound, 'true');
  const controller = page('quickDrillController');
  assert.ok(controller);
  assert.equal(live().quick.results.length, results, 'state lives on app.training.quick, not in the controller');
  await app.click('#quickDrillFeelButton');
  assert.equal($('#quickDrillFeel').hidden, false);
  await app.click('#quickDrillFeelButton');
  assert.equal($('#quickDrillFeel').hidden, true);
  // Controls the old controller built are dead until the next spot rebuilds them.
  await startVaried();
  await app.training.answer();
  assert.equal(live().quick.results.length, 1, 'a new session starts a fresh result list');
  assert.ok(results >= 1);
});
