#!/usr/bin/env node
// TOOLING-BROWSER-RUNTIME-001: Reusable screenshot capture tool driven by a JSON
// list of named states (viewport, theme, language, guest, dismissing first-run
// overlays, steps to reach each state), writing PNGs plus an INDEX.md on a free
// dev-server port with clean teardown.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowserRuntime, launchFirefox, settle } from './browser-runtime.mjs';

const DEFAULT_VIEWPORT_HEIGHTS = {
  1920: 1080,
  1366: 768,
  1440: 900,
  1280: 800,
  2560: 1440,
};

const VALID_THEMES = new Set(['midnight', 'daylight', 'slate', 'graphite']);
const VALID_LANGUAGES = new Set(['en', 'ru', 'he']);

export function slugifyStateName(name, index = 0) {
  const cleaned = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `state-${String(index + 1).padStart(2, '0')}`;
}

export function normalizeViewport(viewport = { width: 1920, height: 1080, deviceScaleFactor: 1 }) {
  if (typeof viewport === 'number' && Number.isInteger(viewport) && viewport > 0) {
    return {
      width: viewport,
      height: DEFAULT_VIEWPORT_HEIGHTS[viewport] ?? Math.round((viewport * 9) / 16),
      deviceScaleFactor: 1,
    };
  }
  if (typeof viewport === 'string') {
    const match = /^(\d+)(?:x(\d+))?(?:@(\d+(?:\.\d+)?))?$/i.exec(viewport.trim());
    if (!match) throw new Error(`Invalid viewport string: ${viewport}`);
    const width = Number(match[1]);
    const height = match[2] ? Number(match[2]) : (DEFAULT_VIEWPORT_HEIGHTS[width] ?? Math.round((width * 9) / 16));
    const deviceScaleFactor = match[3] ? Number(match[3]) : 1;
    return { width, height, deviceScaleFactor };
  }
  if (viewport && typeof viewport === 'object') {
    const width = Number(viewport.width ?? 1920);
    const height = Number(viewport.height ?? DEFAULT_VIEWPORT_HEIGHTS[width] ?? 1080);
    const deviceScaleFactor = Number(viewport.deviceScaleFactor ?? viewport.scale ?? 1);
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0 || !Number.isFinite(deviceScaleFactor) || deviceScaleFactor <= 0) {
      throw new Error(`Invalid viewport object: ${JSON.stringify(viewport)}`);
    }
    return { width, height, deviceScaleFactor };
  }
  throw new Error(`Unsupported viewport specification: ${JSON.stringify(viewport)}`);
}

export function normalizeStep(rawStep) {
  if (typeof rawStep === 'string') {
    if (rawStep === 'settle' || rawStep === 'dismissOverlays') return { action: rawStep };
    throw new Error(`Unsupported string step: ${rawStep}`);
  }
  if (!rawStep || typeof rawStep !== 'object') {
    throw new Error(`Invalid step specification: ${JSON.stringify(rawStep)}`);
  }
  if (rawStep.action) return { ...rawStep, action: String(rawStep.action) };
  if (typeof rawStep.navigate === 'string') return { action: 'navigate', destination: rawStep.navigate };
  if (typeof rawStep.click === 'string') return { action: 'click', selector: rawStep.click };
  if (typeof rawStep.waitFor === 'string') return { ...rawStep, action: 'waitFor', selector: rawStep.waitFor };
  if (typeof rawStep.waitForSelector === 'string') return { ...rawStep, action: 'waitFor', selector: rawStep.waitForSelector };
  if (typeof rawStep.fill === 'string') return { action: 'fill', selector: rawStep.fill, value: rawStep.value ?? '' };
  if (typeof rawStep.type === 'string') return { action: 'type', selector: rawStep.type, value: rawStep.value ?? '' };
  if (typeof rawStep.select === 'string') return { action: 'select', selector: rawStep.select, value: rawStep.value ?? '' };
  if (typeof rawStep.press === 'string') return { action: 'press', key: rawStep.press };
  throw new Error(`Unrecognized step specification: ${JSON.stringify(rawStep)}`);
}

export function normalizeCaptureSpecs(input) {
  const rawStates = Array.isArray(input)
    ? input
    : (Array.isArray(input?.states) ? input.states : null);
  const defaults = (!Array.isArray(input) && input?.defaults && typeof input.defaults === 'object')
    ? input.defaults
    : {};
  if (!rawStates || rawStates.length === 0) {
    throw new Error('Capture specification must provide a non-empty array of named states');
  }
  const seenNames = new Set();
  return rawStates.map((entry, index) => {
    const merged = { ...defaults, ...entry };
    const name = String(merged.name ?? merged.id ?? '').trim();
    if (!name) throw new Error(`State at index ${index} is missing a required "name"`);
    const slug = slugifyStateName(merged.fileName ? path.basename(merged.fileName, '.png') : name, index);
    if (seenNames.has(slug)) throw new Error(`Duplicate state filename slug "${slug}" at index ${index}`);
    seenNames.add(slug);

    const theme = String(merged.theme ?? 'midnight').trim().toLowerCase();
    if (!VALID_THEMES.has(theme)) throw new Error(`Unsupported theme "${merged.theme}" in state "${name}"`);

    const language = String(merged.language ?? merged.lang ?? 'en').trim().toLowerCase();
    if (!VALID_LANGUAGES.has(language)) throw new Error(`Unsupported language "${merged.language ?? merged.lang}" in state "${name}"`);

    const viewport = normalizeViewport(merged.viewport);
    const guest = merged.guest !== undefined ? Boolean(merged.guest) : true;
    const dismissFirstRunOverlays = merged.dismissFirstRunOverlays !== undefined
      ? Boolean(merged.dismissFirstRunOverlays)
      : (merged.dismissOverlays !== undefined ? Boolean(merged.dismissOverlays) : true);
    const destination = merged.destination ? String(merged.destination).trim() : null;
    const steps = Array.isArray(merged.steps) ? merged.steps.map(normalizeStep) : [];
    const fullPage = Boolean(merged.fullPage);
    const selector = merged.selector ? String(merged.selector) : null;

    return {
      name,
      description: merged.description ? String(merged.description) : '',
      fileName: `${slug}.png`,
      viewport,
      theme,
      language,
      guest,
      dismissFirstRunOverlays,
      destination,
      steps,
      fullPage,
      selector,
    };
  });
}

export async function dismissFirstRunOverlays(page) {
  const welcomeVisible = await page.$eval(
    '#welcomeOrientation',
    el => Boolean(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden' && !el.hidden,
  ).catch(() => false);
  if (welcomeVisible) {
    await page.evaluate(() => {
      const age = document.querySelector('#welcomeAgeConfirm');
      if (age && !age.checked) {
        age.checked = true;
        age.dispatchEvent(new Event('input', { bubbles: true }));
        age.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const enter = document.querySelector('[data-welcome-destination="home"], #welcomeEnter, #welcomeCloseButton');
      enter?.click();
    });
    await settle(page);
  }
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('.tutorial-offer button, [data-tutorial-action="skip"], #tutorialSkip')) {
      if (button.getClientRects().length && (button.dataset.tutorialAction === 'skip' || /skip|пропустить|דלג/i.test(button.textContent || ''))) {
        button.click();
      }
    }
    const firstRunClose = document.querySelector('#firstRunNoticeDismiss, #firstRunNoticeModal [data-dismiss]');
    if (firstRunClose && firstRunClose.getClientRects().length) firstRunClose.click();
  });
  await settle(page);
}

async function navigateDestination(page, destination, shouldDismissOverlays = true) {
  const navSelector = `.mode-nav-item[data-navigation-id="${destination}"]`;
  await page.waitForSelector(navSelector);
  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    el?.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' });
    el?.click();
  }, navSelector);
  await page.waitForFunction(
    expected => document.querySelector('.riverline-shell')?.dataset.activeDestination === expected,
    {},
    destination,
  );
  if (['home', 'saved'].includes(destination)) {
    await page.waitForFunction(
      () => document.querySelector('#homeWorkspace')?.getAttribute('aria-busy') === 'false',
    );
  }
  if (destination === 'personal-strategy') {
    await page.waitForFunction(
      () => ['empty', 'configured', 'guest'].includes(document.querySelector('#rangeCalibrationWorkspace')?.dataset.calibrationState),
    );
  }
  if (shouldDismissOverlays) await dismissFirstRunOverlays(page);
  await settle(page);
}

async function executeStep(page, step, shouldDismissOverlays = true) {
  switch (step.action) {
    case 'navigate': {
      await navigateDestination(page, step.destination, shouldDismissOverlays);
      return;
    }
    case 'click': {
      await page.waitForSelector(step.selector);
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Click target not found: ${selector}`);
        el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' });
        el.click();
      }, step.selector);
      if (shouldDismissOverlays) await dismissFirstRunOverlays(page);
      await settle(page);
      return;
    }
    case 'waitFor': {
      await page.waitForSelector(step.selector, step.visible ? { visible: true } : {});
      if (step.dataset && typeof step.dataset === 'object') {
        await page.waitForFunction(
          (selector, expectedDataset) => {
            const el = document.querySelector(selector);
            if (!el) return false;
            return Object.entries(expectedDataset).every(([k, v]) => el.dataset[k] === String(v));
          },
          {},
          step.selector,
          step.dataset,
        );
      }
      if (step.text) {
        await page.waitForFunction(
          (selector, expectedText) => (document.querySelector(selector)?.textContent || '').includes(expectedText),
          {},
          step.selector,
          String(step.text),
        );
      }
      await settle(page);
      return;
    }
    case 'fill':
    case 'type': {
      await page.waitForSelector(step.selector);
      await page.evaluate((selector, value) => {
        const input = document.querySelector(selector);
        if (!input) throw new Error(`Input not found: ${selector}`);
        input.focus?.();
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, step.selector, step.value ?? '');
      await settle(page);
      return;
    }
    case 'select': {
      await page.waitForSelector(step.selector);
      await page.select(step.selector, String(step.value ?? ''));
      await settle(page);
      return;
    }
    case 'press': {
      await page.keyboard.press(String(step.key));
      await settle(page);
      return;
    }
    case 'scroll': {
      if (step.selector) {
        await page.$eval(step.selector, el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      } else {
        await page.evaluate(({ x, y }) => window.scrollTo({ left: x ?? 0, top: y ?? 0, behavior: 'instant' }), { x: step.x ?? 0, y: step.y ?? 0 });
      }
      await settle(page);
      return;
    }
    case 'quickDrill': {
      await navigateDestination(page, 'training', shouldDismissOverlays);
      await executeStep(page, { action: 'click', selector: '#trainingNewHand' }, shouldDismissOverlays);
      await executeStep(page, { action: 'waitFor', selector: '#trainingWorkspace', dataset: { trainingState: 'ready' } }, shouldDismissOverlays);
      return;
    }
    case 'dismissOverlays': {
      await dismissFirstRunOverlays(page);
      return;
    }
    case 'settle': {
      await settle(page);
      return;
    }
    default:
      throw new Error(`Unsupported step action: ${step.action}`);
  }
}

export function renderCaptureIndexMarkdown(results, { title = 'Captured Screens Index' } = {}) {
  const lines = [
    `# ${title}`,
    '',
    '| # | Name | File | Viewport | Theme | Language | Guest | Destination | Steps |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  results.forEach((item, index) => {
    const vp = `${item.viewport.width}x${item.viewport.height}${item.viewport.deviceScaleFactor !== 1 ? `@${item.viewport.deviceScaleFactor}x` : ''}`;
    lines.push(
      `| ${index + 1} | ${item.name} | [${item.fileName}](./${item.fileName}) | ${vp} | ${item.theme} | ${item.language} | ${item.guest ? 'guest' : 'authenticated'} | ${item.activeDestination || '-'} | ${item.stepCount} |`,
    );
  });
  lines.push('', '## Previews', '');
  for (const item of results) {
    lines.push(`### ${item.name}`);
    if (item.description) lines.push('', item.description);
    lines.push('', `![${item.name}](./${item.fileName})`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export async function captureScreens({
  states,
  outputDir = null,
  port = 0,
  launch = () => launchFirefox({ protocolTimeout: Number(process.env.RIVERLINE_BROWSER_PROTOCOL_TIMEOUT) || 60000 }),
  createRuntime = createBrowserRuntime,
} = {}) {
  const normalizedStates = normalizeCaptureSpecs(states);
  const resolvedOutDir = outputDir
    ? path.resolve(outputDir)
    : await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-screens-'));
  await fs.mkdir(resolvedOutDir, { recursive: true });

  const runtime = await createRuntime({ port, launch });
  const results = [];
  let loadedOnce = false;

  try {
    const { page } = runtime;
    for (const spec of normalizedStates) {
      await runtime.check(`capture:${spec.name}`, async () => {
        await page.setViewport(spec.viewport);
        if (!loadedOnce) {
          await page.goto(runtime.url, { waitUntil: 'load' });
          await page.waitForFunction(() => window.RiverlineWelcome && window.RiverlinePlaybookState && window.RiverlineAuthentication);
          await page.evaluate(() => window.RiverlineAuthentication.ready());
          loadedOnce = true;
        }
        if (spec.guest) {
          await page.evaluate(async () => {
            await window.RiverlineAuthentication?.ready?.();
            if (window.RiverlineAuthentication?.getState?.()?.status === 'signed_in') {
              await window.RiverlineAuthentication.signOut();
            }
          });
        }
        if (spec.dismissFirstRunOverlays) {
          await dismissFirstRunOverlays(page);
        }
        await page.evaluate((theme, language) => {
          if (window.RiverlinePresentationTheme?.apply) {
            window.RiverlinePresentationTheme.apply(theme);
          } else {
            document.documentElement.dataset.theme = theme;
          }
          if (typeof window.setLanguage === 'function') {
            window.setLanguage(language);
          } else {
            document.documentElement.lang = language;
          }
        }, spec.theme, spec.language);
        await settle(page);

        if (spec.destination) {
          await navigateDestination(page, spec.destination, spec.dismissFirstRunOverlays);
        }
        for (const step of spec.steps) {
          await executeStep(page, step, spec.dismissFirstRunOverlays);
        }
        if (spec.dismissFirstRunOverlays) {
          await dismissFirstRunOverlays(page);
        }
        await page.mouse.move(1, 1);
        await settle(page);

        const pngPath = path.join(resolvedOutDir, spec.fileName);
        if (spec.selector) {
          const target = await page.waitForSelector(spec.selector, { visible: true });
          await target.screenshot({ path: pngPath });
        } else {
          await page.screenshot({ path: pngPath, fullPage: spec.fullPage });
        }

        const pageMeta = await page.evaluate(() => ({
          activeDestination: document.querySelector('.riverline-shell')?.dataset.activeDestination ?? null,
          theme: document.documentElement.dataset.theme ?? null,
          language: document.documentElement.lang ?? null,
          guest: window.RiverlineAuthentication?.getState?.()?.status !== 'signed_in',
        }));

        results.push({
          name: spec.name,
          description: spec.description,
          fileName: spec.fileName,
          filePath: pngPath,
          viewport: spec.viewport,
          theme: pageMeta.theme || spec.theme,
          language: pageMeta.language || spec.language,
          guest: pageMeta.guest,
          activeDestination: pageMeta.activeDestination || spec.destination,
          stepCount: spec.steps.length + (spec.destination ? 1 : 0),
        });
      });
    }

    const indexPath = path.join(resolvedOutDir, 'INDEX.md');
    const indexMarkdown = renderCaptureIndexMarkdown(results);
    await fs.writeFile(indexPath, indexMarkdown, 'utf8');
    return {
      outputDir: resolvedOutDir,
      indexPath,
      results,
    };
  } finally {
    await runtime.close();
  }
}

export function parseCaptureCliArgs(argv) {
  let specArg = null;
  let outputDir = null;
  let port = 0;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--spec' || arg === '--states') && i + 1 < argv.length) {
      specArg = argv[++i];
    } else if (arg.startsWith('--spec=')) {
      specArg = arg.slice('--spec='.length);
    } else if (arg.startsWith('--states=')) {
      specArg = arg.slice('--states='.length);
    } else if ((arg === '--out' || arg === '--output') && i + 1 < argv.length) {
      outputDir = argv[++i];
    } else if (arg.startsWith('--out=')) {
      outputDir = arg.slice('--out='.length);
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice('--output='.length);
    } else if (arg === '--port' && i + 1 < argv.length) {
      port = Number(argv[++i]);
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.slice('--port='.length));
    } else if (!arg.startsWith('--') && !specArg) {
      specArg = arg;
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }
  if (!specArg) {
    throw new Error('Usage: node tests/tooling/capture-screens.mjs --spec <states.json|inline-json> [--out <dir>] [--port <0|port>]');
  }
  return { specArg, outputDir, port };
}

async function loadSpecInput(specArg) {
  const trimmed = specArg.replace(/^\uFEFF/, '').trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const raw = await fs.readFile(path.resolve(trimmed), 'utf8');
  return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const { specArg, outputDir, port } = parseCaptureCliArgs(process.argv.slice(2));
    const states = await loadSpecInput(specArg);
    const report = await captureScreens({ states, outputDir, port });
    console.log(JSON.stringify({
      outputDir: report.outputDir,
      indexPath: report.indexPath,
      captured: report.results.map(item => ({
        name: item.name,
        fileName: item.fileName,
        viewport: item.viewport,
        theme: item.theme,
        language: item.language,
        guest: item.guest,
        activeDestination: item.activeDestination,
      })),
    }, null, 2));
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}
