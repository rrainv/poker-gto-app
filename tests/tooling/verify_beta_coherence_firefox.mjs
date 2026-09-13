import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBrowserRuntime, launchFirefox, settle } from './browser-runtime.mjs';

const runtime = await createBrowserRuntime({ port: 0, launch: () => launchFirefox({ protocolTimeout: 60000 }) });
const { page } = runtime;
const out = await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-coherence-'));
console.log(out);
const findings = [];
let completed = false;
const nav = async id => {
  await page.click(`.mode-nav-item[data-navigation-id="${id}"]`);
  if (id === 'personal-strategy') await page.waitForFunction(() => ['empty', 'configured'].includes(document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState));
  await settle(page);
};
const click = async selector => { await page.$eval(selector, e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await settle(page); await page.click(selector); await settle(page); };
const shot = async name => { await page.evaluate(() => scrollTo(0, 0)); await page.mouse.move(1, 1); await settle(page); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); };
try {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(runtime.url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => setLanguage('en'));
  await click('[data-welcome-destination="home"]');
  await shot('home');
  assert.equal(await page.$eval('.home-section--quick', e => getComputedStyle(e).borderTopWidth), '1px');
  await nav('hand');
  for (const width of [1920, 1366]) {
    await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
    for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      await page.evaluate(count => {
        const b = RiverlinePlaybookState; b.resetHand();
        b.initializeHand({ tableSize: count, gameMode: 'home', stackBb: 100, heroSeat: 0, buttonSeat: count - 1 });
        b.dealObservedHoleCards({ [b.getState().players[0].playerId]: ['As', 'Kh'] }); renderCanonicalHandWorkspace();
      }, count);
      await settle(page);
      for (const state of ['preflop', 'flop']) {
      if (state === 'flop') await page.evaluate(() => { const b = RiverlinePlaybookState; for (let step = 0; b.getState().phase === 'betting' && step < 12; step++) { const legal = b.getLegalActions(); b.applyAction(legal.check.available ? 'check' : 'call'); } b.dealBoardCards(['Qc', '8d', '4h']); renderCanonicalHandWorkspace(); });
      await settle(page);
      const collisions = await page.evaluate(() => {
        const table = document.querySelector('#visual-table-container');
        const visible = e => e && !e.closest('[hidden]') && e.getBoundingClientRect().width > 0;
        const nodes = [...table.querySelectorAll('.table-seat-surface, .table-hole-cards, .table-dealer-button, .table-contribution, #community-cards, #table-pot')].filter(visible);
        const overlaps = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i].getBoundingClientRect(), b = nodes[j].getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) overlaps.push([nodes[i].id || nodes[i].parentElement.parentElement.id, nodes[j].id || nodes[j].parentElement.parentElement.id]);
        }
        // Inspect every rendered dealer anchor, including seats not currently on
        // the button. This temporary geometry probe does not mutate PokerState.
        const dealerOverlaps = [];
        const dealers = [...table.querySelectorAll('.table-dealer-button')];
        for (const dealer of dealers) {
          const hidden = dealer.hasAttribute('hidden'); dealer.removeAttribute('hidden');
          const a = dealer.getBoundingClientRect();
          for (const target of nodes.filter(e => !e.classList.contains('table-dealer-button'))) {
            const b = target.getBoundingClientRect();
            if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2) dealerOverlaps.push([dealer.id, target.id || target.parentElement.parentElement.id]);
          }
          dealer.toggleAttribute('hidden', hidden);
        }
        return { overlaps, dealerOverlaps, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      findings.push({ width, count, state, ...collisions });
      if ([2, 6, 10].includes(count)) await shot(`hand-${count}-${state}-${width}`);
      }
    }
  }
  console.log(JSON.stringify(findings));
  await nav('analyze');
  await page.evaluate(async () => { requestPlaybookMode('scenario'); app.gto.hero = []; renderPlaybookCards(); await updateContext(); });
  await click('#analysisEditInputs');
  assert.ok(await page.$eval('#cardModal', e => e.classList.contains('show')));
  assert.ok(await page.$eval('#cardModal', e => e.contains(document.activeElement)));
  await shot('analyze-editor');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { app.gto.hero = ['Ah', '6d']; app.gto.board = ['7d', 'Qh', 'Ad']; app.gto.dead = []; resetScenarioBettingDependencies('flop'); renderPlaybookCards(); await updateContext(); });
  await page.waitForFunction(() => app.decisionContext && app.strategyResult);
  await shot('analyze');
  await click('#analysisTeachDecision');
  await page.waitForSelector('#personalDecisionExample');
  await click('#calibrationCreateFirstProfile');
  await page.type('#calibrationProfileDisplayName', 'Coherence study');
  await click('#calibrationProfileSubmit');
  await page.waitForFunction(() => document.querySelectorAll('.personal-hand-map button').length === 169);
  await shot('personal-incoming');
  await click('#personalDecisionExample .ui-button--primary');
  await page.type('#personalIntentText', 'I prefer to check this spot and keep the pot small.');
  await click('#personalIntentForm button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#personalIntentPreview').hidden);
  await shot('personal-confirm');
  await click('#personalConfirmIntent');
  await page.waitForFunction(() => document.querySelector('#personalIntentText').value === '');
  await shot('personal-saved');
  await page.reload({ waitUntil: 'networkidle0' }); await nav('personal-strategy');
  await click('#personalContextInputDisclosure > summary');
  assert.ok(await page.$eval('#personalIntentStatements', e => e.textContent.includes('Analyze') && e.textContent.includes('Flop')));
  await nav('training'); await click('#trainingNewHand');
  await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'ready');
  assert.equal(await page.$eval('#trainingTeachDecision', e => !!e.getClientRects().length), false);
  await click('#trainingGuessButtons button');
  await page.waitForFunction(() => document.querySelector('.training-workspace').dataset.trainingState === 'feedback');
  await click('#trainingAnalysisTitle'); await shot('training-explain');
  await click('#trainingTeachDecision'); await page.waitForSelector('#personalDecisionExample');
  assert.match(await page.$eval('#personalDecisionExample', e => e.textContent), /Training/);
  await click('#personalDecisionExample .ui-button--tertiary');
  await nav('hand');
  await page.evaluate(() => {
    const b = RiverlinePlaybookState; b.resetHand(); b.initializeHand({tableSize:2,gameMode:'home',stackBb:10,heroSeat:0,buttonSeat:0});
    const p = b.getState().players; b.dealObservedHoleCards({[p[0].playerId]:['As','Ah'],[p[1].playerId]:['Ks','Kh']});
    b.applyAction('call'); b.applyAction('check');
    for(const cards of [['2c','3d','4h'],['8s'],['9s']]) { b.dealBoardCards(cards); b.applyAction('check'); b.applyAction('check'); }
    if(b.getState().phase==='showdown') b.resolveShowdown(); renderCanonicalHandWorkspace();
  });
  await click('#handCompletedReviewButton'); await page.waitForSelector('[data-study-control="teach"]');
  await shot('review');
  await click('[data-study-control="teach"]'); await page.waitForSelector('#personalDecisionExample');
  assert.match(await page.$eval('#personalDecisionExample', e => e.textContent), /Review/);
  await click('#personalDecisionExample .ui-button--tertiary');
  await nav('hand');
  if (!await page.$eval('#handReviewSurface', e => !!e.getClientRects().length)) await click('#handCompletedReviewButton');
  await click('#handReviewAnalyze');
  assert.equal(await page.$eval('#toggleTeacher', e => e.getAttribute('aria-expanded')), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'toggleTeacher');
  await shot('review-explain');
  await nav('equity');
  await page.evaluate(() => { resetEquityCalculator(); app.equity.dead = ['2c']; });
  await click('#equityRandomizeButton');
  await page.waitForFunction(() => app.equity.players[0].cards.length === 2);
  const hands = await page.evaluate(() => structuredClone(app.equity.players));
  for (const target of ['flop', 'turn', 'river', 'board']) {
    await click(target === 'board' ? '#equityRandomizeBoard' : `.equity-board-random-actions [data-equity-randomize-target="${target}"]`);
    await page.waitForFunction(() => !app.equity.randomizationPending);
    const state = await page.evaluate(() => ({ players: app.equity.players, board: app.equity.board, dead: app.equity.dead, result: app.equity.result }));
    assert.deepEqual(state.players, hands); assert.deepEqual(state.dead, ['2c']);
    assert.equal(state.board.length, { flop: 3, turn: 4, river: 5, board: 5 }[target]);
    const cards = [...state.players.flatMap(p => p.cards), ...state.board, ...state.dead]; assert.equal(new Set(cards).size, cards.length);
  }
  const board = await page.evaluate(() => [...app.equity.board]);
  await click('#equityRandomizeButton'); await page.waitForFunction(() => !app.equity.randomizationPending);
  assert.deepEqual(await page.evaluate(() => app.equity.board), board);
  await shot('equity');
  for (const theme of ['midnight', 'daylight']) for (const lang of ['en', 'ru', 'he']) {
    await page.evaluate((theme, lang) => { RiverlinePresentationTheme.apply(theme); setLanguage(lang); }, theme, lang);
    for (const route of ['home', 'analyze', 'training', 'personal-strategy', 'equity']) {
      await nav(route); await shot(`${route}-${theme}-${lang}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${theme} ${lang} fit`);
    }
    await nav('personal-strategy'); await click('#calibrationMatrixTab'); await shot(`matrix-${theme}-${lang}`);
    await click('#calibrationUnderstandingTab');
  }
  assert.ok(findings.every(f => !f.overlaps.length && !f.dealerOverlaps.length && !f.overflow), JSON.stringify(findings.filter(f => f.overlaps.length || f.dealerOverlaps.length || f.overflow)));

  assert.equal(runtime.diagnostics.filter(d => d.kind !== 'console-warn').length, 0, JSON.stringify(runtime.diagnostics));
  completed = true;
  console.log(JSON.stringify({ status: 'passed', browser: await runtime.browser.version(), geometryChecks: findings.length,
    surfaces: ['Home', 'Analyze', 'Hand', 'Review', 'Training', 'Personal Strategy', 'Equity'], languages: ['en', 'ru', 'he'], themes: ['midnight', 'daylight'], artifacts: out }));
} finally {
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ completed, findings, diagnostics: runtime.diagnostics }, null, 2));
  await runtime.close();
}
