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
  await page.waitForFunction((expected) => document.documentElement.dataset.presentationThemeId === expected, {}, theme);
  await settle(page);
}

async function setPickerColor(page, trigger, color) {
  await page.click(trigger);
  await page.waitForFunction(() => !document.querySelector('#riverlineColorPicker')?.hidden);
  await page.$eval('#themeColorHex', (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, color);
  await page.click('#themeColorApply');
  await page.waitForFunction(() => document.querySelector('#riverlineColorPicker')?.hidden);
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
      themeId: document.documentElement.dataset.presentationThemeId,
      themeKind: document.documentElement.dataset.themeKind,
      customized: document.documentElement.dataset.themeCustomized,
      density: document.documentElement.dataset.density,
      layout: document.documentElement.dataset.layoutPreset,
      workspace: document.documentElement.dataset.layoutWorkspace,
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      activeOverflow: overflow,
      selectedThemes,
      builtInThemeCount: document.querySelectorAll('#themeSwatchGrid [data-theme-id]').length,
      customThemeCount: document.querySelectorAll('#customThemeGrid [data-theme-id]').length,
      colors: {
        canvas: rootStyle.getPropertyValue('--surface-canvas').trim(),
        panel: rootStyle.getPropertyValue('--surface-panel').trim(),
        text: rootStyle.getPropertyValue('--text-primary').trim(),
        muted: rootStyle.getPropertyValue('--text-muted').trim(),
        accent: rootStyle.getPropertyValue('--accent-primary').trim(),
        felt: rootStyle.getPropertyValue('--poker-felt-accent').trim(),
      },
      storedThemeLibrary: localStorage.getItem('riverline_presentation_theme_customization'),
      storedLegacyTheme: localStorage.getItem('appTheme'),
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

  await setTheme(page, 'graphite');
  const accentBeforeCancel = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim());
  await page.click('#themeAccentColor');
  await page.$eval('#themeColorHex', (input) => {
    input.value = '#ff00ff';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle(page, 0);
  const exactPickerState = await page.evaluate(() => {
    const parseHex = (value) => {
      const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
      return match ? match.slice(1).map((part) => Number.parseInt(part, 16) / 255) : null;
    };
    const rgb = parseHex(window.RiverlineColorPicker.getColor());
    const maximum = Math.max(...rgb);
    const minimum = Math.min(...rgb);
    const delta = maximum - minimum;
    const saturation = maximum === 0 ? 0 : (delta / maximum) * 100;
    const valueTop = 100 - (maximum * 100);
    const handle = document.querySelector('#themeColorSaturationValueHandle');
    return {
      picker: window.RiverlineColorPicker.getColor(),
      input: document.querySelector('#themeColorHex').value.toLowerCase(),
      preview: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(),
      handleSaturation: Number.parseFloat(handle.style.getPropertyValue('--picker-saturation')),
      handleValueTop: Number.parseFloat(handle.style.getPropertyValue('--picker-value')),
      expectedSaturation: saturation,
      expectedValueTop: valueTop,
    };
  });
  const accentDuringPreview = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim());
  const pickerScreenshot = await screenshot(page, 'settings-riverline-picker-1920x1080-en');
  await page.evaluate(() => {
    const scroller = document.querySelector('#settingsModal .modal-body');
    if (scroller) scroller.scrollTop += 48;
  });
  const svBounds = await page.$eval('#themeColorSaturationValue', (element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
  });
  await page.mouse.click(svBounds.x + (svBounds.width / 2), svBounds.y + (svBounds.height / 2));
  await settle(page, 0);
  const pointerPickerState = await page.evaluate(() => ({
    picker: window.RiverlineColorPicker.getColor(),
    input: document.querySelector('#themeColorHex').value.toLowerCase(),
    preview: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(),
  }));
  await page.click('#themeSurfaceColor');
  const tokenSwitchState = await page.evaluate(() => ({
    token: window.RiverlineColorPicker.getToken(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(),
    input: document.querySelector('#themeColorHex').value.toLowerCase(),
    surface: window.RiverlinePresentationTheme.getColors().surface,
  }));
  await page.click('#themeColorCancel');
  const accentAfterCancel = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim());
  await page.click('#themeAccentColor');
  await page.keyboard.press('Escape');
  const pickerClosedOnEscape = await page.$eval('#riverlineColorPicker', (element) => element.hidden);
  await page.click('#themeAccentColor');
  await page.$eval('#themeColorHex', (input) => {
    input.value = '#abcdef';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('[data-theme-id="daylight"]');
  const themeSwitchState = await page.evaluate(() => ({
    pickerClosed: document.querySelector('#riverlineColorPicker').hidden,
    themeId: window.RiverlinePresentationTheme.getTheme(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(),
    controllerAccent: window.RiverlinePresentationTheme.getColors().accent,
  }));
  await setTheme(page, 'graphite');
  await setPickerColor(page, '#themeAccentColor', '#b46f38');
  const appliedAccentState = await page.evaluate(() => ({
    controller: window.RiverlinePresentationTheme.getColors().accent,
    rendered: getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim(),
  }));
  await setPickerColor(page, '#themeSurfaceColor', '#202936');
  await setPickerColor(page, '#themeFeltColor', '#6b4b62');
  await page.type('#customThemeName', 'Graphite Study');
  await page.click('#saveCustomTheme');
  await settle(page);
  const customThemeId = await page.evaluate(() => window.RiverlinePresentationTheme.getTheme());
  const customState = await inspect(page, 'saved Graphite custom theme');
  customState.screenshot = await screenshot(page, 'settings-graphite-custom-1920x1080-en');
  findings.push(customState);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  await openSettings(page);
  findings.push(await inspect(page, 'reloaded Graphite custom theme'));
  await page.$eval('#customThemeName', (input) => {
    input.value = 'Graphite Focus';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#renameCustomTheme');
  await page.click('#duplicateTheme');
  await settle(page);
  findings.push(await inspect(page, 'renamed and duplicated Graphite custom theme'));
  await page.click('#deleteCustomTheme');
  await settle(page);
  findings.push(await inspect(page, 'deleted active duplicate with fallback'));

  await closeSettings(page);
  await page.click('.mode-nav-item[data-navigation-id="hand"]');
  await openSettings(page);
  await page.click('[data-density-option="compact"]');
  await page.click('[data-layout-preset-option="table-focus"]');
  findings.push(await inspect(page, 'custom Graphite Compact Table Focus'));

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
    localStorage.setItem('riverline_presentation_theme_customization', '{bad json');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlinePresentationTheme));
  findings.push(await inspect(page, 'legacy and invalid fallback'));

  const failures = [];
  for (const finding of findings) {
    if (finding.documentOverflowX > 1) failures.push(`${finding.label}: document overflow ${finding.documentOverflowX}px`);
    if (finding.activeOverflow.length) failures.push(`${finding.label}: active overflow ${finding.activeOverflow.join(', ')}`);
    if (finding.builtInThemeCount !== 3) failures.push(`${finding.label}: expected 3 immutable built-ins`);
    if (finding.selectedThemes.length > 1) failures.push(`${finding.label}: multiple selected themes`);
  }
  const firstThree = findings.slice(0, 3);
  if (new Set(firstThree.map((finding) => finding.colors.canvas)).size !== 3) failures.push('built-in canvas colors are not distinct');
  if (new Set(firstThree.map((finding) => finding.colors.accent)).size !== 3) failures.push('built-in accents are not distinct');
  if (customState.customized !== 'true' || customState.themeKind !== 'custom'
    || !customState.storedThemeLibrary?.includes(customThemeId)) failures.push('named custom theme did not persist');
  const reloaded = findings.find((finding) => finding.label === 'reloaded Graphite custom theme');
  if (reloaded?.themeId !== customThemeId || reloaded?.customThemeCount !== 1) failures.push('reload did not restore the active custom theme');
  const duplicated = findings.find((finding) => finding.label === 'renamed and duplicated Graphite custom theme');
  if (duplicated?.customThemeCount !== 2) failures.push('duplicate did not create a second custom theme');
  const deleted = findings.find((finding) => finding.label === 'deleted active duplicate with fallback');
  if (deleted?.themeId !== customThemeId || deleted?.customThemeCount !== 1) failures.push('active deletion did not fall back to the base custom theme');
  const independent = findings.find((finding) => finding.label === 'custom Graphite Compact Table Focus');
  if (independent?.density !== 'compact' || independent?.layout !== 'table-focus' || independent?.themeId !== customThemeId) failures.push('theme/density/layout independence failed');
  if (hebrewState.direction !== 'rtl' || hebrewState.language !== 'he') failures.push('Hebrew theme Settings did not render RTL');
  const fallback = findings.at(-1);
  if (fallback.theme !== 'midnight' || fallback.themeId !== 'midnight'
    || fallback.customized !== 'false' || fallback.storedLegacyTheme !== null) failures.push('malformed fallback did not repair to the single Midnight record');
  failures.push(...errors.map((error) => `page error: ${error}`));

  if (accentDuringPreview === accentBeforeCancel || accentAfterCancel !== accentBeforeCancel) failures.push('picker Cancel did not provide and then restore live preview');
  if (exactPickerState.picker !== '#ff00ff'
    || exactPickerState.picker !== exactPickerState.input
    || exactPickerState.picker !== exactPickerState.preview
    || Math.abs(exactPickerState.handleSaturation - exactPickerState.expectedSaturation) > 0.01
    || Math.abs(exactPickerState.handleValueTop - exactPickerState.expectedValueTop) > 0.01) {
    failures.push('exact picker color did not match marker, hex, and rendered preview');
  }
  if (pointerPickerState.picker !== pointerPickerState.input || pointerPickerState.picker !== pointerPickerState.preview) {
    failures.push('scrolled pointer selection did not keep picker, hex, and preview aligned');
  }
  if (tokenSwitchState.token !== 'surface' || tokenSwitchState.accent !== accentBeforeCancel
    || tokenSwitchState.input !== tokenSwitchState.surface) failures.push('picker token switch retained stale preview state');
  if (!themeSwitchState.pickerClosed || themeSwitchState.themeId !== 'daylight'
    || themeSwitchState.accent !== themeSwitchState.controllerAccent) failures.push('theme switch retained a stale open picker preview');
  if (appliedAccentState.controller !== appliedAccentState.rendered) failures.push('picker Apply did not commit the rendered color exactly');
  if (!pickerClosedOnEscape) failures.push('picker did not close on Escape');
  const report = {
    artifactRoot,
    pickerScreenshot,
    pickerChecks: {
      exactPickerState, pointerPickerState, tokenSwitchState, themeSwitchState, appliedAccentState,
    },
    findings,
    failures,
  };
  fs.writeFileSync(path.join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
