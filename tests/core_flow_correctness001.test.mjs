import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  createAction,
  getLegalActionSpec,
  hasRaisingRights,
  initializeHand,
  playerById,
} from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { createHomeGameApplication } from '../app/src/application/home-game-service.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';

const HOLE_DECK = Object.freeze([
  'As', 'Kh', 'Qd', 'Jc', 'Ts', '9h', '8d', '7c', '6s', '5h',
  '4d', '3c', '2s', 'Ah', 'Kd', 'Qc', 'Js', 'Th', '9d', '8c',
]);

function fakeWindow() {
  return {
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent() { return true; },
  };
}

function scenario() {
  return createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    lastActionLabel: 'Unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
}

function handConfiguration() {
  return {
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: ANTE_TYPES.NONE,
    anteBb: 0,
    straddleBb: 0,
  };
}

function cardsFor(playerCount) {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [
    `P${index}`,
    [HOLE_DECK[index * 2], HOLE_DECK[index * 2 + 1]],
  ]));
}

function initializedTable(playerCount, stacks = Array.from({ length: playerCount }, () => 100_000)) {
  return initializeHand({
    handId: `core-flow-correctness-${playerCount}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks[seat],
    })),
  });
}

function bettingTable(playerCount, stacks) {
  return applyChance(initializedTable(playerCount, stacks), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(playerCount),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function flopState(playerCount = 3, stacks) {
  let state = bettingTable(playerCount, stacks);
  while (state.phase === PHASES.BETTING) {
    const actor = playerById(state, state.actingPlayerId);
    state = act(state, actor.position === 'BB' ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL);
  }
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: ['2h', '3h', '4h'],
  });
}

function ids() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

test('a completed canonical Hand explicitly transitions to fresh setup and the next Hand gets a new identity', () => {
  const sourceIds = ['core-flow-first-hand', 'core-flow-second-hand'];
  const canonicalController = createCanonicalLiveController({ enabled: true });
  const bridge = installPlaybookStateSourceBridge(fakeWindow(), {
    canonicalController,
    handSourceIdFactory: () => sourceIds.shift(),
  });
  bridge.setMode('hand', scenario());

  bridge.initializeHand(handConfiguration());
  bridge.dealObservedHoleCards({ [canonicalController.getHeroPlayerId()]: ['As', 'Kd'] });
  const completed = bridge.applyAction(ACTION_TYPES.FOLD);
  const completedSnapshot = structuredClone(completed);
  const replaySource = bridge.createCanonicalHandReplaySource();
  const replaySnapshot = structuredClone(replaySource);
  const journal = bridge.getHeroDecisionJournal();
  const journalSnapshot = structuredClone(journal);

  assert.equal(completed.phase, PHASES.TERMINAL);
  assert.equal(bridge.getCanonicalHandSourceId(), 'core-flow-first-hand');
  assert.equal(bridge.getCompletedHandResult().handId, 'core-flow-first-hand');

  const transition = bridge.prepareNewHand();
  assert.deepEqual(transition, {
    previousHandId: 'core-flow-first-hand',
    status: 'ready_for_setup',
  });
  assert.equal(canonicalController.getState(), null);
  assert.equal(bridge.getCanonicalHandSourceId(), null);
  assert.equal(bridge.getCompletedHandResult(), null);
  const clearedReplay = bridge.createReplayProjectionViewModel();
  assert.equal(clearedReplay.totalFrameCount, 0);
  assert.equal(clearedReplay.timeline.empty, true);

  const next = bridge.initializeHand(handConfiguration());
  assert.equal(next.handId, 'core-flow-second-hand');
  assert.notEqual(next.handId, completed.handId);
  assert.equal(next.buttonSeat, completed.buttonSeat);
  assert.deepEqual(next.game, completed.game);
  assert.deepEqual(
    next.players.map((player) => player.startingStackMilliBb),
    completed.players.map((player) => player.startingStackMilliBb),
  );
  assert.equal(next.phase, PHASES.CHANCE);
  assert.equal(next.pendingChance.type, CHANCE_TYPES.DEAL_HOLE);
  assert.equal(bridge.getCanonicalHandSourceId(), 'core-flow-second-hand');
  assert.equal(bridge.prepareNewHand(), null, 'an active Hand cannot use the completion-only transition');

  assert.deepEqual(completed, completedSnapshot);
  assert.deepEqual(replaySource, replaySnapshot);
  assert.deepEqual(journal, journalSnapshot);
});

test('preflop minimum raise-to values follow the last full increment', () => {
  let state = bettingTable(6);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 2000);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 5000, '1 → 3 makes 5 the next minimum');

  state = bettingTable(6);
  state = act(state, ACTION_TYPES.RAISE, 7000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 6000);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 13_000, '1 → 7 makes 13 the next minimum');
  assert.throws(() => act(state, ACTION_TYPES.RAISE, 12_900), /outside legal raise-to bounds/);
  assert.equal(act(state, ACTION_TYPES.RAISE, 13_000).currentBetMilliBb, 13_000);

  state = bettingTable(6);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.RAISE, 8000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 5000);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 13_000, '1 → 3 → 8 makes 13 the next minimum');
});

test('postflop bet and raise sizing remains amount-to and uses the last full increment', () => {
  let state = flopState();
  state = act(state, ACTION_TYPES.BET, 5000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 5000);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 10_000);
  state = act(state, ACTION_TYPES.RAISE, 15_000);
  assert.equal(state.lastFullRaiseIncrementMilliBb, 10_000);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 25_000);
});

test('short all-ins preserve normal rights, reopening thresholds, and stack-bounded all-in legality', () => {
  let state = bettingTable(5, [100_000, 100_000, 100_000, 100_000, 4000]);
  state = act(state, ACTION_TYPES.RAISE, 3000); // P3; reopening threshold is 5bb.
  state = act(state, ACTION_TYPES.ALL_IN); // P4 to 4bb, a short raise.
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
  assert.equal(state.actionHistory.at(-1).reopenedBetting, false);
  assert.equal(hasRaisingRights(state, 'P0'), true, 'a player who has not acted retains raising rights');
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 6000);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.FOLD);
  assert.equal(state.actingPlayerId, 'P3');
  assert.equal(hasRaisingRights(state, 'P3'), false);
  assert.equal(getLegalActionSpec(state).raise.available, false);
  assert.equal(getLegalActionSpec(state).allIn.available, false);

  state = bettingTable(6, [100_000, 100_000, 100_000, 100_000, 4000, 5000]);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.ALL_IN); // to 4bb
  state = act(state, ACTION_TYPES.ALL_IN); // to 5bb; cumulative reopening threshold reached
  assert.equal(state.lastFullRaiseIncrementMilliBb, 2000);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
  assert.equal(state.actionHistory.at(-1).reopenedBetting, true);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.FOLD);
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.actingPlayerId, 'P3');
  assert.equal(hasRaisingRights(state, 'P3'), true);
  assert.equal(getLegalActionSpec(state).raise.minToMilliBb, 7000);

  state = bettingTable(2, [1300, 100_000]);
  const bounded = getLegalActionSpec(state);
  assert.equal(bounded.raise.available, false);
  assert.deepEqual(bounded.allIn, { available: true, amountToMilliBb: 1300 });
  state = act(state, ACTION_TYPES.ALL_IN);
  assert.equal(state.actionHistory.at(-1).wasFullRaise, false);
});

test('cash-out correction preserves the original and supports atomic replacement or reversal-only flows', async () => {
  const application = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'guest' }) },
    identityQueries: { getActiveIdentityId: async () => null },
    clock: () => '2026-08-27T12:00:00.000Z',
    idFactory: ids(),
  });
  let state = await application.createSession({
    title: 'Cash-out correction proof',
    currencyCode: 'ILS',
    currencyLabel: '₪',
    playerNames: ['Wrong replacement', 'Reversal only'],
    buyInMinor: 10_000,
  });
  const [replacementPlayer, reversalPlayer] = state.current.session.participants;
  const sessionId = state.current.session.sessionId;

  state = await application.cashOut({ sessionId, playerId: replacementPlayer.playerId, amountMinor: 7000 });
  const wrongReplacement = state.current.transactions.find((entry) => (
    entry.playerId === replacementPlayer.playerId && entry.type === 'cash_out'
  ));
  const wrongReplacementSnapshot = structuredClone(wrongReplacement);
  state = await application.correctTransaction({
    sessionId,
    transactionId: wrongReplacement.transactionId,
    replacementAmountMinor: 8000,
    note: 'Correct final count',
  });
  const replacementHistory = state.current.ledgerHistory.items.find((item) => (
    item.original.transactionId === wrongReplacement.transactionId
  ));
  assert.deepEqual(replacementHistory.original, wrongReplacementSnapshot);
  assert.equal(replacementHistory.corrected, true);
  assert.equal(replacementHistory.correction.amountMinor, wrongReplacement.amountMinor);
  assert.equal(replacementHistory.correction.note, 'Correct final count');
  assert.equal(replacementHistory.replacement.amountMinor, 8000);
  assert.equal(replacementHistory.replacement.replacementOfTransactionId, wrongReplacement.transactionId);
  assert.equal(replacementHistory.replacement.note, 'Replacement: Correct final count');
  assert.equal(state.current.accounting.participantResults.find((entry) => (
    entry.playerId === replacementPlayer.playerId
  )).totalOutMinor, 8000);

  state = await application.cashOut({ sessionId, playerId: reversalPlayer.playerId, amountMinor: 6000 });
  const wrongReversal = state.current.transactions.find((entry) => (
    entry.playerId === reversalPlayer.playerId && entry.type === 'cash_out'
  ));
  const beforeReversalCount = state.current.transactions.length;
  state = await application.correctTransaction({
    sessionId,
    transactionId: wrongReversal.transactionId,
    replacementAmountMinor: null,
  });
  const reversalHistory = state.current.ledgerHistory.items.find((item) => (
    item.original.transactionId === wrongReversal.transactionId
  ));
  assert.equal(state.current.transactions.length, beforeReversalCount + 1);
  assert.deepEqual(reversalHistory.original, wrongReversal);
  assert.equal(reversalHistory.corrected, true);
  assert.equal(reversalHistory.correction.note, null);
  assert.equal(reversalHistory.replacement, null);
  assert.equal(state.current.accounting.participantResults.find((entry) => (
    entry.playerId === reversalPlayer.playerId
  )).totalOutMinor, 0);
});

test('core-flow controls are discoverable, localized, keyboard-aware, and remain consumers of canonical rules', async () => {
  const [html, logic, bridge, bootstrap, service, css, productTranslations, homeGameTranslations] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-game-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/home-game-translations.js', import.meta.url), 'utf8'),
  ]);

  for (const id of [
    'handCompletedReviewButton',
    'handCompletedAnalysisButton',
    'handCompletedReplayButton',
    'handCompletedSaveButton',
    'handCompletedNewHandButton',
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*type="button"`));
  }
  assert.match(html, /id="handCompletedReviewButton"[^>]*class="[^"]*ui-button--primary[^"]*"/);
  assert.match(html, /id="handCompletedNewHandButton"[^>]*class="[^"]*ui-button--primary[^"]*"[^>]*data-i18n="Start new hand"/);
  for (const id of ['handCompletedAnalysisButton', 'handCompletedReplayButton', 'handCompletedSaveButton']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*class="[^"]*ui-button--secondary[^"]*"`));
  }
  assert.match(logic, /function prepareCanonicalNewHand\(\)[\s\S]*callPlaybookStateBridge\('prepareNewHand'\)[\s\S]*handStartButton/);
  assert.match(bridge, /prepareNewHand\(\)[\s\S]*phase !== 'terminal'[\s\S]*canonicalController\.reset\(\)[\s\S]*canonicalHandSourceId = null[\s\S]*replayController\.clear\(\)/);

  assert.match(logic, /function isPrivateHandCardSetGroup[\s\S]*group\.startsWith\('hand-seat-'\)/);
  assert.match(logic, /kind: 'private_hand'[\s\S]*requiredCount: 2[\s\S]*draft: definition\.committed\.slice\(\)/);
  assert.match(logic, /function applyCardSetPicker[\s\S]*replaceCardSetTarget\(picker, picker\.draft\.slice\(\)\)/);
  assert.match(logic, /function handleCardPickerKeydown\(event\)[\s\S]*event\.key === 'Escape'[\s\S]*event\.key !== 'Tab'/);
  assert.match(logic, /event\.stopPropagation\(\)[\s\S]*closePicker\(\)/);
  assert.match(logic, /knownOpponentsOpen[\s\S]*root\.querySelector\('\.hand-known-opponents'\)[\s\S]*knownOpponents\.open = knownOpponentsOpen/);

  assert.match(bootstrap, /correctionEligibleCashOut\(bundle, participant\.playerId\)[\s\S]*Correct cash-out[\s\S]*openCorrectionEditor\(cashOut, bundle\)/);
  assert.match(bootstrap, /function correctionEligibleEntries\(bundle\)[\s\S]*ledgerHistory\.items\.filter\(\(item\) => !item\.corrected\)/);
  assert.match(bootstrap, /function openCorrectionEntryChooser\(bundle\)[\s\S]*correctionEligibleEntries\(bundle\)[\s\S]*openCorrectionEditor\(item, bundle\)/);
  assert.match(bootstrap, /translate\(browserWindow, 'Correct entries'\)[\s\S]*openCorrectionEntryChooser\(bundle\)/);
  assert.match(bootstrap, /translatedLabel\('Reason \(optional\)'[\s\S]*note: reason\.input\.value\.trim\(\) \|\| null/);
  assert.doesNotMatch(bootstrap, /reason\.input\.required\s*=\s*true/);
  assert.match(service, /note: note \? `Replacement: \$\{note\}` : null/);
  assert.doesNotMatch(service, /Replacement entry|No reason supplied/);
  assert.match(bootstrap, /confirmDialog\.querySelectorAll\('\[data-home-game-was-disabled="false"\]'\)[\s\S]*control\.disabled = false/);
  assert.match(css, /\.home-game-final-state-actions\s*\{[^}]*display:\s*flex/);
  assert.match(homeGameTranslations, /'Correct cash-out': 'Исправить кэшаут'/);
  assert.match(homeGameTranslations, /'Correct cash-out': 'תיקון פדיון'/);
  assert.match(homeGameTranslations, /'Correct entries': 'Исправить записи'/);
  assert.match(homeGameTranslations, /'Correct entries': 'תיקון רשומות'/);
  assert.match(homeGameTranslations, /'Reason \(optional\)': 'Причина \(необязательно\)'/);
  assert.match(homeGameTranslations, /'Reason \(optional\)': 'סיבה \(אופציונלי\)'/);
  assert.match(productTranslations, /"Start new hand": "Начать новую раздачу"/);
  assert.match(productTranslations, /"Start new hand": "התחלת יד חדשה"/);

  assert.match(html, /data-i18n="Raise to">Raise to</);
  assert.match(html, /data-i18n="Canonical amount-to sizing">Canonical amount-to sizing</);
  const legalRenderer = logic.slice(
    logic.indexOf('function renderCanonicalLegalActions('),
    logic.indexOf('function canonicalHandStatus('),
  );
  assert.doesNotMatch(legalRenderer, /lastFullRaiseIncrementMilliBb|currentBetMilliBb\s*\+/);
  const sizingConsumer = logic.slice(
    logic.indexOf('function chooseCanonicalSizedAction('),
    logic.indexOf('function applyCanonicalHandAction('),
  );
  assert.match(sizingConsumer, /option\.minToMilliBb/);
  assert.match(sizingConsumer, /option\.maxToMilliBb/);
  assert.doesNotMatch(sizingConsumer, /lastFullRaiseIncrementMilliBb|currentBetMilliBb\s*\+/);
});
