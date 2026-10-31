#!/usr/bin/env node
'use strict';

const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const phase = process.argv.find((entry) => entry.startsWith('--phase='))?.slice('--phase='.length);
const userData = process.argv.find((entry) => entry.startsWith('--user-data='))?.slice('--user-data='.length);
const resultPath = process.argv.find((entry) => entry.startsWith('--result='))?.slice('--result='.length);
if (!['write', 'read'].includes(phase) || !userData || !resultPath) throw new Error('Electron audit arguments are incomplete');

app.setPath('userData', path.resolve(userData));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const repoRoot = path.resolve(__dirname, '..', '..');
const errors = [];
let win;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(expression, timeoutMilliseconds = 30_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function click(selector) {
  const found = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!found) throw new Error(`Missing click target: ${selector}`);
}

async function activate() {
  const startedAt = Date.now();
  await click('[data-mode="calibration"]');
  await waitFor("window.RiverlineRangeCalibration && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading'");
  return Date.now() - startedAt;
}

async function createProfile() {
  await click('#calibrationCreateFirstProfile');
  await waitFor("document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  await win.webContents.executeJavaScript(`(() => {
    const values = {
      '#calibrationProfileDisplayName': 'Electron durable profile',
      '#calibrationProfileDescription': 'RANGE-CAL-001C Electron restart QA',
      '#calibrationProfileEnvironment': 'home',
      '#calibrationModeName1': 'Normal',
      '#calibrationModeName2': 'Cautious',
      '#calibrationModeName3': 'Pressure',
    };
    for (const [selector, value] of Object.entries(values)) document.querySelector(selector).value = value;
    document.querySelector('#calibrationProfileForm').requestSubmit();
  })()`);
  await waitFor("document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured' && !document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
}

app.whenReady().then(async () => {
  try {
    win = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { contextIsolation: true, nodeIntegration: false } });
    win.webContents.on('console-message', (_event, level, message) => {
      if (level >= 3) errors.push(message);
    });
    win.webContents.on('render-process-gone', (_event, details) => errors.push(`renderer gone: ${details.reason}`));
    await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
    await waitFor('window.app && window.RiverlineI18n');
    const before = await win.webContents.executeJavaScript(`(async () => ({
      databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((entry) => entry.name) : [],
      owner: localStorage.getItem('riverline.personalStrategy.owner.v1'),
    }))()`);
    const activationMs = await activate();

    let result;
    if (phase === 'write') {
      await createProfile();
      await click('#calibrationStartQuestions');
      await waitFor("document.querySelector('#rangeCalibrationWorkspace')?.dataset.sessionView === 'questions'");
      const answerStartedAt = Date.now();
      await click('#calibrationActionRaise');
      await waitFor("window.RiverlineRangeCalibration.getState().calibrationState.progress.answered === 1 && document.querySelector('#rangeCalibrationWorkspace').dataset.persistenceState === 'ready'");
      result = await win.webContents.executeJavaScript(`(async () => ({
        phase: 'write',
        prompt: window.RiverlineRangeCalibration.getState().calibrationState.prompt.handClass,
        answered: window.RiverlineRangeCalibration.getState().calibrationState.progress.answered,
        databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((entry) => entry.name) : [],
        interactions: window.RiverlineRangeCalibration.getPerformanceReport().interactions,
      }))()`);
      result.answerRoundTripMs = Date.now() - answerStartedAt;
    } else {
      await click('#calibrationStartQuestions');
      await waitFor("window.RiverlineRangeCalibration.getState().calibrationState?.progress?.answered === 1");
      result = await win.webContents.executeJavaScript(`(async () => ({
        phase: 'read',
        prompt: window.RiverlineRangeCalibration.getState().calibrationState.prompt.handClass,
        answered: window.RiverlineRangeCalibration.getState().calibrationState.progress.answered,
        databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((entry) => entry.name) : [],
        profileName: window.RiverlineRangeCalibration.getState().workspace.profiles[0]?.profile?.displayName ?? null,
      }))()`);
    }
    result.beforeActivation = before;
    result.activationMs = activationMs;
    result.errors = errors;
    await session.defaultSession.flushStorageData();
    fs.writeFileSync(resultPath, JSON.stringify(result));
    app.quit();
  } catch (error) {
    fs.writeFileSync(resultPath, JSON.stringify({ phase, fatal: error.stack || String(error), errors }));
    app.exit(1);
  }
});
