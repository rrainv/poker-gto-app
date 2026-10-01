#!/usr/bin/env node
// HOMEGAME-LEDGER-INPUT-001 targeted Firefox check. Disposable profile, Guest only,
// real keyboard input; reproduces PRODUCT-QA-SWEEP-2026-10 steps for QA-SWEEP-001/002/023.
// Automated evidence only; it is not human acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBrowserRuntime, settle } from './browser-runtime.mjs';

const shots = await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-homegame-ledger-input001-'));
const runtime = await createBrowserRuntime({ port: process.env.RIVERLINE_BROWSER_PORT ?? 0 });
const { page, check } = runtime;

const seat = (field, playerId, part = 'input') => `[data-home-game-control="${field}:${playerId}:${part}"]`;
const shown = (selector) => page.$eval(selector, (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
const t = (key) => page.evaluate((value) => window.t(value), key);
const ledger = () => page.evaluate(async () => {
  const state = await window.RiverlineHomeGame.load();
  return state.current && {
    sessionId: state.current.session.sessionId,
    transactions: state.current.transactions.map((entry) => ({ type: entry.type, playerId: entry.playerId, amountMinor: entry.amountMinor })),
    statuses: state.current.session.participants.map((entry) => entry.status),
    playerIds: state.current.session.participants.map((entry) => entry.playerId),
    revision: state.current.session.revision,
  };
});
async function inlineError(selector) {
  return page.$eval(selector, (input) => {
    const node = document.getElementById(input.getAttribute('aria-describedby') || '');
    return node && node.getClientRects().length ? { text: node.textContent, role: node.getAttribute('role'), invalid: input.getAttribute('aria-invalid') } : null;
  });
}
async function typeInto(selector, text) {
  await page.click(selector, { count: 3 });
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text);
  await settle(page);
}
async function openHomeGame(language) {
  await page.goto(runtime.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineAuthentication && window.RiverlineHomeGame);
  await page.evaluate(() => window.RiverlineAuthentication.ready());
  if (await page.$eval('#welcomeOrientation', (node) => node.getClientRects().length > 0).catch(() => false)) {
    await page.click('[data-welcome-destination="home"]');
  }
  await page.evaluate((value) => window.setLanguage(value), language);
  await page.waitForFunction((value) => document.documentElement.lang === value, {}, language);
  await page.click('.mode-nav-item[data-navigation-id="home-game"]');
  await page.waitForFunction(() => document.querySelector('#homeGameWorkspace').getAttribute('aria-busy') === 'false');
  for (const skip of await page.$$('.tutorial-offer button')) {
    if (await skip.evaluate((node) => node.getClientRects().length && /Skip|Пропустить|דילוג/.test(node.textContent))) await skip.click();
  }
  await settle(page);
}

const report = [];
const scrollState = () => page.evaluate(() => [...new Set([document.scrollingElement, ...document.querySelectorAll('*')])]
  .filter((node) => node.scrollTop > 0).map((node) => node.scrollTop));
try {
  for (const [language, viewport] of [['en', { width: 1920, height: 1080 }], ['he', { width: 1366, height: 768 }]]) {
    let ids;
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await check(`${language}: Guest truth and no dead account-only controls`, async () => {
      await openHomeGame(language);
      assert.equal(await page.$eval('#homeGamePersistenceNotice', (node) => node.textContent),
        await t('Guest sessions are not kept after reload. Sign in before starting a game you want to keep.'));
      for (const selector of ['#homeGameAccountRoster', '#homeGameRosterPlayer', '#homeGameRosterGroup', '#homeGameSaveGroup', '#homeGameGroupName', '#homeGameShowArchivedGroups', '#homeGameShowArchivedSessions', '#homeGameNewGroup', '#homeGameNewPlayer']) {
        assert.equal(await shown(selector), false, `${selector} is visible for Guest`);
      }
      assert.equal(await shown('#homeGamePlayerNames'), true);
      assert.equal(await page.$eval('#homeGameGroups', (node) => node.textContent.trim()), await t('Guest games have no durable player or group library.'));
      assert.equal(await page.$eval('#settingsAccountDescription', (node) => node.textContent),
        await t('Your learning workspace is saved on this device. Guest Home Game sessions are not kept after reload.'));
      await page.screenshot({ path: path.join(shots, `${language}-01-guest-entry.png`) });
    });

    await check(`${language}: start session; Enter submits a seat field and keeps focus`, async () => {
      await typeInto('#homeGameSessionTitle', 'Friday QA game');
      await page.click('#homeGamePlayerNames');
      await page.keyboard.type('Ann\nBen\nCy');
      await typeInto('#homeGameSmallBlind', '1');
      await typeInto('#homeGameBigBlind', '2');
      await typeInto('#homeGameInitialBuyIn', '100');
      await page.click('#homeGameCreateButton');
      await page.waitForFunction(() => document.querySelector('[data-home-game-control^="cash_out:"]'));
      await settle(page);
      ids = (await ledger()).playerIds;
      await typeInto(seat('money_in', ids[0]), '50');
      await page.keyboard.press('Enter');
      await page.waitForFunction((selector) => document.activeElement?.matches(selector) && document.querySelector('#homeGameWorkspace').getAttribute('aria-busy') === 'false', {}, seat('money_in', ids[0]));
      const state = await ledger();
      assert.deepEqual(state.transactions.at(-1), { type: 'rebuy', playerId: ids[0], amountMinor: 5_000 });
      assert.equal(await page.$eval(seat('money_in', ids[0]), (node) => node.value), '');
    });

    await check(`${language}: typed amount in another seat survives an action (QA-SWEEP-002)`, async () => {
      await typeInto(seat('money_in', ids[1]), '40');
      await typeInto(seat('add_on', ids[2]), '7.5');
      await page.$eval(seat('cash_out', ids[0]), (node) => node.scrollIntoView({ block: 'center' }));
      await settle(page);
      await typeInto(seat('cash_out', ids[0]), '180');
      // Leave the page meaningfully scrolled, then act without any scroll-into-view.
      await page.evaluate(() => window.scrollBy(0, 400));
      await settle(page);
      const scrollBefore = await scrollState();
      const maxScroll = await page.evaluate(() => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight);
      assert.ok(Math.max(0, ...scrollBefore) >= Math.min(150, maxScroll) && maxScroll > 0, `page did not scroll: ${scrollBefore} of ${maxScroll}`);
      await page.$eval(seat('cash_out', ids[0], 'submit'), (node) => node.click());
      await page.waitForFunction((selector) => !document.querySelector(selector), {}, seat('cash_out', ids[0]));
      await settle(page);
      const scrollAfter = await scrollState();
      assert.deepEqual(scrollAfter, scrollBefore, 'scroll position moved');
      assert.equal(await page.$eval(seat('money_in', ids[1]), (node) => node.value), '40');
      assert.equal(await page.$eval(seat('add_on', ids[2]), (node) => node.value), '7.5');
      await page.screenshot({ path: path.join(shots, `${language}-02-draft-survives.png`) });
      report.push({ language, viewport, maxScroll, scrollBefore, scrollAfter });
    });

    await check(`${language}: empty and invalid Cash out record nothing (QA-SWEEP-001)`, async () => {
      const before = await ledger();
      await typeInto(seat('cash_out', ids[2]), '');
      await page.click(seat('cash_out', ids[2], 'submit'));
      await settle(page);
      assert.deepEqual(await inlineError(seat('cash_out', ids[2])), { text: await t('Enter an amount.'), role: 'alert', invalid: 'true' });
      await page.screenshot({ path: path.join(shots, `${language}-03-empty-cash-out.png`) });
      await page.focus(seat('cash_out', ids[2]));
      await page.keyboard.type('abc');
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal((await inlineError(seat('cash_out', ids[2]))).text, await t('Enter a valid amount.'));
      await typeInto(seat('chips', ids[2]), '');
      await page.click(seat('chips', ids[2], 'submit'));
      await settle(page);
      assert.equal((await inlineError(seat('chips', ids[2]))).text, await t('Enter a whole chip count.'));
      assert.equal(await page.$eval('#homeGameError', (node) => node.hidden), true);
      const after = await ledger();
      assert.deepEqual(after, before, 'the ledger or seat state changed');
      assert.equal(after.statuses[2], 'active');
      assert.equal(await page.$eval(seat('money_in', ids[1]), (node) => node.value), '40');
    });

    await check(`${language}: typed 0 cash-out finalizes the seat`, async () => {
      const before = await ledger();
      await typeInto(seat('cash_out', ids[2]), '0');
      await page.keyboard.press('Enter');
      await page.waitForFunction((selector) => !document.querySelector(selector), {}, seat('cash_out', ids[2]));
      const after = await ledger();
      assert.equal(after.statuses[2], 'cashed_out');
      assert.deepEqual(after.transactions, before.transactions, 'zero cash-out adds no ledger row (v1 rule)');
      assert.equal(await page.$eval(seat('money_in', ids[1]), (node) => node.value), '40');
    });

    await check(`${language}: correction replacement validates inline; chooser has no dead Save`, async () => {
      const before = await ledger();
      const correct = await page.$$('#homeGameSession .home-game-session-actions button');
      for (const button of correct) if (await button.evaluate((node, label) => node.textContent === label, await t('Correct entries'))) await button.click();
      await page.waitForFunction(() => document.querySelector('#homeGameEditorDialog').open);
      await settle(page);
      assert.equal(await shown('#homeGameEditorSubmit'), false);
      const entries = await page.$$('#homeGameEditorBody .home-game-correction-entry');
      await entries.at(-1).click();
      await page.waitForFunction(() => document.querySelector('#homeGameCorrectionReplacement'));
      await typeInto('#homeGameCorrectionReplacement', '0');
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal(await page.$eval('#homeGameEditorDialog', (node) => node.open), true);
      assert.equal((await inlineError('#homeGameCorrectionReplacement')).text,
        await t('Enter an amount greater than zero, or leave it empty to only reverse the entry.'));
      await page.screenshot({ path: path.join(shots, `${language}-04-replacement-zero.png`) });
      await page.click('#homeGameEditorDialog [data-home-game-close]');
      await settle(page);
      assert.deepEqual(await ledger(), before);
    });

    await check(`${language}: Guest session is gone after reload`, async () => {
      await openHomeGame(language);
      assert.equal(await ledger(), null);
      assert.equal(await page.$eval('#homeGameRecent', (node) => node.textContent.trim()), await t('No sessions yet.'));
    });
  }
  console.log(JSON.stringify({ screenshots: shots, report }, null, 2));
} finally {
  await runtime.close();
}
