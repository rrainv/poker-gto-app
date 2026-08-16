import {
  ACTION_TYPES,
  CHANCE_TYPES,
  PHASES,
  POKER_STATE_SCHEMA_VERSION,
  areHoleCardsDealt,
  isHiddenHoleCards,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const TABLE_PRESENCE_SCHEMA_VERSION = 'table-presence/v1';

const ACTION_AMOUNT_KINDS = Object.freeze({
  NONE: 'none',
  COMMITTED: 'committed',
  AMOUNT_TO: 'amount_to',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function cardPresentation(card) {
  return {
    id: card,
    rank: card.slice(0, -1),
    suit: card.slice(-1),
  };
}

function trustedPlayerName(player) {
  for (const candidate of [player.presentationName, player.displayName, player.name]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function actionPresentation(record) {
  if (!record) return null;
  const type = record.submittedAction.type;
  let amountKind = ACTION_AMOUNT_KINDS.NONE;
  let amountMilliBb = null;

  if (type === ACTION_TYPES.CALL) {
    amountKind = ACTION_AMOUNT_KINDS.COMMITTED;
    amountMilliBb = record.committedMilliBb;
  } else if (type === ACTION_TYPES.BET || type === ACTION_TYPES.RAISE) {
    amountKind = ACTION_AMOUNT_KINDS.AMOUNT_TO;
    amountMilliBb = record.submittedAction.amountToMilliBb;
  } else if (type === ACTION_TYPES.ALL_IN) {
    amountKind = ACTION_AMOUNT_KINDS.AMOUNT_TO;
    amountMilliBb = record.currentBetAfterMilliBb;
  }

  return {
    sequence: record.sequence,
    street: record.street,
    type,
    amountKind,
    amountMilliBb,
    wasAllIn: record.wasAllIn,
  };
}

function phaseStatus(state) {
  if (state.phase === PHASES.TERMINAL || state.terminal?.isTerminal) return 'terminal';
  if (state.phase === PHASES.SHOWDOWN) return 'showdown';
  if (state.phase === PHASES.BETTING) return 'active';
  if (state.pendingChance?.type === 'deal_hole') return 'awaiting_private_cards';
  if (state.phase === PHASES.CHANCE) return 'awaiting_board';
  return 'unavailable';
}

function shouldShowStreetContributions(state) {
  // Blinds are already canonical street contributions while private cards are pending.
  // After that, PokerState's phase boundary is the sole authority: a board chance,
  // showdown, or terminal state means the betting round has been closed.
  return state.phase === PHASES.BETTING
    || (state.phase === PHASES.CHANCE
      && state.pendingChance?.type === CHANCE_TYPES.DEAL_HOLE);
}

function emptyModel() {
  return deepFreeze({
    schemaVersion: TABLE_PRESENCE_SCHEMA_VERSION,
    mode: 'hand',
    empty: true,
    status: 'empty',
    street: null,
    phase: null,
    pendingChance: null,
    showStreetContributions: false,
    board: [],
    potMilliBb: 0,
    buttonSeat: null,
    currentActorSeat: null,
    heroSeat: null,
    seats: [],
  });
}

/**
 * Project one trusted PokerState into immutable, presentation-only table facts.
 * The result keeps canonical amounts in milliBb and never derives poker rules.
 */
export function createTablePresenceViewModel({ state = null, heroPlayerId = null } = {}) {
  if (state === null || state === undefined) return emptyModel();
  if (state?.schemaVersion !== POKER_STATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION}`);
  }
  validatePokerState(state);
  if (typeof heroPlayerId !== 'string' || !heroPlayerId.trim()) {
    throw new TypeError('heroPlayerId is required for a canonical Hand table');
  }

  const canonicalSeats = [...state.players].sort((left, right) => left.seat - right.seat);
  const heroOrdinal = canonicalSeats.findIndex((player) => player.playerId === heroPlayerId);
  if (heroOrdinal < 0) throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);

  const latestCurrentStreetActionByPlayer = new Map();
  [...state.actionHistory]
    .filter((record) => record.street === state.street)
    .sort((left, right) => left.sequence - right.sequence)
    .forEach((record) => latestCurrentStreetActionByPlayer.set(record.playerId, record));

  const seats = canonicalSeats.map((player, ordinal) => {
    const isHero = player.playerId === heroPlayerId;
    const isCurrentActor = state.phase === PHASES.BETTING
      && player.playerId === state.actingPlayerId;
    const knownCards = Array.isArray(player.holeCards)
      ? player.holeCards.map(cardPresentation)
      : [];
    const cardVisibility = Array.isArray(player.holeCards)
      ? 'known'
      : isHiddenHoleCards(player.holeCards) ? 'hidden' : 'undealt';
    const suppliedName = trustedPlayerName(player);

    return {
      playerId: player.playerId,
      seat: player.seat,
      visualSeatIndex: (ordinal - heroOrdinal + canonicalSeats.length) % canonicalSeats.length,
      suppliedName,
      identity: suppliedName || (isHero ? 'Hero' : player.position || `Player ${player.seat + 1}`),
      position: player.position || null,
      isHero,
      isButton: player.seat === state.buttonSeat,
      isCurrentActor,
      isWaitingToAct: isCurrentActor,
      isFolded: player.folded === true,
      isAllIn: player.dealtIn === true && player.folded !== true && player.currentStackMilliBb === 0,
      isDealtIn: player.dealtIn === true,
      currentStackMilliBb: player.currentStackMilliBb,
      startingStackMilliBb: player.startingStackMilliBb,
      streetContributionMilliBb: player.streetContributionMilliBb,
      totalPotContributionMilliBb: player.totalPotContributionMilliBb,
      cardVisibility,
      hasCards: areHoleCardsDealt(player.holeCards),
      cards: knownCards,
      latestAction: actionPresentation(latestCurrentStreetActionByPlayer.get(player.playerId)),
    };
  });

  const actor = canonicalSeats.find((player) => player.playerId === state.actingPlayerId) || null;
  const hero = canonicalSeats[heroOrdinal];

  return deepFreeze({
    schemaVersion: TABLE_PRESENCE_SCHEMA_VERSION,
    mode: 'hand',
    empty: false,
    status: phaseStatus(state),
    street: state.street,
    phase: state.phase,
    pendingChance: state.pendingChance === null ? null : {
      type: state.pendingChance.type,
      cardCount: state.pendingChance.cardCount,
    },
    showStreetContributions: shouldShowStreetContributions(state),
    board: state.board.map(cardPresentation),
    potMilliBb: state.potMilliBb,
    buttonSeat: state.buttonSeat,
    currentActorSeat: state.phase === PHASES.BETTING ? actor?.seat ?? null : null,
    heroSeat: hero.seat,
    seats,
  });
}
