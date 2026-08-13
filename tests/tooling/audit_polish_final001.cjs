#!/usr/bin/env node
'use strict';

// POLISH-FINAL-001 bounded Electron renderer audit. It writes screenshots only
// to the operating-system temp directory and emits its geometry report to stdout.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const configurations = Object.freeze([
  { width: 1024, height: 768, language: 'en', theme: 'midnight' },
  { width: 1280, height: 900, language: 'en', theme: 'daylight' },
  { width: 1920, height: 1080, language: 'en', theme: 'midnight' },
  { width: 2560, height: 1600, language: 'he', theme: 'daylight' },
]);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

let server;
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
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function click(win, selector) {
  const found = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!found) throw new Error(`Missing click target: ${selector}`);
  await settle(win);
}

async function selectMode(win, mode) {
  await click(win, `[data-mode="${mode}"]`);
  const id = mode === 'info' ? 'infoMode' : `${mode}Mode`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
}

async function prepareTraining(win) {
  await selectMode(win, 'training');
  await win.webContents.executeJavaScript(`(() => {
    const seed = document.querySelector('#trainingSeedInput');
    seed.value = '424242';
    seed.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(win, '#trainingGenerateSeed');
  await waitFor(win, "document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0", 30_000);
  await click(win, '#trainingRevealHint');
  await win.webContents.executeJavaScript(`(() => {
    const solution = [...(window.app?.training?.currentSolution || [])].sort((a, b) => b.value - a.value);
    const action = solution[0]?.action?.type;
    [...document.querySelectorAll('#trainingGuessButtons button:not([hidden])')]
      .find((entry) => entry.dataset.action === action)?.click();
  })()`);
  await waitFor(win, "!document.querySelector('#trainingFeedback')?.hidden");
  await waitFor(win, "document.querySelectorAll('#trainingAnalysis .analysis-mini-card').length >= 2");
}

async function configure(win, configuration) {
  win.setContentSize(configuration.width, configuration.height);
  win.webContents.setZoomFactor(1);
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage(${JSON.stringify(configuration.language)});
    document.documentElement.dataset.theme = ${JSON.stringify(configuration.theme)};
  })()`);
  await settle(win);
}

async function measure(win, state, configuration) {
  return win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const visible = (element) => element && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0;
    const outside = [...document.querySelectorAll('.riverline-shell .panel, .modal-backdrop.show > .modal')]
      .filter(visible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
      .map(({ element, rect }) => ({
        selector: element.id ? '#' + element.id : '.' + [...element.classList].join('.'),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    const cards = [...document.querySelectorAll('.analysis-mini-card')].filter(visible);
    const cardStyles = cards.slice(0, 2).map((card) => {
      const style = getComputedStyle(card);
      return {
        text: card.getAttribute('aria-label'),
        direction: style.direction,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        width: Math.round(card.getBoundingClientRect().width * 10) / 10,
        height: Math.round(card.getBoundingClientRect().height * 10) / 10,
      };
    });
    const feedback = document.querySelector('#trainingFeedback');
    return {
      state: ${JSON.stringify(state)},
      target: ${JSON.stringify(configuration)},
      direction: root.dir,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflowX: root.scrollWidth > root.clientWidth + 1,
      outside,
      cardStyles,
      feedback: visible(feedback) ? {
        grade: feedback.dataset.grade,
        animationName: getComputedStyle(feedback).animationName,
        borderColor: getComputedStyle(feedback).borderInlineStartColor,
      } : null,
      focusedElement: document.activeElement?.id || null,
    };
  })()`);
}

function createServer() {
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
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

app.whenReady().then(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, webSecurity: false, offscreen: true },
  });
  await win.loadURL(`${baseUrl}/app/index.html`);
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineI18n)");
  await delay(1000);
  const audioConsoleErrors = [];
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 && /audio|sound|oscillator|gain/i.test(String(message))) audioConsoleErrors.push(String(message));
  });
  await win.webContents.executeJavaScript(`(() => {
    window.__polishAudioCalls = { playCardDeal: 0, playTrainingResult: 0, playHint: 0 };
    for (const name of Object.keys(window.__polishAudioCalls)) {
      const original = window.SoundFX[name].bind(window.SoundFX);
      window.SoundFX[name] = (...args) => {
        window.__polishAudioCalls[name] += 1;
        return original(...args);
      };
    }
  })()`);
  await prepareTraining(win);
  const audioAudit = await win.webContents.executeJavaScript(`(() => {
    const before = {
      enabled: window.SoundFX.isEnabled(),
      railPressed: document.querySelector('#audioToggleBtn')?.getAttribute('aria-pressed'),
      settingsPressed: document.querySelector('#audioSettingsSwitch')?.getAttribute('aria-pressed')
    };
    window.SoundFX.toggle();
    const disabled = {
      enabled: window.SoundFX.isEnabled(),
      stored: localStorage.getItem('appSoundEnabled'),
      railPressed: document.querySelector('#audioToggleBtn')?.getAttribute('aria-pressed'),
      settingsPressed: document.querySelector('#audioSettingsSwitch')?.getAttribute('aria-pressed')
    };
    window.SoundFX.toggle();
    const restored = {
      enabled: window.SoundFX.isEnabled(),
      stored: localStorage.getItem('appSoundEnabled'),
      railPressed: document.querySelector('#audioToggleBtn')?.getAttribute('aria-pressed'),
      settingsPressed: document.querySelector('#audioSettingsSwitch')?.getAttribute('aria-pressed')
    };
    return { calls: { ...window.__polishAudioCalls }, before, disabled, restored };
  })()`);

  const results = [];
  const screenshots = [];
  for (const configuration of configurations) {
    await configure(win, configuration);
    await selectMode(win, 'training');
    await delay(350);
    results.push(await measure(win, 'training-answered', configuration));
    const image = await win.webContents.capturePage();
    const screenshotPath = path.join(os.tmpdir(), `riverline-polish-${configuration.width}x${configuration.height}-${configuration.language}-${configuration.theme}.png`);
    fs.writeFileSync(screenshotPath, image.toPNG());
    screenshots.push(screenshotPath);

    await selectMode(win, 'gto');
    results.push(await measure(win, 'playbook', configuration));
    await selectMode(win, 'equity');
    results.push(await measure(win, 'equity-idle', configuration));
    await selectMode(win, 'info');
    results.push(await measure(win, 'guide', configuration));
    await click(win, '#openSettings');
    results.push(await measure(win, 'settings', configuration));
    await click(win, '#closeSettingsModal');
  }

  const findings = results.flatMap((result) => [
    ...(result.documentOverflowX ? [`${result.state}:global-horizontal-overflow`] : []),
    ...result.outside.map((entry) => `${result.state}:outside:${entry.selector}`),
    ...(result.state === 'training-answered' && result.cardStyles.length < 2 ? ['training-answered:inline-cards-missing'] : []),
  ].map((finding) => ({ target: result.target, finding })));
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'polish-final001-renderer-audit/v1',
    runCount: results.length,
    findingCount: findings.length,
    findings,
    audioAudit: { ...audioAudit, consoleErrors: audioConsoleErrors },
    screenshots,
    results,
  }, null, 2)}\n`);
  win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(findings.length ? 1 : 0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});
