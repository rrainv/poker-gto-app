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
  foldCount = 0,
  allIn = false,
}) {
  const result = await page.evaluate(({
    playerCount: count,
    street: targetStreet,
    showdown: shouldReachShowdown,
    completed: shouldComplete,
    foldCount: requestedFoldCount,
    allIn: shouldForceAllIn,
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

    let foldedPlayers = 0;
    let foldGuard = 0;
    while (foldedPlayers < requestedFoldCount
      && bridge.getState()?.phase === 'betting'
      && foldGuard < count * 2) {
      const state = bridge.getState();
      const legal = bridge.getLegalActions();
      if (state.actingPlayerId !== heroPlayerId && legal?.fold?.available) {
        bridge.applyAction('fold');
        foldedPlayers += 1;
      } else if (legal?.check?.available) bridge.applyAction('check');
      else if (legal?.call?.available) bridge.applyAction('call');
      else break;
      foldGuard += 1;
    }

    if (shouldForceAllIn) {
      let allInGuard = 0;
      while (bridge.getState()?.phase === 'betting' && allInGuard < count * 3) {
        const legal = bridge.getLegalActions();
        if (legal?.allIn?.available) bridge.applyAction('all_in');
        else if (legal?.call?.available) bridge.applyAction('call');
        else if (legal?.check?.available) bridge.applyAction('check');
        else break;
        allInGuard += 1;
      }
    }

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
  }, { playerCount, street, showdown, completed, foldCount, allIn });
  if (completed && !result.terminal) throw new Error(`Could not reach ${playerCount}-player terminal state`);
  await page.waitForFunction((count) => (
    document.querySelector('#visual-table-container')?.dataset.tableGeometryFamily
    && document.querySelectorAll('#visual-table-container .table-seat').length === count
  ), {}, playerCount);
  await settle(page);
  return result;
}

async function resetToSetup(page) {
  await page.evaluate(() => window.RiverlinePlaybookState.resetHand());
  await page.waitForFunction(() => (
    !document.querySelector('#handSetupSection')?.hidden
    && document.querySelector('#handSetupDisclosure')?.open
  ));
  await settle(page);
}

async function enterReplayWithKeyboard(page) {
  const frameIndex = await page.evaluate(() => {
    const endpoint = window.RiverlinePlaybookState.createReplayProjectionViewModel()?.totalFrameCount - 1;
    const controls = [...document.querySelectorAll('#handActionHistory .replay-timeline-seek[data-frame-index]')]
      .filter((control) => Number(control.dataset.frameIndex) < endpoint);
    const control = controls.at(-1);
    if (!control) return null;
    const group = control.closest('.replay-street-group');
    if (group) group.open = true;
    return Number(control.dataset.frameIndex);
  });
  if (!Number.isInteger(frameIndex)) throw new Error('Expected a prior direct-seek timeline control');
  const control = await page.$(`#handActionHistory .replay-timeline-seek[data-frame-index="${frameIndex}"]`);
  await control.focus();
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
    const rectDistance = (left, right) => {
      if (!left || !right) return Number.POSITIVE_INFINITY;
      const dx = Math.max(right.left - left.right, left.left - right.right, 0);
      const dy = Math.max(right.top - left.bottom, left.top - right.bottom, 0);
      return Math.hypot(dx, dy);
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
    const containsBounds = (outer, inner, inset = 0) => Boolean(outer && inner
      && inner.left >= outer.left + inset && inner.right <= outer.right - inset
      && inner.top >= outer.top + inset && inner.bottom <= outer.bottom - inset);
    const parseCssColor = (value) => {
      const source = String(value || '').trim();
      const rgbMatch = source.match(/^rgba?\(\s*([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
      if (rgbMatch) {
        const usesPercent = source.includes('%');
        return rgbMatch.slice(1, 4).map((component) => (
          usesPercent ? Number(component) * 2.55 : Number(component)
        ));
      }
      const srgbMatch = source.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/i);
      return srgbMatch ? srgbMatch.slice(1, 4).map((component) => Number(component) * 255) : null;
    };
    const relativeLuminance = (color) => {
      if (!color) return null;
      const [red, green, blue] = color.map((component) => {
        const channel = component / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
    };
    const contrastRatio = (foreground, background) => {
      const foregroundLuminance = relativeLuminance(parseCssColor(foreground));
      const backgroundLuminance = relativeLuminance(parseCssColor(background));
      if (!Number.isFinite(foregroundLuminance) || !Number.isFinite(backgroundLuminance)) return null;
      return Number(((Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)).toFixed(2));
    };
    const seats = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .map((seat) => ({
        id: seat.id,
        bounds: rect(seat.querySelector('.table-seat-surface')),
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
    const tableFelt = rect(document.querySelector('#table-surface'));
    const bettingLine = rect(document.querySelector('#table-betting-line'));
    const potBounds = rect(document.querySelector('#table-pot'));
    const streetBounds = rect(document.querySelector('#table-phase-status'));
    const dock = rect(document.querySelector('#handStageDock'));
    const timeline = rect(document.querySelector('#handTimelineStage'));
    const wrapper = document.querySelector('#table-wrapper');
    const heroSeatElement = document.querySelector('#visual-table-container .table-seat.is-hero');
    const heroSurfaceBounds = rect(heroSeatElement?.querySelector('.table-seat-surface'));
    const heroCardsBounds = rect(heroSeatElement?.querySelector('.table-hole-cards'));
    const seatRailDistances = seats.map((seat) => Number(rectDistance(seat.bounds, tableBody).toFixed(2)));
    const visibleContributions = [...document.querySelectorAll('.table-contribution:not([hidden])')].filter(visible);
    const contributionPotOverlaps = visibleContributions
      .filter((contribution) => overlaps(rect(contribution), potBounds))
      .map((contribution) => contribution.id);
    const contributionStreetOverlaps = visibleContributions
      .filter((contribution) => overlaps(rect(contribution), streetBounds))
      .map((contribution) => contribution.id);
    const contributionPotDistances = visibleContributions
      .map((contribution) => Number(rectDistance(rect(contribution), potBounds).toFixed(2)));
    const daylightContribution = visibleContributions[0];
    const daylightContributionText = daylightContribution?.querySelector('.poker-table-amount-text');
    const daylightContributionSurface = daylightContribution?.querySelector('.poker-table-amount-surface');
    const contributionTextFill = daylightContributionText
      ? getComputedStyle(daylightContributionText).fill
      : '';
    const contributionSurfaceFill = daylightContributionSurface
      ? getComputedStyle(daylightContributionSurface).fill
      : '';
    const overlappingSeatCards = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .filter((seat) => overlaps(rect(seat.querySelector('.table-seat-surface')), rect(seat.querySelector('.table-hole-cards'))))
      .map((seat) => seat.id);
    const cardLaneFailures = [...document.querySelectorAll('#visual-table-container .table-seat')]
      .filter(visible)
      .filter((seat) => {
        const surface = rect(seat.querySelector('.table-seat-surface'));
        const cards = rect(seat.querySelector('.table-hole-cards[data-card-lane="radial-felt"]'));
        const contribution = rect(document.querySelector(`#contribution-${seat.dataset.seatIndex}:not([hidden])`));
        const ownDistance = distance(center(surface), center(cards));
        const nearestOtherSeatDistance = Math.min(...seats
          .filter((candidate) => candidate.id !== seat.id)
          .map((candidate) => distance(center(candidate.bounds), center(cards))));
        return !cards
          || !containsPoint(tableFelt, center(cards), 1)
          || overlaps(cards, contribution)
          || ownDistance >= nearestOtherSeatDistance
          || (contribution && ownDistance >= distance(center(surface), center(contribution)));
      })
      .map((seat) => seat.id);
    const privateCardGroups = [...document.querySelectorAll('#visual-table-container .table-hole-cards')]
      .filter(visible);
    const cardGroupOverlaps = [];
    for (let left = 0; left < privateCardGroups.length; left += 1) {
      for (let right = left + 1; right < privateCardGroups.length; right += 1) {
        if (overlaps(rect(privateCardGroups[left]), rect(privateCardGroups[right]))) {
          cardGroupOverlaps.push(`${privateCardGroups[left].closest('.table-seat')?.id}:${privateCardGroups[right].closest('.table-seat')?.id}`);
        }
      }
    }
    const dealerCollisionTargets = [
      dealerCards,
      document.querySelector(`#contribution-${dealerSeat?.dataset.seatIndex}:not([hidden])`),
      document.querySelector('#community-cards'),
      document.querySelector('#table-pot'),
      ...document.querySelectorAll('.table-seat-surface'),
    ];
    const dealerCollision = dealerCollisionTargets.some((target) => overlaps(rect(dealer), rect(target)));
    const contributionInsideBettingFailures = [];
    [...document.querySelectorAll('.table-contribution-lane:not([hidden])')].forEach((lane) => {
      const seatIndex = lane.dataset.playerAnchor;
      const amount = lane.querySelector('.table-contribution');
      const amountAnchor = svgPoint(amount);
      if (!containsPoint(bettingLine, amountAnchor)) contributionInsideBettingFailures.push(seatIndex);
    });
    const timelineRoot = document.querySelector('#handActionHistory');
    const historyDisclosure = document.querySelector('#handHistoryDisclosure');
    const replayControls = document.querySelector('#handReplayControls');
    const timelineGroups = [...timelineRoot.querySelectorAll('.replay-street-group')];
    const groupTops = timelineGroups.map((group) => rect(group)?.top).filter(Number.isFinite);
    const chronologyVertical = groupTops.every((top, index) => index === 0 || top >= groupTops[index - 1]);
    const foldedReadabilityFailures = seats
      .filter((seat) => seat.folded)
      .filter((seat) => Number(seat.opacity) < 0.7
        || !document.querySelector(`#${seat.id} .table-seat-name`)?.textContent?.trim())
      .map((seat) => seat.id);
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
      tableFelt,
      bettingLine,
      dock,
      timeline,
      dockWithinViewport: dock ? dock.top >= -1 && dock.bottom <= innerHeight + 1 : null,
      tableDominance: table ? Number((table.width / innerWidth).toFixed(3)) : null,
      tableRegionOccupancy: table && tableRegion
        ? Number((table.width / tableRegion.width).toFixed(3)) : null,
      tableBodyOccupancy: tableBody && tableRegion
        ? Number((tableBody.width / tableRegion.width).toFixed(3)) : null,
      heroRailDistance: Number(rectDistance(heroSurfaceBounds, tableBody).toFixed(2)),
      heroCardGap: Number(rectDistance(heroSurfaceBounds, heroCardsBounds).toFixed(2)),
      seatRailDistances,
      huRailDistanceDelta: seats.length === 2
        ? Number(Math.abs(seatRailDistances[0] - seatRailDistances[1]).toFixed(2))
        : null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      seatOverlaps,
      seats,
      foldedCount: seats.filter((seat) => seat.folded).length,
      currentActorCount: seats.filter((seat) => seat.actor).length,
      heroBottom: seats.find((seat) => seat.hero)?.bounds?.bottom ?? null,
      dealerVisible: Boolean(document.querySelector('.table-dealer-button:not([hidden])')),
      dealerCollision,
      dealerInsideTable: containsPoint(tableBody, center(rect(dealer))),
      dealerInsideFelt: containsBounds(tableFelt, rect(dealer), 2),
      overlappingSeatCards,
      cardLaneFailures,
      cardGroupOverlaps,
      dongleArtifactCount: document.querySelectorAll('.table-seat-connector, .table-card-cradle').length,
      contributionInsideBettingFailures,
      contributionPotOverlaps,
      contributionStreetOverlaps,
      contributionPotDistances,
      contributionTextFill,
      contributionSurfaceFill,
      contributionContrast: contrastRatio(contributionTextFill, contributionSurfaceFill),
      staticContributionPathCount: document.querySelectorAll('.table-contribution-lane-path').length,
      foldedReadabilityFailures,
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
      chronologyVertical,
      chronologyGroupCount: timelineGroups.length,
      chronologyOpenGroupCount: timelineGroups.filter((group) => group.open).length,
      chronologyInternalScroll: timelineRoot.scrollHeight > timelineRoot.clientHeight + 1,
      chronologyOverflowY: getComputedStyle(timelineRoot).overflowY,
      chronologyHorizontalOverflow: timelineRoot.scrollWidth - timelineRoot.clientWidth,
      historyDisclosureOpen: historyDisclosure?.open ?? null,
      historyCountText: document.querySelector('#handHistoryCompactSummary')?.textContent?.trim() || '',
      historySelectionText: document.querySelector('#handHistorySelectionSummary')?.textContent?.trim() || '',
      replayHistorySeparated: Boolean(rect(replayControls) && rect(historyDisclosure)
        && !overlaps(rect(replayControls), rect(historyDisclosure))),
      historyParentId: document.querySelector('#handHistorySection')?.parentElement?.id || '',
      reviewOpen: document.querySelector('#gtoMode')?.classList.contains('is-hand-review-open') ?? false,
      reviewSurface: rect(document.querySelector('#handReviewSurface')),
      reviewOverview: rect(document.querySelector('.hand-review-overview')),
      reviewNavigation: rect(document.querySelector('.hand-review-decision-navigation')),
      reviewDetail: rect(document.querySelector('.hand-review-decision-detail')),
      reviewReplayRail: rect(document.querySelector('#handReviewReplayRailMount')),
      legalActionCount: document.querySelectorAll('#handActionSection:not([hidden]) #handLegalActions .ui-button').length,
      returnToLiveVisible: visible(document.querySelector('#handReplayLiveButton')),
    };
  }, label);
}

async function capture(page, spec) {
  await page.setViewport({ width: spec.viewport[0], height: spec.viewport[1], deviceScaleFactor: 1 });
  await configurePresentation(page, spec);
  if (spec.setup) await resetToSetup(page);
  else await createHand(page, spec);
  const liveTableWidthBeforeReplay = await page.$eval(
    '#visual-table-container',
    (element) => Math.round(element.getBoundingClientRect().width),
  );
  if (spec.replay) await enterReplayWithKeyboard(page);
  if (spec.review) {
    await page.click('#handCompletedReviewButton');
    await page.waitForFunction(() => (
      document.querySelector('#gtoMode')?.classList.contains('is-hand-review-open')
      && !document.querySelector('#handReviewSurface')?.hidden
    ));
  }
  await page.$eval(spec.review ? '#handReviewSurface' : '#handLiveStageHeader', (element) => element.scrollIntoView({ block: 'start' }));
  await settle(page);
  const finding = await inspect(page, spec.label);
  const screenshot = path.join(artifactRoot, `${spec.id}.png`);
  await page.screenshot({ path: screenshot, type: 'png', fullPage: true });
  if (spec.review) {
    await page.click('#handReviewReturn');
    await page.waitForFunction(() => !document.querySelector('#gtoMode')?.classList.contains('is-hand-review-open'));
  }
  return { ...finding, liveTableWidthBeforeReplay, screenshot };
}

async function auditRaiseReentry(page) {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await configurePresentation(page, {
    theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en',
  });
  await createHand(page, { playerCount: 4 });
  await enterReplayWithKeyboard(page);
  await page.click('#handReplayLiveButton');
  await page.waitForFunction(() => window.RiverlinePlaybookState.createReplayProjectionViewModel()?.readOnly === false);
  await page.waitForSelector('#handLegalActions [data-canonical-action="raise"]:not([disabled])');
  await page.click('#handLegalActions [data-canonical-action="raise"]');
  await page.waitForFunction(() => !document.querySelector('#handActionSizing')?.hidden);
  return page.evaluate(() => {
    const input = document.querySelector('#handActionAmountBb');
    const range = document.querySelector('#handActionAmountRange');
    const commit = document.querySelector('#handCommitSizedAction');
    const minimum = Number(input?.min);
    const maximum = Number(input?.max);
    const step = Number(input?.step);
    const validInitial = Number(input?.value) === minimum && commit?.disabled === false;
    input.value = String(maximum + step);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const invalidBlocked = commit?.disabled === true && input.getAttribute('aria-invalid') === 'true';
    input.value = String(minimum);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const validRestored = commit?.disabled === false && input.getAttribute('aria-invalid') === 'false';
    return {
      inputEnabled: input?.disabled === false,
      rangeEnabled: range?.disabled === false,
      commitEnabled: commit?.disabled === false,
      validInitial,
      invalidBlocked,
      validRestored,
      minimum,
      maximum,
    };
  });
}

async function auditExactChanceCommit(page) {
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await configurePresentation(page, {
    theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he',
  });
  const fixture = await createHand(page, { playerCount: 2, allIn: true });
  await page.waitForSelector('#handChanceSection:not([hidden])');
  const requiredCount = await page.$$eval(
    '[data-slots="hand-board-chance"] .card-slot',
    (slots) => slots.length,
  );
  const initiallyDisabled = await page.$eval('#handDealBoardButton', (button) => button.disabled);
  for (let index = 0; index < requiredCount; index += 1) {
    await page.click(`[data-slots="hand-board-chance"] .card-slot[data-index="${index}"]`);
    await page.waitForSelector('#cardModal.show #deck .deck-card:not([disabled])');
    await page.click('#cardModal.show #deck .deck-card:not([disabled])');
    await page.waitForFunction(() => !document.querySelector('#cardModal')?.classList.contains('show'));
  }
  const enabledAtExactCount = await page.$eval('#handDealBoardButton', (button) => button.disabled === false);
  await page.click('#handDealBoardButton');
  await page.waitForFunction(() => window.RiverlinePlaybookState.getState()?.street === 'flop');
  return {
    fixture,
    requiredCount,
    initiallyDisabled,
    enabledAtExactCount,
    committedStreet: await page.evaluate(() => window.RiverlinePlaybookState.getState()?.street),
    actingPlayerId: await page.evaluate(() => window.RiverlinePlaybookState.getState()?.actingPlayerId ?? null),
  };
}

async function auditHistoryDisclosureKeyboard(page) {
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await configurePresentation(page, {
    theme: 'graphite', density: 'compact', layout: 'balanced', language: 'ru',
  });
  await createHand(page, { playerCount: 6, street: 'river', completed: true });
  const summary = await page.$('#handHistoryDisclosure > summary');
  await summary.focus();
  await page.keyboard.press(' ');
  await page.waitForFunction(() => document.querySelector('#handHistoryDisclosure')?.open === false);
  const collapsed = await page.evaluate(() => ({
    open: document.querySelector('#handHistoryDisclosure')?.open,
    label: document.querySelector('#handHistoryDisclosureAction')?.textContent?.trim(),
  }));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#handHistoryDisclosure')?.open === true);
  const expanded = await page.evaluate(() => ({
    open: document.querySelector('#handHistoryDisclosure')?.open,
    label: document.querySelector('#handHistoryDisclosureAction')?.textContent?.trim(),
    scrollable: document.querySelector('#handActionHistory')?.scrollHeight
      > document.querySelector('#handActionHistory')?.clientHeight + 1,
  }));
  return { collapsed, expanded };
}

async function auditInvalidTableSize(page) {
  await resetToSetup(page);
  await page.$eval('#handTableSize', (input) => {
    input.value = '20';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#handTableSize')?.getAttribute('aria-invalid') === 'true');
  const invalid = await page.evaluate(() => ({
    value: document.querySelector('#handTableSize')?.value,
    error: document.querySelector('#handTableSizeError')?.textContent?.trim(),
    errorVisible: document.querySelector('#handTableSizeError')?.hidden === false,
    startDisabled: document.querySelector('#handStartButton')?.disabled === true,
  }));
  await page.$eval('#handTableSize', (input) => {
    input.value = '6';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => document.querySelector('#handTableSize')?.getAttribute('aria-invalid') === 'false');
  const corrected = await page.evaluate(() => ({
    value: document.querySelector('#handTableSize')?.value,
    errorHidden: document.querySelector('#handTableSizeError')?.hidden === true,
    startEnabled: document.querySelector('#handStartButton')?.disabled === false,
  }));
  return { invalid, corrected };
}

async function auditKnownOpponentRailStability(page) {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await configurePresentation(page, {
    theme: 'daylight', density: 'compact', layout: 'balanced', language: 'en',
  });
  await page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 10,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
  });
  await page.waitForFunction(() => (
    !document.querySelector('#handDealSection')?.hidden
    && document.querySelectorAll('#visual-table-container .table-seat').length === 10
    && document.querySelectorAll('.hand-known-opponent-list .hand-private-row').length === 9
  ));
  await page.$eval('#handLiveStageHeader', (element) => element.scrollIntoView({ block: 'start' }));
  await settle(page);
  const measureTable = () => page.$eval('#visual-table-container', (element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: Math.round(bounds.left), top: Math.round(bounds.top),
      documentLeft: Math.round(bounds.left + scrollX),
      documentTop: Math.round(bounds.top + scrollY),
      scrollX: Math.round(scrollX), scrollY: Math.round(scrollY),
      width: Math.round(bounds.width), height: Math.round(bounds.height),
    };
  });
  const before = await measureTable();
  await page.$eval('.hand-known-opponents > summary', (summary) => summary.click());
  await page.waitForFunction(() => document.querySelector('.hand-known-opponents')?.open === true);
  await settle(page);
  const after = await measureTable();
  const editor = await page.evaluate(() => {
    const list = document.querySelector('.hand-known-opponent-list');
    const disclosure = document.querySelector('.hand-known-opponents');
    const summary = disclosure?.querySelector(':scope > summary');
    const rail = document.querySelector('#handInteractionRail');
    const rows = [...list.querySelectorAll('.hand-private-row')];
    list.scrollTop = list.scrollHeight;
    const listBounds = list.getBoundingClientRect();
    const lastBounds = rows.at(-1)?.getBoundingClientRect();
    return {
      rowCount: rows.length,
      scrollable: list.scrollHeight > list.clientHeight + 1,
      overflowY: getComputedStyle(list).overflowY,
      summaryPosition: getComputedStyle(summary).position,
      railOverflowY: getComputedStyle(rail).overflowY,
      railViewportBounded: rail.clientHeight <= innerHeight,
      lastRowReachable: Boolean(lastBounds
        && lastBounds.top >= listBounds.top - 1
        && lastBounds.bottom <= listBounds.bottom + 1),
    };
  });
  return {
    before,
    after,
    tableTopDelta: Math.abs(after.documentTop - before.documentTop),
    tableLeftDelta: Math.abs(after.documentLeft - before.documentLeft),
    tableWidthDelta: Math.abs(after.width - before.width),
    tableHeightDelta: Math.abs(after.height - before.height),
    editor,
  };
}

async function auditAbortHand(page) {
  await configurePresentation(page, {
    theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en',
  });
  await resetToSetup(page);
  const setupState = await page.evaluate(() => {
    const button = document.querySelector('#handResetButton');
    return {
      hidden: button?.hidden === true,
      disabled: button?.disabled === true,
      parentSection: button?.closest('.hand-control-section')?.id || '',
    };
  });
  await createHand(page, { playerCount: 2 });
  const activeState = await page.evaluate(() => {
    const button = document.querySelector('#handResetButton');
    return { visible: button?.hidden === false, enabled: button?.disabled === false };
  });
  await createHand(page, { playerCount: 2, street: 'river', completed: true });
  const terminalState = await page.evaluate(() => {
    const button = document.querySelector('#handResetButton');
    return { hidden: button?.hidden === true, disabled: button?.disabled === true };
  });
  await createHand(page, { playerCount: 2 });
  const beforeCancel = await page.evaluate(() => window.RiverlinePlaybookState.getState()?.handId);
  await page.evaluate(() => {
    window.__riverlineAbortAuditPrompts = [];
    window.confirm = (message) => {
      window.__riverlineAbortAuditPrompts.push(message);
      return false;
    };
  });
  await page.$eval('#handResetButton', (button) => button.click());
  await settle(page, 0);
  const afterCancel = await page.evaluate(() => window.RiverlinePlaybookState.getState()?.handId);
  await page.evaluate(() => {
    window.confirm = (message) => {
      window.__riverlineAbortAuditPrompts.push(message);
      return true;
    };
  });
  await page.$eval('#handResetButton', (button) => button.click());
  await settle(page, 0);
  return {
    setupState,
    activeState,
    terminalState,
    beforeCancel,
    afterCancel,
    prompts: await page.evaluate(() => window.__riverlineAbortAuditPrompts),
    cancelledUnchanged: beforeCancel === afterCancel,
    canonicalCleared: await page.evaluate(() => !window.RiverlinePlaybookState.getState()),
    replayCleared: await page.evaluate(() => (
      window.RiverlinePlaybookState.createReplayProjectionViewModel()?.totalFrameCount === 0
    )),
    setupVisible: await page.evaluate(() => (
      !document.querySelector('#handSetupSection')?.hidden
      && document.querySelector('#handSetupDisclosure')?.open
    )),
  };
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

  const raiseReentry = await auditRaiseReentry(page);
  const exactChanceCommit = await auditExactChanceCommit(page);
  const historyDisclosureKeyboard = await auditHistoryDisclosureKeyboard(page);
  const invalidTableSize = await auditInvalidTableSize(page);
  const knownOpponentRailStability = await auditKnownOpponentRailStability(page);
  const abortHand = await auditAbortHand(page);
  const specs = [
    { id: 'setup-1280x800-graphite-ru', label: 'Setup constrained desktop', viewport: [1280, 800], setup: true, theme: 'graphite', density: 'compact', layout: 'balanced', language: 'ru' },
    { id: 'hu-live-1280x800-midnight-en', label: 'HU live', viewport: [1280, 800], playerCount: 2, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'four-live-1440x900-graphite-ru', label: '4-max live', viewport: [1440, 900], playerCount: 4, street: 'preflop', completed: false, replay: false, theme: 'graphite', density: 'compact', layout: 'balanced', language: 'ru' },
    { id: 'six-live-1600x900-daylight-en', label: '6-max live', viewport: [1600, 900], playerCount: 6, street: 'preflop', completed: false, replay: false, theme: 'daylight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'ten-live-1600x1000-midnight-en', label: '10-max live', viewport: [1600, 1000], playerCount: 10, street: 'preflop', foldCount: 3, completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'hu-live-1920x1080-midnight-en', label: 'HU live primary', viewport: [1920, 1080], playerCount: 2, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'ten-live-1920x1080-midnight-en', label: '10-max live primary', viewport: [1920, 1080], playerCount: 10, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'hu-allin-chance-1600x900-daylight-he', label: 'HU all-in chance RTL', viewport: [1600, 900], playerCount: 2, street: 'preflop', allIn: true, completed: false, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he' },
    { id: 'six-folded-1920x1080-midnight-en', label: 'Theme comparison Midnight', viewport: [1920, 1080], playerCount: 6, street: 'preflop', foldCount: 1, completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'six-folded-1920x1080-graphite-en', label: 'Theme comparison Graphite', viewport: [1920, 1080], playerCount: 6, street: 'preflop', foldCount: 1, completed: false, replay: false, theme: 'graphite', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'six-folded-1920x1080-daylight-en', label: 'Theme comparison Daylight', viewport: [1920, 1080], playerCount: 6, street: 'preflop', foldCount: 1, completed: false, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'en' },
    { id: 'six-river-1920x1080-midnight-he', label: '6-max river RTL', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'he', cards: { faceStyle: 'high-contrast', backStyle: 'geometric', rankStyle: 'full-ten', fourColor: true } },
    { id: 'hu-showdown-1920x1080-daylight-he', label: 'HU showdown RTL', viewport: [1920, 1080], playerCount: 2, street: 'river', showdown: true, completed: false, replay: false, theme: 'daylight', density: 'compact', layout: 'table-focus', language: 'he' },
    { id: 'six-complete-1920x1080-daylight-he', label: '6-max completed', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: true, replay: false, theme: 'daylight', density: 'compact', layout: 'balanced', language: 'he' },
    { id: 'six-live-replay-1920x1080-graphite-ru', label: 'In-progress Replay', viewport: [1920, 1080], playerCount: 6, street: 'river', completed: false, replay: true, theme: 'graphite', density: 'comfortable', layout: 'balanced', language: 'ru', cards: { faceStyle: 'classic', backStyle: 'solid', rankStyle: 'compact-ten', fourColor: false } },
    { id: 'six-review-1600x1000-midnight-en', label: 'Replay review', viewport: [1600, 1000], playerCount: 6, street: 'river', completed: true, replay: false, review: true, theme: 'midnight', density: 'comfortable', layout: 'balanced', language: 'en' },
    { id: 'six-live-1366x768-midnight-en', label: '6-max constrained desktop', viewport: [1366, 768], playerCount: 6, street: 'preflop', completed: false, replay: false, theme: 'midnight', density: 'compact', layout: 'balanced', language: 'en' },
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
    if (finding.seats.length && !finding.dealerVisible) failures.push(`${finding.label}: dealer marker is not visible`);
    if (finding.dealerCollision) failures.push(`${finding.label}: dealer marker collides with cards, contribution, board, or pot`);
    if (finding.seats.length && !finding.dealerInsideTable) failures.push(`${finding.label}: dealer marker is outside the table body`);
    if (finding.seats.length && !finding.dealerInsideFelt) failures.push(`${finding.label}: dealer marker is not clearly inside the felt`);
    if (finding.overlappingSeatCards.length) failures.push(`${finding.label}: cards overlap player panels ${finding.overlappingSeatCards.join(', ')}`);
    if (finding.cardLaneFailures.length) failures.push(`${finding.label}: invalid radial card lanes ${finding.cardLaneFailures.join(', ')}`);
    if (finding.cardGroupOverlaps.length) failures.push(`${finding.label}: private-card lane overlap ${finding.cardGroupOverlaps.join(', ')}`);
    if (finding.dongleArtifactCount) failures.push(`${finding.label}: connector/cradle artifacts remain`);
    if (finding.contributionInsideBettingFailures.length) failures.push(`${finding.label}: contributions outside betting line at seats ${finding.contributionInsideBettingFailures.join(', ')}`);
    if (finding.contributionPotOverlaps.length) failures.push(`${finding.label}: contributions collide with the pot ${finding.contributionPotOverlaps.join(', ')}`);
    if (finding.contributionStreetOverlaps.length) failures.push(`${finding.label}: contributions collide with the street label ${finding.contributionStreetOverlaps.join(', ')}`);
    if (finding.staticContributionPathCount) failures.push(`${finding.label}: static contribution connector artifacts remain`);
    if (finding.foldedReadabilityFailures.length) failures.push(`${finding.label}: unreadable folded seats ${finding.foldedReadabilityFailures.join(', ')}`);
    if (!finding.chronologyVertical) failures.push(`${finding.label}: chronology is not vertically ordered`);
    if (finding.chronologyHorizontalOverflow > 1) failures.push(`${finding.label}: chronology overflows horizontally by ${finding.chronologyHorizontalOverflow}px`);
    if (finding.chronologyOverflowY !== 'auto') failures.push(`${finding.label}: chronology is not an internal vertical scroll region`);
    if (finding.chronologyGroupCount > 0 && finding.chronologyOpenGroupCount < 1) failures.push(`${finding.label}: current street group is not open`);
    if (finding.chronologyGroupCount > 0 && !finding.replayHistorySeparated) failures.push(`${finding.label}: Replay controls and Hand history are not separate regions`);
    if (finding.chronologyGroupCount > 0 && (!finding.historyCountText || !finding.historySelectionText)) failures.push(`${finding.label}: whole-history count or current summary is missing`);
    if (finding.currentActorCount > 1) failures.push(`${finding.label}: multiple current actors`);
    if (!finding.reducedMotion) failures.push(`${finding.label}: reduced motion preference not active`);
    if (!finding.physicalLayers) failures.push(`${finding.label}: physical table layer is missing`);
    if (finding.knownCardIdentityFailures) failures.push(`${finding.label}: ${finding.knownCardIdentityFailures} known cards lack rank/suit hooks`);
    if (finding.hiddenCardIdentityLeaks) failures.push(`${finding.label}: hidden cards expose rank/suit hooks`);
    if (finding.potCount !== 1) failures.push(`${finding.label}: expected one central pot, found ${finding.potCount}`);
    if (finding.visibleContributionCount !== finding.visibleContributionLaneCount) {
      failures.push(`${finding.label}: contribution/lane count mismatch`);
    }
    if (finding.seats.length && finding.heroRailDistance > 24) {
      failures.push(`${finding.label}: Hero panel floats ${finding.heroRailDistance}px from the near rail`);
    }
    if (finding.seats.length && finding.heroCardGap > 16) {
      failures.push(`${finding.label}: Hero cards sit ${finding.heroCardGap}px from the Hero panel`);
    }
    if (finding.seats.length === 2 && finding.huRailDistanceDelta > 2) {
      failures.push(`${finding.label}: HU opposing panel/rail gaps differ by ${finding.huRailDistanceDelta}px`);
    }
    if (finding.theme === 'daylight' && finding.visibleContributionCount > 0
      && (!Number.isFinite(finding.contributionContrast) || finding.contributionContrast < 4.5)) {
      failures.push(`${finding.label}: Daylight contribution contrast is ${finding.contributionContrast ?? 'unresolved'}:1`);
    }
  }
  for (const finding of findings.filter((entry) => entry.visualState === 'live_decision')) {
    if (finding.viewport[0] >= 1600 && !finding.dockWithinViewport) failures.push(`${finding.label}: action dock is not within the captured viewport`);
    if (finding.legalActionCount < 1) failures.push(`${finding.label}: canonical legal actions are not visible beside the table`);
    if (finding.viewport[0] >= 1920
      && (!finding.table || finding.table.width < 900 || finding.table.width > 1320)) {
      failures.push(`${finding.label}: play projection table width ${finding.table?.width ?? 'missing'}px is outside the 900–1320px target band`);
    }
  }
  const constrainedDesktop = findings.find((finding) => finding.label === '6-max constrained desktop');
  if (!constrainedDesktop?.table || constrainedDesktop.table.width < 360) {
    failures.push(`6-max constrained desktop: table width ${constrainedDesktop?.table?.width ?? 'missing'}px is below the functional floor`);
  }
  for (const finding of findings.filter((entry) => (
    entry.visualState === 'live_decision'
    && entry.layout === 'balanced'
    && entry.viewport[0] >= 1920
  ))) {
    if (finding.tableRegionOccupancy < 0.96) {
      failures.push(`${finding.label}: table uses only ${finding.tableRegionOccupancy} of its allocated region`);
    }
    if (finding.tableBodyOccupancy < 0.86) {
      failures.push(`${finding.label}: physical table body uses only ${finding.tableBodyOccupancy} of its allocated region`);
    }
  }
  const huLive = findings.find((finding) => finding.label === 'HU live');
  const fourLive = findings.find((finding) => finding.label === '4-max live');
  const fullRing = findings.find((finding) => finding.label === '10-max live');
  const review = findings.find((finding) => finding.label === 'Replay review');
  const inProgressReplay = findings.find((finding) => finding.label === 'In-progress Replay');
  if (huLive?.seats.length !== 2 || huLive?.geometryFamily !== 'hu') failures.push('HU did not use the HU geometry family');
  if (fourLive?.seats.length !== 4 || fourLive?.geometryFamily !== 'sparse') failures.push('4-max did not use the sparse geometry family');
  if (fullRing?.seats.length !== 10 || fullRing?.geometryFamily !== 'full_ring') failures.push('10-max did not use the full-ring family');
  if (!review?.reviewOpen || !review?.reviewSurface || !review?.reviewOverview
    || !review?.reviewNavigation || !review?.reviewDetail || !review?.reviewReplayRail) {
    failures.push('Replay review did not expose the desktop overview/navigation, decision detail, and Replay/history rail');
  }
  if (review?.historyParentId !== 'handReviewReplayRailMount') {
    failures.push('Replay review did not move the single canonical history into the right rail');
  }
  if (!inProgressReplay?.returnToLiveVisible) failures.push('In-progress Replay does not expose Return to live');
  for (const finding of findings.filter((entry) => entry.label !== 'In-progress Replay')) {
    if (finding.returnToLiveVisible) failures.push(`${finding.label}: Return to live is visible outside in-progress Replay`);
  }
  if (inProgressReplay?.table
    && Math.abs(inProgressReplay.table.width - inProgressReplay.liveTableWidthBeforeReplay) > 2) {
    failures.push('Live and Replay table geometry is not stable');
  }
  if (fullRing?.foldedCount !== 3) failures.push(`10-max folded fixture expected 3 readable folded seats, found ${fullRing?.foldedCount ?? 'missing'}`);
  if (!raiseReentry.inputEnabled || !raiseReentry.rangeEnabled || !raiseReentry.commitEnabled
    || !raiseReentry.validInitial || !raiseReentry.invalidBlocked || !raiseReentry.validRestored) {
    failures.push(`Raise sizing did not recover canonical enabled/validation state after Replay: ${JSON.stringify(raiseReentry)}`);
  }
  if (exactChanceCommit.fixture?.status !== 'chance' || exactChanceCommit.requiredCount !== 3
    || !exactChanceCommit.initiallyDisabled || !exactChanceCommit.enabledAtExactCount
    || exactChanceCommit.committedStreet !== 'flop' || exactChanceCommit.actingPlayerId !== null) {
    failures.push(`Exact-card all-in chance commit failed: ${JSON.stringify(exactChanceCommit)}`);
  }
  if (historyDisclosureKeyboard.collapsed.open !== false
    || historyDisclosureKeyboard.expanded.open !== true
    || !historyDisclosureKeyboard.expanded.scrollable) {
    failures.push(`Whole-history disclosure/scroll keyboard contract failed: ${JSON.stringify(historyDisclosureKeyboard)}`);
  }
  if (invalidTableSize.invalid.value !== '20' || !invalidTableSize.invalid.error
    || !invalidTableSize.invalid.errorVisible || !invalidTableSize.invalid.startDisabled
    || invalidTableSize.corrected.value !== '6' || !invalidTableSize.corrected.errorHidden
    || !invalidTableSize.corrected.startEnabled) {
    failures.push(`Invalid table-size input was clamped or failed to block initialization: ${JSON.stringify(invalidTableSize)}`);
  }
  if (knownOpponentRailStability.tableTopDelta > 1
    || knownOpponentRailStability.tableLeftDelta > 1
    || knownOpponentRailStability.tableWidthDelta > 1
    || knownOpponentRailStability.tableHeightDelta > 1
    || knownOpponentRailStability.editor.rowCount !== 9
    || !knownOpponentRailStability.editor.scrollable
    || knownOpponentRailStability.editor.overflowY !== 'auto'
    || knownOpponentRailStability.editor.summaryPosition !== 'sticky'
    || knownOpponentRailStability.editor.railOverflowY !== 'auto'
    || !knownOpponentRailStability.editor.railViewportBounded
    || !knownOpponentRailStability.editor.lastRowReachable) {
    failures.push(`Known-opponent editor changed table geometry or lost bounded access: ${JSON.stringify(knownOpponentRailStability)}`);
  }
  if (!abortHand.setupState.hidden || !abortHand.setupState.disabled
    || abortHand.setupState.parentSection !== 'handStateSection'
    || !abortHand.activeState.visible || !abortHand.activeState.enabled
    || !abortHand.terminalState.hidden || !abortHand.terminalState.disabled
    || !abortHand.cancelledUnchanged || !abortHand.canonicalCleared
    || !abortHand.replayCleared || !abortHand.setupVisible) {
    failures.push(`Abort Hand confirmation/reset contract failed: ${JSON.stringify(abortHand)}`);
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

  process.stdout.write(`${JSON.stringify({
    browser: await browser.version(), artifactRoot, raiseReentry, exactChanceCommit,
    historyDisclosureKeyboard, invalidTableSize, knownOpponentRailStability,
    abortHand, findings, failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
