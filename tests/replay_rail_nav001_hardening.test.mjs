import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createTablePresentation,
  TABLE_VISUAL_STATES,
} from '../app/src/application/table-presentation.mjs';
import { appStyleSheet, bootApp, indexDocument, precedes } from './helpers/app-under-test.mjs';

const RENDERER = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

// TEST-HYGIENE-001: index.html / logic.js / styles.css assertions are
// behavioural (the running Hand workspace, parsed markup, the cascade).
// TableRenderer.js is outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();

function tablePresence(playerCount) {
  return {
    schemaVersion: 'table-presence/v1',
    empty: false,
    board: [],
    potMilliBb: 1_500,
    deductionTotalMilliBb: 0,
    showStreetContributions: true,
    seats: Array.from({ length: playerCount }, (_, visualSeatIndex) => ({
      playerId: `p${visualSeatIndex}`,
      seat: visualSeatIndex,
      visualSeatIndex,
      position: visualSeatIndex === 0 ? 'BTN' : `P${visualSeatIndex + 1}`,
      isHero: visualSeatIndex === 0,
      isButton: visualSeatIndex === 0,
      isCurrentActor: visualSeatIndex === 1,
      isWaitingToAct: visualSeatIndex === 1,
      isFolded: false,
      isAllIn: false,
      isDealtIn: true,
      currentStackMilliBb: 100_000,
      startingStackMilliBb: 100_000,
      streetContributionMilliBb: visualSeatIndex < 2 ? 500 + (visualSeatIndex * 500) : 0,
      totalPotContributionMilliBb: visualSeatIndex < 2 ? 500 + (visualSeatIndex * 500) : 0,
      cardVisibility: visualSeatIndex === 0 ? 'known' : 'hidden',
      hasCards: true,
      cards: visualSeatIndex === 0
        ? [{ id: 'Ts', rank: 'T', suit: 's' }, { id: '9h', rank: '9', suit: 'h' }]
        : [],
      latestAction: null,
    })),
  };
}

function rectDistance(left, right) {
  const dx = Math.max(right.x - (left.x + left.width), left.x - (right.x + right.width), 0);
  const dy = Math.max(right.y - (left.y + left.height), left.y - (right.y + right.height), 0);
  return Math.hypot(dx, dy);
}

test('count-specific composition keeps player panels distinct and Hero below the felt center', () => {
  for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    });
    const unit = presentation.geometry.playerUnit;
    const hero = presentation.seats[0];
    const heroBounds = {
      x: (hero.anchor.x * 1000) - (unit.width / 2),
      y: (hero.anchor.y * 650) - (unit.height / 2),
      width: unit.width,
      height: unit.height,
    };
    const bounds = presentation.geometry.tableBounds;
    assert.ok(heroBounds.y > bounds.y + bounds.height / 2);
    assert.ok(heroBounds.x >= bounds.x && heroBounds.x + heroBounds.width <= bounds.x + bounds.width);
    const panels = presentation.seats.map(seat => ({ x: seat.anchor.x * 1000 - unit.width / 2,
      y: seat.anchor.y * 650 - unit.height / 2, width: unit.width, height: unit.height }));
    for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
      assert.ok(rectDistance(panels[i], panels[j]) > 0, `${playerCount} seats ${i}/${j} overlap`);
    }
    assert.equal(presentation.geometry.contributionFraction, 0.62);
  }
});

test('HU players face each other on a shared axis with cards owned by radial felt lanes', () => {
  const presentation = createTablePresentation({
    tablePresence: tablePresence(2),
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  });
  const [hero, opponent] = presentation.seats;
  assert.equal(hero.anchor.x, opponent.anchor.x);
  assert.ok(hero.anchor.y > presentation.geometry.potAnchor.y);
  assert.ok(opponent.anchor.y < presentation.geometry.potAnchor.y);
  assert.ok(presentation.geometry.tableBounds.width < createTablePresentation({ tablePresence: tablePresence(6) }).geometry.tableBounds.width);
  assert.match(RENDERER, /cardSeatGap = Math\.max\(12, Math\.round\(cardOverlapUnits \* 0\.30\)\)/);
  assert.match(RENDERER, /data-card-lane="radial-felt"/);
  assert.doesNotMatch(RENDERER, /table-seat-connector|table-card-cradle/);
});

test('contributions move outward, Dealer moves inward, and canonical values stay presentation inputs', () => {
  for (const playerCount of [2, 6, 10]) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    });
    const pot = presentation.geometry.potAnchor;
    const distance = (point) => Math.hypot(point.x - pot.x, point.y - pot.y);
    for (const seat of presentation.seats) {
      assert.ok(distance(seat.anchor) > distance(seat.dealerAnchor));
      assert.ok(distance(seat.dealerAnchor) > distance(seat.contributionAnchor));
      assert.ok(distance(seat.contributionAnchor) >= distance(seat.anchor) * 0.37);
    }
  }
});

test('known-opponent expansion is internally scrollable and cannot resize the table rows', async () => {
  // Protects: the known-opponent list scrolls inside a bounded block with a
  // stable gutter and a sticky summary; the Hand workspace rows are content
  // sized so the expansion cannot resize the table; the interaction rail
  // scrolls within the viewport.
  await app.navigate('hand');
  if (app.call('callPlaybookStateBridge', 'getState')) {
    await app.click('#handResetButton');
    await app.settle(300);
  }
  await app.setValue('#handTableSize', '6', { events: ['input', 'change'] });
  await app.click('#handStartButton');
  await app.settle(300);
  const known = app.$('.hand-known-opponents');
  assert.ok(known, 'a six-handed deal offers known opponent cards');
  known.open = true;
  const list = known.querySelector('.hand-known-opponent-list');
  assert.equal(css.cascaded(list, 'max-block-size'), 'min(42dvh, 480px)');
  assert.equal(css.cascaded(list, 'overflow-y'), 'auto');
  assert.equal(css.cascaded(list, 'scrollbar-gutter'), 'stable');
  assert.equal(css.cascaded(known.querySelector(':scope > summary'), 'position'), 'sticky');
  assert.equal(css.cascaded(app.$('#gtoMode .playbook-decision-workspace'), 'grid-template-rows', { width: 1920 }), 'max-content max-content minmax(0, auto)');
  const rail = app.byId('handInteractionRail');
  const hidden = rail.hidden;
  rail.hidden = false;
  assert.equal(css.cascaded(rail, 'max-block-size', { width: 1920 }), 'calc(100dvh - (2 * var(--space-3)))');
  assert.equal(css.cascaded(rail, 'overflow-y', { width: 1920 }), 'auto');
  rail.hidden = hidden;
});

test('Abort belongs to Current Hand and is derived only for a live nonterminal canonical hand', async () => {
  // Protects: Abort lives in Current Hand (not Setup), hidden by default, and
  // is shown/enabled only for a live, non-terminal canonical hand.
  const setup = markup.getElementById('handSetupSection');
  const current = markup.getElementById('handStateSection');
  assert.equal(setup.querySelector('#handResetButton'), null);
  const reset = current.querySelector('.hand-current-actions #handResetButton');
  assert.ok(reset);
  assert.equal(reset.hidden, true);

  await app.navigate('hand');
  if (app.call('callPlaybookStateBridge', 'getState')) {
    await app.click('#handResetButton');
    await app.settle(300);
  }
  await app.setValue('#handTableSize', '2', { events: ['input', 'change'] });
  await app.startHand(['As', 'Kd']);
  const live = app.byId('handResetButton');
  assert.equal(live.hidden, false);
  assert.equal(live.disabled, false);
  await app.handAction('fold');
  const state = app.call('callPlaybookStateBridge', 'getState');
  assert.ok(state.phase === 'terminal' || state.terminal?.isTerminal);
  app.call('renderCanonicalHandWorkspace');
  assert.equal(live.hidden, true, 'no Abort once the hand is terminal');
  assert.equal(live.disabled, true);
});

test('Daylight contribution readability uses explicit semantic surface, text, halo, border, and chip roles', async () => {
  const root = app.document.documentElement;
  const previous = root.dataset.theme;
  root.dataset.theme = 'daylight';
  try {
    for (const token of [
      '--poker-table-contribution-surface',
      '--poker-table-contribution-border',
      '--poker-table-contribution-text',
      '--poker-table-contribution-text-halo',
      '--poker-table-contribution-chip',
    ]) assert.ok(css.cascaded(root, token), token);
    assert.ok(css.matchingRules(root).some((rule) => rule.selectorText.includes('data-theme="daylight"')
      && rule.declarations.some((declaration) => declaration.property === '--poker-table-contribution-surface')));
    assert.equal(css.cascaded(root, '--poker-table-contribution-text'), 'var(--text-primary)');
  } finally {
    root.dataset.theme = previous;
  }
  await app.startHand(['As', 'Kd']);
  const amount = app.$('#visual-table-container .poker-table-amount--contribution .poker-table-amount-text');
  assert.ok(amount, 'blinds render as contributions');
  assert.equal(css.cascaded(amount, 'fill'), 'var(--poker-table-contribution-text)');
  assert.equal(css.cascaded(amount, 'stroke'), 'var(--poker-table-contribution-text-halo)');
});
