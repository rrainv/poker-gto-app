import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { RANGE_CAL002B_SYNTHETIC_FIXTURES } from './fixtures/range_cal002b_synthetic_truth.mjs';
import {
  RANGE_CAL002B_ANSWER_BUDGETS,
  RANGE_CAL002B_FIXED_SEEDS,
} from './tooling/range_cal002b_evaluation.mjs';
import {
  RANGE_CAL002C_SELECTION_METHODS,
  benchmarkRangeCal002cSelection,
  evaluateRangeCal002cComparison,
  evaluateRangeCal002cSequence,
} from './tooling/range_cal002c_evaluation.mjs';

const evaluation = evaluateRangeCal002cComparison();

function aggregate(fixtureId, budget, method) {
  return evaluation.fixtureBudgetMethod.find((entry) => (
    entry.fixtureId === fixtureId
    && entry.directAnswerBudget === budget
    && entry.method === method
  ));
}

test('comparison covers identical 002B fixtures, fixed seeds, methods, and required budgets', () => {
  assert.deepEqual(evaluation.answerBudgets, RANGE_CAL002B_ANSWER_BUDGETS);
  assert.deepEqual(evaluation.seeds, RANGE_CAL002B_FIXED_SEEDS);
  assert.deepEqual(evaluation.methods, Object.values(RANGE_CAL002C_SELECTION_METHODS));
  assert.equal(evaluation.records.length, 8 * 3 * 2 * 6);
  assert.deepEqual(new Set(evaluation.fixtureIds), new Set(
    RANGE_CAL002B_SYNTHETIC_FIXTURES.map((fixture) => fixture.id),
  ));
  assert.ok(evaluation.records.every((entry) => (
    entry.heldOutCount === 169 - entry.directAnswerBudget
    && entry.attemptedCount + entry.abstentionCount === entry.heldOutCount
    && entry.questionEfficiencySemantics.includes('truth_boundary_discoveries_per_question')
  )));
});

test('adaptive selection materially improves boundary discovery on structured and boundary fixtures', () => {
  const boundaryFixtures = [
    'smooth-tight',
    'smooth-loose',
    'suited-offsuit-anomaly',
    'pair-anomaly',
    'sparse-exact-boundary',
  ];
  for (const fixtureId of boundaryFixtures) {
    const adaptive = aggregate(fixtureId, 30, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE);
    const sequential = aggregate(fixtureId, 30, RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL);
    assert.ok(adaptive.averageBoundaryRecovery >= sequential.averageBoundaryRecovery * 1.5);
  }
  const adaptiveIslands = aggregate(
    'islands-gapped', 50, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE,
  );
  const sequentialIslands = aggregate(
    'islands-gapped', 50, RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL,
  );
  assert.ok(adaptiveIslands.averageBoundaryRecovery > sequentialIslands.averageBoundaryRecovery);
});

test('adaptive questions improve useful held-out coverage on smooth and boundary-led structures', () => {
  const structured = [
    'smooth-tight',
    'smooth-loose',
    'suited-offsuit-anomaly',
    'pair-anomaly',
    'contradictory-direct',
    'sparse-exact-boundary',
  ];
  for (const fixtureId of structured) {
    const adaptive = aggregate(fixtureId, 50, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE);
    const sequential = aggregate(fixtureId, 50, RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL);
    assert.ok(adaptive.attemptedCoverage > sequential.attemptedCoverage);
    assert.ok(adaptive.attemptedAccuracy >= 0.97);
    assert.equal(adaptive.falseHighConfidenceErrors, 0);
  }
  const adaptiveIslands = aggregate(
    'islands-gapped', 50, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE,
  );
  const sequentialIslands = aggregate(
    'islands-gapped', 50, RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL,
  );
  assert.ok(adaptiveIslands.averageBoundaryRecovery > sequentialIslands.averageBoundaryRecovery);
  assert.equal(adaptiveIslands.attemptedAccuracy, 1);
  assert.equal(adaptiveIslands.falseHighConfidenceErrors, 0);
});

test('efficiency proxy and unknown counts show the gain without calling it confidence or EV', () => {
  for (const fixtureId of ['smooth-tight', 'smooth-loose', 'suited-offsuit-anomaly']) {
    const adaptive = aggregate(fixtureId, 50, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE);
    const sequential = aggregate(fixtureId, 50, RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL);
    assert.ok(adaptive.averageQuestionEfficiencyProxy > sequential.averageQuestionEfficiencyProxy);
    assert.ok(adaptive.averageUnknownCount < sequential.averageUnknownCount);
  }
});

test('irregular truth keeps honest abstention and contradictions remain explicit', () => {
  for (const budget of RANGE_CAL002B_ANSWER_BUDGETS) {
    const irregular = aggregate(
      'irregular-reproducible', budget, RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE,
    );
    assert.equal(irregular.highCount, 0);
    assert.equal(irregular.falseHighConfidenceErrors, 0);
    assert.ok(irregular.abstentionRate > 0.9);
  }
  const conflictingRecords = evaluation.records.filter((entry) => (
    entry.fixtureId === 'contradictory-direct'
    && entry.method === RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE
    && entry.directAnswerBudget >= 20
  ));
  assert.ok(conflictingRecords.length > 0);
  assert.ok(conflictingRecords.every((entry) => entry.conflictingCount === 1));
});

test('held-out labels cannot leak into the adaptive question sequence', () => {
  const fixture = RANGE_CAL002B_SYNTHETIC_FIXTURES.find((entry) => entry.id === 'smooth-tight');
  const original = evaluateRangeCal002cSequence({
    fixture,
    seed: 17,
    method: RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE,
    answerBudgets: [30],
  })[0];
  const heldOut = Object.keys(fixture.labels).find((handClass) => (
    !original.askedHandClasses.includes(handClass)
  ));
  const modifiedFixture = {
    ...fixture,
    labels: {
      ...fixture.labels,
      [heldOut]: fixture.labels[heldOut] === 'raise' ? 'fold' : 'raise',
    },
  };
  const modified = evaluateRangeCal002cSequence({
    fixture: modifiedFixture,
    seed: 17,
    method: RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE,
    answerBudgets: [30],
  })[0];
  assert.deepEqual(modified.askedHandClasses, original.askedHandClasses);
});

test('selection is seed-stable because production policy has no random dependency', () => {
  for (const fixtureId of evaluation.fixtureIds) {
    const records = evaluation.records.filter((entry) => (
      entry.fixtureId === fixtureId
      && entry.method === RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE
      && entry.directAnswerBudget === 30
    ));
    assert.equal(records.length, 3);
    assert.deepEqual(records[1].askedHandClasses, records[0].askedHandClasses);
    assert.deepEqual(records[2].askedHandClasses, records[0].askedHandClasses);
  }
});

test('cold ranking, state-local reuse, reranking, and progress assessment remain interactive', () => {
  const performance = benchmarkRangeCal002cSelection();
  assert.ok(performance.coldCandidateRankingMedianMs < 25);
  assert.ok(performance.cachedRankingConsumptionMedianMs < 5);
  assert.ok(performance.rerankingAfterAnswerMedianMs < 25);
  assert.ok(performance.progressAssessmentMedianMs < 5);
  assert.match(performance.cachedRankingSemantics, /no global memoization/);
});

test('selection stays DOM-free and outside strategy, Equity, Matrix, sync, and persistence authorities', () => {
  const source = fs.readFileSync(
    new URL('../app/src/personal-strategy/rfi-question-selection.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /Math\.random|StrategyProvider|StrategyResult|HoldemWeightedRange|holdem-range|\bEquity\b|\bdocument\.|\bwindow\.|\bfetch\s*\(|sync\//);
});
