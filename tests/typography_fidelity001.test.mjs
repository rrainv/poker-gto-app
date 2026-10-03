// SAVED-COMPOSITION-002 amendment: global typography (weight roles, poker numbers,
// overline labels) and Saved mockup fidelity (tabs row, column header, empty inspector).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { mountSavedLibrary } from '../app/src/application/saved-library-workspace.mjs';
import { mountSavedTrainingHistory } from '../app/src/application/saved-training-history-workspace.mjs';
import { createFakeDom } from './fixtures/saved-library-fake-dom.mjs';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const history = await readFile(new URL('../app/src/application/saved-training-history-workspace.mjs', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const block = (selector) => {
  // The rule that starts the line (not a descendant selector ending in the same text).
  const start = css.indexOf(`\n${selector} {`) + 1;
  assert.ok(start >= 0, selector);
  return css.slice(start, css.indexOf('}', start));
};

// Amendment 2 (the mockups): controls and fact values 600, section titles 750, display 800.
test('weight roles: body 400, controls/labels/values 600, headings 650, titles 700, section titles 750, display 800', () => {
  for (const [name, value] of Object.entries({
    '--weight-regular': '400', '--weight-medium': '500', '--weight-strong': '600', '--weight-bold': '700', '--weight-heavy': '800',
    '--weight-body': 'var(--weight-regular)', '--weight-control': 'var(--weight-strong)', '--weight-value': 'var(--weight-strong)',
    '--weight-label': 'var(--weight-strong)', '--weight-heading': '650', '--weight-title': 'var(--weight-bold)',
    '--weight-section-title': '750', '--weight-display': 'var(--weight-heavy)',
  })) assert.match(root, new RegExp(`${name}: ${value.replace(/[()]/g, '\\$&')};`), name);
  assert.match(css, /\.t-hero \{ font: var\(--weight-display\)/);
  assert.match(css, /\.recommend \.action-name \{[^}]*font-weight: var\(--weight-display\);/);
  assert.match(block('.panel-head :is(h2, h3)'), /font-weight: var\(--weight-section-title\);/);
  assert.match(block(':where(.cta, .secondary, .btn-action, .add-player, .solver-import-btn),\n.ui-button'), /font-weight: var\(--weight-control\);/);
  assert.match(block('.ui-chip'), /font: var\(--weight-control\)/);
  assert.match(block('.ui-chip-count'), /font: var\(--weight-body\)/);
  assert.match(block('.ui-tabs > :is([role="tab"], .ui-tabs-item)'), /font: var\(--weight-control\)/);
  assert.match(block('.ui-tab,\n.tab,\n.sub-tab,\n.street-tab'), /font-weight: var\(--weight-control\);/);
  assert.match(block('.ui-facts dt'), /font: var\(--weight-label\)/);
  assert.match(block('.ui-facts dd'), /font: var\(--weight-value\)/);
  assert.match(block('.ui-row-title'), /font-weight: var\(--weight-control\)/);
  assert.match(block('.ui-field'), /font-weight: var\(--weight-label\);/);
  assert.match(css, /:is\(\.control-select, select\) \{ font-weight: var\(--weight-control\); \}/);
  assert.match(block('.mode-nav-item'), /font-weight: var\(--weight-control\);/);
  assert.match(block('.mode-nav-item[aria-current="page"]'), /font-weight: var\(--weight-title\);/);
  assert.match(block('.workspace-heading h1'), /font-weight: var\(--weight-section-title\);/);
  assert.match(css, /h1, h2, h3, h4, h5, h6 \{ font-weight: var\(--weight-heading\); \}/);
  assert.match(css, /strong, b \{ font-weight: var\(--weight-label\); \}/);
});

test('surface CSS no longer carries heavy literal weights outside card, table and matrix art', () => {
  const offenders = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (/card|deck|dealer|matrix|\.s-c\b|rank|suit|swatch|avatar|brand-mark|wheel|node-check|tree-node|chip-stack|kbd|\[data-theme=|action-name|t-hero|t-display|equity-headline|training-hand-display|#trainingHandDisplay|\.table-|seat|felt/i.test(selector)) continue;
    if (/font(-weight)?:\s*(7[5-9]\d|8\d\d|9\d\d)\b/.test(body)) offenders.push(selector.trim().slice(-80));
  }
  assert.deepEqual(offenders, []);
});

test('poker numbers use the UI font with tabular figures; monospace is for technical strings only', () => {
  assert.match(root, /--font-data: var\(--font-ui\);/);
  assert.match(root, /--font-mono: "Cascadia Mono"/);
  const bodyStart = css.indexOf('\nbody {') + 1;
  const body = css.slice(bodyStart, css.indexOf('}', bodyStart));
  assert.match(body, /font-variant-numeric: tabular-nums;/);
  assert.match(css, /:is\(kbd, code, samp, \.technical-id\) \{ font-family: var\(--font-mono\); \}/);
  assert.match(history, /el\('bdi', 'poker-data-token technical-id'/, 'the Training source id@version stays monospace');
  const savedStart = css.indexOf('/* SAVED-COMPOSITION-002: Saved list');
  assert.doesNotMatch(css.slice(savedStart, css.indexOf('.home-account-overview {', savedStart)), /monospace|--font-mono/);
});

test('overline labels are 600, modestly tracked and never accent-colored', () => {
  const uppercase = [...css.matchAll(/([^{}]+)\{([^{}]*text-transform:\s*uppercase[^{}]*)\}/g)]
    // The Analyze verdict (.action-name) stays focal.
    .filter(([, selector]) => !/\[data-theme=|card|matrix|swatch|\.table-|action-name/i.test(selector));
  assert.ok(uppercase.length > 30);
  for (const [, selector, body] of uppercase) {
    assert.doesNotMatch(body, /font(-weight)?:\s*(7\d\d|8\d\d|9\d\d)\b/, selector.trim());
    assert.doesNotMatch(body, /letter-spacing:\s*\.(0[7-9]|1)/, selector.trim());
    assert.doesNotMatch(body, /(^|;|\s)color:\s*var\(--accent-(primary|text)\)/, selector.trim());
  }
});

test('Saved: view tabs on their own row, column header aligned with rows, calm full-height empty inspector', async () => {
  assert.match(css, /\.ui-tabs > \.ui-tabs-item:has\(> input:checked\) \{ color: var\(--text-primary\); border-block-end-color: var\(--accent-primary\); \}/);
  assert.match(css, /\.ui-tabs > \.ui-tabs-item > input\[type="radio"\] \{ position: absolute; inset: 0;/);
  assert.match(block('.saved-view-toggle'), /flex: 1 0 100%/);
  assert.match(css, /\.saved-list-head,\n\.saved-list > \.saved-library-item \{\n  grid-template-columns: var\(--saved-row-cards\) minmax\(0, 1fr\) var\(--saved-row-review\) var\(--saved-row-time\);/);
  assert.match(css, /\.saved-inspector\[data-saved-inspector-state="empty"\] \{\n  block-size: calc\(100vh - var\(--saved-inspector-top/);
  // An empty state list keeps its column in the wide grid (else "Updated" slides under "Review").
  const wide = css.slice(css.indexOf('/* SAVED-COMPOSITION-002: Saved list'), css.indexOf('@media (max-width: 1599px)'));
  assert.doesNotMatch(wide, /\.saved-row-states:empty/);
  assert.match(css, /@media \(max-width: 1599px\) \{[\s\S]*?\.saved-row-states:empty \{ display: none; \}/);

  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  dom.document.body.append(section);
  const object = {
    schemaVersion: 'saved-study-object/v1', id: 'h', kind: 'hand', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    payload: { heroPlayerId: 'Hero', pokerState: { schemaVersion: 'poker-state/v1', game: { mode: 'off' }, players: [{ playerId: 'Hero', position: 'BTN', holeCards: ['As', 'Kh'], currentStackMilliBb: 100000 }], street: 'flop', phase: 'betting', board: ['Qc', '7d', '2s'], potMilliBb: 3000, actionHistory: [] } },
    annotations: { title: null, note: null, tags: [], reviewState: 'none', classifications: [] },
  };
  const library = mountSavedLibrary(section, { savedService: { listRecent: async () => [object] }, translate: (key) => key, openItem: () => {} });
  const history = mountSavedTrainingHistory(section, {
    library, getTrainingMemory: () => null, savedService: { getById: async () => null, saveHandDerivedSpot: async () => null },
    translate: (key) => key, openRedrill: () => {},
  });
  history.show();
  await new Promise((resolve) => setImmediate(resolve));
  const head = section.querySelector('[data-saved-library-body]').children.at(-1).children[0].children[0];
  assert.match(head.className, /saved-list-head/);
  assert.equal(head.getAttribute('aria-hidden'), 'true');
  assert.deepEqual([head.children[0].textContent, head.children[1].textContent, ...head.children[2].children.map((cell) => cell.textContent)],
    ['Cards', 'Title', 'Review', 'Updated']);
  const tabs = section.querySelector('[data-saved-view-toggle]').children[0];
  assert.match(tabs.className, /ui-tabs/);
  assert.ok(tabs.children.every((label) => /ui-tabs-item/.test(label.className) && label.children[0].type === 'radio'));
});
