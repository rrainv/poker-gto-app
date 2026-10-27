import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createEquityController } from '../app/src/application/equity-controller.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Equity workspace is driven in the booted app (players,
// pickers, board/dead counts, method/seed readiness, calculation metadata,
// progress, errors, reset), markup is parsed and styling resolved through the
// cascade.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const equityMarkup = markup.getElementById('equityMode');
const equity = () => app.window.app.equity;
const ids = () => equity().players.map(({ id }) => id);
// SOURCE-SHAPE: "the DESIGN-007 block uses theme tokens only (no literal hex
// colours)" is a policy lint over the block as authored (parsed).
const design = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('DESIGN-007: focused Equity workspace')) + 2;
  return new StyleSheetModel(raw.slice(start, raw.indexOf('/* EQUITY-UX-001R:')));
})();
await app.navigate('equity');
async function knownHands() {
  app.call('resetEquityCalculator');
  const [hero, villain] = ids();
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['As', 'Ah']);
  await app.click(`[data-equity-hand-mode="known"][data-player-id="${villain}"]`);
  await app.pickCards(`[data-equity-edit-hand="${villain}"]`, ['Ks', 'Kh']);
}

test('Equity workspace follows the intended input and result hierarchy', () => {
  const sections = [
    'id="equityPlayersTitle"',
    'id="equityCardsTitle"',
    'id="equityCalculationTitle"',
    'id="equityResultsTitle"',
    'id="equityDetails"',
  ];
  const nodes = sections.map((marker) => equityMarkup.querySelector(`#${marker.match(/id="([^"]+)"/)[1]}`));
  nodes.forEach((node, index) => assert.ok(node && (index === 0 || precedes(nodes[index - 1], node)), sections[index]));
  const workspace = equityMarkup.querySelector('.equity-workspace');
  assert.ok(workspace);
  assert.ok(css.cascaded(workspace, 'grid-template-columns', { width: 1600 }));
});

test('known and unknown hands are explicit and incomplete known hands block calculation', async () => {
  assert.equal(equityMarkup.querySelector('#calculate').disabled, true);
  app.call('resetEquityCalculator');
  assert.deepEqual(equity().players.map(({ handMode }) => handMode), ['known', 'unknown']);
  const [hero, villain] = ids();
  for (const id of [hero, villain]) {
    for (const mode of ['known', 'unknown']) assert.ok(app.$(`[data-equity-hand-mode="${mode}"][data-player-id="${id}"]`), `${id} ${mode}`);
  }
  // A known hand with one card is incomplete and blocks calculation.
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['As']);
  assert.equal(app.$(`#equityPlayers .equity-player-card[data-player-id="${hero}"], #equityPlayers .equity-player-card`).dataset.handState, 'incomplete');
  assert.equal(app.byId('calculate').disabled, true);
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['As', 'Ah']);
  assert.notEqual(app.$('#equityPlayers .equity-player-card').dataset.handState, 'incomplete');
  assert.equal(app.byId('calculate').disabled, false);
});

test('unknown hands use canonical card backs and known hands reuse the shared hand picker grammar', async () => {
  app.call('resetEquityCalculator');
  const [hero] = ids();
  const unknown = app.$(`#equityPlayers .equity-unknown-hand`);
  assert.ok(unknown, 'the unknown villain shows card backs');
  const back = unknown.querySelector('.poker-card-back.riverline-card-back');
  assert.ok(back);
  assert.ok(css.matchingRules(back).some((rule) => rule.selectorText.includes('.equity-unknown-hand .poker-card-back')));
  // Known hands open the shared private-hand picker on a draft; selecting
  // cards does not touch Equity until Apply.
  assert.ok(app.$(`[data-equity-edit-hand="${hero}"]`));
  assert.equal(app.call('isPrivateHandCardSetGroup', `equity-hand-${hero}`), true);
  await app.click(`[data-equity-edit-hand="${hero}"]`);
  const spy = app.spy(['renderEquityCards', 'setEquityPending', 'applyCardSetPicker']);
  try {
    await app.click('[data-deck-card="Qs"]');
    await app.click('[data-deck-card="Qd"]');
    assert.equal(spy.count('renderEquityCards') + spy.count('setEquityPending'), 0, 'selection edits only the draft');
    assert.deepEqual(equity().players[0].cards, []);
    await app.click('#cardSetPickerApply');
    assert.equal(spy.count('applyCardSetPicker'), 1);
  } finally {
    spy.restore();
  }
  assert.deepEqual(equity().players[0].cards, ['Qs', 'Qd']);
});

test('player management supports stable identities and bounded 2 through 10 counts', async () => {
  for (const count of [2, 6, 10]) assert.ok(equityMarkup.querySelector(`[data-equity-player-count="${count}"]`), count);
  app.call('resetEquityCalculator');
  const confirm = app.window.confirm;
  let prompts = 0;
  app.window.confirm = () => { prompts += 1; return true; };
  try {
    await app.click('#equityAddPlayer');
    assert.deepEqual(ids(), ['equity-player-0', 'equity-player-1', 'equity-player-2']);
    for (let index = 0; index < 10; index += 1) await app.click('#equityAddPlayer');
    assert.equal(equity().players.length, 10, 'at most 10 players');
    // Only players beyond the first two can be removed; removal never asks.
    assert.equal(app.$$('[data-remove-player]').length, 8);
    assert.equal(app.$('[data-remove-player="0"], [data-remove-player="1"]'), null);
    const before = ids();
    await app.click('[data-remove-player="2"]');
    assert.deepEqual(ids(), before.filter((id) => id !== before[2]), 'identities are stable');
    assert.equal(prompts, 0);
  } finally {
    app.window.confirm = confirm;
  }
});

test('board and dead-card controls expose counts, arbitrary board entry, and clear', async () => {
  const boardCount = equityMarkup.querySelector('#equityBoardCount');
  assert.ok(equityMarkup.querySelector('[data-slots="eqboard"]'));
  const clearBoard = equityMarkup.querySelector('[data-card-clear-command="clear_board"][data-card-clear-surface="equity"]');
  assert.ok(boardCount && clearBoard && precedes(boardCount, clearBoard));
  const copy = text(equityMarkup);
  assert.ok(copy.indexOf('Flop') < copy.indexOf('Turn') && copy.indexOf('Turn') < copy.indexOf('River'));
  assert.match(copy, /Street labels are visual guides only/);
  assert.ok(equityMarkup.querySelector('#equityDeadCount'));
  assert.ok(equityMarkup.querySelector('[data-card-clear-command="clear_dead_set"][data-card-clear-surface="equity"]'));
  app.call('resetEquityCalculator');
  await app.pickCards('[data-card-set-edit="eqboard"]', ['2c', '3d', '4h']);
  await app.pickCards('[data-card-set-edit="eqdead"]', ['9c']);
  assert.match(text(app.byId('equityBoardCount')), /^3 \/ 5$/);
  assert.match(text(app.byId('equityDeadCount')), /\b1\b/);
  await app.click('[data-card-clear-command="clear_board"][data-card-clear-surface="equity"]');
  assert.equal(equity().board.filter(Boolean).length, 0);
  assert.match(text(app.byId('equityBoardCount')), /\b0\b/);
});

test('method controls retain canonical request values and approved sample choices', async () => {
  const methods = equityMarkup.querySelector('#calcStyle').querySelectorAll('option').map((option) => option.value);
  assert.deepEqual(methods.sort(), ['auto', 'exact', 'sim']);
  const samples = equityMarkup.querySelector('#trials').querySelectorAll('option').map((option) => Number(option.value));
  for (const value of [10000, 50000, 100000, 250000]) assert.ok(samples.includes(value), value);
  await knownHands();
  for (const [control, method] of [['auto', 'auto'], ['exact', 'exact'], ['sim', 'monte_carlo']]) {
    app.byId('calcStyle').value = control;
    const request = app.call('equityRequestFromCurrentInputs');
    assert.equal(request.schemaVersion, 'equity-request/v1');
    assert.equal(request.method, method);
  }
  app.byId('calcStyle').value = 'auto';
});

test('canonical estimator drives workload, Auto method disclosure, and exact-limit readiness', async () => {
  assert.ok(equityMarkup.querySelector('#equityEstimate'));
  assert.ok(equityMarkup.querySelector('#equityDetailEstimate'));
  await knownHands();
  const spy = app.spy(['callEquityServiceBridge']);
  try {
    app.byId('calcStyle').value = 'auto';
    app.call('updateEquityReadiness');
    assert.ok(spy.calls.callEquityServiceBridge.some(([method]) => method === 'estimate'));
  } finally {
    spy.restore();
  }
  // Auto discloses the method the canonical estimate makes feasible.
  const disclosure = () => {
    const estimate = app.call('callEquityServiceBridge', 'estimate', app.call('equityRequestFromCurrentInputs'));
    return estimate.exactFeasible ? /Auto will use exact enumeration/ : /Auto will use Monte Carlo/;
  };
  assert.match(text(app.byId('equityEstimate')), disclosure());
  // Preflop full runouts exceed the exact limit: Exact is refused.
  app.byId('calcStyle').value = 'exact';
  app.call('updateEquityReadiness');
  assert.match(text(app.byId('equityReadiness')), /Exact enumeration exceeds the safe workload limit/);
  assert.equal(app.byId('calculate').disabled, true);
  // On a flop, exact enumeration is feasible and offered.
  await app.pickCards('[data-card-set-edit="eqboard"]', ['2c', '3d', '4h']);
  app.call('updateEquityReadiness');
  assert.match(text(app.byId('equityReadiness')), /exact enumeration/);
  assert.equal(app.byId('calculate').disabled, false);
  app.byId('calcStyle').value = 'auto';
  app.call('updateEquityReadiness');
  assert.match(text(app.byId('equityEstimate')), disclosure());
});

test('seed is optional, validated as uint32, and forwarded without changing request schema', async () => {
  assert.equal(equityMarkup.querySelector('#equitySeed').getAttribute('max'), '4294967295');
  assert.ok(equityMarkup.querySelector('#rerollEquitySeed'));
  await knownHands();
  const seed = app.byId('equitySeed');
  seed.value = '';
  assert.equal('seed' in app.call('equityRequestFromCurrentInputs'), false, 'optional');
  seed.value = '42';
  assert.equal(app.call('equityRequestFromCurrentInputs').seed, 42);
  for (const invalid of ['1.5', '-1', '4294967296']) {
    seed.value = invalid;
    app.call('updateEquityReadiness');
    assert.match(text(app.byId('equityReadiness')), /Seed must be a whole number/, invalid);
    assert.equal(app.byId('calculate').disabled, true, invalid);
  }
  seed.value = '4294967295';
  app.call('updateEquityReadiness');
  assert.equal(app.byId('calculate').disabled, false);
  seed.value = '';
  app.call('updateEquityReadiness');
});

test('results prioritize equity while preserving per-player win and tie detail and order', async () => {
  assert.equal(equityMarkup.querySelector('#headlineEquity, #equityBars, .equity-result-card, #equitySum'), null);
  assert.equal(text(equityMarkup.querySelector('#equityHandAnalysisTitle')), 'Hand Analysis');
  assert.doesNotMatch(text(equityMarkup), /Total equity/);
  assert.ok(equityMarkup.querySelector('#equitySplitSummary'));
  await knownHands();
  await app.click('#calculate');
  for (let round = 0; round < 30 && equity().lifecycle === 'running'; round += 1) await app.settle(500);
  assert.equal(equity().lifecycle, 'complete');
  // Each tile's footer reports its own player's result, in player order.
  const result = equity().lastResult;
  app.$$('#equityPlayers .equity-player-card').forEach((tile, index) => {
    assert.equal(tile.dataset.playerSeries, String(index));
    const player = result.players.find(({ id }) => id === equity().players[index].id);
    const values = tile.querySelectorAll('.equity-result-metrics strong').map((node) => text(node));
    // The app formats with Intl.NumberFormat (LOCALE-NUMBERS-001), whose rounding
    // can differ from toFixed on a borderline value such as 81.85.
    assert.deepEqual(values, [player.equity, player.winProbability, player.tieProbability].map((value) => app.call('formatUiPercent', value * 100, 1)));
    assert.equal(text(tile.querySelector('.equity-result-primary > span')), 'Equity');
  });
  const overview = equity().players.map((player, index) => app.call('equityOverviewPlayerMarkup', player, index));
  assert.ok(overview.every((entry) => /equity-overview-player/.test(entry)));
  assert.equal(app.$('#equityMode #equitySum, #equityMode [id*="equityTotal"]'), null);
});

test('results avoid repeating the visible setup scenario', () => {
  assert.equal(equityMarkup.querySelector('#equityScenarioContext, #equityScenarioTitle, .equity-scenario'), null);
  for (const id of ['methodBadge', 'equitySplitSummary', 'equityDetails']) assert.ok(equityMarkup.querySelector(`#${id}`), id);
});

test('actual method, samples, seed, unknown count, board count, and execution are visible metadata', async () => {
  for (const id of [
    'equityDetailRequested', 'equityDetailActual', 'equityDetailEstimate',
    'equityDetailSamples', 'equityDetailSeed', 'equityDetailUnknown',
    'equityDetailBoard', 'equityDetailExecution',
  ]) assert.ok(equityMarkup.querySelector(`#${id}`), id);
  await knownHands();
  app.byId('calcStyle').value = 'auto';
  await app.click('#calculate');
  for (let round = 0; round < 30 && equity().lifecycle === 'running'; round += 1) await app.settle(500);
  // Auto discloses the requested → actual method; execution names the runner.
  assert.match(text(app.byId('methodBadge')), / → /);
  assert.match(text(app.byId('equityDetailExecution')), /^(?:Web Worker|In-process fallback)$/);
  assert.equal(text(app.byId('equityDetailExecution')), app.call('callEquityServiceBridge', 'isWorkerBacked') ? 'Web Worker' : 'In-process fallback');
});

test('running, progress, cancellation, stale-result, and structured error states are explicit', async () => {
  const progress = equityMarkup.querySelector('#progress');
  assert.equal(progress.hidden, true);
  assert.equal(progress.dataset.progressMode, 'indeterminate');
  assert.equal(progress.querySelector('.progress-track').getAttribute('role'), 'progressbar');
  assert.equal(equityMarkup.querySelector('[aria-valuenow="0"]'), null);
  assert.ok(progress.querySelector('.progress-fill'));
  assert.equal(progress.querySelector('.progress-percent').hidden, true);
  assert.equal(equityMarkup.querySelector('#cancelEquity').hidden, true);
  // Running clears to a running state; progress appears only after a short
  // reveal delay; Cancel is offered while running.
  await knownHands();
  app.byId('calcStyle').value = 'sim';
  const spy = app.spy(['clearEquityResults']);
  try {
    await app.click('#calculate');
    assert.equal(spy.calls.clearEquityResults[0]?.[0], 'running');
  } finally {
    spy.restore();
  }
  assert.equal(app.byId('progress').hidden, true, 'not shown instantly');
  await app.settle(app.evaluate('EQUITY_PROGRESS_REVEAL_DELAY_MS') + 10);
  if (equity().lifecycle === 'running') {
    assert.equal(app.byId('progress').hidden, false);
    assert.equal(app.byId('cancelEquity').hidden, false);
  }
  for (let round = 0; round < 60 && equity().lifecycle === 'running'; round += 1) await app.settle(500);
  app.byId('calcStyle').value = 'auto';
  // Every structured error code has its own message.
  const messages = ['invalid_request', 'duplicate_card', 'impossible_deck', 'exact_limit_exceeded', 'aborted', 'internal_error']
    .map((code) => app.call('equityFailureMessage', { code }));
  assert.equal(new Set(messages).size, 6);
  assert.ok(messages.every((message) => message !== app.call('equityFailureMessage', { code: 'unknown_code' })));
});

test('reset is calculator-scoped and restores only Equity defaults', async () => {
  assert.ok(equityMarkup.querySelector('#resetEquity'));
  await knownHands();
  await app.pickCards('[data-card-set-edit="eqboard"]', ['2c', '3d', '4h']);
  const scoped = { gto: app.window.app.gto, training: app.window.app.training, decisionContext: app.window.app.decisionContext };
  const gtoSnapshot = JSON.stringify(app.window.app.gto);
  await app.click('#resetEquity');
  assert.deepEqual(equity().board, []);
  assert.deepEqual(equity().players.map(({ id, handMode, cards }) => [id, handMode, cards.length]), [['equity-player-0', 'known', 0], ['equity-player-1', 'unknown', 0]]);
  assert.equal(app.window.app.gto, scoped.gto);
  assert.equal(JSON.stringify(app.window.app.gto), gtoSnapshot);
  assert.equal(app.window.app.training, scoped.training);
  assert.equal(app.window.app.decisionContext, scoped.decisionContext);
});

test('responsive, theme-token, keyboard-focus, reduced-motion, and RTL safeguards remain present', () => {
  // Responsive rules exist at each supported width.
  for (const width of [1024, 768, 480]) {
    assert.ok(css.rules.some((rule) => rule.conditions.some(({ query }) => query.includes(`max-width: ${width}px`))), width);
  }
  const button = markup.createElement('button');
  equityMarkup.appendChild(button);
  assert.ok(css.matchingRules(button, { states: ['focus-visible'], stateElement: button }).some((rule) => rule.selectorText.includes('#equityMode button:focus-visible')));
  button.remove();
  const card = markup.createElement('div');
  card.className = 'equity-player-card';
  equityMarkup.appendChild(card);
  markup.documentElement.setAttribute('dir', 'rtl');
  assert.ok(css.matchingRules(card).some((rule) => rule.selectorText.includes('[dir="rtl"] .equity-player-card')));
  markup.documentElement.setAttribute('dir', 'ltr');
  card.remove();
  assert.ok(css.rules.some((rule) => rule.conditions.some(({ query }) => query.includes('prefers-reduced-motion: reduce'))));
  for (const rule of design.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b/i, rule.selectorText);
  }
});

test('interactive controls retain accessible names, relationships, and pressed states', async () => {
  assert.equal(equityMarkup.querySelector('#calculate').getAttribute('aria-describedby'), 'equityReadiness equityEstimate');
  app.call('resetEquityCalculator');
  await app.click('#equityAddPlayer');
  const remove = app.$('[data-remove-player="2"]');
  assert.equal(remove.getAttribute('aria-label'), `Remove ${app.call('equityPlayerLabel', 2)}`);
  for (const id of ids()) {
    const known = app.$(`[data-equity-hand-mode="known"][data-player-id="${id}"]`);
    const unknown = app.$(`[data-equity-hand-mode="unknown"][data-player-id="${id}"]`);
    assert.notEqual(known.getAttribute('aria-pressed'), unknown.getAttribute('aria-pressed'));
  }
  app.call('renderEquityProgress', { mode: 'determinate', method: 'exact', completed: 1, total: 4, fraction: 0.25, percentage: 25 });
  assert.equal(app.$('#progress .progress-track').getAttribute('aria-valuenow'), '25');
  app.call('resetEquityCalculator');
});

test('Equity UI delegates poker math and retains the accepted Advanced Equity range surface', () => {
  assert.ok(equityMarkup.querySelector('#advancedEquityWorkspace'));
  assert.doesNotMatch(equityMarkup.outerHTML, /Playbook|Training|PokerState|DecisionContext/i);
  for (const name of ['scoreFive', 'scoreSeven', 'evaluateSeven', 'calculatePreflopFallbackStrategy']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
});

test('controller estimator delegates to the canonical domain implementation', () => {
  const controller = createEquityController({ workerFactory: () => null });
  const estimate = controller.estimate({
    schemaVersion: 'equity-request/v1',
    players: [
      { id: 'hero', cards: ['As', 'Ah'] },
      { id: 'villain', cards: ['Ks', 'Kh'] },
    ],
    board: ['2c', '3d', '4h', '5s'],
    deadCards: [],
    method: 'auto',
    samples: 10_000,
    seed: 7,
  });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.combinations, 44);
  assert.equal(estimate.exactFeasible, true);
});
