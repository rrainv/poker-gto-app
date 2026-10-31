#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-equity-closeout001-'));
const errors = [];

function staticServer() {
  const contentTypes = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    return fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
      return response.end(data);
    });
  });
}

async function settle(page, milliseconds = 80) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function replaceCardSet(page, opener, cards) {
  await page.click(opener);
  const selected = await page.evaluate(() => [...document.querySelectorAll('[data-deck-card].is-selected')]
    .map((control) => control.dataset.deckCard));
  for (const card of selected) if (!cards.includes(card)) await page.click(`[data-deck-card="${card}"]`);
  for (const card of cards) if (!selected.includes(card)) await page.click(`[data-deck-card="${card}"]`);
  await page.click('[data-card-set-action="apply"]');
  await settle(page);
}

async function calculate(page) {
  await page.select('#calcStyle', 'sim');
  await page.select('#trials', '10000');
  await page.click('#calculate');
  await page.waitForFunction(() => window.app.equity.lifecycle === 'complete', { timeout: 30_000 });
  await settle(page, 150);
}

async function snapshot(page, label) {
  const screenshot = path.join(artifactRoot, `${label}.png`);
  await page.screenshot({ path: screenshot, type: 'png', fullPage: false });
  const state = await page.evaluate(() => {
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom) };
    };
    return {
      lifecycle: window.app.equity.lifecycle,
      pageScrollY: scrollY,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      workspace: rect(document.querySelector('.equity-workspace')),
      playerPanel: rect(document.querySelector('.equity-player-panel')),
      center: rect(document.querySelector('.equity-center-column')),
      analysis: rect(document.querySelector('#equityHandAnalysis')),
      boardAnalysis: rect(document.querySelector('.equity-board-analysis')),
      playerAnalysisCards: [...document.querySelectorAll('.equity-player-analysis')].map(rect),
      equityValues: [...document.querySelectorAll('.equity-analysis-equity strong')].map((node) => node.textContent.trim()),
      winTieMetricCount: document.querySelectorAll('.equity-analysis-secondary-metrics > div').length,
      preflopHands: [...document.querySelectorAll('.equity-current-hand[data-street="preflop"] .equity-current-hand-title > strong')].map((node) => node.textContent.trim()),
      statusCount: document.querySelectorAll('.equity-standing').length,
      boardAnalysisCount: document.querySelectorAll('.equity-board-analysis').length,
      catchUpText: document.querySelector('#equityHandAnalysisContent')?.textContent || '',
      staleVisible: Boolean(document.querySelector('.equity-analysis-stale')),
      overviewVisible: getComputedStyle(document.querySelector('#equityResultsPanel')).display !== 'none',
    };
  });
  return { label, screenshot, ...state };
}

function assertState(condition, message, states) {
  if (!condition) throw new Error(`${message}\n${JSON.stringify(states, null, 2)}`);
}

const server = staticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
const states = [];
try {
  browser = await puppeteer.launch({
    browser: 'firefox', executablePath: firefoxPath, headless: true,
    extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(`page: ${error}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineEquity));
  await page.click('.mode-nav-item[data-navigation-id="equity"]');
  await page.waitForFunction(() => document.querySelector('.mode-nav-item[data-navigation-id="equity"]')?.getAttribute('aria-current') === 'page');

  await replaceCardSet(page, '[data-equity-edit-hand="equity-player-0"]', ['Ah', 'Kh']);
  await page.click('[data-equity-hand-mode="known"][data-player-id="equity-player-1"]');
  await replaceCardSet(page, '[data-equity-edit-hand="equity-player-1"]', ['Js', 'Ts']);
  await calculate(page);
  states.push(await snapshot(page, 'preflop-two-player'));

  await replaceCardSet(page, '[data-equity-edit-hand="equity-player-0"]', ['9h', '8h']);
  await replaceCardSet(page, '[data-equity-edit-hand="equity-player-1"]', ['7d', '6c']);
  await replaceCardSet(page, '[data-card-set-edit="eqboard"][data-card-set-index="0"]', ['7h', '6h', '7c']);
  await replaceCardSet(page, '[data-slots="eqdead"] [data-index="0"]', ['5h']);
  await calculate(page);
  states.push(await snapshot(page, 'flop-two-player'));

  await replaceCardSet(page, '[data-card-set-edit="eqboard"][data-card-set-index="3"]', ['2d']);
  states.push(await snapshot(page, 'stale-after-turn-edit'));

  await page.click('[data-slots="eqdead"] [data-index="1"]');
  const pickerTiming = await page.evaluate(async () => {
    const control = document.querySelector('[data-deck-card="As"]');
    const modal = document.querySelector('#cardModal');
    const started = performance.now();
    control.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      twoFrameMilliseconds: Number((performance.now() - started).toFixed(2)),
      transitionProperty: getComputedStyle(control).transitionProperty,
      boxShadow: getComputedStyle(control).boxShadow,
      backdropFilter: getComputedStyle(modal).backdropFilter,
      selected: control.classList.contains('is-selected'),
    };
  });
  await page.click('[data-card-set-action="cancel"]');

  const preflop = states.find(({ label }) => label === 'preflop-two-player');
  const flop = states.find(({ label }) => label === 'flop-two-player');
  const stale = states.find(({ label }) => label === 'stale-after-turn-edit');
  assertState(preflop.lifecycle === 'complete' && preflop.equityValues.length === 2 && preflop.winTieMetricCount === 4,
    'Preflop did not expose Equity plus Win/Tie for both players.', states);
  assertState(preflop.preflopHands.some((hand) => hand.includes('AKs')) && preflop.preflopHands.some((hand) => hand.includes('JTs')),
    'Preflop exact hand classes were not presented.', states);
  assertState(preflop.statusCount === 0 && !/catch-up|ahead now|behind now/i.test(preflop.catchUpText),
    'Preflop claimed postflop standing or catch-up facts.', states);
  assertState(preflop.playerAnalysisCards.every((card) => card.bottom <= 1080) && preflop.horizontalOverflow <= 0,
    'Preflop primary analysis did not fit the 1920x1080 first viewport.', states);
  assertState(flop.boardAnalysisCount === 1 && flop.statusCount === 2 && flop.playerAnalysisCards.length === 2,
    'Flop did not show one Board Analysis band and two status-bearing player cards.', states);
  assertState(/Catch-up cards/i.test(flop.catchUpText) && /still behind/i.test(flop.catchUpText),
    'Flop did not preserve catch-up versus structural-still-behind evidence.', states);
  assertState(flop.playerAnalysisCards.every((card) => card.bottom <= 1080) && flop.horizontalOverflow <= 0,
    'Flop primary analysis did not fit the 1920x1080 first viewport.', states);
  assertState(stale.lifecycle === 'pending' && stale.staleVisible && stale.equityValues.length === 2,
    'Committed edit did not retain visible stale analysis values.', states);
  assertState(!preflop.overviewVisible && !flop.overviewVisible, 'The bottom Equity Overview remained a visible dependency.', states);
  assertState(pickerTiming.selected && pickerTiming.transitionProperty === 'none'
      && pickerTiming.boxShadow === 'none' && pickerTiming.backdropFilter === 'none',
  `Dense picker paint costs remain active: ${JSON.stringify(pickerTiming)}`, states);
  assertState(errors.length === 0, `Firefox emitted errors: ${errors.join(' | ')}`, states);

  console.log(JSON.stringify({
    schemaVersion: 'equity-closeout001-firefox-audit/v1',
    browser: await browser.version(),
    viewport: { width: 1920, height: 1080, zoom: '100%' },
    artifactRoot,
    states,
    pickerTiming,
    errors,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
