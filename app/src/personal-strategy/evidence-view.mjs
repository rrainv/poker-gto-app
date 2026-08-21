import {
  PREFLOP_HAND_CLASSES,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';
import {
  RANGE_OBSERVATION_STATES,
  DIRECT_EVIDENCE_SOURCES,
  calibrationContextKey,
  rangeObservationKey,
  validateCalibrationContext,
  validateRangeObservation,
  validateTrainingObservation,
} from './domain.mjs';
import {
  PERSONAL_STRATEGY_RFI_ACTION_SET,
  normalizePersonalStrategyExactDistribution,
  personalStrategyActionSetHas,
  projectActionEvidenceV2ToRfiValue,
  projectRangeObservationV1ToActionEvidenceV2,
  projectTrainingObservationV1ToActionEvidenceV2,
} from './action-contract.mjs';

export const STRATEGY_SPOT_CONTEXT_SCHEMA_VERSION = 'strategy-spot-context/v1';
export const PERSONAL_STRATEGY_EVIDENCE_SCHEMA_VERSION = 'personal-strategy-evidence/v1';
export const PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION = 'personal-strategy-evidence-view/v1';
export const PERSONAL_STRATEGY_CONFLICT_SCHEMA_VERSION = 'personal-strategy-conflict/v1';

export const PERSONAL_STRATEGY_EVIDENCE_AUTHORITIES = Object.freeze({
  INTENTIONAL_STRATEGY: 'intentional_strategy',
  OBSERVED_BEHAVIOR: 'observed_behavior',
});

export const PERSONAL_STRATEGY_EVIDENCE_SOURCE_KINDS = Object.freeze({
  CALIBRATION: 'calibration',
  MATRIX: 'matrix',
  RANGE_BUILDER: 'range_builder',
  TRAINING: 'training',
});

export const PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS = Object.freeze({
  DOMINANT_ACTION: 'dominant_action',
  EXACT_ACTION_MIX: 'exact_action_mix',
  OBSERVED_ACTION: 'observed_action',
  RETRACTION: 'retraction',
});

export const PERSONAL_STRATEGY_DIRECT_POINT_STATES = Object.freeze({
  DIRECT_DOMINANT: 'direct_dominant',
  DIRECT_EXACT: 'direct_exact',
  CONFLICTING: 'conflicting',
  UNANSWERED: 'unanswered',
});

export const PERSONAL_STRATEGY_DIRECT_HEAD_STATES = Object.freeze({
  ACTIVE: 'active_head',
  RETRACTED: 'retracted_head',
  SUPERSEDED: 'superseded',
});

const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function actionIdentity(action) {
  return action === null ? null : { type: action.type };
}

function frequenciesByAction(frequencies) {
  return Object.fromEntries([...frequencies]
    .map((entry) => [entry.action.type, entry.probability])
    .sort(([left], [right]) => left.localeCompare(right, 'en')));
}

function exactMixSignature(observation) {
  return stableStringify(frequenciesByAction(observation.frequencies));
}

function directObservationSignature(observation) {
  if (observation.hasExplicitFrequencies) return `exact:${exactMixSignature(observation)}`;
  return `dominant:${observation.dominantAction?.type ?? 'none'}`;
}

export function createRfiStrategySpotContext(context) {
  validateCalibrationContext(context);
  return deepFreeze({
    schemaVersion: STRATEGY_SPOT_CONTEXT_SCHEMA_VERSION,
    gameVariant: context.gameVariant,
    gameRulesId: context.gameRulesId,
    decisionFamily: context.decisionFamily,
    street: 'preflop',
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    opponentCount: null,
    effectiveStack: {
      valueBb: context.effectiveStackBb,
      basis: 'calibration_effective_stack',
    },
    accounting: cloneData(context.accounting),
    priorAction: { state: 'unopened' },
    facing: null,
    board: [],
  });
}

function directEvidenceRecord(observation, headState) {
  const actionAwareEvidence = projectRangeObservationV1ToActionEvidenceV2(observation);
  const compatibilityValue = projectActionEvidenceV2ToRfiValue(
    actionAwareEvidence,
    observation.frequencies,
  );
  const claimKind = observation.state === RANGE_OBSERVATION_STATES.RETRACTED
    ? PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS.RETRACTION
    : observation.hasExplicitFrequencies
      ? PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS.EXACT_ACTION_MIX
      : PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS.DOMINANT_ACTION;
  const sourceKind = observation.provenance.source ?? DIRECT_EVIDENCE_SOURCES.CALIBRATION;
  return {
    schemaVersion: PERSONAL_STRATEGY_EVIDENCE_SCHEMA_VERSION,
    evidenceId: observation.id,
    authority: PERSONAL_STRATEGY_EVIDENCE_AUTHORITIES.INTENTIONAL_STRATEGY,
    source: {
      kind: sourceKind,
      sourceRecordSchema: observation.schemaVersion,
      sessionId: observation.provenance.calibrationSessionId,
      actionGroupId: observation.provenance.actionGroupId ?? null,
      undoesActionGroupId: observation.provenance.undoesActionGroupId ?? null,
    },
    scope: {
      profileId: observation.profileId,
      modeId: observation.modeId,
      contextKey: calibrationContextKey(observation.context),
    },
    target: { kind: 'hand_class', id: observation.handClass },
    claim: {
      kind: claimKind,
      value: claimKind === PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS.RETRACTION
        ? null
        : {
          dominantAction: cloneData(compatibilityValue.dominantAction),
          exactFrequencies: cloneData(compatibilityValue.exactFrequencies),
        },
    },
    lineage: {
      supersedesEvidenceId: observation.revision.supersedesObservationId,
      resolvesEvidenceIds: [],
    },
    occurredAt: observation.createdAt,
    recordedAt: observation.updatedAt,
    recordState: observation.state,
    headState,
  };
}

function trainingEvidenceRecord(observation) {
  const actionAwareEvidence = projectTrainingObservationV1ToActionEvidenceV2(observation);
  const compatibilityValue = projectActionEvidenceV2ToRfiValue(actionAwareEvidence);
  return {
    schemaVersion: PERSONAL_STRATEGY_EVIDENCE_SCHEMA_VERSION,
    evidenceId: observation.id,
    authority: PERSONAL_STRATEGY_EVIDENCE_AUTHORITIES.OBSERVED_BEHAVIOR,
    source: {
      kind: PERSONAL_STRATEGY_EVIDENCE_SOURCE_KINDS.TRAINING,
      sourceRecordSchema: observation.schemaVersion,
      sessionId: observation.provenance.trainingSessionId,
      exerciseId: observation.provenance.trainingExerciseId,
    },
    scope: {
      profileId: observation.profileId,
      modeId: observation.modeId,
      contextKey: calibrationContextKey(observation.context),
    },
    target: { kind: 'hand_class', id: observation.handClass },
    claim: {
      kind: PERSONAL_STRATEGY_EVIDENCE_CLAIM_KINDS.OBSERVED_ACTION,
      value: { chosenAction: cloneData(compatibilityValue.chosenAction) },
    },
    lineage: { supersedesEvidenceId: null, resolvesEvidenceIds: [] },
    occurredAt: observation.createdAt,
    recordedAt: observation.updatedAt,
    recordState: 'active',
    headState: 'immutable_observation',
    directCalibrationComparison: cloneData(observation.directCalibrationComparison),
  };
}

function assertDirectLineage(observations) {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  for (const observation of observations) {
    const parentId = observation.revision.supersedesObservationId;
    if (parentId === null) continue;
    const parent = byId.get(parentId);
    if (!parent) {
      throw new RangeError(`Personal Strategy evidence lineage parent is missing: ${parentId}`);
    }
    if (rangeObservationKey(parent) !== rangeObservationKey(observation)) {
      throw new RangeError('Personal Strategy evidence lineage cannot cross a strategic point');
    }
  }
  for (const observation of observations) {
    const visited = new Set([observation.id]);
    let parentId = observation.revision.supersedesObservationId;
    while (parentId !== null) {
      if (visited.has(parentId)) throw new RangeError('Personal Strategy evidence lineage contains a cycle');
      visited.add(parentId);
      parentId = byId.get(parentId)?.revision.supersedesObservationId ?? null;
    }
  }
}

function areActiveHeadsCompatible(activeHeads) {
  const exact = activeHeads.filter((entry) => entry.hasExplicitFrequencies);
  const dominantOnly = activeHeads.filter((entry) => !entry.hasExplicitFrequencies);
  const exactSignatures = new Set(exact.map(exactMixSignature));
  if (exactSignatures.size > 1) return false;
  if (exact.length > 0) {
    const exactDominant = exact[0].dominantAction?.type ?? null;
    return dominantOnly.every((entry) => entry.dominantAction?.type === exactDominant);
  }
  return new Set(dominantOnly.map((entry) => entry.dominantAction?.type ?? null)).size <= 1;
}

function conflictFor(handClass, activeHeads) {
  const evidenceReferences = activeHeads.map((entry) => entry.id).sort();
  return {
    schemaVersion: PERSONAL_STRATEGY_CONFLICT_SCHEMA_VERSION,
    conflictId: `personal-strategy-conflict/v1:${evidenceReferences.join(':')}`,
    target: { kind: 'hand_class', id: handClass },
    kind: 'incompatible_direct_heads',
    evidenceReferences,
    status: 'unresolved',
    resolutionEvidenceId: null,
  };
}

function directPointFor(handClass, observations, trainingEvidenceIds) {
  const referenced = new Set(observations
    .map((entry) => entry.revision.supersedesObservationId)
    .filter((entry) => entry !== null));
  const heads = observations.filter((entry) => !referenced.has(entry.id));
  const activeHeads = heads.filter((entry) => entry.state === RANGE_OBSERVATION_STATES.ACTIVE);
  const retractedHeads = heads.filter((entry) => entry.state === RANGE_OBSERVATION_STATES.RETRACTED);
  const supersededIds = observations.filter((entry) => referenced.has(entry.id)).map((entry) => entry.id).sort();
  const activeHeadIds = activeHeads.map((entry) => entry.id).sort();
  const retractedHeadIds = retractedHeads.map((entry) => entry.id).sort();
  if (activeHeads.length === 0) {
    return {
      handClass,
      resolution: PERSONAL_STRATEGY_DIRECT_POINT_STATES.UNANSWERED,
      strategyValue: { kind: 'unknown', dominantAction: null, exactFrequencies: null },
      activeDirectHeadIds: [],
      retractedDirectHeadIds: retractedHeadIds,
      supersededDirectEvidenceIds: supersededIds,
      sourceEvidenceIds: [],
      trainingEvidenceIds,
      conflict: null,
    };
  }
  if (!areActiveHeadsCompatible(activeHeads)) {
    return {
      handClass,
      resolution: PERSONAL_STRATEGY_DIRECT_POINT_STATES.CONFLICTING,
      strategyValue: { kind: 'unknown', dominantAction: null, exactFrequencies: null },
      activeDirectHeadIds: activeHeadIds,
      retractedDirectHeadIds: retractedHeadIds,
      supersededDirectEvidenceIds: supersededIds,
      sourceEvidenceIds: activeHeadIds,
      trainingEvidenceIds,
      conflict: conflictFor(handClass, activeHeads),
    };
  }
  const selected = activeHeads.find((entry) => entry.hasExplicitFrequencies) ?? activeHeads[0];
  const exact = selected.hasExplicitFrequencies;
  return {
    handClass,
    resolution: exact
      ? PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT
      : PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT,
    strategyValue: {
      kind: exact ? 'exact_mix' : 'dominant_only',
      dominantAction: actionIdentity(selected.dominantAction),
      exactFrequencies: exact ? cloneData(selected.frequencies) : null,
    },
    activeDirectHeadIds: activeHeadIds,
    retractedDirectHeadIds: retractedHeadIds,
    supersededDirectEvidenceIds: supersededIds,
    sourceEvidenceIds: activeHeadIds,
    trainingEvidenceIds,
    conflict: null,
  };
}

function matchingScope(record, profileId, modeId, contextKey) {
  return record.profileId === profileId
    && record.modeId === modeId
    && calibrationContextKey(record.context) === contextKey;
}

export function validatePersonalStrategyEvidenceView(view) {
  requireObject(view, 'PersonalStrategyEvidenceView');
  if (view.schemaVersion !== PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION}`);
  }
  requireObject(view.scope, 'PersonalStrategyEvidenceView.scope');
  requireString(view.scope.profileId, 'PersonalStrategyEvidenceView.scope.profileId');
  requireString(view.scope.modeId, 'PersonalStrategyEvidenceView.scope.modeId');
  requireString(view.scope.contextKey, 'PersonalStrategyEvidenceView.scope.contextKey');
  if (!Array.isArray(view.directEvidence) || !Array.isArray(view.trainingEvidence)) {
    throw new TypeError('PersonalStrategyEvidenceView evidence collections must be arrays');
  }
  if (!Array.isArray(view.points) || view.points.length !== PREFLOP_HAND_CLASSES.length) {
    throw new RangeError('PersonalStrategyEvidenceView must project all 169 hand classes');
  }
  if (view.points.some((point, index) => point.handClass !== PREFLOP_HAND_CLASSES[index])) {
    throw new RangeError('PersonalStrategyEvidenceView points must use canonical hand-class order');
  }
  requireString(view.evidenceFingerprint, 'PersonalStrategyEvidenceView.evidenceFingerprint');
  return view;
}

export function createPersonalStrategyEvidenceView({
  profileId,
  modeId,
  context,
  rangeObservations = [],
  trainingObservations = [],
} = {}) {
  requireString(profileId, 'Personal Strategy evidence profileId');
  requireString(modeId, 'Personal Strategy evidence modeId');
  validateCalibrationContext(context);
  if (!Array.isArray(rangeObservations) || !Array.isArray(trainingObservations)) {
    throw new TypeError('Personal Strategy source evidence collections must be arrays');
  }
  rangeObservations.forEach(validateRangeObservation);
  trainingObservations.forEach(validateTrainingObservation);
  const contextKey = calibrationContextKey(context);
  const direct = rangeObservations.filter((entry) => matchingScope(entry, profileId, modeId, contextKey));
  const training = trainingObservations.filter((entry) => matchingScope(entry, profileId, modeId, contextKey));
  const sourceIds = [...direct, ...training].map((entry) => entry.id);
  if (new Set(sourceIds).size !== sourceIds.length) {
    throw new RangeError('Personal Strategy source evidence IDs must be unique');
  }
  assertDirectLineage(direct);

  const referenced = new Set(direct
    .map((entry) => entry.revision.supersedesObservationId)
    .filter((entry) => entry !== null));
  const sortedDirect = [...direct].sort((left, right) => (
    HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id, 'en')
  ));
  const directEvidence = sortedDirect.map((observation) => {
    const headState = referenced.has(observation.id)
      ? PERSONAL_STRATEGY_DIRECT_HEAD_STATES.SUPERSEDED
      : observation.state === RANGE_OBSERVATION_STATES.ACTIVE
        ? PERSONAL_STRATEGY_DIRECT_HEAD_STATES.ACTIVE
        : PERSONAL_STRATEGY_DIRECT_HEAD_STATES.RETRACTED;
    return directEvidenceRecord(observation, headState);
  });
  const sortedTraining = [...training].sort((left, right) => (
    HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass)
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id, 'en')
  ));
  const trainingEvidence = sortedTraining.map(trainingEvidenceRecord);
  const directByHand = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, []]));
  const trainingByHand = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, []]));
  sortedDirect.forEach((entry) => directByHand.get(entry.handClass).push(entry));
  sortedTraining.forEach((entry) => trainingByHand.get(entry.handClass).push(entry.id));
  const points = PREFLOP_HAND_CLASSES.map((handClass) => directPointFor(
    handClass,
    directByHand.get(handClass),
    [...trainingByHand.get(handClass)].sort(),
  ));
  const conflicts = points.filter((point) => point.conflict !== null).map((point) => point.conflict);
  const activeHeadIds = points.flatMap((point) => point.activeDirectHeadIds).sort();
  const sourceForFingerprint = [...sortedDirect, ...sortedTraining]
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const view = {
    schemaVersion: PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION,
    scope: {
      profileId,
      modeId,
      context: cloneData(context),
      contextKey,
      strategySpotContext: createRfiStrategySpotContext(context),
    },
    directEvidence,
    trainingEvidence,
    points,
    conflicts,
    activeHeadIds,
    evidenceFingerprint: fingerprint(sourceForFingerprint),
    summary: {
      sourceDirectEvidenceCount: directEvidence.length,
      activeDirectHeadCount: activeHeadIds.length,
      supersededDirectEvidenceCount: directEvidence.filter(
        (entry) => entry.headState === PERSONAL_STRATEGY_DIRECT_HEAD_STATES.SUPERSEDED,
      ).length,
      retractedHeadCount: directEvidence.filter(
        (entry) => entry.headState === PERSONAL_STRATEGY_DIRECT_HEAD_STATES.RETRACTED,
      ).length,
      trainingEvidenceCount: trainingEvidence.length,
      directlyAnsweredHandCount: points.filter((point) => [
        PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT,
        PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT,
      ].includes(point.resolution)).length,
      conflictingHandCount: conflicts.length,
    },
  };
  validatePersonalStrategyEvidenceView(view);
  return deepFreeze(view);
}

export function isSupportedRfiStrategyValue(point) {
  if (![PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT,
    PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT].includes(point?.resolution)) return false;
  const frequencies = point.strategyValue.exactFrequencies;
  if (frequencies === null) {
    return personalStrategyActionSetHas(
      PERSONAL_STRATEGY_RFI_ACTION_SET,
      point.strategyValue.dominantAction,
    );
  }
  try {
    normalizePersonalStrategyExactDistribution(PERSONAL_STRATEGY_RFI_ACTION_SET, frequencies);
    return true;
  } catch {
    return false;
  }
}

export function directObservationSemanticSignature(observation) {
  validateRangeObservation(observation);
  return directObservationSignature(observation);
}
