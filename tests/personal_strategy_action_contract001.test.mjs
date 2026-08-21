import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS,
  PERSONAL_STRATEGY_ACTION_IDS,
  PERSONAL_STRATEGY_ACTION_VALUE_STATES,
  PERSONAL_STRATEGY_RFI_ACTION_SET,
  createPersonalStrategyActionEstimateV2,
  createPersonalStrategyActionSet,
  createPersonalStrategyEvidenceView,
  createPersonalStrategySnapshot,
  createRangeObservation,
  createRfiCalibrationContext,
  estimatePersonalStrategyHand,
  getPersonalStrategyActionPresentationOrder,
  normalizePersonalStrategyExactDistribution,
  projectActionEvidenceV2ToRfiValue,
  projectActionEstimateV2ToRfiEstimateV1,
  projectPersonalStrategyEstimateV1ToActionEstimateV2,
  projectRangeObservationV1ToActionEvidenceV2,
  serializePersonalStrategyActionEstimateV2,
  serializePersonalStrategyActionSet,
} from '../app/src/personal-strategy/index.mjs';
import {
  RFI_INFERENCE_STATUSES,
  createRfiInferenceRequest,
  inferSparseRfiHand,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  createPersonalStrategyMatrixProjection,
} from '../app/src/personal-strategy/matrix-projection.mjs';
import {
  createRangeTeacherView,
} from '../app/src/personal-strategy/range-teacher-view.mjs';
import {
  RANGE_BUILDER_OPERATION_KINDS,
  createRangeBuilderPreview,
} from '../app/src/application/range-builder-service.mjs';
import {
  PERSONAL_STRATEGY_ENTITY_TYPES,
  toRemotePersonalStrategyEntity,
} from '../app/src/sync/personal-strategy-domain-adapters.mjs';

const CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'action-contract-test-rules',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});

function observation({
  id,
  handClass = 'A5s',
  action = ACTION_TYPES.RAISE,
  frequencies = null,
  supersedesObservationId = null,
} = {}) {
  return createRangeObservation({
    id,
    profileId: 'profile-action-contract',
    modeId: 'mode-action-contract',
    context: CONTEXT,
    handClass,
    dominantAction: action === null ? null : { type: action },
    frequencies,
    supersedesObservationId,
    createdAt: `2026-08-21T10:00:${id.endsWith('2') ? '02' : '01'}.000Z`,
  });
}

function evidenceView(rangeObservations) {
  return createPersonalStrategyEvidenceView({
    profileId: 'profile-action-contract',
    modeId: 'mode-action-contract',
    context: CONTEXT,
    rangeObservations,
  });
}

function actionEstimate(overrides = {}) {
  return createPersonalStrategyActionEstimateV2({
    actionSet: overrides.actionSet ?? PERSONAL_STRATEGY_RFI_ACTION_SET,
    target: overrides.target ?? { kind: 'hand_class', id: 'A5s' },
    valueState: overrides.valueState ?? PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE,
    dominantAction: Object.hasOwn(overrides, 'dominantAction')
      ? overrides.dominantAction : undefined,
    exactDistribution: overrides.exactDistribution ?? null,
    uncertainty: overrides.uncertainty ?? null,
    provenance: overrides.provenance ?? { type: 'direct', sourceSchema: 'test/v1' },
    sourceType: overrides.sourceType ?? 'direct_calibration',
    contradictions: overrides.contradictions ?? [],
    sourceEvidenceIds: overrides.sourceEvidenceIds ?? [],
  });
}

test('canonical Personal Strategy actions reuse bounded poker identities without adding Limp/Complete', () => {
  assert.deepEqual(Object.values(PERSONAL_STRATEGY_ACTION_IDS), [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CHECK,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
    ACTION_TYPES.ALL_IN,
  ]);
  assert.equal(Object.values(PERSONAL_STRATEGY_ACTION_IDS).includes(ACTION_TYPES.BET), false);
  assert.equal(Object.values(PERSONAL_STRATEGY_ACTION_IDS).includes('limp'), false);
  assert.equal(Object.values(PERSONAL_STRATEGY_ACTION_IDS).includes('complete'), false);
});

test('legal action sets are context-specific, canonical, and separate from presentation order', () => {
  assert.deepEqual(
    PERSONAL_STRATEGY_RFI_ACTION_SET.legalActions.map((entry) => entry.type),
    [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE],
  );
  const facingOpen = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.RAISE, ACTION_TYPES.FOLD, ACTION_TYPES.CALL],
  });
  assert.deepEqual(facingOpen.legalActions.map((entry) => entry.type), [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
  ]);
  assert.deepEqual(
    getPersonalStrategyActionPresentationOrder(facingOpen, [
      ACTION_TYPES.CALL,
      ACTION_TYPES.RAISE,
      ACTION_TYPES.FOLD,
    ]).map((entry) => entry.type),
    [ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.FOLD],
  );
  assert.deepEqual(facingOpen.legalActions.map((entry) => entry.type), [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
  ]);
});

test('action-set validation rejects duplicate, unknown, and illegal RFI actions', () => {
  assert.throws(() => createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.FOLD],
  }), /repeat/);
  assert.throws(() => createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.BET],
  }), /supported Personal Strategy action identity/);
  assert.throws(() => createPersonalStrategyActionSet({
    decisionFamily: 'preflop_rfi',
    legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE],
  }), /require Fold and Raise/);
});

test('dominant-only guidance remains qualitative and never manufactures exact frequencies', () => {
  const estimate = actionEstimate({ dominantAction: ACTION_TYPES.RAISE });
  assert.deepEqual(estimate.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(estimate.exactDistribution, null);
});

test('exact pure action stores deterministic explicit zeros and derives its unique dominant action', () => {
  const estimate = actionEstimate({ exactDistribution: { [ACTION_TYPES.RAISE]: 1 } });
  assert.deepEqual(estimate.exactDistribution, [
    { action: { type: ACTION_TYPES.FOLD }, probability: 0 },
    { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
  ]);
  assert.deepEqual(estimate.dominantAction, { type: ACTION_TYPES.RAISE });
});

test('exact 50/50 maximum tie is legal and has no dominant action', () => {
  const estimate = actionEstimate({
    exactDistribution: { [ACTION_TYPES.RAISE]: 0.5, [ACTION_TYPES.FOLD]: 0.5 },
  });
  assert.equal(estimate.dominantAction, null);
  assert.deepEqual(estimate.exactDistribution.map((entry) => entry.probability), [0.5, 0.5]);
});

test('three-action exact distributions normalize in canonical action order', () => {
  const actionSet = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.RAISE, ACTION_TYPES.CALL, ACTION_TYPES.FOLD],
  });
  const estimate = actionEstimate({
    actionSet,
    exactDistribution: {
      [ACTION_TYPES.RAISE]: 0.2,
      [ACTION_TYPES.FOLD]: 0.3,
      [ACTION_TYPES.CALL]: 0.5,
    },
  });
  assert.deepEqual(estimate.exactDistribution.map((entry) => entry.action.type), [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
  ]);
  assert.deepEqual(estimate.dominantAction, { type: ACTION_TYPES.CALL });
});

test('four-action exact distributions preserve explicit zero and All-in as a distinct identity', () => {
  const actionSet = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.ALL_IN, ACTION_TYPES.RAISE, ACTION_TYPES.CALL, ACTION_TYPES.FOLD],
  });
  const estimate = actionEstimate({
    actionSet,
    exactDistribution: {
      [ACTION_TYPES.CALL]: 0.4,
      [ACTION_TYPES.RAISE]: 0.4,
      [ACTION_TYPES.ALL_IN]: 0.2,
    },
  });
  assert.deepEqual(estimate.exactDistribution.map((entry) => entry.action.type), [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
    ACTION_TYPES.ALL_IN,
  ]);
  assert.equal(estimate.exactDistribution[0].probability, 0);
  assert.equal(estimate.dominantAction, null);
});

test('exact distribution validation rejects invalid sums and non-finite or out-of-range values', () => {
  assert.throws(() => normalizePersonalStrategyExactDistribution(
    PERSONAL_STRATEGY_RFI_ACTION_SET,
    { [ACTION_TYPES.FOLD]: 0.4, [ACTION_TYPES.RAISE]: 0.4 },
  ), /sum to 1/);
  assert.throws(() => normalizePersonalStrategyExactDistribution(
    PERSONAL_STRATEGY_RFI_ACTION_SET,
    { [ACTION_TYPES.FOLD]: Number.NaN, [ACTION_TYPES.RAISE]: 1 },
  ), /finite values/);
  assert.throws(() => normalizePersonalStrategyExactDistribution(
    PERSONAL_STRATEGY_RFI_ACTION_SET,
    { [ACTION_TYPES.FOLD]: -0.1, [ACTION_TYPES.RAISE]: 1.1 },
  ), /finite values/);
});

test('deterministic normalization closes only tolerance-sized residuals', () => {
  const normalized = normalizePersonalStrategyExactDistribution(
    createPersonalStrategyActionSet({
      decisionFamily: 'preflop_facing_open',
      legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE],
    }),
    { [ACTION_TYPES.RAISE]: 0.7, [ACTION_TYPES.CALL]: 0.2, [ACTION_TYPES.FOLD]: 0.1 },
  );
  assert.equal(normalized.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.deepEqual(normalized.map((entry) => entry.probability), [0.1, 0.2, 0.7]);
});

test('missing distribution is unknown detail while omitted legal keys in an exact distribution are zero', () => {
  const dominantOnly = actionEstimate({ dominantAction: ACTION_TYPES.RAISE });
  const exact = actionEstimate({ exactDistribution: { [ACTION_TYPES.RAISE]: 1 } });
  const unknown = actionEstimate({
    valueState: PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNKNOWN,
    dominantAction: null,
  });
  assert.equal(dominantOnly.exactDistribution, null);
  assert.equal(unknown.exactDistribution, null);
  assert.equal(exact.exactDistribution.find(
    (entry) => entry.action.type === ACTION_TYPES.FOLD,
  ).probability, 0);
});

test('dominant action must be legal and must match an exact distribution maximum', () => {
  const actionSet = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE],
  });
  assert.throws(() => actionEstimate({
    actionSet,
    dominantAction: ACTION_TYPES.CHECK,
  }), /illegal/);
  assert.throws(() => actionEstimate({
    actionSet,
    dominantAction: ACTION_TYPES.FOLD,
    exactDistribution: { [ACTION_TYPES.CALL]: 0.7, [ACTION_TYPES.FOLD]: 0.3 },
  }), /must match/);
});

test('canonical serialization is independent of object key and supplied action order', () => {
  const firstSet = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.RAISE, ACTION_TYPES.FOLD, ACTION_TYPES.CALL],
  });
  const secondSet = createPersonalStrategyActionSet({
    decisionFamily: 'preflop_facing_open',
    legalActions: [ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.FOLD],
  });
  assert.equal(serializePersonalStrategyActionSet(firstSet), serializePersonalStrategyActionSet(secondSet));
  const first = actionEstimate({
    actionSet: firstSet,
    target: { id: 'A5s', kind: 'hand_class' },
    exactDistribution: { raise: 0.4, call: 0.6 },
    provenance: { sourceSchema: 'test/v1', type: 'direct' },
  });
  const second = actionEstimate({
    actionSet: secondSet,
    target: { kind: 'hand_class', id: 'A5s' },
    exactDistribution: { call: 0.6, raise: 0.4 },
    provenance: { type: 'direct', sourceSchema: 'test/v1' },
  });
  assert.equal(
    serializePersonalStrategyActionEstimateV2(first),
    serializePersonalStrategyActionEstimateV2(second),
  );
});

for (const action of [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]) {
  test(`current RFI quick ${action} remains dominant-only through the v1 reader`, () => {
    const current = observation({ id: `quick-${action}-1`, action });
    const actionAware = projectRangeObservationV1ToActionEvidenceV2(current);
    assert.equal(actionAware.claimKind, PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.DOMINANT_ACTION);
    assert.equal(actionAware.exactDistribution, null);
    assert.deepEqual(projectActionEvidenceV2ToRfiValue(actionAware), {
      dominantAction: { type: action },
      exactFrequencies: null,
    });
    assert.deepEqual(evidenceView([current]).points.find(
      (point) => point.handClass === current.handClass,
    ).strategyValue, {
      kind: 'dominant_only',
      dominantAction: { type: action },
      exactFrequencies: null,
    });
  });
}

test('current RFI explicit pure action preserves its compact v1 representation', () => {
  const current = observation({
    id: 'pure-raise-1',
    frequencies: [{ action: { type: ACTION_TYPES.RAISE }, probability: 1 }],
  });
  const actionAware = projectRangeObservationV1ToActionEvidenceV2(current);
  assert.deepEqual(actionAware.exactDistribution.map((entry) => entry.probability), [0, 1]);
  assert.deepEqual(projectActionEvidenceV2ToRfiValue(actionAware, current.frequencies), {
    dominantAction: current.dominantAction,
    exactFrequencies: current.frequencies,
  });
});

test('current RFI mixed action preserves identical values and legacy entry order', () => {
  const current = observation({
    id: 'mixed-raise-1',
    frequencies: [
      { action: { type: ACTION_TYPES.RAISE }, probability: 0.7 },
      { action: { type: ACTION_TYPES.FOLD }, probability: 0.3 },
    ],
  });
  const point = evidenceView([current]).points.find((entry) => entry.handClass === current.handClass);
  assert.deepEqual(point.strategyValue.exactFrequencies, current.frequencies);
});

test('contradictory RFI histories remain distinct evidence and action-aware estimates preserve references', () => {
  const raise = observation({ id: 'contradiction-raise-1', action: ACTION_TYPES.RAISE });
  const fold = observation({ id: 'contradiction-fold-2', action: ACTION_TYPES.FOLD });
  const view = evidenceView([raise, fold]);
  const legacyEstimate = estimatePersonalStrategyHand(view, raise.handClass);
  const actionAware = projectPersonalStrategyEstimateV1ToActionEstimateV2(legacyEstimate, {
    contradictions: view.conflicts,
  });
  assert.equal(legacyEstimate.status, 'conflicting');
  assert.equal(actionAware.valueState, PERSONAL_STRATEGY_ACTION_VALUE_STATES.CONFLICTING);
  assert.deepEqual(actionAware.sourceEvidenceIds, [fold.id, raise.id].sort());
  assert.deepEqual(actionAware.contradictions[0].evidenceReferences, [fold.id, raise.id].sort());
  assert.equal(actionAware.dominantAction, null);
  assert.equal(actionAware.exactDistribution, null);
});

test('current sparse RFI inference remains numerically and semantically identical behind the adapter', () => {
  const direct = [
    observation({ id: 'inference-raise-1', handClass: 'A6s', action: ACTION_TYPES.RAISE }),
    observation({ id: 'inference-raise-2', handClass: 'A4s', action: ACTION_TYPES.RAISE }),
    observation({ id: 'inference-raise-3', handClass: 'A3s', action: ACTION_TYPES.RAISE }),
  ];
  const result = inferSparseRfiHand(createRfiInferenceRequest({
    profileId: 'profile-action-contract',
    modeId: 'mode-action-contract',
    context: CONTEXT,
    directObservations: direct,
    requestedHandClass: 'A5s',
  }));
  assert.equal(result.status, RFI_INFERENCE_STATUSES.INFERRED);
  assert.deepEqual(result.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(Object.hasOwn(result, 'frequencies'), false);
});

test('Matrix, Builder, and Teacher continue consuming the current RFI compatibility projection', () => {
  const pure = observation({
    id: 'consumer-pure-1',
    frequencies: [{ action: { type: ACTION_TYPES.RAISE }, probability: 1 }],
  });
  const view = evidenceView([pure]);
  const snapshot = createPersonalStrategySnapshot(view);
  const matrix = createPersonalStrategyMatrixProjection({ snapshot, evidenceView: view });
  const cell = matrix.cells.find((entry) => entry.handClass === pure.handClass);
  assert.equal(cell.action.kind, 'raise');
  assert.equal(cell.action.precision, 'pure_explicit');
  const preview = createRangeBuilderPreview(
    matrix,
    [pure.handClass],
    RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD,
  );
  assert.equal(preview.strategy.dominantAction.type, ACTION_TYPES.FOLD);
  assert.equal(preview.strategy.frequencies, null);
  const teacher = createRangeTeacherView({
    snapshot,
    evidenceView: view,
    candidateRanking: [],
    progressAssessment: {
      directCount: snapshot.summary.directlyKnownCount,
      inferredHighCount: snapshot.summary.inferredHighCount,
      inferredMediumCount: snapshot.summary.inferredMediumCount,
      uncertainCount: snapshot.summary.uncertainCount,
      conflictingCount: snapshot.summary.conflictingCount,
      unknownCount: snapshot.summary.unknownCount,
      highValueQuestionCount: 0,
      progressBand: 'starting',
    },
    selectedHandClass: pure.handClass,
  });
  assert.deepEqual(teacher.selectedHand.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.deepEqual(teacher.selectedHand.exactFrequencies, pure.frequencies);
});

test('old v1 unsupported RFI actions stay readable but cannot become legal v2 guidance', () => {
  const legacy = observation({ id: 'legacy-check-1', action: ACTION_TYPES.CHECK });
  const actionAware = projectRangeObservationV1ToActionEvidenceV2(legacy);
  assert.equal(
    actionAware.claimKind,
    PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION,
  );
  assert.equal(actionAware.valueState, PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE);
  assert.equal(actionAware.dominantAction, null);
  assert.deepEqual(projectActionEvidenceV2ToRfiValue(actionAware), {
    dominantAction: { type: ACTION_TYPES.CHECK },
    exactFrequencies: null,
  });
  const result = inferSparseRfiHand(createRfiInferenceRequest({
    profileId: 'profile-action-contract',
    modeId: 'mode-action-contract',
    context: CONTEXT,
    directObservations: [legacy],
    requestedHandClass: legacy.handClass,
  }));
  assert.equal(result.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(result.dominantAction, null);
});

test('v2-to-v1 estimate projection preserves compact pure and dominant-only RFI semantics', () => {
  const pure = actionEstimate({ exactDistribution: { [ACTION_TYPES.RAISE]: 1 } });
  const pureV1 = projectActionEstimateV2ToRfiEstimateV1(pure);
  assert.deepEqual(pureV1.exactFrequencies, [
    { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
  ]);
  const dominant = actionEstimate({ dominantAction: ACTION_TYPES.RAISE });
  const dominantV1 = projectActionEstimateV2ToRfiEstimateV1(dominant);
  assert.equal(dominantV1.exactFrequencies, null);
  assert.deepEqual(dominantV1.dominantAction, { type: ACTION_TYPES.RAISE });
});

test('sync continues to serialize the original immutable range-observation/v1 payload unchanged', () => {
  const current = observation({ id: 'sync-mixed-1', frequencies: [
    { action: { type: ACTION_TYPES.FOLD }, probability: 0.4 },
    { action: { type: ACTION_TYPES.RAISE }, probability: 0.6 },
  ] });
  const remote = toRemotePersonalStrategyEntity(current);
  assert.equal(remote.entityType, PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION);
  assert.equal(remote.entitySchemaVersion, 'range-observation/v1');
  assert.deepEqual(remote.payload, current);
  assert.equal(JSON.stringify(remote.payload).includes('personal-strategy-estimate/v2'), false);
});
