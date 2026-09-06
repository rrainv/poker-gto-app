import { assertMilliBbAlignment } from './amounts.js';
import { deepFreeze } from './freeze.js';
import {
  GAME_RULES_COLLECTION_TYPES,
} from './game-rules.js';
import { normalizePokerStateRulesSnapshot } from './poker-state-rules.js';
import { deriveSeatAssignments, playersBySeat, playersClockwiseAfterSeat } from './positions.js';
import {
  ANTE_TYPES,
  CHANCE_TYPES,
  CLUBGG_FORCED_CONTRIBUTION_MILLI_BB,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  POKER_VARIANT,
  STREETS,
} from './schema.js';
import { validateGameConfiguration, validateInitializedPokerState } from './validate.js';

function validatePlayerSeeds(players, chipUnitMilliBb, stateSchemaVersion) {
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
      throw new RangeError(`Sitting-out players are deferred in ${stateSchemaVersion} initialization`);
    }
    assertMilliBbAlignment(player.startingStackMilliBb, chipUnitMilliBb, `players[${index}].startingStackMilliBb`);
    return {
      playerId: player.playerId,
      seat: player.seat,
      startingStackMilliBb: player.startingStackMilliBb,
    };
  });
}

function initializeResolvedHand(configuration, playerSeeds, resolved) {
  const { buttonSeat } = configuration;
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

  if (resolved.collectionAmountMilliBb > 0) {
    for (const player of playerSeeds) {
      if (player.startingStackMilliBb < resolved.collectionAmountMilliBb) {
        throw new RangeError(resolved.insufficientCollectionMessage(player));
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
      street: movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION ? 'hand' : STREETS.PREFLOP,
      kind,
      movement,
      amountMilliBb,
    });
    return amountMilliBb;
  };

  if (resolved.collectionAmountMilliBb > 0) {
    for (const player of players) {
      debit(
        player,
        resolved.collectionAmountMilliBb,
        resolved.collectionLedgerKind,
        LEDGER_MOVEMENTS.STACK_TO_DEDUCTION,
        false,
      );
    }
  }

  const smallBlind = players.find((player) => assignmentById.get(player.playerId).isSmallBlind);
  const bigBlind = players.find((player) => assignmentById.get(player.playerId).isBigBlind);

  if (resolved.ante.type === ANTE_TYPES.PER_PLAYER) {
    for (const player of players) {
      debit(player, resolved.ante.amountMilliBb, LEDGER_KINDS.ANTE, LEDGER_MOVEMENTS.STACK_TO_POT, true);
    }
  } else if (resolved.ante.type === ANTE_TYPES.BIG_BLIND) {
    debit(bigBlind, resolved.ante.amountMilliBb, LEDGER_KINDS.ANTE, LEDGER_MOVEMENTS.STACK_TO_POT, true);
  }

  const smallBlindPosted = debit(
    smallBlind,
    resolved.smallBlindMilliBb,
    LEDGER_KINDS.SMALL_BLIND,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    true,
  );
  smallBlind.streetContributionMilliBb += smallBlindPosted;

  const bigBlindPosted = debit(
    bigBlind,
    resolved.bigBlindMilliBb,
    LEDGER_KINDS.BIG_BLIND,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    true,
  );
  bigBlind.streetContributionMilliBb += bigBlindPosted;

  const dealOrder = playersClockwiseAfterSeat(players, buttonSeat)
    .concat(players.find((player) => player.seat === buttonSeat))
    .map((player) => player.playerId);
  const state = {
    schemaVersion: resolved.schemaVersion,
    handId: configuration.handId ?? null,
    ...(resolved.schemaVersion === POKER_STATE_V3_SCHEMA_VERSION ? { recordedSettlement: null } : {}),
    ...(resolved.rulesSnapshot === null ? {} : { rulesSnapshot: resolved.rulesSnapshot }),
    game: resolved.game,
    phase: PHASES.CHANCE,
    street: STREETS.PREFLOP,
    buttonSeat,
    actingPlayerId: null,
    board: [],
    deadCards: [],
    players,
    potMilliBb,
    deductionTotalMilliBb,
    currentBetMilliBb: resolved.bigBlindMilliBb,
    lastFullRaiseIncrementMilliBb: resolved.bigBlindMilliBb,
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

export function initializeHand(configuration) {
  if (!configuration || typeof configuration !== 'object') throw new TypeError('configuration is required');
  const { game } = configuration;
  const playerSeeds = validatePlayerSeeds(
    configuration.players,
    game && game.chipUnitMilliBb,
    POKER_STATE_SCHEMA_VERSION,
  );
  const forcedContributionPerPlayerMilliBb = validateGameConfiguration(
    game,
    playerSeeds.length,
  );

  return initializeResolvedHand(configuration, playerSeeds, {
    schemaVersion: POKER_STATE_SCHEMA_VERSION,
    rulesSnapshot: null,
    game: {
      variant: POKER_VARIANT,
      mode: game.mode,
      tableSize: playerSeeds.length,
      smallBlindMilliBb: game.smallBlindMilliBb,
      bigBlindMilliBb: game.bigBlindMilliBb,
      chipUnitMilliBb: game.chipUnitMilliBb,
      ante: {
        type: game.ante.type,
        amountMilliBb: game.ante.amountMilliBb,
      },
      forcedContributionPerPlayerMilliBb,
    },
    smallBlindMilliBb: game.smallBlindMilliBb,
    bigBlindMilliBb: game.bigBlindMilliBb,
    ante: game.ante,
    collectionAmountMilliBb: forcedContributionPerPlayerMilliBb,
    collectionLedgerKind: LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION,
    insufficientCollectionMessage: (player) => (
      `ClubGG player ${player.playerId} cannot pay exactly ${CLUBGG_FORCED_CONTRIBUTION_MILLI_BB} milliBb`
    ),
  });
}

const SNAPSHOT_INITIALIZATION_KEYS = new Set([
  'handId',
  'rulesSnapshot',
  'buttonSeat',
  'players',
]);

export function initializeHandFromGameRulesSnapshot(configuration) {
  if (configuration?.rulesSnapshot?.schemaVersion !== 'game-rules-snapshot/v1') {
    throw new RangeError('Live snapshot initialization requires GameRulesSnapshot v1');
  }
  return initializeSnapshotHand(configuration, POKER_STATE_V2_SCHEMA_VERSION);
}

export function initializeRecordedHand(configuration) {
  if (configuration?.rulesSnapshot?.schemaVersion !== 'game-rules-snapshot/v2') {
    throw new RangeError('Recorded hand initialization requires GameRulesSnapshot v2');
  }
  return initializeSnapshotHand(configuration, POKER_STATE_V3_SCHEMA_VERSION);
}

function initializeSnapshotHand(configuration, schemaVersion) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new TypeError('configuration is required');
  }
  const unknownKeys = Object.keys(configuration)
    .filter((key) => !SNAPSHOT_INITIALIZATION_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new RangeError(`Snapshot hand configuration has unsupported fields: ${unknownKeys.join(', ')}`);
  }

  const rulesSnapshot = normalizePokerStateRulesSnapshot(configuration.rulesSnapshot);
  const { definition } = rulesSnapshot;
  const playerSeeds = validatePlayerSeeds(
    configuration.players,
    definition.blinds.chipUnitMilliBb,
    schemaVersion,
  );
  if (rulesSnapshot.setup.seatedPlayers !== playerSeeds.length) {
    throw new RangeError('GameRulesSnapshot.setup.seatedPlayers must match the configured player count');
  }
  if (playerSeeds.length < definition.tableSize.minimumSeated
    || playerSeeds.length > definition.tableSize.maximumSeated) {
    throw new RangeError('Configured player count must fit the GameRulesSnapshot table-size policy');
  }

  let collectionAmountMilliBb = 0;
  if (definition.collectionPolicy.type === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    collectionAmountMilliBb = definition.collectionPolicy.amountMilliBb;
  } else if (definition.collectionPolicy.type !== GAME_RULES_COLLECTION_TYPES.NONE) {
    throw new RangeError(`Unsupported collection policy: ${definition.collectionPolicy.type}`);
  }

  return initializeResolvedHand(configuration, playerSeeds, {
    schemaVersion,
    rulesSnapshot,
    game: {
      variant: definition.variant,
      format: definition.format,
      tableSize: playerSeeds.length,
      smallBlindMilliBb: definition.blinds.smallBlindMilliBb,
      bigBlindMilliBb: definition.blinds.bigBlindMilliBb,
      chipUnitMilliBb: definition.blinds.chipUnitMilliBb,
      ante: {
        type: definition.ante.type,
        amountMilliBb: definition.ante.amountMilliBb,
      },
    },
    smallBlindMilliBb: definition.blinds.smallBlindMilliBb,
    bigBlindMilliBb: definition.blinds.bigBlindMilliBb,
    ante: definition.ante,
    collectionAmountMilliBb,
    collectionLedgerKind: LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
    insufficientCollectionMessage: (player) => (
      `Player ${player.playerId} cannot pay fixed collection of ${collectionAmountMilliBb} milliBb`
    ),
  });
}
