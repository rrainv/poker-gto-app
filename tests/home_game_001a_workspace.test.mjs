import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createHomeGameApplication } from '../app/src/application/home-game-service.mjs';
import { createMemoryHomeGameDatabase } from '../app/src/home-game/index.mjs';

const T0 = '2026-08-18T19:00:00.000Z';

function idFactory() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

test('Guest workspace is useful in memory and never queries persistent identity', async () => {
  let identityReads = 0;
  const app = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'guest' }) },
    identityQueries: { getActiveIdentityId: async () => { identityReads += 1; return 'should-not-read'; } },
    clock: () => T0,
    idFactory: idFactory(),
  });
  let state = await app.load();
  assert.equal(state.persistence, 'guest_memory');
  assert.equal(state.ownerId, null);
  state = await app.createSession({
    title: 'Guest Friday',
    currencyCode: 'ILS',
    currencyLabel: '₪',
    playerNames: ['Dana', 'Alex'],
    buyInMinor: 10_000,
  });
  assert.equal(identityReads, 0);
  assert.equal(state.current.session.status, 'active');
  assert.equal(state.current.transactions.length, 2);
  assert.equal(state.current.accounting.totalInMinor, 20_000);
  assert.equal(state.groups.length, 0);
  await assert.rejects(app.createSession({
    title: 'Guest saved group',
    playerNames: ['Maya', 'Noam'],
    saveGroupName: 'Should not persist',
  }), /Sign in to save/);
});

test('authenticated workspace persists per opaque Riverline identity and isolates account switches', async () => {
  const database = createMemoryHomeGameDatabase();
  let identityId = 'identity-a';
  const app = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'signed_in' }) },
    identityQueries: { getActiveIdentityId: async () => identityId },
    accountDatabase: database,
    clock: () => T0,
    idFactory: idFactory(),
  });
  let state = await app.createSession({
    title: 'Account A Game',
    currencyCode: 'USD',
    currencyLabel: '$',
    playerNames: ['A One', 'A Two'],
    buyInMinor: 5_000,
    saveGroupName: 'A Group',
  });
  assert.equal(state.persistence, 'account_local');
  assert.equal(state.ownerId, 'identity-a');
  assert.equal(state.groups.length, 1);

  identityId = 'identity-b';
  state = await app.load();
  assert.equal(state.ownerId, 'identity-b');
  assert.equal(state.players.length, 0);
  assert.equal(state.recentSessions.length, 0);

  identityId = 'identity-a';
  state = await app.load();
  assert.equal(state.current.session.title, 'Account A Game');
  assert.deepEqual(state.players.map((entry) => entry.displayName), ['A One', 'A Two']);
});

test('workspace command flow exposes truthful balance, completion, settlement, and reopen', async () => {
  const app = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'guest' }) },
    identityQueries: { getActiveIdentityId: async () => null },
    clock: () => T0,
    idFactory: idFactory(),
  });
  let state = await app.createSession({ playerNames: ['Winner', 'Loser'], buyInMinor: 10_000 });
  const [winner, loser] = state.current.session.participants;
  state = await app.cashOut({ sessionId: state.current.session.sessionId, playerId: winner.playerId, amountMinor: 12_000 });
  assert.equal(state.current.accounting.balanceMinor, -8_000);
  state = await app.cashOut({ sessionId: state.current.session.sessionId, playerId: loser.playerId, amountMinor: 7_000 });
  await assert.rejects(app.completeSession(state.current.session.sessionId), { code: 'unbalanced_session' });
  const wrongCashOut = state.current.transactions.find((entry) => entry.playerId === loser.playerId && entry.type === 'cash_out');
  state = await app.correctTransaction({
    sessionId: state.current.session.sessionId,
    transactionId: wrongCashOut.transactionId,
    replacementAmountMinor: 8_000,
    note: 'Correct final count',
  });
  state = await app.completeSession(state.current.session.sessionId);
  assert.equal(state.current.session.status, 'completed');
  assert.deepEqual(state.current.settlement.transfers, [{
    fromPlayerId: loser.playerId,
    toPlayerId: winner.playerId,
    amountMinor: 2_000,
  }]);
  state = await app.reopenSession(state.current.session.sessionId);
  assert.equal(state.current.session.status, 'active');
});

test('Home Game proof surface is top-level, responsive, accessible, localized, and ledger-driven', async () => {
  const [html, css, bootstrap, service, translations, i18n] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/home-game-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /data-mode="homegame"/);
  assert.match(html, /id="homegameMode"/);
  assert.match(html, /id="homeGameNewSessionForm"[\s\S]*?<label[\s\S]*?id="homeGamePlayerNames"/);
  assert.match(html, /id="homeGameError"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /src="src\/application\/home-game-bootstrap\.mjs"/);
  assert.match(css, /\.home-game-layout[\s\S]*?grid-template-columns/);
  assert.match(css, /@media \(max-width: 1280px\)/);
  assert.match(css, /border-inline-start|padding-inline-start/);
  assert.match(bootstrap, /parseMoneyToMinorUnits/);
  assert.match(bootstrap, /Receives \{amount\}|Owes \{amount\}/);
  assert.doesNotMatch(`${bootstrap}\n${service}`, /StrategyProvider|PokerState|DecisionContext|Equity|SavedStudyObject|personal-strategy/);
  assert.match(i18n, /riverlineHomeGameTranslations/);
  assert.match(translations, /const ru =/);
  assert.match(translations, /const he =/);
  for (const key of ['Home Game', 'New Session', 'Buy-in', 'Rebuy', 'Add-on', 'Cash out', 'Chips', 'Session balance', 'Settlement', 'Reopen']) {
    assert.ok(translations.includes(`'${key}'`), key);
  }
});
