import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  formatExactPokerAmountBb,
  formatSuggestedSizingBb,
  roundSuggestedSizingBb,
} from '../app/src/application/poker-sizing-presentation.mjs';
import {
  CARD_GEOMETRY,
  tableCardBackSvgMarkup,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';
import { HOME_TUTORIAL_DEFINITION } from '../app/src/tutorial/home-tutorial.mjs';
import { createTutorialDefinition } from '../app/src/tutorial/domain.mjs';
import { createTutorialPersistence } from '../app/src/tutorial/persistence.mjs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the running app, the cascade). teacher.js and
// the Home Game / theme bootstrap sources are outside this ticket.
const [teacher, homeGameBootstrap, themeBootstrap] = await Promise.all([
  readFile(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8'),
]);

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('suggested sizing rounds only presentation copy to the nearest half blind', async () => {
  assert.equal(roundSuggestedSizingBb(2.037), 2);
  assert.equal(roundSuggestedSizingBb(2.26), 2.5);
  assert.equal(roundSuggestedSizingBb(7.74), 7.5);
  assert.equal(formatSuggestedSizingBb(2.037), '2 bb');
  assert.equal(formatSuggestedSizingBb(2.26), '2.5 bb');
  assert.equal(formatExactPokerAmountBb(2.037), '2.037bb');
  assert.equal(formatExactPokerAmountBb(2.0379), '2.0379bb');
  // Analyze shows the recommended size through the rounding presenter.
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Ad']);
  const amountBb = app.window.app.strategyResult?.recommendation?.action?.amountBb;
  if (Number.isFinite(amountBb)) {
    assert.equal(text(app.byId('bestSizing')), formatSuggestedSizingBb(amountBb));
  } else {
    const result = structuredClone(app.window.app.strategyResult);
    assert.ok(result, 'a recommendation resolved');
  }
  assert.equal(app.window.RiverlineAnalysisExplanation.formatSuggestedSizingBb(2.26), '2.5 bb');
});

test('Scenario board is one semantic five-card LTR row in every surrounding direction', async () => {
  const board = markup.querySelector('.playbook-board-layout');
  assert.equal(board.getAttribute('dir'), 'ltr');
  const [flop, turn, river] = ['flop', 'turn', 'river'].map((street) => board.querySelector(`[data-playbook-street="${street}"]`));
  assert.ok(precedes(flop, turn) && precedes(turn, river));
  await app.navigate('analyze');
  const live = app.$('.playbook-board-layout');
  assert.equal(css.cascaded(live, 'grid-template-columns'), 'repeat(5, var(--poker-card-width))');
  app.document.documentElement.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(live, 'direction'), 'ltr');
  assert.equal(css.cascaded(live, 'unicode-bidi'), 'isolate');
  app.document.documentElement.setAttribute('dir', 'ltr');
  assert.equal(css.cascaded(live.querySelector('.playbook-board-cards > .board-card-set-editor--flop'), 'grid-column'), '1 / span 3');
  assert.equal(css.cascaded(live.querySelector('.board-card-set-editor[data-card-set-index="3"]'), 'grid-column'), '4');
  assert.equal(css.cascaded(live.querySelector('.board-card-set-editor[data-card-set-index="4"]'), 'grid-column'), '5');
  // Each board street opens a street-scoped draft of its committed cards.
  const boardCards = app.window.app.gto.board;
  const previousBoard = boardCards.slice();
  boardCards.splice(0, boardCards.length, '2c', '7d', '9h', 'Js');
  app.call('openPicker', 'board', 3);
  const picker = app.window.app.picker;
  assert.equal(picker.kind, 'board_street');
  assert.deepEqual(picker.targetIndices, [3]);
  assert.deepEqual(picker.committed, ['Js'], 'the Turn editor holds only the Turn card');
  assert.deepEqual(picker.draft, ['Js']);
  assert.notEqual(picker.draft, picker.committed, 'the draft is a copy of the committed card');
  app.call('closePicker');
  boardCards.splice(0, boardCards.length, ...previousBoard);
});

test('released Home tutorial decisions persist while a deliberate later version can re-offer', () => {
  assert.equal(HOME_TUTORIAL_DEFINITION.version, 1);
  const persistence = createTutorialPersistence({ storage: new MemoryStorage() });
  persistence.skip(HOME_TUTORIAL_DEFINITION);
  assert.equal(persistence.shouldOffer(HOME_TUTORIAL_DEFINITION), false);
  persistence.begin(HOME_TUTORIAL_DEFINITION, { manualRestart: true });
  assert.equal(persistence.getRecord(HOME_TUTORIAL_DEFINITION).firstUseStatus, 'skipped');
  const v2 = createTutorialDefinition({ ...HOME_TUTORIAL_DEFINITION, version: 2 });
  assert.equal(persistence.shouldOffer(v2), true);
  const completed = createTutorialPersistence({ storage: new MemoryStorage() });
  completed.complete(HOME_TUTORIAL_DEFINITION);
  assert.equal(completed.shouldOffer(HOME_TUTORIAL_DEFINITION), false);
});

test('Home Game primary creation cannot native-submit before its organizer route is installed', () => {
  const create = markup.getElementById('homeGameCreateButton');
  assert.equal(create.type, 'submit');
  assert.equal(create.disabled, true, 'disabled until the organizer route is installed');
  assert.match(homeGameBootstrap, /import '\.\/authentication-bootstrap\.mjs';/);
  const submitBinding = homeGameBootstrap.slice(
    homeGameBootstrap.indexOf("refs.form.addEventListener('submit'"),
    homeGameBootstrap.indexOf('const refresh ='),
  );
  assert.match(submitBinding, /event\.preventDefault\(\)/);
  assert.match(submitBinding, /bridge\.createSession\(/);
  assert.match(submitBinding, /refs\.createButton\.disabled = false/);
  assert.doesNotMatch(submitBinding, /location|navigate|homeMode/);
});

test('theme UI exposes one explicit transactional edit boundary', () => {
  for (const id of ['editTheme', 'saveThemeChanges', 'cancelThemeEdit', 'duplicateTheme', 'saveCustomTheme']) {
    assert.ok(markup.getElementById(id), id);
    assert.match(themeBootstrap, new RegExp(`#${id}`));
  }
  assert.equal(markup.getElementById('renameCustomTheme'), null);
  const controls = app.$('.theme-color-controls');
  const root = app.document.documentElement;
  const previous = root.getAttribute('data-theme-editing');
  root.setAttribute('data-theme-editing', 'false');
  assert.ok(css.matchingRules(controls).some((rule) => rule.selectorText.includes('html[data-theme-editing="false"] .theme-color-controls')));
  if (previous === null) root.removeAttribute('data-theme-editing'); else root.setAttribute('data-theme-editing', previous);
});

test('all durable save actions use the same bookmark state and saved copy', () => {
  for (const id of ['savedStudySaveButton', 'handCompletedSaveButton', 'handReviewSaveSpot', 'handReviewSaveHand']) {
    const button = markup.getElementById(id);
    assert.ok(button.classList.contains('saved-study-bookmark-action'), id);
    assert.equal(button.getAttribute('aria-pressed'), 'false', id);
    assert.equal(button.dataset.bookmarkState, 'unsaved', id);
  }
  const button = app.byId('savedStudySaveButton');
  app.call('setSavedStudyBookmarkState', button, true);
  assert.equal(button.dataset.bookmarkState, 'saved');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.ok(css.cascaded(button, 'content', { pseudoElement: 'before' }) !== undefined || css.matchingRules(button, { pseudoElement: 'before' }).some((rule) => rule.selectorText.includes('[data-bookmark-state="saved"]')));
  app.call('setSavedStudyBookmarkState', button, false);
  assert.equal(button.dataset.bookmarkState, 'unsaved');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
});

test('Training action count selects balanced four-action rows without changing DOM order', async () => {
  await app.training.start('focused');
  const grid = app.byId('trainingGuessButtons');
  assert.equal(grid.dataset.actionCount, String(grid.childElementCount));
  const legal = app.call('canonicalTrainingLegalActionTypes', app.window.app.training.currentExercise);
  assert.deepEqual(grid.children.map((button) => button.dataset.action), legal, 'canonical order is kept');
  grid.dataset.actionCount = '4';
  assert.match(css.cascaded(grid, 'grid-template-columns', { width: 1400 }), /^repeat\(2/);
  assert.match(css.cascaded(grid, 'grid-template-columns', { width: 1700 }), /^repeat\(4/);
  grid.dataset.actionCount = String(grid.childElementCount);
});

test('Training hint concept selection is street-aware', () => {
  const context = { window: {} };
  vm.runInNewContext(`${teacher}\n;globalThis.__studyHintDefinition = studyHintDefinition;`, context);
  const fact = (key, value = key) => ({ key, value, label: key, text: value });
  const explanation = (facts) => ({ sections: [{ facts }] });
  const preflop = context.__studyHintDefinition(explanation([
    fact('preflop_hand_class', 'AKs'), fact('hero_cards', ['As', 'Ks']), fact('hero_position', 'BTN'),
  ]), 1);
  assert.match(preflop.prompt, /starting-hand class/i);
  assert.doesNotMatch(preflop.prompt, /draw/i);
  assert.deepEqual(Array.from(preflop.facts, (entry) => entry.key), ['preflop_hand_class', 'hero_cards', 'hero_position']);
  const preflopWithoutClass = context.__studyHintDefinition(explanation([fact('hero_cards', ['Jd', '7d'])]), 1, { street: 'preflop' });
  assert.match(preflopWithoutClass.prompt, /starting-hand class/i);
  assert.doesNotMatch(preflopWithoutClass.prompt, /draw/i);
  const flop = context.__studyHintDefinition(explanation([fact('made_hand', 'top pair'), fact('draws', ['flush draw'])]), 1);
  assert.match(flop.prompt, /meaningful draws/i);
});

test('Table Focus owns a lower stage reserve and known table cards keep readable rank plus suit', async () => {
  await app.startHand(['Ah', 'Kh']);
  const root = app.document.documentElement;
  const preset = root.dataset.layoutPreset;
  root.dataset.layoutPreset = 'table-focus';
  assert.equal(css.cascaded(app.byId('visual-table-container'), '--play-stage-reserve', { width: 1920 }), '350px');
  root.dataset.layoutPreset = preset;
  const known = tableCardSvgMarkup({ rank: 'A', suit: 'h' });
  assert.match(known, /table-card-corner-rank[^>]*>A</);
  assert.match(known, /table-card-corner-suit[^>]*>[^<]+</);
  const rank = app.$('#visual-table-container .table-card-corner-rank');
  const suit = app.$('#visual-table-container .table-card-corner-suit');
  assert.equal(css.cascaded(rank, 'font-weight'), '850');
  assert.equal(css.cascaded(rank, 'font-size'), '15px');
  assert.equal(css.cascaded(suit, 'font-weight'), '850');
  assert.equal(css.cascaded(suit, 'font-size'), '14px');
  const card = rank.closest('.poker-card-svg');
  const center = app.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  center.setAttribute('class', 'table-card-center');
  card.appendChild(center);
  card.classList.add('card--style-classic');
  assert.equal(css.cascaded(center, 'display'), 'block');
  card.classList.remove('card--style-classic');
  center.remove();
  assert.doesNotMatch(tableCardBackSvgMarkup(), /table-card-corner-(?:rank|suit)/);
  assert.deepEqual(CARD_GEOMETRY.picker, { width: 42, height: 60, radius: 5 });
});
