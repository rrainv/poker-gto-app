import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_RAKE_CASH_GAME_RULES_PRESET, createGameRulesSnapshot, initializeRecordedHand,
  initializeHandFromGameRulesSnapshot, initializeHand, applyChance, applyAction, createAction,
  applyRecordedSettlement, validatePokerState, validateGameRulesSnapshot,
  resolveShowdown, isChipConserved, ledgerTotals,
} from '../shared/poker-domain/index.js';

function snapshot(recorded = true) {
  return createGameRulesSnapshot({ source: { kind: 'direct' }, setup: { seatedPlayers: 2 },
    definition: { ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
      ...(recorded ? { schemaVersion: 'game-rules-definition/v2',
        recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' } } : {}),
      blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 10 } } });
}
function configuration(recorded = true) {
  return { handId: 'recorded-test', rulesSnapshot: snapshot(recorded), buttonSeat: 0,
    players: [{ playerId: 'a', seat: 0, startingStackMilliBb: 10000 },
      { playerId: 'b', seat: 1, startingStackMilliBb: 10000 }] };
}
function dealt(recorded = true) {
  const config = configuration(recorded);
  const initial = recorded ? initializeRecordedHand(config) : initializeHandFromGameRulesSnapshot(config);
  return applyChance(initial, { type: 'deal_hole', cardsByPlayer: { a: ['As', 'Ad'], b: ['Ks', 'Kd'] } });
}
function act(state, type, size = null) { return applyAction(state, createAction(state.actingPlayerId, type, size)); }
function evidence(grossPotMilliBb, rakeMilliBb, payoutsMilliBbByPlayer) {
  return { schemaVersion: 'recorded-hand-settlement/v1', grossPotMilliBb, rakeMilliBb, payoutsMilliBbByPlayer };
}
function showdown() {
  let state = act(dealt(), 'all_in');
  state = act(state, 'call');
  for (const cards of [['2c', '3h', '7d'], ['8s'], ['9c']]) {
    state = applyChance(state, { type: state.pendingChance.type, cards });
  }
  return resolveShowdown(state);
}

test('recorded rake preserves distinct gross pot, rake, net awards, refunds and exact stacks', () => {
  const gross = act(dealt(), 'fold');
  const settled = applyRecordedSettlement(gross, evidence(1000, 50, { b: 950 }));
  assert.equal(settled.schemaVersion, 'poker-state/v3');
  assert.deepEqual(settled.recordedSettlement, { ...evidence(1000, 50, { b: 950 }),
    netAwardedMilliBb: 950, grossPayoutsMilliBbByPlayer: { b: 1000 } });
  assert.equal(settled.players[1].currentStackMilliBb, 10450);
  assert.deepEqual(settled.terminal.refundsMilliBbByPlayer, { b: 500 });
  assert.equal(settled.deductionTotalMilliBb, 0);
  assert.equal(settled.players[1].totalDeductionMilliBb, 0);
  assert.ok(settled.ledger.some((entry) => entry.kind === 'recorded_rake' && entry.playerId === null));
  assert.equal(ledgerTotals(settled).potMilliBb, 0);
  assert.ok(isChipConserved(settled));
  assert.equal(validatePokerState(JSON.parse(JSON.stringify(settled))).schemaVersion, 'poker-state/v3');
  assert.equal(applyRecordedSettlement(settled, evidence(1000, 50, { b: 950 })), settled);
  assert.equal(gross.recordedSettlement, null);
  assert.equal(gross.terminal.payoutsMilliBbByPlayer.b, 1000);
});

test('showdown uses canonical evaluation and preserves gross layer entitlement', () => {
  const gross = showdown();
  const settled = applyRecordedSettlement(gross, evidence(20000, 1000, { a: 19000 }));
  assert.deepEqual(settled.terminal.payoutsMilliBbByPlayer, { a: 19000 });
  assert.deepEqual(settled.showdown.layerResults[0].payoutsMilliBbByPlayer, { a: 20000 });
  assert.ok(isChipConserved(settled));
  assert.throws(() => applyRecordedSettlement(gross, evidence(20000, 1000, { b: 19000 })), /entitlement/);
});

test('missing rake, inconsistent totals, unknown versions, and altered persisted evidence fail closed', () => {
  const gross = act(dealt(), 'fold');
  assert.throws(() => applyRecordedSettlement(gross, { schemaVersion: 'recorded-hand-settlement/v1', grossPotMilliBb: 1000, payoutsMilliBbByPlayer: { b: 1000 } }));
  assert.throws(() => applyRecordedSettlement(gross, evidence(1000, 50, { b: 960 })));
  assert.throws(() => applyRecordedSettlement(gross, evidence(900, 50, { b: 850 })));
  assert.throws(() => applyRecordedSettlement(dealt(), evidence(1000, 0, { b: 1000 })));
  const settled = applyRecordedSettlement(gross, evidence(1000, 0, { b: 1000 }));
  assert.equal(settled.recordedSettlement.rakeMilliBb, 0);
  assert.equal(settled.ledger.filter((entry) => entry.kind === 'recorded_rake').length, 0);
  assert.throws(() => applyRecordedSettlement(settled, evidence(1000, 50, { b: 950 })), /overwrite/);
  for (const mutate of [
    (state) => { state.recordedSettlement.rakeMilliBb = 10; },
    (state) => { state.recordedSettlement = null; state.players[0].currentStackMilliBb -= 10; },
    (state) => { state.recordedSettlement.grossPotMilliBb = 900; },
    (state) => { state.players[0].currentStackMilliBb += 10; state.players[1].currentStackMilliBb -= 10; },
  ]) { const copy = structuredClone(settled); mutate(copy); assert.throws(() => validatePokerState(copy)); }
});

test('historical no-rake and ClubGG semantics remain unchanged and cannot become imported', () => {
  const old = act(dealt(false), 'fold');
  assert.equal(old.schemaVersion, 'poker-state/v2');
  assert.equal(Object.hasOwn(old, 'recordedSettlement'), false);
  assert.deepEqual(old.terminal.payoutsMilliBbByPlayer, { b: 1000 });
  assert.ok(isChipConserved(old));
  assert.throws(() => applyRecordedSettlement(old, evidence(1000, 0, { b: 1000 })));
  assert.throws(() => initializeHandFromGameRulesSnapshot(configuration()));
  assert.throws(() => initializeRecordedHand(configuration(false)));
  const invalid = structuredClone(snapshot()); invalid.schemaVersion = 'game-rules-snapshot/v1';
  assert.throws(() => validateGameRulesSnapshot(invalid));
  const club = initializeHand({ buttonSeat: 0,
    game: { mode: 'clubgg', smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100,
      ante: { type: 'none', amountMilliBb: 0 } },
    players: Array.from({ length: 7 }, (_, seat) => ({ playerId: `p${seat}`, seat, startingStackMilliBb: 10000 })) });
  assert.equal(club.schemaVersion, 'poker-state/v1');
  assert.equal(club.deductionTotalMilliBb, 700);
  assert.ok(isChipConserved(club));
});

test('multiway all-in side pots preserve independent gross winners and exact net awards', () => {
  const config = configuration();
  config.players = [{ playerId: 'a', seat: 0, startingStackMilliBb: 3000 },
    { playerId: 'b', seat: 1, startingStackMilliBb: 6000 },
    { playerId: 'c', seat: 2, startingStackMilliBb: 6000 }];
  config.rulesSnapshot = createGameRulesSnapshot({ source: { kind: 'direct' },
    setup: { seatedPlayers: 3 }, definition: snapshot().definition });
  let state = applyChance(initializeRecordedHand(config), { type: 'deal_hole',
    cardsByPlayer: { a: ['As', 'Ad'], b: ['Ks', 'Kd'], c: ['Qs', 'Qd'] } });
  state = act(state, 'all_in'); state = act(state, 'all_in'); state = act(state, 'call');
  for (const cards of [['2c', '3h', '7d'], ['8s'], ['9c']]) state = applyChance(state, { type: state.pendingChance.type, cards });
  const gross = resolveShowdown(state);
  assert.deepEqual(gross.terminal.payoutsMilliBbByPlayer, { a: 9000, b: 6000 });
  const net = applyRecordedSettlement(gross, evidence(15000, 750, { a: 8550, b: 5700 }));
  assert.deepEqual(net.showdown.layerResults.map((layer) => layer.winnerPlayerIds), [['a'], ['b']]);
  assert.ok(isChipConserved(net));
  assert.throws(() => applyRecordedSettlement(gross, evidence(15000, 750, { a: 14250 })), /entitlement/);
});

test('tied showdown, explicit zero rake, unknown model, and strict v2 rules survive portable validation', () => {
  let state = act(dealt(), 'all_in'); state = act(state, 'call');
  for (const cards of [['Tc', 'Jc', 'Qc'], ['Kc'], ['Ac']]) state = applyChance(state, { type: state.pendingChance.type, cards });
  const gross = resolveShowdown(state);
  const net = applyRecordedSettlement(gross, evidence(20000, 10, { a: 9990, b: 10000 }));
  assert.deepEqual(net.recordedSettlement.grossPayoutsMilliBbByPlayer, { b: 10000, a: 10000 });
  assert.ok(isChipConserved(net));
  assert.equal(validateGameRulesSnapshot(JSON.parse(JSON.stringify(snapshot()))).definition.recordedSettlementPolicy.rakeModel, 'unknown');
  for (const mutate of [
    (definition) => { definition.recordedSettlementPolicy.rakeModel = 'five_percent'; },
    (definition) => { definition.recordedSettlementPolicy.rate = 0.05; },
    (definition) => { definition.schemaVersion = 'game-rules-definition/v1'; },
    (definition) => { definition.collectionPolicy = { type: 'percentage' }; },
  ]) {
    const definition = structuredClone(snapshot().definition); mutate(definition);
    assert.throws(() => createGameRulesSnapshot({ source: { kind: 'direct' }, setup: { seatedPlayers: 2 }, definition }));
  }
});
