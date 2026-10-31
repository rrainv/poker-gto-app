#!/usr/bin/env node
'use strict';

// RESPONSIVE-001 Electron-renderer geometry audit. Run with Electron, not Node:
//   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
//   .\node_modules\.bin\electron.cmd .\tests\tooling\audit_responsive001.cjs --phase=before

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactRoot = path.join(repoRoot, 'tests', 'artifacts', 'responsive001');
const phaseArgument = process.argv.find((argument) => argument.startsWith('--phase='));
const phase = phaseArgument ? phaseArgument.slice('--phase='.length) : 'after';
const fullAuditEnabled = process.argv.includes('--full');
const screenshotsEnabled = process.argv.includes('--screenshots');
const viewports = Object.freeze([
  [1024, 768],
  [1280, 900],
  [1440, 900],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [2560, 1600],
  [3840, 2160]
]);
const languages = Object.freeze(['en', 'ru', 'he']);
const themes = Object.freeze(['midnight', 'graphite', 'daylight']);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

let server;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(win, expression, timeoutMilliseconds = 15_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
}

async function setViewport(win, width, height) {
  win.setContentSize(width, height);
  win.webContents.setZoomFactor(1);
  await settle(win);
}

async function setLanguage(win, language) {
  await win.webContents.executeJavaScript(`window.setLanguage(${JSON.stringify(language)})`);
  await settle(win);
}

async function setTheme(win, theme) {
  await win.webContents.executeJavaScript(`(() => {
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    localStorage.setItem('appTheme', ${JSON.stringify(theme)});
    document.querySelector('#themeColor')?.setAttribute('value', ${JSON.stringify(theme)});
  })()`);
  await settle(win);
}

async function click(win, selector) {
  const found = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!found) throw new Error(`Missing click target: ${selector}`);
  await settle(win);
}

async function selectMode(win, mode) {
  await click(win, `[data-mode="${mode}"]`);
  const id = mode === 'info' ? 'infoMode' : `${mode}Mode`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
}

async function selectEquity(win) {
  await selectMode(win, 'equity');
}

async function measureStreetAlignment(win, viewport, language) {
  return win.webContents.executeJavaScript(`(() => {
    const labels = ['flop', 'turn', 'river'].map((street) =>
      document.querySelector('[data-equity-street="' + street + '"]')?.getBoundingClientRect()
    );
    const slotElements = [...document.querySelectorAll('[data-slots="eqboard"] > .card-slot')];
    const slots = slotElements.map((slot) => slot.getBoundingClientRect());
    if (labels.some((label) => !label) || slots.length !== 5) {
      return { error: 'Equity street labels or board slots are missing' };
    }
    const center = (rect) => (rect.left + rect.right) / 2;
    const groupCenter = (first, last) => (first.left + last.right) / 2;
    const labelCenters = {
      flop: center(labels[0]),
      turn: center(labels[1]),
      river: center(labels[2])
    };
    const slotCenters = {
      flop: groupCenter(slots[0], slots[2]),
      turn: center(slots[3]),
      river: center(slots[4])
    };
    const deltas = Object.fromEntries(
      Object.keys(labelCenters).map((street) => [street,
        Math.round((labelCenters[street] - slotCenters[street]) * 100) / 100])
    );
    const guide = document.querySelector('.equity-street-guide');
    const board = document.querySelector('.equity-board-cards');
    const root = document.documentElement;
    return {
      viewport: ${JSON.stringify(viewport)},
      language: ${JSON.stringify(language)},
      documentDirection: root.dir,
      guideDirection: getComputedStyle(guide).direction,
      boardDirection: getComputedStyle(board).direction,
      guideDisplay: getComputedStyle(guide).display,
      boardDisplay: getComputedStyle(board).display,
      labelCenters,
      slotCenters,
      deltas,
      semanticOrder: [...guide.querySelectorAll('[data-equity-street]')]
        .map((entry) => entry.dataset.equityStreet),
      slotOrder: slotElements.map((slot) => Number(slot.dataset.index)),
      documentWidth: { scroll: root.scrollWidth, client: root.clientWidth },
      documentHeight: { scroll: root.scrollHeight, client: root.clientHeight }
    };
  })()`);
}

async function selectPlaybookView(win, view) {
  await click(win, `[data-gto-view="${view}"]`);
  const id = view === 'context' ? 'contextView' : `${view}View`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
}

async function setScenarioCards(win, hero = [], board = []) {
  await win.webContents.executeJavaScript(`(() => {
    app.gto.hero = ${JSON.stringify(hero)};
    app.gto.board = ${JSON.stringify(board)};
    app.gto.dead = [];
    renderAllCards({ mode: 'gto' });
    updateContext('RESPONSIVE-001 renderer audit');
  })()`);
  await waitFor(win, 'Boolean(window.app?.playbookResolution)');
  await settle(win);
}

async function generateTraining(win, seed) {
  await selectMode(win, 'training');
  await win.webContents.executeJavaScript(`(() => {
    const seed = document.querySelector('#trainingSeedInput');
    seed.value = ${JSON.stringify(String(seed))};
    seed.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(win, '#trainingGenerateSeed');
  await waitFor(win, "!document.querySelector('#trainingExerciseSurface')?.hidden", 25_000);
  await waitFor(win, "document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length > 0", 25_000);
}

async function answerTraining(win, kind) {
  await win.webContents.executeJavaScript(`(() => {
    const solution = [...(window.app?.training?.currentSolution || [])]
      .sort((a, b) => a.value - b.value);
    const target = ${JSON.stringify(kind)} === 'correct' ? solution.at(-1) : solution[0];
    const button = [...document.querySelectorAll('#trainingGuessButtons button:not([hidden])')]
      .find((entry) => entry.dataset.action === target?.action?.type);
    button?.click();
  })()`);
  await waitFor(win, "!document.querySelector('#trainingFeedback')?.hidden", 15_000);
  await win.webContents.executeJavaScript(`document.querySelectorAll('#trainingAnalysis details').forEach((entry) => { entry.open = true; })`);
  await settle(win);
}

async function setEquityScenario(win, { players = 2, hero = [], board = [], dead = [] } = {}) {
  await selectEquity(win);
  await win.webContents.executeJavaScript(`(() => {
    resetEquityCalculator();
    while (app.equity.players.length < ${players}) app.equity.players.push(createEquityPlayer());
    while (app.equity.players.length > ${players}) app.equity.players.pop();
    app.equity.players[0].handMode = ${hero.length ? "'known'" : "'unknown'"};
    app.equity.players[0].cards = ${JSON.stringify(hero)};
    for (let index = 1; index < app.equity.players.length; index += 1) {
      app.equity.players[index].handMode = 'unknown';
      app.equity.players[index].cards = [];
    }
    app.equity.board = ${JSON.stringify(board)};
    app.equity.dead = ${JSON.stringify(dead)};
    renderAllCards({ mode: 'equity' });
    updateEquityReadiness();
  })()`);
  await settle(win);
}

async function prepareState(win, state) {
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('#settingsModal')?.classList.remove('show');
    if (document.querySelector('#cardModal')?.classList.contains('show')) closePicker({ restoreFocus: false });
    if (window.app?.equity?.requestToken?.controller) cancelEquityCalculation();
  })()`);
  if (state.startsWith('playbook-')) {
    await selectMode(win, 'gto');
    if (state === 'playbook-hand') {
      await click(win, '#playbookHandMode');
      return;
    }
    const scenarioPressed = await win.webContents.executeJavaScript(
      "document.querySelector('#playbookScenarioMode')?.getAttribute('aria-pressed') === 'true'"
    );
    if (!scenarioPressed) await click(win, '#playbookScenarioMode');
    const postflop = state === 'playbook-matrix-postflop';
    const unavailable = state === 'playbook-unavailable';
    await setScenarioCards(win, unavailable ? [] : ['As', 'Kd'], postflop ? ['2c', '7d', 'Th'] : []);
    await selectPlaybookView(win, state === 'playbook-matrix' || postflop ? 'chart'
      : state === 'playbook-range' ? 'range' : 'context');
    if (state === 'playbook-analysis') {
      const hidden = await win.webContents.executeJavaScript(
        "getComputedStyle(document.querySelector('#teacherContent')).display === 'none'"
      );
      if (hidden) await click(win, '#toggleTeacher');
    }
    if (state === 'playbook-table-collapsed') {
      const collapsed = await win.webContents.executeJavaScript(
        "document.querySelector('#table-wrapper')?.classList.contains('collapsed')"
      );
      if (!collapsed) await click(win, '#toggleTableBtn');
    } else if (state === 'playbook-table-expanded') {
      const collapsed = await win.webContents.executeJavaScript(
        "document.querySelector('#table-wrapper')?.classList.contains('collapsed')"
      );
      if (collapsed) await click(win, '#toggleTableBtn');
    }
    return;
  }
  if (state === 'training-idle') {
    await selectMode(win, 'training');
    return;
  }
  if (state.startsWith('training-')) {
    const seed = state === 'training-mistake' ? 987654321 : 123456789;
    await generateTraining(win, seed);
    if (state === 'training-hint') await click(win, '#trainingRevealHint');
    if (state === 'training-correct') await answerTraining(win, 'correct');
    if (state === 'training-mistake') await answerTraining(win, 'mistake');
    return;
  }
  if (state === 'equity-idle') {
    await setEquityScenario(win);
    return;
  }
  if (state === 'equity-known-board-dead') {
    await setEquityScenario(win, { hero: ['As', 'Kd'], board: ['2c', '7d', 'Th'], dead: ['Qs'] });
    return;
  }
  if (state === 'equity-progress') {
    await setEquityScenario(win, { players: 10, hero: ['As', 'Kd'], board: ['2c', '7d', 'Th'] });
    await win.webContents.executeJavaScript(`(() => {
      document.querySelector('#calcStyle').value = 'sim';
      document.querySelector('#trials').value = '250000';
      updateEquityReadiness();
    })()`);
    await click(win, '#calculate');
    await waitFor(win, "!document.querySelector('#progress')?.hidden", 15_000);
    return;
  }
  if (state === 'equity-complete') {
    await setEquityScenario(win, { hero: ['As', 'Kd'], board: ['2c', '7d', 'Th', '9s', '3h'] });
    await click(win, '#calculate');
    await waitFor(win, "document.querySelector('#equityResultsPanel')?.dataset.resultState === 'complete'", 25_000);
    return;
  }
  if (state === 'equity-advanced') {
    await setEquityScenario(win, { hero: ['As', 'Kd'], board: ['2c', '7d', 'Th'] });
    await win.webContents.executeJavaScript("document.querySelector('#equityAdvanced').open = true");
    await settle(win);
    return;
  }
  if (state === 'guide') {
    await selectMode(win, 'info');
    return;
  }
  if (state === 'settings') {
    await selectMode(win, 'gto');
    await click(win, '#openSettings');
    return;
  }
  if (state === 'card-picker-open') {
    await setEquityScenario(win);
    await click(win, '[data-slots="eqboard"] > .card-slot[data-index="0"]');
    await waitFor(win, "document.querySelector('#cardModal')?.classList.contains('show')");
    return;
  }
  if (state === 'card-picker-closed') {
    await setEquityScenario(win);
    await click(win, '[data-slots="eqboard"] > .card-slot[data-index="0"]');
    await click(win, '#closeModal');
    return;
  }
  throw new Error(`Unknown responsive audit state: ${state}`);
}

async function collectLayout(win, metadata) {
  return win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const viewport = { width: innerWidth, height: innerHeight };
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const selectors = [
      '.playbook-workspace', '.playbook-decision-workspace', '#teacherContent', '#table-wrapper',
      '#visual-table-container', '#chartView', '.matrix-wrap', '#rangeView', '.training-workspace',
      '#trainingRecommendation', '#trainingGuessButtons', '.training-completion-actions', '#trainingAnalysis',
      '.equity-workspace', '.equity-board-layout', '#progress', '#equityResultsPanel', '#equityAdvanced',
      '.guide-workspace', '#settingsModal .settings-modal', '#cardModal .modal', '#deck'
    ];
    const boxes = {};
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      boxes[selector] = {
        left: Math.round(rect.left * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        top: Math.round(rect.top * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight
      };
    }
    const modalSelector = document.querySelector('#settingsModal')?.classList.contains('show')
      ? '#settingsModal .settings-modal'
      : document.querySelector('#cardModal')?.classList.contains('show') ? '#cardModal .modal' : null;
    const modal = modalSelector ? boxes[modalSelector] : null;
    const findings = [];
    if (root.scrollWidth > root.clientWidth + 1) findings.push('global-horizontal-overflow');
    if (modal && (modal.left < -1 || modal.right > viewport.width + 1 || modal.top < -1 || modal.bottom > viewport.height + 1)) {
      findings.push('modal-outside-viewport');
    }
    for (const [selector, box] of Object.entries(boxes)) {
      if (box.left < -1 || box.right > viewport.width + 1) {
        const internallyScrollable = box.scrollWidth > box.clientWidth + 1;
        if (!internallyScrollable) findings.push('horizontal-clipping:' + selector);
      }
      if (box.bottom > root.scrollHeight + 1) findings.push('unreachable-bottom:' + selector);
    }
    return {
      ...${JSON.stringify(metadata)},
      viewport,
      direction: root.dir,
      document: {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight
      },
      boxes,
      modalSelector,
      deckChildren: document.querySelector('#deck')?.childElementCount ?? null,
      activeElement: document.activeElement ? {
        id: document.activeElement.id || null,
        group: document.activeElement.dataset?.group || null,
        index: document.activeElement.dataset?.index || null
      } : null,
      equityStreetOrder: [...document.querySelectorAll('[data-equity-street]')]
        .map((element) => element.dataset.equityStreet),
      equityBoardSlotOrder: [...document.querySelectorAll('[data-slots="eqboard"] > .card-slot')]
        .map((element) => Number(element.dataset.index)),
      findings
    };
  })()`);
}

async function capture(win, name) {
  fs.mkdirSync(artifactRoot, { recursive: true });
  const image = await win.webContents.capturePage();
  const filePath = path.join(artifactRoot, `${name}.png`);
  fs.writeFileSync(filePath, image.toPNG());
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

async function auditOne(win, configuration, state, screenshot = false) {
  await setViewport(win, configuration.width, configuration.height);
  win.webContents.setZoomFactor(configuration.zoom || 1);
  await setLanguage(win, configuration.language);
  await setTheme(win, configuration.theme);
  await prepareState(win, state);
  await settle(win);
  const result = await collectLayout(win, {
    targetViewport: `${configuration.width}x${configuration.height}`,
    zoom: configuration.zoom || 1,
    language: configuration.language,
    theme: configuration.theme,
    state
  });
  if (screenshot && screenshotsEnabled) {
    result.screenshot = await capture(win,
      `${configuration.width}x${configuration.height}-${configuration.language}-${configuration.theme}-${state}`
    );
  }
  return result;
}

async function runFullAudit(win) {
  const results = [];
  const coreStates = ['playbook-available', 'training-preanswer', 'equity-idle', 'guide', 'settings', 'card-picker-open'];
  for (const [width, height] of viewports) {
    for (const state of coreStates) {
      results.push(await auditOne(win, { width, height, language: 'en', theme: 'midnight' }, state,
        (width === 1024 || width === 3840) && ['playbook-available', 'equity-idle', 'guide', 'settings'].includes(state)));
    }
  }
  for (const [width, height] of [[1024, 768], [1920, 1080], [2560, 1600]]) {
    for (const language of languages) {
      for (const state of coreStates) {
        results.push(await auditOne(win, { width, height, language, theme: 'midnight' }, state,
          language === 'he' && width === 1024 && ['equity-idle', 'settings', 'card-picker-open'].includes(state)));
      }
    }
  }
  for (const [width, height] of [[1024, 768], [1920, 1080], [3840, 2160]]) {
    for (const theme of themes) {
      for (const state of coreStates) {
        results.push(await auditOne(win, { width, height, language: 'en', theme }, state,
          width === 1920 && ['graphite', 'daylight'].includes(theme) && state === 'playbook-available'));
      }
    }
  }
  const deepStates = [
    'playbook-unavailable', 'playbook-available', 'playbook-analysis', 'playbook-matrix',
    'playbook-matrix-postflop', 'playbook-range', 'playbook-table-expanded',
    'playbook-table-collapsed', 'playbook-hand', 'training-idle', 'training-preanswer',
    'training-hint', 'training-correct', 'training-mistake', 'equity-idle',
    'equity-known-board-dead', 'equity-progress', 'equity-complete', 'equity-advanced',
    'guide', 'settings', 'card-picker-open', 'card-picker-closed'
  ];
  for (const configuration of [
    { width: 1024, height: 768, language: 'ru', theme: 'midnight' },
    { width: 1024, height: 768, language: 'he', theme: 'daylight' },
    { width: 1920, height: 1080, language: 'en', theme: 'graphite' },
    { width: 2560, height: 1600, language: 'he', theme: 'midnight' }
  ]) {
    for (const state of deepStates) {
      results.push(await auditOne(win, configuration, state,
        configuration.width === 1920 && ['training-preanswer', 'training-correct', 'equity-complete'].includes(state)));
    }
  }
  for (const zoom of [0.9, 1.1, 1.25]) {
    for (const state of ['playbook-available', 'training-preanswer', 'equity-idle', 'settings']) {
      results.push(await auditOne(win,
        { width: 1920, height: 1080, language: 'en', theme: 'midnight', zoom }, state));
    }
  }
  const findings = results.flatMap((result) => result.findings.map((finding) => ({
    targetViewport: result.targetViewport,
    zoom: result.zoom,
    language: result.language,
    theme: result.theme,
    state: result.state,
    finding
  })));
  return {
    schemaVersion: 'responsive001-renderer-acceptance/v1',
    runCount: results.length,
    findingCount: findings.length,
    findings,
    results
  };
}

function createServer() {
  const types = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.svg': 'image/svg+xml'
  };
  return http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relative || 'app/index.html');
    if (!filePath.startsWith(`${repoRoot}${path.sep}`)) return response.writeHead(403).end();
    fs.readFile(filePath, (error, data) => {
      if (error) return response.writeHead(404).end();
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

app.whenReady().then(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true
    }
  });
  await win.loadURL(`${baseUrl}/app/index.html`);
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineI18n) && Boolean(window.app)");
  await delay(1200);
  await win.webContents.executeJavaScript(`(() => {
    const style = document.createElement('style');
    style.dataset.responsiveAudit = 'true';
    style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
    document.head.append(style);
  })()`);
  await selectEquity(win);

  const measurements = [];
  for (const [width, height] of viewports) {
    await setViewport(win, width, height);
    for (const language of languages) {
      await setLanguage(win, language);
      measurements.push(await measureStreetAlignment(win, `${width}x${height}`, language));
      if (screenshotsEnabled && (
        (width === 1024 && ['en', 'he'].includes(language))
        || (width === 1920 && language === 'en')
        || (width === 2560 && height === 1600 && language === 'he')
      )) {
        await win.webContents.executeJavaScript(
          "document.querySelector('.equity-board-layout')?.scrollIntoView({ block: 'center', inline: 'nearest' })"
        );
        await settle(win);
        await capture(win, `${width}x${height}-${language}-street-alignment`);
      }
    }
  }

  const report = {
    schemaVersion: 'responsive001-street-alignment/v1',
    phase,
    renderer: 'Electron offscreen renderer at 100% zoom',
    tolerancePixels: 0.5,
    measurements,
    fullAudit: fullAuditEnabled ? await runFullAudit(win) : null
  };
  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(
    path.join(artifactRoot, `${phase}-street-alignment.json`),
    `${JSON.stringify(report, null, 2)}\n`
  );
  if (report.fullAudit) {
    fs.writeFileSync(
      path.join(artifactRoot, 'renderer-acceptance.json'),
      `${JSON.stringify(report.fullAudit, null, 2)}\n`
    );
  }
  const output = report.fullAudit ? {
    schemaVersion: report.schemaVersion,
    phase: report.phase,
    streetMeasurementCount: report.measurements.length,
    maximumStreetDelta: Math.max(...report.measurements.flatMap((entry) => Object.values(entry.deltas))),
    fullAudit: {
      schemaVersion: report.fullAudit.schemaVersion,
      runCount: report.fullAudit.runCount,
      findingCount: report.fullAudit.findingCount,
      findings: report.fullAudit.findings
    }
  } : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});
