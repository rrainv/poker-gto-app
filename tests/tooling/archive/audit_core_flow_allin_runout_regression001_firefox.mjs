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
        'Cache-Control': 'no-store',
      });
      return response.end(data);
    });
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )));
}

async function choosePendingBoardCard(page, card) {
  await page.click('[data-slots="hand-board-chance"] [data-card-set-edit="hand-board-chance"]');
  await page.waitForSelector('#cardModal.show');
  await page.click(`#cardModal.show [data-deck-card="${card}"]`);
  await page.click('[data-card-set-action="apply"]');
  await page.waitForFunction(() => !document.querySelector('#cardModal')?.classList.contains('show'));
  await page.click('#handDealBoardButton');
  await settle(page);
}

const server = staticServer();
let browser = null;
try {
  if (!fs.existsSync(firefoxPath)) throw new Error(`Firefox is unavailable at ${firefoxPath}`);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: firefoxPath,
    headless: true,
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, {
    waitUntil: 'load',
  });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePlaybookState));
  await page.evaluate(() => {
    document.querySelector('.mode-nav-item[data-navigation-id="hand"]')?.click();
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 2,
      gameMode: 'home',
      stackBb: 10,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
    bridge.dealObservedHoleCards({
      'seat-0': ['Ah', 'Ad'],
      'seat-1': ['Kh', 'Kd'],
    });
    bridge.applyAction('call');
    bridge.applyAction('check');
    bridge.dealBoardCards(['Js', '7d', '2c']);
    bridge.applyAction('all_in');
    bridge.applyAction('call');
  });
  await page.waitForFunction(() => (
    window.RiverlinePlaybookState.getState()?.pendingChance?.type === 'deal_turn'
    && document.querySelector('#handChanceSection')?.hidden === false
  ));

  await page.evaluate(() => window.app.playbookHandDraft.board.splice(0, Infinity, 'Js'));
  await page.click('[data-slots="hand-board-chance"] [data-card-set-edit="hand-board-chance"]');
  await page.waitForSelector('#cardModal.show');
  const staleDraftCleared = await page.evaluate(() => (
    window.app.playbookHandDraft.board.length === 0
    && window.app.picker?.draft?.length === 0
  ));
  const exclusions = await page.evaluate(() => Object.fromEntries(
    ['Js', '7d', '2c', 'Ah', 'Ad', 'Kh', 'Kd'].map((card) => [
      card,
      document.querySelector(`#cardModal.show [data-deck-card="${card}"]`)?.disabled === true,
    ]),
  ));
  const noHeroDecisionAtTurn = await page.evaluate(() => ({
    actor: window.RiverlinePlaybookState.getState()?.actingPlayerId ?? null,
    legalActions: window.RiverlinePlaybookState.getLegalActions(),
    actionSectionHidden: document.querySelector('#handActionSection')?.hidden === true,
  }));
  await page.click('#closeModal');

  await choosePendingBoardCard(page, 'Qs');
  await page.waitForFunction(() => (
    window.RiverlinePlaybookState.getState()?.pendingChance?.type === 'deal_river'
  ));
  await choosePendingBoardCard(page, '9c');
  await page.waitForFunction(() => window.RiverlinePlaybookState.getState()?.phase === 'showdown');
  await page.click('#handResolveShowdownButton');
  await page.waitForFunction(() => window.RiverlinePlaybookState.getState()?.phase === 'terminal');

  const terminal = await page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    const state = bridge.getState();
    const source = bridge.createCanonicalHandReplaySource();
    return {
      phase: state.phase,
      board: state.board,
      uniqueKnownCount: new Set([
        ...state.board,
        ...state.players.flatMap((player) => player.holeCards),
      ]).size,
      boardEvents: source.events
        .filter((event) => event.operation === 'deal_board')
        .map((event) => event.payload.chanceEvent.cards),
    };
  });

  await page.click('#handCompletedReplayButton');
  await page.waitForFunction(() => (
    window.RiverlinePlaybookState.createReplayProjectionViewModel()?.readOnly === true
  ));
  const replayBoard = await page.evaluate(() => (
    window.RiverlinePlaybookState.getState()?.board.slice()
  ));
  await page.evaluate(() => window.RiverlinePlaybookState.returnReplayToEndpoint());
  await page.waitForFunction(() => (
    window.RiverlinePlaybookState.createReplayProjectionViewModel()?.atLive === true
  ));
  const returnedBoard = await page.evaluate(() => (
    window.RiverlinePlaybookState.getState()?.board.slice()
  ));

  const report = {
    browser: await browser.version(),
    viewport: '1920x1080@100%',
    staleDraftCleared,
    exclusions,
    noHeroDecisionAtTurn,
    terminal,
    replayBoard,
    returnedBoard,
    pageErrors,
  };
  const unexpectedPageErrors = pageErrors.filter((error) => !(
    error.includes('owner is null') && error.includes('bindEvents/<')
  ));
  const failures = [];
  if (!staleDraftCleared) failures.push('stale consumed draft remained selected');
  if (Object.values(exclusions).some((excluded) => !excluded)) failures.push('consumed card enabled');
  if (noHeroDecisionAtTurn.actor !== null || noHeroDecisionAtTurn.legalActions !== null
    || !noHeroDecisionAtTurn.actionSectionHidden) failures.push('Hero decision exposed during runout');
  if (terminal.phase !== 'terminal' || terminal.uniqueKnownCount !== 9) failures.push('invalid terminal state');
  if (JSON.stringify(terminal.boardEvents) !== JSON.stringify([
    ['Js', '7d', '2c'], ['Qs'], ['9c'],
  ])) failures.push('Replay chance events differ');
  if (JSON.stringify(replayBoard) !== JSON.stringify(terminal.board)
    || JSON.stringify(returnedBoard) !== JSON.stringify(terminal.board)) {
    failures.push('Replay mutated live board');
  }
  if (unexpectedPageErrors.length) failures.push('unexpected page errors');
  console.log(JSON.stringify({ ...report, unexpectedPageErrors, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
