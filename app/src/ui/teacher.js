// AnalysisExplanation is structured application data. This file is the thin,
// presentation-only renderer shared by Playbook and Training.

function analysisUiText(value) {
  const copy = String(value || '');
  return typeof t === 'function' ? t(copy) : copy;
}

function analysisMessage(key, fallback, values = {}) {
  const runtime = globalThis.RiverlineI18n;
  if (key && runtime && typeof runtime.resolveTranslation === 'function') {
    const resolution = runtime.resolveTranslation(key);
    if (!resolution.missing && typeof t === 'function') return t(key, values);
  }
  return String(fallback || '').replace(/\{([A-Za-z0-9_]+)\}/g, (token, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
  ));
}

function analysisMessageTemplate(key, fallback) {
  const runtime = globalThis.RiverlineI18n;
  if (key && runtime && typeof runtime.resolveTranslation === 'function') {
    const resolution = runtime.resolveTranslation(key);
    if (!resolution.missing) return String(resolution.value);
  }
  return String(fallback || '');
}

function analysisInterpolatedElement(key, fallback, values = {}, tokenKinds = {}) {
  const element = analysisElement('span', 'analysis-fact-primary analysis-localized-message');
  const template = analysisMessageTemplate(key, fallback);
  const pattern = /\{([A-Za-z0-9_]+)\}/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(template))) {
    if (match.index > cursor) element.appendChild(document.createTextNode(template.slice(cursor, match.index)));
    const name = match[1];
    const value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match[0];
    const kind = tokenKinds[name] || 'text';
    if (kind === 'cards') {
      element.appendChild(analysisOutCardList(value));
    } else if (kind === 'data' || kind === 'user') {
      const token = analysisLiteralElement(
        'span',
        kind === 'data' ? 'poker-data-token' : 'analysis-user-text',
        value,
      );
      if (kind === 'user') token.setAttribute('dir', 'auto');
      token.dataset.analysisToken = kind;
      element.appendChild(token);
    } else {
      element.appendChild(document.createTextNode(String(value)));
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < template.length) element.appendChild(document.createTextNode(template.slice(cursor)));
  return element;
}

const ANALYSIS_CONCEPT_KEYS = Object.freeze({
  'pocket pair': 'analysis.value.pocketPair',
  pair: 'Pair',
  'suited hand': 'analysis.value.suitedHand',
  suited: 'analysis.value.suitedHand',
  'offsuit hand': 'analysis.value.offsuitHand',
  offsuit: 'analysis.value.offsuitHand',
  high_card: 'analysis.value.highCard',
  one_pair: 'analysis.value.onePair',
  two_pair: 'analysis.value.twoPair',
  three_of_a_kind: 'analysis.value.threeOfAKind',
  straight: 'analysis.value.straight',
  flush: 'analysis.value.flush',
  full_house: 'analysis.value.fullHouse',
  four_of_a_kind: 'analysis.value.fourOfAKind',
  straight_flush: 'analysis.value.straightFlush',
  wheel_straight: 'analysis.value.wheelStraight',
  broadway_straight: 'analysis.value.broadwayStraight',
  wheel_straight_flush: 'analysis.value.wheelStraightFlush',
  royal_flush: 'analysis.value.royalFlush',
  board_pair: 'analysis.value.boardPair',
  overpair: 'analysis.value.overpair',
  pocket_pair: 'analysis.value.pocketPair',
  pairs_board_rank: 'analysis.value.pairsBoardRank',
  top_pair: 'analysis.value.topPair',
  middle_pair: 'analysis.value.middlePair',
  lower_pair: 'analysis.value.lowerPair',
  board_two_pair: 'analysis.value.boardTwoPair',
  set: 'analysis.value.set',
  trips: 'analysis.value.trips',
  board_trips: 'analysis.value.boardTrips',
  plays_board: 'analysis.value.playsBoard',
  paired: 'analysis.value.paired',
  unpaired: 'analysis.value.unpaired',
  rainbow: 'analysis.value.rainbow',
  'two-tone': 'analysis.value.twoTone',
  monotone: 'analysis.value.monotone',
  'multi-suit': 'analysis.value.multiSuit',
  connected: 'analysis.value.connected',
  coordinated: 'analysis.value.coordinated',
  disconnected: 'analysis.value.disconnected',
  'in position': 'analysis.value.inPosition',
  in_position: 'analysis.value.inPosition',
  'out of position': 'analysis.value.outOfPosition',
  out_of_position: 'analysis.value.outOfPosition',
  OESD: 'analysis.value.openEndedDraw',
  'open-ended straight draw': 'analysis.value.openEndedDraw',
  'Double Gutshot': 'analysis.value.doubleGutshot',
  'double-gutshot straight draw': 'analysis.value.doubleGutshot',
  Gutshot: 'analysis.value.gutshot',
  'gutshot straight draw': 'analysis.value.gutshot',
  'Flush draw': 'analysis.value.flushDraw',
  flush_draw: 'analysis.value.flushDraw',
  nut_flush_draw: 'analysis.value.nutFlushDraw',
  straight_flush_draw: 'analysis.value.straightFlushDraw',
  gutshot_straight_flush_draw: 'analysis.value.gutshotStraightFlushDraw',
  open_ended_straight_flush_draw: 'analysis.value.openEndedStraightFlushDraw',
  double_gutshot_straight_flush_draw: 'analysis.value.doubleGutshotStraightFlushDraw',
  royal_flush_draw: 'analysis.value.royalFlushDraw',
  wheel_straight_flush_draw: 'analysis.value.wheelStraightFlushDraw',
  open_ended_straight_draw: 'analysis.value.openEndedDraw',
  gutshot: 'analysis.value.gutshot',
  double_gutshot: 'analysis.value.doubleGutshot',
  overcards: 'analysis.value.overcardsShort',
  made_hand_and_draw: 'analysis.value.madeHandAndDraw',
  semibluff_structure: 'analysis.value.bluffStructure.semibluff_structure',
  pair_plus_draw: 'analysis.value.bluffStructure.pair_plus_draw',
  made_hand_with_redraw: 'analysis.value.bluffStructure.made_hand_with_redraw',
  limited_direct_improvement_structure: 'analysis.value.bluffStructure.limited_direct_improvement_structure',
  made_hand_without_direct_draw: 'analysis.value.bluffStructure.made_hand_without_direct_draw',
  overcards_without_direct_draw: 'analysis.value.bluffStructure.overcards_without_direct_draw',
  river_no_future_card_structure: 'analysis.value.bluffStructure.river_no_future_card_structure',
  none: 'analysis.value.flushStateNone',
  three_flush: 'analysis.value.threeFlush',
  four_flush: 'analysis.value.fourFlush',
  board_flush: 'analysis.value.boardFlush',
  'No major draw': 'analysis.value.noMajorDraw'
});

function analysisConceptText(value) {
  const copy = String(value ?? '');
  const key = ANALYSIS_CONCEPT_KEYS[copy] || ANALYSIS_CONCEPT_KEYS[copy.toLocaleLowerCase('en')];
  return key ? analysisMessage(key, analysisTitleCase(copy)) : analysisUiText(analysisTitleCase(copy));
}

function analysisActionText(value) {
  return analysisUiText(String(value || '').replaceAll('_', ' '));
}

function analysisAuthorityText(value) {
  const type = String(value || 'scenario');
  return analysisMessage(`analysis.authority.${type}.label`, analysisTitleCase(type));
}

function analysisElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = analysisUiText(text);
  return element;
}

function analysisLiteralElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

// Presentation grammar only. AnalysisExplanation remains the sole source of
// decision facts, strategy language, provenance, and limitations.
const ANALYSIS_FACT_GROUPS = Object.freeze({
  hero: new Set(['hero_cards', 'preflop_hand_class', 'made_hand', 'hand_components', 'draws', 'draw_outs', 'hero_overcards']),
  board: new Set(['board_pairing', 'board_suits', 'board_connectivity', 'board_broadway_count', 'board_flush_state', 'board_straight_state']),
  economics: new Set(['pot_before_action', 'call_amount', 'required_raw_equity', 'spr', 'heuristic_sampled_equity']),
  context: new Set(['hero_position', 'postflop_position_relation', 'heuristic_opponent_count', 'last_action', 'facing_size', 'table_size', 'context_authority', 'big_blind_check_option', 'no_voluntary_wager_faced']),
});

const ANALYSIS_GROUP_ORDER = Object.freeze({
  hero: ['made_hand', 'draws', 'draw_outs', 'hand_components', 'hero_cards', 'preflop_hand_class', 'hero_overcards'],
  board: ['board_pairing', 'board_suits', 'board_connectivity', 'board_flush_state', 'board_straight_state', 'board_broadway_count'],
  economics: ['pot_before_action', 'call_amount', 'required_raw_equity', 'spr', 'heuristic_sampled_equity'],
  context: ['hero_position', 'postflop_position_relation', 'heuristic_opponent_count', 'last_action', 'facing_size', 'table_size', 'context_authority', 'big_blind_check_option', 'no_voluntary_wager_faced'],
});

function analysisTitleCase(value) {
  const text = String(value ?? '').replaceAll('_', ' ').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function analysisDrawLabel(value) {
  return analysisConceptText(value);
}

function analysisRangeCompositionText(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    const mass = Number(entry.knownComboMass).toFixed(2).replace(/\.00$/, '');
    const share = Number.isFinite(entry.normalizedShare)
      ? ` (${(entry.normalizedShare * 100).toFixed(1)}%)`
      : '';
    return `${analysisConceptText(entry.key)} ${mass}${share}`;
  }).join(' · ');
}

function analysisRangeCompositionElement(entries) {
  const list = analysisElement('span', 'analysis-fact-primary analysis-composition-list');
  (Array.isArray(entries) ? entries : []).forEach((entry, index) => {
    if (index) list.appendChild(document.createTextNode(' · '));
    const item = analysisElement('span', 'analysis-composition-item');
    item.appendChild(analysisElement('span', 'analysis-composition-label', analysisConceptText(entry.key)));
    item.appendChild(document.createTextNode(' '));
    const mass = Number(entry.knownComboMass).toFixed(2).replace(/\.00$/, '');
    const massToken = analysisLiteralElement('span', 'poker-data-token', mass);
    massToken.dataset.analysisToken = 'data';
    item.appendChild(massToken);
    if (Number.isFinite(entry.normalizedShare)) {
      item.appendChild(document.createTextNode(' ('));
      const share = analysisLiteralElement('span', 'poker-data-token', `${(entry.normalizedShare * 100).toFixed(1)}%`);
      share.dataset.analysisToken = 'data';
      item.append(share, document.createTextNode(')'));
    }
    list.appendChild(item);
  });
  return list;
}

function analysisOutCardList(cards) {
  const list = analysisElement('span', 'analysis-out-card-list analysis-card-token');
  (Array.isArray(cards) ? cards : []).forEach((card) => {
    const token = analysisCardTokenElement(card)
      || analysisLiteralElement('span', 'analysis-out-card poker-data-token', card);
    token.dataset.analysisToken = 'data';
    list.appendChild(token);
  });
  return list;
}

function analysisOutRow(family, labelKey, fallback, cards, count) {
  const row = analysisElement('div', 'analysis-out-row');
  row.dataset.outFamily = family;
  row.append(
    analysisElement('span', 'analysis-out-family', analysisMessage(labelKey, fallback)),
    analysisOutCardList(cards),
    analysisLiteralElement('span', 'analysis-out-count poker-data-token', count),
  );
  return row;
}

function analysisDrawOutsElement(drawOuts) {
  const outs = drawOuts || {};
  const element = analysisElement('div', 'analysis-fact-primary analysis-draw-outs');
  if (outs.flush?.count > 0) {
    element.appendChild(analysisOutRow(
      'flush', 'analysis.outs.flush', 'Flush', outs.flush.completionCards, outs.flush.count,
    ));
  }
  if (outs.straight?.count > 0) {
    element.appendChild(analysisOutRow(
      'straight', 'analysis.outs.straight', 'Straight',
      outs.straight.completionCards, outs.straight.count,
    ));
  }
  if (outs.straightFlush?.count > 0) {
    const row = analysisElement('div', 'analysis-out-row');
    row.dataset.outFamily = 'straight_flush';
    row.appendChild(analysisElement(
      'span', 'analysis-out-family',
      analysisMessage('analysis.outs.straightFlush', 'Straight flush'),
    ));
    const results = analysisElement('span', 'analysis-out-results');
    outs.straightFlush.completionResults.forEach((completion) => {
      const subtypeConcept = completion.subtype === 'wheel'
        ? 'wheel_straight_flush'
        : completion.subtype === 'royal' ? 'royal_flush' : 'straight_flush';
      results.appendChild(analysisInterpolatedElement(
        'analysis.value.straightFlushOutSingle',
        '{cards} -> {completion}',
        { cards: [completion.card], completion: analysisConceptText(subtypeConcept) },
        { cards: 'cards' },
      ));
    });
    row.append(
      results,
      analysisLiteralElement(
        'span', 'analysis-out-count poker-data-token', outs.straightFlush.count,
      ),
    );
    element.appendChild(row);
  }
  const summary = analysisInterpolatedElement(
    'analysis.outs.unique',
    'Unique direct improvement cards: {count}',
    { count: outs.uniqueCompletionCardCount || 0 },
    { count: 'data' },
  );
  summary.classList.add('analysis-outs-summary');
  element.appendChild(summary);
  if (outs.overlaps?.length) {
    const overlapCards = outs.overlaps.map((entry) => entry.card);
    const overlap = analysisInterpolatedElement(
      'analysis.outs.shared',
      'Shared out counted once: {cards}',
      { cards: overlapCards },
      { cards: 'cards' },
    );
    overlap.classList.add('analysis-outs-overlap');
    element.appendChild(overlap);
  }
  element.appendChild(analysisElement(
    'small', 'analysis-outs-note',
    analysisMessage(
      'analysis.outs.note',
      'Structural completion cards; not guaranteed winning or clean outs.',
    ),
  ));
  return element;
}

function analysisSemibluffStructureElement(structure) {
  const value = structure || {};
  const element = analysisElement('span', 'analysis-fact-primary analysis-semibluff-structure');
  element.appendChild(analysisElement(
    'span',
    'analysis-semibluff-classification',
    analysisConceptText(value.classification),
  ));
  if (Array.isArray(value.drawLabels) && value.drawLabels.length) {
    element.appendChild(document.createTextNode(': '));
    element.appendChild(analysisElement(
      'span',
      'analysis-semibluff-draws',
      value.drawLabels.map(analysisConceptText).join(' + '),
    ));
  } else if (value.overcardCount > 0) {
    element.appendChild(document.createTextNode(' · '));
    element.appendChild(analysisInterpolatedElement(
      'analysis.value.bluffOvercards',
      '{count} overcard(s)',
      { count: value.overcardCount },
      { count: 'data' },
    ));
  }
  return element;
}

function analysisStructuredFactPrimary(analysisFact) {
  const values = analysisFact.values || {};
  if (analysisFact.key === 'draw_outs') return analysisDrawOutsElement(analysisFact.value);
  if (analysisFact.key === 'semibluff_structure') {
    return analysisSemibluffStructureElement(analysisFact.value);
  }
  if (analysisFact.key === 'bluff_break_even_folds') {
    return analysisLiteralElement('span', 'analysis-fact-primary poker-data-token', values.frequency);
  }
  if (analysisFact.key === 'bluff_risk') {
    return analysisLiteralElement('span', 'analysis-fact-primary poker-data-token', values.risk);
  }
  if (analysisFact.key === 'bluff_immediate_reward') {
    return analysisLiteralElement('span', 'analysis-fact-primary poker-data-token', values.reward);
  }
  if (analysisFact.key === 'bluff_structural_improvement_cards') {
    return analysisInterpolatedElement(
      'analysis.value.structuralImprovementCards',
      '{count} unique cards',
      values,
      { count: 'data' },
    );
  }
  if (analysisFact.key === 'bluff_economics_availability') {
    const reason = analysisMessage(
      `analysis.value.bluffUnavailable.${values.reason}`,
      analysisTitleCase(values.reason),
    );
    return analysisInterpolatedElement(
      'analysis.value.bluffEconomicsUnavailable',
      'Unavailable: {reason}',
      { reason },
    );
  }
  if (analysisFact.key === 'river_bluff_value_reference') {
    return analysisInterpolatedElement(
      'analysis.value.riverBluffValueReference',
      '{bluffUnits}:{valueUnits} bluff:value · {share} bluff share',
      values,
      { bluffUnits: 'data', valueUnits: 'data', share: 'data' },
    );
  }
  if (analysisFact.key.startsWith('range_blocker_effect_')) {
    const key = values.knownMassAvailable
      ? 'analysis.value.rangeBlockerEffect'
      : 'analysis.value.rangeBlockerEffect.unknown';
    const fallback = values.knownMassAvailable
      ? '{rangeLabel}: {physicalBefore} eligible before, {physicalAfter} after · {physicalRemoved} physical combos removed · {knownAffected} known combos affected · known combo mass removed {mass} · {knownCoverage} known coverage'
      : '{rangeLabel}: {physicalBefore} eligible before, {physicalAfter} after · {physicalRemoved} physical combos removed · no known weights among affected combos · {knownCoverage} known coverage';
    return analysisInterpolatedElement(key, fallback, values, {
      rangeLabel: 'user',
      physicalBefore: 'data',
      physicalAfter: 'data',
      physicalRemoved: 'data',
      knownAffected: 'data',
      mass: 'data',
      knownCoverage: 'data',
    });
  }
  if (analysisFact.key.startsWith('supplied_range_summary_')) {
    const stateKey = values.fullyUnknown
      ? 'analysis.value.rangeState.fullyUnknown'
      : `analysis.value.rangeState.${values.state}`;
    const stateLabel = analysisMessage(stateKey, analysisTitleCase(values.state));
    return analysisInterpolatedElement(
      'analysis.value.rangeSummary',
      '{rangeLabel} · {known}/{eligible} known combos · known combo mass {mass} · {coverage} known coverage · {stateLabel}',
      { ...values, stateLabel },
      {
        rangeLabel: 'user',
        known: 'data',
        eligible: 'data',
        mass: 'data',
        coverage: 'data',
      },
    );
  }
  if (analysisFact.key.startsWith('supplied_range_composition_')
    || analysisFact.key.startsWith('supplied_range_draws_')) {
    return analysisRangeCompositionElement(analysisFact.value);
  }
  if (analysisFact.key === 'hero_blocker_structure') {
    return analysisInterpolatedElement(
      'analysis.value.heroBlockerStructure',
      '{count} physical combos removed',
      values,
      { count: 'data', cards: 'data' },
    );
  }
  return null;
}

function analysisFactPrimaryText(analysisFact) {
  const values = analysisFact.values || {};
  if (analysisFact.key.startsWith('range_blocker_effect_')) {
    return analysisMessage(
      'analysis.value.rangeBlockerEffect',
      `${values.physicalRemoved} physical combos removed; known combo mass removed ${values.mass}`,
      values,
    );
  }
  if (analysisFact.key.startsWith('supplied_range_summary_')) {
    return analysisMessage(
      'analysis.value.rangeSummary',
      `${values.rangeLabel} · known combo mass ${values.mass} · ${values.coverage} known coverage`,
      values,
    );
  }
  if (analysisFact.key.startsWith('supplied_range_composition_')
    || analysisFact.key.startsWith('supplied_range_draws_')) {
    return analysisRangeCompositionText(analysisFact.value);
  }
  switch (analysisFact.key) {
    case 'hero_cards': return values.cards || (Array.isArray(analysisFact.value) ? analysisFact.value.join(' ') : analysisFact.value);
    case 'preflop_hand_class': return analysisConceptText(values.classification || analysisFact.value);
    case 'made_hand': return analysisConceptText(values.madeHand || analysisFact.value);
    case 'hand_components': return (Array.isArray(analysisFact.value) ? analysisFact.value : []).map(analysisConceptText).join(' · ');
    case 'draws': return (Array.isArray(analysisFact.value) ? analysisFact.value : [analysisFact.value]).map(analysisDrawLabel).join(' · ');
    case 'hero_overcards': return analysisMessage('analysis.value.overcards', `${values.count ?? analysisFact.value} overcard(s)`, { count: values.count ?? analysisFact.value });
    case 'board_pairing': return analysisMessage(analysisFact.value ? 'analysis.value.paired' : 'analysis.value.unpaired', analysisFact.value ? 'Paired' : 'Unpaired');
    case 'board_suits': return analysisConceptText(values.tone || analysisFact.value);
    case 'board_connectivity': return analysisConceptText(values.connectivity || analysisFact.value);
    case 'board_broadway_count': return analysisMessage('analysis.value.broadwayCards', `${values.count ?? analysisFact.value} Broadway card(s)`, { count: values.count ?? analysisFact.value });
    case 'board_flush_state': return analysisConceptText(analysisFact.value);
    case 'board_straight_state': {
      if (analysisFact.value?.completed) return analysisMessage('analysis.value.straightOnBoard', 'Straight completed on board');
      const ranks = analysisFact.value?.completionRanks || [];
      return ranks.length
        ? analysisMessage('analysis.value.straightCompletionRanks', `One-card board completion: ${ranks.join(', ')}`, { ranks: ranks.join(', ') })
        : analysisMessage('analysis.value.noImmediateStraightCompletion', 'No one-card board straight completion');
    }
    case 'hero_blocker_structure': return analysisMessage('analysis.value.heroBlockerStructure', `${values.count} physical combos removed`, { count: values.count, cards: values.cards });
    case 'bluff_action': return analysisActionText(values.action || analysisFact.value);
    case 'range_availability': return analysisMessage('analysis.value.rangeUnavailable', 'Unavailable without an explicit range source');
    case 'pot_before_action': return values.pot || analysisFact.value;
    case 'call_amount': return values.callAmount || analysisFact.value;
    case 'required_raw_equity': return values.requiredEquity || analysisFact.value;
    case 'spr': return String(values.spr ?? analysisFact.value);
    case 'heuristic_sampled_equity': return values.equity || analysisFact.value;
    case 'hero_position': return values.position || analysisFact.value;
    case 'postflop_position_relation': return analysisConceptText(analysisFact.value);
    case 'heuristic_opponent_count': return String(values.opponents ?? analysisFact.value);
    case 'last_action': return analysisActionText(analysisTitleCase(values.lastAction || analysisFact.value));
    case 'facing_size': return values.facingSize || analysisFact.value;
    case 'table_size': return analysisMessage('analysis.value.tableSize', `${values.tableSize ?? analysisFact.value}-max`, { count: values.tableSize ?? analysisFact.value });
    case 'context_authority': return analysisAuthorityText(analysisFact.value);
    case 'big_blind_check_option': return analysisMessage('analysis.value.freeCheck', 'Free check available');
    case 'no_voluntary_wager_faced': return analysisMessage('analysis.value.noVoluntaryWager', 'No voluntary wager');
    default: return analysisMessage(analysisFact.templateKey, analysisFact.text, analysisPartValues(analysisFact));
  }
}

function analysisFactSecondaryText(analysisFact) {
  if (analysisFact.key === 'spr' && analysisFact.values?.category) {
    const category = String(analysisFact.values.category || 'medium').toLocaleLowerCase('en');
    return analysisMessage(`analysis.value.${category}Spr`, `${analysisTitleCase(category)} SPR`);
  }
  if (analysisFact.key === 'heuristic_sampled_equity') return analysisMessage('analysis.value.assumedRange', 'vs assumed opponent range');
  if (analysisFact.key === 'heuristic_opponent_count') return analysisMessage('analysis.value.sampledOpponents', 'opponents sampled');
  if (analysisFact.key === 'bluff_break_even_folds') return analysisMessage(
    'analysis.value.breakEvenPureBluffNote',
    'Pure zero-equity bluff reference',
  );
  if (analysisFact.key === 'river_bluff_value_reference') return analysisMessage(
    'analysis.value.simplifiedAssumptions',
    'Simplified heads-up river assumptions',
  );
  return null;
}

function analysisCardTokenElement(card) {
  const value = String(card || '');
  const match = value.match(/^([2-9TJQKA])([hdcs])$/i);
  if (!match) return null;
  const suitId = match[2].toLowerCase();
  const canonicalRank = match[1].toUpperCase();
  const presentation = globalThis.RiverlineCardPresentation;
  if (!presentation) return null;
  const rank = presentation.displayCardRank(canonicalRank, document.documentElement.dataset.cardRankStyle);
  const suit = presentation.cardSuitPresentation(suitId);
  const token = analysisElement('span', `analysis-mini-card riverline-card card--suit-${suitId}`);
  token.dataset.cardSize = 'mini';
  token.setAttribute('role', 'img');
  token.setAttribute('aria-label', `${rank}${suit.symbol}`);
  presentation.appendCardFaceContents(token, {
    rank: canonicalRank,
    suit: suitId,
    rankStyle: document.documentElement.dataset.cardRankStyle,
  });
  return token;
}

function analysisCardPairElement(analysisFact) {
  const cards = Array.isArray(analysisFact.value)
    ? analysisFact.value
    : String(analysisFact.values?.cards || analysisFact.value || '').trim().split(/\s+/);
  const token = analysisElement('span', 'analysis-card-token');
  const rendered = cards.map(analysisCardTokenElement).filter(Boolean);
  if (!rendered.length) {
    token.textContent = analysisUiText(analysisFactPrimaryText(analysisFact));
    return token;
  }
  token.setAttribute('aria-label', rendered.map((item) => item.getAttribute('aria-label')).join(' '));
  token.append(...rendered);
  return token;
}

function analysisFactElement(analysisFact) {
  const cell = analysisElement('div', 'analysis-key-fact');
  cell.dataset.factKind = analysisFact.kind;
  cell.dataset.factKey = analysisFact.key;
  const value = analysisElement('dd', 'analysis-fact-value');
  const structuredPrimary = analysisStructuredFactPrimary(analysisFact);
  const primary = analysisFact.key === 'hero_cards'
    ? analysisCardPairElement(analysisFact)
    : structuredPrimary || analysisElement('span', 'analysis-fact-primary', analysisFactPrimaryText(analysisFact));
  if (new Set([
    'hero_cards', 'pot_before_action', 'call_amount', 'pot_after_call', 'required_raw_equity',
    'spr', 'heuristic_sampled_equity', 'hero_position', 'facing_size', 'table_size',
    'hero_equity', 'heuristic_samples_completed', 'heuristic_range_fraction', 'board_straight_state',
    'bluff_risk', 'bluff_immediate_reward', 'bluff_break_even_folds'
  ]).has(analysisFact.key)) primary.classList.add('poker-data-token');
  value.appendChild(primary);
  const secondaryText = analysisFactSecondaryText(analysisFact);
  if (secondaryText) value.appendChild(analysisElement('small', 'analysis-fact-secondary', secondaryText));
  cell.append(
    analysisElement('dt', null, analysisMessage(analysisFact.labelKey, analysisFact.label)),
    value,
  );
  return cell;
}

function analysisPartValues(part) {
  const values = { ...(part?.values || {}) };
  ['action', 'primary', 'secondary'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) values[key] = analysisActionText(values[key]);
  });
  if (Object.prototype.hasOwnProperty.call(values, 'classification')) values.classification = analysisConceptText(values.classification);
  if (Object.prototype.hasOwnProperty.call(values, 'tone')) values.tone = analysisConceptText(values.tone);
  if (Object.prototype.hasOwnProperty.call(values, 'connectivity')) values.connectivity = analysisConceptText(values.connectivity);
  if (Object.prototype.hasOwnProperty.call(values, 'category')) values.category = analysisConceptText(values.category);
  if (Object.prototype.hasOwnProperty.call(values, 'lastAction')) values.lastAction = analysisActionText(values.lastAction);
  if (Object.prototype.hasOwnProperty.call(values, 'authority')) values.authority = analysisAuthorityText(values.authority);
  return values;
}

function analysisTextPart(part, explanation) {
  const values = analysisPartValues(part);
  if (part.templateKey === 'analysis.strategy.dominant') {
    const secondary = explanation?.actionAnalysis?.find((entry, index) => index > 0 && entry.probability > 0);
    if (secondary) {
      return analysisMessage('analysis.strategy.dominant.withSecondary', part.text, {
        ...values,
        secondary: analysisActionText(secondary.label),
        secondaryProbability: `${(secondary.probability * 100).toFixed(0)}%`
      });
    }
  }
  return analysisMessage(part.templateKey, part.text, values);
}

function analysisSectionElement(analysisSection, facts, explanation) {
  const sectionElement = analysisElement('section', 'analysis-detail-section');
  sectionElement.dataset.analysisSection = analysisSection.key;
  sectionElement.dataset.importance = analysisSection.importance;
  sectionElement.appendChild(analysisElement('h4', 'analysis-detail-title', analysisMessage(analysisSection.titleKey, analysisSection.title)));
  if (facts.length) {
    const list = analysisElement('dl', 'analysis-detail-facts');
    facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
    sectionElement.appendChild(list);
  }
  analysisSection.textParts.forEach((part) => {
    const paragraph = analysisElement('p', 'analysis-explanation-text', analysisTextPart(part, explanation));
    paragraph.dataset.textKind = part.kind;
    sectionElement.appendChild(paragraph);
  });
  return sectionElement;
}

function factsForGroup(explanation, group) {
  const facts = explanation.sections
    .flatMap((entry) => entry.facts)
    .filter((entry) => ANALYSIS_FACT_GROUPS[group].has(entry.key));
  return facts.sort((left, right) => (
    ANALYSIS_GROUP_ORDER[group].indexOf(left.key) - ANALYSIS_GROUP_ORDER[group].indexOf(right.key)
  ));
}

function analysisFactGroup(title, group, facts) {
  if (!facts.length) return null;
  const region = analysisElement('section', `analysis-fact-group analysis-${group}-facts`);
  region.dataset.analysisGroup = group;
  region.appendChild(analysisElement('h4', 'analysis-region-title', title));
  const list = analysisElement('dl', 'analysis-key-facts');
  facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
  region.appendChild(list);
  return region;
}

function analysisHeroState(explanation) {
  const heroFacts = factsForGroup(explanation, 'hero');
  const boardFacts = factsForGroup(explanation, 'board');
  if (!heroFacts.length && !boardFacts.length) return null;
  const region = analysisElement('section', 'analysis-hero-state');
  const hero = analysisFactGroup(analysisMessage('analysis.ui.heroState', 'Hero state'), 'hero', heroFacts);
  const board = analysisFactGroup(analysisMessage('analysis.ui.board', 'Board'), 'board', boardFacts);
  if (hero) region.appendChild(hero);
  if (board) region.appendChild(board);
  return region;
}

function analysisFactByKey(explanation, key) {
  return explanation.sections.flatMap((entry) => entry.facts).find((entry) => entry.key === key) || null;
}

const TRAINING_RELEVANT_FACT_PRIORITY = Object.freeze([
  'preflop_hand_class',
  'made_hand',
  'draws',
  'draw_outs',
  'hero_overcards',
  'board_pairing',
  'board_suits',
  'board_connectivity',
  'call_amount',
  'pot_before_action',
  'required_raw_equity',
  'spr',
]);

/**
 * Project already-authoritative AnalysisExplanation facts into Training's
 * immediate answer layer. This deliberately excludes generic card-removal
 * facts; exhaustive evidence remains in the shared Explain renderer.
 */
function renderTrainingRelevantFacts(container, explanation, { limit = 6 } = {}) {
  if (!container) return null;
  container.replaceChildren();
  const available = explanation?.schemaVersion === 'analysis-explanation/v1';
  const facts = available
    ? TRAINING_RELEVANT_FACT_PRIORITY
      .map((key) => analysisFactByKey(explanation, key))
      .filter(Boolean)
      .slice(0, limit)
    : [];
  container.hidden = facts.length === 0;
  if (!facts.length) return null;
  const list = analysisElement('dl', 'analysis-key-facts training-relevant-fact-list');
  facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
  container.appendChild(list);
  return list;
}

function studyHintDefinition(explanation, step, { street = null } = {}) {
  const preflopHandClass = analysisFactByKey(explanation, 'preflop_hand_class');
  const preflop = street === 'preflop' || (!street && Boolean(preflopHandClass));
  if (step === 1) {
    const facts = (preflop
      ? ['preflop_hand_class', 'hero_cards', 'hero_position']
      : ['made_hand', 'draws', 'hero_cards'])
      .map((key) => analysisFactByKey(explanation, key)).filter(Boolean);
    return {
      title: preflop
        ? analysisMessage('analysis.hint.startingHand.title', 'Starting hand')
        : analysisMessage('analysis.hint.hand.title', 'Hand'),
      prompt: preflop
        ? analysisMessage('analysis.hint.startingHand.prompt', 'How does Hero\'s starting-hand class fit this preflop position and action?')
        : analysisMessage('analysis.hint.hand.prompt', 'What made hand does Hero have here? Are there meaningful draws?'),
      facts: facts.length ? facts : [analysisFactByKey(explanation, 'hero_cards')].filter(Boolean),
    };
  }
  if (step === 2) {
    const call = analysisFactByKey(explanation, 'call_amount');
    return {
      title: analysisMessage('analysis.hint.price.title', 'Price'),
      prompt: call && Number(call.value) > 0
        ? analysisMessage('analysis.hint.price.call', 'How much are you being asked to call relative to the pot?')
        : analysisMessage('analysis.hint.price.check', 'Is Hero facing a bet, or can the decision continue without calling?'),
      facts: ['pot_before_action', 'call_amount', 'required_raw_equity', 'spr']
        .map((key) => analysisFactByKey(explanation, key)).filter(Boolean),
    };
  }
  return {
    title: preflop
      ? analysisMessage('analysis.hint.position.title', 'Position & field')
      : analysisMessage('analysis.hint.board.title', 'Board & field'),
    prompt: preflop
      ? analysisMessage('analysis.hint.position.prompt', 'How should Hero\'s position, table size, and prior action shape this preflop decision?')
      : analysisMessage('analysis.hint.board.prompt', 'How should the board texture and number of opponents affect the strength of this hand?'),
    facts: (preflop
      ? ['hero_position', 'table_size', 'big_blind_check_option', 'heuristic_opponent_count']
      : ['board_pairing', 'board_suits', 'board_connectivity', 'heuristic_opponent_count', 'table_size', 'postflop_position_relation'])
      .map((key) => analysisFactByKey(explanation, key)).filter(Boolean),
  };
}

function renderAnalysisStudyHints(container, explanation, step = 0, options = {}) {
  if (!container) return null;
  container.replaceChildren();
  if (!explanation || explanation.schemaVersion !== 'analysis-explanation/v1' || step < 1) return null;
  const currentStep = Math.min(3, step);
  const hint = studyHintDefinition(explanation, currentStep, options);
  const article = analysisElement('article', 'analysis-study-hint');
  article.dataset.hintStep = String(step);
  article.append(
    analysisElement('p', 'analysis-study-hint-count', analysisMessage('analysis.hint.count', `Hint ${currentStep} of 3 · ${hint.title}`, { current: currentStep, total: 3, title: hint.title })),
    analysisElement('p', 'analysis-study-hint-prompt', hint.prompt),
  );
  if (hint.facts.length) {
    const nudge = analysisElement('div', 'analysis-study-hint-nudge');
    nudge.appendChild(analysisElement('strong', null, analysisMessage('analysis.hint.spotCheck', 'Spot check')));
    const list = analysisElement('dl', 'analysis-study-hint-facts');
    hint.facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
    nudge.appendChild(list);
    article.appendChild(nudge);
  }
  container.appendChild(article);
  return article;
}

function analysisProvenanceLabel(explanation) {
  return analysisMessage(explanation?.provenance?.labelKey, explanation?.provenance?.label || 'Source unavailable');
}

function analysisFactSourcesElement(explanation) {
  const sources = Array.isArray(explanation?.factSources) ? explanation.factSources : [];
  if (sources.length <= 1) return null;
  const region = analysisElement('section', 'analysis-fact-sources');
  const title = analysisElement('h4', 'analysis-region-title', analysisMessage('analysis.ui.factSources', 'Fact sources'));
  const list = analysisElement('dl', 'analysis-fact-source-list');
  sources.filter((entry) => entry.group !== 'strategy').forEach((entry) => {
    const item = analysisElement('div', 'analysis-fact-source-row');
    item.append(
      analysisElement('dt', null, analysisMessage(entry.labelKey, entry.label)),
      analysisElement('dd', null, analysisMessage(entry.sourceLabelKey, entry.sourceLabel)),
    );
    list.appendChild(item);
  });
  region.append(title, list);
  return region;
}

function analysisSummaryText(explanation) {
  if (explanation.availability === 'unavailable') {
    return analysisMessage(explanation.summaryKey, explanation.summary, explanation.summaryValues || {});
  }
  const primary = explanation.actionAnalysis?.[0];
  return analysisMessage(explanation.summaryKey, explanation.summary, {
    ...(explanation.summaryValues || {}),
    action: analysisActionText(primary?.label || explanation.summaryValues?.action),
    probability: primary ? `${(primary.probability * 100).toFixed(0)}%` : explanation.summaryValues?.probability,
    source: explanation.truth ? analysisUiText(explanation.summaryValues.source) : analysisProvenanceLabel(explanation)
  });
}

function analysisWarningText(entry, explanation) {
  let key = entry.messageKey;
  if (entry.code === 'heuristic_source') {
    key = explanation?.provenance?.source === 'heuristic_postflop'
      ? 'analysis.warning.heuristic_source.postflop'
      : 'analysis.warning.heuristic_source.preflop';
  }
  return analysisMessage(key, entry.message, entry.values || {});
}

function renderAnalysisExplanation(container, explanation, options = {}) {
  if (!container) return null;
  container.replaceChildren();

  if (!explanation || explanation.schemaVersion !== 'analysis-explanation/v1') {
    const empty = analysisElement(
      'p',
      'analysis-explanation-empty',
      options.emptyMessage || 'Decision analysis is unavailable.',
    );
    container.appendChild(empty);
    container.dataset.analysisAvailability = 'unavailable';
    return empty;
  }

  const surface = options.surface === 'training' ? 'training' : 'playbook';
  const article = analysisElement('article', 'analysis-explanation analysis-presentation');
  article.dataset.analysisDepth = explanation.depth;
  article.dataset.analysisAvailability = explanation.availability;
  article.dataset.analysisSurface = surface;
  article.dataset.analysisGrammar = 'summary-key-facts-reasons-details-provenance';

  const header = analysisElement('header', 'analysis-summary');
  header.append(
    analysisElement('h3', 'analysis-explanation-headline', analysisMessage(explanation.headlineKey, explanation.headline)),
    analysisElement('p', 'analysis-explanation-summary', analysisSummaryText(explanation)),
  );
  article.appendChild(header);

  const heroFacts = factsForGroup(explanation, 'hero');
  const boardFacts = factsForGroup(explanation, 'board');
  const economicsFacts = factsForGroup(explanation, 'economics');
  const contextFacts = factsForGroup(explanation, 'context');
  const heroRegion = analysisHeroState(explanation);
  if (heroRegion) article.appendChild(heroRegion);
  const economicsRegion = analysisFactGroup(analysisMessage('analysis.ui.decisionEconomics', 'Decision economics'), 'economics', economicsFacts);
  if (economicsRegion) article.appendChild(economicsRegion);
  const standaloneSections = (surface === 'training'
    ? ['bluff_pressure', 'range']
    : ['bluff_pressure', 'blockers', 'range'])
    .map((key) => explanation.sections.find((entry) => entry.key === key))
    .filter(Boolean);
  standaloneSections.forEach((entry) => {
    const element = analysisSectionElement(entry, entry.facts, explanation);
    element.classList.add('analysis-primary-structural-section');
    article.appendChild(element);
  });

  if (explanation.availability === 'unavailable') {
    const contextRegion = analysisFactGroup(analysisMessage('analysis.ui.context', 'Context'), 'context', contextFacts);
    if (contextRegion) article.appendChild(contextRegion);
    article.classList.add('is-unavailable');
    article.appendChild(analysisElement('p', 'analysis-unavailable-note', analysisMessage('analysis.ui.unlockDetail', 'Add the missing decision facts to unlock detailed analysis.')));
    const provenance = analysisElement('footer', 'analysis-provenance');
    const source = analysisElement('div', 'analysis-provenance-source');
    source.append(
      analysisElement('span', null, analysisMessage('analysis.ui.source', 'Source')),
      analysisElement('strong', null, analysisProvenanceLabel(explanation)),
    );
    provenance.appendChild(source);
    const factSources = analysisFactSourcesElement(explanation);
    if (factSources) provenance.appendChild(factSources);
    const warning = explanation.warnings.find((entry) => entry.severity === 'warning');
    if (warning) provenance.appendChild(analysisElement('p', 'analysis-warning', analysisWarningText(warning, explanation)));
    article.appendChild(provenance);
    container.appendChild(article);
    container.dataset.analysisAvailability = explanation.availability;
    return article;
  }

  const strategy = explanation.sections.find((entry) => entry.key === 'strategy_mix');
  const reasonParts = strategy?.textParts || [];
  if (reasonParts.length) {
    const reasons = analysisElement('section', 'analysis-reasoning-blocks');
    reasons.appendChild(analysisElement('h4', 'analysis-region-title', analysisMessage('analysis.ui.primaryReasons', 'Primary reasons')));
    reasonParts.forEach((part) => {
      const reason = analysisElement('p', 'analysis-reasoning-block', analysisTextPart(part, explanation));
      reason.dataset.textKind = part.kind;
      reasons.appendChild(reason);
    });
    article.appendChild(reasons);
  }

  const contextRegion = analysisFactGroup(analysisMessage('analysis.ui.context', 'Context'), 'context', contextFacts);
  if (contextRegion) article.appendChild(contextRegion);

  const selectedKeys = new Set([
    ...heroFacts,
    ...boardFacts,
    ...economicsFacts,
    ...contextFacts,
    ...standaloneSections.flatMap((entry) => entry.facts),
  ].map((entry) => entry.key));
  const details = analysisElement('details', 'analysis-detail-group');
  details.dataset.analysisDisclosure = 'supporting-detail';
  details.appendChild(analysisElement('summary', null, analysisMessage('analysis.ui.supportingDetail', 'Supporting detail')));
  const detailBody = analysisElement('div', 'analysis-detail-groups');
  explanation.sections.forEach((analysisSection) => {
    if (analysisSection.key === 'strategy_mix') return;
    const facts = analysisSection.facts.filter((entry) => !selectedKeys.has(entry.key)
      && !(surface === 'training' && entry.key.startsWith('history_')));
    if (!facts.length && !analysisSection.textParts.length) return;
    detailBody.appendChild(analysisSectionElement(analysisSection, facts, explanation));
  });
  if (detailBody.childElementCount) {
    details.appendChild(detailBody);
    article.appendChild(details);
  }

  const footer = analysisElement('footer', 'analysis-provenance');
  const source = analysisElement('div', 'analysis-provenance-source');
  source.append(
    analysisElement('span', null, analysisMessage('analysis.ui.source', 'Source')),
    analysisElement('strong', null, analysisProvenanceLabel(explanation)),
  );
  if (explanation.provenance.modelVersion) {
    source.appendChild(analysisElement('small', null, analysisMessage('analysis.ui.model', `Model ${explanation.provenance.modelVersion}`, { version: explanation.provenance.modelVersion })));
  }
  if (Number.isFinite(explanation.provenance.confidence)) {
    source.appendChild(analysisElement('small', null, analysisMessage('analysis.ui.confidence', `Confidence ${(explanation.provenance.confidence * 100).toFixed(0)}%`, { value: (explanation.provenance.confidence * 100).toFixed(0) })));
  }
  if (Number.isFinite(explanation.provenance.coverage)) {
    source.appendChild(analysisElement('small', null, analysisMessage('analysis.ui.coverage', `Coverage ${(explanation.provenance.coverage * 100).toFixed(0)}%`, { value: (explanation.provenance.coverage * 100).toFixed(0) })));
  }
  footer.appendChild(source);
  const factSources = analysisFactSourcesElement(explanation);
  if (factSources) footer.appendChild(factSources);

  const criticalWarnings = explanation.warnings.filter((entry) => entry.severity === 'warning');
  if (criticalWarnings.length) {
    const warnings = analysisElement('aside', 'analysis-warning-list');
    warnings.setAttribute('aria-label', analysisMessage('analysis.ui.importantLimitations', 'Important limitations'));
    criticalWarnings.forEach((entry) => {
      const item = analysisElement('p', 'analysis-warning', analysisWarningText(entry, explanation));
      item.dataset.warningCode = entry.code;
      warnings.appendChild(item);
    });
    footer.appendChild(warnings);
  }

  const secondaryWarnings = explanation.warnings.filter((entry) => entry.severity !== 'warning');
  if (secondaryWarnings.length) {
    const limitations = analysisElement('details', 'analysis-limitations');
    const summary = analysisElement('summary', null, analysisMessage('analysis.ui.limits', `Limits & caveats (${secondaryWarnings.length})`, { count: secondaryWarnings.length }));
    const list = analysisElement('ul', null);
    secondaryWarnings.forEach((entry) => {
      const item = analysisElement('li', null, analysisWarningText(entry, explanation));
      item.dataset.warningCode = entry.code;
      item.dataset.warningSeverity = entry.severity;
      list.appendChild(item);
    });
    limitations.append(summary, list);
    footer.appendChild(limitations);
  }
  article.appendChild(footer);
  container.appendChild(article);
  container.dataset.analysisAvailability = explanation.availability;
  return article;
}

window.renderAnalysisExplanation = renderAnalysisExplanation;
window.renderAnalysisStudyHints = renderAnalysisStudyHints;
window.renderTrainingRelevantFacts = renderTrainingRelevantFacts;
