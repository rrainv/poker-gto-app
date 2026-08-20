import {
  ACTION_TYPES,
  CHANCE_TYPES,
  PHASES,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSIONS,
  POKER_STATE_V2_SCHEMA_VERSION,
  STREETS,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const REPLAY_TIMELINE_SCHEMA_VERSION = 'replay-timeline/v1';

const STREET_ORDER = Object.freeze([
  STREETS.PREFLOP,
  STREETS.FLOP,
  STREETS.TURN,
  STREETS.RIVER,
]);

const ACTION_PRESENTATION = Object.freeze({
  [ACTION_TYPES.FOLD]: Object.freeze({
    amountKind: 'none',
    actionFamily: 'fold',
    actionLabelKey: 'replay.action.fold',
  }),
  [ACTION_TYPES.CHECK]: Object.freeze({
    amountKind: 'none',
    actionFamily: 'passive',
    actionLabelKey: 'replay.action.check',
  }),
  [ACTION_TYPES.CALL]: Object.freeze({
    amountKind: 'committed',
    actionFamily: 'passive',
    actionLabelKey: 'replay.action.call',
  }),
  [ACTION_TYPES.BET]: Object.freeze({
    amountKind: 'amount_to',
    actionFamily: 'aggressive',
    actionLabelKey: 'replay.action.betTo',
  }),
  [ACTION_TYPES.RAISE]: Object.freeze({
    amountKind: 'amount_to',
    actionFamily: 'aggressive',
    actionLabelKey: 'replay.action.raiseTo',
  }),
  [ACTION_TYPES.ALL_IN]: Object.freeze({
    amountKind: 'amount_to',
    actionFamily: 'all_in',
    actionLabelKey: 'replay.action.allInTo',
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function trustedPlayerName(player) {
  for (const candidate of [player.presentationName, player.displayName, player.name]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function playerPresentation(player, heroPlayerId) {
  const isHero = player.playerId === heroPlayerId;
  const suppliedName = trustedPlayerName(player);
  return {
    playerId: player.playerId,
    seat: player.seat,
    identity: suppliedName || (isHero ? 'hero' : player.playerId),
    identityKind: suppliedName ? 'supplied_name' : isHero ? 'hero' : 'player',
    suppliedName,
    position: player.position || null,
    isHero,
  };
}

function actionAmountMilliBb(record, actionType) {
  if (actionType === ACTION_TYPES.CALL) return record.committedMilliBb;
  if (actionType === ACTION_TYPES.BET || actionType === ACTION_TYPES.RAISE) {
    return record.submittedAction.amountToMilliBb;
  }
  if (actionType === ACTION_TYPES.ALL_IN) return record.streetContributionAfterMilliBb;
  return null;
}

function actionEntry(record, playersById, heroPlayerId) {
  const player = playersById.get(record.playerId);
  const sourceActionType = record.submittedAction?.type;
  const presentation = ACTION_PRESENTATION[sourceActionType] || {
    amountKind: 'none',
    actionFamily: 'unknown',
    actionLabelKey: 'replay.action.unknown',
  };

  return {
    sequence: record.sequence,
    street: record.street,
    ...playerPresentation(player, heroPlayerId),
    actionType: ACTION_PRESENTATION[sourceActionType] ? sourceActionType : 'unknown',
    sourceActionType: ACTION_PRESENTATION[sourceActionType] ? null : String(sourceActionType || ''),
    actionFamily: presentation.actionFamily,
    actionLabelKey: presentation.actionLabelKey,
    amountKind: presentation.amountKind,
    amountMilliBb: actionAmountMilliBb(record, sourceActionType),
    wasAllIn: record.wasAllIn === true,
  };
}

function markerActor(state, playersById, heroPlayerId) {
  if (state.phase !== PHASES.BETTING) return null;
  const actor = playersById.get(state.actingPlayerId);
  return actor ? playerPresentation(actor, heroPlayerId) : null;
}

function currentMarker(state, playersById, heroPlayerId) {
  if (state.phase === PHASES.TERMINAL || state.terminal?.isTerminal) {
    return {
      kind: 'terminal',
      street: state.street,
      targetStreet: null,
      labelKey: 'replay.marker.terminal',
      actor: null,
    };
  }
  if (state.phase === PHASES.SHOWDOWN) {
    const revealRequired = state.showdown?.status === 'awaiting_private_reveal';
    return {
      kind: revealRequired ? 'reveal_required' : 'showdown',
      street: state.street,
      targetStreet: null,
      labelKey: revealRequired ? 'replay.marker.revealRequired' : 'replay.marker.showdown',
      actor: null,
    };
  }
  if (state.phase === PHASES.BETTING) {
    return {
      kind: 'current_decision',
      street: state.street,
      targetStreet: null,
      labelKey: 'replay.marker.currentDecision',
      actor: markerActor(state, playersById, heroPlayerId),
    };
  }
  if (state.pendingChance?.type === CHANCE_TYPES.DEAL_HOLE) {
    return {
      kind: 'awaiting_private_cards',
      street: state.street,
      targetStreet: null,
      labelKey: 'replay.marker.awaitingPrivateCards',
      actor: null,
    };
  }

  const targetStreet = {
    [CHANCE_TYPES.DEAL_FLOP]: STREETS.FLOP,
    [CHANCE_TYPES.DEAL_TURN]: STREETS.TURN,
    [CHANCE_TYPES.DEAL_RIVER]: STREETS.RIVER,
  }[state.pendingChance?.type] || null;
  return {
    kind: targetStreet ? `awaiting_${targetStreet}` : 'unavailable',
    street: state.street,
    targetStreet,
    labelKey: targetStreet ? 'replay.marker.awaitingStreet' : 'replay.marker.unavailable',
    actor: null,
  };
}

function emptyModel() {
  return deepFreeze({
    schemaVersion: REPLAY_TIMELINE_SCHEMA_VERSION,
    mode: 'hand',
    empty: true,
    emptyState: 'not_started',
    handId: null,
    currentStreet: null,
    phase: null,
    status: 'empty',
    entryCount: 0,
    groups: [],
    currentMarker: {
      kind: 'empty',
      street: null,
      targetStreet: null,
      labelKey: 'replay.marker.empty',
      actor: null,
    },
  });
}

/**
 * Project one trusted PokerState into immutable, presentation-only Replay facts.
 * Canonical actionHistory is the sole action authority; no actions or amounts are inferred.
 */
export function createReplayTimelineViewModel({ state = null, heroPlayerId = null } = {}) {
  if (state === null || state === undefined) return emptyModel();
  if (!POKER_STATE_SCHEMA_VERSIONS.includes(state?.schemaVersion)) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`);
  }
  validatePokerState(state);
  if (typeof heroPlayerId !== 'string' || !heroPlayerId.trim()) {
    throw new TypeError('heroPlayerId is required for a canonical Hand timeline');
  }

  const playersById = new Map(state.players.map((player) => [player.playerId, player]));
  if (!playersById.has(heroPlayerId)) {
    throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);
  }

  const entries = [...state.actionHistory]
    .sort((left, right) => left.sequence - right.sequence)
    .map((record) => actionEntry(record, playersById, heroPlayerId));
  const groups = STREET_ORDER.map((street) => {
    const streetEntries = entries.filter((entry) => entry.street === street);
    if (streetEntries.length === 0 && street !== state.street) return null;
    return {
      street,
      headingKey: `replay.street.${street}`,
      isCurrentStreet: street === state.street,
      entries: streetEntries,
    };
  }).filter(Boolean);
  const marker = currentMarker(state, playersById, heroPlayerId);
  const status = marker.kind === 'current_decision' ? 'active' : marker.kind;

  return deepFreeze({
    schemaVersion: REPLAY_TIMELINE_SCHEMA_VERSION,
    mode: 'hand',
    empty: false,
    emptyState: entries.length === 0 ? 'no_voluntary_actions' : null,
    handId: typeof state.handId === 'string' ? state.handId : null,
    currentStreet: state.street,
    phase: state.phase,
    status,
    entryCount: entries.length,
    groups,
    currentMarker: marker,
  });
}
