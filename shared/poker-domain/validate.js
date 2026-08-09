import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { assertMilliBbAlignment, assertPositiveMilliBb } from './amounts.js';
import { deriveSeatAssignments, POSITIONS_BY_TABLE_SIZE } from './positions.js';
import {
  ANTE_TYPES,
  CHANCE_TYPES,
  CLUBGG_FORCED_CONTRIBUTION_MILLI_BB,
  GAME_MODES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_VARIANT,
  STREETS,
} from './schema.js';

const VALUES = (object) => Object.values(object);

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
  if (!state || state.schemaVersion !== POKER_STATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION}`);
  }
  if (!state.game || state.game.variant !== POKER_VARIANT) throw new RangeError('Unsupported poker variant');
  if (!VALUES(PHASES).includes(state.phase)) throw new RangeError('Invalid phase');
  if (!VALUES(STREETS).includes(state.street)) throw new RangeError('Invalid street');
  if (!Array.isArray(state.players)) throw new TypeError('state.players must be an array');

  const expectedForcedContribution = validateGameConfiguration(state.game, state.players.length);
  if (state.game.tableSize !== state.players.length) throw new RangeError('game.tableSize must match players');
  if (state.game.forcedContributionPerPlayerMilliBb !== expectedForcedContribution) {
    throw new RangeError('forcedContributionPerPlayerMilliBb does not match the game mode');
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
    if (player.seated !== true || player.dealtIn !== true) throw new RangeError('Sitting-out players are deferred in poker-state/v1 initialization');
    if (player.folded !== false) throw new RangeError('An initialized player cannot already be folded');
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
    if (player.startingStackMilliBb !== player.currentStackMilliBb
      + player.totalPotContributionMilliBb + player.totalDeductionMilliBb) {
      throw new RangeError(`Player stack accounting does not conserve for ${player.playerId}`);
    }
    if (player.holeCards !== null) {
      if (!Array.isArray(player.holeCards) || player.holeCards.length !== 2) {
        throw new RangeError('Known holeCards must contain exactly two cards');
      }
      cardGroups.push({ label: `holeCards.${player.playerId}`, cards: player.holeCards });
    }
  }

  assertUniqueKnownCards(cardGroups);
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
  if (state.potMilliBb !== state.players.reduce((sum, player) => sum + player.totalPotContributionMilliBb, 0)) {
    throw new RangeError('potMilliBb must equal player pot contributions');
  }
  if (state.deductionTotalMilliBb !== state.players.reduce((sum, player) => sum + player.totalDeductionMilliBb, 0)) {
    throw new RangeError('deductionTotalMilliBb must equal player deductions');
  }

  if (!Array.isArray(state.ledger)) throw new TypeError('ledger must be an array');
  let ledgerPot = 0;
  let ledgerDeduction = 0;
  const ledgerPotByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  const ledgerDeductionByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  const blindByPlayer = new Map(state.players.map((player) => [player.playerId, 0]));
  state.ledger.forEach((entry, index) => {
    if (entry.sequence !== index) throw new RangeError('Ledger sequence must be contiguous');
    if (!ids.has(entry.playerId)) throw new RangeError('Ledger entry refers to an unknown player');
    if (!VALUES(LEDGER_KINDS).includes(entry.kind)) throw new RangeError('Invalid ledger kind');
    if (!VALUES(LEDGER_MOVEMENTS).includes(entry.movement)) throw new RangeError('Invalid ledger movement');
    assertPositiveMilliBb(entry.amountMilliBb, 'ledger.amountMilliBb');
    assertMilliBbAlignment(entry.amountMilliBb, state.game.chipUnitMilliBb, 'ledger.amountMilliBb');
    if (entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
      && entry.movement !== LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      throw new RangeError('ClubGG contributions must be non-pot deductions');
    }
    if (entry.kind !== LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
      && entry.movement !== LEDGER_MOVEMENTS.STACK_TO_POT) {
      throw new RangeError('Antes and blinds must enter the pot');
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT) {
      ledgerPot += entry.amountMilliBb;
      ledgerPotByPlayer.set(entry.playerId, ledgerPotByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      ledgerDeduction += entry.amountMilliBb;
      ledgerDeductionByPlayer.set(entry.playerId, ledgerDeductionByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
    if (entry.kind === LEDGER_KINDS.SMALL_BLIND || entry.kind === LEDGER_KINDS.BIG_BLIND) {
      blindByPlayer.set(entry.playerId, blindByPlayer.get(entry.playerId) + entry.amountMilliBb);
    }
  });
  if (ledgerPot !== state.potMilliBb || ledgerDeduction !== state.deductionTotalMilliBb) {
    throw new RangeError('Ledger totals must agree with state totals');
  }
  for (const player of state.players) {
    if (ledgerPotByPlayer.get(player.playerId) !== player.totalPotContributionMilliBb
      || ledgerDeductionByPlayer.get(player.playerId) !== player.totalDeductionMilliBb
      || blindByPlayer.get(player.playerId) !== player.streetContributionMilliBb) {
      throw new RangeError(`Ledger does not agree with player totals for ${player.playerId}`);
    }
  }

  if (!Array.isArray(state.actionHistory)) throw new TypeError('actionHistory must be an array');

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
