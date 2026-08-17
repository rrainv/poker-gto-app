import {
  ACTION_TYPES,
  ANTE_TYPES,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
} from '../../../shared/poker-domain/index.js';
import {
  CALIBRATION_SESSION_STATES,
  PERSONAL_STRATEGY_DATABASE_NAME,
  PROFILE_STATES,
  RANGE_OBSERVATION_STATES,
  calibrationContextKey,
  createCalibrationSession,
  createLocalOwnerRef,
  createIndexedDbPersonalStrategyDatabase,
  createPersonalStrategyBrowserStorage,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  rangeObservationKey,
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
  return matching.filter((entry) => !superseded.has(entry.id) && entry.state === 'active').length;
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

function calibrationState(
  snapshot,
  session,
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
  const prompt = nextUnansweredPrompt(answered, session.cursor.nextPromptIndex);
  return Object.freeze({
    snapshot,
    session,
    prompt,
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
} = {}) {
  requireStorage(storage);
  if (typeof clock !== 'function' || typeof idFactory !== 'function') {
    throw new TypeError('Range Calibration clock and idFactory must be functions');
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

  async function startOrResumeSession({ selectedProfileId, activeModeId, context }) {
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
      });
      const metadata = await repository.saveCalibrationSession(session);
      snapshot = snapshotWithSession(snapshot, session, metadata);
    } else if (session.state !== requiredState
      || (firstPrompt && session.cursor.nextPromptIndex !== firstPrompt.index)) {
      session = updateCalibrationSession(session, {
        state: requiredState,
        completedAt: requiredState === CALIBRATION_SESSION_STATES.COMPLETED ? updatedAt : null,
        nextPromptIndex: firstPrompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length,
      }, updatedAt);
      const metadata = await repository.saveCalibrationSession(session);
      snapshot = snapshotWithSession(snapshot, session, metadata);
    }
    const durableSession = snapshot.calibrationSessions.find((entry) => entry.id === session.id);
    return calibrationState(snapshot, durableSession, Object.freeze({
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
      supersedesObservationId: latestObservation?.id ?? null,
      createdAt,
    });
    const answered = new Map([...leaves]
      .filter(([, observation]) => observation.state === RANGE_OBSERVATION_STATES.ACTIVE));
    answered.set(observation.handClass, observation);
    leaves.set(observation.handClass, observation);
    const nextPrompt = nextUnansweredPrompt(answered, state.prompt.index + 1);
    const completed = nextPrompt === null;
    const session = updateCalibrationSession(state.session, {
      state: completed ? CALIBRATION_SESSION_STATES.COMPLETED : CALIBRATION_SESSION_STATES.ACTIVE,
      completedAt: completed ? createdAt : null,
      observationIds: [...state.session.observationIds, observation.id],
      nextPromptIndex: nextPrompt?.index ?? RANGE_CALIBRATION_QUESTION_ORDER.length,
    }, createdAt);
    const repositoryStartedAt = performanceNow();
    const metadata = await repository.saveCalibrationAnswer({
      observation,
      session,
      expectedSessionUpdatedAt: state.session.updatedAt,
    });
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
    const nextState = calibrationState(snapshot, durableSession, null, leaves, state.workspaceLeafIndexes);
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
      supersedesObservationId: target.id,
      createdAt,
    });
    const promptIndex = RANGE_CALIBRATION_QUESTION_ORDER.indexOf(target.handClass);
    const session = updateCalibrationSession(state.session, {
      state: CALIBRATION_SESSION_STATES.ACTIVE,
      observationIds: [...state.session.observationIds, retraction.id],
      nextPromptIndex: promptIndex,
    }, createdAt);
    const repositoryStartedAt = performanceNow();
    const metadata = await repository.saveCalibrationAnswer({
      observation: retraction,
      session,
      expectedSessionUpdatedAt: state.session.updatedAt,
    });
    const repositoryTransactionMs = performanceNow() - repositoryStartedAt;
    const snapshot = snapshotWithObservationAndSession(
      state.snapshot,
      retraction,
      session,
      metadata,
      state.workspaceLeafIndexes,
    );
    const durableSession = session;
    leaves.set(retraction.handClass, retraction);
    const nextState = calibrationState(snapshot, durableSession, null, leaves, state.workspaceLeafIndexes);
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

  async function pauseSession(activeState) {
    const state = requireCalibrationState(activeState);
    if (state.session.state !== CALIBRATION_SESSION_STATES.ACTIVE) return state;
    const updatedAt = timestampNotBefore(clock, state.session.updatedAt);
    const session = updateCalibrationSession(state.session, {
      state: CALIBRATION_SESSION_STATES.PAUSED,
    }, updatedAt);
    const metadata = await repository.saveCalibrationSession(session);
    const snapshot = snapshotWithSession(state.snapshot, session, metadata);
    const durableSession = session;
    return calibrationState(snapshot, durableSession);
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
