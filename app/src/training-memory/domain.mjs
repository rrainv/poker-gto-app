import { validatePokerState } from '../../../shared/poker-domain/index.js';
import {
  validateRiverlineOwnershipRef,
} from '../account-identity/domain.mjs';
import {
  reconstructCanonicalHandReplaySource,
  validateCanonicalHandReplaySource,
} from '../application/canonical-hand-replay-source.mjs';
import {
  STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
} from '../application/strategy-claim-policy.mjs';
import { isStrategyResultV1 } from '../application/strategy-result.mjs';

export const TRAINING_DECISION_RECORD_SCHEMA_VERSION = 'training-decision-record/v1';
export const TRAINING_SESSION_RECORD_SCHEMA_VERSION = 'training-session-record/v1';
export const TRAINING_STUDY_METADATA_SCHEMA_VERSION = 'training-study-metadata/v1';
export const TRAINING_REVIEW_STATE_SCHEMA_VERSION = 'training-review-state/v1';
export const TRAINING_SIMILARITY_SCHEMA_VERSION = 'training-similarity/v1';
export const TRAINING_GENERATOR_REPLAY_IDENTITY_SCHEMA_VERSION =
  'training-generator-replay-identity/v1';

export const TRAINING_SESSION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
});

export const TRAINING_DECISION_STATUSES = Object.freeze({
  SHOWN: 'shown',
  ANSWERED: 'answered',
});

export const TRAINING_COMPARISON_STATES = Object.freeze({
  MATCHES_REFERENCE: 'matches_reference',
  CLOSE_TO_REFERENCE: 'close_to_reference',
  DIFFERS_FROM_REFERENCE: 'differs_from_reference',
  UNSUPPORTED: 'unsupported',
  UNAVAILABLE: 'unavailable',
});

export const TRAINING_REVIEW_LIFECYCLE_STATES = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  SNOOZED: 'snoozed',
});

export const TRAINING_REVIEW_REASON_CODES = Object.freeze({
  DIFFERS_FROM_REFERENCE: 'differs_from_reference',
  CLOSE_TO_REFERENCE: 'close_to_reference',
  SOURCE_UNAVAILABLE: 'source_unavailable',
  MANUAL_REVIEW: 'manual_review',
  MANUAL_DIFFICULT: 'manual_difficult',
  MANUAL_IMPORTANT: 'manual_important',
  MANUAL_MY_MISTAKE: 'manual_my_mistake',
});

const SESSION_STATUS_VALUES = Object.freeze(Object.values(TRAINING_SESSION_STATUSES));
const DECISION_STATUS_VALUES = Object.freeze(Object.values(TRAINING_DECISION_STATUSES));
const COMPARISON_STATE_VALUES = Object.freeze(Object.values(TRAINING_COMPARISON_STATES));
const REVIEW_STATE_VALUES = Object.freeze(Object.values(TRAINING_REVIEW_LIFECYCLE_STATES));
const REVIEW_REASON_VALUES = Object.freeze(Object.values(TRAINING_REVIEW_REASON_CODES));
const ACTION_TYPES = new Set(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const MODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function cloneTrainingMemoryData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function deepFreezeTrainingMemoryData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreezeTrainingMemoryData);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((entry, index) => entry !== expected[index])) {
    throw new TypeError(`${label} contains unsupported or missing fields`);
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 300) {
    throw new TypeError(`${label} must be a non-empty opaque ID`);
  }
  return value;
}

function requireNullableId(value, label) {
  return value === null ? null : requireId(value, label);
}

function requireIsoTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp${nullable ? ' or null' : ''}`);
  }
  return value;
}

function requireMode(value, label = 'Training mode') {
  if (typeof value !== 'string' || !MODE_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a future-compatible lowercase discriminator`);
  }
  return value;
}

function requirePortableJson(value, label) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new TypeError(`${label} must be portable JSON: ${error.message}`);
  }
  if (serialized === undefined) throw new TypeError(`${label} must be portable JSON`);
  return value;
}

export function trainingMemoryOwnerKey(ownerRef) {
  validateRiverlineOwnershipRef(ownerRef);
  return `${ownerRef.ownerType}:${ownerRef.ownerId}`;
}

export function sameTrainingMemoryOwner(left, right) {
  return trainingMemoryOwnerKey(left) === trainingMemoryOwnerKey(right);
}

export function createTrainingStudyMetadata(input = {}) {
  const metadata = {
    schemaVersion: TRAINING_STUDY_METADATA_SCHEMA_VERSION,
    review: Boolean(input.review),
    difficult: Boolean(input.difficult),
    important: Boolean(input.important),
    myMistake: Boolean(input.myMistake),
  };
  validateTrainingStudyMetadata(metadata);
  return deepFreezeTrainingMemoryData(metadata);
}

export function validateTrainingStudyMetadata(metadata) {
  requireObject(metadata, 'TrainingStudyMetadata');
  requireExactKeys(
    metadata,
    ['schemaVersion', 'review', 'difficult', 'important', 'myMistake'],
    'TrainingStudyMetadata',
  );
  if (metadata.schemaVersion !== TRAINING_STUDY_METADATA_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_STUDY_METADATA_SCHEMA_VERSION}`);
  }
  for (const key of ['review', 'difficult', 'important', 'myMistake']) {
    if (typeof metadata[key] !== 'boolean') {
      throw new TypeError(`TrainingStudyMetadata.${key} must be boolean`);
    }
  }
  return metadata;
}

export function createTrainingReviewState({
  state = TRAINING_REVIEW_LIFECYCLE_STATES.NONE,
  dueAt = null,
  lastReviewedAt = null,
  reviewCount = 0,
} = {}) {
  const review = {
    schemaVersion: TRAINING_REVIEW_STATE_SCHEMA_VERSION,
    state,
    dueAt,
    lastReviewedAt,
    reviewCount,
  };
  validateTrainingReviewState(review);
  return deepFreezeTrainingMemoryData(review);
}

export function validateTrainingReviewState(review) {
  requireObject(review, 'TrainingReviewState');
  requireExactKeys(
    review,
    ['schemaVersion', 'state', 'dueAt', 'lastReviewedAt', 'reviewCount'],
    'TrainingReviewState',
  );
  if (review.schemaVersion !== TRAINING_REVIEW_STATE_SCHEMA_VERSION
    || !REVIEW_STATE_VALUES.includes(review.state)) {
    throw new TypeError('TrainingReviewState is incompatible');
  }
  requireIsoTimestamp(review.dueAt, 'TrainingReviewState.dueAt', { nullable: true });
  requireIsoTimestamp(
    review.lastReviewedAt,
    'TrainingReviewState.lastReviewedAt',
    { nullable: true },
  );
  if (!Number.isSafeInteger(review.reviewCount) || review.reviewCount < 0) {
    throw new RangeError('TrainingReviewState.reviewCount must be a non-negative safe integer');
  }
  if (review.state === TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED && review.dueAt === null) {
    throw new RangeError('A snoozed Training review requires dueAt');
  }
  return review;
}

function validateGeneratorReplayIdentity(identity) {
  requireObject(identity, 'Training generator replay identity');
  requireExactKeys(identity, [
    'schemaVersion', 'seed', 'generatorVersion', 'policyVersion', 'scenarioRequest',
  ], 'Training generator replay identity');
  if (identity.schemaVersion !== TRAINING_GENERATOR_REPLAY_IDENTITY_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_GENERATOR_REPLAY_IDENTITY_SCHEMA_VERSION}`);
  }
  if (!Number.isSafeInteger(identity.seed) || identity.seed < 0 || identity.seed > 0xffffffff) {
    throw new RangeError('Training replay seed must be uint32');
  }
  requireId(identity.generatorVersion, 'Training generator version');
  requireId(identity.policyVersion, 'Training generator policy version');
  if (identity.scenarioRequest !== null) {
    requirePortableJson(identity.scenarioRequest, 'Training scenario request');
  }
  return identity;
}

function validateDecisionSource(source) {
  requireObject(source, 'Training decision source');
  if (source.kind === 'generated_exercise') {
    requireExactKeys(source, [
      'kind', 'pokerState', 'heroPlayerId', 'replayIdentity', 'parentDecisionRecordId',
      'redrillKind',
    ], 'Generated Training decision source');
    validatePokerState(source.pokerState);
    requireId(source.heroPlayerId, 'Generated Training Hero player ID');
    validateGeneratorReplayIdentity(source.replayIdentity);
    requireNullableId(source.parentDecisionRecordId, 'Parent Training decision record ID');
    if (source.redrillKind !== null && !['same_spot', 'similar_spot'].includes(source.redrillKind)) {
      throw new RangeError('Unsupported Training re-drill kind');
    }
    return source;
  }
  if (source.kind === 'full_hand_replay_point') {
    requireExactKeys(source, [
      'kind', 'handId', 'heroPlayerId', 'replayPoint', 'handSeed',
      'parentDecisionRecordId', 'redrillKind',
    ], 'Full-Hand Training decision source');
    requireId(source.handId, 'Full-Hand Training hand ID');
    requireId(source.heroPlayerId, 'Full-Hand Training Hero player ID');
    requireObject(source.replayPoint, 'Full-Hand Training replay point');
    if (!Number.isSafeInteger(source.replayPoint.eventSequence)
      || source.replayPoint.eventSequence < 0) {
      throw new RangeError('Full-Hand Training replay event sequence is invalid');
    }
    if (!Number.isSafeInteger(source.handSeed) || source.handSeed < 0
      || source.handSeed > 0xffffffff) {
      throw new RangeError('Full-Hand Training hand seed must be uint32');
    }
    requireNullableId(source.parentDecisionRecordId, 'Parent Training decision record ID');
    if (source.redrillKind !== null && !['same_spot', 'similar_spot'].includes(source.redrillKind)) {
      throw new RangeError('Unsupported Training re-drill kind');
    }
    return source;
  }
  throw new RangeError(`Unsupported Training decision source kind: ${String(source.kind)}`);
}

function validateUserResponse(response, status) {
  if (response === null) {
    if (status === TRAINING_DECISION_STATUSES.ANSWERED) {
      throw new RangeError('An answered Training decision requires a user response');
    }
    return response;
  }
  requireObject(response, 'Training user response');
  requireExactKeys(response, ['kind', 'action', 'submission'], 'Training user response');
  if (response.kind !== 'action' || response.submission !== 'normal') {
    throw new RangeError('Training v1 supports only normally submitted action responses');
  }
  requireObject(response.action, 'Training user action');
  requireExactKeys(response.action, ['type', 'amountToMilliBb'], 'Training user action');
  if (!ACTION_TYPES.has(response.action.type)) throw new RangeError('Unsupported Training action');
  if (response.action.amountToMilliBb !== null
    && (!Number.isSafeInteger(response.action.amountToMilliBb)
      || response.action.amountToMilliBb < 0)) {
    throw new RangeError('Training action amount-to must be non-negative integer milliBB or null');
  }
  return response;
}

function validateStrategyEvidence(evidence, status) {
  if (evidence === null) {
    if (status === TRAINING_DECISION_STATUSES.ANSWERED) {
      throw new RangeError('An answered Training decision requires frozen strategy evidence');
    }
    return evidence;
  }
  requireObject(evidence, 'Training strategy evidence');
  requireExactKeys(
    evidence,
    ['strategyResult', 'claimPolicy', 'comparisonState', 'internalEvaluation'],
    'Training strategy evidence',
  );
  if (!isStrategyResultV1(evidence.strategyResult)) {
    throw new TypeError('Training strategy evidence requires StrategyResult v1');
  }
  if (evidence.claimPolicy?.schemaVersion !== STRATEGY_CLAIM_POLICY_SCHEMA_VERSION) {
    throw new TypeError('Training strategy evidence requires StrategyClaimPolicy v1');
  }
  if (!COMPARISON_STATE_VALUES.includes(evidence.comparisonState)) {
    throw new RangeError('Unsupported durable Training comparison state');
  }
  if (evidence.internalEvaluation !== null) {
    requirePortableJson(evidence.internalEvaluation, 'Training internal evaluation');
  }
  return evidence;
}

export function validateTrainingDecisionRecord(record) {
  requireObject(record, 'TrainingDecisionRecord');
  requireExactKeys(record, [
    'schemaVersion', 'id', 'ownerRef', 'sessionId', 'exerciseId', 'ordinal',
    'shownAt', 'answeredAt', 'status', 'mode', 'plannerIntentId', 'decisionSource',
    'decisionContext', 'legalActions', 'userResponse', 'strategyEvidence',
    'studyMetadata', 'reviewState', 'createdAt', 'updatedAt',
  ], 'TrainingDecisionRecord');
  if (record.schemaVersion !== TRAINING_DECISION_RECORD_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_DECISION_RECORD_SCHEMA_VERSION}`);
  }
  requireId(record.id, 'TrainingDecisionRecord.id');
  validateRiverlineOwnershipRef(record.ownerRef);
  requireId(record.sessionId, 'TrainingDecisionRecord.sessionId');
  requireId(record.exerciseId, 'TrainingDecisionRecord.exerciseId');
  if (!Number.isSafeInteger(record.ordinal) || record.ordinal < 0) {
    throw new RangeError('TrainingDecisionRecord.ordinal must be non-negative');
  }
  requireIsoTimestamp(record.shownAt, 'TrainingDecisionRecord.shownAt');
  requireIsoTimestamp(record.answeredAt, 'TrainingDecisionRecord.answeredAt', { nullable: true });
  if (!DECISION_STATUS_VALUES.includes(record.status)) {
    throw new RangeError('Unsupported Training decision status');
  }
  if ((record.status === TRAINING_DECISION_STATUSES.SHOWN) !== (record.answeredAt === null)) {
    throw new RangeError('Training decision status and answeredAt are inconsistent');
  }
  requireMode(record.mode);
  requireNullableId(record.plannerIntentId, 'TrainingDecisionRecord.plannerIntentId');
  validateDecisionSource(record.decisionSource);
  if (record.decisionContext?.schemaVersion !== 'decision-context/v1') {
    throw new TypeError('TrainingDecisionRecord requires DecisionContext v1');
  }
  requirePortableJson(record.legalActions, 'Training legal actions');
  validateUserResponse(record.userResponse, record.status);
  validateStrategyEvidence(record.strategyEvidence, record.status);
  validateTrainingStudyMetadata(record.studyMetadata);
  validateTrainingReviewState(record.reviewState);
  requireIsoTimestamp(record.createdAt, 'TrainingDecisionRecord.createdAt');
  requireIsoTimestamp(record.updatedAt, 'TrainingDecisionRecord.updatedAt');
  if (record.createdAt !== record.shownAt
    || Date.parse(record.updatedAt) < Date.parse(record.createdAt)
    || (record.answeredAt !== null && Date.parse(record.answeredAt) < Date.parse(record.shownAt))) {
    throw new RangeError('Training decision timestamps are inconsistent');
  }
  return record;
}

function validateSessionPlanner(planner) {
  if (planner === null) return planner;
  requireObject(planner, 'Training session planner');
  requireExactKeys(planner, ['intentId', 'intent'], 'Training session planner');
  requireId(planner.intentId, 'Training session planner intent ID');
  if (planner.intent?.schemaVersion !== 'training-session-intent/v1') {
    throw new TypeError('Training session planner requires TrainingSessionIntent v1');
  }
  return planner;
}

function validateFullHandSessionSource(source) {
  if (source === null) return source;
  requireObject(source, 'Full-Hand Training session source');
  requireExactKeys(source, ['handId', 'heroPlayerId', 'replaySource'], 'Full-Hand session source');
  requireId(source.handId, 'Full-Hand session hand ID');
  requireId(source.heroPlayerId, 'Full-Hand session Hero player ID');
  validateCanonicalHandReplaySource(source.replaySource);
  const reconstruction = reconstructCanonicalHandReplaySource(source.replaySource);
  if (reconstruction.finalState.handId !== source.handId
    || reconstruction.heroPlayerId !== source.heroPlayerId) {
    throw new RangeError('Full-Hand session replay source identity is inconsistent');
  }
  return source;
}

export function validateTrainingSessionRecord(record) {
  requireObject(record, 'TrainingSessionRecord');
  requireExactKeys(record, [
    'schemaVersion', 'id', 'ownerRef', 'mode', 'startedAt', 'endedAt', 'status',
    'requestedLength', 'sessionSeed', 'planner', 'focus', 'comparisonSelection',
    'decisionRecordIds', 'fullHandSource', 'createdAt', 'updatedAt',
  ], 'TrainingSessionRecord');
  if (record.schemaVersion !== TRAINING_SESSION_RECORD_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_SESSION_RECORD_SCHEMA_VERSION}`);
  }
  requireId(record.id, 'TrainingSessionRecord.id');
  validateRiverlineOwnershipRef(record.ownerRef);
  requireMode(record.mode);
  requireIsoTimestamp(record.startedAt, 'TrainingSessionRecord.startedAt');
  requireIsoTimestamp(record.endedAt, 'TrainingSessionRecord.endedAt', { nullable: true });
  if (!SESSION_STATUS_VALUES.includes(record.status)) {
    throw new RangeError('Unsupported Training session status');
  }
  if ((record.status === TRAINING_SESSION_STATUSES.ACTIVE) !== (record.endedAt === null)) {
    throw new RangeError('Training session status and endedAt are inconsistent');
  }
  if (record.requestedLength !== null
    && (!Number.isSafeInteger(record.requestedLength) || record.requestedLength < 1)) {
    throw new RangeError('Training requested length must be a positive safe integer or null');
  }
  if (record.sessionSeed !== null
    && (!Number.isSafeInteger(record.sessionSeed) || record.sessionSeed < 0
      || record.sessionSeed > 0xffffffff)) {
    throw new RangeError('Training session seed must be uint32 or null');
  }
  validateSessionPlanner(record.planner);
  if (record.focus !== null) requirePortableJson(record.focus, 'Training session focus');
  requireObject(record.comparisonSelection, 'Training comparison selection');
  requireExactKeys(
    record.comparisonSelection,
    ['kind', 'selectedSourceId'],
    'Training comparison selection',
  );
  if (record.comparisonSelection.kind !== 'provider_runtime') {
    throw new RangeError('Unsupported Training comparison selection');
  }
  requireNullableId(record.comparisonSelection.selectedSourceId, 'Selected source ID');
  if (!Array.isArray(record.decisionRecordIds)
    || record.decisionRecordIds.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(record.decisionRecordIds).size !== record.decisionRecordIds.length) {
    throw new TypeError('Training session decision IDs must be unique opaque IDs');
  }
  validateFullHandSessionSource(record.fullHandSource);
  requireIsoTimestamp(record.createdAt, 'TrainingSessionRecord.createdAt');
  requireIsoTimestamp(record.updatedAt, 'TrainingSessionRecord.updatedAt');
  if (record.createdAt !== record.startedAt
    || Date.parse(record.updatedAt) < Date.parse(record.createdAt)
    || (record.endedAt !== null && Date.parse(record.endedAt) < Date.parse(record.startedAt))) {
    throw new RangeError('Training session timestamps are inconsistent');
  }
  return record;
}

function gradeComparisonState(evaluation, claimPolicy) {
  if (claimPolicy?.availability !== 'available') {
    return claimPolicy?.coverage?.kind === 'unsupported'
      ? TRAINING_COMPARISON_STATES.UNSUPPORTED
      : TRAINING_COMPARISON_STATES.UNAVAILABLE;
  }
  if (!evaluation) return TRAINING_COMPARISON_STATES.UNAVAILABLE;
  if (evaluation.grade === 'optimal') return TRAINING_COMPARISON_STATES.MATCHES_REFERENCE;
  if (evaluation.grade === 'acceptable') return TRAINING_COMPARISON_STATES.CLOSE_TO_REFERENCE;
  return TRAINING_COMPARISON_STATES.DIFFERS_FROM_REFERENCE;
}

export function createTrainingStrategyEvidence({ strategyResult, claimPolicy, evaluation } = {}) {
  const evidence = {
    strategyResult: cloneTrainingMemoryData(strategyResult),
    claimPolicy: cloneTrainingMemoryData(claimPolicy),
    comparisonState: gradeComparisonState(evaluation, claimPolicy),
    internalEvaluation: evaluation === null ? null : cloneTrainingMemoryData(evaluation),
  };
  validateStrategyEvidence(evidence, TRAINING_DECISION_STATUSES.ANSWERED);
  return deepFreezeTrainingMemoryData(evidence);
}

export function reviewReasonsForDecision(record) {
  validateTrainingDecisionRecord(record);
  const reasons = [];
  const comparison = record.strategyEvidence?.comparisonState;
  if (comparison === TRAINING_COMPARISON_STATES.DIFFERS_FROM_REFERENCE) {
    reasons.push(TRAINING_REVIEW_REASON_CODES.DIFFERS_FROM_REFERENCE);
  } else if (comparison === TRAINING_COMPARISON_STATES.CLOSE_TO_REFERENCE) {
    reasons.push(TRAINING_REVIEW_REASON_CODES.CLOSE_TO_REFERENCE);
  } else if ([
    TRAINING_COMPARISON_STATES.UNSUPPORTED,
    TRAINING_COMPARISON_STATES.UNAVAILABLE,
  ].includes(comparison)) {
    reasons.push(TRAINING_REVIEW_REASON_CODES.SOURCE_UNAVAILABLE);
  }
  if (record.studyMetadata.review) reasons.push(TRAINING_REVIEW_REASON_CODES.MANUAL_REVIEW);
  if (record.studyMetadata.difficult) reasons.push(TRAINING_REVIEW_REASON_CODES.MANUAL_DIFFICULT);
  if (record.studyMetadata.important) reasons.push(TRAINING_REVIEW_REASON_CODES.MANUAL_IMPORTANT);
  if (record.studyMetadata.myMistake) reasons.push(TRAINING_REVIEW_REASON_CODES.MANUAL_MY_MISTAKE);
  return deepFreezeTrainingMemoryData([...new Set(reasons)]);
}

export function trainingReviewPriority(record, now = new Date()) {
  const reasons = reviewReasonsForDecision(record);
  const weights = {
    [TRAINING_REVIEW_REASON_CODES.MANUAL_REVIEW]: 50,
    [TRAINING_REVIEW_REASON_CODES.MANUAL_DIFFICULT]: 45,
    [TRAINING_REVIEW_REASON_CODES.MANUAL_IMPORTANT]: 40,
    [TRAINING_REVIEW_REASON_CODES.MANUAL_MY_MISTAKE]: 35,
    [TRAINING_REVIEW_REASON_CODES.DIFFERS_FROM_REFERENCE]: 30,
    [TRAINING_REVIEW_REASON_CODES.SOURCE_UNAVAILABLE]: 20,
    [TRAINING_REVIEW_REASON_CODES.CLOSE_TO_REFERENCE]: 10,
  };
  const ageDays = Math.max(0, Math.floor(
    (new Date(now).getTime() - Date.parse(record.shownAt)) / 86_400_000,
  ));
  return Math.max(0, reasons.reduce((sum, reason) => sum + weights[reason], 0)
    + Math.min(30, ageDays)
    - Math.min(30, record.reviewState.reviewCount * 5));
}

export function deriveTrainingReviewItem(record, { now = new Date() } = {}) {
  const reasons = reviewReasonsForDecision(record);
  const nowTime = new Date(now).getTime();
  const due = record.reviewState.state === TRAINING_REVIEW_LIFECYCLE_STATES.PENDING
    || (record.reviewState.state === TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED
      && Date.parse(record.reviewState.dueAt) <= nowTime);
  return deepFreezeTrainingMemoryData({
    schemaVersion: 'training-review-item/v1',
    recordId: record.id,
    sessionId: record.sessionId,
    due,
    lifecycleState: record.reviewState.state,
    dueAt: record.reviewState.dueAt,
    priority: trainingReviewPriority(record, now),
    reasons,
    record,
  });
}

export function deriveTrainingSessionSummary(decisionRecords) {
  if (!Array.isArray(decisionRecords)) throw new TypeError('Decision records must be an array');
  const ordered = [...decisionRecords].sort((left, right) => left.ordinal - right.ordinal);
  ordered.forEach(validateTrainingDecisionRecord);
  const comparisonCounts = Object.fromEntries(COMPARISON_STATE_VALUES.map((value) => [value, 0]));
  const sourceIds = new Set();
  let answeredCount = 0;
  let reviewCount = 0;
  for (const record of ordered) {
    if (record.status === TRAINING_DECISION_STATUSES.ANSWERED) answeredCount += 1;
    if (record.strategyEvidence) {
      comparisonCounts[record.strategyEvidence.comparisonState] += 1;
      const result = record.strategyEvidence.strategyResult;
      sourceIds.add(`${result.source}@${result.sourceVersion}`);
    }
    if (reviewReasonsForDecision(record).length > 0) reviewCount += 1;
  }
  return deepFreezeTrainingMemoryData({
    schemaVersion: 'training-session-summary/v1',
    shownCount: ordered.length,
    answeredCount,
    comparisonCounts,
    sourceIds: [...sourceIds].sort(),
    reviewCount,
  });
}

function stackBucketForDecision(context) {
  const stack = Number.isFinite(context.effectiveStackBb)
    ? context.effectiveStackBb
    : Number.isFinite(context.startingStackBb)
      ? context.startingStackBb
      : context.stackBb;
  if (!Number.isFinite(stack)) return null;
  if (stack <= 20) return 'short';
  if (stack <= 40) return 'shallow';
  if (stack <= 80) return 'medium';
  if (stack <= 150) return 'standard';
  if (stack <= 300) return 'deep';
  return 'extended_deep';
}

function targetDecisionTypeFor(record) {
  const metadata = record.decisionSource.kind === 'generated_exercise'
    ? record.decisionSource.replayIdentity.scenarioRequest
    : null;
  if (metadata?.targetDecisionType) return metadata.targetDecisionType;
  const context = record.decisionContext;
  const facing = context.priorActionSummary?.facingActionFamily;
  if (context.street === 'preflop') {
    if (context.heroPosition === 'BB' && context.lastAction === 'limp') return 'preflop_bb_option';
    if (facing === 'raise') {
      const aggression = context.priorActionSummary?.aggressionFamily;
      if (aggression === 'three_bet') return 'preflop_facing_3bet';
      if (aggression === 'four_bet_or_more') return 'preflop_facing_4bet';
      return 'preflop_facing_open';
    }
    if (facing === 'none' || facing === 'check') return 'preflop_unopened';
    return null;
  }
  if (facing === 'bet') return 'postflop_facing_bet';
  if (facing === 'raise') return 'postflop_facing_raise';
  if (facing === 'none' || facing === 'check') return 'postflop_first_action';
  return null;
}

export function deriveTrainingSimilarity(record) {
  validateTrainingDecisionRecord(record);
  const context = record.decisionContext;
  const strategy = record.strategyEvidence?.strategyResult ?? null;
  const targetDecisionType = targetDecisionTypeFor(record);
  const exactRole = strategy?.details?.decisionRole ?? null;
  const rulesFingerprint = context.gameRules?.semanticFingerprint
    ?? record.decisionSource.pokerState?.rulesSnapshot?.semanticFingerprint
    ?? null;
  const dimensions = [
    { dimension: 'game_rules', value: rulesFingerprint, quality: rulesFingerprint ? 'exact' : 'unavailable' },
    { dimension: 'decision_role', value: exactRole, quality: exactRole && exactRole !== 'unknown' ? 'exact' : 'unavailable' },
    { dimension: 'street', value: context.street, quality: 'exact' },
    { dimension: 'position_relation', value: context.positionRelation ?? 'unknown', quality: context.positionRelation && context.positionRelation !== 'unknown' ? 'exact' : 'unavailable' },
    { dimension: 'prior_action_family', value: context.priorActionSummary?.facingActionFamily ?? null, quality: context.priorActionSummary?.facingActionFamily ? 'exact' : 'unavailable' },
    { dimension: 'effective_stack_bucket', value: stackBucketForDecision(context), quality: stackBucketForDecision(context) ? 'derived' : 'unavailable' },
    { dimension: 'price_family', value: record.decisionSource.replayIdentity?.scenarioRequest?.requestedSizingFamily ?? null, quality: record.decisionSource.replayIdentity?.scenarioRequest?.requestedSizingFamily ? 'exact' : 'unavailable' },
    { dimension: 'source_coverage', value: record.strategyEvidence?.claimPolicy?.coverage?.kind ?? null, quality: record.strategyEvidence ? 'historical_snapshot' : 'unavailable' },
  ];
  const available = Boolean(
    rulesFingerprint
    && targetDecisionType
    && Number.isSafeInteger(context.tableSize)
    && typeof context.heroPosition === 'string'
    && typeof context.street === 'string'
    && Number.isFinite(context.startingStackBb ?? context.stackBb),
  );
  return deepFreezeTrainingMemoryData({
    schemaVersion: TRAINING_SIMILARITY_SCHEMA_VERSION,
    policyVersion: 'training-similarity-policy/v1',
    sourceDecisionRecordId: record.id,
    available,
    unavailableReason: available ? null : 'insufficient_canonical_dimensions',
    targetDecisionType,
    generationConstraints: available ? {
      tableSize: context.tableSize,
      heroPosition: context.heroPosition,
      startingStackBb: context.startingStackBb ?? context.stackBb,
      street: context.street,
      requestedSizingFamily: record.decisionSource.replayIdentity
        ?.scenarioRequest?.requestedSizingFamily ?? null,
      rulesSemanticFingerprint: rulesFingerprint,
    } : null,
    dimensions,
  });
}

export function updateTrainingStudyMetadata(record, changes, updatedAt) {
  validateTrainingDecisionRecord(record);
  const metadata = createTrainingStudyMetadata({ ...record.studyMetadata, ...changes });
  const next = cloneTrainingMemoryData(record);
  next.studyMetadata = cloneTrainingMemoryData(metadata);
  next.updatedAt = requireIsoTimestamp(updatedAt, 'Training study metadata updatedAt');
  const reasonsBefore = reviewReasonsForDecision(record);
  const provisional = deepFreezeTrainingMemoryData(next);
  const reasonsAfter = reviewReasonsForDecision(provisional);
  if (reasonsAfter.length > 0
    && (record.reviewState.state === TRAINING_REVIEW_LIFECYCLE_STATES.NONE
      || (record.reviewState.state === TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED
        && reasonsBefore.length === 0))) {
    next.reviewState = cloneTrainingMemoryData(createTrainingReviewState({
      state: TRAINING_REVIEW_LIFECYCLE_STATES.PENDING,
    }));
  } else if (reasonsAfter.length === 0) {
    next.reviewState = cloneTrainingMemoryData(createTrainingReviewState({
      state: TRAINING_REVIEW_LIFECYCLE_STATES.NONE,
      lastReviewedAt: record.reviewState.lastReviewedAt,
      reviewCount: record.reviewState.reviewCount,
    }));
  }
  validateTrainingDecisionRecord(next);
  return deepFreezeTrainingMemoryData(next);
}

export function transitionTrainingReview(record, { state, dueAt = null, at } = {}) {
  validateTrainingDecisionRecord(record);
  if (![TRAINING_REVIEW_LIFECYCLE_STATES.PENDING,
    TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED,
    TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED].includes(state)) {
    throw new RangeError('Review lifecycle transition must be pending, reviewed, or snoozed');
  }
  const timestamp = requireIsoTimestamp(at, 'Training review transition timestamp');
  const next = cloneTrainingMemoryData(record);
  next.reviewState = cloneTrainingMemoryData(createTrainingReviewState({
    state,
    dueAt: state === TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED
      ? requireIsoTimestamp(dueAt, 'Training snooze dueAt')
      : null,
    lastReviewedAt: state === TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED
      ? timestamp
      : record.reviewState.lastReviewedAt,
    reviewCount: state === TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED
      ? record.reviewState.reviewCount + 1
      : record.reviewState.reviewCount,
  }));
  next.updatedAt = timestamp;
  validateTrainingDecisionRecord(next);
  return deepFreezeTrainingMemoryData(next);
}
