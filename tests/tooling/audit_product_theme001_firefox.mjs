#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-product-theme001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const errors = [];

function createStaticServer() {
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

async function settle(page, milliseconds = 420) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openSettings(page) {
  if (await page.$eval('#settingsModal', (element) => element.classList.contains('show'))) return;
  await page.click('#openSettings');
  await page.waitForFunction(() => document.querySelector('#settingsModal')?.classList.contains('show'));
}

async function closeSettings(page) {
  if (!await page.$eval('#settingsModal', (element) => element.classList.contains('show'))) return;
  await page.click('#closeSettingsModal');
  await page.waitForFunction(() => !document.querySelector('#settingsModal')?.classList.contains('show'));
}

async function setTheme(page, theme) {
  await openSettings(page);
  await page.click(`[data-theme-id="${theme}"]`);
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, {}, theme);
  await settle(page);
}

async function setLanguage(page, language) {
  await page.evaluate((next) => window.setLanguage(next), language);
  await page.waitForFunction((expected) => document.documentElement.lang === expected, {}, language);
  await settle(page);
}

async function navigate(page, destination) {
  await closeSettings(page);
  await page.click(`.mode-nav-item[data-navigation-id="${destination}"]`);
  const expectedWorkspace = destination === 'home-game' || destination === 'guide' ? 'unsupported' : destination;
  await page.waitForFunction((expected) => document.documentElement.dataset.layoutWorkspace === expected, {}, expectedWorkspace);
  await settle(page);
}

async function screenshot(page, name) {
  const filePath = path.join(artifactRoot, `${name}.png`);
  await page.screenshot({ path: filePath, type: 'png' });
  return filePath;
}

async function inspect(page, label) {
  return page.evaluate((stateLabel) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const visible = (element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0;
    const activeView = document.querySelector('.mode-view.active');
    const overflow = activeView ? [...activeView.querySelectorAll('button, input, select, textarea, h1, h2, h3, p, strong')]
      .filter(visible)
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1;
      })
      .map((element) => element.id || element.className || element.tagName) : [];
    const selectedThemes = [...document.querySelectorAll('[data-theme-id][aria-pressed="true"]')]
      .map((button) => button.dataset.themeId);
    return {
      label: stateLabel,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir || 'ltr',
      theme: document.documentElement.dataset.theme,
      customized: document.documentElement.dataset.themeCustomized,
      density: document.documentElement.dataset.density,
      layout: document.documentElement.dataset.layoutPreset,
      workspace: document.documentElement.dataset.layoutWorkspace,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      activeOverflow: overflow,
      selectedThemes,
      themeButtonCount: document.querySelectorAll('[data-theme-id]').length,
      colors: {
        canvas: rootStyle.getPropertyValue('--surface-canvas').trim(),
        panel: rootStyle.getPropertyValue('--surface-panel').trim(),
        text: rootStyle.getPropertyValue('--text-primary').trim(),
        muted: rootStyle.getPropertyValue('--text-muted').trim(),
        accent: rootStyle.getPropertyValue('--accent-primary').trim(),
        felt: rootStyle.getPropertyValue('--poker-felt-accent').trim(),
      },
      storedTheme: localStorage.getItem('appTheme'),
      storedCustom: localStorage.getItem('riverline_presentation_theme_customization'),
    };
  }, label);
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
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  await page.evaluate(() => {
    localStorage.removeItem('appTheme');
    localStorage.removeItem('riverline_presentation_theme_customization');
    localStorage.removeItem('riverline_presentation_density');
    localStorage.removeItem('riverline_presentation_layout');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));

  const findings = [];
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    await setTheme(page, theme);
    const state = await inspect(page, `${theme} settings`);
    state.screenshot = await screenshot(page, `settings-${theme}-1920x1080-en`);
    findings.push(state);
  }

  await setTheme(page, 'midnight');
  await page.evaluate(() => {
    const values = {
      themeAccentColor: '#347fca',
      themeSurfaceColor: '#16283a',
      themeFeltColor: '#75405d',
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await settle(page);
  const customState = await inspect(page, 'custom Midnight settings');
  customState.screenshot = await screenshot(page, 'settings-midnight-custom-1920x1080-en');
  findings.push(customState);

  await page.click('#resetThemeCustomization');
  await settle(page);
  findings.push(await inspect(page, 'reset Midnight settings'));

  await setLanguage(page, 'he');
  await setTheme(page, 'daylight');
  const hebrewState = await inspect(page, 'Daylight settings HE RTL');
  hebrewState.screenshot = await screenshot(page, 'settings-daylight-1920x1080-he');
  findings.push(hebrewState);

  await setLanguage(page, 'ru');
  await setTheme(page, 'graphite');
  for (const destination of ['home', 'home-game', 'hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved']) {
    await navigate(page, destination);
    const state = await inspect(page, `Graphite ${destination} RU`);
    if (['home', 'hand', 'training', 'personal-strategy', 'equity'].includes(destination)) {
      state.screenshot = await screenshot(page, `graphite-${destination}-1920x1080-ru`);
    }
    findings.push(state);
  }

  await page.evaluate(() => {
    localStorage.setItem('appTheme', 'discord-0px');
    localStorage.setItem('riverline_presentation_theme_customization', '{bad json');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  findings.push(await inspect(page, 'legacy and invalid fallback'));

  const failures = [];
  for (const finding of findings) {
    if (finding.documentOverflowX > 1) failures.push(`${finding.label}: document overflow ${finding.documentOverflowX}px`);
    if (finding.activeOverflow.length) failures.push(`${finding.label}: active overflow ${finding.activeOverflow.join(', ')}`);
    if (finding.themeButtonCount && finding.themeButtonCount !== 3) failures.push(`${finding.label}: expected 3 themes`);
    if (finding.selectedThemes.length > 1) failures.push(`${finding.label}: multiple selected themes`);
  }
  const firstThree = findings.slice(0, 3);
  if (new Set(firstThree.map((finding) => finding.colors.canvas)).size !== 3) failures.push('built-in canvas colors are not distinct');
  if (new Set(firstThree.map((finding) => finding.colors.accent)).size !== 3) failures.push('built-in accents are not distinct');
  if (customState.customized !== 'true' || !customState.storedCustom?.includes('midnight')) failures.push('custom theme did not persist');
  const resetState = findings.find((finding) => finding.label === 'reset Midnight settings');
  if (resetState?.customized !== 'false') failures.push('reset did not restore defaults');
  if (hebrewState.direction !== 'rtl' || hebrewState.language !== 'he') failures.push('Hebrew theme Settings did not render RTL');
  const fallback = findings.at(-1);
  if (fallback.theme !== 'midnight' || fallback.storedTheme !== 'midnight' || fallback.customized !== 'false') failures.push('legacy fallback did not repair to Midnight');
  failures.push(...errors.map((error) => `page error: ${error}`));

  const report = { artifactRoot, findings, failures };
  fs.writeFileSync(path.join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
