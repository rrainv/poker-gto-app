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

async function settle(page, milliseconds = 60) {
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

async function setDensity(page, density) {
  await openSettings(page);
  await page.click(`[data-density-option="${density}"]`);
  await page.waitForFunction((expected) => document.documentElement.dataset.density === expected, {}, density);
  await closeSettings(page);
  await settle(page);
}

async function availablePresets(page) {
  await openSettings(page);
  const state = await page.evaluate(() => ({
    fieldHidden: document.querySelector('[data-layout-preset-field]')?.hidden,
    presets: [...document.querySelectorAll('[data-layout-preset-option]')]
      .filter((button) => !button.hidden)
      .map((button) => button.dataset.layoutPresetOption),
  }));
  await closeSettings(page);
  return state;
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
      workspace: document.documentElement.dataset.layoutWorkspace,
      preset: document.documentElement.dataset.layoutPreset,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      horizontalOverflows,
      playbook: {
        workspace: rect('#gtoMode .playbook-workspace'),
        context: rect('#gtoMode .playbook-context-rail'),
        decision: rect('#gtoMode .playbook-decision-workspace'),
        support: rect('#gtoMode .playbook-support-rail'),
        table: rect('#visual-table-container'),
      },
      training: {
        insight: rect('.training-insight-column'),
        decision: rect('.training-decision-column'),
        setup: rect('.training-setup-column'),
      },
    };
  }, label);
}

async function capture(page, id, label) {
  await page.evaluate(() => scrollTo(0, 0));
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
  const availability = {};

  await navigate(page, 'hand');
  availability.hand = await availablePresets(page);
  states.push(await capture(page, 'hand-balanced-1920x1080-en', 'Hand / Balanced'));
  await setLayout(page, 'table-focus');
  states.push(await capture(page, 'hand-table-focus-1920x1080-en', 'Hand / Table Focus'));
  await setDensity(page, 'compact');
  states.push(await capture(page, 'hand-table-focus-compact-1920x1080-en', 'Hand / Compact + Table Focus'));
  await setDensity(page, 'comfortable');
  await setLayout(page, 'controls-first');
  states.push(await capture(page, 'hand-controls-first-1920x1080-en', 'Hand / Controls First'));

  await navigate(page, 'analyze');
  availability.analyze = await availablePresets(page);
  states.push(await capture(page, 'analyze-balanced-1920x1080-en', 'Analyze / Balanced'));
  await setLayout(page, 'analysis-focus');
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-en', 'Analyze / Analysis Focus'));
  await setLayout(page, 'controls-first');
  states.push(await capture(page, 'analyze-controls-first-1920x1080-en', 'Analyze / Controls First'));

  await navigate(page, 'training');
  availability.training = await availablePresets(page);
  states.push(await capture(page, 'training-balanced-1920x1080-en', 'Training / Balanced'));
  await setLayout(page, 'table-focus');
  states.push(await capture(page, 'training-table-focus-1920x1080-en', 'Training / Table Focus'));
  await setLayout(page, 'controls-first');
  states.push(await capture(page, 'training-controls-first-1920x1080-en', 'Training / Controls First'));

  await navigate(page, 'personal-strategy');
  availability['personal-strategy'] = await availablePresets(page);
  await navigate(page, 'equity');
  availability.equity = await availablePresets(page);
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
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-ru', 'Analyze / Analysis Focus / RU'));
  await page.evaluate(() => window.setLanguage('he'));
  await settle(page);
  states.push(await capture(page, 'analyze-analysis-focus-1920x1080-he', 'Analyze / Analysis Focus / HE'));

  await page.evaluate(() => window.setLanguage('en'));
  await page.setViewport({ width: 2560, height: 1440, deviceScaleFactor: 1 });
  await navigate(page, 'hand');
  states.push(await capture(page, 'hand-table-focus-2560x1440-en', 'Hand / Table Focus / 2560x1440'));
  await page.setViewport({ width: 2560, height: 1600, deviceScaleFactor: 1 });
  await navigate(page, 'analyze');
  states.push(await capture(page, 'analyze-analysis-focus-2560x1600-en', 'Analyze / Analysis Focus / 2560x1600'));

  await page.evaluate(() => window.setLanguage('he'));
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await navigate(page, 'hand');
  states.push(await capture(page, 'hand-table-focus-1024x768-he', 'Hand / Table Focus / 1024 / HE'));

  const findings = [];
  const byLabel = Object.fromEntries(states.map((state) => [state.label, state]));
  const handBalanced = byLabel['Hand / Balanced'];
  const handTable = byLabel['Hand / Table Focus'];
  const handControls = byLabel['Hand / Controls First'];
  const analyzeBalanced = byLabel['Analyze / Balanced'];
  const analyzeFocus = byLabel['Analyze / Analysis Focus'];
  const analyzeControls = byLabel['Analyze / Controls First'];
  const trainingBalanced = byLabel['Training / Balanced'];
  const trainingTable = byLabel['Training / Table Focus'];
  const trainingControls = byLabel['Training / Controls First'];
  const narrow = byLabel['Hand / Table Focus / 1024 / HE'];

  assertFinding(findings, handTable.playbook.decision.width > handBalanced.playbook.decision.width + 80, 'Hand Table Focus did not materially widen the primary stage');
  assertFinding(findings, handTable.playbook.decision.left < handTable.playbook.context.left, 'Hand Table Focus did not lead with the table stage');
  assertFinding(findings, handControls.playbook.context.width > handBalanced.playbook.context.width + 50, 'Hand Controls First did not materially widen controls');
  assertFinding(findings, analyzeFocus.playbook.decision.width > analyzeBalanced.playbook.decision.width + 100, 'Analyze Analysis Focus did not materially widen analysis');
  assertFinding(findings, analyzeControls.playbook.context.width > analyzeBalanced.playbook.context.width + 50, 'Analyze Controls First did not materially widen configuration');
  assertFinding(findings, trainingTable.training.decision.left < trainingTable.training.insight.left, 'Training Table Focus did not lead with the decision/table stage');
  assertFinding(findings, trainingControls.training.setup.left < trainingControls.training.decision.left, 'Training Controls First did not lead with setup controls');
  assertFinding(findings, trainingBalanced.training.insight.left < trainingBalanced.training.decision.left && trainingBalanced.training.decision.left < trainingBalanced.training.setup.left, 'Training Balanced composition changed unexpectedly');
  assertFinding(findings, byLabel['Hand / Compact + Table Focus'].density === 'compact' && byLabel['Hand / Compact + Table Focus'].preset === 'table-focus', 'Compact + Table Focus did not remain independent');
  assertFinding(findings, restoredHandValue === 'table-focus' && restoredAnalyzeValue === 'analysis-focus', 'Per-workspace preset restoration failed');
  assertFinding(findings, narrow.playbook.context.width === narrow.playbook.decision.width, '1024 presets did not converge to the safe full-width stack');
  assertFinding(findings, narrow.direction === 'rtl' && narrow.language === 'he', 'Hebrew RTL state failed');
  assertFinding(findings, availability.home.fieldHidden && availability.saved.fieldHidden, 'Home or Saved exposed meaningless layout choices');
  assertFinding(findings, JSON.stringify(availability.hand.presets) === JSON.stringify(['balanced', 'table-focus', 'controls-first']), 'Hand availability mismatch');
  assertFinding(findings, JSON.stringify(availability.analyze.presets) === JSON.stringify(['balanced', 'analysis-focus', 'controls-first']), 'Analyze availability mismatch');
  assertFinding(findings, JSON.stringify(availability['personal-strategy'].presets) === JSON.stringify(['balanced', 'analysis-focus']), 'Personal Strategy availability mismatch');
  assertFinding(findings, JSON.stringify(availability.equity.presets) === JSON.stringify(['balanced', 'analysis-focus', 'controls-first']), 'Equity availability mismatch');
  for (const state of states) {
    assertFinding(findings, state.documentOverflowX <= 1 && !state.horizontalOverflows.length, `${state.label}: horizontal overflow detected`);
  }
  if (errors.length) findings.push(`${errors.length} Firefox page error(s)`);

  const report = {
    schemaVersion: 'layout-presets001-firefox-audit/v1',
    browser: await browser.version(),
    artifactRoot,
    availability,
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
