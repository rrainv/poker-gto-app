import {
  createCalibrationStrategyProvider,
  evaluateDecisionContext,
} from './strategy-calibration-harness.mjs';
import {
  calibrationDecisionContext,
  representativeCardsForClass,
} from './strategy-calibration-corpora.mjs';

const provider = createCalibrationStrategyProvider();

export const STRATEGY_REPAIR001B_FROZEN_BASELINE = Object.freeze({
  schemaVersion: 'strategy-repair001b-frozen-baseline/v1',
  capturedBeforeStrategyEdits: true,
  actionVectors: Object.freeze({
    rfi_six_btn: { fold: 0.05, check: 0, call: 0, bet: 0, raise: 0.95, all_in: 0 },
    rfi_hu_btn: { fold: 0.05, check: 0, call: 0, bet: 0, raise: 0.95, all_in: 0 },
    rfi_nine_utg: {
      fold: 0.056896296296, check: 0, call: 0, bet: 0, raise: 0.943103703704, all_in: 0,
    },
    one_limp: { fold: 0.05, check: 0, call: 0, bet: 0, raise: 0.95, all_in: 0 },
    multiple_limps: { fold: 0.05, check: 0, call: 0, bet: 0, raise: 0.95, all_in: 0 },
    facing_open: {
      fold: 0.046752915452, check: 0, call: 0.103247084548,
      bet: 0, raise: 0.85, all_in: 0,
    },
    facing_3bet: {
      fold: 0.048721876541, check: 0, call: 0.101278123459,
      bet: 0, raise: 0.85, all_in: 0,
    },
    facing_4bet: {
      fold: 0.055461458634, check: 0, call: 0.146390393218,
      bet: 0, raise: 0.798148148148, all_in: 0,
    },
    facing_3bet_kqs: {
      fold: 0.048721876541, check: 0, call: 0.101278123459,
      bet: 0, raise: 0.85, all_in: 0,
    },
    facing_4bet_qq: {
      fold: 0.061146716925, check: 0, call: 0.235939220575,
      bet: 0, raise: 0.7029140625, all_in: 0,
    },
    bb_option: { fold: 0, check: 0.15, call: 0, bet: 0, raise: 0.85, all_in: 0 },
    post_ip: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_oop: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_mixed: {
      fold: 0, check: 0, call: 0.473333333333,
      bet: 0, raise: 0.526666666667, all_in: 0,
    },
    post_shallow: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_medium: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_deep: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_check: { fold: 0, check: 0, call: 0, bet: 1, raise: 0, all_in: 0 },
    post_small_price: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_medium_price: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_large_price: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_raise_illegal: { fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0 },
    post_short_all_in_only: {
      fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0,
    },
    post_current_pot_275: {
      fold: 0, check: 0, call: 0.05, bet: 0, raise: 0.95, all_in: 0,
    },
  }),
});

const OBSERVED_FACTS = Object.freeze([
  'street',
  'tableSize',
  'opponentCount',
  'heroPosition',
  'stackBb',
  'heroStackBb',
  'effectiveStackBb',
  'effectiveStackByOpponent',
  'currentPotBb',
  'potBb',
  'positionRelation',
  'aggressorPositionRelation',
  'lastAction',
  'callAmountBb',
  'canRaise',
  'minRaiseToBb',
  'maxRaiseToBb',
  'allInToBb',
  'priorActionSummary',
]);

function observedFacts(context) {
  return Object.fromEntries(OBSERVED_FACTS.map((key) => [key, context[key] ?? null]));
}

function observe(id, context) {
  const result = evaluateDecisionContext(provider, context);
  return {
    id,
    facts: observedFacts(context),
    output: {
      source: result.source,
      actionVector: result.actionVector,
      dominantAction: result.dominantAction,
      requiredRawEquity: result.details?.requiredRawEquity ?? null,
      compatibilityStackToPotRatio:
        result.details?.compatibilityStackToPotRatio ?? null,
      positionAdjustmentApplied: result.details?.positionAdjustmentApplied ?? null,
      stackSemantics: result.details?.stackSemantics ?? null,
    },
  };
}

const EMPTY_PREFLOP_SUMMARY = Object.freeze({
  lastActionFamily: 'none',
  lastActorPosition: null,
  facingActionFamily: 'none',
  aggressionFamily: 'none',
  aggressionCount: 0,
  limperCount: 0,
  aggressorPosition: null,
});

function preflopObservation(handClass, id, overrides = {}) {
  return observe(id, calibrationDecisionContext({
    contractVersion: 'decision-context/v1.1',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    heroCards: representativeCardsForClass(handClass),
    startingStackBb: 100,
    heroStackBb: 99,
    effectiveStackBb: null,
    effectiveStackByOpponent: [],
    currentPotBb: 1.5,
    positionRelation: 'not_applicable',
    aggressorPositionRelation: 'not_applicable',
    canRaise: true,
    minRaiseToBb: 2,
    maxRaiseToBb: 100,
    allInToBb: 100,
    priorActionSummary: EMPTY_PREFLOP_SUMMARY,
    ...overrides,
  }));
}

function aggressionSummary(aggressionFamily, aggressionCount, position = 'BB') {
  return {
    lastActionFamily: 'raise',
    lastActorPosition: position,
    facingActionFamily: 'raise',
    aggressionFamily,
    aggressionCount,
    limperCount: 0,
    aggressorPosition: position,
  };
}

const TOP_PAIR_FACING_BET = Object.freeze({
  contractVersion: 'decision-context/v1.1',
  tableSize: 2,
  opponentCount: 1,
  heroPosition: 'BTN',
  heroCards: ['As', 'Kd'],
  board: ['Ah', '7d', '2c'],
  stackBb: 100,
  startingStackBb: 100,
  heroStackBb: 40,
  effectiveStackBb: 40,
  effectiveStackByOpponent: [
    { position: 'BB', opponentStackBb: 40, effectiveStackBb: 40 },
  ],
  potBb: 10,
  currentPotBb: 10,
  lastAction: 'bet',
  facingSizeBb: 5,
  callAmountBb: 5,
  heroStreetContributionBb: 0,
  positionRelation: 'in_position',
  aggressorPositionRelation: 'in_position',
  canRaise: true,
  minRaiseToBb: 10,
  maxRaiseToBb: 40,
  allInToBb: 40,
  priorActionSummary: {
    lastActionFamily: 'bet',
    lastActorPosition: 'BB',
    facingActionFamily: 'bet',
    aggressionFamily: 'bet',
    aggressionCount: 1,
    limperCount: null,
    aggressorPosition: 'BB',
  },
});

function postflopObservation(id, overrides = {}) {
  return observe(id, calibrationDecisionContext({
    ...TOP_PAIR_FACING_BET,
    ...overrides,
  }));
}

function limpSummary(limperCount) {
  return {
    ...EMPTY_PREFLOP_SUMMARY,
    lastActionFamily: 'limp',
    lastActorPosition: 'CO',
    facingActionFamily: 'limp',
    limperCount,
  };
}

export function buildStrategyRepair001bBaseline() {
  const currentRows = [
    preflopObservation('AJs', 'rfi_six_btn'),
      preflopObservation('AJs', 'rfi_hu_btn', { tableSize: 2, opponentCount: 1 }),
      preflopObservation('AJs', 'rfi_nine_utg', {
        tableSize: 9, opponentCount: 8, heroPosition: 'UTG',
      }),
      preflopObservation('AJs', 'one_limp', {
        lastAction: 'check', priorActionSummary: limpSummary(1),
      }),
      preflopObservation('AJs', 'multiple_limps', {
        lastAction: 'check', priorActionSummary: limpSummary(3),
      }),
      preflopObservation('AJs', 'facing_open', {
        heroPosition: 'BB',
        lastAction: 'raise',
        facingSizeBb: 2.5,
        callAmountBb: 1.5,
        heroStreetContributionBb: 1,
        potBb: 3.5,
        currentPotBb: 3.5,
        priorActionSummary: aggressionSummary('open', 1, 'BTN'),
      }),
      preflopObservation('AJs', 'facing_3bet', {
        lastAction: '3bet',
        facingSizeBb: 8,
        callAmountBb: 5.5,
        heroStreetContributionBb: 2.5,
        potBb: 11.5,
        currentPotBb: 11.5,
        priorActionSummary: aggressionSummary('three_bet', 2),
      }),
      preflopObservation('AJs', 'facing_4bet', {
        lastAction: '4bet',
        facingSizeBb: 20,
        callAmountBb: 12,
        heroStreetContributionBb: 8,
        potBb: 31.5,
        currentPotBb: 31.5,
        priorActionSummary: aggressionSummary('four_bet_or_more', 3),
      }),
      preflopObservation('KQs', 'facing_3bet_kqs', {
        lastAction: '3bet',
        facingSizeBb: 8,
        callAmountBb: 5.5,
        heroStreetContributionBb: 2.5,
        potBb: 11.5,
        currentPotBb: 11.5,
        priorActionSummary: aggressionSummary('three_bet', 2),
      }),
      preflopObservation('QQ', 'facing_4bet_qq', {
        lastAction: '4bet',
        facingSizeBb: 20,
        callAmountBb: 12,
        heroStreetContributionBb: 8,
        potBb: 31.5,
        currentPotBb: 31.5,
        priorActionSummary: aggressionSummary('four_bet_or_more', 3),
      }),
      preflopObservation('AJs', 'bb_option', {
        heroPosition: 'BB',
        callAmountBb: 0,
        heroStreetContributionBb: 1,
        priorActionSummary: limpSummary(1),
      }),
      postflopObservation('post_ip'),
      postflopObservation('post_oop', {
        positionRelation: 'out_of_position',
        aggressorPositionRelation: 'out_of_position',
      }),
      postflopObservation('post_mixed', {
        tableSize: 3,
        opponentCount: 2,
        effectiveStackBb: null,
        effectiveStackByOpponent: [
          { position: 'SB', opponentStackBb: 20, effectiveStackBb: 20 },
          { position: 'BB', opponentStackBb: 80, effectiveStackBb: 40 },
        ],
        positionRelation: 'mixed',
        aggressorPositionRelation: 'out_of_position',
      }),
      postflopObservation('post_shallow', {
        heroStackBb: 8,
        effectiveStackBb: 8,
        effectiveStackByOpponent: [
          { position: 'BB', opponentStackBb: 8, effectiveStackBb: 8 },
        ],
        maxRaiseToBb: 8,
        allInToBb: 8,
      }),
      postflopObservation('post_medium'),
      postflopObservation('post_deep', {
        heroStackBb: 200,
        effectiveStackBb: 200,
        effectiveStackByOpponent: [
          { position: 'BB', opponentStackBb: 200, effectiveStackBb: 200 },
        ],
        maxRaiseToBb: 200,
        allInToBb: 200,
      }),
      postflopObservation('post_check', {
        lastAction: 'check',
        facingSizeBb: 0,
        callAmountBb: 0,
        priorActionSummary: {
          ...TOP_PAIR_FACING_BET.priorActionSummary,
          lastActionFamily: 'check',
          facingActionFamily: 'check',
          aggressionFamily: 'none',
          aggressionCount: 0,
          aggressorPosition: null,
        },
      }),
      postflopObservation('post_small_price', { facingSizeBb: 2, callAmountBb: 2 }),
      postflopObservation('post_medium_price', { facingSizeBb: 7, callAmountBb: 7 }),
      postflopObservation('post_large_price', { facingSizeBb: 20, callAmountBb: 20 }),
      postflopObservation('post_raise_illegal', {
        canRaise: false, minRaiseToBb: null, maxRaiseToBb: null,
      }),
      postflopObservation('post_short_all_in_only', {
        heroStackBb: 3,
        effectiveStackBb: 3,
        effectiveStackByOpponent: [
          { position: 'BB', opponentStackBb: 100, effectiveStackBb: 3 },
        ],
        canRaise: true,
        facingSizeBb: 2,
        callAmountBb: 2,
        minRaiseToBb: null,
        maxRaiseToBb: 3,
        allInToBb: 3,
      }),
      postflopObservation('post_current_pot_275', {
        stackBb: 500,
        potBb: 200,
        currentPotBb: 275,
        heroStackBb: 100,
        effectiveStackBb: 100,
        effectiveStackByOpponent: [
          { position: 'BB', opponentStackBb: 100, effectiveStackBb: 100 },
        ],
        facingSizeBb: 25,
        callAmountBb: 25,
      }),
  ];
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const deltas = Object.entries(STRATEGY_REPAIR001B_FROZEN_BASELINE.actionVectors)
    .map(([id, before]) => {
      const after = currentById.get(id)?.output.actionVector ?? null;
      const maximumActionDelta = after === null ? null : Math.max(
        ...Object.keys(before).map((type) => Math.abs(before[type] - after[type])),
      );
      return { id, before, after, maximumActionDelta };
    });
  return {
    schemaVersion: 'strategy-repair001b-diagnostics/v1',
    baseline: STRATEGY_REPAIR001B_FROZEN_BASELINE,
    currentRows,
    deltas,
  };
}

const isMain = process.argv[1]?.endsWith('strategy-repair001b-baseline.mjs');
if (isMain) {
  process.stdout.write(`${JSON.stringify(buildStrategyRepair001bBaseline(), null, 2)}\n`);
}
