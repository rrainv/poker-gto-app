// Pure Training Memory row formatting shared by the Training Memory panel
// (logic.js) and Saved Training history. It only formats already-frozen
// DecisionContext facts; it computes no poker, strategy, or Equity.

export const TRAINING_MEMORY_ROW_FORMAT_SCHEMA_VERSION = 'training-memory-row-format/v1';

const MODE_LABEL_KEYS = Object.freeze({
  varied: 'Varied',
  focused: 'Focused',
  full_hand: 'Full Hand',
  review: 'Review',
});

export function trainingMemoryModeLabelKey(mode) {
  return MODE_LABEL_KEYS[mode] || mode;
}

export function formatTrainingMemoryDate(isoTimestamp, locale = 'en') {
  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoTimestamp));
  } catch (_) {
    return String(isoTimestamp || '');
  }
}

// Returns the two lines the Memory decision row shows: cards/board and the spot line.
export function trainingMemoryContextSummary(context, translate) {
  const t = typeof translate === 'function' ? translate : (value) => value;
  const board = context.board?.length ? context.board.join(' ') : t('Preflop');
  const spotParts = Object.freeze([
    t(context.street.charAt(0).toUpperCase() + context.street.slice(1)),
    context.heroPosition,
    Number.isFinite(context.effectiveStackBb)
      ? `${t('Effective stack')} ${context.effectiveStackBb} bb`
      : null,
    Number.isFinite(context.currentPotBb) ? `${t('Pot')} ${context.currentPotBb} bb` : null,
    Number.isFinite(context.callAmountBb) && context.callAmountBb > 0
      ? `${t('Facing')} ${context.callAmountBb} bb`
      : null,
  ].filter(Boolean));
  return Object.freeze({
    cards: `${context.heroCards.join(' ')} · ${board}`,
    spot: spotParts.join(' · '),
    // The same facts as separate strings, for renderers that isolate each fact (RTL).
    spotParts,
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineTrainingMemoryFormat', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: TRAINING_MEMORY_ROW_FORMAT_SCHEMA_VERSION,
      modeLabelKey: trainingMemoryModeLabelKey,
      formatDate: formatTrainingMemoryDate,
      contextSummary: trainingMemoryContextSummary,
    }),
    writable: false,
  });
}
