import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: cards, the picker, the matrix, recommendations and Equity are
// rendered in the booted app and styled through the cascade; markup is
// parsed. Strategy, table-renderer and card-presentation sources are outside
// this ticket.
const strategy = [
  '../app/src/strategy/preflop-heuristic.mjs',
  '../app/src/strategy/postflop-heuristic.mjs',
].map((url) => fs.readFileSync(new URL(url, import.meta.url), 'utf8')).join('\n');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');
// SOURCE-SHAPE: "matrix emphasis never zooms" is a policy lint over the
// DESIGN-005 block as authored (parsed, not regex-matched).
const visualSystem = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('DESIGN-005: poker visual system')) + 2;
  return new StyleSheetModel(raw.slice(start, raw.indexOf('/* PLAYBOOK-001: explicit state-source contract')));
})();
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const root = markup.documentElement;
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['Ah', 'Kd']);

test('playing cards share one ratio and all four stable suit classes', async () => {
  assert.match(css.cascaded(root, '--poker-card-aspect'), /^0\.701754/);
  const card = probe('<span class="card-slot card--known filled riverline-card card--suit-h"></span>');
  assert.equal(css.cascaded(card, '--riverline-card-face'), 'var(--card-face)');
  // The face token: --riverline-card-face falls back to --card-face (a later
  // rule writes the same --card-face face directly).
  assert.match(css.cascaded(card, 'background'), /^var\(--(?:riverline-card-face, var\(--)?card-face\)\)?$/);
  for (const [suit, token] of [['h', 'suit-heart'], ['s', 'suit-spade'], ['d', 'suit-diamond'], ['c', 'suit-club']]) {
    const suited = probe(`<span class="riverline-card card--suit-${suit}"></span>`);
    assert.equal(css.cascaded(suited, 'color'), 'var(--riverline-card-suit-color)', suit);
    assert.equal(css.cascaded(suited, '--riverline-card-suit-color'), `var(--${token})`, suit);
  }
  // Rendered cards carry the stable suit class.
  const suits = app.$$('#gtoMode [data-slots="hero"] .card-slot').map((slot) => [...slot.classList].find((name) => name.startsWith('card--suit-')));
  assert.deepEqual(suits, ['card--suit-h', 'card--suit-d']);
});

test('card states use explicit classes and dead or invalid states do not rely on opacity', async () => {
  // Rendered slots expose empty / known / dead states as classes.
  await app.pickCards('#gtoMode [data-card-set-edit="dead"]', ['2c']);
  const states = new Set(app.$$('#gtoMode [class*="card--"]').flatMap((slot) => [...slot.classList].filter((name) => /^card--(?:empty|known|dead)$/.test(name))));
  for (const state of ['empty', 'known']) assert.ok(states.has(`card--${state}`), state);
  // The dead state is rendered by the shared card-state helper.
  assert.equal(app.call('cardVisualState', 'dead', '2c'), 'dead');
  for (const [state, label] of [['dead', '"DEAD"'], ['burned', '"BURN"'], ['duplicate', '"DUP"']]) {
    const slot = probe(`<span class="card-slot card--${state}"></span>`);
    assert.equal(css.cascaded(slot, 'content', { pseudoElement: 'after' }), label, state);
    assert.notEqual(css.cascaded(slot, 'opacity'), '0', state);
  }
  const invalid = probe('<span class="card-slot card--invalid"></span>');
  assert.ok(css.matchingRules(invalid).some((rule) => rule.selectorText.includes('card--invalid')));
  assert.match(css.cascaded(probe('<span class="card-slot card--dead"></span>'), 'background-image') || '', /repeating-linear-gradient/);
});

test('unknown cards use the Riverline jade and graphite card-back treatment', () => {
  const back = probe('<span class="riverline-card-back" data-card-preview-back-style="riverline"></span>');
  assert.match(css.cascaded(back, 'background') || css.cascaded(back, 'background-color') || '', /var\(--card-back\)/);
  assert.equal(css.cascaded(back, 'content', { pseudoElement: 'after' }), '"R"');
  assert.match(table, /renderCardBack\(index\)/);
  assert.match(table, /tableCardBackSvgMarkup/);
  assert.match(cardPresentation, /data-card-state="unknown"/);
  assert.match(cardPresentation, /table-card-back-river/);
});

test('the card picker renders four explicit suit rows with unchanged card identities', async () => {
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  const rows = app.$$('.deck-suit-row');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.dataset.pickerSuit).sort(), ['c', 'd', 'h', 's']);
  for (const row of rows) {
    const buttons = row.querySelectorAll('.deck-ranks [data-deck-card]');
    assert.equal(buttons.length, 13);
    for (const button of buttons) {
      assert.equal(button.dataset.deckCard.at(-1), row.dataset.pickerSuit, 'card id is rank + suit');
      assert.match(button.getAttribute('aria-pressed'), /^(?:true|false)$/);
    }
  }
  // The current hand is preselected (pressed); cards used elsewhere are disabled.
  assert.deepEqual(app.$$('[data-deck-card][aria-pressed="true"]').map((button) => button.dataset.deckCard), ['Ah', 'Kd']);
  assert.equal(app.$('[data-deck-card="2c"]').disabled, true, 'a dead card is unavailable');
  assert.equal(css.cascaded(root, '--card-size-picker-width'), '42px');
  assert.equal(css.cascaded(root, '--card-size-picker-height'), '60px');
  assert.equal(css.cascaded(app.$('.deck-ranks'), 'grid-template-columns'), 'repeat(13, minmax(42px, 1fr))');
  await app.click('#cardSetPickerCancel');
  await app.settle(200);
});

test('the range matrix remains a dense 13 by 13 LTR poker matrix', () => {
  app.call('renderChart');
  const cells = app.$$('#strategyGrid .hand-cell');
  assert.equal(cells.length, 169);
  // Row-major RANKS order: pairs on the diagonal, suited above, offsuit below.
  for (const [index, cell] of cells.entries()) {
    const row = Math.floor(index / 13);
    const column = index % 13;
    const kind = row === column ? 'pair' : row < column ? 'suited' : 'offsuit';
    assert.ok(cell.classList.contains(`hand-${kind}`), `${index}: ${cell.className}`);
  }
  const grid = app.byId('strategyGrid');
  assert.equal(css.cascaded(grid, 'direction'), 'ltr');
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(markup.getElementById('strategyGrid'), 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
  // Thirteen equal columns (superseded literal: the 31px floor became 0 in
  // the Analyze matrix panel, which sets its own minimum width).
  assert.match(css.cascaded(grid, 'grid-template-columns'), /^repeat\(13, minmax\(/);
  for (const kind of ['pair', 'suited', 'offsuit']) {
    const cell = cells.find((node) => node.classList.contains(`hand-${kind}`));
    assert.ok(css.cascaded(cell, 'content', { pseudoElement: 'before' }) !== undefined || css.cascaded(cell, 'background', { pseudoElement: 'before' }) !== undefined, kind);
  }
});

test('matrix selection and hover use bounded non-color emphasis without zoom', async () => {
  const cell = app.$$('#strategyGrid .hand-cell').find((node) => node.getAttribute('aria-pressed') === 'false');
  await app.click(cell);
  const selected = app.$('#strategyGrid .hand-cell[aria-pressed="true"]');
  assert.ok(selected, 'selecting a cell presses it');
  assert.match(css.cascaded(selected, 'box-shadow') || '', /inset/);
  assert.equal(css.cascaded(selected, 'transform', { states: ['hover'], stateElement: selected }), 'none');
  for (const rule of visualSystem.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /scale\(1\.[1-9]/, rule.selectorText);
  }
});

test('mixed strategy cells and detailed allocations share stable semantic action colors', () => {
  app.call('renderChart');
  const bars = app.$$('#strategyGrid .matrix-mix-bar');
  assert.ok(bars.length > 0, 'mixed cells render a mix bar');
  for (const segment of bars.flatMap((bar) => bar.querySelectorAll('i'))) assert.ok(segment.dataset.actionKind, 'every segment names its action kind');
  for (const [kind, token] of [
    ['aggressive', 'action-aggressive'], ['passive', 'action-passive'],
    ['fold', 'action-fold'], ['all-in', 'action-all-in'], ['mixed', 'action-mixed'],
  ]) {
    const segment = probe(`<span class="matrix-mix-bar"><i data-action-kind="${kind}"></i></span>`).firstElementChild;
    // Segments paint with --action-visual, which each kind binds to its token.
    assert.match(css.cascaded(segment, 'background') || css.cascaded(segment, 'background-color'), /var\(--action-visual\)/, kind);
    assert.equal(css.cascaded(segment, '--action-visual'), `var(--${token})`, kind);
  }
});

test('frequency bars expose exact values and a primary stacked representation', () => {
  const stack = markup.getElementById('actionFrequencyStack');
  assert.equal(stack.getAttribute('aria-label'), 'Open 76%, Limp 10%, Fold 14%');
  assert.deepEqual(stack.querySelectorAll('[data-action-kind]').map((node) => [node.dataset.actionKind, node.getAttribute('style')]), [
    ['aggressive', 'width:76%'], ['passive', 'width:10%'], ['fold', 'width:14%'],
  ]);
  // The running stack's label describes its rendered values.
  assert.match(app.byId('actionFrequencyStack').getAttribute('aria-label') || '', /\d+%/);
  app.call('setFrequency', 1, { name: 'Raise', value: 64, kind: 'aggressive' });
  app.call('setFrequency', 2, { name: 'Call', value: 0, kind: 'passive' });
  assert.equal(app.byId('f1').style.width, '64%');
  assert.equal(text(app.byId('f1num')), '64%');
  assert.equal(text(app.byId('f2num')), '-');
  app.call('renderPath');
});

test('recommendations distinguish decision, provenance, metadata, and warnings', async () => {
  assert.ok(markup.getElementById('recommendation'));
  assert.equal(text(markup.getElementById('sourceBadge')), 'HEURISTIC');
  assert.equal(markup.getElementById('strategyMeta').hidden, true);
  const warningsMarkup = markup.getElementById('strategyWarnings');
  assert.equal(warningsMarkup.getAttribute('role'), 'note');
  assert.equal(warningsMarkup.hidden, true);
  await app.call('updateContext', 'test');
  await app.settle(200);
  const result = app.window.app.strategyResult;
  const policy = app.call('strategyClaimPolicy', result);
  const meta = app.byId('strategyMeta');
  assert.equal(meta.hidden, false);
  assert.equal(text(meta.querySelector('code.technical-id')), policy.sourceVersion);
  assert.match(text(meta), policy.coverage.kind === 'exact' ? /Exact covered context/ : /Broad approximate coverage/);
  const expected = [app.call('localizedStrategyLimitation', policy), ...app.call('localizedStrategyWarnings', result)].filter(Boolean);
  const warnings = app.byId('strategyWarnings');
  assert.equal(text(warnings), [...new Set(expected)].join(' · '));
  assert.equal(warnings.hidden, expected.length === 0);
  assert.doesNotMatch(text(app.byId('sourceBadge')), /GTO|DEEP CFR/i);
});

test('Equity uses reusable multiway series while retaining separate win and tie values', async () => {
  await app.navigate('equity');
  const tiles = app.$$('#equityPlayers .equity-player-card');
  tiles.forEach((tile, index) => assert.equal(tile.dataset.playerSeries, String(index)));
  for (const footer of app.$$('#equityPlayers .equity-player-footer')) {
    assert.ok(footer.dataset.resultState);
    const labels = footer.querySelectorAll('.equity-result-metrics > div > span').map((span) => text(span));
    assert.ok(labels.includes('Win') && labels.includes('Tie'));
  }
  app.evaluate('app.equity.lifecycle = "complete"; app.equity.lastResult = { players: app.equity.players.map(({ id }, index) => ({ id, equity: index ? 0.375 : 0.625, winProbability: 0.6, tieProbability: 0.05 })) }');
  const overview = app.call('equityOverviewPlayerMarkup', app.window.app.equity.players[0], 0);
  assert.match(overview, /aria-valuenow="62\.5"/);
  app.evaluate('app.equity.lifecycle = "setup"; app.equity.lastResult = null');
  const card = probe('<div class="equity-player-card"></div>');
  assert.equal(css.cascaded(card, '--series-color'), 'var(--series-0)');
  for (let index = 1; index < 10; index += 1) {
    assert.equal(css.cascaded(probe(`<div class="equity-player-card" data-player-series="${index}"></div>`), '--series-color'), `var(--series-${index})`, index);
  }
  assert.ok(markup.getElementById('equitySplitSummary'));
  await app.navigate('analyze');
});

test('the poker table retains seat mapping and adds semantic presentation states', () => {
  assert.match(table, /id="seat-\$\{i\}"/);
  assert.match(table, /data-seat-index="\$\{i\}"/);
  assert.match(table, /i === 0 \? ' is-hero'/);
  assert.match(table, /classList\.toggle\('is-actor', isActor\)/);
  assert.match(table, /classList\.toggle\('is-folded'/);
  assert.match(table, /classList\.toggle\('is-all-in'/);
  assert.match(table, /dealer\.toggleAttribute\('hidden', !isDealer\)/);
  assert.match(table, /window\.RiverlineTableEnvironment\.anchors\(activePlayers\)/);
  assert.match(table, /presentation\?\.geometry\?\.playerUnit/);
  assert.doesNotMatch(table, /Math\.(?:sin|cos)\(/);
});

test('table markup fixes the invalid height attribute and remains presentation-only', () => {
  assert.doesNotMatch(table, /height="auto"/);
  assert.match(table, /viewBox="0 0 1000 650" width="100%"/);
  assert.match(table, /role="img" aria-labelledby="poker-table-title"/);
  assert.match(table, /Presentation-only state/);
  assert.doesNotMatch(table, /applyAction|legalActions|PokerState|DecisionContext|calculateEquity/);
});

test('table cards use shared semantic suit classes without inline casino colors', () => {
  assert.match(cardPresentation, /const SUITS = Object\.freeze/);
  for (const suit of ['h', 's', 'd', 'c']) assert.match(cardPresentation, new RegExp(`${suit}: Object\\.freeze`));
  assert.match(cardPresentation, /card--suit-\$\{escapeMarkup\(presentation\.id\)\}/);
  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.doesNotMatch(table, /#e74c3c|#3498db|#2ecc71|#3a1e04|#1e4c31|#0d2617/);
});

test('Midnight, Graphite, and Daylight keep action and suit meanings stable', () => {
  const tokens = ['--action-fold', '--action-passive', '--action-aggressive', '--action-all-in', '--action-mixed', '--suit-heart', '--suit-spade', '--suit-diamond', '--suit-club'];
  const previous = root.dataset.theme;
  const snapshot = (theme) => {
    root.dataset.theme = theme;
    return tokens.map((token) => css.cascaded(root, token));
  };
  const midnight = snapshot('midnight');
  assert.deepEqual(snapshot('graphite'), midnight);
  assert.deepEqual(snapshot('daylight'), midnight);
  assert.equal(midnight[tokens.indexOf('--suit-spade')], '#18201c');
  const daylightTable = (root.dataset.theme = 'daylight', css.cascaded(root, '--poker-table-surface-start'));
  const midnightTable = (root.dataset.theme = 'midnight', css.cascaded(root, '--poker-table-surface-start'));
  assert.notEqual(daylightTable, midnightTable, 'Daylight retunes only the table surface');
  root.dataset.theme = previous;
});

test('responsive, RTL, and reduced-motion rules preserve poker semantics', () => {
  const narrow = { width: 700 };
  assert.equal(css.cascaded(probe('<div class="deck-ranks"></div>'), 'overflow-x', narrow), 'auto');
  assert.equal(css.cascaded(probe('<div class="riverline-poker-table"></div>'), 'min-width', narrow), '560px');
  assert.equal(css.cascaded(probe('<span class="card-slot filled"></span>'), 'animation', { reducedMotion: true }), 'none');
  const grid = markup.getElementById('strategyGrid');
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(grid, 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
});

test('poker and strategy safety entry points remain intact', async () => {
  assert.equal(typeof app.window.RiverlinePlaybookState, 'object');
  // (The old /evaluateHand/ match only found the "// evaluateHand removed"
  // comment; the classic page no longer defines it.)
  assert.equal(app.evaluate('typeof calculateEquity'), 'function');
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
  // Scenario updates hand the table its board, hero cards, dealer and seats.
  const updates = [];
  const listener = (event) => updates.push(event.detail);
  app.window.addEventListener('gameStateUpdate', listener);
  try {
    app.call('renderPlaybookTableProjection');
  } finally {
    app.window.removeEventListener('gameStateUpdate', listener);
  }
  const detail = updates.find((entry) => entry.mode === 'scenario');
  assert.ok(detail);
  assert.deepEqual(Object.keys(detail).filter((key) => ['board', 'heroCards', 'dealerPos', 'activePlayers'].includes(key)).sort(), ['activePlayers', 'board', 'dealerPos', 'heroCards']);
  assert.equal(detail.activePlayers, app.window.app.decisionContext?.tableSize ?? detail.activePlayers);
});
