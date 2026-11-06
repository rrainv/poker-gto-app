import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fullHandActionForKey,
  projectFullHandSizes,
  projectFullHandTickets,
} from '../app/src/application/full-hand-decision-dock.mjs';
import { bootApp, text } from './helpers/app-under-test.mjs';

// TRAINING-FULLHAND-001: the Full Hand decision dock ("felt apron").

const legal = (overrides = {}) => ({
  fold: { available: true },
  check: { available: false },
  call: { available: true, toCallMilliBb: 1000, commitMilliBb: 1000 },
  bet: { available: false },
  raise: { available: true, minToMilliBb: 2000, maxToMilliBb: 29_000 },
  allIn: { available: true, amountToMilliBb: 30_000 },
  ...overrides,
});

test('tickets follow the canonical legal-action spec in table order, with the keyboard contract keys', () => {
  const tickets = projectFullHandTickets(legal());
  assert.deepEqual(tickets.map((ticket) => ticket.type), ['fold', 'call', 'raise', 'all_in']);
  assert.deepEqual(tickets.map((ticket) => ticket.key), ['F', 'C', 'R', 'A']);
  assert.equal(tickets[1].amountMilliBb, 1000);
  assert.equal(tickets[3].amountMilliBb, 30_000);
  assert.deepEqual(tickets[2].range, { minToMilliBb: 2000, maxToMilliBb: 29_000 });
  assert.equal(tickets[2].sized, true);
  assert.deepEqual(projectFullHandTickets(null), []);
  // Unavailable actions never appear; check replaces call.
  const free = projectFullHandTickets(legal({
    fold: { available: false }, check: { available: true }, call: { available: false },
    raise: { available: false }, bet: { available: true, minToMilliBb: 1000, maxToMilliBb: 9000 },
  }));
  assert.deepEqual(free.map((ticket) => ticket.type), ['check', 'bet', 'all_in']);
  assert.equal(free[1].key, 'B');
});

test('keys: F fold, C check or call, B or R bet or raise, A all-in', () => {
  const types = ['fold', 'call', 'raise', 'all_in'];
  assert.equal(fullHandActionForKey('f', types), 'fold');
  assert.equal(fullHandActionForKey('C', types), 'call');
  assert.equal(fullHandActionForKey('r', types), 'raise');
  assert.equal(fullHandActionForKey('b', types), 'raise', 'B reaches the sized aggressive action');
  assert.equal(fullHandActionForKey('a', types), 'all_in');
  assert.equal(fullHandActionForKey('x', types), null);
  assert.equal(fullHandActionForKey('f', ['call', 'raise']), null, 'never selects an action that is not legal');
});

test('the ladder lists canonical presets with their domain facts and leaves all-in to its own ticket', () => {
  const model = {
    actions: {
      raise: {
        presets: [
          { presetId: 'minimum', kind: 'amount_to', amountToMilliBb: 2000, potShare: 0.5, sprAfterCalled: 14.2 },
          { presetId: 'open-3', kind: 'amount_to', amountToMilliBb: 3000, potShare: 1, sprAfterCalled: null },
          { presetId: 'all-in', kind: 'all_in', amountToMilliBb: 30_000, potShare: 9, sprAfterCalled: 0 },
        ],
      },
    },
  };
  const sizes = projectFullHandSizes(model, 'raise');
  assert.deepEqual(sizes.map((size) => size.presetId), ['minimum', 'open-3']);
  assert.equal(sizes[0].sprAfterCalled, 14.2);
  assert.equal(sizes[1].sprAfterCalled, null, 'unknown SPR stays null, never zero');
  assert.deepEqual(projectFullHandSizes(model, 'bet'), []);
});

// ── the mounted dock in the booted app ────────────────────────────────────────
const app = await bootApp();
const key = (name) => app.dispatch(app.window.document, new app.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
const workspace = () => app.$('.training-workspace');
const tickets = () => app.$$('#trainingFullHandTickets .rl-action-card');
// Amounts are LRI/PDI isolated inside the sentence (Hebrew); compare the visible words.
const confirmLabel = () => text(app.byId('trainingFullHandConfirm')).replace(/[⁦⁩]/g, '').replace(/Enter$/, '').trim();

async function toHeroDecision() {
  app.window.localStorage.removeItem('riverline_training_answer_mode');
  await app.training.start('full_hand');
  for (let round = 0; round < 60 && !(workspace().dataset.trainingState === 'ready' && tickets().length); round += 1) await app.settle(500);
  assert.ok(tickets().length >= 2, 'Hero reached a decision');
}

test('the dock mounts once with the controller contract and answers in select + confirm', async () => {
  await toHeroDecision();
  const controller = app.evaluate('fullHandDockController');
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) assert.equal(typeof controller[method], 'function', method);
  assert.equal(app.byId('trainingFullHandActionDock').hidden, false);
  assert.equal(app.byId('trainingFullHandActionDock').dataset.fhState, 'decision');
  // The header alone names the state, and the price is shown beside the pot.
  assert.match(text(app.byId('workspaceContext')), /Full Hand · Your turn/);
  assert.match(text(app.byId('trainingFullHandPrice')), /To call|Nothing to call/);
  assert.equal(confirmLabel(), 'Choose an action');
  assert.equal(app.byId('trainingFullHandConfirm').disabled, true);
  const spy = app.spy(['handleFullHandTrainingGuess']);
  try {
    key('c');
    assert.ok(/^Confirm (Call|Check)/.test(confirmLabel()), confirmLabel());
    assert.equal(spy.count('handleFullHandTrainingGuess'), 0, 'selecting never answers in select + confirm');
    key('Enter');
    await app.settle(200);
    assert.equal(spy.count('handleFullHandTrainingGuess'), 1, 'Enter confirms');
  } finally {
    spy.restore();
  }
});

test('digits pick sizes only once a sized action is selected; Escape drops the selection', async () => {
  for (let round = 0; round < 120 && !(workspace().dataset.trainingState === 'ready' && tickets().length); round += 1) await app.settle(500);
  const sized = tickets().find((ticket) => ['bet', 'raise'].includes(ticket.dataset.action));
  if (!sized) return; // this deal offers no sized action; the ladder is covered by the sizing tests
  key('1');
  assert.equal(app.$('#trainingFullHandActionDock .rl-ladder'), null, 'a digit alone selects nothing');
  key('r');
  const ladder = app.$('#trainingFullHandActionDock .rl-ladder');
  assert.ok(ladder);
  assert.equal(confirmLabel(), 'Choose a size');
  key('1');
  assert.match(confirmLabel(), /^Confirm (Bet|Raise) .+ bb$/);
  assert.equal(ladder.querySelector('.rl-ladder__size[aria-pressed="true"]')?.dataset.sizeIndex, '0');
  key('Escape');
  assert.equal(app.$('#trainingFullHandActionDock .rl-ladder'), null);
  assert.equal(app.byId('trainingFullHandConfirm').disabled, true);
});

test('one click answers at once for plain actions and on a size for raises', async () => {
  app.evaluate('quickDrillController.answerStore().setMode("one_click")');
  try {
    for (let round = 0; round < 120 && !(workspace().dataset.trainingState === 'ready' && tickets().length); round += 1) await app.settle(500);
    const spy = app.spy(['handleFullHandTrainingGuess']);
    try {
      const sized = tickets().find((ticket) => ['bet', 'raise'].includes(ticket.dataset.action));
      if (sized) {
        key('r');
        assert.equal(spy.count('handleFullHandTrainingGuess'), 0, 'choosing a raise waits for a size');
        assert.equal(app.byId('trainingFullHandConfirm').hidden, true, 'Confirm is hidden in one click');
        key('1');
        assert.equal(spy.count('handleFullHandTrainingGuess'), 1, 'a size answers');
        const [type, amount] = spy.calls.handleFullHandTrainingGuess[0];
        assert.ok(['bet', 'raise'].includes(type));
        assert.ok(Number.isSafeInteger(amount) && amount > 0, 'the amount is canonical milliBb');
      } else {
        key('c');
        assert.equal(spy.count('handleFullHandTrainingGuess'), 1);
      }
    } finally {
      spy.restore();
    }
  } finally {
    app.evaluate('quickDrillController.answerStore().setMode("select")');
  }
});

test('a Hero fold is not "Hand complete": the header says opponents are paused', async () => {
  await app.settle(1000);
  await app.training.start('full_hand');
  for (let round = 0; round < 60 && !(workspace().dataset.trainingState === 'ready' && tickets().length); round += 1) await app.settle(500);
  const fold = tickets().find((ticket) => ticket.dataset.action === 'fold');
  if (!fold) return;
  await app.click(fold);
  await app.training.confirmFullHand();
  for (let round = 0; round < 60 && workspace().dataset.trainingFullHandPhase !== 'complete'; round += 1) await app.settle(500);
  assert.equal(workspace().dataset.trainingFullHandPhase, 'complete');
  const header = text(app.byId('workspaceContext'));
  assert.match(header, /You folded\. Opponents are paused/);
  assert.doesNotMatch(header, /Hand complete/i);
  assert.equal(app.byId('trainingWatchRest').hidden, false, 'Watch rest of hand stays one click away');
  assert.equal(app.byId('trainingFullHandActionDock').hidden, true, 'the dock steps aside after the hand');
});

test('the empty state is designed: two cards with one back, one line, one accent action', async () => {
  await app.navigate('training');
  await app.training.selectMode('full_hand');
  const empty = app.byId('trainingFullHandEmpty');
  assert.ok(empty);
  assert.equal(empty.querySelectorAll('.riverline-card-back-art').length, 1, 'exactly one card back');
  assert.equal(empty.querySelectorAll('.rl-fh-empty__face').length, 1, 'and one face-up card in front');
  assert.equal(empty.querySelectorAll('.rl-fh-empty__line').length, 1);
  assert.equal(empty.querySelectorAll('button').length, 1);
  assert.ok(empty.querySelector('button').classList.contains('ui-button--primary'));
  // One accent action per view: the setup rail's Start button is not accent-filled in Full Hand idle.
  assert.ok(!app.byId('trainingNewHand').classList.contains('ui-button--primary'));
});
