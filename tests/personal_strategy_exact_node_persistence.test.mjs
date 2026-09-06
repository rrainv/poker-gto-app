import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeHand, applyChance, applyAction, createAction, getHoldemCombosForHandClass } from '../shared/poker-domain/index.js';
import { createReplayProjectionController } from '../app/src/application/replay-projection-controller.mjs';
import { createExactRangeNode, createExactIntentAction, createExactNodeIntent, exactNodeIntentHeads } from '../app/src/personal-strategy/exact-node-intent.mjs';
import { createStrategyProfileBundle, createLocalOwnerRef, createRangeObservation, createRfiCalibrationContext, updateStrategyMode, updateStrategyProfile } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyRepository, migratePersonalStrategyStore, parsePersonalStrategyExport, validatePersonalStrategyStore } from '../app/src/personal-strategy/repository.mjs';
import { createMemoryPersonalStrategyDatabase, PERSONAL_STRATEGY_OBJECT_STORES as STORES } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createQualitativeEvidence } from '../app/src/personal-strategy/qualitative-evidence.mjs';

const T0 = '2026-09-05T08:00:00.000Z', T1 = '2026-09-05T09:00:00.000Z';
const ownerRef = createLocalOwnerRef('device-guest:exact-node');
const scope = { profileId: 'setup', modeId: 'approach' };
const repositoryFor = (database, owner = ownerRef) => createPersonalStrategyRepository({ database, ownerRef: owner, clock: () => T1 });
async function configured() {
  const database = createMemoryPersonalStrategyDatabase(), repository = repositoryFor(database);
  await repository.saveProfileBundle(createStrategyProfileBundle({ profileId: scope.profileId, ownerRef, displayName: 'My game',
    modes: ['My plan'], modeIds: [scope.modeId], createdAt: T0 }));
  return { database, repository };
}
function nodeFixture(flop = false) {
  let state = initializeHand({ handId: 'exact-intent-hand', buttonSeat: 0,
    game: { mode: 'home', smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 10, ante: { type: 'none', amountMilliBb: 0 } },
    players: [{ playerId: 'Hero', seat: 0, startingStackMilliBb: 100000 }, { playerId: 'BB', seat: 1, startingStackMilliBb: 100000 }] });
  const replay = createReplayProjectionController();
  const record = operation => replay.recordTransition({ state, heroPlayerId: 'Hero', operation });
  replay.replaceHand({ state, heroPlayerId: 'Hero', operation: 'initialize_hand' });
  state = applyChance(state, { type: 'deal_hole', cardsByPlayer: {}, hiddenPlayerIds: ['Hero', 'BB'] }); record('deal_hole_observed');
  if (flop) {
    state = applyAction(state, createAction('Hero', 'raise', 2500)); record('action');
    state = applyAction(state, createAction('BB', 'call')); record('action');
    state = applyChance(state, { type: 'deal_flop', cards: ['Qs', '8c', '4h'] }); record('deal_board');
    state = applyAction(state, createAction('BB', 'check')); record('action');
  }
  return createExactRangeNode({ replaySource: replay.createCanonicalHandReplaySource() });
}
const preflop = nodeFixture();
const intent = (overrides = {}) => createExactNodeIntent({ id: 'exact-1', ...scope, approachVersion: 1, setupVersion: 1,
  node: preflop, subject: { kind: 'hand_class', handClass: 'AA' }, precision: 'exact',
  distribution: [{ action: createExactIntentAction(preflop, 'raise', 2500), probability: 0.75 },
    { action: createExactIntentAction(preflop, 'fold'), probability: 0.25 }], createdAt: T0,
  provenance: { source: 'user_intent', surface: 'teach_through_hand' }, ...overrides });

test('exact-size intent survives reload and lossless selected-profile export/import with ownership isolation', async () => {
  const { database, repository } = await configured(); const original = intent();
  await repository.appendExactNodeIntent(original, { expectedHeadIds: [] });
  assert.deepEqual(await repositoryFor(database).loadExactNodeIntents(scope), [original]);
  assert.deepEqual((await repository.loadWorkspaceSnapshot()).exactNodeIntents, [original]);
  assert.deepEqual((await repository.loadApproachHistory(scope)).exactNodeIntents, [original]);
  const portable = await repository.exportPortable({ profileIds: ['setup'] });
  assert.equal(portable.schemaVersion, 'personal-strategy-export/v3');
  assert.deepEqual(parsePersonalStrategyExport(JSON.stringify(portable)).exactNodeIntents, [original]);
  const account = createLocalOwnerRef('account:exact-node'), target = repositoryFor(createMemoryPersonalStrategyDatabase(), account);
  await assert.rejects(target.importPortable(portable, { ownerPolicy: 'require_match' }), /owner/);
  await target.importPortable(portable);
  const imported = await target.loadSnapshot();
  assert.deepEqual(imported.exactNodeIntents, [original]);
  assert.deepEqual(imported.profiles[0].ownerRef, account);
  await assert.rejects(repositoryFor(database, account).loadSnapshot(), /different owner/);
  assert.deepEqual((await repository.loadSnapshot()).exactNodeIntents, [original]);
});

test('immutable corrections are atomic, current-head fenced and fork independently', async () => {
  const { database, repository } = await configured(); const original = intent();
  await repository.appendExactNodeIntent(original);
  const correction = intent({ id: 'exact-2', createdAt: T1, supersedesEvidenceIds: [original.id], precision: 'dominant',
    distribution: null, preferredAction: createExactIntentAction(preflop, 'raise', 3000) });
  database.failNextTransaction('before_commit', new Error('disk unavailable'), 'readwrite');
  await assert.rejects(repository.appendExactNodeIntent(correction), /saved/);
  assert.deepEqual(await repository.loadExactNodeIntents(scope), [original]);
  await repository.appendExactNodeIntent(correction, { expectedHeadIds: [original.id] });
  await assert.rejects(repository.appendExactNodeIntent(intent({ id: 'stale', supersedesEvidenceIds: [original.id] })), /current/);
  await assert.rejects(repository.appendExactNodeIntent(intent({ id: 'preview-stale' }), { expectedHeadIds: [] }), /changed since/);
  const history = await repositoryFor(database).loadExactNodeIntents(scope);
  assert.deepEqual(history, [original, correction]);
  assert.deepEqual(exactNodeIntentHeads(history), [correction]);
  await repository.duplicateApproach('setup', 'approach', { id: 'fork', displayName: 'Fork' });
  const copies = await repository.loadExactNodeIntents({ profileId: 'setup', modeId: 'fork' });
  assert.equal(copies.length, 2);
  assert.deepEqual(copies[1].supersedesEvidenceIds, ['fork:copy:exact-1']);
  assert.equal(copies[0].provenance.copiedFromEvidenceId, original.id);
  assert.notEqual(copies[0].fingerprint, original.fingerprint);
  assert.deepEqual(await repository.loadExactNodeIntents(scope), history);
});

test('exact flop sizes and preferred-only precision remain distinct without trajectory persistence', async () => {
  const { repository } = await configured(); const node = nodeFixture(true);
  const comboId = getHoldemCombosForHandClass('AA')[0].id;
  const record = intent({ node, subject: { kind: 'combo', comboId }, distribution: [
    { action: createExactIntentAction(node, 'bet', 1250), probability: 0.1 },
    { action: createExactIntentAction(node, 'bet', 1650), probability: 0.6 },
    { action: createExactIntentAction(node, 'bet', 3750), probability: 0.2 },
    { action: createExactIntentAction(node, 'check'), probability: 0.1 }] });
  await repository.appendExactNodeIntent(record);
  const stored = (await repository.loadExactNodeIntents({ ...scope, nodeFingerprint: node.fingerprint }))[0];
  assert.deepEqual(stored, record);
  assert.deepEqual(stored.distribution.filter(entry => entry.action.action.type === 'bet').map(entry => entry.action.amountMilliBb).sort((a,b) => a-b), [1250, 1650, 3750]);
  assert.ok(stored.decisionContext);
  const snapshot = await repository.loadSnapshot();
  assert.equal(snapshot.rangeObservations.length, 0);
  assert.equal(snapshot.trajectoryNodes, undefined);
  assert.equal(snapshot.weightedRanges, undefined);
  assert.deepEqual(await repository.loadExactNodeIntents({ ...scope, nodeFingerprint: preflop.fingerprint }), []);
});

test('old evidence migrates without promoting precision and corrupt/future state fails closed', async () => {
  const { repository } = await configured();
  const context = createRfiCalibrationContext({ gameRulesId: 'legacy', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
  await repository.saveRangeObservation(createRangeObservation({ id: 'legacy-exact', ...scope, context, handClass: 'AA', createdAt: T0, dominantAction: { type: 'raise' },
    frequencies: [{ action: { type: 'raise' }, probability: 0.75 }, { action: { type: 'fold' }, probability: 0.25 }] }));
  await repository.saveRangeObservation(createRangeObservation({ id: 'legacy-preferred', ...scope, context, handClass: 'KK', createdAt: T0, dominantAction: { type: 'raise' } }));
  await repository.appendQualitativeEvidence(createQualitativeEvidence({ id: 'qualitative', ...scope, originalWording: 'I prefer caution', language: 'en',
    interpretation: { tendency: 'caution' }, confirmation: { state: 'confirmed', confirmedAt: T0 } }));
  const legacy = structuredClone(await repository.loadSnapshot()); legacy.schemaVersion = 'personal-strategy-store/v2'; delete legacy.exactNodeIntents;
  const migrated = migratePersonalStrategyStore(legacy);
  assert.deepEqual(migrated.rangeObservations, legacy.rangeObservations);
  assert.deepEqual(migrated.qualitativeEvidence, legacy.qualitativeEvidence);
  assert.deepEqual(migrated.exactNodeIntents, []);
  assert.equal(migrated.rangeObservations[1].frequencies, null);
  const legacyExport = { ...legacy, schemaVersion: 'personal-strategy-export/v2', exportedAt: T1 };
  assert.deepEqual(parsePersonalStrategyExport(legacyExport).rangeObservations, legacy.rangeObservations);
  assert.throws(() => migratePersonalStrategyStore({ ...legacy, exactNodeIntents: [intent()] }), /cannot contain/);
  assert.throws(() => migratePersonalStrategyStore({ ...legacy, qualitativeEvidence: null }), /array/);
  assert.throws(() => parsePersonalStrategyExport({ ...legacyExport, schemaVersion: 'personal-strategy-export/v99' }), /Expected/);
  assert.throws(() => validatePersonalStrategyStore({ ...migrated, exactNodeIntents: [{ ...intent(), fingerprint: 'corrupt' }] }), /fingerprint/);
});

test('existing IndexedDB v3 upgrades additively and interruption preserves its prior metadata and evidence', async () => {
  const { database, repository } = await configured();
  await repository.appendQualitativeEvidence(createQualitativeEvidence({ id: 'old-intent', ...scope, originalWording: 'I prefer caution', language: 'en',
    interpretation: { tendency: 'caution' }, confirmation: { state: 'confirmed', confirmedAt: T0 } }));
  const before = await repository.loadSnapshot();
  await database.runTransaction([STORES.METADATA], 'readwrite', async transaction => {
    const meta = await transaction.get(STORES.METADATA, 'state');
    await transaction.put(STORES.METADATA, { ...meta, backendSchemaVersion: 'personal-strategy-indexeddb/v3', databaseVersion: 3, domainSchemaVersion: 'personal-strategy-store/v2' });
  });
  database.failNextTransaction('before_commit', new Error('upgrade interrupted'), 'readwrite');
  await assert.rejects(repositoryFor(database).initialize(), /interrupted/);
  assert.equal((await database.runTransaction([STORES.METADATA], 'readonly', transaction => transaction.get(STORES.METADATA, 'state'))).databaseVersion, 3);
  const reloaded = repositoryFor(database); const migrated = await reloaded.loadSnapshot();
  assert.deepEqual(migrated.qualitativeEvidence, before.qualitativeEvidence);
  assert.deepEqual(migrated.profiles, before.profiles); assert.equal(migrated.revision, before.revision);
  assert.deepEqual(migrated.exactNodeIntents, []);
  assert.equal((await reloaded.getMigrationStatus()).exactNodeIntentMigration.from, 'personal-strategy-store/v2');
});

test('current setup and Approach versions fence new intent while historical intent remains readable', async () => {
  const { repository } = await configured(); await repository.appendExactNodeIntent(intent());
  const snapshot = await repository.loadSnapshot();
  await repository.saveMode(updateStrategyMode(snapshot.modes[0], { displayName: 'Revised' }, T1));
  await assert.rejects(repository.appendExactNodeIntent(intent({ id: 'old-mode' })), /Approach changed/);
  await repository.saveProfile(updateStrategyProfile(snapshot.profiles[0], { displayName: 'Revised setup' }, T1));
  await assert.rejects(repository.appendExactNodeIntent(intent({ id: 'old-setup', approachVersion: 2 })), /Game Setup changed/);
  assert.equal((await repository.loadExactNodeIntents(scope)).length, 1);
  await repository.appendExactNodeIntent(intent({ id: 'new-versions', approachVersion: 2, setupVersion: 2 }));
  assert.equal((await repository.loadExactNodeIntents(scope)).length, 2);
});

test('identity invalidation during an exact-node write aborts all durable changes', async () => {
  const { database, repository } = await configured(); const before = await repository.loadSnapshot();
  const controller = new AbortController();
  const lifecycleScope = { signal: controller.signal, assertCurrent() { if (controller.signal.aborted) throw new Error('Identity lifecycle scope is stale'); } };
  const interruptedDatabase = { name: database.name, runTransaction(stores, mode, operation, options) {
    return database.runTransaction(stores, mode, transaction => operation({ ...transaction, async add(store, record) {
      const result = await transaction.add(store, record);
      if (store === STORES.EXACT_NODE_INTENTS) controller.abort();
      return result;
    } }), options);
  } };
  const interrupted = createPersonalStrategyRepository({ database: interruptedDatabase, lifecycleScope, ownerRef, clock: () => T1 });
  await assert.rejects(interrupted.appendExactNodeIntent(intent()), /saved|stale/);
  assert.deepEqual(await repository.loadSnapshot(), before);
  await assert.rejects(interrupted.loadExactNodeIntents(scope), /stale/);
});

test('corrupt stored exact intent fails closed across read surfaces and export', async () => {
  const { database, repository } = await configured(); await repository.appendExactNodeIntent(intent());
  await database.runTransaction([STORES.EXACT_NODE_INTENTS], 'readwrite', transaction => transaction.put(STORES.EXACT_NODE_INTENTS, { ...intent(), fingerprint: 'broken' }));
  await assert.rejects(repository.loadSnapshot(), /fingerprint/);
  await assert.rejects(repository.loadWorkspaceSnapshot(), /fingerprint/);
  await assert.rejects(repository.loadApproachHistory(scope), /fingerprint/);
  await assert.rejects(repository.loadExactNodeIntents(scope), /fingerprint/);
  await assert.rejects(repository.exportPortable(), /fingerprint/);
});
