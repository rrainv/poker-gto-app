import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { assertMilliBbAlignment, assertPositiveMilliBb } from './amounts.js';
import { validateRecordedSettlementState } from './recorded-settlement.js';
import { validateAction } from './action.js';
import {
  GAME_RULES_COLLECTION_TYPES,
} from './game-rules.js';
import { derivePotLayers } from './pot-layers.js';
import { normalizePokerStateRulesSnapshot } from './poker-state-rules.js';
import {
  areHoleCardsDealt,
  isHiddenHoleCards,
  validateHiddenHoleCards,
} from './private-cards.js';
import { deriveSeatAssignments, playersClockwiseAfterSeat, POSITIONS_BY_TABLE_SIZE } from './positions.js';
import {
  isBettingRoundComplete,
  isPlayerAllIn,
  isPlayerLive,
  playerNeedsAction,
} from './selectors.js';
import {
  ANTE_TYPES,
  CHANCE_TYPES,
  CLUBGG_FORCED_CONTRIBUTION_MILLI_BB,
  GAME_MODES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_ACTION_RECORD_SCHEMA_VERSION,
  POKER_HAND_RANK_SCHEMA_VERSION,
  POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  POKER_VARIANT,
  STREETS,
} from './schema.js';

const VALUES = (object) => Object.values(object);
const BOARD_LENGTH_BY_STREET = Object.freeze({
  [STREETS.PREFLOP]: 0,
  [STREETS.FLOP]: 3,
  [STREETS.TURN]: 4,
  [STREETS.RIVER]: 5,
});
const CHANCE_CARD_COUNT = Object.freeze({
  [CHANCE_TYPES.DEAL_FLOP]: 3,
  [CHANCE_TYPES.DEAL_TURN]: 1,
  [CHANCE_TYPES.DEAL_RIVER]: 1,
});
const POKER_STATE_V2_GAME_KEYS = Object.freeze([
  'variant',
  'format',
  'tableSize',
  'smallBlindMilliBb',
  'bigBlindMilliBb',
  'chipUnitMilliBb',
  'ante',
]);
const POKER_STATE_V2_ANTE_KEYS = Object.freeze(['type', 'amountMilliBb']);
const COMMON_LEDGER_KINDS = Object.freeze([
  LEDGER_KINDS.ANTE,
  LEDGER_KINDS.SMALL_BLIND,
  LEDGER_KINDS.BIG_BLIND,
  LEDGER_KINDS.ACTION,
  LEDGER_KINDS.UNCALLED_REFUND,
  LEDGER_KINDS.POT_AWARD,
]);
const POKER_STATE_V1_LEDGER_KINDS = new Set([
  LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION,
  ...COMMON_LEDGER_KINDS,
]);
const POKER_STATE_V2_LEDGER_KINDS = new Set([
  LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
  ...COMMON_LEDGER_KINDS,
]);

function sameNumericRecord(left, right) {
  if (!left || typeof left !== 'object' || Array.isArray(left)
    || !right || typeof right !== 'object' || Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && left[key] === right[key]);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function validatePokerStateV2Rules(state) {
  const rulesSnapshot = normalizePokerStateRulesSnapshot(state.rulesSnapshot);

  requireExactKeys(state.game, POKER_STATE_V2_GAME_KEYS, 'PokerState v2 game');
  requireExactKeys(state.game.ante, POKER_STATE_V2_ANTE_KEYS, 'PokerState v2 game.ante');
  const { definition } = rulesSnapshot;
  if (rulesSnapshot.setup.seatedPlayers !== state.players.length) {
    throw new RangeError('GameRulesSnapshot.setup.seatedPlayers must match players');
  }
  if (state.players.length < definition.tableSize.minimumSeated
    || state.players.length > definition.tableSize.maximumSeated) {
    throw new RangeError('PokerState v2 players must fit the rules table-size policy');
  }
  if (state.game.variant !== definition.variant
    || state.game.format !== definition.format
    || state.game.tableSize !== state.players.length
    || state.game.smallBlindMilliBb !== definition.blinds.smallBlindMilliBb
    || state.game.bigBlindMilliBb !== definition.blinds.bigBlindMilliBb
    || state.game.chipUnitMilliBb !== definition.blinds.chipUnitMilliBb
    || state.game.ante.type !== definition.ante.type
    || state.game.ante.amountMilliBb !== definition.ante.amountMilliBb) {
    throw new RangeError('PokerState v2 game must exactly project its GameRulesSnapshot');
  }
  return rulesSnapshot;
}

function validatePokerStateV2Collection(state, rulesSnapshot) {
  const collectionEntries = state.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION
  ));
  const { collectionPolicy } = rulesSnapshot.definition;
  if (collectionPolicy.type === GAME_RULES_COLLECTION_TYPES.NONE) {
    if (collectionEntries.length !== 0 || state.deductionTotalMilliBb !== 0) {
      throw new RangeError('No-collection PokerState v2 cannot contain non-pot deductions');
    }
    return;
  }
  if (collectionPolicy.type !== GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    throw new RangeError(`Unsupported PokerState v2 collection policy: ${collectionPolicy.type}`);
  }
  if (collectionEntries.length !== state.players.length) {
    throw new RangeError('Fixed collection must occur exactly once per seated player');
  }

  const collectedPlayerIds = new Set();
  for (let index = 0; index < collectionEntries.length; index += 1) {
    const entry = collectionEntries[index];
    if (entry.sequence !== index
      || state.ledger[index] !== entry
      || entry.street !== 'hand'
      || entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION
      || entry.amountMilliBb !== collectionPolicy.amountMilliBb) {
      throw new RangeError('Fixed collection must be exact and precede antes and blinds');
    }
    if (collectedPlayerIds.has(entry.playerId)) {
      throw new RangeError('Fixed collection cannot be applied more than once to a player');
    }
    collectedPlayerIds.add(entry.playerId);
  }
  if (state.players.some((player) => (
    !collectedPlayerIds.has(player.playerId)
      || player.totalDeductionMilliBb !== collectionPolicy.amountMilliBb
  ))) {
    throw new RangeError('Fixed collection ledger must agree with every player deduction');
  }
  const expectedTotal = collectionPolicy.amountMilliBb * state.players.length;
  if (!Number.isSafeInteger(expectedTotal) || state.deductionTotalMilliBb !== expectedTotal) {
    throw new RangeError('Fixed collection total must equal amount times seated players');
  }
}

export function validateGameConfiguration(game, tableSize) {
  if (!game || typeof game !== 'object') throw new TypeError('game configuration is required');
  if (!VALUES(GAME_MODES).includes(game.mode)) throw new RangeError('Unsupported game mode');
  if (!Number.isInteger(tableSize) || tableSize < 2 || tableSize > 10) {
    throw new RangeError('tableSize must be between 2 and 10');
  }
  if (game.mode === GAME_MODES.CLUBGG && tableSize < 7) {
    throw new RangeError('ClubGG mode requires 7 through 10 seated players');
  }

  assertPositiveMilliBb(game.chipUnitMilliBb, 'game.chipUnitMilliBb');
  assertPositiveMilliBb(game.smallBlindMilliBb, 'game.smallBlindMilliBb');
  assertPositiveMilliBb(game.bigBlindMilliBb, 'game.bigBlindMilliBb');
  if (game.bigBlindMilliBb !== 1000) {
    throw new RangeError('game.bigBlindMilliBb must equal 1000 because amounts are denominated in milliBb');
  }
  if (game.smallBlindMilliBb > game.bigBlindMilliBb) {
    throw new RangeError('game.smallBlindMilliBb cannot exceed game.bigBlindMilliBb');
  }
  assertMilliBbAlignment(game.smallBlindMilliBb, game.chipUnitMilliBb, 'game.smallBlindMilliBb');
  assertMilliBbAlignment(game.bigBlindMilliBb, game.chipUnitMilliBb, 'game.bigBlindMilliBb');

  if (!game.ante || typeof game.ante !== 'object' || !VALUES(ANTE_TYPES).includes(game.ante.type)) {
    throw new RangeError('Unsupported ante type');
  }
  assertMilliBbAlignment(game.ante.amountMilliBb, game.chipUnitMilliBb, 'game.ante.amountMilliBb');
  if (game.ante.type === ANTE_TYPES.NONE && game.ante.amountMilliBb !== 0) {
    throw new RangeError('A none ante must have amountMilliBb 0');
  }
  if (game.ante.type !== ANTE_TYPES.NONE && game.ante.amountMilliBb === 0) {
    throw new RangeError('An enabled ante must have a positive amountMilliBb');
  }

  const forced = game.mode === GAME_MODES.CLUBGG ? CLUBGG_FORCED_CONTRIBUTION_MILLI_BB : 0;
  assertMilliBbAlignment(forced, game.chipUnitMilliBb, 'forcedContributionPerPlayerMilliBb');
  return forced;
}

export function validatePokerState(state) {
  if (!state || ![
    POKER_STATE_SCHEMA_VERSION,
    POKER_STATE_V2_SCHEMA_VERSION,
    POKER_STATE_V3_SCHEMA_VERSION,
  ].includes(state.schemaVersion)) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`);
  }
  const isV3 = state.schemaVersion === POKER_STATE_V3_SCHEMA_VERSION;
  const isV2 = isV3 || state.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION;
  if (!isV3 && Object.hasOwn(state, 'recordedSettlement')) throw new RangeError('Recorded settlement requires PokerState v3');
  if (!state.game || state.game.variant !== POKER_VARIANT) throw new RangeError('Unsupported poker variant');
  if (!VALUES(PHASES).includes(state.phase)) throw new RangeError('Invalid phase');
  if (!VALUES(STREETS).includes(state.street)) throw new RangeError('Invalid street');
  if (!Array.isArray(state.players)) throw new TypeError('state.players must be an array');

  let rulesSnapshot = null;
  if (isV2) {
    rulesSnapshot = validatePokerStateV2Rules(state);
    if ((rulesSnapshot.schemaVersion === 'game-rules-snapshot/v2') !== isV3) {
      throw new RangeError('PokerState and rules snapshot versions must match');
    }
    if (isV3 && !Object.hasOwn(state, 'recordedSettlement')) throw new RangeError('PokerState v3 requires recordedSettlement');
  } else {
    const expectedForcedContribution = validateGameConfiguration(state.game, state.players.length);
    if (state.game.tableSize !== state.players.length) throw new RangeError('game.tableSize must match players');
    if (state.game.forcedContributionPerPlayerMilliBb !== expectedForcedContribution) {
      throw new RangeError('forcedContributionPerPlayerMilliBb does not match the game mode');
    }
  }
  if (!POSITIONS_BY_TABLE_SIZE[state.players.length]) throw new RangeError('Unsupported table size');

  const ids = new Set();
  const seats = new Set();
  const cardGroups = [
    { label: 'board', cards: assertCardArray(state.board, 'board') },
    { label: 'deadCards', cards: assertCardArray(state.deadCards, 'deadCards') },
  ];

  for (const player of state.players) {
    if (!player || typeof player !== 'object') throw new TypeError('Each player must be an object');
    if (typeof player.playerId !== 'string' || !player.playerId.trim()) throw new TypeError('playerId is required');
    if (ids.has(player.playerId)) throw new RangeError(`Duplicate playerId: ${player.playerId}`);
    ids.add(player.playerId);
    if (!Number.isInteger(player.seat) || player.seat < 0 || player.seat > 9) throw new RangeError('seat must be an integer from 0 through 9');
    if (seats.has(player.seat)) throw new RangeError(`Duplicate seat: ${player.seat}`);
    seats.add(player.seat);
    if (player.seated !== true || player.dealtIn !== true) {
      throw new RangeError(`Sitting-out players are deferred in ${state.schemaVersion} initialization`);
    }
    if (typeof player.folded !== 'boolean') throw new TypeError('player.folded must be boolean');
    if (typeof player.actedThisStreet !== 'boolean') throw new TypeError('player.actedThisStreet must be boolean');
    if (Object.hasOwn(player, 'allIn')) throw new RangeError('allIn must be derived, not stored');
    if (Object.hasOwn(player, 'totalHandContributionMilliBb')) {
      throw new RangeError('totalHandContributionMilliBb must be derived, not stored');
    }
    for (const field of [
      'startingStackMilliBb',
      'currentStackMilliBb',
      'streetContributionMilliBb',
      'totalPotContributionMilliBb',
      'totalDeductionMilliBb',
    ]) {
      assertMilliBbAlignment(player[field], state.game.chipUnitMilliBb, `player.${field}`);
    }
    if (player.streetContributionMilliBb > player.totalPotContributionMilliBb) {
      throw new RangeError('street contribution cannot exceed total pot contribution');
    }
    if (player.raiseReopenAtMilliBb !== null) {
      assertMilliBbAlignment(
        player.raiseReopenAtMilliBb,
        state.game.chipUnitMilliBb,
        'player.raiseReopenAtMilliBb',
      );
    }
    if (Array.isArray(player.holeCards)) {
      if (player.holeCards.length !== 2) {
        throw new RangeError('Known holeCards must contain exactly two cards');
      }
      cardGroups.push({ label: `holeCards.${player.playerId}`, cards: player.holeCards });
    } else if (player.holeCards !== null) {
      validateHiddenHoleCards(player.holeCards, `holeCards.${player.playerId}`);
    }
  }

  const uniqueKnownCards = assertUniqueKnownCards(cardGroups);
  if (state.board.length !== BOARD_LENGTH_BY_STREET[state.street]) {
    throw new RangeError(`Street ${state.street} requires exactly ${BOARD_LENGTH_BY_STREET[state.street]} board cards`);
  }
  const hiddenHoleCardPlayers = state.players.filter((player) => isHiddenHoleCards(player.holeCards));
  const dealtHoleCardPlayers = state.players.filter((player) => areHoleCardsDealt(player.holeCards));
  if (dealtHoleCardPlayers.length !== 0 && dealtHoleCardPlayers.length !== state.players.length) {
    throw new RangeError('Hole cards must be either entirely pending or dealt for every dealt-in player');
  }
  if (uniqueKnownCards.size + (hiddenHoleCardPlayers.length * 2) > 52) {
    throw new RangeError('Known and hidden physical card counts cannot exceed the deck');
  }
  if (!seats.has(state.buttonSeat)) throw new RangeError('buttonSeat must be occupied');
  const expectedAssignments = deriveSeatAssignments(state.players, state.buttonSeat);
  for (const assignment of expectedAssignments) {
    const player = state.players.find((candidate) => candidate.playerId === assignment.playerId);
    if (player.position !== assignment.position) throw new RangeError(`Invalid position for ${player.playerId}`);
  }

  for (const field of ['potMilliBb', 'deductionTotalMilliBb', 'currentBetMilliBb', 'lastFullRaiseIncrementMilliBb']) {
    assertMilliBbAlignment(state[field], state.game.chipUnitMilliBb, field);
  }
  if (Object.hasOwn(state, 'minimumBetToMilliBb') || Object.hasOwn(state, 'minimumRaiseToMilliBb')) {
    throw new RangeError('Minimum bet and raise values must be derived, not stored');
  }
  if (state.potMilliBb > state.players.reduce((sum, player) => sum + player.totalPotContributionMilliBb, 0)) {
    throw new RangeError('potMilliBb cannot exceed gross player pot contributions');
  }
  if (state.deductionTotalMilliBb !== state.players.reduce((sum, player) => sum + player.totalDeductionMilliBb, 0)) {
    throw new RangeError('deductionTotalMilliBb must equal player deductions');
  }

  if (!Array.isArray(state.ledger)) throw new TypeError('ledger must be an array');
  let ledgerPot = 0;
  let ledgerDeduction = 0;
  let ledgerRecordedRake = 0;
  const ledgerPotByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  const ledgerDeductionByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  const streetPotByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  state.ledger.forEach((entry, index) => {
    if (entry.sequence !== index) throw new RangeError('Ledger sequence must be contiguous');
    const rakeEntry = isV3 && entry.kind === LEDGER_KINDS.RECORDED_RAKE;
    if (rakeEntry ? entry.playerId !== null : !ids.has(entry.playerId)) throw new RangeError('Ledger entry refers to an unknown player');
    const allowedLedgerKinds = isV2
      ? POKER_STATE_V2_LEDGER_KINDS
      : POKER_STATE_V1_LEDGER_KINDS;
    if (!rakeEntry && !allowedLedgerKinds.has(entry.kind)) throw new RangeError('Invalid ledger kind');
    if (rakeEntry !== (entry.movement === LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE)) {
      throw new RangeError('Recorded rake must move from pot to recorded rake');
    }
    if (!VALUES(LEDGER_MOVEMENTS).includes(entry.movement)) throw new RangeError('Invalid ledger movement');
    assertPositiveMilliBb(entry.amountMilliBb, 'ledger.amountMilliBb');
    assertMilliBbAlignment(entry.amountMilliBb, state.game.chipUnitMilliBb, 'ledger.amountMilliBb');
    if (entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
      && entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      throw new RangeError('ClubGG contributions must be non-pot deductions');
    }
    if (entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION
      && entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      throw new RangeError('Fixed player collections must be non-pot deductions');
    }
    if (entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION && entry.street !== 'hand') {
      throw new RangeError('Fixed player collections must occur at hand start');
    }
    if ([LEDGER_KINDS.ANTE, LEDGER_KINDS.SMALL_BLIND, LEDGER_KINDS.BIG_BLIND, LEDGER_KINDS.ACTION].includes(entry.kind)
      && entry.movement !== LEDGER_MOVEMENTS.STACK_TO_POT) {
      throw new RangeError('Antes, blinds, and actions must enter the pot');
    }
    if ([LEDGER_KINDS.UNCALLED_REFUND, LEDGER_KINDS.POT_AWARD].includes(entry.kind)
      && entry.movement !== LEDGER_MOVEMENTS.POT_TO_STACK) {
      throw new RangeError('Refunds and awards must move from pot to stack');
    }
    if (Object.hasOwn(entry, 'settlementReason')) {
      if (entry.kind !== LEDGER_KINDS.POT_AWARD
        || entry.settlementReason !== 'showdown'
        || !Number.isInteger(entry.potLayerIndex)
        || entry.potLayerIndex < 0) {
        throw new RangeError('Showdown award metadata requires a nonnegative potLayerIndex');
      }
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT) {
      ledgerPot += entry.amountMilliBb;
      ledgerPotByPlayer.set(entry.playerId, ledgerPotByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      ledgerDeduction += entry.amountMilliBb;
      ledgerDeductionByPlayer.set(entry.playerId, ledgerDeductionByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
    if (rakeEntry) ledgerRecordedRake += entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.POT_TO_STACK || rakeEntry) {
      ledgerPot -= entry.amountMilliBb;
      if (ledgerPot < 0) throw new RangeError('Ledger cannot credit more than the available pot');
    }
    if (entry.street === state.street
      && [LEDGER_KINDS.SMALL_BLIND, LEDGER_KINDS.BIG_BLIND, LEDGER_KINDS.ACTION].includes(entry.kind)) {
      streetPotByPlayer.set(entry.playerId, streetPotByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
  });
  if (ledgerPot !== state.potMilliBb || ledgerDeduction !== state.deductionTotalMilliBb) {
    throw new RangeError('Ledger totals must agree with state totals');
  }
  for (const player of state.players) {
    if (ledgerPotByPlayer.get(player.playerId) !== player.totalPotContributionMilliBb
      || ledgerDeductionByPlayer.get(player.playerId) !== player.totalDeductionMilliBb
      || streetPotByPlayer.get(player.playerId) !== player.streetContributionMilliBb) {
      throw new RangeError(`Ledger does not agree with player totals for ${player.playerId}`);
    }
  }
  if (isV2) validatePokerStateV2Collection(state, rulesSnapshot);

  const startingStacks = state.players.reduce((sum, player) => sum + player.startingStackMilliBb, 0);
  const currentStacks = state.players.reduce((sum, player) => sum + player.currentStackMilliBb, 0);
  if (startingStacks !== currentStacks + state.potMilliBb + state.deductionTotalMilliBb + ledgerRecordedRake) {
    throw new RangeError('Aggregate chips are not conserved');
  }

  if (!Array.isArray(state.actionHistory)) throw new TypeError('actionHistory must be an array');
  state.actionHistory.forEach((record, index) => {
    if (!record || record.schemaVersion !== POKER_ACTION_RECORD_SCHEMA_VERSION) {
      throw new TypeError(`Expected ${POKER_ACTION_RECORD_SCHEMA_VERSION}`);
    }
    if (record.sequence !== index) throw new RangeError('ActionRecord sequence must be contiguous');
    if (!ids.has(record.playerId)) throw new RangeError('ActionRecord refers to an unknown player');
    if (!VALUES(STREETS).includes(record.street)) throw new RangeError('ActionRecord has an invalid street');
    validateAction(record.submittedAction, state.game.chipUnitMilliBb);
    if (record.submittedAction.playerId !== record.playerId) {
      throw new RangeError('ActionRecord player must match its submitted action');
    }
    for (const field of [
      'toCallBeforeMilliBb',
      'committedMilliBb',
      'streetContributionAfterMilliBb',
      'currentBetBeforeMilliBb',
      'currentBetAfterMilliBb',
    ]) {
      assertMilliBbAlignment(record[field], state.game.chipUnitMilliBb, `actionHistory.${field}`);
    }
    if (typeof record.wasAllIn !== 'boolean'
      || typeof record.wasFullRaise !== 'boolean'
      || typeof record.reopenedBetting !== 'boolean') {
      throw new TypeError('ActionRecord flags must be boolean');
    }
  });

  if (state.actingPlayerId !== null && !ids.has(state.actingPlayerId)) {
    throw new RangeError('actingPlayerId must identify a player or be null');
  }

  if (state.phase === PHASES.CHANCE) {
    if (!state.pendingChance || typeof state.pendingChance !== 'object') {
      throw new RangeError('A chance phase requires pendingChance');
    }
    let expectedChanceType;
    if (state.street === STREETS.PREFLOP) {
      expectedChanceType = dealtHoleCardPlayers.length === 0
        ? CHANCE_TYPES.DEAL_HOLE
        : CHANCE_TYPES.DEAL_FLOP;
    } else if (state.street === STREETS.FLOP) {
      expectedChanceType = CHANCE_TYPES.DEAL_TURN;
    } else if (state.street === STREETS.TURN) {
      expectedChanceType = CHANCE_TYPES.DEAL_RIVER;
    } else {
      throw new RangeError('River cannot have a pending board chance event');
    }
    if (state.pendingChance.type !== expectedChanceType) {
      throw new RangeError(`Street ${state.street} requires pending chance ${expectedChanceType}`);
    }
    const expectedCardCount = expectedChanceType === CHANCE_TYPES.DEAL_HOLE
      ? state.players.length * 2
      : CHANCE_CARD_COUNT[expectedChanceType];
    if (state.pendingChance.cardCount !== expectedCardCount) {
      throw new RangeError(`Pending ${expectedChanceType} has an invalid card count`);
    }
  } else if (state.pendingChance !== null) {
    throw new RangeError('pendingChance is only valid during a chance phase');
  }

  if (state.phase !== PHASES.CHANCE && dealtHoleCardPlayers.length !== state.players.length) {
    throw new RangeError('All dealt-in players require dealt hole cards outside the initial chance state');
  }

  const currentStreetActions = state.actionHistory.filter((record) => record.street === state.street);
  if (state.street !== STREETS.PREFLOP && currentStreetActions.length === 0) {
    if (state.currentBetMilliBb !== 0
      || state.lastFullRaiseIncrementMilliBb !== state.game.bigBlindMilliBb
      || state.lastAggressorPlayerId !== null
      || state.players.some((player) => (
        player.streetContributionMilliBb !== 0
        || player.actedThisStreet
        || player.raiseReopenAtMilliBb !== null
      ))) {
      throw new RangeError('A newly initialized postflop street must have reset betting state');
    }
  }

  if (state.street !== STREETS.PREFLOP && currentStreetActions.length > 0) {
    const maximumStreetContribution = state.players.reduce((maximum, player) => (
      Math.max(maximum, player.streetContributionMilliBb)
    ), 0);
    if (state.currentBetMilliBb !== maximumStreetContribution) {
      throw new RangeError('Postflop current bet must equal the greatest street contribution');
    }
  }

  const playersAbleToBet = state.players.filter((player) => (
    isPlayerLive(player) && !isPlayerAllIn(player)
  ));
  const hasOutstandingCall = playersAbleToBet.some((player) => (
    player.streetContributionMilliBb < state.currentBetMilliBb
  ));
  const bettingIsResolved = isBettingRoundComplete(state)
    || (playersAbleToBet.length < 2 && !hasOutstandingCall);
  if (state.phase === PHASES.BETTING && state.actingPlayerId === null) {
    throw new RangeError('A betting state requires an acting player');
  }
  if (state.phase === PHASES.BETTING) {
    const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
    if (!actor.dealtIn || actor.folded || actor.currentStackMilliBb === 0) {
      throw new RangeError('A betting actor must be live and have chips');
    }
    if (!playerNeedsAction(state, actor.playerId)) {
      throw new RangeError('The betting actor must still need action');
    }
    if (isBettingRoundComplete(state)) {
      throw new RangeError('A complete betting round cannot retain an actor');
    }
    if (state.street !== STREETS.PREFLOP
      && playersAbleToBet.length < 2
      && !hasOutstandingCall) {
      throw new RangeError('Postflop betting cannot require a fake check from the only player with chips');
    }
    if (state.street !== STREETS.PREFLOP && currentStreetActions.length === 0) {
      const expectedActor = playersClockwiseAfterSeat(state.players, state.buttonSeat)
        .find((player) => player.dealtIn && !player.folded && player.currentStackMilliBb > 0);
      if (!expectedActor || state.actingPlayerId !== expectedActor.playerId) {
        throw new RangeError('A new postflop street must begin left of the button');
      }
    }
  }
  if (state.phase === PHASES.CHANCE
    && state.street !== STREETS.PREFLOP
    && !bettingIsResolved) {
    throw new RangeError('Postflop chance requires completed betting or no meaningful action');
  }
  const expectedShowdownEligiblePlayerIds = state.players
    .filter((player) => player.dealtIn && !player.folded)
    .map((player) => player.playerId);
  const settledShowdown = state.phase === PHASES.TERMINAL
    && state.terminal && state.terminal.reason === 'showdown';
  if (state.phase === PHASES.SHOWDOWN) {
    if (state.street !== STREETS.RIVER || state.actingPlayerId !== null || state.pendingChance !== null) {
      throw new RangeError('Showdown-ready state requires a complete river and no actor or chance');
    }
    if (!state.showdown
      || !['ready', 'awaiting_private_reveal'].includes(state.showdown.status)
      || !bettingIsResolved) {
      throw new RangeError('Showdown requires completed river betting or no meaningful action');
    }
    if (!Array.isArray(state.showdown.eligiblePlayerIds)
      || state.showdown.eligiblePlayerIds.length !== expectedShowdownEligiblePlayerIds.length
      || state.showdown.eligiblePlayerIds.some((playerId, index) => (
        playerId !== expectedShowdownEligiblePlayerIds[index]
      ))) {
      throw new RangeError('Showdown eligible players must match live players');
    }
    if (state.showdown.handRanksByPlayer !== null
      || !Array.isArray(state.showdown.layerResults)
      || state.showdown.layerResults.length !== 0) {
      throw new RangeError('Showdown-ready state cannot contain settlement results');
    }
    const expectedRevealPlayerIds = state.players
      .filter((player) => isPlayerLive(player) && isHiddenHoleCards(player.holeCards))
      .map((player) => player.playerId);
    if (state.showdown.status === 'awaiting_private_reveal') {
      if (expectedRevealPlayerIds.length === 0
        || !Array.isArray(state.showdown.requiredRevealPlayerIds)
        || state.showdown.requiredRevealPlayerIds.length !== expectedRevealPlayerIds.length
        || state.showdown.requiredRevealPlayerIds.some((playerId, index) => (
          playerId !== expectedRevealPlayerIds[index]
        ))) {
        throw new RangeError('Awaiting showdown reveal IDs must match live hidden players');
      }
    } else if (expectedRevealPlayerIds.length !== 0
      || Object.hasOwn(state.showdown, 'requiredRevealPlayerIds')) {
      throw new RangeError('Showdown cannot be ready while a live private hand is hidden');
    }
  } else if (settledShowdown) {
    if (!state.showdown || state.showdown.status !== 'settled'
      || state.street !== STREETS.RIVER
      || state.actingPlayerId !== null
      || state.pendingChance !== null) {
      throw new RangeError('Settled showdown requires a complete river and no actor or chance');
    }
    if (!Array.isArray(state.showdown.eligiblePlayerIds)
      || state.showdown.eligiblePlayerIds.length !== expectedShowdownEligiblePlayerIds.length
      || state.showdown.eligiblePlayerIds.some((playerId, index) => (
        playerId !== expectedShowdownEligiblePlayerIds[index]
      ))) {
      throw new RangeError('Settled showdown eligible players must match live players');
    }
    if (!state.showdown.handRanksByPlayer
      || typeof state.showdown.handRanksByPlayer !== 'object'
      || Array.isArray(state.showdown.handRanksByPlayer)
      || !Array.isArray(state.showdown.layerResults)) {
      throw new RangeError('Settled showdown requires structural ranks and layer results');
    }
    const derivedLayers = derivePotLayers(state);
    if (state.showdown.layerResults.length !== derivedLayers.length) {
      throw new RangeError('Settled showdown results must match every derived pot layer');
    }
    const evaluatedPlayerIds = new Set(
      derivedLayers.flatMap((layer) => layer.eligiblePlayerIds),
    );
    const rankedPlayerIds = Object.keys(state.showdown.handRanksByPlayer);
    if (rankedPlayerIds.length !== evaluatedPlayerIds.size
      || rankedPlayerIds.some((playerId) => !evaluatedPlayerIds.has(playerId))
      || rankedPlayerIds.some((playerId) => (
        state.showdown.handRanksByPlayer[playerId]?.schemaVersion
          !== POKER_HAND_RANK_SCHEMA_VERSION
      ))) {
      throw new RangeError('Settled showdown ranks must match every evaluated player');
    }
    const aggregatePayouts = {};
    state.showdown.layerResults.forEach((result, index) => {
      const layer = derivedLayers[index];
      if (!result || result.schemaVersion !== POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION
        || result.layerIndex !== index
        || result.amountMilliBb !== layer.amountMilliBb
        || result.contributionFloorMilliBb !== layer.contributionFloorMilliBb
        || result.contributionCeilingMilliBb !== layer.contributionCeilingMilliBb
        || !Array.isArray(result.eligiblePlayerIds)
        || result.eligiblePlayerIds.length !== layer.eligiblePlayerIds.length
        || result.eligiblePlayerIds.some((playerId, playerIndex) => (
          playerId !== layer.eligiblePlayerIds[playerIndex]
        ))
        || !Array.isArray(result.winnerPlayerIds)
        || result.winnerPlayerIds.length === 0
        || new Set(result.winnerPlayerIds).size !== result.winnerPlayerIds.length
        || result.winnerPlayerIds.some((playerId) => !layer.eligiblePlayerIds.includes(playerId))
        || !result.payoutsMilliBbByPlayer
        || typeof result.payoutsMilliBbByPlayer !== 'object') {
        throw new RangeError('Invalid settled showdown layer result');
      }
      const payoutIds = Object.keys(result.payoutsMilliBbByPlayer);
      if (payoutIds.length !== result.winnerPlayerIds.length
        || payoutIds.some((playerId) => !result.winnerPlayerIds.includes(playerId))) {
        throw new RangeError('Layer payout recipients must match layer winners');
      }
      let layerPayout = 0;
      for (const [playerId, amountMilliBb] of Object.entries(result.payoutsMilliBbByPlayer)) {
        assertPositiveMilliBb(amountMilliBb, 'showdown.layer payout');
        assertMilliBbAlignment(amountMilliBb, state.game.chipUnitMilliBb, 'showdown.layer payout');
        layerPayout += amountMilliBb;
        aggregatePayouts[playerId] = (aggregatePayouts[playerId] || 0) + amountMilliBb;
        const rank = state.showdown.handRanksByPlayer[playerId];
        if (!rank || rank.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION) {
          throw new RangeError('Every showdown winner requires a canonical hand rank');
        }
      }
      if (layerPayout !== layer.amountMilliBb) {
        throw new RangeError('Layer payouts must equal the exact pot-layer amount');
      }
    });
    if (!sameNumericRecord(aggregatePayouts, isV3 && state.recordedSettlement
      ? state.recordedSettlement.grossPayoutsMilliBbByPlayer : state.terminal.payoutsMilliBbByPlayer)) {
      throw new RangeError('Terminal showdown payouts must equal aggregate layer payouts');
    }
  } else if (!state.showdown || state.showdown.status !== 'not_reached') {
    throw new RangeError('Showdown status must remain not_reached before showdown');
  } else if (state.showdown.handRanksByPlayer !== null
    || !Array.isArray(state.showdown.layerResults)
    || state.showdown.layerResults.length !== 0) {
    throw new RangeError('Unreached showdown cannot contain settlement results');
  }
  if (!state.showdown || !Array.isArray(state.showdown.pots) || state.showdown.pots.length !== 0) {
    throw new RangeError('showdown.pots is reserved; canonical pot layers are derived');
  }
  if (state.phase === PHASES.TERMINAL
    && (state.actingPlayerId !== null || state.potMilliBb !== 0
      || !state.terminal || state.terminal.isTerminal !== true)) {
    throw new RangeError('A terminal state must have no actor, no unsettled pot, and terminal status');
  }

  if (isV3) validateRecordedSettlementState(state, ledgerRecordedRake);
  return state;
}

export function validateInitializedPokerState(state) {
  validatePokerState(state);
  const playerIds = new Set(state.players.map((player) => player.playerId));
  if (state.actionHistory.length !== 0) {
    throw new RangeError('ENGINE-002 initialized actionHistory must be empty');
  }
  if (state.phase !== PHASES.CHANCE || state.street !== STREETS.PREFLOP || state.actingPlayerId !== null) {
    throw new RangeError('ENGINE-002 initialization must await preflop hole-card chance');
  }
  if (!state.pendingChance || state.pendingChance.type !== CHANCE_TYPES.DEAL_HOLE) {
    throw new RangeError('Initialization must request hole cards explicitly');
  }
  if (state.pendingChance.cardCount !== state.players.length * 2) {
    throw new RangeError('Hole-card chance count must be two per player');
  }
  if (!Array.isArray(state.pendingChance.playerOrder)
    || state.pendingChance.playerOrder.length !== state.players.length
    || new Set(state.pendingChance.playerOrder).size !== state.players.length
    || state.pendingChance.playerOrder.some((playerId) => !playerIds.has(playerId))) {
    throw new RangeError('Hole-card chance order must contain every player exactly once');
  }
  if (state.board.length !== 0 || state.players.some((player) => player.holeCards !== null)) {
    throw new RangeError('Hole cards and board must be undealt while deal_hole is pending');
  }
  if (state.currentBetMilliBb !== state.game.bigBlindMilliBb) {
    throw new RangeError('Initial current bet must be the nominal big blind');
  }
  if (state.lastFullRaiseIncrementMilliBb !== state.game.bigBlindMilliBb) {
    throw new RangeError('Initial full-raise increment must be the nominal big blind');
  }
  if (!state.terminal || state.terminal.isTerminal !== false || state.terminal.reason !== null) {
    throw new RangeError('An initialized hand cannot be terminal');
  }
  if (!state.showdown || state.showdown.status !== 'not_reached') {
    throw new RangeError('Showdown cannot be reached during initialization');
  }

  return state;
}
