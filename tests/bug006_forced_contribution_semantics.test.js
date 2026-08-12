const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

test('Home mode has zero forced contribution and zero legacy rake feature', async () => {
  const capture = await qa.captureContext({ players: 10, rakeMode: 'off' });
  assert.equal(capture.decisionContext.rakeMode, 'off');
  assert.equal(capture.decisionContext.forcedContributionPerPlayerBb, 0);
  assert.equal(capture.decisionContext.totalForcedContributionBb, 0);
  assert.equal(Object.hasOwn(capture.decisionContext, 'legacyRakePercent'), false);
});

test('ClubGG mode derives exact totals for 7, 9, and 10 seated players', async () => {
  for (const [players, expectedTotal] of [[7, 0.7], [9, 0.9], [10, 1.0]]) {
    const capture = await qa.captureContext({ players, rakeMode: 'fixed' });
    assert.equal(capture.decisionContext.rakeMode, 'fixed');
    assert.equal(capture.decisionContext.forcedContributionPerPlayerBb, 0.1);
    assert.equal(capture.decisionContext.totalForcedContributionBb, expectedTotal);
    assert.equal(Object.hasOwn(capture.decisionContext, 'legacyRakePercent'), false);
  }
});

test('ClubGG contribution does not scale with pot size', async () => {
  const smallPot = await qa.captureContext({ players: 9, rakeMode: 'fixed', potSize: 1.5 });
  const largePot = await qa.captureContext({ players: 9, rakeMode: 'fixed', potSize: 200 });
  assert.equal(smallPot.decisionContext.totalForcedContributionBb, 0.9);
  assert.equal(largePot.decisionContext.totalForcedContributionBb, 0.9);
  assert.equal(smallPot.decisionContext.potBb, 1.5);
  assert.equal(largePot.decisionContext.potBb, 200);
});

test('ClubGG contribution is not multiplied by street count', async () => {
  for (const board of [[], ['2c', '7d', '9h'], ['2c', '7d', '9h', 'Ts'], ['2c', '7d', '9h', 'Ts', 'Jc']]) {
    const capture = await qa.captureContext({ players: 10, rakeMode: 'fixed', board });
    assert.equal(capture.decisionContext.forcedContributionPerPlayerBb, 0.1);
    assert.equal(capture.decisionContext.totalForcedContributionBb, 1.0);
  }
});

test('repeated context refresh does not accumulate ClubGG contribution', async () => {
  const capture = await qa.captureContext({ players: 9, rakeMode: 'fixed', refreshCount: 4 });
  assert.deepEqual(capture.decisionContexts.map((context) => context.totalForcedContributionBb), [0.9, 0.9, 0.9, 0.9]);
  assert.deepEqual(capture.decisionContexts.map((context) => context.forcedContributionPerPlayerBb), [0.1, 0.1, 0.1, 0.1]);
});

test('unsupported rake modes normalize to Home accounting', () => {
  assert.deepEqual(qa.strategyAccountingContext('percent', 9), {
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  });
});

test('legacy flatDrop remains separate from ClubGG and does not mutate its total', () => {
  const before = qa.strategyAccountingContext('fixed', 9, 0);
  qa.postflopWithDrop(1);
  const after = qa.strategyAccountingContext('fixed', 9, 0);
  assert.deepEqual(after, before);
  assert.equal(after.totalForcedContributionBb, 0.9);
});

test('position and unopened semantics remain unchanged in a ClubGG context', async () => {
  const capture = await qa.captureContext({ players: 10, heroPos: 'UTG+2', rakeMode: 'fixed', lastAction: 'unopened', facingSize: 12 });
  assert.equal(capture.decisionContext.heroPosition, 'UTG+2');
  assert.equal(capture.decisionContext.facingSizeBb, 0);
  assert.deepEqual(
    qa.fallback('T', '8', false, true, 'UTG+2', 'unopened', 0, 1.5, 30),
    { open: 0.8109096821195613, call: 0, fold: 0.18909031788043873 },
  );
});
