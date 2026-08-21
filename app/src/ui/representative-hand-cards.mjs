import { isPreflopHandClass } from '../../../shared/poker-domain/index.js';

const SUITS = Object.freeze({
  s: Object.freeze({ id: 's', symbol: '♠', name: 'spades' }),
  h: Object.freeze({ id: 'h', symbol: '♥', name: 'hearts' }),
});

function representativeSuitIds(handClass) {
  if (handClass.length === 2 || handClass.endsWith('o')) return ['s', 'h'];
  return ['s', 's'];
}

export function representativeCardsForHandClass(handClass) {
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError('Representative cards require a canonical preflop hand class');
  }
  const ranks = [handClass[0], handClass[1]];
  const cards = ranks.map((rank, index) => {
    const suit = SUITS[representativeSuitIds(handClass)[index]];
    return Object.freeze({
      id: `${rank}${suit.id}`,
      rank,
      suitId: suit.id,
      suitSymbol: suit.symbol,
      accessibleLabel: `${rank === 'T' ? '10' : rank} of ${suit.name}`,
    });
  });
  const kind = handClass.length === 2 ? 'pair'
    : handClass.endsWith('s') ? 'suited' : 'offsuit';
  return Object.freeze({
    canonicalHandClass: handClass,
    kind,
    cards: Object.freeze(cards),
    accessibleLabel: `${handClass}, ${kind}, represented by ${cards.map((card) => card.accessibleLabel).join(' and ')}`,
  });
}
