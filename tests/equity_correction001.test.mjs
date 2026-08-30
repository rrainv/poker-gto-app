import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEquityHandEntryHarness,
  createProductionPickerHarness,
} from './uiqa001r_card_picker_adapter.mjs';

function cardControl(markup, card) {
  return markup.match(new RegExp(`<button[^>]+data-deck-card="${card}"[^>]*>`))?.[0] || '';
}

test('private hands expose one set editor with no numbered slot semantics, and Flop slots share one action label', () => {
  const picker = createProductionPickerHarness({ handMode: true });
  const privateEditor = picker.slotMarkup('hand-seat-0');
  assert.equal((privateEditor.match(/<button/g) || []).length, 1);
  assert.match(privateEditor, /data-card-set-edit="hand-seat-0"/);
  assert.doesNotMatch(privateEditor, /data-index|card 1|card 2|>1<|>2</i);

  const board = picker.slotMarkup('eqboard');
  assert.equal((board.match(/aria-label="Edit Flop"/g) || []).length, 1);
  assert.equal((board.match(/board-card-set-editor--flop/g) || []).length, 1);
  assert.equal((board.match(/class="card-slot/g) || []).length, 5);
  assert.doesNotMatch(board, /flop card [123]/i);

  const analyzePicker = createProductionPickerHarness();
  const analyzeBoard = analyzePicker.slotMarkup('board');
  assert.equal((analyzeBoard.match(/class="card-slot/g) || []).length, 5);
  assert.match(analyzeBoard, /board-card-set-editor--flop/);

  const fullHandBoard = picker.slotMarkup('hand-board-chance');
  assert.equal((fullHandBoard.match(/class="card-slot/g) || []).length, 3);
  assert.match(fullHandBoard, /board-card-set-editor--flop/);
});

test('one Equity hand-picker opening drafts two cards and Apply commits them atomically to readiness and request', () => {
  const equity = createEquityHandEntryHarness();

  assert.equal(equity.calculateDisabled(), true);
  const backgroundBeforeDraft = equity.render();
  assert.equal(equity.openHand('equity-player-0'), true);
  equity.selectCard('Kh');

  assert.deepEqual([...equity.app.equity.players[0].cards], []);
  assert.equal(equity.app.equity.lifecycle, 'idle');
  assert.equal(equity.render(), backgroundBeforeDraft);
  assert.equal(equity.modalOpen(), true);
  assert.match(equity.contextMarkup(), /K/);
  assert.equal(equity.applyDisabled(), true);
  assert.match(cardControl(equity.deckMarkup(), 'Kh'), /is-selected/);
  assert.equal(equity.readiness().state, 'blocked');

  equity.selectCard('Qh');

  assert.deepEqual([...equity.app.equity.players[0].cards], []);
  assert.equal(equity.app.equity.lifecycle, 'idle');
  assert.equal(equity.render(), backgroundBeforeDraft);
  assert.equal(equity.modalOpen(), true);
  assert.equal(equity.applyDisabled(), false);
  assert.match(equity.contextMarkup(), /K[\s\S]*Q/);
  assert.deepEqual([...equity.request().players[0].cards], []);
  assert.equal(equity.readiness().state, 'blocked');

  assert.equal(equity.apply(), true);
  assert.deepEqual([...equity.app.equity.players[0].cards], ['Kh', 'Qh']);
  assert.equal(equity.modalOpen(), false);
  assert.match(equity.render(), /data-equity-edit-hand="equity-player-0"[\s\S]*?data-card-id="Kh"[\s\S]*?data-card-id="Qh"/);
  assert.deepEqual([...equity.request().players[0].cards], ['Kh', 'Qh']);
  assert.equal(equity.readiness().state, 'ready');
  assert.equal(equity.calculateDisabled(), false);
});

test('draft clicks preserve the mounted 52-card deck and defer Equity invalidation until one Apply', () => {
  const equity = createEquityHandEntryHarness();
  equity.trace({ clear: true });
  equity.openHand('equity-player-0');
  const buildsAfterOpen = equity.deckBuildCount();

  equity.selectCard('Ah');
  equity.selectCard('Kh');

  assert.equal(equity.deckBuildCount(), buildsAfterOpen);
  assert.equal(equity.trace().length, 0);
  assert.deepEqual([...equity.app.equity.players[0].cards], []);

  assert.equal(equity.apply(), true);
  assert.equal(
    JSON.stringify(equity.trace()),
    JSON.stringify(['invalidate', 'clear-results', 'render-inputs', 'estimate']),
  );
});

test('real Equity Apply ordering leaves a known Ah Kh Hero ready against an unknown opponent', () => {
  const equity = createEquityHandEntryHarness();
  equity.trace({ clear: true });

  assert.equal(equity.openHand('equity-player-0'), true);
  equity.selectCard('Ah');
  equity.selectCard('Kh');
  assert.equal(equity.apply(), true);

  const hero = equity.app.equity.players[0];
  const request = equity.request();
  assert.deepEqual([...hero.cards], ['Ah', 'Kh']);
  assert.equal(hero.cards.filter(Boolean).length, 2);
  assert.deepEqual([...request.players[0].cards], ['Ah', 'Kh']);
  assert.equal(request.players[1].cards, null);
  assert.equal(
    JSON.stringify(equity.trace()),
    JSON.stringify(['invalidate', 'clear-results', 'render-inputs', 'estimate']),
  );
  assert.doesNotMatch(equity.readinessMessage(), /Hero is marked known and needs exactly two cards/);
  assert.equal(equity.readiness().state, 'ready');
  assert.equal(equity.calculateDisabled(), false);
});

test('two complete known players make calculation eligible with matching canonical request cards', () => {
  const equity = createEquityHandEntryHarness();

  equity.openHand('equity-player-0');
  equity.selectCard('As');
  equity.selectCard('Kd');
  assert.equal(equity.apply(), true);

  equity.setMode('equity-player-1', 'known');
  assert.equal(equity.modalOpen(), false);
  assert.equal(equity.openHand('equity-player-1'), true);
  equity.selectCard('Qc');
  equity.selectCard('Jh');
  assert.equal(equity.apply(), true);

  assert.equal(
    JSON.stringify(equity.app.equity.players.map((player) => player.cards)),
    JSON.stringify([['As', 'Kd'], ['Qc', 'Jh']]),
  );
  assert.equal(
    JSON.stringify(equity.request().players.map((player) => player.cards)),
    JSON.stringify([['As', 'Kd'], ['Qc', 'Jh']]),
  );
  assert.equal(equity.readiness().state, 'ready');
  assert.equal(equity.calculateDisabled(), false);
});

test('an existing unordered hand is preloaded; Cancel preserves it and Apply replaces the set', () => {
  const equity = createEquityHandEntryHarness();
  equity.app.equity.players[0].cards = ['Ah', 'Kh'];
  equity.sync();

  equity.openHand('equity-player-0');
  assert.match(equity.contextMarkup(), /A[\s\S]*K/);
  equity.selectCard('Kh');
  equity.selectCard('Qh');
  assert.deepEqual([...equity.app.equity.players[0].cards], ['Ah', 'Kh']);
  assert.match(equity.contextMarkup(), /A[\s\S]*Q/);
  equity.cancel();
  assert.deepEqual([...equity.app.equity.players[0].cards], ['Ah', 'Kh']);
  assert.deepEqual([...equity.request().players[0].cards], ['Ah', 'Kh']);

  equity.openHand('equity-player-0');
  equity.selectCard('Kh');
  equity.selectCard('Qh');
  assert.equal(equity.apply(), true);
  assert.deepEqual([...equity.app.equity.players[0].cards], ['Ah', 'Qh']);
  assert.deepEqual([...equity.request().players[0].cards], ['Ah', 'Qh']);
  assert.match(equity.render(), /A[\s\S]*Q/);
  assert.equal(equity.readiness().state, 'ready');
});

test('Clear resets only the draft, while Known changes mode without opening a second interaction', () => {
  const equity = createEquityHandEntryHarness();
  equity.app.equity.players[0].cards = ['As', 'Kd'];
  equity.sync();
  equity.openHand('equity-player-0');

  assert.equal(equity.clearHand(), true);
  assert.deepEqual([...equity.app.equity.players[0].cards], ['As', 'Kd']);
  assert.equal(equity.modalOpen(), true);
  assert.equal((equity.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 2);
  assert.equal(equity.applyDisabled(), true);
  equity.cancel();
  assert.deepEqual([...equity.request().players[0].cards], ['As', 'Kd']);
  assert.equal(equity.readiness().state, 'ready');

  equity.openHand('equity-player-0');
  equity.selectCard('Js');
  equity.selectCard('Td');
  equity.apply();
  equity.setMode('equity-player-0', 'unknown');
  assert.equal(equity.app.equity.players[0].handMode, 'unknown');
  assert.deepEqual([...equity.app.equity.players[0].cards], []);
  assert.equal(equity.request().players[0].cards, null);
  assert.doesNotMatch(equity.render(), /Js|Td/);
  assert.equal(equity.readiness().state, 'ready');

  equity.setMode('equity-player-0', 'known');
  assert.equal(equity.app.equity.players[0].handMode, 'known');
  assert.deepEqual([...equity.app.equity.players[0].cards], []);
  assert.equal(equity.modalOpen(), false);
  assert.equal(equity.readiness().state, 'blocked');
  assert.equal(equity.openHand('equity-player-0'), true);
  assert.equal(equity.modalOpen(), true);
});

test('editing after a completed result invalidates once, renders the new hand, and re-derives readiness', () => {
  const equity = createEquityHandEntryHarness();
  equity.app.equity.players[0].cards = ['Ah', 'Kh'];
  equity.app.equity.lifecycle = 'complete';
  equity.app.equity.lastResult = { schemaVersion: 'equity-result/v1', players: [] };
  equity.sync();
  equity.trace({ clear: true });

  equity.openHand('equity-player-0');
  equity.selectCard('Ah');
  equity.selectCard('Qh');
  assert.equal(equity.apply(), true);

  assert.deepEqual([...equity.app.equity.players[0].cards], ['Kh', 'Qh']);
  assert.equal(equity.app.equity.lifecycle, 'pending');
  assert.equal(equity.app.equity.lastResult, null);
  assert.equal(equity.app.equity.staleResult?.schemaVersion, 'equity-result/v1');
  assert.equal(
    JSON.stringify(equity.trace()),
    JSON.stringify(['invalidate', 'clear-results', 'render-inputs', 'estimate']),
  );
  assert.match(equity.render(), /data-card-id="Kh"[\s\S]*?data-card-id="Qh"/);
  assert.equal(equity.readiness().state, 'ready');
  assert.equal(equity.calculateDisabled(), false);
});

test('the shared deck exclusion covers the same hand, other players, Board, and Dead Cards', () => {
  const equity = createEquityHandEntryHarness();
  equity.app.equity.players[1].handMode = 'known';
  equity.app.equity.players[1].cards = ['Ac', 'Ad'];
  equity.app.equity.board = ['2s'];
  equity.app.equity.dead = ['3h'];
  equity.sync();
  equity.openHand('equity-player-0');
  equity.selectCard('Kh');

  const deck = equity.deckMarkup();
  assert.match(cardControl(deck, 'Kh'), /is-selected/);
  assert.doesNotMatch(cardControl(deck, 'Kh'), /disabled/);
  for (const unavailable of ['Ac', 'Ad', '2s', '3h']) {
    assert.match(cardControl(deck, unavailable), /disabled/, unavailable);
  }
  assert.doesNotMatch(cardControl(deck, 'Qh'), /disabled/);
});

test('one Flop transaction drafts three cards, stays open, applies atomically, and Cancel discards edits', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('eqboard', 0);

  assert.equal((picker.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 3);

  picker.selectCard('2s');
  assert.equal((picker.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 2);
  assert.match(picker.contextMarkup(), /data-card-set-preview-card="2s"/);
  picker.selectCard('7d');
  assert.equal((picker.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 1);
  picker.selectCard('Jh');
  assert.deepEqual([...picker.groupCards('eqboard')], []);
  assert.equal(picker.modalOpen(), true);
  assert.equal(picker.applyDisabled(), false);
  assert.match(picker.contextMarkup(), /2[\s\S]*7[\s\S]*J/);

  assert.equal(picker.apply(), true);
  assert.deepEqual([...picker.groupCards('eqboard')], ['2s', '7d', 'Jh']);
  assert.equal(picker.modalOpen(), false);

  picker.openPicker('eqboard', 1);
  picker.selectCard('7d');
  picker.selectCard('Qh');
  picker.closePicker();
  assert.deepEqual([...picker.groupCards('eqboard')], ['2s', '7d', 'Jh']);
});

test('Turn remains a one-card transaction and does not auto-close before Apply', () => {
  const picker = createProductionPickerHarness();
  picker.groupCards('eqboard').push('2s', '7d', 'Jh');
  picker.openPicker('eqboard', 3);
  picker.selectCard('Qc');

  assert.deepEqual([...picker.groupCards('eqboard')], ['2s', '7d', 'Jh']);
  assert.equal(picker.modalOpen(), true);
  assert.equal(picker.applyDisabled(), false);
  picker.apply();
  assert.deepEqual([...picker.groupCards('eqboard')], ['2s', '7d', 'Jh', 'Qc']);
});

test('private-hand preview keeps two physical slots and follows every draft change with readable identity', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('hero', 0);
  assert.equal((picker.contextMarkup().match(/class="card-set-picker-card/g) || []).length, 2);
  assert.equal((picker.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 2);
  assert.doesNotMatch(picker.contextMarkup(), /card 1|card 2|slot 1|slot 2|>1<|>2</i);

  picker.selectCard('Ah');
  assert.match(picker.contextMarkup(), /data-card-set-preview-card="Ah"/);
  assert.match(picker.contextMarkup(), /data-card-rank="A"/);
  assert.match(picker.contextMarkup(), /data-card-suit="♥"/);
  assert.equal((picker.contextMarkup().match(/card-set-picker-card--empty/g) || []).length, 1);

  picker.selectCard('Qd');
  assert.match(picker.contextMarkup(), /data-card-set-preview-card="Ah"[\s\S]*data-card-set-preview-card="Qd"/);
  assert.equal(picker.modalOpen(), true);

  picker.selectCard('Ah');
  assert.doesNotMatch(picker.contextMarkup(), /data-card-set-preview-card="Ah"/);
  assert.match(picker.contextMarkup(), /data-card-set-preview-card="Qd"/);
  picker.selectCard('Ks');
  assert.match(picker.contextMarkup(), /data-card-set-preview-card="Qd"[\s\S]*data-card-set-preview-card="Ks"/);
  assert.doesNotMatch(picker.contextMarkup(), /data-card-set-preview-card="Ah"/);
});

test('Escape discards the draft exactly like Cancel', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('hero', 0);
  picker.selectCard('As');
  picker.selectCard('Kh');
  picker.apply();

  picker.openPicker('hero', 0);
  picker.selectCard('As');
  picker.selectCard('Qd');
  assert.deepEqual([...picker.groupCards('hero')], ['As', 'Kh']);
  picker.escape();

  assert.equal(picker.modalOpen(), false);
  assert.deepEqual([...picker.groupCards('hero')], ['As', 'Kh']);
});
