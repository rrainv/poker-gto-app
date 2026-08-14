#!/usr/bin/env node
'use strict';

// Run with ELECTRON_RUN_AS_NODE removed:
//   .\node_modules\.bin\electron.cmd .\tests\tooling\audit_range_cal001b.cjs

const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactRoot = path.join(repoRoot, 'tests', 'artifacts', 'range-cal001b');
const rendererErrors = [];
let win;
let server;
let baseUrl;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function settle() {
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function waitFor(expression, timeoutMilliseconds = 15_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
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
  await settle();
}

async function typeValues(values) {
  await win.webContents.executeJavaScript(`(() => {
    const values = ${JSON.stringify(values)};
    for (const [selector, value] of Object.entries(values)) {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing field: ' + selector);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await settle();
}

async function inspect(label) {
  return win.webContents.executeJavaScript(`(() => {
    const visible = (element) => Boolean(element && !element.hidden && getComputedStyle(element).display !== 'none' && element.getClientRects().length);
    const root = document.querySelector('#rangeCalibrationWorkspace');
    const question = document.querySelector('#calibrationQuestionView');
    const active = document.querySelector('#calibrationActiveQuestion');
    const candidates = root ? [...root.querySelectorAll('button, input, h1, h2, strong, p, progress')] : [];
    const overflows = candidates.filter((element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
    }).map((element) => ({ id: element.id || null, text: (element.textContent || '').trim().slice(0, 70) }));
    const state = window.RiverlineRangeCalibration?.getState?.();
    const calibration = state?.calibrationState;
    return {
      label: ${JSON.stringify(label)},
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      sessionView: root?.dataset.sessionView || null,
      sessionState: root?.dataset.sessionState || null,
      prompt: document.querySelector('#calibrationQuestionTitle')?.textContent || null,
      handDirection: getComputedStyle(document.querySelector('#calibrationQuestionTitle')).direction,
      progress: document.querySelector('#calibrationQuestionProgress')?.textContent || null,
      answered: calibration?.progress?.answered ?? null,
      remaining: calibration?.progress?.remaining ?? null,
      questionVisible: visible(question),
      activeQuestionVisible: visible(active),
      completeVisible: visible(document.querySelector('#calibrationCompleteState')),
      mixVisible: visible(document.querySelector('#calibrationMixDialog')),
      configurationVisible: visible(document.querySelector('.calibration-identity-panel')),
      previousVisible: visible(document.querySelector('#calibrationPreviousAnswer')),
      focusedElement: document.activeElement?.id || document.activeElement?.tagName || null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visibleOverflows: overflows,
      gradingWords: /correct|optimal|mistake|EV lost/i.test(question?.textContent || ''),
    };
  })()`);
}

async function capture(id, label) {
  await win.webContents.executeJavaScript('scrollTo(0, 0)');
  await settle();
  const state = await inspect(label);
  const image = await win.webContents.capturePage();
  const fileName = `${id}.png`;
  fs.writeFileSync(path.join(artifactRoot, fileName), image.toPNG());
  return { ...state, screenshot: `tests/artifacts/range-cal001b/${fileName}` };
}

async function createProfile() {
  await click('#calibrationCreateFirstProfile');
  await waitFor("document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  await typeValues({
    '#calibrationProfileDisplayName': 'Friday Home Game with Familiar Friends and a Deliberately Long Name',
    '#calibrationProfileDescription': 'A regular six-handed game.',
    '#calibrationProfileEnvironment': 'home',
    '#calibrationModeName1': 'Standard but thoughtfully pressure-aware',
    '#calibrationModeName2': 'Cautious deep-stack approach',
    '#calibrationModeName3': 'Late-session pressure mode',
  });
  await win.webContents.executeJavaScript("document.querySelector('#calibrationProfileForm').requestSubmit()");
  await waitFor("document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured' && !document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
}

async function key(keyValue) {
  await win.webContents.executeJavaScript(`document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(keyValue)}, bubbles: true }))`);
  await settle();
}

async function runAudit() {
  await click('[data-mode="calibration"]');
  await waitFor("Boolean(window.RiverlineRangeCalibration) && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading'");
  await createProfile();
  await click('#calibrationStartQuestions');
  await waitFor("document.querySelector('#rangeCalibrationWorkspace')?.dataset.sessionView === 'questions'");

  const states = [];
  states.push(await capture('A-first-question-1920x1080-en', 'A. First question'));

  const keyboardStart = Date.now();
  for (let index = 0; index < 30; index += 1) await key(index % 2 ? 'f' : 'r');
  const keyboardDurationMs = Date.now() - keyboardStart;
  states.push(await capture('B-after-30-answers-1920x1080-en', 'B. After 30 keyboard answers'));

  await click('#calibrationOpenMix');
  const beforeInputShortcut = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getState().calibrationState.progress.answered');
  await win.webContents.executeJavaScript("document.querySelector('#calibrationMixFold').focus(); document.querySelector('#calibrationMixFold').dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))");
  const afterInputShortcut = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getState().calibrationState.progress.answered');
  states.push(await capture('C-detailed-mix-1920x1080-en', 'C. Detailed mix editor'));
  await typeValues({ '#calibrationMixFold': '25', '#calibrationMixRaise': '75' });
  await win.webContents.executeJavaScript("document.querySelector('#calibrationMixForm').requestSubmit()");
  await waitFor("document.querySelector('#calibrationMixDialog')?.hidden === true");

  await click('#calibrationUndoAnswer');
  states.push(await capture('D-undo-restored-1920x1080-en', 'D. Undo restored hand'));
  await key('r');

  const originalModeId = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getState().selection.modeId');
  await click('#calibrationPauseQuestions');
  const alternateModeId = await win.webContents.executeJavaScript(`(() => {
    const alternate = [...document.querySelectorAll('#calibrationModeOptions [data-mode-id]')]
      .find((button) => button.dataset.modeId !== ${JSON.stringify(originalModeId)});
    alternate?.click();
    return window.RiverlineRangeCalibration.getState().selection.modeId;
  })()`);
  await settle();
  await win.webContents.executeJavaScript(`document.querySelector('[data-mode-id="${originalModeId}"]')?.click()`);
  await settle();
  const restoredModeId = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getState().selection.modeId');
  const pausedModeSwitchWorked = alternateModeId !== originalModeId && restoredModeId === originalModeId;
  await click('[data-mode="training"]');
  await click('[data-mode="calibration"]');
  await click('#calibrationStartQuestions');
  const promptBeforeReload = await win.webContents.executeJavaScript("document.querySelector('#calibrationQuestionTitle').textContent");
  win.webContents.reload();
  await waitFor("document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineI18n)");
  await delay(600);
  await click('[data-mode="calibration"]');
  await waitFor("document.querySelector('.riverline-shell')?.dataset.activeMode === 'calibration'");
  await waitFor("Boolean(window.RiverlineRangeCalibration) && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured'");
  await click('#calibrationStartQuestions');
  const promptAfterReload = await win.webContents.executeJavaScript("document.querySelector('#calibrationQuestionTitle').textContent");

  win.setContentSize(1024, 768);
  await settle();
  states.push(await capture('G-first-question-1024x768-en', 'G. 1024x768'));

  await win.webContents.executeJavaScript("window.setLanguage('he')");
  await settle();
  states.push(await capture('I-hebrew-rtl-1024x768', 'I. Hebrew RTL'));

  win.setContentSize(1440, 900);
  await win.webContents.executeJavaScript("window.setLanguage('ru')");
  await settle();
  states.push(await capture('J-russian-1440x900', 'J. Russian'));

  await win.webContents.executeJavaScript("window.setLanguage('en')");
  await click('#calibrationPauseQuestions');
  await win.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[data-theme-id="daylight"]');
    if (button) button.click();
  })()`);
  await click('#calibrationStartQuestions');
  states.push(await capture('L-daylight-1440x900-en', 'L. Alternate theme'));

  win.setContentSize(3840, 2160);
  await settle();
  states.push(await capture('K-question-3840x2160-en', 'K. 3840x2160'));
  win.setContentSize(1440, 900);
  await settle();

  const completionResult = await win.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('#calibrationActionRaise');
    for (let index = 0; index < 200; index += 1) {
      const before = window.RiverlineRangeCalibration.getState().calibrationState.progress.remaining;
      if (before <= 1) return { ok: true, remaining: before };
      button.click();
      const after = window.RiverlineRangeCalibration.getState().calibrationState.progress.remaining;
      if (after >= before) {
        const state = window.RiverlineRangeCalibration.getState().calibrationState;
        const store = JSON.parse(localStorage.getItem('riverline.personalStrategy.v1'));
        const durable = store.calibrationSessions.find((entry) => entry.id === state.session.id);
        return {
          ok: false,
          before,
          after,
          error: document.querySelector('#calibrationAnswerError')?.textContent,
          prompt: state.prompt,
          sessionUpdatedAt: state.session.updatedAt,
          durableUpdatedAt: durable?.updatedAt,
          stateCursor: state.session.cursor,
          durableCursor: durable?.cursor,
          storeRevision: store.revision,
          caught: window.RiverlineRangeCalibration.getState().lastAnswerError,
        };
      }
    }
    return { ok: false, error: 'iteration limit' };
  })()`);
  if (!completionResult.ok) throw new Error(`Synthetic completion failed: ${JSON.stringify(completionResult)}`);
  await settle();
  states.push(await capture('E-nearing-completion-1440x900-en', 'E. Nearing completion'));
  await click('#calibrationActionRaise');
  states.push(await capture('F-completed-169-1440x900-en', 'F. Completed 169'));

  const performance = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getPerformanceReport()');
  return {
    states,
    keyboardDurationMs,
    shortcutIgnoredInFrequencyInput: beforeInputShortcut === afterInputShortcut,
    pausedModeSwitchWorked,
    promptBeforeReload,
    promptAfterReload,
    performance,
  };
}

function createStaticServer() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

function findingsFor(audit) {
  const findings = [];
  for (const state of audit.states) {
    if (state.documentOverflowX > 1 || state.visibleOverflows.length) findings.push(`${state.label}: visible overflow.`);
    if (state.gradingWords) findings.push(`${state.label}: grading language appeared.`);
    if (state.sessionView !== 'questions' || !state.questionVisible || state.configurationVisible) findings.push(`${state.label}: question/context lock state failed.`);
    if (state.handDirection !== 'ltr') findings.push(`${state.label}: hand-class direction is not LTR.`);
  }
  if (!audit.shortcutIgnoredInFrequencyInput) findings.push('R shortcut fired inside frequency input.');
  if (!audit.pausedModeSwitchWorked) findings.push('Paused calibration mode switch did not work or restore coherently.');
  if (audit.promptBeforeReload !== audit.promptAfterReload) findings.push('Reload did not reconstruct the same prompt.');
  if (!audit.states.find((state) => state.label.startsWith('F.'))?.completeVisible) findings.push('Completion state was not visible.');
  if (rendererErrors.length) findings.push(`${rendererErrors.length} renderer error(s).`);
  return findings;
}

app.whenReady().then(async () => {
  fs.mkdirSync(artifactRoot, { recursive: true });
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  win = new BrowserWindow({
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
      session: session.fromPartition(`range-cal001b-${process.pid}`),
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) rendererErrors.push({ level, message });
  });
  await win.loadURL(`${baseUrl}/app/index.html`);
  await waitFor("document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineI18n)");
  const audit = await runAudit();
  const report = {
    schemaVersion: 'range-cal001b-renderer-audit/v1',
    renderer: `Electron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
    ...audit,
    rendererErrors,
  };
  report.findings = findingsFor(report);
  fs.writeFileSync(path.join(artifactRoot, 'renderer-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(report.findings.length ? 2 : 0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (win && !win.isDestroyed()) win.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});
