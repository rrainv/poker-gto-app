#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';

function staticServer() {
  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    return fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      });
      return response.end(data);
    });
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function equityState(page, label) {
  await settle(page);
  return page.evaluate((currentLabel) => {
    const playerState = (player) => ({
      id: player.id,
      handMode: player.handMode,
      cards: [...player.cards],
    });
    const heroTile = document.querySelector('[data-player-id="equity-player-0"]');
    return {
      label: currentLabel,
      lifecycle: window.app.equity.lifecycle,
      players: window.app.equity.players.map(playerState),
      heroTileCards: [...heroTile.querySelectorAll('[data-card-id]')].map((card) => card.dataset.cardId),
      heroTileState: heroTile.dataset.handState,
      readinessState: document.querySelector('#equityReadiness').dataset.state,
      readiness: document.querySelector('#equityReadiness').textContent,
      calculateDisabled: document.querySelector('#calculate').disabled,
      modalOpen: document.querySelector('#cardModal').classList.contains('show'),
      resultState: document.querySelector('#equityResultsPanel').dataset.resultState,
    };
  }, label);
}

function assertState(condition, message, states) {
  if (!condition) throw new Error(`${message}\n${JSON.stringify(states, null, 2)}`);
}

async function applyHand(page, playerId, cards) {
  await page.click(`[data-equity-edit-hand="${playerId}"]`);
  const selected = await page.evaluate(() => [...document.querySelectorAll('[data-deck-card].is-selected')]
    .map((control) => control.dataset.deckCard));
  for (const card of selected) {
    if (!cards.includes(card)) await page.click(`[data-deck-card="${card}"]`);
  }
  for (const card of cards) {
    if (!selected.includes(card)) await page.click(`[data-deck-card="${card}"]`);
  }
  await page.click('[data-card-set-action="apply"]');
}

const server = staticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
const states = [];
const errors = [];
try {
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: firefoxPath,
    headless: true,
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

  states.push(await equityState(page, 'initial'));
  await applyHand(page, 'equity-player-0', ['Ah', 'Kh']);
  states.push(await equityState(page, 'hero-ah-kh-applied'));

  await page.click('[data-equity-hand-mode="known"][data-player-id="equity-player-1"]');
  states.push(await equityState(page, 'player-2-known-one-click'));
  if (states.at(-1).modalOpen) await page.click('[data-card-set-action="cancel"]');
  await page.click('[data-equity-hand-mode="unknown"][data-player-id="equity-player-1"]');
  states.push(await equityState(page, 'player-2-unknown-one-click'));
  await page.click('[data-equity-hand-mode="known"][data-player-id="equity-player-1"]');
  states.push(await equityState(page, 'player-2-known-again-one-click'));
  if (states.at(-1).modalOpen) await page.click('[data-card-set-action="cancel"]');
  await page.click('[data-equity-hand-mode="unknown"][data-player-id="equity-player-1"]');
  states.push(await equityState(page, 'valid-known-vs-unknown'));

  await page.click('#calculate');
  await page.waitForFunction(() => window.app.equity.lifecycle === 'complete', { timeout: 30_000 });
  states.push(await equityState(page, 'calculation-complete'));

  await applyHand(page, 'equity-player-0', ['Qh', 'Jh']);
  states.push(await equityState(page, 'hero-qh-jh-applied-after-result'));

  const applied = states.find(({ label }) => label === 'hero-ah-kh-applied');
  const known = states.find(({ label }) => label === 'player-2-known-one-click');
  const unknown = states.find(({ label }) => label === 'player-2-unknown-one-click');
  const knownAgain = states.find(({ label }) => label === 'player-2-known-again-one-click');
  const ready = states.find(({ label }) => label === 'valid-known-vs-unknown');
  const complete = states.find(({ label }) => label === 'calculation-complete');
  const edited = states.find(({ label }) => label === 'hero-qh-jh-applied-after-result');

  assertState(JSON.stringify(applied.heroTileCards) === JSON.stringify(['Ah', 'Kh']),
    'Hero tile did not render the applied Ah Kh hand immediately.', states);
  assertState(known.players[1].handMode === 'known' && known.modalOpen,
    'Player 2 did not become Known after one click.', states);
  assertState(unknown.players[1].handMode === 'unknown' && !unknown.modalOpen,
    'Player 2 did not become Unknown after one click.', states);
  assertState(knownAgain.players[1].handMode === 'known' && knownAgain.modalOpen,
    'Player 2 did not become Known again after one click.', states);
  assertState(ready.readinessState === 'ready' && !ready.calculateDisabled,
    'Known Hero versus unknown Player 2 did not enable Calculate.', states);
  assertState(complete.lifecycle === 'complete' && complete.resultState === 'complete',
    'Calculate did not complete.', states);
  assertState(JSON.stringify(edited.heroTileCards) === JSON.stringify(['Qh', 'Jh'])
      && edited.lifecycle === 'pending' && edited.resultState === 'empty'
      && edited.readinessState === 'ready' && !edited.calculateDisabled,
  'Post-result Hero edit did not render, invalidate, and re-derive readiness.', states);
  assertState(errors.length === 0, `Firefox emitted errors: ${errors.join(' | ')}`, states);

  console.log(JSON.stringify({
    schemaVersion: 'equity-functional-recovery001-firefox/v1',
    browser: await browser.version(),
    viewport: { width: 1920, height: 1080, zoom: '100%' },
    states,
    errors,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ states, errors }, null, 2));
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
