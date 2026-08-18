import {
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

export const RFI_QUESTION_SELECTION_POLICY_VERSION = 'adaptive-rfi-question-value/v1';
export const RFI_COLD_START_POLICY_VERSION = 'adaptive-rfi-cold-start/v1';
export const RFI_STOPPING_POLICY_VERSION = 'adaptive-rfi-stopping/v1';
export const RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION = 'rfi-calibration-candidate/v1';
export const RFI_CALIBRATION_PROGRESS_SCHEMA_VERSION = 'rfi-calibration-progress/v1';
export const RFI_SELECTION_INTENT_POLICY_VERSION = 'adaptive-rfi-selection-intent/v1';

export const RFI_SELECTION_INTENTS = Object.freeze({
  GENERAL: 'general',
  BOUNDARY_FOCUS: 'boundary_focus',
  SPARSE_FOCUS: 'sparse_focus',
  CONFLICT_REVIEW: 'conflict_review',
  EXACT_MIX_REFINEMENT: 'exact_mix_refinement',
});

export const RFI_CALIBRATION_INTENTS = Object.freeze({
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
});

export const RFI_QUESTION_REASON_CODES = Object.freeze({
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
  RELATION_DIVERSITY: 'relation_diversity',
  RECENT_REPETITION_PENALTY: 'recent_repetition_penalty',
  EXACT_MIX_REFINEMENT: 'exact_mix_refinement_available',
});

export const RFI_QUESTION_EXPLANATION_KEYS = Object.freeze({
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
  [RFI_QUESTION_REASON_CODES.RELATION_DIVERSITY]: 'Connects several nearby hand patterns',
  [RFI_QUESTION_REASON_CODES.EXACT_MIX_REFINEMENT]: 'An exact mix may be useful near this boundary',
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
    return status !== DIRECT_STATUS && status !== CONFLICT_STATUS;
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

function priorityTier(estimate, coldStartIndex, boundaryLikelihood) {
  if (estimate.status === CONFLICT_STATUS) return 400;
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
}) {
  const reasons = [];
  if (estimate.status === CONFLICT_STATUS) reasons.push(RFI_QUESTION_REASON_CODES.EXPLICIT_CONFLICT_RESOLUTION);
  if (coldStartIndex !== null) reasons.push(RFI_QUESTION_REASON_CODES.COLD_START_ANCHOR);
  if (boundaryLikelihood === 'high') {
    reasons.push(feature.kind === 'pair'
      ? RFI_QUESTION_REASON_CODES.PAIR_BOUNDARY
      : RFI_QUESTION_REASON_CODES.NEAR_ACTION_BOUNDARY);
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
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM) {
    reasons.push(RFI_QUESTION_REASON_CODES.INFERRED_MEDIUM_REVIEW);
  }
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH) {
    reasons.push(RFI_QUESTION_REASON_CODES.INFERRED_HIGH_MAINTENANCE);
  }
  if (repetition > 0) reasons.push(RFI_QUESTION_REASON_CODES.RECENT_REPETITION_PENALTY);
  if (exactMix.value > 0) reasons.push(RFI_QUESTION_REASON_CODES.EXACT_MIX_REFINEMENT);
  return unique(reasons);
}

function compareCandidates(left, right) {
  return right.biasedPriorityTier - left.biasedPriorityTier
    || (left.coldStartIndex ?? Number.MAX_SAFE_INTEGER)
      - (right.coldStartIndex ?? Number.MAX_SAFE_INTEGER)
    || right.questionValueScore - left.questionValueScore
    || right.components.boundaryValue - left.components.boundaryValue
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
  for (const estimate of snapshot.estimates) {
    if (estimate.status === DIRECT_STATUS) continue;
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
    const exactMix = exactMixRefinement(estimate, boundaryLikelihood);
    const interactionCost = exactMix.band === 'high' && options.preferExactMixRefinement === true ? 135 : 100;
    const weightedValue = (
      uncertainty * 35
      + boundary * 30
      + coverageGainPotential * 20
      + novelty * 15
      + relationDiversityValue * 10
      + conflict * 15
      - repetition * 20
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
    });
    const basePriorityTier = priorityTier(estimate, seedIndex, boundaryLikelihood);
    const selectionBiasValue = selectionIntentBias(selectionIntent, {
      estimate,
      boundaryLikelihood,
      novelty,
      exactMix,
    });
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
      priorityTier: basePriorityTier,
      biasedPriorityTier: basePriorityTier + selectionBiasValue,
      currentStatus: estimate.status,
      predictedDominantAction: estimate.dominantAction,
      uncertaintyBand: estimate.uncertainty.band,
      evidenceDensity: estimate.support.evidenceDensity,
      supportDirection: estimate.support.supportDirection,
      boundaryLikelihood,
      conflictProximity: estimate.support.conflictProximity,
      nearbyDisagreementCount: estimate.support.nearbyDisagreementCount,
      nearbyBoundaryCount: estimate.support.nearbyBoundaryCount,
      nearbyConflictCount: estimate.support.nearbyConflictCount,
      nearbyUnresolvedCount: coverage.unresolvedNeighbors.length,
      relationTypes: relationTypesFor(estimate),
      structuralFamily,
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
      components: {
        uncertaintyValue: uncertainty,
        boundaryValue: boundary,
        coverageGainPotential,
        noveltyValue: novelty,
        conflictValue: conflict,
        relationDiversityValue,
        repetitionPenalty: repetition,
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

export function getCalibrationQuestionExplanation(candidate) {
  if (!candidate || candidate.schemaVersion !== RFI_CALIBRATION_CANDIDATE_SCHEMA_VERSION) {
    throw new TypeError('A ranked RFI calibration candidate is required');
  }
  const reasonCode = candidate.priorityReasons[0]
    ?? candidate.reasonCodes[0]
    ?? RFI_QUESTION_REASON_CODES.UNCERTAINTY_REDUCTION;
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

function progressBand({ directCount, attemptedCoverage, highQualityCoverage }) {
  if (directCount === PREFLOP_HAND_CLASSES.length) return 'full_direct_coverage';
  if (highQualityCoverage.count >= 127) return 'well_mapped';
  if (attemptedCoverage.count >= 101) return 'mostly_mapped';
  if (directCount >= 15) return 'developing';
  if (directCount >= 5) return 'started';
  return 'cold_start';
}

export function assessCalibrationProgress(snapshot, options = {}) {
  validatePersonalStrategySnapshot(snapshot);
  const intent = normalizeRfiCalibrationIntent(options.intent);
  const policy = RFI_CALIBRATION_INTENT_POLICIES[intent];
  const rankedCandidates = options.rankedCandidates
    ?? rankCalibrationCandidates(snapshot, options);
  const nextCandidate = rankedCandidates.find((candidate) => candidate.ordinaryQuestionEligible) ?? null;
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
  } else if (!nextCandidate) {
    shouldStop = true;
    stopReason = conflictingCount > 0
      ? RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED
      : RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES;
  } else if (additionalQuestionAllowance === 0 && intent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
    if (sessionQuestionCount >= policy.maxQuestionCount) {
      shouldStop = true;
      stopReason = RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED;
    } else if (directCount >= policy.minimumDirectCount
      && highQuality.percent / 100 >= policy.targetHighQualityCoverage) {
      shouldStop = true;
      stopReason = RFI_CALIBRATION_STOP_REASONS.TARGET_COVERAGE_REACHED;
    } else if (directCount >= policy.minimumDirectCount
      && nextCandidate.questionValueScore < policy.lowQuestionValueThreshold) {
      shouldStop = true;
      stopReason = conflictingCount > 0
        ? RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED
        : RFI_CALIBRATION_STOP_REASONS.LOW_REMAINING_QUESTION_VALUE;
    }
  }

  let recommendedAction = 'answer_next_question';
  if (stopReason === RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED) {
    recommendedAction = 'resolve_conflicts';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE) {
    recommendedAction = 'review_snapshot';
  } else if (stopReason === RFI_CALIBRATION_STOP_REASONS.USER_PAUSED
    || stopReason === RFI_CALIBRATION_STOP_REASONS.USER_STOPPED) {
    recommendedAction = 'resume_later';
  } else if (shouldStop) recommendedAction = nextCandidate ? 'ask_another' : 'review_snapshot';

  return deepFreeze({
    schemaVersion: RFI_CALIBRATION_PROGRESS_SCHEMA_VERSION,
    stoppingPolicyVersion: RFI_STOPPING_POLICY_VERSION,
    intent,
    shouldStop,
    stopReason,
    directCount,
    inferredHighCount,
    inferredMediumCount,
    uncertainCount,
    conflictingCount,
    unknownCount,
    attemptedCoverage: attempted,
    highQualityCoverage: highQuality,
    nextQuestionValue: nextCandidate?.questionValueScore ?? null,
    highValueQuestionCount: rankedCandidates.filter((candidate) => (
      candidate.ordinaryQuestionEligible
      && candidate.questionValueScore >= policy.lowQuestionValueThreshold
    )).length,
    progressBand: progressBand({
      directCount,
      attemptedCoverage: attempted,
      highQualityCoverage: highQuality,
    }),
    recommendedAction,
    sessionQuestionCount,
    questionBudget: policy.maxQuestionCount,
  });
}
