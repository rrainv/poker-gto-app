import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, cascade, running app); locale catalogs are
// outside this ticket and keep their checks.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Imported after boot: the adapter loads a self-installing bootstrap module.
const { createProductionPickerHarness } = await import('./uiqa001r_card_picker_adapter.mjs');
const PROVENANCE = 'Heuristic guidance is active unless another source is named above. Canonical hand state does not imply solved strategy.';
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

test('Playbook retires the standalone guardrail panel while preserving compact source provenance', async () => {
  // Protects: no guardrail panel; the source badge is described by a
  // screen-reader-only provenance line; resolving a spot names the source in
  // the badge's accessible label and fills the provenance from the claim policy.
  assert.equal(markup.getElementById('playbookGuardrailPanel'), null);
  assert.equal(markup.getElementById('sourceBadge').getAttribute('aria-describedby'), 'strategySourceProvenance');
  assert.ok(markup.getElementById('strategySourceProvenance').classList.contains('sr-only'));

  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const badge = app.byId('sourceBadge');
  assert.match(badge.getAttribute('aria-label'), /^Strategy source: \S/);
  assert.ok(badge.title.length > 20, 'badge title carries the provenance summary');
  assert.equal(text(app.byId('strategySourceProvenance')), badge.title);
});

test('dead-card controls expose a compact, canonical available-deck summary', async () => {
  // Protects: the dead-card section shows Dead and Available counts; Hand mode
  // counts come from the canonical PokerState (not 52 minus Hero's cards).
  const header = markup.querySelector('.playbook-dead-card-header');
  assert.match(text(header), /Known burned \/ dead/);
  for (const id of ['deadCardCount', 'deckCount']) assert.ok(header.querySelector(`#${id}`), id);
  assert.ok(header.querySelector('[data-i18n="Available"]'));

  await app.startHand(['Qs', 'Qh']);
  assert.equal(text(app.byId('deckCount')), '50', 'canonical Hand: two private cards are out of the deck');
  assert.equal(text(app.byId('deadCardCount')), '0');
  const state = app.call('callPlaybookStateBridge', 'getState');
  assert.equal(Number(text(app.byId('deckCount'))), app.call('remainingCards', 'hand'));
  assert.equal(Number(text(app.byId('deadCardCount'))), (state.deadCards || []).filter(Boolean).length);
});

test('available-deck summary updates after hero, board, dead-card, replacement, and clearing changes', () => {
  const picker = createProductionPickerHarness();
  const summary = () => ({ ...picker.cardStateSummary() });

  picker.app.gto.hero = ['As', 'Kd'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '50', dead: '0' });
  picker.app.gto.board = ['2c', '3d', '4h'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '47', dead: '0' });
  picker.app.gto.dead = ['Qc'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '46', dead: '1' });
  picker.app.gto.dead[0] = 'Jc';
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '46', dead: '1' });
  picker.app.gto.dead.length = 0;
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '47', dead: '0' });
});

test('compact labels and provenance copy remain available to EN, RU, and HE catalogs', () => {
  assert.ok((i18n.match(/"Available"/g) || []).length >= 3);
  assert.equal(text(markup.getElementById('strategySourceProvenance')), PROVENANCE);
  assert.equal(markup.getElementById('sourceBadge').title, PROVENANCE);
  assert.match(productTranslations, /"Dead"/);
  assert.ok((productTranslations.match(/"Available"/g) || []).length >= 2);
  assert.equal((productTranslations.match(/"Heuristic guidance is active unless another source is named above\. Canonical hand state does not imply solved strategy\."/g) || []).length, 2);
});

function assertReflowSafeHeader(header, columns) {
  const copy = header.querySelector(':scope > .playbook-card-state-copy');
  const clear = header.querySelector(':scope > [data-card-clear-command="clear_dead_set"]');
  assert.ok(copy && clear && precedes(copy, clear));
  assert.equal(css.cascaded(header, 'display'), 'grid');
  assert.equal(css.cascaded(header, 'grid-template-columns'), columns);
  assert.ok(clear.classList.contains('small-link'));
  assert.equal(css.cascaded(clear, 'white-space'), 'nowrap');
  for (const node of [header, ...header.querySelectorAll('*')]) {
    assert.notEqual(css.cascaded(node, 'position'), 'absolute', node.className);
    for (const side of ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline-start', 'margin-inline-end']) {
      assert.doesNotMatch(css.cascaded(node, side) || '', /^-/, `${node.className} ${side}`);
    }
  }
}

test('dead-card header keeps the status group and Clear action in independent reflow-safe columns', async () => {
  // Protects: status copy and Clear sit in separate grid columns (flexible +
  // auto); the summary wraps; Clear never wraps; nothing in the header is
  // absolutely positioned or pulled with negative margins.
  await app.navigate('hand');
  const header = app.$('.playbook-dead-card-header');
  assertReflowSafeHeader(header, 'minmax(0, 1fr) auto');
  assert.equal(css.cascaded(header.querySelector('.playbook-card-state-summary'), 'flex-wrap'), 'wrap');
});

test('Analyze dead-card header keeps its compact three-column grid row', async () => {
  // Protects: TEST-HYGIENE-001-F06 (fixed by CLEANUP-PREP-001).
  await app.navigate('analyze');
  assertReflowSafeHeader(app.$('.playbook-dead-card-header'), 'minmax(0, 1fr) auto auto');
});
