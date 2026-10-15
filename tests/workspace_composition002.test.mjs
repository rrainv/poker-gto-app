import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_LAYOUT,
  PRESENTATION_LAYOUT_STORAGE_KEY,
  WORKSPACE_LAYOUT_DEFINITIONS,
  getWorkspaceLayoutPresets,
  resolveWorkspaceLayoutPreset,
} from '../app/src/application/presentation-layout.mjs';
import { PRESENTATION_DENSITY_STORAGE_KEY } from '../app/src/application/presentation-density.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the running app, the cascade at a given width).
// Several WORKSPACE-COMPOSITION-002 literals were superseded by later
// composition tickets; the effective values are asserted and noted inline.
// presentation-layout and translation sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp({ width: 1600 });
const root = app.document.documentElement;
const wide = { width: 1600 };
const layoutSource = fs.readFileSync(new URL('../app/src/application/presentation-layout.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
// SOURCE-SHAPE: the stylesheet-wide policy lints below (no drag/layout
// engines, no physical inline properties, no sub-12px type) apply to the
// WORKSPACE-COMPOSITION-002 block as authored; there is no runtime behaviour
// to observe for "never declared". The block is parsed, not regex-matched.
const ticketSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const marker = raw.indexOf('WORKSPACE-COMPOSITION-002');
  return new StyleSheetModel(raw.slice(raw.indexOf('*/', marker) + 2, raw.lastIndexOf('/*', raw.indexOf('WELCOME-INTRO-001'))));
})();
const ticketDeclarations = () => ticketSheet.rules.flatMap((rule) => rule.declarations);
const withPreset = async (preset, body) => {
  const previous = root.dataset.layoutPreset;
  root.dataset.layoutPreset = preset;
  try { return await body(); } finally { root.dataset.layoutPreset = previous; }
};

test('WORKSPACE-COMPOSITION-002 exposes only audited presets and repairs stale choices', () => {
  assert.equal(DEFAULT_PRESENTATION_LAYOUT, 'balanced');
  assert.deepEqual(getWorkspaceLayoutPresets('hand'), ['balanced', 'table-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('analyze'), ['balanced', 'analysis-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('training'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('personal-strategy'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('equity'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('home'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('saved'), ['balanced']);
  assert.equal(resolveWorkspaceLayoutPreset('table-focus', 'training'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('controls-first', 'hand'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('analysis-focus', 'equity'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('controls-first', 'equity'), 'balanced');
  assert.equal(PRESENTATION_LAYOUT_STORAGE_KEY, 'riverline_presentation_layout');
  assert.equal(PRESENTATION_DENSITY_STORAGE_KEY, 'riverline_presentation_density');
  assert.doesNotMatch(layoutSource, /schemaVersion|layout[_-]v2/i);
  assert.doesNotMatch(layoutSource, /dragstart|draggable|contenteditable|gridstack|interact\.js/i);
  // Protects: the ticket's CSS adds no drag or editable-layout machinery.
  const ticketText = ticketSheet.rules.map((rule) => `${rule.selectorText}{${rule.declarations.map(({ property, value }) => `${property}:${value}`).join(';')}}`).join('\n');
  assert.doesNotMatch(ticketText, /dragstart|draggable|contenteditable|gridstack|interact\.js/i);
  // The running product opens on the audited default.
  assert.equal(root.dataset.layoutPreset, 'balanced');
});

test('every surviving preset has a distinct job and removed choices are unavailable', async () => {
  for (const definitions of Object.values(WORKSPACE_LAYOUT_DEFINITIONS)) {
    assert.equal(new Set(definitions.map(({ job }) => job)).size, definitions.length);
    assert.ok(definitions.every(({ job }) => job.length >= 40));
  }
  assert.doesNotMatch(layoutSource, /controls-first/);
  assert.equal(markup.querySelector('[data-layout-preset-option="controls-first"]'), null);
  assert.equal(markup.getElementById('densityControl'), null);
  assert.equal(markup.querySelector('[data-density-option]'), null);

  // Protects: during a live Hand (not setup/replay) the stage controls come
  // before the large poker canvas. The dock now lives in the interaction
  // rail, which precedes the table in the decision workspace's flow order
  // (superseded: the literal `#handStageDock { order: 2 }` rule).
  await app.navigate('hand');
  await app.startHand(['As', 'Kd']);
  const gto = app.byId('gtoMode');
  assert.ok(!['setup', 'replay'].includes(gto.dataset.handStage), gto.dataset.handStage);
  const dock = app.byId('handStageDock');
  assert.equal(dock.hidden, false);
  const flowItem = (element) => {
    let current = element;
    while (current.parentElement && !current.parentElement.classList.contains('playbook-decision-workspace')) current = current.parentElement;
    return current;
  };
  const order = (element) => Number(css.cascaded(flowItem(element), 'order', wide) || 0);
  assert.ok(order(dock) < order(app.byId('table-wrapper')), `${order(dock)} < ${order(app.byId('table-wrapper'))}`);

  // Protects: Balanced reserves 455px of vertical chrome around the table and
  // Table Focus reserves less (a materially larger table).
  const container = app.byId('visual-table-container');
  const reserve = () => Number.parseFloat(css.cascaded(container, '--play-stage-reserve', wide));
  assert.equal(reserve(), 455);
  const tableFocusReserve = await withPreset('table-focus', reserve);
  assert.equal(tableFocusReserve, 350);
  assert.ok(tableFocusReserve < reserve(), 'Table Focus has a materially larger vertical table target');

  // Protects: Analysis Focus makes analysis the leading column with the rail
  // opposite and a capped, start-aligned table. Superseded: the 245–280px
  // rail and the framed #table-wrapper (padding/border) of the >=1500px
  // block are overridden by later Analyze rules (rail is
  // --analyze-rail-width; the wrapper is frameless).
  await app.navigate('analyze');
  await withPreset('analysis-focus', () => {
    const scope = (selector) => app.$(`#gtoMode ${selector}`);
    assert.equal(css.cascaded(scope('.playbook-workspace'), 'grid-template-columns', wide), 'minmax(0, 1fr) var(--analyze-rail-width)');
    assert.equal(css.cascaded(scope('.playbook-workspace'), 'grid-template-areas', wide), '"decision context"');
    assert.equal(css.cascaded(container, 'max-width', wide), '980px');
    assert.equal(css.cascaded(container, 'width', wide), 'min(100%, 980px)');
    assert.equal(css.cascaded(container, 'margin-inline-start', wide), '0');
  });
  assert.notEqual(css.cascaded(container, 'max-width', wide), '980px', 'the cap belongs to Analysis Focus');
});

test('Compact changes coherent tokens while protecting decision and card readability floors', () => {
  const body = app.document.body;
  const previous = root.dataset.density;
  root.dataset.density = 'compact';
  try {
    assert.equal(css.cascaded(body, '--control-height'), '38px');
    assert.equal(css.cascaded(body, '--density-panel-inline'), '14px');
    // Protects: in Compact the headline context value never drops below the
    // body size (or .875rem).
    const headline = app.$('[data-context-priority="headline"] > strong');
    assert.equal(css.cascaded(headline, 'font-size'), 'max(.875rem, var(--text-body-size))');
  } finally {
    root.dataset.density = previous;
  }
  // Protects: picker cards keep 14px/13px corner glyphs.
  const host = app.document.createElement('div');
  host.innerHTML = '<div class="riverline-card" data-card-size="picker"></div>';
  app.document.body.appendChild(host);
  assert.equal(css.cascaded(host.firstChild, '--card-corner-rank-size'), '14px');
  assert.equal(css.cascaded(host.firstChild, '--card-corner-suit-size'), '13px');
  host.remove();
  // SOURCE-SHAPE (policy lint, see ticketSheet): no ticket font-size under 12px.
  for (const { property, value } of ticketDeclarations()) {
    if (property === 'font-size') assert.doesNotMatch(value, /^(?:[0-9]|1[01])px$/, value);
  }
});

test('Training context is one semantic hierarchy driven by existing lifecycle state', async () => {
  const context = markup.getElementById('trainingPotInfo');
  assert.equal(context.getAttribute('role'), 'group');
  assert.equal(context.getAttribute('aria-label'), 'Decision context');
  assert.equal(context.getAttribute('data-i18n-aria-label'), 'Decision context');
  const expectedOrder = ['trainingFacingVal', 'trainingPositionVal', 'trainingStackVal', 'trainingPotVal', 'trainingTableVal', 'trainingStreetLabel'];
  const nodes = expectedOrder.map((id) => markup.getElementById(id));
  nodes.forEach((node, index) => assert.ok(index === 0 || precedes(nodes[index - 1], node), expectedOrder[index]));
  const priorities = (priority) => {
    // Context facts from trainingPotInfo up to the assistance panel.
    const all = markup.querySelectorAll(`[data-context-priority="${priority}"]`);
    const end = markup.getElementById('trainingAssistance');
    return all.filter((node) => (node === context || precedes(context, node)) && precedes(node, end));
  };
  assert.equal(priorities('headline').length, 1);
  assert.equal(priorities('primary').length, 3);
  assert.equal(priorities('secondary').length, 2);
  const assistance = markup.querySelector('details.panel.training-assistance-panel');
  assert.equal(assistance.firstElementChild.localName, 'summary');

  await app.navigate('training');
  const workspace = app.byId('trainingWorkspace');
  assert.equal(workspace.dataset.trainingState, 'idle');
  assert.equal(workspace.dataset.trainingFullHandPhase, 'off');
  // Protects: the headline fact spans two context columns; idle keeps a
  // 128px message floor.
  assert.equal(css.cascaded(app.$('.training-context-fact--headline'), 'grid-column', wide), 'span 2');
  assert.equal(css.cascaded(app.$('.training-state-message'), 'min-block-size', wide), '128px');
  // Superseded: the 12-column normal-drill grid (history 1/span 4, setup and
  // session panels in 9/-1, a five-up stat grid) was replaced by TRAINING-
  // COMPOSITION-001's decision column + 320–360px study rail with a
  // two-column stat grid.
  assert.equal(css.cascaded(workspace, 'display', wide), 'grid');
  assert.equal(css.cascaded(workspace, 'grid-template-columns', wide), 'minmax(0, 1fr) minmax(320px, 360px)');
  assert.equal(css.cascaded(app.$('.training-session-panel .training-stat-grid'), 'grid-template-columns', wide), 'repeat(2, minmax(0, 1fr))');

  // Protects: feedback places the solution in the right-hand columns.
  await app.training.start('focused');
  await app.training.answer();
  assert.equal(workspace.dataset.trainingState, 'feedback');
  assert.equal(css.cascaded(app.byId('trainingSolution'), 'grid-column', wide), '9 / -1');
  // Protects: no layout preset restyles the Training workspace.
  for (const preset of ['table-focus', 'controls-first', 'analysis-focus']) {
    await withPreset(preset, () => {
      assert.equal(css.cascaded(workspace, 'grid-template-columns', wide), 'minmax(0, 1fr) minmax(320px, 360px)', preset);
    });
  }
});

test('Equity keeps a stable gallery, center Board, and global Hand Analysis rail', async () => {
  const equity = markup.querySelector('.equity-workspace');
  assert.equal(equity.dataset.equityState, 'empty');
  const player = equity.querySelector('.equity-player-panel');
  const center = equity.querySelector('.equity-center-column');
  const dossier = equity.querySelector('.equity-dossier-panel');
  assert.ok(precedes(player, center) && precedes(center, dossier));
  assert.equal(text(markup.getElementById('equityHandAnalysisTitle')), 'Hand Analysis');
  for (const selector of ['#equityBars', '.equity-result-card', '.equity-output-stack']) assert.equal(equity.querySelector(selector), null, selector);

  await app.navigate('equity');
  const workspace = app.$('.equity-workspace');
  // Protects: the composition state only accepts known lifecycle states.
  for (const state of ['empty', 'stale', 'running', 'complete', 'error']) {
    assert.equal(app.call('setEquityCompositionState', state), state);
    assert.equal(workspace.dataset.equityState, state);
  }
  assert.equal(app.call('setEquityCompositionState', 'bogus'), 'empty');
  assert.equal(workspace.dataset.equityState, 'empty');

  // Protects: a stable multi-column gallery that never changes columns with
  // the lifecycle state, a grid center column, and no preset restyling.
  // Superseded: the three-column 360–400/400–448/520+ grid, the sticky
  // dossier, and the 2-up scrolling 654px player list were replaced by the
  // later two-column Equity canvas with an auto-fit player gallery.
  const columns = css.cascaded(workspace, 'grid-template-columns', wide);
  assert.equal(css.cascaded(workspace, 'display', wide), 'grid');
  assert.equal(columns, 'minmax(0, 1fr) minmax(330px, .42fr)');
  for (const state of ['running', 'complete']) {
    workspace.dataset.equityState = state;
    assert.equal(css.cascaded(workspace, 'grid-template-columns', wide), columns, state);
  }
  workspace.dataset.equityState = 'empty';
  for (const preset of ['analysis-focus', 'controls-first']) {
    await withPreset(preset, () => assert.equal(css.cascaded(workspace, 'grid-template-columns', wide), columns, preset));
  }
  assert.equal(css.cascaded(app.$('.equity-center-column'), 'display', wide), 'grid');
  const list = app.$('.equity-player-list');
  const listColumns = css.cascaded(list, 'grid-template-columns', wide);
  assert.equal(listColumns, 'repeat(auto-fit, minmax(190px, 240px))');
  const previous = root.dataset.density;
  root.dataset.density = 'compact';
  assert.equal(css.cascaded(list, 'grid-template-columns', wide), listColumns, 'Compact keeps the gallery');
  root.dataset.density = previous;

  // Protects: each player tile owns a result footer whose state, Equity/Win/
  // Tie metrics follow the lifecycle; a completed result re-renders the
  // footers and the Hand Analysis; there is no per-player selection.
  const footers = () => app.$$('#equityPlayers .equity-player-card .equity-player-footer');
  assert.ok(footers().length >= 2);
  assert.ok(footers().every((footer) => footer.dataset.resultState === 'setup'));
  const ids = app.evaluate('app.equity.players.map(({ id }) => id)');
  const spy = app.spy(['renderEquityPlayerResults', 'renderEquityHandAnalysis']);
  try {
    app.evaluate('app.equity.lifecycle = "running"');
    app.call('renderEquityPlayerResults');
    assert.ok(footers().every((footer) => footer.dataset.resultState === 'running'));
    const result = {
      exact: true,
      trials: 100,
      metadata: { splitPotTrials: 0 },
      players: ids.map((id, index) => ({ id, equity: index ? 0.4 : 0.6, winProbability: index ? 0.4 : 0.6, tieProbability: 0 })),
    };
    app.call('renderEquityResult', result, app.call('equityRequestFromCurrentInputs'), { announce: false });
    assert.ok(spy.count('renderEquityPlayerResults') >= 1);
    assert.ok(spy.count('renderEquityHandAnalysis') >= 1);
  } finally {
    spy.restore();
  }
  const first = footers()[0];
  assert.equal(first.dataset.resultState, 'complete');
  const metrics = first.querySelectorAll('.equity-result-metrics > div').map((metric) => text(metric.querySelector('span')));
  assert.deepEqual(metrics, ['Equity', 'Win', 'Tie']);
  assert.ok(first.querySelector('.equity-result-metrics > .equity-result-primary'));
  assert.equal(text(first.querySelector('.equity-result-primary strong')), '60.0%');
  assert.equal(app.evaluate('typeof selectEquityPlayer'), 'undefined');
  assert.equal(app.evaluate('"selectedPlayerId" in app.equity'), false);
  assert.equal(app.$('#equityPlayers [id^="outsPanel-"], #equityPlayers .equity-result-tile'), null);
  app.call('setEquityCompositionState', 'empty');
});

test('responsive, RTL, localization, board, and card contracts remain explicit', () => {
  // Protects: Equity stacks into one column at <=1100px; the Training
  // context strip is single-column at <=620px.
  const workspace = markup.querySelector('.equity-workspace');
  assert.equal(css.cascaded(workspace, 'display', { width: 1000 }), 'flex');
  assert.equal(css.cascaded(workspace, 'flex-direction', { width: 1000 }), 'column');
  assert.equal(css.cascaded(markup.querySelector('.training-context-strip'), 'grid-template-columns', { width: 600 }), 'minmax(0, 1fr)');
  // SOURCE-SHAPE (policy lint, see ticketSheet): the ticket uses logical
  // properties only.
  for (const { property } of ticketDeclarations()) {
    assert.doesNotMatch(property, /^(?:margin-left|margin-right|padding-left|padding-right|left|right|direction)$/, property);
  }
  // Protects: the Analyze board keeps LTR card order under RTL and five card
  // columns.
  const board = markup.querySelector('.playbook-board-layout');
  const html = markup.documentElement;
  html.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(board, 'direction'), 'ltr');
  assert.equal(css.cascaded(board, 'unicode-bidi'), 'isolate');
  html.setAttribute('dir', 'ltr');
  assert.equal(css.cascaded(board, 'grid-template-columns'), 'repeat(5, var(--poker-card-width))');
  // Protects: table card glyph sizes, the classic center pip and the
  // patterned back face.
  const host = app.document.createElement('div');
  host.innerHTML = `<svg class="poker-card-svg card--style-minimal"><text class="table-card-corner-rank">A</text><text class="table-card-corner-suit">s</text><g class="table-card-center"><text class="table-card-center-suit">s</text></g></svg>
    <svg class="poker-card-svg card--style-classic"><g class="table-card-center"></g></svg>
    <svg class="poker-card-svg"><rect class="table-card-back-face"></rect><rect class="table-card-back-inner"></rect></svg>`;
  app.document.body.appendChild(host);
  assert.match(css.cascaded(host.querySelector('.table-card-corner-rank'), 'font-size'), /15px/);
  assert.match(css.cascaded(host.querySelector('.table-card-corner-suit'), 'font-size'), /14px/);
  assert.match(css.cascaded(host.querySelector('.table-card-center-suit'), 'font-size'), /24px/);
  assert.equal(css.cascaded(host.querySelector('.card--style-classic .table-card-center'), 'display'), 'block');
  assert.equal(css.cascaded(host.querySelector('.table-card-back-face'), 'fill'), 'var(--card-back)');
  assert.match(css.cascaded(host.querySelector('.table-card-back-inner'), 'stroke'), /rgba\(/);
  host.remove();
  assert.ok((translations.match(/"Decision context"/g) || []).length >= 2, 'RU and HE register the new semantic label');
  assert.match(translations, /"Changes emphasis and composition only\. Density, poker state, and available tools stay the same\."/);
});

test('composition is CSS/state-event driven and preserves existing DOM semantics', async () => {
  // Protects: a hidden review surface is never displayed.
  const host = app.document.createElement('div');
  host.innerHTML = '<section class="hand-review-surface" hidden style="display:grid"></section>';
  app.document.body.appendChild(host);
  assert.equal(css.cascaded(host.firstChild, 'display'), 'none');
  host.remove();
  // Protects: layout reacts to state, not to resize observers, layout timers
  // or layout animation frames.
  // (Only the tutorial coach mark observes size, and it is not running.)
  const NativeObserver = app.window.ResizeObserver;
  let observers = 0;
  app.window.ResizeObserver = class extends (NativeObserver || class {}) {
    constructor(...args) { super(...args); observers += 1; }
  };
  const timers = app.spy(['setInterval']);
  try {
    for (const destination of ['hand', 'analyze', 'training', 'equity', 'home']) await app.navigate(destination);
    assert.equal(timers.total(), 0, JSON.stringify(timers.sequence));
    assert.equal(observers, 0);
  } finally {
    timers.restore();
    app.window.ResizeObserver = NativeObserver;
  }
  assert.equal(markup.getElementById('trainingWorkspace').getAttribute('aria-labelledby'), 'trainingWorkspaceTitle');
  assert.equal(markup.getElementById('trainingGuessButtons').getAttribute('aria-label'), 'Available actions');
  assert.equal(markup.querySelector('.equity-player-count-control').getAttribute('role'), 'group');
  const [decision, insight, setup] = ['.training-decision-column', '.training-insight-column', '.training-setup-column'].map((selector) => markup.querySelector(selector));
  assert.ok(precedes(decision, insight) && precedes(insight, setup));
});
