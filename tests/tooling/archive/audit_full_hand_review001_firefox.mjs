#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-full-hand-review001-'));
const firefoxPath = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const pageErrors = [];

function staticServer() {
  const types = {
    '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
    '.mjs': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
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

async function settle(page, milliseconds = 180) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (milliseconds > 0) await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigate(page, navigationId) {
  await page.click(`.mode-nav-item[data-navigation-id="${navigationId}"]`);
  await page.waitForFunction((id) => document.documentElement.dataset.layoutWorkspace === id, {}, navigationId);
  await settle(page);
}

async function configurePresentation(page, { theme, language, density = 'comfortable', layout = 'balanced' }) {
  await page.evaluate(({ nextTheme, nextLanguage, nextDensity, nextLayout }) => {
    window.RiverlinePresentationTheme.apply(nextTheme);
    window.RiverlinePresentationDensity.apply(nextDensity);
    window.RiverlinePresentationLayout.apply(nextLayout);
    window.RiverlineCardPresentation.apply({
      faceStyle: 'high-contrast',
      backStyle: 'geometric',
      rankStyle: 'full-ten',
      fourColor: true,
    });
    window.setLanguage(nextLanguage);
  }, {
    nextTheme: theme,
    nextLanguage: language,
    nextDensity: density,
    nextLayout: layout,
  });
  await page.waitForFunction(({ nextTheme, nextLanguage, nextDensity, nextLayout }) => (
    document.documentElement.dataset.presentationThemeId === nextTheme
      && document.documentElement.dataset.density === nextDensity
      && document.documentElement.dataset.layoutPreset === nextLayout
      && document.documentElement.lang === nextLanguage
  ), {}, {
    nextTheme: theme,
    nextLanguage: language,
    nextDensity: density,
    nextLayout: layout,
  });
  await settle(page);
}

async function createCanonicalHand(page, { playerCount, foldHero = false }) {
  const result = await page.evaluate(({ count, shouldFoldHero }) => {
    const bridge = window.RiverlinePlaybookState;
    const holeCards = [
      ['As', 'Kd'], ['Qs', 'Jd'], ['9s', '8d'], ['7s', '6d'], ['5s', '4d'],
      ['3s', '2d'], ['Ac', 'Kc'], ['Qc', 'Jc'], ['9c', '8c'], ['7c', '6c'],
    ];
    const boardCards = ['2h', '3h', '4h', '5h', '6h'];
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: count,
      gameMode: 'home',
      stackBb: 100,
      stackMode: 'hero',
      heroSeat: 0,
      buttonSeat: 0,
      anteType: 'none',
      anteBb: 0,
      straddleBb: 0,
    });
    const stateAfterInitialize = bridge.getState();
    const cardsByPlayer = Object.fromEntries(
      stateAfterInitialize.players.map((player, index) => [player.playerId, holeCards[index]]),
    );
    bridge.dealHoleCards(cardsByPlayer);
    const heroPlayerId = bridge.getHeroPlayerId();
    let boardIndex = 0;
    let heroFoldPending = shouldFoldHero;
    for (let guard = 0; guard < 256; guard += 1) {
      const state = bridge.getState();
      if (state?.terminal?.isTerminal) break;
      if (state?.pendingChance) {
        const countToDeal = state.pendingChance.type === 'deal_flop' ? 3 : 1;
        bridge.dealBoardCards(boardCards.slice(boardIndex, boardIndex + countToDeal));
        boardIndex += countToDeal;
        continue;
      }
      if (state?.showdown?.status === 'ready') {
        bridge.resolveShowdown();
        continue;
      }
      const legal = bridge.getLegalActions();
      if (!legal) break;
      if (heroFoldPending && state.actingPlayerId === heroPlayerId && legal.fold?.available) {
        bridge.applyAction('fold');
        heroFoldPending = false;
      } else if (legal.check?.available) bridge.applyAction('check');
      else if (legal.call?.available) bridge.applyAction('call');
      else if (legal.fold?.available) bridge.applyAction('fold');
      else break;
    }
    window.renderCanonicalHandWorkspace();
    const state = bridge.getState();
    const journal = bridge.getHeroDecisionJournal();
    return {
      terminal: state?.terminal?.isTerminal === true,
      terminalReason: state?.terminal?.reason ?? null,
      decisionCount: journal?.decisions?.length ?? 0,
      heroFolded: state?.players?.find((player) => player.playerId === heroPlayerId)?.folded === true,
    };
  }, { count: playerCount, shouldFoldHero: foldHero });
  if (!result.terminal || result.decisionCount < 1) {
    throw new Error(`Canonical fixture did not complete with a Hero decision: ${JSON.stringify(result)}`);
  }
  await page.waitForSelector('#handCompletedReviewButton:not([hidden])');
  const entry = await page.evaluate(() => {
    const button = document.querySelector('#handCompletedReviewButton');
    const bounds = button.getBoundingClientRect();
    return {
      visible: bounds.width > 0 && bounds.height > 0,
      primary: button.classList.contains('ui-button--primary'),
      text: button.textContent.trim(),
    };
  });
  await page.click('#handCompletedReviewButton');
  await page.waitForSelector('#handReviewSurface:not([hidden])');
  await settle(page);
  return { ...result, entry };
}

async function injectUnavailableReference(page) {
  const injected = await page.evaluate(async () => {
    const { createUnavailableStrategyResult } = await import('/app/src/application/strategy-result.mjs');
    const bridge = window.RiverlinePlaybookState;
    const journal = bridge.getHeroDecisionJournal();
    const unavailable = createUnavailableStrategyResult('Unsupported Firefox review fixture');
    const decisions = journal.decisions.map((decision) => ({
      ...structuredClone(decision),
      strategyResult: unavailable,
    }));
    const projector = window.RiverlineHandReview.createProjector();
    const input = {
      source: 'canonical_hand',
      handId: journal.handId,
      heroPlayerId: journal.heroPlayerId,
      decisions,
      completedHandResult: bridge.getCompletedHandResult(),
      actions: { analyze: true, saveHand: true, saveSpot: true, returnToCompleted: true },
    };
    const initial = projector.project({
      ...input,
      replayProjection: bridge.createReplayProjectionViewModel(),
    });
    bridge.selectReplayFrame(initial.selectedDecision.replayFrameTarget.frameIndex);
    const model = projector.project({
      ...input,
      selectedDecisionIndex: initial.selectedDecisionIndex,
      replayProjection: bridge.createReplayProjectionViewModel(),
    });
    window.app.handReview.source = 'canonical_hand';
    window.app.handReview.selectedDecisionIndex = model.selectedDecisionIndex;
    window.app.handReview.model = model;
    window.renderActiveHandReview();
    return {
      availability: model.selectedDecision.claimPolicy.availability,
      comparison: model.selectedDecision.comparison.state,
    };
  });
  if (injected.availability !== 'unavailable' || injected.comparison !== 'unavailable') {
    throw new Error(`Unavailable fixture was not source-gated: ${JSON.stringify(injected)}`);
  }
  await settle(page);
}

async function createTrainingCompletion(page) {
  await navigate(page, 'training');
  const result = await page.evaluate(async () => {
    const domain = await import('/shared/poker-domain/index.js');
    const bridge = window.RiverlineTraining;
    window.app.training.sessionMode = 'full_hand';
    const rulesSnapshot = domain.createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: domain.GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: domain.ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, 2);
    const start = bridge.startFullHand({
      handSeed: 99017,
      heroPosition: 'BTN',
      handConfiguration: {
        handId: 'full-hand-review001-firefox-training',
        rulesSnapshot,
        buttonSeat: 0,
        players: [
          { playerId: 'P0', seat: 0, startingStackMilliBb: 100000 },
          { playerId: 'P1', seat: 1, startingStackMilliBb: 100000 },
        ],
      },
      decisionContextOptions: { stackMode: 'hero' },
    }, { strategyProvider: window.RiverlineStrategy.createProvider() });
    let snapshot = start.snapshot;
    for (let guard = 0; guard < 128 && snapshot.status !== 'terminal'; guard += 1) {
      if (snapshot.status === 'awaiting_hero') {
        const spec = snapshot.currentDecision.legalActions;
        const type = spec.check.available ? 'check' : spec.call.available ? 'call' : 'fold';
        const answered = await bridge.answerFullHand(snapshot.currentDecision.decisionId, {
          type,
          amountToMilliBb: null,
        });
        snapshot = answered.snapshot;
      } else if (snapshot.status === 'advancing') {
        snapshot = bridge.advanceFullHandOneEvent().snapshot;
      } else break;
    }
    if (snapshot.status !== 'terminal') return { status: snapshot.status, decisionCount: 0 };
    window.renderFullHandTrainingSnapshot(snapshot);
    window.toggleFullHandTrainingReview();
    return {
      status: snapshot.status,
      decisionCount: snapshot.review?.decisions?.length ?? 0,
      reviewSource: window.app.handReview.model?.source ?? null,
    };
  });
  if (result.status !== 'terminal' || result.decisionCount < 1
    || result.reviewSource !== 'training_full_hand') {
    throw new Error(`Training fixture did not reach shared Review: ${JSON.stringify(result)}`);
  }
  await page.waitForSelector('#handReviewSurface:not([hidden])');
  await settle(page);
  return result;
}

async function exerciseKeyboardAndReplay(page) {
  const before = await page.evaluate(() => ({
    selectedIndex: window.app.handReview.model.selectedDecisionIndex,
    decisionCount: window.app.handReview.model.decisions.length,
  }));
  if (before.decisionCount < 2) throw new Error('Keyboard audit requires multiple Hero decisions');
  const targetIndex = before.selectedIndex === 0 ? 1 : 0;
  const selector = `[data-review-decision-index="${targetIndex}"]`;
  await page.focus(selector);
  await page.keyboard.press('Enter');
  await settle(page);
  const keyboard = await page.evaluate((expectedIndex) => ({
    selectedIndex: window.app.handReview.model.selectedDecisionIndex,
    focusIndex: document.activeElement?.dataset?.reviewDecisionIndex ?? null,
    synchronized: window.app.handReview.model.replay.synchronizedToSelectedDecision,
  }), targetIndex);
  const previousEnabled = await page.$eval('#handReviewPreviousEvent', (button) => !button.disabled);
  let replay = { exercised: false, movedAway: null, returned: null };
  if (previousEnabled) {
    await page.click('#handReviewPreviousEvent');
    await settle(page);
    replay.movedAway = await page.evaluate(() => !window.app.handReview.model.replay.synchronizedToSelectedDecision);
    await page.click('#handReviewSelectedFrame');
    await settle(page);
    replay.returned = await page.evaluate(() => window.app.handReview.model.replay.synchronizedToSelectedDecision);
    replay.exercised = true;
  }
  return { keyboard, replay };
}

async function inspectReview(page, label, setupFacts) {
  return page.evaluate(({ stateLabel, facts }) => {
    const visible = (element) => element && getComputedStyle(element).display !== 'none'
      && element.getClientRects().length > 0;
    const rect = (element) => {
      if (!visible(element)) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left), right: Math.round(bounds.right),
        top: Math.round(bounds.top), bottom: Math.round(bounds.bottom),
        width: Math.round(bounds.width), height: Math.round(bounds.height),
      };
    };
    const surfaceElement = document.querySelector('#handReviewSurface');
    const surface = rect(surfaceElement);
    const timeline = rect(document.querySelector(
      window.app.handReview.model.source === 'training_full_hand'
        ? '#trainingFullHandTimeline' : '#handTimelineStage',
    ));
    const decisionButtons = [...document.querySelectorAll('.hand-review-decision-button')];
    const visibleText = surfaceElement?.innerText || '';
    const normalizedClaimText = visibleText.replace(/This is not EV loss\./gi, '');
    const model = window.app.handReview.model;
    const selected = model.selectedDecision;
    const prohibitedClaims = normalizedClaimText.match(/\bwrong\b|\bGTO mistake\b|\bpunt\b|solver says|loses\s+[-+]?\d/i) || [];
    const positions = decisionButtons.map((button) => Number(button.dataset.reviewDecisionIndex));
    const outOfViewport = surfaceElement ? [...surfaceElement.querySelectorAll('button, input, select')]
      .filter(visible)
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1;
      })
      .map((element) => element.id || element.className) : [];
    return {
      label: stateLabel,
      setupFacts: facts,
      viewport: [innerWidth, innerHeight],
      theme: document.documentElement.dataset.presentationThemeId,
      density: document.documentElement.dataset.density,
      layout: document.documentElement.dataset.layoutPreset,
      language: document.documentElement.lang,
      direction: document.documentElement.dir || 'ltr',
      reviewSource: model.source,
      surface,
      reviewHeightInViewports: surface ? Number((surface.height / innerHeight).toFixed(2)) : null,
      decisionCount: model.decisions.length,
      decisionButtonCount: decisionButtons.length,
      chronologicalOrder: positions.every((value, index) => value === index),
      selectedCount: decisionButtons.filter((button) => button.classList.contains('is-selected')).length,
      selectedIndex: model.selectedDecisionIndex,
      selectedFrame: selected.replayFrameTarget.frameIndex,
      currentFrame: model.replay.currentFrameIndex,
      synchronized: model.replay.synchronizedToSelectedDecision,
      comparison: selected.comparison.state,
      comparisonSemantics: selected.comparison.semantics,
      coverage: selected.source.coverage,
      distributionCount: selected.distribution.length,
      chosenRepresented: selected.distribution.some((entry) => entry.type === selected.chosenAction.type),
      frequencyRowCount: document.querySelectorAll('#handReviewFrequencyRows .hand-review-frequency-row').length,
      chosenMarkerCount: document.querySelectorAll('#handReviewFrequencyRows .is-chosen').length,
      highestMarkerCount: document.querySelectorAll('#handReviewFrequencyRows .is-highest').length,
      unavailableContinuity: selected.comparison.state !== 'unavailable' || Boolean(
        document.querySelector('#handReviewChosenAction')?.textContent.trim()
        && document.querySelector('#handReviewDecisionContext')?.textContent.trim()
        && document.querySelector('#handReviewReplayPoint')?.textContent.trim(),
      ),
      provenanceAvailable: Boolean(document.querySelector('.hand-review-provenance summary')?.textContent.trim()
        && document.querySelector('#handReviewSourceDetail')?.textContent.trim()
        && document.querySelector('#handReviewCoverage')?.textContent.trim()),
      analyzeVisible: visible(document.querySelector('#handReviewAnalyze')),
      saveSpotVisible: visible(document.querySelector('#handReviewSaveSpot')),
      saveHandVisible: visible(document.querySelector('#handReviewSaveHand')),
      repeatVisible: visible(document.querySelector('#handReviewRepeat')),
      nextVisible: visible(document.querySelector('#handReviewNext')),
      selectedDecisionObvious: Boolean(document.querySelector('.hand-review-decision-button.is-selected[aria-current="true"]')),
      timelineVisible: visible(document.querySelector(
        model.source === 'training_full_hand' ? '#trainingFullHandTimeline' : '#handTimelineStage',
      )),
      timelineOverlapsSurface: Boolean(timeline && surface
        && Math.min(timeline.bottom, surface.bottom) - Math.max(timeline.top, surface.top) > 1),
      documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      outOfViewport,
      prohibitedClaims,
      rtlPokerGeometry: document.documentElement.lang !== 'he'
        || getComputedStyle(document.querySelector('#visual-table-container')).direction === 'ltr',
      actionDepthInViewports: surface ? Number((
        document.querySelector('.hand-review-actions').getBoundingClientRect().bottom - surface.top
      ) / innerHeight).toFixed(2) : null,
    };
  }, { stateLabel: label, facts: setupFacts });
}

async function capture(page, state, spec, setupFacts) {
  await page.setViewport({ width: spec.viewport[0], height: spec.viewport[1], deviceScaleFactor: 1 });
  await configurePresentation(page, spec);
  if (state === 'F') await injectUnavailableReference(page);
  await page.$eval('#handReviewSurface', (element) => element.scrollIntoView({ block: 'start' }));
  await settle(page);
  const finding = await inspectReview(page, `${state}: ${spec.id}`, setupFacts);
  const screenshot = path.join(artifactRoot, `${state.toLowerCase()}-${spec.id}.png`);
  await page.screenshot({ path: screenshot, type: 'png' });
  return { ...finding, screenshot };
}

const server = staticServer();
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
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.app)
    && Boolean(window.RiverlinePlaybookState)
    && Boolean(window.RiverlineHandReview));
  await navigate(page, 'hand');

  const viewports = {
    v1080: [1920, 1080],
    v1440: [2560, 1440],
    v1600: [2560, 1600],
  };
  const findings = [];
  const captureSpecs = {
    A: [
      { id: '1920x1080-midnight', viewport: viewports.v1080, theme: 'midnight', language: 'en', density: 'comfortable' },
      { id: '2560x1440-daylight', viewport: viewports.v1440, theme: 'daylight', language: 'en', density: 'compact' },
      { id: '2560x1600-midnight', viewport: viewports.v1600, theme: 'midnight', language: 'en', density: 'comfortable' },
    ],
    B: [
      { id: '1920x1080-daylight', viewport: viewports.v1080, theme: 'daylight', language: 'en', density: 'comfortable' },
      { id: '2560x1440-midnight', viewport: viewports.v1440, theme: 'midnight', language: 'en', density: 'compact' },
    ],
    C: [{ id: '1920x1080-midnight', viewport: viewports.v1080, theme: 'midnight', language: 'en', density: 'compact' }],
    D: [{ id: '2560x1600-daylight', viewport: viewports.v1600, theme: 'daylight', language: 'en', density: 'comfortable' }],
    E: [
      { id: '1920x1080-daylight', viewport: viewports.v1080, theme: 'daylight', language: 'en', density: 'comfortable' },
      { id: '2560x1440-midnight', viewport: viewports.v1440, theme: 'midnight', language: 'en', density: 'compact' },
    ],
    F: [
      { id: '1920x1080-midnight', viewport: viewports.v1080, theme: 'midnight', language: 'en', density: 'comfortable' },
      { id: '2560x1600-daylight', viewport: viewports.v1600, theme: 'daylight', language: 'en', density: 'compact' },
    ],
    G: [
      { id: '1920x1080-daylight', viewport: viewports.v1080, theme: 'daylight', language: 'en', density: 'comfortable' },
      { id: '2560x1440-midnight', viewport: viewports.v1440, theme: 'midnight', language: 'en', density: 'compact' },
    ],
    H: [
      { id: '1920x1080-midnight-he', viewport: viewports.v1080, theme: 'midnight', language: 'he', density: 'comfortable' },
      { id: '2560x1440-daylight-he', viewport: viewports.v1440, theme: 'daylight', language: 'he', density: 'compact' },
      { id: '2560x1600-midnight-he', viewport: viewports.v1600, theme: 'midnight', language: 'he', density: 'comfortable' },
    ],
  };

  const stateSetups = [
    ['A', async () => createCanonicalHand(page, { playerCount: 6 })],
    ['B', async () => createCanonicalHand(page, { playerCount: 2 })],
    ['C', async () => createCanonicalHand(page, { playerCount: 2, foldHero: true })],
    ['D', async () => createCanonicalHand(page, { playerCount: 2 })],
    ['E', async () => createCanonicalHand(page, { playerCount: 6 })],
    ['F', async () => {
      const facts = await createCanonicalHand(page, { playerCount: 6 });
      await injectUnavailableReference(page);
      return facts;
    }],
    ['G', async () => createTrainingCompletion(page)],
    ['H', async () => {
      await navigate(page, 'hand');
      return createCanonicalHand(page, { playerCount: 6 });
    }],
  ];

  let interactionAudit = null;
  for (const [state, setup] of stateSetups) {
    if (state !== 'G' && state !== 'H') await navigate(page, 'hand');
    const setupFacts = await setup();
    if (state === 'A') interactionAudit = await exerciseKeyboardAndReplay(page);
    for (const spec of captureSpecs[state]) {
      findings.push(await capture(page, state, spec, setupFacts));
    }
  }

  const failures = [];
  findings.forEach((finding) => {
    if (!finding.surface) failures.push(`${finding.label}: Review surface missing`);
    if (finding.decisionCount !== finding.decisionButtonCount || finding.decisionCount < 1) {
      failures.push(`${finding.label}: decision navigation does not match model`);
    }
    if (!finding.chronologicalOrder || finding.selectedCount !== 1 || !finding.selectedDecisionObvious) {
      failures.push(`${finding.label}: chronological/current decision semantics failed`);
    }
    if (!finding.synchronized || finding.selectedFrame !== finding.currentFrame) {
      failures.push(`${finding.label}: table/Replay is not on the selected pre-action frame`);
    }
    if (finding.distributionCount !== finding.frequencyRowCount) {
      failures.push(`${finding.label}: mixed distribution rows do not match StrategyResult`);
    }
    if (finding.distributionCount > 0 && (finding.highestMarkerCount < 1
      || (finding.chosenRepresented && finding.chosenMarkerCount !== 1))) {
      failures.push(`${finding.label}: chosen/highest frequency markers are unclear`);
    }
    if (!finding.unavailableContinuity || !finding.provenanceAvailable) {
      failures.push(`${finding.label}: canonical continuity or provenance is missing`);
    }
    if (!finding.analyzeVisible || !finding.saveSpotVisible) {
      failures.push(`${finding.label}: Analyze/Save Spot actions are not visible`);
    }
    if (finding.reviewSource === 'canonical_hand' && !finding.saveHandVisible) {
      failures.push(`${finding.label}: canonical Save Hand is not visible`);
    }
    if (finding.reviewSource === 'training_full_hand' && (!finding.repeatVisible || !finding.nextVisible)) {
      failures.push(`${finding.label}: Training Repeat/Next actions are not visible`);
    }
    if (finding.documentOverflowX > 1 || finding.outOfViewport.length > 0) {
      failures.push(`${finding.label}: horizontal overflow (${finding.documentOverflowX}px; ${finding.outOfViewport.join(', ')})`);
    }
    if (finding.timelineOverlapsSurface || !finding.timelineVisible) {
      failures.push(`${finding.label}: timeline is missing or competes with Review`);
    }
    if (finding.reviewHeightInViewports > 3 || finding.actionDepthInViewports > 2.75) {
      failures.push(`${finding.label}: Review has unreasonable vertical depth`);
    }
    if (finding.prohibitedClaims.length > 0) failures.push(`${finding.label}: prohibited claim ${finding.prohibitedClaims[0]}`);
    if (!finding.rtlPokerGeometry) failures.push(`${finding.label}: Hebrew mirrored poker geometry`);
  });

  const byState = Object.groupBy(findings, (finding) => finding.label.slice(0, 1));
  if ((byState.A?.[0]?.setupFacts.decisionCount ?? 0) < 2) failures.push('A: expected multiple 6-max Hero decisions');
  if (byState.B?.some((finding) => finding.setupFacts.decisionCount < 1)) failures.push('B: HU review missing');
  if (byState.C?.some((finding) => !finding.setupFacts.heroFolded)) failures.push('C: Hero did not fold preflop');
  if (byState.D?.some((finding) => finding.setupFacts.terminalReason !== 'showdown')) failures.push('D: showdown missing');
  if (byState.E?.some((finding) => finding.coverage !== 'generalized')) failures.push('E: generalized coverage missing');
  if (byState.F?.some((finding) => finding.comparison !== 'unavailable' || finding.distributionCount !== 0)) {
    failures.push('F: unavailable reference did not remain useful and frequency-free');
  }
  if (byState.G?.some((finding) => finding.reviewSource !== 'training_full_hand')) failures.push('G: Training did not use shared Review');
  if (byState.H?.some((finding) => finding.language !== 'he' || finding.direction !== 'rtl')) failures.push('H: Hebrew RTL missing');
  if (interactionAudit?.keyboard.selectedIndex !== Number(interactionAudit?.keyboard.focusIndex)
    || interactionAudit?.keyboard.synchronized !== true) failures.push('Keyboard selection did not preserve focus/synchronization');
  if (interactionAudit?.replay.exercised
    && (!interactionAudit.replay.movedAway || !interactionAudit.replay.returned)) {
    failures.push('Replay around decision did not move away and return exactly');
  }
  failures.push(...pageErrors.map((error) => `page error: ${error}`));

  const captureSummary = findings.map((finding) => ({
    label: finding.label,
    viewport: finding.viewport,
    theme: finding.theme,
    language: finding.language,
    reviewSource: finding.reviewSource,
    decisionCount: finding.decisionCount,
    comparison: finding.comparison,
    coverage: finding.coverage,
    synchronized: finding.synchronized,
    timelineVisible: finding.timelineVisible,
    reviewHeightInViewports: finding.reviewHeightInViewports,
    actionDepthInViewports: finding.actionDepthInViewports,
    screenshot: finding.screenshot,
  }));

  process.stdout.write(`${JSON.stringify({
    browser: 'Firefox',
    firefoxPath,
    artifactRoot,
    stateCount: Object.keys(byState).length,
    captureCount: findings.length,
    interactionAudit,
    captures: captureSummary,
    failures,
  }, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
