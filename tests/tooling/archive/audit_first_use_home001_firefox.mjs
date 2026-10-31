#!/usr/bin/env node

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const preferenceKey = 'riverline.welcomeOrientation.v1';
const pageErrors = [];

function serverForRepository() {
  const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.svg': 'image/svg+xml' };
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

function assertState(condition, message, state) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(state)}`);
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function welcomeState(page) {
  return page.evaluate(() => {
    const railTile = document.querySelector('.rail-brand .brand-mark');
    const railSvg = railTile?.querySelector('svg');
    const welcomeTile = document.querySelector('.welcome-brand');
    const welcomeSvg = welcomeTile?.querySelector('svg');
    const presentation = (tile, svg) => ({
      foreground: getComputedStyle(tile).color,
      background: getComputedStyle(tile).backgroundColor,
      fill: getComputedStyle(svg).fill,
      bounds: svg ? { width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height } : null,
    });
    return {
      visible: window.RiverlineWelcome?.getState?.().visible === true,
      hidden: document.querySelector('#welcomeOrientation')?.hidden,
      suppressionChecked: document.querySelector('#welcomeRememberChoice')?.checked,
      spadeHrefs: [...document.querySelectorAll('use')]
        .map((use) => use.getAttribute('href'))
        .filter((href) => href?.includes('riverline-brand-mark.svg')),
      rail: presentation(railTile, railSvg),
      welcome: presentation(welcomeTile, welcomeSvg),
    };
  });
}

const server = serverForRepository();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({ browser: 'firefox', executablePath: firefoxPath, headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const url = `http://127.0.0.1:${server.address().port}/app/index.html`;

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineWelcome?.getState?.().visible === true);
  await settle(page);
  const fresh = await welcomeState(page);
  assertState(fresh.visible && fresh.hidden === false && fresh.suppressionChecked === false, 'Fresh Welcome default is not visible and unchecked', fresh);
  assertState(fresh.spadeHrefs.length === 2 && new Set(fresh.spadeHrefs).size === 1, 'Brand surfaces do not share one canonical spade', fresh);
  assertState(fresh.rail.foreground === 'rgb(16, 19, 17)'
    && fresh.rail.background === 'rgb(66, 173, 123)'
    && fresh.rail.fill === fresh.rail.foreground, 'Compact brand contrast treatment is not intact', fresh);
  const freshScreenshot = path.join(os.tmpdir(), 'riverline-first-use-home001-welcome-correction-1920x1080.png');
  await page.screenshot({ path: freshScreenshot, type: 'png' });

  await page.click('#welcomeRememberChoice');
  await page.click('[data-welcome-destination="home"]');
  await page.waitForFunction(() => document.querySelector('#welcomeOrientation')?.hidden === true);
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), preferenceKey);
  assertState(persisted?.status === 'completed', 'Explicit suppression choice was not persisted', persisted);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.RiverlineWelcome));
  await settle(page);
  const suppressed = await welcomeState(page);
  assertState(!suppressed.visible && suppressed.hidden === true, 'Saved suppression did not suppress Welcome after reload', suppressed);

  await page.evaluate((key) => localStorage.removeItem(key), preferenceKey);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineWelcome?.getState?.().visible === true);
  await settle(page);
  const reset = await welcomeState(page);
  assertState(reset.visible && reset.hidden === false && reset.suppressionChecked === false, 'Reset preference did not restore fresh unchecked Welcome', reset);
  assertState(pageErrors.length === 0, 'Firefox emitted page errors', pageErrors);

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'first-use-home001-welcome-correction-firefox-audit/v1',
    browser: await browser.version(),
    viewport: { width: 1920, height: 1080, zoom: '100%' },
    fresh,
    persisted,
    suppressed,
    reset,
    screenshot: freshScreenshot,
    pageErrors,
  }, null, 2)}\n`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
