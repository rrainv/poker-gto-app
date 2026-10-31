#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-equity-composition001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const errors = [];

function staticServer() {
  const types = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    return fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      return response.end(data);
    });
  });
}

async function settle(page, milliseconds = 120) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function snapshot(page, label) {
  const state = await page.evaluate(() => {
    const visible = (element) => Boolean(element && !element.hidden
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden'
      && element.getClientRects().length > 0);
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!visible(element)) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width),
        height: Math.round(box.height), bottom: Math.round(box.bottom),
      };
    };
    const list = document.querySelector('#equityPlayers');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      lifecycle: window.app.equity.lifecycle,
      compositionState: document.querySelector('.equity-workspace')?.dataset.equityState,
      playerCount: window.app.equity.players.length,
      inputTileCount: document.querySelectorAll('.equity-player-card').length,
      nestedResultCount: document.querySelectorAll('.equity-player-card .equity-player-results').length,
      comparisonCount: document.querySelectorAll('#equityComparison .equity-player-results').length,
      outsCount: document.querySelectorAll('#equityComparison .equity-outs').length,
      playerList: list ? {
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
        clientWidth: list.clientWidth,
        scrollWidth: list.scrollWidth,
        overflowY: getComputedStyle(list).overflowY,
      } : null,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      workspace: rect('.equity-workspace'),
      players: rect('.equity-player-panel'),
      shared: rect('.equity-shared-flow'),
      board: rect('.equity-cards-panel'),
      method: rect('.equity-controls-panel'),
      input: rect('.equity-input-stack'),
      output: rect('.equity-output-stack'),
      results: rect('#equityResultsPanel'),
      details: rect('#equityDetails'),
      handDetails: rect('#equityHandDetails'),
      scenario: rect('#equityScenarioContext'),
    };
  });
  const screenshot = path.join(artifactRoot, `${label}.png`);
  await page.screenshot({ path: screenshot, type: 'png', fullPage: false });
  return { label, screenshot, ...state };
}

async function chooseCount(page, count) {
  await page.click(`[data-equity-player-count="${count}"]`);
  await page.waitForFunction((expected) => window.app.equity.players.length === expected, {}, count);
  await settle(page);
}

async function makeAllUnknown(page) {
  await page.evaluate(() => {
    window.app.equity.players.forEach((player) => {
      player.handMode = 'unknown';
      player.cards = [];
    });
    window.renderAllCards({ mode: 'equity' });
    window.setEquityPending();
  });
  await settle(page);
}

async function calculate(page) {
  await page.select('#calcStyle', 'sim');
  await page.select('#trials', '10000');
  await page.click('#calculate');
  await page.waitForFunction(() => document.querySelector('.equity-workspace')?.dataset.equityState === 'complete', {
    timeout: 30_000,
  });
  await settle(page, 220);
}

function assertState(condition, message) {
  if (!condition) throw new Error(message);
}

const server = staticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({
    browser: 'firefox', executablePath: firefoxPath, headless: true,
    extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(`page: ${error}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineEquity));
  await page.click('.mode-nav-item[data-navigation-id="equity"]');
  await page.waitForFunction(() => document.querySelector(
    '.mode-nav-item[data-navigation-id="equity"]',
  )?.getAttribute('aria-current') === 'page');
  await settle(page);

  const states = [];
  states.push(await snapshot(page, 'fresh-2-player'));
  await chooseCount(page, 6);
  states.push(await snapshot(page, 'setup-6-player'));
  await chooseCount(page, 9);
  states.push(await snapshot(page, 'setup-9-player'));
  await makeAllUnknown(page);
  await page.select('#calcStyle', 'sim');
  await page.select('#trials', '250000');
  await page.click('#calculate');
  await page.waitForFunction(() => document.querySelector('.equity-workspace')?.dataset.equityState === 'running');
  await settle(page, 180);
  states.push(await snapshot(page, 'running-9-player'));
  if (await page.$eval('#cancelEquity', (button) => !button.hidden)) await page.click('#cancelEquity');
  await page.waitForFunction(() => document.querySelector('.equity-workspace')?.dataset.equityState === 'empty');

  await chooseCount(page, 2);
  await makeAllUnknown(page);
  await calculate(page);
  states.push(await snapshot(page, 'complete-2-player'));

  await page.evaluate(() => {
    window.app.equity.players[0].handMode = 'known';
    window.app.equity.players[0].cards = ['Ah', 'Kh'];
    window.app.equity.players[1].handMode = 'known';
    window.app.equity.players[1].cards = ['As', 'Ad'];
    window.app.equity.board = ['Qh', 'Jh', '2c'];
    window.app.equity.dead = [];
    window.renderAllCards({ mode: 'equity' });
    window.setEquityPending();
  });
  await calculate(page);
  states.push(await snapshot(page, 'complete-known-flop'));

  await chooseCount(page, 6);
  await makeAllUnknown(page);
  await page.type('[data-equity-player-name="0"]', 'Alex');
  await calculate(page);
  states.push(await snapshot(page, 'complete-6-player'));
  await page.click('#equityDetails > summary');
  await settle(page);
  states.push(await snapshot(page, 'complete-6-player-details'));

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  await settle(page);

  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await settle(page);
  states.push(await snapshot(page, 'complete-6-player-1366'));

  await page.select('#langToggle', 'ru');
  await settle(page);
  states.push(await snapshot(page, 'complete-6-player-ru'));

  await page.select('#langToggle', 'he');
  await settle(page);
  states.push(await snapshot(page, 'complete-6-player-he-rtl'));

  const fresh = states.find(({ label }) => label === 'fresh-2-player');
  const six = states.find(({ label }) => label === 'setup-6-player');
  const nine = states.find(({ label }) => label === 'setup-9-player');
  const running = states.find(({ label }) => label === 'running-9-player');
  const completedTwo = states.find(({ label }) => label === 'complete-2-player');
  const knownFlop = states.find(({ label }) => label === 'complete-known-flop');
  const completedSix = states.find(({ label }) => label === 'complete-6-player');
  const narrow = states.find(({ label }) => label === 'complete-6-player-1366');
  const russian = states.find(({ label }) => label === 'complete-6-player-ru');
  const rtl = states.find(({ label }) => label === 'complete-6-player-he-rtl');

  assertState(fresh.playerCount === 2 && fresh.nestedResultCount === 0, 'fresh setup must keep results out of input tiles');
  assertState(fresh.players.x < fresh.board.x && fresh.board.x < fresh.method.x, 'desktop setup must keep Player Hands, Board, and Method in left-to-right order');
  assertState(fresh.board?.y < 800 && fresh.method?.y < 800, 'fresh Board and Method must be readily reachable');
  assertState(six.playerCount === 6 && six.playerList.clientHeight <= 500, 'six-player setup must remain bounded');
  assertState(nine.playerCount === 9 && nine.playerList.scrollHeight > nine.playerList.clientHeight, 'nine-player setup must scroll inside its bounded list');
  assertState(running.compositionState === 'running'
    && running.players.x === nine.players.x && running.players.width === nine.players.width
    && running.shared.x === nine.shared.x && running.shared.width === nine.shared.width,
  'running state must preserve the stable roster and main-work geometry');
  assertState(completedTwo.players.x === fresh.players.x && completedTwo.board.x === fresh.board.x && completedTwo.method.x === fresh.method.x,
    'completed state must preserve setup region placement');
  assertState(completedTwo.results.y >= Math.max(
    completedTwo.players.y + completedTwo.players.height,
    completedTwo.board.y + completedTwo.board.height,
    completedTwo.method.y + completedTwo.method.height,
  ), 'two-player results must render below the stable setup');
  assertState(completedTwo.comparisonCount === 2 && completedTwo.output.width > completedTwo.players.width, 'two-player result tiles must use the dedicated full-width result surface');
  assertState(knownFlop.handDetails === null && knownFlop.scenario === null, 'Equity must not restore legacy Outs or repeated Scenario surfaces');
  assertState(knownFlop.outsCount >= 1, 'supported known flop facts must expose first-class canonical Outs');
  assertState(completedSix.comparisonCount === 6 && completedSix.nestedResultCount === 0, 'multi-player comparison must remain independent of inputs');
  assertState(narrow.horizontalOverflow <= 0, '1366 completed state must not overflow horizontally');
  assertState(narrow.playerList.scrollWidth <= narrow.playerList.clientWidth, '1366 completed player rail must not require horizontal scrolling');
  assertState(russian.language === 'ru' && russian.horizontalOverflow <= 0, 'Russian state must remain overflow-free');
  assertState(rtl.direction === 'rtl' && rtl.horizontalOverflow <= 0, 'Hebrew RTL state must remain overflow-free');
  assertState(errors.length === 0, `Firefox emitted errors: ${errors.join(' | ')}`);

  console.log(JSON.stringify({
    schemaVersion: 'equity-composition001-firefox-audit/v1',
    browser: await browser.version(),
    artifactRoot,
    states,
    errors,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
