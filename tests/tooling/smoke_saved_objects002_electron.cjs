#!/usr/bin/env node
'use strict';

// SAVED-OBJECTS-002 bounded Electron smoke. Screenshots go only to the OS temp folder.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const screenshots = [];
const samples = [];
const placementSamples = [];
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

async function setScenario(win, allowAlreadySaved = false) {
  await win.webContents.executeJavaScript(`(() => {
    app.gto.hero = ['As', 'Kh'];
    app.gto.board = ['Qc', '7d', '2s'];
    app.gto.dead = [];
    document.querySelector('#players').value = '6';
    document.querySelector('#playersNum').value = '6';
    document.querySelector('#stack').value = '100';
    document.querySelector('#stackNum').value = '100';
    document.querySelector('#heroPos').value = 'BTN';
    document.querySelector('#lastAction').value = 'check';
    document.querySelector('#facingSize').value = '0';
    document.querySelector('#facingSizeNum').value = '0';
    document.querySelector('#potSize').value = '6.5';
    document.querySelector('#potSizeNum').value = '6.5';
    renderAllCards();
    return updateContext('Saved Objects smoke scenario');
  })()`);
  try {
    await waitFor(win, allowAlreadySaved
      ? "document.querySelector('#savedStudySaveButton')?.disabled === false || document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'"
      : "document.querySelector('#savedStudySaveButton')?.disabled === false", 5_000);
  } catch (error) {
    const diagnostics = await win.webContents.executeJavaScript(`(() => ({
      mode: window.RiverlinePlaybookState.getMode(),
      resolution: app.playbookResolution,
      decisionContext: app.decisionContext,
      button: {
        disabled: document.querySelector('#savedStudySaveButton')?.disabled,
        state: document.querySelector('#savedStudySaveButton')?.dataset.saveState,
        text: document.querySelector('#savedStudySaveButton')?.textContent,
      },
      scenarioInput: window.RiverlinePlaybookState.getScenarioInput(),
    }))()`);
    throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}`);
  }
}

async function createObservedHand(win) {
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Ad'] });
  })()`);
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.disabled === false");
}

async function openEditor(win) {
  await click(win, '#savedStudyEditButton');
  await waitFor(win, "document.querySelector('#savedStudyModal')?.classList.contains('show')");
}

async function setMetadata(win, { title, note, tags }) {
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('#savedStudyTitle').value = ${JSON.stringify(title)};
    document.querySelector('#savedStudyNote').value = ${JSON.stringify(note)};
    document.querySelector('#savedStudyTags').value = ${JSON.stringify(tags)};
    document.querySelector('#savedStudyReviewLater').checked = true;
    document.querySelector('#savedStudyMistake').checked = true;
  })()`);
}

async function captureEditor(win, id, { width, height, language, theme }) {
  win.setContentSize(width, height);
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage(${JSON.stringify(language)});
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
  })()`);
  await settle(win);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const modal = document.querySelector('#savedStudyModal .saved-study-modal');
    const rect = modal.getBoundingClientRect();
    const controls = [...modal.querySelectorAll('button, input, textarea, label, legend, p, small')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect: box }) => box.left < rect.left - 1 || box.right > rect.right + 1)
      .map(({ element }) => element.id || element.tagName);
    return {
      id: ${JSON.stringify(id)},
      viewport: { width: innerWidth, height: innerHeight },
      language: root.lang,
      direction: root.dir,
      theme: root.dataset.theme,
      modalFullyInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      globalOverflowX: root.scrollWidth > root.clientWidth + 1,
      controlOverflows: controls,
      focusedElement: document.activeElement?.id || null,
      titleDirection: document.querySelector('#savedStudyTitle')?.dir,
      noteLineBreakPreserved: document.querySelector('#savedStudyNote')?.value.includes('\\n'),
    };
  })()`);
  samples.push(sample);
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(os.tmpdir(), `riverline-saved002-${id}.png`);
  fs.writeFileSync(screenshotPath, image.toPNG());
  screenshots.push(screenshotPath);
}

async function capturePlacement(win, id, {
  width, height, language, theme, expectedMount, contextSelector = null,
}) {
  win.setContentSize(width, height);
  await win.webContents.executeJavaScript(`(() => {
    window.setLanguage(${JSON.stringify(language)});
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    const context = document.querySelector(${JSON.stringify(contextSelector)});
    if (context) context.scrollIntoView({ block: 'center', inline: 'nearest' });
    else window.scrollTo(0, 0);
  })()`);
  await settle(win);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const actions = document.querySelector('#savedStudySourceActions');
    const focusTarget = document.querySelector('#savedStudyEditButton:not([hidden]):not(:disabled)')
      || document.querySelector('#savedStudySaveButton:not(:disabled)');
    focusTarget?.focus({ preventScroll: true });
    const rect = actions?.getBoundingClientRect();
    const style = actions ? getComputedStyle(actions) : null;
    return {
      id: ${JSON.stringify(id)},
      viewport: { width: innerWidth, height: innerHeight },
      language: root.lang,
      direction: root.dir,
      theme: root.dataset.theme,
      expectedMount: ${JSON.stringify(expectedMount)},
      actualMount: actions?.parentElement?.id || null,
      actionFullyInViewport: Boolean(rect
        && style?.display !== 'none'
        && style?.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
        && rect.left >= 0
        && rect.top >= 0
        && rect.right <= innerWidth
        && rect.bottom <= innerHeight),
      actionHeight: rect?.height || null,
      focusedElement: document.activeElement?.id || null,
      focusWithinActions: Boolean(actions?.contains(document.activeElement)),
      globalOverflowX: root.scrollWidth > root.clientWidth + 1,
      actionNodeCount: document.querySelectorAll('#savedStudySourceActions').length,
      saveButtonCount: document.querySelectorAll('#savedStudySaveButton').length,
      savedState: document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed'),
    };
  })()`);
  placementSamples.push(sample);
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(os.tmpdir(), `riverline-saved002r-${id}.png`);
  fs.writeFileSync(screenshotPath, image.toPNG());
  screenshots.push(screenshotPath);
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
      partition: 'riverline-saved-objects-002-smoke',
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(String(message));
  });
  await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineSavedStudyObjects)");
  await delay(250);
  await click(win, '[data-mode="gto"]');
  await click(win, '[data-playbook-mode="hand"]');
  await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'hand'");
  await createObservedHand(win);
  await capturePlacement(win, 'hand-1024x768-en-midnight', {
    width: 1024, height: 768, language: 'en', theme: 'midnight', expectedMount: 'handSavedStudyActionMount',
  });

  await Promise.all([
    click(win, '#savedStudySaveButton'),
    win.webContents.executeJavaScript("document.querySelector('#savedStudySaveButton').click()"),
  ]);
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
  const handSaved = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'hand' })",
  );
  await openEditor(win);
  await setMetadata(win, {
    title: 'Tough turn decision',
    note: 'First line\nSecond line',
    tags: 'River, Review, river',
  });
  for (const [id, options] of [
    ['1024x768-en-midnight', { width: 1024, height: 768, language: 'en', theme: 'midnight' }],
    ['1440x900-he-daylight', { width: 1440, height: 900, language: 'he', theme: 'daylight' }],
    ['1920x1080-ru-midnight', { width: 1920, height: 1080, language: 'ru', theme: 'midnight' }],
    ['2560x1600-en-daylight', { width: 2560, height: 1600, language: 'en', theme: 'daylight' }],
  ]) await captureEditor(win, id, options);
  await click(win, '#savedStudySubmitButton');
  await waitFor(win, "document.querySelector('#savedStudyModal')?.hidden === true");
  await capturePlacement(win, 'hand-1920x1080-he-daylight', {
    width: 1920, height: 1080, language: 'he', theme: 'daylight', expectedMount: 'handSavedStudyActionMount',
  });
  const handUpdated = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'hand' })",
  );

  await win.webContents.executeJavaScript("window.RiverlinePlaybookState.previousReplayFrame()");
  await waitFor(win, "window.RiverlinePlaybookState.createReplayProjectionViewModel()?.readOnly === true");
  await capturePlacement(win, 'replay-1024x768-he-daylight', {
    width: 1024, height: 768, language: 'he', theme: 'daylight', expectedMount: 'replaySavedStudyActionMount',
    contextSelector: '#handReplayControls',
  });
  const replaySaved = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'hand' })",
  );
  await openEditor(win);
  await click(win, '#savedStudyArchiveButton');
  await waitFor(win, "document.querySelector('#savedStudyArchiveConfirmation')?.hidden === false");
  await click(win, '#savedStudyArchiveKeepButton');
  await click(win, '#savedStudyArchiveButton');
  await click(win, '#savedStudyArchiveConfirmButton');
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'false'");

  await click(win, '[data-playbook-mode="scenario"]');
  await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'scenario'");
  await setScenario(win);
  await capturePlacement(win, 'scenario-1024x768-en-midnight', {
    width: 1024, height: 768, language: 'en', theme: 'midnight', expectedMount: 'scenarioSavedStudyActionMount',
  });
  await click(win, '#savedStudySaveButton');
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
  await openEditor(win);
  await setMetadata(win, { title: 'Scenario note', note: 'Lossy study spot', tags: 'scenario' });
  await click(win, '#savedStudySubmitButton');
  await waitFor(win, "document.querySelector('#savedStudyModal')?.hidden === true");
  await capturePlacement(win, 'scenario-1920x1080-he-daylight', {
    width: 1920, height: 1080, language: 'he', theme: 'daylight', expectedMount: 'scenarioSavedStudyActionMount',
  });
  const scenarioBeforeReload = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'scenario', scenarioInput: window.RiverlinePlaybookState.getScenarioInput() })",
  );

  await win.reload();
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.app) && Boolean(window.RiverlineSavedStudyObjects)");
  await delay(250);
  await click(win, '[data-mode="gto"]');
  await setScenario(win, true);
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
  const scenarioAfterReload = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'scenario', scenarioInput: window.RiverlinePlaybookState.getScenarioInput() })",
  );

  const findings = [
    ...(handSaved.state !== 'saved' ? ['hand-not-saved'] : []),
    ...(handUpdated.object?.id !== handSaved.object?.id ? ['metadata-target-changed'] : []),
    ...(handUpdated.object?.annotations?.note !== 'First line\nSecond line' ? ['note-line-break-lost'] : []),
    ...(handUpdated.object?.annotations?.tags?.length !== 2 ? ['tag-normalization-failed'] : []),
    ...(handUpdated.object?.annotations?.reviewState !== 'review_later' ? ['review-later-failed'] : []),
    ...(!handUpdated.object?.annotations?.classifications?.includes('mistake') ? ['mistake-failed'] : []),
    ...(replaySaved.object?.id !== handSaved.object?.id ? ['replay-created-different-identity'] : []),
    ...(scenarioBeforeReload.object?.payload?.truth?.historyStatus !== 'not_available' ? ['scenario-claimed-history'] : []),
    ...(scenarioAfterReload.object?.id !== scenarioBeforeReload.object?.id ? ['scenario-reload-identity-changed'] : []),
    ...(scenarioAfterReload.object?.annotations?.title !== 'Scenario note' ? ['scenario-metadata-not-restored'] : []),
    ...samples.flatMap((sample) => [
      ...(!sample.modalFullyInViewport ? [`${sample.id}:modal-outside-viewport`] : []),
      ...(sample.globalOverflowX ? [`${sample.id}:global-overflow-x`] : []),
      ...sample.controlOverflows.map((control) => `${sample.id}:control-overflow:${control}`),
      ...(!sample.noteLineBreakPreserved ? [`${sample.id}:note-line-break-not-visible`] : []),
    ]),
    ...placementSamples.flatMap((sample) => [
      ...(sample.actualMount !== sample.expectedMount ? [`${sample.id}:wrong-context:${sample.actualMount}`] : []),
      ...(!sample.actionFullyInViewport ? [`${sample.id}:action-outside-viewport`] : []),
      ...(!sample.focusWithinActions ? [`${sample.id}:action-focus-failed`] : []),
      ...(sample.globalOverflowX ? [`${sample.id}:global-overflow-x`] : []),
      ...(sample.actionNodeCount !== 1 ? [`${sample.id}:action-node-count:${sample.actionNodeCount}`] : []),
      ...(sample.saveButtonCount !== 1 ? [`${sample.id}:save-button-count:${sample.saveButtonCount}`] : []),
    ]),
  ];
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'saved-objects002-electron-smoke/v1',
    renderer: `Electron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
    screenshots,
    samples,
    placementSamples,
    handSavedId: handSaved.object?.id,
    replaySavedId: replaySaved.object?.id,
    scenarioSavedId: scenarioBeforeReload.object?.id,
    scenarioReloadId: scenarioAfterReload.object?.id,
    consoleErrors,
    findings,
  }, null, 2)}\n`);
  win.destroy();
  app.exit(findings.length || consoleErrors.length ? 1 : 0);
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
