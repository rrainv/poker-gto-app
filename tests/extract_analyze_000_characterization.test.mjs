import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp, strategyProviderProbe } from './helpers/app-under-test.mjs';

// EXTRACT-ANALYZE-000: characterization tests for the CURRENT Analyze behaviour,
// written before any of it is moved out of app/src/core/logic.js. They pin what
// the booted app does today (DOM contract per state, PERF-001 counts, handoffs,
// tabs, matrix keyboard, language refresh, Save spot, randomization) so the
// EXTRACT-ANALYZE-001..004 tickets can move code without changing behaviour.
// Where the current behaviour is a known defect the test says so (test.todo).
// No product code is changed by this ticket.
//
// Ids and classes asserted here are the extraction contract: keep them or update
// these tests deliberately.

const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });

const byId = (id) => app.byId(id);
const t = (key, values) => app.call('t', key, values);
const text = (id) => byId(id).textContent;
const recommendation = () => byId('recommendation');
const recState = () => recommendation().dataset.recommendationState;
const verdictKind = () => byId('bestAction').dataset.verdictKind;
const tab = (view) => app.$(`.sub-tab[data-gto-view="${view}"]`);
const viewDisplay = (id) => byId(id).style.display;
const resolvedContext = () => app.window.app.decisionContext;

/** Replace a card group through the real picker (clear, choose, apply). */
async function setCards(group, cards) {
  const edit = `#gtoMode [data-card-set-edit="${group}"]`;
  await app.click(edit);
  await app.click('#cardSetPickerClear');
  // Clearing committed cards closes the picker; reopen it for the new selection.
  if (!app.isShown(app.$('[data-deck-card]'))) await app.click(edit);
  for (const card of cards) await app.click(`[data-deck-card="${card}"]`);
  await app.click('#cardSetPickerApply');
  await app.settle(200);
}
const pickHero = (cards) => setCards('hero', cards);

async function showTab(view) {
  await app.click(tab(view));
  await app.settle(100);
}

/** Count provider resolves (and which contexts) while `callback` runs. */
const resolvesDuring = (callback) => probe.count(callback);

/* ------------------------------------------------------------------ */
/* (a) DOM contract per state                                          */
/* ------------------------------------------------------------------ */

test('a1: empty gate: no Hero cards shows "Complete this decision", no strategy and no provider work', async () => {
  await app.navigate('analyze');
  assert.equal(recState(), 'unavailable');
  assert.equal(recommendation().getAttribute('aria-busy'), 'false');
  assert.equal(byId('analysisInputState').hidden, false, 'the gate is shown');
  assert.equal(app.isShown(byId('analysisInputState')), true);
  assert.equal(text('analysisInputMessage'), t('Choose both Hero cards before requesting strategy.'));
  assert.equal(text('analysisEditInputs'), t('Edit decision inputs'));
  assert.equal(byId('analysisEditInputs').hidden, false);
  // The verdict, source and mix say "unavailable"; nothing is invented.
  assert.equal(text('bestAction'), t('Unavailable'));
  assert.equal(verdictKind(), 'unavailable');
  assert.equal(byId('bestActionClose').hidden, true);
  assert.equal(byId('bestSizing').hidden, true);
  assert.equal(text('bestReason'), t('Choose both Hero cards before requesting strategy.'));
  assert.equal(byId('strategyWarnings').hidden, false);
  assert.equal(byId('strategyMeta').hidden, true);
  for (const id of ['mPosition', 'mPot', 'mFacing', 'mStack', 'mEquity', 'mPotOdds', 'mSPR', 'mRake']) {
    assert.equal(text(id), '-', `${id} shows a dash, never zero`);
  }
  assert.equal(text('wheelCenterText'), '-');
  // Teach is only offered for a resolved decision.
  assert.equal(byId('analysisTeachDecision').hidden, true);
  assert.equal(resolvedContext(), null);
  assert.equal(app.window.app.strategyResult, null);
  assert.equal(app.window.app.playbookResolution.status, 'unavailable');
  const resolves = await resolvesDuring(() => app.call('updateContext', 'gate'));
  assert.equal(resolves.length, 0, 'an incomplete decision never resolves a strategy');
  // The three result tabs exist; Decision is the selected one.
  assert.deepEqual(app.$$('.sub-tab').map((node) => [node.dataset.gtoView, node.getAttribute('aria-selected')]), [['context', 'true'], ['chart', 'false'], ['range', 'false']]);
});

test('a2: Scenario with Hero cards: lossy context is a warning state and the verdict is dominant', async () => {
  await pickHero(['As', 'Ad']);
  assert.equal(recState(), 'warning', 'a Scenario is lossy, so the claim policy warns');
  assert.equal(byId('analysisInputState').hidden, true);
  assert.equal(app.isShown(byId('analysisInputState')), false);
  assert.equal(verdictKind(), 'dominant');
  assert.equal(text('bestAction'), t('Open'));
  assert.equal(byId('bestActionClose').hidden, true, 'no close-mix note on a dominant verdict');
  assert.equal(byId('strategyWarnings').hidden, false);
  assert.match(text('strategyWarnings'), /lossy context/);
  assert.notEqual(text('bestReason'), '');
  assert.equal(byId('strategyMeta').hidden, false, 'provenance meta is shown for a resolved strategy');
  assert.equal(byId('analysisTeachDecision').hidden, false);
  assert.equal(recommendation().dataset.actionKind.length > 0, true);
  // The mix bar has three rows (padded) and facts are filled from the decision.
  assert.ok(byId('actionFrequencyStack').children.length >= 1);
  const context = resolvedContext();
  assert.equal(context.schemaVersion, 'decision-context/v1');
  assert.deepEqual(context.heroCards, ['As', 'Ad']);
  assert.equal(text('mPosition'), context.heroPosition);
  assert.notEqual(text('mStack'), '-');
  assert.equal(text('streetLabel'), t('Preflop'));
  // "Recomputing" is cleared once an update has rendered.
  assert.equal(recommendation().dataset.recomputing, undefined);
});

test('a3: Scenario that still needs input shows the unavailable gate with the specific missing item', async () => {
  await app.setValue('#lastAction', 'raise');
  await app.settle(200);
  assert.equal(recState(), 'unavailable');
  assert.equal(app.isShown(byId('analysisInputState')), true);
  assert.equal(text('analysisInputMessage'), t('Enter the Facing size for this bet or raise.'));
  assert.equal(text('bestAction'), t('Unavailable'));
  assert.equal(resolvedContext(), null);
  assert.equal(byId('analysisTeachDecision').hidden, true);
  // Supplying the facing size recovers a resolved decision. AA facing a 2.5 bb raise is a
  // real "close" verdict today, so this is also the end-to-end close state.
  await app.setValue('#facingSize', '2.5');
  await app.setValue('#potSize', '4');
  await app.settle(200);
  assert.notEqual(recState(), 'unavailable');
  assert.equal(app.isShown(byId('analysisInputState')), false);
  assert.equal(verdictKind(), 'close');
  assert.equal(byId('bestActionClose').hidden, false);
  assert.match(text('bestAction'), / or /, 'EN close verdict reads "A or B"');
  assert.equal(byId('bestActionClose').querySelectorAll('.verdict-share').length, 2);
  // Back to the unopened baseline the rest of the file starts from.
  await app.setValue('#lastAction', 'unopened');
  await app.setValue('#facingSize', '0');
  await app.setValue('#potSize', '1.5');
  await app.settle(200);
  assert.equal(resolvedContext().lastAction, 'unopened');
  assert.equal(verdictKind(), 'dominant');
  assert.equal(text('bestAction'), t('Open'));
});

test('a4: setRecommendationState DOM contract for every state', () => {
  const expectations = {
    ready: { gate: false, teach: true, busy: 'false' },
    mixed: { gate: false, teach: true, busy: 'false' },
    warning: { gate: false, teach: true, busy: 'false' },
    waiting: { gate: true, teach: false, busy: 'false' },
    unavailable: { gate: true, teach: false, busy: 'false' },
    loading: { gate: true, teach: false, busy: 'true' },
  };
  for (const [state, expected] of Object.entries(expectations)) {
    app.call('setRecommendationState', state);
    assert.equal(recState(), state);
    assert.equal(byId('analysisInputState').hidden, !expected.gate, `${state}: gate`);
    assert.equal(byId('analysisTeachDecision').hidden, !expected.teach, `${state}: teach`);
    assert.equal(recommendation().getAttribute('aria-busy'), expected.busy, `${state}: busy`);
  }
  assert.equal(text('analysisInputMessage'), t('Loading…'), 'loading names itself');
  assert.equal(byId('analysisEditInputs').hidden, true, 'no edit while loading');
  app.call('setRecommendationState', 'unavailable');
  assert.equal(text('analysisInputMessage'), t('Check the cards and decision context to continue.'));
  assert.equal(byId('analysisEditInputs').hidden, false);
  app.call('setRecommendationState', 'warning');
});

test('a5: close verdict DOM contract: "A or B", the close note and dots, never a dominant label', () => {
  const result = {
    schemaVersion: 'strategy-result/v1',
    recommendation: { label: 'CALL', action: { type: 'call' } },
    actions: [
      { label: 'Call', probability: 0.5, action: { type: 'call', amountBb: null, potFraction: null } },
      { label: 'Fold', probability: 0.4, action: { type: 'fold', amountBb: null, potFraction: null } },
      { label: 'Raise', probability: 0.1, action: { type: 'raise', amountBb: null, potFraction: null } },
    ],
  };
  const verdict = app.call('renderAnalyzeVerdict', result);
  assert.equal(verdict.kind, 'close');
  assert.equal(verdictKind(), 'close');
  assert.equal(text('bestAction'), t('{first} or {second}', { first: t('Call'), second: t('Fold') }));
  assert.equal(byId('bestActionClose').hidden, false);
  const note = byId('bestActionClose');
  assert.equal(note.querySelectorAll('.verdict-share').length, 2);
  assert.equal(note.querySelectorAll('.verdict-dot').length, 2);
  assert.equal(note.querySelectorAll('.verdict-share-value').length, 2);
  // Back to the dominant verdict hides the note again.
  const dominant = {
    ...result,
    actions: [
      { label: 'Call', probability: 0.8, action: { type: 'call', amountBb: null, potFraction: null } },
      { label: 'Fold', probability: 0.2, action: { type: 'fold', amountBb: null, potFraction: null } },
    ],
  };
  assert.equal(app.call('renderAnalyzeVerdict', dominant).kind, 'dominant');
  assert.equal(verdictKind(), 'dominant');
  assert.equal(byId('bestActionClose').hidden, true);
  assert.equal(text('bestAction'), t('Call'));
});

/* ------------------------------------------------------------------ */
/* (b) PERF-001                                                         */
/* ------------------------------------------------------------------ */

test('b1: exactly one strategyProvider.resolve per decision update, on every tab', async () => {
  for (const view of ['context', 'chart', 'range', 'context']) {
    await showTab(view);
    const resolves = await resolvesDuring(() => app.call('updateContext', `update on ${view}`));
    const main = resolves.filter((context) => context === resolvedContext());
    assert.equal(main.length, 1, `${view}: the decision is resolved once`);
    if (view !== 'chart') assert.equal(resolves.length, 1, `${view}: nothing else resolves`);
  }
});

test('b2: coalesced slider input: several inputs in one frame produce one update and one resolve', async () => {
  const slider = byId('potSize');
  const original = slider.value;
  const spy = app.spy(['updateContext']);
  try {
    const resolves = await resolvesDuring(async () => {
      for (const value of ['5', '6', '7']) {
        slider.value = value;
        app.dispatch(slider, new app.window.Event('input', { bubbles: true }));
      }
      assert.equal(spy.count('updateContext'), 0, 'inputs only schedule; no update ran synchronously');
      assert.equal(recommendation().dataset.recomputing, 'true', 'calm loading mark while an update is pending');
      await app.settle(300);
    });
    assert.equal(spy.count('updateContext'), 1);
    assert.equal(resolves.length, 1);
    assert.equal(resolvedContext().potBb, 7, 'the latest value won');
    assert.equal(recommendation().dataset.recomputing, undefined);
  } finally {
    spy.restore();
    slider.value = original;
    app.dispatch(slider, new app.window.Event('input', { bubbles: true }));
    app.dispatch(slider, new app.window.Event('change', { bubbles: true }));
    await app.settle(300);
  }
});

test('b3: the 169-cell matrix resolves only when visible and preflop; a hidden matrix is only marked dirty', async () => {
  await showTab('context');
  app.evaluate('app.matrixModel = null');
  // Hidden: a full update resolves the decision once and builds no matrix.
  const spy = app.spy(['renderChart', 'prepareMatrixStrategyModel', 'renderRangeAdvantage', 'renderBettingTree']);
  try {
    let resolves = await resolvesDuring(() => app.call('updateContext', 'hidden matrix'));
    assert.equal(resolves.length, 1);
    assert.equal(spy.count('renderChart'), 0);
    assert.equal(spy.count('prepareMatrixStrategyModel'), 0);
    assert.equal(spy.count('renderRangeAdvantage'), 0);
    assert.equal(spy.count('renderBettingTree'), 0);
    assert.equal(app.window.app.chartUpdatePending, true, 'the hidden matrix is marked dirty');
    assert.equal(app.evaluate('app.matrixModel'), null);

    // Showing it renders the dirty surface once: 169 provider cells, no more.
    resolves = await resolvesDuring(async () => { await showTab('chart'); });
    assert.equal(spy.count('renderChart'), 1, 'rendered exactly once when shown');
    assert.equal(resolves.length, 169);
    assert.equal(app.window.app.chartUpdatePending, false);
    assert.equal(app.$$('#strategyGrid [role="gridcell"]').length, 169);

    // Visible and unchanged key: an update resolves the decision plus nothing cached.
    spy.reset();
    resolves = await resolvesDuring(() => app.call('updateContext', 'visible matrix, same key'));
    assert.equal(spy.count('renderChart'), 1);
    assert.equal(resolves.length, 1, 'the model is memoised by a key that excludes the Hero cards');

    // A changed context key rebuilds all 169 cells (plus the decision).
    await showTab('context');
    await app.setValue('#players', '6');
    await app.settle(300);
    await showTab('chart');
    spy.reset();
    resolves = await resolvesDuring(async () => { await app.setValue('#players', '7'); await app.settle(300); });
    assert.equal(resolves.length, 1 + 169, 'a visible matrix rebuilds when the table size changes');
    assert.equal(spy.count('renderChart'), 1);
    await app.setValue('#players', '8');
    await app.settle(300);
  } finally {
    spy.restore();
    await showTab('context');
  }
});

test('b4: hidden Range comparison and Explain surfaces are marked dirty and rendered once when shown', async () => {
  await showTab('context');
  const spy = app.spy(['renderRangeAdvantage', 'renderPlaybookDecisionAnalysis', 'renderBettingTree', 'renderPlaybookTableProjection']);
  try {
    await app.call('updateContext', 'hidden surfaces');
    assert.equal(spy.count('renderRangeAdvantage'), 0);
    assert.equal(spy.count('renderBettingTree'), 0);
    // Explain is collapsed by default, so the analysis is not rendered either.
    assert.equal(byId('toggleTeacher').getAttribute('aria-expanded'), 'false');
    assert.equal(spy.count('renderPlaybookDecisionAnalysis'), 0);

    await showTab('range');
    assert.equal(spy.count('renderRangeAdvantage'), 1, 'rendered once on show');
    await showTab('context');
    spy.reset();
    await showTab('range');
    assert.equal(spy.count('renderRangeAdvantage'), 0, 'not dirty again: no re-render on a repeat visit');
    await showTab('context');

    spy.reset();
    await app.click('#toggleTeacher');
    assert.equal(byId('toggleTeacher').getAttribute('aria-expanded'), 'true');
    assert.equal(spy.count('renderPlaybookDecisionAnalysis'), 1, 'Explain renders once when opened');
    for (const [context, result] of spy.calls.renderPlaybookDecisionAnalysis) {
      assert.equal(context, resolvedContext());
      assert.equal(result, app.window.app.strategyResult, 'with the already resolved result');
    }
    // An update while Explain is open re-renders it (visible), with no extra resolve.
    spy.reset();
    const resolves = await resolvesDuring(() => app.call('updateContext', 'explain open'));
    assert.equal(resolves.length, 1);
    assert.equal(spy.count('renderPlaybookDecisionAnalysis'), 1);
    await app.click('#toggleTeacher');
    assert.equal(byId('toggleTeacher').getAttribute('aria-expanded'), 'false');
  } finally {
    spy.restore();
  }
});

/* ------------------------------------------------------------------ */
/* (d) tab visibility, matrix keyboard and inspector                    */
/* ------------------------------------------------------------------ */

test('d1: each tab shows exactly its view and keeps aria-selected in step', async () => {
  const views = { context: 'contextView', chart: 'chartView', range: 'rangeView' };
  for (const view of ['chart', 'range', 'context']) {
    await showTab(view);
    for (const [name, id] of Object.entries(views)) {
      assert.equal(viewDisplay(id), name === view ? 'block' : 'none', `${view}: ${id}`);
      assert.equal(tab(name).getAttribute('aria-selected'), String(name === view), `${view}: tab ${name}`);
      assert.equal(tab(name).classList.contains('active'), name === view);
    }
    if (byId('treeView')) assert.equal(viewDisplay('treeView'), 'none');
  }
  // "Back to decision" on the matrix returns to Decision.
  await showTab('chart');
  await app.click('#backContext');
  await app.settle(100);
  assert.equal(viewDisplay('contextView'), 'block');
});

test('d2: Matrix grid is an ARIA grid with one tab stop, physical arrow keys and an inspector', async () => {
  await showTab('chart');
  const grid = byId('strategyGrid');
  const cells = () => app.$$('#strategyGrid [role="gridcell"]');
  assert.equal(cells().length, 169);
  assert.equal(app.$$('#strategyGrid [role="row"]').length, 13);
  const stops = () => cells().filter((cell) => cell.tabIndex === 0);
  assert.equal(stops().length, 1, 'one Tab stop');
  assert.equal(cells()[0].dataset.hand, 'AA', 'the grid starts at AA');

  cells()[0].focus();
  await app.flush();
  assert.equal(app.document.activeElement, cells()[0]);
  assert.equal(text('selectedHand'), 'AA', 'focus shows the cell in the inspector');
  assert.equal(text('selectedHandKind'), cells()[0].dataset.handKindLabel);
  assert.ok(Number(text('selectedAvailableCombos')) >= 0 || text('selectedAvailableCombos') !== '-');

  await app.key(cells()[0], 'ArrowRight');
  assert.equal(app.document.activeElement, cells()[1]);
  assert.equal(stops().length, 1);
  assert.equal(stops()[0], cells()[1], 'the tab stop follows focus');
  await app.key(cells()[1], 'ArrowDown');
  assert.equal(app.document.activeElement, cells()[14]);
  await app.key(cells()[14], 'ArrowLeft');
  assert.equal(app.document.activeElement, cells()[13]);
  await app.key(cells()[13], 'ArrowUp');
  assert.equal(app.document.activeElement, cells()[0]);
  await app.key(cells()[0], 'ArrowLeft');
  assert.equal(app.document.activeElement, cells()[0], 'no wrap at the left edge');
  await app.key(cells()[0], 'End');
  assert.equal(app.document.activeElement, cells()[12], 'End goes to the end of the row');
  await app.key(cells()[12], 'Home');
  assert.equal(app.document.activeElement, cells()[0]);
  await app.key(cells()[0], 'End', { ctrlKey: true });
  assert.equal(app.document.activeElement, cells()[168], 'Ctrl+End goes to the last cell');
  assert.equal(grid.querySelector(`[data-hand="${text('selectedHand')}"]`), cells()[168]);
  await app.key(cells()[168], 'Home', { ctrlKey: true });
  assert.equal(app.document.activeElement, cells()[0]);

  // Click selects (aria-pressed) and the inspector shows the cell; hover previews without selecting.
  const target = cells()[14];
  await app.click(target);
  assert.equal(app.window.app.selectedHand, target.dataset.hand);
  const selected = app.$$('#strategyGrid [aria-pressed="true"]');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].dataset.hand, target.dataset.hand);
  assert.equal(text('selectedHand'), target.dataset.hand);
  const hover = cells()[30];
  app.dispatch(hover, new app.window.MouseEvent('pointerover', { bubbles: true }));
  assert.equal(text('selectedHand'), hover.dataset.hand, 'hover previews in the inspector');
  assert.equal(app.window.app.selectedHand, target.dataset.hand, 'hover does not select');
  app.dispatch(hover, new app.window.MouseEvent('pointerout', { bubbles: true }));
  assert.equal(text('selectedHand'), target.dataset.hand, 'leaving restores the selected cell');
  await showTab('context');
});

test('d3: postflop Matrix tab shows the empty state, builds no provider matrix and says why', async () => {
  await pickHero(['As', 'Kd']);
  await setCards('board', ['Qh', '7c', '2d']);
  assert.equal(resolvedContext().street, 'flop');
  await showTab('chart');
  const resolves = await resolvesDuring(() => app.call('updateContext', 'postflop matrix'));
  assert.equal(resolves.length, 1, 'only the decision resolves; no 169-cell matrix postflop');
  assert.equal(byId('postflopMatrixEmpty').hidden, false);
  assert.equal(app.isShown(byId('postflopMatrixEmpty')), true);
  assert.equal(app.$('.range-matrix-layout').hidden, true);
  assert.equal(text('selectedHand'), t('Exact hand only'));
  assert.equal(text('selectedHandKind'), t('Postflop decision'));
  assert.equal(text('selectedHandPrimary'), t('Range expansion unavailable'));
  assert.equal(text('chartSummary'), t('Use Decision for exact-hand postflop strategy.'));
  assert.equal(text('matrixPanelDescription'), t('Range expansion is not available yet; use Decision for exact-hand postflop strategy.'));
  await app.click('#postflopMatrixBack');
  await app.settle(100);
  assert.equal(viewDisplay('contextView'), 'block', 'Back to Decision leaves the empty state');
});

/* ------------------------------------------------------------------ */
/* (e) language refresh after a tab change                              */
/* ------------------------------------------------------------------ */

test('e1: language refresh EN, RU, HE after a tab change: visible text follows, hidden surfaces re-render once when shown', async () => {
  // A preflop Scenario whose Matrix and Range tabs have been shown once (clean) and then hidden.
  await pickHero(['As', 'Ad']);
  await setCards('board', []);
  assert.equal(resolvedContext().street, 'preflop');
  await showTab('chart');
  await showTab('range');
  await showTab('context');
  assert.equal(viewDisplay('chartView'), 'none');
  assert.equal(viewDisplay('rangeView'), 'none');
  const english = {
    verdict: text('bestAction'), street: text('streetLabel'), gate: text('analysisEditInputs'),
    matrix: null, range: null,
  };
  await showTab('chart');
  english.matrix = text('matrixPanelDescription');
  await showTab('range');
  english.range = text('rangeAdvantageStatus');
  await showTab('context');

  const spy = app.spy(['renderChart', 'renderRangeAdvantage']);
  try {
    for (const language of ['ru', 'he', 'en']) {
      spy.reset();
      app.window.setLanguage(language);
      await app.settle(100);
      assert.equal(app.document.documentElement.dir, language === 'he' ? 'rtl' : 'ltr', `${language}: direction`);
      // The visible Decision surface follows the language immediately.
      // (The lossy-context warning sentence is still English in RU/HE today, so it is not asserted.)
      for (const [key, id] of [['verdict', 'bestAction'], ['street', 'streetLabel'], ['gate', 'analysisEditInputs']]) {
        if (language === 'en') assert.equal(text(id), english[key], `en: ${key}`);
        else assert.notEqual(text(id), english[key], `${language}: ${key} changed`);
      }
      assert.equal(text('streetLabel'), t('Preflop'), `${language}: street`);
      assert.equal(text('analysisEditInputs'), t('Edit decision inputs'), `${language}: gate button`);
      // Hidden Matrix and Range are not rendered by a language change (PERF-001) ...
      assert.equal(spy.count('renderChart'), 0, `${language}: hidden matrix not rendered`);
      assert.equal(spy.count('renderRangeAdvantage'), 0, `${language}: hidden range not rendered`);
      // ... they were only marked dirty, so each renders once, in the new language, when shown.
      await showTab('chart');
      assert.equal(spy.count('renderChart'), 1, `${language}: matrix rendered once on show`);
      assert.equal(text('matrixPanelDescription'), t('All 169 hand classes · click any square for its current mix.'), `${language}: matrix copy`);
      if (language === 'en') assert.equal(text('matrixPanelDescription'), english.matrix);
      else assert.notEqual(text('matrixPanelDescription'), english.matrix);
      await showTab('range');
      assert.equal(spy.count('renderRangeAdvantage'), 1, `${language}: range rendered once on show`);
      if (language === 'en') assert.equal(text('rangeAdvantageStatus'), english.range);
      else assert.notEqual(text('rangeAdvantageStatus'), english.range, `${language}: range is not left in the previous language`);
      await showTab('context');
    }
  } finally {
    spy.restore();
    app.window.setLanguage('en');
    await app.settle(100);
  }
});

test('e2: a language change while the Matrix is visible re-renders it immediately and the RU copy differs from EN', async () => {
  await showTab('chart');
  const spy = app.spy(['renderChart']);
  try {
    const english = text('matrixPanelDescription');
    app.window.setLanguage('ru');
    await app.settle(100);
    assert.equal(spy.count('renderChart'), 1);
    assert.notEqual(text('matrixPanelDescription'), english);
    assert.equal(app.$$('#strategyGrid [role="gridcell"]').length, 169, 'the grid keeps its 169 cells');
  } finally {
    spy.restore();
    app.window.setLanguage('en');
    await app.settle(100);
    await showTab('context');
  }
});

/* ------------------------------------------------------------------ */
/* (f) Save spot states                                                 */
/* ------------------------------------------------------------------ */

test('f: Save spot states: unsaved, checking, saving, saved, failed (and unavailable)', async () => {
  const saveButton = byId('savedStudySaveButton');
  const editButton = byId('savedStudyEditButton');
  const status = byId('savedStudySourceStatus');
  const saveState = () => saveButton.dataset.saveState;
  const original = globalThis.callSavedStudyBridge;
  assert.equal(typeof original, 'function');
  const pending = () => {
    let resolve; let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
  };
  const consoleErrorsBefore = app.consoleErrors?.length ?? 0;
  try {
    // unsaved: the real status check ends here for a complete, never-saved Scenario.
    await app.call('refreshSavedStudySource');
    await app.settle(200);
    assert.equal(saveState(), 'unsaved');
    assert.equal(saveButton.textContent, t('Save spot'));
    assert.equal(saveButton.disabled, false);
    assert.equal(saveButton.getAttribute('aria-busy'), 'false');
    assert.equal(editButton.hidden, true);
    const unsavedStatus = status.textContent;

    // checking: a pending status lookup.
    const lookup = pending();
    globalThis.callSavedStudyBridge = (name, ...rest) => (name === 'getCurrentStatus' ? lookup.promise : original(name, ...rest));
    const refresh = app.call('refreshSavedStudySource');
    assert.equal(saveState(), 'checking');
    assert.equal(saveButton.disabled, true);
    assert.equal(saveButton.getAttribute('aria-busy'), 'true');
    assert.notEqual(status.textContent, unsavedStatus, 'checking has its own status copy');
    lookup.resolve({ state: 'unsaved', object: null });
    await refresh;
    assert.equal(saveState(), 'unsaved');

    // saving: a pending save.
    const write = pending();
    globalThis.callSavedStudyBridge = (name, ...rest) => (name === 'saveCurrent' ? write.promise : original(name, ...rest));
    const clicked = app.click(saveButton);
    await app.flush();
    assert.equal(saveState(), 'saving');
    assert.equal(saveButton.textContent, t('Saving…'));
    assert.equal(saveButton.disabled, true);
    assert.equal(saveButton.getAttribute('aria-busy'), 'true');
    // A second click while saving does nothing (saveCurrent is not called again).
    write.reject(Object.assign(new Error('boom'), { code: 'test_failure' }));
    await clicked;
    await app.settle(100);

    // failed: the rejected save reports failure, stays retryable and says so.
    assert.equal(saveState(), 'failed');
    assert.equal(saveButton.textContent, t('Save spot'));
    assert.equal(saveButton.disabled, false, 'a failed save can be retried');
    assert.equal(editButton.hidden, true);
    assert.notEqual(status.textContent, unsavedStatus);
    assert.ok(app.consoleErrors.length > consoleErrorsBefore, 'the failure is logged');
    app.consoleErrors.length = consoleErrorsBefore;

    // saved: the real bridge saves the Scenario.
    globalThis.callSavedStudyBridge = original;
    await app.click(saveButton);
    await app.settle(300);
    assert.equal(saveState(), 'saved');
    assert.equal(saveButton.textContent, t('Saved'));
    assert.equal(saveButton.disabled, true);
    assert.equal(editButton.hidden, false, 'Edit saved item appears once saved');
    assert.equal(saveButton.getAttribute('aria-busy'), 'false');

    // An update that changes the decision re-checks the (now different) spot: unsaved again.
    await app.setValue('#potSize', '3.5');
    await app.settle(300);
    assert.equal(saveState(), 'unsaved');
    assert.equal(editButton.hidden, true);
    // Returning to the saved spot reads as saved again (status check is by content).
    await app.setValue('#potSize', '1.5');
    await app.settle(300);

    // unavailable: an incomplete Scenario cannot be saved.
    await app.setValue('#lastAction', 'raise');
    await app.setValue('#facingSize', '0');
    await app.settle(300);
    assert.equal(saveState(), 'unavailable');
    assert.equal(saveButton.disabled, true);
    await app.setValue('#lastAction', 'unopened');
    await app.settle(300);
  } finally {
    globalThis.callSavedStudyBridge = original;
  }
});

/* ------------------------------------------------------------------ */
/* (g) randomization keep / change-only                                 */
/* ------------------------------------------------------------------ */

test('g: Random spot honours Keep toggles; change-only targets change one group and are disabled when kept', async () => {
  const seedFn = globalThis.randomizationSeed;
  let seed = 1000;
  globalThis.randomizationSeed = () => { seed += 7919; return seed; };
  const readScenario = () => ({
    hero: [...app.window.app.gto.hero], board: [...app.window.app.gto.board],
    position: byId('heroPos').value, stack: byId('stack').value, players: byId('players').value,
    lastAction: byId('lastAction').value, facing: byId('facingSize').value, pot: byId('potSize').value,
  });
  const keep = (group) => app.$(`[data-scenario-keep="${group}"]`);
  const target = (group) => app.$(`[data-scenario-randomize-target="${group}"]`);
  const menu = byId('scenarioRandomizationMenu');
  try {
    // Preflop: keep controls reflect state; the board target is disabled with a reason.
    assert.equal(app.window.app.gto.board.length, 0);
    assert.equal(target('board').disabled, true);
    assert.equal(target('board').title, t('There is no board to change preflop.'));
    for (const group of ['hero', 'board', 'position', 'stack', 'betting_context']) {
      assert.equal(keep(group).getAttribute('aria-pressed'), 'false', `${group} starts un-kept`);
    }

    // Keep Hero: the toggle sets state, disables the matching target, and Random spot leaves Hero alone.
    await app.click(keep('hero'));
    assert.equal(app.window.app.gto.randomizationKeeps.hero, true);
    assert.equal(keep('hero').getAttribute('aria-pressed'), 'true');
    assert.equal(target('hero').disabled, true);
    assert.equal(target('hero').title, t('Turn off Keep for this item before changing it.'));
    const before = readScenario();
    const spy = app.spy(['updateContext']);
    try {
      await app.click('#scenarioRandomizeButton');
      await app.settle(300);
      assert.equal(spy.count('updateContext'), 1, 'one update for the randomized Scenario');
    } finally {
      spy.restore();
    }
    const kept = readScenario();
    assert.deepEqual(kept.hero, before.hero, 'kept Hero cards are unchanged');
    assert.notDeepEqual({ ...kept, hero: null }, { ...before, hero: null }, 'something else changed');
    assert.equal(byId('scenarioRandomizeButton').disabled, false, 'the button is re-enabled afterwards');
    assert.equal(menu.open, false);
    assert.ok(app.window.app.gto.lastRandomizationRecipe, 'a recipe is recorded');
    assert.equal(text('scenarioRecipeSeed'), String(app.window.app.gto.lastRandomizationRecipe.seed));
    assert.notEqual(text('scenarioRandomizeStatus'), '');

    // Un-keep Hero, keep everything except Hero: change-only "New Hero" changes only Hero.
    await app.click(keep('hero'));
    assert.equal(app.window.app.gto.randomizationKeeps.hero, false);
    const heroBefore = readScenario();
    await app.click(target('hero'));
    await app.settle(300);
    const heroAfter = readScenario();
    assert.notDeepEqual(heroAfter.hero, heroBefore.hero, 'New Hero changes Hero');
    assert.deepEqual({ ...heroAfter, hero: null }, { ...heroBefore, hero: null }, 'and nothing else');
    assert.equal(app.window.app.gto.lastRandomizationRecipe.target, 'hero');

    // New position changes only the position-side of the Scenario's Hero cards and stack stay.
    const positionBefore = readScenario();
    await app.click(target('position'));
    await app.settle(300);
    const positionAfter = readScenario();
    assert.deepEqual(positionAfter.hero, positionBefore.hero);
    assert.equal(positionAfter.stack, positionBefore.stack);
    assert.equal(app.window.app.gto.lastRandomizationRecipe.target, 'position');

    // Keeping the target group makes the primary request fail honestly, with the status text.
    await app.click(keep('stack'));
    const refused = await app.call('randomizeCurrentAnalyzeScenario', 'stack');
    assert.equal(refused, false);
    assert.equal(text('scenarioRandomizeStatus'), t('Turn off Keep for this item before changing it.'));
    await app.click(keep('stack'));

    // The Hand workspace never randomizes the Scenario.
    assert.equal(app.window.app.gto.randomizationPending, false);
  } finally {
    globalThis.randomizationSeed = seedFn;
    for (const group of ['hero', 'board', 'position', 'stack', 'betting_context']) {
      if (app.window.app.gto.randomizationKeeps[group]) await app.click(keep(group));
    }
  }
});

/* ------------------------------------------------------------------ */
/* (c) handoffs: Review, Training Full Hand, Saved                      */
/* ------------------------------------------------------------------ */

const FACT_LABELS = ['Position', 'Street', 'Hero hand', 'Board', 'Pot', 'To call', 'Stack'];
const handFacts = () => Object.fromEntries(app.$$('#analyzeHandContextFacts > div').map((row) => [row.querySelector('dt').dataset.i18n, row.querySelector('dd').textContent]));

async function playHandToFlopFacingBet() {
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  await app.handAction('check');
  await app.dealBoard(['Qh', 'Jh', '2c']);
  await app.handAction('bet');
  await app.setValue('#handActionAmountBb', '20');
  await app.click('#handCommitSizedAction');
  await app.settle(300);
}

test('c1: Hand (Review) handoff: Hand context with exact facts, one resolve, Back to Hand', async () => {
  await playHandToFlopFacingBet();
  const journal = app.call('callPlaybookStateBridge', 'getHeroDecisionJournal');
  assert.equal(journal.decisions.length, 2);
  const flopIndex = 1;
  const spy = app.spy(['setAnalyzeHandContext', 'updateContext']);
  let resolves;
  try {
    resolves = await resolvesDuring(async () => {
      await app.call('openCanonicalHandDecisionInAnalysis', flopIndex);
      await app.settle(300);
    });
    assert.equal(spy.calls.updateContext.length, 1, 'one update for the handoff');
    assert.equal(spy.calls.updateContext[0][0], 'Completed Hand decision opened');
  } finally {
    spy.restore();
  }
  assert.equal(resolves.length, 1, 'one strategy resolve for the opened decision');
  assert.equal(app.$('.riverline-shell').dataset.activeMode, 'gto');
  const section = byId('analyzeHandContext');
  assert.equal(section.hidden, false);
  assert.equal(byId('gtoMode').dataset.analyzeContext, 'hand');
  assert.equal(text('analyzeHandContextName'), t('Hero Decision {number}', { number: 2 }));
  assert.equal(text('analyzeHandContextReturn'), t('Back to Hand'));
  assert.equal(byId('analyzeHandContextEdit').getAttribute('aria-expanded'), 'false');
  // The exact facts, read from the recorded decision.
  assert.deepEqual(Object.keys(handFacts()), FACT_LABELS);
  const facts = handFacts();
  const context = resolvedContext();
  assert.equal(context, journal.decisions[flopIndex].decisionContext);
  assert.equal(facts.Position, 'BTN');
  assert.equal(facts.Street, app.call('reviewStreetLabel', 'flop'));
  assert.equal(facts['Hero hand'], context.heroCards.map((card) => app.call('displayCard', card)).join(' '));
  assert.equal(facts.Board, context.board.map((card) => app.call('displayCard', card)).join(' '));
  assert.equal(facts.Pot, '22.0 bb');
  assert.equal(facts['To call'], '20.0 bb');
  assert.equal(facts.Stack, '99.0 bb', 'the Hand context shows the Hero stack at the decision');
  // An exact Hand context is not lossy: the warning (a postflop heuristic limitation) is not the lossy-context one.
  assert.equal(recState(), 'warning');
  assert.doesNotMatch(text('strategyWarnings'), /lossy context/);
  assert.equal(resolvedContext().derivation.source, 'canonical_hand');
  assert.equal(app.window.app.playbookMode, 'scenario', 'the opened decision is a Scenario-mode view');
  // The saved banner is not shown for a Hand handoff.
  assert.equal(byId('savedSpotViewerBanner').hidden, true);

  // Edit as Scenario expands the controls without changing the result ...
  await app.click('#analyzeHandContextEdit');
  assert.equal(byId('gtoMode').dataset.analyzeHandEditing, 'true');
  assert.equal(byId('analyzeHandContextEdit').getAttribute('aria-expanded'), 'true');
  assert.equal(resolvedContext(), context, 'opening the editor changes nothing yet');
  // ... and the first real edit turns it into a lossy Scenario and clears the Hand context.
  await app.setValue('#facingSize', '19');
  await app.settle(300);
  assert.equal(section.hidden, true);
  assert.equal(byId('gtoMode').dataset.analyzeContext, undefined);
  assert.equal(byId('gtoMode').dataset.analyzeHandEditing, undefined);
  assert.notEqual(resolvedContext(), context);
  assert.equal(resolvedContext().facingSizeBb, 19);
  assert.equal(recState(), 'warning', 'now a lossy Scenario');
});

test('c2: Hand handoff Back returns to Hand', async () => {
  await playHandToFlopFacingBet();
  await app.call('openCanonicalHandDecisionInAnalysis', 1);
  await app.settle(300);
  assert.equal(byId('analyzeHandContext').hidden, false);
  await app.click('#analyzeHandContextReturn');
  await app.settle(200);
  assert.equal(app.$('.riverline-shell').dataset.activeDestination ?? byId('gtoMode').dataset.productDestination, 'hand');
});

test('c3: Training Full Hand handoff: Hand context routes Back to Training with the decision facts', async () => {
  await app.training.playFullHand();
  const spy = app.spy(['setAnalyzeHandContext']);
  let resolves;
  try {
    resolves = await resolvesDuring(async () => {
      await app.call('openFullHandDecisionInAnalysis');
      await app.settle(300);
    });
    const context = spy.calls.setAnalyzeHandContext.map(([value]) => value).find(Boolean);
    assert.equal(context.returnDestination, 'training');
    assert.equal(context.returnLabelKey, 'Back to Training');
  } finally {
    spy.restore();
  }
  assert.equal(resolves.length, 1);
  assert.equal(byId('analyzeHandContext').hidden, false);
  assert.equal(text('analyzeHandContextReturn'), t('Back to Training'));
  assert.deepEqual(Object.keys(handFacts()), FACT_LABELS);
  const context = resolvedContext();
  const facts = handFacts();
  assert.equal(facts.Position, context.heroPosition);
  assert.equal(facts['Hero hand'], context.heroCards.map((card) => app.call('displayCard', card)).join(' '));
  // Unlike the Review handoff, a Full Hand decision also shows the Saved banner, titled for the Full Hand,
  // and opens Explain.
  assert.equal(byId('savedSpotViewerBanner').hidden, false);
  assert.match(text('savedSpotViewerTitle'), /Hero Decision/);
  assert.equal(byId('toggleTeacher').getAttribute('aria-expanded'), 'true');
  assert.notEqual(recState(), 'unavailable');
  await app.click('#analyzeHandContextReturn');
  await app.settle(200);
  assert.equal(app.$('.riverline-shell').dataset.activeMode, 'training');
  app.call('setAnalyzeHandContext', null);
});

test('c4: Saved handoff: the Saved banner, restored controls and exact title; closing it returns to a plain Scenario', async () => {
  await app.navigate('analyze');
  app.call('setAnalyzeHandContext', null);
  await setCards('board', []);
  await pickHero(['Ks', 'Qs']);
  await app.setValue('#potSize', '2.5');
  await app.settle(300);
  assert.equal(byId('savedStudySaveButton').dataset.saveState, 'unsaved');
  await app.click('#savedStudySaveButton');
  await app.settle(300);
  assert.equal(byId('savedStudySaveButton').dataset.saveState, 'saved');
  const saved = await app.call('callSavedStudyBridge', 'getCurrentStatus', app.call('currentSavedStudyInput'));
  assert.equal(saved.state, 'saved');
  const id = saved.object.id;
  assert.ok(id);
  // Move away so the restore is observable.
  await pickHero(['2h', '3d']);
  await app.setValue('#potSize', '6');
  await app.settle(300);
  assert.equal(byId('savedSpotViewerBanner').hidden, true);

  const resolves = await resolvesDuring(async () => {
    await app.call('openHomeSavedItem', id);
    await app.settle(400);
  });
  assert.equal(resolves.length, 1, 'one strategy resolve for the opened saved spot');
  assert.equal(app.$('.riverline-shell').dataset.activeMode, 'gto');
  assert.equal(byId('savedSpotViewerBanner').hidden, false);
  assert.equal(byId('analyzeHandContext').hidden, true, 'a Saved handoff has no Hand context');
  assert.equal(text('savedSpotViewerTruth'), t('Scenario-derived · history unavailable'));
  assert.notEqual(text('savedSpotViewerTitle'), '');
  assert.deepEqual(app.window.app.gto.hero, ['Ks', 'Qs']);
  assert.equal(byId('potSize').value, '2.5', 'the saved controls were restored');
  assert.equal(resolvedContext().potBb, 2.5);
  assert.equal(byId('savedStudySaveButton').dataset.saveState, 'saved');
  assert.equal(byId('savedStudyEditButton').hidden, false);

  // Closing the saved context hides the banner and keeps the Scenario.
  await app.click('#savedSpotCloseButton');
  await app.settle(200);
  assert.equal(byId('savedSpotViewerBanner').hidden, true);
  assert.deepEqual(app.window.app.gto.hero, ['Ks', 'Qs']);
});

/* ------------------------------------------------------------------ */
/* QA-AUDIT-HAND-ANALYZE-STACK-001                                      */
/* ------------------------------------------------------------------ */

// ANALYZE-HANDOFF-STACK-001 (deliberate update): the Scenario model stays lossy on purpose. Its Stack
// control is the configured STARTING stack, and a Scenario DecisionContext marks Hero and effective
// stack unavailable (scenario_live_stack_unavailable), so the controls and a re-derived context still
// hold the starting stack. What changed is that the Hand context panel now SAYS so (see the next
// tests) instead of showing 99 next to a silent 100. Everything this test pins is unchanged.
test('QA-AUDIT-HAND-ANALYZE-STACK-001: the Scenario controls keep the STARTING stack (the Scenario model cannot carry the stack at the decision)', async () => {
  await playHandToFlopFacingBet();
  const journal = app.call('callPlaybookStateBridge', 'getHeroDecisionJournal');
  const recorded = journal.decisions[1].decisionContext;
  assert.equal(recorded.startingStackBb, 100);
  assert.equal(recorded.heroStackBb, 99, 'Hero has 99 bb behind at the flop decision');
  assert.equal(recorded.effectiveStackBb, 79, 'the effective stack against the 20 bb bettor is 79 bb');
  assert.equal(recorded.stackBb, 100, 'DecisionContext.stackBb is the starting stack');

  await app.call('openCanonicalHandDecisionInAnalysis', 1);
  await app.settle(300);
  // The opened strategy uses the exact recorded context.
  assert.equal(resolvedContext(), recorded);
  // The Hand context panel shows Hero's stack at the decision ...
  assert.equal(handFacts().Stack, '99.0 bb');
  // ... but the Scenario Stack control holds the starting stack, not 99 or 79.
  assert.equal(byId('stack').value, '100');
  assert.equal(byId('stackMode').value, 'hero');

  // The first edit re-derives from those controls: the stack economics are lost.
  await app.click('#analyzeHandContextEdit');
  await app.setValue('#facingSize', '19');
  await app.settle(300);
  const edited = resolvedContext();
  assert.equal(edited.stackBb, 100);
  assert.equal(edited.heroStackBb, null, 'Hero stack at the decision is gone after the edit');
  assert.equal(edited.effectiveStackBb, null, 'the 79 bb effective stack is gone after the edit');
});

// ANALYZE-HANDOFF-STACK-001: the former test.todo, now passing. The Scenario model cannot carry the stack
// at the decision, so the Hand context never shows two different stacks without saying why.
test('QA-AUDIT-HAND-ANALYZE-STACK-001 fix: the Hand context says why Stack 99 differs from the starting stack in the Scenario controls', async () => {
  await playHandToFlopFacingBet();
  await app.call('openCanonicalHandDecisionInAnalysis', 1);
  await app.settle(300);
  const note = byId('analyzeHandContextStackNote');
  assert.equal(note.hidden, false, 'the stack note is shown because the decision stacks differ from the starting stack');
  assert.equal(note.textContent, t(
    'Stack at this decision: Hero {hero}, effective {effective}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep these, so SPR and pot odds can change.',
    { hero: '99.0 bb', effective: '79.0 bb', starting: '100.0 bb' },
  ));
  assert.match(note.textContent, /99\.0 bb.*79\.0 bb.*100\.0 bb/);
  assert.equal(handFacts().Stack, '99.0 bb', 'the fact row still shows the Hero stack at the decision');
  assert.equal(byId('stack').value, '100', 'the control is the starting stack and is labelled so');
  // The note is visible exactly while the Hand context is, including while editing is open.
  await app.click('#analyzeHandContextEdit');
  assert.equal(byId('analyzeHandContext').hidden, false);
  assert.equal(note.hidden, false);
});

test('QA-AUDIT-HAND-ANALYZE-STACK-001 fix: Edit as Scenario path: the first edit leaves a labelled lossy Scenario, no silent stack', async () => {
  await playHandToFlopFacingBet();
  await app.call('openCanonicalHandDecisionInAnalysis', 1);
  await app.settle(300);
  const spy = app.spy(['updateContext']);
  let resolves;
  try {
    resolves = await resolvesDuring(async () => {
      await app.click('#analyzeHandContextEdit');
      await app.setValue('#facingSize', '19');
      await app.settle(300);
    });
    assert.equal(spy.calls.updateContext.length, 1, 'one update for the edit (PERF-001)');
  } finally {
    spy.restore();
  }
  assert.equal(resolves.length, 1, 'one strategy resolve for the edit (PERF-001)');
  // The Hand context (and its note) is gone; the Scenario is the lossy, starting-stack view and says so.
  assert.equal(byId('analyzeHandContext').hidden, true);
  const edited = resolvedContext();
  assert.equal(edited.derivation.source, 'scenario');
  assert.equal(edited.startingStackBb, 100, 'the Scenario carries only the starting stack');
  assert.equal(edited.heroStackBb, null);
  assert.equal(edited.effectiveStackBb, null);
  assert.equal(
    edited.derivation.events.some((event) => event.code === 'scenario_live_stack_unavailable'),
    true,
    'the derivation records that the live stack is unavailable',
  );
  assert.equal(recState(), 'warning', 'a lossy Scenario');
});

test('QA-AUDIT-HAND-ANALYZE-STACK-001 fix: the stack note is hidden when the decision stacks equal the starting stack, and follows the language (RU, HE)', async () => {
  await playHandToFlopFacingBet();
  await app.call('openCanonicalHandDecisionInAnalysis', 1);
  await app.settle(300);
  const note = byId('analyzeHandContextStackNote');
  const english = note.textContent;
  try {
    for (const language of ['ru', 'he']) {
      app.window.setLanguage(language);
      await app.settle(100);
      assert.notEqual(note.textContent, english, `${language}: translated`);
      assert.match(note.textContent, /99[.,]0.*79[.,]0.*100[.,]0/s, `${language}: carries the three numbers`);
      assert.equal(/[A-Za-z]{4,}/.test(note.textContent.replace(/Hero|SPR/g, '')), false, `${language}: no English words left`);
    }
  } finally {
    app.window.setLanguage('en');
    await app.settle(100);
  }
  assert.equal(note.textContent, english);

  // Equal stacks: nothing differs, so nothing is claimed.
  const recorded = resolvedContext();
  app.call('setAnalyzeHandContext', {
    decisionContext: { ...recorded, startingStackBb: 100, heroStackBb: 100, effectiveStackBb: 100 },
    titleKey: 'Hero Decision {number}',
    titleValues: { number: 2 },
    returnDestination: 'hand',
    returnLabelKey: 'Back to Hand',
  });
  assert.equal(note.hidden, true);
  assert.equal(note.textContent, '');
  // Multiway or unknown effective stack: the Hero-only wording.
  app.call('setAnalyzeHandContext', {
    decisionContext: { ...recorded, startingStackBb: 100, heroStackBb: 99, effectiveStackBb: null },
    titleKey: 'Hero Decision {number}',
    titleValues: { number: 2 },
    returnDestination: 'hand',
    returnLabelKey: 'Back to Hand',
  });
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, t(
    'Stack at this decision: Hero {hero}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep it, so SPR and pot odds can change.',
    { hero: '99.0 bb', starting: '100.0 bb' },
  ));
  app.call('setAnalyzeHandContext', null);
});

test('ANALYZE-HANDOFF-STACK-001: the lossy-context warning is translated for RU and HE', async () => {
  const key = 'The exact preflop role is unavailable in this lossy context, so a broad fallback is used.';
  const english = t(key);
  assert.equal(english, key);
  try {
    for (const language of ['ru', 'he']) {
      app.window.setLanguage(language);
      assert.notEqual(t(key), key, `${language}: translated`);
    }
  } finally {
    app.window.setLanguage('en');
    await app.settle(100);
  }
});
