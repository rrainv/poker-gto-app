import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createSavedPokerPreview } from '../app/src/application/saved-poker-preview.mjs';
import { startDevWebServer } from '../tools/dev-web-server.mjs';
import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../app/styles.css');
const html = read('../app/index.html');
const packageJson = JSON.parse(read('../app/package.json'));
const layerStart = css.indexOf('DS-FOUNDATION-001: component layer');
const layer = css.slice(layerStart, css.indexOf('/* Modal and settings'));
const tokenBlock = css.slice(0, css.indexOf('\n}\n'));

function topLevelRootBlocks(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, prelude = '', count = 0;
  for (const ch of text) {
    if (ch === '{') { if (depth === 0 && prelude.trim().split(/[;}]/).pop().trim() === ':root') count++; depth++; prelude = ''; }
    else if (ch === '}') { depth--; prelude = ''; }
    else prelude += ch;
  }
  return count;
}

test('the riverline-design override layer is retired, not moved to another file', () => {
  assert.equal(fs.existsSync(new URL('../app/src/ui/riverline-design.css', import.meta.url)), false);
  assert.doesNotMatch(html, /riverline-design\.css/);
  assert.equal([...html.matchAll(/<link rel="stylesheet"/g)].length, 1, 'styles.css is the only product stylesheet');
  assert.match(css, /Surface styles relocated from the retired src\/ui\/riverline-design\.css/);
  const relocated = css.slice(css.indexOf('Surface styles relocated from the retired'));
  // Relocated surface rules must not restyle shared components.
  assert.doesNotMatch(relocated, /(?:^|\n)\s*\.ui-button(?:[:.{\s,]|$)|(?:^|\n):is\(\.ui-tab|(?:^|\n)\.panel \{/);
  assert.doesNotMatch(relocated, /--riverline-(?:brass|analysis|game|depth)|--info-primary|#38bdf8/);
});

test('one :root token block owns type, spacing, radius, elevation and control tokens', () => {
  assert.equal(topLevelRootBlocks(css), 1);
  for (const token of ['--t-hero', '--t-display', '--t-title', '--t-heading', '--t-body', '--t-small', '--t-label',
    '--weight-strong', '--gap-group', '--gap-section', '--pad-surface', '--gutter-canvas', '--control-height-md',
    '--control-height-sm', '--radius-cell', '--radius-control', '--radius-panel', '--radius-pill',
    '--elevation-surface', '--elevation-overlay', '--provenance']) {
    assert.match(tokenBlock, new RegExp(`${token}:`), token);
  }
  // Legacy names map onto the scale instead of competing with it.
  assert.match(tokenBlock, /--text-body-size: var\(--t-body\)/);
  assert.match(tokenBlock, /--text-label-size: var\(--t-small\)/);
  assert.match(tokenBlock, /--radius-md: var\(--radius-control\)/);
  // Color roles derive from theme tokens; no preset value is duplicated here.
  assert.match(tokenBlock, /--provenance: var\(--support-text, var\(--accent-secondary\)\)/);
});

test('components consume role tokens: no hard-coded jade, no per-theme overrides', () => {
  assert.ok(layerStart > 0);
  assert.doesNotMatch(layer, /#[0-9a-f]{3,8}\b/i, 'component layer uses tokens only');
  assert.doesNotMatch(layer, /\[data-theme=/);
  for (const component of ['.ui-button', '.ui-field', '.ui-check', '.ui-switch', '.ui-segments', '.ui-tab', '.ui-tabs',
    '.ui-chip', '.ui-badge', '.ui-callout', '.ui-facts', '.ui-disclosure', '.ui-row', '.poker-island', '.ui-stepper']) {
    assert.ok(layer.includes(component), component);
  }
  for (const variant of ['primary', 'quiet', 'danger', 'icon']) assert.match(layer, new RegExp(`\\[data-variant="${variant}"\\]`));
  for (const tone of ['caution', 'assumption']) assert.match(layer, new RegExp(`\\.ui-callout\\[data-tone="${tone}"\\]`));
});

test('selected segments and toggles use an elevated surface and accent underline, never an accent fill', () => {
  const selected = layer.slice(layer.indexOf('.ui-tab:is(.active, [aria-selected="true"]'));
  const rule = selected.slice(0, selected.indexOf('}'));
  assert.match(rule, /background: var\(--surface-elevated\)/);
  assert.match(rule, /box-shadow: inset 0 -2px 0 var\(--accent-primary\)/);
  assert.doesNotMatch(rule, /background: var\(--accent-primary\)|var\(--text-on-accent\)/);
  // Settings T/10 caption (QA-DS-FOUNDATION-002) is no longer light text on an accent fill.
  assert.match(html, /id="cardRankStyleControl" class="ui-segments card-rank-style-control"/);
  const toggle = layer.slice(layer.indexOf('.ui-button[aria-pressed="true"]'));
  assert.match(toggle.slice(0, toggle.indexOf('}')), /background: var\(--surface-elevated\)/);
});

test('checkboxes and radios render a visible, theme-driven checked state', () => {
  const checkbox = layer.slice(layer.indexOf(':where(input[type="checkbox"], input[type="radio"]) {'));
  assert.match(checkbox, /appearance: none/);
  assert.match(layer, /:where\(input\[type="checkbox"\]\):is\(:checked, :indeterminate\) \{\s*background-color: var\(--accent-primary\)/);
  assert.match(layer, /:where\(input\[type="radio"\]\):checked/);
});

test('one shared check glyph: a centered mask painted in --text-on-accent, never mirrored', () => {
  // A single SVG mask token, 2-unit stroke in a 12-unit box drawn at 12px (2px stroke).
  const glyph = tokenBlock.match(/--check-glyph: url\("data:image\/svg\+xml,([^"]+)"\)/)?.[1];
  assert.ok(glyph, 'check glyph token');
  const svg = decodeURIComponent(glyph);
  assert.match(svg, /viewBox='0 0 12 12'/);
  assert.match(svg, /stroke-width='2'/);
  assert.match(svg, /stroke-linecap='round'/);
  const before = layer.slice(layer.indexOf(':where(input[type="checkbox"])::before {'));
  const rule = before.slice(0, before.indexOf('}'));
  assert.match(rule, /background-color: var\(--text-on-accent\)/);
  assert.match(rule, /mask: var\(--check-glyph\) center \/ 12px 12px no-repeat/);
  assert.match(layer, /:where\(input\[type="checkbox"\], input\[type="radio"\]\) \{[^}]*display: inline-grid;\s*place-content: center/);
  // No RTL rule may flip the glyph, and the old gradient-drawn check is gone.
  assert.doesNotMatch(css, /\[dir="rtl"\][^{]*input\[type="checkbox"\]/);
  assert.doesNotMatch(layer, /to top right, transparent calc/);
  // Disabled stays perceivable: a dashed --text-disabled boundary (>= 4.5:1 by theme derivation).
  assert.match(layer, /:where\(input\[type="checkbox"\], input\[type="radio"\]\):disabled \{[^}]*border-style: dashed;\s*border-color: var\(--text-disabled\)/);
});

test('switch thumb and track use contrasting roles in both states; no later rule repaints them', () => {
  const off = layer.slice(layer.indexOf('.ui-switch,\n.switch {'));
  const offRule = off.slice(0, off.indexOf('}'));
  assert.match(offRule, /color: var\(--text-secondary\)/);
  assert.match(offRule, /background: var\(--surface-inset\)/);
  assert.match(offRule, /border: 1px solid var\(--text-muted\)/);
  assert.match(layer, /\.ui-switch b,\n\.switch b \{[^}]*background: currentColor/);
  const on = layer.slice(layer.indexOf('.ui-switch:is(.on, [aria-pressed="true"], [aria-checked="true"]),'));
  const onRule = on.slice(0, on.indexOf('}'));
  assert.match(onRule, /color: var\(--text-on-accent\)/);
  assert.match(onRule, /background: var\(--accent-primary\)/);
  // The component is the only owner of switch colors (retired legacy themes aside):
  // a stray `.switch.on b` once painted the thumb the same color as the track.
  const outside = (css.slice(0, layerStart) + css.slice(css.indexOf('/* Modal and settings')))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const strays = [...outside.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => /(^|[\s,])\.(?:ui-)?switch\b/.test(selector) && !/data-theme/.test(selector) && /background|(?:^|;)\s*color/.test(body))
    .map(([, selector]) => selector.trim());
  assert.deepEqual(strays, []);
  assert.match(layer, /\.switch:is\(\.on, \[aria-pressed="true"\], \[aria-checked="true"\]\) b \{ background: currentColor; transform: translateX\(18px\); \}/);
});

test('type hierarchy uses color roles, not only size; accent is never a text-hierarchy color', () => {
  const role = (cls) => layer.match(new RegExp(`\\.${cls} \\{[^}]*color: var\\((--[a-z-]+)\\)`))?.[1];
  assert.equal(role('t-hero'), '--text-primary');
  assert.equal(role('t-display'), '--text-primary');
  assert.equal(role('t-title'), '--text-primary');
  assert.equal(role('t-heading'), '--text-primary');
  assert.equal(role('t-body'), '--text-secondary');
  assert.equal(role('t-small'), '--text-muted');
  assert.equal(role('t-label'), '--text-muted');
  for (const [kind, action] of [['fold', 'fold'], ['passive', 'call'], ['aggressive', 'raise'], ['all-in', 'all-in']]) {
    assert.match(layer, new RegExp(`\\.recommend\\[data-action-kind="${kind}"\\] \\.action-name \\{ color: var\\(--action-${kind}-text\\); \\}`));
    assert.match(layer, new RegExp(`data-action="${action}"`));
  }
  const typeRoles = layer.slice(layer.indexOf('/* Type roles'), layer.indexOf('/* Segmented control'));
  assert.doesNotMatch(typeRoles, /color: var\(--(?:accent-primary|accent-text|provenance|support-text)\)/);
  assert.doesNotMatch(css, /\.action-name \{[^}]*color: var\(--accent-primary\)/);
  // Component labels and metadata take the muted role; prose in callouts the secondary role.
  assert.match(layer, /\.ui-facts dt \{\s*color: var\(--text-muted\)/);
  assert.match(layer, /\.ui-row-meta \{ color: var\(--text-muted\)/);
  assert.match(layer, /\.ui-callout \{[^}]*color: var\(--text-secondary\)/);
});

test('action text roles are theme-derived, contrast-safe and mirror the stable action hues', async () => {
  const { POKER_ACTION_COLORS, createPresentationThemeController, contrastRatio, deriveFeatureSurfaceRoles } = await import('../app/src/application/presentation-theme.mjs');
  for (const [name, hex] of Object.entries(POKER_ACTION_COLORS)) {
    assert.match(tokenBlock, new RegExp(`--action-${name}: ${hex};`), `${name} hue mirrors styles.css`);
    assert.match(tokenBlock, new RegExp(`--action-${name}-text: var\\(--action-${name}\\);`), `${name} pre-bootstrap fallback`);
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

test('adopted families use the components: Saved chips, toggle, checkboxes; Equity segments and buttons', () => {
  const savedLibrary = read('../app/src/application/saved-library-workspace.mjs');
  const savedHistory = read('../app/src/application/saved-training-history-workspace.mjs');
  const logic = read('../app/src/core/logic.js');
  assert.match(savedLibrary, /el\('button', 'saved-library-category ui-chip'\)/);
  assert.match(savedLibrary, /el\('strong', 'ui-chip-count', '0'\)/);
  assert.match(savedLibrary, /el\('label', 'saved-library-toggle ui-check'\)/);
  assert.match(savedHistory, /el\('div', 'saved-view-toggle-group ui-segments'\)/);
  assert.match(savedHistory, /el\('label', 'saved-view-option ui-tab'\)/);
  assert.match(logic, /class="equity-hand-mode ui-segments" data-size="sm"/);
  assert.match(html, /id="calculate" class="ui-button ui-button--primary equity-calculate"/);
  assert.match(html, /id="cancelEquity" class="ui-button ui-button--danger equity-cancel"/);
  // The adopted families no longer carry their own look in surface CSS.
  assert.doesNotMatch(css, /\.saved-library-category\[aria-pressed="true"\]|\.equity-hand-mode button\[aria-pressed="true"\]|\.saved-view-option:has\(input:checked\)/);
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
  assert.match(layer, /\.poker-island,\n\[data-poker-island\] \{\s*direction: ltr;\s*unicode-bidi: isolate;/);
});

test('the component sheet is dev-only: served under /__dev/, never shipped or linked in the app', async () => {
  assert.equal(fs.existsSync(new URL('../tools/dev-pages/component-sheet.html', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../app/dev', import.meta.url)), false);
  assert.ok(!packageJson.build.files.some((entry) => /tools|dev-pages/.test(entry)));
  assert.doesNotMatch(html, /component-sheet|__dev/);
  const sheet = read('../tools/dev-pages/component-sheet.mjs');
  assert.doesNotMatch(sheet, /data-i18n/, 'sheet text is never a static i18n placeholder');
  assert.doesNotMatch(sheet, /localStorage/, 'sheet theme state stays in memory');

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
