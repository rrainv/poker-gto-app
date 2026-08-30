import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installGuideSurface } from '../app/src/application/guide-bootstrap.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const guideHtml = html.slice(html.indexOf('id="infoView"'), html.indexOf('id="cardModal"'));
const translationSource = fs.readFileSync(new URL('../app/src/locales/guide-translations.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

test('Guide leads with five current workflow jobs and one workspace action for each', () => {
  for (const [title, destination] of [
    ['Play and review a Hand', 'hand'],
    ['Analyze a spot', 'analyze'],
    ['Train decisions', 'training'],
    ['Calculate Equity', 'equity'],
    ['Teach Personal Strategy', 'personal-strategy'],
  ]) {
    assert.match(guideHtml, new RegExp(title));
    assert.equal((guideHtml.match(new RegExp(`data-guide-destination="${destination}"`, 'g')) ?? []).length, 1);
  }
  assert.match(guideHtml, /guide-workflow-grid/);
  assert.match(guideHtml, /Use Replay to inspect the canonical timeline/);
  assert.match(guideHtml, /Choose Varied, Focused, or Full Hand practice/);
});

test('Guide exposes misuse-preventing distinctions through native disclosures', () => {
  assert.equal((guideHtml.match(/<details>/g) ?? []).length, 6);
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
  ]) assert.match(guideHtml, new RegExp(concept));
});

test('Guide states strategy, account, and current-capability boundaries truthfully', () => {
  assert.match(guideHtml, /deterministic heuristic strategy source/);
  assert.match(guideHtml, /not solved GTO, Nash, exact EV, exploitability evidence/);
  assert.match(guideHtml, /These are the implemented saved kinds today/);
  assert.match(guideHtml, /signing in alone does not guarantee cloud sync or backup/);
  for (const unsupportedClaim of [
    /production solver/i, /cloud sync is enabled/i, /saved equity/i, /saved training/i,
    /Personal Strategy is the correct answer/i, /Equity recommends/i, /full range chart/i,
    /percentage\s+rake/i, /solver[- ]tree/i, /tree upload/i, /model runtime/i,
    /Strategy Preview/i, /Total Equity/i, /every possible starting hand/i,
  ]) assert.doesNotMatch(guideHtml, unsupportedClaim);
});

test('Guide clarifies reference, orientation, and existing contextual tutorial roles', () => {
  assert.match(guideHtml, /Guide is durable product reference/);
  assert.match(guideHtml, /Learn Riverline provides orientation/);
  assert.match(guideHtml, /existing contextual teaching for that workspace/);
  assert.doesNotMatch(guideHtml, /data-tutorial-progress|data-guide-tutorial-step/);
});

test('Guide uses the 1920 desktop canvas for several workflows without a second sidebar', () => {
  assert.match(css, /\.guide-workspace--current\s*\{[^}]*width:\s*min\(1440px, 100%\)/);
  assert.match(css, /\.guide-workflow-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6/);
  assert.match(css, /\.guide-workflow-card\s*\{[^}]*grid-column:\s*span 2/);
  assert.doesNotMatch(guideHtml, /guide-sidebar|guide-rail/);
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
  const keys = [...guideHtml.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  for (const language of ['en', 'ru', 'he']) {
    for (const key of keys) assert.ok(catalogs[language][key] || key in catalogs[language] || ['Saved', 'Home Game', 'Open Hand', 'Open Training', 'Open Equity', 'Open Personal Strategy'].includes(key), `${language}: ${key}`);
  }
  assert.doesNotMatch(guideHtml, /margin-left|padding-left|margin-right|padding-right/);
  assert.match(guideHtml, /<summary data-i18n="Hand vs Scenario"/);
});
