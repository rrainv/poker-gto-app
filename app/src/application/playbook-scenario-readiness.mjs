import { isCard } from '../../../shared/poker-domain/index.js';

export const PLAYBOOK_SCENARIO_READINESS_SCHEMA_VERSION =
  'playbook-scenario-readiness/v1';

const STREETS = Object.freeze(['preflop', 'flop', 'turn', 'river']);
const PREFLOP_ACTIONS = Object.freeze(new Set([
  'unopened', 'check', 'limp', 'call', 'raise', '3bet', '4bet',
]));
const POSTFLOP_ACTIONS = Object.freeze(new Set(['check', 'call', 'bet', 'raise']));
const AGGRESSIVE_ACTIONS = Object.freeze(new Set(['bet', 'raise', '3bet', '4bet']));

const REASON_MESSAGES = Object.freeze({
  turn_requires_flop: 'Add the flop before choosing a turn card.',
  river_requires_turn: 'Add the turn before choosing a river card.',
  flop_incomplete: 'Choose all three flop cards before requesting strategy.',
  invalid_board_chronology: 'Complete the board in order: flop, then turn, then river.',
  hero_cards_incomplete: 'Choose both Hero cards before requesting strategy.',
  invalid_card: 'Choose valid cards for this spot.',
  duplicate_known_card: 'Each known card can appear only once.',
  unsupported_action: 'Choose a supported prior action for this spot.',
  action_not_valid_for_street: 'This action does not match the current street.',
  facing_amount_invalid: 'Use a non-negative number for the amount to call.',
  facing_amount_without_aggression:
    'Clear the amount to call or choose a facing bet or raise.',
  aggression_requires_facing_amount: 'Add the amount to call for this facing action.',
  pot_invalid: 'Use a non-negative number for the pot.',
  stack_invalid: 'Use a positive number for the stack.',
  table_size_invalid: 'Choose a table size from 2 to 10 players.',
  hero_position_missing: 'Choose Hero\'s position before requesting strategy.',
  scenario_input_invalid:
    'This spot is still incomplete, so Riverline won\'t give strategy advice yet.',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function populated(card) {
  return card !== null && card !== undefined && card !== '';
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function playbookScenarioStreetFromBoard(board) {
  if (!Array.isArray(board)) return 'invalid';
  const slots = board.slice(0, 5);
  const anyBeyondRiver = board.slice(5).some(populated);
  if (anyBeyondRiver) return 'invalid';
  const present = slots.map(populated);
  if (!present.some(Boolean)) return 'preflop';
  if (present[0] && present[1] && present[2] && !present[3] && !present[4]) return 'flop';
  if (present[0] && present[1] && present[2] && present[3] && !present[4]) return 'turn';
  if (present[0] && present[1] && present[2] && present[3] && present[4]) return 'river';
  return 'invalid';
}

function reason(code, fields) {
  return {
    code,
    fields: Object.freeze([...fields]),
    message: REASON_MESSAGES[code] ?? REASON_MESSAGES.scenario_input_invalid,
  };
}

function chronologyReasons(board) {
  if (!Array.isArray(board)) return [reason('invalid_board_chronology', ['board'])];
  const slots = board.slice(0, 5);
  const present = slots.map(populated);
  const reasons = [];
  if (present[4] && !present[3]) reasons.push(reason('river_requires_turn', ['board']));
  if (present[3] && !(present[0] && present[1] && present[2])) {
    reasons.push(reason('turn_requires_flop', ['board']));
  }
  if ((present[0] || present[1] || present[2])
    && !(present[0] && present[1] && present[2])
    && !present[3]) {
    reasons.push(reason('flop_incomplete', ['board']));
  }
  if (reasons.length === 0 && playbookScenarioStreetFromBoard(board) === 'invalid') {
    reasons.push(reason('invalid_board_chronology', ['board']));
  }
  return reasons;
}

/**
 * Pure provider-readiness authority for intentionally lossy Playbook Scenario drafts.
 * It validates only explicit Scenario facts and never reconstructs betting history.
 */
export function validatePlaybookScenarioReadiness(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const reasons = [reason('scenario_input_invalid', ['scenario'])];
    return deepFreeze({
      schemaVersion: PLAYBOOK_SCENARIO_READINESS_SCHEMA_VERSION,
      ready: false,
      reasons,
      message: reasons[0].message,
    });
  }

  const reasons = chronologyReasons(input.board);
  const street = playbookScenarioStreetFromBoard(input.board);
  const heroCards = Array.isArray(input.heroCards) ? input.heroCards.filter(populated) : [];
  const boardCards = Array.isArray(input.board) ? input.board.filter(populated) : [];
  const deadCards = Array.isArray(input.deadCards) ? input.deadCards.filter(populated) : [];
  const knownCards = [...heroCards, ...boardCards, ...deadCards];

  if (knownCards.some((card) => !isCard(card))) {
    reasons.push(reason('invalid_card', ['heroCards', 'board', 'deadCards']));
  } else if (new Set(knownCards).size !== knownCards.length) {
    reasons.push(reason('duplicate_known_card', ['heroCards', 'board', 'deadCards']));
  }
  if (heroCards.length !== 2) {
    reasons.push(reason('hero_cards_incomplete', ['heroCards']));
  }
  const action = typeof input.lastAction === 'string'
    ? input.lastAction.trim().toLowerCase()
    : '';
  const allowedActions = street === 'preflop'
    ? PREFLOP_ACTIONS
    : STREETS.includes(street) ? POSTFLOP_ACTIONS : null;
  if (!PREFLOP_ACTIONS.has(action) && !POSTFLOP_ACTIONS.has(action)) {
    reasons.push(reason('unsupported_action', ['lastAction']));
  } else if (allowedActions && !allowedActions.has(action)) {
    reasons.push(reason('action_not_valid_for_street', ['street', 'lastAction']));
  }

  const facingSizeBb = finiteNumber(input.facingSizeBb);
  if (facingSizeBb === null || facingSizeBb < 0) {
    reasons.push(reason('facing_amount_invalid', ['facingSizeBb']));
  } else if (!AGGRESSIVE_ACTIONS.has(action) && facingSizeBb > 0) {
    reasons.push(reason('facing_amount_without_aggression', ['lastAction', 'facingSizeBb']));
  } else if (AGGRESSIVE_ACTIONS.has(action) && facingSizeBb === 0) {
    reasons.push(reason('aggression_requires_facing_amount', ['lastAction', 'facingSizeBb']));
  }

  const potBb = finiteNumber(input.potBb);
  if (potBb === null || potBb < 0) reasons.push(reason('pot_invalid', ['potBb']));
  const stackBb = finiteNumber(input.stackBb);
  if (stackBb === null || stackBb <= 0) reasons.push(reason('stack_invalid', ['stackBb']));
  const tableSize = finiteNumber(input.tableSize);
  if (!Number.isInteger(tableSize) || tableSize < 2 || tableSize > 10) {
    reasons.push(reason('table_size_invalid', ['tableSize']));
  }
  if (typeof input.heroPosition !== 'string' || input.heroPosition.trim() === '') {
    reasons.push(reason('hero_position_missing', ['heroPosition']));
  }

  return deepFreeze({
    schemaVersion: PLAYBOOK_SCENARIO_READINESS_SCHEMA_VERSION,
    ready: reasons.length === 0,
    reasons,
    message: reasons[0]?.message ?? null,
  });
}
