const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');
let deriveDecisionContextFromPlaybookScenario;

test.before(async () => {
  ({ deriveDecisionContextFromPlaybookScenario } = await import(
    '../app/src/application/playbook-state-source.mjs'
  ));
});

function snapshot(overrides = {}) {
  const result = {
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
  if (result.rakeMode === 'fixed') {
    result.forcedContributionPerPlayerBb = 0.1;
    result.totalForcedContributionBb = result.tableSize * 0.1;
  }
  return result;
}

test('DecisionContext v1 derives a Home unopened spot', () => {
  const context = deriveDecisionContextFromPlaybookScenario(snapshot());
  assert.deepEqual({
    schemaVersion: context.schemaVersion,
    tableSize: context.tableSize,
    opponentCount: context.opponentCount,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: context.heroCards,
    board: context.board,
    deadCards: context.deadCards,
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.potBb,
    lastAction: context.lastAction,
    facingSizeBb: context.facingSizeBb,
    callAmountBb: context.callAmountBb,
    heroStreetContributionBb: context.heroStreetContributionBb,
    rakeMode: context.rakeMode,
    forcedContributionPerPlayerBb: context.forcedContributionPerPlayerBb,
    totalForcedContributionBb: context.totalForcedContributionBb,
  }, {
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
  assert.equal(context.contractVersion, 'decision-context/v1.1');
  assert.equal(context.startingStackBb, 100);
  assert.equal(context.heroStackBb, null);
  assert.equal(context.effectiveStackBb, null);
  assert.deepEqual(context.effectiveStackByOpponent, []);
  assert.equal(context.positionRelation, 'not_applicable');
  assert.equal(context.currentPotBb, 1.5);
  assert.equal(context.canRaise, null);
  assert.equal(context.derivation.source, 'scenario');
});

test('DecisionContext v1 derives a ClubGG unopened spot', () => {
  const context = deriveDecisionContextFromPlaybookScenario(snapshot({
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
  const raise = deriveDecisionContextFromPlaybookScenario(snapshot({ lastAction: 'raise', facingSizeBb: 2.5, potBb: 4 }));
  const threeBet = deriveDecisionContextFromPlaybookScenario(snapshot({ lastAction: '3bet', facingSizeBb: 7.5, potBb: 11.5 }));
  assert.equal(raise.facingSizeBb, 2.5);
  assert.equal(threeBet.facingSizeBb, 7.5);
});

test('DecisionContext preserves a 10-max full-ring position', () => {
  const context = deriveDecisionContextFromPlaybookScenario(snapshot({
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
    assert.equal(deriveDecisionContextFromPlaybookScenario(snapshot({ board })).street, street);
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
  assert.throws(() => deriveDecisionContextFromPlaybookScenario({ ...edgeInput, rakeMode: 'unknown' }),
    /Unsupported legacy Scenario rakeMode/);
  const context = deriveDecisionContextFromPlaybookScenario(edgeInput);
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
  assert.equal(capture.strategyResult.source, 'unavailable');
  assert.equal(capture.strategyResult.contextCoverage.kind, 'unsupported');
  assert.equal(capture.strategyResult.contextCoverage.basis, 'missing_trusted_decision_economics');
});

test('updateContext fails closed and clears stale results when the canonical bridge is missing', async () => {
  const capture = await qa.captureContext({ bridgeBehavior: 'missing', seedStale: true });
  assert.equal(capture.playbookResolution.status, 'unavailable');
  assert.equal(capture.playbookResolution.reason, 'canonical_playbook_dependency_unavailable');
  assert.equal(capture.decisionContext, null);
  assert.equal(capture.strategyResult, null);
  assert.equal(capture.playbookViewModel, null);

  const missingResolver = await qa.captureContext({
    bridgeBehavior: 'missing_resolver',
    seedStale: true,
  });
  assert.equal(missingResolver.playbookResolution.reason,
    'canonical_playbook_dependency_unavailable');
  assert.equal(missingResolver.decisionContext, null);
  assert.equal(missingResolver.strategyResult, null);
});

test('updateContext fails closed with a stable reason when the canonical resolver throws', async () => {
  const capture = await qa.captureContext({ bridgeBehavior: 'throw', seedStale: true });
  assert.equal(capture.playbookResolution.status, 'error');
  assert.equal(capture.playbookResolution.reason, 'canonical_playbook_resolution_failed');
  assert.match(capture.playbookResolution.error.message, /test resolver failure/);
  assert.equal(capture.decisionContext, null);
  assert.equal(capture.strategyResult, null);
});

test('updateContext resumes canonical Scenario resolution after the bridge is restored', async () => {
  await qa.captureContext({ bridgeBehavior: 'missing', seedStale: true });
  const restored = await qa.captureContext({ heroCards: ['As', 'Kd'] });
  assert.equal(restored.playbookResolution.status, 'available');
  assert.equal(restored.decisionContext.schemaVersion, 'decision-context/v1');
  assert.equal(restored.decisionContext.derivation.source, 'scenario');
  assert.equal(restored.strategyResult.schemaVersion, 'strategy-result/v1');
});

test('fallback recommendations use the same cards and fields through DecisionContext', () => {
  const fixtures = [
    snapshot({ heroPosition: 'BTN' }),
    snapshot({ tableSize: 10, heroPosition: 'UTG+2', rakeMode: 'fixed' }),
    snapshot({ heroPosition: 'BTN', lastAction: 'raise', facingSizeBb: 2.5, potBb: 10, stackBb: 30 }),
    snapshot({ heroPosition: 'BB' }),
  ];

  for (const input of fixtures) {
    const context = deriveDecisionContextFromPlaybookScenario(input);
    const [firstCard, secondCard] = context.heroCards;
    const direct = qa.fallback(
      firstCard[0], secondCard[0], firstCard[0] === secondCard[0], firstCard[1] === secondCard[1],
      input.heroPosition, input.lastAction, input.facingSizeBb, input.potBb, input.stackBb,
      context.callAmountBb, context.tableSize,
    );
    const throughContext = qa.fallbackForDecisionContext(context);
    assert.deepEqual(throughContext, direct);
  }
});
