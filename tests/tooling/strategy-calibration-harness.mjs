import { performance } from 'node:perf_hooks';

import { createStrategyProvider } from '../../app/src/application/strategy-provider.mjs';
import { isStrategyResultV1 } from '../../app/src/application/strategy-result.mjs';
import { resolveHeuristicStrategy } from '../../app/src/strategy/heuristic-strategy.mjs';
import { getHoldemCombosForHandClass } from '../../shared/poker-domain/holdem-combos.js';
import {
  ALL_POSITIONS,
  MULTIWAY_SPOT,
  NON_BLIND_POSITIONS,
  POSTFLOP_COUNTERFACTUAL_CORPUS,
  POSTFLOP_NAMED_CORPUS,
  PREFLOP_FACING_CATEGORIES,
  PREFLOP_HAND_CLASSES,
  PRICE_RESPONSE_SPOTS,
  RFI_ACCEPTANCE_INVARIANTS,
  RFI_EXTERNAL_SANITY_REFERENCES,
  RFI_METRIC_ASSUMPTIONS,
  REPRESENTATIVE_PREFLOP_CONFIGURATIONS,
  STRATEGY_QUALITY_BOUNDARY_HANDS,
  calibrationDecisionContext,
  representativeCardsForClass,
} from './strategy-calibration-corpora.mjs';

export const CALIBRATION_REPORT_SCHEMA_VERSION = 'riverline-strategy-calibration-report/v1';
export const STRATEGY_QUALITY_SNAPSHOT_SCHEMA_VERSION =
  'riverline-heuristic-strategy-quality-snapshot/v1';
export const CALIBRATION_REFERENCE_SCHEMA_VERSION = 'riverline-hu-preflop-calibration-reference/v1';
export const BOUNDED_HU_GAME_VERSION = 'riverline-hu-preflop-100bb/v1';
export const NEAR_PURE_THRESHOLD = 0.95;

const ACTION_TYPES = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const AGGRESSIVE_TYPES = Object.freeze(new Set(['bet', 'raise', 'all_in']));
const PASSIVE_TYPES = Object.freeze(new Set(['check', 'call']));

export const BOUNDED_HU_OVERLAP = Object.freeze([
  Object.freeze({
    publicState: 'root_btn',
    overlap: 'exact_structural_root',
    usableComparison: 'structural action vector, including explicit zero mass for unsupported all-in',
    decisionContextFacts: Object.freeze({
      tableSize: 2,
      heroPosition: 'BTN',
      stackBb: 100,
      lastAction: 'unopened',
      facingSizeBb: 0,
      callAmountBb: 0.5,
      heroStreetContributionBb: 0.5,
      potBb: 1.5,
    }),
  }),
  Object.freeze({
    publicState: 'bb_facing_btn_open_to_2.5bb',
    overlap: 'coarse_family_only',
    usableComparison: 'fold/passive/aggression after solver sizes are aggregated',
    decisionContextFacts: Object.freeze({
      tableSize: 2,
      heroPosition: 'BB',
      stackBb: 100,
      lastAction: 'raise',
      facingSizeBb: 2.5,
      callAmountBb: 1.5,
      heroStreetContributionBb: 1,
      potBb: 3.5,
    }),
  }),
  Object.freeze({
    publicState: 'btn_facing_bb_3bet_to_8bb',
    overlap: 'coarse_family_only',
    usableComparison: 'fold/passive/aggression after solver sizes are aggregated',
    decisionContextFacts: Object.freeze({
      tableSize: 2,
      heroPosition: 'BTN',
      stackBb: 100,
      lastAction: '3bet',
      facingSizeBb: 8,
      callAmountBb: 5.5,
      heroStreetContributionBb: 2.5,
      potBb: 11.5,
    }),
  }),
  Object.freeze({
    publicState: 'limp_branch',
    overlap: 'not_lossless',
    usableComparison: null,
    reason: 'DecisionContext v1 projects a limp to check and does not retain the bounded branch history or 4bb size anchor.',
  }),
]);

function rounded(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(rows, selector, weightForRow) {
  const totalWeight = rows.reduce((sum, row) => sum + weightForRow(row), 0);
  if (!(totalWeight > 0)) return 0;
  return rows.reduce((sum, row) => sum + selector(row) * weightForRow(row), 0) / totalWeight;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function sumTypes(vector, types) {
  return [...types].reduce((sum, type) => sum + (Number(vector[type]) || 0), 0);
}

function dominantAction(vector) {
  return Object.entries(vector)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

export function createCalibrationStrategyProvider(options = {}) {
  return createStrategyProvider({
    fallbackResolver: (decisionContext) => resolveHeuristicStrategy(decisionContext, options),
  });
}

export function actionVectorForResult(result) {
  const rawVector = Object.fromEntries(ACTION_TYPES.map((type) => [type, 0]));
  for (const entry of result.actions) {
    rawVector[entry.action.type] += entry.probability;
  }
  const vector = Object.fromEntries(Object.entries(rawVector).map(([type, probability]) => (
    [type, rounded(probability)]
  )));
  const closingType = [...ACTION_TYPES].reverse().find((type) => rawVector[type] > 0);
  if (closingType) {
    const prefix = ACTION_TYPES
      .filter((type) => type !== closingType)
      .reduce((sum, type) => sum + vector[type], 0);
    vector[closingType] = 1 - prefix;
  }
  return vector;
}

export function evaluateDecisionContext(provider, decisionContext) {
  const result = provider.resolve(decisionContext);
  if (!isStrategyResultV1(result)) throw new TypeError('Calibration requires StrategyResult v1');
  const vector = actionVectorForResult(result);
  const aggressiveProbability = rounded(sumTypes(vector, AGGRESSIVE_TYPES));
  const passiveProbability = rounded(sumTypes(vector, PASSIVE_TYPES));
  const foldProbability = rounded(vector.fold);
  return {
    source: result.source,
    actionVector: vector,
    dominantAction: dominantAction(vector),
    aggressiveProbability,
    passiveProbability,
    foldProbability,
    actions: result.actions.map((entry) => ({
      type: entry.action.type,
      amountBb: entry.action.amountBb,
      potFraction: entry.action.potFraction,
      label: entry.label,
      probability: rounded(entry.probability),
    })),
    recommendation: clone(result.recommendation),
    details: clone(result.details),
    warnings: [...result.warnings],
  };
}

export function preflopContextFor(handClass, configuration) {
  const facing = PREFLOP_FACING_CATEGORIES[configuration.facing ?? 'unopened'];
  if (!facing) throw new RangeError(`Unknown facing category: ${configuration.facing}`);
  return calibrationDecisionContext({
    tableSize: configuration.tableSize ?? 6,
    opponentCount: configuration.opponentCount ?? null,
    heroPosition: configuration.heroPosition ?? 'BTN',
    heroCards: representativeCardsForClass(handClass),
    stackBb: configuration.stackBb ?? 100,
    ...facing,
    ...(Object.hasOwn(configuration, 'callAmountBb')
      ? { callAmountBb: configuration.callAmountBb }
      : {}),
    ...(Object.hasOwn(configuration, 'heroStreetContributionBb')
      ? { heroStreetContributionBb: configuration.heroStreetContributionBb }
      : {}),
  });
}

export function evaluatePreflopGrid(provider, {
  handClasses = PREFLOP_HAND_CLASSES,
  positions = ['BTN'],
  stackValues = [100],
  facingCategories = ['unopened'],
  tableSizes = [6],
  exactCallAmounts = {},
} = {}) {
  const rows = [];
  for (const tableSize of tableSizes) {
    for (const heroPosition of positions) {
      for (const stackBb of stackValues) {
        for (const facing of facingCategories) {
          for (const handClass of handClasses) {
            const configuration = {
              tableSize,
              opponentCount: tableSize - 1,
              heroPosition,
              stackBb,
              facing,
            };
            if (Object.hasOwn(exactCallAmounts, facing)) {
              configuration.callAmountBb = exactCallAmounts[facing];
            }
            rows.push({
              tableSize,
              heroPosition,
              stackBb,
              facing,
              handClass,
              result: evaluateDecisionContext(provider, preflopContextFor(handClass, configuration)),
            });
          }
        }
      }
    }
  }
  return rows;
}

export function summarizePreflopConfiguration(provider, configuration, { includeClasses = false } = {}) {
  const rows = PREFLOP_HAND_CLASSES.map((handClass) => ({
    handClass,
    ...evaluateDecisionContext(provider, preflopContextFor(handClass, configuration)),
  }));
  const ordering = [...rows].sort((left, right) => (
    right.aggressiveProbability - left.aggressiveProbability
    || right.passiveProbability - left.passiveProbability
    || left.handClass.localeCompare(right.handClass)
  ));
  const physicalComboWeight = (row) => getHoldemCombosForHandClass(row.handClass).length;
  const actionMass = (weighting, weightForRow) => Object.freeze({
    weighting,
    totalWeight: rows.reduce((sum, row) => sum + weightForRow(row), 0),
    aggression: rounded(weightedAverage(rows, (row) => row.aggressiveProbability, weightForRow)),
    passive: rounded(weightedAverage(rows, (row) => row.passiveProbability, weightForRow)),
    fold: rounded(weightedAverage(rows, (row) => row.foldProbability, weightForRow)),
  });
  const actionMassByWeighting = Object.freeze({
    physicalCombo: actionMass('physical_combo_count', physicalComboWeight),
    equalClass: actionMass('equal_weight_per_169_hand_class', () => 1),
  });
  const summary = {
    id: configuration.id ?? null,
    tableSize: configuration.tableSize,
    heroPosition: configuration.heroPosition,
    stackBb: configuration.stackBb,
    facing: configuration.facing,
    weighting: 'equal_weight_per_169_hand_class',
    classCount: rows.length,
    actionMassByWeighting,
    averageAggression: actionMassByWeighting.equalClass.aggression,
    averagePassive: actionMassByWeighting.equalClass.passive,
    averageFold: actionMassByWeighting.equalClass.fold,
    nearPureAggressionCount: rows.filter((row) => (
      row.aggressiveProbability >= NEAR_PURE_THRESHOLD
    )).length,
    nearPurePassiveCount: rows.filter((row) => (
      row.passiveProbability >= NEAR_PURE_THRESHOLD
    )).length,
    nearPureFoldCount: rows.filter((row) => row.foldProbability >= NEAR_PURE_THRESHOLD).length,
    aggressionOrdering: ordering.map((row) => row.handClass),
    topAggression: ordering.slice(0, 10).map((row) => ({
      handClass: row.handClass,
      probability: row.aggressiveProbability,
    })),
    bottomAggression: ordering.slice(-10).reverse().map((row) => ({
      handClass: row.handClass,
      probability: row.aggressiveProbability,
    })),
  };
  if (includeClasses) {
    summary.classes = Object.fromEntries(rows.map((row) => [row.handClass, {
      actionVector: row.actionVector,
      dominantAction: row.dominantAction,
      aggressiveProbability: row.aggressiveProbability,
      passiveProbability: row.passiveProbability,
      foldProbability: row.foldProbability,
    }]));
  }
  return summary;
}

function maximumActionDelta(left, right) {
  return Math.max(...ACTION_TYPES.map((type) => (
    Math.abs((left.actionVector[type] || 0) - (right.actionVector[type] || 0))
  )));
}

function counterfactualObservation(provider, decisionContext) {
  const result = provider.resolve(decisionContext);
  if (!isStrategyResultV1(result)) throw new TypeError('Counterfactual requires StrategyResult v1');
  return {
    source: result.source,
    sourceVersion: result.sourceVersion,
    coverage: result.contextCoverage,
    actionVector: actionVectorForResult(result),
    actions: clone(result.actions),
    heuristicSample: clone(result.details?.heuristicSample ?? null),
    sampledEquity: result.details?.sampledEquity ?? null,
    explanation: result.explanation,
    warnings: [...result.warnings],
  };
}

export function evaluatePostflopCounterfactuals(options = {}) {
  const provider = createCalibrationStrategyProvider(options);
  return Object.fromEntries(Object.entries(POSTFLOP_COUNTERFACTUAL_CORPUS).map(
    ([id, fixture]) => {
      const baseline = counterfactualObservation(provider, fixture.baseline);
      const counterfactual = counterfactualObservation(provider, fixture.counterfactual);
      return [id, {
        label: fixture.label,
        baseline,
        counterfactual,
        sameSource: baseline.source === counterfactual.source,
        sameActions: JSON.stringify(baseline.actions) === JSON.stringify(counterfactual.actions),
        sameSample: JSON.stringify(baseline.heuristicSample)
          === JSON.stringify(counterfactual.heuristicSample),
        maximumActionDelta: rounded(maximumActionDelta(baseline, counterfactual)),
      }];
    },
  ));
}

function compactPreflopQualitySummary(provider, configuration) {
  const aggregate = summarizePreflopConfiguration(provider, configuration);
  return {
    id: configuration.id,
    tableSize: configuration.tableSize,
    heroPosition: configuration.heroPosition,
    stackBb: configuration.stackBb,
    facing: configuration.facing,
    actionMassByWeighting: aggregate.actionMassByWeighting,
    averageAggression: aggregate.averageAggression,
    averagePassive: aggregate.averagePassive,
    averageFold: aggregate.averageFold,
    boundaryHands: Object.fromEntries(STRATEGY_QUALITY_BOUNDARY_HANDS.map((handClass) => {
      const result = evaluateDecisionContext(
        provider,
        preflopContextFor(handClass, configuration),
      );
      return [handClass, {
        actionVector: result.actionVector,
        dominantAction: result.dominantAction,
      }];
    })),
  };
}

export function buildStrategyQualitySnapshot(options = {}) {
  const provider = createCalibrationStrategyProvider(options);
  const configurations = REPRESENTATIVE_PREFLOP_CONFIGURATIONS.map((configuration) => (
    compactPreflopQualitySummary(provider, configuration)
  ));
  const configurationById = new Map(configurations.map((configuration) => (
    [configuration.id, configuration]
  )));
  const physicalAggression = (id) => (
    configurationById.get(id).actionMassByWeighting.physicalCombo.aggression
  );
  const progressionIsMonotonic = (ids) => ids.every((id, index) => (
    index === 0 || physicalAggression(id) + 1e-12 >= physicalAggression(ids[index - 1])
  ));
  const structuralDiagnostics = Object.freeze({
    weighting: 'physical_combo_count',
    huMinusSixMaxButtonAggression: rounded(
      physicalAggression('hu_100_btn_unopened')
        - physicalAggression('six_max_100_btn_unopened'),
    ),
    sixMaxMinusNineMaxFirstAggression: rounded(
      physicalAggression('six_max_100_utg_unopened')
        - physicalAggression('nine_max_100_utg_unopened'),
    ),
    sixMaxMinusNineMaxButtonAggression: rounded(
      physicalAggression('six_max_100_btn_unopened')
        - physicalAggression('nine_max_100_btn_unopened'),
    ),
    sixMaxProgressionMonotonic: progressionIsMonotonic([
      'six_max_100_utg_unopened',
      'six_max_100_hj_unopened',
      'six_max_100_co_unopened',
      'six_max_100_btn_unopened',
    ]),
    nineMaxProgressionMonotonic: progressionIsMonotonic([
      'nine_max_100_utg_unopened',
      'nine_max_100_utg_plus_1_unopened',
      'nine_max_100_mp_unopened',
      'nine_max_100_lj_unopened',
      'nine_max_100_hj_unopened',
      'nine_max_100_co_unopened',
      'nine_max_100_btn_unopened',
    ]),
    externalPercentageAssertions: false,
  });
  const allInRows = [10, 30, 100, 200, 500].flatMap((stackBb) => (
    PREFLOP_HAND_CLASSES.map((handClass) => evaluateDecisionContext(
      provider,
      preflopContextFor(handClass, {
        tableSize: 6,
        opponentCount: 5,
        heroPosition: 'BTN',
        stackBb,
        facing: 'unopened',
      }),
    ))
  ));
  return {
    schemaVersion: STRATEGY_QUALITY_SNAPSHOT_SCHEMA_VERSION,
    scope: 'heuristic_calibration_metrics_not_solved_truth',
    claims: {
      solvedGto: false,
      exactSolverAgreement: false,
      safeForFrequencyRetuning: false,
    },
    preflop: {
      configurations,
      boundaryHands: [...STRATEGY_QUALITY_BOUNDARY_HANDS],
      metricAssumptions: clone(RFI_METRIC_ASSUMPTIONS),
      externalSanityReferences: clone(RFI_EXTERNAL_SANITY_REFERENCES),
      acceptanceInvariants: [...RFI_ACCEPTANCE_INVARIANTS],
      structuralDiagnostics,
      allInReachability: {
        supportedStackDepthsBb: [10, 30, 100, 200, 500],
        evaluatedResultCount: allInRows.length,
        positiveAllInResultCount: allInRows.filter((row) => (
          row.actionVector.all_in > 0
        )).length,
      },
    },
    postflop: {
      namedCorpus: evaluatePostflopCorpus(options),
      counterfactuals: evaluatePostflopCounterfactuals(options),
    },
  };
}

export function diagnosePreflopSanity(provider) {
  const positionSummaries = NON_BLIND_POSITIONS.map((heroPosition) => (
    summarizePreflopConfiguration(provider, {
      id: `position_${heroPosition}`,
      tableSize: 10,
      opponentCount: 9,
      heroPosition,
      stackBb: 100,
      facing: 'unopened',
    })
  ));
  const positionalInversions = [];
  for (let index = 1; index < positionSummaries.length; index += 1) {
    const earlier = positionSummaries[index - 1];
    const later = positionSummaries[index];
    if (later.averageAggression + 1e-12 < earlier.averageAggression) {
      positionalInversions.push({ earlier: earlier.heroPosition, later: later.heroPosition });
    }
  }

  const comparisonConfigurations = [
    { id: 'btn_unopened', tableSize: 6, opponentCount: 5, heroPosition: 'BTN', stackBb: 100, facing: 'unopened' },
    { id: 'bb_facing_open', tableSize: 6, opponentCount: 5, heroPosition: 'BB', stackBb: 100, facing: 'facing_open' },
    { id: 'btn_facing_3bet', tableSize: 6, opponentCount: 5, heroPosition: 'BTN', stackBb: 100, facing: 'facing_3bet' },
  ];
  const premiumDominanceAnomalies = [];
  const pairOrderingAnomalies = [];
  const suitednessAnomalies = [];
  const pairOrder = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'];

  for (const configuration of comparisonConfigurations) {
    const byClass = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [
      handClass,
      evaluateDecisionContext(provider, preflopContextFor(handClass, configuration)),
    ]));
    for (const premium of ['AA', 'KK', 'AKs']) {
      for (const weak of ['72o', '83o']) {
        const stronger = byClass.get(premium);
        const weaker = byClass.get(weak);
        if (stronger.foldProbability > weaker.foldProbability + 0.1) {
          premiumDominanceAnomalies.push({
            configuration: configuration.id,
            premium,
            weak,
            premiumFold: stronger.foldProbability,
            weakFold: weaker.foldProbability,
          });
        }
      }
    }
    for (let index = 1; index < pairOrder.length; index += 1) {
      const strongerClass = pairOrder[index - 1];
      const weakerClass = pairOrder[index];
      const stronger = byClass.get(strongerClass);
      const weaker = byClass.get(weakerClass);
      const strongerContinue = 1 - stronger.foldProbability;
      const weakerContinue = 1 - weaker.foldProbability;
      if (strongerContinue + 0.1 < weakerContinue) {
        pairOrderingAnomalies.push({
          configuration: configuration.id,
          strongerClass,
          weakerClass,
          strongerContinue: rounded(strongerContinue),
          weakerContinue: rounded(weakerContinue),
        });
      }
    }
    for (let high = 0; high < 12; high += 1) {
      for (let low = high + 1; low < 13; low += 1) {
        const first = PREFLOP_HAND_CLASSES.find((handClass) => (
          handClass === `${'AKQJT98765432'[high]}${'AKQJT98765432'[low]}s`
        ));
        if (!first) continue;
        const offsuit = `${first.slice(0, 2)}o`;
        const suitedContinue = 1 - byClass.get(first).foldProbability;
        const offsuitContinue = 1 - byClass.get(offsuit).foldProbability;
        if (suitedContinue + 0.1 < offsuitContinue) {
          suitednessAnomalies.push({
            configuration: configuration.id,
            suited: first,
            offsuit,
            suitedContinue: rounded(suitedContinue),
            offsuitContinue: rounded(offsuitContinue),
          });
        }
      }
    }
  }

  const continuityHands = ['AA', 'AKs', 'A5s', '88', '76s', '72o'];
  const continuityBoundaries = [10, 30, 50, 100, 200, 300];
  const stackContinuity = [];
  for (const handClass of continuityHands) {
    for (const boundary of continuityBoundaries) {
      const base = {
        tableSize: 6, opponentCount: 5, heroPosition: 'BTN', facing: 'unopened',
      };
      const below = evaluateDecisionContext(provider, preflopContextFor(handClass, {
        ...base, stackBb: boundary - 0.001,
      }));
      const above = evaluateDecisionContext(provider, preflopContextFor(handClass, {
        ...base, stackBb: boundary + 0.001,
      }));
      stackContinuity.push({
        handClass,
        boundaryBb: boundary,
        maxActionDelta: rounded(maximumActionDelta(below, above)),
      });
    }
  }

  return {
    caution: 'Only material, robust comparisons are checked; global poker-strength monotonicity is not asserted.',
    positionSummaries: positionSummaries.map((summary) => ({
      heroPosition: summary.heroPosition,
      averageAggression: summary.averageAggression,
      averagePassive: summary.averagePassive,
      averageFold: summary.averageFold,
    })),
    positionalInversions,
    premiumDominanceAnomalies,
    pairOrderingAnomalies,
    suitednessAnomalies,
    stackContinuity,
    maximumTinyStackDelta: rounded(Math.max(...stackContinuity.map((row) => row.maxActionDelta))),
  };
}

function normalizeProbabilityVector(raw, label) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError(`${label} must be an action-probability object`);
  }
  const vector = Object.fromEntries(Object.entries(raw).map(([action, value]) => {
    const probability = Number(value);
    if (!Number.isFinite(probability) || probability < 0) {
      throw new RangeError(`${label}.${action} must be finite and non-negative`);
    }
    return [action, probability];
  }));
  const total = Object.values(vector).reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new RangeError(`${label} must contain positive probability mass`);
  return Object.fromEntries(Object.entries(vector).map(([action, value]) => [action, value / total]));
}

export function projectActionVector(raw, projection = 'structural') {
  const vector = normalizeProbabilityVector(raw, 'actionVector');
  if (projection === 'structural') {
    return Object.fromEntries(ACTION_TYPES.map((type) => [type, vector[type] || 0]));
  }
  if (projection === 'strategic_families') {
    return {
      fold: vector.fold || 0,
      passive: (vector.call || 0) + (vector.check || 0),
      aggression: (vector.bet || 0) + (vector.raise || 0) + (vector.all_in || 0),
    };
  }
  throw new RangeError(`Unsupported action-vector projection: ${projection}`);
}

export function compareProbabilityVectors(fallbackRaw, referenceRaw, projection = 'structural') {
  const fallback = projectActionVector(fallbackRaw, projection);
  const reference = projectActionVector(referenceRaw, projection);
  const actions = [...new Set([...Object.keys(fallback), ...Object.keys(reference)])].sort();
  const errors = Object.fromEntries(actions.map((action) => [
    action,
    rounded(Math.abs((fallback[action] || 0) - (reference[action] || 0))),
  ]));
  return {
    projection,
    fallback: Object.fromEntries(actions.map((action) => [action, rounded(fallback[action] || 0)])),
    reference: Object.fromEntries(actions.map((action) => [action, rounded(reference[action] || 0)])),
    l1Distance: rounded(Object.values(errors).reduce((sum, error) => sum + error, 0)),
    maxActionProbabilityError: rounded(Math.max(...Object.values(errors))),
    dominantFallbackAction: dominantAction(fallback),
    dominantReferenceAction: dominantAction(reference),
    dominantActionDisagrees: dominantAction(fallback) !== dominantAction(reference),
    actionErrors: errors,
  };
}

export function compareBoundedHuReference(provider, reference) {
  if (reference === null || reference === undefined) {
    return {
      status: 'unavailable',
      comparableRowCount: 0,
      reason: 'No validated bounded-HU strategy fixture exists in the repository.',
      metrics: null,
      worstMismatches: [],
    };
  }
  if (reference.schemaVersion !== CALIBRATION_REFERENCE_SCHEMA_VERSION) {
    throw new RangeError(`Expected ${CALIBRATION_REFERENCE_SCHEMA_VERSION}`);
  }
  if (reference.gameVersion !== BOUNDED_HU_GAME_VERSION) {
    throw new RangeError(`Reference game version must be ${BOUNDED_HU_GAME_VERSION}`);
  }
  if (reference.quality?.sufficientForCalibration !== true) {
    return {
      status: 'insufficient_reference_quality',
      comparableRowCount: 0,
      reason: reference.quality?.reason ?? 'Reference metadata does not authorize calibration use.',
      quality: clone(reference.quality),
      metrics: null,
      worstMismatches: [],
    };
  }
  if (!Array.isArray(reference.rows) || reference.rows.length === 0) {
    throw new RangeError('A sufficient reference requires at least one comparison row');
  }

  const rows = reference.rows.map((row) => {
    const fallback = evaluateDecisionContext(provider, row.decisionContext);
    return {
      id: String(row.id),
      handClass: row.handClass ?? null,
      heroCards: [...row.decisionContext.heroCards],
      ...compareProbabilityVectors(
        fallback.actionVector,
        row.referenceActionVector,
        row.projection ?? 'structural',
      ),
    };
  });
  const worstMismatches = [...rows]
    .sort((left, right) => right.l1Distance - left.l1Distance || left.id.localeCompare(right.id))
    .slice(0, 20);
  return {
    status: 'compared',
    comparableRowCount: rows.length,
    quality: clone(reference.quality),
    metrics: {
      meanL1Distance: rounded(average(rows.map((row) => row.l1Distance))),
      maximumL1Distance: rounded(Math.max(...rows.map((row) => row.l1Distance))),
      meanMaxActionProbabilityError: rounded(average(
        rows.map((row) => row.maxActionProbabilityError),
      )),
      dominantActionDisagreementRate: rounded(
        rows.filter((row) => row.dominantActionDisagrees).length / rows.length,
      ),
      meanAggressionProbabilityError: rounded(average(rows.map((row) => (
        Math.abs(
          ((row.fallback.aggression ?? row.fallback.raise ?? 0) + (row.fallback.bet ?? 0)
            + (row.fallback.all_in ?? 0))
          - ((row.reference.aggression ?? row.reference.raise ?? 0) + (row.reference.bet ?? 0)
            + (row.reference.all_in ?? 0))
        )
      )))),
      meanPassiveProbabilityError: rounded(average(rows.map((row) => (
        Math.abs(
          ((row.fallback.passive ?? row.fallback.call ?? 0) + (row.fallback.check ?? 0))
          - ((row.reference.passive ?? row.reference.call ?? 0) + (row.reference.check ?? 0))
        )
      )))),
      meanFoldProbabilityError: rounded(average(rows.map((row) => (
        Math.abs((row.fallback.fold || 0) - (row.reference.fold || 0))
      )))),
    },
    worstMismatches,
    rows,
  };
}

export function evaluatePostflopCorpus(options = {}) {
  const provider = createCalibrationStrategyProvider(options);
  return POSTFLOP_NAMED_CORPUS.map((spot) => {
    const result = evaluateDecisionContext(provider, spot.context);
    const classification = result.details?.handClassification ?? {};
    const sample = result.details?.heuristicSample ?? {};
    return {
      id: spot.id,
      label: spot.label,
      street: spot.context.street,
      heroCards: [...spot.context.heroCards],
      board: [...spot.context.board],
      canonicalCategory: classification.canonicalCategory ?? null,
      canonicalScore: classification.canonicalScore ?? null,
      strategicCategory: classification.strategicCategory ?? null,
      madeHand: classification.madeHand ?? null,
      draws: classification.draws ?? [],
      sampledStrength: result.details?.sampledEquity ?? null,
      actionVector: result.actionVector,
      dominantAction: result.dominantAction,
      aggressiveProbability: result.aggressiveProbability,
      passiveProbability: result.passiveProbability,
      foldProbability: result.foldProbability,
      sizes: result.actions.map(({ type, amountBb, potFraction, label }) => ({
        type, amountBb, potFraction, label,
      })),
      opponentCount: sample.opponentCount ?? null,
      opponentCountSource: sample.opponentCountSource ?? null,
      assumedRangeFraction: sample.rangeFraction ?? null,
      assumedRangeComboCount: sample.rangeComboCount ?? null,
      assumedRangeDistribution: sample.rangeDistribution ?? null,
      playStyle: result.details?.playStyle ?? null,
      opponentStyle: result.details?.opponentStyle ?? null,
      facesWager: result.details?.facesWager ?? null,
      positionAdjustmentApplied: result.details?.positionAdjustmentApplied ?? null,
      sizingSemantics: result.details?.sizingSemantics ?? null,
    };
  });
}

export function diagnosePostflopCorpus(rows = evaluatePostflopCorpus()) {
  const mechanicalAnomalies = [];
  for (const row of rows) {
    const total = row.aggressiveProbability + row.passiveProbability + row.foldProbability;
    if (Math.abs(total - 1) > 1e-9) {
      mechanicalAnomalies.push({ code: 'probability_total', spot: row.id, total });
    }
    const allowed = row.facesWager
      ? new Set(['fold', 'call', 'raise'])
      : new Set(['check', 'bet']);
    for (const [type, probability] of Object.entries(row.actionVector)) {
      if (probability > 0 && !allowed.has(type)) {
        mechanicalAnomalies.push({
          code: 'action_family_mismatch', spot: row.id, type, probability,
        });
      }
    }
    if (row.sizes.some((action) => action.amountBb !== null || action.potFraction !== null)) {
      mechanicalAnomalies.push({ code: 'unexpected_exact_size', spot: row.id });
    }
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const robustQualitativeAnomalies = [];
  for (const [strongerId, weakerId] of [
    ['flop_nut_straight', 'flop_air'],
    ['flop_overpair_dry', 'flop_weak_pair'],
    ['flop_top_pair_dry', 'flop_weak_pair'],
    ['turn_two_pair', 'turn_flush_draw'],
  ]) {
    const stronger = byId.get(strongerId);
    const weaker = byId.get(weakerId);
    if (!stronger || !weaker) continue;
    if (stronger.foldProbability > weaker.foldProbability + 0.2) {
      robustQualitativeAnomalies.push({
        code: 'stronger_hand_materially_folds_more', strongerId, weakerId,
      });
    }
    if (stronger.aggressiveProbability + 0.5 < weaker.aggressiveProbability) {
      robustQualitativeAnomalies.push({
        code: 'stronger_hand_radically_less_aggressive', strongerId, weakerId,
      });
    }
  }
  return {
    mechanicalAnomalies,
    robustQualitativeAnomalies,
    calibrationUnknowns: [
      'Opponent candidate-range score, width, and uniform distribution are Level D.',
      'Category/draw/texture/stack offsets and frequency anchors are Level D.',
      'No postflop solver reference exists; exact frequency quality is unvalidated.',
    ],
  };
}

export function diagnosePriceResponse({ callAmountsBb = [0.5, 1, 2, 5, 10, 20] } = {}) {
  const provider = createCalibrationStrategyProvider();
  return PRICE_RESPONSE_SPOTS.map((spot) => {
    const rows = callAmountsBb.map((callAmountBb) => {
      const decisionContext = {
        ...spot.context,
        facingSizeBb: Math.max(...callAmountsBb),
        callAmountBb,
      };
      const result = evaluateDecisionContext(provider, decisionContext);
      return {
        callAmountBb,
        requiredRawEquity: result.details.requiredRawEquity,
        sampledStrength: result.details.sampledEquity,
        aggression: result.aggressiveProbability,
        passive: result.passiveProbability,
        fold: result.foldProbability,
      };
    });
    const foldDirectionAnomalies = rows.slice(1).flatMap((row, index) => (
      row.fold + 1e-12 < rows[index].fold
        ? [{
          cheaperCallAmountBb: rows[index].callAmountBb,
          expensiveCallAmountBb: row.callAmountBb,
        }]
        : []
    ));
    return {
      id: spot.id,
      label: spot.label,
      invariant: 'For a fixed sample and pot, fold probability should not fall as exact call price rises.',
      rows,
      foldDirectionAnomalies,
    };
  });
}

export function diagnoseStyleControls({ styleValues = [0, 0.25, 0.5, 0.75, 1] } = {}) {
  const styleContext = POSTFLOP_NAMED_CORPUS.find((spot) => spot.id === 'flop_open_ended_draw').context;
  const opponentRows = styleValues.map((opponentStyle) => {
    const result = evaluateDecisionContext(
      createCalibrationStrategyProvider({ opponentStyle, playStyle: 0 }),
      styleContext,
    );
    return {
      opponentStyle,
      rangeTargetFraction: result.details.heuristicSample.rangeTargetFraction,
      rangeFraction: result.details.heuristicSample.rangeFraction,
      sampledStrength: result.details.sampledEquity,
      aggressionScore: result.details.aggressionScore,
      actionVector: result.actionVector,
    };
  });
  const playRows = styleValues.map((playStyle) => {
    const result = evaluateDecisionContext(
      createCalibrationStrategyProvider({ opponentStyle: 0.5, playStyle }),
      styleContext,
    );
    return {
      playStyle,
      sampledStrength: result.details.sampledEquity,
      aggressionScore: result.details.aggressionScore,
      actionVector: result.actionVector,
      aggression: result.aggressiveProbability,
    };
  });
  const opponentAdjacentDeltas = opponentRows.slice(1).map((row, index) => ({
    from: opponentRows[index].opponentStyle,
    to: row.opponentStyle,
    rangeFractionDelta: rounded(row.rangeFraction - opponentRows[index].rangeFraction),
    sampledStrengthDelta: rounded(row.sampledStrength - opponentRows[index].sampledStrength),
    maxActionDelta: rounded(Math.max(...ACTION_TYPES.map((type) => (
      Math.abs(row.actionVector[type] - opponentRows[index].actionVector[type])
    )))),
  }));
  const playAdjacentDeltas = playRows.slice(1).map((row, index) => ({
    from: playRows[index].playStyle,
    to: row.playStyle,
    aggressionScoreDelta: rounded(row.aggressionScore - playRows[index].aggressionScore),
    aggressionProbabilityDelta: rounded(row.aggression - playRows[index].aggression),
  }));
  return {
    opponentStyle: {
      semantics: 'higher value samples a looser assumed candidate range',
      rows: opponentRows,
      rangeWidthMonotonic: opponentAdjacentDeltas.every((row) => row.rangeFractionDelta >= 0),
      adjacentDeltas: opponentAdjacentDeltas,
      caution: 'Changing opponentStyle also changes the deterministic sample seed, so sampled-strength movement is diagnostic noise plus range effect, not causal calibration evidence.',
    },
    playStyle: {
      semantics: 'postflop continuous aggression-score bias; preflop neutral',
      rows: playRows,
      adjacentDeltas: playAdjacentDeltas,
      sampledStrengthInvariant: playRows.every((row) => row.sampledStrength === playRows[0].sampledStrength),
      maximumAggressionProbabilityShift: rounded(
        Math.max(...playRows.map((row) => row.aggression))
        - Math.min(...playRows.map((row) => row.aggression)),
      ),
    },
  };
}

export function diagnoseMultiway({ measureRuntime = false } = {}) {
  const rows = [1, 2, 5].map((opponentCount) => {
    const context = {
      ...MULTIWAY_SPOT.context,
      tableSize: opponentCount + 1,
      opponentCount,
    };
    const started = performance.now();
    const result = evaluateDecisionContext(createCalibrationStrategyProvider({
      playStyle: 0.5,
      opponentStyle: 0.5,
    }), context);
    const row = {
      players: opponentCount + 1,
      opponentCount,
      sampledStrength: result.details.sampledEquity,
      aggression: result.aggressiveProbability,
      passive: result.passiveProbability,
      fold: result.foldProbability,
      probabilityTotal: rounded(
        result.aggressiveProbability + result.passiveProbability + result.foldProbability,
      ),
      completedSamples: result.details.heuristicSample.completedSamples,
    };
    if (measureRuntime) row.runtimeMilliseconds = rounded(performance.now() - started, 3);
    return row;
  });
  return {
    equilibriumClaim: false,
    rows,
    sampledStrengthNonIncreasing: rows.slice(1).every((row, index) => (
      row.sampledStrength <= rows[index].sampledStrength + 1e-12
    )),
    aggressionNonIncreasing: rows.slice(1).every((row, index) => (
      row.aggression <= rows[index].aggression + 1e-12
    )),
  };
}

function labelMatchesType(label, type) {
  const normalized = String(label).toLowerCase();
  if (normalized.includes('fold')) return type === 'fold';
  if (normalized.includes('check')) return type === 'check';
  if (normalized.includes('limp') || normalized.includes('call')) return type === 'call';
  if (normalized.includes('all-in') || normalized.includes('all in')) return type === 'all_in';
  if (normalized.includes('bet') || normalized.includes('open') || normalized.includes('raise')) {
    return ['bet', 'raise'].includes(type);
  }
  return true;
}

export function diagnoseSizing() {
  const provider = createCalibrationStrategyProvider();
  const contexts = [];
  for (const stackBb of [10, 30, 100, 200, 500]) {
    for (const handClass of ['AA', 'AKs', '76s', '72o']) {
      contexts.push({
        id: `unopened_${stackBb}_${handClass}`,
        context: preflopContextFor(handClass, {
          tableSize: 6, opponentCount: 5, heroPosition: 'BTN', stackBb, facing: 'unopened',
        }),
      });
    }
  }
  contexts.push({
    id: 'hu_btn_unopened',
    context: preflopContextFor('AKs', {
      tableSize: 2, opponentCount: 1, heroPosition: 'BTN', stackBb: 100, facing: 'unopened',
    }),
  });
  contexts.push({
    id: 'bb_facing_stack_cap',
    context: preflopContextFor('AA', {
      tableSize: 2, opponentCount: 1, heroPosition: 'BB', stackBb: 100, facing: 'facing_all_in',
    }),
  });

  const emitted = [];
  const anomalies = [];
  for (const fixture of contexts) {
    const result = evaluateDecisionContext(provider, fixture.context);
    for (const action of result.actions) {
      emitted.push({
        context: fixture.id,
        stackBb: fixture.context.stackBb,
        type: action.type,
        amountBb: action.amountBb,
        potFraction: action.potFraction,
        label: action.label,
      });
      if (action.amountBb !== null && (
        action.amountBb < 0 || action.amountBb > fixture.context.stackBb
      )) {
        anomalies.push({ code: 'amount_outside_stack', context: fixture.id, action });
      }
      if (action.amountBb !== null && action.amountBb === fixture.context.stackBb
        && action.type !== 'all_in') {
        anomalies.push({ code: 'full_stack_labeled_non_all_in', context: fixture.id, action });
      }
      if (!labelMatchesType(action.label, action.type)) {
        anomalies.push({ code: 'label_type_mismatch', context: fixture.id, action });
      }
      if (fixture.id === 'hu_btn_unopened' && action.type === 'call'
        && action.label.toLowerCase() !== 'limp') {
        anomalies.push({ code: 'hu_button_passive_label_not_limp', context: fixture.id, action });
      }
    }
    const callConsumesStack = Number.isFinite(fixture.context.callAmountBb)
      && Number.isFinite(fixture.context.heroStreetContributionBb)
      && fixture.context.callAmountBb + fixture.context.heroStreetContributionBb
        >= fixture.context.stackBb;
    if (callConsumesStack && result.actionVector.raise > 0) {
      anomalies.push({
        code: 'raise_emitted_when_call_reaches_stack_cap',
        context: fixture.id,
        raiseProbability: result.actionVector.raise,
      });
    }
  }

  const uniquePreflopSizes = [...new Set(emitted
    .filter((action) => action.amountBb !== null)
    .map((action) => `${action.type}:${action.amountBb}`))].sort();
  const postflop = evaluatePostflopCorpus();
  return {
    preflopAmountSemantics: 'amount-to total preflop contribution after acting',
    uniqueExplicitPreflopSizes: uniquePreflopSizes,
    preflopSizedActionCount: emitted.filter((action) => action.amountBb !== null).length,
    postflopSizingSemantics: 'omitted because complete legal sizing bounds are unavailable',
    postflopExplicitSizeCount: postflop.flatMap((spot) => spot.sizes).filter((action) => (
      action.amountBb !== null || action.potFraction !== null
    )).length,
    anomalies,
  };
}

export function buildCalibrationReport({ reference = null, includeClasses = false } = {}) {
  const provider = createCalibrationStrategyProvider();
  const preflop = REPRESENTATIVE_PREFLOP_CONFIGURATIONS.map((configuration) => (
    summarizePreflopConfiguration(provider, configuration, { includeClasses })
  ));
  const postflopCorpus = evaluatePostflopCorpus();
  return {
    schemaVersion: CALIBRATION_REPORT_SCHEMA_VERSION,
    determinism: 'Same code, inputs, and options produce identical JSON except runtime-only reports.',
    productionAuthority: 'StrategyProvider v1 with deterministic heuristic fallback',
    claims: {
      solvedGto: false,
      multiplayerEquilibrium: false,
      postflopSolverValidated: false,
    },
    boundedSolver: {
      gameVersion: BOUNDED_HU_GAME_VERSION,
      status: 'game_and_validation_harness_only_not_solved',
      overlap: BOUNDED_HU_OVERLAP,
      referenceComparison: compareBoundedHuReference(provider, reference),
    },
    preflop: {
      configurations: preflop,
      sanity: diagnosePreflopSanity(provider),
      architectureSignals: {
        tableSizePairsWithIdenticalSummary: [
          ['hu_100_btn_unopened', 'six_max_100_btn_unopened'],
          ['six_max_100_btn_unopened', 'nine_max_100_btn_unopened'],
          ['six_max_100_utg_unopened', 'nine_max_100_utg_unopened'],
        ].filter(([leftId, rightId]) => {
          const left = preflop.find((summary) => summary.id === leftId);
          const right = preflop.find((summary) => summary.id === rightId);
          return left.averageAggression === right.averageAggression
            && left.averagePassive === right.averagePassive
            && left.averageFold === right.averageFold
            && left.aggressionOrdering.join(',') === right.aggressionOrdering.join(',');
        }),
        codeAudit: 'Unopened preflop position adjustment consumes canonical tableSize/position facts.',
        implication: 'Table families can now express distinct positional opening baselines without changing facing-aggression anchors.',
      },
    },
    postflop: {
      corpus: postflopCorpus,
      corpusDiagnostics: diagnosePostflopCorpus(postflopCorpus),
      priceResponse: diagnosePriceResponse(),
      styleControls: diagnoseStyleControls(),
      multiway: diagnoseMultiway(),
    },
    sizing: diagnoseSizing(),
  };
}

export function measureCalibrationRuntime({ runs = 1 } = {}) {
  if (!Number.isInteger(runs) || runs <= 0) throw new RangeError('runs must be a positive integer');
  const durations = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    buildCalibrationReport();
    durations.push(performance.now() - started);
  }
  return {
    schemaVersion: 'riverline-strategy-calibration-runtime/v1',
    scope: 'calibration_tooling_only_not_production_runtime',
    runs,
    milliseconds: durations.map((duration) => rounded(duration, 3)),
    meanMilliseconds: rounded(average(durations), 3),
    multiway: diagnoseMultiway({ measureRuntime: true }).rows.map((row) => ({
      players: row.players,
      opponentCount: row.opponentCount,
      runtimeMilliseconds: row.runtimeMilliseconds,
      completedSamples: row.completedSamples,
    })),
  };
}

export const CALIBRATION_SUPPORTED_DIMENSIONS = Object.freeze({
  exactDecisionContext: true,
  preflopHandClasses: PREFLOP_HAND_CLASSES.length,
  positions: ALL_POSITIONS,
  stackValues: 'caller supplied',
  facingCategories: Object.keys(PREFLOP_FACING_CATEGORIES),
  exactCallAmounts: 'caller supplied by facing category or exact DecisionContext',
  postflopNamedCorpusSize: POSTFLOP_NAMED_CORPUS.length,
  referenceComparisonSchema: CALIBRATION_REFERENCE_SCHEMA_VERSION,
});
