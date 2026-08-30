#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-equity-player-header-'));

const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
  const filePath = path.resolve(repoRoot, relative || 'app/index.html');
  if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
  return fs.readFile(filePath, (error, data) => {
    if (error) return response.writeHead(404).end();
    const type = { '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript' }[path.extname(filePath)];
    response.writeHead(200, { 'Content-Type': type || 'application/octet-stream' });
    return response.end(data);
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app));
  await page.click('.mode-nav-item[data-navigation-id="equity"]');
  await page.click('#equityAddPlayer');
  await page.waitForSelector('[data-equity-player-name="2"]');

  const measurements = await page.evaluate(() => {
    const styleFields = (style) => Object.fromEntries([
      'display', 'alignItems', 'height', 'minHeight', 'lineHeight', 'paddingTop', 'paddingBottom',
      'marginTop', 'marginBottom', 'verticalAlign', 'position', 'top', 'bottom', 'transform',
      'fontFamily', 'fontSize', 'fontWeight', 'appearance',
    ].map((field) => [field, style[field]]));
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height, center: box.top + (box.height / 2) };
    };
    return [...document.querySelectorAll('[data-equity-player-name-label]')].slice(0, 3).map((labelControl) => {
      const identity = labelControl.closest('.equity-player-identity');
      const header = labelControl.closest('.equity-player-head');
      const marker = identity.querySelector('.series-marker');
      const remove = header.querySelector('.remove-player');
      return {
        label: labelControl.textContent.trim(),
        name: { ...rect(labelControl), styles: styleFields(getComputedStyle(labelControl)) },
        identity: { ...rect(identity), styles: styleFields(getComputedStyle(identity)) },
        header: { ...rect(header), styles: styleFields(getComputedStyle(header)) },
        marker: rect(marker),
        remove: remove ? { ...rect(remove), styles: styleFields(getComputedStyle(remove)) } : null,
      };
    });
  });

  const header = await page.$('.equity-player-panel');
  const screenshot = path.join(artifactRoot, 'player-headers.png');
  await header.screenshot({ path: screenshot, type: 'png' });
  assert.deepEqual(measurements.map(({ label }) => label), ['Hero', 'Player 2', 'Player 3']);
  for (const measurement of measurements) {
    assert.equal(measurement.header.styles.paddingTop, '0px', `${measurement.label} inherited top padding`);
    assert.equal(measurement.header.styles.paddingBottom, '0px', `${measurement.label} inherited bottom padding`);
    assert.ok(Math.abs(measurement.name.center - measurement.header.center) <= 1, `${measurement.label} text box is not centered`);
    assert.ok(Math.abs(measurement.marker.center - measurement.header.center) <= 1, `${measurement.label} marker is not centered`);
    if (measurement.remove) assert.ok(Math.abs(measurement.remove.center - measurement.header.center) <= 1, 'Remove is not centered');
  }

  const before = await page.evaluate(() => ({
    playerId: window.app.equity.players[0].id,
    handMode: window.app.equity.players[0].handMode,
    lifecycle: window.app.equity.lifecycle,
    request: equityRequestFromCurrentInputs(),
  }));
  await page.evaluate(() => {
    const host = document.querySelector('#equityHandAnalysisContent');
    host.insertAdjacentHTML('beforeend', `<section data-player-id="equity-player-0"><span class="equity-player-analysis-title"><strong>Hero</strong></span></section>`);
  });
  await page.click('[data-equity-player-name-label="0"]');
  const opened = await page.evaluate(() => {
    const input = document.querySelector('[data-equity-player-name="0"]');
    return { hidden: input.hidden, focused: document.activeElement === input, selection: [input.selectionStart, input.selectionEnd] };
  });
  assert.deepEqual(opened, { hidden: false, focused: true, selection: [0, 0] });
  await page.type('[data-equity-player-name="0"]', 'Alex');
  await page.keyboard.press('Enter');
  const committed = await page.evaluate(() => ({
    playerId: window.app.equity.players[0].id,
    handMode: window.app.equity.players[0].handMode,
    lifecycle: window.app.equity.lifecycle,
    name: window.app.equity.players[0].name,
    label: document.querySelector('[data-equity-player-name-label="0"]').textContent.trim(),
    rightLabel: document.querySelector('[data-player-id="equity-player-0"] .equity-player-analysis-title strong').textContent.trim(),
    request: equityRequestFromCurrentInputs(),
    pickerOpen: document.querySelector('#cardModal')?.classList.contains('show') || false,
  }));
  assert.equal(committed.name, 'Alex');
  assert.equal(committed.label, 'Alex');
  assert.equal(committed.rightLabel, 'Alex');
  assert.equal(committed.playerId, before.playerId);
  assert.equal(committed.handMode, before.handMode);
  assert.equal(committed.lifecycle, before.lifecycle);
  assert.deepEqual(committed.request, before.request);
  assert.equal(committed.pickerOpen, false);

  await page.click('[data-equity-player-name-label="0"]');
  await page.keyboard.type('Discarded');
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => ({
    name: window.app.equity.players[0].name,
    label: document.querySelector('[data-equity-player-name-label="0"]').textContent.trim(),
  })), { name: 'Alex', label: 'Alex' });

  await page.click('[data-equity-player-name-label="0"]');
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => ({
    name: window.app.equity.players[0].name,
    label: document.querySelector('[data-equity-player-name-label="0"]').textContent.trim(),
  })), { name: '', label: 'Hero' });

  await page.click('[data-equity-player-name-label="1"]');
  await page.keyboard.type('Villain');
  await page.evaluate(() => document.querySelector('[data-equity-player-name="1"]').blur());
  assert.equal(await page.$eval('[data-equity-player-name-label="1"]', (node) => node.textContent.trim()), 'Villain');

  await page.click('[data-equity-player-name-label="2"]');
  const editingGeometry = await page.evaluate(() => {
    const input = document.querySelector('[data-equity-player-name="2"]');
    const header = input.closest('.equity-player-head').getBoundingClientRect();
    const marker = input.closest('.equity-player-identity').querySelector('.series-marker').getBoundingClientRect();
    const remove = input.closest('.equity-player-head').querySelector('.remove-player').getBoundingClientRect();
    const box = input.getBoundingClientRect();
    return {
      headerCenter: header.top + (header.height / 2), inputCenter: box.top + (box.height / 2),
      markerCenter: marker.top + (marker.height / 2), removeCenter: remove.top + (remove.height / 2),
      inputRight: box.right, removeLeft: remove.left,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  assert.ok(Math.abs(editingGeometry.inputCenter - editingGeometry.headerCenter) <= 1);
  assert.ok(Math.abs(editingGeometry.markerCenter - editingGeometry.headerCenter) <= 1);
  assert.ok(Math.abs(editingGeometry.removeCenter - editingGeometry.headerCenter) <= 1);
  assert.ok(editingGeometry.inputRight <= editingGeometry.removeLeft);
  assert.ok(editingGeometry.horizontalOverflow <= 0);
  await page.keyboard.press('Escape');

  console.log(JSON.stringify({
    browser: await browser.version(), viewport: '1920x1080 @ 100%', screenshot,
    measurements, interaction: { opened, committed, editingGeometry },
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
