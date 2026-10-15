import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const projectionSource = fs.readFileSync(
  new URL('../app/src/application/replay-projection-controller.mjs', import.meta.url),
  'utf8',
);
const renderer = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: Replay controls, table dispatch, read-only state and the
// timeline run in the booted Hand workspace; markup is parsed and styling
// resolved through the cascade. Bridge/projection/renderer/translation
// sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const projection = () => app.call('callPlaybookStateBridge', 'createReplayProjectionViewModel');
async function handWithHistory() {
  await app.startHand(['As', 'Kd']);
  for (const action of ['call', 'check']) {
    if (app.$(`[data-canonical-action="${action}"]:not([disabled])`)) await app.handAction(action);
  }
}
const translations = fs.readFileSync(
  new URL('../app/src/locales/analysis-translations.js', import.meta.url),
  'utf8',
);

function sourceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  assert.ok(start >= 0, `Missing ${startToken}`);
  assert.ok(end > start, `Missing ${endToken}`);
  return source.slice(start, end);
}

test('Playbook bridge exposes bounded projection/cursor operations and the durable canonical source', () => {
  for (const method of [
    'createReplayProjectionViewModel',
    'createCanonicalHandReplaySource',
    'previousReplayFrame',
    'nextReplayFrame',
    'returnReplayToLive',
  ]) {
    assert.match(bridgeSource, new RegExp(`${method}\\(\\)`));
  }
  assert.match(bridgeSource, /createReplayProjectionController\(\{/);
  assert.match(bridgeSource, /getLiveState:\s*\(\) => canonicalController\.getState\(\)/);
  assert.match(bridgeSource, /modeController\.getMode\(\) === PLAYBOOK_MODES\.HAND/);
  assert.doesNotMatch(projectionSource, /export\s+function\s+.*(?:frame|snapshot)/i);
  assert.doesNotMatch(projectionSource, /frames\s*[,}]/);
});

test('successful live transitions journal exact states while rejected and historical mutations do not', () => {
  const liveTransition = sourceBetween(
    bridgeSource,
    'const publishLiveTransition',
    'const bridge = Object.freeze',
  );
  assert.match(liveTransition, /if \(savedHandViewer \|\| replayController\.isReplayActive\(\)\) return null/);
  assert.match(liveTransition, /const result = transition\(\)/);
  assert.match(liveTransition, /if \(result\) \{[\s\S]*replayController\.recordTransition\(\{/);
  assert.match(projectionSource, /structuredClone\(state\)/);
  assert.match(projectionSource, /deepFreeze\(structuredClone\(state\)\)/);
  assert.doesNotMatch(projectionSource, /subtract|reverse|rollback|currentStackMilliBb\s*[-+]=|potMilliBb\s*[-+]=/i);
});

test('Scenario Mode receives neither Replay projection state nor active cursor operations', async () => {
  assert.match(
    bridgeSource,
    /createReplayProjectionViewModel\(\)\s*\{[\s\S]*?modeController\.getMode\(\) === PLAYBOOK_MODES\.HAND[\s\S]*?: null/,
  );
  for (const method of ['previousReplayFrame', 'nextReplayFrame', 'returnReplayToLive']) {
    assert.match(
      bridgeSource,
      new RegExp(`${method}\\(\\) \\{[\\s\\S]*?getMode\\(\\) !== PLAYBOOK_MODES\\.HAND\\) return null`),
    );
  }
  assert.equal(markup.querySelectorAll('#handHistorySection').length, 1);
  const handWorkspace = markup.getElementById('playbookHandWorkspace');
  assert.ok(handWorkspace.hasAttribute('data-playbook-hand'));
  assert.equal(handWorkspace.hidden, true);
  // Outside Hand mode the timeline renders nothing.
  await handWithHistory();
  await app.navigate('analyze');
  app.call('renderCanonicalReplayTimeline');
  const timeline = app.byId('handActionHistory');
  assert.equal(timeline.childElementCount, 0);
  assert.equal(timeline.dataset.replayState, undefined);
  assert.equal(projection(), null, 'Scenario receives no Replay projection');
  await app.navigate('hand');
});

test('Previous, Next, and Return-to-live controls consume projection and canonical lifecycle flags', async () => {
  await handWithHistory();
  const [previous, next, live] = ['handReplayPreviousButton', 'handReplayNextButton', 'handReplayLiveButton'].map((id) => app.byId(id));
  const check = () => {
    const view = projection();
    assert.equal(previous.disabled, !view.canPrevious, 'Previous follows canPrevious');
    assert.equal(next.disabled, !view.canNext, 'Next follows canNext');
    assert.equal(live.hidden, !(view.mode === 'replay' && view.canReturnToLive === true));
    assert.match(text(app.byId('handReplayStatus')), new RegExp(app.evaluate(`t(${JSON.stringify(view.modeLabelKey)})`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 12)));
    return view;
  };
  assert.equal(check().mode, 'live');
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.click(previous);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'previousReplayFrame'));
    assert.equal(check().mode, 'replay');
    spy.reset();
    await app.click(next);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'nextReplayFrame'));
    check();
    await app.click(previous);
    spy.reset();
    await app.click(live);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'returnReplayToEndpoint'));
    assert.equal(check().mode, 'live');
  } finally {
    spy.restore();
  }
});

test('table dispatch sends the projection table-presence/v1 directly to the accepted renderer', async () => {
  assert.match(renderer, /state\.schemaVersion === 'table-presence\/v1'/);
  await handWithHistory();
  const updates = [];
  const listener = (event) => updates.push(event.detail);
  app.window.addEventListener('gameStateUpdate', listener);
  try {
    app.call('dispatchCanonicalTableState');
  } finally {
    app.window.removeEventListener('gameStateUpdate', listener);
  }
  // Superseded: the dispatched model is now the bridge's table-presentation/v1
  // view built over the projection (table-presence/v1 remains the fallback).
  assert.equal(updates.length, 1);
  assert.match(updates[0].schemaVersion, /^table-presentation\/v1$|^table-presence\/v1$/);
  assert.equal(app.byId('table-wrapper').dataset.replayMode, projection().mode);
  await app.click('#handReplayPreviousButton');
  assert.equal(app.byId('table-wrapper').dataset.replayMode, 'replay');
  assert.ok(app.byId('table-wrapper').classList.contains('is-replay-projection'));
  await app.click('#handReplayLiveButton');
});

test('cursor events rerender Replay/table only and bypass strategy and Equity recomputation', async () => {
  await app.startHand(['As', 'Kd']);
  const spy = app.spy(['renderCanonicalHandWorkspace', 'updateContext', 'calculateEquity']);
  try {
    // A live mutation refreshes the decision context …
    await app.handAction('call');
    await app.settle(300);
    assert.ok(spy.count('updateContext') >= 1);
    // … while Replay cursor moves only rerender Replay and the table.
    spy.reset();
    await app.click('#handReplayPreviousButton');
    await app.click('#handReplayNextButton');
    assert.ok(spy.count('renderCanonicalHandWorkspace') >= 2, 'Replay/table rerender');
    assert.equal(spy.count('updateContext') + spy.count('calculateEquity'), 0, 'no strategy or Equity work');
  } finally {
    spy.restore();
  }
  for (const method of ['previousReplayFrame', 'nextReplayFrame', 'returnReplayToLive']) {
    const block = sourceBetween(
      bridgeSource,
      `${method}()`,
      method === 'returnReplayToLive' ? 'getResolution:' : ({
        previousReplayFrame: 'nextReplayFrame()',
        nextReplayFrame: 'returnReplayToLive()',
      })[method],
    );
    assert.doesNotMatch(block, /canonicalController\.(?:applyAction|deal|reveal|resolve|initialize|reset)/);
  }
  assert.doesNotMatch(projectionSource, /StrategyProvider|resolveStrategy|calculateEquity|RiverlineEquity|Training/);
});

test('historical Replay disables live mutation surfaces and explains live-bound analysis', async () => {
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  assert.equal(projection().readOnly, true);
  for (const id of ['handDealSection', 'handChanceSection', 'handActionSection']) {
    const section = app.byId(id);
    if (!section) continue;
    for (const control of section.querySelectorAll('button, input, select')) assert.equal(control.disabled, true, `${id} ${control.id || control.className}`);
  }
  if (app.byId('handResolveShowdownButton')) assert.equal(app.byId('handResolveShowdownButton').disabled, true);
  const note = app.byId('handReplayReadOnlyNote');
  assert.equal(note.hidden, false);
  assert.equal(text(note), app.evaluate("t('replay.readOnlyHelp')"));
  // A saved hand explains that Replay never changes the live hand.
  app.call('renderCanonicalReplayControls', { ...projection(), viewerContext: { kind: 'saved_hand' } });
  assert.equal(text(note), app.evaluate("t('Read-only saved hand. Replay controls do not change your live hand.')"));
  app.call('renderCanonicalReplayControls', { ...projection(), readOnly: false });
  assert.equal(note.hidden, true);
  await app.click('#handReplayLiveButton');
  assert.match(translations, /Strategy and analysis remain tied to the live decision/);
});

test('timeline consumes completed/current/future and selected-marker facts from the projection', async () => {
  assert.match(projectionSource, /presentationState/);
  assert.match(projectionSource, /return 'completed'/);
  assert.match(projectionSource, /return 'current'/);
  assert.match(projectionSource, /return 'future'/);
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  await app.click('#handReplayPreviousButton');
  const entries = app.$$('#handActionHistory .replay-action-entry');
  assert.ok(entries.length >= 2);
  const states = entries.map((entry) => ['completed', 'current', 'future'].find((state) => entry.classList.contains(`is-replay-${state}`)));
  assert.ok(states.includes('future'), JSON.stringify(states));
  assert.ok(app.$('#handActionHistory .is-replay-current, #handActionHistory [aria-current="step"]'), 'a current step is marked');
  const future = entries.find((node) => node.classList.contains('is-replay-future'));
  const styled = (entry, state) => css.matchingRules(entry.querySelector('.replay-action-body') || entry)
    .some((rule) => rule.selectorText.includes(`replay-action-entry.is-replay-${state}`));
  assert.ok(styled(future, 'future'));
  const current = markup.createElement('li');
  current.className = 'replay-action-entry is-replay-current';
  current.innerHTML = '<div class="replay-action-body"></div>';
  markup.body.appendChild(current);
  assert.ok(styled(current, 'current'));
  current.remove();
  assert.ok(app.$('#handActionHistory [data-replay-progress]') || app.byId('handActionHistory').dataset.replayProgress !== undefined);
  await app.click('#handReplayLiveButton');
});

test('controls and status are native, localized, focus-stable, RTL-safe, and responsive', async () => {
  const keys = [
    'replay.controls.label', 'replay.control.previous', 'replay.control.next',
    'replay.control.returnToLive', 'replay.status.live', 'replay.status.replay',
    'replay.progress', 'replay.status.announcement', 'replay.readOnlyHelp',
    'replay.transition.initialization', 'replay.transition.privateDeal',
    'replay.transition.privateReveal', 'replay.transition.action',
    'replay.transition.flopDeal', 'replay.transition.turnDeal',
    'replay.transition.riverDeal', 'replay.transition.showdown',
  ];
  for (const key of keys) {
    const occurrences = translations.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) || [];
    assert.equal(occurrences.length, 3, `${key} must exist in EN/RU/HE`);
  }
  for (const id of ['handReplayPreviousButton', 'handReplayNextButton', 'handReplayLiveButton']) {
    assert.equal(markup.getElementById(id).getAttribute('type'), 'button', id);
  }
  const group = markup.querySelector('.replay-control-actions');
  assert.equal(group.getAttribute('role'), 'group');
  assert.equal(group.dataset.i18nAriaLabel, 'replay.controls.label');
  const status = markup.getElementById('handReplayStatus');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-atomic'), 'true');
  // Focus never stays on a control that becomes disabled.
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  const next = app.byId('handReplayNextButton');
  next.focus();
  for (let step = 0; step < 10 && !next.disabled; step += 1) await app.click(next);
  assert.notEqual(app.document.activeElement, next);
  const progress = markup.createElement('span');
  progress.className = 'replay-step-progress';
  markup.body.appendChild(progress);
  markup.documentElement.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(progress, 'direction'), 'ltr');
  markup.documentElement.setAttribute('dir', 'ltr');
  progress.remove();
  const note = markup.getElementById('handReplayReadOnlyNote') || markup.querySelector('.replay-readonly-note');
  assert.ok(css.cascaded(note, 'border-inline-start') || css.cascaded(note, 'border-inline-start-width'));
  assert.ok(css.rules.some((rule) => rule.selectorText.includes('replay-control-actions') && rule.conditions.some(({ query }) => query.includes('max-width: 720px'))));
});

test('REPLAY-001C playback and motion are additive while scrub, speed, persistence, and sound remain absent', async () => {
  const historySurface = markup.getElementById('handHistorySection');
  assert.ok(historySurface.querySelector('#handReplayPlaybackButton'));
  assert.doesNotMatch(text(historySurface) + historySurface.querySelectorAll('[id], [class]').map((node) => `${node.id} ${node.className}`).join(' '), /\b(?:autoplay|scrub|speed)\b/i);
  assert.equal(historySurface.querySelector('input[type="range"]'), null);
  assert.doesNotMatch(projectionSource, /setInterval|setTimeout|requestAnimationFrame|localStorage|indexedDB/);
  // Playback drives the projection without intervals, frame loops or storage.
  await handWithHistory();
  await app.click('#handReplayPreviousButton');
  await app.click('#handReplayPreviousButton');
  const spy = app.spy(['setInterval', 'requestAnimationFrame']);
  const setItem = app.window.localStorage.setItem;
  const writes = [];
  app.window.localStorage.setItem = (...args) => { writes.push(args[0]); return setItem.apply(app.window.localStorage, args); };
  try {
    await app.click('#handReplayPlaybackButton');
    assert.ok(app.call('callPlaybookStateBridge', 'createReplayPlaybackViewModel')?.playing);
    await app.settle(2000);
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
    assert.deepEqual(writes, []);
  } finally {
    spy.restore();
    app.window.localStorage.setItem = setItem;
  }
});
