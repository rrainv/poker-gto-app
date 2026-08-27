import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridgeSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const projectionSource = fs.readFileSync(
  new URL('../app/src/application/replay-projection-controller.mjs', import.meta.url),
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

test('Scenario Mode receives neither Replay projection state nor active cursor operations', () => {
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
  assert.match(logic, /function renderCanonicalReplayTimeline\(\)[\s\S]*?if \(!isHandMode\(\)\)/);
  assert.equal((html.match(/id="handHistorySection"/g) || []).length, 1);
  assert.match(html, /id="playbookHandWorkspace"[^>]*data-playbook-hand[^>]*hidden/);
});

test('Previous, Next, and Return-to-live controls consume projection and canonical lifecycle flags', () => {
  const controls = sourceBetween(
    logic,
    'function renderCanonicalReplayControls(',
    'function renderCanonicalReplayTimeline()',
  );
  const bindings = sourceBetween(
    logic,
    'function bindCanonicalHandWorkspace()',
    'function deriveDecisionContext(',
  );
  assert.match(controls, /projection\.canPrevious/);
  assert.match(controls, /projection\.canNext/);
  assert.match(controls, /projection\.mode === 'replay'/);
  assert.match(controls, /projection\.canReturnToLive === true/);
  assert.match(controls, /liveState\.terminal\?\.isTerminal !== true/);
  assert.match(controls, /live\.hidden = !canExitReplayToLive/);
  assert.match(controls, /projection\.modeLabelKey/);
  assert.match(controls, /projection\.selectedFrame\?\.labelKey/);
  assert.match(bindings, /callPlaybookStateBridge\('previousReplayFrame'\)/);
  assert.match(bindings, /callPlaybookStateBridge\('nextReplayFrame'\)/);
  assert.match(bindings, /callPlaybookStateBridge\('returnReplayToEndpoint'\)/);
  assert.doesNotMatch(`${controls}\n${bindings}`, /actionHistory|ledger|potMilliBb|streetContribution|legalAction|applyAction\(/);
});

test('table dispatch sends the projection table-presence/v1 directly to the accepted renderer', () => {
  const dispatch = sourceBetween(
    logic,
    'function dispatchCanonicalTableState()',
    'function renderCanonicalHandWorkspace()',
  );
  assert.match(dispatch, /createReplayProjectionViewModel/);
  assert.match(dispatch, /projection\?\.tablePresence/);
  assert.match(dispatch, /new CustomEvent\('gameStateUpdate', \{ detail: tableModel \}\)/);
  assert.match(renderer, /state\.schemaVersion === 'table-presence\/v1'/);
  assert.doesNotMatch(dispatch, /\.players|actionHistory|ledger|potMilliBb|streetContributionMilliBb/);
});

test('cursor events rerender Replay/table only and bypass strategy and Equity recomputation', () => {
  const stateListener = sourceBetween(
    logic,
    "window.addEventListener('riverline:playbook-state-change'",
    'function formatCanonicalBb(',
  );
  assert.match(
    stateListener,
    /renderCanonicalHandWorkspace\(\);[\s\S]*?operation\?\.startsWith\('replay_'\)[\s\S]*?operation\?\.startsWith\('saved_hand_'\)\) return;[\s\S]*?updateContext/,
  );
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

test('historical Replay disables live mutation surfaces and explains live-bound analysis', () => {
  const readOnly = sourceBetween(
    logic,
    'function setCanonicalReplayReadOnly(',
    'function dispatchCanonicalTableState()',
  );
  assert.match(readOnly, /projection\?\.readOnly === true/);
  assert.match(readOnly, /'handDealSection', 'handChanceSection', 'handActionSection'/);
  assert.match(readOnly, /querySelectorAll\('button, input, select'\)/);
  assert.match(readOnly, /control\.disabled = true/);
  assert.match(readOnly, /handResolveShowdownButton/);
  assert.match(html, /id="handReplayReadOnlyNote"[^>]*data-i18n="replay\.readOnlyHelp"/);
  assert.match(translations, /Strategy and analysis remain tied to the live decision/);
});

test('timeline consumes completed/current/future and selected-marker facts from the projection', () => {
  const timeline = sourceBetween(
    logic,
    'function createReplayActionEntry(',
    'function setCanonicalReplayReadOnly(',
  );
  assert.match(projectionSource, /presentationState/);
  assert.match(projectionSource, /return 'completed'/);
  assert.match(projectionSource, /return 'current'/);
  assert.match(projectionSource, /return 'future'/);
  assert.match(timeline, /entry\.presentationState/);
  assert.match(timeline, /data\.replayProgress|dataset\.replayProgress/);
  assert.match(timeline, /model\.showCurrentMarker/);
  assert.doesNotMatch(timeline, /actionHistory|submittedAction|committedMilliBb|currentBetAfterMilliBb/);
  for (const state of ['current', 'future']) {
    assert.match(css, new RegExp(`replay-action-entry\\.is-replay-${state}`));
  }
});

test('controls and status are native, localized, focus-stable, RTL-safe, and responsive', () => {
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
  for (const id of [
    'handReplayPreviousButton', 'handReplayNextButton', 'handReplayLiveButton',
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]*type="button"`));
  }
  assert.match(html, /class="replay-control-actions"[^>]*role="group"[^>]*data-i18n-aria-label="replay\.controls\.label"/);
  assert.match(html, /id="handReplayStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(logic, /focusedControl\?\.disabled[\s\S]*?\.focus\(\)/);
  assert.match(css, /\[dir="rtl"\] \.replay-step-progress[\s\S]*?direction:\s*ltr/);
  assert.match(css, /replay-readonly-note[\s\S]*?border-inline-start/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?replay-control-actions/);
});

test('REPLAY-001C playback and motion are additive while scrub, speed, persistence, and sound remain absent', () => {
  const historySurface = sourceBetween(
    html,
    '<section id="handHistorySection"',
    '</section>',
  );
  const replayLogic = sourceBetween(
    logic,
    'function replayActorLabel(',
    'function renderCanonicalHandWorkspace()',
  );
  assert.match(historySurface, /id="handReplayPlaybackButton"/);
  assert.match(replayLogic, /createReplayPlaybackViewModel/);
  assert.doesNotMatch(historySurface, /\b(?:autoplay|scrub|speed)\b/i);
  assert.doesNotMatch(replayLogic, /setInterval|requestAnimationFrame|SoundFX|localStorage|indexedDB/);
  assert.doesNotMatch(projectionSource, /setInterval|setTimeout|requestAnimationFrame|localStorage|indexedDB/);
  assert.doesNotMatch(historySurface, /type="range"/);
});
