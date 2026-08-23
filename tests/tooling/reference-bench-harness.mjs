import { calculateEquity } from '../../shared/poker-domain/equity.js';
import { isStrategyResultV1 } from '../../app/src/application/strategy-result.mjs';
import { decisionContextStrategySeed } from '../../app/src/strategy/heuristic-strategy.mjs';
import { createCalibrationStrategyProvider } from './strategy-calibration-harness.mjs';
import { validateReferenceBenchmarkInput } from './reference-bench-schema.mjs';
import {
  ACTION_PRECISION_LEVELS,
  aggregateBenchmarkRows,
  classifyDiagnosis,
  compareEquity,
  compareStrategyActions,
  detectActionSupportMismatch,
  evaluateContextMatch,
} from './reference-bench-metrics.mjs';

export const REFERENCE_BENCHMARK_REPORT_SCHEMA_VERSION =
  'riverline-reference-benchmark-report/v1';

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function rounded(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function actionSummary(projection, side) {
  const vector = projection?.[side];
  if (!vector) return 'Unavailable at this comparison precision.';
  const [action, probability] = Object.entries(vector).sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0])
  ))[0] ?? [];
  return action ? `${action} ${rounded(probability * 100, 2)}%` : 'No action mass.';
}

function nextInvestigation(diagnosis, equity) {
  if (diagnosis.primary === 'CONTEXT_MISMATCH') {
    return 'Capture or reconstruct an exact node before comparing frequencies.';
  }
  if (diagnosis.primary === 'ACTION_SUPPORT_MISMATCH') {
    return 'Separate action-family disagreement from unsupported sizing precision.';
  }
  if (diagnosis.primary === 'EQUITY_CLOSE_STRATEGY_FAR') {
    return 'Inspect policy thresholds and the equity-to-action transformation without retuning yet.';
  }
  if (diagnosis.primary === 'EQUITY_FAR_STRATEGY_FAR') {
    return 'Audit opponent-range construction, combo weighting, dead-card removal, sampling, and evaluator parity.';
  }
  if (diagnosis.primary === 'EQUITY_FAR_STRATEGY_CLOSE') {
    return 'Look for compensating heuristic behavior and validate the equity semantics on more hands.';
  }
  if (!equity.comparable) {
    return 'Capture semantically comparable exact-combo equity before assigning an upstream cause.';
  }
  return 'Expand the node sample before prioritizing an engineering change.';
}

function competitiveLearning(strategy, equity, diagnosis) {
  const level2 = strategy[ACTION_PRECISION_LEVELS.LEVEL_2];
  const maxDelta = level2.metrics?.maximumActionDelta;
  return {
    whatDoesTheReferenceDo: actionSummary(level2, 'reference'),
    whereDoesRiverlineDiffer: level2.metrics
      ? `${actionSummary(level2, 'riverline')}; maximum action delta ${rounded(maxDelta * 100, 2)} points.`
      : `Numerical strategy comparison blocked: ${level2.blockedReason}.`,
    isTheEquityAlsoDifferent: equity.comparable
      ? `Comparable; absolute delta ${rounded(equity.absoluteDelta * 100, 2)} points.`
      : `Not comparable: ${equity.reason}.`,
    probablyResponsibleLayer: diagnosis.interpretation,
    investigateNext: nextInvestigation(diagnosis, equity),
    mustNotBeConcluded: [
      'This observation does not prove Riverline or the reference is objectively correct.',
      'A diagnostic hint is not proof of causation and must not trigger automatic retuning.',
      'Mapped or coarse action-family agreement does not establish exact sizing or EV agreement.',
    ],
  };
}

function heuristicSamplingMetadata(strategyResult, decisionContext) {
  const sample = strategyResult.details?.heuristicSample;
  if (!sample || !Number.isFinite(sample.eq)) return null;
  return {
    numberOfTrials: sample.completedSamples ?? null,
    samplesRequested: sample.requestedSamples ?? null,
    samplesAttempted: sample.attemptedSamples ?? null,
    opponentRangeConstruction: {
      assumption: sample.opponentRangeAssumption ?? null,
      distribution: sample.rangeDistribution ?? null,
      selectedComboCount: sample.rangeComboCount ?? null,
      unblockedComboCount: sample.unblockedComboCount ?? null,
      selectedFraction: sample.rangeFraction ?? null,
      sharedAcrossOpponents: sample.sharedRangeAssumption ?? null,
    },
    opponentCount: sample.opponentCount ?? null,
    opponentCountSource: sample.opponentCountSource ?? null,
    deterministicSeedFamily: decisionContextStrategySeed(decisionContext),
    evaluatorPath: 'app/src/strategy/heuristic-evaluator.mjs',
    provenance: sample.provenance ?? 'heuristic_conditional_sample',
  };
}

async function resolveRiverlineEquity(
  specification,
  strategyResult,
  decisionContext,
  equityCalculator,
) {
  if (!specification) return null;
  if (specification.source === 'heuristic_conditional_sample') {
    const value = strategyResult.details?.heuristicSample?.eq;
    return {
      source: specification.source,
      value: Number.isFinite(value) ? rounded(value) : null,
      semantics: clone(specification.semantics),
      sampling: heuristicSamplingMetadata(strategyResult, decisionContext),
      error: Number.isFinite(value) ? null : 'heuristic_sample_unavailable',
    };
  }

  const calculation = await equityCalculator(specification.request);
  if (calculation?.ok === false || calculation?.schemaVersion !== 'equity-result/v1') {
    return {
      source: specification.source,
      value: null,
      semantics: clone(specification.semantics),
      sampling: null,
      error: clone(calculation?.error ?? { code: 'invalid_equity_result' }),
    };
  }
  const hero = calculation.players.find((player) => player.id === specification.heroPlayerId);
  if (!hero) {
    return {
      source: specification.source,
      value: null,
      semantics: clone(specification.semantics),
      sampling: null,
      error: { code: 'hero_player_missing' },
    };
  }
  return {
    source: specification.source,
    value: rounded(hero.equity),
    semantics: clone(specification.semantics),
    sampling: {
      numberOfTrials: calculation.trials,
      samplesRequested: calculation.metadata.samplesRequested,
      samplesCompleted: calculation.metadata.samplesCompleted,
      opponentRangeConstruction: calculation.metadata.unknownPlayers > 0
        ? 'uniform_unknown_legal_combos'
        : 'exact_known_combos',
      opponentCount: calculation.players.length - 1,
      deterministicSeedFamily: calculation.metadata.seed,
      evaluatorPath: 'shared/poker-domain/equity.js -> shared/poker-domain/evaluator.js',
      method: calculation.method,
      exact: calculation.exact,
    },
    error: null,
  };
}

function riverlineStrategyEvidence(result) {
  return {
    schemaVersion: result.schemaVersion,
    source: result.source,
    sourceVersion: result.sourceVersion,
    sourceDescriptor: clone(result.sourceDescriptor),
    provenance: clone(result.provenance),
    contextCoverage: clone(result.contextCoverage),
    capabilities: clone(result.capabilities),
    rawActions: result.actions.map((entry) => ({
      label: entry.label,
      action: clone(entry.action),
      probability: rounded(entry.probability),
      evBb: entry.evBb,
    })),
    warnings: [...result.warnings],
    details: clone(result.details),
  };
}

function rowLimitations(contextGate, strategy, equity, actionSupport) {
  const limitations = [...contextGate.limitations];
  const level3 = strategy[ACTION_PRECISION_LEVELS.LEVEL_3];
  if (!level3.comparable) limitations.push(`Exact sizing comparison blocked: ${level3.blockedReason}`);
  if (!equity.comparable) limitations.push(`Equity comparison blocked: ${equity.reason}`);
  if (actionSupport.unsupportedActionTypes.length > 0) {
    limitations.push(`Unsupported Riverline action types: ${actionSupport.unsupportedActionTypes.join(', ')}`);
  }
  if (actionSupport.unsupportedSizingTypes.length > 0) {
    limitations.push(`Riverline has no exact strategy size for: ${actionSupport.unsupportedSizingTypes.join(', ')}`);
  }
  return [...new Set(limitations)];
}

function compactRow(row) {
  const level1 = row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1];
  return {
    id: row.id,
    hand: row.hand.kind === 'preflop_169_class' ? row.hand.handClass : row.hand.combo.join(''),
    context: row.context.outcome,
    tvd: level1.metrics?.totalVariationDistance ?? null,
    riverlineDominant: level1.metrics?.riverlineDominantAction ?? null,
    referenceDominant: level1.metrics?.referenceDominantAction ?? null,
    equityDelta: row.equity.absoluteDelta,
    diagnosis: row.diagnosis.primary,
  };
}

async function benchmarkObservation({
  observation,
  node,
  contextGate,
  provider,
  equityCalculator,
}) {
  const decisionContext = {
    ...clone(node.riverline.decisionContext),
    heroCards: [...observation.hand.combo],
  };
  const strategyResult = provider.resolve(decisionContext);
  if (!isStrategyResultV1(strategyResult)) {
    throw new TypeError(`Observation ${observation.id} did not produce StrategyResult v1`);
  }
  const strategy = compareStrategyActions(
    observation.reference,
    strategyResult.actions,
    contextGate,
  );
  const actionSupport = detectActionSupportMismatch(
    observation.reference,
    strategyResult.actions,
    node.riverline.gameAssumptions,
  );
  const riverlineEquity = await resolveRiverlineEquity(
    observation.riverlineEquity,
    strategyResult,
    decisionContext,
    equityCalculator,
  );
  const equity = compareEquity(
    observation.reference.equity ?? null,
    riverlineEquity,
    contextGate,
  );
  const diagnosis = classifyDiagnosis({ contextGate, strategy, equity, actionSupport });
  const row = {
    id: observation.id,
    hand: clone(observation.hand),
    context: clone(contextGate),
    decisionContext,
    reference: {
      frequencyUnit: observation.reference.frequencyUnit,
      rawActions: clone(observation.reference.rawActions),
      equity: clone(observation.reference.equity ?? null),
      eqr: observation.reference.eqr ?? null,
      optionalEvidence: {
        actionEvAvailable: observation.reference.rawActions.some((action) => (
          Number.isFinite(action.evBb)
        )),
        equityAvailable: Number.isFinite(observation.reference.equity?.value),
        eqrAvailable: Number.isFinite(observation.reference.eqr),
      },
    },
    riverline: riverlineStrategyEvidence(strategyResult),
    strategy,
    actionSupport,
    equity,
    diagnosis,
    limitations: null,
    competitiveLearning: null,
  };
  row.limitations = rowLimitations(contextGate, strategy, equity, actionSupport);
  row.competitiveLearning = competitiveLearning(strategy, equity, diagnosis);
  return row;
}

export async function runReferenceBenchmark(input, {
  provider = createCalibrationStrategyProvider(),
  equityCalculator = calculateEquity,
} = {}) {
  if (!provider || typeof provider.resolve !== 'function') {
    throw new TypeError('Reference benchmark requires a StrategyProvider-compatible resolver');
  }
  if (typeof equityCalculator !== 'function') {
    throw new TypeError('Reference benchmark requires an Equity calculator');
  }
  const pack = validateReferenceBenchmarkInput(input);
  const nodes = [];
  const allRows = [];
  for (const node of pack.nodes) {
    const contextGate = evaluateContextMatch(node);
    const rows = [];
    for (const observation of node.observations) {
      rows.push(await benchmarkObservation({
        observation,
        node,
        contextGate,
        provider,
        equityCalculator,
      }));
    }
    allRows.push(...rows);
    nodes.push({
      id: node.id,
      referenceCoverage: node.referenceCoverage,
      coverageNote: node.coverageNote ?? null,
      context: contextGate,
      aggregate: aggregateBenchmarkRows(rows),
      discrepancyTable: rows.map(compactRow),
      observations: rows,
    });
  }
  return {
    schemaVersion: REFERENCE_BENCHMARK_REPORT_SCHEMA_VERSION,
    inputSchemaVersion: pack.schemaVersion,
    packId: pack.packId,
    title: pack.title,
    source: clone(pack.source),
    claims: {
      solvedGto: false,
      productionReferencePack: false,
      automaticRetuning: false,
      diagnosisIsProof: false,
    },
    thresholds: {
      strategyFarTvd: 0.25,
      equityCloseAbsoluteDelta: 0.03,
    },
    aggregate: aggregateBenchmarkRows(allRows),
    nodes,
  };
}

export function formatReferenceBenchmarkSummary(report) {
  const lines = [
    `REFERENCE BENCHMARK ${report.packId}`,
    `Source: ${report.source.productName} (${report.source.sourceType})`,
    `Nodes: ${report.nodes.length}; observations: ${report.aggregate.observationCount}`,
  ];
  for (const node of report.nodes) {
    lines.push(`\nCONTEXT ${node.id}: ${node.context.outcome}`);
    lines.push(`STRATEGY comparable: ${node.aggregate.strategyComparableCount}/${node.aggregate.observationCount}`);
    if (node.aggregate.strategy) {
      lines.push(`Mean/median/p95 TVD: ${node.aggregate.strategy.meanTvd} / ${node.aggregate.strategy.medianTvd} / ${node.aggregate.strategy.p95Tvd}`);
      lines.push(`Dominant agreement: ${rounded(node.aggregate.strategy.dominantActionAgreementRate * 100, 2)}%`);
    }
    if (node.aggregate.equity) {
      lines.push(`EQUITY mean/p95 delta: ${node.aggregate.equity.meanAbsoluteDelta} / ${node.aggregate.equity.p95AbsoluteDelta}`);
    } else {
      lines.push('EQUITY: no comparable observations');
    }
    for (const row of node.discrepancyTable.slice(0, 5)) {
      lines.push(
        `ROW ${row.id} ${row.hand}: Riverline=${row.riverlineDominant ?? 'blocked'} `
        + `Reference=${row.referenceDominant ?? 'blocked'} TVD=${row.tvd ?? 'blocked'} `
        + `EquityDelta=${row.equityDelta ?? 'blocked'} Diagnosis=${row.diagnosis}`,
      );
    }
    if (node.discrepancyTable.length > 5) {
      lines.push(`ROWS: first 5 of ${node.discrepancyTable.length}; see JSON discrepancyTable for all rows`);
    }
    const diagnosisCounts = Object.create(null);
    for (const row of node.observations) {
      diagnosisCounts[row.diagnosis.primary] = (diagnosisCounts[row.diagnosis.primary] || 0) + 1;
    }
    lines.push(`DIAGNOSIS ${Object.entries(diagnosisCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, count]) => `${key}=${count}`).join(', ') || 'none'}`);
    const limitations = [...new Set(node.observations.flatMap((row) => row.limitations))];
    if (limitations.length > 0) lines.push(`LIMITATIONS ${limitations.join('; ')}`);
  }
  return `${lines.join('\n')}\n`;
}
