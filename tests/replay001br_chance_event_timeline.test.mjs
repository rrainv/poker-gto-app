import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  initializeHand,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import { appStyleSheet, bootApp, indexDocument, strategyProviderProbe } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: the logic.js replay renderer and state-change listener
// run in the booted app (spies, DOM-query counters, a provider probe) and the
// RTL rule is read through the cascade, instead of regex-matching sources.
const probe = strategyProviderProbe();
const page = await bootApp({ beforeScripts: probe.beforeScripts });

const HERO_CARDS = Object.freeze(['As', 'Ad']);
const VILLAIN_CARDS = Object.freeze(['Kh', 'Kd']);
const BOARD = Object.freeze(['2c', '3c', '4c', '9s', 'Jc']);

function configuration({ stacks = [100_000, 100_000], handId = 'replay-001br' } = {}) {
  return {
    handId,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacks.map((startingStackMilliBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  };
}

function act(state, type) {
  return applyAction(state, createAction(state.actingPlayerId, type));
}

function createJournal(options = {}) {
  let liveState = initializeHand(configuration(options));
  const controller = createReplayProjectionController({
    getLiveState: () => liveState,
    getHeroPlayerId: () => 'P0',
  });
  controller.replaceHand({
    state: liveState,
    heroPlayerId: 'P0',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  return {
    controller,
    state: () => liveState,
    transition(nextState, operation) {
      liveState = nextState;
      return controller.recordTransition({ state: liveState, heroPlayerId: 'P0', operation });
    },
  };
}

function dealKnown(journal) {
  return journal.transition(applyChance(journal.state(), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HERO_CARDS, P1: VILLAIN_CARDS },
  }), REPLAY_FRAME_OPERATIONS.DEAL_HOLE);
}

function dealObserved(journal) {
  return journal.transition(applyChance(journal.state(), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HERO_CARDS },
    hiddenPlayerIds: ['P1'],
  }), REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED);
}

function recordAction(journal, type) {
  return journal.transition(act(journal.state(), type), REPLAY_FRAME_OPERATIONS.ACTION);
}

function recordBoard(journal, type, cards) {
  return journal.transition(
    applyChance(journal.state(), { type, cards }),
    REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
  );
}

function allItems(projection) {
  return projection.timeline.groups.flatMap((group) => group.items);
}

function transitions(projection) {
  return allItems(projection).filter((item) => item.itemKind === 'transition');
}

function runCheckedThroughHand({ observed = false } = {}) {
  const journal = createJournal({ handId: observed ? 'observed-showdown' : 'checked-through' });
  if (observed) dealObserved(journal);
  else dealKnown(journal);
  recordAction(journal, ACTION_TYPES.CALL);
  recordAction(journal, ACTION_TYPES.CHECK);
  for (const [type, cards] of [
    [CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3)],
    [CHANCE_TYPES.DEAL_TURN, [BOARD[3]]],
    [CHANCE_TYPES.DEAL_RIVER, [BOARD[4]]],
  ]) {
    recordBoard(journal, type, cards);
    recordAction(journal, ACTION_TYPES.CHECK);
    recordAction(journal, ACTION_TYPES.CHECK);
  }
  if (observed) {
    journal.transition(
      applyPrivateReveal(journal.state(), { playerId: 'P1', cards: VILLAIN_CARDS }),
      REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
    );
  }
  journal.transition(resolveShowdown(journal.state()), REPLAY_FRAME_OPERATIONS.SHOWDOWN);
  return journal;
}

test('all-in flop runout exposes Turn, River, and Showdown events even without later actions', () => {
  const journal = createJournal({ stacks: [10_000, 10_000], handId: 'all-in-runout' });
  dealKnown(journal);
  recordAction(journal, ACTION_TYPES.CALL);
  recordAction(journal, ACTION_TYPES.CHECK);
  recordBoard(journal, CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3));
  recordAction(journal, ACTION_TYPES.ALL_IN);
  recordAction(journal, ACTION_TYPES.CALL);
  recordBoard(journal, CHANCE_TYPES.DEAL_TURN, [BOARD[3]]);
  recordBoard(journal, CHANCE_TYPES.DEAL_RIVER, [BOARD[4]]);
  const projection = journal.transition(
    resolveShowdown(journal.state()),
    REPLAY_FRAME_OPERATIONS.SHOWDOWN,
  );

  assert.deepEqual(projection.timeline.groups.map((group) => group.street), [
    'preflop', 'flop', 'turn', 'river', 'showdown',
  ]);
  assert.deepEqual(
    projection.timeline.groups.find((group) => group.street === 'turn').items
      .map((item) => item.transitionKind),
    ['turn_deal'],
  );
  assert.deepEqual(
    projection.timeline.groups.find((group) => group.street === 'river').items
      .map((item) => item.transitionKind),
    ['river_deal'],
  );
  assert.deepEqual(
    projection.timeline.groups.find((group) => group.street === 'showdown').items
      .map((item) => item.transitionKind),
    ['showdown_resolution'],
  );
  assert.deepEqual(
    transitions(projection).filter((item) => item.cards.length > 0)
      .map((item) => item.cards.map((card) => card.token)),
    [['2♣', '3♣', '4♣'], ['9♠'], ['J♣']],
  );
});

test('normal hand keeps actions chronological and emits every canonical marker exactly once', () => {
  const projection = runCheckedThroughHand().controller.getProjection();
  const actions = allItems(projection).filter((item) => item.itemKind === 'action');
  const eventKinds = transitions(projection).map((item) => item.transitionKind);

  assert.deepEqual(actions.map((entry) => entry.sequence), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(actions.every((entry) => entry.source === 'canonical_action_history'), true);
  assert.deepEqual(eventKinds, [
    'initialization', 'private_deal', 'flop_deal', 'turn_deal', 'river_deal',
    'showdown_resolution',
  ]);
  assert.equal(new Set(allItems(projection).map((item) => item.frameIndex)).size, allItems(projection).length);
  assert.equal(projection.timeline.entryCount, 8);
  assert.equal(projection.timeline.transitionCount, 6);
  assert.equal(projection.timeline.itemCount, 14);
});

test('preflop terminal hand stays bounded to preflop and does not invent later events', () => {
  const journal = createJournal({ handId: 'preflop-fold' });
  dealKnown(journal);
  const projection = recordAction(journal, ACTION_TYPES.FOLD);

  assert.deepEqual(projection.timeline.groups.map((group) => group.street), ['preflop']);
  assert.deepEqual(allItems(projection).map((item) => item.itemKind), [
    'transition', 'transition', 'action',
  ]);
  assert.equal(projection.timeline.currentMarker.kind, 'terminal');
  assert.equal(projection.timeline.currentMarkerGroup, 'preflop');
  assert.equal(transitions(projection).some((item) => item.cards.length > 0), false);
});

test('private deal marker carries no hidden opponent cards or private-card presentation facts', () => {
  const journal = createJournal({ handId: 'private-deal-privacy' });
  const projection = dealObserved(journal);
  const privateDeal = transitions(projection).find((item) => item.transitionKind === 'private_deal');

  assert.deepEqual(privateDeal.cards, []);
  assert.equal(privateDeal.cardVisibility, 'none');
  assert.equal(projection.tablePresence.seats.find((seat) => seat.playerId === 'P1').cardVisibility, 'hidden');
  assert.doesNotMatch(JSON.stringify(projection.timeline), /Kh|Kd|K♥|K♦/);
});

test('private reveal and showdown transitions appear once without publishing private cards as event tokens', () => {
  const projection = runCheckedThroughHand({ observed: true }).controller.getProjection();
  const showdownTransitions = projection.timeline.groups
    .find((group) => group.street === 'showdown').transitions;

  assert.deepEqual(showdownTransitions.map((item) => item.transitionKind), [
    'private_reveal', 'showdown_resolution',
  ]);
  assert.equal(showdownTransitions.every((item) => item.cards.length === 0), true);
  assert.equal(projection.timeline.currentMarkerGroup, 'showdown');
});

test('cursor selection marks the corresponding chance event current and keeps table projection synchronized', () => {
  const journal = runCheckedThroughHand();
  let projection = journal.controller.previous();
  while (projection.selectedFrame.kind !== 'turn_deal') projection = journal.controller.previous();

  const currentItems = allItems(projection).filter((item) => item.presentationState === 'current');
  assert.equal(currentItems.length, 1);
  assert.equal(currentItems[0].transitionKind, 'turn_deal');
  assert.equal(projection.timeline.selectedTransition.transitionKind, 'turn_deal');
  assert.equal(projection.timeline.showCurrentMarker, false);
  assert.deepEqual(projection.tablePresence.board.map((card) => card.id), BOARD.slice(0, 4));
  assert.equal(projection.timeline.completedItemCount + projection.timeline.currentItemCount
    + projection.timeline.futureItemCount, projection.timeline.itemCount);

  projection = journal.controller.returnToLive();
  assert.equal(projection.timeline.currentItemCount, 0);
  assert.equal(projection.timeline.completedItemCount, projection.timeline.itemCount);
  assert.equal(projection.timeline.showCurrentMarker, true);
});

test('Replay projection and cursor operations never mutate canonical actionHistory', () => {
  const journal = runCheckedThroughHand();
  const before = structuredClone(journal.state().actionHistory);
  journal.controller.previous();
  journal.controller.previous();
  journal.controller.next();
  journal.controller.returnToLive();
  assert.deepEqual(journal.state().actionHistory, before);
});

test('renderer consumes projected event facts without reconstructing transitions from raw state or DOM', () => {
  const event = {
    transitionKind: 'flop_deal', presentationState: 'current', frameIndex: 3, labelKey: 'replay.transition.flopDeal',
    cardVisibility: 'public_board', cards: [{ rank: 'T', suit: 's' }, { rank: '7', suit: 'h' }, { rank: '2', suit: 'd' }],
  };
  // Reads made by page code are limited to the projected event's own facts.
  const reads = new Set();
  const tracked = new Proxy(event, { get(target, key, receiver) {
    if ((new Error().stack.split('\n')[2] || '').includes('core/logic.js')) reads.add(key);
    return Reflect.get(target, key, receiver);
  } });
  const document = page.document;
  const queries = { count: 0 };
  const originals = [document.querySelector, document.querySelectorAll];
  document.querySelector = function (...args) { queries.count += 1; return originals[0].apply(this, args); };
  document.querySelectorAll = function (...args) { queries.count += 1; return originals[1].apply(this, args); };
  const spy = page.spy(['callPlaybookStateBridge']);
  let entry;
  try {
    entry = page.call('createReplayTransitionEntry', tracked);
  } finally {
    document.querySelector = originals[0];
    document.querySelectorAll = originals[1];
    spy.restore();
  }
  assert.equal(queries.count, 0, 'no DOM reconstruction');
  assert.equal(spy.count('callPlaybookStateBridge'), 0, 'no raw state reads');
  for (const key of reads) assert.ok(Object.hasOwn(event, key), `reads only event facts (${String(key)})`);
  assert.ok(reads.has('transitionKind') && reads.has('cards'));
  assert.equal(entry.dataset.transitionKind, 'flop_deal');
  const tokens = [...entry.querySelectorAll('.replay-transition-card')];
  assert.deepEqual(tokens.map((token) => token.dataset.cardSuitId), event.cards.map((card) => page.window.RiverlineCardPresentation.cardSuitPresentation(card.suit).id));
  assert.equal(tokens[0].textContent, `${page.evaluate("displayCardRank('T')")}${page.window.RiverlineCardPresentation.cardSuitPresentation('s').symbol}`);
});

test('cursor rendering bypasses strategy and Equity, with localized Showdown and LTR card tokens', async () => {
  const translations = fs.readFileSync(
    new URL('../app/src/locales/analysis-translations.js', import.meta.url),
    'utf8',
  );
  // Replay and saved-hand state changes stop before any decision, Home or
  // Hand-workspace refresh.
  const spy = page.spy(['updateContext', 'scheduleHomeRefresh', 'renderCanonicalHandWorkspace']);
  try {
    const resolves = await probe.count(async () => {
      for (const operation of ['replay_seek', 'replay_return', 'saved_hand_close']) {
        page.window.dispatchEvent(new page.window.CustomEvent('riverline:playbook-state-change', { detail: { operation } }));
        await page.settle(100);
      }
    });
    assert.equal(resolves.length, 0);
    assert.equal(spy.count('updateContext'), 0);
    assert.equal(spy.count('scheduleHomeRefresh'), 0);
  } finally {
    spy.restore();
  }
  for (const key of [
    'replay.street.showdown', 'replay.transition.flopDeal', 'replay.transition.turnDeal',
    'replay.transition.riverDeal', 'replay.transition.privateReveal',
    'replay.transition.showdown',
  ]) {
    assert.equal(
      (translations.match(new RegExp(`'${key.replaceAll('.', '\\.')}'?:`, 'g')) || []).length,
      3,
      `${key} must exist in EN/RU/HE`,
    );
  }
  // Board card tokens are an LTR island, also under RTL.
  const entry = page.call('createReplayTransitionEntry', {
    transitionKind: 'turn_deal', presentationState: 'past', frameIndex: 1, labelKey: 'replay.transition.turnDeal',
    cardVisibility: 'public_board', cards: [{ rank: 'K', suit: 'c' }],
  });
  const cards = entry.querySelector('.replay-transition-cards');
  assert.equal(cards.dir, 'ltr');
  const markup = indexDocument();
  const host = markup.getElementById('handActionHistory') || markup.body;
  const probeCards = markup.createElement('span');
  probeCards.className = 'replay-transition-cards';
  host.appendChild(probeCards);
  markup.documentElement.setAttribute('dir', 'rtl');
  try {
    assert.equal(appStyleSheet().cascaded(probeCards, 'direction'), 'ltr');
  } finally {
    markup.documentElement.removeAttribute('dir');
    probeCards.remove();
  }
});
