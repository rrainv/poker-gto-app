import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: cards, the picker, the table and Training feedback are rendered
// in the running app and styled through the cascade. Renderer and
// presentation module sources are outside this ticket.
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');
const trainingPresentation = fs.readFileSync(new URL('../app/src/application/training-presentation.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const trainingHtml = markup.getElementById('trainingMode');
const css = appStyleSheet();
const app = await bootApp();
const root = app.document.documentElement;

test('known cards share Riverline presentation hooks across primary, Training, picker, and table surfaces', async () => {
  // Protects: Analyze slots, Training cards, picker deck cards and table cards
  // all carry the shared riverline-card presentation, which binds the card
  // face/border tokens.
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const slot = app.$('#gtoMode .riverline-card[class*="card"]');
  assert.ok(app.$$('#gtoMode .riverline-card').length > 0, 'Analyze cards use the shared family');
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  assert.ok(app.$$('#deck .deck-card.riverline-card').length === 52);
  app.call('closePicker');
  await app.training.start('focused');
  assert.ok(app.$$('#trainingMode .training-readonly-card.riverline-card').length >= 2);
  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.match(cardPresentation, /poker-card-svg riverline-card card--known/);
  assert.match(cardPresentation, /riverline-card-face table-card-face/);
  assert.match(cardPresentation, /riverline-card-corner-rank table-card-corner-rank/);
  assert.match(cardPresentation, /riverline-card-corner-suit table-card-corner-suit/);
  const card = slot || app.$('.riverline-card');
  assert.equal(css.cascaded(card, '--riverline-card-face'), 'var(--card-face)');
  assert.match(css.cascaded(card, '--riverline-card-border'), /var\(--card-border\)/);
});

test('table known cards use the DESIGN-005 face family and approximately 0.70 proportions', async () => {
  assert.match(cardPresentation, /class="riverline-card-face table-card-face"[^>]+width="\$\{geometry\.width\}" height="\$\{geometry\.height\}" rx="\$\{geometry\.radius\}"/);
  assert.match(cardPresentation, /class="riverline-card-corner-rank table-card-corner-rank/);
  await app.startHand(['As', 'Kd']);
  const face = app.$('#visual-table-container .table-card-face');
  assert.ok(face, 'Hero cards render on the table');
  assert.match(css.cascaded(face, 'fill'), /^var\(--riverline-card-face/);
  // Rank and suit glyphs (corner and centre) use the shared card rank font.
  const glyphs = app.$$('#visual-table-container [class*="table-card-"]').filter((node) => /table-card-(?:corner-)?(?:rank|suit)\b/.test(node.getAttribute('class')));
  assert.ok(glyphs.length >= 4);
  for (const node of glyphs) {
    assert.match(css.cascaded(node, 'font-family') || '', /var\(--riverline-card-rank-font\)/, node.getAttribute('class'));
  }
  assert.ok(Math.abs((40 / 57) - 0.70) < 0.01);
});

test('T and 10 remain presentation-only and do not affect A K Q or J sizing', async () => {
  // Protects: the ten style only changes notation; deck cards keep canonical
  // rank+suit codes; the full-ten rank keeps the normal rank size and is never
  // compressed vertically.
  assert.match(cardPresentation, /rank === 'T'[\s\S]*?full-ten/);
  assert.match(table, /rankStyle:\s*document\.documentElement\.dataset\.cardRankStyle/);
  await app.navigate('analyze');
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  const codes = app.$$('#deck [data-deck-card]').map((card) => card.dataset.deckCard);
  assert.equal(new Set(codes).size, 52);
  assert.ok(codes.every((code) => /^[AKQJT98765432][hsdc]$/.test(code)));
  app.call('closePicker');
  assert.match(cardPresentation, /cardRankClass\(visualRank\)/);
  assert.match(cardPresentation, /cardRankClass\(visualRank, 'table-card-'\)/);
  const host = app.document.createElement('div');
  host.innerHTML = `<span class="riverline-card">${app.window.RiverlineCardPresentation.cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' })}</span><span class="riverline-card">${app.window.RiverlineCardPresentation.cardFaceMarkup({ rank: 'A', suit: 'h', rankStyle: 'full-ten' })}</span>`;
  app.byId('gtoMode').appendChild(host);
  const previous = root.dataset.cardRankStyle;
  root.dataset.cardRankStyle = 'full-ten';
  try {
    const ten = host.querySelector('.rank--ten');
    const ace = host.children[1].querySelector('.rank');
    assert.equal(css.cascaded(ten, 'font-size'), css.cascaded(ace, 'font-size'), '10 keeps the normal rank font-size');
    assert.doesNotMatch(css.cascaded(ten, 'transform') || '', /scaleY\s*\(|\bscale\s*\(/);
  } finally {
    root.dataset.cardRankStyle = previous;
    host.remove();
  }
});

test('unknown table card backs retain their semantic and privacy presentation', () => {
  const back = table.match(/renderCardBack\(index\)\s*\{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.match(back, /tableCardBackSvgMarkup/);
  assert.match(cardPresentation, /poker-card-back/);
  assert.match(cardPresentation, /data-card-state="unknown"/);
  assert.match(cardPresentation, /table-card-back-face/);
  assert.match(cardPresentation, /table-card-back-river/);
  assert.match(cardPresentation, /table-card-back-geometric/);
  assert.doesNotMatch(cardPresentation.match(/tableCardBackSvgMarkup[\s\S]*?\n\}/)?.[0] ?? '', /data-card-state="known"/);
});

test('Training after-answer keeps the analytical stack and both textual state markers without a wheel', async () => {
  assert.ok(trainingHtml.querySelector('#trainingFrequencyStack'));
  assert.ok(trainingHtml.querySelector('#trainingFrequencyRows'));
  assert.equal(trainingHtml.querySelector('#trainingWheel, .training-wheel-secondary'), null);
  await app.training.start('focused');
  await app.training.answer();
  const rows = app.$$('#trainingFrequencyRows .training-frequency-row');
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((row) => row.querySelector('.training-frequency-label, .training-frequency-name')));
  assert.ok(rows.every((row) => row.getAttribute('aria-label')), 'rows are labelled');
  const markers = app.$$('#trainingFrequencyRows .training-frequency-marker');
  assert.ok(markers.some((marker) => marker.classList.contains('training-frequency-marker--chosen') && text(marker) === 'Chosen'));
  assert.ok(markers.some((marker) => marker.classList.contains('training-frequency-marker--highest') && text(marker) === 'Highest'));
});

test('Training leading and chosen rows use calm accents rather than a dominant outline', () => {
  const chosen = app.$('#trainingFrequencyRows .training-frequency-row.is-chosen');
  const best = app.$('#trainingFrequencyRows .training-frequency-row.is-best');
  assert.ok(chosen && best);
  assert.ok(!css.cascaded(chosen, 'outline') || css.cascaded(chosen, 'outline') === 'none');
  assert.match(css.cascaded(best, 'border-inline-start-color'), /^var\(--action-visual/);
  assert.match(css.cascaded(chosen, 'background'), /^color-mix/);
  const marker = app.$('#trainingFrequencyRows .training-frequency-marker');
  assert.ok(css.cascaded(marker, 'min-width'));
  assert.equal(css.cascaded(marker, 'white-space'), 'nowrap');
});

test('Training probability normalization and displayed facts are unchanged', () => {
  // Protects: the displayed chosen/best probabilities are the evaluation's
  // probabilities (no UI renormalization).
  const evaluation = app.window.app.training.currentEvaluation;
  assert.equal(app.evaluate('typeof strategyResultPresentationActions'), 'function');
  assert.equal(text(app.byId('trainingChosenProbability')), `${(evaluation.chosenProbability * 100).toFixed(0)}%`);
  assert.match(text(app.byId('trainingBestProbability')), new RegExp(`${(evaluation.bestProbability * 100).toFixed(0)}%$`));
  const presented = app.call('strategyResultPresentationActions', app.window.app.training.currentStrategyResult);
  const rows = app.$$('#trainingFrequencyRows .training-frequency-row');
  assert.equal(rows.length, presented.length);
  rows.forEach((row, index) => assert.match(text(row), new RegExp(`${presented[index].value}%`)));
});

test('Session Progress exposes explicit cells and restrained internal dividers', () => {
  const grid = trainingHtml.querySelector('.training-stat-grid');
  assert.ok(grid);
  assert.ok(grid.querySelector('.training-stat-cell #trainingTotalHands'));
  assert.equal(trainingHtml.querySelector('#trainingTruthMetrics').getAttribute('role'), 'status');
  assert.equal(trainingHtml.querySelector('#trainingAccuracy'), null);
  assert.equal(css.cascaded(grid, 'gap'), '1px');
  assert.equal(css.cascaded(grid, 'background'), 'var(--border-subtle)');
  assert.equal(css.cascaded(grid.querySelector('strong'), 'font-variant-numeric'), 'tabular-nums');
  const counts = markup.querySelector('.training-grade-counts') || (() => {
    const node = markup.createElement('div');
    node.className = 'training-grade-counts';
    grid.parentElement.appendChild(node);
    return node;
  })();
  assert.ok(css.cascaded(counts, 'border-top'));
});

test('muted action tokens retain the stable Fold passive aggressive all-in and mixed mapping', () => {
  const expected = {
    fold: '#68716c',
    passive: '#4f8f99',
    aggressive: '#b27e4d',
    'all-in': '#a85f70',
    mixed: '#796f91',
  };
  for (const [name, color] of Object.entries(expected)) {
    assert.equal(css.cascaded(root, `--action-${name}`).toLowerCase(), color, name);
  }
  for (const [type, token] of [['fold', 'fold'], ['call', 'passive'], ['raise', 'aggressive'], ['all_in', 'all-in']]) {
    const button = app.document.createElement('button');
    button.className = `ui-button training-action-button training-action-button--${type}`;
    app.byId('trainingMode').appendChild(button);
    const usesToken = css.matchingRules(button).some((rule) => rule.declarations.some((declaration) => declaration.value.includes(`var(--action-${token})`)));
    assert.ok(usesToken, type);
    assert.equal(css.cascaded(button, 'border-inline-start-width'), '3px');
    button.remove();
  }
});

test('UI-QA-002A remains presentation-only and leaves the Range Matrix deferred', () => {
  assert.equal(typeof app.window.RiverlinePlaybookState, 'object');
  assert.equal(typeof app.evaluate('strategyProvider').resultSchemaVersion, 'string');
  for (const name of ['calculateEquity', 'handleTrainingGuess']) assert.equal(app.evaluate(`typeof ${name}`), 'function', name);
  assert.match(trainingPresentation, /schemaVersion/);
  const grid = markup.getElementById('strategyGrid');
  assert.ok(grid);
  assert.match(css.cascaded(grid, 'grid-template-columns'), /^repeat\(13/);
  assert.doesNotMatch(table, /PokerState|DecisionContext|StrategyResult|calculateEquity|regret|MCCFR/);
});
