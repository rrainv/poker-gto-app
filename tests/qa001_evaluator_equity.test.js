const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateProduction,
  evaluatePython,
  renderProductionEquityDeck,
  runProductionEquity,
} = require('./qa001_adapters');

const CATEGORY = {
  highCard: 0,
  pair: 1,
  twoPair: 2,
  trips: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  quads: 7,
  straightFlush: 8,
};

function productionPack(category, ...ranks) {
  const weights = [50625, 3375, 225, 15, 1];
  return category * 1e10 + ranks.reduce((sum, rank, index) => sum + rank * weights[index], 0);
}

function productionCategory(score) {
  return Math.floor(score / 1e10);
}

function compareNumbers(left, right) {
  return Math.sign(left - right);
}

function comparePython(left, right) {
  if (left.category !== right.category) return Math.sign(left.category - right.category);
  const length = Math.max(left.tiebreakers.length, right.tiebreakers.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left.tiebreakers[index] || 0) - (right.tiebreakers[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function player(name, cards) {
  return { name, cards };
}

function assertPercentEquitiesAreValid(capture) {
  assert.ok(capture.result, 'production equity calculation should produce a captured result');
  for (const result of capture.result) {
    assert.ok(result.win >= 0 && result.win <= 100, `${result.name} win must remain in [0,100]`);
    assert.ok(result.tie >= 0 && result.tie <= 100, `${result.name} tie must remain in [0,100]`);
    assert.ok(result.equity >= 0 && result.equity <= 100, `${result.name} equity must remain in [0,100]`);
    assert.ok(result.equity / 100 >= 0 && result.equity / 100 <= 1);
  }
  const totalEquity = capture.result.reduce((sum, result) => sum + result.equity, 0);
  assert.ok(Math.abs(totalEquity - 100) < 1e-9, `equity shares should sum to 100, got ${totalEquity}`);
  assert.ok(capture.splitRate >= 0 && capture.splitRate <= 100);
}

const productionGoldenFixtures = [
  {
    name: 'high card',
    cards: ['As', 'Kd', '9h', '7c', '3s'],
    expected: productionPack(CATEGORY.highCard, 14, 13, 9, 7, 3),
  },
  {
    name: 'pair',
    cards: ['As', 'Ad', 'Kc', 'Qd', '2s'],
    expected: productionPack(CATEGORY.pair, 14, 13, 12, 2),
  },
  {
    name: 'two pair',
    cards: ['As', 'Ad', 'Kc', 'Kd', '2s'],
    expected: productionPack(CATEGORY.twoPair, 14, 13, 2),
  },
  {
    name: 'trips',
    cards: ['Qs', 'Qh', 'Qd', 'Ac', '2s'],
    expected: productionPack(CATEGORY.trips, 12, 14, 2),
  },
  {
    name: 'straight',
    cards: ['As', 'Kd', 'Qh', 'Jc', 'Ts'],
    expected: productionPack(CATEGORY.straight, 14),
  },
  {
    name: 'wheel straight',
    cards: ['As', '2d', '3h', '4c', '5s'],
    expected: productionPack(CATEGORY.straight, 5),
  },
  {
    name: 'flush',
    cards: ['As', 'Js', '8s', '5s', '2s'],
    expected: productionPack(CATEGORY.flush, 14, 11, 8, 5, 2),
  },
  {
    name: 'full house',
    cards: ['Ts', 'Th', 'Td', '9c', '9s'],
    expected: productionPack(CATEGORY.fullHouse, 10, 9),
  },
  {
    name: 'quads',
    cards: ['8s', '8h', '8d', '8c', 'As'],
    expected: productionPack(CATEGORY.quads, 8, 14),
  },
  {
    name: 'straight flush',
    cards: ['9s', '8s', '7s', '6s', '5s'],
    expected: productionPack(CATEGORY.straightFlush, 9),
  },
  {
    name: 'board-made royal flush ignores hole cards',
    cards: ['2c', '3d', 'As', 'Ks', 'Qs', 'Js', 'Ts'],
    expected: productionPack(CATEGORY.straightFlush, 14),
  },
];

for (const fixture of productionGoldenFixtures) {
  test(`production browser evaluator golden: ${fixture.name}`, () => {
    assert.equal(evaluateProduction(fixture.cards), fixture.expected);
  });
}

test('production browser evaluator orders pair kickers', () => {
  const aceKingKicker = evaluateProduction(['As', 'Ad', 'Kc', 'Qd', '2s']);
  const aceJackKicker = evaluateProduction(['Ah', 'Ac', 'Jc', 'Td', '9s']);
  assert.ok(aceKingKicker > aceJackKicker);
});

test('production browser evaluator orders high-card kickers', () => {
  const aceKingHigh = evaluateProduction(['As', 'Kd', '9h', '7c', '3s']);
  const aceQueenHigh = evaluateProduction(['Ah', 'Qd', 'Jh', '8c', '4s']);
  assert.ok(aceKingHigh > aceQueenHigh);
});

test('production browser evaluator returns exact ties for equal five-card hands', () => {
  const first = evaluateProduction(['As', 'Kd', '9h', '7c', '3s']);
  const second = evaluateProduction(['Ah', 'Kc', '9d', '7s', '3h']);
  assert.equal(first, second);
});

test('production browser evaluator returns exact ties for a board-made hand', () => {
  const first = evaluateProduction(['2c', '3d', 'As', 'Ks', 'Qs', 'Js', 'Ts']);
  const second = evaluateProduction(['4c', '5d', 'As', 'Ks', 'Qs', 'Js', 'Ts']);
  assert.equal(first, second);
});

const crossFixtures = productionGoldenFixtures.map(({ name, cards }) => ({ name, cards }));
const pythonCrossResults = evaluatePython(crossFixtures.map((fixture) => fixture.cards));

for (const [index, fixture] of crossFixtures.entries()) {
  test(`cross-implementation category fixture: ${fixture.name}`, () => {
    const productionScore = evaluateProduction(fixture.cards);
    const pythonScore = pythonCrossResults[index];
    const diagnostic = JSON.stringify({
      cards: fixture.cards,
      productionScore,
      pythonScore,
    });

    assert.equal(pythonScore.error, null, diagnostic);
    assert.equal(pythonScore.category, productionCategory(productionScore), diagnostic);
  });
}

const orderingFixtures = [
  {
    name: 'pair kicker ordering',
    stronger: ['As', 'Ad', 'Kc', 'Qd', '2s'],
    weaker: ['Ah', 'Ac', 'Jc', 'Td', '9s'],
    expected: 1,
  },
  {
    name: 'two-pair kicker ordering',
    stronger: ['As', 'Ad', 'Kc', 'Kd', 'Qs'],
    weaker: ['Ah', 'Ac', 'Kh', 'Ks', 'Js'],
    expected: 1,
  },
  {
    name: 'flush kicker ordering',
    stronger: ['As', 'Ks', '8s', '5s', '2s'],
    weaker: ['Ah', 'Qh', 'Jh', '9h', '8h'],
    expected: 1,
  },
  {
    name: 'exact tie across suits',
    stronger: ['As', 'Kd', '9h', '7c', '3s'],
    weaker: ['Ah', 'Kc', '9d', '7s', '3h'],
    expected: 0,
  },
];

const pythonOrderingResults = evaluatePython(orderingFixtures.flatMap((fixture) => [fixture.stronger, fixture.weaker]));

for (const [index, fixture] of orderingFixtures.entries()) {
  test(`cross-implementation ordering fixture: ${fixture.name}`, () => {
    const productionScores = [evaluateProduction(fixture.stronger), evaluateProduction(fixture.weaker)];
    const pythonScores = [pythonOrderingResults[index * 2], pythonOrderingResults[index * 2 + 1]];
    const diagnostic = JSON.stringify({
      stronger: fixture.stronger,
      weaker: fixture.weaker,
      productionScores,
      pythonScores,
    });

    assert.equal(compareNumbers(...productionScores), fixture.expected, diagnostic);
    assert.equal(comparePython(...pythonScores), fixture.expected, diagnostic);
  });
}

test('production equity: heads-up known river winner', async () => {
  const capture = await runProductionEquity({
    board: ['2c', '7d', '9h', 'Js', '3c'],
    dead: [],
    players: [player('Hero', ['As', 'Ad']), player('Villain', ['Kh', 'Kd'])],
  });

  assert.equal(capture.exact, true);
  assert.equal(capture.total, 1);
  assert.deepEqual(capture.result.map((entry) => entry.equity), [100, 0]);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: fully-known river uses the exact fast path even when simulation is requested', async () => {
  const capture = await runProductionEquity({
    board: ['2c', '7d', '9h', 'Js', '3c'],
    dead: [],
    players: [player('Hero', ['As', 'Ad']), player('Villain', ['Kh', 'Kd'])],
  }, { calcStyle: 'sim', trials: 128 });

  assert.equal(capture.exact, true);
  assert.equal(capture.total, 1);
  assert.deepEqual(capture.result.map((entry) => entry.equity), [100, 0]);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: three-way known river winner', async () => {
  const capture = await runProductionEquity({
    board: ['2h', '5h', '9h', 'Kc', '3d'],
    dead: [],
    players: [
      player('Hero', ['Ah', 'Qh']),
      player('Villain 1', ['9s', '9d']),
      player('Villain 2', ['Kh', 'Kd']),
    ],
  });

  assert.deepEqual(capture.result.map((entry) => entry.equity), [100, 0, 0]);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: exact heads-up board tie', async () => {
  const capture = await runProductionEquity({
    board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    dead: [],
    players: [player('Hero', ['2c', '3d']), player('Villain', ['4c', '5d'])],
  });

  assert.deepEqual(capture.result.map((entry) => entry.equity), [50, 50]);
  assert.deepEqual(capture.result.map((entry) => entry.tie), [100, 100]);
  assert.equal(capture.splitRate, 100);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: exact three-way board tie splits equally', async () => {
  const capture = await runProductionEquity({
    board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    dead: [],
    players: [
      player('Hero', ['2c', '3d']),
      player('Villain 1', ['4c', '5d']),
      player('Villain 2', ['6c', '7d']),
    ],
  });

  for (const entry of capture.result) assert.ok(Math.abs(entry.equity - (100 / 3)) < 1e-9);
  assert.deepEqual(capture.result.map((entry) => entry.tie), [100, 100, 100]);
  assert.equal(capture.splitRate, 100);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: exact turn enumeration uses every legal river', async () => {
  const capture = await runProductionEquity({
    board: ['As', 'Ks', 'Qs', 'Js'],
    dead: [],
    players: [player('Hero', ['Ts', '2c']), player('Villain', ['Th', '2d'])],
  });

  assert.equal(capture.exact, true);
  assert.equal(capture.total, 44);
  assert.deepEqual(capture.result.map((entry) => entry.equity), [100, 0]);
  assertPercentEquitiesAreValid(capture);
});

test('production equity: exact flop enumeration covers every legal turn-river pair', async () => {
  const capture = await runProductionEquity({
    board: ['As', 'Ks', 'Qs'],
    dead: [],
    players: [player('Hero', ['Js', 'Ts']), player('Villain', ['Ah', 'Ad'])],
  });

  assert.equal(capture.exact, true);
  assert.equal(capture.total, 990);
  assert.deepEqual(capture.result.map((entry) => entry.equity), [100, 0]);
  assertPercentEquitiesAreValid(capture);
});

test('production card picker marks already-used equity cards unavailable', () => {
  const state = {
    board: ['2c', '7d', '9h'],
    dead: ['Js'],
    players: [player('Hero', ['As', 'Ad']), player('Villain', [])],
  };
  const html = renderProductionEquityDeck(state, { group: 'player-1', index: 0 });

  assert.match(html, /data-deck-card="As" disabled/);
  assert.match(html, /data-deck-card="2c" disabled/);
  assert.match(html, /data-deck-card="Js" disabled/);
  assert.match(html, /data-deck-card="Kh" >/);
});

test('canonical production equity rejects duplicate physical cards structurally', async () => {
  const capture = await runProductionEquity({
    board: ['2c', '7d', '9h', 'Js', '3c'],
    dead: [],
    players: [player('Hero', ['As', 'Ad']), player('Villain', ['As', 'Kd'])],
  });

  assert.equal(capture.result, null);
  assert.equal(capture.error.code, 'duplicate_card');
});
