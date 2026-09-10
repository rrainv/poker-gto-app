import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createHandDraftTablePresence } from '../app/src/application/table-presence-view-model.mjs';
import { createTableGeometryProfile, createTablePresentation } from '../app/src/application/table-presentation.mjs';
import { deriveFeatureSurfaceRoles, contrastRatio, PRESENTATION_THEMES } from '../app/src/application/presentation-theme.mjs';

const logic = readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/src/ui/riverline-design.css', import.meta.url), 'utf8');
const setup = (tableSize = 2) => ({ tableSize, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 });

test('reload with Players=2 reaches the table on renderer readiness; input previews 6/10 without creating a Hand', () => {
  const events = new Map(), controls = new Map(); let draft = setup(), displayed = null, syncs = 0;
  const window = { CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    addEventListener(type, fn) { const rows = events.get(type) ?? []; rows.push(fn); events.set(type, rows); },
    dispatchEvent(event) { for (const fn of events.get(event.type) ?? []) fn(event); } };
  const bridge = installPlaybookStateSourceBridge(window); bridge.setMode('hand');
  for (const id of ['handTableSize', 'handCollectionType', 'handAnteType', 'handStackBb', 'handHeroSeat', 'handButtonSeat']) {
    controls.set(`#${id}`, { dataset: {}, selectedOptions: [{ dataset: { position: 'BTN' } }], addEventListener(type, fn) { this[type] = fn; } });
  }
  const context = vm.createContext({ window, CustomEvent: window.CustomEvent,
    $: selector => controls.get(selector), isHandMode: () => bridge.getMode() === 'hand',
    app: { playbookHandDraft: { actionSubmissionLocked: false } },
    callPlaybookStateBridge: (method, ...args) => bridge[method](...args),
    canonicalHandTableSizeValidation: () => ({ valid: true }),
    readCanonicalHandConfiguration: () => draft, syncHandSeatSelectors: () => { syncs++; },
  });
  vm.runInContext(logic.slice(logic.indexOf('function dispatchCanonicalTableState()'), logic.indexOf('\nfunction renderCanonicalHandWorkspace()')), context);
  const bindStart = logic.indexOf('function bindCanonicalHandWorkspace()') + 'function bindCanonicalHandWorkspace() {'.length;
  vm.runInContext(logic.slice(bindStart, logic.indexOf("  if ($('#handStartButton'))", bindStart)), context);
  // Initial app event may precede construction; the readiness handshake reprojects.
  context.dispatchCanonicalTableState();
  window.addEventListener('gameStateUpdate', event => { displayed = event.detail; });
  window.dispatchEvent(new window.CustomEvent('riverline:table-ready'));
  assert.equal(displayed.seats.length, 2); assert.equal(displayed.tablePresence.status, 'setup_preview');
  for (const count of [6, 10, 2]) {
    draft = setup(count); controls.get('#handTableSize').input();
    assert.equal(displayed.seats.length, count); assert.equal(bridge.getState(), null);
    assert.equal(displayed.decisionDock.available, false);
    assert.ok(displayed.seats.every(seat => seat.prominence !== 'folded' && !seat.actorCue && !seat.showContribution));
    assert.ok(displayed.tablePresence.seats.every(seat => !seat.hasCards && seat.cards.length === 0 && seat.latestAction === null));
  }
  draft = { ...draft, heroSeat: 1, buttonSeat: 1, stackBb: 50 }; controls.get('#handHeroSeat').input();
  assert.equal(displayed.tablePresence.seats.find(seat => seat.isHero).visualSeatIndex, 0);
  assert.equal(displayed.tablePresence.seats[1].currentStackMilliBb, 50000);
  assert.ok(syncs >= 4); assert.equal(bridge.getState(), null);
  const state = bridge.initializeHand(setup(6)); assert.ok(state);
  context.dispatchCanonicalTableState(); assert.equal(displayed.seats.length, 6);
  draft = setup(2); controls.get('#handTableSize').input();
  assert.equal(displayed.seats.length, 6); assert.equal(bridge.getState(), state);
  assert.match(renderer, /this.currentActivePlayers = 0/);
});

test('invalid draft clears seats; preview never invents forced contributions or dealt cards', () => {
  for (const invalid of [{ tableSize: 0 }, { heroSeat: 9 }, { buttonSeat: -1 }, { stackBb: NaN }]) {
    assert.equal(createHandDraftTablePresence({ ...setup(), ...invalid }).empty, true);
  }
  const preview = createHandDraftTablePresence({ ...setup(10), gameMode: 'clubgg', anteBb: 10 });
  assert.equal(preview.potMilliBb, 0); assert.equal(preview.currentActorSeat, null);
  assert.equal(preview.showStreetContributions, false); assert.ok(Object.isFrozen(preview.seats));
});

test('construction outlines are absent, Home auto-flows, and resting identity does not mimic focus', () => {
  assert.doesNotMatch(renderer, /<(?:rect|ellipse|path) id="table-(?:betting-line|pot-zone|riverline-mark)"/);
  assert.match(css, /#homeWorkspaceContent\[data-product-destination="home"\] \{\s*grid-template-areas: none/);
  assert.match(css, /home-section \{ grid-area: auto; min-height: 0/);
  assert.match(css, /playbook-table-label\[data-playbook-hand\]:not\(\[hidden\]\) \{ display: grid/);
  assert.match(css, /equity-player-card:focus-within \{ outline: 2px solid var\(--border-focus\)/);
  assert.match(css, /mode-nav-item\[aria-current="page"\] \{\s*background: var\(--navigation-active-surface\)/);
});

test('Scenario geometry consumes the same count-specific profile as canonical table presentation', () => {
  for (const count of [2, 3, 4, 6, 8, 10]) {
    const presence = createHandDraftTablePresence(setup(count));
    const presentation = createTablePresentation({ tablePresence: presence });
    assert.deepEqual(createTableGeometryProfile(count).geometry, presentation.geometry);
  }
  assert.ok(createTableGeometryProfile(2).geometry.tableBounds.width < createTableGeometryProfile(6).geometry.tableBounds.width);
});

test('new active/evidence/navigation roles retain contrast and dark analysis is distinct from felt', () => {
  for (const colors of [...PRESENTATION_THEMES.map(t => t.preview), { surface: '#101028', accent: '#aa77dd', felt: '#ddcc99' }, { surface: '#ffffff', accent: '#ffffff', felt: '#000000' }]) {
    const roles = deriveFeatureSurfaceRoles(colors);
    for (const [text, bg] of [['--analysis-text', '--analysis-primary-surface'], ['--evidence-text', '--evidence-surface'], ['--navigation-active-text', '--navigation-active-surface']]) {
      assert.ok(contrastRatio(roles[text], roles[bg]) >= 4.5, `${text} on ${bg}`);
    }
    assert.notEqual(roles['--analysis-surface'], roles['--game-surface']);
  }
});
