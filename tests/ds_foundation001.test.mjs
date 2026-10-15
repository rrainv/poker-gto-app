import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createSavedPokerPreview } from '../app/src/application/saved-poker-preview.mjs';
import { startDevWebServer } from '../tools/dev-web-server.mjs';
import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: component styling is resolved through the cascade on probes,
// tokens are read from the cascaded :root, markup is parsed, and the Equity
// tile is rendered in the booted app. Design-system policy lints with no
// runtime observable are parsed and marked SOURCE-SHAPE.
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const root = markup.documentElement;
const packageJson = JSON.parse(read('../app/package.json'));
// SOURCE-SHAPE: the design-system ownership rules (one :root token block, a
// token-only component layer with no per-theme overrides, relocated surface
// rules that never restyle shared components, no RTL rule that mirrors the
// check glyph) are policy lints over the stylesheet as authored — parsed into
// rules, not regex-matched.
const raw = read('../app/styles.css');
const sliceSheet = (start, end) => new StyleSheetModel(raw.slice(raw.indexOf('*/', start) + 2, end));
const layerStart = raw.indexOf('DS-FOUNDATION-001: component layer');
const layer = sliceSheet(layerStart, raw.lastIndexOf('/*', raw.indexOf('/* Modal and settings') + 1));
const relocatedStart = raw.indexOf('Surface styles relocated from the retired');
const relocated = sliceSheet(relocatedStart, raw.length);
const authored = (sheet) => sheet.rules.map((rule) => `${rule.selectorText}{${rule.declarations.map(({ property, value }) => `${property}:${value}`).join(';')}}`).join('\n');
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}
const cascaded = (element, property, options) => css.cascaded(element, property, options);
// The booted app stubs network access and installs fake timers; the
// dev-server test runs with Node's own fetch and timers.
const nodeGlobals = Object.fromEntries(['fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
  .map((name) => [name, globalThis[name]]));
async function withNodeGlobals(callback) {
  const saved = Object.fromEntries(Object.keys(nodeGlobals).map((name) => [name, globalThis[name]]));
  Object.assign(globalThis, nodeGlobals);
  try { return await callback(); } finally { Object.assign(globalThis, saved); }
}

test('the riverline-design override layer is retired, not moved to another file', () => {
  assert.equal(fs.existsSync(new URL('../app/src/ui/riverline-design.css', import.meta.url)), false);
  const stylesheets = markup.querySelectorAll('link[rel="stylesheet"]');
  assert.equal(stylesheets.length, 1, 'styles.css is the only product stylesheet');
  assert.doesNotMatch(stylesheets[0].getAttribute('href'), /riverline-design\.css/);
  assert.ok(relocatedStart > 0, 'the relocated surface section exists');
  // Relocated surface rules must not restyle shared components.
  for (const rule of relocated.rules) {
    for (const selector of rule.selectors) {
      assert.doesNotMatch(selector, /^\.ui-button(?:[:.\s]|$)|^:is\(\.ui-tab|^\.panel$/, selector);
    }
  }
  assert.doesNotMatch(authored(relocated), /--riverline-(?:brass|analysis|game|depth)|--info-primary|#38bdf8/);
});

test('one :root token block owns type, spacing, radius, elevation and control tokens', () => {
  assert.equal(css.rules.filter((rule) => rule.selectorText === ':root' && rule.conditions.length === 0).length, 1);
  for (const token of ['--t-hero', '--t-display', '--t-title', '--t-heading', '--t-body', '--t-small', '--t-label',
    '--weight-strong', '--gap-group', '--gap-section', '--pad-surface', '--gutter-canvas', '--control-height-md',
    '--control-height-sm', '--radius-cell', '--radius-control', '--radius-panel', '--radius-pill',
    '--elevation-surface', '--elevation-overlay', '--provenance']) {
    assert.ok(cascaded(root, token), token);
  }
  // Legacy names map onto the scale instead of competing with it.
  assert.equal(cascaded(root, '--text-body-size'), 'var(--t-body)');
  assert.equal(cascaded(root, '--text-label-size'), 'var(--t-small)');
  assert.equal(cascaded(root, '--radius-md'), 'var(--radius-control)');
  // Color roles derive from theme tokens; no preset value is duplicated here.
  assert.equal(cascaded(root, '--provenance'), 'var(--support-text, var(--accent-secondary))');
});

test('components consume role tokens: no hard-coded jade, no per-theme overrides', () => {
  assert.ok(layerStart > 0);
  for (const rule of layer.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b/i, `component layer uses tokens only: ${rule.selectorText}`);
    assert.doesNotMatch(rule.selectorText, /\[data-theme=/);
  }
  for (const component of ['.ui-button', '.ui-field', '.ui-check', '.ui-switch', '.ui-segments', '.ui-tab', '.ui-tabs',
    '.ui-chip', '.ui-badge', '.ui-callout', '.ui-facts', '.ui-disclosure', '.ui-row', '.poker-island', '.ui-stepper']) {
    assert.ok(layer.rulesMentioning(component).length > 0, component);
  }
  // Variants and callout tones restyle the component.
  const base = probe('<button class="ui-button">x</button>');
  for (const variant of ['primary', 'quiet', 'danger', 'icon']) {
    const button = probe(`<button class="ui-button" data-variant="${variant}">x</button>`);
    const look = ['background', 'color', 'border-color', 'width'].map((property) => cascaded(button, property)).join('|');
    assert.notEqual(look, ['background', 'color', 'border-color', 'width'].map((property) => cascaded(base, property)).join('|'), variant);
  }
  const callout = probe('<div class="ui-callout">x</div>');
  for (const tone of ['caution', 'assumption']) {
    const toned = probe(`<div class="ui-callout" data-tone="${tone}">x</div>`);
    assert.notEqual(cascaded(toned, '--callout-tone'), cascaded(callout, '--callout-tone'), tone);
  }
});

test('selected segments and toggles use an elevated surface and accent underline, never an accent fill', () => {
  const segments = probe('<div class="ui-segments"><button class="ui-tab" aria-selected="true">T</button></div>');
  const selected = segments.firstElementChild;
  assert.equal(cascaded(selected, 'background'), 'var(--surface-elevated)');
  assert.equal(cascaded(selected, 'box-shadow'), 'inset 0 -2px 0 var(--accent-primary)');
  assert.doesNotMatch(`${cascaded(selected, 'background')} ${cascaded(selected, 'color')}`, /accent-primary\)$|text-on-accent/);
  // Settings T/10 caption (QA-DS-FOUNDATION-002) is no longer light text on an accent fill.
  assert.equal(markup.getElementById('cardRankStyleControl').className, 'ui-segments card-rank-style-control');
  assert.equal(cascaded(probe('<button class="ui-button" aria-pressed="true">x</button>'), 'background'), 'var(--surface-elevated)');
});

test('checkboxes and radios render a visible, theme-driven checked state', () => {
  const checkbox = probe('<input type="checkbox">');
  assert.equal(cascaded(checkbox, 'appearance'), 'none');
  assert.notEqual(cascaded(checkbox, 'background-color'), 'var(--accent-primary)');
  checkbox.setAttribute('checked', '');
  assert.equal(cascaded(checkbox, 'background-color'), 'var(--accent-primary)');
  const radio = probe('<input type="radio" checked>');
  assert.ok(css.matchingRules(radio).some((rule) => rule.selectorText.includes(':where(input[type="radio"]):checked')));
});

test('one shared check glyph: a centered mask painted in --text-on-accent, never mirrored', () => {
  // A single SVG mask token, 2-unit stroke in a 12-unit box drawn at 12px (2px stroke).
  const glyph = cascaded(root, '--check-glyph')?.match(/^url\("data:image\/svg\+xml,([^"]+)"\)$/)?.[1];
  assert.ok(glyph, 'check glyph token');
  const svg = decodeURIComponent(glyph);
  assert.match(svg, /viewBox='0 0 12 12'/);
  assert.match(svg, /stroke-width='2'/);
  assert.match(svg, /stroke-linecap='round'/);
  const box = probe('<input type="checkbox" checked>');
  assert.equal(cascaded(box, 'background-color', { pseudoElement: 'before' }), 'var(--text-on-accent)');
  assert.equal(cascaded(box, 'mask', { pseudoElement: 'before' }), 'var(--check-glyph) center / 12px 12px no-repeat');
  assert.equal(cascaded(box, 'display'), 'inline-grid');
  assert.equal(cascaded(box, 'place-content'), 'center');
  // No RTL rule may flip the glyph, and the old gradient-drawn check is gone.
  root.setAttribute('dir', 'rtl');
  assert.equal(css.matchingRules(box).filter((rule) => rule.selectorText.includes('[dir="rtl"]')).length, 0);
  assert.equal(css.matchingRules(box, { pseudoElement: 'before' }).filter((rule) => rule.selectorText.includes('[dir="rtl"]')).length, 0);
  root.setAttribute('dir', 'ltr');
  assert.doesNotMatch(authored(layer), /to top right, transparent calc/);
  // Disabled stays perceivable: a dashed --text-disabled boundary (>= 4.5:1 by theme derivation).
  const disabled = probe('<input type="checkbox" disabled>');
  assert.equal(cascaded(disabled, 'border-style'), 'dashed');
  assert.equal(cascaded(disabled, 'border-color'), 'var(--text-disabled)');
});

test('switch thumb and track use contrasting roles in both states; no later rule repaints them', () => {
  // Every real switch in the product resolves to the component's colours in
  // both states (no later rule repaints track or thumb).
  const switches = markup.querySelectorAll('button.switch, button.ui-switch');
  assert.ok(switches.length >= 3);
  for (const control of switches) {
    const thumb = control.querySelector('b');
    const wasOn = control.classList.contains('on');
    for (const on of [false, true]) {
      control.classList.toggle('on', on);
      control.setAttribute('aria-pressed', String(on));
      assert.equal(cascaded(control, 'color'), on ? 'var(--text-on-accent)' : 'var(--text-secondary)', `${control.id} color`);
      assert.equal(cascaded(control, 'background'), on ? 'var(--accent-primary)' : 'var(--surface-inset)', `${control.id} track`);
      if (!on) assert.equal(cascaded(control, 'border'), '1px solid var(--text-muted)', control.id);
      assert.equal(cascaded(thumb, 'background'), 'currentColor', `${control.id} thumb`);
      if (on) assert.equal(cascaded(thumb, 'transform'), 'translateX(18px)', control.id);
    }
    control.classList.toggle('on', wasOn);
    control.setAttribute('aria-pressed', String(wasOn));
  }
});

test('type hierarchy uses color roles, not only size; accent is never a text-hierarchy color', () => {
  const role = (cls) => cascaded(probe(`<p class="${cls}">x</p>`), 'color');
  assert.equal(role('t-hero'), 'var(--text-primary)');
  assert.equal(role('t-display'), 'var(--text-primary)');
  assert.equal(role('t-title'), 'var(--text-primary)');
  assert.equal(role('t-heading'), 'var(--text-primary)');
  assert.equal(role('t-body'), 'var(--text-secondary)');
  assert.equal(role('t-small'), 'var(--text-muted)');
  assert.equal(role('t-label'), 'var(--text-muted)');
  for (const [kind, action] of [['fold', 'fold'], ['passive', 'call'], ['aggressive', 'raise'], ['all-in', 'all-in']]) {
    const name = probe(`<div class="recommend" data-action-kind="${kind}"><span class="action-name">x</span></div>`).firstElementChild;
    assert.equal(cascaded(name, 'color'), `var(--action-${kind}-text)`, kind);
    assert.equal(cascaded(probe(`<p class="t-hero" data-action="${action}">x</p>`), 'color'), `var(--action-${kind}-text)`, action);
  }
  // Accent is never a text-hierarchy colour.
  for (const cls of ['t-hero', 't-display', 't-title', 't-heading', 't-body', 't-small', 't-label']) {
    assert.doesNotMatch(role(cls), /--(?:accent-primary|accent-text|provenance|support-text)/, cls);
  }
  assert.notEqual(cascaded(probe('<div class="recommend"><span class="action-name">x</span></div>').firstElementChild, 'color'), 'var(--accent-primary)');
  // Component labels and metadata take the muted role; prose in callouts the secondary role.
  assert.equal(cascaded(probe('<dl class="ui-facts"><dt>a</dt></dl>').firstElementChild, 'color'), 'var(--text-muted)');
  assert.equal(cascaded(probe('<span class="ui-row-meta">a</span>'), 'color'), 'var(--text-muted)');
  assert.equal(cascaded(probe('<div class="ui-callout">a</div>'), 'color'), 'var(--text-secondary)');
});

test('action text roles are theme-derived, contrast-safe and mirror the stable action hues', async () => {
  const { POKER_ACTION_COLORS, createPresentationThemeController, contrastRatio, deriveFeatureSurfaceRoles } = await import('../app/src/application/presentation-theme.mjs');
  for (const [name, hex] of Object.entries(POKER_ACTION_COLORS)) {
    assert.equal(cascaded(root, `--action-${name}`), hex, `${name} hue mirrors styles.css`);
    assert.equal(cascaded(root, `--action-${name}-text`), `var(--action-${name})`, `${name} pre-bootstrap fallback`);
  }
  const memory = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) }; };
  const makeRoot = () => { const props = new Map(); return { dataset: {}, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k), getPropertyValue: (k) => props.get(k) ?? '' }, props }; };
  const cases = [['midnight'], ['graphite'], ['daylight'], ['custom', { accent: '#e0a458', surface: '#1b2230', felt: '#5b3a6b' }], ['custom', { surface: '#f4f1ea' }], ['custom', { surface: '#5a5a5a', accent: '#b27e4d' }]];
  for (const [id, custom] of cases) {
    const root = makeRoot();
    const theme = createPresentationThemeController({ root, storage: memory() }).init();
    if (custom) { theme.beginEdit(); theme.customize(custom); theme.saveAsNew('Contrast case'); } else theme.apply(id);
    const colors = theme.getColors();
    const roles = deriveFeatureSurfaceRoles(colors);
    for (const name of Object.keys(POKER_ACTION_COLORS)) {
      const text = root.props.get(`--action-${name}-text`);
      assert.match(text, /^#[0-9a-f]{6}$/, `${id} ${name} derived`);
      for (const surface of [roles['--analysis-surface'], roles['--analysis-primary-surface'], roles['--learning-surface']]) {
        assert.ok(contrastRatio(text, surface) >= 4.5, `${id} ${JSON.stringify(custom)} ${name} ${text} on ${surface}`);
      }
    }
  }
});

test('adopted families use the components: Saved chips, toggle, checkboxes; Equity segments and buttons', async () => {
  const savedLibrary = read('../app/src/application/saved-library-workspace.mjs');
  const savedHistory = read('../app/src/application/saved-training-history-workspace.mjs');

  // Retargeted by SAVED-COMPOSITION-002: chips are built with the local button helper and
  // "Mistakes only" is a toggle chip (aria-pressed) instead of a checkbox.
  assert.match(savedLibrary, /button\('saved-library-category ui-chip', undefined, \{ variant: 'filter'/);
  assert.match(savedLibrary, /el\('strong', 'ui-chip-count', '0'\)/);
  assert.match(savedLibrary, /button\('saved-library-toggle ui-chip', undefined, \{ variant: 'filter', savedLibraryMistakes: '' \}\)/);
  // Retargeted by SAVED-COMPOSITION-002 (mockup fidelity): the view switch is underline Tabs
  // with radio items (one tab stop, arrow keys), not a Segmented control.
  assert.match(savedHistory, /el\('div', 'saved-view-toggle-group ui-tabs'\)/);
  assert.match(savedHistory, /el\('label', 'saved-view-option ui-tabs-item'\)/);
  // The rendered Equity hand-mode control is a small Segmented control.
  const app = await bootApp();
  await app.navigate('equity');
  const segments = app.$('#equityPlayers .equity-hand-mode');
  assert.ok(segments.classList.contains('ui-segments'));
  assert.equal(segments.dataset.size, 'sm');
  assert.equal(markup.getElementById('calculate').className, 'ui-button ui-button--primary equity-calculate');
  assert.equal(markup.getElementById('cancelEquity').className, 'ui-button ui-button--danger equity-cancel');
  // The adopted families no longer carry their own look in surface CSS.
  for (const selector of ['.saved-library-category[aria-pressed="true"]', '.equity-hand-mode button[aria-pressed="true"]', '.saved-view-option:has(input:checked)']) {
    assert.equal(css.rules.filter((rule) => rule.selectors.includes(selector)).length, 0, selector);
  }
});

test('Saved poker previews keep cards left-to-right in every locale (HE card order)', () => {
  const dom = createFakeDom();
  const preview = createSavedPokerPreview(dom.document, {
    kind: 'hand', derivation: 'exact', heroCards: ['Js', '3c'], board: ['6d', '8h', '2s', '6h', 'Ts'],
  });
  const rows = descendants(preview).filter((node) => String(node.className || '').includes('saved-preview-cards'));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.match(row.className, /\bpoker-island\b/);
    assert.equal(row.dir, 'ltr');
  }
  assert.deepEqual(rows[0].children.map((card) => card.getAttribute('aria-label')), ['Js', '3c'], 'DOM order is the stored order');
  for (const island of [probe('<div class="poker-island"></div>'), probe('<div data-poker-island></div>')]) {
    root.setAttribute('dir', 'rtl');
    assert.equal(cascaded(island, 'direction'), 'ltr');
    assert.equal(cascaded(island, 'unicode-bidi'), 'isolate');
    root.setAttribute('dir', 'ltr');
  }
});

test('the component sheet is dev-only: served under /__dev/, never shipped or linked in the app', async () => {
  assert.equal(fs.existsSync(new URL('../tools/dev-pages/component-sheet.html', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../app/dev', import.meta.url)), false);
  assert.ok(!packageJson.build.files.some((entry) => /tools|dev-pages/.test(entry)));
  assert.doesNotMatch(markup.documentElement.outerHTML, /component-sheet|__dev/);
  const sheet = read('../tools/dev-pages/component-sheet.mjs');
  assert.doesNotMatch(sheet, /data-i18n/, 'sheet text is never a static i18n placeholder');
  assert.doesNotMatch(sheet, /localStorage/, 'sheet theme state stays in memory');

  await withNodeGlobals(async () => {
    const runner = await startDevWebServer({ port: 0 });
    try {
      const page = await fetch(`${runner.url}/__dev/component-sheet.html`);
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type') || '', /text\/html/);
      assert.match(await page.text(), /component-sheet\.mjs/);
      for (const escape of ['/__dev/../app/index.html', '/__dev/%2e%2e/dev-web-server.mjs', '/__dev/']) {
        const response = await fetch(`${runner.url}${escape}`);
        assert.equal(response.status, 404, escape);
      }
      // The app root still serves the product, unaffected by the dev route.
      assert.equal((await fetch(`${runner.url}/`)).status, 200);
    } finally {
      await runner.close();
    }
  });
});
