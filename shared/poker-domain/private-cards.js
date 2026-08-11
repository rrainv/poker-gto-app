import { deepFreeze } from './freeze.js';
import {
  HOLE_CARD_STATES,
  POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION,
} from './schema.js';

const HIDDEN_HOLE_CARD_KEYS = Object.freeze([
  'schemaVersion',
  'status',
  'cardCount',
]);

/**
 * A structural observer-level marker. It represents two physical cards that
 * were dealt but whose identities are not known in this PokerState.
 */
export function createHiddenHoleCards() {
  return deepFreeze({
    schemaVersion: POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION,
    status: HOLE_CARD_STATES.HIDDEN,
    cardCount: 2,
  });
}

export function isHiddenHoleCards(value) {
  return Boolean(value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.schemaVersion === POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION
    && value.status === HOLE_CARD_STATES.HIDDEN
    && value.cardCount === 2
    && Object.keys(value).length === HIDDEN_HOLE_CARD_KEYS.length
    && HIDDEN_HOLE_CARD_KEYS.every((key) => Object.hasOwn(value, key)));
}

export function validateHiddenHoleCards(value, label = 'holeCards') {
  if (!isHiddenHoleCards(value)) {
    throw new TypeError(`${label} must be a canonical dealt-but-hidden two-card marker`);
  }
  return value;
}

export function areHoleCardsDealt(holeCards) {
  return Array.isArray(holeCards) || isHiddenHoleCards(holeCards);
}

export function areHoleCardsKnown(holeCards) {
  return Array.isArray(holeCards);
}
