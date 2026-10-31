/*
 * PERF-RL18 live renderer inventory.
 *
 * From the repository root in PowerShell:
 *   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
 *   .\node_modules\.bin\electron.cmd .\tests\tooling\measure_perf_rl18_dom.cjs
 *
 * This is measurement tooling, not a timing gate. Renderer timings are noisy;
 * compare repeated samples and DOM families rather than exact single values.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const appRoot = path.join(__dirname, '..', '..', 'app');
const repoRoot = path.join(appRoot, '..');
const windows = new Set();
let baseUrl = '';
let keeperWindow = null;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createRenderer() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) process.stderr.write(`[renderer console ${level}] ${message}\n`);
  });
  windows.add(win);
  if (!keeperWindow) keeperWindow = win;
  await win.loadURL(`${baseUrl}/app/index.html`);
  win.webContents.setZoomFactor(1);
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Performance.enable');
  await waitFor(win, "document.readyState === 'complete' && document.querySelector('#gtoMode')?.classList.contains('active')");
  await delay(1200);
  return win;
}

async function closeRenderer(win, { force = false } = {}) {
  if (!win || win.isDestroyed()) return;
  if (win === keeperWindow && !force) return;
  if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach();
  win.destroy();
  windows.delete(win);
  if (win === keeperWindow) keeperWindow = null;
}

async function waitFor(win, expression, timeoutMilliseconds = 10_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Missing click target: ${selector}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript(`new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })`);
}

async function selectPlaybookView(win, view) {
  await click(win, `[data-gto-view="${view}"]`);
  await waitFor(win, `document.querySelector('#${view === 'context' ? 'context' : view}View')?.style.display !== 'none'`);
  await settle(win);
}

async function selectMode(win, mode) {
  await click(win, `[data-mode="${mode}"]`);
  const id = mode === 'info' ? 'infoMode' : `${mode}Mode`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
  await settle(win);
}

async function chooseCard(win, group, index, card) {
  await click(win, `[data-slots="${group}"] [data-index="${index}"]`);
  await waitFor(win, "document.querySelector('#cardModal')?.classList.contains('show')");
  await click(win, `[data-deck-card="${card}"]`);
  await waitFor(win, "!document.querySelector('#cardModal')?.classList.contains('show')");
  await settle(win);
}

async function generateDeterministicTraining(win) {
  await selectMode(win, 'training');
  await win.webContents.executeJavaScript(`(() => {
    const seed = document.querySelector('#trainingSeedInput');
    seed.value = '123456789';
    seed.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(win, '#trainingGenerateSeed');
  await waitFor(win, "!document.querySelector('#trainingExerciseSurface')?.hidden", 20_000);
}

function summary(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  return {
    samples: samples.map((sample) => Number(sample.toFixed(3))),
    minMs: Number((sorted[0] || 0).toFixed(3)),
    medianMs: Number(median.toFixed(3)),
    maxMs: Number((sorted.at(-1) || 0).toFixed(3)),
  };
}

async function measureClick(win, selector, iterations = 7) {
  const samples = await win.webContents.executeJavaScript(`(async () => {
    const samples = [];
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) throw new Error('Missing timing target: ${selector}');
    for (let index = 0; index < ${iterations}; index += 1) {
      const startedAt = performance.now();
      target.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(performance.now() - startedAt);
    }
    return samples;
  })()`);
  return summary(samples);
}

async function measureAlternatingClicks(win, firstSelector, secondSelector, iterations = 7) {
  const samples = await win.webContents.executeJavaScript(`(async () => {
    const first = document.querySelector(${JSON.stringify(firstSelector)});
    const second = document.querySelector(${JSON.stringify(secondSelector)});
    if (!first || !second) throw new Error('Missing alternating timing target');
    const samples = [];
    for (let index = 0; index < ${iterations}; index += 1) {
      first.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const startedAt = performance.now();
      second.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(performance.now() - startedAt);
    }
    return samples;
  })()`);
  return summary(samples);
}

async function inventory(win, state) {
  const renderer = await win.webContents.executeJavaScript(`(() => {
    const all = [...document.querySelectorAll('*')];
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.visibility !== 'collapse'
        && element.getClientRects().length > 0;
    };
    const stats = (selector) => {
      const root = document.querySelector(selector);
      if (!root) return null;
      const descendants = [root, ...root.querySelectorAll('*')];
      const buttons = descendants.filter((element) => element.matches('button'));
      return {
        elements: descendants.length,
        buttons: buttons.length,
        visibleElements: descendants.filter(isVisible).length,
        visibleButtons: buttons.filter(isVisible).length,
        display: getComputedStyle(root).display,
        hidden: root.hidden,
      };
    };
    const inactiveModes = [...document.querySelectorAll('.mode-view')]
      .filter((root) => !isVisible(root));
    const inactivePlaybookViews = [...document.querySelectorAll('#gtoMode .gto-view')]
      .filter((root) => !isVisible(root));
    const withinRoots = (element, roots) => roots.some((root) => root === element || root.contains(element));
    const buttons = all.filter((element) => element.matches('button'));
    const families = {
      playbook: stats('#gtoMode'),
      decision: stats('#contextView'),
      matrix: stats('#chartView'),
      matrixGrid: stats('#strategyGrid'),
      rangeComparison: stats('#rangeView'),
      heroRangeGrid: stats('#heroRangeGrid'),
      villainRangeGrid: stats('#villainRangeGrid'),
      training: stats('#trainingMode'),
      trainingExercise: stats('#trainingExerciseSurface'),
      trainingFeedback: stats('#trainingFeedback'),
      trainingReference: stats('#trainingSolution'),
      equity: stats('#equityMode'),
      equityResults: stats('#equityResultsPanel'),
      guide: stats('#infoMode'),
      cardPicker: stats('#cardModal'),
      settings: stats('#settingsModal'),
    };
    return {
      state: ${JSON.stringify(state)},
      activeMode: document.querySelector('.riverline-shell')?.dataset.activeMode || null,
      activePlaybookView: document.querySelector('[data-gto-view][aria-selected="true"]')?.dataset.gtoView || null,
      totalElements: all.length,
      totalButtons: buttons.length,
      visibleElements: all.filter(isVisible).length,
      visibleButtons: buttons.filter(isVisible).length,
      computedDisplayNone: all.filter((element) => getComputedStyle(element).display === 'none').length,
      hiddenAttribute: all.filter((element) => element.hasAttribute('hidden')).length,
      insideInactiveModeRoots: all.filter((element) => withinRoots(element, inactiveModes)).length,
      insideInactivePlaybookRoots: all.filter((element) => withinRoots(element, inactivePlaybookViews)).length,
      matrixButtons: document.querySelectorAll('#strategyGrid button').length,
      rangeButtons: document.querySelectorAll('#heroRangeGrid button, #villainRangeGrid button').length,
      pickerButtons: document.querySelectorAll('#deck button').length,
      focusedElement: document.activeElement?.id || document.activeElement?.getAttribute('data-mode') || document.activeElement?.tagName || null,
      families,
    };
  })()`);
  const domCounters = await win.webContents.debugger.sendCommand('Memory.getDOMCounters');
  const performanceMetrics = await win.webContents.debugger.sendCommand('Performance.getMetrics');
  const metric = (name) => performanceMetrics.metrics.find((entry) => entry.name === name)?.value ?? null;
  return {
    ...renderer,
    browserDomCounters: domCounters,
    jsHeapUsedBytes: metric('JSHeapUsedSize'),
    jsHeapTotalBytes: metric('JSHeapTotalSize'),
    layoutCount: metric('LayoutCount'),
    recalcStyleCount: metric('RecalcStyleCount'),
  };
}

async function isolatedState(state, prepare) {
  const win = await createRenderer();
  try {
    await prepare(win);
    await settle(win);
    return await inventory(win, state);
  } finally {
    await closeRenderer(win);
  }
}

async function performanceSamples() {
  const win = await createRenderer();
  try {
    const firstMatrixActivation = await measureClick(win, '[data-gto-view="chart"]', 1);
    const repeatedMatrixActivation = await measureAlternatingClicks(
      win,
      '[data-gto-view="context"]',
      '[data-gto-view="chart"]',
    );
    const firstRangeActivation = await measureAlternatingClicks(
      win,
      '[data-gto-view="context"]',
      '[data-gto-view="range"]',
      1,
    );
    const repeatedRangeActivation = await measureAlternatingClicks(
      win,
      '[data-gto-view="context"]',
      '[data-gto-view="range"]',
    );
    await selectPlaybookView(win, 'context');
    const ordinaryUpdate = await win.webContents.executeJavaScript(`(async () => {
      const slider = document.querySelector('#potSize');
      const samples = [];
      for (let index = 0; index < 7; index += 1) {
        slider.value = String(10 + index);
        const startedAt = performance.now();
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        samples.push(performance.now() - startedAt);
      }
      return samples;
    })()`);
    const modeActivations = {};
    for (const mode of ['training', 'equity', 'info']) {
      await selectMode(win, 'gto');
      modeActivations[mode] = await measureAlternatingClicks(
        win,
        '[data-mode="gto"]',
        `[data-mode="${mode}"]`,
      );
    }
    await selectMode(win, 'gto');
    const pickerActivation = await measureClick(win, '[data-slots="hero"] [data-index="0"]', 1);
    await click(win, '#closeModal');
    return {
      timingModel: 'renderer performance.now from click/input dispatch through two animation frames; seven repeated samples unless noted',
      firstMatrixActivation,
      repeatedMatrixActivation,
      firstRangeActivation,
      repeatedRangeActivation,
      ordinaryPlaybookUpdate: summary(ordinaryUpdate),
      repeatedModeActivation: modeActivations,
      pickerActivation,
    };
  } finally {
    await closeRenderer(win);
  }
}

async function collectReport() {
  const states = [];
  states.push(await isolatedState('Playbook — Decision', async () => {}));
  states.push(await isolatedState('Playbook — preflop Matrix', (win) => selectPlaybookView(win, 'chart')));
  states.push(await isolatedState('Playbook — postflop Matrix unavailable', async (win) => {
    await chooseCard(win, 'board', 0, '2s');
    await chooseCard(win, 'board', 1, '7h');
    await chooseCard(win, 'board', 2, 'Td');
    await selectPlaybookView(win, 'chart');
  }));
  states.push(await isolatedState('Range Category Comparison', async (win) => {
    await chooseCard(win, 'board', 0, '2s');
    await chooseCard(win, 'board', 1, '7h');
    await chooseCard(win, 'board', 2, 'Td');
    await selectPlaybookView(win, 'range');
  }));
  states.push(await isolatedState('Training pre-answer', async (win) => {
    await generateDeterministicTraining(win);
  }));
  states.push(await isolatedState('Training post-answer', async (win) => {
    await generateDeterministicTraining(win);
    await waitFor(win, "document.querySelectorAll('#trainingGuessButtons button').length > 0", 20_000);
    await click(win, '#trainingGuessButtons button');
    await waitFor(win, "!document.querySelector('#trainingFeedback')?.hidden", 10_000);
  }));
  states.push(await isolatedState('Equity idle', (win) => selectMode(win, 'equity')));
  states.push(await isolatedState('Equity completed', async (win) => {
    await selectMode(win, 'equity');
    await click(win, '[data-equity-hand-mode="unknown"][data-player-index="0"]');
    await waitFor(win, "!document.querySelector('#calculate')?.disabled");
    await click(win, '#calculate');
    await waitFor(win, "document.querySelector('#equityResultsPanel')?.dataset.resultState === 'complete'", 30_000);
  }));
  states.push(await isolatedState('Guide', (win) => selectMode(win, 'info')));
  states.push(await isolatedState('Warmed Playbook Decision (historical comparison)', async (win) => {
    await selectPlaybookView(win, 'chart');
    await selectPlaybookView(win, 'context');
    await chooseCard(win, 'board', 0, '2s');
    await chooseCard(win, 'board', 1, '7h');
    await chooseCard(win, 'board', 2, 'Td');
    await selectPlaybookView(win, 'range');
    await selectPlaybookView(win, 'context');
  }));

  const focusWin = await createRenderer();
  let pickerInteraction;
  let responsiveThemeLanguageSmoke;
  try {
    await click(focusWin, '[data-slots="hero"] [data-index="0"]');
    const openFocus = await focusWin.webContents.executeJavaScript(`({
      card: document.activeElement?.dataset?.deckCard || null,
      deckButtons: document.querySelectorAll('#deck button').length,
    })`);
    await click(focusWin, '#closeModal');
    const cancelFocus = await focusWin.webContents.executeJavaScript(`({
      group: document.activeElement?.dataset?.group || null,
      index: document.activeElement?.dataset?.index || null,
      deckButtons: document.querySelectorAll('#deck button').length,
    })`);
    await click(focusWin, '[data-slots="hero"] [data-index="0"]');
    await click(focusWin, '[data-deck-card="As"]');
    const selectionFocus = await focusWin.webContents.executeJavaScript(`({
      group: document.activeElement?.dataset?.group || null,
      index: document.activeElement?.dataset?.index || null,
      deckButtons: document.querySelectorAll('#deck button').length,
    })`);
    pickerInteraction = { openFocus, cancelFocus, selectionFocus };
    await click(focusWin, '[data-theme-id="daylight"]');
    await focusWin.webContents.executeJavaScript(`(() => {
      const language = document.querySelector('#langToggle');
      language.value = 'he';
      language.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    focusWin.setContentSize(1024, 768);
    await settle(focusWin);
    await click(focusWin, '[data-slots="hero"] [data-index="1"]');
    await click(focusWin, '#closeModal');
    responsiveThemeLanguageSmoke = await focusWin.webContents.executeJavaScript(`({
      viewport: [innerWidth, innerHeight],
      theme: document.documentElement.dataset.theme,
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      pickerButtonsAfterClose: document.querySelectorAll('#deck button').length,
      focusGroup: document.activeElement?.dataset?.group || null,
      focusIndex: document.activeElement?.dataset?.index || null,
    })`);
  } finally {
    await closeRenderer(focusWin);
  }

  return {
    schemaVersion: 'perf-rl18-dom-inventory/v1',
    viewport: '1920x1080 at 100% zoom, offscreen Electron renderer',
    visibilityDefinition: 'computed display/visibility plus non-empty getClientRects()',
    historicalAudit: { date: '2026-08-13', totalElements: 2530, totalButtons: 673, visibleButtons: 28 },
    states,
    performance: await performanceSamples(),
    pickerInteraction,
    responsiveThemeLanguageSmoke,
  };
}

function compactReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    viewport: report.viewport,
    historicalAudit: report.historicalAudit,
    states: report.states.map((state) => ({
      state: state.state,
      totalElements: state.totalElements,
      totalButtons: state.totalButtons,
      visibleElements: state.visibleElements,
      visibleButtons: state.visibleButtons,
      computedDisplayNone: state.computedDisplayNone,
      hiddenAttribute: state.hiddenAttribute,
      insideInactiveModeRoots: state.insideInactiveModeRoots,
      insideInactivePlaybookRoots: state.insideInactivePlaybookRoots,
      matrixButtons: state.matrixButtons,
      rangeButtons: state.rangeButtons,
      pickerButtons: state.pickerButtons,
      browserNodes: state.browserDomCounters.nodes,
      jsHeapUsedMiB: state.jsHeapUsedBytes === null ? null : Number((state.jsHeapUsedBytes / 1048576).toFixed(2)),
      families: Object.fromEntries(Object.entries(state.families).map(([name, family]) => [name, {
        elements: family.elements,
        buttons: family.buttons,
        visibleElements: family.visibleElements,
        visibleButtons: family.visibleButtons,
      }])),
    })),
    performance: report.performance,
    pickerInteraction: report.pickerInteraction,
    responsiveThemeLanguageSmoke: report.responsiveThemeLanguageSmoke,
  };
}

function createStaticServer() {
  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '');
    const filePath = path.resolve(repoRoot, relativePath || 'app/index.html');
    const root = path.resolve(repoRoot);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'app', 'index.html')) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

app.whenReady().then(async () => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const report = await collectReport();
  const output = process.argv.includes('--summary') ? compactReport(report) : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  for (const win of [...windows]) await closeRenderer(win, { force: true });
  await new Promise((resolve) => server.close(resolve));
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
