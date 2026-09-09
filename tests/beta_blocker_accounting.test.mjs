import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as p from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { reconstructCanonicalHandReplaySource as replay } from '../app/src/application/canonical-hand-replay-source.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { normalizeSavedAccounting, materializeSavedSpotAccounting } from '../app/src/saved-study-objects/accounting-compatibility.mjs';
import { validateSavedStudyObject } from '../app/src/saved-study-objects/domain.mjs';
import { createSavedStudyRepository } from '../app/src/saved-study-objects/repository.mjs';
import { createMemorySavedStudyDatabase, SAVED_STUDY_OBJECT_STORES as STORES } from '../app/src/saved-study-objects/indexeddb-storage.mjs';
import { toRemoteSavedStudyObject, fromRemoteSavedStudyObject, sameRemoteSavedStudyObject, createSyncOperation } from '../app/src/sync/domain.mjs';
import { assertTrainingAccountingCompatible } from '../app/src/application/training-memory-service.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createSavedStudySyncDomainAdapter } from '../app/src/sync/saved-study-domain-adapter.mjs';

const legacy = JSON.parse(readFileSync(new URL('./fixtures/accounting-compatibility/pre-fix.json', import.meta.url)));
const clone = structuredClone;
const dryBoard = ['2c', '3d', '4h', '8s', '9c'];
function session({ stacks = [100000, 100000], ante = 'big_blind', amount = 1000,
  holes = [['As', 'Ad'], ['Ks', 'Kd'], ['Qs', 'Qd']], chip = 1 } = {}) {
  const value = createCanonicalHandSession();
  value.initialize({ handId: 'ante-edge', buttonSeat: 0,
    game: { mode: 'home', smallBlindMilliBb: 500, bigBlindMilliBb: 1000,
      chipUnitMilliBb: chip, ante: { type: ante, amountMilliBb: ante === 'none' ? 0 : amount } },
    players: stacks.map((startingStackMilliBb, seat) => ({ playerId: `P${seat}`, seat, startingStackMilliBb })) });
  value.configureHero({ heroPlayerId: 'P0' });
  value.applyChance({ type: 'deal_hole', cardsByPlayer: Object.fromEntries(stacks.map((_, i) => [`P${i}`, holes[i]])) });
  return value;
}
const act = (s, type, amount = null) => s.applyAction(p.createAction(s.getState().actingPlayerId, type, amount));
function finish(s, board = dryBoard) {
  let cursor = 0;
  for (let guard = 0; guard < 80 && !s.getState().terminal.isTerminal; guard++) {
    const state = s.getState();
    if (state.pendingChance) { const n = state.pendingChance.type === 'deal_flop' ? 3 : 1; s.applyChance({ type: state.pendingChance.type, cards: board.slice(cursor, cursor += n) }); }
    else if (state.phase === 'showdown') s.resolveShowdown();
    else act(s, p.getLegalActionSpec(state).check.available ? 'check' : 'call');
  }
  p.validatePokerState(s.getState());
  assert.equal(s.getState().terminal.isTerminal, true);
  assert.deepEqual(replay(s.createCanonicalHandReplaySource()).finalState, s.getState());
  return s.getState();
}
function money(state, stacks, awards, refunds = {}) {
  assert.deepEqual(state.players.map(player => player.currentStackMilliBb), stacks);
  assert.deepEqual(state.terminal.payoutsMilliBbByPlayer, awards);
  const actual = {};
  for (const entry of state.ledger.filter(entry => entry.kind === 'uncalled_refund')) actual[entry.playerId] = (actual[entry.playerId] || 0) + entry.amountMilliBb;
  assert.deepEqual(actual, refunds);
  assert.equal(p.isChipConserved(state), true);
}

test('HU BBA: dead ante gives 3bb, 0.5bb call, 1/6 Equity and SB102/BB98', () => {
  const s = session();
  const economics = p.deriveActorCallEconomics(s.getState(), 'P0');
  assert.equal(economics.callCommitmentMilliBb, 500);
  assert.equal(economics.actorContestablePotAfterCallMilliBb, 3000);
  assert.equal(economics.actorIneligiblePotAfterCallMilliBb, 0);
  assert.equal(economics.requiredRawEquity, 1 / 6);
  act(s, 'call'); act(s, 'check');
  assert.equal(s.getState().potMilliBb, 3000);
  money(finish(s), [102000, 98000], { P0: 3000 });
});
test('multiway BBA stays in the pot when its payer folds', () => {
  const s = session({ stacks: [100000, 100000, 100000] });
  act(s, 'raise', 3000); act(s, 'call'); act(s, 'fold');
  money(finish(s), [105000, 97000, 98000], { P0: 8000 });
});
test('short BBA is dead money; an ante-only player cannot win wager side pots', () => {
  const s = session({ stacks: [100000, 100000, 500], holes: [['Ks', 'Kd'], ['Qs', 'Qd'], ['As', 'Ad']] });
  money(finish(s), [101000, 99000, 500], { P2: 500, P0: 2000 });
});
test('BBA all-in after ante caps wagers independently and refunds only unmatched bet', () => {
  const s = session({ stacks: [10000, 5000] });
  act(s, 'all_in'); act(s, 'call');
  money(finish(s), [15000, 0], { P0: 9000 }, { P0: 6000 });
});
test('three-way BBA side pots award the short winner and deeper runner-up separately', () => {
  const s = session({ stacks: [5000, 10000, 21000] });
  act(s, 'all_in'); act(s, 'all_in'); act(s, 'call');
  money(finish(s), [16000, 10000, 10000], { P0: 16000, P1: 10000 });
});
test('ordinary per-player antes fund the main pot without changing wager refunds', () => {
  money(finish(session({ ante: 'per_player' })), [102000, 98000], { P0: 4000 });
});
test('short individual ante entitlement is capped separately from wagers', () => {
  const s = session({ stacks: [100000, 100000, 100], ante: 'per_player', holes: [['Ks', 'Kd'], ['Qs', 'Qd'], ['As', 'Ad']] });
  money(finish(s), [101800, 98000, 300], { P2: 300, P0: 3800 });
});
test('normal blinds/no ante remain unchanged', () => {
  money(finish(session({ ante: 'none' })), [101000, 99000], { P0: 2000 });
});
test('ordinary unmatched raise and stack-capped call still pay the correct seats', () => {
  const s = session({ ante: 'none', stacks: [10000, 7000] });
  act(s, 'all_in'); act(s, 'call');
  money(finish(s), [17000, 0], { P0: 14000 }, { P0: 3000 });
});
test('odd BBA combines with matching wager eligibility before tied-pot splitting', () => {
  const s = session({ amount: 1, holes: [['2h', '3h'], ['4h', '5h']] });
  money(finish(s, ['As', 'Ks', 'Qs', 'Js', 'Ts']), [100000, 100000], { P1: 1001, P0: 1000 });
});
test('ante consumes entire stack: refundable call has zero risk and tiny tie permits zero award', () => {
  const s = session({ stacks: [100000, 100], amount: 100, chip: 100, holes: [['2h', '3h'], ['4h', '5h']] });
  assert.equal(p.deriveActorCallEconomics(s.getState(), 'P0').requiredRawEquity, 0);
  money(finish(s, ['As', 'Ks', 'Qs', 'Js', 'Ts']), [100000, 100], { P1: 100, P0: 0 }, { P0: 1000 });
});

for (const key of ['bbaV1', 'bbaV2']) test(`legacy ${key} Hand repair preserves all facts and is idempotent`, () => {
  const old = legacy[key].terminal;
  assert.deepEqual(old.payload.pokerState.players.map(p => p.currentStackMilliBb), [101000, 99000]);
  const bytes = JSON.stringify(old);
  const current = normalizeSavedAccounting(old);
  validateSavedStudyObject(current);
  assert.deepEqual(current.payload.pokerState.players.map(p => p.currentStackMilliBb), [102000, 98000]);
  assert.deepEqual(current.payload.pokerState.ledger.filter(e => e.kind === 'uncalled_refund'), []);
  assert.deepEqual(current.payload.replaySource, old.payload.replaySource);
  assert.deepEqual(current.payload.pokerState.actionHistory, old.payload.pokerState.actionHistory);
  assert.deepEqual({ ...current, payload: null }, { ...old, payload: null });
  assert.deepEqual(normalizeSavedAccounting(current), current);
  assert.equal(JSON.stringify(old), bytes);
  const spot = materializeSavedSpotAccounting(legacy[key].spot, old);
  validateSavedStudyObject(spot);
  assert.equal(spot.payload.decisionContext.requiredRawEquity, 1 / 6);
  assert.equal(spot.payload.decisionContext.actorContestablePotAfterCallBb, 3);
  assert.deepEqual(materializeSavedSpotAccounting(spot, null), spot);
  assert.deepEqual(spot.annotations, legacy[key].spot.annotations);
});
test('non-ante and recorded settlement fixtures remain semantically identical', () => {
  for (const old of [legacy.noAnte.terminal, legacy.imported]) {
    assert.deepEqual(normalizeSavedAccounting(old), old);
    validateSavedStudyObject(old);
    assert.deepEqual(replay(old.payload.replaySource).finalState, old.payload.pokerState);
  }
});
test('inconsistent facts, action amounts, owner or missing lineage fail closed without mutation', () => {
  for (const change of [o => { o.payload.replaySource = null; }, o => { o.payload.pokerState.players[0].holeCards = ['Qh', 'Qd']; },
    o => { o.payload.pokerState.actionHistory[0].committedMilliBb = 600; }]) {
    const old = clone(legacy.bbaV2.terminal); change(old); const bytes = JSON.stringify(old);
    assert.throws(() => normalizeSavedAccounting(old), { code: 'historical_accounting_unavailable' });
    assert.equal(JSON.stringify(old), bytes);
  }
  const parent = clone(legacy.bbaV2.terminal); parent.ownerRef.id = 'another-owner';
  for (const source of [null, parent]) assert.throws(() => materializeSavedSpotAccounting(legacy.bbaV2.spot, source), { code: 'historical_accounting_unavailable' });
});
test('Saved repository reads/listings/export/import and sync normalize Hands without overwriting raw records', async () => {
  const database = createMemorySavedStudyDatabase();
  const ownerRef = legacy.bbaV2.terminal.ownerRef;
  const repository = createSavedStudyRepository({ database, ownerRef });
  await repository.save(normalizeSavedAccounting(legacy.bbaV2.terminal));
  await repository.save(legacy.bbaV2.spot);
  await database.runTransaction([STORES.OBJECTS], 'readwrite', async tx => {
    const record = await tx.get(STORES.OBJECTS, legacy.bbaV2.terminal.id);
    record.value = clone(legacy.bbaV2.terminal); await tx.put(STORES.OBJECTS, record);
  });
  const before = await database.runTransaction([STORES.OBJECTS], 'readonly', tx => tx.getAll(STORES.OBJECTS));
  assert.equal((await repository.getById(legacy.bbaV2.spot.id)).payload.decisionContext.requiredRawEquity, 1 / 6);
  for (const list of [await repository.listRecent(), await repository.listByKind('hand'), await repository.listForReview(), await repository.listByTag('BBA')]) {
    for (const object of list) validateSavedStudyObject(object);
  }
  const portable = await repository.exportLibrary();
  const other = createSavedStudyRepository({ database: createMemorySavedStudyDatabase(), ownerRef });
  await other.importLibrary(portable);
  assert.equal((await other.getById(legacy.bbaV2.spot.id)).payload.decisionContext.requiredRawEquity, 1 / 6);
  const after = await database.runTransaction([STORES.OBJECTS], 'readonly', tx => tx.getAll(STORES.OBJECTS));
  assert.deepEqual(after, before);
  const current = toRemoteSavedStudyObject(legacy.bbaV2.terminal);
  const oldRemote = { ...current, payload: clone(legacy.bbaV2.terminal.payload) };
  assert.equal(sameRemoteSavedStudyObject(oldRemote, current), true);
  assert.deepEqual(fromRemoteSavedStudyObject(oldRemote, ownerRef), normalizeSavedAccounting(legacy.bbaV2.terminal));
  const op = createSyncOperation({ operationId: 'old-op', identityId: 'identity', object: oldRemote, createdAt: '2026-08-01T00:00:00.000Z' });
  assert.deepEqual(op.object, current);
});
test('Training frozen answer economics fail closed; corrected ante and no-ante evidence remain usable', () => {
  for (const kind of ['generated_exercise', 'full_hand']) {
    const record = { decisionSource: { kind, heroPlayerId: 'SB' }, decisionContext: legacy.bbaV2.spot.payload.decisionContext };
    const state = replay(legacy.bbaV2.initial.payload.replaySource).finalState;
    const before = JSON.stringify(record);
    assert.throws(() => assertTrainingAccountingCompatible(record, state), { code: 'historical_accounting_incompatible' });
    assert.equal(JSON.stringify(record), before);
    const current = { ...record, decisionContext: deriveDecisionContextFromPokerState(state, 'SB') };
    assert.equal(assertTrainingAccountingCompatible(current, state), current);
  }
});

test('new canonical ante Spots carry v3 accounting without requiring a saved parent', async () => {
  const app = createSavedStudyObjectApplication({ database: createMemorySavedStudyDatabase(), ownerRef: legacy.bbaV2.terminal.ownerRef });
  const state = replay(legacy.bbaV2.initial.payload.replaySource).finalState;
  const saved = await app.saveHandDerivedSpot({ pokerState: state, heroPlayerId: 'SB' });
  assert.equal(saved.object.payload.schemaVersion, 'saved-spot-snapshot/v3');
  assert.equal((await app.getById(saved.object.id)).payload.decisionContext.requiredRawEquity, 1 / 6);
});

test('Spot-before-Hand sync arrival stays unavailable until same-owner lineage arrives', async () => {
  const database = createMemorySavedStudyDatabase();
  const repository = createSavedStudyRepository({ database, ownerRef: legacy.bbaV2.terminal.ownerRef });
  await repository.applySyncedObject(legacy.bbaV2.spot);
  const before = await repository.getById(legacy.bbaV2.spot.id, { forSync: true });
  for (const read of [() => repository.getById(before.id), () => repository.listRecent(), () => repository.listForReview()]) {
    await assert.rejects(read, { code: 'historical_accounting_unavailable' });
  }
  assert.deepEqual(await repository.getById(before.id, { forSync: true }), before);
  await repository.applySyncedObject(legacy.bbaV2.terminal);
  assert.equal((await repository.getById(before.id)).payload.decisionContext.requiredRawEquity, 1 / 6);
  assert.deepEqual(await repository.getById(before.id, { forSync: true }), before);
  const adapter = createSavedStudySyncDomainAdapter({ syncPort: { listAll() {}, getById() {}, applyRemote() {}, activate() {} } });
  const current = toRemoteSavedStudyObject(legacy.bbaV2.terminal);
  const queued = { operationId: 'already-queued', identityId: 'owner', attempts: 3,
    object: { ...current, payload: legacy.bbaV2.terminal.payload } };
  assert.deepEqual(adapter.normalizeOperation(queued), { ...queued, object: current });
  assert.deepEqual(queued.object.payload, legacy.bbaV2.terminal.payload);
});

test('recorded BBA source gross/rake/awards are immutable and disagreement fails reconciliation', () => {
  const s = createCanonicalHandSession();
  const base = legacy.bbaV2.initial.payload.pokerState;
  const rulesSnapshot = p.createGameRulesSnapshot({ source: { kind: 'direct' }, setup: { seatedPlayers: 2 },
    definition: { ...base.rulesSnapshot.definition, schemaVersion: 'game-rules-definition/v2',
      recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' } } });
  s.initializeRecordedHand({ handId: 'recorded-bba', rulesSnapshot, buttonSeat: 0,
    players: base.players.map(({ playerId, seat, startingStackMilliBb }) => ({ playerId, seat, startingStackMilliBb })) });
  s.configureHero({ heroPlayerId: 'SB' });
  s.applyChance({ type: 'deal_hole', cardsByPlayer: { SB: ['As', 'Ad'], BB: ['Ks', 'Kd'] } });
  finish(s);
  const evidence = { schemaVersion: 'recorded-hand-settlement/v1', grossPotMilliBb: 3000,
    rakeMilliBb: 100, payoutsMilliBbByPlayer: { SB: 2900 } };
  const bytes = JSON.stringify(evidence);
  s.applyRecordedSettlement(evidence);
  assert.equal(JSON.stringify(evidence), bytes);
  assert.deepEqual(s.getState().players.map(player => player.currentStackMilliBb), [101900, 98000]);
  assert.deepEqual(replay(s.createCanonicalHandReplaySource()).finalState, s.getState());
  const incompatible = clone(s.createCanonicalHandReplaySource());
  incompatible.events.at(-1).payload.evidence = { ...evidence, grossPotMilliBb: 2000, payoutsMilliBbByPlayer: { SB: 1900 } };
  const raw = JSON.stringify(incompatible);
  assert.throws(() => replay(incompatible), /gross pot/);
  assert.equal(JSON.stringify(incompatible), raw);
});
