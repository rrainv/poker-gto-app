import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const css = read('../app/styles.css');
const logic = read('../app/src/core/logic.js');
const translations = read('../app/src/locales/product-translations.js');
const amendCss = css.slice(css.indexOf('/* ANALYZE-COMPOSITION-001 amendment 2: fidelity finish'));
const rail = html.slice(html.indexOf('id="playbookSpotPanel"'), html.indexOf('id="playbookHandWorkspace"'));

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return source.slice(from, to);
}

// Minimal element double: hidden flag, textContent, dataset, closest().
function element(extra = {}) {
  return { hidden: false, textContent: '', dataset: {}, style: { width: '', setProperty(name, value) { this[name] = value; } }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, ...extra };
}

test('A1: the mix card lists only actions present in the mix', () => {
  const source = sourceBetween(logic, 'function setFrequency(index, action) {', 'function preflopBasePot()');
  const rows = [1, 2, 3].map(() => element());
  const nodes = {};
  rows.forEach((row, index) => {
    const n = index + 1;
    nodes[`#f${n}name`] = element({ closest: () => row });
    nodes[`#f${n}`] = element({ closest: () => row });
    nodes[`#f${n}num`] = element();
  });
  const context = { $: (sel) => nodes[sel] || null, t: (v) => v, visualActionKind: (a) => a.kind };
  vm.createContext(context);
  vm.runInContext(`${source}; this.setFrequency = setFrequency;`, context);
  context.setFrequency(1, { name: 'Bet', value: 67, kind: 'aggressive' });
  context.setFrequency(2, { name: 'Check', value: 33, kind: 'passive' });
  context.setFrequency(3, { name: '-', value: 0, kind: 'unavailable' });
  assert.deepEqual(rows.map((row) => row.hidden), [false, false, true]);
  assert.match(amendCss, /\.frequency-visualization \.frequency\[hidden\] \{ display: none; \}/);
  assert.match(amendCss, /\.frequency-visualization \.frequency \{\s*grid-template-columns: 74px minmax\(0, 1fr\) 48px;/);
  assert.match(amendCss, /\.frequency-visualization \.freq-num \{\s*text-align: end;\s*font-variant-numeric: tabular-nums;/);
});

function factHarness(values, context) {
  const source = sourceBetween(logic, '// ANALYZE-COMPOSITION-001 amendment 2: fact-cell omission rule.', 'let actionPathCompactExpanded');
  const cells = values.map(([id, label, value]) => {
    const cell = element();
    cell.querySelector = (sel) => (sel === 'b' ? { id, textContent: value } : { textContent: label });
    return cell;
  });
  const strip = element({ querySelectorAll: () => cells });
  const note = element();
  const ctx = { $: (sel) => (sel === '.analyze-facts' ? strip : sel === '#analyzeOmittedFacts' ? note : null), t: (key, v = {}) => String(key).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m) };
  vm.createContext(ctx);
  vm.runInContext(`${source}; this.apply = applyAnalyzeFactOmission;`, ctx);
  ctx.apply(context);
  return { cells, strip, note };
}

test('A2: fact-cell omission rule — unavailable facts leave the table, reflow evenly, and stay in Provenance', () => {
  const scenario = { callAmountBb: null };
  const { cells, strip, note } = factHarness([
    ['mPosition', 'Position', 'BTN'], ['mPot', 'Pot', '5.0 bb'], ['mFacing', 'Facing', '3.0 bb'],
    ['mToCall', 'To call', 'price unavailable'], ['mStack', 'Stack', '100 bb'], ['mEquity', 'Hero hand', 'AKs'],
    ['mPotOdds', 'Pot odds', '— (Price unavailable)'], ['mSPR', 'SPR', '-'], ['mRake', 'Board', 'Preflop · no board'],
  ], scenario);
  assert.deepEqual(cells.map((cell) => cell.hidden), [false, false, false, true, false, false, true, true, false]);
  assert.equal(strip.style['--fact-cols'], '6');
  assert.equal(strip.style['--fact-cols-narrow'], '3');
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, 'Not shown for this decision: To call (price unavailable) · Pot odds (Price unavailable) · SPR');
  // An exact canonical price keeps the To call cell.
  const hand = factHarness([['mToCall', 'To call', '6.0 bb'], ['mSPR', 'SPR', '3.1']], { callAmountBb: 6 });
  assert.deepEqual(hand.cells.map((cell) => cell.hidden), [false, false]);
  assert.equal(hand.note.hidden, true);
  // Never a bare dash in the table: the grid uses the visible count.
  assert.match(amendCss, /\.analyze-facts \{\s*grid-template-columns: repeat\(var\(--fact-cols, 8\), minmax\(0, 1fr\)\);/);
  assert.match(amendCss, /\.analyze-facts \.metric\[hidden\] \{ display: none; \}/);
  assert.match(html, /<p id="analyzeOmittedFacts" class="analyze-provenance-omitted" hidden><\/p>/);
  assert.ok(translations.includes("['Not shown for this decision: {facts}',"));
});

test('A3: rail numeric rows are label above, slider + boxed value field with a unit suffix; ids and bounds unchanged', () => {
  for (const [id, unit] of [['facingSizeNum', 'bb'], ['potSizeNum', 'bb'], ['playersNum', 'max'], ['stackNum', 'bb']]) {
    const tag = rail.match(new RegExp(`<span class="control-value"><input id="${id}"[^>]*><span class="control-unit"[^>]*>${unit}</span></span>`));
    assert.ok(tag, `${id} has a boxed value field with the "${unit}" suffix`);
  }
  for (const [id, min, max] of [['facingSizeNum', 0, 100], ['potSizeNum', '0.5', 200], ['playersNum', 2, 10], ['stackNum', 10, 500]]) {
    assert.match(rail, new RegExp(`id="${id}" class="control-input control-input--inline" type="number" min="${min}" max="${max}"`));
  }
  assert.match(amendCss, /\.slider-container:has\(\.control-value\) \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) var\(--analyze-value-column\);\s*grid-template-areas: "label label" "slider value";/);
  assert.match(amendCss, /--analyze-value-column: 92px;/);
  assert.match(amendCss, /\.control-value \.control-input--inline \{[^}]*font-variant-numeric: tabular-nums;/s);
  assert.ok(translations.includes("['max', 'макс', 'שחקנים']"));
  // Numeric-entry behavior stays in the shared slider-pair code (no Analyze-specific handler).
  assert.doesNotMatch(logic, /control-unit/);
});

test('A4/A5: rail card sizes and the compact dead-card row; randomization text under the rail header', () => {
  assert.match(amendCss, /\[data-slots="hero"\] \{\s*--poker-card-width: 44px;\s*--poker-card-height: 60px;/);
  assert.match(amendCss, /\.playbook-board-layout \{\s*--poker-card-width: 40px;\s*--poker-card-height: 54px;/);
  assert.match(amendCss, /\.playbook-dead-card-header \[data-slots="dead"\] \{\s*--poker-card-width: 28px;\s*--poker-card-height: 38px;/);
  assert.match(rail, /class="section-head playbook-dead-card-header">[\s\S]*?data-card-clear-command="clear_dead_set"[\s\S]*?<div class="card-slots" data-slots="dead"><\/div>\s*<\/div>/);
  assert.match(rail, /<\/header>\s*<!--[^>]*-->\s*<div class="playbook-spot-meta">\s*<p id="scenarioRandomizeStatus"[\s\S]*?id="scenarioRandomizationDetails"/);
  assert.match(logic, /function deadCardSetEditorMarkup\(group, cards, count\)[\s\S]*?data-card-set-edit="\$\{group\}"/, 'the whole-set editor still opens from the dead slots');
});

test('A7: header switch reads Hand / Scenario with descriptive accessible names', () => {
  assert.match(html, /id="playbookScenarioMode"[^>]*><span class="workspace-mode-label" aria-hidden="true" data-i18n="Scenario">Scenario<\/span><strong class="sr-only" data-i18n="Scenario Analysis">Scenario Analysis<\/strong>/);
  assert.match(html, /id="playbookHandMode"[^>]*><span class="workspace-mode-label" aria-hidden="true" data-i18n="Hand">Hand<\/span><strong class="sr-only" data-i18n="Hand Mode">Hand Mode<\/strong>/);
  assert.match(amendCss, /#strategySourceStatus strong \{ font-weight: var\(--weight-body\); \}/);
  assert.match(amendCss, /\.rail-brand-copy span \{ white-space: nowrap; \}/);
});

test('B10: reached streets show board cards as shared mini cards in an LTR island', () => {
  const path = sourceBetween(logic, 'function renderPath(street) {', 'function handCode(');
  assert.match(path, /class="path-cards" dir="ltr" role="img" aria-label="\$\{escapeActionPathMarkup\(stageDetails\[idx\]\)\}"/);
  assert.match(path, /class="analysis-mini-card riverline-card card--suit-/);
  assert.match(path, /presentation\.appendCardFaceContents\(token,/);
  assert.match(path, /if \(!reached \|\| !cards\.length\) return `<span>\$\{escapeActionPathMarkup\(stageDetails\[idx\]\)\}<\/span>`/, 'pending streets keep their text');
  assert.match(amendCss, /#playbookDecisionPathPanel \.path-cards \.analysis-mini-card \{[^}]*--card-size-mini-width: 20px;/s);
});

test('B11: the close-mix line is secondary text with action colors only in small dots', () => {
  const render = sourceBetween(logic, 'function renderAnalyzeVerdict(strategyResult)', '// Technical source id/version');
  assert.match(render, /dot\.className = 'verdict-dot';\s*dot\.dataset\.actionKind = entry\.kind;/);
  assert.match(amendCss, /\.analyze-verdict-close:not\(\[hidden\]\) \{[^}]*color: var\(--text-secondary\);/s);
  assert.match(amendCss, /\.verdict-dot\[data-action-kind="aggressive"\] \{ background: var\(--action-aggressive\); \}/);
  assert.match(amendCss, /#bestReason \{ max-width: 70ch; \}/);
});

test('D21: a pending recompute fades only the verdict and mix card; dimensions never change', () => {
  assert.match(sourceBetween(logic, 'function schedulePlaybookUpdate(reason) {', 'function commitPlaybookUpdate'), /recommendation\.dataset\.recomputing = 'true';/);
  assert.match(sourceBetween(logic, 'async function updateContext(reason', 'syncSliderPair'), /delete \$\('#recommendation'\)\.dataset\.recomputing;/);
  const rule = css.match(/#recommendation\[data-recomputing="true"\] :is\(\.analyze-verdict-copy, \.frequency-visualization\) \{([^}]*)\}/);
  assert.ok(rule, 'recompute rule exists');
  assert.equal(rule[1].trim(), 'opacity: .55;', 'only opacity changes (no size, position or display)');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*html\[data-layout-preset\] #gtoMode\[data-product-destination="analyze"\] #recommendation :is\(\.analyze-verdict-copy, \.frequency-visualization\) \{ transition: none; \}/);
});

test('D22: interaction states use motion tokens and focus-visible outlines', () => {
  for (const sel of ['#playbookAnalysisTabs \\.ui-tab:focus-visible', '\\.control-value:focus-within', 'summary:focus-visible', '\\.hand-cell:focus-visible', '\\.analyze-explain-depth > \\.ui-tab:focus-visible']) {
    assert.match(amendCss, new RegExp(sel), sel);
  }
  assert.match(amendCss, /transition: color var\(--motion-fast\) var\(--ease-standard\)/);
  assert.doesNotMatch(amendCss, /transition:[^;]*\d+ms/, 'durations come from motion tokens');
});

test('D24: dead Analyze CSS is gone (captures unchanged: amend2/dead-css-pixdiff.json)', () => {
  for (const dead of ['playbook-field-group-title', 'playbook-betting-context', 'playbook-inline-heading', 'playbook-context-grid', 'playbook-context-primary', 'playbook-inline-copy', 'playbook-inline-actions', 'playbook-facts-panel']) {
    assert.doesNotMatch(css, new RegExp(`\\.${dead}(?![\\w-])`), dead);
    assert.doesNotMatch(html, new RegExp(`class="[^"]*\\b${dead}\\b`), `${dead} markup`);
  }
});
