import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
  PREFLOP_MATRIX_RANKS,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';
import {
  PERSONAL_STRATEGY_DIRECT_POINT_STATES,
  PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION,
  createPersonalStrategyEvidenceView,
  isSupportedRfiStrategyValue,
  validatePersonalStrategyEvidenceView,
} from './evidence-view.mjs';
import {
  CALIBRATION_DECISION_FAMILIES,
  calibrationContextKey,
  validateCalibrationContext,
  validateRangeObservation,
} from './domain.mjs';
import {
  PERSONAL_STRATEGY_ACTION_VALUE_STATES,
  PERSONAL_STRATEGY_RFI_ACTION_SET,
  createPersonalStrategyActionEstimateV2,
  getPersonalStrategyActionSetForContext,
  projectActionEstimateV2ToRfiEstimateV1,
  projectPersonalStrategyEstimateV1ToActionEstimateV2,
} from './action-contract.mjs';

export const PERSONAL_STRATEGY_ESTIMATE_SCHEMA_VERSION = 'personal-strategy-estimate/v1';
export const PERSONAL_STRATEGY_SNAPSHOT_SCHEMA_VERSION = 'personal-strategy-snapshot/v1';
export const PERSONAL_STRATEGY_UNCERTAINTY_SCHEMA_VERSION = 'personal-strategy-uncertainty/v1';
export const PERSONAL_STRATEGY_INFERENCE_SUPPORT_SCHEMA_VERSION = 'personal-strategy-inference-support/v1';
export const RFI_INFERENCE_MODEL_VERSION = 'deterministic-rfi-local-graph/v1';
export const RFI_CONFLICT_POLICY_VERSION = 'personal-strategy-direct-conflicts/v1';
export const RFI_UNCERTAINTY_SEMANTICS_VERSION = 'rfi-ordinal-uncertainty/v1';
export const RFI_SNAPSHOT_PROJECTION_VERSION = 'rfi-personal-strategy-snapshot/v1';
export const PERSONAL_STRATEGY_UNAVAILABLE_INFERENCE_VERSION =
  'personal-strategy-family-inference-unavailable/v1';

export const PERSONAL_STRATEGY_ESTIMATE_STATUSES = Object.freeze({
  DIRECTLY_KNOWN: 'directly_known',
  INFERRED_HIGH: 'inferred_high',
  INFERRED_MEDIUM: 'inferred_medium',
  UNCERTAIN: 'uncertain',
  CONFLICTING: 'conflicting',
  UNKNOWN: 'unknown',
});

export const PERSONAL_STRATEGY_ESTIMATE_PROVENANCE = Object.freeze({
  DIRECT: 'direct',
  INFERRED: 'inferred',
  CONFLICT: 'conflict',
  UNKNOWN: 'unknown',
});

export const RFI_INFERENCE_REASON_CODES = Object.freeze({
  DIRECT_DOMINANT: 'direct_dominant_observation',
  DIRECT_EXACT: 'direct_exact_frequency_observation',
  DIRECT_TIED_MIX: 'direct_tied_exact_mix',
  CONFLICTING_DIRECT: 'conflicting_direct_evidence',
  MULTIPLE_CONSISTENT_NEIGHBORS: 'multiple_consistent_neighbors',
  ADJACENT_SAME_FAMILY: 'adjacent_same_family_support',
  PAIR_NEIGHBOR: 'pair_neighbor_support',
  SUITED_RUN: 'suited_run_support',
  CONNECTIVITY: 'connectivity_shift_support',
  CROSS_SHAPE: 'suited_offsuit_counterpart_support',
  BOUNDARY_NEARBY: 'boundary_nearby',
  CONFLICTING_NEIGHBOR: 'conflicting_neighbor',
  SCOPE_UNSTABLE: 'scope_locally_unstable',
  INSUFFICIENT_SUPPORT: 'insufficient_support',
  NO_EVIDENCE: 'no_structurally_relevant_evidence',
  UNSUPPORTED_DIRECT_ACTION: 'unsupported_direct_action',
  TRAINING_EXCLUDED: 'training_evidence_excluded_from_002b_inference',
});

export const RFI_NEIGHBOR_RELATION_TYPES = Object.freeze({
  PAIR_NEIGHBOR: 'pair_neighbor',
  ADJACENT_SAME_FAMILY: 'adjacent_same_family',
  SUITED_RUN: 'suited_run',
  OFFSUIT_RUN: 'offsuit_run',
  CONNECTIVITY_SHIFT: 'connectivity_shift',
  SAME_FAMILY_NEAR: 'same_family_near',
  SUITED_OFFSUIT_COUNTERPART: 'suited_offsuit_counterpart',
});

const STATUS_VALUES = new Set(Object.values(PERSONAL_STRATEGY_ESTIMATE_STATUSES));
const PROVENANCE_VALUES = new Set(Object.values(PERSONAL_STRATEGY_ESTIMATE_PROVENANCE));
const SUPPORTED_ACTIONS = new Set(
  PERSONAL_STRATEGY_RFI_ACTION_SET.legalActions.map((action) => action.type),
);
const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
const TIER_PRIORITY = Object.freeze({ primary: 0, secondary: 1, tertiary: 2 });
const NEIGHBORHOOD_CACHE = new Map();

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

function actionIdentity(actionType) {
  return actionType === null ? null : { type: actionType };
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
    total: Number((rankDistance + classPenalty + gapPenalty).toFixed(12)),
    rankDistance,
    classPenalty,
    gapPenalty: Number(gapPenalty.toFixed(12)),
  });
}

function relationBetween(targetHandClass, candidateHandClass) {
  const target = describeRfiHandClass(targetHandClass);
  const candidate = describeRfiHandClass(candidateHandClass);
  if (target.kind === 'pair' || candidate.kind === 'pair') {
    if (target.kind !== 'pair' || candidate.kind !== 'pair') return null;
    const delta = Math.abs(target.highRankIndex - candidate.highRankIndex);
    if (delta === 0 || delta > 3) return null;
    return {
      relationType: RFI_NEIGHBOR_RELATION_TYPES.PAIR_NEIGHBOR,
      tier: delta === 1 ? 'primary' : delta === 2 ? 'secondary' : 'tertiary',
      influence: delta === 1 ? 4 : delta === 2 ? 2 : 1,
    };
  }
  const highDelta = Math.abs(target.highRankIndex - candidate.highRankIndex);
  const lowDelta = Math.abs(target.lowRankIndex - candidate.lowRankIndex);
  if (target.highRankIndex === candidate.highRankIndex
    && target.lowRankIndex === candidate.lowRankIndex
    && target.kind !== candidate.kind) {
    return {
      relationType: RFI_NEIGHBOR_RELATION_TYPES.SUITED_OFFSUIT_COUNTERPART,
      tier: 'secondary',
      influence: 1,
    };
  }
  if (target.kind !== candidate.kind) return null;
  if ((highDelta === 0 && lowDelta === 1) || (highDelta === 1 && lowDelta === 0)) {
    return {
      relationType: target.kind === 'suited'
        ? RFI_NEIGHBOR_RELATION_TYPES.SUITED_RUN
        : RFI_NEIGHBOR_RELATION_TYPES.OFFSUIT_RUN,
      tier: 'primary',
      influence: 4,
    };
  }
  if (highDelta === 1 && lowDelta === 1 && target.gap === candidate.gap) {
    return {
      relationType: RFI_NEIGHBOR_RELATION_TYPES.CONNECTIVITY_SHIFT,
      tier: 'primary',
      influence: 3,
    };
  }
  const totalDelta = highDelta + lowDelta;
  if (totalDelta > 0 && totalDelta <= 2) {
    return {
      relationType: RFI_NEIGHBOR_RELATION_TYPES.SAME_FAMILY_NEAR,
      tier: 'secondary',
      influence: 2,
    };
  }
  if (totalDelta === 3 && Math.max(highDelta, lowDelta) <= 3) {
    return {
      relationType: RFI_NEIGHBOR_RELATION_TYPES.SAME_FAMILY_NEAR,
      tier: 'tertiary',
      influence: 1,
    };
  }
  return null;
}

export function rfiNeighborhoodForHandClass(handClass) {
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
  }
  if (NEIGHBORHOOD_CACHE.has(handClass)) return NEIGHBORHOOD_CACHE.get(handClass);
  const neighborhood = deepFreeze(PREFLOP_HAND_CLASSES
    .filter((candidate) => candidate !== handClass)
    .map((candidate) => ({ handClass: candidate, ...relationBetween(handClass, candidate) }))
    .filter((entry) => entry.relationType)
    .sort((left, right) => (
      TIER_PRIORITY[left.tier] - TIER_PRIORITY[right.tier]
      || right.influence - left.influence
      || HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass)
    )));
  NEIGHBORHOOD_CACHE.set(handClass, neighborhood);
  return neighborhood;
}

function exactMixMargin(strategyValue) {
  const probabilities = (strategyValue.exactFrequencies ?? [])
    .map((entry) => entry.probability)
    .sort((left, right) => right - left);
  if (probabilities.length === 0) return null;
  if (probabilities.length === 1) return probabilities[0];
  return probabilities[0] - probabilities[1];
}

function supportedDominantType(point) {
  const type = point.strategyValue.dominantAction?.type ?? null;
  return SUPPORTED_ACTIONS.has(type) ? type : null;
}

function scopeLocalStability(evidenceView) {
  const directPoints = evidenceView.points.filter((point) => (
    isSupportedRfiStrategyValue(point) && supportedDominantType(point) !== null
  ));
  let comparablePairCount = 0;
  let disagreementPairCount = 0;
  for (let leftIndex = 0; leftIndex < directPoints.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < directPoints.length; rightIndex += 1) {
      const relation = relationBetween(
        directPoints[leftIndex].handClass,
        directPoints[rightIndex].handClass,
      );
      if (relation?.tier !== 'primary') continue;
      comparablePairCount += 1;
      if (supportedDominantType(directPoints[leftIndex])
        !== supportedDominantType(directPoints[rightIndex])) disagreementPairCount += 1;
    }
  }
  let band = 'unknown';
  if (comparablePairCount >= 4) {
    if (disagreementPairCount * 4 <= comparablePairCount) band = 'stable';
    else if (disagreementPairCount * 2 <= comparablePairCount) band = 'mixed';
    else band = 'unstable';
  }
  return deepFreeze({ band, comparablePairCount, disagreementPairCount });
}

function relationReason(relationType) {
  if (relationType === RFI_NEIGHBOR_RELATION_TYPES.PAIR_NEIGHBOR) {
    return RFI_INFERENCE_REASON_CODES.PAIR_NEIGHBOR;
  }
  if (relationType === RFI_NEIGHBOR_RELATION_TYPES.SUITED_RUN) {
    return RFI_INFERENCE_REASON_CODES.SUITED_RUN;
  }
  if (relationType === RFI_NEIGHBOR_RELATION_TYPES.CONNECTIVITY_SHIFT) {
    return RFI_INFERENCE_REASON_CODES.CONNECTIVITY;
  }
  if (relationType === RFI_NEIGHBOR_RELATION_TYPES.SUITED_OFFSUIT_COUNTERPART) {
    return RFI_INFERENCE_REASON_CODES.CROSS_SHAPE;
  }
  return RFI_INFERENCE_REASON_CODES.ADJACENT_SAME_FAMILY;
}

function unique(values) {
  return [...new Set(values)];
}

function modelContext(evidenceView) {
  validatePersonalStrategyEvidenceView(evidenceView);
  return {
    pointsByHand: new Map(evidenceView.points.map((point) => [point.handClass, point])),
    scopeStability: scopeLocalStability(evidenceView),
  };
}

function inferenceSupportFor(evidenceView, handClass, context) {
  const neighborhood = rfiNeighborhoodForHandClass(handClass);
  const categorical = [];
  const boundaries = [];
  const conflicts = [];
  const unsupported = [];
  for (const relation of neighborhood) {
    const point = context.pointsByHand.get(relation.handClass);
    if (point.resolution === PERSONAL_STRATEGY_DIRECT_POINT_STATES.CONFLICTING) {
      conflicts.push({ relation, point });
      continue;
    }
    if (![PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT,
      PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT].includes(point.resolution)) continue;
    if (!isSupportedRfiStrategyValue(point)) {
      unsupported.push({ relation, point });
      continue;
    }
    const actionType = supportedDominantType(point);
    const mixMargin = exactMixMargin(point.strategyValue);
    if (actionType === null || (mixMargin !== null && mixMargin <= 0.2)) {
      boundaries.push({ relation, point });
      continue;
    }
    categorical.push({ relation, point, actionType });
  }
  const selected = categorical.filter((entry) => entry.relation.tier !== 'tertiary');
  const supportCounts = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  const supportInfluence = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  const primaryCounts = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  for (const entry of selected) {
    supportCounts[entry.actionType] += 1;
    supportInfluence[entry.actionType] += entry.relation.influence;
    if (entry.relation.tier === 'primary') primaryCounts[entry.actionType] += 1;
  }
  const winner = supportInfluence[ACTION_TYPES.RAISE] === supportInfluence[ACTION_TYPES.FOLD]
    ? null
    : supportInfluence[ACTION_TYPES.RAISE] > supportInfluence[ACTION_TYPES.FOLD]
      ? ACTION_TYPES.RAISE
      : ACTION_TYPES.FOLD;
  const loser = winner === ACTION_TYPES.RAISE ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE;
  const immediateBoundary = boundaries.some((entry) => entry.relation.tier === 'primary')
    || conflicts.some((entry) => entry.relation.tier === 'primary')
    || (winner !== null && primaryCounts[loser] > 0);
  let boundaryLikelihood = 'unknown';
  if (selected.length > 0 || boundaries.length > 0 || conflicts.length > 0) {
    if (immediateBoundary) boundaryLikelihood = 'high';
    else if (boundaries.length > 0 || conflicts.length > 0
      || (winner !== null && supportCounts[loser] > 0)
      || context.scopeStability.band === 'mixed') boundaryLikelihood = 'medium';
    else boundaryLikelihood = 'low';
  }
  const conflictProximity = conflicts.some((entry) => entry.relation.tier === 'primary')
    ? 'immediate'
    : conflicts.length > 0 ? 'near' : 'none';
  const evidenceDensity = selected.length >= 5
    ? 'dense' : selected.length >= 3 ? 'moderate' : selected.length > 0 ? 'sparse' : 'none';
  const supportDirection = winner ?? (selected.length > 0 ? 'balanced' : 'none');
  const selectedNeighbors = [...selected, ...boundaries, ...conflicts]
    .sort((left, right) => (
      TIER_PRIORITY[left.relation.tier] - TIER_PRIORITY[right.relation.tier]
      || right.relation.influence - left.relation.influence
      || HAND_INDEX.get(left.point.handClass) - HAND_INDEX.get(right.point.handClass)
    ))
    .map((entry) => ({
      handClass: entry.point.handClass,
      relationType: entry.relation.relationType,
      relationTier: entry.relation.tier,
      observedDominantAction: actionIdentity(supportedDominantType(entry.point)),
      pointResolution: entry.point.resolution,
      sourceEvidenceIds: [...entry.point.sourceEvidenceIds],
    }));
  return deepFreeze({
    schemaVersion: PERSONAL_STRATEGY_INFERENCE_SUPPORT_SCHEMA_VERSION,
    targetHandClass: handClass,
    evidenceDensity,
    supportDirection,
    supportCounts,
    primarySupportCounts: primaryCounts,
    supportInfluence,
    selectedCategoricalNeighborCount: selected.length,
    nearbyDisagreementCount: winner === null
      ? selected.length
      : supportCounts[loser] + boundaries.length + conflicts.length,
    boundaryLikelihood,
    conflictProximity,
    nearbyBoundaryCount: boundaries.length,
    nearbyConflictCount: conflicts.length,
    unsupportedNearbyDirectCount: unsupported.length,
    scopeLocalStability: cloneData(context.scopeStability),
    selectedNeighbors,
  });
}

function inferredStatus(support) {
  const winner = SUPPORTED_ACTIONS.has(support.supportDirection) ? support.supportDirection : null;
  if (winner === null) return PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN;
  const loser = winner === ACTION_TYPES.RAISE ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE;
  const high = support.scopeLocalStability.band === 'stable'
    && support.supportCounts[winner] >= 4
    && support.primarySupportCounts[winner] >= 2
    && support.supportCounts[loser] === 0
    && support.nearbyBoundaryCount === 0
    && support.nearbyConflictCount === 0
    && new Set(support.selectedNeighbors
      .filter((entry) => entry.observedDominantAction?.type === winner)
      .map((entry) => entry.relationType)).size >= 2;
  if (high) return PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH;
  const medium = support.scopeLocalStability.band !== 'unstable'
    && support.supportCounts[winner] >= 3
    && support.primarySupportCounts[winner] >= 1
    && support.primarySupportCounts[loser] === 0
    && support.boundaryLikelihood !== 'high'
    && (support.supportCounts[loser] === 0
      || support.supportInfluence[winner] >= support.supportInfluence[loser] * 3);
  return medium
    ? PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM
    : PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN;
}

function uncertaintyFor(status, reasons) {
  return {
    schemaVersion: PERSONAL_STRATEGY_UNCERTAINTY_SCHEMA_VERSION,
    semanticsVersion: RFI_UNCERTAINTY_SEMANTICS_VERSION,
    band: status,
    algorithmVersion: RFI_INFERENCE_MODEL_VERSION,
    validationCohortId: [
      PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
      PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
    ].includes(status) ? 'range-cal002b-synthetic-hard-fixtures/v1' : null,
    policyThresholdId: status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH
      ? 'rfi-high-unanimous-local/v1'
      : status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM
        ? 'rfi-medium-local-majority/v1'
        : null,
    reasons: [...reasons],
  };
}

function estimateResult(evidenceView, handClass, {
  status,
  dominantAction = null,
  exactFrequencies = null,
  provenance,
  sourceEvidenceIds = [],
  reasons,
  support,
}) {
  const legacyEstimate = {
    schemaVersion: PERSONAL_STRATEGY_ESTIMATE_SCHEMA_VERSION,
    profileId: evidenceView.scope.profileId,
    modeId: evidenceView.scope.modeId,
    strategySpotContext: cloneData(evidenceView.scope.strategySpotContext),
    contextKey: evidenceView.scope.contextKey,
    handClass,
    status,
    dominantAction: actionIdentity(dominantAction),
    exactFrequencies: exactFrequencies === null ? null : cloneData(exactFrequencies),
    provenance,
    sourceEvidenceIds: [...new Set(sourceEvidenceIds)].sort(),
    inferenceModelVersion: RFI_INFERENCE_MODEL_VERSION,
    conflictPolicyVersion: RFI_CONFLICT_POLICY_VERSION,
    reasons: unique(reasons),
    uncertainty: uncertaintyFor(status, unique(reasons)),
    support: cloneData(support),
    comboOverrides: [],
  };
  const contradictions = status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING
    ? evidenceView.conflicts.filter((conflict) => conflict.target.id === handClass)
    : [];
  const actionAwareEstimate = projectPersonalStrategyEstimateV1ToActionEstimateV2(
    legacyEstimate,
    { contradictions },
  );
  const estimate = projectActionEstimateV2ToRfiEstimateV1(actionAwareEstimate, legacyEstimate);
  validatePersonalStrategyEstimate(estimate);
  return deepFreeze(estimate);
}

export function validatePersonalStrategyEstimate(estimate) {
  requireObject(estimate, 'PersonalStrategyEstimate');
  if (estimate.schemaVersion !== PERSONAL_STRATEGY_ESTIMATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_ESTIMATE_SCHEMA_VERSION}`);
  }
  if (!STATUS_VALUES.has(estimate.status)) throw new RangeError('Unsupported Personal Strategy estimate status');
  if (!PROVENANCE_VALUES.has(estimate.provenance)) throw new RangeError('Unsupported Personal Strategy estimate provenance');
  requireString(estimate.profileId, 'PersonalStrategyEstimate.profileId');
  requireString(estimate.modeId, 'PersonalStrategyEstimate.modeId');
  requireString(estimate.contextKey, 'PersonalStrategyEstimate.contextKey');
  if (!isPreflopHandClass(estimate.handClass)) throw new RangeError('PersonalStrategyEstimate hand class is invalid');
  if (estimate.inferenceModelVersion !== RFI_INFERENCE_MODEL_VERSION) {
    throw new RangeError('PersonalStrategyEstimate model version is unsupported');
  }
  if (estimate.dominantAction !== null && !SUPPORTED_ACTIONS.has(estimate.dominantAction.type)) {
    throw new RangeError('PersonalStrategyEstimate dominant action must be Fold or Raise');
  }
  if ([PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN].includes(estimate.status)
    && (estimate.dominantAction !== null || estimate.exactFrequencies !== null)) {
    throw new RangeError('Abstained Personal Strategy estimates cannot contain a strategy value');
  }
  if ([PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM].includes(estimate.status)
    && (estimate.dominantAction === null || estimate.exactFrequencies !== null)) {
    throw new RangeError('Inferred RFI estimates are categorical and never exact-frequency output');
  }
  if (!Array.isArray(estimate.sourceEvidenceIds) || !Array.isArray(estimate.reasons)) {
    throw new TypeError('PersonalStrategyEstimate evidence IDs and reasons must be arrays');
  }
  if (!Array.isArray(estimate.comboOverrides) || estimate.comboOverrides.length !== 0) {
    throw new RangeError('RFI PersonalStrategyEstimate v1 has no generated combo overrides');
  }
  return estimate;
}

export function estimatePersonalStrategyHand(evidenceView, handClass, preparedContext = null) {
  validatePersonalStrategyEvidenceView(evidenceView);
  requireRfiInferenceContext(evidenceView.scope.context);
  if (!isPreflopHandClass(handClass)) throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
  const context = preparedContext ?? modelContext(evidenceView);
  const point = context.pointsByHand.get(handClass);
  const support = inferenceSupportFor(evidenceView, handClass, context);
  if (point.resolution === PERSONAL_STRATEGY_DIRECT_POINT_STATES.CONFLICTING) {
    return estimateResult(evidenceView, handClass, {
      status: PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING,
      provenance: PERSONAL_STRATEGY_ESTIMATE_PROVENANCE.CONFLICT,
      sourceEvidenceIds: point.sourceEvidenceIds,
      reasons: [RFI_INFERENCE_REASON_CODES.CONFLICTING_DIRECT],
      support,
    });
  }
  if ([PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT,
    PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT].includes(point.resolution)) {
    if (!isSupportedRfiStrategyValue(point)) {
      return estimateResult(evidenceView, handClass, {
        status: PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN,
        provenance: PERSONAL_STRATEGY_ESTIMATE_PROVENANCE.UNKNOWN,
        sourceEvidenceIds: point.sourceEvidenceIds,
        reasons: [RFI_INFERENCE_REASON_CODES.UNSUPPORTED_DIRECT_ACTION],
        support,
      });
    }
    const exact = point.resolution === PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_EXACT;
    const tied = exact && point.strategyValue.dominantAction === null;
    return estimateResult(evidenceView, handClass, {
      status: PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN,
      dominantAction: point.strategyValue.dominantAction?.type ?? null,
      exactFrequencies: exact ? point.strategyValue.exactFrequencies : null,
      provenance: PERSONAL_STRATEGY_ESTIMATE_PROVENANCE.DIRECT,
      sourceEvidenceIds: point.sourceEvidenceIds,
      reasons: [tied
        ? RFI_INFERENCE_REASON_CODES.DIRECT_TIED_MIX
        : exact ? RFI_INFERENCE_REASON_CODES.DIRECT_EXACT : RFI_INFERENCE_REASON_CODES.DIRECT_DOMINANT],
      support,
    });
  }
  const status = inferredStatus(support);
  if ([PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM].includes(status)) {
    const relationReasons = support.selectedNeighbors
      .filter((entry) => entry.observedDominantAction?.type === support.supportDirection)
      .map((entry) => relationReason(entry.relationType));
    return estimateResult(evidenceView, handClass, {
      status,
      dominantAction: support.supportDirection,
      provenance: PERSONAL_STRATEGY_ESTIMATE_PROVENANCE.INFERRED,
      sourceEvidenceIds: support.selectedNeighbors.flatMap((entry) => entry.sourceEvidenceIds),
      reasons: [RFI_INFERENCE_REASON_CODES.MULTIPLE_CONSISTENT_NEIGHBORS, ...relationReasons],
      support,
    });
  }
  const relevantEvidenceCount = support.selectedCategoricalNeighborCount
    + support.nearbyBoundaryCount + support.nearbyConflictCount;
  const noEvidence = relevantEvidenceCount === 0;
  const reasons = [];
  if (noEvidence) reasons.push(RFI_INFERENCE_REASON_CODES.NO_EVIDENCE);
  else reasons.push(RFI_INFERENCE_REASON_CODES.INSUFFICIENT_SUPPORT);
  if (support.boundaryLikelihood === 'high' || support.nearbyBoundaryCount > 0) {
    reasons.push(RFI_INFERENCE_REASON_CODES.BOUNDARY_NEARBY);
  }
  if (support.nearbyConflictCount > 0) reasons.push(RFI_INFERENCE_REASON_CODES.CONFLICTING_NEIGHBOR);
  if (support.scopeLocalStability.band === 'unstable') reasons.push(RFI_INFERENCE_REASON_CODES.SCOPE_UNSTABLE);
  if (point.trainingEvidenceIds.length > 0) reasons.push(RFI_INFERENCE_REASON_CODES.TRAINING_EXCLUDED);
  return estimateResult(evidenceView, handClass, {
    status: noEvidence
      ? PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN
      : PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN,
    provenance: PERSONAL_STRATEGY_ESTIMATE_PROVENANCE.UNKNOWN,
    sourceEvidenceIds: support.selectedNeighbors.flatMap((entry) => entry.sourceEvidenceIds),
    reasons,
    support,
  });
}

export function createPersonalStrategySnapshot(evidenceView) {
  validatePersonalStrategyEvidenceView(evidenceView);
  requireRfiInferenceContext(evidenceView.scope.context);
  const context = modelContext(evidenceView);
  const estimates = PREFLOP_HAND_CLASSES.map((handClass) => (
    estimatePersonalStrategyHand(evidenceView, handClass, context)
  ));
  const count = (status) => estimates.filter((estimate) => estimate.status === status).length;
  const snapshot = {
    schemaVersion: PERSONAL_STRATEGY_SNAPSHOT_SCHEMA_VERSION,
    scope: cloneData(evidenceView.scope),
    actionUniverse: cloneData(PERSONAL_STRATEGY_RFI_ACTION_SET.legalActions),
    evidenceRevision: {
      activeHeadIds: [...evidenceView.activeHeadIds],
      fingerprint: evidenceView.evidenceFingerprint,
    },
    derivation: {
      evidenceViewVersion: PERSONAL_STRATEGY_EVIDENCE_VIEW_SCHEMA_VERSION,
      conflictPolicyVersion: RFI_CONFLICT_POLICY_VERSION,
      inferenceAlgorithmVersion: RFI_INFERENCE_MODEL_VERSION,
      uncertaintySemanticsVersion: RFI_UNCERTAINTY_SEMANTICS_VERSION,
      projectionVersion: RFI_SNAPSHOT_PROJECTION_VERSION,
    },
    estimates,
    comboOverrides: [],
    summary: {
      directlyKnownCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN),
      inferredHighCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH),
      inferredMediumCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM),
      uncertainCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN),
      conflictingCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING),
      unknownCount: count(PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN),
    },
  };
  validatePersonalStrategySnapshot(snapshot);
  return deepFreeze(snapshot);
}

export function validatePersonalStrategySnapshot(snapshot) {
  requireObject(snapshot, 'PersonalStrategySnapshot');
  if (snapshot.schemaVersion !== PERSONAL_STRATEGY_SNAPSHOT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_SNAPSHOT_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(snapshot.estimates) || snapshot.estimates.length !== PREFLOP_HAND_CLASSES.length) {
    throw new RangeError('PersonalStrategySnapshot must contain exactly 169 estimates');
  }
  snapshot.estimates.forEach((estimate, index) => {
    validatePersonalStrategyEstimate(estimate);
    if (estimate.handClass !== PREFLOP_HAND_CLASSES[index]) {
      throw new RangeError('PersonalStrategySnapshot estimates must use canonical hand-class order');
    }
  });
  if (!Array.isArray(snapshot.comboOverrides) || snapshot.comboOverrides.length !== 0) {
    throw new RangeError('Initial RFI PersonalStrategySnapshot combo overrides must remain sparse and empty');
  }
  return snapshot;
}

// RANGE-CAL-002A compatibility. This adapter preserves the old request/result
// surface while delegating every decision to the v1 unified estimate authority.
export const RFI_INFERENCE_REQUEST_SCHEMA_VERSION = 'rfi-inference-request/v1';
export const RFI_INFERENCE_RESULT_SCHEMA_VERSION = 'rfi-inference-result/v1';
export const SPARSE_RFI_INFERENCE_MODEL_VERSION = RFI_INFERENCE_MODEL_VERSION;

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

function requireRfiInferenceContext(context) {
  const actionSet = getPersonalStrategyActionSetForContext(context);
  const types = actionSet.legalActions.map((entry) => entry.type);
  if (context.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    || types.length !== 2
    || types[0] !== ACTION_TYPES.FOLD
    || types[1] !== ACTION_TYPES.RAISE) {
    throw new RangeError('Current Personal Strategy inference supports only Fold/Raise preflop_rfi');
  }
  return actionSet;
}

export function validateRfiInferenceRequest(request) {
  requireObject(request, 'RFI inference request');
  if (request.schemaVersion !== RFI_INFERENCE_REQUEST_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_INFERENCE_REQUEST_SCHEMA_VERSION}`);
  }
  requireString(request.profileId, 'RFI inference request.profileId');
  requireString(request.modeId, 'RFI inference request.modeId');
  validateCalibrationContext(request.context);
  requireRfiInferenceContext(request.context);
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
  if (new Set(request.directObservations.map((entry) => entry.id)).size
    !== request.directObservations.length) {
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

export function inferPersonalStrategyActionHand({
  profileId,
  modeId,
  context,
  directObservations = [],
  requestedHandClass,
} = {}) {
  requireString(profileId, 'Personal Strategy inference profileId');
  requireString(modeId, 'Personal Strategy inference modeId');
  validateCalibrationContext(context);
  if (!isPreflopHandClass(requestedHandClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${requestedHandClass}`);
  }
  if (!Array.isArray(directObservations)) {
    throw new TypeError('Personal Strategy inference directObservations must be an array');
  }
  directObservations.forEach(validateRangeObservation);
  const actionSet = getPersonalStrategyActionSetForContext(context);
  try {
    requireRfiInferenceContext(context);
  } catch {
    return createPersonalStrategyActionEstimateV2({
      actionSet,
      target: { kind: 'hand_class', id: requestedHandClass },
      valueState: PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE,
      provenance: {
        type: 'unavailable',
        reason: 'unsupported_decision_family',
        inferenceModelVersion: PERSONAL_STRATEGY_UNAVAILABLE_INFERENCE_VERSION,
      },
      sourceType: 'unavailable',
      sourceEvidenceIds: [],
    });
  }
  const evidenceView = createPersonalStrategyEvidenceView({
    profileId,
    modeId,
    context,
    rangeObservations: directObservations,
  });
  const estimate = estimatePersonalStrategyHand(evidenceView, requestedHandClass);
  return projectPersonalStrategyEstimateV1ToActionEstimateV2(estimate, {
    contradictions: estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING
      ? evidenceView.conflicts.filter((conflict) => conflict.target.id === requestedHandClass)
      : [],
  });
}

function compatibilityAbstentionReason(estimate, evidenceView) {
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING) {
    return RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_DIRECT_EVIDENCE;
  }
  if (estimate.reasons.includes(RFI_INFERENCE_REASON_CODES.UNSUPPORTED_DIRECT_ACTION)) {
    return RFI_INFERENCE_ABSTENTION_REASONS.UNSUPPORTED_DIRECT_ACTION;
  }
  if (estimate.reasons.includes(RFI_INFERENCE_REASON_CODES.BOUNDARY_NEARBY)) {
    return estimate.support.nearbyBoundaryCount > 0
      ? RFI_INFERENCE_ABSTENTION_REASONS.NEARBY_TIED_BOUNDARY
      : RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_NEARBY_EVIDENCE;
  }
  if (evidenceView.summary.activeDirectHeadCount === 0) {
    return RFI_INFERENCE_ABSTENTION_REASONS.NO_MATCHING_SCOPE_EVIDENCE;
  }
  return RFI_INFERENCE_ABSTENTION_REASONS.INSUFFICIENT_NEARBY_EVIDENCE;
}

function oldEvidenceReference(observation, estimate, relationship) {
  return {
    observationId: observation.id,
    handClass: observation.handClass,
    observedDominantAction: actionIdentity(observation.dominantAction?.type ?? null),
    hasExplicitFrequencies: observation.hasExplicitFrequencies,
    relationship,
    distance: relationship === 'direct' || relationship === 'direct_conflict'
      ? null
      : rfiHandClassDistance(observation.handClass, estimate.handClass),
  };
}

export function inferSparseRfiHand(rawRequest) {
  const request = validateRfiInferenceRequest(rawRequest);
  const evidenceView = createPersonalStrategyEvidenceView({
    profileId: request.profileId,
    modeId: request.modeId,
    context: request.context,
    rangeObservations: request.directObservations,
  });
  const estimate = estimatePersonalStrategyHand(evidenceView, request.requestedHandClass);
  const status = estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN
    ? RFI_INFERENCE_STATUSES.DIRECT
    : [PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
      PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM].includes(estimate.status)
      ? RFI_INFERENCE_STATUSES.INFERRED
      : RFI_INFERENCE_STATUSES.ABSTAINED;
  const sourceType = status === RFI_INFERENCE_STATUSES.DIRECT
    ? RFI_INFERENCE_SOURCE_TYPES.DIRECT_CALIBRATION
    : status === RFI_INFERENCE_STATUSES.INFERRED
      ? RFI_INFERENCE_SOURCE_TYPES.SPARSE_LOCAL_NEIGHBORS
      : RFI_INFERENCE_SOURCE_TYPES.UNAVAILABLE;
  const relationship = estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING
    ? 'direct_conflict' : status === RFI_INFERENCE_STATUSES.DIRECT ? 'direct' : 'neighbor';
  const byId = new Map(request.directObservations.map((entry) => [entry.id, entry]));
  const evidenceReferences = estimate.sourceEvidenceIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((observation) => oldEvidenceReference(observation, estimate, relationship))
    .sort((left, right) => (
      (left.distance?.total ?? -1) - (right.distance?.total ?? -1)
      || HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass)
      || left.observationId.localeCompare(right.observationId, 'en')
    ));
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
      modelVersion: status === RFI_INFERENCE_STATUSES.DIRECT ? null : request.modelVersion,
    },
    dominantAction: status === RFI_INFERENCE_STATUSES.ABSTAINED
      ? null : cloneData(estimate.dominantAction),
    evidenceReferences,
    diagnostics: {
      reason: status === RFI_INFERENCE_STATUSES.ABSTAINED
        ? compatibilityAbstentionReason(estimate, evidenceView)
        : estimate.reasons.includes(RFI_INFERENCE_REASON_CODES.DIRECT_TIED_MIX)
          ? 'direct_tied_mix'
          : estimate.reasons[0],
      unifiedEstimateStatus: estimate.status,
      matchingScopeLeafCount: evidenceView.summary.activeDirectHeadCount,
      selectedNeighborCount: estimate.support.selectedCategoricalNeighborCount,
      supportCounts: cloneData(estimate.support.supportCounts),
      boundaryLikelihood: estimate.support.boundaryLikelihood,
    },
  };
  validateRfiInferenceResult(result);
  return deepFreeze(result);
}

export function validateRfiInferenceResult(result) {
  requireObject(result, 'RFI inference result');
  if (result.schemaVersion !== RFI_INFERENCE_RESULT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_INFERENCE_RESULT_SCHEMA_VERSION}`);
  }
  if (!Object.values(RFI_INFERENCE_STATUSES).includes(result.status)) {
    throw new RangeError('Unsupported RFI inference status');
  }
  if (!Array.isArray(result.evidenceReferences)) {
    throw new TypeError('RFI inference result evidenceReferences must be an array');
  }
  if (Object.hasOwn(result, 'frequencies') || Object.hasOwn(result, 'confidence')) {
    throw new RangeError('RANGE-CAL-002A compatibility does not expose frequency or confidence fields');
  }
  return result;
}
