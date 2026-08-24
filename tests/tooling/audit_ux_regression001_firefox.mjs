#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-ux-regression001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const pageErrors = [];
const findings = [];

function staticServer() {
  const types = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function settle(page, milliseconds = 240) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function screenshot(page, id) {
  const filePath = path.join(artifactRoot, `${id}.png`);
  await page.screenshot({ path: filePath, type: 'png' });
  return filePath;
}

async function configure(page, { width, height, theme, language, layout = 'balanced' }) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluate(({ nextTheme, nextLanguage, nextLayout }) => {
    window.RiverlinePresentationTheme.apply(nextTheme);
    window.RiverlinePresentationLayout.apply(nextLayout);
    window.setLanguage(nextLanguage);
  }, { nextTheme: theme, nextLanguage: language, nextLayout: layout });
  await settle(page);
  const actual = await page.evaluate(() => ({
    theme: document.documentElement.dataset.presentationThemeId,
    language: document.documentElement.lang,
    layout: document.documentElement.dataset.layoutPreset,
  }));
  if (actual.theme !== theme || actual.language !== language || actual.layout !== layout) {
    throw new Error(`Presentation configuration mismatch: ${JSON.stringify({ expected: { theme, language, layout }, actual })}`);
  }
}

async function navigate(page, destination) {
  await page.click(`.mode-nav-item[data-navigation-id="${destination}"]`);
  await page.waitForFunction((expected) => (
    document.querySelector(`.mode-nav-item[data-navigation-id="${expected}"]`)?.getAttribute('aria-current') === 'page'
  ), {}, destination);
  await settle(page);
}

async function prepareScenario(page) {
  await navigate(page, 'analyze');
  await page.evaluate(() => {
    app.gto.hero = ['As', 'Ks'];
    app.gto.board = ['Ah', 'Kd', '7c', '2s', '9h'];
    app.gto.dead = [];
    renderAllCards({ mode: 'gto' });
    updateContext('UX-REGRESSION-001 Firefox audit');
  });
  await page.waitForFunction(() => document.querySelectorAll('.playbook-board-cards > .card-slot.filled').length === 5);
  await page.$eval('.playbook-board-layout', (element) => element.scrollIntoView({ block: 'center' }));
  await settle(page);
}

async function inspectBoard(page, label) {
  const finding = await page.evaluate((stateLabel) => {
    const layout = document.querySelector('.playbook-board-layout');
    const slots = [...document.querySelectorAll('.playbook-board-cards > .card-slot')];
    const guides = [...document.querySelectorAll('.playbook-board-street-guide [data-playbook-street]')];
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left), top: Math.round(bounds.top), right: Math.round(bounds.right),
        bottom: Math.round(bounds.bottom), width: Math.round(bounds.width), height: Math.round(bounds.height),
      };
    };
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.presentationThemeId,
      layoutPreset: document.documentElement.dataset.layoutPreset,
      layoutDirection: getComputedStyle(layout).direction,
      layout: rect(layout),
      cards: slots.map((slot) => ({ label: slot.getAttribute('aria-label'), ...rect(slot) })),
      streetLabels: guides.map((guide) => ({ street: guide.dataset.playbookStreet, text: guide.textContent.trim(), ...rect(guide) })),
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, label);
  finding.screenshot = await screenshot(page, label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'));
  findings.push(finding);
  return finding;
}

async function inspectPicker(page, label) {
  await page.click('.card-slot[data-group="hero"][data-index="0"]');
  await page.waitForFunction(() => document.querySelector('#cardModal')?.classList.contains('show'));
  await settle(page);
  const finding = await page.evaluate((stateLabel) => {
    const buttons = [...document.querySelectorAll('#deck .deck-card')];
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
    };
    const modal = rect(document.querySelector('#cardModal .modal'));
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.presentationThemeId,
      count: buttons.length,
      minimumWidth: Math.min(...buttons.map((button) => rect(button).width)),
      minimumHeight: Math.min(...buttons.map((button) => rect(button).height)),
      modalWithinViewport: modal.left >= -1 && modal.top >= -1 && modal.right <= innerWidth + 1 && modal.bottom <= innerHeight + 1,
      rankFontSize: getComputedStyle(buttons[0].querySelector('.rank')).fontSize,
      suitFontSize: getComputedStyle(buttons[0].querySelector('.suit')).fontSize,
    };
  }, label);
  finding.screenshot = await screenshot(page, label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'));
  findings.push(finding);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#cardModal')?.classList.contains('show'));
  return finding;
}

async function auditHomeGame(page) {
  await configure(page, { width: 1366, height: 900, theme: 'midnight', language: 'en' });
  try {
    await page.waitForFunction(() => Boolean(window.RiverlineHomeGame), { timeout: 15_000 });
  } catch {
    const diagnostic = await page.evaluate(() => ({
      authentication: window.RiverlineAuthentication?.getState?.() ?? null,
      accountIdentity: Boolean(window.RiverlineAccountIdentity),
      error: document.querySelector('#homeGameError')?.textContent || null,
      readyState: document.readyState,
    }));
    throw new Error(`Home Game bridge did not settle: ${JSON.stringify({ diagnostic, pageErrors })}`);
  }
  await navigate(page, 'home-game');
  await page.waitForFunction(() => document.querySelector('#homeGameWorkspace')?.getAttribute('aria-busy') === 'false'
    && document.querySelector('#homeGameCreateButton')?.disabled === false);
  await page.$eval('#homeGameSessionTitle', (input) => { input.value = 'UX route audit'; });
  await page.$eval('#homeGamePlayerNames', (input) => { input.value = 'Dana\nAlex\nMaya'; });
  await page.$eval('#homeGameInitialBuyIn', (input) => { input.value = '50'; });
  const beforeUrl = page.url();
  await page.$eval('#homeGameNewSessionForm', (form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector('.home-game-active-session h2')?.textContent === 'UX route audit');
  await page.$eval('#homeGameSession', (element) => element.scrollIntoView({ block: 'start' }));
  await settle(page);
  const finding = await page.evaluate((stateBeforeUrl) => ({
    label: 'Home Game creation route',
    beforeUrl: stateBeforeUrl,
    afterUrl: location.href,
    navigationCurrent: document.querySelector('[data-navigation-id="home-game"]')?.getAttribute('aria-current'),
    activeMode: document.querySelector('.mode-view.active')?.id,
    workspaceBusy: document.querySelector('#homeGameWorkspace')?.getAttribute('aria-busy'),
    title: document.querySelector('.home-game-active-session h2')?.textContent,
    players: [...document.querySelectorAll('.home-game-player-card h3')].map((entry) => entry.textContent),
  }), beforeUrl);
  finding.screenshot = await screenshot(page, 'home-game-created-1366x900-midnight-en');
  findings.push(finding);
  return finding;
}

async function generateTraining(page, { street, target, seed }) {
  await page.evaluate(({ nextStreet, nextTarget, nextSeed }) => {
    const streetInput = document.querySelector('#trainingStreet');
    const targetInput = document.querySelector('#trainingDecisionTarget');
    const seedInput = document.querySelector('#trainingSeedInput');
    const playerInput = document.querySelector('#trainingPlayers');
    const positionInput = document.querySelector('#trainingHeroPos');
    playerInput.value = '6';
    playerInput.dispatchEvent(new Event('input', { bubbles: true }));
    positionInput.value = 'BTN';
    positionInput.dispatchEvent(new Event('change', { bubbles: true }));
    streetInput.value = nextStreet;
    streetInput.dispatchEvent(new Event('change', { bubbles: true }));
    targetInput.value = nextTarget;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    seedInput.value = String(nextSeed);
    seedInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#trainingGenerateSeed').click();
  }, { nextStreet: street, nextTarget: target, nextSeed: seed });
  try {
    await page.waitForFunction((expectedSeed) => app.training.lifecycle === 'ready'
      && app.training.currentExercise?.seed === expectedSeed
      && document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0, {}, seed);
  } catch {
    const diagnostic = await page.evaluate(() => ({
      lifecycle: app.training.lifecycle,
      seed: app.training.currentExercise?.seed ?? null,
      street: app.training.currentExercise?.decisionContext?.street ?? null,
      actionCount: document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length,
      errorTitle: document.querySelector('#trainingErrorTitle')?.textContent || null,
      errorText: document.querySelector('#trainingErrorText')?.textContent || null,
    }));
    throw new Error(`Training generation did not settle: ${JSON.stringify({ expected: { street, target, seed }, diagnostic })}`);
  }
  await settle(page);
}

async function inspectTraining(page, label) {
  await page.$eval('#trainingGuessButtons', (element) => element.scrollIntoView({ block: 'center' }));
  await settle(page);
  const finding = await page.evaluate((stateLabel) => {
    const grid = document.querySelector('#trainingGuessButtons');
    const buttons = [...grid.querySelectorAll('button:not([hidden])')];
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      street: app.training.currentExercise?.decisionContext?.street,
      actionCount: buttons.length,
      actionOrder: buttons.map((button) => button.dataset.action),
      gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      hint: document.querySelector('#trainingStudyHintContent')?.innerText || '',
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, label);
  finding.screenshot = await screenshot(page, label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'));
  findings.push(finding);
  return finding;
}

async function auditTraining(page) {
  await configure(page, { width: 1366, height: 900, theme: 'midnight', language: 'en' });
  await navigate(page, 'training');
  await page.click('[data-training-session-mode="focused"]');
  await generateTraining(page, { street: 'preflop', target: 'preflop_facing_open', seed: 100100 });
  await page.click('#trainingRevealHint');
  await page.waitForFunction(() => document.querySelector('#trainingStudyHintContent')?.innerText.trim().length > 0);
  const preflop = await inspectTraining(page, 'Training preflop hint and four actions 1366');

  await configure(page, { width: 1920, height: 1080, theme: 'daylight', language: 'he' });
  const wide = await inspectTraining(page, 'Training four actions 1920 HE Daylight');

  await configure(page, { width: 1366, height: 900, theme: 'daylight', language: 'en' });
  await generateTraining(page, { street: 'flop', target: 'postflop_first_action', seed: 100200 });
  await page.click('#trainingRevealHint');
  await page.waitForFunction(() => document.querySelector('#trainingStudyHintContent')?.innerText.trim().length > 0);
  const postflop = await inspectTraining(page, 'Training postflop hint 1366 Daylight');
  return { preflop, wide, postflop };
}

async function auditBookmark(page) {
  await configure(page, { width: 1366, height: 900, theme: 'midnight', language: 'en' });
  await prepareScenario(page);
  await page.$eval('#savedStudySaveButton', (button) => button.scrollIntoView({ block: 'center' }));
  await settle(page);
  const unsaved = await page.$eval('#savedStudySaveButton', (button) => ({
    state: button.dataset.bookmarkState,
    pressed: button.getAttribute('aria-pressed'),
    label: button.textContent.trim(),
    mask: getComputedStyle(button, '::before').maskImage || getComputedStyle(button, '::before').webkitMaskImage,
  }));
  await page.$eval('#savedStudySaveButton', (button) => {
    button.dataset.bookmarkState = 'saved';
    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Saved';
  });
  const saved = await page.$eval('#savedStudySaveButton', (button) => ({
    state: button.dataset.bookmarkState,
    pressed: button.getAttribute('aria-pressed'),
    label: button.textContent.trim(),
    background: getComputedStyle(button, '::before').backgroundColor,
  }));
  const finding = {
    label: 'Bookmark visual states',
    note: 'The saved state is a visual-only Firefox fixture; durable state transitions are covered by the source-controller integration tests.',
    unsaved,
    saved,
    screenshot: await screenshot(page, 'bookmark-saved-state-1366x900-midnight-en'),
  };
  findings.push(finding);
  return finding;
}

async function auditKnownAndHiddenCards(page) {
  await navigate(page, 'hand');
  await configure(page, { width: 1920, height: 1080, theme: 'midnight', language: 'en', layout: 'table-focus' });
  const knownIds = await page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0,
    });
    const state = bridge.getState();
    const hero = state.players.find((player) => player.seat === 0);
    const opponent = state.players.find((player) => player.seat !== 0);
    bridge.dealHoleCards({ [hero.playerId]: ['Ts', '9h'], [opponent.playerId]: ['Ad', 'Kc'] });
    return { hero: hero.playerId, opponent: opponent.playerId };
  });
  await page.waitForFunction(({ hero, opponent }) => (
    document.querySelector(`.table-seat[data-player-id="${hero}"]`)?.querySelectorAll('.card--known').length === 2
    && document.querySelector(`.table-seat[data-player-id="${opponent}"]`)?.querySelectorAll('.card--known').length === 2
  ), {}, knownIds);
  await page.$eval('#visual-table-container', (element) => element.scrollIntoView({ block: 'center' }));
  await settle(page);

  const cardFacts = await page.evaluate(({ hero, opponent }) => {
    const inspectSeat = (playerId) => {
      const seat = document.querySelector(`.table-seat[data-player-id="${playerId}"]`);
      return [...seat.querySelectorAll('.card--known')].map((card) => ({
        rank: card.querySelector('.table-card-corner-rank')?.textContent.trim() || '',
        suit: card.querySelector('.table-card-corner-suit')?.textContent.trim() || '',
        suitId: card.dataset.cardSuitId || '',
      }));
    };
    return { hero: inspectSeat(hero), opponent: inspectSeat(opponent) };
  }, knownIds);
  const knownScreenshot = await screenshot(page, 'known-hero-and-opponent-1920x1080-midnight-en');

  const hiddenId = await page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0,
    });
    const state = bridge.getState();
    const hero = state.players.find((player) => player.seat === 0);
    const opponent = state.players.find((player) => player.seat !== 0);
    bridge.dealObservedHoleCards({ [hero.playerId]: ['Ts', '9h'] });
    return opponent.playerId;
  });
  await page.waitForFunction((opponent) => {
    const seat = document.querySelector(`.table-seat[data-player-id="${opponent}"]`);
    return seat?.querySelectorAll('.table-card-back').length === 2;
  }, {}, hiddenId);
  await settle(page);
  const hidden = await page.evaluate((opponent) => {
    const seat = document.querySelector(`.table-seat[data-player-id="${opponent}"]`);
    return {
      backs: seat.querySelectorAll('.table-card-back').length,
      known: seat.querySelectorAll('.card--known').length,
      ranks: seat.querySelectorAll('.table-card-corner-rank').length,
      suits: seat.querySelectorAll('.table-card-corner-suit').length,
    };
  }, hiddenId);
  const finding = {
    label: 'Known and hidden table-card identity',
    viewport: [1920, 1080],
    theme: 'midnight',
    language: 'en',
    layout: 'table-focus',
    known: cardFacts,
    hidden,
    knownScreenshot,
    hiddenScreenshot: await screenshot(page, 'hidden-opponent-1920x1080-midnight-en'),
  };
  findings.push(finding);
  return finding;
}

function boardFailures(board) {
  const failures = [];
  const tops = new Set(board.cards.map((card) => card.top));
  if (board.cards.length !== 5) failures.push(`${board.label}: expected five board cards`);
  if (tops.size !== 1) failures.push(`${board.label}: board cards are not one row`);
  if (!board.cards.every((card, index, cards) => index === 0 || card.left > cards[index - 1].left)) {
    failures.push(`${board.label}: poker card order is not LTR`);
  }
  if (board.layoutDirection !== 'ltr') failures.push(`${board.label}: board layout direction is not isolated LTR`);
  if (board.streetLabels.map((entry) => entry.street).join(',') !== 'flop,turn,river') {
    failures.push(`${board.label}: semantic street labels are missing or reordered`);
  }
  if (board.layout.left < -1 || board.layout.right > board.viewport[0] + 1) failures.push(`${board.label}: board leaves viewport`);
  if (board.documentOverflowX > 1) failures.push(`${board.label}: document overflow ${board.documentOverflowX}px`);
  return failures;
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
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app)
    && Boolean(window.RiverlinePresentationTheme)
    && Boolean(window.RiverlinePresentationLayout));

  await configure(page, { width: 1024, height: 768, theme: 'midnight', language: 'en', layout: 'balanced' });
  await prepareScenario(page);
  const boardEn = await inspectBoard(page, 'Board 1024 EN Midnight Balanced');
  const pickerEn = await inspectPicker(page, 'Card picker 1024 EN Midnight');

  await configure(page, { width: 1366, height: 900, theme: 'daylight', language: 'he', layout: 'balanced' });
  await prepareScenario(page);
  const boardHe = await inspectBoard(page, 'Board 1366 HE Daylight Balanced');
  const homeGame = await auditHomeGame(page);
  const training = await auditTraining(page);
  const bookmark = await auditBookmark(page);
  const cardIdentity = await auditKnownAndHiddenCards(page);

  const failures = [
    ...boardFailures(boardEn),
    ...boardFailures(boardHe),
    ...(pickerEn.count !== 52 ? [`${pickerEn.label}: expected 52 choices`] : []),
    ...(pickerEn.minimumWidth < 41.5 || pickerEn.minimumHeight < 59.5
      ? [`${pickerEn.label}: picker tokens below 42x60 (${pickerEn.minimumWidth}x${pickerEn.minimumHeight})`] : []),
    ...(!pickerEn.modalWithinViewport ? [`${pickerEn.label}: modal leaves viewport`] : []),
    ...(homeGame.beforeUrl !== homeGame.afterUrl ? ['Home Game: form submission navigated the document'] : []),
    ...(homeGame.navigationCurrent !== 'page' || homeGame.activeMode !== 'homegameMode'
      ? ['Home Game: creation left the organizer route'] : []),
    ...(homeGame.players.join(',') !== 'Dana,Alex,Maya' ? ['Home Game: created roster did not render'] : []),
    ...(training.preflop.street !== 'preflop' || /draw/i.test(training.preflop.hint)
      || !/starting hand|position/i.test(training.preflop.hint)
      ? ['Training: preflop hint did not use preflop concepts'] : []),
    ...(training.postflop.street === 'preflop' || !/made hand|draw|board/i.test(training.postflop.hint)
      ? ['Training: postflop hint did not use board/hand concepts'] : []),
    ...(training.preflop.actionCount !== 4 || training.preflop.gridColumns !== 2
      ? [`Training: expected 4 actions in a 2x2 grid at 1366, got ${training.preflop.actionCount}/${training.preflop.gridColumns}`] : []),
    ...(training.wide.actionCount !== 4 || training.wide.gridColumns !== 4
      ? [`Training: expected 4 actions in one row at 1920, got ${training.wide.actionCount}/${training.wide.gridColumns}`] : []),
    ...(bookmark.unsaved.state !== 'unsaved' || bookmark.unsaved.pressed !== 'false'
      || !bookmark.unsaved.mask || bookmark.saved.state !== 'saved' || bookmark.saved.pressed !== 'true'
      ? ['Bookmark: outline and saved visual contracts were not rendered'] : []),
    ...([...cardIdentity.known.hero, ...cardIdentity.known.opponent].length !== 4
      || [...cardIdentity.known.hero, ...cardIdentity.known.opponent]
        .some((card) => !card.rank || !card.suit || !card.suitId)
      ? ['Cards: a known Hero or opponent card did not expose rank plus suit'] : []),
    ...(cardIdentity.hidden.backs !== 2 || cardIdentity.hidden.known !== 0
      || cardIdentity.hidden.ranks !== 0 || cardIdentity.hidden.suits !== 0
      ? ['Cards: hidden opponent cards exposed identity or did not render as two backs'] : []),
    ...pageErrors.map((error) => `page error: ${error}`),
  ];
  const report = { browser: await browser.version(), artifactRoot, findings, failures };
  fs.writeFileSync(path.join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
