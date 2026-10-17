import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  EXPERIENCE_EVENT_FAMILIES,
  EXPERIENCE_EVENT_ORIGINS,
  EXPERIENCE_EVENT_SCHEMA_VERSION,
  EXPERIENCE_EVENT_TYPES,
  STUDY_AUDIO_MEANINGS,
  createExperienceEvent,
  createPokerWorldExperienceEvents,
  createStudyExperienceEvent,
  installExperienceEventsBridge,
  trainingStudyAudioMeaning,
} from '../app/src/application/experience-events.mjs';
import {
  RIVERLINE_MOTION_DURATIONS,
  motionIntentForExperienceEvent,
} from '../app/src/application/experience-motion.mjs';

const soundSource = fs.readFileSync(
  new URL('../app/src/core/SoundFX.js', import.meta.url),
  'utf8',
);
const foleyManifestSource = fs.readFileSync(
  new URL('../app/src/core/AudioFoleyManifest.js', import.meta.url),
  'utf8',
);
const experienceSource = fs.readFileSync(
  new URL('../app/src/application/experience-events.mjs', import.meta.url),
  'utf8',
);
const motionSource = fs.readFileSync(
  new URL('../app/src/application/experience-motion.mjs', import.meta.url),
  'utf8',
);
// SOURCE-SHAPE (TEST-HYGIENE-001): "logic.js never calls SoundFX.play* or
// physical foley (playPokerAction/playChip/playCardDeal/emitPokerAction)
// directly" is a call-site lint: SoundFX is a frozen lexical const in the page,
// so direct calls cannot be intercepted at runtime. Everything else from
// logic.js / index.html / styles.css is checked in the booted app, the parsed
// document and the cascade.
const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
// Booting installs the page's fake timers: the audio harnesses keep Node's.
const nodeSetTimeout = globalThis.setTimeout;
let bootedPage = null;
async function bootedApp() {
  if (!bootedPage) {
    const { bootApp } = await import('./helpers/app-under-test.mjs');
    bootedPage = await bootApp();
  }
  return bootedPage;
}
const rendererSource = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const playbookSource = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const trainingSource = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const replaySource = fs.readFileSync(
  new URL('../app/src/application/replay-projection-controller.mjs', import.meta.url),
  'utf8',
);
const { appStyleSheet, indexDocument, precedes } = await import('./helpers/app-under-test.mjs');
const markup = indexDocument();
const i18nSource = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const tablePresentationSource = fs.readFileSync(
  new URL('../app/src/application/table-presentation.mjs', import.meta.url),
  'utf8',
);

function state({ street = 'preflop', phase = 'betting', actor = 'p2', terminal = null } = {}) {
  return Object.freeze({ street, phase, actingPlayerId: actor, terminal });
}

function actionMotion({
  actor = 'p1',
  nextActor = 'p2',
  previousContribution = 0,
  nextContribution = 2500,
} = {}) {
  return Object.freeze({
    actorPlayerId: actor,
    nextActorPlayerId: nextActor,
    seatChanges: Object.freeze([Object.freeze({
      playerId: actor,
      visualSeatIndex: 0,
      contribution: Object.freeze({
        changed: previousContribution !== nextContribution,
        previousMilliBb: previousContribution,
        nextMilliBb: nextContribution,
      }),
    })]),
  });
}

test('experience events are deterministic, deeply immutable, and family typed', () => {
  const input = {
    type: EXPERIENCE_EVENT_TYPES.ACTION_RAISE,
    origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
    source: 'hand:alpha',
    token: 7,
    payload: { nested: { amountMilliBb: 4200 } },
  };
  const first = createExperienceEvent(input);
  const second = createExperienceEvent(input);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, EXPERIENCE_EVENT_SCHEMA_VERSION);
  assert.equal(first.eventId, 'hand:alpha:7:0:action_raise');
  assert.equal(first.family, EXPERIENCE_EVENT_FAMILIES.POKER_WORLD);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.payload.nested), true);
  assert.notEqual(first.payload, input.payload);

  const study = createStudyExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.DECISION_SUBMITTED,
    source: 'training',
    token: 'answer-1',
    payload: { comparisonState: 'aligned' },
  });
  assert.equal(study.family, EXPERIENCE_EVENT_FAMILIES.STUDY);
  const review = createStudyExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.REVIEW_DECISION_SELECTED,
    origin: EXPERIENCE_EVENT_ORIGINS.REVIEW_SELECTION,
    source: 'hand_review',
    token: 2,
  });
  assert.equal(review.origin, EXPERIENCE_EVENT_ORIGINS.REVIEW_SELECTION);
  assert.equal(review.family, EXPERIENCE_EVENT_FAMILIES.STUDY);
  assert.throws(() => createStudyExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.ACTION_CHECK,
    source: 'training',
    token: 1,
  }), /cannot use a poker-world event type/);
});

test('only permitted truth outcomes select positive or corrective study meaning', () => {
  for (const feedbackSemantics of ['comparative', 'normative', 'normative_assessment', 'unavailable']) {
    for (const comparisonState of ['optimal', 'acceptable', 'mistake', 'unknown']) {
      assert.equal(trainingStudyAudioMeaning({ comparisonState, feedbackSemantics }), STUDY_AUDIO_MEANINGS.NEUTRAL);
    }
  }
  for (const [outcome, permission, expected] of [['supported', 'correct', 'positive'], ['unsupported', 'incorrect', 'corrective']]) {
    const truth = { state: 'normative_assessment', outcome, claims: { [permission]: true } };
    assert.equal(trainingStudyAudioMeaning({ truth }), expected);
    assert.equal(trainingStudyAudioMeaning({ truth: { ...truth, claims: {} } }), 'neutral');
    assert.equal(trainingStudyAudioMeaning({ truth: { ...truth, state: 'heuristic_comparison' } }), 'neutral');
  }
});

test('one completed canonical action derives action, chip, and actor events without mutating state', () => {
  const previousState = state({ actor: 'p1' });
  const nextState = state({ actor: 'p2' });
  const before = structuredClone({ previousState, nextState });
  const batch = createPokerWorldExperienceEvents({
    origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
    source: 'hand:alpha',
    token: 11,
    operation: 'action',
    transitionKind: 'action',
    previousState,
    state: nextState,
    actorPlayerId: 'p1',
    actionType: 'raise',
    motion: actionMotion(),
  });

  assert.deepEqual(batch.events.map((event) => event.type), [
    EXPERIENCE_EVENT_TYPES.ACTION_RAISE,
    EXPERIENCE_EVENT_TYPES.CHIPS_COMMITTED,
    EXPERIENCE_EVENT_TYPES.ACTOR_CHANGED,
  ]);
  assert.deepEqual(batch.events[1].payload.contribution, {
    previousMilliBb: 0,
    nextMilliBb: 2500,
    deltaMilliBb: 2500,
    visualSeatIndex: 0,
  });
  assert.deepEqual({ previousState, nextState }, before);
  assert.equal(Object.isFrozen(batch), true);
  assert.equal(Object.isFrozen(batch.events), true);
});

test('deals, street settlement, showdown, award, and neutral completion are explicit events', () => {
  const privateDeal = createPokerWorldExperienceEvents({
    source: 'hand:alpha',
    token: 11,
    operation: 'deal_hole',
    transitionKind: 'private_deal',
    holeCardCount: 4,
  });
  assert.deepEqual(privateDeal.events.map((event) => event.type), [
    EXPERIENCE_EVENT_TYPES.CARD_DEALT,
  ]);
  assert.equal(privateDeal.events[0].payload.cardCount, 4);

  const flop = createPokerWorldExperienceEvents({
    source: 'hand:alpha',
    token: 12,
    operation: 'deal_board',
    transitionKind: 'flop_deal',
    previousState: state({ street: 'preflop', phase: 'chance' }),
    state: state({ street: 'flop' }),
    boardCardIds: ['As', 'Kd', '7h'],
  });
  assert.deepEqual(flop.events.map((event) => event.type), [
    EXPERIENCE_EVENT_TYPES.BOARD_REVEALED,
    EXPERIENCE_EVENT_TYPES.STREET_ADVANCED,
  ]);
  assert.equal(flop.events[0].payload.cardCount, 3);

  const streetClose = createPokerWorldExperienceEvents({
    source: 'hand:alpha',
    token: 13,
    operation: 'action',
    actionType: 'check',
    previousState: state({ street: 'flop', phase: 'betting', actor: 'p1' }),
    state: state({ street: 'flop', phase: 'chance', actor: null }),
  });
  assert.deepEqual(streetClose.events.map((event) => event.type), [
    EXPERIENCE_EVENT_TYPES.ACTION_CHECK,
    EXPERIENCE_EVENT_TYPES.POT_COLLECTED,
  ]);

  const terminal = createPokerWorldExperienceEvents({
    source: 'hand:alpha',
    token: 14,
    operation: 'showdown',
    transitionKind: 'showdown_resolution',
    previousState: state({ phase: 'showdown', actor: null }),
    state: state({
      phase: 'terminal',
      actor: null,
      terminal: { isTerminal: true, reason: 'showdown', winnerPlayerIds: ['p2'] },
    }),
    terminalOverride: true,
    potAwardedOverride: true,
  });
  assert.deepEqual(terminal.events.map((event) => event.type), [
    EXPERIENCE_EVENT_TYPES.POT_AWARDED,
    EXPERIENCE_EVENT_TYPES.HAND_COMPLETED,
  ]);
  assert.equal(terminal.events.at(-1).payload.terminalReason, 'showdown');
  assert.deepEqual(terminal.events.at(-1).payload.winnerPlayerIds, ['p2']);
});

test('every canonical action family selects its exact semantic event', () => {
  const expected = new Map([
    ['fold', EXPERIENCE_EVENT_TYPES.ACTION_FOLD],
    ['check', EXPERIENCE_EVENT_TYPES.ACTION_CHECK],
    ['call', EXPERIENCE_EVENT_TYPES.ACTION_CALL],
    ['bet', EXPERIENCE_EVENT_TYPES.ACTION_BET],
    ['raise', EXPERIENCE_EVENT_TYPES.ACTION_RAISE],
    ['all_in', EXPERIENCE_EVENT_TYPES.ACTION_ALL_IN],
  ]);
  let token = 40;
  for (const [actionType, eventType] of expected) {
    const batch = createPokerWorldExperienceEvents({
      source: 'hand:actions',
      token: token += 1,
      operation: 'action',
      previousState: state({ actor: 'p1' }),
      state: state({ actor: 'p1' }),
      actorPlayerId: 'p1',
      actionType,
    });
    assert.equal(batch.events[0].type, eventType, actionType);
  }
});

test('historical render origins suppress poker-world events by contract', () => {
  for (const origin of [
    EXPERIENCE_EVENT_ORIGINS.DIRECT_SEEK,
    EXPERIENCE_EVENT_ORIGINS.INITIAL_RENDER,
    EXPERIENCE_EVENT_ORIGINS.HYDRATION,
    EXPERIENCE_EVENT_ORIGINS.REVIEW_SELECTION,
  ]) {
    const batch = createPokerWorldExperienceEvents({
      origin,
      source: 'saved-hand:1',
      token: 4,
      operation: 'action',
      actionType: 'all_in',
    });
    assert.deepEqual(batch.events, [], origin);
  }
});

test('motion is semantic, bounded, and makes reduced-motion travel instant and inactive', () => {
  const event = createExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.CHIPS_COMMITTED,
    origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
    source: 'hand:alpha',
    token: 20,
  });
  const normal = motionIntentForExperienceEvent(event);
  assert.equal(normal.active, true);
  assert.equal(normal.kind, 'chips_commit');
  assert.equal(normal.travel, true);
  assert.equal(normal.durationMs, RIVERLINE_MOTION_DURATIONS.poker_settle);
  assert.ok(normal.durationMs >= 100 && normal.durationMs <= 300);

  const reduced = motionIntentForExperienceEvent(event, { reducedMotion: true });
  assert.equal(reduced.active, false);
  assert.equal(reduced.travel, false);
  assert.equal(reduced.durationMs, 0);

  const answer = createStudyExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.DECISION_SUBMITTED,
    source: 'training',
    token: 1,
  });
  assert.equal(motionIntentForExperienceEvent(answer).active, false);
});

test('the browser bridge deduplicates one event and shares one reduced-motion decision', () => {
  const sounds = [];
  const dispatched = [];
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const browserWindow = {
    SoundFX: { consumeExperienceEvent: (event) => sounds.push(event.eventId) },
    CustomEvent,
    matchMedia: () => ({ matches: true }),
    dispatchEvent: (event) => dispatched.push(event),
  };
  const bridge = installExperienceEventsBridge(browserWindow);
  const event = createExperienceEvent({
    type: EXPERIENCE_EVENT_TYPES.POT_AWARDED,
    origin: EXPERIENCE_EVENT_ORIGINS.LIVE,
    source: 'hand:alpha',
    token: 30,
  });
  const first = bridge.emit(event);
  const duplicate = bridge.emit(event);
  assert.equal(first.accepted, true);
  assert.equal(first.motion.active, false);
  assert.equal(duplicate.reason, 'duplicate');
  assert.deepEqual(sounds, [event.eventId]);
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, 'riverline:experience-event');
});

function createAudioHarness({
  hidden = false,
  initial = {},
  audioAvailable = true,
  failSamples = false,
} = {}) {
  const storage = new Map(Object.entries(initial));
  let contextCount = 0;
  let fetchCount = 0;
  let decodeCount = 0;
  const envelopes = [];
  const sampleStarts = [];
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    closeCalls: 0,
    async resume() { this.state = 'running'; },
    async close() { this.closeCalls += 1; this.state = 'closed'; },
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {}, start() {}, stop() {},
      };
    },
    createBufferSource() {
      const source = {
        buffer: null,
        playbackRate: {
          value: 1,
          setValueAtTime(value) { this.value = value; },
        },
        connect() {},
        start(time, sourceOffset, duration) {
          sampleStarts.push({
            buffer: this.buffer,
            playbackRate: this.playbackRate.value,
            time,
            sourceOffset,
            duration,
          });
        },
        stop() {},
      };
      return source;
    },
    decodeAudioData(arrayBuffer, onSuccess) {
      decodeCount += 1;
      const buffer = { duration: 0.5, byteLength: arrayBuffer.byteLength };
      onSuccess?.(buffer);
      return Promise.resolve(buffer);
    },
    createGain() {
      const values = [];
      envelopes.push(values);
      return {
        gain: {
          setValueAtTime(value, time) { values.push({ value, time }); },
          exponentialRampToValueAtTime(value, time) { values.push({ value, time }); },
        },
        connect() {},
      };
    },
  };
  class AudioContext {
    constructor() { contextCount += 1; return context; }
  }
  const sandbox = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    document: {
      hidden,
      baseURI: 'http://riverline.test/app/index.html',
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    fetch: async () => {
      fetchCount += 1;
      if (failSamples) return { ok: false };
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
    },
    URL,
    ArrayBuffer,
    setTimeout: nodeSetTimeout,
    window: audioAvailable ? {
      AudioContext,
      location: { href: 'http://riverline.test/app/index.html' },
    } : { location: { href: 'http://riverline.test/app/index.html' } },
  };
  vm.runInNewContext(`${foleyManifestSource}\n${soundSource}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return {
    sound: sandbox.exposedSoundFX,
    storage,
    context,
    envelopes,
    sampleStarts,
    contextCount: () => contextCount,
    fetchCount: () => fetchCount,
    decodeCount: () => decodeCount,
  };
}

function audioEvent({ type, origin = 'live', source = 'hand:alpha', token = 1, payload = {} }) {
  return {
    schemaVersion: EXPERIENCE_EVENT_SCHEMA_VERSION,
    eventId: `${source}:${token}:0:${type}`,
    family: type.startsWith('decision_') ? 'study' : 'poker_world',
    type,
    origin,
    source,
    token,
    payload,
  };
}

test('recorded-foley manifest is versioned, immutable, CC0-provenanced, and byte-verified', () => {
  const manifest = createAudioHarness().sound.getFoleyManifest();
  assert.equal(manifest.schemaVersion, 'riverline-audio-foley-manifest/v1');
  assert.equal(manifest.sourcePolicy, 'recorded_foley_primary');
  assert.equal(manifest.samples.length, 15);
  assert.equal(manifest.samples.filter((sample) => sample.production).length, 11);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.samples), true);
  let totalBytes = 0;
  for (const sample of manifest.samples) {
    assert.equal(sample.sourceType, 'recorded_foley');
    assert.equal(sample.format, 'audio/ogg');
    assert.equal(sample.provenance.license.id, 'CC0-1.0');
    assert.match(sample.provenance.pageUrl, /^https:\/\/freesound\.org\/people\//);
    assert.equal(typeof sample.production, 'boolean');
    assert.ok(sample.playback.gainTrim > 0 && sample.playback.gainTrim <= 1.5);
    assert.ok(sample.playback.sourceOffsetMs >= 0);
    assert.ok(sample.playback.playDurationMs > 0);
    assert.ok(sample.playback.sourceOffsetMs + sample.playback.playDurationMs <= sample.durationMs);
    assert.ok(sample.playback.fadeOutMs >= 0 && sample.playback.fadeOutMs < sample.playback.playDurationMs);
    const bytes = fs.readFileSync(new URL(`../app/${sample.url}`, import.meta.url));
    totalBytes += bytes.length;
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'OggS', sample.id);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sample.sha256);
  }
  assert.ok(totalBytes > 100_000 && totalBytes < 250_000);
  const excluded = manifest.samples.filter((sample) => !sample.production).map((sample) => sample.id);
  assert.deepEqual(Array.from(excluded), [
    'card-slide-02', 'chip-medium-02', 'chip-pot-02', 'table-check-02',
  ]);
});

test('human-accepted physical families retain their exact membership, trims, layers, and variation', () => {
  const manifest = createAudioHarness().sound.getFoleyManifest();
  const acceptedFamilyIds = ['cards_deal', 'cards_slide', 'chips_small', 'chips_medium', 'chips_large', 'chips_pot'];
  const actual = JSON.parse(JSON.stringify({
    families: Object.fromEntries(acceptedFamilyIds.map((family) => [family, manifest.families[family]])),
    playback: Object.fromEntries(manifest.samples
      .filter((sample) => acceptedFamilyIds.includes(sample.family) && sample.production)
      .map((sample) => [sample.id, sample.playback])),
    cues: Object.fromEntries(['card_deal', 'board_reveal', 'card_reveal', 'fold', 'call', 'bet', 'raise', 'all_in', 'pot_collect']
      .map((cueName) => [cueName, manifest.cues[cueName]])),
    variation: manifest.variation,
  }));
  assert.deepEqual(actual, {
    families: {
      cards_deal: ['card-deal-01', 'card-deal-02'],
      cards_slide: ['card-slide-01'],
      chips_small: ['chip-small-01', 'chip-small-02', 'chip-small-03'],
      chips_medium: ['chip-medium-01'],
      chips_large: ['chip-large-01', 'chip-large-02'],
      chips_pot: ['chip-pot-01'],
    },
    playback: {
      'card-deal-01': { gainTrim: 1, sourceOffsetMs: 70, playDurationMs: 430, fadeOutMs: 18 },
      'card-deal-02': { gainTrim: 0.78, sourceOffsetMs: 110, playDurationMs: 540, fadeOutMs: 18 },
      'card-slide-01': { gainTrim: 1.35, sourceOffsetMs: 20, playDurationMs: 320, fadeOutMs: 18 },
      'chip-small-01': { gainTrim: 1.1, sourceOffsetMs: 0, playDurationMs: 290, fadeOutMs: 18 },
      'chip-small-02': { gainTrim: 0.97, sourceOffsetMs: 0, playDurationMs: 320, fadeOutMs: 18 },
      'chip-small-03': { gainTrim: 0.83, sourceOffsetMs: 0, playDurationMs: 220, fadeOutMs: 18 },
      'chip-medium-01': { gainTrim: 0.72, sourceOffsetMs: 0, playDurationMs: 230, fadeOutMs: 18 },
      'chip-large-01': { gainTrim: 0.5, sourceOffsetMs: 0, playDurationMs: 920, fadeOutMs: 28 },
      'chip-large-02': { gainTrim: 0.85, sourceOffsetMs: 0, playDurationMs: 830, fadeOutMs: 28 },
      'chip-pot-01': { gainTrim: 0.55, sourceOffsetMs: 70, playDurationMs: 1100, fadeOutMs: 32 },
    },
    cues: {
      card_deal: { layers: [{ family: 'cards_deal', count: 1, spacingMs: 0, gain: 0.88 }] },
      board_reveal: { layers: [{ family: 'cards_deal', count: 3, spacingMs: 92, gain: 0.72 }] },
      card_reveal: { layers: [{ family: 'cards_deal', count: 1, spacingMs: 0, gain: 0.8 }] },
      fold: { layers: [{ family: 'cards_slide', count: 1, spacingMs: 0, gain: 0.88 }] },
      call: { layers: [{ family: 'chips_small', count: 1, spacingMs: 0, gain: 0.55 }] },
      bet: { layers: [{ family: 'chips_medium', count: 1, spacingMs: 0, gain: 0.74 }] },
      raise: { layers: [{ family: 'chips_medium', count: 2, spacingMs: 44, gain: 0.7 }] },
      all_in: { layers: [{ family: 'chips_large', count: 1, spacingMs: 0, gain: 0.92 }] },
      pot_collect: { layers: [{ family: 'chips_pot', count: 1, spacingMs: 0, gain: 0.74 }] },
    },
    variation: { playbackRateRange: [0.998, 1.002], gainRange: [0.99, 1.01], timingJitterMs: 1.5 },
  });
});

test('Check uses the isolated single-impact table knock in production and preview', async () => {
  const harness = createAudioHarness();
  const manifest = harness.sound.getFoleyManifest();
  assert.deepEqual(Array.from(manifest.families.table_check), ['table-check-01']);
  const selected = manifest.samples.find((sample) => sample.id === 'table-check-01');
  const excluded = manifest.samples.find((sample) => sample.id === 'table-check-02');
  assert.equal(selected.production, true);
  assert.equal(excluded.production, false);
  assert.deepEqual(JSON.parse(JSON.stringify(selected.playback)), {
    gainTrim: 0.32,
    sourceOffsetMs: 35,
    playDurationMs: 145,
    fadeOutMs: 42,
  });
  const preview = await harness.sound.previewCue('check');
  assert.equal(preview.sourceType, 'recorded_foley');
  assert.deepEqual(Array.from(preview.sampleIds), ['table-check-01']);
  assert.equal(harness.sampleStarts[0].sourceOffset, 0.035);
  assert.equal(harness.sampleStarts[0].duration, 0.145);
});

test('six Study meanings have distinct short contours, registers or rhythm', async () => {
  const cueNames = ['study_positive', 'study_corrective', 'study_neutral', 'hint', 'warning', 'error'];
  const configs = createAudioHarness().sound.getStudyCueConfig();
  const signatures = new Set();
  for (const cueName of cueNames) {
    const harness = createAudioHarness();
    assert.equal((await harness.sound.previewCue(cueName)).cueName, cueName);
    assert.equal(harness.envelopes.length, 2);
    const peak = Math.max(...harness.envelopes.flatMap(e => e.map(v => v.value)));
    assert.ok(peak >= .05 && peak <= .12, `${cueName} restrained but audible`);
    const span = Math.max(...harness.envelopes.flatMap(e => e.map(v => v.time))) - harness.envelopes[0][0].time;
    assert.ok(span >= .1 && span <= .5, `${cueName} stays brief`);
    signatures.add(JSON.stringify(configs[cueName]));
  }
  assert.equal(signatures.size, 6);
  assert.ok(configs.study_positive.endFrequency > configs.study_positive.startFrequency);
  assert.equal(configs.study_neutral.endFrequency, configs.study_neutral.startFrequency);
  assert.ok(configs.study_corrective.endFrequency < configs.study_corrective.startFrequency);
  assert.ok(configs.warning.supportDelay >= .15);
  assert.equal(configs.error.type, 'triangle');
});

test('prepared Training feedback schedules its Study cue before the returned promise yields', async () => {
  const harness = createAudioHarness();
  await harness.sound.prepareForUserGesture();
  harness.context.currentTime += 1;
  const before = harness.envelopes.length;
  const scheduled = harness.sound.playCorrect();
  assert.equal(harness.envelopes.length, before + 2,
    'a running context schedules both Study oscillators synchronously');
  assert.equal((await scheduled).cueName, 'study_neutral');
});

test('every poker cue resolves only to physical sample families with mass-based layering', () => {
  const sound = createAudioHarness().sound;
  const manifest = sound.getFoleyManifest();
  const expectedFamilies = new Map([
    ['card_deal', ['cards_deal']],
    ['board_reveal', ['cards_deal']],
    ['card_reveal', ['cards_deal']],
    ['check', ['table_check']],
    ['fold', ['cards_slide']],
    ['call', ['chips_small']],
    ['bet', ['chips_medium']],
    ['raise', ['chips_medium']],
    ['all_in', ['chips_large']],
    ['pot_collect', ['chips_pot']],
  ]);
  for (const [cueName, families] of expectedFamilies) {
    assert.deepEqual(Array.from(manifest.cues[cueName].layers, (layer) => layer.family), families);
    assert.equal(sound.getCueCatalog()[cueName].sourceType, 'recorded_foley');
    assert.ok(sound.getSamplePlaybackPlan(cueName, 10).length > 0);
  }
  assert.equal(sound.getSamplePlaybackPlan('call', 10)[0].sample.family, 'chips_small');
  assert.equal(sound.getSamplePlaybackPlan('raise', 10)[0].sample.family, 'chips_medium');
  assert.equal(sound.getSamplePlaybackPlan('all_in', 10)[0].sample.family, 'chips_large');
  assert.equal(manifest.cues.call.layers[0].count, 1);
  assert.equal(manifest.cues.bet.layers[0].count, 1);
  assert.equal(manifest.cues.raise.layers[0].count, 2);
  assert.ok(sound.getCueCatalog().check.relativeWeight < sound.getCueCatalog().call.relativeWeight);
  assert.ok(sound.getCueCatalog().call.relativeWeight < sound.getCueCatalog().bet.relativeWeight);
  assert.ok(sound.getCueCatalog().raise.relativeWeight < sound.getCueCatalog().all_in.relativeWeight);
  const selectable = new Set(Object.values(manifest.families).flat());
  for (const sample of manifest.samples) {
    assert.equal(selectable.has(sample.id), sample.production, sample.id);
  }
  for (const cueName of expectedFamilies.keys()) {
    for (let serial = 0; serial < 40; serial += 1) {
      assert.equal(sound.getSamplePlaybackPlan(cueName, serial)
        .some((entry) => entry.sample.production === false), false);
    }
  }
  assert.doesNotMatch(soundSource, /function renderCardCue|function renderChipCue/);
  assert.match(soundSource, /definition\.category === CATEGORIES\.POKER[\s\S]*renderRecordedFoleyCue/);
});

test('sample selection and documented trims remain deterministic within inaudible variation bounds', () => {
  const sound = createAudioHarness().sound;
  const first = sound.getSamplePlaybackPlan('call', 31);
  const repeated = sound.getSamplePlaybackPlan('call', 31);
  const next = sound.getSamplePlaybackPlan('call', 32);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first.map((entry) => entry.sample.id), next.map((entry) => entry.sample.id));
  for (const entry of [...first, ...next]) {
    const normalizedGain = entry.gain / (0.55 * entry.sample.playback.gainTrim);
    assert.ok(entry.playbackRate >= 0.998 && entry.playbackRate <= 1.002);
    assert.ok(normalizedGain >= 0.99 && normalizedGain <= 1.01);
    assert.ok(entry.offsetMs >= 0 && entry.offsetMs <= 1.5);
    assert.equal(entry.sourceOffsetMs, entry.sample.playback.sourceOffsetMs);
    assert.equal(entry.playDurationMs, entry.sample.playback.playDurationMs);
    assert.equal(entry.fadeOutMs, entry.sample.playback.fadeOutMs);
  }
});

test('decoded buffers are cached and asset failure is graceful silence without synth fallback', async () => {
  const cached = createAudioHarness();
  assert.equal((await cached.sound.previewCue('raise')).sourceType, 'recorded_foley');
  assert.equal(cached.fetchCount(), 1);
  assert.equal(cached.decodeCount(), 1);
  cached.context.currentTime += 1;
  assert.equal((await cached.sound.previewCue('raise')).played, true);
  assert.equal(cached.fetchCount(), 1, 'the shared Bet/Raise medium sample is not fetched again');
  assert.equal(cached.decodeCount(), 1, 'the shared Bet/Raise medium sample is not decoded again');
  const cacheState = cached.sound.getSampleCacheState();
  assert.equal(cacheState.entries, 1);
  assert.equal(cacheState.ready, 1);
  assert.equal(cacheState.failed, 0);
  assert.equal(cacheState.pending, 0);

  const failed = createAudioHarness({ failSamples: true });
  const firstFailure = await failed.sound.previewCue('all_in');
  assert.equal(firstFailure.reason, 'foley_unavailable');
  assert.equal(failed.sampleStarts.length, 0);
  assert.equal(failed.fetchCount(), 1);
  failed.context.currentTime += 1;
  assert.equal((await failed.sound.previewCue('all_in')).reason, 'foley_unavailable');
  assert.equal(failed.fetchCount(), 2, 'the alternate authored All-in variant is attempted once');
  failed.context.currentTime += 1;
  assert.equal((await failed.sound.previewCue('all_in')).reason, 'foley_unavailable');
  assert.equal(failed.fetchCount(), 2, 'each failed variant is negatively cached');
});

test('audio is lazy, one-context, origin-aware, category-aware, and safely unavailable', async () => {
  const harness = createAudioHarness();
  assert.equal(harness.contextCount(), 0, 'initial render is silent');
  await harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_check', origin: 'direct_seek' }));
  assert.equal(harness.contextCount(), 0, 'direct seek is silent');

  await harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_check', token: 2 }));
  assert.equal(harness.contextCount(), 1);
  harness.context.currentTime += 1;
  await harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_call', token: 3 }));
  assert.equal(harness.contextCount(), 1, 'one running context is reused');

  harness.sound.setCategoryEnabled('poker', false);
  harness.context.currentTime += 1;
  const disabled = await harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_raise', token: 4 }));
  assert.equal(disabled.reason, 'disabled');
  assert.equal(harness.storage.get('appPokerSoundsEnabled'), 'false');

  const hiddenHarness = createAudioHarness({ hidden: true });
  const hiddenResult = await hiddenHarness.sound.consumeExperienceEvent(audioEvent({ type: 'action_bet' }));
  assert.equal(hiddenResult.reason, 'hidden');
  assert.equal(hiddenHarness.contextCount(), 0);

  const unavailable = createAudioHarness({ audioAvailable: false });
  const unavailableResult = await unavailable.sound.consumeExperienceEvent(audioEvent({ type: 'action_bet' }));
  assert.equal(unavailableResult.reason, 'unavailable');

  const zeroVolume = createAudioHarness({ initial: { appSoundVolume: '0' } });
  const zeroResult = await zeroVolume.sound.consumeExperienceEvent(audioEvent({ type: 'action_bet' }));
  assert.equal(zeroResult.reason, 'volume_zero');
  assert.equal(zeroVolume.contextCount(), 0);
});

test('user-start events silently prepare one audio context before delayed presentation cues', async () => {
  const fullHand = createAudioHarness();
  const fullHandResult = await fullHand.sound.consumeExperienceEvent(audioEvent({
    type: EXPERIENCE_EVENT_TYPES.SESSION_STARTED,
    source: 'training_full_hand',
  }));
  assert.equal(fullHandResult.prepared, true);
  assert.equal(fullHand.contextCount(), 1);
  assert.equal(fullHand.envelopes.length, 0, 'preparation must not render a cue');

  const replay = createAudioHarness();
  const replayResult = await replay.sound.consumeExperienceEvent(audioEvent({
    type: EXPERIENCE_EVENT_TYPES.REPLAY_STARTED,
    source: 'replay',
  }));
  assert.equal(replayResult.prepared, true);
  assert.equal(replay.contextCount(), 1);
  assert.equal(replay.envelopes.length, 0, 'Replay Play preparation must stay silent');
  // Starting a Full Hand session announces the study session.
  const app = await bootedApp();
  const spy = app.spy(['emitStudyExperience']);
  try {
    await app.training.start('full_hand');
    assert.ok(spy.calls.emitStudyExperience.some(([type]) => type === 'session_started'));
  } finally {
    spy.restore();
    app.call('clearTrainingSessionState');
  }
});

test('ordinary Training action labels produce one canonical study meaning and never physical foley', async () => {
  const routedEvents = [];
  const browserWindow = {
    SoundFX: { consumeExperienceEvent: (event) => routedEvents.push(event) },
    matchMedia: () => ({ matches: false }),
  };
  const bridge = installExperienceEventsBridge(browserWindow);
  const cases = [
    ['fold', 'optimal', 'study_neutral'],
    ['call', 'acceptable', 'study_neutral'],
    ['raise', 'mistake', 'study_neutral'],
    ['all_in', 'optimal', 'study_neutral'],
  ];
  cases.forEach(([chosenActionType, comparisonState], index) => {
    bridge.emitTrainingDecisionResult({
      token: 200 + index,
      chosenActionType,
      comparisonState,
      feedbackSemantics: 'comparative',
      accepted: comparisonState !== 'mistake',
    });
  });

  assert.equal(routedEvents.length, cases.length, 'one submission emits one primary event');
  assert.deepEqual(routedEvents.map((event) => event.type), cases.map(() => 'decision_submitted'));
  assert.deepEqual(routedEvents.map((event) => event.family), cases.map(() => 'study'));
  assert.deepEqual(routedEvents.map((event) => event.payload.chosenActionType), cases.map(([action]) => action));

  const harness = createAudioHarness();
  for (const [index, event] of routedEvents.entries()) {
    harness.context.currentTime += 1;
    const result = await harness.sound.consumeExperienceEvent(event);
    assert.equal(result.cueName, cases[index][2]);
    assert.equal(result.sourceType, undefined);
  }
  assert.equal(harness.sampleStarts.length, 0, 'study feedback never starts recorded poker samples');
  assert.equal(harness.sound.getEventCue('decision_submitted', {
    studyAudioMeaning: 'corrective',
  }), 'study_corrective');

  const unsupported = createAudioHarness();
  const unsupportedEvent = bridge.emitTrainingDecisionResult({
    token: 300,
    chosenActionType: 'raise',
    comparisonState: 'optimal',
    feedbackSemantics: 'unavailable',
  }).event;
  const unsupportedResult = await unsupported.sound.consumeExperienceEvent(unsupportedEvent);
  assert.equal(unsupportedResult.cueName, 'study_neutral');
});

test('master volume updates production cue gain live at 0, 25, 50, 72, and 100 percent', async () => {
  const harness = createAudioHarness();
  const peaks = [];
  for (const volume of [0, 0.25, 0.5, 0.72, 1]) {
    harness.sound.setMasterVolume(volume);
    harness.context.currentTime += 1;
    const before = harness.envelopes.length;
    const result = await harness.sound.previewCue('check');
    if (volume === 0) {
      assert.equal(result.reason, 'volume_zero');
      assert.equal(harness.envelopes.length, before);
      continue;
    }
    assert.equal(result.cueName, 'check');
    const values = harness.envelopes.slice(before)
      .flatMap((envelope) => envelope.map((entry) => entry.value));
    peaks.push(Math.max(...values));
  }
  assert.equal(harness.storage.get('appSoundVolume'), '1');
  assert.equal(harness.contextCount(), 1);
  assert.ok(peaks[0] < peaks[1] && peaks[1] < peaks[2] && peaks[2] < peaks[3]);
});

test('audio deduplication, stale-token rejection, cooldown, and fast-Replay policy bound spam', async () => {
  const harness = createAudioHarness();
  const firstEvent = audioEvent({ type: 'action_call', token: 10 });
  assert.equal((await harness.sound.consumeExperienceEvent(firstEvent)).played, true);
  assert.equal((await harness.sound.consumeExperienceEvent(firstEvent)).reason, 'duplicate_or_stale');
  assert.equal((await harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_bet', token: 9 }))).reason, 'duplicate_or_stale');

  const cooldownHarness = createAudioHarness();
  assert.equal((await cooldownHarness.sound.playHint()).played, true);
  assert.equal((await cooldownHarness.sound.playHint()).reason, 'cooldown');

  const speedHarness = createAudioHarness();
  const result = await speedHarness.sound.consumeExperienceEvent(audioEvent({
    type: 'action_check',
    origin: 'replay_playback',
    payload: { replaySpeed: 2 },
  }));
  assert.equal(result.reason, 'replay_speed');
  assert.equal(speedHarness.contextCount(), 0);

  const polyphonyHarness = createAudioHarness();
  assert.equal((await polyphonyHarness.sound.playPokerAction('all_in')).played, true);
  assert.equal((await polyphonyHarness.sound.playCardDeal(2)).played, true);
  assert.ok(polyphonyHarness.sampleStarts.length <= 12);
});

test('immediate poker events keep distinct cue onsets instead of colliding', async () => {
  const harness = createAudioHarness();
  const startedAt = Date.now();
  const check = harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_check', token: 20 }));
  const call = harness.sound.consumeExperienceEvent(audioEvent({ type: 'action_call', token: 21 }));

  assert.equal((await check).cueName, 'check');
  assert.equal(harness.sampleStarts.length, 1, 'the following cue waits for the first cue separation');
  assert.equal((await call).cueName, 'call');
  assert.equal(harness.sampleStarts.length, 2);
  assert.ok(Date.now() - startedAt >= 90, 'the second onset is audibly separated from Check');
  assert.match(soundSource, /MAX_QUEUED_POKER_EVENTS = 8/);
});

test('visible poker-action bridge preserves Fold, Call, Bet, Raise, and All-in physical identity', async () => {
  const routedEvents = [];
  const browserWindow = {
    SoundFX: { consumeExperienceEvent: (event) => routedEvents.push(event) },
    matchMedia: () => ({ matches: false }),
  };
  const bridge = installExperienceEventsBridge(browserWindow);
  const expected = new Map([
    ['fold', ['action_fold', 'fold']],
    ['call', ['action_call', 'call']],
    ['bet', ['action_bet', 'bet']],
    ['raise', ['action_raise', 'raise']],
    ['all_in', ['action_all_in', 'all_in']],
  ]);
  let token = 40;
  for (const actionType of expected.keys()) {
    bridge.emitPokerAction({ source: 'visible_hand_action', token: token++, actionType });
  }
  assert.deepEqual(routedEvents.map((event) => event.type),
    [...expected.values()].map(([eventType]) => eventType));

  const audio = createAudioHarness();
  for (const [index, event] of routedEvents.entries()) {
    audio.context.currentTime += 1;
    const result = await audio.sound.consumeExperienceEvent(event);
    assert.equal(result.cueName, [...expected.values()][index][1]);
  }
  // In the app: an answer renders its summary, then emits one study result
  // through the experience authority; Full Hand answers re-dispatch the table.
  const app = await bootedApp();
  for (const name of ['emitTrainingActionExperience', 'emitPokerAction']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  const descriptor = Object.getOwnPropertyDescriptor(app.window, 'RiverlineExperienceEvents');
  const results = [];
  Object.defineProperty(app.window, 'RiverlineExperienceEvents', { ...descriptor, value: Object.freeze({
    ...descriptor.value,
    emitTrainingDecisionResult(...args) { results.push(args); return descriptor.value.emitTrainingDecisionResult(...args); },
  }) });
  const spy = app.spy(['renderTrainingEvaluationSummary', 'emitTrainingDecisionResultExperience', 'dispatchFullHandTrainingTable']);
  try {
    await app.training.start('focused');
    spy.reset();
    await app.training.answer();
    const order = spy.sequence.filter((name) => name !== 'dispatchFullHandTrainingTable');
    assert.ok(order.indexOf('renderTrainingEvaluationSummary') >= 0);
    assert.ok(order.indexOf('renderTrainingEvaluationSummary') < order.indexOf('emitTrainingDecisionResultExperience'));
    assert.equal(spy.count('emitTrainingDecisionResultExperience'), 1);
    assert.equal(results.length, 1);
    app.call('clearTrainingSessionState');
    await app.training.start('full_hand');
    for (let round = 0; round < 40 && app.$('.training-workspace').dataset.trainingState !== 'ready'; round += 1) await app.settle(500);
    spy.reset();
    await app.training.answer();
    await app.settle(500);
    const snapshot = app.window.app.training.fullHandSnapshot;
    assert.ok(spy.calls.dispatchFullHandTrainingTable.some(([dispatched]) => dispatched === snapshot || dispatched?.handSeed === snapshot?.handSeed));
  } finally {
    spy.restore();
    Object.defineProperty(app.window, 'RiverlineExperienceEvents', descriptor);
    app.call('clearTrainingSessionState');
  }
});

test('Calibration and Matrix poker labels cannot enter the physical foley path', async () => {
  // In the app, Matrix and Calibration interactions emit no study result or
  // poker experience event.
  const app = await bootedApp();
  const descriptor = Object.getOwnPropertyDescriptor(app.window, 'RiverlineExperienceEvents');
  const emitted = [];
  const authority = descriptor.value;
  Object.defineProperty(app.window, 'RiverlineExperienceEvents', { ...descriptor, value: Object.freeze(Object.fromEntries(
    Object.entries(authority).map(([name, value]) => [name, typeof value === 'function' ? (...args) => { emitted.push(name); return value(...args); } : value]),
  )) });
  try {
    await app.navigate('analyze');
    await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
    emitted.length = 0;
    await app.click('.sub-tab[data-gto-view="chart"]');
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
    for (const cell of app.$$('#strategyGrid .hand-cell').slice(0, 3)) await app.click(cell);
    await app.navigate('personal-strategy');
    await app.settle(200);
    assert.deepEqual(emitted.filter((name) => /PokerAction|TrainingDecisionResult/.test(name)), []);
  } finally {
    Object.defineProperty(app.window, 'RiverlineExperienceEvents', descriptor);
  }
  // (SOURCE-SHAPE call-site lint, see the file header.)
  assert.doesNotMatch(logicSource, /emitPokerAction|playPokerAction|playChip|playCardDeal/);
});

test('Settings preview invokes the exact production cue renderer and respects Poker category gating', async () => {
  const preview = createAudioHarness();
  const previewResult = await preview.sound.previewCue('raise');
  const production = createAudioHarness();
  const productionResult = await production.sound.playPokerAction('raise');
  assert.equal(previewResult.cueName, productionResult.cueName);
  assert.equal(previewResult.sourceType, 'recorded_foley');
  assert.equal(Array.from(previewResult.sampleIds).join(','), Array.from(productionResult.sampleIds).join(','));
  assert.deepEqual(preview.envelopes, production.envelopes);

  preview.sound.setCategoryEnabled('poker', false);
  preview.context.currentTime += 1;
  assert.equal((await preview.sound.previewCue('call')).reason, 'disabled');
  preview.sound.setCategoryEnabled('study', true);
  preview.context.currentTime += 1;
  assert.equal((await preview.sound.previewCue('study_positive')).cueName, 'study_positive');
  preview.context.currentTime += 1;
  assert.equal((await preview.sound.previewCue('study_neutral')).cueName, 'study_neutral');
  preview.context.currentTime += 1;
  assert.equal((await preview.sound.previewCue('study_corrective')).cueName, 'study_corrective');
  preview.context.currentTime += 1;
  assert.equal((await preview.sound.previewCue('hint')).cueName, 'hint');

  for (const [cueName, productionMethod] of [
    ['study_neutral', 'playTrainingResult'],
    ['hint', 'playHint'],
  ]) {
    const studyPreview = createAudioHarness();
    const studyProduction = createAudioHarness();
    await studyPreview.sound.previewCue(cueName);
    await studyProduction.sound[productionMethod]();
    assert.deepEqual(studyPreview.envelopes, studyProduction.envelopes, `${cueName} preview uses production rendering`);
    assert.equal(studyPreview.sampleStarts.length, 0);
  }
  assert.equal(markup.querySelectorAll('[data-audio-preview-cue]').length, 13);
  assert.match(soundSource, /button\.onclick = \(\) => authority\.previewCue\(button\.dataset\.audioPreviewCue\)/);
});

test('integration uses the semantic boundary across Hand, Replay, Training, and table motion', async () => {
  assert.match(playbookSource, /createPokerWorldExperienceEvents/);
  assert.match(playbookSource, /origin:\s*EXPERIENCE_EVENT_ORIGINS\.LIVE/);
  assert.match(playbookSource, /origin:\s*EXPERIENCE_EVENT_ORIGINS\.REPLAY_PLAYBACK/);
  assert.match(trainingSource, /createPokerWorldExperienceEvents/);
  assert.match(experienceSource, /emitPokerAction/);
  assert.match(experienceSource, /emitTrainingDecisionResult/);
  assert.match(trainingSource, /previousState:\s*previousSnapshot\?\.state/);
  assert.match(rendererSource, /riverline:experience-event/);
  assert.match(rendererSource, /createChipFlight/);
  assert.match(rendererSource, /presentation\?\.geometry\?\.potAnchor/);
  assert.match(rendererSource, /seatPresentation\?\.contributionAnchor/);
  assert.match(rendererSource, /motion\.kind === 'pot_collect'/);
  assert.match(rendererSource, /motion\.kind === 'pot_award'/);
  assert.match(rendererSource, /motion\.kind === 'fold_retreat'/);
  assert.match(rendererSource, /const livePrivateDeal = !replayProjected/);
  assert.match(rendererSource, /const liveBoardDealCards = !replayProjected/);
  assert.match(rendererSource, /livePrivateDeal \? player\.cards\.map/);
  assert.match(rendererSource, /: liveBoardDealCards/);
  assert.doesNotMatch(rendererSource, /SoundFX/);
  // (SOURCE-SHAPE call-site lint, see the file header.)
  assert.equal((logicSource.match(/SoundFX\.play/g) || []).length, 0);
  const app = await bootedApp();
  assert.equal(app.evaluate('typeof emitTrainingDecisionResultExperience'), 'function');
  for (const name of ['emitTrainingActionExperience', 'emitPokerAction']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  // Selecting a Review decision is a study event.
  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  await app.click('#handCompletedReviewButton');
  await app.settle(300);
  assert.ok(app.window.app.handReview.model?.decisions?.length >= 1);
  const spy = app.spy(['emitStudyExperience']);
  try {
    app.call('selectActiveHandReviewDecision', 0);
    assert.ok(spy.calls.emitStudyExperience.some(([type]) => type === 'review_decision_selected'));
  } finally {
    spy.restore();
    app.call('closeActiveHandReview', { returnToEndpoint: false });
  }
  assert.match(replaySource, /next\(\)[\s\S]*selectionDirection = 'direct_step'/);
  assert.match(replaySource, /advancePlayback\(\)[\s\S]*selectionDirection = 'playback'/);
  assert.doesNotMatch(`${experienceSource}\n${motionSource}\n${rendererSource}`,
    /StrategyProvider|calculateEquity|applyAction\(|resolveShowdown\(|potAccounting/);
});

test('settings, copy, tokens, and reduced-motion CSS expose the bounded system', () => {
  for (const id of [
    'audioSettingsSwitch', 'audioMasterVolume', 'audioPokerSwitch', 'audioStudySwitch',
  ]) assert.ok(markup.getElementById(id), id);
  const css = appStyleSheet();
  for (const [token, value] of [
    ['--motion-instant', '1ms'], ['--motion-fast-semantic', '110ms'],
    ['--motion-normal-semantic', '170ms'], ['--motion-poker-settle', '240ms'],
  ]) assert.equal(css.cascaded(markup.documentElement, token), value, token);
  // Chip flights never take pointer input and stop moving under reduced motion.
  const flight = markup.createElement('div');
  flight.className = 'table-chip-flight';
  markup.getElementById('visual-table-container').appendChild(flight);
  try {
    assert.equal(css.cascaded(flight, 'pointer-events'), 'none');
    const reduced = ['animation', 'transition', 'display'].map((property) => css.cascaded(flight, property, { reducedMotion: true }));
    const normal = ['animation', 'transition', 'display'].map((property) => css.cascaded(flight, property));
    assert.notDeepEqual(reduced, normal, 'reduced motion changes the chip flight');
  } finally {
    flight.remove();
  }
  assert.doesNotMatch(soundSource, /new Audio\(|\.mp3|\.wav|casino|reward|victory/i);
  assert.match(tablePresentationSource, /geometryDirection:\s*'poker_ltr'/);
  assert.equal((i18nSource.match(/"Sound enabled":/g) || []).length, 3);
  assert.equal((i18nSource.match(/"Table \/ Poker sounds":/g) || []).length, 3);
  assert.equal((i18nSource.match(/"Study \/ UI feedback":/g) || []).length, 3);
  assert.equal((i18nSource.match(/"Preview sounds":/g) || []).length, 3);
  const scripts = markup.querySelectorAll('script[src]');
  const script = (path) => scripts.find((node) => node.getAttribute('src').split('?')[0] === path);
  for (const path of ['src/core/AudioFoleyManifest.js', 'src/core/SoundFX.js']) assert.ok(script(path).hasAttribute('defer'), path);
  assert.ok(precedes(script('src/core/AudioFoleyManifest.js'), script('src/core/SoundFX.js')));
});
