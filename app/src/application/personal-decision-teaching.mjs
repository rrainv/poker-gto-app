import { isCard } from '../../../shared/poker-domain/index.js';

// A bounded, descriptive example for confirmed qualitative intent. Never a
// replay, range weight, observed-action import, or substitute DecisionContext.
export function createPersonalDecisionExample(context, source) {
  if (context?.schemaVersion !== 'decision-context/v1'
    || !['Analyze', 'Training', 'Review'].includes(source)
    || !['preflop', 'flop', 'turn', 'river'].includes(context.street)
    || context.heroCards?.length !== 2 || !context.heroCards.every(isCard)
    || !Array.isArray(context.board) || context.board.length !== { preflop: 0, flop: 3, turn: 4, river: 5 }[context.street] || !context.board.every(isCard)
    || new Set([...context.heroCards, ...context.board]).size !== 2 + context.board.length
    || !Number.isInteger(context.tableSize) || context.tableSize < 2 || context.tableSize > 10
    || typeof context.heroPosition !== 'string') throw new TypeError('Decision example unavailable');
  return Object.freeze({ source, street: context.street, heroPosition: context.heroPosition,
    tableSize: context.tableSize, heroCards: Object.freeze([...context.heroCards]), board: Object.freeze([...context.board]),
    currentPotBb: Number.isFinite(context.currentPotBb) ? context.currentPotBb : null,
    effectiveStackBb: Number.isFinite(context.effectiveStackBb) ? context.effectiveStackBb : null,
    callAmountBb: Number.isFinite(context.callAmountBb) ? context.callAmountBb : null });
}

export function describePersonalDecisionExample(example, t = key => key) {
  return [t(example.source), t({ preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' }[example.street]),
    `${example.tableSize}-max`, example.heroPosition, example.heroCards.join(' '), example.board.join(' '),
    example.currentPotBb === null ? null : `${t('Pot')}: ${example.currentPotBb} bb`,
    example.effectiveStackBb === null ? null : `${t('Effective stack')}: ${example.effectiveStackBb} bb`,
    example.callAmountBb === null ? null : `${t('Call')}: ${example.callAmountBb} bb`].filter(Boolean).join(' · ');
}
