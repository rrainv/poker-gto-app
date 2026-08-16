import test from 'node:test';
import assert from 'node:assert/strict';

import { computeCoachMarkPlacement, computeSpotlightRect } from '../app/src/tutorial/coach-mark.mjs';

function assertWithinViewport(result, panel, viewport, margin = 12) {
  assert.ok(result.left >= margin);
  assert.ok(result.top >= margin);
  assert.ok(result.left + panel.width <= viewport.width - margin + 0.001);
  assert.ok(result.top + panel.height <= viewport.height - margin + 0.001);
}

test('placement prefers a safe adjacent side and stays inside the viewport', () => {
  const viewport = { width: 1024, height: 768 };
  const panel = { width: 360, height: 220 };
  const result = computeCoachMarkPlacement({
    targetRect: { left: 300, right: 700, top: 100, bottom: 200, width: 400, height: 100 },
    panelSize: panel,
    viewport,
    preference: 'bottom',
  });
  assert.equal(result.mode, 'bottom');
  assertWithinViewport(result, panel, viewport);
  assert.ok(result.top >= 214);
});

test('placement falls back compactly without horizontal or vertical overflow', () => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 2560, height: 1600 },
  ]) {
    const panel = { width: 400, height: Math.min(500, viewport.height - 24) };
    const result = computeCoachMarkPlacement({
      targetRect: { left: 0, right: viewport.width, top: 0, bottom: viewport.height, width: viewport.width, height: viewport.height },
      panelSize: panel,
      viewport,
      preference: 'right',
    });
    assert.equal(result.mode, 'center');
    assertWithinViewport(result, panel, viewport);
  }
});

test('spotlight geometry clips a partially visible bottom target to the viewport', () => {
  assert.deepEqual(computeSpotlightRect({
    targetRect: { top: 663, right: 995, bottom: 779, left: 506 },
    viewport: { width: 1024, height: 768 },
    pad: 6,
  }), { top: 657, left: 500, width: 501, height: 111 });
});
