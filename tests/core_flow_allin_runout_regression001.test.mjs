import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  PHASES,
  getAvailableChanceCards,
} from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createReplayProjectionController } from '../app/src/application/replay-projection-controller.mjs';
import { createProductionPickerHarness } from './uiqa001r_card_picker_adapter.mjs';

const FLOP = Object.freeze(['Js', '7d', '2c']);
const HOLE_CARDS = Object.freeze({
  'seat-0': Object.freeze(['Ah', 'Ad']),
  'seat-1': Object.freeze(['Kh', 'Kd']),
});

function cardControl(markup, card) {
  return markup.match(new RegExp(`<button[^>]+data-deck-card="${card}"[^>]*>`))?.[0] || '';
}

function createHeadsUpController() {
  const controller = createCanonicalLiveController({
    enabled: true,
    handIdFactory: () => 'core-flow-allin-runout-regression-001',
  });
  controller.initialize({
    tableSize: 2,
    gameMode: 'home',
    stackBb: 10,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  });
  assert.ok(controller.dealObservedHoleCards(HOLE_CARDS), controller.getDiagnostics().error?.message);
  return controller;
}

function reachFlopAllInRunout(controller) {
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CALL }));
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CHECK }));
  assert.ok(controller.dealBoardCards(FLOP));
  assert.ok(controller.applyAction({ type: ACTION_TYPES.ALL_IN }));
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CALL }));
  const state = controller.getState();
  assert.equal(state.phase, PHASES.CHANCE);
  assert.equal(state.pendingChance.type, 'deal_turn');
  assert.equal(state.actingPlayerId, null);
  assert.deepEqual(state.players.map((player) => player.currentStackMilliBb), [0, 0]);
  return state;
}

test('canonical chance candidates exclude board, known holes, dead cards, and pending cards', () => {
  const controller = createHeadsUpController();
  const waitingTurn = reachFlopAllInRunout(controller);
  const withDeadCard = structuredClone(waitingTurn);
  withDeadCard.deadCards = ['9h'];

  const available = getAvailableChanceCards(withDeadCard, ['Qc']);
  assert.equal(available.length, 43);
  for (const consumed of [...FLOP, ...HOLE_CARDS['seat-0'], ...HOLE_CARDS['seat-1'], '9h', 'Qc']) {
    assert.equal(available.includes(consumed), false, consumed);
  }
  assert.equal(new Set(available).size, available.length);
  assert.throws(() => getAvailableChanceCards(withDeadCard, ['Js']), /Duplicate known card: Js/);
  assert.throws(() => getAvailableChanceCards(withDeadCard, ['Qc', 'Qc']));
});

test('fully known browser hole deal records the canonical fully known Replay operation', () => {
  const controller = createCanonicalLiveController({
    enabled: true,
    handIdFactory: () => 'core-flow-allin-known-browser-deal',
  });
  const browserWindow = {
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    dispatchEvent() {},
  };
  const bridge = installPlaybookStateSourceBridge(browserWindow, {
    canonicalController: controller,
    handSourceIdFactory: () => 'core-flow-allin-known-browser-deal',
  });
  assert.ok(bridge.initializeHand({
    tableSize: 2,
    gameMode: 'home',
    stackBb: 10,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  }));
  const dealt = bridge.dealObservedHoleCards(HOLE_CARDS);
  assert.equal(dealt.phase, PHASES.BETTING);
  assert.equal(bridge.getState().players.every((player) => Array.isArray(player.holeCards)), true);
});

test('HU flop all-in uses explicit legal runout once and terminal Replay agrees with live state', () => {
  const controller = createHeadsUpController();
  const waitingTurn = reachFlopAllInRunout(controller);
  const turnCandidates = controller.getAvailableChanceCards();

  const turnPicker = createProductionPickerHarness({
    handMode: true,
    canonicalState: waitingTurn,
    canonicalAvailableChanceCards: turnCandidates,
  });
  turnPicker.app.playbookHandDraft.board.push('Js');
  turnPicker.openPicker('hand-board-chance', 0);
  assert.deepEqual([...turnPicker.app.playbookHandDraft.board], []);
  assert.deepEqual([...turnPicker.app.picker.draft], []);
  const turnDeck = turnPicker.deckMarkup();
  for (const consumed of [...FLOP, ...HOLE_CARDS['seat-0'], ...HOLE_CARDS['seat-1']]) {
    assert.match(cardControl(turnDeck, consumed), /disabled/, consumed);
    assert.equal(turnPicker.selectCard(consumed), false, consumed);
  }
  assert.doesNotMatch(cardControl(turnDeck, 'Qs'), /disabled/);
  assert.equal(turnPicker.selectCard('Qs'), true);
  assert.equal(turnPicker.selectCard('Qs'), true);
  assert.deepEqual([...turnPicker.app.picker.draft], []);
  assert.equal(turnPicker.selectCard('Qs'), true);
  assert.deepEqual([...turnPicker.app.picker.draft], ['Qs']);
  assert.equal(turnPicker.apply(), true);
  assert.deepEqual([...turnPicker.app.playbookHandDraft.board], ['Qs']);

  assert.ok(controller.dealBoardCards(turnPicker.app.playbookHandDraft.board));
  assert.equal(controller.getState().pendingChance.type, 'deal_river');
  assert.ok(controller.dealBoardCards(['9c']));
  assert.equal(controller.getState().phase, PHASES.SHOWDOWN);
  assert.equal(controller.getState().actingPlayerId, null);
  assert.ok(controller.resolveShowdown());

  const terminalState = controller.getState();
  assert.equal(terminalState.phase, PHASES.TERMINAL);
  assert.equal(terminalState.terminal.reason, 'showdown');
  assert.deepEqual(terminalState.board, [...FLOP, 'Qs', '9c']);
  assert.equal(new Set([
    ...terminalState.board,
    ...terminalState.players.flatMap((player) => player.holeCards),
  ]).size, 9);

  const source = controller.createCanonicalHandReplaySource();
  const boardEvents = source.events.filter((event) => event.operation === 'deal_board');
  assert.deepEqual(
    boardEvents.map((event) => event.payload.chanceEvent.cards),
    [FLOP, ['Qs'], ['9c']],
  );
  assert.equal(boardEvents.length, 3);

  const liveSnapshot = structuredClone(terminalState);
  const replay = createReplayProjectionController({
    getLiveState: () => controller.getState(),
    getHeroPlayerId: () => controller.getHeroPlayerId(),
  });
  replay.replaceFromCanonicalHandReplaySource(source);
  const prior = replay.previous();
  assert.equal(prior.readOnly, true);
  assert.equal(prior.canReturnToLive, true);
  assert.deepEqual(controller.getState(), liveSnapshot);
  const returned = replay.returnToLive();
  assert.equal(returned.atLive, true);
  assert.equal(returned.selectedPhase, PHASES.TERMINAL);
  assert.deepEqual(controller.getState(), liveSnapshot);
});
