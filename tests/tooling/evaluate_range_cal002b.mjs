import {
  benchmarkRangeCal002bProjection,
  evaluateRangeCal002bQualityMatrix,
} from './range_cal002b_evaluation.mjs';

const evaluation = evaluateRangeCal002bQualityMatrix();
const performance = await benchmarkRangeCal002bProjection();
const comparableStability = evaluation.stability.filter((entry) => entry.stabilityRate !== null);
const compact = {
  schemaVersion: evaluation.schemaVersion,
  fixtureIds: evaluation.fixtureIds,
  fixtureVersion: evaluation.fixtureVersion,
  seeds: evaluation.seeds,
  answerBudgets: evaluation.answerBudgets,
  inferenceModelVersion: evaluation.inferenceModelVersion,
  evaluationRuntimeMs: evaluation.evaluationRuntimeMs,
  runCount: evaluation.records.length,
  fixtureBudget: evaluation.fixtureBudget,
  budgetAggregate: evaluation.budgetAggregate,
  stability: {
    comparisons: evaluation.stability.length,
    comparableAttemptedComparisons: comparableStability.length,
    minimumComparableStability: Math.min(...comparableStability.map((entry) => entry.stabilityRate)),
    averageComparableStability: comparableStability.reduce(
      (sum, entry) => sum + entry.stabilityRate,
      0,
    ) / comparableStability.length,
  },
  performance,
};

console.log(JSON.stringify(process.argv.includes('--full') ? { ...evaluation, performance } : compact, null, 2));
