import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const foleyManifest = fs.readFileSync(new URL('../app/src/core/AudioFoleyManifest.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const polishCss = css.slice(css.indexOf('POLISH-FINAL-001: restrained product-feel language'));

test('shared analysis card notation has a compact explicit contrast surface', () => {
  assert.match(teacher, /analysis-mini-card riverline-card card--suit-\$\{suitId\}/);
  assert.match(teacher, /presentation\.displayCardRank/);
  assert.match(teacher, /presentation\.appendCardFaceContents/);
  assert.match(teacher, /unicode-bidi|analysis-card-token/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*background:[^}]*--riverline-card-face/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*border:[^}]*--riverline-card-border/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*box-shadow:/);
  assert.match(teacher, /token\.dataset\.cardSize = 'mini'/);
  assert.doesNotMatch(teacher, /replace\(['"]T['"],\s*['"]10['"]\)/);
});

test('motion language is tokenized, event-scoped, and avoids large animated trees', () => {
  for (const token of ['--motion-micro', '--motion-standard', '--motion-emphasis']) {
    assert.match(polishCss, new RegExp(`${token}:\\s*var\\(--duration-`));
  }
  assert.match(logic, /classList\.toggle\('is-analysis-entering', isHidden\)/);
  assert.match(logic, /classList\.toggle\('is-view-entering', item === destination\)/);
  assert.match(polishCss, /training-study-hint-content \.analysis-study-hint[\s\S]*riverline-hint-enter/);
  assert.match(polishCss, /\.equity-player-results\[data-result-state="complete"\]/);
  assert.match(polishCss, /visibility 0s linear var\(--motion-standard\)/);
  assert.doesNotMatch(polishCss, /bounce|spin|flash|infinite/i);
});

test('answer feedback remains semantic while correct and mistake states get calm emphasis', () => {
  assert.match(logic, /delete feedbackDiv\.dataset\.accepted/);
  assert.match(logic, /trainingFeedback'\)\.dataset\.grade = presentation\.tone/);
  assert.match(polishCss, /data-truth-state="normative_assessment"\]\[data-grade="success"[\s\S]*--status-success/);
  assert.match(polishCss, /data-truth-state="normative_assessment"\]\[data-grade="error"[\s\S]*--status-danger/);
  assert.match(polishCss, /@keyframes riverline-answer-enter[\s\S]*opacity:\s*0[\s\S]*translate:\s*0 -5px/);
});

test('reduced motion makes all nonessential animation and transition near-instant', () => {
  assert.match(polishCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*\.01ms !important/);
  assert.match(polishCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration:\s*\.01ms !important/);
  assert.match(polishCss, /training-study-hint-content \.analysis-study-hint[\s\S]*animation:\s*none !important/);
  assert.match(logic, /prefers-reduced-motion: reduce[\s\S]*behavior: reducedMotion \? 'auto' : 'smooth'/);
});

function createSoundHarness(initialSound = null) {
  let oscillatorCount = 0;
  let contextCount = 0;
  const listeners = [];
  const gainEnvelopes = [];
  const sampleStarts = [];
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    resume: async () => {},
    createOscillator() {
      oscillatorCount += 1;
      return {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { value: 1, setValueAtTime(value) { this.value = value; } },
        connect() {},
        start(time) { sampleStarts.push({ buffer: this.buffer, playbackRate: this.playbackRate.value, time }); },
      };
    },
    decodeAudioData(arrayBuffer, success) {
      const buffer = { duration: 0.5, byteLength: arrayBuffer.byteLength };
      success?.(buffer);
      return Promise.resolve(buffer);
    },
    createGain() {
      const events = [];
      gainEnvelopes.push(events);
      return {
        gain: {
          setValueAtTime(value, time) { events.push({ type: 'set', value, time }); },
          exponentialRampToValueAtTime(value, time) { events.push({ type: 'exponential', value, time }); },
        },
        connect() {},
      };
    },
  };
  class AudioContext {
    constructor() {
      contextCount += 1;
      return context;
    }
  }
  const storage = new Map(initialSound === null ? [] : [['appSoundEnabled', initialSound]]);
  const sandbox = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    document: { hidden: false, baseURI: 'http://riverline.test/app/index.html', getElementById: () => null, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }),
    URL,
    ArrayBuffer,
    window: { AudioContext, location: { href: 'http://riverline.test/app/index.html' }, addEventListener: (_event, listener) => listeners.push(listener) },
  };
  vm.runInNewContext(`${foleyManifest}\n${sound}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return {
    soundFx: sandbox.exposedSoundFX,
    context,
    listeners,
    storage,
    gainEnvelopes,
    sampleStarts,
    contextCount: () => contextCount,
    oscillatorCount: () => oscillatorCount,
  };
}

test('disabled audio persists, stays uninitialized, and blocks playback', async () => {
  const harness = createSoundHarness('false');
  harness.listeners.forEach((listener) => listener());
  await harness.soundFx.playHint();
  await harness.soundFx.playTrainingResult('optimal');
  assert.equal(harness.contextCount(), 0);
  assert.equal(harness.oscillatorCount(), 0);
  assert.equal(harness.soundFx.isEnabled(), false);
});

test('recorded foley supplies Card, Call, Raise, and All-in physical weight', async () => {
  assert.match(foleyManifest, /sourcePolicy:\s*'recorded_foley_primary'/);
  assert.match(foleyManifest, /call:[\s\S]*layer\('chips_small'/);
  assert.match(foleyManifest, /raise:[\s\S]*layer\('chips_medium'/);
  assert.match(foleyManifest, /all_in:[\s\S]*layer\('chips_large'/);

  const peak = (harness) => Math.max(...harness.gainEnvelopes.flatMap((events) => events.map((event) => event.value)));
  const hintHarness = createSoundHarness();
  await hintHarness.soundFx.playHint();
  const cardHarness = createSoundHarness();
  await cardHarness.soundFx.playCardDeal(1);
  const callHarness = createSoundHarness();
  await callHarness.soundFx.playPokerAction('call');
  const raiseHarness = createSoundHarness();
  await raiseHarness.soundFx.playPokerAction('raise');
  const allInHarness = createSoundHarness();
  await allInHarness.soundFx.playPokerAction('all_in');
  const correctiveHarness = createSoundHarness();
  await correctiveHarness.soundFx.playWrong();
  assert.ok(peak(correctiveHarness) > 0);
  assert.ok(peak(cardHarness) > 0);
  assert.ok(peak(hintHarness) > 0);
  assert.ok(peak(cardHarness) > peak(hintHarness));
  assert.equal(callHarness.sampleStarts.length, 1);
  assert.equal(raiseHarness.sampleStarts.length, 2);
  assert.equal(allInHarness.sampleStarts.length, 1, 'All-in uses one authored large-stack push');
  assert.equal(callHarness.oscillatorCount(), 0);
  assert.equal(raiseHarness.oscillatorCount(), 0);
  assert.equal(allInHarness.oscillatorCount(), 0);

  const positiveHarness = createSoundHarness();
  await positiveHarness.soundFx.playCorrect();
  assert.notDeepEqual(positiveHarness.gainEnvelopes, correctiveHarness.gainEnvelopes,
    'aligned and corrective meanings use distinct restrained envelopes');
  assert.match(sound, /decision_submitted[\s\S]*STUDY_RESULT_CUES/,
    'Training comparison meaning resolves dynamically from the canonical event payload');
  assert.match(sound, /error_buzz:\s*'study_corrective'[\s\S]*wrong:\s*'study_corrective'/,
    'legacy corrective aliases remain calm study feedback');
});

test('procedural Study/UI envelopes retain a short bounded attack and decay', async () => {
  const harness = createSoundHarness();
  await harness.soundFx.playHint();
  const envelope = harness.gainEnvelopes[0];
  assert.deepEqual(envelope.map((event) => event.type), ['set', 'exponential', 'exponential']);
  assert.equal(envelope[0].value, 0.001);
  assert.equal(envelope.at(-1).value, 0.001);
  assert.ok(envelope[1].time > envelope[0].time);
  assert.ok(envelope[2].time > envelope[1].time);
});

test('hint sound remains throttled and triggered once per revealed hint', async () => {
  const harness = createSoundHarness();
  await harness.soundFx.playHint();
  await harness.soundFx.playHint();
  assert.equal(harness.oscillatorCount(), 2);
  assert.equal((logic.match(/SoundFX\.play/g) || []).length, 0);
  assert.match(logic, /renderAnalysisStudyHints[\s\S]{0,420}emitStudyExperience\('reference_comparison_revealed'/);
  assert.equal((logic.match(/emitTrainingDecisionResultExperience\(/g) || []).length, 2);
  assert.doesNotMatch(logic, /(?:hover|progress|bindSliderPair)[\s\S]{0,120}emitStudyExperience/);
});

test('audio preference persistence and enabled default remain unchanged', () => {
  const defaultHarness = createSoundHarness();
  assert.equal(defaultHarness.soundFx.isEnabled(), true);
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'false');
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'true');
});
