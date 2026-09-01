import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  GAME_MODES,
  createGameRulesSnapshotFromLegacyGameConfiguration,
} from '../shared/poker-domain/index.js';
import {
  RIVERLINE_IDENTITY_KINDS,
  createRiverlineIdentity,
  riverlineOwnershipRefForIdentity,
} from '../app/src/account-identity/domain.mjs';
import {
  TRAINING_CONFIG_V2_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  createTrainingConfigFromLegacyCompatibility,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import {
  STRATEGY_SOURCES,
  createStrategyResult,
} from '../app/src/application/strategy-result.mjs';
import {
  createStrategyContextCoverage,
  createStrategySourceAcceptanceRegistry,
  createStrategySourceDescriptor,
} from '../app/src/application/strategy-source-authority.mjs';
import {
  FULL_HAND_TRAINING_STATUSES,
  createFullHandTrainingSessionController,
} from '../app/src/application/full-hand-training-session-controller.mjs';
import { createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createTrainingMemoryPresentationGate } from '../app/src/application/training-memory-presentation.mjs';
import {
  TRAINING_COMPARISON_STATES,
  TRAINING_DECISION_RECORD_SCHEMA_VERSION,
  TRAINING_REVIEW_LIFECYCLE_STATES,
  TRAINING_REVIEW_REASON_CODES,
  TRAINING_SESSION_RECORD_SCHEMA_VERSION,
  TRAINING_SIMILARITY_SCHEMA_VERSION,
  deriveTrainingSimilarity,
  deriveTrainingSessionSummary,
  reviewReasonsForDecision,
  validateTrainingDecisionRecord,
  validateTrainingSessionRecord,
} from '../app/src/training-memory/domain.mjs';
import {
  TRAINING_MEMORY_DATABASE_MIGRATIONS,
  TRAINING_MEMORY_DATABASE_VERSION,
  TRAINING_MEMORY_INDEXES,
  TRAINING_MEMORY_STORES,
  createMemoryTrainingMemoryDatabase,
} from '../app/src/training-memory/indexeddb-storage.mjs';

function clock(start = '2026-08-26T08:00:00.000Z') {
  let tick = Date.parse(start);
  return () => new Date(tick += 1000);
}

function idFactory(prefix = 'fixture') {
  let sequence = 0;
  return (kind) => `${prefix}-${kind}-${++sequence}`;
}

function identity(identityId = 'local-training-player', kind = RIVERLINE_IDENTITY_KINDS.LOCAL) {
  return createRiverlineIdentity({
    identityId,
    kind,
    displayName: identityId,
    localDeviceIdentityId: 'training-memory-device',
    createdAt: '2026-08-01T00:00:00.000Z',
  });
}

function ownerProvider(activeIdentity) {
  const snapshot = Object.freeze({
    authStatus: 'signed_in',
    generation: 0,
    ownerRef: riverlineOwnershipRefForIdentity(activeIdentity),
  });
  return Object.freeze({
    async capture() { return snapshot; },
    assertCurrent(candidate) {
      if (candidate !== snapshot) throw new Error('Unexpected Training Memory owner snapshot');
      return candidate;
    },
  });
}

function strategyProvider(counter = { calls: 0 }, modelVersion = 'memory-fixture/v1') {
  return createStrategyProvider({
    fallbackResolver(context) {
      counter.calls += 1;
      const passive = context.facingSizeBb > 0 ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK;
      const aggressive = context.street === 'preflop'
        ? ACTION_TYPES.RAISE
        : context.facingSizeBb > 0 ? ACTION_TYPES.RAISE : ACTION_TYPES.BET;
      return {
        source: context.street === 'preflop'
          ? STRATEGY_SOURCES.HEURISTIC_PREFLOP
          : STRATEGY_SOURCES.HEURISTIC_POSTFLOP,
        modelVersion,
        actions: [
          { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.05 },
          { action: { type: passive }, label: passive, probability: 0.25 },
          { action: { type: aggressive }, label: aggressive, probability: 0.60 },
          { action: { type: ACTION_TYPES.ALL_IN }, label: 'All-in', probability: 0.10 },
        ],
        details: { decisionRole: context.street === 'preflop' ? 'rfi' : 'postflop_response' },
      };
    },
  });
}

function trainingConfig(seed = 0x12345678) {
  const config = createTrainingConfigFromLegacyCompatibility({
    tableSize: 6,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: GAME_MODES.HOME,
    heroPositions: ['BTN'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED],
    difficulty: 'hard',
    seed,
  });
  assert.equal(config.schemaVersion, TRAINING_CONFIG_V2_SCHEMA_VERSION);
  return config;
}

function exercise(provider = strategyProvider(), seed = 0x12345678) {
  const result = generateTrainingExercise(trainingConfig(seed), { strategyProvider: provider });
  assert.equal(result.ok, true, result.error?.message);
  return result.exercise;
}

function actionEvaluation(currentExercise, actionType = ACTION_TYPES.FOLD) {
  return evaluateTrainingAnswer({
    exerciseId: currentExercise.id,
    chosenActionType: actionType,
    strategyResult: currentExercise.strategyResult,
    decisionContext: currentExercise.decisionContext,
  });
}

function serviceFixture({ owner = identity(), database = createMemoryTrainingMemoryDatabase() } = {}) {
  return {
    database,
    service: createTrainingMemoryService({
      ownerProvider: ownerProvider(owner),
      database,
      clock: clock(),
      idFactory: idFactory(owner.identityId),
    }),
  };
}

async function answeredExerciseRecord({
  service,
  currentExercise = exercise(),
  actionType = ACTION_TYPES.FOLD,
  mode = 'focused',
} = {}) {
  const session = await service.startSession({
    mode,
    requestedLength: 1,
    sessionSeed: currentExercise.seed,
    focus: { street: currentExercise.decisionContext.street },
  });
  const shown = await service.recordExerciseShown({ sessionId: session.id, exercise: currentExercise });
  const evaluation = actionEvaluation(currentExercise, actionType);
  const answered = await service.recordExerciseAnswered({
    recordId: shown.id,
    evaluation,
    strategyResult: currentExercise.strategyResult,
    actionType,
  });
  return { session, shown, answered, evaluation, exercise: currentExercise };
}

test('DecisionRecord v1 freezes exact canonical state and comparative source truth', async () => {
  const { service } = serviceFixture();
  const fixture = await answeredExerciseRecord({ service });
  const record = fixture.answered;

  assert.equal(record.schemaVersion, TRAINING_DECISION_RECORD_SCHEMA_VERSION);
  assert.equal(record.status, 'answered');
  assert.equal(record.ordinal, 0);
  assert.deepEqual(record.decisionContext, fixture.exercise.decisionContext);
  assert.deepEqual(record.legalActions, fixture.exercise.legalActions);
  assert.deepEqual(record.decisionSource.pokerState, fixture.exercise.pokerState);
  assert.equal(record.decisionSource.replayIdentity.seed, fixture.exercise.seed);
  assert.equal(record.decisionSource.replayIdentity.generatorVersion, fixture.exercise.schemaVersion);
  assert.equal(record.userResponse.action.type, ACTION_TYPES.FOLD);
  assert.equal(record.userResponse.submission, 'normal');
  assert.equal(record.strategyEvidence.strategyResult.sourceVersion, 'riverline-preflop-heuristic/v4');
  assert.equal(record.strategyEvidence.strategyResult.sourceDescriptor.family, 'heuristic');
  assert.equal(record.strategyEvidence.claimPolicy.trainingSemantics, 'comparative');
  assert.equal(record.strategyEvidence.comparisonState, TRAINING_COMPARISON_STATES.DIFFERS_FROM_REFERENCE);
  assert.equal(record.strategyEvidence.internalEvaluation.grade, 'mistake');
  assert.equal(Object.hasOwn(record, 'accuracy'), false);
  assert.equal(Object.hasOwn(record, 'correct'), false);
  assert.equal(Object.hasOwn(record, 'mistake'), false);
  validateTrainingDecisionRecord(record);
});

test('historical Training Memory context bytes remain absent rather than backfilled', async () => {
  const historicalExercise = structuredClone(exercise());
  delete historicalExercise.decisionContext.actorContestablePotAfterCallBb;
  delete historicalExercise.decisionContext.actorIneligiblePotAfterCallBb;
  delete historicalExercise.decisionContext.requiredRawEquity;
  const historicalBytes = JSON.stringify(historicalExercise.decisionContext);
  const { service } = serviceFixture();
  const fixture = await answeredExerciseRecord({
    service,
    currentExercise: historicalExercise,
  });
  assert.equal(JSON.stringify(fixture.answered.decisionContext), historicalBytes);
  assert.equal(
    Object.hasOwn(fixture.answered.decisionContext, 'actorContestablePotAfterCallBb'),
    false,
  );
  validateTrainingDecisionRecord(fixture.answered);
});

test('unaccepted exploratory answers create no reference comparison or automatic review reason', async () => {
  const base = exercise();
  const unacceptedDescriptor = createStrategySourceDescriptor({
    id: 'unaccepted.training.source',
    version: 'unaccepted.training.source/v1',
    displayName: 'Unaccepted training source',
    family: 'learned',
    authority: 'validated_reference',
    capabilities: {
      actionDistribution: 'exact',
      grading: 'normative',
      optimality: true,
    },
    defaultCoverage: 'exact',
  });
  const unacceptedResult = createStrategyResult({
    source: unacceptedDescriptor.id,
    sourceDescriptor: unacceptedDescriptor,
    contextCoverage: createStrategyContextCoverage({ kind: 'exact' }),
    actions: [
      { action: { type: ACTION_TYPES.FOLD }, probability: 0.1 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.9 },
    ],
  });
  const currentExercise = Object.freeze({
    ...structuredClone(base),
    strategyResult: unacceptedResult,
  });
  const { service } = serviceFixture();
  const { answered } = await answeredExerciseRecord({
    service,
    currentExercise,
    actionType: ACTION_TYPES.FOLD,
  });

  assert.equal(answered.strategyEvidence.claimPolicy.mode, 'exploratory');
  assert.equal(answered.strategyEvidence.comparisonState, 'unavailable');
  assert.deepEqual(reviewReasonsForDecision(answered), []);
  assert.equal(answered.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.NONE);
});

test('frozen claim policy distinguishes a genuinely normative reference from internal grade', async () => {
  const base = exercise();
  const descriptor = createStrategySourceDescriptor({
    id: 'validated-test-reference',
    version: 'validated-test-reference/v1',
    displayName: 'Validated test reference',
    family: 'reference_pack',
    authority: 'validated_reference',
    capabilities: {
      actionDistribution: 'exact',
      actionSizing: 'none',
      actionEv: false,
      grading: 'normative',
      optimality: false,
    },
    defaultCoverage: 'exact',
  });
  const normativeResult = createStrategyResult({
    source: descriptor.id,
    sourceDescriptor: descriptor,
    sourceAcceptance: createStrategySourceAcceptanceRegistry([{
      sourceId: descriptor.id,
      allowedFamily: descriptor.family,
      acceptedAuthority: descriptor.authority,
      acceptedCapabilities: descriptor.capabilities,
      acceptedCoverageCeiling: 'exact',
      validationStatus: 'explicit_test_acceptance',
      acceptedVersion: descriptor.version,
      acceptedFingerprint: 'validated-test-reference-fingerprint',
    }]).acceptanceFor(descriptor, 'validated-test-reference-fingerprint'),
    provenance: { contentHash: 'validated-test-reference-fingerprint' },
    contextCoverage: createStrategyContextCoverage({ kind: 'exact' }),
    actions: [
      { action: { type: ACTION_TYPES.FOLD }, label: 'Fold', probability: 0.1 },
      { action: { type: ACTION_TYPES.RAISE }, label: 'Raise', probability: 0.9 },
    ],
  });
  const normativeExercise = Object.freeze({
    ...structuredClone(base),
    strategyResult: normativeResult,
  });
  const { service } = serviceFixture();
  const { answered } = await answeredExerciseRecord({
    service,
    currentExercise: normativeExercise,
  });

  assert.equal(answered.strategyEvidence.internalEvaluation.grade, 'mistake');
  assert.equal(answered.strategyEvidence.comparisonState, 'differs_from_reference');
  assert.equal(answered.strategyEvidence.claimPolicy.trainingSemantics, 'normative');
  assert.equal(answered.strategyEvidence.claimPolicy.claims.accuracy, true);
  assert.equal(answered.strategyEvidence.claimPolicy.sourceVersion, 'validated-test-reference/v1');
  assert.equal(
    answered.strategyEvidence.strategyResult.sourceAuthoritySnapshot.sourceFingerprint,
    'validated-test-reference-fingerprint',
  );
  assert.equal(Object.hasOwn(answered.strategyEvidence.strategyResult, 'sourceAcceptance'), false);
  const same = await service.createSameSpot(answered.id);
  assert.equal(same.historicalClaimPolicy.trainingSemantics, 'normative');
  assert.deepEqual(
    same.exercise.strategyResult.sourceAuthoritySnapshot,
    answered.strategyEvidence.strategyResult.sourceAuthoritySnapshot,
  );
  const oldFrozenRecord = structuredClone(answered);
  delete oldFrozenRecord.strategyEvidence.strategyResult.sourceAuthoritySnapshot;
  delete oldFrozenRecord.strategyEvidence.claimPolicy.sourceAuthoritySnapshot;
  assert.doesNotThrow(() => validateTrainingDecisionRecord(oldFrozenRecord));
  assert.equal(oldFrozenRecord.strategyEvidence.claimPolicy.trainingSemantics, 'normative');
});

test('SessionRecord v1 preserves order and derives a source-versioned factual summary', async () => {
  const provider = strategyProvider();
  const first = exercise(provider, 101);
  const second = exercise(provider, 202);
  const { service } = serviceFixture();
  const session = await service.startSession({
    mode: 'varied',
    requestedLength: 2,
    sessionSeed: 101,
    focus: { profile: 'balanced' },
  });
  const records = [];
  for (const currentExercise of [first, second]) {
    const shown = await service.recordExerciseShown({ sessionId: session.id, exercise: currentExercise });
    records.push(await service.recordExerciseAnswered({
      recordId: shown.id,
      evaluation: actionEvaluation(currentExercise),
      strategyResult: currentExercise.strategyResult,
      actionType: ACTION_TYPES.FOLD,
    }));
  }
  const completed = await service.finishSession(session.id, 'completed');
  const page = await service.listSessionDecisions(session.id, { limit: 10 });
  const summary = deriveTrainingSessionSummary(page);

  assert.equal(completed.schemaVersion, TRAINING_SESSION_RECORD_SCHEMA_VERSION);
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.decisionRecordIds, records.map((record) => record.id));
  assert.deepEqual(page.map((record) => record.ordinal), [0, 1]);
  assert.equal(summary.answeredCount, 2);
  assert.equal(summary.comparisonCounts.differs_from_reference, 2);
  assert.deepEqual(summary.sourceIds, ['heuristic_preflop@riverline-preflop-heuristic/v4']);
  assert.equal(Object.hasOwn(summary, 'accuracy'), false);
  validateTrainingSessionRecord(completed);

  const abandoned = await service.startSession({ mode: 'focused', sessionSeed: 303 });
  assert.equal((await service.finishSession(abandoned.id, 'abandoned')).status, 'abandoned');
});

test('local Guest/profile storage is durable, owner-isolated, versioned, and atomic', async () => {
  const database = createMemoryTrainingMemoryDatabase();
  const local = serviceFixture({ owner: identity('guest-local'), database }).service;
  const account = serviceFixture({
    owner: identity('account-future', RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE),
    database,
  }).service;
  const currentExercise = exercise();
  const session = await local.startSession({ mode: 'focused', sessionSeed: currentExercise.seed });

  assert.equal((await account.listRecentSessions({ limit: 10 })).length, 0);
  database.failNextTransaction(new Error('atomic failure'));
  await assert.rejects(
    local.recordExerciseShown({ sessionId: session.id, exercise: currentExercise }),
    /atomic failure/,
  );
  const stillEmpty = await local.listSessionDecisions(session.id, { limit: 10 });
  assert.deepEqual(stillEmpty, []);
  assert.equal(database.inspectStore(TRAINING_MEMORY_STORES.DECISIONS).length, 0);

  const shown = await local.recordExerciseShown({ sessionId: session.id, exercise: currentExercise });
  assert.equal(shown.ownerRef.ownerType, 'local_identity');
  assert.equal((await account.listRecentSessions({ limit: 10 })).length, 0);
  assert.equal(TRAINING_MEMORY_DATABASE_VERSION, 1);
  assert.deepEqual(TRAINING_MEMORY_DATABASE_MIGRATIONS.map((migration) => migration.version), [1]);
  assert.deepEqual(Object.values(TRAINING_MEMORY_STORES), ['metadata', 'sessions', 'decisions']);
  assert.equal(Object.values(TRAINING_MEMORY_INDEXES).includes('ownerReviewStateDueAt'), true);

  const createdStores = new Map();
  const migrationDatabase = {
    objectStoreNames: { contains: () => false },
    createObjectStore(name, definition) {
      const indexes = [];
      const store = {
        indexNames: { contains: () => false },
        createIndex(indexName, keyPath) { indexes.push({ indexName, keyPath }); },
      };
      createdStores.set(name, { definition, indexes });
      return store;
    },
  };
  TRAINING_MEMORY_DATABASE_MIGRATIONS[0].upgrade(migrationDatabase, {});
  assert.deepEqual([...createdStores.keys()], ['metadata', 'sessions', 'decisions']);
  assert.deepEqual(createdStores.get('metadata').definition, { keyPath: 'key' });
  assert.deepEqual(createdStores.get('sessions').indexes.map((entry) => entry.indexName), [
    'ownerStartedAt',
    'ownerStatusStartedAt',
  ]);
  assert.deepEqual(createdStores.get('decisions').indexes.map((entry) => entry.indexName), [
    'ownerSessionOrdinal',
    'ownerCreatedAt',
    'ownerReviewStateDueAt',
    'ownerSimilarityAnsweredAt',
  ]);
});

test('Review queue exposes narrow reasons and reversible lifecycle transitions', async () => {
  const { service } = serviceFixture();
  const { answered } = await answeredExerciseRecord({ service });
  let due = await service.listDueReview({ limit: 10, now: new Date('2026-09-01T00:00:00.000Z') });
  assert.equal(due.length, 1);
  assert.deepEqual(due[0].reasons, [TRAINING_REVIEW_REASON_CODES.DIFFERS_FROM_REFERENCE]);
  assert.equal(due[0].record.strategyEvidence.claimPolicy.trainingSemantics, 'comparative');
  assert.equal(due[0].priority > 0, true);

  const labelled = await service.updateStudyMetadata(answered.id, { review: true, difficult: true });
  due = await service.listDueReview({ limit: 10 });
  assert.deepEqual(new Set(due[0].reasons), new Set([
    TRAINING_REVIEW_REASON_CODES.DIFFERS_FROM_REFERENCE,
    TRAINING_REVIEW_REASON_CODES.MANUAL_REVIEW,
    TRAINING_REVIEW_REASON_CODES.MANUAL_DIFFICULT,
  ]));
  assert.equal(labelled.studyMetadata.myMistake, false);

  const reviewed = await service.markReviewed(answered.id);
  assert.equal(reviewed.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED);
  assert.equal(reviewed.reviewState.reviewCount, 1);
  assert.equal((await service.listDueReview({ limit: 10 })).length, 0);
  assert.equal((await service.reviewAgain(answered.id)).reviewState.state, 'pending');
  const snoozed = await service.snooze(answered.id, 1);
  assert.equal(snoozed.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED);
  assert.equal((await service.listDueReview({
    limit: 10,
    now: new Date('2026-08-26T10:00:00.000Z'),
  })).length, 0);
  assert.equal((await service.listDueReview({
    limit: 10,
    now: new Date('2026-09-01T00:00:00.000Z'),
  })).length, 1);
});

test('manual study flags can add and remove review lifecycle on a reference-aligned decision', async () => {
  const { service } = serviceFixture();
  const { answered } = await answeredExerciseRecord({
    service,
    actionType: ACTION_TYPES.RAISE,
  });
  assert.equal(answered.strategyEvidence.comparisonState, 'matches_reference');
  assert.equal(answered.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.NONE);

  const marked = await service.updateStudyMetadata(answered.id, {
    review: true,
    difficult: true,
  });
  assert.equal(marked.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.PENDING);
  assert.deepEqual(new Set(reviewReasonsForDecision(marked)), new Set([
    TRAINING_REVIEW_REASON_CODES.MANUAL_REVIEW,
    TRAINING_REVIEW_REASON_CODES.MANUAL_DIFFICULT,
  ]));

  const cleared = await service.updateStudyMetadata(answered.id, {
    review: false,
    difficult: false,
  });
  assert.equal(cleared.reviewState.state, TRAINING_REVIEW_LIFECYCLE_STATES.NONE);
  assert.deepEqual(reviewReasonsForDecision(cleared), []);
});

test('Same Spot exactly reproduces state and keeps the historical frozen source explicit', async () => {
  const { service } = serviceFixture();
  const fixture = await answeredExerciseRecord({ service });
  const same = await service.createSameSpot(fixture.answered.id);

  assert.equal(same.schemaVersion, 'training-same-spot/v1');
  assert.equal(same.comparison, 'historical');
  assert.deepEqual(same.exercise.pokerState, fixture.exercise.pokerState);
  assert.deepEqual(same.exercise.decisionContext, fixture.exercise.decisionContext);
  assert.deepEqual(same.exercise.legalActions, fixture.exercise.legalActions);
  assert.deepEqual(same.exercise.strategyResult, fixture.exercise.strategyResult);
  assert.equal(same.exercise.generationMetadata.memoryRedrill.comparison, 'historical');
  assert.equal(
    same.exercise.generationMetadata.memoryRedrill.sourceVersion,
    'riverline-preflop-heuristic/v4',
  );
});

test('Similar Spot uses the versioned similarity envelope and canonical planner/generator path', async () => {
  const sourceProvider = strategyProvider();
  const { service } = serviceFixture();
  const fixture = await answeredExerciseRecord({
    service,
    currentExercise: exercise(sourceProvider, 404),
  });
  const currentProviderCounter = { calls: 0 };
  const currentProvider = strategyProvider(currentProviderCounter, 'memory-current/v2');
  const similar = await service.generateSimilarSpot(fixture.answered.id, {
    strategyProvider: currentProvider,
    attempt: 1,
  });

  assert.equal(similar.ok, true, similar.error?.code);
  assert.equal(similar.similarity.schemaVersion, TRAINING_SIMILARITY_SCHEMA_VERSION);
  assert.equal(similar.similarity.policyVersion, 'training-similarity-policy/v1');
  assert.equal(similar.similarity.comparison, 'current');
  assert.equal(similar.similarity.dimensions.some(
    (dimension) => dimension.dimension === 'street' && dimension.quality === 'exact',
  ), true);
  assert.equal(similar.similarity.dimensions.some(
    (dimension) => dimension.dimension === 'effective_stack_bucket',
  ), true);
  assert.equal(similar.similarity.generatedRequest.schemaVersion, 'training-scenario-request/v1');
  assert.equal(similar.exercise.generationMetadata.scenarioRequest.request.schemaVersion,
    'training-scenario-request/v1');
  assert.equal(similar.exercise.generationMetadata.memoryRedrill.comparison, 'current');
  assert.equal(currentProviderCounter.calls > 0, true);
  assert.notDeepEqual(
    similar.exercise.decisionContext.heroCards,
    fixture.exercise.decisionContext.heroCards,
  );
  assert.equal((await service.getDecision(fixture.answered.id))
    .strategyEvidence.strategyResult.sourceVersion, 'riverline-preflop-heuristic/v4');
});

function fullHandConfiguration() {
  return {
    handId: 'memory-full-hand',
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, 2),
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 20_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 20_000 },
    ],
  };
}

function passiveFullHandAction(snapshot) {
  const spec = snapshot.currentDecision.legalActions;
  if (spec.check.available) return { type: ACTION_TYPES.CHECK, amountToMilliBb: null };
  if (spec.call.available) return { type: ACTION_TYPES.CALL, amountToMilliBb: null };
  return { type: ACTION_TYPES.FOLD, amountToMilliBb: null };
}

test('Full Hand decisions share one session replay authority and reference exact points', async () => {
  const { service } = serviceFixture();
  const provider = strategyProvider();
  const controller = createFullHandTrainingSessionController();
  const started = controller.start({
    handSeed: 707,
    heroPosition: 'BTN',
    handConfiguration: fullHandConfiguration(),
    decisionContextOptions: { stackMode: 'hero' },
  }, { strategyProvider: provider });
  assert.equal(started.ok, true);
  const memorySession = await service.startSession({ mode: 'full_hand', sessionSeed: 707 });
  let snapshot = started.snapshot;
  const recordIds = [];
  for (let boundary = 0; boundary < 10
    && snapshot.status === FULL_HAND_TRAINING_STATUSES.AWAITING_HERO; boundary += 1) {
    const shown = await service.recordFullHandDecisionShown({
      sessionId: memorySession.id,
      decision: snapshot.currentDecision,
      replaySource: snapshot.replaySource,
      handSeed: snapshot.handSeed,
    });
    recordIds.push(shown.id);
    const result = await controller.answer(
      snapshot.currentDecision.decisionId,
      passiveFullHandAction(snapshot),
    );
    assert.equal(result.ok, true, result.error?.message);
    await service.recordFullHandDecisionAnswered({
      recordId: shown.id,
      decision: result.decision,
      replaySource: result.snapshot.replaySource,
      handSeed: result.snapshot.handSeed,
    });
    snapshot = result.snapshot;
  }
  const finished = await service.finishSession(memorySession.id, 'completed', {
    fullHandSource: {
      handId: snapshot.state.handId,
      heroPlayerId: snapshot.heroPlayerId,
      replaySource: snapshot.replaySource,
    },
  });
  const decisions = await service.listSessionDecisions(memorySession.id, { limit: 20 });

  assert.equal(decisions.length >= 1, true);
  assert.deepEqual(finished.decisionRecordIds, recordIds);
  assert.equal(finished.fullHandSource.handId, 'memory-full-hand');
  assert.equal(decisions.every((record) => record.decisionSource.kind === 'full_hand_replay_point'), true);
  assert.equal(decisions.every((record) => !Object.hasOwn(record.decisionSource, 'replaySource')), true);
  assert.equal(new Set(decisions.map(
    (record) => record.decisionSource.replayPoint.eventSequence,
  )).size, decisions.length);

  const same = await service.createSameSpot(decisions[0].id);
  assert.equal(same.comparison, 'historical');
  assert.deepEqual(same.exercise.decisionContext, decisions[0].decisionContext);
  assert.deepEqual(same.exercise.legalActions, decisions[0].legalActions);
  assert.equal(same.exercise.pokerState.currentActorIndex,
    decisions[0].decisionContext.currentActorIndex);

  const incompleteEvidence = structuredClone(decisions[0]);
  incompleteEvidence.decisionContext.gameRules.semanticFingerprint = null;
  assert.equal(deriveTrainingSimilarity(incompleteEvidence).available, false);
  assert.equal(deriveTrainingSimilarity(incompleteEvidence).unavailableReason,
    'insufficient_canonical_dimensions');
});

test('live Full Hand Memory presentation is embargoed until terminal Review without rewriting evidence', () => {
  const liveSession = Object.freeze({ mode: 'full_hand', status: 'active' });
  const completedSession = Object.freeze({ mode: 'full_hand', status: 'completed' });
  const ordinarySession = Object.freeze({ mode: 'focused', status: 'active' });
  const frozenEvidence = Object.freeze({
    chosenAction: Object.freeze({ type: 'raise' }),
    source: 'frozen-provider',
    sourceVersion: 'v7',
    comparisonState: 'differs_from_reference',
    reviewReasons: Object.freeze(['differs_from_reference']),
  });
  const before = structuredClone(frozenEvidence);

  assert.deepEqual(createTrainingMemoryPresentationGate(liveSession), {
    schemaVersion: 'training-memory-presentation-gate/v1',
    feedbackEmbargoed: true,
    revealAnswerAndReference: false,
    revealReviewReasons: false,
    revealSessionVerdict: false,
  });
  assert.equal(createTrainingMemoryPresentationGate(completedSession).feedbackEmbargoed, false);
  assert.equal(createTrainingMemoryPresentationGate(completedSession).revealAnswerAndReference, true);
  assert.equal(createTrainingMemoryPresentationGate(liveSession, {
    fullHandReviewUnlocked: true,
  }).feedbackEmbargoed, false);
  assert.equal(createTrainingMemoryPresentationGate(ordinarySession).feedbackEmbargoed, false);
  assert.deepEqual(frozenEvidence, before);

  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const decisionRenderer = logic.slice(
    logic.indexOf('function renderTrainingMemoryDecisionItem('),
    logic.indexOf('async function populateTrainingMemorySessionDecisions('),
  );
  const sessionRenderer = logic.slice(
    logic.indexOf('function renderTrainingMemorySessionItem('),
    logic.indexOf('async function refreshTrainingMemoryPanel('),
  );
  assert.match(decisionRenderer, /presentationGate\.feedbackEmbargoed[\s\S]*Hidden until review[\s\S]*return item/);
  assert.ok(decisionRenderer.indexOf('return item;') < decisionRenderer.indexOf("const chosen = document.createElement('span')"));
  assert.match(sessionRenderer, /presentationGate\.revealSessionVerdict/g);
  assert.match(logic, /visibleDueCount[\s\S]*revealReviewReasons/);
});

test('abandoning Full Hand preserves answered evidence without fabricating completion', async () => {
  const { service } = serviceFixture();
  const controller = createFullHandTrainingSessionController();
  const started = controller.start({
    handSeed: 808,
    heroPosition: 'BTN',
    handConfiguration: fullHandConfiguration(),
    decisionContextOptions: { stackMode: 'hero' },
  }, { strategyProvider: strategyProvider() });
  assert.equal(started.ok, true);
  const memorySession = await service.startSession({ mode: 'full_hand', sessionSeed: 808 });
  const shown = await service.recordFullHandDecisionShown({
    sessionId: memorySession.id,
    decision: started.snapshot.currentDecision,
    replaySource: started.snapshot.replaySource,
    handSeed: started.snapshot.handSeed,
  });
  const result = await controller.answer(
    started.snapshot.currentDecision.decisionId,
    passiveFullHandAction(started.snapshot),
  );
  assert.equal(result.ok, true, result.error?.message);
  const answered = await service.recordFullHandDecisionAnswered({
    recordId: shown.id,
    decision: result.decision,
    replaySource: result.snapshot.replaySource,
    handSeed: result.snapshot.handSeed,
  });
  const abandoned = await service.finishSession(memorySession.id, 'abandoned');
  const decisions = await service.listSessionDecisions(memorySession.id, { limit: 10 });

  assert.equal(abandoned.status, 'abandoned');
  assert.deepEqual(abandoned.decisionRecordIds, [shown.id]);
  assert.equal(abandoned.fullHandSource.handId, 'memory-full-hand');
  assert.deepEqual(decisions.map((record) => record.id), [answered.id]);
  assert.equal(decisions[0].status, 'answered');
  assert.notEqual(result.snapshot.status, FULL_HAND_TRAINING_STATUSES.TERMINAL);
  assert.equal(result.snapshot.completedHandResult, null);
});

test('history queries are indexed/bounded and do not resolve strategy at startup or list time', async () => {
  const counter = { calls: 0 };
  const provider = strategyProvider(counter);
  const database = createMemoryTrainingMemoryDatabase();
  const { service } = serviceFixture({ database });
  const currentExercise = exercise(provider, 909);
  const callsAfterGeneration = counter.calls;
  for (let index = 0; index < 16; index += 1) {
    const session = await service.startSession({ mode: 'focused', sessionSeed: index });
    const shown = await service.recordExerciseShown({ sessionId: session.id, exercise: currentExercise });
    await service.recordExerciseAnswered({
      recordId: shown.id,
      evaluation: actionEvaluation(currentExercise),
      strategyResult: currentExercise.strategyResult,
      actionType: ACTION_TYPES.FOLD,
    });
    await service.finishSession(session.id, 'completed');
  }
  const before = database.getMetrics();
  const recent = await service.listRecentSessions({ limit: 5 });
  const due = await service.listDueReview({ limit: 7 });
  const after = database.getMetrics();

  assert.equal(recent.length, 5);
  assert.equal(due.length, 7);
  assert.equal(after.indexRecordsReturned - before.indexRecordsReturned <= 12, true);
  assert.equal(counter.calls, callsAfterGeneration);
});

test('Training Memory UI is lazy, semantic, localized, RTL-safe, and keeps Saved separate', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');

  assert.match(html, /id="trainingMemoryPanel"/);
  assert.match(html, /id="trainingMemoryList"[^>]*aria-labelledby=/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(logic, /handleTrainingMemoryTabKey/);
  assert.match(logic, /if \(event\.currentTarget\.open\) void refreshTrainingMemoryPanel\(\)/);
  assert.doesNotMatch(logic, /callSavedStudyBridge\([^\n]*Training Memory/);
  assert.match(logic, /cards\.dir = 'ltr'/);
  assert.match(css, /padding-inline-start/);
  assert.match(css, /:focus-visible/);
  assert.match(i18n, /trainingMemoryTranslations\.ru/);
  assert.match(i18n, /trainingMemoryTranslations\.he/);
  assert.match(i18n, /"Training Memory": "\\u0418/);
  assert.match(i18n, /"Training Memory": "\\u05d6/);
});
