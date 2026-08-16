#!/usr/bin/env node
'use strict';

// UI-POLISH-003 bounded Electron verification. Screenshots go only to OS temp.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(os.tmpdir(), 'riverline-ui-polish003');
const findings = [];
const consoleErrors = [];
const samples = [];

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(win, expression, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(35);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target || target.disabled || target.hidden) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unavailable click target: ${selector}`);
  await settle(win);
}

async function setScenario(win, tableSize = 6) {
  await win.webContents.executeJavaScript(`(() => {
    app.gto.hero = ['As', 'Kh'];
    app.gto.board = ['Qc', '7d', '2s'];
    app.gto.dead = [];
    for (const id of ['players', 'playersNum']) document.querySelector('#' + id).value = ${tableSize};
    for (const id of ['stack', 'stackNum']) document.querySelector('#' + id).value = 100;
    document.querySelector('#heroPos').value = 'BTN';
    document.querySelector('#lastAction').value = 'check';
    for (const id of ['facingSize', 'facingSizeNum']) document.querySelector('#' + id).value = 0;
    for (const id of ['potSize', 'potSizeNum']) document.querySelector('#' + id).value = 6.5;
    renderAllCards();
    return updateContext('UI-POLISH-003 Electron verification');
  })()`);
  await waitFor(win, `document.querySelectorAll('#visual-table-container .table-seat').length === ${tableSize}`);
  await settle(win);
}

async function setPresentation(win, { width, height, language = 'en', theme = 'midnight' }) {
  win.setContentSize(width, height);
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage(${JSON.stringify(language)});
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    window.scrollTo(0, 0);
  })()`);
  await settle(win);
}

async function measure(win, label) {
  const sample = await win.webContents.executeJavaScript(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
    };
    const panel = document.querySelector('#playbookDecisionPathPanel');
    const toggle = document.querySelector('#actionPathDetailsToggle');
    const active = document.querySelector('#pathList [aria-current="step"]');
    const steps = [...document.querySelectorAll('#pathList .path-step')];
    return {
      label: ${JSON.stringify(label)},
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: window.devicePixelRatio },
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      presentation: panel?.dataset.actionPathPresentation,
      parentId: panel?.parentElement?.id,
      panel: rect('#playbookDecisionPathPanel'),
      betting: rect('#sharedControls'),
      decision: rect('#contextView'),
      table: rect('#visual-table-container'),
      save: rect('#savedStudySaveButton'),
      toggle: { hidden: toggle?.hidden, expanded: toggle?.getAttribute('aria-expanded'), rect: rect('#actionPathDetailsToggle') },
      compactGeometry: (() => {
        const panelBox = panel?.getBoundingClientRect();
        const mount = document.querySelector('#playbookCompactActionPathMount');
        const body = panel?.querySelector('.panel-body');
        const summary = panel?.querySelector('.path-current-summary');
        const visibleDescendants = panel
          ? [...panel.querySelectorAll('*')].filter((element) => {
              const style = getComputedStyle(element);
              const box = element.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
            })
          : [];
        const descendantBounds = panelBox && visibleDescendants.length
          ? {
              left: Math.min(...visibleDescendants.map((element) => element.getBoundingClientRect().left)),
              right: Math.max(...visibleDescendants.map((element) => element.getBoundingClientRect().right)),
              top: Math.min(...visibleDescendants.map((element) => element.getBoundingClientRect().top)),
              bottom: Math.max(...visibleDescendants.map((element) => element.getBoundingClientRect().bottom)),
            }
          : null;
        const style = panel ? getComputedStyle(panel) : null;
        return {
          mount: rect('#playbookCompactActionPathMount'),
          body: rect('#playbookDecisionPathPanel .panel-body'),
          progress: rect('#playbookDecisionPathPanel .path-progress'),
          summary: rect('#playbookDecisionPathPanel .path-current-summary'),
          descendantBounds,
          clientWidth: panel?.clientWidth,
          clientHeight: panel?.clientHeight,
          scrollWidth: panel?.scrollWidth,
          scrollHeight: panel?.scrollHeight,
          overflowX: style?.overflowX,
          overflowY: style?.overflowY,
          minHeight: style?.minHeight,
          maxHeight: style?.maxHeight,
          height: style?.height,
          mountScrollWidth: mount?.scrollWidth,
          mountClientWidth: mount?.clientWidth,
          bodyScrollHeight: body?.scrollHeight,
          bodyClientHeight: body?.clientHeight,
          summaryScrollWidth: summary?.scrollWidth,
          summaryClientWidth: summary?.clientWidth,
        };
      })(),
      activeStreet: active?.textContent.trim(),
      branch: document.querySelector('.path-current-summary strong')?.textContent.trim(),
      stepLefts: steps.map((step) => step.getBoundingClientRect().left),
      actionPathCount: document.querySelectorAll('#playbookDecisionPathPanel').length,
      pathListCount: document.querySelectorAll('#pathList').length,
      seatCount: document.querySelectorAll('#visual-table-container .table-seat').length,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      daylight: {
        railStart: getComputedStyle(document.querySelector('.table-rail-start')).stopColor,
        railEnd: getComputedStyle(document.querySelector('.table-rail-end')).stopColor,
        surfaceStart: getComputedStyle(document.querySelector('.table-surface-start')).stopColor,
        surfaceEnd: getComputedStyle(document.querySelector('.table-surface-end')).stopColor,
        shadowOpacity: getComputedStyle(document.querySelector('.table-shadow-effect')).floodOpacity,
      },
    };
  })()`);
  sample.viewport.zoomFactor = win.webContents.getZoomFactor();
  samples.push(sample);
  return sample;
}

async function capture(win, name) {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `${name}.png`);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(file, image.toPNG());
  return file;
}

function check(condition, message) {
  if (!condition) findings.push(message);
}

function verifyCompactGeometry(sample, expectedExpanded) {
  const geometry = sample.compactGeometry;
  check(sample.toggle.hidden === false && sample.toggle.expanded === expectedExpanded, `${sample.label}: compact disclosure state is not ${expectedExpanded}`);
  check(geometry?.overflowX === 'visible' && geometry?.overflowY === 'visible', `${sample.label}: compact panel masks overflow`);
  check(geometry?.scrollWidth <= geometry?.clientWidth + 1, `${sample.label}: compact panel horizontally clips content`);
  check(geometry?.scrollHeight <= geometry?.clientHeight + 1, `${sample.label}: compact panel vertically clips content`);
  check(geometry?.mountScrollWidth <= geometry?.mountClientWidth + 1, `${sample.label}: compact mount overflows its grid area`);
  check(geometry?.descendantBounds?.left >= sample.panel?.left - 1 && geometry?.descendantBounds?.right <= sample.panel?.right + 1, `${sample.label}: compact content escapes horizontal panel bounds`);
  check(geometry?.descendantBounds?.top >= sample.panel?.top - 1 && geometry?.descendantBounds?.bottom <= sample.panel?.bottom + 1, `${sample.label}: compact content escapes vertical panel bounds`);
  check(sample.toggle.rect?.left >= sample.panel?.left && sample.toggle.rect?.right <= sample.panel?.right, `${sample.label}: disclosure control escapes panel`);
  if (expectedExpanded === 'false') {
    check(geometry?.summary?.bottom <= sample.panel?.bottom - 1, `${sample.label}: current branch collides with panel bottom`);
  }
}

function verifyViewport(sample, compact) {
  check(sample.viewport.zoomFactor === 1, `${sample.label}: expected 100% zoom`);
  check(sample.actionPathCount === 1 && sample.pathListCount === 1, `${sample.label}: duplicate Action Path authority`);
  check(sample.presentation === (compact ? 'compact' : 'full'), `${sample.label}: wrong presentation ${sample.presentation}`);
  check(sample.parentId === (compact ? 'playbookCompactActionPathMount' : 'playbookActionPathRailMount'), `${sample.label}: wrong mount ${sample.parentId}`);
  check(Boolean(sample.activeStreet), `${sample.label}: current street missing`);
  check(Boolean(sample.branch), `${sample.label}: current branch missing`);
  check(sample.horizontalOverflow <= 1, `${sample.label}: global horizontal overflow ${sample.horizontalOverflow}px`);
  check(sample.save?.top >= 0 && sample.save?.bottom <= sample.viewport.height, `${sample.label}: Save spot not discoverable`);
  if (compact) {
    check(sample.panel?.top >= sample.betting?.bottom - 1, `${sample.label}: compact path precedes betting context`);
    check(sample.panel?.bottom <= sample.decision?.bottom, `${sample.label}: compact path fell beyond decision workflow`);
    check(sample.stepLefts.every((left, index, values) => index === 0 || left >= values[index - 1]), `${sample.label}: street order is not sane`);
    verifyCompactGeometry(sample, 'false');
  } else {
    check(sample.toggle.hidden === true, `${sample.label}: full mode exposes redundant disclosure`);
  }
}

async function createAllInRunout(win) {
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 10, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealHoleCards({ 'seat-0': ['As', 'Ad'], 'seat-1': ['Kh', 'Kd'] });
    bridge.applyAction('call');
    bridge.applyAction('check');
    bridge.dealBoardCards(['2c', '3c', '4c']);
    bridge.applyAction('all_in');
    bridge.applyAction('call');
    bridge.dealBoardCards(['9s']);
    bridge.dealBoardCards(['Jc']);
    bridge.resolveShowdown();
  })()`);
  await settle(win);
}

app.whenReady().then(async () => {
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
      partition: `ui-polish003-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 3) consoleErrors.push(String(message));
  });

  try {
    await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
    await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlinePlaybookState)");
    await delay(250);
    await click(win, '[data-mode="gto"]');
    await setScenario(win, 6);

    for (const configuration of [
      { width: 1024, height: 768, compact: true },
      { width: 1366, height: 768, compact: true },
      { width: 1440, height: 900, compact: true },
      { width: 1920, height: 1080, compact: false },
      { width: 2560, height: 1600, compact: false },
    ]) {
      await setPresentation(win, { ...configuration, language: 'en', theme: 'midnight' });
      const sample = await measure(win, `${configuration.width}x${configuration.height}-en-midnight`);
      verifyViewport(sample, configuration.compact);
      if ([1024, 1366, 1440, 1920].includes(configuration.width)) {
        await capture(win, sample.label);
      }
    }

    await setPresentation(win, { width: 1366, height: 768, language: 'en', theme: 'daylight' });
    const collapsed = await measure(win, '1366x768-en-daylight-collapsed');
    verifyViewport(collapsed, true);
    await capture(win, collapsed.label);
    await click(win, '#actionPathDetailsToggle');
    const expanded = await measure(win, '1366x768-en-daylight-expanded');
    check(expanded.toggle.expanded === 'true' && expanded.panel.height > collapsed.panel.height, '1366x768: Expand did not reveal detailed path');
    verifyCompactGeometry(expanded, 'true');
    await capture(win, expanded.label);
    await click(win, '#actionPathDetailsToggle');

    await setPresentation(win, { width: 1440, height: 900, language: 'he', theme: 'daylight' });
    const rtl = await measure(win, '1440x900-he-daylight');
    verifyViewport(rtl, true);
    check(rtl.direction === 'rtl', 'Hebrew did not apply RTL direction');
    await capture(win, rtl.label);

    await setPresentation(win, { width: 1920, height: 1080, language: 'en', theme: 'daylight' });
    for (const tableSize of [2, 6, 10]) {
      await setScenario(win, tableSize);
      const sample = await measure(win, `scenario-${tableSize}-max-daylight`);
      check(sample.seatCount === tableSize, `Daylight ${tableSize}-max seat count changed`);
      check(sample.daylight.shadowOpacity === '0.14', `Daylight shadow opacity is ${sample.daylight.shadowOpacity}`);
      await capture(win, sample.label);
    }

    await click(win, '[data-playbook-mode="hand"]');
    await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'hand'");
    await createAllInRunout(win);
    const hand = await measure(win, 'hand-hu-showdown-daylight');
    check(hand.seatCount === 2, 'Daylight Hand HU geometry changed');
    await capture(win, hand.label);
    await win.webContents.executeJavaScript('window.RiverlinePlaybookState.previousReplayFrame()');
    await waitFor(win, "window.RiverlinePlaybookState.createReplayProjectionViewModel()?.readOnly === true");
    const replay = await measure(win, 'replay-hu-daylight');
    check(replay.seatCount === 2, 'Daylight Replay HU geometry changed');
    await capture(win, replay.label);

    check(consoleErrors.length === 0, `renderer console errors: ${consoleErrors.join(' | ')}`);
    const result = { findings, consoleErrors, screenshots: outputDir, samples };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = findings.length ? 1 : 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
