// Start node tools/dev-web-server.mjs. Disposable Firefox profile; no remote writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.RIVERLINE_PUPPETEER_MODULE || 'puppeteer');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-visual-balance-'));
console.log(out);
const browser = await puppeteer.launch({ browser: 'firefox', headless: true, executablePath: process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe' });
const checks = [], errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  const settle = () => page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.race([Promise.allSettled(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)), new Promise(resolve => setTimeout(resolve, 600))]);
  });
  const shot = async name => { await settle(); await page.mouse.move(1, 1); await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true }); };
  const nav = async id => {
    await page.click(`.mode-nav-item[data-navigation-id="${id}"]`);
    if (id === 'home') await page.waitForFunction(() => document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
    if (id === 'personal-strategy') await page.waitForFunction(() => ['empty', 'configured', 'guest'].includes(document.querySelector('#rangeCalibrationWorkspace').dataset.calibrationState));
    await settle();
    for (const skip of await page.$$('.tutorial-offer button')) if (await skip.evaluate(e => e.getClientRects().length && /Skip/.test(e.textContent))) await skip.click();
    await page.evaluate(() => scrollTo(0, 0));
  };
  const fit = async name => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: horizontal fit`);
  };
  const mapChecks = async name => {
    const result = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.personal-hand-map button')];
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d'); canvas.width = canvas.height = 1;
      const rgba = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
      const background = element => {
        const own = rgba(getComputedStyle(element).backgroundColor);
        const parent = element.parentElement ? background(element.parentElement) : [255, 255, 255];
        return own.slice(0, 3).map((v, i) => v * own[3] / 255 + parent[i] * (1 - own[3] / 255));
      };
      const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const ratios = buttons.map(e => { const values = [luminance(rgba(getComputedStyle(e).color)), luminance(background(e))].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); });
      return { cells: buttons.length, columns: getComputedStyle(buttons[0].parentElement).gridTemplateColumns.split(' ').length,
        minWidth: Math.min(...buttons.map(e => e.getBoundingClientRect().width)), minHeight: Math.min(...buttons.map(e => e.getBoundingClientRect().height)),
        minContrast: Math.min(...ratios), tabStops: buttons.filter(e => e.tabIndex === 0).length,
        labelsFit: buttons.every(e => e.firstElementChild.scrollWidth <= e.clientWidth),
        current: buttons.filter(e => e.getAttribute('aria-current') === 'true').map(e => e.dataset.mapHand) };
    });
    assert.equal(result.cells, 169); assert.equal(result.columns, 13); assert.equal(result.tabStops, 1);
    assert.ok(result.labelsFit); assert.ok(result.minWidth >= 24); assert.ok(result.minContrast >= 4.5, `${name}: contrast ${result.minContrast}`);
    checks.push({ name, ...result }); return result;
  };
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.RiverlineWelcome && window.RiverlinePresentationTheme);
  await page.evaluate(() => setLanguage('en'));
  await page.click('[data-welcome-destination="home"]');
  await nav('personal-strategy');
  await page.click('#calibrationCreateFirstProfile'); await page.type('#calibrationProfileDisplayName', 'Visual balance QA'); await page.click('#calibrationProfileSubmit');
  await page.waitForFunction(() => document.querySelectorAll('.personal-hand-map button').length === 169);
  await page.waitForFunction(() => RiverlineRangeCalibration.getState().calibrationState?.prompt);
  const taught = await page.evaluate(() => RiverlineRangeCalibration.getState().calibrationState.prompt.handClass);
  await page.click('[data-calibration-action="raise"]');
  await page.waitForFunction(hand => document.querySelector('.personal-hand-map [aria-current="true"]')?.dataset.mapHand === hand && document.querySelector('.personal-hand-map [data-coverage-state="directly_known"]'), {}, taught);
  await page.waitForFunction(() => !document.querySelector('#personalTeacherLearning').hidden);
  await page.click('#personalTeacherLearning button');
  await page.waitForFunction(() => document.querySelector('.personal-hand-map [aria-current="true"]')?.dataset.mapHand === RiverlineRangeCalibration.getState().calibrationState.prompt.handClass);
  if (!process.env.RIVERLINE_VISUAL_POINTER_ONLY) for (const theme of ['midnight', 'daylight', 'custom']) {
    await page.evaluate(theme => { const c = RiverlinePresentationTheme; if (theme === 'custom') { c.apply('midnight'); c.customize({ surface: '#777777', accent: '#e33685', felt: '#335544' }); c.saveAsNew('Visual balance QA'); } else c.apply(theme); }, theme);
    for (const width of [1920, 1366]) {
      await page.setViewport({ width, height: width === 1920 ? 1080 : 768 });
      const name = `${theme}-${width}`;
      for (const route of ['home', 'guide']) { await nav(route); await fit(route); await shot(`${name}-${route}`); }
      await nav('personal-strategy');
      if (await page.$eval('#calibrationQuestionView', e => e.hidden)) { await page.focus('.personal-hand-map [data-coverage-state="unknown"]'); await page.keyboard.press('Enter'); }
      try { await page.waitForFunction(() => RiverlineRangeCalibration.getState().calibrationState?.prompt && document.querySelector('.personal-hand-map [aria-current="true"]')?.dataset.mapHand === RiverlineRangeCalibration.getState().calibrationState.prompt.handClass); }
      catch (error) { await shot(`${name}-failure`); console.log(await page.evaluate(() => ({ prompt: RiverlineRangeCalibration.getState().calibrationState?.prompt, current: document.querySelector('.personal-hand-map [aria-current="true"]')?.dataset.mapHand, session: document.querySelector('#rangeCalibrationWorkspace').dataset.sessionView, errors: [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent) }))); throw error; }
      await fit('personal-active'); const active = await mapChecks(`${name}-active`); assert.equal(active.current.length, 1);
      await page.evaluate(() => scrollTo(0, 0)); await shot(`${name}-active`);
      await page.focus('.personal-hand-map button'); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.personal-hand-map button')].indexOf(document.activeElement)), 13);
      assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
      await shot(`${name}-focus`);
      await page.click('#calibrationPauseQuestions');
      await page.waitForFunction(() => document.querySelector('#calibrationQuestionView').hidden && !document.querySelector('.personal-hand-map [aria-current="true"]'));
      await fit('understanding'); await mapChecks(`${name}-understanding`); await page.evaluate(() => scrollTo(0, 0)); await shot(`${name}-understanding`);
      // Presentation-only fixture makes rare statuses and exact precision reviewable; never persisted.
      await page.evaluate(async () => {
        const { renderPersonalStrategyMap } = await import('/src/application/personal-strategy-understanding-workspace.mjs');
        const { PREFLOP_HAND_CLASSES } = await import('/shared/poker-domain/index.js');
        const states = ['directly_known', 'directly_known', 'inferred_high', 'inferred_medium', 'uncertain', 'transferred', 'conflicting'];
        const cells = PREFLOP_HAND_CLASSES.map((handClass, i) => ({ handClass, status: states[i] || 'unknown', action: { precision: i === 1 ? 'exact_mix' : 'dominant_only' } }));
        window.visualBalanceMapNodes = [...document.querySelector('#personalStrategyMap').childNodes];
        renderPersonalStrategyMap(document.querySelector('#personalStrategyMap'), cells, key => key, { currentHand: 'AA', onInspect() {}, onTeach() {} });
      });
      await mapChecks(`${name}-evidence-fixture`); await shot(`${name}-evidence-fixture`);
      await page.evaluate(() => { document.querySelector('#personalStrategyMap').replaceChildren(...window.visualBalanceMapNodes); delete window.visualBalanceMapNodes; });
      await nav('home'); await nav('personal-strategy');
    }
  }
  await page.setViewport({ width: 1366, height: 768 });
  await nav('personal-strategy');
  const knownSelector = '.personal-hand-map [data-coverage-state="directly_known"]';
  const known = await page.$eval(knownSelector, e => { e.scrollIntoView({ block: 'center' }); return e.dataset.mapHand; });
  await settle(); await page.hover(knownSelector);
  assert.equal(await page.$eval(knownSelector, e => getComputedStyle(e).outlineStyle), 'solid');
  await page.screenshot({ path: path.join(out, 'pointer-hover-1366.png') });
  await page.click(knownSelector);
  await page.waitForFunction(hand => RiverlineRangeCalibration.getState().matrixSelectedHand === hand && document.querySelector('#rangeCalibrationWorkspace').dataset.personalView === 'matrix', {}, known);
  await page.$eval('#calibrationUnderstandingTab', e => e.scrollIntoView({ block: 'center' }));
  await settle(); await page.click('#calibrationUnderstandingTab');
  await page.waitForFunction(() => document.querySelector('#rangeCalibrationWorkspace').dataset.personalView === 'understanding' && document.querySelector('.personal-hand-map button')?.getClientRects().length);
  const unknownSelector = '.personal-hand-map [data-coverage-state="unknown"]';
  const unknown = await page.$eval(unknownSelector, e => { e.scrollIntoView({ block: 'center' }); return e.dataset.mapHand; });
  await settle(); await page.click(unknownSelector);
  await page.waitForFunction(hand => RiverlineRangeCalibration.getState().calibrationState?.prompt?.handClass === hand && document.querySelector('.personal-hand-map [aria-current="true"]')?.dataset.mapHand === hand, {}, unknown);
  checks.push({ pointerInspection: known, pointerTeaching: unknown, hover: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ out, checks: checks.length, errors }));
} finally { await browser.close(); }
