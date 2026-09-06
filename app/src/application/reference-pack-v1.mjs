import {
  ACTION_TYPES,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
  getGameRulesSemanticFingerprint,
  isPreflopHandClass,
  preflopHandClassForCards,
  validateGameRulesDefinition,
} from '../../../shared/poker-domain/index.js';
import {
  PREFLOP_DECISION_ROLES,
  preflopDecisionRoleFor,
} from './preflop-decision-role.mjs';
import {
  STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES,
  STRATEGY_ACTION_SIZING_CAPABILITIES,
  STRATEGY_COVERAGE_KINDS,
  STRATEGY_EXACT_DISTRIBUTION_TOLERANCE,
  STRATEGY_GRADING_CAPABILITIES,
  STRATEGY_SOURCE_AUTHORITIES,
  STRATEGY_SOURCE_FAMILIES,
  createStrategyContextCoverage,
  createStrategySourceDescriptor,
} from './strategy-source-authority.mjs';

export const REFERENCE_PACK_SCHEMA_VERSION = 'reference-pack/v1';
export const REFERENCE_PACK_MATCHER_VERSION = 'reference-pack-context-matcher/v1';
export const REFERENCE_PACK_ADAPTER_VERSION = 'reference-pack-provider-adapter/v1';
export const REFERENCE_PACK_REPRESENTATION = 'preflop_169_class';
export const REFERENCE_PACK_INTEGRITY_ALGORITHM = 'fnv1a32';
export const REFERENCE_PACK_PROBABILITY_TOLERANCE = 1e-9;

export const REFERENCE_PACK_VALIDATION_STATUSES = Object.freeze({
  SYNTHETIC_TEST_ONLY: 'synthetic_test_only',
  ACCEPTED_COMPARATIVE: 'accepted_comparative',
  ACCEPTED_VALIDATED: 'accepted_validated',
});

export const REFERENCE_PACK_REDISTRIBUTION_STATUSES = Object.freeze({
  PERMITTED: 'permitted',
  PROHIBITED: 'prohibited',
  UNKNOWN: 'unknown',
});

const ROOT_KEYS = Object.freeze(['schemaVersion', 'manifest', 'representation', 'integrity']);
const MANIFEST_KEYS = Object.freeze([
  'identity',
  'sourceDescriptor',
  'gameAssumptions',
  'source',
  'capabilities',
  'validation',
  'limitations',
]);
const IDENTITY_KEYS = Object.freeze(['packId', 'packVersion']);
const SOURCE_DESCRIPTOR_KEYS = Object.freeze([
  'id', 'version', 'displayName', 'displayNameKey', 'family', 'authority',
]);
const GAME_ASSUMPTION_KEYS = Object.freeze([
  'gameRulesDefinition',
  'gameRulesSemanticFingerprint',
  'tableSize',
  'orderedPositions',
  'heroPosition',
  'aggressorPosition',
  'decisionRole',
  'startingStackBb',
  'effectiveStackBb',
  'effectiveStackSemantics',
  'priorActionTree',
  'availableActionFamilies',
  'supportedAggressiveSizes',
  'legalActionBounds',
  'opponentBoundary',
  'opponentCount',
]);
const PRIOR_ACTION_KEYS = Object.freeze([
  'street',
  'lastActionFamily',
  'lastActorPosition',
  'facingActionFamily',
  'aggressionFamily',
  'aggressionCount',
  'limperCount',
  'heroPreviousVoluntaryActionFamily',
  'initialAggressorPosition',
  'distinctAggressorCount',
  'latestAggressionWasCold',
  'heroActionWouldBeCold',
  'openToBb',
  'callAmountBb',
  'heroStreetContributionBb',
  'currentPotBb',
]);
const PRIOR_ACTION_ACTOR_ECONOMICS_KEYS = Object.freeze([
  'actorContestablePotAfterCallBb',
  'actorIneligiblePotAfterCallBb',
  'requiredRawEquity',
]);
const LEGAL_BOUND_KEYS = Object.freeze([
  'canRaise', 'minRaiseToBb', 'maxRaiseToBb', 'allInToBb',
]);
const SOURCE_KEYS = Object.freeze([
  'origin',
  'method',
  'sourceIdentity',
  'sourceVersion',
  'sourceDate',
  'license',
  'redistribution',
  'provenanceNotes',
]);
const LICENSE_KEYS = Object.freeze(['name', 'identifier', 'url']);
const REDISTRIBUTION_KEYS = Object.freeze(['status', 'repositoryInclusionPermitted']);
const CAPABILITY_KEYS = Object.freeze([
  'actionDistribution', 'dominantAction', 'actionSizing', 'actionEv', 'grading', 'optimality',
]);
const VALIDATION_KEYS = Object.freeze([
  'version',
  'evidenceId',
  'status',
  'authorityDecision',
  'validationCorpus',
  'metricDefinitions',
  'knownLimitations',
  'acceptanceDate',
]);
const REPRESENTATION_KEYS = Object.freeze(['kind', 'rows']);
const ROW_KEYS = Object.freeze(['handClass', 'actions']);
const ACTION_KEYS = Object.freeze(['type', 'amountToBb', 'probability', 'evBb']);
const INTEGRITY_KEYS = Object.freeze(['algorithm', 'contentHash']);
const AGGRESSIVE_ACTIONS = Object.freeze(new Set([
  ACTION_TYPES.BET,
  ACTION_TYPES.RAISE,
  ACTION_TYPES.ALL_IN,
]));
const PREFLOP_ACTIONS = Object.freeze(new Set([
  ACTION_TYPES.FOLD,
  ACTION_TYPES.CHECK,
  ACTION_TYPES.CALL,
  ACTION_TYPES.RAISE,
  ACTION_TYPES.ALL_IN,
]));
const ACTION_ORDER = Object.freeze([
  ACTION_TYPES.FOLD,
  ACTION_TYPES.CHECK,
  ACTION_TYPES.CALL,
  ACTION_TYPES.BET,
  ACTION_TYPES.RAISE,
  ACTION_TYPES.ALL_IN,
]);
const VALIDATION_STATUS_VALUES = Object.freeze(Object.values(REFERENCE_PACK_VALIDATION_STATUSES));
const REDISTRIBUTION_VALUES = Object.freeze(
  Object.values(REFERENCE_PACK_REDISTRIBUTION_STATUSES),
);
const ROLE_VALUES = Object.freeze(Object.values(PREFLOP_DECISION_ROLES));
const VALIDATED_REFERENCE_PACKS = new WeakSet();
const SOURCE_ORIGINS = Object.freeze(new Set([
  'riverline_owned',
  'licensed',
  'public',
  'independent_solver',
]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  requireObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value.trim();
}

function nullableString(value, label) {
  if (value === null) return null;
  return requiredString(value, label);
}

function booleanValue(value, label) {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean`);
  return value;
}

function stableId(value, label) {
  const id = requiredString(value, label);
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(id)) {
    throw new RangeError(`${label} must be a stable lowercase ID`);
  }
  return id;
}

function finiteNumber(value, label, {
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
} = {}) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be a finite number from ${minimum} through ${maximum}`);
  }
  return Number(value);
}

function nullableFiniteNumber(value, label, options = {}) {
  return value === null ? null : finiteNumber(value, label, options);
}

function nonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a nonnegative safe integer`);
  }
  return value;
}

function stringArray(value, label, { nonempty = false } = {}) {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) {
    throw new TypeError(`${label} must be ${nonempty ? 'a non-empty' : 'an'} array`);
  }
  return value.map((entry, index) => requiredString(entry, `${label}[${index}]`));
}

function canonicalSerialize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('Reference-pack integrity rejects non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`;
  if (!value || typeof value !== 'object') {
    throw new TypeError('Reference-pack integrity accepts only JSON-compatible data');
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`
  )).join(',')}}`;
}

function fnv1a32(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function packIntegrityPayload(pack) {
  const copy = cloneData(pack);
  copy.integrity = { algorithm: copy.integrity?.algorithm };
  return copy;
}

export function computeReferencePackContentHash(pack) {
  requireObject(pack, 'Reference pack');
  if (pack.integrity?.algorithm !== REFERENCE_PACK_INTEGRITY_ALGORITHM) {
    throw new RangeError(`Reference pack integrity algorithm must be ${REFERENCE_PACK_INTEGRITY_ALGORITHM}`);
  }
  return `${REFERENCE_PACK_INTEGRITY_ALGORITHM}:${fnv1a32(
    canonicalSerialize(packIntegrityPayload(pack)),
  )}`;
}

export function attachReferencePackIntegrity(pack) {
  const copy = cloneData(pack);
  copy.integrity = {
    algorithm: REFERENCE_PACK_INTEGRITY_ALGORITHM,
    contentHash: null,
  };
  copy.integrity.contentHash = computeReferencePackContentHash(copy);
  return copy;
}

function normalizeSourceDescriptor(raw, capabilities, limitations) {
  requireExactKeys(raw, SOURCE_DESCRIPTOR_KEYS, 'Reference pack sourceDescriptor');
  if (raw.family !== STRATEGY_SOURCE_FAMILIES.REFERENCE_PACK) {
    throw new RangeError('Reference pack sourceDescriptor.family must be reference_pack');
  }
  return createStrategySourceDescriptor({
    ...raw,
    capabilities,
    defaultCoverage: STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
    limitations,
  });
}

function normalizeCapabilities(raw) {
  requireExactKeys(raw, CAPABILITY_KEYS, 'Reference pack capabilities');
  const capabilities = {
    actionDistribution: raw.actionDistribution,
    dominantAction: booleanValue(
      raw.dominantAction,
      'Reference pack capabilities.dominantAction',
    ),
    actionSizing: raw.actionSizing,
    actionEv: booleanValue(raw.actionEv, 'Reference pack capabilities.actionEv'),
    grading: raw.grading,
    optimality: booleanValue(raw.optimality, 'Reference pack capabilities.optimality'),
  };
  if (![
    STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
    STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.EXACT,
  ].includes(capabilities.actionDistribution)) {
    throw new RangeError('Reference pack actionDistribution must be quantitative or exact');
  }
  if (!capabilities.dominantAction) {
    throw new RangeError('Complete reference-pack distributions must declare dominantAction');
  }
  if (!Object.values(STRATEGY_ACTION_SIZING_CAPABILITIES)
    .includes(capabilities.actionSizing)) {
    throw new RangeError(`Unsupported reference-pack actionSizing: ${raw.actionSizing}`);
  }
  if (!Object.values(STRATEGY_GRADING_CAPABILITIES).includes(capabilities.grading)) {
    throw new RangeError(`Unsupported reference-pack grading: ${raw.grading}`);
  }
  if (capabilities.optimality) {
    throw new RangeError('reference-pack/v1 does not authorize optimality capability');
  }
  return capabilities;
}

function normalizeSource(raw) {
  requireExactKeys(raw, SOURCE_KEYS, 'Reference pack source');
  requireExactKeys(raw.license, LICENSE_KEYS, 'Reference pack source.license');
  requireExactKeys(
    raw.redistribution,
    REDISTRIBUTION_KEYS,
    'Reference pack source.redistribution',
  );
  if (!REDISTRIBUTION_VALUES.includes(raw.redistribution.status)) {
    throw new RangeError(`Unsupported redistribution status: ${raw.redistribution.status}`);
  }
  const sourceDate = requiredString(raw.sourceDate, 'Reference pack source.sourceDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
    throw new RangeError('Reference pack source.sourceDate must use YYYY-MM-DD');
  }
  const origin = requiredString(raw.origin, 'Reference pack source.origin');
  if (!SOURCE_ORIGINS.has(origin)) {
    throw new RangeError(`Unsupported reference-pack source origin: ${origin}`);
  }
  const repositoryInclusionPermitted = booleanValue(
    raw.redistribution.repositoryInclusionPermitted,
    'Reference pack source.redistribution.repositoryInclusionPermitted',
  );
  if (raw.redistribution.status !== REFERENCE_PACK_REDISTRIBUTION_STATUSES.PERMITTED
    && repositoryInclusionPermitted) {
    throw new RangeError('Repository inclusion cannot be permitted without permitted redistribution');
  }
  return {
    origin,
    method: requiredString(raw.method, 'Reference pack source.method'),
    sourceIdentity: requiredString(raw.sourceIdentity, 'Reference pack source.sourceIdentity'),
    sourceVersion: requiredString(raw.sourceVersion, 'Reference pack source.sourceVersion'),
    sourceDate,
    license: {
      name: requiredString(raw.license.name, 'Reference pack source.license.name'),
      identifier: requiredString(
        raw.license.identifier,
        'Reference pack source.license.identifier',
      ),
      url: nullableString(raw.license.url, 'Reference pack source.license.url'),
    },
    redistribution: {
      status: raw.redistribution.status,
      repositoryInclusionPermitted,
    },
    provenanceNotes: requiredString(
      raw.provenanceNotes,
      'Reference pack source.provenanceNotes',
    ),
  };
}

function normalizeValidation(raw) {
  requireExactKeys(raw, VALIDATION_KEYS, 'Reference pack validation');
  if (!VALIDATION_STATUS_VALUES.includes(raw.status)) {
    throw new RangeError(`Unsupported reference-pack validation status: ${raw.status}`);
  }
  const acceptanceDate = raw.acceptanceDate === null
    ? null
    : requiredString(raw.acceptanceDate, 'Reference pack validation.acceptanceDate');
  if (acceptanceDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(acceptanceDate)) {
    throw new RangeError('Reference pack validation.acceptanceDate must use YYYY-MM-DD');
  }
  if (raw.status !== REFERENCE_PACK_VALIDATION_STATUSES.SYNTHETIC_TEST_ONLY
    && acceptanceDate === null) {
    throw new RangeError('Accepted reference packs require an acceptanceDate');
  }
  return {
    version: requiredString(raw.version, 'Reference pack validation.version'),
    evidenceId: requiredString(raw.evidenceId, 'Reference pack validation.evidenceId'),
    status: raw.status,
    authorityDecision: requiredString(
      raw.authorityDecision,
      'Reference pack validation.authorityDecision',
    ),
    validationCorpus: stringArray(
      raw.validationCorpus,
      'Reference pack validation.validationCorpus',
      { nonempty: true },
    ),
    metricDefinitions: stringArray(
      raw.metricDefinitions,
      'Reference pack validation.metricDefinitions',
      { nonempty: true },
    ),
    knownLimitations: stringArray(
      raw.knownLimitations,
      'Reference pack validation.knownLimitations',
      { nonempty: true },
    ),
    acceptanceDate,
  };
}

function normalizePriorActionTree(raw) {
  const carriesActorEconomics = PRIOR_ACTION_ACTOR_ECONOMICS_KEYS.some((key) => (
    Object.hasOwn(raw, key)
  ));
  requireExactKeys(raw, [
    ...PRIOR_ACTION_KEYS,
    ...(carriesActorEconomics ? PRIOR_ACTION_ACTOR_ECONOMICS_KEYS : []),
  ], 'Reference pack priorActionTree');
  if (carriesActorEconomics && PRIOR_ACTION_ACTOR_ECONOMICS_KEYS.some((key) => (
    !Object.hasOwn(raw, key)
  ))) {
    throw new TypeError('Reference pack actor economics fields must be carried together');
  }
  if (raw.street !== 'preflop') {
    throw new RangeError('reference-pack/v1 supports preflop nodes only');
  }
  return {
    street: raw.street,
    lastActionFamily: requiredString(raw.lastActionFamily, 'priorActionTree.lastActionFamily'),
    lastActorPosition: requiredString(raw.lastActorPosition, 'priorActionTree.lastActorPosition'),
    facingActionFamily: requiredString(
      raw.facingActionFamily,
      'priorActionTree.facingActionFamily',
    ),
    aggressionFamily: requiredString(raw.aggressionFamily, 'priorActionTree.aggressionFamily'),
    aggressionCount: nonnegativeInteger(raw.aggressionCount, 'priorActionTree.aggressionCount'),
    limperCount: nonnegativeInteger(raw.limperCount, 'priorActionTree.limperCount'),
    heroPreviousVoluntaryActionFamily: requiredString(
      raw.heroPreviousVoluntaryActionFamily,
      'priorActionTree.heroPreviousVoluntaryActionFamily',
    ),
    initialAggressorPosition: requiredString(
      raw.initialAggressorPosition,
      'priorActionTree.initialAggressorPosition',
    ),
    distinctAggressorCount: nonnegativeInteger(
      raw.distinctAggressorCount,
      'priorActionTree.distinctAggressorCount',
    ),
    latestAggressionWasCold: booleanValue(
      raw.latestAggressionWasCold,
      'priorActionTree.latestAggressionWasCold',
    ),
    heroActionWouldBeCold: booleanValue(
      raw.heroActionWouldBeCold,
      'priorActionTree.heroActionWouldBeCold',
    ),
    openToBb: finiteNumber(raw.openToBb, 'priorActionTree.openToBb', { minimum: 0 }),
    callAmountBb: finiteNumber(
      raw.callAmountBb,
      'priorActionTree.callAmountBb',
      { minimum: 0 },
    ),
    heroStreetContributionBb: finiteNumber(
      raw.heroStreetContributionBb,
      'priorActionTree.heroStreetContributionBb',
      { minimum: 0 },
    ),
    currentPotBb: finiteNumber(
      raw.currentPotBb,
      'priorActionTree.currentPotBb',
      { minimum: 0 },
    ),
    actorContestablePotAfterCallBb: carriesActorEconomics
      ? finiteNumber(
        raw.actorContestablePotAfterCallBb,
        'priorActionTree.actorContestablePotAfterCallBb',
        { minimum: 0 },
      )
      : null,
    actorIneligiblePotAfterCallBb: carriesActorEconomics
      ? finiteNumber(
        raw.actorIneligiblePotAfterCallBb,
        'priorActionTree.actorIneligiblePotAfterCallBb',
        { minimum: 0 },
      )
      : null,
    requiredRawEquity: carriesActorEconomics
      ? nullableFiniteNumber(
        raw.requiredRawEquity,
        'priorActionTree.requiredRawEquity',
        { minimum: 0, maximum: 1 },
      )
      : null,
  };
}

function normalizeLegalBounds(raw) {
  requireExactKeys(raw, LEGAL_BOUND_KEYS, 'Reference pack legalActionBounds');
  return {
    canRaise: booleanValue(raw.canRaise, 'legalActionBounds.canRaise'),
    minRaiseToBb: nullableFiniteNumber(
      raw.minRaiseToBb,
      'legalActionBounds.minRaiseToBb',
      { minimum: 0 },
    ),
    maxRaiseToBb: nullableFiniteNumber(
      raw.maxRaiseToBb,
      'legalActionBounds.maxRaiseToBb',
      { minimum: 0 },
    ),
    allInToBb: nullableFiniteNumber(
      raw.allInToBb,
      'legalActionBounds.allInToBb',
      { minimum: 0 },
    ),
  };
}

function normalizeGameAssumptions(raw) {
  requireExactKeys(raw, GAME_ASSUMPTION_KEYS, 'Reference pack gameAssumptions');
  const gameRulesDefinition = validateGameRulesDefinition(raw.gameRulesDefinition);
  const expectedFingerprint = getGameRulesSemanticFingerprint(gameRulesDefinition);
  if (raw.gameRulesSemanticFingerprint !== expectedFingerprint) {
    throw new RangeError('Reference pack gameRulesSemanticFingerprint does not match its definition');
  }
  if (!Number.isInteger(raw.tableSize) || raw.tableSize < 2 || raw.tableSize > 10) {
    throw new RangeError('Reference pack tableSize must be an integer from 2 through 10');
  }
  if (raw.tableSize < gameRulesDefinition.tableSize.minimumSeated
    || raw.tableSize > gameRulesDefinition.tableSize.maximumSeated) {
    throw new RangeError('Reference pack tableSize must fit its GameRulesDefinition');
  }
  const orderedPositions = stringArray(
    raw.orderedPositions,
    'Reference pack orderedPositions',
    { nonempty: true },
  );
  if (JSON.stringify(orderedPositions) !== JSON.stringify(POSITIONS_BY_TABLE_SIZE[raw.tableSize])) {
    throw new RangeError('Reference pack orderedPositions must match canonical table positions');
  }
  if (!ROLE_VALUES.includes(raw.decisionRole) || raw.decisionRole === PREFLOP_DECISION_ROLES.UNKNOWN) {
    throw new RangeError(`Unsupported exact preflop decision role: ${raw.decisionRole}`);
  }
  const availableActionFamilies = stringArray(
    raw.availableActionFamilies,
    'Reference pack availableActionFamilies',
    { nonempty: true },
  );
  if (new Set(availableActionFamilies).size !== availableActionFamilies.length
    || availableActionFamilies.some((type) => !PREFLOP_ACTIONS.has(type))) {
    throw new RangeError('Reference pack availableActionFamilies must be unique canonical preflop actions');
  }
  const canonicalOrder = [...availableActionFamilies].sort(
    (left, right) => ACTION_ORDER.indexOf(left) - ACTION_ORDER.indexOf(right),
  );
  if (JSON.stringify(canonicalOrder) !== JSON.stringify(availableActionFamilies)) {
    throw new RangeError('Reference pack availableActionFamilies must use canonical action order');
  }
  if (!Array.isArray(raw.supportedAggressiveSizes)) {
    throw new TypeError('Reference pack supportedAggressiveSizes must be an array');
  }
  const supportedAggressiveSizes = raw.supportedAggressiveSizes.map((entry, index) => {
    requireExactKeys(
      entry,
      ['type', 'amountToBb'],
      `Reference pack supportedAggressiveSizes[${index}]`,
    );
    if (!AGGRESSIVE_ACTIONS.has(entry.type)) {
      throw new RangeError(`Unsupported aggressive size action: ${entry.type}`);
    }
    return {
      type: entry.type,
      amountToBb: finiteNumber(
        entry.amountToBb,
        `supportedAggressiveSizes[${index}].amountToBb`,
        { minimum: 0 },
      ),
    };
  });
  const aggressiveSizeKeys = supportedAggressiveSizes.map(
    (entry) => `${entry.type}:${entry.amountToBb}`,
  );
  if (new Set(aggressiveSizeKeys).size !== aggressiveSizeKeys.length) {
    throw new RangeError('Reference pack supportedAggressiveSizes must be unique');
  }
  const heroPosition = requiredString(raw.heroPosition, 'Reference pack heroPosition');
  const aggressorPosition = requiredString(
    raw.aggressorPosition,
    'Reference pack aggressorPosition',
  );
  if (!orderedPositions.includes(heroPosition) || !orderedPositions.includes(aggressorPosition)
    || heroPosition === aggressorPosition) {
    throw new RangeError('Reference pack Hero/aggressor positions must be distinct table positions');
  }
  const startingStackBb = finiteNumber(
    raw.startingStackBb,
    'Reference pack startingStackBb',
    { minimum: 0 },
  );
  const effectiveStackBb = finiteNumber(
    raw.effectiveStackBb,
    'Reference pack effectiveStackBb',
    { minimum: 0 },
  );
  if (effectiveStackBb > startingStackBb) {
    throw new RangeError('Reference pack effective stack cannot exceed its starting stack');
  }
  if (raw.effectiveStackSemantics !== 'chips_behind_at_decision') {
    throw new RangeError('Unsupported effectiveStackSemantics');
  }
  if (raw.opponentBoundary !== 'heads_up_at_decision') {
    throw new RangeError('reference-pack/v1 requires heads_up_at_decision');
  }
  const opponentCount = nonnegativeInteger(raw.opponentCount, 'Reference pack opponentCount');
  if (opponentCount !== 1) {
    throw new RangeError('heads_up_at_decision reference packs require opponentCount 1');
  }
  const priorActionTree = normalizePriorActionTree(raw.priorActionTree);
  if (priorActionTree.initialAggressorPosition !== aggressorPosition) {
    throw new RangeError('Reference pack prior action aggressor must match aggressorPosition');
  }
  const legalActionBounds = normalizeLegalBounds(raw.legalActionBounds);
  if (!legalActionBounds.canRaise
    && (legalActionBounds.minRaiseToBb !== null
      || legalActionBounds.maxRaiseToBb !== null
      || supportedAggressiveSizes.length > 0)) {
    throw new RangeError('Non-raise reference packs cannot declare raise bounds or sizes');
  }
  if (legalActionBounds.canRaise
    && (!Number.isFinite(legalActionBounds.maxRaiseToBb)
      || !Number.isFinite(legalActionBounds.allInToBb))) {
    throw new RangeError('Raise-capable reference packs require max/all-in bounds');
  }
  if (legalActionBounds.canRaise
    && legalActionBounds.maxRaiseToBb !== legalActionBounds.allInToBb) {
    throw new RangeError('Reference pack maxRaiseToBb must equal its canonical all-in total');
  }
  if (legalActionBounds.minRaiseToBb !== null
    && legalActionBounds.maxRaiseToBb !== null
    && legalActionBounds.minRaiseToBb > legalActionBounds.maxRaiseToBb) {
    throw new RangeError('Reference pack minimum raise-to cannot exceed maximum raise-to');
  }
  const expectedActionFamilies = priorActionTree.callAmountBb > 0
    ? [ACTION_TYPES.FOLD, ACTION_TYPES.CALL]
    : [ACTION_TYPES.CHECK];
  if (legalActionBounds.canRaise) {
    expectedActionFamilies.push(ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN);
  }
  if (!equalJson(expectedActionFamilies, availableActionFamilies)) {
    throw new RangeError('Reference pack action support must match its call price and legal bounds');
  }
  for (const entry of supportedAggressiveSizes) {
    if (!availableActionFamilies.includes(entry.type)) {
      throw new RangeError(`Supported ${entry.type} size lacks a declared action family`);
    }
    if (entry.type === ACTION_TYPES.RAISE
      && (legalActionBounds.minRaiseToBb === null
        || entry.amountToBb < legalActionBounds.minRaiseToBb
        || entry.amountToBb > legalActionBounds.maxRaiseToBb)) {
      throw new RangeError(`Supported raise size ${entry.amountToBb} is outside legal bounds`);
    }
    if (entry.type === ACTION_TYPES.ALL_IN
      && entry.amountToBb !== legalActionBounds.allInToBb) {
      throw new RangeError('Supported all-in size must equal legalActionBounds.allInToBb');
    }
  }
  return {
    gameRulesDefinition,
    gameRulesSemanticFingerprint: expectedFingerprint,
    tableSize: raw.tableSize,
    orderedPositions,
    heroPosition,
    aggressorPosition,
    decisionRole: raw.decisionRole,
    startingStackBb,
    effectiveStackBb,
    effectiveStackSemantics: raw.effectiveStackSemantics,
    priorActionTree,
    availableActionFamilies,
    supportedAggressiveSizes,
    legalActionBounds,
    opponentBoundary: raw.opponentBoundary,
    opponentCount,
  };
}

function normalizeRows(raw, gameAssumptions, capabilities) {
  requireExactKeys(raw, REPRESENTATION_KEYS, 'Reference pack representation');
  if (raw.kind !== REFERENCE_PACK_REPRESENTATION) {
    throw new RangeError(`Reference pack representation must be ${REFERENCE_PACK_REPRESENTATION}`);
  }
  if (!Array.isArray(raw.rows)) throw new TypeError('Reference pack rows must be an array');
  const rows = raw.rows.map((row, rowIndex) => {
    requireExactKeys(row, ROW_KEYS, `Reference pack rows[${rowIndex}]`);
    if (!isPreflopHandClass(row.handClass)) {
      throw new RangeError(`Impossible preflop hand class: ${row.handClass}`);
    }
    if (!Array.isArray(row.actions)) {
      throw new TypeError(`Reference pack row ${row.handClass} actions must be an array`);
    }
    const actions = row.actions.map((action, actionIndex) => {
      requireExactKeys(
        action,
        ACTION_KEYS,
        `Reference pack row ${row.handClass} action ${actionIndex}`,
      );
      if (!gameAssumptions.availableActionFamilies.includes(action.type)) {
        throw new RangeError(`Row ${row.handClass} contains unsupported action ${action.type}`);
      }
      const amountToBb = nullableFiniteNumber(
        action.amountToBb,
        `Row ${row.handClass} ${action.type} amountToBb`,
        { minimum: 0 },
      );
      if (!AGGRESSIVE_ACTIONS.has(action.type) && amountToBb !== null) {
        throw new RangeError(`Row ${row.handClass} ${action.type} cannot carry an aggressive size`);
      }
      if (AGGRESSIVE_ACTIONS.has(action.type) && amountToBb !== null
        && !gameAssumptions.supportedAggressiveSizes.some((entry) => (
          entry.type === action.type && entry.amountToBb === amountToBb
        ))) {
        throw new RangeError(`Row ${row.handClass} uses undeclared ${action.type} size ${amountToBb}`);
      }
      const probability = finiteNumber(
        action.probability,
        `Row ${row.handClass} ${action.type} probability`,
        { minimum: 0 },
      );
      const evBb = capabilities.actionEv
        ? finiteNumber(action.evBb, `Row ${row.handClass} ${action.type} evBb`)
        : action.evBb;
      if (!capabilities.actionEv && evBb !== null) {
        throw new RangeError(`Row ${row.handClass} supplies EV while actionEv is false`);
      }
      return { type: action.type, amountToBb, probability, evBb };
    });
    const actionTypes = actions.map((action) => action.type);
    if (new Set(actionTypes).size !== actionTypes.length
      || JSON.stringify(actionTypes) !== JSON.stringify(gameAssumptions.availableActionFamilies)) {
      throw new RangeError(
        `Row ${row.handClass} must contain each declared action exactly once in canonical order`,
      );
    }
    const mass = actions.reduce((sum, action) => sum + action.probability, 0);
    if (Math.abs(mass - 1) > STRATEGY_EXACT_DISTRIBUTION_TOLERANCE) {
      throw new RangeError(`Row ${row.handClass} probability mass must equal 1; received ${mass}`);
    }
    if (!actions.some((action) => action.probability > 0)) {
      throw new RangeError(`Row ${row.handClass} requires positive probability mass`);
    }
    return { handClass: row.handClass, actions };
  });
  const handClasses = rows.map((row) => row.handClass);
  if (new Set(handClasses).size !== rows.length) {
    throw new RangeError('Reference pack contains duplicate hand rows');
  }
  if (rows.length !== PREFLOP_HAND_CLASSES.length
    || PREFLOP_HAND_CLASSES.some((handClass) => !handClasses.includes(handClass))) {
    throw new RangeError('preflop_169_class reference packs must contain all 169 canonical classes');
  }
  const suppliesAnySizing = gameAssumptions.supportedAggressiveSizes.length > 0
    && rows.some((row) => row.actions.some((action) => action.amountToBb !== null));
  if (capabilities.actionSizing === STRATEGY_ACTION_SIZING_CAPABILITIES.NONE
    && (gameAssumptions.supportedAggressiveSizes.length > 0
      || rows.some((row) => row.actions.some((action) => action.amountToBb !== null)))) {
    throw new RangeError('Reference pack declares no sizing but supplies aggressive sizes');
  }
  if (capabilities.actionSizing !== STRATEGY_ACTION_SIZING_CAPABILITIES.NONE
    && !suppliesAnySizing) {
    throw new RangeError('Reference pack declares sizing capability without supplied sizes');
  }
  if (capabilities.actionSizing === STRATEGY_ACTION_SIZING_CAPABILITIES.COMPLETE
    && rows.some((row) => row.actions.some((action) => (
      AGGRESSIVE_ACTIONS.has(action.type) && action.amountToBb === null
    )))) {
    throw new RangeError('Reference pack declares complete sizing but has unsized aggressive actions');
  }
  return { kind: REFERENCE_PACK_REPRESENTATION, rows };
}

function validateAuthority(validation, descriptor, capabilities) {
  if (validation.authorityDecision !== descriptor.authority) {
    throw new RangeError('Reference pack validation authorityDecision must match sourceDescriptor');
  }
  if (validation.status === REFERENCE_PACK_VALIDATION_STATUSES.SYNTHETIC_TEST_ONLY
    && descriptor.authority === STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE) {
    throw new RangeError('Synthetic test packs cannot claim validated_reference authority');
  }
  if (validation.status === REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_COMPARATIVE
    && descriptor.authority !== STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE) {
    throw new RangeError('accepted_comparative packs require comparative_reference authority');
  }
  if (validation.status === REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_VALIDATED
    && descriptor.authority !== STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE) {
    throw new RangeError('accepted_validated packs require validated_reference authority');
  }
  if (capabilities.grading === STRATEGY_GRADING_CAPABILITIES.NORMATIVE
    && (validation.status !== REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_VALIDATED
      || descriptor.authority !== STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE)) {
    throw new RangeError('Normative grading requires an accepted validated reference review');
  }
}

export function validateReferencePack(pack) {
  if (VALIDATED_REFERENCE_PACKS.has(pack)) return pack;
  requireExactKeys(pack, ROOT_KEYS, 'Reference pack');
  if (pack.schemaVersion !== REFERENCE_PACK_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${REFERENCE_PACK_SCHEMA_VERSION}`);
  }
  requireExactKeys(pack.manifest, MANIFEST_KEYS, 'Reference pack manifest');
  requireExactKeys(pack.manifest.identity, IDENTITY_KEYS, 'Reference pack identity');
  const identity = {
    packId: stableId(pack.manifest.identity.packId, 'Reference pack packId'),
    packVersion: requiredString(pack.manifest.identity.packVersion, 'Reference pack packVersion'),
  };
  const capabilities = normalizeCapabilities(pack.manifest.capabilities);
  const limitations = stringArray(pack.manifest.limitations, 'Reference pack limitations');
  const descriptor = normalizeSourceDescriptor(
    pack.manifest.sourceDescriptor,
    capabilities,
    limitations,
  );
  const source = normalizeSource(pack.manifest.source);
  const validation = normalizeValidation(pack.manifest.validation);
  validateAuthority(validation, descriptor, capabilities);
  const gameAssumptions = normalizeGameAssumptions(pack.manifest.gameAssumptions);
  const representation = normalizeRows(pack.representation, gameAssumptions, capabilities);
  requireExactKeys(pack.integrity, INTEGRITY_KEYS, 'Reference pack integrity');
  if (pack.integrity.algorithm !== REFERENCE_PACK_INTEGRITY_ALGORITHM) {
    throw new RangeError(`Reference pack integrity algorithm must be ${REFERENCE_PACK_INTEGRITY_ALGORITHM}`);
  }
  const expectedHash = computeReferencePackContentHash(pack);
  if (pack.integrity.contentHash !== expectedHash) {
    throw new RangeError('Reference pack contentHash does not match its deterministic content');
  }
  const validated = deepFreeze({
    schemaVersion: REFERENCE_PACK_SCHEMA_VERSION,
    manifest: {
      identity,
      sourceDescriptor: descriptor,
      gameAssumptions,
      source,
      capabilities,
      validation,
      limitations,
    },
    representation,
    integrity: {
      algorithm: REFERENCE_PACK_INTEGRITY_ALGORITHM,
      contentHash: expectedHash,
    },
  });
  VALIDATED_REFERENCE_PACKS.add(validated);
  return validated;
}

export function isReferencePackProductionEligible(pack) {
  const validated = validateReferencePack(pack);
  const status = validated.manifest.validation.status;
  return [
    REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_COMPARATIVE,
    REFERENCE_PACK_VALIDATION_STATUSES.ACCEPTED_VALIDATED,
  ].includes(status)
    && validated.manifest.source.redistribution.status
      === REFERENCE_PACK_REDISTRIBUTION_STATUSES.PERMITTED
    && validated.manifest.source.redistribution.repositoryInclusionPermitted === true;
}

function equalNumber(left, right) {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= REFERENCE_PACK_PROBABILITY_TOLERANCE;
}

function equalNullableNumber(left, right) {
  return left === null && right === null ? true : equalNumber(left, right);
}

function equalJson(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function contextLegalActionFamilies(context) {
  const families = [];
  if (Number(context?.callAmountBb) > 0) families.push(ACTION_TYPES.FOLD, ACTION_TYPES.CALL);
  else if (context?.callAmountBb === 0) families.push(ACTION_TYPES.CHECK);
  if (context?.canRaise === true) families.push(ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN);
  return ACTION_ORDER.filter((type) => families.includes(type));
}

function matchValidatedReferencePack(pack, decisionContext) {
  const assumptions = pack.manifest.gameAssumptions;
  const prior = assumptions.priorActionTree;
  const summary = decisionContext?.priorActionSummary;
  const gameRules = decisionContext?.gameRules;
  const contextDefinition = gameRules?.definition;
  const limitations = [];
  const mismatch = (condition, code) => { if (condition) limitations.push(code); };

  mismatch(decisionContext?.schemaVersion !== 'decision-context/v1'
    || decisionContext?.contractVersion !== 'decision-context/v1.1',
  'reference_pack_decision_context_version_mismatch');
  mismatch(decisionContext?.derivation?.source !== 'canonical_hand',
    'reference_pack_canonical_history_required');
  mismatch(!Array.isArray(decisionContext?.board) || decisionContext.board.length !== 0,
    'reference_pack_board_mismatch');
  mismatch(!Array.isArray(decisionContext?.deadCards) || decisionContext.deadCards.length !== 0,
    'reference_pack_dead_cards_mismatch');
  mismatch(!gameRules || !contextDefinition, 'reference_pack_game_rules_unavailable');
  if (contextDefinition) {
    mismatch(contextDefinition.variant !== assumptions.gameRulesDefinition.variant,
      'reference_pack_game_mismatch');
    mismatch(contextDefinition.format !== assumptions.gameRulesDefinition.format,
      'reference_pack_format_mismatch');
    mismatch(!equalJson(contextDefinition.blinds, assumptions.gameRulesDefinition.blinds),
      'reference_pack_blinds_mismatch');
    mismatch(!equalJson(contextDefinition.ante, assumptions.gameRulesDefinition.ante),
      'reference_pack_ante_mismatch');
    mismatch(!equalJson(contextDefinition.straddle, assumptions.gameRulesDefinition.straddle),
      'reference_pack_straddle_mismatch');
    mismatch(!equalJson(
      contextDefinition.collectionPolicy,
      assumptions.gameRulesDefinition.collectionPolicy,
    ), 'reference_pack_rake_mismatch');
    mismatch(gameRules.semanticFingerprint !== assumptions.gameRulesSemanticFingerprint,
      'reference_pack_game_rules_identity_mismatch');
  }
  mismatch(decisionContext?.tableSize !== assumptions.tableSize
    || gameRules?.seatedPlayers !== assumptions.tableSize,
  'reference_pack_table_size_mismatch');
  mismatch(!equalJson(gameRules?.orderedPositions ?? [], assumptions.orderedPositions),
    'reference_pack_ordered_positions_mismatch');
  mismatch(decisionContext?.heroPosition !== assumptions.heroPosition,
    'reference_pack_hero_position_mismatch');
  mismatch(summary?.initialAggressorPosition !== assumptions.aggressorPosition
    || summary?.aggressorPosition !== assumptions.aggressorPosition,
  'reference_pack_aggressor_position_mismatch');
  mismatch(preflopDecisionRoleFor(decisionContext) !== assumptions.decisionRole,
    'reference_pack_decision_role_mismatch');
  mismatch(!equalNumber(decisionContext?.startingStackBb, assumptions.startingStackBb)
    || !equalNumber(decisionContext?.effectiveStackBb, assumptions.effectiveStackBb),
  'reference_pack_stack_mismatch');
  mismatch(decisionContext?.opponentCount !== assumptions.opponentCount,
    'reference_pack_opponent_count_mismatch');
  mismatch(decisionContext?.street !== prior.street
    || summary?.lastActionFamily !== prior.lastActionFamily
    || summary?.lastActorPosition !== prior.lastActorPosition
    || summary?.facingActionFamily !== prior.facingActionFamily
    || summary?.aggressionFamily !== prior.aggressionFamily
    || summary?.aggressionCount !== prior.aggressionCount
    || summary?.limperCount !== prior.limperCount
    || summary?.heroPreviousVoluntaryActionFamily !== prior.heroPreviousVoluntaryActionFamily
    || summary?.initialAggressorPosition !== prior.initialAggressorPosition
    || summary?.distinctAggressorCount !== prior.distinctAggressorCount,
  'reference_pack_prior_action_mismatch');
  mismatch(summary?.latestAggressionWasCold !== prior.latestAggressionWasCold
    || summary?.heroActionWouldBeCold !== prior.heroActionWouldBeCold,
  'reference_pack_cold_action_mismatch');
  mismatch(!equalNumber(decisionContext?.facingSizeBb, prior.openToBb),
    'reference_pack_open_size_mismatch');
  mismatch(!equalNumber(decisionContext?.callAmountBb, prior.callAmountBb)
    || !equalNumber(
      decisionContext?.heroStreetContributionBb,
      prior.heroStreetContributionBb,
    )
    || !equalNumber(decisionContext?.currentPotBb, prior.currentPotBb),
  'reference_pack_decision_economics_mismatch');
  mismatch(!equalNumber(
    decisionContext?.actorContestablePotAfterCallBb,
    prior.actorContestablePotAfterCallBb,
  ) || !equalNumber(
    decisionContext?.actorIneligiblePotAfterCallBb,
    prior.actorIneligiblePotAfterCallBb,
  ) || !equalNullableNumber(
    decisionContext?.requiredRawEquity,
    prior.requiredRawEquity,
  ),
  'reference_pack_actor_call_economics_mismatch');
  mismatch(decisionContext?.canRaise !== assumptions.legalActionBounds.canRaise
    || (assumptions.legalActionBounds.minRaiseToBb !== null
      && !equalNumber(
        decisionContext?.minRaiseToBb,
        assumptions.legalActionBounds.minRaiseToBb,
      ))
    || (assumptions.legalActionBounds.maxRaiseToBb !== null
      && !equalNumber(
        decisionContext?.maxRaiseToBb,
        assumptions.legalActionBounds.maxRaiseToBb,
      ))
    || (assumptions.legalActionBounds.allInToBb !== null
      && !equalNumber(decisionContext?.allInToBb, assumptions.legalActionBounds.allInToBb)),
  'reference_pack_legal_bounds_mismatch');
  mismatch(!equalJson(
    contextLegalActionFamilies(decisionContext),
    assumptions.availableActionFamilies,
  ), 'reference_pack_legal_action_support_mismatch');

  let handClass = null;
  try {
    handClass = preflopHandClassForCards(decisionContext?.heroCards);
  } catch {
    limitations.push('reference_pack_hand_unavailable');
  }
  const uniqueLimitations = [...new Set(limitations)];
  return deepFreeze({
    schemaVersion: REFERENCE_PACK_MATCHER_VERSION,
    matched: uniqueLimitations.length === 0,
    handClass,
    coverage: createStrategyContextCoverage({
      kind: uniqueLimitations.length === 0
        ? STRATEGY_COVERAGE_KINDS.EXACT
        : STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
      basis: uniqueLimitations.length === 0
        ? REFERENCE_PACK_MATCHER_VERSION
        : `${REFERENCE_PACK_MATCHER_VERSION}:strict_mismatch`,
      limitationCodes: uniqueLimitations,
    }),
  });
}

export function matchReferencePackContext(pack, decisionContext) {
  return matchValidatedReferencePack(validateReferencePack(pack), decisionContext);
}

function actionLabel(action) {
  if (action.type === ACTION_TYPES.ALL_IN) return 'All-in';
  if (action.type === ACTION_TYPES.RAISE && Number.isFinite(action.amountToBb)) {
    return `Raise to ${action.amountToBb}bb`;
  }
  return action.type.charAt(0).toUpperCase() + action.type.slice(1);
}

export function createReferencePackAdapter(pack, { allowTestPack = false } = {}) {
  const validated = validateReferencePack(pack);
  const productionEligible = isReferencePackProductionEligible(validated);
  if (!productionEligible && !(allowTestPack
    && validated.manifest.validation.status
      === REFERENCE_PACK_VALIDATION_STATUSES.SYNTHETIC_TEST_ONLY)) {
    throw new RangeError('Reference pack is not eligible for production registration');
  }
  const rowsByHandClass = new Map(
    validated.representation.rows.map((row) => [row.handClass, row]),
  );
  const { identity, sourceDescriptor, gameAssumptions, source, validation } = validated.manifest;
  return Object.freeze({
    schemaVersion: REFERENCE_PACK_ADAPTER_VERSION,
    packId: identity.packId,
    packVersion: identity.packVersion,
    contentHash: validated.integrity.contentHash,
    sourceId: sourceDescriptor.id,
    sourceVersion: sourceDescriptor.version,
    productionEligible,
    lookupKind: 'canonical_preflop_hand_class_map',

    match(decisionContext) {
      return matchValidatedReferencePack(validated, decisionContext);
    },

    resolve(decisionContext) {
      const match = matchValidatedReferencePack(validated, decisionContext);
      if (!match.matched) return { match, candidate: null };
      const row = rowsByHandClass.get(match.handClass);
      if (!row) {
        throw new RangeError(`Validated reference pack is missing ${match.handClass}`);
      }
      return {
        match,
        candidate: {
          source: sourceDescriptor.id,
          sourceDescriptor,
          sourceVersion: sourceDescriptor.version,
          provenance: {
            schemaVersion: REFERENCE_PACK_SCHEMA_VERSION,
            packId: identity.packId,
            packVersion: identity.packVersion,
            contentHash: validated.integrity.contentHash,
            source: cloneData(source),
            gameAssumptions: cloneData(gameAssumptions),
            validation: cloneData(validation),
          },
          contextCoverage: match.coverage,
          actions: row.actions.map((action) => ({
            action: {
              type: action.type,
              amountBb: action.amountToBb,
              potFraction: null,
            },
            label: actionLabel(action),
            probability: action.probability,
            evBb: action.evBb,
          })),
          explanation: 'Exact bounded reference-pack result for the declared node.',
          warnings: [...validation.knownLimitations],
          details: {
            referencePack: {
              schemaVersion: REFERENCE_PACK_SCHEMA_VERSION,
              matcherVersion: REFERENCE_PACK_MATCHER_VERSION,
              packId: identity.packId,
              packVersion: identity.packVersion,
              contentHash: validated.integrity.contentHash,
              validationStatus: validation.status,
              decisionRole: gameAssumptions.decisionRole,
              handClass: match.handClass,
            },
          },
        },
      };
    },
  });
}
