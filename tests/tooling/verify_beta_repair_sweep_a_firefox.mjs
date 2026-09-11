// Run node tools/dev-web-server.mjs first. Uses a fresh, disposable Firefox profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launchFirefox } from './browser-runtime.mjs';
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-beta-repair-a-'));
const browser = await launchFirefox();
const checks = [], errors = [];
const settle = async page => { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); };
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineWelcome && window.RiverlinePlaybookState && window.RiverlineAuthentication);
  await page.evaluate(async () => { window.setLanguage('en'); await window.RiverlineAuthentication.ready(); });
  checks.push({ auth: await page.evaluate(() => ({ status: RiverlineAuthentication.getState().status,
    notice: RiverlineAuthentication.getState().noticeCode, clientLoaded: typeof window.supabase?.createClient === 'function' })) });
  await page.click('[data-welcome-destination="home"]');
  await page.waitForFunction(() => document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
  await settle(page);
  assert.equal(await page.evaluate(() => scrollY), 0);
  const navigate = async destination => {
    await page.click(`.mode-nav-item[data-navigation-id="${destination}"]`);
    await page.waitForFunction(destination => document.querySelector('.riverline-shell').dataset.activeDestination === destination, {}, destination);
    await settle(page);
  };
  await page.evaluate(() => { window.cardEvents = 0; window.addEventListener('riverline:cardpresentationchange', () => window.cardEvents++); });
  async function inertClick(y) {
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await settle(page);
    const before = await page.evaluate(() => ({ y: scrollY, events: cardEvents }));
    const point = await page.evaluate(() => {
      for (let y = 250; y < innerHeight - 80; y += 70) for (let x = 300; x < innerWidth - 100; x += 90) {
        const el = document.elementFromPoint(x, y);
        if (el?.closest('#homeMode') && !el.closest('button,a,input,label,summary,[data-home-destination]')) return { x, y };
      }
    });
    assert.ok(point); await page.mouse.click(point.x, point.y); await settle(page);
    assert.deepEqual(await page.evaluate(() => ({ y: scrollY, events: cardEvents })), before);
  }
  await inertClick(0); await inertClick(220);
  await navigate('analyze'); await page.evaluate(() => scrollTo(0, 450)); await navigate('home');
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.screenshot({ path: path.join(artifacts, 'home-top.png') });
  checks.push('Home startup/navigation and inert clicks at top/partial scroll; zero card-preference events');

  await page.evaluate(() => RiverlineTutorials.restart('home.first-use'));
  await page.waitForSelector('.tutorial-spotlight'); await settle(page);
  const tracking = () => page.evaluate(() => {
    const step = RiverlineTutorials.getState().stepIndex;
    const anchor = ['home-overview', 'home-recent', 'home-review', 'home-personal-strategy', 'home-quick-start'][step];
    const target = document.querySelector(`[data-tutorial-anchor="${anchor}"]`).getBoundingClientRect();
    const box = document.querySelector('.tutorial-spotlight').getBoundingClientRect();
    const top = Math.min(innerHeight, Math.max(0, target.top - 6));
    return { error: Math.abs(box.top - top), transition: getComputedStyle(document.querySelector('.tutorial-spotlight')).transitionDuration };
  });
  await inertClick(0); await inertClick(180); await settle(page);
  assert.ok((await tracking()).error < 1); assert.equal((await tracking()).transition, '0s');
  await page.mouse.wheel({ deltaY: 180 }); await settle(page); assert.ok((await tracking()).error < 1);
  await page.setViewport({ width: 1366, height: 768 }); await settle(page); assert.ok((await tracking()).error < 1);
  await page.keyboard.press('ArrowRight'); await settle(page); await page.keyboard.press('ArrowLeft'); await settle(page);
  await page.screenshot({ path: path.join(artifacts, 'tutorial-1366.png') });
  await navigate('analyze'); assert.equal(await page.$('.tutorial-spotlight'), null);
  checks.push('Home tutorial inert clicks, wheel tracking, resize, next/back and route teardown');

  // Active-only geometry ownership also observes internal scroll and target loss.
  const losses = await page.evaluate(async () => {
    const { createCoachMarkSurface } = await import('/src/tutorial/coach-mark.mjs');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;top:100px;left:300px;width:400px;height:200px;overflow:auto;z-index:10';
    const content = document.createElement('div'); content.style.height = '800px';
    const target = document.createElement('button'); target.style.transition = 'none'; target.textContent = 'Geometry fixture'; content.append(target); host.append(content); document.body.append(host);
    const owner = createCoachMarkSurface({ document, window }); let lost = 0;
    const config = { target, step: { titleKey: 'test', bodyKey: 'test', placement: 'bottom' }, stepIndex: 0, stepCount: 2,
      onTargetLost() { lost++; owner.hide({ restoreFocus: false }); } };
    const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    owner.show(config); await frames(); host.scrollTop = 40; await frames();
    const error = Math.abs(document.querySelector('.tutorial-spotlight').getBoundingClientRect().top - (target.getBoundingClientRect().top - 6));
    target.style.visibility = 'hidden';
    for (let i = 0; i < 10 && lost < 1; i++) await frames();
    const hiddenLost = lost, visibility = getComputedStyle(target).visibility, diagnostics = owner.diagnostics();
    target.style.visibility = ''; owner.show(config); await frames(); target.remove();
    for (let i = 0; i < 10 && lost < 2; i++) await frames();
    host.remove(); owner.hide({ restoreFocus: false }); return { lost, hiddenLost, visibility, diagnostics, error, listeners: owner.diagnostics().activeListeners };
  });
  assert.ok(losses.error < 1); assert.equal(losses.lost, 2, JSON.stringify(losses)); assert.equal(losses.listeners, 0);
  checks.push('Tutorial internal scroll, hidden/removed targets and listener disposal');

  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluate(async () => { await randomizeCurrentAnalyzeScenario('spot'); scrollTo(0, 200); }); await settle(page);
  const beforeWelcome = await page.evaluate(() => ({ y: scrollY, scenario: JSON.stringify(readPlaybookScenarioInput()), destination: document.querySelector('.riverline-shell').dataset.activeDestination }));
  await page.evaluate(() => { const b = document.querySelector('#workspaceLearnButton'); b.focus({ preventScroll: true }); b.click(); });
  await settle(page);
  const modal = await page.evaluate(() => { const e = document.querySelector('#welcomeOrientation'); return { position: getComputedStyle(e).position,
    role: e.getAttribute('role'), inert: document.querySelector('#gtoMode').closest('.shell').inert,
    overflow: getComputedStyle(document.documentElement).overflow, bottom: e.getBoundingClientRect().bottom }; });
  assert.equal(modal.position, 'fixed'); assert.equal(modal.role, 'dialog'); assert.equal(modal.inert, true); assert.equal(modal.overflow, 'hidden');
  await page.mouse.move(1700, 800); await page.mouse.wheel({ deltaY: 1500 }); await settle(page);
  assert.equal(await page.evaluate(() => scrollY), beforeWelcome.y);
  await page.screenshot({ path: path.join(artifacts, 'learn-modal.png') });
  await page.keyboard.press('Escape'); await settle(page);
  assert.deepEqual(await page.evaluate(() => ({ y: scrollY, scenario: JSON.stringify(readPlaybookScenarioInput()), destination: document.querySelector('.riverline-shell').dataset.activeDestination })), beforeWelcome);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'workspaceLearnButton');
  checks.push('Learn modal bounds, scroll lock, unchanged Scenario/workspace, Escape focus/scroll restoration');

  const scenarios = await page.evaluate(async () => {
    const { validatePlaybookScenarioReadiness } = await import('/src/application/playbook-scenario-readiness.mjs');
    const b = RiverlinePlaybookState; const counts = {};
    for (let seed = 0; seed < 120; seed++) {
      const result = b.randomizeScenario({ schemaVersion: b.randomizationRequestVersion, scenario: readPlaybookScenarioInput(), target: 'spot', seed, keeps: {} });
      if (result.status !== 'available') throw Error('generation unavailable');
      applyRandomizedScenarioToControls(result.scenario);
      const input = readPlaybookScenarioInput();
      if (!validatePlaybookScenarioReadiness(input).ready || input.lastAction !== result.scenario.lastAction || input.facingSizeBb !== result.scenario.facingSizeBb) throw Error(`invalid applied seed ${seed}`);
      counts[input.street] = (counts[input.street] ?? 0) + 1;
    }
    app.gto.hero = ['Ah', '6d']; app.gto.board = ['7d', 'Qh', 'Ad']; app.gto.dead = [];
    resetScenarioBettingDependencies('flop'); renderPlaybookCards(); await updateContext('Browser fixture'); return counts;
  });
  assert.equal(Object.keys(scenarios).length, 4); checks.push({ appliedScenarioSeeds: scenarios });
  if (await page.$eval('#toggleTeacher', e => e.getAttribute('aria-expanded') !== 'true')) await page.click('#toggleTeacher');
  await settle(page);
  for (const text of ['Supporting detail', 'Limits & caveats', 'Why might this action work?']) {
    const handles = await page.$$('#teacherContent summary'); let summary;
    for (const h of handles) if ((await h.evaluate(e => e.textContent)).startsWith(text)) { summary = h; break; }
    assert.ok(summary, text); await summary.click(); await settle(page);
    assert.deepEqual(await summary.evaluate(e => ({ open: e.parentElement.open, connected: e.isConnected })), { open: true, connected: true });
    await summary.focus(); await page.keyboard.press('Escape'); assert.equal(await summary.evaluate(e => e.parentElement.open), false);
    await page.keyboard.press('Enter'); assert.equal(await summary.evaluate(e => e.parentElement.open), true);
    await page.keyboard.press(' '); assert.equal(await summary.evaluate(e => e.parentElement.open), false);
  }
  await page.screenshot({ path: path.join(artifacts, 'explain.png') });
  checks.push('All three Explain disclosures: click, persistent nodes, Enter, Space, Escape');

  await navigate('hand');
  const revealBefore = await page.evaluate(() => {
    const b = RiverlinePlaybookState; b.resetHand(); b.initializeHand({ tableSize: 3, gameMode: 'home', stackBb: 10, heroSeat: 0, buttonSeat: 0 });
    b.dealObservedHoleCards({ [b.getHeroPlayerId()]: ['As', 'Ah'] }); b.applyAction('fold'); b.applyAction('all_in'); b.applyAction('call');
    b.dealBoardCards(['2c','3d','4h']); b.dealBoardCards(['8s']); b.dealBoardCards(['9s']);
    renderCanonicalHandWorkspace(); return JSON.stringify(b.getState());
  });
  assert.equal(await page.$eval('#handRandomizePrivate', e => e.hidden || e.disabled), false);
  await page.click('#handRandomizePrivate'); await settle(page);
  assert.equal(await page.evaluate(() => JSON.stringify(RiverlinePlaybookState.getState())), revealBefore);
  assert.equal(await page.$eval('#handDealHoleButton', e => e.disabled), false);
  assert.equal(await page.$eval('#handRandomizePrivate', e => e.getAttribute('aria-label')), 'Random private cards');
  await page.screenshot({ path: path.join(artifacts, 'folded-hero-reveal.png') });
  await page.click('#handDealHoleButton'); await settle(page);
  assert.notEqual(await page.evaluate(() => RiverlinePlaybookState.getState().showdown.status), 'awaiting_private_reveal');
  checks.push('Hero folded, two all-in opponents, full public runout: private draft randomization then explicit reveal');
  await page.click('#handResolveShowdownButton'); await settle(page);
  assert.equal(await page.evaluate(() => RiverlinePlaybookState.getState().phase), 'terminal');
  const labels = () => page.evaluate(() => ['handReplayModeBadge', 'handReplayTransition', 'handHistorySelectionSummary', 'handReplayReadOnlyNote'].map(id => document.getElementById(id).textContent));
  const beforeMove = await labels();
  await page.evaluate(() => { const e = document.querySelector('#handReplaySection'); if (e) e.parentElement.append(e); else { const e = document.querySelector('#handReplayModeBadge'); e.parentElement.append(e); } });
  await settle(page); assert.deepEqual(await labels(), beforeMove);
  await page.click('#handReplayPreviousButton'); await settle(page);
  for (const language of ['ru','he','en']) { await page.evaluate(language => setLanguage(language), language); await settle(page); }
  const replay = await labels(); assert.ok(!replay.includes('LIVE')); assert.ok(!replay.includes('No hand started')); assert.ok(!replay.includes('No event selected'));
  await page.click('#handReplayNextButton'); await settle(page);
  await navigate('home'); await navigate('hand'); assert.ok(!(await labels()).includes('No hand started'));
  checks.push('Replay live/completed labels survive reparenting, Previous/Next, language switches and route away/back');
  await page.evaluate(() => { RiverlinePlaybookState.returnReplayToLive(); renderCanonicalHandWorkspace(); });
  await page.click('#handCompletedReviewButton'); await settle(page);
  assert.equal(await page.$eval('#handReviewSurface', e => e.hidden), false);
  assert.ok(!(await labels()).includes('No hand started'));
  checks.push('Completed Hand Review keeps runtime Replay labels');

  const imported = fs.readFileSync(new URL('../fixtures/hand-history/HeroName.txt', import.meta.url), 'utf8');
  await page.click('#handImportButton');
  await page.$eval('#handImportText', (e, text) => { e.value = text; e.dispatchEvent(new Event('input', { bubbles: true })); }, imported);
  await page.click('.hand-import-actions button:first-child');
  await page.waitForFunction(() => !document.querySelector('.hand-import-actions button:nth-child(2)').disabled);
  await page.click('.hand-import-actions button:nth-child(2)'); await settle(page);
  assert.ok(!(await labels()).includes('No hand started'));
  await page.evaluate(() => { const e = document.querySelector('#handReplayModeBadge'); e.parentElement.append(e); }); await settle(page);
  assert.ok(!(await labels()).includes('No hand started'));
  checks.push('Imported Hand opens in Review with coherent Replay labels after DOM movement');

  await navigate('equity');
  await page.evaluate(async () => {
    app.equity.players = [{ id: 'p0', name: 'Hero', handMode: 'known', cards: ['Ah','6d'] }, { id: 'p1', name: 'Opponent', handMode: 'known', cards: ['7h','5s'] }];
    app.equity.board = ['7d','Qh','Ad']; app.equity.dead = []; renderAllCards({ mode: 'equity' }); setEquityPending({ renderInputs: 'players' });
    await calculateEquity();
  });
  await page.waitForFunction(() => document.querySelector('#equityHandAnalysisContent')?.textContent.includes('Hand improves'));
  const equity = await page.$eval('#equityHandAnalysisContent', e => e.textContent);
  assert.ok(equity.includes('Hand improves, loses lead'));
  await page.screenshot({ path: path.join(artifacts, 'equity-standing.png'), fullPage: true });
  checks.push('Exact Ah6d / 7h5s / 7dQhAd Equity UI reports improvement with lost lead');
  for (const [blocked, notice] of [['/supabase.js', 'provider_client_unavailable'], ['/auth-config.js', 'provider_not_configured']]) {
    const unavailable = await browser.newPage();
    await unavailable.setRequestInterception(true);
    unavailable.on('request', request => { void (request.url().endsWith(blocked) ? request.abort() : request.continue()); });
    await unavailable.goto('http://127.0.0.1:3000/', { waitUntil: 'load' });
    await unavailable.waitForFunction(() => window.RiverlineAuthentication);
    await unavailable.evaluate(async () => { await RiverlineAuthentication.ready(); setLanguage('en'); RiverlineAuthentication.openAccount(); });
    assert.equal(await unavailable.evaluate(() => RiverlineAuthentication.getState().noticeCode), notice);
    assert.equal(await unavailable.$$eval('#accountSignInForm input, #accountSignInForm button, #accountSignUpForm input, #accountSignUpForm button', nodes => nodes.every(e => e.disabled)), true);
    await unavailable.close();
  }
  checks.push('Missing SDK and missing config independently show distinct notices and disable credential controls');
  assert.deepEqual(errors, []);
  const report = { browser: await browser.version(), checks, errors, artifacts };
  fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
