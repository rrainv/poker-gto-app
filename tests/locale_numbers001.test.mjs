// LOCALE-NUMBERS-001 (EQ-LOCALE, QA-DECISION-INPUT-009, QA-SWEEP-022,
// QA-LANGUAGE-SWITCH-003): numbers follow the UI language through one shared
// formatter; randomization status belongs to its card stage and language;
// Training Memory words the price like Saved Training history; code-owned text
// survives language switches without stale static keys.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp, freshIndexDocument } from './helpers/app-under-test.mjs';

// The app boots first: its module graph installs page bridges on import.
const app = await bootApp({ width: 1920 });
const {
  activeLocale,
  formatLocaleBb,
  formatLocaleFixed,
  formatLocaleInteger,
  formatLocaleNumber,
  formatLocalePercent,
} = await import('../app/src/application/locale-number-format.mjs');
const { describeDecisionFacing, formatDecisionFacing } = await import('../app/src/application/decision-facing-summary.mjs');
const { trainingMemoryContextSummary } = await import('../app/src/application/training-memory-row-format.mjs');
const { createAnalysisExplanation } = await import('../app/src/application/analysis-explanation.mjs');
const { createBluffAnalysisFacts } = await import('../app/src/application/bluff-analysis.mjs');
const { createRangeAnalysisFacts } = await import('../app/src/application/range-analysis.mjs');
const {
  formatExactPokerAmountBb,
  formatSuggestedSizingBb,
} = await import('../app/src/application/poker-sizing-presentation.mjs');
const {
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromHandClassWeights,
} = await import('../shared/poker-domain/index.js');

// Intl uses a no-break space (U+00A0) for Russian grouping.
const NBSP = ' ';

test('formatter: English, Russian and Hebrew separators come from the UI language', () => {
  assert.equal(formatLocaleFixed(12.345, 1, 'en'), '12.3');
  assert.equal(formatLocaleFixed(12.345, 1, 'ru'), '12,3');
  assert.equal(formatLocaleFixed(12.345, 1, 'he'), '12.3');
  assert.equal(formatLocaleInteger(1234567, 'en'), '1,234,567');
  assert.equal(formatLocaleInteger(1234567, 'ru'), `1${NBSP}234${NBSP}567`);
  assert.equal(formatLocaleInteger(1234567, 'he'), '1,234,567');
  assert.equal(formatLocalePercent(47.25, 1, 'ru'), '47,3%');
  assert.equal(formatLocaleBb(2.5, 'en'), '2.5 bb');
  assert.equal(formatLocaleBb(2.5, 'ru'), '2,5 bb');
  assert.equal(formatLocaleBb(100, 'ru'), '100 bb');
  assert.equal(formatLocaleNumber(0.125, { maximumFractionDigits: 3 }, 'ru'), '0,125');
});

test('formatter: unknown is "-", never zero; no "-0"; unsupported locales fall back to English', () => {
  for (const unknown of [null, undefined, '', Number.NaN, Infinity, 'abc']) {
    assert.equal(formatLocaleNumber(unknown, {}, 'en'), '-', String(unknown));
    assert.equal(formatLocalePercent(unknown, 1, 'en'), '-');
    assert.equal(formatLocaleBb(unknown, 'en'), '-');
  }
  assert.equal(formatLocaleFixed(-0.01, 1, 'en'), '0.0');
  assert.equal(formatLocaleFixed(-0.01, 1, 'ru'), '0,0');
  assert.equal(formatLocaleFixed(-0, 0, 'en'), '0');
  assert.equal(formatLocaleFixed(-1.25, 1, 'en'), '-1.3');
  assert.equal(activeLocale('ru-RU'), 'ru');
  assert.equal(activeLocale('de'), 'en');
  assert.equal(formatLocaleFixed(1.5, 1, 'de'), '1.5');
});

test('decision facing and Training Memory rows format bb in the given language', () => {
  const context = {
    street: 'flop', heroPosition: 'BB', board: ['As', '7d', '2c'], heroCards: ['Kh', 'Qh'],
    effectiveStackBb: 97.5, currentPotBb: 6.5, callAmountBb: 2.5, facingToBb: 2.5,
    tableSize: 6, legalActions: [],
  };
  const summary = describeDecisionFacing(context);
  const translate = app.window.t;
  assert.equal(summary.callAmountBb, 2.5);
  assert.match(formatDecisionFacing(summary, { translate, language: 'ru' }), /2,5 bb/);
  assert.match(formatDecisionFacing(summary, { translate, language: 'en' }), /2\.5 bb/);
  const row = trainingMemoryContextSummary(context, translate, { facing: 'summary', language: 'ru' });
  assert.match(row.spot, /97,5 bb/);
  assert.match(row.spot, /6,5 bb/);
  assert.doesNotMatch(row.spot, /Facing/);
});

// ---------------------------------------------------------------------------
// Booted app
// ---------------------------------------------------------------------------

const $ = (selector) => app.$(selector);
const setLanguage = async (language) => {
  app.window.setLanguage(language);
  await app.settle(100);
};

test('Analyze numbers switch between English and Russian separators with the UI language', async () => {
  await setLanguage('en');
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.settle(500);
  const english = $('#mPot').textContent;
  assert.match(english, /^\d+(\.\d)? bb$/, `EN pot "${english}"`);
  await setLanguage('ru');
  const russian = $('#mPot').textContent;
  assert.equal(russian, english.replace('.', ','), 'RU uses a decimal comma, nothing else changes');
  await setLanguage('en');
  assert.equal($('#mPot').textContent, english, 'English never keeps Russian formatting');
});

test('Equity: the random-card status follows its card stage and re-words on a language switch', async () => {
  await setLanguage('en');
  await app.navigate('equity');
  const randomized = await app.call('randomizeCurrentEquityInput', 'matchup');
  await app.settle(100);
  assert.equal(randomized, true);
  const status = $('#equityRandomizeStatus');
  assert.equal(status.textContent, 'New cards for 1 Known hands.');
  await setLanguage('ru');
  assert.ok(status.textContent && status.textContent !== 'New cards for 1 Known hands.', `RU status "${status.textContent}"`);
  assert.doesNotMatch(status.textContent, /[A-Za-z]{4}/, 'no English left in the RU status');
  await setLanguage('en');
  assert.equal(status.textContent, 'New cards for 1 Known hands.');
  // Calculating does not change the cards, so the status stays.
  app.evaluate('app.equity.lifecycle = "running"');
  app.call('renderEquityRandomizationControls');
  assert.equal(status.textContent, 'New cards for 1 Known hands.');
  app.evaluate('app.equity.lifecycle = "idle"');
  // Any card change retires the announcement.
  app.evaluate('app.equity.board = ["2c", "3d", "4h"]');
  app.call('setEquityPending', { renderInputs: 'shared' });
  await app.settle(100);
  assert.equal(status.textContent, '');
});

test('Equity: "Random {street} ready." keeps its street word in the current language', async () => {
  await setLanguage('en');
  app.call('setEquityRandomizationStatus', 'Random {street} ready.', () => ({ street: app.window.t('Turn') }));
  const status = $('#equityRandomizeStatus');
  assert.equal(status.textContent, 'Random Turn ready.');
  await setLanguage('ru');
  assert.equal(status.textContent, app.window.t('Random {street} ready.', { street: app.window.t('Turn') }));
  assert.doesNotMatch(status.textContent, /Turn|Random/);
  await setLanguage('en');
  app.call('setEquityRandomizationStatus', '');
});

test('Training Memory decision rows use the facing summary, not "Facing N bb"', async () => {
  await setLanguage('en');
  const record = {
    decisionContext: {
      street: 'flop', heroPosition: 'BB', board: ['As', '7d', '2c'], heroCards: ['Kh', 'Qh'],
      effectiveStackBb: 97.5, currentPotBb: 6.5, callAmountBb: 2.5, facingToBb: 2.5, tableSize: 6, legalActions: [],
    },
  };
  const row = app.call('trainingMemoryDecisionSummary', record);
  assert.doesNotMatch(row.textContent, /Facing \d/);
  assert.match(row.textContent, /97\.5 bb/);
  await setLanguage('ru');
  const russian = app.call('trainingMemoryDecisionSummary', record);
  assert.match(russian.textContent, /97,5 bb/);
  await setLanguage('en');
});

// QA-LANGUAGE-SWITCH-003: these elements are written by code, so the markup no
// longer carries a static data-i18n key that a language switch would restore
// over the code's current text.
const CODE_OWNED = Object.freeze({
  playbookModeStatus: 'Scenario controls are authoritative. This spot does not claim a legal hand history.',
  liveContextText: 'Live',
  savedSpotViewerTitle: 'Saved study spot',
  savedSpotViewerTruth: 'History unavailable',
  tightnessLabel: 'Baseline',
  oppTightnessLabel: 'Baseline',
  handSessionBadge: 'Not started',
  savedHandViewerTitle: 'Saved hand replay',
  handSetupCompactSummary: 'Configure before the hand starts',
  handSetupDisclosureState: 'Configure',
  handStartButton: 'Start hand',
});

test('code-owned elements carry no static data-i18n key', () => {
  const markup = freshIndexDocument();
  for (const id of Object.keys(CODE_OWNED)) {
    const node = markup.getElementById(id);
    assert.ok(node, id);
    assert.equal(node.hasAttribute('data-i18n'), false, `${id} keeps a static data-i18n key`);
  }
});

test('code-owned elements are re-worded by code on every language switch', async () => {
  await setLanguage('en');
  await app.navigate('analyze');
  const english = Object.fromEntries(Object.keys(CODE_OWNED).map((id) => [id, $(`#${id}`).textContent]));
  await setLanguage('ru');
  for (const [id, key] of Object.entries(CODE_OWNED)) {
    const ru = $(`#${id}`).textContent;
    if (english[id] === key) assert.equal(ru, app.window.t(key), `${id} in Russian`);
    else assert.notEqual(ru, english[id], `${id} was re-worded in Russian`);
  }
  await setLanguage('en');
  for (const id of Object.keys(CODE_OWNED)) assert.equal($(`#${id}`).textContent, english[id], `${id} round-trips`);
});

test('a code-written state survives a language switch instead of reverting to the static default', async () => {
  await setLanguage('en');
  const slider = $('#tightnessSlider');
  await app.setValue(slider, '50');
  assert.equal($('#tightnessLabel').textContent, 'Loose Online');
  await setLanguage('ru');
  assert.equal($('#tightnessLabel').textContent, app.window.t('Loose Online'));
  assert.notEqual($('#tightnessLabel').textContent, app.window.t('Baseline'));
  await setLanguage('en');
  assert.equal($('#tightnessLabel').textContent, 'Loose Online');
  await app.setValue(slider, '0');
});

test('LOCALE-NUMBERS-002: poker sizing presenter formats bb amounts in EN, RU (comma) and HE', () => {
  assert.equal(formatSuggestedSizingBb(2.26, { language: 'en' }), '2.5 bb');
  assert.equal(formatSuggestedSizingBb(2.26, { language: 'ru' }), '2,5 bb');
  assert.equal(formatSuggestedSizingBb(2.26, { language: 'he' }), '2.5 bb');
  assert.equal(formatSuggestedSizingBb(2.26, { spaced: false, language: 'ru' }), '2,5bb');
  assert.equal(formatExactPokerAmountBb(2.0379, { language: 'en' }), '2.0379bb');
  assert.equal(formatExactPokerAmountBb(2.0379, { language: 'ru' }), '2,0379bb');
  assert.equal(formatExactPokerAmountBb(2.0379, { language: 'he' }), '2.0379bb');
});

test('LOCALE-NUMBERS-002: AnalysisExplanation formats percentages, bb amounts and ratios in EN, RU (comma) and HE', async () => {
  const decisionContext = {
    schemaVersion: 'decision-context/v1',
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    street: 'river',
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s', 'Kd', '7c'],
    deadCards: [],
    stackBb: 33.5,
    effectiveStackBb: 33.5,
    stackMode: 'hero',
    potBb: 6.5,
    currentPotBb: 6.5,
    lastAction: 'bet',
    facingSizeBb: 2.5,
    callAmountBb: 2.5,
    heroStreetContributionBb: 0,
    actorContestablePotAfterCallBb: 9,
    actorIneligiblePotAfterCallBb: 0,
    requiredRawEquity: 2.5 / 9,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  };
  const strategyResult = {
    schemaVersion: 'strategy-result/v1',
    source: 'heuristic_postflop',
    actions: [
      { action: { type: 'raise', amountBb: 7.5, potFraction: null }, label: 'Raise', probability: 0.65, evBb: null },
      { action: { type: 'call', amountBb: 2.5, potFraction: null }, label: 'Call', probability: 0.35, evBb: null },
    ],
    recommendation: { action: { type: 'raise', amountBb: 7.5, potFraction: null }, label: 'Raise' },
    explanation: null,
    confidence: null,
    coverage: null,
    modelVersion: null,
    warnings: [],
    details: {
      heuristicSample: {
        provenance: 'heuristic_conditional_sample',
        eq: 0.425,
        completedSamples: 400,
        opponentCount: 1,
        rangeFraction: 0.375,
      },
    },
  };
  const rangeSource = createHoldemRangeProvenanceSource({ id: 'manual', kind: 'manual' });
  const range = createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'villain-range',
    provenanceSources: [rangeSource],
    handClassWeights: {
      AA: { weight: 1, provenanceId: rangeSource.id },
      AKs: { weight: 0.5, provenanceId: rangeSource.id },
      '76s': { weight: 0.25, provenanceId: rangeSource.id },
    },
  });
  const rangeAnalysisFacts = createRangeAnalysisFacts({
    decisionContext,
    ranges: { villain: { role: 'opponent', label: 'Villain', range } },
  });
  const bluffAnalysisFacts = createBluffAnalysisFacts({
    decisionContext,
    strategyResult,
    rangeAnalysisFacts,
    action: { action: { type: 'bet', amountBb: 7.5, potFraction: null }, label: 'Bet', probability: 0.65 },
  });
  const trustedFacts = {
    equity: { heroEquity: 0.625, method: 'exact' },
    actionHistory: [
      { sequence: 0, street: 'river', actorLabel: 'BB', actionLabel: 'Bet to', actionType: 'bet', amountBb: 2.5 },
    ],
  };

  const fact = (explanation, sectionKey, factKey) => explanation.sections
    .find((section) => section.key === sectionKey)
    ?.facts.find((entry) => entry.key === factKey);

  const byLang = Object.fromEntries(['en', 'ru', 'he'].map((language) => [
    language,
    createAnalysisExplanation({
      decisionContext,
      strategyResult,
      rangeAnalysisFacts,
      bluffAnalysisFacts,
      trustedFacts,
      authority: 'hand',
      language,
    }),
  ]));

  // EN and HE use "."; RU uses ",".
  for (const [language, mark] of [['en', '.'], ['ru', ','], ['he', '.']]) {
    const exp = byLang[language];
    assert.equal(fact(exp, 'pot_odds', 'pot_before_action').values.pot, `6${mark}5bb`, `${language} pot`);
    assert.equal(fact(exp, 'pot_odds', 'call_amount').values.callAmount, `2${mark}5bb`, `${language} callAmount`);
    assert.equal(fact(exp, 'pot_odds', 'required_raw_equity').values.requiredEquity, `27${mark}8%`, `${language} requiredEquity`);
    assert.equal(fact(exp, 'spr', 'stack_bb').values.stack, `33${mark}5bb`, `${language} stack`);
    assert.equal(fact(exp, 'spr', 'spr').values.spr, `5${mark}2`, `${language} spr`);
    assert.equal(fact(exp, 'action_context', 'facing_size').values.facingSize, `2${mark}5bb`, `${language} facingSize`);
    assert.match(fact(exp, 'action_context', 'history_0').values.historyText, new RegExp(`2\\${mark}5bb`), `${language} history`);
    assert.equal(fact(exp, 'bluff_pressure', 'bluff_risk').values.risk, `7${mark}5bb`, `${language} bluff risk`);
    assert.equal(fact(exp, 'bluff_pressure', 'bluff_immediate_reward').values.reward, `6${mark}5bb`, `${language} bluff reward`);
    assert.equal(fact(exp, 'bluff_pressure', 'bluff_break_even_folds').values.frequency, `53${mark}6%`, `${language} break-even folds`);
    assert.equal(fact(exp, 'bluff_pressure', 'river_bluff_value_reference').values.valueUnits, `1${mark}867`, `${language} valueUnits`);
    assert.equal(fact(exp, 'bluff_pressure', 'river_bluff_value_reference').values.share, `34${mark}9%`, `${language} bluff share`);
    assert.equal(fact(exp, 'blockers', 'range_blocker_effect_villain').values.mass, `3${mark}5`, `${language} blocker mass`);
    assert.equal(fact(exp, 'range', 'supplied_range_summary_villain').values.mass, `4${mark}75`, `${language} range mass`);
    assert.equal(fact(exp, 'heuristic_sample', 'heuristic_sampled_equity').values.equity, `42${mark}5%`, `${language} sampled equity`);
    assert.equal(fact(exp, 'heuristic_sample', 'heuristic_range_fraction').values.rangeFraction, `37${mark}5%`, `${language} range fraction`);
    assert.equal(fact(exp, 'equity', 'hero_equity').values.equity, `62${mark}5%`, `${language} hero equity`);
  }

  // Mounted Explain in the booted app re-formats numbers on language switch without recomputing facts.
  await setLanguage('en');
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const teacher = $('#teacherContent');
  if (teacher.style.display !== 'block') await app.click('#toggleTeacher');
  await app.settle(300);
  const potFactText = () => teacher.querySelector('[data-fact-key="pot_before_action"] .analysis-fact-primary')?.textContent;
  assert.equal(potFactText(), '1.5bb');
  await setLanguage('ru');
  assert.equal(potFactText(), '1,5bb');
  await setLanguage('he');
  assert.equal(potFactText(), '1.5bb');
  await setLanguage('en');
  assert.equal(potFactText(), '1.5bb');
});
