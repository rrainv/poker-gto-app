#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-layout-presets001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const errors = [];

function createStaticServer() {
  const types = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relativePath || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function settle(page, milliseconds = 420) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigate(page, destination) {
  await page.click(`.mode-nav-item[data-navigation-id="${destination}"]`);
  await page.waitForFunction((expected) => (
    document.documentElement.dataset.layoutWorkspace === expected
  ), {}, destination);
  await settle(page);
}

async function openSettings(page) {
  await page.click('#openSettings');
  await page.waitForFunction(() => document.querySelector('#settingsModal')?.classList.contains('show'));
}

async function closeSettings(page) {
  await page.click('#closeSettingsModal');
  await page.waitForFunction(() => !document.querySelector('#settingsModal')?.classList.contains('show'));
}

async function setLayout(page, preset) {
  await openSettings(page);
  await page.click(`[data-layout-preset-option="${preset}"]`);
  await page.waitForFunction((expected) => document.documentElement.dataset.layoutPreset === expected, {}, preset);
  await closeSettings(page);
  await settle(page);
}

async function generateTraining(page, { street = 'preflop', target = 'preflop_facing_open', seed = 100100 } = {}) {
  await page.evaluate(({ nextStreet, nextTarget, nextSeed }) => {
    const setValue = (selector, value, eventName) => {
      const input = document.querySelector(selector);
      input.value = value;
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    };
    setValue('#trainingPlayers', '6', 'input');
    setValue('#trainingHeroPos', 'BTN', 'change');
    setValue('#trainingStreet', nextStreet, 'change');
    setValue('#trainingDecisionTarget', nextTarget, 'change');
    setValue('#trainingSeedInput', String(nextSeed), 'input');
    document.querySelector('#trainingGenerateSeed').click();
  }, { nextStreet: street, nextTarget: target, nextSeed: seed });
  await page.waitForFunction((expectedSeed) => app.training.lifecycle === 'ready'
    && app.training.currentExercise?.seed === expectedSeed
    && document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0, {}, seed);
  await settle(page);
}

async function setHandTableSize(page, tableSize) {
  await page.evaluate((nextTableSize) => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: nextTableSize,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
  }, tableSize);
  await page.waitForFunction((expected) => document.querySelectorAll('#visual-table-container .table-seat').length === expected, {}, tableSize);
  await settle(page);
}

async function createHandFixture(page, { tableSize = 2, revealOpponents = false, complete = false } = {}) {
  const result = await page.evaluate(({ count, revealAll, shouldComplete }) => {
    const bridge = window.RiverlinePlaybookState;
    const knownHands = [
      ['Ts', '9h'], ['Jd', 'Tc'], ['As', 'Kd'], ['Qh', 'Qs'], ['8c', '7d'],
      ['6s', '5h'], ['4c', '3d'], ['Ah', 'Kh'], ['Qc', 'Jc'], ['9d', '8d'],
    ];
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
    const initialized = bridge.getState();
    const heroPlayerId = bridge.getHeroPlayerId();
    if (revealAll) {
      bridge.dealHoleCards(Object.fromEntries(
        initialized.players.map((player, index) => [player.playerId, knownHands[index]]),
      ));
    } else {
      bridge.dealObservedHoleCards({ [heroPlayerId]: knownHands[0] });
    }
    if (shouldComplete) {
      const legal = bridge.getLegalActions();
      if (!legal?.fold?.available) throw new Error('Firefox fixture expected a legal Hero fold');
      bridge.applyAction('fold');
    }
    window.renderCanonicalHandWorkspace();
    return {
      stage: document.querySelector('#gtoMode')?.dataset.handStage,
      playerCount: bridge.getState()?.players?.length ?? 0,
      terminal: bridge.getState()?.terminal?.isTerminal === true,
    };
  }, { count: tableSize, revealAll: revealOpponents, shouldComplete: complete });
  await page.waitForFunction((expectedStage) => document.querySelector('#gtoMode')?.dataset.handStage === expectedStage, {}, result.stage);
  await settle(page);
  return result;
}

async function openCompletedHandReview(page) {
  await page.click('#handCompletedReviewButton');
  await page.waitForSelector('#handReviewSurface:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#gtoMode')?.dataset.handStage === 'replay');
  await settle(page);
}

async function setEquityPlayerCount(page, count) {
  if ([2, 6, 9].includes(count)) {
    await page.click(`[data-equity-player-count="${count}"]`);
  } else {
    await page.evaluate((targetCount) => {
      const current = document.querySelectorAll('.equity-player-card').length;
      const button = document.querySelector(targetCount > current ? '#equityIncreasePlayers' : '#equityDecreasePlayers');
      for (let index = current; index !== targetCount; index += targetCount > current ? 1 : -1) button.click();
    }, count);
  }
  await page.waitForFunction((expected) => document.querySelectorAll('.equity-player-card').length === expected, {}, count);
  await settle(page);
}

async function calculateUnknownEquity(page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-equity-hand-mode="unknown"]').forEach((button) => {
      if (button.getAttribute('aria-pressed') !== 'true') button.click();
    });
  });
  await page.select('#calcStyle', 'sim');
  await page.select('#trials', '10000');
  await page.waitForFunction(() => document.querySelector('#calculate')?.disabled === false);
  await page.click('#calculate');
  await page.waitForFunction(() => document.querySelector('.equity-workspace')?.dataset.equityState === 'complete', { timeout: 60_000 });
  await settle(page);
}

async function availablePresets(page) {
  await openSettings(page);
  const state = await page.evaluate(() => ({
    fieldHidden: document.querySelector('[data-layout-preset-field]')?.hidden,
    presets: [...document.querySelectorAll('[data-layout-preset-option]')]
      .filter((button) => !button.hidden)
      .map((button) => button.dataset.layoutPresetOption),
    buttonRows: [...new Set([...document.querySelectorAll('[data-layout-preset-option]')]
      .filter((button) => !button.hidden)
      .map((button) => Math.round(button.getBoundingClientRect().top)))],
  }));
  await closeSettings(page);
  return state;
}

async function captureSelector(page, id, label) {
  await openSettings(page);
  await page.$eval('[data-layout-preset-field]', (element) => element.scrollIntoView({ block: 'center' }));
  await settle(page);
  const state = await page.evaluate((stateLabel) => {
    const control = document.querySelector('#layoutPresetControl');
    const buttons = [...control.querySelectorAll('[data-layout-preset-option]')]
      .filter((button) => !button.hidden);
    return {
      label: stateLabel,
      language: document.documentElement.lang,
      direction: document.documentElement.dir || 'ltr',
      presets: buttons.map((button) => button.dataset.layoutPresetOption),
      buttonRows: [...new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)))],
      controlOverflow: control.scrollWidth - control.clientWidth,
      clippedButtons: buttons
        .filter((button) => button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.dataset.layoutPresetOption),
    };
  }, label);
  const screenshot = path.join(artifactRoot, `${id}.png`);
  await page.screenshot({ path: screenshot, type: 'png' });
  await closeSettings(page);
  return { ...state, screenshot };
}

async function inspect(page, label) {
  return page.evaluate((stateLabel) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === 'none' || !element.getClientRects().length) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        bottom: Math.round(bounds.bottom),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const activeView = document.querySelector('.mode-view.active');
    const visible = (element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const firstRowCount = (selector) => {
      const elements = [...document.querySelectorAll(selector)].filter(visible);
      if (!elements.length) return 0;
      const firstTop = Math.min(...elements.map((element) => element.getBoundingClientRect().top));
      return elements.filter((element) => Math.abs(element.getBoundingClientRect().top - firstTop) <= 2).length;
    };
    const aboveFold = (selector) => {
      const element = document.querySelector(selector);
      if (!element || !visible(element)) return false;
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= innerHeight;
    };
    const tableCardIdentity = () => {
      const knownCards = [...document.querySelectorAll('#visual-table-container .poker-card-svg.card--known')].filter(visible);
      const hiddenCards = [...document.querySelectorAll('#visual-table-container .table-card-back[data-card-state="unknown"]')].filter(visible);
      const measurements = knownCards.map((card) => {
        const rank = [...card.querySelectorAll('.table-card-center-rank, .table-card-corner--top .table-card-corner-rank')].find(visible);
        const suit = [...card.querySelectorAll('.table-card-center-suit, .table-card-corner--top .table-card-corner-suit')].find(visible);
        const rankBounds = rank?.getBoundingClientRect();
        const suitBounds = suit?.getBoundingClientRect();
        return {
          suitId: card.dataset.cardSuitId,
          rank: rank?.textContent || '',
          suit: suit?.textContent || '',
          rankHeight: Math.round((rankBounds?.height || 0) * 10) / 10,
          suitHeight: Math.round((suitBounds?.height || 0) * 10) / 10,
        };
      });
      return {
        knownCount: knownCards.length,
        hiddenCount: hiddenCards.length,
        measurements,
        minRankHeight: measurements.length ? Math.min(...measurements.map((card) => card.rankHeight)) : 0,
        minSuitHeight: measurements.length ? Math.min(...measurements.map((card) => card.suitHeight)) : 0,
      };
    };
    const horizontalOverflows = activeView ? [...activeView.querySelectorAll('button, input, select, textarea, h1, h2, strong, p')]
      .filter(visible)
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1;
      })
      .map((element) => element.id || element.tagName) : [];
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir || 'ltr',
      density: document.documentElement.dataset.density,
      theme: document.documentElement.dataset.presentationThemeId,
      workspace: document.documentElement.dataset.layoutWorkspace,
      preset: document.documentElement.dataset.layoutPreset,
      handStage: document.querySelector('#gtoMode')?.dataset.handStage || null,
      handSetupOpen: document.querySelector('#handSetupDisclosure')?.open ?? null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      playbook: {
        workspace: rect('#gtoMode .playbook-workspace'),
        context: rect('#gtoMode .playbook-context-rail'),
        decision: rect('#gtoMode .playbook-decision-workspace'),
        support: rect('#gtoMode .playbook-support-rail'),
        table: rect('#visual-table-container'),
        seatCount: document.querySelectorAll('#visual-table-container .table-seat').length,
        handSetup: rect('#playbookHandWorkspace'),
        liveHeader: rect('#handLiveStageHeader'),
        stageDock: rect('#handStageDock'),
        review: rect('#handReviewSurface'),
        startAboveFold: aboveFold('#handStartButton'),
        privateCardsAboveFold: aboveFold('#handDealSection'),
        actionsAboveFold: aboveFold('#handActionSection'),
        completionAboveFold: aboveFold('#handCompletedReviewButton'),
        reviewNavigationAboveFold: aboveFold('#handReviewDecisionNavigationTitle'),
        replayControlsAboveFold: aboveFold('#handReplayControls'),
        cardIdentity: tableCardIdentity(),
      },
      training: {
        state: document.querySelector('.training-workspace')?.dataset.trainingState || null,
        context: rect('.training-context-strip'),
        decision: rect('.training-decision-column'),
        solution: rect('#trainingSolution'),
        history: rect('#trainingHistoryPanel'),
        session: rect('.training-session-panel'),
        setup: rect('#trainingSetupPanel'),
        assistance: rect('.training-assistance-panel'),
        setupAboveFold: aboveFold('#trainingSetupPanel'),
        sessionAboveFold: aboveFold('.training-session-panel'),
        actionsAboveFold: aboveFold('#trainingGuessButtons'),
        assistanceOpen: document.querySelector('.training-assistance-panel')?.open ?? null,
        actionCount: document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length,
        actionColumns: getComputedStyle(document.querySelector('#trainingGuessButtons')).gridTemplateColumns.split(' ').filter(Boolean).length,
        facingFontSize: getComputedStyle(document.querySelector('#trainingFacingVal')).fontSize,
      },
      equity: {
        state: document.querySelector('.equity-workspace')?.dataset.equityState || null,
        workspace: rect('.equity-workspace'),
        input: rect('.equity-input-stack'),
        output: rect('.equity-output-stack'),
        shared: rect('.equity-shared-flow'),
        progress: rect('#progress'),
        playerCount: document.querySelectorAll('.equity-player-card').length,
        playerTilesFirstRow: firstRowCount('.equity-player-card'),
        resultTilesFirstRow: firstRowCount('.equity-player-results[data-result-state="complete"]'),
        pendingTileCount: document.querySelectorAll('.equity-player-results[data-result-state="pending"]').length,
        runningTileCount: document.querySelectorAll('.equity-player-results[data-result-state="running"]').length,
        completeTileCount: document.querySelectorAll('.equity-player-results[data-result-state="complete"]').length,
      },
    };
  }, label);
}

async function capture(page, id, label, settleMs = 420) {
  await page.evaluate(() => scrollTo(0, 0));
  await settle(page, settleMs);
  const state = await inspect(page, label);
  const screenshot = path.join(artifactRoot, `${id}.png`);
  await page.screenshot({ path: screenshot, type: 'png' });
  return { ...state, screenshot };
}

async function captureAt(page, id, label, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start', inline: 'nearest' }));
  await settle(page);
  const state = await inspect(page, label);
  const screenshot = path.join(artifactRoot, `${id}.png`);
  await page.screenshot({ path: screenshot, type: 'png' });
  return { ...state, screenshot };
}

function assertFinding(findings, condition, message) {
  if (!condition) findings.push(message);
}

const server = createStaticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationLayout));
  await page.evaluate(() => {
    localStorage.removeItem('riverline_presentation_layout');
    localStorage.removeItem('riverline_presentation_density');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationLayout));

  const states = [];
  const selectorStates = [];
  const availability = {};

  await navigate(page, 'hand');
  availability.hand = await availablePresets(page);
  selectorStates.push(await captureSelector(page, 'selector-hand-1920x1080-en', 'Hand selector / EN'));
  states.push(await capture(page, 'hand-balanced-1920x1080-en', 'Hand / Balanced'));
  await page.click('#handStartButton');
  await page.waitForFunction(() => document.querySelector('#gtoMode')?.dataset.handStage === 'private-cards');
  await settle(page);
  await createHandFixture(page);
  states.push(await capture(page, 'hand-balanced-action-1920x1080-en', 'Hand / Balanced / Live decision'));
  await createHandFixture(page, { complete: true });
  states.push(await capture(page, 'hand-balanced-complete-1920x1080-en', 'Hand / Balanced / Complete'));
  await openCompletedHandReview(page);
  states.push(await capture(page, 'hand-balanced-review-1920x1080-en', 'Hand / Balanced / Review'));
  await setLayout(page, 'table-focus');
  await createHandFixture(page);
  states.push(await capture(page, 'hand-table-focus-live-1920x1080-en', 'Hand / Table Focus / Live decision'));
  await setHandTableSize(page, 2);
  states.push(await capture(page, 'hand-table-focus-hu-1920x1080-en', 'Hand / Table Focus / HU'));
  await setHandTableSize(page, 6);
  states.push(await capture(page, 'hand-table-focus-6max-1920x1080-en', 'Hand / Table Focus / 6-max'));
  await setHandTableSize(page, 10);
  states.push(await capture(page, 'hand-table-focus-10max-1920x1080-en', 'Hand / Table Focus / 10-max'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationLayout));

  await navigate(page, 'hand');
  await setLayout(page, 'table-focus');
  await createHandFixture(page, { tableSize: 6, revealOpponents: true });
  await page.evaluate(() => window.RiverlineCardPresentation.apply({
    faceStyle: 'minimal', rankStyle: 'poker', fourColor: false,
  }));
  states.push(await captureAt(page, 'hand-table-focus-known-opponents-2color-1920x1080-en', 'Hand / Table Focus / Known opponents / 2-color T', '#table-wrapper'));
  await page.evaluate(() => window.RiverlineCardPresentation.apply({
    faceStyle: 'classic', rankStyle: 'full-ten', fourColor: true,
  }));
  states.push(await captureAt(page, 'hand-table-focus-known-opponents-4color-1920x1080-en', 'Hand / Table Focus / Known opponents / 4-color 10', '#table-wrapper'));
  await navigate(page, 'analyze');
  await page.evaluate(() => {
    app.gto.hero = ['Ts', 'Jd'];
    app.gto.board = ['Ah', 'Kh', 'Qc', '7d', '2s'];
    app.gto.dead = [];
    renderAllCards({ mode: 'gto' });
    updateContext('WORKSPACE-COMPOSITION-002 Firefox audit');
  });
  await page.waitForFunction(() => document.querySelectorAll('.playbook-board-cards > .card-slot.filled').length === 5);
  await settle(page);
  availability.analyze = await availablePresets(page);
  states.push(await capture(page, 'analyze-balanced-1920x1080-en', 'Analyze / Balanced'));
  await setLayout(page, 'analysis-focus');
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-en', 'Analyze / Analysis Focus'));
  await page.evaluate(() => window.RiverlineCardPresentation.apply({
    faceStyle: 'minimal', rankStyle: 'poker', fourColor: false,
  }));
  states.push(await captureAt(page, 'analyze-analysis-focus-known-cards-2color-1920x1080-en', 'Analyze / Analysis Focus / Known cards / 2-color T', '#table-wrapper'));
  await page.evaluate(() => window.RiverlineCardPresentation.apply({
    faceStyle: 'classic', rankStyle: 'full-ten', fourColor: true,
  }));
  states.push(await captureAt(page, 'analyze-analysis-focus-known-cards-4color-1920x1080-en', 'Analyze / Analysis Focus / Known cards / 4-color 10', '#table-wrapper'));

  await navigate(page, 'training');
  availability.training = await availablePresets(page);
  states.push(await capture(page, 'training-idle-balanced-1920x1080-en', 'Training / Idle / Balanced'));
  await page.click('[data-training-session-mode="focused"]');
  await generateTraining(page);
  states.push(await capture(page, 'training-ready-four-actions-1920x1080-en', 'Training / Ready / Four actions'));
  await page.click('#trainingGuessButtons button:not([hidden])');
  await page.waitForFunction(() => document.querySelector('.training-workspace')?.dataset.trainingState === 'feedback');
  await page.evaluate(() => window.RiverlinePresentationTheme.apply('daylight'));
  states.push(await capture(page, 'training-feedback-1920x1080-en', 'Training / Feedback'));

  await navigate(page, 'personal-strategy');
  availability['personal-strategy'] = await availablePresets(page);
  await navigate(page, 'equity');
  await page.evaluate(() => window.RiverlinePresentationTheme.apply('midnight'));
  availability.equity = await availablePresets(page);
  states.push(await capture(page, 'equity-empty-balanced-1920x1080-en', 'Equity / Empty / Balanced'));
  for (const playerCount of [3, 6, 9]) {
    await setEquityPlayerCount(page, playerCount);
    states.push(await capture(
      page,
      `equity-empty-${playerCount}-1920x1080-en`,
      `Equity / Empty / ${playerCount}`,
    ));
    await calculateUnknownEquity(page);
    states.push(await capture(
      page,
      `equity-result-${playerCount}-1920x1080-en`,
      `Equity / Result / ${playerCount}`,
    ));
  }
  await setEquityPlayerCount(page, 3);
  await calculateUnknownEquity(page);
  states.push(await capture(page, 'equity-result-balanced-1920x1080-en', 'Equity / Result / Balanced'));
  await navigate(page, 'saved');
  availability.saved = await availablePresets(page);
  await navigate(page, 'home');
  availability.home = await availablePresets(page);

  await navigate(page, 'hand');
  await setLayout(page, 'table-focus');
  await navigate(page, 'analyze');
  await setLayout(page, 'analysis-focus');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationLayout));
  await navigate(page, 'hand');
  const restoredHandValue = await page.evaluate(() => document.documentElement.dataset.layoutPreset);
  await navigate(page, 'analyze');
  const restoredAnalyzeValue = await page.evaluate(() => document.documentElement.dataset.layoutPreset);

  await page.evaluate(() => window.setLanguage('ru'));
  await settle(page);
  selectorStates.push(await captureSelector(page, 'selector-analyze-1920x1080-ru', 'Analyze selector / RU'));
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-ru', 'Analyze / Analysis Focus / RU'));
  await page.evaluate(() => window.setLanguage('he'));
  await page.evaluate(() => window.RiverlinePresentationTheme.apply('daylight'));
  await settle(page);
  selectorStates.push(await captureSelector(page, 'selector-analyze-1920x1080-he', 'Analyze selector / HE'));
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-he', 'Analyze / Analysis Focus / HE'));

  await page.evaluate(() => {
    window.setLanguage('en');
    window.RiverlinePresentationTheme.apply('midnight');
  });
  await page.setViewport({ width: 2560, height: 1440, deviceScaleFactor: 1 });
  await navigate(page, 'hand');
  await setHandTableSize(page, 10);
  states.push(await capture(page, 'hand-table-focus-2560x1440-en', 'Hand / Table Focus / 2560x1440'));
  await page.setViewport({ width: 2560, height: 1600, deviceScaleFactor: 1 });
  await navigate(page, 'analyze');
  states.push(await capture(page, 'analyze-analysis-focus-2560x1600-en', 'Analyze / Analysis Focus / 2560x1600'));
  await navigate(page, 'equity');
  await setEquityPlayerCount(page, 9);
  await calculateUnknownEquity(page);
  states.push(await capture(page, 'equity-result-9-2560x1600-en', 'Equity / Result / 9 / 2560x1600'));

  await page.setViewport({ width: 3840, height: 2160, deviceScaleFactor: 1 });
  await navigate(page, 'hand');
  await setLayout(page, 'table-focus');
  await setHandTableSize(page, 10);
  states.push(await capture(page, 'hand-table-focus-3840x2160-en', 'Hand / Table Focus / 4K'));

  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await navigate(page, 'analyze');
  await setLayout(page, 'analysis-focus');
  states.push(await capture(page, 'analyze-analysis-focus-1366x768-en', 'Analyze / Analysis Focus / 1366x768'));

  await page.evaluate(() => window.setLanguage('he'));
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await navigate(page, 'hand');
  await setLayout(page, 'balanced');
  states.push(await capture(page, 'hand-balanced-1024x768-he', 'Hand / Balanced / 1024 / HE'));

  const findings = [];
  const byLabel = Object.fromEntries(states.map((state) => [state.label, state]));
  const handBalancedLive = byLabel['Hand / Balanced / Live decision'];
  const handBalancedComplete = byLabel['Hand / Balanced / Complete'];
  const handBalancedReview = byLabel['Hand / Balanced / Review'];
  const handTable = byLabel['Hand / Table Focus / Live decision'];
  const analyzeBalanced = byLabel['Analyze / Balanced'];
  const analyzeFocus = byLabel['Analyze / Analysis Focus'];
  const analyzeKnownTwoColor = byLabel['Analyze / Analysis Focus / Known cards / 2-color T'];
  const analyzeKnownFourColor = byLabel['Analyze / Analysis Focus / Known cards / 4-color 10'];
  const trainingIdle = byLabel['Training / Idle / Balanced'];
  const trainingReady = byLabel['Training / Ready / Four actions'];
  const trainingFeedback = byLabel['Training / Feedback'];
  const equityEmpty = byLabel['Equity / Empty / Balanced'];
  const equityResult = byLabel['Equity / Result / Balanced'];
  const handHu = byLabel['Hand / Table Focus / HU'];
  const handSix = byLabel['Hand / Table Focus / 6-max'];
  const handTen = byLabel['Hand / Table Focus / 10-max'];
  const handKnownTwoColor = byLabel['Hand / Table Focus / Known opponents / 2-color T'];
  const handKnownFourColor = byLabel['Hand / Table Focus / Known opponents / 4-color 10'];
  const narrow = byLabel['Hand / Balanced / 1024 / HE'];

  assertFinding(findings, handTable.playbook.decision.width > handBalancedLive.playbook.decision.width + 100, 'Hand Table Focus did not materially widen the live primary stage');
  assertFinding(findings, handTable.playbook.decision.left < handTable.playbook.context.left, 'Hand Table Focus did not lead with the table stage');
  assertFinding(findings, handTable.playbook.table.width > handBalancedLive.playbook.table.width + 100, 'Hand Table Focus did not materially enlarge the live table');
  assertFinding(findings, handBalancedLive.handStage === 'action' && handBalancedLive.playbook.actionsAboveFold, 'Balanced Hand did not keep live action controls in the initial viewport');
  assertFinding(findings, handBalancedComplete.handStage === 'complete' && handBalancedComplete.playbook.completionAboveFold, 'Balanced Hand did not keep completion controls in the initial viewport');
  assertFinding(findings, handBalancedReview.handStage === 'replay' && handBalancedReview.playbook.reviewNavigationAboveFold, 'Balanced Hand Review did not surface decision navigation in the initial viewport');
  assertFinding(findings, handHu.playbook.seatCount === 2 && handSix.playbook.seatCount === 6 && handTen.playbook.seatCount === 10, 'Table Focus did not render HU, 6-max, and 10-max seat counts');
  assertFinding(findings, [handHu, handSix, handTen].every((state) => state.playbook.table.width > handBalancedLive.playbook.table.width + 100), 'Table Focus did not preserve a materially larger table across table sizes');
  assertFinding(findings, analyzeFocus.playbook.decision.left < analyzeFocus.playbook.context.left && analyzeFocus.playbook.context.left === analyzeFocus.playbook.support.left, 'Analyze Analysis Focus did not create a leading stage with a stacked secondary rail');
  assertFinding(findings, analyzeFocus.playbook.support.top > analyzeFocus.playbook.context.top, 'Analyze Analysis Focus did not place support below configuration');
  assertFinding(findings, analyzeFocus.playbook.table.width >= 900, 'Analyze Analysis Focus table remained below its readable desktop scale floor');
  assertFinding(findings, analyzeKnownTwoColor.playbook.cardIdentity.knownCount >= 2 && analyzeKnownFourColor.playbook.cardIdentity.knownCount >= 2, 'Analyze known Hero cards were not rendered');
  assertFinding(findings, analyzeKnownTwoColor.playbook.cardIdentity.minRankHeight >= 8 && analyzeKnownTwoColor.playbook.cardIdentity.minSuitHeight >= 9, 'Analyze 2-color T cards fell below the perceptual rank/suit floor');
  assertFinding(findings, analyzeKnownFourColor.playbook.cardIdentity.minRankHeight >= 8 && analyzeKnownFourColor.playbook.cardIdentity.minSuitHeight >= 9, 'Analyze 4-color 10 cards fell below the perceptual rank/suit floor');
  assertFinding(findings, analyzeKnownFourColor.playbook.cardIdentity.measurements.some((card) => card.rank === '10'), 'Full-ten table-card rendering was not exercised');
  assertFinding(findings, handKnownTwoColor.playbook.cardIdentity.knownCount >= 12 && handKnownFourColor.playbook.cardIdentity.knownCount >= 12, 'Hand known Hero/opponent cards were not rendered');
  assertFinding(findings, handKnownTwoColor.playbook.cardIdentity.minRankHeight >= 8 && handKnownTwoColor.playbook.cardIdentity.minSuitHeight >= 9, '2-color known opponent cards fell below the perceptual rank/suit floor');
  assertFinding(findings, handKnownFourColor.playbook.cardIdentity.minRankHeight >= 8 && handKnownFourColor.playbook.cardIdentity.minSuitHeight >= 9, '4-color known opponent cards fell below the perceptual rank/suit floor');
  assertFinding(findings, handKnownFourColor.playbook.cardIdentity.measurements.some((card) => card.rank === '10'), 'Full-ten known-opponent rendering was not exercised');
  assertFinding(findings, handBalancedLive.playbook.cardIdentity.hiddenCount >= 2, 'Hidden opponent cards stopped rendering as hidden backs');
  assertFinding(findings, trainingIdle.training.decision.left < trainingIdle.training.setup.left, 'Training idle state did not keep setup prominent beside the decision');
  assertFinding(findings, trainingIdle.training.setupAboveFold && trainingIdle.training.sessionAboveFold, 'Training idle did not keep Drill Setup and Session Progress above the fold');
  assertFinding(findings, trainingReady.training.decision.left < trainingReady.training.setup.left, 'Training ready state did not keep the decision primary');
  assertFinding(findings, trainingReady.training.setup.top < trainingReady.training.session.top, 'Training ready did not place Drill Setup before Session Progress');
  assertFinding(findings, trainingReady.training.setupAboveFold && trainingReady.training.sessionAboveFold && trainingReady.training.actionsAboveFold, 'Training ready did not expose actions, Drill Setup, and Session Progress without scrolling');
  assertFinding(findings, trainingReady.training.assistanceOpen === false, 'Training Assistance remained a permanent expanded prime panel');
  assertFinding(findings, Boolean(trainingReady.training.history), 'Training Action History stopped being accessible');
  assertFinding(findings, trainingReady.training.actionCount === 4 && trainingReady.training.actionColumns === 4, 'Training four-action state did not remain one readable row at 1920');
  assertFinding(findings, trainingFeedback.training.state === 'feedback' && trainingFeedback.training.solution.top < trainingFeedback.training.setup.top, 'Training feedback state did not promote source feedback above setup');
  assertFinding(findings, Number.parseFloat(trainingReady.training.facingFontSize) >= 14, 'Training Facing headline became too small');
  assertFinding(findings, equityEmpty.equity.state === 'empty' && equityEmpty.equity.input.width > equityEmpty.equity.output.width * 2, 'Equity empty state did not let input work own the canvas');
  assertFinding(findings, equityResult.equity.state === 'complete' && Math.abs(equityResult.equity.input.width - equityEmpty.equity.input.width) <= 2, 'Equity completion changed the player-tile surface width');
  for (const playerCount of [3, 6, 9]) {
    const empty = byLabel[`Equity / Empty / ${playerCount}`];
    const result = byLabel[`Equity / Result / ${playerCount}`];
    assertFinding(findings, empty.equity.playerCount === playerCount && empty.equity.pendingTileCount === playerCount, `Equity ${playerCount}-player input did not retain one pending region per tile`);
    assertFinding(findings, empty.equity.playerTilesFirstRow >= 2, `Equity ${playerCount}-player input collapsed to one tile per row`);
    assertFinding(findings, result.equity.completeTileCount === playerCount, `Equity ${playerCount}-player result did not add metrics to every player tile`);
    assertFinding(findings, result.equity.playerTilesFirstRow === empty.equity.playerTilesFirstRow, `Equity ${playerCount}-player result changed the tile columns after calculation`);
  }
  assertFinding(findings, trainingFeedback.theme === 'daylight' && states.some((state) => state.theme === 'midnight'), 'Midnight/Daylight theme sampling did not complete');
  assertFinding(findings, states.every((state) => state.density === 'comfortable'), 'A legacy density preference changed the supported default composition');
  assertFinding(findings, restoredHandValue === 'table-focus' && restoredAnalyzeValue === 'analysis-focus', 'Per-workspace preset restoration failed');
  assertFinding(findings, narrow.playbook.context.width === narrow.playbook.decision.width, '1024 presets did not converge to the safe full-width stack');
  assertFinding(findings, narrow.direction === 'rtl' && narrow.language === 'he', 'Hebrew RTL state failed');
  assertFinding(findings, availability.home.fieldHidden && availability.saved.fieldHidden, 'Home or Saved exposed meaningless layout choices');
  assertFinding(findings, Object.values(availability).every((entry) => entry.fieldHidden || entry.buttonRows.length === 1), 'Supported preset buttons did not render in one horizontal row');
  assertFinding(findings, JSON.stringify(availability.hand.presets) === JSON.stringify(['balanced', 'table-focus']), 'Hand availability mismatch');
  assertFinding(findings, JSON.stringify(availability.analyze.presets) === JSON.stringify(['balanced', 'analysis-focus']), 'Analyze availability mismatch');
  assertFinding(findings, availability.training.fieldHidden && JSON.stringify(availability.training.presets) === JSON.stringify(['balanced']), 'Training should expose only state-aware Balanced');
  assertFinding(findings, availability['personal-strategy'].fieldHidden && JSON.stringify(availability['personal-strategy'].presets) === JSON.stringify(['balanced']), 'Personal Strategy availability mismatch');
  assertFinding(findings, availability.equity.fieldHidden && JSON.stringify(availability.equity.presets) === JSON.stringify(['balanced']), 'Equity availability mismatch');
  for (const state of states) {
    assertFinding(findings, state.documentOverflowX <= 1 && !state.horizontalOverflows.length, `${state.label}: horizontal overflow detected`);
  }
  for (const state of selectorStates) {
    assertFinding(findings, state.buttonRows.length === 1, `${state.label}: selector did not stay in one horizontal row`);
    assertFinding(findings, state.controlOverflow <= 1 && !state.clippedButtons.length, `${state.label}: selector label overflow detected`);
  }
  assertFinding(findings, selectorStates.find((state) => state.language === 'he')?.direction === 'rtl', 'Hebrew selector did not inherit RTL direction');
  if (errors.length) findings.push(`${errors.length} Firefox page error(s)`);

  const report = {
    schemaVersion: 'workspace-composition002-firefox-audit/v2',
    browser: await browser.version(),
    artifactRoot,
    availability,
    selectorStates,
    restoration: { hand: restoredHandValue, analyze: restoredAnalyzeValue },
    states,
    errors,
    findings,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = findings.length ? 2 : 0;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
