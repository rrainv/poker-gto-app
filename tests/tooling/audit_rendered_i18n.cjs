#!/usr/bin/env node
'use strict';

// I18N-001R2 rendered-visible audit. Run with Electron, not plain Node:
//   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
//   .\node_modules\.bin\electron.cmd .\tests\tooling\audit_rendered_i18n.cjs

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactRoot = path.join(repoRoot, 'tests', 'artifacts', 'i18n001r2');
const screenshotsEnabled = process.argv.includes('--screenshots');
const ALLOWED_ENGLISH_TOKENS = Object.freeze([
  'Riverline', 'Hero', 'Villain', 'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'LJ', 'MP',
  'bb', 'SPR', 'MDF', 'EV', 'GTO', 'Monte Carlo', 'ClubGG', 'DecisionContext',
  'StrategyResult', 'TrainingConfig', 'Web Worker', 'English', 'uint32', 'ID',
  'Discord', 'PioSolver', 'CRT'
]);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

let server;
let baseUrl;

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function waitFor(win, expression, timeoutMilliseconds = 15_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(`Boolean(${expression})`)) return;
    await delay(30);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function settle(win) {
  await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function click(win, selector) {
  const found = await win.webContents.executeJavaScript(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.click(); return true; })()`);
  if (!found) throw new Error(`Missing click target: ${selector}`);
  await settle(win);
}

async function setLanguage(win, language) {
  await win.webContents.executeJavaScript(`window.setLanguage(${JSON.stringify(language)})`);
  await settle(win);
}

async function selectMode(win, mode) {
  await click(win, `[data-mode="${mode}"]`);
  const id = mode === 'info' ? 'infoMode' : `${mode}Mode`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
}

async function selectPlaybookView(win, view) {
  await click(win, `[data-gto-view="${view}"]`);
  const id = view === 'context' ? 'contextView' : `${view}View`;
  await waitFor(win, `document.querySelector('#${id}')?.style.display !== 'none'`);
}

async function generateAnsweredTraining(win) {
  await selectMode(win, 'training');
  await win.webContents.executeJavaScript(`(() => {
    const seed = document.querySelector('#trainingSeedInput');
    seed.value = '123456789';
    seed.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(win, '#trainingGenerateSeed');
  await waitFor(win, "!document.querySelector('#trainingExerciseSurface')?.hidden", 25_000);
  await waitFor(win, "document.querySelectorAll('#trainingGuessButtons button').length > 0", 25_000);
  await win.webContents.executeJavaScript(`(() => {
    const solution = [...(window.app?.training?.currentSolution || [])].sort((a, b) => a.value - b.value);
    const action = solution[0]?.action?.type;
    const button = [...document.querySelectorAll('#trainingGuessButtons button')].find((entry) => entry.dataset.action === action)
      || document.querySelector('#trainingGuessButtons button:last-child');
    button?.click();
  })()`);
  await waitFor(win, "!document.querySelector('#trainingFeedback')?.hidden", 15_000);
  await win.webContents.executeJavaScript(`(() => {
    document.querySelectorAll('#trainingAnalysis details').forEach((entry) => { entry.open = true; });
  })()`);
  await settle(win);
}

function likelySource(selector, kind) {
  if (selector.includes('trainingAnalysis') || selector.includes('teacherContent')) return 'app/src/ui/teacher.js';
  if (selector.includes('visual-table-container')) return 'app/src/ui/TableRenderer.js';
  if (selector.includes('strategyGrid') || selector.includes('selectedHand')) return 'app/src/core/logic.js:renderChart';
  if (kind !== 'text') return 'app/index.html or dynamic renderer';
  return 'app/index.html / app/src/core/logic.js';
}

function residualWords(text) {
  let candidate = String(text || '');
  for (const phrase of [...ALLOWED_ENGLISH_TOKENS].sort((a, b) => b.length - a.length)) {
    candidate = candidate.replaceAll(phrase, ' ');
  }
  candidate = candidate
    .replace(/\b(?:UTG|HJ|CO|BTN|SB|BB|LJ|MP)(?:\+\d+)?\b/g, ' ')
    .replace(/\b[2-9TJQKA]{2}[so]?\b/g, ' ')
    .replace(/\b[2-9TJQKA][cdhs]\b/gi, ' ')
    .replace(/\bP\d+\b/g, ' ')
    .replace(/\b(?:v?\d+(?:\.\d+)?|x\d+)\b/gi, ' ');
  return candidate.match(/[A-Za-z]{2,}/g) || [];
}

function forbiddenScripts(text, language) {
  const scripts = [];
  if (language !== 'ru' && /[\u0400-\u04FF]{2,}/u.test(text)) scripts.push('cyrillic');
  if (language !== 'he' && /[\u0590-\u05FF]{2,}/u.test(text)) scripts.push('hebrew');
  return scripts;
}

async function collectVisibleText(win, language, state, scopeSelector = '.riverline-shell') {
  const entries = await win.webContents.executeJavaScript(`(() => {
    const root = document.querySelector(${JSON.stringify(scopeSelector)});
    const visible = (element) => {
      if (!element || !root?.contains(element)) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
        && element.getClientRects().length > 0;
    };
    const selectorFor = (element) => {
      if (element.id) return '#' + CSS.escape(element.id);
      const parts = [];
      let current = element;
      while (current && current !== root && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) part += '.' + [...current.classList].slice(0, 2).map((name) => CSS.escape(name)).join('.');
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    const output = [];
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (!visible(element)) continue;
      if (element.closest('.poker-data-token')) continue;
      const hasStaticI18n = [...element.attributes].some((attribute) => attribute.name.startsWith('data-i18n'));
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent.replace(/\\s+/g, ' ').trim();
        if (text) output.push({ text, selector: selectorFor(element), kind: 'text', origin: hasStaticI18n ? 'static-dom' : 'dynamic-renderer' });
      }
      for (const attribute of ['aria-label', 'aria-description', 'title', 'placeholder']) {
        const text = (element.getAttribute(attribute) || '').replace(/\\s+/g, ' ').trim();
        if (text) output.push({ text, selector: selectorFor(element), kind: attribute, origin: 'user-facing-attribute' });
      }
      if (element instanceof HTMLSelectElement) {
        for (const option of element.selectedOptions) {
          const text = option.label.replace(/\\s+/g, ' ').trim();
          if (text) output.push({ text, selector: selectorFor(element), kind: 'option-label', origin: 'user-facing-attribute' });
        }
      }
      if (element instanceof HTMLInputElement
        && ['button', 'submit', 'reset', 'text', 'number', 'search'].includes(element.type)) {
        const text = String(element.value || '').replace(/\\s+/g, ' ').trim();
        if (text && /[A-Za-z\\u0400-\\u04FF\\u0590-\\u05FF]/u.test(text)) {
          output.push({ text, selector: selectorFor(element), kind: 'input-value', origin: 'user-facing-attribute' });
        }
      }
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(element, pseudo);
        const raw = style.content || '';
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
          || raw === 'none' || raw === 'normal' || raw === '""') continue;
        if (/^(?:counter|counters|attr|var)\\(/.test(raw)) continue;
        let text = raw;
        if (raw.startsWith('"') && raw.endsWith('"')) {
          try { text = JSON.parse(raw); } catch { text = raw.slice(1, -1); }
        }
        text = String(text).replace(/\\s+/g, ' ').trim();
        if (text) output.push({ text, selector: selectorFor(element), kind: pseudo.slice(2), origin: 'dynamic-renderer' });
      }
    }
    return output;
  })()`);
  const inspected = new Map();
  entries.forEach((entry) => inspected.set(`${entry.kind}|${entry.selector}|${entry.text}`, entry));
  const unique = new Map();
  inspected.forEach((entry) => {
    const words = language === 'en' ? [] : residualWords(entry.text);
    const scripts = forbiddenScripts(entry.text, language);
    if (!words.length && !scripts.length) return;
    const key = `${entry.kind}|${entry.selector}|${entry.text}`;
    unique.set(key, {
      language,
      state,
      phrase: entry.text,
      englishWords: words,
      forbiddenScripts: scripts,
      kind: entry.kind,
      origin: entry.origin,
      selector: entry.selector,
      likelySource: likelySource(entry.selector, entry.kind)
    });
  });
  const coverage = { staticDom: 0, dynamicRenderer: 0, userFacingAttributes: 0 };
  inspected.forEach((entry) => {
    if (entry.origin === 'static-dom') coverage.staticDom += 1;
    else if (entry.origin === 'user-facing-attribute') coverage.userFacingAttributes += 1;
    else coverage.dynamicRenderer += 1;
  });
  return { findings: [...unique.values()], coverage, inspectedEntryCount: inspected.size };
}

async function capture(win, name, focusSelector) {
  if (!screenshotsEnabled) return null;
  fs.mkdirSync(artifactRoot, { recursive: true });
  if (focusSelector) {
    await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(focusSelector)})?.scrollIntoView({ block: 'start' })`);
    await settle(win);
  }
  const filePath = path.join(artifactRoot, `${name}.png`);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(filePath, image.toPNG());
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

async function auditState(win, language, state, scopeSelector = '.riverline-shell', focusSelector = null) {
  const result = await collectVisibleText(win, language, state, scopeSelector);
  return {
    state,
    ...result,
    screenshot: await capture(win, `${language}-${state}`, focusSelector)
  };
}

async function auditLanguage(win, language) {
  const reports = [];
  await selectMode(win, 'gto');
  await setLanguage(win, language);
  await selectPlaybookView(win, 'chart');
  await click(win, '#strategyGrid button[data-hand="AA"]');
  reports.push(await auditState(win, language, 'matrix-selected', '.riverline-shell', '.matrix-hand-inspector'));

  await click(win, '#playbookHandMode');
  reports.push(await auditState(win, language, 'hand-empty', '.riverline-shell', '#visual-table-container'));

  await click(win, '#playbookScenarioMode');
  await selectPlaybookView(win, 'context');
  reports.push(await auditState(win, language, 'playbook-unavailable', '.riverline-shell', '#teacherContent'));

  await generateAnsweredTraining(win);
  reports.push(await auditState(win, language, 'training-answered', '.riverline-shell', '#trainingAnalysis'));

  await click(win, '#openSettings');
  reports.push(await auditState(win, language, 'settings', '#settingsModal', '#settingsModal'));
  await click(win, '#closeSettingsModal');

  await selectMode(win, 'equity');
  await win.webContents.executeJavaScript(`document.querySelector('#equityAdvanced').open = true`);
  await settle(win);
  reports.push(await auditState(win, language, 'equity-advanced', '.riverline-shell', '#equityAdvanced'));
  return reports;
}

async function verifyLiveSwitch(win) {
  await setLanguage(win, 'en');
  await selectMode(win, 'gto');
  await selectPlaybookView(win, 'chart');
  await click(win, '#strategyGrid button[data-hand="AA"]');
  const matrixBefore = await win.webContents.executeJavaScript(`(() => {
    window.__i18nAuditMatrixModel = window.app?.matrixModel;
    return { selectedHand: window.app?.selectedHand, modelKey: window.app?.matrixModel?.key || null };
  })()`);
  const matrixLanguages = {};
  for (const language of ['ru', 'he', 'en']) {
    await setLanguage(win, language);
    matrixLanguages[language] = await win.webContents.executeJavaScript(`({
      selectedHand: window.app?.selectedHand,
      sameModel: window.app?.matrixModel === window.__i18nAuditMatrixModel,
      modelKey: window.app?.matrixModel?.key || null
    })`);
  }

  await setLanguage(win, 'en');
  await generateAnsweredTraining(win);
  const trainingBefore = await win.webContents.executeJavaScript(`(() => {
    window.__i18nAuditExercise = window.app?.training?.currentExercise;
    return {
      exerciseId: window.app?.training?.currentExercise?.id || null,
      seed: window.app?.training?.currentExercise?.seed ?? null,
      lifecycle: window.app?.training?.lifecycle || null
    };
  })()`);
  const trainingLanguages = {};
  const liveFindings = [];
  const liveCoverage = [];
  for (const language of ['ru', 'he', 'en']) {
    await setLanguage(win, language);
    trainingLanguages[language] = await win.webContents.executeJavaScript(`({
      sameExercise: window.app?.training?.currentExercise === window.__i18nAuditExercise,
      exerciseId: window.app?.training?.currentExercise?.id || null,
      seed: window.app?.training?.currentExercise?.seed ?? null,
      lifecycle: window.app?.training?.lifecycle || null
    })`);
    const rendered = await collectVisibleText(win, language, `live-switch-training-${language}`);
    liveFindings.push(...rendered.findings);
    liveCoverage.push({ language, state: 'training', ...rendered.coverage });
  }

  await setLanguage(win, 'ru');
  await selectMode(win, 'gto');
  await click(win, '#playbookScenarioMode');
  await selectPlaybookView(win, 'context');
  const unavailableBefore = await win.webContents.executeJavaScript(`(async () => {
    window.app.gto.hero = [];
    window.app.gto.board = [];
    await window.updateContext('i18n001r2-unavailable');
    window.__i18nAuditUnavailableResult = window.app?.strategyResult;
    return {
      source: window.app?.strategyResult?.source || null,
      explanation: window.app?.strategyResult?.explanation || null
    };
  })()`);
  const unavailableLanguages = {};
  const unavailableSwitches = [];
  for (const language of ['he', 'en', 'ru', 'he', 'en']) {
    await setLanguage(win, language);
    const snapshot = await win.webContents.executeJavaScript(`(() => {
      const expected = window.t('Choose two hero cards to calculate a heuristic strategy.');
      const bestReason = document.querySelector('#bestReason')?.textContent.trim() || '';
      const warning = document.querySelector('#strategyWarnings')?.textContent.trim() || '';
      return {
        sameResult: window.app?.strategyResult === window.__i18nAuditUnavailableResult,
        expected,
        bestReason,
        warning,
        visibleSurfaceCount: [bestReason, warning].filter((text) => text === expected).length
      };
    })()`);
    unavailableLanguages[language] = snapshot;
    unavailableSwitches.push({ language, ...snapshot });
    const rendered = await collectVisibleText(win, language, `live-switch-unavailable-${language}`);
    liveFindings.push(...rendered.findings);
    liveCoverage.push({ language, state: 'unavailable', ...rendered.coverage });
  }
  const matrixPreserved = Object.values(matrixLanguages).every((entry) => (
    entry.selectedHand === matrixBefore.selectedHand
    && entry.sameModel
    && entry.modelKey === matrixBefore.modelKey
  ));
  const trainingPreserved = Object.values(trainingLanguages).every((entry) => (
    entry.sameExercise
    && entry.exerciseId === trainingBefore.exerciseId
    && entry.seed === trainingBefore.seed
    && entry.lifecycle === trainingBefore.lifecycle
  ));
  const unavailablePreserved = unavailableBefore.source === 'unavailable'
    && unavailableBefore.explanation === 'Choose two hero cards to calculate a heuristic strategy.'
    && unavailableSwitches.every((entry) => (
      entry.sameResult
      && entry.bestReason === entry.expected
      && entry.warning === entry.expected
      && entry.visibleSurfaceCount === 2
    ));
  return {
    pass: matrixPreserved && trainingPreserved && unavailablePreserved && liveFindings.length === 0,
    matrixPreserved,
    trainingPreserved,
    unavailablePreserved,
    matrixBefore,
    matrixLanguages,
    trainingBefore,
    trainingLanguages,
    unavailableBefore,
    unavailableLanguages,
    unavailableSwitches,
    coverage: liveCoverage,
    findings: liveFindings
  };
}

function createServer() {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript', '.svg': 'image/svg+xml' };
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

app.whenReady().then(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const win = new BrowserWindow({
    width: 1920, height: 1080, useContentSize: true, show: false, frame: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false, webSecurity: false, offscreen: true }
  });
  await win.loadURL(`${baseUrl}/app/index.html`);
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineI18n) && Boolean(window.app)");
  await delay(1200);
  const languages = {};
  for (const language of ['ru', 'he']) languages[language] = await auditLanguage(win, language);
  const liveSwitch = await verifyLiveSwitch(win);
  const findings = [
    ...Object.values(languages).flatMap((reports) => reports.flatMap((report) => report.findings)),
    ...liveSwitch.findings
  ];
  const report = {
    schemaVersion: 'i18n-rendered-visible-audit/v2',
    viewport: '1920x1080 at 100% zoom, offscreen Electron renderer',
    whitelist: { invariantTokens: ALLOWED_ENGLISH_TOKENS },
    findings,
    liveSwitch,
    states: languages
  };
  if (screenshotsEnabled) {
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, 'rendered-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  const output = process.argv.includes('--summary') ? {
    schemaVersion: report.schemaVersion,
    viewport: report.viewport,
    findingCount: findings.length,
    liveSwitch: {
      pass: liveSwitch.pass,
      matrixPreserved: liveSwitch.matrixPreserved,
      trainingPreserved: liveSwitch.trainingPreserved,
      unavailablePreserved: liveSwitch.unavailablePreserved,
      findingCount: liveSwitch.findings.length
    },
    uniquePhrases: [...new Set(findings.map((entry) => entry.phrase))].sort(),
    byLanguageAndState: Object.fromEntries(Object.entries(languages).map(([language, reports]) => [language,
      Object.fromEntries(reports.map((entry) => [entry.state, entry.findings.length]))
    ])),
    coverageByLanguageAndState: Object.fromEntries(Object.entries(languages).map(([language, reports]) => [language,
      Object.fromEntries(reports.map((entry) => [entry.state, entry.coverage]))
    ]))
  } : report;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  win.destroy();
  await new Promise((resolve) => server.close(resolve));
  app.exit(findings.length || !liveSwitch.pass ? 2 : 0);
}).catch(async (error) => {
  process.stderr.write(`${error.stack || error}\n`);
  if (server) await new Promise((resolve) => server.close(resolve));
  app.exit(1);
});

module.exports = { ALLOWED_ENGLISH_TOKENS, forbiddenScripts, residualWords };
