// SAVED-COMPOSITION-002 amendment: global typography (weight roles, poker numbers,
// overline labels) and Saved mockup fidelity (tabs row, column header, empty inspector).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { appStyleSheet, freshIndexDocument } from './helpers/app-under-test.mjs';

import { mountSavedLibrary } from '../app/src/application/saved-library-workspace.mjs';
import { mountSavedTrainingHistory } from '../app/src/application/saved-training-history-workspace.mjs';
import { createFakeDom } from './fixtures/saved-library-fake-dom.mjs';

const history = await readFile(new URL('../app/src/application/saved-training-history-workspace.mjs', import.meta.url), 'utf8');

// TEST-HYGIENE-001: tokens and roles are resolved through the cascade on probe
// elements in the real document; stylesheet-wide policies are checked over the
// parsed rules instead of regex scans of styles.css text.
const css = appStyleSheet();
const document = freshIndexDocument();
const host = document.createElement('div');
document.body.appendChild(host);
const probe = (markup) => {
  host.innerHTML = markup;
  return host.firstElementChild;
};
const deepest = (node) => (node.firstElementChild ? deepest(node.firstElementChild) : node);
const weightOf = (markup) => css.cascaded(deepest(probe(markup)), 'font-weight');
const rootToken = (name) => css.cascaded(document.documentElement, name);

// Amendment 2 (the mockups): controls and fact values 600, section titles 750, display 800.
test('weight roles: body 400, controls/labels/values 600, headings 650, titles 700, section titles 750, display 800', () => {
  for (const [name, value] of Object.entries({
    '--weight-regular': '400', '--weight-medium': '500', '--weight-strong': '600', '--weight-bold': '700', '--weight-heavy': '800',
    '--weight-body': 'var(--weight-regular)', '--weight-control': '650', '--weight-value': '650',
    '--weight-label': '650', '--weight-heading': '650', '--weight-title': 'var(--weight-bold)',
    '--weight-section-title': '750', '--weight-display': 'var(--weight-heavy)',
  })) assert.equal(rootToken(name), value, name);
  for (const [markup, weight] of [
    ['<p class="t-hero">x</p>', 'var(--weight-display)'],
    ['<div class="recommend"><span class="action-name">Raise</span></div>', 'var(--weight-display)'],
    ['<div class="panel-head"><h2>Title</h2></div>', 'var(--weight-section-title)'],
    ['<button class="ui-button">Go</button>', 'var(--weight-control)'],
    ['<span class="ui-chip">Chip</span>', 'var(--weight-control)'],
    ['<span class="ui-chip"><span class="ui-chip-count">3</span></span>', 'var(--weight-body)'],
    ['<div class="ui-tabs"><button role="tab">Tab</button></div>', 'var(--weight-control)'],
    ['<button class="sub-tab">Tab</button>', 'var(--weight-control)'],
    ['<dl class="ui-facts"><dt>Pot</dt></dl>', 'var(--weight-label)'],
    ['<dl class="ui-facts"><dd>1.5 bb</dd></dl>', 'var(--weight-value)'],
    ['<span class="ui-row-title">Row</span>', 'var(--weight-control)'],
    ['<label class="ui-field">Field</label>', 'var(--weight-label)'],
    ['<select class="control-select"></select>', 'var(--weight-control)'],
    ['<button class="mode-nav-item">Hand</button>', 'var(--weight-control)'],
    ['<button class="mode-nav-item" aria-current="page">Hand</button>', 'var(--weight-title)'],
    ['<div class="workspace-heading"><h1>Workspace</h1></div>', 'var(--weight-section-title)'],
    ['<h4>Heading</h4>', 'var(--weight-heading)'],
    ['<strong>Bold</strong>', 'var(--weight-label)'],
    ['<b>Bold</b>', 'var(--weight-label)'],
  ]) assert.equal(weightOf(markup), weight, markup);
});

test('surface CSS no longer carries heavy literal weights outside card, table and matrix art', () => {
  // SOURCE-SHAPE: a stylesheet-wide policy over every parsed rule (rendered
  // elements alone would miss unrendered states); robust to formatting/order.
  const offenders = [];
  for (const rule of css.rules) {
    if (/card|deck|dealer|matrix|\.s-c\b|rank|suit|swatch|avatar|brand-mark|wheel|node-check|tree-node|chip-stack|kbd|\[data-theme=|action-name|t-hero|t-display|equity-headline|training-hand-display|#trainingHandDisplay|\.table-|seat|felt/i.test(rule.selectorText)) continue;
    for (const { property, value } of rule.declarations) {
      if (property === 'font-weight' && /^(7[5-9]\d|8\d\d|9\d\d)$/.test(value)) offenders.push(rule.selectorText.slice(-80));
      if (property === 'font' && /^(7[5-9]\d|8\d\d|9\d\d)\b/.test(value)) offenders.push(rule.selectorText.slice(-80));
    }
  }
  assert.deepEqual(offenders, []);
});

test('poker numbers use the UI font with tabular figures; monospace is for technical strings only', () => {
  assert.equal(rootToken('--font-data'), 'var(--font-ui)');
  assert.match(rootToken('--font-mono'), /^"Cascadia Mono"/);
  assert.equal(css.cascaded(document.body, 'font-variant-numeric'), 'tabular-nums');
  for (const markup of ['<kbd>K</kbd>', '<code>c</code>', '<samp>s</samp>', '<span class="technical-id">id@1</span>']) {
    assert.equal(css.cascaded(probe(markup), 'font-family'), 'var(--font-mono)', markup);
  }
  assert.match(history, /el\('bdi', 'poker-data-token technical-id'/, 'the Training source id@version stays monospace');
  // Saved list surfaces never fall back to monospace.
  const saved = probe('<section class="saved-library"><div class="saved-list"><article class="saved-library-item"><strong class="ui-row-title">Spot</strong><span class="saved-row-time poker-data-token">1h</span></article></div></section>');
  for (const node of [saved, ...saved.querySelectorAll('*')]) {
    assert.doesNotMatch(css.resolved(node, 'font-family') || '', /monospace|Cascadia Mono/, node.className);
  }
});

test('overline labels are 600, modestly tracked and never accent-colored', () => {
  // SOURCE-SHAPE: a stylesheet-wide policy over every parsed uppercase rule.
  const uppercase = css.rules.filter((rule) => rule.declarations.some(({ property, value }) => property === 'text-transform' && value === 'uppercase'))
    // The Analyze verdict (.action-name) stays focal.
    .filter((rule) => !/\[data-theme=|card|matrix|swatch|\.table-|action-name/i.test(rule.selectorText));
  assert.ok(uppercase.length > 30);
  for (const rule of uppercase) {
    for (const { property, value } of rule.declarations) {
      if (property === 'font-weight' || property === 'font') assert.doesNotMatch(value, /^(7\d\d|8\d\d|9\d\d)\b/, rule.selectorText);
      if (property === 'letter-spacing') assert.doesNotMatch(value, /^\.(0[7-9]|1)/, rule.selectorText);
      if (property === 'color') assert.doesNotMatch(value, /^var\(--accent-(primary|text)\)$/, rule.selectorText);
    }
  }
});

test('Saved: view tabs on their own row, column header aligned with rows, calm full-height empty inspector', async () => {
  const tabRow = probe('<div class="ui-tabs"><label class="ui-tabs-item"><input type="radio" checked>All</label><label class="ui-tabs-item"><input type="radio">Hands</label></div>');
  const [checked, unchecked] = tabRow.children;
  assert.equal(css.cascaded(checked, 'color'), 'var(--text-primary)');
  assert.equal(css.cascaded(checked, 'border-block-end-color'), 'var(--accent-primary)');
  assert.notEqual(css.cascaded(unchecked, 'border-block-end-color'), 'var(--accent-primary)');
  assert.equal(css.cascaded(checked.firstElementChild, 'position'), 'absolute');
  assert.equal(css.cascaded(checked.firstElementChild, 'inset'), '0');
  assert.equal(css.cascaded(probe('<div class="saved-view-toggle"></div>'), 'flex'), '1 0 100%');
  const list = probe('<div class="saved-list"><div class="saved-list-head"></div><article class="saved-library-item"><span class="saved-row-states"></span></article></div>');
  const columns = 'var(--saved-row-cards) minmax(0, 1fr) var(--saved-row-review) var(--saved-row-time)';
  assert.equal(css.cascaded(list.children[0], 'grid-template-columns'), columns);
  assert.equal(css.cascaded(list.children[1], 'grid-template-columns'), columns);
  const inspector = probe('<aside class="saved-inspector" data-saved-inspector-state="empty"></aside>');
  assert.match(css.cascaded(inspector, 'block-size'), /^calc\(100vh - var\(--saved-inspector-top/);
  // An empty state list keeps its column in the wide grid (else "Updated" slides under "Review").
  const states = list.querySelector('.saved-row-states');
  assert.notEqual(css.cascaded(states, 'display', { width: 1920 }), 'none');
  assert.equal(css.cascaded(states, 'display', { width: 1500 }), 'none');

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
