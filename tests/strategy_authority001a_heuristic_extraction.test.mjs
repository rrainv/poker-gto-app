import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installStrategyProviderBridge } from '../app/src/application/strategy-provider-bootstrap.mjs';
import {
  createDeterministicHeuristicRng,
  normalizeHeuristicOptions,
  resolveHeuristicStrategy,
} from '../app/src/strategy/heuristic-strategy.mjs';
import { calculatePreflopFallbackStrategy } from '../app/src/strategy/preflop-heuristic.mjs';
import { calculatePostflopStrategyFromSample } from '../app/src/strategy/postflop-heuristic.mjs';

const strategySources = [
  'heuristic-strategy.mjs',
  'preflop-heuristic.mjs',
  'postflop-heuristic.mjs',
  'heuristic-evaluator.mjs',
].map((name) => fs.readFileSync(
  new URL(`../app/src/strategy/${name}`, import.meta.url),
  'utf8',
));

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Ks'],
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

test('extracted heuristic modules are DOM-free and do not mutate global randomness', () => {
  for (const source of strategySources) {
    assert.doesNotMatch(source, /\b(?:document|window|querySelector|selectedValue|numericValue)\b/);
    assert.doesNotMatch(source, /\bapp\.settings\b|\bwindow\.app\b/);
    assert.doesNotMatch(source, /Math\.random\s*=/);
  }
  assert.match(strategySources[3], /shared\/poker-domain\/evaluator\.js/);
  assert.doesNotMatch(strategySources[3], /poker-domain\/equity\.js/);

  const originalRandom = Math.random;
  resolveHeuristicStrategy(context({
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', '9h'],
    potBb: 10,
    stackBb: 30,
  }));
  assert.equal(Math.random, originalRandom);
});

test('explicit heuristic options normalize without changing their established semantics', () => {
  assert.deepEqual(normalizeHeuristicOptions(), {
    playStyle: 0,
    opponentStyle: 0,
    flatDropBb: 0,
  });
  assert.deepEqual(normalizeHeuristicOptions({
    playStyle: 2,
    opponentStyle: -1,
    flatDropBb: 1.5,
  }), {
    playStyle: 1,
    opponentStyle: 0,
    flatDropBb: 1.5,
  });
});

test('preflop characterization survives extraction across action and stack contexts', () => {
  const fixtures = [
    {
      args: ['A', 'K', false, true, 'BTN', 'unopened', 0, 1.5, 100, null],
      assertStrategy(strategy) {
        assert.ok(strategy.open >= 0.9);
        assert.equal(strategy.call, 0);
      },
    },
    {
      args: ['A', 'J', false, false, 'BTN', 'raise', 3, 4.5, 100, null],
      assertStrategy(strategy) {
        assert.ok(strategy.open + strategy.call >= 0.8);
      },
    },
    {
      args: ['7', '2', false, false, 'BB', 'unopened', 0, 1.5, 100, 0],
      assertStrategy(strategy) {
        assert.deepEqual(strategy, { open: 0, call: 1, fold: 0 });
      },
    },
    {
      args: ['T', '9', false, true, 'BTN', 'unopened', 0, 1.5, 10, null],
      assertStrategy(strategy) {
        assert.ok(strategy.open >= 0.85);
        assert.equal(strategy.call, 0);
      },
    },
    {
      args: ['7', '6', false, true, 'BTN', 'unopened', 0, 1.5, 300, null],
      assertStrategy(strategy) {
        assert.ok(strategy.open >= 0.8);
        assert.equal(strategy.call, 0);
      },
    },
  ];
  for (const fixture of fixtures) {
    const actual = calculatePreflopFallbackStrategy(...fixture.args);
    assert.ok(Object.values(actual).every((value) => Number.isFinite(value) && value >= 0));
    assert.equal(actual.open + actual.call + actual.fold, 1);
    fixture.assertStrategy(actual);
  }
});

test('postflop classifier remains qualitative while thresholds are continuous and flat drop is ignored', () => {
  const base = context({
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', '9h'],
    potBb: 10,
    stackBb: 30,
    lastAction: 'check',
    callAmountBb: 0,
  });
  const options = { playStyle: 0, opponentStyle: 0, flatDropBb: 0 };
  const pair = calculatePostflopStrategyFromSample(
    { ...base, heroCards: ['Ah', 'Kd'], board: ['As', '7d', '2c'] },
    options,
    { eq: 0.48, pct: 0.15 },
  );
  const draw = calculatePostflopStrategyFromSample(
    { ...base, heroCards: ['As', 'Ks'], board: ['Qs', 'Js', '2c'] },
    options,
    { eq: 0.48, pct: 0.15 },
  );
  const air = calculatePostflopStrategyFromSample(
    { ...base, heroCards: ['8h', '3d'], board: ['As', 'Kd', '2c'] },
    options,
    { eq: 0.2, pct: 0.15 },
  );
  const withDrop = calculatePostflopStrategyFromSample(
    base,
    { ...options, flatDropBb: 1 },
    { eq: 0.48, pct: 0.15 },
  );
  const withoutDrop = calculatePostflopStrategyFromSample(
    base,
    options,
    { eq: 0.48, pct: 0.15 },
  );

  assert.ok(pair.Bet >= 60);
  assert.equal(pair.Bet + pair.Check, 100);
  assert.ok(draw.Bet >= 25);
  assert.equal(draw.Bet + draw.Check, 100);
  assert.deepEqual({ Check: air.Check }, { Check: 100 });
  assert.deepEqual(
    { Bet: withDrop.Bet, Check: withDrop.Check },
    { Bet: withoutDrop.Bet, Check: withoutDrop.Check },
  );
  assert.equal(withDrop.context.flatDropApplied, false);
  assert.equal(withDrop.context.compatibilityStackToPotRatio, 3);
});

test('provider browser seam injects options and preserves canonical StrategyResult normalization', () => {
  let options = { playStyle: 0, opponentStyle: 0, flatDropBb: 0 };
  const provider = installStrategyProviderBridge({}).createProvider({
    heuristicOptionsResolver: () => options,
  });
  const postflop = context({
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', '9h'],
    potBb: 10,
    stackBb: 30,
  });
  const baseline = provider.resolve(postflop);
  options = { playStyle: 1, opponentStyle: 0, flatDropBb: 0 };
  const styled = provider.resolve(postflop);
  options = { playStyle: 0, opponentStyle: 1, flatDropBb: 0 };
  const looseOpponent = provider.resolve(postflop);

  assert.equal(baseline.schemaVersion, 'strategy-result/v1');
  assert.equal(baseline.source, 'heuristic_postflop');
  assert.equal(baseline.actions.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.ok(styled.details.aggressionScore > baseline.details.aggressionScore);
  assert.ok(looseOpponent.details.heuristicSample.rangeFraction
    > baseline.details.heuristicSample.rangeFraction);
  assert.equal(styled.details.sampledEquity, baseline.details.sampledEquity);
});

test('local deterministic RNG streams are repeatable, independent, and reentrant', () => {
  const first = createDeterministicHeuristicRng(context());
  const second = createDeterministicHeuristicRng(context());
  const firstPrefix = [first(), first(), first()];
  assert.deepEqual([second(), second(), second()], firstPrefix);

  const postflop = context({
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', '9h'],
  });
  const baseline = resolveHeuristicStrategy(postflop);
  resolveHeuristicStrategy({ ...postflop, heroCards: ['Qh', 'Qd'] });
  assert.deepEqual(resolveHeuristicStrategy(postflop), baseline);
});
