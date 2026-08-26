export const PREFLOP_DECISION_ROLES = Object.freeze({
  UNOPENED_RFI: 'unopened_rfi',
  ISOLATION_OPPORTUNITY: 'isolation_opportunity',
  BB_OPTION_AFTER_LIMPS: 'bb_option_after_limps',
  COLD_RESPONSE_TO_OPEN: 'cold_response_to_open',
  BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN: 'blind_vs_blind_response_to_sb_open',
  OPENED_FACING_THREE_BET: 'opened_facing_three_bet',
  COLD_FOUR_BET_OPPORTUNITY: 'cold_four_bet_opportunity',
  THREE_BETTOR_FACING_FOUR_BET: 'three_bettor_facing_four_bet',
  THREE_BETTOR_FACING_COLD_FOUR_BET: 'three_bettor_facing_cold_four_bet',
  OPENER_FACING_COLD_FOUR_BET: 'opener_facing_cold_four_bet',
  LIMPER_FACING_ISOLATION: 'limper_facing_isolation',
  FOUR_BET_OR_MORE_UNCLASSIFIED: 'four_bet_or_more_unclassified',
  UNKNOWN: 'unknown',
});

export function hasExactPreflopRoleFacts(decisionContext) {
  const summary = decisionContext?.priorActionSummary;
  if (decisionContext?.street !== 'preflop'
    || !summary
    || !Number.isInteger(summary.aggressionCount)
    || summary.aggressionCount < 0
    || !Number.isInteger(summary.limperCount)
    || summary.limperCount < 0
    || !Number.isInteger(summary.distinctAggressorCount)
    || summary.distinctAggressorCount < 0
    || ['unknown', 'not_applicable', ''].includes(
      String(summary.heroPreviousVoluntaryActionFamily || '').toLowerCase(),
    )) {
    return false;
  }
  if (summary.aggressionCount === 0) {
    return summary.distinctAggressorCount === 0
      && summary.initialAggressorPosition === null
      && summary.latestAggressionWasCold === null
      && summary.heroActionWouldBeCold === null;
  }
  return typeof summary.initialAggressorPosition === 'string'
    && summary.initialAggressorPosition.length > 0
    && typeof summary.aggressorPosition === 'string'
    && summary.aggressorPosition.length > 0
    && summary.distinctAggressorCount > 0
    && typeof summary.latestAggressionWasCold === 'boolean'
    && typeof summary.heroActionWouldBeCold === 'boolean';
}

/**
 * Exact semantic identity for bounded preflop decisions. This classifier is
 * shared by heuristic reporting and reference-pack matching; it does not
 * select a strategy or calibration family.
 */
export function preflopDecisionRoleFor(decisionContext) {
  if (!hasExactPreflopRoleFacts(decisionContext)) {
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  const summary = decisionContext.priorActionSummary;
  const aggressionCount = summary.aggressionCount;
  const heroPrevious = String(summary.heroPreviousVoluntaryActionFamily).toLowerCase();
  const heroPosition = String(decisionContext.heroPosition || '');

  if (aggressionCount === 0) {
    if (summary.limperCount > 0) {
      const exactFreeOption = heroPosition === 'BB' && decisionContext.callAmountBb === 0;
      return exactFreeOption
        ? PREFLOP_DECISION_ROLES.BB_OPTION_AFTER_LIMPS
        : PREFLOP_DECISION_ROLES.ISOLATION_OPPORTUNITY;
    }
    return PREFLOP_DECISION_ROLES.UNOPENED_RFI;
  }

  if (aggressionCount === 1) {
    if (heroPrevious === 'limp') {
      return PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION;
    }
    if (heroPrevious === 'none' && summary.heroActionWouldBeCold) {
      const blindVersusBlindOpen = heroPosition === 'BB'
        && (summary.initialAggressorPosition === 'SB'
          || (decisionContext.tableSize === 2
            && summary.initialAggressorPosition === 'BTN'));
      return blindVersusBlindOpen
        ? PREFLOP_DECISION_ROLES.BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN
        : PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN;
    }
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  if (aggressionCount === 2) {
    if (heroPrevious === 'open' && summary.initialAggressorPosition === heroPosition) {
      return PREFLOP_DECISION_ROLES.OPENED_FACING_THREE_BET;
    }
    if (heroPrevious === 'none'
      && summary.heroActionWouldBeCold
      && summary.distinctAggressorCount === 2) {
      return PREFLOP_DECISION_ROLES.COLD_FOUR_BET_OPPORTUNITY;
    }
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  if (aggressionCount === 3) {
    if (heroPrevious === 'open'
      && summary.initialAggressorPosition === heroPosition
      && summary.latestAggressionWasCold
      && summary.distinctAggressorCount === 3) {
      return PREFLOP_DECISION_ROLES.OPENER_FACING_COLD_FOUR_BET;
    }
    if (heroPrevious === 'three_bet'
      && summary.latestAggressionWasCold === false
      && summary.distinctAggressorCount === 2) {
      return PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_FOUR_BET;
    }
    if (heroPrevious === 'three_bet'
      && summary.latestAggressionWasCold
      && summary.distinctAggressorCount === 3) {
      return PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_COLD_FOUR_BET;
    }
  }

  return PREFLOP_DECISION_ROLES.FOUR_BET_OR_MORE_UNCLASSIFIED;
}
