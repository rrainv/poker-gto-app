// TEST-HYGIENE-001: behavioural rewrite. Drives toasts, navigation, the
// sidebar, Hand showdown gating and Training answers in the running app
// instead of slicing logic.js / matching index.html and styles.css text.
import test from 'node:test';
import assert from 'node:assert/strict';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const toastElement = () => app.byId('toast');
const visible = (node) => {
  for (let current = node; current?.nodeType === 1; current = current.parentNode) {
    if (current.hidden || current.style.display === 'none') return false;
  }
  return true;
};

test('toast lifecycle supersedes, expires, and clears stale accessible text', () => {
  // Protects: a live polite status region; a newer toast replaces the text and
  // owns the timer; an expired toast clears its accessible text and scope.
  const region = markup.getElementById('toast');
  assert.equal(region.getAttribute('role'), 'status');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.getAttribute('aria-atomic'), 'true');

  app.call('toast', 'First notice', 'info', 'home');
  assert.equal(toastElement().textContent, 'First notice');
  assert.equal(toastElement().dataset.scope, 'home');
  app.advance(2000);
  app.call('toast', 'Second notice', 'warning', 'gto');
  assert.equal(toastElement().textContent, 'Second notice');
  assert.equal(toastElement().dataset.tone, 'warning');
  app.advance(1300); // the first toast's timer would have fired here
  assert.equal(toastElement().textContent, 'Second notice', 'a superseded timer does not clear the newer toast');
  app.advance(2000);
  assert.equal(toastElement().textContent, '');
  assert.equal(toastElement().classList.contains('show'), false);
  assert.equal(toastElement().dataset.scope, undefined);
});

test('mode and modal transitions clear workflow-scoped transient feedback', async () => {
  // Protects: switching workspace, opening Settings and taking a Hand action
  // clear any visible toast.
  app.call('toast', 'Stale', 'info');
  await app.navigate('analyze');
  assert.equal(toastElement().textContent, '');

  app.call('toast', 'Stale', 'info');
  await app.click('#openSettings');
  assert.equal(toastElement().textContent, '');
  await app.key(app.document.activeElement || app.document.body, 'Escape');
  app.byId('settingsModal')?.classList.remove('show');

  await app.startHand(['Ts', 'Td']);
  app.call('toast', 'Stale', 'warning');
  await app.handAction('call');
  assert.equal(toastElement().textContent, '');
});

test('analysis navigation selects, reveals, and focuses its actual destination', async () => {
  // Protects: "View all hands" selects the Range Matrix tab, shows its view,
  // scrolls it into view (smooth unless reduced motion) and focuses the tab.
  await app.navigate('analyze');
  const chartTab = app.$('[data-gto-view="chart"]');
  for (const reducedMotion of [false, true]) {
    app.environment.media.reducedMotion = reducedMotion;
    // The Motion setting follows the system preference by default.
    app.document.documentElement.dataset.motionMode = reducedMotion ? 'reduced' : 'standard';
    // A pointer click (earlier tests pressed keys, which the keyboard rule keeps instant).
    app.document.documentElement.dataset.motionInput = 'pointer';
    await app.click('[data-gto-view="context"]');
    app.byId('chartView')._scrolledIntoView = undefined;
    await app.click('#openCharts');
    assert.equal(chartTab.getAttribute('aria-selected'), 'true');
    assert.ok(chartTab.classList.contains('active'));
    assert.equal(app.byId('chartView').style.display, 'block');
    assert.equal(app.byId('contextView').style.display, 'none');
    assert.deepEqual(app.byId('chartView')._scrolledIntoView, { behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    assert.ok(app.document.activeElement === chartTab);
  }
  app.environment.media.reducedMotion = false;
  app.document.documentElement.dataset.motionMode = 'standard';
});

test('sidebar state has concrete expanded and collapsed layout contracts at narrow desktop widths', async () => {
  // Protects: the collapse button flips shell/rail state; at narrow desktop
  // widths the shell grid follows the state and expanded labels stay visible.
  const shell = app.$('.riverline-shell');
  const rail = app.byId('modeRail');
  const label = app.$('.mode-nav-item > span');
  const narrow = { width: 1100 };
  assert.equal(shell.dataset.sidebarState, 'expanded');
  assert.equal(rail.dataset.expanded, 'true');
  assert.match(css.cascaded(shell, 'grid-template-columns', narrow), /^var\(--sidebar-expanded-width\) /);
  assert.notEqual(css.cascaded(label, 'display', narrow), 'none');

  await app.click('#sidebarCollapseBtn');
  assert.equal(shell.dataset.sidebarState, 'collapsed');
  assert.equal(rail.dataset.expanded, 'false');
  assert.equal(app.byId('sidebarCollapseBtn').getAttribute('aria-expanded'), 'false');
  assert.match(css.cascaded(shell, 'grid-template-columns', narrow), /^var\(--sidebar-collapsed-width\) /);

  await app.click('#sidebarCollapseBtn');
  assert.equal(shell.dataset.sidebarState, 'expanded');
});

test('Hand presentation reads the isolated canonical deck and gates showdown resolution', async () => {
  // Protects: Hand deck counts come from the canonical hand; showdown can be
  // resolved only once the canonical showdown is ready.
  await app.startHand(['As', 'Ah']);
  assert.equal(text(app.byId('deckCount')), '50');
  const resolve = app.byId('handResolveShowdownButton');
  assert.equal(resolve.disabled, true);
  await app.handAction('all_in');
  await app.handAction('call');
  for (const cards of [['2c', '7d', '9h'], ['3s'], ['4d']]) {
    await app.dealBoard(cards);
    assert.equal(resolve.disabled, true, 'not before the showdown is ready');
  }
  // The Spot card summary (hidden in Hand) re-renders from the canonical deck.
  app.call('renderPlaybookCards');
  assert.equal(text(app.byId('deckCount')), '45');
  await app.pickCards('[data-card-set-edit="hand-seat-1"]', ['Kc', 'Kh']);
  await app.click('#handDealHoleButton');
  await app.settle(300);
  const state = app.call('callPlaybookStateBridge', 'getState');
  assert.equal(state.phase, 'showdown');
  assert.equal(state.showdown.status, 'ready');
  assert.equal(resolve.disabled, false);
  assert.ok(visible(resolve));
});

test('Training study hints and pricing copy remain truthful before and after an answer', async () => {
  // Protects: a hint control (no solution preview); after an answer the
  // comparison is labelled as after-answer; the facing copy is the canonical
  // decision-facing projection; answering goes through the Training service
  // and renders the analysis before the solution.
  const training = markup.getElementById('trainingMode');
  assert.ok(training.querySelector('#trainingSolutionEyebrow'));
  const hint = training.querySelector('#trainingRevealHint');
  assert.equal(hint.localName, 'button');
  assert.equal(text(hint), 'Get a hint');
  assert.equal(markup.getElementById('trainingShowSolution'), null);
  assert.match(text(training), /Get a nudge about the spot\./);
  assert.doesNotMatch(text(markup.body), /Study mode preview|Hints never reveal|never reveal the answer|does not change grading/i);

  await app.navigate('training');
  await app.click('#trainingNewHand');
  await app.settle(500);
  const exercise = app.window.app.training.currentExercise;
  assert.equal(app.call('formatTrainingFacingCopy', exercise.decisionContext), app.call('decisionFacingCopy', exercise.decisionContext));
  assert.equal(text(app.byId('trainingFacingVal')), app.call('decisionFacingCopy', exercise.decisionContext));

  const spy = app.spy(['callTrainingServiceBridge', 'renderTrainingDecisionAnalysis', 'showTrainingSolution']);
  try {
    const answer = app.$$('#trainingMode .training-action-button[data-action]').find((button) => visible(button) && !button.disabled);
    await app.click(answer);
    await app.settle(300);
    const answers = spy.calls.callTrainingServiceBridge.filter(([method]) => method === 'answer');
    assert.equal(answers.length, 1);
    assert.equal(answers[0][1], exercise.id);
    assert.equal(answers[0][2]?.type ?? answers[0][2], answer.dataset.action);
    const order = spy.sequence.filter((name) => name !== 'callTrainingServiceBridge');
    assert.ok(order.indexOf('renderTrainingDecisionAnalysis') >= 0);
    assert.ok(order.indexOf('renderTrainingDecisionAnalysis') < order.lastIndexOf('showTrainingSolution'));
  } finally {
    spy.restore();
  }
  const solution = text(app.byId('trainingMode'));
  assert.match(solution, /After-answer comparison/);
  assert.doesNotMatch(solution, /Strategy preview/);
});
