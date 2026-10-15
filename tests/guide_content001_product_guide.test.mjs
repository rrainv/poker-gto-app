import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installGuideSurface } from '../app/src/application/guide-bootstrap.mjs';
import { appStyleSheet, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: the Guide is queried as parsed markup and its layout is
// resolved through the cascade, instead of slicing index.html / styles.css.
const markup = indexDocument();
const guide = markup.getElementById('infoView');
const guideText = text(guide);
const translationSource = fs.readFileSync(new URL('../app/src/locales/guide-translations.js', import.meta.url), 'utf8');
const css = appStyleSheet();

test('Guide leads with five current workflow jobs and one workspace action for each', () => {
  for (const [title, destination] of [
    ['Play and review a Hand', 'hand'],
    ['Analyze a spot', 'analyze'],
    ['Train decisions', 'training'],
    ['Calculate Equity', 'equity'],
    ['Teach Personal Strategy', 'personal-strategy'],
  ]) {
    assert.match(guideText, new RegExp(title));
    assert.equal(guide.querySelectorAll(`[data-guide-destination="${destination}"]`).length, 1, destination);
  }
  assert.ok(guide.querySelector('.guide-workflow-grid'));
  assert.match(guideText, /Use Replay to inspect the canonical timeline/);
  assert.match(guideText, /Choose Varied, Focused, or Full Hand practice/);
});

test('Guide exposes misuse-preventing distinctions through native disclosures', () => {
  assert.equal(guide.querySelectorAll('details').length, 6);
  for (const concept of [
    'Hand is canonical legal poker history',
    'intentionally bounded, lossy study snapshot',
    'reference or source is separate strategy evidence',
    'Personal Strategy records how you intend to play',
    'Facts are structured trusted evidence',
    'Explain offers a bounded interpretation',
    'Equity compares possible outcomes; it does not recommend an action',
    'not automatically a winning out',
    'saved Hands retain canonical history',
    'saved Spots retain Scenario limitations',
  ]) assert.match(guideText, new RegExp(concept));
});

test('Guide states strategy, account, and current-capability boundaries truthfully', () => {
  assert.match(guideText, /deterministic heuristic strategy source/);
  assert.match(guideText, /not solved GTO, Nash, exact EV, exploitability evidence/);
  assert.match(guideText, /These are the implemented saved kinds today/);
  assert.match(guideText, /signing in alone does not guarantee cloud sync or backup/);
  for (const unsupportedClaim of [
    /production solver/i, /cloud sync is enabled/i, /saved equity/i, /saved training/i,
    /Personal Strategy is the correct answer/i, /Equity recommends/i, /full range chart/i,
    /percentage\s+rake/i, /solver[- ]tree/i, /tree upload/i, /model runtime/i,
    /Strategy Preview/i, /Total Equity/i, /every possible starting hand/i,
  ]) assert.doesNotMatch(guideText, unsupportedClaim);
});

test('Guide clarifies reference, orientation, and existing contextual tutorial roles', () => {
  assert.match(guideText, /Guide is durable product reference/);
  assert.match(guideText, /Learn Riverline provides orientation/);
  // SHELL-001: the header Help control (formerly the tutorial control) carries
  // each workspace's description and its contextual tutorials.
  assert.match(guideText, /Help in each workspace describes it and starts its contextual tutorials where available/);
  assert.equal(guide.querySelector('[data-tutorial-progress], [data-guide-tutorial-step]'), null);
});

test('Guide uses the 1920 desktop canvas for several workflows without a second sidebar', () => {
  // SHELL-001: the Guide uses the shared canvas frame width.
  const workspace = guide.querySelector('.guide-workspace--current') || guide.closest('.guide-workspace--current');
  assert.equal(css.cascaded(workspace, 'width'), 'min(100%, var(--canvas-max))');
  assert.match(css.cascaded(guide.querySelector('.guide-workflow-grid'), 'grid-template-columns'), /^repeat\(6/);
  const cards = guide.querySelectorAll('.guide-workflow-card');
  assert.ok(cards.length >= 5);
  for (const card of cards.slice(0, 3)) assert.equal(css.cascaded(card, 'grid-column'), 'span 2');
  assert.equal(guide.querySelector('.guide-sidebar, .guide-rail'), null);
});

test('Guide destinations activate controls from the existing navigation registry', () => {
  let listener;
  let clicked = 0;
  const action = { dataset: { guideDestination: 'training' } };
  const surface = {
    addEventListener(type, callback) { if (type === 'click') listener = callback; },
    removeEventListener() {},
    contains(candidate) { return candidate === action; },
  };
  const nav = { click() { clicked += 1; } };
  const document = {
    querySelector(selector) {
      if (selector === '#infoView') return surface;
      if (selector === '.mode-nav-item[data-navigation-id="training"]') return nav;
      return null;
    },
  };
  const bridge = installGuideSurface({ document });
  listener({ target: { closest: () => action } });
  assert.equal(clicked, 1);
  assert.equal(bridge.navigate('unavailable'), false);
});

test('Guide copy has EN, RU, and HE catalog coverage and RTL-safe structure', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(translationSource, sandbox);
  const catalogs = sandbox.window.riverlineGuideTranslations;
  const keys = guide.querySelectorAll('[data-i18n]').map((node) => node.dataset.i18n);
  for (const language of ['en', 'ru', 'he']) {
    for (const key of keys) assert.ok(catalogs[language][key] || key in catalogs[language] || ['Saved', 'Home Game', 'Open Hand', 'Open Training', 'Open Equity', 'Open Personal Strategy'].includes(key), `${language}: ${key}`);
  }
  // RTL-safe: no inline physical spacing anywhere in the Guide.
  for (const node of [guide, ...guide.querySelectorAll('[style]')]) {
    assert.doesNotMatch(node.getAttribute('style') || '', /margin-left|padding-left|margin-right|padding-right/);
  }
  assert.equal(guide.querySelector('summary[data-i18n="Hand vs Scenario"]')?.localName, 'summary');
});
