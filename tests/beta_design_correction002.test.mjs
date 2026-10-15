import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandDraftTablePresence } from '../app/src/application/table-presence-view-model.mjs';
import { createTableGeometryProfile, createTablePresentation } from '../app/src/application/table-presentation.mjs';
import { deriveFeatureSurfaceRoles, contrastRatio, PRESENTATION_THEMES } from '../app/src/application/presentation-theme.mjs';
import { appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: logic.js / styles.css assertions are behavioural: the Hand
// setup preview is driven in the running app (instead of slicing logic.js into
// a vm) and styles are resolved through the cascade. TableRenderer.js checks
// are outside this ticket.
const renderer = readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const setup = (tableSize = 2) => ({ tableSize, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 });
const css = appStyleSheet();
const app = await bootApp();

test('reload with Players=2 reaches the table on renderer readiness; input previews 6/10 without creating a Hand', async () => {
  // Protects: the table-ready handshake projects the setup preview; editing
  // Players/Hero/stack previews seats without creating a Hand or dealing; once a
  // Hand exists, setup edits no longer change the table.
  await app.navigate('hand');
  let displayed = null;
  app.window.addEventListener('gameStateUpdate', (event) => { displayed = event.detail; });
  const bridgeState = () => app.call('callPlaybookStateBridge', 'getState');
  assert.equal(bridgeState(), null);
  app.window.dispatchEvent(new app.window.CustomEvent('riverline:table-ready'));
  assert.equal(displayed.seats.length, 2);
  assert.equal(displayed.tablePresence.status, 'setup_preview');
  for (const count of [6, 10, 2]) {
    await app.setValue('#handTableSize', String(count), { events: ['input'] });
    assert.equal(displayed.seats.length, count);
    assert.equal(bridgeState(), null);
    assert.equal(displayed.decisionDock.available, false);
    assert.ok(displayed.seats.every((seat) => seat.prominence !== 'folded' && !seat.actorCue && !seat.showContribution));
    assert.ok(displayed.tablePresence.seats.every((seat) => !seat.hasCards && seat.cards.length === 0 && seat.latestAction === null));
  }
  const heroSeat = app.byId('handHeroSeat');
  heroSeat.value = heroSeat.options[1].value;
  await app.setValue('#handStackBb', '50', { events: ['input'] });
  await app.setValue('#handHeroSeat', heroSeat.options[1].value, { events: ['input', 'change'] });
  assert.equal(displayed.tablePresence.seats.find((seat) => seat.isHero).visualSeatIndex, 0, 'Hero stays at the bottom seat');
  assert.ok(displayed.tablePresence.seats.every((seat) => seat.currentStackMilliBb === 50000));
  assert.equal(bridgeState(), null);

  await app.setValue('#handTableSize', '6', { events: ['input'] });
  await app.click('#handStartButton');
  await app.settle(300);
  const state = bridgeState();
  assert.ok(state);
  assert.equal(displayed.seats.length, 6);
  await app.setValue('#handTableSize', '2', { events: ['input'] });
  assert.equal(displayed.seats.length, 6, 'setup edits do not resize a live Hand');
  assert.equal(bridgeState(), state);
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

test('construction outlines are absent, Home auto-flows, and resting identity does not mimic focus', async () => {
  // Protects: no construction outlines in the table SVG; Home sections flow
  // automatically (no fixed areas, no forced heights); the Hand table label is
  // a grid when shown; Equity cards outline only when focus is inside; the
  // current navigation item uses the navigation-active surface.
  assert.doesNotMatch(renderer, /<(?:rect|ellipse|path) id="table-(?:betting-line|pot-zone|riverline-mark)"/);
  await app.navigate('home');
  const homeContent = app.byId('homeWorkspaceContent');
  assert.equal(homeContent.dataset.productDestination, 'home');
  assert.equal(css.cascaded(homeContent, 'grid-template-areas'), 'none');
  for (const section of app.$$('#homeMode .home-section')) {
    assert.equal(css.cascaded(section, 'grid-area'), 'auto');
    assert.equal(css.cascaded(section, 'min-height'), '0');
  }
  const handLabel = app.$('.playbook-table-label[data-playbook-hand]');
  handLabel.hidden = false;
  assert.equal(css.cascaded(handLabel, 'display'), 'grid');
  handLabel.hidden = true;

  await app.navigate('equity');
  const card = app.$('#equityPlayers .equity-player-card');
  assert.doesNotMatch(css.cascaded(card, 'outline') || 'none', /var\(--border-focus\)/, 'no focus outline at rest');
  card.querySelector('button').focus();
  assert.match(css.cascaded(card, 'outline'), /^2px solid var\(--border-focus\)/);
  app.document.activeElement.blur();
  const current = app.$('.mode-nav-item[aria-current="page"]');
  assert.equal(css.cascaded(current, 'background'), 'var(--navigation-active-surface)');
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
