export const CARD_CLEAR_SEMANTICS_SCHEMA_VERSION = 'card-clear-semantics/v1';

export const CARD_CLEAR_COMMANDS = Object.freeze({
  CLEAR_HERO: 'clear_hero',
  CLEAR_PLAYER_HAND: 'clear_player_hand',
  CLEAR_FLOP: 'clear_flop',
  CLEAR_TURN: 'clear_turn',
  CLEAR_RIVER: 'clear_river',
  CLEAR_BOARD: 'clear_board',
  CLEAR_DEAD_SET: 'clear_dead_set',
  CLEAR_DEAD_CARD: 'clear_dead_card',
  CLEAR_ALL_EDITABLE: 'clear_all_editable',
  CLEAR_PENDING_CARD_SET: 'clear_pending_card_set',
});

const SUPPORTED_COMMANDS = new Set(Object.values(CARD_CLEAR_COMMANDS));

function requireCardArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function cardClearOperations(command, targets = {}) {
  if (!SUPPORTED_COMMANDS.has(command)) throw new RangeError(`Unsupported card-clear command: ${command}`);
  switch (command) {
    case CARD_CLEAR_COMMANDS.CLEAR_HERO:
      return [{ cards: requireCardArray(targets.hero, 'hero'), keep: 0 }];
    case CARD_CLEAR_COMMANDS.CLEAR_PLAYER_HAND:
      return [{ cards: requireCardArray(targets.playerHand, 'playerHand'), keep: 0 }];
    case CARD_CLEAR_COMMANDS.CLEAR_FLOP:
    case CARD_CLEAR_COMMANDS.CLEAR_BOARD:
      return [{ cards: requireCardArray(targets.board, 'board'), keep: 0 }];
    case CARD_CLEAR_COMMANDS.CLEAR_TURN:
      return [{ cards: requireCardArray(targets.board, 'board'), keep: 3 }];
    case CARD_CLEAR_COMMANDS.CLEAR_RIVER:
      return [{ cards: requireCardArray(targets.board, 'board'), keep: 4 }];
    case CARD_CLEAR_COMMANDS.CLEAR_DEAD_SET:
      return [{ cards: requireCardArray(targets.dead, 'dead'), keep: 0 }];
    case CARD_CLEAR_COMMANDS.CLEAR_DEAD_CARD: {
      const dead = requireCardArray(targets.dead, 'dead');
      const cardIndex = targets.deadCardId
        ? dead.indexOf(targets.deadCardId)
        : Number(targets.deadCardIndex);
      return Number.isInteger(cardIndex) && cardIndex >= 0 && cardIndex < dead.length
        ? [{ cards: dead, removeIndex: cardIndex }]
        : [];
    }
    case CARD_CLEAR_COMMANDS.CLEAR_PENDING_CARD_SET:
      return [{ cards: requireCardArray(targets.pending, 'pending'), keep: 0 }];
    case CARD_CLEAR_COMMANDS.CLEAR_ALL_EDITABLE: {
      return [
        targets.hero,
        targets.board,
        targets.dead,
        targets.playerHand,
        targets.pending,
        ...(Array.isArray(targets.playerHands) ? targets.playerHands : []),
      ].filter((cards) => cards !== undefined && cards !== null)
        .map((cards, index) => ({
          cards: requireCardArray(cards, `editable card set ${index}`),
          keep: 0,
        }));
    }
    default:
      return [];
  }
}

export function editableCardClearWouldChange(command, targets = {}) {
  return cardClearOperations(command, targets).some(({ cards, keep, removeIndex }) => (
    Number.isInteger(removeIndex) || cards.length > keep
  ));
}

export function applyEditableCardClear(command, targets = {}) {
  const operations = cardClearOperations(command, targets);
  const changed = operations.some(({ cards, keep, removeIndex }) => (
    Number.isInteger(removeIndex) || cards.length > keep
  ));
  operations.forEach(({ cards, keep, removeIndex }) => {
    if (Number.isInteger(removeIndex)) cards.splice(removeIndex, 1);
    else if (cards.length > keep) cards.length = keep;
  });

  return Object.freeze({
    schemaVersion: CARD_CLEAR_SEMANTICS_SCHEMA_VERSION,
    command,
    changed,
  });
}

export function installCardClearSemanticsBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: CARD_CLEAR_SEMANTICS_SCHEMA_VERSION,
    commands: CARD_CLEAR_COMMANDS,
    applyEditableCardClear,
    editableCardClearWouldChange,
  });
  Object.defineProperty(browserWindow, 'RiverlineCardClearSemantics', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installCardClearSemanticsBridge(window);
