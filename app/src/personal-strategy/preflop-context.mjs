import {
  ACTION_TYPES,
  GAME_RULES_COLLECTION_TYPES,
  PHASES,
  POKER_STATE_V2_SCHEMA_VERSION,
  STREETS,
  blindAssignments,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
  isPlayerLive,
  playerById,
  validateGameRulesSnapshot,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import {
  CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS,
  CALIBRATION_CONTEXT_STACK_BASES,
  CALIBRATION_DECISION_FAMILIES,
  CALIBRATION_PRIOR_ACTION_FAMILIES,
  createPreflopCalibrationContextV2,
} from './domain.mjs';

function bb(value) {
  return value / 1000;
}

function rulesSnapshotForState(state) {
  if (state.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION) {
    return validateGameRulesSnapshot(state.rulesSnapshot);
  }
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: state.game.mode,
    smallBlindMilliBb: state.game.smallBlindMilliBb,
    bigBlindMilliBb: state.game.bigBlindMilliBb,
    chipUnitMilliBb: state.game.chipUnitMilliBb,
    ante: {
      type: state.game.ante.type,
      amountMilliBb: state.game.ante.amountMilliBb,
    },
  }, state.players.length);
}

function gameRulesFacts(state) {
  const snapshot = rulesSnapshotForState(state);
  const policy = snapshot.definition.collectionPolicy;
  let collection;
  if (policy.type === GAME_RULES_COLLECTION_TYPES.NONE) {
    collection = { type: policy.type, amountPerPlayerBb: 0 };
  } else if (policy.type === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    collection = { type: policy.type, amountPerPlayerBb: bb(policy.amountMilliBb) };
  } else {
    throw new RangeError(`Unsupported Game Rules collection policy: ${policy.type}`);
  }
  return {
    identity: {
      kind: CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.SEMANTIC_FINGERPRINT,
      value: snapshot.semanticFingerprint,
    },
    ante: {
      type: snapshot.definition.ante.type,
      amountBb: bb(snapshot.definition.ante.amountMilliBb),
    },
    collection,
  };
}

function preflopHistorySummary(state) {
  const records = state.actionHistory.filter((record) => record.street === STREETS.PREFLOP);
  const aggressive = records.filter((record) => (
    record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb
  ));
  if (aggressive.length > 3) {
    throw new RangeError('Personal Strategy v1 does not support a preflop decision beyond facing a 4-bet');
  }
  for (const record of records) {
    const aggressiveRecord = record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb;
    if (aggressiveRecord) {
      if (![ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN].includes(record.submittedAction.type)) {
        throw new RangeError('Canonical preflop aggression uses an unsupported action identity');
      }
    } else if (![ACTION_TYPES.FOLD, ACTION_TYPES.CALL].includes(record.submittedAction.type)) {
      throw new RangeError('Canonical preflop history cannot be summarized without losing action meaning');
    }
  }
  const callCount = records.filter((record) => record.submittedAction.type === ACTION_TYPES.CALL).length;
  const foldCount = records.filter((record) => record.submittedAction.type === ACTION_TYPES.FOLD).length;
  const family = aggressive.length === 0
    ? callCount === 0
      ? CALIBRATION_PRIOR_ACTION_FAMILIES.UNOPENED
      : CALIBRATION_PRIOR_ACTION_FAMILIES.LIMPED
    : [
      CALIBRATION_PRIOR_ACTION_FAMILIES.OPEN,
      CALIBRATION_PRIOR_ACTION_FAMILIES.THREE_BET,
      CALIBRATION_PRIOR_ACTION_FAMILIES.FOUR_BET,
    ][aggressive.length - 1];
  const latest = aggressive.at(-1) ?? null;
  return {
    family,
    actionCount: records.length,
    foldCount,
    callCount,
    aggressionCount: aggressive.length,
    lastAggression: latest === null ? null : {
      level: family,
      actionType: latest.submittedAction.type,
      raiseToBb: bb(latest.currentBetAfterMilliBb),
      incrementBb: bb(latest.currentBetAfterMilliBb - latest.currentBetBeforeMilliBb),
      wasFullRaise: latest.wasFullRaise,
    },
  };
}

function decisionFamilyFor(state, actor, legal, priorAction) {
  if (priorAction.aggressionCount === 1) {
    return CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_OPEN;
  }
  if (priorAction.aggressionCount === 2) {
    return CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_3BET;
  }
  if (priorAction.aggressionCount === 3) {
    return CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_4BET;
  }
  if (priorAction.callCount === 0) {
    return CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI;
  }
  const { bigBlindPlayerId } = blindAssignments(state);
  if (actor.playerId === bigBlindPlayerId && legal.check.available) {
    return CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION;
  }
  return CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP;
}

function legalActionsForFamily(family, legal) {
  const available = [];
  const add = (type, isAvailable) => {
    if (isAvailable) available.push({ type });
  };
  if (family === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    add(ACTION_TYPES.FOLD, legal.fold.available);
    add(ACTION_TYPES.CALL, legal.call.available);
    add(ACTION_TYPES.RAISE, legal.raise.available);
    add(ACTION_TYPES.ALL_IN, legal.allIn.available);
    return available;
  }
  add(ACTION_TYPES.FOLD, legal.fold.available);
  add(ACTION_TYPES.CHECK, legal.check.available);
  add(ACTION_TYPES.CALL, legal.call.available);
  add(ACTION_TYPES.RAISE, legal.raise.available);
  add(ACTION_TYPES.ALL_IN, legal.allIn.available);
  return available;
}

function effectiveLivePotCapacityBb(state, actor) {
  const opponents = state.players.filter((player) => (
    player.playerId !== actor.playerId && isPlayerLive(player)
  ));
  if (opponents.length === 0) {
    throw new RangeError('A preflop Personal Strategy decision requires a live opponent');
  }
  const potCapacity = (player) => player.currentStackMilliBb + player.totalPotContributionMilliBb;
  return bb(Math.min(
    potCapacity(actor),
    Math.max(...opponents.map(potCapacity)),
  ));
}

/**
 * Derive one durable action-aware Personal Strategy context from an active,
 * canonical preflop PokerState. Scenario/DecisionContext inputs are excluded
 * because they do not retain truthful action history or legal-action bounds.
 */
export function derivePreflopCalibrationContextFromPokerState(
  state,
  heroPlayerId = state?.actingPlayerId,
) {
  validatePokerState(state);
  if (state.phase !== PHASES.BETTING || state.street !== STREETS.PREFLOP
    || state.pendingChance !== null || state.terminal.isTerminal) {
    throw new RangeError('CalibrationContext v2 derivation requires an active preflop betting decision');
  }
  const actor = playerById(state, heroPlayerId);
  if (!actor || actor.playerId !== state.actingPlayerId || !isPlayerLive(actor)
    || actor.currentStackMilliBb <= 0) {
    throw new RangeError('CalibrationContext v2 Hero must be the current actionable player');
  }
  const legal = getLegalActionSpec(state);
  const priorAction = preflopHistorySummary(state);
  const decisionFamily = decisionFamilyFor(state, actor, legal, priorAction);
  const legalActions = legalActionsForFamily(decisionFamily, legal);
  const opponentCount = state.players.filter((player) => (
    player.playerId !== actor.playerId && isPlayerLive(player)
  )).length;
  return createPreflopCalibrationContextV2({
    decisionFamily,
    gameRules: gameRulesFacts(state),
    tableSize: state.players.length,
    heroPosition: actor.position,
    opponentCount,
    stack: {
      valueBb: effectiveLivePotCapacityBb(state, actor),
      basis: CALIBRATION_CONTEXT_STACK_BASES.EFFECTIVE_LIVE_POT_CAPACITY,
    },
    priorAction,
    facing: {
      sizeBb: priorAction.lastAggression?.raiseToBb ?? 0,
      callAmountBb: bb(legal.call.commitMilliBb),
      heroStreetContributionBb: bb(actor.streetContributionMilliBb),
    },
    sizing: {
      currentBetBb: bb(state.currentBetMilliBb),
      lastFullRaiseIncrementBb: bb(state.lastFullRaiseIncrementMilliBb),
      minimumRaiseToBb: legal.raise.available ? bb(legal.raise.minToMilliBb) : null,
      maximumNonAllInRaiseToBb: legal.raise.available ? bb(legal.raise.maxToMilliBb) : null,
      allInToBb: legal.allIn.available ? bb(legal.allIn.amountToMilliBb) : null,
    },
    legalActions,
  });
}
