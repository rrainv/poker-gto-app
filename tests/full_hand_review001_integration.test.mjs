import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../app/src/saved-study-objects/index.mjs';

const [html, logic, styles, bootstrap, trainingBootstrap, savedService, i18n, tutorials, tutorialI18n] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/hand-review-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-study-object-service.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/current-app-tutorials.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

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
  assert.equal(occurrenceCount(html, 'id="handReviewSurface"'), 1);
  assert.match(html, /id="handReviewMount"/);
  assert.match(html, /id="trainingHandReviewMount"/);
  assert.doesNotMatch(html, /trainingFullHandReviewLegacy/);
  assert.doesNotMatch(html, /id="trainingFullHandReview"/);
  assert.match(html, /data-tutorial-anchor="hand-review"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Hero decision navigation"/);
  assert.match(html, /id="handReviewOpponents"/);
  assert.match(html, /hand-review-bootstrap\.mjs/);
  assert.ok(
    html.indexOf('hand-review-bootstrap.mjs') < html.indexOf('src/core/logic.js'),
    'the bridge must install before classic runtime wiring',
  );
});

test('shared runtime uses canonical journals, exact Replay seeks, provider cache, and source-gated labels', () => {
  assert.match(bootstrap, /createHandReviewProjector/);
  assert.match(logic, /getHeroDecisionJournal/);
  assert.match(logic, /handReviewProjector\.project/);
  assert.match(logic, /providerCacheKey/);
  assert.match(logic, /replayFrameTarget\.frameIndex/);
  assert.match(logic, /selectActiveHandReviewDecision/);
  assert.match(logic, /selectFullHandReviewFrame/);
  assert.match(logic, /hand-review-card training-readonly-card riverline-card/);
  assert.match(logic, /trainingExerciseSurface'\)\) \$\('#trainingExerciseSurface'\)\.hidden = false/);
  assert.match(logic, /activeFullHandReview = state === 'terminal'/);
  assert.match(styles, /\.hand-review-section-heading\s*>\s*div:not\(\.hand-review-card-row\)/);
  assert.match(logic, /openCanonicalHandDecisionInAnalysis\(app\.handReview\.model\?\.selectedDecisionIndex\)/);
  assert.match(logic, /saveReviewedDecisionSpot/);
  assert.match(logic, /truthPresentation\(comparison\?\.truth/);
  assert.match(logic, /trainingTruthSummaryText\(model.overview.truthSummary\)/);
  assert.doesNotMatch(logic, /reviewPriority[^\n]+evLoss/i);
});

test('Training Review owns an isolated read-only Replay projection and keeps repeat/next flows', () => {
  assert.match(trainingBootstrap, /createReplayProjectionController/);
  assert.match(trainingBootstrap, /replaceFromCanonicalHandReplaySource/);
  assert.match(trainingBootstrap, /\{ readOnly: true \}/);
  assert.match(trainingBootstrap, /getFullHandReviewReplayProjection/);
  assert.match(trainingBootstrap, /selectFullHandReviewFrame/);
  assert.match(trainingBootstrap, /returnFullHandReviewToEndpoint/);
  assert.match(logic, /handReviewRepeat/);
  assert.match(logic, /replayCurrentTrainingSeed/);
  assert.match(logic, /handReviewNext/);
  assert.match(logic, /startConfiguredTrainingSession/);
});

test('responsive, Compact, RTL, focus, and reduced-motion states are explicit', () => {
  assert.match(styles, /\.hand-review-workspace\s*\{[^}]*grid-template-columns/s);
  assert.match(styles, /@media \(max-width: 1080px\)[\s\S]*\.hand-review-workspace/);
  assert.match(styles, /\[data-density="compact"\] \.hand-review-surface/);
  assert.match(styles, /\[dir="rtl"\] \.hand-review-card-row/);
  assert.match(styles, /\.hand-review-decision-button:focus-visible/);
  assert.match(styles, /\.hand-review-actions\s*>\s*\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hand-review-surface/);
  assert.match(styles, /\.full-hand-timeline-action\.is-selected-review-decision/);
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
  assert.match(tutorials, /probability disagreement—not EV loss/);
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
