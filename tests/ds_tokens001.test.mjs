// DS-TOKENS-001: Style v4 values in the token layer, contrast-safe preset roles
// (DS-CONTRAST-TOKENS), the Slate built-in (DS-THEME-SLATE) and self-hosted
// Rubik for display and headings (DS-FONT-RUBIK).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet } from './helpers/app-under-test.mjs';
import { parseHTML } from './helpers/mini-dom.mjs';
import {
  PRESENTATION_THEMES,
  contrastRatio,
  createPresentationThemeController,
} from '../app/src/application/presentation-theme.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const styles = read('../app/styles.css');
const css = appStyleSheet();
const root = parseHTML('<html><body></body></html>').documentElement;
function token(themeId, name) {
  if (themeId) root.setAttribute('data-theme', themeId);
  else root.removeAttribute('data-theme');
  return css.cascaded(root, name);
}
function memory() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
function applied(themeId) {
  const props = new Map();
  const node = { dataset: {}, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k), getPropertyValue: (k) => props.get(k) ?? '' } };
  const controller = createPresentationThemeController({ root: node, storage: memory() }).init();
  controller.apply(themeId);
  return { props, controller, node };
}
// A role as the page resolves it: the controller's inline value, else the preset block.
function resolve(themeId, props, name) {
  let value = props.get(name) ?? token(themeId, name);
  for (let i = 0; i < 6 && /^var\(/.test(value ?? ''); i += 1) {
    const ref = value.match(/var\((--[a-z0-9-]+)/)[1];
    value = props.get(ref) ?? token(themeId, ref);
  }
  return value;
}

const SURFACES = ['--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated',
  '--surface-interactive', '--surface-interactive-hover', '--surface-inset'];
const TEXT_ROLES = ['--text-primary', '--text-secondary', '--text-muted', '--accent-text', '--support-text',
  '--status-warning', '--status-danger', '--status-info', '--status-positive',
  '--action-fold-text', '--action-passive-text', '--action-aggressive-text', '--action-all-in-text'];
const AUDITED = ['midnight', 'daylight', 'slate'];

test('Style v4 geometry lives in the token layer (D-14)', () => {
  for (const [name, value] of Object.entries({
    '--radius-panel': '16px', '--radius-overlay': 'var(--radius-panel)', '--pad-panel': '22px',
    '--pad-surface': 'var(--pad-panel)', '--canvas-max': '1640px', '--control-height-md': '40px',
    '--control-height-sm': '32px', '--control-height-primary': '44px',
  })) assert.equal(token(null, name), value, name);
  // Default (comfortable) density pads panels with the Style v4 roles.
  assert.equal(token(null, '--density-panel-inline'), 'var(--pad-panel)');
  assert.equal(token(null, '--density-panel-body-block-end'), 'var(--pad-panel)');
  // Presets change colour roles only, never the scales.
  for (const theme of PRESENTATION_THEMES) {
    for (const name of ['--radius-panel', '--pad-panel', '--control-height-md', '--canvas-max']) {
      assert.equal(token(theme.id, name), token(null, name), `${theme.id} ${name}`);
    }
  }
});

test('weight roles and the card size scale match DESIGN_SYSTEM', () => {
  for (const [name, value] of Object.entries({
    '--weight-body': 'var(--weight-regular)', '--weight-control': '650', '--weight-label': '650',
    '--weight-value': '650', '--weight-heading': '650', '--weight-title': 'var(--weight-bold)',
    '--weight-section-title': '750', '--weight-display': 'var(--weight-heavy)',
  })) assert.equal(token(null, name), value, name);
  for (const scale of ['inline', 'mini', 'standard', 'table']) {
    for (const axis of ['width', 'height']) assert.match(token(null, `--card-scale-${scale}-${axis}`), /^var\(--card-size-/, `${scale} ${axis}`);
  }
});

test('every text role passes 4.5:1 on every surface of Midnight, Daylight and Slate, hover included', () => {
  for (const id of AUDITED) {
    const { props } = applied(id);
    for (const text of TEXT_ROLES) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(resolve(id, props, text), resolve(id, props, surface));
        assert.ok(ratio >= 4.5, `${id} ${text} on ${surface} = ${ratio.toFixed(2)}`);
      }
    }
    // The primary button: on-accent text on the accent and its hover.
    for (const fill of ['--accent-primary', '--accent-primary-hover']) {
      const ratio = contrastRatio(resolve(id, props, '--text-on-accent'), resolve(id, props, fill));
      assert.ok(ratio >= 4.5, `${id} on-accent on ${fill} = ${ratio.toFixed(2)}`);
    }
    // Non-text: focus ring and accent fill reach 3:1 on every surface.
    for (const surface of SURFACES) {
      for (const mark of ['--border-focus', '--accent-primary']) {
        const ratio = contrastRatio(resolve(id, props, mark), resolve(id, props, surface));
        assert.ok(ratio >= 3, `${id} ${mark} on ${surface} = ${ratio.toFixed(2)}`);
      }
    }
  }
});

test('poker action fill hues are never used as text colour', () => {
  for (const [, selector, value] of styles.matchAll(/([^{}]+)\{[^}]*?(?<![-\w])color:\s*var\(--action-(fold|passive|aggressive|all-in)\)/g)) {
    assert.fail(`${selector.trim()} uses --action-${value} as text; use --action-${value}-text`);
  }
});

test('Slate is a read-only built-in preset; editing it makes a separate custom copy', () => {
  const slate = PRESENTATION_THEMES.find((theme) => theme.id === 'slate');
  assert.ok(slate, 'Slate is built in');
  assert.equal(slate.name, 'Riverline Slate');
  assert.deepEqual({ ...slate.preview }, { accent: '#5b9bd5', surface: '#121417', felt: '#2b3a4a' });
  assert.equal(token('slate', '--surface-canvas'), '#121417');
  assert.equal(token('slate', '--surface-panel'), '#1b1f24');
  assert.equal(token('slate', '--accent-primary'), '#5b9bd5');
  assert.equal(token('slate', '--poker-felt-accent'), '#2b3a4a');
  // The legacy-theme remap must not override Slate's own roles.
  assert.match(styles, /html:not\(\[data-theme="midnight"\]\):not\(\[data-theme="graphite"\]\):not\(\[data-theme="daylight"\]\):not\(\[data-theme="slate"\]\)/);
  assert.match(read('../app/src/application/presentation-theme-prepaint.js'), /'slate'\]\.includes\(cache\.theme\)/);

  const { controller, node } = applied('slate');
  assert.equal(node.dataset.theme, 'slate');
  assert.equal(node.dataset.presentationThemeId, 'slate');
  assert.equal(controller.deleteTheme('slate'), false);
  assert.equal(controller.renameTheme('slate', 'Mine'), null);
  controller.beginEdit();
  controller.customize({ accent: '#e0a458' });
  const copy = controller.saveAsNew('Your copy');
  assert.match(copy.id, /^custom-/);
  assert.equal(copy.baseThemeId, 'slate');
  controller.apply('slate');
  assert.equal(controller.getColors().accent, '#5b9bd5', 'the built-in is unchanged by the copy');
});

test('Rubik is self-hosted for display and headings only; no runtime font CDN', () => {
  const dir = new URL('../app/src/ui/assets/fonts/rubik/', import.meta.url);
  const faces = [...styles.matchAll(/@font-face\s*\{[^}]*font-family:\s*"Rubik"[^}]*url\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.equal(faces.length, 5);
  for (const subset of ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'hebrew']) {
    const file = `src/ui/assets/fonts/rubik/rubik-${subset}-wght-normal.woff2`;
    assert.ok(faces.includes(file), file);
    assert.equal(fs.readFileSync(new URL(`../app/${file}`, import.meta.url)).subarray(0, 4).toString('latin1'), 'wOF2', file);
  }
  assert.match(fs.readFileSync(new URL('OFL.txt', dir), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(read('../docs/THIRD_PARTY.md'), /\| Rubik \(variable, woff2\)/);
  assert.match(token(null, '--font-display'), /^"Rubik", /);
  assert.doesNotMatch(token(null, '--font-ui'), /Rubik/, 'body text keeps the UI font');
  const index = read('../app/index.html');
  assert.match(index, /font-src 'self' data:/);
  assert.match(index, /<link rel="preload" href="src\/ui\/assets\/fonts\/rubik\/rubik-latin-wght-normal\.woff2" as="font" type="font\/woff2" crossorigin>/);
  for (const source of [styles, index]) assert.doesNotMatch(source, /fonts\.(googleapis|gstatic)\.com/);
  // The shipped file list covers the font folder (build.files includes src/**).
  assert.ok(JSON.parse(read('../app/package.json')).build.files.includes('src/**/*'));
});
