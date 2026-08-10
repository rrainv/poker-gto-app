import { assertMilliBbAlignment } from './amounts.js';
import { deepFreeze } from './freeze.js';
import { deriveSeatAssignments, playersBySeat, playersClockwiseAfterSeat } from './positions.js';
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
import { validateGameConfiguration, validateInitializedPokerState } from './validate.js';

function validatePlayerSeeds(players, chipUnitMilliBb) {
  if (!Array.isArray(players)) throw new TypeError('players must be an array');
  const ids = new Set();
  const seats = new Set();
  return players.map((player, index) => {
    if (!player || typeof player !== 'object') throw new TypeError(`players[${index}] must be an object`);
    if (typeof player.playerId !== 'string' || !player.playerId.trim()) throw new TypeError(`players[${index}].playerId is required`);
    if (ids.has(player.playerId)) throw new RangeError(`Duplicate playerId: ${player.playerId}`);
    ids.add(player.playerId);
    if (!Number.isInteger(player.seat) || player.seat < 0 || player.seat > 9) throw new RangeError('seat must be an integer from 0 through 9');
    if (seats.has(player.seat)) throw new RangeError(`Duplicate seat: ${player.seat}`);
    seats.add(player.seat);
    if ((Object.hasOwn(player, 'seated') && player.seated !== true)
      || (Object.hasOwn(player, 'dealtIn') && player.dealtIn !== true)) {
      throw new RangeError('Sitting-out players are deferred in poker-state/v1 initialization');
    }
    assertMilliBbAlignment(player.startingStackMilliBb, chipUnitMilliBb, `players[${index}].startingStackMilliBb`);
    return {
      playerId: player.playerId,
      seat: player.seat,
      startingStackMilliBb: player.startingStackMilliBb,
    };
  });
}

export function initializeHand(configuration) {
  if (!configuration || typeof configuration !== 'object') throw new TypeError('configuration is required');
  const { game, buttonSeat } = configuration;
  const playerSeeds = validatePlayerSeeds(configuration.players, game && game.chipUnitMilliBb);
  const forcedContributionPerPlayerMilliBb = validateGameConfiguration(game, playerSeeds.length);
  const aggregateStartingStack = playerSeeds.reduce((sum, player) => sum + player.startingStackMilliBb, 0);
  if (!Number.isSafeInteger(aggregateStartingStack)) {
    throw new RangeError('Aggregate starting stacks must fit in a safe integer');
  }
  if (!Number.isInteger(buttonSeat) || !playerSeeds.some((player) => player.seat === buttonSeat)) {
    throw new RangeError('buttonSeat must be an occupied integer seat');
  }
  if (configuration.handId !== undefined && configuration.handId !== null
    && typeof configuration.handId !== 'string') {
    throw new TypeError('handId must be a string or null');
  }

  if (game.mode === GAME_MODES.CLUBGG) {
    for (const player of playerSeeds) {
      if (player.startingStackMilliBb < CLUBGG_FORCED_CONTRIBUTION_MILLI_BB) {
        throw new RangeError(`ClubGG player ${player.playerId} cannot pay exactly 100 milliBb`);
      }
    }
  }

  const assignments = deriveSeatAssignments(playerSeeds, buttonSeat);
  const assignmentById = new Map(assignments.map((assignment) => [assignment.playerId, assignment]));
  const players = playersBySeat(playerSeeds).map((seed) => ({
    playerId: seed.playerId,
    seat: seed.seat,
    position: assignmentById.get(seed.playerId).position,
    seated: true,
    dealtIn: true,
    holeCards: null,
    startingStackMilliBb: seed.startingStackMilliBb,
    currentStackMilliBb: seed.startingStackMilliBb,
    streetContributionMilliBb: 0,
    totalPotContributionMilliBb: 0,
    totalDeductionMilliBb: 0,
    folded: false,
    actedThisStreet: false,
    raiseReopenAtMilliBb: null,
  }));

  const ledger = [];
  let potMilliBb = 0;
  let deductionTotalMilliBb = 0;

  const debit = (player, requestedMilliBb, kind, movement, allowShort) => {
    const amountMilliBb = allowShort
      ? Math.min(requestedMilliBb, player.currentStackMilliBb)
      : requestedMilliBb;
    if (amountMilliBb === 0) return 0;
    if (amountMilliBb > player.currentStackMilliBb) throw new RangeError(`${player.playerId} has insufficient stack`);
    player.currentStackMilliBb -= amountMilliBb;
    if (movement === LEDGER_MOVEMENTS.STACK_TO_POT) {
      player.totalPotContributionMilliBb += amountMilliBb;
      potMilliBb += amountMilliBb;
    } else {
      player.totalDeductionMilliBb += amountMilliBb;
      deductionTotalMilliBb += amountMilliBb;
    }
    ledger.push({
      sequence: ledger.length,
      playerId: player.playerId,
      street: kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION ? 'hand' : STREETS.PREFLOP,
      kind,
      movement,
      amountMilliBb,
    });
    return amountMilliBb;
  };

  if (forcedContributionPerPlayerMilliBb > 0) {
    for (const player of players) {
      debit(
        player,
        forcedContributionPerPlayerMilliBb,
        LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION,
        LEDGER_MOVEMENTS.STACK_TO_DEDUCTION,
        false,
      );
    }
  }

  const smallBlind = players.find((player) => assignmentById.get(player.playerId).isSmallBlind);
  const bigBlind = players.find((player) => assignmentById.get(player.playerId).isBigBlind);

  if (game.ante.type === ANTE_TYPES.PER_PLAYER) {
    for (const player of players) {
      debit(player, game.ante.amountMilliBb, LEDGER_KINDS.ANTE, LEDGER_MOVEMENTS.STACK_TO_POT, true);
    }
  } else if (game.ante.type === ANTE_TYPES.BIG_BLIND) {
    debit(bigBlind, game.ante.amountMilliBb, LEDGER_KINDS.ANTE, LEDGER_MOVEMENTS.STACK_TO_POT, true);
  }

  const smallBlindPosted = debit(
    smallBlind,
    game.smallBlindMilliBb,
    LEDGER_KINDS.SMALL_BLIND,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    true,
  );
  smallBlind.streetContributionMilliBb += smallBlindPosted;

  const bigBlindPosted = debit(
    bigBlind,
    game.bigBlindMilliBb,
    LEDGER_KINDS.BIG_BLIND,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    true,
  );
  bigBlind.streetContributionMilliBb += bigBlindPosted;

  const dealOrder = playersClockwiseAfterSeat(players, buttonSeat)
    .concat(players.find((player) => player.seat === buttonSeat))
    .map((player) => player.playerId);
  const state = {
    schemaVersion: POKER_STATE_SCHEMA_VERSION,
    handId: configuration.handId ?? null,
    game: {
      variant: POKER_VARIANT,
      mode: game.mode,
      tableSize: players.length,
      smallBlindMilliBb: game.smallBlindMilliBb,
      bigBlindMilliBb: game.bigBlindMilliBb,
      chipUnitMilliBb: game.chipUnitMilliBb,
      ante: {
        type: game.ante.type,
        amountMilliBb: game.ante.amountMilliBb,
      },
      forcedContributionPerPlayerMilliBb,
    },
    phase: PHASES.CHANCE,
    street: STREETS.PREFLOP,
    buttonSeat,
    actingPlayerId: null,
    board: [],
    deadCards: [],
    players,
    potMilliBb,
    deductionTotalMilliBb,
    currentBetMilliBb: game.bigBlindMilliBb,
    lastFullRaiseIncrementMilliBb: game.bigBlindMilliBb,
    lastAggressorPlayerId: null,
    actionHistory: [],
    ledger,
    pendingChance: {
      type: CHANCE_TYPES.DEAL_HOLE,
      cardCount: players.length * 2,
      playerOrder: dealOrder,
    },
    terminal: {
      isTerminal: false,
      reason: null,
      winnerPlayerIds: [],
      payoutsMilliBbByPlayer: {},
      refundsMilliBbByPlayer: {},
    },
    showdown: {
      status: 'not_reached',
      eligiblePlayerIds: [],
      pots: [],
      handRanksByPlayer: null,
      layerResults: [],
    },
  };

  validateInitializedPokerState(state);
  return deepFreeze(state);
}
