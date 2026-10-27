// TEST-HYGIENE-001: behavioural rewrite. Theme tokens are resolved through the
// cascade on the document root per theme; Settings markup is queried; the
// running app's theme switching is observed. The density bootstrap source is
// outside this ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_THEME,
  PRESENTATION_THEMES,
  normalizePresentationTheme,
} from '../app/src/application/presentation-theme.mjs';
import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';
import { parseHTML } from './helpers/mini-dom.mjs';

const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const probe = parseHTML('<html><body><button>Probe</button><p>Copy</p></body></html>');
const root = probe.documentElement;
function token(themeId, name) {
  if (themeId) root.setAttribute('data-theme', themeId);
  else root.removeAttribute('data-theme');
  return css.cascaded(root, name);
}
const rootTokens = () => [...new Set(css.matchingRules(root).flatMap((rule) => rule.declarations
  .map((declaration) => declaration.property).filter((property) => property.startsWith('--'))))];

test('the document and presentation authority default to Riverline Midnight', async () => {
  const html = markup.documentElement;
  assert.equal(html.getAttribute('lang'), 'en');
  assert.equal(html.dataset.theme, 'midnight');
  assert.equal(DEFAULT_PRESENTATION_THEME, 'midnight');
  assert.equal(normalizePresentationTheme('discord'), 'midnight');
  assert.match(bootstrap, /createPresentationThemeController/);
  assert.match(bootstrap, /storage: window\.localStorage/);

  // Protects: logic.js has no legacy theme authority; theme changes never use
  // the legacy 'appTheme' storage key.
  const app = await bootApp();
  for (const name of ['THEME_PREVIEWS', 'initThemeSwatches']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  const touched = [];
  const storage = app.window.localStorage;
  const { getItem, setItem } = storage;
  storage.getItem = (key) => { touched.push(key); return getItem.call(storage, key); };
  storage.setItem = (key, value) => { touched.push(key); return setItem.call(storage, key, value); };
  try {
    await app.click('#openSettings');
    // Choosing a theme re-renders the swatches: query each one afresh.
    for (let index = 0; index < 3; index += 1) await app.click(app.$$('#themeSwatchGrid button')[index]);
    await app.click('#closeSettingsModal');
  } finally {
    storage.getItem = getItem;
    storage.setItem = setItem;
  }
  assert.equal(touched.includes('appTheme'), false);
  assert.equal(Object.hasOwn(storage._entries(), 'appTheme'), false);
});

test('the semantic foundation exposes the required token families', () => {
  const requiredTokens = [
    '--font-display', '--font-ui', '--font-data', '--space-1', '--space-11',
    '--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated', '--surface-interactive', '--surface-inset',
    '--text-primary', '--text-secondary', '--text-muted', '--text-disabled',
    '--border-subtle', '--border-default', '--border-strong', '--border-focus', '--border-invalid',
    '--selection-background', '--selection-border', '--accent-primary', '--accent-primary-hover', '--accent-secondary',
    '--status-positive', '--status-warning', '--status-danger', '--status-info',
    '--action-fold', '--action-passive', '--action-aggressive', '--action-all-in', '--action-mixed',
    '--equity-primary', '--equity-tie', '--ev-positive', '--ev-neutral', '--ev-negative',
    '--card-face', '--card-border', '--card-back', '--poker-felt-accent',
    '--suit-heart', '--suit-spade', '--suit-diamond', '--suit-club',
    '--shadow-panel', '--shadow-overlay', '--radius-control', '--radius-panel',
    '--motion-micro', '--motion-panel', '--motion-table', '--ease-out', '--ease-in-out', '--ease-drawer', '--ease-spring',
  ];
  for (const themeId of ['midnight', 'graphite', 'daylight']) {
    for (const name of requiredTokens) assert.ok(token(themeId, name), `${themeId} ${name}`);
  }
});

test('the three supported themes define distinct restrained semantic palettes', () => {
  assert.deepEqual(PRESENTATION_THEMES.map((theme) => theme.id), ['midnight', 'graphite', 'daylight']);
  assert.equal(token('midnight', 'color-scheme'), 'dark');
  assert.equal(token('midnight', '--surface-canvas'), '#101311');
  assert.equal(token('graphite', 'color-scheme'), 'dark');
  assert.equal(token('graphite', '--surface-canvas'), '#14171a');
  // SAVED-COMPOSITION-002 amendment 2: Graphite keeps its surfaces with the jade accent family.
  assert.equal(token('graphite', '--accent-primary'), '#42ad7b');
  assert.equal(token('daylight', 'color-scheme'), 'light');
  // TOKEN-TUNING (SAVED-COMPOSITION-002 Part 3): the owner's Final Daylight canvas.
  assert.equal(token('daylight', '--surface-canvas'), '#e2ddd2');
  assert.equal(token('daylight', '--status-danger'), '#a34049');

  // Each theme sets its own value for the semantic surface/text/status roles.
  for (const name of [
    '--surface-panel', '--surface-elevated', '--text-primary', '--text-muted',
    '--border-focus', '--selection-background', '--accent-primary',
    '--status-positive', '--status-warning', '--status-danger', '--status-info', '--poker-felt-accent',
  ]) {
    for (const themeId of ['midnight', 'graphite', 'daylight']) {
      root.setAttribute('data-theme', themeId);
      const own = css.matchingRules(root).some((rule) => rule.selectorText.includes(`data-theme="${themeId}"`)
        && rule.declarations.some((declaration) => declaration.property === name));
      assert.ok(own, `${themeId} defines ${name}`);
    }
    assert.ok(new Set(['midnight', 'graphite', 'daylight'].map((themeId) => token(themeId, name))).size >= 2, `${name} varies by theme`);
  }
});

test('poker action and suit meanings do not vary by supported theme', () => {
  root.removeAttribute('data-theme');
  const semantic = rootTokens().filter((name) => /^--(?:action|matrix|suit)-/.test(name));
  assert.ok(semantic.length >= 9);
  const baseline = Object.fromEntries(semantic.map((name) => [name, token('midnight', name)]));
  for (const themeId of PRESENTATION_THEMES.map((theme) => theme.id)) {
    for (const name of semantic) assert.equal(token(themeId, name), baseline[name], `${themeId} ${name}`);
  }
  assert.equal(token('midnight', '--theme-act1'), 'var(--action-aggressive)');
  assert.equal(token('midnight', '--theme-act2'), 'var(--action-passive)');
  assert.equal(token('midnight', '--theme-act3'), 'var(--action-fold)');
  assert.equal(token('midnight', '--matrix-mix'), 'var(--action-mixed)');
});

test('Settings exposes immutable built-ins, a custom library, and three exact Riverline color triggers', () => {
  assert.equal(markup.getElementById('themeSwatchGrid').getAttribute('role'), 'group');
  assert.equal(markup.getElementById('customThemeGrid').getAttribute('role'), 'group');
  for (const [id, tokenName] of [['themeAccentColor', 'accent'], ['themeSurfaceColor', 'surface'], ['themeFeltColor', 'felt']]) {
    assert.equal(markup.getElementById(id).dataset.themeColorToken, tokenName, id);
  }
  assert.equal(markup.getElementById('riverlineColorPicker').getAttribute('role'), 'dialog');
  assert.equal(markup.querySelector('input[type="color"]'), null);
  assert.ok(markup.getElementById('resetThemeCustomization'));
  assert.doesNotMatch(markup.body.textContent, /Legacy \/ Experimental|discord-0px|Casino Felt/);
  assert.equal(markup.querySelector('[data-theme-id="discord-0px"], [value="discord-0px"]'), null);
});

test('focus, selection, and reduced-motion safety rails are present', () => {
  // Protects: keyboard focus shows the focus-token outline; selected text uses
  // the selection token; reduced motion collapses animation durations.
  const button = probe.querySelector('button');
  button.focus();
  assert.match(css.cascaded(button, 'outline', { states: ['focus-visible'] }) || '', /^2px solid var\(--border-focus\)/);
  const paragraph = probe.querySelector('p');
  const selection = css.cascaded(paragraph, 'background', { pseudoElement: 'selection' }) ?? css.cascaded(paragraph, 'background-color', { pseudoElement: 'selection' });
  assert.match(selection || '', /var\(--selection-background\)/);
  assert.match(css.cascaded(paragraph, 'animation-duration', { reducedMotion: true }), /^0?\.01ms$/);
  assert.doesNotMatch(css.cascaded(paragraph, 'animation-duration') || '', /^0?\.01ms$/);
});
