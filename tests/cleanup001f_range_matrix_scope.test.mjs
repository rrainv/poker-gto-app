// TEST-HYGIENE-001: behavioural rewrite. Renders the real Range Matrix in the
// running app instead of slicing renderChart() out of logic.js.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp();

test('Range Matrix gives every cell a local action list and never writes window.actions', async () => {
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.click('[data-gto-view="chart"]');
  await app.settle(200);
  app.call('renderChart');

  // Protects: no global `actions` leak from the Matrix render.
  assert.equal(Object.hasOwn(app.window, 'actions'), false);
  assert.equal(app.window.actions, undefined);

  const model = app.window.app.matrixModel;
  const cells = app.$$('#strategyGrid .hand-cell');
  assert.equal(cells.length, 169);
  assert.equal(model.cells.length, 169);
  // Protects: one local action list per cell (no shared mutable list).
  assert.equal(new Set(model.cells.map((cell) => cell.actions)).size, 169);
  assert.ok(model.cells.some((cell) => cell.actions.length), 'a preflop spot has available strategy cells');

  // Protects: the dominant action is the highest-frequency entry; its kind
  // (or 'unavailable') drives the cell's action class.
  model.cells.forEach((cell, index) => {
    const dominant = cell.actions.reduce((highest, action) => (
      Number(action.value) > Number(highest?.value ?? -1) ? action : highest), null);
    const type = dominant?.kind || 'unavailable';
    assert.ok(cells[index].classList.contains(`action-${type}`), `${cell.hand}: action-${type} in "${cells[index].className}"`);
    assert.equal(cells[index].dataset.state, cell.actions.length ? 'available' : 'unavailable');
  });
});
