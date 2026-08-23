import {
  ACTION_TYPES,
  ANTE_TYPES,
  CARD_RANKS,
  CARD_SUITS,
  CHANCE_TYPES,
  GAME_RULES_COLLECTION_TYPES,
  GAME_MODES,
  PHASES,
  POSITIONS_BY_TABLE_SIZE,
  STREETS,
  applyAction,
  applyChance,
  bbToMilliBb,
  createAction,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  validateGameRulesSnapshot,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';
import { createSeededRandom } from './deterministic-random.mjs';
import { isStrategyResultV1 } from './strategy-result.mjs';
import {
  TRAINING_PLANNER_TARGET_DECISION_TYPES,
  createTrainingScenarioRequest,
} from './training-practice-planner.mjs';
import {
  TRAINING_SIZING_FAMILIES,
  TRAINING_SIZING_FAMILY_SCHEMA_VERSION,
  TRAINING_SIZING_POLICY_VERSION,
  realizeCanonicalTrainingSizing,
  trainingSizingFamiliesForStructure,
} from './training-sizing-policy.mjs';

export const TRAINING_CONFIG_V1_SCHEMA_VERSION = 'training-config/v1';
export const TRAINING_CONFIG_V2_SCHEMA_VERSION = 'training-config/v2';
// Compatibility aliases retain the historical v1 API for exact-seed replay.
export const TRAINING_CONFIG_SCHEMA_VERSION = TRAINING_CONFIG_V1_SCHEMA_VERSION;
export const TRAINING_CONFIG_SCHEMA_VERSIONS = Object.freeze([
  TRAINING_CONFIG_V1_SCHEMA_VERSION,
  TRAINING_CONFIG_V2_SCHEMA_VERSION,
]);
export const TRAINING_EXERCISE_V1_SCHEMA_VERSION = 'training-exercise/v1';
export const TRAINING_EXERCISE_V2_SCHEMA_VERSION = 'training-exercise/v2';
export const TRAINING_EXERCISE_SCHEMA_VERSION = TRAINING_EXERCISE_V1_SCHEMA_VERSION;
export const TRAINING_EXERCISE_SCHEMA_VERSIONS = Object.freeze([
  TRAINING_EXERCISE_V1_SCHEMA_VERSION,
  TRAINING_EXERCISE_V2_SCHEMA_VERSION,
]);
export const TRAINING_RULES_CAPABILITY_SCHEMA_VERSION = 'training-rules-capability/v1';
export const TRAINING_GENERATION_ERROR_SCHEMA_VERSION = 'training-generation-error/v1';
export const TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION =
  'training-scenario-request-adapter-policy/v2';
const TRAINING_SCENARIO_GENERATOR_POLICY_VERSION = 'bounded_legal_trajectory_v2';

export const TRAINING_GENERATION_ERROR_CODES = Object.freeze({
  INVALID_CONFIG: 'invalid_config',
  INVALID_SCENARIO_REQUEST: 'invalid_scenario_request',
  UNSUPPORTED_RULES: 'unsupported_rules',
  UNSUPPORTED_TARGET: 'unsupported_target',
  GENERATION_EXHAUSTED: 'generation_exhausted',
  DECISION_PROJECTION_UNAVAILABLE: 'decision_projection_unavailable',
  STRATEGY_UNAVAILABLE: 'strategy_unavailable',
  INTERNAL_ERROR: 'internal_error',
});

export const TRAINING_RULES_CAPABILITY_REASON_CODES = Object.freeze({
  INVALID_RULES_SNAPSHOT: 'invalid_rules_snapshot',
  TABLE_SIZE_MISMATCH: 'rules_table_size_mismatch',
  FIXED_COLLECTION_UNSUPPORTED: 'fixed_collection_training_unsupported',
});

export const TRAINING_DECISION_TYPES = Object.freeze({
  PREFLOP_UNOPENED: 'preflop_unopened',
  PREFLOP_FACING_OPEN: 'preflop_facing_open',
  PREFLOP_FACING_3BET: 'preflop_facing_3bet',
  PREFLOP_FACING_4BET: 'preflop_facing_4bet',
  PREFLOP_BB_OPTION: 'preflop_bb_option',
  POSTFLOP_FIRST_ACTION: 'postflop_first_action',
  POSTFLOP_FACING_BET: 'postflop_facing_bet',
  POSTFLOP_FACING_RAISE: 'postflop_facing_raise',
});

export const TRAINING_SCENARIO_REQUEST_TARGET_MAP = Object.freeze({
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED]:
    TRAINING_DECISION_TYPES.PREFLOP_UNOPENED,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN]:
    TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET]:
    TRAINING_DECISION_TYPES.PREFLOP_FACING_3BET,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET]:
    TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION]:
    TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION]:
    TRAINING_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET]:
    TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET,
  [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE]:
    TRAINING_DECISION_TYPES.POSTFLOP_FACING_RAISE,
});

const STREET_VALUES = Object.freeze(Object.values(STREETS));
const DECISION_TYPE_VALUES = Object.freeze(Object.values(TRAINING_DECISION_TYPES));
const DIFFICULTY_VALUES = Object.freeze(['hard', 'easy', 'guided']);
const PREFLOP_TARGETS = new Set([
  TRAINING_DECISION_TYPES.PREFLOP_UNOPENED,
  TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN,
  TRAINING_DECISION_TYPES.PREFLOP_FACING_3BET,
  TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET,
  TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION,
]);
const POSTFLOP_TARGETS = new Set([
  TRAINING_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
  TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET,
  TRAINING_DECISION_TYPES.POSTFLOP_FACING_RAISE,
]);
const MAX_GENERATION_ATTEMPTS = 64;
const MAX_TRAJECTORY_ACTIONS = 160;
const TRAINING_CONFIG_V2_KEYS = Object.freeze([
  'schemaVersion',
  'rulesSnapshot',
  'tableSize',
  'stackBb',
  'streets',
  'heroPositions',
  'allowedDecisionTypes',
  'difficulty',
  'seed',
]);
const FULL_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

class RetryGenerationError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'RetryGenerationError';
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function serializedError(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function failure(code, message, details = {}) {
  return deepFreeze({
    ok: false,
    error: {
      schemaVersion: TRAINING_GENERATION_ERROR_SCHEMA_VERSION,
      code,
      message,
      details: { ...details },
    },
  });
}

export function createSeededTrainingRandom(seed) {
  return createSeededRandom(seed);
}

class SizingFamilyRealizationError extends Error {
  constructor(reason, details = {}) {
    super(reason);
    this.name = 'SizingFamilyRealizationError';
    this.details = details;
  }
}

function avalancheTrainingSeed(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function deriveTrainingScenarioGenerationSeed(exerciseSeed, attempt, stream) {
  requireInteger(exerciseSeed, 0, 0xffffffff, 'exerciseSeed');
  requireInteger(attempt, 1, MAX_GENERATION_ATTEMPTS, 'attempt');
  if (typeof stream !== 'string' || !stream) {
    throw new TypeError('Training generation seed stream must be a non-empty string');
  }
  let hash = 0x811c9dc5;
  const serialized = [
    TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION,
    `seed:${exerciseSeed >>> 0}`,
    `attempt:${attempt}`,
    `stream:${stream}`,
  ].join('|');
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return avalancheTrainingSeed(hash);
}

function requireInteger(value, minimum, maximum, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return numeric;
}

function uniqueStrings(values, allowed, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError(`${label} must be a non-empty array`);
  }
  const normalized = [...new Set(values.map(String))];
  for (const value of normalized) {
    if (!allowed.includes(value)) throw new RangeError(`Unsupported ${label} value: ${value}`);
  }
  return normalized;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function targetSupportsStreet(target, street) {
  return street === STREETS.PREFLOP ? PREFLOP_TARGETS.has(target) : POSTFLOP_TARGETS.has(target);
}

export function createTrainingConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('TrainingConfig must be an object');
  }
  if (!TRAINING_CONFIG_SCHEMA_VERSIONS.includes(input.schemaVersion)) {
    throw new TypeError(`Unsupported TrainingConfig version: ${String(input.schemaVersion)}`);
  }
  const isV2 = input.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION;
  if (isV2) requireExactKeys(input, TRAINING_CONFIG_V2_KEYS, 'TrainingConfig v2');
  const tableSize = requireInteger(input.tableSize, 2, 10, 'tableSize');
  const rulesSnapshot = isV2 ? validateGameRulesSnapshot(input.rulesSnapshot) : null;
  if (rulesSnapshot !== null && rulesSnapshot.setup.seatedPlayers !== tableSize) {
    throw new RangeError('training-config/v2 tableSize must match GameRulesSnapshot setup');
  }
  const stackBb = Number(input.stackBb);
  if (!Number.isFinite(stackBb) || stackBb < 10 || stackBb > 500) {
    throw new RangeError('stackBb must be from 10 through 500');
  }
  const startingStackMilliBb = bbToMilliBb(stackBb, 'stackBb');
  const chipUnitMilliBb = rulesSnapshot?.definition.blinds.chipUnitMilliBb ?? 100;
  if (startingStackMilliBb % chipUnitMilliBb !== 0) {
    throw new RangeError('stackBb must align to the configured Game Rules chip unit');
  }
  const streets = uniqueStrings(input.streets, STREET_VALUES, 'streets');
  const positions = POSITIONS_BY_TABLE_SIZE[tableSize];
  const heroPositions = uniqueStrings(
    input.heroPositions?.length ? input.heroPositions : positions,
    positions,
    'heroPositions',
  );
  const allowedDecisionTypes = uniqueStrings(
    input.allowedDecisionTypes?.length
      ? input.allowedDecisionTypes
      : [
          TRAINING_DECISION_TYPES.PREFLOP_UNOPENED,
          TRAINING_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
        ],
    DECISION_TYPE_VALUES,
    'allowedDecisionTypes',
  );
  const gameMode = isV2 ? null : input.gameMode ?? GAME_MODES.HOME;
  if (!isV2 && gameMode !== GAME_MODES.HOME) {
    throw new RangeError('training-config/v1 currently supports Home mode only');
  }
  const difficulty = input.difficulty ?? 'hard';
  if (!DIFFICULTY_VALUES.includes(difficulty)) {
    throw new RangeError(`Unsupported difficulty: ${difficulty}`);
  }
  const seed = requireInteger(input.seed, 0, 0xffffffff, 'seed');
  return deepFreeze({
    schemaVersion: input.schemaVersion,
    tableSize,
    stackBb,
    streets,
    ...(isV2 ? { rulesSnapshot } : { gameMode }),
    heroPositions,
    allowedDecisionTypes,
    difficulty,
    seed: seed >>> 0,
  });
}

function rulesCapability({
  supported,
  reasonCode = null,
  canonicalHandSupported,
  generatorSupported,
  strategyProviderSupported,
}) {
  return deepFreeze({
    schemaVersion: TRAINING_RULES_CAPABILITY_SCHEMA_VERSION,
    supported,
    reasonCode,
    canonicalHandSupported,
    generatorSupported,
    strategyProviderSupported,
  });
}

export function resolveTrainingRulesCapability(rulesSnapshot, { tableSize = null } = {}) {
  let normalized;
  try {
    normalized = validateGameRulesSnapshot(rulesSnapshot);
  } catch (_) {
    return rulesCapability({
      supported: false,
      reasonCode: TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT,
      canonicalHandSupported: false,
      generatorSupported: false,
      strategyProviderSupported: false,
    });
  }
  if (tableSize !== null && normalized.setup.seatedPlayers !== Number(tableSize)) {
    return rulesCapability({
      supported: false,
      reasonCode: TRAINING_RULES_CAPABILITY_REASON_CODES.TABLE_SIZE_MISMATCH,
      canonicalHandSupported: false,
      generatorSupported: false,
      strategyProviderSupported: false,
    });
  }
  if (normalized.definition.collectionPolicy.type
    === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    return rulesCapability({
      supported: false,
      reasonCode: TRAINING_RULES_CAPABILITY_REASON_CODES.FIXED_COLLECTION_UNSUPPORTED,
      canonicalHandSupported: true,
      generatorSupported: false,
      strategyProviderSupported: false,
    });
  }
  if (normalized.definition.collectionPolicy.type !== GAME_RULES_COLLECTION_TYPES.NONE) {
    return rulesCapability({
      supported: false,
      reasonCode: TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT,
      canonicalHandSupported: false,
      generatorSupported: false,
      strategyProviderSupported: false,
    });
  }
  return rulesCapability({
    supported: true,
    canonicalHandSupported: true,
    generatorSupported: true,
    strategyProviderSupported: true,
  });
}

export function createTrainingConfigFromLegacyCompatibility(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Legacy Training compatibility input must be an object');
  }
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: input.gameMode ?? GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, Number(input.tableSize));
  return createTrainingConfig({
    schemaVersion: TRAINING_CONFIG_V2_SCHEMA_VERSION,
    rulesSnapshot,
    tableSize: input.tableSize,
    stackBb: input.stackBb,
    streets: input.streets,
    heroPositions: input.heroPositions,
    allowedDecisionTypes: input.allowedDecisionTypes,
    difficulty: input.difficulty,
    seed: input.seed,
  });
}

function generatorTargetForScenarioRequest(request) {
  const mapped = TRAINING_SCENARIO_REQUEST_TARGET_MAP[request.targetDecisionType];
  if (!mapped || mapped !== request.targetDecisionType) {
    throw new RangeError(
      `Training planner/generator target vocabulary drift: ${request.targetDecisionType}`,
    );
  }
  return mapped;
}

function createScenarioRequestRulesSnapshot(request, rulesSnapshot) {
  const sourceSnapshot = validateGameRulesSnapshot(rulesSnapshot);
  if (sourceSnapshot.semanticFingerprint !== request.rulesSemanticFingerprint) {
    throw new RangeError(
      'TrainingScenarioRequest rules fingerprint does not match the supplied Game Rules snapshot',
    );
  }
  return createGameRulesSnapshot({
    source: sourceSnapshot.source,
    setup: { seatedPlayers: request.tableSize },
    definition: sourceSnapshot.definition,
  });
}

export function createTrainingConfigFromScenarioRequest(input, rulesSnapshot) {
  const request = createTrainingScenarioRequest(input);
  const targetDecisionType = generatorTargetForScenarioRequest(request);
  const candidateRulesSnapshot = createScenarioRequestRulesSnapshot(request, rulesSnapshot);
  return createTrainingConfig({
    schemaVersion: TRAINING_CONFIG_V2_SCHEMA_VERSION,
    rulesSnapshot: candidateRulesSnapshot,
    tableSize: request.tableSize,
    stackBb: request.startingStackBb,
    streets: [request.street],
    heroPositions: [request.heroPosition],
    allowedDecisionTypes: [targetDecisionType],
    difficulty: request.difficulty,
    seed: request.exerciseSeed,
  });
}

function availableActionTypes(spec) {
  return [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CHECK,
    ACTION_TYPES.CALL,
    ACTION_TYPES.BET,
    ACTION_TYPES.RAISE,
    ACTION_TYPES.ALL_IN,
  ].filter((type) => {
    if (type === ACTION_TYPES.ALL_IN) return spec.allIn.available;
    return spec[type].available;
  });
}

function buildConfiguration(config, buttonSeat, handId) {
  const players = Array.from({ length: config.tableSize }, (_, seat) => ({
    playerId: `seat-${seat}`,
    seat,
    startingStackMilliBb: bbToMilliBb(config.stackBb, 'stackBb'),
  }));
  if (config.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION) {
    return {
      handId,
      rulesSnapshot: config.rulesSnapshot,
      buttonSeat,
      players,
    };
  }
  return {
    handId,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat,
    players,
  };
}

function recordChance(environment, chanceEvent) {
  environment.state = applyChance(environment.state, chanceEvent);
  environment.events.push(deepFreeze({ kind: 'chance', event: structuredClone(chanceEvent) }));
}

function actionFromSpec(state, spec, type, sizing = 'minimum') {
  let amountToMilliBb = null;
  if (type === ACTION_TYPES.BET) {
    if (!spec.bet.available) throw new RetryGenerationError('requested_bet_unavailable');
    amountToMilliBb = sizing === 'maximum' ? spec.bet.maxToMilliBb : spec.bet.minToMilliBb;
  } else if (type === ACTION_TYPES.RAISE) {
    if (!spec.raise.available) throw new RetryGenerationError('requested_raise_unavailable');
    amountToMilliBb = sizing === 'maximum' ? spec.raise.maxToMilliBb : spec.raise.minToMilliBb;
  } else if (type === ACTION_TYPES.ALL_IN) {
    if (!spec.allIn.available) throw new RetryGenerationError('requested_all_in_unavailable');
  } else if (!spec[type]?.available) {
    throw new RetryGenerationError(`requested_${type}_unavailable`);
  }
  return createAction(state.actingPlayerId, type, amountToMilliBb);
}

function recordPreparedAction(environment, legalActionSpec, action) {
  if (environment.actionCount >= MAX_TRAJECTORY_ACTIONS) {
    throw new RetryGenerationError('trajectory_limit_exceeded');
  }
  environment.state = applyAction(environment.state, action);
  environment.actionCount += 1;
  environment.events.push(deepFreeze({
    kind: 'action',
    action: structuredClone(action),
    legalActionSpec: structuredClone(legalActionSpec),
  }));
}

function recordAction(environment, type, sizing = 'minimum') {
  const legalActionSpec = getLegalActionSpec(environment.state);
  const action = actionFromSpec(environment.state, legalActionSpec, type, sizing);
  recordPreparedAction(environment, legalActionSpec, action);
}

function actualPostflopAllInIsEligible(state, spec, defaultActionType) {
  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  const committedMilliBb = spec.allIn.amountToMilliBb - actor.streetContributionMilliBb;
  if (defaultActionType === ACTION_TYPES.BET) {
    return committedMilliBb <= state.potMilliBb * 2;
  }
  const toCallMilliBb = state.currentBetMilliBb - actor.streetContributionMilliBb;
  const potAfterCallMilliBb = state.potMilliBb + toCallMilliBb;
  return committedMilliBb <= potAfterCallMilliBb * 2;
}

function recordFacingSizedAction(environment, defaultActionType, sizingContext) {
  if (!sizingContext || sizingContext.requestedSizingFamily === null) {
    recordAction(environment, defaultActionType);
    if (sizingContext) {
      environment.sizingRealization = {
        vocabularyVersion: TRAINING_SIZING_FAMILY_SCHEMA_VERSION,
        policyVersion: TRAINING_SIZING_POLICY_VERSION,
        requestedSizingFamily: null,
        realizedSizingFamily: null,
        actionType: defaultActionType,
        rawTargetMilliBb: null,
        roundedTargetMilliBb: null,
        realizedLegalAmountToMilliBb: null,
        adjustmentReason: 'focused_legacy_default',
        deduplicationReason: null,
      };
    }
    return;
  }
  const state = environment.state;
  const spec = getLegalActionSpec(state);
  const hero = state.players.find((player) => player.playerId === sizingContext.heroPlayerId);
  const eligibleSizingFamilies = trainingSizingFamiliesForStructure({
    street: state.street,
    targetDecisionType: sizingContext.targetDecisionType,
    startingStackBb: hero.startingStackMilliBb / 1000,
    tableSize: state.players.length,
    chipUnitMilliBb: state.game.chipUnitMilliBb,
  });
  if (!eligibleSizingFamilies.includes(sizingContext.requestedSizingFamily)) {
    throw new SizingFamilyRealizationError('requested_sizing_family_structurally_ineligible', {
      requestedSizingFamily: sizingContext.requestedSizingFamily,
      eligibleSizingFamilies,
    });
  }
  if (sizingContext.requestedSizingFamily === TRAINING_SIZING_FAMILIES.ALL_IN
    && state.street !== STREETS.PREFLOP
    && !actualPostflopAllInIsEligible(state, spec, defaultActionType)) {
    throw new SizingFamilyRealizationError('requested_all_in_exceeds_generation_policy', {
      requestedSizingFamily: sizingContext.requestedSizingFamily,
      canonicalAllInAmountToMilliBb: spec.allIn.amountToMilliBb,
    });
  }
  let realizationSet;
  try {
    realizationSet = realizeCanonicalTrainingSizing({
      state,
      legalActionSpec: spec,
      actionType: defaultActionType,
      requestedSizingFamily: sizingContext.requestedSizingFamily,
      eligibleSizingFamilies,
    });
  } catch (error) {
    throw new SizingFamilyRealizationError('requested_sizing_family_unrealizable', {
      requestedSizingFamily: sizingContext.requestedSizingFamily,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const realization = realizationSet.requested;
  if (!realization?.realizedSizingFamily) {
    throw new SizingFamilyRealizationError('requested_sizing_family_collapsed', {
      requestedSizingFamily: sizingContext.requestedSizingFamily,
      deduplicationReason: realization?.deduplicationReason ?? null,
      realizedLegalAmountToMilliBb: realization?.realizedLegalAmountToMilliBb ?? null,
      distinctFamilies: realizationSet.distinctFamilies,
    });
  }
  const amountToMilliBb = realization.actionType === ACTION_TYPES.ALL_IN
    ? null
    : realization.realizedLegalAmountToMilliBb;
  const action = createAction(state.actingPlayerId, realization.actionType, amountToMilliBb);
  recordPreparedAction(environment, spec, action);
  environment.sizingRealization = {
    vocabularyVersion: TRAINING_SIZING_FAMILY_SCHEMA_VERSION,
    policyVersion: TRAINING_SIZING_POLICY_VERSION,
    ...realization,
  };
}

function passiveAction(environment) {
  const spec = getLegalActionSpec(environment.state);
  if (spec.check.available) return recordAction(environment, ACTION_TYPES.CHECK);
  if (spec.call.available) return recordAction(environment, ACTION_TYPES.CALL);
  if (spec.fold.available) return recordAction(environment, ACTION_TYPES.FOLD);
  throw new RetryGenerationError('no_passive_progress_action');
}

function dealPendingBoard(environment) {
  const pending = environment.state.pendingChance;
  if (!pending || pending.type === CHANCE_TYPES.DEAL_HOLE) {
    throw new RetryGenerationError('expected_board_chance');
  }
  const cards = environment.deck.splice(0, pending.cardCount);
  recordChance(environment, { type: pending.type, cards });
}

function advanceToStreet(environment, targetStreet) {
  while (environment.state.street !== targetStreet) {
    if (environment.state.terminal.isTerminal || environment.state.phase === PHASES.SHOWDOWN) {
      throw new RetryGenerationError('hand_ended_before_target_street');
    }
    if (environment.state.phase === PHASES.CHANCE) {
      dealPendingBoard(environment);
    } else {
      passiveAction(environment);
    }
  }
}

function stopAtPreflopTarget(environment, heroPlayerId, target, sizingContext = null) {
  const initialActorId = environment.state.actingPlayerId;
  if (target === TRAINING_DECISION_TYPES.PREFLOP_UNOPENED) {
    if (environment.state.players.find((player) => player.playerId === heroPlayerId)?.position === 'BB') {
      throw new RetryGenerationError('bb_cannot_receive_unopened_rfi_target');
    }
    while (environment.state.actingPlayerId !== heroPlayerId) {
      recordAction(environment, ACTION_TYPES.FOLD);
      if (environment.state.terminal.isTerminal) {
        throw new RetryGenerationError('folds_ended_hand_before_hero');
      }
    }
    return;
  }

  if (target === TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION) {
    const hero = environment.state.players.find((player) => player.playerId === heroPlayerId);
    if (hero?.position !== 'BB') throw new RetryGenerationError('bb_option_requires_bb_hero');
    while (environment.state.actingPlayerId !== heroPlayerId) passiveAction(environment);
    if (!getLegalActionSpec(environment.state).check.available) {
      throw new RetryGenerationError('bb_option_not_checkable');
    }
    return;
  }

  if (target === TRAINING_DECISION_TYPES.PREFLOP_FACING_OPEN) {
    if (initialActorId === heroPlayerId) {
      throw new RetryGenerationError('hero_cannot_face_open_as_first_actor');
    }
    let opened = false;
    while (environment.state.actingPlayerId !== heroPlayerId) {
      if (!opened) {
        recordFacingSizedAction(environment, ACTION_TYPES.RAISE, sizingContext);
        opened = true;
      } else {
        passiveAction(environment);
      }
    }
    return;
  }

  if (target === TRAINING_DECISION_TYPES.PREFLOP_FACING_3BET) {
    while (environment.state.actingPlayerId !== heroPlayerId) passiveAction(environment);
    const heroSpec = getLegalActionSpec(environment.state);
    const heroAggression = heroSpec.raise.available ? ACTION_TYPES.RAISE : ACTION_TYPES.ALL_IN;
    recordAction(environment, heroAggression);
    let reraised = false;
    while (environment.state.actingPlayerId !== heroPlayerId) {
      const spec = getLegalActionSpec(environment.state);
      if (!reraised && spec.raise.available) {
        recordFacingSizedAction(environment, ACTION_TYPES.RAISE, sizingContext);
        reraised = true;
      } else {
        passiveAction(environment);
      }
      if (environment.state.terminal.isTerminal) {
        throw new RetryGenerationError('hand_ended_before_3bet_response');
      }
    }
    if (!reraised) throw new RetryGenerationError('no_opponent_could_3bet');
    return;
  }

  if (target === TRAINING_DECISION_TYPES.PREFLOP_FACING_4BET) {
    let opened = false;
    while (environment.state.actingPlayerId !== heroPlayerId) {
      const spec = getLegalActionSpec(environment.state);
      if (!opened && spec.raise.available) {
        recordAction(environment, ACTION_TYPES.RAISE);
        opened = true;
      } else {
        passiveAction(environment);
      }
    }
    if (!opened) throw new RetryGenerationError('hero_could_not_face_open_before_3bet');
    const heroSpec = getLegalActionSpec(environment.state);
    if (!heroSpec.raise.available) throw new RetryGenerationError('hero_cannot_3bet_open');
    recordAction(environment, ACTION_TYPES.RAISE);
    let fourBet = false;
    while (environment.state.actingPlayerId !== heroPlayerId) {
      const spec = getLegalActionSpec(environment.state);
      if (!fourBet && spec.raise.available) {
        recordFacingSizedAction(environment, ACTION_TYPES.RAISE, sizingContext);
        fourBet = true;
      } else {
        passiveAction(environment);
      }
      if (environment.state.terminal.isTerminal) {
        throw new RetryGenerationError('hand_ended_before_4bet_response');
      }
    }
    if (!fourBet) throw new RetryGenerationError('no_opponent_could_4bet');
    return;
  }
  throw new RetryGenerationError('unsupported_preflop_target');
}

function stopAtPostflopTarget(environment, heroPlayerId, target, sizingContext = null) {
  if (target === TRAINING_DECISION_TYPES.POSTFLOP_FIRST_ACTION) {
    while (environment.state.actingPlayerId !== heroPlayerId) {
      recordAction(environment, ACTION_TYPES.CHECK);
    }
    return;
  }

  if (target === TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET) {
    let betMade = false;
    if (environment.state.actingPlayerId === heroPlayerId) {
      recordAction(environment, ACTION_TYPES.CHECK);
    }
    while (environment.state.actingPlayerId !== heroPlayerId) {
      const spec = getLegalActionSpec(environment.state);
      if (!betMade && spec.bet.available) {
        recordFacingSizedAction(environment, ACTION_TYPES.BET, sizingContext);
        betMade = true;
      } else {
        passiveAction(environment);
      }
    }
    if (!betMade || !getLegalActionSpec(environment.state).call.available) {
      throw new RetryGenerationError('hero_not_facing_postflop_bet');
    }
    return;
  }

  if (target === TRAINING_DECISION_TYPES.POSTFLOP_FACING_RAISE) {
    while (environment.state.actingPlayerId !== heroPlayerId) {
      recordAction(environment, ACTION_TYPES.CHECK);
    }
    const heroSpec = getLegalActionSpec(environment.state);
    if (!heroSpec.bet.available) throw new RetryGenerationError('hero_cannot_open_postflop_betting');
    recordAction(environment, ACTION_TYPES.BET);
    let raised = false;
    while (environment.state.actingPlayerId !== heroPlayerId) {
      const spec = getLegalActionSpec(environment.state);
      if (!raised && spec.raise.available) {
        recordFacingSizedAction(environment, ACTION_TYPES.RAISE, sizingContext);
        raised = true;
      } else {
        passiveAction(environment);
      }
    }
    if (!raised) throw new RetryGenerationError('no_opponent_could_raise_postflop');
    return;
  }
  throw new RetryGenerationError('unsupported_postflop_target');
}

function targetPairs(config) {
  return config.streets.flatMap((street) => (
    config.allowedDecisionTypes
      .filter((target) => targetSupportsStreet(target, street))
      .map((target) => ({ street, target }))
  ));
}

function exerciseIdentifier(seed, attempt, target, state) {
  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  const suffix = (state.actionHistory.length * 131 + state.board.length * 17 + state.buttonSeat)
    .toString(16)
    .padStart(4, '0');
  return [
    'training',
    seed.toString(16).padStart(8, '0'),
    `${state.players.length}max`,
    actor?.position || 'unknown',
    state.street,
    `${actor?.startingStackMilliBb || 0}mbb`,
    attempt,
    target,
    suffix,
  ].join('-');
}

function createEnvironment(config, random, attempt, street, target, sizingRequest = undefined) {
  const buttonRandom = random.button ?? random;
  const heroRandom = random.hero ?? random;
  const cardsRandom = random.cards ?? random;
  const buttonSeat = buttonRandom.nextInt(config.tableSize);
  const handId = `training-${config.seed.toString(16)}-${attempt}`;
  const initialConfiguration = buildConfiguration(config, buttonSeat, handId);
  let state = config.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION
    ? initializeHandFromGameRulesSnapshot(initialConfiguration)
    : initializeHand(initialConfiguration);
  const heroPosition = heroRandom.choose(config.heroPositions);
  const hero = state.players.find((player) => player.position === heroPosition);
  if (!hero) throw new RetryGenerationError('hero_position_not_seated');

  const shuffledDeck = cardsRandom.shuffle(FULL_DECK);
  const realizationByPlayer = Object.fromEntries(
    state.pendingChance.playerOrder.map((playerId) => [playerId, []]),
  );
  for (let round = 0; round < 2; round += 1) {
    for (const playerId of state.pendingChance.playerOrder) {
      realizationByPlayer[playerId].push(shuffledDeck.shift());
    }
  }
  const holeEvent = {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { [hero.playerId]: realizationByPlayer[hero.playerId] },
    hiddenPlayerIds: state.players
      .filter((player) => player.playerId !== hero.playerId)
      .map((player) => player.playerId),
  };
  const environment = {
    state,
    deck: shuffledDeck,
    events: [],
    actionCount: 0,
    initialConfiguration,
  };
  recordChance(environment, holeEvent);
  const sizingContext = sizingRequest === undefined ? null : {
    requestedSizingFamily: sizingRequest.requestedSizingFamily,
    targetDecisionType: target,
    heroPlayerId: hero.playerId,
  };
  if (street === STREETS.PREFLOP) {
    stopAtPreflopTarget(environment, hero.playerId, target, sizingContext);
  } else {
    advanceToStreet(environment, street);
    stopAtPostflopTarget(environment, hero.playerId, target, sizingContext);
  }
  return { environment, heroPlayerId: hero.playerId, heroPosition };
}

function requestedStructure(request) {
  return {
    tableSize: request.tableSize,
    heroPosition: request.heroPosition,
    startingStackBb: request.startingStackBb,
    street: request.street,
    targetDecisionType: request.targetDecisionType,
    requestedSizingFamily: request.requestedSizingFamily,
    rulesSemanticFingerprint: request.rulesSemanticFingerprint,
    exerciseSeed: request.exerciseSeed,
  };
}

function scenarioRequestGenerationMetadata(
  context,
  environment,
  decisionContext,
  strategyResult,
  pair,
  attempt,
) {
  if (!context) return null;
  const hero = environment.state.players.find(
    (player) => player.playerId === environment.state.actingPlayerId,
  );
  const sizing = environment.sizingRealization ?? {
    vocabularyVersion: TRAINING_SIZING_FAMILY_SCHEMA_VERSION,
    policyVersion: TRAINING_SIZING_POLICY_VERSION,
    requestedSizingFamily: context.request.requestedSizingFamily,
    realizedSizingFamily: null,
    actionType: null,
    rawTargetMilliBb: null,
    roundedTargetMilliBb: null,
    realizedLegalAmountToMilliBb: null,
    adjustmentReason: 'not_applicable',
    deduplicationReason: null,
  };
  return {
    request: structuredClone(context.request),
    policyVersions: {
      planner: context.request.plannerPolicyVersion,
      adapter: TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION,
      generator: TRAINING_SCENARIO_GENERATOR_POLICY_VERSION,
    },
    requestedStructure: requestedStructure(context.request),
    realizedStructure: {
      tableSize: decisionContext.tableSize,
      heroPosition: decisionContext.heroPosition,
      startingStackBb: hero.startingStackMilliBb / 1000,
      street: decisionContext.street,
      targetDecisionType: pair.target,
      ...(decisionContext.street === STREETS.PREFLOP ? {
        decisionRole: strategyResult.details?.decisionRole ?? 'unknown',
        fallbackCalibration: strategyResult.details?.fallbackCalibration ?? null,
      } : {}),
      requestedSizingFamily: context.request.requestedSizingFamily,
      rulesSemanticFingerprint: environment.state.rulesSnapshot.semanticFingerprint,
      exerciseSeed: context.request.exerciseSeed,
    },
    construction: {
      attemptCount: attempt,
      maximumAttempts: MAX_GENERATION_ATTEMPTS,
      retryDiagnostics: context.retryDiagnostics.map((diagnostic) => ({ ...diagnostic })),
      namedSeeds: { ...context.namedSeeds },
    },
    sizing: structuredClone(sizing),
  };
}

function buildExercise(
  config,
  random,
  attempt,
  pair,
  strategyProvider,
  scenarioRequestContext = null,
) {
  const { environment, heroPlayerId } = createEnvironment(
    config,
    random,
    attempt,
    pair.street,
    pair.target,
    scenarioRequestContext?.request,
  );
  validatePokerState(environment.state);
  if (environment.state.phase !== PHASES.BETTING
    || environment.state.actingPlayerId !== heroPlayerId
    || environment.state.terminal.isTerminal) {
    throw new RetryGenerationError('target_is_not_live_hero_decision');
  }
  const hero = environment.state.players.find((player) => player.playerId === heroPlayerId);
  if (!Array.isArray(hero?.holeCards) || hero.holeCards.length !== 2) {
    throw new RetryGenerationError('hero_cards_unavailable');
  }
  const legalActions = getLegalActionSpec(environment.state);
  if (availableActionTypes(legalActions).length < 2) {
    throw new RetryGenerationError('decision_has_fewer_than_two_actions');
  }

  let decisionContext;
  try {
    decisionContext = deriveDecisionContextFromPokerState(environment.state, heroPlayerId);
  } catch (error) {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.DECISION_PROJECTION_UNAVAILABLE,
      'The canonical decision could not be projected to DecisionContext v1.',
      { error: serializedError(error) },
    );
  }

  let strategyResult;
  try {
    strategyResult = strategyProvider.resolve(decisionContext);
  } catch (error) {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      'The existing strategy path could not produce a Training reference.',
      { error: serializedError(error) },
    );
  }
  if (!isStrategyResultV1(strategyResult) || strategyResult.actions.length === 0) {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      'The existing strategy path returned no gradeable StrategyResult.',
    );
  }

  const exerciseId = exerciseIdentifier(config.seed, attempt, pair.target, environment.state);
  const facingCategory = decisionContext.facingSizeBb > 0
    ? decisionContext.lastAction
    : pair.target === TRAINING_DECISION_TYPES.PREFLOP_BB_OPTION ? 'bb_option' : 'none';
  const potType = pair.target.includes('3bet') || pair.target.includes('raise')
    ? 'reraised'
    : pair.target.includes('open') || pair.target.includes('bet')
      ? 'single_raise'
      : pair.target.includes('bb_option') ? 'limped' : 'unopened';
  const stackBucket = config.stackBb <= 30 ? 'short'
    : config.stackBb <= 100 ? 'standard' : 'deep';
  const requestMetadata = scenarioRequestGenerationMetadata(
    scenarioRequestContext,
    environment,
    decisionContext,
    strategyResult,
    pair,
    attempt,
  );

  return deepFreeze({
    ok: true,
    exercise: {
      schemaVersion: config.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION
        ? TRAINING_EXERCISE_V2_SCHEMA_VERSION
        : TRAINING_EXERCISE_V1_SCHEMA_VERSION,
      id: exerciseId,
      seed: config.seed,
      pokerState: environment.state,
      heroPlayerId,
      decisionContext,
      strategyResult,
      legalActions,
      presentation: {
        heroCards: [...decisionContext.heroCards],
        board: [...decisionContext.board],
        position: decisionContext.heroPosition,
        potBb: decisionContext.potBb,
        stackBb: decisionContext.stackBb,
        facingBb: decisionContext.facingSizeBb,
        callBb: decisionContext.callAmountBb,
        street: decisionContext.street,
        lastAction: decisionContext.lastAction,
        assistanceMode: config.difficulty,
      },
      generationMetadata: {
        attempts: attempt,
        trajectoryLength: environment.actionCount,
        eventCount: environment.events.length,
        targetReason: pair.target,
        trainingConfig: structuredClone(config),
        initialConfiguration: structuredClone(environment.initialConfiguration),
        events: environment.events.map((event) => structuredClone(event)),
        curriculum: {
          street: decisionContext.street,
          heroPosition: decisionContext.heroPosition,
          tableSize: decisionContext.tableSize,
          facingCategory,
          actionCategory: pair.target,
          ...(decisionContext.street === STREETS.PREFLOP ? {
            decisionRole: strategyResult.details?.decisionRole ?? 'unknown',
            fallbackCalibration: strategyResult.details?.fallbackCalibration ?? null,
          } : {}),
          potType,
          stackBucket,
          handClass: null,
        },
        policy: 'bounded_legal_trajectory_v1',
        policyIsStrategy: false,
        ...(requestMetadata ? { scenarioRequest: requestMetadata } : {}),
      },
    },
  });
}

export function generateTrainingExercise(input, {
  strategyProvider,
} = {}) {
  const requestedRulesCapability = input?.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION
    ? resolveTrainingRulesCapability(input.rulesSnapshot, { tableSize: input.tableSize })
    : null;
  let config;
  try {
    config = createTrainingConfig(input);
  } catch (error) {
    if (requestedRulesCapability && !requestedRulesCapability.supported
      && requestedRulesCapability.reasonCode
        === TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT) {
      return failure(
        TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES,
        'Training does not support the supplied Game Rules.',
        { capability: requestedRulesCapability, error: serializedError(error) },
      );
    }
    return failure(
      TRAINING_GENERATION_ERROR_CODES.INVALID_CONFIG,
      'Training configuration is invalid.',
      { error: serializedError(error) },
    );
  }
  if (config.schemaVersion === TRAINING_CONFIG_V2_SCHEMA_VERSION) {
    const capability = resolveTrainingRulesCapability(config.rulesSnapshot, {
      tableSize: config.tableSize,
    });
    if (!capability.supported) {
      return failure(
        TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES,
        'Training does not support the supplied Game Rules.',
        { capability },
      );
    }
  }
  if (!strategyProvider || typeof strategyProvider.resolve !== 'function') {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      'A StrategyProvider v1 resolver is required.',
    );
  }
  const pairs = targetPairs(config);
  if (pairs.length === 0) {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_TARGET,
      'No configured street and decision target can be generated.',
    );
  }

  const random = createSeededTrainingRandom(config.seed);
  let lastRetryReason = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const pair = random.choose(pairs);
    try {
      const result = buildExercise(config, random, attempt, pair, strategyProvider);
      if (result.ok) return result;
      if ([
        TRAINING_GENERATION_ERROR_CODES.DECISION_PROJECTION_UNAVAILABLE,
        TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      ].includes(result.error.code)) return result;
    } catch (error) {
      if (error instanceof RetryGenerationError) {
        lastRetryReason = error.message;
        continue;
      }
      return failure(
        TRAINING_GENERATION_ERROR_CODES.INTERNAL_ERROR,
        'Canonical Training generation failed unexpectedly.',
        { error: serializedError(error) },
      );
    }
  }
  return failure(
    TRAINING_GENERATION_ERROR_CODES.GENERATION_EXHAUSTED,
    'No reachable Training decision satisfied the configured target.',
    { attempts: MAX_GENERATION_ATTEMPTS, lastRetryReason },
  );
}

function namedScenarioRequestStreams(exerciseSeed, attempt) {
  const constructionAttempt = deriveTrainingScenarioGenerationSeed(
    exerciseSeed,
    attempt,
    'construction-attempt',
  );
  const namedSeeds = {
    constructionAttempt,
    seatsButton: deriveTrainingScenarioGenerationSeed(constructionAttempt, 1, 'seats-button'),
    cards: deriveTrainingScenarioGenerationSeed(constructionAttempt, 1, 'cards'),
    trajectory: deriveTrainingScenarioGenerationSeed(constructionAttempt, 1, 'trajectory'),
  };
  const seatsButton = createSeededTrainingRandom(namedSeeds.seatsButton);
  return {
    namedSeeds,
    random: {
      button: seatsButton,
      hero: seatsButton,
      cards: createSeededTrainingRandom(namedSeeds.cards),
    },
  };
}

export function generateTrainingExerciseFromScenarioRequest(input, {
  rulesSnapshot,
  strategyProvider,
} = {}) {
  let request;
  let config;
  try {
    request = createTrainingScenarioRequest(input);
    config = createTrainingConfigFromScenarioRequest(request, rulesSnapshot);
  } catch (error) {
    const capability = resolveTrainingRulesCapability(rulesSnapshot);
    if (!capability.supported
      && capability.reasonCode
        === TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT) {
      return failure(
        TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES,
        'Training does not support the supplied Game Rules.',
        { capability, error: serializedError(error) },
      );
    }
    return failure(
      TRAINING_GENERATION_ERROR_CODES.INVALID_SCENARIO_REQUEST,
      'TrainingScenarioRequest could not be mapped exactly to the canonical generator.',
      { error: serializedError(error) },
    );
  }

  const capability = resolveTrainingRulesCapability(config.rulesSnapshot, {
    tableSize: config.tableSize,
  });
  if (!capability.supported) {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES,
      'Training does not support the supplied Game Rules.',
      { capability, request: structuredClone(request) },
    );
  }
  if (!strategyProvider || typeof strategyProvider.resolve !== 'function') {
    return failure(
      TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      'A StrategyProvider v1 resolver is required.',
    );
  }

  const pair = {
    street: request.street,
    target: generatorTargetForScenarioRequest(request),
  };
  const retryDiagnostics = [];
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const streams = namedScenarioRequestStreams(request.exerciseSeed, attempt);
    try {
      const result = buildExercise(
        config,
        streams.random,
        attempt,
        pair,
        strategyProvider,
        {
          request,
          retryDiagnostics,
          namedSeeds: streams.namedSeeds,
        },
      );
      if (result.ok) return result;
      if ([
        TRAINING_GENERATION_ERROR_CODES.DECISION_PROJECTION_UNAVAILABLE,
        TRAINING_GENERATION_ERROR_CODES.STRATEGY_UNAVAILABLE,
      ].includes(result.error.code)) return result;
    } catch (error) {
      if (error instanceof SizingFamilyRealizationError) {
        return failure(
          TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_TARGET,
          'The requested Training sizing family cannot be realized distinctly and legally.',
          {
            reason: error.message,
            ...error.details,
            request: structuredClone(request),
            attempt,
          },
        );
      }
      if (error instanceof RetryGenerationError) {
        retryDiagnostics.push({
          attempt,
          reason: error.message,
          namedSeeds: { ...streams.namedSeeds },
        });
        continue;
      }
      return failure(
        TRAINING_GENERATION_ERROR_CODES.INTERNAL_ERROR,
        'Canonical Training generation failed unexpectedly.',
        {
          error: serializedError(error),
          request: structuredClone(request),
          attempt,
        },
      );
    }
  }
  return failure(
    TRAINING_GENERATION_ERROR_CODES.GENERATION_EXHAUSTED,
    'The requested Training structural envelope could not be constructed.',
    {
      attempts: MAX_GENERATION_ATTEMPTS,
      lastRetryReason: retryDiagnostics.at(-1)?.reason ?? null,
      retryDiagnostics,
      request: structuredClone(request),
      policyVersions: {
        planner: request.plannerPolicyVersion,
        adapter: TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION,
        generator: TRAINING_SCENARIO_GENERATOR_POLICY_VERSION,
      },
      requestedStructure: requestedStructure(request),
    },
  );
}
