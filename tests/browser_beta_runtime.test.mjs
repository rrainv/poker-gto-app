import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startDevWebServer } from '../tools/dev-web-server.mjs';
import { createBrowserRuntime, safeRequestResourceType } from './tooling/browser-runtime.mjs';
import { captureScreens, normalizeCaptureSpecs, renderCaptureIndexMarkdown } from './tooling/capture-screens.mjs';

async function freePort() {
  const reservation = await startDevWebServer({ port: 0 });
  const port = reservation.port; await reservation.close(); return port;
}

test('Beta runner refuses an occupied port without launching a browser or closing its owner', async () => {
  const owner = await startDevWebServer({ port: 0 }); let launched = false;
  try {
    await assert.rejects(createBrowserRuntime({ port: owner.port, launch() { launched = true; } }), /EADDRINUSE/);
    assert.equal(launched, false);
    assert.equal(owner.server.listening, true);
  } finally { await owner.close(); }
});

test('Beta runner releases its server after browser launch fails', async () => {
  const port = await freePort();
  await assert.rejects(createBrowserRuntime({ port, launch() { throw Error('launch failure fixture'); } }), /launch failure fixture/);
  const nextOwner = await startDevWebServer({ port }); await nextOwner.close();
});

test('Beta runner closes browser and server after page/context initialization fails', async () => {
  const port = await freePort(); let closes = 0;
  await assert.rejects(createBrowserRuntime({ port, launch: async () => ({
    createBrowserContext() { throw Error('context failure fixture'); },
    async close() { closes++; },
  }) }), /context failure fixture/);
  assert.equal(closes, 1);
  const nextOwner = await startDevWebServer({ port }); await nextOwner.close();
});

test('createBrowserRuntime handles BiDi UnsupportedOperation on request.resourceType() without throwing', async () => {
  const listeners = new Map();
  const bidiUnsupported = () => {
    const error = new Error('BidiHTTPRequest.resourceType is not supported');
    error.name = 'UnsupportedOperation';
    throw error;
  };
  const runtime = await createBrowserRuntime({
    port: 0,
    launch: async () => ({
      async createBrowserContext() {
        return {
          async newPage() {
            return {
              setDefaultTimeout() {},
              setDefaultNavigationTimeout() {},
              on(event, handler) { listeners.set(event, handler); },
              async evaluateOnNewDocument() {},
            };
          },
        };
      },
      async close() {},
    }),
  });
  try {
    assert.equal(
      safeRequestResourceType({ resourceType: bidiUnsupported, url: () => 'http://127.0.0.1:3000/styles.css' }),
      'stylesheet',
    );
    assert.equal(
      safeRequestResourceType({ resourceType: bidiUnsupported, url: () => 'http://127.0.0.1:3000/api/ping' }),
      'other',
    );

    listeners.get('requestfailed')({
      resourceType: bidiUnsupported,
      isNavigationRequest: () => false,
      headers: () => ({ 'sec-fetch-dest': 'script' }),
      url: () => 'http://127.0.0.1:3000/app.js',
      failure: () => ({ errorText: 'NS_ERROR_NET_RESET' }),
    });
    listeners.get('response')({
      status: () => 404,
      url: () => 'http://127.0.0.1:3000/styles.css',
      headers: () => ({ 'content-type': 'text/css' }),
      request: () => ({
        resourceType: bidiUnsupported,
        isNavigationRequest: () => false,
        headers: () => ({}),
        url: () => 'http://127.0.0.1:3000/styles.css',
      }),
    });
    listeners.get('response')({
      status: () => 404,
      url: () => 'http://127.0.0.1:3000/api/non-asset',
      headers: () => ({ 'content-type': 'application/json' }),
      request: () => ({
        resourceType: bidiUnsupported,
        isNavigationRequest: () => false,
        headers: () => ({}),
        url: () => 'http://127.0.0.1:3000/api/non-asset',
      }),
    });

    assert.equal(runtime.diagnostics.length, 2);
    assert.match(runtime.diagnostics[0].message, /app\.js NS_ERROR_NET_RESET/);
    assert.match(runtime.diagnostics[1].message, /404 .*styles\.css/);
  } finally {
    await runtime.close();
  }
});

test('captureScreens normalizes state specs, writes PNGs plus INDEX.md, and tears down cleanly', async () => {
  const normalized = normalizeCaptureSpecs([
    { name: 'Home 1920 EN Midnight', viewport: 1920, theme: 'Midnight', language: 'EN', guest: true, destination: 'home' },
    { name: 'Training Quick Drill', viewport: '1920x1080', theme: 'midnight', language: 'en', steps: [{ navigate: 'training' }, { click: '#trainingNewHand' }] },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].fileName, 'home-1920-en-midnight.png');
  assert.deepEqual(normalized[0].viewport, { width: 1920, height: 1080, deviceScaleFactor: 1 });
  assert.equal(normalized[0].theme, 'midnight');
  assert.equal(normalized[0].language, 'en');
  assert.equal(normalized[1].steps.length, 2);

  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'riverline-capture-test-'));
  let closed = false;
  try {
    const fakePage = {
      async setViewport() {},
      async goto() {},
      async waitForFunction() {},
      async waitForSelector() {},
      async $eval() { return false; },
      async evaluate(fn, ...args) {
        if (args.length === 0 && String(fn).includes('activeDestination')) {
          return { activeDestination: 'home', theme: 'midnight', language: 'en', guest: true };
        }
        return undefined;
      },
      mouse: { async move() {} },
      async screenshot({ path: filePath }) {
        await fs.writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      },
    };
    const report = await captureScreens({
      states: normalized,
      outputDir: outDir,
      createRuntime: async () => ({
        url: 'http://127.0.0.1:0/',
        page: fakePage,
        async check(_name, work) { await work(); },
        async close() { closed = true; },
      }),
    });
    assert.equal(closed, true);
    assert.equal(report.results.length, 2);
    const indexText = await fs.readFile(report.indexPath, 'utf8');
    assert.match(indexText, /home-1920-en-midnight\.png/);
    assert.match(indexText, /training-quick-drill\.png/);
    assert.equal(renderCaptureIndexMarkdown(report.results), indexText);
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
});
