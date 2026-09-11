// BROWSER-BETA-HARNESS-001. Real mounted app, disposable Firefox, no production hooks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createBrowserRuntime, settle } from './browser-runtime.mjs';

const started = performance.now();
let runtime;
try {
  runtime = await createBrowserRuntime();
  const { page, check } = runtime;
  const visible = selector => page.$eval(selector, e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const text = selector => page.$eval(selector, e => e.textContent.trim());
  async function click(selector) { await page.waitForSelector(selector, { visible: true }); await page.click(selector); await settle(page); }
  async function fill(selector, value) {
    await page.focus(selector); await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control'); await page.keyboard.press('a'); await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control'); await page.keyboard.type(String(value)); await page.keyboard.press('Tab'); await settle(page);
  }
  async function nav(id) {
    await click(`.mode-nav-item[data-navigation-id="${id}"]`);
    await page.waitForFunction(id => document.querySelector('.riverline-shell').dataset.activeDestination === id, {}, id);
    if (['home', 'saved'].includes(id)) await page.waitForFunction(() => document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
    if (id === 'personal-strategy') await page.waitForFunction(() => ['empty', 'configured', 'guest'].includes(document.querySelector('#rangeCalibrationWorkspace').dataset.calibrationState));
    for (const skip of await page.$$('.tutorial-offer button')) if (await skip.evaluate(e => e.getClientRects().length && e.textContent.trim() === 'Skip')) await skip.click();
    await settle(page);
  }
  async function reload() {
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.RiverlineWelcome && window.RiverlinePlaybookState && window.RiverlineAuthentication);
    await page.evaluate(() => RiverlineAuthentication.ready());
    if (await visible('#welcomeOrientation')) await click('[data-welcome-destination="home"]');
  }
  async function fit(label, selectors = []) {
    const result = await page.evaluate(selectors => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth,
      elements: selectors.map(selector => { const e = document.querySelector(selector), r = e?.getBoundingClientRect(); return { selector, visible: !!e?.getClientRects().length, left: r?.left, right: r?.right, width: r?.width, height: r?.height }; }) }), selectors);
    assert.ok(result.scroll <= result.viewport + 1, `${label}: workspace overflows ${JSON.stringify(result)}`);
    for (const e of result.elements) assert.ok(e.visible && e.width > 0 && e.height > 0 && e.left >= -1 && e.right <= result.viewport + 1, `${label}: clipped core content ${JSON.stringify(e)}`);
  }
  async function handFit(label) {
    await fit(label, ['#handLiveStageHeader', '#visual-table-container', '#handInteractionRail']);
    const [rail, ...content] = await page.evaluate(() => ['#handInteractionRail', '#handLiveStageHeader', '#visual-table-container'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
    for (const a of content) assert.ok(a.right <= rail.left + 1 || rail.right <= a.left + 1 || a.bottom <= rail.top + 1 || rail.bottom <= a.top + 1, `${label}: Hand rail overlaps core content`);
  }
  async function reachable(selector) {
    await page.$eval(selector, e => e.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })); await settle(page);
    assert.ok(await page.$eval(selector, e => {
      const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !e.disabled && r.width > 0 && r.height > 0 && (e === hit || e.contains(hit));
    }), `${selector}: primary control is covered or unreachable`);
  }
  async function readable(selector) {
    const ratio = await page.$eval(selector, e => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      const rgba = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
      const blend = (own, parent) => own.slice(0, 3).map((v, i) => v * own[3] / 255 + parent[i] * (1 - own[3] / 255));
      const background = node => node ? blend(rgba(getComputedStyle(node).backgroundColor), background(node.parentElement)) : [255, 255, 255];
      const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const bg = background(e), levels = [luminance(bg), luminance(blend(rgba(getComputedStyle(e).color), bg))].sort((a, b) => b - a);
      return (levels[0] + .05) / (levels[1] + .05);
    });
    assert.ok(ratio >= 4.5, `${selector}: rendered foreground/background contrast ${ratio}`);
  }
  async function chooseCards(opener, cards) {
    await click(opener);
    // Deselect draft cards; the explicit Clear street command commits a clear.
    const selected = await page.$$eval('[data-card-set-preview-card]', nodes => nodes.map(e => e.dataset.cardSetPreviewCard));
    for (const card of selected) await click(`[data-card-set-preview-card="${card}"]`);
    for (const card of cards) await click(`[data-deck-card="${card}"]`);
    await click('#cardSetPickerApply');
  }
  const handState = () => page.evaluate(() => RiverlinePlaybookState.getState());
  const handJSON = () => page.evaluate(() => JSON.stringify(RiverlinePlaybookState.getState()));

  await check('01 Welcome → Home; inert clicks and return scroll', async () => {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(runtime.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.RiverlineWelcome && window.RiverlineAuthentication);
    await page.evaluate(() => RiverlineAuthentication.ready());
    await page.select('#langToggle', 'en');
    assert.ok(await visible('#welcomeOrientation'));
    await click('[data-welcome-destination="home"]'); await nav('home');
    assert.equal(await visible('#welcomeOrientation'), false);
    assert.equal(await page.evaluate(() => scrollY), 0);
    for (const y of [0, 200]) {
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await settle(page);
      const before = await page.evaluate(() => scrollY);
      const point = await page.evaluate(() => {
        for (let y = 250; y < innerHeight - 80; y += 70) for (let x = 300; x < innerWidth - 100; x += 90) {
          const e = document.elementFromPoint(x, y);
          if (e?.closest('#homeMode') && !e.closest('button,a,input,label,summary,[data-home-destination]')) return { x, y };
        }
      });
      assert.ok(point, 'Find inert Home content'); await page.mouse.click(point.x, point.y); await settle(page);
      assert.equal(await page.evaluate(() => scrollY), before, 'Inert Home click preserves scroll');
    }
    await nav('analyze'); await page.evaluate(() => scrollTo(0, 400)); await nav('home');
    assert.equal(await page.evaluate(() => scrollY), 0);
  });

  await check('02 Persisted Daylight and Midnight earliest visible frames', async () => {
    for (const theme of ['daylight', 'midnight']) {
      await click('#openSettings'); await click(`[data-theme-id="${theme}"]`);
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('#settingsModal')), 'Theme selection retains Settings keyboard focus');
      await page.keyboard.press('Escape'); await settle(page);
      assert.equal(await page.$eval('#settingsModal', e => e.classList.contains('show')), false, 'Escape closes Settings after choosing a theme');
      const expected = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, id: document.documentElement.dataset.presentationThemeId }));
      await reload();
      await page.waitForFunction(() => window.__betaThemeFrames.length === 12);
      const frames = await page.evaluate(() => window.__betaThemeFrames);
      assert.ok(frames.every(frame => frame.theme === expected.theme && frame.id === expected.id), JSON.stringify({ expected, frames }));
      assert.equal(expected.id, theme);
      await readable('#homeContinueTitle');
    }
  });

  await check('03 Hand draft updates at 2/10 seats; 1366 fit', async () => {
    await nav('hand');
    for (const count of [2, 10]) {
      await fill('#handTableSize', count); await page.select('#handButtonSeat', '0'); await page.select('#handHeroSeat', '0');
      await settle(page);
      assert.equal((await handState())?.players?.length ?? 0, 0, 'Draft must not create a Hand');
      assert.equal(await page.$$eval('#visual-table-container .table-seat', nodes => nodes.length), count);
      assert.equal(await page.$eval('#handStartButton', e => e.disabled), false);
      if (count === 10) await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
      await fit(`${count}-seat draft`, ['#handLiveStageHeader', '#visual-table-container', '#handStartButton']);
      await reachable('#handStartButton');
    }
  });

  let presetId;
  await check('21 Table preset persistence, load-only and draft isolation', async () => {
    await click('#handTablePresets summary'); await fill('#handTablePresets input', 'Beta smoke table');
    await click('[data-preset-action="save"]');
    presetId = await page.$eval('#handTablePresets select', e => e.value); assert.ok(presetId);
    await reload(); await nav('hand');
    await page.select('#handTablePresets select', presetId); await settle(page);
    assert.equal(await page.$eval('#handTableSize', e => e.value), '10');
    assert.equal((await handState())?.players?.length ?? 0, 0);
    await fill('#handTableSize', 2);
    await page.select('#handTablePresets select', ''); await page.select('#handTablePresets select', presetId); await settle(page);
    assert.equal(await page.$eval('#handTableSize', e => e.value), '10', 'Editing draft must not mutate saved preset');
  });

  await check('04 Start live 10-player Hand at 1366; legal action in heads-up Hand', async () => {
    await click('#handStartButton');
    assert.equal((await handState()).players.length, 10); await handFit('10-player live');
    // Reset via the canonical application owner only to avoid playing an unrelated full-ring Hand.
    await page.evaluate(() => { RiverlinePlaybookState.resetHand(); renderCanonicalHandWorkspace(); });
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await fill('#handTableSize', 2); await fill('#handStackBb', 10);
    await page.select('#handButtonSeat', '0'); await page.select('#handHeroSeat', '0'); await click('#handStartButton');
    await click('#handRandomizePrivate'); await click('#handDealHoleButton');
    assert.ok(await visible('#handLegalActions'));
    assert.notEqual(await text('#handStateActor'), '-'); assert.notEqual(await text('#handStatePot'), '-');
    assert.ok(await text('#handActionHeroStack'));
    const before = await handJSON(); await click('#handLegalActions button[data-canonical-action="call"]');
    assert.notEqual(await handJSON(), before); await handFit('heads-up live');
  });

  await check('05 Review → Analyze → (Training →) Hand retains live controls', async () => {
    // The UI offers Review only for completed Hands. Import through its real dialog over the retained live Hand.
    const raw = await fs.readFile(new URL('../fixtures/hand-history/AllInCall.txt', import.meta.url), 'utf8');
    const live = await handJSON();
    for (const viaTraining of [false, true]) {
      await click('#handImportButton'); await fill('#handImportText', raw);
      await click('.hand-import-actions button:first-child');
      await page.waitForFunction(() => !document.querySelector('.hand-import-actions button:nth-child(2)').disabled);
      await click('.hand-import-actions button:nth-child(2)');
      assert.ok(await visible('#handReviewSurface')); await fit('Review', ['#handReviewSurface']);
      await click('#handReviewAnalyze');
      await page.waitForFunction(() => RiverlinePlaybookState.getMode() === 'scenario');
      if (viaTraining) await nav('training');
      await nav('hand'); assert.equal(await handJSON(), live);
      assert.ok(await visible('#handActionSection')); assert.ok(await visible('#handLegalActions')); await handFit('return to live Hand');
    }
  });

  await check('06 Completed Review and Replay labels survive Previous/Next and language', async () => {
    await click('#handLegalActions button[data-canonical-action="all_in"]');
    await click('#handLegalActions button[data-canonical-action="fold"]');
    await page.waitForSelector('#handCompletedReviewButton', { visible: true });
    const completed = await handJSON();
    await click('#handCompletedReviewButton'); await click('#handReviewAnalyze'); await nav('hand');
    assert.equal(await handJSON(), completed); assert.ok(await visible('#handCompletedReviewButton'));
    await click('#handReplayPreviousButton');
    for (const language of ['ru', 'he', 'en']) { await page.select('#langToggle', language); await settle(page); }
    const labels = await page.evaluate(() => ['handReplayModeBadge', 'handReplayTransition', 'handHistorySelectionSummary', 'handReplayReadOnlyNote'].map(id => document.getElementById(id).textContent));
    assert.ok(!labels.includes('LIVE') && !labels.includes('No hand started') && !labels.includes('No event selected'), JSON.stringify(labels));
    assert.equal(labels[0], 'REPLAY');
    assert.match(await text('#handReplayProgress'), /Step \d+ of \d+/);
    await click('#handReplayNextButton');
    if (await visible('#handReplayLiveButton')) await click('#handReplayLiveButton');
    await click('#handCompletedReviewButton');
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 }); await fit('1366 Review', ['#handReviewSurface']);
    await reachable('#handReviewAnalyze');
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  });

  await check('20 Saved Hand persists and opens after reload', async () => {
    await click('#handReviewSaveHand'); await click('#handReviewReturn'); await click('#savedStudyEditButton');
    await fill('#savedStudyTitle', 'Beta smoke saved Hand'); await click('#savedStudySubmitButton');
    await nav('saved');
    assert.ok(await page.$('[data-saved-select-id]'), 'Saved item exists');
    await reload(); await nav('saved');
    assert.match(await text('#homeWorkspace'), /Beta smoke saved Hand/);
    await click('[data-saved-select-id]');
    // Detail Open control is checked below against the real mounted library.
    const buttons = await page.$$('button');
    let open;
    for (const button of buttons) if (await button.evaluate(e => e.getClientRects().length && /^Open hand$/i.test(e.textContent.trim()))) { open = button; break; }
    assert.ok(open, 'Saved Hand detail has Open hand'); await open.click(); await settle(page);
    assert.ok(await visible('#handReviewSurface'));
  });

  await check('07 Analyze random spots are coherent and ready', async () => {
    await nav('analyze');
    await click('#playbookScenarioMode');
    for (let sample = 0; sample < 4; sample++) {
      await click('#scenarioRandomizeButton');
      await page.waitForFunction(() => app.strategyResult && !document.querySelector('#analysisInputState').getClientRects().length);
      const spot = await page.evaluate(async () => {
        const input = readPlaybookScenarioInput();
        const { validatePlaybookScenarioReadiness } = await import('/src/application/playbook-scenario-readiness.mjs');
        return { input, ready: validatePlaybookScenarioReadiness(input).ready, cards: [...app.gto.hero, ...app.gto.board, ...app.gto.dead] };
      });
      assert.ok(spot.ready, JSON.stringify(spot.input)); assert.equal(new Set(spot.cards).size, spot.cards.length);
      if (/raise|bet/.test(spot.input.lastAction)) assert.ok(spot.input.facingSizeBb > 0, JSON.stringify(spot.input));
      assert.ok(await visible('#bestAction'));
    }
  });

  await check('08 Analyze incomplete → ready clears stale recommendation', async () => {
    await click('[data-card-clear-command="clear_hero"][data-card-clear-surface="scenario"]');
    assert.ok(await visible('#analysisInputState')); assert.equal(await visible('#bestAction'), false);
    assert.equal(await page.evaluate(() => app.strategyResult), null);
    await click('#scenarioRandomizeButton');
    await page.waitForFunction(() => app.strategyResult && !document.querySelector('#analysisInputState').getClientRects().length);
    assert.ok(await visible('#bestAction'));
  });

  await check('09 Explain disclosures, keyboard, nested controls and scroll', async () => {
    // A fixed flop exposes the nested postflop teaching controls on every run.
    await page.evaluate(async () => {
      app.gto.hero = ['Ah', '6d']; app.gto.board = ['7d', 'Qh', 'Ad']; app.gto.dead = [];
      resetScenarioBettingDependencies('flop'); renderPlaybookCards(); await updateContext();
    });
    if (await page.$eval('#toggleTeacher', e => e.getAttribute('aria-expanded') !== 'true')) await click('#toggleTeacher');
    assert.ok(await visible('#teacherContent')); assert.ok((await text('#teacherContent')).length > 100);
    const summaries = await page.$$('#teacherContent summary'); assert.ok(summaries.length >= 3);
    for (const summary of summaries.slice(0, 3)) {
      await summary.click(); await summary.focus();
      const before = await summary.evaluate(e => e.parentElement.open);
      await page.keyboard.press('Enter'); assert.equal(await summary.evaluate(e => e.parentElement.open), !before);
      await page.keyboard.press(' '); assert.equal(await summary.evaluate(e => e.parentElement.open), before);
    }
    const nested = await page.$('#teacherContent details[open] button, #teacherContent details[open] select');
    assert.ok(nested, 'Nested Explain control is available'); await nested.focus();
    assert.equal(await nested.evaluate(e => document.activeElement === e), true);
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.tagName === 'BODY'), false);
    const scroll = await page.$eval('#teacherContent', async e => {
      const target = [e, ...e.querySelectorAll('*')].find(n => n.scrollHeight > n.clientHeight && /auto|scroll/.test(getComputedStyle(n).overflowY));
      if (!target) return { overflow: false };
      const before = target.scrollTop; target.scrollBy(0, 200); await new Promise(r => requestAnimationFrame(r));
      return { overflow: true, moved: target.scrollTop !== before };
    });
    if (scroll.overflow) assert.ok(scroll.moved, 'Overflowing Explain content scrolls');
  });

  await check('10/11 Training answer embargo and keyboard continuation', async () => {
    await nav('training'); await click('#trainingNewHand');
    await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'ready');
    assert.equal(await visible('#trainingFeedback'), false);
    assert.equal(await visible('#feedbackTitle'), false);
    await click('#trainingGuessButtons button');
    await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'feedback');
    assert.ok(await visible('#trainingFeedback')); assert.ok((await text('#trainingFeedback')).length > 30);
    assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('#trainingMode')));
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('#trainingMode')), 'Next Tab stays in Training');
  });

  await check('13 Opponent lineup preserves independent character and behavior per seat', async () => {
    // Reload ends the ephemeral ordinary session, then configure the real Full Hand setup.
    await reload(); await nav('training');
    await click('[data-training-session-mode="full_hand"]');
    await fill('#trainingPlayersNum', 3); await page.select('#trainingHeroPos', 'BTN'); await settle(page);
    const seats = await page.$$eval('[data-lineup-seat]', nodes => nodes.map(e => e.dataset.lineupSeat)); assert.equal(seats.length, 2);
    const snapshot = () => page.evaluate(() => ({ character: document.querySelector('[data-lineup-character]').value, policy: document.querySelector('[data-lineup-policy]').value }));
    await click(`[data-lineup-seat="${seats[1]}"]`); const b = await snapshot();
    await click(`[data-lineup-seat="${seats[0]}"]`);
    const character = await page.$eval('[data-lineup-character]', e => [...e.options].find(o => o.value !== e.value).value);
    await page.select('[data-lineup-character]', character); await page.select('[data-lineup-policy]', 'aggressive');
    await click(`[data-lineup-seat="${seats[1]}"]`); assert.deepEqual(await snapshot(), b);
    await page.select('[data-lineup-policy]', 'tight-passive');
    await click(`[data-lineup-seat="${seats[0]}"]`); assert.deepEqual(await snapshot(), { character, policy: 'aggressive' });
  });

  await check('12 Full Hand Hero fold summary; Watch rest retains canonical history', async () => {
    await click('#trainingNewHand');
    await page.waitForSelector('#trainingGuessButtons button[data-action="fold"]:not([disabled])', { visible: true, timeout: 25000 });
    const before = await page.evaluate(() => app.training.fullHandSnapshot);
    const foldAt = performance.now(); await click('#trainingGuessButtons button[data-action="fold"]');
    await page.waitForSelector('#trainingWatchRest', { visible: true, timeout: 6000 });
    assert.ok(performance.now() - foldAt < 6500, 'Hero summary should be prompt');
    assert.ok(await visible('#trainingFullHandCompletion')); assert.match(await text('#trainingFullHandCompletionTitle'), /summary/i);
    const folded = await page.evaluate(() => app.training.fullHandSnapshot);
    assert.equal(folded.handSeed, before.handSeed);
    assert.equal(folded.state.actionHistory.length, before.state.actionHistory.length + 1, 'No remaining bot actions before Watch rest');
    assert.deepEqual(folded.state.board, before.state.board);
    await click('#trainingWatchRest');
    await page.waitForFunction(length => app.training.fullHandSnapshot.state.actionHistory.length > length
      || app.training.fullHandSnapshot.status === 'terminal', {}, folded.state.actionHistory.length);
    const watching = await page.evaluate(() => app.training.fullHandSnapshot);
    assert.equal(watching.handSeed, folded.handSeed);
    assert.equal(watching.state.handId, folded.state.handId);
    assert.equal(watching.sessionId, folded.sessionId);
    assert.deepEqual(watching.state.players.map(p => p.holeCards), folded.state.players.map(p => p.holeCards));
    assert.deepEqual(watching.state.actionHistory.slice(0, folded.state.actionHistory.length), folded.state.actionHistory);
    assert.deepEqual(watching.state.board.slice(0, folded.state.board.length), folded.state.board);
    assert.ok(watching.state.actionHistory.length >= folded.state.actionHistory.length);
    await reload();
  });

  let knownHand, approachA;
  await check('14 Personal Teacher changes sparse map; evidence persists', async () => {
    await nav('personal-strategy'); await click('#calibrationCreateFirstProfile');
    await fill('#calibrationProfileDisplayName', 'Beta smoke setup'); await click('#calibrationProfileSubmit');
    await page.waitForFunction(() => document.querySelectorAll('.personal-hand-map button').length === 169);
    approachA = await page.$eval('#calibrationModeOptions [aria-checked="true"]', e => e.dataset.modeId);
    const before = await text('#personalUnderstandingStatus');
    await click('[data-calibration-action="raise"]');
    await page.waitForSelector('.personal-hand-map [data-coverage-state="directly_known"]');
    knownHand = await page.$eval('.personal-hand-map [data-coverage-state="directly_known"]', e => e.dataset.mapHand);
    assert.equal(await page.$eval('.personal-hand-map [aria-current="true"]', e => e.dataset.mapHand), knownHand);
    assert.ok(await page.$('.personal-hand-map [data-coverage-state="unknown"]'));
    assert.notEqual(await text('#personalUnderstandingStatus'), before);
    await reload(); await nav('personal-strategy');
    await page.waitForSelector(`.personal-hand-map [data-map-hand="${knownHand}"][data-coverage-state="directly_known"]`);
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 }); await fit('Personal map 1366', ['.personal-hand-map']);
    assert.equal(await page.$$eval('.personal-hand-map button', nodes => nodes.length), 169);
    assert.ok(await page.$$eval('.personal-hand-map button', nodes => nodes.every(e => e.clientWidth > 0 && e.scrollWidth <= e.clientWidth + 1)), 'Every map cell fits');
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  });

  await check('15 Personal evidence correction retains lineage and persists', async () => {
    await click('#personalVersionHistory > summary');
    await page.waitForSelector('[data-correct-evidence]');
    const original = await page.$eval('[data-correct-evidence]', e => e.dataset.correctEvidence);
    await click(`[data-correct-evidence="${original}"]`);
    const selector = '#personalHistoryContent form select[required]';
    const fold = await page.$eval(selector, e => [...e.options].find(o => o.textContent === 'Fold').value);
    await page.select(selector, fold); await click('#personalHistoryContent form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('#personalHistoryContent').textContent.includes('Superseded'));
    assert.ok(await page.$(`[data-correct-evidence="${original}"]`), 'Original evidence remains inspectable');
    await reload(); await nav('personal-strategy'); await click('#personalVersionHistory > summary');
    await page.waitForSelector('[data-correct-evidence]');
    const rows = await page.$$eval('#personalHistoryContent article', nodes => nodes.map(e => e.textContent));
    assert.ok(rows.some(row => row.includes(knownHand) && row.includes('Fold') && row.includes('Current answer')), JSON.stringify(rows));
    assert.ok(rows.some(row => row.includes('Superseded')), JSON.stringify(rows));
  });

  await check('16 Approaches isolate evidence and restore original interpretation', async () => {
    await fill('#personalApproachName', 'Beta smoke approach B'); await click('#personalApproachForm button[type="submit"]');
    await page.waitForFunction(a => document.querySelector('#calibrationModeOptions [aria-checked="true"]').dataset.modeId !== a, {}, approachA);
    await page.waitForFunction(() => document.querySelectorAll('.personal-hand-map button').length === 169);
    assert.equal(await page.$('.personal-hand-map [data-coverage-state="directly_known"]'), null);
    await click('#calibrationPauseQuestions');
    await click(`#calibrationModeOptions [data-mode-id="${approachA}"]`);
    await page.waitForSelector(`.personal-hand-map [data-map-hand="${knownHand}"][data-coverage-state="directly_known"]`);
  });

  await check('17 Equity deterministic calculation', async () => {
    await nav('equity');
    await click('[data-equity-player-count="2"]');
    const ids = await page.$$eval('#equityPlayers .equity-player-card', nodes => nodes.map(e => e.dataset.playerId));
    for (const [index, cards] of [['Ah', '6d'], ['7h', '5s']].entries()) {
      await click(`[data-equity-hand-mode="known"][data-player-id="${ids[index]}"]`);
      await chooseCards(`[data-equity-edit-hand="${ids[index]}"]`, cards);
    }
    await chooseCards('[data-card-set-edit="eqboard"][data-card-set-index="0"]', ['7d', 'Qh', 'Ad']);
    await click('#calculate');
    await page.waitForFunction(() => document.querySelector('.equity-workspace').dataset.equityState === 'complete');
    assert.match(await text('#equityHandAnalysisContent'), /Hand improves, loses lead/);
  });

  await check('19 Runout selection updates hypothetical context without an out claim', async () => {
    await click('#advancedEquityWorkspace > details > summary');
    await click('#advancedEquityWorkspace .advanced-equity-controls button:first-child');
    await page.waitForSelector('#advancedEquityWorkspace .advanced-equity-value');
    await click('#advancedEquityWorkspace .advanced-equity-runout-controls > button');
    await page.waitForSelector('#advancedEquityWorkspace .runout-card', { timeout: 25000 });
    await click('#advancedEquityWorkspace .runout-card');
    assert.equal(await page.$eval('#advancedEquityWorkspace .runout-card', e => e.getAttribute('aria-pressed')), 'true');
    const first = await text('#advancedEquityWorkspace');
    await click('#advancedEquityWorkspace .runout-card:nth-child(2)');
    assert.notEqual(await text('#advancedEquityWorkspace'), first, 'Focused hypothetical context changes');
    assert.match(await text('#equityHandAnalysisContent'), /Hand improves, loses lead/);
  });

  await check('18 Equity input mutation marks stale and invalidates Runout; recalculate', async () => {
    await chooseCards('[data-card-set-edit="eqboard"][data-card-set-index="0"]', ['2c', '3d', '4h']);
    assert.equal(await page.$eval('.equity-workspace', e => e.dataset.equityState), 'stale');
    assert.equal(await page.$('#advancedEquityWorkspace .runout-card'), null);
    await click('#calculate');
    await page.waitForFunction(() => document.querySelector('.equity-workspace').dataset.equityState === 'complete');
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 }); await fit('Equity 1366', ['.equity-workspace', '#calculate']);
    await reachable('#calculate');
  });

  await check('22/23 Russian/Hebrew RTL, Home and Guide structure; Daylight at 1366', async () => {
    await nav('home'); await fit('Home 1366', ['.home-section--continue']);
    assert.ok(await page.evaluate(() => {
      const sections = [...document.querySelectorAll('.home-main-flow > .home-section')].filter(e => e.getClientRects().length);
      return sections.slice(1).every((e, i) => e.getBoundingClientRect().top - sections[i].getBoundingClientRect().bottom < innerHeight / 4);
    }), 'Home main sections do not leave a viewport-sized dead area');
    for (const selector of ['#homeRecentTitle', '#homeReviewTitle']) assert.ok(await visible(selector));
    for (const language of ['ru', 'he']) {
      await page.select('#langToggle', language); await settle(page); await nav('guide');
      assert.ok((await page.evaluate(() => document.body.innerText)).includes(language === 'ru' ? 'Риверлайн' : 'ריברליין'));
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).direction), language === 'he' ? 'rtl' : 'ltr');
      await fit(`Guide ${language}`); await nav('equity'); await fit(`Equity ${language}`);
      assert.ok(await page.$eval('#equityPlayers .riverline-card', e => e.getBoundingClientRect().width > 0));
    }
    await page.select('#langToggle', 'en'); await nav('guide');
    assert.ok(await visible('.information-role-legend'));
    assert.ok(await page.$$eval('.guide-section', nodes => nodes.length >= 3));
    await click('#openSettings'); await click('[data-theme-id="daylight"]'); await click('#closeSettingsModal');
    await page.waitForFunction(() => !document.querySelector('#settingsModal').classList.contains('show'));
    for (const id of ['home', 'guide', 'equity', 'personal-strategy']) { await nav(id); await fit(`Daylight ${id}`); }
    await readable('.personal-hand-map button');
  });

  console.log(JSON.stringify({ browser: await runtime.browser.version(), groups: runtime.checks.length, checks: runtime.checks,
    diagnostics: runtime.diagnostics, seconds: Number(((performance.now() - started) / 1000).toFixed(1)), viewports: ['1920x1080@1', '1366x768@1'] }, null, 2));
} catch (error) {
  console.error(error.stack); process.exitCode = 1;
} finally {
  await runtime?.close();
}
