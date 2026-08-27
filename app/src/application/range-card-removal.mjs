import {
  HOLDEM_RANGE_ENTRY_STATES,
  HOLDEM_RANGE_UNLISTED_POLICIES,
  PREFLOP_HAND_CLASSES,
  conditionHoldemRange,
  createHoldemWeightedRangeFromHandClassWeights,
  getHoldemComboById,
  getHoldemCombosForHandClass,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';

export const RANGE_CARD_REMOVAL_PROJECTION_VERSION = 'range-card-removal-projection/v1';

const COMPLETE_HAND_CLASS_RANGE = createHoldemWeightedRangeFromHandClassWeights({
  rangeId: 'riverline-presentation-card-removal',
  handClassWeights: Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, 1])),
  unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
});

function cloneCombo(combo) {
  return combo ? Object.freeze([...combo.cards]) : null;
}

/**
 * Presentation projection over canonical Range Core blocker conditioning.
 * Known burned/excluded cards use DecisionContext.deadCards and therefore arrive
 * here in `blockers`; this module intentionally does not define a second removal rule.
 */
export function projectPreflopHandClassesAfterCardRemoval({
  handClasses = PREFLOP_HAND_CLASSES,
  blockers = [],
} = {}) {
  if (!Array.isArray(handClasses) || !handClasses.every(isPreflopHandClass)) {
    throw new TypeError('handClasses must contain canonical preflop hand classes');
  }
  if (new Set(handClasses).size !== handClasses.length) {
    throw new RangeError('handClasses must not contain duplicates');
  }

  const conditioned = conditionHoldemRange(COMPLETE_HAND_CLASS_RANGE, blockers);
  const requested = new Set(handClasses);
  const eligibleByClass = new Map(handClasses.map((handClass) => [handClass, []]));

  for (const entry of conditioned.eligibleEntries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN || entry.weight <= 0) continue;
    const combo = getHoldemComboById(entry.comboId);
    if (requested.has(combo.handClass)) eligibleByClass.get(combo.handClass).push(combo);
  }

  const cells = Object.fromEntries(handClasses.map((handClass) => {
    const eligible = eligibleByClass.get(handClass);
    const physicalComboCount = getHoldemCombosForHandClass(handClass).length;
    return [handClass, Object.freeze({
      handClass,
      physicalComboCount,
      eligibleComboCount: eligible.length,
      blockedComboCount: physicalComboCount - eligible.length,
      fullyRemoved: eligible.length === 0,
      firstEligibleCombo: cloneCombo(eligible[0]),
    })];
  }));

  return Object.freeze({
    schemaVersion: RANGE_CARD_REMOVAL_PROJECTION_VERSION,
    blockers: Object.freeze([...conditioned.blockers]),
    cells: Object.freeze(cells),
  });
}

