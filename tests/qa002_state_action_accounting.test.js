const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

const EXPECTED_POSITIONS = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'CO', 'SB', 'BB'],
  5: ['BTN', 'HJ', 'CO', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

function assertNormalized(profile) {
  for (const value of Object.values(profile)) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0 && value <= 1);
  }
  assert.ok(Math.abs(profile.open + profile.call + profile.fold - 1) < 1e-9);
}

for (const [count, expected] of Object.entries(EXPECTED_POSITIONS)) {
  test(`Playbook positions: ${count} players`, () => {
    assert.deepEqual(qa.positionsFor(Number(count)), expected);
  });
}

test('table-size change preserves a still-valid hero position', () => {
  const result = qa.updateHeroPositions(5, 'CO');
  assert.equal(result.value, 'CO');
  assert.match(result.html, /value="HJ"/);
});

test('table-size change replaces an invalid hero position with BTN', () => {
  assert.equal(qa.updateHeroPositions(3, 'UTG').value, 'BTN');
});

test('10-player table-size change presents and preserves full-ring positions', () => {
  const result = qa.updateHeroPositions(10, 'MP');
  assert.equal(result.value, 'MP');
  assert.match(result.html, /value="UTG\+2"/);
  assert.equal((result.html.match(/<option/g) || []).length, 10);
});

test('street is derived only from the number of populated board cards', () => {
  assert.equal(qa.streetFor([]), 'preflop');
  assert.equal(qa.streetFor(['As', 'Kd', 'Qh']), 'flop');
  assert.equal(qa.streetFor(['As', 'Kd', 'Qh', '2c']), 'turn');
  assert.equal(qa.streetFor(['As', 'Kd', 'Qh', '2c', '3s']), 'river');
  assert.equal(qa.streetFor(['As']), 'invalid');
  assert.equal(qa.streetFor(['As', 'Kd']), 'invalid');
  assert.equal(qa.streetFor(['As', null, 'Kd', null, 'Qh']), 'invalid');
});

test('table and stack controls expose the current UI boundaries', () => {
  assert.deepEqual(qa.readInputBounds('playersNum'), { min: 2, max: 10, step: 1 });
  assert.deepEqual(qa.readInputBounds('stackNum'), { min: 10, max: 500, step: 1 });
});

test('unopened non-BB context passes zero facing size to the UI and DecisionContext', async () => {
  const capture = await qa.captureContext({ heroPos: 'BTN', lastAction: 'unopened', facingSize: 0 });
  assert.equal(capture.decisionContext.facingSizeBb, 0);
  assert.equal(capture.facingControl, 0);
  assert.equal(capture.facingNumberControl, 0);
});

test('unopened BB context preserves a zero facing size', async () => {
  const capture = await qa.captureContext({ heroPos: 'BB', lastAction: 'unopened', facingSize: 0 });
  assert.equal(capture.decisionContext.facingSizeBb, 0);
});

test('unopened context and fallback share the same zero-facing convention', () => {
  const zeroFacing = qa.fallback('T', '9', false, true, 'BTN', 'unopened', 0, 1.5, 30);
  assert.equal(zeroFacing.call, 0);
  assertNormalized(zeroFacing);
});

for (const fixture of [
  { action: 'raise', facing: 2.5 },
  { action: '3bet', facing: 7.5 },
  { action: '4bet', facing: 18 },
]) {
  test(`${fixture.action} context passes its action and facing size unchanged`, async () => {
    const capture = await qa.captureContext({ lastAction: fixture.action, facingSize: fixture.facing });
    assert.equal(capture.decisionContext.lastAction, fixture.action);
    assert.equal(capture.decisionContext.facingSizeBb, fixture.facing);
    assertNormalized(qa.fallback('A', 'K', false, true, 'BTN', fixture.action, fixture.facing, 10, 100));
  });
}

test('fallback remains finite and normalized at current stack/facing boundaries', () => {
  const fixtures = [
    { stack: 0, facing: 0 },
    { stack: 0, facing: 100 },
    { stack: 10, facing: 100 },
    { stack: 500, facing: 0 },
    { stack: 500, facing: 100 },
  ];
  for (const fixture of fixtures) {
    assertNormalized(qa.fallback('8', '7', false, true, 'BB', 'raise', fixture.facing, 0.5, fixture.stack));
  }
});

test('HTML and slider synchronization keep facing size nonnegative', () => {
  assert.deepEqual(qa.readInputBounds('facingSizeNum'), { min: 0, max: 100, step: 0.5 });
  assert.deepEqual(qa.clampPair('facingSize', 'facingSizeNum', 0, -7, 0, 100), { range: 0, number: 0 });
});

test('HTML and slider synchronization keep pot size at or above 0.5bb', () => {
  assert.deepEqual(qa.readInputBounds('potSizeNum'), { min: 0.5, max: 200, step: 0.5 });
  assert.deepEqual(qa.clampPair('potSize', 'potSizeNum', 1.5, -7, 0.5, 200), { range: 0.5, number: 0.5 });
});

test('preflop base pot is blinds plus per-player ante plus straddle', () => {
  assert.equal(qa.preflopPot({ ante: 0, players: 6, straddle: 0 }), 1.5);
  assert.equal(qa.preflopPot({ ante: 0.5, players: 8, straddle: 2 }), 7.5);
});

test('Home sends zero forced contributions to DecisionContext', async () => {
  const capture = await qa.captureContext({ rakeMode: 'off' });
  assert.equal(capture.decisionContext.rakeMode, 'off');
  assert.equal(capture.decisionContext.forcedContributionPerPlayerBb, 0);
  assert.equal(capture.decisionContext.totalForcedContributionBb, 0);
});

test('ClubGG is an explicit per-player contribution', async () => {
  const capture = await qa.captureContext({ players: 7, rakeMode: 'fixed' });
  assert.equal(capture.decisionContext.rakeMode, 'fixed');
  assert.equal(capture.decisionContext.forcedContributionPerPlayerBb, 0.1);
  assert.equal(capture.decisionContext.totalForcedContributionBb, 0.7);
});

test('DecisionContext preserves stack mode and stack value for fallback strategy', async () => {
  for (const stackMode of ['hero', 'effective', 'custom']) {
    const capture = await qa.captureContext({ stackMode, stack: 73, heroCards: ['As', 'Kd'] });
    assert.equal(capture.decisionContext.stackBb, 73);
    assert.equal(capture.decisionContext.stackMode, stackMode);
    assert.equal(capture.strategyResult.source, 'heuristic_preflop');
  }
});

test('characterization: visual-table activePlayers is table size, with no players-remaining field', async () => {
  const capture = await qa.captureContext({ players: 8 });
  assert.equal(capture.dispatchedState.activePlayers, 8);
  assert.equal(Object.hasOwn(capture.decisionContext, 'playersRemaining'), false);
  assert.equal(Object.hasOwn(capture.dispatchedState, 'playersRemaining'), false);
});

test('manual flat-drop strategy control is removed and legacy option is ignored', () => {
  const noDrop = qa.postflopWithDrop(0);
  const oneBlindDrop = qa.postflopWithDrop(1);
  assert.deepEqual(
    { Bet: oneBlindDrop.Bet, Check: oneBlindDrop.Check },
    { Bet: noDrop.Bet, Check: noDrop.Check },
  );
  assert.equal(noDrop.context.effectiveSpr.kind, 'base_v1_compatibility_spr');
  assert.equal(noDrop.context.effectiveSpr.scalar, 3);
  assert.equal(oneBlindDrop.context.effectiveSpr.scalar, 3);
  assert.equal(oneBlindDrop.context.flatDropApplied, false);
});

test('canonical StrategyResult action mapping preserves action families and sizing', () => {
  const cases = {
    Fold: { type: 'fold', amountBb: null, potFraction: null },
    Check: { type: 'check', amountBb: null, potFraction: null },
    Call: { type: 'call', amountBb: null, potFraction: null },
    'Bet 50% pot': { type: 'bet', amountBb: null, potFraction: 0.5 },
    'Open 2.5bb': { type: 'raise', amountBb: 2.5, potFraction: null },
    '3-Bet 8bb': { type: 'raise', amountBb: 8, potFraction: null },
    Jam: { type: 'all_in', amountBb: null, potFraction: null },
  };
  for (const [label, expected] of Object.entries(cases)) {
    assert.deepEqual(qa.structuralAction(label), expected);
  }
});

test('preflop fallback Ace and King predicates use the production card-rank values', () => {
  assert.deepEqual(['A', 'K', 'Q', 'J'].map(qa.rankValue), [14, 13, 12, 11]);
  assert.match(qa.fallbackSource, /const hasAce = highRank === HEURISTIC_RANK_VALUES\.A;/);
  assert.match(qa.fallbackSource, /const hasKing = highRank === HEURISTIC_RANK_VALUES\.K;/);
});

test('suited wheel Aces retain smooth response value without a replacement strategy', () => {
  const aceDeuce = qa.fallback('A', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  const aceThree = qa.fallback('A', '3', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  assertNormalized(aceDeuce);
  assertNormalized(aceThree);
  assert.ok(aceDeuce.open + aceDeuce.call > 0);
  assert.ok(Math.abs(aceDeuce.open - aceThree.open) < 0.2);
});

test('King is recognized by the fallback King response bonus', () => {
  const kingDeuce = qa.fallback('K', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  const queenDeuce = qa.fallback('Q', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  assert.ok(kingDeuce.open + kingDeuce.call > queenDeuce.open + queenDeuce.call);
  assertNormalized(kingDeuce);
});

test('Queen is not recognized as Ace by the fallback', () => {
  const queenDeuce = qa.fallback('Q', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  const aceDeuce = qa.fallback('A', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  assert.ok(queenDeuce.open + queenDeuce.call < aceDeuce.open + aceDeuce.call);
  assertNormalized(queenDeuce);
});

test('Jack is not recognized as King by the fallback', () => {
  const jackDeuce = qa.fallback('J', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  const kingDeuce = qa.fallback('K', '2', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  assert.ok(jackDeuce.open + jackDeuce.call < kingDeuce.open + kingDeuce.call);
  assertNormalized(jackDeuce);
});

test('representative connected hand remains normalized outside rank predicates', () => {
  const tenNineSuited = qa.fallback('T', '9', false, true, 'UTG', 'raise', 2.5, 5, 100, 2.5);
  assertNormalized(tenNineSuited);
  assert.ok(tenNineSuited.call > tenNineSuited.open);
  assert.ok(tenNineSuited.fold > tenNineSuited.call);
});
