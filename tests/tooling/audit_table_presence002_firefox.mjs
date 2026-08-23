#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-table-presence002-'));
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
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function settle(page, milliseconds = 280) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigateHand(page) {
  await page.click('.mode-nav-item[data-navigation-id="hand"]');
  await page.waitForFunction(() => document.documentElement.dataset.layoutWorkspace === 'hand');
  await settle(page);
}

async function configurePresentation(page, { theme, density, layout, language, cards = null }) {
  await page.evaluate(({ theme: nextTheme, density: nextDensity, layout: nextLayout, language: nextLanguage, cards: nextCards }) => {
    window.RiverlinePresentationTheme.apply(nextTheme);
    window.RiverlinePresentationDensity.apply(nextDensity);
    window.RiverlinePresentationLayout.apply(nextLayout);
    window.setLanguage(nextLanguage);
    if (nextCards) window.RiverlineCardPresentation.apply(nextCards);
  }, { theme, density, layout, language, cards });
  await page.waitForFunction(
    ({ theme: nextTheme, density: nextDensity, layout: nextLayout, language: nextLanguage }) => (
      document.documentElement.dataset.presentationThemeId === nextTheme
      && document.documentElement.dataset.density === nextDensity
      && document.documentElement.dataset.layoutPreset === nextLayout
      && document.documentElement.lang === nextLanguage
    ),
    {},
    { theme, density, layout, language },
  );
  await settle(page);
}

async function createHand(page, { playerCount, completed = false }) {
  const result = await page.evaluate(({ playerCount: count, completed: shouldComplete }) => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: count,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
    const heroPlayerId = bridge.getHeroPlayerId();
    bridge.dealObservedHoleCards({ [heroPlayerId]: ['Ts', '9h'] });
    let guard = 0;
    while (shouldComplete && !bridge.getState()?.terminal?.isTerminal && guard < count + 3) {
      const legal = bridge.getLegalActions();
      if (legal?.fold?.available) bridge.applyAction('fold');
      else if (legal?.check?.available) bridge.applyAction('check');
      else if (legal?.call?.available) bridge.applyAction('call');
      else break;
      guard += 1;
    }
    const state = bridge.getState();
    return {
      terminal: state?.terminal?.isTerminal === true,
      status: state?.terminal?.isTerminal ? 'terminal' : 'live',
      frames: bridge.createReplayProjectionViewModel()?.totalFrameCount || 0,
    };
  }, { playerCount, completed });
  if (completed && !result.terminal) throw new Error(`Could not reach ${playerCount}-player terminal state`);
  await page.waitForFunction((count) => (
    document.querySelector('#visual-table-container')?.dataset.tableGeometryFamily
    && document.querySelectorAll('#visual-table-container .table-seat').length === count
  ), {}, playerCount);
  await settle(page);
  return result;
}

async function enterReplayWithKeyboard(page) {
  const controls = await page.$$('#handActionHistory .replay-timeline-seek[data-frame-index]');
  if (controls.length < 2) throw new Error('Expected at least two direct-seek timeline controls');
  await controls[Math.max(0, controls.length - 2)].focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.RiverlinePlaybookState.createReplayProjectionViewModel()?.readOnly === true);
  await settle(page);
}

async function inspect(page, label) {
  return page.evaluate((stateLabel) => {
    const visible = (element) => element && getComputedStyle(element).display !== 'none'
      && element.getClientRects().length > 0;
    const rect = (element) => {
      if (!visible(element)) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left), right: Math.round(bounds.right),
        top: Math.round(bounds.top), bottom: Math.round(bounds.bottom),
        width: Math.round(bounds.width), height: Math.round(bounds.height),
      };
    };
    const overlaps = (left, right) => left && right
      && Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
      && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
    const seats = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .map((seat) => ({
        id: seat.id,
        bounds: rect(seat),
        prominence: seat.dataset.prominence,
        opacity: getComputedStyle(seat).opacity,
        folded: seat.classList.contains('is-folded'),
        actor: seat.classList.contains('is-actor'),
        hero: seat.classList.contains('is-hero'),
      }));
    const seatOverlaps = [];
    for (let left = 0; left < seats.length; left += 1) {
      for (let right = left + 1; right < seats.length; right += 1) {
        if (overlaps(seats[left].bounds, seats[right].bounds)) {
          seatOverlaps.push(`${seats[left].id}:${seats[right].id}`);
        }
      }
    }
    const table = rect(document.querySelector('#visual-table-container'));
    const dock = rect(document.querySelector('#handStageDock'));
    const timeline = rect(document.querySelector('#handTimelineStage'));
    const wrapper = document.querySelector('#table-wrapper');
    const activeView = document.querySelector('.mode-view.active');
    const horizontalOverflows = activeView ? [...activeView.querySelectorAll('button, input, select, strong, p')]
      .filter(visible)
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1;
      })
      .map((element) => element.id || element.className || element.tagName) : [];
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      theme: document.documentElement.dataset.presentationThemeId,
      density: document.documentElement.dataset.density,
      layout: document.documentElement.dataset.layoutPreset,
      language: document.documentElement.lang,
      direction: document.documentElement.dir || 'ltr',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      projection: wrapper?.dataset.tableProjection,
      visualState: wrapper?.dataset.tableVisualState,
      geometryFamily: wrapper?.dataset.tableGeometryFamily,
      table,
      dock,
      timeline,
      dockWithinViewport: dock ? dock.top >= -1 && dock.bottom <= innerHeight + 1 : null,
      tableDominance: table ? Number((table.width / innerWidth).toFixed(3)) : null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      seatOverlaps,
      seats,
      foldedCount: seats.filter((seat) => seat.folded).length,
      currentActorCount: seats.filter((seat) => seat.actor).length,
      heroBottom: seats.find((seat) => seat.hero)?.bounds?.bottom ?? null,
      dealerVisible: Boolean(document.querySelector('.table-dealer-button:not([hidden])')),
      textureOpacity: getComputedStyle(document.querySelector('.table-felt-texture')).opacity,
      timelineSeekCount: document.querySelectorAll('#handActionHistory .replay-timeline-seek').length,
      focusedTimelineSeek: document.activeElement?.classList?.contains('replay-timeline-seek') ?? false,
    };
  }, label);
}

async function capture(page, spec) {
  await page.setViewport({ width: spec.viewport[0], height: spec.viewport[1], deviceScaleFactor: 1 });
  await configurePresentation(page, spec);
  await createHand(page, spec);
  if (spec.replay) await enterReplayWithKeyboard(page);
  await page.$eval('#handLiveStageHeader', (element) => element.scrollIntoView({ block: 'start' }));
  await settle(page);
  const finding = await inspect(page, spec.label);
  const screenshot = path.join(artifactRoot, `${spec.id}.png`);
  await page.screenshot({ path: screenshot, type: 'png' });
  return { ...finding, screenshot };
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
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app)
    && Boolean(window.RiverlinePlaybookState)
    && Boolean(window.RiverlinePresentationTheme));
  await navigateHand(page);

  const specs = [
    { id: 'hu-live-1920x1080-midnight-en', label: 'HU live', viewport: [1920, 1080], playerCount: 2, completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'hu-complete-1920x1080-daylight-he', label: 'HU completed', viewport: [1920, 1080], playerCount: 2, completed: true, replay: false, theme: 'daylight', density: 'compact', layout: 'table-focus', language: 'he', cards: { faceStyle: 'high-contrast', backStyle: 'geometric', rankStyle: 'full-ten', fourColor: true } },
    { id: 'six-live-2560x1440-midnight-en', label: '6-max live', viewport: [2560, 1440], playerCount: 6, completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'table-focus', language: 'en' },
    { id: 'six-complete-2560x1440-daylight-he', label: '6-max completed', viewport: [2560, 1440], playerCount: 6, completed: true, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he' },
    { id: 'ten-live-2560x1600-midnight-en', label: '10-max live', viewport: [2560, 1600], playerCount: 10, completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'table-focus', language: 'en' },
    { id: 'six-review-2560x1600-daylight-he', label: 'Replay review', viewport: [2560, 1600], playerCount: 6, completed: true, replay: true, theme: 'daylight', density: 'comfortable', layout: 'balanced', language: 'he' },
  ];
  const findings = [];
  for (const spec of specs) findings.push(await capture(page, spec));

  const failures = [];
  for (const finding of findings) {
    if (finding.documentOverflowX > 1) failures.push(`${finding.label}: document overflow ${finding.documentOverflowX}px`);
    if (finding.horizontalOverflows.length) failures.push(`${finding.label}: horizontal overflow ${finding.horizontalOverflows.join(', ')}`);
    if (finding.seatOverlaps.length) failures.push(`${finding.label}: seat overlap ${finding.seatOverlaps.join(', ')}`);
    if (!finding.dealerVisible) failures.push(`${finding.label}: dealer marker is not visible`);
    if (finding.currentActorCount > 1) failures.push(`${finding.label}: multiple current actors`);
    if (!finding.reducedMotion) failures.push(`${finding.label}: reduced motion preference not active`);
  }
  for (const finding of findings.filter((entry) => entry.visualState === 'live_decision')) {
    if (!finding.dockWithinViewport) failures.push(`${finding.label}: action dock is not within the captured viewport`);
    if (!finding.table || finding.table.width < 900 || finding.table.width > 1320) {
      failures.push(`${finding.label}: play projection table width ${finding.table?.width ?? 'missing'}px is outside the 900–1320px target band`);
    }
  }
  const huLive = findings.find((finding) => finding.label === 'HU live');
  const fullRing = findings.find((finding) => finding.label === '10-max live');
  const review = findings.find((finding) => finding.label === 'Replay review');
  if (huLive?.seats.length !== 2 || huLive?.geometryFamily !== 'hu') failures.push('HU did not use the HU geometry family');
  if (fullRing?.seats.length !== 10 || fullRing?.geometryFamily !== 'full_ring') failures.push('10-max did not use the full-ring family');
  if (review?.projection !== 'review' || review?.timelineSeekCount < 2 || !review?.focusedTimelineSeek) {
    failures.push('Replay review did not preserve direct-seek focus and review projection');
  }
  if (!review?.table || review.table.width < 720 || review.table.width > 980) {
    failures.push(`Replay review table width ${review?.table?.width ?? 'missing'}px is outside the 720–980px target band`);
  }
  failures.push(...errors.map((error) => `page error: ${error}`));

  process.stdout.write(`${JSON.stringify({ browser: 'Firefox', artifactRoot, findings, failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
