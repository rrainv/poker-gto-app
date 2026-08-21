#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = path.join(repoRoot, 'tests', 'artifacts', 'range-cal001br-firefox');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const pageErrors = [];

function createStaticServer() {
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
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

async function settle(page, milliseconds = 80) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function setValues(page, values) {
  await page.evaluate((entries) => {
    for (const [selector, value] of Object.entries(entries)) {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing field: ${selector}`);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, values);
  await settle(page);
}

async function inspect(page, label) {
  return page.evaluate((stateLabel) => {
    const visible = (element) => element && !element.hidden
      && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const candidates = [...document.querySelectorAll('#rangeCalibrationWorkspace button, #rangeCalibrationWorkspace input, #rangeCalibrationWorkspace h1, #rangeCalibrationWorkspace h2, #rangeCalibrationWorkspace p')]
      .filter(visible);
    const overflows = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }).map((element) => element.id || element.tagName);
    const state = window.RiverlineRangeCalibration?.getState()?.calibrationState;
    const lastObservation = state?.snapshot?.rangeObservations?.at(-1) ?? null;
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      prompt: state?.prompt?.handClass ?? null,
      answered: state?.progress?.answered ?? null,
      focusedElement: document.activeElement?.id || document.activeElement?.tagName || null,
      mixVisible: visible(document.querySelector('#calibrationMixDialog')),
      previousText: document.querySelector('#calibrationPreviousAction')?.textContent || null,
      handDirection: getComputedStyle(document.querySelector('#calibrationQuestionTitle')).direction,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visibleOverflows: overflows,
      lastObservation: lastObservation && {
        handClass: lastObservation.handClass,
        dominantAction: lastObservation.dominantAction,
        frequencies: lastObservation.frequencies,
        state: lastObservation.state,
      },
    };
  }, label);
}

async function capture(page, id, label) {
  await page.evaluate(() => scrollTo(0, 0));
  await settle(page);
  const state = await inspect(page, label);
  const fileName = `${id}.png`;
  await page.screenshot({ path: path.join(artifactRoot, fileName), type: 'png' });
  return { ...state, screenshot: `tests/artifacts/range-cal001br-firefox/${fileName}` };
}

function findingsFor(report) {
  const findings = [];
  for (const state of report.states) {
    if (state.documentOverflowX > 1 || state.visibleOverflows.length) {
      findings.push(`${state.label}: visible horizontal overflow`);
    }
    if (state.handDirection !== 'ltr') findings.push(`${state.label}: poker hand token is not LTR`);
  }
  if (report.firstPrompt !== 'AA') findings.push('First prompt was not AA');
  if (report.keyboardAnswered !== 4) findings.push('F/R keyboard sequence did not answer four hands');
  if (!report.inputShortcutSuppressed) findings.push('R shortcut fired inside a frequency input');
  if (report.tiedObservation?.dominantAction !== null
    || JSON.stringify(report.tiedObservation?.frequencies?.map((entry) => entry.probability)) !== '[0.5,0.5]') {
    findings.push('50/50 mix did not persist as a tied explicit observation');
  }
  if (report.tiedPreviousText !== '50% Fold \u00b7 50% Raise') findings.push('Tied mix summary was not rendered naturally');
  if (!report.undoRestoredHand || !report.reanswerAdvanced) findings.push('Undo/re-answer did not remain coherent');
  if (report.promptBeforePause !== report.promptAfterResume) findings.push('Pause/resume changed the prompt');
  if (report.promptBeforeLeave !== report.promptAfterReturn) findings.push('Workspace leave/return changed the prompt');
  if (report.promptBeforeReload !== report.promptAfterReload) findings.push('Reload/resume changed the prompt');
  const hebrew = report.states.find((state) => state.label === 'Hebrew RTL 1024x768');
  if (hebrew?.direction !== 'rtl') findings.push('Hebrew document direction was not RTL');
  if (!report.states.every((state) => state.focusedElement)) findings.push('A tested state lost usable focus');
  if (pageErrors.length) findings.push(`${pageErrors.length} Firefox page error(s)`);
  return findings;
}

fs.mkdirSync(artifactRoot, { recursive: true });
const server = createStaticServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineI18n));
  await page.click('[data-mode="calibration"]');
  await page.waitForFunction(() => Boolean(window.RiverlineRangeCalibration)
    && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading');

  await page.click('#calibrationCreateFirstProfile');
  await page.waitForFunction(() => document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  await setValues(page, {
    '#calibrationProfileDisplayName': 'Firefox Home Game',
    '#calibrationProfileDescription': 'Genuine Firefox RANGE-CAL-001B acceptance.',
    '#calibrationProfileEnvironment': 'home',
    '#calibrationModeName1': 'Standard',
    '#calibrationModeName2': 'Cautious',
    '#calibrationModeName3': 'Pressure',
  });
  await page.evaluate(() => document.querySelector('#calibrationProfileForm').requestSubmit());
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured'
    && !document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  await page.click('#calibrationStartQuestions');
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.sessionView === 'questions');
  await settle(page);

  const states = [];
  states.push(await capture(page, 'A-first-question-1920x1080', 'First question 1920x1080'));
  const firstPrompt = await page.$eval('#calibrationQuestionTitle', (element) => element.textContent);

  await page.focus('#calibrationQuestionRegion');
  for (const key of ['r', 'f', 'r', 'f']) {
    await page.keyboard.press(key);
    await settle(page);
  }
  const keyboardAnswered = await page.evaluate(() => window.RiverlineRangeCalibration.getState().calibrationState.progress.answered);

  await page.click('#calibrationOpenMix');
  await page.waitForFunction(() => !document.querySelector('#calibrationMixDialog')?.hidden);
  const beforeInputShortcut = await page.evaluate(() => window.RiverlineRangeCalibration.getState().calibrationState.progress.answered);
  await page.focus('#calibrationMixSlider');
  await page.keyboard.press('r');
  await settle(page);
  const afterInputShortcut = await page.evaluate(() => window.RiverlineRangeCalibration.getState().calibrationState.progress.answered);
  states.push(await capture(page, 'B-mix-editor-1920x1080', 'Detailed mix editor 1920x1080'));
  await page.$eval('#calibrationMixSlider', (slider) => {
    slider.value = '50';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector('#calibrationMixForm').requestSubmit());
  await page.waitForFunction(() => document.querySelector('#calibrationMixDialog')?.hidden === true);
  const tiedState = await page.evaluate(() => {
    const state = window.RiverlineRangeCalibration.getState().calibrationState;
    return {
      observation: state.acceptedObservation,
      previousText: document.querySelector('#calibrationPreviousAction').textContent,
    };
  });
  states.push(await capture(page, 'C-tied-summary-1920x1080', '50/50 tied mix summary'));

  const tiedHand = tiedState.observation.handClass;
  await page.click('#calibrationUndoAnswer');
  await settle(page);
  const afterUndo = await page.evaluate(() => {
    const state = window.RiverlineRangeCalibration.getState().calibrationState;
    return { handClass: state.prompt.handClass, answered: state.progress.answered };
  });
  await page.focus('#calibrationQuestionRegion');
  await page.keyboard.press('r');
  await settle(page);
  const afterReanswer = await page.evaluate(() => window.RiverlineRangeCalibration.getState().calibrationState.progress.answered);

  const promptBeforePause = await page.$eval('#calibrationQuestionTitle', (element) => element.textContent);
  await page.click('#calibrationPauseQuestions');
  await page.click('#calibrationStartQuestions');
  await settle(page);
  const promptAfterResume = await page.$eval('#calibrationQuestionTitle', (element) => element.textContent);

  const promptBeforeLeave = promptAfterResume;
  await page.click('[data-mode="training"]');
  await page.click('[data-mode="calibration"]');
  await settle(page);
  const promptAfterReturn = await page.$eval('#calibrationQuestionTitle', (element) => element.textContent);

  const promptBeforeReload = promptAfterReturn;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineI18n));
  await page.click('[data-mode="calibration"]');
  await page.waitForFunction(() => Boolean(window.RiverlineRangeCalibration)
    && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured');
  await page.click('#calibrationStartQuestions');
  await settle(page);
  const promptAfterReload = await page.$eval('#calibrationQuestionTitle', (element) => element.textContent);

  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.evaluate(() => window.setLanguage('he'));
  await settle(page);
  states.push(await capture(page, 'D-hebrew-rtl-1024x768', 'Hebrew RTL 1024x768'));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluate(() => window.setLanguage('en'));
  await settle(page);
  states.push(await capture(page, 'E-resumed-1920x1080', 'Resumed question 1920x1080'));

  const report = {
    schemaVersion: 'range-cal001br-firefox-audit/v1',
    browser: await browser.version(),
    firstPrompt,
    keyboardAnswered,
    inputShortcutSuppressed: beforeInputShortcut === afterInputShortcut,
    tiedObservation: tiedState.observation,
    tiedPreviousText: tiedState.previousText,
    undoRestoredHand: afterUndo.handClass === tiedHand && afterUndo.answered === keyboardAnswered,
    reanswerAdvanced: afterReanswer === keyboardAnswered + 1,
    promptBeforePause,
    promptAfterResume,
    promptBeforeLeave,
    promptAfterReturn,
    promptBeforeReload,
    promptAfterReload,
    states,
    pageErrors,
  };
  report.findings = findingsFor(report);
  fs.writeFileSync(path.join(artifactRoot, 'firefox-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: report.schemaVersion,
    browser: report.browser,
    findings: report.findings,
    keyboardAnswered: report.keyboardAnswered,
    inputShortcutSuppressed: report.inputShortcutSuppressed,
    tiedDominantAction: report.tiedObservation?.dominantAction,
    tiedPreviousText: report.tiedPreviousText,
    undoRestoredHand: report.undoRestoredHand,
    reanswerAdvanced: report.reanswerAdvanced,
    pauseResume: `${report.promptBeforePause} -> ${report.promptAfterResume}`,
    leaveReturn: `${report.promptBeforeLeave} -> ${report.promptAfterReturn}`,
    reloadResume: `${report.promptBeforeReload} -> ${report.promptAfterReload}`,
    pageErrors: report.pageErrors,
  }, null, 2)}\n`);
  process.exitCode = report.findings.length ? 2 : 0;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
