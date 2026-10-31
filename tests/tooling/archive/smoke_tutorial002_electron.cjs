#!/usr/bin/env node
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const errors = [];
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
    await delay(40);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await delay(80);
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target || target.hidden || target.disabled) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unavailable click target: ${selector}`);
  await settle(win);
}

async function inspect(win, label) {
  await delay(700);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const state = window.RiverlineTutorials.getState();
    const panel = document.querySelector('.tutorial-coach');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const panelRect = panel?.getBoundingClientRect();
    const spotlightRect = spotlight?.getBoundingClientRect();
    const within = (rect) => rect && rect.left >= -1 && rect.top >= -1
      && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
    return {
      label: ${JSON.stringify(label)},
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      tutorialId: state.tutorialId,
      stepId: state.stepId,
      stepNumber: state.stepNumber,
      stepCount: state.stepCount,
      panelWithinViewport: within(panelRect),
      spotlightWithinViewport: within(spotlightRect),
      spotlightRect: spotlightRect ? { left: spotlightRect.left, top: spotlightRect.top, right: spotlightRect.right, bottom: spotlightRect.bottom } : null,
      panelOverflow: panel ? panel.scrollHeight > panel.clientHeight + 1 : null,
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      focus: document.activeElement?.className || document.activeElement?.id || null,
    };
  })()`);
  samples.push(sample);
  if (!sample.panelWithinViewport || !sample.spotlightWithinViewport || sample.documentOverflowX
    || !String(sample.focus).includes('tutorial-coach')) {
    throw new Error(`Invalid tutorial geometry: ${JSON.stringify(sample)}`);
  }
  return sample;
}

async function runTutorial(win, tutorialId, label) {
  const result = await win.webContents.executeJavaScript(`window.RiverlineTutorials.restart(${JSON.stringify(tutorialId)})`);
  if (result.status !== 'active') throw new Error(`Could not start ${tutorialId}: ${JSON.stringify(result)}`);
  const seen = [];
  for (let guard = 0; guard < 10; guard += 1) {
    await settle(win);
    const sample = await inspect(win, `${label}-${guard + 1}`);
    seen.push(sample.stepId);
    const finish = await win.webContents.executeJavaScript("Boolean(document.querySelector('[data-tutorial-action=\"finish\"]'))");
    await click(win, finish ? '[data-tutorial-action="finish"]' : '[data-tutorial-action="next"]');
    const state = await win.webContents.executeJavaScript('window.RiverlineTutorials.getState()');
    if (state.status !== 'active') return seen;
  }
  throw new Error(`Tutorial did not finish: ${tutorialId}`);
}

app.whenReady().then(async () => {
  let exitCode = 0;
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
      partition: `riverline-tutorial002-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(String(message)); });
  try {
    await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
    await waitFor(win, "Boolean(window.RiverlineTutorials) && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");

    await click(win, '[data-mode="gto"]');
    await waitFor(win, "document.querySelector('#gtoMode')?.classList.contains('active')");
    await click(win, '#workspaceTutorialButton');
    await waitFor(win, "Boolean(document.querySelector('.tutorial-chooser'))");
    const chooser = await win.webContents.executeJavaScript(`(() => {
      const panel = document.querySelector('.tutorial-chooser');
      const rect = panel.getBoundingClientRect();
      return { count: panel.querySelectorAll('.tutorial-chooser-option').length,
        within: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        focus: document.activeElement?.className || '' };
    })()`);
    if (chooser.count !== 2 || !chooser.within || !chooser.focus.includes('tutorial-chooser-option')) {
      throw new Error(`Invalid chooser: ${JSON.stringify(chooser)}`);
    }
    await win.webContents.executeJavaScript("document.querySelector('.tutorial-chooser').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await settle(win);
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('.tutorial-chooser'))")) throw new Error('Escape did not close chooser');

    win.setContentSize(1024, 768);
    await settle(win);
    await runTutorial(win, 'playbook.scenario-basics', 'scenario-en-1024');
    await runTutorial(win, 'playbook.analysis-views', 'decision-en-1024');
    await click(win, '[data-gto-view="chart"]');
    await runTutorial(win, 'playbook.analysis-views', 'matrix-en-1024');
    await click(win, '[data-gto-view="range"]');
    await runTutorial(win, 'playbook.analysis-views', 'range-en-1024');

    await click(win, '#playbookHandMode');
    await waitFor(win, "document.querySelector('#gtoMode')?.dataset.playbookMode === 'hand'");
    await click(win, '[data-gto-view="context"]');
    await runTutorial(win, 'playbook.hand-mode', 'hand-en-1024');
    await win.webContents.executeJavaScript(`(() => {
      const bridge = window.RiverlinePlaybookState;
      bridge.initializeHand({ tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 });
      const state = bridge.getState();
      bridge.dealObservedHoleCards({ [bridge.getHeroPlayerId()]: ['As', 'Kd'] });
      const legal = bridge.getLegalActions();
      const type = ['call', 'check', 'fold'].find((candidate) => legal?.[candidate]?.available);
      if (!type) throw new Error('No legal action for Replay setup');
      bridge.applyAction(type);
    })()`);
    await waitFor(win, "!document.querySelector('#handReplayPreviousButton')?.disabled");
    await runTutorial(win, 'playbook.replay', 'replay-en-1024');

    await waitFor(win, "Boolean(document.querySelector('#savedStudySaveButton')) && !document.querySelector('#savedStudySaveButton').disabled");
    await click(win, '#savedStudySaveButton');
    await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
    await click(win, '[data-mode="home"]');
    await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false' && Boolean(document.querySelector('#homeRecentContent .home-open-button'))");
    await click(win, '#homeRecentContent .home-open-button');
    await waitFor(win, "!document.querySelector('#savedHandViewerBanner')?.hidden");
    await runTutorial(win, 'playbook.replay', 'saved-hand-en-1024');
    await click(win, '#savedHandReturnLiveButton');

    await click(win, '#playbookScenarioMode');
    await waitFor(win, "document.querySelector('#gtoMode')?.dataset.playbookMode === 'scenario'");
    await click(win, '[data-slots="hero"] [data-index="0"]');
    await waitFor(win, "Boolean(document.querySelector('[data-deck-card=\"As\"]'))");
    await click(win, '[data-deck-card="As"]');
    await click(win, '[data-slots="hero"] [data-index="1"]');
    await waitFor(win, "Boolean(document.querySelector('[data-deck-card=\"Kd\"]'))");
    await click(win, '[data-deck-card="Kd"]');
    await waitFor(win, "window.app?.decisionContext?.schemaVersion === 'decision-context/v1'");
    await win.webContents.executeJavaScript(`window.RiverlineSavedStudyObjects.saveCurrent({
      mode: 'scenario',
      scenarioInput: window.RiverlinePlaybookState.getScenarioInput(),
      decisionContext: window.app.decisionContext,
    })`);
    await click(win, '[data-mode="home"]');
    await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false' && Boolean(document.querySelector('#homeRecentContent .home-open-button'))");
    await click(win, '#homeRecentContent .home-open-button');
    await waitFor(win, "!document.querySelector('#savedSpotViewerBanner')?.hidden");
    await runTutorial(win, 'playbook.scenario-basics', 'saved-spot-en-1024');

    win.setContentSize(1366, 768);
    await win.webContents.executeJavaScript("document.documentElement.dataset.theme = 'daylight'; window.setLanguage('ru')");
    await click(win, '[data-mode="equity"]');
    await runTutorial(win, 'equity.basics', 'equity-basic-ru-1366');
    await runTutorial(win, 'equity.advanced', 'equity-advanced-ru-1366');

    win.setContentSize(1024, 768);
    await win.webContents.executeJavaScript("document.documentElement.dataset.theme = 'graphite'; window.setLanguage('he')");
    await click(win, '[data-mode="training"]');
    await runTutorial(win, 'training.first-spot', 'training-basic-he-1024');
    await click(win, '#trainingNewHand');
    await waitFor(win, "!document.querySelector('#trainingExerciseSurface')?.hidden && Boolean(document.querySelector('#trainingGuessButtons button'))");
    await click(win, '#trainingGuessButtons button');
    await waitFor(win, "!document.querySelector('#trainingFeedback')?.hidden");
    await runTutorial(win, 'training.feedback', 'training-feedback-he-1024');

    await click(win, '[data-mode="calibration"]');
    await waitFor(win, "document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading'");
    await runTutorial(win, 'calibration.setup', 'calibration-he-1024');
    await click(win, '#calibrationCreateFirstProfile');
    await waitFor(win, "Boolean(document.querySelector('#calibrationProfileModal'))");
    await win.webContents.executeJavaScript(`(() => {
      const values = {
        calibrationProfileDisplayName: 'Friday Home Game',
        calibrationModeName1: 'Baseline',
        calibrationModeName2: 'Cautious',
        calibrationModeName3: 'Aggressive',
      };
      Object.entries(values).forEach(([id, value]) => {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    })()`);
    await click(win, '#calibrationProfileSubmit');
    await waitFor(win, "!document.querySelector('#calibrationConfiguredState')?.hidden");
    await runTutorial(win, 'calibration.setup', 'calibration-existing-he-1024');
    await click(win, '#calibrationStartQuestions');
    await waitFor(win, "!document.querySelector('#calibrationQuestionView')?.hidden");
    await runTutorial(win, 'calibration.answers', 'calibration-answer-he-1024');
    await click(win, '#calibrationOpenMix');
    await waitFor(win, "!document.querySelector('#calibrationMixDialog')?.hidden");
    const mixDialog = await win.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('#calibrationMixDialog .modal').getBoundingClientRect();
      return { within: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        hasTieCopy: Boolean(document.querySelector('.calibration-mix-tie-note')),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
    })()`);
    if (!mixDialog.within || !mixDialog.hasTieCopy || mixDialog.overflowX) throw new Error(`Invalid exact-mix dialog: ${JSON.stringify(mixDialog)}`);
    await click(win, '#calibrationMixClose');

    win.setContentSize(1920, 1080);
    await settle(win);
    await click(win, '#openSettings');
    await waitFor(win, "document.querySelector('#settingsModal')?.classList.contains('show')");
    await runTutorial(win, 'settings.preferences', 'settings-he-1024');
    await click(win, '#closeSettingsModal');

    const dormant = await win.webContents.executeJavaScript('window.RiverlineTutorials.getDiagnostics()');
    if (dormant.surface.active || dormant.surface.activeListeners || dormant.surface.pendingLayout || dormant.chooserMounted) {
      throw new Error(`Tutorial work remained active: ${JSON.stringify(dormant)}`);
    }
    if (errors.length) throw new Error(`Renderer errors: ${JSON.stringify(errors)}`);
    const summary = samples.reduce((result, sample) => {
      result[sample.tutorialId] = result[sample.tutorialId] || [];
      if (!result[sample.tutorialId].includes(sample.stepId)) result[sample.tutorialId].push(sample.stepId);
      return result;
    }, {});
    process.stdout.write(`${JSON.stringify({ electron: process.versions.electron, chooser, sampleCount: samples.length, summary, dormant, errors }, null, 2)}\n`);
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    win.destroy();
    app.exit(exitCode);
  }
});
