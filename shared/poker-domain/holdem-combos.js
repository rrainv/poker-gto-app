import {
  CARD_RANKS,
  CARD_SUITS,
  assertCard,
  assertCardArray,
} from './cards.js';
import {
  PREFLOP_HAND_CLASSES,
  isPreflopHandClass,
  preflopHandClassForCards,
} from './hand-class.js';
import { deepFreeze } from './freeze.js';

export const HOLDEM_COMBO_SCHEMA_VERSION = 'holdem-hole-card-combo/v1';
export const HOLDEM_COMBO_ID_PREFIX = 'holdem-combo/v1:';

/**
 * Canonical structural card order: rank 2 through A, then suit s, h, d, c.
 * This order is persistence-relevant for Hold'em combo IDs and enumeration.
 */
export const HOLDEM_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

const CARD_INDEX = new Map(HOLDEM_DECK.map((card, index) => [card, index]));

export function compareHoldemCards(left, right) {
  assertCard(left, 'left card');
  assertCard(right, 'right card');
  return CARD_INDEX.get(left) - CARD_INDEX.get(right);
}

function canonicalCards(cards) {
  assertCardArray(cards, 'Holdem combo cards');
  if (cards.length !== 2) throw new RangeError('A Holdem combo requires exactly two cards');
  if (cards[0] === cards[1]) throw new RangeError('A Holdem combo cannot repeat one physical card');
  return [...cards].sort(compareHoldemCards);
}

function comboIdForCanonicalCards(cards) {
  return `${HOLDEM_COMBO_ID_PREFIX}${cards[0]}:${cards[1]}`;
}

const combos = [];
for (let first = 0; first < HOLDEM_DECK.length - 1; first += 1) {
  for (let second = first + 1; second < HOLDEM_DECK.length; second += 1) {
    const cards = Object.freeze([HOLDEM_DECK[first], HOLDEM_DECK[second]]);
    combos.push(deepFreeze({
      schemaVersion: HOLDEM_COMBO_SCHEMA_VERSION,
      id: comboIdForCanonicalCards(cards),
      cards,
      handClass: preflopHandClassForCards(cards),
    }));
  }
}

export const HOLDEM_COMBOS = Object.freeze(combos);

const COMBO_BY_ID = new Map(HOLDEM_COMBOS.map((combo) => [combo.id, combo]));
const COMBO_BY_HAND_CLASS = new Map(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, []]));
for (const combo of HOLDEM_COMBOS) COMBO_BY_HAND_CLASS.get(combo.handClass).push(combo);
for (const handClass of PREFLOP_HAND_CLASSES) {
  COMBO_BY_HAND_CLASS.set(handClass, Object.freeze(COMBO_BY_HAND_CLASS.get(handClass)));
}

export function isHoldemComboId(value) {
  return typeof value === 'string' && COMBO_BY_ID.has(value);
}

export function assertHoldemComboId(value, label = 'comboId') {
  if (!isHoldemComboId(value)) throw new RangeError(`${label} is not a canonical Holdem combo ID`);
  return value;
}

export function getHoldemComboById(comboId) {
  assertHoldemComboId(comboId);
  return COMBO_BY_ID.get(comboId);
}

export function getHoldemComboForCards(cards) {
  const ordered = canonicalCards(cards);
  return COMBO_BY_ID.get(comboIdForCanonicalCards(ordered));
}

export function holdemComboIdForCards(cards) {
  return getHoldemComboForCards(cards).id;
}

export function getHoldemCombosForHandClass(handClass) {
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
  }
  return COMBO_BY_HAND_CLASS.get(handClass);
}
