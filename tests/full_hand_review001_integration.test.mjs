import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../app/src/saved-study-objects/index.mjs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, a completed canonical Hand and Full-Hand
// Training reviewed in the running app, and the cascade. Bootstrap, service,
// i18n and tutorial sources are outside this ticket.
const [bootstrap, trainingBootstrap, savedService, i18n, tutorials, tutorialI18n] = await Promise.all([
  readFile(new URL('../app/src/application/hand-review-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-study-object-service.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/current-app-tutorials.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();

function exactDecisionContext() {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Ks'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  };
}

test('Hand and Full-Hand Training mount one shared post-hand Review surface', () => {
  assert.equal(markup.querySelectorAll('#handReviewSurface').length, 1);
  assert.ok(markup.getElementById('handReviewMount'));
  assert.ok(markup.getElementById('trainingHandReviewMount'));
  assert.equal(markup.getElementById('trainingFullHandReviewLegacy'), null);
  assert.equal(markup.querySelector('[id*="trainingFullHandReviewLegacy"], [class*="trainingFullHandReviewLegacy"]'), null);
  assert.equal(markup.getElementById('trainingFullHandReview'), null);
  const surface = markup.getElementById('handReviewSurface');
  assert.ok(markup.querySelector('[data-tutorial-anchor="hand-review"]'));
  assert.equal(surface.querySelector('#handReviewReplayStatus').getAttribute('aria-live'), 'polite');
  assert.ok(markup.querySelector('[aria-label="Hero decision navigation"]'));
  assert.ok(markup.getElementById('handReviewOpponents'));
  // Protects: the Hand Review bridge installs before the classic runtime.
  const scripts = markup.querySelectorAll('script[src]');
  const bridge = scripts.find((script) => script.getAttribute('src').endsWith('hand-review-bootstrap.mjs'));
  const logicScript = scripts.find((script) => script.getAttribute('src').split('?')[0] === 'src/core/logic.js');
  assert.ok(bridge && logicScript);
  assert.ok(precedes(bridge, logicScript), 'the bridge must install before classic runtime wiring');
});

let reviewCapture = null;
test('shared runtime uses canonical journals, exact Replay seeks, provider cache, and source-gated labels', async () => {
  assert.match(bootstrap, /createHandReviewProjector/);
  // Protects: a completed canonical Hand is reviewed from its Hero decision
  // journal through the shared projector, keyed by the strategy provider.
  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  const journal = app.call('callPlaybookStateBridge', 'getHeroDecisionJournal');
  assert.equal(journal.status, 'complete');
  assert.ok(journal.decisions.length >= 1);
  assert.ok(app.call('openCanonicalHandReview'));
  await app.settle(200);
  const review = app.window.app.handReview;
  assert.equal(review.source, 'canonical_hand');
  app.evaluate(`(() => {
    const original = handReviewProjector;
    globalThis.__reviewInputs = [];
    handReviewProjector = { ...original, project: (input) => { globalThis.__reviewInputs.push(input); return original.project(input); } };
    globalThis.__restoreReviewProjector = () => { handReviewProjector = original; };
  })()`);
  const spy = app.spy(['activeHandReviewReplayOperation', 'truthPresentation', 'trainingTruthSummaryText', 'openCanonicalHandDecisionInAnalysis', 'callSavedStudyBridge']);
  try {
    // Exact Replay seek: selecting a decision seeks its replay frame.
    const model = app.call('selectActiveHandReviewDecision', 0);
    const target = model.decisions[0].replayFrameTarget.frameIndex;
    assert.deepEqual(spy.calls.activeHandReviewReplayOperation.at(-1), ['select', target]);
    const [input] = app.window.__reviewInputs;
    assert.equal(input.source, 'canonical_hand');
    assert.deepEqual(input.decisions.map(({ decisionId }) => decisionId), journal.decisions.map(({ decisionId }) => decisionId));
    const cacheKey = JSON.parse(input.providerCacheKey);
    assert.equal(cacheKey.provider, app.evaluate('strategyProvider.schemaVersion'));
    assert.ok('options' in cacheKey);

    // Source-gated truth labels and summaries.
    app.call('renderActiveHandReview');
    assert.ok(spy.count('truthPresentation') >= 1);
    assert.ok(spy.count('trainingTruthSummaryText') >= 1);
    const current = app.window.app.handReview.model;
    assert.equal(text(app.byId('handReviewAlignmentSummary')), app.call('trainingTruthSummaryText', current.overview.truthSummary));
    // Priority comes from the accepted assessment, never an EV-loss score.
    assert.doesNotMatch(JSON.stringify(current.decisions.map(({ reviewPriority }) => reviewPriority ?? null)), /evLoss/i);

    // Read-only review cards share the Training/Riverline card classes.
    const cards = app.$$('#handReviewSurface .hand-review-card');
    assert.ok(cards.length > 0);
    for (const card of cards) assert.equal(card.className, 'hand-review-card training-readonly-card riverline-card');

    // Analyze opens the selected canonical decision; Save Spot uses the
    // reviewed-decision save path.
    await app.click('#handReviewAnalyze');
    await app.settle(300);
    assert.deepEqual(spy.calls.openCanonicalHandDecisionInAnalysis[0], [current.selectedDecisionIndex]);
    await app.navigate('hand');
    if (app.byId('handReviewSurface').hidden) app.call('openCanonicalHandReview');
    await app.click('#handReviewSaveSpot');
    await app.settle(500);
    assert.ok(spy.calls.callSavedStudyBridge.some(([method]) => method === 'saveReviewedDecisionSpot'), JSON.stringify(spy.calls.callSavedStudyBridge.map(([method]) => method)));
  } finally {
    spy.restore();
    app.window.__restoreReviewProjector();
  }
  // Protects: the heading layout rule targets non-card-row heading groups.
  const host = app.document.createElement('div');
  host.innerHTML = '<div class="hand-review-section-heading"><div></div><div class="hand-review-card-row"></div></div>';
  app.document.body.appendChild(host);
  assert.equal(css.cascaded(host.querySelector('.hand-review-section-heading > div:not(.hand-review-card-row)'), 'display'), 'grid');
  assert.notEqual(css.cascaded(host.querySelector('.hand-review-card-row'), 'gap'), '2px');
  host.remove();
});

test('Training Review owns an isolated read-only Replay projection and keeps repeat/next flows', async () => {
  assert.match(trainingBootstrap, /createReplayProjectionController/);
  assert.match(trainingBootstrap, /replaceFromCanonicalHandReplaySource/);
  assert.match(trainingBootstrap, /\{ readOnly: true \}/);
  assert.match(trainingBootstrap, /getFullHandReviewReplayProjection/);
  assert.match(trainingBootstrap, /selectFullHandReviewFrame/);
  assert.match(trainingBootstrap, /returnFullHandReviewToEndpoint/);
  // Protects: Full-Hand review is the shared surface with Repeat/Next; the
  // exercise surface stays visible in terminal review; Next starts the
  // configured session and Repeat replays the hand.
  await app.training.playFullHand();
  await app.click('#trainingReviewHand');
  await app.settle(300);
  assert.equal(app.window.app.handReview.source, 'training_full_hand');
  assert.equal(app.byId('trainingExerciseSurface').hidden, false);
  assert.ok(app.byId('trainingHandReviewMount').contains(app.byId('handReviewSurface')));
  for (const id of ['handReviewRepeat', 'handReviewNext']) assert.equal(app.byId(id).hidden, false, id);
  const workspace = app.$('.training-workspace');
  await app.click('#handReviewRepeat');
  await app.settle(1000);
  assert.equal(workspace.dataset.trainingFullHandPhase, 'live', 'Repeat replays the hand');
  await app.training.playFullHand();
  await app.click('#trainingReviewHand');
  await app.settle(300);
  const spy = app.spy(['startConfiguredTrainingSession']);
  try {
    await app.click('#handReviewNext');
    await app.settle(1000);
    assert.equal(spy.count('startConfiguredTrainingSession'), 1);
  } finally {
    spy.restore();
  }
});

test('responsive, Compact, RTL, focus, and reduced-motion states are explicit', () => {
  const root = markup.documentElement;
  const surface = markup.getElementById('handReviewSurface');
  const workspace = markup.querySelector('.hand-review-workspace');
  const columns = css.cascaded(workspace, 'grid-template-columns');
  assert.ok(columns && columns !== 'none');
  assert.equal(css.cascaded(workspace, 'grid-template-columns', { width: 1000 }), '1fr');
  const comfortable = css.cascaded(surface, 'padding');
  root.dataset.density = 'compact';
  assert.equal(css.cascaded(surface, 'padding'), 'var(--space-4)');
  assert.notEqual(comfortable, 'var(--space-4)');
  delete root.dataset.density;
  const row = markup.querySelector('.hand-review-card-row');
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(row, 'direction'), 'ltr');
  assert.equal(css.cascaded(row, 'justify-content'), 'flex-end');
  root.setAttribute('dir', 'ltr');
  const button = markup.createElement('button');
  button.className = 'hand-review-decision-button';
  surface.appendChild(button);
  button.focus();
  assert.equal(css.cascaded(button, 'outline-color', { states: ['focus-visible'] }), 'var(--border-focus)');
  assert.equal(css.cascaded(button, 'outline-offset', { states: ['focus-visible'] }), '2px');
  // Reduced motion: review transitions/animations collapse and scrolling is instant.
  assert.match(css.cascaded(button, 'transition-duration', { reducedMotion: true }), /^(?:none|0\.001ms)$/);
  assert.match(css.cascaded(button, 'animation-duration', { reducedMotion: true }), /^(?:none|0\.001ms)$/);
  assert.equal(css.cascaded(button, 'scroll-behavior', { reducedMotion: true }), 'auto');
  assert.equal(css.cascaded(button, 'transition-duration'), undefined);
  button.remove();
  const actions = markup.querySelector('.hand-review-actions');
  const hidden = actions.querySelector(':scope > [hidden]') || actions.firstElementChild;
  const wasHidden = hidden.hidden;
  hidden.hidden = true;
  hidden.style.display = 'flex';
  assert.equal(css.cascaded(hidden, 'display'), 'none');
  hidden.style.removeProperty('display');
  hidden.hidden = wasHidden;
  const action = markup.createElement('button');
  action.className = 'full-hand-timeline-action is-selected-review-decision';
  markup.body.appendChild(action);
  assert.equal(css.cascaded(action, 'border-color'), 'var(--accent-primary)');
  action.remove();
});

test('Review UI and tutorial copy have explicit English, Russian, and Hebrew coverage', () => {
  assert.match(i18n, /const handReviewTranslations = \{/);
  for (const language of ['en', 'ru', 'he']) {
    assert.match(i18n, new RegExp(`${language}: \\{`));
  }
  assert.match(i18n, /"Hand Review"/);
  assert.match(i18n, /"Review priority"/);
  assert.match(i18n, /"Replay around selected decision"/);
  assert.match(tutorials, /anchor: 'hand-review'/);
  assert.match(tutorials, /Deep Review highlights up to three decisions with explicit study reasons/);
  assert.doesNotMatch(tutorials, /review priority is a probability disagreement/);
  assert.match(tutorialI18n, /const handReviewTutorial = \{/);
});

test('saving a reviewed decision reuses the existing exact Hand-derived spot schema idempotently', async () => {
  const application = createSavedStudyObjectApplication({
    database: createMemorySavedStudyDatabase(),
    ownerRef: createSavedStudyOwnerRef('full-hand-review-test-owner'),
    clock: () => new Date('2026-08-23T12:00:00.000Z'),
    idFactory: (prefix) => `${prefix}-reviewed-decision`,
  });
  const input = {
    decisionId: 'review-save-hand:hero-decision:1',
    canonicalHandId: 'review-save-hand',
    actionSequenceCount: 4,
    decisionContext: exactDecisionContext(),
    sourceSurface: 'replay',
    sourceId: 'review-save-hand:hero-decision:1',
    title: 'Hero Decision 2 · Flop',
  };
  const first = await application.saveReviewedDecisionSpot(input);
  const second = await application.saveReviewedDecisionSpot(input);

  assert.equal(first.object.kind, 'spot');
  assert.equal(first.object.payload.derivation, 'hand');
  assert.equal(first.object.payload.truth.historyStatus, 'canonical_reference');
  assert.equal(first.object.payload.handReference.canonicalHandId, 'review-save-hand');
  assert.equal(first.object.payload.handReference.actionSequenceCount, 4);
  assert.deepEqual(first.object.payload.decisionContext, exactDecisionContext());
  assert.equal(second.object.id, first.object.id);
  assert.equal(second.idempotent, true);
  assert.match(savedService, /createSavedSpotSnapshot/);
  assert.doesNotMatch(savedService, /hand-review-spot\/v1/);
});
