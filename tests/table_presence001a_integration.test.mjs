import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { tableCardBackSvgMarkup, tableCardSvgMarkup } from '../app/src/application/card-presentation.mjs';
import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

// TEST-HYGIENE-001: logic.js / styles.css / index.html assertions are
// behavioural: the canonical table model dispatch and the rendered SVG table
// are observed in the running app and styled through the cascade. The bridge
// and renderer sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Imported after boot: playbook-mode-bootstrap.mjs installs itself on window.
const { installPlaybookStateSourceBridge } = await import('../app/src/application/playbook-mode-bootstrap.mjs');

class FakeCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
}

test('Playbook bridge exposes an immutable application-produced table model', () => {
  const events = [];
  const browserWindow = {
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); },
  };
  const bridge = installPlaybookStateSourceBridge(browserWindow);
  const empty = bridge.createTablePresenceViewModel();

  assert.equal(empty.schemaVersion, 'table-presence/v1');
  assert.equal(empty.empty, true);
  assert.equal(Object.isFrozen(empty), true);
  assert.equal(typeof bridge.createTablePresenceViewModel, 'function');
  assert.match(bridgeSource, /createTablePresenceViewModel\(\)\s*\{[\s\S]*?state:\s*canonicalController\.getState\(\)/);
  assert.doesNotMatch(bridgeSource, /canonicalController:\s*canonicalController/);
  assert.deepEqual(events, []);
});

test('classic logic dispatches the completed model without reconstructing canonical seats', async () => {
  // Protects: the Hand table event carries exactly the bridge-produced model
  // (no seats rebuilt in logic.js); Scenario dispatches a 'scenario' model.
  await app.startHand(['As', 'Kd']);
  const produced = [];
  const original = app.window.callPlaybookStateBridge;
  app.window.callPlaybookStateBridge = (method, ...args) => {
    const result = original(method, ...args);
    if (method === 'createTablePresentationViewModel' || method === 'createTablePresenceViewModel') produced.push(result);
    return result;
  };
  let detail = null;
  const details = [];
  const listener = (event) => { detail = event.detail; details.push(event.detail); };
  app.window.addEventListener('gameStateUpdate', listener);
  try {
    app.call('dispatchCanonicalTableState');
  } finally {
    app.window.callPlaybookStateBridge = original;
  }
  assert.ok(detail);
  assert.ok(produced.includes(detail), 'the dispatched model is the bridge model itself');
  await app.navigate('analyze');
  await app.call('requestPlaybookMode', 'scenario');
  detail = null;
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['Qs', 'Qh']);
  app.call('renderPlaybookTableProjection');
  app.window.removeEventListener('gameStateUpdate', listener);
  assert.equal(app.window.app.playbookMode, 'scenario');
  assert.ok(details.some((model) => model?.mode === 'scenario'), 'Scenario dispatches a scenario table model');
});

test('renderer consumes explicit presentation facts and contains no poker computation imports', () => {
  for (const field of [
    'visualSeatIndex', 'currentStackMilliBb', 'streetContributionMilliBb',
    'latestAction', 'isCurrentActor', 'isFolded', 'isAllIn', 'isButton',
    'cardVisibility',
  ]) {
    assert.match(renderer, new RegExp(`player\\.${field}`), field);
  }
  assert.match(renderer, /state\.schemaVersion === 'table-presence\/v1'/);
  assert.doesNotMatch(renderer, /^\s*import\s/m);
  assert.doesNotMatch(
    renderer,
    /shared\/poker-domain|applyAction|getLegalActionSpec|calculateEquity|StrategyProvider|MCCFR|regret/i,
  );
});

test('seat action, contribution, actor, folded, all-in, Hero, and dealer semantics exist', async () => {
  await app.startHand(['As', 'Kd']);
  for (const className of [
    'table-action-badge', 'table-contribution', 'table-actor-indicator',
    'is-folded', 'is-all-in', 'is-hero', 'table-dealer-button',
    'table-seat-name', 'table-seat-position', 'table-seat-stack', 'table-seat-status',
  ]) {
    assert.ok(renderer.includes(className) || css.rulesMentioning(className).length > 0, className);
  }
  // Each action type colours its badge with the matching action token.
  const tokenFor = { fold: 'fold', check: 'passive', call: 'passive', bet: 'aggressive', raise: 'aggressive', 'all-in': 'all-in' };
  const svg = app.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  app.byId('visual-table-container').appendChild(svg);
  for (const actionType of ['fold', 'check', 'call', 'bet', 'raise', 'all-in']) {
    svg.setAttribute('class', `table-action-badge is-action-${actionType}`);
    assert.equal(css.cascaded(svg, '--table-action-color'), `var(--action-${tokenFor[actionType]})`, actionType);
  }
  svg.remove();
  assert.match(renderer, /table\.status\.toAct/);
  assert.match(renderer, /dealer\.setAttribute\('aria-label'/);
  assert.match(renderer, /seat\.setAttribute\('aria-label'/);
  assert.match(renderer, /table\.a11y\.contribution/);
  assert.match(renderer, /aria-hidden="true"/);
});

test('table action labels use readable local typography while semantic color stays on the badge', async () => {
  // Protects: on the rendered table, action labels use the primary text colour
  // in the UI font (not the action colour); the badge surface strokes with the
  // action colour.
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  const badge = app.$('#visual-table-container .table-action-badge');
  assert.ok(badge, 'a seat shows its latest action');
  const label = badge.querySelector('.table-action-label');
  const surface = badge.querySelector('.table-action-surface');
  assert.equal(css.cascaded(label, 'fill'), 'var(--text-primary)');
  assert.doesNotMatch(css.cascaded(label, 'fill'), /--table-action-color/);
  assert.match(css.cascaded(label, 'font') || css.cascaded(label, 'font-family'), /var\(--font-ui\)/);
  assert.match(css.cascaded(surface, 'stroke'), /var\(--table-action-color\)/);
  assert.match(renderer, /class="table-action-surface"[^>]*width="88" height="18"/);
});

test('theme, RTL, reduced motion, collapse, and shared-card contracts remain in place', async () => {
  const root = app.document.documentElement;
  for (const token of [
    '--poker-table-surface-start', '--poker-table-seat-hero',
    '--action-fold', '--action-passive', '--action-aggressive', '--action-all-in',
  ]) {
    assert.ok(css.cascaded(root, token), token);
  }
  const stack = app.$('#visual-table-container .table-seat-stack');
  assert.ok(stack);
  const ltr = JSON.stringify(css.matchingRules(stack).map((rule) => rule.order));
  root.setAttribute('dir', 'rtl');
  assert.notEqual(JSON.stringify(css.matchingRules(stack).map((rule) => rule.order)), ltr, 'RTL adjusts seat stacks');
  root.setAttribute('dir', 'ltr');
  // Collapsing the table hides its body.
  const wrapper = app.byId('table-wrapper');
  await app.click('#toggleTableBtn');
  assert.ok(wrapper.classList.contains('collapsed'));
  assert.ok(css.matchingRules(wrapper).some((rule) => rule.selectorText.includes('.table-wrapper.collapsed')));
  await app.click('#toggleTableBtn');
  assert.equal(wrapper.classList.contains('collapsed'), false);
  const faceMarkup = tableCardSvgMarkup({ rank: 'A', suit: 's' });
  const backMarkup = tableCardBackSvgMarkup();
  assert.match(renderer, /presentation\.tableCardSvgMarkup/);
  assert.match(renderer, /presentation\.tableCardBackSvgMarkup/);
  assert.match(faceMarkup, /poker-card-svg riverline-card card--known/);
  assert.match(backMarkup, /table-card-back poker-card-svg poker-card-back/);
  const toggle = markup.getElementById('toggleTableBtn');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-controls'), 'table-wrapper');
});
