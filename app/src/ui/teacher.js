// AnalysisExplanation is structured application data. This file is the thin,
// presentation-only renderer shared by Playbook and Training.

function analysisUiText(value) {
  const copy = String(value || '');
  return typeof t === 'function' ? t(copy) : copy;
}

function analysisElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = analysisUiText(text);
  return element;
}

// Presentation grammar only. AnalysisExplanation remains the sole source of
// decision facts, strategy language, provenance, and limitations.
const ANALYSIS_FACT_GROUPS = Object.freeze({
  hero: new Set(['hero_cards', 'preflop_hand_class', 'made_hand', 'draws', 'hero_overcards']),
  board: new Set(['board_pairing', 'board_suits', 'board_connectivity', 'board_broadway_count']),
  economics: new Set(['pot_before_action', 'call_amount', 'required_raw_equity', 'spr', 'heuristic_sampled_equity']),
  context: new Set(['hero_position', 'postflop_position_relation', 'heuristic_opponent_count', 'last_action', 'facing_size', 'table_size', 'context_authority', 'big_blind_check_option', 'no_voluntary_wager_faced']),
});

const ANALYSIS_GROUP_ORDER = Object.freeze({
  hero: ['made_hand', 'draws', 'hero_cards', 'preflop_hand_class', 'hero_overcards'],
  board: ['board_pairing', 'board_suits', 'board_connectivity', 'board_broadway_count'],
  economics: ['pot_before_action', 'call_amount', 'required_raw_equity', 'spr', 'heuristic_sampled_equity'],
  context: ['hero_position', 'postflop_position_relation', 'heuristic_opponent_count', 'last_action', 'facing_size', 'table_size', 'context_authority', 'big_blind_check_option', 'no_voluntary_wager_faced'],
});

function analysisTitleCase(value) {
  const text = String(value ?? '').replaceAll('_', ' ').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function analysisDrawLabel(value) {
  const labels = {
    OESD: 'Open-ended straight draw',
    'Double Gutshot': 'Double-gutshot straight draw',
    Gutshot: 'Gutshot straight draw',
  };
  return labels[value] || String(value);
}

function analysisFactPrimaryText(analysisFact) {
  const values = analysisFact.values || {};
  switch (analysisFact.key) {
    case 'hero_cards': return values.cards || (Array.isArray(analysisFact.value) ? analysisFact.value.join(' ') : analysisFact.value);
    case 'preflop_hand_class': return analysisTitleCase(values.classification || analysisFact.value);
    case 'made_hand': return values.madeHand || analysisFact.value;
    case 'draws': return (Array.isArray(analysisFact.value) ? analysisFact.value : [analysisFact.value]).map(analysisDrawLabel).join(' · ');
    case 'hero_overcards': return `${values.count ?? analysisFact.value} overcard${Number(values.count ?? analysisFact.value) === 1 ? '' : 's'}`;
    case 'board_pairing': return analysisFact.value ? 'Paired' : 'Unpaired';
    case 'board_suits': return analysisTitleCase(values.tone || analysisFact.value);
    case 'board_connectivity': return analysisTitleCase(values.connectivity || analysisFact.value);
    case 'board_broadway_count': return `${values.count ?? analysisFact.value} Broadway card${Number(values.count ?? analysisFact.value) === 1 ? '' : 's'}`;
    case 'pot_before_action': return values.pot || analysisFact.value;
    case 'call_amount': return values.callAmount || analysisFact.value;
    case 'required_raw_equity': return values.requiredEquity || analysisFact.value;
    case 'spr': return String(values.spr ?? analysisFact.value);
    case 'heuristic_sampled_equity': return values.equity || analysisFact.value;
    case 'hero_position': return values.position || analysisFact.value;
    case 'postflop_position_relation': return analysisTitleCase(analysisFact.value);
    case 'heuristic_opponent_count': return String(values.opponents ?? analysisFact.value);
    case 'last_action': return analysisTitleCase(values.lastAction || analysisFact.value);
    case 'facing_size': return values.facingSize || analysisFact.value;
    case 'table_size': return `${values.tableSize ?? analysisFact.value}-max`;
    case 'context_authority': return values.authority || analysisFact.value;
    case 'big_blind_check_option': return 'Free check available';
    case 'no_voluntary_wager_faced': return 'No voluntary wager';
    default: return analysisFact.text;
  }
}

function analysisFactSecondaryText(analysisFact) {
  if (analysisFact.key === 'spr' && analysisFact.values?.category) {
    return `${analysisTitleCase(analysisFact.values.category)} SPR`;
  }
  if (analysisFact.key === 'heuristic_sampled_equity') return 'vs assumed opponent range';
  if (analysisFact.key === 'heuristic_opponent_count') return 'opponents sampled';
  return null;
}

function analysisFactElement(analysisFact) {
  const cell = analysisElement('div', 'analysis-key-fact');
  cell.dataset.factKind = analysisFact.kind;
  cell.dataset.factKey = analysisFact.key;
  const value = analysisElement('dd', 'analysis-fact-value');
  const primary = analysisElement('span', 'analysis-fact-primary', analysisFactPrimaryText(analysisFact));
  if (analysisFact.key === 'hero_cards') primary.classList.add('analysis-card-token');
  value.appendChild(primary);
  const secondaryText = analysisFactSecondaryText(analysisFact);
  if (secondaryText) value.appendChild(analysisElement('small', 'analysis-fact-secondary', secondaryText));
  cell.append(
    analysisElement('dt', null, analysisFact.label),
    value,
  );
  return cell;
}

function analysisSectionElement(analysisSection, facts) {
  const sectionElement = analysisElement('section', 'analysis-detail-section');
  sectionElement.dataset.analysisSection = analysisSection.key;
  sectionElement.dataset.importance = analysisSection.importance;
  sectionElement.appendChild(analysisElement('h4', 'analysis-detail-title', analysisSection.title));
  if (facts.length) {
    const list = analysisElement('dl', 'analysis-detail-facts');
    facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
    sectionElement.appendChild(list);
  }
  analysisSection.textParts.forEach((part) => {
    const paragraph = analysisElement('p', 'analysis-explanation-text', part.text);
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
  const hero = analysisFactGroup('Hero state', 'hero', heroFacts);
  const board = analysisFactGroup('Board', 'board', boardFacts);
  if (hero) region.appendChild(hero);
  if (board) region.appendChild(board);
  return region;
}

function analysisFactByKey(explanation, key) {
  return explanation.sections.flatMap((entry) => entry.facts).find((entry) => entry.key === key) || null;
}

function studyHintDefinition(explanation, step) {
  if (step === 1) {
    const facts = ['made_hand', 'draws', 'preflop_hand_class']
      .map((key) => analysisFactByKey(explanation, key)).filter(Boolean);
    return {
      title: 'Hand',
      prompt: 'What made hand does Hero have here? Are there meaningful draws?',
      facts: facts.length ? facts : [analysisFactByKey(explanation, 'hero_cards')].filter(Boolean),
    };
  }
  if (step === 2) {
    const call = analysisFactByKey(explanation, 'call_amount');
    return {
      title: 'Price',
      prompt: call && Number(call.value) > 0
        ? 'How much are you being asked to call relative to the pot?'
        : 'Is Hero facing a bet, or can the decision continue without calling?',
      facts: ['pot_before_action', 'call_amount', 'required_raw_equity', 'spr']
        .map((key) => analysisFactByKey(explanation, key)).filter(Boolean),
    };
  }
  return {
    title: 'Board & field',
    prompt: 'How should the board texture and number of opponents affect the strength of this hand?',
    facts: ['board_pairing', 'board_suits', 'board_connectivity', 'heuristic_opponent_count', 'table_size', 'postflop_position_relation']
      .map((key) => analysisFactByKey(explanation, key)).filter(Boolean),
  };
}

function renderAnalysisStudyHints(container, explanation, step = 0) {
  if (!container) return null;
  container.replaceChildren();
  if (!explanation || explanation.schemaVersion !== 'analysis-explanation/v1' || step < 1) return null;
  const currentStep = Math.min(3, step);
  const hint = studyHintDefinition(explanation, currentStep);
  const article = analysisElement('article', 'analysis-study-hint');
  article.dataset.hintStep = String(step);
  article.append(
    analysisElement('p', 'analysis-study-hint-count', `Hint ${currentStep} of 3 · ${hint.title}`),
    analysisElement('p', 'analysis-study-hint-prompt', hint.prompt),
  );
  if (hint.facts.length) {
    const nudge = analysisElement('div', 'analysis-study-hint-nudge');
    nudge.appendChild(analysisElement('strong', null, 'Spot check'));
    const list = analysisElement('dl', 'analysis-study-hint-facts');
    hint.facts.forEach((analysisFact) => list.appendChild(analysisFactElement(analysisFact)));
    nudge.appendChild(list);
    article.appendChild(nudge);
  }
  container.appendChild(article);
  return article;
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
    analysisElement('h3', 'analysis-explanation-headline', explanation.headline),
    analysisElement('p', 'analysis-explanation-summary', explanation.summary),
  );
  article.appendChild(header);

  const heroFacts = factsForGroup(explanation, 'hero');
  const boardFacts = factsForGroup(explanation, 'board');
  const economicsFacts = factsForGroup(explanation, 'economics');
  const contextFacts = factsForGroup(explanation, 'context');
  const heroRegion = analysisHeroState(explanation);
  if (heroRegion) article.appendChild(heroRegion);
  const economicsRegion = analysisFactGroup('Decision economics', 'economics', economicsFacts);
  if (economicsRegion) article.appendChild(economicsRegion);

  if (explanation.availability === 'unavailable') {
    const contextRegion = analysisFactGroup('Context', 'context', contextFacts);
    if (contextRegion) article.appendChild(contextRegion);
    article.classList.add('is-unavailable');
    article.appendChild(analysisElement('p', 'analysis-unavailable-note', 'Add the missing decision facts to unlock detailed analysis.'));
    const provenance = analysisElement('footer', 'analysis-provenance');
    const source = analysisElement('div', 'analysis-provenance-source');
    source.append(
      analysisElement('span', null, 'Source'),
      analysisElement('strong', null, explanation.provenance.label),
    );
    provenance.appendChild(source);
    const warning = explanation.warnings.find((entry) => entry.severity === 'warning');
    if (warning) provenance.appendChild(analysisElement('p', 'analysis-warning', warning.message));
    article.appendChild(provenance);
    container.appendChild(article);
    container.dataset.analysisAvailability = explanation.availability;
    return article;
  }

  const strategy = explanation.sections.find((entry) => entry.key === 'strategy_mix');
  const reasonParts = strategy?.textParts || [];
  if (reasonParts.length) {
    const reasons = analysisElement('section', 'analysis-reasoning-blocks');
    reasons.appendChild(analysisElement('h4', 'analysis-region-title', 'Primary reasons'));
    reasonParts.forEach((part) => {
      const reason = analysisElement('p', 'analysis-reasoning-block', part.text);
      reason.dataset.textKind = part.kind;
      reasons.appendChild(reason);
    });
    article.appendChild(reasons);
  }

  const contextRegion = analysisFactGroup('Context', 'context', contextFacts);
  if (contextRegion) article.appendChild(contextRegion);

  const selectedKeys = new Set([...heroFacts, ...boardFacts, ...economicsFacts, ...contextFacts].map((entry) => entry.key));
  const details = analysisElement('details', 'analysis-detail-group');
  details.dataset.analysisDisclosure = 'supporting-detail';
  details.appendChild(analysisElement('summary', null, 'Supporting detail'));
  const detailBody = analysisElement('div', 'analysis-detail-groups');
  explanation.sections.forEach((analysisSection) => {
    if (analysisSection.key === 'strategy_mix') return;
    const facts = analysisSection.facts.filter((entry) => !selectedKeys.has(entry.key)
      && !(surface === 'training' && entry.key.startsWith('history_')));
    if (!facts.length && !analysisSection.textParts.length) return;
    detailBody.appendChild(analysisSectionElement(analysisSection, facts));
  });
  if (detailBody.childElementCount) {
    details.appendChild(detailBody);
    article.appendChild(details);
  }

  const footer = analysisElement('footer', 'analysis-provenance');
  const source = analysisElement('div', 'analysis-provenance-source');
  source.append(
    analysisElement('span', null, 'Source'),
    analysisElement('strong', null, explanation.provenance.label),
  );
  if (explanation.provenance.modelVersion) {
    source.appendChild(analysisElement('small', null, `Model ${explanation.provenance.modelVersion}`));
  }
  if (Number.isFinite(explanation.provenance.confidence)) {
    source.appendChild(analysisElement('small', null, `Confidence ${(explanation.provenance.confidence * 100).toFixed(0)}%`));
  }
  if (Number.isFinite(explanation.provenance.coverage)) {
    source.appendChild(analysisElement('small', null, `Coverage ${(explanation.provenance.coverage * 100).toFixed(0)}%`));
  }
  footer.appendChild(source);

  const criticalWarnings = explanation.warnings.filter((entry) => entry.severity === 'warning');
  if (criticalWarnings.length) {
    const warnings = analysisElement('aside', 'analysis-warning-list');
    warnings.setAttribute('aria-label', analysisUiText('Important limitations'));
    criticalWarnings.forEach((entry) => {
      const item = analysisElement('p', 'analysis-warning', entry.message);
      item.dataset.warningCode = entry.code;
      warnings.appendChild(item);
    });
    footer.appendChild(warnings);
  }

  const secondaryWarnings = explanation.warnings.filter((entry) => entry.severity !== 'warning');
  if (secondaryWarnings.length) {
    const limitations = analysisElement('details', 'analysis-limitations');
    const summary = analysisElement('summary', null, `Limits & caveats (${secondaryWarnings.length})`);
    const list = analysisElement('ul', null);
    secondaryWarnings.forEach((entry) => {
      const item = analysisElement('li', null, entry.message);
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
