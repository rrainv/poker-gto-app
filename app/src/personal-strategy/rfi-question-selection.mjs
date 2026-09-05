import { createRfiStructuralMappingFacts, matchesRfiMappingFocus, rfiMappingFamilyReasonKey, RFI_MAPPING_REASON_KEYS } from './structural-range-mapping.mjs';
import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
  PREFLOP_MATRIX_RANKS,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  describeRfiHandClass,
  rfiNeighborhoodForHandClass,
  validatePersonalStrategySnapshot,
} from './rfi-inference.mjs';
import {
  RFI_CONTEXT_TRANSFER_BANDS,
  RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES,
  RFI_CONTEXT_TRANSFER_ESTIMATE_STATES,
  validateRfiContextTransferProjection,
} from './rfi-context-transfer.mjs';

export const RFI_QUESTION_SELECTION_POLICY_VERSION = 'adaptive-rfi-question-value/v2';
export const RFI_COLD_START_POLICY_VERSION = 'adaptive-rfi-cold-start/v1';
export const RFI_STOPPING_POLICY_VERSION = 'adaptive-rfi-stopping/v2';
export const RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION = 'rfi-calibration-candidate/v2';
export const RFI_CALIBRATION_PROGRESS_SCHEMA_VERSION = 'rfi-calibration-progress/v2';
export const RFI_PROFILE_READINESS_SCHEMA_VERSION = 'rfi-profile-readiness/v1';
export const RFI_SELECTION_INTENT_POLICY_VERSION = 'adaptive-rfi-selection-intent/v1';

export const RFI_PROFILE_READINESS_STATES = Object.freeze({
  BUILDING: 'building',
  READY: 'ready',
  REFINING: 'refining',
  CONFLICTED: 'conflicted',
});

export const RFI_PROFILE_READINESS_REASON_CODES = Object.freeze({
  NEEDS_INFORMATIVE_DIRECT_EVIDENCE: 'needs_informative_direct_evidence',
  NEEDS_HAND_FAMILY_DIVERSITY: 'needs_hand_family_diversity',
  IMPORTANT_REGION_UNEXPLORED: 'important_region_unexplored',
  NEEDS_MODELED_COVERAGE: 'needs_modeled_or_transferred_coverage',
  NEEDS_RELIABLE_COVERAGE: 'needs_reliable_coverage',
  IRREGULAR_PROFILE_NEEDS_MORE_EVIDENCE: 'irregular_profile_needs_more_evidence',
  UNRESOLVED_DIRECT_CONTRADICTIONS: 'unresolved_direct_contradictions',
  TRANSFERRED_COVERAGE_AVAILABLE: 'transferred_coverage_available',
  USEFUL_FIRST_APPROXIMATION: 'useful_first_approximation',
  TARGETED_CLARIFICATIONS_AVAILABLE: 'targeted_clarifications_available',
});

export const RFI_PROFILE_READINESS_REASON_KEYS = Object.freeze({
  [RFI_PROFILE_READINESS_REASON_CODES.NEEDS_INFORMATIVE_DIRECT_EVIDENCE]: 'A few more informative direct answers are needed',
  [RFI_PROFILE_READINESS_REASON_CODES.NEEDS_HAND_FAMILY_DIVERSITY]: 'Direct evidence needs broader hand-family coverage',
  [RFI_PROFILE_READINESS_REASON_CODES.IMPORTANT_REGION_UNEXPLORED]: 'An important hand region is still unexplored',
  [RFI_PROFILE_READINESS_REASON_CODES.NEEDS_MODELED_COVERAGE]: 'Too much of this profile is still uncertain or unknown',
  [RFI_PROFILE_READINESS_REASON_CODES.NEEDS_RELIABLE_COVERAGE]: 'More direct or strongly supported local coverage is needed',
  [RFI_PROFILE_READINESS_REASON_CODES.IRREGULAR_PROFILE_NEEDS_MORE_EVIDENCE]: 'This profile is locally irregular and needs more direct evidence',
  [RFI_PROFILE_READINESS_REASON_CODES.UNRESOLVED_DIRECT_CONTRADICTIONS]: 'Conflicting direct answers need review',
  [RFI_PROFILE_READINESS_REASON_CODES.TRANSFERRED_COVERAGE_AVAILABLE]: 'Compatible nearby RFI contexts reduce unanswered work',
  [RFI_PROFILE_READINESS_REASON_CODES.USEFUL_FIRST_APPROXIMATION]: 'Riverline has a useful first approximation',
  [RFI_PROFILE_READINESS_REASON_CODES.TARGETED_CLARIFICATIONS_AVAILABLE]: 'Further questions target boundaries, uncertainty, or conflicts',
});

export const RFI_SELECTION_INTENTS = Object.freeze({
  GENERAL: 'general',
  BOUNDARY_FOCUS: 'boundary_focus',
  SPARSE_FOCUS: 'sparse_focus',
  CONFLICT_REVIEW: 'conflict_review',
  EXACT_MIX_REFINEMENT: 'exact_mix_refinement',
});

export const RFI_CALIBRATION_INTENTS = Object.freeze({
  MAPPING: 'mapping',
  QUICK: 'quick',
  STANDARD: 'standard',
  DEEP: 'deep',
  EXHAUSTIVE: 'exhaustive',
});

export const RFI_CALIBRATION_STOP_REASONS = Object.freeze({
  USER_TIME_BUDGET_REACHED: 'user_time_budget_reached',
  TARGET_COVERAGE_REACHED: 'target_coverage_reached',
  LOW_REMAINING_QUESTION_VALUE: 'low_remaining_question_value',
  NO_USEFUL_CANDIDATES: 'no_useful_candidates',
  USER_PAUSED: 'user_paused',
  USER_STOPPED: 'user_stopped',
  FULL_DIRECT_COVERAGE: 'full_direct_coverage',
  CONFLICT_RESOLUTION_NEEDED: 'conflict_resolution_needed',
  PROFILE_READY: 'profile_ready',
  INITIAL_MAP_READY: 'initial_map_ready',
  REFINEMENT_BATCH_COMPLETE: 'refinement_batch_complete',
});

export const RFI_QUESTION_REASON_CODES = Object.freeze({
  USER_SELECTED_MATRIX: 'user_selected_matrix',
  COLD_START_ANCHOR: 'cold_start_anchor',
  UNCERTAINTY_REDUCTION: 'uncertainty_reduction',
  NEAR_ACTION_BOUNDARY: 'near_action_boundary',
  PAIR_BOUNDARY: 'pair_boundary',
  LOCAL_DISAGREEMENT: 'local_disagreement',
  CLARIFIES_NEARBY_HANDS: 'clarifies_nearby_hands',
  SPARSE_REGION: 'sparse_region',
  STRUCTURAL_NOVELTY: 'structural_novelty',
  NEARBY_CONFLICT: 'nearby_conflict',
  EXPLICIT_CONFLICT_RESOLUTION: 'explicit_conflict_resolution_required',
  INFERRED_MEDIUM_REVIEW: 'inferred_medium_review',
  INFERRED_HIGH_MAINTENANCE: 'inferred_high_maintenance',
  MODELED_REGION_REDUNDANCY: 'modeled_region_redundancy_penalty',
  RELATION_DIVERSITY: 'relation_diversity',
  RECENT_REPETITION_PENALTY: 'recent_repetition_penalty',
  EXACT_MIX_REFINEMENT: 'exact_mix_refinement_available',
  TRANSFERRED_ESTIMATE_CHECK: 'transferred_estimate_check',
  TRANSFER_DISAGREEMENT: 'transfer_disagreement',
  UNKNOWN_PAIR_REGION: 'unknown_pair_region',
  OFFSUIT_BROADWAY_BOUNDARY: 'offsuit_broadway_boundary',
});

export const RFI_QUESTION_EXPLANATION_KEYS = Object.freeze({
  [RFI_QUESTION_REASON_CODES.USER_SELECTED_MATRIX]: 'Selected from your Matrix',
  [RFI_QUESTION_REASON_CODES.COLD_START_ANCHOR]: 'Samples a new hand family',
  [RFI_QUESTION_REASON_CODES.UNCERTAINTY_REDUCTION]: 'Reduces uncertainty here',
  [RFI_QUESTION_REASON_CODES.NEAR_ACTION_BOUNDARY]: 'Near a Raise/Fold boundary',
  [RFI_QUESTION_REASON_CODES.PAIR_BOUNDARY]: 'High-value pair boundary',
  [RFI_QUESTION_REASON_CODES.LOCAL_DISAGREEMENT]: 'Nearby answers disagree',
  [RFI_QUESTION_REASON_CODES.CLARIFIES_NEARBY_HANDS]: 'Clarifies nearby hands',
  [RFI_QUESTION_REASON_CODES.SPARSE_REGION]: 'Little evidence here',
  [RFI_QUESTION_REASON_CODES.STRUCTURAL_NOVELTY]: 'Explores a different hand family',
  [RFI_QUESTION_REASON_CODES.NEARBY_CONFLICT]: 'Conflicting nearby answers',
  [RFI_QUESTION_REASON_CODES.EXPLICIT_CONFLICT_RESOLUTION]: 'This hand needs explicit conflict resolution',
  [RFI_QUESTION_REASON_CODES.INFERRED_MEDIUM_REVIEW]: 'Checks a medium inference',
  [RFI_QUESTION_REASON_CODES.INFERRED_HIGH_MAINTENANCE]: 'Checks a stable inferred region',
  [RFI_QUESTION_REASON_CODES.MODELED_REGION_REDUNDANCY]: 'Already modeled by a supported regional run',
  [RFI_QUESTION_REASON_CODES.RELATION_DIVERSITY]: 'Connects several nearby hand patterns',
  [RFI_QUESTION_REASON_CODES.EXACT_MIX_REFINEMENT]: 'An exact mix may be useful near this boundary',
  [RFI_QUESTION_REASON_CODES.TRANSFERRED_ESTIMATE_CHECK]: 'Checks a transferred estimate',
  [RFI_QUESTION_REASON_CODES.TRANSFER_DISAGREEMENT]: 'Checks a transferred estimate that disagrees locally',
  [RFI_QUESTION_REASON_CODES.UNKNOWN_PAIR_REGION]: 'Maps an unknown pocket-pair region',
  [RFI_QUESTION_REASON_CODES.OFFSUIT_BROADWAY_BOUNDARY]: 'Clarifies your offsuit Broadway boundary',
});

// These are learning anchors, not poker prescriptions or universal thresholds.
// The list is deliberately small; support and boundary facts take over as soon
// as direct evidence exists.
export const RFI_COLD_START_ANCHORS = Object.freeze([
  'AA',
  '72o',
  '77',
  'A5s',
  'AJo',
  'T9s',
  'K8s',
  'Q9o',
  '44',
]);

export const RFI_CALIBRATION_INTENT_POLICIES = Object.freeze({
  [RFI_CALIBRATION_INTENTS.MAPPING]: Object.freeze({ maxQuestionCount: null, minimumDirectCount: null, targetHighQualityCoverage: null, lowQuestionValueThreshold: 0 }),
  [RFI_CALIBRATION_INTENTS.QUICK]: Object.freeze({
    maxQuestionCount: 5,
    minimumDirectCount: 5,
    targetHighQualityCoverage: 0.20,
    lowQuestionValueThreshold: 44,
  }),
  [RFI_CALIBRATION_INTENTS.STANDARD]: Object.freeze({
    maxQuestionCount: 30,
    minimumDirectCount: 15,
    targetHighQualityCoverage: 0.55,
    lowQuestionValueThreshold: 34,
  }),
  [RFI_CALIBRATION_INTENTS.DEEP]: Object.freeze({
    maxQuestionCount: 75,
    minimumDirectCount: 30,
    targetHighQualityCoverage: 0.80,
    lowQuestionValueThreshold: 24,
  }),
  [RFI_CALIBRATION_INTENTS.EXHAUSTIVE]: Object.freeze({
    maxQuestionCount: 169,
    minimumDirectCount: 169,
    targetHighQualityCoverage: 1,
    lowQuestionValueThreshold: 0,
  }),
});

const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
const COLD_START_INDEX = new Map(RFI_COLD_START_ANCHORS.map((handClass, index) => [handClass, index]));
const DIRECT_STATUS = PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN;
const CONFLICT_STATUS = PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING;
const ORDINARY_UNRESOLVED_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN,
]);
const INTENT_VALUES = new Set(Object.values(RFI_CALIBRATION_INTENTS));
const SELECTION_INTENT_VALUES = new Set(Object.values(RFI_SELECTION_INTENTS));
const TIER_COVERAGE_WEIGHT = Object.freeze({ primary: 4, secondary: 2, tertiary: 1 });
const BOUNDARY_VALUE = Object.freeze({ unknown: 0, low: 18, medium: 62, high: 100 });
const UNCERTAINTY_VALUE = Object.freeze({
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING]: 100,
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN]: 100,
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN]: 88,
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM]: 54,
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH]: 18,
});
const TRANSFER_SUPPORT_VALUE = Object.freeze({
  [RFI_CONTEXT_TRANSFER_BANDS.STRONG]: 100,
  [RFI_CONTEXT_TRANSFER_BANDS.MODERATE]: 70,
  [RFI_CONTEXT_TRANSFER_BANDS.WEAK]: 35,
  [RFI_CONTEXT_TRANSFER_BANDS.NONE]: 0,
});
const MAX_RECOMMENDED_CLARIFICATIONS = 6;
const MODELED_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
]);
const RELIABLE_LOCAL_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
]);
const READINESS_THRESHOLDS_BY_STABILITY = Object.freeze({
  unknown: Object.freeze({ minimumDirectCount: 15, minimumModeledCount: 45, minimumReliableCount: 28, minimumFamilyCount: 6 }),
  stable: Object.freeze({ minimumDirectCount: 15, minimumModeledCount: 45, minimumReliableCount: 28, minimumFamilyCount: 6 }),
  mixed: Object.freeze({ minimumDirectCount: 24, minimumModeledCount: 45, minimumReliableCount: 28, minimumFamilyCount: 7 }),
  unstable: Object.freeze({ minimumDirectCount: 36, minimumModeledCount: 65, minimumReliableCount: 45, minimumFamilyCount: 8 }),
});

export const RFI_PROFILE_READINESS_REGIONS = Object.freeze({
  PREMIUM_AND_STRONG: 'premium_and_strong',
  POCKET_PAIRS: 'pocket_pairs',
  SUITED_HANDS: 'suited_hands',
  OFFSUIT_HANDS: 'offsuit_hands',
  WEAKER_BOUNDARIES: 'weaker_boundaries',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function unique(values) {
  return [...new Set(values)];
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function normalizeHandHistory(values, label) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values) || values.some((value) => !isPreflopHandClass(value))) {
    throw new TypeError(`${label} must contain canonical preflop hand classes`);
  }
  return [...values];
}

export function normalizeRfiCalibrationIntent(value = RFI_CALIBRATION_INTENTS.STANDARD) {
  if (!INTENT_VALUES.has(value)) throw new RangeError(`Unsupported RFI calibration intent: ${value}`);
  return value;
}

export function normalizeRfiSelectionIntent(value = RFI_SELECTION_INTENTS.GENERAL) {
  if (!SELECTION_INTENT_VALUES.has(value)) {
    throw new RangeError(`Unsupported RFI selection intent: ${value}`);
  }
  return value;
}

export function rfiCalibrationStructuralFamily(handClass) {
  const feature = describeRfiHandClass(handClass);
  if (feature.kind === 'pair') {
    if (feature.highRankIndex <= 2) return 'premium_pair';
    if (feature.highRankIndex <= 8) return 'middle_pair';
    return 'small_pair';
  }
  const isAce = feature.highRankIndex === 0;
  const isBroadway = feature.highRankIndex <= 4 && feature.lowRankIndex <= 4;
  if (feature.kind === 'suited') {
    if (isAce) return 'suited_ace';
    if (isBroadway) return 'suited_broadway';
    if (feature.gap === 0) return 'suited_connector';
    if (feature.gap <= 2) return 'suited_gap_hand';
    return 'weak_suited';
  }
  if (isAce) return 'offsuit_ace';
  if (isBroadway) return 'offsuit_broadway';
  if (feature.gap <= 1) return 'offsuit_connected';
  return 'trash_offsuit';
}

export function rfiCalibrationReadinessRegions(handClass) {
  const feature = describeRfiHandClass(handClass);
  const regions = [];
  const isBroadway = feature.kind !== 'pair'
    && feature.highRankIndex <= 4 && feature.lowRankIndex <= 4;
  const isPremiumPair = feature.kind === 'pair' && feature.highRankIndex <= 3;
  if (isPremiumPair || isBroadway) {
    regions.push(RFI_PROFILE_READINESS_REGIONS.PREMIUM_AND_STRONG);
  }
  if (feature.kind === 'pair') regions.push(RFI_PROFILE_READINESS_REGIONS.POCKET_PAIRS);
  if (feature.kind === 'suited') regions.push(RFI_PROFILE_READINESS_REGIONS.SUITED_HANDS);
  if (feature.kind === 'offsuit') regions.push(RFI_PROFILE_READINESS_REGIONS.OFFSUIT_HANDS);
  if ((feature.kind === 'pair' && feature.highRankIndex >= 7)
    || (feature.kind !== 'pair' && (feature.lowRankIndex >= 7 || feature.gap >= 3))) {
    regions.push(RFI_PROFILE_READINESS_REGIONS.WEAKER_BOUNDARIES);
  }
  return Object.freeze(regions);
}

function transferEstimatesFor(snapshot, transferProjection) {
  if (transferProjection === undefined || transferProjection === null) return new Map();
  validateRfiContextTransferProjection(transferProjection);
  if (transferProjection.scope.profileId !== snapshot.scope.profileId
    || transferProjection.scope.modeId !== snapshot.scope.modeId
    || transferProjection.scope.contextKey !== snapshot.scope.contextKey
    || transferProjection.targetEvidenceFingerprint !== snapshot.evidenceRevision.fingerprint) {
    throw new RangeError('Calibration transfer projection must describe the current snapshot revision');
  }
  return new Map(transferProjection.estimates.map((estimate) => [estimate.handClass, estimate]));
}

function transferFactsFor(estimate, transferEstimate) {
  if (!transferEstimate) {
    return {
      state: RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNAVAILABLE,
      band: RFI_CONTEXT_TRANSFER_BANDS.NONE,
      supportValue: 0,
      disagreementValue: 0,
      disagreement: false,
      consistentSupport: false,
      donorAction: null,
      donorSignalState: RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.UNAVAILABLE,
      sourceEvidenceIds: [],
    };
  }
  const donorSignal = transferEstimate.donorSignal;
  const donorAction = donorSignal?.dominantAction?.type
    ?? transferEstimate.dominantAction?.type
    ?? null;
  const localAction = estimate.dominantAction?.type
    ?? ([ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(estimate.support.supportDirection)
      ? estimate.support.supportDirection : null);
  const donorConflict = donorSignal?.state === RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONFLICTING
    || transferEstimate.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNCERTAIN;
  const actionDisagreement = localAction !== null && donorAction !== null && localAction !== donorAction;
  const disagreement = donorConflict || actionDisagreement;
  const consistentSupport = localAction !== null && donorAction === localAction;
  const band = transferEstimate.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
    ? transferEstimate.transferBand
    : donorSignal?.transferBand ?? RFI_CONTEXT_TRANSFER_BANDS.NONE;
  return {
    state: transferEstimate.state,
    band,
    supportValue: disagreement ? 0 : (TRANSFER_SUPPORT_VALUE[band] ?? 0),
    disagreementValue: donorConflict ? 100 : actionDisagreement ? 90 : 0,
    disagreement,
    consistentSupport,
    donorAction,
    donorSignalState: donorSignal?.state
      ?? RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.UNAVAILABLE,
    sourceEvidenceIds: [...(donorSignal?.sourceEvidenceIds
      ?? transferEstimate.sourceEvidenceIds ?? [])],
  };
}

function relationTypesFor(estimate) {
  return unique(estimate.support.selectedNeighbors.map((entry) => entry.relationType));
}

function estimateMaps(snapshot) {
  const byHand = new Map(snapshot.estimates.map((estimate) => [estimate.handClass, estimate]));
  const directFamilyCounts = {};
  for (const estimate of snapshot.estimates) {
    if (estimate.status !== DIRECT_STATUS) continue;
    const family = rfiCalibrationStructuralFamily(estimate.handClass);
    directFamilyCounts[family] = (directFamilyCounts[family] ?? 0) + 1;
  }
  return { byHand, directFamilyCounts };
}

function coverageFacts(handClass, byHand) {
  const unresolvedNeighbors = rfiNeighborhoodForHandClass(handClass).filter((relation) => {
    const status = byHand.get(relation.handClass).status;
    return status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN
      || status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN;
  });
  const rawCoverageGain = unresolvedNeighbors.reduce(
    (sum, relation) => sum + TIER_COVERAGE_WEIGHT[relation.tier],
    0,
  );
  const relationDiversityCount = new Set(unresolvedNeighbors.map((entry) => entry.relationType)).size;
  return {
    unresolvedNeighbors,
    rawCoverageGain,
    relationDiversityCount,
  };
}

function repetitionPenalty(handClass, structuralFamily, recentQuestionHistory) {
  const recent = recentQuestionHistory.slice(-6).reverse();
  let penalty = 0;
  recent.forEach((recentHand, index) => {
    const recency = Math.max(1, 6 - index);
    const relation = rfiNeighborhoodForHandClass(handClass)
      .find((entry) => entry.handClass === recentHand);
    if (relation?.tier === 'primary') penalty += recency * 7;
    else if (relation?.tier === 'secondary') penalty += recency * 4;
    else if (rfiCalibrationStructuralFamily(recentHand) === structuralFamily) penalty += recency * 2;
  });
  return clamp(penalty);
}

function noveltyValue(structuralFamily, directFamilyCounts, recentQuestionHistory) {
  const directCount = directFamilyCounts[structuralFamily] ?? 0;
  const recentCount = recentQuestionHistory.slice(-8)
    .filter((handClass) => rfiCalibrationStructuralFamily(handClass) === structuralFamily).length;
  return clamp(100 - directCount * 23 - recentCount * 18);
}

function questionBoundaryLikelihood(estimate) {
  const opposingPrimary = estimate.support.primarySupportCounts.fold > 0
    && estimate.support.primarySupportCounts.raise > 0;
  if (opposingPrimary) return 'high';
  const opposingLocal = estimate.support.supportCounts.fold > 0
    && estimate.support.supportCounts.raise > 0;
  if (opposingLocal && estimate.support.nearbyDisagreementCount >= 2) return 'high';
  return estimate.support.boundaryLikelihood;
}

function exactMixRefinement(estimate, boundaryLikelihood) {
  if (estimate.status === CONFLICT_STATUS) {
    return { value: 0, band: 'none', reason: 'explicit_conflict_resolution_required' };
  }
  if (boundaryLikelihood === 'high') {
    return { value: 86, band: 'high', reason: 'sharp_local_action_boundary' };
  }
  if (boundaryLikelihood === 'medium'
    || estimate.support.nearbyBoundaryCount > 0) {
    return { value: 58, band: 'medium', reason: 'nearby_action_transition' };
  }
  return { value: 0, band: 'none', reason: null };
}

function modeledRegionPenalty(estimate, boundaryLikelihood) {
  if (boundaryLikelihood === 'high' || boundaryLikelihood === 'medium') return 0;
  if (estimate.support.regionalInterpolation?.state !== 'supported_run') return 0;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH) return 100;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM) return 72;
  return 0;
}

function priorityTier(estimate, coldStartIndex, boundaryLikelihood, transferFacts) {
  if (estimate.status === CONFLICT_STATUS) return 500;
  if (transferFacts.disagreement) return 360;
  if (boundaryLikelihood === 'high') return 320;
  if (coldStartIndex !== null) return 300;
  if (boundaryLikelihood === 'medium') return 260;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN) return 230;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN) return 210;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM) return 140;
  return 100;
}

function candidateReasons({
  estimate,
  feature,
  coldStartIndex,
  coverageGainPotential,
  novelty,
  repetition,
  relationDiversityCount,
  exactMix,
  boundaryLikelihood,
  transferFacts,
  modeledPenalty,
}) {
  const reasons = [];
  if (estimate.status === CONFLICT_STATUS) reasons.push(RFI_QUESTION_REASON_CODES.EXPLICIT_CONFLICT_RESOLUTION);
  if (transferFacts.disagreement) reasons.push(RFI_QUESTION_REASON_CODES.TRANSFER_DISAGREEMENT);
  if (coldStartIndex !== null) reasons.push(RFI_QUESTION_REASON_CODES.COLD_START_ANCHOR);
  if (boundaryLikelihood === 'high') {
    if (feature.kind === 'pair') reasons.push(RFI_QUESTION_REASON_CODES.PAIR_BOUNDARY);
    else if (estimate.handClass.endsWith('o')
      && feature.highRankIndex <= 4 && feature.lowRankIndex <= 4) {
      reasons.push(RFI_QUESTION_REASON_CODES.OFFSUIT_BROADWAY_BOUNDARY);
    } else reasons.push(RFI_QUESTION_REASON_CODES.NEAR_ACTION_BOUNDARY);
  }
  if (estimate.support.nearbyDisagreementCount > 0) reasons.push(RFI_QUESTION_REASON_CODES.LOCAL_DISAGREEMENT);
  if (estimate.support.nearbyConflictCount > 0) reasons.push(RFI_QUESTION_REASON_CODES.NEARBY_CONFLICT);
  if (coverageGainPotential >= 45) reasons.push(RFI_QUESTION_REASON_CODES.CLARIFIES_NEARBY_HANDS);
  if (estimate.support.evidenceDensity === 'none' || estimate.support.evidenceDensity === 'sparse') {
    reasons.push(RFI_QUESTION_REASON_CODES.SPARSE_REGION);
  }
  if (novelty >= 70) reasons.push(RFI_QUESTION_REASON_CODES.STRUCTURAL_NOVELTY);
  if (relationDiversityCount >= 3) reasons.push(RFI_QUESTION_REASON_CODES.RELATION_DIVERSITY);
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN
    || estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN) {
    reasons.push(RFI_QUESTION_REASON_CODES.UNCERTAINTY_REDUCTION);
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN
    && feature.kind === 'pair') reasons.push(RFI_QUESTION_REASON_CODES.UNKNOWN_PAIR_REGION);
  if (transferFacts.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED) {
    reasons.push(RFI_QUESTION_REASON_CODES.TRANSFERRED_ESTIMATE_CHECK);
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM) {
    reasons.push(RFI_QUESTION_REASON_CODES.INFERRED_MEDIUM_REVIEW);
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH) {
    reasons.push(RFI_QUESTION_REASON_CODES.INFERRED_HIGH_MAINTENANCE);
  }
  if (modeledPenalty > 0) reasons.push(RFI_QUESTION_REASON_CODES.MODELED_REGION_REDUNDANCY);
  if (repetition > 0) reasons.push(RFI_QUESTION_REASON_CODES.RECENT_REPETITION_PENALTY);
  if (exactMix.value > 0) reasons.push(RFI_QUESTION_REASON_CODES.EXACT_MIX_REFINEMENT);
  return unique(reasons);
}

function isRecommendedClarification({
  estimate,
  boundaryLikelihood,
  coverageGainPotential,
  novelty,
  exactMix,
  transferFacts,
}) {
  if (estimate.status === CONFLICT_STATUS || transferFacts.disagreement) return true;
  if (boundaryLikelihood === 'high' || estimate.support.nearbyConflictCount > 0) return true;
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN) {
    return coverageGainPotential >= 35 || novelty >= 45 || boundaryLikelihood === 'medium';
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN) {
    if (transferFacts.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
      && transferFacts.supportValue >= TRANSFER_SUPPORT_VALUE[RFI_CONTEXT_TRANSFER_BANDS.MODERATE]) {
      return false;
    }
    return coverageGainPotential >= 55 || novelty >= 70;
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM) {
    return boundaryLikelihood === 'medium' || transferFacts.donorSignalState
      === RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONFLICTING;
  }
  return exactMix.band === 'high' && boundaryLikelihood === 'high';
}

function compareCandidates(left, right) {
  return (right.mappingPriority ?? 0) - (left.mappingPriority ?? 0)
    || right.biasedPriorityTier - left.biasedPriorityTier
    || (left.coldStartIndex ?? Number.MAX_SAFE_INTEGER)
      - (right.coldStartIndex ?? Number.MAX_SAFE_INTEGER)
    || right.questionValueScore - left.questionValueScore
    || right.components.boundaryValue - left.components.boundaryValue
    || right.components.transferDisagreementValue - left.components.transferDisagreementValue
    || right.components.uncertaintyValue - left.components.uncertaintyValue
    || right.components.coverageGainPotential - left.components.coverageGainPotential
    || right.components.noveltyValue - left.components.noveltyValue
    || left.canonicalIndex - right.canonicalIndex;
}

function selectionIntentBias(selectionIntent, {
  estimate,
  boundaryLikelihood,
  novelty,
  exactMix,
} = {}) {
  if (selectionIntent === RFI_SELECTION_INTENTS.BOUNDARY_FOCUS) {
    return boundaryLikelihood === 'high' ? 240 : boundaryLikelihood === 'medium' ? 120 : 0;
  }
  if (selectionIntent === RFI_SELECTION_INTENTS.SPARSE_FOCUS) {
    const sparse = estimate.support.evidenceDensity === 'none'
      ? 180 : estimate.support.evidenceDensity === 'sparse' ? 120 : 0;
    return sparse + Math.round(novelty / 4);
  }
  if (selectionIntent === RFI_SELECTION_INTENTS.CONFLICT_REVIEW) {
    return estimate.status === CONFLICT_STATUS ? 300 : estimate.support.nearbyConflictCount > 0 ? 100 : 0;
  }
  if (selectionIntent === RFI_SELECTION_INTENTS.EXACT_MIX_REFINEMENT) {
    return exactMix.value * 2;
  }
  return 0;
}

/**
 * Ranks unresolved RFI hand classes by deterministic QUESTION VALUE.
 * questionValueScore is not poker confidence, action probability, range weight,
 * expected value, or a claim about optimal strategy.
 */
export function rankCalibrationCandidates(snapshot, options = {}) {
  validatePersonalStrategySnapshot(snapshot);
  const selectionIntent = normalizeRfiSelectionIntent(options.selectionIntent);
  const recentQuestionHistory = normalizeHandHistory(
    options.recentQuestionHistory ?? options.askedHandClasses,
    'recentQuestionHistory',
  );
  const skippedHandClasses = new Set(normalizeHandHistory(
    options.skippedHandClasses,
    'skippedHandClasses',
  ));
  const includeSkipped = options.includeSkipped === true;
  const { byHand, directFamilyCounts } = estimateMaps(snapshot);
  const transfersByHand = transferEstimatesFor(snapshot, options.transferProjection);
  const mapping = options.intent === RFI_CALIBRATION_INTENTS.MAPPING
    ? createRfiStructuralMappingFacts({ snapshot, evidenceView: options.mappingEvidenceView }) : null;
  const mappingDirectHands = new Set(mapping?.directHands ?? []);
  const mappingConflictHands = new Set(mapping?.conflictHands ?? []);
  const directCount = snapshot.summary.directlyKnownCount;
  const coldStartActive = directCount < RFI_COLD_START_ANCHORS.length;
  const coverageByHand = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [
    handClass,
    coverageFacts(handClass, byHand),
  ]));
  const maximumRawCoverage = Math.max(
    1,
    ...coverageByHand.values().map((entry) => entry.rawCoverageGain),
  );

  const candidates = [];
  for (let estimate of snapshot.estimates) {
    if (mappingConflictHands.has(estimate.handClass)) estimate = { ...estimate, status: CONFLICT_STATUS };
    if (estimate.status === DIRECT_STATUS || mappingDirectHands.has(estimate.handClass)) continue;
    if (!ORDINARY_UNRESOLVED_STATUSES.has(estimate.status) && estimate.status !== CONFLICT_STATUS) continue;
    if (!includeSkipped && skippedHandClasses.has(estimate.handClass)) continue;
    const feature = describeRfiHandClass(estimate.handClass);
    const structuralFamily = rfiCalibrationStructuralFamily(estimate.handClass);
    const coverage = coverageByHand.get(estimate.handClass);
    const coverageGainPotential = clamp((coverage.rawCoverageGain / maximumRawCoverage) * 100);
    const relationDiversityValue = clamp((coverage.relationDiversityCount / 4) * 100);
    const novelty = noveltyValue(structuralFamily, directFamilyCounts, recentQuestionHistory);
    const repetition = repetitionPenalty(estimate.handClass, structuralFamily, recentQuestionHistory);
    const uncertainty = UNCERTAINTY_VALUE[estimate.status] ?? 0;
    const boundaryLikelihood = questionBoundaryLikelihood(estimate);
    const boundary = BOUNDARY_VALUE[boundaryLikelihood] ?? 0;
    const conflict = estimate.status === CONFLICT_STATUS
      ? 100 : estimate.support.conflictProximity === 'immediate'
        ? 72 : estimate.support.conflictProximity === 'near' ? 38 : 0;
    const transferFacts = transferFactsFor(estimate, transfersByHand.get(estimate.handClass));
    const exactMix = exactMixRefinement(estimate, boundaryLikelihood);
    const modeledPenalty = modeledRegionPenalty(estimate, boundaryLikelihood);
    const interactionCost = exactMix.band === 'high' && options.preferExactMixRefinement === true ? 135 : 100;
    const weightedValue = (
      uncertainty * 35
      + boundary * 30
      + coverageGainPotential * 20
      + novelty * 15
      + relationDiversityValue * 10
      + conflict * 15
      + transferFacts.disagreementValue * 25
      - transferFacts.supportValue * 18
      - repetition * 20
      - modeledPenalty * 30
    );
    const score = clamp(weightedValue / interactionCost);
    const seedIndex = coldStartActive && COLD_START_INDEX.has(estimate.handClass)
      ? COLD_START_INDEX.get(estimate.handClass) : null;
    const reasons = candidateReasons({
      estimate,
      feature,
      coldStartIndex: seedIndex,
      coverageGainPotential,
      novelty,
      repetition,
      relationDiversityCount: coverage.relationDiversityCount,
      exactMix,
      boundaryLikelihood,
      transferFacts,
      modeledPenalty,
    });
    const basePriorityTier = priorityTier(estimate, seedIndex, boundaryLikelihood, transferFacts);
    const selectionBiasValue = selectionIntentBias(selectionIntent, {
      estimate,
      boundaryLikelihood,
      novelty,
      exactMix,
    });
    const transferPriorityAdjustment = transferFacts.disagreement
      ? 120
      : transferFacts.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
        ? -Math.round(transferFacts.supportValue * 0.7)
        : transferFacts.consistentSupport ? -Math.round(transferFacts.supportValue * 0.35) : 0;
    const recommendedClarification = isRecommendedClarification({
      estimate,
      boundaryLikelihood,
      coverageGainPotential,
      novelty,
      exactMix,
      transferFacts,
    });
    let mappingPriority = 0, mappingReasonKey = null, mappingFamilyId = null;
    if (mapping) {
      const specificFocus = mapping.families.some((entry) => entry.id === options.mappingFocus);
      const proposals = mapping.families.filter((entry) => entry.probeHand === estimate.handClass && entry.state !== 'initially_sampled'
        && (!specificFocus || entry.id === options.mappingFocus));
      const family = proposals.sort((a, b) => ({ unmapped: 4, boundary: 3, nearby: 1, gap: 0 }[b.probeKind]
        - { unmapped: 4, boundary: 3, nearby: 1, gap: 0 }[a.probeKind]))[0];
      if (family) {
        mappingPriority = ({ unmapped: 4000, boundary: 3000, nearby: 1500, gap: 1000 })[family.probeKind];
        mappingReasonKey = rfiMappingFamilyReasonKey(family.id);
        mappingFamilyId = family.id;
      }
      if (estimate.status === CONFLICT_STATUS) { mappingPriority = Math.max(mappingPriority, 2000); mappingReasonKey = RFI_MAPPING_REASON_KEYS.conflict; }
      if (matchesRfiMappingFocus(estimate.handClass, options.mappingFocus)) {
        mappingPriority += 10000; mappingReasonKey = estimate.status === CONFLICT_STATUS
          ? RFI_MAPPING_REASON_KEYS.conflict : RFI_MAPPING_REASON_KEYS.focus;
      }
      mappingFamilyId ??= mapping.families.find((entry) => entry.handClasses.includes(estimate.handClass))?.id ?? null;
      mappingReasonKey ??= rfiMappingFamilyReasonKey(mappingFamilyId);
    }
    candidates.push({
      schemaVersion: RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION,
      selectionPolicyVersion: RFI_QUESTION_SELECTION_POLICY_VERSION,
      coldStartPolicyVersion: RFI_COLD_START_POLICY_VERSION,
      handClass: estimate.handClass,
      rank: 0,
      canonicalIndex: HAND_INDEX.get(estimate.handClass),
      questionValueScore: score,
      questionValueSemantics: 'deterministic_question_value_not_confidence_or_probability',
      selectionIntentPolicyVersion: RFI_SELECTION_INTENT_POLICY_VERSION,
      selectionIntent,
      selectionBiasValue,
      transferPriorityAdjustment,
      priorityTier: basePriorityTier,
      biasedPriorityTier: basePriorityTier + selectionBiasValue + transferPriorityAdjustment,
      currentStatus: estimate.status,
      predictedDominantAction: estimate.dominantAction,
      uncertaintyBand: estimate.uncertainty.band,
      evidenceDensity: estimate.support.evidenceDensity,
      regionalInterpolationState: estimate.support.regionalInterpolation?.state ?? 'unavailable',
      supportDirection: estimate.support.supportDirection,
      boundaryLikelihood,
      conflictProximity: estimate.support.conflictProximity,
      nearbyDisagreementCount: estimate.support.nearbyDisagreementCount,
      nearbyBoundaryCount: estimate.support.nearbyBoundaryCount,
      nearbyConflictCount: estimate.support.nearbyConflictCount,
      nearbyUnresolvedCount: coverage.unresolvedNeighbors.length,
      relationTypes: relationTypesFor(estimate),
      structuralFamily,
      ...(mapping ? { mappingPriority, mappingReasonKey, mappingFamilyId } : {}),
      transferState: transferFacts.state,
      transferBand: transferFacts.band,
      transferDonorSignalState: transferFacts.donorSignalState,
      transferDonorAction: transferFacts.donorAction === null
        ? null : { type: transferFacts.donorAction },
      transferSourceEvidenceIds: transferFacts.sourceEvidenceIds,
      transferDisagreement: transferFacts.disagreement,
      transferConsistentSupport: transferFacts.consistentSupport,
      coldStartIndex: seedIndex,
      questionKind: estimate.status === CONFLICT_STATUS ? 'conflict_resolution' : 'ordinary_observation',
      ordinaryQuestionEligible: estimate.status !== CONFLICT_STATUS,
      resolutionNeed: estimate.status === CONFLICT_STATUS
        ? 'explicit_conflict_resolution' : 'another_observation',
      reasonCodes: reasons,
      priorityReasons: reasons
        .filter((code) => Object.hasOwn(RFI_QUESTION_EXPLANATION_KEYS, code))
        .slice(0, 3),
      exactMixRefinementValue: exactMix.value,
      exactMixRefinementBand: exactMix.band,
      exactMixRefinementReason: exactMix.reason,
      recommendedClarification,
      components: {
        uncertaintyValue: uncertainty,
        boundaryValue: boundary,
        coverageGainPotential,
        noveltyValue: novelty,
        conflictValue: conflict,
        transferSupportValue: transferFacts.supportValue,
        transferDisagreementValue: transferFacts.disagreementValue,
        relationDiversityValue,
        repetitionPenalty: repetition,
        modeledRegionPenalty: modeledPenalty,
        interactionCost,
      },
    });
  }

  candidates.sort(compareCandidates);
  return deepFreeze(candidates.map((candidate, index) => ({ ...candidate, rank: index + 1 })));
}

export function getNextCalibrationQuestion(snapshot, options = {}) {
  const ranked = options.rankedCandidates ?? rankCalibrationCandidates(snapshot, options);
  if (!Array.isArray(ranked)) throw new TypeError('rankedCandidates must be an array');
  return ranked.find((candidate) => candidate.ordinaryQuestionEligible) ?? null;
}

export function createUserDirectedMatrixQuestion(snapshot, handClass, options = {}) {
  validatePersonalStrategySnapshot(snapshot);
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError('Matrix question must use a canonical preflop hand class');
  }
  const rankedCandidates = options.rankedCandidates ?? [];
  if (!Array.isArray(rankedCandidates)) throw new TypeError('rankedCandidates must be an array');
  const ranked = rankedCandidates.find((candidate) => candidate.handClass === handClass) ?? null;
  const estimate = snapshot.estimates.find((entry) => entry.handClass === handClass);
  if (!estimate) throw new RangeError('Matrix question hand is unavailable in this projection');
  return deepFreeze({
    ...(ranked ?? {}),
    schemaVersion: RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION,
    selectionPolicyVersion: RFI_QUESTION_SELECTION_POLICY_VERSION,
    coldStartPolicyVersion: RFI_COLD_START_POLICY_VERSION,
    handClass,
    rank: ranked?.rank ?? 0,
    canonicalIndex: HAND_INDEX.get(handClass),
    questionValueScore: ranked?.questionValueScore ?? 0,
    questionValueSemantics: ranked?.questionValueSemantics
      ?? 'user_directed_selection_not_confidence_or_probability',
    currentStatus: estimate.status,
    predictedDominantAction: estimate.dominantAction,
    transferState: null,
    transferDisagreement: false,
    questionKind: 'user_directed_matrix',
    ordinaryQuestionEligible: true,
    resolutionNeed: 'user_directed_revisit',
    reasonCodes: [RFI_QUESTION_REASON_CODES.USER_SELECTED_MATRIX],
    priorityReasons: [RFI_QUESTION_REASON_CODES.USER_SELECTED_MATRIX],
    relationTypes: ranked?.relationTypes ?? [],
    nearbyUnresolvedCount: ranked?.nearbyUnresolvedCount ?? 0,
    recommendedClarification: false,
  });
}

export function getCalibrationQuestionExplanation(candidate) {
  if (!candidate || candidate.schemaVersion !== RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION) {
    throw new TypeError('A ranked RFI calibration candidate is required');
  }
  if (candidate.mappingReasonKey) return deepFreeze({ reasonCode: 'structural_range_mapping',
    messageKey: candidate.mappingReasonKey, familyId: candidate.mappingFamilyId, nearbyHands: [] });
  let reasonCode;
  if (candidate.questionKind === 'conflict_resolution') {
    reasonCode = RFI_QUESTION_REASON_CODES.EXPLICIT_CONFLICT_RESOLUTION;
  } else if (candidate.transferDisagreement) {
    reasonCode = RFI_QUESTION_REASON_CODES.TRANSFER_DISAGREEMENT;
  } else if (candidate.transferState === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED) {
    reasonCode = RFI_QUESTION_REASON_CODES.TRANSFERRED_ESTIMATE_CHECK;
  } else if (candidate.reasonCodes.includes(RFI_QUESTION_REASON_CODES.OFFSUIT_BROADWAY_BOUNDARY)) {
    reasonCode = RFI_QUESTION_REASON_CODES.OFFSUIT_BROADWAY_BOUNDARY;
  } else if (candidate.currentStatus === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN
    && candidate.reasonCodes.includes(RFI_QUESTION_REASON_CODES.UNKNOWN_PAIR_REGION)) {
    reasonCode = RFI_QUESTION_REASON_CODES.UNKNOWN_PAIR_REGION;
  } else {
    reasonCode = candidate.priorityReasons[0]
      ?? candidate.reasonCodes[0]
      ?? RFI_QUESTION_REASON_CODES.UNCERTAINTY_REDUCTION;
  }
  const nearbyHands = candidate.relationTypes.length === 0
    ? []
    : candidate.nearbyUnresolvedCount > 0
      ? candidate.relationTypes.slice(0, 3)
      : [];
  return deepFreeze({
    reasonCode,
    messageKey: RFI_QUESTION_EXPLANATION_KEYS[reasonCode]
      ?? RFI_QUESTION_EXPLANATION_KEYS[RFI_QUESTION_REASON_CODES.UNCERTAINTY_REDUCTION],
    nearbyHands,
  });
}

function coverageMetric(count) {
  return deepFreeze({
    count,
    total: PREFLOP_HAND_CLASSES.length,
    percent: Number(((count / PREFLOP_HAND_CLASSES.length) * 100).toFixed(1)),
  });
}

function readinessPriority(candidate) {
  const explanation = getCalibrationQuestionExplanation(candidate);
  return {
    handClass: candidate.handClass,
    rank: candidate.rank,
    questionKind: candidate.questionKind,
    reasonCode: explanation.reasonCode,
    messageKey: explanation.messageKey,
    currentStatus: candidate.currentStatus,
    transferState: candidate.transferState,
    transferBand: candidate.transferBand,
    transferDisagreement: candidate.transferDisagreement,
  };
}

export function assessRfiProfileReadiness(snapshot, options = {}) {
  validatePersonalStrategySnapshot(snapshot);
  const rankedCandidates = options.rankedCandidates
    ?? rankCalibrationCandidates(snapshot, options);
  if (!Array.isArray(rankedCandidates)) {
    throw new TypeError('rankedCandidates must be an array');
  }
  const transfersByHand = transferEstimatesFor(snapshot, options.transferProjection);
  const directEstimates = snapshot.estimates.filter((estimate) => estimate.status === DIRECT_STATUS);
  const directFamilies = new Map();
  const directRegions = new Map(Object.values(RFI_PROFILE_READINESS_REGIONS)
    .map((region) => [region, []]));
  for (const estimate of directEstimates) {
    const family = rfiCalibrationStructuralFamily(estimate.handClass);
    directFamilies.set(family, (directFamilies.get(family) ?? 0) + 1);
    for (const region of rfiCalibrationReadinessRegions(estimate.handClass)) {
      directRegions.get(region).push(estimate.handClass);
    }
  }

  let localModeledCount = 0;
  let reliableLocalCount = 0;
  let transferredCount = 0;
  let reliableTransferredCount = 0;
  for (const estimate of snapshot.estimates) {
    if (MODELED_STATUSES.has(estimate.status)) localModeledCount += 1;
    if (RELIABLE_LOCAL_STATUSES.has(estimate.status)) reliableLocalCount += 1;
    const transfer = transfersByHand.get(estimate.handClass);
    if (transfer?.state !== RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
      || MODELED_STATUSES.has(estimate.status)) continue;
    transferredCount += 1;
    if (transfer.transferBand === RFI_CONTEXT_TRANSFER_BANDS.STRONG
      || transfer.transferBand === RFI_CONTEXT_TRANSFER_BANDS.MODERATE) {
      reliableTransferredCount += 1;
    }
  }

  const stabilityBand = snapshot.estimates[0]?.support.scopeLocalStability.band ?? 'unknown';
  const thresholdBand = Object.hasOwn(READINESS_THRESHOLDS_BY_STABILITY, stabilityBand)
    ? stabilityBand : 'unknown';
  const thresholds = READINESS_THRESHOLDS_BY_STABILITY[thresholdBand];
  const directCount = directEstimates.length;
  const modeledOrTransferredCount = localModeledCount + transferredCount;
  const reliableCount = reliableLocalCount + reliableTransferredCount;
  const majorUnexploredRegions = [...directRegions.entries()]
    .filter(([, handClasses]) => handClasses.length === 0)
    .map(([region]) => region);
  const blockerReasonCodes = [];
  if (directCount < thresholds.minimumDirectCount) {
    blockerReasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.NEEDS_INFORMATIVE_DIRECT_EVIDENCE);
  }
  if (directFamilies.size < thresholds.minimumFamilyCount) {
    blockerReasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.NEEDS_HAND_FAMILY_DIVERSITY);
  }
  if (majorUnexploredRegions.length > 0) {
    blockerReasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.IMPORTANT_REGION_UNEXPLORED);
  }
  if (modeledOrTransferredCount < thresholds.minimumModeledCount) {
    blockerReasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.NEEDS_MODELED_COVERAGE);
  }
  if (reliableCount < thresholds.minimumReliableCount) {
    blockerReasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.NEEDS_RELIABLE_COVERAGE);
  }
  if ((thresholdBand === 'mixed' || thresholdBand === 'unstable')
    && directCount < thresholds.minimumDirectCount) {
    blockerReasonCodes.push(
      RFI_PROFILE_READINESS_REASON_CODES.IRREGULAR_PROFILE_NEEDS_MORE_EVIDENCE,
    );
  }
  if (snapshot.summary.conflictingCount > 0) {
    blockerReasonCodes.unshift(
      RFI_PROFILE_READINESS_REASON_CODES.UNRESOLVED_DIRECT_CONTRADICTIONS,
    );
  }

  const profileReady = blockerReasonCodes.length === 0;
  const nextClarificationPriorities = rankedCandidates
    .filter((candidate) => candidate.recommendedClarification)
    .slice(0, MAX_RECOMMENDED_CLARIFICATIONS)
    .map(readinessPriority);
  const uncertainRegions = unique(nextClarificationPriorities
    .map((priority) => rfiCalibrationStructuralFamily(priority.handClass)));
  const reasonCodes = [...blockerReasonCodes];
  if (profileReady) {
    reasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.USEFUL_FIRST_APPROXIMATION);
  }
  if (transferredCount > 0) {
    reasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.TRANSFERRED_COVERAGE_AVAILABLE);
  }
  if (profileReady && nextClarificationPriorities.length > 0) {
    reasonCodes.push(RFI_PROFILE_READINESS_REASON_CODES.TARGETED_CLARIFICATIONS_AVAILABLE);
  }
  const state = snapshot.summary.conflictingCount > 0
    ? RFI_PROFILE_READINESS_STATES.CONFLICTED
    : profileReady && options.refinementActive === true
      ? RFI_PROFILE_READINESS_STATES.REFINING
      : profileReady
        ? RFI_PROFILE_READINESS_STATES.READY
        : RFI_PROFILE_READINESS_STATES.BUILDING;

  return deepFreeze({
    schemaVersion: RFI_PROFILE_READINESS_SCHEMA_VERSION,
    state,
    profileReady,
    stabilityBand,
    thresholdBand,
    thresholdsApplied: { ...thresholds },
    reasonCodes: unique(reasonCodes),
    reasons: unique(reasonCodes).map((reasonCode) => ({
      reasonCode,
      messageKey: RFI_PROFILE_READINESS_REASON_KEYS[reasonCode],
    })),
    blockerReasonCodes: unique(blockerReasonCodes),
    directCount,
    locallyInferredCount: snapshot.summary.inferredHighCount + snapshot.summary.inferredMediumCount,
    transferredCount,
    modeledHandCount: snapshot.summary.inferredHighCount
      + snapshot.summary.inferredMediumCount
      + transferredCount,
    modeledOrTransferredCount,
    reliableCount,
    reliableLocalCount,
    reliableTransferredCount,
    uncertainCount: snapshot.summary.uncertainCount,
    localUnknownCount: snapshot.summary.unknownCount,
    visibleUnknownCount: Math.max(0, snapshot.summary.unknownCount - transferredCount),
    conflictingCount: snapshot.summary.conflictingCount,
    familyCoverage: [...directFamilies.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, count]) => ({ family, directCount: count })),
    directFamilyCount: directFamilies.size,
    regionCoverage: [...directRegions.entries()].map(([region, handClasses]) => ({
      region,
      directCount: handClasses.length,
      handClasses,
    })),
    majorUnexploredRegions,
    uncertainRegions,
    uncertainRegionCount: uncertainRegions.length,
    recommendedClarificationCount: nextClarificationPriorities.length,
    nextClarificationPriorities,
  });
}

export function assessCalibrationProgress(snapshot, options = {}) {
  validatePersonalStrategySnapshot(snapshot);
  const intent = normalizeRfiCalibrationIntent(options.intent);
  const policy = RFI_CALIBRATION_INTENT_POLICIES[intent];
  const refinementBatchRemaining = Number.isInteger(options.refinementBatchRemaining)
    && options.refinementBatchRemaining > 0 ? options.refinementBatchRemaining : 0;
  const refinementActive = options.refinementActive === true && refinementBatchRemaining > 0;
  const rankedCandidates = options.rankedCandidates
    ?? rankCalibrationCandidates(snapshot, options);
  let profileReadiness = assessRfiProfileReadiness(snapshot, {
    ...options,
    refinementActive,
    rankedCandidates,
  });
  const generalNextCandidate = rankedCandidates
    .find((candidate) => candidate.ordinaryQuestionEligible) ?? null;
  const clarificationCandidate = rankedCandidates.find((candidate) => (
    candidate.ordinaryQuestionEligible && candidate.recommendedClarification
  )) ?? null;
  const nextCandidate = intent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE
    && (profileReadiness.profileReady || refinementActive)
    ? clarificationCandidate : generalNextCandidate;
  const directCount = snapshot.summary.directlyKnownCount;
  const inferredHighCount = snapshot.summary.inferredHighCount;
  const inferredMediumCount = snapshot.summary.inferredMediumCount;
  const uncertainCount = snapshot.summary.uncertainCount;
  const conflictingCount = snapshot.summary.conflictingCount;
  const unknownCount = snapshot.summary.unknownCount;
  const attempted = coverageMetric(directCount + inferredHighCount + inferredMediumCount);
  const highQuality = coverageMetric(directCount + inferredHighCount);
  const sessionQuestionCount = Number.isInteger(options.sessionQuestionCount)
    && options.sessionQuestionCount >= 0 ? options.sessionQuestionCount : 0;
  const additionalQuestionAllowance = Number.isInteger(options.additionalQuestionAllowance)
    && options.additionalQuestionAllowance > 0 ? options.additionalQuestionAllowance : 0;
  let shouldStop = false;
  let stopReason = null;

  if (directCount === PREFLOP_HAND_CLASSES.length) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE;
  } else if (options.userStopped === true) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.USER_STOPPED;
  } else if (options.userPaused === true) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.USER_PAUSED;
  } else if (profileReadiness.state === RFI_PROFILE_READINESS_STATES.CONFLICTED) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED;
  } else if (profileReadiness.profileReady
    && options.refinementActive === true
    && refinementBatchRemaining === 0
    && intent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.REFINEMENT_BATCH_COMPLETE;
  } else if (profileReadiness.profileReady
    && !refinementActive
    && intent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE
    && additionalQuestionAllowance === 0) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.PROFILE_READY;
  } else if (!nextCandidate) {
    shouldStop = true;
    stopReason = RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES;
  } else if (additionalQuestionAllowance === 0 && intent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
    if (!refinementActive && sessionQuestionCount >= policy.maxQuestionCount) {
      shouldStop = true;
      stopReason = RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED;
    }
  }

  let coverage = null;
  if (intent === RFI_CALIBRATION_INTENTS.MAPPING) {
    coverage = createRfiStructuralMappingFacts({ snapshot, evidenceView: options.mappingEvidenceView });
    profileReadiness = { ...profileReadiness, profileReady: coverage.initialMapReady,
      state: coverage.conflictHands.length ? RFI_PROFILE_READINESS_STATES.CONFLICTED
        : coverage.initialMapReady ? RFI_PROFILE_READINESS_STATES.READY : RFI_PROFILE_READINESS_STATES.BUILDING,
      coverage };
    // Mapping has no session-count quota. Stop only on explicit pause/stop,
    // evidence coverage, or exhaustion of the finite canonical hand set.
    stopReason = options.userStopped ? RFI_CALIBRATION_STOP_REASONS.USER_STOPPED
      : options.userPaused ? RFI_CALIBRATION_STOP_REASONS.USER_PAUSED
        : coverage.completeRange ? RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE
          : rankedCandidates[0]?.questionKind === 'conflict_resolution' ? RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED
          : coverage.initialMapReady && additionalQuestionAllowance === 0 && !refinementActive ? RFI_CALIBRATION_STOP_REASONS.INITIAL_MAP_READY
            : !generalNextCandidate ? conflictingCount ? RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED
              : RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES : null;
    shouldStop = stopReason !== null;
  }

  let recommendedAction = 'answer_next_question';
  if (stopReason === RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED) {
    recommendedAction = 'resolve_conflicts';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE) {
    recommendedAction = 'review_snapshot';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.PROFILE_READY) {
    recommendedAction = profileReadiness.recommendedClarificationCount > 0
      ? 'continue_refining_or_review' : 'review_snapshot';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.REFINEMENT_BATCH_COMPLETE) {
    recommendedAction = profileReadiness.recommendedClarificationCount > 0
      ? 'review_or_start_another_refinement_batch' : 'review_snapshot';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.USER_PAUSED
    || stopReason === RFI_CALIBRATION_STOP_REASONS.USER_STOPPED) {
    recommendedAction = 'resume_later';
  } else if (shouldStop) recommendedAction = nextCandidate ? 'ask_another' : 'review_snapshot';

  return deepFreeze({
    schemaVersion: RFI_CALIBRATION_PROGRESS_SCHEMA_VERSION,
    stoppingPolicyVersion: RFI_STOPPING_POLICY_VERSION,
    intent,
    ...(coverage ? { coverage } : {}),
    shouldStop,
    stopReason,
    directCount: coverage?.directCount ?? directCount,
    inferredHighCount,
    inferredMediumCount,
    locallyInferredCount: profileReadiness.locallyInferredCount,
    transferredCount: profileReadiness.transferredCount,
    modeledHandCount: profileReadiness.modeledHandCount,
    modeledOrTransferredCount: profileReadiness.modeledOrTransferredCount,
    uncertainCount,
    conflictingCount: coverage?.conflictHands.length ?? conflictingCount,
    unknownCount,
    visibleUnknownCount: profileReadiness.visibleUnknownCount,
    attemptedCoverage: attempted,
    highQualityCoverage: highQuality,
    nextQuestionValue: nextCandidate?.questionValueScore ?? null,
    highValueQuestionCount: profileReadiness.recommendedClarificationCount,
    recommendedClarificationCount: profileReadiness.recommendedClarificationCount,
    progressBand: profileReadiness.state,
    profileReadiness,
    recommendedAction,
    sessionQuestionCount,
    refinementBatchRemaining,
    questionBudget: policy.maxQuestionCount,
  });
}
