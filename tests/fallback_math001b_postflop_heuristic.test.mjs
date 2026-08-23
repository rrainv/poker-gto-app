import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { evaluateSeven } from '../shared/poker-domain/evaluator.js';
import {
  createStrategyResult,
  isStrategyResultV1,
} from '../app/src/application/strategy-result.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import {
  createDeterministicHeuristicRng,
  resolveHeuristicStrategy,
} from '../app/src/strategy/heuristic-strategy.mjs';
import {
  POSTFLOP_HEURISTIC_SAMPLES,
  calculatePostflopStrategyFromSample,
  simulateHeuristicEquity,
} from '../app/src/strategy/postflop-heuristic.mjs';
import {
  evaluatePostflopHandStrength,
  scoreHeuristicSeven,
} from '../app/src/strategy/heuristic-evaluator.mjs';

const POSTFLOP_SOURCE = fs.readFileSync(
  new URL('../app/src/strategy/postflop-heuristic.mjs', import.meta.url),
  'utf8',
);
const RESOLVER_SOURCE = fs.readFileSync(
  new URL('../app/src/strategy/heuristic-strategy.mjs', import.meta.url),
  'utf8',
);
const LOGIC_SOURCE = fs.readFileSync(
  new URL('../app/src/core/logic.js', import.meta.url),
  'utf8',
);

function context(overrides = {}) {
  const board = overrides.board ?? ['2c', '7d', 'Th'];
  const stackBb = overrides.stackBb ?? 100;
  const potBb = overrides.potBb ?? 10;
  const opponentCount = overrides.opponentCount ?? 1;
  const lastAction = overrides.lastAction ?? 'check';
  const aggressionFamily = ['bet', 'raise'].includes(lastAction) ? lastAction : 'none';
  return {
    schemaVersion: 'decision-context/v1',
    contractVersion: 'decision-context/v1.1',
    tableSize: 2,
    opponentCount,
    heroPosition: 'BTN',
    street: board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river',
    heroCards: ['As', 'Kd'],
    board,
    deadCards: [],
    stackBb,
    stackMode: 'hero',
    startingStackBb: stackBb,
    heroStackBb: stackBb,
    effectiveStackBb: opponentCount === 1 ? stackBb : null,
    effectiveStackByOpponent: opponentCount === 1
      ? [{ position: 'BB', opponentStackBb: stackBb, effectiveStackBb: stackBb }]
      : [],
    potBb,
    currentPotBb: overrides.currentPotBb ?? potBb,
    positionRelation: 'unknown',
    aggressorPositionRelation: 'unknown',
    lastAction,
    priorActionSummary: {
      lastActionFamily: lastAction,
      lastActorPosition: null,
      facingActionFamily: aggressionFamily,
      aggressionFamily,
      aggressionCount: aggressionFamily === 'none' ? 0 : 1,
      limperCount: null,
      aggressorPosition: null,
    },
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: 0,
    canRaise: true,
    minRaiseToBb: 2,
    maxRaiseToBb: stackBb,
    allInToBb: stackBb,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

function options(overrides = {}) {
  return { playStyle: 0, opponentStyle: 0, flatDropBb: 0, ...overrides };
}

function resolvedResult(decisionContext, heuristicOptions = options()) {
  return createStrategyResult(resolveHeuristicStrategy(decisionContext, heuristicOptions));
}

function actionPercent(strategy, name) {
  return Number(strategy[name] || 0);
}

test('postflop fallback stays isolated from canonical Equity and labels its assumed sample honestly', () => {
  assert.doesNotMatch(POSTFLOP_SOURCE, /poker-domain\/equity|equity-request\/v1/);
  assert.doesNotMatch(POSTFLOP_SOURCE + RESOLVER_SOURCE, /Math\.random\s*\(/);
  assert.doesNotMatch(RESOLVER_SOURCE, /Top 15%|Top 25%|Top 40%/);
  assert.match(POSTFLOP_SOURCE, /heuristic_conditional_sample/);
  assert.match(POSTFLOP_SOURCE, /1 \/ winnerIndexes\.length/);
  assert.doesNotMatch(POSTFLOP_SOURCE, /ties\s*\/\s*2|attempts\s*<\s*20/i);
  assert.doesNotMatch(LOGIC_SOURCE, /function evaluatePostflopHand\(/);
});

test('Hero receives exact heads-up, three-way, four-way, and larger split shares', () => {
  const board = ['As', 'Ks', 'Qs', 'Js', 'Ts'];
  const heroCards = ['2c', '3d'];
  for (const [opponentCount, expected] of [[1, 1 / 2], [2, 1 / 3], [3, 1 / 4], [5, 1 / 6]]) {
    const result = simulateHeuristicEquity({
      heroCards,
      board,
      deadCards: [],
      tableSize: opponentCount + 1,
      opponentCount,
      facingSizeBb: 0,
      lastAction: 'check',
      opponentStyle: 0,
      iterations: 5,
      rng: () => 0.5,
    });
    assert.equal(result.eq, expected);
    assert.equal(result.completedSamples, 5);
    assert.equal(result.splitPotTrials, 5);
  }
});

test('every counted trial allocates all opponents without duplicates or dead/runout conflicts', () => {
  const decisionContext = context({
    tableSize: 7,
    opponentCount: 6,
    heroCards: ['Ah', 'Kd'],
    board: ['2c', '7d', 'Th'],
    deadCards: ['Ac', 'Kc', 'Qh', 'Jd'],
  });
  const observed = [];
  const result = simulateHeuristicEquity({
    ...decisionContext,
    opponentStyle: 0.5,
    iterations: 30,
    rng: createDeterministicHeuristicRng(decisionContext, options({ opponentStyle: 0.5 })),
    observeTrial: (trial) => observed.push(trial),
  });

  assert.equal(result.requestedSamples, 30);
  assert.equal(result.completedSamples, 30);
  assert.ok(result.attemptedSamples >= result.completedSamples);
  assert.equal(observed.length, 30);
  for (const trial of observed) {
    assert.equal(trial.opponentHands.length, 6);
    assert.ok(trial.opponentHands.every((hand) => hand.length === 2));
    const physicalCards = [
      ...trial.heroCards,
      ...trial.opponentHands.flat(),
      ...trial.board,
    ];
    assert.equal(new Set(physicalCards).size, physicalCards.length);
    for (const deadCard of trial.deadCards) {
      assert.equal(trial.opponentHands.flat().includes(deadCard), false);
      assert.equal(trial.board.includes(deadCard), false);
      assert.equal(trial.runout.includes(deadCard), false);
    }
  }
});

test('same inputs/options are deterministic, calls are independent, and looser style widens the real range population', () => {
  const decisionContext = context({ tableSize: 3, opponentCount: 2 });
  const input = {
    ...decisionContext,
    iterations: 40,
    facingSizeBb: 4,
    lastAction: 'bet',
  };
  const firstOptions = options({ opponentStyle: 0.25 });
  const first = simulateHeuristicEquity({
    ...input,
    opponentStyle: firstOptions.opponentStyle,
    rng: createDeterministicHeuristicRng(decisionContext, firstOptions),
  });
  simulateHeuristicEquity({
    ...input,
    heroCards: ['Qh', 'Qd'],
    opponentStyle: 1,
    rng: createDeterministicHeuristicRng({ ...decisionContext, heroCards: ['Qh', 'Qd'] }, options({ opponentStyle: 1 })),
  });
  const repeated = simulateHeuristicEquity({
    ...input,
    opponentStyle: firstOptions.opponentStyle,
    rng: createDeterministicHeuristicRng(decisionContext, firstOptions),
  });
  assert.deepEqual(repeated, first);

  const tight = simulateHeuristicEquity({
    ...input, opponentStyle: 0, iterations: 1,
    rng: createDeterministicHeuristicRng(decisionContext, options({ opponentStyle: 0 })),
  });
  const loose = simulateHeuristicEquity({
    ...input, opponentStyle: 1, iterations: 1,
    rng: createDeterministicHeuristicRng(decisionContext, options({ opponentStyle: 1 })),
  });
  assert.ok(loose.rangeComboCount > tight.rangeComboCount);
  assert.ok(loose.rangeFraction > tight.rangeFraction);
  assert.equal(loose.rangeDistribution, 'uniform_over_selected_legal_combos');
  assert.equal(loose.sharedRangeAssumption, true);
});

test('sampled final ordering is exactly the canonical evaluator ordering', () => {
  const fixtures = [
    ['As', '2d', '3c', '4h', '5s', 'Kd', 'Qd'],
    ['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d'],
    ['7s', '7d', '7c', '7h', 'Ks', '2d', '3c'],
  ];
  for (const cards of fixtures) {
    assert.equal(scoreHeuristicSeven(cards), evaluateSeven(cards).score);
  }
});

test('made-hand and draw classifier handles wheel, straight/flush draws, pairs, sets, trips, boats, and quads', () => {
  const fixtures = [
    [['As', '2d'], ['3c', '4h', '5s'], { madeHand: 'straight', canonical: 'straight' }],
    [['8s', '9d'], ['6c', '7h', 'Ks'], { oesd: true }],
    [['9s', 'Td'], ['7c', 'Jh', 'As'], { gutshot: true }],
    [['As', '5s'], ['2s', '9s', 'Kd'], { flushDraw: true, nutFlushDraw: true }],
    [['Qs', '5s'], ['2s', '9s', 'Kd'], { flushDraw: true, nutFlushDraw: false }],
    [['As', '5s'], ['2s', '9s', 'Ks'], { madeHand: 'flush', madeFlush: true }],
    [['Qh', 'Jd'], ['7s', '7d', 'Kc'], { madeHand: 'board_pair', paired: true, strategic: 'air' }],
    [['As', 'Ad'], ['Kc', '7d', '2h'], { madeHand: 'overpair' }],
    [['As', 'Kd'], ['Ah', '7d', '2c'], { madeHand: 'top_pair' }],
    [['Ks', 'Qd'], ['Ah', 'Kc', '7d'], { madeHand: 'middle_pair' }],
    [['7s', '6d'], ['Ah', 'Kc', '7d'], { madeHand: 'bottom_pair' }],
    [['5s', '5d'], ['Ah', 'Kc', '7d'], { madeHand: 'weak_pair' }],
    [['As', 'Kd'], ['Ah', 'Kc', '2d'], { madeHand: 'two_pair' }],
    [['7s', '7d'], ['7c', 'Kh', '2s'], { madeHand: 'set', tripsType: 'set' }],
    [['As', '7s'], ['7d', '7c', 'Kh'], { madeHand: 'trips', tripsType: 'trips' }],
    [['7s', '7d'], ['7c', 'Kh', 'Kd'], { madeHand: 'full_house' }],
    [['7s', '7d'], ['7c', '7h', 'Ks'], { madeHand: 'quads' }],
  ];
  for (const [heroCards, board, expected] of fixtures) {
    const result = evaluatePostflopHandStrength(heroCards, board);
    if (expected.madeHand) assert.equal(result.madeHand, expected.madeHand);
    if (expected.canonical) assert.equal(result.canonicalRank.category, expected.canonical);
    if (expected.strategic) assert.equal(result.strategicCategory, expected.strategic);
    if (expected.tripsType) assert.equal(result.tripsType, expected.tripsType);
    if (expected.paired !== undefined) assert.equal(result.isBoardPaired, expected.paired);
    if (expected.oesd !== undefined) assert.equal(result.drawFeatures.isOESD, expected.oesd);
    if (expected.gutshot !== undefined) assert.equal(result.drawFeatures.isGutshot, expected.gutshot);
    if (expected.flushDraw !== undefined) assert.equal(result.drawFeatures.flushDraw, expected.flushDraw);
    if (expected.nutFlushDraw !== undefined) assert.equal(result.drawFeatures.nutFlushDraw, expected.nutFlushDraw);
    if (expected.madeFlush !== undefined) assert.equal(result.drawFeatures.madeFlush, expected.madeFlush);
  }

  const boardRoyal = evaluatePostflopHandStrength(
    ['2c', '3d'],
    ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  );
  assert.equal(boardRoyal.playsBoard, true);
  assert.equal(boardRoyal.madeHand, 'board_straight_flush');
  assert.equal(boardRoyal.strategicCategory, 'air');
});

test('one resolved sample drives strategy copy, details, and AnalysisExplanation', () => {
  const decisionContext = context({ tableSize: 3, opponentCount: 2 });
  const candidate = resolveHeuristicStrategy(decisionContext, options({ opponentStyle: 0.4 }));
  const result = createStrategyResult(candidate);
  const sample = result.details.heuristicSample;
  assert.equal(sample.provenance, 'heuristic_conditional_sample');
  assert.equal(sample.requestedSamples, POSTFLOP_HEURISTIC_SAMPLES);
  assert.equal(sample.completedSamples, POSTFLOP_HEURISTIC_SAMPLES);
  assert.match(result.explanation, new RegExp(`${(sample.eq * 100).toFixed(1)}%`));
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: result,
    authority: 'scenario',
  });
  const sampleSection = explanation.sections.find((section) => section.key === 'heuristic_sample');
  assert.equal(
    sampleSection.facts.find((fact) => fact.key === 'heuristic_sampled_equity').value,
    sample.eq,
  );
  assert.ok(explanation.warnings.some((warning) => warning.code === 'heuristic_conditional_sample'));
  assert.doesNotMatch(JSON.stringify(sampleSection), /canonical Equity result/i);
});

test('Scenario uses an explicitly disclosed seated-table approximation when live count is unavailable', () => {
  const scenario = context({ tableSize: 6, opponentCount: null });
  const result = resolvedResult(scenario);
  assert.equal(result.details.heuristicSample.opponentCount, 5);
  assert.equal(result.details.heuristicSample.opponentCountSource, 'table_size_approximation');
});

test('price, action-family, sizing, MDF, and flat-drop semantics stay structurally honest', () => {
  const free = calculatePostflopStrategyFromSample(
    context({ lastAction: 'bet', facingSizeBb: 5, callAmountBb: 0 }),
    options(),
    { eq: 0.5 },
  );
  assert.deepEqual(Object.keys(free).filter((key) => key !== 'context').sort(), ['Bet', 'Check']);
  assert.equal(free.context.facesWager, false);

  assert.throws(
    () => calculatePostflopStrategyFromSample(
      context({ lastAction: 'raise', facingSizeBb: 8, callAmountBb: null }),
      options(),
      { eq: 0.5 },
    ),
    /requires exact callAmountBb and currentPotBb/,
  );

  const priced = calculatePostflopStrategyFromSample(
    context({ lastAction: 'bet', facingSizeBb: 5, callAmountBb: 5, potBb: 5 }),
    options(),
    { eq: 0.5 },
  );
  assert.equal(priced.context.requiredRawEquity, 0.5);
  assert.equal(priced.context.priceDependentAdjustmentApplied, true);

  const withDrop = calculatePostflopStrategyFromSample(context(), options({ flatDropBb: 2 }), { eq: 0.5 });
  const withoutDrop = calculatePostflopStrategyFromSample(context(), options(), { eq: 0.5 });
  assert.deepEqual(
    Object.fromEntries(Object.entries(withDrop).filter(([key]) => key !== 'context')),
    Object.fromEntries(Object.entries(withoutDrop).filter(([key]) => key !== 'context')),
  );
  assert.equal(withDrop.context.flatDropApplied, false);
  assert.equal(withDrop.context.flatDropBbIgnored, 2);
  assert.doesNotMatch(POSTFLOP_SOURCE, /\bmdf\b|minimum defen[cs]e|requiredDefense/i);

  const result = resolvedResult(context({ lastAction: 'raise', facingSizeBb: 8, callAmountBb: null }));
  assert.equal(result.source, 'unavailable');
  assert.deepEqual(result.actions, []);
  assert.equal(result.recommendation, null);
  assert.equal(result.contextCoverage.kind, 'unsupported');
  assert.equal(result.contextCoverage.basis, 'missing_trusted_decision_economics');
  assert.deepEqual(result.contextCoverage.limitationCodes, [
    'heuristic_exact_call_price_unavailable',
  ]);
});

test('small sampled-strength changes around heuristic boundaries cannot cause extreme strategy jumps', () => {
  const decisionContext = context({
    heroCards: ['8h', '3d'],
    board: ['As', 'Kd', '2c'],
    lastAction: 'bet',
    facingSizeBb: 5,
    callAmountBb: 5,
    potBb: 5,
  });
  const below = calculatePostflopStrategyFromSample(decisionContext, options(), { eq: 0.499 });
  const above = calculatePostflopStrategyFromSample(decisionContext, options(), { eq: 0.501 });
  const actionNames = ['Raise', 'Call', 'Fold'];
  const largestJump = Math.max(...actionNames.map((name) => (
    Math.abs(actionPercent(above, name) - actionPercent(below, name))
  )));
  assert.ok(largestJump < 2, `largest 0.2-point equity boundary jump was ${largestJump}`);
  assert.equal(actionNames.reduce((sum, name) => sum + actionPercent(below, name), 0), 100);
  assert.equal(actionNames.reduce((sum, name) => sum + actionPercent(above, name), 0), 100);
});

const PATHOLOGICAL_POSTFLOP_CORPUS = Object.freeze([
  ['nut made hand', { heroCards: ['As', 'Ks'], board: ['Qs', 'Js', 'Ts'] }],
  ['overpair', { heroCards: ['As', 'Ad'], board: ['Kc', '7d', '2h'] }],
  ['top pair', { heroCards: ['As', 'Kd'], board: ['Ah', '7d', '2c'] }],
  ['middle pair', { heroCards: ['Ks', 'Qd'], board: ['Ah', 'Kc', '7d'] }],
  ['weak pair', { heroCards: ['5s', '5d'], board: ['Ah', 'Kc', '7d'] }],
  ['nut flush draw', { heroCards: ['As', '5s'], board: ['2s', '9s', 'Kd'] }],
  ['non-nut flush draw', { heroCards: ['Qs', '5s'], board: ['2s', '9s', 'Kd'] }],
  ['OESD', { heroCards: ['8s', '9d'], board: ['6c', '7h', 'Ks'] }],
  ['gutshot', { heroCards: ['9s', 'Td'], board: ['7c', 'Jh', 'As'] }],
  ['overcards and air', { heroCards: ['Qh', 'Jd'], board: ['As', '7c', '2d'] }],
  ['paired board', { heroCards: ['Qh', 'Jd'], board: ['7s', '7d', 'Kc'] }],
  ['monotone board', { heroCards: ['Ah', 'Kd'], board: ['2s', '7s', 'Ts'] }],
  ['coordinated board', { heroCards: ['Ah', 'Kd'], board: ['9s', '8d', '7c'] }],
  ['dry board', { heroCards: ['Ah', 'Kd'], board: ['Qs', '7d', '2c'] }],
  ['facing small bet', { lastAction: 'bet', facingSizeBb: 2, callAmountBb: 2, potBb: 10 }],
  ['facing large bet', { lastAction: 'bet', facingSizeBb: 15, callAmountBb: 15, potBb: 10 }],
  ['facing raise', { lastAction: 'raise', facingSizeBb: 18, callAmountBb: 10, potBb: 20 }],
  ['short stack', { stackBb: 10, potBb: 8 }],
  ['deep stack', { stackBb: 300, potBb: 8 }],
  ['heads-up', { tableSize: 2, opponentCount: 1 }],
  ['three-way', { tableSize: 3, opponentCount: 2 }],
  ['six-way', { tableSize: 6, opponentCount: 5 }],
]);

test('named pathological postflop corpus preserves mathematical and structural invariants', () => {
  for (const [name, overrides] of PATHOLOGICAL_POSTFLOP_CORPUS) {
    const decisionContext = context(overrides);
    const result = resolvedResult(decisionContext, options({ playStyle: 0.4, opponentStyle: 0.4 }));
    assert.ok(isStrategyResultV1(result), name);
    assert.equal(result.actions.reduce((sum, entry) => sum + entry.probability, 0), 1, name);
    assert.ok(result.actions.every((entry) => Number.isFinite(entry.probability) && entry.probability > 0), name);
    assert.ok(result.details.sampledEquity >= 0 && result.details.sampledEquity <= 1, name);
    assert.equal(result.details.heuristicSample.completedSamples, POSTFLOP_HEURISTIC_SAMPLES, name);
    assert.equal(result.details.heuristicSample.opponentCount, decisionContext.opponentCount, name);
    const allowed = result.details.facesWager
      ? new Set(['fold', 'call', 'raise'])
      : new Set(['check', 'bet']);
    assert.ok(result.actions.every((entry) => allowed.has(entry.action.type)), name);
  }
});
