import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  LEGACY_PERSONAL_STRATEGY_OWNER_KEY,
  LEGACY_SAVED_STUDY_OWNER_KEY,
  RIVERLINE_BINDING_PROVENANCE,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  RIVERLINE_OWNER_TYPES,
  createAccountIdentityRepository,
  createMemoryAccountIdentityDatabase,
  createRiverlineDomainOwnershipBinding,
  createRiverlineIdentity,
} from '../app/src/account-identity/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createHomeViewModelController } from '../app/src/application/home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from '../app/src/application/personal-strategy-home-query.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  createPersonalStrategyRepository,
} from '../app/src/personal-strategy/index.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
} from '../app/src/saved-study-objects/index.mjs';
import {
  ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  ACCOUNT001_LEGACY_SAVED_OWNER_ID,
  ACCOUNT001_LEGACY_T0,
  ACCOUNT001_LEGACY_T1,
  ACCOUNT001_LEGACY_T2,
  createPreAccountPersonalStrategyFixture,
  createPreAccountSavedStudyFixture,
} from './fixtures/account001_legacy.mjs';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.reads = 0;
    this.writes = 0;
  }
  getItem(key) { this.reads += 1; return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes += 1; this.values.set(key, String(value)); }
}

function idFactory() {
  let id = 0;
  return (prefix) => `${prefix}-account001-${++id}`;
}

async function seedPersonalStrategy(database, fixture) {
  const repository = createPersonalStrategyRepository({
    database,
    legacyStorage: new MemoryStorage(),
    ownerRef: fixture.ownerRef,
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  await repository.saveProfileBundle(fixture.bundle);
  await repository.saveCalibrationSession(fixture.initialSession);
  await repository.saveCalibrationAnswer({
    observation: fixture.direct,
    session: fixture.session,
    expectedSessionUpdatedAt: fixture.initialSession.updatedAt,
  });
  await repository.saveTrainingObservation(fixture.training);
  return repository;
}

test('first launch creates one stable opaque local identity and display-name edits never change its ID', async () => {
  const storage = new MemoryStorage();
  const database = createMemoryAccountIdentityDatabase();
  const first = createAccountIdentityService({
    storage,
    database,
    idFactory: idFactory(),
    clock: () => ACCOUNT001_LEGACY_T0,
  });
  const initial = await first.getActiveIdentity();
  assert.equal(initial.kind, RIVERLINE_IDENTITY_KINDS.LOCAL);
  assert.match(initial.identityId, /^identity-account001-/);
  assert.notEqual(initial.identityId, initial.displayName);
  assert.equal((await first.ensureLocalIdentity()).identityId, initial.identityId);

  const renamed = await first.setDisplayName('  שחקן Виктор 🎯  ');
  assert.equal(renamed.identityId, initial.identityId);
  assert.equal(renamed.displayName, 'שחקן Виктор 🎯');
  await assert.rejects(first.setDisplayName('   '), /1 through 80/);

  const reloaded = createAccountIdentityService({
    storage,
    database,
    idFactory: idFactory(),
    clock: () => ACCOUNT001_LEGACY_T1,
  });
  assert.deepEqual(await reloaded.getActiveIdentity(), renamed);
  assert.equal((await reloaded.getProfileSummary()).syncEnabled, false);
});

test('interrupted first-launch migration is atomic and retries without orphaned registry records', async () => {
  const storage = new MemoryStorage({
    [LEGACY_SAVED_STUDY_OWNER_KEY]: ACCOUNT001_LEGACY_SAVED_OWNER_ID,
    [LEGACY_PERSONAL_STRATEGY_OWNER_KEY]: ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  });
  const database = createMemoryAccountIdentityDatabase();
  database.failNextTransaction('before_commit', new Error('power loss'), 'readwrite');
  const account = createAccountIdentityService({
    storage,
    database,
    idFactory: idFactory(),
    clock: () => ACCOUNT001_LEGACY_T0,
  });
  await assert.rejects(account.initialize(), { code: 'migration_failed' });
  const recovered = await account.initialize();
  assert.equal(recovered.identities.length, 1);
  assert.equal(recovered.bindings.length, 2);
  assert.deepEqual(recovered.metadata.migration.adoptedDomains, [
    RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
    RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS,
  ]);
  assert.equal(storage.writes, 0);
});

test('pre-ACCOUNT Saved and Personal Strategy owners are adopted by mapping without rewriting IDs or evidence', async () => {
  const storage = new MemoryStorage({
    [LEGACY_SAVED_STUDY_OWNER_KEY]: ACCOUNT001_LEGACY_SAVED_OWNER_ID,
    [LEGACY_PERSONAL_STRATEGY_OWNER_KEY]: ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  });
  const savedDatabase = createMemorySavedStudyDatabase();
  const personalDatabase = createMemoryPersonalStrategyDatabase();
  const accountDatabase = createMemoryAccountIdentityDatabase();
  const legacySaved = createPreAccountSavedStudyFixture();
  const savedRepository = createSavedStudyRepository({
    database: savedDatabase,
    ownerRef: createSavedStudyOwnerRef(ACCOUNT001_LEGACY_SAVED_OWNER_ID),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  await savedRepository.save(legacySaved);
  const personalFixture = createPreAccountPersonalStrategyFixture();
  const personalRepository = await seedPersonalStrategy(personalDatabase, personalFixture);
  const personalBefore = await personalRepository.loadSnapshot();

  const account = createAccountIdentityService({
    storage,
    database: accountDatabase,
    idFactory: idFactory(),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  const firstState = await account.initialize();
  const savedBinding = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  const personalBinding = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY);
  assert.equal(savedBinding.domainOwnerId, ACCOUNT001_LEGACY_SAVED_OWNER_ID);
  assert.equal(personalBinding.domainOwnerId, ACCOUNT001_LEGACY_PERSONAL_OWNER_ID);
  assert.equal(savedBinding.provenance, RIVERLINE_BINDING_PROVENANCE.LEGACY_ADOPTED);
  assert.equal(personalBinding.provenance, RIVERLINE_BINDING_PROVENANCE.LEGACY_ADOPTED);
  assert.deepEqual(firstState.metadata.migration.adoptedDomains, [
    RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
    RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS,
  ]);

  const scopedSaved = createSavedStudyObjectApplication({
    activationResolver: async () => ({
      ownerRef: createSavedStudyOwnerRef(savedBinding.domainOwnerId),
      database: savedDatabase,
    }),
  });
  assert.deepEqual(await scopedSaved.listRecent(), [legacySaved]);
  const personalAfter = await createPersonalStrategyRepository({
    database: personalDatabase,
    legacyStorage: storage,
    ownerRef: createLocalOwnerRef(personalBinding.domainOwnerId),
    clock: () => ACCOUNT001_LEGACY_T2,
  }).loadSnapshot();
  assert.deepEqual(personalAfter, personalBefore);
  assert.equal(personalAfter.profiles[0].id, personalFixture.bundle.profile.id);
  assert.equal(personalAfter.rangeObservations[0].id, personalFixture.direct.id);
  assert.equal(personalAfter.trainingObservations[0].directCalibrationComparison.relation, 'deviates');
  assert.equal(personalAfter.calibrationSessions[0].state, 'paused');

  const repeated = await account.initialize();
  assert.deepEqual(repeated, firstState);
  assert.equal(accountDatabase.getMetrics().recordsWritten, 4);
});

test('active identity switches scoped Saved and Personal Strategy queries without mutating either owner', async () => {
  const storage = new MemoryStorage();
  const accountDatabase = createMemoryAccountIdentityDatabase();
  const repository = createAccountIdentityRepository({
    database: accountDatabase,
    clock: () => ACCOUNT001_LEGACY_T2,
    idFactory: idFactory(),
  });
  const account = createAccountIdentityService({ repository });
  const state = await account.initialize();
  const local = state.activeIdentity;
  const authenticated = createRiverlineIdentity({
    identityId: 'identity-account-b',
    kind: RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
    displayName: 'Account B',
    localDeviceIdentityId: local.localDeviceIdentityId,
    createdAt: ACCOUNT001_LEGACY_T1,
  });
  const bindingsB = Object.values(RIVERLINE_OWNED_DOMAINS).map((domain) => (
    createRiverlineDomainOwnershipBinding({
      identity: authenticated,
      domain,
      domainOwnerId: `${domain}-owner-b`,
      storageScope: 'scope-account-b',
      provenance: RIVERLINE_BINDING_PROVENANCE.IDENTITY_INITIALIZED,
      createdAt: ACCOUNT001_LEGACY_T1,
    })
  ));
  await repository.registerIdentity({ identity: authenticated, bindings: bindingsB });

  const savedDatabases = new Map([
    ['legacy_default', createMemorySavedStudyDatabase({ name: 'saved-local' })],
    ['scope-account-b', createMemorySavedStudyDatabase({ name: 'saved-b' })],
  ]);
  for (const identity of [local, authenticated]) {
    const binding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS, identity.identityId);
    const repo = createSavedStudyRepository({
      database: savedDatabases.get(binding.storageScope),
      ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId),
      clock: () => ACCOUNT001_LEGACY_T2,
    });
    await repo.save(createPreAccountSavedStudyFixture({
      ownerId: binding.domainOwnerId,
      id: `saved-${identity.identityId}`,
    }));
  }
  const savedQueries = createSavedStudyObjectApplication({
    activationResolver: async () => {
      const binding = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
      return {
        ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId),
        database: savedDatabases.get(binding.storageScope),
      };
    },
  });
  assert.deepEqual((await savedQueries.listRecent()).map((entry) => entry.id), [`saved-${local.identityId}`]);
  await account.activateIdentity(authenticated.identityId);
  assert.deepEqual((await savedQueries.listRecent()).map((entry) => entry.id), [`saved-${authenticated.identityId}`]);

  const personalDatabases = new Map([
    ['legacy_default', createMemoryPersonalStrategyDatabase({ name: 'personal-local' })],
    ['scope-account-b', createMemoryPersonalStrategyDatabase({ name: 'personal-b' })],
  ]);
  for (const [identity, suffix] of [[local, 'local'], [authenticated, 'account-b']]) {
    const binding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY, identity.identityId);
    const fixture = createPreAccountPersonalStrategyFixture({ ownerId: binding.domainOwnerId, suffix });
    await seedPersonalStrategy(personalDatabases.get(binding.storageScope), fixture);
  }
  const personalQueries = createPersonalStrategyHomeQuery({
    storage,
    ownershipResolver: () => account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY),
    databaseResolver: (binding) => personalDatabases.get(binding.storageScope),
  });
  assert.equal((await personalQueries.loadSummary()).profileCount, 1);
  await account.activateLocalIdentity();
  assert.deepEqual((await savedQueries.listRecent()).map((entry) => entry.id), [`saved-${local.identityId}`]);
  assert.equal((await personalQueries.loadSummary()).profileCount, 1);
  assert.equal((await repository.getDomainOwnership(
    RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS,
    authenticated.identityId,
  )).ownershipRef.ownerType, RIVERLINE_OWNER_TYPES.ACCOUNT_IDENTITY);
  await account.activateIdentity(authenticated.identityId);
  assert.equal((await savedQueries.listRecent())[0].id, `saved-${authenticated.identityId}`);
});

test('foreign Saved and Personal Strategy imports adopt the active owner without changing content identity', async () => {
  const savedSource = createSavedStudyRepository({
    database: createMemorySavedStudyDatabase(),
    ownerRef: createSavedStudyOwnerRef('foreign-saved-owner'),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  const foreignSaved = createPreAccountSavedStudyFixture({ ownerId: 'foreign-saved-owner', id: 'portable-saved-id' });
  await savedSource.save(foreignSaved);
  const savedTarget = createSavedStudyRepository({
    database: createMemorySavedStudyDatabase(),
    ownerRef: createSavedStudyOwnerRef('active-saved-owner'),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  await savedTarget.importLibrary(await savedSource.exportLibrary({ exportedAt: ACCOUNT001_LEGACY_T2 }));
  const adoptedSaved = await savedTarget.getById(foreignSaved.id);
  assert.equal(adoptedSaved.id, foreignSaved.id);
  assert.equal(adoptedSaved.ownerRef.id, 'active-saved-owner');
  assert.deepEqual(adoptedSaved.payload, foreignSaved.payload);

  const foreignPersonalFixture = createPreAccountPersonalStrategyFixture({ ownerId: 'foreign-personal', suffix: 'foreign' });
  const personalSource = await seedPersonalStrategy(createMemoryPersonalStrategyDatabase(), foreignPersonalFixture);
  const portable = await personalSource.exportPortable({ exportedAt: ACCOUNT001_LEGACY_T2 });
  const personalTarget = createPersonalStrategyRepository({
    database: createMemoryPersonalStrategyDatabase(),
    legacyStorage: new MemoryStorage(),
    ownerRef: createLocalOwnerRef('active-personal'),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  await personalTarget.importPortable(portable);
  const adoptedPersonal = await personalTarget.loadSnapshot();
  assert.equal(adoptedPersonal.profiles[0].id, foreignPersonalFixture.bundle.profile.id);
  assert.equal(adoptedPersonal.profiles[0].ownerRef.id, 'active-personal');
  assert.deepEqual(adoptedPersonal.rangeObservations, portable.rangeObservations);
  assert.deepEqual(adoptedPersonal.trainingObservations, portable.trainingObservations);
  assert.deepEqual(adoptedPersonal.calibrationSessions, portable.calibrationSessions);
  await assert.rejects(
    createPersonalStrategyRepository({
      database: createMemoryPersonalStrategyDatabase(),
      legacyStorage: new MemoryStorage(),
      ownerRef: createLocalOwnerRef('strict-active'),
      clock: () => ACCOUNT001_LEGACY_T2,
    }).importPortable(portable, { ownerPolicy: 'require_match' }),
    /does not match/,
  );
});

test('Home receives the truthful account seam while Saved/Review/Mistake consumers remain bounded', async () => {
  const calls = [];
  const object = createPreAccountSavedStudyFixture();
  const accountSummary = {
    schemaVersion: 'riverline-account-profile-summary/v1',
    identityId: 'identity-home',
    kind: 'local',
    displayName: 'Local Player',
    status: 'local_only',
    storage: 'on_this_device',
    syncEnabled: false,
  };
  const model = await createHomeViewModelController({
    savedStudyQueries: {
      listRecent(options) { calls.push(['recent', options]); return [object]; },
      listForReview(options) { calls.push(['review', options]); return [object]; },
      listMistakes(options) { calls.push(['mistakes', options]); return [object]; },
    },
    personalStrategyQueries: { loadSummary: async () => ({ profileCount: 0, selectedProfile: null }) },
    accountQueries: { getProfileSummary: async () => accountSummary },
  }).load();
  assert.equal(model.identity.status, 'ready');
  assert.deepEqual(model.identity.profile, accountSummary);
  assert.deepEqual(calls.map(([name]) => name), ['recent', 'review', 'mistakes']);
  assert.equal(model.sections.recent.items[0].id, object.id);
  assert.equal(model.sections.review.reviewLater.items[0].id, object.id);
  assert.equal(model.sections.review.mistakes.items[0].id, object.id);
});

test('account initialization remains local while the ACCOUNT-002A surface distinguishes auth from sync', async () => {
  const [domain, repository, service, bootstrap, html, css, translations, specification] = await Promise.all([
    readFile(new URL('../app/src/account-identity/domain.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/account-identity/repository.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/account-identity-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/account-identity-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../docs/project/ACCOUNT_IDENTITY_SPEC.md', import.meta.url), 'utf8'),
  ]);
  const accountSource = [domain, repository, service, bootstrap].join('\n');
  assert.doesNotMatch(accountSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|OAuth|password|token/i);
  assert.match(html, /id="settingsAccountProfile"/);
  assert.match(html, /id="accountDisplayName"[^>]+maxlength="80"[^>]+dir="auto"/);
  assert.match(html, /Stored on this device/);
  assert.match(html, /Cloud sync is not enabled/);
  assert.match(html, /id="accountSignIn"[^>]*data-i18n="Sign in"/);
  assert.match(html, /Signing in does not create a cloud backup/);
  assert.match(css, /\.settings-layout\s*\{[\s\S]*grid-template-columns: minmax\(190px, \.38fr\) minmax\(0, 1fr\)/);
  assert.match(html, /id="settingsAccountProfile"[^>]+role="tabpanel"[^>]+data-settings-panel="account"/);
  assert.match(css, /account-display-name-form/);
  assert.match(specification, /Saved Hand \/ Spot objects[\s\S]*?\| user\/identity \|/);
  assert.match(specification, /Personal Strategy profiles[\s\S]*?\| user\/identity \|/);
  assert.match(specification, /Range Calibration selected profile[\s\S]*?\| user\/identity \|/);
  assert.match(specification, /Tutorial completion\/skip history[\s\S]*?\| device \|/);
  assert.match(specification, /\| language \|[\s\S]*?\| device \|/);
  assert.match(specification, /theme, four-color deck[\s\S]*?\| device \|/);
  for (const key of ['Account & Profile', 'Local Profile', 'Local only', 'Display name', 'Save name', 'Sign in', 'Sign out']) {
    assert.match(translations, new RegExp(`['"]${key.replace(/[&]/g, '&')}['"]`));
  }
  assert.match(translations, /Аккаунт и профиль/);
  assert.match(translations, /חשבון ופרופיל/);
});
