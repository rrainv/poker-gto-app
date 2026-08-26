import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createHomeGameApplication } from '../app/src/application/home-game-service.mjs';
import {
  HOME_GAME_OWNER_TYPES,
  HOME_GAME_OBJECT_STORES,
  HOME_GAME_SESSION_EXPORT_SCHEMA_VERSION,
  createCorrectionTransaction,
  createHomeGameCurrency,
  createHomeGameOwnerRef,
  createHomeGameParticipant,
  createHomeGameRepository,
  createMemoryHomeGameDatabase,
} from '../app/src/home-game/index.mjs';

const T0 = '2026-08-20T18:00:00.000Z';
const T1 = '2026-08-20T18:01:00.000Z';
const T2 = '2026-08-20T18:02:00.000Z';
const T3 = '2026-08-20T18:03:00.000Z';
const OWNER = createHomeGameOwnerRef('identity-home-game-001b');
const ILS = createHomeGameCurrency({ code: 'ILS', label: '₪', minorUnit: 2 });

function ids() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

async function seededRepository() {
  let now = T0;
  const database = createMemoryHomeGameDatabase();
  const repository = createHomeGameRepository({ ownerRef: OWNER, database, clock: () => now, idFactory: ids() });
  const a = repository.createPlayer({ displayName: 'Alice', nickname: 'A' });
  const b = repository.createPlayer({ displayName: 'Bob' });
  const c = repository.createPlayer({ displayName: 'Cara' });
  await repository.savePlayer(a);
  await repository.savePlayer(b);
  await repository.savePlayer(c);
  return { repository, database, players: { a, b, c }, setNow: (value) => { now = value; } };
}

test('player edits and archive/restore keep stable IDs and historical references', async () => {
  const { repository, players, setNow } = await seededRepository();
  const group = repository.createGroup({ name: 'Original group', playerIds: [players.a.playerId, players.b.playerId] });
  await repository.saveGroup(group);
  const session = await repository.createSessionFromGroup({ groupId: group.groupId, currency: ILS });

  setNow(T1);
  const edited = (await repository.updatePlayer(players.a.playerId, { displayName: 'Alice Cooper', nickname: 'Ace', notes: 'Prefers seat 3' })).record;
  assert.equal(edited.playerId, players.a.playerId);
  assert.equal(edited.revision, players.a.revision + 1);
  assert.deepEqual((await repository.getSession(session.sessionId)).participants.map((entry) => entry.playerId), [players.a.playerId, players.b.playerId]);
  assert.deepEqual((await repository.getGroup(group.groupId)).playerIds, [players.a.playerId, players.b.playerId]);

  setNow(T2);
  await repository.updatePlayer(players.a.playerId, { archived: true });
  assert.equal((await repository.getPlayer(players.a.playerId)).archived, true);
  assert.equal((await repository.listPlayers()).some((entry) => entry.playerId === players.a.playerId), false);
  assert.equal((await repository.listPlayers({ includeArchived: true })).some((entry) => entry.playerId === players.a.playerId), true);
  await repository.updatePlayer(players.a.playerId, { archived: false });
  assert.equal((await repository.getPlayer(players.a.playerId)).archived, false);
});

test('groups rename, reorder, archive, and retain player-reference integrity', async () => {
  const { repository, players, setNow } = await seededRepository();
  const group = repository.createGroup({ name: 'Friday', playerIds: [players.a.playerId, players.b.playerId, players.c.playerId] });
  await repository.saveGroup(group);
  setNow(T1);
  const edited = (await repository.updateGroup(group.groupId, { name: 'Saturday', playerIds: [players.c.playerId, players.a.playerId] })).record;
  assert.equal(edited.groupId, group.groupId);
  assert.deepEqual(edited.playerIds, [players.c.playerId, players.a.playerId]);
  const session = await repository.createSessionFromGroup({ groupId: group.groupId, currency: ILS });
  assert.deepEqual(session.participants.map((entry) => [entry.playerId, entry.seatNumber]), [[players.c.playerId, 1], [players.a.playerId, 2]]);

  setNow(T2);
  await repository.updateGroup(group.groupId, { archived: true });
  assert.equal((await repository.listGroups()).length, 0);
  await assert.rejects(repository.createSessionFromGroup({ groupId: group.groupId, currency: ILS }), /Restore this group/);
  await repository.updateGroup(group.groupId, { archived: false });
  await repository.updatePlayer(players.c.playerId, { archived: true });
  await assert.rejects(repository.createSessionFromGroup({ groupId: group.groupId, currency: ILS }), /Restore archived group players/);
  await assert.rejects(repository.updateGroup(group.groupId, { playerIds: ['foreign-or-missing'] }), /missing player/);
});

test('additive 001B fields normalize legacy v1 records without an IndexedDB store migration', async () => {
  const { repository, database, players } = await seededRepository();
  const group = repository.createGroup({ name: 'Legacy group', playerIds: [players.a.playerId, players.b.playerId] });
  await repository.saveGroup(group);
  const session = repository.createSession({ title: 'Legacy session', currency: ILS, participants: [
    createHomeGameParticipant({ playerId: players.a.playerId }),
    createHomeGameParticipant({ playerId: players.b.playerId }),
  ] });
  await repository.saveSession(session);
  await database.runTransaction([HOME_GAME_OBJECT_STORES.GROUPS, HOME_GAME_OBJECT_STORES.SESSIONS], 'readwrite', async (storage) => {
    const legacyGroup = { ...group };
    delete legacyGroup.archived;
    const legacySession = { ...session };
    delete legacySession.archived;
    delete legacySession.lifecycleEvents;
    await storage.put(HOME_GAME_OBJECT_STORES.GROUPS, legacyGroup);
    await storage.put(HOME_GAME_OBJECT_STORES.SESSIONS, legacySession);
  });
  assert.equal((await repository.getGroup(group.groupId)).archived, false);
  const normalized = await repository.getSession(session.sessionId);
  assert.equal(normalized.archived, false);
  assert.deepEqual(normalized.lifecycleEvents.map((entry) => entry.type), ['created']);
});

test('correction and replacement append atomically and produce an explicit visible relation', async () => {
  const { repository, database, players, setNow } = await seededRepository();
  const draft = repository.createSession({ title: 'Corrections', currency: ILS, participants: [
    createHomeGameParticipant({ playerId: players.a.playerId, seatNumber: 1 }),
    createHomeGameParticipant({ playerId: players.b.playerId, seatNumber: 2 }),
  ] });
  await repository.saveSession(draft);
  await repository.startSession(draft.sessionId);
  const wrong = repository.createTransaction({ sessionId: draft.sessionId, playerId: players.a.playerId, type: 'buy_in', amountMinor: 500 });
  await repository.appendTransaction(wrong);
  setNow(T1);
  const correction = createCorrectionTransaction({ transactionId: 'correction-1', original: wrong, createdAt: T1, note: 'Entered 500 instead of 600' });
  const replacement = repository.createTransaction({ sessionId: draft.sessionId, playerId: players.a.playerId, type: 'buy_in', amountMinor: 600, replacementOfTransactionId: wrong.transactionId });
  await repository.appendCorrection({ correction, replacement });
  const bundle = await repository.getSessionBundle(draft.sessionId);
  assert.equal(bundle.transactions.length, 3);
  assert.equal(bundle.accounting.participantResults[0].totalInMinor, 600);
  assert.deepEqual(bundle.ledgerHistory.items.map((item) => ({
    original: item.original.transactionId,
    corrected: item.corrected,
    correction: item.correction?.transactionId,
    replacement: item.replacement?.transactionId,
  })), [{ original: wrong.transactionId, corrected: true, correction: 'correction-1', replacement: replacement.transactionId }]);

  const secondWrong = repository.createTransaction({ sessionId: draft.sessionId, playerId: players.b.playerId, type: 'buy_in', amountMinor: 400 });
  await repository.appendTransaction(secondWrong);
  const before = await repository.getSessionBundle(draft.sessionId);
  setNow(T2);
  database.failNextTransaction('before_commit', new Error('injected'), 'readwrite');
  await assert.rejects(repository.appendCorrection({
    correction: createCorrectionTransaction({ transactionId: 'correction-fails', original: secondWrong, createdAt: T2 }),
    replacement: repository.createTransaction({ sessionId: draft.sessionId, playerId: players.b.playerId, type: 'buy_in', amountMinor: 450, replacementOfTransactionId: secondWrong.transactionId }),
  }), { code: 'transaction_failed' });
  assert.deepEqual(await repository.getSessionBundle(draft.sessionId), before);
});

test('completed, reopened, recompleted, archived, and restored lifecycle is inspectable without duplicated ledger entries', async () => {
  const { repository, players, setNow } = await seededRepository();
  const draft = repository.createSession({ title: 'Lifecycle', currency: ILS, participants: [
    createHomeGameParticipant({ playerId: players.a.playerId, seatNumber: 1 }),
    createHomeGameParticipant({ playerId: players.b.playerId, seatNumber: 2 }),
  ] });
  await repository.saveSession(draft);
  await repository.startSession(draft.sessionId);
  await repository.appendTransaction(repository.createTransaction({ sessionId: draft.sessionId, playerId: players.a.playerId, type: 'buy_in', amountMinor: 100 }));
  await repository.appendTransaction(repository.createTransaction({ sessionId: draft.sessionId, playerId: players.b.playerId, type: 'buy_in', amountMinor: 100 }));
  await repository.recordCashOut({ sessionId: draft.sessionId, playerId: players.a.playerId, amountMinor: 120 });
  await repository.recordCashOut({ sessionId: draft.sessionId, playerId: players.b.playerId, amountMinor: 80 });
  setNow(T1);
  await repository.completeSession(draft.sessionId);
  const count = (await repository.getSessionBundle(draft.sessionId)).transactions.length;
  setNow(T2);
  await repository.reopenSession(draft.sessionId);
  assert.equal((await repository.getSessionBundle(draft.sessionId)).transactions.length, count);
  setNow(T3);
  await repository.completeSession(draft.sessionId);
  await repository.setSessionArchived(draft.sessionId, true);
  let bundle = await repository.getSessionBundle(draft.sessionId);
  assert.equal(bundle.session.archived, true);
  assert.deepEqual(bundle.session.lifecycleEvents.map((entry) => entry.type), ['created', 'started', 'completed', 'reopened', 'completed', 'archived']);
  await assert.rejects(repository.reopenSession(draft.sessionId), /Restore an archived session/);
  await repository.setSessionArchived(draft.sessionId, false);
  bundle = await repository.getSessionBundle(draft.sessionId);
  assert.equal(bundle.session.archived, false);
  assert.equal(bundle.session.lifecycleEvents.at(-1).type, 'restored');
});

test('account export uses the canonical v1 envelope while import and Guest durable libraries stay unavailable', async () => {
  const database = createMemoryHomeGameDatabase();
  const auth = { status: 'signed_in' };
  const application = createHomeGameApplication({
    authQueries: { getState: () => auth },
    identityQueries: { getActiveIdentityId: async () => 'identity-export' },
    accountDatabase: database,
    clock: () => T0,
    idFactory: ids(),
  });
  await application.createPlayer({ displayName: 'One' });
  let state = await application.createPlayer({ displayName: 'Two' });
  state = await application.createSession({
    title: 'Exportable',
    currencyCode: 'ILS', currencyLabel: '₪',
    roster: state.availablePlayers.map((player) => ({ playerId: player.playerId })),
    buyInMinor: 1_000,
    blinds: { smallBlindMinor: 100, bigBlindMinor: 200, anteMinor: 0 },
  });
  const envelope = await application.exportSession(state.current.session.sessionId);
  assert.equal(envelope.schemaVersion, HOME_GAME_SESSION_EXPORT_SCHEMA_VERSION);
  assert.equal(envelope.session.blinds.bigBlindMinor, 200);
  assert.equal(envelope.transactions.length, 2);
  assert.equal('importSession' in application, false);

  auth.status = 'guest';
  await assert.rejects(application.createPlayer({ displayName: 'Guest durable player' }), /Sign in to manage/);
  await assert.rejects(application.exportSession(state.current.session.sessionId), /Sign in to manage/);
});

test('001B UI is progressive, dialog-safe, localized, RTL-aware, and does not add a second accounting authority', async () => {
  const [html, css, bootstrap, service, translations] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/home-game-translations.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<details class="panel home-game-library home-game-management">/);
  assert.match(html, /id="homeGameEditorDialog"[^>]*aria-labelledby=/);
  assert.match(html, /id="homeGameConfirmDialog"[^>]*aria-labelledby=/);
  assert.match(html, /id="homeGameRoster"[^>]*role="list"/);
  assert.match(html, /id="homeGameShowArchivedSessions"/);
  assert.match(bootstrap, /if \(busy\) return/);
  assert.match(bootstrap, /replacementOfTransactionId|ledgerHistory/);
  assert.match(css, /border-inline-start/);
  assert.match(css, /\.home-game-money[\s\S]*?font-variant-numeric/);
  for (const key of ['Player Library', 'Archive session', 'Ledger history', 'Correct entry', 'Reopen session?', 'Export JSON']) {
    assert.ok(translations.includes(`'${key}'`), key);
  }
  assert.doesNotMatch(`${bootstrap}\n${service}`, /calculateHomeGameAccounting|createHomeGameSettlement|totalInMinor\s*[+\-]=/);
  assert.equal(HOME_GAME_OWNER_TYPES.GUEST, 'guest_session');
});
