import {
  benchmarkRangeCal002cSelection,
  evaluateRangeCal002cComparison,
} from './range_cal002c_evaluation.mjs';

const evaluation = evaluateRangeCal002cComparison();
const performance = benchmarkRangeCal002cSelection();
const output = process.argv.includes('--full')
  ? { ...evaluation, performance }
  : {
      schemaVersion: evaluation.schemaVersion,
      fixtureIds: evaluation.fixtureIds,
      fixtureVersion: evaluation.fixtureVersion,
      seeds: evaluation.seeds,
      answerBudgets: evaluation.answerBudgets,
      methods: evaluation.methods,
      evaluationRuntimeMs: evaluation.evaluationRuntimeMs,
      runCount: evaluation.records.length,
      fixtureBudgetMethod: evaluation.fixtureBudgetMethod,
      budgetMethod: evaluation.budgetMethod,
      performance,
    };

console.log(JSON.stringify(output, null, 2));
