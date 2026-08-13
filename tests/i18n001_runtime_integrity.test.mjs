import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const i18nSource = fs.readFileSync(path.join(repoRoot, 'app/src/locales/i18n.js'), 'utf8');
const productTranslationsSource = fs.readFileSync(path.join(repoRoot, 'app/src/locales/product-translations.js'), 'utf8');
const analysisTranslationsSource = fs.readFileSync(path.join(repoRoot, 'app/src/locales/analysis-translations.js'), 'utf8');
const logicSource = fs.readFileSync(path.join(repoRoot, 'app/src/core/logic.js'), 'utf8');
const heuristicStrategySource = fs.readFileSync(path.join(repoRoot, 'app/src/strategy/heuristic-strategy.mjs'), 'utf8');
const strategyBootstrapSource = fs.readFileSync(path.join(repoRoot, 'app/src/application/strategy-provider-bootstrap.mjs'), 'utf8');
const teacherSource = fs.readFileSync(path.join(repoRoot, 'app/src/ui/teacher.js'), 'utf8');
const renderedAuditSource = fs.readFileSync(path.join(repoRoot, 'tests/tooling/audit_rendered_i18n.cjs'), 'utf8');
const html = fs.readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(repoRoot, 'app/styles.css'), 'utf8');
const require = createRequire(import.meta.url);
const { buildAudit, findCrossLocaleScriptContamination } = require('./tooling/audit_i18n.cjs');

class FakeElement {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.textContent = '';
    this.value = '';
    this.nodeType = 1;
  }

  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll() { return this.children; }
}

function createRuntime() {
  const clear = new FakeElement({ 'data-i18n': 'Clear' });
  const languageSelect = new FakeElement();
  const body = new FakeElement();
  body.children = [clear];
  const documentElement = {};
  const storage = new Map();
  const events = [];
  const document = {
    readyState: 'complete',
    body,
    documentElement,
    getElementById(id) { return id === 'langToggle' ? languageSelect : null; },
    addEventListener() {}
  };
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
  }
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  const window = {
    dispatchEvent(event) { events.push(event); }
  };
  const context = {
    window,
    document,
    navigator: { language: 'en-US' },
    MutationObserver: FakeMutationObserver,
    CustomEvent: FakeCustomEvent,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    Intl,
    console
  };
  vm.runInNewContext(productTranslationsSource, context, { filename: 'product-translations.js' });
  vm.runInNewContext(analysisTranslationsSource, context, { filename: 'analysis-translations.js' });
  vm.runInNewContext(i18nSource, context, { filename: 'i18n.js' });
  return { clear, context, documentElement, events, languageSelect, storage };
}

test('visible product keys have complete EN/RU/HE coverage without mojibake', () => {
  const audit = buildAudit();
  for (const language of ['en', 'ru', 'he']) {
    assert.deepEqual(audit.coverage[language].missing, [], `${language} is missing visible translation keys`);
  }
  assert.deepEqual(audit.mojibake, []);
  assert.deepEqual(audit.crossLocaleScriptContamination, []);
});

test('Russian Clear is semantically distinct from Fold and Equity uses the canonical Clear key', () => {
  const audit = buildAudit();
  assert.equal(audit.semantic.russianClear, 'Очистить');
  assert.equal(audit.semantic.russianFold, 'Фолд');
  assert.equal(audit.semantic.russianClearDistinctFromFold, true);
  assert.match(html, /data-clear="eqboard"[^>]*data-i18n="Clear"/);
  assert.match(html, /data-clear="eqdead"[^>]*data-i18n="Clear"/);
});

test('language changes update the live static DOM, persistence, direction, and event lifecycle', () => {
  const runtime = createRuntime();
  const { window } = runtime.context;
  assert.equal(runtime.clear.textContent, 'Clear');

  window.setLanguage('ru');
  assert.equal(runtime.clear.textContent, 'Очистить');
  assert.equal(runtime.documentElement.lang, 'ru');
  assert.equal(runtime.documentElement.dir, 'ltr');
  assert.equal(runtime.storage.get('language'), 'ru');
  assert.equal(runtime.storage.get('appLang'), 'ru');

  window.setLanguage('he');
  assert.equal(runtime.clear.textContent, 'נקה');
  assert.equal(runtime.documentElement.lang, 'he');
  assert.equal(runtime.documentElement.dir, 'rtl');
  assert.equal(runtime.events.at(-1).type, 'riverline:languagechange');
  assert.equal(runtime.events.at(-1).detail.language, 'he');

  window.setLanguage('en');
  assert.equal(runtime.clear.textContent, 'Clear');
  assert.equal(runtime.documentElement.dir, 'ltr');
});

test('English fallback content inside Hebrew receives structural LTR isolation', () => {
  const runtime = createRuntime();
  runtime.context.window.setLanguage('he');
  const fallback = new FakeElement({ 'data-i18n': 'Intentional English fallback probe.' });
  runtime.context.window.RiverlineI18n.translateNode(fallback);
  assert.equal(fallback.textContent, 'Intentional English fallback probe.');
  assert.equal(fallback.getAttribute('lang'), 'en');
  assert.equal(fallback.getAttribute('dir'), 'ltr');
  assert.equal(fallback.getAttribute('data-i18n-fallback'), 'ltr');
});

test('runtime messages support named interpolation through the single translation API', () => {
  const runtime = createRuntime();
  runtime.context.window.setLanguage('ru');
  assert.equal(
    runtime.context.window.t('Player {number}', { number: 2 }),
    'Игрок 2'
  );
});

test('Training matching-reference verdict localizes as Correct in every supported language', () => {
  const runtime = createRuntime();
  for (const [language, expected] of [
    ['en', 'Correct'],
    ['ru', 'Верно'],
    ['he', 'נכון']
  ]) {
    runtime.context.window.setLanguage(language);
    assert.equal(runtime.context.window.RiverlineI18n.resolveTranslation('Correct').missing, false);
    assert.equal(runtime.context.window.t('Correct'), expected);
  }
});

test('live language switching owns a dynamic rerender hook without triggering hidden strategy work', () => {
  assert.match(logicSource, /riverline:languagechange/);
  assert.match(logicSource, /refreshLocalizedRuntime/);
  assert.doesNotMatch(logicSource, /riverline:languagechange[\s\S]{0,500}schedulePlaybookUpdate/);
});

test('structured Analysis and residual renderer messages resolve in Russian and Hebrew', () => {
  const runtime = createRuntime();
  const probes = [
    ['analysis.pot.afterCall', { callAmount: '2 bb', potAfterCall: '8 bb' }],
    ['analysis.spr.stack', { stack: '30 bb' }],
    ['analysis.heuristicSample.completed', { samples: 250 }],
    ['analysis.heuristicSample.rangeFraction', { rangeFraction: '13.4%' }],
    ['Practice decisions against the current strategy sources.', {}],
    ['0.0 bb (Free Check)', {}],
    ['analysis.value.tableSize', { count: 8 }],
    ['PREFLOP', {}],
    ['FIRST ACTION', {}]
  ];
  for (const language of ['ru', 'he']) {
    runtime.context.window.setLanguage(language);
    for (const [key, values] of probes) {
      assert.equal(runtime.context.window.RiverlineI18n.resolveTranslation(key).missing, false, `${language} missing ${key}`);
      assert.doesNotMatch(
        runtime.context.window.t(key, values),
        /\b(?:Calling|makes|valid|trials|crude|assumed|range|Practice|decisions|Free|Check|max|PREFLOP|FIRST|ACTION)\b/i,
        `${language} retained English in ${key}`
      );
    }
    assert.notEqual(runtime.context.window.t('Riverline Midnight'), 'Riverline Midnight');
    assert.notEqual(runtime.context.window.t('Suited'), 'Suited');
    assert.notEqual(runtime.context.window.t('Offsuit'), 'Offsuit');
  }
});

test('unavailable StrategyResult data stays locale-neutral and both visible message surfaces localize from one authority', () => {
  const candidate = resolveHeuristicStrategy({ heroCards: [], street: 'preflop' });
  assert.equal(candidate.explanation, 'Choose two hero cards to calculate a heuristic strategy.');
  assert.deepEqual(candidate.warnings, [candidate.explanation]);
  assert.doesNotMatch(heuristicStrategySource, /translate\s*[),=]/);
  assert.doesNotMatch(strategyBootstrapSource, /\btranslate\b/);
  assert.doesNotMatch(logicSource, /createProvider\(\{[\s\S]{0,160}translate\s*:/);
  assert.match(logicSource, /function localizedStrategyExplanation/);
  assert.match(logicSource, /warning === result\.explanation \? localizedStrategyExplanation\(result\)/);

  const runtime = createRuntime();
  runtime.context.window.setLanguage('ru');
  const russian = runtime.context.window.t(candidate.explanation);
  assert.match(russian, /[\u0400-\u04FF]{2,}/u);
  assert.doesNotMatch(russian, /[\u0590-\u05FF]{2,}/u);
  runtime.context.window.setLanguage('he');
  const hebrew = runtime.context.window.t(candidate.explanation);
  assert.match(hebrew, /[\u0590-\u05FF]{2,}/u);
  assert.doesNotMatch(hebrew, /[\u0400-\u04FF]{2,}/u);
  assert.notEqual(hebrew, russian);
});

test('the full unavailable-state message family renders in the active locale only', () => {
  const runtime = createRuntime();
  const keys = [
    'Strategy unavailable',
    'Unavailable',
    'analysis.headline.unavailable',
    'analysis.unavailable.missing_hero_cards',
    'Choose two hero cards to calculate a heuristic strategy.',
    'analysis.warning.strategy_unavailable',
    'analysis.ui.unlockDetail',
    'analysis.provenance.unavailable',
    'analysis.value.noVoluntaryWager',
    'analysis.authority.scenario.label',
    'Range needed'
  ];
  for (const [language, expectedScript, forbiddenScript] of [
    ['ru', /[\u0400-\u04FF]{2,}/u, /[\u0590-\u05FF]{2,}/u],
    ['he', /[\u0590-\u05FF]{2,}/u, /[\u0400-\u04FF]{2,}/u]
  ]) {
    runtime.context.window.setLanguage(language);
    for (const key of keys) {
      const resolved = runtime.context.window.RiverlineI18n.resolveTranslation(key);
      assert.equal(resolved.missing, false, `${language} missing unavailable-family key ${key}`);
      assert.match(resolved.value, expectedScript, `${language} lacks native script for ${key}`);
      assert.doesNotMatch(resolved.value, forbiddenScript, `${language} contains cross-locale prose for ${key}`);
    }
  }
});

test('script-family diagnostics detect HE/RU contamination in either direction and translated prose in EN', () => {
  const findings = findCrossLocaleScriptContamination({
    en: { probe: 'Русский' },
    ru: { probe: 'עברית' },
    he: { probe: 'Русский' }
  }, ['probe']);
  assert.deepEqual(
    findings.map((entry) => `${entry.language}:${entry.forbiddenScript}`).sort(),
    ['en:cyrillic', 'he:cyrillic', 'ru:hebrew']
  );
});

test('theme display names and Equity seed placeholder localize without changing theme IDs', () => {
  const runtime = createRuntime();
  for (const language of ['ru', 'he']) {
    runtime.context.window.setLanguage(language);
    for (const name of ['Riverline Midnight', 'Discord Dark', 'Terminal Dark CRT']) {
      assert.notEqual(runtime.context.window.t(name), name, `${language} retained theme display name ${name}`);
    }
    assert.equal(runtime.context.window.t('Carbon Slate'), 'Carbon Slate');
    const placeholder = runtime.context.window.t('Generated automatically');
    assert.notEqual(placeholder, 'Generated automatically');
    assert.match(placeholder, language === 'ru' ? /[\u0400-\u04FF]{2,}/u : /[\u0590-\u05FF]{2,}/u);
  }
  assert.match(html, /id="equitySeed"[^>]*data-i18n-placeholder="Generated automatically"/);
  for (const id of ['midnight', 'graphite', 'daylight', 'discord', 'terminal', 'brutalist-red']) {
    assert.match(logicSource, new RegExp(`id: '${id}'`));
  }
  assert.match(logicSource, /data-theme-id="\$\{tItem\.id\}"/);
  assert.match(logicSource, /theme-swatch-name">\$\{t\(tItem\.name\)\}/);
});

test('Analysis renderer consumes structured keys and rendered audit covers live RU/HE states', () => {
  assert.match(teacherSource, /analysisMessage\(analysisFact\.templateKey, analysisFact\.text/);
  assert.match(teacherSource, /analysisMessage\(analysisFact\.labelKey, analysisFact\.label/);
  assert.match(teacherSource, /analysisMessage\(part\.templateKey, part\.text/);
  for (const state of [
    'matrix-selected', 'hand-empty', 'playbook-unavailable', 'playbook-expanded', 'range-comparison',
    'training-pre-answer', 'training-hint', 'training-answered', 'settings',
    'equity-idle', 'equity-advanced', 'equity-complete', 'guide'
  ]) {
    assert.match(renderedAuditSource, new RegExp(state));
  }
  assert.match(renderedAuditSource, /matrixPreserved/);
  assert.match(renderedAuditSource, /trainingPreserved/);
  assert.match(renderedAuditSource, /unavailablePreserved/);
  assert.match(renderedAuditSource, /sameExercise/);
  assert.match(renderedAuditSource, /aria-description/);
  assert.match(renderedAuditSource, /option-label/);
  assert.match(renderedAuditSource, /input-value/);
  assert.match(renderedAuditSource, /forbiddenScripts/);
  assert.doesNotMatch(renderedAuditSource, /THEME_PROPER_NAMES/);
});

test('Hebrew uses component-level LTR islands for invariant poker data', () => {
  assert.match(css, /\.i18n-ltr-isolate[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/);
  assert.match(css, /\[dir="rtl"\][^{]*\.equity-board-order[^}]*direction:\s*ltr/);
  assert.match(css, /\[dir="rtl"\][^{]*\.strategy-grid[^}]*direction:\s*ltr/);
  assert.match(css, /\[dir="rtl"\][^{]*\.poker-data-token[^}]*direction:\s*ltr/);
  const flop = html.indexOf('data-equity-street="flop"');
  const turn = html.indexOf('data-equity-street="turn"');
  const river = html.indexOf('data-equity-street="river"');
  assert.ok(flop >= 0 && flop < turn && turn < river, 'Equity street DOM order must remain Flop → Turn → River');
});
