#!/usr/bin/env node
'use strict';

// REPLAY-001C/CR bounded Electron smoke. Screenshots go only to the OS temp folder.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const screenshots = [];
const consoleErrors = [];
const samples = [];

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(win, expression, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target || target.disabled) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unavailable click target: ${selector}`);
  await settle(win);
}

async function sample(win, id) {
  const result = await win.webContents.executeJavaScript(`(() => {
    const projection = window.RiverlinePlaybookState.createReplayProjectionViewModel();
    const playback = window.RiverlinePlaybookState.createReplayPlaybackViewModel();
    const root = document.documentElement;
    const controls = document.querySelector('#handReplayControls');
    const button = document.querySelector('#handReplayPlaybackButton');
    const timeline = document.querySelector('#handActionHistory');
    const selected = timeline?.querySelector('[aria-current="step"]');
    const table = document.querySelector('#visual-table-container');
    const seatGeometry = [...document.querySelectorAll('.table-player-unit')].map((seat) => {
      const surface = seat.querySelector('.table-seat-surface')?.getBoundingClientRect();
      const cards = seat.querySelector('.table-hole-cards')?.getBoundingClientRect();
      return {
        seatIndex: Number(seat.dataset.seatIndex),
        hasCards: Boolean(seat.querySelector('.table-hole-cards .poker-card-svg')),
        surfaceWidth: surface?.width || 0,
        surfaceHeight: surface?.height || 0,
        cardCenterDeltaX: surface && cards
          ? Math.abs((surface.left + (surface.width / 2)) - (cards.left + (cards.width / 2)))
          : null,
      };
    });
    return {
      id: ${JSON.stringify(id)},
      viewport: { width: innerWidth, height: innerHeight },
      language: root.lang,
      direction: root.dir,
      theme: root.dataset.theme,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      mode: projection?.mode,
      currentStep: projection?.currentStep,
      totalSteps: projection?.totalSteps,
      selectedKind: projection?.selectedFrame?.kind || null,
      selectedAction: projection?.timeline?.selectedAction?.actionType || null,
      atPlaybackEnd: projection?.atPlaybackEnd === true,
      playing: playback?.playing === true,
      pendingTick: playback?.hasPendingTick === true,
      controlState: controls?.dataset.playbackState,
      controlText: button?.textContent,
      controlPressed: button?.getAttribute('aria-pressed'),
      controlDisabled: button?.disabled,
      selectedTimelineKind: selected?.dataset.transitionKind || selected?.dataset.actionType || null,
      tableTransition: table?.dataset.replayTransition || null,
      replayReadOnly: document.querySelector('#playbookHandWorkspace')?.classList.contains('is-replay-readonly'),
      globalOverflowX: root.scrollWidth > root.clientWidth + 1,
      timelineOverflowX: timeline ? timeline.scrollWidth > timeline.clientWidth + 1 : false,
      focusedElement: document.activeElement?.id || null,
      seatCount: seatGeometry.length,
      seatGeometry,
      replayMotionClassCount: table?.querySelectorAll('[class*="is-replay-"][class*="-motion"]').length || 0,
      timelineMotionActive: timeline?.querySelector('.is-replay-motion-current') != null,
      visibleMotionAnimations: table
        ? table.getAnimations({ subtree: true }).map((animation) => animation.animationName).filter(Boolean)
        : [],
    };
  })()`);
  samples.push(result);
  return result;
}

async function capture(win, id) {
  await settle(win);
  await delay(160);
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(os.tmpdir(), `riverline-replay001c-${id}.png`);
  fs.writeFileSync(screenshotPath, image.toPNG());
  screenshots.push(screenshotPath);
  return sample(win, id);
}

async function setFrame(win, predicate) {
  for (let attempts = 0; attempts < 40; attempts += 1) {
    const matched = await win.webContents.executeJavaScript(`(() => {
      const projection = window.RiverlinePlaybookState.createReplayProjectionViewModel();
      return (${predicate})(projection);
    })()`);
    if (matched) return;
    await win.webContents.executeJavaScript(
      "window.RiverlinePlaybookState.nextReplayFrame()",
    );
    await settle(win);
  }
  throw new Error(`Replay frame not found: ${predicate}`);
}

async function createAllInRunout(win) {
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 10, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealHoleCards({ 'seat-0': ['As', 'Ad'], 'seat-1': ['Kh', 'Kd'] });
    bridge.applyAction('call');
    bridge.applyAction('check');
    bridge.dealBoardCards(['2c', '3c', '4c']);
    bridge.applyAction('all_in');
    bridge.applyAction('call');
    bridge.dealBoardCards(['9s']);
    bridge.dealBoardCards(['Jc']);
    bridge.resolveShowdown();
  })()`);
  await settle(win);
}

async function beginPausedReplay(win) {
  await click(win, '#handReplayPlaybackButton');
  await click(win, '#handReplayPlaybackButton');
  await waitFor(win, "window.RiverlinePlaybookState.createReplayProjectionViewModel()?.mode === 'replay'");
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(String(message));
  });
  await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlinePlaybookState)");
  await delay(250);
  await click(win, '[data-mode="gto"]');
  await click(win, '[data-playbook-mode="hand"]');
  await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'hand'");

  await createAllInRunout(win);
  await capture(win, 'A-live-1920x1080-en-midnight');
  await beginPausedReplay(win);
  await capture(win, 'B-paused-historical');

  await setFrame(win, "(projection) => projection?.timeline?.selectedAction?.actionType === 'call'");
  await capture(win, 'C-action-call');
  await delay(720);
  await sample(win, 'C2-action-call-settled');
  await setFrame(win, "(projection) => projection?.selectedFrame?.kind === 'flop_deal'");
  await capture(win, 'F-flop-deal');
  await setFrame(win, "(projection) => projection?.timeline?.selectedAction?.actionType === 'all_in'");
  await capture(win, 'E-all-in');
  await setFrame(win, "(projection) => projection?.selectedFrame?.kind === 'turn_deal'");
  await capture(win, 'G-turn-deal');
  await setFrame(win, "(projection) => projection?.selectedFrame?.kind === 'river_deal'");
  await capture(win, 'H-river-deal');

  await click(win, '#handReplayPlaybackButton');
  await waitFor(win, "window.RiverlinePlaybookState.createReplayPlaybackViewModel()?.playing === false", 5_000);
  await capture(win, 'I-showdown');

  win.setContentSize(1024, 768);
  await settle(win);
  await capture(win, 'J-1024x768');
  win.setContentSize(1920, 1080);
  await settle(win);
  await win.webContents.executeJavaScript("window.setLanguage('he')");
  await settle(win);
  await capture(win, 'K-hebrew-rtl');
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage('en');
    document.documentElement.dataset.theme = 'daylight';
  })()`);
  await settle(win);
  await capture(win, 'L-daylight');

  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.returnReplayToLive();
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealHoleCards({ 'seat-0': ['As', 'Ad'], 'seat-1': ['Kh', 'Kd'] });
    bridge.applyAction('fold');
    bridge.startReplayPlayback();
  })()`);
  await waitFor(win, "window.RiverlinePlaybookState.createReplayPlaybackViewModel()?.playing === false", 5_000);
  await capture(win, 'D-fold');

  if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await win.webContents.executeJavaScript("window.RiverlinePlaybookState.returnReplayToLive()");
  await createAllInRunout(win);
  await click(win, '#handReplayPlaybackButton');
  await waitFor(win, "window.RiverlinePlaybookState.createReplayProjectionViewModel()?.selectedFrameIndex >= 1", 5_000);
  await click(win, '#handReplayPlaybackButton');
  await capture(win, 'M-reduced-motion');

  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.returnReplayToLive();
    bridge.initializeHand({
      tableSize: 6, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealHoleCards({
      'seat-0': ['As', 'Ad'], 'seat-1': ['Kh', 'Kd'], 'seat-2': ['Qc', 'Qd'],
      'seat-3': ['Jh', 'Jd'], 'seat-4': ['Ts', 'Td'], 'seat-5': ['9c', '9d']
    });
  })()`);
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage('en');
    document.documentElement.dataset.theme = 'midnight';
  })()`);
  win.setContentSize(2560, 1600);
  await settle(win);
  await capture(win, 'N-6max-2560x1600');
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 10, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealHoleCards({
      'seat-0': ['As', 'Ad'], 'seat-1': ['Kh', 'Kd'], 'seat-2': ['Qc', 'Qd'],
      'seat-3': ['Jh', 'Jd'], 'seat-4': ['Ts', 'Td'], 'seat-5': ['9c', '9d'],
      'seat-6': ['8h', '8d'], 'seat-7': ['7s', '7d'], 'seat-8': ['6c', '6d'],
      'seat-9': ['5h', '5d']
    });
  })()`);
  await settle(win);
  await capture(win, 'O-10max-geometry');

  const findings = samples.flatMap((entry) => [
    ...(entry.globalOverflowX ? [`${entry.id}:global-overflow-x`] : []),
    ...(entry.timelineOverflowX ? [`${entry.id}:timeline-overflow-x`] : []),
    ...(entry.mode === 'replay' && !entry.replayReadOnly ? [`${entry.id}:replay-not-readonly`] : []),
    ...(entry.playing && entry.controlText !== 'Pause' ? [`${entry.id}:playing-control-not-pause`] : []),
    ...(entry.id.includes('settled') && (entry.replayMotionClassCount || entry.timelineMotionActive || entry.tableTransition)
      ? [`${entry.id}:motion-marker-did-not-settle`] : []),
    ...entry.seatGeometry.filter((seat) => seat.hasCards && seat.cardCenterDeltaX > 1.5)
      .map((seat) => `${entry.id}:seat-${seat.seatIndex}-cards-off-center-${seat.cardCenterDeltaX.toFixed(2)}`),
    ...entry.seatGeometry.filter((seat) => seat.surfaceHeight > seat.surfaceWidth * .76)
      .map((seat) => `${entry.id}:seat-${seat.seatIndex}-surface-too-tall`),
  ]);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'replay001c-electron-smoke/v1',
    renderer: `Electron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
    screenshotCount: screenshots.length,
    screenshots,
    sampleCount: samples.length,
    samples,
    consoleErrors,
    findings,
  }, null, 2)}\n`);
  win.destroy();
  app.exit(findings.length || consoleErrors.length ? 1 : 0);
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
