import test from 'node:test';
import assert from 'node:assert/strict';
import { startDevWebServer } from '../tools/dev-web-server.mjs';
import { createBrowserRuntime } from './tooling/browser-runtime.mjs';

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
