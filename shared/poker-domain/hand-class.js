import { CARD_RANKS, isCard } from './cards.js';

export const PREFLOP_MATRIX_RANKS = Object.freeze([...CARD_RANKS].reverse());

export function preflopHandClassAt(row, column) {
  if (!Number.isInteger(row) || !Number.isInteger(column)
    || row < 0 || column < 0
    || row >= PREFLOP_MATRIX_RANKS.length || column >= PREFLOP_MATRIX_RANKS.length) {
    throw new RangeError('Preflop hand-class coordinates must be integers from 0 through 12');
  }
  const rowRank = PREFLOP_MATRIX_RANKS[row];
  const columnRank = PREFLOP_MATRIX_RANKS[column];
  if (row === column) return `${rowRank}${columnRank}`;
  return row < column
    ? `${rowRank}${columnRank}s`
    : `${columnRank}${rowRank}o`;
}

export const PREFLOP_HAND_CLASSES = Object.freeze(
  PREFLOP_MATRIX_RANKS.flatMap((_, row) => (
    PREFLOP_MATRIX_RANKS.map((__, column) => preflopHandClassAt(row, column))
  )),
);

const PREFLOP_HAND_CLASS_SET = new Set(PREFLOP_HAND_CLASSES);

export function isPreflopHandClass(value) {
  return typeof value === 'string' && PREFLOP_HAND_CLASS_SET.has(value);
}

export function preflopHandClassForCards(cards) {
  if (!Array.isArray(cards) || cards.length !== 2 || !cards.every(isCard)) {
    throw new TypeError('Preflop hand-class derivation requires exactly two canonical cards');
  }
  const [first, second] = cards;
  if (first === second) throw new RangeError('Preflop hand-class cards must be distinct');
  const firstIndex = PREFLOP_MATRIX_RANKS.indexOf(first[0]);
  const secondIndex = PREFLOP_MATRIX_RANKS.indexOf(second[0]);
  if (firstIndex === secondIndex) return `${first[0]}${second[0]}`;
  const high = firstIndex < secondIndex ? first : second;
  const low = firstIndex < secondIndex ? second : first;
  return `${high[0]}${low[0]}${first[1] === second[1] ? 's' : 'o'}`;
}
