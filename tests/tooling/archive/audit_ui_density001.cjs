#!/usr/bin/env node
'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const configurations = [
  { width: 1920, height: 1080, language: 'en', theme: 'midnight' },
  { width: 1024, height: 768, language: 'en', theme: 'midnight' },
  { width: 1024, height: 768, language: 'ru', theme: 'midnight' },
  { width: 1024, height: 768, language: 'he', theme: 'daylight' },
];

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

let server;

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

async function configure(win, configuration) {
  win.setContentSize(configuration.width, configuration.height);
  win.webContents.setZoomFactor(1);
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage(${JSON.stringify(configuration.language)});
    document.documentElement.dataset.theme = ${JSON.stringify(configuration.theme)};
  })()`);
  await settle(win);
}

async function measure(win, configuration) {
  return win.webContents.executeJavaScript(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const header = rect('.playbook-dead-card-header');
    const summary = rect('.playbook-card-state-summary');
    const clear = rect('.playbook-dead-card-header [data-card-clear-command="clear_dead_set"]');
    const label = rect('.playbook-dead-card-header > .playbook-card-state-copy > strong');
    const root = document.documentElement;
    return {
      configuration: ${JSON.stringify(configuration)},
      direction: root.dir,
      documentOverflowX: root.scrollWidth > root.clientWidth + 1,
      header,
      summary,
      clear,
      label,
      summaryClearOverlap: overlaps(summary, clear),
      clearVisible: Boolean(clear && clear.width > 0 && clear.height > 0 && clear.left >= 0 && clear.right <= innerWidth && clear.top >= 0 && clear.bottom <= innerHeight),
      summaryWithinHeader: Boolean(summary && header && summary.left >= header.left && summary.right <= header.right && summary.top >= header.top && summary.bottom <= header.bottom),
    };
  })()`);
}

app.whenReady().then(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, webSecurity: false, offscreen: true },
  });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/app/index.html`);
  await waitFor(win, 'document.readyState === "complete" && Boolean(window.app) && Boolean(window.RiverlineI18n)');
  const results = [];
  const screenshots = [];
  for (const configuration of configurations) {
    await configure(win, configuration);
    const result = await measure(win, configuration);
    results.push(result);
    const screenshotPath = path.join(os.tmpdir(), `riverline-ui-density001-${configuration.width}x${configuration.height}-${configuration.language}-${configuration.theme}.png`);
    fs.writeFileSync(screenshotPath, (await win.webContents.capturePage()).toPNG());
    screenshots.push(screenshotPath);
  }
  const failures = results.filter((result) => result.documentOverflowX || result.summaryClearOverlap || !result.clearVisible || !result.summaryWithinHeader);
  process.stdout.write(`${JSON.stringify({ results, screenshots, failures }, null, 2)}\n`);
  win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(failures.length ? 1 : 0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});
