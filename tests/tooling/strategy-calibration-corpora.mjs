export const PREFLOP_RANKS = Object.freeze([
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
]);

export const PREFLOP_HAND_CLASSES = Object.freeze(PREFLOP_RANKS.flatMap((rowRank, row) => (
  PREFLOP_RANKS.map((columnRank, column) => {
    if (row === column) return `${rowRank}${columnRank}`;
    if (row < column) return `${rowRank}${columnRank}s`;
    return `${columnRank}${rowRank}o`;
  })
)));

export const NON_BLIND_POSITIONS = Object.freeze([
  'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN',
]);

export const ALL_POSITIONS = Object.freeze([...NON_BLIND_POSITIONS, 'SB', 'BB']);

export function representativeCardsForClass(handClass) {
  if (!PREFLOP_HAND_CLASSES.includes(handClass)) {
    throw new RangeError(`Unknown preflop hand class: ${handClass}`);
  }
  if (handClass.length === 2) return [`${handClass[0]}s`, `${handClass[1]}h`];
  if (handClass.endsWith('s')) return [`${handClass[0]}s`, `${handClass[1]}s`];
  return [`${handClass[0]}s`, `${handClass[1]}h`];
}

export function calibrationDecisionContext(overrides = {}) {
  const board = overrides.board ?? [];
  const inferredStreet = board.length === 0
    ? 'preflop'
    : board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : board.length === 5 ? 'river' : 'invalid';
  const street = overrides.street ?? inferredStreet;
  const stackBb = overrides.stackBb ?? 100;
  const potBb = overrides.potBb ?? (board.length === 0 ? 1.5 : 10);
  const opponentCount = overrides.opponentCount ?? null;
  const heroStackBb = overrides.heroStackBb ?? stackBb;
  const lastAction = overrides.lastAction ?? (board.length === 0 ? 'unopened' : 'check');
  const aggressionFamily = street === 'preflop'
    ? lastAction === 'raise' ? 'open'
      : lastAction === '3bet' ? 'three_bet'
        : lastAction === '4bet' ? 'four_bet_or_more'
          : 'none'
    : lastAction === 'raise' ? 'raise' : lastAction === 'bet' ? 'bet' : 'none';
  const facingActionFamily = ['raise', '3bet', '4bet'].includes(lastAction)
    ? 'raise'
    : ['bet', 'check'].includes(lastAction) ? lastAction : 'none';
  const defaultSummary = {
    lastActionFamily: lastAction === '3bet' || lastAction === '4bet' ? 'raise' : lastAction,
    lastActorPosition: null,
    facingActionFamily,
    aggressionFamily,
    aggressionCount: aggressionFamily === 'none' ? 0
      : aggressionFamily === 'three_bet' ? 2
        : aggressionFamily === 'four_bet_or_more' ? 3 : 1,
    limperCount: street === 'preflop' ? 0 : null,
    aggressorPosition: null,
  };
  return {
    schemaVersion: 'decision-context/v1',
    contractVersion: 'decision-context/v1.1',
    tableSize: 6,
    opponentCount,
    heroPosition: 'BTN',
    street,
    heroCards: ['As', 'Kd'],
    board,
    deadCards: [],
    stackBb,
    stackMode: 'hero',
    startingStackBb: stackBb,
    heroStackBb,
    effectiveStackBb: opponentCount === 1 ? heroStackBb : null,
    effectiveStackByOpponent: opponentCount === 1
      ? [{ position: 'BB', opponentStackBb: heroStackBb, effectiveStackBb: heroStackBb }]
      : [],
    potBb,
    currentPotBb: overrides.currentPotBb ?? potBb,
    positionRelation: street === 'preflop' ? 'not_applicable' : 'unknown',
    aggressorPositionRelation: street === 'preflop' ? 'not_applicable' : 'unknown',
    lastAction,
    priorActionSummary: defaultSummary,
    facingSizeBb: 0,
    callAmountBb: board.length === 0 ? null : 0,
    heroStreetContributionBb: board.length === 0 ? null : 0,
    canRaise: true,
    minRaiseToBb: 2,
    maxRaiseToBb: heroStackBb,
    allInToBb: heroStackBb,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
    board,
    street,
  };
}

export const PREFLOP_FACING_CATEGORIES = Object.freeze({
  unopened: Object.freeze({
    lastAction: 'unopened',
    facingSizeBb: 0,
    callAmountBb: null,
    heroStreetContributionBb: null,
    potBb: 1.5,
  }),
  facing_open: Object.freeze({
    lastAction: 'raise',
    facingSizeBb: 2.5,
    callAmountBb: 1.5,
    heroStreetContributionBb: 1,
    potBb: 3.5,
  }),
  facing_3bet: Object.freeze({
    lastAction: '3bet',
    facingSizeBb: 8,
    callAmountBb: 5.5,
    heroStreetContributionBb: 2.5,
    potBb: 11.5,
  }),
  facing_4bet: Object.freeze({
    lastAction: '4bet',
    facingSizeBb: 20,
    callAmountBb: 12,
    heroStreetContributionBb: 8,
    potBb: 31.5,
  }),
  facing_all_in: Object.freeze({
    lastAction: 'raise',
    facingSizeBb: 100,
    callAmountBb: 99,
    heroStreetContributionBb: 1,
    potBb: 100.5,
  }),
});

export const REPRESENTATIVE_PREFLOP_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    id: 'hu_100_btn_unopened',
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'unopened',
    callAmountBb: 0.5,
    heroStreetContributionBb: 0.5,
  }),
  Object.freeze({
    id: 'six_max_100_utg_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'UTG',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_100_hj_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'HJ',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_100_co_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'CO',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_100_btn_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_100_sb_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'SB',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'nine_max_100_utg_unopened',
    tableSize: 9,
    opponentCount: 8,
    heroPosition: 'UTG',
    stackBb: 100,
    facing: 'unopened',
  }),
  ...['UTG+1', 'MP', 'LJ', 'HJ', 'CO'].map((heroPosition) => Object.freeze({
    id: `nine_max_100_${heroPosition.toLowerCase().replace('+', '_plus_')}_unopened`,
    tableSize: 9,
    opponentCount: 8,
    heroPosition,
    stackBb: 100,
    facing: 'unopened',
  })),
  Object.freeze({
    id: 'nine_max_100_btn_unopened',
    tableSize: 9,
    opponentCount: 8,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'nine_max_100_sb_unopened',
    tableSize: 9,
    opponentCount: 8,
    heroPosition: 'SB',
    stackBb: 100,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_30_btn_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    stackBb: 30,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_200_btn_unopened',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    stackBb: 200,
    facing: 'unopened',
  }),
  Object.freeze({
    id: 'six_max_100_bb_facing_open',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BB',
    stackBb: 100,
    facing: 'facing_open',
  }),
  Object.freeze({
    id: 'six_max_100_btn_facing_3bet',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'facing_3bet',
  }),
  Object.freeze({
    id: 'six_max_100_btn_facing_4bet',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'facing_4bet',
  }),
]);

export const RFI_METRIC_ASSUMPTIONS = Object.freeze({
  physicalCombo: Object.freeze({
    weighting: 'physical_combo_count',
    pairClassCombos: 6,
    suitedClassCombos: 4,
    offsuitClassCombos: 12,
    totalCombos: 1326,
    blockerConditioning: 'none',
    classStrategyProjection: 'each physical combo receives its 169-class action vector',
  }),
  equalClass: Object.freeze({
    weighting: 'equal_weight_per_169_hand_class',
    classWeight: 1,
    totalClasses: 169,
  }),
});

export const RFI_EXTERNAL_SANITY_REFERENCES = Object.freeze([
  Object.freeze({
    publisher: 'PokerCoaching',
    url: 'https://pokercoaching.com/preflop-charts',
    accessCheckedOn: '2026-08-23',
    verification: 'figures_and_assumptions_visible_in_public_page_text',
    gameType: 'No-Limit Holdem cash, 6-max',
    rake: 'not stated in accessible public text',
    stackBb: 100,
    openSizeBb: 2.5,
    terminology: 'first position is LJ; BTN is button',
    simplification: 'one implementable action per class; mixed solver strategies are collapsed',
    advisoryRfiPercent: Object.freeze({ LJ: 17.6, BTN: 43.5 }),
  }),
  Object.freeze({
    publisher: 'PokerCoaching',
    url: 'https://pokercoaching.com/preflop-charts',
    accessCheckedOn: '2026-08-23',
    verification: 'figures_and_assumptions_visible_in_public_page_text',
    gameType: 'No-Limit Holdem cash, public full-ring material is 8-max',
    rake: 'not stated in accessible public text',
    stackBb: 100,
    openSizeBb: 2.5,
    terminology: 'UTG and BTN',
    simplification: 'one implementable action per class; mixed solver strategies are collapsed',
    advisoryRfiPercent: Object.freeze({ UTG: 11.4, BTN: 40.3 }),
  }),
  Object.freeze({
    publisher: 'Upswing Poker',
    url: 'https://upswingpoker.com/preflop/',
    accessCheckedOn: '2026-08-23',
    verification: 'game families verified publicly; quoted figures were not exposed without chart-viewer login',
    gameType: 'Online Cash Games (6-Max)',
    rake: 'not verified for quoted figures',
    stackBb: 'selectable; exact quoted-figure depth not publicly verified',
    openSizeBb: 'not publicly verified for quoted figures',
    terminology: 'UTG and BTN as quoted in ticket evidence',
    simplification: 'not publicly verified for quoted figures',
    advisoryRfiPercent: Object.freeze({ UTG: 18.5, BTN: 43.1 }),
  }),
  Object.freeze({
    publisher: 'Upswing Poker',
    url: 'https://upswingpoker.com/preflop/',
    accessCheckedOn: '2026-08-23',
    verification: 'game families verified publicly; quoted figures were not exposed without chart-viewer login',
    gameType: 'Live Cash (9-handed)',
    rake: 'not verified for quoted figures',
    stackBb: 'selectable; exact quoted-figure depth not publicly verified',
    openSizeBb: 'not publicly verified for quoted figures',
    terminology: 'UTG and BTN as quoted in ticket evidence',
    simplification: 'not publicly verified for quoted figures',
    advisoryRfiPercent: Object.freeze({ UTG: 10.2, BTN: 40.8 }),
  }),
  Object.freeze({
    publisher: 'Upswing Poker',
    url: 'https://upswingpoker.com/heads-up-poker-strategy/',
    accessCheckedOn: '2026-08-23',
    verification: 'public directional sanity only; no numeric target adopted',
    gameType: 'Heads-up No-Limit Holdem',
    rake: 'not used for the directional comparison',
    stackBb: 'no exact target depth adopted',
    openSizeBb: 'no exact target size adopted',
    terminology: 'BTN/SB acts first preflop against one big blind',
    simplification: 'directional table-family evidence only',
    advisoryDirection: 'HU BTN opening should be materially distinct from ring-game BTN',
  }),
]);

export const RFI_ACCEPTANCE_INVARIANTS = Object.freeze([
  'HU BTN differs materially from ring-game BTN without an exact external target.',
  'Six-max first position is wider than full-ring first position.',
  'Six-max and nine-max non-blind RFI progressions are monotonic.',
  'Ring-game BTN remains stable across the table families.',
  'Table-family adjustment does not affect facing-action or BB-option outputs.',
  'All action vectors remain finite, normalized, and deterministic.',
]);

export const STRATEGY_QUALITY_BOUNDARY_HANDS = Object.freeze([
  'AA', 'QQ', 'AJs', 'AQs', 'KQs', 'K8s',
  'AJo', 'KJo', 'KQo', 'T9o', '98o', '76s', '72o',
]);

function postflopSpot(id, label, overrides) {
  return Object.freeze({ id, label, context: Object.freeze(calibrationDecisionContext(overrides)) });
}

export const POSTFLOP_NAMED_CORPUS = Object.freeze([
  postflopSpot('flop_nut_straight', 'Flopped nut straight', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', 'Kd'], board: ['Qh', 'Jc', 'Ts'],
  }),
  postflopSpot('flop_overpair_dry', 'Overpair on dry flop', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', 'Ad'], board: ['Kc', '7d', '2h'],
  }),
  postflopSpot('flop_top_pair_dry', 'Top pair on dry flop', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', 'Kd'], board: ['Ah', '7d', '2c'],
  }),
  postflopSpot('flop_middle_pair', 'Middle pair', {
    tableSize: 2, opponentCount: 1, heroCards: ['Ks', 'Qd'], board: ['Ah', 'Kc', '7d'],
  }),
  postflopSpot('flop_weak_pair', 'Underpair on high-card flop', {
    tableSize: 2, opponentCount: 1, heroCards: ['5s', '5d'], board: ['Ah', 'Kc', '7d'],
  }),
  postflopSpot('flop_nut_flush_draw', 'Nut flush draw', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', '5s'], board: ['2s', '9s', 'Kd'],
  }),
  postflopSpot('flop_open_ended_draw', 'Open-ended straight draw', {
    tableSize: 2, opponentCount: 1, heroCards: ['8s', '9d'], board: ['6c', '7h', 'Ks'],
  }),
  postflopSpot('flop_air', 'Air on dry flop', {
    tableSize: 2, opponentCount: 1, heroCards: ['Qh', 'Jd'], board: ['As', '7c', '2d'],
  }),
  postflopSpot('flop_top_pair_small_bet', 'Top pair facing a small bet', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', 'Kd'], board: ['Ah', '7d', '2c'],
    lastAction: 'bet', facingSizeBb: 2, callAmountBb: 2, potBb: 10,
  }),
  postflopSpot('flop_air_large_bet', 'Air facing a large bet', {
    tableSize: 2, opponentCount: 1, heroCards: ['Qh', 'Jd'], board: ['As', '7c', '2d'],
    lastAction: 'bet', facingSizeBb: 15, callAmountBb: 15, potBb: 10,
  }),
  postflopSpot('turn_two_pair', 'Turn two pair', {
    tableSize: 3, opponentCount: 2, heroCards: ['As', '7d'], board: ['Ah', '7c', '2d', 'Tc'],
  }),
  postflopSpot('turn_flush_draw', 'Turn flush draw', {
    tableSize: 3, opponentCount: 2, heroCards: ['As', '5s'], board: ['2s', '9s', 'Kd', 'Tc'],
  }),
  postflopSpot('river_plays_board', 'River plays the board', {
    tableSize: 2, opponentCount: 1, heroCards: ['2c', '3d'], board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  }),
  postflopSpot('river_top_pair_facing_bet', 'River top pair facing a bet', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', 'Kd'], board: ['Ah', '7d', '2c', '9h', '4s'],
    lastAction: 'bet', facingSizeBb: 8, callAmountBb: 8, potBb: 12,
  }),
]);

export const PRICE_RESPONSE_SPOTS = Object.freeze([
  postflopSpot('price_air', 'Air price sweep', {
    tableSize: 2, opponentCount: 1, heroCards: ['Qh', 'Jd'], board: ['As', '7c', '2d'],
    lastAction: 'bet', facingSizeBb: 1, callAmountBb: 1, potBb: 10,
  }),
  postflopSpot('price_draw', 'Nut flush draw price sweep', {
    tableSize: 2, opponentCount: 1, heroCards: ['As', '5s'], board: ['2s', '9s', 'Kd'],
    lastAction: 'bet', facingSizeBb: 1, callAmountBb: 1, potBb: 10,
  }),
  postflopSpot('price_premium', 'Set price sweep', {
    tableSize: 2, opponentCount: 1, heroCards: ['7s', '7h'], board: ['7d', 'Kc', '2h'],
    lastAction: 'bet', facingSizeBb: 1, callAmountBb: 1, potBb: 10,
  }),
]);

export const MULTIWAY_SPOT = postflopSpot('multiway_top_pair', 'Top pair multiway sweep', {
  tableSize: 2,
  opponentCount: 1,
  heroCards: ['As', 'Kd'],
  board: ['Ah', '7d', '2c'],
  stackBb: 100,
  potBb: 10,
});

const CONTROLLED_TOP_PAIR_FACING_BET = calibrationDecisionContext({
  tableSize: 2,
  opponentCount: 1,
  heroPosition: 'BTN',
  heroCards: ['As', 'Kd'],
  board: ['Ah', '7d', '2c'],
  potBb: 10,
  lastAction: 'bet',
  facingSizeBb: 2,
  callAmountBb: 2,
  heroStreetContributionBb: 0,
});

export const POSTFLOP_COUNTERFACTUAL_CORPUS = Object.freeze({
  nominalSizeInvariant: Object.freeze({
    label: 'Dry top pair; nominal wager-to changes while exact call price stays fixed',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      facingSizeBb: 8,
    }),
  }),
  betRaiseEquivalentRange: Object.freeze({
    label: 'Bet versus raise label with the same aggression-conditioned range assumption',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      lastAction: 'raise',
    }),
  }),
  multiwaySensitivity: Object.freeze({
    label: 'Exact live-opponent count changes a non-saturated sampled population',
    baseline: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroCards: ['Ks', 'Qd'],
      board: ['Ah', 'Kc', '7d'],
      lastAction: 'check',
      facingSizeBb: 0,
      callAmountBb: 0,
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroCards: ['Ks', 'Qd'],
      board: ['Ah', 'Kc', '7d'],
      tableSize: 3,
      opponentCount: 2,
      lastAction: 'check',
      facingSizeBb: 0,
      callAmountBb: 0,
    }),
  }),
  missingCallPrice: Object.freeze({
    label: 'Scenario-facing wager without a trusted incremental call price',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      callAmountBb: null,
      heroStreetContributionBb: null,
      opponentCount: null,
      tableSize: 6,
    }),
  }),
  positionSensitivity: Object.freeze({
    label: 'Identical HU facts with exact in-position versus out-of-position relation',
    baseline: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      positionRelation: 'in_position',
      aggressorPositionRelation: 'in_position',
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      positionRelation: 'out_of_position',
      aggressorPositionRelation: 'out_of_position',
    }),
  }),
  effectiveStackSensitivity: Object.freeze({
    label: 'Identical HU facts at shallow versus deep exact effective SPR',
    baseline: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroStackBb: 8,
      effectiveStackBb: 8,
      effectiveStackByOpponent: [
        { position: 'BB', opponentStackBb: 8, effectiveStackBb: 8 },
      ],
      maxRaiseToBb: 8,
      allInToBb: 8,
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroStackBb: 200,
      effectiveStackBb: 200,
      effectiveStackByOpponent: [
        { position: 'BB', opponentStackBb: 200, effectiveStackBb: 200 },
      ],
      maxRaiseToBb: 200,
      allInToBb: 200,
    }),
  }),
  effectiveStackShallowToMedium: Object.freeze({
    label: 'Identical HU facts at shallow versus medium exact effective SPR',
    baseline: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroStackBb: 8,
      effectiveStackBb: 8,
      effectiveStackByOpponent: [
        { position: 'BB', opponentStackBb: 8, effectiveStackBb: 8 },
      ],
      maxRaiseToBb: 8,
      allInToBb: 8,
    }),
    counterfactual: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
  }),
  effectiveStackMediumToDeep: Object.freeze({
    label: 'Identical HU facts at medium versus deep exact effective SPR',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroStackBb: 200,
      effectiveStackBb: 200,
      effectiveStackByOpponent: [
        { position: 'BB', opponentStackBb: 200, effectiveStackBb: 200 },
      ],
      maxRaiseToBb: 200,
      allInToBb: 200,
    }),
  }),
  legalAggressionSensitivity: Object.freeze({
    label: 'Identical strategic facts with regular aggression legal versus unavailable',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      canRaise: false,
      minRaiseToBb: null,
      maxRaiseToBb: null,
    }),
  }),
  exactPriceSensitivity: Object.freeze({
    label: 'Identical population facts with different exact incremental call prices',
    baseline: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroCards: ['As', '5s'],
      board: ['2s', '9s', 'Kd'],
      callAmountBb: 2,
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      heroCards: ['As', '5s'],
      board: ['2s', '9s', 'Kd'],
      callAmountBb: 10,
    }),
  }),
  postflopRaiseHistorySensitivity: Object.freeze({
    label: 'Identical cards and economics facing a bet versus a prior raise',
    baseline: Object.freeze(CONTROLLED_TOP_PAIR_FACING_BET),
    counterfactual: Object.freeze({
      ...CONTROLLED_TOP_PAIR_FACING_BET,
      lastAction: 'raise',
      priorActionSummary: {
        ...CONTROLLED_TOP_PAIR_FACING_BET.priorActionSummary,
        lastActionFamily: 'raise',
        facingActionFamily: 'raise',
        aggressionFamily: 'raise',
        aggressionCount: 2,
      },
    }),
  }),
});

const CONTROLLED_AJS_PREFLOP = calibrationDecisionContext({
  tableSize: 6,
  opponentCount: 5,
  heroPosition: 'BTN',
  heroCards: representativeCardsForClass('AJs'),
  stackBb: 100,
  startingStackBb: 100,
  heroStackBb: 100,
  effectiveStackBb: null,
  effectiveStackByOpponent: [],
  currentPotBb: 1.5,
  lastAction: 'unopened',
  priorActionSummary: {
    lastActionFamily: 'none',
    lastActorPosition: null,
    facingActionFamily: 'none',
    aggressionFamily: 'none',
    aggressionCount: 0,
    limperCount: 0,
    aggressorPosition: null,
  },
});

function preflopAggressionSummary(aggressionFamily, aggressionCount, aggressorPosition = 'CO') {
  return {
    lastActionFamily: 'raise',
    lastActorPosition: aggressorPosition,
    facingActionFamily: 'raise',
    aggressionFamily,
    aggressionCount,
    limperCount: 0,
    aggressorPosition,
  };
}

export const PREFLOP_HISTORY_COUNTERFACTUAL_CORPUS = Object.freeze({
  unopenedVersusOneLimp: Object.freeze({
    label: 'Unopened versus one canonical limp',
    baseline: Object.freeze(CONTROLLED_AJS_PREFLOP),
    counterfactual: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      lastAction: 'check',
      priorActionSummary: {
        ...CONTROLLED_AJS_PREFLOP.priorActionSummary,
        lastActionFamily: 'limp',
        lastActorPosition: 'CO',
        facingActionFamily: 'limp',
        limperCount: 1,
      },
    }),
  }),
  oneVersusMultipleLimps: Object.freeze({
    label: 'One versus three canonical limpers',
    baseline: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      lastAction: 'check',
      priorActionSummary: {
        ...CONTROLLED_AJS_PREFLOP.priorActionSummary,
        lastActionFamily: 'limp',
        lastActorPosition: 'CO',
        facingActionFamily: 'limp',
        limperCount: 1,
      },
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      lastAction: 'check',
      priorActionSummary: {
        ...CONTROLLED_AJS_PREFLOP.priorActionSummary,
        lastActionFamily: 'limp',
        lastActorPosition: 'CO',
        facingActionFamily: 'limp',
        limperCount: 3,
      },
    }),
  }),
  unopenedVersusFacingOpen: Object.freeze({
    label: 'Representative AJs unopened family versus facing an open',
    baseline: Object.freeze(CONTROLLED_AJS_PREFLOP),
    counterfactual: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      lastAction: 'raise',
      facingSizeBb: 2.5,
      callAmountBb: 2.5,
      currentPotBb: 4,
      potBb: 4,
      priorActionSummary: preflopAggressionSummary('open', 1),
    }),
  }),
  facingOpenVersusThreeBet: Object.freeze({
    label: 'Representative AJs facing-open versus facing-3-bet families',
    baseline: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      lastAction: 'raise',
      facingSizeBb: 2.5,
      callAmountBb: 2.5,
      currentPotBb: 4,
      potBb: 4,
      priorActionSummary: preflopAggressionSummary('open', 1),
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      heroStackBb: 97.5,
      lastAction: '3bet',
      facingSizeBb: 8,
      callAmountBb: 5.5,
      heroStreetContributionBb: 2.5,
      currentPotBb: 11.5,
      potBb: 11.5,
      priorActionSummary: preflopAggressionSummary('three_bet', 2),
    }),
  }),
  facingThreeBetVersusFourBet: Object.freeze({
    label: 'Representative AJs response family facing 3-bet versus 4-bet-or-more',
    baseline: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      heroStackBb: 97.5,
      lastAction: '3bet',
      facingSizeBb: 8,
      callAmountBb: 5.5,
      currentPotBb: 11.5,
      potBb: 11.5,
      priorActionSummary: preflopAggressionSummary('three_bet', 2),
    }),
    counterfactual: Object.freeze({
      ...CONTROLLED_AJS_PREFLOP,
      heroStackBb: 92,
      lastAction: '4bet',
      facingSizeBb: 20,
      callAmountBb: 12,
      currentPotBb: 31.5,
      potBb: 31.5,
      priorActionSummary: preflopAggressionSummary('four_bet_or_more', 3),
    }),
  }),
});
