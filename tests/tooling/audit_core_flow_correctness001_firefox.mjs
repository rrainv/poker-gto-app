#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-core-flow-correctness001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
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
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      return response.end(data);
    });
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function setLanguage(page, language) {
  await page.evaluate((nextLanguage) => window.setLanguage(nextLanguage), language);
  await page.waitForFunction((nextLanguage) => document.documentElement.lang === nextLanguage, {}, language);
  await settle(page);
}

async function navigate(page, navigationId) {
  await page.click(`.mode-nav-item[data-navigation-id="${navigationId}"]`);
  await page.waitForFunction((id) => (
    document.querySelector(`.mode-nav-item[data-navigation-id="${id}"]`)?.getAttribute('aria-current') === 'page'
  ), {}, navigationId);
  await settle(page);
}

async function createTerminalHand(page) {
  return page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 2,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
    bridge.dealObservedHoleCards({ [bridge.getHeroPlayerId()]: ['As', 'Kd'] });
    bridge.applyAction('fold');
    window.renderCanonicalHandWorkspace();
    return bridge.getCanonicalHandSourceId();
  });
}

async function verifyCompletedHandLifecycle(page) {
  await navigate(page, 'analyze');
  await page.click('#playbookHandMode');
  await page.waitForFunction(() => window.RiverlinePlaybookState.getMode() === 'hand');
  const languageEvidence = [];
  for (const language of ['en', 'ru', 'he']) {
    const completedSourceId = await createTerminalHand(page);
    await setLanguage(page, language);
    await page.waitForSelector('#handCompletedNewHandButton:not([hidden])');
    const completed = await page.evaluate(() => ({
      direction: document.documentElement.dir,
      newHandLabel: document.querySelector('#handCompletedNewHandButton').textContent.trim(),
      primaryActions: [...document.querySelectorAll('#handCompletedSection .ui-button--primary')]
        .map((button) => button.id),
      visibleActions: [
        'handCompletedReviewButton',
        'handCompletedAnalysisButton',
        'handCompletedReplayButton',
        'handCompletedSaveButton',
        'handCompletedNewHandButton',
      ].filter((id) => {
        const element = document.getElementById(id);
        const bounds = element?.getBoundingClientRect();
        return bounds && bounds.width > 0 && bounds.height > 0;
      }),
    }));
    if (completed.visibleActions.length !== 5) throw new Error(`Completed actions missing in ${language}`);
    if (JSON.stringify(completed.primaryActions) !== JSON.stringify([
      'handCompletedReviewButton',
      'handCompletedNewHandButton',
    ])) throw new Error(`Completed primary hierarchy failed in ${language}: ${JSON.stringify(completed.primaryActions)}`);
    if ((language === 'he') !== (completed.direction === 'rtl')) throw new Error(`Direction mismatch in ${language}`);

    await page.click('#handCompletedNewHandButton');
    await page.waitForFunction(() => window.RiverlinePlaybookState.getState() === null);
    const freshSetup = await page.evaluate(() => ({
      startVisible: document.querySelector('#handStartButton').getBoundingClientRect().height > 0,
      setupOpen: document.querySelector('#handSetupDisclosure').open,
      focusId: document.activeElement?.id || null,
    }));
    if (!freshSetup.startVisible || !freshSetup.setupOpen || freshSetup.focusId !== 'handStartButton') {
      throw new Error(`Fresh setup focus/visibility failed in ${language}: ${JSON.stringify(freshSetup)}`);
    }
    await page.click('#handStartButton');
    await page.waitForFunction(() => window.RiverlinePlaybookState.getState()?.pendingChance?.type === 'deal_hole');
    const newSourceId = await page.evaluate(() => window.RiverlinePlaybookState.getCanonicalHandSourceId());
    if (!newSourceId || newSourceId === completedSourceId) throw new Error(`Hand identity was reused in ${language}`);
    languageEvidence.push({ language, completedSourceId, newSourceId, ...completed, freshSetup });
  }
  return languageEvidence;
}

async function verifyTwoCardPicker(page) {
  await setLanguage(page, 'en');
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
    window.renderCanonicalHandWorkspace();
  });
  await page.click('[data-slots="hand-seat-0"] [data-index="0"]');
  await page.click('#deck [data-deck-card="As"]');
  await page.waitForFunction(() => app.picker?.group === 'hand-seat-0' && app.picker?.index === 1);
  const afterFirst = await page.evaluate(() => ({
    modalOpen: document.querySelector('#cardModal').classList.contains('show'),
    cards: [...app.playbookHandDraft.bySeat[0]],
    duplicateDisabled: document.querySelector('#deck [data-deck-card="As"]').disabled,
    focusedDeckCard: document.activeElement?.dataset?.deckCard || null,
  }));
  if (!afterFirst.modalOpen || !afterFirst.duplicateDisabled || afterFirst.cards[0] !== 'As') {
    throw new Error(`First private-card continuation failed: ${JSON.stringify(afterFirst)}`);
  }

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#cardModal').classList.contains('show'));
  const afterCancel = await page.evaluate(() => ({
    cards: [...app.playbookHandDraft.bySeat[0]],
    focusGroup: document.activeElement?.dataset?.group || null,
    focusIndex: document.activeElement?.dataset?.index || null,
  }));
  if (afterCancel.cards[0] !== 'As' || afterCancel.focusGroup !== 'hand-seat-0' || afterCancel.focusIndex !== '1') {
    throw new Error(`Cancel/focus restoration failed: ${JSON.stringify(afterCancel)}`);
  }

  await page.click('[data-slots="hand-seat-0"] [data-index="1"]');
  await page.click('#deck [data-deck-card="Kd"]');
  await page.waitForFunction(() => !document.querySelector('#cardModal').classList.contains('show'));

  await page.click('.hand-known-opponents > summary');
  await page.waitForFunction(() => document.querySelector('.hand-known-opponents').open);
  await page.click('[data-slots="hand-seat-1"] [data-index="0"]');
  await page.waitForFunction(() => app.picker?.group === 'hand-seat-1' && app.picker?.index === 0);
  const duplicates = await page.evaluate(() => ({
    as: document.querySelector('#deck [data-deck-card="As"]').disabled,
    kd: document.querySelector('#deck [data-deck-card="Kd"]').disabled,
  }));
  if (!duplicates.as || !duplicates.kd) throw new Error(`Cross-seat duplicate guard failed: ${JSON.stringify(duplicates)}`);
  await page.click('#deck [data-deck-card="Qc"]');
  await page.waitForFunction(() => app.picker?.group === 'hand-seat-1' && app.picker?.index === 1);
  const afterOpponentFirst = await page.evaluate(() => ({
    modalOpen: document.querySelector('#cardModal').classList.contains('show'),
    disclosureOpen: document.querySelector('.hand-known-opponents').open,
    cards: [...app.playbookHandDraft.bySeat[1]],
  }));
  if (!afterOpponentFirst.modalOpen || !afterOpponentFirst.disclosureOpen
    || JSON.stringify(afterOpponentFirst.cards) !== JSON.stringify(['Qc'])) {
    throw new Error(`Known-opponent first-card nesting failed: ${JSON.stringify(afterOpponentFirst)}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#cardModal').classList.contains('show'));
  const afterOpponentEscape = await page.evaluate(() => ({
    modalOpen: document.querySelector('#cardModal').classList.contains('show'),
    disclosureOpen: document.querySelector('.hand-known-opponents').open,
    cards: [...app.playbookHandDraft.bySeat[1]],
    focusGroup: document.activeElement?.dataset?.group || null,
    focusIndex: document.activeElement?.dataset?.index || null,
  }));
  if (afterOpponentEscape.modalOpen || !afterOpponentEscape.disclosureOpen
    || JSON.stringify(afterOpponentEscape.cards) !== JSON.stringify(['Qc'])
    || afterOpponentEscape.focusGroup !== 'hand-seat-1'
    || afterOpponentEscape.focusIndex !== '1') {
    throw new Error(`Known-opponent nested Escape failed: ${JSON.stringify(afterOpponentEscape)}`);
  }
  await page.click('[data-slots="hand-seat-1"] [data-index="1"]');
  await page.click('#deck [data-deck-card="Jh"]');
  await page.waitForFunction(() => !document.querySelector('#cardModal').classList.contains('show'));

  const result = await page.evaluate(() => ({
    firstSeat: [...app.playbookHandDraft.bySeat[0]],
    secondSeat: [...app.playbookHandDraft.bySeat[1]],
    modalOpen: document.querySelector('#cardModal').classList.contains('show'),
  }));
  if (JSON.stringify(result.firstSeat) !== JSON.stringify(['As', 'Kd'])
    || JSON.stringify(result.secondSeat) !== JSON.stringify(['Qc', 'Jh'])
    || result.modalOpen) {
    throw new Error(`Two-card/multi-opponent picker flow failed: ${JSON.stringify(result)}`);
  }
  return { afterFirst, afterCancel, duplicates, afterOpponentFirst, afterOpponentEscape, result };
}

async function verifyDisplayedMinimumRaise(page) {
  await navigate(page, 'analyze');
  await setLanguage(page, 'en');
  await page.click('#playbookHandMode');
  await page.waitForFunction(() => window.RiverlinePlaybookState.getMode() === 'hand');
  const canonical = await page.evaluate(() => {
    const bridge = window.RiverlinePlaybookState;
    const holeCards = [
      ['As', 'Kh'], ['Qd', 'Jc'], ['Ts', '9h'],
      ['8d', '7c'], ['6s', '5h'], ['4d', '3c'],
    ];
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 6,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
    const state = bridge.getState();
    bridge.dealHoleCards(Object.fromEntries(
      state.players.map((player, index) => [player.playerId, holeCards[index]]),
    ));
    bridge.applyAction('raise', 7);
    window.renderCanonicalHandWorkspace();
    return {
      currentBetMilliBb: bridge.getState().currentBetMilliBb,
      lastFullRaiseIncrementMilliBb: bridge.getState().lastFullRaiseIncrementMilliBb,
      minToMilliBb: bridge.getLegalActions().raise.minToMilliBb,
    };
  });
  await page.click('#handLegalActions [data-canonical-action="raise"]');
  const displayed = await page.evaluate(() => ({
    label: document.querySelector('#handActionSizingLabel').textContent.trim(),
    inputMin: document.querySelector('#handActionAmountBb').min,
    inputValue: document.querySelector('#handActionAmountBb').value,
    presetAmount: document.querySelector('#handSizingMinPreset').dataset.amountToBb,
    presetText: document.querySelector('#handSizingMinPreset').textContent.trim(),
    bounds: document.querySelector('#handActionAmountBounds').textContent.trim(),
  }));
  if (canonical.currentBetMilliBb !== 7000
    || canonical.lastFullRaiseIncrementMilliBb !== 6000
    || canonical.minToMilliBb !== 13_000
    || displayed.label !== 'Raise to'
    || displayed.inputMin !== '13'
    || displayed.inputValue !== '13'
    || displayed.presetAmount !== '13'
    || !displayed.bounds.startsWith('13–')) {
    throw new Error(`Canonical/displayed minimum mismatch: ${JSON.stringify({ canonical, displayed })}`);
  }
  return { canonical, displayed };
}

async function verifyCashOutCorrection(page) {
  await navigate(page, 'home-game');
  await setLanguage(page, 'en');
  await page.waitForFunction(() => document.querySelector('#homeGameWorkspace').getAttribute('aria-busy') === 'false');
  await page.type('#homeGameSessionTitle', 'Correction browser proof');
  await page.type('#homeGamePlayerNames', 'Dana\nAlex');
  await page.$eval('#homeGameInitialBuyIn', (input) => { input.value = '100'; });
  await page.click('#homeGameCreateButton');
  await page.waitForSelector('.home-game-player-card');

  const recordFirstPlayerAmount = async (label, value) => {
    await page.evaluate(({ actionLabel, amount }) => {
      const card = document.querySelector('.home-game-player-card');
      const field = [...card.querySelectorAll('.home-game-amount-field')]
        .find((entry) => entry.querySelector('span')?.textContent.trim() === actionLabel);
      if (!field) throw new Error(`Missing ${actionLabel} field`);
      field.querySelector('input').value = amount;
      field.querySelector('button').click();
    }, { actionLabel: label, amount: value });
    await page.waitForFunction(() => document.querySelector('#homeGameWorkspace').getAttribute('aria-busy') === 'false');
    await settle(page);
  };
  await recordFirstPlayerAmount('Rebuy', '10');
  await recordFirstPlayerAmount('Add-on', '5');
  await recordFirstPlayerAmount('Cash out', '70');

  await page.waitForSelector('.home-game-player-card .home-game-final-state-actions button');

  const languageEvidence = [];
  for (const language of ['en', 'ru', 'he']) {
    await setLanguage(page, language);
    const evidence = await page.evaluate(() => {
      const localButton = document.querySelector('.home-game-final-state-actions button');
      const sessionButton = [...document.querySelectorAll('.home-game-session-actions button')]
        .find((button) => button !== localButton && !button.classList.contains('ui-button--primary'));
      const bounds = sessionButton?.getBoundingClientRect();
      return {
        language: document.documentElement.lang,
        direction: document.documentElement.dir,
        localLabel: localButton?.textContent.trim() || null,
        sessionLabel: sessionButton?.textContent.trim() || null,
        visible: Boolean(bounds && bounds.width >= 44 && bounds.height > 0),
      };
    });
    if (!evidence.visible || (language === 'he') !== (evidence.direction === 'rtl')) {
      throw new Error(`Session correction visibility/direction failed: ${JSON.stringify(evidence)}`);
    }
    languageEvidence.push(evidence);
  }

  await setLanguage(page, 'en');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.home-game-session-actions button')]
      .find((entry) => entry.textContent.trim() === 'Correct entries');
    button?.click();
  });
  await page.waitForSelector('#homeGameEditorDialog[open] .home-game-correction-entry-list');
  const chooser = await page.evaluate(() => ({
    title: document.querySelector('#homeGameEditorTitle').textContent.trim(),
    surfacedTypes: [...document.querySelectorAll('.home-game-correction-entry strong')]
      .map((entry) => entry.textContent.split('·')[0].trim()),
    submitHidden: document.querySelector('#homeGameEditorSubmit').hidden,
  }));
  for (const type of ['Buy-in', 'Rebuy', 'Add-on', 'Cash out']) {
    if (!chooser.surfacedTypes.includes(type)) throw new Error(`Correction chooser omitted ${type}: ${JSON.stringify(chooser)}`);
  }
  if (!chooser.submitHidden) throw new Error(`Correction chooser exposed an unrelated submit action: ${JSON.stringify(chooser)}`);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.home-game-correction-entry')]
      .find((entry) => entry.querySelector('strong')?.textContent.startsWith('Cash out'));
    button?.click();
  });
  await page.waitForSelector('#homeGameEditorDialog[open] #homeGameCorrectionReplacement');
  const dialog = await page.evaluate(() => ({
    title: document.querySelector('#homeGameEditorTitle').textContent.trim(),
    focusedId: document.activeElement?.id || null,
    summary: document.querySelector('.home-game-correction-summary').textContent.trim(),
    reasonRequired: document.querySelector('#homeGameCorrectionReason').required,
    reasonLabel: document.querySelector('label[for="homeGameCorrectionReason"] span').textContent.trim(),
  }));
  if (dialog.focusedId !== 'homeGameCorrectionReplacement' || dialog.reasonRequired) {
    throw new Error(`Optional correction dialog semantics failed: ${JSON.stringify(dialog)}`);
  }
  await page.$eval('#homeGameCorrectionReplacement', (input) => { input.value = '80'; });
  await page.click('#homeGameEditorSubmit');
  await settle(page);
  const confirmationState = await page.evaluate(() => ({
    editorOpen: document.querySelector('#homeGameEditorDialog').open,
    confirmOpen: document.querySelector('#homeGameConfirmDialog').open,
    busy: document.querySelector('#homeGameWorkspace').getAttribute('aria-busy'),
    error: document.querySelector('#homeGameError').textContent.trim(),
    errorHidden: document.querySelector('#homeGameError').hidden,
  }));
  if (!confirmationState.confirmOpen) {
    throw new Error(`Correction confirmation did not open: ${JSON.stringify(confirmationState)}`);
  }
  await page.click('#homeGameConfirmSubmit');
  await page.waitForFunction(() => !document.querySelector('#homeGameConfirmDialog').open
    && document.querySelector('#homeGameWorkspace').getAttribute('aria-busy') === 'false');
  await settle(page);

  await page.evaluate(() => {
    const details = [...document.querySelectorAll('.home-game-history')]
      .find((entry) => entry.querySelector('summary')?.textContent.includes('Ledger history'));
    if (details) details.open = true;
  });
  const ledgerText = await page.evaluate(() => document.querySelector('#homeGameSession').textContent);
  if (!ledgerText.includes('Corrected') || !ledgerText.includes('Replacement')
    || ledgerText.includes('Replacement entry') || ledgerText.includes('No reason supplied')) {
    throw new Error('Corrected cash-out relation or optional-note truth failed in ledger history');
  }
  return { languageEvidence, chooser, dialog, optionalReasonAccepted: true, ledgerRelationVisible: true };
}

const server = staticServer();
let browser;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/app/index.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.RiverlinePlaybookState && window.RiverlineHomeGame);

  const report = {
    schemaVersion: 'core-flow-correctness001-firefox-audit/v1',
    browser: await browser.version(),
    lifecycle: await verifyCompletedHandLifecycle(page),
    picker: await verifyTwoCardPicker(page),
    minimumRaise: await verifyDisplayedMinimumRaise(page),
    cashOutCorrection: await verifyCashOutCorrection(page),
    pageErrors,
  };
  const screenshotPath = path.join(artifactRoot, 'core-flow-correctness001.png');
  await page.screenshot({ path: screenshotPath, type: 'png', fullPage: true });
  report.screenshotPath = screenshotPath;
  if (pageErrors.length) throw new Error(`Firefox page errors: ${JSON.stringify(pageErrors)}`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
