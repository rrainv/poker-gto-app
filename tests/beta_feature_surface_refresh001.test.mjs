import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveFeatureSurfaceRoles, contrastRatio, PRESENTATION_THEMES, createPresentationThemeController } from '../app/src/application/presentation-theme.mjs';
import { tableSeatAnchors } from '../app/src/application/table-presentation.mjs';
import { createTrainingLineupPreview } from '../app/src/ui/training-lineup-preview.mjs';
import { deriveSeatAssignments, POSITIONS_BY_TABLE_SIZE } from '../shared/poker-domain/positions.js';
import { createTableCast } from '../app/src/ui/table-environment.mjs';
import { groupPresentedRunouts } from '../app/src/application/advanced-equity-workspace.mjs';

test('feature foregrounds remain readable across built-ins and opposing extreme custom inputs', () => {
  const extremes = ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff'];
  const colors = [...PRESENTATION_THEMES.map(theme => theme.preview), ...extremes.flatMap(surface => extremes.flatMap(accent => extremes.map(felt => ({ surface, accent, felt }))))];
  const pairs = {
    'analysis-text': ['analysis-surface', 'analysis-surface-raised'],
    'analysis-secondary': ['analysis-surface', 'analysis-surface-raised'],
    'analysis-muted': ['analysis-surface', 'analysis-surface-raised'],
    'table-seat-text': ['table-seat-surface', 'table-hero-surface', 'table-actor-surface'],
    'table-felt-text': ['table-felt-start', 'table-felt-end'],
    'table-accent-text': ['table-accent'], 'learning-text': ['learning-surface'],
    'game-text': ['game-background', 'game-surface'], 'game-secondary': ['game-background'],
  };
  for (const color of colors) {
    const roles = deriveFeatureSurfaceRoles(color);
    for (const [foreground, backgrounds] of Object.entries(pairs)) for (const background of backgrounds) {
      assert.ok(contrastRatio(roles[`--${foreground}`], roles[`--${background}`]) >= 4.5, `${JSON.stringify(color)} ${foreground}/${background}`);
    }
  }
});

test('feature roles follow preview, duplicate, save and cancel through the existing theme owner', () => {
  const values = new Map(), properties = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) } };
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const controller = createPresentationThemeController({ root, storage });
  controller.apply('daylight');
  const original = properties.get('--game-background');
  controller.customize({ surface: '#091029', felt: '#774baa', accent: '#eead33' });
  assert.notEqual(properties.get('--game-background'), original);
  const preview = properties.get('--table-felt-start');
  const saved = controller.saveAsNew('Night violet');
  assert.equal(properties.get('--table-felt-start'), preview);
  controller.beginEdit(); controller.customize({ felt: '#eeeeee' });
  assert.notEqual(properties.get('--table-felt-start'), preview);
  controller.cancelEdit(); assert.equal(properties.get('--table-felt-start'), preview);
  assert.equal(controller.getTheme(), saved.id);
  controller.apply('daylight'); assert.equal(properties.get('--game-background'), original);
  assert.equal([...properties.keys()].some(key => key.startsWith('--card-')), false);
});

test('2–10 seat anchors keep Hero bottom, complete seats within the SVG, and avoid seat intersections', () => {
  for (let count = 2; count <= 10; count++) {
    const anchors = tableSeatAnchors(count);
    assert.equal(anchors.length, count);
    assert.equal(anchors[0][0], .5);
    assert.ok(anchors[0][1] > .8);
    const width = count === 2 ? 150 : count <= 4 ? 138 : count <= 6 ? 122 : 104;
    const height = count === 2 ? 78 : count <= 4 ? 74 : count <= 6 ? 70 : 62;
    for (const [index, [x, y]] of anchors.entries()) {
      assert.ok(x * 1000 - width / 2 >= 0 && x * 1000 + width / 2 <= 1000);
      assert.ok(y * 650 - height / 2 >= 18 && y * 650 + height / 2 <= 650);
      for (const [otherX, otherY] of anchors.slice(index + 1)) {
        assert.ok(Math.abs(x - otherX) * 1000 > width + 8 || Math.abs(y - otherY) * 650 > height + 8, `${count}-max seats overlap`);
      }
    }
  }
});

test('idle lineup matches canonical button/position assignments and live appearance without fabricating Hand facts', () => {
  for (const playerCount of [2, 3, 4, 6, 8, 10]) for (const heroPosition of POSITIONS_BY_TABLE_SIZE[playerCount]) {
    const preview = createTrainingLineupPreview({ playerCount, heroPosition });
    const liveAssignments = deriveSeatAssignments(Array.from({ length: playerCount }, (_, seat) => ({ seat, playerId: `training-seat-${seat}` })), 0)
      .map(player => ({ ...player, isHero: player.position === heroPosition }));
    const liveCast = createTableCast(); liveCast.sync(liveAssignments, true);
    assert.equal(preview.filter(player => player.isHero).length, 1);
    for (const player of preview) {
      assert.equal(player.position, liveAssignments[player.seat].position);
      assert.equal(player.identity, liveCast.identity(player.seat));
      for (const key of ['cards', 'pot', 'currentActorSeat', 'action', 'equity']) assert.equal(Object.hasOwn(player, key), false);
    }
  }
  assert.deepEqual(createTrainingLineupPreview({ playerCount: 8, heroPosition: 'invalid' }), []);
});

test('runout groups separate category improvement from Equity and preserve unavailable facts', () => {
  const improvedButLosing = { equityDelta: -.4, categoryImproved: true, resultingHand: { category: 'three_of_a_kind' }, completion: { category: 'three_of_a_kind' } };
  const unknown = { equityDelta: null, categoryImproved: null, resultingHand: null, completion: null };
  assert.equal(groupPresentedRunouts([improvedButLosing], 'equityChange')[0].key, 'lowersEquity');
  assert.equal(groupPresentedRunouts([improvedButLosing], 'handChange')[0].key, 'improved');
  assert.equal(groupPresentedRunouts([improvedButLosing], 'completion')[0].key, 'three_of_a_kind');
  for (const group of ['equityChange', 'handChange', 'completion']) assert.equal(groupPresentedRunouts([unknown], group)[0].key, 'unavailable');
});

test('Understanding reserves the second column only for a visible question and collapses on narrow screens', () => {
  const css = readFileSync(new URL('../app/src/ui/riverline-design.css', import.meta.url), 'utf8');
  assert.match(css, /calibration-configured-state > \.calibration-personal-column\s*\{\s*grid-column: 1 \/ -1; grid-row: auto/);
  assert.match(css, /calibration-configured-state:has\(> \.calibration-question-view:not\(\[hidden\]\)\)\s*\{\s*grid-template-columns: minmax\(0, 1.05fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*calibration-configured-state:has[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});
