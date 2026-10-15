import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Training workspace is composed and driven in the running
// app and styles are resolved through the cascade. The locale catalog is
// outside this ticket.
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const trainingMarkup = indexDocument().getElementById('trainingMode');
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('training');
const workspace = () => app.byId('trainingWorkspace');

test('Training exposes one selected-configuration start action and retains a guarded lifecycle', async () => {
  // Protects: one Start Training action; starting or changing mode over an
  // active session asks first.
  assert.equal(trainingMarkup.querySelectorAll('#trainingNewHand').length, 1);
  assert.equal(trainingMarkup.querySelectorAll('[data-i18n="Start Training"]').length, 1);
  assert.equal(trainingMarkup.querySelector('#trainingIdleStart'), null);
  assert.equal(trainingMarkup.querySelector('#trainingNewHand').dataset.i18n, 'Start Training');
  await app.training.start('focused');
  let asked = 0;
  app.window.confirm = () => { asked += 1; return false; };
  const exercise = app.window.app.training.currentExercise;
  await app.click('#trainingNewHand');
  assert.equal(asked, 1, 'starting over asks');
  assert.equal(app.window.app.training.currentExercise, exercise);
  await app.click('[data-training-session-mode="varied"]');
  assert.equal(asked, 2, 'changing mode asks');
  assert.equal(app.window.app.training.sessionMode, 'focused', 'declining keeps the mode');
  app.window.confirm = () => true;
});

test('one stable decision and study-rail skeleton owns ready and feedback states', async () => {
  // Protects: one decision column and one insight column; the exercise precedes
  // feedback; the composed rail is the study rail; ready and feedback share the
  // same two-column grid.
  assert.equal(trainingMarkup.querySelector('.training-decision-column').localName, 'main');
  assert.equal(trainingMarkup.querySelector('.training-insight-column').localName, 'aside');
  assert.ok(precedes(trainingMarkup.querySelector('#trainingExerciseSurface'), trainingMarkup.querySelector('#trainingFeedback')));
  assert.ok(app.$('.training-insight-column').classList.contains('training-study-rail'));
  const node = workspace();
  const ready = css.cascaded(node, 'grid-template-columns');
  assert.equal(ready, 'minmax(0, 1fr) minmax(320px, 360px)');
  await app.training.answer();
  assert.equal(node.dataset.trainingState, 'feedback');
  assert.equal(css.cascaded(node, 'grid-template-columns'), ready);
  assert.equal(css.cascaded(node, 'grid-template-areas'), (() => { node.dataset.trainingState = 'ready'; const value = css.cascaded(node, 'grid-template-areas'); node.dataset.trainingState = 'feedback'; return value; })());
});

test('setup is a single disclosure that compacts on start and Adjust Drill reopens', async () => {
  const setup = trainingMarkup.querySelector('#trainingSetupPanel');
  assert.equal(trainingMarkup.querySelectorAll('#trainingSetupPanel').length, 1);
  assert.equal(setup.localName, 'details');
  assert.equal(setup.open, true);
  assert.ok(trainingMarkup.querySelector('.training-setup-summary'));
  assert.equal(app.byId('trainingSetupPanel').open, false, 'starting compacts the setup');
  await app.click('#trainingAdjustDrill');
  assert.equal(app.byId('trainingSetupPanel').open, true);
  assert.equal(app.document.activeElement, app.byId('trainingStreet'), 'Adjust Drill focuses the first drill control');
  app.call('clearTrainingSessionState');
  assert.equal(workspace().dataset.trainingState, 'idle');
  assert.equal(app.byId('trainingSetupPanel').open, true, 'idle reopens setup');
});

test('answer feedback stays compact and deep analysis is progressive disclosure', async () => {
  const verdict = trainingMarkup.querySelector('.training-verdict');
  assert.equal(verdict.getAttribute('role'), 'status');
  assert.equal(verdict.getAttribute('aria-live'), 'polite');
  assert.equal(verdict.getAttribute('aria-atomic'), 'true');
  assert.equal(trainingMarkup.querySelector('#trainingFeedback').getAttribute('role'), null);
  assert.ok(trainingMarkup.querySelector('[data-i18n="Facts"]'));
  const explain = trainingMarkup.querySelector('details.training-analysis-region > summary#trainingAnalysisTitle');
  assert.match(text(explain), /^Explain/);
  assert.ok(trainingMarkup.querySelector('#trainingFeedbackReferenceMount'));
  assert.ok(app.byId('trainingFeedbackReferenceMount').contains(app.byId('trainingSolution')), 'the solution is composed into feedback');
  await app.training.start('focused');
  const region = app.byId('trainingAnalysisTitle').closest('details');
  region.open = true;
  await app.training.answer();
  await app.training.next();
  assert.equal(region.open, false, 'Explain closes for each new exercise');
  region.open = true;
  const analysis = app.byId('trainingAnalysis');
  assert.ok(css.cascaded(analysis, 'max-block-size'));
  assert.equal(css.cascaded(analysis, 'overflow'), 'auto');
  region.open = false;
  assert.doesNotMatch(text(trainingMarkup), /^Coach$/m);
  assert.equal(trainingMarkup.querySelectorAll('*').filter((node) => node.childElementCount === 0 && text(node) === 'Coach').length, 0);
});

test('current-session progress and restrained source truth remain visible in the rail', async () => {
  assert.equal(trainingMarkup.querySelector('#trainingSessionProgress').getAttribute('aria-live'), 'polite');
  await app.training.start('varied');
  assert.match(text(app.byId('trainingSessionProgress')), /^Exercise \d+ of \d+$/);
  assert.ok(trainingMarkup.querySelector('#trainingReferenceSummary'));
  await app.training.answer();
  const reference = app.byId('trainingReferenceSummaryValue');
  const policy = app.call('strategyClaimPolicy', app.window.app.training.currentStrategyResult);
  assert.equal(reference.dataset.sourceFamily, policy.source.family);
  assert.ok(trainingMarkup.querySelector('#trainingTruthMetrics'));
  assert.equal(trainingMarkup.querySelectorAll('*').filter((node) => node.childElementCount === 0 && text(node) === 'Accuracy').length, 0);
  assert.match(css.cascaded(app.$('.training-session-panel .training-stat-grid'), 'grid-template-columns'), /^repeat\(2,/);
});

test('Memory, History, and Assistance are bounded study tools near the exercise', async () => {
  // Protects: the study rail orders setup, session, reference, history,
  // assistance and memory; Memory loads on open; Memory scrolls internally.
  const order = ['#trainingSetupPanel', '.training-session-panel', '#trainingReferenceSummary', '#trainingHistoryPanel', '.training-assistance-panel', '#trainingMemoryPanel']
    .map((selector) => app.$(selector));
  assert.ok(order.every(Boolean));
  order.slice(1).forEach((node, index) => assert.ok(precedes(order[index], node), `${order[index].id || order[index].className} before ${node.id || node.className}`));
  assert.equal(trainingMarkup.querySelector('#trainingMemoryPanel').dataset.trainingAvailability, 'ready-to-load');
  const spy = app.spy(['refreshTrainingMemoryPanel']);
  try {
    const memory = app.byId('trainingMemoryPanel');
    memory.open = false;
    memory.dispatchEvent(new app.window.Event('toggle'));
    assert.equal(spy.count('refreshTrainingMemoryPanel'), 0);
    memory.open = true;
    memory.dispatchEvent(new app.window.Event('toggle'));
    assert.equal(spy.count('refreshTrainingMemoryPanel'), 1);
  } finally {
    spy.restore();
  }
  const body = app.$('.training-memory-panel .panel-body');
  assert.ok(css.cascaded(body, 'max-block-size'));
  assert.equal(css.cascaded(body, 'overflow'), 'auto');
  assert.ok(trainingMarkup.querySelector('#trainingAssistanceLevel').classList.contains('badge'));
});

test('completion routes to existing longitudinal views without inventing mastery', async () => {
  assert.match(text(trainingMarkup.querySelector('#trainingCompletionReview')), /Review due items/);
  assert.match(text(trainingMarkup.querySelector('#trainingCompletionRecent')), /Recent sessions/);
  assert.match(text(trainingMarkup.querySelector('#trainingRestartSession')), /Start another session/);
  const spy = app.spy(['setTrainingMemoryView']);
  try {
    await app.click('#trainingCompletionReview');
    await app.click('#trainingCompletionRecent');
    assert.deepEqual(spy.calls.setTrainingMemoryView.map(([view]) => view), ['review', 'recent']);
  } finally {
    spy.restore();
  }
  assert.equal(app.byId('trainingMemoryPanel').open, true);
  assert.doesNotMatch(text(trainingMarkup), /mastery|mastered/i);
});

test('Focused and Full Hand retain their canonical controls within the shared composition', async () => {
  for (const mode of ['varied', 'focused', 'full_hand']) assert.ok(trainingMarkup.querySelector(`[data-training-session-mode="${mode}"]`), mode);
  await app.click('[data-training-session-mode="focused"]');
  assert.equal(app.byId('trainingDecisionTarget').closest('.ui-field').hidden, false, 'Focused shows the decision target');
  await app.click('[data-training-session-mode="full_hand"]');
  assert.equal(app.byId('trainingDecisionTarget').closest('.ui-field').hidden, true);
  await app.click('#trainingAdjustDrill');
  assert.equal(app.document.activeElement, app.byId('trainingHeroPos'), 'Full Hand setup focuses Hero position');
  for (const id of ['trainingFullHandTableMount', 'trainingFullHandTimeline']) assert.ok(trainingMarkup.querySelector(`#${id}`), id);
  const node = workspace();
  node.dataset.trainingFullHandPhase = 'live';
  assert.ok(css.matchingRules(node).some((rule) => rule.selectorText.includes('data-training-full-hand-phase="live"')));
  node.dataset.trainingFullHandPhase = 'setup';
});

test('new composition copy is complete for English, Russian, and Hebrew', () => {
  for (const key of [
    'Choose a mode in Session setup, then start Training.',
    'Facts',
    'Explain',
    'Review due items',
    'Start another session',
    'Reference source',
    'Session setup',
    'Session and study tools',
    'Exercise {current} of {total}',
  ]) {
    assert.ok((i18n.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`, 'g')) || []).length >= 3, `${key} is registered in EN/RU/HE`);
  }
  // RTL-safe: Training composition never uses physical inline spacing.
  for (const node of [workspace(), ...app.$$('#trainingWorkspace *')]) {
    for (const rule of css.matchingRules(node)) {
      if (!rule.selectorText.includes('training')) continue;
      for (const { property } of rule.declarations) {
        assert.doesNotMatch(property, /^(margin|padding)-(left|right)$|^(left|right)$/, `${rule.selectorText} { ${property} }`);
      }
    }
  }
});

test('keyboard answers, disclosures, focus, and reduced motion remain explicit', async () => {
  assert.equal(trainingMarkup.querySelector('#trainingNextHandBtn').getAttribute('aria-keyshortcuts'), 'Enter');
  assert.equal(app.evaluate('typeof handleTrainingKeyboardShortcut'), 'function');
  for (const id of ['trainingHistoryPanel', 'trainingMemoryPanel']) {
    const panel = trainingMarkup.querySelector(`#${id}`);
    assert.equal(panel.firstElementChild.localName, 'summary', id);
    assert.equal(css.cascaded(panel.firstElementChild, 'cursor'), 'pointer', `${id} summary`);
  }
  const probe = app.document.createElement('div');
  app.byId('trainingMode').appendChild(probe);
  // Reduced motion collapses (or removes) Training animation.
  assert.match(css.cascaded(probe, 'animation-duration', { reducedMotion: true }) || '', /^(0?\.01ms|none)$/);
  probe.remove();
  let focusOptions = null;
  const street = app.byId('trainingStreet');
  const focus = street.focus.bind(street);
  street.focus = (options) => { focusOptions = options; return focus(options); };
  await app.click('[data-training-session-mode="focused"]');
  app.call('setTrainingSetupExpanded', true, { focus: true });
  assert.deepEqual(focusOptions, { preventScroll: false });
});
