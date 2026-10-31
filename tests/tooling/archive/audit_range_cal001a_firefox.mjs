#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = path.join(repoRoot, 'tests', 'artifacts', 'range-cal001a');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const errors = [];

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

async function settle(page, milliseconds = 50) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function inspect(page, label) {
  return page.evaluate((stateLabel) => {
    const root = document.querySelector('#rangeCalibrationWorkspace');
    const modal = document.querySelector('#calibrationProfileModal');
    const visible = (element) => element && getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const modalRect = visible(modal) ? modal.querySelector('.calibration-profile-modal')?.getBoundingClientRect() : null;
    const modeButtons = [...document.querySelectorAll('#calibrationModeOptions [role="radio"]')];
    const overflows = root ? [...root.querySelectorAll('button, input, select, textarea, h1, h2, strong, p')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map((element) => element.id || element.tagName) : [];
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      state: root?.dataset.calibrationState || null,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows: overflows,
      modalOpen: Boolean(modal?.classList.contains('show')),
      modalFullyInViewport: modalRect ? modalRect.left >= 0 && modalRect.top >= 0 && modalRect.right <= innerWidth && modalRect.bottom <= innerHeight : null,
      modeCount: modeButtons.length,
      activeModeCount: modeButtons.filter((button) => button.getAttribute('aria-checked') === 'true').length,
      contextPreview: document.querySelector('#calibrationPreviewSpot')?.textContent || null,
      stackHelp: document.querySelector('#calibrationStackHelp')?.textContent || null,
      pokerTokenDirection: document.querySelector('#calibrationPreviewSpot') ? getComputedStyle(document.querySelector('#calibrationPreviewSpot')).direction : null,
      startQuestionsDisabled: document.querySelector('.calibration-ready-state button')?.disabled ?? null,
    };
  }, label);
}

async function capture(page, id, label) {
  const viewport = page.viewport();
  if (viewport) await page.mouse.move(Math.floor(viewport.width / 2), 24);
  await page.evaluate(() => scrollTo(0, 0));
  await settle(page);
  const state = await inspect(page, label);
  const fileName = `firefox-${id}.png`;
  await page.screenshot({ path: path.join(artifactRoot, fileName), type: 'png' });
  return { ...state, screenshot: `tests/artifacts/range-cal001a/${fileName}` };
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

function findingsFor(report) {
  const findings = [];
  for (const state of report.states) {
    if (state.documentOverflowX > 1 || state.horizontalOverflows.length) findings.push(`${state.label}: horizontal overflow detected`);
    if (state.modalOpen && !state.modalFullyInViewport) findings.push(`${state.label}: modal outside viewport`);
    if (state.state === 'configured' && (state.modeCount !== 3 || state.activeModeCount !== 1)) findings.push(`${state.label}: mode invariant failed`);
    if (state.state === 'configured' && state.startQuestionsDisabled) findings.push(`${state.label}: Start Questions is unexpectedly disabled`);
  }
  const hebrew = report.states.find((state) => state.label.startsWith('G.'));
  if (hebrew?.direction !== 'rtl' || hebrew?.pokerTokenDirection !== 'ltr' || hebrew?.stackHelp !== '10–500 bb') {
    findings.push('Hebrew direction or poker-token isolation failed');
  }
  if (errors.length) findings.push(`${errors.length} Firefox page error(s)`);
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
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineI18n));
  const dormantBeforeActivation = await page.evaluate(() => ({
    mountChildren: document.querySelector('#rangeCalibrationMount')?.childElementCount,
    controllerAvailable: Boolean(window.RiverlineRangeCalibration),
    liveWorkspace: Boolean(document.querySelector('#rangeCalibrationWorkspace')),
  }));
  await page.click('[data-mode="calibration"]');
  await page.waitForFunction(() => Boolean(window.RiverlineRangeCalibration) && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading');
  await settle(page, 320);
  const states = [];
  states.push(await capture(page, 'A-first-use-1920x1080-en', 'A. First use / no profiles'));

  await page.click('#calibrationCreateFirstProfile');
  await page.waitForFunction(() => document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  states.push(await capture(page, 'B-profile-creation-1920x1080-en', 'B. Profile creation'));
  await setValues(page, {
    '#calibrationProfileDisplayName': 'Friday Home Game',
    '#calibrationProfileDescription': 'A regular six-handed game with familiar opponents.',
    '#calibrationProfileEnvironment': 'home',
    '#calibrationModeName1': 'Standard',
    '#calibrationModeName2': 'Tight',
    '#calibrationModeName3': 'Pressure',
  });
  await page.click('#calibrationProfileSubmit');
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured' && !document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  states.push(await capture(page, 'C-existing-profile-1920x1080-en', 'C. Existing profile selected'));
  states.push(await capture(page, 'E-6max-btn-100bb-rfi-1920x1080-en', 'E. 6-max BTN 100bb RFI'));

  await page.click('#calibrationEditProfile');
  await setValues(page, {
    '#calibrationProfileDisplayName': 'Friday Night Deep-Stack Home Game With the Same Familiar Lineup',
    '#calibrationProfileDescription': 'A deliberately long but valid description used to verify wrapping and resilient information hierarchy throughout the workspace.',
    '#calibrationModeName1': 'Measured baseline against unfamiliar opponents',
    '#calibrationModeName2': 'Patient adjustment when the table gets splashy',
    '#calibrationModeName3': 'Maximum pressure against overly cautious regulars',
  });
  await page.click('#calibrationProfileSubmit');
  await page.waitForFunction(() => !document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
  states.push(await capture(page, 'D-long-names-1920x1080-en', 'D. Long profile and mode names'));

  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  states.push(await capture(page, 'F-small-desktop-1024x768-en', 'F. Small desktop width'));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => window.setLanguage('he'));
  await settle(page);
  states.push(await capture(page, 'G-hebrew-rtl-1440x900', 'G. Hebrew RTL'));
  await page.evaluate(() => window.setLanguage('ru'));
  await settle(page);
  states.push(await capture(page, 'H-russian-1440x900', 'H. Russian'));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    window.setLanguage('en');
    document.querySelector('[data-theme-id="daylight"]')?.click();
  });
  await settle(page);
  states.push(await capture(page, 'I-daylight-theme-1920x1080-en', 'I. Alternate Riverline theme'));

  const report = { schemaVersion: 'range-cal001a-firefox-audit/v1', browser: await browser.version(), dormantBeforeActivation, states, errors };
  report.findings = findingsFor(report);
  fs.writeFileSync(path.join(artifactRoot, 'firefox-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.findings.length ? 2 : 0;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
