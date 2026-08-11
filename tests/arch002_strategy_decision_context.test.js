const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

const logicSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'src', 'core', 'logic.js'),
  'utf8',
);

function decisionContext(overrides = {}) {
  return qa.deriveDecisionContext({
    tableSize: 6,
    heroPosition: 'BTN',
    heroCards: ['As', 'Ks'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    legacyRakeValue: 5,
    ...overrides,
  });
}

function functionSource(start, end) {
  const startIndex = logicSource.indexOf(start);
  const endIndex = logicSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing ${start}`);
  assert.notEqual(endIndex, -1, `missing ${end}`);
  return logicSource.slice(startIndex, endIndex);
}

test('DecisionContext adapters preserve the established preflop and postflop argument shapes', () => {
  const context = decisionContext({
    tableSize: 10,
    heroPosition: 'UTG+2',
    heroCards: ['Ah', 'Kd'],
    board: ['2c', '7d', '9h'],
    deadCards: ['Ac'],
    stackBb: 200,
    potBb: 11.5,
    lastAction: '3bet',
    facingSizeBb: 7.5,
    rakeMode: 'fixed',
  });

  assert.deepEqual(qa.legacyPostflopContext(context), {
    board: ['2c', '7d', '9h'],
    heroCards: ['Ah', 'Kd'],
    deadCards: ['Ac'],
    hero_pos: 'UTG+2',
    villain_pos: 'SB',
    facingSize: 7.5,
    potSize: 11.5,
    stack: 200,
  });

  assert.deepEqual(
    qa.fallbackForDecisionContext(context),
    qa.fallback('A', 'K', false, false, 'UTG+2', '3bet', 7.5, 11.5, 200),
  );
});

test('preflop fallback entry preserves six-max, 10-max, raise, and 3-bet behavior', () => {
  const fixtures = [
    decisionContext(),
    decisionContext({ tableSize: 10, heroPosition: 'LJ', rakeMode: 'fixed' }),
    decisionContext({ lastAction: 'raise', facingSizeBb: 2.5, potBb: 4 }),
    decisionContext({ lastAction: '3bet', facingSizeBb: 8, potBb: 12 }),
  ];

  for (const context of fixtures) {
    const expected = qa.fallback(
      'A', 'K', false, true,
      context.heroPosition,
      context.lastAction,
      context.facingSizeBb,
      context.potBb,
      context.stackBb,
    );
    assert.deepEqual(qa.fallbackForDecisionContext(context), expected);

    const profile = qa.fallbackStrategyProfile(context);
    assert.equal(profile.source, 'MATH FALLBACK');
    assert.equal(profile.actions[0].value + profile.actions[1].value, Math.round(Math.max(expected.open, expected.call, expected.fold) * 100)
      + Math.round([expected.open, expected.call, expected.fold].sort((a, b) => b - a)[1] * 100));
  }
});

test('Home and ClubGG contexts produce identical strategy when poker decision inputs match', () => {
  const home = decisionContext({ tableSize: 9, heroPosition: 'HJ', rakeMode: 'off' });
  const club = decisionContext({ tableSize: 9, heroPosition: 'HJ', rakeMode: 'fixed' });

  assert.deepEqual(qa.fallbackStrategyProfile(club), qa.fallbackStrategyProfile(home));
  assert.equal(home.totalForcedContributionBb, 0);
  assert.equal(club.totalForcedContributionBb, 0.9);
});

test('postflop strategy entry uses DecisionContext on flop, turn, and river', () => {
  const boards = [
    ['2c', '7d', '9h'],
    ['2c', '7d', '9h', 'Ts'],
    ['2c', '7d', '9h', 'Ts', 'Jc'],
  ];

  for (const board of boards) {
    const context = decisionContext({
      heroCards: ['As', 'Kd'],
      board,
      deadCards: ['Ac'],
      potBb: 10,
      stackBb: 30,
    });
    const capture = qa.strategyProfileCapture(context);
    const profile = capture.profile;
    assert.equal(profile.source, 'MONTE CARLO');
    assert.equal(typeof profile.best, 'string');
    assert.equal(profile.context.spr, 3);
    assert.deepEqual(capture.equityDecisionContext, context);
  }
});

test('strategy-facing consumers contain no independent poker-state control reads', () => {
  const fallback = functionSource('function fallbackStrategyResult(', 'function actionProfile(');
  const profile = functionSource('function actionProfile(', 'function setFrequency(');

  for (const [name, source] of Object.entries({ fallback, profile })) {
    assert.doesNotMatch(source, /selectedValue\('#(?:heroPos|lastAction)'\)/, name);
    assert.doesNotMatch(source, /numericValue\('#(?:players|stack|potSize|facingSize)'/, name);
    assert.doesNotMatch(source, /app\.gto/, name);
    assert.doesNotMatch(source, /currentStreet\(\)/, name);
  }
  assert.match(logicSource, /const strategyResult = actionProfile\(null, decisionContext\);/);
  assert.match(logicSource, /const profile = strategyResultToLegacyProfile\(strategyResult\);/);
});
