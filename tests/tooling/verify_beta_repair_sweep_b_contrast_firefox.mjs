// Rendered CSS regression probes, plus real Home/Explain text. Start the web server first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { default: puppeteer } = await import(process.env.RIVERLINE_PUPPETEER_MODULE || 'puppeteer');
const browser = await puppeteer.launch({ browser: 'firefox', headless: true,
  executablePath: process.env.FIREFOX_PATH || 'C:/Program Files/Mozilla Firefox/firefox.exe' });
const artifact = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'riverline-beta-b-contrast-')), 'report.json');
const checks = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'load' });
  await page.click('[data-welcome-destination="home"]');
  await page.waitForFunction(() => RiverlinePresentationTheme && document.querySelector('#homeWorkspace').getAttribute('aria-busy') === 'false');
  await page.click('.mode-nav-item[data-navigation-id="analyze"]');
  await page.evaluate(async () => { await randomizeCurrentAnalyzeScenario('spot'); });
  await page.click('#toggleTeacher');
  // Probes use production classes and inherit their actual workspace roles.
  await page.evaluate(() => {
    const add = (parent, html) => {
      const host = document.createElement('div'); host.dataset.contrastProbe = 'true';
      host.innerHTML = html; document.querySelector(parent).append(host);
    };
    add('#equityMode .equity-player-panel', `
      <div class="equity-readiness" data-state="blocked">Blocked</div>
      <div class="equity-readiness" data-state="warning">Warning</div>
      <div class="equity-presets"><button class="is-active">6</button></div>
      <button class="ui-button" disabled>Unavailable</button>`);
    add('#equityMode .equity-dossier-panel', `
      <div class="equity-analysis-equity"><strong>52%</strong></div>
      <section class="advanced-equity">
        <div class="advanced-equity-value"><strong>52%</strong></div>
        <p class="study-warning">Conditional known mass</p>
        <div class="advanced-equity-runout-results"><button class="runout-card" aria-pressed="true"><strong>52%</strong><small>Result</small></button></div>
      </section>`);
    window.betaBContrast = (selector, property = 'color') => [...document.querySelectorAll(selector)].map(element => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const chain = []; for (let e = element; e; e = e.parentElement) chain.unshift(e);
      ctx.fillStyle = 'white'; ctx.fillRect(0,0,1,1);
      for (const e of chain) { ctx.fillStyle = getComputedStyle(e).backgroundColor; ctx.fillRect(0,0,1,1); }
      const background = [...ctx.getImageData(0,0,1,1).data].slice(0,3);
      ctx.globalAlpha = chain.reduce((value, e) => value * Number(getComputedStyle(e).opacity), 1);
      ctx.fillStyle = getComputedStyle(element)[property]; ctx.fillRect(0,0,1,1);
      const foreground = [...ctx.getImageData(0,0,1,1).data].slice(0,3);
      const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s,v,i) => s + v * [.2126,.7152,.0722][i],0);
      const a = luminance(background), b = luminance(foreground);
      return { selector, property, minimum: property === 'color' ? 4.5 : 3, text: element.textContent.slice(0,60), foreground, background, ratio: (Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
    });
  });
  for (const surface of [null, 'daylight', '#000000', '#ffffff', '#777777', '#aa5500', '#3366aa', '#ee22dd']) {
    await page.evaluate(surface => {
      const c = RiverlinePresentationTheme; c.apply(surface === 'daylight' ? 'daylight' : 'midnight');
      if (surface?.startsWith('#')) { c.customize({ surface, accent: '#ffffff', felt: '#cca955' }); c.saveAsNew(`Contrast ${surface}`); }
    }, surface);
    await page.evaluate(async () => {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await Promise.race([
        Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)),
        new Promise(r => setTimeout(r, 600)),
      ]);
    });
    const selectors = [
      '#homeGuestAccountSecondary', '.mode-nav-item > span',
      '#teacherContent .analysis-fact-primary', '#teacherContent .analysis-fact-secondary',
      '#teacherContent .analysis-outs-summary', '#teacherContent .analysis-reasoning-block',
      '[data-contrast-probe] .equity-readiness', '[data-contrast-probe] .is-active',
      '[data-contrast-probe] .ui-button:disabled',
      '[data-contrast-probe] .equity-analysis-equity > strong',
      '[data-contrast-probe] .advanced-equity-value > strong',
      '[data-contrast-probe] .study-warning', '[data-contrast-probe] .runout-card strong',
      '[data-contrast-probe] .runout-card small',
    ];
    const pairs = await page.evaluate(selectors => [
      ...selectors.flatMap(selector => betaBContrast(selector)),
      ...betaBContrast('[data-contrast-probe] .runout-card', 'outlineColor'),
    ], selectors);
    checks.push({ surface, pairs });
  }
  fs.writeFileSync(artifact, JSON.stringify(checks, null, 2));
  const failures = checks.flatMap(check => check.pairs.filter(pair => pair.ratio < pair.minimum).map(pair => ({ surface: check.surface, ...pair })));
  console.log(JSON.stringify({ artifact, pairs: checks.reduce((n,c) => n+c.pairs.length,0), failureCount: failures.length, failures: failures.slice(0, 12) }, null, 2));
  assert.equal(failures.length, 0);
} finally { await browser.close(); }
