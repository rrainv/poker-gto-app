import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { isStrategyResultV1 } from '../app/src/application/strategy-result.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  PREFLOP_HAND_CLASSES,
  calibrationDecisionContext,
  representativeCardsForClass,
} from './tooling/strategy-calibration-corpora.mjs';

const PREMIUM_HANDS = Object.freeze(['AA', 'KK', 'QQ', 'AKs', 'AKo']);
const STACKS_BB = Object.freeze([30, 100, 200]);
const FACING_CONTEXTS = Object.freeze({
  unopened: Object.freeze({
    lastAction: 'unopened', facingSizeBb: 0, callAmountBb: null,
    heroStreetContributionBb: null, potBb: 1.5,
  }),
  facing_open: Object.freeze({
    lastAction: 'raise', facingSizeBb: 2.5, callAmountBb: 1.5,
    heroStreetContributionBb: 1, potBb: 3.5,
  }),
  facing_3bet: Object.freeze({
    lastAction: '3bet', facingSizeBb: 8, callAmountBb: 5.5,
    heroStreetContributionBb: 2.5, potBb: 11.5,
  }),
  facing_4bet: Object.freeze({
    lastAction: '4bet', facingSizeBb: 20, callAmountBb: 12,
    heroStreetContributionBb: 8, potBb: 31.5,
  }),
});
const TABLE_POSITIONS = Object.freeze([
  Object.freeze({ tableSize: 2, positions: Object.freeze(['BTN', 'BB']) }),
  Object.freeze({ tableSize: 6, positions: Object.freeze(['UTG', 'BTN', 'SB', 'BB']) }),
  Object.freeze({ tableSize: 9, positions: Object.freeze(['UTG', 'BTN', 'SB', 'BB']) }),
]);

const provider = createStrategyProvider({
  fallbackResolver: (decisionContext) => resolveHeuristicStrategy(decisionContext),
});

function contextFor(handClass, overrides = {}) {
  return calibrationDecisionContext({
    heroCards: representativeCardsForClass(handClass),
    ...overrides,
  });
}

function probability(result, actionType) {
  return result.actions
    .filter((entry) => entry.action.type === actionType)
    .reduce((sum, entry) => sum + entry.probability, 0);
}

function resolve(handClass, overrides = {}) {
  return provider.resolve(contextFor(handClass, overrides));
}

function assertNormalized(result, message = '') {
  assert.ok(isStrategyResultV1(result), message);
  assert.equal(result.source, 'heuristic_preflop', message);
  assert.equal(result.actions.reduce((sum, entry) => sum + entry.probability, 0), 1, message);
}

test('PREFLOP-SANITY-001 makes AA Fold exactly zero across the supported premium corpus', () => {
  let rowCount = 0;
  for (const table of TABLE_POSITIONS) {
    for (const heroPosition of table.positions) {
      for (const stackBb of STACKS_BB) {
        for (const [facing, actionContext] of Object.entries(FACING_CONTEXTS)) {
          const freeOption = facing === 'unopened' && heroPosition === 'BB'
            ? { callAmountBb: 0, heroStreetContributionBb: 1 }
            : {};
          const result = resolve('AA', {
            tableSize: table.tableSize,
            opponentCount: table.tableSize - 1,
            heroPosition,
            stackBb,
            ...actionContext,
            ...freeOption,
          });
          const label = `${table.tableSize}-max ${heroPosition} ${stackBb}bb ${facing}`;
          assertNormalized(result, label);
          assert.equal(probability(result, 'fold'), 0, label);
          assert.equal(result.details.dominatedFoldSuppressionApplied, true, label);
          rowCount += 1;
        }
      }
    }
  }
  assert.equal(rowCount, 120);
});

test('unopened QQ+, AKs, and AKo suppress Fold without manufacturing non-blind calls', () => {
  for (const handClass of PREMIUM_HANDS) {
    for (const table of TABLE_POSITIONS) {
      for (const heroPosition of table.positions) {
        for (const stackBb of STACKS_BB) {
          const freeOption = heroPosition === 'BB'
            ? { callAmountBb: 0, heroStreetContributionBb: 1 }
            : {};
          const result = resolve(handClass, {
            tableSize: table.tableSize,
            opponentCount: table.tableSize - 1,
            heroPosition,
            stackBb,
            ...FACING_CONTEXTS.unopened,
            ...freeOption,
          });
          const label = `${handClass} ${table.tableSize}-max ${heroPosition} ${stackBb}bb`;
          assertNormalized(result, label);
          assert.equal(probability(result, 'fold'), 0, label);
          assert.equal(result.details.dominatedFoldSuppressionApplied, true, label);
          const isOpenOnlySeat = heroPosition !== 'SB'
            && heroPosition !== 'BB'
            && !(table.tableSize === 2 && heroPosition === 'BTN');
          if (isOpenOnlySeat) assert.equal(probability(result, 'call'), 0, label);
        }
      }
    }
  }
});

test('the free-BB option retains zero Fold for every 169 hand class', () => {
  assert.equal(PREFLOP_HAND_CLASSES.length, 169);
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const result = resolve(handClass, {
      tableSize: 6,
      opponentCount: 5,
      heroPosition: 'BB',
      stackBb: 100,
      ...FACING_CONTEXTS.unopened,
      callAmountBb: 0,
      heroStreetContributionBb: 1,
    });
    assertNormalized(result, handClass);
    assert.equal(probability(result, 'fold'), 0, handClass);
    assert.equal(probability(result, 'call'), 0, handClass);
    assert.ok(probability(result, 'check') > 0, handClass);
  }
});

test('KK, QQ, and AK retain severe-aggression Fold while non-premium boundaries remain mixed', () => {
  const severe = {
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'UTG',
    stackBb: 30,
    ...FACING_CONTEXTS.facing_4bet,
  };
  for (const handClass of ['KK', 'QQ', 'AKs', 'AKo']) {
    const result = resolve(handClass, severe);
    assert.ok(probability(result, 'fold') > 0, handClass);
    assert.equal(result.details.dominatedFoldSuppressionApplied, false, handClass);
  }

  const controls = [
    ['88', { heroPosition: 'UTG', ...FACING_CONTEXTS.unopened }],
    ['76s', { heroPosition: 'BTN', ...FACING_CONTEXTS.facing_3bet }],
    ['KQo', { heroPosition: 'UTG', ...FACING_CONTEXTS.unopened }],
  ];
  for (const [handClass, overrides] of controls) {
    const result = resolve(handClass, { tableSize: 6, opponentCount: 5, stackBb: 100, ...overrides });
    assert.ok(probability(result, 'fold') > 0 && probability(result, 'fold') < 1, handClass);
    assert.ok(probability(result, 'raise') > 0, handClass);
    assert.equal(result.details.dominatedFoldSuppressionApplied, false, handClass);
  }
  const trash = resolve('72o', {
    tableSize: 6, opponentCount: 5, heroPosition: 'UTG', stackBb: 100,
    ...FACING_CONTEXTS.unopened,
  });
  assert.equal(probability(trash, 'fold'), 1);
  assert.equal(trash.details.dominatedFoldSuppressionApplied, false);
});

test('suppressed distributions stay deterministic and trusted call-price semantics stay distinct', () => {
  const aaContext = contextFor('AA', {
    tableSize: 6, opponentCount: 5, heroPosition: 'BTN', stackBb: 100,
    ...FACING_CONTEXTS.facing_3bet,
  });
  assert.deepEqual(provider.resolve(aaContext), provider.resolve({ ...aaContext }));

  const base = {
    tableSize: 6, opponentCount: 5, heroPosition: 'BTN', stackBb: 100,
    lastAction: 'raise', facingSizeBb: 3, potBb: 8,
  };
  const cheap = resolve('KQo', { ...base, callAmountBb: 1 });
  const expensive = resolve('KQo', { ...base, callAmountBb: 5 });
  const samePriceDifferentNominal = resolve('KQo', {
    ...base, facingSizeBb: 9, callAmountBb: 1,
  });
  assert.notDeepEqual(cheap.actions, expensive.actions);
  assert.deepEqual(cheap.actions, samePriceDifferentNominal.actions);
  assert.equal(cheap.details.priceAdjustmentApplied, true);
});

test('the fix remains inside the DOM-free heuristic and all consumers retain StrategyProvider authority', () => {
  const preflopSource = fs.readFileSync(
    new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url),
    'utf8',
  );
  const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const trainingSource = fs.readFileSync(
    new URL('../app/src/application/training-generator.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(preflopSource, /document\.|window\.|globalThis\.|querySelector|localStorage/);
  assert.doesNotMatch(preflopSource, /solved GTO|solver-derived|\bCFR\b|\bNash\b/i);
  assert.match(logicSource, /strategyProvider\.resolve\(cellDecisionContext\)/);
  assert.doesNotMatch(logicSource, /calculatePreflopFallbackStrategy/);
  assert.match(trainingSource, /strategyProvider\.resolve\(decisionContext\)/);
  assert.doesNotMatch(trainingSource, /calculatePreflopFallbackStrategy/);
});
