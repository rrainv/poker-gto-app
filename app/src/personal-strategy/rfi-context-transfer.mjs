import {
  ACTION_TYPES,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
} from '../../../shared/poker-domain/index.js';
import {
  CALIBRATION_CONTEXT_SCHEMA_VERSION,
  CALIBRATION_DECISION_FAMILIES,
  calibrationContextKey,
  calibrationContextsEquivalent,
  validateCalibrationContext,
} from './domain.mjs';
import { getPersonalStrategyActionSetForContext } from './action-contract.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  validatePersonalStrategySnapshot,
} from './rfi-inference.mjs';

export const RFI_CONTEXT_TRANSFER_RELATIONSHIP_SCHEMA_VERSION =
  'personal-strategy-rfi-transfer-relationship/v1';
export const RFI_CONTEXT_TRANSFER_ESTIMATE_SCHEMA_VERSION =
  'personal-strategy-rfi-transfer-estimate/v2';
export const RFI_CONTEXT_TRANSFER_PROJECTION_SCHEMA_VERSION =
  'personal-strategy-rfi-transfer-projection/v2';
export const RFI_CONTEXT_TRANSFER_MODEL_VERSION = 'bounded-rfi-context-transfer/v2';

export const MAX_RFI_TRANSFER_DONOR_CONTEXTS = 4;
export const MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND = 3;

export const RFI_CONTEXT_TRANSFER_BANDS = Object.freeze({
  STRONG: 'strong',
  MODERATE: 'moderate',
  WEAK: 'weak',
  NONE: 'none',
});

export const RFI_CONTEXT_TRANSFER_ESTIMATE_STATES = Object.freeze({
  LOCAL_PRECEDENCE: 'local_precedence',
  TRANSFERRED: 'transferred',
  UNCERTAIN: 'uncertain',
  UNAVAILABLE: 'unavailable',
});

export const RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES = Object.freeze({
  CONSISTENT: 'consistent',
  CONFLICTING: 'conflicting',
  UNAVAILABLE: 'unavailable',
});

export const RFI_CONTEXT_TRANSFER_REJECTION_REASONS = Object.freeze({
  SAME_CONTEXT: 'same_context_uses_local_inference',
  PROFILE_MISMATCH: 'profile_mismatch',
  MODE_MISMATCH: 'mode_mismatch',
  DECISION_FAMILY_MISMATCH: 'decision_family_mismatch',
  UNSUPPORTED_DECISION_FAMILY: 'unsupported_decision_family',
  ACTION_SET_INCOMPATIBLE: 'action_set_incompatible',
  GAME_VARIANT_INCOMPATIBLE: 'game_variant_incompatible',
  GAME_RULES_INCOMPATIBLE: 'game_rules_incompatible',
  STACK_BASIS_INCOMPATIBLE: 'stack_basis_incompatible',
  STACK_DISTANCE_TOO_LARGE: 'stack_distance_too_large',
  TABLE_SIZE_DISTANCE_TOO_LARGE: 'table_size_distance_too_large',
  HEADS_UP_BOUNDARY: 'heads_up_boundary',
  POSITION_ROLE_INCOMPATIBLE: 'position_role_incompatible',
  OPPONENT_COUNT_INCOMPATIBLE: 'opponent_count_incompatible',
  RELATIONSHIP_TOO_WEAK: 'relationship_too_weak',
});

export const RFI_CONTEXT_TRANSFER_REASON_CODES = Object.freeze({
  SAME_PROFILE: 'same_profile',
  SAME_MODE: 'same_mode',
  COMPATIBLE_RFI_ACTION_SET: 'compatible_fold_raise_rfi_action_set',
  COMPATIBLE_GAME_RULES: 'mathematically_compatible_game_rules',
  SAME_POSITION: 'same_named_position',
  ADJACENT_POSITION: 'adjacent_preflop_position',
  COMPARABLE_RELATIVE_POSITION: 'comparable_relative_preflop_position',
  SAME_TABLE_SIZE: 'same_table_size',
  NEARBY_TABLE_SIZE: 'nearby_table_size',
  NEARBY_STACK: 'nearby_stack_depth',
  ADJACENT_STACK: 'adjacent_stack_depth',
  DIRECT_DONOR: 'direct_donor_evidence',
  MULTIPLE_AGREEING_DONORS: 'multiple_agreeing_donor_contexts',
  DONOR_DISAGREEMENT: 'contradictory_donor_contexts',
  DONOR_CONFLICT: 'conflicting_donor_evidence',
  DONOR_TIED_EXACT_MIX: 'tied_exact_donor_has_no_dominant_action',
  EXACT_SOURCE_DOWNGRADED: 'exact_donor_preserved_but_target_transfer_is_qualitative',
  NO_DIRECT_DONOR: 'no_compatible_direct_donor_for_hand',
  TARGET_LOCAL_PRECEDENCE: 'target_local_evidence_or_inference_precedence',
});

const BAND_VALUES = new Set(Object.values(RFI_CONTEXT_TRANSFER_BANDS));
const ESTIMATE_STATE_VALUES = new Set(Object.values(RFI_CONTEXT_TRANSFER_ESTIMATE_STATES));
const DONOR_SIGNAL_STATE_VALUES = new Set(Object.values(RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES));
const FOLD_RAISE = Object.freeze([ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
const LOCAL_PRECEDENCE_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING,
]);

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
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

function actionTypes(context) {
  return getPersonalStrategyActionSetForContext(context).legalActions.map((entry) => entry.type);
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function contextStack(context) {
  return context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION
    ? { valueBb: context.effectiveStackBb, basis: 'legacy_calibration_effective' }
    : context.stack;
}

function contextRules(context) {
  if (context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION) {
    return {
      gameVariant: context.gameVariant,
      identity: { kind: 'legacy_opaque_id', value: context.gameRulesId },
      ante: { type: context.accounting.anteType, amountBb: context.accounting.anteBb },
      collection: {
        type: 'legacy_accounting',
        amountPerPlayerBb: context.accounting.forcedContributionPerPlayerBb,
        rakeMode: context.accounting.rakeMode,
      },
    };
  }
  return {
    gameVariant: context.gameVariant,
    identity: cloneData(context.gameRules.identity),
    ante: cloneData(context.gameRules.ante),
    collection: cloneData(context.gameRules.collection),
  };
}

function stackBucket(valueBb) {
  if (valueBb <= 20) return 'short_20bb_or_less';
  if (valueBb <= 50) return 'medium_21_to_50bb';
  if (valueBb <= 120) return 'standard_51_to_120bb';
  return 'deep_over_120bb';
}

function stackFacts(donorContext, targetContext) {
  const donor = contextStack(donorContext);
  const target = contextStack(targetContext);
  const ratio = Math.max(donor.valueBb, target.valueBb) / Math.min(donor.valueBb, target.valueBb);
  const donorBucket = stackBucket(donor.valueBb);
  const targetBucket = stackBucket(target.valueBb);
  let relation = 'materially_different';
  if (ratio <= 1.1) relation = 'near';
  else if (ratio <= 1.25) relation = 'nearby';
  else if (ratio <= 1.5 && donorBucket === targetBucket) relation = 'adjacent';
  return {
    donorValueBb: donor.valueBb,
    targetValueBb: target.valueBb,
    donorBasis: donor.basis,
    targetBasis: target.basis,
    donorBucket,
    targetBucket,
    ratio: Number(ratio.toFixed(12)),
    differenceBb: Number(Math.abs(donor.valueBb - target.valueBb).toFixed(12)),
    relation,
  };
}

function positionFacts(context) {
  const vocabulary = POSITIONS_BY_TABLE_SIZE[context.tableSize];
  const nonBlind = vocabulary.filter((position) => !['SB', 'BB'].includes(position));
  const position = context.heroPosition;
  const blindRole = position === 'SB' ? 'small_blind' : position === 'BB' ? 'big_blind' : null;
  const index = nonBlind.indexOf(position);
  return {
    position,
    role: blindRole ?? (position === 'BTN' ? 'button' : 'field'),
    orderIndex: vocabulary.indexOf(position),
    distanceToButton: index < 0 ? null : nonBlind.length - 1 - index,
  };
}

function positionRelationship(donorContext, targetContext) {
  const donor = positionFacts(donorContext);
  const target = positionFacts(targetContext);
  const namedSame = donor.position === target.position;
  const blindInvolved = donor.role.endsWith('blind') || target.role.endsWith('blind');
  const relativeDistance = donor.distanceToButton === null || target.distanceToButton === null
    ? null
    : Math.abs(donor.distanceToButton - target.distanceToButton);
  let relation = 'incompatible';
  if (namedSame) relation = 'same_named_position';
  else if (!blindInvolved && donorContext.tableSize === targetContext.tableSize
    && relativeDistance === 1) relation = 'adjacent_position';
  else if (!blindInvolved && Math.abs(donorContext.tableSize - targetContext.tableSize) === 1
    && relativeDistance === 0) relation = 'comparable_relative_position';
  return {
    donorPosition: donor.position,
    targetPosition: target.position,
    donorRole: donor.role,
    targetRole: target.role,
    donorDistanceToButton: donor.distanceToButton,
    targetDistanceToButton: target.distanceToButton,
    relativeDistance,
    relation,
  };
}

function opponentFacts(donorContext, targetContext) {
  const donorCount = donorContext.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION
    ? null : donorContext.opponentCount;
  const targetCount = targetContext.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION
    ? null : targetContext.opponentCount;
  return {
    donorCount,
    targetCount,
    difference: donorCount === null || targetCount === null
      ? null : Math.abs(donorCount - targetCount),
    relation: donorCount === null || targetCount === null
      ? 'unknown_legacy'
      : donorCount === targetCount ? 'same' : 'nearby',
  };
}

function relationshipBand(strength) {
  if (strength >= 85) return RFI_CONTEXT_TRANSFER_BANDS.STRONG;
  if (strength >= 65) return RFI_CONTEXT_TRANSFER_BANDS.MODERATE;
  if (strength > 0) return RFI_CONTEXT_TRANSFER_BANDS.WEAK;
  return RFI_CONTEXT_TRANSFER_BANDS.NONE;
}

function relationshipResult({ donorScope, targetScope, dimensions, strength, reasons, rejectionReason }) {
  const relationship = {
    schemaVersion: RFI_CONTEXT_TRANSFER_RELATIONSHIP_SCHEMA_VERSION,
    modelVersion: RFI_CONTEXT_TRANSFER_MODEL_VERSION,
    donorScope: {
      profileId: donorScope.profileId,
      modeId: donorScope.modeId,
      contextKey: calibrationContextKey(donorScope.context),
    },
    targetScope: {
      profileId: targetScope.profileId,
      modeId: targetScope.modeId,
      contextKey: calibrationContextKey(targetScope.context),
    },
    eligible: rejectionReason === null,
    transferStrength: strength,
    transferBand: relationshipBand(strength),
    dimensions,
    reasons: [...new Set(reasons)],
    rejectionReason,
  };
  validateRfiContextTransferRelationship(relationship);
  return deepFreeze(relationship);
}

export function createRfiContextTransferRelationship(donorScope, targetScope) {
  requireObject(donorScope, 'RFI transfer donor scope');
  requireObject(targetScope, 'RFI transfer target scope');
  requireString(donorScope.profileId, 'RFI transfer donor profileId');
  requireString(donorScope.modeId, 'RFI transfer donor modeId');
  requireString(targetScope.profileId, 'RFI transfer target profileId');
  requireString(targetScope.modeId, 'RFI transfer target modeId');
  validateCalibrationContext(donorScope.context);
  validateCalibrationContext(targetScope.context);

  const donorActions = actionTypes(donorScope.context);
  const targetActions = actionTypes(targetScope.context);
  const donorRules = contextRules(donorScope.context);
  const targetRules = contextRules(targetScope.context);
  const tableDistance = Math.abs(donorScope.context.tableSize - targetScope.context.tableSize);
  const position = positionRelationship(donorScope.context, targetScope.context);
  const stack = stackFacts(donorScope.context, targetScope.context);
  const opponents = opponentFacts(donorScope.context, targetScope.context);
  const dimensions = {
    profile: donorScope.profileId === targetScope.profileId ? 'same' : 'different',
    mode: donorScope.modeId === targetScope.modeId ? 'same' : 'different',
    decisionFamily: {
      donor: donorScope.context.decisionFamily,
      target: targetScope.context.decisionFamily,
      compatible: donorScope.context.decisionFamily === targetScope.context.decisionFamily,
    },
    actionSet: {
      donor: donorActions,
      target: targetActions,
      compatible: sameStrings(donorActions, targetActions),
    },
    gameRules: {
      donor: donorRules,
      target: targetRules,
      compatible: stableStringify(donorRules) === stableStringify(targetRules),
    },
    table: {
      donorSize: donorScope.context.tableSize,
      targetSize: targetScope.context.tableSize,
      distance: tableDistance,
      relation: tableDistance === 0 ? 'same' : tableDistance === 1 ? 'nearby' : 'distant',
    },
    position,
    stack,
    opponents,
  };
  const hardReject = (rejectionReason, strength = 0, reasons = []) => relationshipResult({
    donorScope, targetScope, dimensions, strength, reasons, rejectionReason,
  });

  if (donorScope.profileId !== targetScope.profileId) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.PROFILE_MISMATCH);
  }
  if (donorScope.modeId !== targetScope.modeId) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.MODE_MISMATCH);
  }
  if (calibrationContextsEquivalent(donorScope.context, targetScope.context)) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.SAME_CONTEXT);
  }
  if (donorScope.context.decisionFamily !== targetScope.context.decisionFamily) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.DECISION_FAMILY_MISMATCH);
  }
  if (donorScope.context.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.UNSUPPORTED_DECISION_FAMILY);
  }
  if (!sameStrings(donorActions, FOLD_RAISE) || !sameStrings(targetActions, FOLD_RAISE)) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.ACTION_SET_INCOMPATIBLE);
  }
  if (donorScope.context.gameVariant !== targetScope.context.gameVariant) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.GAME_VARIANT_INCOMPATIBLE);
  }
  if (!dimensions.gameRules.compatible) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.GAME_RULES_INCOMPATIBLE);
  }
  if (stack.donorBasis !== stack.targetBasis) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.STACK_BASIS_INCOMPATIBLE);
  }
  if (tableDistance > 1) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.TABLE_SIZE_DISTANCE_TOO_LARGE, 35);
  }
  if ((donorScope.context.tableSize === 2) !== (targetScope.context.tableSize === 2)) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.HEADS_UP_BOUNDARY, 35);
  }
  if (position.relation === 'incompatible') {
    const weakStrength = position.relativeDistance === null
      ? 25 : Math.max(10, 55 - position.relativeDistance * 15);
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.POSITION_ROLE_INCOMPATIBLE, weakStrength);
  }
  if (stack.relation === 'materially_different') {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.STACK_DISTANCE_TOO_LARGE, 45);
  }
  if (opponents.difference !== null && opponents.difference > 2) {
    return hardReject(RFI_CONTEXT_TRANSFER_REJECTION_REASONS.OPPONENT_COUNT_INCOMPATIBLE, 45);
  }

  let strength = 100;
  const reasons = [
    RFI_CONTEXT_TRANSFER_REASON_CODES.SAME_PROFILE,
    RFI_CONTEXT_TRANSFER_REASON_CODES.SAME_MODE,
    RFI_CONTEXT_TRANSFER_REASON_CODES.COMPATIBLE_RFI_ACTION_SET,
    RFI_CONTEXT_TRANSFER_REASON_CODES.COMPATIBLE_GAME_RULES,
  ];
  if (tableDistance === 0) reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.SAME_TABLE_SIZE);
  else {
    strength -= 15;
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.NEARBY_TABLE_SIZE);
  }
  if (position.relation === 'same_named_position') {
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.SAME_POSITION);
  } else if (position.relation === 'adjacent_position') {
    strength -= 25;
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.ADJACENT_POSITION);
  } else {
    strength -= 20;
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.COMPARABLE_RELATIVE_POSITION);
  }
  if (stack.relation === 'near') reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.NEARBY_STACK);
  else if (stack.relation === 'nearby') {
    strength -= 10;
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.NEARBY_STACK);
  } else {
    strength -= 20;
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.ADJACENT_STACK);
  }
  if (opponents.difference !== null) strength -= opponents.difference * 3;
  strength = Math.max(0, strength);
  const rejectionReason = relationshipBand(strength) === RFI_CONTEXT_TRANSFER_BANDS.WEAK
    ? RFI_CONTEXT_TRANSFER_REJECTION_REASONS.RELATIONSHIP_TOO_WEAK : null;
  return relationshipResult({ donorScope, targetScope, dimensions, strength, reasons, rejectionReason });
}

export function validateRfiContextTransferRelationship(relationship) {
  requireObject(relationship, 'RFI context transfer relationship');
  if (relationship.schemaVersion !== RFI_CONTEXT_TRANSFER_RELATIONSHIP_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_CONTEXT_TRANSFER_RELATIONSHIP_SCHEMA_VERSION}`);
  }
  if (relationship.modelVersion !== RFI_CONTEXT_TRANSFER_MODEL_VERSION) {
    throw new RangeError('Unsupported RFI context transfer relationship model');
  }
  requireObject(relationship.donorScope, 'RFI transfer relationship donorScope');
  requireObject(relationship.targetScope, 'RFI transfer relationship targetScope');
  requireObject(relationship.dimensions, 'RFI transfer relationship dimensions');
  if (typeof relationship.eligible !== 'boolean') throw new TypeError('RFI transfer eligibility must be boolean');
  if (!Number.isInteger(relationship.transferStrength)
    || relationship.transferStrength < 0 || relationship.transferStrength > 100) {
    throw new RangeError('RFI transfer strength must be an integer from 0 through 100');
  }
  if (!BAND_VALUES.has(relationship.transferBand)) throw new RangeError('Unsupported RFI transfer band');
  if (!Array.isArray(relationship.reasons)) throw new TypeError('RFI transfer reasons must be an array');
  if (relationship.eligible !== (relationship.rejectionReason === null)) {
    throw new RangeError('RFI transfer eligibility and rejection reason disagree');
  }
  return relationship;
}

function sourcePrecision(estimate) {
  if (estimate.exactFrequencies === null) return 'dominant_only';
  return estimate.dominantAction === null ? 'tied_exact_mix' : 'exact_mix';
}

function donorContribution(donor, estimate) {
  return {
    donorContextKey: donor.relationship.donorScope.contextKey,
    relationshipStrength: donor.relationship.transferStrength,
    relationshipBand: donor.relationship.transferBand,
    relationshipReasons: [...donor.relationship.reasons],
    sourceStatus: estimate.status,
    sourcePrecision: sourcePrecision(estimate),
    sourceDominantAction: cloneData(estimate.dominantAction),
    sourceExactFrequencies: cloneData(estimate.exactFrequencies),
    sourceEvidenceIds: [...estimate.sourceEvidenceIds],
  };
}

function estimateFor(targetEstimate, options) {
  const estimate = {
    schemaVersion: RFI_CONTEXT_TRANSFER_ESTIMATE_SCHEMA_VERSION,
    modelVersion: RFI_CONTEXT_TRANSFER_MODEL_VERSION,
    profileId: targetEstimate.profileId,
    modeId: targetEstimate.modeId,
    contextKey: targetEstimate.contextKey,
    handClass: targetEstimate.handClass,
    localStatus: targetEstimate.status,
    ...options,
  };
  validateRfiContextTransferEstimate(estimate);
  return deepFreeze(estimate);
}

function donorSignalForHand(targetEstimate, donors) {
  const relevant = donors.map((donor) => ({
    donor,
    estimate: donor.snapshot.estimates.find((entry) => entry.handClass === targetEstimate.handClass),
  })).filter(({ estimate }) => estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN
    || estimate.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING)
    .sort((left, right) => (
      right.donor.relationship.transferStrength - left.donor.relationship.transferStrength
      || left.donor.relationship.donorScope.contextKey.localeCompare(
        right.donor.relationship.donorScope.contextKey,
        'en',
      )
    )).slice(0, MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND);

  if (relevant.length === 0) {
    return deepFreeze({
      state: RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.UNAVAILABLE,
      transferBand: RFI_CONTEXT_TRANSFER_BANDS.NONE,
      dominantAction: null,
      sourceEvidenceIds: [],
      donorContributions: [],
      relationshipStrengthByAction: { fold: 0, raise: 0 },
      reasons: [RFI_CONTEXT_TRANSFER_REASON_CODES.NO_DIRECT_DONOR],
    });
  }

  const contributions = relevant.map(({ donor, estimate }) => donorContribution(donor, estimate));
  const reasons = [RFI_CONTEXT_TRANSFER_REASON_CODES.DIRECT_DONOR];
  const byAction = { fold: 0, raise: 0 };
  let blocked = false;
  contributions.forEach((contribution) => {
    if (contribution.sourceStatus === PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING) {
      reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.DONOR_CONFLICT);
      blocked = true;
      return;
    }
    if (contribution.sourcePrecision === 'tied_exact_mix') {
      reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.DONOR_TIED_EXACT_MIX);
      blocked = true;
      return;
    }
    if (contribution.sourcePrecision === 'exact_mix') {
      reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.EXACT_SOURCE_DOWNGRADED);
    }
    const action = contribution.sourceDominantAction?.type;
    if (action === ACTION_TYPES.FOLD || action === ACTION_TYPES.RAISE) {
      byAction[action] += contribution.relationshipStrength;
    }
  });
  if (byAction.fold > 0 && byAction.raise > 0) {
    reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.DONOR_DISAGREEMENT);
    blocked = true;
  }
  const sourceEvidenceIds = [...new Set(contributions.flatMap((entry) => entry.sourceEvidenceIds))].sort();
  if (blocked) {
    return deepFreeze({
      state: RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONFLICTING,
      transferBand: contributions[0]?.relationshipBand ?? RFI_CONTEXT_TRANSFER_BANDS.NONE,
      dominantAction: null,
      sourceEvidenceIds,
      donorContributions: contributions,
      relationshipStrengthByAction: byAction,
      reasons: [...new Set(reasons)],
    });
  }
  const action = byAction.raise > 0 ? ACTION_TYPES.RAISE : byAction.fold > 0 ? ACTION_TYPES.FOLD : null;
  if (action === null) {
    return deepFreeze({
      state: RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.UNAVAILABLE,
      transferBand: RFI_CONTEXT_TRANSFER_BANDS.NONE,
      dominantAction: null,
      sourceEvidenceIds,
      donorContributions: contributions,
      relationshipStrengthByAction: byAction,
      reasons: [...new Set([...reasons, RFI_CONTEXT_TRANSFER_REASON_CODES.NO_DIRECT_DONOR])],
    });
  }
  if (contributions.length > 1) reasons.push(RFI_CONTEXT_TRANSFER_REASON_CODES.MULTIPLE_AGREEING_DONORS);
  return deepFreeze({
    state: RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONSISTENT,
    transferBand: contributions[0].relationshipBand,
    dominantAction: { type: action },
    sourceEvidenceIds,
    donorContributions: contributions,
    relationshipStrengthByAction: byAction,
    reasons: [...new Set(reasons)],
  });
}

function projectHand(targetEstimate, donors) {
  const donorSignal = donorSignalForHand(targetEstimate, donors);
  if (LOCAL_PRECEDENCE_STATUSES.has(targetEstimate.status)) {
    return estimateFor(targetEstimate, {
      state: RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.LOCAL_PRECEDENCE,
      transferBand: RFI_CONTEXT_TRANSFER_BANDS.NONE,
      dominantAction: null,
      exactFrequencies: null,
      sourceEvidenceIds: [],
      donorContributions: [],
      relationshipStrengthByAction: { fold: 0, raise: 0 },
      donorSignal,
      reasons: [RFI_CONTEXT_TRANSFER_REASON_CODES.TARGET_LOCAL_PRECEDENCE],
    });
  }

  if (donorSignal.state === RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.UNAVAILABLE) {
    return estimateFor(targetEstimate, {
      state: RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNAVAILABLE,
      transferBand: RFI_CONTEXT_TRANSFER_BANDS.NONE,
      dominantAction: null,
      exactFrequencies: null,
      sourceEvidenceIds: donorSignal.sourceEvidenceIds,
      donorContributions: donorSignal.donorContributions,
      relationshipStrengthByAction: donorSignal.relationshipStrengthByAction,
      donorSignal,
      reasons: donorSignal.reasons,
    });
  }
  if (donorSignal.state === RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONFLICTING) {
    return estimateFor(targetEstimate, {
      state: RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNCERTAIN,
      transferBand: RFI_CONTEXT_TRANSFER_BANDS.WEAK,
      dominantAction: null,
      exactFrequencies: null,
      sourceEvidenceIds: donorSignal.sourceEvidenceIds,
      donorContributions: donorSignal.donorContributions,
      relationshipStrengthByAction: donorSignal.relationshipStrengthByAction,
      donorSignal,
      reasons: donorSignal.reasons,
    });
  }
  return estimateFor(targetEstimate, {
    state: RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED,
    transferBand: donorSignal.transferBand,
    dominantAction: cloneData(donorSignal.dominantAction),
    exactFrequencies: null,
    sourceEvidenceIds: donorSignal.sourceEvidenceIds,
    donorContributions: donorSignal.donorContributions,
    relationshipStrengthByAction: donorSignal.relationshipStrengthByAction,
    donorSignal,
    reasons: donorSignal.reasons,
  });
}

function normalizeDonors(targetSnapshot, donors) {
  if (!Array.isArray(donors)) throw new TypeError('RFI transfer donors must be an array');
  const byContext = new Map();
  donors.forEach((entry, index) => {
    requireObject(entry, `RFI transfer donors[${index}]`);
    validateRfiContextTransferRelationship(entry.relationship);
    validatePersonalStrategySnapshot(entry.snapshot);
    if (!entry.relationship.eligible) return;
    if (entry.relationship.targetScope.profileId !== targetSnapshot.scope.profileId
      || entry.relationship.targetScope.modeId !== targetSnapshot.scope.modeId
      || entry.relationship.targetScope.contextKey !== targetSnapshot.scope.contextKey) {
      throw new RangeError('RFI transfer donor relationship targets another snapshot scope');
    }
    if (entry.relationship.donorScope.profileId !== entry.snapshot.scope.profileId
      || entry.relationship.donorScope.modeId !== entry.snapshot.scope.modeId
      || entry.relationship.donorScope.contextKey !== entry.snapshot.scope.contextKey) {
      throw new RangeError('RFI transfer donor relationship and snapshot scope disagree');
    }
    const key = entry.snapshot.scope.contextKey;
    const existing = byContext.get(key);
    if (existing && existing.snapshot.evidenceRevision.fingerprint
      !== entry.snapshot.evidenceRevision.fingerprint) {
      throw new RangeError('Duplicate RFI donor context revisions are ambiguous');
    }
    if (!existing) byContext.set(key, entry);
  });
  return [...byContext.values()].sort((left, right) => (
    right.relationship.transferStrength - left.relationship.transferStrength
    || left.relationship.donorScope.contextKey.localeCompare(right.relationship.donorScope.contextKey, 'en')
  )).slice(0, MAX_RFI_TRANSFER_DONOR_CONTEXTS);
}

export function createRfiContextTransferProjection({
  targetSnapshot,
  relationships = [],
  donors = [],
  donorCatalogFingerprint = 'none',
} = {}) {
  validatePersonalStrategySnapshot(targetSnapshot);
  const normalizedDonors = normalizeDonors(targetSnapshot, donors);
  if (!Array.isArray(relationships)) throw new TypeError('RFI transfer relationships must be an array');
  relationships.forEach(validateRfiContextTransferRelationship);
  const estimates = targetSnapshot.estimates.map((estimate) => projectHand(estimate, normalizedDonors));
  const count = (state) => estimates.filter((estimate) => estimate.state === state).length;
  const projection = {
    schemaVersion: RFI_CONTEXT_TRANSFER_PROJECTION_SCHEMA_VERSION,
    modelVersion: RFI_CONTEXT_TRANSFER_MODEL_VERSION,
    scope: cloneData(targetSnapshot.scope),
    targetEvidenceFingerprint: targetSnapshot.evidenceRevision.fingerprint,
    donorCatalogFingerprint,
    donorRevisionFingerprint: fingerprint(normalizedDonors.map((entry) => ({
      contextKey: entry.snapshot.scope.contextKey,
      evidenceFingerprint: entry.snapshot.evidenceRevision.fingerprint,
      transferStrength: entry.relationship.transferStrength,
    }))),
    relationships: cloneData([...relationships].sort((left, right) => (
      right.transferStrength - left.transferStrength
      || left.donorScope.contextKey.localeCompare(right.donorScope.contextKey, 'en')
    ))),
    donorContexts: normalizedDonors.map((entry) => ({
      contextKey: entry.snapshot.scope.contextKey,
      evidenceFingerprint: entry.snapshot.evidenceRevision.fingerprint,
      relationshipStrength: entry.relationship.transferStrength,
      relationshipBand: entry.relationship.transferBand,
    })),
    estimates,
    summary: {
      transferredCount: count(RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED),
      uncertainCount: count(RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNCERTAIN),
      localPrecedenceCount: count(RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.LOCAL_PRECEDENCE),
      unavailableCount: count(RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.UNAVAILABLE),
    },
  };
  validateRfiContextTransferProjection(projection);
  return deepFreeze(projection);
}

export function validateRfiContextTransferEstimate(estimate) {
  requireObject(estimate, 'RFI context transfer estimate');
  if (estimate.schemaVersion !== RFI_CONTEXT_TRANSFER_ESTIMATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_CONTEXT_TRANSFER_ESTIMATE_SCHEMA_VERSION}`);
  }
  if (estimate.modelVersion !== RFI_CONTEXT_TRANSFER_MODEL_VERSION) {
    throw new RangeError('Unsupported RFI context transfer estimate model');
  }
  if (!ESTIMATE_STATE_VALUES.has(estimate.state)) throw new RangeError('Unsupported RFI transfer state');
  if (!BAND_VALUES.has(estimate.transferBand)) throw new RangeError('Unsupported RFI transfer estimate band');
  if (!PREFLOP_HAND_CLASSES.includes(estimate.handClass)) throw new RangeError('Invalid RFI transfer hand class');
  if (estimate.exactFrequencies !== null) {
    throw new RangeError('Cross-context transfer never manufactures an exact target distribution');
  }
  if (estimate.state === RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
    && !FOLD_RAISE.includes(estimate.dominantAction?.type)) {
    throw new RangeError('Transferred RFI estimate requires a Fold or Raise dominant action');
  }
  if (estimate.state !== RFI_CONTEXT_TRANSFER_ESTIMATE_STATES.TRANSFERRED
    && estimate.dominantAction !== null) {
    throw new RangeError('Abstained/local RFI transfer estimates cannot contain an action');
  }
  if (!Array.isArray(estimate.donorContributions)
    || estimate.donorContributions.length > MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND) {
    throw new RangeError('RFI transfer contributor count exceeds its bounded contract');
  }
  if (new Set(estimate.donorContributions.map((entry) => entry.donorContextKey)).size
    !== estimate.donorContributions.length) {
    throw new RangeError('One donor context cannot contribute more than once to one hand');
  }
  if (!Array.isArray(estimate.sourceEvidenceIds) || !Array.isArray(estimate.reasons)) {
    throw new TypeError('RFI transfer evidence IDs and reasons must be arrays');
  }
  requireObject(estimate.donorSignal, 'RFI transfer donor signal');
  if (!DONOR_SIGNAL_STATE_VALUES.has(estimate.donorSignal.state)) {
    throw new RangeError('Unsupported RFI transfer donor signal state');
  }
  if (!BAND_VALUES.has(estimate.donorSignal.transferBand)
    || !Array.isArray(estimate.donorSignal.donorContributions)
    || !Array.isArray(estimate.donorSignal.sourceEvidenceIds)
    || !Array.isArray(estimate.donorSignal.reasons)) {
    throw new TypeError('RFI transfer donor signal is malformed');
  }
  if (estimate.donorSignal.donorContributions.length > MAX_RFI_TRANSFER_CONTRIBUTORS_PER_HAND) {
    throw new RangeError('RFI transfer donor signal exceeds its bounded contributor contract');
  }
  if (estimate.donorSignal.state === RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONSISTENT
    && !FOLD_RAISE.includes(estimate.donorSignal.dominantAction?.type)) {
    throw new RangeError('A consistent RFI transfer donor signal requires Fold or Raise');
  }
  if (estimate.donorSignal.state !== RFI_CONTEXT_TRANSFER_DONOR_SIGNAL_STATES.CONSISTENT
    && estimate.donorSignal.dominantAction !== null) {
    throw new RangeError('An unavailable or conflicting donor signal cannot contain an action');
  }
  return estimate;
}

export function validateRfiContextTransferProjection(projection) {
  requireObject(projection, 'RFI context transfer projection');
  if (projection.schemaVersion !== RFI_CONTEXT_TRANSFER_PROJECTION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RFI_CONTEXT_TRANSFER_PROJECTION_SCHEMA_VERSION}`);
  }
  if (projection.modelVersion !== RFI_CONTEXT_TRANSFER_MODEL_VERSION) {
    throw new RangeError('Unsupported RFI context transfer projection model');
  }
  if (!Array.isArray(projection.estimates)
    || projection.estimates.length !== PREFLOP_HAND_CLASSES.length) {
    throw new RangeError('RFI context transfer projection must contain exactly 169 estimates');
  }
  projection.estimates.forEach((estimate, index) => {
    validateRfiContextTransferEstimate(estimate);
    if (estimate.handClass !== PREFLOP_HAND_CLASSES[index]) {
      throw new RangeError('RFI transfer estimates must use canonical hand-class order');
    }
  });
  if (!Array.isArray(projection.relationships) || !Array.isArray(projection.donorContexts)) {
    throw new TypeError('RFI transfer projection relationships and donors must be arrays');
  }
  projection.relationships.forEach(validateRfiContextTransferRelationship);
  if (projection.donorContexts.length > MAX_RFI_TRANSFER_DONOR_CONTEXTS) {
    throw new RangeError('RFI transfer projection exceeds the donor-context cap');
  }
  return projection;
}
