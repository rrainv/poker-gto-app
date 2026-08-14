import {
  benchmarkRangeCal002aInference,
  evaluateRangeCal002aQualityMatrix,
  summarizeQualityMatrix,
} from './range_cal002a_evaluation.mjs';

const evaluation = evaluateRangeCal002aQualityMatrix();
const summary = summarizeQualityMatrix(evaluation);
const performance = benchmarkRangeCal002aInference({ completeEvaluation: evaluation });

const evaluationMetadata = {
  schemaVersion: evaluation.schemaVersion,
  fixtureIds: evaluation.fixtureIds,
  fixtureVersions: evaluation.fixtureVersions,
  seeds: evaluation.seeds,
  answerCounts: evaluation.answerCounts,
  inferenceModelVersion: evaluation.inferenceModelVersion,
  evaluationRuntimeMs: evaluation.evaluationRuntimeMs,
  runRecordCount: evaluation.records.length,
};
const compactSummary = {
  proposedFixtureSpecific: summary.fixtureSpecific.filter(
    (record) => record.method === 'sparse-local-neighbors',
  ),
  aggregate: summary.aggregate,
};

console.log(JSON.stringify(
  process.argv.includes('--full')
    ? { evaluation, summary, performance }
    : { evaluation: evaluationMetadata, summary: compactSummary, performance },
  null,
  2,
));
