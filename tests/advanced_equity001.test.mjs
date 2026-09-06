import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeightedEquity as calc, prepareWeightedEquity } from '../shared/poker-domain/weighted-equity.js';
import { calculateEquity } from '../shared/poker-domain/equity.js';
import { createFullyUnknownHoldemRange, withHoldemComboOverrides } from '../shared/poker-domain/holdem-range.js';
import { holdemComboIdForCards } from '../shared/poker-domain/holdem-combos.js';
import { exploreRunouts, rangeStandingFacts, groupRunouts } from '../app/src/application/runout-explorer.mjs';
import { parseExplicitEquityRange as parse, weightedRangePlayer as ranged, calculateExploitRangeEquity,
  personalTrajectoryEquityPlayer } from '../app/src/application/weighted-equity-consumers.mjs';
import { advancedEquityCopy, weightedEquityLanguage } from '../app/src/application/advanced-equity-language.mjs';
import { createEquityController } from '../app/src/application/equity-controller.mjs';
import { createEquityWorkerMessageHandler } from '../app/src/application/equity-worker-runtime.mjs';
import { createPersonalHandBranch, createPersonalRangePrior, createExactNodeActionRange,
  conditionPersonalRangeAction, advancePersonalRangeToNode } from '../app/src/application/personal-hand-study.mjs';
import { createExactNodeIntent, createExactIntentAction } from '../app/src/personal-strategy/exact-node-intent.mjs';
import { createPersonalEquityRequest, comparePersonalRangeEquity } from '../app/src/application/weighted-equity-consumers.mjs';

const options = { yieldControl: async () => {} };
const request = (extra = {}) => ({ schemaVersion: 'weighted-equity-request/v1',
  players: [ranged('A', parse('AsAh:1 KsKh:1', 'known_zero')), ranged('B', parse('AsQd:1 JcJd:1', 'known_zero'))],
  board: ['2c', '3d', '4h', '5s', '9c'], deadCards: [], method: 'auto', seed: 37, samples: 10000, ...extra });
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('exact joint product weighting handles collisions and weighted range-vs-range totals', async () => {
  const result = await calc(request(), options);
  assert.equal(result.status, 'exact'); near(result.players[0].equity, 2 / 3);
  near(result.players.reduce((sum, p) => sum + p.equity, 0), 1);
  assert.equal(result.trials, 3); near(result.metadata.jointCompatibilityProbability, .75);
  const weighted = request(); weighted.players[1] = ranged('B', parse('AsQd:1 JcJd:0.25', 'known_zero'));
  near((await calc(weighted, options)).players[0].equity, 1 / 3);
});
test('weighted sampling converges, replays seed, and does not sequentially bias earlier players', async () => {
  const input = request({ method: 'monte_carlo', samples: 12000 });
  const a = await calc(input, options), b = await calc(input, options);
  assert.deepEqual(a, b); near(a.players[0].equity, 2 / 3, .018);
  const swapped = await calc({ ...input, players: [...input.players].reverse() }, options);
  near(swapped.players[1].equity, a.players[0].equity, .02);
});
test('unknown mass remains unknown; known-only result is partial with inspectable mass and coverage', async () => {
  const input = request(); input.players[1] = ranged('B', parse('JcJd:0.25'));
  const refusal = await calc(input, options);
  assert.equal(refusal.status, 'partial'); assert.equal(refusal.players.length, 0);
  const result = await calc({ ...input, partialPolicy: 'known_only' }, options);
  assert.equal(result.status, 'partial'); assert.equal(result.method, 'exact');
  assert.equal(result.conditionalOnKnownMass, true);
  const coverage = result.coverage[1]; near(coverage.knownMass, .25);
  assert.equal(coverage.unknownMass, null); assert.ok(coverage.unknownMassBounds[1] > 0);
  assert.equal(coverage.normalizationAvailable, false);
  assert.ok(coverage.comboCoverage < .01);
  for (const lang of ['en', 'ru', 'he']) {
    assert.equal(weightedEquityLanguage(result, lang).lines[0], advancedEquityCopy('partial', lang));
    assert.equal(weightedEquityLanguage(result, lang).envelope.claimClass, 'factual');
  }
});
test('blockers remove known and unknown mass without inventing zero; empty support is unavailable', async () => {
  const input = request({ players: [{ id: 'A', kind: 'exact', cards: ['As', 'Ah'] }, ranged('B', parse('AsQd:1 JcJd:0.25'))], partialPolicy: 'known_only' });
  const result = await calc(input, options), coverage = result.coverage[0];
  near(coverage.blockedKnownMass, 1); assert.ok(coverage.blockedUnknownCombos > 0);
  input.players[1] = ranged('B', parse('AsQd:1', 'known_zero'));
  assert.equal((await calc(input, options)).reason, 'no_positive_known_mass');
  input.players[1] = ranged('B', createFullyUnknownHoldemRange());
  assert.equal((await calc(input, options)).reason, 'no_positive_known_mass');
});
test('all unresolved combinations blocked permits mathematically complete eligible normalization', async () => {
  const range = withHoldemComboOverrides(parse('JcJd:1', 'known_zero'), [{ comboId: holdemComboIdForCards(['As', 'Qd']), state: 'unknown', provenanceId: null }]);
  const result = await calc(request({ players: [{ id: 'A', kind: 'exact', cards: ['As', 'Ah'] }, ranged('B', range)] }), options);
  assert.equal(result.status, 'exact'); assert.equal(result.coverage[0].normalizationAvailable, true);
  assert.equal(range.entries.find(entry => entry.comboId === holdemComboIdForCards(['As', 'Qd'])).state, 'unknown');
});
test('incompatible source semantics, ambiguous and invalid exact hands fail closed', async () => {
  const input = request(); input.players[0].weightSemantics = 'policy_action_weights';
  assert.equal((await calc(input, options)).status, 'incomparable');
  input.players[0] = { id: 'A', kind: 'exact', cards: null };
  assert.equal((await calc(input, options)).status, 'unavailable');
  input.players[0] = { ...input.players[1], id: 'A', cards: null };
  assert.equal((await calc(input, options)).status, 'unavailable');
  assert.throws(() => personalTrajectoryEquityPlayer({ schemaVersion: 'personal-action-family-range/v1' }));
});
test('known-hand, unknown-hand and multiway split accounting reuse canonical results', async () => {
  const input = request({ players: [{ id: 'A', kind: 'exact', cards: ['2c', '3c'] }, { id: 'B', kind: 'uniform_unknown' }, { id: 'C', kind: 'exact', cards: ['4d', '5d'] }],
    board: ['Ts', 'Js', 'Qs', 'Ks', 'As'], samples: 100 });
  const result = await calc(input, options);
  result.players.forEach(player => near(player.equity, 1 / 3));
  const legacy = { ...input, schemaVersion: 'equity-request/v1', players: input.players.map(player => ({ id: player.id, cards: player.cards ?? null })) };
  const prior = await calculateEquity(legacy, options);
  result.players.forEach((player, i) => near(player.equity, prior.players[i].equity));
});
test('exact workload is bounded; cancellation during failed tuples yields and publishes no estimate', async () => {
  const expensive = request({ board: [], method: 'exact' });
  assert.equal((await calc(expensive, options)).reason, 'exact_limit_exceeded');
  const input = request({ method: 'monte_carlo' }); input.players[1] = { ...input.players[0], id: 'B' };
  input.players[0] = ranged('A', parse('AsAh:1', 'known_zero')); input.players[1] = { ...input.players[0], id: 'B' };
  const abort = new AbortController(); let yields = 0;
  const result = await calc(input, { signal: abort.signal, batchSize: 10, yieldControl: async () => { yields++; abort.abort(); } });
  assert.equal(result.reason, 'aborted'); assert.equal(yields, 1); assert.deepEqual(result.players, []);
});
test('runout legality, normalization, card category and exact standing are calculated', async () => {
  const input = { schemaVersion: 'equity-request/v1', board: ['Jh', '8h', '7s'],
    players: [{ id: 'hero', cards: ['Th', '9h'] }, { id: 'villain', cards: ['As', 'Ad'] }], seed: 1 };
  const result = await exploreRunouts(input, { sequences: [['Qh'], ['Qh', '2c']], samples: 10 });
  assert.equal(result.rows.length, 2); assert.equal(result.rows[0].resultingHand.category, 'straight_flush');
  assert.equal(result.rows[0].completion.fromCategory, 'straight'); assert.equal(result.rows[0].completion.redraw, null); assert.equal(result.rows[0].enteredStanding, 'leading');
  assert.equal(result.rows[1].equity, 1); assert.equal(groupRunouts(result.rows, 'category').length, 1);
  for (const path of [['Th'], ['Qh', 'Qh'], ['Qh', '2c', '3c']]) assert.equal((await exploreRunouts(input, { sequences: [path] })).reason, 'illegal_runout');
});
test('range standing and runout removal retain the reference universe and partial disclosure', async () => {
  const input = request({ players: [{ id: 'A', kind: 'exact', cards: ['As', 'Ah'] }, ranged('B', parse('KsKh:1 QsQh:1'))],
    board: ['2c', '3d', '4h', '9c'], partialPolicy: 'known_only' });
  const standing = rangeStandingFacts(input); near(standing.ahead, 1); assert.equal(standing.conditionalOnKnownMass, true);
  const result = await exploreRunouts(input, { sequences: [['Ks']], samples: 10 });
  assert.equal(result.rows[0].removal[0].after.totalEligibleWeight, 1);
  assert.equal(result.rows[0].result.status, 'partial'); assert.equal(result.cardProbabilities, null);
});
test('worker dispatch and stale controller results are fenced', async () => {
  const messages = [], handle = createEquityWorkerMessageHandler({ postMessage: message => messages.push(message) });
  await handle({ type: 'equity/calculate', requestId: 'weighted', request: request() });
  assert.equal(messages.at(-1).result.status, 'exact');
  let resolve;
  const controller = createEquityController({ workerFactory: () => null, calculateInProcess: () => new Promise(done => { resolve = done; }) });
  const pending = controller.calculate(request()); controller.cancel(); resolve({ status: 'exact' });
  assert.equal((await pending).error.code, 'aborted'); controller.dispose();
});
test('explicit exploit range gives assumption-labelled factual equity, never role or action correctness', async () => {
  const result = await calculateExploitRangeEquity({ decisionContext: { schemaVersion: 'decision-context/v1', heroCards: ['As', 'Ah'], board: ['2c', '3d', '4h', '5s', '9c'] },
    action: { type: 'bet', amountBb: 5 }, range: parse('JcJd:1', 'known_zero'), semantic: 'calling',
    modelId: 'user', modelVersion: '1', evidenceRefs: ['explicit-entry'] }, options);
  assert.equal(result.result.players[0].equity, 1); assert.equal(result.roleConfirmed, false); assert.equal(result.recommendation, null);
  assert.ok(result.assumptions.includes('explicit_supplied_response_range'));
});

test('weighted probabilities, scale invariance and conditional runouts match exact enumeration', async () => {
  const input = request({ players: [{ id: 'A', kind: 'exact', cards: ['As', 'Ah'] }, ranged('B', parse('KsKh:1 JcJd:0.25', 'known_zero'))],
    board: ['2c', '3d', '4h', '9c'], deadCards: ['Ac'] });
  const exact = await calc(input, options), estimated = await calc({ ...input, method: 'monte_carlo', samples: 6000 }, options);
  near(exact.players[0].equity, estimated.players[0].equity, .025);
  input.players[1] = ranged('B', parse('KsKh:0.4 JcJd:0.1', 'known_zero'));
  near((await calc(input, options)).players[0].equity, exact.players[0].equity);
});
test('every legal river is present, blocked cards excluded, and Hero range has no single category', async () => {
  const input = request({ board: ['2c', '3d', '4h', '9c'], deadCards: ['7s'] });
  const result = await exploreRunouts(input, { samples: 10 });
  assert.equal(result.rows.length, 47);
  for (const row of result.rows) {
    assert.equal(row.resultingHand, null); assert.ok(![...input.board, ...input.deadCards].includes(row.cards[0]));
    assert.equal(Object.hasOwn(row.result, 'recipe'), false);
  }
  const abort = new AbortController();
  const cancelled = await exploreRunouts(input, { samples: 10, signal: abort.signal, onProgress: () => abort.abort() });
  assert.equal(cancelled.reason, 'aborted');
});
test('real Personal exact trajectory feeds Equity without rewriting intent or relabeling partial A/B results', async () => {
  const branch = createPersonalHandBranch(), snapshot = { profileId: 'p', modeId: 'm', setupVersion: 1, approachVersion: 1 };
  const record = createExactNodeIntent({ ...snapshot, id: 'aa', node: branch.preflopNode,
    subject: { kind: 'hand_class', handClass: 'AA' }, createdAt: '2026-09-07T00:00:00.000Z', precision: 'exact',
    distribution: [{ action: createExactIntentAction(branch.preflopNode, 'raise', 2500), probability: .75 },
      { action: createExactIntentAction(branch.preflopNode, 'fold'), probability: .25 }] });
  const prior = createPersonalRangePrior({ node: branch.preflopNode, approachSnapshot: snapshot });
  const policy = createExactNodeActionRange({ node: branch.preflopNode, action: branch.preflopAction, records: [record], approachSnapshot: snapshot });
  const trajectory = advancePersonalRangeToNode({ prior: conditionPersonalRangeAction({ prior, policy }), nextNode: branch.flopNode });
  const before = JSON.stringify(trajectory), opponent = ranged('opponent', parse('KsKh:1', 'known_zero'));
  const result = await calc(createPersonalEquityRequest({ trajectory, opponent, samples: 10 }), options);
  assert.equal(result.status, 'partial'); assert.equal(result.coverage[0].sourceRole, 'personal_intended');
  const comparison = await comparePersonalRangeEquity({ left: trajectory, right: trajectory, opponent, samples: 10 }, options);
  assert.equal(comparison.equityDelta, null); assert.equal(comparison.partialComparison, true); assert.equal(comparison.strategyRanking, null);
  assert.equal(JSON.stringify(trajectory), before);
});
