export const POKER_STATE_SCHEMA_VERSION = 'poker-state/v1';
export const POKER_STATE_V2_SCHEMA_VERSION = 'poker-state/v2';
export const POKER_STATE_V3_SCHEMA_VERSION = 'poker-state/v3';
export const POKER_STATE_SCHEMA_VERSIONS = Object.freeze([
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
]);
export const POKER_ACTION_SCHEMA_VERSION = 'poker-action/v1';
export const POKER_ACTION_RECORD_SCHEMA_VERSION = 'poker-action-record/v1';
export const POKER_POT_LAYER_SCHEMA_VERSION = 'poker-pot-layer/v1';
export const POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION = 'poker-unmatched-contribution/v1';
export const POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION =
  'poker-actor-call-economics/v1';
export const POKER_HAND_RANK_SCHEMA_VERSION = 'poker-hand-rank/v1';
export const POKER_SHOWDOWN_LAYER_RESULT_SCHEMA_VERSION = 'poker-showdown-layer-result/v1';
export const POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION = 'poker-hidden-hole-cards/v1';
export const POKER_VARIANT = 'no_limit_texas_holdem';

export const ACTION_TYPES = Object.freeze({
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  ALL_IN: 'all_in',
});

export const GAME_MODES = Object.freeze({
  HOME: 'home',
  CLUBGG: 'clubgg',
});

export const ANTE_TYPES = Object.freeze({
  NONE: 'none',
  PER_PLAYER: 'per_player',
  BIG_BLIND: 'big_blind',
});

export const PHASES = Object.freeze({
  CHANCE: 'chance',
  BETTING: 'betting',
  SHOWDOWN: 'showdown',
  TERMINAL: 'terminal',
});

export const STREETS = Object.freeze({
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
});

export const CHANCE_TYPES = Object.freeze({
  DEAL_HOLE: 'deal_hole',
  DEAL_FLOP: 'deal_flop',
  DEAL_TURN: 'deal_turn',
  DEAL_RIVER: 'deal_river',
});

export const HOLE_CARD_STATES = Object.freeze({
  HIDDEN: 'hidden',
});

export const LEDGER_KINDS = Object.freeze({
  CLUBGG_FORCED_CONTRIBUTION: 'clubgg_forced_contribution',
  FIXED_PLAYER_COLLECTION: 'fixed_player_collection',
  ANTE: 'ante',
  SMALL_BLIND: 'small_blind',
  BIG_BLIND: 'big_blind',
  ACTION: 'action',
  UNCALLED_REFUND: 'uncalled_refund',
  POT_AWARD: 'pot_award',
  RECORDED_RAKE: 'recorded_rake',
});

export const LEDGER_MOVEMENTS = Object.freeze({
  STACK_TO_POT: 'stack_to_pot',
  STACK_TO_DEDUCTION: 'stack_to_deduction',
  POT_TO_STACK: 'pot_to_stack',
  POT_TO_RECORDED_RAKE: 'pot_to_recorded_rake',
});

export const CLUBGG_FORCED_CONTRIBUTION_MILLI_BB = 100;
