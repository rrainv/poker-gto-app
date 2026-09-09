#!/usr/bin/env node

import fs from 'node:fs';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-beta-blocker-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const pageErrors = [];
const accountingSanity = process.argv.includes('--accounting');

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
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function settle(page, milliseconds = 180) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds > 0) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigate(page, navigationId) {
  await page.click(`.mode-nav-item[data-navigation-id="${navigationId}"]`);
  await page.waitForFunction((id) => document.documentElement.dataset.layoutWorkspace === id, {}, navigationId);
  await settle(page);
}

async function createHand(page, count, complete = false, anteBb = 0) {
  await page.evaluate(({ count, complete, anteBb }) => {
    const b = window.RiverlinePlaybookState;
    b.closeSavedHand(); b.resetHand();
    b.initializeHand({ tableSize: count, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0, buttonSeat: 0, anteType: anteBb ? 'big_blind' : 'none', anteBb, straddleBb: 0 });
    const cards = [['As','Ah'], ['Ks','Kh'], ['Qs','Qh'], ['Js','Jh'], ['Ts','Th'], ['9s','9h'], ['8c','8h'], ['7s','7h'], ['6s','6h'], ['5s','5h']];
    b.dealHoleCards(Object.fromEntries(b.getState().players.map((p, i) => [p.playerId, cards[i]])));
    if (complete) {
      const board = ['2c','3d','4h','8s','9c']; let cursor = 0;
      for (let guard = 0; guard < 128 && !b.getState().terminal.isTerminal; guard++) {
        const s = b.getState();
        if (s.pendingChance) { const n = s.pendingChance.type === 'deal_flop' ? 3 : 1; b.dealBoardCards(board.slice(cursor, cursor += n)); }
        else if (s.showdown?.status === 'ready') b.resolveShowdown();
        else { const a = b.getLegalActions(); b.applyAction(a.check.available ? 'check' : 'call'); }
      }
    }
    window.renderCanonicalHandWorkspace();
  }, { count, complete, anteBb });
  await settle(page);
}

async function assertHandVisible(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  const result = await page.evaluate(() => {
    const rect = selector => { const e = document.querySelector(selector), r = e?.getBoundingClientRect(); return r && getComputedStyle(e).display !== 'none' ? { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height } : null; };
    return { review: document.querySelector('#gtoMode').classList.contains('is-hand-review-open'),
      stage: rect('#handLiveStageHeader'), table: rect('#visual-table-container'), rail: rect('#handInteractionRail'),
      facts: rect('.hand-live-facts'), copy: rect('.hand-live-stage-copy'),
      historyParent: document.querySelector('#handHistorySection')?.parentElement?.id,
      scroll: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  assert.equal(result.review, false, label);
  for (const key of ['stage', 'table', 'rail']) assert.ok(result[key]?.width > 0 && result[key].height > 0, `${label}: missing ${key}`);
  assert.equal(result.historyParent, 'handInteractionRail', label);
  assert.ok(result.scroll <= result.viewport, `${label}: horizontal overflow`);
  assert.ok(result.stage.right <= result.rail.x + 1, `${label}: rail overlaps stage`);
  assert.ok(result.table.right <= result.rail.x + 1, `${label}: rail overlaps table`);
  const a = result.facts, b = result.copy;
  assert.ok(a.x >= b.right - 1 || a.y >= b.bottom - 1 || b.x >= a.right - 1 || b.y >= a.bottom - 1, `${label}: facts cover stage copy`);
  return result;
}

const server = staticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const findings = [];
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true, extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 } });
  const page = await browser.newPage();
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.app && window.RiverlinePlaybookState && window.RiverlineHandReview);
  await page.evaluate(() => { window.RiverlinePresentationTheme.apply('daylight'); window.setLanguage('en'); });
  await navigate(page, 'hand');
  if (await page.$('#gtoMode .tutorial-offer-actions button:first-child')) {
    await page.click('#gtoMode .tutorial-offer-actions button:first-child');
  }
  for (const [width, height] of (accountingSanity ? [[1920,1080]] : [[1366,768], [1920,1080]])) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    for (const count of (accountingSanity ? [2] : [2,6,10])) {
      await createHand(page, count);
      const label = `${width}x${height}-${count}max`;
      const measurement = await assertHandVisible(page, label);
      assert.ok(measurement.table.y < height && measurement.table.bottom <= height + 30, `${label}: table must fit the stage`);
      findings.push({ label, ...measurement });
      await page.screenshot({ path: path.join(artifactRoot, `${label}.png`), fullPage: true });
      await page.evaluate(() => {
        const b = window.RiverlinePlaybookState, board = ['2c','3d','4h','8s','9c']; let cursor = 0;
        for (let guard = 0; guard < 64 && b.getState().board.length < 5; guard++) {
          const s = b.getState();
          if (s.pendingChance) { const n = s.pendingChance.type === 'deal_flop' ? 3 : 1; b.dealBoardCards(board.slice(cursor, cursor += n)); }
          else { const a = b.getLegalActions(); b.applyAction(a.check.available ? 'check' : 'call'); }
        }
        window.renderCanonicalHandWorkspace();
      });
      await assertHandVisible(page, `${label}-river`);
      await page.screenshot({ path: path.join(artifactRoot, `${label}-river.png`), fullPage: true });
    }
  }
  for (const viaTraining of [false, true]) {
    await createHand(page, 2, true);
    const before = await page.evaluate(() => JSON.stringify(window.RiverlinePlaybookState.getState()));
    await page.click('#handCompletedReviewButton');
    await page.waitForSelector('#handReviewSurface:not([hidden])');
    await page.click('#handReviewAnalyze');
    await page.waitForFunction(() => window.RiverlinePlaybookState.getMode() === 'scenario');
    if (viaTraining) await navigate(page, 'training');
    await navigate(page, 'hand');
    findings.push({ label: `completed-review-analyze-${viaTraining ? 'training-' : ''}hand`, ...await assertHandVisible(page, 'completed lifecycle') });
    assert.equal(await page.evaluate(() => JSON.stringify(window.RiverlinePlaybookState.getState())), before);
  }
  // The product exposes Review for completed Hands only. Open an imported completed
  // Hand above a retained live Hand, then verify the actual mounted navigation path.
  for (const viaTraining of [false, true]) {
    await createHand(page, 2);
    const live = await page.evaluate(() => JSON.stringify(window.RiverlinePlaybookState.getState()));
    const raw = fs.readFileSync(path.join(repoRoot, 'tests/fixtures/hand-history/AllInCall.txt'), 'utf8');
    await page.evaluate(async raw => {
      const { importHandHistory } = await import('/app/src/application/hand-history-import.mjs');
      const result = await importHandHistory(raw);
      if (result.status !== 'complete') throw new Error(JSON.stringify(result.diagnostics));
      window.RiverlinePlaybookState.openImportedHand(result);
      window.dispatchEvent(new CustomEvent('riverline:imported-hand-opened'));
    }, raw);
    await page.waitForSelector('#handReviewSurface:not([hidden])');
    await page.click('#handReviewAnalyze');
    await page.waitForFunction(() => window.RiverlinePlaybookState.getMode() === 'scenario');
    if (viaTraining) await navigate(page, 'training');
    await navigate(page, 'hand');
    findings.push({ label: `import-review-analyze-${viaTraining ? 'training-' : ''}hand`, ...await assertHandVisible(page, 'import lifecycle') });
    assert.equal(await page.evaluate(() => JSON.stringify(window.RiverlinePlaybookState.getState())), live);
  }
  if (accountingSanity) {
    await createHand(page, 2, true, 1);
    assert.deepEqual(await page.evaluate(() => window.RiverlinePlaybookState.getState().players.map(p => p.currentStackMilliBb)), [102000, 98000]);
    await assertHandVisible(page, 'current-bba');
    const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests/fixtures/accounting-compatibility/pre-fix.json'), 'utf8'));
    const old = fixtures.bbaV2.terminal;
    await page.evaluate(async old => {
      await window.RiverlineSavedStudyObjects.importLibrary({ schemaVersion: 'saved-study-library-export/v1',
        exportedAt: '2026-09-08T00:00:00.000Z', ownerRef: old.ownerRef, objects: [old] });
      await window.openHomeSavedItem(old.id);
    }, old);
    await settle(page);
    assert.deepEqual(await page.evaluate(() => window.RiverlinePlaybookState.getState().players.map(p => p.currentStackMilliBb)), [102000, 98000]);
    if (await page.$('#handReviewSurface:not([hidden])')) await page.click('#handReviewReturn');
    await page.click('#handReplayPreviousButton');
    await settle(page);
    assert.equal(await page.evaluate(() => window.RiverlinePlaybookState.createReplayProjectionViewModel().readOnly), true);
    await page.screenshot({ path: path.join(artifactRoot, '1920x1080-legacy-bba-saved-replay.png'), fullPage: true });
    findings.push({ label: 'BBA current + legacy Saved import/reopen + read-only Replay', stacks: [102000, 98000] });
  }
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ artifactRoot, findings, pageErrors }, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

