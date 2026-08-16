#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const errors = [];
const samples = [];

function serverForRepository() {
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript' };
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

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, 60));
}

async function inspect(page, label) {
  await new Promise((resolve) => setTimeout(resolve, 380));
  const sample = await page.evaluate((label_) => {
    const panel = document.querySelector('.tutorial-coach');
    const spotlight = document.querySelector('.tutorial-spotlight');
    const state = window.RiverlineTutorials.getState();
    const rect = (element) => element?.getBoundingClientRect();
    const within = (candidate) => candidate && candidate.left >= -1 && candidate.top >= -1
      && candidate.right <= innerWidth + 1 && candidate.bottom <= innerHeight + 1;
    return {
      label: label_,
      viewport: [innerWidth, innerHeight],
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      state,
      panelWithinViewport: within(rect(panel)),
      spotlightWithinViewport: within(rect(spotlight)),
      documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      focus: document.activeElement?.className || document.activeElement?.id || null,
    };
  }, label);
  const screenshotPath = path.join(os.tmpdir(), `riverline-tutorial001-firefox-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);
  await page.screenshot({ path: screenshotPath, type: 'png' });
  sample.screenshot = screenshotPath;
  samples.push(sample);
  if (!sample.panelWithinViewport || !sample.spotlightWithinViewport || sample.documentOverflowX
    || !String(sample.focus).includes('tutorial-coach')) {
    throw new Error(`Firefox geometry failure: ${JSON.stringify(sample)}`);
  }
}

const server = serverForRepository();
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
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.RiverlineTutorials)
    && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'
    && Boolean(document.querySelector('[data-tutorial-offer]')));
  await page.click('[data-tutorial-offer] .ui-button--primary');
  await page.waitForFunction(() => window.RiverlineTutorials.getState().status === 'active');
  await settle(page);
  await inspect(page, 'Firefox cold start');
  await page.keyboard.press('ArrowRight');
  await settle(page);
  await inspect(page, 'Firefox scrolled Recent');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await settle(page);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.RiverlineTutorials)
    && document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false');
  if (await page.$('[data-tutorial-offer]')) throw new Error('Firefox Skip persistence nagged after reload');

  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'daylight'; window.setLanguage('he'); });
  await page.click('#workspaceTutorialButton');
  await page.waitForFunction(() => window.RiverlineTutorials.getState().status === 'active');
  await settle(page);
  await inspect(page, 'Firefox HE RTL reduced motion 1024x768');
  await page.click('[data-tutorial-action="next"]');
  await settle(page);
  await inspect(page, 'Firefox HE RTL scrolled target');
  await page.keyboard.press('Escape');

  if (errors.length) throw new Error(`Firefox page errors: ${JSON.stringify(errors)}`);
  process.stdout.write(`${JSON.stringify({ browser: await browser.version(), samples, errors }, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
