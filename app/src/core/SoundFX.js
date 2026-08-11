// Procedural Web Audio API SoundFX Engine
const SoundFX = (function() {
  let audioCtx = null;
  let soundEnabled = localStorage.getItem('appSoundEnabled') !== 'false';
  let lastDealTime = -Infinity;

  const VOLUME = Object.freeze({ click: 0.035, card: 0.045, action: 0.04, result: 0.04 });

  function getAudioContext() {
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
          const start = now + (index * 0.045);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280 - (index * 24), start);
          osc.frequency.exponentialRampToValueAtTime(125, start + 0.055);
          gain.gain.setValueAtTime(VOLUME.card, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.06);
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
        osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(VOLUME.action, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) {}
    },
    playTrainingResult: function(grade = 'acceptable') {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const tones = grade === 'optimal' ? [440, 554]
          : grade === 'mistake' ? [196]
            : [330];
        tones.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = grade === 'mistake' ? 'triangle' : 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(VOLUME.result, now + i * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.055);
          osc.stop(now + i * 0.055 + 0.12);
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
        gain.gain.setValueAtTime(VOLUME.action, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.055);
      } catch (e) {}
    },
    playCorrect: function() { return this.playTrainingResult('optimal'); },
    playWrong: function() { return this.playTrainingResult('mistake'); },
    playClick: function() {
      if (!soundEnabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        gain.gain.setValueAtTime(VOLUME.click, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.03);
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
