import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { evaluateFive } from '../shared/poker-domain/evaluator.js';
import {
  createEquityHandAnalysisProjection,
  createExactEnteredHandOutcomeFacts,
  orderBestFiveForPresentation,
} from '../app/src/application/equity-hand-analysis.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: logic.js / index.html / styles.css assertions are
// behavioural: Equity runs in the booted app (real calculations, spied page
// functions, the page renderers called with real projections) and styles are
// read through the cascade on the rendered dossier.
const app = await bootApp({ width: 1920 });
const css = appStyleSheet();
const W = { width: 1920 };
const equity = () => app.window.app.equity;
const fragment = (html) => {
  const host = app.document.createElement('div');
  host.innerHTML = html;
  return host;
};
/** Enter players (null = unknown) and a board, then calculate to completion. */
async function calculated(hands, board) {
  await app.navigate('equity');
  app.call('resetEquityCalculator');
  await app.settle(100);
  while (equity().players.length < hands.length) await app.click('#equityAddPlayer');
  const ids = equity().players.map(({ id }) => id);
  for (const [index, cards] of hands.entries()) {
    if (cards === null) continue;
    if (index > 0) await app.click(`[data-equity-hand-mode="known"][data-player-id="${ids[index]}"]`);
    await app.pickCards(`[data-equity-edit-hand="${ids[index]}"]`, cards);
  }
  if (board.length) await app.pickCards('#equityMode [data-card-set-edit="eqboard"]', board);
  await app.click('#calculate');
  for (let round = 0; round < 40 && equity().lifecycle === 'running'; round += 1) await app.settle(500);
  assert.equal(equity().lifecycle, 'complete');
  return app.byId('equityHandAnalysisContent');
}
/** Wrap the analysis bridge's projection factory to count calls. */
async function countingProjections(callback) {
  const descriptor = Object.getOwnPropertyDescriptor(app.window, 'RiverlineAnalysisExplanation');
  let count = 0;
  Object.defineProperty(app.window, 'RiverlineAnalysisExplanation', { ...descriptor, value: Object.freeze({
    ...descriptor.value,
    createEquityHandAnalysisProjection(...args) { count += 1; return descriptor.value.createEquityHandAnalysisProjection(...args); },
  }) });
  try { await callback(); } finally { Object.defineProperty(app.window, 'RiverlineAnalysisExplanation', descriptor); }
  return count;
}
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

test('exact known Full House versus flush draw separates catch-up from structural completions', () => {
  const facts = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: ['5h'],
  });
  const hero = facts.players.find(({ id }) => id === 'hero');

  assert.equal(hero.currentStanding, 'behind');
  assert.deepEqual(hero.winningOuts.cards, ['Th']);
  assert.deepEqual(hero.winningOuts.groups, [{ resultCategory: 'straight_flush', count: 1, cards: ['Th'] }]);
  for (const flushOnly of ['2h', '3h', '4h', 'Jh', 'Qh', 'Kh', 'Ah']) {
    assert.ok(hero.structuralImprovementsStillBehind.cards.includes(flushOnly), flushOnly);
    assert.ok(!hero.winningOuts.cards.includes(flushOnly), flushOnly);
  }
  assert.equal(facts.nextCardMeaning, 'ahead_after_next_card_not_guaranteed_final_pot');

  const projection = createEquityHandAnalysisProjection({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: ['5h'],
  });
  const structural = projection.players[0].facts.exactHand.drawOuts;
  assert.equal(structural.flush.count, 8);
  assert.ok(structural.flush.completionCards.includes('2h'));
  assert.deepEqual(structural.straightFlush.completionCards, ['Th']);
});

test('structural completion identities exclude every entered known hole card', () => {
  const projection = createEquityHandAnalysisProjection({
    players: [
      { id: 'hero', cards: ['Ah', 'As'] },
      { id: 'opponent', cards: ['Kh', 'Ks'] },
    ],
    board: ['2h', '3h', '4h'],
    deadCards: [],
  });
  const heroCompletions = projection.players[0].facts.exactHand.drawOuts;
  const shownCards = [
    ...heroCompletions.flush.completionCards,
    ...heroCompletions.straight.completionCards,
    ...heroCompletions.straightFlush.completionCards,
  ];

  assert.equal(shownCards.includes('Kh'), false);
  assert.equal(heroCompletions.flush.completionCards.includes('Qh'), true);
});

test('multiway winning outs must beat every entered exact hand', () => {
  const headsUp = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', 'Kc'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: [],
  });
  assert.ok(headsUp.players[0].winningOuts.cards.includes('2h'));

  const multiway = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', 'Kc'] },
      { id: 'player-3', cards: ['7s', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: [],
  });
  assert.ok(!multiway.players[0].winningOuts.cards.includes('2h'));
  assert.ok(multiway.players[0].structuralImprovementsStillBehind.cards.includes('2h'));
  assert.equal(multiway.comparisonUniverse, 'all_entered_exact_hands');
});

test('unknown opponents suppress exact catch-up claims while turn analysis owns the final next card', () => {
  const unknown = createExactEnteredHandOutcomeFacts({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: null }],
    board: ['Qh', 'Jh', '2c'],
    deadCards: [],
  });
  assert.equal(unknown.available, false);
  assert.equal(unknown.reason, 'unknown_opponent');
  assert.deepEqual(unknown.players, []);

  const turn = createExactEnteredHandOutcomeFacts({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: ['Qs', 'Qd'] }],
    board: ['Qh', 'Jh', '2c', '7d'],
    deadCards: [],
  });
  assert.equal(turn.street, 'turn');
  assert.equal(turn.nextCardMeaning, 'final_one_card_runout');
  // The page's outcome copy states what the next card means on each street.
  const outcomeCopy = (board) => {
    const projection = createEquityHandAnalysisProjection({
      players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: ['Qs', 'Qd'] }], board, deadCards: [],
    });
    return text(fragment(app.call('equityExactOutcomeMarkup', projection.players[0], projection.exactOutcomes)));
  };
  assert.match(outcomeCopy(['Qh', 'Jh', '2c']), /Catch-up cards: ahead after this turn card; River remains\./);
  assert.match(outcomeCopy(['Qh', 'Jh', '2c', '7d']), /River cards that win at showdown\./);
});

test('Best Five presentation follows canonical category and tiebreak structure', () => {
  const cases = [
    { cards: ['Jh', 'Jd', 'Qc', 'Js', 'Jc'], expected: 'JJJJQ' },
    { cards: ['2h', 'Kd', '2c', 'Ks', 'Kc'], expected: 'KKK22' },
    { cards: ['Ah', '7d', '7c', 'Ks', '7s'], expected: '777AK' },
    { cards: ['2h', 'Qd', '2c', 'Qs', 'Ac'], expected: 'QQ22A' },
    { cards: ['2h', 'Kd', '2c', 'Qs', 'Ac'], expected: '22AKQ' },
    { cards: ['2h', '5d', '3c', 'As', '4c'], expected: '5432A' },
    { cards: ['Th', 'Ah', 'Jh', 'Kh', 'Qh'], expected: 'AKQJT' },
    { cards: ['2h', '9h', 'Jh', 'Kh', 'Ah'], expected: 'AKJ92' },
    { cards: ['2h', '9d', 'Js', 'Kc', 'Ah'], expected: 'AKJ92' },
  ];
  for (const { cards, expected } of cases) {
    const canonical = evaluateFive(cards);
    const ordered = orderBestFiveForPresentation(canonical);
    assert.deepEqual([...ordered].sort(), [...canonical.bestFiveCards].sort());
    assert.equal(ordered.map((card) => card[0]).join(''), expected);
  }
});

test('one completed projection invokes one global and one known-player RangeAnalysis projection', () => {
  const calls = { requests: 0, facts: 0 };
  const projection = createEquityHandAnalysisProjection({
    players: [
      { id: 'hero', cards: ['Ah', 'Kh'] },
      { id: 'villain', cards: ['Qs', 'Qd'] },
      { id: 'unknown', cards: null },
    ],
    board: ['Qh', 'Jh', '2c'],
    deadCards: [],
  }, {
    createRangeAnalysisRequest(input) {
      calls.requests += 1;
      return input;
    },
    createRangeAnalysisFacts(input) {
      calls.facts += 1;
      return { schemaVersion: 'range-analysis-facts/v1', exactHand: { canonicalRank: null }, input };
    },
  });
  assert.equal(calls.requests, 3);
  assert.equal(calls.facts, 3);
  assert.equal(projection.players[2].facts, null);
  assert.deepEqual(projection.globalFacts.input.deadCards, ['Ah', 'Kh', 'Qs', 'Qd']);
  assert.deepEqual(projection.players[0].facts.input.deadCards, ['Qs', 'Qd']);
  assert.deepEqual(projection.players[1].facts.input.deadCards, ['Ah', 'Kh']);
});

test('result-owned analysis lifecycle performs no setup or stale replacement projection', async () => {
  // A completed calculation builds the analysis projection once.
  let content;
  assert.equal(await countingProjections(async () => { content = await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']); }), 1);
  const completed = equity().lastAnalysis;
  assert.ok(completed);
  // Pending inputs keep the completed analysis as stale and re-render it
  // without building a replacement projection; player rendering never
  // touches the analysis.
  const spy = app.spy(['renderEquityHandAnalysis']);
  try {
    assert.equal(await countingProjections(() => { app.call('setEquityPending', {}); }), 0);
    assert.equal(equity().staleAnalysis, completed);
    assert.equal(spy.count('renderEquityHandAnalysis'), 1);
    spy.reset();
    assert.equal(await countingProjections(() => { app.call('renderEquityPlayers'); }), 0);
    assert.equal(spy.count('renderEquityHandAnalysis'), 0);
  } finally {
    spy.restore();
  }
  // A language refresh re-renders the result without rebuilding analysis.
  await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']);
  const result = app.spy(['renderEquityResult']);
  try {
    assert.equal(await countingProjections(() => { app.call('refreshLocalizedEquityRuntime'); }), 0);
    assert.equal(result.calls.renderEquityResult.at(-1)[2].rebuildAnalysis, false);
  } finally {
    result.restore();
  }
  assert.ok(content);
});

test('analysis and exact-card depth are independently lazy and card removal is demoted', async () => {
  const content = await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']);
  const disclosures = content.querySelectorAll('details[data-equity-disclosure]');
  assert.ok(disclosures.some((details) => details.dataset.equityDisclosure === 'best-five'));
  assert.ok(disclosures.some((details) => details.dataset.equityDisclosure === 'outcome' && details.dataset.outcomeKind && details.dataset.playerId));
  // Detail renders lazily on first open, once.
  const lazy = disclosures.find((details) => details.dataset.equityDisclosure === 'best-five');
  const target = lazy.querySelector(':scope > [data-equity-lazy-detail]');
  assert.equal(target.innerHTML, '');
  const spy = app.spy(['equityLazyDisclosureMarkup']);
  try {
    lazy.open = true;
    lazy.dispatchEvent(new app.window.Event('toggle'));
    assert.equal(target.dataset.rendered, 'true');
    assert.ok(target.innerHTML);
    lazy.dispatchEvent(new app.window.Event('toggle'));
    assert.equal(spy.count('equityLazyDisclosureMarkup'), 1, 'rendered once');
  } finally {
    spy.restore();
  }
  // Re-rendering restores the open disclosure with its detail.
  const key = [lazy.dataset.equityDisclosure, lazy.dataset.playerId, lazy.dataset.outcomeKind || ''].join('|');
  app.call('renderEquityHandAnalysis');
  const reopened = app.byId('equityHandAnalysisContent').querySelectorAll('details[data-equity-disclosure]')
    .find((details) => [details.dataset.equityDisclosure, details.dataset.playerId, details.dataset.outcomeKind || ''].join('|') === key);
  assert.equal(reopened.open, true);
  assert.equal(reopened.querySelector(':scope > [data-equity-lazy-detail]').dataset.rendered, 'true');
  // Structural outs never render read-only card rows inline.
  const projection = app.call('equityAnalysisProjection');
  const cards = app.spy(['equityReadOnlyCardsMarkup']);
  try {
    for (const player of projection.players) app.call('equityStructuralOutsMarkup', player);
    assert.equal(cards.count('equityReadOnlyCardsMarkup'), 0);
  } finally {
    cards.restore();
  }
  // Card removal is demoted to the further-analysis section.
  assert.ok(indexDocument().getElementById('equityFurtherAnalysisContent'));
  const removal = app.spy(['equityCardRemovalMarkup']);
  try {
    app.call('renderEquityHandAnalysis');
    assert.deepEqual(removal.calls.equityCardRemovalMarkup.map(([facts]) => facts), projection.players.map((player) => player.facts));
  } finally {
    removal.restore();
  }
  assert.ok(app.byId('equityFurtherAnalysisContent').innerHTML);
  assert.equal(content.querySelector('.equity-card-removal, [data-dossier-section="card-removal"]'), null);
});

test('frozen proportions favor the right dossier and player headers are compact and aligned', async () => {
  await calculated([['As', 'Ah'], ['Ks', 'Kh'], ['Qs', 'Qh']], ['Qc', '7d', '2s']);
  const at = (selector) => app.$(selector);
  // (Superseded: EQUITY-COMPOSITION-001R's three-column workspace and
  // 28/96/56 card rows were replaced by the later two-column canvas with a
  // fixed 152px body row; the dossier column remains the right-hand column.)
  assert.equal(css.cascaded(at('.equity-workspace'), 'grid-template-columns', W), 'minmax(0, 1fr) minmax(330px, .42fr)');
  const card = at('.equity-player-card');
  assert.equal(css.cascaded(card, 'grid-template-rows', W), '28px 152px minmax(56px, auto)');
  assert.equal(css.cascaded(card, 'row-gap', W), 'var(--space-1)');
  const head = at('.equity-player-head');
  assert.equal(css.cascaded(head, 'min-block-size', W), '28px');
  assert.equal(css.cascaded(head, 'align-items', W), 'center');
  const identity = at('.equity-player-identity');
  assert.deepEqual(['min-block-size', 'display', 'align-items', 'padding-block'].map((property) => css.cascaded(identity, property, W)), ['26px', 'flex', 'center', '0']);
  assert.equal(css.cascaded(at('.equity-player-identity .series-marker'), 'align-self', W), 'center');
  const name = at('.equity-player-name');
  // SAVED-COMPOSITION-002 amendment: literal weights are role tokens.
  assert.deepEqual(['height', 'padding', 'font-weight', 'line-height'].map((property) => css.cascaded(name, property, W)), ['26px', '0 var(--space-2)', 'var(--weight-title)', '24px']);
  const remove = at('.equity-player-head .remove-player');
  assert.ok(remove, 'a removable player shows its control in the header');
  // (Superseded: the later Equity header rule places the control in the
  // header's second column, first row, instead of grid-column: auto.)
  assert.equal(css.cascaded(remove, 'grid-column', W), '2');
  assert.equal(css.cascaded(remove, 'grid-row', W), '1');
  assert.equal(css.cascaded(remove, 'min-height', W), '26px');
  // (Superseded: the body's top padding is now 0 under the fixed body row.)
  assert.equal(css.cascaded(at('.equity-player-body'), 'padding-block-start', W), '0');
  // A completed result never re-shows the setup overview.
  assert.equal(app.byId('equityMode').closest('[data-equity-state]')?.dataset.equityState ?? equity().lifecycle, 'complete');
  assert.equal(css.cascaded(at('.equity-overview-panel'), 'display', W), 'none');
});

test('private-hand commits avoid Board and Dead rebuilds and dense picker updates only the changed control', async () => {
  await app.navigate('equity');
  app.call('resetEquityCalculator');
  await app.settle(100);
  const [hero] = equity().players.map(({ id }) => id);
  const spy = app.spy(['setEquityPending', 'renderEquityPlayers', 'renderEquityCardCounts', 'renderEquitySharedCards', 'clearEquityResults', 'updateDeckCardStates']);
  try {
    await app.click(`[data-equity-edit-hand="${hero}"]`);
    spy.reset();
    // Selecting a card updates only that deck control and keeps focus on it.
    await app.click('[data-deck-card="As"]');
    assert.deepEqual(spy.calls.updateDeckCardStates.map(([cards]) => Array.from(cards)), [['As']]);
    assert.ok(app.document.activeElement === app.$('[data-deck-card="As"]'));
    await app.click('[data-deck-card="Ah"]');
    spy.reset();
    await app.click('#cardSetPickerApply');
    await app.settle(200);
    // Committing a private hand re-renders players only.
    assert.equal(spy.calls.setEquityPending.at(-1)[0].renderInputs, 'players');
    assert.ok(spy.count('renderEquityPlayers') >= 1);
    assert.ok(spy.count('renderEquityCardCounts') >= 1);
    assert.equal(spy.count('renderEquitySharedCards'), 0);
    assert.equal(spy.calls.clearEquityResults.at(-1)[2].renderPlayerFooters, false);
    assert.ok(spy.calls.updateDeckCardStates.every(([cards]) => cards.length <= 2), 'only changed controls');
  } finally {
    spy.restore();
  }
  // The dense picker paints flat, static deck controls.
  await app.click(`[data-equity-edit-hand="${hero}"]`);
  const modal = app.byId('cardModal');
  assert.equal(css.cascaded(modal, 'backdrop-filter', W), 'none');
  const deckCard = app.$('#cardModal .deck-card');
  assert.equal(css.cascaded(deckCard, 'box-shadow', W), 'none');
  assert.equal(css.cascaded(deckCard, 'transition', W), 'none');
  const disabled = app.document.createElement('button');
  disabled.className = 'deck-card';
  disabled.disabled = true;
  deckCard.parentElement.appendChild(disabled);
  try {
    assert.equal(css.cascaded(disabled, 'filter', W), 'none');
    assert.equal(css.cascaded(disabled, 'opacity', W), '.42');
  } finally {
    disabled.remove();
    await app.click('#closeModal');
  }
});

test('right analysis is quantitative preflop and uses one Board band plus responsive player cards postflop', () => {
  const preflop = createEquityHandAnalysisProjection({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: ['Js', 'Ts'] }],
    board: [],
    deadCards: [],
  });
  assert.equal(preflop.players[0].facts.exactHand.preflopHandClass, 'AKs');
  assert.equal(preflop.exactOutcomes.available, false);
  assert.equal(preflop.exactOutcomes.reason, 'insufficient_board');

  assert.equal(app.evaluate('typeof equityCurrentMatchupMarkup'), 'undefined');
});

test('the rendered dossier shows quantitative equity, one Board band and responsive player cards', async () => {
  // Preflop: quantitative equity per player, no "complete the flop" filler.
  let content = await calculated([['As', 'Ah'], ['Ks', 'Kh']], []);
  assert.doesNotMatch(text(content), /Complete the flop to compare entered exact hands/);
  for (const player of equity().lastResult.players) {
    const markup = fragment(app.call('equityAnalysisEquityMarkup', player.id));
    const percent = player.equity * 100;
    assert.equal(markup.querySelector('.equity-analysis-bar').getAttribute('aria-hidden'), 'true');
    assert.equal(markup.querySelector('.equity-analysis-bar > span').getAttribute('style'), `--equity-percent: ${percent.toFixed(3)}%`);
    assert.ok(markup.querySelector('strong.poker-data-token').textContent.includes(percent.toFixed(1)));
    const secondary = text(fragment(app.call('equityAnalysisSecondaryMetricsMarkup', player.id)));
    for (const value of [player.winProbability, player.tieProbability]) assert.ok(secondary.includes((value * 100).toFixed(1)), secondary);
  }
  // Postflop: one Board band; secondary metrics precede the current hand.
  content = await calculated([['As', 'Ah'], ['Ks', 'Kh'], ['Qs', 'Qh']], ['Qc', '7d', '2s']);
  assert.equal(content.querySelectorAll('[data-dossier-section="board-analysis"]').length, 1);
  const list = content.querySelector('.equity-player-analysis-list');
  assert.equal(list.dataset.playerCount, '3');
  const analysis = list.querySelector('.equity-player-analysis');
  const metrics = analysis.querySelector('.equity-analysis-secondary, [class*="secondary"]');
  const current = analysis.querySelector('[data-dossier-section="current-hand"]');
  assert.ok(metrics && current);
  assert.ok(analysis.innerHTML.indexOf(metrics.outerHTML) < analysis.innerHTML.indexOf(current.outerHTML));
  assert.equal(css.cascaded(list, 'grid-template-columns', W), 'repeat(2, minmax(0, 1fr))');
  const last = list.querySelector(':scope > .equity-player-analysis:last-child');
  assert.deepEqual(['grid-column', 'inline-size', 'justify-self'].map((property) => css.cascaded(last, property, W)), ['1 / -1', 'calc((100% - var(--space-2)) / 2)', 'center']);
  // (Superseded: the equity figure grew 1.55rem -> 1.9rem and the bar 7px -> 8px.)
  assert.equal(css.cascaded(content.querySelector('.equity-analysis-equity > strong'), 'font-size', W), '1.9rem');
  const figure = content.querySelector('.equity-analysis-equity');
  assert.equal(css.cascaded(figure, 'min-inline-size', W), '132px');
  assert.equal(css.cascaded(figure, 'gap', W), '3px var(--space-2)');
  assert.equal(css.cascaded(content.querySelector('.equity-analysis-bar'), 'block-size', W), '8px');
  const bar = content.querySelector('.equity-analysis-bar > span');
  assert.equal(css.cascaded(bar, 'inline-size', W), 'var(--equity-percent)');
  assert.equal(css.cascaded(bar, 'background', W), 'var(--series-color)');
  assert.equal(css.cascaded(content.querySelector('.equity-board-analysis-facts'), 'grid-template-columns', W), 'repeat(3, minmax(0, 1fr))');
  // Five or more players collapse into per-player disclosures.
  content = await calculated([['As', 'Ah'], ['Ks', 'Kh'], ['Qs', 'Qh'], ['Js', 'Jh'], ['Ts', 'Th']], ['2c', '7d', '3s']);
  assert.equal(content.querySelectorAll('details[data-equity-disclosure="player"]').length, 5);
});

test('the stale banner is global, explanatory, and absent from current analysis', async () => {
  const content = await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']);
  assert.equal(content.querySelector('.equity-analysis-stale'), null, 'current analysis has no banner');
  app.call('setEquityPending', {});
  const stale = app.byId('equityHandAnalysisContent');
  const banners = stale.querySelectorAll('.equity-analysis-stale');
  assert.equal(banners.length, 1);
  assert.equal(banners[0].getAttribute('role'), 'status');
  assert.equal(text(banners[0].querySelector('strong')), 'Analysis is out of date');
  assert.equal(text(banners[0].querySelector('span')), 'Inputs changed. Recalculate to update these results.');
  assert.ok(banners[0].parentElement === stale, 'the banner is global, not per player');
  for (const player of stale.querySelectorAll('.equity-player-analysis')) assert.doesNotMatch(text(player), /out of date/);
});

test('stale tiles and center status stay concise while the center owns recalculation', async () => {
  // Without a previous result, the center invites a first calculation.
  await app.navigate('equity');
  app.call('resetEquityCalculator');
  app.call('setEquityPending', {});
  assert.equal(app.byId('calculate').dataset.i18n, 'Calculate equity');
  assert.match(text(app.byId('equityMode')), /Inputs changed\. Calculate to refresh the result\./);
  // After a result, tiles say only "Stale" and the center owns Recalculate.
  await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']);
  app.call('setEquityPending', {});
  assert.equal(app.byId('calculate').dataset.i18n, 'Recalculate');
  assert.match(text(app.byId('equityMode')), /Results are stale\./);
  const tile = fragment(app.call('equityPlayerResultMarkup', equity().players[0], 0));
  assert.match(text(tile), /Stale/);
  assert.doesNotMatch(text(tile), /Stale result · recalculate|Recalculating · showing stale result/);
  const footer = app.$('.equity-player-footer[data-result-state="stale"]');
  assert.ok(footer);
  assert.equal(css.cascaded(footer.querySelector('.equity-result-metrics'), 'opacity', W), '.72');
});

test('unknown-opponent outcome copy is compact, truthful, and leaves structural analysis intact', async () => {
  const content = await calculated([['Ah', 'Kh'], null], ['Qh', 'Jh', '2c']);
  const unknown = content.querySelector('[data-outcome-state="unknown"]');
  assert.ok(unknown);
  assert.equal(text(unknown.querySelector('.equity-unknown-outcome strong')), 'Opponent unknown');
  assert.equal(text(unknown.querySelector('.equity-unknown-outcome span')), 'Exact catch-up analysis unavailable');
  assert.doesNotMatch(text(content), /Entered-hand outcome|without claiming exact winning outs/);
  // Structural analysis (completion cards) is still offered after the notice.
  const structural = content.querySelector('details[data-equity-disclosure="structural"]');
  assert.ok(structural, 'structural analysis remains');
  assert.ok(content.innerHTML.indexOf(unknown.outerHTML) < content.innerHTML.indexOf(structural.outerHTML));
  const notice = unknown.querySelector('.equity-unknown-outcome');
  assert.equal(css.cascaded(notice, 'display', W), 'flex');
  assert.equal(css.cascaded(notice, 'align-items', W), 'baseline');
});

test('status and exact next-card disclosures remain compact, contextual, and independent', async () => {
  const groups = (hands, board) => {
    const projection = createEquityHandAnalysisProjection({ players: hands.map((cards, index) => ({ id: `p${index}`, cards })), board, deadCards: [] });
    return projection.players.map((player) => fragment(app.call('equityExactOutcomeMarkup', player, projection.exactOutcomes)));
  };
  // Behind: catch-up cards, and still-behind improvements, keyed per player.
  const [leader, trailer] = groups([['As', 'Ah'], ['Ks', 'Qs']], ['Kh', '7s', '2s']);
  assert.equal(leader.querySelector('.equity-standing').dataset.standing, 'leading');
  assert.equal(trailer.querySelector('.equity-standing').dataset.standing, 'behind');
  assert.ok(text(trailer).includes(app.call('t', 'Catch-up cards')));
  const kinds = trailer.querySelectorAll('[data-outcome-kind]');
  assert.ok(kinds.length > 0);
  assert.ok(kinds.every((node) => node.dataset.playerId === 'p1'));
  // Tied: the winning group is labelled as cards that put this player ahead,
  // with tie cards listed separately.
  const [tied] = groups([['Ad', 'Kd'], ['Ac', 'Kc']], ['Qd', 'Jd', '2s']);
  assert.equal(tied.querySelector('.equity-standing').dataset.standing, 'tied');
  assert.ok(text(tied).includes(app.call('t', 'Cards that put this player ahead')));
  assert.ok(text(tied).includes(app.call('t', 'Tie cards')));
  // Multiway still-behind improvements are labelled as such.
  const multi = groups([['9h', '8h'], ['7d', 'Kc'], ['7s', '6c']], ['7h', '6h', '7c']);
  const stillBehind = app.call('t', 'Other improvements — still behind');
  assert.ok(multi.some((markup) => text(markup).includes(stillBehind)));
  // Board technical facts and card removal live in the further-analysis area.
  await calculated([['As', 'Ah'], ['Ks', 'Kh']], ['Qc', '7d', '2s']);
  const projection = app.call('equityAnalysisProjection');
  const spy = app.spy(['equityBoardTechnicalMarkup', 'equityCardRemovalMarkup']);
  try {
    app.call('renderEquityHandAnalysis');
    assert.deepEqual(spy.calls.equityBoardTechnicalMarkup.map(([facts]) => facts), [projection.globalFacts]);
    assert.equal(spy.count('equityCardRemovalMarkup'), projection.players.length);
  } finally {
    spy.restore();
  }
});

test('new calculated, stale, catch-up, and disclosure copy is present in both supported non-English catalogs', () => {
  for (const key of [
    'Calculated outcomes',
    'Calculate Equity to inspect entered-hand outcomes and detailed hand facts.',
    'Current matchup',
    'Catch-up cards',
    'Other improvements — still behind',
    'Exact structural completion cards',
    'Analysis is out of date',
    'Inputs changed. Recalculate to update these results.',
    'Results are stale.',
    'Opponent unknown',
    'Exact catch-up analysis unavailable',
    'Catch-up cards: ahead after this turn card; River remains.',
    'Board Analysis',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.ok((translations.match(new RegExp(`['"]${escaped}['"]`, 'g')) || []).length >= 2, key);
  }
});
