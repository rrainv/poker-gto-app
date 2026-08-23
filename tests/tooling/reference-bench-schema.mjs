import {
  assertCardArray,
  assertUniqueKnownCards,
} from '../../shared/poker-domain/cards.js';
import {
  isPreflopHandClass,
  preflopHandClassForCards,
} from '../../shared/poker-domain/hand-class.js';
import { validateEquityRequest } from '../../shared/poker-domain/equity.js';

export const REFERENCE_BENCHMARK_INPUT_SCHEMA_VERSION =
  'riverline-reference-benchmark-input/v1';

export const REFERENCE_SOURCE_TYPES = Object.freeze([
  'manually_observed',
  'public_reference',
  'riverline_owned',
  'licensed',
  'independent_solver',
]);

export const REDISTRIBUTION_STATUSES = Object.freeze([
  'private_not_for_redistribution',
  'public_redistributable',
  'licensed_restricted',
  'riverline_owned',
]);

export const STORAGE_POLICIES = Object.freeze([
  'external_local_file',
  'repository_allowed',
]);

export const CONTEXT_MATCH_KINDS = Object.freeze([
  'exact',
  'mapped',
  'approximate',
  'unknown',
]);

export const HAND_OBSERVATION_KINDS = Object.freeze([
  'preflop_169_class',
  'exact_combo',
  'postflop_exact_combo',
]);

export const CANONICAL_ACTION_TYPES = Object.freeze([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'all_in',
]);

export const SIZE_BASES = Object.freeze([
  'amount_to_bb',
  'pot_fraction',
  'stack_fraction',
]);

export const EQUITY_POPULATIONS = Object.freeze([
  'exact_combo',
  'range',
  'uniform_unknown_combos',
]);

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requiredString(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

function nullableString(value, label) {
  if (value === null || value === undefined) return null;
  return requiredString(value, label);
}

function stableId(value, label) {
  const normalized = requiredString(value, label);
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(normalized)) {
    throw new TypeError(`${label} must be a stable lowercase ID`);
  }
  return normalized;
}

function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new RangeError(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function finiteNumber(value, label, { minimum = -Infinity, maximum = Infinity } = {}) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be a finite number from ${minimum} through ${maximum}`);
  }
  return value;
}

function nullableNumber(value, label, options = {}) {
  if (value === null || value === undefined) return null;
  return finiteNumber(value, label, options);
}

function integer(value, label, { minimum = -Infinity, maximum = Infinity } = {}) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function nullableSize(value, label) {
  if (value === null || value === undefined) return null;
  const size = plainObject(value, label);
  enumValue(size.basis, SIZE_BASES, `${label}.basis`);
  finiteNumber(size.value, `${label}.value`, { minimum: 0 });
  return value;
}

function validateSource(source) {
  plainObject(source, 'source');
  stableId(source.id, 'source.id');
  requiredString(source.productName, 'source.productName');
  enumValue(source.sourceType, REFERENCE_SOURCE_TYPES, 'source.sourceType');
  const date = requiredString(source.observationDate, 'source.observationDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new TypeError('source.observationDate must use YYYY-MM-DD');
  }
  nullableString(source.sourceLabel, 'source.sourceLabel');
  requiredString(source.provenanceNote, 'source.provenanceNote');
  enumValue(
    source.redistributionStatus,
    REDISTRIBUTION_STATUSES,
    'source.redistributionStatus',
  );
  enumValue(source.storagePolicy, STORAGE_POLICIES, 'source.storagePolicy');
  if (source.storagePolicy === 'repository_allowed'
    && !['public_redistributable', 'riverline_owned'].includes(source.redistributionStatus)) {
    throw new RangeError(
      'repository_allowed storage requires public_redistributable or riverline_owned data',
    );
  }
}

function validateActionTree(entries, label) {
  if (!Array.isArray(entries)) throw new TypeError(`${label} must be an array`);
  entries.forEach((entry, index) => {
    const itemLabel = `${label}[${index}]`;
    plainObject(entry, itemLabel);
    requiredString(entry.actorPosition, `${itemLabel}.actorPosition`);
    requiredString(entry.rawLabel, `${itemLabel}.rawLabel`);
    enumValue(entry.canonicalType, CANONICAL_ACTION_TYPES, `${itemLabel}.canonicalType`);
    nullableSize(entry.size, `${itemLabel}.size`);
  });
}

function validateAvailableSizes(entries, label) {
  if (!Array.isArray(entries)) throw new TypeError(`${label} must be an array`);
  entries.forEach((entry, index) => {
    const itemLabel = `${label}[${index}]`;
    plainObject(entry, itemLabel);
    enumValue(entry.canonicalType, CANONICAL_ACTION_TYPES, `${itemLabel}.canonicalType`);
    nullableSize(entry.size, `${itemLabel}.size`);
    nullableString(entry.rawLabel, `${itemLabel}.rawLabel`);
  });
}

function validateGameAssumptions(assumptions, label) {
  plainObject(assumptions, label);
  requiredString(assumptions.gameType, `${label}.gameType`);
  integer(assumptions.tableSize, `${label}.tableSize`, { minimum: 2, maximum: 10 });
  if (!Array.isArray(assumptions.positions) || assumptions.positions.length !== assumptions.tableSize) {
    throw new RangeError(`${label}.positions must contain one position per seat`);
  }
  assumptions.positions.forEach((position, index) => (
    requiredString(position, `${label}.positions[${index}]`)
  ));
  finiteNumber(assumptions.stackDepthBb, `${label}.stackDepthBb`, { minimum: 0 });

  const blinds = plainObject(assumptions.blinds, `${label}.blinds`);
  finiteNumber(blinds.smallBlindBb, `${label}.blinds.smallBlindBb`, { minimum: 0 });
  finiteNumber(blinds.bigBlindBb, `${label}.blinds.bigBlindBb`, { minimum: 0 });

  const ante = plainObject(assumptions.ante, `${label}.ante`);
  enumValue(ante.kind, ['none', 'per_player', 'big_blind', 'unknown'], `${label}.ante.kind`);
  nullableNumber(ante.amountBb, `${label}.ante.amountBb`, { minimum: 0 });

  const rake = plainObject(assumptions.rake, `${label}.rake`);
  enumValue(rake.kind, ['none', 'known', 'unknown'], `${label}.rake.kind`);
  nullableString(rake.description, `${label}.rake.description`);
  nullableNumber(rake.percentage, `${label}.rake.percentage`, { minimum: 0, maximum: 1 });
  nullableNumber(rake.capBb, `${label}.rake.capBb`, { minimum: 0 });

  enumValue(assumptions.format, ['cash', 'tournament', 'unknown'], `${label}.format`);
  validateActionTree(assumptions.actionTree, `${label}.actionTree`);
  validateAvailableSizes(assumptions.availableActionSizes, `${label}.availableActionSizes`);
  enumValue(assumptions.street, ['preflop', 'flop', 'turn', 'river'], `${label}.street`);
  assertCardArray(assumptions.board, `${label}.board`);
  const expectedBoardCount = { preflop: 0, flop: 3, turn: 4, river: 5 }[assumptions.street];
  if (assumptions.board.length !== expectedBoardCount) {
    throw new RangeError(`${label}.board does not match ${assumptions.street}`);
  }
  nullableNumber(assumptions.currentPotBb, `${label}.currentPotBb`, { minimum: 0 });
  nullableNumber(assumptions.callAmountBb, `${label}.callAmountBb`, { minimum: 0 });
  nullableNumber(assumptions.effectiveStackBb, `${label}.effectiveStackBb`, { minimum: 0 });
  validateAvailableSizes(assumptions.legalActions, `${label}.legalActions`);
}

function validateContextMatch(contextMatch, label) {
  plainObject(contextMatch, label);
  enumValue(contextMatch.kind, CONTEXT_MATCH_KINDS, `${label}.kind`);
  if (!Array.isArray(contextMatch.mappings)) {
    throw new TypeError(`${label}.mappings must be an array`);
  }
  contextMatch.mappings.forEach((mapping, index) => {
    const mappingLabel = `${label}.mappings[${index}]`;
    plainObject(mapping, mappingLabel);
    requiredString(mapping.field, `${mappingLabel}.field`);
    if (!Object.hasOwn(mapping, 'riverlineValue') || !Object.hasOwn(mapping, 'referenceValue')) {
      throw new TypeError(`${mappingLabel} must preserve riverlineValue and referenceValue`);
    }
    requiredString(mapping.note, `${mappingLabel}.note`);
  });
  nullableString(contextMatch.note, `${label}.note`);
  if (contextMatch.kind === 'exact' && contextMatch.mappings.length > 0) {
    throw new RangeError(`${label}.exact cannot contain mappings`);
  }
  if (contextMatch.kind === 'mapped' && contextMatch.mappings.length === 0) {
    throw new RangeError(`${label}.mapped requires at least one explicit mapping`);
  }
}

function validateDecisionContext(context, label) {
  plainObject(context, label);
  if (context.schemaVersion !== 'decision-context/v1') {
    throw new TypeError(`${label} must be DecisionContext v1`);
  }
  if (context.contractVersion !== 'decision-context/v1.1') {
    throw new TypeError(`${label} must use DecisionContext v1.1 facts`);
  }
  assertCardArray(context.heroCards, `${label}.heroCards`);
  assertCardArray(context.board, `${label}.board`);
  assertCardArray(context.deadCards, `${label}.deadCards`);
}

function validateRiverlineAlignment(riverline, label) {
  const context = riverline.decisionContext;
  const assumptions = riverline.gameAssumptions;
  const checks = [
    ['tableSize', context.tableSize, assumptions.tableSize],
    ['street', context.street, assumptions.street],
    ['board', context.board, assumptions.board],
    ['stackDepthBb', context.startingStackBb ?? context.stackBb, assumptions.stackDepthBb],
    ['currentPotBb', context.currentPotBb, assumptions.currentPotBb],
    ['callAmountBb', context.callAmountBb, assumptions.callAmountBb],
    ['effectiveStackBb', context.effectiveStackBb, assumptions.effectiveStackBb],
  ];
  for (const [field, contextValue, assumptionValue] of checks) {
    if (JSON.stringify(contextValue) !== JSON.stringify(assumptionValue)) {
      throw new RangeError(
        `${label}.gameAssumptions.${field} must match its DecisionContext fact`,
      );
    }
  }
  if (!assumptions.positions.includes(context.heroPosition)) {
    throw new RangeError(`${label}.gameAssumptions.positions must include heroPosition`);
  }
}

function validateRawActions(reference, label) {
  plainObject(reference, label);
  enumValue(reference.frequencyUnit, ['probability', 'percent'], `${label}.frequencyUnit`);
  if (!Array.isArray(reference.rawActions) || reference.rawActions.length === 0) {
    throw new RangeError(`${label}.rawActions must contain at least one action`);
  }
  let total = 0;
  const maximum = reference.frequencyUnit === 'percent' ? 100 : 1;
  reference.rawActions.forEach((action, index) => {
    const actionLabel = `${label}.rawActions[${index}]`;
    plainObject(action, actionLabel);
    requiredString(action.label, `${actionLabel}.label`);
    enumValue(action.canonicalType, CANONICAL_ACTION_TYPES, `${actionLabel}.canonicalType`);
    total += finiteNumber(action.frequency, `${actionLabel}.frequency`, {
      minimum: 0,
      maximum,
    });
    nullableSize(action.size, `${actionLabel}.size`);
    nullableNumber(action.evBb, `${actionLabel}.evBb`);
  });
  if (!(total > 0)) throw new RangeError(`${label}.rawActions require positive frequency mass`);
  nullableNumber(reference.eqr, `${label}.eqr`, { minimum: 0 });
}

function validateEquitySemantics(semantics, label) {
  plainObject(semantics, label);
  if (semantics.quantity !== 'equity_share') {
    throw new RangeError(`${label}.quantity must be equity_share`);
  }
  enumValue(semantics.heroPopulation, EQUITY_POPULATIONS, `${label}.heroPopulation`);
  enumValue(
    semantics.opponentPopulation,
    EQUITY_POPULATIONS,
    `${label}.opponentPopulation`,
  );
  nullableString(semantics.heroRangeId, `${label}.heroRangeId`);
  nullableString(semantics.opponentRangeId, `${label}.opponentRangeId`);
  enumValue(
    semantics.weighting,
    ['exact', 'uniform_combos', 'provided_weights', 'unknown'],
    `${label}.weighting`,
  );
  integer(semantics.opponentCount, `${label}.opponentCount`, { minimum: 1, maximum: 9 });
  enumValue(
    semantics.boardTreatment,
    ['fixed_board_random_runout', 'fixed_complete_board'],
    `${label}.boardTreatment`,
  );
  if (semantics.tieTreatment !== 'split_pot') {
    throw new RangeError(`${label}.tieTreatment must be split_pot`);
  }
}

function validateReferenceEquity(equity, label) {
  if (equity === null || equity === undefined) return;
  plainObject(equity, label);
  finiteNumber(equity.value, `${label}.value`, { minimum: 0, maximum: 1 });
  validateEquitySemantics(equity.semantics, `${label}.semantics`);
}

function validateRiverlineEquity(equity, label) {
  if (equity === null || equity === undefined) return;
  plainObject(equity, label);
  enumValue(
    equity.source,
    ['heuristic_conditional_sample', 'canonical_equity_service'],
    `${label}.source`,
  );
  validateEquitySemantics(equity.semantics, `${label}.semantics`);
  if (equity.source === 'canonical_equity_service') {
    plainObject(equity.request, `${label}.request`);
    const validation = validateEquityRequest(equity.request);
    if (!validation.ok) throw new TypeError(`${label}.request: ${validation.error.message}`);
    const heroPlayerId = requiredString(equity.heroPlayerId, `${label}.heroPlayerId`);
    const hero = validation.request.players.find((player) => player.id === heroPlayerId);
    if (!hero || hero.cards === null) {
      throw new TypeError(`${label}.heroPlayerId must identify a known exact combo`);
    }
    const unknownOpponents = validation.request.players.filter((player) => (
      player.id !== heroPlayerId && player.cards === null
    )).length;
    const knownOpponents = validation.request.players.length - unknownOpponents - 1;
    if (unknownOpponents > 0 && knownOpponents > 0) {
      throw new TypeError(`${label} cannot express mixed known/unknown opponent equity in v1`);
    }
    const expectedOpponentPopulation = unknownOpponents > 0
      ? 'uniform_unknown_combos'
      : 'exact_combo';
    const expectedWeighting = unknownOpponents > 0 ? 'uniform_combos' : 'exact';
    const expectedBoardTreatment = validation.request.board.length === 5
      ? 'fixed_complete_board'
      : 'fixed_board_random_runout';
    if (equity.semantics.heroPopulation !== 'exact_combo'
      || equity.semantics.opponentPopulation !== expectedOpponentPopulation
      || equity.semantics.weighting !== expectedWeighting
      || equity.semantics.heroRangeId !== null
      || equity.semantics.opponentRangeId !== null
      || equity.semantics.opponentCount !== validation.request.players.length - 1
      || equity.semantics.boardTreatment !== expectedBoardTreatment) {
      throw new RangeError(`${label}.semantics do not describe the canonical Equity request`);
    }
  } else if (equity.request !== undefined || equity.heroPlayerId !== undefined) {
    throw new TypeError(`${label} heuristic samples must not carry a canonical Equity request`);
  } else if (equity.semantics.heroPopulation !== 'exact_combo'
    || equity.semantics.opponentPopulation !== 'range'
    || equity.semantics.weighting !== 'uniform_combos'
    || equity.semantics.heroRangeId !== null
    || equity.semantics.opponentRangeId === null) {
    throw new RangeError(`${label}.semantics do not describe the heuristic conditional sample`);
  }
}

function validateHand(hand, node, label) {
  plainObject(hand, label);
  enumValue(hand.kind, HAND_OBSERVATION_KINDS, `${label}.kind`);
  assertCardArray(hand.combo, `${label}.combo`);
  if (hand.combo.length !== 2) throw new RangeError(`${label}.combo must contain two cards`);
  assertUniqueKnownCards([
    { label: `${label}.combo`, cards: hand.combo },
    { label: `${label}.board`, cards: node.referenceContext.board },
  ]);
  nullableNumber(hand.rangeWeight, `${label}.rangeWeight`, { minimum: 0 });

  if (hand.kind === 'preflop_169_class') {
    if (node.referenceContext.street !== 'preflop') {
      throw new RangeError(`${label}.preflop_169_class is only valid preflop`);
    }
    if (!isPreflopHandClass(hand.handClass)) {
      throw new TypeError(`${label}.handClass must be one of the canonical 169 classes`);
    }
    if (preflopHandClassForCards(hand.combo) !== hand.handClass) {
      throw new RangeError(`${label}.combo does not represent ${hand.handClass}`);
    }
  } else {
    if (hand.handClass !== null && hand.handClass !== undefined) {
      throw new TypeError(`${label}.exact-combo observations must not carry handClass`);
    }
    if (hand.kind === 'postflop_exact_combo' && node.referenceContext.street === 'preflop') {
      throw new RangeError(`${label}.postflop_exact_combo requires a postflop street`);
    }
  }
}

function validateObservation(observation, node, label) {
  plainObject(observation, label);
  stableId(observation.id, `${label}.id`);
  validateHand(observation.hand, node, `${label}.hand`);
  validateRawActions(observation.reference, `${label}.reference`);
  validateReferenceEquity(observation.reference.equity, `${label}.reference.equity`);
  validateRiverlineEquity(observation.riverlineEquity, `${label}.riverlineEquity`);
}

function validateNode(node, label) {
  plainObject(node, label);
  stableId(node.id, `${label}.id`);
  enumValue(node.referenceCoverage, ['supported', 'unsupported'], `${label}.referenceCoverage`);
  nullableString(node.coverageNote, `${label}.coverageNote`);
  validateGameAssumptions(node.referenceContext, `${label}.referenceContext`);
  const riverline = plainObject(node.riverline, `${label}.riverline`);
  validateDecisionContext(riverline.decisionContext, `${label}.riverline.decisionContext`);
  validateGameAssumptions(riverline.gameAssumptions, `${label}.riverline.gameAssumptions`);
  validateRiverlineAlignment(riverline, `${label}.riverline`);
  validateContextMatch(node.contextMatch, `${label}.contextMatch`);
  if (!Array.isArray(node.observations)) throw new TypeError(`${label}.observations must be an array`);
  if (node.referenceCoverage === 'supported' && node.observations.length === 0) {
    throw new RangeError(`${label}.supported nodes require at least one observation`);
  }
  const ids = new Set();
  node.observations.forEach((observation, index) => {
    validateObservation(observation, node, `${label}.observations[${index}]`);
    if (ids.has(observation.id)) throw new RangeError(`${label} has duplicate observation ID`);
    ids.add(observation.id);
  });
}

export function validateReferenceBenchmarkInput(input) {
  plainObject(input, 'ReferenceBenchmarkInput');
  if (input.schemaVersion !== REFERENCE_BENCHMARK_INPUT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${REFERENCE_BENCHMARK_INPUT_SCHEMA_VERSION}`);
  }
  stableId(input.packId, 'packId');
  requiredString(input.title, 'title');
  validateSource(input.source);
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new RangeError('nodes must contain at least one benchmark node');
  }
  const ids = new Set();
  input.nodes.forEach((node, index) => {
    validateNode(node, `nodes[${index}]`);
    if (ids.has(node.id)) throw new RangeError('Node IDs must be unique');
    ids.add(node.id);
  });
  return deepFreeze(clone(input));
}
