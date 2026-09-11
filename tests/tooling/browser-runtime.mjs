// Shared by current browser smoke and available to targeted historical verifiers.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startDevWebServer } from '../../tools/dev-web-server.mjs';

export async function launchFirefox() {
  const module = process.env.RIVERLINE_PUPPETEER_MODULE;
  const { default: puppeteer } = await import(module && path.isAbsolute(module) ? pathToFileURL(module).href : module || 'puppeteer-core');
  const executablePath = process.env.FIREFOX_PATH || ({ win32: 'C:/Program Files/Mozilla Firefox/firefox.exe', linux: '/usr/bin/firefox', darwin: '/Applications/Firefox.app/Contents/MacOS/firefox' })[process.platform];
  await fs.access(executablePath).catch(() => { throw Error(`Firefox not found at ${executablePath}. Set FIREFOX_PATH to an installed Firefox executable.`); });
  // Puppeteer creates and removes its own temporary profile; never pass a user profile.
  return puppeteer.launch({ browser: 'firefox', executablePath, headless: true, timeout: 30000, protocolTimeout: 20000 });
}

export async function settle(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.race([Promise.allSettled(document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)), new Promise(resolve => setTimeout(resolve, 600))]);
  });
}

export async function createBrowserRuntime({ port = process.env.RIVERLINE_BROWSER_PORT ?? 3000, launch = launchFirefox } = {}) {
  // Reuse the production dev-server implementation in-process. Never adopt/kill an unknown server.
  const server = await startDevWebServer({ port }).catch(error => { throw Error(`Cannot own browser smoke server on port ${port}: ${error.message}. Stop the existing server or set RIVERLINE_BROWSER_PORT=0 for an isolated OS-assigned port.`); });
  let browser, closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    try { await browser?.close(); } finally { server.server.closeAllConnections(); await server.close(); }
  };
  try {
    browser = await launch();
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.setDefaultNavigationTimeout(30000);
    const diagnostics = [], checks = [];
    const record = (kind, message) => diagnostics.push({ kind, message, flow: currentFlow });
    let currentFlow = 'startup', artifactDirectory;
    page.on('pageerror', error => record('pageerror', String(error)));
    page.on('console', message => { if (['error', 'warn'].includes(message.type())) record(`console-${message.type()}`, message.text()); });
    page.on('requestfailed', request => {
      if (['document', 'script', 'stylesheet', 'image', 'font'].includes(request.resourceType())) record('asset', `${request.url()} ${request.failure()?.errorText}`);
    });
    page.on('response', response => {
      if (response.status() >= 400 && ['document', 'script', 'stylesheet', 'image', 'font'].includes(response.request().resourceType())) record('asset', `${response.status()} ${response.url()}`);
    });
    await page.evaluateOnNewDocument(() => {
      window.__betaRejections = [];
      addEventListener('unhandledrejection', event => window.__betaRejections.push(String(event.reason)));
      window.__betaThemeFrames = [];
      function sample() {
        if (document.body && getComputedStyle(document.body).visibility !== 'hidden') {
          const root = document.documentElement;
          window.__betaThemeFrames.push({ theme: root.dataset.theme, id: root.dataset.presentationThemeId, background: getComputedStyle(document.body).backgroundColor });
        }
        if (window.__betaThemeFrames.length < 12) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const fatal = () => diagnostics.filter(item => item.kind !== 'console-warn');
    async function evidence(error) {
      artifactDirectory ||= await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-browser-beta-'));
      const state = await page.evaluate(() => ({ url: location.href, workspace: document.querySelector('.riverline-shell')?.dataset.activeDestination,
        viewport: { width: innerWidth, height: innerHeight }, theme: document.documentElement.dataset.theme, language: document.documentElement.lang,
        activeElement: document.activeElement?.outerHTML, text: document.body?.innerText.slice(0, 18000), rejections: window.__betaRejections })).catch(() => null);
      await page.screenshot({ path: path.join(artifactDirectory, 'failure.png') }).catch(() => {});
      await fs.writeFile(path.join(artifactDirectory, 'failure.json'), JSON.stringify({ flow: currentFlow, error: error.stack, expected: error.expected, actual: error.actual, state, diagnostics, checks }, null, 2));
      console.error(`Failure evidence: ${artifactDirectory}`);
    }
    async function check(name, work) {
      currentFlow = name;
      const started = performance.now();
      let timer;
      try {
        await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Flow exceeded 45 seconds: ${name}`)), 45000); })]);
        await settle(page);
        const rejected = await page.evaluate(() => window.__betaRejections);
        if (fatal().length || rejected.length) throw Error(`Unexpected browser errors: ${JSON.stringify({ diagnostics: fatal(), rejected })}`);
        const result = { name, status: 'pass', seconds: Number(((performance.now() - started) / 1000).toFixed(2)) };
        checks.push(result); console.log(`PASS ${name} (${result.seconds}s)`);
      } catch (error) { checks.push({ name, status: 'fail' }); await evidence(error); throw error; }
      finally { clearTimeout(timer); }
    }
    const onSignal = () => { void close().finally(() => process.exit(130)); };
    process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
    return { browser, page, checks, diagnostics, check, url: `${server.url}/`, close: async () => {
      process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal); await close();
    } };
  } catch (error) { await close(); throw error; }
}
