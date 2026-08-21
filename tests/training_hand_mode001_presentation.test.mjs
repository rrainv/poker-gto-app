import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY,
  FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION,
  createFullHandTrainingPresentationOrchestrator,
} from '../app/src/application/full-hand-training-presentation-orchestrator.mjs';

function snapshot({
  status = 'advancing',
  phase = 'betting',
  actor = 'BOT-A',
  pendingChanceType = null,
  actionCount = 0,
} = {}) {
  return Object.freeze({
    schemaVersion: 'full-hand-training-session/v1',
    status,
    heroPlayerId: 'HERO',
    currentDecision: status === 'awaiting_hero'
      ? { currentActor: { playerId: 'HERO', position: 'BTN' } }
      : null,
    state: Object.freeze({
      phase,
      actingPlayerId: phase === 'betting' ? actor : null,
      pendingChance: pendingChanceType ? { type: pendingChanceType } : null,
      actionHistory: Array.from({ length: actionCount }, (_, sequence) => ({ sequence })),
      players: Object.freeze([
        Object.freeze({ playerId: 'HERO', seat: 0, position: 'BTN' }),
        Object.freeze({ playerId: 'BOT-A', seat: 1, position: 'SB' }),
        Object.freeze({ playerId: 'BOT-B', seat: 2, position: 'BB' }),
      ]),
    }),
  });
}

function actionEvent(actor = 'BOT-A', type = 'call') {
  return Object.freeze({
    schemaVersion: 'automated-hand-visible-event/v1',
    kind: 'bot_action',
    transitionKind: 'action',
    actor: { playerId: actor, position: actor === 'BOT-A' ? 'SB' : 'BB' },
    chosenAction: { playerId: actor, type, amountToMilliBb: null },
    boardCardIds: [],
  });
}

function createHarness({ states, steps, wait, reducedMotion = false } = {}) {
  let current = states[0];
  let stepIndex = 0;
  const log = [];
  const orchestrator = createFullHandTrainingPresentationOrchestrator({
    getSnapshot: () => current,
    advanceOne: () => {
      log.push(`advance:${stepIndex + 1}`);
      const step = steps[stepIndex++];
      current = step.snapshot;
      return step;
    },
    renderCue: ({ cue }) => log.push(`cue:${cue.kind}`),
    renderTransition: ({ event, motionEnabled }) => {
      log.push(`render:${event.transitionKind}:${motionEnabled}`);
    },
    renderBoundary: ({ cue }) => log.push(`boundary:${cue.kind}`),
    setInputLocked: (locked) => log.push(`locked:${locked}`),
    wait: wait || ((duration) => {
      log.push(`wait:${duration}`);
      return Promise.resolve();
    }),
    prefersReducedMotion: () => reducedMotion,
  });
  return { orchestrator, log, getStepCount: () => stepIndex };
}

test('normal timing policy is versioned, deterministic, and future profile-ready', () => {
  assert.equal(
    DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.schemaVersion,
    FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION,
  );
  assert.equal(DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.profile, 'normal');
  assert.deepEqual({
    bot: DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.botThinkingMs,
    action: DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.actionSettleMs,
    street: DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.streetRevealMs,
  }, { bot: 750, action: 340, street: 600 });
  assert.equal(Object.isFrozen(DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY), true);
  assert.equal(Object.isFrozen(DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY.reducedMotion), true);
});

test('browser orchestration renders and settles each bot action before advancing again', async () => {
  const first = snapshot({ actor: 'BOT-A' });
  const second = snapshot({ actor: 'BOT-B', actionCount: 1 });
  const beforeHero = snapshot({ actor: 'HERO', actionCount: 2 });
  const hero = snapshot({ status: 'awaiting_hero', actor: 'HERO', actionCount: 2 });
  const harness = createHarness({
    states: [first, second, beforeHero, hero],
    steps: [
      { ok: true, event: actionEvent('BOT-A', 'call'), snapshot: second },
      { ok: true, event: actionEvent('BOT-B', 'check'), snapshot: beforeHero },
      { ok: true, snapshot: hero },
    ],
  });

  const result = await harness.orchestrator.run();

  assert.equal(result.status, 'awaiting_hero');
  assert.equal(harness.getStepCount(), 3);
  assert.deepEqual(harness.log, [
    'locked:true',
    'cue:bot_thinking',
    'wait:750',
    'advance:1',
    'render:action:true',
    'wait:340',
    'cue:bot_thinking',
    'wait:750',
    'advance:2',
    'render:action:true',
    'wait:340',
    'cue:hero_boundary',
    'advance:3',
    'boundary:hero_turn',
    'locked:false',
  ]);
  assert.ok(harness.log.indexOf('render:action:true') < harness.log.indexOf('advance:2'));
  assert.ok(harness.log.lastIndexOf('render:action:true') < harness.log.indexOf('boundary:hero_turn'));
});

test('street transition renders before the following actor can advance', async () => {
  const chance = snapshot({ phase: 'chance', actor: null, pendingChanceType: 'deal_flop' });
  const bot = snapshot({ actor: 'BOT-A' });
  const beforeHero = snapshot({ actor: 'HERO', actionCount: 1 });
  const hero = snapshot({ status: 'awaiting_hero', actor: 'HERO', actionCount: 1 });
  const flopEvent = {
    kind: 'chance',
    transitionKind: 'flop_deal',
    actor: null,
    chosenAction: null,
    boardCardIds: ['As', 'Kd', '2c'],
  };
  const harness = createHarness({
    states: [chance, bot, beforeHero, hero],
    steps: [
      { ok: true, event: flopEvent, snapshot: bot },
      { ok: true, event: actionEvent(), snapshot: beforeHero },
      { ok: true, snapshot: hero },
    ],
  });

  await harness.orchestrator.run();

  assert.ok(harness.log.indexOf('cue:dealing_street') < harness.log.indexOf('advance:1'));
  assert.ok(harness.log.indexOf('render:flop_deal:true') < harness.log.indexOf('cue:bot_thinking'));
  assert.ok(harness.log.indexOf('wait:600') < harness.log.indexOf('advance:2'));
});

test('reset invalidation makes a pending bot-thinking delay stale', async () => {
  let release;
  let advances = 0;
  const first = snapshot({ actor: 'BOT-A' });
  const orchestrator = createFullHandTrainingPresentationOrchestrator({
    getSnapshot: () => first,
    advanceOne: () => { advances += 1; return { ok: true, snapshot: first }; },
    renderCue: () => {},
    renderTransition: () => {},
    renderBoundary: () => {},
    setInputLocked: () => {},
    wait: () => new Promise((resolve) => { release = resolve; }),
  });

  const running = orchestrator.run();
  await Promise.resolve();
  orchestrator.invalidate('new_hand');
  release();
  const result = await running;

  assert.equal(result.status, 'stale');
  assert.equal(advances, 0);
});

test('mode switch invalidation cannot duplicate a bot action across overlapping runs', async () => {
  const releases = [];
  let advances = 0;
  let current = snapshot({ actor: 'BOT-A' });
  const beforeHero = snapshot({ actor: 'HERO', actionCount: 1 });
  const hero = snapshot({ status: 'awaiting_hero', actor: 'HERO', actionCount: 1 });
  const orchestrator = createFullHandTrainingPresentationOrchestrator({
    getSnapshot: () => current,
    advanceOne: () => {
      advances += 1;
      if (current === beforeHero) {
        current = hero;
        return { ok: true, snapshot: hero };
      }
      current = beforeHero;
      return { ok: true, event: actionEvent(), snapshot: beforeHero };
    },
    renderCue: () => {},
    renderTransition: () => {},
    renderBoundary: () => {},
    setInputLocked: () => {},
    wait: (duration) => duration === 750
      ? new Promise((resolve) => releases.push(resolve))
      : Promise.resolve(),
  });

  const oldRun = orchestrator.run();
  await Promise.resolve();
  orchestrator.invalidate('mode_switch');
  const currentRun = orchestrator.run();
  await Promise.resolve();
  releases.forEach((release) => release());
  const [oldResult, currentResult] = await Promise.all([oldRun, currentRun]);

  assert.equal(oldResult.status, 'stale');
  assert.equal(currentResult.status, 'awaiting_hero');
  assert.equal(advances, 2);
});

test('reduced motion preserves every state step while suppressing transition motion', async () => {
  const first = snapshot({ actor: 'BOT-A' });
  const beforeHero = snapshot({ actor: 'HERO', actionCount: 1 });
  const hero = snapshot({ status: 'awaiting_hero', actor: 'HERO', actionCount: 1 });
  const harness = createHarness({
    states: [first, beforeHero, hero],
    steps: [
      { ok: true, event: actionEvent(), snapshot: beforeHero },
      { ok: true, snapshot: hero },
    ],
    reducedMotion: true,
  });

  const result = await harness.orchestrator.run();

  assert.equal(result.status, 'awaiting_hero');
  assert.equal(harness.getStepCount(), 2);
  assert.ok(harness.log.includes('wait:180'));
  assert.ok(harness.log.includes('wait:0'));
  assert.ok(harness.log.includes('render:action:false'));
  assert.ok(harness.log.includes('boundary:hero_turn'));
});
