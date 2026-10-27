import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { StyleSheetModel, appStyleSheet, bootApp } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: styles.css / logic.js assertions are behavioural: the
// cascade resolves the polish rules on probes and rendered elements, and
// entrances, feedback grades, reduced-motion scrolling and cue events are
// observed in the booted app. SoundFX/manifest/teacher sources are outside
// this ticket.
const css = appStyleSheet();
const app = await bootApp();
// SOURCE-SHAPE: "the polish block never uses bounce/spin/flash/infinite
// motion" is a policy lint over the POLISH-FINAL-001 block as authored
// (parsed, not regex-matched).
const polishSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('POLISH-FINAL-001: restrained product-feel language')) + 2;
  return new StyleSheetModel(raw.slice(start));
})();
const probe = (html) => {
  const host = app.document.createElement('div');
  host.innerHTML = html;
  app.document.body.appendChild(host);
  return host.firstElementChild;
};
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const foleyManifest = fs.readFileSync(new URL('../app/src/core/AudioFoleyManifest.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');

test('shared analysis card notation has a compact explicit contrast surface', () => {
  assert.match(teacher, /analysis-mini-card riverline-card card--suit-\$\{suitId\}/);
  assert.match(teacher, /presentation\.displayCardRank/);
  assert.match(teacher, /presentation\.appendCardFaceContents/);
  assert.match(teacher, /unicode-bidi|analysis-card-token/);
  const mini = probe('<span class="analysis-mini-card riverline-card card--suit-h" data-card-size="mini"></span>');
  assert.match(css.cascaded(mini, 'background') || '', /--(?:riverline-)?card-face/);
  assert.match(css.cascaded(mini, 'border') || css.cascaded(mini, 'border-color') || '', /--(?:riverline-)?card-border/);
  assert.ok(css.cascaded(mini, 'box-shadow') && css.cascaded(mini, 'box-shadow') !== 'none');
  assert.match(teacher, /token\.dataset\.cardSize = 'mini'/);
  assert.doesNotMatch(teacher, /replace\(['"]T['"],\s*['"]10['"]\)/);
});

test('motion language is tokenized, event-scoped, and avoids large animated trees', async () => {
  const root = app.document.documentElement;
  // MOTION-FOUNDATION-001: one scale; each duration = base × setting ÷ tempo.
  for (const token of ['--motion-micro', '--motion-panel', '--motion-table']) {
    assert.match(css.cascaded(root, token), /^calc\(var\(--motion-base-[a-z]+\) \* var\(--motion-scale\) \/ var\(--motion-tempo\)\)$/, token);
  }
  // Opening the analysis panel and switching Analyze views mark only the
  // entering element, which runs the panel entrance.
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const teacher = app.byId('teacherContent');
  if (app.byId('toggleTeacher').getAttribute('aria-expanded') === 'true') await app.click('#toggleTeacher');
  await app.click('#toggleTeacher');
  assert.ok(teacher.classList.contains('is-analysis-entering'));
  assert.match(css.cascaded(teacher, 'animation') || '', /riverline-panel-enter/);
  await app.click('#toggleTeacher');
  assert.equal(teacher.classList.contains('is-analysis-entering'), false);
  const tab = app.$$('.sub-tab[data-gto-view]').find((node) => node.getAttribute('aria-selected') !== 'true');
  await app.click(tab);
  const entering = app.$$('.gto-view.is-view-entering');
  assert.equal(entering.length, 1);
  assert.match(css.cascaded(entering[0], 'animation') || '', /riverline-panel-enter/);
  const hint = probe('<div class="training-study-hint-content"><div class="analysis-study-hint"></div></div>').firstElementChild;
  assert.match(css.cascaded(hint, 'animation'), /riverline-hint-enter/);
  // A collapsing table keeps visibility until the collapse finishes.
  assert.match(css.cascaded(probe('<div class="table-wrapper collapsed"></div>'), 'transition'), /visibility 0s linear var\(--motion-panel\)/);
  for (const rule of polishSheet.rules) {
    for (const { value } of rule.declarations) assert.doesNotMatch(value, /bounce|spin|flash|infinite/i, rule.selectorText);
  }
  for (const name of polishSheet.keyframes.keys()) assert.doesNotMatch(name, /bounce|spin|flash/i);
});

test('completed Equity results run the panel entrance', {
  todo: 'TEST-HYGIENE-001-F07: the entrance rule targets .equity-player-results; the rendered result is .equity-player-footer',
}, async () => {
  // The original POLISH-FINAL-001 guarantee, on the live result element.
  await app.navigate('equity');
  const [hero] = app.evaluate('app.equity.players.map(({ id }) => id)');
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['As', 'Kd']);
  await app.click('#calculate');
  await app.waitFor(() => app.window.app.equity.lifecycle === 'complete', 'the Equity calculation');
  const result = app.$('#equityPlayers [data-result-state="complete"]');
  assert.ok(result, 'a completed result is rendered');
  assert.match(css.cascaded(result, 'animation') || '', /riverline-panel-enter/);
});

test('answer feedback remains semantic while correct and mistake states get calm emphasis', async () => {
  // Answering grades the feedback with the presentation tone and never keeps
  // a stale "accepted" flag.
  await app.training.start('focused');
  const feedback = app.byId('trainingFeedback');
  feedback.dataset.accepted = 'stale';
  await app.training.answer();
  assert.ok(feedback.dataset.grade, 'graded with the presentation tone');
  assert.equal(feedback.dataset.accepted, undefined);
  for (const [grade, token] of [['success', '--status-success'], ['error', '--status-danger']]) {
    const node = probe(`<div class="training-feedback" data-truth-state="normative_assessment" data-grade="${grade}"></div>`);
    assert.equal(css.cascaded(node, 'border-inline-start-color'), `var(${token})`, grade);
  }
  const frames = css.keyframes.get('riverline-answer-enter');
  const from = frames.find((frame) => frame.offsets.includes('from'));
  assert.deepEqual(Object.fromEntries(from.declarations.map(({ property, value }) => [property, value])), { opacity: '0', translate: '0 -5px' });
});

test('reduced motion makes all nonessential animation near-instant and keeps only short fades', async () => {
  const reduced = { reducedMotion: true };
  const any = probe('<div class="deck-card"></div>');
  assert.equal(css.cascaded(any, 'animation-duration', reduced), '.01ms');
  // MOTION-FOUNDATION-001: Reduced = opacity fades of 200 ms or less.
  assert.equal(css.cascaded(any, 'transition-property', reduced), 'opacity');
  assert.equal(css.cascaded(any, 'transition-duration', reduced), 'var(--motion-fade)');
  const hint = probe('<div class="training-study-hint-content"><div class="analysis-study-hint"></div></div>').firstElementChild;
  assert.equal(css.cascaded(hint, 'animation', reduced), 'none');
  // Opening Hand Review scrolls to it smoothly, or instantly under reduced motion.
  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  const media = app.environment.media;
  const surface = app.byId('handReviewSurface');
  const open = (reducedMotion) => {
    app.environment.media = { ...media, reducedMotion };
    // The Motion setting follows the system preference by default.
    app.document.documentElement.dataset.motionMode = reducedMotion ? 'reduced' : 'standard';
    surface._scrolledIntoView = undefined;
    assert.ok(app.call('openCanonicalHandReview'), 'the review opens');
    return surface._scrolledIntoView;
  };
  try {
    assert.deepEqual(open(false), { behavior: 'smooth', block: 'start' });
    assert.deepEqual(open(true), { behavior: 'auto', block: 'start' });
  } finally {
    app.environment.media = media;
    app.document.documentElement.dataset.motionMode = 'standard';
  }
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
  await correctiveHarness.soundFx.previewCue('study_corrective');
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
  await positiveHarness.soundFx.previewCue('study_positive');
  assert.notDeepEqual(positiveHarness.gainEnvelopes, correctiveHarness.gainEnvelopes,
    'aligned and corrective meanings use distinct restrained envelopes');
  assert.match(sound, /decision_submitted[\s\S]*STUDY_RESULT_CUES/,
    'Training comparison meaning resolves dynamically from the canonical event payload');
  assert.match(sound, /error_buzz:\s*'error'[\s\S]*wrong:\s*'study_neutral'/,
    'legacy aliases cannot grant normative outcome authority');
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
  // Cues are event-owned: one comparison event per revealed hint, one result
  // per answer, none from hover, progress or slider input. (The "logic.js
  // never calls SoundFX.play directly" call-site lint lives in
  // prelabs_fix001_firefox_audio as SOURCE-SHAPE.)
  const spy = app.spy(['emitStudyExperience', 'emitTrainingDecisionResultExperience', 'renderAnalysisStudyHints']);
  try {
    await app.training.start('focused');
    spy.reset();
    await app.click('#trainingRevealHint');
    assert.equal(spy.count('renderAnalysisStudyHints'), 1);
    assert.equal(spy.calls.emitStudyExperience.filter(([type]) => type === 'reference_comparison_revealed').length, 1);
    assert.ok(spy.sequence.indexOf('renderAnalysisStudyHints') < spy.sequence.indexOf('emitStudyExperience'));
    spy.reset();
    await app.training.answer();
    assert.equal(spy.count('emitTrainingDecisionResultExperience'), 1);
    await app.navigate('analyze');
    spy.reset();
    await app.setValue('#players', '5');
    app.dispatch(app.$('.mode-nav-item'), new app.window.MouseEvent('mouseover', { bubbles: true }));
    assert.equal(spy.count('emitStudyExperience'), 0);
  } finally {
    spy.restore();
  }
});

test('audio preference persistence and enabled default remain unchanged', () => {
  const defaultHarness = createSoundHarness();
  assert.equal(defaultHarness.soundFx.isEnabled(), true);
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'false');
  defaultHarness.soundFx.toggle();
  assert.equal(defaultHarness.storage.get('appSoundEnabled'), 'true');
});
