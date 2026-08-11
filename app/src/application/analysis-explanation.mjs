export const ANALYSIS_EXPLANATION_SCHEMA_VERSION = 'analysis-explanation/v1';

export const ANALYSIS_THRESHOLDS = Object.freeze({
  pureProbability: 0.95,
  dominantProbability: 0.70,
  meaningfulProbability: 0.10,
});

const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
const STRATEGY_RESULT_SCHEMA_VERSION = 'strategy-result/v1';
const AUTHORITY_TYPES = Object.freeze(['scenario', 'hand', 'training']);

const SOURCE_PRESENTATION = Object.freeze({
  heuristic_preflop: Object.freeze({
    label: 'Heuristic estimate',
    labelKey: 'analysis.provenance.heuristicPreflop',
    limitation: 'This is heuristic guidance without validated solver provenance.',
    warningCode: 'heuristic_source',
  }),
  heuristic_postflop: Object.freeze({
    label: 'Heuristic estimate',
    labelKey: 'analysis.provenance.heuristicPostflop',
    limitation: 'This is an approximate postflop fallback, not solver reasoning.',
    warningCode: 'heuristic_source',
  }),
  equity_fallback: Object.freeze({
    label: 'Equity-based fallback',
    labelKey: 'analysis.provenance.equityFallback',
    limitation: 'Equity alone does not provide a complete strategy or action EV comparison.',
    warningCode: 'equity_only_source',
  }),
  unavailable: Object.freeze({
    label: 'Source unavailable',
    labelKey: 'analysis.provenance.unavailable',
    limitation: 'No current strategy recommendation is available.',
    warningCode: 'strategy_unavailable',
  }),
});

const UNAVAILABLE_COPY = Object.freeze({
  missing_hero_cards: 'Select two Hero cards to explain this decision.',
  waiting_for_board: 'Complete the board cards required for this street.',
  hero_not_actor: 'The canonical hand is waiting for another player to act.',
  waiting_for_hero: 'The current state is waiting for Hero to act.',
  terminal_hand: 'The hand is complete, so there is no decision to explain.',
  strategy_unavailable: 'No valid strategy recommendation is available for this state.',
  invalid_scenario: 'The supplied scenario cannot be analyzed safely.',
  invalid_context: 'The current decision context is unavailable.',
});

const RANK_VALUE = Object.freeze({
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function boundedProbability(value) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Math.min(1, Math.max(0, numeric));
}

function rounded(value, digits = 1) {
  return Number(Number(value).toFixed(digits));
}

function percent(value, digits = 0) {
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function bb(value) {
  return `${rounded(value, 2)}bb`;
}

export function formatAnalysisTemplate(fallback, values = {}) {
  return String(fallback || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

function textPart(key, fallback, values = {}, kind = 'interpretation') {
  const safeValues = { ...values };
  return {
    key,
    kind,
    templateKey: key,
    values: safeValues,
    text: formatAnalysisTemplate(fallback, safeValues),
  };
}

function fact(key, {
  kind = 'fact',
  label,
  labelKey,
  value,
  unit = null,
  templateKey,
  fallback,
  values = {},
}) {
  const safeValues = { ...values };
  return {
    key,
    kind,
    label,
    labelKey,
    value,
    unit,
    templateKey,
    values: safeValues,
    text: formatAnalysisTemplate(fallback, safeValues),
  };
}

function section(key, title, importance, facts, textParts = []) {
  return {
    key,
    title,
    titleKey: `analysis.section.${key}`,
    importance,
    facts,
    textParts,
  };
}

function warning(code, message, severity = 'info') {
  return {
    code,
    severity,
    messageKey: `analysis.warning.${code}`,
    message,
  };
}

function stableHash(values) {
  const input = JSON.stringify(values);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validCard(card) {
  return typeof card === 'string' && /^[2-9TJQKA][cdhs]$/.test(card);
}

function expectedBoardCount(street) {
  return { preflop: 0, flop: 3, turn: 4, river: 5 }[street] ?? null;
}

function cardRank(card) {
  return RANK_VALUE[String(card || '')[0]] ?? null;
}

export function deriveBoardTextureFacts(board) {
  const cards = Array.isArray(board) ? [...board] : [];
  if (cards.length < 3 || cards.length > 5 || cards.some((card) => !validCard(card))
    || new Set(cards).size !== cards.length) {
    return deepFreeze({
      available: false,
      cardCount: cards.length,
      paired: null,
      tripled: null,
      monotone: null,
      twoTone: null,
      rainbow: null,
      flushDrawPossible: null,
      connectivity: null,
      connected: null,
      broadwayCount: null,
      highestRank: null,
    });
  }

  const ranks = cards.map(cardRank);
  const suits = cards.map((card) => card[1]);
  const rankCounts = new Map();
  const suitCounts = new Map();
  ranks.forEach((rank) => rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1));
  suits.forEach((suit) => suitCounts.set(suit, (suitCounts.get(suit) || 0) + 1));
  const distinctSuits = suitCounts.size;
  const maximumSuitCount = Math.max(...suitCounts.values());
  const uniqueRanks = [...new Set(ranks)];
  if (uniqueRanks.includes(14)) uniqueRanks.push(1);
  uniqueRanks.sort((left, right) => left - right);

  let longestRun = 1;
  let currentRun = 1;
  for (let index = 1; index < uniqueRanks.length; index += 1) {
    if (uniqueRanks[index] === uniqueRanks[index - 1] + 1) currentRun += 1;
    else currentRun = 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  let coordinated = false;
  for (let start = 0; start < uniqueRanks.length; start += 1) {
    for (let end = start + 2; end < uniqueRanks.length; end += 1) {
      if (uniqueRanks[end] - uniqueRanks[start] <= 4) coordinated = true;
    }
  }
  const connectivity = longestRun >= 3
    ? 'connected'
    : coordinated ? 'coordinated' : 'disconnected';

  return deepFreeze({
    available: true,
    cardCount: cards.length,
    paired: [...rankCounts.values()].some((count) => count >= 2),
    tripled: [...rankCounts.values()].some((count) => count >= 3),
    monotone: distinctSuits === 1,
    twoTone: distinctSuits === 2,
    rainbow: cards.length === 3 && distinctSuits === 3,
    flushDrawPossible: maximumSuitCount >= 2,
    connectivity,
    connected: connectivity === 'connected',
    broadwayCount: ranks.filter((rank) => rank >= 10).length,
    highestRank: Math.max(...ranks),
  });
}

function normalizeAuthority(authority) {
  const source = typeof authority === 'string' ? { type: authority } : (authority || {});
  const type = AUTHORITY_TYPES.includes(source.type) ? source.type : 'scenario';
  return {
    type,
    label: type === 'hand' ? 'Canonical hand'
      : type === 'training' ? 'Canonical training exercise' : 'Scenario controls',
    labelKey: `analysis.authority.${type}`,
  };
}

function normalizeHistory(history, authorityType) {
  if (authorityType === 'scenario' || !Array.isArray(history)) return [];
  return history.map((entry, index) => {
    const amountBb = finiteNumber(entry?.amountBb);
    return {
      sequence: Number.isInteger(entry?.sequence) ? entry.sequence : index,
      street: String(entry?.street || ''),
      actorLabel: String(entry?.actorLabel || entry?.position || 'Unknown player'),
      position: entry?.position ? String(entry.position) : null,
      actionType: String(entry?.actionType || 'unknown'),
      actionLabel: String(entry?.actionLabel || entry?.actionType || 'Action'),
      amountBb,
      amountLabel: entry?.amountLabel ? String(entry.amountLabel) : (amountBb === null ? null : bb(amountBb)),
      isHero: Boolean(entry?.isHero),
    };
  }).sort((left, right) => left.sequence - right.sequence);
}

function provenanceFor(strategyResult) {
  const source = strategyResult?.source || 'unavailable';
  const presentation = SOURCE_PRESENTATION[source] || SOURCE_PRESENTATION.unavailable;
  return {
    source,
    label: presentation.label,
    labelKey: presentation.labelKey,
    modelVersion: strategyResult?.modelVersion ?? null,
    confidence: boundedProbability(strategyResult?.confidence),
    coverage: boundedProbability(strategyResult?.coverage),
    limitations: [presentation.limitation],
  };
}

function strategyShape(actions) {
  if (!actions.length) return 'unavailable';
  const leading = actions[0];
  if (leading.probability >= ANALYSIS_THRESHOLDS.pureProbability) return 'pure';
  if (leading.probability >= ANALYSIS_THRESHOLDS.dominantProbability) return 'dominant';
  const meaningful = actions.filter((entry) => entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability);
  return meaningful.length >= 2 ? 'mixed' : 'fragmented';
}

function normalizeActions(strategyResult) {
  return (Array.isArray(strategyResult?.actions) ? strategyResult.actions : [])
    .map((entry, index) => ({
      index,
      action: {
        type: String(entry?.action?.type || 'unknown'),
        amountBb: finiteNumber(entry?.action?.amountBb),
        potFraction: finiteNumber(entry?.action?.potFraction),
      },
      label: String(entry?.label || entry?.action?.type || 'Unknown action'),
      probability: boundedProbability(entry?.probability) ?? 0,
      evBb: finiteNumber(entry?.evBb),
    }))
    .filter((entry) => entry.probability > 0)
    .sort((left, right) => right.probability - left.probability || left.index - right.index);
}

function makeActionAnalysis(actions) {
  const shape = strategyShape(actions);
  return actions.map((entry, index) => ({
    action: { ...entry.action },
    label: entry.label,
    probability: entry.probability,
    evBb: entry.evBb,
    role: index === 0 ? 'primary'
      : entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability ? 'meaningful_secondary' : 'minor',
    strategyShape: shape,
  }));
}

function handBoardSection(context, trustedFacts, warnings, depth) {
  const heroCards = Array.isArray(context.heroCards) ? [...context.heroCards] : [];
  const board = Array.isArray(context.board) ? [...context.board] : [];
  const facts = [];
  const parts = [];
  if (heroCards.length === 2 && heroCards.every(validCard)) {
    facts.push(fact('hero_cards', {
      label: 'Hero cards', labelKey: 'analysis.fact.heroCards', value: heroCards,
      templateKey: 'analysis.hand.heroCards', fallback: 'Hero holds {cards}.',
      values: { cards: heroCards.join(' ') },
    }));
  }

  if (context.street === 'preflop' && heroCards.length === 2 && heroCards.every(validCard)) {
    const pair = heroCards[0][0] === heroCards[1][0];
    const suited = heroCards[0][1] === heroCards[1][1];
    const classification = pair ? 'pocket pair' : suited ? 'suited hand' : 'offsuit hand';
    facts.push(fact('preflop_hand_class', {
      label: 'Hand class', labelKey: 'analysis.fact.handClass', value: pair ? 'pair' : suited ? 'suited' : 'offsuit',
      templateKey: 'analysis.hand.preflopClass', fallback: 'This is a {classification}.',
      values: { classification },
    }));
  }

  if (context.street !== 'preflop') {
    const hand = trustedFacts?.handClassification;
    const madeHand = hand?.madeHand || hand?.label || null;
    const draws = Array.isArray(hand?.draws) ? hand.draws.filter(Boolean).map(String) : [];
    if (madeHand) {
      facts.push(fact('made_hand', {
        label: 'Made hand', labelKey: 'analysis.fact.madeHand', value: String(madeHand),
        templateKey: 'analysis.hand.madeHand', fallback: 'Current hand classification: {madeHand}.',
        values: { madeHand: String(madeHand) },
      }));
      if (hand?.source === 'legacy_postflop_classifier') {
        warnings.push(warning(
          'legacy_hand_classifier',
          'Hand and draw labels use the current legacy postflop classifier and inherit its known limitations.',
        ));
      }
    } else {
      warnings.push(warning('hand_classification_unavailable', 'No trusted made-hand classification was supplied.'));
    }
    if (draws.length) {
      facts.push(fact('draws', {
        label: 'Draws', labelKey: 'analysis.fact.draws', value: draws,
        templateKey: 'analysis.hand.draws', fallback: 'Detected draw labels: {draws}.',
        values: { draws: draws.join(', ') },
      }));
    }

    const texture = deriveBoardTextureFacts(board);
    if (texture.available) {
      facts.push(fact('board_pairing', {
        label: 'Board pairing', labelKey: 'analysis.fact.boardPairing', value: texture.paired,
        templateKey: texture.paired ? 'analysis.board.paired' : 'analysis.board.unpaired',
        fallback: texture.paired ? 'The board is paired.' : 'The board is unpaired.', values: {},
      }));
      const tone = texture.monotone ? 'monotone' : texture.twoTone ? 'two-tone' : texture.rainbow ? 'rainbow' : 'multi-suit';
      facts.push(fact('board_suits', {
        label: 'Suit texture', labelKey: 'analysis.fact.boardSuits', value: tone,
        templateKey: `analysis.board.${tone.replace('-', '')}`,
        fallback: 'Suit texture: {tone}.', values: { tone },
      }));
      facts.push(fact('board_connectivity', {
        label: 'Connectivity', labelKey: 'analysis.fact.boardConnectivity', value: texture.connectivity,
        templateKey: `analysis.board.${texture.connectivity}`,
        fallback: 'Rank texture: {connectivity}.', values: { connectivity: texture.connectivity.replace('_', ' ') },
      }));
      if (depth === 'detailed') {
        facts.push(fact('board_broadway_count', {
          label: 'Broadway cards', labelKey: 'analysis.fact.broadwayCount', value: texture.broadwayCount,
          templateKey: 'analysis.board.broadwayCount', fallback: 'The board contains {count} Broadway card(s).',
          values: { count: texture.broadwayCount },
        }));
      }
      const highestBoardRank = texture.highestRank;
      const overcards = heroCards.filter((card) => validCard(card) && cardRank(card) > highestBoardRank).length;
      if (overcards > 0) {
        facts.push(fact('hero_overcards', {
          label: 'Overcards', labelKey: 'analysis.fact.overcards', value: overcards,
          templateKey: 'analysis.hand.overcards', fallback: 'Hero has {count} overcard(s) to the board.',
          values: { count: overcards },
        }));
      }
    } else {
      warnings.push(warning('board_analysis_unavailable', 'Board texture is unavailable for the current cards.'));
    }
  }

  return facts.length ? section('hand_board', 'Hand & Board', 'primary', facts, parts) : null;
}

function positionSection(context, trustedFacts) {
  const facts = [
    fact('hero_position', {
      label: 'Hero position', labelKey: 'analysis.fact.heroPosition', value: context.heroPosition,
      templateKey: 'analysis.position.hero', fallback: 'Hero acts from {position}.',
      values: { position: context.heroPosition },
    }),
    fact('table_size', {
      label: 'Table size', labelKey: 'analysis.fact.tableSize', value: context.tableSize, unit: 'players',
      templateKey: 'analysis.position.tableSize', fallback: 'The table has {tableSize} seated players.',
      values: { tableSize: context.tableSize },
    }),
  ];
  if (context.street !== 'preflop' && ['in_position', 'out_of_position'].includes(trustedFacts?.positionRelation)) {
    const inPosition = trustedFacts.positionRelation === 'in_position';
    facts.push(fact('postflop_position_relation', {
      label: 'Postflop relation', labelKey: 'analysis.fact.positionRelation', value: trustedFacts.positionRelation,
      templateKey: inPosition ? 'analysis.position.inPosition' : 'analysis.position.outOfPosition',
      fallback: inPosition ? 'Trusted state marks Hero as in position.' : 'Trusted state marks Hero as out of position.', values: {},
    }));
  }
  if (context.street === 'preflop' && context.heroPosition === 'BB' && context.lastAction === 'unopened') {
    facts.push(fact('big_blind_check_option', {
      label: 'Big blind option', labelKey: 'analysis.fact.bigBlindOption', value: true,
      templateKey: 'analysis.position.bbCheckOption', fallback: 'The Big Blind has a free check option in this supplied context.', values: {},
    }));
  }
  return section('position', 'Position', 'context', facts);
}

function potOddsSection(context) {
  const potBeforeCallBb = finiteNumber(context.potBb);
  const facingSizeBb = finiteNumber(context.facingSizeBb);
  const stackBb = finiteNumber(context.stackBb);
  if (potBeforeCallBb === null || potBeforeCallBb < 0) return null;
  const facts = [fact('pot_before_action', {
    label: 'Pot before action', labelKey: 'analysis.fact.potBeforeAction', value: potBeforeCallBb, unit: 'bb',
    templateKey: 'analysis.pot.current', fallback: 'The current pot is {pot}.', values: { pot: bb(potBeforeCallBb) },
  })];
  if (facingSizeBb !== null && facingSizeBb > 0) {
    const callAmountBb = stackBb === null ? facingSizeBb : Math.min(facingSizeBb, Math.max(0, stackBb));
    const potAfterCallBb = potBeforeCallBb + callAmountBb;
    const requiredEquity = potAfterCallBb > 0 ? callAmountBb / potAfterCallBb : 0;
    facts.push(
      fact('call_amount', {
        label: 'Amount to call', labelKey: 'analysis.fact.callAmount', value: callAmountBb, unit: 'bb',
        templateKey: 'analysis.pot.callAmount', fallback: 'The compatibility call amount is {callAmount}.',
        values: { callAmount: bb(callAmountBb) },
      }),
      fact('pot_after_call', {
        kind: 'derived', label: 'Pot after call', labelKey: 'analysis.fact.potAfterCall', value: potAfterCallBb, unit: 'bb',
        templateKey: 'analysis.pot.afterCall', fallback: 'Calling {callAmount} makes the contested pot {potAfterCall}.',
        values: { callAmount: bb(callAmountBb), potAfterCall: bb(potAfterCallBb) },
      }),
      fact('required_raw_equity', {
        kind: 'derived', label: 'Required raw equity', labelKey: 'analysis.fact.requiredEquity', value: requiredEquity, unit: 'probability',
        templateKey: 'analysis.pot.requiredEquity', fallback: 'The raw break-even equity is {requiredEquity}.',
        values: { requiredEquity: percent(requiredEquity, 1) },
      }),
    );
  }
  return section('pot_odds', 'Pot & Odds', 'primary', facts, facingSizeBb > 0 ? [
    textPart(
      'analysis.pot.notSufficient',
      'Pot odds are a price, not a complete strategy recommendation.',
      {},
      'interpretation',
    ),
  ] : []);
}

function sprSection(context, warnings) {
  if (context.street === 'preflop') return null;
  const stackBb = finiteNumber(context.stackBb);
  const potBb = finiteNumber(context.potBb);
  if (stackBb === null || potBb === null || stackBb < 0 || potBb <= 0) return null;
  const spr = stackBb / potBb;
  const category = spr < 4 ? 'low' : spr <= 10 ? 'medium' : 'high';
  warnings.push(warning(
    'lossy_stack_semantics',
    'SPR uses DecisionContext v1 stackBb, which is a compatibility stack rather than a guaranteed effective stack.',
  ));
  return section('spr', 'Stack / SPR', 'supporting', [
    fact('stack_bb', {
      label: 'Compatibility stack', labelKey: 'analysis.fact.stackBb', value: stackBb, unit: 'bb',
      templateKey: 'analysis.spr.stack', fallback: 'DecisionContext reports a {stack} compatibility stack.',
      values: { stack: bb(stackBb) },
    }),
    fact('spr', {
      kind: 'derived', label: 'SPR', labelKey: 'analysis.fact.spr', value: spr, unit: 'ratio',
      templateKey: 'analysis.spr.value', fallback: 'Stack-to-pot ratio is {spr}, a broadly {category} SPR.',
      values: { spr: rounded(spr, 1), category },
    }),
  ]);
}

function historyText(record) {
  const amount = record.amountLabel ? ` ${record.amountLabel}` : '';
  return `${record.actorLabel}: ${record.actionLabel}${amount}.`;
}

function actionContextSection(context, authority, history, depth, warnings) {
  const facts = [
    fact('context_authority', {
      label: 'Context authority', labelKey: 'analysis.fact.contextAuthority', value: authority.type,
      templateKey: `analysis.authority.${authority.type}`, fallback: '{authority} supplies the decision facts.',
      values: { authority: authority.label },
    }),
    fact('last_action', {
      label: 'Prior-action setting', labelKey: 'analysis.fact.lastAction', value: context.lastAction,
      templateKey: 'analysis.action.lastAction', fallback: 'Prior-action context: {lastAction}.',
      values: { lastAction: String(context.lastAction || 'unavailable').replaceAll('_', ' ') },
    }),
  ];
  if (context.facingSizeBb > 0) {
    facts.push(fact('facing_size', {
      label: 'Facing size', labelKey: 'analysis.fact.facingSize', value: context.facingSizeBb, unit: 'bb',
      templateKey: 'analysis.action.facing', fallback: 'Hero faces {facingSize}.',
      values: { facingSize: bb(context.facingSizeBb) },
    }));
  } else {
    facts.push(fact('no_voluntary_wager_faced', {
      label: 'Facing voluntary wager', labelKey: 'analysis.fact.noFacingWager', value: false,
      templateKey: 'analysis.action.noFacing', fallback: 'Hero is not facing a voluntary wager.', values: {},
    }));
  }

  if (authority.type === 'scenario') {
    warnings.push(warning(
      'lossy_action_history',
      'Scenario Analysis supplies a decision snapshot, not a validated legal action history.',
    ));
  } else if (history.length) {
    const visibleHistory = depth === 'concise' ? history.slice(-2) : history;
    visibleHistory.forEach((record) => facts.push(fact(`history_${record.sequence}`, {
      label: 'Action history', labelKey: 'analysis.fact.actionHistory', value: record,
      templateKey: 'analysis.action.historyRecord', fallback: '{historyText}',
      values: { historyText: historyText(record) },
    })));
  }
  return section('action_context', 'Action Context', 'context', facts);
}

function strategySection(context, actions, source, depth) {
  if (!actions.length) return null;
  const shape = strategyShape(actions);
  const primary = actions[0];
  const secondary = actions.find((entry, index) => index > 0
    && entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability) || actions[1] || null;
  const facts = actions
    .filter((entry) => depth === 'detailed'
      || entry === primary
      || entry.probability >= ANALYSIS_THRESHOLDS.meaningfulProbability)
    .map((entry) => fact(`strategy_action_${entry.action.type}_${entry.index}`, {
      label: entry.label, labelKey: 'analysis.fact.actionProbability', value: entry.probability, unit: 'probability',
      templateKey: 'analysis.strategy.actionProbability', fallback: '{action}: {probability}.',
      values: { action: entry.label, probability: percent(entry.probability, 0) },
    }));
  const variant = stableHash([
    context.street, context.heroPosition, context.heroCards, context.board,
    context.potBb, context.facingSizeBb, source, primary.label, rounded(primary.probability, 4), shape,
  ]) % 2;
  let part;
  if (shape === 'pure') {
    part = variant === 0
      ? textPart('analysis.strategy.pure.primary', '{action} is effectively pure at {probability} in the displayed result.', {
        action: primary.label, probability: percent(primary.probability, 0),
      })
      : textPart('analysis.strategy.pure.alternate', 'The displayed result puts {probability} on {action}, above the pure-action threshold.', {
        action: primary.label, probability: percent(primary.probability, 0),
      });
  } else if (shape === 'dominant') {
    part = textPart('analysis.strategy.dominant', 'This is mostly {primary} ({primaryProbability}){secondaryClause}.', {
      primary: primary.label,
      primaryProbability: percent(primary.probability, 0),
      secondaryClause: secondary ? `, with ${secondary.label} at ${percent(secondary.probability, 0)}` : '',
    });
  } else if (shape === 'mixed') {
    part = variant === 0
      ? textPart('analysis.strategy.mixed.between', 'The result mixes between {primary} ({primaryProbability}) and {secondary} ({secondaryProbability}).', {
        primary: primary.label, primaryProbability: percent(primary.probability, 0),
        secondary: secondary?.label || 'another action', secondaryProbability: percent(secondary?.probability || 0, 0),
      })
      : textPart('analysis.strategy.mixed.noDominant', 'No action reaches the dominant threshold; {primary} leads at {primaryProbability}.', {
        primary: primary.label, primaryProbability: percent(primary.probability, 0),
      });
  } else {
    part = textPart('analysis.strategy.fragmented', '{action} leads the displayed result at {probability}; remaining weight is spread across minor actions.', {
      action: primary.label, probability: percent(primary.probability, 0),
    });
  }
  return section('strategy_mix', 'Strategy Mix', 'primary', facts, [part]);
}

function sizingSection(context, actions) {
  const sized = actions.filter((entry) => entry.action.amountBb !== null || entry.action.potFraction !== null);
  if (!sized.length) return null;
  const facts = sized.map((entry, index) => {
    const amount = entry.action.amountBb;
    const explicitFraction = entry.action.potFraction;
    const derivedFraction = explicitFraction === null && amount !== null && context.potBb > 0
      ? amount / context.potBb : null;
    const fraction = explicitFraction ?? derivedFraction;
    const values = {
      action: entry.label,
      amount: amount === null ? 'not supplied' : bb(amount),
      potShare: fraction === null ? 'not supplied' : percent(fraction, 0),
    };
    return fact(`sizing_${entry.action.type}_${index}`, {
      kind: derivedFraction === null ? 'fact' : 'derived',
      label: entry.label, labelKey: 'analysis.fact.actionSizing',
      value: { amountBb: amount, potFraction: explicitFraction, derivedPotFraction: derivedFraction },
      templateKey: 'analysis.sizing.known',
      fallback: amount !== null && fraction !== null
        ? '{action} reports {amount}, about {potShare} of the current pot.'
        : amount !== null ? '{action} reports {amount}.' : '{action} reports a {potShare} pot fraction.',
      values,
    });
  });
  return section('sizing', 'Sizing', 'supporting', facts, [
    textPart('analysis.sizing.noRationale', 'The source supplies the size, but no sizing rationale metadata.', {}, 'interpretation'),
  ]);
}

function equitySection(trustedFacts, warnings) {
  const equity = boundedProbability(trustedFacts?.equity?.heroEquity);
  if (equity === null) {
    warnings.push(warning('equity_unavailable', 'No already-calculated trusted equity result was supplied.'));
    return null;
  }
  const method = trustedFacts.equity.method ? String(trustedFacts.equity.method) : 'unspecified';
  return section('equity', 'Equity', 'supporting', [
    fact('hero_equity', {
      label: 'Hero equity', labelKey: 'analysis.fact.heroEquity', value: equity, unit: 'probability',
      templateKey: 'analysis.equity.hero', fallback: 'The supplied equity result gives Hero {equity}.',
      values: { equity: percent(equity, 1) },
    }),
    fact('equity_method', {
      label: 'Equity method', labelKey: 'analysis.fact.equityMethod', value: method,
      templateKey: 'analysis.equity.method', fallback: 'Equity source method: {method}.', values: { method },
    }),
  ]);
}

function unavailableReasonFor(context, strategyResult, explicitReason) {
  if (explicitReason) return explicitReason;
  if (!context) return 'invalid_context';
  if (!Array.isArray(context.heroCards) || context.heroCards.length !== 2
    || context.heroCards.some((card) => !validCard(card))) return 'missing_hero_cards';
  const boardCount = expectedBoardCount(context.street);
  if (boardCount !== null && (!Array.isArray(context.board) || context.board.length !== boardCount)) {
    return 'waiting_for_board';
  }
  if (!strategyResult || strategyResult.source === 'unavailable'
    || !Array.isArray(strategyResult.actions) || !strategyResult.actions.some((entry) => Number(entry.probability) > 0)) {
    return 'strategy_unavailable';
  }
  return null;
}

export function createAnalysisExplanation({
  decisionContext,
  strategyResult,
  trustedFacts = {},
  authority = 'scenario',
  depth = 'detailed',
  unavailableReason = null,
} = {}) {
  if (decisionContext !== null && decisionContext !== undefined
    && decisionContext.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError('Expected DecisionContext decision-context/v1');
  }
  if (strategyResult !== null && strategyResult !== undefined
    && strategyResult.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION) {
    throw new TypeError('Expected StrategyResult strategy-result/v1');
  }
  if (!['concise', 'detailed'].includes(depth)) throw new TypeError('Analysis depth must be concise or detailed');

  const normalizedAuthority = normalizeAuthority(authority);
  const history = normalizeHistory(trustedFacts?.actionHistory, normalizedAuthority.type);
  const provenance = provenanceFor(strategyResult);
  const warnings = [];
  const actions = normalizeActions(strategyResult);
  const actionAnalysis = makeActionAnalysis(actions);
  const reason = unavailableReasonFor(decisionContext, strategyResult, unavailableReason);
  const sections = [];

  if (decisionContext) {
    const handBoard = handBoardSection(decisionContext, trustedFacts, warnings, depth);
    if (handBoard) sections.push(handBoard);
    sections.push(positionSection(decisionContext, trustedFacts));
    const potOdds = potOddsSection(decisionContext);
    if (potOdds) sections.push(potOdds);
    const spr = sprSection(decisionContext, warnings);
    if (spr) sections.push(spr);
    sections.push(actionContextSection(decisionContext, normalizedAuthority, history, depth, warnings));
    const strategy = strategySection(decisionContext, actions, provenance.source, depth);
    if (strategy) sections.push(strategy);
    const sizing = sizingSection(decisionContext, actions);
    if (sizing) sections.push(sizing);
    const equity = equitySection(trustedFacts, warnings);
    if (equity) sections.push(equity);
  } else {
    warnings.push(warning('decision_context_unavailable', 'DecisionContext v1 is unavailable.'));
  }

  const sourcePresentation = SOURCE_PRESENTATION[provenance.source] || SOURCE_PRESENTATION.unavailable;
  warnings.push(warning(sourcePresentation.warningCode, sourcePresentation.limitation,
    provenance.source === 'unavailable' ? 'warning' : 'info'));
  if (actions.length && actions.every((entry) => entry.evBb === null)) {
    warnings.push(warning('ev_unavailable', 'The strategy source supplies no action EV comparison.'));
  }
  if (Array.isArray(strategyResult?.warnings) && strategyResult.warnings.length) {
    warnings.push(warning(
      'strategy_source_warning',
      `The strategy source reported ${strategyResult.warnings.length} additional limitation(s).`,
      'warning',
    ));
  }
  if (decisionContext && ['percent', 'cap'].includes(decisionContext.rakeMode)) {
    warnings.push(warning(
      'legacy_rake_compatibility',
      'Percentage/capped rake remains a legacy compatibility input outside the canonical accounting model.',
    ));
  }
  if (reason) warnings.push(warning(reason, UNAVAILABLE_COPY[reason] || UNAVAILABLE_COPY.strategy_unavailable, 'warning'));

  const uniqueWarnings = [...new Map(warnings.map((entry) => [entry.code, entry])).values()];
  const availability = reason ? 'unavailable' : uniqueWarnings.length ? 'partial' : 'available';
  const leadingAction = actions[0] || null;
  const headline = reason ? 'Analysis unavailable' : 'Why this action?';
  const headlineKey = reason ? 'analysis.headline.unavailable' : 'analysis.headline.available';
  const summaryValues = reason ? { reason: UNAVAILABLE_COPY[reason] || UNAVAILABLE_COPY.strategy_unavailable } : {
    action: leadingAction?.label || strategyResult?.recommendation?.label || 'The recommendation',
    probability: leadingAction ? percent(leadingAction.probability, 0) : 'unknown',
    source: provenance.label,
  };
  const summary = reason
    ? summaryValues.reason
    : formatAnalysisTemplate('{action} leads at {probability}. Source: {source}.', summaryValues);

  return deepFreeze({
    schemaVersion: ANALYSIS_EXPLANATION_SCHEMA_VERSION,
    depth,
    availability,
    unavailableReason: reason,
    headline,
    headlineKey,
    summary,
    summaryKey: reason ? `analysis.unavailable.${reason}` : 'analysis.summary.recommendation',
    summaryValues,
    sections,
    actionAnalysis,
    warnings: uniqueWarnings,
    provenance: {
      ...provenance,
      limitations: uniqueWarnings.map((entry) => entry.code),
    },
    authority: {
      ...normalizedAuthority,
      historyAvailable: history.length > 0,
    },
  });
}
