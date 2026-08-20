import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  CALIBRATION_ENVIRONMENTS,
  PERSONAL_STRATEGY_STALE_SCOPE_ERROR,
  createContextFromSelection,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import { createPersonalStrategyScopeLifecycle } from '../app/src/application/personal-strategy-scope-lifecycle.mjs';
import { RANGE_BUILDER_OPERATION_KINDS } from '../app/src/application/range-builder-service.mjs';
import {
  createCalibrationSession,
  createRangeObservation,
  updateCalibrationSession,
} from '../app/src/personal-strategy/domain.mjs';
import { RANGE_TEACHER_SESSION_PRESETS } from '../app/src/personal-strategy/range-teacher-view.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import {
  createRangeCalibrationSyncAdapter,
  toRemotePersonalStrategyEntity,
} from '../app/src/sync/index.mjs';

const STARTED_AT = '2026-08-20T10:00:00.000Z';
const OLDER_AT = '2026-08-20T10:01:00.000Z';
const NEWER_AT = '2026-08-20T10:02:00.000Z';
const LATEST_AT = '2026-08-20T10:03:00.000Z';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function selection(overrides = {}) {
  return {
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    ...overrides,
  };
}

function scope(profileId, modeId, contextSelection = selection()) {
  return {
    profileId,
    modeId,
    context: createContextFromSelection(contextSelection),
  };
}

async function configuredApplication(name) {
  const database = createMemoryPersonalStrategyDatabase({ name });
  const mutations = [];
  let nextId = 0;
  let tick = 0;
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database,
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(Date.parse(STARTED_AT) + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: 'Scope safety',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const scopeA = scope(bundle.profile.id, bundle.modes[0].id);
  const stateA = await application.startOrResumeSession({
    selectedProfileId: scopeA.profileId,
    activeModeId: scopeA.modeId,
    context: selection(),
  });
  mutations.length = 0;
  return { application, bundle, database, mutations, scopeA, stateA };
}

test('Matrix and Builder reject an active-state scope mismatch before any repository write', async () => {
  const { application, bundle, database, mutations, stateA } = await configuredApplication(
    'range-intelligence-002r-scope-mismatch',
  );
  const scopeB = scope(bundle.profile.id, bundle.modes[1].id);
  const beforeMetrics = database.getMetrics();
  const beforeSnapshot = await application.repository.loadSnapshot();

  await assert.rejects(
    application.recordPersonalStrategyMatrixEvidence(stateA, {
      ...scopeB,
      handClass: 'AA',
      actionType: 'raise',
    }),
    (error) => error.code === PERSONAL_STRATEGY_STALE_SCOPE_ERROR,
  );
  await assert.rejects(
    application.applyRangeBuilderOperation(stateA, scopeB, {
      handClasses: ['KK', 'QQ'],
      operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_RAISE,
    }),
    (error) => error.code === PERSONAL_STRATEGY_STALE_SCOPE_ERROR,
  );

  const afterSnapshot = await application.repository.loadSnapshot();
  assert.equal(database.getMetrics().readwrite, beforeMetrics.readwrite);
  assert.deepEqual(afterSnapshot.rangeObservations, beforeSnapshot.rangeObservations);
  assert.deepEqual(afterSnapshot.calibrationSessions, beforeSnapshot.calibrationSessions);
  assert.equal(mutations.length, 0);
});

test('remote session reconciliation makes every stale Calibration cursor action zero-write', async () => {
  const { application, mutations, stateA } = await configuredApplication(
    'range-intelligence-002r-stale-calibration-actions',
  );
  const reconciled = updateCalibrationSession(stateA.session, {
    state: 'paused',
    cursor: {
      ...stateA.session.cursor,
      lastStopReason: 'user_paused',
    },
  }, stateA.session.updatedAt);
  await application.repository.saveCalibrationSession(reconciled, {
    expectedSession: stateA.session,
  });
  const before = await application.repository.loadSnapshot();

  const staleActions = [
    () => application.answerCalibrationQuestion(stateA, { actionType: 'raise' }),
    () => application.pauseSession(stateA),
    () => application.skipCalibrationQuestion(stateA),
    () => application.requestAdditionalQuestion(stateA),
    () => application.requestPersonalStrategyMatrixQuestion(stateA, stateA.prompt.handClass),
    () => application.requestRangeTeacherSession(stateA, {
      preset: RANGE_TEACHER_SESSION_PRESETS.QUICK_PROFILE,
    }),
  ];
  for (const action of staleActions) {
    await assert.rejects(action, /CalibrationSession changed since the (?:action|question) was presented/);
  }

  const after = await application.repository.loadSnapshot();
  assert.deepEqual(after.rangeObservations, before.rangeObservations);
  assert.deepEqual(after.calibrationSessions, before.calibrationSessions);
  assert.equal(mutations.length, 0);
});

test('scope activation synchronously clears Matrix, Teacher, selection, and Builder targets', () => {
  const scopeA = scope('profile-a', 'mode-a');
  const scopeB = scope('profile-b', 'mode-b');
  const presentation = {};
  const lifecycle = createPersonalStrategyScopeLifecycle({
    onInvalidate() {
      presentation.matrix = null;
      presentation.inspector = null;
      presentation.selectedHand = null;
      presentation.teacher = null;
      presentation.builderSelection = [];
      presentation.builderPreview = null;
    },
  });
  lifecycle.activate(scopeA);
  Object.assign(presentation, {
    matrix: { scope: 'A' },
    inspector: { handClass: 'K8s' },
    selectedHand: 'K8s',
    teacher: { scope: 'A' },
    builderSelection: ['K8s'],
    builderPreview: 'dominant_raise',
  });
  const stale = lifecycle.capture(scopeA);

  lifecycle.activate(scopeB);
  assert.deepEqual(presentation, {
    matrix: null,
    inspector: null,
    selectedHand: null,
    teacher: null,
    builderSelection: [],
    builderPreview: null,
  });
  assert.equal(lifecycle.isCurrent(stale, scopeB), false);
});

async function delayedAdoption(kind) {
  const scopeA = scope('profile-a', 'mode-a');
  const scopeB = scope('profile-b', 'mode-b');
  const adopted = { matrix: null, builder: null };
  const lifecycle = createPersonalStrategyScopeLifecycle();
  lifecycle.activate(scopeA);
  const operationToken = lifecycle.revise(scopeA);
  let resolve;
  const delayed = new Promise((done) => { resolve = done; });
  const pending = delayed.then((result) => lifecycle.adopt(operationToken, scopeA, () => {
    adopted[kind] = result;
  }));
  lifecycle.activate(scopeB);
  resolve({ scope: 'A' });
  assert.equal(await pending, false);
  assert.equal(adopted[kind], null);
}

test('a delayed Matrix mutation result cannot be adopted after a scope switch', async () => {
  await delayedAdoption('matrix');
});

test('a delayed Builder mutation result cannot be adopted after a scope switch', async () => {
  await delayedAdoption('builder');
});

test('switching A to B to A never revalidates an old operation token or adopts its rejection', async () => {
  const scopeA = scope('profile-a', 'mode-a');
  const scopeB = scope('profile-b', 'mode-b');
  const lifecycle = createPersonalStrategyScopeLifecycle();
  lifecycle.activate(scopeA);
  const stale = lifecycle.revise(scopeA);
  let adoptedError = null;
  let reject;
  const operation = new Promise((resolve, rejectPromise) => { reject = rejectPromise; })
    .catch((error) => lifecycle.adopt(stale, scopeA, () => { adoptedError = error; }));

  lifecycle.activate(scopeB);
  lifecycle.activate(scopeA);
  reject(new Error('late scope A failure'));

  assert.equal(await operation, false);
  assert.equal(lifecycle.isCurrent(stale, scopeA), false);
  assert.equal(adoptedError, null);
});

test('generation identity covers Profile, Mode, and every supported CalibrationContext field', () => {
  const base = scope('profile-a', 'mode-a');
  const variants = [
    scope('profile-b', 'mode-a'),
    scope('profile-a', 'mode-b'),
    scope('profile-a', 'mode-a', selection({ tableSize: 9 })),
    scope('profile-a', 'mode-a', selection({ heroPosition: 'CO' })),
    scope('profile-a', 'mode-a', selection({ effectiveStackBb: 60 })),
    scope('profile-a', 'mode-a', selection({
      environment: CALIBRATION_ENVIRONMENTS.CLUBGG,
      tableSize: 8,
    })),
  ];
  for (const variant of variants) {
    let clearCount = 0;
    const lifecycle = createPersonalStrategyScopeLifecycle({
      onInvalidate: () => { clearCount += 1; },
    });
    const oldToken = lifecycle.activate(base);
    lifecycle.activate(variant);
    assert.equal(clearCount, 2);
    assert.equal(lifecycle.isCurrent(oldToken, variant), false);
  }
});

function session({
  state,
  updatedAt,
  completedAt = state === 'completed' ? updatedAt : null,
  nextPromptIndex = 0,
  askedHandClasses = [],
  skippedHandClasses = [],
  notSureHandClasses = [],
  additionalQuestionAllowance = 0,
  observationIds = [],
  sessionQuestionCount = askedHandClasses.length,
} = {}) {
  return createCalibrationSession({
    id: 'shared-session',
    profileId: 'profile-sync',
    modeId: 'mode-sync',
    contextScope: scope('profile-sync', 'mode-sync').context,
    startedAt: STARTED_AT,
    updatedAt,
    state,
    completedAt,
    observationIds,
    nextPromptIndex,
    cursor: {
      askedHandClasses,
      skippedHandClasses,
      notSureHandClasses,
      sessionQuestionCount,
      additionalQuestionAllowance,
      lastStopReason: state === 'paused' ? 'user_paused' : null,
    },
  });
}

function syncAdapter() {
  return createRangeCalibrationSyncAdapter({
    syncPort: {
      listEntities: async () => [],
      getEntityById: async () => null,
      applyRemoteEntity: async () => {},
      ownerRef: async () => ({ kind: 'local', id: 'sync-owner' }),
    },
  });
}

function remote(value, remoteRevision = 3) {
  return toRemotePersonalStrategyEntity(value, { remoteRevision });
}

function mergeSessions(left, right, { leftRevision = 3, rightRevision = 3 } = {}) {
  return syncAdapter().mergeRemote({
    localDocument: remote(left, leftRevision),
    remoteDocument: remote(right, rightRevision),
    baseObject: null,
  });
}

function isSubsequence(sequence, merged) {
  let index = 0;
  for (const value of merged) if (value === sequence[index]) index += 1;
  return index === sequence.length;
}

test('newer active/resumed and paused metadata override an older completed snapshot', () => {
  const completed = session({
    state: 'completed',
    updatedAt: OLDER_AT,
    nextPromptIndex: 169,
    additionalQuestionAllowance: 1,
    askedHandClasses: ['AA', '72o'],
  });
  const resumed = session({
    state: 'active',
    updatedAt: NEWER_AT,
    nextPromptIndex: 31,
    additionalQuestionAllowance: 0,
    askedHandClasses: ['AA', '72o', 'K8s'],
  });
  const activeMerge = mergeSessions(completed, resumed).payload;
  assert.equal(activeMerge.state, 'active');
  assert.equal(activeMerge.completedAt, null);
  assert.equal(activeMerge.cursor.nextPromptIndex, 31);

  const paused = session({
    state: 'paused',
    updatedAt: NEWER_AT,
    nextPromptIndex: 44,
    askedHandClasses: ['AA', '72o', 'T9s'],
  });
  const pausedMerge = mergeSessions(completed, paused).payload;
  assert.equal(pausedMerge.state, 'paused');
  assert.equal(pausedMerge.completedAt, null);
  assert.equal(pausedMerge.cursor.lastStopReason, 'user_paused');
  assert.equal(pausedMerge.cursor.nextPromptIndex, 44);
});

test('consumed Ask-another allowance stays consumed and ordered cursor histories survive merge', () => {
  const older = session({
    state: 'completed',
    updatedAt: OLDER_AT,
    nextPromptIndex: 169,
    additionalQuestionAllowance: 1,
    observationIds: ['obs-aa', 'obs-q9o'],
    askedHandClasses: ['AA', 'Q9o'],
    skippedHandClasses: ['72o', 'AJo'],
    notSureHandClasses: ['Q9o', '44'],
  });
  const newer = session({
    state: 'active',
    updatedAt: NEWER_AT,
    nextPromptIndex: 52,
    additionalQuestionAllowance: 0,
    observationIds: ['obs-aa', 'obs-k8s'],
    askedHandClasses: ['AA', 'K8s'],
    skippedHandClasses: ['72o', 'T9s'],
    notSureHandClasses: ['Q9o', 'A5s'],
  });
  const merged = mergeSessions(older, newer).payload;
  assert.equal(merged.cursor.additionalQuestionAllowance, 0);
  assert.equal(merged.cursor.askedHandClasses.at(-1), 'K8s');
  assert.equal(merged.cursor.skippedHandClasses.at(-1), 'T9s');
  assert.equal(merged.cursor.notSureHandClasses.at(-1), 'A5s');
  assert.equal(isSubsequence(older.cursor.askedHandClasses, merged.cursor.askedHandClasses), true);
  assert.equal(isSubsequence(newer.cursor.askedHandClasses, merged.cursor.askedHandClasses), true);
  assert.equal(isSubsequence(older.cursor.skippedHandClasses, merged.cursor.skippedHandClasses), true);
  assert.equal(isSubsequence(newer.cursor.notSureHandClasses, merged.cursor.notSureHandClasses), true);
  assert.notDeepEqual(
    merged.cursor.askedHandClasses,
    [...new Set(merged.cursor.askedHandClasses)].sort(
      (left, right) => PREFLOP_HAND_CLASSES.indexOf(left) - PREFLOP_HAND_CLASSES.indexOf(right),
    ),
  );
});

test('equal-time session metadata follows the higher document revision without cursor regression', () => {
  const lowerRevisionPaused = session({
    state: 'paused',
    updatedAt: NEWER_AT,
    nextPromptIndex: 88,
    additionalQuestionAllowance: 1,
    askedHandClasses: ['AA', 'K8s'],
    sessionQuestionCount: 12,
  });
  const higherRevisionActive = session({
    state: 'active',
    updatedAt: NEWER_AT,
    nextPromptIndex: 31,
    additionalQuestionAllowance: 0,
    askedHandClasses: ['AA', 'Q9o'],
    sessionQuestionCount: 3,
  });
  const forward = mergeSessions(lowerRevisionPaused, higherRevisionActive, {
    leftRevision: 2,
    rightRevision: 8,
  });
  const reverse = mergeSessions(higherRevisionActive, lowerRevisionPaused, {
    leftRevision: 8,
    rightRevision: 2,
  });

  assert.deepEqual(forward, reverse);
  assert.equal(forward.revision, 9);
  assert.equal(forward.payload.state, 'active');
  assert.equal(forward.payload.cursor.nextPromptIndex, 31);
  assert.equal(forward.payload.cursor.additionalQuestionAllowance, 0);
  assert.equal(forward.payload.cursor.sessionQuestionCount, 12);
});

test('completed to resumed to completed histories retain immutable facts and final lifecycle', () => {
  const initialCompleted = session({
    state: 'completed',
    updatedAt: OLDER_AT,
    observationIds: ['obs-aa'],
    askedHandClasses: ['AA'],
  });
  const resumed = session({
    state: 'active',
    updatedAt: NEWER_AT,
    nextPromptIndex: 31,
    observationIds: ['obs-aa', 'obs-k8s'],
    askedHandClasses: ['AA', 'K8s'],
  });
  const completedAgain = session({
    state: 'completed',
    updatedAt: LATEST_AT,
    nextPromptIndex: 169,
    observationIds: ['obs-aa', 'obs-k8s', 'obs-q9o'],
    askedHandClasses: ['AA', 'K8s', 'Q9o'],
  });

  const resumedMerge = mergeSessions(initialCompleted, resumed);
  const finalMerge = syncAdapter().mergeRemote({
    localDocument: resumedMerge,
    remoteDocument: remote(completedAgain),
    baseObject: null,
  });
  assert.equal(finalMerge.payload.state, 'completed');
  assert.equal(finalMerge.payload.completedAt, LATEST_AT);
  assert.deepEqual(finalMerge.payload.observationIds, ['obs-aa', 'obs-k8s', 'obs-q9o']);
  assert.equal(
    isSubsequence(initialCompleted.cursor.askedHandClasses, finalMerge.payload.cursor.askedHandClasses),
    true,
  );
  assert.equal(
    isSubsequence(completedAgain.cursor.askedHandClasses, finalMerge.payload.cursor.askedHandClasses),
    true,
  );
});

test('session reconciliation is commutative and idempotent under duplicate delivery', () => {
  const older = session({
    state: 'completed',
    updatedAt: OLDER_AT,
    askedHandClasses: ['AA', 'K8s'],
    skippedHandClasses: ['72o'],
    observationIds: ['obs-aa', 'obs-k8s'],
  });
  const newer = session({
    state: 'active',
    updatedAt: NEWER_AT,
    nextPromptIndex: 70,
    askedHandClasses: ['AA', 'Q9o'],
    notSureHandClasses: ['Q9o'],
    observationIds: ['obs-aa', 'obs-q9o'],
  });
  const forward = mergeSessions(older, newer);
  const reverse = mergeSessions(newer, older);
  assert.deepEqual(forward, reverse);
  const repeated = syncAdapter().mergeRemote({
    localDocument: forward,
    remoteDocument: remote(newer),
    baseObject: null,
  });
  assert.deepEqual(repeated, forward);
});

test('conflicting immutable direct evidence retains the existing fail-closed merge behavior', () => {
  const base = {
    id: 'immutable-evidence',
    profileId: 'profile-sync',
    modeId: 'mode-sync',
    context: scope('profile-sync', 'mode-sync').context,
    handClass: 'K8s',
    createdAt: OLDER_AT,
  };
  const raise = createRangeObservation({ ...base, dominantAction: { type: 'raise' } });
  const fold = createRangeObservation({ ...base, dominantAction: { type: 'fold' } });
  const merged = syncAdapter().mergeRemote({
    localDocument: remote(raise),
    remoteDocument: remote(fold),
    baseObject: null,
  });
  assert.equal(merged, null);
});

test('workspace routes Matrix, Teacher, and write adoption through the one scope lifecycle', async () => {
  const source = await readFile(
    new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /createPersonalStrategyScopeLifecycle/);
  assert.match(source, /onInvalidate:\s*clearPersonalStrategyPresentation/);
  assert.match(source, /beginPersonalStrategyMutation\(scope\)/);
  assert.match(source, /personalStrategyScopeLifecycle\.adopt\(lifecycleToken, scope/);
  assert.doesNotMatch(source, /matrixLoadToken|teacherLoadToken/);
});
