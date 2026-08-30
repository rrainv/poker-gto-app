import { HAND_CATEGORIES, isPreflopHandClass } from '../../../shared/poker-domain/index.js';
import { deriveExactHandFacts } from './range-analysis.mjs';
import { RANGE_CARD_REMOVAL_PROJECTION_VERSION } from './range-card-removal.mjs';

export const RANGE_COMPARISON_FACTS_SCHEMA_VERSION = 'range-comparison-facts/v1';

export const RANGE_COMPARISON_CELL_STATES = Object.freeze({
  ELIGIBLE_REPRESENTATIVE: 'eligible_representative',
  FULLY_REMOVED: 'fully_removed',
  NOT_IN_SAMPLE: 'not_in_sample',
});

export const RANGE_COMPARISON_CATEGORIES = Object.freeze({
  VERY_STRONG: 'very_strong_made',
  STRONG_MADE: 'strong_made',
  MARGINAL_OR_DRAW: 'marginal_or_draw',
  AIR: 'air',
});

const VERY_STRONG_CATEGORIES = new Set([
  HAND_CATEGORIES.STRAIGHT,
  HAND_CATEGORIES.FLUSH,
  HAND_CATEGORIES.FULL_HOUSE,
  HAND_CATEGORIES.FOUR_OF_A_KIND,
  HAND_CATEGORIES.STRAIGHT_FLUSH,
]);
const STRONG_MADE_CATEGORIES = new Set([
  HAND_CATEGORIES.TWO_PAIR,
  HAND_CATEGORIES.THREE_OF_A_KIND,
]);

function freezeRecord(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeRecord);
  return Object.freeze(value);
}

function categoryForExactFacts(exactFacts) {
  if (VERY_STRONG_CATEGORIES.has(exactFacts.primaryCategory)) {
    return RANGE_COMPARISON_CATEGORIES.VERY_STRONG;
  }
  if (STRONG_MADE_CATEGORIES.has(exactFacts.primaryCategory)) {
    return RANGE_COMPARISON_CATEGORIES.STRONG_MADE;
  }
  if (exactFacts.primaryCategory === HAND_CATEGORIES.ONE_PAIR) {
    return RANGE_COMPARISON_CATEGORIES.MARGINAL_OR_DRAW;
  }
  const draws = exactFacts.draws;
  if (draws?.flushDraw || draws?.straightFlushDraw || draws?.openEndedStraightDraw
    || draws?.gutshot || draws?.doubleGutshot) {
    return RANGE_COMPARISON_CATEGORIES.MARGINAL_OR_DRAW;
  }
  return RANGE_COMPARISON_CATEGORIES.AIR;
}

function assertInput({ handClasses, sampleHandClasses, board, cardRemoval }) {
  if (!Array.isArray(handClasses) || !handClasses.every(isPreflopHandClass)) {
    throw new TypeError('handClasses must contain canonical preflop hand classes');
  }
  if (!Array.isArray(sampleHandClasses) || !sampleHandClasses.every(isPreflopHandClass)) {
    throw new TypeError('sampleHandClasses must contain canonical preflop hand classes');
  }
  if (new Set(handClasses).size !== handClasses.length
    || new Set(sampleHandClasses).size !== sampleHandClasses.length) {
    throw new RangeError('handClasses and sampleHandClasses must not contain duplicates');
  }
  const availableClasses = new Set(handClasses);
  if (!sampleHandClasses.every((handClass) => availableClasses.has(handClass))) {
    throw new RangeError('sampleHandClasses must be included in handClasses');
  }
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    throw new RangeError('board must contain three to five canonical cards');
  }
  if (cardRemoval?.schemaVersion !== RANGE_CARD_REMOVAL_PROJECTION_VERSION) {
    throw new TypeError(`cardRemoval must be a ${RANGE_CARD_REMOVAL_PROJECTION_VERSION}`);
  }
}

/**
 * Classifies exactly one canonical surviving combo per included hand class.
 * Shares describe those representatives only; they do not generalize the
 * representative category to every surviving physical combo in the class.
 */
export function createRepresentativeRangeComparisonFacts({
  handClasses,
  sampleHandClasses,
  board,
  cardRemoval,
} = {}) {
  assertInput({ handClasses, sampleHandClasses, board, cardRemoval });
  const sample = new Set(sampleHandClasses);
  const categoryCounts = {
    [RANGE_COMPARISON_CATEGORIES.VERY_STRONG]: 0,
    [RANGE_COMPARISON_CATEGORIES.STRONG_MADE]: 0,
    [RANGE_COMPARISON_CATEGORIES.MARGINAL_OR_DRAW]: 0,
    [RANGE_COMPARISON_CATEGORIES.AIR]: 0,
  };
  let eligibleRepresentativeCount = 0;
  let fullyRemovedCount = 0;
  const cells = {};

  for (const handClass of handClasses) {
    if (!sample.has(handClass)) {
      cells[handClass] = { handClass, state: RANGE_COMPARISON_CELL_STATES.NOT_IN_SAMPLE, category: null, representativeCombo: null };
      continue;
    }
    const removal = cardRemoval.cells[handClass];
    if (!removal || removal.fullyRemoved || !removal.firstEligibleCombo) {
      fullyRemovedCount += 1;
      cells[handClass] = { handClass, state: RANGE_COMPARISON_CELL_STATES.FULLY_REMOVED, category: null, representativeCombo: null };
      continue;
    }

    const representativeCombo = [...removal.firstEligibleCombo];
    const deadCards = cardRemoval.blockers.filter((card) => (
      !board.includes(card) && !representativeCombo.includes(card)
    ));
    const exactFacts = deriveExactHandFacts({ heroCards: representativeCombo, board, deadCards });
    const category = categoryForExactFacts(exactFacts);
    categoryCounts[category] += 1;
    eligibleRepresentativeCount += 1;
    cells[handClass] = {
      handClass,
      state: RANGE_COMPARISON_CELL_STATES.ELIGIBLE_REPRESENTATIVE,
      category,
      representativeCombo,
      exactFactCategory: exactFacts.primaryCategory,
      drawTags: [...(exactFacts.draws?.tags || [])],
    };
  }

  const categoryShares = Object.fromEntries(Object.entries(categoryCounts).map(([category, count]) => [
    category,
    eligibleRepresentativeCount ? count / eligibleRepresentativeCount : null,
  ]));

  return freezeRecord({
    schemaVersion: RANGE_COMPARISON_FACTS_SCHEMA_VERSION,
    basis: 'one_canonical_surviving_combo_per_eligible_sampled_class',
    generalizesToEveryComboInClass: false,
    normalization: { available: false, reason: 'representative_class_sample_has_no_combo_weights' },
    coverage: {
      suppliedSampleClassCount: sample.size,
      eligibleRepresentativeCount,
      fullyRemovedSampleClassCount: fullyRemovedCount,
      notInSampleClassCount: handClasses.length - sample.size,
    },
    categoryCounts,
    categoryShares,
    cells,
  });
}
