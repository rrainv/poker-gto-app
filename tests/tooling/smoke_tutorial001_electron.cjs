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

async function waitFor(win, expression, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await delay(50);
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

async function inspectActive(win, label) {
  await delay(380);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const state = window.RiverlineTutorials.getState();
    const panel = document.querySelector('.tutorial-coach');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const target = document.querySelector('[data-tutorial-anchor="' + ({
      overview: 'home-overview', recent: 'home-recent', review: 'home-review',
      'personal-strategy': 'home-personal-strategy', 'quick-start': 'home-quick-start'
    }[state.stepId]) + '"]');
    const panelRect = panel?.getBoundingClientRect();
    const targetRect = target?.getBoundingClientRect();
    const spotlightRect = spotlight?.getBoundingClientRect();
    const within = (rect) => rect && rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
    return {
      label: ${JSON.stringify(label)},
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      state,
      panelWithinViewport: within(panelRect),
      targetVisible: within(targetRect),
      spotlightVisible: within(spotlightRect),
      targetRect: targetRect ? { top: targetRect.top, right: targetRect.right, bottom: targetRect.bottom, left: targetRect.left } : null,
      panelOverflow: panel ? panel.scrollHeight > panel.clientHeight + 1 : null,
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      focus: document.activeElement?.className || document.activeElement?.id || null,
      diagnostics: window.RiverlineTutorials.getDiagnostics(),
    };
  })()`);
  samples.push(sample);
  if (sample.state.status !== 'active' || !sample.panelWithinViewport || !sample.targetVisible || !sample.spotlightVisible
    || sample.documentOverflowX || !String(sample.focus).includes('tutorial-coach')) {
    throw new Error(`Invalid tutorial geometry: ${JSON.stringify(sample)}`);
  }
  return sample;
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
      partition: `riverline-tutorial001-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(String(message)); });
  try {
    await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
    await waitFor(win, "Boolean(window.RiverlineTutorials) && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
    await waitFor(win, "Boolean(document.querySelector('[data-tutorial-offer]'))");
    const dormant = await win.webContents.executeJavaScript('window.RiverlineTutorials.getDiagnostics().surface');
    if (dormant.active || dormant.activeListeners || dormant.pendingLayout || dormant.layouts) {
      throw new Error(`Inactive tutorial performed live work: ${JSON.stringify(dormant)}`);
    }

    await click(win, '[data-tutorial-offer] [data-tutorial-action], [data-tutorial-offer] .ui-button--primary');
    await waitFor(win, "window.RiverlineTutorials.getState().status === 'active'");
    await inspectActive(win, 'cold-start-overview');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
    await settle(win);
    await inspectActive(win, 'keyboard-next-recent');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
    await settle(win);
    await inspectActive(win, 'keyboard-back-overview');
    await click(win, '[data-tutorial-action="skip"]');
    if ((await win.webContents.executeJavaScript("window.RiverlineTutorials.getPersistenceRecord('home.first-use').firstUseStatus")) !== 'skipped') {
      throw new Error('Skip state did not persist');
    }
    await win.webContents.reload();
    await waitFor(win, "Boolean(window.RiverlineTutorials) && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('[data-tutorial-offer]'))")) throw new Error('Skipped tutorial nagged after reload');

    await click(win, '#workspaceTutorialButton');
    await waitFor(win, "window.RiverlineTutorials.getState().status === 'active'");
    for (let index = 0; index < 4; index += 1) await click(win, '[data-tutorial-action="next"]');
    await inspectActive(win, 'manual-restart-finish-step');
    await click(win, '[data-tutorial-action="finish"]');
    if ((await win.webContents.executeJavaScript("window.RiverlineTutorials.getPersistenceRecord('home.first-use').firstUseStatus")) !== 'completed') {
      throw new Error('Finish state did not persist');
    }
    await win.webContents.reload();
    await waitFor(win, "Boolean(window.RiverlineTutorials) && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('[data-tutorial-offer]'))")) throw new Error('Completed tutorial nagged after reload');

    const matrix = [
      [1024, 768, 'en', 'midnight'],
      [1366, 768, 'ru', 'daylight'],
      [1440, 900, 'he', 'graphite'],
      [1920, 1080, 'en', 'daylight'],
      [2560, 1600, 'ru', 'midnight'],
    ];
    for (const [width, height, language, theme] of matrix) {
      win.setContentSize(width, height);
      await win.webContents.executeJavaScript(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}; window.setLanguage(${JSON.stringify(language)})`);
      await settle(win);
      await win.webContents.executeJavaScript("document.querySelector('#workspaceTutorialButton')?.focus({ preventScroll: true })");
      await click(win, '#workspaceTutorialButton');
      await waitFor(win, "window.RiverlineTutorials.getState().status === 'active'");
      await inspectActive(win, `${width}x${height}-${language}-${theme}`);
      await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
      await settle(win);
      const restored = await win.webContents.executeJavaScript("document.activeElement?.id");
      if (restored !== 'workspaceTutorialButton') throw new Error(`Focus was not restored at ${width}x${height}: ${restored}`);
    }

    await win.webContents.executeJavaScript("window.setLanguage('en')");
    await click(win, '#workspaceTutorialButton');
    await click(win, '[data-mode="training"]');
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('.tutorial-layer'))")) throw new Error('Workspace switch left a stale overlay');
    await click(win, '[data-mode="home"]');
    await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
    await click(win, '#workspaceTutorialButton');
    await click(win, '#openSettings');
    if (await win.webContents.executeJavaScript("Boolean(document.querySelector('.tutorial-layer'))")) throw new Error('Modal opening left a stale overlay');

    if (errors.length) throw new Error(`Renderer errors: ${JSON.stringify(errors)}`);
    process.stdout.write(`${JSON.stringify({ browser: process.versions.electron, dormant, sampleCount: samples.length, samples, errors }, null, 2)}\n`);
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    win.destroy();
    app.exit(exitCode);
  }
});
