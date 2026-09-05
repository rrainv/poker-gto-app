import test from 'node:test';
import assert from 'node:assert/strict';
import { createStrategyProfileBundle, createLocalOwnerRef, createRangeObservation,
  createRfiCalibrationContext, updateStrategyMode, updateStrategyProfile } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyRepository, migratePersonalStrategyStore,
  parsePersonalStrategyExport } from '../app/src/personal-strategy/repository.mjs';
import { createMemoryPersonalStrategyDatabase, PERSONAL_STRATEGY_OBJECT_STORES as STORES } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createQualitativeEvidence, qualitativeEvidenceHeads } from '../app/src/personal-strategy/qualitative-evidence.mjs';

const T0 = '2026-09-05T08:00:00.000Z';
const T1 = '2026-09-05T09:00:00.000Z';
const ownerRef = createLocalOwnerRef('device-guest:intelligence');
const makeRepo = (database, owner = ownerRef) => createPersonalStrategyRepository({ database, ownerRef: owner, clock: () => T1 });
function bundle(count = 1) {
  return createStrategyProfileBundle({ profileId: 'setup', ownerRef, displayName: 'Private deep heads-up',
    setupAssumptions: { stack: '200bb', rake: 'unknown', environment: 'user stated' },
    modes: Array.from({ length: count }, (_, i) => `My approach ${i}`),
    modeIds: Array.from({ length: count }, (_, i) => `approach-${i}`), createdAt: T0 });
}
const evidence = (overrides = {}) => createQualitativeEvidence({ id: 'intent-1', profileId: 'setup', modeId: 'approach-0',
  originalWording: "I don't like weak offsuit hands", language: 'en', interpretation: { tendency: 'less preferred' },
  unresolvedTerms: ['weak', 'exact hand boundary', 'frequency'], statedScope: { position: 'BTN' },
  confirmation: { state: 'confirmed', confirmedAt: T0 }, ...overrides });
async function configured() {
  const database = createMemoryPersonalStrategyDatabase(); const repository = makeRepo(database);
  await repository.saveProfileBundle(bundle()); return { database, repository };
}

test('arbitrary named setups and more than three independently named Approaches survive reload', async () => {
  const { database, repository } = await configured();
  for (let i = 1; i < 6; i += 1) await repository.addApproach('setup', { id: `approach-${i}`, displayName: `Versus player ${i}` });
  const reloaded = await makeRepo(database).loadSnapshot();
  assert.equal(reloaded.modes.length, 6);
  assert.equal(reloaded.profiles[0].displayName, 'Private deep heads-up');
  assert.equal(reloaded.profiles[0].setupAssumptions.rake, 'unknown');
  assert.equal(reloaded.profiles[0].modeIds.length, 6);
  assert.equal(reloaded.profiles[0].versionHistory.length, 5);
});

test('only confirmed intent persists; qualitative tendency never supplies an action or frequency', async () => {
  const { repository } = await configured();
  assert.throws(() => evidence({ confirmation: { state: 'provisional', confirmedAt: T0 } }), /confirmed/);
  assert.throws(() => evidence({ provenance: { source: 'observed_hero' } }), /user-intent/);
  await repository.appendQualitativeEvidence(evidence(), { expectedHeadIds: [] });
  const [stored] = await repository.loadQualitativeEvidence({ profileId: 'setup', modeId: 'approach-0' });
  assert.equal(stored.originalWording, "I don't like weak offsuit hands");
  assert.equal(stored.explicitFrequencies, undefined);
  assert.equal(stored.dominantAction, undefined);
  assert.equal((await repository.loadSnapshot()).rangeObservations.length, 0);
});

test('grouped corrections are atomic, preserve history, reject stale previews and restore corrected heads after reload', async () => {
  const { repository, database } = await configured();
  await repository.appendQualitativeEvidence(evidence());
  const correction = evidence({ id: 'intent-2', originalWording: 'Only against a large open', createdAt: T1,
    supersedesEvidenceIds: ['intent-1'], correctionGroupId: 'correction-1' });
  database.failNextTransaction('before_commit', new Error('disk unavailable'), 'readwrite');
  await assert.rejects(repository.appendQualitativeEvidence(correction, { expectedHeadIds: ['intent-1'] }), /saved/);
  assert.equal((await repository.loadQualitativeEvidence({ profileId: 'setup', modeId: 'approach-0' })).length, 1);
  await repository.appendQualitativeEvidence(correction, { expectedHeadIds: ['intent-1'] });
  await assert.rejects(repository.appendQualitativeEvidence(evidence({ id: 'stale', supersedesEvidenceIds: ['intent-1'], correctionGroupId: 'stale-group' })), /current/);
  const history = await makeRepo(database).loadQualitativeEvidence({ profileId: 'setup', modeId: 'approach-0' });
  assert.equal(history.length, 2);
  assert.deepEqual(qualitativeEvidenceHeads(history).map((record) => record.id), ['intent-2']);
  assert.equal(history[0].originalWording, "I don't like weak offsuit hands");
});

test('fork freezes exact/dominant and qualitative histories with independent subsequent corrections', async () => {
  const { repository } = await configured();
  await repository.appendQualitativeEvidence(evidence());
  await repository.saveRangeObservation(createRangeObservation({ id: 'direct-1', profileId: 'setup', modeId: 'approach-0',
    context: createRfiCalibrationContext({ gameRulesId: 'rules/v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 }),
    handClass: 'A5s', dominantAction: { type: 'raise' }, createdAt: T0 }));
  const fork = await repository.duplicateApproach('setup', 'approach-0', { id: 'fork', displayName: 'Independent experiment' });
  assert.deepEqual([...fork.forkProvenance.sourceEvidenceIds].sort(), ['direct-1', 'intent-1']);
  await repository.appendQualitativeEvidence(evidence({ id: 'intent-2', supersedesEvidenceIds: ['intent-1'], correctionGroupId: 'correction', createdAt: T1 }));
  const history = await repository.loadApproachHistory({ profileId: 'setup', modeId: 'fork' });
  assert.equal(history.qualitativeEvidence.length, 1);
  assert.equal(history.rangeObservations[0].frequencies, null);
  assert.equal(history.rangeObservations[0].provenance.copiedFromEvidenceId, 'direct-1');
  assert.equal(history.qualitativeEvidence[0].provenance.copiedFromEvidenceId, 'intent-1');
});

test('versioned metadata retains earlier setup assumptions and independent approach revisions', async () => {
  const { repository } = await configured();
  let snapshot = await repository.loadSnapshot();
  await repository.saveMode(updateStrategyMode(snapshot.modes[0], { displayName: 'My revised plan' }, T1));
  await repository.saveProfile(updateStrategyProfile(snapshot.profiles[0], { setupAssumptions: { stack: '100bb' } }, T1));
  snapshot = await repository.loadSnapshot();
  assert.equal(snapshot.modes[0].approachVersion, 2);
  assert.equal(snapshot.modes[0].versionHistory[0].displayName, 'My approach 0');
  assert.equal(snapshot.profiles[0].versionHistory[0].setupAssumptions.stack, '200bb');
  await assert.rejects(repository.appendQualitativeEvidence(evidence()), /changed since/);
  await assert.rejects(repository.appendQualitativeEvidence(evidence({ approachVersion: 2, statedScope: { setupVersion: 1 } })), /Game Setup changed since/);
  await assert.rejects(repository.saveMode({ ...snapshot.modes[0], displayName: 'History rewrite' }), /append/);
});

function legacyStore() {
  const current = bundle(3);
  const profile = { ...current.profile, schemaVersion: 'strategy-profile/v1' };
  delete profile.setupVersion; delete profile.setupAssumptions; delete profile.versionHistory;
  const modes = current.modes.map((mode) => {
    const legacy = { ...mode, schemaVersion: 'strategy-mode/v1' };
    delete legacy.approachVersion; delete legacy.versionHistory; delete legacy.forkProvenance; return legacy;
  });
  return { schemaVersion: 'personal-strategy-store/v1', revision: 5, ownerRef, updatedAt: T0,
    profiles: [profile], modes, rangeObservations: [], trainingObservations: [], calibrationSessions: [] };
}

test('ordered legacy migration preserves IDs/owner and old clients reject the new portable schema', async () => {
  const legacy = legacyStore();
  const direct = (id, overrides = {}) => createRangeObservation({ id, profileId: 'setup', modeId: 'approach-0',
    context: createRfiCalibrationContext({ gameRulesId: 'legacy-rules', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 }),
    handClass: 'A5s', dominantAction: { type: 'fold' }, createdAt: T0, ...overrides });
  legacy.rangeObservations = [direct('legacy-root'), direct('legacy-correction', { supersedesObservationId: 'legacy-root',
    createdAt: T1, dominantAction: { type: 'raise' } }), direct('legacy-conflicting-root', {
    frequencies: [{ action: { type: 'fold' }, probability: 0.6 }, { action: { type: 'raise' }, probability: 0.4 }] })];
  const migrated = migratePersonalStrategyStore(legacy);
  assert.deepEqual(migrated.rangeObservations, legacy.rangeObservations);
  assert.equal(migrated.schemaVersion, 'personal-strategy-store/v2');
  assert.deepEqual(migrated.profiles[0].modeIds, legacy.profiles[0].modeIds);
  assert.deepEqual(migrated.ownerRef, legacy.ownerRef);
  assert.deepEqual(migrated.qualitativeEvidence, []);
  assert.deepEqual(migratePersonalStrategyStore(migrated), migrated);
  assert.throws(() => migratePersonalStrategyStore({ ...legacy, schemaVersion: 'personal-strategy-store/v99' }), /Unsupported/);
  const importedLegacy = parsePersonalStrategyExport({ ...legacy, schemaVersion: 'personal-strategy-export/v1', exportedAt: T0 });
  assert.equal(importedLegacy.schemaVersion, 'personal-strategy-export/v2');
});

test('existing IndexedDB v2 migrates atomically and retains original records on interruption', async () => {
  const database = createMemoryPersonalStrategyDatabase(); const legacy = legacyStore();
  await database.runTransaction(Object.values(STORES), 'readwrite', async (transaction) => {
    await transaction.put(STORES.METADATA, { key: 'state', backendSchemaVersion: 'personal-strategy-indexeddb/v2',
      databaseVersion: 2, domainSchemaVersion: legacy.schemaVersion, revision: 5, ownerRef, updatedAt: T0, migration: {} });
    for (const profile of legacy.profiles) await transaction.add(STORES.PROFILES, profile);
    for (const mode of legacy.modes) await transaction.add(STORES.MODES, mode);
  });
  database.failNextTransaction('before_commit', new Error('interrupted upgrade'), 'readwrite');
  await assert.rejects(makeRepo(database).initialize(), /interrupted/);
  const preserved = await database.runTransaction([STORES.PROFILES], 'readonly', (transaction) => transaction.get(STORES.PROFILES, 'setup'));
  assert.equal(preserved.schemaVersion, 'strategy-profile/v1');
  const repo = makeRepo(database); const snapshot = await repo.loadSnapshot();
  assert.equal(snapshot.profiles[0].schemaVersion, 'strategy-profile/v2');
  assert.equal(snapshot.revision, 5);
  assert.equal((await repo.getMigrationStatus()).intelligenceMigration.from, 'personal-strategy-store/v1');
});

test('portable export/import preserves corrections, versions, forks and rehomes ownership without intent loss', async () => {
  const { repository } = await configured();
  await repository.appendQualitativeEvidence(evidence());
  await repository.appendQualitativeEvidence(evidence({ id: 'intent-2', supersedesEvidenceIds: ['intent-1'], correctionGroupId: 'correction', createdAt: T1 }));
  await repository.duplicateApproach('setup', 'approach-0', { id: 'fork', displayName: 'Fork' });
  const portable = await repository.exportPortable({ profileIds: ['setup'] });
  const account = createLocalOwnerRef('account:intelligence');
  const imported = makeRepo(createMemoryPersonalStrategyDatabase(), account);
  await imported.importPortable(portable);
  const snapshot = await imported.loadSnapshot();
  assert.deepEqual(snapshot.qualitativeEvidence, portable.qualitativeEvidence);
  assert.equal(snapshot.profiles[0].ownerRef.id, account.id);
  assert.deepEqual(snapshot.modes, portable.modes);
  await assert.rejects(imported.importPortable(portable), /collision/);
});


test('setup changes and one Approach rename preserve all unrelated Approach versions', async () => {
  const database = createMemoryPersonalStrategyDatabase(); const repository = makeRepo(database);
  await repository.saveProfileBundle(bundle(4));
  const original = await repository.loadSnapshot();
  await repository.saveProfileConfiguration({
    profile: updateStrategyProfile(original.profiles[0], { displayName: 'Renamed setup', setupAssumptions: { stack: '100bb' } }, T1),
    modes: original.modes,
  });
  const renamedSetup = await repository.loadSnapshot();
  assert.deepEqual(renamedSetup.modes, original.modes);
  const changedModes = renamedSetup.modes.map((mode, index) => index === 1
    ? updateStrategyMode(mode, { displayName: 'Only this Approach changed' }, T1) : mode);
  await repository.saveProfileConfiguration({ profile: renamedSetup.profiles[0], modes: changedModes });
  const final = await repository.loadSnapshot();
  assert.equal(final.modes[1].approachVersion, 2);
  assert.deepEqual(final.modes.filter((_, index) => index !== 1), original.modes.filter((_, index) => index !== 1));
  assert.equal(final.profiles[0].setupVersion, renamedSetup.profiles[0].setupVersion);
});

test('duplicated qualitative scopes and exceptions address the fork while original interpretation remains auditable', async () => {
  const { repository } = await configured();
  const originalScope = { profileId: 'setup', modeId: 'approach-0', nested: { approachId: 'approach-0' } };
  const interpretation = { scope: originalScope, statedScope: originalScope, inferredScope: originalScope,
    envelope: { scope: originalScope, subject: { role: 'personal_intent', id: 'approach-0' } } };
  const original = evidence({ statedScope: originalScope, inferredScope: originalScope, interpretation });
  const exception = evidence({ id: 'exception', interpretation, statedScope: originalScope,
    provenance: { source: 'user_intent', exceptionTo: original.id } });
  await repository.appendQualitativeEvidence(original);
  await repository.appendQualitativeEvidence(exception);
  await repository.duplicateApproach('setup', 'approach-0', { id: 'fork', displayName: 'Independent' });
  const copied = await repository.loadQualitativeEvidence({ profileId: 'setup', modeId: 'fork' });
  for (const record of copied) {
    assert.equal(record.statedScope.modeId, 'fork');
    assert.equal(record.statedScope.profileId, 'setup');
    assert.equal(record.statedScope.nested.approachId, 'fork');
    assert.equal(record.interpretation.scope.modeId, 'fork');
    assert.equal(record.interpretation.envelope.scope.modeId, 'fork');
    assert.equal(record.interpretation.envelope.subject.id, 'fork');
    assert.deepEqual(record.provenance.sourceInterpretationSnapshot.interpretation, interpretation);
  }
  assert.equal(copied.find((record) => record.provenance.copiedFromEvidenceId === 'exception').provenance.exceptionTo,
    copied.find((record) => record.provenance.copiedFromEvidenceId === 'intent-1').id);
  assert.deepEqual(await repository.loadQualitativeEvidence({ profileId: 'setup', modeId: 'approach-0' }), [original, exception]);
});
