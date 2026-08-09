import { assertMilliBbAlignment } from './amounts.js';
import { ACTION_TYPES, POKER_ACTION_SCHEMA_VERSION } from './schema.js';

const ACTION_TYPE_VALUES = Object.freeze(Object.values(ACTION_TYPES));
const SIZED_ACTIONS = new Set([ACTION_TYPES.BET, ACTION_TYPES.RAISE]);

export function validateAction(action, chipUnitMilliBb) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new TypeError('Action must be an object');
  }
  if (action.schemaVersion !== POKER_ACTION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${POKER_ACTION_SCHEMA_VERSION}`);
  }
  const keys = Object.keys(action).sort();
  const expectedKeys = ['amountToMilliBb', 'playerId', 'schemaVersion', 'type'];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError('Action v1 must contain exactly schemaVersion, playerId, type, and amountToMilliBb');
  }
  if (typeof action.playerId !== 'string' || !action.playerId.trim()) {
    throw new TypeError('action.playerId is required');
  }
  if (!ACTION_TYPE_VALUES.includes(action.type)) throw new RangeError('Unsupported action type');
  if (!Object.hasOwn(action, 'amountToMilliBb')) {
    throw new TypeError('action.amountToMilliBb is required');
  }

  if (SIZED_ACTIONS.has(action.type)) {
    assertMilliBbAlignment(action.amountToMilliBb, chipUnitMilliBb, 'action.amountToMilliBb');
    if (action.amountToMilliBb <= 0) throw new RangeError('action.amountToMilliBb must be positive');
  } else if (action.amountToMilliBb !== null) {
    throw new RangeError(`${action.type} must use amountToMilliBb: null`);
  }
  return action;
}

export function createAction(playerId, type, amountToMilliBb = null) {
  return Object.freeze({
    schemaVersion: POKER_ACTION_SCHEMA_VERSION,
    playerId,
    type,
    amountToMilliBb,
  });
}
