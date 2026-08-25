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

async function createHand(page, {
  playerCount,
  street = 'preflop',
  showdown = false,
  completed = false,
}) {
  const result = await page.evaluate(({
    playerCount: count,
    street: targetStreet,
    showdown: shouldReachShowdown,
    completed: shouldComplete,
  }) => {
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
    const reservedBoard = new Set(['As', 'Kd', 'Qc', 'Jh', '8s']);
    const deck = ['2c', '3d', '4h', '5s', '6c', '7d', '8h', '9s', 'Tc', 'Jd', 'Qh', 'Ks', 'Ac', '2d', '3h', '4s', '5c', '6d', '7h', '8c', '9d', 'Th', 'Js', 'Qd', 'Kh', 'Ad']
      .filter((card) => !reservedBoard.has(card));
    const players = [...bridge.getState().players].sort((left, right) => left.seat - right.seat);
    const cardsByPlayer = {};
    players.forEach((player, index) => {
      cardsByPlayer[player.playerId] = player.playerId === heroPlayerId
        ? ['Ts', '9h']
        : [deck[index * 2], deck[(index * 2) + 1]];
    });
    bridge.dealObservedHoleCards({ [heroPlayerId]: cardsByPlayer[heroPlayerId] });

    const streetOrder = ['preflop', 'flop', 'turn', 'river'];
    const boardByStreet = {
      flop: ['As', 'Kd', 'Qc'],
      turn: ['Jh'],
      river: ['8s'],
    };
    let guard = 0;
    const advanceBettingRound = () => {
      while (bridge.getState()?.phase === 'betting' && guard < 120) {
        const legal = bridge.getLegalActions();
        if (legal?.check?.available) bridge.applyAction('check');
        else if (legal?.call?.available) bridge.applyAction('call');
        else throw new Error('Passive Firefox fixture has no check/call action');
        guard += 1;
      }
    };
    for (let index = 1; index <= streetOrder.indexOf(targetStreet); index += 1) {
      advanceBettingRound();
      bridge.dealBoardCards(boardByStreet[streetOrder[index]]);
    }
    if (shouldReachShowdown || shouldComplete) {
      while (bridge.getState()?.phase !== 'showdown'
        && !bridge.getState()?.terminal?.isTerminal
        && guard < 160) {
        advanceBettingRound();
        const pending = bridge.getState()?.pendingChance?.type;
        if (pending === 'deal_flop') bridge.dealBoardCards(boardByStreet.flop);
        else if (pending === 'deal_turn') bridge.dealBoardCards(boardByStreet.turn);
        else if (pending === 'deal_river') bridge.dealBoardCards(boardByStreet.river);
        else if (bridge.getState()?.phase !== 'showdown') break;
      }
    }
    if (bridge.getState()?.phase === 'showdown') {
      players
        .filter((player) => player.playerId !== heroPlayerId && player.folded !== true)
        .forEach((player) => bridge.revealHoleCards(player.playerId, cardsByPlayer[player.playerId]));
    }
    if (shouldComplete && bridge.getState()?.phase === 'showdown') bridge.resolveShowdown();
    while (shouldComplete && !bridge.getState()?.terminal?.isTerminal && guard < count + 170) {
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
      status: state?.terminal?.isTerminal ? 'terminal' : state?.phase,
      street: state?.street,
      boardCount: state?.board?.length || 0,
      frames: bridge.createReplayProjectionViewModel()?.totalFrameCount || 0,
    };
  }, { playerCount, street, showdown, completed });
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
    const center = (bounds) => bounds ? {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
    } : null;
    const distance = (left, right) => left && right
      ? Math.hypot(left.x - right.x, left.y - right.y)
      : Number.POSITIVE_INFINITY;
    const svgPoint = (element, point = { x: 0, y: 0 }) => {
      if (!element?.getScreenCTM) return null;
      const matrix = element.getScreenCTM();
      if (!matrix) return null;
      return {
        x: (point.x * matrix.a) + (point.y * matrix.c) + matrix.e,
        y: (point.x * matrix.b) + (point.y * matrix.d) + matrix.f,
      };
    };
    const pathPoint = (path, atEnd = false) => {
      if (!path?.getTotalLength) return null;
      const local = path.getPointAtLength(atEnd ? path.getTotalLength() : 0);
      return svgPoint(path, local);
    };
    const pointRectDistance = (point, bounds) => {
      if (!point || !bounds) return Number.POSITIVE_INFINITY;
      const dx = Math.max(bounds.left - point.x, 0, point.x - bounds.right);
      const dy = Math.max(bounds.top - point.y, 0, point.y - bounds.bottom);
      return Math.hypot(dx, dy);
    };
    const containsPoint = (bounds, point, inset = 0) => Boolean(bounds && point
      && point.x >= bounds.left + inset && point.x <= bounds.right - inset
      && point.y >= bounds.top + inset && point.y <= bounds.bottom - inset);
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
    const knownCards = [...document.querySelectorAll('#visual-table-container .card-group[data-card-state="known"]')];
    const hiddenCards = [...document.querySelectorAll('#visual-table-container .table-card-back[data-card-state="unknown"]')];
    const dealer = document.querySelector('.table-dealer-button:not([hidden])');
    const dealerSeat = dealer?.closest('.table-seat');
    const dealerCards = dealerSeat?.querySelector('.table-hole-cards');
    const seatOverlaps = [];
    for (let left = 0; left < seats.length; left += 1) {
      for (let right = left + 1; right < seats.length; right += 1) {
        if (overlaps(seats[left].bounds, seats[right].bounds)) {
          seatOverlaps.push(`${seats[left].id}:${seats[right].id}`);
        }
      }
    }
    const table = rect(document.querySelector('#visual-table-container'));
    const tableRegion = rect(document.querySelector('#table-wrapper'));
    const tableBody = rect(document.querySelector('#table-rail-outer'));
    const bettingLine = rect(document.querySelector('#table-betting-line'));
    const dock = rect(document.querySelector('#handStageDock'));
    const timeline = rect(document.querySelector('#handTimelineStage'));
    const wrapper = document.querySelector('#table-wrapper');
    const detachedSeatCards = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .filter((seat) => !overlaps(rect(seat.querySelector('.table-seat-surface')), rect(seat.querySelector('.table-hole-cards'))))
      .map((seat) => seat.id);
    const detachedSeatRails = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .filter((seat) => {
        const connector = seat.querySelector('.table-seat-connector');
        return !overlaps(rect(seat.querySelector('.table-card-cradle')), tableBody)
          && !overlaps(rect(seat.querySelector('.table-hole-cards')), tableBody)
          && !containsPoint(tableBody, pathPoint(connector))
          && !containsPoint(tableBody, pathPoint(connector, true));
      })
      .map((seat) => seat.id);
    const potAnchor = svgPoint(document.querySelector('#table-pot'));
    const contributionPathFailures = [];
    const contributionInsideBettingFailures = [];
    [...document.querySelectorAll('.table-contribution-lane:not([hidden])')].forEach((lane) => {
      const seatIndex = lane.dataset.playerAnchor;
      const ownerPath = lane.querySelector('.table-contribution-lane-path--owner');
      const potPath = lane.querySelector('.table-contribution-lane-path--pot');
      const amount = lane.querySelector('.table-contribution');
      const ownerStart = pathPoint(ownerPath);
      const ownerEnd = pathPoint(ownerPath, true);
      const potStart = pathPoint(potPath);
      const potEnd = pathPoint(potPath, true);
      const amountAnchor = svgPoint(amount);
      const seatSurface = rect(document.querySelector(`#seat-${seatIndex} .table-seat-surface`));
      const isContinuous = distance(ownerEnd, amountAnchor) <= 2
        && distance(potStart, amountAnchor) <= 2
        && distance(potEnd, potAnchor) <= 2
        && pointRectDistance(ownerStart, seatSurface) <= 8;
      const seatToPot = distance(ownerStart, potAnchor);
      const ordered = distance(ownerStart, amountAnchor) < seatToPot
        && distance(amountAnchor, potAnchor) < seatToPot;
      if (!isContinuous || !ordered) contributionPathFailures.push(seatIndex);
      if (!containsPoint(bettingLine, amountAnchor)) contributionInsideBettingFailures.push(seatIndex);
    });
    const activeView = document.querySelector('.mode-view.active');
    const horizontalOverflows = activeView ? [...activeView.querySelectorAll('button, input, select, strong, p')]
      .filter(visible)
      .filter((element) => {
        if (element.closest('.replay-timeline--compact, .replay-timeline--review')) return false;
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
      tableRegion,
      tableBody,
      bettingLine,
      dock,
      timeline,
      dockWithinViewport: dock ? dock.top >= -1 && dock.bottom <= innerHeight + 1 : null,
      tableDominance: table ? Number((table.width / innerWidth).toFixed(3)) : null,
      tableRegionOccupancy: table && tableRegion
        ? Number((table.width / tableRegion.width).toFixed(3)) : null,
      tableBodyOccupancy: tableBody && tableRegion
        ? Number((tableBody.width / tableRegion.width).toFixed(3)) : null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      seatOverlaps,
      seats,
      foldedCount: seats.filter((seat) => seat.folded).length,
      currentActorCount: seats.filter((seat) => seat.actor).length,
      heroBottom: seats.find((seat) => seat.hero)?.bounds?.bottom ?? null,
      dealerVisible: Boolean(document.querySelector('.table-dealer-button:not([hidden])')),
      dealerCardOverlap: overlaps(rect(dealer), rect(dealerCards)),
      detachedSeatCards,
      detachedSeatRails,
      contributionPathFailures,
      contributionInsideBettingFailures,
      boardCardCount: document.querySelectorAll('#community-cards .card-group[data-card-state="known"]').length,
      phaseText: document.querySelector('#table-phase-status')?.textContent || '',
      knownCardIdentityFailures: knownCards.filter((card) => (
        !card.querySelector('.table-card-corner-rank')
        || !card.querySelector('.table-card-corner-suit')
      )).length,
      knownCardCount: knownCards.length,
      hiddenCardCount: hiddenCards.length,
      hiddenCardIdentityLeaks: hiddenCards.filter((card) => (
        card.querySelector('.table-card-corner-rank, .table-card-corner-suit')
      )).length,
      potCount: document.querySelectorAll('#table-pot').length,
      visibleContributionCount: document.querySelectorAll('.table-contribution:not([hidden])').length,
      visibleContributionLaneCount: document.querySelectorAll('.table-contribution-lane:not([hidden])').length,
      physicalLayers: ['table-base', 'table-rail-outer', 'table-rail-inner', 'table-cushion', 'table-surface']
        .every((id) => Boolean(document.getElementById(id))),
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
  await page.screenshot({ path: screenshot, type: 'png', fullPage: true });
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
    { id: 'hu-live-1920x1080-midnight-en', label: 'HU live', viewport: [1920, 1080], playerCount: 2, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'six-live-1920x1080-daylight-en', label: '6-max live', viewport: [1920, 1080], playerCount: 6, street: 'preflop', completed: false, replay: false, theme: 'daylight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'ten-live-1920x1080-midnight-en', label: '10-max live', viewport: [1920, 1080], playerCount: 10, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'six-river-1920x1080-midnight-he', label: '6-max river RTL', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'he', cards: { faceStyle: 'high-contrast', backStyle: 'geometric', rankStyle: 'full-ten', fourColor: true } },
    { id: 'hu-showdown-1920x1080-daylight-he', label: 'HU showdown RTL', viewport: [1920, 1080], playerCount: 2, street: 'river', showdown: true, completed: false, replay: false, theme: 'daylight', density: 'compact', layout: 'table-focus', language: 'he' },
    { id: 'six-complete-1920x1080-daylight-he', label: '6-max completed', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: true, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he' },
    { id: 'six-review-1920x1080-midnight-en', label: 'Replay review', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: true, replay: true, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'six-live-2560x1440-midnight-en', label: '6-max large canvas', viewport: [2560, 1440], playerCount: 6, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'ten-live-2560x1600-daylight-he', label: '10-max large canvas RTL', viewport: [2560, 1600], playerCount: 10, street: 'preflop', completed: false, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he' },
  ];
  const findings = [];
  for (const spec of specs) findings.push(await capture(page, spec));

  const failures = [];
  for (const finding of findings) {
    if (finding.documentOverflowX > 1) failures.push(`${finding.label}: document overflow ${finding.documentOverflowX}px`);
    if (finding.horizontalOverflows.length) failures.push(`${finding.label}: horizontal overflow ${finding.horizontalOverflows.join(', ')}`);
    if (finding.seatOverlaps.length) failures.push(`${finding.label}: seat overlap ${finding.seatOverlaps.join(', ')}`);
    if (!finding.dealerVisible) failures.push(`${finding.label}: dealer marker is not visible`);
    if (finding.dealerCardOverlap) failures.push(`${finding.label}: dealer marker overlaps private cards`);
    if (finding.detachedSeatCards.length) failures.push(`${finding.label}: detached seat/card units ${finding.detachedSeatCards.join(', ')}`);
    if (finding.detachedSeatRails.length) failures.push(`${finding.label}: detached seat/rail units ${finding.detachedSeatRails.join(', ')}`);
    if (finding.contributionPathFailures.length) failures.push(`${finding.label}: broken player-contribution-pot paths at seats ${finding.contributionPathFailures.join(', ')}`);
    if (finding.contributionInsideBettingFailures.length) failures.push(`${finding.label}: contributions outside betting line at seats ${finding.contributionInsideBettingFailures.join(', ')}`);
    if (finding.currentActorCount > 1) failures.push(`${finding.label}: multiple current actors`);
    if (!finding.reducedMotion) failures.push(`${finding.label}: reduced motion preference not active`);
    if (!finding.physicalLayers) failures.push(`${finding.label}: physical table layer is missing`);
    if (finding.knownCardIdentityFailures) failures.push(`${finding.label}: ${finding.knownCardIdentityFailures} known cards lack rank/suit hooks`);
    if (finding.hiddenCardIdentityLeaks) failures.push(`${finding.label}: hidden cards expose rank/suit hooks`);
    if (finding.potCount !== 1) failures.push(`${finding.label}: expected one central pot, found ${finding.potCount}`);
    if (finding.visibleContributionCount !== finding.visibleContributionLaneCount) {
      failures.push(`${finding.label}: contribution/lane count mismatch`);
    }
  }
  for (const finding of findings.filter((entry) => entry.visualState === 'live_decision')) {
    if (!finding.dockWithinViewport) failures.push(`${finding.label}: action dock is not within the captured viewport`);
    if (!finding.table || finding.table.width < 900 || finding.table.width > 1320) {
      failures.push(`${finding.label}: play projection table width ${finding.table?.width ?? 'missing'}px is outside the 900–1320px target band`);
    }
  }
  for (const finding of findings.filter((entry) => (
    entry.visualState === 'live_decision'
    && entry.layout === 'balanced'
    && entry.viewport[0] >= 1920
  ))) {
    if (finding.tableRegionOccupancy < 0.96) {
      failures.push(`${finding.label}: table uses only ${finding.tableRegionOccupancy} of its allocated region`);
    }
    if (finding.tableBodyOccupancy < 0.82) {
      failures.push(`${finding.label}: physical table body uses only ${finding.tableBodyOccupancy} of its allocated region`);
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
  for (const [label, expectedBoardCount] of [
    ['6-max river RTL', 5], ['HU showdown RTL', 5],
  ]) {
    const finding = findings.find((entry) => entry.label === label);
    if (finding?.boardCardCount !== expectedBoardCount) {
      failures.push(`${label}: expected ${expectedBoardCount} board cards, found ${finding?.boardCardCount ?? 'missing'}`);
    }
  }
  const showdown = findings.find((finding) => finding.label === 'HU showdown RTL');
  if (!showdown?.phaseText) failures.push('HU showdown did not expose a visible phase status');
  for (const label of ['HU live', '6-max live', '10-max live', '6-max large canvas', '10-max large canvas RTL']) {
    const finding = findings.find((entry) => entry.label === label);
    if (finding?.visibleContributionCount < 2) failures.push(`${label}: fewer than two visible contributions`);
    if (finding?.knownCardCount < 2) failures.push(`${label}: Hero known cards are missing`);
    if (finding?.hiddenCardCount < 2) failures.push(`${label}: opponent hidden cards are missing`);
  }
  failures.push(...errors.map((error) => `page error: ${error}`));

  process.stdout.write(`${JSON.stringify({ browser: await browser.version(), artifactRoot, findings, failures }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
