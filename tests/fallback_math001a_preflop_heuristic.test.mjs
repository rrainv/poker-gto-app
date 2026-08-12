import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { isStrategyResultV1 } from '../app/src/application/strategy-result.mjs';
import {
  PREFLOP_FALLBACK_POSITION_MODIFIERS,
  calculatePreflopFallbackStrategy,
  calculatePreflopHeuristic,
} from '../app/src/strategy/preflop-heuristic.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';

const PREFLOP_SOURCE = fs.readFileSync(
  new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url),
  'utf8',
);
const TRAINING_ADAPTER_SOURCE = fs.readFileSync(
  new URL('../app/src/application/training-answer-evaluation.mjs', import.meta.url),
  'utf8',
);
const MATRIX_SOURCE = fs.readFileSync(
  new URL('../app/src/core/logic.js', import.meta.url),
  'utf8',
);

const RANKS = Object.freeze(['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']);
const NON_BLIND_POSITIONS = Object.freeze([
  'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN',
]);
const ALL_POSITIONS = Object.freeze([...NON_BLIND_POSITIONS, 'SB', 'BB']);

export const PREFLOP_PATHOLOGICAL_REGRESSION_CORPUS = Object.freeze([
  Object.freeze({ name: 'AJo', category: 'offsuit broadway' }),
  Object.freeze({ name: 'KQo', category: 'offsuit broadway' }),
  Object.freeze({ name: 'ATs', category: 'suited broadway' }),
  Object.freeze({ name: 'A5s', category: 'suited wheel Ace' }),
  Object.freeze({ name: '88', category: 'medium pocket pair' }),
  Object.freeze({ name: '55', category: 'low pocket pair' }),
  Object.freeze({ name: '22', category: 'lowest pocket pair' }),
  Object.freeze({ name: 'T9s', category: 'suited connector' }),
  Object.freeze({ name: '76s', category: 'low suited connector' }),
  Object.freeze({ name: '72o', category: 'trash offsuit' }),
]);

const HAND_CLASSES = Object.freeze(RANKS.flatMap((rowRank, row) => (
  RANKS.map((columnRank, column) => {
    if (row === column) return `${rowRank}${columnRank}`;
    if (row < column) return `${rowRank}${columnRank}s`;
    return `${columnRank}${rowRank}o`;
  })
)));

const provider = createStrategyProvider({
  fallbackResolver: (decisionContext) => resolveHeuristicStrategy(decisionContext),
});

function cardsForClass(handClass) {
  if (handClass.length === 2) return [`${handClass[0]}s`, `${handClass[1]}h`];
  if (handClass.endsWith('s')) return [`${handClass[0]}s`, `${handClass[1]}s`];
  return [`${handClass[0]}s`, `${handClass[1]}h`];
}

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 10,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Jh'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    callAmountBb: null,
    heroStreetContributionBb: null,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

function fallback(handClass, overrides = {}) {
  const pair = handClass.length === 2;
  const suited = handClass.endsWith('s');
  return calculatePreflopFallbackStrategy(
    handClass[0],
    handClass[1],
    pair,
    suited,
    overrides.heroPosition ?? 'BTN',
    overrides.lastAction ?? 'unopened',
    overrides.facingSizeBb ?? 0,
    overrides.potBb ?? 1.5,
    overrides.stackBb ?? 100,
    Object.hasOwn(overrides, 'callAmountBb') ? overrides.callAmountBb : null,
  );
}

function probability(result, actionType) {
  return result.actions
    .filter((entry) => entry.action.type === actionType)
    .reduce((sum, entry) => sum + entry.probability, 0);
}

function assertNormalizedResult(result, message = '') {
  assert.ok(isStrategyResultV1(result), message);
  assert.equal(result.source, 'heuristic_preflop', message);
  assert.equal(result.actions.reduce((sum, entry) => sum + entry.probability, 0), 1, message);
  for (const entry of result.actions) {
    assert.ok(Number.isFinite(entry.probability), message);
    assert.ok(entry.probability > 0 && entry.probability <= 1, message);
    assert.ok(entry.action.amountBb === null || (
      Number.isFinite(entry.action.amountBb) && entry.action.amountBb >= 0
    ), message);
  }
}

function maximumStrategyDelta(left, right) {
  return Math.max(...['open', 'call', 'fold'].map((key) => Math.abs(left[key] - right[key])));
}

test('FALLBACK-MATH-001A removes per-hand MDF, fake preflop SPR, and threshold patches', () => {
  assert.doesNotMatch(PREFLOP_SOURCE, /\bmdf\b|minimum defense|requiredDefense/i);
  assert.doesNotMatch(PREFLOP_SOURCE, /\bspr\b|stackToPot/i);
  assert.doesNotMatch(PREFLOP_SOURCE, /base\[0\]\s*>=\s*0\.25/);
  assert.doesNotMatch(PREFLOP_SOURCE, /base\s*=\s*\[0\.(?:2|35),\s*0\.(?:3|5)/);

  const cheapTrash = fallback('72o', {
    heroPosition: 'BB', lastAction: 'raise', facingSizeBb: 3,
    potBb: 20, stackBb: 100, callAmountBb: 1,
  });
  const rangeLevelMdf = 20 / 21;
  assert.ok(cheapTrash.open + cheapTrash.call < rangeLevelMdf * 0.25);
  assert.ok(cheapTrash.fold > 0.75);
});

test('all 169 Matrix classes resolve, normalize exactly, and remain deterministic', () => {
  assert.equal(HAND_CLASSES.length, 169);
  assert.equal(new Set(HAND_CLASSES).size, 169);
  for (const handClass of HAND_CLASSES) {
    const decisionContext = context({ heroCards: cardsForClass(handClass) });
    const first = provider.resolve(decisionContext);
    const second = provider.resolve(decisionContext);
    assertNormalizedResult(first, handClass);
    assert.deepEqual(second, first, handClass);
  }
  assert.match(MATRIX_SOURCE, /strategyProvider\.resolve\(cellDecisionContext\)/);
});

test('position, stack, facing-category, and price sweeps stay finite and normalized', () => {
  const sweep = [];
  for (const handClass of HAND_CLASSES) {
    const heroCards = cardsForClass(handClass);
    for (const heroPosition of ALL_POSITIONS) {
      sweep.push(context({ heroCards, heroPosition }));
    }
    for (const stackBb of [10, 30, 100, 300]) {
      sweep.push(context({ heroCards, stackBb }));
    }
    for (const actionContext of [
      { lastAction: 'unopened', facingSizeBb: 0, potBb: 1.5, callAmountBb: null },
      { lastAction: 'raise', facingSizeBb: 3, potBb: 4.5, callAmountBb: null },
      { lastAction: 'raise', facingSizeBb: 3, potBb: 4.5, callAmountBb: 2 },
      { lastAction: '3bet', facingSizeBb: 9, potBb: 13.5, callAmountBb: 6 },
      { lastAction: '4bet', facingSizeBb: 22, potBb: 34.5, callAmountBb: 13 },
    ]) {
      sweep.push(context({ heroCards, ...actionContext }));
    }
    for (const [facingSizeBb, callAmountBb] of [[2.5, 1.5], [3, 2], [6, 5], [12, 10]]) {
      sweep.push(context({
        heroCards, lastAction: 'raise', facingSizeBb, callAmountBb,
        potBb: 1.5 + facingSizeBb,
      }));
    }
  }

  for (const [index, decisionContext] of sweep.entries()) {
    const result = provider.resolve(decisionContext);
    assertNormalizedResult(result, `sweep ${index}`);
    for (const entry of result.actions) {
      if (entry.action.amountBb !== null) {
        assert.ok(entry.action.amountBb <= decisionContext.stackBb, `sweep ${index}`);
      }
    }
  }
});

test('non-blind unopened aggression is monotonic by position for every hand class', () => {
  for (const handClass of HAND_CLASSES) {
    const strategies = NON_BLIND_POSITIONS.map((heroPosition) => fallback(handClass, { heroPosition }));
    for (let index = 1; index < strategies.length; index += 1) {
      assert.ok(
        strategies[index].open + 1e-12 >= strategies[index - 1].open,
        `${handClass}: ${NON_BLIND_POSITIONS[index - 1]} -> ${NON_BLIND_POSITIONS[index]}`,
      );
      assert.ok(strategies[index].fold <= strategies[index - 1].fold + 1e-12);
    }
  }

  const unsupported = fallback('T8s', { heroPosition: 'unsupported-seat' });
  assert.deepEqual(unsupported, fallback('T8s', { heroPosition: 'UTG' }));
  assert.ok(PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG < PREFLOP_FALLBACK_POSITION_MODIFIERS.BTN);
});

test('stack-depth and known-price effects are smooth and use truthful inputs', () => {
  const shortHighCards = fallback('AKo', { heroPosition: 'UTG', stackBb: 10 });
  const standardHighCards = fallback('AKo', { heroPosition: 'UTG', stackBb: 100 });
  const shortConnector = fallback('76s', { heroPosition: 'UTG', stackBb: 10 });
  const deepConnector = fallback('76s', { heroPosition: 'UTG', stackBb: 300 });
  assert.ok(shortHighCards.open >= standardHighCards.open);
  assert.ok(deepConnector.open > shortConnector.open);

  for (const handClass of HAND_CLASSES) {
    for (const boundary of [10, 50, 100, 300]) {
      const below = fallback(handClass, { stackBb: boundary - 0.001 });
      const above = fallback(handClass, { stackBb: boundary + 0.001 });
      assert.ok(maximumStrategyDelta(below, above) < 0.001, `${handClass} stack ${boundary}`);
    }
  }

  const fixedNominal = {
    heroPosition: 'BTN', lastAction: 'raise', facingSizeBb: 3, potBb: 8, stackBb: 100,
  };
  const priceBelow = fallback('KQo', { ...fixedNominal, callAmountBb: 1.999 });
  const priceAbove = fallback('KQo', { ...fixedNominal, callAmountBb: 2.001 });
  assert.ok(maximumStrategyDelta(priceBelow, priceAbove) < 0.001);

  const nominalBelow = fallback('KQo', { ...fixedNominal, facingSizeBb: 2.999, callAmountBb: 2 });
  const nominalAbove = fallback('KQo', { ...fixedNominal, facingSizeBb: 3.001, callAmountBb: 2 });
  assert.deepEqual(nominalAbove, nominalBelow);

  const unknownPrice = calculatePreflopHeuristic(context({
    heroCards: ['Ks', 'Qh'], lastAction: 'raise', facingSizeBb: 3,
    potBb: 4.5, callAmountBb: null,
  }));
  assert.equal(unknownPrice.details.callPriceAvailable, false);
  assert.equal(unknownPrice.details.priceAdjustmentApplied, false);
});

test('named pathological corpus obeys qualitative strength and continuity invariants', () => {
  for (const fixture of PREFLOP_PATHOLOGICAL_REGRESSION_CORPUS) {
    const strategy = fallback(fixture.name);
    assert.equal(strategy.open + strategy.call + strategy.fold, 1, fixture.name);
    assert.ok(Object.values(strategy).every(Number.isFinite), fixture.name);
  }

  const ajoByPosition = NON_BLIND_POSITIONS.map((heroPosition) => (
    fallback('AJo', { heroPosition })
  ));
  assert.ok(ajoByPosition[0].open > 0.1);
  assert.ok(ajoByPosition[0].fold < 0.9);
  for (let index = 1; index < ajoByPosition.length; index += 1) {
    assert.ok(Math.abs(ajoByPosition[index].open - ajoByPosition[index - 1].open) < 0.2);
  }

  assert.ok(fallback('AJo', { heroPosition: 'UTG' }).open
    >= fallback('ATo', { heroPosition: 'UTG' }).open);
  assert.ok(fallback('KQo', { heroPosition: 'UTG' }).open
    >= fallback('KJo', { heroPosition: 'UTG' }).open);

  for (const actionContext of [
    { lastAction: 'unopened', facingSizeBb: 0, potBb: 1.5, callAmountBb: null },
    { lastAction: 'raise', facingSizeBb: 3, potBb: 4.5, callAmountBb: 2 },
    { lastAction: '3bet', facingSizeBb: 9, potBb: 13.5, callAmountBb: 6 },
    { lastAction: '4bet', facingSizeBb: 22, potBb: 34.5, callAmountBb: 13 },
  ]) {
    const aces = fallback('AA', { heroPosition: 'BTN', ...actionContext });
    assert.ok(aces.fold < 0.2);
    const trash = fallback('72o', { heroPosition: 'UTG', stackBb: 100, ...actionContext });
    assert.ok(trash.open < 0.2);
  }
});

test('structured preflop action types and amount-to sizing follow action context', () => {
  const unopened = provider.resolve(context({ heroCards: ['As', 'Ah'] }));
  const open = unopened.actions.find((entry) => entry.action.type === 'raise');
  assert.equal(open.label, 'Open');
  assert.ok(open.action.amountBb >= 2 && open.action.amountBb <= 100);

  for (const [lastAction, facingSizeBb, label] of [
    ['raise', 3, '3-Bet'],
    ['3bet', 9, '4-Bet'],
    ['4bet', 22, 'Raise'],
  ]) {
    const result = provider.resolve(context({
      heroCards: ['As', 'Ah'], lastAction, facingSizeBb,
      potBb: facingSizeBb + 1.5, callAmountBb: null,
    }));
    const aggression = result.actions.find((entry) => entry.action.type === 'raise');
    assert.equal(aggression.label, label);
    assert.equal(aggression.action.amountBb, null);
  }

  const shortOpen = provider.resolve(context({ heroCards: ['As', 'Ah'], stackBb: 10 }));
  const shortRaise = shortOpen.actions.find((entry) => entry.action.type === 'raise');
  assert.ok(shortRaise.action.amountBb >= 2 && shortRaise.action.amountBb <= 10);

  const bigBlind = provider.resolve(context({
    heroPosition: 'BB', heroCards: ['7s', '2h'], callAmountBb: 0,
  }));
  assert.equal(probability(bigBlind, 'check'), 1);
  assert.equal(probability(bigBlind, 'call'), 0);
  assert.equal(probability(bigBlind, 'fold'), 0);

  const smallBlind = provider.resolve(context({ heroPosition: 'SB', heroCards: ['Ts', '9s'] }));
  const limp = smallBlind.actions.find((entry) => entry.action.type === 'call');
  assert.equal(limp.label, 'Limp');
  assert.doesNotMatch(TRAINING_ADAPTER_SOURCE, /BB legacy|passive `call` bucket/);
});

test('Home/ClubGG and style controls remain honestly neutral in preflop fallback', () => {
  const home = context();
  const club = context({
    rakeMode: 'fixed',
    forcedContributionPerPlayerBb: 0.1,
    totalForcedContributionBb: 1,
  });
  const homeCandidate = resolveHeuristicStrategy(home, { playStyle: 0, opponentStyle: 0 });
  const clubCandidate = resolveHeuristicStrategy(club, { playStyle: 0, opponentStyle: 0 });
  assert.deepEqual(clubCandidate.actions, homeCandidate.actions);
  assert.equal(clubCandidate.details.forcedContributionAdjustmentApplied, false);

  const styled = resolveHeuristicStrategy(home, { playStyle: 1, opponentStyle: 1 });
  assert.deepEqual(styled.actions, homeCandidate.actions);
  assert.equal(styled.details.styleControlsApplied, false);
});

test('preflop resolution does not depend on DecisionContext insertion order', () => {
  const ordered = context({
    heroCards: ['As', '5s'], lastAction: '3bet', facingSizeBb: 9,
    potBb: 13.5, callAmountBb: 6, heroStreetContributionBb: 3,
  });
  const reversed = Object.fromEntries(Object.entries(ordered).reverse());
  assert.deepEqual(provider.resolve(reversed), provider.resolve(ordered));
});

test('range-level summaries remain ordered without being labeled as solved ranges', () => {
  const summaries = NON_BLIND_POSITIONS.map((heroPosition) => {
    const strategies = HAND_CLASSES.map((handClass) => fallback(handClass, { heroPosition }));
    return {
      heroPosition,
      averageAggression: strategies.reduce((sum, strategy) => sum + strategy.open, 0) / 169,
      averageContinue: strategies.reduce(
        (sum, strategy) => sum + strategy.open + strategy.call,
        0,
      ) / 169,
      nearPureFolds: strategies.filter((strategy) => strategy.fold >= 0.95).length,
      nearPureAggression: strategies.filter((strategy) => strategy.open >= 0.95).length,
    };
  });
  for (let index = 1; index < summaries.length; index += 1) {
    assert.ok(summaries[index].averageAggression >= summaries[index - 1].averageAggression);
    assert.ok(summaries[index].averageContinue >= summaries[index - 1].averageContinue);
  }
  assert.ok(summaries[0].averageAggression < summaries.at(-1).averageAggression);
  assert.doesNotMatch(PREFLOP_SOURCE, /solved GTO|solver-derived|Nash/i);
});
