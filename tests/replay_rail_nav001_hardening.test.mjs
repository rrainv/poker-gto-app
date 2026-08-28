import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createTablePresentation,
  TABLE_VISUAL_STATES,
} from '../app/src/application/table-presentation.mjs';

const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const RENDERER = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

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

test('Hero uses the same attached rail language across HU through full ring', () => {
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
    assert.ok(rectDistance(heroBounds, presentation.geometry.tableBounds) <= 15,
      `${playerCount}-player Hero must not float away from the table`);
    assert.ok(presentation.geometry.tableBounds.width >= 900);
    assert.equal(presentation.geometry.contributionFraction, 0.62);
  }
});

test('HU opposing panels attach symmetrically while cards remain on radial felt lanes', () => {
  const presentation = createTablePresentation({
    tablePresence: tablePresence(2),
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  });
  const unit = presentation.geometry.playerUnit;
  const distances = presentation.seats.map((seat) => rectDistance({
    x: (seat.anchor.x * 1000) - (unit.width / 2),
    y: (seat.anchor.y * 650) - (unit.height / 2),
    width: unit.width,
    height: unit.height,
  }, presentation.geometry.tableBounds));
  assert.ok(Math.abs(distances[0] - distances[1]) <= 1);
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

test('known-opponent expansion is internally scrollable and cannot resize the table rows', () => {
  assert.match(CSS, /\.hand-known-opponent-list\s*\{[\s\S]*?max-block-size: min\(42dvh, 480px\)[\s\S]*?overflow-y: auto[\s\S]*?scrollbar-gutter: stable/);
  assert.match(CSS, /\.hand-known-opponents\[open\] > summary\s*\{[^}]*position: sticky/);
  assert.match(CSS, /grid-template-rows: max-content max-content minmax\(0, auto\)/);
  assert.match(CSS, /#handInteractionRail:not\(\[hidden\]\)[\s\S]*?max-block-size: calc\(100dvh - \(2 \* var\(--space-3\)\)\)[\s\S]*?overflow-y: auto/);
});

test('Abort belongs to Current Hand and is derived only for a live nonterminal canonical hand', () => {
  const setup = HTML.slice(HTML.indexOf('id="handSetupSection"'), HTML.indexOf('id="handStateSection"'));
  const current = HTML.slice(HTML.indexOf('id="handStateSection"'), HTML.indexOf('id="handReviewMount"'));
  assert.doesNotMatch(setup, /id="handResetButton"/);
  assert.match(current, /class="hand-current-actions"[\s\S]*?id="handResetButton"[^>]*hidden/);
  assert.match(LOGIC, /const abortable = Boolean\(state[\s\S]*?!savedViewer[\s\S]*?state\.phase !== 'terminal'[\s\S]*?state\.terminal\?\.isTerminal !== true\)/);
  assert.match(LOGIC, /reset\.hidden = !abortable[\s\S]*?reset\.disabled = !abortable/);
});

test('Daylight contribution readability uses explicit semantic surface, text, halo, border, and chip roles', () => {
  for (const token of [
    '--poker-table-contribution-surface',
    '--poker-table-contribution-border',
    '--poker-table-contribution-text',
    '--poker-table-contribution-text-halo',
    '--poker-table-contribution-chip',
  ]) assert.match(CSS, new RegExp(token));
  assert.match(CSS, /\[data-theme="daylight"\]\s*\{[\s\S]*?--poker-table-contribution-surface:[\s\S]*?--poker-table-contribution-text: var\(--text-primary\)/);
  assert.match(CSS, /\.poker-table-amount--contribution \.poker-table-amount-text\s*\{[\s\S]*?fill: var\(--poker-table-contribution-text\)[\s\S]*?stroke: var\(--poker-table-contribution-text-halo\)/);
});
