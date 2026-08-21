import {
  ACTION_TYPES,
  STREETS,
  getLegalActionSpec,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const FULL_HAND_TRAINING_SIZING_MODEL_SCHEMA_VERSION =
  'full-hand-training-sizing-model/v1';
export const FULL_HAND_TRAINING_SIZING_VALIDATION_SCHEMA_VERSION =
  'full-hand-training-sizing-validation/v1';

export const FULL_HAND_TRAINING_SIZING_INPUT_ERRORS = Object.freeze({
  REQUIRED: 'required',
  INVALID_FORMAT: 'invalid_format',
  UNSUPPORTED_PRECISION: 'unsupported_precision',
  ACTION_UNAVAILABLE: 'action_unavailable',
  BELOW_MINIMUM: 'below_minimum',
  ABOVE_MAXIMUM: 'above_maximum',
  CHIP_UNIT_MISALIGNED: 'chip_unit_misaligned',
});

const SIZED_ACTION_TYPES = Object.freeze([ACTION_TYPES.BET, ACTION_TYPES.RAISE]);
const PREFLOP_OPEN_TARGETS = Object.freeze([
  ['open-2-2', '2.2 bb', 2.2],
  ['open-2-5', '2.5 bb', 2.5],
  ['open-3', '3 bb', 3],
  ['open-3-5', '3.5 bb', 3.5],
]);
const PREFLOP_RERAISE_TARGETS = Object.freeze([
  ['reraise-2-25x', '2.25×', 2.25],
  ['reraise-3x', '3×', 3],
  ['reraise-4x', '4×', 4],
]);
const POSTFLOP_TARGETS = Object.freeze([
  ['pot-33', '33% pot', 0.33],
  ['pot-50', '50% pot', 0.5],
  ['pot-66', '66% pot', 0.66],
  ['pot-75', '75% pot', 0.75],
  ['pot-100', 'Pot', 1],
  ['pot-150', '150% pot', 1.5],
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function roundToChipUnit(rawAmountMilliBb, chipUnitMilliBb) {
  return Math.round(rawAmountMilliBb / chipUnitMilliBb) * chipUnitMilliBb;
}

function clampToCanonicalBounds(amountMilliBb, bounds) {
  return Math.max(bounds.minToMilliBb, Math.min(bounds.maxToMilliBb, amountMilliBb));
}

function adjustmentReason(rawAmountMilliBb, roundedAmountMilliBb, amountToMilliBb, bounds) {
  if (roundedAmountMilliBb < bounds.minToMilliBb) return 'clamped_to_canonical_minimum';
  if (roundedAmountMilliBb > bounds.maxToMilliBb) return 'clamped_to_canonical_maximum';
  return roundedAmountMilliBb !== rawAmountMilliBb ? 'rounded_to_chip_unit' : null;
}

function amountPreset({
  presetId,
  label,
  rawAmountMilliBb,
  chipUnitMilliBb,
  bounds,
  actionType,
}) {
  const roundedAmountMilliBb = roundToChipUnit(rawAmountMilliBb, chipUnitMilliBb);
  const amountToMilliBb = clampToCanonicalBounds(roundedAmountMilliBb, bounds);
  return {
    presetId,
    label,
    kind: 'amount_to',
    actionType,
    rawAmountMilliBb,
    roundedAmountMilliBb,
    amountToMilliBb,
    valueBb: milliBbToFullHandInputValue(amountToMilliBb),
    adjustmentReason: adjustmentReason(
      rawAmountMilliBb,
      roundedAmountMilliBb,
      amountToMilliBb,
      bounds,
    ),
  };
}

function preflopHasPriorVoluntaryAction(state) {
  return state.actionHistory.some((record) => (
    record.street === STREETS.PREFLOP
    && record.submittedAction.type !== ACTION_TYPES.FOLD
  ));
}

function presetCandidates(state, legalActions, actionType, bounds) {
  const chipUnitMilliBb = state.game.chipUnitMilliBb;
  const candidates = [amountPreset({
    presetId: 'minimum',
    label: 'Min',
    rawAmountMilliBb: bounds.minToMilliBb,
    chipUnitMilliBb,
    bounds,
    actionType,
  })];

  if (state.street === STREETS.PREFLOP) {
    const isOpen = state.currentBetMilliBb === state.game.bigBlindMilliBb
      && !preflopHasPriorVoluntaryAction(state);
    const targets = isOpen ? PREFLOP_OPEN_TARGETS : PREFLOP_RERAISE_TARGETS;
    for (const [presetId, label, multiple] of targets) {
      candidates.push(amountPreset({
        presetId,
        label,
        rawAmountMilliBb: (isOpen ? state.game.bigBlindMilliBb : state.currentBetMilliBb)
          * multiple,
        chipUnitMilliBb,
        bounds,
        actionType,
      }));
    }
  } else {
    const raisePotBasisMilliBb = state.potMilliBb + legalActions.call.commitMilliBb;
    for (const [presetId, label, fraction] of POSTFLOP_TARGETS) {
      const rawAmountMilliBb = actionType === ACTION_TYPES.BET
        ? state.potMilliBb * fraction
        : state.currentBetMilliBb + raisePotBasisMilliBb * fraction;
      candidates.push(amountPreset({
        presetId,
        label,
        rawAmountMilliBb,
        chipUnitMilliBb,
        bounds,
        actionType,
      }));
    }
  }

  if (legalActions.allIn.available) {
    candidates.push({
      presetId: 'all-in',
      label: 'All-in',
      kind: 'all_in',
      actionType: ACTION_TYPES.ALL_IN,
      rawAmountMilliBb: legalActions.allIn.amountToMilliBb,
      roundedAmountMilliBb: legalActions.allIn.amountToMilliBb,
      amountToMilliBb: legalActions.allIn.amountToMilliBb,
      valueBb: milliBbToFullHandInputValue(legalActions.allIn.amountToMilliBb),
      adjustmentReason: null,
    });
  }

  const seenActions = new Set();
  return candidates.filter((preset) => {
    const identity = `${preset.actionType}:${preset.amountToMilliBb}`;
    if (seenActions.has(identity)) return false;
    seenActions.add(identity);
    return true;
  });
}

export function milliBbToFullHandInputValue(amountMilliBb) {
  if (!Number.isSafeInteger(amountMilliBb) || amountMilliBb < 0) {
    throw new RangeError('amountMilliBb must be a nonnegative safe integer');
  }
  const whole = Math.floor(amountMilliBb / 1000);
  const fraction = String(amountMilliBb % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function actionSizingModel(state, legalActions, actionType) {
  const bounds = legalActions[actionType];
  if (!bounds.available) return null;
  return deepFreeze({
    actionType,
    semantics: 'amount_to',
    minToMilliBb: bounds.minToMilliBb,
    maxToMilliBb: bounds.maxToMilliBb,
    initialAmountToMilliBb: bounds.minToMilliBb,
    minValueBb: milliBbToFullHandInputValue(bounds.minToMilliBb),
    maxValueBb: milliBbToFullHandInputValue(bounds.maxToMilliBb),
    initialValueBb: milliBbToFullHandInputValue(bounds.minToMilliBb),
    stepValueBb: milliBbToFullHandInputValue(state.game.chipUnitMilliBb),
    presets: presetCandidates(state, legalActions, actionType, bounds),
  });
}

export function createFullHandTrainingSizingModel(state) {
  validatePokerState(state);
  const legalActions = getLegalActionSpec(state);
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_SIZING_MODEL_SCHEMA_VERSION,
    semantics: 'amount_to',
    playerId: legalActions.playerId,
    street: state.street,
    chipUnitMilliBb: state.game.chipUnitMilliBb,
    potMilliBb: state.potMilliBb,
    currentWagerMilliBb: state.currentBetMilliBb,
    callAmountMilliBb: legalActions.call.toCallMilliBb,
    callCommitMilliBb: legalActions.call.commitMilliBb,
    allInAmountToMilliBb: legalActions.allIn.amountToMilliBb,
    actions: {
      bet: actionSizingModel(state, legalActions, ACTION_TYPES.BET),
      raise: actionSizingModel(state, legalActions, ACTION_TYPES.RAISE),
    },
  });
}

function invalidValidation(actionType, errorCode, sizing = null, amountToMilliBb = null) {
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_SIZING_VALIDATION_SCHEMA_VERSION,
    valid: false,
    actionType,
    amountToMilliBb,
    actionInput: null,
    errorCode,
    sizing,
  });
}

function parseBbInput(inputValue) {
  const value = typeof inputValue === 'number' ? String(inputValue) : String(inputValue ?? '').trim();
  if (!value) return { errorCode: FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.REQUIRED };
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return { errorCode: FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.INVALID_FORMAT };
  }
  const [wholeDigits, fractionDigits = ''] = value.split('.');
  const significantFraction = fractionDigits.replace(/0+$/, '');
  if (significantFraction.length > 3) {
    return { errorCode: FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.UNSUPPORTED_PRECISION };
  }
  const whole = Number(wholeDigits);
  const fraction = Number(significantFraction.padEnd(3, '0') || 0);
  const amountToMilliBb = whole * 1000 + fraction;
  if (!Number.isSafeInteger(amountToMilliBb)) {
    return { errorCode: FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.INVALID_FORMAT };
  }
  return { amountToMilliBb };
}

export function validateFullHandTrainingSizingInput(state, actionType, inputValue) {
  validatePokerState(state);
  const model = createFullHandTrainingSizingModel(state);
  if (!SIZED_ACTION_TYPES.includes(actionType) || !model.actions[actionType]) {
    return invalidValidation(
      actionType,
      FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.ACTION_UNAVAILABLE,
    );
  }
  const sizing = model.actions[actionType];
  const parsed = parseBbInput(inputValue);
  if (parsed.errorCode) return invalidValidation(actionType, parsed.errorCode, sizing);
  const { amountToMilliBb } = parsed;
  if (amountToMilliBb < sizing.minToMilliBb) {
    return invalidValidation(
      actionType,
      FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.BELOW_MINIMUM,
      sizing,
      amountToMilliBb,
    );
  }
  if (amountToMilliBb > sizing.maxToMilliBb) {
    return invalidValidation(
      actionType,
      FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.ABOVE_MAXIMUM,
      sizing,
      amountToMilliBb,
    );
  }
  if (amountToMilliBb % model.chipUnitMilliBb !== 0) {
    return invalidValidation(
      actionType,
      FULL_HAND_TRAINING_SIZING_INPUT_ERRORS.CHIP_UNIT_MISALIGNED,
      sizing,
      amountToMilliBb,
    );
  }
  return deepFreeze({
    schemaVersion: FULL_HAND_TRAINING_SIZING_VALIDATION_SCHEMA_VERSION,
    valid: true,
    actionType,
    amountToMilliBb,
    actionInput: {
      type: actionType,
      amountToMilliBb,
    },
    errorCode: null,
    sizing,
  });
}
