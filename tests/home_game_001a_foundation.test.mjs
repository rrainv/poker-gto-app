import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  HOME_GAME_DATABASE_MIGRATIONS,
  HOME_GAME_OWNER_TYPES,
  HOME_GAME_PARTICIPANT_STATUS,
  HOME_GAME_SESSION_STATUS,
  HOME_GAME_TRANSACTION_TYPES,
  calculateHomeGameAccounting,
  completeHomeGameSession,
  createCorrectionTransaction,
  createHomeGameCurrency,
  createHomeGameChipSnapshot,
  createHomeGameGroup,
  createHomeGameOwnerRef,
  createHomeGameParticipant,
  createHomeGamePlayer,
  createHomeGameRepository,
  createHomeGameSession,
  createHomeGameSettlement,
  createHomeGameTransaction,
  createMemoryHomeGameDatabase,
  createSessionFromGroup,
  formatMinorUnits,
  parseMoneyToMinorUnits,
  reopenHomeGameSession,
  startHomeGameSession,
  updateHomeGameParticipant,
} from '../app/src/home-game/index.mjs';

const T0 = '2026-08-18T18:00:00.000Z';
const T1 = '2026-08-18T18:01:00.000Z';
const T2 = '2026-08-18T18:02:00.000Z';
const T3 = '2026-08-18T18:03:00.000Z';
const ILS = createHomeGameCurrency({ code: 'ILS', label: '₪', minorUnit: 2 });
const OWNER_A = createHomeGameOwnerRef('identity-account-a');
const OWNER_B = createHomeGameOwnerRef('identity-account-b');

function player(id, ownerRef = OWNER_A, displayName = id) {
  return createHomeGamePlayer({ playerId: id, ownerRef, displayName, createdAt: T0 });
}

function session({ id = 'session-1', ownerRef = OWNER_A, playerIds = ['a', 'b'], status = 'draft' } = {}) {
  const draft = createHomeGameSession({
    sessionId: id,
    ownerRef,
    title: 'Friday Game',
    currency: ILS,
    participants: playerIds.map((playerId, index) => createHomeGameParticipant({ playerId, seatNumber: index + 1 })),
    createdAt: T0,
  });
  return status === 'active' ? startHomeGameSession(draft, T1) : draft;
}

function transaction({ id, sessionId = 'session-1', ownerRef = OWNER_A, playerId, type, amountMinor, createdAt = T2 }) {
  return createHomeGameTransaction({
    transactionId: id,
    sessionId,
    ownerRef,
    playerId,
    type,
    amountMinor,
    createdAt,
  });
}

test('exact decimal money conversion avoids binary floating-point drift', () => {
  assert.equal(parseMoneyToMinorUnits('0.10', 2) + parseMoneyToMinorUnits('0.20', 2), 30);
  assert.equal(parseMoneyToMinorUnits('123456789.01', 2), 12_345_678_901);
  assert.equal(formatMinorUnits(-12_345, ILS), '-123.45');
  assert.throws(() => parseMoneyToMinorUnits('1.001', 2), /at most 2 decimal places/);
  assert.throws(() => parseMoneyToMinorUnits('1e3', 2), /exact decimal/);
});

test('ledger aggregates buy-in, rebuy, add-on, cash-out and participant net results', () => {
  const game = session({ status: 'active' });
  const ledger = [
    transaction({ id: 't1', playerId: 'a', type: 'buy_in', amountMinor: 10_000 }),
    transaction({ id: 't2', playerId: 'a', type: 'rebuy', amountMinor: 5_000 }),
    transaction({ id: 't3', playerId: 'a', type: 'add_on', amountMinor: 2_500 }),
    transaction({ id: 't4', playerId: 'a', type: 'cash_out', amountMinor: 21_000 }),
    transaction({ id: 't5', playerId: 'b', type: 'buy_in', amountMinor: 10_000 }),
    transaction({ id: 't6', playerId: 'b', type: 'cash_out', amountMinor: 6_500 }),
  ];
  const accounting = calculateHomeGameAccounting(game, ledger);
  assert.deepEqual(accounting.participantResults, [
    { playerId: 'a', totalInMinor: 17_500, totalOutMinor: 21_000, netMinor: 3_500 },
    { playerId: 'b', totalInMinor: 10_000, totalOutMinor: 6_500, netMinor: -3_500 },
  ]);
  assert.equal(accounting.balanced, true);
  assert.equal(accounting.balanceMinor, 0);
});

test('unbalanced accounting is explicit and blocks settlement and completion', () => {
  let game = session({ status: 'active' });
  game = updateHomeGameParticipant(game, 'a', { status: HOME_GAME_PARTICIPANT_STATUS.CASHED_OUT }, T2);
  game = updateHomeGameParticipant(game, 'b', { status: HOME_GAME_PARTICIPANT_STATUS.CASHED_OUT }, T2);
  const ledger = [
    transaction({ id: 't1', playerId: 'a', type: 'buy_in', amountMinor: 100_00 }),
    transaction({ id: 't2', playerId: 'b', type: 'buy_in', amountMinor: 100_00 }),
    transaction({ id: 't3', playerId: 'a', type: 'cash_out', amountMinor: 150_00 }),
    transaction({ id: 't4', playerId: 'b', type: 'cash_out', amountMinor: 45_00 }),
  ];
  assert.equal(calculateHomeGameAccounting(game, ledger).balanceMinor, -5_00);
  assert.throws(() => createHomeGameSettlement(game, ledger), (error) => error.code === 'unbalanced_session' && error.balanceMinor === -5_00);
  assert.throws(() => completeHomeGameSession(game, ledger, T3), /unbalanced by 500 minor units/);
});

test('four-player settlement is deterministic, conservative, and exhausts every claim', () => {
  const game = session({ playerIds: ['a', 'b', 'c', 'd'], status: 'active' });
  const ledger = [
    transaction({ id: 'i-a', playerId: 'a', type: 'buy_in', amountMinor: 500 }),
    transaction({ id: 'o-a', playerId: 'a', type: 'cash_out', amountMinor: 1_000 }),
    transaction({ id: 'i-b', playerId: 'b', type: 'buy_in', amountMinor: 500 }),
    transaction({ id: 'o-b', playerId: 'b', type: 'cash_out', amountMinor: 700 }),
    transaction({ id: 'i-c', playerId: 'c', type: 'buy_in', amountMinor: 500 }),
    transaction({ id: 'o-c', playerId: 'c', type: 'cash_out', amountMinor: 200 }),
    transaction({ id: 'i-d', playerId: 'd', type: 'buy_in', amountMinor: 500 }),
    transaction({ id: 'o-d', playerId: 'd', type: 'cash_out', amountMinor: 100 }),
  ];
  const first = createHomeGameSettlement(game, ledger);
  const second = createHomeGameSettlement(game, ledger);
  assert.deepEqual(first, second);
  assert.deepEqual(first.transfers, [
    { fromPlayerId: 'c', toPlayerId: 'a', amountMinor: 300 },
    { fromPlayerId: 'd', toPlayerId: 'a', amountMinor: 200 },
    { fromPlayerId: 'd', toPlayerId: 'b', amountMinor: 200 },
  ]);
  assert.equal(first.totalTransferredMinor, 700);
  assert.ok(first.transfers.every((entry) => entry.amountMinor > 0));
});

test('two-player settlement ignores a zero-result participant', () => {
  const game = session({ playerIds: ['a', 'b', 'c'], status: 'active' });
  const ledger = [
    transaction({ id: 'ia', playerId: 'a', type: 'buy_in', amountMinor: 100 }),
    transaction({ id: 'oa', playerId: 'a', type: 'cash_out', amountMinor: 150 }),
    transaction({ id: 'ib', playerId: 'b', type: 'buy_in', amountMinor: 100 }),
    transaction({ id: 'ob', playerId: 'b', type: 'cash_out', amountMinor: 50 }),
    transaction({ id: 'ic', playerId: 'c', type: 'buy_in', amountMinor: 100 }),
    transaction({ id: 'oc', playerId: 'c', type: 'cash_out', amountMinor: 100 }),
  ];
  assert.deepEqual(createHomeGameSettlement(game, ledger).transfers, [
    { fromPlayerId: 'b', toPlayerId: 'a', amountMinor: 50 },
  ]);
});

test('append-only correction reverses one exact prior fact and replacement remains auditable', () => {
  const game = session({ status: 'active' });
  const wrong = transaction({ id: 'wrong', playerId: 'a', type: 'buy_in', amountMinor: 1_500 });
  const correction = createCorrectionTransaction({ transactionId: 'reverse-wrong', original: wrong, createdAt: T3, note: 'Entered 15 instead of 10' });
  const replacement = transaction({ id: 'replacement', playerId: 'a', type: 'buy_in', amountMinor: 1_000, createdAt: T3 });
  const accounting = calculateHomeGameAccounting(game, [wrong, correction, replacement]);
  assert.equal(accounting.participantResults[0].totalInMinor, 1_000);
  assert.throws(() => calculateHomeGameAccounting(game, [wrong, correction, createCorrectionTransaction({ transactionId: 'twice', original: wrong, createdAt: T3 })]), /cannot be corrected twice/);
  assert.equal([wrong, correction, replacement].length, 3);
});

test('session lifecycle is draft to active to completed, and reopening is deliberate', () => {
  let game = session();
  assert.equal(game.status, HOME_GAME_SESSION_STATUS.DRAFT);
  game = startHomeGameSession(game, T1);
  game = updateHomeGameParticipant(game, 'a', { status: 'cashed_out' }, T2);
  game = updateHomeGameParticipant(game, 'b', { status: 'cashed_out' }, T2);
  const ledger = [
    transaction({ id: 'ia', playerId: 'a', type: 'buy_in', amountMinor: 100 }),
    transaction({ id: 'oa', playerId: 'a', type: 'cash_out', amountMinor: 150 }),
    transaction({ id: 'ib', playerId: 'b', type: 'buy_in', amountMinor: 100 }),
    transaction({ id: 'ob', playerId: 'b', type: 'cash_out', amountMinor: 50 }),
  ];
  game = completeHomeGameSession(game, ledger, T3);
  assert.equal(game.status, HOME_GAME_SESSION_STATUS.COMPLETED);
  assert.equal(game.endedAt, T3);
  assert.throws(() => updateHomeGameParticipant(game, 'a', { status: 'active' }, T3), /must be reopened/);
  game = reopenHomeGameSession(game, T3);
  assert.equal(game.status, HOME_GAME_SESSION_STATUS.ACTIVE);
  assert.equal(game.endedAt, null);
});

test('saved groups are ordered references and create independent session participants', () => {
  const players = [player('a'), player('b'), player('c')];
  const group = createHomeGameGroup({ groupId: 'friday', ownerRef: OWNER_A, name: 'Friday Game', playerIds: ['c', 'a'], createdAt: T0 });
  const game = createSessionFromGroup({
    sessionId: 'from-group',
    ownerRef: OWNER_A,
    group,
    players,
    currency: ILS,
    createdAt: T1,
  });
  assert.deepEqual(group.playerIds, ['c', 'a']);
  assert.deepEqual(game.participants.map((entry) => [entry.playerId, entry.seatNumber]), [['c', 1], ['a', 2]]);
  assert.equal(game.sourceGroupId, group.groupId);
});

test('repository persists and reloads account-scoped players, groups, sessions, ledger, and snapshots atomically', async () => {
  const database = createMemoryHomeGameDatabase();
  let idCounter = 0;
  let now = T0;
  const repository = createHomeGameRepository({ ownerRef: OWNER_A, database, clock: () => now, idFactory: (prefix) => `${prefix}-${++idCounter}` });
  const alice = repository.createPlayer({ displayName: 'Alice' });
  const bob = repository.createPlayer({ displayName: 'Bob' });
  await repository.savePlayer(alice);
  await repository.savePlayer(bob);
  const group = repository.createGroup({ name: 'Friday Game', playerIds: [alice.playerId, bob.playerId] });
  await repository.saveGroup(group);
  const game = await repository.createSessionFromGroup({ groupId: group.groupId, currency: ILS });
  now = T1;
  await repository.startSession(game.sessionId);
  await repository.appendTransaction(repository.createTransaction({ sessionId: game.sessionId, playerId: alice.playerId, type: 'buy_in', amountMinor: 10_000 }));
  await repository.appendTransaction(repository.createTransaction({ sessionId: game.sessionId, playerId: bob.playerId, type: 'buy_in', amountMinor: 10_000 }));
  now = T2;
  await repository.recordCashOut({ sessionId: game.sessionId, playerId: alice.playerId, amountMinor: 12_000 });
  await repository.recordCashOut({ sessionId: game.sessionId, playerId: bob.playerId, amountMinor: 8_000 });
  await repository.saveSnapshot(createHomeGameChipSnapshot({
    snapshotId: 'final-stack-alice',
    sessionId: game.sessionId,
    ownerRef: OWNER_A,
    playerId: alice.playerId,
    chipCount: 240,
    phase: 'final',
    recordedAt: T2,
  }));
  now = T3;
  await repository.completeSession(game.sessionId);
  await repository.close();

  const reloaded = createHomeGameRepository({ ownerRef: OWNER_A, database, clock: () => T3 });
  const bundle = await reloaded.getSessionBundle(game.sessionId);
  assert.equal(bundle.session.status, 'completed');
  assert.equal(bundle.transactions.length, 4);
  assert.equal(bundle.snapshots[0].chipCount, 240);
  assert.deepEqual(bundle.settlement.transfers, [{ fromPlayerId: bob.playerId, toPlayerId: alice.playerId, amountMinor: 2_000 }]);
  assert.deepEqual((await reloaded.listGroups())[0].playerIds, [alice.playerId, bob.playerId]);
  assert.ok((await reloaded.getRepositoryStatus()).revision >= 10);
});

test('account isolation is fail-closed and Guest repositories are memory-only', async () => {
  const database = createMemoryHomeGameDatabase();
  const a = createHomeGameRepository({ ownerRef: OWNER_A, database, clock: () => T0 });
  const b = createHomeGameRepository({ ownerRef: OWNER_B, database, clock: () => T0 });
  await a.savePlayer(player('player-a'));
  await b.savePlayer(player('player-b', OWNER_B));
  assert.deepEqual((await a.listPlayers()).map((entry) => entry.playerId), ['player-a']);
  assert.deepEqual((await b.listPlayers()).map((entry) => entry.playerId), ['player-b']);
  assert.equal(await b.getPlayer('player-a'), null);

  const guestOwner = createHomeGameOwnerRef('guest-runtime', HOME_GAME_OWNER_TYPES.GUEST);
  const guestMemory = createMemoryHomeGameDatabase();
  const guest = createHomeGameRepository({ ownerRef: guestOwner, database: guestMemory, clock: () => T0 });
  await guest.savePlayer(player('guest-player', guestOwner));
  assert.equal((await guest.listPlayers()).length, 1);
  const durableAdapter = { durability: 'durable', runTransaction: guestMemory.runTransaction, close: guestMemory.close };
  const forbidden = createHomeGameRepository({ ownerRef: guestOwner, database: durableAdapter, clock: () => T0 });
  await assert.rejects(forbidden.initialize(), { code: 'guest_persistence_forbidden' });
});

test('stable IDs are injected once and transaction failure does not partially mutate session state', async () => {
  const database = createMemoryHomeGameDatabase();
  let counter = 0;
  const repo = createHomeGameRepository({ ownerRef: OWNER_A, database, clock: () => T0, idFactory: (prefix) => `${prefix}-${++counter}` });
  const a = repo.createPlayer({ displayName: 'A' });
  const b = repo.createPlayer({ displayName: 'B' });
  assert.notEqual(a.playerId, b.playerId);
  await repo.savePlayer(a);
  await repo.savePlayer(b);
  const game = repo.createSession({ title: 'Atomic Game', currency: ILS, participants: [
    createHomeGameParticipant({ playerId: a.playerId }),
    createHomeGameParticipant({ playerId: b.playerId }),
  ] });
  await repo.saveSession(game);
  await repo.startSession(game.sessionId);
  const before = await repo.getSession(game.sessionId);
  database.failNextTransaction('before_commit', new Error('quota exceeded'), 'readwrite');
  await assert.rejects(repo.appendTransaction(repo.createTransaction({
    sessionId: game.sessionId,
    playerId: a.playerId,
    type: HOME_GAME_TRANSACTION_TYPES.BUY_IN,
    amountMinor: 100,
  })), { code: 'transaction_failed' });
  assert.deepEqual(await repo.getSession(game.sessionId), before);
  assert.equal((await repo.getSessionBundle(game.sessionId)).transactions.length, 0);
});

test('Home Game storage is versioned and domain source has no PokerState or StrategyProvider coupling', async () => {
  assert.deepEqual(HOME_GAME_DATABASE_MIGRATIONS.map((entry) => entry.version), [1]);
  const files = [
    '../app/src/home-game/domain.mjs',
    '../app/src/home-game/repository.mjs',
    '../app/src/home-game/indexeddb-storage.mjs',
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), 'utf8')));
  const source = sources.join('\n');
  assert.doesNotMatch(source, /PokerState|StrategyProvider|DecisionContext|SavedStudyObject|personal-strategy|document\.|window\.|querySelector|HTMLElement/);
});
