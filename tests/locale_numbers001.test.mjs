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
