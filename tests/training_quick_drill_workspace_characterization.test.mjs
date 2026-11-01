import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';

// EXTRACT-QUICKDRILL-001: characterization of the quick drill workspace through
// the running app (bootApp), written BEFORE the code moved out of logic.js and
// kept unchanged after. It asserts observable behaviour only: DOM, app state
// and the page calls the drill makes. It must pass before and after the move.

const app = await bootApp();
const $ = (selector) => app.$(selector);
const live = () => app.window.app.training;
const cards = () => app.$$('#trainingGuessButtons .rl-action-card');
const ANSWER_MODE_KEY = 'riverline_training_answer_mode';

async function startVaried() {
  app.window.localStorage.removeItem(ANSWER_MODE_KEY);
  await app.training.start('varied');
  await app.waitFor(() => live().lifecycle === 'ready', 'a ready exercise');
}

test('state after mount: bound once, drill shown, composition placed, keys line rendered', async () => {
  await startVaried();
  assert.equal(app.window.document.documentElement.dataset.quickDrillBound, 'true');
  const quick = live().quick;
  for (const key of ['answer', 'answerMode', 'exerciseId', 'finishPending', 'openPanels', 'previousFacts', 'results', 'selected']) {
    assert.ok(key in quick, `app.training.quick.${key}`);
  }
  assert.equal(quick.selected, null);
  assert.equal(quick.answer, null);
  assert.equal(quick.finishPending, false);
  assert.equal(quick.exerciseId, live().currentExercise.id);
  assert.deepEqual([...quick.openPanels].sort(), ['glance', 'range']);
  assert.equal($('#trainingWorkspace').dataset.trainingQuick, 'true');
  assert.equal($('#trainingQuickDrill').hidden, false);
  assert.equal($('#quickDrillPanels').hidden, false);
  assert.equal($('#trainingSetupPanel').parentElement, $('#quickDrillSetupMount'));
  assert.equal($('#trainingDecisionControls').parentElement, $('#quickDrillActionLayer'));
  assert.equal($('#quickDrillZone').dataset.zoneState, 'actions');
  assert.equal($('#quickDrillActionLayer').hasAttribute('inert'), false);
  assert.equal($('#quickDrillFeedbackLayer').hasAttribute('inert'), true);
  assert.match($('#quickDrillKeys').textContent, /^Keys: F fold/);
  assert.equal($('#quickDrillConfirm').disabled, true);
  assert.equal($('#quickDrillConfirm .rl-confirm__label').textContent, 'Choose an action');
  assert.equal($('#quickDrillSkip').textContent, 'Skip');
  assert.equal($('#quickDrillFeel').hidden, true);
  assert.equal($('#quickDrillFeelButton').getAttribute('aria-expanded'), 'false');
  assert.equal(app.$$('.rl-session-dot').length, 10, 'varied session of ten shows ten dots');
});

test('Feel popover opens, closes on outside click and on Escape (focus returns)', async () => {
  await app.click('#quickDrillFeelButton');
  assert.equal($('#quickDrillFeel').hidden, false);
  assert.equal($('#quickDrillFeelButton').getAttribute('aria-expanded'), 'true');
  await app.click('#quickDrillFeelButton');
  assert.equal($('#quickDrillFeel').hidden, true);
  await app.click('#quickDrillFeelButton');
  await app.click('#quickDrillFelt');
  assert.equal($('#quickDrillFeel').hidden, true, 'an outside click closes it');
  await app.click('#quickDrillFeelButton');
  await app.key(app.window.document.body, 'Escape');
  assert.equal($('#quickDrillFeel').hidden, true);
  assert.equal(app.window.document.activeElement, $('#quickDrillFeelButton'));
});

test('Adjust drill toggles the setup panel', async () => {
  const setup = $('#trainingSetupPanel');
  const before = Boolean(setup.open);
  await app.click('#quickDrillAdjust');
  assert.equal(Boolean(setup.open), !before);
  await app.click('#quickDrillAdjust');
  assert.equal(Boolean(setup.open), before);
});

test('select then confirm (default mode): selecting only marks, confirm answers once', async () => {
  const spy = app.spy(['handleTrainingGuess', 'callTrainingMemoryBridge']);
  try {
    const first = cards()[0];
    await app.click(first);
    assert.equal(live().quick.selected, first.dataset.action);
    assert.equal(first.getAttribute('aria-pressed'), 'true');
    assert.equal(live().lifecycle, 'ready');
    assert.equal(spy.count('handleTrainingGuess'), 0);
    assert.match($('#quickDrillConfirm').textContent, /^\s*Confirm /);
    // Choosing another card moves the selection.
    const other = cards()[1];
    await app.click(other);
    assert.equal(live().quick.selected, other.dataset.action);
    assert.equal(first.getAttribute('aria-pressed'), 'false');
    await app.click('#quickDrillConfirm');
    await app.waitFor(() => live().lifecycle === 'feedback', 'feedback');
    assert.deepEqual(spy.calls.handleTrainingGuess.map(([type]) => type), [other.dataset.action]);
    // Training Memory write on answer: exactly one answered record, for this exercise.
    const writes = spy.calls.callTrainingMemoryBridge.filter(([method]) => method === 'recordExerciseAnswered');
    assert.equal(writes.length, 1, 'one Training Memory write per answer');
    assert.equal(live().quick.results.length, 1);
    assert.equal(live().quick.results[0].exerciseId, live().currentExercise.id);
    assert.equal(typeof live().quick.results[0].inside, 'boolean');
    assert.equal(live().quick.answer.verdict.kind !== undefined, true);
    assert.equal($('#quickDrillZone').dataset.zoneState, 'feedback');
    assert.equal($('#quickDrillActionLayer').hasAttribute('inert'), true);
    assert.equal($('#quickDrillFeedbackLayer').hasAttribute('inert'), false);
    assert.equal($('#quickDrillFeedbackLayer .quick-drill-feedback').dataset.inside, String(live().quick.answer.inside));
    assert.equal(app.window.document.activeElement, $('#trainingNextHandBtn'));
    assert.equal($('#trainingNextHandBtn').textContent, 'Next spot');
    assert.equal($('[data-panel="quick-drill-plan"]').dataset.locked, 'false');
    assert.equal(app.$$('.rl-session-dot[data-state="inside"], .rl-session-dot[data-state="outside"]').length, 1);
  } finally {
    spy.restore();
  }
});

test('feedback keys: E toggles Explain, L toggles Review later, Enter moves on', async () => {
  assert.equal($('#trainingWorkspace').dataset.quickDetails, undefined);
  await app.key(app.window.document.body, 'e');
  assert.equal($('#trainingWorkspace').dataset.quickDetails, 'open');
  assert.equal($('#quickDrillExplain').getAttribute('aria-expanded'), 'true');
  await app.key(app.window.document.body, 'E');
  assert.equal($('#trainingWorkspace').dataset.quickDetails, undefined);
  assert.equal($('#quickDrillExplain').getAttribute('aria-expanded'), 'false');
  const review = $('#quickDrillReviewLater');
  const clicked = [];
  review.addEventListener('click', () => clicked.push('review'));
  await app.key(app.window.document.body, 'l');
  assert.equal(clicked.length, review.hidden ? 0 : 1, 'L presses Review later when it is available');
  await app.key(app.window.document.body, 'Enter', { target: app.window.document.body });
  await app.waitFor(() => live().lifecycle === 'ready', 'the next spot after Enter');
  assert.equal($('#quickDrillZone').dataset.zoneState, 'actions');
  assert.equal(live().quick.selected, null);
  assert.equal(live().quick.answer, null);
});

test('ready keys: F/C/R/B/A select the matching card; digits and unknown keys do nothing', async () => {
  const types = cards().map((card) => card.dataset.action);
  const letters = { f: 'fold', c: types.includes('check') ? 'check' : 'call', b: 'bet', r: 'raise', a: 'all_in' };
  let exercised = 0;
  for (const [letter, type] of Object.entries(letters)) {
    if (!types.includes(type)) continue;
    await app.key(app.window.document.body, letter);
    assert.equal(live().quick.selected, type, `${letter} selects ${type}`);
    assert.equal($('#trainingGuessButtons .rl-action-card[aria-pressed="true"]').dataset.action, type);
    exercised += 1;
  }
  assert.ok(exercised >= 1, 'at least one letter key exercised');
  const selected = live().quick.selected;
  for (const key of ['1', '2', '6', 'z']) {
    await app.key(app.window.document.body, key);
    assert.equal(live().quick.selected, selected, `${key} changes nothing`);
    assert.equal(live().lifecycle, 'ready');
  }
  // Modifier chords never reach the drill.
  await app.key(app.window.document.body, 'f', { ctrlKey: true });
  assert.equal(live().quick.selected, selected);
  // Enter on a focused button is left to the browser.
  await app.key($('#quickDrillSkip'), 'Enter');
  assert.equal(live().lifecycle, 'ready');
  await app.key(app.window.document.body, 'Enter');
  await app.waitFor(() => live().lifecycle === 'feedback', 'Enter confirms the selection');
  assert.equal(live().quick.results.length, 2);
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
});

test('Enter with nothing selected does not answer', async () => {
  assert.equal(live().quick.selected, null);
  await app.key(app.window.document.body, 'Enter');
  assert.equal(live().lifecycle, 'ready');
});

test('panels open/close, state kept across spots; the plan stays locked until the answer', async () => {
  const toggle = () => $('[data-panel="quick-drill-session"] .rl-panel-card__toggle');
  const was = toggle().getAttribute('aria-expanded');
  await app.click(toggle());
  assert.notEqual(toggle().getAttribute('aria-expanded'), was);
  assert.equal(live().quick.panelsTouched, true);
  const planCard = () => $('[data-panel="quick-drill-plan"]');
  assert.equal(planCard().dataset.locked, 'true');
  assert.match(planCard().textContent, /Shown after you answer/);
  const open = toggle().getAttribute('aria-expanded');
  await app.training.answer();
  assert.equal(toggle().getAttribute('aria-expanded'), open, 'panel state survives the answer');
  assert.equal(planCard().dataset.locked, 'false');
  // Your plan (feedback row) opens the plan panel.
  await app.click('.quick-drill-feedback-actions .ui-button--secondary:last-child');
  assert.equal(live().quick.openPanels.has('plan'), true);
  assert.equal($('[data-panel="quick-drill-plan"] .rl-panel-card__toggle').getAttribute('aria-expanded'), 'true');
  assert.doesNotMatch($('#quickDrillPanels').textContent, /\[object|undefined|NaN/);
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  assert.equal(live().quick.openPanels.has('plan'), true, 'open set survives the spot change');
});

test('one click mode answers on the first click and hides Confirm', async () => {
  await app.click('#quickDrillFeelButton');
  await app.click('#quickDrillFeel [data-answer-mode-option="one_click"]');
  assert.equal($('#quickDrillConfirm').hidden, true);
  assert.equal(JSON.parse(app.window.localStorage.getItem(ANSWER_MODE_KEY)).mode, 'one_click');
  assert.equal($('[data-answer-mode-option="one_click"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('[data-answer-mode-option="select"]').getAttribute('aria-pressed'), 'false');
  const before = live().quick.results.length;
  await app.click(cards()[0]);
  await app.waitFor(() => live().lifecycle === 'feedback', 'one-click answer');
  assert.equal(live().quick.results.length, before + 1);
  // Keyboard letters answer at once in one-click mode too.
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  await app.key(app.window.document.body, cards()[0].dataset.action === 'fold' ? 'f' : cards()[0].dataset.action[0]);
  await app.waitFor(() => live().lifecycle === 'feedback', 'one-click key answer');
  await app.click('#quickDrillFeelButton');
  await app.click('#quickDrillFeel [data-answer-mode-option="select"]');
  assert.equal(JSON.parse(app.window.localStorage.getItem(ANSWER_MODE_KEY)).mode, 'select');
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  assert.equal($('#quickDrillConfirm').hidden, false, 'Confirm returns with the next spot');
});

test('language switch to Hebrew mid-drill keeps drill text translated, before and after an answer', async () => {
  const translate = (key, values) => app.window.t(key, values);
  const snapshot = () => ({
    keys: $('#quickDrillKeys').textContent,
    skip: $('#quickDrillSkip').textContent,
    confirm: $('#quickDrillConfirm .rl-confirm__label').textContent,
    source: $('#quickDrillSource').textContent,
    sub: $('#quickDrillSpotSub').textContent,
    panels: app.$$('#quickDrillPanels .rl-panel-card').map((card) => card.textContent).join('|'),
    tiles: app.$$('#quickDrillFacts .rl-fact-tile').map((tile) => tile.textContent).join('|'),
  });
  const english = snapshot();
  const resultsBefore = live().quick.results.length;
  app.window.setLanguage('he');
  try {
    await app.settle(200);
    const hebrew = snapshot();
    assert.notEqual(hebrew.keys, english.keys);
    assert.equal(hebrew.keys, translate('Keys: F fold · C check or call · B or R bet or raise · A all-in · Enter confirm, then next · U unsure · E explain · L review later'));
    // Recorded as-is (not fixed by this refactor): Skip is built once and is
    // not rebuilt on a language switch; Confirm is rebuilt.
    assert.equal(hebrew.skip, english.skip);
    assert.match(hebrew.confirm, /[֐-׿]/);
    assert.doesNotMatch(Object.values(hebrew).join(' '), /quickDrill\.|undefined|\[object/);
    assert.match(hebrew.panels, /[֐-׿]/, 'panel titles are Hebrew');
    assert.equal(live().lifecycle, 'ready', 'a language switch never answers or restarts');
    assert.equal(live().quick.results.length, resultsBefore, 'nothing is recorded again');
    await app.training.answer();
    const results = live().quick.results.length;
    const answered = $('#quickDrillFeedbackLayer').textContent;
    assert.match($('.quick-drill-answer-pill').textContent, /[֐-׿]/);
    app.window.setLanguage('en');
    await app.settle(200);
    assert.equal(live().quick.results.length, results, 'a refresh does not record the answer twice');
    assert.notEqual($('#quickDrillFeedbackLayer').textContent, answered);
    assert.match($('.quick-drill-answer-pill').textContent, /(inside|not in) the (baseline|source)'s mix/);
    assert.equal(live().quick.answer !== null, true);
    assert.equal(snapshot().keys, english.keys);
  } finally {
    app.window.setLanguage('en');
  }
  await app.training.next();
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
});

test('session end: Finish session shows the finish ring; restart clears it', async () => {
  for (let guard = 0; guard < 30 && !live().quick.finishPending; guard += 1) {
    if (live().lifecycle === 'feedback') await app.training.next();
    await app.waitFor(() => ['ready', 'feedback', 'complete'].includes(live().lifecycle), 'a decision');
    if (live().lifecycle === 'ready') await app.training.answer();
  }
  assert.equal(live().quick.finishPending, true);
  assert.equal($('#trainingNextHandBtn .quick-drill-next-label').textContent, 'Finish session');
  assert.equal($('#trainingSessionCompletion').hidden, true, 'completion waits for the ring');
  await app.click('#trainingNextHandBtn');
  assert.equal(live().quick.finishPending, false);
  assert.equal($('#quickDrillZone').dataset.zoneState, 'finish');
  assert.equal($('#trainingSessionCompletion').parentElement, $('#quickDrillZone'));
  assert.equal($('#trainingSessionCompletion').hidden, false);
  assert.equal($('#trainingNextHandBtn').hidden, true);
  const ring = $('#quickDrillFinishRing .rl-finish-ring');
  assert.match(ring.getAttribute('aria-label'), /^\d+ of 10 inside the baseline's mix$/);
  assert.equal(app.window.document.activeElement, $('#trainingRestartSession'));
  assert.equal($('#trainingSessionCompletionText').textContent, ring.getAttribute('aria-label'));
  await app.click('#trainingRestartSession');
  await app.waitFor(() => live().lifecycle === 'ready', 'a new session');
  assert.deepEqual(live().quick.results, []);
  assert.equal($('#quickDrillZone').dataset.zoneState, 'actions');
  assert.equal($('#quickDrillFinishRing').childElementCount, 0);
  assert.notEqual($('#trainingSessionCompletion').parentElement, $('#quickDrillZone'));
});

test('owner / sign-out switch: the drill keeps no answer, selection or finish state across it', async () => {
  await app.click(cards()[0]);
  assert.ok(live().quick.selected);
  const exerciseBefore = live().currentExercise?.id;
  app.window.dispatchEvent(new app.window.CustomEvent('riverline:authchange', { detail: { status: 'guest', ownerKey: 'guest-owner-A' } }));
  await app.settle(300);
  // Recorded as-is: the owner switch clears Training Memory presentation only
  // (memory generation bumps); the live drill state is neither answered nor finished.
  assert.equal(live().quick.answer, null);
  assert.equal(live().quick.finishPending, false);
  assert.equal(live().lifecycle === 'ready' || live().lifecycle === 'idle', true);
  assert.equal(live().currentExercise?.id, exerciseBefore);
  // A fresh session after the switch starts with a clean slate.
  await app.training.start('varied');
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  assert.deepEqual(live().quick.results, []);
  assert.equal(live().quick.selected, null);
  assert.equal(live().quick.answer, null);
  assert.equal(live().quick.finishPending, false);
  assert.equal(app.$$('.rl-session-dot[data-state="inside"], .rl-session-dot[data-state="outside"]').length, 0);
});

test('Full Hand and the old layout: the drill is off, hooks stay inert', async () => {
  await app.training.start('full_hand');
  assert.equal($('#trainingWorkspace').dataset.trainingQuick, 'false');
  assert.equal($('#trainingQuickDrill').hidden, true);
  assert.equal($('#quickDrillPanels').hidden, true);
  const before = JSON.stringify(live().quick.results);
  await app.key(app.window.document.body, 'f');
  assert.equal(JSON.stringify(live().quick.results), before, 'quick keys do not act in Full Hand');
  assert.equal($('#trainingSetupPanel').parentElement === $('#quickDrillSetupMount'), false);
  await app.training.start('varied');
  await app.waitFor(() => live().lifecycle === 'ready', 'ready');
  assert.equal($('#trainingWorkspace').dataset.trainingQuick, 'true');
  assert.equal($('#trainingQuickDrill').hidden, false);
});
