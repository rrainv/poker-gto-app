#!/usr/bin/env node
// LANGUAGE-SWITCH-EVENT-001 targeted Firefox check (1920x1080 and 1366x768).
// Disposable profile, Guest only. A language switch EN → RU → HE → EN must not
// publish identity events, reset Saved state, change the Training source claim,
// or close Explain/inputs. Automated evidence only; not human visual acceptance.
import assert from 'node:assert/strict';
import { createBrowserRuntime, settle } from './browser-runtime.mjs';

const runtime = await createBrowserRuntime({ port: process.env.RIVERLINE_BROWSER_PORT ?? 0 });
const { page, check } = runtime;
const report = [];
const LANGUAGES = ['ru', 'he', 'en'];

await page.evaluateOnNewDocument(() => {
  // Audit-only: reduced motion shortens Full Hand presentation pacing.
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => (/prefers-reduced-motion:\s*reduce/.test(query)
    ? { matches: true, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    : matchMedia(query));
  window.__identityEvents = { authchange: 0, identitychange: 0 };
  addEventListener('riverline:authchange', () => { window.__identityEvents.authchange += 1; });
  addEventListener('riverline:identitychange', () => { window.__identityEvents.identitychange += 1; });
});

const visible = (selector) => page.$eval(selector, (node) => node.getClientRects().length > 0 && !node.closest('[hidden]'))
  .catch(() => false);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(runtime.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.RiverlineAuthentication && window.RiverlinePlaybookState);
  await page.evaluate(() => window.RiverlineAuthentication.ready());
  if (await visible('#welcomeOrientation')) await page.click('[data-welcome-destination="home"]');
  await page.evaluate(() => window.setLanguage('en'));
  await settle(page);
}

async function navigate(id) {
  await page.click(`.mode-nav-item[data-navigation-id="${id}"]`);
  await page.waitForFunction((value) => document.querySelector('.riverline-shell').dataset.activeDestination === value, {}, id);
  for (const skip of await page.$$('.tutorial-offer button')) {
    if (await skip.evaluate((node) => node.getClientRects().length && /Skip|Пропустить|דילוג/.test(node.textContent))) await skip.click();
  }
  await settle(page);
}

async function switchLanguages(readState) {
  const states = [];
  const events = await page.evaluate(() => ({ ...window.__identityEvents }));
  for (const language of LANGUAGES) {
    await page.evaluate((value) => window.setLanguage(value), language);
    await page.waitForFunction((value) => document.documentElement.lang === value, {}, language);
    await settle(page);
    states.push({ language, ...(await readState()) });
  }
  const after = await page.evaluate(() => ({ ...window.__identityEvents }));
  assert.deepEqual(after, events, 'language switch published an identity/auth event');
  return states;
}

async function playFullHandToTerminal() {
  await page.click('[data-training-session-mode="full_hand"]'); await settle(page);
  await page.click('#trainingNewHand');
  for (let step = 0; step < 1200; step += 1) {
    const status = await page.evaluate(() => app.training.fullHandSnapshot?.status);
    if (status === 'terminal') return;
    if (status === 'hero_complete') throw Error('Hero folded unexpectedly');
    const action = await page.evaluate(() => ['check', 'call'].find((type) => {
      const button = document.querySelector(`#trainingGuessButtons button[data-action="${type}"]`);
      return button && !button.disabled && button.getClientRects().length > 0;
    }) || null);
    if (action && await page.evaluate(() => app.training.lifecycle === 'ready')) {
      await page.click(`#trainingGuessButtons button[data-action="${action}"]`);
    }
    await pause(250);
  }
  throw Error(`Full Hand did not reach terminal: ${await page.evaluate(() => app.training.fullHandSnapshot?.status)}`);
}

try {
for (const [width, height] of [[1920, 1080], [1366, 768]]) {
  // Playing the Hand is setup (paced presentation), outside the 45 s flow budget.
  await open(width, height);
  await navigate('training');
  await playFullHandToTerminal();
  await check(`Training Full Hand source claim stays across EN → RU → HE → EN at ${width}`, async () => {
    await page.click('#trainingReviewHand');
    await page.waitForFunction(() => document.querySelector('#trainingWorkspace').dataset.trainingFullHandPhase === 'review');
    await settle(page);
    const read = () => page.evaluate(() => ({
      badge: document.querySelector('#trainingStrategySource').textContent.trim(),
      badgeKey: document.querySelector('#trainingStrategySource').dataset.i18n,
      value: document.querySelector('#trainingReferenceSummaryValue').textContent.trim(),
      note: document.querySelector('#trainingReferenceSummaryNote').textContent.trim(),
      phase: document.querySelector('#trainingWorkspace').dataset.trainingFullHandPhase,
      reviewSourceBadge: document.querySelector('#handReviewSourceBadge')?.textContent.trim(),
      unavailable: window.t('Source unavailable'),
    }));
    const before = await read();
    assert.notEqual(before.badge, before.unavailable);
    const states = await switchLanguages(read);
    for (const state of states) {
      const expected = await page.evaluate((key) => window.t(key), before.badgeKey);
      assert.notEqual(state.badge, state.unavailable, `${state.language}: Source unavailable`);
      assert.equal(state.badgeKey, before.badgeKey, `${state.language}: badge claim changed`);
      assert.equal(state.phase, 'review', `${state.language}: review closed`);
      report.push({ width, surface: 'training', ...state, expectedFinal: expected });
    }
    const final = states.at(-1);
    assert.equal(final.badge, before.badge);
    assert.equal(final.value, before.value);
    assert.equal(final.note, before.note);
  });

  await check(`Saved search, filters, sort and toggle survive EN → RU → HE → EN at ${width}`, async () => {
    await open(width, height);
    await navigate('saved');
    await page.waitForSelector('[data-saved-library-search]', { visible: true });
    await page.type('[data-saved-library-search]', 'river');
    await page.select('[data-saved-library-review]', 'review_later');
    await page.select('[data-saved-library-sort]', 'created');
    await settle(page);
    await page.click('[data-saved-view-option][value="training"]').catch(async () => {
      const options = await page.$$eval('[data-saved-view-option]', (nodes) => nodes.map((node) => node.value));
      throw Error(`Training history option missing: ${options}`);
    });
    await settle(page);
    const read = () => page.evaluate(() => ({
      view: document.querySelector('[data-saved-view-option]:checked')?.value,
      search: document.querySelector('[data-saved-library-search]')?.value,
      review: document.querySelector('[data-saved-library-review]')?.value,
      sort: document.querySelector('[data-saved-library-sort]')?.value,
      sortLabel: document.querySelector('[data-saved-library-sort]')?.selectedOptions[0]?.textContent,
    }));
    const before = await read();
    assert.equal(before.view, 'training');
    for (const state of await switchLanguages(read)) {
      assert.equal(state.view, 'training', `${state.language}: toggle reset`);
      assert.equal(state.search, 'river', `${state.language}: search reset`);
      assert.equal(state.review, 'review_later', `${state.language}: filter reset`);
      assert.equal(state.sort, 'created', `${state.language}: sort reset`);
      report.push({ width, surface: 'saved', ...state });
    }
    // Returning to Saved items in RU shows translated controls with the same query.
    await page.evaluate(() => window.setLanguage('ru')); await settle(page);
    await page.click('[data-saved-view-option][value="items"]'); await settle(page);
    const items = await read();
    assert.equal(items.search, 'river');
    assert.equal(items.review, 'review_later');
    assert.equal(items.sortLabel, await page.evaluate(() => window.t('Recently created')));
    report.push({ width, surface: 'saved-items-ru', ...items });
  });

  await check(`Analyze Explain, inputs and PERF-001 counts survive EN → RU → HE → EN at ${width}`, async () => {
    await open(width, height);
    await navigate('analyze');
    await page.click('#scenarioRandomizeButton');
    await page.waitForFunction(() => app.strategyResult && !document.querySelector('#analysisInputState').getClientRects().length);
    await settle(page);
    if (await page.$eval('#toggleTeacher', (node) => node.getAttribute('aria-expanded') !== 'true')) await page.click('#toggleTeacher');
    await settle(page);
    const counters = await page.evaluate(() => {
      window.__perf = { strategy: 0, equity: 0, instrumented: [] };
      try {
        const resolve = strategyProvider.resolve.bind(strategyProvider);
        strategyProvider.resolve = (...args) => { window.__perf.strategy += 1; return resolve(...args); };
        window.__perf.instrumented.push('strategy');
      } catch {}
      const equity = window.RiverlineEquity;
      for (const name of Object.keys(equity || {})) {
        if (typeof equity[name] !== 'function') continue;
        try {
          const original = equity[name];
          equity[name] = (...args) => { window.__perf.equity += 1; return original(...args); };
          window.__perf.instrumented.push(`equity.${name}`);
        } catch {}
      }
      return window.__perf.instrumented;
    });
    await page.focus('#potSize').catch(() => {});
    await page.evaluate(() => window.scrollTo({ top: 240, behavior: 'instant' }));
    const read = () => page.evaluate(() => ({
      explain: document.querySelector('#toggleTeacher').getAttribute('aria-expanded'),
      pot: document.querySelector('#potSize')?.value,
      focus: document.activeElement?.id || document.activeElement?.tagName,
      scrollY: Math.round(window.scrollY),
      explainLabel: document.querySelector('#toggleTeacher strong')?.textContent,
      perf: { ...window.__perf },
    }));
    const before = await read();
    for (const state of await switchLanguages(read)) {
      assert.equal(state.explain, 'true', `${state.language}: Explain closed`);
      assert.equal(state.pot, before.pot);
      assert.equal(state.focus, before.focus, `${state.language}: focus moved`);
      assert.equal(state.perf.strategy, 0, `${state.language}: StrategyProvider invoked by language switch`);
      assert.equal(state.perf.equity, 0, `${state.language}: Equity invoked by language switch`);
      report.push({ width, surface: 'analyze', counters, ...state });
    }
  });

  await check(`Other workspaces publish no identity event on language switch at ${width}`, async () => {
    await open(width, height);
    for (const id of ['home', 'hand', 'equity', 'personal-strategy', 'home-game']) {
      await navigate(id);
      const states = await switchLanguages(() => page.evaluate(() => ({
        destination: document.querySelector('.riverline-shell').dataset.activeDestination,
        dir: document.documentElement.dir,
      })));
      for (const state of states) assert.equal(state.destination, id);
      report.push({ width, surface: id, events: 'none', dirs: states.map((state) => state.dir).join(',') });
      await page.evaluate(() => window.setLanguage('en'));
    }
  });
}

console.log(JSON.stringify(report, null, 2));
} finally {
  await runtime.close();
}
