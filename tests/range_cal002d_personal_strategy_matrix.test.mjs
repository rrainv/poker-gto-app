import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  createPersonalStrategySnapshot,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  PERSONAL_STRATEGY_MATRIX_PRECISIONS,
  createPersonalStrategyMatrixProjection,
} from '../app/src/personal-strategy/matrix-projection.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createRangeCalibrationApplication } from '../app/src/application/range-calibration-service.mjs';

const PROFILE_ID = 'profile-002d';
const MODE_ID = 'mode-002d';
const T0 = Date.parse('2026-08-18T18:00:00.000Z');

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    ...overrides,
  });
}

let evidenceSequence = 0;
function direct(handClass, actionType, overrides = {}) {
  evidenceSequence += 1;
  return createRangeObservation({
    id: overrides.id ?? `matrix-evidence-${evidenceSequence}`,
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? context(),
    handClass,
    dominantAction: actionType === null ? null : { type: actionType },
    frequencies: overrides.frequencies ?? null,
    supersedesObservationId: overrides.supersedesObservationId ?? null,
    createdAt: overrides.createdAt ?? new Date(T0 + evidenceSequence * 1000).toISOString(),
  });
}

function exact(handClass, fold, raise, overrides = {}) {
  return direct(handClass, fold === raise ? null : (raise > fold ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD), {
    ...overrides,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, probability: fold },
      { action: { type: ACTION_TYPES.RAISE }, probability: raise },
    ],
  });
}

function evidenceView(rangeObservations = [], overrides = {}) {
  return createPersonalStrategyEvidenceView({
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? context(),
    rangeObservations,
    trainingObservations: [],
  });
}

function matrix(rangeObservations = [], overrides = {}) {
  const view = evidenceView(rangeObservations, overrides);
  return createPersonalStrategyMatrixProjection({
    evidenceView: view,
    snapshot: createPersonalStrategySnapshot(view),
  });
}

function cell(projection, handClass) {
  return projection.cells.find((entry) => entry.handClass === handClass);
}

test('Matrix exposes exactly 169 canonical cells and keeps action precision separate from provenance', () => {
  const projection = matrix([
    direct('K8s', ACTION_TYPES.RAISE),
    direct('K7s', ACTION_TYPES.FOLD),
    exact('K9s', 0, 1),
    exact('KTs', 0.25, 0.75),
    exact('KJs', 0.5, 0.5),
    direct('Q8s', ACTION_TYPES.RAISE, { id: 'conflict-raise' }),
    direct('Q8s', ACTION_TYPES.FOLD, { id: 'conflict-fold' }),
  ]);

  assert.equal(projection.cells.length, 169);
  assert.deepEqual(projection.cells.map((entry) => entry.handClass), PREFLOP_HAND_CLASSES);
  assert.equal(cell(projection, 'K8s').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.equal(cell(projection, 'K8s').action.kind, 'raise');
  assert.equal(cell(projection, 'K8s').action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.DOMINANT_ONLY);
  assert.equal(cell(projection, 'K8s').action.exactFrequencies, null);
  assert.equal(cell(projection, 'K7s').action.kind, 'fold');
  assert.equal(cell(projection, 'K9s').action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.PURE_EXPLICIT);
  assert.equal(cell(projection, 'KTs').action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.EXACT_MIX);
  assert.equal(cell(projection, 'KJs').action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.TIED_EXACT_MIX);
  assert.equal(cell(projection, 'Q8s').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING);
  assert.equal(cell(projection, 'Q8s').action.kind, 'conflict');
  assert.equal(cell(projection, 'Q8s').evidence.activeDirect.length, 2);
  assert.doesNotMatch(JSON.stringify(projection), /"weight"\s*:/);
});

test('Matrix maps inferred high, inferred medium, uncertain, and unknown without fake frequencies', () => {
  const stableRaiseHands = ['AQs', 'ATs', 'A9s', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'];
  const high = matrix(stableRaiseHands.map((handClass) => direct(handClass, ACTION_TYPES.RAISE)));
  const highCell = cell(high, 'AJs');
  assert.equal(highCell.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);
  assert.equal(highCell.action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.DOMINANT_ONLY);
  assert.equal(highCell.action.exactFrequencies, null);
  assert.ok(highCell.support.selectedNeighbors.length > 0);
  assert.ok(highCell.support.selectedNeighbors.some((neighbor) => neighbor.evidence.length > 0));
  assert.ok(highCell.reasons.length > 0);

  const medium = matrix(['AQs', 'ATs', 'KJs']
    .map((handClass) => direct(handClass, ACTION_TYPES.RAISE)));
  assert.equal(cell(medium, 'AJs').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM);
  assert.equal(cell(medium, 'AJs').action.exactFrequencies, null);

  const boundary = matrix([
    direct('AQs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.FOLD),
    exact('KJs', 0.5, 0.5),
    direct('KTs', ACTION_TYPES.RAISE),
  ]);
  assert.equal(cell(boundary, 'AJs').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN);
  assert.equal(cell(boundary, 'AJs').action.kind, 'none');
  assert.equal(cell(matrix(), '72o').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('Matrix confirmations and corrections append canonical source evidence and remain scope-isolated', async () => {
  let nextId = 0;
  let tick = 0;
  const mutations = [];
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name: 'range-cal002d-corrections' }),
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(T0 + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: 'Matrix corrections',
    description: '',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  mutations.length = 0;
  const scope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: context(),
  };

  const stableRaiseHands = ['AQs', 'ATs', 'A9s', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs'];
  for (const handClass of stableRaiseHands) {
    await application.recordPersonalStrategyMatrixEvidence(null, {
      ...scope, handClass, actionType: ACTION_TYPES.RAISE,
    });
  }
  let projection = await application.getPersonalStrategyMatrixProjection(scope);
  assert.equal(cell(projection, 'AJs').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);

  const confirmed = await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'AJs', actionType: cell(projection, 'AJs').action.dominantAction,
  });
  let confirmedCell = cell(confirmed.matrixProjection, 'AJs');
  assert.equal(confirmedCell.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.equal(confirmedCell.action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.DOMINANT_ONLY);
  assert.equal(confirmedCell.action.exactFrequencies, null);

  const changed = await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'AJs', actionType: ACTION_TYPES.FOLD,
  });
  assert.equal(changed.acceptedObservation.revision.supersedesObservationId, confirmed.acceptedObservation.id);
  assert.equal(cell(changed.matrixProjection, 'AJs').action.kind, 'fold');
  assert.equal(cell(changed.matrixProjection, 'AJs').evidence.supersededDirect.length, 1);

  const mixed = await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'AJs', mix: { fold: 25, raise: 75 },
  });
  const mixedCell = cell(mixed.matrixProjection, 'AJs');
  assert.equal(mixedCell.action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.EXACT_MIX);
  assert.deepEqual(mixedCell.action.exactFrequencies.map((entry) => entry.probability), [0.25, 0.75]);
  assert.equal(mixed.acceptedObservation.revision.supersedesObservationId, changed.acceptedObservation.id);

  const serializedMutations = JSON.stringify(mutations);
  assert.doesNotMatch(serializedMutations, /personalStrategySnapshot|inferred_high|matrixProjection/);
  assert.ok(mutations.every((mutation) => mutation.entities.every((entity) => (
    entity.schemaVersion === 'range-observation/v1'
  ))));

  const otherMode = await application.getPersonalStrategyMatrixProjection({
    ...scope,
    modeId: bundle.modes[1].id,
  });
  assert.equal(cell(otherMode, 'AJs').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN);
  projection = await application.getPersonalStrategyMatrixProjection(scope);
  assert.equal(cell(projection, 'AJs').status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.equal(cell(projection, 'AJs').action.precision, PERSONAL_STRATEGY_MATRIX_PRECISIONS.EXACT_MIX);
});

test('Matrix architecture is snapshot-derived, bounded, keyboard-oriented, and renderer-write-free', async () => {
  const [projectionSource, workspaceSource, serviceSource, html] = await Promise.all([
    readFile(new URL('../app/src/personal-strategy/matrix-projection.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(projectionSource, /StrategyProvider|Equity|WeightedHoldemRange|1326/);
  assert.doesNotMatch(workspaceSource, /saveRangeObservation|createRangeObservation/);
  assert.doesNotMatch(workspaceSource, /personal-strategy-sync|sync-adapter/);
  assert.match(serviceSource, /getProjectionBundle\(scope\)/);
  assert.match(serviceSource, /saveRangeObservation\(observation\)/);
  assert.match(serviceSource, /notifyLocalMutation\(\[observation\]\)/);
  assert.match(workspaceSource, /ArrowLeft:[\s\S]*ArrowDown/);
  assert.match(workspaceSource, /tabIndex = cell\.handClass === matrixSelectedHand/);
  assert.match(workspaceSource, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(html, /role="grid" aria-rowcount="13" aria-colcount="13"/);
  assert.match(html, /id="calibrationMixDialog"[\s\S]*aria-modal="true"/);
});
