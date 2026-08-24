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

const [html, css, logic, teacher, homeGameBootstrap, themeBootstrap] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8'),
]);

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('suggested sizing rounds only presentation copy to the nearest half blind', () => {
  assert.equal(roundSuggestedSizingBb(2.037), 2);
  assert.equal(roundSuggestedSizingBb(2.26), 2.5);
  assert.equal(roundSuggestedSizingBb(7.74), 7.5);
  assert.equal(formatSuggestedSizingBb(2.037), '2 bb');
  assert.equal(formatSuggestedSizingBb(2.26), '2.5 bb');
  assert.equal(formatExactPokerAmountBb(2.037), '2.037bb');
  assert.equal(formatExactPokerAmountBb(2.0379), '2.0379bb');
  assert.match(logic, /formatSuggestedSizingBb\?\.\(recommendationSizing\.amountBb\)/);
});

test('Scenario board is one semantic five-card LTR row in every surrounding direction', () => {
  const board = html.slice(html.indexOf('class="playbook-board-layout"'), html.indexOf('data-slots="dead"'));
  assert.match(board, /dir="ltr"/);
  assert.ok(board.indexOf('data-playbook-street="flop"') < board.indexOf('data-playbook-street="turn"'));
  assert.ok(board.indexOf('data-playbook-street="turn"') < board.indexOf('data-playbook-street="river"'));
  assert.match(css, /\.playbook-board-layout\s*\{[^}]*grid-template-columns:\s*repeat\(5, var\(--poker-card-width\)\)/);
  assert.match(css, /\[dir="rtl"\] \.playbook-board-layout \{ direction: ltr; unicode-bidi: isolate; \}/);
  for (let index = 1; index <= 5; index += 1) {
    assert.match(css, new RegExp(`playbook-board-cards > \\.card-slot:nth-child\\(${index}\\) \\{ grid-column: ${index}; \\}`));
  }
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
  assert.match(html, /id="homeGameCreateButton"[^>]*type="submit"[^>]*disabled/);
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
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(themeBootstrap, new RegExp(`#${id}`));
  }
  assert.doesNotMatch(html, /id="renameCustomTheme"/);
  assert.match(css, /html\[data-theme-editing="false"\] \.theme-color-controls/);
});

test('all durable save actions use the same bookmark state and saved copy', () => {
  for (const id of ['savedStudySaveButton', 'handCompletedSaveButton', 'handReviewSaveSpot', 'handReviewSaveHand']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*saved-study-bookmark-action[^>]*aria-pressed="false"[^>]*data-bookmark-state="unsaved"`));
  }
  assert.match(logic, /function setSavedStudyBookmarkState\(/);
  assert.match(logic, /button\.dataset\.bookmarkState = saved \? 'saved' : 'unsaved'/);
  assert.match(css, /saved-study-bookmark-action\[data-bookmark-state="saved"\]::before/);
});

test('Training action count selects balanced four-action rows without changing DOM order', () => {
  assert.match(logic, /container\.dataset\.actionCount = String\(container\.childElementCount\)/);
  assert.match(css, /training-action-grid\[data-action-count="4"\]\s*\{\s*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(min-width: 1600px\)[\s\S]*training-action-grid\[data-action-count="4"\][^}]*repeat\(4/);
  assert.doesNotMatch(logic, /sort\([^)]*training-action|training-action[^\n]*sort\(/);
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

test('Table Focus owns a lower stage reserve and known table cards keep readable rank plus suit', () => {
  assert.match(css, /data-layout-preset="table-focus"[^}]*#visual-table-container[\s\S]*?--play-stage-reserve:\s*280px/);
  const known = tableCardSvgMarkup({ rank: 'A', suit: 'h' });
  assert.match(known, /table-card-corner-rank[^>]*>A</);
  assert.match(known, /table-card-corner-suit[^>]*>[^<]+</);
  assert.match(css, /\.table-card-corner-suit \{ font: 800 11px/);
  assert.doesNotMatch(tableCardBackSvgMarkup(), /table-card-corner-(?:rank|suit)/);
  assert.deepEqual(CARD_GEOMETRY.picker, { width: 42, height: 60, radius: 5 });
});
