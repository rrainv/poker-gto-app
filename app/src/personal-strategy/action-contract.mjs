import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';
import {
  CALIBRATION_CONTEXT_SCHEMA_VERSION,
  CALIBRATION_DECISION_FAMILIES,
  RANGE_OBSERVATION_STATES,
  validateCalibrationContext,
  validatePersonalStrategyLegalActionsForDecisionFamily,
  validateRangeObservation,
  validateTrainingObservation,
} from './domain.mjs';

export const PERSONAL_STRATEGY_ACTION_SET_SCHEMA_VERSION =
  'personal-strategy-action-set/v1';
export const PERSONAL_STRATEGY_ACTION_EVIDENCE_SCHEMA_VERSION =
  'personal-strategy-action-evidence/v2';
export const PERSONAL_STRATEGY_ACTION_ESTIMATE_SCHEMA_VERSION =
  'personal-strategy-estimate/v2';
export const PERSONAL_STRATEGY_EXACT_DISTRIBUTION_TOLERANCE = 1e-12;

export const PERSONAL_STRATEGY_ACTION_IDS = Object.freeze({
  FOLD: ACTION_TYPES.FOLD,
  CHECK: ACTION_TYPES.CHECK,
  CALL: ACTION_TYPES.CALL,
  RAISE: ACTION_TYPES.RAISE,
  ALL_IN: ACTION_TYPES.ALL_IN,
});

export const PERSONAL_STRATEGY_ACTION_VALUE_STATES = Object.freeze({
  AVAILABLE: 'available',
  UNCERTAIN: 'uncertain',
  CONFLICTING: 'conflicting',
  UNKNOWN: 'unknown',
  UNAVAILABLE: 'unavailable',
});

export const PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS = Object.freeze({
  DOMINANT_ACTION: 'dominant_action',
  EXACT_DISTRIBUTION: 'exact_distribution',
  OBSERVED_ACTION: 'observed_action',
  RETRACTION: 'retraction',
  UNSUPPORTED_LEGACY_ACTION: 'unsupported_legacy_action',
});

const CANONICAL_ACTION_ORDER = Object.freeze([
  ACTION_TYPES.FOLD,
  ACTION_TYPES.CHECK,
  ACTION_TYPES.CALL,
  ACTION_TYPES.RAISE,
  ACTION_TYPES.ALL_IN,
]);
const ACTION_INDEX = new Map(CANONICAL_ACTION_ORDER.map((type, index) => [type, index]));
const ACTION_VALUE_STATE_SET = new Set(Object.values(PERSONAL_STRATEGY_ACTION_VALUE_STATES));
const EVIDENCE_CLAIM_SET = new Set(Object.values(PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS));
const RFI_ESTIMATE_STATUSES = new Set([
  'directly_known',
  'inferred_high',
  'inferred_medium',
]);

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
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

function actionType(value, label) {
  const type = typeof value === 'string' ? value : value?.type;
  if (!ACTION_INDEX.has(type)) {
    throw new RangeError(`${label} must use a supported Personal Strategy action identity`);
  }
  return type;
}

function actionIdentity(value, label) {
  return { type: actionType(value, label) };
}

function exactActionSetId(decisionFamily, legalActions) {
  return `${PERSONAL_STRATEGY_ACTION_SET_SCHEMA_VERSION}:${decisionFamily}:${legalActions.join('+')}`;
}

function sameActionTypes(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

export function createPersonalStrategyActionSet({ decisionFamily, legalActions } = {}) {
  requireString(decisionFamily, 'Personal Strategy decision family');
  if (!Array.isArray(legalActions) || legalActions.length === 0) {
    throw new RangeError('A Personal Strategy action set requires at least one legal action');
  }
  const types = legalActions.map((entry, index) => actionType(entry, `legalActions[${index}]`));
  if (new Set(types).size !== types.length) {
    throw new RangeError('A Personal Strategy action set cannot repeat an action identity');
  }
  const ordered = [...types].sort((left, right) => ACTION_INDEX.get(left) - ACTION_INDEX.get(right));
  validatePersonalStrategyLegalActionsForDecisionFamily(decisionFamily, ordered);
  const actionSet = {
    schemaVersion: PERSONAL_STRATEGY_ACTION_SET_SCHEMA_VERSION,
    actionSetId: exactActionSetId(decisionFamily, ordered),
    decisionFamily,
    legalActions: ordered.map((type) => ({ type })),
  };
  validatePersonalStrategyActionSet(actionSet);
  return deepFreeze(actionSet);
}

export function validatePersonalStrategyActionSet(actionSet) {
  requireObject(actionSet, 'PersonalStrategyActionSet');
  if (actionSet.schemaVersion !== PERSONAL_STRATEGY_ACTION_SET_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_ACTION_SET_SCHEMA_VERSION}`);
  }
  requireString(actionSet.decisionFamily, 'PersonalStrategyActionSet.decisionFamily');
  if (!Array.isArray(actionSet.legalActions) || actionSet.legalActions.length === 0) {
    throw new RangeError('PersonalStrategyActionSet.legalActions must not be empty');
  }
  const types = actionSet.legalActions.map((entry, index) => (
    actionType(entry, `PersonalStrategyActionSet.legalActions[${index}]`)
  ));
  if (new Set(types).size !== types.length) {
    throw new RangeError('PersonalStrategyActionSet.legalActions must be unique');
  }
  const ordered = [...types].sort((left, right) => ACTION_INDEX.get(left) - ACTION_INDEX.get(right));
  if (!sameActionTypes(types, ordered)) {
    throw new RangeError('PersonalStrategyActionSet legal actions must use canonical identity order');
  }
  validatePersonalStrategyLegalActionsForDecisionFamily(actionSet.decisionFamily, types);
  if (actionSet.actionSetId !== exactActionSetId(actionSet.decisionFamily, types)) {
    throw new RangeError('PersonalStrategyActionSet.actionSetId is not canonical');
  }
  return actionSet;
}

export const PERSONAL_STRATEGY_RFI_ACTION_SET = createPersonalStrategyActionSet({
  decisionFamily: CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
  legalActions: [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE],
});

export function getPersonalStrategyActionSetForDecisionFamily(decisionFamily, legalActions = null) {
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    && legalActions === null) {
    return PERSONAL_STRATEGY_RFI_ACTION_SET;
  }
  if (legalActions === null) {
    throw new RangeError(`Personal Strategy action set for ${decisionFamily} requires context legality`);
  }
  return createPersonalStrategyActionSet({ decisionFamily, legalActions });
}

export function getPersonalStrategyActionSetForContext(context) {
  validateCalibrationContext(context);
  if (context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION) {
    return PERSONAL_STRATEGY_RFI_ACTION_SET;
  }
  return getPersonalStrategyActionSetForDecisionFamily(
    context.decisionFamily,
    context.legalActions,
  );
}

export function getPersonalStrategyActionPresentationOrder(actionSet, preferredOrder = null) {
  validatePersonalStrategyActionSet(actionSet);
  if (preferredOrder === null) return deepFreeze(cloneData(actionSet.legalActions));
  if (!Array.isArray(preferredOrder)) {
    throw new TypeError('Personal Strategy presentation order must be an array');
  }
  const preferredTypes = preferredOrder.map((entry, index) => (
    actionType(entry, `preferredOrder[${index}]`)
  ));
  const legalTypes = actionSet.legalActions.map((entry) => entry.type);
  if (new Set(preferredTypes).size !== preferredTypes.length
    || preferredTypes.length !== legalTypes.length
    || preferredTypes.some((type) => !legalTypes.includes(type))) {
    throw new RangeError('Personal Strategy presentation order must contain every legal action exactly once');
  }
  return deepFreeze(preferredTypes.map((type) => ({ type })));
}

export function personalStrategyActionSetHas(actionSet, action) {
  validatePersonalStrategyActionSet(actionSet);
  try {
    const type = actionType(action, 'Personal Strategy action');
    return actionSet.legalActions.some((entry) => entry.type === type);
  } catch {
    return false;
  }
}

function distributionEntries(exactDistribution) {
  if (Array.isArray(exactDistribution)) {
    return exactDistribution.map((entry, index) => {
      requireObject(entry, `exactDistribution[${index}]`);
      return [
        actionType(entry.action ?? entry.type, `exactDistribution[${index}].action`),
        Number(entry.probability),
      ];
    });
  }
  requireObject(exactDistribution, 'exactDistribution');
  return Object.entries(exactDistribution).map(([type, probability]) => [
    actionType(type, `exactDistribution.${type}`),
    Number(probability),
  ]);
}

export function normalizePersonalStrategyExactDistribution(actionSet, exactDistribution) {
  validatePersonalStrategyActionSet(actionSet);
  const legalTypes = actionSet.legalActions.map((entry) => entry.type);
  const supplied = distributionEntries(exactDistribution);
  if (new Set(supplied.map(([type]) => type)).size !== supplied.length) {
    throw new RangeError('An exact Personal Strategy distribution cannot repeat an action');
  }
  const probabilities = new Map();
  for (const [type, probability] of supplied) {
    if (!legalTypes.includes(type)) {
      throw new RangeError(`Action ${type} is illegal for ${actionSet.decisionFamily}`);
    }
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('Exact Personal Strategy probabilities must be finite values in [0, 1]');
    }
    probabilities.set(type, probability);
  }
  const values = legalTypes.map((type) => probabilities.get(type) ?? 0);
  const total = values.reduce((sum, probability) => sum + probability, 0);
  if (Math.abs(total - 1) > PERSONAL_STRATEGY_EXACT_DISTRIBUTION_TOLERANCE) {
    throw new RangeError('An exact Personal Strategy distribution must sum to 1');
  }
  const lastPositiveIndex = values.findLastIndex((probability) => probability > 0);
  if (lastPositiveIndex < 0) {
    throw new RangeError('An exact Personal Strategy distribution requires positive mass');
  }
  const otherTotal = values.reduce((sum, probability, index) => (
    index === lastPositiveIndex ? sum : sum + probability
  ), 0);
  values[lastPositiveIndex] = 1 - otherTotal;
  if (values[lastPositiveIndex] < 0
    || values[lastPositiveIndex] > 1 + PERSONAL_STRATEGY_EXACT_DISTRIBUTION_TOLERANCE) {
    throw new RangeError('An exact Personal Strategy distribution cannot close its residual safely');
  }
  const normalized = legalTypes.map((type, index) => ({
    action: { type },
    probability: values[index] === 0 ? 0 : values[index],
  }));
  return deepFreeze(normalized);
}

export function derivePersonalStrategyDominantAction(exactDistribution) {
  if (!Array.isArray(exactDistribution) || exactDistribution.length === 0) {
    throw new TypeError('A normalized exact Personal Strategy distribution is required');
  }
  const maximum = Math.max(...exactDistribution.map((entry) => entry.probability));
  const maxima = exactDistribution.filter((entry) => (
    Math.abs(entry.probability - maximum) <= PERSONAL_STRATEGY_EXACT_DISTRIBUTION_TOLERANCE
  ));
  return maxima.length === 1 ? deepFreeze({ type: maxima[0].action.type }) : null;
}

function normalizeStrategyValue({
  actionSet,
  valueState,
  dominantAction = undefined,
  exactDistribution = null,
}) {
  validatePersonalStrategyActionSet(actionSet);
  if (!ACTION_VALUE_STATE_SET.has(valueState)) {
    throw new RangeError(`Unsupported Personal Strategy action value state: ${valueState}`);
  }
  if (valueState !== PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE) {
    if ((dominantAction !== undefined && dominantAction !== null) || exactDistribution !== null) {
      throw new RangeError('A non-available Personal Strategy value cannot contain action guidance');
    }
    return { dominantAction: null, exactDistribution: null };
  }
  if (exactDistribution === null) {
    if (dominantAction === undefined || dominantAction === null) {
      throw new RangeError('Available dominant-only guidance requires a dominant action');
    }
    const normalizedDominant = actionIdentity(dominantAction, 'dominantAction');
    if (!personalStrategyActionSetHas(actionSet, normalizedDominant)) {
      throw new RangeError('Personal Strategy dominant action is illegal for its action set');
    }
    return { dominantAction: normalizedDominant, exactDistribution: null };
  }
  const normalizedDistribution = normalizePersonalStrategyExactDistribution(actionSet, exactDistribution);
  const derivedDominant = derivePersonalStrategyDominantAction(normalizedDistribution);
  if (dominantAction !== undefined) {
    const suppliedDominant = dominantAction === null
      ? null
      : actionIdentity(dominantAction, 'dominantAction');
    if (suppliedDominant?.type !== derivedDominant?.type) {
      throw new RangeError('Personal Strategy dominant action must match the exact distribution maximum');
    }
  }
  return { dominantAction: derivedDominant, exactDistribution: normalizedDistribution };
}

function normalizedContradictions(contradictions) {
  if (!Array.isArray(contradictions)) {
    throw new TypeError('Personal Strategy contradictions must be an array');
  }
  return contradictions.map((entry, index) => {
    requireObject(entry, `contradictions[${index}]`);
    requireString(entry.kind, `contradictions[${index}].kind`);
    if (!Array.isArray(entry.evidenceReferences)) {
      throw new TypeError(`contradictions[${index}].evidenceReferences must be an array`);
    }
    const evidenceReferences = entry.evidenceReferences.map((id, referenceIndex) => (
      requireString(id, `contradictions[${index}].evidenceReferences[${referenceIndex}]`)
    ));
    if (new Set(evidenceReferences).size !== evidenceReferences.length) {
      throw new RangeError('Personal Strategy contradiction evidence references must be unique');
    }
    return stableValue({
      conflictId: entry.conflictId ?? null,
      kind: entry.kind,
      evidenceReferences: [...evidenceReferences].sort(),
      status: entry.status ?? 'unresolved',
      resolutionEvidenceId: entry.resolutionEvidenceId ?? null,
    });
  });
}

export function createPersonalStrategyActionEstimateV2({
  actionSet,
  target,
  valueState,
  dominantAction = undefined,
  exactDistribution = null,
  uncertainty = null,
  provenance,
  sourceType,
  contradictions = [],
  sourceEvidenceIds = [],
} = {}) {
  validatePersonalStrategyActionSet(actionSet);
  requireObject(target, 'Personal Strategy estimate target');
  requireObject(provenance, 'Personal Strategy estimate provenance');
  requireString(sourceType, 'Personal Strategy estimate sourceType');
  if (!Array.isArray(sourceEvidenceIds)) {
    throw new TypeError('Personal Strategy estimate sourceEvidenceIds must be an array');
  }
  const normalizedSourceIds = sourceEvidenceIds.map((id, index) => (
    requireString(id, `sourceEvidenceIds[${index}]`)
  ));
  if (new Set(normalizedSourceIds).size !== normalizedSourceIds.length) {
    throw new RangeError('Personal Strategy estimate sourceEvidenceIds must be unique');
  }
  const value = normalizeStrategyValue({ actionSet, valueState, dominantAction, exactDistribution });
  const normalizedConflicts = normalizedContradictions(contradictions);
  if (valueState === PERSONAL_STRATEGY_ACTION_VALUE_STATES.CONFLICTING
    && normalizedConflicts.length === 0) {
    throw new RangeError('A conflicting Personal Strategy estimate must preserve its contradictions');
  }
  const estimate = {
    schemaVersion: PERSONAL_STRATEGY_ACTION_ESTIMATE_SCHEMA_VERSION,
    actionSet: cloneData(actionSet),
    target: stableValue(cloneData(target)),
    valueState,
    dominantAction: cloneData(value.dominantAction),
    exactDistribution: cloneData(value.exactDistribution),
    uncertainty: uncertainty === null ? null : stableValue(cloneData(uncertainty)),
    provenance: stableValue(cloneData(provenance)),
    sourceType,
    contradictions: normalizedConflicts,
    sourceEvidenceIds: [...normalizedSourceIds].sort(),
  };
  validatePersonalStrategyActionEstimateV2(estimate);
  return deepFreeze(estimate);
}

export function validatePersonalStrategyActionEstimateV2(estimate) {
  requireObject(estimate, 'PersonalStrategyActionEstimate');
  if (estimate.schemaVersion !== PERSONAL_STRATEGY_ACTION_ESTIMATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_ACTION_ESTIMATE_SCHEMA_VERSION}`);
  }
  validatePersonalStrategyActionSet(estimate.actionSet);
  requireObject(estimate.target, 'PersonalStrategyActionEstimate.target');
  requireObject(estimate.provenance, 'PersonalStrategyActionEstimate.provenance');
  requireString(estimate.sourceType, 'PersonalStrategyActionEstimate.sourceType');
  const value = normalizeStrategyValue({
    actionSet: estimate.actionSet,
    valueState: estimate.valueState,
    dominantAction: estimate.dominantAction,
    exactDistribution: estimate.exactDistribution,
  });
  if (value.dominantAction?.type !== estimate.dominantAction?.type) {
    throw new RangeError('PersonalStrategyActionEstimate dominant action is not canonical');
  }
  if (estimate.exactDistribution !== null
    && (!Array.isArray(estimate.exactDistribution)
      || !sameDistribution(value.exactDistribution, estimate.exactDistribution))) {
    throw new RangeError('PersonalStrategyActionEstimate exact distribution is not canonical');
  }
  normalizedContradictions(estimate.contradictions);
  if (estimate.valueState === PERSONAL_STRATEGY_ACTION_VALUE_STATES.CONFLICTING
    && estimate.contradictions.length === 0) {
    throw new RangeError('A conflicting Personal Strategy estimate must preserve its contradictions');
  }
  if (!Array.isArray(estimate.sourceEvidenceIds)) {
    throw new TypeError('PersonalStrategyActionEstimate.sourceEvidenceIds must be an array');
  }
  const sourceEvidenceIds = estimate.sourceEvidenceIds.map((id, index) => (
    requireString(id, `PersonalStrategyActionEstimate.sourceEvidenceIds[${index}]`)
  ));
  if (new Set(sourceEvidenceIds).size !== sourceEvidenceIds.length
    || sourceEvidenceIds.some((id, index) => id !== [...sourceEvidenceIds].sort()[index])) {
    throw new RangeError('PersonalStrategyActionEstimate source evidence IDs must be unique and sorted');
  }
  return estimate;
}

export function createPersonalStrategyActionEvidenceV2({
  evidenceId,
  actionSet,
  target,
  claimKind,
  dominantAction = undefined,
  exactDistribution = null,
  observedAction = null,
  legacyValue = null,
  sourceType,
  sourceRecordSchema,
  provenance,
  contradictions = [],
  occurredAt,
  recordedAt,
} = {}) {
  requireString(evidenceId, 'Personal Strategy evidence ID');
  validatePersonalStrategyActionSet(actionSet);
  requireObject(target, 'Personal Strategy evidence target');
  if (!EVIDENCE_CLAIM_SET.has(claimKind)) {
    throw new RangeError(`Unsupported Personal Strategy evidence claim: ${claimKind}`);
  }
  requireString(sourceType, 'Personal Strategy evidence sourceType');
  requireString(sourceRecordSchema, 'Personal Strategy evidence sourceRecordSchema');
  requireObject(provenance, 'Personal Strategy evidence provenance');
  let valueState = PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE;
  let value = { dominantAction: null, exactDistribution: null };
  let normalizedObservedAction = null;
  if (claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.DOMINANT_ACTION) {
    value = normalizeStrategyValue({ actionSet, valueState, dominantAction, exactDistribution: null });
  } else if (claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.EXACT_DISTRIBUTION) {
    value = normalizeStrategyValue({ actionSet, valueState, dominantAction, exactDistribution });
  } else if (claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.OBSERVED_ACTION) {
    normalizedObservedAction = actionIdentity(observedAction, 'observedAction');
    if (!personalStrategyActionSetHas(actionSet, normalizedObservedAction)) {
      throw new RangeError('Observed Personal Strategy action is illegal for its action set');
    }
  } else if (claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.RETRACTION
    || claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION) {
    valueState = PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE;
  }
  const evidence = {
    schemaVersion: PERSONAL_STRATEGY_ACTION_EVIDENCE_SCHEMA_VERSION,
    evidenceId,
    actionSet: cloneData(actionSet),
    target: stableValue(cloneData(target)),
    claimKind,
    valueState,
    dominantAction: cloneData(value.dominantAction),
    exactDistribution: cloneData(value.exactDistribution),
    observedAction: normalizedObservedAction,
    legacyValue: legacyValue === null ? null : stableValue(cloneData(legacyValue)),
    sourceType,
    sourceRecordSchema,
    provenance: stableValue(cloneData(provenance)),
    contradictions: normalizedContradictions(contradictions),
    occurredAt,
    recordedAt,
  };
  validatePersonalStrategyActionEvidenceV2(evidence);
  return deepFreeze(evidence);
}

export function validatePersonalStrategyActionEvidenceV2(evidence) {
  requireObject(evidence, 'PersonalStrategyActionEvidence');
  if (evidence.schemaVersion !== PERSONAL_STRATEGY_ACTION_EVIDENCE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_ACTION_EVIDENCE_SCHEMA_VERSION}`);
  }
  requireString(evidence.evidenceId, 'PersonalStrategyActionEvidence.evidenceId');
  validatePersonalStrategyActionSet(evidence.actionSet);
  requireObject(evidence.target, 'PersonalStrategyActionEvidence.target');
  if (!EVIDENCE_CLAIM_SET.has(evidence.claimKind)) {
    throw new RangeError('PersonalStrategyActionEvidence claim kind is unsupported');
  }
  requireString(evidence.sourceType, 'PersonalStrategyActionEvidence.sourceType');
  requireString(evidence.sourceRecordSchema, 'PersonalStrategyActionEvidence.sourceRecordSchema');
  requireObject(evidence.provenance, 'PersonalStrategyActionEvidence.provenance');
  normalizedContradictions(evidence.contradictions);
  if (evidence.claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.OBSERVED_ACTION) {
    if (!personalStrategyActionSetHas(evidence.actionSet, evidence.observedAction)) {
      throw new RangeError('PersonalStrategyActionEvidence observed action is illegal');
    }
  } else if (evidence.claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.RETRACTION) {
    if (evidence.valueState !== PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE
      || evidence.dominantAction !== null || evidence.exactDistribution !== null
      || evidence.legacyValue !== null) {
      throw new RangeError('PersonalStrategyActionEvidence retraction cannot contain action guidance');
    }
  } else if (evidence.claimKind
    === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION) {
    if (evidence.valueState !== PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE
      || evidence.dominantAction !== null || evidence.exactDistribution !== null
      || !evidence.legacyValue || typeof evidence.legacyValue !== 'object') {
      throw new RangeError('Unsupported legacy evidence must retain a non-actionable legacy value');
    }
  } else {
    const value = normalizeStrategyValue({
      actionSet: evidence.actionSet,
      valueState: evidence.valueState,
      dominantAction: evidence.dominantAction,
      exactDistribution: evidence.exactDistribution,
    });
    if (evidence.exactDistribution !== null
      && (!Array.isArray(evidence.exactDistribution)
        || !sameDistribution(value.exactDistribution, evidence.exactDistribution))) {
      throw new RangeError('PersonalStrategyActionEvidence exact distribution is not canonical');
    }
  }
  return evidence;
}

export function projectRangeObservationV1ToActionEvidenceV2(observation) {
  validateRangeObservation(observation);
  const actionSet = getPersonalStrategyActionSetForContext(observation.context);
  const active = observation.state === RANGE_OBSERVATION_STATES.ACTIVE;
  const actionTypes = active
    ? [observation.dominantAction?.type, ...(observation.frequencies ?? []).map((entry) => entry.action.type)]
      .filter(Boolean)
    : [];
  const supported = actionTypes.every((type) => personalStrategyActionSetHas(
    actionSet,
    type,
  ));
  const claimKind = !active
    ? PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.RETRACTION
    : !supported
      ? PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION
    : observation.hasExplicitFrequencies
      ? PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.EXACT_DISTRIBUTION
      : PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.DOMINANT_ACTION;
  return createPersonalStrategyActionEvidenceV2({
    evidenceId: observation.id,
    actionSet,
    target: { kind: 'hand_class', id: observation.handClass },
    claimKind,
    dominantAction: active && supported ? observation.dominantAction : undefined,
    exactDistribution: active && supported && observation.hasExplicitFrequencies
      ? observation.frequencies : null,
    legacyValue: active && !supported ? {
      dominantAction: cloneData(observation.dominantAction),
      exactFrequencies: cloneData(observation.frequencies),
    } : null,
    sourceType: observation.provenance.type,
    sourceRecordSchema: observation.schemaVersion,
    provenance: observation.provenance,
    occurredAt: observation.createdAt,
    recordedAt: observation.updatedAt,
  });
}

export function projectTrainingObservationV1ToActionEvidenceV2(observation) {
  validateTrainingObservation(observation);
  const supported = personalStrategyActionSetHas(PERSONAL_STRATEGY_RFI_ACTION_SET, observation.chosenAction);
  return createPersonalStrategyActionEvidenceV2({
    evidenceId: observation.id,
    actionSet: getPersonalStrategyActionSetForDecisionFamily(observation.context.decisionFamily),
    target: { kind: 'hand_class', id: observation.handClass },
    claimKind: supported
      ? PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.OBSERVED_ACTION
      : PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION,
    observedAction: supported ? observation.chosenAction : null,
    legacyValue: supported ? null : { chosenAction: cloneData(observation.chosenAction) },
    sourceType: observation.provenance.type,
    sourceRecordSchema: observation.schemaVersion,
    provenance: observation.provenance,
    occurredAt: observation.createdAt,
    recordedAt: observation.updatedAt,
  });
}

function actionEstimateValueState(status) {
  if (RFI_ESTIMATE_STATUSES.has(status)) return PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE;
  if (status === 'uncertain') return PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNCERTAIN;
  if (status === 'conflicting') return PERSONAL_STRATEGY_ACTION_VALUE_STATES.CONFLICTING;
  if (status === 'unknown') return PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNKNOWN;
  return PERSONAL_STRATEGY_ACTION_VALUE_STATES.UNAVAILABLE;
}

export function projectPersonalStrategyEstimateV1ToActionEstimateV2(
  estimate,
  { contradictions = [] } = {},
) {
  requireObject(estimate, 'PersonalStrategyEstimate v1');
  if (estimate.schemaVersion !== 'personal-strategy-estimate/v1') {
    throw new TypeError('Expected personal-strategy-estimate/v1');
  }
  const valueState = actionEstimateValueState(estimate.status);
  return createPersonalStrategyActionEstimateV2({
    actionSet: PERSONAL_STRATEGY_RFI_ACTION_SET,
    target: { kind: 'hand_class', id: estimate.handClass },
    valueState,
    dominantAction: valueState === PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE
      ? estimate.dominantAction : undefined,
    exactDistribution: valueState === PERSONAL_STRATEGY_ACTION_VALUE_STATES.AVAILABLE
      ? estimate.exactFrequencies : null,
    uncertainty: estimate.uncertainty ?? null,
    provenance: {
      type: estimate.provenance,
      sourceSchema: estimate.schemaVersion,
      inferenceModelVersion: estimate.inferenceModelVersion ?? null,
      conflictPolicyVersion: estimate.conflictPolicyVersion ?? null,
    },
    sourceType: estimate.provenance,
    contradictions,
    sourceEvidenceIds: estimate.sourceEvidenceIds ?? [],
  });
}

function sameDistribution(left, right) {
  return left.length === right.length && left.every((entry, index) => (
    entry.action.type === right[index].action.type
    && Math.abs(entry.probability - right[index].probability)
      <= PERSONAL_STRATEGY_EXACT_DISTRIBUTION_TOLERANCE
  ));
}

function rfiCompatibilityFrequencies(actionEstimate, legacyFrequencies) {
  if (actionEstimate.exactDistribution === null) return null;
  if (legacyFrequencies !== null && legacyFrequencies !== undefined) {
    const normalizedLegacy = normalizePersonalStrategyExactDistribution(
      PERSONAL_STRATEGY_RFI_ACTION_SET,
      legacyFrequencies,
    );
    if (!sameDistribution(normalizedLegacy, actionEstimate.exactDistribution)) {
      throw new RangeError('RFI compatibility frequencies change the action-aware distribution');
    }
    return cloneData(legacyFrequencies);
  }
  return actionEstimate.exactDistribution
    .filter((entry) => entry.probability > 0)
    .map((entry) => cloneData(entry));
}

export function projectActionEstimateV2ToRfiEstimateV1(actionEstimate, legacyEstimate = {}) {
  validatePersonalStrategyActionEstimateV2(actionEstimate);
  const legalTypes = actionEstimate.actionSet.legalActions.map((entry) => entry.type);
  if (actionEstimate.actionSet.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    || !sameActionTypes(legalTypes, [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE])) {
    throw new RangeError('Only the Fold/Raise preflop_rfi action set has a v1 compatibility projection');
  }
  return {
    ...cloneData(legacyEstimate),
    schemaVersion: 'personal-strategy-estimate/v1',
    dominantAction: cloneData(actionEstimate.dominantAction),
    exactFrequencies: rfiCompatibilityFrequencies(
      actionEstimate,
      legacyEstimate.exactFrequencies,
    ),
  };
}

export function projectActionEvidenceV2ToRfiValue(evidence, legacyFrequencies = null) {
  validatePersonalStrategyActionEvidenceV2(evidence);
  const legalTypes = evidence.actionSet.legalActions.map((entry) => entry.type);
  if (evidence.actionSet.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    || !sameActionTypes(legalTypes, [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE])) {
    throw new RangeError('Only Fold/Raise preflop_rfi evidence has a current RFI compatibility value');
  }
  if (evidence.claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.RETRACTION) return null;
  if (evidence.claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.UNSUPPORTED_LEGACY_ACTION) {
    return cloneData(evidence.legacyValue);
  }
  if (evidence.claimKind === PERSONAL_STRATEGY_ACTION_EVIDENCE_CLAIMS.OBSERVED_ACTION) {
    return { chosenAction: cloneData(evidence.observedAction) };
  }
  const exactFrequencies = evidence.exactDistribution === null
    ? null
    : rfiCompatibilityFrequencies(evidence, legacyFrequencies);
  return {
    dominantAction: cloneData(evidence.dominantAction),
    exactFrequencies,
  };
}

export function serializePersonalStrategyActionSet(actionSet) {
  validatePersonalStrategyActionSet(actionSet);
  return JSON.stringify(stableValue(actionSet));
}

export function serializePersonalStrategyActionEstimateV2(estimate) {
  validatePersonalStrategyActionEstimateV2(estimate);
  return JSON.stringify(stableValue(estimate));
}
