import {
  ACTION_TYPES,
  ANTE_TYPES,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
} from '../../../shared/poker-domain/index.js';
import {
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
  createPersonalStrategyMatrixProjection,
  createPersonalStrategyProjectionService,
  createRangeTeacherView,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  getCalibrationQuestionExplanation,
  getNextCalibrationQuestion,
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
export const RFI_CALIBRATION_ACTIONS = Object.freeze([
  Object.freeze({ type: ACTION_TYPES.FOLD, shortcut: 'F' }),
  Object.freeze({ type: ACTION_TYPES.RAISE, shortcut: 'R' }),
]);

const RFI_CALIBRATION_ACTION_TYPES = new Set(RFI_CALIBRATION_ACTIONS.map((entry) => entry.type));
const MIX_TOTAL_TOLERANCE = 1e-9;

export const CALIBRATION_ENVIRONMENTS = Object.freeze({
  HOME: 'home',
  CLUBGG: 'clubgg',
});

const ENVIRONMENT_TAG_PREFIX = 'riverline:environment:';
const ENVIRONMENT_VALUES = Object.freeze(Object.values(CALIBRATION_ENVIRONMENTS));

export const CALIBRATION_ENVIRONMENT_RULES = Object.freeze({
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
  if (!Array.isArray(values) || values.length !== 3) {
    throw new RangeError('Exactly three mode names are required');
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
  return ENVIRONMENT_VALUES.includes(environment) ? environment : CALIBRATION_ENVIRONMENTS.HOME;
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

export function normalizeRfiContextSelection(selection = {}, { environmentDefault = CALIBRATION_ENVIRONMENTS.HOME } = {}) {
  const environment = normalizeCalibrationEnvironment(selection.environment ?? environmentDefault);
  const rules = CALIBRATION_ENVIRONMENT_RULES[environment];
  const allowedTableSizes = tableSizesForEnvironment(environment);
  const requestedTableSize = Number(selection.tableSize);
  const tableSize = allowedTableSizes.includes(requestedTableSize)
    ? requestedTableSize
    : Math.min(rules.maxTableSize, Math.max(rules.minTableSize, rules.defaultTableSize));
  const positions = rfiPositionsForTableSize(tableSize);
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
  return Object.freeze({ environment, tableSize, heroPosition, effectiveStackBb });
}

export function createContextFromSelection(selection) {
  const normalized = normalizeRfiContextSelection(selection, { environmentDefault: selection?.environment });
  const rules = CALIBRATION_ENVIRONMENT_RULES[normalized.environment];
  return createRfiCalibrationContext({
    gameRulesId: rules.gameRulesId,
    tableSize: normalized.tableSize,
    heroPosition: normalized.heroPosition,
    effectiveStackBb: normalized.effectiveStackBb,
    accounting: rules.accounting,
  });
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

export function normalizeRfiMix({ fold, raise } = {}) {
  const values = [Number(fold), Number(raise)];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new RangeError('Fold and Raise frequencies must each be from 0 through 100');
  }
  const total = values[0] + values[1];
  if (Math.abs(total - 100) > MIX_TOTAL_TOLERANCE) {
    throw new RangeError('Fold and Raise frequencies must total 100%');
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
    lastStopReason: changes.lastStopReason !== undefined
      ? changes.lastStopReason : session.cursor.lastStopReason ?? null,
    forcedHandClass: changes.forcedHandClass !== undefined
      ? changes.forcedHandClass : session.cursor.forcedHandClass ?? null,
  };
}

function candidateAsPrompt(candidate) {
  if (!candidate) return null;
  return Object.freeze({ ...candidate, index: candidate.canonicalIndex });
}

function calibrationSelectionOutcome(personalStrategySnapshot, session, cursor, answered) {
  const candidateRanking = rankCalibrationCandidates(personalStrategySnapshot, {
    recentQuestionHistory: cursor.askedHandClasses,
    skippedHandClasses: cursor.skippedHandClasses,
    includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
    selectionIntent: cursor.selectionIntent,
  });
  let candidate;
  if (cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
    const sequential = nextUnansweredPrompt(answered, cursor.nextPromptIndex);
    candidate = sequential
      ? candidateRanking.find((entry) => entry.handClass === sequential.handClass) ?? null
      : null;
  } else if (cursor.forcedHandClass) {
    candidate = candidateRanking.find((entry) => (
      entry.handClass === cursor.forcedHandClass && entry.ordinaryQuestionEligible
    )) ?? getNextCalibrationQuestion(personalStrategySnapshot, { rankedCandidates: candidateRanking });
  } else candidate = getNextCalibrationQuestion(personalStrategySnapshot, { rankedCandidates: candidateRanking });
  const progressAssessment = assessCalibrationProgress(personalStrategySnapshot, {
    intent: cursor.calibrationIntent,
    rankedCandidates: candidateRanking,
    sessionQuestionCount: cursor.sessionQuestionCount,
    additionalQuestionAllowance: cursor.additionalQuestionAllowance,
    userPaused: session.state === CALIBRATION_SESSION_STATES.PAUSED,
    userStopped: session.state === CALIBRATION_SESSION_STATES.PAUSED
      && cursor.lastStopReason === RFI_CALIBRATION_STOP_REASONS.USER_STOPPED,
  });
  return {
    candidateRanking,
    progressAssessment,
    prompt: progressAssessment.shouldStop ? null : candidateAsPrompt(candidate),
  };
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
  const projectionBundle = await projectionService.getProjectionBundle({
    profileId: session.profileId,
    modeId: session.modeId,
    context: session.contextScope,
  });
  const personalStrategySnapshot = projectionBundle.snapshot;
  const { candidateRanking, progressAssessment, prompt } = calibrationSelectionOutcome(
    personalStrategySnapshot,
    session,
    cursor,
    answered,
  );
  const personalStrategyMatrixProjection = createPersonalStrategyMatrixProjection({
    snapshot: personalStrategySnapshot,
    evidenceView: projectionBundle.evidenceView,
    candidateRanking,
    highValueQuestionCount: progressAssessment.highValueQuestionCount,
  });
  const rangeTeacherView = createRangeTeacherView({
    snapshot: personalStrategySnapshot,
    evidenceView: projectionBundle.evidenceView,
    candidateRanking,
    progressAssessment,
    selectedHandClass: prompt?.handClass ?? null,
  });
  return Object.freeze({
    snapshot,
    session,
    prompt,
    questionExplanation: prompt ? getCalibrationQuestionExplanation(prompt) : null,
    candidateRanking,
    personalStrategySnapshot,
    personalStrategyEvidenceView: projectionBundle.evidenceView,
    personalStrategyMatrixProjection,
    rangeTeacherView,
    projectionSource: projectionBundle.source,
    progressAssessment,
    availableActions: RFI_CALIBRATION_ACTIONS,
    progress: Object.freeze({
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
      storageMetrics.reads += 1;
      storageMetrics.readsByKey[key] = (storageMetrics.readsByKey[key] || 0) + 1;
      return storage.getItem(key);
    },
    setItem(key, value) {
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
    clock,
  });
  const projectionService = createPersonalStrategyProjectionService({ repository });

  async function notifyLocalMutation(entities) {
    if (!onLocalMutation) return;
    try {
      await onLocalMutation(Object.freeze({
        schemaVersion: 'personal-strategy-local-mutation/v1',
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
    const desiredState = state.progressAssessment.shouldStop
      ? CALIBRATION_SESSION_STATES.COMPLETED
      : CALIBRATION_SESSION_STATES.ACTIVE;
    const desiredNextPromptIndex = state.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    const cursor = adaptiveCursor(session, leaves, {
      lastStopReason: state.progressAssessment.shouldStop
        ? state.progressAssessment.stopReason : null,
      forcedHandClass: state.prompt?.handClass === session.cursor.forcedHandClass
        ? session.cursor.forcedHandClass : null,
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
    const metadata = await repository.saveCalibrationSession(settledSession);
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

  async function createProfile({ displayName, description, environment, modeNames }) {
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
    });
    await repository.saveProfileBundle(bundle);
    await notifyLocalMutation([profileBundleEntity(bundle.profile, bundle.modes)]);
    return bundle;
  }

  async function updateProfileConfiguration(profileId, { displayName, description, modeNames }) {
    const workspace = await readWorkspace();
    const entry = workspace.profiles.find((candidate) => candidate.profile.id === profileId);
    if (!entry) throw new RangeError('Strategy profile was not found');
    const updatedAt = timestampFrom(clock);
    const normalizedModes = normalizeModeNames(modeNames);
    const profile = updateStrategyProfile(entry.profile, {
      displayName: normalizeCalibrationName(displayName, 'Profile name'),
      description: normalizeCalibrationDescription(description),
    }, updatedAt);
    const modes = entry.modes.map((mode, index) => updateStrategyMode(mode, {
      displayName: normalizedModes[index],
    }, updatedAt));
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
          selectionIntent: resolvedSelectionIntent,
          rangeTeacherPreset: resolvedRangeTeacherPreset,
          askedHandClasses: [],
          skippedHandClasses: [],
          notSureHandClasses: [],
          sessionQuestionCount: 0,
          additionalQuestionAllowance: 0,
          lastStopReason: null,
          forcedHandClass,
        },
      });
      const metadata = await repository.saveCalibrationSession(session);
      snapshot = snapshotWithSession(snapshot, session, metadata);
      sessionChanged = true;
    } else {
      const leaves = currentDirectLeafMap(snapshot, session);
      const cursor = adaptiveCursor(session, leaves, {
        calibrationIntent: resolvedIntent,
        selectionIntent: resolvedSelectionIntent,
        rangeTeacherPreset: resolvedRangeTeacherPreset,
        additionalQuestionAllowance: continueAfterStop
          && requiredState === CALIBRATION_SESSION_STATES.ACTIVE
          && session.state === CALIBRATION_SESSION_STATES.COMPLETED
          ? Math.max(1, session.cursor.additionalQuestionAllowance ?? 0)
          : session.cursor.additionalQuestionAllowance ?? 0,
        lastStopReason: null,
        forcedHandClass,
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
        const metadata = await repository.saveCalibrationSession(session);
        snapshot = snapshotWithSession(snapshot, session, metadata);
        sessionChanged = true;
      } else session = previous;
    }
    if (sessionChanged) await notifyLocalMutation([session]);
    const durableSession = snapshot.calibrationSessions.find((entry) => entry.id === session.id);
    return settleCalibrationSession(snapshot, durableSession, Object.freeze({
      totalOperationMs: performanceNow() - operationStartedAt,
      repositoryTransactionMs: 0,
      nextQuestionResolutionMs: 0,
    }));
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
    if (mix === null) dominantAction = requireRfiAction(actionType);
    else {
      const normalizedMix = normalizeRfiMix(mix);
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
      lastStopReason: null,
      forcedHandClass: null,
    });
    cursor.nextPromptIndex = Math.min(
      state.prompt.index + 1,
      RANGE_CALIBRATION_QUESTION_ORDER.length,
    );
    const previewSnapshot = await projectionService.previewStrategySnapshot({
      profileId: observation.profileId,
      modeId: observation.modeId,
      context: observation.context,
    }, {
      additionalRangeObservations: [observation],
      source: state.projectionSource,
    });
    const outcome = calibrationSelectionOutcome(
      previewSnapshot,
      state.session,
      cursor,
      answered,
    );
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
      expectedSessionUpdatedAt: state.session.updatedAt,
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
    });
    cursor.nextPromptIndex = promptIndex;
    leaves.set(retraction.handClass, retraction);
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    const previewSnapshot = await projectionService.previewStrategySnapshot({
      profileId: retraction.profileId,
      modeId: retraction.modeId,
      context: retraction.context,
    }, {
      additionalRangeObservations: [retraction],
      source: state.projectionSource,
    });
    const outcome = calibrationSelectionOutcome(
      previewSnapshot,
      state.session,
      cursor,
      answered,
    );
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
      expectedSessionUpdatedAt: state.session.updatedAt,
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
    const metadata = await repository.saveCalibrationSession(session);
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
      lastStopReason: null,
      forcedHandClass: null,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    cursor.nextPromptIndex = Math.min(
      state.prompt.index + 1,
      RANGE_CALIBRATION_QUESTION_ORDER.length,
    );
    const outcome = calibrationSelectionOutcome(
      state.personalStrategySnapshot,
      state.session,
      cursor,
      answered,
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
    const metadata = await repository.saveCalibrationSession(session);
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
    const cursor = adaptiveCursor(state.session, leaves, {
      additionalQuestionAllowance: (state.session.cursor.additionalQuestionAllowance ?? 0) + 1,
      lastStopReason: null,
      forcedHandClass: null,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    const outcome = calibrationSelectionOutcome(
      state.personalStrategySnapshot,
      { ...state.session, state: CALIBRATION_SESSION_STATES.ACTIVE },
      cursor,
      answered,
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
    const metadata = await repository.saveCalibrationSession(session);
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
    const projectionBundle = await projectionService.getProjectionBundle(scope);
    return matrixProjectionFromBundle(projectionBundle, session);
  }

  async function getRangeTeacherView(scope, {
    session = null,
    selectedHandClass = null,
    dismissedSuggestionIds = [],
  } = {}) {
    const projectionBundle = await projectionService.getProjectionBundle(scope);
    const cursor = session?.cursor ?? {};
    const candidateRanking = rankCalibrationCandidates(projectionBundle.snapshot, {
      recentQuestionHistory: cursor.askedHandClasses ?? [],
      skippedHandClasses: cursor.skippedHandClasses ?? [],
      includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
      selectionIntent: cursor.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
    });
    const progressAssessment = assessCalibrationProgress(projectionBundle.snapshot, {
      intent: cursor.calibrationIntent ?? RFI_CALIBRATION_INTENTS.STANDARD,
      rankedCandidates: candidateRanking,
      sessionQuestionCount: cursor.sessionQuestionCount ?? 0,
      additionalQuestionAllowance: cursor.additionalQuestionAllowance ?? 0,
    });
    return createRangeTeacherView({
      snapshot: projectionBundle.snapshot,
      evidenceView: projectionBundle.evidenceView,
      candidateRanking,
      progressAssessment,
      selectedHandClass,
      dismissedSuggestionIds,
    });
  }

  function matrixProjectionFromBundle(projectionBundle, session = null) {
    const cursor = session?.cursor ?? {};
    const candidateRanking = rankCalibrationCandidates(projectionBundle.snapshot, {
      recentQuestionHistory: cursor.askedHandClasses ?? [],
      skippedHandClasses: cursor.skippedHandClasses ?? [],
      includeSkipped: cursor.calibrationIntent === RFI_CALIBRATION_INTENTS.EXHAUSTIVE,
      selectionIntent: cursor.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
    });
    const progressAssessment = assessCalibrationProgress(projectionBundle.snapshot, {
      intent: cursor.calibrationIntent ?? RFI_CALIBRATION_INTENTS.STANDARD,
      rankedCandidates: candidateRanking,
      sessionQuestionCount: cursor.sessionQuestionCount ?? 0,
      additionalQuestionAllowance: cursor.additionalQuestionAllowance ?? 0,
    });
    return createPersonalStrategyMatrixProjection({
      snapshot: projectionBundle.snapshot,
      evidenceView: projectionBundle.evidenceView,
      candidateRanking,
      highValueQuestionCount: progressAssessment.highValueQuestionCount,
    });
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
    let dominantAction;
    let frequencies = null;
    if (mix === null) dominantAction = requireRfiAction(actionType);
    else {
      const normalizedMix = normalizeRfiMix(mix);
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

    let nextCalibrationState = null;
    if (activeState) {
      const state = requireCalibrationState(activeState);
      const sameScope = state.session.profileId === profileId
        && state.session.modeId === modeId
        && calibrationContextKey(state.session.contextScope) === calibrationContextKey(context);
      if (!sameScope) throw new RangeError('Matrix correction state does not match the selected scope');
      const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
      leaves.set(handClass, observation);
      const snapshot = snapshotWithObservationAndSession(
        state.snapshot,
        observation,
        state.session,
        metadata,
        state.workspaceLeafIndexes,
      );
      nextCalibrationState = await calibrationState(
        snapshot,
        state.session,
        projectionService,
        null,
        leaves,
        state.workspaceLeafIndexes,
      );
    }

    return Object.freeze({
      acceptedObservation: observation,
      metadata,
      calibrationState: nextCalibrationState,
      matrixProjection: nextCalibrationState?.personalStrategyMatrixProjection
        ?? await getPersonalStrategyMatrixProjection(scope),
    });
  }

  function requireBuilderScope(activeState, scope) {
    if (!activeState) return null;
    const state = requireCalibrationState(activeState);
    const sameScope = state.session.profileId === scope.profileId
      && state.session.modeId === scope.modeId
      && calibrationContextKey(state.session.contextScope) === calibrationContextKey(scope.context);
    if (!sameScope) throw new RangeError('Range Builder state does not match the selected scope');
    return state;
  }

  async function refreshCalibrationAfterBuilder(state) {
    if (!state) return null;
    const snapshot = await repository.loadWorkspaceSnapshot();
    const session = snapshot.calibrationSessions.find((entry) => entry.id === state.session.id);
    if (!session) throw new RangeError('Range Builder could not restore the active calibration session');
    return calibrationState(snapshot, session, projectionService);
  }

  async function applyRangeBuilderOperation(activeState, scope, command) {
    const state = requireBuilderScope(activeState, scope);
    const result = await rangeBuilder.apply(scope, command);
    const nextCalibrationState = result.acceptedObservations.length
      ? await refreshCalibrationAfterBuilder(state)
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
    const nextCalibrationState = await refreshCalibrationAfterBuilder(state);
    return Object.freeze({
      ...result,
      calibrationState: nextCalibrationState,
      matrixProjection: nextCalibrationState?.personalStrategyMatrixProjection
        ?? matrixProjectionFromBundle(result.projectionBundle),
    });
  }

  async function requestPersonalStrategyMatrixQuestion(activeState, handClass) {
    const state = requireCalibrationState(activeState);
    const candidate = state.candidateRanking.find((entry) => (
      entry.handClass === handClass && entry.ordinaryQuestionEligible
    ));
    if (!candidate) throw new RangeError('The selected Matrix cell is not an ordinary calibration candidate');
    const leaves = new Map(state.scopeLeaves.map((entry) => [entry.handClass, entry]));
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const cursor = adaptiveCursor(state.session, leaves, {
      forcedHandClass: handClass,
      lastStopReason: null,
      additionalQuestionAllowance: Math.max(
        1,
        state.session.cursor.additionalQuestionAllowance ?? 0,
      ),
    });
    cursor.nextPromptIndex = RANGE_CALIBRATION_QUESTION_ORDER.indexOf(handClass);
    const session = updateCalibrationSession(state.session, {
      state: CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session);
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
      lastStopReason: null,
      additionalQuestionAllowance: Math.max(
        1,
        state.session.cursor.additionalQuestionAllowance ?? 0,
      ),
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    const sessionCandidate = { ...state.session, state: CALIBRATION_SESSION_STATES.ACTIVE };
    const outcome = calibrationSelectionOutcome(
      state.personalStrategySnapshot,
      sessionCandidate,
      cursor,
      answered,
    );
    cursor.nextPromptIndex = outcome.prompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length;
    const session = updateCalibrationSession(state.session, {
      state: outcome.progressAssessment.shouldStop
        ? CALIBRATION_SESSION_STATES.COMPLETED : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: outcome.progressAssessment.shouldStop ? updatedAt : null,
      nextPromptIndex: cursor.nextPromptIndex,
      cursor,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session);
    await notifyLocalMutation([session]);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    return calibrationState(snapshot, session, projectionService, null, leaves, state.workspaceLeafIndexes);
  }

  return Object.freeze({
    ownerRef: resolvedOwnerRef,
    repository,
    readWorkspace,
    createProfile,
    updateProfileConfiguration,
    saveWorkspaceSelection,
    startOrResumeSession,
    answerCalibrationQuestion,
    undoPreviousAnswer,
    pauseSession,
    stopSession,
    skipCalibrationQuestion,
    requestAdditionalQuestion,
    getPersonalStrategyMatrixProjection,
    getRangeTeacherView,
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
  });
}
