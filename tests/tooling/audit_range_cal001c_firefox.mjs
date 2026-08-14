#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';

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

async function freshPage(browser, baseUrl, pageErrors) {
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app) && Boolean(window.RiverlineI18n));
  return page;
}

async function databaseNames(page) {
  return page.evaluate(async () => (
    typeof indexedDB.databases === 'function'
      ? (await indexedDB.databases()).map((entry) => entry.name)
      : []
  ));
}

async function activate(page) {
  const startedAt = Date.now();
  await page.click('[data-mode="calibration"]');
  await page.waitForFunction(() => Boolean(window.RiverlineRangeCalibration)
    && document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState !== 'loading');
  return Date.now() - startedAt;
}

async function createProfile(page, name = 'Firefox Durable Profile') {
  await page.click('#calibrationCreateFirstProfile');
  await page.waitForFunction(() => document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
  await page.evaluate((displayName) => {
    const values = {
      '#calibrationProfileDisplayName': displayName,
      '#calibrationProfileDescription': 'RANGE-CAL-001C Firefox persistence QA',
      '#calibrationProfileEnvironment': 'home',
      '#calibrationModeName1': 'Normal',
      '#calibrationModeName2': 'Cautious',
      '#calibrationModeName3': 'Pressure',
    };
    for (const [selector, value] of Object.entries(values)) document.querySelector(selector).value = value;
    document.querySelector('#calibrationProfileForm').requestSubmit();
  }, name);
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState === 'configured'
    && !document.querySelector('#calibrationProfileModal')?.classList.contains('show'));
}

async function seedData(page, { currentKeys, asLegacy }) {
  return page.evaluate(async ({ keyCount, legacy }) => {
    const domain = await import('/app/src/personal-strategy/index.mjs');
    const poker = await import('/shared/poker-domain/index.js');
    const ownerRef = domain.createLocalOwnerRef('firefox-scale-owner');
    const createdAt = '2026-08-14T12:00:00.000Z';
    const profiles = [];
    const modes = [];
    const rangeObservations = [];
    let remaining = keyCount;
    let profileNumber = 0;
    let observationNumber = 0;
    let sampleQuery = null;
    while (remaining > 0) {
      const profileId = `firefox-profile-${profileNumber}`;
      const modeIds = [0, 1, 2].map((index) => `firefox-mode-${profileNumber}-${index}`);
      const bundle = domain.createStrategyProfileBundle({
        profileId,
        ownerRef,
        displayName: `Firefox fixture ${profileNumber}`,
        modes: ['Normal', 'Cautious', 'Pressure'],
        modeIds,
        createdAt,
      });
      profiles.push(bundle.profile);
      modes.push(...bundle.modes);
      for (const mode of bundle.modes) {
        for (let contextIndex = 0; contextIndex < 20 && remaining > 0; contextIndex += 1) {
          const context = domain.createRfiCalibrationContext({
            gameRulesId: 'riverline-home-v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 20 + contextIndex,
          });
          for (const [handIndex, handClass] of poker.PREFLOP_HAND_CLASSES.entries()) {
            if (remaining <= 0) break;
            observationNumber += 1;
            rangeObservations.push(domain.createRangeObservation({
              id: `firefox-observation-${observationNumber}`,
              profileId,
              modeId: mode.id,
              context,
              handClass,
              dominantAction: { type: handIndex % 2 ? 'fold' : 'raise' },
              createdAt,
            }));
            sampleQuery ??= { profileId, modeId: mode.id, context, handClass };
            remaining -= 1;
          }
        }
      }
      profileNumber += 1;
    }
    const benchmark = domain.createStrategyProfileBundle({
      profileId: 'firefox-benchmark-profile',
      ownerRef,
      displayName: 'Firefox benchmark profile',
      modes: ['Normal', 'Cautious', 'Pressure'],
      modeIds: ['firefox-benchmark-mode-0', 'firefox-benchmark-mode-1', 'firefox-benchmark-mode-2'],
      createdAt,
    });
    profiles.push(benchmark.profile);
    modes.push(...benchmark.modes);
    const store = {
      schemaVersion: 'personal-strategy-store/v1',
      revision: 1,
      ownerRef,
      updatedAt: createdAt,
      profiles,
      modes,
      rangeObservations,
      trainingObservations: [],
      calibrationSessions: [],
    };
    domain.validatePersonalStrategyStore(store);
    localStorage.setItem('riverline.personalStrategy.owner.v1', ownerRef.id);
    const startedAt = performance.now();
    if (legacy) {
      localStorage.setItem('riverline.personalStrategy.v1', JSON.stringify(store));
    } else {
      const repository = domain.createPersonalStrategyRepository({ ownerRef, clock: () => createdAt });
      await repository.importPortable({
        schemaVersion: 'personal-strategy-export/v1',
        exportedAt: createdAt,
        ownerRef,
        profiles,
        modes,
        rangeObservations,
        trainingObservations: [],
        calibrationSessions: [],
      });
      window.__rangeCal001cRepository = repository;
    }
    return {
      seedMs: performance.now() - startedAt,
      observations: rangeObservations.length,
      legacyBytes: legacy ? new TextEncoder().encode(localStorage.getItem('riverline.personalStrategy.v1')).byteLength : 0,
      sampleQuery,
      exportProfileId: profiles[0].id,
    };
  }, { keyCount: currentKeys, legacy: asLegacy });
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return { medianMs: at(0.5), p95Ms: at(0.95), worstMs: sorted.at(-1) ?? 0 };
}

const servers = [createStaticServer(), createStaticServer(), createStaticServer()];
await Promise.all(servers.map((server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))));
const baseUrls = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
const pageErrors = [];
const report = { schemaVersion: 'range-cal001c-firefox-qa/v1', browser: null, lazy: null, durability: null, migration: null, stress: null, errors: pageErrors };
let browser;

try {
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: firefoxPath,
    headless: true,
    protocolTimeout: 300_000,
  });
  report.browser = await browser.version();
  {
    const page = await freshPage(browser, baseUrls[0], pageErrors);
    report.lazy = {
      databasesBeforeActivation: await databaseNames(page),
      ownerBeforeActivation: await page.evaluate(() => localStorage.getItem('riverline.personalStrategy.owner.v1')),
    };
    await activate(page);
    await createProfile(page);
    await page.click('#calibrationStartQuestions');
    await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.sessionView === 'questions');
    await page.click('#calibrationActionRaise');
    await page.waitForFunction(() => window.RiverlineRangeCalibration?.getState()?.calibrationState?.progress?.answered === 1
      && document.querySelector('#rangeCalibrationWorkspace')?.dataset.persistenceState === 'ready');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.app));
    await activate(page);
    await page.click('#calibrationStartQuestions');
    await page.waitForFunction(() => window.RiverlineRangeCalibration?.getState()?.calibrationState?.progress?.answered === 1);
    report.durability = await page.evaluate(async () => ({
      promptAfterReload: window.RiverlineRangeCalibration.getState().calibrationState.prompt.handClass,
      answeredAfterReload: window.RiverlineRangeCalibration.getState().calibrationState.progress.answered,
      databases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((entry) => entry.name) : [],
      legacyStorePresent: localStorage.getItem('riverline.personalStrategy.v1') !== null,
    }));
    await page.close();
  }

  {
    const page = await freshPage(browser, baseUrls[1], pageErrors);
    const seeded = await seedData(page, { currentKeys: 3042, asLegacy: true });
    const before = await databaseNames(page);
    const activationMs = await activate(page);
    report.migration = await page.evaluate(async ({ fixture, databasesBefore, elapsed }) => ({
      fixture,
      databasesBefore,
      activationAndMigrationMs: elapsed,
      databasesAfter: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((entry) => entry.name) : [],
      legacyRetained: localStorage.getItem('riverline.personalStrategy.v1') !== null,
      profilesLoaded: window.RiverlineRangeCalibration.getState().workspace.profiles.length,
    }), { fixture: seeded, databasesBefore: before, elapsed: activationMs });
    await page.close();
  }

  {
    const page = await freshPage(browser, baseUrls[2], pageErrors);
    report.lazy.stressDatabasesBeforeExplicitSeed = await databaseNames(page);
    const seeded = await seedData(page, { currentKeys: 10140, asLegacy: false });
    const activationMs = await activate(page);
    await page.select('#calibrationProfileSelect', 'firefox-benchmark-profile');
    await page.waitForFunction(() => window.RiverlineRangeCalibration.getState().selection.profileId === 'firefox-benchmark-profile');
    await page.click('#calibrationStartQuestions');
    await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace')?.dataset.sessionView === 'questions');
    for (let index = 0; index < 20; index += 1) {
      await page.click(index % 2 ? '#calibrationActionFold' : '#calibrationActionRaise');
      await page.waitForFunction((answered) => window.RiverlineRangeCalibration.getState().calibrationState.progress.answered === answered
        && document.querySelector('#rangeCalibrationWorkspace').dataset.persistenceState === 'ready', {}, index + 1);
    }
    const measurements = await page.evaluate(async ({ sampleQuery, exportProfileId }) => {
      const repository = window.__rangeCal001cRepository;
      const queryTimes = [];
      for (let index = 0; index < 20; index += 1) {
        const startedAt = performance.now();
        await repository.getCurrentRangeObservation(sampleQuery);
        queryTimes.push(performance.now() - startedAt);
      }
      const exportStartedAt = performance.now();
      const portable = await repository.exportPortable({ profileIds: [exportProfileId], exportedAt: new Date().toISOString() });
      const exportMs = performance.now() - exportStartedAt;
      return {
        interactions: window.RiverlineRangeCalibration.getPerformanceReport().interactions,
        queryTimes,
        exportMs,
        exportBytes: new TextEncoder().encode(JSON.stringify(portable)).byteLength,
        storageEstimate: await navigator.storage.estimate(),
      };
    }, seeded);
    report.stress = {
      fixture: seeded,
      activationMs,
      answerTransaction: summarize(measurements.interactions.map((entry) => entry.repositoryTransactionMs)),
      acceptedAnswerPath: summarize(measurements.interactions.map((entry) => entry.totalInputToNextPromptMs)),
      currentLeafQuery: summarize(measurements.queryTimes),
      profileExportMs: measurements.exportMs,
      profileExportBytes: measurements.exportBytes,
      storageEstimate: measurements.storageEstimate,
    };
    await page.close();
  }
} finally {
  await browser?.close();
  servers.forEach((server) => server.close());
}

const findings = [];
if (report.lazy.databasesBeforeActivation.length || report.lazy.ownerBeforeActivation !== null) findings.push('Personal Strategy activated before workspace use');
if (report.durability.answeredAfterReload !== 1 || report.durability.promptAfterReload !== 'AKs') findings.push('Reload did not recover the accepted answer');
if (!report.durability.databases.includes('riverline-personal-strategy')) findings.push('IndexedDB database was not created');
if (!report.migration.legacyRetained || report.migration.profilesLoaded < 1) findings.push('Legacy migration did not retain and load its source');
if (report.stress.answerTransaction.p95Ms >= 100 || report.stress.acceptedAnswerPath.p95Ms >= 100) findings.push('10k answer path exceeded the interaction budget');
if (pageErrors.length) findings.push(`${pageErrors.length} page error(s)`);
report.findings = findings;
console.log(JSON.stringify(report, null, 2));
if (findings.length) process.exitCode = 1;
