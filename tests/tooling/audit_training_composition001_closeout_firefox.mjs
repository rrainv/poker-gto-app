#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-training-closeout-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const consoleErrors = [];
const pageErrors = [];

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
      response.writeHead(200, {
        'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      });
      return response.end(data);
    });
  });
}

async function settle(page, milliseconds = 160) {
  await page.evaluate(() => new Promise((resolve) => (
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForReady(page) {
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready'
    && document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0,
  { timeout: 20_000 });
  await settle(page);
}

async function answerNormal(page) {
  await page.click('#trainingGuessButtons button:not([hidden])');
  await page.waitForFunction(() => window.app.training.lifecycle === 'feedback', {
    timeout: 20_000,
  });
  await settle(page);
}

async function normalState(page) {
  return page.evaluate(() => ({
    identity: {
      id: window.app.training.currentExercise?.id,
      seed: window.app.training.currentExercise?.seed,
      cards: window.app.training.currentExercise?.presentation?.heroCards,
      board: window.app.training.currentExercise?.presentation?.board,
      context: window.app.training.currentExercise?.decisionContext,
      legalActions: window.app.training.currentExercise?.legalActions,
      strategyResult: window.app.training.currentExercise?.strategyResult,
    },
    attemptKind: window.app.training.currentAttemptKind,
    stats: structuredClone(window.app.training.stats),
    gradeStats: structuredClone(window.app.training.gradeStats),
    bestStreak: window.app.training.bestStreak,
    servedCount: window.RiverlineTraining.getPracticePlannerState()?.servedCount,
    progress: document.querySelector('#trainingSessionProgress')?.textContent.trim(),
  }));
}

async function answerFullHand(page) {
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready', { timeout: 20_000 });
  const action = await page.evaluate(() => {
    const visible = (element) => element && !element.hidden && !element.disabled
      && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const available = [...document.querySelectorAll('#trainingGuessButtons [data-action]')]
      .filter(visible).map((button) => button.dataset.action);
    return ['check', 'call', 'bet', 'raise', 'all_in', 'fold']
      .find((candidate) => available.includes(candidate)) || null;
  });
  if (!action) throw new Error('No usable Full Hand action');
  await page.click(`#trainingGuessButtons [data-action="${action}"]`);
  if (action === 'bet' || action === 'raise') {
    await page.waitForFunction(() => document.querySelector('#trainingFullHandSizing')?.hidden === false);
    await page.click('.training-full-hand-sizing-submit');
  }
  await page.waitForFunction(() => ['ready', 'terminal'].includes(window.app.training.lifecycle), {
    timeout: 20_000,
  });
  await settle(page, 220);
}

async function reviewState(page) {
  return page.evaluate(() => {
    const visible = (element) => Boolean(element && !element.hidden
      && getComputedStyle(element).display !== 'none'
      && getComputedStyle(element).visibility !== 'hidden'
      && element.getClientRects().length > 0);
    const table = document.querySelector('#trainingFullHandTableMount #visual-table-container')
      ?.getBoundingClientRect();
    return {
      phase: document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase,
      table: table ? { width: Math.round(table.width), height: Math.round(table.height) } : null,
      tableProjection: document.querySelector('#trainingFullHandTableMount')?.dataset.tableProjection,
      horizontalTimelineVisible: visible(document.querySelector('#trainingFullHandTimeline')),
      verticalHistoryVisible: visible(document.querySelector('#trainingHistoryPanel')),
      verticalHistoryOpen: document.querySelector('#trainingHistoryPanel')?.open,
      historyCount: document.querySelectorAll('#trainingActionHistory li:not(.is-empty)').length,
      reviewVisible: visible(document.querySelector('#handReviewSurface')),
      selectedDecisionCount: document.querySelectorAll('#handReviewDecisionList button').length,
      factCount: document.querySelectorAll('.hand-review-decision-facts > div').length,
      source: document.querySelector('#handReviewSourceDetail')?.textContent.trim(),
      comparison: document.querySelector('#handReviewComparisonBadge')?.textContent.trim(),
      railSource: document.querySelector('#trainingReferenceSummaryValue')?.textContent.trim(),
      railSourceNote: document.querySelector('#trainingReferenceSummaryNote')?.textContent.trim(),
    };
  });
}

const server = staticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: firefoxPath,
    headless: true,
    extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 },
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, {
    waitUntil: 'load',
  });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineTraining));
  await page.click('.mode-nav-item[data-navigation-id="training"]');
  await page.waitForFunction(() => document.querySelector(
    '.mode-nav-item[data-navigation-id="training"]',
  )?.getAttribute('aria-current') === 'page');

  await page.click('#trainingNewHand');
  await waitForReady(page);
  const initial = await normalState(page);
  await answerNormal(page);
  const primaryAnswered = await normalState(page);
  await page.click('#trainingReplayDecisionBtn');
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready'
    && window.app.training.currentAttemptKind === 'replay');
  const replayReady = await normalState(page);
  await answerNormal(page);
  const replayAnswered = await normalState(page);
  await page.screenshot({
    path: path.join(artifactRoot, 'normal-replay-answered.png'),
    type: 'png',
  });
  await page.click('#trainingNextHandBtn');
  await waitForReady(page);
  const nextReady = await normalState(page);

  const sameIdentity = JSON.stringify(initial.identity) === JSON.stringify(replayReady.identity);
  const headlineAfterPrimary = JSON.stringify({
    stats: primaryAnswered.stats,
    gradeStats: primaryAnswered.gradeStats,
    bestStreak: primaryAnswered.bestStreak,
    servedCount: primaryAnswered.servedCount,
  });
  const headlineAfterReplay = JSON.stringify({
    stats: replayAnswered.stats,
    gradeStats: replayAnswered.gradeStats,
    bestStreak: replayAnswered.bestStreak,
    servedCount: replayAnswered.servedCount,
  });
  const normal = {
    initial,
    primaryAnswered,
    replayReady,
    replayAnswered,
    nextReady,
    sameIdentity,
    replayStatsUnchanged: headlineAfterPrimary === headlineAfterReplay,
    nextAdvancedExactlyOne: nextReady.servedCount === initial.servedCount + 1
      && nextReady.identity.id !== initial.identity.id,
  };

  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = true; });
  page.once('dialog', async (dialog) => dialog.accept());
  await page.click('[data-training-session-mode="full_hand"]');
  await page.click('#trainingNewHand');
  await page.waitForFunction(() => ['ready', 'terminal'].includes(window.app.training.lifecycle), {
    timeout: 20_000,
  });
  await settle(page, 300);
  const live = await reviewState(page);
  for (let decision = 0; decision < 30
    && await page.evaluate(() => window.app.training.lifecycle === 'ready'); decision += 1) {
    await answerFullHand(page);
  }
  if (!await page.evaluate(() => window.app.training.lifecycle === 'terminal')) {
    throw new Error('Full Hand did not reach terminal state within 30 Hero decisions');
  }
  await page.click('#trainingReviewHand');
  await page.waitForFunction(() => document.querySelector('#trainingWorkspace')
    ?.dataset.trainingFullHandPhase === 'review'
    && document.querySelector('#handReviewSurface')?.hidden === false, { timeout: 20_000 });
  await settle(page, 300);
  const review = await reviewState(page);
  await page.screenshot({ path: path.join(artifactRoot, 'full-hand-review.png'), type: 'png' });
  const fullHand = {
    live,
    review,
    geometryPreserved: review.table?.width >= (live.table?.width || 0) - 4
      && review.table?.height >= (live.table?.height || 0) - 4,
    verticalReviewPreserved: review.verticalHistoryVisible && review.verticalHistoryOpen
      && review.historyCount > 0 && !review.horizontalTimelineVisible,
    evidencePreserved: review.reviewVisible && review.selectedDecisionCount > 0
      && review.factCount > 0 && Boolean(review.source) && Boolean(review.comparison)
      && Boolean(review.railSource) && review.railSource !== 'Hidden until review'
      && Boolean(review.railSourceNote),
  };

  const failures = [
    ...(!normal.sameIdentity ? ['Replay did not retain the exact canonical decision'] : []),
    ...(!normal.replayStatsUnchanged ? ['Replay answer changed headline session statistics'] : []),
    ...(!normal.nextAdvancedExactlyOne ? ['Next after replay did not advance exactly one exercise'] : []),
    ...(!fullHand.geometryPreserved ? ['Full Hand Review table geometry shrank'] : []),
    ...(!fullHand.verticalReviewPreserved ? ['Full Hand Review did not retain vertical-only history'] : []),
    ...(!fullHand.evidencePreserved ? ['Full Hand Review evidence was incomplete'] : []),
    ...(pageErrors.length ? [`Page errors: ${pageErrors.join(' | ')}`] : []),
    ...(consoleErrors.length ? [`Console errors: ${consoleErrors.join(' | ')}`] : []),
  ];
  const result = {
    browser: await browser.version(),
    viewport: [1920, 1080],
    zoom: '100%',
    normal,
    fullHand,
    pageErrors,
    consoleErrors,
    failures,
    artifactRoot,
  };
  fs.writeFileSync(path.join(artifactRoot, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    browser: result.browser,
    viewport: result.viewport,
    zoom: result.zoom,
    normal: {
      sameIdentity: normal.sameIdentity,
      replayStatsUnchanged: normal.replayStatsUnchanged,
      nextAdvancedExactlyOne: normal.nextAdvancedExactlyOne,
      primaryStats: primaryAnswered.stats,
      replayStats: replayAnswered.stats,
      primaryServedCount: primaryAnswered.servedCount,
      replayServedCount: replayAnswered.servedCount,
      nextServedCount: nextReady.servedCount,
    },
    fullHand,
    pageErrors,
    consoleErrors,
    failures,
    artifactRoot,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
