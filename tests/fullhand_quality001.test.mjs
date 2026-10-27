import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createFullHandTrainingPresentationOrchestrator } from '../app/src/application/full-hand-training-presentation-orchestrator.mjs';
import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// FULLHAND-QUALITY-001: WATCH-REST skip, QA-SWEEP-030 header state,
// QA-SWEEP-010 lineup tiles.

function snapshot(status, phase = 'betting', actor = 'BOT-A') {
  return Object.freeze({
    status,
    heroPlayerId: 'HERO',
    currentDecision: null,
    state: Object.freeze({
      phase,
      actingPlayerId: phase === 'betting' ? actor : null,
      pendingChance: null,
      players: Object.freeze([
        Object.freeze({ playerId: 'HERO', seat: 0, position: 'BTN', folded: true }),
        Object.freeze({ playerId: 'BOT-A', seat: 1, position: 'SB' }),
        Object.freeze({ playerId: 'BOT-B', seat: 2, position: 'BB' }),
      ]),
    }),
  });
}

const actionEvent = (actor) => Object.freeze({
  kind: 'bot_action',
  transitionKind: 'action',
  actor: { playerId: actor },
  chosenAction: { playerId: actor, type: 'call' },
});

test('Skip drops the remaining pacing and motion but still applies every canonical event', async () => {
  const states = [
    snapshot('advancing', 'betting', 'BOT-A'),
    snapshot('advancing', 'betting', 'BOT-B'),
    snapshot('advancing', 'betting', 'BOT-A'),
    snapshot('terminal', 'terminal'),
  ];
  let current = states[0];
  let step = 0;
  const log = [];
  const pendingWaits = [];
  const orchestrator = createFullHandTrainingPresentationOrchestrator({
    getSnapshot: () => current,
    advanceOne: () => {
      step += 1;
      log.push(`advance:${step}`);
      current = states[step];
      return { ok: true, snapshot: current, event: actionEvent(step % 2 ? 'BOT-A' : 'BOT-B') };
    },
    renderCue: ({ cue }) => log.push(`cue:${cue.kind}`),
    renderTransition: ({ motionEnabled }) => log.push(`render:${motionEnabled}`),
    renderBoundary: ({ cue }) => log.push(`boundary:${cue.kind}`),
    setInputLocked: () => {},
    // A wait that never settles on its own: only Skip can release it.
    wait: (duration) => {
      log.push(`wait:${duration}`);
      return new Promise((resolve) => pendingWaits.push(resolve));
    },
  });

  const run = orchestrator.run();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(log, ['cue:bot_thinking', 'wait:850'], 'paused on the first bot');
  assert.equal(orchestrator.skip(), true);
  assert.equal(orchestrator.skip(), false, 'a second skip in the same run is a no-op');
  const result = await run;

  assert.equal(result.status, 'terminal');
  assert.equal(step, 3, 'all three canonical events were applied');
  assert.deepEqual(log.slice(2), [
    'advance:1', 'render:false',
    'cue:bot_thinking', 'advance:2', 'render:false',
    'cue:bot_thinking', 'advance:3', 'render:false',
    'boundary:hand_complete',
  ], 'no further waits and no motion after Skip');
});

test('a Skip does not leak into the next presentation run', async () => {
  let current = snapshot('advancing');
  const waits = [];
  const orchestrator = createFullHandTrainingPresentationOrchestrator({
    getSnapshot: () => current,
    advanceOne: () => {
      current = snapshot('terminal', 'terminal');
      return { ok: true, snapshot: current, event: actionEvent('BOT-A') };
    },
    renderCue: () => {},
    renderTransition: () => {},
    renderBoundary: () => {},
    setInputLocked: () => {},
    wait: (duration) => { waits.push(duration); return Promise.resolve(); },
  });
  orchestrator.skip();
  await orchestrator.run();
  assert.ok(waits.length >= 2, 'a skip requested before the run does not apply to it');
});

const css = appStyleSheet();
const markup = indexDocument();
const app = await bootApp();
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

test('the Skip control is a hidden, translated button beside the live Full Hand controls', () => {
  const skip = markup.getElementById('trainingFullHandSkipRest');
  assert.ok(skip);
  assert.equal(skip.tagName, 'BUTTON');
  assert.equal(skip.hasAttribute('hidden'), true, 'shown only while watching the rest');
  assert.equal(skip.closest('#trainingFullHandCompactControls')?.id, 'trainingFullHandCompactControls');
  assert.match(translations, /\['Skip to end', '[^']+', '[^']+'\]/);
});

test('the Training heading follows the state instead of always asking for a decision', () => {
  const title = () => app.byId('trainingWorkspaceTitle').textContent;
  const setFullHand = (status, folded) => app.evaluate(`app.training.fullHandSnapshot = ${JSON.stringify({
    status,
    heroPlayerId: 'HERO',
    state: { players: [{ playerId: 'HERO', folded }] },
  })}`);
  try {
    setFullHand('awaiting_hero', false);
    app.call('setTrainingWorkspaceState', 'ready');
    assert.equal(title(), app.call('t', 'Make the decision'));
    app.call('setTrainingWorkspaceState', 'feedback');
    assert.equal(title(), app.call('t', 'Learn from this decision'));
    app.byId('trainingWorkspace').dataset.trainingFullHandPhase = 'live';
    setFullHand('advancing', true);
    app.call('setTrainingWorkspaceState', 'automating');
    assert.equal(title(), app.call('t', 'Watching the rest of this hand'));
    setFullHand('hero_complete', true);
    app.call('setTrainingWorkspaceState', 'terminal');
    assert.equal(title(), app.call('t', 'Your hand summary'));
    setFullHand('terminal', true);
    app.call('setTrainingWorkspaceState', 'terminal');
    assert.equal(title(), app.call('t', 'Hand Complete'));
    app.byId('trainingWorkspace').dataset.trainingFullHandPhase = 'review';
    app.call('syncTrainingWorkspaceTitle');
    assert.equal(title(), app.call('t', 'Post-Hand Review'));
    app.call('setTrainingWorkspaceState', 'complete');
    assert.equal(title(), app.call('t', 'Session complete'));
  } finally {
    app.evaluate('app.training.fullHandSnapshot = null');
    app.byId('trainingWorkspace').dataset.trainingFullHandPhase = 'off';
    app.call('setTrainingWorkspaceState', 'idle');
  }
});

test('opponent lineup tiles stack name, position and behaviour without clipping', () => {
  const host = app.document.createElement('div');
  host.innerHTML = '<ul class="training-lineup-roster"><li data-hero="false"><button class="training-lineup-seat" type="button"><img alt=""><div><strong>Mika</strong><bdi>BTN</bdi><small>Calling-heavy</small></div></button></li></ul>';
  app.document.body.appendChild(host);
  try {
    const copy = host.querySelector('.training-lineup-seat > div');
    assert.equal(css.cascaded(copy, 'display'), 'grid', 'one line each, like the Hero tile');
    assert.equal(css.cascaded(copy, 'min-width'), '0');
    assert.equal(css.cascaded(host.querySelector('strong'), 'overflow-wrap'), 'break-word', 'names break at words, not mid-letter');
    assert.equal(css.cascaded(host.querySelector('li'), 'padding'), '0', 'the seat button owns the tile padding');
    assert.equal(css.cascaded(host.querySelector('img'), 'inline-size'), '48px');
  } finally {
    host.remove();
  }
});
