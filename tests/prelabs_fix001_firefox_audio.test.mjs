import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const manifest = fs.readFileSync(new URL('../app/src/core/AudioFoleyManifest.js', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createContext(initialState = 'running', resumeGate = null) {
  const context = {
    currentTime: 1,
    state: initialState,
    destination: {},
    resumeCalls: 0,
    closeCalls: 0,
    oscillators: [],
    bufferSources: [],
    gains: [],
    async resume() {
      this.resumeCalls += 1;
      if (resumeGate) await resumeGate.promise;
      this.state = 'running';
    },
    async close() {
      this.closeCalls += 1;
      this.state = 'closed';
    },
    createOscillator() {
      const oscillator = {
        type: 'sine',
        startState: null,
        sourceConnected: false,
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { this.sourceConnected = true; },
        start: () => { oscillator.startState = context.state; },
        stop() {}
      };
      this.oscillators.push(oscillator);
      return oscillator;
    },
    createBufferSource() {
      const source = {
        buffer: null,
        startState: null,
        sourceConnected: false,
        playbackRate: { setValueAtTime() {} },
        connect() { this.sourceConnected = true; },
        start: () => { source.startState = context.state; },
      };
      this.bufferSources.push(source);
      return source;
    },
    decodeAudioData(arrayBuffer, success) {
      const buffer = { duration: 0.5, byteLength: arrayBuffer.byteLength };
      success?.(buffer);
      return Promise.resolve(buffer);
    },
    createGain() {
      const gain = {
        destination: null,
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target) { this.destination = target; }
      };
      this.gains.push(gain);
      return gain;
    }
  };
  return context;
}

function createHarness({ initialSound = null, contexts = [createContext()] } = {}) {
  let contextCount = 0;
  const storage = new Map(initialSound === null ? [] : [['appSoundEnabled', initialSound]]);
  class AudioContext {
    constructor() {
      const context = contexts[contextCount];
      contextCount += 1;
      if (!context) throw new Error('Unexpected duplicate AudioContext');
      return context;
    }
  }
  const sandbox = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    document: { hidden: false, baseURI: 'http://riverline.test/app/index.html', getElementById: () => null, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }),
    URL,
    ArrayBuffer,
    window: { AudioContext, location: { href: 'http://riverline.test/app/index.html' } }
  };
  vm.runInNewContext(`${manifest}\n${sound}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return {
    soundFx: sandbox.exposedSoundFX,
    storage,
    contexts,
    contextCount: () => contextCount
  };
}

test('initial load is silent and does not construct an AudioContext', () => {
  const harness = createHarness();
  assert.equal(harness.soundFx.isEnabled(), true);
  assert.equal(harness.contextCount(), 0);
});

test('the first suspended-context cue waits for one resume and then plays that cue', async () => {
  const resumeGate = deferred();
  const context = createContext('suspended', resumeGate);
  const harness = createHarness({ contexts: [context] });
  const cue = harness.soundFx.playCardDeal();

  assert.equal(harness.contextCount(), 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(context.oscillators.length, 0, 'source creation waits for readiness');

  resumeGate.resolve();
  await cue;
  assert.equal(context.oscillators.length, 0, 'poker foley never falls back to an oscillator');
  assert.equal(context.bufferSources.length, 1, 'one recorded card placement is retained');
  assert.ok(context.bufferSources.every((source) => source.startState === 'running'));
  assert.ok(context.bufferSources.every((source) => source.sourceConnected === true));
  assert.equal(context.gains[0].destination, context.destination);
});

test('concurrent cues share one suspended-context resume and one context', async () => {
  const resumeGate = deferred();
  const context = createContext('suspended', resumeGate);
  const harness = createHarness({ contexts: [context] });
  const cues = [harness.soundFx.playHint(), harness.soundFx.playClick()];
  assert.equal(context.resumeCalls, 1);
  assert.equal(harness.contextCount(), 1);
  resumeGate.resolve();
  await Promise.all(cues);
  assert.equal(context.oscillators.length, 3);
  assert.ok(context.oscillators.every((oscillator) => oscillator.startState === 'running'));
});

test('a running context is reused and a closed context is recreated on a later cue', async () => {
  const first = createContext('running');
  const second = createContext('running');
  const harness = createHarness({ contexts: [first, second] });
  await harness.soundFx.playHint();
  await harness.soundFx.playClick();
  assert.equal(harness.contextCount(), 1);

  first.state = 'closed';
  await harness.soundFx.playTrainingResult('mistake');
  assert.equal(harness.contextCount(), 2);
  assert.equal(second.oscillators.length, 2);
});

test('disabled audio creates nothing, closes an existing context, and re-enable plays normally', async () => {
  const disabledHarness = createHarness({ initialSound: 'false' });
  await disabledHarness.soundFx.playHint();
  assert.equal(disabledHarness.contextCount(), 0);

  const first = createContext('running');
  const second = createContext('running');
  const harness = createHarness({ contexts: [first, second] });
  await harness.soundFx.playCardDeal();
  harness.soundFx.toggle();
  await Promise.resolve();
  assert.equal(first.closeCalls, 1);
  const startsWhileDisabled = first.bufferSources.length;
  await harness.soundFx.playCardDeal();
  assert.equal(first.bufferSources.length, startsWhileDisabled);
  assert.equal(harness.storage.get('appSoundEnabled'), 'false');

  harness.soundFx.toggle();
  await harness.soundFx.playClick();
  assert.equal(harness.storage.get('appSoundEnabled'), 'true');
  assert.equal(harness.contextCount(), 2);
  assert.equal(second.oscillators.length, 1);
});

test('audio remains event-owned with no hover, slider, Matrix, progress, or tab cues', () => {
  assert.equal((logic.match(/SoundFX\.play/g) || []).length, 0);
  assert.equal((logic.match(/emitTrainingDecisionResultExperience\(/g) || []).length, 2);
  assert.equal((logic.match(/emitStudyExperience\('reference_comparison_revealed'/g) || []).length, 1);
  assert.doesNotMatch(logic, /(?:hover|progress|bindSliderPair|sub-tab|matrix)[\s\S]{0,120}SoundFX\.play/i);
  assert.doesNotMatch(sound, /window\.addEventListener/);
  assert.doesNotMatch(sound, /electron|BrowserWindow|ipcRenderer/i);
});
