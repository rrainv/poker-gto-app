import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the canonical Replay timeline is rendered in the booted Hand
// workspace and inspected as DOM; markup is parsed and styling resolved
// through the cascade. Bridge/model/translation sources are outside this
// ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
// Imported after boot: the module installs the page's Playbook bridge on load.
const { installPlaybookStateSourceBridge } = await import('../app/src/application/playbook-mode-bootstrap.mjs');
const historySurface = markup.getElementById('handHistorySection');
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}
async function handWithActions(actions = ['call', 'check']) {
  await app.startHand(['As', 'Kd']);
  for (const action of actions) {
    const button = app.$(`[data-canonical-action="${action}"]:not([disabled])`);
    if (button) await app.handAction(action);
  }
}
const timeline = () => app.byId('handActionHistory');

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const modelSource = fs.readFileSync(
  new URL('../app/src/application/replay-timeline-view-model.mjs', import.meta.url),
  'utf8',
);
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

test('classic logic renders normalized Replay projection facts and Analysis keeps the accepted timeline', async () => {
  await handWithActions();
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    app.call('renderCanonicalReplayTimeline');
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'createReplayProjectionViewModel'));
    spy.reset();
    app.call('canonicalActionHistoryForAnalysis', { mode: 'hand' });
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'createReplayTimelineViewModel'));
    // Neither path reads the raw canonical state's action history.
    assert.ok(spy.calls.callPlaybookStateBridge.every(([method]) => method !== 'getState'));
  } finally {
    spy.restore();
  }
  assert.equal(app.evaluate('typeof renderCanonicalActionHistory'), 'undefined');
  assert.match(modelSource, /state\.actionHistory/);
});

test('the existing Hand history surface is upgraded once and Scenario Mode stays inactive', async () => {
  assert.equal(markup.querySelectorAll('#handHistorySection').length, 1);
  assert.equal(markup.querySelectorAll('#handActionHistory').length, 1);
  assert.ok(markup.getElementById('handActionHistory').classList.contains('replay-timeline'));
  assert.doesNotMatch(modelSource, /scenarioInput|priorAction|DecisionContext|StrategyProvider/);
  // State changes re-render the timeline in Hand mode, except pure mode switches.
  await handWithActions([]);
  const spy = app.spy(['renderCanonicalHandWorkspace']);
  try {
    app.window.dispatchEvent(new app.window.CustomEvent('riverline:playbook-state-change', { detail: { operation: 'mode' } }));
    assert.equal(spy.count('renderCanonicalHandWorkspace'), 0);
    app.window.dispatchEvent(new app.window.CustomEvent('riverline:playbook-state-change', { detail: { operation: 'replay_previous' } }));
    assert.equal(spy.count('renderCanonicalHandWorkspace'), 1);
  } finally {
    spy.restore();
  }
  // Outside Hand mode the timeline is emptied.
  await app.navigate('analyze');
  app.call('renderCanonicalReplayTimeline');
  assert.equal(timeline().childElementCount, 0);
  await app.navigate('hand');
});

test('street headings, ordered entries, Hero, amount, all-in, and current semantics exist', async () => {
  await handWithActions(['all_in', 'call']);
  app.call('renderCanonicalReplayTimeline');
  const root = timeline();
  const groups = root.querySelectorAll('details.replay-street-group');
  assert.ok(groups.length >= 1);
  for (const group of groups) {
    assert.equal(group.firstElementChild.localName, 'summary');
    assert.ok(group.querySelector('.replay-street-heading'));
  }
  assert.ok(groups.some((group) => group.open), 'the selected street is open');
  const list = root.querySelector('ol.replay-action-list');
  assert.ok(list);
  const entries = list.querySelectorAll('li.replay-action-entry');
  assert.ok(entries.length >= 2);
  // Ordered by canonical sequence: <ol start> and each <li value> are 1-based.
  const values = entries.map((entry) => Number(entry.getAttribute('value') ?? entry.value));
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(Number(list.getAttribute('start') ?? list.start), values[0]);
  for (const token of ['replay-action-identity', 'replay-position', 'replay-action-label']) assert.ok(root.querySelector(`.${token}`), token);
  assert.ok(root.querySelector('.replay-action-entry.is-hero'));
  const allIn = root.querySelector('.replay-action-entry.is-all-in');
  assert.ok(allIn, 'the all-in entry is marked');
  assert.ok(allIn.querySelector('.replay-all-in-status'));
  assert.ok(allIn.querySelector('.replay-action-amount'), 'amounted actions show their amount');
  const marker = root.querySelector('.replay-current-marker');
  assert.ok(marker, 'the current replay position is marked');
  assert.equal(marker.getAttribute('aria-current'), 'true');
  assert.equal(marker.getAttribute('role'), 'status');
  assert.equal(marker.getAttribute('aria-live'), 'polite');
});

test('action families use semantic accents while text stays high contrast', () => {
  for (const [family, token] of [
    ['fold', '--action-fold'],
    ['passive', '--action-passive'],
    ['aggressive', '--action-aggressive'],
    ['all-in', '--action-all-in'],
  ]) {
    const entry = probe(`<li class="replay-action-entry replay-action-entry--${family}"><div class="replay-action-body"></div></li>`);
    const declared = css.matchingRules(entry).flatMap((rule) => rule.declarations.map(({ value }) => value)).join(' ');
    assert.match(declared, new RegExp(`var\\(${token}\\)`), family);
  }
  const entry = probe('<li class="replay-action-entry is-hero"><div class="replay-action-body"><span class="replay-actor-name">Hero</span><span class="replay-action-label">Call</span></div></li>');
  assert.equal(css.cascaded(entry.querySelector('.replay-action-body'), 'color'), 'var(--text-primary)');
  assert.equal(css.cascaded(entry.querySelector('.replay-action-label'), 'color'), 'var(--text-primary)');
  assert.equal(css.cascaded(probe('<div class="replay-current-marker"></div>'), 'color'), 'var(--text-primary)');
  const actor = entry.querySelector('.replay-actor-name');
  assert.equal(css.cascaded(actor, 'font-weight'), 'var(--weight-title)'); // SAVED-COMPOSITION-002 amendment: literal weights are role tokens
  // Superseded: a later Hand polish removed the underline; Hero is marked by
  // the title weight.
  assert.equal(css.cascaded(actor, 'text-decoration'), 'none');
});

test('timeline accessibility uses explicit direct-seek controls without an empty numbered action row', async () => {
  assert.equal(historySurface.getAttribute('aria-labelledby'), 'handHistoryTitle');
  assert.equal(markup.getElementById('handActionHistory').dataset.i18nAriaLabel, 'replay.a11y.timeline');
  assert.equal(historySurface.querySelector('li'), null, 'no empty static row');
  // Before any voluntary action the timeline shows an empty state.
  await handWithActions([]);
  app.call('renderCanonicalReplayTimeline');
  assert.ok(timeline().querySelector('.replay-empty-state') || timeline().querySelector('.replay-current-marker'));
  await handWithActions(['call', 'check']);
  app.call('renderCanonicalReplayTimeline');
  const list = timeline().querySelector('.replay-action-list');
  const heading = app.byId(list.getAttribute('aria-labelledby'));
  assert.ok(heading, 'each list is labelled by its street heading');
  assert.equal(timeline().querySelector('[tabindex]'), null, 'native controls only');
  const seek = timeline().querySelector('.replay-action-entry button');
  assert.ok(seek, 'entries are direct-seek buttons');
  const spy = app.spy(['seekCanonicalReplayFrame', 'callPlaybookStateBridge']);
  try {
    await app.click(seek);
    assert.equal(spy.count('seekCanonicalReplayFrame'), 1);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'selectReplayFrame'));
  } finally {
    spy.restore();
  }
  assert.equal(historySurface.querySelectorAll('#handResolveShowdownButton').length, 1);
  assert.ok(historySurface.querySelector('.replay-resolution-actions #handResolveShowdownButton'));
  await app.click('#handReplayLiveButton');
});

test('bounded Replay step and playback controls exist without scrub or timing controls', async () => {
  for (const id of ['handReplayPreviousButton', 'handReplayNextButton', 'handReplayLiveButton', 'handReplayPlaybackButton']) {
    assert.ok(historySurface.querySelector(`#${id}`), id);
  }
  assert.doesNotMatch(text(historySurface) + historySurface.querySelectorAll('[id],[class]').map((node) => `${node.id} ${node.className}`).join(' '), /\b(?:scrub|speed|autoplay)\b/i);
  await handWithActions();
  const spy = app.spy(['setInterval', 'requestAnimationFrame']);
  try {
    app.call('renderCanonicalReplayTimeline');
    app.call('renderCanonicalReplayControls', app.call('callPlaybookStateBridge', 'createReplayProjectionViewModel'));
    assert.equal(spy.total(), 0);
  } finally {
    spy.restore();
  }
});

test('Replay renderer contains formatting only and no poker calculations or service calls', async () => {
  await handWithActions();
  const spy = app.spy(['updateContext', 'calculateEquity', 'callEquityServiceBridge', 'callTrainingServiceBridge', 'callPlaybookStateBridge']);
  try {
    app.call('renderCanonicalReplayTimeline');
    assert.equal(spy.count('updateContext') + spy.count('calculateEquity') + spy.count('callEquityServiceBridge') + spy.count('callTrainingServiceBridge'), 0);
    // Only read-side Replay view models are requested.
    for (const [method] of spy.calls.callPlaybookStateBridge) assert.match(method, /^create\w+ViewModel$|^get(?:Mode|HeroPlayerId)$/, method);
  } finally {
    spy.restore();
  }
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
  const bare = probe('<div class="replay-timeline"><details class="replay-street-group"><summary class="replay-street-heading">Flop</summary><ol class="replay-action-list"><li class="replay-action-entry"><span class="replay-action-amount">2 bb</span></li></ol></details><div class="replay-current-marker"></div></div>');
  assert.equal(css.cascaded(bare, 'max-height'), 'min(320px, 42vh)');
  assert.equal(css.cascaded(bare, 'overflow-x'), 'hidden');
  assert.equal(css.cascaded(bare, 'overflow-y'), 'auto');
  assert.equal(css.cascaded(bare, 'overscroll-behavior-block'), 'contain');
  assert.equal(css.cascaded(bare.querySelector('.replay-street-heading'), 'position'), 'sticky');
  assert.equal(css.cascaded(bare.querySelector('.replay-current-marker'), 'position'), 'sticky');
  markup.documentElement.setAttribute('dir', 'rtl');
  try {
    const amount = bare.querySelector('.replay-action-amount');
    assert.equal(css.cascaded(amount, 'direction'), 'ltr');
    assert.equal(css.cascaded(amount, 'unicode-bidi'), 'isolate');
    for (const node of [bare, bare.querySelector('.replay-action-list')]) assert.notEqual(css.cascaded(node, 'flex-direction'), 'row-reverse', 'chronology is never mirrored');
  } finally {
    markup.documentElement.setAttribute('dir', 'ltr');
  }
});

test('showdown resolution, Table Presence, and PERF-001 integration remain separate', async () => {
  await handWithActions([]);
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    app.dispatch(app.byId('handResolveShowdownButton'), new app.window.MouseEvent('click', { bubbles: true }));
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'resolveShowdown'));
    spy.reset();
    app.call('dispatchCanonicalTableState');
    // (Superseded: the table now receives the bridge's table-presentation
    // view; table-presence/v1 remains the bridge's fallback model.)
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => /^createTable(?:Presentation|Presence)ViewModel$/.test(method)));
  } finally {
    spy.restore();
  }
  assert.match(bridgeSource, /createTablePresenceViewModel\(\)/);
  assert.doesNotMatch(modelSource, /StrategyProvider|resolveStrategy|calculateEquity|Training|setInterval|requestAnimationFrame|addEventListener/);
});
