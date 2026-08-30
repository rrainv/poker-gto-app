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
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
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
  assert.match(logic, /mode !== 'gto'\) callPlaybookStateBridge\('cancelReplayPlayback'\)/);
});

test('Play/Pause is localized, keyboard-native, truthful, focus-safe, and quiet during ticks', () => {
  assert.match(html, /id="handReplayPlaybackButton"[^>]*type="button"[^>]*aria-pressed="false"/);
  assert.match(logic, /playbackButton\.setAttribute\('aria-pressed', String\(isPlaying\)\)/);
  assert.match(logic, /playback\?\.playing \? 'pauseReplayPlayback' : 'startReplayPlayback'/);
  assert.match(logic, /status\.setAttribute\('aria-live', isPlaying \? 'off' : 'polite'\)/);
  assert.match(logic, /\[playbackButton, previous, next, live\]/);
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

test('table stays authoritative immediately and card motion uses trusted event card IDs', () => {
  const dispatch = sourceBetween(logic, 'function dispatchCanonicalTableState()', 'function renderCanonicalHandWorkspace()');
  assert.match(dispatch, /projection\?\.tablePresence/);
  assert.doesNotMatch(dispatch, /'riverline:replay-motion'/);
  assert.match(dispatch, /new CustomEvent\('gameStateUpdate', \{ detail: tableModel \}\)/);
  assert.match(bridgeSource, /emitBatch\(createPokerWorldExperienceEvents/);
  assert.match(renderer, /'riverline:experience-event'/);
  assert.match(renderer, /trustedReplayDealCards\.has\(card\.id\)/);
  assert.match(renderer, /replayMotion\?\.boardCards \|\| \[\]/);
  assert.match(renderer, /\['private_deal', 'private_reveal'\]/);
  assert.match(renderer, /\.table-hole-cards\.is-card-dealt/);
  assert.match(renderer, /player\.cardVisibility === 'hidden'[\s\S]*?cardChange\?\.cardVisibilityChanged/);
  assert.doesNotMatch(renderer, /SoundFX/);
});

test('timeline synchronization pauses for manual interaction without arbitrary seeking', () => {
  assert.match(logic, /keepReplaySelectionVisible[\s\S]*?block: 'nearest'/);
  assert.match(logic, /replayTimeline\?\.addEventListener\('pointerdown', pauseForTimelineInteraction\)/);
  assert.match(logic, /replayTimeline\?\.addEventListener\('wheel', pauseForTimelineInteraction/);
  assert.doesNotMatch(html, /type="range"[^>]*replay|replay[^>]*type="range"/i);
  assert.doesNotMatch(html, /replay.*speed|speed.*replay/i);
});

test('motion is bounded, reduced-motion safe, theme-token based, and has no sound path', () => {
  for (const className of [
    'is-replay-action-motion', 'is-replay-next-actor-motion', 'is-replay-value-motion',
    'is-replay-fold-motion', 'is-replay-all-in-motion', 'is-replay-pot-motion',
    'is-replay-showdown-motion',
  ]) {
    assert.match(css, new RegExp(className), className);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#visual-table-container \.is-replay-action-motion[\s\S]*?animation: none !important/);
  const replayMotionCss = sourceBetween(css, '/* REPLAY-001C:', '[dir="rtl"] .table-seat-stack');
  assert.doesNotMatch(replayMotionCss, /#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(`${playbackSource}\n${bridgeSource}\n${logic.slice(logic.indexOf('function replayActorLabel('), logic.indexOf('function deriveDecisionContext('))}`, /SoundFX/);
});

test('motion has a paintable, cancellable lifecycle and settles without a timer loop', () => {
  const applyMotion = sourceBetween(renderer, 'applyReplayMotion(state, motion)', 'renderPresenceState(');
  const replayLogic = sourceBetween(logic, 'function createReplayIdentity(', 'function activeHandReviewInput(');
  const replayHotPaths = [playbackSource, projectionSource, bridgeSource, replayLogic, applyMotion].join('\n');
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
  assert.match(logic, /current\.getAnimations\(\)/);
  assert.match(logic, /root\.dataset\.replayMotionToken === motionToken/);
  assert.match(logic, /current\.classList\.remove\('is-replay-motion-current'\)/);
  assert.doesNotMatch(renderer, /setInterval|requestAnimationFrame|setTimeout/);
  assert.match('function replayTick() { node.getBoundingClientRect(); }', FORCED_LAYOUT_READ);
  assert.doesNotMatch(replayHotPaths, FORCED_LAYOUT_READ);
});

test('replay cues share the bounded semantic motion scale and stay restrained', () => {
  assert.match(css, /--motion-fast-semantic:\s*110ms/);
  assert.match(css, /--motion-normal-semantic:\s*170ms/);
  assert.match(css, /--motion-poker-settle:\s*240ms/);
  assert.match(css, /--motion-poker-ease:\s*cubic-bezier\(\.2, \.72, \.25, 1\)/);
  assert.match(css, /--replay-motion-action:\s*var\(--motion-normal-semantic\)/);
  assert.match(css, /--replay-motion-deal:\s*var\(--motion-poker-settle\)/);
  assert.match(css, /@keyframes replay-action-badge-a \{ from \{ opacity: 0; translate: 0 7px/);
  assert.match(css, /@keyframes replay-card-deal \{ from \{ opacity: 0; translate: var\(--card-deal-from-x, 0\) var\(--card-deal-from-y, -14px\)/);
  assert.match(css, /@keyframes replay-fold-cards-a[\s\S]*?translate: var\(--card-fold-to-x, 0\) var\(--card-fold-to-y, 12px\)/);
  assert.match(css, /\.table-hole-cards\.is-replay-card-motion/);
  assert.match(css, /@keyframes replay-next-actor-a[\s\S]*stroke-dashoffset: 80[\s\S]*stroke-dashoffset: 0/);
  assert.doesNotMatch(css.slice(css.indexOf('/* REPLAY-001C:')), /infinite|alternate|rotate|bounce/i);
});

test('one radial-felt seat/card unit supports deliberate geometry for every table size', () => {
  assert.match(renderer, /data-card-lane="radial-felt"/);
  assert.doesNotMatch(renderer, /table-seat-connector|table-card-cradle/);
  assert.match(renderer, /TABLE_FALLBACK_ANCHORS = Object\.freeze/);
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
  assert.match(css, /\.table-seat-surface \{ transform-box: fill-box; transform-origin: center; \}/);
});

test('playback events preserve PERF-001 by returning before strategy, Matrix, Equity, or Training work', () => {
  const listener = sourceBetween(
    logic,
    "window.addEventListener('riverline:playbook-state-change'",
    'function formatCanonicalBb(',
  );
  assert.match(listener, /operation\?\.startsWith\('replay_'\)[\s\S]*?operation\?\.startsWith\('saved_hand_'\)\) return/);
  assert.doesNotMatch(listener, /strategyProvider|calculateEquity|renderChart|Training|updateEquity/);
  assert.doesNotMatch(`${playbackSource}\n${projectionSource}`, /StrategyProvider|calculateEquity|renderChart|Training/);
});
