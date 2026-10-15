import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Action Path, Hand workspace, table and Settings are
// rendered in the running app and resolved through the cascade. The table
// renderer and card presentation sources are outside this ticket.
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const probe = (html, parent = app.byId('gtoMode')) => {
  const host = app.document.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host;
};

test('Action Path derives every node and connector from one local rail axis', async () => {
  // Protects: a 20px node and 2px connector define one rail axis; steps are
  // node + content columns; nodes sit in the first column at node size; the
  // connector is placed on the axis with logical insets; the active node
  // glows; the panel never clips.
  // The accepted Analyze layout preset turns the path into a compact
  // horizontal stepper; this vertical rail is the base (preset-free) layout.
  assert.ok(markup.getElementById('playbookDecisionPathPanel'));
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  app.call('renderPath');
  const root = app.document.documentElement;
  const preset = root.dataset.layoutPreset;
  assert.ok(preset, 'a layout preset is active in the product');
  root.removeAttribute('data-layout-preset');
  try {
  const panel = app.byId('playbookDecisionPathPanel');
  const step = app.$('#pathList .path-step');
  assert.equal(css.cascaded(step, '--path-node-size'), '20px');
  assert.equal(css.cascaded(step, '--path-connector-width'), '2px');
  assert.equal(css.cascaded(step, '--path-rail-axis'), 'calc((var(--path-node-size) - var(--path-connector-width)) / 2)');
  assert.equal(css.cascaded(step, 'grid-template-columns'), 'var(--path-node-size) minmax(0, 1fr)');
  const node = step.querySelector('.path-node');
  assert.equal(css.cascaded(node, 'grid-column'), '1');
  assert.equal(css.cascaded(node, 'width'), 'var(--path-node-size)');
  assert.equal(css.cascaded(step, 'inset-inline-start', { pseudoElement: 'before' }), 'var(--path-rail-axis)');
  assert.notEqual(css.cascaded(step, 'left', { pseudoElement: 'before' }), 'auto');
  assert.match(css.cascaded(app.$('#pathList .path-step.active .path-node'), 'box-shadow') || '', /^0 0 6px/);
  assert.equal(css.cascaded(panel, 'overflow'), 'visible');
  } finally {
    root.dataset.layoutPreset = preset;
  }
  assert.equal(css.cascaded(app.$('#pathList .path-step'), 'display'), 'flex', 'the preset renders a stepper');
});

test('short status labels stay content-sized, centered, and on one line', () => {
  // DS-FOUNDATION-001: the Badge component owns the content-sized one-line box.
  const host = probe('<span class="ui-badge">Badge</span><span class="badge">Badge</span><span class="status-badge">Badge</span><span class="training-curriculum-tag">Tag</span><span class="theme-swatch-sharp">Sharp</span>');
  const expected = { 'min-height': '26px', width: 'fit-content', 'justify-content': 'center', 'line-height': '1.3', 'white-space': 'nowrap', 'overflow-wrap': 'normal' };
  for (const badge of host.children.slice(0, 3)) {
    for (const [property, value] of Object.entries(expected)) assert.equal(css.cascaded(badge, property), value, `${badge.className} ${property}`);
  }
  for (const node of host.children.slice(3)) assert.equal(css.cascaded(node, 'white-space'), 'nowrap', node.className);
  host.remove();
});

function withoutPreset(check) {
  const root = app.document.documentElement;
  const preset = root.dataset.layoutPreset;
  root.removeAttribute('data-layout-preset');
  try {
    check();
  } finally {
    root.dataset.layoutPreset = preset;
  }
}

test('recommendation provenance has a dedicated grid row outside Strategy Mix flow', () => {
  const top = app.$('.recommend-top');
  const badge = top.querySelector('#sourceBadge');
  assert.ok(badge);
  assert.equal(css.cascaded(top, 'display'), 'grid');
  assert.equal(css.cascaded(badge, 'justify-self'), 'start');
  assert.equal(css.cascaded(badge, 'white-space'), 'nowrap');
  // Base layout: one column; the Analyze preset adds the verdict/mix column.
  withoutPreset(() => assert.equal(css.cascaded(top, 'grid-template-columns'), 'minmax(0, 1fr)'));
});

test('Betting Context composes its utility action in the heading and values in a responsive grid', () => {
  for (const id of ['heroPos', 'lastAction', 'facingSize', 'potSize', 'openCharts']) assert.ok(markup.getElementById(id), id);
  // ANALYZE-COMPOSITION-001: the center Betting context strip moved into the Spot rail (Action section)
  // and its utility action (View all hands) into the Result header actions.
  assert.ok(markup.querySelector('.playbook-result-actions #openCharts'));
  assert.equal(markup.querySelector('.playbook-field-pair #openCharts'), null);
  // ANALYZE-COMPOSITION-001 amendment 2 removed the strip's dead CSS (.playbook-context-grid,
  // .playbook-inline-heading); the rail pair lays out position and prior action instead.
  assert.equal(css.rulesMentioning('.playbook-context-grid').length + css.rulesMentioning('.playbook-inline-heading').length, 0);
  assert.equal(css.cascaded(app.$('.playbook-field-pair'), 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  const select = app.$('.playbook-context-field .control-select');
  assert.ok(select);
  withoutPreset(() => assert.equal(css.cascaded(select, 'min-height'), '36px'));
  assert.equal(css.cascaded(select, 'min-height'), 'var(--control-height-md)', 'the preset uses the control height token');
  const slider = app.$('.playbook-context-sliders .slider-container');
  assert.ok(slider);
  assert.equal(css.cascaded(slider, 'min-height'), '48px');
  const field = app.$('.playbook-context-sliders > .field');
  assert.ok(field);
  assert.equal(css.cascaded(field, 'grid-column', { width: 680 }), '1 / -1', 'narrow screens give each slider a full row');
});

test('Hand Mode uses a compact post-start setup and highlights the current canonical step', async () => {
  await app.navigate('hand');
  const workspace = app.$('.playbook-hand-workspace');
  if (!app.call('callPlaybookStateBridge', 'getState')) assert.equal(workspace.classList.contains('is-hand-in-progress'), false);
  await app.startHand(['As', 'Kd']);
  assert.ok(workspace.classList.contains('is-hand-in-progress'));
  const current = app.$$('#gtoMode .is-current-hand-step');
  assert.ok(current.length >= 1 && current.every((section) => !section.hidden));
  assert.ok(css.matchingRules(app.byId('handSetupSection')).some((rule) => rule.selectorText.includes('.playbook-hand-workspace.is-hand-in-progress #handSetupSection')));
  assert.ok(current.some((section) => css.matchingRules(section).some((rule) => rule.selectorText.includes('.is-current-hand-step'))), 'the current step is highlighted');
});

test('table seats use one adaptive radial-felt player-unit anchor for cards and identity', async () => {
  assert.match(table, /class="table-seat table-player-unit\$\{[^}]+\}"[^>]*data-card-lane="radial-felt"/);
  assert.match(table, /const cardRadialExtent = \(Math\.abs\(seatVector\.unitX\) \* cardHalfWidth\)/);
  assert.match(table, /const cardCenterDistance = Math\.max\([\s\S]*?seatVector\.radialExtent \+ cardRadialExtent \+ cardSeatGap,[\s\S]*?feltEntryDistance \+ 1/);
  assert.doesNotMatch(table, /cardFeltInset|table-seat-connector|table-card-cradle/);
  assert.match(table, /const cardCenterX = Math\.round\(seatVector\.unitX \* cardCenterDistance\)/);
  assert.match(table, /const cardCenterY = Math\.round\(seatVector\.unitY \* cardCenterDistance\)/);
  assert.match(table, /class="table-hole-cards"[^>]*data-card-lane="radial-felt"[^>]*style="[^"]*--card-deal-from-x:[^"]*--card-fold-to-x:[^"]*" transform="translate\(\$\{holeCardX\}, \$\{holeCardY\}\) scale\(\$\{cardScale\}\)"/);
  assert.match(table, /class="table-seat-surface"[^>]*width="\$\{unit\.width\}" height="\$\{unit\.height\}"/);
  assert.match(cardPresentation, /const step = isCommunity \? 50 : 45/);
  assert.match(cardPresentation, /const finalX = \(\(index - \(\(totalCards - 1\) \/ 2\)\) \* step\) - \(geometry\.width \/ 2\)/);
  assert.match(cardPresentation, /tableCardBackSvgMarkup[\s\S]*const finalX = \(\(index - 0\.5\) \* 25\) - \(geometry\.width \/ 2\)/);
  const cardIndex = table.indexOf('class="table-hole-cards"');
  const infoIndex = table.indexOf('class="table-seat-info"');
  assert.ok(cardIndex >= 0 && infoIndex > cardIndex, 'seat information must paint above cards');
  assert.match(table, /id="seat-position-\$\{i\}" class="table-seat-meta table-seat-position"/);
  assert.match(table, /id: `seat-stack-\$\{i\}`[\s\S]*className: 'table-seat-meta table-seat-stack'/);
  assert.match(table, /id="seat-status-\$\{i\}" class="table-seat-meta table-seat-status"/);
  assert.match(table, /this\.setPokerAmount\(stack/);
  assert.doesNotMatch(table, /table-seat-diagnostic/);
  // Scenario tables are dispatched with one player per seat.
  await app.navigate('analyze');
  const models = [];
  const listener = (event) => models.push(event.detail);
  app.window.addEventListener('gameStateUpdate', listener);
  app.call('renderPlaybookTableProjection');
  app.window.removeEventListener('gameStateUpdate', listener);
  const scenario = models.find((model) => model?.mode === 'scenario');
  assert.equal(scenario.players.length, app.window.app.decisionContext.tableSize);
  await app.startHand(['As', 'Kd']);
  const stack = app.$('#visual-table-container .table-seat-stack');
  const status = app.$('#visual-table-container .table-seat-status');
  assert.ok(stack && status);
  assert.equal(css.cascaded(stack, 'font-weight'), '750');
  assert.equal(css.cascaded(stack, 'font-size'), '10px');
  assert.equal(css.cascaded(status, 'font-weight'), '750');
  // Later table work enlarged the status text (7px -> 9px); never smaller than 7px.
  assert.ok(Number.parseFloat(css.cascaded(status, 'font-size')) >= 7);
});

test('Settings and collapsed table use viewport-safe responsive layout contracts', async () => {
  // Protects: z-index tokens; the Settings modal is bounded by the viewport
  // with an internally scrolling two-column layout; collapsing the table
  // updates wrapper, workspace and toggle state.
  const modal = markup.querySelector('.modal.overlay-surface.settings-modal');
  assert.ok(modal);
  const root = app.document.documentElement;
  assert.equal(css.cascaded(root, '--z-mode-rail'), '30');
  assert.equal(css.cascaded(root, '--z-toast'), '60');
  assert.equal(css.cascaded(root, '--z-modal-backdrop'), '100');
  await app.click('#openSettings');
  const backdrop = app.byId('settingsModal');
  assert.equal(css.cascaded(backdrop, 'z-index'), 'var(--z-modal-backdrop)');
  const dialog = backdrop.querySelector(':scope > .modal');
  assert.equal(css.cascaded(dialog, 'z-index'), '1');
  assert.equal(css.cascaded(dialog, 'width'), 'min(940px, calc(100vw - (var(--space-7) * 2)))');
  assert.equal(css.cascaded(dialog, 'max-width'), 'calc(100vw - (var(--space-7) * 2))');
  assert.equal(css.cascaded(dialog, 'height'), 'min(760px, calc(100dvh - (var(--space-6) * 2)))');
  const body = dialog.querySelector('.modal-body');
  for (const [property, value] of Object.entries({ 'min-width': '0', 'min-height': '0', overflow: 'hidden', 'overscroll-behavior': 'contain' })) {
    assert.equal(css.cascaded(body, property), value, `.modal-body ${property}`);
  }
  assert.equal(css.cascaded(dialog.querySelector('.settings-layout'), 'grid-template-columns'), 'minmax(190px, .38fr) minmax(0, 1fr)');
  const content = dialog.querySelector('.settings-content');
  assert.equal(css.cascaded(content, 'overflow'), 'auto');
  assert.equal(css.cascaded(content, 'overscroll-behavior'), 'contain');
  backdrop.classList.remove('show');

  await app.navigate('hand');
  const wrapper = app.byId('table-wrapper');
  const toggle = app.byId('toggleTableBtn');
  const workspace = toggle.closest('.playbook-decision-workspace');
  if (wrapper.classList.contains('collapsed')) await app.click(toggle);
  await app.click(toggle);
  assert.ok(wrapper.classList.contains('collapsed'));
  assert.ok(workspace.classList.contains('is-table-collapsed'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.ok(css.matchingRules(app.$('.playbook-table-toggle')).some((rule) => rule.selectorText.includes('.playbook-decision-workspace.is-table-collapsed .playbook-table-toggle')));
  await app.click(toggle);
  assert.equal(wrapper.classList.contains('collapsed'), false);
  assert.equal(workspace.classList.contains('is-table-collapsed'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  // SOURCE-SHAPE: stylesheet-wide policy over parsed rules: no element width is
  // pinned to a desktop breakpoint value.
  for (const rule of css.rules) {
    for (const { property, value } of rule.declarations) {
      if (property === 'width') assert.doesNotMatch(value, /^(1024|1280|1440|1600)px$/, rule.selectorText);
    }
  }
});
