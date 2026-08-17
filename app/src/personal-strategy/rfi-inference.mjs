import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
  PREFLOP_MATRIX_RANKS,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';
import {
  RANGE_OBSERVATION_STATES,
  calibrationContextKey,
  rangeObservationKey,
  validateCalibrationContext,
  validateRangeObservation,
} from './domain.mjs';

export const RFI_INFERENCE_REQUEST_SCHEMA_VERSION = 'rfi-inference-request/v1';
export const RFI_INFERENCE_RESULT_SCHEMA_VERSION = 'rfi-inference-result/v1';
export const SPARSE_RFI_INFERENCE_MODEL_VERSION = 'sparse-rfi-local-neighbors/v1';

export const RFI_INFERENCE_STATUSES = Object.freeze({
  DIRECT: 'direct',
  INFERRED: 'inferred',
  ABSTAINED: 'abstained',
});

export const RFI_INFERENCE_SOURCE_TYPES = Object.freeze({
  DIRECT_CALIBRATION: 'direct_calibration',
  SPARSE_LOCAL_NEIGHBORS: 'sparse_rfi_local_neighbors',
  UNAVAILABLE: 'unavailable',
});

export const RFI_INFERENCE_ABSTENTION_REASONS = Object.freeze({
  NO_MATCHING_SCOPE_EVIDENCE: 'no_matching_scope_evidence',
  INSUFFICIENT_NEARBY_EVIDENCE: 'insufficient_nearby_evidence',
  CONTRADICTORY_NEARBY_EVIDENCE: 'contradictory_nearby_evidence',
  CONTRADICTORY_DIRECT_EVIDENCE: 'contradictory_direct_evidence',
  NEARBY_TIED_BOUNDARY: 'nearby_tied_boundary',
  UNSUPPORTED_DIRECT_ACTION: 'unsupported_direct_action',
});

const STATUS_VALUES = Object.freeze(Object.values(RFI_INFERENCE_STATUSES));
const SOURCE_TYPE_VALUES = Object.freeze(Object.values(RFI_INFERENCE_SOURCE_TYPES));
const CANONICAL_ACTION_SET = new Set(Object.values(ACTION_TYPES));
const SUPPORTED_ACTION_TYPES = Object.freeze([ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
const SUPPORTED_ACTION_SET = new Set(SUPPORTED_ACTION_TYPES);
const HAND_CLASS_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
const MIN_NEIGHBORS = 3;
const MAX_NEIGHBORS = 9;
const MAX_NEIGHBOR_DISTANCE = 4.25;
const LOCAL_DISTANCE_WINDOW = 1.5;
const TIED_BOUNDARY_DISTANCE = 1.25;
const MIN_WINNING_SUPPORT_COUNT = 2;
const MIN_NORMALIZED_WEIGHT_DIFFERENCE = 0.4;
const SCORE_ROUNDING_DIGITS = 12;

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

function roundScore(value) {
  return Number(value.toFixed(SCORE_ROUNDING_DIGITS));
}

function actionIdentity(actionType) {
  return actionType === null ? null : { type: actionType };
}

function containsForbiddenResultField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => (
    ['frequencies', 'probability', 'confidence'].includes(key)
    || containsForbiddenResultField(entry)
  ));
}

function handClassKind(handClass) {
  if (handClass.length === 2) return 'pair';
  return handClass.endsWith('s') ? 'suited' : 'offsuit';
}

export function describeRfiHandClass(handClass) {
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
  }
  const kind = handClassKind(handClass);
  const highRankIndex = PREFLOP_MATRIX_RANKS.indexOf(handClass[0]);
  const lowRankIndex = kind === 'pair'
    ? highRankIndex
    : PREFLOP_MATRIX_RANKS.indexOf(handClass[1]);
  return deepFreeze({
    handClass,
    kind,
    highRankIndex,
    lowRankIndex,
    gap: kind === 'pair' ? 0 : Math.max(0, lowRankIndex - highRankIndex - 1),
  });
}

export function rfiHandClassDistance(leftHandClass, rightHandClass) {
  const left = describeRfiHandClass(leftHandClass);
  const right = describeRfiHandClass(rightHandClass);
  const rankDistance = Math.abs(left.highRankIndex - right.highRankIndex)
    + Math.abs(left.lowRankIndex - right.lowRankIndex);
  let classPenalty = 0;
  if (left.kind !== right.kind) {
    classPenalty = left.kind === 'pair' || right.kind === 'pair' ? 1.5 : 0.75;
  }
  const gapPenalty = Math.abs(left.gap - right.gap) * 0.15;
  return deepFreeze({
    total: roundScore(rankDistance + classPenalty + gapPenalty),
    rankDistance,
    classPenalty,
    gapPenalty: roundScore(gapPenalty),
  });
}

export function validateRfiInferenceRequest(request) {
  requireObject(request, 'RFI inference request');
  if (request.schemaVersion !== RFI_INFERENCE_REQUEST_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_INFERENCE_REQUEST_SCHEMA_VERSION}`);
  }
  requireString(request.profileId, 'RFI inference request.profileId');
  requireString(request.modeId, 'RFI inference request.modeId');
  validateCalibrationContext(request.context);
  if (!isPreflopHandClass(request.requestedHandClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${request.requestedHandClass}`);
  }
  if (request.modelVersion !== SPARSE_RFI_INFERENCE_MODEL_VERSION) {
    throw new RangeError(`Unsupported RFI inference model: ${request.modelVersion}`);
  }
  if (!Array.isArray(request.directObservations)) {
    throw new TypeError('RFI inference request.directObservations must be an array');
  }
  request.directObservations.forEach(validateRangeObservation);
  const ids = request.directObservations.map((observation) => observation.id);
  if (new Set(ids).size !== ids.length) {
    throw new RangeError('RFI inference direct observation IDs must be unique');
  }
  return request;
}

export function createRfiInferenceRequest({
  profileId,
  modeId,
  context,
  directObservations = [],
  requestedHandClass,
  modelVersion = SPARSE_RFI_INFERENCE_MODEL_VERSION,
} = {}) {
  const request = {
    schemaVersion: RFI_INFERENCE_REQUEST_SCHEMA_VERSION,
    profileId,
    modeId,
    context: cloneData(context),
    directObservations: cloneData(directObservations),
    requestedHandClass,
    modelVersion,
  };
  validateRfiInferenceRequest(request);
  return deepFreeze(request);
}

function validateEvidenceReference(reference, index) {
  requireObject(reference, `RFI inference result.evidenceReferences[${index}]`);
  requireString(reference.observationId, 'RFI inference evidence observationId');
  if (!isPreflopHandClass(reference.handClass)) {
    throw new RangeError('RFI inference evidence handClass is invalid');
  }
  if (reference.observedDominantAction !== null) {
    requireObject(reference.observedDominantAction, 'RFI inference evidence observedDominantAction');
    requireString(reference.observedDominantAction.type, 'RFI inference evidence action type');
    if (!CANONICAL_ACTION_SET.has(reference.observedDominantAction.type)) {
      throw new RangeError('RFI inference evidence action type must be canonical');
    }
  }
  requireString(reference.relationship, 'RFI inference evidence relationship');
  if (typeof reference.hasExplicitFrequencies !== 'boolean') {
    throw new TypeError('RFI inference evidence hasExplicitFrequencies must be boolean');
  }
  if (reference.distance !== null) {
    requireObject(reference.distance, 'RFI inference evidence distance');
    for (const field of ['total', 'rankDistance', 'classPenalty', 'gapPenalty']) {
      if (!Number.isFinite(reference.distance[field]) || reference.distance[field] < 0) {
        throw new RangeError(`RFI inference evidence distance.${field} must be non-negative`);
      }
    }
  }
}

export function validateRfiInferenceResult(result) {
  requireObject(result, 'RFI inference result');
  if (result.schemaVersion !== RFI_INFERENCE_RESULT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_INFERENCE_RESULT_SCHEMA_VERSION}`);
  }
  if (!STATUS_VALUES.includes(result.status)) throw new RangeError('Unsupported RFI inference status');
  requireString(result.profileId, 'RFI inference result.profileId');
  requireString(result.modeId, 'RFI inference result.modeId');
  requireString(result.contextKey, 'RFI inference result.contextKey');
  if (!isPreflopHandClass(result.handClass)) throw new RangeError('RFI inference result handClass is invalid');
  if (result.inferenceModelVersion !== SPARSE_RFI_INFERENCE_MODEL_VERSION) {
    throw new RangeError('RFI inference result model version is unsupported');
  }
  requireObject(result.source, 'RFI inference result.source');
  if (!SOURCE_TYPE_VALUES.includes(result.source.type)) throw new RangeError('Unsupported RFI inference source');
  if (result.source.modelVersion !== null
    && result.source.modelVersion !== SPARSE_RFI_INFERENCE_MODEL_VERSION) {
    throw new RangeError('RFI inference source model version is unsupported');
  }
  if (result.dominantAction !== null) {
    requireObject(result.dominantAction, 'RFI inference result.dominantAction');
    requireString(result.dominantAction.type, 'RFI inference result dominant action type');
    if (!CANONICAL_ACTION_SET.has(result.dominantAction.type)) {
      throw new RangeError('RFI inference result dominant action type must be canonical');
    }
  }
  if (result.status === RFI_INFERENCE_STATUSES.INFERRED
    && !SUPPORTED_ACTION_SET.has(result.dominantAction?.type)) {
    throw new RangeError('An inferred RFI result requires a supported categorical action');
  }
  if (result.status === RFI_INFERENCE_STATUSES.ABSTAINED && result.dominantAction !== null) {
    throw new RangeError('An abstained RFI result cannot contain a dominant action');
  }
  const expectedSource = {
    [RFI_INFERENCE_STATUSES.DIRECT]: RFI_INFERENCE_SOURCE_TYPES.DIRECT_CALIBRATION,
    [RFI_INFERENCE_STATUSES.INFERRED]: RFI_INFERENCE_SOURCE_TYPES.SPARSE_LOCAL_NEIGHBORS,
    [RFI_INFERENCE_STATUSES.ABSTAINED]: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
  }[result.status];
  if (result.source.type !== expectedSource) {
    throw new RangeError('RFI inference result status and source are inconsistent');
  }
  if (!Array.isArray(result.evidenceReferences)) {
    throw new TypeError('RFI inference result.evidenceReferences must be an array');
  }
  result.evidenceReferences.forEach(validateEvidenceReference);
  requireObject(result.diagnostics, 'RFI inference result.diagnostics');
  requireString(result.diagnostics.reason, 'RFI inference result diagnostics.reason');
  if (containsForbiddenResultField(result)) {
    throw new RangeError('RFI inference v1 does not expose action frequencies or calibrated confidence');
  }
  return result;
}

function evidenceReference(observation, relationship, distance = null) {
  return {
    observationId: observation.id,
    handClass: observation.handClass,
    observedDominantAction: observation.dominantAction === null
      ? null
      : actionIdentity(observation.dominantAction.type),
    hasExplicitFrequencies: observation.hasExplicitFrequencies,
    relationship,
    distance: distance === null ? null : cloneData(distance),
  };
}

function resultFor(request, {
  status,
  sourceType,
  sourceModelVersion,
  dominantAction = null,
  evidenceReferences = [],
  diagnostics,
}) {
  const result = {
    schemaVersion: RFI_INFERENCE_RESULT_SCHEMA_VERSION,
    status,
    profileId: request.profileId,
    modeId: request.modeId,
    contextKey: calibrationContextKey(request.context),
    handClass: request.requestedHandClass,
    inferenceModelVersion: request.modelVersion,
    source: {
      type: sourceType,
      modelVersion: sourceModelVersion,
    },
    dominantAction: dominantAction === null ? null : actionIdentity(dominantAction),
    evidenceReferences: cloneData(evidenceReferences),
    diagnostics: cloneData(diagnostics),
  };
  validateRfiInferenceResult(result);
  return deepFreeze(result);
}

function materializeDirectLeaves(observations) {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  const superseded = new Set();
  for (const observation of observations) {
    const parentId = observation.revision.supersedesObservationId;
    if (parentId === null || !byId.has(parentId)) continue;
    const parent = byId.get(parentId);
    if (rangeObservationKey(parent) !== rangeObservationKey(observation)) {
      throw new RangeError('RFI inference revision evidence cannot cross a direct-observation key');
    }
    superseded.add(parentId);
  }
  return observations.filter((observation) => !superseded.has(observation.id));
}

function matchingScopeLeaves(request) {
  const requestedContextKey = calibrationContextKey(request.context);
  return materializeDirectLeaves(request.directObservations).filter((observation) => (
    observation.profileId === request.profileId
    && observation.modeId === request.modeId
    && calibrationContextKey(observation.context) === requestedContextKey
  ));
}

function neighborEntry(observation, requestedHandClass) {
  return {
    observation,
    distance: rfiHandClassDistance(observation.handClass, requestedHandClass),
  };
}

function compareNeighbors(left, right) {
  return left.distance.total - right.distance.total
    || HAND_CLASS_INDEX.get(left.observation.handClass) - HAND_CLASS_INDEX.get(right.observation.handClass)
    || left.observation.id.localeCompare(right.observation.id, 'en');
}

function supportWeight(distance) {
  return 1 / ((1 + distance) ** 2);
}

function diagnosticsBase(scopeLeaves, categorical, tied, unsupported) {
  return {
    matchingScopeLeafCount: scopeLeaves.length,
    usableCategoricalEvidenceCount: categorical.length,
    tiedEvidenceCount: tied.length,
    unsupportedActionEvidenceCount: unsupported.length,
  };
}

export function inferSparseRfiHand(rawRequest) {
  const request = validateRfiInferenceRequest(rawRequest);
  const scopeLeaves = matchingScopeLeaves(request);
  const requestedLeaves = scopeLeaves.filter(
    (observation) => observation.handClass === request.requestedHandClass
      && observation.state === RANGE_OBSERVATION_STATES.ACTIVE,
  );
  const requestedLeaf = requestedLeaves[0] ?? null;

  if (requestedLeaves.length > 1) {
    const signatures = new Set(requestedLeaves.map((observation) => JSON.stringify({
      dominantAction: observation.dominantAction,
      hasExplicitFrequencies: observation.hasExplicitFrequencies,
      frequencies: observation.frequencies,
    })));
    if (signatures.size > 1) {
      return resultFor(request, {
        status: RFI_INFERENCE_STATUSES.ABSTAINED,
        sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
        sourceModelVersion: request.modelVersion,
        evidenceReferences: requestedLeaves.map((observation) => evidenceReference(observation, 'direct_conflict')),
        diagnostics: {
          reason: RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_DIRECT_EVIDENCE,
          matchingScopeLeafCount: scopeLeaves.length,
          conflictingDirectEvidenceCount: requestedLeaves.length,
        },
      });
    }
  }

  if (requestedLeaf?.state === RANGE_OBSERVATION_STATES.ACTIVE) {
    const reference = evidenceReference(requestedLeaf, 'direct');
    if (requestedLeaf.dominantAction === null) {
      return resultFor(request, {
        status: RFI_INFERENCE_STATUSES.DIRECT,
        sourceType: RFI_INFERENCE_SOURCE_TYPES.DIRECT_CALIBRATION,
        sourceModelVersion: null,
        evidenceReferences: requestedLeaves.map((observation) => evidenceReference(observation, 'direct')),
        diagnostics: {
          reason: 'direct_tied_mix',
          matchingScopeLeafCount: scopeLeaves.length,
        },
      });
    }
    if (!SUPPORTED_ACTION_SET.has(requestedLeaf.dominantAction.type)) {
      return resultFor(request, {
        status: RFI_INFERENCE_STATUSES.ABSTAINED,
        sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
        sourceModelVersion: request.modelVersion,
        evidenceReferences: [reference],
        diagnostics: {
          reason: RFI_INFERENCE_ABSTENTION_REASONS.UNSUPPORTED_DIRECT_ACTION,
          matchingScopeLeafCount: scopeLeaves.length,
          observedActionType: requestedLeaf.dominantAction.type,
        },
      });
    }
    return resultFor(request, {
      status: RFI_INFERENCE_STATUSES.DIRECT,
      sourceType: RFI_INFERENCE_SOURCE_TYPES.DIRECT_CALIBRATION,
      sourceModelVersion: null,
      dominantAction: requestedLeaf.dominantAction.type,
      evidenceReferences: requestedLeaves.map((observation) => evidenceReference(observation, 'direct')),
      diagnostics: {
        reason: 'direct_observation',
        matchingScopeLeafCount: scopeLeaves.length,
      },
    });
  }

  const activeEvidence = scopeLeaves.filter(
    (observation) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE,
  );
  const categorical = activeEvidence.filter(
    (observation) => SUPPORTED_ACTION_SET.has(observation.dominantAction?.type),
  );
  const tied = activeEvidence.filter((observation) => observation.dominantAction === null);
  const unsupported = activeEvidence.filter(
    (observation) => observation.dominantAction !== null
      && !SUPPORTED_ACTION_SET.has(observation.dominantAction.type),
  );
  const base = diagnosticsBase(scopeLeaves, categorical, tied, unsupported);

  if (scopeLeaves.length === 0) {
    return resultFor(request, {
      status: RFI_INFERENCE_STATUSES.ABSTAINED,
      sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
      sourceModelVersion: request.modelVersion,
      diagnostics: {
        reason: RFI_INFERENCE_ABSTENTION_REASONS.NO_MATCHING_SCOPE_EVIDENCE,
        ...base,
      },
    });
  }

  const categoricalNeighbors = categorical
    .map((observation) => neighborEntry(observation, request.requestedHandClass))
    .sort(compareNeighbors);
  const tiedNeighbors = tied
    .map((observation) => neighborEntry(observation, request.requestedHandClass))
    .sort(compareNeighbors);
  const nearestDistance = categoricalNeighbors[0]?.distance.total ?? null;
  const nearbyTied = tiedNeighbors.filter(
    (entry) => entry.distance.total <= TIED_BOUNDARY_DISTANCE,
  );
  if (nearbyTied.length > 0) {
    return resultFor(request, {
      status: RFI_INFERENCE_STATUSES.ABSTAINED,
      sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
      sourceModelVersion: request.modelVersion,
      evidenceReferences: nearbyTied.map((entry) => (
        evidenceReference(entry.observation, 'tied_boundary', entry.distance)
      )),
      diagnostics: {
        reason: RFI_INFERENCE_ABSTENTION_REASONS.NEARBY_TIED_BOUNDARY,
        ...base,
        nearestCategoricalDistance: nearestDistance,
        nearestTiedDistance: nearbyTied[0].distance.total,
      },
    });
  }

  const allowedDistance = nearestDistance === null
    ? MAX_NEIGHBOR_DISTANCE
    : Math.min(MAX_NEIGHBOR_DISTANCE, nearestDistance + LOCAL_DISTANCE_WINDOW);
  const selected = categoricalNeighbors
    .filter((entry) => entry.distance.total <= allowedDistance)
    .slice(0, MAX_NEIGHBORS);
  if (selected.length < MIN_NEIGHBORS) {
    return resultFor(request, {
      status: RFI_INFERENCE_STATUSES.ABSTAINED,
      sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
      sourceModelVersion: request.modelVersion,
      evidenceReferences: selected.map((entry) => (
        evidenceReference(entry.observation, 'neighbor', entry.distance)
      )),
      diagnostics: {
        reason: RFI_INFERENCE_ABSTENTION_REASONS.INSUFFICIENT_NEARBY_EVIDENCE,
        ...base,
        selectedNeighborCount: selected.length,
        minimumNeighborCount: MIN_NEIGHBORS,
        nearestCategoricalDistance: nearestDistance,
        maximumUsedDistance: allowedDistance,
      },
    });
  }

  const supportCounts = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  const supportWeights = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  for (const entry of selected) {
    const actionType = entry.observation.dominantAction.type;
    supportCounts[actionType] += 1;
    supportWeights[actionType] += supportWeight(entry.distance.total);
  }
  const totalWeight = supportWeights[ACTION_TYPES.FOLD] + supportWeights[ACTION_TYPES.RAISE];
  const weightDifference = Math.abs(
    supportWeights[ACTION_TYPES.FOLD] - supportWeights[ACTION_TYPES.RAISE],
  );
  const normalizedWeightDifference = totalWeight === 0 ? 0 : weightDifference / totalWeight;
  const winner = supportWeights[ACTION_TYPES.RAISE] > supportWeights[ACTION_TYPES.FOLD]
    ? ACTION_TYPES.RAISE
    : ACTION_TYPES.FOLD;
  const contradictory = supportWeights[ACTION_TYPES.RAISE] === supportWeights[ACTION_TYPES.FOLD]
    || supportCounts[winner] < MIN_WINNING_SUPPORT_COUNT
    || normalizedWeightDifference < MIN_NORMALIZED_WEIGHT_DIFFERENCE;
  const references = selected.map((entry) => (
    evidenceReference(entry.observation, 'neighbor', entry.distance)
  ));
  const voteDiagnostics = {
    ...base,
    selectedNeighborCount: selected.length,
    nearestCategoricalDistance: nearestDistance,
    maximumUsedDistance: allowedDistance,
    supportCounts,
    supportWeights: {
      [ACTION_TYPES.FOLD]: roundScore(supportWeights[ACTION_TYPES.FOLD]),
      [ACTION_TYPES.RAISE]: roundScore(supportWeights[ACTION_TYPES.RAISE]),
    },
    normalizedWeightDifference: roundScore(normalizedWeightDifference),
    requiredNormalizedWeightDifference: MIN_NORMALIZED_WEIGHT_DIFFERENCE,
  };
  if (contradictory) {
    return resultFor(request, {
      status: RFI_INFERENCE_STATUSES.ABSTAINED,
      sourceType: RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE,
      sourceModelVersion: request.modelVersion,
      evidenceReferences: references,
      diagnostics: {
        reason: RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_NEARBY_EVIDENCE,
        ...voteDiagnostics,
      },
    });
  }

  return resultFor(request, {
    status: RFI_INFERENCE_STATUSES.INFERRED,
    sourceType: RFI_INFERENCE_SOURCE_TYPES.SPARSE_LOCAL_NEIGHBORS,
    sourceModelVersion: request.modelVersion,
    dominantAction: winner,
    evidenceReferences: references,
    diagnostics: {
      reason: 'local_weighted_agreement',
      ...voteDiagnostics,
    },
  });
}
