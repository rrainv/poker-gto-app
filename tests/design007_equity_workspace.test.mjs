import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createEquityController } from '../app/src/application/equity-controller.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

const equityHtml = html.slice(
  html.indexOf('id="equityMode"'),
  html.indexOf('id="infoMode"'),
);
const equityLogic = logic.slice(
  logic.indexOf('function equityRequestFromCurrentInputs'),
  logic.indexOf('function syncSliderPair'),
);

test('Equity workspace follows the intended input and result hierarchy', () => {
  const sections = [
    'id="equityPlayersTitle"',
    'id="equityCardsTitle"',
    'id="equityCalculationTitle"',
    'id="equityResultsTitle"',
    'id="equityDetails"',
  ];
  let previous = -1;
  for (const marker of sections) {
    const index = equityHtml.indexOf(marker);
    assert.ok(index > previous, marker);
    previous = index;
  }
  assert.match(equityHtml, /class="equity-workspace"/);
  assert.match(css, /\.equity-workspace\s*\{[\s\S]*grid-template-columns:/);
});

test('known and unknown hands are explicit and incomplete known hands block calculation', () => {
  assert.match(logic, /handMode: 'known'/);
  assert.match(logic, /handMode: 'unknown'/);
  assert.match(logic, /data-equity-hand-mode="known"/);
  assert.match(logic, /data-equity-hand-mode="unknown"/);
  assert.match(logic, /data-hand-state="\$\{handState\}"/);
  assert.match(equityLogic, /player\.cards !== null && player\.cards\.length !== 2/);
  assert.match(equityHtml, /id="calculate"[^>]+disabled/);
});

test('unknown hands use canonical card backs and known hands reuse the shared hand picker grammar', () => {
  assert.match(logic, /class="poker-card-back riverline-card-back"/);
  assert.match(logic, /data-equity-edit-hand="\$\{player\.id\}"/);
  assert.match(logic, /function openEquityHandPicker/);
  assert.match(logic, /function isPrivateHandCardSetGroup/);
  assert.match(logic, /draft: definition\.committed\.slice\(\)/);
  assert.match(logic, /function applyCardSetPicker/);
  const selection = logic.slice(logic.indexOf('function selectCard'), logic.indexOf('function cardSetPickerFocusTarget'));
  assert.doesNotMatch(selection, /renderEquityCards|setEquityPending/);
  assert.match(css, /\.equity-unknown-hand \.poker-card-back/);
});

test('player management supports stable identities and bounded 2 through 10 counts', () => {
  assert.match(logic, /id: \`equity-player-\$\{app\.equity\.nextPlayerId\+\+\}\`/);
  assert.match(logic, /Math\.max\(2, Math\.min\(10/);
  assert.match(logic, /if \(app\.equity\.players\.length >= 10\)/);
  assert.match(logic, /if \(playerIndex < 2/);
  assert.doesNotMatch(logic.slice(
    logic.indexOf('function renderEquityPlayers'),
    logic.indexOf('function updateActionOptions'),
  ), /confirm\(/);
  for (const count of [2, 6, 10]) assert.match(equityHtml, new RegExp(`data-equity-player-count="${count}"`));
});

test('board and dead-card controls expose counts, arbitrary board entry, and clear', () => {
  assert.match(equityHtml, /id="equityBoardCount"/);
  assert.match(equityHtml, /data-slots="eqboard"/);
  assert.match(equityHtml, /id="equityBoardCount"[\s\S]*data-card-clear-command="clear_board" data-card-clear-surface="equity"/);
  assert.match(equityHtml, /Flop[\s\S]*Turn[\s\S]*River/);
  assert.match(equityHtml, /Street labels are visual guides only/);
  assert.match(equityHtml, /id="equityDeadCount"/);
  assert.match(equityHtml, /data-card-clear-command="clear_dead_set" data-card-clear-surface="equity"/);
  assert.match(logic, /app\.equity\.board\.filter\(Boolean\)\.length/);
  assert.match(logic, /app\.equity\.dead\.filter\(Boolean\)\.length/);
});

test('method controls retain canonical request values and approved sample choices', () => {
  assert.match(equityHtml, /value="auto"/);
  assert.match(equityHtml, /value="exact"/);
  assert.match(equityHtml, /value="sim"/);
  for (const samples of [10000, 50000, 100000, 250000]) {
    assert.match(equityHtml, new RegExp(`value="${samples}"`));
  }
  assert.match(equityLogic, /sim: 'monte_carlo'/);
  assert.match(equityLogic, /schemaVersion: 'equity-request\/v1'/);
});

test('canonical estimator drives workload, Auto method disclosure, and exact-limit readiness', () => {
  assert.match(equityLogic, /callEquityServiceBridge\('estimate'/);
  assert.match(equityLogic, /estimate\.exactFeasible \? 'exact enumeration' : 'Monte Carlo'/);
  assert.match(equityLogic, /requestedMethod === 'exact' && !estimate\.exactFeasible/);
  assert.match(equityHtml, /id="equityEstimate"/);
  assert.match(equityHtml, /id="equityDetailEstimate"/);
});

test('seed is optional, validated as uint32, and forwarded without changing request schema', () => {
  assert.match(equityHtml, /id="equitySeed"[^>]+max="4294967295"/);
  assert.match(equityHtml, /id="rerollEquitySeed"/);
  assert.match(equityLogic, /request\.seed = Number\(seedInput\)/);
  assert.match(equityLogic, /Number\.isInteger\(seedNumber\)/);
  assert.match(equityLogic, /seedNumber > 0xffffffff/);
});

test('results prioritize equity while preserving per-player win and tie detail and order', () => {
  assert.doesNotMatch(equityHtml, /id="headlineEquity"/);
  assert.match(equityHtml, /id="equityHandAnalysisTitle"[^>]*>Hand Analysis/);
  assert.doesNotMatch(equityHtml, /id="equityBars"|class="equity-result-card"/);
  assert.doesNotMatch(equityHtml, /id="equitySum"|Total equity/);
  assert.match(equityHtml, /id="equitySplitSummary"/);
  assert.match(logic, /lastResult\?\.players\?\.find\(\(\{ id \}\) => id === player\.id\)/);
  assert.match(logic, /app\.equity\.players[\s\S]*?\.map\(\(player, playerIndex\) => equityOverviewPlayerMarkup\(player, playerIndex\)\)/s);
  assert.match(logic, /function equityPlayerResultMarkup\(player, playerIndex\)/);
  assert.match(logic, /class="equity-result-primary"><span>\$\{t\('Equity'\)\}<\/span>/);
  assert.match(logic, /<span>\$\{t\('Win'\)\}<\/span><strong class="poker-data-token">\$\{winValue\}<\/strong>/);
  assert.match(logic, /<span>\$\{t\('Tie'\)\}<\/span><strong class="poker-data-token">\$\{tieValue\}<\/strong>/);
  assert.match(logic, /footer\.outerHTML = equityPlayerResultMarkup\(player, playerIndex\)/);
  assert.doesNotMatch(equityLogic, /equityTotal|#equitySum/);
  assert.match(logic, /data-player-series="\$\{playerIndex\}"/);
});

test('results avoid repeating the visible setup scenario', () => {
  assert.doesNotMatch(equityHtml, /equityScenarioContext|equityScenarioTitle|class="equity-scenario"/);
  assert.match(equityHtml, /id="methodBadge"/);
  assert.match(equityHtml, /id="equitySplitSummary"/);
  assert.match(equityHtml, /id="equityDetails"/);
});

test('actual method, samples, seed, unknown count, board count, and execution are visible metadata', () => {
  for (const id of [
    'equityDetailRequested', 'equityDetailActual', 'equityDetailEstimate',
    'equityDetailSamples', 'equityDetailSeed', 'equityDetailUnknown',
    'equityDetailBoard', 'equityDetailExecution',
  ]) assert.match(equityHtml, new RegExp(`id="${id}"`), id);
  assert.match(equityLogic, /\$\{requestedLabel\} → \$\{actualLabel\}/);
  assert.match(equityLogic, /Web Worker/);
  assert.match(equityLogic, /In-process fallback/);
});

test('running, progress, cancellation, stale-result, and structured error states are explicit', () => {
  assert.match(equityHtml, /id="progress"[^>]+hidden/);
  assert.match(equityHtml, /id="progress"[^>]+data-progress-mode="indeterminate"/);
  assert.match(equityHtml, /class="progress-track"[^>]+role="progressbar"/);
  assert.doesNotMatch(equityHtml, /Preparing calculation…[\s\S]{0,180}>0%</);
  assert.doesNotMatch(equityHtml, /aria-valuenow="0"/);
  assert.match(equityHtml, /class="progress-fill"/);
  assert.match(equityHtml, /class="progress-percent" hidden/);
  assert.match(equityHtml, /id="cancelEquity"[^>]+hidden/);
  assert.match(equityLogic, /clearEquityResults\('running'/);
  assert.match(equityLogic, /EQUITY_PROGRESS_REVEAL_DELAY_MS/);
  assert.match(equityLogic, /generation === equityCalculationGeneration/);
  assert.match(equityLogic, /Inputs changed\. Calculate to refresh the result/);
  for (const code of [
    'invalid_request', 'duplicate_card', 'impossible_deck',
    'exact_limit_exceeded', 'aborted', 'internal_error',
  ]) assert.match(equityLogic, new RegExp(`${code}:`), code);
});

test('reset is calculator-scoped and restores only Equity defaults', () => {
  const reset = logic.slice(
    logic.indexOf('function resetEquityCalculator'),
    logic.indexOf('function syncSliderPair'),
  );
  assert.match(equityHtml, /id="resetEquity"/);
  assert.match(reset, /app\.equity\.board = \[\]/);
  assert.match(reset, /app\.equity\.players = \[/);
  assert.doesNotMatch(reset, /app\.gto|app\.training|PokerState|DecisionContext/);
});

test('responsive, theme-token, keyboard-focus, reduced-motion, and RTL safeguards remain present', () => {
  for (const width of ['1024px', '768px', '480px']) {
    assert.match(css, new RegExp(`max-width:\\s*${width}`));
  }
  assert.match(css, /#equityMode button:focus-visible/);
  assert.match(css, /\[dir="rtl"\] \.equity-player-card/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const start = css.indexOf('DESIGN-007: focused Equity workspace');
  const design = css.slice(start, css.indexOf('EQUITY-UX-001R:', start));
  assert.doesNotMatch(design, /#[0-9a-f]{3,8}\b/i);
});

test('interactive controls retain accessible names, relationships, and pressed states', () => {
  assert.match(equityHtml, /id="calculate"[^>]+aria-describedby="equityReadiness equityEstimate"/);
  assert.match(logic, /data-remove-player="\$\{playerIndex\}" aria-label="\$\{t\('Remove \{player\}'/);
  assert.match(logic, /data-equity-hand-mode="known"[^>]+aria-pressed=/);
  assert.match(logic, /data-equity-hand-mode="unknown"[^>]+aria-pressed=/);
  assert.match(equityLogic, /track\.setAttribute\('aria-valuenow'/);
});

test('Equity UI remains isolated from Playbook, Training, ranges, and poker math', () => {
  assert.doesNotMatch(equityHtml, /range|Playbook|Training|PokerState|DecisionContext/i);
  assert.doesNotMatch(equityLogic, /scoreFive|scoreSeven|evaluateSeven|calculatePreflop|StrategyResult/);
  assert.match(equityLogic, /callEquityServiceBridge\('calculate'/);
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
