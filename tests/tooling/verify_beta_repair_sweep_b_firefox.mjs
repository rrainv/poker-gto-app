// Run node tools/dev-web-server.mjs first. All state uses a disposable Firefox profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { default: puppeteer } = await import(process.env.RIVERLINE_PUPPETEER_MODULE || 'puppeteer');
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-beta-b-'));
const browser = await puppeteer.launch({ browser: 'firefox', headless: true,
  executablePath: process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe' });
const checks = [], errors = [];
const settle = page => page.evaluate(async () => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await Promise.race([Promise.allSettled(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)), new Promise(r => setTimeout(r, 500))]);
});
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const loadedPortraits = [];
  page.on('response', response => { if (/opponents\/.*\.(png|webp)/.test(response.url())) loadedPortraits.push(response.url()); });
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlinePresentationTheme && window.RiverlineWelcome);
  const shot = async name => { await settle(page); await page.screenshot({ path: path.join(artifacts, `${name}.png`) }); console.log(name); };
  const nav = async destination => { await page.click(`.mode-nav-item[data-navigation-id="${destination}"]`); await settle(page); };
  for (const language of ['en', 'ru', 'he']) {
    await page.evaluate(language => setLanguage(language), language);
    for (const width of [1920, 1366]) {
      await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
      await shot(`welcome-${language}-${width}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Welcome fits viewport');
    }
    assert.equal(await page.$eval('#welcomeTitle', e => e.children.length), 3);
    const name = { en: 'Riverline', ru: 'Риверлайн', he: 'ריברליין' }[language];
    assert.ok((await page.$eval('.welcome-eyebrow', e => e.textContent)).includes(name));
  }
  assert.ok(!loadedPortraits.some(url => url.endsWith('.png')), 'Welcome never loads source art');
  checks.push({ welcomePortraits: loadedPortraits });
  await page.evaluate(() => setLanguage('en'));
  await page.click('[data-welcome-destination="home"]');
  await page.waitForFunction(() => document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
  await shot('home-1920');
  const homeFlow = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.home-main-flow > .home-section')].filter(e => !e.hidden);
    return nodes.slice(1).map((e, i) => e.getBoundingClientRect().top - nodes[i].getBoundingClientRect().bottom);
  });
  assert.ok(homeFlow.every(gap => gap >= 0 && gap <= 24), JSON.stringify(homeFlow));
  // Save each theme using the canonical owner, then observe the next navigation before app bootstrap.
  for (const theme of ['midnight', 'daylight', 'custom']) {
    await page.evaluate(theme => {
      const c = RiverlinePresentationTheme;
      if (theme === 'custom') { c.apply('midnight'); c.customize({ surface: '#777777', accent: '#ef268c', felt: '#cca955' }); c.saveAsNew('Browser contrast'); }
      else c.apply(theme);
    }, theme);
    const expected = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme,
      id: document.documentElement.dataset.presentationThemeId, styles: document.documentElement.style.cssText }));
    await page.evaluateOnNewDocument(() => {
      window.firstThemePaints = [];
      const sample = () => { if (document.body && getComputedStyle(document.body).visibility !== 'hidden') {
        firstThemePaints.push({ theme: document.documentElement.dataset.theme, id: document.documentElement.dataset.presentationThemeId });
      } if (firstThemePaints.length < 8) requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.RiverlinePresentationTheme && firstThemePaints.length > 0);
    const paints = await page.evaluate(() => firstThemePaints);
    assert.ok(paints.every(p => p.theme === expected.theme && p.id === expected.id), JSON.stringify(paints));
    await shot(`theme-${theme}`);
    await page.setCacheEnabled(false); await page.reload({ waitUntil: 'load' }); await page.setCacheEnabled(true);
    await page.waitForFunction(() => window.RiverlinePresentationTheme && firstThemePaints.length > 0);
    const hardPaints = await page.evaluate(() => firstThemePaints);
    assert.ok(hardPaints.every(p => p.theme === expected.theme && p.id === expected.id));
    await page.click('#welcomeRememberChoice');
    await page.click('[data-welcome-destination="home"]');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.RiverlinePresentationTheme && firstThemePaints.length > 0);
    assert.ok(await page.$eval('#welcomeOrientation', e => e.hidden), 'Remembered startup opens Home');
    assert.ok((await page.evaluate(() => firstThemePaints)).every(p => p.theme === expected.theme && p.id === expected.id));
    checks.push({ theme, paints, hardPaints, startupHome: true });
    // The next theme also exercises startup Welcome, using the same preference owner.
    await page.evaluate(async () => {
      const { WELCOME_ORIENTATION_STORAGE_KEY } = await import('/src/application/welcome-orientation.mjs');
      localStorage.removeItem(WELCOME_ORIENTATION_STORAGE_KEY);
    });
  }
  await page.evaluate(() => RiverlinePresentationTheme.apply('midnight'));
  if (await page.$eval('#welcomeOrientation', e => !e.hidden)) await page.click('[data-welcome-destination="home"]');
  for (const width of [1920, 1366]) {
    await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
    await nav('home'); await shot(`home-${width}`);
    await nav('hand');
    const widths = [];
    for (const count of [2, 3, 4, 6, 8, 10]) {
      await page.evaluate(count => {
        const b = RiverlinePlaybookState; b.resetHand();
        b.initializeHand({ tableSize: count, gameMode: 'home', stackBb: 10, heroSeat: 0, buttonSeat: 0 });
        b.dealObservedHoleCards({ [b.getHeroPlayerId()]: ['As', 'Ah'] }); renderCanonicalHandWorkspace();
      }, count);
      await settle(page);
      widths.push(await page.$eval('#visual-table-container .table-rail--outer', e => e.getBoundingClientRect().width));
      if ([2, 6, 10].includes(count)) await shot(`hand-${count}-${width}`);
    }
    assert.ok(Math.max(...widths) / Math.min(...widths) < 1.15, JSON.stringify(widths));
    checks.push({ width, tableWidths: widths });
    await page.evaluate(() => {
      const b = RiverlinePlaybookState; b.resetHand(); b.initializeHand({ tableSize: 2, gameMode: 'home', stackBb: 10, heroSeat: 0, buttonSeat: 0 });
      const players = b.getState().players;
      b.dealObservedHoleCards({ [players[0].playerId]: ['As','Ah'], [players[1].playerId]: ['Ks','Kh'] });
      b.applyAction('call'); b.applyAction('check');
      for (const cards of [['2c','3d','4h'], ['8s'], ['9s']]) {
        b.dealBoardCards(cards); b.applyAction('check'); b.applyAction('check');
      }
      if (b.getState().phase === 'showdown') b.resolveShowdown();
      renderCanonicalHandWorkspace();
    });
    await page.click('#handCompletedReviewButton'); await shot(`review-${width}`);
    const review = await page.evaluate(() => {
      const detail = document.querySelector('.hand-review-decision-detail').getBoundingClientRect();
      const overview = document.querySelector('.hand-review-overview').getBoundingClientRect();
      const board = document.querySelector('#handReviewFinalBoard');
      return { detail: detail.width, overview: overview.width, board: board.clientWidth, boardContent: board.scrollWidth };
    });
    assert.ok(review.detail > review.overview, JSON.stringify(review));
    assert.ok(review.boardContent <= review.board + 1, JSON.stringify(review));
    await page.$eval('#handReplayPreviousButton', e => e.scrollIntoView({ block: 'center' })); await settle(page);
    const before = await page.evaluate(() => scrollY);
    for (let n = 0; n < 3; n++) { await page.click('#handReplayPreviousButton'); await settle(page); }
    assert.equal(await page.evaluate(() => scrollY), before, 'history selection does not move document');
    const history = await page.$eval('#handActionHistory', e => ({ height: e.clientHeight, content: e.scrollHeight }));
    checks.push({ width, history });
    checks.push({ width, review });
    await nav('equity');
    for (const count of [2, 3, 4, 6, 10]) {
      await page.evaluate(count => { setEquityPlayerCount(count); }, count);
      await settle(page);
      const tiles = await page.$$eval('.equity-player-card', nodes => nodes.map(e => {
        const r = e.getBoundingClientRect(), body = e.querySelector('.equity-player-body').getBoundingClientRect(), footer = e.querySelector('.equity-player-footer').getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, overflow: e.scrollWidth - e.clientWidth, bodyBottom: body.bottom, footerTop: footer.top };
      }));
      assert.equal(tiles.length, count);
      assert.ok(tiles.every(t => t.overflow <= 1 && t.width >= 180 && t.bodyBottom <= t.footerTop + 1), JSON.stringify(tiles));
      if ([2, 6, 10].includes(count)) await shot(`equity-${count}-${width}`);
    }
    await page.evaluate(async () => {
      setEquityPlayerCount(6);
      app.equity.players[0].cards = ['As', 'Ah'];
      app.equity.players[0].handMode = 'known';
      app.equity.board = ['2c', '3d', '4h', '8s', '9s'];
      renderAllCards({ mode: 'equity' }); setEquityPending({ renderInputs: 'players' });
      await calculateEquity();
    });
    await shot(`equity-results-${width}`);
    assert.ok((await page.$eval('.equity-result-primary', e => e.textContent)).includes('%'), 'calculated tile result');
    await nav('analyze');
    await page.evaluate(async () => { await randomizeCurrentAnalyzeScenario('spot'); });
    if (await page.$eval('#toggleTeacher', e => e.getAttribute('aria-expanded') !== 'true')) await page.click('#toggleTeacher');
    for (const lang of ['en','ru','he']) { await page.evaluate(lang => setLanguage(lang), lang); await shot(`explain-${lang}-${width}`); }
    await page.evaluate(() => setLanguage('en'));
  }
  const checkTraining = async (trainingPage, reduced) => {
  await trainingPage.click('.mode-nav-item[data-navigation-id="training"]');
  await trainingPage.evaluate(() => {
    setTrainingSessionMode('full_hand');
    document.querySelector('#trainingPlayers').value = '6';
    document.querySelector('#trainingPlayers').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#trainingHeroPos').value = 'BB';
    window.betaBPacing = [];
    const original = renderFullHandAutomationSnapshot;
    renderFullHandAutomationSnapshot = function(snapshot, options) {
      betaBPacing.push({ at: performance.now(), kind: options?.cue?.kind, event: options?.event?.type,
        motion: options?.motionEnabled, count: snapshot.state.actionHistory.length });
      return original(snapshot, options);
    };
  });
    assert.equal(await trainingPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), reduced);
    const result = await trainingPage.evaluate(async () => {
      betaBPacing.length = 0;
      await startFullHandTraining({ seed: 'beta-b-paced' });
      return { status: app.training.fullHandSnapshot?.status, events: betaBPacing };
    });
    assert.ok(result.events.filter(e => e.kind === 'bot_action').length >= 2, JSON.stringify(result));
    for (let n = 0; n < result.events.length - 1; n++) {
      if (result.events[n].kind === 'bot_action') assert.ok(result.events[n+1].at - result.events[n].at >= 450, JSON.stringify(result));
    }
    assert.equal(result.status, 'awaiting_hero');
    if (reduced) assert.ok(result.events.filter(e => e.kind === 'bot_action').every(e => e.motion === false));
    await settle(trainingPage);
    await trainingPage.screenshot({ path: path.join(artifacts, `training-${reduced ? 'reduced' : 'normal'}.png`) });
    checks.push({ reduced, training: result });
  };
  await checkTraining(page, false);
  await page.click('#openSettings');
  await page.click('#settingsTabAudio');
  await page.click('.audio-preview-field > summary');
  assert.equal((await page.$$('[data-audio-preview-cue]')).length, 13);
  await page.click('#audioStudySwitch');
  assert.ok(await page.$eval('[data-audio-preview-cue="warning"]', e => e.disabled));
  assert.ok(await page.$eval('[data-audio-preview-cue="check"]', e => !e.disabled));
  await page.click('#audioStudySwitch');
  await page.click('#audioPokerSwitch');
  assert.ok(await page.$eval('[data-audio-preview-cue="check"]', e => e.disabled));
  assert.ok(await page.$eval('[data-audio-preview-cue="warning"]', e => !e.disabled));
  await page.click('#audioPokerSwitch');
  await page.focus('[data-audio-preview-cue="study_positive"]');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.audioPreviewCue), 'study_neutral');
  assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
  const previews = [];
  for (const cue of ['study_neutral', 'hint', 'study_positive', 'study_corrective', 'warning', 'error', 'check']) {
    await page.click(`[data-audio-preview-cue="${cue}"]`);
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    previews.push(cue);
  }
  checks.push({ settings: { independentCategories: true, keyboardFocus: true, previewGestures: previews } });
  const reducedBrowser = await puppeteer.launch({ browser: 'firefox', headless: true,
    executablePath: process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe',
    extraPrefsFirefox: { 'ui.prefersReducedMotion': 1 } });
  try {
    const reducedPage = await reducedBrowser.newPage();
    reducedPage.on('pageerror', error => errors.push(String(error)));
    await reducedPage.setViewport({ width: 1920, height: 1080 });
    await reducedPage.goto('http://127.0.0.1:3000/', { waitUntil: 'load' });
    await reducedPage.click('[data-welcome-destination="home"]');
    await checkTraining(reducedPage, true);
  } finally { await reducedBrowser.close(); }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ artifacts, checks, errors }));
} finally { await browser.close(); }
