import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import { RANGE_CAL002B_SYNTHETIC_FIXTURES } from './fixtures/range_cal002b_synthetic_truth.mjs';
import {
  RANGE_CAL002B_ANSWER_BUDGETS,
  RANGE_CAL002B_CONTEXT,
  RANGE_CAL002B_FIXED_SEEDS,
  RANGE_CAL002B_MODE_ID,
  RANGE_CAL002B_PROFILE_ID,
  benchmarkRangeCal002bProjection,
  createRangeCal002bHoldoutSplit,
  evaluateRangeCal002bQualityMatrix,
} from './tooling/range_cal002b_evaluation.mjs';

const evaluation = evaluateRangeCal002bQualityMatrix();

function fixtureBudget(fixtureId, directAnswerBudget) {
  return evaluation.fixtureBudget.find((entry) => (
    entry.fixtureId === fixtureId && entry.directAnswerBudget === directAnswerBudget
  ));
}

test('validation matrix covers every hard fixture, seed, and direct-answer budget', () => {
  assert.equal(RANGE_CAL002B_SYNTHETIC_FIXTURES.length, 8);
  assert.deepEqual(evaluation.answerBudgets, RANGE_CAL002B_ANSWER_BUDGETS);
  assert.deepEqual(evaluation.seeds, RANGE_CAL002B_FIXED_SEEDS);
  assert.equal(evaluation.records.length, 8 * 6 * 3);
  assert.deepEqual(new Set(evaluation.fixtureIds), new Set([
    'smooth-tight',
    'smooth-loose',
    'irregular-reproducible',
    'islands-gapped',
    'suited-offsuit-anomaly',
    'pair-anomaly',
    'contradictory-direct',
    'sparse-exact-boundary',
  ]));
  assert.ok(evaluation.records.every((entry) => (
    entry.attemptedCount + entry.abstentionCount === entry.heldOutCount
    && entry.directCoverage === entry.directAnswerBudget / 169
  )));
});

test('smooth tight and loose targets materially beat chance while selective coverage grows', () => {
  for (const fixtureId of ['smooth-tight', 'smooth-loose']) {
    const at30 = fixtureBudget(fixtureId, 30);
    const at50 = fixtureBudget(fixtureId, 50);
    const at75 = fixtureBudget(fixtureId, 75);
    assert.ok(at30.attemptedCoverage > 0.15);
    assert.ok(at30.attemptedAccuracy > 0.95);
    assert.ok(at50.attemptedCoverage > at30.attemptedCoverage);
    assert.ok(at75.attemptedCoverage > at50.attemptedCoverage);
    assert.ok(at75.attemptedAccuracy > 0.9);
  }
});

test('irregular targets prefer abstention and regional high output never contradicts held-out truth', () => {
  for (const budget of RANGE_CAL002B_ANSWER_BUDGETS) {
    const irregular = fixtureBudget('irregular-reproducible', budget);
    assert.ok(irregular.attemptedCoverage < 0.05);
    if (budget <= 50) assert.equal(irregular.highCount, 0);
    assert.equal(irregular.falseHighConfidenceErrors, 0);
    assert.ok(irregular.abstentionRate > 0.95);
  }
});

test('gaps, suited/offsuit inversions, pair anomalies, and exact boundaries stay accurate when attempted', () => {
  for (const fixtureId of [
    'islands-gapped',
    'suited-offsuit-anomaly',
    'pair-anomaly',
    'sparse-exact-boundary',
  ]) {
    const at30 = fixtureBudget(fixtureId, 30);
    const at50 = fixtureBudget(fixtureId, 50);
    assert.ok(at30.attemptedAccuracy > 0.85);
    assert.ok(at50.attemptedAccuracy > 0.9);
    assert.ok(at50.attemptedCoverage > 0.05);
  }
});

test('high-band safety remains bounded while medium carries more early regional interpolation', () => {
  for (const aggregate of evaluation.budgetAggregate) {
    if (aggregate.highAccuracy !== null) {
      assert.ok(aggregate.highAccuracy >= 0.93);
      assert.ok(aggregate.highAccuracy >= aggregate.attemptedAccuracy - 0.02);
      const falseHighRate = aggregate.falseHighConfidenceErrors / aggregate.highCount;
      assert.ok(falseHighRate <= (aggregate.directAnswerBudget === 10 ? 0.07 : 0.011));
    }
  }
});

test('additional nested evidence is stable rather than catastrophically flipping predictions', () => {
  const comparable = evaluation.stability.filter((entry) => entry.stabilityRate !== null);
  assert.ok(comparable.length > 50);
  assert.ok(comparable.every((entry) => entry.stabilityRate >= 0.95));
  for (const fixtureId of ['smooth-tight', 'smooth-loose', 'islands-gapped']) {
    assert.ok(fixtureBudget(fixtureId, 75).attemptedAccuracy
      >= fixtureBudget(fixtureId, 20).attemptedAccuracy - 0.1);
  }
});

test('contradictory direct fixture preserves the conflict and exact boundary fixture increases abstention', () => {
  assert.ok(evaluation.records
    .filter((entry) => entry.fixtureId === 'contradictory-direct')
    .every((entry) => entry.conflictingCount === 1));
  assert.ok(fixtureBudget('sparse-exact-boundary', 40).attemptedCoverage
    < fixtureBudget('smooth-loose', 40).attemptedCoverage);
});

test('held-out truth cannot leak into evidence view or inference', () => {
  const fixture = RANGE_CAL002B_SYNTHETIC_FIXTURES[0];
  const split = createRangeCal002bHoldoutSplit({ fixture, seed: 43, answerBudget: 30 });
  const heldOut = split.heldOutHandClasses[0];
  const modifiedFixture = {
    ...fixture,
    labels: {
      ...fixture.labels,
      [heldOut]: fixture.labels[heldOut] === 'raise' ? 'fold' : 'raise',
    },
  };
  const modifiedSplit = createRangeCal002bHoldoutSplit({
    fixture: modifiedFixture,
    seed: 43,
    answerBudget: 30,
  });
  assert.deepEqual(modifiedSplit.visibleObservations, split.visibleObservations);
  const snapshot = (candidateSplit) => createPersonalStrategySnapshot(createPersonalStrategyEvidenceView({
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
    rangeObservations: candidateSplit.visibleObservations,
  }));
  assert.deepEqual(snapshot(modifiedSplit), snapshot(split));
});

test('one estimate, 169 snapshot, cache hit, and relevant-scope invalidation remain interactive', async () => {
  const performance = await benchmarkRangeCal002bProjection();
  assert.ok(performance.oneEstimateMedianMs < 5);
  assert.equal(performance.snapshotSampleCount, 5);
  assert.ok(performance.snapshot169RepresentativeMs < 100);
  assert.ok(performance.repeatedCachedSnapshotMs < performance.snapshot169Ms);
  assert.equal(performance.invalidatedSnapshotSampleCount, 5);
  assert.ok(performance.invalidatedSnapshotRepresentativeMs < 100);
  assert.equal(performance.cacheMetrics.snapshotBuilds, 2);
  assert.equal(performance.cacheMetrics.invalidations, 1);
});

test('inference core remains DOM-free and outside StrategyProvider, Equity, Matrix, sync, and persistence', () => {
  const inferenceSource = fs.readFileSync(
    new URL('../app/src/personal-strategy/rfi-inference.mjs', import.meta.url),
    'utf8',
  );
  const evidenceSource = fs.readFileSync(
    new URL('../app/src/personal-strategy/evidence-view.mjs', import.meta.url),
    'utf8',
  );
  const projectionSource = fs.readFileSync(
    new URL('../app/src/personal-strategy/projection-service.mjs', import.meta.url),
    'utf8',
  );
  for (const source of [inferenceSource, evidenceSource, projectionSource]) {
    assert.doesNotMatch(
      source,
      /StrategyProvider|StrategyResult|HoldemWeightedRange|holdem-range|\bEquity\b|\bdocument\.|\bwindow\.|\bfetch\s*\(|sync\//,
    );
  }
  const repositorySource = fs.readFileSync(
    new URL('../app/src/personal-strategy/repository.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(repositorySource, /createPersonalStrategySnapshot|estimatePersonalStrategyHand|inferred_high/);
});
