#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-training-composition001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const findings = [];
const pageErrors = [];
const consoleErrors = [];
const consoleErrorDetails = [];

function staticServer() {
  const types = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    return fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      return response.end(data);
    });
  });
}

async function settle(page, milliseconds = 180) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function configure(page, { width, height, theme, language }) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluate(({ nextTheme, nextLanguage }) => {
    window.RiverlinePresentationTheme.apply(nextTheme);
    window.setLanguage(nextLanguage);
    document.scrollingElement.scrollTop = 0;
  }, { nextTheme: theme, nextLanguage: language });
  await settle(page);
}

async function navigateTraining(page) {
  await page.click('.mode-nav-item[data-navigation-id="training"]');
  await page.waitForFunction(() => document.querySelector('.mode-nav-item[data-navigation-id="training"]')?.getAttribute('aria-current') === 'page');
  await settle(page);
}

async function screenshot(page, label) {
  const filename = `${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.png`;
  const filePath = path.join(artifactRoot, filename);
  await page.screenshot({ path: filePath, type: 'png' });
  return filePath;
}

async function inspect(page, label, { capture = true } = {}) {
  await page.evaluate(() => { document.scrollingElement.scrollTop = 0; });
  await settle(page, 80);
  const finding = await page.evaluate((stateLabel) => {
    const visible = (element) => {
      if (!element || element.hidden) return false;
      const closedDisclosure = element.closest('details:not([open])');
      const disclosureSummary = closedDisclosure?.querySelector(':scope > summary');
      if (closedDisclosure && closedDisclosure !== element && disclosureSummary !== element) return false;
      return getComputedStyle(element).display !== 'none'
        && getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!visible(element)) return null;
      const bounds = element.getBoundingClientRect();
      return {
        top: Math.round(bounds.top), right: Math.round(bounds.right),
        bottom: Math.round(bounds.bottom), left: Math.round(bounds.left),
        width: Math.round(bounds.width), height: Math.round(bounds.height),
      };
    };
    const visiblePrimaryStarts = [...document.querySelectorAll('#trainingNewHand, #trainingNextHandBtn, #trainingRestartSession')]
      .filter(visible)
      .map((button) => ({ id: button.id, label: button.textContent.trim() }));
    const actionButtons = [...document.querySelectorAll('#trainingGuessButtons button')].filter(visible);
    const support = ['#trainingHistoryPanel', '.training-assistance-panel', '#trainingMemoryPanel']
      .map((selector) => rect(`${selector} > summary`));
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.presentationThemeId,
      state: document.querySelector('#trainingWorkspace')?.dataset.trainingState,
      fullHandPhase: document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase,
      lifecycle: window.app.training.lifecycle,
      main: rect('.training-decision-column'),
      decisionPanel: rect('.training-decision-panel'),
      rail: rect('.training-study-rail'),
      exercise: rect('#trainingExerciseSurface'),
      actions: rect('#trainingGuessButtons'),
      actionDock: rect('#trainingFullHandActionDock'),
      sizing: rect('#trainingFullHandSizing'),
      table: rect('#trainingFullHandTableMount #visual-table-container'),
      feedback: rect('#trainingFeedback'),
      fullHandFeedback: rect('#trainingFullHandDecisionFeedback'),
      fullHandFeedbackTitle: document.querySelector('#trainingFullHandDecisionFeedbackTitle')?.textContent.trim(),
      fullHandFeedbackText: document.querySelector('#trainingFullHandDecisionFeedbackText')?.textContent.trim(),
      fullHandFactCount: document.querySelectorAll('#trainingFullHandDecisionFacts > *').length,
      fullHandExplainVisible: visible(document.querySelector('.training-full-hand-decision-explain')),
      abort: rect('#trainingFullHandEndHand'),
      abortLabel: document.querySelector('#trainingFullHandEndHand')?.textContent.trim(),
      completion: rect('#trainingFullHandCompletion'),
      reviewSurface: rect('#handReviewSurface'),
      reviewComparison: document.querySelector('#handReviewComparisonBadge')?.textContent.trim(),
      reviewFactCount: document.querySelectorAll('.hand-review-decision-facts > div').length,
      reviewSource: document.querySelector('#handReviewSourceDetail')?.textContent.trim(),
      next: rect('#trainingNextHandBtn'),
      progression: rect('#trainingContinuationRow'),
      progressionParent: document.querySelector('#trainingContinuationRow')?.parentElement?.id,
      progress: rect('#trainingSessionProgress'),
      reference: rect('#trainingReferenceSummary'),
      setup: rect('#trainingSetupPanel'),
      setupOpen: document.querySelector('#trainingSetupPanel')?.open,
      support,
      visiblePrimaryStarts,
      actionCount: actionButtons.length,
      actionLabels: actionButtons.map((button) => button.textContent.trim()),
      source: document.querySelector('#trainingReferenceSummaryValue')?.textContent.trim(),
      progressText: document.querySelector('#trainingSessionProgress')?.textContent.trim(),
      memoryWidth: rect('#trainingMemoryPanel')?.width || 0,
      memorySummary: rect('#trainingMemoryPanel > summary'),
      advancedSummary: rect('#trainingAdvanced > summary'),
      relevantFactLabels: [...document.querySelectorAll('#trainingRelevantFacts dt')].map((entry) => entry.textContent.trim()),
      reviewLabel: document.querySelector('#trainingMarkReview')?.textContent.trim(),
      reviewPressed: document.querySelector('#trainingMarkReview')?.getAttribute('aria-pressed'),
      difficultLabel: document.querySelector('#trainingMarkDifficult')?.textContent.trim(),
      difficultPressed: document.querySelector('#trainingMarkDifficult')?.getAttribute('aria-pressed'),
      memoryDecisionStatus: document.querySelector('#trainingMemoryDecisionStatus')?.textContent.trim(),
      sizingHidden: document.querySelector('#trainingFullHandSizing')?.hidden,
      historyCount: document.querySelectorAll('#trainingActionHistory li:not(.is-empty)').length,
      analysisOpen: document.querySelector('.training-analysis-region')?.open,
      analysis: rect('#trainingAnalysis'),
      analysisMaxBlockSize: getComputedStyle(document.querySelector('#trainingAnalysis')).maxBlockSize,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, label);
  finding.screenshot = capture ? await screenshot(page, label) : null;
  findings.push(finding);
  return finding;
}

async function waitForReady(page) {
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready'
    && document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0, { timeout: 20_000 });
  await settle(page);
}

async function answerCurrent(page) {
  await page.click('#trainingGuessButtons button:not([hidden])');
  await page.waitForFunction(() => (window.app.training.lifecycle === 'feedback'
    && !document.querySelector('#trainingFeedback')?.hidden)
    || window.app.training.practiceSession?.completed === true, { timeout: 20_000 });
  await settle(page);
}

async function waitForFullHandBoundary(page) {
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready'
    || window.app.training.lifecycle === 'terminal', { timeout: 20_000 });
  await settle(page, 220);
}

async function answerFullHandCurrent(page) {
  await page.waitForFunction(() => window.app.training.lifecycle === 'ready', { timeout: 20_000 });
  const action = await page.evaluate(() => {
    const visible = (element) => element && !element.hidden && !element.disabled
      && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const buttons = [...document.querySelectorAll('#trainingGuessButtons [data-action]')].filter(visible);
    const preference = ['check', 'call', 'bet', 'raise', 'all_in', 'fold'];
    return preference.find((type) => buttons.some((button) => button.dataset.action === type)) || null;
  });
  if (!action) throw new Error('No usable Full Hand action');
  await page.click(`#trainingGuessButtons [data-action="${action}"]`);
  if (action === 'bet' || action === 'raise') {
    await page.waitForFunction(() => document.querySelector('#trainingFullHandSizing')?.hidden === false);
    await page.click('.training-full-hand-sizing-submit');
  }
  await waitForFullHandBoundary(page);
  return action;
}

function visibleInViewport(bounds, height) {
  return Boolean(bounds && bounds.top >= -1 && bounds.bottom <= height + 1);
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
  page.on('console', async (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push(message.text());
    const values = await Promise.all(message.args().map((argument) => argument.evaluate((value) => (
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack, code: value.code }
        : String(value)
    )).catch(() => '<unavailable>')));
    consoleErrorDetails.push(values);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  await configure(page, { width: 1920, height: 1080, theme: 'midnight', language: 'en' });
  await navigateTraining(page);

  const empty = await inspect(page, 'A empty pre-session 1920 EN Midnight');
  await page.click('#trainingNewHand');
  await waitForReady(page);
  const active = await inspect(page, 'C active unanswered 1920 EN Midnight');

  let guardDialog = null;
  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = true; });
  page.once('dialog', async (dialog) => {
    guardDialog = dialog.message();
    await dialog.dismiss();
  });
  await page.click('#trainingNewHand');
  await settle(page);
  const guarded = await page.evaluate(() => ({
    lifecycle: window.app.training.lifecycle,
    sessionSeed: window.app.training.practiceSession?.sessionSeed,
  }));
  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = false; });

  await answerCurrent(page);
  const answered = await inspect(page, 'D answered 1920 EN Midnight');
  await page.waitForFunction(() => document.querySelector('#trainingMemoryDecisionActions')?.hidden === false
    && document.querySelector('#trainingMarkReview')?.disabled === false);
  await page.evaluate(() => document.querySelector('#trainingMarkReview')?.click());
  await settle(page, 900);
  const reviewClickState = await page.evaluate(() => ({
    pressed: document.querySelector('#trainingMarkReview')?.getAttribute('aria-pressed'),
    label: document.querySelector('#trainingMarkReview')?.textContent.trim(),
    status: document.querySelector('#trainingMemoryDecisionStatus')?.textContent.trim(),
    busy: document.querySelector('#trainingMemoryDecisionActions')?.getAttribute('aria-busy'),
    disabled: document.querySelector('#trainingMarkReview')?.disabled,
    recordId: window.app.training.memoryCurrentRecordId,
  }));
  await page.evaluate(() => document.querySelector('#trainingMarkDifficult')?.click());
  await settle(page, 900);
  const marked = await inspect(page, 'D1 study flags marked 1920 EN Midnight');
  await page.evaluate(() => document.querySelector('#trainingMarkReview')?.click());
  await settle(page, 900);
  await page.evaluate(() => document.querySelector('#trainingMarkDifficult')?.click());
  await settle(page, 900);
  const unmarked = await page.evaluate(() => ({
    review: document.querySelector('#trainingMarkReview')?.textContent.trim(),
    difficult: document.querySelector('#trainingMarkDifficult')?.textContent.trim(),
    status: document.querySelector('#trainingMemoryDecisionStatus')?.textContent.trim(),
  }));
  await page.evaluate(() => document.querySelector('#trainingMarkReview')?.click());
  await settle(page, 900);
  await page.evaluate(() => document.querySelector('#trainingMarkDifficult')?.click());
  await settle(page, 900);
  await page.click('#trainingAnalysisTitle');
  await settle(page);
  const explained = await inspect(page, 'E explain expanded 1920 EN Midnight');
  await page.click('#trainingAnalysisTitle');

  await page.evaluate(() => {
    document.querySelector('#trainingHistoryPanel').open = true;
    document.querySelector('.training-assistance-panel').open = true;
    document.querySelector('#trainingMemoryPanel').open = true;
  });
  await page.click('#trainingMemoryReviewTab');
  await settle(page, 1200);
  const reviewQueueText = await page.evaluate(() => document.querySelector('#trainingMemoryList')?.textContent || '');
  await page.click('#trainingMemoryRecentTab');
  await page.waitForFunction(() => document.querySelector('.training-memory-session-item'));
  await page.click('.training-memory-session-item summary');
  await page.waitForFunction(() => document.querySelector('.training-memory-session-decision-mount .training-memory-item-actions'));
  await settle(page);
  const supportOpen = await inspect(page, 'GHIJ support and memory with data 1920 EN Midnight');
  const memoryActions = await page.evaluate(() => [...document.querySelectorAll('#trainingMemoryPanel button')]
    .map((button) => button.textContent.trim()).filter(Boolean));
  await page.evaluate(() => {
    document.querySelector('#trainingHistoryPanel').open = false;
    document.querySelector('.training-assistance-panel').open = false;
    document.querySelector('#trainingMemoryPanel').open = false;
  });

  for (let decision = 2; decision <= 10; decision += 1) {
    await page.click('#trainingNextHandBtn');
    await waitForReady(page);
    await answerCurrent(page);
  }
  await page.waitForFunction(() => window.app.training.practiceSession?.completed === true
    && !document.querySelector('#trainingSessionCompletion')?.hidden);
  const complete = await inspect(page, 'L complete session 1920 EN Midnight');

  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = true; });
  await page.click('[data-training-session-mode="focused"]');
  await page.select('#trainingStreet', 'flop');
  await page.select('#trainingDecisionTarget', 'postflop_first_action');
  await page.click('#trainingNewHand');
  await waitForReady(page);
  const focused = await inspect(page, 'M focused active 1920 EN Midnight');
  await answerCurrent(page);
  const focusedAnswered = await inspect(page, 'M1 focused answered 1920 EN Midnight');

  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = true; });
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await page.click('[data-training-session-mode="varied"]');
  await page.click('#trainingNewHand');
  await waitForReady(page);

  await configure(page, { width: 1920, height: 1080, theme: 'daylight', language: 'he' });
  const hebrew = await inspect(page, 'ENRTL active 1920 HE Daylight');
  await configure(page, { width: 1920, height: 1080, theme: 'graphite', language: 'ru' });
  const russian = await inspect(page, 'RU active 1920 Graphite');
  await configure(page, { width: 1366, height: 768, theme: 'midnight', language: 'en' });
  const constrained = await inspect(page, 'Functional active 1366x768 EN Midnight');
  await configure(page, { width: 2560, height: 1440, theme: 'graphite', language: 'en' });
  const wide = await inspect(page, 'Wide active 2560x1440 EN Graphite');
  await configure(page, { width: 2560, height: 1600, theme: 'daylight', language: 'en' });
  const tall = await inspect(page, 'Tall active 2560x1600 EN Daylight');

  let modeDialog = null;
  await configure(page, { width: 1920, height: 1080, theme: 'daylight', language: 'en' });
  await page.evaluate(() => { document.querySelector('#trainingSetupPanel').open = true; });
  page.once('dialog', async (dialog) => {
    modeDialog = dialog.message();
    await dialog.accept();
  });
  await page.click('[data-training-session-mode="full_hand"]');
  await page.click('#trainingNewHand');
  await page.waitForFunction(() => document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase !== 'setup'
    && document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase !== 'off', { timeout: 20_000 });
  await settle(page, 500);
  const fullHand = await inspect(page, 'N full hand shared composition 1920 EN Daylight');
  const sizedAction = await page.evaluate(() => [...document.querySelectorAll('#trainingGuessButtons [data-action]')]
    .map((button) => button.dataset.action).find((action) => action === 'bet' || action === 'raise') || null);
  let fullHandSized = null;
  let fullHandAnswered = null;
  let fullHandSizingModel = null;
  const fullHandDecisionSamples = [];
  let fullHandTerminal = null;
  let fullHandReview = null;
  let abortCanceled = null;
  let abortConfirmed = null;
  let abortDialog = null;
  let abortBefore = null;
  let abortAfterCancel = null;
  let abandonedMemory = null;
  if (sizedAction) {
    await page.click(`#trainingGuessButtons [data-action="${sizedAction}"]`);
    await page.waitForFunction(() => document.querySelector('#trainingFullHandSizing')?.hidden === false);
    fullHandSized = await inspect(page, `N1 full hand ${sizedAction} sizing 1920 EN Daylight`);
    fullHandSizingModel = await page.evaluate(() => {
      const input = document.querySelector('#trainingFullHandSizing input');
      return input ? {
        min: input.min, max: input.max, step: input.step, value: input.value,
        commit: document.querySelector('.training-full-hand-sizing-submit')?.textContent.trim(),
      } : null;
    });
    await page.click('.training-full-hand-sizing-submit');
    await page.waitForFunction(() => document.querySelector('#trainingFullHandDecisionFeedback')?.hidden === false, { timeout: 20_000 });
    await page.waitForFunction(() => window.app.training.lifecycle === 'ready'
      || window.app.training.lifecycle === 'terminal', { timeout: 20_000 });
    fullHandAnswered = await inspect(page, 'N2 full hand answered 1920 EN Daylight');
    fullHandDecisionSamples.push(fullHandAnswered);
  }

  for (let decision = 0; decision < 24
    && await page.evaluate(() => window.app.training.lifecycle === 'ready'); decision += 1) {
    await answerFullHandCurrent(page);
    const sample = await inspect(page, `N3 full hand neutral decision ${decision + 2}`, { capture: false });
    fullHandDecisionSamples.push(sample);
  }
  if (await page.evaluate(() => window.app.training.lifecycle === 'terminal')) {
    fullHandTerminal = await inspect(page, 'N4 full hand terminal 1920 EN Daylight');
    await page.click('#trainingReviewHand');
    await page.waitForFunction(() => document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase === 'review'
      && !document.querySelector('#handReviewSurface')?.hidden, { timeout: 20_000 });
    fullHandReview = await inspect(page, 'N5 full hand shared review 1920 EN Daylight');

    const completedHandId = await page.evaluate(() => window.app.training.fullHandSnapshot?.state?.handId);
    await page.click('#trainingFullHandNewHand');
    await page.waitForFunction((priorHandId) => {
      const snapshot = window.app.training.fullHandSnapshot;
      return snapshot?.state?.handId && snapshot.state.handId !== priorHandId
        && document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase === 'live';
    }, { timeout: 20_000 }, completedHandId);
    await waitForFullHandBoundary(page);
    abortBefore = await page.evaluate(() => ({
      handId: window.app.training.fullHandSnapshot?.state?.handId,
      lifecycle: window.app.training.lifecycle,
      historyCount: document.querySelectorAll('#trainingActionHistory li:not(.is-empty)').length,
    }));
    page.once('dialog', async (dialog) => {
      abortDialog = dialog.message();
      await dialog.dismiss();
    });
    await page.$eval('#trainingFullHandEndHand', (button) => button.scrollIntoView({ block: 'center' }));
    await page.click('#trainingFullHandEndHand');
    await settle(page);
    abortCanceled = await inspect(page, 'N6 full hand abort canceled 1920 EN Daylight');
    abortAfterCancel = await page.evaluate(() => ({
      handId: window.app.training.fullHandSnapshot?.state?.handId,
      lifecycle: window.app.training.lifecycle,
      historyCount: document.querySelectorAll('#trainingActionHistory li:not(.is-empty)').length,
    }));
    page.once('dialog', async (dialog) => { await dialog.accept(); });
    await page.click('#trainingFullHandEndHand');
    await page.waitForFunction(() => document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase === 'setup'
      && window.app.training.fullHandSnapshot === null, { timeout: 20_000 });
    await settle(page, 800);
    abortConfirmed = await inspect(page, 'N7 full hand abort confirmed setup 1920 EN Daylight');
    await page.evaluate(() => { document.querySelector('#trainingMemoryPanel').open = true; });
    await page.click('#trainingMemoryRecentTab');
    await page.waitForFunction(() => document.querySelector('.training-memory-session-item'));
    await settle(page, 800);
    abandonedMemory = await page.evaluate(() => ({
      text: document.querySelector('.training-memory-session-item')?.textContent.trim(),
      itemCount: document.querySelectorAll('.training-memory-session-item').length,
    }));
  }

  const trainingConsoleErrors = [...consoleErrors];
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  await configure(page, { width: 1920, height: 1080, theme: 'midnight', language: 'en' });
  await page.waitForFunction(() => document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false', { timeout: 20_000 });
  await page.click('.mode-nav-item[data-navigation-id="personal-strategy"]');
  await page.waitForFunction(() => document.querySelector('.riverline-shell')?.dataset.activeMode === 'calibration');
  await page.waitForFunction(() => {
    const state = document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState;
    return state && state !== 'loading';
  }, { timeout: 20_000 });
  const personalStrategy = await page.evaluate(() => ({
    state: document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState,
    mountChildren: document.querySelector('#rangeCalibrationMount')?.childElementCount,
    controller: Boolean(window.RiverlineRangeCalibration),
    errorVisible: document.querySelector('#calibrationErrorState')?.hidden === false,
  }));

  const failures = [
    ...(empty.visiblePrimaryStarts.length !== 1 || empty.visiblePrimaryStarts[0]?.id !== 'trainingNewHand'
      ? [`pre-session primary CTA mismatch: ${JSON.stringify(empty.visiblePrimaryStarts)}`] : []),
    ...(empty.setupOpen !== true ? ['pre-session setup is not expanded'] : []),
    ...(empty.main?.height > 320 ? [`pre-session main still fakes vertical work (${empty.main?.height}px)`] : []),
    ...(empty.rail?.height > 660 ? [`pre-session rail remains too tall (${empty.rail?.height}px)`] : []),
    ...(empty.progress || empty.reference || empty.support.slice(0, 2).some(Boolean)
      ? ['pre-session exposes zero-progress/source/history/assistance cards'] : []),
    ...(active.setupOpen !== false ? ['active setup did not compact'] : []),
    ...(!visibleInViewport(active.exercise, 1080) ? ['active exercise leaves the primary viewport'] : []),
    ...(!visibleInViewport(active.actions, 1080) ? ['active answer actions leave the primary viewport'] : []),
    ...(!visibleInViewport(active.progress, 1080) ? ['Session Progress leaves the primary viewport'] : []),
    ...(!visibleInViewport(active.reference, 1080) ? ['reference summary leaves the primary viewport'] : []),
    ...(active.support.some((bounds) => !visibleInViewport(bounds, 1080)) ? ['a support disclosure leaves the primary viewport'] : []),
    ...(Math.abs(active.main?.left - answered.main?.left) > 20 || Math.abs(active.main?.width - answered.main?.width) > 20
      || Math.abs(active.rail?.left - answered.rail?.left) > 20 || Math.abs(active.rail?.width - answered.rail?.width) > 20
      ? ['ready and feedback states changed the workspace columns'] : []),
    ...(!visibleInViewport(answered.feedback, 1080) || !visibleInViewport(answered.next, 1080)
      ? ['compact result or Next exercise leaves the primary viewport'] : []),
    ...(answered.analysisOpen !== false || explained.analysisOpen !== true
      ? ['Explain disclosure default/open states are incorrect'] : []),
    ...(answered.relevantFactLabels.some((label) => /blocker|card removal|physical combos/i.test(label))
      ? ['default Facts foreground generic card-removal detail'] : []),
    ...(marked.reviewPressed !== 'true' || marked.reviewLabel !== 'Added to review'
      || marked.difficultPressed !== 'true' || marked.difficultLabel !== 'Marked difficult'
      || !/Marked difficult|review queue updated/.test(marked.memoryDecisionStatus)
      ? ['study flags did not expose clear marked state and status'] : []),
    ...(reviewClickState.pressed !== 'true'
      ? [`Review-later click did not persist: ${JSON.stringify(reviewClickState)}`] : []),
    ...(unmarked.review !== 'Review later' || unmarked.difficult !== 'Mark difficult'
      || !/removed/i.test(unmarked.status) ? ['study flags did not expose reversible semantics'] : []),
    ...(!/Manually marked Review/i.test(reviewQueueText) || !/Manually marked Difficult/i.test(reviewQueueText)
      ? ['Training Memory review queue did not project both manual metadata reasons'] : []),
    ...(supportOpen.memoryWidth < 300 ? [`Training Memory is too narrow (${supportOpen.memoryWidth}px)`] : []),
    ...(!guardDialog || guarded.lifecycle !== 'ready' ? ['active-session start guard did not preserve the exercise'] : []),
    ...(!modeDialog ? ['active mode change was not guarded'] : []),
    ...(complete.visiblePrimaryStarts.some(({ label }) => /accuracy|master/i.test(label)) ? ['completion exposed mastery language'] : []),
    ...(focused.setup?.width !== focused.rail?.width ? ['Focused setup summary is not bounded to the study rail'] : []),
    ...(focused.decisionPanel?.height > 820
      ? [`Focused sparse active content still inherits excessive height (${focused.decisionPanel?.height}px)`] : []),
    ...(hebrew.direction !== 'rtl' || russian.language !== 'ru' ? ['HE RTL or RU localization state failed'] : []),
    ...(/^Exercise /.test(hebrew.progressText) || /^Exercise /.test(russian.progressText)
      ? ['Varied Session Progress did not refresh in HE/RU'] : []),
    ...(hebrew.documentOverflowX > 1 || russian.documentOverflowX > 1 || constrained.documentOverflowX > 1
      || wide.documentOverflowX > 1 || tall.documentOverflowX > 1 ? ['a language/size sample has horizontal overflow'] : []),
    ...(!constrained.actions || constrained.actionCount < 2 ? ['1366x768 answer actions are not usable'] : []),
    ...(fullHand.fullHandPhase === 'off' || fullHand.fullHandPhase === 'setup' ? ['Full Hand did not enter its canonical live projection'] : []),
    ...(!visibleInViewport(fullHand.table, 1080) || fullHand.table?.width < 900
      ? [`Full Hand shared table misses its readable first-viewport floor (${fullHand.table?.width || 0}px)`] : []),
    ...(!visibleInViewport(fullHand.actionDock, 1080)
      ? ['Full Hand current legal actions are not simultaneously visible with the table'] : []),
    ...(fullHand.sizingHidden !== true ? ['Full Hand sizing appeared before Bet/Raise selection'] : []),
    ...(!sizedAction || !fullHandSized || !visibleInViewport(fullHandSized.sizing, 1080)
      ? ['Full Hand did not reveal legal Bet/Raise sizing in the action rail'] : []),
    ...(!fullHandSizingModel || Number(fullHandSizingModel.min) > Number(fullHandSizingModel.value)
      || Number(fullHandSizingModel.value) > Number(fullHandSizingModel.max)
      || fullHandSizingModel.commit !== 'Apply amount-to'
      ? ['Full Hand sizing did not expose canonical bounds and explicit amount-to commit'] : []),
    ...(!fullHandAnswered?.fullHandFeedback || fullHandAnswered.historyCount < 1
      ? ['Full Hand answer did not preserve neutral confirmation and canonical history'] : []),
    ...(fullHandDecisionSamples.some((sample) => sample.fullHandFeedbackTitle !== 'Decision recorded'
      || !/continuing automatically/i.test(sample.fullHandFeedbackText || '')
      || sample.fullHandFactCount !== 0 || sample.fullHandExplainVisible)
      ? ['a live Full Hand decision exposed verdict, Facts, or Explain instead of neutral confirmation'] : []),
    ...(!fullHandTerminal?.completion || !fullHandReview?.reviewSurface
      || !fullHandReview.reviewComparison || !fullHandReview.reviewSource
      || fullHandReview.reviewFactCount < 1
      ? ['completed Full Hand did not expose shared comparison/Facts Review'] : []),
    ...(!fullHand.abort || fullHand.abortLabel !== 'Abort hand'
      ? ['Abort is not visible in live Full Hand'] : []),
    ...(!abortDialog || JSON.stringify(abortBefore) !== JSON.stringify(abortAfterCancel)
      || !abortCanceled?.abort ? ['canceling Abort changed the live Full Hand'] : []),
    ...(abortConfirmed?.fullHandPhase !== 'setup' || abortConfirmed.abort
      || abortConfirmed.completion || !/Incomplete/i.test(abandonedMemory?.text || '')
      ? ['confirmed Abort did not return to setup with preserved incomplete Memory evidence'] : []),
    ...(answered.progressionParent !== 'trainingFeedbackProgressionMount'
      || explained.progressionParent !== 'trainingFeedbackProgressionMount'
      || answered.next?.top !== explained.next?.top
      ? ['Explain moved the primary Next progression below optional depth'] : []),
    ...(personalStrategy.errorVisible || personalStrategy.state === 'error'
      || personalStrategy.state === 'loading' || personalStrategy.mountChildren < 1
      ? [`Personal Strategy clean-start bootstrap failed: ${JSON.stringify(personalStrategy)}`] : []),
    ...(!memoryActions.some((label) => /Same Spot/i.test(label)) || !memoryActions.some((label) => /Similar Spot/i.test(label))
      ? ['Same Spot / Similar Spot actions were not present in loaded Memory evidence'] : []),
    ...pageErrors.map((error) => `page error: ${error}`),
    ...trainingConsoleErrors.map((error) => `Training console error: ${error}`),
  ];
  const report = {
    browser: await browser.version(), artifactRoot, guardDialog, modeDialog,
    states: { empty, active, answered, marked, explained, supportOpen, complete, focused, focusedAnswered, hebrew, russian, constrained, wide, tall, fullHand, fullHandSized, fullHandAnswered, fullHandTerminal, fullHandReview, abortCanceled, abortConfirmed },
    memoryActions, reviewQueueText, reviewClickState, unmarked, sizedAction, fullHandSizingModel,
    fullHandDecisionSamples, abortDialog, abortBefore, abortAfterCancel, abandonedMemory,
    personalStrategy, trainingConsoleErrors, failures,
  };
  fs.writeFileSync(path.join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify({
    browser: report.browser,
    artifactRoot,
    states: Object.fromEntries(Object.entries(report.states).map(([key, value]) => [key, {
      viewport: value?.viewport,
      state: value?.state,
      theme: value?.theme,
      language: value?.language,
      direction: value?.direction,
      overflowX: value?.documentOverflowX,
    }])),
    memoryActions,
    studyFlags: { marked: {
      review: marked.reviewLabel, difficult: marked.difficultLabel,
      status: marked.memoryDecisionStatus,
    }, unmarked },
    sizedAction,
    fullHandSizingModel,
    personalStrategy,
    trainingConsoleErrors,
    failures,
  }, null, 2)}\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
