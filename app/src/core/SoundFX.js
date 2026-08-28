// riverline-audio/v1: one lazy Web Audio mixer for recorded poker foley and subtle UI cues.
const SoundFX = (function() {
  const SCHEMA_VERSION = 'riverline-audio/v1';
  const PREFERENCE_KEYS = Object.freeze({
    enabled: 'appSoundEnabled',
    volume: 'appSoundVolume',
    poker: 'appPokerSoundsEnabled',
    study: 'appStudySoundsEnabled'
  });
  const CATEGORIES = Object.freeze({ POKER: 'poker', STUDY: 'study' });
  const ALLOWED_AUDIO_ORIGINS = new Set(['live', 'replay_playback']);
  const MAX_POLYPHONY = 12;
  const MAX_REMEMBERED_EVENTS = 256;
  const MAX_QUEUED_POKER_EVENTS = 8;

  let audioCtx = null;
  let resumeContext = null;
  let resumePromise = null;
  let noiseBuffer = null;
  let soundEnabled = localStorage.getItem(PREFERENCE_KEYS.enabled) !== 'false';
  let masterVolume = normalizedVolume(localStorage.getItem(PREFERENCE_KEYS.volume), 0.72);
  let pokerSoundsEnabled = localStorage.getItem(PREFERENCE_KEYS.poker) !== 'false';
  let studySoundsEnabled = localStorage.getItem(PREFERENCE_KEYS.study) !== 'false';
  let cueSerial = 0;
  let activeVoiceEnds = [];
  const lastCueTimes = new Map();
  const rememberedEventIds = new Set();
  const rememberedEventOrder = [];
  const latestNumericTokenBySource = new Map();
  const sampleBufferPromises = new Map();
  const sampleBufferResults = new Map();
  let pokerEventQueue = Promise.resolve();
  let pokerEventQueueGeneration = 0;
  let queuedPokerEventCount = 0;

  // Procedural synthesis is intentionally limited to subtle Study/UI cues.
  const CUE_PROFILE = Object.freeze({
    click: Object.freeze({ gain: 0.055, attack: 0.002, duration: 0.045 }),
    positive: Object.freeze({ gain: 0.15, attack: 0.006, duration: 0.145 }),
    corrective: Object.freeze({ gain: 0.142, attack: 0.006, duration: 0.14 }),
    neutral: Object.freeze({ gain: 0.126, attack: 0.006, duration: 0.125 }),
    hint: Object.freeze({ gain: 0.112, attack: 0.005, duration: 0.115 })
  });

  // A shared rounded dyad keeps Study meanings related; contour supplies semantics.
  const STUDY_CUE_CONFIG = Object.freeze({
    study_positive: Object.freeze({ profile: 'positive', startFrequency: 392, endFrequency: 440, supportStartFrequency: 523.25, supportEndFrequency: 587.33, bodyGainScale: 0.82, supportGainScale: 0.18 }),
    study_corrective: Object.freeze({ profile: 'corrective', startFrequency: 392, endFrequency: 349.23, supportStartFrequency: 523.25, supportEndFrequency: 466.16, bodyGainScale: 0.82, supportGainScale: 0.18 }),
    study_neutral: Object.freeze({ profile: 'neutral', startFrequency: 392, endFrequency: 392, supportStartFrequency: 523.25, supportEndFrequency: 523.25, bodyGainScale: 0.82, supportGainScale: 0.18 }),
    hint: Object.freeze({ profile: 'hint', startFrequency: 440, endFrequency: 466.16, supportStartFrequency: 587.33, supportEndFrequency: 622.25, bodyGainScale: 0.82, supportGainScale: 0.18 })
  });

  const CUE_DEFINITIONS = Object.freeze({
    card_deal: Object.freeze({ category: CATEGORIES.POKER, family: 'card', cooldown: 0.055, layers: 1, sourceType: 'recorded_foley', relativeWeight: 4, character: 'recorded card placement' }),
    board_reveal: Object.freeze({ category: CATEGORIES.POKER, family: 'card', cooldown: 0.07, layers: 3, sourceType: 'recorded_foley', relativeWeight: 4, character: 'three recorded card placements' }),
    card_reveal: Object.freeze({ category: CATEGORIES.POKER, family: 'card', cooldown: 0.055, layers: 1, sourceType: 'recorded_foley', relativeWeight: 3, character: 'recorded card placement' }),
    check: Object.freeze({ category: CATEGORIES.POKER, family: 'check', cooldown: 0.045, layers: 1, sourceType: 'recorded_foley', relativeWeight: 1, character: 'isolated recorded table/knuckle tap' }),
    fold: Object.freeze({ category: CATEGORIES.POKER, family: 'fold', cooldown: 0.055, layers: 1, sourceType: 'recorded_foley', relativeWeight: 2, character: 'recorded card slide' }),
    call: Object.freeze({ category: CATEGORIES.POKER, family: 'chips', cooldown: 0.055, layers: 1, sourceType: 'recorded_foley', relativeWeight: 3, character: 'recorded small chip commitment' }),
    bet: Object.freeze({ category: CATEGORIES.POKER, family: 'chips', cooldown: 0.06, layers: 1, sourceType: 'recorded_foley', relativeWeight: 5, character: 'recorded medium chip placement' }),
    raise: Object.freeze({ category: CATEGORIES.POKER, family: 'chips', cooldown: 0.065, layers: 2, sourceType: 'recorded_foley', relativeWeight: 7, character: 'two recorded medium chip movements' }),
    all_in: Object.freeze({ category: CATEGORIES.POKER, family: 'chips_heavy', cooldown: 0.1, layers: 1, sourceType: 'recorded_foley', relativeWeight: 10, character: 'authored recorded all-in chip push' }),
    pot_collect: Object.freeze({ category: CATEGORIES.POKER, family: 'pot', cooldown: 0.11, layers: 1, sourceType: 'recorded_foley', relativeWeight: 8, character: 'recorded chip gathering and consolidation' }),
    study_positive: Object.freeze({ category: CATEGORIES.STUDY, family: 'study_result', cooldown: 0.09, layers: 2, character: 'clear upward aligned-result acknowledgement' }),
    study_neutral: Object.freeze({ category: CATEGORIES.STUDY, family: 'study_result', cooldown: 0.09, layers: 2, character: 'clear flat close-result acknowledgement' }),
    study_corrective: Object.freeze({ category: CATEGORIES.STUDY, family: 'study_result', cooldown: 0.09, layers: 2, character: 'clear calm downward corrective acknowledgement' }),
    hint: Object.freeze({ category: CATEGORIES.STUDY, family: 'hint', cooldown: 0.1, layers: 2, character: 'light audible study disclosure' }),
    click: Object.freeze({ category: CATEGORIES.STUDY, family: 'selection', cooldown: 0.045, layers: 1, character: 'neutral selection tick' })
  });

  const POKER_CUE_SEPARATION_MS = Object.freeze({
    card_deal: 90,
    board_reveal: 180,
    card_reveal: 90,
    check: 120,
    fold: 110,
    call: 120,
    bet: 145,
    raise: 190,
    all_in: 260,
    pot_collect: 180,
  });

  const EVENT_CUES = Object.freeze({
    card_dealt: 'card_deal',
    board_revealed: 'board_reveal',
    hole_cards_revealed: 'card_reveal',
    action_fold: 'fold',
    action_check: 'check',
    action_call: 'call',
    action_bet: 'bet',
    action_raise: 'raise',
    action_all_in: 'all_in',
    pot_collected: 'pot_collect',
    pot_awarded: 'pot_collect',
    reference_comparison_revealed: 'hint'
  });

  const STUDY_RESULT_CUES = Object.freeze({
    positive: 'study_positive',
    neutral: 'study_neutral',
    corrective: 'study_corrective'
  });

  const PREVIEW_CUES = new Set([
    'card_deal', 'check', 'fold', 'call', 'raise', 'all_in', 'pot_collect',
    'study_positive', 'study_neutral', 'study_corrective', 'hint'
  ]);

  function cueForExperienceEvent(event) {
    if (event?.type === 'decision_submitted') {
      return STUDY_RESULT_CUES[event.payload?.studyAudioMeaning] || null;
    }
    return EVENT_CUES[event?.type] || null;
  }

  function normalizedVolume(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
  }

  function shapeCueEnvelope(gainParam, start, profile, peakGain = profile.gain) {
    const scaledPeak = Math.max(0.0011, peakGain * masterVolume);
    gainParam.setValueAtTime(0.001, start);
    gainParam.exponentialRampToValueAtTime(scaledPeak, start + profile.attack);
    gainParam.exponentialRampToValueAtTime(0.001, start + profile.duration);
  }

  function createAudioContext() {
    if (!soundEnabled) return null;
    if (audioCtx?.state === 'closed') {
      audioCtx = null;
      noiseBuffer = null;
    }
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      try {
        audioCtx = new AudioContextClass();
      } catch (_) {
        audioCtx = null;
      }
    }
    return audioCtx;
  }

  async function ensureAudioReady() {
    const ctx = createAudioContext();
    if (!ctx) return null;
    if (ctx.state === 'running') return ctx;
    if (ctx.state !== 'suspended') return null;

    if (!resumePromise || resumeContext !== ctx) {
      resumeContext = ctx;
      let resumeResult;
      try {
        // Invoke resume synchronously in the cue's user-activation call stack.
        resumeResult = ctx.resume();
      } catch (_) {
        resumeContext = null;
        return null;
      }
      resumePromise = Promise.resolve(resumeResult)
        .then(() => ctx)
        .catch(() => null)
        .finally(() => {
          if (resumeContext === ctx) {
            resumeContext = null;
            resumePromise = null;
          }
        });
    }

    const readyContext = await resumePromise;
    return soundEnabled
      && readyContext === audioCtx
      && readyContext?.state === 'running'
      ? readyContext
      : null;
  }

  function releaseAudioContext() {
    const contextToClose = audioCtx;
    audioCtx = null;
    noiseBuffer = null;
    resumeContext = null;
    resumePromise = null;
    activeVoiceEnds = [];
    lastCueTimes.clear();
    pokerEventQueueGeneration += 1;
    pokerEventQueue = Promise.resolve();
    queuedPokerEventCount = 0;
    if (contextToClose && contextToClose.state !== 'closed' && typeof contextToClose.close === 'function') {
      Promise.resolve(contextToClose.close()).catch(() => {});
    }
  }

  function categoryEnabled(category) {
    return category === CATEGORIES.POKER ? pokerSoundsEnabled : studySoundsEnabled;
  }

  function reserveVoices(ctx, count, tailSeconds) {
    activeVoiceEnds = activeVoiceEnds.filter((end) => end > ctx.currentTime);
    if (activeVoiceEnds.length + count > MAX_POLYPHONY) return false;
    for (let index = 0; index < count; index += 1) {
      activeVoiceEnds.push(ctx.currentTime + tailSeconds + (index * 0.018));
    }
    return true;
  }

  function connectSource(source, gain, filter = null, ctx = audioCtx) {
    if (filter) {
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }
    gain.connect(ctx.destination);
  }

  function foleyManifest() {
    const manifest = globalThis.RiverlineAudioFoleyManifest;
    return manifest?.schemaVersion === 'riverline-audio-foley-manifest/v1'
      ? manifest
      : null;
  }

  function deterministicUnit(seed, salt = 0) {
    let value = (Math.imul(seed + 1, 0x45d9f3b) ^ Math.imul(salt + 17, 0x27d4eb2d)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b) >>> 0;
    value ^= value >>> 16;
    return (value >>> 0) / 0xffffffff;
  }

  function samplePlaybackPlan(cueName, serial = cueSerial + 1) {
    const manifest = foleyManifest();
    const cue = manifest?.cues?.[cueName];
    if (!cue) return Object.freeze([]);
    const sampleMap = new Map(manifest.samples.map((entry) => [entry.id, entry]));
    const [minimumRate, maximumRate] = manifest.variation.playbackRateRange;
    const [minimumGain, maximumGain] = manifest.variation.gainRange;
    const plan = [];
    cue.layers.forEach((layer, layerIndex) => {
      const sampleIds = manifest.families[layer.family] || [];
      for (let instance = 0; instance < layer.count; instance += 1) {
        if (sampleIds.length === 0) continue;
        const sampleId = sampleIds[(serial + layerIndex + instance) % sampleIds.length];
        const sample = sampleMap.get(sampleId);
        if (!sample) continue;
        const salt = layerIndex * 31 + instance * 7 + cueName.length;
        const rateUnit = deterministicUnit(serial, salt);
        const gainUnit = deterministicUnit(serial, salt + 1);
        const timingUnit = deterministicUnit(serial, salt + 2);
        const timingJitter = ((timingUnit * 2) - 1) * manifest.variation.timingJitterMs;
        plan.push(Object.freeze({
          sample,
          playbackRate: minimumRate + ((maximumRate - minimumRate) * rateUnit),
          gain: layer.gain * sample.playback.gainTrim
            * (minimumGain + ((maximumGain - minimumGain) * gainUnit)),
          offsetMs: Math.max(0, (instance * layer.spacingMs) + timingJitter),
          sourceOffsetMs: sample.playback.sourceOffsetMs,
          playDurationMs: sample.playback.playDurationMs,
          fadeOutMs: sample.playback.fadeOutMs
        }));
      }
    });
    return Object.freeze(plan);
  }

  function resolveSampleUrl(url) {
    try {
      const base = document.baseURI || window.location?.href;
      return base ? new URL(url, base).href : url;
    } catch (_) {
      return url;
    }
  }

  function requestSampleArrayBuffer(url) {
    const resolvedUrl = resolveSampleUrl(url);
    const requestWithXhr = () => new Promise((resolve) => {
      const Xhr = window.XMLHttpRequest || globalThis.XMLHttpRequest;
      if (typeof Xhr !== 'function') {
        resolve(null);
        return;
      }
      try {
        const request = new Xhr();
        request.open('GET', resolvedUrl, true);
        request.responseType = 'arraybuffer';
        request.onload = () => resolve(
          (request.status === 0 || (request.status >= 200 && request.status < 300))
          && request.response instanceof ArrayBuffer
            ? request.response
            : null,
        );
        request.onerror = () => resolve(null);
        request.send();
      } catch (_) {
        resolve(null);
      }
    });
    if (typeof globalThis.fetch !== 'function') return requestWithXhr();
    return globalThis.fetch(resolvedUrl)
      .then((response) => response?.ok ? response.arrayBuffer() : null)
      .catch(requestWithXhr);
  }

  function decodeSampleBuffer(ctx, arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer) || typeof ctx.decodeAudioData !== 'function') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value || null);
      };
      try {
        const decodeResult = ctx.decodeAudioData(arrayBuffer.slice(0), finish, () => finish(null));
        if (decodeResult?.then) decodeResult.then(finish, () => finish(null));
      } catch (_) {
        finish(null);
      }
    });
  }

  function loadSampleBuffer(ctx, sample) {
    if (sampleBufferPromises.has(sample.url)) return sampleBufferPromises.get(sample.url);
    const loading = requestSampleArrayBuffer(sample.url)
      .then((arrayBuffer) => decodeSampleBuffer(ctx, arrayBuffer))
      .then((buffer) => {
        sampleBufferResults.set(sample.url, buffer ? 'ready' : 'failed');
        return buffer;
      })
      .catch(() => {
        sampleBufferResults.set(sample.url, 'failed');
        return null;
      });
    sampleBufferPromises.set(sample.url, loading);
    return loading;
  }

  function preloadPokerFoley(ctx) {
    const manifest = foleyManifest();
    if (!manifest || !pokerSoundsEnabled) return Promise.resolve([]);
    return Promise.all(manifest.samples
      .filter((sample) => sample.production)
      .map((sample) => loadSampleBuffer(ctx, sample)));
  }

  function createNoiseBuffer(ctx) {
    if (noiseBuffer || typeof ctx.createBuffer !== 'function') return noiseBuffer;
    const sampleRate = Math.max(8000, Number(ctx.sampleRate) || 44100);
    const length = Math.ceil(sampleRate * 0.16);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x52f10e;
    for (let index = 0; index < samples.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[index] = ((seed / 0xffffffff) * 2 - 1) * (1 - (index / samples.length));
    }
    noiseBuffer = buffer;
    return noiseBuffer;
  }

  function renderTone(ctx, {
    start = ctx.currentTime,
    frequency = 300,
    endFrequency = 220,
    type = 'sine',
    profile = CUE_PROFILE.click,
    gainScale = 1
  } = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), start + profile.duration * 0.72);
    shapeCueEnvelope(gain.gain, start, profile, profile.gain * gainScale);
    connectSource(osc, gain);
    osc.start(start);
    osc.stop(start + profile.duration + 0.012);
  }

  function renderNoise(ctx, {
    start = ctx.currentTime,
    frequency = 1450,
    profile = CUE_PROFILE.neutral,
    gainScale = 1,
    filterType = 'bandpass'
  } = {}) {
    const buffer = createNoiseBuffer(ctx);
    if (!buffer || typeof ctx.createBufferSource !== 'function' || typeof ctx.createBiquadFilter !== 'function') {
      renderTone(ctx, {
        start,
        frequency: Math.max(180, frequency * 0.24),
        endFrequency: Math.max(110, frequency * 0.11),
        type: 'triangle',
        profile,
        gainScale: gainScale * 0.82
      });
      return;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, start);
    if (filter.Q?.setValueAtTime) filter.Q.setValueAtTime(0.8, start);
    shapeCueEnvelope(gain.gain, start, profile, profile.gain * gainScale);
    connectSource(source, gain, filter);
    source.start(start);
    source.stop(start + profile.duration + 0.012);
  }

  function renderProceduralCue(ctx, cueName) {
    const studyConfig = STUDY_CUE_CONFIG[cueName];
    if (studyConfig) {
      const profile = CUE_PROFILE[studyConfig.profile];
      renderTone(ctx, {
        frequency: studyConfig.startFrequency,
        endFrequency: studyConfig.endFrequency,
        profile,
        gainScale: studyConfig.bodyGainScale,
        type: 'sine'
      });
      renderTone(ctx, {
        frequency: studyConfig.supportStartFrequency,
        endFrequency: studyConfig.supportEndFrequency,
        profile,
        gainScale: studyConfig.supportGainScale,
        type: 'sine'
      });
      return;
    }
    renderTone(ctx, { frequency: 690, endFrequency: 570, profile: CUE_PROFILE.click, gainScale: 0.7 });
  }

  async function renderRecordedFoleyCue(ctx, cueName, serial) {
    const plan = samplePlaybackPlan(cueName, serial);
    if (plan.length === 0) return Object.freeze({ played: false, reason: 'foley_manifest_unavailable' });
    const loaded = await Promise.all(plan.map(async (entry) => ({
      ...entry,
      buffer: await loadSampleBuffer(ctx, entry.sample)
    })));
    const playable = loaded.filter((entry) => entry.buffer);
    if (playable.length === 0) return Object.freeze({ played: false, reason: 'foley_unavailable' });
    if (!soundEnabled || !pokerSoundsEnabled || masterVolume <= 0 || document.hidden === true) {
      return Object.freeze({ played: false, reason: 'disabled_after_load' });
    }
    const tailSeconds = Math.max(...playable.map((entry) => (
      (entry.offsetMs / 1000) + (entry.playDurationMs / 1000 / entry.playbackRate)
    )));
    if (!reserveVoices(ctx, playable.length, tailSeconds)) {
      return Object.freeze({ played: false, reason: 'polyphony' });
    }
    playable.forEach((entry) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const start = ctx.currentTime + (entry.offsetMs / 1000);
      source.buffer = entry.buffer;
      if (source.playbackRate?.setValueAtTime) {
        source.playbackRate.setValueAtTime(entry.playbackRate, start);
      } else if (source.playbackRate) {
        source.playbackRate.value = entry.playbackRate;
      }
      const peakGain = Math.max(0.001, entry.gain * masterVolume);
      const end = start + (entry.playDurationMs / 1000 / entry.playbackRate);
      const fadeStart = Math.max(start, end - (entry.fadeOutMs / 1000));
      gain.gain.setValueAtTime(peakGain, start);
      gain.gain.setValueAtTime(peakGain, fadeStart);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      connectSource(source, gain, null, ctx);
      source.start(start, entry.sourceOffsetMs / 1000, entry.playDurationMs / 1000);
    });
    return Object.freeze({
      played: true,
      reason: null,
      cueName,
      sourceType: 'recorded_foley',
      sampleIds: Object.freeze(playable.map((entry) => entry.sample.id))
    });
  }

  async function playCue(cueName) {
    const definition = CUE_DEFINITIONS[cueName];
    if (!definition || !soundEnabled || !categoryEnabled(definition.category)) {
      return Object.freeze({ played: false, reason: 'disabled' });
    }
    if (masterVolume <= 0) return Object.freeze({ played: false, reason: 'volume_zero' });
    if (document.hidden === true) return Object.freeze({ played: false, reason: 'hidden' });
    // A prepared running context is the ordinary live-play path. Keep that
    // path synchronous through node scheduling so prompt Study feedback is not
    // deferred behind unrelated main-thread rendering after an answer.
    const preparedContext = createAudioContext();
    const ctx = preparedContext?.state === 'running'
      ? preparedContext
      : await ensureAudioReady();
    if (!ctx) return Object.freeze({ played: false, reason: 'unavailable' });
    const serial = ++cueSerial;
    const lastTime = lastCueTimes.get(definition.family) ?? -Infinity;
    if (ctx.currentTime - lastTime < definition.cooldown) {
      return Object.freeze({ played: false, reason: 'cooldown' });
    }
    if (definition.category === CATEGORIES.POKER) {
      const result = await renderRecordedFoleyCue(ctx, cueName, serial);
      if (result.played) lastCueTimes.set(definition.family, ctx.currentTime);
      return result;
    }
    if (!reserveVoices(ctx, definition.layers, 0.22)) {
      return Object.freeze({ played: false, reason: 'polyphony' });
    }
    lastCueTimes.set(definition.family, ctx.currentTime);
    try {
      renderProceduralCue(ctx, cueName);
      return Object.freeze({ played: true, reason: null, cueName });
    } catch (_) {
      return Object.freeze({ played: false, reason: 'render_failed' });
    }
  }

  function queuePokerEventCue(cueName) {
    if (queuedPokerEventCount >= MAX_QUEUED_POKER_EVENTS) {
      return Promise.resolve(Object.freeze({ played: false, reason: 'queue_full' }));
    }
    queuedPokerEventCount += 1;
    const generation = pokerEventQueueGeneration;
    const result = pokerEventQueue.then(() => (
      generation === pokerEventQueueGeneration
        ? playCue(cueName)
        : Object.freeze({ played: false, reason: 'queue_cancelled' })
    ));
    pokerEventQueue = result
      .then((playback) => (
        playback.played && generation === pokerEventQueueGeneration
          ? new Promise((resolve) => setTimeout(resolve, POKER_CUE_SEPARATION_MS[cueName] ?? 100))
          : null
      ))
      .catch(() => null)
      .finally(() => {
        if (generation === pokerEventQueueGeneration) {
          queuedPokerEventCount = Math.max(0, queuedPokerEventCount - 1);
        }
      });
    return result;
  }

  async function prepareAudio() {
    if (!soundEnabled || (!pokerSoundsEnabled && !studySoundsEnabled)) {
      return Object.freeze({ prepared: false, reason: 'disabled' });
    }
    if (masterVolume <= 0) return Object.freeze({ prepared: false, reason: 'volume_zero' });
    if (document.hidden === true) return Object.freeze({ prepared: false, reason: 'hidden' });
    const ctx = await ensureAudioReady();
    if (ctx && pokerSoundsEnabled) void preloadPokerFoley(ctx);
    return Object.freeze({
      prepared: Boolean(ctx),
      reason: ctx ? null : 'unavailable'
    });
  }

  function rememberEvent(event) {
    if (rememberedEventIds.has(event.eventId)) return false;
    if (Number.isSafeInteger(event.token)) {
      const latest = latestNumericTokenBySource.get(event.source);
      if (Number.isSafeInteger(latest) && event.token < latest) return false;
      latestNumericTokenBySource.set(event.source, Math.max(latest ?? event.token, event.token));
    }
    rememberedEventIds.add(event.eventId);
    rememberedEventOrder.push(event.eventId);
    while (rememberedEventOrder.length > MAX_REMEMBERED_EVENTS) {
      rememberedEventIds.delete(rememberedEventOrder.shift());
    }
    return true;
  }

  function renderButtonState() {
    const btn = document.getElementById('audioToggleBtn');
    const settingsBtn = document.getElementById('audioSettingsSwitch');
    const pokerBtn = document.getElementById('audioPokerSwitch');
    const studyBtn = document.getElementById('audioStudySwitch');
    const volume = document.getElementById('audioMasterVolume');
    const volumeValue = document.getElementById('audioMasterVolumeValue');
    const previewButtons = document.querySelectorAll?.('[data-audio-preview-cue]') || [];
    if (btn) {
      const label = typeof window.t === 'function'
        ? window.t(soundEnabled ? 'Mute sound' : 'Enable sound')
        : (soundEnabled ? 'Mute sound' : 'Enable sound');
      btn.classList.toggle('muted', !soundEnabled);
      btn.setAttribute('aria-pressed', String(soundEnabled));
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }
    if (settingsBtn) {
      settingsBtn.classList.toggle('on', soundEnabled);
      settingsBtn.setAttribute('aria-pressed', String(soundEnabled));
    }
    if (pokerBtn) {
      pokerBtn.classList.toggle('on', pokerSoundsEnabled);
      pokerBtn.setAttribute('aria-pressed', String(pokerSoundsEnabled));
      pokerBtn.disabled = !soundEnabled;
    }
    if (studyBtn) {
      studyBtn.classList.toggle('on', studySoundsEnabled);
      studyBtn.setAttribute('aria-pressed', String(studySoundsEnabled));
      studyBtn.disabled = !soundEnabled;
    }
    if (volume) {
      volume.value = String(Math.round(masterVolume * 100));
      volume.disabled = !soundEnabled;
    }
    if (volumeValue) volumeValue.textContent = `${Math.round(masterVolume * 100)}%`;
    previewButtons.forEach((button) => {
      const category = CUE_DEFINITIONS[button.dataset.audioPreviewCue]?.category;
      button.disabled = !soundEnabled || !categoryEnabled(category);
    });
  }

  function setEnabled(enabled) {
    const next = enabled === true;
    if (soundEnabled === next) return soundEnabled;
    soundEnabled = next;
    localStorage.setItem(PREFERENCE_KEYS.enabled, soundEnabled);
    if (!soundEnabled) releaseAudioContext();
    renderButtonState();
    return soundEnabled;
  }

  function setCategory(category, enabled) {
    const next = enabled === true;
    if (category === CATEGORIES.POKER) {
      pokerSoundsEnabled = next;
      localStorage.setItem(PREFERENCE_KEYS.poker, next);
    } else if (category === CATEGORIES.STUDY) {
      studySoundsEnabled = next;
      localStorage.setItem(PREFERENCE_KEYS.study, next);
    } else {
      throw new RangeError(`Unsupported audio category: ${String(category)}`);
    }
    renderButtonState();
    return next;
  }

  const authority = {
    schemaVersion: SCHEMA_VERSION,
    isEnabled: () => soundEnabled,
    getPreferences: () => Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      enabled: soundEnabled,
      masterVolume,
      pokerSoundsEnabled,
      studySoundsEnabled
    }),
    getCueCatalog: () => CUE_DEFINITIONS,
    getStudyCueConfig: () => STUDY_CUE_CONFIG,
    getEventCue: (eventType, payload = {}) => cueForExperienceEvent({ type: eventType, payload }),
    getFoleyManifest: foleyManifest,
    getSamplePlaybackPlan: (cueName, serial) => samplePlaybackPlan(cueName, serial),
    getSampleCacheState: () => Object.freeze({
      entries: sampleBufferPromises.size,
      ready: [...sampleBufferResults.values()].filter((state) => state === 'ready').length,
      failed: [...sampleBufferResults.values()].filter((state) => state === 'failed').length,
      pending: sampleBufferPromises.size - sampleBufferResults.size
    }),
    refreshControls: renderButtonState,
    toggle: () => setEnabled(!soundEnabled),
    setEnabled,
    setMasterVolume(value) {
      masterVolume = normalizedVolume(value, masterVolume);
      localStorage.setItem(PREFERENCE_KEYS.volume, masterVolume);
      renderButtonState();
      return masterVolume;
    },
    setCategoryEnabled: setCategory,
    initBtn() {
      const btn = document.getElementById('audioToggleBtn');
      const settingsBtn = document.getElementById('audioSettingsSwitch');
      const pokerBtn = document.getElementById('audioPokerSwitch');
      const studyBtn = document.getElementById('audioStudySwitch');
      const volume = document.getElementById('audioMasterVolume');
      const previewButtons = document.querySelectorAll?.('[data-audio-preview-cue]') || [];
      renderButtonState();
      if (btn) btn.onclick = () => authority.toggle();
      if (settingsBtn) settingsBtn.onclick = () => authority.toggle();
      if (pokerBtn) pokerBtn.onclick = () => setCategory(CATEGORIES.POKER, !pokerSoundsEnabled);
      if (studyBtn) studyBtn.onclick = () => setCategory(CATEGORIES.STUDY, !studySoundsEnabled);
      if (volume) volume.oninput = (event) => authority.setMasterVolume(Number(event.currentTarget.value) / 100);
      previewButtons.forEach((button) => {
        button.onclick = () => authority.previewCue(button.dataset.audioPreviewCue);
      });
    },
    consumeExperienceEvent(event) {
      if (event?.schemaVersion !== 'experience-event/v1') {
        return Promise.resolve(Object.freeze({ played: false, reason: 'invalid_event' }));
      }
      if (!ALLOWED_AUDIO_ORIGINS.has(event.origin)) {
        return Promise.resolve(Object.freeze({ played: false, reason: 'origin_suppressed' }));
      }
      if (!rememberEvent(event)) {
        return Promise.resolve(Object.freeze({ played: false, reason: 'duplicate_or_stale' }));
      }
      if (event.type === 'session_started' || event.type === 'replay_started') {
        return prepareAudio();
      }
      const cueName = cueForExperienceEvent(event);
      if (!cueName) return Promise.resolve(Object.freeze({ played: false, reason: 'silent_policy' }));
      if (event.origin === 'replay_playback'
        && Number(event.payload?.replaySpeed) > 1.5
        && ['check', 'card_reveal'].includes(cueName)) {
        return Promise.resolve(Object.freeze({ played: false, reason: 'replay_speed' }));
      }
      return CUE_DEFINITIONS[cueName]?.category === CATEGORIES.POKER
        ? queuePokerEventCue(cueName)
        : playCue(cueName);
    },
    prepareForUserGesture: prepareAudio,
    previewCue(cueName) {
      if (!PREVIEW_CUES.has(cueName)) {
        return Promise.resolve(Object.freeze({ played: false, reason: 'invalid_preview' }));
      }
      return playCue(cueName);
    },
    playCardDeal: (cardCount = 1) => playCue(Number(cardCount) > 1 ? 'card_deal' : 'card_reveal'),
    playChip: () => playCue('call'),
    playTrainingResult: () => playCue('study_neutral'),
    playPokerAction(action = 'check') {
      const cueName = {
        fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise',
        all_in: 'all_in', 'all-in': 'all_in'
      }[String(action).toLowerCase()] || 'check';
      return playCue(cueName);
    },
    playCorrect: () => playCue('study_positive'),
    playWrong: () => playCue('study_corrective'),
    playHint: () => playCue('hint'),
    playClick: () => playCue('click'),
    play(name) {
      const cueName = {
        success_chime: 'study_positive', correct: 'study_positive',
        acceptable: 'study_neutral', error_buzz: 'study_corrective', wrong: 'study_corrective',
        chip_clink: 'call', chip: 'call', card_slide: 'card_deal', card: 'card_deal'
      }[name] || 'click';
      return playCue(cueName);
    }
  };

  return Object.freeze(authority);
})();
