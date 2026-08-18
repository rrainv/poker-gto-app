import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import { createRangeObservation } from '../app/src/personal-strategy/domain.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import {
  CALIBRATION_ENVIRONMENTS,
  createContextFromSelection,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import {
  RANGE_BUILDER_OPERATION_KINDS,
  createRangeBuilderPreview,
  getRangeBuilderSelectionSummary,
} from '../app/src/application/range-builder-service.mjs';
import {
  fromRemotePersonalStrategyEntity,
  toRemotePersonalStrategyEntity,
} from '../app/src/sync/personal-strategy-domain-adapters.mjs';

const T0 = Date.parse('2026-08-18T20:00:00.000Z');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

async function configured(name = 'range-builder-001') {
  const database = createMemoryPersonalStrategyDatabase({ name });
  const storage = memoryStorage();
  const mutations = [];
  let nextId = 0;
  let tick = 0;
  const application = createRangeCalibrationApplication({
    storage,
    database,
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(T0 + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: 'Builder profile',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  mutations.length = 0;
  const contextSelection = {
    environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  };
  const scope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: createContextFromSelection(contextSelection),
  };
  return { application, bundle, contextSelection, database, mutations, scope, storage };
}

function cell(projection, handClass) {
  return projection.cells.find((entry) => entry.handClass === handClass);
}

test('Builder preserves dominant, pure, exact, tie, provenance, and one grouped bulk commit', async () => {
  const { application, mutations, scope } = await configured('range-builder-semantics');
  await application.getStrategySnapshot(scope);
  const before = application.getProjectionCacheMetrics();
  const fiftyHands = PREFLOP_HAND_CLASSES.slice(0, 50);
  const bulk = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: [...fiftyHands].reverse(),
    operationKind: RANGE_BUILDER_OPERATION_KINDS.EXACT_MIX,
    mix: { fold: 30, raise: 70 },
  });
  assert.equal(bulk.updatedHandClasses.length, 50);
  assert.deepEqual(bulk.updatedHandClasses, fiftyHands);
  assert.equal(new Set(bulk.acceptedObservations.map((entry) => entry.provenance.actionGroupId)).size, 1);
  assert.ok(bulk.acceptedObservations.every((entry) => entry.provenance.source === 'range_builder'));
  assert.ok(bulk.acceptedObservations.every((entry) => entry.dominantAction.type === ACTION_TYPES.RAISE));
  assert.deepEqual(bulk.acceptedObservations[0].frequencies.map((entry) => entry.probability), [0.3, 0.7]);
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].entities.length, 50);
  const after = application.getProjectionCacheMetrics();
  assert.equal(after.invalidations - before.invalidations, 1);
  assert.equal(after.snapshotBuilds - before.snapshotBuilds, 1);

  const dominant = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['72o'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD,
  });
  assert.equal(dominant.acceptedObservations[0].hasExplicitFrequencies, false);
  assert.equal(dominant.acceptedObservations[0].frequencies, null);

  const pure = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['72o'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.PURE_FOLD,
  });
  assert.equal(pure.acceptedObservations[0].hasExplicitFrequencies, true);
  assert.deepEqual(pure.acceptedObservations[0].frequencies.map((entry) => entry.probability), [1]);

  const tie = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['A5s'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.EXACT_MIX,
    mix: { fold: 50, raise: 50 },
  });
  assert.equal(tie.acceptedObservations[0].dominantAction, null);
  assert.deepEqual(tie.acceptedObservations[0].frequencies.map((entry) => entry.probability), [0.5, 0.5]);
  assert.equal(cell(tie.matrixProjection, 'A5s').status, 'directly_known');
});

test('Builder corrections keep lineage and atomic undo restores the previous strategy semantics', async () => {
  const { application, scope } = await configured('range-builder-undo');
  const calibration = await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'K8s', actionType: ACTION_TYPES.RAISE,
  });
  const builder = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['K8s', 'Q8s'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD,
  });
  const k8Builder = builder.acceptedObservations.find((entry) => entry.handClass === 'K8s');
  assert.equal(k8Builder.revision.supersedesObservationId, calibration.acceptedObservation.id);
  assert.equal(cell(builder.matrixProjection, 'K8s').action.kind, 'fold');
  assert.equal(cell(builder.matrixProjection, 'Q8s').action.kind, 'fold');

  const undone = await application.undoRangeBuilderOperation(null, scope, builder.operation);
  assert.equal(undone.acceptedObservations.length, 2);
  assert.ok(undone.acceptedObservations.every((entry) => (
    entry.provenance.undoesActionGroupId === builder.actionGroupId
  )));
  assert.equal(cell(undone.matrixProjection, 'K8s').action.kind, 'raise');
  assert.equal(cell(undone.matrixProjection, 'K8s').action.precision, 'dominant_only');
  assert.notEqual(cell(undone.matrixProjection, 'Q8s').status, 'directly_known');
  assert.equal(cell(undone.matrixProjection, 'Q8s').evidence.activeDirect.length, 0);
  const snapshot = await application.repository.loadSnapshot();
  assert.equal(snapshot.rangeObservations.filter((entry) => entry.handClass === 'K8s').length, 3);
  assert.equal(snapshot.rangeObservations.filter((entry) => entry.handClass === 'Q8s').length, 2);
});

test('Builder atomically undoes a 20-hand group and refuses to undo through a later unrelated edit', async () => {
  const { application, scope } = await configured('range-builder-undo-group');
  const hands = PREFLOP_HAND_CLASSES.slice(40, 60);
  const group = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: [...hands].reverse(),
    operationKind: RANGE_BUILDER_OPERATION_KINDS.PURE_RAISE,
  });
  const undone = await application.undoRangeBuilderOperation(null, scope, group.operation);
  assert.equal(undone.updatedHandClasses.length, 20);
  assert.deepEqual(undone.updatedHandClasses, hands);
  assert.ok(undone.acceptedObservations.every((entry) => entry.state === 'retracted'));
  assert.ok(undone.acceptedObservations.every((entry) => (
    entry.provenance.undoesActionGroupId === group.actionGroupId
  )));

  const laterGroup = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: hands.slice(0, 2),
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD,
  });
  await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope,
    handClass: hands[0],
    actionType: ACTION_TYPES.RAISE,
  });
  await assert.rejects(
    () => application.undoRangeBuilderOperation(null, scope, laterGroup.operation),
    /can no longer be undone because its evidence changed/,
  );
  const snapshot = await application.repository.loadSnapshot();
  const untouchedHead = snapshot.rangeObservations.find((entry) => (
    entry.id === laterGroup.acceptedObservations[1].id
  ));
  assert.equal(untouchedHead.state, 'active');
});

test('Builder skips conflicting heads and active Calibration immediately reranks around Builder evidence', async () => {
  const { application, contextSelection, scope } = await configured('range-builder-conflicts');
  const local = await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'K8s', actionType: ACTION_TYPES.RAISE,
  });
  const remote = createRangeObservation({
    id: 'remote-conflicting-fold',
    profileId: scope.profileId,
    modeId: scope.modeId,
    context: scope.context,
    handClass: 'K8s',
    dominantAction: { type: ACTION_TYPES.FOLD },
    createdAt: new Date(T0 + 60_000).toISOString(),
  });
  await application.repository.applySyncedEntity(remote, { entityType: 'range_observation' });
  const result = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['K8s', 'A5s'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_RAISE,
  });
  assert.deepEqual(result.skippedConflictHandClasses, ['K8s']);
  assert.deepEqual(result.updatedHandClasses, ['A5s']);
  assert.equal(cell(result.matrixProjection, 'K8s').status, 'conflicting');
  assert.equal(local.acceptedObservation.id !== remote.id, true);

  let state = await application.startOrResumeSession({
    selectedProfileId: scope.profileId,
    activeModeId: scope.modeId,
    context: contextSelection,
  });
  const prompted = state.prompt.handClass;
  const applied = await application.applyRangeBuilderOperation(state, scope, {
    handClasses: [prompted],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD,
  });
  state = applied.calibrationState;
  assert.equal(state.personalStrategySnapshot.estimates.find((entry) => entry.handClass === prompted).status, 'directly_known');
  assert.notEqual(state.prompt?.handClass, prompted);
  assert.equal(state.candidateRanking.some((entry) => entry.handClass === prompted), false);
});

test('Builder bulk transaction rolls back every hand on commit failure', async () => {
  const { application, database, scope } = await configured('range-builder-rollback');
  database.failNextTransaction('before_commit', new Error('injected bulk failure'), 'readwrite');
  await assert.rejects(() => application.applyRangeBuilderOperation(null, scope, {
    handClasses: PREFLOP_HAND_CLASSES.slice(0, 10),
    operationKind: RANGE_BUILDER_OPERATION_KINDS.DOMINANT_RAISE,
  }), /could not be saved|injected bulk failure/i);
  const snapshot = await application.repository.loadSnapshot();
  assert.equal(snapshot.rangeObservations.length, 0);
});

test('Builder selection and preview are session-only read models and never become evidence', async () => {
  const { application, scope } = await configured('range-builder-preview');
  const projection = await application.getPersonalStrategyMatrixProjection(scope);
  const before = await application.repository.loadSnapshot();
  const summary = getRangeBuilderSelectionSummary(projection, ['AA', 'A5s', '72o']);
  const preview = createRangeBuilderPreview(
    projection,
    ['AA', 'A5s', '72o'],
    RANGE_BUILDER_OPERATION_KINDS.DOMINANT_RAISE,
  );
  assert.equal(summary.selectedCount, 3);
  assert.equal(preview.evidenceWrites, 0);
  assert.deepEqual(preview.selectedHandClasses, ['AA', 'A5s', '72o']);
  const after = await application.repository.loadSnapshot();
  assert.equal(after.revision, before.revision);
  assert.equal(after.rangeObservations.length, 0);
});

test('Builder evidence survives reload, stays mode-scoped, and round-trips through canonical sync', async () => {
  const {
    application, bundle, database, scope, storage,
  } = await configured('range-builder-persistence-sync');
  const applied = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: ['AA', 'A5s', '72o'],
    operationKind: RANGE_BUILDER_OPERATION_KINDS.EXACT_MIX,
    mix: { fold: 25, raise: 75 },
  });
  const remote = toRemotePersonalStrategyEntity(applied.acceptedObservations[0]);
  const restored = fromRemotePersonalStrategyEntity(remote, application.ownerRef);
  assert.deepEqual(restored, applied.acceptedObservations[0]);
  assert.equal(remote.payload.provenance.source, 'range_builder');
  assert.equal(remote.payload.provenance.actionGroupId, applied.actionGroupId);

  const otherModeProjection = await application.getPersonalStrategyMatrixProjection({
    ...scope,
    modeId: bundle.modes[1].id,
  });
  assert.equal(cell(otherModeProjection, 'AA').status, 'unknown');
  let nextReloadId = 10_000;
  const reloaded = createRangeCalibrationApplication({
    storage,
    database,
    idFactory: (prefix) => `${prefix}-${++nextReloadId}`,
    clock: () => new Date(T0 + 120_000),
  });
  const projection = await reloaded.getPersonalStrategyMatrixProjection(scope);
  assert.equal(cell(projection, 'AA').status, 'directly_known');
  assert.equal(cell(projection, 'AA').action.precision, 'exact_mix');
  assert.deepEqual(
    cell(projection, 'AA').action.exactFrequencies.map((entry) => entry.probability),
    [0.25, 0.75],
  );
  const workspace = await reloaded.readWorkspace();
  assert.equal(workspace.profiles[0].modes.length, 3);
});

test('Builder architecture and UI preserve boundaries, grouped writes, keyboard selection, and non-color state', async () => {
  const [builderSource, workspaceSource, repositorySource, html, css] = await Promise.all([
    readFile(new URL('../app/src/application/range-builder-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/personal-strategy/repository.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(builderSource, /StrategyProvider|Equity|HoldemWeightedRange|rangeWeight/);
  assert.doesNotMatch(builderSource, /saveRangeObservation\(/);
  assert.match(builderSource, /saveRangeObservationBatch\(observations\)/);
  assert.match(repositorySource, /async saveRangeObservationBatch\(observations\)/);
  assert.doesNotMatch(workspaceSource, /saveRangeObservationBatch|loadRangeHeadsScope/);
  assert.match(workspaceSource, /event\.shiftKey[\s\S]*event\.ctrlKey \|\| event\.metaKey/);
  assert.match(workspaceSource, /pointerdown[\s\S]*pointerover[\s\S]*pointerup/);
  assert.match(workspaceSource, /event\.key === ' '/);
  assert.match(workspaceSource, /event\.key\.toLowerCase\(\) === 'z'/);
  assert.match(html, /id="calibrationBuilderToolbar"[\s\S]*role="toolbar"/);
  assert.match(html, /data-builder-operation="dominant_fold"/);
  assert.match(html, /data-builder-operation="pure_fold"/);
  assert.match(html, /data-builder-operation="exact_mix"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /\.calibration-matrix-cell\[aria-selected="true"\][\s\S]*box-shadow/);
  assert.match(css, /data-builder-touched/);
});
