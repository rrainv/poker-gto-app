import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parsePortArgv, startDevWebServer } from '../tools/dev-web-server.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const appMjs = fs.readFileSync(new URL('../app/src/strategy/heuristic-strategy.mjs', import.meta.url), 'utf8');
const sharedIndex = fs.readFileSync(new URL('../shared/poker-domain/index.js', import.meta.url), 'utf8');
const foleySample = fs.readFileSync(new URL('../app/assets/audio/foley/cards/deal_01.ogg', import.meta.url));

function assertNoStoreCache(response) {
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
}

async function withServer(callback, { port = 0 } = {}) {
  const runner = await startDevWebServer({ port });
  try {
    await callback(runner);
  } finally {
    await runner.close();
  }
}

function withEnv(vars, callback) {
  const original = {
    RIVERLINE_DEV_PORT: process.env.RIVERLINE_DEV_PORT,
    PORT: process.env.PORT,
  };

  process.env.RIVERLINE_DEV_PORT = vars.RIVERLINE_DEV_PORT;
  process.env.PORT = vars.PORT;

  return callback().finally(() => {
    if (original.RIVERLINE_DEV_PORT === undefined) delete process.env.RIVERLINE_DEV_PORT;
    else process.env.RIVERLINE_DEV_PORT = original.RIVERLINE_DEV_PORT;

    if (original.PORT === undefined) delete process.env.PORT;
    else process.env.PORT = original.PORT;
  });
}

test('GET / serves app/index.html with html MIME and HTML root content', async () => {
  await withServer(async ({ url }) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assertNoStoreCache(response);
    assert.match(response.headers.get('content-type') || '', /text\/html/i);

    const body = await response.text();
    assert.equal(body, html);
  });
});

test('app .mjs and shared index.js are served with JavaScript MIME', async () => {
  await withServer(async ({ url }) => {
    const appModule = await fetch(`${url}/src/strategy/heuristic-strategy.mjs`);
    assert.equal(appModule.status, 200);
    assertNoStoreCache(appModule);
    assert.match(appModule.headers.get('content-type') || '', /javascript/i);
    assert.equal(await appModule.text(), appMjs);

    const sharedModule = await fetch(`${url}/shared/poker-domain/index.js`);
    assert.equal(sharedModule.status, 200);
    assertNoStoreCache(sharedModule);
    assert.match(sharedModule.headers.get('content-type') || '', /javascript/i);
    assert.equal(await sharedModule.text(), sharedIndex);
  });
});

test('CSS assets are served with CSS MIME', async () => {
  await withServer(async ({ url }) => {
    const response = await fetch(`${url}/styles.css`);
    assert.equal(response.status, 200);
    assertNoStoreCache(response);
    assert.match(response.headers.get('content-type') || '', /text\/css/i);
    assert.equal(await response.text(), styles);
  });
});

test('recorded poker foley is served with Ogg audio MIME and exact bytes', async () => {
  await withServer(async ({ url }) => {
    const response = await fetch(`${url}/assets/audio/foley/cards/deal_01.ogg`);
    assert.equal(response.status, 200);
    assertNoStoreCache(response);
    assert.match(response.headers.get('content-type') || '', /audio\/ogg/i);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), foleySample);
  });
});

test('missing file returns 404 and stays uncacheable', async () => {
  await withServer(async ({ url }) => {
    const response = await fetch(`${url}/__riverline_missing_file__.mjs`);
    assert.equal(response.status, 404);
    assertNoStoreCache(response);
  });
});

test('path traversal requests never resolve outside app or shared', async () => {
  await withServer(async ({ url }) => {
    const traversalPaths = [
      '/%2e%2e%2fpackage.json',
      '/..%2fpackage.json',
      '/shared/%2e%2e%2fpackage.json',
      '/shared/%2e%2e%5C%2e%2e%5Cpackage.json',
    ];

    for (const pathname of traversalPaths) {
      const response = await fetch(`${url}${pathname}`);
      assert.notEqual(response.status, 200);
      assertNoStoreCache(response);
    }
  });
});

test('server starts on ephemeral port and can be closed and rebound cleanly', async () => {
  const first = await startDevWebServer({ port: 0 });
  const firstPort = first.port;
  await first.close();

  const second = await startDevWebServer({ port: firstPort });
  assert.equal(second.port, firstPort);
  await second.close();
});

test('RIVERLINE_DEV_PORT is preferred over PORT', async () => {
  await withEnv({ RIVERLINE_DEV_PORT: '4555', PORT: '4666' }, async () => {
    const runner = await startDevWebServer();
    assert.equal(runner.port, 4555);
    await runner.close();
  });
});

test('invalid port values are rejected explicitly', async () => {
  await assert.rejects(
    () => startDevWebServer({ port: 'abc' }),
    /invalid port value/,
  );

  assert.throws(
    () => parsePortArgv(['--port', 'bad']),
    /invalid port value/,
  );

  await withEnv({ RIVERLINE_DEV_PORT: 'bad', PORT: '4666' }, async () => {
    await assert.rejects(
      () => startDevWebServer(),
      /invalid port value/,
    );
  });
});
