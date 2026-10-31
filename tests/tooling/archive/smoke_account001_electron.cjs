#!/usr/bin/env node
'use strict';

// ACCOUNT-001 bounded renderer smoke. It writes no repository artifacts.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const samples = [];
const consoleErrors = [];

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

async function openSettings(win) {
  await click(win, '#openSettings');
  await waitFor(win, "document.querySelector('#settingsModal')?.classList.contains('show')");
  await waitFor(win, "document.querySelector('#settingsAccountProfile')?.dataset.accountState === 'ready'");
}

async function capture(win, { id, width, height, language, theme }) {
  win.setContentSize(width, height);
  await win.webContents.executeJavaScript(`(() => {
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    window.setLanguage(${JSON.stringify(language)});
    document.querySelector('#accountDisplayNameSubmit').focus({ preventScroll: true });
  })()`);
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab', modifiers: ['shift'] });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab', modifiers: ['shift'] });
  await settle(win);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const modal = document.querySelector('#settingsModal .settings-modal').getBoundingClientRect();
    const panel = document.querySelector('#settingsAccountProfile').getBoundingClientRect();
    const input = document.querySelector('#accountDisplayName');
    return {
      id: ${JSON.stringify(id)},
      viewport: { width: innerWidth, height: innerHeight },
      language: root.lang,
      direction: root.dir,
      theme: root.dataset.theme,
      accountState: document.querySelector('#settingsAccountProfile').dataset.accountState,
      localStatus: document.querySelector('#settingsAccountProfile').innerText,
      inputDirection: input.getAttribute('dir'),
      focusedId: document.activeElement?.id,
      documentHasFocus: document.hasFocus(),
      modalWithinViewport: modal.left >= -1 && modal.top >= -1
        && modal.right <= innerWidth + 1 && modal.bottom <= innerHeight + 1,
      panelWithinModal: panel.left >= modal.left - 1 && panel.right <= modal.right + 1,
      globalOverflowX: root.scrollWidth > root.clientWidth + 1,
      replacementCharacterVisible: document.querySelector('#settingsAccountProfile').innerText.includes('\uFFFD'),
      staleLoadingStatus: document.querySelector('#accountProfileStatus').textContent
        === window.t('Loading local profile…'),
      hasSignInButton: [...document.querySelectorAll('#settingsAccountProfile button')]
        .some((button) => /sign\s*in/i.test(button.textContent)),
    };
  })()`);
  samples.push(sample);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      offscreen: true,
      partition: `riverline-account001-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(String(message));
  });
  await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineAccountIdentity)");
  await waitFor(win, "document.querySelector('#settingsAccountProfile')?.dataset.accountState === 'ready'");
  const firstIdentity = await win.webContents.executeJavaScript('window.RiverlineAccountIdentity.getActiveIdentity()');

  await openSettings(win);
  await win.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#accountDisplayName');
    input.value = 'ויקטור Riverline 🎯';
    document.querySelector('#accountDisplayNameForm').requestSubmit();
  })()`);
  await waitFor(win, "document.querySelector('#accountDisplayNamePreview')?.textContent === 'ויקטור Riverline 🎯'");
  await waitFor(win, "document.querySelector('#accountProfileStatus')?.textContent === window.t('Display name saved.')");

  for (const fixture of [
    { id: '1024x768-en-midnight', width: 1024, height: 768, language: 'en', theme: 'midnight' },
    { id: '1366x768-he-daylight', width: 1366, height: 768, language: 'he', theme: 'daylight' },
    { id: '1366x900-ru-midnight', width: 1366, height: 900, language: 'ru', theme: 'midnight' },
  ]) await capture(win, fixture);

  await win.reload();
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineAccountIdentity)");
  await waitFor(win, "document.querySelector('#settingsAccountProfile')?.dataset.accountState === 'ready'");
  const reloadedIdentity = await win.webContents.executeJavaScript('window.RiverlineAccountIdentity.getActiveIdentity()');
  const summary = await win.webContents.executeJavaScript('window.RiverlineAccountIdentity.getProfileSummary()');

  const failures = [
    ...(firstIdentity.identityId !== reloadedIdentity.identityId ? ['identity-id-changed'] : []),
    ...(reloadedIdentity.displayName !== 'ויקטור Riverline 🎯' ? ['display-name-not-reloaded'] : []),
    ...(summary.syncEnabled !== false || summary.status !== 'local_only' ? ['profile-summary-not-local-only'] : []),
    ...samples.flatMap((sample) => [
      ...(!sample.modalWithinViewport ? [`${sample.id}:modal-overflow`] : []),
      ...(!sample.panelWithinModal ? [`${sample.id}:panel-overflow`] : []),
      ...(sample.globalOverflowX ? [`${sample.id}:global-overflow`] : []),
      ...(sample.focusedId !== 'accountDisplayName' ? [`${sample.id}:keyboard-focus`] : []),
      ...(sample.inputDirection !== 'auto' ? [`${sample.id}:name-direction`] : []),
      ...(sample.replacementCharacterVisible ? [`${sample.id}:mojibake`] : []),
      ...(sample.staleLoadingStatus ? [`${sample.id}:stale-loading-status`] : []),
      ...(sample.hasSignInButton ? [`${sample.id}:fake-sign-in`] : []),
      ...(sample.accountState !== 'ready' ? [`${sample.id}:account-not-ready`] : []),
    ]),
    ...consoleErrors.filter((message) => !/Autofill|DevTools/.test(message)).map((message) => `console:${message}`),
  ];

  process.stdout.write(`${JSON.stringify({ firstIdentity, reloadedIdentity, summary, samples, failures }, null, 2)}\n`);
  if (failures.length) throw new Error(`ACCOUNT-001 Electron smoke failed: ${failures.join(', ')}`);
  await win.destroy();
  await app.quit();
}).catch(async (error) => {
  console.error(error);
  app.exit(1);
});
