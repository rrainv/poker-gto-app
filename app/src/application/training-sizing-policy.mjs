import { ACTION_TYPES, STREETS } from '../../../shared/poker-domain/schema.js';

export const TRAINING_SIZING_FAMILY_SCHEMA_VERSION = 'training-sizing-family/v1';
export const TRAINING_SIZING_POLICY_VERSION = 'training-sizing-policy/v1';

export const TRAINING_SIZING_FAMILIES = Object.freeze({
  MINIMUM: 'minimum',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  OVERBET: 'overbet',
  ALL_IN: 'all_in',
});

export const TRAINING_PREFLOP_SIZING_FAMILIES = Object.freeze([
  TRAINING_SIZING_FAMILIES.MINIMUM,
  TRAINING_SIZING_FAMILIES.SMALL,
  TRAINING_SIZING_FAMILIES.MEDIUM,
  TRAINING_SIZING_FAMILIES.LARGE,
  TRAINING_SIZING_FAMILIES.ALL_IN,
]);

export const TRAINING_POSTFLOP_SIZING_FAMILIES = Object.freeze([
  TRAINING_SIZING_FAMILIES.SMALL,
  TRAINING_SIZING_FAMILIES.MEDIUM,
  TRAINING_SIZING_FAMILIES.LARGE,
  TRAINING_SIZING_FAMILIES.OVERBET,
  TRAINING_SIZING_FAMILIES.ALL_IN,
]);

const PREFLOP_FACING_TARGETS = new Set([
  'preflop_facing_open',
  'preflop_facing_3bet',
  'preflop_facing_4bet',
]);
const POSTFLOP_FACING_TARGETS = new Set([
  'postflop_facing_bet',
  'postflop_facing_raise',
]);
const SIZING_FAMILY_VALUES = Object.freeze(Object.values(TRAINING_SIZING_FAMILIES));

function roundToChipUnit(rawTargetMilliBb, chipUnitMilliBb) {
  return Math.round(rawTargetMilliBb / chipUnitMilliBb) * chipUnitMilliBb;
}

function allInStructurallyEligible({
  targetDecisionType,
  startingStackBb,
  tableSize,
}) {
  if (targetDecisionType === 'preflop_facing_open') return startingStackBb <= 15;
  if (targetDecisionType === 'preflop_facing_3bet') return startingStackBb <= 30;
  if (targetDecisionType === 'preflop_facing_4bet') return startingStackBb <= 50;

  // The postflop guard uses only planner-owned structural facts. It is a
  // conservative generation policy, not poker advice. The generator checks
  // the actual canonical pot/legal state before realizing the family.
  if (targetDecisionType === 'postflop_facing_bet') {
    return startingStackBb - 1 <= tableSize * 2;
  }
  if (targetDecisionType === 'postflop_facing_raise') {
    return startingStackBb - 1 <= (tableSize + 2) * 2;
  }
  return false;
}

function structuralProxyTargets({
  street,
  targetDecisionType,
  startingStackBb,
  tableSize,
  chipUnitMilliBb,
}) {
  const maximumNonAllInTo = startingStackBb * 1000 - chipUnitMilliBb;
  if (street === STREETS.PREFLOP) {
    const currentWagerMilliBb = targetDecisionType === 'preflop_facing_open'
      ? 1000
      : targetDecisionType === 'preflop_facing_3bet' ? 2000 : 3000;
    const minimumToMilliBb = targetDecisionType === 'preflop_facing_open'
      ? 2000
      : currentWagerMilliBb + 1000;
    const rawByFamily = targetDecisionType === 'preflop_facing_open'
      ? {
          [TRAINING_SIZING_FAMILIES.MINIMUM]: minimumToMilliBb,
          [TRAINING_SIZING_FAMILIES.SMALL]: 2200,
          [TRAINING_SIZING_FAMILIES.MEDIUM]: 2500,
          [TRAINING_SIZING_FAMILIES.LARGE]: 3500,
        }
      : {
          [TRAINING_SIZING_FAMILIES.MINIMUM]: minimumToMilliBb,
          [TRAINING_SIZING_FAMILIES.SMALL]: currentWagerMilliBb * 2.25,
          [TRAINING_SIZING_FAMILIES.MEDIUM]: currentWagerMilliBb * 3,
          [TRAINING_SIZING_FAMILIES.LARGE]: currentWagerMilliBb * 4,
        };
    return Object.fromEntries(Object.entries(rawByFamily).map(([family, raw]) => [
      family,
      Math.max(minimumToMilliBb, Math.min(
        maximumNonAllInTo,
        roundToChipUnit(raw, chipUnitMilliBb),
      )),
    ]));
  }

  const potProxyMilliBb = tableSize * 1000;
  const fractionByFamily = {
    [TRAINING_SIZING_FAMILIES.SMALL]: 0.33,
    [TRAINING_SIZING_FAMILIES.MEDIUM]: 0.66,
    [TRAINING_SIZING_FAMILIES.LARGE]: 1,
    [TRAINING_SIZING_FAMILIES.OVERBET]: 1.5,
  };
  const isRaise = targetDecisionType === 'postflop_facing_raise';
  const currentWagerMilliBb = isRaise ? 1000 : 0;
  const minimumToMilliBb = isRaise ? 2000 : 1000;
  const basisMilliBb = isRaise ? potProxyMilliBb + 2000 : potProxyMilliBb;
  return Object.fromEntries(Object.entries(fractionByFamily).map(([family, fraction]) => [
    family,
    Math.max(minimumToMilliBb, Math.min(
      maximumNonAllInTo,
      roundToChipUnit(currentWagerMilliBb + basisMilliBb * fraction, chipUnitMilliBb),
    )),
  ]));
}

export function trainingSizingFamilyAppliesToTarget(street, targetDecisionType) {
  return street === STREETS.PREFLOP
    ? PREFLOP_FACING_TARGETS.has(targetDecisionType)
    : POSTFLOP_FACING_TARGETS.has(targetDecisionType);
}

export function trainingSizingFamiliesForStructure({
  street,
  targetDecisionType,
  startingStackBb,
  tableSize,
  chipUnitMilliBb,
}) {
  if (!trainingSizingFamilyAppliesToTarget(street, targetDecisionType)) return Object.freeze([]);
  const ordered = street === STREETS.PREFLOP
    ? TRAINING_PREFLOP_SIZING_FAMILIES
    : TRAINING_POSTFLOP_SIZING_FAMILIES;
  const proxyTargets = structuralProxyTargets({
    street,
    targetDecisionType,
    startingStackBb,
    tableSize,
    chipUnitMilliBb,
  });
  const seen = new Set();
  const distinct = [];
  for (const family of ordered) {
    if (family === TRAINING_SIZING_FAMILIES.ALL_IN) {
      if (allInStructurallyEligible({ targetDecisionType, startingStackBb, tableSize })) {
        distinct.push(family);
      }
      continue;
    }
    const amount = proxyTargets[family];
    if (!Number.isSafeInteger(amount) || amount <= 0 || seen.has(amount)) continue;
    seen.add(amount);
    distinct.push(family);
  }
  return Object.freeze(distinct);
}

export function validateTrainingSizingFamily(family, { nullable = false } = {}) {
  if (nullable && family === null) return family;
  if (!SIZING_FAMILY_VALUES.includes(family)) {
    throw new RangeError(`Unsupported Training sizing family: ${String(family)}`);
  }
  return family;
}

function rawTargetForFamily(state, spec, actionType, family) {
  if (family === TRAINING_SIZING_FAMILIES.ALL_IN) {
    return spec.allIn.amountToMilliBb;
  }
  if (family === TRAINING_SIZING_FAMILIES.MINIMUM) {
    return actionType === ACTION_TYPES.BET ? spec.bet.minToMilliBb : spec.raise.minToMilliBb;
  }
  if (state.street === STREETS.PREFLOP) {
    if (state.currentBetMilliBb === state.game.bigBlindMilliBb) {
      return {
        [TRAINING_SIZING_FAMILIES.SMALL]: 2.2,
        [TRAINING_SIZING_FAMILIES.MEDIUM]: 2.5,
        [TRAINING_SIZING_FAMILIES.LARGE]: 3.5,
      }[family] * state.game.bigBlindMilliBb;
    }
    return {
      [TRAINING_SIZING_FAMILIES.SMALL]: 2.25,
      [TRAINING_SIZING_FAMILIES.MEDIUM]: 3,
      [TRAINING_SIZING_FAMILIES.LARGE]: 4,
    }[family] * state.currentBetMilliBb;
  }

  const fraction = {
    [TRAINING_SIZING_FAMILIES.SMALL]: 0.33,
    [TRAINING_SIZING_FAMILIES.MEDIUM]: 0.66,
    [TRAINING_SIZING_FAMILIES.LARGE]: 1,
    [TRAINING_SIZING_FAMILIES.OVERBET]: 1.5,
  }[family];
  if (actionType === ACTION_TYPES.BET) {
    return state.potMilliBb * fraction;
  }
  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  const toCallMilliBb = state.currentBetMilliBb - actor.streetContributionMilliBb;
  const potAfterCallMilliBb = state.potMilliBb + toCallMilliBb;
  return state.currentBetMilliBb + potAfterCallMilliBb * fraction;
}

function realizeOne(state, spec, actionType, family) {
  if (family === TRAINING_SIZING_FAMILIES.ALL_IN) {
    if (!spec.allIn.available) throw new RangeError('Canonical all-in action is unavailable');
    return {
      requestedSizingFamily: family,
      realizedSizingFamily: family,
      actionType: ACTION_TYPES.ALL_IN,
      rawTargetMilliBb: spec.allIn.amountToMilliBb,
      roundedTargetMilliBb: spec.allIn.amountToMilliBb,
      realizedLegalAmountToMilliBb: spec.allIn.amountToMilliBb,
      adjustmentReason: null,
      deduplicationReason: null,
    };
  }
  const bounds = actionType === ACTION_TYPES.BET ? spec.bet : spec.raise;
  if (!bounds.available) throw new RangeError(`Canonical ${actionType} action is unavailable`);
  const rawTargetMilliBb = rawTargetForFamily(state, spec, actionType, family);
  if (!Number.isFinite(rawTargetMilliBb)) {
    throw new RangeError(`${family} does not support this Training sizing structure`);
  }
  const roundedTargetMilliBb = roundToChipUnit(
    rawTargetMilliBb,
    state.game.chipUnitMilliBb,
  );
  const realizedLegalAmountToMilliBb = Math.max(
    bounds.minToMilliBb,
    Math.min(bounds.maxToMilliBb, roundedTargetMilliBb),
  );
  const adjustmentReason = roundedTargetMilliBb < bounds.minToMilliBb
    ? 'clamped_to_canonical_minimum'
    : roundedTargetMilliBb > bounds.maxToMilliBb
      ? 'clamped_to_canonical_maximum_non_all_in'
      : roundedTargetMilliBb !== rawTargetMilliBb ? 'rounded_to_chip_unit' : null;
  return {
    requestedSizingFamily: family,
    realizedSizingFamily: family,
    actionType,
    rawTargetMilliBb,
    roundedTargetMilliBb,
    realizedLegalAmountToMilliBb,
    adjustmentReason,
    deduplicationReason: null,
  };
}

export function realizeCanonicalTrainingSizing({
  state,
  legalActionSpec,
  actionType,
  requestedSizingFamily,
  eligibleSizingFamilies,
}) {
  validateTrainingSizingFamily(requestedSizingFamily);
  const allowed = eligibleSizingFamilies.map((family) => validateTrainingSizingFamily(family));
  if (!allowed.includes(requestedSizingFamily)) {
    throw new RangeError(`Requested sizing family is structurally ineligible: ${requestedSizingFamily}`);
  }
  const realizedByFamily = new Map();
  const firstFamilyByActionAmount = new Map();
  for (const family of allowed) {
    const realization = realizeOne(state, legalActionSpec, actionType, family);
    const identity = `${realization.actionType}:${realization.realizedLegalAmountToMilliBb}`;
    if (firstFamilyByActionAmount.has(identity)) {
      realizedByFamily.set(family, {
        ...realization,
        realizedSizingFamily: null,
        deduplicationReason: `collapsed_to_${firstFamilyByActionAmount.get(identity)}`,
      });
    } else {
      firstFamilyByActionAmount.set(identity, family);
      realizedByFamily.set(family, realization);
    }
  }
  return Object.freeze({
    requested: Object.freeze(realizedByFamily.get(requestedSizingFamily)),
    distinctFamilies: Object.freeze([...firstFamilyByActionAmount.values()]),
  });
}
