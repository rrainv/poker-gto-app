export const MILLI_BB_PER_BB = 1000;

export function assertMilliBb(value, label = 'amount') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer in milliBb`);
  }
  return value;
}

export function assertPositiveMilliBb(value, label = 'amount') {
  assertMilliBb(value, label);
  if (value === 0) throw new RangeError(`${label} must be greater than zero`);
  return value;
}

export function assertMilliBbAlignment(value, chipUnitMilliBb, label = 'amount') {
  assertMilliBb(value, label);
  assertPositiveMilliBb(chipUnitMilliBb, 'chipUnitMilliBb');
  if (value % chipUnitMilliBb !== 0) {
    throw new RangeError(`${label} must align to chipUnitMilliBb`);
  }
  return value;
}

export function bbToMilliBb(valueBb, label = 'amountBb') {
  if (typeof valueBb !== 'number' || !Number.isFinite(valueBb) || valueBb < 0) {
    throw new TypeError(`${label} must be a nonnegative finite number`);
  }

  const scaled = valueBb * MILLI_BB_PER_BB;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 1e-9) {
    throw new RangeError(`${label} cannot be represented exactly in integer milliBb`);
  }
  return rounded;
}

export function milliBbToBb(valueMilliBb, label = 'amountMilliBb') {
  return assertMilliBb(valueMilliBb, label) / MILLI_BB_PER_BB;
}
