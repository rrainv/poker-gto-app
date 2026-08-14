#!/usr/bin/env node
'use strict';

// RANGE-CAL-001A focused Electron renderer and performance audit.
// Run from the repository root:
//   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
//   .\node_modules\.bin\electron.cmd .\tests\tooling\audit_range_cal001a.cjs

const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactRoot = process.env.RIVERLINE_RANGE_CAL_ARTIFACT_ROOT
  || path.join(repoRoot, 'tests', 'artifacts', 'range-cal001a');
const windows = new Set();
const rendererErrors = [];
let server;
let baseUrl;
let rendererSequence = 0;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(win, expression, timeoutMilliseconds = 15_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Missing click target: ${selector}`);
  await settle(win);
}

async function createRenderer({ width = 1920, height = 1080 } = {}) {
  rendererSequence += 1;
  const partition = `range-cal001a-${process.pid}-${rendererSequence}`;
  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
      session: session.fromPartition(partition),
    },
  });
  windows.add(win);
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) rendererErrors.push({ renderer: rendererSequence, level, message });
  });
  try {
    await win.loadURL(`${baseUrl}/app/index.html`);
  } catch (error) {
    await delay(150);
    await win.loadURL(`${baseUrl}/app/index.html`);
  }
  win.setContentSize(width, height);
  win.webContents.setZoomFactor(1);
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineI18n)");
  await delay(500);
  return win;
}

async function activateCalibration(win) {
  await click(win, '[data-mode="calibration"]');
  await waitFor(win, "Boolean(window.RiverlineRangeCalibration) && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading'");
  await settle(win);
  await delay(320);
}

async function setLanguage(win, language) {
  await win.webContents.executeJavaScript(`window.setLanguage(${JSON.stringify(language)})`);
  await settle(win);
}

async function setTheme(win, theme) {
  await win.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[data-theme-id="${theme}"]');
    if (!button) throw new Error('Missing theme button: ${theme}');
    button.click();
  })()`);
  await settle(win);
}

async function setViewport(win, width, height) {
  win.setContentSize(width, height);
  await settle(win);
}

async function setFormValues(win, values) {
  await win.webContents.executeJavaScript(`(() => {
    const values = ${JSON.stringify(values)};
    for (const [selector, value] of Object.entries(values)) {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing form field: ' + selector);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  await settle(win);
}

async function submitProfileForm(win) {
  await win.webContents.executeJavaScript("document.querySelector('#calibrationProfileForm').requestSubmit()");
  await waitFor(win, "document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured' && !document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  await settle(win);
}

async function inspectState(win, label) {
  return win.webContents.executeJavaScript(`(() => {
    const root = document.querySelector('#rangeCalibrationWorkspace');
    const modal = document.querySelector('#calibrationProfileModal');
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const rootRect = root?.getBoundingClientRect();
    const candidates = root ? [...root.querySelectorAll('button, input, select, textarea, h1, h2, strong, p')] : [];
    const horizontalOverflows = candidates.filter((element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }).map((element) => ({
      tag: element.tagName,
      id: element.id || null,
      text: (element.textContent || element.value || '').trim().slice(0, 80),
      rect: [element.getBoundingClientRect().left, element.getBoundingClientRect().right],
    }));
    const modalRect = visible(modal) ? modal.querySelector('.calibration-profile-modal')?.getBoundingClientRect() : null;
    const profileModal = modal?.querySelector('.calibration-profile-modal');
    const profileBody = profileModal?.querySelector('.modal-body');
    const profileFooter = profileModal?.querySelector('.calibration-profile-modal-actions');
    const modeNameFields = profileModal?.querySelector('.calibration-mode-name-fields');
    const modeLegend = modeNameFields?.querySelector('legend');
    const modeNamePanel = modeNameFields?.querySelector('.calibration-mode-name-panel');
    const profileRect = profileModal?.getBoundingClientRect();
    const bodyRect = profileBody?.getBoundingClientRect();
    const footerRect = profileFooter?.getBoundingClientRect();
    const legendRect = modeLegend?.getBoundingClientRect();
    const panelRect = modeNamePanel?.getBoundingClientRect();
    const modalOverflows = profileModal ? [...profileModal.querySelectorAll('button, input, select, textarea, legend, p, h2, small, span')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1 || rect.bottom > innerHeight + 1;
      })
      .map((element) => element.id || element.tagName) : [];
    const modeButtons = [...document.querySelectorAll('#calibrationModeOptions [role="radio"]')];
    const dataToken = document.querySelector('#calibrationPreviewSpot');
    return {
      label: ${JSON.stringify(label)},
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      state: root?.dataset.calibrationState || null,
      workspaceNodes: root ? root.querySelectorAll('*').length + 1 : 0,
      workspaceRect: rootRect ? [rootRect.left, rootRect.top, rootRect.right, rootRect.bottom] : null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      modalOpen: Boolean(modal?.classList.contains('show')),
      modalRect: modalRect ? [modalRect.left, modalRect.top, modalRect.right, modalRect.bottom] : null,
      modalFullyInViewport: modalRect ? modalRect.left >= 0 && modalRect.top >= 0 && modalRect.right <= innerWidth && modalRect.bottom <= innerHeight : null,
      profileEditorGeometry: profileRect ? {
        fieldsetBorderTop: getComputedStyle(modeNameFields).borderTopWidth,
        legendClearsModePanel: Boolean(legendRect && panelRect) && legendRect.bottom <= panelRect.top + 1,
        footerBelowBody: Boolean(bodyRect && footerRect) && footerRect.top >= bodyRect.bottom - 1,
        footerReachable: Boolean(profileRect && footerRect) && footerRect.bottom <= profileRect.bottom + 1,
        bodyScroll: [profileBody.clientHeight, profileBody.scrollHeight, getComputedStyle(profileBody).overflowY],
        modeInputCount: profileModal.querySelectorAll('.calibration-mode-name-inputs input').length,
        modeValueLengths: [1, 2, 3].map((index) => document.querySelector('#calibrationModeName' + index)?.value.length || 0),
        modalOverflows,
      } : null,
      profileName: document.querySelector('#calibrationProfileName')?.textContent || null,
      modeNames: modeButtons.map((button) => button.textContent),
      modeCount: modeButtons.length,
      activeModeCount: modeButtons.filter((button) => button.getAttribute('aria-checked') === 'true').length,
      contextPreview: document.querySelector('#calibrationPreviewSpot')?.textContent || null,
      accounting: document.querySelector('#calibrationAccounting')?.textContent || null,
      startQuestionsDisabled: document.querySelector('.calibration-ready-state button')?.disabled ?? null,
      pokerTokenDirection: dataToken ? getComputedStyle(dataToken).direction : null,
      futureShellVisible: visible(document.querySelector('.calibration-ready-state')),
      focusedElement: document.activeElement?.id || document.activeElement?.tagName || null,
    };
  })()`);
}

async function capture(win, id, label) {
  await win.webContents.executeJavaScript('scrollTo(0, 0)');
  await settle(win);
  const state = await inspectState(win, label);
  const image = await win.webContents.capturePage();
  const fileName = `${id}.png`;
  fs.writeFileSync(path.join(artifactRoot, fileName), image.toPNG());
  return { ...state, screenshot: `tests/artifacts/range-cal001a/${fileName}` };
}

async function captureProfileEditor(win, id, label) {
  await click(win, '#calibrationEditProfile');
  await waitFor(win, "document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  const state = await capture(win, id, label);
  await click(win, '#calibrationProfileCancel');
  await waitFor(win, "!document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  return state;
}

async function runVisualAudit() {
  const win = await createRenderer();
  const states = [];
  const beforeActivation = await win.webContents.executeJavaScript(`({
    mountChildren: document.querySelector('#rangeCalibrationMount')?.childElementCount,
    controllerAvailable: Boolean(window.RiverlineRangeCalibration),
    liveWorkspace: Boolean(document.querySelector('#rangeCalibrationWorkspace')),
  })`);
  await activateCalibration(win);
  states.push(await capture(win, 'A-first-use-1920x1080-en', 'A. First use / no profiles'));

  await click(win, '#calibrationCreateFirstProfile');
  await waitFor(win, "document.querySelector('#calibrationProfileModal')?.classList.contains('show')");
  states.push(await capture(win, 'B-profile-creation-1920x1080-en', 'B. Profile creation'));
  await setFormValues(win, {
    '#calibrationProfileDisplayName': 'Friday Home Game',
    '#calibrationProfileDescription': 'A regular six-handed game with familiar opponents.',
    '#calibrationProfileEnvironment': 'home',
    '#calibrationModeName1': 'Standard',
    '#calibrationModeName2': 'Tight',
    '#calibrationModeName3': 'Pressure',
  });
  await submitProfileForm(win);
  states.push(await capture(win, 'C-existing-profile-1920x1080-en', 'C. Existing profile selected'));

  await win.webContents.executeJavaScript(`(() => {
    const assign = (selector, value) => {
      const element = document.querySelector(selector);
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    assign('#calibrationEnvironment', 'home');
    assign('#calibrationTableSize', '6');
    assign('#calibrationHeroPosition', 'BTN');
    assign('#calibrationEffectiveStack', '100');
  })()`);
  await settle(win);
  states.push(await capture(win, 'E-6max-btn-100bb-rfi-1920x1080-en', 'E. 6-max BTN 100bb RFI'));

  await click(win, '#calibrationEditProfile');
  await setFormValues(win, {
    '#calibrationProfileDisplayName': 'Friday Night Deep-Stack Home Game With the Same Familiar Lineup',
    '#calibrationProfileDescription': 'A deliberately long but valid description used to verify wrapping and resilient information hierarchy throughout the workspace.',
    '#calibrationModeName1': 'Measured baseline against unfamiliar opponents',
    '#calibrationModeName2': 'Patient adjustment when the table gets splashy',
    '#calibrationModeName3': 'Maximum pressure against overly cautious regulars',
  });
  states.push(await capture(win, 'M-profile-editor-long-1920x1080-en', 'M. Profile editor with long names'));
  await submitProfileForm(win);
  await waitFor(win, "!document.querySelector('#toast')?.classList.contains('show')", 5_000);
  states.push(await capture(win, 'D-long-names-1920x1080-en', 'D. Long profile and mode names'));

  await setViewport(win, 1024, 768);
  states.push(await captureProfileEditor(win, 'N-profile-editor-long-1024x768-en', 'N. Profile editor at 1024×768'));
  states.push(await capture(win, 'F-small-desktop-1024x768-en', 'F. Small desktop width'));

  await setViewport(win, 1280, 720);
  states.push(await captureProfileEditor(win, 'O-profile-editor-long-1280x720-en', 'O. Profile editor at 1280×720'));

  await setViewport(win, 2560, 1600);
  states.push(await captureProfileEditor(win, 'P-profile-editor-long-2560x1600-en', 'P. Profile editor at 2560×1600'));

  await setViewport(win, 1440, 900);
  await setLanguage(win, 'he');
  states.push(await capture(win, 'G-hebrew-rtl-1440x900', 'G. Hebrew RTL'));
  states.push(await captureProfileEditor(win, 'Q-profile-editor-hebrew-rtl-1440x900', 'Q. Profile editor Hebrew RTL'));

  await setLanguage(win, 'ru');
  states.push(await capture(win, 'H-russian-1440x900', 'H. Russian'));
  states.push(await captureProfileEditor(win, 'R-profile-editor-russian-1440x900', 'R. Profile editor Russian'));

  await setViewport(win, 1920, 1080);
  await setLanguage(win, 'en');
  await setTheme(win, 'daylight');
  states.push(await capture(win, 'I-daylight-theme-1920x1080-en', 'I. Alternate Riverline theme'));
  states.push(await captureProfileEditor(win, 'S-profile-editor-daylight-1920x1080-en', 'S. Profile editor Daylight theme'));
  win.webContents.setZoomFactor(1.25);
  await settle(win);
  states.push(await captureProfileEditor(win, 'T-profile-editor-125pct-1920x1080-en', 'T. Profile editor at 125% zoom'));
  win.webContents.setZoomFactor(1);
  await settle(win);

  await win.webContents.executeJavaScript(`(() => {
    const stack = document.querySelector('#calibrationEffectiveStack');
    stack.value = '999';
    stack.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await settle(win);
  const validation = await win.webContents.executeJavaScript(`({
    invalid: document.querySelector('#calibrationEffectiveStack')?.getAttribute('aria-invalid'),
    error: document.querySelector('#calibrationStackError')?.textContent,
    preview: document.querySelector('#calibrationPreviewSpot')?.textContent,
  })`);

  await click(win, '[data-mode="gto"]');
  const hiddenMount = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getPerformanceReport()');
  return { beforeActivation, states, validation, hiddenMount };
}

async function seedProfiles(win, count) {
  if (!count) return;
  await win.webContents.executeJavaScript(`(async () => {
    const { createRangeCalibrationApplication } = await import('./src/application/range-calibration-service.mjs');
    const application = createRangeCalibrationApplication();
    for (let index = 0; index < ${count}; index += 1) {
      application.createProfile({
        displayName: 'Library profile ' + String(index + 1).padStart(3, '0'),
        description: 'Synthetic performance fixture ' + (index + 1),
        environment: index % 2 ? 'clubgg' : 'home',
        modeNames: ['Standard ' + (index + 1), 'Tight ' + (index + 1), 'Pressure ' + (index + 1)],
      });
    }
  })()`);
}

async function measureLibrary(profileCount) {
  const win = await createRenderer({ width: 1440, height: 900 });
  await seedProfiles(win, profileCount);
  const before = await win.webContents.executeJavaScript(`({
    documentNodes: document.querySelectorAll('*').length,
    mountChildren: document.querySelector('#rangeCalibrationMount')?.childElementCount,
    liveWorkspace: Boolean(document.querySelector('#rangeCalibrationWorkspace')),
  })`);
  await activateCalibration(win);
  const performance = await win.webContents.executeJavaScript('window.RiverlineRangeCalibration.getPerformanceReport()');
  const storageBytes = await win.webContents.executeJavaScript(`(() => {
    let characters = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      characters += key.length + (localStorage.getItem(key)?.length || 0);
    }
    return characters * 2;
  })()`);
  const after = await win.webContents.executeJavaScript(`({
    documentNodes: document.querySelectorAll('*').length,
    mountChildren: document.querySelector('#rangeCalibrationMount')?.childElementCount,
    state: document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState,
  })`);
  win.destroy();
  windows.delete(win);
  return { profileCount, before, after, storageBytes, performance };
}

function createStaticServer() {
  const types = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relativePath || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

function collectFindings(report) {
  const findings = [];
  if (report.visual.beforeActivation.mountChildren !== 0 || report.visual.beforeActivation.liveWorkspace) {
    findings.push('Calibration DOM was live before first activation.');
  }
  for (const state of report.visual.states) {
    if (state.documentOverflowX > 1 || state.horizontalOverflows.length) findings.push(`${state.label}: horizontal overflow detected.`);
    if (state.modalOpen && !state.modalFullyInViewport) findings.push(`${state.label}: modal is not fully in the viewport.`);
    if (state.profileEditorGeometry) {
      const geometry = state.profileEditorGeometry;
      if (geometry.fieldsetBorderTop !== '0px' || !geometry.legendClearsModePanel) findings.push(`${state.label}: mode legend still collides with a border.`);
      if (!geometry.footerBelowBody || !geometry.footerReachable) findings.push(`${state.label}: profile-editor footer is not reachable.`);
      if (geometry.modeInputCount !== 3) findings.push(`${state.label}: profile-editor mode fields are invalid.`);
      if (state.state === 'configured' && geometry.modeValueLengths.some((length) => length === 0)) findings.push(`${state.label}: profile-editor mode fields lost user data.`);
      if (geometry.modalOverflows.length) findings.push(`${state.label}: profile-editor control overflow detected.`);
    }
    if (state.state === 'configured' && (state.modeCount !== 3 || state.activeModeCount !== 1)) findings.push(`${state.label}: mode selection invariant failed.`);
    if (state.state === 'configured' && state.startQuestionsDisabled) findings.push(`${state.label}: question action is unexpectedly disabled.`);
  }
  const hebrew = report.visual.states.find((state) => state.label.startsWith('G.'));
  if (hebrew?.direction !== 'rtl' || hebrew?.pokerTokenDirection !== 'ltr') findings.push('Hebrew direction or poker-token isolation failed.');
  if (report.visual.validation.invalid !== 'true' || !report.visual.validation.error) findings.push('Invalid effective stack did not expose an accessible error.');
  for (const sample of report.performance) {
    if (sample.performance.repositoryReadsDuringActivation !== 1) findings.push(`${sample.profileCount}-profile activation used ${sample.performance.repositoryReadsDuringActivation} repository reads.`);
    if (sample.before.mountChildren !== 0 || sample.before.liveWorkspace) findings.push(`${sample.profileCount}-profile library mounted workspace DOM before activation.`);
  }
  if (rendererErrors.length) findings.push(`${rendererErrors.length} renderer console error(s) were emitted.`);
  return findings;
}

app.whenReady().then(async () => {
  fs.mkdirSync(artifactRoot, { recursive: true });
  server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const report = {
    schemaVersion: 'range-cal001a-renderer-audit/v1',
    renderer: `Electron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
    visual: await runVisualAudit(),
    performance: [],
    rendererErrors,
  };
  for (const profileCount of [0, 12, 100]) report.performance.push(await measureLibrary(profileCount));
  report.findings = collectFindings(report);
  fs.writeFileSync(path.join(artifactRoot, 'renderer-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: report.schemaVersion,
    renderer: report.renderer,
    states: report.visual.states.map(({ label, viewport, language, direction, theme, documentOverflowX, horizontalOverflows, modalFullyInViewport, modeCount, activeModeCount, contextPreview, screenshot }) => ({ label, viewport, language, direction, theme, documentOverflowX, horizontalOverflowCount: horizontalOverflows.length, modalFullyInViewport, modeCount, activeModeCount, contextPreview, screenshot })),
    validation: report.visual.validation,
    hiddenMount: report.visual.hiddenMount,
    performance: report.performance,
    rendererErrors,
    findings: report.findings,
  }, null, 2)}\n`);
  for (const win of [...windows]) if (!win.isDestroyed()) win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(report.findings.length ? 2 : 0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  for (const win of [...windows]) if (!win.isDestroyed()) win.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});
