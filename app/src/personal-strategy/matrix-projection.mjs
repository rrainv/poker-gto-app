import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
} from '../../../shared/poker-domain/index.js';
import {
  PERSONAL_STRATEGY_DIRECT_HEAD_STATES,
  validatePersonalStrategyEvidenceView,
} from './evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  validatePersonalStrategySnapshot,
} from './rfi-inference.mjs';
import {
  RFI_CONTEXT_TRANSFER_ESTIMATE_STATES,
  validateRfiContextTransferProjection,
} from './rfi-context-transfer.mjs';

export const PERSONAL_STRATEGY_MATRIX_PROJECTION_SCHEMA_VERSION =
  'personal-strategy-matrix-projection/v1';

export const PERSONAL_STRATEGY_MATRIX_PRECISIONS = Object.freeze({
  UNKNOWN: 'unknown',
  DOMINANT_ONLY: 'dominant_only',
  PURE_EXPLICIT: 'pure_explicit',
  EXACT_MIX: 'exact_mix',
  TIED_EXACT_MIX: 'tied_exact_mix',
});

export const PERSONAL_STRATEGY_MATRIX_STATUSES = Object.freeze({
  ...PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  TRANSFERRED: 'transferred',
});

export const PERSONAL_STRATEGY_MATRIX_STATUS_MARKERS = Object.freeze({
  [PERSONAL_STRATEGY_MATRIX_STATUSES.TRANSFERRED]: 'T',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN]: 'D',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH]: 'H',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM]: 'M',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN]: '?',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING]: '!',
  [PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN]: '·',
});

const ACTIVE_HEAD = PERSONAL_STRATEGY_DIRECT_HEAD_STATES.ACTIVE;

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function precisionFor(estimate) {
  if (estimate.exactFrequencies === null) {
    return estimate.dominantAction
      ? PERSONAL_STRATEGY_MATRIX_PRECISIONS.DOMINANT_ONLY
      : PERSONAL_STRATEGY_MATRIX_PRECISIONS.UNKNOWN;
  }
  if (estimate.dominantAction === null) {
    return PERSONAL_STRATEGY_MATRIX_PRECISIONS.TIED_EXACT_MIX;
  }
  if (estimate.exactFrequencies.length === 1
    && Math.abs(estimate.exactFrequencies[0].probability - 1) <= Number.EPSILON) {
    return PERSONAL_STRATEGY_MATRIX_PRECISIONS.PURE_EXPLICIT;
  }
  return PERSONAL_STRATEGY_MATRIX_PRECISIONS.EXACT_MIX;
}

function actionPresentation(estimate, precision) {
  const dominantAction = estimate.dominantAction?.type ?? null;
  let kind = 'none';
  if (estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING) kind = 'conflict';
  else if (precision === PERSONAL_STRATEGY_MATRIX_PRECISIONS.TIED_EXACT_MIX) kind = 'mixed';
  else if (dominantAction === ACTION_TYPES.FOLD) kind = 'fold';
  else if (dominantAction === ACTION_TYPES.RAISE) kind = 'raise';
  return {
    kind,
    dominantAction,
    exactFrequencies: cloneData(estimate.exactFrequencies),
    precision,
  };
}

function evidenceForHand(evidenceView, handClass) {
  const direct = evidenceView.directEvidence
    .filter((entry) => entry.target.id === handClass)
    .sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt)
      || right.evidenceId.localeCompare(left.evidenceId, 'en')
    ));
  const training = evidenceView.trainingEvidence
    .filter((entry) => entry.target.id === handClass)
    .sort((left, right) => (
      right.occurredAt.localeCompare(left.occurredAt)
      || right.evidenceId.localeCompare(left.evidenceId, 'en')
    ));
  return {
    activeDirect: direct.filter((entry) => entry.headState === ACTIVE_HEAD),
    directHistory: direct,
    supersededDirect: direct.filter((entry) => entry.headState === 'superseded'),
    retractedDirect: direct.filter((entry) => entry.headState === 'retracted'),
    training,
  };
}

function questionForHand(candidate, highValueHandClasses) {
  if (!candidate) return null;
  return {
    rank: candidate.rank,
    questionValueScore: candidate.questionValueScore,
    questionValueSemantics: candidate.questionValueSemantics,
    questionKind: candidate.questionKind,
    ordinaryQuestionEligible: candidate.ordinaryQuestionEligible,
    isHighValue: highValueHandClasses.has(candidate.handClass),
    boundaryLikelihood: candidate.boundaryLikelihood,
    evidenceDensity: candidate.evidenceDensity,
    exactMixRefinementBand: candidate.exactMixRefinementBand,
    priorityReasons: [...candidate.priorityReasons],
  };
}

function validateCandidateRanking(candidateRanking) {
  if (!Array.isArray(candidateRanking)) throw new TypeError('Matrix candidate ranking must be an array');
  const hands = candidateRanking.map((candidate) => candidate?.handClass);
  if (hands.some((handClass) => !PREFLOP_HAND_CLASSES.includes(handClass))) {
    throw new RangeError('Matrix candidate ranking contains a non-canonical hand class');
  }
  if (new Set(hands).size !== hands.length) {
    throw new RangeError('Matrix candidate ranking contains duplicate hand classes');
  }
  return candidateRanking;
}

export function createPersonalStrategyMatrixProjection({
  snapshot,
  evidenceView,
  transferProjection = null,
  candidateRanking = [],
  highValueQuestionCount = 0,
  profileReadiness = null,
} = {}) {
  validatePersonalStrategySnapshot(snapshot);
  validatePersonalStrategyEvidenceView(evidenceView);
  if (transferProjection !== null) validateRfiContextTransferProjection(transferProjection);
  validateCandidateRanking(candidateRanking);
  if (snapshot.scope.profileId !== evidenceView.scope.profileId
    || snapshot.scope.modeId !== evidenceView.scope.modeId
    || snapshot.scope.contextKey !== evidenceView.scope.contextKey
    || snapshot.evidenceRevision.fingerprint !== evidenceView.evidenceFingerprint) {
    throw new RangeError('Matrix snapshot and evidence view must describe one current scope revision');
  }
  if (!Number.isInteger(highValueQuestionCount) || highValueQuestionCount < 0) {
    throw new RangeError('Matrix high-value question count must be a non-negative integer');
  }
  if (transferProjection !== null
    && (transferProjection.scope.profileId !== snapshot.scope.profileId
      || transferProjection.scope.modeId !== snapshot.scope.modeId
      || transferProjection.scope.contextKey !== snapshot.scope.contextKey
      || transferProjection.targetEvidenceFingerprint !== snapshot.evidenceRevision.fingerprint)) {
    throw new RangeError('Matrix transfer projection must describe the current target scope revision');
  }

  const candidatesByHand = new Map(candidateRanking.map((candidate) => [candidate.handClass, candidate]));
  const transfersByHand = new Map((transferProjection?.estimates ?? [])
    .map((estimate) => [estimate.handClass, estimate]));
  const highValueHandClasses = new Set(profileReadiness?.nextClarificationPriorities
    ? profileReadiness.nextClarificationPriorities
      .filter((priority) => priority.questionKind === 'ordinary_observation')
      .map((priority) => priority.handClass)
    : candidateRanking
      .filter((candidate) => candidate.ordinaryQuestionEligible && candidate.recommendedClarification)
      .slice(0, highValueQuestionCount)
      .map((candidate) => candidate.handClass));
  const cells = snapshot.estimates.map((estimate, index) => {
    const transfer = transfersByHand.get(estimate.handClass) ?? null;
    const isTransferred = transfer?.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED;
    const status = isTransferred
      ? PERSONAL_STRATEGY_MATRIX_STATUSES.TRANSFERRED : estimate.status;
    const presentedEstimate = isTransferred ? {
      ...estimate,
      status,
      dominantAction: transfer.dominantAction,
      exactFrequencies: null,
    } : estimate;
    const precision = precisionFor(presentedEstimate);
    const evidence = evidenceForHand(evidenceView, estimate.handClass);
    const selectedNeighbors = estimate.support.selectedNeighbors.map((neighbor) => ({
      ...cloneData(neighbor),
      evidence: neighbor.sourceEvidenceIds
        .map((evidenceId) => evidenceView.directEvidence.find((entry) => entry.evidenceId === evidenceId))
        .filter(Boolean)
        .map(cloneData),
    }));
    const dominantType = presentedEstimate.dominantAction?.type ?? null;
    return {
      handClass: estimate.handClass,
      canonicalIndex: index,
      row: Math.floor(index / 13),
      column: index % 13,
      status,
      localStatus: estimate.status,
      statusMarker: PERSONAL_STRATEGY_MATRIX_STATUS_MARKERS[status],
      provenance: isTransferred ? 'transferred' : estimate.provenance,
      action: actionPresentation(presentedEstimate, precision),
      sourceEvidenceIds: [...(isTransferred ? transfer.sourceEvidenceIds : estimate.sourceEvidenceIds)],
      sourceEvidenceCount: isTransferred
        ? transfer.sourceEvidenceIds.length : estimate.sourceEvidenceIds.length,
      reasons: [...(isTransferred ? transfer.reasons : estimate.reasons)],
      uncertainty: isTransferred ? {
        semanticsVersion: 'rfi-context-transfer-band/v1',
        band: transfer.transferBand,
        algorithmVersion: transfer.modelVersion,
        validationCohortId: null,
        policyThresholdId: null,
        reasons: [...transfer.reasons],
      } : cloneData(estimate.uncertainty),
      support: {
        evidenceDensity: estimate.support.evidenceDensity,
        supportDirection: estimate.support.supportDirection,
        boundaryLikelihood: estimate.support.boundaryLikelihood,
        conflictProximity: estimate.support.conflictProximity,
        nearbyDisagreementCount: estimate.support.nearbyDisagreementCount,
        nearbyBoundaryCount: estimate.support.nearbyBoundaryCount,
        nearbyConflictCount: estimate.support.nearbyConflictCount,
        scopeLocalStability: cloneData(estimate.support.scopeLocalStability),
        regionalInterpolation: cloneData(estimate.support.regionalInterpolation),
        selectedNeighbors,
        supportingNeighbors: selectedNeighbors.filter((neighbor) => (
          dominantType !== null && neighbor.observedDominantAction?.type === dominantType
        )),
        opposingNeighbors: selectedNeighbors.filter((neighbor) => (
          dominantType !== null
          && neighbor.observedDominantAction?.type
          && neighbor.observedDominantAction.type !== dominantType
        )),
      },
      evidence,
      transfer: cloneData(transfer),
      question: questionForHand(candidatesByHand.get(estimate.handClass), highValueHandClasses),
      comboOverrides: cloneData(estimate.comboOverrides),
      hasComboOverrides: estimate.comboOverrides.length > 0,
    };
  });

  const projection = {
    schemaVersion: PERSONAL_STRATEGY_MATRIX_PROJECTION_SCHEMA_VERSION,
    scope: cloneData(snapshot.scope),
    actionUniverse: cloneData(snapshot.actionUniverse),
    evidenceRevision: cloneData(snapshot.evidenceRevision),
    derivation: {
      ...cloneData(snapshot.derivation),
      transferModelVersion: transferProjection?.modelVersion ?? null,
      matrixProjectionVersion: PERSONAL_STRATEGY_MATRIX_PROJECTION_SCHEMA_VERSION,
    },
    cells,
    summary: {
      ...cloneData(snapshot.summary),
      unknownCount: snapshot.summary.unknownCount
        - (transferProjection?.summary.transferredCount ?? 0),
      transferredCount: transferProjection?.summary.transferredCount ?? 0,
      transferUncertainCount: transferProjection?.summary.uncertainCount ?? 0,
    },
    localSummary: cloneData(snapshot.summary),
    profileReadiness: cloneData(profileReadiness),
    comboOverrideCount: snapshot.comboOverrides.length,
  };
  validatePersonalStrategyMatrixProjection(projection);
  return deepFreeze(projection);
}

export function validatePersonalStrategyMatrixProjection(projection) {
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    throw new TypeError('Personal Strategy Matrix projection is required');
  }
  if (projection.schemaVersion !== PERSONAL_STRATEGY_MATRIX_PROJECTION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_MATRIX_PROJECTION_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(projection.cells) || projection.cells.length !== PREFLOP_HAND_CLASSES.length) {
    throw new RangeError('Personal Strategy Matrix must contain exactly 169 cells');
  }
  projection.cells.forEach((cell, index) => {
    if (cell.handClass !== PREFLOP_HAND_CLASSES[index]
      || cell.canonicalIndex !== index
      || cell.row !== Math.floor(index / 13)
      || cell.column !== index % 13) {
      throw new RangeError('Personal Strategy Matrix cells must use canonical 13 by 13 ordering');
    }
    if (!Object.values(PERSONAL_STRATEGY_MATRIX_STATUSES).includes(cell.status)) {
      throw new RangeError('Personal Strategy Matrix cell status is unsupported');
    }
    if (Object.hasOwn(cell, 'weight') || Object.hasOwn(cell.action, 'weight')) {
      throw new RangeError('Personal Strategy Matrix action strategy cannot expose range weights');
    }
  });
  return projection;
}
