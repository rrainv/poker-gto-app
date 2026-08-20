import {
  GAME_RULES_COLLECTION_TYPES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  STREETS,
  assertCardArray,
  assertUniqueKnownCards,
  isHiddenHoleCards,
  validateGameRulesSnapshot,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import {
  canonicalPokerStatesEqual,
  reconstructCanonicalHandReplaySource,
} from '../application/canonical-hand-replay-source.mjs';

export const SAVED_STUDY_OBJECT_SCHEMA_VERSION = 'saved-study-object/v1';
export const SAVED_STUDY_OWNER_SCHEMA_VERSION = 'saved-study-owner/v1';
export const SAVED_STUDY_SOURCE_SCHEMA_VERSION = 'saved-study-source/v1';
export const SAVED_STUDY_ANNOTATIONS_SCHEMA_VERSION = 'saved-study-annotations/v1';
export const SAVED_STUDY_TAG_SCHEMA_VERSION = 'saved-study-tag/v1';
export const SAVED_HAND_SNAPSHOT_SCHEMA_VERSION = 'saved-hand-snapshot/v1';
export const SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION = 'saved-hand-snapshot/v2';
export const SAVED_HAND_PRIVACY_SCHEMA_VERSION = 'saved-hand-privacy/v1';
export const SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION = 'saved-spot-snapshot/v1';
export const SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION = 'saved-spot-snapshot/v2';
export const SAVED_HAND_REFERENCE_SCHEMA_VERSION = 'saved-hand-reference/v1';
export const SAVED_SPOT_TRUTH_SCHEMA_VERSION = 'saved-spot-truth/v1';

export const SAVED_STUDY_KINDS = Object.freeze({
  HAND: 'hand',
  SPOT: 'spot',
});

export const SAVED_STUDY_OWNER_KINDS = Object.freeze({
  LOCAL: 'local',
});

export const SAVED_STUDY_SOURCE_SURFACES = Object.freeze({
  HAND: 'hand',
  REPLAY: 'replay',
  PLAYBOOK: 'playbook',
  TRAINING: 'training',
  RANGE_CALIBRATION: 'range_calibration',
  MATRIX: 'matrix',
});

export const SAVED_STUDY_REVIEW_STATES = Object.freeze({
  NONE: 'none',
  REVIEW_LATER: 'review_later',
  RESOLVED: 'resolved',
});

export const SAVED_STUDY_CLASSIFICATIONS = Object.freeze({
  MISTAKE: 'mistake',
});

export const SAVED_STUDY_LIFECYCLE_STATES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const SAVED_SPOT_DERIVATIONS = Object.freeze({
  HAND: 'hand',
  SCENARIO: 'scenario',
});

const KIND_VALUES = new Set(Object.values(SAVED_STUDY_KINDS));
const SOURCE_SURFACE_VALUES = new Set(Object.values(SAVED_STUDY_SOURCE_SURFACES));
const REVIEW_STATE_VALUES = new Set(Object.values(SAVED_STUDY_REVIEW_STATES));
const CLASSIFICATION_VALUES = new Set(Object.values(SAVED_STUDY_CLASSIFICATIONS));
const LIFECYCLE_STATE_VALUES = new Set(Object.values(SAVED_STUDY_LIFECYCLE_STATES));
const SPOT_DERIVATION_VALUES = new Set(Object.values(SAVED_SPOT_DERIVATIONS));
const STREET_VALUES = new Set(Object.values(STREETS));
const BOARD_CARD_COUNTS = Object.freeze({
  [STREETS.PREFLOP]: 0,
  [STREETS.FLOP]: 3,
  [STREETS.TURN]: 4,
  [STREETS.RIVER]: 5,
});
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DISCRIMINATOR_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/u;
const MAX_TITLE_LENGTH = 240;
const MAX_NOTE_LENGTH = 100_000;
const MAX_TAGS = 64;
const MAX_TAG_LENGTH = 80;
const MAX_PORTABLE_DEPTH = 64;

export function deepFreezeSavedStudyData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreezeSavedStudyData(child);
  return value;
}

export function cloneSavedStudyData(value) {
  if (Array.isArray(value)) return value.map(cloneSavedStudyData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneSavedStudyData(entry)]),
  );
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireSchema(value, expected, label) {
  requireObject(value, label);
  if (value.schemaVersion !== expected) throw new TypeError(`Expected ${expected}`);
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function requireString(value, label, maximum = null) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  if (maximum !== null && value.length > maximum) {
    throw new RangeError(`${label} must be ${maximum} characters or fewer`);
  }
  return value;
}

function optionalText(value, label, maximum) {
  if (value === null || value === undefined || !String(value).trim()) return null;
  const normalized = String(value).normalize('NFKC').trim();
  if (normalized.length > maximum) {
    throw new RangeError(`${label} must be ${maximum} characters or fewer`);
  }
  return normalized;
}

function requireId(value, label) {
  requireString(value, label);
  if (!ID_PATTERN.test(value)) throw new RangeError(`${label} is not a portable stable ID`);
  return value;
}

function optionalId(value, label) {
  if (value === null || value === undefined) return null;
  return requireId(value, label);
}

function requireDiscriminator(value, label) {
  requireString(value, label);
  if (!DISCRIMINATOR_PATTERN.test(value)) {
    throw new RangeError(`${label} must be a stable lowercase discriminator`);
  }
  return value;
}

function requireIsoTimestamp(value, label) {
  requireString(value, label);
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

function requireChronology(createdAt, updatedAt, label) {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError(`${label}.updatedAt cannot precede createdAt`);
  }
}

function requireNonNegativeNumber(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number${nullable ? ' or null' : ''}`);
  }
  return value;
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`);
  }
  return value;
}

function requireUniqueStrings(values, label, maximum = 240) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  values.forEach((value, index) => requireString(value, `${label}[${index}]`, maximum));
  if (new Set(values).size !== values.length) throw new RangeError(`${label} contains duplicates`);
  return values;
}

export function assertPortableSavedStudyValue(value, label = 'value', depth = 0) {
  if (depth > MAX_PORTABLE_DEPTH) throw new RangeError(`${label} is nested too deeply`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPortableSavedStudyValue(entry, `${label}[${index}]`, depth + 1));
    return value;
  }
  requireObject(value, label);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must contain only plain serializable objects`);
  }
  for (const [key, entry] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new TypeError(`${label} contains an unsafe key`);
    }
    assertPortableSavedStudyValue(entry, `${label}.${key}`, depth + 1);
  }
  return value;
}

export function createSavedStudyOwnerRef(id) {
  const ownerRef = {
    schemaVersion: SAVED_STUDY_OWNER_SCHEMA_VERSION,
    kind: SAVED_STUDY_OWNER_KINDS.LOCAL,
    id: requireId(id, 'SavedStudyOwnerRef.id'),
  };
  return deepFreezeSavedStudyData(ownerRef);
}

export function validateSavedStudyOwnerRef(ownerRef) {
  requireSchema(ownerRef, SAVED_STUDY_OWNER_SCHEMA_VERSION, 'SavedStudyOwnerRef');
  requireExactKeys(ownerRef, ['schemaVersion', 'kind', 'id'], 'SavedStudyOwnerRef');
  if (ownerRef.kind !== SAVED_STUDY_OWNER_KINDS.LOCAL) {
    throw new RangeError(`Unsupported SavedStudyOwnerRef kind: ${ownerRef.kind}`);
  }
  requireId(ownerRef.id, 'SavedStudyOwnerRef.id');
  return ownerRef;
}

export function savedStudyOwnerKey(ownerRef) {
  validateSavedStudyOwnerRef(ownerRef);
  return `${ownerRef.kind}:${ownerRef.id}`;
}

export function sameSavedStudyOwner(left, right) {
  return savedStudyOwnerKey(left) === savedStudyOwnerKey(right);
}

export function createSavedStudySource({
  surface,
  sourceId = null,
  parentObjectId = null,
} = {}) {
  const source = {
    schemaVersion: SAVED_STUDY_SOURCE_SCHEMA_VERSION,
    surface: requireDiscriminator(surface, 'SavedStudySource.surface'),
    sourceId: sourceId === null ? null : requireString(sourceId, 'SavedStudySource.sourceId', 240),
    parentObjectId: optionalId(parentObjectId, 'SavedStudySource.parentObjectId'),
  };
  validateSavedStudySource(source);
  return deepFreezeSavedStudyData(source);
}

export function validateSavedStudySource(source) {
  requireSchema(source, SAVED_STUDY_SOURCE_SCHEMA_VERSION, 'SavedStudySource');
  requireExactKeys(
    source,
    ['schemaVersion', 'surface', 'sourceId', 'parentObjectId'],
    'SavedStudySource',
  );
  requireDiscriminator(source.surface, 'SavedStudySource.surface');
  if (!SOURCE_SURFACE_VALUES.has(source.surface)) {
    // A future surface remains portable and opaque; it never becomes a route contract.
    requireDiscriminator(source.surface, 'SavedStudySource.surface');
  }
  if (source.sourceId !== null) requireString(source.sourceId, 'SavedStudySource.sourceId', 240);
  optionalId(source.parentObjectId, 'SavedStudySource.parentObjectId');
  return source;
}

function normalizedTagDisplay(value) {
  const display = String(value).normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!display) throw new RangeError('Saved study tag cannot be empty');
  if (display.length > MAX_TAG_LENGTH) {
    throw new RangeError(`Saved study tags must be ${MAX_TAG_LENGTH} characters or fewer`);
  }
  return display;
}

export function normalizeSavedStudyTag(value) {
  const supplied = typeof value === 'string' ? value : value?.display;
  const display = normalizedTagDisplay(supplied);
  return deepFreezeSavedStudyData({
    schemaVersion: SAVED_STUDY_TAG_SCHEMA_VERSION,
    key: display.toLocaleLowerCase('en-US'),
    display,
  });
}

export function validateSavedStudyTag(tag) {
  requireSchema(tag, SAVED_STUDY_TAG_SCHEMA_VERSION, 'SavedStudyTag');
  requireExactKeys(tag, ['schemaVersion', 'key', 'display'], 'SavedStudyTag');
  const normalized = normalizeSavedStudyTag(tag.display);
  if (tag.key !== normalized.key || tag.display !== normalized.display) {
    throw new RangeError('SavedStudyTag is not normalized');
  }
  return tag;
}

function normalizeTags(values) {
  if (!Array.isArray(values)) throw new TypeError('SavedStudyAnnotations.tags must be an array');
  if (values.length > MAX_TAGS) throw new RangeError(`At most ${MAX_TAGS} saved study tags are supported`);
  const byKey = new Map();
  for (const value of values) {
    const tag = normalizeSavedStudyTag(value);
    if (!byKey.has(tag.key)) byKey.set(tag.key, tag);
  }
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key, 'en-US'));
}

function normalizeClassifications(values) {
  if (!Array.isArray(values)) throw new TypeError('SavedStudyAnnotations.classifications must be an array');
  for (const value of values) {
    if (!CLASSIFICATION_VALUES.has(value)) {
      throw new RangeError(`Unsupported saved study classification: ${value}`);
    }
  }
  return [...new Set(values)].sort();
}

export function createSavedStudyAnnotations({
  title = null,
  note = null,
  tags = [],
  reviewState = SAVED_STUDY_REVIEW_STATES.NONE,
  classifications = [],
} = {}) {
  const annotations = {
    schemaVersion: SAVED_STUDY_ANNOTATIONS_SCHEMA_VERSION,
    title: optionalText(title, 'SavedStudyAnnotations.title', MAX_TITLE_LENGTH),
    note: optionalText(note, 'SavedStudyAnnotations.note', MAX_NOTE_LENGTH),
    tags: normalizeTags(tags).map(cloneSavedStudyData),
    reviewState,
    classifications: normalizeClassifications(classifications),
  };
  validateSavedStudyAnnotations(annotations);
  return deepFreezeSavedStudyData(annotations);
}

export function validateSavedStudyAnnotations(annotations) {
  requireSchema(annotations, SAVED_STUDY_ANNOTATIONS_SCHEMA_VERSION, 'SavedStudyAnnotations');
  requireExactKeys(
    annotations,
    ['schemaVersion', 'title', 'note', 'tags', 'reviewState', 'classifications'],
    'SavedStudyAnnotations',
  );
  if (annotations.title !== null) {
    const normalized = optionalText(annotations.title, 'SavedStudyAnnotations.title', MAX_TITLE_LENGTH);
    if (normalized !== annotations.title) throw new RangeError('SavedStudyAnnotations.title is not normalized');
  }
  if (annotations.note !== null) {
    const normalized = optionalText(annotations.note, 'SavedStudyAnnotations.note', MAX_NOTE_LENGTH);
    if (normalized !== annotations.note) throw new RangeError('SavedStudyAnnotations.note is not normalized');
  }
  if (!Array.isArray(annotations.tags) || annotations.tags.length > MAX_TAGS) {
    throw new RangeError(`SavedStudyAnnotations.tags must contain at most ${MAX_TAGS} entries`);
  }
  annotations.tags.forEach(validateSavedStudyTag);
  const sortedTagKeys = annotations.tags.map((tag) => tag.key);
  if (new Set(sortedTagKeys).size !== sortedTagKeys.length
    || JSON.stringify(sortedTagKeys) !== JSON.stringify([...sortedTagKeys].sort((a, b) => a.localeCompare(b, 'en-US')))) {
    throw new RangeError('SavedStudyAnnotations.tags must be unique and sorted by normalized key');
  }
  if (!REVIEW_STATE_VALUES.has(annotations.reviewState)) {
    throw new RangeError(`Unsupported saved study review state: ${annotations.reviewState}`);
  }
  const normalizedClassifications = normalizeClassifications(annotations.classifications);
  if (JSON.stringify(normalizedClassifications) !== JSON.stringify(annotations.classifications)) {
    throw new RangeError('SavedStudyAnnotations.classifications must be unique and sorted');
  }
  return annotations;
}

function knownPrivateCardPlayerIds(state) {
  return state.players.filter((player) => Array.isArray(player.holeCards)).map((player) => player.playerId);
}

function hiddenPrivateCardPlayerIds(state) {
  return state.players.filter((player) => isHiddenHoleCards(player.holeCards)).map((player) => player.playerId);
}

export function createSavedHandSnapshot({ pokerState, heroPlayerId, replaySource } = {}) {
  validatePokerState(pokerState);
  requireString(heroPlayerId, 'SavedHandSnapshot.heroPlayerId', 240);
  const state = cloneSavedStudyData(pokerState);
  const durableReplaySource = cloneSavedStudyData(replaySource);
  const reconstruction = reconstructCanonicalHandReplaySource(durableReplaySource);
  const hero = state.players.find((player) => player.playerId === heroPlayerId);
  if (!hero) throw new RangeError('SavedHandSnapshot hero is not seated in the canonical hand');
  if (!Array.isArray(hero.holeCards) || hero.holeCards.length !== 2) {
    throw new RangeError('A saved canonical hand requires two known Hero cards');
  }
  if (reconstruction.heroPlayerId !== heroPlayerId) {
    throw new RangeError('SavedHandSnapshot Replay observer perspective must be Hero');
  }
  if (!canonicalPokerStatesEqual(reconstruction.finalState, state)) {
    throw new RangeError('SavedHandSnapshot Replay source must reconstruct its canonical PokerState exactly');
  }
  const snapshot = {
    schemaVersion: pokerState.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION
      ? SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION
      : SAVED_HAND_SNAPSHOT_SCHEMA_VERSION,
    heroPlayerId,
    pokerState: state,
    privacy: {
      schemaVersion: SAVED_HAND_PRIVACY_SCHEMA_VERSION,
      perspectivePlayerId: heroPlayerId,
      hiddenPrivateCardPlayerIds: hiddenPrivateCardPlayerIds(state),
      knownPrivateCardPlayerIds: knownPrivateCardPlayerIds(state),
    },
    replaySource: durableReplaySource,
  };
  validateSavedHandSnapshot(snapshot);
  return deepFreezeSavedStudyData(snapshot);
}

export function validateSavedHandSnapshot(snapshot) {
  requireObject(snapshot, 'SavedHandSnapshot');
  const expectedStateSchemaVersion = {
    [SAVED_HAND_SNAPSHOT_SCHEMA_VERSION]: POKER_STATE_SCHEMA_VERSION,
    [SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION]: POKER_STATE_V2_SCHEMA_VERSION,
  }[snapshot.schemaVersion];
  if (!expectedStateSchemaVersion) {
    throw new TypeError(
      `Unsupported SavedHandSnapshot version: ${String(snapshot.schemaVersion)}; supported: ${SAVED_HAND_SNAPSHOT_SCHEMA_VERSION}, ${SAVED_HAND_SNAPSHOT_V2_SCHEMA_VERSION}`,
    );
  }
  requireExactKeys(
    snapshot,
    ['schemaVersion', 'heroPlayerId', 'pokerState', 'privacy', 'replaySource'],
    'SavedHandSnapshot',
  );
  requireString(snapshot.heroPlayerId, 'SavedHandSnapshot.heroPlayerId', 240);
  if (snapshot.pokerState?.schemaVersion !== expectedStateSchemaVersion) {
    throw new TypeError(`Expected ${expectedStateSchemaVersion}`);
  }
  validatePokerState(snapshot.pokerState);
  const hero = snapshot.pokerState.players.find((player) => player.playerId === snapshot.heroPlayerId);
  if (!hero || !Array.isArray(hero.holeCards) || hero.holeCards.length !== 2) {
    throw new RangeError('SavedHandSnapshot requires a seated Hero with two known cards');
  }
  requireSchema(snapshot.privacy, SAVED_HAND_PRIVACY_SCHEMA_VERSION, 'SavedHandSnapshot.privacy');
  requireExactKeys(
    snapshot.privacy,
    ['schemaVersion', 'perspectivePlayerId', 'hiddenPrivateCardPlayerIds', 'knownPrivateCardPlayerIds'],
    'SavedHandSnapshot.privacy',
  );
  if (snapshot.privacy.perspectivePlayerId !== snapshot.heroPlayerId) {
    throw new RangeError('SavedHandSnapshot privacy perspective must be Hero');
  }
  requireUniqueStrings(snapshot.privacy.hiddenPrivateCardPlayerIds, 'hiddenPrivateCardPlayerIds');
  requireUniqueStrings(snapshot.privacy.knownPrivateCardPlayerIds, 'knownPrivateCardPlayerIds');
  if (JSON.stringify(snapshot.privacy.hiddenPrivateCardPlayerIds)
      !== JSON.stringify(hiddenPrivateCardPlayerIds(snapshot.pokerState))
    || JSON.stringify(snapshot.privacy.knownPrivateCardPlayerIds)
      !== JSON.stringify(knownPrivateCardPlayerIds(snapshot.pokerState))) {
    throw new RangeError('SavedHandSnapshot privacy metadata must match the canonical observer state');
  }
  const reconstruction = reconstructCanonicalHandReplaySource(snapshot.replaySource);
  if (reconstruction.heroPlayerId !== snapshot.heroPlayerId) {
    throw new RangeError('SavedHandSnapshot Replay observer perspective must be Hero');
  }
  if (reconstruction.finalState.schemaVersion !== expectedStateSchemaVersion) {
    throw new RangeError('SavedHandSnapshot Replay and PokerState versions must agree');
  }
  if (expectedStateSchemaVersion === POKER_STATE_V2_SCHEMA_VERSION
    && !canonicalPokerStatesEqual(
      reconstruction.finalState.rulesSnapshot,
      snapshot.pokerState.rulesSnapshot,
    )) {
    throw new RangeError('SavedHandSnapshot PokerState and Replay rules snapshots must agree');
  }
  if (!canonicalPokerStatesEqual(reconstruction.finalState, snapshot.pokerState)) {
    throw new RangeError('SavedHandSnapshot Replay source must reconstruct its canonical PokerState exactly');
  }
  return snapshot;
}

function validateDecisionContextSnapshot(context, derivation) {
  requireObject(context, 'SavedSpotSnapshot.decisionContext');
  if (context.schemaVersion !== 'decision-context/v1') {
    throw new TypeError('Expected decision-context/v1');
  }
  requireExactKeys(context, [
    'schemaVersion',
    'tableSize',
    'opponentCount',
    'heroPosition',
    'street',
    'heroCards',
    'board',
    'deadCards',
    'stackBb',
    'stackMode',
    'potBb',
    'lastAction',
    'facingSizeBb',
    'callAmountBb',
    'heroStreetContributionBb',
    'rakeMode',
    'forcedContributionPerPlayerBb',
    'totalForcedContributionBb',
  ], 'SavedSpotSnapshot.decisionContext');
  assertPortableSavedStudyValue(context, 'SavedSpotSnapshot.decisionContext');
  if (!Number.isInteger(context.tableSize) || context.tableSize < 2 || context.tableSize > 10) {
    throw new RangeError('DecisionContext tableSize must be an integer from 2 through 10');
  }
  requireString(context.heroPosition, 'DecisionContext.heroPosition', 16);
  if (!STREET_VALUES.has(context.street)) throw new RangeError('DecisionContext street is unsupported');
  const heroCards = assertCardArray(context.heroCards, 'DecisionContext.heroCards');
  const board = assertCardArray(context.board, 'DecisionContext.board');
  const deadCards = assertCardArray(context.deadCards ?? [], 'DecisionContext.deadCards');
  if (heroCards.length !== 2) throw new RangeError('A saved spot requires exactly two Hero cards');
  if (board.length !== BOARD_CARD_COUNTS[context.street]) {
    throw new RangeError('DecisionContext board length does not match its street');
  }
  assertUniqueKnownCards([
    { label: 'heroCards', cards: heroCards },
    { label: 'board', cards: board },
    { label: 'deadCards', cards: deadCards },
  ]);
  requirePositiveNumber(context.stackBb, 'DecisionContext.stackBb');
  requireString(context.stackMode, 'DecisionContext.stackMode', 32);
  requireNonNegativeNumber(context.potBb, 'DecisionContext.potBb');
  requireString(context.lastAction, 'DecisionContext.lastAction', 32);
  requireNonNegativeNumber(context.facingSizeBb, 'DecisionContext.facingSizeBb');
  requireNonNegativeNumber(context.callAmountBb, 'DecisionContext.callAmountBb', { nullable: true });
  requireNonNegativeNumber(
    context.heroStreetContributionBb,
    'DecisionContext.heroStreetContributionBb',
    { nullable: true },
  );
  requireString(context.rakeMode, 'DecisionContext.rakeMode', 64);
  requireNonNegativeNumber(
    context.forcedContributionPerPlayerBb,
    'DecisionContext.forcedContributionPerPlayerBb',
  );
  requireNonNegativeNumber(context.totalForcedContributionBb, 'DecisionContext.totalForcedContributionBb');

  if (derivation === SAVED_SPOT_DERIVATIONS.SCENARIO) {
    if (context.opponentCount !== null || context.heroStreetContributionBb !== null) {
      throw new RangeError('Scenario-derived saved spots must preserve unknown live/history facts as null');
    }
  } else if (!Number.isInteger(context.opponentCount)
    || context.opponentCount < 1 || context.opponentCount >= context.tableSize
    || context.callAmountBb === null || context.heroStreetContributionBb === null) {
    throw new RangeError('Hand-derived saved spots require exact canonical opponent and pricing facts');
  }
  return context;
}

function validateScenarioInput(input) {
  requireObject(input, 'SavedSpotSnapshot.scenarioInput');
  if (input.schemaVersion !== 'playbook-scenario/v1') throw new TypeError('Expected playbook-scenario/v1');
  requireExactKeys(input, [
    'schemaVersion',
    'tableSize',
    'heroPosition',
    'street',
    'heroCards',
    'board',
    'deadCards',
    'stackBb',
    'stackMode',
    'potBb',
    'lastAction',
    'lastActionLabel',
    'facingSizeBb',
    'rakeMode',
    'forcedContributionPerPlayerBb',
    'totalForcedContributionBb',
    'anteBb',
    'straddleBb',
  ], 'SavedSpotSnapshot.scenarioInput');
  assertPortableSavedStudyValue(input, 'SavedSpotSnapshot.scenarioInput');
  for (const forbidden of ['actionHistory', 'history', 'pokerState', 'replayFrames']) {
    if (Object.hasOwn(input, forbidden)) {
      throw new RangeError('Scenario-derived saved spots cannot claim canonical history');
    }
  }
  return input;
}

export function createSavedHandReference({
  savedHandObjectId = null,
  canonicalHandId = null,
  actionSequenceCount,
} = {}) {
  const reference = {
    schemaVersion: SAVED_HAND_REFERENCE_SCHEMA_VERSION,
    savedHandObjectId: optionalId(savedHandObjectId, 'SavedHandReference.savedHandObjectId'),
    canonicalHandId: canonicalHandId === null
      ? null
      : requireString(canonicalHandId, 'SavedHandReference.canonicalHandId', 240),
    actionSequenceCount,
  };
  validateSavedHandReference(reference);
  return deepFreezeSavedStudyData(reference);
}

export function validateSavedHandReference(reference) {
  requireSchema(reference, SAVED_HAND_REFERENCE_SCHEMA_VERSION, 'SavedHandReference');
  requireExactKeys(
    reference,
    ['schemaVersion', 'savedHandObjectId', 'canonicalHandId', 'actionSequenceCount'],
    'SavedHandReference',
  );
  optionalId(reference.savedHandObjectId, 'SavedHandReference.savedHandObjectId');
  if (reference.canonicalHandId !== null) {
    requireString(reference.canonicalHandId, 'SavedHandReference.canonicalHandId', 240);
  }
  if (!Number.isInteger(reference.actionSequenceCount) || reference.actionSequenceCount < 0) {
    throw new RangeError('SavedHandReference.actionSequenceCount must be non-negative');
  }
  return reference;
}

export function createSavedSpotSnapshot({
  derivation,
  decisionContext,
  scenarioInput = null,
  handReference = null,
  rulesSnapshot = null,
} = {}) {
  if (!SPOT_DERIVATION_VALUES.has(derivation)) {
    throw new RangeError(`Unsupported saved spot derivation: ${derivation}`);
  }
  const truth = derivation === SAVED_SPOT_DERIVATIONS.HAND
    ? {
      schemaVersion: SAVED_SPOT_TRUTH_SCHEMA_VERSION,
      completeness: 'canonical_decision_context',
      historyStatus: 'canonical_reference',
    }
    : {
      schemaVersion: SAVED_SPOT_TRUTH_SCHEMA_VERSION,
      completeness: 'lossy_scenario',
      historyStatus: 'not_available',
    };
  const durableRulesSnapshot = rulesSnapshot === null
    ? null
    : cloneSavedStudyData(validateGameRulesSnapshot(rulesSnapshot));
  const snapshot = {
    schemaVersion: durableRulesSnapshot === null
      ? SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION
      : SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION,
    derivation,
    decisionContext: cloneSavedStudyData(decisionContext),
    scenarioInput: scenarioInput === null ? null : cloneSavedStudyData(scenarioInput),
    handReference: handReference === null ? null : cloneSavedStudyData(handReference),
    truth,
    ...(durableRulesSnapshot === null ? {} : { rulesSnapshot: durableRulesSnapshot }),
  };
  validateSavedSpotSnapshot(snapshot);
  return deepFreezeSavedStudyData(snapshot);
}

export function validateSavedSpotSnapshot(snapshot) {
  requireObject(snapshot, 'SavedSpotSnapshot');
  if (![SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION, SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION]
    .includes(snapshot.schemaVersion)) {
    throw new TypeError(
      `Unsupported SavedSpotSnapshot version: ${String(snapshot.schemaVersion)}; supported: ${SAVED_SPOT_SNAPSHOT_SCHEMA_VERSION}, ${SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION}`,
    );
  }
  const isV2 = snapshot.schemaVersion === SAVED_SPOT_SNAPSHOT_V2_SCHEMA_VERSION;
  requireExactKeys(
    snapshot,
    isV2
      ? [
        'schemaVersion', 'derivation', 'decisionContext', 'scenarioInput', 'handReference',
        'truth', 'rulesSnapshot',
      ]
      : ['schemaVersion', 'derivation', 'decisionContext', 'scenarioInput', 'handReference', 'truth'],
    'SavedSpotSnapshot',
  );
  if (!SPOT_DERIVATION_VALUES.has(snapshot.derivation)) {
    throw new RangeError(`Unsupported saved spot derivation: ${snapshot.derivation}`);
  }
  validateDecisionContextSnapshot(snapshot.decisionContext, snapshot.derivation);
  if (isV2) validateSavedSpotRulesConsistency(snapshot);
  requireSchema(snapshot.truth, SAVED_SPOT_TRUTH_SCHEMA_VERSION, 'SavedSpotSnapshot.truth');
  requireExactKeys(snapshot.truth, ['schemaVersion', 'completeness', 'historyStatus'], 'SavedSpotSnapshot.truth');
  if (snapshot.derivation === SAVED_SPOT_DERIVATIONS.HAND) {
    if (snapshot.scenarioInput !== null || snapshot.handReference === null
      || snapshot.truth.completeness !== 'canonical_decision_context'
      || snapshot.truth.historyStatus !== 'canonical_reference') {
      throw new RangeError('Hand-derived saved spot truth/reference fields are inconsistent');
    }
    validateSavedHandReference(snapshot.handReference);
  } else {
    if (snapshot.scenarioInput === null || snapshot.handReference !== null
      || snapshot.truth.completeness !== 'lossy_scenario'
      || snapshot.truth.historyStatus !== 'not_available') {
      throw new RangeError('Scenario-derived saved spot truth fields are inconsistent');
    }
    validateScenarioInput(snapshot.scenarioInput);
  }
  return snapshot;
}

function validateSavedSpotRulesConsistency(snapshot) {
  const rulesSnapshot = validateGameRulesSnapshot(snapshot.rulesSnapshot);
  const context = snapshot.decisionContext;
  if (rulesSnapshot.setup.seatedPlayers !== context.tableSize) {
    throw new RangeError('SavedSpotSnapshot rules seated-player setup must match DecisionContext');
  }
  const policy = rulesSnapshot.definition.collectionPolicy;
  const fixed = policy.type === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER;
  const expectedPerPlayerBb = fixed ? policy.amountMilliBb / 1000 : 0;
  const expectedTotalBb = fixed ? (policy.amountMilliBb * context.tableSize) / 1000 : 0;
  const expectedRakeMode = fixed ? 'fixed' : 'off';
  if (context.rakeMode !== expectedRakeMode
    || context.forcedContributionPerPlayerBb !== expectedPerPlayerBb
    || context.totalForcedContributionBb !== expectedTotalBb) {
    throw new RangeError('SavedSpotSnapshot DecisionContext accounting must match its rules snapshot');
  }
  if (snapshot.scenarioInput !== null) {
    const scenario = snapshot.scenarioInput;
    if (scenario.tableSize !== context.tableSize
      || scenario.rakeMode !== expectedRakeMode
      || scenario.forcedContributionPerPlayerBb !== expectedPerPlayerBb
      || scenario.totalForcedContributionBb !== expectedTotalBb
      || scenario.anteBb !== rulesSnapshot.definition.ante.amountMilliBb / 1000
      || scenario.straddleBb !== 0) {
      throw new RangeError('SavedSpotSnapshot Scenario accounting must match its rules snapshot');
    }
  }
}

function validatePayload(kind, payload) {
  requireObject(payload, 'SavedStudyObject.payload');
  assertPortableSavedStudyValue(payload, 'SavedStudyObject.payload');
  requireString(payload.schemaVersion, 'SavedStudyObject.payload.schemaVersion', 120);
  if (kind === SAVED_STUDY_KINDS.HAND) return validateSavedHandSnapshot(payload);
  if (kind === SAVED_STUDY_KINDS.SPOT) return validateSavedSpotSnapshot(payload);
  // Future kinds are preserved as opaque versioned JSON. This client never interprets them.
  return payload;
}

export function createSavedStudyObject({
  id,
  ownerRef,
  kind,
  createdAt,
  updatedAt = createdAt,
  revision = 1,
  annotations = createSavedStudyAnnotations(),
  source,
  payload,
  lifecycle = null,
} = {}) {
  const object = {
    schemaVersion: SAVED_STUDY_OBJECT_SCHEMA_VERSION,
    id: requireId(id, 'SavedStudyObject.id'),
    ownerRef: cloneSavedStudyData(ownerRef),
    kind: requireDiscriminator(kind, 'SavedStudyObject.kind'),
    createdAt,
    updatedAt,
    revision,
    annotations: cloneSavedStudyData(annotations),
    source: cloneSavedStudyData(source),
    payload: cloneSavedStudyData(payload),
    lifecycle: lifecycle === null
      ? { state: SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, archivedAt: null }
      : cloneSavedStudyData(lifecycle),
  };
  validateSavedStudyObject(object);
  return deepFreezeSavedStudyData(object);
}

export function validateSavedStudyObject(object) {
  requireSchema(object, SAVED_STUDY_OBJECT_SCHEMA_VERSION, 'SavedStudyObject');
  requireExactKeys(
    object,
    [
      'schemaVersion', 'id', 'ownerRef', 'kind', 'createdAt', 'updatedAt', 'revision',
      'annotations', 'source', 'payload', 'lifecycle',
    ],
    'SavedStudyObject',
  );
  requireId(object.id, 'SavedStudyObject.id');
  validateSavedStudyOwnerRef(object.ownerRef);
  requireDiscriminator(object.kind, 'SavedStudyObject.kind');
  requireIsoTimestamp(object.createdAt, 'SavedStudyObject.createdAt');
  requireIsoTimestamp(object.updatedAt, 'SavedStudyObject.updatedAt');
  requireChronology(object.createdAt, object.updatedAt, 'SavedStudyObject');
  if (!Number.isInteger(object.revision) || object.revision < 1) {
    throw new RangeError('SavedStudyObject.revision must be a positive integer');
  }
  validateSavedStudyAnnotations(object.annotations);
  validateSavedStudySource(object.source);
  validatePayload(object.kind, object.payload);
  requireObject(object.lifecycle, 'SavedStudyObject.lifecycle');
  requireExactKeys(object.lifecycle, ['state', 'archivedAt'], 'SavedStudyObject.lifecycle');
  if (!LIFECYCLE_STATE_VALUES.has(object.lifecycle.state)) {
    throw new RangeError(`Unsupported SavedStudyObject lifecycle: ${object.lifecycle.state}`);
  }
  if (object.lifecycle.state === SAVED_STUDY_LIFECYCLE_STATES.ACTIVE) {
    if (object.lifecycle.archivedAt !== null) {
      throw new RangeError('An active SavedStudyObject cannot set archivedAt');
    }
  } else {
    requireIsoTimestamp(object.lifecycle.archivedAt, 'SavedStudyObject.lifecycle.archivedAt');
    if (Date.parse(object.lifecycle.archivedAt) < Date.parse(object.createdAt)
      || object.lifecycle.archivedAt !== object.updatedAt) {
      throw new RangeError('Archived SavedStudyObject timestamps are inconsistent');
    }
  }
  return object;
}

export function updateSavedStudyAnnotations(object, changes = {}, updatedAt) {
  validateSavedStudyObject(object);
  if (object.lifecycle.state !== SAVED_STUDY_LIFECYCLE_STATES.ACTIVE) {
    throw new RangeError('Archived SavedStudyObjects are immutable');
  }
  requireIsoTimestamp(updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(object.updatedAt)) {
    throw new RangeError('SavedStudyObject update timestamp cannot move backwards');
  }
  const annotations = createSavedStudyAnnotations({
    title: Object.hasOwn(changes, 'title') ? changes.title : object.annotations.title,
    note: Object.hasOwn(changes, 'note') ? changes.note : object.annotations.note,
    tags: Object.hasOwn(changes, 'tags') ? changes.tags : object.annotations.tags,
    reviewState: changes.reviewState ?? object.annotations.reviewState,
    classifications: changes.classifications ?? object.annotations.classifications,
  });
  return createSavedStudyObject({
    ...object,
    annotations,
    updatedAt,
    revision: object.revision + 1,
  });
}

export function archiveSavedStudyObject(object, archivedAt) {
  validateSavedStudyObject(object);
  if (object.lifecycle.state === SAVED_STUDY_LIFECYCLE_STATES.ARCHIVED) return object;
  requireIsoTimestamp(archivedAt, 'archivedAt');
  if (Date.parse(archivedAt) < Date.parse(object.updatedAt)) {
    throw new RangeError('SavedStudyObject archive timestamp cannot move backwards');
  }
  return createSavedStudyObject({
    ...object,
    updatedAt: archivedAt,
    revision: object.revision + 1,
    lifecycle: { state: SAVED_STUDY_LIFECYCLE_STATES.ARCHIVED, archivedAt },
  });
}

export function isKnownSavedStudyKind(kind) {
  return KIND_VALUES.has(kind);
}
