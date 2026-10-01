#!/usr/bin/env node
// DECISION-INPUT-TRUTH-001 targeted Firefox check (EN 1920x1080, HE 1366x768).
// Disposable profile, Guest only, real keyboard input for numeric entry.
// Reproduces PRODUCT-QA-SWEEP-2026-10 items A-H. Automated evidence only; it is
// not human visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBrowserRuntime, settle } from './browser-runtime.mjs';

const shots = await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-decision-input-truth001-'));
const runtime = await createBrowserRuntime({ port: process.env.RIVERLINE_BROWSER_PORT ?? 0 });
const { page, check } = runtime;
const report = [];

const t = (key, values) => page.evaluate((k, v) => window.t(k, v), key, values || {});
const text = (selector) => page.$eval(selector, (node) => node.textContent.trim());
const visible = (selector) => page.$eval(selector, (node) => node.getClientRects().length > 0 && !node.closest('[hidden]'))
  .catch(() => false);

async function open(language) {
  await page.goto(runtime.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineAuthentication && window.RiverlinePlaybookState && window.RiverlineDecisionFacing);
  await page.evaluate(() => window.RiverlineAuthentication.ready());
  if (await page.$eval('#welcomeOrientation', (node) => node.getClientRects().length > 0).catch(() => false)) {
    await page.click('[data-welcome-destination="home"]');
  }
  await page.evaluate((value) => window.setLanguage(value), language);
  await page.waitForFunction((value) => document.documentElement.lang === value, {}, language);
  await settle(page);
}

async function navigate(id) {
  await page.click(`.mode-nav-item[data-navigation-id="${id}"]`);
  await page.waitForFunction((value) => document.querySelector(`.mode-nav-item[data-navigation-id="${value}"]`)
    ?.getAttribute('aria-current') === 'page', {}, id);
  for (const skip of await page.$$('.tutorial-offer button')) {
    if (await skip.evaluate((node) => node.getClientRects().length && /Skip|Пропустить|דילוג/.test(node.textContent))) await skip.click();
  }
  await settle(page);
}

async function typeInto(selector, value) {
  await page.$eval(selector, (node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.click(selector, { count: 3 });
  await page.keyboard.press('Backspace');
  const typed = [];
  for (const character of value) {
    await page.keyboard.type(character);
    typed.push(await page.$eval(selector, (node) => node.value));
  }
  await settle(page);
  return typed;
}

async function playbookHand(language, configuration = {}) {
  await page.evaluate(() => {
    if (window.RiverlinePlaybookState.getMode() !== 'hand') document.querySelector('#playbookHandMode').click();
  });
  await page.waitForFunction(() => window.RiverlinePlaybookState.getMode() === 'hand');
  await page.evaluate((config) => {
    const bridge = window.RiverlinePlaybookState;
    bridge.resetHand();
    bridge.initializeHand({
      tableSize: 4, gameMode: 'home', stackBb: 100, stackMode: 'hero', heroSeat: 0, buttonSeat: 0,
      anteType: 'none', anteBb: 0, straddleBb: 0, ...config,
    });
    window.renderCanonicalHandWorkspace();
  }, configuration);
  await settle(page);
}

try {
  for (const [language, viewport] of [['en', { width: 1920, height: 1080 }], ['he', { width: 1366, height: 768 }]]) {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });

    await check(`${language} A: Facing size 2.5 and Pot before action 6.5 keep every keystroke`, async () => {
      await open(language);
      await navigate('analyze');
      await page.evaluate(() => {
        if (window.RiverlinePlaybookState.getMode() !== 'scenario') document.querySelector('#playbookScenarioMode')?.click();
        app.gto.hero = ['As', 'Kd'];
        renderAllCards();
        const action = document.querySelector('#lastAction');
        action.value = 'raise';
        action.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await settle(page);
      const facing = await typeInto('#facingSizeNum', '2.5');
      const pot = await typeInto('#potSizeNum', '6.5');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => app.playbookResolution?.status === 'available'
        && app.decisionContext?.facingSizeBb === 2.5);
      const state = await page.evaluate(() => ({
        facing: document.querySelector('#facingSizeNum').value,
        facingRange: document.querySelector('#facingSize').value,
        pot: document.querySelector('#potSizeNum').value,
        snapshot: readPlaybookScenarioInput(),
      }));
      assert.equal(facing.at(-1), '2.5', `facing keystrokes ${JSON.stringify(facing)}`);
      assert.equal(pot.at(-1), '6.5', `pot keystrokes ${JSON.stringify(pot)}`);
      assert.equal(state.facing, '2.5');
      assert.equal(state.pot, '6.5');
      assert.equal(state.facingRange, '2.5');
      assert.equal(state.snapshot.facingSizeBb, 2.5);
      assert.equal(state.snapshot.potBb, 6.5);
      report.push({ language, item: 'A', facingKeystrokes: facing, potKeystrokes: pot });
      await page.screenshot({ path: path.join(shots, `${language}-A-facing-pot.png`) });
    });

    await check(`${language} B: readiness names Facing size and Edit focuses it`, async () => {
      await typeInto('#facingSizeNum', '');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => app.playbookResolution?.reason === 'scenario_not_ready');
      const expected = await t('Enter a valid Facing size.');
      await page.waitForFunction((message) => document.querySelector('#analysisInputMessage')?.textContent === message, {}, expected);
      assert.equal(await page.$eval('#facingSizeNum', (node) => node.value), '');
      assert.equal(await page.evaluate(() => app.strategyResult), null);
      await page.evaluate(() => document.querySelector('#analysisEditInputs').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.click('#analysisEditInputs');
      await settle(page);
      const focus = await page.evaluate(() => {
        const node = document.activeElement;
        const box = node.getBoundingClientRect();
        return { id: node.id, inView: box.top >= 0 && box.bottom <= innerHeight };
      });
      assert.deepEqual(focus, { id: 'facingSizeNum', inView: true });
      report.push({ language, item: 'B', message: expected, focus });
      await page.screenshot({ path: path.join(shots, `${language}-B-readiness-focus.png`) });
      await typeInto('#facingSizeNum', '3');
      await page.keyboard.press('Tab');
    });

    await check(`${language} C: unopened blind decision in Review has no "facing 0"`, async () => {
      await playbookHand(language, { tableSize: 2 });
      await page.evaluate(() => {
        const bridge = window.RiverlinePlaybookState;
        bridge.dealObservedHoleCards({ [bridge.getHeroPlayerId()]: ['As', 'Kd'] });
        bridge.applyAction('fold');
        window.renderCanonicalHandWorkspace();
      });
      await page.waitForSelector('#handCompletedReviewButton:not([hidden])');
      await page.click('#handCompletedReviewButton');
      await page.waitForFunction(() => document.querySelector('#handReviewFacing')?.textContent.trim()
        || document.querySelector('#handReviewDecisionContext')?.textContent.trim());
      await settle(page);
      const copy = await page.evaluate(() => [
        document.querySelector('#handReviewDecisionContext')?.textContent.trim(),
        document.querySelector('#handReviewFacing')?.textContent.trim(),
      ].filter(Boolean));
      const unopened = (await t('facing.detail.unopened', { price: '' })).replace(' · ', '').trim();
      assert.ok(copy.length > 0);
      for (const line of copy) {
        assert.doesNotMatch(line, /facing 0|против 0|מול 0/i, line);
        assert.ok(line.includes(unopened), `"${line}" names ${unopened}`);
      }
      report.push({ language, item: 'C-review', copy });
      await page.screenshot({ path: path.join(shots, `${language}-C-review-unopened.png`) });
      await page.evaluate(() => document.querySelector('[data-hand-review-close], #handReviewCloseButton')?.click());
    });

    await check(`${language} D: Replay shows frame facts; Return works for live and completed hands`, async () => {
      await playbookHand(language);
      await page.evaluate(() => {
        const bridge = window.RiverlinePlaybookState;
        bridge.dealObservedHoleCards({ [bridge.getHeroPlayerId()]: ['As', 'Kd'] });
        bridge.applyAction('raise', 3);
        bridge.applyAction('raise', 9);
        bridge.applyAction('fold');
        window.renderCanonicalHandWorkspace();
      });
      await settle(page);
      const strategyBefore = await page.evaluate(() => app.strategyResult);
      for (let step = 0; step < 2; step += 1) await page.click('#handReplayPreviousButton');
      await settle(page);
      const replay = await page.evaluate(() => {
        const projection = window.RiverlinePlaybookState.createReplayProjectionViewModel();
        const facts = projection.selectedStageFacts;
        const live = window.RiverlinePlaybookState.getState();
        return {
          title: document.querySelector('#handLiveStageTitle').textContent,
          pot: document.querySelector('#handLivePot').textContent,
          call: document.querySelector('#handLiveCall').textContent,
          actor: document.querySelector('#handLiveActor').textContent,
          statePot: document.querySelector('#handStatePot').textContent,
          expectedPot: formatCanonicalBb(facts.potMilliBb),
          expectedCall: formatCanonicalBb(facts.callMilliBb),
          tablePot: formatCanonicalBb(projection.tablePresence.potMilliBb),
          expectedActor: canonicalPlayerLabel(live.players.find((p) => p.playerId === facts.actingPlayerId), window.RiverlinePlaybookState.getHeroPlayerId()),
          livePot: formatCanonicalBb(live.potMilliBb),
        };
      });
      assert.equal(replay.title, await t('Reviewing earlier hand state'));
      assert.equal(replay.pot, replay.expectedPot);
      assert.equal(replay.pot, replay.tablePot, 'stage pot equals the replay table pot');
      assert.equal(replay.statePot, replay.expectedPot, 'Current hand card follows the frame');
      assert.equal(replay.call, replay.expectedCall);
      assert.equal(replay.actor, replay.expectedActor);
      assert.notEqual(replay.pot, replay.livePot);
      assert.deepEqual(await page.evaluate(() => app.strategyResult), strategyBefore, 'seek did no strategy work');
      await page.screenshot({ path: path.join(shots, `${language}-D-replay-frame.png`) });
      assert.equal(await visible('#handReplayLiveButton'), true);
      await page.click('#handReplayLiveButton');
      await settle(page);
      assert.equal(await text('#handLivePot'), replay.livePot);

      await page.evaluate(() => {
        const bridge = window.RiverlinePlaybookState;
        while (bridge.getState()?.phase === 'betting') bridge.applyAction('fold');
        window.renderCanonicalHandWorkspace();
      });
      await page.waitForSelector('#handCompletedReplayButton:not([hidden])');
      await page.click('#handCompletedReplayButton');
      await settle(page);
      await page.evaluate(() => window.RiverlinePlaybookState.pauseReplayPlayback?.());
      await settle(page);
      assert.equal(await visible('#handCompletedSection'), false, 'completion card hidden while replaying');
      assert.equal(await visible('#handReplayLiveButton'), true, 'a Return control exists for a completed hand');
      assert.equal(await text('#handReplayLiveButton'), await t('replay.control.returnToCompleted'));
      await page.screenshot({ path: path.join(shots, `${language}-D-completed-replay-return.png`) });
      await page.click('#handReplayLiveButton');
      await settle(page);
      assert.equal(await visible('#handCompletedSection'), true, 'completion card restored');
      report.push({ language, item: 'D', replay });
    });

    await check(`${language} E/F: random board status clears on commit; raise panel wording is plain`, async () => {
      await playbookHand(language, { tableSize: 2 });
      await page.evaluate(() => {
        const bridge = window.RiverlinePlaybookState;
        bridge.dealObservedHoleCards({ [bridge.getHeroPlayerId()]: ['As', 'Kd'] });
        window.renderCanonicalHandWorkspace();
      });
      await settle(page);
      await page.click('#handLegalActions [data-canonical-action="raise"]');
      await settle(page);
      const sizing = await text('#handActionSizing');
      assert.doesNotMatch(sizing, /amount-to|итоговая сумма|סכום סופי/i, sizing);
      assert.equal(await text('#handCommitSizedAction'), await t('Apply'));
      await page.screenshot({ path: path.join(shots, `${language}-F-raise-panel.png`) });
      await page.evaluate(() => {
        const bridge = window.RiverlinePlaybookState;
        bridge.applyAction('call');
        bridge.applyAction('check');
        window.renderCanonicalHandWorkspace();
      });
      await page.waitForSelector('#handRandomizeBoard:not([hidden]):not([disabled])');
      await page.click('#handRandomizeBoard');
      const ready = await t('Random {street} ready.', { street: await t('Flop') });
      await page.waitForFunction((message) => document.querySelector('#handRandomizeStatus').textContent === message, {}, ready);
      await page.click('#handDealBoardButton');
      await page.waitForFunction(() => window.RiverlinePlaybookState.getState().street === 'flop');
      await settle(page);
      assert.equal(await text('#handRandomizeStatus'), '', 'no stale ready message after commit');
      report.push({ language, item: 'E/F', sizing });
    });

    await check(`${language} G/H: Replay chip keys translate; Training hints match actions`, async () => {
      for (const key of ['replay.status.saved', 'replay.status.replay', 'replay.status.live']) {
        assert.notEqual(await t(key), key);
      }
      await navigate('training');
      // A fresh Guest session starts from Session setup's "Start Training".
      await page.$eval('#trainingNewHand', (node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForSelector('#trainingNewHand:not([disabled])');
      await page.click('#trainingNewHand');
      await page.waitForFunction(() => document.querySelectorAll('#trainingGuessButtons button').length > 0);
      await settle(page);
      const hint = await page.evaluate(() => ({
        buttons: document.querySelectorAll('#trainingGuessButtons button:not([hidden])').length,
        range: document.querySelector('#trainingShortcutRange').textContent.replace(/\s/g, ''),
        facing: document.querySelector('#trainingFacingVal').textContent,
      }));
      assert.equal(hint.range, hint.buttons > 1 ? `1-${hint.buttons}` : '1');
      assert.doesNotMatch(hint.facing, /Facing 0|против 0|מול 0/i);
      report.push({ language, item: 'G/H', hint });
      await page.screenshot({ path: path.join(shots, `${language}-H-training-hints.png`) });
    });
  }
  console.log(JSON.stringify({ screenshots: shots, report }, null, 2));
} finally {
  await runtime.close();
}
