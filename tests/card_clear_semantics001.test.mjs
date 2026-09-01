import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_CLEAR_COMMANDS as COMMANDS,
  applyEditableCardClear,
} from '../app/src/application/card-clear-semantics.mjs';
import { createProductionPickerHarness } from './uiqa001r_card_picker_adapter.mjs';

const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const TRANSLATIONS = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

function editableCards() {
  return {
    hero: ['As', 'Kd'],
    board: ['2c', '7d', 'Th', 'Js', '4c'],
    dead: ['Jh'],
    playerHand: ['Qc', 'Qd'],
    playerHands: [['As', 'Kd'], ['Qc', 'Qd']],
    pending: ['9s'],
  };
}

test('shared commands isolate Hero, player-hand, and dead-card clears', () => {
  const hero = editableCards();
  applyEditableCardClear(COMMANDS.CLEAR_HERO, hero);
  assert.deepEqual(hero.hero, []);
  assert.deepEqual(hero.board, ['2c', '7d', 'Th', 'Js', '4c']);
  assert.deepEqual(hero.dead, ['Jh']);

  const player = editableCards();
  applyEditableCardClear(COMMANDS.CLEAR_PLAYER_HAND, player);
  assert.deepEqual(player.playerHand, []);
  assert.deepEqual(player.hero, ['As', 'Kd']);
  assert.deepEqual(player.board, ['2c', '7d', 'Th', 'Js', '4c']);
  assert.deepEqual(player.dead, ['Jh']);

  const dead = editableCards();
  applyEditableCardClear(COMMANDS.CLEAR_DEAD_SET, dead);
  assert.deepEqual(dead.dead, []);
  assert.deepEqual(dead.hero, ['As', 'Kd']);
  assert.deepEqual(dead.board, ['2c', '7d', 'Th', 'Js', '4c']);
});

test('shared editable-board chronology is Flop/Board, Turn, then River', () => {
  const cases = [
    [COMMANDS.CLEAR_FLOP, []],
    [COMMANDS.CLEAR_BOARD, []],
    [COMMANDS.CLEAR_TURN, ['2c', '7d', 'Th']],
    [COMMANDS.CLEAR_RIVER, ['2c', '7d', 'Th', 'Js']],
  ];
  for (const [command, expectedBoard] of cases) {
    const cards = editableCards();
    applyEditableCardClear(command, cards);
    assert.deepEqual(cards.board, expectedBoard);
    assert.deepEqual(cards.hero, ['As', 'Kd']);
    assert.deepEqual(cards.dead, ['Jh']);
  }
});

test('all-editable and pending-draft commands mutate only the targets explicitly supplied', () => {
  const cards = editableCards();
  applyEditableCardClear(COMMANDS.CLEAR_PENDING_CARD_SET, cards);
  assert.deepEqual(cards.pending, []);
  assert.deepEqual(cards.board, ['2c', '7d', 'Th', 'Js', '4c']);

  applyEditableCardClear(COMMANDS.CLEAR_ALL_EDITABLE, cards);
  assert.deepEqual(cards.hero, []);
  assert.deepEqual(cards.board, []);
  assert.deepEqual(cards.dead, []);
  assert.deepEqual(cards.playerHands, [[], []]);
});

test('dead-card editors open one multi-select draft preloaded from the committed set', () => {
  for (const group of ['dead', 'eqdead']) {
    const picker = createProductionPickerHarness();
    const target = group === 'dead' ? picker.app.gto.dead : picker.app.equity.dead;
    target.push('As', 'Kd', 'Qc');
    picker.renderAllCards();

    const editorMarkup = picker.slotMarkup(group);
    assert.equal((editorMarkup.match(/data-card-set-edit=/g) || []).length, 1);
    assert.doesNotMatch(editorMarkup, /data-group=|data-index=/);
    assert.equal((editorMarkup.match(/class="card-slot/g) || []).length, 4);
    assert.equal((editorMarkup.match(/card--dead/g) || []).length, 3);
    assert.equal((editorMarkup.match(/card--empty/g) || []).length, 1);

    picker.openPicker(group, 0);
    assert.equal(picker.app.picker.kind, 'dead_set');
    assert.deepEqual([...picker.app.picker.draft], ['As', 'Kd', 'Qc']);
    assert.equal((picker.contextMarkup().match(/data-card-set-preview-card=/g) || []).length, 3);
  }
});

test('dead-card draft supports additive and subtractive toggles before one Analyze commit', () => {
  const additive = createProductionPickerHarness();
  additive.app.gto.dead.push('As', 'Kd', 'Qc');
  additive.openPicker('dead', 0);
  assert.equal(additive.selectCard('Jh'), true);
  assert.equal(additive.selectCard('9s'), true);
  assert.deepEqual([...additive.app.gto.dead], ['As', 'Kd', 'Qc']);
  assert.equal(additive.app.updateCount, 0);
  assert.equal(additive.apply(), true);
  assert.deepEqual([...additive.app.gto.dead], ['As', 'Kd', 'Qc', 'Jh', '9s']);
  assert.equal(additive.app.updateCount, 1);

  const subtractive = createProductionPickerHarness();
  subtractive.app.gto.dead.push('As', 'Kd', 'Qc');
  subtractive.openPicker('dead', 0);
  assert.equal(subtractive.selectCard('Kd'), true);
  assert.deepEqual([...subtractive.app.gto.dead], ['As', 'Kd', 'Qc']);
  assert.equal(subtractive.apply(), true);
  assert.deepEqual([...subtractive.app.gto.dead], ['As', 'Qc']);
  assert.equal(subtractive.app.updateCount, 1);
  assert.equal((subtractive.slotMarkup('dead').match(/card--dead/g) || []).length, 2);
  assert.equal((subtractive.slotMarkup('dead').match(/card--empty/g) || []).length, 1);
});

test('Clear all remains draft-only until Apply; Cancel and Escape discard it', () => {
  for (const cancel of ['closePicker', 'escape']) {
    const picker = createProductionPickerHarness();
    picker.app.gto.dead.push('As', 'Kd', 'Qc');
    picker.openPicker('dead', 0);

    assert.equal(picker.clearHand(), true);
    assert.deepEqual([...picker.app.picker.draft], []);
    assert.deepEqual([...picker.app.gto.dead], ['As', 'Kd', 'Qc']);
    assert.equal(picker.app.updateCount, 0);
    picker[cancel]();
    assert.deepEqual([...picker.app.gto.dead], ['As', 'Kd', 'Qc']);
    assert.equal(picker.modalOpen(), false);
  }
});

test('Clear all followed by Apply commits an empty dead-card set', () => {
  const picker = createProductionPickerHarness();
  picker.app.gto.dead.push('As', 'Kd', 'Qc');
  picker.openPicker('dead', 0);

  assert.equal(picker.clearHand(), true);
  assert.equal(picker.applyDisabled(), false);
  assert.equal(picker.apply(), true);
  assert.deepEqual([...picker.app.gto.dead], []);
  assert.equal(picker.app.updateCount, 1);
  assert.equal(picker.modalOpen(), false);
});

test('known hole and board cards are disabled and cannot enter the dead-card draft', () => {
  const picker = createProductionPickerHarness();
  picker.app.gto.hero.push('As', 'Kd');
  picker.app.gto.board.push('2c', '7d', 'Th');
  picker.app.gto.dead.push('Jh');
  picker.openPicker('dead', 0);

  assert.equal(picker.selectCard('As'), false);
  assert.equal(picker.selectCard('2c'), false);
  assert.deepEqual([...picker.app.picker.draft], ['Jh']);
  assert.match(picker.deckMarkup(), /data-deck-card="As"[^>]*disabled/);
  assert.match(picker.deckMarkup(), /data-deck-card="2c"[^>]*disabled/);
});

test('Equity drafts do not invalidate per toggle and invalidate exactly once on Apply', () => {
  const picker = createProductionPickerHarness();
  picker.app.equity.dead.push('As', 'Kd', 'Qc');
  picker.openPicker('eqdead', 0);

  assert.equal(picker.selectCard('Jh'), true);
  assert.equal(picker.selectCard('9s'), true);
  assert.equal(picker.selectCard('Kd'), true);
  assert.equal(picker.app.equityUpdateCount, 0);
  assert.deepEqual([...picker.app.equity.dead], ['As', 'Kd', 'Qc']);

  assert.equal(picker.apply(), true);
  assert.deepEqual([...picker.app.equity.dead], ['As', 'Qc', 'Jh', '9s']);
  assert.equal(picker.app.equityUpdateCount, 1);
});

test('resting dead-card slots do not scroll and the overlay leaves their geometry unchanged', () => {
  const picker = createProductionPickerHarness();
  picker.app.equity.dead.push('As', 'Kd', 'Qc');
  picker.renderAllCards();
  const before = picker.slotMarkup('eqdead');
  picker.openPicker('eqdead', 0);

  assert.equal(picker.slotMarkup('eqdead'), before);
  picker.closePicker();
  assert.equal(picker.slotMarkup('eqdead'), before);
  assert.ok(HTML.indexOf('id="cardModal"') > HTML.indexOf('data-slots="eqdead"'));
  assert.match(CSS, /#cardModal\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
  assert.match(CSS, /#cardModal\s*>\s*\.modal\s*\{[^}]*max-height:\s*calc\(100dvh[^}]*overflow:\s*auto;/s);
  const restingRules = [
    ...CSS.matchAll(/\.(?:equity-dead-cards|dead-card-set-editor)\s*\{([^}]*)\}/g),
  ].map((match) => match[1]);
  assert.ok(restingRules.length >= 3);
  for (const rule of restingRules) {
    assert.doesNotMatch(rule, /overflow(?:-y)?:\s*(?:auto|scroll)/);
    assert.doesNotMatch(rule, /max-(?:block-)?height/);
  }
  assert.doesNotMatch(CSS, /\.dead-card-set-editor-cards\s*\{/);
});

test('dead-card set-editor copy is localized for Russian and Hebrew', () => {
  for (const key of [
    'Edit dead cards', 'Selected dead cards', 'No dead cards selected',
    '{selected} selected', 'Clear all', 'Choose any known cards that are out of play.',
  ]) {
    assert.equal((TRANSLATIONS.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []).length >= 2, true, key);
  }
});

test('dead-set clear removes the complete collection', () => {
  const picker = createProductionPickerHarness();
  picker.app.gto.dead.push('As', 'Kd', 'Qc');

  const result = picker.clearGroup('dead');
  assert.equal(result.changed, true);
  assert.deepEqual([...picker.app.gto.dead], []);
});

test('empty Scenario clears are idempotent and preserve preflop betting controls', () => {
  const picker = createProductionPickerHarness();
  picker.setScenarioControls({
    lastAction: 'raise', facing: 7.5, facingNumber: 7.5, pot: 12, potNumber: 12,
  });

  assert.equal(picker.clearGroup('hero').changed, false);
  assert.equal(picker.clearGroup('board').changed, false);
  assert.equal(picker.app.updateCount, 0);
  assert.deepEqual({ ...picker.scenarioControls() }, {
    lastAction: 'raise', facing: '7.5', facingNumber: '7.5', pot: '12', potNumber: '12',
  });
});

test('keyboard C has the same isolated Hero-clear consequence as the visible command', () => {
  const shortcut = createProductionPickerHarness();
  const visible = createProductionPickerHarness();
  for (const picker of [shortcut, visible]) {
    picker.app.gto.hero.push('As', 'Kd');
    picker.app.gto.board.push('2c', '7d', 'Th');
    picker.app.gto.dead.push('Jh');
  }

  const shortcutResult = shortcut.cShortcut();
  const visibleResult = visible.clearGroup('hero');
  assert.equal(shortcutResult.changed, true);
  assert.equal(visibleResult.changed, true);
  assert.deepEqual([...shortcut.app.gto.hero], [...visible.app.gto.hero]);
  assert.deepEqual([...shortcut.app.gto.board], [...visible.app.gto.board]);
  assert.deepEqual([...shortcut.app.gto.dead], [...visible.app.gto.dead]);
  assert.equal(shortcut.app.updateCount, visible.app.updateCount);
});

test('Equity stage clear uses shared chronology and preserves hands and dead cards', () => {
  const picker = createProductionPickerHarness();
  picker.app.equity.board.push('2c', '7d', 'Th', 'Js', '4c');
  picker.app.equity.dead.push('Jh');
  picker.app.equity.players[0].cards.push('As', 'Kd');
  picker.openPicker('eqboard', 3);

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.equity.board], ['2c', '7d', 'Th']);
  assert.deepEqual([...picker.app.equity.dead], ['Jh']);
  assert.deepEqual([...picker.app.equity.players[0].cards], ['As', 'Kd']);
  assert.equal(picker.modalOpen(), false);
});

test('Hand clear mutates pending draft inputs without touching canonical history', () => {
  const canonicalState = {
    board: ['2c', '7d', 'Th'],
    deadCards: ['Jh'],
    players: [{ playerId: 'player-0', seat: 0, position: 'BTN', holeCards: ['As', 'Kd'] }],
    pendingChance: { type: 'deal_turn', cardCount: 1 },
  };
  const picker = createProductionPickerHarness({ handMode: true, canonicalState });
  picker.app.playbookHandDraft.board.push('Js');
  picker.openPicker('hand-board-chance', 0);

  assert.equal(picker.clearHand(), true);
  assert.deepEqual([...picker.app.playbookHandDraft.board], []);
  assert.deepEqual(canonicalState.board, ['2c', '7d', 'Th']);
  assert.deepEqual(canonicalState.players[0].holeCards, ['As', 'Kd']);
});

test('production controls carry explicit commands and Escape is cancel-only for the picker', () => {
  assert.match(HTML, /data-card-clear-command="clear_hero" data-card-clear-surface="scenario"/);
  assert.match(HTML, /data-card-clear-command="clear_board" data-card-clear-surface="equity"/);
  assert.match(HTML, /data-card-clear-command="clear_dead_set" data-card-clear-surface="equity"/);
  assert.doesNotMatch(HTML, /data-clear=/);
  assert.match(LOGIC, /event\.key === 'Escape'[\s\S]*closePicker\(\)/);
  assert.match(LOGIC, /#closeModal'[\s\S]*addEventListener\('click', closePicker\)/);
  assert.match(LOGIC, /event\.target === \$\('#cardModal'\)\) closePicker\(\)/);
  assert.doesNotMatch(LOGIC, /clearAllScenarioCards|Cleared all via Escape key/);
});
