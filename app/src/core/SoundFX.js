// Procedural Web Audio API SoundFX Engine
const SoundFX = (function() {
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('appSoundEnabled') !== 'false';
  let lastDealTime = -Infinity;
  let lastHintTime = -Infinity;

  const CUE_PROFILE = Object.freeze({
    click: Object.freeze({ gain: 0.05, attack: 0.002, duration: 0.045 }),
    hint: Object.freeze({ gain: 0.055, attack: 0.004, duration: 0.105 }),
    card: Object.freeze({ gain: 0.08, attack: 0.002, duration: 0.085 }),
    action: Object.freeze({ gain: 0.075, attack: 0.003, duration: 0.075 }),
    result: Object.freeze({ gain: 0.11, attack: 0.006, duration: 0.18 })
  });

  function shapeCueEnvelope(gainParam, start, profile, peakGain = profile.gain) {
    gainParam.setValueAtTime(0.001, start);
    gainParam.exponentialRampToValueAtTime(peakGain, start + profile.attack);
    gainParam.exponentialRampToValueAtTime(0.001, start + profile.duration);
  }

  function getAudioContext() {
    if (!soundEnabled) return null;
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  if (typeof window !== 'undefined') {
    ['click', 'touchstart', 'keydown', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, () => {
        if (!soundEnabled) return;
        const ctx = getAudioContext();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      }, { passive: true });
    });
  }

  const btn = document.getElementById('audioToggleBtn');
  const settingsBtn = document.getElementById('audioSettingsSwitch');
  function renderButtonState() {
    if (btn) {
      btn.classList.toggle('muted', !soundEnabled);
      btn.setAttribute('aria-pressed', String(soundEnabled));
      btn.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
      btn.title = soundEnabled ? 'Mute sound' : 'Enable sound';
    }
    if (settingsBtn) {
      settingsBtn.classList.toggle('on', soundEnabled);
      settingsBtn.setAttribute('aria-pressed', String(soundEnabled));
    }
  }

  return {
    isEnabled: () => soundEnabled,
    toggle: function() {
      soundEnabled = !soundEnabled;
      localStorage.setItem('appSoundEnabled', soundEnabled);
      
      renderButtonState();
      const switchBtn = document.getElementById('audioSettingsSwitch');
      if (switchBtn) {
        switchBtn.classList.toggle('on', soundEnabled);
        switchBtn.setAttribute('aria-pressed', soundEnabled);
      }
      return soundEnabled;
    },
    initBtn: function() {
      
      if (btn) {
        renderButtonState();
        btn.onclick = () => {
          const state = SoundFX.toggle();
          if (state) SoundFX.playClick();
        };
      }
      if (settingsBtn) {
        renderButtonState();
        settingsBtn.onclick = () => {
          const state = SoundFX.toggle();
          if (state) SoundFX.playClick();
        };
      }
    },
    playCardDeal: function(cardCount = 1) {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (now - lastDealTime < 0.06) return;
        lastDealTime = now;
        const cueCount = Number(cardCount) > 1 ? 2 : 1;
        for (let index = 0; index < cueCount; index += 1) {
          const start = now + (index * 0.055);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(360 - (index * 38), start);
          osc.frequency.exponentialRampToValueAtTime(170, start + 0.07);
          shapeCueEnvelope(gain.gain, start, CUE_PROFILE.card);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + CUE_PROFILE.card.duration + 0.01);
        }
      } catch (e) {}
    },
    playChip: function() {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.065);
        shapeCueEnvelope(gain.gain, ctx.currentTime, CUE_PROFILE.action);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + CUE_PROFILE.action.duration + 0.01);
      } catch (e) {}
    },
    playTrainingResult: function(grade = 'acceptable') {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const tones = grade === 'optimal' ? [480, 620]
          : grade === 'mistake' ? [240]
            : [380];
        tones.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = grade === 'mistake' ? 'triangle' : 'sine';
          const start = now + i * 0.065;
          const peakGain = grade === 'optimal' ? CUE_PROFILE.result.gain * 0.72 : CUE_PROFILE.result.gain;
          osc.frequency.setValueAtTime(freq, start);
          osc.frequency.exponentialRampToValueAtTime(
            grade === 'optimal' ? freq * 1.08 : grade === 'mistake' ? 180 : 410,
            start + 0.09
          );
          shapeCueEnvelope(gain.gain, start, CUE_PROFILE.result, peakGain);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + CUE_PROFILE.result.duration + 0.01);
        });
      } catch (e) {}
    },
    playPokerAction: function(action = 'check') {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const actionName = String(action).toLowerCase();
        const frequency = actionName === 'fold' ? 220
          : actionName === 'all_in' || actionName === 'all-in' ? 380
            : actionName === 'bet' || actionName === 'raise' ? 340 : 290;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(180, frequency * 0.82), now + 0.06);
        shapeCueEnvelope(gain.gain, now, CUE_PROFILE.action);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + CUE_PROFILE.action.duration + 0.01);
      } catch (e) {}
    },
    playCorrect: function() { return this.playTrainingResult('optimal'); },
    playWrong: function() { return this.playTrainingResult('mistake'); },
    playHint: function() {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (now - lastHintTime < 0.1) return;
        lastHintTime = now;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(690, now + 0.065);
        shapeCueEnvelope(gain.gain, now, CUE_PROFILE.hint);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + CUE_PROFILE.hint.duration + 0.01);
      } catch (e) {}
    },
    playClick: function() {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(620, ctx.currentTime + 0.035);
        shapeCueEnvelope(gain.gain, ctx.currentTime, CUE_PROFILE.click);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + CUE_PROFILE.click.duration + 0.01);
      } catch (e) {}
    },
    play: function(name) {
      if (!soundEnabled) return;
      if (name === 'success_chime' || name === 'correct') return this.playTrainingResult('optimal');
      if (name === 'acceptable') return this.playTrainingResult('acceptable');
      if (name === 'error_buzz' || name === 'wrong') return this.playTrainingResult('mistake');
      if (name === 'chip_clink' || name === 'chip') return this.playChip();
      if (name === 'card_slide' || name === 'card') return this.playCardDeal();
      return this.playClick();
    }
  };
})();
