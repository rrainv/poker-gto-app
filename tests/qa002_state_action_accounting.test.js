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
  assert.equal(qa.streetFor(['As', null, 'Kd', null, 'Qh']), 'flop');
});

test('table and stack controls expose the current UI boundaries', () => {
  assert.deepEqual(qa.readInputBounds('playersNum'), { min: 2, max: 10, step: 1 });
  assert.deepEqual(qa.readInputBounds('stackNum'), { min: 10, max: 500, step: 1 });
});

test('unopened non-BB context passes zero facing size to the UI and ONNX context', async () => {
  const capture = await qa.captureContext({ heroPos: 'BTN', lastAction: 'unopened', facingSize: 0 });
  assert.equal(capture.context.facingSize, 0);
  assert.equal(capture.facingControl, 0);
  assert.equal(capture.facingNumberControl, 0);
});

test('unopened BB context preserves a zero facing size', async () => {
  const capture = await qa.captureContext({ heroPos: 'BB', lastAction: 'unopened', facingSize: 0 });
  assert.equal(capture.context.facingSize, 0);
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
    assert.equal(capture.context.lastAction, fixture.action);
    assert.equal(capture.context.facingSize, fixture.facing);
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

test('characterization: rake-off still passes the nonzero rake control value to ONNX', async () => {
  const capture = await qa.captureContext({ rakeMode: 'off', rake: 5 });
  assert.equal(capture.context.rake, 5);
  assert.equal(Object.hasOwn(capture.context, 'rakeMode'), false);
});

test('characterization: fixed rake mode passes only an untyped numeric rake feature', async () => {
  const capture = await qa.captureContext({ rakeMode: 'fixed', rake: 0.1 });
  assert.equal(capture.context.rake, 0.1);
  assert.equal(Object.hasOwn(capture.context, 'rakeMode'), false);
});

test('characterization: stack mode does not change the single stack value sent to strategy', async () => {
  for (const stackMode of ['hero', 'effective', 'custom']) {
    const capture = await qa.captureContext({ stackMode, stack: 73 });
    assert.equal(capture.context.stack, 73);
    assert.equal(Object.hasOwn(capture.context, 'stackMode'), false);
    assert.equal(Object.hasOwn(capture.context, 'effectiveStack'), false);
  }
});

test('characterization: visual-table activePlayers is table size, with no players-remaining field', async () => {
  const capture = await qa.captureContext({ players: 8 });
  assert.equal(capture.dispatchedState.activePlayers, 8);
  assert.equal(Object.hasOwn(capture.context, 'playersRemaining'), false);
  assert.equal(Object.hasOwn(capture.dispatchedState, 'playersRemaining'), false);
});

test('characterization: flat drop is added to postflop pot and lowers aggression thresholds', () => {
  assert.deepEqual(qa.readInputBounds('flatDrop'), { min: 0, max: null, step: 0.1 });
  const noDrop = qa.postflopWithDrop(0);
  const oneBlindDrop = qa.postflopWithDrop(1);
  assert.deepEqual({ Bet: noDrop.Bet, Check: noDrop.Check }, { Bet: 25, Check: 75 });
  assert.deepEqual({ Bet: oneBlindDrop.Bet, Check: oneBlindDrop.Check }, { Bet: 75, Check: 25 });
  assert.equal(noDrop.context.spr, 3);
  assert.equal(oneBlindDrop.context.spr, 30 / 11);
});

test('local-tree action parser fills a missing percentage with Fold', () => {
  assert.deepEqual(qa.parseSolverEntry({ detail: 'Raise 40% · Call 30%' }), [
    { name: 'Open', value: 40, kind: 'aggressive' },
    { name: 'Call', value: 30, kind: 'passive' },
    { name: 'Fold', value: 30, kind: 'fold' },
  ]);
});

test('Call tokens never become All-in actions', () => {
  for (const input of ['Call', 'CALL', 'Call 30%', 'Callback option', 'recall', 'locally called']) {
    assert.equal(qa.classifyAction(input), 'passive');
    assert.equal(qa.standardActionName(input), 'Call');
  }
  assert.deepEqual(qa.parseSolverEntry({ detail: 'Call 30%' }), [
    { name: 'Call', value: 30, kind: 'passive' },
    { name: 'Fold', value: 70, kind: 'fold' },
  ]);
});

test('All-in, All In, and Jam remain legitimate all-in tokens', () => {
  for (const input of ['All-in', 'All In', 'Jam']) {
    assert.equal(qa.classifyAction(input), 'aggressive');
    assert.equal(qa.standardActionName(input), 'All-in');
  }
  assert.deepEqual(qa.parseSolverEntry({ detail: 'All-in 30%' }), [
    { name: 'All-in', value: 30, kind: 'aggressive' },
    { name: 'Fold', value: 70, kind: 'fold' },
  ]);
});

test('characterization: local-tree action parser does not normalize totals above 100%', () => {
  const actions = qa.parseSolverEntry({ detail: 'Raise 70% Call 50%' });
  assert.equal(actions.reduce((sum, action) => sum + action.value, 0), 120);
});

test('characterization: Playbook model actionProfile preserves percentage totals above 100%', () => {
  const profile = qa.playbookActionProfile({ Open: 70, Call: 50 });
  assert.equal(profile.actions.reduce((sum, action) => sum + action.value, 0), 120);
  assert.equal(profile.best, 'OPEN 3 BB');
});

test('characterization: Playbook model actionProfile preserves probability-scale values without conversion', () => {
  const profile = qa.playbookActionProfile({ Open: 0.7, Call: 0.3 });
  assert.deepEqual(profile.actions.map(({ name, value, kind }) => ({ name, value, kind })), [
    { name: 'Open', value: 0.7, kind: 'aggressive' },
    { name: 'Call', value: 0.3, kind: 'passive' },
  ]);
});

test('ONNX action-profile adapter combines five model outputs into three normalized families', () => {
  const result = qa.heuristic([0.2, 0.1, 0.3, 0.15, 0.25], { potSize: 10, facingSize: 5 }, null);
  assert.deepEqual(result, { open: 45, call: 25, fold: 30 });
  assert.equal(Object.values(result).reduce((sum, value) => sum + value, 0), 100);
});

test('Playbook parser recognizes its current string action families', () => {
  const cases = {
    'Open 2.5': ['aggressive', 'Open'],
    'Raise': ['aggressive', 'Open'],
    'Bet': ['aggressive', 'Bet'],
    'Jam': ['aggressive', 'All-in'],
    'All-in': ['aggressive', 'All-in'],
    'All In': ['aggressive', 'All-in'],
    'Call': ['passive', 'Call'],
    'Check': ['passive', 'Check'],
    'Fold': ['fold', 'Fold'],
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.deepEqual([qa.classifyAction(input), qa.standardActionName(input)], expected);
  }
});

test('Training action normalization uses different strings from Playbook output', () => {
  assert.equal(qa.normalizeActionName('Open 2.5bb'), 'raise');
  assert.equal(qa.normalizeActionName('3bet'), '3-bet');
  assert.equal(qa.normalizeActionName('4bet'), '4-bet');
  assert.equal(qa.normalizeActionName('Jam'), 'jam');
  assert.equal(qa.normalizeActionName('All-In'), 'all-in');
  assert.deepEqual(['fold', 'check', 'call', 'bet', 'raise', '3-bet', '4-bet', 'all-in'].map(qa.actionRank), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('Training exposes Fold/Open for an unopened preflop non-BB spot', () => {
  assert.deepEqual(qa.trainingButtons({ street: 'preflop', hero_pos: 'BTN', lastAction: 'unopened', facingSize: 0 }, {}), [
    { text: 'Fold', action: 'fold' },
    { text: 'Open', action: 'raise' },
  ]);
});

test('Training exposes Check/Bet, not Fold, when checking is free', () => {
  assert.deepEqual(qa.trainingButtons({ street: 'postflop', hero_pos: 'BTN', lastAction: 'check', facingSize: 0, board: ['2c', '7d', '9h'] }, { Fold: 80 }), [
    { text: 'Check', action: 'check' },
    { text: 'Bet', action: 'bet' },
  ]);
});

test('Training adds Fold/Call/3-Bet when facing a raise', () => {
  assert.deepEqual(qa.trainingButtons({ street: 'preflop', hero_pos: 'BTN', lastAction: 'raise', facingSize: 2.5 }, {}), [
    { text: 'Fold', action: 'fold' },
    { text: 'Call', action: 'call' },
    { text: '3-Bet', action: '3-bet' },
  ]);
});

test('Training adds Fold/Call/4-Bet when facing a 3-bet', () => {
  assert.deepEqual(qa.trainingButtons({ street: 'preflop', hero_pos: 'BTN', lastAction: '3bet', facingSize: 7.5 }, {}), [
    { text: 'Fold', action: 'fold' },
    { text: 'Call', action: 'call' },
    { text: '4-Bet', action: '4-bet' },
  ]);
});

test('Training converts solver probabilities in [0,1] to integer percentages', () => {
  const result = qa.trainingStrategy({ Open: 0.5, Call: 0.25, Fold: 0.25 }, {
    hero_pos: 'BTN', board: [], facingSize: 1, lastAction: 'raise', potSize: 4, stack: 100,
  });
  assert.deepEqual(result, { Open: 50, Call: 25, Fold: 25 });
});

test('characterization: mixed Training action units can produce a total above 100%', () => {
  const result = qa.trainingStrategy({ Open: 1, Call: 25 }, {
    hero_pos: 'BTN', board: [], facingSize: 1, lastAction: 'raise', potSize: 4, stack: 100,
  });
  assert.deepEqual(result, { Open: 100, Call: 25 });
});

test('preflop fallback Ace and King predicates use the production card-rank values', () => {
  assert.deepEqual(['A', 'K', 'Q', 'J'].map(qa.rankValue), [14, 13, 12, 11]);
  assert.match(qa.fallbackSource, /const hasAce = highRank === 14;/);
  assert.match(qa.fallbackSource, /const hasKing = highRank === 13;/);
});

test('Ace is recognized by the fallback ace-wheel response branch', () => {
  const aceDeuce = qa.fallback('A', '2', false, true, 'UTG', 'raise', 2.5, 5, 100);
  assert.deepEqual(aceDeuce, { open: 0.35, call: 0.3525, fold: 0.2975 });
  assert.notDeepEqual(aceDeuce, { open: 0.005454841059780644, call: 0.4945451589402194, fold: 0.4999999999999999 });
  assertNormalized(aceDeuce);
});

test('King is recognized by the fallback King response bonus', () => {
  const kingDeuce = qa.fallback('K', '2', false, true, 'UTG', 'raise', 2.5, 5, 100);
  assert.deepEqual(kingDeuce, { open: 0.01771718468871022, call: 0.48228281531128975, fold: 0.5 });
  assert.notDeepEqual(kingDeuce, { open: 0.005454841059780644, call: 0.4945451589402194, fold: 0.4999999999999999 });
  assertNormalized(kingDeuce);
});

test('Queen is not recognized as Ace by the fallback', () => {
  const queenDeuce = qa.fallback('Q', '2', false, true, 'UTG', 'raise', 2.5, 5, 100);
  assert.deepEqual(queenDeuce, { open: 0.005454841059780644, call: 0.4945451589402194, fold: 0.4999999999999999 });
  assert.notDeepEqual(queenDeuce, { open: 0.35, call: 0.3525, fold: 0.2975 });
  assertNormalized(queenDeuce);
});

test('Jack is not recognized as King by the fallback', () => {
  const jackDeuce = qa.fallback('J', '2', false, true, 'UTG', 'raise', 2.5, 5, 100);
  assert.deepEqual(jackDeuce, { open: 0.005454841059780644, call: 0.4945451589402194, fold: 0.4999999999999999 });
  assert.notDeepEqual(jackDeuce, { open: 0.01771718468871022, call: 0.48228281531128975, fold: 0.5 });
  assertNormalized(jackDeuce);
});

test('representative fallback output is unchanged for a hand outside the rank-predicate bug', () => {
  const tenNineSuited = qa.fallback('T', '9', false, true, 'UTG', 'raise', 2.5, 5, 100);
  assert.deepEqual(tenNineSuited, {
    open: 0.48648510476127127,
    call: 0.35902106476226897,
    fold: 0.15449383047645973,
  });
});
