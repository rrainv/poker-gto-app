import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  ACTION_TYPES,
  GAME_MODES,
} from '../shared/poker-domain/index.js';
import {
  RIVERLINE_IDENTITY_KINDS,
  createRiverlineIdentity,
} from '../app/src/account-identity/domain.mjs';
import {
  installTrainingMemoryBridge,
} from '../app/src/application/training-memory-bootstrap.mjs';
import {
  TrainingMemoryAuthorizationError,
  createTrainingMemoryOwnerResolver,
  createTrainingMemoryService,
} from '../app/src/application/training-memory-service.mjs';
import { createAuthenticationService } from '../app/src/application/authentication-service.mjs';
import { createAuthProviderIdentity } from '../app/src/authentication/domain.mjs';
import {
  TRAINING_DECISION_TYPES,
  createTrainingConfigFromLegacyCompatibility,
  generateTrainingExercise,
  generateTrainingExerciseFromScenarioRequest,
} from '../app/src/application/training-generator.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { createTrainingMemoryRepository } from '../app/src/training-memory/repository.mjs';
import {
  createMemoryTrainingMemoryDatabase,
} from '../app/src/training-memory/indexeddb-storage.mjs';

function identity(identityId) {
  return createRiverlineIdentity({
    identityId,
    kind: RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
    displayName: identityId,
    localDeviceIdentityId: 'auth-training-memory-device',
    createdAt: '2026-08-31T08:00:00.000Z',
  });
}

function lifecycle(initialIdentity) {
  let currentIdentity = initialIdentity;
  let state = Object.freeze({ status: 'signed_in', profile: null });
  const authListeners = new Set();
  const identityListeners = new Set();
  const authentication = Object.freeze({
    async ready() { return state; },
    getState() { return state; },
    subscribe(listener) { authListeners.add(listener); return () => authListeners.delete(listener); },
  });
  const identityProvider = Object.freeze({
    async getActiveIdentity() { return currentIdentity; },
    subscribe(listener) {
      identityListeners.add(listener);
      return () => identityListeners.delete(listener);
    },
  });
  return Object.freeze({
    authentication,
    identityProvider,
    get authSubscriptionCount() { return authListeners.size; },
    get identitySubscriptionCount() { return identityListeners.size; },
    get retainedIdentity() { return currentIdentity; },
    guest() {
      state = Object.freeze({ status: 'guest', profile: null });
      authListeners.forEach((listener) => listener(state));
    },
    signIn(nextIdentity) {
      currentIdentity = nextIdentity;
      identityListeners.forEach((listener) => listener({
        identity: nextIdentity,
        reason: 'provider_identity_activated',
      }));
      state = Object.freeze({
        status: 'signed_in',
        profile: Object.freeze({ riverlineIdentityId: nextIdentity.identityId }),
      });
      authListeners.forEach((listener) => listener(state));
    },
  });
}

function clock() {
  let tick = Date.parse('2026-08-31T08:00:00.000Z');
  return () => new Date(tick += 1_000);
}

function idFactory() {
  let sequence = 0;
  return (prefix) => `${prefix}-auth-${++sequence}`;
}

function strategyProvider() {
  return createStrategyProvider({
    fallbackResolver(context) {
      return {
        source: 'heuristic_preflop',
        modelVersion: 'auth-training-memory/v1',
        actions: [
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.2 },
          { action: { type: ACTION_TYPES.CALL }, label: 'Call', probability: 0.2 },
          { action: { type: ACTION_TYPES.RAISE }, label: 'Raise', probability: 0.6 },
        ],
        details: { decisionRole: context.street === 'preflop' ? 'rfi' : 'postflop' },
      };
    },
  });
}

function exercise(provider = strategyProvider()) {
  const config = createTrainingConfigFromLegacyCompatibility({
    tableSize: 6,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: GAME_MODES.HOME,
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED],
    difficulty: 'hard',
    seed: 0x13572468,
  });
  const generated = generateTrainingExercise(config, { strategyProvider: provider });
  assert.equal(generated.ok, true);
  return generated.exercise;
}

function fixture({
  repositoryFactory = createTrainingMemoryRepository,
  generateSimilarExercise,
} = {}) {
  const accountA = identity('training-account-a');
  const accountB = identity('training-account-b');
  const ownerLifecycle = lifecycle(accountA);
  const database = createMemoryTrainingMemoryDatabase();
  const ownerProvider = createTrainingMemoryOwnerResolver({
    authentication: ownerLifecycle.authentication,
    identityProvider: ownerLifecycle.identityProvider,
  });
  const service = createTrainingMemoryService({
    ownerProvider,
    database,
    repositoryFactory,
    generateSimilarExercise,
    clock: clock(),
    idFactory: idFactory(),
  });
  return { accountA, accountB, database, ownerLifecycle, service };
}

async function createAnsweredDecision(service) {
  const currentExercise = exercise();
  const session = await service.startSession({ mode: 'focused', requestedLength: 1 });
  const shown = await service.recordExerciseShown({ sessionId: session.id, exercise: currentExercise });
  const evaluation = evaluateTrainingAnswer({
    exerciseId: currentExercise.id,
    chosenActionType: ACTION_TYPES.FOLD,
    strategyResult: currentExercise.strategyResult,
    decisionContext: currentExercise.decisionContext,
  });
  const answered = await service.recordExerciseAnswered({
    recordId: shown.id,
    evaluation,
    strategyResult: currentExercise.strategyResult,
    actionType: ACTION_TYPES.FOLD,
  });
  return { session, answered };
}

async function rejectsAuthorization(operation) {
  await assert.rejects(operation, (error) => (
    error instanceof TrainingMemoryAuthorizationError
    || /authorization became stale/i.test(error?.message ?? '')
  ));
}

test('retained AccountIdentity is not authorization across A -> Guest -> B -> Guest -> A', async () => {
  const { accountA, accountB, ownerLifecycle, service } = fixture();
  const a = await createAnsweredDecision(service);
  assert.equal((await service.listRecentSessions())[0].session.id, a.session.id);
  assert.equal((await service.getDecision(a.answered.id)).id, a.answered.id);

  ownerLifecycle.guest();
  assert.equal(ownerLifecycle.retainedIdentity.identityId, accountA.identityId);
  await rejectsAuthorization(service.listRecentSessions());
  await rejectsAuthorization(service.listSessionDecisions(a.session.id));
  await rejectsAuthorization(service.getDecision(a.answered.id));
  await rejectsAuthorization(service.updateStudyMetadata(a.answered.id, { review: true }));
  await rejectsAuthorization(service.startSession({ mode: 'focused' }));

  ownerLifecycle.signIn(accountB);
  assert.deepEqual(await service.listRecentSessions(), []);
  await assert.rejects(service.getDecision(a.answered.id), /different Riverline profile/);
  const b = await createAnsweredDecision(service);
  assert.equal((await service.listRecentSessions())[0].session.ownerRef.ownerId, accountB.identityId);

  ownerLifecycle.guest();
  await rejectsAuthorization(service.getDecision(b.answered.id));
  ownerLifecycle.signIn(accountA);
  assert.equal((await service.getDecision(a.answered.id)).ownerRef.ownerId, accountA.identityId);
  await assert.rejects(service.getDecision(b.answered.id), /different Riverline profile/);
});

test('provider sign-out failure keeps local Guest revocation immediate and A bytes intact', async () => {
  const accountA = identity('immediate-signout-account');
  const providerIdentity = createAuthProviderIdentity({
    provider: 'fake',
    providerSubject: 'immediate-signout-provider',
    email: 'player@example.com',
    authenticatedAt: '2026-08-31T08:00:00.000Z',
  });
  const signOutGate = deferred();
  const accountIdentity = {
    async initialize() { return { activeIdentity: accountA }; },
    async ensureLocalIdentity() { return accountA; },
    async activateLocalIdentity() { return accountA; },
    async activateProviderIdentity() { return { identity: accountA }; },
    async getActiveIdentity() { return accountA; },
    subscribe() { return () => {}; },
    reserveIdentityId() { return 'unused-reserved-identity'; },
  };
  const adapter = {
    provider: 'fake',
    isAvailable: () => true,
    restoreSession: async () => providerIdentity,
    refreshSession: async () => providerIdentity,
    signInWithPassword: async () => providerIdentity,
    signUpWithPassword: async () => providerIdentity,
    async signOut() {
      signOutGate.enter();
      await signOutGate.wait;
      throw new Error('provider cleanup failed');
    },
  };
  const authentication = createAuthenticationService({ accountIdentity, providerAdapter: adapter });
  assert.equal((await authentication.initialize()).status, 'signed_in');
  const trainingService = createTrainingMemoryService({
    ownerProvider: createTrainingMemoryOwnerResolver({ authentication, identityProvider: accountIdentity }),
    database: createMemoryTrainingMemoryDatabase(),
    clock: clock(),
    idFactory: idFactory(),
  });
  const aSession = await trainingService.startSession({ mode: 'focused' });
  const pending = authentication.signOut();
  await signOutGate.entered;
  assert.equal(authentication.getState().status, 'guest');
  await rejectsAuthorization(trainingService.listRecentSessions());
  signOutGate.release();
  assert.equal((await pending).status, 'guest');
  assert.equal(authentication.getState().noticeCode, 'signout_incomplete');
  await rejectsAuthorization(trainingService.listRecentSessions());
  assert.equal((await authentication.signInWithPassword({
    email: 'player@example.com',
    password: 'not-recorded',
  })).status, 'signed_in');
  assert.equal((await trainingService.listRecentSessions())[0].session.id, aSession.id);
});

function providerIdentity(subject) {
  return createAuthProviderIdentity({
    provider: 'fake',
    providerSubject: subject,
    email: `${subject}@example.com`,
    authenticatedAt: '2026-08-31T08:00:00.000Z',
  });
}

function accountIdentityStub(identities, initial = identities.values().next().value) {
  let active = initial;
  const listeners = new Set();
  return {
    async initialize() { return { activeIdentity: active }; },
    async ensureLocalIdentity() { return active; },
    async activateLocalIdentity() { return active; },
    async activateProviderIdentity(provider) {
      const next = identities.get(provider.providerSubject) ?? null;
      if (!next) return null;
      active = next;
      listeners.forEach((listener) => listener({ identity: next, reason: 'provider_identity_activated' }));
      return { identity: next };
    },
    async getActiveIdentity() { return active; },
    reserveIdentityId() { return 'unused-reserved-identity'; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

function authAdapter(overrides = {}) {
  return {
    provider: 'fake',
    isAvailable: () => true,
    restoreSession: async () => null,
    refreshSession: async () => null,
    signInWithPassword: async () => null,
    signUpWithPassword: async () => null,
    signOut: async () => {},
    ...overrides,
  };
}

test('stale restore, refresh, and sign-in completions cannot replace Guest or a newer owner', async () => {
  const accountA = identity('delayed-auth-account-a');
  const accountB = identity('delayed-auth-account-b');
  const providerA = providerIdentity('delayed-provider-a');
  const providerB = providerIdentity('delayed-provider-b');
  const identities = new Map([
    [providerA.providerSubject, accountA],
    [providerB.providerSubject, accountB],
  ]);

  const restoreGate = deferred();
  const restoreAuth = createAuthenticationService({
    accountIdentity: accountIdentityStub(identities, accountA),
    providerAdapter: authAdapter({
      async restoreSession() { restoreGate.enter(); await restoreGate.wait; return providerA; },
    }),
  });
  const restoring = restoreAuth.initialize();
  await restoreGate.entered;
  await restoreAuth.switchToGuest();
  assert.equal(restoreAuth.getState().status, 'guest');
  restoreGate.release();
  assert.equal((await restoring).status, 'guest');

  const refreshGate = deferred();
  const refreshAuth = createAuthenticationService({
    accountIdentity: accountIdentityStub(identities, accountA),
    providerAdapter: authAdapter({
      restoreSession: async () => providerA,
      async refreshSession() { refreshGate.enter(); await refreshGate.wait; return providerA; },
    }),
  });
  assert.equal((await refreshAuth.initialize()).status, 'signed_in');
  const refreshing = refreshAuth.refreshSession();
  await refreshGate.entered;
  await refreshAuth.switchToGuest();
  refreshGate.release();
  assert.equal((await refreshing).status, 'guest');

  const signInGate = deferred();
  const signInAuth = createAuthenticationService({
    accountIdentity: accountIdentityStub(identities, accountA),
    providerAdapter: authAdapter({
      async signInWithPassword({ email }) {
        if (email.startsWith('a@')) {
          signInGate.enter();
          await signInGate.wait;
          return providerA;
        }
        return providerB;
      },
    }),
  });
  assert.equal((await signInAuth.initialize()).status, 'guest');
  const delayedA = signInAuth.signInWithPassword({ email: 'a@example.com', password: 'x' });
  await signInGate.entered;
  assert.equal((await signInAuth.signInWithPassword({
    email: 'b@example.com',
    password: 'x',
  })).status, 'signed_in');
  assert.equal(signInAuth.getState().email, providerB.email);
  signInGate.release();
  const final = await delayedA;
  assert.equal(final.status, 'signed_in');
  assert.equal(final.email, providerB.email);
});

function deferred() {
  let release;
  let enteredResolve;
  const entered = new Promise((resolve) => { enteredResolve = resolve; });
  const wait = new Promise((resolve) => { release = resolve; });
  return { entered, enter: enteredResolve, release, wait };
}

test('generation invalidation rejects delayed list/detail results and aborts a stale mutation', async () => {
  const gates = new Map();
  const repositoryFactory = (options) => {
    const repository = createTrainingMemoryRepository(options);
    return Object.freeze({
      ...repository,
      async listRecentSessions(...args) {
        const gate = gates.get('list');
        if (gate) { gate.enter(); await gate.wait; }
        return repository.listRecentSessions(...args);
      },
      async getDecision(...args) {
        const gate = gates.get('detail');
        if (gate) { gate.enter(); await gate.wait; }
        return repository.getDecision(...args);
      },
      async listSessionDecisions(...args) {
        const gate = gates.get('session-list');
        if (gate) { gate.enter(); await gate.wait; }
        return repository.listSessionDecisions(...args);
      },
      async replaceDecision(...args) {
        const gate = gates.get('mutation');
        if (gate) { gate.enter(); await gate.wait; }
        return repository.replaceDecision(...args);
      },
    });
  };
  const { accountA, database, ownerLifecycle, service } = fixture({ repositoryFactory });
  const a = await createAnsweredDecision(service);

  const sessionListGate = deferred();
  gates.set('session-list', sessionListGate);
  const delayedSessionList = service.listSessionDecisions(a.session.id);
  await sessionListGate.entered;
  ownerLifecycle.guest();
  sessionListGate.release();
  await rejectsAuthorization(delayedSessionList);

  ownerLifecycle.signIn(accountA);
  const listGate = deferred();
  gates.set('list', listGate);
  const delayedList = service.listRecentSessions();
  await listGate.entered;
  ownerLifecycle.guest();
  listGate.release();
  await rejectsAuthorization(delayedList);

  ownerLifecycle.signIn(accountA);
  const detailGate = deferred();
  gates.set('detail', detailGate);
  const delayedDetail = service.getDecision(a.answered.id);
  await detailGate.entered;
  ownerLifecycle.guest();
  detailGate.release();
  await rejectsAuthorization(delayedDetail);

  ownerLifecycle.signIn(accountA);
  gates.delete('detail');
  const mutationGate = deferred();
  gates.set('mutation', mutationGate);
  const delayedMutation = service.updateStudyMetadata(a.answered.id, { review: true });
  await mutationGate.entered;
  ownerLifecycle.guest();
  mutationGate.release();
  await rejectsAuthorization(delayedMutation);

  ownerLifecycle.signIn(accountA);
  gates.delete('mutation');
  const unchanged = await service.getDecision(a.answered.id);
  assert.equal(unchanged.studyMetadata.review, false);

  const commitGate = deferred();
  database.delayNextCommit(async () => {
    commitGate.enter();
    await commitGate.wait;
  });
  const stagedMutation = service.updateStudyMetadata(a.answered.id, { difficult: true });
  await commitGate.entered;
  ownerLifecycle.guest();
  commitGate.release();
  await assert.rejects(stagedMutation, /stale|abort/i);
  ownerLifecycle.signIn(accountA);
  assert.equal((await service.getDecision(a.answered.id)).studyMetadata.difficult, false);
});

test('Same Spot and Similar Spot reject stale A results after owner transition', async () => {
  const gates = new Map();
  const repositoryFactory = (options) => {
    const repository = createTrainingMemoryRepository(options);
    return Object.freeze({
      ...repository,
      async getDecision(...args) {
        const gate = gates.get('same');
        if (gate) { gate.enter(); await gate.wait; }
        return repository.getDecision(...args);
      },
    });
  };
  const similarGate = deferred();
  const currentProvider = strategyProvider();
  const { accountA, accountB, ownerLifecycle, service } = fixture({
    repositoryFactory,
    async generateSimilarExercise(...args) {
      similarGate.enter();
      await similarGate.wait;
      return generateTrainingExerciseFromScenarioRequest(...args);
    },
  });
  const a = await createAnsweredDecision(service);

  const sameGate = deferred();
  gates.set('same', sameGate);
  const delayedSame = service.createSameSpot(a.answered.id);
  await sameGate.entered;
  ownerLifecycle.signIn(accountB);
  sameGate.release();
  await rejectsAuthorization(delayedSame);

  ownerLifecycle.signIn(accountA);
  gates.delete('same');
  const delayedSimilar = service.generateSimilarSpot(a.answered.id, {
    strategyProvider: currentProvider,
  });
  await similarGate.entered;
  ownerLifecycle.guest();
  similarGate.release();
  await rejectsAuthorization(delayedSimilar);
});

function extractFunction(source, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

test('owner transition clears private Training Memory presentation synchronously', () => {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const clear = extractFunction(source, 'clearTrainingMemoryOwnerPresentation');
  const elements = new Map([
    ['trainingMemoryList', { children: ['private-row'], replaceChildren() { this.children = []; } }],
    ['trainingMemoryPanel', { dataset: { memoryLoaded: 'true' } }],
    ['trainingMemoryDueBadge', { textContent: '4', hidden: false }],
  ]);
  const app = { training: {
    currentExercise: null,
    memoryGeneration: 7,
    memorySessionPromise: Promise.resolve({ id: 'account-a-session' }),
    memoryWritePromise: Promise.resolve(),
    memoryFullHandDecisionRecords: new Map([['private', Promise.resolve({})]]),
    memoryLastItems: [{ private: true }],
    memoryRedrillNote: 'Historical comparison',
  } };
  let resetCalls = 0;
  let status = 'private status';
  const sandbox = {
    app,
    window: { RiverlineTrainingMemory: {} },
    $: (selector) => elements.get(selector.slice(1)) ?? null,
    resetTrainingMemoryDecisionState() { resetCalls += 1; },
    setTrainingMemoryStatus(value) { status = value; },
    clearTrainingSessionState() { throw new Error('unrelated Training state must remain'); },
  };
  vm.runInNewContext(`${clear}; clearTrainingMemoryOwnerPresentation();`, sandbox);
  assert.equal(app.training.memoryGeneration, 8);
  assert.equal(app.training.memorySessionPromise, null);
  assert.equal(app.training.memoryLastItems.length, 0);
  assert.equal(app.training.memoryRedrillNote, '');
  assert.equal(elements.get('trainingMemoryList').children.length, 0);
  assert.equal(elements.get('trainingMemoryPanel').dataset.memoryLoaded, 'false');
  assert.equal(elements.get('trainingMemoryDueBadge').hidden, true);
  assert.equal(status, '');
  assert.equal(resetCalls, 1);
});

test('queued A write intent that has not started is discarded before owner resolution', async () => {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const queue = extractFunction(source, 'queueTrainingMemoryWrite');
  const prior = deferred();
  const app = { training: { memoryGeneration: 3, memoryWritePromise: prior.wait } };
  const sandbox = {
    app,
    calls: 0,
    console,
    setTrainingMemoryStatus() {},
    t: (value) => value,
  };
  vm.runInNewContext(
    `${queue}; this.result = queueTrainingMemoryWrite(() => { this.calls += 1; return 'written'; });`,
    sandbox,
  );
  app.training.memoryGeneration += 1;
  prior.release();
  assert.equal(await sandbox.result, null);
  assert.equal(sandbox.calls, 0);
});

test('a rejected write from an invalidated Memory epoch cannot publish unavailable status', async () => {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const queue = extractFunction(source, 'queueTrainingMemoryWrite');
  const operation = deferred();
  const app = { training: { memoryGeneration: 5, memoryWritePromise: Promise.resolve() } };
  const statuses = [];
  const sandbox = {
    app,
    console: { error() {} },
    setTrainingMemoryStatus(value) { statuses.push(value); },
  };
  vm.runInNewContext(
    `${queue}; this.result = queueTrainingMemoryWrite(async () => { this.operation.enter(); await this.operation.wait; throw new Error('stale cleanup'); });`,
    { ...sandbox, operation },
  );
  await operation.entered;
  app.training.memoryGeneration += 1;
  operation.release();
  await app.training.memoryWritePromise;
  assert.deepEqual(statuses, []);
});

for (const answered of [false, true]) {
  test(`standalone Same Spot ${answered ? 'stores its answer and completes' : 'exits unanswered and abandons'} without disabling Memory`, async () => {
    const { service } = fixture();
    const historical = await createAnsweredDecision(service);
    const sameSpot = await service.createSameSpot(historical.answered.id);
    const review = await service.startSession({ mode: 'review', requestedLength: 1 });
    const shown = await service.recordExerciseShown({
      sessionId: review.id,
      exercise: sameSpot.exercise,
      parentDecisionRecordId: historical.answered.id,
      redrillKind: 'same_spot',
    });
    if (answered) {
      const actionType = sameSpot.exercise.strategyResult.recommendation.action.type;
      const evaluation = evaluateTrainingAnswer({
        exerciseId: sameSpot.exercise.id,
        chosenActionType: actionType,
        strategyResult: sameSpot.exercise.strategyResult,
        decisionContext: sameSpot.exercise.decisionContext,
      });
      await service.recordExerciseAnswered({
        recordId: shown.id,
        evaluation,
        strategyResult: sameSpot.exercise.strategyResult,
        actionType,
      });
    }
    const finished = await service.finishSession(review.id, answered ? 'completed' : 'abandoned');
    assert.equal(finished.status, answered ? 'completed' : 'abandoned');
    assert.equal((await service.getDecision(shown.id)).status, answered ? 'answered' : 'shown');
    assert.ok(Array.isArray(await service.listRecentSessions()));
    assert.ok(Array.isArray(await service.listDueReview()));
  });
}

test('mixed sequential panel refresh cannot combine due rows from A with recent rows from B', async () => {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const refresh = extractFunction(source, 'refreshTrainingMemoryPanel');
  const recent = deferred();
  const list = {
    rows: [],
    replaceChildren() { this.rows = []; },
    appendChild(row) { this.rows.push(row); },
  };
  const elements = new Map([
    ['trainingMemoryList', list],
    ['trainingMemoryPanel', { dataset: {} }],
    ['trainingMemoryDueBadge', { textContent: '', hidden: true }],
  ]);
  const app = { training: {
    memoryGeneration: 11,
    memoryView: 'recent',
    memoryLastItems: [],
  } };
  const sandbox = {
    app,
    window: { RiverlineTrainingMemory: {} },
    $: (selector) => elements.get(selector.slice(1)) ?? null,
    setTrainingMemoryStatus() {},
    async callTrainingMemoryBridge(method) {
      if (method === 'listDueReview') return [{ record: { owner: 'A' } }];
      recent.enter();
      await recent.wait;
      return [{ session: { owner: 'B' } }];
    },
    renderTrainingMemorySessionItem(entry) { return entry; },
    renderTrainingMemoryDecisionItem(entry) { return entry; },
    console,
  };
  vm.runInNewContext(`${refresh}; this.result = refreshTrainingMemoryPanel();`, sandbox);
  await recent.entered;
  app.training.memoryGeneration += 1;
  list.replaceChildren();
  recent.release();
  assert.equal(await sandbox.result, null);
  assert.equal(list.rows.length, 0);
  assert.equal(app.training.memoryLastItems.length, 0);
});

test('panel failure preserves the concrete diagnostic code behind generic copy', async () => {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const refresh = extractFunction(source, 'refreshTrainingMemoryPanel');
  const list = { replaceChildren() {} };
  const app = { training: {
    memoryGeneration: 2,
    memoryView: 'review',
    memoryLastItems: [],
    memoryLastDiagnostic: null,
  } };
  const statuses = [];
  const sandbox = {
    app,
    window: {},
    $: (selector) => (selector === '#trainingMemoryList' ? list : null),
    setTrainingMemoryStatus(value, variables, options) { statuses.push({ value, options }); },
    console: { error() {} },
  };
  vm.runInNewContext(`${refresh}; this.result = refreshTrainingMemoryPanel();`, sandbox);
  assert.equal(await sandbox.result, null);
  assert.equal(app.training.memoryLastDiagnostic.code, 'training_memory_bridge_unavailable');
  assert.equal(statuses.at(-1).options.error, true);
});

test('owner resolver installs exactly one auth and one identity subscription', () => {
  const ownerLifecycle = lifecycle(identity('subscription-account'));
  createTrainingMemoryOwnerResolver({
    authentication: ownerLifecycle.authentication,
    identityProvider: ownerLifecycle.identityProvider,
  });
  assert.equal(ownerLifecycle.authSubscriptionCount, 1);
  assert.equal(ownerLifecycle.identitySubscriptionCount, 1);
});

test('Training Memory bridge recovers when authentication installs after its first bootstrap attempt', async () => {
  class BrowserWindow extends EventTarget {}
  const browserWindow = new BrowserWindow();
  const accountA = identity('late-bootstrap-account');
  const ownerLifecycle = lifecycle(accountA);
  const database = createMemoryTrainingMemoryDatabase();
  let readyEvents = 0;
  browserWindow.addEventListener('riverline:trainingmemoryready', () => { readyEvents += 1; });

  assert.equal(installTrainingMemoryBridge(browserWindow, { database }), null);
  browserWindow.RiverlineAuthentication = ownerLifecycle.authentication;
  browserWindow.RiverlineAccountIdentity = ownerLifecycle.identityProvider;
  browserWindow.dispatchEvent(new Event('riverline:authchange'));

  assert.equal(browserWindow.RiverlineTrainingMemory?.schemaVersion, 'training-memory-bridge/v1');
  assert.equal(readyEvents, 1);
  assert.deepEqual(await browserWindow.RiverlineTrainingMemory.listRecentSessions(), []);
  assert.deepEqual(await browserWindow.RiverlineTrainingMemory.listDueReview(), []);
  const historical = await createAnsweredDecision(browserWindow.RiverlineTrainingMemory);
  const sameSpot = await browserWindow.RiverlineTrainingMemory.createSameSpot(
    historical.answered.id,
  );
  assert.equal(sameSpot.sourceDecisionRecordId, historical.answered.id);
  assert.equal(
    installTrainingMemoryBridge(browserWindow, { database }),
    browserWindow.RiverlineTrainingMemory,
  );
  assert.equal(ownerLifecycle.authSubscriptionCount, 1);
  assert.equal(ownerLifecycle.identitySubscriptionCount, 1);
  browserWindow.dispatchEvent(new Event('riverline:authchange'));
  browserWindow.dispatchEvent(new Event('riverline:identitychange'));
  assert.equal(readyEvents, 1);
});

test('real auth-aware bridge remains locally available through Varied, Focused, and Full Hand sessions', async () => {
  class BrowserWindow extends EventTarget {}
  const browserWindow = new BrowserWindow();
  const accountA = identity('ordinary-training-account');
  const ownerLifecycle = lifecycle(accountA);
  browserWindow.RiverlineAuthentication = ownerLifecycle.authentication;
  browserWindow.RiverlineAccountIdentity = ownerLifecycle.identityProvider;
  installTrainingMemoryBridge(browserWindow, {
    database: createMemoryTrainingMemoryDatabase(),
    clock: clock(),
    idFactory: idFactory(),
  });

  for (const mode of ['varied', 'focused', 'full_hand']) {
    const session = await browserWindow.RiverlineTrainingMemory.startSession({ mode });
    assert.equal(session.mode, mode);
    assert.ok(Array.isArray(await browserWindow.RiverlineTrainingMemory.listRecentSessions()));
    assert.ok(Array.isArray(await browserWindow.RiverlineTrainingMemory.listDueReview()));
    await browserWindow.RiverlineTrainingMemory.finishSession(session.id, 'abandoned');
  }
});
