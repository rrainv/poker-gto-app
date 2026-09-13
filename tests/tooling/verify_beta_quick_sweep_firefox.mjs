import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBrowserRuntime, launchFirefox, settle } from './browser-runtime.mjs';

const runtime = await createBrowserRuntime({ port: 0, launch: () => launchFirefox({ protocolTimeout: 60000 }) });
const { page } = runtime;
const out = await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-quick-sweep-'));
const checks = [];
const click = async selector => { await page.$eval(selector, e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await settle(page); await page.click(selector); await settle(page); };
const nav = async id => { await click(`[data-navigation-id="${id}"]`); };
const shot = async name => { await page.mouse.move(1, 1); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); };
async function locales(selector, name) {
  await page.evaluate(() => setLanguage('en')); await settle(page);
  await page.$eval(selector, root => {
    const summary = root.querySelector('details > summary');
    if (summary) { summary.parentElement.open = true; summary.focus({ preventScroll: true }); }
    window.__quickLocale = { root, summary, before: root.textContent, article: root.firstElementChild,
      context: app.decisionContext, result: app.strategyResult, explanation: app.analysisExplanation,
      hand: JSON.stringify(RiverlinePlaybookState.getState()), scroll: scrollY };
  });
  for (const lang of ['ru', 'he', 'en']) {
    await page.evaluate(lang => setLanguage(lang), lang); await settle(page);
    const result = await page.evaluate(() => {
      const s = window.__quickLocale;
      return { changed: s.root.textContent !== s.before, sameArticle: s.root.firstElementChild === s.article,
        focused: !s.summary || document.activeElement === s.summary, open: !s.summary || s.summary.parentElement.open,
        facts: app.decisionContext === s.context && app.strategyResult === s.result && app.analysisExplanation === s.explanation,
        hand: JSON.stringify(RiverlinePlaybookState.getState()) === s.hand,
        scroll: Math.abs(scrollY - s.scroll), title: s.root.querySelector('.analysis-explanation-headline')?.textContent,
        expected: t('analysis.headline.available') };
    });
    assert.equal(result.title, result.expected, `${name} ${lang} headline`);
    assert.equal(result.changed, lang !== 'en', `${name} ${lang} whole body`);
    assert.ok(result.sameArticle && result.focused && result.open && result.facts && result.hand, JSON.stringify(result));
    assert.ok(result.scroll <= 1, `${name} ${lang} preserves page scroll: ${result.scroll}`);
    checks.push({ name, lang, ...result });
    await shot(`${name}-${lang}`);
  }
}
let completed = false;
try {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(runtime.url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { setLanguage('en'); document.querySelector('[data-welcome-destination="home"]').click(); document.querySelector('[data-navigation-id="analyze"]').click(); });
  await page.evaluate(async () => { app.gto.hero = ['Ah', '6d']; app.gto.board = ['7d', 'Qh', 'Ad']; resetScenarioBettingDependencies('flop'); renderPlaybookCards(); await updateContext(); document.querySelector('#toggleTeacher').click(); });
  for (const width of [1920, 1366]) for (const theme of ['midnight', 'daylight']) {
    await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
    await page.evaluate(theme => RiverlinePresentationTheme.apply(theme), theme);
    await locales('#teacherContent', `analyze-${width}-${theme}`);
  }
  // Reproduce inactive-workspace cache leakage, then switch through real Settings.
  await nav('equity'); await page.evaluate(() => setLanguage('ru')); await nav('analyze');
  assert.equal(await page.$eval('#teacherContent .analysis-explanation-headline', e => e.textContent), await page.evaluate(() => t('analysis.headline.available')));
  await click('#openSettings'); await click('#settingsTabLanguage'); await page.select('#settingsLanguageSelect', 'he'); await settle(page);
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  await page.keyboard.press('Escape'); await settle(page);
  await page.evaluate(() => setLanguage('en'));
  await nav('training'); await click('#trainingNewHand');
  await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'ready');
  await click('#trainingGuessButtons button');
  await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'feedback');
  await click('#trainingAnalysisTitle'); await locales('#trainingAnalysis', 'training');
  await nav('hand');
  await page.evaluate(() => {
    const b = RiverlinePlaybookState; b.resetHand(); b.initializeHand({ tableSize: 2, gameMode: 'home', stackBb: 10, heroSeat: 0, buttonSeat: 0 });
    const p = b.getState().players; b.dealObservedHoleCards({ [p[0].playerId]: ['As', 'Ah'], [p[1].playerId]: ['Ks', 'Kh'] });
    b.applyAction('call'); b.applyAction('check');
    for (const cards of [['2c', '3d', '4h'], ['8s'], ['9s']]) { b.dealBoardCards(cards); b.applyAction('check'); b.applyAction('check'); }
    if (b.getState().phase === 'showdown') b.resolveShowdown(); renderCanonicalHandWorkspace();
  });
  await click('#handCompletedReviewButton'); await shot('review-replay');
  assert.match(await page.$eval('#handReviewSubtitle', e => e.textContent), /Hero decisions.*Replay/);
  assert.match(await page.$eval('#handHistorySection', e => e.textContent), /See how the hand unfolded/);
  await click('#handReviewAnalyze'); await locales('#teacherContent', 'review-explain');
  await page.evaluate(async () => { requestPlaybookMode('scenario'); app.gto.hero = []; renderPlaybookCards(); await updateContext(); });
  await click('#analysisEditInputs');
  assert.ok(await page.$eval('#cardModal', e => e.classList.contains('show') && e.contains(document.activeElement)));
  await page.keyboard.press('Escape'); await shot('analyze-incomplete');
  await nav('equity'); await page.evaluate(() => resetEquityCalculator()); await shot('equity-empty');
  await click('#equityRandomizeButton'); await click('#equityRandomizeBoard'); await click('#calculate');
  await page.waitForFunction(() => document.querySelector('.equity-workspace').dataset.equityState === 'complete');
  await click('#equityRandomizeButton');
  assert.equal(await page.$eval('.equity-workspace', e => e.dataset.equityState), 'stale'); await shot('equity-stale');
  await nav('personal-strategy');
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace').dataset.calibrationState === 'empty');
  await shot('personal-no-context');
  await nav('saved'); await page.waitForFunction(() => document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
  await shot('saved-empty');
  await nav('hand');
  for (const count of [2, 6, 10]) {
    await page.evaluate(count => {
      const b = RiverlinePlaybookState; b.resetHand();
      b.initializeHand({ tableSize: count, gameMode: 'home', stackBb: 20, heroSeat: 0, buttonSeat: count - 1 });
      b.dealObservedHoleCards({ [b.getState().players[0].playerId]: ['As', 'Kh'] });
      if (count > 2) b.applyAction('fold');
      b.applyAction('all_in'); renderCanonicalHandWorkspace();
    }, count);
    for (const width of [1920, 1366]) for (const theme of ['midnight', 'daylight']) {
      await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
      await page.evaluate(theme => RiverlinePresentationTheme.apply(theme), theme); await settle(page);
      const geometry = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#visual-table-container .table-seat-surface, #visual-table-container .table-hole-cards, #visual-table-container .table-dealer-button, #visual-table-container .table-contribution, #community-cards, #table-pot')]
          .filter(e => !e.closest('[hidden]') && e.getBoundingClientRect().width > 0);
        const overlaps = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i].getBoundingClientRect(), b = nodes[j].getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) overlaps.push([nodes[i].outerHTML.slice(0, 220), nodes[j].outerHTML.slice(0, 220)]);
        }
        return { overlaps, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      await shot(`hand-${count}-allin-${width}-${theme}`);
      assert.ok(!geometry.overlaps.length && !geometry.overflow, JSON.stringify({ count, width, theme, geometry, out }));
      checks.push({ count, width, theme, geometry });
    }
  }
  assert.equal(runtime.diagnostics.filter(d => d.kind !== 'console-warn').length, 0, JSON.stringify(runtime.diagnostics));
  completed = true;
  console.log(JSON.stringify({ completed, checks: checks.length, browser: await runtime.browser.version(), artifacts: out }));
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ completed, checks, diagnostics: runtime.diagnostics }, null, 2));
  await runtime.close();
}
