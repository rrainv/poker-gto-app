import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, strategyProviderProbe } from './helpers/app-under-test.mjs';

// EXTRACT-ANALYZE-001: the decision panel is a mounted module
// (app/src/application/analyze-decision-panel.mjs). The behaviour itself is
// pinned by extract_analyze_000_characterization; this file pins the module
// contract: controller interface, injected visibility, no provider access.

const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
const panel = () => app.call('decisionPanel');

/** Resolve a decision (Hero AA) through the real picker so Explain is reachable. */
async function resolveDecision() {
  await app.navigate('analyze');
  const edit = '#gtoMode [data-card-set-edit="hero"]';
  await app.click(edit);
  await app.click('#cardSetPickerClear');
  if (!app.isShown(app.$('[data-deck-card]'))) await app.click(edit);
  for (const card of ['As', 'Ah']) await app.click('[data-deck-card="' + card + '"]');
  await app.click('#cardSetPickerApply');
  await app.settle(200);
}

test('mounts on #recommendation with the controller interface', async () => {
  await app.navigate('analyze');
  const controller = panel();
  assert.ok(controller, 'the module mounted');
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible']) {
    assert.equal(typeof controller[method], 'function', method);
  }
  assert.equal(app.call('decisionPanel'), controller, 'one controller per page');
});

test('Explain open state belongs to the panel; T and the toggle agree', async () => {
  await resolveDecision();
  const controller = panel();
  assert.equal(controller.isExplainOpen(), false);
  assert.equal(controller.handleKey({ key: 'x' }), false, 'other keys are not handled');
  assert.equal(controller.handleKey({ key: 't' }), true);
  assert.equal(controller.isExplainOpen(), true);
  assert.equal(app.byId('toggleTeacher').getAttribute('aria-expanded'), 'true');
  assert.equal(app.byId('teacherContent').style.display, 'block');
  await app.click('#toggleTeacher');
  assert.equal(controller.isExplainOpen(), false);
  assert.equal(app.byId('teacherContent').style.display, 'none');
});

test('visibility is pushed in with setVisible, never read from the DOM', async () => {
  await resolveDecision();
  const controller = panel();
  controller.handleKey({ key: 'T' });
  app.call('playbookSurfaceIsVisible', 'analysis');
  assert.equal(controller.isVisible(), true, 'the orchestrator pushed the shown state');
  assert.equal(controller.isExplainVisible(), true);
  controller.setVisible(false);
  assert.equal(controller.isExplainVisible(), false, 'hidden means Explain does not render');
  controller.handleKey({ key: 't' });
  controller.setVisible(true);
});

test('refreshLanguage repaints a given view and reports whether it had one', () => {
  const controller = panel();
  assert.equal(controller.refreshLanguage(null), false);
});

test('the module never reaches strategy resolution or window.app', () => {
  const source = fs.readFileSync(new URL('../app/src/application/analyze-decision-panel.mjs', import.meta.url), 'utf8');
  const code = source.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /strategyProvider|\.resolve\(/, 'no provider call in the panel');
  assert.doesNotMatch(code, /window\.app\b|globalThis\.app\b/, 'no window.app access');
  assert.doesNotMatch(code, /getElementById|document\.querySelector/, 'queries stay inside the mounted container');
});

test('dispose removes the panel listeners', async () => {
  await resolveDecision();
  const controller = panel();
  controller.dispose();
  const before = controller.isExplainOpen();
  await app.click('#toggleTeacher');
  assert.equal(controller.isExplainOpen(), before, 'a disposed panel no longer reacts');
});
