const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

function snapshot(overrides = {}) {
  return {
    tableSize: 6,
    heroPosition: 'BTN',
    heroCards: ['As', 'Kd'],
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
    ...overrides,
  };
}

test('DecisionContext v1 derives a Home unopened spot', () => {
  assert.deepEqual(qa.deriveDecisionContext(snapshot()), {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: null,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
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
  });
});

test('DecisionContext v1 derives a ClubGG unopened spot', () => {
  const context = qa.deriveDecisionContext(snapshot({
    tableSize: 9,
    heroPosition: 'LJ',
    stackBb: 200,
    facingSizeBb: 7,
    rakeMode: 'fixed',
  }));
  assert.equal(context.facingSizeBb, 0);
  assert.equal(context.forcedContributionPerPlayerBb, 0.1);
  assert.equal(context.totalForcedContributionBb, 0.9);
  assert.equal(Object.hasOwn(context, 'legacyRakePercent'), false);
});

test('raise and 3-bet facing sizes remain positive', () => {
  const raise = qa.deriveDecisionContext(snapshot({ lastAction: 'raise', facingSizeBb: 2.5, potBb: 4 }));
  const threeBet = qa.deriveDecisionContext(snapshot({ lastAction: '3bet', facingSizeBb: 7.5, potBb: 11.5 }));
  assert.equal(raise.facingSizeBb, 2.5);
  assert.equal(threeBet.facingSizeBb, 7.5);
});

test('DecisionContext preserves a 10-max full-ring position', () => {
  const context = qa.deriveDecisionContext(snapshot({
    tableSize: 10,
    heroPosition: 'UTG+2',
    rakeMode: 'fixed',
  }));
  assert.equal(context.tableSize, 10);
  assert.equal(context.heroPosition, 'UTG+2');
  assert.equal(context.totalForcedContributionBb, 1.0);
});

test('street is derived from explicit board cards for flop, turn, and river', () => {
  const boards = [
    [['2c', '7d', '9h'], 'flop'],
    [['2c', '7d', '9h', 'Ts'], 'turn'],
    [['2c', '7d', '9h', 'Ts', 'Jc'], 'river'],
  ];
  for (const [board, street] of boards) {
    assert.equal(qa.deriveDecisionContext(snapshot({ board })).street, street);
  }
});

test('invalid and edge inputs use current production bounds while unknown accounting fails', () => {
  const edgeInput = {
    tableSize: 99,
    heroPosition: '',
    heroCards: null,
    board: [null, '2c', '7d'],
    deadCards: 'As',
    stackBb: -20,
    stackMode: '',
    potBb: Number.NaN,
    lastAction: '',
    facingSizeBb: 999,
    rakeMode: 'off',
  };
  assert.throws(() => qa.deriveDecisionContext({ ...edgeInput, rakeMode: 'unknown' }),
    /Unsupported legacy Scenario rakeMode/);
  const context = qa.deriveDecisionContext(edgeInput);
  assert.deepEqual({
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    heroCards: context.heroCards,
    board: context.board,
    deadCards: context.deadCards,
    street: context.street,
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.potBb,
    lastAction: context.lastAction,
    facingSizeBb: context.facingSizeBb,
    rakeMode: context.rakeMode,
  }, {
    tableSize: 10,
    heroPosition: 'BTN',
    heroCards: [],
    board: ['2c', '7d'],
    deadCards: [],
    street: 'invalid',
    stackBb: 10,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
  });
});

test('updateContext follows snapshot to DecisionContext to fallback StrategyResult', async () => {
  const capture = await qa.captureContext({
    players: 10,
    heroPos: 'UTG+2',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', '9h'],
    deadCards: ['Ac'],
    stack: 200,
    stackMode: 'effective',
    potSize: 11.5,
    lastAction: '3bet',
    facingSize: 7.5,
    rakeMode: 'fixed',
  });
  assert.equal(capture.snapshot.tableSize, 10);
  assert.equal(capture.decisionContext.schemaVersion, 'decision-context/v1');
  assert.equal(capture.strategyResult.schemaVersion, 'strategy-result/v1');
  assert.equal(capture.strategyResult.source, 'heuristic_postflop');
});

test('fallback recommendations use the same cards and fields through DecisionContext', () => {
  const fixtures = [
    snapshot({ heroPosition: 'BTN' }),
    snapshot({ tableSize: 10, heroPosition: 'UTG+2', rakeMode: 'fixed' }),
    snapshot({ heroPosition: 'BTN', lastAction: 'raise', facingSizeBb: 2.5, potBb: 10, stackBb: 30 }),
    snapshot({ heroPosition: 'BB' }),
  ];

  for (const input of fixtures) {
    const context = qa.deriveDecisionContext(input);
    const [firstCard, secondCard] = context.heroCards;
    const direct = qa.fallback(
      firstCard[0], secondCard[0], firstCard[0] === secondCard[0], firstCard[1] === secondCard[1],
      input.heroPosition, input.lastAction, input.facingSizeBb, input.potBb, input.stackBb,
      context.callAmountBb,
    );
    const throughContext = qa.fallbackForDecisionContext(context);
    assert.deepEqual(throughContext, direct);
  }
});
