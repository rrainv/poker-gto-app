import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const polishCss = css.slice(css.indexOf('POLISH-FINAL-001: restrained product-feel language'));

test('shared analysis card notation has a compact explicit contrast surface', () => {
  assert.match(teacher, /analysis-mini-card card--suit-\$\{suitId\}/);
  assert.match(teacher, /document\.documentElement\.dataset\.cardRankStyle === 'full-ten'/);
  assert.match(teacher, /unicode-bidi|analysis-card-token/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*background:[^}]*--card-face/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*border:[^}]*--card-border/);
  assert.match(polishCss, /\.analysis-mini-card\s*\{[^}]*box-shadow:/);
  assert.match(polishCss, /\.analysis-mini-card-rank\s*\{[^}]*font-weight:\s*850/);
  assert.doesNotMatch(teacher, /replace\(['"]T['"],\s*['"]10['"]\)/);
});

test('motion language is tokenized, event-scoped, and avoids large animated trees', () => {
  for (const token of ['--motion-micro', '--motion-standard', '--motion-emphasis']) {
    assert.match(polishCss, new RegExp(`${token}:\\s*var\\(--duration-`));
  }
  assert.match(logic, /classList\.toggle\('is-analysis-entering', isHidden\)/);
  assert.match(logic, /classList\.toggle\('is-view-entering', item === destination\)/);
  assert.match(polishCss, /training-study-hint-content \.analysis-study-hint[\s\S]*riverline-hint-enter/);
  assert.match(polishCss, /data-result-state="complete"[^\n]*\.equity-result-card/);
  assert.match(polishCss, /visibility 0s linear var\(--motion-standard\)/);
  assert.doesNotMatch(polishCss, /bounce|spin|flash|infinite/i);
});

test('answer feedback remains semantic while correct and mistake states get calm emphasis', () => {
  assert.match(logic, /feedbackDiv\.dataset\.accepted = String\(Boolean\(isCorrect\)\)/);
  assert.match(logic, /trainingFeedback'\)\) \$\('#trainingFeedback'\)\.dataset\.grade = evaluation\.grade/);
  assert.match(polishCss, /data-grade="optimal"[\s\S]*--status-success/);
  assert.match(polishCss, /data-grade="mistake"[\s\S]*--status-danger/);
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
    document: { getElementById: () => null },
    window: { AudioContext, addEventListener: (_event, listener) => listeners.push(listener) },
  };
  vm.runInNewContext(`${sound}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return {
    soundFx: sandbox.exposedSoundFX,
    context,
    listeners,
    storage,
    gainEnvelopes,
    contextCount: () => contextCount,
    oscillatorCount: () => oscillatorCount,
  };
}

test('disabled audio persists, stays uninitialized, and blocks playback', () => {
  const harness = createSoundHarness('false');
  harness.listeners.forEach((listener) => listener());
  harness.soundFx.playHint();
  harness.soundFx.playTrainingResult('optimal');
  assert.equal(harness.contextCount(), 0);
  assert.equal(harness.oscillatorCount(), 0);
  assert.equal(harness.soundFx.isEnabled(), false);
});

test('audio profiles make results clearest while card and hint cues remain subordinate', () => {
  assert.match(sound, /hint:\s*Object\.freeze\(\{ gain:\s*0\.055, attack:\s*0\.004, duration:\s*0\.105 \}\)/);
  assert.match(sound, /card:\s*Object\.freeze\(\{ gain:\s*0\.08, attack:\s*0\.002, duration:\s*0\.085 \}\)/);
  assert.match(sound, /result:\s*Object\.freeze\(\{ gain:\s*0\.11, attack:\s*0\.006, duration:\s*0\.18 \}\)/);

  const peak = (harness) => Math.max(...harness.gainEnvelopes.flatMap((events) => events.map((event) => event.value)));
  const hintHarness = createSoundHarness();
  hintHarness.soundFx.playHint();
  const cardHarness = createSoundHarness();
  cardHarness.soundFx.playCardDeal(1);
  const mistakeHarness = createSoundHarness();
  mistakeHarness.soundFx.playTrainingResult('mistake');
  assert.ok(peak(mistakeHarness) > peak(cardHarness));
  assert.ok(peak(cardHarness) > peak(hintHarness));
  assert.ok(peak(mistakeHarness) > 0.04, 'result peak is stronger than the pre-correction level');

  const correctHarness = createSoundHarness();
  correctHarness.soundFx.playTrainingResult('optimal');
  const correctPeaks = correctHarness.gainEnvelopes.map((events) => Math.max(...events.map((event) => event.value)));
  const correctCombinedLevel = Math.sqrt(correctPeaks.reduce((sum, value) => sum + value ** 2, 0));
  assert.ok(Math.abs(correctCombinedLevel - peak(mistakeHarness)) < 0.01, 'correct and mistake have similar combined level');
});

test('cue envelopes have a short attack and decay instead of an inaudible instantaneous peak', () => {
  const harness = createSoundHarness();
  harness.soundFx.playCardDeal(1);
  const envelope = harness.gainEnvelopes[0];
  assert.deepEqual(envelope.map((event) => event.type), ['set', 'exponential', 'exponential']);
  assert.equal(envelope[0].value, 0.001);
  assert.equal(envelope.at(-1).value, 0.001);
  assert.ok(envelope[1].time > envelope[0].time);
  assert.ok(envelope[2].time > envelope[1].time);
});

test('hint sound remains throttled and triggered once per revealed hint', () => {
  const harness = createSoundHarness();
  harness.soundFx.playHint();
  harness.soundFx.playHint();
  assert.equal(harness.oscillatorCount(), 1);
  assert.equal((logic.match(/playHint\(\)/g) || []).length, 1);
  assert.match(logic, /renderAnalysisStudyHints[\s\S]{0,180}playHint\(\)/);
  assert.equal((logic.match(/playTrainingResult\(evaluation\.grade\)/g) || []).length, 1);
  assert.doesNotMatch(logic, /(?:hover|progress|bindSliderPair)[\s\S]{0,120}playHint/);
});

test('audio preference persistence and enabled default remain unchanged', () => {
  const defaultHarness = createSoundHarness();
  assert.equal(defaultHarness.soundFx.isEnabled(), true);
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'false');
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'true');
});
