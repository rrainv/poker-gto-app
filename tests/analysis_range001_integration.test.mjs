import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  PREFLOP_HAND_CLASSES,
  createFullyUnknownHoldemRange,
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromHandClassWeights,
} from '../shared/poker-domain/index.js';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { createBluffAnalysisFacts } from '../app/src/application/bluff-analysis.mjs';
import { createRangeAnalysisFacts } from '../app/src/application/range-analysis.mjs';
import { PLAYBOOK_ANALYSIS_TUTORIAL_DEFINITION } from '../app/src/tutorial/current-app-tutorials.mjs';

const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const EXPLANATION = fs.readFileSync(
  new URL('../app/src/application/analysis-explanation.mjs', import.meta.url),
  'utf8',
);
const RANGE_ANALYSIS = fs.readFileSync(
  new URL('../app/src/application/range-analysis.mjs', import.meta.url),
  'utf8',
);
const BLUFF_ANALYSIS = fs.readFileSync(
  new URL('../app/src/application/bluff-analysis.mjs', import.meta.url),
  'utf8',
);
const RENDERER = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const ANALYSIS_TRANSLATIONS = fs.readFileSync(
  new URL('../app/src/locales/analysis-translations.js', import.meta.url),
  'utf8',
);

class FakeTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.hidden = false;
    this._text = '';
    this.classList = {
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => classes.add(name));
        this.className = [...classes].join(' ');
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  get textContent() {
    return `${this._text}${this.children.map((child) => child.textContent).join('')}`;
  }

  set textContent(value) {
    this._text = String(value ?? '');
    this.children = [];
  }

  get childElementCount() { return this.children.filter((child) => child.nodeType === 1).length; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

function renderedDescendants(root) {
  const result = [];
  const visit = (node) => {
    if (!node || node.nodeType !== 1) return;
    result.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return result;
}

function createTeacherRuntime(language = 'en') {
  const translationContext = { window: {} };
  vm.runInNewContext(ANALYSIS_TRANSLATIONS, translationContext);
  const catalog = translationContext.window.riverlineAnalysisTranslations;
  let currentLanguage = language;
  const document = {
    documentElement: { dataset: {}, dir: language === 'he' ? 'rtl' : 'ltr', lang: language },
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeTextNode(text),
  };
  const resolveTranslation = (key) => {
    const dictionary = catalog[currentLanguage] || {};
    if (Object.hasOwn(dictionary, key)) {
      return { value: dictionary[key], language: currentLanguage, missing: false, fallback: false };
    }
    if (Object.hasOwn(catalog.en, key)) {
      return { value: catalog.en[key], language: 'en', missing: false, fallback: currentLanguage !== 'en' };
    }
    return { value: key, language: 'en', missing: true, fallback: currentLanguage !== 'en' };
  };
  const t = (key, values = {}) => String(resolveTranslation(key).value)
    .replace(/\{([A-Za-z0-9_]+)\}/g, (token, name) => (
      Object.hasOwn(values, name) ? String(values[name]) : token
    ));
  const window = {};
  const runtime = {
    window,
    document,
    console,
    Intl,
    RiverlineI18n: { resolveTranslation },
    t,
  };
  vm.runInNewContext(RENDERER, runtime, { filename: 'teacher.js' });
  return {
    document,
    render(explanation) {
      const container = new FakeElement('div');
      window.renderAnalysisExplanation(container, explanation, { surface: 'playbook' });
      return container;
    },
    setLanguage(nextLanguage) {
      currentLanguage = nextLanguage;
      document.documentElement.dir = nextLanguage === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = nextLanguage;
    },
  };
}

function context(overrides = {}) {
  const result = {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: null,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Ks'],
    board: ['Ah', 'Qs', 'Js'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 9,
    lastAction: 'bet',
    facingSizeBb: 4,
    callAmountBb: null,
    heroStreetContributionBb: null,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'currentPotBb')) result.currentPotBb = result.potBb;
  if (!Object.hasOwn(overrides, 'actorContestablePotAfterCallBb')) {
    result.actorContestablePotAfterCallBb = Number.isFinite(result.callAmountBb)
      ? result.currentPotBb + result.callAmountBb
      : null;
  }
  if (!Object.hasOwn(overrides, 'actorIneligiblePotAfterCallBb')) {
    result.actorIneligiblePotAfterCallBb = result.actorContestablePotAfterCallBb === null
      ? null : 0;
  }
  if (!Object.hasOwn(overrides, 'requiredRawEquity')) {
    result.requiredRawEquity = result.callAmountBb > 0
      ? result.callAmountBb / result.actorContestablePotAfterCallBb
      : null;
  }
  return result;
}

function strategy() {
  return {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_postflop',
    actions: [{
      action: { type: 'check', amountBb: null, potFraction: null },
      label: 'Check',
      probability: 1,
      evBb: null,
    }],
    recommendation: {
      action: { type: 'check', amountBb: null, potFraction: null },
      label: 'Check',
    },
    explanation: null,
    confidence: null,
    coverage: null,
    modelVersion: null,
    warnings: [],
    details: null,
  };
}

function betStrategy(amountBb = 5) {
  return {
    ...strategy(),
    actions: [{
      action: { type: 'bet', amountBb, potFraction: null },
      label: `Bet ${amountBb}bb`,
      probability: 1,
      evBb: null,
    }],
    recommendation: {
      action: { type: 'bet', amountBb, potFraction: null },
      label: `Bet ${amountBb}bb`,
    },
  };
}

function partialManualRange() {
  const source = createHoldemRangeProvenanceSource({ id: 'manual', kind: 'manual' });
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'manual-villain',
    provenanceSources: [source],
    handClassWeights: {
      AA: { weight: 1, provenanceId: source.id },
      AKs: { weight: 0.5, provenanceId: source.id },
      '76s': { weight: 0.25, provenanceId: source.id },
    },
  });
}

function completeManualRange() {
  const source = createHoldemRangeProvenanceSource({ id: 'manual-complete', kind: 'manual' });
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'complete-manual-villain',
    provenanceSources: [source],
    handClassWeights: Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [
      handClass,
      { weight: 1, provenanceId: source.id },
    ])),
  });
}

function fact(result, sectionKey, factKey) {
  return result.sections.find((section) => section.key === sectionKey)
    ?.facts.find((entry) => entry.key === factKey);
}

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return source.slice(from, to);
}

test('AnalysisExplanation consumes RangeAnalysisFacts as its trusted exact-hand and board input', () => {
  const decisionContext = context();
  const rangeAnalysisFacts = createRangeAnalysisFacts({
    decisionContext,
    provenance: {
      exactHand: { kind: 'scenario', label: 'Scenario cards' },
      board: { kind: 'scenario', label: 'Scenario board' },
    },
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts,
    authority: 'scenario',
  });

  assert.equal(fact(explanation, 'hand_board', 'made_hand').value, 'top_pair');
  assert.deepEqual(fact(explanation, 'hand_board', 'draws').value, [
    'nut_flush_draw',
    'gutshot',
    'royal_flush_draw',
  ]);
  assert.deepEqual(fact(explanation, 'hand_board', 'draw_outs').value.straightFlush.completionResults, [
    { card: 'Ts', subtype: 'royal' },
  ]);
  assert.equal(fact(explanation, 'hand_board', 'board_suits').value, 'two-tone');
  assert.equal(fact(explanation, 'blockers', 'hero_blocker_structure').value.rawCombosRemoved, 101);
  assert.equal(fact(explanation, 'range', 'range_availability').value, 'unavailable');
  assert.ok(explanation.warnings.some((entry) => entry.code === 'range_source_unavailable'));
  assert.equal(explanation.warnings.some((entry) => entry.code === 'heuristic_hand_classifier'), false);
  assert.deepEqual(explanation.factSources.map((entry) => entry.group), [
    'strategy',
    'exact_hand',
    'board',
    'decision_context',
  ]);
});

test('BluffAnalysisFacts reaches compact Analysis UI without renderer bluff math', () => {
  const decisionContext = context({
    tableSize: 2,
    opponentCount: 1,
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s'],
    potBb: 10,
    lastAction: 'check',
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: 0,
  });
  const strategyResult = betStrategy(5);
  const rangeAnalysisFacts = createRangeAnalysisFacts({ decisionContext });
  const bluffAnalysisFacts = createBluffAnalysisFacts({
    decisionContext,
    strategyResult,
    rangeAnalysisFacts,
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult,
    rangeAnalysisFacts,
    bluffAnalysisFacts,
    authority: 'hand',
  });
  assert.equal(fact(explanation, 'bluff_pressure', 'bluff_risk').value, 5);
  assert.equal(fact(explanation, 'bluff_pressure', 'bluff_immediate_reward').value, 10);
  assert.equal(fact(explanation, 'bluff_pressure', 'bluff_break_even_folds').value, 1 / 3);
  assert.equal(
    fact(explanation, 'bluff_pressure', 'bluff_structural_improvement_cards').value,
    12,
  );

  const rendered = createTeacherRuntime('en').render(explanation);
  const bluffSection = renderedDescendants(rendered)
    .find((element) => element.dataset.analysisSection === 'bluff_pressure');
  assert.match(bluffSection.textContent, /Bluff & Pressure/);
  assert.match(bluffSection.textContent, /5bb/);
  assert.match(bluffSection.textContent, /10bb/);
  assert.match(bluffSection.textContent, /33\.3%/);
  assert.match(bluffSection.textContent, /Semibluff structure/);
  assert.match(bluffSection.textContent, /Nut flush draw/);
  assert.match(bluffSection.textContent, /12 unique cards/);
  assert.match(bluffSection.textContent, /Opponent fold frequency is unavailable/);
  assert.match(bluffSection.textContent, /Strategic blocker quality is unavailable/);
  assert.doesNotMatch(BLUFF_ANALYSIS, /document\.|querySelector|calculateEquity|StrategyProvider/);
  assert.doesNotMatch(RENDERER, /risk\s*\/\s*\(risk|bluffToValueRatio\s*=/);
});

test('Hebrew Bluff & Pressure keeps prose RTL and numeric pressure facts in local LTR islands', () => {
  const decisionContext = context({
    tableSize: 2,
    opponentCount: 1,
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s'],
    potBb: 10,
    lastAction: 'check',
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: 0,
  });
  const strategyResult = betStrategy(5);
  const rangeAnalysisFacts = createRangeAnalysisFacts({ decisionContext });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult,
    rangeAnalysisFacts,
    bluffAnalysisFacts: createBluffAnalysisFacts({
      decisionContext,
      strategyResult,
      rangeAnalysisFacts,
    }),
  });
  const teacher = createTeacherRuntime('he');
  const rendered = teacher.render(explanation);
  const bluffSection = renderedDescendants(rendered)
    .find((element) => element.dataset.analysisSection === 'bluff_pressure');
  assert.equal(teacher.document.documentElement.dir, 'rtl');
  assert.match(bluffSection.textContent, /[\u0590-\u05ff]/);
  assert.doesNotMatch(bluffSection.textContent, /\b(?:Ah|4h|2h|3h|9s)\b/);
  const dataTokens = renderedDescendants(bluffSection)
    .filter((element) => element.classList.contains('poker-data-token'));
  assert.ok(dataTokens.some((element) => element.textContent === '33.3%'));
  assert.ok(dataTokens.some((element) => element.textContent === '5bb'));
  assert.ok(dataTokens.some((element) => element.textContent === '10bb'));
});

test('compact Analysis visibly surfaces the exact wheel straight-flush draw and shared out', () => {
  const decisionContext = context({
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s'],
  });
  const rangeAnalysisFacts = createRangeAnalysisFacts({ decisionContext });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts,
    authority: 'scenario',
  });

  assert.deepEqual(fact(explanation, 'hand_board', 'draws').value, [
    'nut_flush_draw',
    'gutshot',
    'gutshot_straight_flush_draw',
  ]);
  const outFact = fact(explanation, 'hand_board', 'draw_outs');
  assert.deepEqual(outFact.value.straightFlush.completionResults, [
    { card: '5h', subtype: 'wheel' },
  ]);
  assert.equal(outFact.value.uniqueCompletionCardCount, 12);
  assert.deepEqual(outFact.value.overlaps, [{
    card: '5h', families: ['flush', 'straight', 'straight_flush'],
  }]);

  const rendered = createTeacherRuntime('en').render(explanation);
  const handBoard = renderedDescendants(rendered)
    .find((element) => element.dataset.analysisGroup === 'hero');
  assert.match(handBoard.textContent, /Nut flush draw/);
  assert.match(handBoard.textContent, /Gutshot straight draw/);
  assert.match(handBoard.textContent, /Gutshot straight-flush draw/);
  assert.match(handBoard.textContent, /Outs/);
  assert.match(handBoard.textContent, /Flush/);
  assert.match(handBoard.textContent, /Straight/);
  assert.match(handBoard.textContent, /5h/);
  assert.match(handBoard.textContent, /Wheel straight flush/);
  assert.match(handBoard.textContent, /Unique direct improvement cards: 12/);
  assert.match(handBoard.textContent, /Shared out counted once: 5h/);
});

test('OESFD and royal draw labels retain exact structured completion results', () => {
  const fixtures = [
    {
      heroCards: ['6h', '7h'], board: ['8h', '9h', '2s'],
      draw: 'open_ended_straight_flush_draw', copy: /Open-ended straight-flush draw/,
      cards: ['5h', 'Th'], results: /Straight flush/,
    },
    {
      heroCards: ['As', 'Ks'], board: ['Qs', 'Js', '2d'],
      draw: 'royal_flush_draw', copy: /Royal flush draw/,
      cards: ['Ts'], results: /Royal flush/,
    },
  ];
  for (const fixture of fixtures) {
    const decisionContext = context(fixture);
    const explanation = createAnalysisExplanation({
      decisionContext,
      strategyResult: strategy(),
      rangeAnalysisFacts: createRangeAnalysisFacts({ decisionContext }),
      authority: 'scenario',
    });
    assert.ok(fact(explanation, 'hand_board', 'draws').value.includes(fixture.draw));
    assert.deepEqual(
      fact(explanation, 'hand_board', 'draw_outs').value.straightFlush.completionCards,
      fixture.cards,
    );
    const text = createTeacherRuntime('en').render(explanation).textContent;
    assert.match(text, fixture.copy);
    assert.match(text, fixture.results);
    fixture.cards.forEach((card) => assert.match(text, new RegExp(card)));
  }
});

test('made wheel, Broadway, and royal subtypes reach Analysis presentation without changing category', () => {
  const fixtures = [
    { heroCards: ['As', '4d'], board: ['2c', '3h', '5s'], value: 'wheel_straight', copy: /Wheel straight/ },
    { heroCards: ['As', 'Kd'], board: ['Qc', 'Jh', 'Ts'], value: 'broadway_straight', copy: /Broadway straight/ },
    { heroCards: ['As', 'Ks'], board: ['Qs', 'Js', 'Ts'], value: 'royal_flush', copy: /Royal flush/ },
  ];
  for (const fixture of fixtures) {
    const decisionContext = context(fixture);
    const rangeAnalysisFacts = createRangeAnalysisFacts({ decisionContext });
    const explanation = createAnalysisExplanation({
      decisionContext,
      strategyResult: strategy(),
      rangeAnalysisFacts,
      authority: 'scenario',
    });
    const made = fact(explanation, 'hand_board', 'made_hand');
    assert.equal(made.value, fixture.value);
    assert.ok(['straight', 'straight_flush'].includes(made.values.primaryCategory));
    assert.match(createTeacherRuntime('en').render(explanation).textContent, fixture.copy);
  }
});

test('Hebrew structured outs stay RTL with completion cards as local data islands', () => {
  const decisionContext = context({
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s'],
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts: createRangeAnalysisFacts({ decisionContext }),
    authority: 'scenario',
  });
  const teacher = createTeacherRuntime('he');
  const rendered = teacher.render(explanation);
  const outCell = renderedDescendants(rendered)
    .find((element) => element.dataset.factKey === 'draw_outs');
  const primary = renderedDescendants(outCell)
    .find((element) => element.classList.contains('analysis-outs-overlap'));
  assert.equal(teacher.document.documentElement.dir, 'rtl');
  assert.match(primary.textContent, /[\u0590-\u05ff]/);
  assert.equal(primary.classList.contains('poker-data-token'), false);
  assert.notEqual(primary.getAttribute('dir'), 'ltr');
  const cards = renderedDescendants(primary)
    .find((element) => element.classList.contains('poker-data-token'));
  assert.equal(cards.textContent, '5h');
});

test('explicit partial range rendering remains conditional, source-specific, and non-normalized', () => {
  const decisionContext = context();
  const rangeAnalysisFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: {
      villain: {
        role: 'opponent',
        subjectId: 'villain-seat-4',
        label: 'Manual Villain range',
        range: partialManualRange(),
        source: { kind: 'manual', label: 'Manual Villain range' },
      },
    },
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts,
  });
  const rangeSection = explanation.sections.find((section) => section.key === 'range');
  const summary = rangeSection.facts.find((entry) => entry.key === 'supplied_range_summary_villain');
  const composition = rangeSection.facts.find(
    (entry) => entry.key === 'supplied_range_composition_villain',
  );

  assert.equal(rangeSection.facts.some((entry) => entry.key === 'range_availability'), false);
  assert.equal(summary.value.state, 'partial');
  assert.ok(summary.value.unknownEligibleComboCount > 0);
  assert.equal(summary.value.normalizationAvailable, false);
  assert.ok(composition.value.every((entry) => entry.normalizedShare === null));
  assert.ok(explanation.warnings.some((entry) => entry.code === 'partial_range_villain'));
  assert.equal(explanation.factSources.find((entry) => entry.group === 'range_villain').source, 'manual');
  assert.ok(fact(explanation, 'blockers', 'range_blocker_effect_villain').value.removedComboCount > 0);
});

test('rendered unknown and partial range states separate physical removal, known counts, mass, and coverage', () => {
  const decisionContext = context({
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
  });
  const unknownFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: {
      villain: {
        role: 'opponent',
        label: 'Unknown Villain range',
        range: createFullyUnknownHoldemRange(),
      },
    },
  });
  const unknownExplanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts: unknownFacts,
  });
  const teacher = createTeacherRuntime('en');
  const unknownRendered = teacher.render(unknownExplanation);
  const unknownElements = renderedDescendants(unknownRendered);
  const blocker = unknownElements.find(
    (element) => element.dataset.factKey === 'range_blocker_effect_villain',
  );
  assert.match(blocker.textContent, /95 physical combos removed/);
  assert.match(blocker.textContent, /no known weights among affected combos/);
  assert.match(blocker.textContent, /0\.0% known coverage/);
  assert.doesNotMatch(blocker.textContent, /weighted combos/i);
  const unknownSummary = unknownElements.find(
    (element) => element.dataset.factKey === 'supplied_range_summary_villain',
  );
  assert.match(unknownSummary.textContent, /Fully unknown/);

  const partialFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: { villain: { role: 'opponent', range: partialManualRange() } },
  });
  const partialExplanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts: partialFacts,
  });
  const partialRendered = teacher.render(partialExplanation);
  const partialElements = renderedDescendants(partialRendered);
  const partialSummary = partialElements.find(
    (element) => element.dataset.factKey === 'supplied_range_summary_villain',
  );
  assert.match(partialSummary.textContent, /known combo mass/);
  assert.match(partialSummary.textContent, /Partial/);
  const partialComposition = partialElements.find(
    (element) => element.dataset.factKey === 'supplied_range_composition_villain',
  );
  assert.doesNotMatch(partialComposition.textContent, /%/);
});

test('rendered complete composition includes every positive category without silent truncation', () => {
  const decisionContext = context({
    heroCards: ['Ah', 'Kd'],
    board: ['9s', 'Ts', 'Js'],
  });
  const rangeAnalysisFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: { villain: { role: 'opponent', range: completeManualRange() } },
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts,
  });
  const compositionFact = fact(explanation, 'range', 'supplied_range_composition_villain');
  assert.ok(compositionFact.value.length > 5);
  const rendered = createTeacherRuntime('en').render(explanation);
  const compositionCell = renderedDescendants(rendered).find(
    (element) => element.dataset.factKey === 'supplied_range_composition_villain',
  );
  const renderedItems = renderedDescendants(compositionCell)
    .filter((element) => element.classList.contains('analysis-composition-item'));
  assert.equal(renderedItems.length, compositionFact.value.length);
});

test('dead-card provenance is rendered separately and Hebrew keeps prose RTL with local data islands', () => {
  const decisionContext = context({ deadCards: ['5d'] });
  const rangeAnalysisFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: { villain: { role: 'opponent', label: 'טווח יריב', range: partialManualRange() } },
    provenance: {
      exactHand: { kind: 'scenario', label: 'Scenario cards' },
      board: { kind: 'scenario', label: 'Scenario board' },
      deadCards: { kind: 'manual', label: 'Dead-card note' },
    },
  });
  const explanation = createAnalysisExplanation({
    decisionContext,
    strategyResult: strategy(),
    rangeAnalysisFacts,
    authority: 'scenario',
  });
  assert.ok(explanation.factSources.some((entry) => entry.group === 'dead_cards'));
  assert.ok(explanation.factSources.some((entry) => entry.group === 'decision_context'));

  const teacher = createTeacherRuntime('he');
  const rendered = teacher.render(explanation);
  assert.equal(teacher.document.documentElement.dir, 'rtl');
  const elements = renderedDescendants(rendered);
  const sources = elements.find((element) => element.classList.contains('analysis-fact-sources'));
  assert.match(sources.textContent, /קלפים מתים/);
  const summaryCell = elements.find(
    (element) => element.dataset.factKey === 'supplied_range_summary_villain',
  );
  const primary = renderedDescendants(summaryCell)
    .find((element) => element.classList.contains('analysis-localized-message'));
  assert.match(primary.textContent, /[\u0590-\u05ff]/);
  assert.equal(primary.classList.contains('poker-data-token'), false);
  assert.notEqual(primary.getAttribute('dir'), 'ltr');
  const dataTokens = renderedDescendants(primary)
    .filter((element) => element.classList.contains('poker-data-token'));
  assert.ok(dataTokens.length >= 4);
  const userLabel = renderedDescendants(primary)
    .find((element) => element.classList.contains('analysis-user-text'));
  assert.equal(userLabel.getAttribute('dir'), 'auto');
});

test('Explanation remains the only copy layer and does not evaluate or condition ranges itself', () => {
  assert.match(EXPLANATION, /rangeAnalysisFacts/);
  assert.doesNotMatch(EXPLANATION, /evaluateFive|evaluateSeven|conditionHoldemRange|getHoldemComboById/);
  assert.doesNotMatch(EXPLANATION, /createRangeAnalysisFacts\(/);
  assert.match(RANGE_ANALYSIS, /evaluateFive/);
  assert.match(RANGE_ANALYSIS, /conditionHoldemRange/);
  assert.doesNotMatch(RANGE_ANALYSIS, /strategy-provider|calculateEquity|document\.|querySelector/);
  assert.match(BLUFF_ANALYSIS, /rangeAnalysisFacts/);
  assert.doesNotMatch(BLUFF_ANALYSIS, /evaluateFive|evaluateSeven|conditionHoldemRange|calculateEquity|document\.|querySelector/);
});

test('range analysis is invoked only inside the visible Analysis render path and never calls StrategyProvider', () => {
  const seam = sourceBetween(
    LOGIC,
    'function rangeAnalysisFactsForDecision(',
    'function renderDecisionAnalysis(',
  );
  const render = sourceBetween(
    LOGIC,
    'function renderDecisionAnalysis(',
    'function renderPlaybookDecisionAnalysis(',
  );
  assert.match(render, /rangeAnalysisFactsForDecision\(decisionContext, authority, rangeInputs\)/);
  assert.match(render, /rangeAnalysisFacts,/);
  assert.doesNotMatch(seam, /strategyProvider|\.resolve\(|calculateEquity/);
  assert.equal((LOGIC.match(/rangeAnalysisFactsForDecision\(/g) || []).length, 2);
  assert.match(LOGIC, /surface === 'analysis'[\s\S]*playbookSurfaceIsVisible\('analysis'\)/);
  assert.match(seam, /rangeAnalysisMemo\.decisionContext === decisionContext/);
  const playbook = sourceBetween(
    LOGIC,
    'function renderPlaybookDecisionAnalysis(',
    'function renderPlaybookTableProjection(',
  );
  assert.doesNotMatch(playbook, /strategyProvider\.resolve\(/);
});

test('renderer exposes compact blocker/range sections, readable partial coverage, and separate fact sources', () => {
  assert.match(RENDERER, /surface === 'training'[\s\S]*\? \['bluff_pressure', 'range'\][\s\S]*: \['bluff_pressure', 'blockers', 'range'\]/);
  assert.match(RENDERER, /analysis-primary-structural-section/);
  assert.match(RENDERER, /known combo mass/);
  assert.match(RENDERER, /known coverage/);
  assert.match(RENDERER, /analysisFactSourcesElement/);
  assert.match(RENDERER, /analysis-fact-source-list/);
  assert.match(RENDERER, /poker-data-token/);
  assert.doesNotMatch(RENDERER, /\.slice\(0, 5\)/);
  assert.doesNotMatch(RENDERER, /evaluateFive|evaluateSeven|conditionHoldemRange|calculateEquity/);
});

test('Analysis tutorial teaches the new facts without changing the manual v1 first-use policy', () => {
  const tutorial = PLAYBOOK_ANALYSIS_TUTORIAL_DEFINITION;
  assert.equal(tutorial.version, 1);
  assert.equal(tutorial.firstUsePolicy, 'manual');
  assert.equal(tutorial.steps.length, 7);
  assert.deepEqual(tutorial.steps.map((step) => step.id), [
    'navigation',
    'exact-hand',
    'blockers',
    'range',
    'matrix',
    'matrix-selection',
    'comparison',
  ]);
  assert.match(tutorial.steps.find((step) => step.id === 'exact-hand').bodyKey, /canonical evaluator/);
  assert.match(tutorial.steps.find((step) => step.id === 'blockers').bodyKey, /33% required folds does not mean Villain folds 33%/);
  assert.match(tutorial.steps.find((step) => step.id === 'blockers').bodyKey, /neutral removal facts/);
  assert.match(tutorial.steps.find((step) => step.id === 'range').bodyKey, /unknown combos unknown/);
  assert.match(tutorial.steps.find((step) => step.id === 'range').bodyKey, /sources remain separate/);
  assert.match(HTML, /data-tutorial-anchor="playbook-analysis-explanation"/);
});

test('new Analysis labels and tutorial copy are complete in EN, RU, and HE', () => {
  const runtime = { window: {} };
  vm.runInNewContext(ANALYSIS_TRANSLATIONS, runtime);
  const catalog = runtime.window.riverlineAnalysisTranslations;
  const keys = [
    'analysis.section.blockers',
    'analysis.section.range',
    'analysis.fact.rangeBlockerEffect',
    'analysis.fact.straightFlushOuts',
    'analysis.fact.outs',
    'analysis.value.nutFlushDraw',
    'analysis.value.straightFlushDraw',
    'analysis.value.gutshotStraightFlushDraw',
    'analysis.value.openEndedStraightFlushDraw',
    'analysis.value.doubleGutshotStraightFlushDraw',
    'analysis.value.royalFlushDraw',
    'analysis.value.wheelStraight',
    'analysis.value.broadwayStraight',
    'analysis.value.wheelStraightFlush',
    'analysis.value.royalFlush',
    'analysis.value.straightFlushOutSingle',
    'analysis.outs.flush',
    'analysis.outs.straight',
    'analysis.outs.straightFlush',
    'analysis.outs.unique',
    'analysis.outs.shared',
    'analysis.outs.note',
    'analysis.value.rangeUnavailable',
    'analysis.warning.range_source_unavailable',
    'analysis.ui.factSources',
    'analysis.sourceLabel.scenario',
    'analysis.sourceLabel.personal_inferred',
    'analysis.section.bluff_pressure',
    'analysis.fact.bluffRisk',
    'analysis.fact.bluffReward',
    'analysis.fact.requiredFoldFrequency',
    'analysis.fact.requiredAllOpponentsFoldFrequency',
    'analysis.fact.semibluff',
    'analysis.fact.structuralImprovementCards',
    'analysis.fact.riverBalancedRangeReference',
    'analysis.bluff.requirementNotPrediction',
    'analysis.bluff.blockerQualityUnavailable',
    'analysis.value.simplifiedAssumptions',
  ];
  for (const locale of ['en', 'ru', 'he']) {
    for (const key of keys) assert.equal(typeof catalog[locale][key], 'string', `${locale}: ${key}`);
  }
});
