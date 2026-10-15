// TEST-HYGIENE-001: behavioural rewrite. The app runs on the test DOM; the
// assertions drive the rendered Equity player editor instead of matching
// logic.js / styles.css source text.
import assert from 'node:assert/strict';
import test from 'node:test';

import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();
await app.navigate('equity');
const css = appStyleSheet();

const tileFor = (index) => app.$(`#equityPlayers .equity-player-card[data-player-id="${app.window.app.equity.players[index].id}"]`)
  || app.$$('#equityPlayers [data-equity-player-name-label]')[index].closest('[data-player-id]');
const labelFor = (index) => app.$(`#equityPlayers [data-equity-player-name-label="${index}"]`);
const inputFor = (index) => app.$(`#equityPlayers [data-equity-player-name="${index}"]`);

test('player names use an in-place label/input editor with commit, cancel, and blur semantics', async () => {
  // Protects: label button + hidden input editor; Enter commits, Escape cancels,
  // blur commits, and the input text is selected when editing starts.
  const label = labelFor(1);
  const input = inputFor(1);
  assert.equal(label.tagName, 'button');
  assert.equal(input.tagName, 'input');
  assert.equal(input.hidden, true);
  assert.equal(input.closest('.equity-player-name-editor'), label.closest('.equity-player-name-editor'));

  let selected = 0;
  input.select = () => { selected += 1; };
  await app.click(label);
  assert.equal(label.hidden, true);
  assert.equal(input.hidden, false);
  assert.equal(app.document.activeElement, input);
  assert.equal(selected, 1, 'editing selects the current name');

  input.value = '  Villain  ';
  await app.key(input, 'Enter');
  assert.equal(app.window.app.equity.players[1].name, 'Villain');
  assert.equal(labelFor(1).textContent, 'Villain');
  assert.equal(input.hidden, true);
  assert.equal(labelFor(1).hidden, false);

  await app.click(labelFor(1));
  inputFor(1).value = 'Discarded';
  await app.key(inputFor(1), 'Escape');
  assert.equal(app.window.app.equity.players[1].name, 'Villain', 'Escape cancels');
  assert.equal(labelFor(1).textContent, 'Villain');

  await app.click(labelFor(1));
  inputFor(1).value = 'Blurred';
  inputFor(1).blur();
  await app.flush();
  assert.equal(app.window.app.equity.players[1].name, 'Blurred', 'blur commits');
});

test('blank names retain the existing default display labels', async () => {
  // Protects: trimmed, 40-character names; blank falls back to Hero / Player N.
  await app.click(labelFor(1));
  inputFor(1).value = `  ${'x'.repeat(60)}  `;
  await app.key(inputFor(1), 'Enter');
  assert.equal(app.window.app.equity.players[1].name, 'x'.repeat(40));

  await app.click(labelFor(1));
  inputFor(1).value = '   ';
  await app.key(inputFor(1), 'Enter');
  assert.equal(app.window.app.equity.players[1].name, '');
  assert.equal(labelFor(1).textContent, 'Player 2');
  assert.equal(labelFor(0).textContent, 'Hero');
  assert.equal(app.call('equityPlayerLabel', 0), 'Hero');
  assert.equal(app.call('equityPlayerLabel', 1), 'Player 2');
});

test('rename commits are presentation-only and equity-request v1 excludes names', async () => {
  // Protects: renaming never marks Equity pending, re-checks readiness or
  // recalculates; it only relabels; the equity request carries ids, not names.
  const spy = app.spy(['setEquityPending', 'updateEquityReadiness', 'calculateEquity']);
  try {
    await app.click(labelFor(0));
    inputFor(0).value = 'Me';
    await app.key(inputFor(0), 'Enter');
    assert.equal(spy.total(), 0, JSON.stringify(Object.fromEntries(Object.entries(spy.calls).map(([name, calls]) => [name, calls.length]))));
  } finally {
    spy.restore();
  }
  assert.equal(labelFor(0).textContent, 'Me');

  const players = app.window.app.equity.players;
  players.forEach((player) => { player.name = `Named ${player.id}`; });
  const request = app.call('equityRequestFromCurrentInputs');
  assert.equal(request.schemaVersion, 'equity-request/v1');
  assert.deepEqual(request.players.map((player) => player.id), players.map((player) => player.id));
  for (const player of request.players) {
    assert.deepEqual(Object.keys(player).sort(), ['cards', 'id']);
  }
  assert.doesNotMatch(JSON.stringify(request), /Named|Me\b/);
  players.forEach((player) => { player.name = ''; });
});

test('the inline editor remains bounded by the accepted compact header', () => {
  // Protects: 26px editor/label/input height, flexible grid editor, padded
  // full-width controls, single-line label clipping.
  const editor = tileFor(0).querySelector('.equity-player-name-editor');
  assert.equal(css.cascaded(editor, 'height'), '26px');
  assert.equal(css.cascaded(editor, 'flex'), '1 1 auto');
  assert.equal(css.cascaded(editor, 'display'), 'grid');
  for (const control of [labelFor(0), inputFor(0)]) {
    assert.equal(css.cascaded(control, 'width'), '100%');
    assert.equal(css.cascaded(control, 'height'), '26px');
    assert.equal(css.cascaded(control, 'padding'), '0 var(--space-2)');
  }
  assert.equal(css.cascaded(labelFor(0), 'display'), 'flex');
  assert.equal(css.cascaded(labelFor(0), 'align-items'), 'center');
  assert.equal(css.cascaded(labelFor(0), 'overflow'), 'hidden');
});
