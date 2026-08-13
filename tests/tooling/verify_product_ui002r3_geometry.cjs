/*
 * From the repository root in PowerShell:
 *   Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
 *   .\node_modules\.bin\electron.cmd .\tests\tooling\verify_product_ui002r3_geometry.cjs
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('headless');

const sizes = [[1024, 768], [1280, 900], [1440, 900], [1600, 900], [1920, 1080], [2560, 1440], [2560, 1600], [3840, 2160]];
const appRoot = path.join(__dirname, '..', '..', 'app');
const windows = new Set();
let baseUrl = '';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertGeometry(condition, message) {
  if (!condition) throw new Error(`Geometry assertion failed: ${message}`);
}

async function inspect(width, height) {
  const viewportScale = Math.min(1, 1600 / width, 900 / height);
  const win = new BrowserWindow({
    width: Math.round(width * viewportScale),
    height: Math.round(height * viewportScale),
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
  windows.add(win);

  const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8')
    .replace('<head>', `<head><base href="${baseUrl}/">`);
  await win.loadURL('data:text/html,<html><body></body></html>').catch(() => {});
  win.webContents.setZoomFactor(1);
  win.webContents.debugger.attach('1.3');
  if (viewportScale < 1) {
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  await win.webContents.executeJavaScript(`document.open(); document.write(${JSON.stringify(html)}); document.close();`);
  await delay(1200);
  await win.webContents.executeJavaScript(`document.querySelector('#settingsModal').classList.add('show')`);
  await delay(350);

  const result = await win.webContents.executeJavaScript(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        display: style.display,
        position: style.position,
        zIndex: style.zIndex,
      };
    };
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
      sourceBadge: rect('#sourceBadge'),
      recommendTop: rect('.recommend-top'),
      frequency: rect('.frequency-visualization'),
      betting: rect('#sharedControls'),
      bettingHeading: rect('.playbook-inline-heading'),
      heroPos: rect('#heroPos'),
      lastAction: rect('#lastAction'),
      facingField: rect('#facingSize'),
      potField: rect('#potSize'),
      openCharts: rect('#openCharts'),
      openChartsParent: document.querySelector('#openCharts')?.parentElement?.className || null,
      settingsBackdrop: rect('#settingsModal'),
      settingsModal: rect('#settingsModal .settings-modal'),
      modeRail: rect('#modeRail'),
      toast: rect('#toast'),
    };
  })()`);

  await win.webContents.executeJavaScript(`document.querySelector('#settingsModal').classList.remove('show'); document.querySelector('#cardModal').classList.add('show')`);
  await delay(350);
  result.cardBackdrop = await win.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('#cardModal');
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, zIndex: getComputedStyle(element).zIndex };
  })()`);
  await win.webContents.executeJavaScript(`
    document.querySelector('#cardModal').classList.remove('show');
    document.querySelector('#gtoMode').style.display = 'none';
    document.querySelector('#trainingMode').style.display = 'block';
  `);
  await delay(100);
  result.trainingBadges = await win.webContents.executeJavaScript(`(() => {
    const rect = (element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height, whiteSpace: getComputedStyle(element).whiteSpace };
    };
    const cluster = document.querySelector('.training-state-cluster');
    return { cluster: rect(cluster), badges: [...cluster.querySelectorAll('.badge')].map(rect) };
  })()`);
  result.ui005 = await win.webContents.executeJavaScript(`(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), left: Math.round(bounds.left), right: Math.round(bounds.right), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    };
    const overflow = () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const showPlaybook = (view) => {
      document.querySelectorAll('.mode-view').forEach((mode) => { mode.style.display = 'none'; });
      document.querySelector('#gtoMode').style.display = 'block';
      document.querySelector('#contextView').style.display = view === 'context' ? 'block' : 'none';
      document.querySelector('#chartView').style.display = view === 'chart' ? 'block' : 'none';
      document.querySelector('#rangeView').style.display = view === 'range' ? 'block' : 'none';
    };
    const playbookMeasure = () => ({
      height: document.querySelector('#gtoMode').scrollHeight,
      workspaceHeight: rect('.playbook-workspace')?.height,
      navigationTop: rect('#playbookAnalysisTabs')?.top,
      tableTop: rect('#table-wrapper')?.top,
      overflow: overflow(),
    });
    showPlaybook('context');
    const playbookDecision = playbookMeasure();

    showPlaybook('chart');
    const grid = document.querySelector('#strategyGrid');
    const matrixSamples = [
      { primary: 'aggressive', mix: 'pure', cue: 'Raise 100%', segments: [['aggressive', 100]] },
      { primary: 'fold', mix: 'pure', cue: 'Fold 100%', segments: [['fold', 100]] },
      { primary: 'aggressive', mix: 'mixed', cue: 'Raise 65% · Call 35%', segments: [['aggressive', 65], ['passive', 35]] },
      { primary: 'passive', mix: 'mixed', cue: 'Call 55% · Fold 45%', segments: [['passive', 55], ['fold', 45]] },
    ];
    grid.innerHTML = Array.from({ length: 169 }, (_, index) => {
      const sample = matrixSamples[index % matrixSamples.length];
      const hand = 'A' + (index % 13 + 2) + (index % 3 ? 's' : 'o');
      const band = sample.segments.map(([kind, value]) => '<i data-action-kind="' + kind + '" style="width:' + value + '%"></i>').join('');
      return '<button class="hand-cell hand-suited matrix-' + sample.mix + '" data-hand="' + hand + '" data-primary-action="' + sample.primary + '" data-mix-state="' + sample.mix + '" data-strategy-cue="' + sample.cue + '" data-state="available" aria-describedby="matrixCellCue"><span class="matrix-hand-label">' + hand + '</span><span class="matrix-mix-bar">' + band + '</span></button>';
    }).join('');
    const matrixLayout = document.querySelector('.range-matrix-layout');
    const matrixEmpty = document.querySelector('#postflopMatrixEmpty');
    if (matrixLayout) matrixLayout.hidden = false;
    if (matrixEmpty) matrixEmpty.hidden = true;
    const sampleCells = [...grid.children].slice(0, 4);
    const cellSurfaces = sampleCells.map((cell) => getComputedStyle(cell).backgroundColor);
    const mixBandHeights = sampleCells.map((cell) => Math.round(cell.querySelector('.matrix-mix-bar').getBoundingClientRect().height));
    const presentCue = (cell, input = 'keyboard') => {
      const cue = document.querySelector('#matrixCellCue');
      cue.querySelector('strong').textContent = cell.dataset.hand;
      cue.querySelector('span').textContent = cell.dataset.strategyCue;
      cue.style.removeProperty('left');
      cue.style.removeProperty('top');
      cue.dataset.input = input;
      if (input === 'pointer') {
        cue.style.setProperty('--matrix-cue-x', (innerWidth - 1) + 'px');
        cue.style.setProperty('--matrix-cue-y', (innerHeight - 1) + 'px');
      } else {
        cue.style.removeProperty('--matrix-cue-x');
        cue.style.removeProperty('--matrix-cue-y');
      }
      cue.hidden = false;
    };
    presentCue(sampleCells[0]);
    const firstCue = { rect: rect('#matrixCellCue'), text: document.querySelector('#matrixCellCue')?.textContent.trim() || '', hidden: document.querySelector('#matrixCellCue')?.hidden };
    presentCue(grid.lastElementChild, 'pointer');
    const edgeCue = { rect: rect('#matrixCellCue'), text: document.querySelector('#matrixCellCue')?.textContent.trim() || '', hidden: document.querySelector('#matrixCellCue')?.hidden };
    document.querySelector('#matrixCellCue').hidden = true;
    const preflopMatrix = { ...playbookMeasure(), panelHeight: rect('.range-matrix-panel')?.height, grid: rect('#strategyGrid'), cells: grid.children.length, pureCells: grid.querySelectorAll('[data-mix-state="pure"]').length, mixedCells: grid.querySelectorAll('[data-mix-state="mixed"]').length, cellSurfaces, mixBandHeights, firstCue, edgeCue };

    if (matrixEmpty) {
      grid.replaceChildren();
      matrixLayout.hidden = true;
      matrixEmpty.hidden = false;
    } else {
      grid.querySelectorAll('.hand-cell').forEach((cell) => { cell.dataset.state = 'unavailable'; });
    }
    const postflopMatrix = { ...playbookMeasure(), panelHeight: rect('.range-matrix-panel')?.height, cells: grid.children.length, unavailableCells: grid.querySelectorAll('[data-state="unavailable"]').length, emptyStateHeight: rect('#postflopMatrixEmpty')?.height || null };

    showPlaybook('range');
    document.querySelector('#rangeAdvantageAnalysis').hidden = false;
    for (const id of ['heroRangeGrid', 'villainRangeGrid']) document.querySelector('#' + id).innerHTML = Array.from({ length: 169 }, (_, index) => '<button class="hand-cell range-cell">' + (index % 13 + 2) + '</button>').join('');
    const rangeComparison = { ...playbookMeasure(), panelHeight: rect('#rangeView .panel')?.height, scrollerWidth: rect('.range-comparison-scroll')?.width || null, scrollerContentWidth: document.querySelector('.range-comparison-scroll')?.scrollWidth || null, heroTop: rect('#heroRangeGrid')?.top, villainTop: rect('#villainRangeGrid')?.top };

    document.querySelectorAll('.mode-view').forEach((mode) => { mode.style.display = 'none'; });
    document.querySelector('#trainingMode').style.display = 'block';
    document.querySelector('#trainingIdle').hidden = true;
    document.querySelector('#trainingExerciseSurface').hidden = false;
    document.querySelector('#trainingExerciseTags').innerHTML = '<span class="training-curriculum-tag badge">Preflop</span><span class="training-curriculum-tag badge">Unopened</span>';
    document.querySelector('#trainingHeroCards').innerHTML = '<span class="training-readonly-card riverline-card"><span class="rank">A</span><span class="suit">♠</span></span><span class="training-readonly-card riverline-card"><span class="rank">K</span><span class="suit">♥</span></span>';
    document.querySelector('#trainingBoardCards').innerHTML = '<span class="training-no-board">No board cards</span>';
    document.querySelector('.training-table-summary').dataset.boardState = 'empty';
    document.querySelector('#trainingStudyHints').hidden = false;
    document.querySelector('#trainingGuessButtons').innerHTML = '<button class="training-action-button training-action-button--fold"><span class="training-action-copy"><strong>Fold</strong><small>Return the hand</small></span><kbd>1</kbd></button><button class="training-action-button training-action-button--call"><span class="training-action-copy"><strong>Call</strong><small>Match 2.5 bb</small></span><kbd>2</kbd></button><button class="training-action-button training-action-button--raise"><span class="training-action-copy"><strong>Raise</strong><small>5.5–30 bb</small></span><kbd>3</kbd></button>';
    document.querySelector('#trainingFeedback').hidden = true;
    document.querySelector('#trainingSolution').hidden = true;
    const trainingMeasure = () => {
      const mode = document.querySelector('#trainingMode');
      const workspace = rect('.training-workspace');
      return {
        height: mode.scrollHeight,
        clientHeight: mode.clientHeight,
        workspaceHeight: workspace?.height,
        workspaceTop: workspace?.top,
        workspaceBottom: workspace?.bottom,
        viewportBottomGap: workspace ? Math.round(innerHeight - workspace.bottom) : null,
        hasVerticalOverflow: mode.scrollHeight > mode.clientHeight + 1,
        decisionHeight: rect('.training-decision-panel')?.height,
        boardHeight: rect('.training-table-summary')?.height,
        studyHintsHeight: rect('#trainingStudyHints')?.height,
        insightHeight: rect('.training-insight-column')?.height,
        setupHeight: rect('.training-setup-column')?.height,
        actionsBottom: rect('#trainingGuessButtons')?.bottom,
        completionBottom: rect('.training-completion-actions')?.bottom,
        overflow: overflow(),
      };
    };
    const trainingPreAnswer = trainingMeasure();

    document.querySelector('#trainingFeedback').hidden = false;
    document.querySelector('#trainingSolution').hidden = false;
    document.querySelector('#trainingFrequencyRows').innerHTML = '<div class="training-frequency-row is-best"><span class="training-frequency-name">Raise</span><span class="training-frequency-track"><i style="width:72%"></i></span><strong>72%</strong></div><div class="training-frequency-row"><span class="training-frequency-name">Fold</span><span class="training-frequency-track"><i style="width:28%"></i></span><strong>28%</strong></div>';
    document.querySelector('#trainingAnalysis').hidden = false;
    document.querySelector('#trainingAnalysis').innerHTML = '<div class="analysis-summary"><strong>Hero state</strong><p>Representative post-answer analysis remains available.</p></div>';
    const trainingPostAnswer = { ...trainingMeasure(), feedbackHeight: rect('#trainingFeedback')?.height, referenceTop: rect('#trainingSolution')?.top };
    return { playbookDecision, preflopMatrix, postflopMatrix, rangeComparison, trainingPreAnswer, trainingPostAnswer };
  })()`);
  result.zoomFactor = win.webContents.getZoomFactor();

  if (process.argv.includes('--ui005-captures')) {
    const captureDirectory = path.join(app.getPath('temp'), 'riverline-ui005r');
    fs.mkdirSync(captureDirectory, { recursive: true });
    const capture = async (name) => {
      const screenshot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const capturePath = path.join(captureDirectory, name);
      fs.writeFileSync(capturePath, Buffer.from(screenshot.data, 'base64'));
      return capturePath;
    };
    const capturePaths = {};

    if (width === 1920 && height === 1080) {
      await win.webContents.executeJavaScript('window.scrollTo(0, 0); true');
      await delay(400);
      capturePaths.trainingPostAnswer = await capture('training-post-answer-1920x1080.png');
      await win.webContents.executeJavaScript(`
        document.querySelector('#trainingFeedback').hidden = true;
        document.querySelector('#trainingSolution').hidden = true;
        document.querySelector('#trainingAnalysis').hidden = true;
        window.scrollTo(0, 0);
      `);
      await delay(400);
      capturePaths.trainingPreAnswer = await capture('training-pre-answer-1920x1080.png');
    }

    if ([1024, 1280, 1440, 1920].includes(width)) {
      await win.webContents.executeJavaScript(`(() => {
        document.querySelectorAll('.mode-view').forEach((mode) => { mode.style.display = 'none'; });
        document.querySelector('#gtoMode').style.display = 'block';
        document.querySelector('#contextView').style.display = 'none';
        document.querySelector('#rangeView').style.display = 'none';
        document.querySelector('#chartView').style.display = 'block';
        document.querySelector('.range-matrix-layout').hidden = false;
        document.querySelector('#postflopMatrixEmpty').hidden = true;
        const samples = [
          { primary: 'aggressive', mix: 'pure', segments: [['aggressive', 100]] },
          { primary: 'fold', mix: 'pure', segments: [['fold', 100]] },
          { primary: 'aggressive', mix: 'mixed', segments: [['aggressive', 65], ['passive', 35]] },
          { primary: 'passive', mix: 'mixed', segments: [['passive', 55], ['fold', 45]] },
        ];
        document.querySelector('#strategyGrid').innerHTML = Array.from({ length: 169 }, (_, index) => {
          const sample = samples[index % samples.length];
          const hand = 'A' + (index % 13 + 2) + (index % 3 ? 's' : 'o');
          const band = sample.segments.map(([kind, value]) => '<i data-action-kind="' + kind + '" style="width:' + value + '%"></i>').join('');
          return '<button class="hand-cell hand-suited matrix-' + sample.mix + '" data-primary-action="' + sample.primary + '" data-mix-state="' + sample.mix + '" data-state="available"><span class="matrix-hand-label">' + hand + '</span><span class="matrix-mix-bar">' + band + '</span></button>';
        }).join('');
        document.querySelector('#matrixCellCue').hidden = true;
        document.querySelector('.range-matrix-panel').scrollIntoView({ block: 'start' });
      })()`);
      await delay(400);
      capturePaths.matrix = await capture(`matrix-${width}x${height}.png`);
    }
    result.ui005.capturePaths = capturePaths;
  }
  return result;
}

function verify(output) {
  const compact = output['1024x768'];

  for (const [label, result] of Object.entries(output)) {
    assertGeometry(result.viewport.width === Number(label.split('x')[0]), `${label} viewport width`);
    assertGeometry(result.viewport.height === Number(label.split('x')[1]), `${label} viewport height`);
    assertGeometry(result.openChartsParent === 'playbook-inline-heading', `${label} View all hands parent`);
    assertGeometry(Number(result.settingsBackdrop.zIndex) > Number(result.modeRail.zIndex), `${label} modal above mode rail`);
    assertGeometry(Number(result.settingsBackdrop.zIndex) > Number(result.toast.zIndex), `${label} modal above toast`);
    assertGeometry(result.settingsBackdrop.left === 0 && result.settingsBackdrop.top === 0, `${label} backdrop origin`);
    assertGeometry(result.settingsBackdrop.right === result.viewport.clientWidth, `${label} backdrop viewport width`);
    assertGeometry(result.settingsBackdrop.bottom === result.viewport.clientHeight, `${label} backdrop viewport height`);
    assertGeometry(result.cardBackdrop.zIndex === result.settingsBackdrop.zIndex, `${label} card picker backdrop layer`);
    assertGeometry(result.cardBackdrop.width === result.settingsBackdrop.width && result.cardBackdrop.height === result.settingsBackdrop.height, `${label} card picker viewport coverage`);
    const [firstTrainingBadge, secondTrainingBadge] = result.trainingBadges.badges;
    assertGeometry(firstTrainingBadge.whiteSpace === 'nowrap' && secondTrainingBadge.whiteSpace === 'nowrap', `${label} Training badges remain one line`);
    assertGeometry(firstTrainingBadge.left >= result.trainingBadges.cluster.left && secondTrainingBadge.right <= result.trainingBadges.cluster.right, `${label} Training badges stay inside their cluster`);
    const trainingBadgesOverlap = !(
      firstTrainingBadge.right <= secondTrainingBadge.left
      || secondTrainingBadge.right <= firstTrainingBadge.left
      || firstTrainingBadge.bottom <= secondTrainingBadge.top
      || secondTrainingBadge.bottom <= firstTrainingBadge.top
    );
    assertGeometry(!trainingBadgesOverlap, `${label} Training badges do not collide`);

    const horizontalGapStart = result.settingsModal.left;
    const horizontalGapEnd = result.viewport.clientWidth - result.settingsModal.right;
    const verticalGapStart = result.settingsModal.top;
    const verticalGapEnd = result.viewport.clientHeight - result.settingsModal.bottom;
    assertGeometry(Math.min(horizontalGapStart, horizontalGapEnd, verticalGapStart, verticalGapEnd) >= 16, `${label} modal safe edge gap`);
    assertGeometry(Math.abs(horizontalGapStart - horizontalGapEnd) <= 1, `${label} modal horizontal centering`);
    assertGeometry(Math.abs(verticalGapStart - verticalGapEnd) <= 1, `${label} modal vertical centering`);

    if (result.viewport.width >= 1280) {
      assertGeometry(result.betting.height >= 95 && result.betting.height <= 115, `${label} Betting Context target height`);
      assertGeometry(result.sourceBadge.right <= result.frequency.left - 12, `${label} source badge/frequency gap`);
      assertGeometry(result.heroPos.left < result.lastAction.left && result.lastAction.left < result.facingField.left && result.facingField.left < result.potField.left, `${label} four-part value row`);
    }

    const ui005 = result.ui005;
    for (const [surface, geometry] of Object.entries(ui005)) {
      assertGeometry(!geometry.overflow, `${label} ${surface} has no global horizontal overflow`);
    }
    assertGeometry(ui005.playbookDecision.navigationTop < ui005.playbookDecision.tableTop, `${label} Decision navigation precedes table`);
    assertGeometry(ui005.preflopMatrix.navigationTop < ui005.preflopMatrix.tableTop, `${label} Matrix is reachable before table`);
    assertGeometry(ui005.preflopMatrix.cells === 169, `${label} preflop Matrix retains 169 cells`);
    assertGeometry(ui005.preflopMatrix.pureCells > 0 && ui005.preflopMatrix.mixedCells > 0, `${label} Matrix distinguishes pure and mixed cells`);
    assertGeometry(new Set(ui005.preflopMatrix.cellSurfaces).size >= 3, `${label} Matrix dominant actions have distinct surfaces`);
    assertGeometry(ui005.preflopMatrix.mixBandHeights.every((height) => height >= 8), `${label} Matrix full-mix bands remain readable`);
    for (const cue of [ui005.preflopMatrix.firstCue, ui005.preflopMatrix.edgeCue]) {
      assertGeometry(!cue.hidden && cue.text.length > 0, `${label} Matrix quick cue is populated`);
      assertGeometry(cue.rect.left >= 8 && cue.rect.right <= result.viewport.width - 8, `${label} Matrix quick cue stays inside horizontal viewport edges`);
      assertGeometry(cue.rect.top >= 8 && cue.rect.bottom <= result.viewport.height - 8, `${label} Matrix quick cue stays inside vertical viewport edges`);
    }
    assertGeometry(ui005.postflopMatrix.cells === 0 && ui005.postflopMatrix.unavailableCells === 0, `${label} postflop Matrix unmounts unavailable cells`);
    assertGeometry(ui005.postflopMatrix.emptyStateHeight > 0 && ui005.postflopMatrix.emptyStateHeight <= 190, `${label} compact postflop Matrix empty state`);
    assertGeometry(ui005.rangeComparison.heroTop === ui005.rangeComparison.villainTop, `${label} comparison matrices share one vertical origin`);
    assertGeometry(ui005.rangeComparison.scrollerWidth > 0 && ui005.rangeComparison.scrollerContentWidth > 0, `${label} comparison uses a bounded internal scroller`);
    assertGeometry(ui005.trainingPreAnswer.boardHeight <= 160, `${label} empty Training board is compact`);
  }

  assertGeometry(compact.sourceBadge.bottom <= compact.frequency.top - 6, '1024 source badge/frequency separation');
  assertGeometry(compact.heroPos.left < compact.lastAction.left, '1024 context first row');
  assertGeometry(compact.facingField.left < compact.potField.left && compact.facingField.top > compact.heroPos.bottom, '1024 context second row');
  assertGeometry(compact.ui005.rangeComparison.scrollerContentWidth > compact.ui005.rangeComparison.scrollerWidth, '1024 comparison scrolls internally');
  assertGeometry(output['1920x1080'].zoomFactor === 1, '1920x1080 renderer uses 100% zoom');
  assertGeometry(output['1920x1080'].ui005.trainingPreAnswer.viewportBottomGap >= 16, '1920x1080 Training pre-answer fits with a safe bottom gap');
}

function verifyUi005(output) {
  for (const [label, result] of Object.entries(output)) {
    const ui005 = result.ui005;
    for (const [surface, geometry] of Object.entries(ui005)) {
      if (typeof geometry === 'object' && geometry && 'overflow' in geometry) {
        assertGeometry(!geometry.overflow, `${label} ${surface} has no global horizontal overflow`);
      }
    }
    assertGeometry(ui005.playbookDecision.navigationTop < ui005.playbookDecision.tableTop, `${label} Decision navigation precedes table`);
    assertGeometry(ui005.preflopMatrix.cells === 169, `${label} preflop Matrix retains 169 cells`);
    assertGeometry(ui005.preflopMatrix.pureCells > 0 && ui005.preflopMatrix.mixedCells > 0, `${label} Matrix distinguishes pure and mixed cells`);
    assertGeometry(new Set(ui005.preflopMatrix.cellSurfaces).size >= 3, `${label} Matrix dominant actions have distinct surfaces`);
    assertGeometry(ui005.preflopMatrix.mixBandHeights.every((height) => height >= 8), `${label} Matrix full-mix bands remain readable`);
    for (const cue of [ui005.preflopMatrix.firstCue, ui005.preflopMatrix.edgeCue]) {
      assertGeometry(!cue.hidden && cue.text.length > 0, `${label} Matrix quick cue is populated`);
      assertGeometry(cue.rect.left >= 8 && cue.rect.right <= result.viewport.width - 8, `${label} Matrix quick cue stays inside horizontal viewport edges`);
      assertGeometry(cue.rect.top >= 8 && cue.rect.bottom <= result.viewport.height - 8, `${label} Matrix quick cue stays inside vertical viewport edges`);
    }
    assertGeometry(ui005.postflopMatrix.cells === 0 && ui005.postflopMatrix.unavailableCells === 0, `${label} postflop Matrix unmounts unavailable cells`);
    assertGeometry(ui005.postflopMatrix.emptyStateHeight > 0 && ui005.postflopMatrix.emptyStateHeight <= 190, `${label} compact postflop Matrix empty state`);
    assertGeometry(ui005.rangeComparison.heroTop === ui005.rangeComparison.villainTop, `${label} comparison matrices share one vertical origin`);
    assertGeometry(ui005.trainingPreAnswer.boardHeight <= 160, `${label} empty Training board is compact`);
  }
  assertGeometry(output['1024x768'].ui005.rangeComparison.scrollerContentWidth > output['1024x768'].ui005.rangeComparison.scrollerWidth, '1024 comparison scrolls internally');
  assertGeometry(output['1920x1080'].zoomFactor === 1, '1920x1080 renderer uses 100% zoom');
  assertGeometry(output['1920x1080'].ui005.trainingPreAnswer.viewportBottomGap >= 16, '1920x1080 Training pre-answer fits with a safe bottom gap');
}

function createStaticServer() {
  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
  };
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    const filePath = path.resolve(appRoot, relativePath || 'index.html');
    const root = path.resolve(appRoot);
    if ((!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html'))) {
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

  const output = {};
  for (const [width, height] of sizes) output[`${width}x${height}`] = await inspect(width, height);
  const reported = process.argv.includes('--ui005-summary')
    ? Object.fromEntries(Object.entries(output).map(([viewport, result]) => [viewport, result.ui005]))
    : output;
  if (process.argv.includes('--ui005-summary')) process.stdout.write(`${JSON.stringify(reported, null, 2)}\n`);
  if (process.argv.includes('--ui005-summary')) verifyUi005(output);
  else verify(output);
  if (!process.argv.includes('--ui005-summary')) process.stdout.write(`${JSON.stringify(reported, null, 2)}\n`);

  for (const win of windows) win.destroy();
  windows.clear();
  await new Promise((resolve) => server.close(resolve));
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});
