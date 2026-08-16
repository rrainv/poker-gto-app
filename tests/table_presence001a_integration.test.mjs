import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

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

test('classic logic dispatches the completed model without reconstructing canonical seats', () => {
  const start = logic.indexOf('function dispatchCanonicalTableState()');
  const end = logic.indexOf('\nfunction renderCanonicalHandWorkspace()', start);
  const dispatch = logic.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(dispatch, /callPlaybookStateBridge\('createTablePresenceViewModel'\)/);
  assert.match(dispatch, /detail:\s*tableModel/);
  assert.doesNotMatch(dispatch, /\.players\.map|potMilliBb|streetContributionMilliBb|actionHistory/);
  assert.match(logic, /mode:\s*'scenario'/);
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

test('seat action, contribution, actor, folded, all-in, Hero, and dealer semantics exist', () => {
  for (const className of [
    'table-action-badge', 'table-contribution', 'table-actor-indicator',
    'is-folded', 'is-all-in', 'is-hero', 'table-dealer-button',
    'table-seat-name', 'table-seat-position', 'table-seat-stack', 'table-seat-status',
  ]) {
    assert.match(`${renderer}\n${css}`, new RegExp(className), className);
  }
  for (const actionType of ['fold', 'check', 'call', 'bet', 'raise', 'all-in']) {
    assert.match(css, new RegExp(`is-action-${actionType}`));
  }
  assert.match(renderer, /table\.status\.toAct/);
  assert.match(renderer, /dealer\.setAttribute\('aria-label'/);
  assert.match(renderer, /seat\.setAttribute\('aria-label'/);
  assert.match(renderer, /table\.a11y\.contribution/);
  assert.match(renderer, /aria-hidden="true"/);
});

test('table action labels use readable local typography while semantic color stays on the badge', () => {
  const labelRule = css.match(/\.table-action-label\s*\{([^}]*)\}/)?.[1] || '';
  const surfaceRule = css.match(/\.table-action-surface\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(labelRule, /fill:\s*var\(--text-primary\)/);
  assert.match(labelRule, /font:\s*800 8px\/1 var\(--font-ui\)/);
  assert.doesNotMatch(labelRule, /var\(--table-action-color\)/);
  assert.match(surfaceRule, /stroke:[^;]*var\(--table-action-color\)/);
  assert.match(renderer, /class="table-action-surface"[^>]*width="88" height="18"/);
});

test('theme, RTL, reduced motion, collapse, and shared-card contracts remain in place', () => {
  for (const token of [
    '--poker-table-surface-start', '--poker-table-seat-hero',
    '--action-fold', '--action-passive', '--action-aggressive', '--action-all-in',
  ]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /\[dir="rtl"\] \.table-seat-stack/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.table-wrapper\.collapsed/);
  assert.match(renderer, /poker-card-svg riverline-card card--known/);
  assert.match(renderer, /table-card-back poker-card-svg poker-card-back/);
  assert.match(html, /id="toggleTableBtn"[^>]*aria-expanded="true"[^>]*aria-controls="table-wrapper"/);
});
