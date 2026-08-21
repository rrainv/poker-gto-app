import { validateGameRulesSnapshot } from '../../../shared/poker-domain/game-rules.js';
import { POSITIONS_BY_TABLE_SIZE } from '../../../shared/poker-domain/positions.js';
import { STREETS } from '../../../shared/poker-domain/schema.js';
import {
  TRAINING_POSTFLOP_SIZING_FAMILIES,
  TRAINING_PREFLOP_SIZING_FAMILIES,
  TRAINING_SIZING_FAMILIES,
  trainingSizingFamiliesForStructure,
  trainingSizingFamilyAppliesToTarget,
  validateTrainingSizingFamily,
} from './training-sizing-policy.mjs';

export const TRAINING_SESSION_INTENT_SCHEMA_VERSION = 'training-session-intent/v1';
export const TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION = 'training-scenario-request/v1';
export const TRAINING_PRACTICE_PLANNER_STATE_SCHEMA_VERSION = 'training-practice-planner-state/v1';
export const TRAINING_PRACTICE_PLANNING_ERROR_SCHEMA_VERSION = 'training-practice-planning-error/v1';
export const TRAINING_PRACTICE_PLANNER_POLICY_VERSION = 'training-practice-planner-policy/v2';

export const TRAINING_PRACTICE_MODES = Object.freeze({
  VARIED: 'varied',
  FOCUSED: 'focused',
});

export const TRAINING_VARIED_FOCUS_PROFILES = Object.freeze({
  BALANCED: 'balanced',
  MORE_PREFLOP: 'more_preflop',
  MORE_POSTFLOP: 'more_postflop',
});

export const TRAINING_STACK_PREFERENCES = Object.freeze({
  BALANCED: 'balanced',
  SHORT: 'short',
  STANDARD: 'standard',
  DEEP: 'deep',
});

export const TRAINING_TABLE_SIZE_FAMILIES = Object.freeze({
  HEADS_UP: 'heads_up',
  SHORT_HANDED: 'short_handed',
  FULL_RING: 'full_ring',
});

// This is the planner envelope vocabulary, not a trajectory implementation.
// TRAINING-SAMPLER-002B must prove that every value maps exactly to the
// canonical generator's target vocabulary before integrating the two layers.
export const TRAINING_PLANNER_TARGET_DECISION_TYPES = Object.freeze({
  PREFLOP_UNOPENED: 'preflop_unopened',
  PREFLOP_FACING_OPEN: 'preflop_facing_open',
  PREFLOP_FACING_3BET: 'preflop_facing_3bet',
  PREFLOP_FACING_4BET: 'preflop_facing_4bet',
  PREFLOP_BB_OPTION: 'preflop_bb_option',
  POSTFLOP_FIRST_ACTION: 'postflop_first_action',
  POSTFLOP_FACING_BET: 'postflop_facing_bet',
  POSTFLOP_FACING_RAISE: 'postflop_facing_raise',
});

export const TRAINING_PLANNER_STACK_ANCHORS_BB = Object.freeze([
  10, 15, 20,
  25, 30, 40,
  50, 60, 75, 80,
  100, 125, 150,
  200, 250, 300,
]);

export const TRAINING_PLANNER_HISTORY_LIMITS = Object.freeze({
  recentStructuralRecords: 32,
  recentExactFingerprints: 64,
});

export const TRAINING_PRACTICE_PLANNING_ERROR_CODES = Object.freeze({
  UNSUPPORTED_RULES: 'unsupported_rules',
  IMPOSSIBLE_FOCUSED_REQUEST: 'impossible_focused_request',
  NO_ELIGIBLE_CANDIDATES: 'no_eligible_candidates',
  SESSION_ORDINAL_OUT_OF_RANGE: 'session_ordinal_out_of_range',
  STATE_INTENT_MISMATCH: 'state_intent_mismatch',
});

const TRAINING_RULES_CAPABILITY_SCHEMA_VERSION = 'training-rules-capability/v1';
const MODE_VALUES = Object.freeze(Object.values(TRAINING_PRACTICE_MODES));
const VARIED_PROFILE_VALUES = Object.freeze(Object.values(TRAINING_VARIED_FOCUS_PROFILES));
const STACK_PREFERENCE_VALUES = Object.freeze(Object.values(TRAINING_STACK_PREFERENCES));
const TABLE_FAMILY_VALUES = Object.freeze(Object.values(TRAINING_TABLE_SIZE_FAMILIES));
const TARGET_VALUES = Object.freeze(Object.values(TRAINING_PLANNER_TARGET_DECISION_TYPES));
const STREET_VALUES = Object.freeze(Object.values(STREETS));
const DIFFICULTY_VALUES = Object.freeze(['hard', 'easy', 'guided']);
const POSITION_VALUES = Object.freeze([...new Set(
  Object.values(POSITIONS_BY_TABLE_SIZE).flat(),
)].sort(compareStrings));
const STACK_BUCKET_VALUES = Object.freeze([
  'short', 'shallow', 'medium', 'standard', 'deep', 'extended_deep',
]);
const FACING_CATEGORY_VALUES = Object.freeze([
  'none', 'open', 'three_bet', 'four_bet', 'bb_option', 'bet', 'raise',
]);
const SIZING_FAMILY_VALUES = Object.freeze(Object.values(TRAINING_SIZING_FAMILIES));
const PREFLOP_TARGETS = new Set([
  TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION,
]);
const POSTFLOP_TARGETS = new Set([
  TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
  TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE,
]);
const TARGET_FACING_CATEGORY = Object.freeze({
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED]: 'none',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN]: 'open',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET]: 'three_bet',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET]: 'four_bet',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION]: 'bb_option',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION]: 'none',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET]: 'bet',
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE]: 'raise',
});
const TARGET_CURRICULUM_WEIGHTS = Object.freeze({
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED]: 4,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN]: 3,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET]: 2,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET]: 1,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION]: 2,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION]: 3,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET]: 3,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE]: 2,
});
const STREET_CURRICULUM_WEIGHTS = Object.freeze({
  [TRAINING_VARIED_FOCUS_PROFILES.BALANCED]: Object.freeze({
    [STREETS.PREFLOP]: 4,
    [STREETS.FLOP]: 2,
    [STREETS.TURN]: 2,
    [STREETS.RIVER]: 2,
  }),
  [TRAINING_VARIED_FOCUS_PROFILES.MORE_PREFLOP]: Object.freeze({
    [STREETS.PREFLOP]: 7,
    [STREETS.FLOP]: 1,
    [STREETS.TURN]: 1,
    [STREETS.RIVER]: 1,
  }),
  [TRAINING_VARIED_FOCUS_PROFILES.MORE_POSTFLOP]: Object.freeze({
    [STREETS.PREFLOP]: 2,
    [STREETS.FLOP]: 3,
    [STREETS.TURN]: 3,
    [STREETS.RIVER]: 2,
  }),
});
const COVERAGE_COMPONENT_WEIGHTS = Object.freeze({
  streets: 4,
  targetDecisionTypes: 3,
  tableSizes: 2,
  heroPositions: 2,
  stackBuckets: 2,
  facingCategories: 1,
  sizingFamilies: 1,
  tableSizeHeroPositions: 3,
  streetTargetDecisionTypes: 3,
});
const COVERAGE_KEYS = Object.freeze(Object.keys(COVERAGE_COMPONENT_WEIGHTS));
const INTENT_KEYS = Object.freeze([
  'schemaVersion',
  'mode',
  'sessionSeed',
  'sessionLength',
  'difficulty',
  'focusPreferences',
  'rulesSnapshot',
  'rulesCapability',
  'plannerPolicyVersion',
]);
const VARIED_FOCUS_KEYS = Object.freeze([
  'profile', 'streetEmphasis', 'stackPreference', 'allowedTableSizeFamilies',
]);
const LEGACY_FOCUSED_FOCUS_KEYS = Object.freeze([
  'tableSize', 'heroPosition', 'startingStackBb', 'street', 'targetDecisionType',
]);
const FOCUSED_FOCUS_KEYS = Object.freeze([
  ...LEGACY_FOCUSED_FOCUS_KEYS, 'requestedSizingFamily',
]);
const CAPABILITY_KEYS = Object.freeze([
  'schemaVersion',
  'supported',
  'reasonCode',
  'canonicalHandSupported',
  'generatorSupported',
  'strategyProviderSupported',
]);
const REQUEST_KEYS = Object.freeze([
  'schemaVersion',
  'sessionIntentFingerprint',
  'mode',
  'sessionOrdinal',
  'exerciseSeed',
  'tableSize',
  'heroPosition',
  'startingStackBb',
  'stackBucket',
  'street',
  'targetDecisionType',
  'facingCategory',
  'requestedSizingFamily',
  'difficulty',
  'rulesSemanticFingerprint',
  'plannerPolicyVersion',
  'planning',
]);
const PLANNING_KEYS = Object.freeze([
  'reasonCodes',
  'relaxations',
  'candidatePoolSize',
  'eligibleStructuralPairCount',
  'excludedStructuralPairCount',
  'score',
]);
const SCORE_KEYS = Object.freeze([
  'coverageDeficit',
  'curriculumBase',
  'futurePriority',
  'recencyPenalty',
  'staticRetryRisk',
  'total',
  'tieBreaker',
]);
const STATE_KEYS = Object.freeze([
  'schemaVersion',
  'sessionIntentFingerprint',
  'plannerPolicyVersion',
  'servedCount',
  'relaxationCount',
  'coverage',
  'recentStructuralRecords',
  'recentExactFingerprints',
]);
const RECENT_RECORD_KEYS = Object.freeze([
  'exactFingerprint',
  'structuralFingerprint',
  'targetFamily',
  'heroPosition',
  'tableSize',
  'stackBucket',
  'street',
  'targetDecisionType',
  'facingCategory',
  'sizingFamily',
]);
const COUNTER_ENTRY_KEYS = Object.freeze(['key', 'count']);
const GENERAL_PROPOSAL_COUNT = 8;
const UNSERVED_COVERAGE_BONUS = 100000;
const INTENT_FINGERPRINT_PREFIX = 'training-session-intent-fingerprint/v1:';
const EXACT_FINGERPRINT_PREFIX = 'training-request-exact/v1:';
const STRUCTURAL_FINGERPRINT_PREFIX = 'training-request-structural/v1:';
const DERIVED_INTENT_CACHE = new WeakMap();
const INTENT_FINGERPRINT_CACHE = new WeakMap();
const CREATED_INTENTS = new WeakSet();
const CREATED_REQUESTS = new WeakSet();
const CREATED_STATES = new WeakSet();

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  return structuredClone(value);
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  requirePlainObject(value, label);
  const actual = Object.keys(value).sort(compareStrings);
  const wanted = [...expected].sort(compareStrings);
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requireEnum(value, values, label) {
  if (!values.includes(value)) throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSafeInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function uniqueEnumArray(values, allowed, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError(`${label} must be a non-empty array`);
  }
  values.forEach((value) => requireEnum(value, allowed, label));
  if (new Set(values).size !== values.length) throw new RangeError(`${label} must be unique`);
  return [...values];
}

function avalanche32(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function hashString32(value, initialState) {
  let hash = initialState >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return avalanche32(hash);
}

function digest64(value) {
  const left = hashString32(value, 0x811c9dc5).toString(16).padStart(8, '0');
  const right = hashString32(value, 0x9e3779b9).toString(16).padStart(8, '0');
  return `${left}${right}`;
}

/**
 * Planner-only deterministic seed mixing. It never shares or advances the
 * canonical Training generator's RNG stream.
 */
export function mixTrainingPlannerSeed(
  sessionSeed,
  sessionOrdinal,
  candidateKey,
  stream = TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
) {
  requireSafeInteger(sessionSeed, 0, 0xffffffff, 'sessionSeed');
  requireSafeInteger(sessionOrdinal, 0, 0xffffffff, 'sessionOrdinal');
  requireNonEmptyString(candidateKey, 'candidateKey');
  requireNonEmptyString(stream, 'stream');
  return hashString32(
    `${stream}|seed:${sessionSeed >>> 0}|ordinal:${sessionOrdinal}|candidate:${candidateKey}`,
    0x811c9dc5,
  );
}

export function trainingTableSizeFamily(tableSize) {
  requireSafeInteger(tableSize, 2, 10, 'tableSize');
  if (tableSize === 2) return TRAINING_TABLE_SIZE_FAMILIES.HEADS_UP;
  if (tableSize <= 6) return TRAINING_TABLE_SIZE_FAMILIES.SHORT_HANDED;
  return TRAINING_TABLE_SIZE_FAMILIES.FULL_RING;
}

export function trainingPositionGroup(position) {
  requireEnum(position, POSITION_VALUES, 'heroPosition');
  if (position === 'SB' || position === 'BB') return 'blinds';
  if (position === 'BTN' || position === 'CO' || position === 'HJ') return 'late';
  if (position === 'MP' || position === 'LJ') return 'middle';
  return 'early';
}

export function trainingStackBucket(startingStackBb) {
  if (!Number.isFinite(startingStackBb) || startingStackBb < 10 || startingStackBb > 500) {
    throw new RangeError('startingStackBb must be from 10 through 500');
  }
  if (startingStackBb <= 20) return 'short';
  if (startingStackBb <= 40) return 'shallow';
  if (startingStackBb <= 80) return 'medium';
  if (startingStackBb <= 150) return 'standard';
  if (startingStackBb <= 300) return 'deep';
  return 'extended_deep';
}

function targetSupportsStreet(targetDecisionType, street) {
  return street === STREETS.PREFLOP
    ? PREFLOP_TARGETS.has(targetDecisionType)
    : POSTFLOP_TARGETS.has(targetDecisionType);
}

function firstPreflopPosition(tableSize) {
  if (tableSize <= 3) return 'BTN';
  return POSITIONS_BY_TABLE_SIZE[tableSize].find(
    (position) => !['BTN', 'SB', 'BB'].includes(position),
  );
}

function structuralCompatibilityReason({ tableSize, heroPosition }, { street, targetDecisionType }) {
  if (!targetSupportsStreet(targetDecisionType, street)) return 'target_does_not_support_street';
  if (targetDecisionType === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION
    && heroPosition !== 'BB') return 'bb_option_requires_big_blind';
  if (targetDecisionType === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED
    && heroPosition === 'BB') return 'unopened_target_excludes_big_blind';
  if ([
    TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
    TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET,
  ].includes(targetDecisionType) && heroPosition === firstPreflopPosition(tableSize)) {
    return 'preflop_target_requires_prior_actor';
  }
  return null;
}

export function validateTrainingRulesCapabilityInput(capability) {
  requireExactKeys(capability, CAPABILITY_KEYS, 'Training rules capability');
  if (capability.schemaVersion !== TRAINING_RULES_CAPABILITY_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_RULES_CAPABILITY_SCHEMA_VERSION}`);
  }
  for (const field of [
    'supported', 'canonicalHandSupported', 'generatorSupported', 'strategyProviderSupported',
  ]) {
    if (typeof capability[field] !== 'boolean') {
      throw new TypeError(`Training rules capability.${field} must be boolean`);
    }
  }
  if (capability.supported) {
    if (capability.reasonCode !== null
      || !capability.canonicalHandSupported
      || !capability.generatorSupported
      || !capability.strategyProviderSupported) {
      throw new RangeError('Supported Training rules capability facts are inconsistent');
    }
  } else {
    requireNonEmptyString(capability.reasonCode, 'Training rules capability.reasonCode');
    if (capability.generatorSupported || capability.strategyProviderSupported) {
      throw new RangeError('Unsupported Training rules cannot claim generator/provider support');
    }
  }
  return capability;
}

function normalizeVariedFocusPreferences(preferences) {
  requireExactKeys(preferences, VARIED_FOCUS_KEYS, 'Varied focusPreferences');
  return {
    profile: requireEnum(preferences.profile, VARIED_PROFILE_VALUES, 'Varied profile'),
    streetEmphasis: preferences.streetEmphasis === null
      ? null
      : requireEnum(preferences.streetEmphasis, STREET_VALUES, 'streetEmphasis'),
    stackPreference: requireEnum(
      preferences.stackPreference,
      STACK_PREFERENCE_VALUES,
      'stackPreference',
    ),
    allowedTableSizeFamilies: uniqueEnumArray(
      preferences.allowedTableSizeFamilies,
      TABLE_FAMILY_VALUES,
      'allowedTableSizeFamilies',
    ),
  };
}

function normalizeFocusedPreferences(preferences) {
  const actualKeys = Object.keys(preferences).sort();
  const legacyKeys = [...LEGACY_FOCUSED_FOCUS_KEYS].sort();
  const sizedKeys = [...FOCUSED_FOCUS_KEYS].sort();
  const matches = (expected) => actualKeys.length === expected.length
    && actualKeys.every((key, index) => key === expected[index]);
  if (!matches(legacyKeys) && !matches(sizedKeys)) {
    throw new RangeError(`Focused focusPreferences must contain exactly: ${sizedKeys.join(', ')}`);
  }
  const startingStackBb = Number(preferences.startingStackBb);
  if (!Number.isFinite(startingStackBb) || startingStackBb <= 0) {
    throw new RangeError('Focused startingStackBb must be a positive finite number');
  }
  return {
    tableSize: requireSafeInteger(preferences.tableSize, 2, 10, 'Focused tableSize'),
    heroPosition: requireEnum(preferences.heroPosition, POSITION_VALUES, 'Focused heroPosition'),
    startingStackBb,
    street: requireEnum(preferences.street, STREET_VALUES, 'Focused street'),
    targetDecisionType: requireEnum(
      preferences.targetDecisionType,
      TARGET_VALUES,
      'Focused targetDecisionType',
    ),
    requestedSizingFamily: Object.hasOwn(preferences, 'requestedSizingFamily')
      ? validateTrainingSizingFamily(preferences.requestedSizingFamily, { nullable: true })
      : null,
  };
}

export function validateTrainingSessionIntent(intent) {
  if (CREATED_INTENTS.has(intent)) return intent;
  requireExactKeys(intent, INTENT_KEYS, 'TrainingSessionIntent v1');
  if (intent.schemaVersion !== TRAINING_SESSION_INTENT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_SESSION_INTENT_SCHEMA_VERSION}`);
  }
  requireEnum(intent.mode, MODE_VALUES, 'Training practice mode');
  requireSafeInteger(intent.sessionSeed, 0, 0xffffffff, 'sessionSeed');
  requireSafeInteger(intent.sessionLength, 1, 100000, 'sessionLength');
  requireEnum(intent.difficulty, DIFFICULTY_VALUES, 'difficulty');
  if (intent.plannerPolicyVersion !== TRAINING_PRACTICE_PLANNER_POLICY_VERSION) {
    throw new TypeError(`Expected ${TRAINING_PRACTICE_PLANNER_POLICY_VERSION}`);
  }
  if (intent.mode === TRAINING_PRACTICE_MODES.VARIED) {
    normalizeVariedFocusPreferences(intent.focusPreferences);
  } else {
    normalizeFocusedPreferences(intent.focusPreferences);
  }
  validateGameRulesSnapshot(intent.rulesSnapshot);
  validateTrainingRulesCapabilityInput(intent.rulesCapability);
  return intent;
}

export function createTrainingSessionIntent(input) {
  requireExactKeys(input, INTENT_KEYS, 'TrainingSessionIntent input');
  const mode = requireEnum(input.mode, MODE_VALUES, 'Training practice mode');
  const intent = {
    schemaVersion: input.schemaVersion,
    mode,
    sessionSeed: input.sessionSeed,
    sessionLength: input.sessionLength,
    difficulty: input.difficulty,
    focusPreferences: mode === TRAINING_PRACTICE_MODES.VARIED
      ? normalizeVariedFocusPreferences(input.focusPreferences)
      : normalizeFocusedPreferences(input.focusPreferences),
    rulesSnapshot: validateGameRulesSnapshot(input.rulesSnapshot),
    rulesCapability: cloneData(input.rulesCapability),
    plannerPolicyVersion: input.plannerPolicyVersion,
  };
  validateTrainingSessionIntent(intent);
  const frozen = deepFreeze(intent);
  CREATED_INTENTS.add(frozen);
  return frozen;
}

function intentFingerprintValue(intent) {
  validateTrainingSessionIntent(intent);
  if (INTENT_FINGERPRINT_CACHE.has(intent)) return INTENT_FINGERPRINT_CACHE.get(intent);
  const canonical = JSON.stringify({
    schemaVersion: intent.schemaVersion,
    mode: intent.mode,
    sessionSeed: intent.sessionSeed,
    sessionLength: intent.sessionLength,
    difficulty: intent.difficulty,
    focusPreferences: intent.mode === TRAINING_PRACTICE_MODES.VARIED
      ? {
          profile: intent.focusPreferences.profile,
          streetEmphasis: intent.focusPreferences.streetEmphasis,
          stackPreference: intent.focusPreferences.stackPreference,
          allowedTableSizeFamilies: [...intent.focusPreferences.allowedTableSizeFamilies].sort(
            compareStrings,
          ),
        }
      : {
          tableSize: intent.focusPreferences.tableSize,
          heroPosition: intent.focusPreferences.heroPosition,
          startingStackBb: intent.focusPreferences.startingStackBb,
          street: intent.focusPreferences.street,
          targetDecisionType: intent.focusPreferences.targetDecisionType,
          requestedSizingFamily: intent.focusPreferences.requestedSizingFamily,
        },
    rulesSemanticFingerprint: intent.rulesSnapshot.semanticFingerprint,
    rulesCapability: {
      schemaVersion: intent.rulesCapability.schemaVersion,
      supported: intent.rulesCapability.supported,
      reasonCode: intent.rulesCapability.reasonCode,
      canonicalHandSupported: intent.rulesCapability.canonicalHandSupported,
      generatorSupported: intent.rulesCapability.generatorSupported,
      strategyProviderSupported: intent.rulesCapability.strategyProviderSupported,
    },
    plannerPolicyVersion: intent.plannerPolicyVersion,
  });
  const fingerprint = `${INTENT_FINGERPRINT_PREFIX}${digest64(canonical)}`;
  if (Object.isFrozen(intent)) INTENT_FINGERPRINT_CACHE.set(intent, fingerprint);
  return fingerprint;
}

export function trainingSessionIntentFingerprint(intent) {
  return intentFingerprintValue(intent);
}

function validateStringArray(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  values.forEach((value, index) => requireNonEmptyString(value, `${label}[${index}]`));
  if (new Set(values).size !== values.length) throw new RangeError(`${label} must be unique`);
  return values;
}

function validatePlanningScore(score) {
  requireExactKeys(score, SCORE_KEYS, 'TrainingScenarioRequest planning.score');
  for (const key of SCORE_KEYS) {
    if (!Number.isSafeInteger(score[key])) {
      throw new RangeError(`TrainingScenarioRequest planning.score.${key} must be a safe integer`);
    }
  }
  if (score.tieBreaker < 0 || score.tieBreaker > 0xffffffff) {
    throw new RangeError('TrainingScenarioRequest planning.score.tieBreaker must be uint32');
  }
  if (score.total !== score.coverageDeficit
    + score.curriculumBase
    + score.futurePriority
    - score.recencyPenalty
    - score.staticRetryRisk) {
    throw new RangeError('TrainingScenarioRequest planning.score.total is inconsistent');
  }
}

function validateRequestPlanning(planning) {
  requireExactKeys(planning, PLANNING_KEYS, 'TrainingScenarioRequest planning');
  validateStringArray(planning.reasonCodes, 'TrainingScenarioRequest planning.reasonCodes');
  validateStringArray(planning.relaxations, 'TrainingScenarioRequest planning.relaxations');
  requireSafeInteger(planning.candidatePoolSize, 1, 1000, 'planning.candidatePoolSize');
  requireSafeInteger(
    planning.eligibleStructuralPairCount,
    1,
    10000,
    'planning.eligibleStructuralPairCount',
  );
  requireSafeInteger(
    planning.excludedStructuralPairCount,
    0,
    10000,
    'planning.excludedStructuralPairCount',
  );
  validatePlanningScore(planning.score);
}

export function validateTrainingScenarioRequest(request) {
  if (CREATED_REQUESTS.has(request)) return request;
  requireExactKeys(request, REQUEST_KEYS, 'TrainingScenarioRequest v1');
  if (request.schemaVersion !== TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION}`);
  }
  if (!request.sessionIntentFingerprint.startsWith(INTENT_FINGERPRINT_PREFIX)) {
    throw new TypeError('TrainingScenarioRequest sessionIntentFingerprint is invalid');
  }
  requireEnum(request.mode, MODE_VALUES, 'TrainingScenarioRequest mode');
  requireSafeInteger(request.sessionOrdinal, 0, 99999, 'sessionOrdinal');
  requireSafeInteger(request.exerciseSeed, 0, 0xffffffff, 'exerciseSeed');
  requireSafeInteger(request.tableSize, 2, 10, 'tableSize');
  if (!POSITIONS_BY_TABLE_SIZE[request.tableSize].includes(request.heroPosition)) {
    throw new RangeError('TrainingScenarioRequest heroPosition does not belong to tableSize');
  }
  if (!Number.isFinite(request.startingStackBb)
    || request.startingStackBb < 10 || request.startingStackBb > 500) {
    throw new RangeError('TrainingScenarioRequest startingStackBb must be from 10 through 500');
  }
  if (request.stackBucket !== trainingStackBucket(request.startingStackBb)) {
    throw new RangeError('TrainingScenarioRequest stackBucket does not match startingStackBb');
  }
  requireEnum(request.street, STREET_VALUES, 'TrainingScenarioRequest street');
  requireEnum(
    request.targetDecisionType,
    TARGET_VALUES,
    'TrainingScenarioRequest targetDecisionType',
  );
  if (!targetSupportsStreet(request.targetDecisionType, request.street)) {
    throw new RangeError('TrainingScenarioRequest targetDecisionType does not support street');
  }
  if (request.facingCategory !== TARGET_FACING_CATEGORY[request.targetDecisionType]) {
    throw new RangeError('TrainingScenarioRequest facingCategory does not match targetDecisionType');
  }
  const sizingApplies = trainingSizingFamilyAppliesToTarget(
    request.street,
    request.targetDecisionType,
  );
  if (sizingApplies) {
    if (request.requestedSizingFamily === null) {
      if (request.mode !== TRAINING_PRACTICE_MODES.FOCUSED) {
        throw new RangeError('Varied TrainingScenarioRequest requires a sizing family');
      }
    } else {
      validateTrainingSizingFamily(request.requestedSizingFamily);
      const streetFamilies = request.street === STREETS.PREFLOP
        ? TRAINING_PREFLOP_SIZING_FAMILIES
        : TRAINING_POSTFLOP_SIZING_FAMILIES;
      if (!streetFamilies.includes(request.requestedSizingFamily)) {
        throw new RangeError('TrainingScenarioRequest sizing family does not support street');
      }
    }
  } else if (request.requestedSizingFamily !== null) {
    throw new RangeError('TrainingScenarioRequest sizing family requires a facing-size target');
  }
  requireEnum(request.difficulty, DIFFICULTY_VALUES, 'TrainingScenarioRequest difficulty');
  requireNonEmptyString(request.rulesSemanticFingerprint, 'rulesSemanticFingerprint');
  if (request.plannerPolicyVersion !== TRAINING_PRACTICE_PLANNER_POLICY_VERSION) {
    throw new TypeError(`Expected ${TRAINING_PRACTICE_PLANNER_POLICY_VERSION}`);
  }
  validateRequestPlanning(request.planning);
  return request;
}

export function createTrainingScenarioRequest(input) {
  const request = cloneData(input);
  validateTrainingScenarioRequest(request);
  const frozen = deepFreeze(request);
  CREATED_REQUESTS.add(frozen);
  return frozen;
}

function counterKeyIsValid(coverageKey, key) {
  if (coverageKey === 'streets') return STREET_VALUES.includes(key);
  if (coverageKey === 'targetDecisionTypes') return TARGET_VALUES.includes(key);
  if (coverageKey === 'tableSizes') return /^[2-9]$|^10$/.test(key);
  if (coverageKey === 'heroPositions') return POSITION_VALUES.includes(key);
  if (coverageKey === 'stackBuckets') return STACK_BUCKET_VALUES.includes(key);
  if (coverageKey === 'facingCategories') return FACING_CATEGORY_VALUES.includes(key);
  if (coverageKey === 'sizingFamilies') return key === 'none' || SIZING_FAMILY_VALUES.includes(key);
  if (coverageKey === 'tableSizeHeroPositions') {
    const separator = key.indexOf(':');
    if (separator < 0) return false;
    const tableSize = Number(key.slice(0, separator));
    const position = key.slice(separator + 1);
    return Number.isInteger(tableSize)
      && POSITIONS_BY_TABLE_SIZE[tableSize]?.includes(position) === true;
  }
  if (coverageKey === 'streetTargetDecisionTypes') {
    const separator = key.indexOf(':');
    if (separator < 0) return false;
    const street = key.slice(0, separator);
    const target = key.slice(separator + 1);
    return STREET_VALUES.includes(street)
      && TARGET_VALUES.includes(target)
      && targetSupportsStreet(target, street);
  }
  return false;
}

function validateCoverageCounters(coverage, servedCount) {
  requireExactKeys(coverage, COVERAGE_KEYS, 'Training planner coverage');
  for (const coverageKey of COVERAGE_KEYS) {
    const entries = coverage[coverageKey];
    if (!Array.isArray(entries)) throw new TypeError(`coverage.${coverageKey} must be an array`);
    let previous = null;
    let total = 0;
    for (const [index, entry] of entries.entries()) {
      requireExactKeys(entry, COUNTER_ENTRY_KEYS, `coverage.${coverageKey}[${index}]`);
      requireNonEmptyString(entry.key, `coverage.${coverageKey}[${index}].key`);
      if (!counterKeyIsValid(coverageKey, entry.key)) {
        throw new RangeError(`Unsupported coverage.${coverageKey} key: ${entry.key}`);
      }
      if (previous !== null && compareStrings(previous, entry.key) >= 0) {
        throw new RangeError(`coverage.${coverageKey} keys must be unique and sorted`);
      }
      requireSafeInteger(entry.count, 1, Number.MAX_SAFE_INTEGER, 'coverage count');
      previous = entry.key;
      total += entry.count;
    }
    if (total !== servedCount) {
      throw new RangeError(`coverage.${coverageKey} must total servedCount`);
    }
  }
}

function validateRecentStructuralRecord(record, index) {
  requireExactKeys(record, RECENT_RECORD_KEYS, `recentStructuralRecords[${index}]`);
  if (!record.exactFingerprint.startsWith(EXACT_FINGERPRINT_PREFIX)) {
    throw new TypeError('recent exact fingerprint is invalid');
  }
  if (!record.structuralFingerprint.startsWith(STRUCTURAL_FINGERPRINT_PREFIX)) {
    throw new TypeError('recent structural fingerprint is invalid');
  }
  requireNonEmptyString(record.targetFamily, 'recent targetFamily');
  requireEnum(record.heroPosition, POSITION_VALUES, 'recent heroPosition');
  requireSafeInteger(record.tableSize, 2, 10, 'recent tableSize');
  if (!POSITIONS_BY_TABLE_SIZE[record.tableSize].includes(record.heroPosition)) {
    throw new RangeError('recent heroPosition does not belong to tableSize');
  }
  requireEnum(record.stackBucket, STACK_BUCKET_VALUES, 'recent stackBucket');
  requireEnum(record.street, STREET_VALUES, 'recent street');
  requireEnum(record.targetDecisionType, TARGET_VALUES, 'recent targetDecisionType');
  requireEnum(record.facingCategory, FACING_CATEGORY_VALUES, 'recent facingCategory');
  if (record.sizingFamily !== null) {
    validateTrainingSizingFamily(record.sizingFamily);
  }
}

export function validateTrainingPracticePlannerState(state) {
  if (CREATED_STATES.has(state)) return state;
  requireExactKeys(state, STATE_KEYS, 'TrainingPracticePlanner state');
  if (state.schemaVersion !== TRAINING_PRACTICE_PLANNER_STATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${TRAINING_PRACTICE_PLANNER_STATE_SCHEMA_VERSION}`);
  }
  if (!state.sessionIntentFingerprint.startsWith(INTENT_FINGERPRINT_PREFIX)) {
    throw new TypeError('Training planner state sessionIntentFingerprint is invalid');
  }
  if (state.plannerPolicyVersion !== TRAINING_PRACTICE_PLANNER_POLICY_VERSION) {
    throw new TypeError(`Expected ${TRAINING_PRACTICE_PLANNER_POLICY_VERSION}`);
  }
  requireSafeInteger(state.servedCount, 0, Number.MAX_SAFE_INTEGER, 'servedCount');
  requireSafeInteger(state.relaxationCount, 0, state.servedCount, 'relaxationCount');
  validateCoverageCounters(state.coverage, state.servedCount);
  if (!Array.isArray(state.recentStructuralRecords)
    || state.recentStructuralRecords.length
      > TRAINING_PLANNER_HISTORY_LIMITS.recentStructuralRecords
    || state.recentStructuralRecords.length > state.servedCount) {
    throw new RangeError('recentStructuralRecords exceeds its bounded history');
  }
  state.recentStructuralRecords.forEach(validateRecentStructuralRecord);
  if (!Array.isArray(state.recentExactFingerprints)
    || state.recentExactFingerprints.length
      > TRAINING_PLANNER_HISTORY_LIMITS.recentExactFingerprints
    || state.recentExactFingerprints.length > state.servedCount) {
    throw new RangeError('recentExactFingerprints exceeds its bounded history');
  }
  state.recentExactFingerprints.forEach((fingerprint, index) => {
    if (typeof fingerprint !== 'string' || !fingerprint.startsWith(EXACT_FINGERPRINT_PREFIX)) {
      throw new TypeError(`recentExactFingerprints[${index}] is invalid`);
    }
  });
  return state;
}

function emptyCoverage() {
  return Object.fromEntries(COVERAGE_KEYS.map((key) => [key, []]));
}

export function createTrainingPracticePlannerState(intent) {
  validateTrainingSessionIntent(intent);
  const state = deepFreeze({
    schemaVersion: TRAINING_PRACTICE_PLANNER_STATE_SCHEMA_VERSION,
    sessionIntentFingerprint: intentFingerprintValue(intent),
    plannerPolicyVersion: intent.plannerPolicyVersion,
    servedCount: 0,
    relaxationCount: 0,
    coverage: emptyCoverage(),
    recentStructuralRecords: [],
    recentExactFingerprints: [],
  });
  CREATED_STATES.add(state);
  return state;
}

export function restoreTrainingPracticePlannerState(input) {
  const state = cloneData(input);
  validateTrainingPracticePlannerState(state);
  const frozen = deepFreeze(state);
  CREATED_STATES.add(frozen);
  return frozen;
}

function scenarioIdentityParts(scenario) {
  return {
    rulesIdentity: scenario.rulesIdentityKey ?? digest64(requireNonEmptyString(
      scenario.rulesSemanticFingerprint,
      'rulesSemanticFingerprint',
    )),
    tableSize: scenario.tableSize,
    heroPosition: scenario.heroPosition,
    startingStackBb: scenario.startingStackBb,
    stackBucket: scenario.stackBucket ?? trainingStackBucket(scenario.startingStackBb),
    street: scenario.street,
    targetDecisionType: scenario.targetDecisionType,
    facingCategory: scenario.facingCategory
      ?? TARGET_FACING_CATEGORY[scenario.targetDecisionType],
    requestedSizingFamily: scenario.requestedSizingFamily ?? null,
  };
}

function exactIdentitySerialization(scenario) {
  const parts = scenarioIdentityParts(scenario);
  return [
    `rules:${parts.rulesIdentity}`,
    `table:${parts.tableSize}`,
    `position:${parts.heroPosition}`,
    `stack:${parts.startingStackBb}`,
    `street:${parts.street}`,
    `target:${parts.targetDecisionType}`,
    `facing:${parts.facingCategory}`,
    `sizing:${parts.requestedSizingFamily ?? 'none'}`,
  ].join('|');
}

function structuralIdentitySerialization(scenario) {
  const parts = scenarioIdentityParts(scenario);
  return [
    `rules:${parts.rulesIdentity}`,
    `table-family:${trainingTableSizeFamily(parts.tableSize)}`,
    `position-group:${trainingPositionGroup(parts.heroPosition)}`,
    `stack-bucket:${parts.stackBucket}`,
    `street:${parts.street}`,
    `target:${parts.targetDecisionType}`,
    `facing:${parts.facingCategory}`,
    `sizing:${parts.requestedSizingFamily ?? 'none'}`,
  ].join('|');
}

export function trainingScenarioExactFingerprint(scenario) {
  return `${EXACT_FINGERPRINT_PREFIX}${exactIdentitySerialization(scenario)}`;
}

export function trainingScenarioStructuralFingerprint(scenario) {
  return `${STRUCTURAL_FINGERPRINT_PREFIX}${structuralIdentitySerialization(scenario)}`;
}

function targetFamily(targetDecisionType) {
  if (targetDecisionType === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED
    || targetDecisionType === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION) {
    return 'preflop_first_decision';
  }
  if (PREFLOP_TARGETS.has(targetDecisionType)) return 'preflop_facing_aggression';
  if (targetDecisionType === TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION) {
    return 'postflop_proactive';
  }
  return 'postflop_facing_aggression';
}

function recentRecordForScenario(scenario) {
  const normalizedScenario = scenario.rulesIdentityKey
    ? scenario
    : {
        ...scenario,
        rulesIdentityKey: digest64(requireNonEmptyString(
          scenario.rulesSemanticFingerprint,
          'rulesSemanticFingerprint',
        )),
      };
  return {
    exactFingerprint: trainingScenarioExactFingerprint(normalizedScenario),
    structuralFingerprint: trainingScenarioStructuralFingerprint(normalizedScenario),
    targetFamily: targetFamily(scenario.targetDecisionType),
    heroPosition: scenario.heroPosition,
    tableSize: scenario.tableSize,
    stackBucket: scenario.stackBucket ?? trainingStackBucket(scenario.startingStackBb),
    street: scenario.street,
    targetDecisionType: scenario.targetDecisionType,
    facingCategory: scenario.facingCategory ?? TARGET_FACING_CATEGORY[scenario.targetDecisionType],
    sizingFamily: scenario.realizedSizingFamily
      ?? scenario.requestedSizingFamily
      ?? null,
  };
}

function addPenalty(map, key, value) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function createRecencyIndex(state) {
  const index = {
    exact: new Map(),
    structural: new Map(),
    targetFamily: new Map(),
    heroPosition: new Map(),
    tableSize: new Map(),
    stackBucket: new Map(),
    sizingFamily: new Map(),
  };
  state.recentExactFingerprints.forEach((fingerprint, fingerprintIndex) => {
    const recencyWeight = fingerprintIndex + 1;
    addPenalty(index.exact, fingerprint, 800 * recencyWeight);
  });
  const records = state.recentStructuralRecords;
  records.forEach((record, recordIndex) => {
    const recencyWeight = recordIndex + 1;
    addPenalty(index.structural, record.structuralFingerprint, 300 * recencyWeight);
    addPenalty(index.targetFamily, record.targetFamily, 70 * recencyWeight);
    addPenalty(index.heroPosition, record.heroPosition, 30 * recencyWeight);
    addPenalty(index.tableSize, String(record.tableSize), 20 * recencyWeight);
    addPenalty(index.stackBucket, record.stackBucket, 20 * recencyWeight);
    addPenalty(index.sizingFamily, record.sizingFamily ?? 'none', 60 * recencyWeight);
  });
  return index;
}

function recencyPenaltyForRecord(index, record) {
  return (index.exact.get(record.exactFingerprint) ?? 0)
    + (index.structural.get(record.structuralFingerprint) ?? 0)
    + (index.targetFamily.get(record.targetFamily) ?? 0)
    + (index.heroPosition.get(record.heroPosition) ?? 0)
    + (index.tableSize.get(String(record.tableSize)) ?? 0)
    + (index.stackBucket.get(record.stackBucket) ?? 0)
    + (index.sizingFamily.get(record.sizingFamily ?? 'none') ?? 0);
}

export function calculateTrainingPracticeRecencyPenalty(state, scenario) {
  validateTrainingPracticePlannerState(state);
  return recencyPenaltyForRecord(createRecencyIndex(state), recentRecordForScenario(scenario));
}

function coverageKeyValues(scenario) {
  return {
    streets: scenario.street,
    targetDecisionTypes: scenario.targetDecisionType,
    tableSizes: String(scenario.tableSize),
    heroPositions: scenario.heroPosition,
    stackBuckets: scenario.stackBucket,
    facingCategories: scenario.facingCategory,
    sizingFamilies: scenario.realizedSizingFamily
      ?? scenario.requestedSizingFamily
      ?? 'none',
    tableSizeHeroPositions: `${scenario.tableSize}:${scenario.heroPosition}`,
    streetTargetDecisionTypes: `${scenario.street}:${scenario.targetDecisionType}`,
  };
}

function incrementCounterEntries(entries, key) {
  const counters = new Map(entries.map((entry) => [entry.key, entry.count]));
  counters.set(key, (counters.get(key) ?? 0) + 1);
  return [...counters.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([entryKey, count]) => ({ key: entryKey, count }));
}

export function recordServedTrainingScenario(state, request, realization = {}) {
  validateTrainingPracticePlannerState(state);
  validateTrainingScenarioRequest(request);
  if (state.sessionIntentFingerprint !== request.sessionIntentFingerprint) {
    throw new RangeError('TrainingScenarioRequest does not belong to this planner state');
  }
  const realizedSizingFamily = Object.hasOwn(realization, 'realizedSizingFamily')
    ? realization.realizedSizingFamily
    : request.requestedSizingFamily;
  if (realizedSizingFamily !== request.requestedSizingFamily) {
    throw new RangeError('Served Training sizing family must match the requested family');
  }
  const realizedRequest = { ...request, realizedSizingFamily };
  const keys = coverageKeyValues(realizedRequest);
  const record = recentRecordForScenario(realizedRequest);
  const coverage = Object.fromEntries(COVERAGE_KEYS.map((coverageKey) => [
    coverageKey,
    incrementCounterEntries(state.coverage[coverageKey], keys[coverageKey]),
  ]));
  const next = {
    schemaVersion: state.schemaVersion,
    sessionIntentFingerprint: state.sessionIntentFingerprint,
    plannerPolicyVersion: state.plannerPolicyVersion,
    servedCount: state.servedCount + 1,
    relaxationCount: state.relaxationCount + (request.planning.relaxations.length > 0 ? 1 : 0),
    coverage,
    recentStructuralRecords: [...state.recentStructuralRecords, record]
      .slice(-TRAINING_PLANNER_HISTORY_LIMITS.recentStructuralRecords),
    recentExactFingerprints: [
      ...state.recentExactFingerprints,
      record.exactFingerprint,
    ].slice(-TRAINING_PLANNER_HISTORY_LIMITS.recentExactFingerprints),
  };
  const frozen = deepFreeze(next);
  CREATED_STATES.add(frozen);
  return frozen;
}

function tableSizesForVariedIntent(intent) {
  const { minimumSeated, maximumSeated } = intent.rulesSnapshot.definition.tableSize;
  const allowedFamilies = new Set(intent.focusPreferences.allowedTableSizeFamilies);
  return Array.from({ length: maximumSeated - minimumSeated + 1 }, (_, index) => (
    minimumSeated + index
  )).filter((tableSize) => allowedFamilies.has(trainingTableSizeFamily(tableSize)));
}

function stackAnchorsForVariedIntent(intent) {
  const preference = intent.focusPreferences.stackPreference;
  if (preference === TRAINING_STACK_PREFERENCES.SHORT) {
    return TRAINING_PLANNER_STACK_ANCHORS_BB.filter((stack) => stack <= 40);
  }
  if (preference === TRAINING_STACK_PREFERENCES.STANDARD) {
    return TRAINING_PLANNER_STACK_ANCHORS_BB.filter((stack) => stack >= 50 && stack <= 150);
  }
  if (preference === TRAINING_STACK_PREFERENCES.DEEP) {
    return TRAINING_PLANNER_STACK_ANCHORS_BB.filter((stack) => stack >= 200);
  }
  return [...TRAINING_PLANNER_STACK_ANCHORS_BB];
}

function streetTargetPairsForVariedIntent(intent) {
  const streets = intent.focusPreferences.streetEmphasis === null
    ? STREET_VALUES
    : [intent.focusPreferences.streetEmphasis];
  return streets.flatMap((street) => TARGET_VALUES
    .filter((targetDecisionType) => targetSupportsStreet(targetDecisionType, street))
    .map((targetDecisionType) => ({
      street,
      targetDecisionType,
      facingCategory: TARGET_FACING_CATEGORY[targetDecisionType],
    })));
}

function createWeightMap(entries) {
  const weights = new Map();
  for (const [key, weight] of entries) weights.set(key, Math.max(weights.get(key) ?? 0, weight));
  return weights;
}

function sumWeights(weights) {
  return [...weights.values()].reduce((sum, value) => sum + value, 0);
}

function deriveVariedEligibility(intent) {
  if (Object.isFrozen(intent) && DERIVED_INTENT_CACHE.has(intent)) {
    return DERIVED_INTENT_CACHE.get(intent);
  }
  const tableSizes = tableSizesForVariedIntent(intent);
  const tablePositionPairs = tableSizes.flatMap((tableSize) => (
    POSITIONS_BY_TABLE_SIZE[tableSize].map((heroPosition) => ({ tableSize, heroPosition }))
  ));
  const stackAnchors = stackAnchorsForVariedIntent(intent);
  const streetTargets = streetTargetPairsForVariedIntent(intent);
  const compatibleTablePositionsByTarget = new Map();
  let eligibleStructuralPairCount = 0;
  for (const streetTarget of streetTargets) {
    const key = `${streetTarget.street}:${streetTarget.targetDecisionType}`;
    const compatible = tablePositionPairs.filter(
      (tablePosition) => structuralCompatibilityReason(tablePosition, streetTarget) === null,
    );
    compatibleTablePositionsByTarget.set(key, compatible);
    eligibleStructuralPairCount += compatible.length;
  }
  const possibleStructuralPairCount = tablePositionPairs.length * streetTargets.length;
  const streetWeights = STREET_CURRICULUM_WEIGHTS[intent.focusPreferences.profile];
  const sizingStructuresByFamily = new Map();
  const addSizingStructure = (family, structure) => {
    const key = family ?? 'none';
    if (!sizingStructuresByFamily.has(key)) sizingStructuresByFamily.set(key, []);
    sizingStructuresByFamily.get(key).push(structure);
  };
  for (const streetTarget of streetTargets) {
    for (const stack of stackAnchors) {
      const compatibleTablePositions = compatibleTablePositionsByTarget.get(
        `${streetTarget.street}:${streetTarget.targetDecisionType}`,
      ) ?? [];
      if (!trainingSizingFamilyAppliesToTarget(
        streetTarget.street,
        streetTarget.targetDecisionType,
      )) {
        addSizingStructure(null, {
          streetTarget,
          stack,
          tablePositions: compatibleTablePositions,
        });
        continue;
      }
      const tablePositionsByFamily = new Map();
      for (const tablePosition of compatibleTablePositions) {
        const families = trainingSizingFamiliesForStructure({
          street: streetTarget.street,
          targetDecisionType: streetTarget.targetDecisionType,
          startingStackBb: stack,
          tableSize: tablePosition.tableSize,
          chipUnitMilliBb: intent.rulesSnapshot.definition.blinds.chipUnitMilliBb,
        });
        for (const family of families) {
          if (!tablePositionsByFamily.has(family)) tablePositionsByFamily.set(family, []);
          tablePositionsByFamily.get(family).push(tablePosition);
        }
      }
      for (const [family, compatible] of tablePositionsByFamily) {
        addSizingStructure(family, {
          streetTarget,
          stack,
          tablePositions: compatible,
        });
      }
    }
  }
  const sizingFamilies = [
    null,
    ...SIZING_FAMILY_VALUES,
  ].filter((family) => sizingStructuresByFamily.has(family ?? 'none'));
  const coverageWeights = {
    streets: createWeightMap(streetTargets.map((entry) => [
      entry.street,
      streetWeights[entry.street],
    ])),
    targetDecisionTypes: createWeightMap(streetTargets.map((entry) => [
      entry.targetDecisionType,
      TARGET_CURRICULUM_WEIGHTS[entry.targetDecisionType],
    ])),
    tableSizes: createWeightMap(tableSizes.map((tableSize) => [String(tableSize), 1])),
    heroPositions: createWeightMap(tablePositionPairs.map((entry) => [entry.heroPosition, 1])),
    stackBuckets: createWeightMap(stackAnchors.map((stack) => [trainingStackBucket(stack), 1])),
    facingCategories: createWeightMap(streetTargets.map((entry) => [entry.facingCategory, 1])),
    sizingFamilies: createWeightMap(sizingFamilies.map((family) => [family ?? 'none', 1])),
    tableSizeHeroPositions: createWeightMap(tablePositionPairs.map((entry) => [
      `${entry.tableSize}:${entry.heroPosition}`,
      1,
    ])),
    streetTargetDecisionTypes: createWeightMap(streetTargets.map((entry) => [
      `${entry.street}:${entry.targetDecisionType}`,
      streetWeights[entry.street] * TARGET_CURRICULUM_WEIGHTS[entry.targetDecisionType],
    ])),
  };
  const derived = deepFreeze({
    tableSizes,
    tablePositionPairs,
    stackAnchors,
    streetTargets,
    compatibleTablePositionsByTarget,
    sizingFamilies,
    sizingStructuresByFamily,
    coverageWeights,
    coverageWeightTotals: Object.fromEntries(COVERAGE_KEYS.map((key) => [
      key,
      sumWeights(coverageWeights[key]),
    ])),
    eligibleStructuralPairCount,
    excludedStructuralPairCount: possibleStructuralPairCount - eligibleStructuralPairCount,
    rulesIdentityKey: digest64(intent.rulesSnapshot.semanticFingerprint),
  });
  if (Object.isFrozen(intent)) DERIVED_INTENT_CACHE.set(intent, derived);
  return derived;
}

function stableChoice(values, intent, sessionOrdinal, candidateKey, stream) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const mixed = mixTrainingPlannerSeed(
    intent.sessionSeed,
    sessionOrdinal,
    candidateKey,
    `${intent.plannerPolicyVersion}:${stream}`,
  );
  return values[mixed % values.length];
}

function candidateKey(candidate, rulesIdentityKey) {
  return [
    rulesIdentityKey,
    candidate.tableSize,
    candidate.heroPosition,
    candidate.startingStackBb,
    candidate.street,
    candidate.targetDecisionType,
    candidate.requestedSizingFamily ?? 'none',
  ].join('|');
}

function staticRetryRisk(candidate) {
  let risk = 0;
  if (candidate.targetDecisionType
    === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET) {
    if (candidate.startingStackBb <= 20) risk += 800;
    else if (candidate.startingStackBb <= 40) risk += 250;
    if (candidate.tableSize === 2) risk += 100;
  }
  if (candidate.targetDecisionType
    === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET
    && candidate.startingStackBb <= 15) risk += 350;
  if (candidate.targetDecisionType
    === TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE
    && candidate.startingStackBb <= 20) risk += 300;
  return risk;
}

function completeCandidate(
  tablePosition,
  streetTarget,
  startingStackBb,
  requestedSizingFamily,
  eligibility,
  rulesSemanticFingerprint,
) {
  const candidate = {
    tableSize: tablePosition.tableSize,
    heroPosition: tablePosition.heroPosition,
    startingStackBb,
    stackBucket: trainingStackBucket(startingStackBb),
    street: streetTarget.street,
    targetDecisionType: streetTarget.targetDecisionType,
    facingCategory: streetTarget.facingCategory,
    requestedSizingFamily,
    rulesSemanticFingerprint,
    rulesIdentityKey: eligibility.rulesIdentityKey,
  };
  candidate.key = candidateKey(candidate, eligibility.rulesIdentityKey);
  candidate.exactFingerprint = trainingScenarioExactFingerprint(candidate);
  candidate.structuralFingerprint = trainingScenarioStructuralFingerprint(candidate);
  candidate.targetFamily = targetFamily(candidate.targetDecisionType);
  candidate.staticRetryRisk = staticRetryRisk(candidate);
  return candidate;
}

function proposalPool(intent, sessionOrdinal, eligibility) {
  const proposals = new Map();
  const add = (tablePosition, streetTarget, stack, requestedSizingFamily = undefined) => {
    if (!tablePosition || !streetTarget || stack === null) return;
    if (structuralCompatibilityReason(tablePosition, streetTarget) !== null) return;
    const availableSizingFamilies = trainingSizingFamilyAppliesToTarget(
      streetTarget.street,
      streetTarget.targetDecisionType,
    )
      ? trainingSizingFamiliesForStructure({
          street: streetTarget.street,
          targetDecisionType: streetTarget.targetDecisionType,
          startingStackBb: stack,
          tableSize: tablePosition.tableSize,
          chipUnitMilliBb: intent.rulesSnapshot.definition.blinds.chipUnitMilliBb,
        })
      : [null];
    if (availableSizingFamilies.length === 0) return;
    const sizingLabel = [
      tablePosition.tableSize,
      tablePosition.heroPosition,
      stack,
      streetTarget.street,
      streetTarget.targetDecisionType,
    ].join(':');
    const sizingFamily = requestedSizingFamily === undefined
      ? stableChoice(
          availableSizingFamilies,
          intent,
          sessionOrdinal,
          sizingLabel,
          'candidate-sizing-family',
        )
      : requestedSizingFamily;
    if (!availableSizingFamilies.includes(sizingFamily)) return;
    const candidate = completeCandidate(
      tablePosition,
      streetTarget,
      stack,
      sizingFamily,
      eligibility,
      intent.rulesSnapshot.semanticFingerprint,
    );
    proposals.set(candidate.key, candidate);
  };
  const targetKey = (entry) => `${entry.street}:${entry.targetDecisionType}`;

  eligibility.tablePositionPairs.forEach((tablePosition, index) => {
    const compatibleTargets = eligibility.streetTargets.filter((entry) => (
      structuralCompatibilityReason(tablePosition, entry) === null
    ));
    const label = `table-position:${tablePosition.tableSize}:${tablePosition.heroPosition}:${index}`;
    add(
      tablePosition,
      stableChoice(compatibleTargets, intent, sessionOrdinal, label, 'table-position-target'),
      stableChoice(eligibility.stackAnchors, intent, sessionOrdinal, label, 'table-position-stack'),
    );
  });

  eligibility.streetTargets.forEach((streetTarget, index) => {
    const label = `street-target:${targetKey(streetTarget)}:${index}`;
    add(
      stableChoice(
        eligibility.compatibleTablePositionsByTarget.get(targetKey(streetTarget)),
        intent,
        sessionOrdinal,
        label,
        'street-target-table-position',
      ),
      streetTarget,
      stableChoice(eligibility.stackAnchors, intent, sessionOrdinal, label, 'street-target-stack'),
    );
  });

  eligibility.stackAnchors.forEach((stack, index) => {
    const label = `stack:${stack}:${index}`;
    const streetTarget = stableChoice(
      eligibility.streetTargets,
      intent,
      sessionOrdinal,
      label,
      'stack-street-target',
    );
    add(
      stableChoice(
        eligibility.compatibleTablePositionsByTarget.get(targetKey(streetTarget)) ?? [],
        intent,
        sessionOrdinal,
        label,
        'stack-table-position',
      ),
      streetTarget,
      stack,
    );
  });

  eligibility.sizingFamilies.forEach((sizingFamily, index) => {
    const label = `sizing-family:${sizingFamily ?? 'none'}:${index}`;
    const compatibleStructures = eligibility.sizingStructuresByFamily.get(
      sizingFamily ?? 'none',
    ) ?? [];
    const structure = stableChoice(
      compatibleStructures,
      intent,
      sessionOrdinal,
      label,
      'sizing-family-structure',
    );
    if (!structure) return;
    add(
      stableChoice(
        structure.tablePositions,
        intent,
        sessionOrdinal,
        label,
        'sizing-family-table-position',
      ),
      structure.streetTarget,
      structure.stack,
      sizingFamily,
    );
  });

  for (let index = 0; index < GENERAL_PROPOSAL_COUNT; index += 1) {
    const label = `general:${index}`;
    const streetTarget = stableChoice(
      eligibility.streetTargets,
      intent,
      sessionOrdinal,
      label,
      'general-street-target',
    );
    add(
      stableChoice(
        eligibility.compatibleTablePositionsByTarget.get(targetKey(streetTarget)) ?? [],
        intent,
        sessionOrdinal,
        label,
        'general-table-position',
      ),
      streetTarget,
      stableChoice(eligibility.stackAnchors, intent, sessionOrdinal, label, 'general-stack'),
    );
  }
  return [...proposals.values()];
}

function coverageMaps(state) {
  return Object.fromEntries(COVERAGE_KEYS.map((key) => [
    key,
    new Map(state.coverage[key].map((entry) => [entry.key, entry.count])),
  ]));
}

function weightedCoverageDeficit(candidate, state, eligibility, maps) {
  const keys = coverageKeyValues(candidate);
  let score = 0;
  for (const coverageKey of COVERAGE_KEYS) {
    const key = keys[coverageKey];
    const categoryWeight = eligibility.coverageWeights[coverageKey].get(key);
    const totalWeight = eligibility.coverageWeightTotals[coverageKey];
    if (!(categoryWeight > 0) || !(totalWeight > 0)) continue;
    const currentCount = maps[coverageKey].get(key) ?? 0;
    const numerator = (state.servedCount + 1) * categoryWeight - currentCount * totalWeight;
    score += Math.trunc((numerator * 1000) / totalWeight)
      * COVERAGE_COMPONENT_WEIGHTS[coverageKey];
    if (currentCount === 0) {
      score += UNSERVED_COVERAGE_BONUS * COVERAGE_COMPONENT_WEIGHTS[coverageKey];
    }
  }
  return score;
}

function curriculumBase(candidate, intent) {
  const streetWeight = STREET_CURRICULUM_WEIGHTS[intent.focusPreferences.profile][candidate.street];
  const targetWeight = TARGET_CURRICULUM_WEIGHTS[candidate.targetDecisionType];
  return streetWeight * 20 + targetWeight * 10;
}

function compareScoredCandidates(left, right) {
  return right.score.total - left.score.total
    || right.score.tieBreaker - left.score.tieBreaker
    || compareStrings(left.key, right.key);
}

function scoreVariedCandidates(candidates, intent, state, eligibility, sessionOrdinal) {
  const maps = coverageMaps(state);
  const recencyIndex = createRecencyIndex(state);
  return candidates.map((candidate) => {
    const coverageDeficit = weightedCoverageDeficit(candidate, state, eligibility, maps);
    const base = curriculumBase(candidate, intent);
    const recencyPenalty = recencyPenaltyForRecord(recencyIndex, candidate);
    const futurePriority = 0;
    const total = coverageDeficit + base + futurePriority
      - recencyPenalty - candidate.staticRetryRisk;
    return {
      ...candidate,
      score: {
        coverageDeficit,
        curriculumBase: base,
        futurePriority,
        recencyPenalty,
        staticRetryRisk: candidate.staticRetryRisk,
        total,
        tieBreaker: mixTrainingPlannerSeed(
          intent.sessionSeed,
          sessionOrdinal,
          candidate.key,
          `${intent.plannerPolicyVersion}:tie-break`,
        ),
      },
    };
  });
}

function planningFailure(code, message, details = {}) {
  return deepFreeze({
    ok: false,
    error: {
      schemaVersion: TRAINING_PRACTICE_PLANNING_ERROR_SCHEMA_VERSION,
      code,
      message,
      details: cloneData(details),
    },
  });
}

function focusedImpossibilityReasons(intent) {
  const focus = intent.focusPreferences;
  const reasons = [];
  const tablePolicy = intent.rulesSnapshot.definition.tableSize;
  if (focus.tableSize < tablePolicy.minimumSeated
    || focus.tableSize > tablePolicy.maximumSeated) reasons.push('table_size_outside_rules_policy');
  if (!POSITIONS_BY_TABLE_SIZE[focus.tableSize].includes(focus.heroPosition)) {
    reasons.push('hero_position_not_legal_for_table_size');
  }
  if (!targetSupportsStreet(focus.targetDecisionType, focus.street)) {
    reasons.push('target_does_not_support_street');
  } else if (POSITIONS_BY_TABLE_SIZE[focus.tableSize].includes(focus.heroPosition)) {
    const structuralReason = structuralCompatibilityReason(
      { tableSize: focus.tableSize, heroPosition: focus.heroPosition },
      { street: focus.street, targetDecisionType: focus.targetDecisionType },
    );
    if (structuralReason !== null) reasons.push(structuralReason);
  }
  if (focus.startingStackBb < 10 || focus.startingStackBb > 500) {
    reasons.push('stack_outside_generator_boundary');
  } else {
    const milliBb = focus.startingStackBb * 1000;
    const chipUnit = intent.rulesSnapshot.definition.blinds.chipUnitMilliBb;
    if (!Number.isSafeInteger(milliBb) || milliBb % chipUnit !== 0) {
      reasons.push('stack_not_aligned_to_rules_chip_unit');
    }
  }
  const sizingApplies = trainingSizingFamilyAppliesToTarget(
    focus.street,
    focus.targetDecisionType,
  );
  if (!sizingApplies && focus.requestedSizingFamily !== null) {
    reasons.push('sizing_family_requires_facing_target');
  } else if (sizingApplies && focus.requestedSizingFamily !== null
    && focus.startingStackBb >= 10 && focus.startingStackBb <= 500) {
    const eligible = trainingSizingFamiliesForStructure({
      street: focus.street,
      targetDecisionType: focus.targetDecisionType,
      startingStackBb: focus.startingStackBb,
      tableSize: focus.tableSize,
      chipUnitMilliBb: intent.rulesSnapshot.definition.blinds.chipUnitMilliBb,
    });
    if (!eligible.includes(focus.requestedSizingFamily)) {
      reasons.push('sizing_family_not_distinct_or_structurally_eligible');
    }
  }
  return [...new Set(reasons)].sort(compareStrings);
}

function focusedPlan(intent, state, sessionOrdinal) {
  const reasons = focusedImpossibilityReasons(intent);
  if (reasons.length > 0) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.IMPOSSIBLE_FOCUSED_REQUEST,
      'Focused Training constraints cannot be planned exactly.',
      { reasons },
    );
  }
  const focus = intent.focusPreferences;
  const candidate = {
    tableSize: focus.tableSize,
    heroPosition: focus.heroPosition,
    startingStackBb: focus.startingStackBb,
    stackBucket: trainingStackBucket(focus.startingStackBb),
    street: focus.street,
    targetDecisionType: focus.targetDecisionType,
    facingCategory: TARGET_FACING_CATEGORY[focus.targetDecisionType],
    requestedSizingFamily: focus.requestedSizingFamily,
    rulesSemanticFingerprint: intent.rulesSnapshot.semanticFingerprint,
  };
  const compactKey = candidateKey(candidate, digest64(intent.rulesSnapshot.semanticFingerprint));
  const tieBreaker = mixTrainingPlannerSeed(
    intent.sessionSeed,
    sessionOrdinal,
    compactKey,
    `${intent.plannerPolicyVersion}:tie-break`,
  );
  const request = createTrainingScenarioRequest({
    schemaVersion: TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION,
    sessionIntentFingerprint: state.sessionIntentFingerprint,
    mode: intent.mode,
    sessionOrdinal,
    exerciseSeed: mixTrainingPlannerSeed(
      intent.sessionSeed,
      sessionOrdinal,
      compactKey,
      `${intent.plannerPolicyVersion}:exercise-seed`,
    ),
    ...candidate,
    difficulty: intent.difficulty,
    plannerPolicyVersion: intent.plannerPolicyVersion,
    planning: {
      reasonCodes: ['focused_exact_constraints'],
      relaxations: [],
      candidatePoolSize: 1,
      eligibleStructuralPairCount: 1,
      excludedStructuralPairCount: 0,
      score: {
        coverageDeficit: 0,
        curriculumBase: 0,
        futurePriority: 0,
        recencyPenalty: 0,
        staticRetryRisk: staticRetryRisk(candidate),
        total: -staticRetryRisk(candidate),
        tieBreaker,
      },
    },
  });
  return deepFreeze({ ok: true, request });
}

function variedPlan(intent, state, sessionOrdinal) {
  const eligibility = deriveVariedEligibility(intent);
  if (eligibility.tablePositionPairs.length === 0
    || eligibility.stackAnchors.length === 0
    || eligibility.streetTargets.length === 0
    || eligibility.eligibleStructuralPairCount === 0) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.NO_ELIGIBLE_CANDIDATES,
      'No Training candidates satisfy the Varied Session intent and rules policy.',
      {
        tableSizeCount: eligibility.tableSizes.length,
        tablePositionCount: eligibility.tablePositionPairs.length,
        stackAnchorCount: eligibility.stackAnchors.length,
        streetTargetCount: eligibility.streetTargets.length,
      },
    );
  }
  let candidates = proposalPool(intent, sessionOrdinal, eligibility);
  if (candidates.length === 0) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.NO_ELIGIBLE_CANDIDATES,
      'The bounded planner proposal pool contains no eligible candidate.',
    );
  }

  const relaxations = [];
  const exactRecent = new Set(state.recentExactFingerprints);
  const nonExact = candidates.filter((candidate) => !exactRecent.has(candidate.exactFingerprint));
  if (nonExact.length > 0) candidates = nonExact;
  else if (candidates.some((candidate) => exactRecent.has(candidate.exactFingerprint))) {
    relaxations.push('exact_recency_pool_exhausted');
  }

  const structuralRecent = new Set(
    state.recentStructuralRecords.map((record) => record.structuralFingerprint),
  );
  const nonStructural = candidates.filter(
    (candidate) => !structuralRecent.has(candidate.structuralFingerprint),
  );
  // Structural repetition remains a strong score penalty, but it is not a
  // hard filter: a sufficiently under-covered exact table/position or target
  // may intentionally outrank a less useful novel structure.
  if (nonStructural.length === 0
    && candidates.some((candidate) => structuralRecent.has(candidate.structuralFingerprint))) {
    relaxations.push('structural_recency_pool_exhausted');
  }

  const scored = scoreVariedCandidates(candidates, intent, state, eligibility, sessionOrdinal)
    .sort(compareScoredCandidates);
  const selected = scored[0];
  const request = createTrainingScenarioRequest({
    schemaVersion: TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION,
    sessionIntentFingerprint: state.sessionIntentFingerprint,
    mode: intent.mode,
    sessionOrdinal,
    exerciseSeed: mixTrainingPlannerSeed(
      intent.sessionSeed,
      sessionOrdinal,
      selected.key,
      `${intent.plannerPolicyVersion}:exercise-seed`,
    ),
    tableSize: selected.tableSize,
    heroPosition: selected.heroPosition,
    startingStackBb: selected.startingStackBb,
    stackBucket: selected.stackBucket,
    street: selected.street,
    targetDecisionType: selected.targetDecisionType,
    facingCategory: selected.facingCategory,
    requestedSizingFamily: selected.requestedSizingFamily,
    difficulty: intent.difficulty,
    rulesSemanticFingerprint: intent.rulesSnapshot.semanticFingerprint,
    plannerPolicyVersion: intent.plannerPolicyVersion,
    planning: {
      reasonCodes: [
        'marginal_coverage_deficit',
        'riverline_study_curriculum',
        'bounded_recency_preference',
        'deterministic_tie_break',
      ],
      relaxations,
      candidatePoolSize: candidates.length,
      eligibleStructuralPairCount: eligibility.eligibleStructuralPairCount,
      excludedStructuralPairCount: eligibility.excludedStructuralPairCount,
      score: selected.score,
    },
  });
  return deepFreeze({ ok: true, request });
}

export function planTrainingScenario(intent, state, sessionOrdinal) {
  validateTrainingSessionIntent(intent);
  validateTrainingPracticePlannerState(state);
  requireSafeInteger(sessionOrdinal, 0, 0xffffffff, 'sessionOrdinal');
  const fingerprint = intentFingerprintValue(intent);
  if (state.sessionIntentFingerprint !== fingerprint) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.STATE_INTENT_MISMATCH,
      'Planner state belongs to a different TrainingSessionIntent.',
      {
        expected: fingerprint,
        received: state.sessionIntentFingerprint,
      },
    );
  }
  if (sessionOrdinal >= intent.sessionLength) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.SESSION_ORDINAL_OUT_OF_RANGE,
      'sessionOrdinal is outside the Training session length.',
      { sessionOrdinal, sessionLength: intent.sessionLength },
    );
  }
  if (!intent.rulesCapability.supported) {
    return planningFailure(
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.UNSUPPORTED_RULES,
      'Training planning does not support the supplied Game Rules.',
      {
        capability: intent.rulesCapability,
        rulesSemanticFingerprint: intent.rulesSnapshot.semanticFingerprint,
      },
    );
  }
  return intent.mode === TRAINING_PRACTICE_MODES.FOCUSED
    ? focusedPlan(intent, state, sessionOrdinal)
    : variedPlan(intent, state, sessionOrdinal);
}
