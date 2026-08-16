import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const modelSource = fs.readFileSync(
  new URL('../app/src/application/replay-timeline-view-model.mjs', import.meta.url),
  'utf8',
);
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const translations = fs.readFileSync(
  new URL('../app/src/locales/analysis-translations.js', import.meta.url),
  'utf8',
);

class FakeCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
}

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0, `Missing ${startToken}`);
  assert.ok(end > start, `Missing ${endToken}`);
  return source.slice(start, end);
}

test('Playbook bridge exposes the immutable application-produced Replay model', () => {
  const events = [];
  const browserWindow = {
    CustomEvent: FakeCustomEvent,
    dispatchEvent(event) { events.push(event); },
  };
  const bridge = installPlaybookStateSourceBridge(browserWindow);
  const empty = bridge.createReplayTimelineViewModel();

  assert.equal(empty.schemaVersion, 'replay-timeline/v1');
  assert.equal(empty.empty, true);
  assert.equal(Object.isFrozen(empty), true);
  assert.equal(typeof bridge.createReplayTimelineViewModel, 'function');
  assert.match(
    bridgeSource,
    /createReplayTimelineViewModel\(\)\s*\{[\s\S]*?state:\s*canonicalController\.getState\(\)[\s\S]*?heroPlayerId:\s*canonicalController\.getHeroPlayerId\(\)/,
  );
  assert.doesNotMatch(bridgeSource, /canonicalController:\s*canonicalController/);
  assert.deepEqual(events, []);
});

test('classic logic renders normalized Replay projection facts and Analysis keeps the accepted timeline', () => {
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );
  const analysisHistory = sourceBetween(
    logic,
    'function canonicalActionHistoryForAnalysis(',
    'function trustedAnalysisFacts(',
  );

  assert.match(renderer, /callPlaybookStateBridge\('createReplayProjectionViewModel'\)/);
  assert.match(analysisHistory, /callPlaybookStateBridge\('createReplayTimelineViewModel'\)/);
  assert.doesNotMatch(`${renderer}\n${analysisHistory}`, /\.actionHistory|submittedAction|committedMilliBb|currentBetAfterMilliBb/);
  assert.doesNotMatch(logic, /function renderCanonicalActionHistory\(/);
  assert.match(modelSource, /state\.actionHistory/);
});

test('the existing Hand history surface is upgraded once and Scenario Mode stays inactive', () => {
  assert.equal((html.match(/id="handHistorySection"/g) || []).length, 1);
  assert.equal((html.match(/id="handActionHistory"/g) || []).length, 1);
  assert.match(html, /id="handActionHistory"[^>]*class="replay-timeline"/);
  assert.match(logic, /function renderCanonicalReplayTimeline\(\)[\s\S]*?if \(!isHandMode\(\)\) \{[\s\S]*?root\.replaceChildren\(\)/);
  assert.match(logic, /if \(event\.detail\?\.operation !== 'mode' && isHandMode\(\)\)/);
  assert.doesNotMatch(modelSource, /scenarioInput|priorAction|DecisionContext|StrategyProvider/);
});

test('street headings, ordered entries, Hero, amount, all-in, and current semantics exist', () => {
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );
  for (const token of [
    'replay-street-group', 'replay-street-heading', 'replay-action-list',
    'replay-action-entry', 'replay-action-identity', 'replay-position',
    'replay-action-label', 'replay-action-amount', 'replay-all-in-status',
    'replay-current-marker', 'is-hero', 'is-all-in',
  ]) {
    assert.match(`${renderer}\n${css}`, new RegExp(token), token);
  }
  assert.match(renderer, /document\.createElement\('h3'\)/);
  assert.match(renderer, /document\.createElement\('ol'\)/);
  assert.match(renderer, /actionList\.start = item\.sequence \+ 1/);
  assert.match(renderer, /item\.value = entry\.sequence \+ 1/);
  assert.match(renderer, /entry\.amountKind !== 'none'/);
  assert.match(renderer, /entry\.wasAllIn/);
  assert.match(renderer, /setAttribute\('aria-current', 'true'\)/);
  assert.match(renderer, /setAttribute\('role', 'status'\)/);
  assert.match(renderer, /setAttribute\('aria-live', 'polite'\)/);
});

test('action families use semantic accents while text stays high contrast', () => {
  for (const [family, token] of [
    ['fold', '--action-fold'],
    ['passive', '--action-passive'],
    ['aggressive', '--action-aggressive'],
    ['all_in', '--action-all-in'],
  ]) {
    const escapedFamily = family.replace('_', '[_-]');
    assert.match(css, new RegExp(`replay-action-entry--${escapedFamily}[\\s\\S]{0,100}${token}`));
  }
  const bodyRule = css.match(/\.replay-action-body\s*\{([^}]*)\}/)?.[1] || '';
  const actionRule = css.match(/\.replay-action-label\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(bodyRule, /color:\s*var\(--text-primary\)/);
  assert.match(actionRule, /color:\s*var\(--text-primary\)/);
  assert.match(css, /\.replay-current-marker[\s\S]*?color:\s*var\(--text-primary\)/);
  assert.doesNotMatch(bodyRule, /#[0-9a-f]{3,8}/i);
  assert.match(css, /\.replay-action-entry\.is-hero \.replay-actor-name[^{]*\{[^}]*font-weight:\s*900[^}]*text-decoration:\s*underline/);
});

test('timeline accessibility has no fake controls or empty numbered action row', () => {
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );
  const historySurface = sourceBetween(
    html,
    '<section id="handHistorySection"',
    '</section>',
  );

  assert.match(html, /id="handHistorySection"[^>]*aria-labelledby="handHistoryTitle"/);
  assert.match(html, /id="handActionHistory"[^>]*data-i18n-aria-label="replay\.a11y\.timeline"/);
  assert.match(renderer, /actionList\.setAttribute\('aria-labelledby', heading\.id\)/);
  assert.match(renderer, /replay-empty-state/);
  assert.doesNotMatch(historySurface, /<li/);
  assert.doesNotMatch(renderer, /tabIndex|createElement\('button'\)|addEventListener/);
  assert.equal((historySurface.match(/id="handResolveShowdownButton"/g) || []).length, 1);
  assert.match(historySurface, /class="replay-resolution-actions"[\s\S]*id="handResolveShowdownButton"/);
});

test('bounded Replay step and playback controls exist without scrub or timing controls', () => {
  const historySurface = sourceBetween(
    html,
    '<section id="handHistorySection"',
    '</section>',
  );
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );

  assert.match(historySurface, /id="handReplayPreviousButton"/);
  assert.match(historySurface, /id="handReplayNextButton"/);
  assert.match(historySurface, /id="handReplayLiveButton"/);
  assert.match(historySurface, /id="handReplayPlaybackButton"/);
  assert.doesNotMatch(historySurface, /\b(?:scrub|speed|autoplay)\b/i);
  assert.doesNotMatch(renderer, /selectedReplay|replayIndex|projectedState|setInterval|requestAnimationFrame/);
});

test('Replay renderer contains formatting only and no poker calculations or service calls', () => {
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );
  assert.doesNotMatch(
    renderer,
    /shared\/poker-domain|applyAction|getLegalActionSpec|calculateEquity|StrategyProvider|Training|potMilliBb|currentBet|toCall|streetContribution/i,
  );
  assert.doesNotMatch(renderer, /\.players\.|\.actionHistory|submittedAction/);
  assert.match(modelSource, /actionAmountMilliBb/);
  assert.match(modelSource, /record\.committedMilliBb/);
  assert.match(modelSource, /record\.streetContributionAfterMilliBb/);
});

test('EN, RU, and HE Replay catalogs cover every visible and assistive key', () => {
  const keys = [
    'replay.title', 'replay.subtitle', 'replay.a11y.timeline',
    'replay.street.preflop', 'replay.street.flop', 'replay.street.turn', 'replay.street.river',
    'replay.street.showdown',
    'replay.action.fold', 'replay.action.check', 'replay.action.call', 'replay.action.betTo',
    'replay.action.raiseTo', 'replay.action.allInTo', 'replay.action.unknown',
    'replay.status.allIn', 'replay.marker.currentDecision', 'replay.marker.toAct',
    'replay.marker.awaitingPrivateCards', 'replay.marker.awaitingStreet',
    'replay.marker.showdown', 'replay.marker.revealRequired', 'replay.marker.terminal',
    'replay.marker.empty', 'replay.marker.unavailable', 'replay.empty.noVoluntaryActions',
  ];
  for (const key of keys) {
    const occurrences = translations.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) || [];
    assert.equal(occurrences.length, 3, `${key} must exist in EN/RU/HE`);
  }
  assert.doesNotMatch(translations, /Ã|Â|â€|�/);
});

test('RTL chronology, LTR poker tokens, bounded scrolling, and overflow contracts are explicit', () => {
  const timelineRule = css.match(/\.replay-timeline\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(timelineRule, /max-height:\s*min\(320px, 42vh\)/);
  assert.match(timelineRule, /overflow-x:\s*hidden/);
  assert.match(timelineRule, /overflow-y:\s*auto/);
  assert.match(timelineRule, /overscroll-behavior-block:\s*contain/);
  assert.match(css, /\.replay-street-heading[\s\S]*?position:\s*sticky/);
  assert.match(css, /\.replay-current-marker[\s\S]*?position:\s*sticky/);
  assert.match(css, /\[dir="rtl"\] \.replay-action-amount,[\s\S]*?direction:\s*ltr;\s*unicode-bidi:\s*isolate/);
  assert.doesNotMatch(css, /\[dir="rtl"\][^{]*(?:replay-timeline|replay-action-list)[^{]*\{[^}]*flex-direction:\s*row-reverse/);
});

test('showdown resolution, Table Presence, and PERF-001 integration remain separate', () => {
  const renderer = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function dispatchCanonicalTableState()',
  );
  assert.match(logic, /handResolveShowdownButton'\)\.addEventListener\('click'[\s\S]*?callPlaybookStateBridge\('resolveShowdown'\)/);
  assert.match(logic, /callPlaybookStateBridge\('createTablePresenceViewModel'\)/);
  assert.match(bridgeSource, /createTablePresenceViewModel\(\)/);
  assert.doesNotMatch(modelSource, /StrategyProvider|resolveStrategy|calculateEquity|Training|setInterval|requestAnimationFrame|addEventListener/);
  assert.doesNotMatch(renderer, /strategyProvider|callEquityServiceBridge|callTrainingServiceBridge/);
});
