import { createRfiStructuralMappingFacts } from '../personal-strategy/structural-range-mapping.mjs';
import {
  ACTION_TYPES,
  ANTE_TYPES,
  CARD_RANKS,
  CARD_SUITS,
  CHANCE_TYPES,
  GAME_MODES,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
  PHASES,
  STREETS,
  applyAction,
  applyChance,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  createGameRulesSnapshot,
  getLegalActionSpec,
  getHoldemCombosForHandClass,
  initializeHandFromGameRulesSnapshot,
} from '../../../shared/poker-domain/index.js';
import {
  CALIBRATION_DECISION_FAMILIES,
  CALIBRATION_SESSION_STATES,
  DIRECT_EVIDENCE_SOURCES,
  PERSONAL_STRATEGY_DATABASE_NAME,
  PROFILE_STATES,
  RANGE_OBSERVATION_STATES,
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  RFI_COLD_START_POLICY_VERSION,
  RFI_QUESTION_SELECTION_POLICY_VERSION,
  RFI_SELECTION_INTENTS,
  RFI_STOPPING_POLICY_VERSION,
  assessCalibrationProgress,
  calibrationContextKey,
  createCalibrationSession,
  createLocalOwnerRef,
  createIndexedDbPersonalStrategyDatabase,
  createPersonalStrategyBrowserStorage,
  createPersonalStrategyEvidenceView,
  createUserDirectedMatrixQuestion,
  createPersonalStrategyMatrixProjection,
  createPersonalStrategyProjectionService,
  createRangeTeacherView,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  getCalibrationQuestionExplanation,
  getNextCalibrationQuestion,
  derivePreflopCalibrationContextFromPokerState,
  getPersonalStrategyActionSetForContext,
  normalizePersonalStrategyExactDistribution,
  derivePersonalStrategyDominantAction,
  normalizeRfiCalibrationIntent,
  normalizeRfiSelectionIntent,
  rankCalibrationCandidates,
  rangeObservationKey,
  resolveRangeTeacherSessionPreset,
  updateCalibrationSession,
  updateStrategyMode,
  updateStrategyProfile,
  validateProfileOwnerRef,
} from '../personal-strategy/index.mjs';
import {
  scopedDomainDatabaseName,
  scopedPreferenceKey,
} from '../account-identity/index.mjs';
import { LEGACY_PERSONAL_STRATEGY_OWNER_KEY } from '../account-identity/legacy-ownership.mjs';
import { createPersonalStrategyRangeBuilder } from './range-builder-service.mjs';
import { previewPersonalStrategyIntent } from '../personal-strategy/intent-interpretation.mjs';
import { createQualitativeEvidence } from '../personal-strategy/qualitative-evidence.mjs';

export {
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  RFI_SELECTION_INTENTS,
};

export const RANGE_CALIBRATION_OWNER_KEY = LEGACY_PERSONAL_STRATEGY_OWNER_KEY;
export const RANGE_CALIBRATION_PREFERENCES_KEY = 'riverline.rangeCalibration.preferences.v1';
export const RANGE_CALIBRATION_PREFERENCES_SCHEMA = 'range-calibration-preferences/v1';
export const RANGE_CALIBRATION_NAME_MAX_LENGTH = 80;
export const RANGE_CALIBRATION_DESCRIPTION_MAX_LENGTH = 240;
export const RANGE_CALIBRATION_STACK_LIMITS = Object.freeze({ min: 10, max: 500 });
export const RANGE_CALIBRATION_QUESTION_ORDER = PREFLOP_HAND_CLASSES;
export const PERSONAL_STRATEGY_STALE_SCOPE_ERROR = 'stale_personal_strategy_scope';
export const RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION =
  'invalid_range_calibration_exact_distribution';
export const RFI_CALIBRATION_ACTIONS = Object.freeze([
  Object.freeze({ type: ACTION_TYPES.FOLD, shortcut: 'F' }),
  Object.freeze({ type: ACTION_TYPES.RAISE, shortcut: 'R' }),
]);
export const PREFLOP_CALIBRATION_DECISION_FAMILIES = Object.freeze([
  CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
  CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP,
  CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_OPEN,
  CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_3BET,
  CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_4BET,
  CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION,
]);

const RFI_CALIBRATION_ACTION_TYPES = new Set(RFI_CALIBRATION_ACTIONS.map((entry) => entry.type));
const PREFLOP_CALIBRATION_DECISION_FAMILY_SET = new Set(
  PREFLOP_CALIBRATION_DECISION_FAMILIES,
);
const MIX_TOTAL_TOLERANCE = 1e-9;

export const CALIBRATION_ENVIRONMENTS = Object.freeze({
  CUSTOM: 'custom',
  HOME: 'home',
  CLUBGG: 'clubgg',
});

const ENVIRONMENT_TAG_PREFIX = 'riverline:environment:';
const ENVIRONMENT_VALUES = Object.freeze(Object.values(CALIBRATION_ENVIRONMENTS));

export const CALIBRATION_ENVIRONMENT_RULES = Object.freeze({
  custom: Object.freeze({
    gameRulesId: 'user-setup-defaults/v1', minTableSize: 2, maxTableSize: 10, defaultTableSize: 6,
    accounting: Object.freeze({ anteType: ANTE_TYPES.NONE, anteBb: 0, forcedContributionPerPlayerBb: 0, rakeMode: 'off' }),
  }),
  [CALIBRATION_ENVIRONMENTS.HOME]: Object.freeze({
    gameRulesId: 'riverline-home-v1',
    minTableSize: 2,
    maxTableSize: 10,
    defaultTableSize: 6,
    accounting: Object.freeze({
      anteType: ANTE_TYPES.NONE,
      anteBb: 0,
      forcedContributionPerPlayerBb: 0,
      rakeMode: 'off',
    }),
  }),
  [CALIBRATION_ENVIRONMENTS.CLUBGG]: Object.freeze({
    gameRulesId: 'riverline-clubgg-v1',
    minTableSize: 7,
    maxTableSize: 10,
    defaultTableSize: 8,
    accounting: Object.freeze({
      anteType: ANTE_TYPES.NONE,
      anteBb: 0,
      forcedContributionPerPlayerBb: 0.1,
      rakeMode: 'fixed_per_seated_player',
    }),
  }),
});

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('Range Calibration requires a Storage-compatible adapter');
  }
  return storage;
}

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Range Calibration clock returned an invalid date');
  return date.toISOString();
}

function timestampNotBefore(clock, floor = null) {
  const candidate = timestampFrom(clock);
  if (floor === null || Date.parse(candidate) >= Date.parse(floor)) return candidate;
  return floor;
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function normalizeCalibrationName(value, label = 'Name') {
  if (typeof value !== 'string') throw new TypeError(`${label} is required`);
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized) throw new RangeError(`${label} is required`);
  if (normalized.length > RANGE_CALIBRATION_NAME_MAX_LENGTH) {
    throw new RangeError(`${label} must be ${RANGE_CALIBRATION_NAME_MAX_LENGTH} characters or fewer`);
  }
  return normalized;
}

export function normalizeCalibrationDescription(value) {
  if (value === null || value === undefined || !String(value).trim()) return null;
  const normalized = String(value).trim();
  if (normalized.length > RANGE_CALIBRATION_DESCRIPTION_MAX_LENGTH) {
    throw new RangeError(`Description must be ${RANGE_CALIBRATION_DESCRIPTION_MAX_LENGTH} characters or fewer`);
  }
  return normalized;
}

export function normalizeModeNames(values) {
  if (!Array.isArray(values) || values.length < 1) {
    throw new RangeError('At least one Approach name is required');
  }
  const names = values.map((value, index) => normalizeCalibrationName(value, `Mode ${index + 1}`));
  const comparable = names.map((name) => name.toLocaleLowerCase('en-US'));
  if (new Set(comparable).size !== comparable.length) {
    throw new RangeError('Mode names must be different within one profile');
  }
  return names;
}

export function normalizeCalibrationEnvironment(value) {
  if (!ENVIRONMENT_VALUES.includes(value)) throw new RangeError('Unsupported poker environment');
  return value;
}

function environmentTag(environment) {
  return `${ENVIRONMENT_TAG_PREFIX}${normalizeCalibrationEnvironment(environment)}`;
}

export function profileDefaultEnvironment(profile) {
  const tag = profile?.tags?.find((entry) => entry.startsWith(ENVIRONMENT_TAG_PREFIX));
  const environment = tag?.slice(ENVIRONMENT_TAG_PREFIX.length);
  return ENVIRONMENT_VALUES.includes(environment) ? environment : CALIBRATION_ENVIRONMENTS.CUSTOM;
}

export function tableSizesForEnvironment(environment) {
  const rules = CALIBRATION_ENVIRONMENT_RULES[normalizeCalibrationEnvironment(environment)];
  return Array.from(
    { length: rules.maxTableSize - rules.minTableSize + 1 },
    (_, index) => rules.minTableSize + index,
  );
}

export function rfiPositionsForTableSize(tableSize) {
  const positions = POSITIONS_BY_TABLE_SIZE[Number(tableSize)];
  if (!positions) throw new RangeError('Table size must be from 2 through 10');
  return positions.filter((position) => position !== 'BB');
}

export function positionsForPreflopCalibrationFamily(tableSize, decisionFamily) {
  const positions = POSITIONS_BY_TABLE_SIZE[Number(tableSize)];
  if (!positions) throw new RangeError('Table size must be from 2 through 10');
  if (!PREFLOP_CALIBRATION_DECISION_FAMILY_SET.has(decisionFamily)) {
    throw new RangeError('Unsupported preflop Calibration decision family');
  }
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION) return ['BB'];
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    return positions.filter((position) => position !== 'BB');
  }
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP) {
    return positions.slice(1).filter((position) => position !== 'BB');
  }
  return [...positions];
}

export function normalizeRfiContextSelection(selection = {}, { environmentDefault = CALIBRATION_ENVIRONMENTS.HOME } = {}) {
  const environment = normalizeCalibrationEnvironment(selection.environment ?? environmentDefault);
  const rules = CALIBRATION_ENVIRONMENT_RULES[environment];
  const allowedTableSizes = tableSizesForEnvironment(environment);
  const requestedTableSize = Number(selection.tableSize);
  const tableSize = allowedTableSizes.includes(requestedTableSize)
    ? requestedTableSize
    : Math.min(rules.maxTableSize, Math.max(rules.minTableSize, rules.defaultTableSize));
  const decisionFamily = PREFLOP_CALIBRATION_DECISION_FAMILY_SET.has(selection.decisionFamily)
    ? selection.decisionFamily
    : CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI;
  const actionAware = selection.actionAware === true
    || decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI;
  const positions = positionsForPreflopCalibrationFamily(tableSize, decisionFamily);
  const heroPosition = positions.includes(selection.heroPosition)
    ? selection.heroPosition
    : (positions.includes('BTN') ? 'BTN' : positions[0]);
  const requestedStack = Number(selection.effectiveStackBb);
  const stackWasSupplied = selection.effectiveStackBb !== undefined
    && selection.effectiveStackBb !== null
    && selection.effectiveStackBb !== '';
  if (stackWasSupplied && (!Number.isFinite(requestedStack)
    || requestedStack < RANGE_CALIBRATION_STACK_LIMITS.min
    || requestedStack > RANGE_CALIBRATION_STACK_LIMITS.max)) {
    throw new RangeError(
      `Effective stack must be from ${RANGE_CALIBRATION_STACK_LIMITS.min} through ${RANGE_CALIBRATION_STACK_LIMITS.max} bb`,
    );
  }
  const effectiveStackBb = stackWasSupplied ? requestedStack : 100;
  const customAccounting = environment === CALIBRATION_ENVIRONMENTS.CUSTOM;
  const collectionBb = Number(selection.collectionBb ?? 0);
  const anteBb = Number(selection.anteBb ?? 0);
  const anteType = selection.anteType ?? ANTE_TYPES.NONE;
  if (customAccounting && (![collectionBb, anteBb].every((amount) => Number.isFinite(amount) && amount >= 0 && amount <= 10)
    || !Object.values(ANTE_TYPES).includes(anteType))) throw new RangeError('Invalid Game Setup accounting assumptions');
  return Object.freeze({
    environment,
    tableSize,
    heroPosition,
    effectiveStackBb,
    decisionFamily,
    actionAware: actionAware || customAccounting,
    ...(customAccounting ? { collectionBb, anteBb, anteType } : {}),
  });
}

const CALIBRATION_CONTEXT_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

function calibrationContextState(selection, handClass = null) {
  let rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: selection.environment === CALIBRATION_ENVIRONMENTS.CLUBGG
      ? GAME_MODES.CLUBGG : GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, selection.tableSize);
  if (selection.environment === CALIBRATION_ENVIRONMENTS.CUSTOM) {
    const definition = cloneData(rulesSnapshot.definition);
    definition.blinds.chipUnitMilliBb = 1;
    definition.ante = { type: selection.anteType, amountMilliBb: Math.round(selection.anteBb * 1000) };
    if (selection.collectionBb > 0) {
      const legacyCollection = createGameRulesSnapshotFromLegacyGameConfiguration({
        mode: GAME_MODES.CLUBGG, smallBlindMilliBb: 500, bigBlindMilliBb: 1000,
        chipUnitMilliBb: 1, ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
      }, 8).definition.collectionPolicy;
      definition.collectionPolicy = { ...legacyCollection, amountMilliBb: Math.round(selection.collectionBb * 1000) };
    }
    rulesSnapshot = createGameRulesSnapshot({ source: { kind: 'direct' }, setup: { seatedPlayers: selection.tableSize }, definition });
  }
  const players = Array.from({ length: selection.tableSize }, (_, seat) => ({
    playerId: `calibration-player-${seat}`,
    seat,
    startingStackMilliBb: Math.round(selection.effectiveStackBb * 1000),
  }));
  const state = initializeHandFromGameRulesSnapshot({
    handId: `calibration-context-${selection.tableSize}-${selection.effectiveStackBb}`,
    rulesSnapshot,
    buttonSeat: selection.tableSize - 1,
    players,
  });
  const heroId = state.players.find((player) => player.position === selection.heroPosition)?.playerId;
  const heroCards = handClass ? getHoldemCombosForHandClass(handClass)[0].cards : null;
  const availableCards = CALIBRATION_CONTEXT_DECK.filter((card) => !heroCards?.includes(card));
  let cardIndex = 0;
  const cardsByPlayer = Object.fromEntries(players.map((player) => {
    const cards = heroCards && player.playerId === heroId ? heroCards : availableCards.slice(cardIndex, cardIndex += 2);
    return [player.playerId, cards];
  }));
  return applyChance(state, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer });
}

function calibrationSearchKey(state) {
  return JSON.stringify({
    actor: state.actingPlayerId,
    currentBet: state.currentBetMilliBb,
    increment: state.lastFullRaiseIncrementMilliBb,
    players: state.players.map((player) => [
      player.playerId,
      player.status,
      player.currentStackMilliBb,
      player.streetContributionMilliBb,
    ]),
    history: state.actionHistory.map((record) => [
      record.actorPlayerId,
      record.submittedAction.type,
      record.currentBetAfterMilliBb,
    ]),
  });
}

function nextCalibrationContextStates(state, targetFamily) {
  const legal = getLegalActionSpec(state);
  const aggressionCount = state.actionHistory.filter((record) => (
    record.street === STREETS.PREFLOP
    && record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb
  )).length;
  const actions = [];
  if (legal.fold.available) actions.push(createAction(state.actingPlayerId, ACTION_TYPES.FOLD));
  if (legal.call.available) actions.push(createAction(state.actingPlayerId, ACTION_TYPES.CALL));
  if (legal.check.available) actions.push(createAction(state.actingPlayerId, ACTION_TYPES.CHECK));
  if (legal.raise.available && aggressionCount < 3
    && targetFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP
    && targetFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION) {
    actions.unshift(createAction(
      state.actingPlayerId,
      ACTION_TYPES.RAISE,
      legal.raise.minToMilliBb,
    ));
  }
  return actions.flatMap((action) => {
    try {
      const next = applyAction(state, action);
      return next.phase === PHASES.BETTING && next.street === STREETS.PREFLOP
        ? [next] : [];
    } catch {
      return [];
    }
  });
}

export function createCanonicalPreflopStateFromSelection(selection, { handClass = null } = {}) {
  const normalized = normalizeRfiContextSelection(selection, {
    environmentDefault: selection?.environment,
  });
  const initial = calibrationContextState(normalized, handClass);
  const hero = initial.players.find((player) => player.position === normalized.heroPosition);
  if (!hero) throw new RangeError('Selected Hero position is unavailable');
  const queue = [initial];
  const seen = new Set();
  const maximumActions = normalized.tableSize * 2 + 5;
  while (queue.length) {
    const state = queue.shift();
    const key = calibrationSearchKey(state);
    if (seen.has(key)) continue;
    seen.add(key);
    if (state.actingPlayerId === hero.playerId) {
      try {
        const context = derivePreflopCalibrationContextFromPokerState(state, hero.playerId);
        if (context.decisionFamily === normalized.decisionFamily) return Object.freeze({ state, heroPlayerId: hero.playerId, context });
      } catch {
        // Continue searching legal canonical trajectories.
      }
    }
    if (state.actionHistory.length >= maximumActions) continue;
    queue.push(...nextCalibrationContextStates(state, normalized.decisionFamily));
  }
  throw new RangeError('No canonical preflop trajectory matches this context selection');
}

export function createCanonicalPreflopContextFromSelection(selection) {
  return createCanonicalPreflopStateFromSelection(selection).context;
}

export function createContextFromSelection(selection) {
  const normalized = normalizeRfiContextSelection(selection, {
    environmentDefault: selection?.environment,
  });
  if (!normalized.actionAware
    && normalized.decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    const rules = CALIBRATION_ENVIRONMENT_RULES[normalized.environment];
    return createRfiCalibrationContext({
      gameRulesId: rules.gameRulesId,
      tableSize: normalized.tableSize,
      heroPosition: normalized.heroPosition,
      effectiveStackBb: normalized.effectiveStackBb,
      accounting: rules.accounting,
    });
  }
  return createCanonicalPreflopContextFromSelection(normalized);
}

function emptyPreferences() {
  return {
    schemaVersion: RANGE_CALIBRATION_PREFERENCES_SCHEMA,
    selectedProfileId: null,
    byProfile: {},
  };
}

function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== RANGE_CALIBRATION_PREFERENCES_SCHEMA
    || !value.byProfile || typeof value.byProfile !== 'object' || Array.isArray(value.byProfile)) {
    throw new TypeError('Range Calibration preferences are incompatible');
  }
  if (value.selectedProfileId !== null && typeof value.selectedProfileId !== 'string') {
    throw new TypeError('Range Calibration selected profile is invalid');
  }
  for (const [profileId, entry] of Object.entries(value.byProfile)) {
    if (!profileId || !entry || typeof entry !== 'object' || typeof entry.activeModeId !== 'string') {
      throw new TypeError('Range Calibration profile preference is invalid');
    }
    normalizeRfiContextSelection(entry.context, {
      environmentDefault: entry.context?.environment ?? CALIBRATION_ENVIRONMENTS.HOME,
    });
  }
  return value;
}

function loadPreferences(storage) {
  const serialized = storage.getItem(RANGE_CALIBRATION_PREFERENCES_KEY);
  if (serialized === null) return { value: emptyPreferences(), warning: null };
  try {
    const parsed = JSON.parse(serialized);
    validatePreferences(parsed);
    return { value: cloneData(parsed), warning: null };
  } catch (error) {
    return {
      value: emptyPreferences(),
      warning: Object.freeze({ code: 'invalid_preferences', cause: error }),
    };
  }
}

function persistPreferences(storage, preferences) {
  validatePreferences(preferences);
  storage.setItem(RANGE_CALIBRATION_PREFERENCES_KEY, JSON.stringify(preferences));
  return cloneData(preferences);
}

function getOrCreateOwnerRef(storage, idFactory) {
  let ownerId = storage.getItem(RANGE_CALIBRATION_OWNER_KEY);
  if (typeof ownerId !== 'string' || !ownerId.trim()) {
    ownerId = normalizeCalibrationName(idFactory('local-owner'), 'Local owner ID');
    storage.setItem(RANGE_CALIBRATION_OWNER_KEY, ownerId);
  }
  return createLocalOwnerRef(ownerId);
}

function activeProfilesAndModes(snapshot) {
  const profiles = snapshot.profiles.filter((profile) => profile.state === PROFILE_STATES.ACTIVE);
  const modesById = new Map(snapshot.modes.map((mode) => [mode.id, mode]));
  return profiles.map((profile) => ({
    profile,
    modes: profile.modeIds.map((id) => modesById.get(id)).filter(Boolean),
  }));
}

export function countCurrentDirectObservations(snapshot, { profileId, modeId, context }) {
  const contextKey = calibrationContextKey(context);
  const matching = snapshot.rangeObservations.filter((observation) => (
    observation.profileId === profileId
    && observation.modeId === modeId
    && calibrationContextKey(observation.context) === contextKey
  ));
  const superseded = new Set(matching.map((entry) => entry.revision.supersedesObservationId).filter(Boolean));
  return new Set(matching
    .filter((entry) => !superseded.has(entry.id) && entry.state === 'active')
    .map((entry) => entry.handClass)).size;
}

function currentDirectObservationMap(snapshot, { profileId, modeId, context, contextScope }) {
  const contextKey = calibrationContextKey(context ?? contextScope);
  const matching = snapshot.rangeObservations.filter((observation) => (
    observation.profileId === profileId
    && observation.modeId === modeId
    && calibrationContextKey(observation.context) === contextKey
  ));
  const superseded = new Set(matching.map((entry) => entry.revision.supersedesObservationId).filter(Boolean));
  return new Map(matching
    .filter((entry) => !superseded.has(entry.id) && entry.state === RANGE_OBSERVATION_STATES.ACTIVE)
    .map((entry) => [entry.handClass, entry]));
}

function currentDirectLeafMap(snapshot, { profileId, modeId, context, contextScope }) {
  const contextKey = calibrationContextKey(context ?? contextScope);
  return new Map(snapshot.rangeObservations
    .filter((observation) => observation.profileId === profileId
      && observation.modeId === modeId
      && calibrationContextKey(observation.context) === contextKey)
    .map((entry) => [entry.handClass, entry]));
}

function nextUnansweredPrompt(answered, startIndex = 0) {
  if (answered.size >= RANGE_CALIBRATION_QUESTION_ORDER.length) return null;
  const boundedStart = Math.min(
    Math.max(Number.isInteger(startIndex) ? startIndex : 0, 0),
    RANGE_CALIBRATION_QUESTION_ORDER.length,
  );
  for (let index = boundedStart; index < RANGE_CALIBRATION_QUESTION_ORDER.length; index += 1) {
    const handClass = RANGE_CALIBRATION_QUESTION_ORDER[index];
    if (!answered.has(handClass)) return Object.freeze({ index, handClass });
  }
  for (let index = 0; index < boundedStart; index += 1) {
    const handClass = RANGE_CALIBRATION_QUESTION_ORDER[index];
    if (!answered.has(handClass)) return Object.freeze({ index, handClass });
  }
  return null;
}

export function getSequentialCalibrationQuestion(answeredHandClasses = [], startIndex = 0) {
  const answered = new Set(answeredHandClasses);
  if ([...answered].some((handClass) => !PREFLOP_HAND_CLASSES.includes(handClass))) {
    throw new RangeError('Sequential calibration answers must use canonical hand classes');
  }
  return nextUnansweredPrompt(answered, startIndex);
}

function requireRfiAction(actionType) {
  if (!RFI_CALIBRATION_ACTION_TYPES.has(actionType)) {
    throw new RangeError('RFI calibration supports only canonical fold and raise actions');
  }
  return Object.freeze({ type: actionType });
}

function invalidRfiMix(message) {
  const error = new RangeError(message);
  error.code = RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION;
  return error;
}

function requireCalibrationAction(context, actionType) {
  const actionSet = getPersonalStrategyActionSetForContext(context);
  if (!actionSet.legalActions.some((action) => action.type === actionType)) {
    throw new RangeError('Action is not legal for the current Personal Strategy context');
  }
  return Object.freeze({ type: actionType });
}

function normalizeCalibrationMix(context, mix) {
  const actionSet = getPersonalStrategyActionSetForContext(context);
  const exactDistribution = normalizePersonalStrategyExactDistribution(actionSet, mix);
  return Object.freeze({
    dominantAction: derivePersonalStrategyDominantAction(exactDistribution),
    frequencies: Object.freeze(exactDistribution
      .filter((entry) => entry.probability > 0)
      .map((entry) => Object.freeze(cloneData(entry)))),
  });
}

export function isInvalidRfiMixError(error) {
  return error?.code === RANGE_CALIBRATION_INVALID_EXACT_DISTRIBUTION;
}

export function complementaryRfiMixFromFold(fold) {
  let foldPercent;
  try { foldPercent = Number(fold); } catch { foldPercent = Number.NaN; }
  if (!Number.isFinite(foldPercent) || foldPercent < 0 || foldPercent > 100) {
    throw invalidRfiMix('Fold and Raise frequencies must each be from 0 through 100');
  }
  const normalizedFold = Number(foldPercent.toFixed(6));
  return Object.freeze({
    fold: normalizedFold,
    raise: Number((100 - normalizedFold).toFixed(6)),
  });
}

export function normalizeRfiMix(mix = {}) {
  let values;
  try { values = [Number(mix?.fold), Number(mix?.raise)]; }
  catch { values = [Number.NaN, Number.NaN]; }
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw invalidRfiMix('Fold and Raise frequencies must each be from 0 through 100');
  }
  const total = values[0] + values[1];
  if (Math.abs(total - 100) > MIX_TOTAL_TOLERANCE) {
    throw invalidRfiMix('Fold and Raise frequencies must total 100%');
  }
  const tied = values[0] === values[1];
  const dominantAction = tied
    ? null
    : Object.freeze({ type: values[0] > values[1] ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE });
  return Object.freeze({
    dominantAction,
    frequencies: Object.freeze([
      Object.freeze({ action: Object.freeze({ type: ACTION_TYPES.FOLD }), probability: values[0] }),
      Object.freeze({ action: Object.freeze({ type: ACTION_TYPES.RAISE }), probability: values[1] }),
    ]),
  });
}

function matchingSession(snapshot, { profileId, modeId, context }) {
  const contextKey = calibrationContextKey(context);
  return snapshot.calibrationSessions
    .filter((session) => session.profileId === profileId
      && session.modeId === modeId
      && calibrationContextKey(session.contextScope) === contextKey)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

function recentActiveAnswer(session, leaves) {
  const observationsById = new Map([...leaves.values()].map((entry) => [entry.id, entry]));
  for (let index = session.observationIds.length - 1; index >= 0; index -= 1) {
    const observation = observationsById.get(session.observationIds[index]);
    if (observation?.state === RANGE_OBSERVATION_STATES.ACTIVE) return observation;
  }
  return null;
}

function cursorHandHistory(session, leaves) {
  if (Array.isArray(session.cursor.askedHandClasses)) return [...session.cursor.askedHandClasses];
  const leavesById = new Map([...leaves.values()].map((entry) => [entry.id, entry]));
  return session.observationIds
    .map((id) => leavesById.get(id)?.handClass ?? null)
    .filter(Boolean);
}

function adaptiveCursor(session, leaves, changes = {}) {
  const askedHandClasses = changes.askedHandClasses ?? cursorHandHistory(session, leaves);
  return {
    ...session.cursor,
    mappingFocus: changes.mappingFocus !== undefined ? changes.mappingFocus : session.cursor.mappingFocus ?? null,
    selectionPolicyVersion: RFI_QUESTION_SELECTION_POLICY_VERSION,
    stoppingPolicyVersion: RFI_STOPPING_POLICY_VERSION,
    coldStartPolicyVersion: RFI_COLD_START_POLICY_VERSION,
    calibrationIntent: normalizeRfiCalibrationIntent(
      changes.calibrationIntent ?? session.cursor.calibrationIntent,
    ),
    selectionIntent: normalizeRfiSelectionIntent(
      changes.selectionIntent ?? session.cursor.selectionIntent,
    ),
    rangeTeacherPreset: changes.rangeTeacherPreset !== undefined
      ? changes.rangeTeacherPreset : session.cursor.rangeTeacherPreset ?? null,
    askedHandClasses: [...askedHandClasses],
    skippedHandClasses: [...(changes.skippedHandClasses
      ?? session.cursor.skippedHandClasses ?? [])],
    notSureHandClasses: [...(changes.notSureHandClasses
      ?? session.cursor.notSureHandClasses ?? [])],
    sessionQuestionCount: changes.sessionQuestionCount
      ?? session.cursor.sessionQuestionCount
      ?? askedHandClasses.length,
    additionalQuestionAllowance: changes.additionalQuestionAllowance
      ?? session.cursor.additionalQuestionAllowance
      ?? 0,
    refinementBatchSize: changes.refinementBatchSize
      ?? session.cursor.refinementBatchSize
      ?? 0,
    refinementBatchRemaining: changes.refinementBatchRemaining
      ?? session.cursor.refinementBatchRemaining
      ?? 0,
    refinementActive: changes.refinementActive
      ?? session.cursor.refinementActive
      ?? false,
    lastStopReason: changes.lastStopReason !== undefined
      ? changes.lastStopReason : session.cursor.lastStopReason ?? null,
    forcedHandClass: changes.forcedHandClass !== undefined
      ? changes.forcedHandClass : session.cursor.forcedHandClass ?? null,
    userDirectedHandClass: changes.userDirectedHandClass !== undefined
      ? changes.userDirectedHandClass : session.cursor.userDirectedHandClass ?? null,
  };
}

function candidateAsPrompt(candidate) {
  if (!candidate) return null;
  return Object.freeze({ ...candidate, index: candidate.canonicalIndex });
}

function inferenceAvailableForContext(context) {
  const types = getPersonalStrategyActionSetForContext(context).legalActions.map((entry) => entry.type);
  return context.decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    && types.length === 2
    && types[0] === ACTION_TYPES.FOLD
    && types[1] === ACTION_TYPES.RAISE;
}

function firstInSubspaceInferenceAvailable(context) {
  const types = getPersonalStrategyActionSetForContext(context).legalActions.map((entry) => entry.type);
  return context.decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
    && types.includes(ACTION_TYPES.FOLD)
    && types.includes(ACTION_TYPES.RAISE)
    && types.some((type) => ![ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(type));
}

function firstInCompatibilityContext(context) {
  const clubGgAccounting = context.gameRules.collection.type === 'fixed_per_seated_player';
  return createRfiCalibrationContext({
    gameRulesId: clubGgAccounting ? 'riverline-clubgg-v1' : 'riverline-home-v1',
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    effectiveStackBb: context.stack.valueBb,
    accounting: {
      anteType: context.gameRules.ante.type,
      anteBb: context.gameRules.ante.amountBb,
      forcedContributionPerPlayerBb: context.gameRules.collection.amountPerPlayerBb,
      rakeMode: clubGgAccounting ? 'fixed_per_seated_player' : 'off',
    },
  });
}

function activeObservationHeads(observations) {
  const referenced = new Set(observations
    .map((observation) => observation.revision.supersedesObservationId)
    .filter((id) => id !== null));
  return observations.filter((observation) => (
    !referenced.has(observation.id) && observation.state === RANGE_OBSERVATION_STATES.ACTIVE
  ));
}

function supportsFoldRaiseSubspace(observation) {
  const dominant = observation.dominantAction?.type ?? null;
  if (dominant !== null && ![ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(dominant)) return false;
  if (observation.frequencies === null) return dominant !== null;
  return observation.frequencies.every((entry) => (
    [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(entry.action.type)
    || entry.probability === 0
  ));
}

function foldRaiseCompatibleGroups(observations) {
  const byHand = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, []]));
  observations.forEach((observation) => byHand.get(observation.handClass)?.push(observation));
  return [...byHand.entries()].flatMap(([, group]) => {
    const heads = activeObservationHeads(group);
    return heads.length > 0 && heads.every(supportsFoldRaiseSubspace) ? group : [];
  });
}

function observationInContext(observation, context, { foldRaiseOnly = false } = {}) {
  const projected = cloneData(observation);
  projected.context = cloneData(context);
  if (foldRaiseOnly && projected.frequencies !== null
    && supportsFoldRaiseSubspace(projected)) {
    projected.frequencies = projected.frequencies.filter((entry) => (
      [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(entry.action.type)
    ));
  }
  return projected;
}

function dedupeEvidenceRecords(records) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function directEvidenceHandClasses(evidenceView) {
  return new Set(evidenceView.points.filter((point) => (
    point.resolution === 'direct_dominant'
    || point.resolution === 'direct_exact'
    || point.resolution === 'conflicting'
  )).map((point) => point.handClass));
}

const ACTION_SHORTCUTS = Object.freeze({
  [ACTION_TYPES.FOLD]: 'F',
  [ACTION_TYPES.CHECK]: 'K',
  [ACTION_TYPES.CALL]: 'C',
  [ACTION_TYPES.RAISE]: 'R',
  [ACTION_TYPES.ALL_IN]: 'A',
});

function availableActionsForContext(context) {
  return Object.freeze(getPersonalStrategyActionSetForContext(context).legalActions.map((action) => (
    Object.freeze({ type: action.type, shortcut: ACTION_SHORTCUTS[action.type] })
  )));
}

function directOnlyQuestionCandidate(handClass, rank = 1) {
  const canonicalIndex = PREFLOP_HAND_CLASSES.indexOf(handClass);
  return Object.freeze({
    handClass,
    canonicalIndex,
    rank,
    questionKind: 'ordinary_observation',
    ordinaryQuestionEligible: true,
    questionValueScore: 0,
    questionValueSemantics: 'direct-only action-aware family; inference unavailable',
    boundaryLikelihood: 'unknown',
    evidenceDensity: 'none',
    structuralFamily: 'unmodeled_family',
    currentStatus: 'unknown',
    priorityReasons: ['unsupported_decision_family'],
    reasonCodes: ['unsupported_decision_family'],
    recommendedClarification: false,
    exactMixRefinementBand: 'none',
  });
}

function directOnlyCandidateRanking(evidenceView, cursor) {
  const answered = new Set(evidenceView.points
    .filter((point) => point.resolution === 'direct_dominant' || point.resolution === 'direct_exact')
    .map((point) => point.handClass));
  const skipped = new Set([
    ...(cursor.skippedHandClasses ?? []),
    ...(cursor.notSureHandClasses ?? []),
  ]);
  return PREFLOP_HAND_CLASSES.filter((handClass) => !answered.has(handClass) && !skipped.has(handClass))
    .map((handClass, rank) => directOnlyQuestionCandidate(handClass, rank + 1));
}

function directOnlyProgress(evidenceView, cursor, candidateRanking) {
  const directCount = evidenceView.summary.directlyAnsweredHandCount;
  const conflictingCount = evidenceView.summary.conflictingHandCount;
  const sessionQuestionCount = cursor.sessionQuestionCount ?? 0;
  const intent = normalizeRfiCalibrationIntent(cursor.calibrationIntent);
  const limit = intent === RFI_CALIBRATION_INTENTS.MAPPING ? Infinity : intent === RFI_CALIBRATION_INTENTS.QUICK ? 5
    : intent === RFI_CALIBRATION_INTENTS.DEEP ? 75
      : intent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE ? 169 : 30;
  const shouldStop = sessionQuestionCount >= limit || candidateRanking.length === 0;
  return Object.freeze({
    directCount,
    locallyInferredCount: 0,
    transferredCount: 0,
    uncertainCount: 0,
    visibleUnknownCount: Math.max(0, 169 - directCount - conflictingCount),
    conflictingCount,
    modeledHandCount: 0,
    recommendedClarificationCount: 0,
    highValueQuestionCount: 0,
    shouldStop,
    stopReason: shouldStop
      ? candidateRanking.length === 0
        ? RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE
        : RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED
      : null,
    profileReadiness: Object.freeze({
      state: conflictingCount > 0 ? 'conflicted' : 'building',
      profileReady: false,
      inferenceAvailable: false,
      blockerReasons: ['unsupported_decision_family'],
      reasons: [Object.freeze({ messageKey: 'Family-specific inference is unavailable; direct answers remain authoritative.' })],
      uncertainRegionCount: 0,
      nextClarificationPriorities: [],
      majorUnexploredRegions: [],
    }),
  });
}

function directOnlySelectionOutcome(evidenceView, cursor) {
  const candidateRanking = directOnlyCandidateRanking(evidenceView, cursor);
  const progressAssessment = directOnlyProgress(evidenceView, cursor, candidateRanking);
  const userDirected = cursor.userDirectedHandClass !== null
    && cursor.userDirectedHandClass !== undefined;
  const forced = cursor.forcedHandClass !== null
    && cursor.forcedHandClass !== undefined;
  const candidate = userDirected
    ? candidateRanking.find((entry) => entry.handClass === cursor.userDirectedHandClass)
      ?? directOnlyQuestionCandidate(cursor.userDirectedHandClass, 1)
    : forced
      ? candidateRanking.find((entry) => entry.handClass === cursor.forcedHandClass) ?? null
      : candidateRanking[0] ?? null;
  return Object.freeze({
    candidateRanking,
    progressAssessment,
    prompt: progressAssessment.shouldStop && !userDirected ? null : candidateAsPrompt(candidate),
  });
}

function emptyDirectSupport(handClass) {
  return Object.freeze({
    targetHandClass: handClass,
    evidenceDensity: 'none',
    supportDirection: 'none',
    boundaryLikelihood: 'unknown',
    conflictProximity: 'none',
    nearbyDisagreementCount: 0,
    nearbyBoundaryCount: 0,
    nearbyConflictCount: 0,
    selectedNeighbors: [],
    scopeLocalStability: null,
    regionalInterpolation: null,
  });
}

function directOnlyMatrixProjection(evidenceView, candidateRanking, progressAssessment) {
  const candidateByHand = new Map(candidateRanking.map((candidate) => [candidate.handClass, candidate]));
  const directById = new Map(evidenceView.directEvidence.map((entry) => [entry.evidenceId, entry]));
  const cells = evidenceView.points.map((point, index) => {
    const conflicting = point.resolution === 'conflicting';
    const direct = point.resolution === 'direct_dominant' || point.resolution === 'direct_exact';
    const exactFrequencies = direct ? point.strategyValue.exactFrequencies : null;
    const dominantAction = direct ? point.strategyValue.dominantAction?.type ?? null : null;
    const tied = exactFrequencies !== null && dominantAction === null;
    const precision = tied ? 'tied_exact_mix'
      : exactFrequencies === null ? dominantAction ? 'dominant_only' : 'unknown'
        : exactFrequencies.length === 1 && exactFrequencies[0].probability === 1
          ? 'pure_explicit' : 'exact_mix';
    const activeDirect = point.activeDirectHeadIds.map((id) => directById.get(id)).filter(Boolean);
    const directHistory = evidenceView.directEvidence.filter((entry) => entry.target.id === point.handClass);
    const kind = conflicting ? 'conflict' : tied ? 'mixed' : dominantAction ?? 'none';
    return Object.freeze({
      handClass: point.handClass,
      canonicalIndex: index,
      row: Math.floor(index / 13),
      column: index % 13,
      status: conflicting ? 'conflicting' : direct ? 'directly_known' : 'unknown',
      localStatus: conflicting ? 'conflicting' : direct ? 'directly_known' : 'unknown',
      statusMarker: conflicting ? '!' : direct ? 'D' : '·',
      provenance: direct ? 'direct' : 'unknown',
      action: Object.freeze({ kind, dominantAction, exactFrequencies, precision }),
      sourceEvidenceIds: [...point.sourceEvidenceIds],
      sourceEvidenceCount: point.sourceEvidenceIds.length,
      reasons: direct ? ['direct_action_evidence'] : ['unsupported_decision_family'],
      uncertainty: null,
      support: emptyDirectSupport(point.handClass),
      evidence: Object.freeze({
        activeDirect,
        directHistory,
        supersededDirect: directHistory.filter((entry) => entry.headState === 'superseded'),
        retractedDirect: directHistory.filter((entry) => entry.headState === 'retracted'),
        training: [],
      }),
      transfer: null,
      question: candidateByHand.get(point.handClass) ?? null,
      comboOverrides: [],
      hasComboOverrides: false,
    });
  });
  return Object.freeze({
    schemaVersion: 'personal-strategy-matrix-projection/v1',
    scope: cloneData(evidenceView.scope),
    actionUniverse: cloneData(getPersonalStrategyActionSetForContext(
      evidenceView.scope.context,
    ).legalActions),
    evidenceRevision: Object.freeze({
      activeHeadIds: [...evidenceView.activeHeadIds],
      fingerprint: evidenceView.evidenceFingerprint,
    }),
    derivation: Object.freeze({
      inferenceAlgorithmVersion: 'personal-strategy-family-inference-unavailable/v1',
      matrixProjectionVersion: 'personal-strategy-matrix-projection/v1',
    }),
    cells: Object.freeze(cells),
    summary: Object.freeze({
      directlyKnownCount: progressAssessment.directCount,
      inferredHighCount: 0,
      inferredMediumCount: 0,
      uncertainCount: 0,
      conflictingCount: progressAssessment.conflictingCount,
      unknownCount: progressAssessment.visibleUnknownCount,
      transferredCount: 0,
    }),
    localSummary: null,
    profileReadiness: progressAssessment.profileReadiness,
    comboOverrideCount: 0,
  });
}

function directOnlyTeacherView(evidenceView, progressAssessment, selectedHandClass = null) {
  return Object.freeze({
    schemaVersion: 'range-teacher-view/v1',
    scope: cloneData(evidenceView.scope),
    summary: Object.freeze({
      directCount: progressAssessment.directCount,
      inferredHighCount: 0,
      inferredMediumCount: 0,
      transferredCount: 0,
      uncertainCount: 0,
      unknownCount: progressAssessment.visibleUnknownCount,
      conflictingCount: progressAssessment.conflictingCount,
      readinessState: progressAssessment.profileReadiness.state,
      profileReady: false,
      inferenceAvailable: false,
    }),
    recommendedAction: null,
    importantBoundaries: [],
    contradictionHotspots: [],
    transferredInsights: [],
    sparseRegions: [],
    exactMixRefinementCandidates: [],
    recentChanges: [],
    selectedHand: selectedHandClass ? Object.freeze({ handClass: selectedHandClass }) : null,
  });
}

function calibrationSelectionOutcome(
  personalStrategySnapshot,
  transferProjection,
  session,
  cursor,
  answered,
  excludedHandClasses = new Set(),
  mappingEvidenceView = null,
) {
  const refinementActive = cursor.refinementActive === true
    && cursor.refinementBatchRemaining > 0;
  const candidateRanking = rankCalibrationCandidates(personalStrategySnapshot, {
    intent: cursor.calibrationIntent,
    mappingFocus: cursor.mappingFocus,
    mappingEvidenceView,
    recentQuestionHistory: cursor.askedHandClasses,
    skippedHandClasses: cursor.skippedHandClasses,
    includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
    selectionIntent: cursor.selectionIntent,
    transferProjection,
  }).filter((candidate) => !excludedHandClasses.has(candidate.handClass)
    || (cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.MAPPING && candidate.questionKind === 'conflict_resolution'));
  let candidate;
  const userDirected = cursor.userDirectedHandClass !== null
    && cursor.userDirectedHandClass !== undefined;
  if (userDirected) {
    candidate = createUserDirectedMatrixQuestion(
      personalStrategySnapshot,
      cursor.userDirectedHandClass,
      { rankedCandidates: candidateRanking },
    );
  } else if (cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
    const sequential = nextUnansweredPrompt(answered, cursor.nextPromptIndex);
    candidate = sequential
      ? candidateRanking.find((entry) => entry.handClass === sequential.handClass) ?? null
      : null;
  } else if (cursor.forcedHandClass) {
    candidate = candidateRanking.find((entry) => (
      entry.handClass === cursor.forcedHandClass && entry.ordinaryQuestionEligible
    )) ?? getNextCalibrationQuestion(personalStrategySnapshot, { rankedCandidates: candidateRanking });
  }
  const progressAssessment = assessCalibrationProgress(personalStrategySnapshot, {
    intent: cursor.calibrationIntent,
    mappingEvidenceView,
    rankedCandidates: candidateRanking,
    sessionQuestionCount: cursor.sessionQuestionCount,
    additionalQuestionAllowance: cursor.additionalQuestionAllowance,
    refinementActive: cursor.refinementActive === true,
    refinementBatchRemaining: cursor.refinementBatchRemaining,
    transferProjection,
    userPaused: session.state === CALIBRATION_SESSION_STATES.PAUSED,
    userStopped: session.state === CALIBRATION_SESSION_STATES.PAUSED
      && cursor.lastStopReason === RFI_CALIBRATION_STOP_REASONS.USER_STOPPED,
  });
  if (!candidate && !progressAssessment.shouldStop) {
    candidate = cursor.calibrationIntent !== RFI_CALIBRATION_INTENTS.MAPPING && (progressAssessment.profileReadiness.profileReady || refinementActive)
      ? candidateRanking.find((entry) => (
        entry.ordinaryQuestionEligible && entry.recommendedClarification
      )) ?? null
      : getNextCalibrationQuestion(personalStrategySnapshot, { rankedCandidates: candidateRanking });
  }
  return {
    candidateRanking,
    progressAssessment,
    prompt: progressAssessment.shouldStop && !userDirected ? null : candidateAsPrompt(candidate),
  };
}

function rebaseFirstInSnapshot(snapshot, evidenceView) {
  return Object.freeze({
    ...snapshot,
    scope: cloneData(evidenceView.scope),
    actionUniverse: cloneData(getPersonalStrategyActionSetForContext(
      evidenceView.scope.context,
    ).legalActions),
    evidenceRevision: Object.freeze({
      activeHeadIds: [...evidenceView.activeHeadIds],
      fingerprint: evidenceView.evidenceFingerprint,
    }),
    derivation: Object.freeze({
      ...snapshot.derivation,
      firstInActionSubspaceVersion: 'personal-strategy-first-in-fold-raise-subspace/v1',
    }),
    estimates: Object.freeze(snapshot.estimates.map((estimate) => Object.freeze({
      ...estimate,
      strategySpotContext: cloneData(evidenceView.scope.strategySpotContext),
      contextKey: evidenceView.scope.contextKey,
    }))),
  });
}

function rebaseFirstInTransferProjection(transferProjection, snapshot) {
  if (!transferProjection) return null;
  return Object.freeze({
    ...transferProjection,
    scope: cloneData(snapshot.scope),
    targetEvidenceFingerprint: snapshot.evidenceRevision.fingerprint,
  });
}

async function firstInProjectionBundle(projectionService, scope, {
  additionalRangeObservations = [],
  suppliedSource = null,
} = {}) {
  const compatibilityContext = firstInCompatibilityContext(scope.context);
  const compatibilityScope = { ...scope, context: compatibilityContext };
  const actionSource = suppliedSource?.actionAware ?? await projectionService.getEvidenceSource(scope);
  const compatibilitySource = suppliedSource?.compatibility
    ?? await projectionService.getEvidenceSource(compatibilityScope);
  const actionRange = dedupeEvidenceRecords([
    ...actionSource.rangeObservations,
    ...additionalRangeObservations,
  ]);
  const actionHands = new Set(actionRange.map((observation) => observation.handClass));
  const compatibleLegacyRange = foldRaiseCompatibleGroups(
    compatibilitySource.rangeObservations.filter((observation) => !actionHands.has(observation.handClass)),
  );
  const compatibleActionRange = foldRaiseCompatibleGroups(actionRange);
  const displayRange = dedupeEvidenceRecords([
    ...actionRange,
    ...compatibleLegacyRange.map((observation) => observationInContext(
      observation,
      scope.context,
    )),
  ]);
  const inferenceRange = dedupeEvidenceRecords([
    ...compatibleLegacyRange,
    ...compatibleActionRange.map((observation) => observationInContext(
      observation,
      compatibilityContext,
      { foldRaiseOnly: true },
    )),
  ]);
  const evidenceView = createPersonalStrategyEvidenceView({
    ...scope,
    rangeObservations: displayRange,
    trainingObservations: [],
  });
  const compatibilityBundle = await projectionService.previewProjectionBundle(
    compatibilityScope,
    {
      source: {
        rangeObservations: inferenceRange,
        trainingObservations: compatibilitySource.trainingObservations,
      },
    },
  );
  const snapshot = rebaseFirstInSnapshot(compatibilityBundle.snapshot, evidenceView);
  return Object.freeze({
    evidenceView,
    snapshot,
    transferProjection: rebaseFirstInTransferProjection(
      compatibilityBundle.transferProjection,
      snapshot,
    ),
    source: Object.freeze({
      actionAware: actionSource,
      compatibility: compatibilitySource,
    }),
  });
}

function firstInProgressAssessment(progressAssessment, evidenceView, matrixProjection) {
  const summary = matrixProjection.summary;
  const unmodeledActions = getPersonalStrategyActionSetForContext(
    evidenceView.scope.context,
  ).legalActions.map((action) => action.type).filter((type) => (
    ![ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(type)
  ));
  return Object.freeze({
    ...progressAssessment,
    directCount: summary.directlyKnownCount,
    locallyInferredCount: summary.inferredHighCount + summary.inferredMediumCount,
    transferredCount: summary.transferredCount,
    uncertainCount: summary.uncertainCount,
    visibleUnknownCount: summary.unknownCount,
    conflictingCount: summary.conflictingCount,
    modeledHandCount: summary.inferredHighCount
      + summary.inferredMediumCount
      + summary.transferredCount,
    profileReadiness: Object.freeze({
      ...progressAssessment.profileReadiness,
      inferenceAvailable: true,
      partialActionModel: true,
      unmodeledActions: Object.freeze(unmodeledActions),
    }),
  });
}

function firstInMatrixProjection(evidenceView, baseProjection, candidateRanking, progressAssessment) {
  const directProjection = directOnlyMatrixProjection(
    evidenceView,
    candidateRanking,
    progressAssessment,
  );
  const directByHand = new Map(directProjection.cells.map((cell) => [cell.handClass, cell]));
  const cells = baseProjection.cells.map((cell) => {
    const direct = directByHand.get(cell.handClass);
    if (direct.status === 'directly_known' || direct.status === 'conflicting') return direct;
    return Object.freeze({
      ...cell,
      reasons: Object.freeze([...new Set([
        ...cell.reasons,
        'additional_first_in_actions_unmodeled',
      ])]),
    });
  });
  const count = (status) => cells.filter((cell) => cell.status === status).length;
  const unmodeledActions = getPersonalStrategyActionSetForContext(
    evidenceView.scope.context,
  ).legalActions.map((action) => action.type).filter((type) => (
    ![ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(type)
  ));
  return Object.freeze({
    ...baseProjection,
    actionUniverse: cloneData(getPersonalStrategyActionSetForContext(
      evidenceView.scope.context,
    ).legalActions),
    cells: Object.freeze(cells),
    profileReadiness: Object.freeze({
      ...baseProjection.profileReadiness,
      inferenceAvailable: true,
      partialActionModel: true,
      unmodeledActions: Object.freeze(unmodeledActions),
    }),
    summary: Object.freeze({
      directlyKnownCount: count('directly_known'),
      inferredHighCount: count('inferred_high'),
      inferredMediumCount: count('inferred_medium'),
      uncertainCount: count('uncertain'),
      conflictingCount: count('conflicting'),
      unknownCount: count('unknown'),
      transferredCount: count('transferred'),
      transferUncertainCount: baseProjection.summary.transferUncertainCount ?? 0,
    }),
  });
}

function firstInTeacherView(teacherView, matrixProjection, progressAssessment) {
  const summary = matrixProjection.summary;
  return Object.freeze({
    ...teacherView,
    summary: Object.freeze({
      ...teacherView.summary,
      directCount: summary.directlyKnownCount,
      inferredHighCount: summary.inferredHighCount,
      inferredMediumCount: summary.inferredMediumCount,
      transferredCount: summary.transferredCount,
      uncertainCount: summary.uncertainCount,
      unknownCount: summary.unknownCount,
      conflictingCount: summary.conflictingCount,
      inferenceAvailable: true,
      partialActionModel: true,
      unmodeledActions: progressAssessment.profileReadiness.unmodeledActions,
    }),
  });
}

async function calibrationState(
  snapshot,
  session,
  projectionService,
  operationMetrics = null,
  suppliedLeaves = null,
  suppliedWorkspaceLeafIndexes = null,
) {
  const leaves = suppliedLeaves ?? currentDirectLeafMap(snapshot, session);
  const workspaceLeafIndexes = suppliedWorkspaceLeafIndexes ?? new Map(
    snapshot.rangeObservations.map((entry, index) => [rangeObservationKey(entry), index]),
  );
  const answered = new Map([...leaves]
    .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
  const cursor = adaptiveCursor(session, leaves);
  const firstInSubspace = firstInSubspaceInferenceAvailable(session.contextScope);
  if (!inferenceAvailableForContext(session.contextScope) && !firstInSubspace) {
    const source = await projectionService.getEvidenceSource({
      profileId: session.profileId,
      modeId: session.modeId,
      context: session.contextScope,
    });
    const evidenceView = createPersonalStrategyEvidenceView({
      profileId: session.profileId,
      modeId: session.modeId,
      context: session.contextScope,
      rangeObservations: source.rangeObservations,
      trainingObservations: source.trainingObservations,
    });
    const { candidateRanking, progressAssessment, prompt } = directOnlySelectionOutcome(
      evidenceView,
      cursor,
    );
    const matrixProjection = directOnlyMatrixProjection(
      evidenceView,
      candidateRanking,
      progressAssessment,
    );
    return Object.freeze({
      snapshot,
      session,
      prompt,
      questionExplanation: prompt ? Object.freeze({
        headline: 'Collects direct evidence for this decision family',
        reasons: ['unsupported_decision_family'],
      }) : null,
      candidateRanking,
      personalStrategySnapshot: null,
      personalStrategyEvidenceView: evidenceView,
      personalStrategyTransferProjection: null,
      personalStrategyMatrixProjection: matrixProjection,
      rangeTeacherView: directOnlyTeacherView(evidenceView, progressAssessment, prompt?.handClass),
      projectionSource: Object.freeze({
        rangeObservations: Object.freeze([...source.rangeObservations]),
        trainingObservations: Object.freeze([...source.trainingObservations]),
      }),
      projectionMode: 'direct_only',
      progressAssessment,
      availableActions: availableActionsForContext(session.contextScope),
      progress: Object.freeze({
        ...(progressAssessment.coverage ? { coverage: progressAssessment.coverage } : {}),
        answered: answered.size,
        remaining: RANGE_CALIBRATION_QUESTION_ORDER.length - answered.size,
        total: RANGE_CALIBRATION_QUESTION_ORDER.length,
      }),
      previousAnswer: recentActiveAnswer(session, leaves),
      scopeLeaves: Object.freeze([...leaves.values()]),
      workspaceLeafIndexes,
      operationMetrics,
    });
  }
  const projectionScope = {
    profileId: session.profileId,
    modeId: session.modeId,
    context: session.contextScope,
  };
  const projectionBundle = firstInSubspace
    ? await firstInProjectionBundle(projectionService, projectionScope)
    : await projectionService.getProjectionBundle(projectionScope);
  const personalStrategySnapshot = projectionBundle.snapshot;
  const selectionOutcome = calibrationSelectionOutcome(
    personalStrategySnapshot,
    projectionBundle.transferProjection,
    session,
    cursor,
    answered,
    firstInSubspace ? directEvidenceHandClasses(projectionBundle.evidenceView) : new Set(),
    projectionBundle.evidenceView,
  );
  const baseMatrixProjection = createPersonalStrategyMatrixProjection({
    snapshot: personalStrategySnapshot,
    evidenceView: projectionBundle.evidenceView,
    transferProjection: projectionBundle.transferProjection,
    candidateRanking: selectionOutcome.candidateRanking,
    highValueQuestionCount: selectionOutcome.progressAssessment.highValueQuestionCount,
    profileReadiness: selectionOutcome.progressAssessment.profileReadiness,
  });
  const personalStrategyMatrixProjection = firstInSubspace
    ? firstInMatrixProjection(
      projectionBundle.evidenceView,
      baseMatrixProjection,
      selectionOutcome.candidateRanking,
      selectionOutcome.progressAssessment,
    )
    : baseMatrixProjection;
  const progressAssessment = firstInSubspace
    ? firstInProgressAssessment(
      selectionOutcome.progressAssessment,
      projectionBundle.evidenceView,
      personalStrategyMatrixProjection,
    )
    : selectionOutcome.progressAssessment;
  const baseRangeTeacherView = createRangeTeacherView({
    snapshot: personalStrategySnapshot,
    evidenceView: projectionBundle.evidenceView,
    transferProjection: projectionBundle.transferProjection,
    candidateRanking: selectionOutcome.candidateRanking,
    progressAssessment,
    selectedHandClass: selectionOutcome.prompt?.handClass ?? null,
  });
  const rangeTeacherView = firstInSubspace
    ? firstInTeacherView(
      baseRangeTeacherView,
      personalStrategyMatrixProjection,
      progressAssessment,
    ) : baseRangeTeacherView;
  return Object.freeze({
    snapshot,
    session,
    prompt: selectionOutcome.prompt,
    questionExplanation: selectionOutcome.prompt
      ? getCalibrationQuestionExplanation(selectionOutcome.prompt) : null,
    candidateRanking: selectionOutcome.candidateRanking,
    personalStrategySnapshot,
    personalStrategyEvidenceView: projectionBundle.evidenceView,
    personalStrategyTransferProjection: projectionBundle.transferProjection,
    personalStrategyMatrixProjection,
    rangeTeacherView,
    projectionSource: projectionBundle.source,
    projectionMode: firstInSubspace ? 'first_in_rfi_subspace' : 'rfi_inference',
    progressAssessment,
    availableActions: firstInSubspace
      ? availableActionsForContext(session.contextScope) : RFI_CALIBRATION_ACTIONS,
    progress: Object.freeze({
      ...(progressAssessment.coverage ? { coverage: progressAssessment.coverage } : {}),
      answered: answered.size,
      remaining: RANGE_CALIBRATION_QUESTION_ORDER.length - answered.size,
      total: RANGE_CALIBRATION_QUESTION_ORDER.length,
    }),
    previousAnswer: recentActiveAnswer(session, leaves),
    scopeLeaves: Object.freeze([...leaves.values()]),
    workspaceLeafIndexes,
    operationMetrics,
  });
}

function snapshotMetadata(snapshot, metadata) {
  return {
    ...snapshot,
    revision: metadata.revision,
    updatedAt: metadata.updatedAt,
  };
}

function snapshotWithSession(snapshot, session, metadata) {
  const sessions = [...snapshot.calibrationSessions];
  const index = sessions.findIndex((entry) => entry.id === session.id);
  if (index < 0) sessions.push(session);
  else sessions[index] = session;
  return Object.freeze({
    ...snapshotMetadata(snapshot, metadata),
    calibrationSessions: Object.freeze(sessions),
  });
}

function snapshotWithObservationAndSession(snapshot, observation, session, metadata, workspaceLeafIndexes) {
  const observations = [...snapshot.rangeObservations];
  const key = rangeObservationKey(observation);
  const observationIndex = workspaceLeafIndexes.get(key);
  if (observationIndex === undefined) {
    workspaceLeafIndexes.set(key, observations.length);
    observations.push(observation);
  } else observations[observationIndex] = observation;
  const withSession = snapshotWithSession(snapshot, session, metadata);
  return Object.freeze({
    ...withSession,
    rangeObservations: Object.freeze(observations),
  });
}

function requireCalibrationState(value) {
  if (!value?.snapshot || !value?.session || !value?.progress) {
    throw new TypeError('An active calibration state is required');
  }
  return value;
}

function stalePersonalStrategyScope(label) {
  const error = new RangeError(`${label} state does not match the selected Personal Strategy scope`);
  error.code = PERSONAL_STRATEGY_STALE_SCOPE_ERROR;
  return error;
}

function requirePersonalStrategyMutationScope(activeState, scope, label) {
  if (!activeState) return null;
  const state = requireCalibrationState(activeState);
  const snapshotSession = state.snapshot.calibrationSessions.find((entry) => (
    entry.id === state.session.id
  ));
  const sameScope = state.session.profileId === scope.profileId
    && state.session.modeId === scope.modeId
    && calibrationContextKey(state.session.contextScope) === calibrationContextKey(scope.context);
  const sameSession = snapshotSession
    && snapshotSession.profileId === state.session.profileId
    && snapshotSession.modeId === state.session.modeId
    && calibrationContextKey(snapshotSession.contextScope)
      === calibrationContextKey(state.session.contextScope)
    && snapshotSession.updatedAt === state.session.updatedAt;
  if (!sameScope || !sameSession) throw stalePersonalStrategyScope(label);
  return state;
}

export function createIdentityScopedRangeCalibrationApplication(binding, options = {}) {
  const {
    storage = createPersonalStrategyBrowserStorage(),
    database = createIndexedDbPersonalStrategyDatabase({
      name: scopedDomainDatabaseName(PERSONAL_STRATEGY_DATABASE_NAME, binding),
    }),
    ...applicationOptions
  } = options;
  const scopedStorage = Object.freeze({
    getItem(key) { return storage.getItem(scopedPreferenceKey(key, binding)); },
    setItem(key, value) { return storage.setItem(scopedPreferenceKey(key, binding), value); },
  });
  return createRangeCalibrationApplication({
    ...applicationOptions,
    onLocalMutation: applicationOptions.onLocalMutation ?? ((mutation) => {
      if (typeof globalThis.window?.dispatchEvent !== 'function'
        || typeof globalThis.CustomEvent !== 'function') return;
      globalThis.window.dispatchEvent(new CustomEvent('riverline:personalstrategymutation', {
        detail: mutation,
      }));
    }),
    storage: scopedStorage,
    database,
    ownerRef: createLocalOwnerRef(binding.domainOwnerId),
  });
}

export function createRangeCalibrationApplication({
  storage = createPersonalStrategyBrowserStorage(),
  database = null,
  ownerRef = null,
  lifecycleScope = null,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  onLocalMutation = null,
} = {}) {
  requireStorage(storage);
  if (typeof clock !== 'function' || typeof idFactory !== 'function') {
    throw new TypeError('Range Calibration clock and idFactory must be functions');
  }
  if (onLocalMutation !== null && typeof onLocalMutation !== 'function') {
    throw new TypeError('Range Calibration onLocalMutation must be a function');
  }

  const storageMetrics = { reads: 0, writes: 0, readsByKey: {}, writesByKey: {} };
  const storageAdapter = {
    getItem(key) {
      lifecycleScope?.assertCurrent();
      storageMetrics.reads += 1;
      storageMetrics.readsByKey[key] = (storageMetrics.readsByKey[key] || 0) + 1;
      return storage.getItem(key);
    },
    setItem(key, value) {
      lifecycleScope?.assertCurrent();
      storageMetrics.writes += 1;
      storageMetrics.writesByKey[key] = (storageMetrics.writesByKey[key] || 0) + 1;
      return storage.setItem(key, value);
    },
  };

  const resolvedOwnerRef = ownerRef ?? getOrCreateOwnerRef(storageAdapter, idFactory);
  validateProfileOwnerRef(resolvedOwnerRef);
  const repository = createPersonalStrategyRepository({
    database,
    legacyStorage: storageAdapter,
    ownerRef: resolvedOwnerRef,
    lifecycleScope,
    clock,
  });
  const projectionService = createPersonalStrategyProjectionService({ repository });
  const qualitativeDrafts = new WeakMap();

  async function previewQualitativeIntent(scope, { text, language = 'en', scopeKind = 'decision', scopeDescription = '', supersedesEvidenceIds = [], exceptionTo = null, handClass = null } = {}) {
    if (!['decision', 'approach'].includes(scopeKind) || typeof scopeDescription !== 'string' || scopeDescription.length > 240) {
      throw new RangeError('Invalid qualitative intent scope');
    }
    if (handClass !== null && !PREFLOP_HAND_CLASSES.includes(handClass)) throw new RangeError('Qualitative hand scope must use a canonical hand class');
    const workspace = await readWorkspace();
    const entry = workspace.profiles.find((candidate) => candidate.profile.id === scope.profileId);
    const approach = entry?.modes.find((candidate) => candidate.id === scope.modeId);
    if (!approach) throw stalePersonalStrategyScope('Qualitative intent');
    const evidence = await repository.loadQualitativeEvidence(scope);
    const superseded = new Set(evidence.flatMap((record) => record.supersedesEvidenceIds ?? []));
    const heads = evidence.filter((record) => !superseded.has(record.id));
    if (supersedesEvidenceIds.some((id) => !heads.some((record) => record.id === id))) throw stalePersonalStrategyScope('Correction');
    if (exceptionTo && !heads.some((record) => record.id === exceptionTo)) throw stalePersonalStrategyScope('Exception');
    const statedScope = { kind: scopeKind, description: String(scopeDescription).trim(),
      ...(scopeKind === 'decision' ? { context: cloneData(scope.context), ...(handClass === null ? {} : { handClass }) } : {}),
      setupVersion: entry.profile.setupVersion, profileId: scope.profileId, modeId: scope.modeId };
    const preview = previewPersonalStrategyIntent({ text, language, scope: cloneData(scope), statedScope });
    qualitativeDrafts.set(preview, { scope: cloneData(scope), approachVersion: approach.approachVersion,
      setupVersion: entry.profile.setupVersion, statedScope, supersedesEvidenceIds: [...supersedesEvidenceIds], exceptionTo,
      affected: heads.filter((record) => supersedesEvidenceIds.includes(record.id)) });
    return preview;
  }

  async function confirmQualitativeIntent(preview) {
    const draft = qualitativeDrafts.get(preview);
    if (!draft) throw stalePersonalStrategyScope('Interpretation preview');
    const workspace = await readWorkspace();
    const entry = workspace.profiles.find((candidate) => candidate.profile.id === draft.scope.profileId);
    const approach = entry?.modes.find((candidate) => candidate.id === draft.scope.modeId);
    if (!approach || approach.approachVersion !== draft.approachVersion || entry.profile.setupVersion !== draft.setupVersion) {
      throw stalePersonalStrategyScope('Interpretation preview');
    }
    const createdAt = timestampFrom(clock);
    const record = createQualitativeEvidence({
      id: idFactory('qualitative-intent'), profileId: draft.scope.profileId, modeId: draft.scope.modeId,
      approachVersion: draft.approachVersion, originalWording: preview.originalText, language: preview.language,
      statedScope: draft.statedScope, inferredScope: preview.inferredScope,
      unresolvedTerms: preview.unresolvedTerms, interpretation: preview,
      confirmation: { state: 'confirmed', confirmedAt: createdAt },
      supersedesEvidenceIds: draft.supersedesEvidenceIds, correctionGroupId: idFactory('intent-correction'),
      provenance: { type: 'user_confirmed_interpretation', source: 'user_intent', surface: 'teach_riverline', exceptionTo: draft.exceptionTo }, createdAt,
    });
    await repository.appendQualitativeEvidence([record]);
    qualitativeDrafts.delete(preview);
    return record;
  }

  async function notifyLocalMutation(entities) {
    lifecycleScope?.assertCurrent();
    if (!onLocalMutation) return;
    try {
      await onLocalMutation(Object.freeze({
        schemaVersion: 'personal-strategy-local-mutation/v1',
        lifecycleScope,
        entities: Object.freeze(cloneData(entities)),
      }));
    } catch {
      // Local Personal Strategy transactions remain authoritative. The sync
      // status surface owns any sidecar/remote failure after commit.
    }
  }

  const rangeBuilder = createPersonalStrategyRangeBuilder({
    repository,
    projectionService,
    clock,
    idFactory,
    onCommitted: notifyLocalMutation,
  });

  async function settleCalibrationSession(
    snapshot,
    session,
    operationMetrics = null,
    suppliedLeaves = null,
    suppliedWorkspaceLeafIndexes = null,
  ) {
    const leaves = suppliedLeaves ?? currentDirectLeafMap(snapshot, session);
    let state = await calibrationState(
      snapshot,
      session,
      projectionService,
      operationMetrics,
      leaves,
      suppliedWorkspaceLeafIndexes,
    );
    if (session.state === CALIBRATION_SESSION_STATES.PAUSED) return state;
    const desiredState = state.prompt
      ? CALIBRATION_SESSION_STATES.ACTIVE
      : CALIBRATION_SESSION_STATES.COMPLETED;
    const desiredNextPromptIndex = state.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    const cursor = adaptiveCursor(session, leaves, {
      lastStopReason: state.prompt ? null : state.progressAssessment.stopReason,
      forcedHandClass: state.prompt?.handClass === session.cursor.forcedHandClass
        ? session.cursor.forcedHandClass : null,
      userDirectedHandClass: state.prompt?.handClass === session.cursor.userDirectedHandClass
        ? session.cursor.userDirectedHandClass : null,
    });
    cursor.nextPromptIndex = desiredNextPromptIndex;
    const cursorChanged = JSON.stringify(cursor) !== JSON.stringify(session.cursor);
    if (desiredState === session.state
      && desiredNextPromptIndex === session.cursor.nextPromptIndex
      && !cursorChanged) return state;
    const updatedAt = timestampNotBefore(clock, session.updatedAt);
    const settledSession = updateCalibrationSession(session, {
      state: desiredState,
      completedAt: desiredState === CALIBRATION_SESSION_STATES.COMPLETED ? updatedAt : null,
      nextPromptIndex: desiredNextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(settledSession, {
      expectedSession: session,
    });
    await notifyLocalMutation([settledSession]);
    const settledSnapshot = snapshotWithSession(snapshot, settledSession, metadata);
    state = await calibrationState(
      settledSnapshot,
      settledSession,
      projectionService,
      operationMetrics,
      leaves,
      state.workspaceLeafIndexes,
    );
    return state;
  }

  function profileBundleEntity(profile, modes) {
    return Object.freeze({
      syncEntityType: 'profile_bundle', id: profile.id,
      profile: cloneData(profile), modes: cloneData(modes),
    });
  }

  async function readWorkspace() {
    const snapshot = await repository.loadWorkspaceSnapshot();
    const preferences = loadPreferences(storageAdapter);
    return Object.freeze({
      ownerRef: resolvedOwnerRef,
      snapshot,
      profiles: activeProfilesAndModes(snapshot),
      preferences: preferences.value,
      preferenceWarning: preferences.warning,
    });
  }

  async function createProfile({ displayName, description, environment = CALIBRATION_ENVIRONMENTS.CUSTOM, modeNames = ['Usual'], setupAssumptions = {} }) {
    const createdAt = timestampFrom(clock);
    const normalizedModes = normalizeModeNames(modeNames);
    const bundle = createStrategyProfileBundle({
      profileId: idFactory('profile'),
      ownerRef: resolvedOwnerRef,
      displayName: normalizeCalibrationName(displayName, 'Profile name'),
      description: normalizeCalibrationDescription(description),
      tags: [environmentTag(environment)],
      modes: normalizedModes,
      createdAt,
      modeIds: normalizedModes.map(() => idFactory('mode')),
      setupAssumptions,
    });
    await repository.saveProfileBundle(bundle);
    await notifyLocalMutation([profileBundleEntity(bundle.profile, bundle.modes)]);
    return bundle;
  }

  async function updateProfileConfiguration(profileId, { displayName, description, modeNames, setupAssumptions }) {
    const workspace = await readWorkspace();
    const entry = workspace.profiles.find((candidate) => candidate.profile.id === profileId);
    if (!entry) throw new RangeError('Strategy profile was not found');
    const updatedAt = timestampFrom(clock);
    const normalizedModes = normalizeModeNames(modeNames ?? entry.modes.map((mode) => mode.displayName));
    if (normalizedModes.length !== entry.modes.length) throw new RangeError('Use Add Approach to extend this Game Setup');
    const profile = updateStrategyProfile(entry.profile, {
      displayName: normalizeCalibrationName(displayName, 'Profile name'),
      description: normalizeCalibrationDescription(description),
      ...(setupAssumptions ? { setupAssumptions } : {}),
    }, updatedAt);
    const modes = entry.modes.map((mode, index) => mode.displayName === normalizedModes[index]
      ? mode : updateStrategyMode(mode, { displayName: normalizedModes[index] }, updatedAt));
    await repository.saveProfileConfiguration({ profile, modes });
    await notifyLocalMutation([profileBundleEntity(profile, modes)]);
    return Object.freeze({ profile, modes });
  }

  async function saveWorkspaceSelection({ selectedProfileId, activeModeId, context }) {
    const workspace = await readWorkspace();
    const entry = workspace.profiles.find((candidate) => candidate.profile.id === selectedProfileId);
    if (!entry) throw new RangeError('Strategy profile was not found');
    if (!entry.modes.some((mode) => mode.id === activeModeId)) {
      throw new RangeError('Strategy mode does not belong to the selected profile');
    }
    const normalizedContext = normalizeRfiContextSelection(context, {
      environmentDefault: profileDefaultEnvironment(entry.profile),
    });
    createContextFromSelection(normalizedContext);
    const preferences = cloneData(workspace.preferences);
    preferences.selectedProfileId = selectedProfileId;
    preferences.byProfile[selectedProfileId] = {
      activeModeId,
      context: cloneData(normalizedContext),
    };
    persistPreferences(storageAdapter, preferences);
    return Object.freeze({ activeModeId, context: normalizedContext });
  }

  async function startOrResumeSession({
    selectedProfileId,
    activeModeId,
    context,
    intent = null,
    focus = undefined,
    selectionIntent = null,
    rangeTeacherPreset = undefined,
    forcedHandClass = null,
    continueAfterStop = false,
  }) {
    const operationStartedAt = performanceNow();
    const normalizedContext = normalizeRfiContextSelection(context, {
      environmentDefault: context?.environment ?? CALIBRATION_ENVIRONMENTS.HOME,
    });
    const contextScope = createContextFromSelection(normalizedContext);
    let snapshot = await repository.loadWorkspaceSnapshot();
    const profile = snapshot.profiles.find((entry) => entry.id === selectedProfileId && entry.state === PROFILE_STATES.ACTIVE);
    const mode = snapshot.modes.find((entry) => entry.id === activeModeId
      && entry.profileId === selectedProfileId && entry.state === PROFILE_STATES.ACTIVE);
    if (!profile) throw new RangeError('Strategy profile was not found');
    if (!mode || !profile.modeIds.includes(mode.id)) {
      throw new RangeError('Strategy mode does not belong to the selected profile');
    }

    const answered = currentDirectObservationMap(snapshot, {
      profileId: selectedProfileId,
      modeId: activeModeId,
      context: contextScope,
    });
    const firstPrompt = nextUnansweredPrompt(answered, 0);
    let session = matchingSession(snapshot, { profileId: selectedProfileId, modeId: activeModeId, context: contextScope });
    const requiredState = firstPrompt ? CALIBRATION_SESSION_STATES.ACTIVE : CALIBRATION_SESSION_STATES.COMPLETED;
    const updatedAt = timestampNotBefore(clock, session?.updatedAt ?? null);
    const presetOptions = rangeTeacherPreset == null
      ? null : resolveRangeTeacherSessionPreset(rangeTeacherPreset);
    const resolvedRangeTeacherPreset = rangeTeacherPreset !== undefined
      ? rangeTeacherPreset : session?.cursor?.rangeTeacherPreset ?? null;
    if (forcedHandClass !== null && !PREFLOP_HAND_CLASSES.includes(forcedHandClass)) {
      throw new RangeError('Range Teacher forced hand must be a canonical preflop hand class');
    }
    const resolvedIntent = normalizeRfiCalibrationIntent(
      intent ?? presetOptions?.calibrationIntent
        ?? session?.cursor?.calibrationIntent ?? RFI_CALIBRATION_INTENTS.STANDARD,
    );
    const resolvedSelectionIntent = normalizeRfiSelectionIntent(
      selectionIntent ?? presetOptions?.selectionIntent
        ?? session?.cursor?.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
    );
    let sessionChanged = false;
    if (!session) {
      session = createCalibrationSession({
        id: idFactory('calibration-session'),
        profileId: selectedProfileId,
        modeId: activeModeId,
        contextScope,
        startedAt: updatedAt,
        state: requiredState,
        completedAt: requiredState === CALIBRATION_SESSION_STATES.COMPLETED ? updatedAt : null,
        nextPromptIndex: firstPrompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length,
        cursor: {
          selectionPolicyVersion: RFI_QUESTION_SELECTION_POLICY_VERSION,
          stoppingPolicyVersion: RFI_STOPPING_POLICY_VERSION,
          coldStartPolicyVersion: RFI_COLD_START_POLICY_VERSION,
          calibrationIntent: resolvedIntent,
          mappingFocus: focus ?? null,
          selectionIntent: resolvedSelectionIntent,
          rangeTeacherPreset: resolvedRangeTeacherPreset,
          askedHandClasses: [],
          skippedHandClasses: [],
          notSureHandClasses: [],
          sessionQuestionCount: 0,
          additionalQuestionAllowance: 0,
          refinementBatchSize: 0,
          refinementBatchRemaining: 0,
          refinementActive: false,
          lastStopReason: null,
          forcedHandClass,
          userDirectedHandClass: null,
        },
      });
      const metadata = await repository.saveCalibrationSession(session);
      snapshot = snapshotWithSession(snapshot, session, metadata);
      sessionChanged = true;
    } else {
      const leaves = currentDirectLeafMap(snapshot, session);
      const continuingProfileCheckpoint = continueAfterStop && [
        RFI_CALIBRATION_STOP_REASONS.PROFILE_READY,
        RFI_CALIBRATION_STOP_REASONS.INITIAL_MAP_READY,
        RFI_CALIBRATION_STOP_REASONS.REFINEMENT_BATCH_COMPLETE,
      ].includes(session.cursor.lastStopReason);
      const cursor = adaptiveCursor(session, leaves, {
        calibrationIntent: resolvedIntent,
        mappingFocus: focus,
        selectionIntent: resolvedSelectionIntent,
        rangeTeacherPreset: resolvedRangeTeacherPreset,
        additionalQuestionAllowance: continueAfterStop
          && requiredState === CALIBRATION_SESSION_STATES.ACTIVE
          && session.state === CALIBRATION_SESSION_STATES.COMPLETED
          && !continuingProfileCheckpoint
          ? Math.max(1, session.cursor.additionalQuestionAllowance ?? 0)
          : session.cursor.additionalQuestionAllowance ?? 0,
        refinementActive: continuingProfileCheckpoint
          ? false : session.cursor.refinementActive === true
            && (session.cursor.refinementBatchRemaining ?? 0) > 0,
        refinementBatchRemaining: continuingProfileCheckpoint
          ? 0 : session.cursor.refinementBatchRemaining ?? 0,
        lastStopReason: null,
        forcedHandClass,
        userDirectedHandClass: null,
      });
      session = updateCalibrationSession(session, {
        state: requiredState,
        completedAt: requiredState === CALIBRATION_SESSION_STATES.COMPLETED ? updatedAt : null,
        nextPromptIndex: firstPrompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length,
        cursor,
      }, updatedAt);
      const previous = matchingSession(snapshot, {
        profileId: selectedProfileId,
        modeId: activeModeId,
        context: contextScope,
      });
      if (JSON.stringify(previous) !== JSON.stringify(session)) {
        const metadata = await repository.saveCalibrationSession(session, {
          expectedSession: previous,
        });
        snapshot = snapshotWithSession(snapshot, session, metadata);
        sessionChanged = true;
      } else session = previous;
    }
    if (sessionChanged) await notifyLocalMutation([session]);
    const durableSession = snapshot.calibrationSessions.find((entry) => entry.id === session.id);
    const settled = await settleCalibrationSession(snapshot, durableSession, Object.freeze({
      totalOperationMs: performanceNow() - operationStartedAt,
      repositoryTransactionMs: 0,
      nextQuestionResolutionMs: 0,
    }));
    if (continueAfterStop
      && settled.prompt === null
      && settled.progressAssessment.profileReadiness.profileReady
      && settled.progressAssessment.recommendedClarificationCount > 0) {
      return requestAdditionalQuestion(settled);
    }
    return settled;
  }

  async function switchCalibrationContext(activeState, {
    context,
    reasonKey = 'Checking whether your range differs in this context.',
    reasonParameters = null,
  } = {}) {
    const state = requireCalibrationState(activeState);
    const toSelection = normalizeRfiContextSelection(context, {
      environmentDefault: context?.environment ?? CALIBRATION_ENVIRONMENTS.HOME,
    });
    const toContext = createContextFromSelection(toSelection);
    if (calibrationContextKey(toContext) === calibrationContextKey(state.session.contextScope)) {
      throw new RangeError('Automatic Calibration context switch requires a different objective context');
    }
    if (typeof reasonKey !== 'string' || reasonKey.trim().length === 0) {
      throw new TypeError('Automatic Calibration context switch reason must be a non-empty string');
    }
    if (reasonParameters !== null
      && (typeof reasonParameters !== 'object' || Array.isArray(reasonParameters))) {
      throw new TypeError('Automatic Calibration context switch reason parameters must be an object');
    }
    const nextState = await startOrResumeSession({
      selectedProfileId: state.session.profileId,
      activeModeId: state.session.modeId,
      context: toSelection,
      intent: state.session.cursor.calibrationIntent,
      selectionIntent: state.session.cursor.selectionIntent,
      rangeTeacherPreset: state.session.cursor.rangeTeacherPreset,
      continueAfterStop: true,
    });
    return Object.freeze({
      ...nextState,
      contextTransition: Object.freeze({
        kind: 'automatic',
        fromContext: cloneData(state.session.contextScope),
        toContext: cloneData(nextState.session.contextScope),
        toSelection: cloneData(toSelection),
        reasonKey: reasonKey.trim(),
        reasonParameters: reasonParameters === null ? null : cloneData(reasonParameters),
      }),
    });
  }

  async function answerCalibrationQuestion(activeState, {
    actionType,
    mix = null,
    operationId = null,
    operationCreatedAt = null,
  } = {}) {
    const operationStartedAt = performanceNow();
    const state = requireCalibrationState(activeState);
    if (state.session.state !== CALIBRATION_SESSION_STATES.ACTIVE || !state.prompt) {
      throw new RangeError('CalibrationSession is not accepting answers');
    }
    let dominantAction;
    let frequencies = null;
    if (mix === null) dominantAction = inferenceAvailableForContext(state.session.contextScope)
      ? requireRfiAction(actionType)
      : requireCalibrationAction(state.session.contextScope, actionType);
    else {
      const normalizedMix = inferenceAvailableForContext(state.session.contextScope)
        ? normalizeRfiMix(mix)
        : normalizeCalibrationMix(state.session.contextScope, mix);
      dominantAction = normalizedMix.dominantAction;
      frequencies = normalizedMix.frequencies;
    }
    const createdAt = operationCreatedAt ?? timestampNotBefore(clock, state.session.updatedAt);
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const latestObservation = leaves.get(state.prompt.handClass) ?? null;
    const observation = createRangeObservation({
      id: operationId ?? idFactory('range-observation'),
      profileId: state.session.profileId,
      modeId: state.session.modeId,
      context: state.session.contextScope,
      handClass: state.prompt.handClass,
      dominantAction,
      frequencies,
      calibrationSessionId: state.session.id,
      evidenceSource: DIRECT_EVIDENCE_SOURCES.CALIBRATION,
      supersedesObservationId: latestObservation?.id ?? null,
      createdAt,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    answered.set(observation.handClass, observation);
    leaves.set(observation.handClass, observation);
    const cursor = adaptiveCursor(state.session, leaves, {
      askedHandClasses: [
        ...(state.session.cursor.askedHandClasses ?? []),
        state.prompt.handClass,
      ],
      sessionQuestionCount: (state.session.cursor.sessionQuestionCount ?? 0) + 1,
      additionalQuestionAllowance: Math.max(
        0,
        (state.session.cursor.additionalQuestionAllowance ?? 0) - 1,
      ),
      refinementBatchRemaining: Math.max(
        0,
        (state.session.cursor.refinementBatchRemaining ?? 0) - 1,
      ),
      lastStopReason: null,
      forcedHandClass: null,
      userDirectedHandClass: null,
    });
    cursor.nextPromptIndex = Math.min(
      state.prompt.index + 1,
      RANGE_CALIBRATION_QUESTION_ORDER.length,
    );
    let outcome;
    if (state.projectionMode === 'direct_only') {
      const previewView = createPersonalStrategyEvidenceView({
        profileId: observation.profileId,
        modeId: observation.modeId,
        context: observation.context,
        rangeObservations: [...state.projectionSource.rangeObservations, observation],
        trainingObservations: state.projectionSource.trainingObservations,
      });
      outcome = directOnlySelectionOutcome(previewView, cursor);
    } else {
      const previewScope = {
        profileId: observation.profileId,
        modeId: observation.modeId,
        context: observation.context,
      };
      const previewBundle = state.projectionMode === 'first_in_rfi_subspace'
        ? await firstInProjectionBundle(projectionService, previewScope, {
          additionalRangeObservations: [observation],
          suppliedSource: state.projectionSource,
        })
        : await projectionService.previewProjectionBundle(previewScope, {
          additionalRangeObservations: [observation],
          source: state.projectionSource,
        });
      outcome = calibrationSelectionOutcome(
        previewBundle.snapshot,
        previewBundle.transferProjection,
        state.session,
        cursor,
        answered,
        state.projectionMode === 'first_in_rfi_subspace'
          ? directEvidenceHandClasses(previewBundle.evidenceView) : new Set(),
        previewBundle.evidenceView,
      );
    }
    const completed = outcome.progressAssessment.shouldStop;
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    cursor.lastStopReason = completed ? outcome.progressAssessment.stopReason : null;
    const session = updateCalibrationSession(state.session, {
      state: completed ? CALIBRATION_SESSION_STATES.COMPLETED : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: completed ? createdAt : null,
      observationIds: [...state.session.observationIds, observation.id],
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, createdAt);
    const repositoryStartedAt = performanceNow();
    const metadata = await repository.saveCalibrationAnswer({
      observation,
      session,
      expectedSession: state.session,
    });
    projectionService.invalidateScope({
      profileId: observation.profileId,
      modeId: observation.modeId,
      context: observation.context,
    });
    await notifyLocalMutation([observation, session]);
    const repositoryTransactionMs = performanceNow() - repositoryStartedAt;
    const resolutionStartedAt = performanceNow();
    const snapshot = snapshotWithObservationAndSession(
      state.snapshot,
      observation,
      session,
      metadata,
      state.workspaceLeafIndexes,
    );
    const durableSession = session;
    const nextState = await calibrationState(
      snapshot,
      durableSession,
      projectionService,
      null,
      leaves,
      state.workspaceLeafIndexes,
    );
    const nextQuestionResolutionMs = performanceNow() - resolutionStartedAt;
    return Object.freeze({
      ...nextState,
      acceptedObservation: observation,
      operationMetrics: Object.freeze({
        repositoryTransactionMs,
        nextQuestionResolutionMs,
        totalOperationMs: performanceNow() - operationStartedAt,
      }),
    });
  }

  async function undoPreviousAnswer(activeState, { operationId = null } = {}) {
    const operationStartedAt = performanceNow();
    const state = requireCalibrationState(activeState);
    if (state.session.state === CALIBRATION_SESSION_STATES.PAUSED) {
      throw new RangeError('Paused CalibrationSession cannot be changed');
    }
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const target = recentActiveAnswer(state.session, leaves);
    if (!target) throw new RangeError('There is no previous answer to undo');
    const createdAt = timestampNotBefore(clock, state.session.updatedAt);
    const retraction = createRangeObservation({
      id: operationId ?? idFactory('range-observation'),
      profileId: target.profileId,
      modeId: target.modeId,
      context: target.context,
      handClass: target.handClass,
      dominantAction: null,
      state: RANGE_OBSERVATION_STATES.RETRACTED,
      calibrationSessionId: state.session.id,
      evidenceSource: DIRECT_EVIDENCE_SOURCES.CALIBRATION,
      supersedesObservationId: target.id,
      createdAt,
    });
    const promptIndex = RANGE_CALIBRATION_QUESTION_ORDER.indexOf(target.handClass);
    const askedHandClasses = [...(state.session.cursor.askedHandClasses ?? [])];
    const askedIndex = askedHandClasses.lastIndexOf(target.handClass);
    if (askedIndex >= 0) askedHandClasses.splice(askedIndex, 1);
    const cursor = adaptiveCursor(state.session, leaves, {
      askedHandClasses,
      additionalQuestionAllowance: Math.max(
        1,
        state.session.cursor.additionalQuestionAllowance ?? 0,
      ),
      lastStopReason: null,
      forcedHandClass: target.handClass,
      userDirectedHandClass: null,
    });
    cursor.nextPromptIndex = promptIndex;
    leaves.set(retraction.handClass, retraction);
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    let outcome;
    if (state.projectionMode === 'direct_only') {
      const previewView = createPersonalStrategyEvidenceView({
        profileId: retraction.profileId,
        modeId: retraction.modeId,
        context: retraction.context,
        rangeObservations: [...state.projectionSource.rangeObservations, retraction],
        trainingObservations: state.projectionSource.trainingObservations,
      });
      outcome = directOnlySelectionOutcome(previewView, cursor);
    } else {
      const previewScope = {
        profileId: retraction.profileId,
        modeId: retraction.modeId,
        context: retraction.context,
      };
      const previewBundle = state.projectionMode === 'first_in_rfi_subspace'
        ? await firstInProjectionBundle(projectionService, previewScope, {
          additionalRangeObservations: [retraction],
          suppliedSource: state.projectionSource,
        })
        : await projectionService.previewProjectionBundle(previewScope, {
          additionalRangeObservations: [retraction],
          source: state.projectionSource,
        });
      outcome = calibrationSelectionOutcome(
        previewBundle.snapshot,
        previewBundle.transferProjection,
        state.session,
        cursor,
        answered,
        state.projectionMode === 'first_in_rfi_subspace'
          ? directEvidenceHandClasses(previewBundle.evidenceView) : new Set(),
        previewBundle.evidenceView,
      );
    }
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    cursor.lastStopReason = outcome.progressAssessment.shouldStop
      ? outcome.progressAssessment.stopReason : null;
    const session = updateCalibrationSession(state.session, {
      state: outcome.progressAssessment.shouldStop
        ? CALIBRATION_SESSION_STATES.COMPLETED
        : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: outcome.progressAssessment.shouldStop ? createdAt : null,
      observationIds: [...state.session.observationIds, retraction.id],
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, createdAt);
    const repositoryStartedAt = performanceNow();
    const metadata = await repository.saveCalibrationAnswer({
      observation: retraction,
      session,
      expectedSession: state.session,
    });
    projectionService.invalidateScope({
      profileId: retraction.profileId,
      modeId: retraction.modeId,
      context: retraction.context,
    });
    await notifyLocalMutation([retraction, session]);
    const repositoryTransactionMs = performanceNow() - repositoryStartedAt;
    const snapshot = snapshotWithObservationAndSession(
      state.snapshot,
      retraction,
      session,
      metadata,
      state.workspaceLeafIndexes,
    );
    const durableSession = session;
    const nextState = await calibrationState(
      snapshot,
      durableSession,
      projectionService,
      null,
      leaves,
      state.workspaceLeafIndexes,
    );
    return Object.freeze({
      ...nextState,
      undoneObservation: target,
      operationMetrics: Object.freeze({
        repositoryTransactionMs,
        nextQuestionResolutionMs: 0,
        totalOperationMs: performanceNow() - operationStartedAt,
      }),
    });
  }

  async function pauseSession(activeState, {
    stopReason = RFI_CALIBRATION_STOP_REASONS.USER_PAUSED,
  } = {}) {
    const state = requireCalibrationState(activeState);
    if (state.session.state !== CALIBRATION_SESSION_STATES.ACTIVE) return state;
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const cursor = adaptiveCursor(state.session, leaves, { lastStopReason: stopReason });
    const session = updateCalibrationSession(state.session, {
      state: CALIBRATION_SESSION_STATES.PAUSED,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session, {
      expectedSession: state.session,
    });
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    const durableSession = session;
    return calibrationState(snapshot, durableSession, projectionService);
  }

  async function stopSession(activeState) {
    return pauseSession(activeState, {
      stopReason: RFI_CALIBRATION_STOP_REASONS.USER_STOPPED,
    });
  }

  async function skipCalibrationQuestion(activeState, { notSure = false } = {}) {
    const operationStartedAt = performanceNow();
    const state = requireCalibrationState(activeState);
    if (state.session.state !== CALIBRATION_SESSION_STATES.ACTIVE || !state.prompt) {
      throw new RangeError('CalibrationSession is not accepting skips');
    }
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const skippedHandClasses = [...new Set([
      ...(state.session.cursor.skippedHandClasses ?? []),
      state.prompt.handClass,
    ])];
    const notSureHandClasses = notSure
      ? [...new Set([
        ...(state.session.cursor.notSureHandClasses ?? []),
        state.prompt.handClass,
      ])]
      : [...(state.session.cursor.notSureHandClasses ?? [])];
    const cursor = adaptiveCursor(state.session, leaves, {
      askedHandClasses: [
        ...(state.session.cursor.askedHandClasses ?? []),
        state.prompt.handClass,
      ],
      skippedHandClasses,
      notSureHandClasses,
      sessionQuestionCount: (state.session.cursor.sessionQuestionCount ?? 0) + 1,
      additionalQuestionAllowance: Math.max(
        0,
        (state.session.cursor.additionalQuestionAllowance ?? 0) - 1,
      ),
      refinementBatchRemaining: Math.max(
        0,
        (state.session.cursor.refinementBatchRemaining ?? 0) - 1,
      ),
      lastStopReason: null,
      forcedHandClass: null,
      userDirectedHandClass: null,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    cursor.nextPromptIndex = Math.min(
      state.prompt.index + 1,
      RANGE_CALIBRATION_QUESTION_ORDER.length,
    );
    const outcome = state.projectionMode === 'direct_only'
      ? directOnlySelectionOutcome(state.personalStrategyEvidenceView, cursor)
      : calibrationSelectionOutcome(
        state.personalStrategySnapshot,
        state.personalStrategyTransferProjection,
        state.session,
        cursor,
        answered,
        state.projectionMode === 'first_in_rfi_subspace'
          ? directEvidenceHandClasses(state.personalStrategyEvidenceView) : new Set(),
        state.personalStrategyEvidenceView,
      );
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    cursor.lastStopReason = outcome.progressAssessment.shouldStop
      ? outcome.progressAssessment.stopReason : null;
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const session = updateCalibrationSession(state.session, {
      state: outcome.progressAssessment.shouldStop
        ? CALIBRATION_SESSION_STATES.COMPLETED
        : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: outcome.progressAssessment.shouldStop ? updatedAt : null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session, {
      expectedSession: state.session,
    });
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    const nextState = await calibrationState(
      snapshot,
      session,
      projectionService,
      null,
      leaves,
      state.workspaceLeafIndexes,
    );
    return Object.freeze({
      ...nextState,
      skippedQuestion: Object.freeze({
        handClass: state.prompt.handClass,
        reason: notSure ? 'not_sure' : 'skipped',
      }),
      operationMetrics: Object.freeze({
        repositoryTransactionMs: 0,
        nextQuestionResolutionMs: 0,
        totalOperationMs: performanceNow() - operationStartedAt,
      }),
    });
  }

  async function requestAdditionalQuestion(activeState) {
    const state = requireCalibrationState(activeState);
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const refinementActive = state.progressAssessment.profileReadiness.profileReady;
    const refinementBatchSize = refinementActive
      ? state.progressAssessment.recommendedClarificationCount : 0;
    const cursor = adaptiveCursor(state.session, leaves, {
      additionalQuestionAllowance: refinementActive
        ? 0 : (state.session.cursor.additionalQuestionAllowance ?? 0) + 1,
      refinementActive: refinementBatchSize > 0,
      refinementBatchSize,
      refinementBatchRemaining: refinementBatchSize,
      lastStopReason: null,
      forcedHandClass: null,
      userDirectedHandClass: null,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    const outcome = state.projectionMode === 'direct_only'
      ? directOnlySelectionOutcome(state.personalStrategyEvidenceView, cursor)
      : calibrationSelectionOutcome(
        state.personalStrategySnapshot,
        state.personalStrategyTransferProjection,
        { ...state.session, state: CALIBRATION_SESSION_STATES.ACTIVE },
        cursor,
        answered,
        state.projectionMode === 'first_in_rfi_subspace'
          ? directEvidenceHandClasses(state.personalStrategyEvidenceView) : new Set(),
        state.personalStrategyEvidenceView,
      );
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    cursor.lastStopReason = outcome.progressAssessment.shouldStop
      ? outcome.progressAssessment.stopReason : null;
    const session = updateCalibrationSession(state.session, {
      state: outcome.progressAssessment.shouldStop
        ? CALIBRATION_SESSION_STATES.COMPLETED
        : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: outcome.progressAssessment.shouldStop ? updatedAt : null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session, {
      expectedSession: state.session,
    });
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    return calibrationState(
      snapshot,
      session,
      projectionService,
      null,
      leaves,
      state.workspaceLeafIndexes,
    );
  }

  async function getPersonalStrategyMatrixProjection(scope, { session = null } = {}) {
    const firstInSubspace = firstInSubspaceInferenceAvailable(scope.context);
    if (!inferenceAvailableForContext(scope.context) && !firstInSubspace) {
      const source = await projectionService.getEvidenceSource(scope);
      const evidenceView = createPersonalStrategyEvidenceView({ ...scope, ...source });
      const cursor = adaptiveCursor(session ?? {
        cursor: {}, observationIds: [],
      }, currentDirectLeafMap({ rangeObservations: source.rangeObservations }, scope));
      const candidates = directOnlyCandidateRanking(evidenceView, cursor);
      return directOnlyMatrixProjection(
        evidenceView,
        candidates,
        directOnlyProgress(evidenceView, cursor, candidates),
      );
    }
    const projectionBundle = firstInSubspace
      ? await firstInProjectionBundle(projectionService, scope)
      : await projectionService.getProjectionBundle(scope);
    return matrixProjectionFromBundle(projectionBundle, session, { firstInSubspace });
  }

  async function getRangeTeacherView(scope, {
    session = null,
    selectedHandClass = null,
    dismissedSuggestionIds = [],
  } = {}) {
    const firstInSubspace = firstInSubspaceInferenceAvailable(scope.context);
    if (!inferenceAvailableForContext(scope.context) && !firstInSubspace) {
      const source = await projectionService.getEvidenceSource(scope);
      const evidenceView = createPersonalStrategyEvidenceView({ ...scope, ...source });
      const cursor = adaptiveCursor(session ?? {
        cursor: {}, observationIds: [],
      }, currentDirectLeafMap({ rangeObservations: source.rangeObservations }, scope));
      const candidates = directOnlyCandidateRanking(evidenceView, cursor);
      return directOnlyTeacherView(
        evidenceView,
        directOnlyProgress(evidenceView, cursor, candidates),
        selectedHandClass,
      );
    }
    const projectionBundle = firstInSubspace
      ? await firstInProjectionBundle(projectionService, scope)
      : await projectionService.getProjectionBundle(scope);
    const cursor = session?.cursor ?? {};
    const excludedHands = firstInSubspace
      ? directEvidenceHandClasses(projectionBundle.evidenceView) : new Set();
    const candidateRanking = rankCalibrationCandidates(projectionBundle.snapshot, {
      recentQuestionHistory: cursor.askedHandClasses ?? [],
      skippedHandClasses: cursor.skippedHandClasses ?? [],
      includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
      selectionIntent: cursor.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
      transferProjection: projectionBundle.transferProjection,
    }).filter((candidate) => !excludedHands.has(candidate.handClass));
    const baseProgressAssessment = assessCalibrationProgress(projectionBundle.snapshot, {
      intent: cursor.calibrationIntent ?? RFI_CALIBRATION_INTENTS.STANDARD,
      rankedCandidates: candidateRanking,
      sessionQuestionCount: cursor.sessionQuestionCount ?? 0,
      additionalQuestionAllowance: cursor.additionalQuestionAllowance ?? 0,
      refinementActive: cursor.refinementActive === true,
      refinementBatchRemaining: cursor.refinementBatchRemaining ?? 0,
      transferProjection: projectionBundle.transferProjection,
    });
    const baseMatrix = createPersonalStrategyMatrixProjection({
      snapshot: projectionBundle.snapshot,
      evidenceView: projectionBundle.evidenceView,
      transferProjection: projectionBundle.transferProjection,
      candidateRanking,
      highValueQuestionCount: baseProgressAssessment.highValueQuestionCount,
      profileReadiness: baseProgressAssessment.profileReadiness,
    });
    const matrix = firstInSubspace
      ? firstInMatrixProjection(
        projectionBundle.evidenceView,
        baseMatrix,
        candidateRanking,
        baseProgressAssessment,
      ) : baseMatrix;
    const progressAssessment = firstInSubspace
      ? firstInProgressAssessment(
        baseProgressAssessment,
        projectionBundle.evidenceView,
        matrix,
      ) : baseProgressAssessment;
    const teacherView = createRangeTeacherView({
      snapshot: projectionBundle.snapshot,
      evidenceView: projectionBundle.evidenceView,
      transferProjection: projectionBundle.transferProjection,
      candidateRanking,
      progressAssessment,
      selectedHandClass,
      dismissedSuggestionIds,
    });
    return firstInSubspace
      ? firstInTeacherView(teacherView, matrix, progressAssessment)
      : teacherView;
  }

  function matrixProjectionFromBundle(
    projectionBundle,
    session = null,
    { firstInSubspace = false } = {},
  ) {
    const cursor = session?.cursor ?? {};
    const excludedHands = firstInSubspace
      ? directEvidenceHandClasses(projectionBundle.evidenceView) : new Set();
    const candidateRanking = rankCalibrationCandidates(projectionBundle.snapshot, {
      recentQuestionHistory: cursor.askedHandClasses ?? [],
      skippedHandClasses: cursor.skippedHandClasses ?? [],
      includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
      selectionIntent: cursor.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
      transferProjection: projectionBundle.transferProjection,
    }).filter((candidate) => !excludedHands.has(candidate.handClass));
    const progressAssessment = assessCalibrationProgress(projectionBundle.snapshot, {
      intent: cursor.calibrationIntent ?? RFI_CALIBRATION_INTENTS.STANDARD,
      rankedCandidates: candidateRanking,
      sessionQuestionCount: cursor.sessionQuestionCount ?? 0,
      additionalQuestionAllowance: cursor.additionalQuestionAllowance ?? 0,
      refinementActive: cursor.refinementActive === true,
      refinementBatchRemaining: cursor.refinementBatchRemaining ?? 0,
      transferProjection: projectionBundle.transferProjection,
    });
    const baseProjection = createPersonalStrategyMatrixProjection({
      snapshot: projectionBundle.snapshot,
      evidenceView: projectionBundle.evidenceView,
      transferProjection: projectionBundle.transferProjection,
      candidateRanking,
      highValueQuestionCount: progressAssessment.highValueQuestionCount,
      profileReadiness: progressAssessment.profileReadiness,
    });
    return firstInSubspace
      ? firstInMatrixProjection(
        projectionBundle.evidenceView,
        baseProjection,
        candidateRanking,
        progressAssessment,
      ) : baseProjection;
  }

  async function recordPersonalStrategyMatrixEvidence(activeState, {
    profileId,
    modeId,
    context,
    handClass,
    actionType = null,
    mix = null,
    operationId = null,
  } = {}) {
    const scope = { profileId, modeId, context };
    const state = requirePersonalStrategyMutationScope(activeState, scope, 'Matrix correction');
    let dominantAction;
    let frequencies = null;
    if (mix === null) dominantAction = inferenceAvailableForContext(context)
      ? requireRfiAction(actionType)
      : requireCalibrationAction(context, actionType);
    else {
      const normalizedMix = inferenceAvailableForContext(context)
        ? normalizeRfiMix(mix)
        : normalizeCalibrationMix(context, mix);
      dominantAction = normalizedMix.dominantAction;
      frequencies = normalizedMix.frequencies;
    }
    const current = await repository.getCurrentRangeObservation({
      profileId, modeId, context, handClass,
    });
    const createdAt = timestampNotBefore(clock, current?.updatedAt ?? null);
    const observation = createRangeObservation({
      id: operationId ?? idFactory('range-observation'),
      profileId,
      modeId,
      context,
      handClass,
      dominantAction,
      frequencies,
      calibrationSessionId: null,
      evidenceSource: DIRECT_EVIDENCE_SOURCES.MATRIX,
      supersedesObservationId: current?.id ?? null,
      createdAt,
    });
    const metadata = await repository.saveRangeObservation(observation);
    projectionService.invalidateScope(scope);
    await notifyLocalMutation([observation]);

    const nextCalibrationState = state
      ? await refreshCalibrationAfterEvidenceMutation(state)
      : null;

    return Object.freeze({
      acceptedObservation: observation,
      metadata,
      calibrationState: nextCalibrationState,
      matrixProjection: nextCalibrationState?.personalStrategyMatrixProjection
        ?? await getPersonalStrategyMatrixProjection(scope),
    });
  }

  function requireBuilderScope(activeState, scope) {
    return requirePersonalStrategyMutationScope(activeState, scope, 'Range Builder');
  }

  async function refreshCalibrationAfterEvidenceMutation(state) {
    if (!state) return null;
    const snapshot = await repository.loadWorkspaceSnapshot();
    const session = snapshot.calibrationSessions.find((entry) => entry.id === state.session.id);
    if (!session) throw new RangeError('Personal Strategy could not restore the active calibration session');
    return calibrationState(snapshot, session, projectionService);
  }

  async function applyRangeBuilderOperation(activeState, scope, command) {
    const state = requireBuilderScope(activeState, scope);
    const result = await rangeBuilder.apply(scope, command);
    const nextCalibrationState = result.acceptedObservations.length
      ? await refreshCalibrationAfterEvidenceMutation(state)
      : state;
    return Object.freeze({
      ...result,
      calibrationState: nextCalibrationState,
      matrixProjection: nextCalibrationState?.personalStrategyMatrixProjection
        ?? matrixProjectionFromBundle(result.projectionBundle),
    });
  }

  async function undoRangeBuilderOperation(activeState, scope, operation, options = {}) {
    const state = requireBuilderScope(activeState, scope);
    const result = await rangeBuilder.undo(scope, operation, options);
    const nextCalibrationState = await refreshCalibrationAfterEvidenceMutation(state);
    return Object.freeze({
      ...result,
      calibrationState: nextCalibrationState,
      matrixProjection: nextCalibrationState?.personalStrategyMatrixProjection
        ?? matrixProjectionFromBundle(result.projectionBundle),
    });
  }

  async function requestPersonalStrategyMatrixQuestion(activeState, handClass) {
    const state = requireCalibrationState(activeState);
    if (!PREFLOP_HAND_CLASSES.includes(handClass)) {
      throw new RangeError('The selected Matrix cell must be a canonical preflop hand class');
    }
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const cursor = adaptiveCursor(state.session, leaves, {
      forcedHandClass: null,
      userDirectedHandClass: handClass,
      lastStopReason: null,
    });
    cursor.nextPromptIndex = RANGE_CALIBRATION_QUESTION_ORDER.indexOf(handClass);
    const session = updateCalibrationSession(state.session, {
      state: CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session, {
      expectedSession: state.session,
    });
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    return calibrationState(
      snapshot,
      session,
      projectionService,
      null,
      leaves,
      state.workspaceLeafIndexes,
    );
  }

  async function requestRangeTeacherSession(activeState, {
    preset,
    handClass = null,
  } = {}) {
    const state = requireCalibrationState(activeState);
    const presetOptions = resolveRangeTeacherSessionPreset(preset);
    if (handClass !== null) {
      const candidate = state.candidateRanking.find((entry) => (
        entry.handClass === handClass && entry.ordinaryQuestionEligible
      ));
      if (!candidate) throw new RangeError('Range Teacher target is not an ordinary calibration candidate');
    }
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const cursor = adaptiveCursor(state.session, leaves, {
      calibrationIntent: presetOptions.calibrationIntent,
      selectionIntent: presetOptions.selectionIntent,
      rangeTeacherPreset: preset,
      forcedHandClass: handClass,
      userDirectedHandClass: null,
      lastStopReason: null,
      additionalQuestionAllowance: Math.max(
        1,
        state.session.cursor.additionalQuestionAllowance ?? 0,
      ),
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    const sessionCandidate = { ...state.session, state: CALIBRATION_SESSION_STATES.ACTIVE };
    const outcome = state.projectionMode === 'direct_only'
      ? directOnlySelectionOutcome(state.personalStrategyEvidenceView, cursor)
      : calibrationSelectionOutcome(
        state.personalStrategySnapshot,
        state.personalStrategyTransferProjection,
        sessionCandidate,
        cursor,
        answered,
        state.projectionMode === 'first_in_rfi_subspace'
          ? directEvidenceHandClasses(state.personalStrategyEvidenceView) : new Set(),
        state.personalStrategyEvidenceView,
      );
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    const session = updateCalibrationSession(state.session, {
      state: outcome.progressAssessment.shouldStop
        ? CALIBRATION_SESSION_STATES.COMPLETED : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: outcome.progressAssessment.shouldStop ? updatedAt : null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session, {
      expectedSession: state.session,
    });
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    return calibrationState(snapshot, session, projectionService, null, leaves, state.workspaceLeafIndexes);
  }

  async function getRangeMappingProjection(scope, { focus = null, recentHands = [], skippedHands = [] } = {}) {
    const firstInSubspace = firstInSubspaceInferenceAvailable(scope.context);
    if (!inferenceAvailableForContext(scope.context) && !firstInSubspace) {
      return Object.freeze({ available: false, coverage: null, candidates: [], reason: 'RFI mapping is unavailable for this decision family.' });
    }
    const bundle = firstInSubspace ? await firstInProjectionBundle(projectionService, scope)
      : await projectionService.getProjectionBundle(scope);
    const directHands = directEvidenceHandClasses(bundle.evidenceView);
    const candidates = rankCalibrationCandidates(bundle.snapshot, {
      intent: RFI_CALIBRATION_INTENTS.MAPPING, mappingFocus: focus, mappingEvidenceView: bundle.evidenceView,
      recentQuestionHistory: recentHands, skippedHandClasses: skippedHands, transferProjection: bundle.transferProjection,
    }).filter((candidate) => !directHands.has(candidate.handClass) || candidate.questionKind === 'conflict_resolution');
    return Object.freeze({ available: true, coverage: createRfiStructuralMappingFacts({ snapshot: bundle.snapshot, evidenceView: bundle.evidenceView }), candidates });
  }

  const application = {
    ownerRef: resolvedOwnerRef,
    lifecycleScope,
    repository,
    readWorkspace,
    createProfile,
    updateProfileConfiguration,
    previewQualitativeIntent,
    confirmQualitativeIntent,
    discardQualitativeIntent(preview) { qualitativeDrafts.delete(preview); },
    getQualitativeEvidence: (scope) => repository.loadQualitativeEvidence(scope),
    getApproachHistory: (scope) => repository.loadApproachHistory(scope),
    async addApproach(profileId, { displayName, sourceModeId = null }) {
      const input = { id: idFactory('mode'), displayName: normalizeCalibrationName(displayName, 'Approach name') };
      const result = sourceModeId
        ? await repository.duplicateApproach(profileId, sourceModeId, input)
        : await repository.addApproach(profileId, input);
      return result;
    },
    saveWorkspaceSelection,
    startOrResumeSession,
    switchCalibrationContext,
    answerCalibrationQuestion,
    undoPreviousAnswer,
    pauseSession,
    stopSession,
    skipCalibrationQuestion,
    requestAdditionalQuestion,
    getPersonalStrategyMatrixProjection,
    getRangeTeacherView,
    getRangeMappingProjection,
    recordPersonalStrategyMatrixEvidence,
    applyRangeBuilderOperation,
    undoRangeBuilderOperation,
    requestPersonalStrategyMatrixQuestion,
    requestRangeTeacherSession,
    getEvidenceView: (scope) => projectionService.getEvidenceView(scope),
    getStrategyEstimate: (scope, handClass) => (
      projectionService.getStrategyEstimate(scope, handClass)
    ),
    getStrategySnapshot: (scope) => projectionService.getStrategySnapshot(scope),
    getTransferProjection: (scope) => projectionService.getTransferProjection(scope),
    getInferenceSupport: (scope, handClass) => (
      projectionService.getInferenceSupport(scope, handClass)
    ),
    getProjectionCacheMetrics: () => projectionService.getCacheMetrics(),
    exportPortable: (options) => repository.exportPortable(options),
    async importPortable(value, options) {
      const before = new Set((await repository.listSyncEntities()).map((entry) => entry.id));
      const result = await repository.importPortable(value, options);
      const added = (await repository.listSyncEntities()).filter((entry) => !before.has(entry.id));
      await notifyLocalMutation(added);
      return result;
    },
    createAnswerOperation(activeState) {
      const state = requireCalibrationState(activeState);
      return Object.freeze({
        operationId: idFactory('range-observation'),
        operationCreatedAt: timestampNotBefore(clock, state.session.updatedAt),
      });
    },
    getStorageMetrics: () => cloneData(storageMetrics),
  };
  return Object.freeze(Object.fromEntries(Object.entries(application).map(([key, value]) => [
    key, typeof value !== 'function' ? value : (...args) => {
      lifecycleScope?.assertCurrent();
      const result = value(...args);
      if (result?.then) return result.then((resolved) => {
        lifecycleScope?.assertCurrent();
        return resolved;
      });
      lifecycleScope?.assertCurrent();
      return result;
    },
  ])));
}
