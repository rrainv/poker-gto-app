#!/usr/bin/env node
'use strict';

// HOME-001 bounded Electron renderer smoke. Artifacts are written only to the OS temp folder.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const screenshots = [];
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

async function openPlaybook(win) {
  await click(win, '[data-mode="gto"]');
  await waitFor(win, "document.querySelector('.riverline-shell')?.dataset.activeMode === 'gto'");
}

async function createSavedHand(win, {
  title = 'Cold reopen hand', note = 'Review the hidden-villain line.',
  tags = 'replay, review', review = true, mistake = true,
} = {}) {
  await openPlaybook(win);
  await click(win, '[data-playbook-mode="hand"]');
  await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'hand'");
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Ad'] });
  })()`);
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.disabled === false");
  await click(win, '#savedStudySaveButton');
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
  await annotateCurrent(win, {
    title, note, tags, review, mistake,
  });
  const status = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'hand' })",
  );
  return status.object.id;
}

async function setScenario(win, { heroCards, potBb, position }) {
  await win.webContents.executeJavaScript(`(() => {
    app.gto.hero = ${JSON.stringify(heroCards)};
    app.gto.board = ['Qc', '7d', '2s'];
    app.gto.dead = [];
    const values = {
      players: 6, playersNum: 6, stack: 100, stackNum: 100,
      heroPos: ${JSON.stringify(position)}, lastAction: 'check', facingSize: 0,
      facingSizeNum: 0, potSize: ${potBb}, potSizeNum: ${potBb}
    };
    Object.entries(values).forEach(([id, value]) => { document.querySelector('#' + id).value = String(value); });
    renderAllCards();
    return updateContext('HOME-001 Electron fixture');
  })()`);
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.disabled === false");
}

async function annotateCurrent(win, { title, note, tags, review, mistake }) {
  await click(win, '#savedStudyEditButton');
  await waitFor(win, "document.querySelector('#savedStudyModal')?.classList.contains('show')");
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('#savedStudyTitle').value = ${JSON.stringify(title)};
    document.querySelector('#savedStudyNote').value = ${JSON.stringify(note)};
    document.querySelector('#savedStudyTags').value = ${JSON.stringify(tags)};
    document.querySelector('#savedStudyReviewLater').checked = ${Boolean(review)};
    document.querySelector('#savedStudyMistake').checked = ${Boolean(mistake)};
  })()`);
  await click(win, '#savedStudySubmitButton');
  await waitFor(win, "document.querySelector('#savedStudyModal')?.hidden === true");
}

async function createSavedSpot(win, fixture) {
  if (await win.webContents.executeJavaScript("window.RiverlinePlaybookState.getMode() !== 'scenario'")) {
    await click(win, '[data-playbook-mode="scenario"]');
  }
  await waitFor(win, "window.RiverlinePlaybookState.getMode() === 'scenario'");
  await setScenario(win, fixture);
  await click(win, '#savedStudySaveButton');
  await waitFor(win, "document.querySelector('#savedStudySaveButton')?.getAttribute('aria-pressed') === 'true'");
  await annotateCurrent(win, fixture);
  const status = await win.webContents.executeJavaScript(
    "window.RiverlineSavedStudyObjects.getCurrentStatus({ mode: 'scenario', scenarioInput: window.RiverlinePlaybookState.getScenarioInput() })",
  );
  return status.object.id;
}

async function captureHome(win, id, { width, height, language, theme }) {
  win.setContentSize(width, height);
  await win.webContents.executeJavaScript(`(() => {
    document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    window.setLanguage(${JSON.stringify(language)});
    window.scrollTo(0, 0);
  })()`);
  await settle(win);
  await delay(650);
  const sample = await win.webContents.executeJavaScript(`(() => {
    const root = document.documentElement;
    const sections = [...document.querySelectorAll('#homeWorkspaceContent > .home-section')];
    const reviewLists = [...document.querySelectorAll('#homeReviewContent .home-review-list')];
    const firstQuick = document.querySelector('.home-quick-link');
    const firstQuickCopy = firstQuick?.querySelector('span');
    firstQuick?.focus({ preventScroll: true });
    return {
      id: ${JSON.stringify(id)},
      viewport: { width: innerWidth, height: innerHeight },
      language: root.lang,
      direction: root.dir,
      theme: root.dataset.theme,
      activeMode: document.querySelector('.riverline-shell')?.dataset.activeMode,
      workspaceBusy: document.querySelector('#homeWorkspace')?.getAttribute('aria-busy'),
      loadingRendered: document.querySelector('#homeLoadingState')?.getClientRects().length > 0,
      sectionCount: sections.length,
      recentCount: document.querySelectorAll('#homeRecentContent .home-saved-item').length,
      reviewLaterCount: reviewLists[0]?.querySelectorAll('.home-saved-item').length || 0,
      mistakeCount: reviewLists[1]?.querySelectorAll('.home-saved-item').length || 0,
      quickStartCount: document.querySelectorAll('.home-quick-link').length,
      disabledQuickStartCount: document.querySelectorAll('.home-quick-link:disabled').length,
      quickStartColors: firstQuick ? {
        background: getComputedStyle(firstQuick).backgroundColor,
        primary: getComputedStyle(firstQuick).color,
        secondary: getComputedStyle(firstQuickCopy).color,
        primaryToken: getComputedStyle(root).getPropertyValue('--text-primary').trim(),
        mutedToken: getComputedStyle(root).getPropertyValue('--text-muted').trim(),
      } : null,
      focusedElementClass: document.activeElement?.className || null,
      personalStrategyCopy: document.querySelector('#homeStrategyContent')?.textContent.trim() || '',
      heading: document.querySelector('#workspaceTitle')?.textContent.trim() || '',
      globalOverflowX: root.scrollWidth > root.clientWidth + 1,
      sectionOverflows: sections.filter((section) => {
        const rect = section.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      }).map((section) => section.getAttribute('aria-labelledby')),
      ltrPokerFacts: [...document.querySelectorAll('.home-saved-item-meta')]
        .every((element) => element.dir === 'ltr'),
      surfaceColor: getComputedStyle(document.querySelector('.home-section')).backgroundColor,
      replacementCharacterVisible: document.querySelector('#homeWorkspaceContent')?.innerText.includes('\uFFFD') || false,
    };
  })()`);
  samples.push(sample);
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(os.tmpdir(), `riverline-home001-${id}.png`);
  fs.writeFileSync(screenshotPath, image.toPNG());
  screenshots.push(screenshotPath);
}

async function openHomeItem(win, id) {
  await click(win, `[data-home-saved-id="${id}"]`);
  try {
    await waitFor(win, "document.querySelector('.riverline-shell')?.dataset.activeMode === 'gto'", 6_000);
  } catch (error) {
    const diagnostics = await win.webContents.executeJavaScript(`(() => ({
      activeMode: document.querySelector('.riverline-shell')?.dataset.activeMode,
      toast: document.querySelector('#toast')?.textContent,
      buttonBusy: document.querySelector(${JSON.stringify(`[data-home-saved-id="${id}"]`)})
        ?.getAttribute('aria-busy'),
      projection: window.RiverlinePlaybookState.createReplayProjectionViewModel(),
    }))()`);
    throw new Error(`${error.message}: ${JSON.stringify(diagnostics)}; console=${JSON.stringify(consoleErrors)}`);
  }
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
      partition: `riverline-home001-${Date.now()}`,
    },
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(String(message));
  });
  await win.loadFile(path.join(repoRoot, 'app', 'index.html'));
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineHome)");
  await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
  const initial = await win.webContents.executeJavaScript(`(() => ({
    activeMode: document.querySelector('.riverline-shell')?.dataset.activeMode,
    hasCanonicalHand: window.RiverlinePlaybookState.hasLiveHand(),
    decisionContext: app.decisionContext,
    strategyResult: app.strategyResult,
  }))()`);

  const handIds = [
    await createSavedHand(win),
    await createSavedHand(win, {
      title: 'Button setup hand', note: '', tags: 'button', review: false, mistake: false,
    }),
    await createSavedHand(win, {
      title: 'Deep-stack line', note: 'A second saved line.', tags: 'deep', review: false, mistake: false,
    }),
  ];
  const [handId] = handIds;
  await click(win, '[data-playbook-mode="scenario"]');
  const firstSpotId = await createSavedSpot(win, {
    heroCards: ['As', 'Kh'], potBb: 6.5, position: 'BTN', title: 'Reviewed flop spot',
    note: 'Scenario facts only.', tags: 'flop, review', review: true, mistake: false,
  });
  const secondSpotId = await createSavedSpot(win, {
    heroCards: ['Jh', 'Th'], potBb: 9.5, position: 'CO', title: 'Marked mistake spot',
    note: 'No hand history is claimed.', tags: 'mistake', review: false, mistake: true,
  });

  await click(win, '[data-mode="home"]');
  await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
  await win.reload();
  await waitFor(win, "document.readyState === 'complete' && Boolean(window.RiverlineHome)");
  await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");

  for (const [id, options] of [
    ['1024x768-en-midnight', { width: 1024, height: 768, language: 'en', theme: 'midnight' }],
    ['1366x768-en-daylight', { width: 1366, height: 768, language: 'en', theme: 'daylight' }],
    ['1440x900-he-daylight', { width: 1440, height: 900, language: 'he', theme: 'daylight' }],
    ['1920x1080-ru-graphite', { width: 1920, height: 1080, language: 'ru', theme: 'graphite' }],
    ['2560x1600-en-midnight', { width: 2560, height: 1600, language: 'en', theme: 'midnight' }],
  ]) await captureHome(win, id, options);

  const expectedSpot = await win.webContents.executeJavaScript(
    `window.RiverlineSavedStudyObjects.getById(${JSON.stringify(secondSpotId)})`,
  );
  await openHomeItem(win, secondSpotId);
  await waitFor(win, "document.querySelector('#savedSpotViewerBanner')?.hidden === false");
  const spotOpen = await win.webContents.executeJavaScript(`(() => ({
    mode: window.RiverlinePlaybookState.getMode(),
    bannerVisible: document.querySelector('#savedSpotViewerBanner')?.hidden === false,
    replayProjection: window.RiverlinePlaybookState.createReplayProjectionViewModel(),
    context: app.decisionContext,
  }))()`);

  await click(win, '[data-mode="home"]');
  await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
  await openPlaybook(win);
  await click(win, '[data-playbook-mode="hand"]');
  await win.webContents.executeJavaScript(`(() => {
    const bridge = window.RiverlinePlaybookState;
    bridge.initializeHand({
      tableSize: 2, gameMode: 'home', stackBb: 80, stackMode: 'hero',
      heroSeat: 0, buttonSeat: 1, anteType: 'none', anteBb: 0, straddleBb: 0
    });
    bridge.dealObservedHoleCards({ 'seat-0': ['Ks', 'Kd'] });
  })()`);
  const liveBefore = await win.webContents.executeJavaScript(
    'JSON.stringify(window.RiverlinePlaybookState.getState())',
  );
  await click(win, '[data-mode="home"]');
  await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
  await openHomeItem(win, handId);
  await waitFor(win, "window.RiverlinePlaybookState.createReplayProjectionViewModel()?.viewerContext?.kind === 'saved_hand'");
  const savedHandOpen = await win.webContents.executeJavaScript(`(() => {
    let projection = window.RiverlinePlaybookState.createReplayProjectionViewModel();
    const hiddenSeats = projection.tablePresence.seats.filter((seat) => seat.cardVisibility === 'hidden').length;
    window.RiverlinePlaybookState.previousReplayFrame();
    projection = window.RiverlinePlaybookState.createReplayProjectionViewModel();
    return {
      objectId: projection.viewerContext.objectId,
      hasLiveHand: projection.viewerContext.hasLiveHand,
      detachedReadOnly: projection.detachedReadOnly,
      readOnly: projection.readOnly,
      hiddenSeats,
      endpointLabelKey: projection.endpointLabelKey,
      canReturnToEndpoint: projection.canReturnToEndpoint,
      saveActionsHidden: document.querySelector('#savedStudySourceActions')?.hidden,
      setupDisabled: document.querySelector('#handSetupSection')?.getAttribute('aria-disabled'),
    };
  })()`);
  await click(win, '#savedHandReturnLiveButton');
  await waitFor(win, "!window.RiverlinePlaybookState.createReplayProjectionViewModel()?.viewerContext");
  const liveAfter = await win.webContents.executeJavaScript(
    'JSON.stringify(window.RiverlinePlaybookState.getState())',
  );

  const quickStart = {};
  for (const destination of ['gto', 'training', 'equity', 'calibration']) {
    await click(win, '[data-mode="home"]');
    await waitFor(win, "document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false'");
    await click(win, `.home-quick-link[data-home-destination="${destination}"]`);
    quickStart[destination] = await win.webContents.executeJavaScript(
      "document.querySelector('.riverline-shell')?.dataset.activeMode",
    );
  }

  const findings = [
    ...(initial.activeMode !== 'home' ? ['initial:not-home'] : []),
    ...(initial.hasCanonicalHand ? ['initial:canonical-hand-created'] : []),
    ...(initial.decisionContext !== null || initial.strategyResult !== null ? ['initial:strategy-work-created'] : []),
    ...samples.flatMap((sample) => [
      ...(sample.activeMode !== 'home' ? [`${sample.id}:not-home`] : []),
      ...(sample.workspaceBusy !== 'false' ? [`${sample.id}:still-busy`] : []),
      ...(sample.loadingRendered ? [`${sample.id}:loading-still-rendered`] : []),
      ...(sample.sectionCount !== 5 ? [`${sample.id}:section-count:${sample.sectionCount}`] : []),
      ...(sample.recentCount < 5 ? [`${sample.id}:recent-count:${sample.recentCount}`] : []),
      ...(sample.reviewLaterCount < 2 ? [`${sample.id}:review-count:${sample.reviewLaterCount}`] : []),
      ...(sample.mistakeCount < 2 ? [`${sample.id}:mistake-count:${sample.mistakeCount}`] : []),
      ...(sample.quickStartCount !== 4 ? [`${sample.id}:quick-count:${sample.quickStartCount}`] : []),
      ...(sample.disabledQuickStartCount ? [`${sample.id}:disabled-quick:${sample.disabledQuickStartCount}`] : []),
      ...(sample.globalOverflowX ? [`${sample.id}:global-overflow-x`] : []),
      ...sample.sectionOverflows.map((section) => `${sample.id}:section-overflow:${section}`),
      ...(!sample.ltrPokerFacts ? [`${sample.id}:poker-facts-not-ltr`] : []),
      ...(sample.replacementCharacterVisible ? [`${sample.id}:replacement-character`] : []),
      ...(!String(sample.focusedElementClass).includes('home-quick-link') ? [`${sample.id}:focus-failed`] : []),
    ]),
    ...(new Set(samples.map((sample) => sample.surfaceColor)).size !== 3 ? ['themes:not-distinct'] : []),
    ...(new Set(samples.map((sample) => sample.heading)).size !== 3 ? ['locales:headings-not-distinct'] : []),
    ...(spotOpen.mode !== 'scenario' || !spotOpen.bannerVisible ? ['spot:viewer-not-open'] : []),
    ...(spotOpen.replayProjection !== null ? ['spot:invented-replay'] : []),
    ...(JSON.stringify(spotOpen.context) !== JSON.stringify(expectedSpot.payload.decisionContext)
      ? ['spot:decision-context-changed'] : []),
    ...(savedHandOpen.objectId !== handId ? ['hand:wrong-object'] : []),
    ...(!savedHandOpen.hasLiveHand ? ['hand:live-hand-not-detected'] : []),
    ...(!savedHandOpen.detachedReadOnly || !savedHandOpen.readOnly ? ['hand:not-detached-read-only'] : []),
    ...(savedHandOpen.hiddenSeats !== 1 ? [`hand:hidden-seat-count:${savedHandOpen.hiddenSeats}`] : []),
    ...(savedHandOpen.endpointLabelKey !== 'replay.control.returnToSavedHand' ? ['hand:wrong-endpoint-label'] : []),
    ...(!savedHandOpen.canReturnToEndpoint ? ['hand:no-return-to-endpoint'] : []),
    ...(!savedHandOpen.saveActionsHidden ? ['hand:save-actions-visible'] : []),
    ...(savedHandOpen.setupDisabled !== 'true' ? ['hand:setup-not-disabled'] : []),
    ...(liveAfter !== liveBefore ? ['hand:live-state-changed'] : []),
    ...Object.entries(quickStart).flatMap(([destination, active]) => (
      destination === active ? [] : [`quick:${destination}->${active}`]
    )),
  ];

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'home001-electron-smoke/v1',
    renderer: `Electron ${process.versions.electron} / Chromium ${process.versions.chrome}`,
    screenshots,
    samples,
    savedObjectIds: { handIds, firstSpotId, secondSpotId },
    initial,
    spotOpen: { ...spotOpen, context: '[verified against persisted DecisionContext]' },
    savedHandOpen,
    liveHandPreserved: liveAfter === liveBefore,
    quickStart,
    consoleErrors,
    findings,
  }, null, 2)}\n`);
  win.destroy();
  app.exit(findings.length || consoleErrors.length ? 1 : 0);
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\nconsole=${JSON.stringify(consoleErrors)}\n`);
  app.exit(1);
});
