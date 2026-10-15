import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { CARD_GEOMETRY, tableCardSvgMarkup } from '../app/src/application/card-presentation.mjs';

const playbackSource = fs.readFileSync(
  new URL('../app/src/application/replay-playback-controller.mjs', import.meta.url),
  'utf8',
);
const projectionSource = fs.readFileSync(
  new URL('../app/src/application/replay-projection-controller.mjs', import.meta.url),
  'utf8',
);
const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: Replay playback, navigation, timeline and motion lifecycle run
// in the booted Hand workspace; markup is parsed and styling resolved through
// the cascade. Playback/projection/bridge/renderer/translation sources are
// outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
// SOURCE-SHAPE: "the REPLAY-001C motion block uses theme tokens (no literal
// hex colours) and no infinite/alternate/rotate/bounce motion" is a policy
// lint over the block as authored (parsed, not regex-matched).
const replayBlock = (endToken) => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('/* REPLAY-001C:')) + 2;
  const end = raw.indexOf(endToken, start);
  const slice = raw.slice(start, end);
  return new StyleSheetModel(slice.slice(0, Math.max(slice.lastIndexOf('}'), 0) + 1));
};
const replayMotion = replayBlock('Surface styles relocated from the retired');
const replayPaint = replayBlock('[dir="rtl"] .table-seat-stack');
const app = await bootApp();
const bridgeCalls = (spy) => spy.calls.callPlaybookStateBridge.map(([method]) => method);
async function handWithHistory() {
  await app.startHand(['As', 'Kd']);
  for (const action of ['call', 'check']) {
    const button = app.$(`[data-canonical-action="${action}"]:not([disabled])`);
    if (button) await app.handAction(action);
  }
}
const translations = fs.readFileSync(
  new URL('../app/src/locales/analysis-translations.js', import.meta.url),
  'utf8',
);
const FORCED_LAYOUT_READ = /offsetWidth|offsetHeight|getBoundingClientRect\(/;

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0, `Missing ${startToken}`);
  assert.ok(end > start, `Missing ${endToken}`);
  return source.slice(start, end);
}

test('one playback coordinator owns one cancellable timeout and no interval or rAF loop', () => {
  assert.equal((playbackSource.match(/scheduleTimeout\(/g) || []).length, 1);
  assert.match(playbackSource, /clearScheduledTimeout\(timeoutHandle\)/);
  assert.match(playbackSource, /scheduledGeneration !== generation/);
  assert.match(playbackSource, /start\(\)/);
  assert.match(playbackSource, /pause\(\)/);
  assert.match(playbackSource, /cancel\(\)/);
  assert.match(playbackSource, /scheduleNext/);
  assert.doesNotMatch(`${playbackSource}\n${projectionSource}`, /setInterval|requestAnimationFrame/);
  assert.doesNotMatch(playbackSource, /applyAction|applyChance|PokerState|StrategyProvider|Equity|Training/);
});

test('playback uses the existing Replay cursor and keeps final-frame Replay separate from Live', () => {
  assert.match(bridgeSource, /advance:\s*\(\) => activeReplayController\(\)\.advancePlayback\(\)/);
  assert.match(bridgeSource, /const activeReplayController = \(\) => \(savedHandViewer \? savedReplayController : replayController\)/);
  assert.match(projectionSource, /beginPlayback\(\)[\s\S]*?replayCursor = 0/);
  assert.match(projectionSource, /advancePlayback\(\)[\s\S]*?replayCursor \+= 1/);
  assert.equal((projectionSource.match(/let replayCursor = null/g) || []).length, 1);
  assert.match(projectionSource, /atPlaybackEnd:\s*!atLive && selectedFrameIndex === frames\.length - 1/);
  assert.match(bridgeSource, /returnReplayToLive\(\)[\s\S]*?playbackController\.cancel\(\)[\s\S]*?activeReplayController\(\)\.returnToEndpoint\(\)/);
});

test('manual navigation and lifecycle boundaries cancel before selection or mutation', () => {
  for (const [method, cancellation] of [
    ['previousReplayFrame()', 'playbackController.pause()'],
    ['nextReplayFrame()', 'playbackController.pause()'],
    ['returnReplayToLive()', 'playbackController.cancel()'],
    ['initializeHand(configuration)', 'playbackController.cancel()'],
    ['resetHand()', 'playbackController.cancel()'],
  ]) {
    const endToken = method === 'resetHand()' ? 'dealHoleCards(' : ({
      'previousReplayFrame()': 'nextReplayFrame()',
      'nextReplayFrame()': 'returnReplayToLive()',
      'returnReplayToLive()': 'getResolution:',
      'initializeHand(configuration)': 'resetHand()',
    })[method];
    const block = sourceBetween(bridgeSource, method, endToken);
    assert.ok(block.indexOf(cancellation) < block.indexOf(method.startsWith('initialize')
      ? 'canonicalController.initialize' : method.startsWith('reset')
        ? 'canonicalController.reset' : 'activeReplayController()'), method);
  }
  assert.match(bridgeSource, /setMode\(mode, scenarioInput\) \{\s*playbackController\.cancel\(\)/);
});

test('leaving the Playbook cancels Replay playback', async () => {
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  await app.click('#handReplayPlaybackButton');
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.navigate('equity');
    assert.ok(bridgeCalls(spy).includes('cancelReplayPlayback'));
  } finally {
    spy.restore();
  }
  await app.navigate('hand');
});

test('Play/Pause is localized, keyboard-native, truthful, focus-safe, and quiet during ticks', async () => {
  const button = markup.getElementById('handReplayPlaybackButton');
  assert.equal(button.localName, 'button');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  const playback = app.byId('handReplayPlaybackButton');
  const status = app.byId('handReplayStatus') || app.$('#handReplayControls [role="status"], #handReplayControls [aria-live]');
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.click(playback);
    assert.ok(bridgeCalls(spy).includes('startReplayPlayback'));
    assert.equal(playback.getAttribute('aria-pressed'), 'true');
    if (status) assert.equal(status.getAttribute('aria-live'), 'off', 'quiet while ticking');
    spy.reset();
    await app.click(playback);
    assert.ok(bridgeCalls(spy).includes('pauseReplayPlayback'));
    assert.equal(playback.getAttribute('aria-pressed'), 'false');
    if (status) assert.equal(status.getAttribute('aria-live'), 'polite');
  } finally {
    spy.restore();
  }
  // Focus never stays on a control that becomes disabled.
  const next = app.byId('handReplayNextButton');
  for (let step = 0; step < 10 && !next.disabled; step += 1) {
    next.focus();
    await app.click(next);
  }
  assert.ok(next.disabled, 'the end of Replay disables Next');
  const focused = app.document.activeElement;
  assert.ok(focused !== next, 'focus moved off the disabled control');
  assert.ok(['handReplayPlaybackButton', 'handReplayPreviousButton', 'handReplayLiveButton'].includes(focused.id) || focused === app.document.body, focused.id);
  for (const key of ['replay.control.play', 'replay.control.pause']) {
    assert.equal(
      (translations.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) || []).length,
      3,
      `${key} must exist in EN/RU/HE`,
    );
  }
});

test('semantic motion facts cover action, values, fold, all-in, board, actor, pot, and showdown', () => {
  for (const fact of [
    'actorPlayerId', 'nextActorPlayerId', 'actionType', 'actionFamily', 'wasAllIn',
    'boardCards', 'seatChanges', 'stack', 'contribution', 'foldedChanged',
    'allInChanged', 'cardsChanged', 'pot',
  ]) {
    assert.match(projectionSource, new RegExp(fact), fact);
  }
  assert.match(renderer, /motion\.actorPlayerId/);
  assert.match(renderer, /motion\.nextActorPlayerId/);
  assert.match(renderer, /motion\.seatChanges/);
  assert.match(renderer, /replayMotion\?\.boardCards/);
  assert.match(renderer, /motion\.transitionKind === 'showdown_resolution'/);
  assert.doesNotMatch(renderer, /previousElementSibling|potMilliBb\s*[-+*/]|streetContributionMilliBb\s*[-+*/]/);
});

test('table stays authoritative immediately and card motion uses trusted event card IDs', async () => {
  // Each Replay step dispatches the projected table state synchronously (no
  // separate replay-motion event).
  const events = [];
  const record = (event) => events.push(event.type);
  app.window.addEventListener('gameStateUpdate', record);
  app.window.addEventListener('riverline:replay-motion', record);
  try {
    await handWithHistory();
    events.length = 0;
    await app.click('#handReplayPreviousButton');
    assert.ok(events.includes('gameStateUpdate'));
    assert.ok(!events.includes('riverline:replay-motion'));
  } finally {
    app.window.removeEventListener('gameStateUpdate', record);
    app.window.removeEventListener('riverline:replay-motion', record);
  }
  assert.match(bridgeSource, /emitBatch\(createPokerWorldExperienceEvents/);
  assert.match(renderer, /'riverline:experience-event'/);
  assert.match(renderer, /trustedReplayDealCards\.has\(card\.id\)/);
  assert.match(renderer, /replayMotion\?\.boardCards \|\| \[\]/);
  assert.match(renderer, /\['private_deal', 'private_reveal'\]/);
  assert.match(renderer, /\.table-hole-cards\.is-card-dealt/);
  assert.match(renderer, /player\.cardVisibility === 'hidden'[\s\S]*?cardChange\?\.cardVisibilityChanged/);
  assert.doesNotMatch(renderer, /SoundFX/);
});

test('timeline synchronization pauses for manual interaction without arbitrary seeking', async () => {
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  // Selection scrolling stays inside the history viewport (superseded: the
  // block:'nearest' scrollIntoView became a viewport scrollTop adjustment),
  // never the document.
  const selected = app.$('#handActionHistory [aria-current="step"]');
  assert.ok(selected);
  assert.equal(selected._scrolledIntoView, undefined);
  for (const type of ['pointerdown', 'wheel']) {
    await app.click('#handReplayPlaybackButton');
    assert.equal(app.call('callPlaybookStateBridge', 'createReplayPlaybackViewModel')?.playing, true, type);
    app.dispatch(app.byId('handActionHistory'), new app.window.Event(type, { bubbles: true }));
    assert.equal(app.call('callPlaybookStateBridge', 'createReplayPlaybackViewModel')?.playing, false, `${type} pauses`);
  }
  // No arbitrary seek slider or speed control.
  for (const input of markup.querySelectorAll('input[type="range"]')) {
    assert.doesNotMatch(`${input.id} ${input.className} ${input.getAttribute('aria-label') || ''}`, /replay/i);
  }
  assert.doesNotMatch(text(markup.getElementById('handReplayControls') || markup.body), /speed/i);
});

test('motion is bounded, reduced-motion safe, theme-token based, and has no sound path', () => {
  for (const className of [
    'is-replay-action-motion', 'is-replay-next-actor-motion', 'is-replay-value-motion',
    'is-replay-fold-motion', 'is-replay-all-in-motion', 'is-replay-pot-motion',
    'is-replay-showdown-motion',
  ]) {
    assert.ok(css.rulesMentioning(className).length > 0, className);
  }
  const container = markup.getElementById('visual-table-container');
  const host = markup.createElement('div');
  host.className = 'is-replay-action-motion';
  container.appendChild(host);
  assert.equal(css.cascaded(host, 'animation', { reducedMotion: true }), 'none');
  host.remove();
  for (const rule of replayPaint.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b/i, rule.selectorText);
  }
  // (Replay logic has no sound path: logic.js never calls SoundFX — see the
  // SOURCE-SHAPE call-site lint in prelabs_fix001_firefox_audio.)
  assert.doesNotMatch(`${playbackSource}\n${bridgeSource}`, /SoundFX/);
});

test('motion has a paintable, cancellable lifecycle and settles without a timer loop', async () => {
  const applyMotion = sourceBetween(renderer, 'applyReplayMotion(state, motion)', 'renderPresenceState(');
  const replayHotPaths = [playbackSource, projectionSource, bridgeSource, applyMotion].join('\n');
  assert.ok(applyMotion.indexOf('dataset.replayMotionCycle') < applyMotion.indexOf('settleReplayMotionWhenFinished'),
    'transient classes must exist before their Web Animations lifecycle is observed');
  assert.match(renderer, /activeReplayAnimations\.forEach\(\(animation\) => animation\.cancel\(\)\)/);
  assert.match(renderer, /getAnimations\(\{ subtree: true \}\)/);
  assert.match(renderer, /settleReplayMotionWithEvents\(generation\)/);
  assert.match(renderer, /addEventListener\('animationend', settleElement\)/);
  assert.match(renderer, /addEventListener\('animationcancel', settleElement\)/);
  assert.match(renderer, /Promise\.allSettled\([\s\S]*animation\.finished/);
  assert.match(renderer, /generation === this\.replayMotionGeneration/);
  assert.match(renderer, /classList\.remove\('is-replay-card-motion', 'is-card-dealt'\)/);
  assert.doesNotMatch(renderer, /setInterval|requestAnimationFrame|setTimeout/);
  assert.match('function replayTick() { node.getBoundingClientRect(); }', FORCED_LAYOUT_READ);
  assert.doesNotMatch(replayHotPaths, FORCED_LAYOUT_READ);
  // The timeline marks the current step while its animations run and clears
  // it when they finish — only for the latest motion token.
  await handWithHistory();
  const history = app.byId('handActionHistory');
  const proto = Object.getPrototypeOf(history);
  const original = proto.getAnimations;
  const rect = proto.getBoundingClientRect;
  const reads = [];
  let finish = null;
  try {
    await app.click('#handReplayPreviousButton');
    await app.click('#handReplayPreviousButton');
    // Playback steps carry a motion token (manual steps do not animate).
    await app.click('#handReplayPlaybackButton');
    for (let round = 0; round < 60 && !history.dataset.replayLastMotionToken; round += 1) await app.settle(50);
    const first = history.dataset.replayLastMotionToken;
    assert.ok(first, 'a playback step animates');
    // From the next step on, the current step reports a running animation.
    proto.getAnimations = function getAnimations() {
      return this.getAttribute?.('aria-current') === 'step' ? [{ finished: new Promise((resolve) => { finish = resolve; }) }] : [];
    };
    proto.getBoundingClientRect = function getBoundingClientRect() { reads.push(this.id || String(this.className)); return rect.call(this); };
    for (let round = 0; round < 60 && history.dataset.replayLastMotionToken === first; round += 1) await app.settle(50);
    assert.notEqual(history.dataset.replayLastMotionToken, first, 'the next playback step animates');
    const current = history.querySelector('[aria-current="step"]');
    assert.ok(current.classList.contains('is-replay-motion-current'), 'marked while animating');
    assert.ok(history.dataset.replayMotionToken);
    finish();
    await app.settle(0);
    assert.equal(current.classList.contains('is-replay-motion-current'), false, 'cleared when finished');
    assert.equal(history.dataset.replayMotionToken, undefined);
    // Only the history viewport (and its selected item) is measured.
    assert.ok(reads.every((name) => name === 'handActionHistory' || /replay|history|step|current|seek/i.test(name)), JSON.stringify(reads));
  } finally {
    proto.getAnimations = original;
    proto.getBoundingClientRect = rect;
    if (app.call('callPlaybookStateBridge', 'createReplayPlaybackViewModel')?.playing) await app.click('#handReplayPlaybackButton');
  }
});

test('replay cues share the bounded semantic motion scale and stay restrained', () => {
  const root = markup.documentElement;
  const tokens = {
    '--motion-fast-semantic': '110ms', '--motion-normal-semantic': '170ms', '--motion-poker-settle': '240ms',
    '--motion-poker-ease': 'cubic-bezier(.2, .72, .25, 1)',
    '--replay-motion-action': 'var(--motion-normal-semantic)', '--replay-motion-deal': 'var(--motion-poker-settle)',
  };
  const table = markup.getElementById('visual-table-container');
  for (const [token, value] of Object.entries(tokens)) {
    const holder = token.startsWith('--replay-') ? table : root;
    assert.equal(css.cascaded(holder, token), value, token);
  }
  const frame = (name, offset) => Object.fromEntries((css.keyframes.get(name) || []).find((entry) => entry.offsets.includes(offset))?.declarations.map(({ property, value }) => [property, value]) ?? []);
  assert.deepEqual(frame('replay-action-badge-a', 'from'), { opacity: '0', translate: '0 7px' });
  assert.equal(frame('replay-card-deal', 'from').translate, 'var(--card-deal-from-x, 0) var(--card-deal-from-y, -14px)');
  assert.ok(Object.values(Object.fromEntries((css.keyframes.get('replay-fold-cards-a') || []).flatMap((entry) => entry.declarations.map(({ property, value }) => [property + entry.offsets, value])))).includes('var(--card-fold-to-x, 0) var(--card-fold-to-y, 12px)'));
  assert.ok(css.rulesMentioning('.table-hole-cards.is-replay-card-motion').length > 0);
  const actor = css.keyframes.get('replay-next-actor-a').flatMap((entry) => entry.declarations.filter(({ property }) => property === 'stroke-dashoffset').map(({ value }) => value));
  assert.deepEqual(actor, ['80', '0']);
  for (const rule of replayMotion.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /infinite|alternate|rotate|bounce/i, rule.selectorText);
  }
  for (const frames of replayMotion.keyframes.values()) {
    for (const { declarations } of frames) for (const { value } of declarations) assert.doesNotMatch(value, /rotate/i);
  }
});

test('one radial-felt seat/card unit supports deliberate geometry for every table size', () => {
  assert.match(renderer, /data-card-lane="radial-felt"/);
  assert.doesNotMatch(renderer, /table-seat-connector|table-card-cradle/);
  assert.match(renderer, /window\.RiverlineTableEnvironment\.anchors\(activePlayers\)/);
  assert.match(renderer, /seatsLayer\.dataset\.tableSize = String\(activePlayers\)/);
  assert.match(renderer, /for \(let i = 0; i < activePlayers; i\+\+\)/);
  assert.match(renderer, /width="\$\{unit\.width\}" height="\$\{unit\.height\}"/);
  const cardCenters = [0, 1].map((index) => {
    const markup = tableCardSvgMarkup({ rank: 'A', suit: 's', index, totalCards: 2 });
    const finalX = Number(markup.match(/--card-final-x:([-\d.]+)px/)?.[1]);
    assert.equal(Number.isFinite(finalX), true);
    return finalX + (CARD_GEOMETRY.table.width / 2);
  });
  assert.equal((cardCenters[0] + cardCenters[1]) / 2, 0);
  assert.doesNotMatch(renderer, /activePlayers\s*===?\s*2|activePlayers\s*\?\s*2|isHeadsUp|headsUp/i);
  const surface = markup.createElement('div');
  surface.className = 'table-seat-surface';
  markup.body.appendChild(surface);
  assert.equal(css.cascaded(surface, 'transform-box'), 'fill-box');
  assert.equal(css.cascaded(surface, 'transform-origin'), 'center');
  surface.remove();
});

test('playback events preserve PERF-001 by returning before strategy, Matrix, Equity, or Training work', async () => {
  await handWithHistory();
  const heavy = ['updateContext', 'renderChart', 'calculateEquity', 'updateEquityReadiness', 'renderTrainingCards']
    .filter((name) => app.evaluate(`typeof ${name}`) === 'function');
  const spy = app.spy(heavy);
  try {
    await app.click('#handReplayPreviousButton');
    await app.click('#handReplayPlaybackButton');
    await app.settle(3000);
    await app.click('#handReplayLiveButton');
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
  }
  assert.doesNotMatch(`${playbackSource}\n${projectionSource}`, /StrategyProvider|calculateEquity|renderChart|Training/);
});
