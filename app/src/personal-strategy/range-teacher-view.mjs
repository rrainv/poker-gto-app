import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';
import {
  PERSONAL_STRATEGY_DIRECT_HEAD_STATES,
  validatePersonalStrategyEvidenceView,
} from './evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  describeRfiHandClass,
  rfiNeighborhoodForHandClass,
  validatePersonalStrategySnapshot,
} from './rfi-inference.mjs';
import {
  RFI_CALIBRATION_INTENTS,
  RFI_SELECTION_INTENTS,
} from './rfi-question-selection.mjs';
import {
  RFI_CONTEXT_TRANSFER_ESTIMATE_STATES,
  validateRfiContextTransferProjection,
} from './rfi-context-transfer.mjs';

export const RANGE_TEACHER_VIEW_SCHEMA_VERSION = 'range-teacher-view/v1';
export const RANGE_TEACHER_BOUNDARY_CLUSTER_SCHEMA_VERSION = 'boundary-cluster/v1';
export const RANGE_TEACHER_SESSION_PRESET_VERSION = 'range-teacher-session-presets/v1';

export const RANGE_TEACHER_SESSION_PRESETS = Object.freeze({
  QUICK_PROFILE: 'quick_profile',
  BOUNDARIES: 'boundaries',
  UNKNOWN_REGIONS: 'unknown_regions',
  CONFLICTS: 'conflicts',
  EXACT_MIX_REFINEMENT: 'exact_mix_refinement',
});

export const RANGE_TEACHER_PRESET_OPTIONS = Object.freeze({
  [RANGE_TEACHER_SESSION_PRESETS.QUICK_PROFILE]: Object.freeze({
    calibrationIntent: RFI_CALIBRATION_INTENTS.QUICK,
    selectionIntent: RFI_SELECTION_INTENTS.GENERAL,
  }),
  [RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES]: Object.freeze({
    calibrationIntent: RFI_CALIBRATION_INTENTS.STANDARD,
    selectionIntent: RFI_SELECTION_INTENTS.BOUNDARY_FOCUS,
  }),
  [RANGE_TEACHER_SESSION_PRESETS.UNKNOWN_REGIONS]: Object.freeze({
    calibrationIntent: RFI_CALIBRATION_INTENTS.STANDARD,
    selectionIntent: RFI_SELECTION_INTENTS.SPARSE_FOCUS,
  }),
  [RANGE_TEACHER_SESSION_PRESETS.CONFLICTS]: Object.freeze({
    calibrationIntent: RFI_CALIBRATION_INTENTS.QUICK,
    selectionIntent: RFI_SELECTION_INTENTS.CONFLICT_REVIEW,
  }),
  [RANGE_TEACHER_SESSION_PRESETS.EXACT_MIX_REFINEMENT]: Object.freeze({
    calibrationIntent: RFI_CALIBRATION_INTENTS.QUICK,
    selectionIntent: RFI_SELECTION_INTENTS.EXACT_MIX_REFINEMENT,
  }),
});

const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
const ACTIVE_HEAD = PERSONAL_STRATEGY_DIRECT_HEAD_STATES.ACTIVE;
const DIRECT = PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN;
const CONFLICTING = PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING;

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function canonicalHands(values) {
  return [...new Set(values)].sort((left, right) => HAND_INDEX.get(left) - HAND_INDEX.get(right));
}

function unique(values) {
  return [...new Set(values)];
}

function currentDirectEvidence(evidenceView, handClass) {
  return evidenceView.directEvidence.filter((entry) => (
    entry.target.id === handClass && entry.headState === ACTIVE_HEAD
  ));
}

function boundaryFamily(handClass) {
  const feature = describeRfiHandClass(handClass);
  if (feature.kind === 'pair') {
    return { id: 'pocket_pairs', type: 'pair', labelKey: 'Pocket-pair boundary around {hand}' };
  }
  const shape = feature.kind === 'suited' ? 'suited' : 'offsuit';
  return {
    id: `${shape}_${handClass[0].toLowerCase()}`,
    type: shape,
    labelKey: shape === 'suited'
      ? 'Suited {rank} boundary around {hand}'
      : 'Offsuit {rank} boundary around {hand}',
    rank: handClass[0],
  };
}

function connectedBoundarySignals(left, right) {
  if (boundaryFamily(left.handClass).id !== boundaryFamily(right.handClass).id) return false;
  return rfiNeighborhoodForHandClass(left.handClass).some((relation) => (
    relation.handClass === right.handClass && relation.tier === 'primary'
  ));
}

function boundaryClusters(snapshot, candidateRanking) {
  const byHand = new Map(snapshot.estimates.map((estimate) => [estimate.handClass, estimate]));
  const signals = candidateRanking.filter((candidate) => (
    candidate.ordinaryQuestionEligible
    && (candidate.boundaryLikelihood === 'high' || candidate.boundaryLikelihood === 'medium')
  ));
  const visited = new Set();
  const clusters = [];
  for (const signal of signals) {
    if (visited.has(signal.handClass)) continue;
    const queue = [signal];
    const members = [];
    visited.add(signal.handClass);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      signals.forEach((candidate) => {
        if (!visited.has(candidate.handClass) && connectedBoundarySignals(current, candidate)) {
          visited.add(candidate.handClass);
          queue.push(candidate);
        }
      });
    }
    members.sort((left, right) => left.rank - right.rank || left.canonicalIndex - right.canonicalIndex);
    const centerCandidates = members.map((entry) => entry.handClass);
    const neighborHands = members.flatMap((entry) => (
      byHand.get(entry.handClass).support.selectedNeighbors
        .filter((neighbor) => neighbor.relationTier === 'primary')
        .map((neighbor) => neighbor.handClass)
    ));
    const sourceEvidenceIds = unique(members.flatMap((entry) => (
      byHand.get(entry.handClass).support.selectedNeighbors.flatMap((neighbor) => neighbor.sourceEvidenceIds)
    ))).sort();
    const family = boundaryFamily(centerCandidates[0]);
    const strongest = members.some((entry) => entry.boundaryLikelihood === 'high') ? 'high' : 'medium';
    clusters.push({
      schemaVersion: RANGE_TEACHER_BOUNDARY_CLUSTER_SCHEMA_VERSION,
      clusterId: `boundary:${family.id}:${canonicalHands(centerCandidates).join('-')}`,
      family: family.id,
      familyType: family.type,
      labelKey: family.labelKey,
      labelParameters: { hand: centerCandidates[0], rank: family.rank ?? '' },
      handClasses: canonicalHands([...centerCandidates, ...neighborHands]).slice(0, 9),
      centerCandidates,
      directEvidenceIds: sourceEvidenceIds,
      uncertaintyStates: unique(members.map((entry) => entry.currentStatus)),
      strength: strongest,
      reasonCodes: unique(members.flatMap((entry) => entry.reasonCodes)),
      whyKey: 'This hand sits between nearby Raise and Fold answers.',
      suggestedAction: {
        kind: 'explore_boundary',
        handClass: centerCandidates[0],
        preset: RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES,
      },
    });
  }
  return clusters.sort((left, right) => (
    (left.strength === 'high' ? 0 : 1) - (right.strength === 'high' ? 0 : 1)
    || HAND_INDEX.get(left.centerCandidates[0]) - HAND_INDEX.get(right.centerCandidates[0])
  )).slice(0, 6);
}

const SPARSE_FAMILY_LABELS = Object.freeze({
  premium_pair: 'premium pairs',
  middle_pair: 'medium pocket pairs',
  small_pair: 'small pocket pairs',
  suited_ace: 'suited Aces',
  suited_broadway: 'suited Broadway hands',
  suited_connector: 'suited connectors',
  suited_gap_hand: 'suited gap hands',
  weak_suited: 'weak suited hands',
  offsuit_ace: 'offsuit Aces',
  offsuit_broadway: 'offsuit Broadway hands',
  offsuit_connected: 'connected offsuit hands',
  trash_offsuit: 'low offsuit hands',
});

function sparseRegions(candidateRanking) {
  const groups = new Map();
  candidateRanking.forEach((candidate) => {
    if (!candidate.ordinaryQuestionEligible
      || !['none', 'sparse'].includes(candidate.evidenceDensity)
      || !['unknown', 'uncertain'].includes(candidate.currentStatus)) return;
    const family = candidate.structuralFamily;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(candidate);
  });
  return [...groups.entries()].map(([family, candidates]) => {
    candidates.sort((left, right) => left.rank - right.rank || left.canonicalIndex - right.canonicalIndex);
    const hands = candidates.slice(0, 10).map((entry) => entry.handClass);
    return {
      regionId: `sparse:${family}`,
      family,
      familyLabel: SPARSE_FAMILY_LABELS[family] ?? family.replaceAll('_', ' '),
      handClasses: hands,
      unknownCount: candidates.filter((entry) => entry.currentStatus === 'unknown').length,
      uncertainCount: candidates.filter((entry) => entry.currentStatus === 'uncertain').length,
      suggestedQuestionCount: Math.min(3, candidates.length),
      topCandidate: hands[0],
      whyKey: 'Riverline has little direct evidence for {family}.',
      whyParameters: { family: SPARSE_FAMILY_LABELS[family] ?? family.replaceAll('_', ' ') },
      suggestedAction: {
        kind: 'explore_sparse_region',
        handClass: hands[0],
        preset: RANGE_TEACHER_SESSION_PRESETS.UNKNOWN_REGIONS,
      },
      topRank: candidates[0].rank,
    };
  }).sort((left, right) => left.topRank - right.topRank
    || HAND_INDEX.get(left.topCandidate) - HAND_INDEX.get(right.topCandidate)).slice(0, 5);
}

function contradictionHotspots(snapshot, evidenceView) {
  return snapshot.estimates.filter((estimate) => estimate.status === CONFLICTING).map((estimate) => {
    const evidence = currentDirectEvidence(evidenceView, estimate.handClass);
    return {
      hotspotId: `conflict:${estimate.handClass}:${estimate.sourceEvidenceIds.slice().sort().join('-')}`,
      handClass: estimate.handClass,
      evidence: evidence.map((entry) => ({
        evidenceId: entry.evidenceId,
        sourceKind: entry.source.kind,
        dominantAction: entry.claim.value?.dominantAction?.type ?? null,
        exactFrequencies: cloneData(entry.claim.value?.exactFrequencies ?? null),
        occurredAt: entry.occurredAt,
      })),
      whyKey: 'Your direct answers disagree here.',
      announcedState: 'conflicting',
      suggestedActions: [
        { kind: 'inspect_conflict', handClass: estimate.handClass },
        { kind: 'leave_unresolved', handClass: estimate.handClass },
      ],
    };
  }).sort((left, right) => HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass));
}

function exactMixOpportunities(snapshot, evidenceView, candidateRanking) {
  const candidatesByHand = new Map(candidateRanking.map((entry) => [entry.handClass, entry]));
  const results = [];
  snapshot.estimates.forEach((estimate) => {
    if (estimate.status === CONFLICTING || estimate.exactFrequencies !== null) return;
    const candidate = candidatesByHand.get(estimate.handClass);
    const opposingPrimary = estimate.support.primarySupportCounts.fold > 0
      && estimate.support.primarySupportCounts.raise > 0;
    const boundary = candidate?.boundaryLikelihood
      ?? (opposingPrimary ? 'high' : estimate.support.boundaryLikelihood);
    const directEvidence = currentDirectEvidence(evidenceView, estimate.handClass);
    const builderDirect = directEvidence.some((entry) => entry.source.kind === 'range_builder');
    const candidateBand = candidate?.exactMixRefinementBand ?? 'none';
    const usefulDirectBoundary = estimate.status === DIRECT
      && estimate.dominantAction !== null
      && (boundary === 'high' || (builderDirect && boundary === 'medium'));
    if (!usefulDirectBoundary && !['high', 'medium'].includes(candidateBand)) return;
    results.push({
      opportunityId: `exact-mix:${estimate.handClass}`,
      handClass: estimate.handClass,
      band: candidateBand !== 'none' ? candidateBand : boundary === 'high' ? 'high' : 'medium',
      sourceKind: builderDirect ? 'range_builder' : estimate.status === DIRECT ? 'direct' : 'inferred',
      reasonCode: builderDirect ? 'builder_dominant_near_boundary'
        : candidate?.exactMixRefinementReason ?? 'direct_dominant_near_boundary',
      whyKey: builderDirect
        ? 'A dominant-only Builder edit sits near a local boundary.'
        : 'This exact mix could clarify nearby hands.',
      suggestedAction: { kind: 'refine_exact_mix', handClass: estimate.handClass },
      canonicalIndex: HAND_INDEX.get(estimate.handClass),
      sourcePriority: builderDirect ? 0 : estimate.status === DIRECT ? 1 : 2,
    });
  });
  return results.sort((left, right) => (
    (left.band === 'high' ? 0 : 1) - (right.band === 'high' ? 0 : 1)
    || left.sourcePriority - right.sourcePriority
    || left.canonicalIndex - right.canonicalIndex
  )).slice(0, 6).map(({ canonicalIndex, sourcePriority, ...entry }) => entry);
}

function recentChanges(evidenceView) {
  const active = evidenceView.directEvidence.filter((entry) => entry.headState === ACTIVE_HEAD)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
      || right.evidenceId.localeCompare(left.evidenceId, 'en'));
  const groups = new Map();
  active.forEach((entry) => {
    const groupId = entry.source.actionGroupId;
    const key = groupId ? `builder:${groupId}` : `evidence:${entry.evidenceId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.entries()].map(([key, entries]) => {
    const newest = entries[0];
    const previous = newest.lineage.supersedesEvidenceId
      ? evidenceView.directEvidence.find((entry) => entry.evidenceId === newest.lineage.supersedesEvidenceId)
      : null;
    return {
      changeId: key,
      sourceKind: newest.source.kind,
      occurredAt: newest.occurredAt,
      handClasses: canonicalHands(entries.map((entry) => entry.target.id)),
      count: entries.length,
      currentAction: newest.claim.value?.dominantAction?.type ?? null,
      previousAction: previous?.claim.value?.dominantAction?.type ?? null,
      actionGroupId: newest.source.actionGroupId,
    };
  }).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
    || left.changeId.localeCompare(right.changeId, 'en')).slice(0, 5);
}

function transferInsights(transferProjection) {
  if (transferProjection === null) return [];
  return transferProjection.estimates.filter((estimate) => (
    estimate.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
  )).map((estimate) => ({
    handClass: estimate.handClass,
    dominantAction: cloneData(estimate.dominantAction),
    transferBand: estimate.transferBand,
    donorContextKeys: estimate.donorContributions.map((entry) => entry.donorContextKey),
    donorContributions: cloneData(estimate.donorContributions),
    sourceEvidenceIds: [...estimate.sourceEvidenceIds],
    reasonCodes: [...estimate.reasons],
    whyKey: 'Riverline transferred this qualitative action from compatible nearby RFI contexts.',
  })).sort((left, right) => HAND_INDEX.get(left.handClass) - HAND_INDEX.get(right.handClass));
}

function selectedHandDetails(
  snapshot,
  evidenceView,
  candidateRanking,
  handClass,
  transfersByHand = new Map(),
) {
  if (!handClass || !HAND_INDEX.has(handClass)) return null;
  const estimate = snapshot.estimates[HAND_INDEX.get(handClass)];
  const candidate = candidateRanking.find((entry) => entry.handClass === handClass) ?? null;
  return {
    handClass,
    status: estimate.status,
    dominantAction: cloneData(estimate.dominantAction),
    exactFrequencies: cloneData(estimate.exactFrequencies),
    reasons: [...estimate.reasons],
    support: cloneData(estimate.support),
    candidate: cloneData(candidate),
    directEvidence: currentDirectEvidence(evidenceView, handClass).map(cloneData),
    transfer: cloneData(transfersByHand.get(handClass) ?? null),
  };
}

function suggestedActions({ boundaries, conflicts, sparse, exactMix, candidateRanking, profileReady }) {
  const actions = [];
  if (conflicts[0]) actions.push({
    suggestionId: `inspect:${conflicts[0].hotspotId}`,
    kind: 'inspect_conflict',
    handClass: conflicts[0].handClass,
    titleKey: 'Inspect conflicting answers',
    whyKey: conflicts[0].whyKey,
  });
  if (boundaries[0]) actions.push({
    suggestionId: `explore:${boundaries[0].clusterId}`,
    kind: 'explore_boundary',
    handClass: boundaries[0].centerCandidates[0],
    preset: RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES,
    titleKey: 'Explore this boundary',
    whyKey: boundaries[0].whyKey,
  });
  if (sparse[0]) actions.push({
    suggestionId: `explore:${sparse[0].regionId}`,
    kind: 'explore_sparse_region',
    handClass: sparse[0].topCandidate,
    preset: RANGE_TEACHER_SESSION_PRESETS.UNKNOWN_REGIONS,
    titleKey: 'Map an unknown region',
    whyKey: sparse[0].whyKey,
    whyParameters: sparse[0].whyParameters,
  });
  if (exactMix[0]) actions.push({
    suggestionId: `refine:${exactMix[0].opportunityId}`,
    kind: 'refine_exact_mix',
    handClass: exactMix[0].handClass,
    titleKey: 'Refine exact mix',
    whyKey: exactMix[0].whyKey,
  });
  const next = candidateRanking.find((candidate) => (
    candidate.ordinaryQuestionEligible && (!profileReady || candidate.recommendedClarification)
  ));
  if (next) actions.push({
    suggestionId: `ask-next:${next.handClass}`,
    kind: 'ask_next',
    handClass: next.handClass,
    preset: RANGE_TEACHER_SESSION_PRESETS.QUICK_PROFILE,
    titleKey: profileReady ? 'Recommended clarification' : 'Ask next high-value question',
    whyKey: 'Riverline selected this from current uncertainty and question value.',
  });
  return actions;
}

export function resolveRangeTeacherSessionPreset(preset) {
  const options = RANGE_TEACHER_PRESET_OPTIONS[preset];
  if (!options) throw new RangeError(`Unsupported Range Teacher session preset: ${preset}`);
  return options;
}

export function createRangeTeacherView({
  snapshot,
  evidenceView,
  transferProjection = null,
  candidateRanking,
  progressAssessment,
  selectedHandClass = null,
  dismissedSuggestionIds = [],
} = {}) {
  validatePersonalStrategySnapshot(snapshot);
  validatePersonalStrategyEvidenceView(evidenceView);
  if (transferProjection !== null) validateRfiContextTransferProjection(transferProjection);
  if (!Array.isArray(candidateRanking)) throw new TypeError('Range Teacher candidate ranking is required');
  if (!progressAssessment || typeof progressAssessment !== 'object') {
    throw new TypeError('Range Teacher progress assessment is required');
  }
  if (snapshot.scope.profileId !== evidenceView.scope.profileId
    || snapshot.scope.modeId !== evidenceView.scope.modeId
    || snapshot.scope.contextKey !== evidenceView.scope.contextKey
    || snapshot.evidenceRevision.fingerprint !== evidenceView.evidenceFingerprint) {
    throw new RangeError('Range Teacher inputs must describe one current scope revision');
  }
  if (transferProjection !== null
    && (transferProjection.scope.profileId !== snapshot.scope.profileId
      || transferProjection.scope.modeId !== snapshot.scope.modeId
      || transferProjection.scope.contextKey !== snapshot.scope.contextKey
      || transferProjection.targetEvidenceFingerprint !== snapshot.evidenceRevision.fingerprint)) {
    throw new RangeError('Range Teacher transfer projection must describe the current target revision');
  }
  const dismissed = new Set(dismissedSuggestionIds);
  const boundaries = boundaryClusters(snapshot, candidateRanking);
  const conflicts = contradictionHotspots(snapshot, evidenceView);
  const sparse = sparseRegions(candidateRanking);
  const exactMix = exactMixOpportunities(snapshot, evidenceView, candidateRanking);
  const transferred = transferInsights(transferProjection);
  const transfersByHand = new Map((transferProjection?.estimates ?? [])
    .map((estimate) => [estimate.handClass, estimate]));
  const actions = suggestedActions({
    boundaries,
    conflicts,
    sparse,
    exactMix,
    candidateRanking,
    profileReady: progressAssessment.profileReadiness.profileReady,
  })
    .filter((action) => !dismissed.has(action.suggestionId));
  const selected = selectedHandClass
    ?? actions[0]?.handClass
    ?? candidateRanking.find((candidate) => candidate.ordinaryQuestionEligible)?.handClass
    ?? conflicts[0]?.handClass
    ?? null;
  return deepFreeze({
    schemaVersion: RANGE_TEACHER_VIEW_SCHEMA_VERSION,
    derivation: {
      teacherViewVersion: RANGE_TEACHER_VIEW_SCHEMA_VERSION,
      boundaryClusterVersion: RANGE_TEACHER_BOUNDARY_CLUSTER_SCHEMA_VERSION,
      sessionPresetVersion: RANGE_TEACHER_SESSION_PRESET_VERSION,
      snapshotVersions: cloneData(snapshot.derivation),
      transferModelVersion: transferProjection?.modelVersion ?? null,
    },
    scope: cloneData(snapshot.scope),
    evidenceRevision: cloneData(snapshot.evidenceRevision),
    summary: {
      directCount: progressAssessment.directCount,
      inferredHighCount: progressAssessment.inferredHighCount,
      inferredMediumCount: progressAssessment.inferredMediumCount,
      uncertainCount: progressAssessment.uncertainCount,
      conflictingCount: progressAssessment.conflictingCount,
      unknownCount: progressAssessment.unknownCount - transferred.length,
      localUnknownCount: progressAssessment.unknownCount,
      transferredCount: transferred.length,
      highValueQuestionCount: progressAssessment.highValueQuestionCount,
      recommendedClarificationCount: progressAssessment.recommendedClarificationCount,
      readinessState: progressAssessment.profileReadiness.state,
      profileReady: progressAssessment.profileReadiness.profileReady,
      modeledOrTransferredCount: progressAssessment.modeledOrTransferredCount,
      progressBand: progressAssessment.progressBand,
    },
    importantBoundaries: boundaries,
    contradictionHotspots: conflicts,
    sparseRegions: sparse,
    highValueNextQuestions: candidateRanking.filter((candidate) => (
      candidate.ordinaryQuestionEligible && candidate.recommendedClarification
    )).slice(0, 6),
    exactMixRefinementCandidates: exactMix,
    recentChanges: recentChanges(evidenceView),
    transferredInsights: transferred,
    selectedHand: selectedHandDetails(
      snapshot,
      evidenceView,
      candidateRanking,
      selected,
      transfersByHand,
    ),
    suggestedActions: actions,
    recommendedAction: actions[0] ?? null,
    dismissedSuggestionIds: [...dismissed].sort(),
    limitations: [
      'preflop_rfi_fold_raise_only',
      'categorical_inference_only',
      'cross_context_transfer_is_qualitative_and_derived',
      'no_reference_grading',
      'multi_head_resolution_requires_matrix_inspection',
    ],
  });
}
