const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const qa = require('./qa002_adapters');

const logicSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'app', 'src', 'core', 'logic.js'),
  'utf8',
);

function context(overrides = {}) {
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
    legacyRakeValue: 0,
    ...overrides,
  });
}

function assertNormalized(result) {
  assert.equal(result.schemaVersion, 'strategy-result/v1');
  assert.ok(result.actions.every((entry) => entry.probability >= 0 && entry.probability <= 1));
  if (result.actions.length) {
    const total = result.actions.reduce((sum, entry) => sum + entry.probability, 0);
    assert.ok(Math.abs(total - 1) < 1e-12, `probability total was ${total}`);
  }
}

test('StrategyResult v1 exposes the versioned schema without invented metadata', () => {
  const result = qa.createStrategyResult({
    source: 'heuristic_preflop',
    actions: [{ name: 'Raise', value: 70 }, { name: 'Fold', value: 30 }],
    recommendedLabel: 'RAISE',
    explanation: 'Known explanation',
  });

  assert.deepEqual({
    schemaVersion: result.schemaVersion,
    source: result.source,
    confidence: result.confidence,
    coverage: result.coverage,
    modelVersion: result.modelVersion,
    warnings: result.warnings,
    details: result.details,
  }, {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_preflop',
    confidence: null,
    coverage: null,
    modelVersion: null,
    warnings: [],
    details: null,
  });
  assert.deepEqual(result.actions[0], {
    action: { type: 'raise', amountBb: null, potFraction: null },
    label: 'Raise',
    probability: 0.7,
    evBb: null,
  });
});

test('controlled provenance vocabulary contains every approved current source', () => {
  assert.deepEqual(Object.values(qa.strategySources).sort(), [
    'api',
    'equity_fallback',
    'heuristic_postflop',
    'heuristic_preflop',
    'local_tree',
    'onnx_model',
    'unavailable',
  ]);
});

test('structural actions populate sizing only when the legacy source actually supplies it', () => {
  assert.deepEqual(qa.structuralAction('Open 2.5bb'), {
    type: 'raise', amountBb: 2.5, potFraction: null,
  });
  assert.deepEqual(qa.structuralAction('Bet 50% pot'), {
    type: 'bet', amountBb: null, potFraction: 0.5,
  });
  assert.deepEqual(qa.structuralAction('All-in'), {
    type: 'all_in', amountBb: null, potFraction: null,
  });
  assert.deepEqual(qa.structuralAction('Call'), {
    type: 'call', amountBb: null, potFraction: null,
  });
});

test('preflop heuristic results cover six-max Home and 10-max ClubGG inputs', () => {
  const home = qa.strategyResult(context());
  const club = qa.strategyResult(context({
    tableSize: 10,
    heroPosition: 'LJ',
    rakeMode: 'fixed',
  }));

  for (const result of [home, club]) {
    assert.equal(result.source, 'heuristic_preflop');
    assert.equal(result.confidence, null);
    assert.equal(result.coverage, null);
    assert.equal(result.modelVersion, null);
    assertNormalized(result);
  }
});

test('postflop heuristic results are explicit on flop, turn, and river', () => {
  for (const board of [
    ['2c', '7d', '9h'],
    ['2c', '7d', '9h', 'Ts'],
    ['2c', '7d', '9h', 'Ts', 'Jc'],
  ]) {
    const result = qa.strategyResult(context({ board, potBb: 10, stackBb: 30 }));
    assert.equal(result.source, 'heuristic_postflop');
    assert.equal(result.modelVersion, null);
    assert.ok(result.details);
    assertNormalized(result);
  }
});

test('local tree output adapts to structural normalized actions', () => {
  const result = qa.strategyResult(context(), {
    title: 'Fixture tree',
    positions: {
      BTN: {
        AKs: { detail: 'Raise 70% Call 30%' },
      },
    },
  });

  assert.equal(result.source, 'local_tree');
  assert.deepEqual(result.actions.map((entry) => entry.action.type), ['raise', 'call']);
  assert.equal(result.modelVersion, null);
  assertNormalized(result);
});

test('model-backed and API output have distinct provenance and known-only versions', () => {
  const strategy = { AKs: { BTN: { Open: 0.7, Call: 0.3 } } };
  const onnx = qa.strategyResult(context(), { strategy });
  const api = qa.strategyResult(context(), {
    strategy,
    strategySource: 'api',
    modelVersion: 'api-fixture-v1',
  });

  assert.equal(onnx.source, 'onnx_model');
  assert.equal(onnx.modelVersion, null);
  assert.equal(api.source, 'api');
  assert.equal(api.modelVersion, 'api-fixture-v1');
  assert.deepEqual(onnx.actions.map((entry) => entry.probability), [0.7, 0.3]);
  assertNormalized(onnx);
  assertNormalized(api);
});

test('probability normalization accepts probability, percentage, and over-total legacy units', () => {
  const fixtures = [
    [{ Open: 0.7, Call: 0.3 }, [0.7, 0.3]],
    [{ Open: 70, Call: 30 }, [0.7, 0.3]],
    [{ Open: 70, Call: 50 }, [7 / 12, 5 / 12]],
  ];

  for (const [entry, expected] of fixtures) {
    const result = qa.modelStrategyResult(entry, { source: 'onnx_model' });
    assert.deepEqual(result.actions.map((action) => action.probability), expected);
    assertNormalized(result);
  }
});

test('legacy UI adapter preserves the visible recommendation while converting to percentages', () => {
  const result = qa.modelStrategyResult(
    { Open: 0.7, Call: 0.3 },
    { source: 'onnx_model', recommendedLabel: 'OPEN 3 BB', explanation: 'Model output' },
  );
  const profile = qa.legacyProfileForStrategyResult(result);

  assert.equal(profile.best, 'OPEN 3 BB');
  assert.equal(profile.source, 'onnx_model');
  assert.deepEqual(profile.actions.map(({ name, value }) => ({ name, value })), [
    { name: 'Open', value: 70 },
    { name: 'Call', value: 30 },
  ]);
});

test('heuristic StrategyResults never receive unsupported Deep CFR labels', () => {
  const preflop = qa.strategyResult(context());
  const postflop = qa.strategyResult(context({ board: ['2c', '7d', '9h'] }));

  for (const result of [preflop, postflop]) {
    assert.doesNotMatch(JSON.stringify(result), /deep\s*cfr/i);
    assert.ok(result.source.startsWith('heuristic_'));
  }
  assert.throws(() => qa.createStrategyResult({
    source: 'DEEP CFR MODEL',
    actions: [{ name: 'Fold', value: 100 }],
  }), /Unsupported StrategyResult source/);
});

test('main Playbook path stores StrategyResult before adapting for legacy renderers', () => {
  assert.match(logicSource, /const strategyResult = actionProfile\(null, decisionContext\);/);
  assert.match(logicSource, /app\.strategyResult = strategyResult;/);
  assert.match(logicSource, /const profile = strategyResultToLegacyProfile\(strategyResult\);/);
  assert.doesNotMatch(
    logicSource.slice(logicSource.indexOf('function actionProfile('), logicSource.indexOf('function setFrequency(')),
    /source:\s*['"](?:MATH FALLBACK|MONTE CARLO|DEEP CFR MODEL|LOCAL TREE)['"]/,
  );
});
