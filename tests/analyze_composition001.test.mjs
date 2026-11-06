import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';


import { StyleSheetModel, appStyleSheet, bootApp, freshIndexDocument, precedes, strategyProviderProbe, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the live Analyze workspace in the booted app (spies, a
// provider probe, the cascade on rendered elements) and the parsed document.
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const translations = read('../app/src/locales/product-translations.js');
const verdictModule = read('../app/src/application/analyze-verdict.mjs');
const markup = freshIndexDocument();
const css = appStyleSheet();
const W = { width: 1920 };
const probe = strategyProviderProbe();
const app = await bootApp({ width: 1920, beforeScripts: probe.beforeScripts });
// Imported after boot: both modules self-install page bridges.
const {
  ANALYZE_VERDICT_SCHEMA_VERSION,
  VERDICT_CLOSE_MARGIN,
  VERDICT_MEANINGFUL_SHARE,
  describeAnalyzeVerdict,
} = await import('../app/src/application/analyze-verdict.mjs');
await import('../app/src/application/decision-facing-summary.mjs');
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
const $ = (selector) => app.$(selector);
const cascaded = (selector, property, options = W) => css.cascaded(typeof selector === 'string' ? $(selector) : selector, property, options);
const root = () => app.document.documentElement;
// SOURCE-SHAPE: two stylesheet policies have no runtime observable and stay
// lints over the parsed stylesheet: "no product text below 12px outside the
// listed art/glyph surfaces" and "the Analyze section adds no decorative
// borders, provenance colour or !important, and uses the accent only on
// the listed components".
const rawCss = read('../app/styles.css');
// The Analyze section runs to the shared motion foundation (MOTION-FOUNDATION-001).
const analyzeSheet = new StyleSheetModel(rawCss.slice(rawCss.indexOf('/* ANALYZE-COMPOSITION-001: Analyze composition'), rawCss.indexOf('/* MOTION-FOUNDATION-001 ----')));
const wholeSheet = new StyleSheetModel(rawCss);

const result = (rows) => ({
  schemaVersion: 'strategy-result/v1',
  recommendation: { label: rows[0][0].toUpperCase(), action: { type: rows[0][1] } },
  actions: rows.map(([label, type, probability]) => ({ label, probability, action: { type, amountBb: null, potFraction: null } })),
});

// ---------------------------------------------------------------------------
// Verdict dominance and sentence case
// ---------------------------------------------------------------------------

test('verdict dominance: a 20-point lead (or no meaningful alternative) is dominant', () => {
  assert.equal(VERDICT_CLOSE_MARGIN, 0.2);
  assert.equal(VERDICT_MEANINGFUL_SHARE, 0.05);
  const dominant = describeAnalyzeVerdict(result([['3-Bet', 'raise', 0.7], ['Call', 'call', 0.2], ['Fold', 'fold', 0.1]]));
  assert.equal(dominant.schemaVersion, ANALYZE_VERDICT_SCHEMA_VERSION);
  assert.equal(dominant.kind, 'dominant');
  assert.equal(dominant.primary.label, '3-Bet', 'sentence-case action label, not the upper-case recommendation label');
  assert.equal(dominant.secondary, null);
  // Exactly the margin is dominant; floating noise never flips the class.
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.6], ['Fold', 'fold', 0.4]])).kind, 'dominant');
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.1 + 0.5], ['Fold', 'fold', 0.4]])).kind, 'dominant');
  // A second action under 5% never makes a spot "close".
  assert.equal(describeAnalyzeVerdict(result([['Fold', 'fold', 0.52], ['Call', 'call', 0.04]])).kind, 'dominant');
  assert.equal(describeAnalyzeVerdict(result([['Check', 'check', 1]])).kind, 'dominant');
});

test('verdict dominance: two actions within 20 points read as a close mix', () => {
  const close = describeAnalyzeVerdict(result([['3-Bet', 'raise', 0.50125], ['Call', 'call', 0.399375], ['Fold', 'fold', 0.099375]]));
  assert.equal(close.kind, 'close');
  assert.equal(close.primary.label, '3-Bet');
  assert.equal(close.secondary.label, 'Call');
  assert.equal(close.marginPoints, 10);
  // Order comes from probability; the provider's order only breaks ties.
  const reordered = describeAnalyzeVerdict(result([['Call', 'call', 0.45], ['Raise', 'raise', 0.55]]));
  assert.equal(reordered.primary.label, 'Raise');
  const tie = describeAnalyzeVerdict(result([['Check', 'check', 0.5], ['Bet', 'bet', 0.5]]));
  assert.equal(tie.kind, 'close');
  assert.equal(tie.primary.label, 'Check');
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.59], ['Fold', 'fold', 0.41]])).kind, 'close');
});

test('verdict dominance reads existing StrategyResult data only and never changes it', () => {
  const input = result([['Call', 'call', 0.55], ['Raise', 'raise', 0.45]]);
  const snapshot = JSON.stringify(input);
  describeAnalyzeVerdict(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(describeAnalyzeVerdict(null).kind, 'unavailable');
  assert.equal(describeAnalyzeVerdict({ actions: [] }).kind, 'unavailable');
  assert.doesNotMatch(verdictModule, /strategyProvider|resolve\(|import /, 'no strategy authority or dependency');
  const scripts = markup.querySelectorAll('script[src]');
  const verdict = scripts.find((node) => node.getAttribute('src') === 'src/application/analyze-verdict-bridge.mjs');
  assert.equal(verdict?.getAttribute('type'), 'module');
  assert.ok(precedes(verdict, scripts.find((node) => node.getAttribute('src').split('?')[0] === 'src/core/logic.js')), 'the module registers before logic.js runs');
});

test('the verdict renders in sentence case, primary color, display size; close mixes are smaller and say so', () => {
  const initial = markup.getElementById('bestAction');
  assert.equal(initial.dataset.verdictKind, 'dominant');
  assert.equal(markup.getElementById('bestActionClose').hidden, true);
  const best = $('#bestAction');
  const close = $('#bestActionClose');
  // Dominant: the sentence-case action label.
  const dominant = result([['3-Bet', 'raise', 0.7], ['Call', 'call', 0.2], ['Fold', 'fold', 0.1]]);
  app.call('renderAnalyzeVerdict', dominant);
  assert.equal(best.textContent, app.call('t', '3-Bet'));
  assert.equal(best.dataset.verdictKind, 'dominant');
  assert.equal(close.hidden, true);
  // Close mix: "first or second" with the same shares as the mix card.
  const mixed = result([['3-Bet', 'raise', 0.50125], ['Call', 'call', 0.399375], ['Fold', 'fold', 0.099375]]);
  app.call('renderAnalyzeVerdict', mixed);
  assert.equal(best.dataset.verdictKind, 'close');
  assert.equal(best.textContent, app.call('t', '{first} or {second}', { first: app.call('t', '3-Bet'), second: app.call('t', 'Call') }));
  assert.equal(close.hidden, false);
  const shares = app.call('strategyResultPresentationActions', mixed).map((entry) => `${entry.value}%`);
  for (const share of shares.slice(0, 2)) assert.ok(close.textContent.includes(share), `${close.textContent} has ${share}`);
  // Styling: primary colour, display type, no upper-casing; close is smaller.
  best.dataset.verdictKind = 'dominant';
  assert.equal(cascaded(best, 'color'), 'var(--text-primary)');
  assert.match(cascaded(best, 'font'), /^var\(--weight-display\) var\(--t-display\)\/var\(--t-display-line\)/);
  assert.equal(cascaded(best, 'text-transform'), 'none');
  best.dataset.verdictKind = 'close';
  assert.equal(cascaded(best, 'font-size'), 'var(--t-verdict-close)');
  assert.equal(css.cascaded(root(), '--t-verdict-close'), '1.75rem');
  assert.doesNotMatch(markup.getElementById('streetLabel')?.getAttribute('style') || '', /text-transform/, 'the street eyebrow is sentence case');
  for (const key of ['{first} or {second}', 'Close mix · {first} {firstShare} · {second} {secondShare}']) {
    assert.ok(translations.includes(`['${key}',`), `${key} has RU/HE drafts`);
  }
});

// ---------------------------------------------------------------------------
// Source badge once; status line and provenance
// ---------------------------------------------------------------------------

test('the source badge appears once: the body repeats a source only when it differs (reference)', async () => {
  assert.equal(markup.querySelectorAll('[data-variant="source"]').length, 1, 'one header source badge');
  assert.equal(markup.getElementById('sourceBadge').hidden, true);
  const badge = $('#sourceBadge');
  // A heuristic (non-reference) result never repeats its source in the body.
  badge.hidden = false;
  await app.call('updateContext');
  await app.settle(200);
  assert.notEqual(app.window.app.strategyResult?.source, 'reference_pack');
  assert.equal(badge.hidden, true);
  badge.hidden = false;
  app.call('refreshLocalizedPlaybookRuntime');
  assert.equal(badge.hidden, true);
  badge.hidden = false;
  app.call('renderUnavailableStrategy', { mode: 'scenario', reason: 'invalid_input' });
  assert.equal(badge.hidden, true);
  assert.equal(cascaded(badge, 'display'), 'none');
  await app.call('updateContext');
  await app.settle(200);
});

test('no status line above the workspace; the authority meaning stays live and in Provenance', async () => {
  const status = markup.getElementById('playbookModeStatus');
  assert.equal(status.localName, 'p');
  assert.ok(status.classList.contains('playbook-mode-status'));
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  // Visually hidden in Analyze only (Hand keeps it).
  assert.equal(cascaded('#playbookModeStatus', 'position'), 'absolute');
  assert.equal(cascaded('#playbookModeStatus', 'clip'), 'rect(0 0 0 0)');
  $('#gtoMode').dataset.productDestination = 'hand';
  assert.notEqual(cascaded('#playbookModeStatus', 'clip'), 'rect(0 0 0 0)');
  $('#gtoMode').dataset.productDestination = 'analyze';
  // The authority meaning lands in Provenance.
  const provenance = $('#playbookModeProvenance');
  provenance.textContent = '';
  app.call('renderPlaybookModeStatus', app.window.app.playbookResolution);
  assert.ok(text(provenance));
  // ANALYZE-001a: the Provenance disclosure is the "All details" region of the hero card.
  const disclosure = markup.getElementById('analyzeAllDetails');
  assert.equal(disclosure.getAttribute('role'), 'region');
  assert.ok(disclosure.classList.contains('rl-panel-card__body'));
  assert.ok(disclosure.querySelector('#playbookModeProvenance') && disclosure.querySelector('#strategyMeta'));
  assert.ok(precedes(disclosure.querySelector('#playbookModeProvenance'), disclosure.querySelector('#strategyMeta')));
  const toggleButton = markup.getElementById('analyzeAllDetailsToggle');
  assert.equal(toggleButton.getAttribute('aria-controls'), 'analyzeAllDetails');
  assert.equal(toggleButton.getAttribute('aria-expanded'), 'false');
  // The technical source id is the only monospace text.
  const technical = $('#strategyMeta .technical-id');
  assert.ok(technical, 'Provenance shows the technical source id');
  assert.equal(technical.localName, 'code');
  assert.equal(cascaded(technical, 'font-family'), 'var(--font-mono)');
  // The static region keeps its node and open state across language switches.
  const live = $('#analyzeAllDetails');
  await app.click('#analyzeAllDetailsToggle');
  assert.equal(live.hidden, false);
  assert.equal($('#analyzeAllDetailsToggle').getAttribute('aria-expanded'), 'true');
  const child = live.firstElementChild;
  for (const language of ['ru', 'en']) {
    app.window.setLanguage(language);
    await app.settle(50);
  }
  assert.equal(live.hidden, false);
  assert.ok(live.firstElementChild === child);
  await app.click('#analyzeAllDetailsToggle');
  assert.equal(live.hidden, true);
  assert.equal($('#analyzeAllDetailsToggle').getAttribute('aria-expanded'), 'false');
});

// ---------------------------------------------------------------------------
// Structure: two containers, tabs, stepper
// ---------------------------------------------------------------------------

test('Analyze has exactly two containers: one Spot rail panel and one Result panel', () => {
  assert.equal(cascaded('#gtoMode .playbook-workspace', 'grid-template-columns'), 'var(--analyze-rail-width) minmax(0, 1fr)');
  for (const selector of ['.playbook-spot-panel', '#gtoMode .playbook-decision-workspace']) {
    assert.equal(cascaded(selector, 'border'), '1px solid var(--border-default)', selector);
    assert.equal(cascaded(selector, 'border-radius'), 'var(--radius-panel)', selector);
  }
  assert.equal(cascaded('.playbook-support-rail', 'display'), 'none');
  for (const selector of ['#recommendation', '.range-comparison-panel', '#playbookDecisionPathPanel']) {
    assert.equal(cascaded(selector, 'background'), 'none', `${selector} is a section, not a box`);
    assert.equal(cascaded(selector, 'border'), '0', `${selector} is a section, not a box`);
  }
  // ANALYZE-001a: the hero answer card and the inline matrix are the second (and last) containment level: soft cards inside the Result panel.
  for (const selector of ['#analyzeHero', '#chartView']) {
    assert.equal(cascaded(selector, 'border-radius'), '16px', `${selector} is a soft v4 card`);
    assert.equal(cascaded(selector, 'padding'), '22px', `${selector} padding`);
  }
  const spot = markup.getElementById('playbookSpotPanel');
  assert.equal([spot, ...spot.querySelectorAll('*')].filter((node) => node.classList?.contains('panel')).length, 1, 'the Spot rail is one panel');
  for (const id of ['scenarioCardsPanel', 'sharedControls', 'scenarioConfigurationPanel', 'analyzeHandContext']) {
    assert.ok(markup.getElementById(id).classList.contains('playbook-spot-section'), `${id} is a rail section`);
  }
  for (const id of ['playbookStrategyAdjustment', 'playbookGameAccounting']) {
    const disclosure = markup.getElementById(id);
    assert.ok(disclosure.classList.contains('ui-disclosure') && disclosure.classList.contains('playbook-spot-disclosure'), id);
  }
});

test('the Spot rail keeps every control, the readiness/numeric-entry ids and order Cards > Action > Table', () => {
  const spot = markup.getElementById('playbookSpotPanel');
  const order = ['[data-slots="hero"]', '[data-slots="board"]', '[data-slots="dead"]', '#heroPos', '#lastAction', '#facingSizeNum', '#potSizeNum', '#playersNum', '#stackMode', '#stackNum', '#tightnessSlider', '#oppTightnessSlider', '#rakeMode', '#toggleAdvanced', '#anteNum', '#straddle']
    .map((selector) => spot.querySelector(selector));
  order.forEach((node, index) => assert.ok(node, `control ${index}`));
  order.slice(1).forEach((node, index) => assert.ok(precedes(order[index], node), `${node.id || node.dataset.slots} in order`));
  const head = spot.querySelector('.playbook-spot-head.playbook-randomize-head');
  assert.ok(head?.querySelector('#scenarioRandomizeButton'), 'randomize is a quiet rail-header control');
  assert.equal(markup.getElementById('sharedControls').classList.contains('playbook-betting-context'), false, 'the center Betting context strip is gone');
});

test('Result header: two view tabs on the start side; Save spot and All details sit on the hero card', () => {
  const nav = markup.getElementById('playbookAnalysisNavigation');
  assert.equal(nav.localName, 'nav');
  const tabs = nav.querySelector('#playbookAnalysisTabs');
  assert.ok(tabs.classList.contains('sub-tabs') && tabs.classList.contains('ui-tabs'));
  assert.equal(tabs.getAttribute('role'), 'tablist');
  // ANALYZE-001a: the Range Matrix tab, View all hands and the header actions are gone.
  assert.deepEqual([...tabs.querySelectorAll('[data-gto-view]')].map((tab) => tab.dataset.gtoView), ['context', 'range']);
  assert.equal(nav.querySelector('.playbook-result-actions'), null);
  assert.equal(markup.getElementById('openCharts'), null);
  const hero = markup.getElementById('analyzeHero');
  const actions = hero.querySelector('.analyze-hero-actions');
  const save = actions.querySelector('#savedStudySaveButton');
  assert.ok(save.classList.contains('ui-button') && save.classList.contains('ui-button--secondary'));
  assert.ok(precedes(save, actions.querySelector('#analyzeAllDetailsToggle')));
  // One accent-filled primary action: Save spot, until it is saved.
  assert.equal(cascaded(save, 'background-color') ?? cascaded(save, 'background'), 'var(--accent-primary)');
  const active = $('#playbookAnalysisTabs .ui-tab.active, #playbookAnalysisTabs .ui-tab[aria-selected="true"]');
  assert.equal(cascaded(active, 'border-block-end-color'), 'var(--accent-primary)');
});

test('the street stepper replaces the Action path rail at every width', () => {
  const matchMedia = app.window.matchMedia;
  let mediaQueries = 0;
  app.window.matchMedia = (...args) => { mediaQueries += 1; return matchMedia(...args); };
  const spy = app.spy(['applyActionPathPresentation']);
  try {
    app.call('initActionPathPresentation');
    assert.deepEqual(spy.calls.applyActionPathPresentation, [[true]]);
    assert.equal(mediaQueries, 0, 'not width-dependent');
  } finally {
    spy.restore();
    app.window.matchMedia = matchMedia;
  }
  assert.equal(cascaded('#playbookCompactActionPathMount', 'order'), '2');
  const progress = $('#playbookDecisionPathPanel .path-progress');
  assert.ok(progress);
  assert.equal(cascaded(progress, 'flex-direction'), 'row');
  const node = $('#playbookDecisionPathPanel .path-step.active .path-node');
  assert.ok(node, 'an active step is rendered');
  assert.equal(cascaded(node, 'background'), 'var(--accent-primary)', 'the active step carries the accent');
});

test('the Spot table is a collapsed section of the Result panel; Hand keeps its table open', async () => {
  assert.equal($('#table-wrapper').classList.contains('collapsed'), true, 'collapsed in Analyze');
  await app.navigate('hand');
  assert.equal($('#table-wrapper').classList.contains('collapsed'), false, 'open in Hand');
  await app.navigate('analyze');
  assert.equal($('#table-wrapper').classList.contains('collapsed'), true);
  assert.equal(cascaded('.playbook-table-toggle', 'order'), '4');
});

// ---------------------------------------------------------------------------
// Fact grid wording and non-truncation
// ---------------------------------------------------------------------------

function factFunctions() {
  return {
    // EXTRACT-ANALYZE-001: the fact formatters moved into the decision panel module.
    facing: (...args) => app.call('decisionPanel').facingFact(...args),
    toCall: (...args) => app.call('decisionPanel').toCallFact(...args),
  };
}

test('fact grid: facing and to-call wording follows DECISION_CONTEXT_SPEC §10 without inventing a price', () => {
  const { facing, toCall } = factFunctions();
  const ctx = (summary, extra = {}) => ({ street: 'preflop', priorActionSummary: summary, facingSizeBb: 3, callAmountBb: null, heroStackBb: 100, ...extra });
  assert.equal(facing(ctx({ aggressionCount: 1, facingActionFamily: 'raise' }), 3), '3.0 bb');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 0 }, { callAmountBb: 1 }), 0), 'Unopened');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 2 }, { callAmountBb: 1 }), 0), 'Limped');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 0 }, { callAmountBb: 0 }), 0), 'Option');
  assert.equal(facing(ctx({ aggressionCount: 0 }, { street: 'flop', callAmountBb: 0 }), 0), 'Check available');
  assert.equal(toCall(null), '-');
  assert.equal(toCall(ctx({ aggressionCount: 1 })), app.call('t', 'facing.price.unavailable'), 'Scenario never fabricates a price');
  assert.equal(toCall(ctx({ aggressionCount: 1 }, { callAmountBb: 6 })), '6.0 bb');
  assert.equal(toCall(ctx({ aggressionCount: 1 }, { callAmountBb: 20, heroStackBb: 20 })), '20.0 bb · All-in');
});

test('fact tiles: real facts only (equity needed, pot, to call, SPR) from the shared tile; the spot facts live under All details', async () => {
  const tileIds = ['mPotOdds', 'mPot', 'mToCall', 'mSPR'];
  const contextIds = ['mPosition', 'mFacing', 'mStack', 'mHeroHand', 'mBoard'];
  await app.call('updateContext');
  await app.settle(200);
  assert.deepEqual(app.$$('#analyzeTiles .rl-fact-tile').map((tile) => tile.dataset.fact), tileIds);
  for (const id of tileIds) assert.ok($(`#${id}`).closest('#analyzeTiles .rl-fact-tile'), `${id} is a tile value`);
  const details = markup.getElementById('analyzeAllDetails');
  for (const id of contextIds) assert.ok(details.querySelector(`#${id}`), `${id} is a spot fact under All details`);
  // ANALYZE-FACT-IDS: the Hero hand and Board facts no longer wear the equity and rake ids.
  assert.equal(markup.getElementById('mEquity'), null);
  assert.equal(markup.getElementById('mRake'), null);
  assert.equal(text($('#mToCall')), app.call('decisionPanel').toCallFact(app.window.app.decisionContext));
  // The exact required equity says what it is based on.
  assert.equal(text($('#mPotOdds').closest('.rl-fact-tile').querySelector('.rl-fact-tile__scope')), app.call('t', 'Exact · price only'));
  const label = $('#analyzeTiles .rl-fact-tile__label');
  const value = $('#analyzeTiles .rl-fact-tile__value');
  assert.equal(cascaded(label, 'color'), 'var(--text-secondary)');
  assert.equal(cascaded(value, 'font-variant-numeric'), 'tabular-nums');
  assert.equal(cascaded(value, 'font-weight'), 'var(--weight-value)');
  assert.equal(cascaded(value, 'overflow-wrap'), 'anywhere');
  assert.equal(css.cascaded(root(), '--t-value'), '0.9375rem');
  assert.equal(css.cascaded(root(), '--weight-value'), '650');
});

// ---------------------------------------------------------------------------
// Explain inline
// ---------------------------------------------------------------------------

test('Explain is inline: overline, Facts | Explain depth, three columns, Teach as a secondary action', async () => {
  const panel = markup.querySelector('.teacher-panel.analyze-explain');
  const ordered = ['.analyze-overline[data-i18n="Explain"]', '#analyzeExplainFacts', '#toggleTeacher', '#analysisTeachDecision'].map((selector) => panel.querySelector(selector));
  ordered.forEach((node, index) => assert.ok(node, `explain part ${index}`));
  ordered.slice(1).forEach((node, index) => assert.ok(precedes(ordered[index], node)));
  const toggle = markup.getElementById('toggleTeacher');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'teacherContent');
  assert.ok(markup.getElementById('analysisTeachDecision').classList.contains('ui-button--secondary'));
  // Facts | Explain is one pressed pair that follows the disclosure state.
  const facts = $('#analyzeExplainFacts');
  const explain = $('#toggleTeacher');
  if ($('#teacherContent').style.display === 'block') await app.click(explain);
  assert.equal(facts.getAttribute('aria-pressed'), 'true');
  assert.equal(explain.getAttribute('aria-pressed'), 'false');
  await app.click(explain);
  assert.equal(explain.getAttribute('aria-pressed'), 'true');
  assert.equal(facts.getAttribute('aria-pressed'), 'false');
  // No inner scrollbar; three explanation columns separated by thin rules.
  assert.equal(cascaded('#teacherContent', 'max-height'), 'none', 'no inner scrollbar');
  assert.equal(cascaded('#teacherContent', 'overflow'), 'visible');
  const explanation = $('#teacherContent .analysis-explanation');
  assert.ok(explanation, 'the inline explanation renders');
  assert.equal(cascaded(explanation, 'grid-template-columns'), 'repeat(3, minmax(0, 1fr))');
  const separated = [...explanation.children].filter((child) => cascaded(child, 'border-inline-start') === '1px solid var(--border-subtle)');
  assert.ok(separated.length >= 1, 'columns separated by thin rules');
  await app.click(explain);
});

// ---------------------------------------------------------------------------
// Range matrix
// ---------------------------------------------------------------------------

test('Range matrix: legible shared action colors, distinct unavailable cells, hover/focus inspector', async () => {
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  const cell = $('#strategyGrid .hand-cell');
  const original = { ...cell.dataset };
  try {
    cell.dataset.state = 'available';
    cell.dataset.mixState = 'pure';
    assert.equal(cascaded(cell, '--matrix-action-tint'), '52%');
    assert.equal(cascaded(cell, 'background'), 'color-mix(in srgb, var(--matrix-dominant-action) var(--matrix-action-tint), var(--surface-interactive))');
    cell.dataset.mixState = 'mixed';
    assert.equal(cascaded(cell, '--matrix-action-tint'), '34%');
    cell.dataset.state = 'unavailable';
    assert.equal(cascaded(cell, 'border-style'), 'dashed');
  } finally {
    Object.assign(cell.dataset, original);
  }
  // Pointer and keyboard focus both drive the cell inspector.
  // EXTRACT-ANALYZE-002: the inspector moved into the matrix module, so the
  // test observes its output (#selectedHand) instead of spying on a page name.
  {
    const target = app.$$('#strategyGrid .hand-cell')[5];
    const selectedHand = () => $('#selectedHand').textContent;
    const selectedCell = app.$$('#strategyGrid .hand-cell').find((candidate) => candidate.getAttribute('aria-pressed') === 'true');
    assert.ok(selectedCell && selectedCell !== target);
    target.dispatchEvent(new app.window.MouseEvent('pointerover', { bubbles: true }));
    assert.equal(selectedHand(), target.dataset.hand, 'pointer hover drives the inspector');
    $('#selectedHand').textContent = '';
    target.dispatchEvent(new app.window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(selectedHand(), target.dataset.hand, 'keyboard focus drives the inspector');
    target.dispatchEvent(new app.window.FocusEvent('focusout', { bubbles: true }));
    assert.equal(selectedHand(), selectedCell.dataset.hand, 'focusout restores the selected hand');
    await app.key(target, 'ArrowRight');
    target.dispatchEvent(new app.window.FocusEvent('focusout', { bubbles: true }));
    assert.equal(selectedHand(), selectedCell.dataset.hand, 'keyboard navigation keeps the inspector in sync');
  }
  const removed = markup.querySelector('[data-matrix-state="removed"]');
  assert.ok(removed);
  assert.match(text(removed.parentElement), /Removed by known cards/);
});

// ---------------------------------------------------------------------------
// Hand context
// ---------------------------------------------------------------------------

test('Hand context: exact decision facts read-only with the existing route back; editing becomes a Scenario', async () => {
  const section = markup.getElementById('analyzeHandContext');
  assert.ok(section.classList.contains('analyze-hand-context'));
  assert.equal(section.hidden, true);
  const back = markup.getElementById('analyzeHandContextReturn');
  const edit = markup.getElementById('analyzeHandContextEdit');
  assert.ok(precedes(back, edit));
  assert.equal(edit.getAttribute('aria-expanded'), 'false');
  // In a Hand context the Scenario controls are hidden until editing.
  const gto = $('#gtoMode');
  gto.dataset.analyzeContext = 'hand';
  try {
    for (const selector of ['#scenarioCardsPanel', '#sharedControls', '#scenarioConfigurationPanel', '.playbook-spot-disclosure']) {
      assert.equal(cascaded(selector, 'display'), 'none', selector);
    }
    gto.dataset.analyzeHandEditing = 'true';
    assert.notEqual(cascaded('#sharedControls', 'display'), 'none');
  } finally {
    delete gto.dataset.analyzeContext;
    delete gto.dataset.analyzeHandEditing;
  }
  // A completed Hand decision opens in Analyze with the route back to Hand.
  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  const spy = app.spy(['setAnalyzeHandContext']);
  try {
    const resolves = await probe.count(async () => {
      await app.call('openCanonicalHandDecisionInAnalysis', 0);
      await app.settle(300);
    });
    const context = spy.calls.setAnalyzeHandContext.map(([value]) => value).find(Boolean);
    assert.equal(context.returnDestination, 'hand');
    assert.equal(context.returnLabelKey, 'Back to Hand');
    // The decision resolves once; a preflop decision also fills the visible inline matrix (169 cells, ANALYZE-001a).
    const decision = resolves.filter((context) => context === app.window.app.decisionContext);
    assert.ok(decision.length <= 1, 'one resolution for the opened decision');
    assert.ok([0, 169].includes(resolves.length - decision.length), 'only the visible matrix adds resolves');
    // The Hand context labels the header context "Hand"; Back returns to Hand.
    spy.reset();
    const renders = await probe.count(() => { app.call('renderAnalyzeHandContext'); });
    assert.equal(renders.length, 0, 'presentation only');
    await app.click('#analyzeHandContextReturn');
    await app.settle(200);
    assert.equal(app.$('.riverline-shell').dataset.activeDestination ?? app.$('#gtoMode').dataset.productDestination, 'hand');
    // A fresh Scenario update clears the Hand context.
    await app.navigate('analyze');
    app.call('setAnalyzeHandContext', { returnDestination: 'hand', returnLabelKey: 'Back to Hand' });
    spy.reset();
    await app.call('updateContext');
    assert.deepEqual(spy.calls.setAnalyzeHandContext.at(-1), [null]);
  } finally {
    spy.restore();
  }
  // Full Hand Training decisions route back to Training.
  await app.training.playFullHand();
  const full = app.spy(['setAnalyzeHandContext']);
  try {
    await app.call('openFullHandDecisionInAnalysis');
    await app.settle(300);
    const context = full.calls.setAnalyzeHandContext.map(([value]) => value).find(Boolean);
    assert.equal(context?.returnDestination, 'training');
    assert.equal(context?.returnLabelKey, 'Back to Training');
  } finally {
    full.restore();
    app.call('setAnalyzeHandContext', null);
    await app.navigate('analyze');
  }
});

// ---------------------------------------------------------------------------
// Type scale and decoration
// ---------------------------------------------------------------------------

test('global type scale tokens are the mockup sizes', () => {
  for (const [name, value] of Object.entries({
    '--t-body': '0.875rem', '--t-small': '0.78125rem', '--t-label': '0.6875rem', '--t-heading': '0.9375rem',
    '--t-title': '1.25rem', '--t-display': '2.5rem', '--t-value': '0.9375rem',
  })) assert.equal(css.cascaded(root(), name), value, name);
  assert.equal(css.cascaded(root(), '--text-micro-size'), 'var(--t-small)', 'the old 11px product text rides on small');
  assert.equal(css.cascaded(root(), '--t-hero'), 'var(--t-display)');
});

test('no product text below 12px except overline labels, card faces, table art and matrix glyphs', () => {
  const excluded = /hand-cell|card|deck|table-|poker-table|poker-amount|matrix|range-grid|range-cell|range-category-legend|swatch|color-previews|personal-hand-map|path-node|calibration-status-legend|dealer|chip/;
  const offenders = [];
  for (const rule of wholeSheet.rules) {
    const selector = rule.selectors.join(', ');
    const uppercase = rule.declarations.some(({ property, value }) => property === 'text-transform' && /uppercase/.test(value));
    for (const { property, value } of rule.declarations) {
      if (property !== 'font' && property !== 'font-size') continue;
      for (const match of value.matchAll(/(\d*\.?\d+)(px|rem)\b/g)) {
        const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
        if (px >= 12 || px < 4) continue;
        if (excluded.test(selector)) continue;
        if (uppercase && px >= 11) continue;
        offenders.push(`${selector.slice(-60)} → ${property}: ${value}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
  for (const rule of wholeSheet.rules) {
    if (rule.declarations.some(({ value }) => /var\(--text-micro-size\)/.test(value))) {
      assert.ok(!rule.declarations.some(({ property, value }) => property === 'text-transform' && /uppercase/.test(value)), `overlines use --t-label (${rule.selectors.join(', ')})`);
    }
  }
});

test('no decorative borders or color in the Analyze section', () => {
  for (const rule of analyzeSheet.rules) {
    for (const { property, value, important } of rule.declarations) {
      const where = `${rule.selectors.join(', ')} { ${property}: ${value} }`;
      assert.ok(!important, `no !important: ${where}`);
      if (/^border-(?:inline-start|left|top|block-start)(?:-width)?$/.test(property)) assert.doesNotMatch(value, /(?<![.\d])[2-9]px/, where);
      if (property.startsWith('border')) assert.doesNotMatch(value, /var\(--provenance\)/, where);
      if (value.includes('--accent-primary')) {
        assert.ok(/border-block-end-color|box-shadow|^background$|border-color/.test(property) && (property !== 'background' || /^var\(--accent-primary(?:-hover)?\)$/.test(value)), where);
      }
    }
  }
  const decision = markup.getElementById('recommendation');
  assert.ok(![decision, ...decision.querySelectorAll('[style]')].some((node) => /border/.test(node.getAttribute?.('style') || '')));
  const gto = markup.getElementById('gtoMode');
  assert.ok(![...gto.querySelectorAll('[style]')].some((node) => /border-left:\s*4px/.test(node.getAttribute('style'))));
  assert.equal(markup.querySelector('#tightnessLabel[style], #opptightnessLabel[style], #oppTightnessLabel[style]'), null, 'no decorative label colors');
});
