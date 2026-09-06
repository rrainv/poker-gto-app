import {
  CHANCE_TYPES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  initializeRecordedHand,
  applyRecordedSettlement,
  applyAction,
  applyChance,
  applyPrivateReveal,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  isHiddenHoleCards,
  resolveShowdown,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION = 'canonical-hand-replay-source/v1';
export const CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION = 'canonical-hand-replay-source/v2';
export const CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION = 'canonical-hand-replay-source/v3';
export const CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION = 'canonical-hand-replay-event/v1';
export const CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION = 'canonical-hand-replay-event/v2';
export const CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION = 'canonical-hand-replay-event/v3';
export const CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION = 'canonical-hand-replay-reconstruction/v1';

export const CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSIONS = Object.freeze([
  CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
]);

export const CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSIONS = Object.freeze([
  CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION,
]);

export const REPLAY_FRAME_OPERATIONS = Object.freeze({
  INITIALIZE_HAND: 'initialize_hand',
  DEAL_HOLE: 'deal_hole',
  DEAL_HOLE_OBSERVED: 'deal_hole_observed',
  REVEAL_HOLE: 'reveal_hole',
  DEAL_BOARD: 'deal_board',
  ACTION: 'action',
  SHOWDOWN: 'showdown',
  RECORDED_SETTLEMENT: 'recorded_settlement',
});

const SUPPORTED_OPERATIONS = new Set(Object.values(REPLAY_FRAME_OPERATIONS));
const REPLAY_VERSION_CONTRACTS = Object.freeze({
  [CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_V3_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_V3_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_V3_SCHEMA_VERSION,
    initialize: initializeRecordedHand,
  }),
  [CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_SCHEMA_VERSION,
    initialize: initializeHand,
  }),
  [CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION]: Object.freeze({
    sourceSchemaVersion: CANONICAL_HAND_REPLAY_SOURCE_V2_SCHEMA_VERSION,
    eventSchemaVersion: CANONICAL_HAND_REPLAY_EVENT_V2_SCHEMA_VERSION,
    pokerStateSchemaVersion: POKER_STATE_V2_SCHEMA_VERSION,
    initialize: initializeHandFromGameRulesSnapshot,
  }),
});
const REPLAY_VERSION_CONTRACT_VALUES = Object.freeze(Object.values(REPLAY_VERSION_CONTRACTS));

function replayContractForPokerStateVersion(schemaVersion) {
  return REPLAY_VERSION_CONTRACT_VALUES.find((contract) => (
    contract.pokerStateSchemaVersion === schemaVersion
  )) || null;
}

function replayContractForEventVersion(schemaVersion) {
  return REPLAY_VERSION_CONTRACT_VALUES.find((contract) => (
    contract.eventSchemaVersion === schemaVersion
  )) || null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return structuredClone(value);
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
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new RangeError(`${label} must contain exactly ${sortedExpected.join(', ')}`);
  }
}

function dataEquals(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => dataEquals(entry, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && dataEquals(left[key], right[key])
    ));
}

function requireSameState(actual, expected, label) {
  if (!dataEquals(actual, expected)) {
    throw new RangeError(`${label} does not reproduce the recorded canonical PokerState`);
  }
}

function validateInitialConfigurationShape(configuration, contract) {
  requireExactKeys(
    configuration,
    contract.pokerStateSchemaVersion === POKER_STATE_SCHEMA_VERSION
      ? ['handId', 'game', 'buttonSeat', 'players']
      : ['handId', 'rulesSnapshot', 'buttonSeat', 'players'],
    'Replay initialization configuration',
  );
  if (contract.pokerStateSchemaVersion === POKER_STATE_SCHEMA_VERSION) {
    requireExactKeys(
      configuration.game,
      ['mode', 'smallBlindMilliBb', 'bigBlindMilliBb', 'chipUnitMilliBb', 'ante'],
      'Replay initialization game',
    );
    requireExactKeys(
      configuration.game.ante,
      ['type', 'amountMilliBb'],
      'Replay initialization ante',
    );
  }
  if (!Array.isArray(configuration.players)) {
    throw new TypeError('Replay initialization players must be an array');
  }
  configuration.players.forEach((player, index) => requireExactKeys(
    player,
    ['playerId', 'seat', 'startingStackMilliBb'],
    `Replay initialization player[${index}]`,
  ));
}

function initialConfigurationFromState(state) {
  validatePokerState(state);
  const contract = replayContractForPokerStateVersion(state.schemaVersion);
  if (!contract) throw new TypeError(`Unsupported PokerState version: ${state.schemaVersion}`);
  const configuration = state.schemaVersion === POKER_STATE_SCHEMA_VERSION
    ? {
      handId: state.handId,
      game: {
        mode: state.game.mode,
        smallBlindMilliBb: state.game.smallBlindMilliBb,
        bigBlindMilliBb: state.game.bigBlindMilliBb,
        chipUnitMilliBb: state.game.chipUnitMilliBb,
        ante: clone(state.game.ante),
      },
      buttonSeat: state.buttonSeat,
      players: state.players.map((player) => ({
        playerId: player.playerId,
        seat: player.seat,
        startingStackMilliBb: player.startingStackMilliBb,
      })),
    }
    : {
      handId: state.handId,
      rulesSnapshot: state.rulesSnapshot,
      buttonSeat: state.buttonSeat,
      players: state.players.map((player) => ({
        playerId: player.playerId,
        seat: player.seat,
        startingStackMilliBb: player.startingStackMilliBb,
      })),
    };
  requireSameState(
    contract.initialize(configuration),
    state,
    'Replay initialization configuration',
  );
  return configuration;
}

function holeChanceEventFromStates(previousState, state, operation) {
  if (previousState.pendingChance?.type !== CHANCE_TYPES.DEAL_HOLE) {
    throw new RangeError('A private-deal Replay event requires pending deal_hole chance');
  }
  const cardsByPlayer = {};
  const hiddenPlayerIds = [];
  for (const player of state.players) {
    if (Array.isArray(player.holeCards)) cardsByPlayer[player.playerId] = [...player.holeCards];
    else if (isHiddenHoleCards(player.holeCards)) hiddenPlayerIds.push(player.playerId);
    else throw new RangeError('A private-deal Replay event must represent every dealt player');
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE && hiddenPlayerIds.length !== 0) {
    throw new RangeError('deal_hole Replay events cannot contain observer-hidden private cards');
  }
  if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED && hiddenPlayerIds.length === 0) {
    throw new RangeError('deal_hole_observed Replay events require at least one hidden private hand');
  }
  return {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer,
    hiddenPlayerIds,
  };
}

function boardChanceEventFromStates(previousState, state) {
  const type = previousState.pendingChance?.type;
  if (![CHANCE_TYPES.DEAL_FLOP, CHANCE_TYPES.DEAL_TURN, CHANCE_TYPES.DEAL_RIVER].includes(type)) {
    throw new RangeError('A board-deal Replay event requires a pending board chance event');
  }
  return {
    type,
    cards: state.board.slice(previousState.board.length),
  };
}

function actionFromStates(previousState, state) {
  if (state.actionHistory.length !== previousState.actionHistory.length + 1) {
    throw new RangeError('A Replay action event must append exactly one canonical action record');
  }
  return clone(state.actionHistory.at(-1).submittedAction);
}

function revealEventFromStates(previousState, state) {
  const revealed = previousState.players.filter((previousPlayer) => {
    const nextPlayer = state.players.find((player) => player.playerId === previousPlayer.playerId);
    return isHiddenHoleCards(previousPlayer.holeCards) && Array.isArray(nextPlayer?.holeCards);
  });
  if (revealed.length !== 1) {
    throw new RangeError('A Replay private-reveal event must reveal exactly one hidden private hand');
  }
  const playerId = revealed[0].playerId;
  return {
    playerId,
    cards: [...state.players.find((player) => player.playerId === playerId).holeCards],
  };
}

function createEvent(sequence, operation, payload, eventSchemaVersion) {
  const event = {
    schemaVersion: eventSchemaVersion,
    sequence,
    operation,
    payload,
  };
  validateEventEnvelope(event, sequence, eventSchemaVersion);
  return event;
}

function validateEventEnvelope(event, expectedSequence, expectedSchemaVersion) {
  requireExactKeys(
    event,
    ['schemaVersion', 'sequence', 'operation', 'payload'],
    `CanonicalHandReplayEvent[${expectedSequence}]`,
  );
  if (!CANONICAL_HAND_REPLAY_EVENT_SCHEMA_VERSIONS.includes(event.schemaVersion)) {
    throw new TypeError(`Unsupported CanonicalHandReplayEvent version: ${String(event.schemaVersion)}`);
  }
  if (event.schemaVersion !== expectedSchemaVersion) {
    throw new TypeError(`Expected ${expectedSchemaVersion}`);
  }
  if (event.sequence !== expectedSequence) {
    throw new RangeError('Canonical Hand Replay event sequence must be contiguous');
  }
  if (!SUPPORTED_OPERATIONS.has(event.operation)) {
    throw new RangeError(`Unsupported canonical Replay operation: ${event.operation}`);
  }
}

function applyReplayEvent(previousState, event, contract) {
  if (event.operation === REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT) {
    if (contract.pokerStateSchemaVersion !== POKER_STATE_V3_SCHEMA_VERSION) throw new RangeError('Recorded settlement requires Replay v3');
    if (previousState?.recordedSettlement !== null) throw new RangeError('Recorded settlement must occur exactly once after canonical progression');
    requireExactKeys(event.payload, ['evidence'], 'Replay recorded settlement');
    return applyRecordedSettlement(previousState, event.payload.evidence);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND) {
    if (previousState !== null || event.sequence !== 0) {
      throw new RangeError('Canonical Hand Replay must initialize exactly once at sequence 0');
    }
    requireExactKeys(event.payload, ['configuration'], 'Replay initialize payload');
    validateInitialConfigurationShape(event.payload.configuration, contract);
    return contract.initialize(event.payload.configuration);
  }
  if (previousState === null) {
    throw new RangeError('Canonical Hand Replay must begin with initialization');
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE
    || event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED) {
    requireExactKeys(event.payload, ['chanceEvent'], 'Replay private-deal payload');
    requireExactKeys(
      event.payload.chanceEvent,
      ['type', 'cardsByPlayer', 'hiddenPlayerIds'],
      'Replay private-deal chanceEvent',
    );
    const hiddenPlayerIds = event.payload.chanceEvent?.hiddenPlayerIds;
    if (event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE
      && (!Array.isArray(hiddenPlayerIds) || hiddenPlayerIds.length !== 0)) {
      throw new RangeError('deal_hole Replay events cannot contain hidden private hands');
    }
    if (event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
      && (!Array.isArray(hiddenPlayerIds) || hiddenPlayerIds.length === 0)) {
      throw new RangeError('deal_hole_observed Replay events require hidden private hands');
    }
    return applyChance(previousState, event.payload.chanceEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD) {
    requireExactKeys(event.payload, ['chanceEvent'], 'Replay board-deal payload');
    requireExactKeys(event.payload.chanceEvent, ['type', 'cards'], 'Replay board-deal chanceEvent');
    if (event.payload.chanceEvent?.type === CHANCE_TYPES.DEAL_HOLE) {
      throw new RangeError('A board-deal Replay event cannot deal private cards');
    }
    return applyChance(previousState, event.payload.chanceEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.ACTION) {
    requireExactKeys(event.payload, ['action'], 'Replay action payload');
    return applyAction(previousState, event.payload.action);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE) {
    requireExactKeys(event.payload, ['revealEvent'], 'Replay private-reveal payload');
    requireExactKeys(event.payload.revealEvent, ['playerId', 'cards'], 'Replay private-reveal event');
    return applyPrivateReveal(previousState, event.payload.revealEvent);
  }
  if (event.operation === REPLAY_FRAME_OPERATIONS.SHOWDOWN) {
    if (event.payload !== null) throw new RangeError('Replay showdown payload must be null');
    return resolveShowdown(previousState);
  }
  throw new RangeError(`Unsupported canonical Replay operation: ${event.operation}`);
}

function reconstruct(source) {
  requireExactKeys(source, ['schemaVersion', 'heroPlayerId', 'events'], 'CanonicalHandReplaySource');
  const contract = REPLAY_VERSION_CONTRACTS[source.schemaVersion];
  if (!contract) {
    throw new TypeError(`Unsupported CanonicalHandReplaySource version: ${String(source.schemaVersion)}`);
  }
  if (typeof source.heroPlayerId !== 'string' || !source.heroPlayerId.trim()) {
    throw new TypeError('CanonicalHandReplaySource.heroPlayerId is required');
  }
  if (!Array.isArray(source.events) || source.events.length === 0) {
    throw new RangeError('CanonicalHandReplaySource.events must begin with initialization');
  }

  let state = null;
  const frames = source.events.map((event, sequence) => {
    validateEventEnvelope(event, sequence, contract.eventSchemaVersion);
    state = applyReplayEvent(state, event, contract);
    validatePokerState(state);
    if (state.schemaVersion !== contract.pokerStateSchemaVersion) {
      throw new RangeError('Canonical Hand Replay state version does not match its source version');
    }
    if (!state.players.some((player) => player.playerId === source.heroPlayerId)) {
      throw new RangeError('Canonical Hand Replay Hero must remain seated in every state');
    }
    return {
      sequence,
      operation: event.operation,
      heroPlayerId: source.heroPlayerId,
      state,
    };
  });

  return {
    schemaVersion: CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION,
    heroPlayerId: source.heroPlayerId,
    frames,
    finalState: state,
  };
}

/**
 * Derive one durable canonical transition input from adjacent truthful PokerStates.
 * Presentation frames remain private to ReplayProjectionController.
 */
export function deriveCanonicalHandReplayEvent({
  sequence,
  operation,
  previousState = null,
  state,
} = {}) {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new RangeError('Canonical Hand Replay sequence must be a nonnegative integer');
  }
  validatePokerState(state);
  if (previousState !== null) validatePokerState(previousState);

  let payload;
  const contract = replayContractForPokerStateVersion(state.schemaVersion);
  if (!contract) throw new TypeError(`Unsupported PokerState version: ${state.schemaVersion}`);
  if (operation === REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND) {
    if (previousState !== null || sequence !== 0) {
      throw new RangeError('Replay initialization must be the first event');
    }
    payload = { configuration: initialConfigurationFromState(state) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE
    || operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED) {
    payload = { chanceEvent: holeChanceEventFromStates(previousState, state, operation) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.DEAL_BOARD) {
    payload = { chanceEvent: boardChanceEventFromStates(previousState, state) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.ACTION) {
    payload = { action: actionFromStates(previousState, state) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE) {
    payload = { revealEvent: revealEventFromStates(previousState, state) };
  } else if (operation === REPLAY_FRAME_OPERATIONS.SHOWDOWN) {
    payload = null;
  } else if (operation === REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT) {
    const { schemaVersion, grossPotMilliBb, rakeMilliBb, payoutsMilliBbByPlayer } = state.recordedSettlement;
    payload = { evidence: { schemaVersion, grossPotMilliBb, rakeMilliBb, payoutsMilliBbByPlayer } };
  } else {
    throw new RangeError(`Unsupported canonical Replay operation: ${operation}`);
  }

  if (previousState !== null && previousState.schemaVersion !== contract.pokerStateSchemaVersion) {
    throw new RangeError('Canonical Hand Replay cannot mix PokerState versions');
  }
  const event = createEvent(sequence, operation, payload, contract.eventSchemaVersion);
  requireSameState(
    applyReplayEvent(previousState, event, contract),
    state,
    `Canonical Hand Replay event ${sequence}`,
  );
  return deepFreeze(event);
}

export function createCanonicalHandReplaySource({ schemaVersion = null, heroPlayerId, events } = {}) {
  const inferredContract = replayContractForEventVersion(events?.[0]?.schemaVersion);
  const contract = schemaVersion === null
    ? inferredContract
    : REPLAY_VERSION_CONTRACTS[schemaVersion];
  if (!contract) {
    throw new TypeError(`Unsupported Canonical Hand Replay version: ${String(schemaVersion ?? events?.[0]?.schemaVersion)}`);
  }
  if (inferredContract !== contract) {
    throw new RangeError('Canonical Hand Replay source and event versions must agree');
  }
  const source = clone({
    schemaVersion: contract.sourceSchemaVersion,
    heroPlayerId,
    events,
  });
  reconstruct(source);
  return deepFreeze(source);
}

export function validateCanonicalHandReplaySource(source) {
  reconstruct(source);
  return source;
}

export function reconstructCanonicalHandReplaySource(source) {
  return deepFreeze(reconstruct(source));
}

export function canonicalPokerStatesEqual(left, right) {
  return dataEquals(left, right);
}
