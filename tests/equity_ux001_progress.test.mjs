import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createEquityController } from '../app/src/application/equity-controller.mjs';
import {
  EQUITY_PROGRESS_RULES,
  createEquityProgressTracker,
} from '../app/src/application/equity-progress.mjs';
import { EQUITY_WORKER_MESSAGES } from '../app/src/application/equity-worker-runtime.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

function request({
  method = 'monte_carlo',
  samples = 100_000,
  board = [],
  players = [
    { id: 'hero', cards: ['As', 'Kd'] },
    { id: 'villain', cards: null },
  ],
} = {}) {
  return {
    schemaVersion: 'equity-request/v1',
    players,
    board,
    deadCards: [],
    method,
    samples,
    seed: 7,
  };
}

test('preparation is indeterminate and exposes no fake zero percentage', () => {
  let clock = 0;
  const updates = [];
  const tracker = createEquityProgressTracker({
    request: request(),
    estimate: { ok: true, exactFeasible: false },
    now: () => clock,
    onProgress: (progress) => updates.push(progress),
  });
  tracker.start();
  clock = 50;
  tracker.update({ completed: 0, total: 100_000, fraction: 0 });

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], {
    phase: 'preparing',
    mode: 'indeterminate',
    method: 'monte_carlo',
    completed: 0,
    total: null,
    fraction: null,
    percentage: null,
    throughputPerSecond: null,
    etaSeconds: null,
  });
  assert.doesNotMatch(html, /Preparing calculation…[\s\S]{0,180}>0%</);
});

test('Monte Carlo counters drive percentage, real elapsed throughput, and conservative ETA', () => {
  let clock = 0;
  const updates = [];
  const tracker = createEquityProgressTracker({
    request: request(),
    estimate: { ok: true, exactFeasible: false },
    now: () => clock,
    onProgress: (progress) => updates.push(progress),
  });
  tracker.start();
  clock = 100;
  tracker.update({ completed: 0, total: 100_000, fraction: 0 });
  clock = 500;
  tracker.update({ completed: 1_000, total: 100_000, fraction: 0.01 });
  assert.equal(updates.at(-1).percentage, 1);
  assert.equal(updates.at(-1).throughputPerSecond, null);
  assert.equal(updates.at(-1).etaSeconds, null);

  clock = 900;
  tracker.update({ completed: 5_000, total: 100_000, fraction: 0.05 });
  assert.equal(updates.at(-1).throughputPerSecond, 6_250);
  assert.equal(updates.at(-1).etaSeconds, null);

  clock = 1_400;
  tracker.update({ completed: 10_000, total: 100_000, fraction: 0.1 });
  assert.equal(updates.at(-1).etaSeconds, null);

  clock = 1_700;
  tracker.update({ completed: 20_000, total: 100_000, fraction: 0.2 });
  assert.equal(updates.at(-1).percentage, 20);
  assert.equal(updates.at(-1).throughputPerSecond, 12_500);
  assert.equal(updates.at(-1).etaSeconds, 6.4);
  assert.equal(EQUITY_PROGRESS_RULES.updateIntervalMs, 180);
});

test('exact progress is determinate when measurable and never exposes Monte Carlo telemetry', () => {
  let clock = 0;
  const updates = [];
  const tracker = createEquityProgressTracker({
    request: request({ method: 'exact', board: ['2c', '7d', '9h', 'Js'] }),
    estimate: { ok: true, exactFeasible: true },
    now: () => clock,
    onProgress: (progress) => updates.push(progress),
  });
  tracker.start();
  clock = 10;
  tracker.update({ completed: 0, total: 44, fraction: 0 });
  clock = 1_000;
  tracker.update({ completed: 22, total: 44, fraction: 0.5 });

  assert.equal(updates.at(-1).method, 'exact');
  assert.equal(updates.at(-1).mode, 'determinate');
  assert.equal(updates.at(-1).percentage, 50);
  assert.equal(updates.at(-1).throughputPerSecond, null);
  assert.equal(updates.at(-1).etaSeconds, null);
  assert.match(logic, /const unit = isExact \? 'outcomes' : 'trials'/);
});

test('invalid requests never enter preparation progress', async () => {
  const updates = [];
  const controller = createEquityController({ workerFactory: () => null });
  const result = await controller.calculate(request({
    players: [{ id: 'hero', cards: ['As', 'Kd'] }],
  }), { onProgress: (progress) => updates.push(progress) });
  assert.equal(result.ok, false);
  assert.equal(updates.length, 0);
});

test('cancelled worker progress is suppressed and an older result cannot displace the newer request', async () => {
  const sent = [];
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage(message) { sent.push(message); },
    terminate() {},
  };
  const controller = createEquityController({ workerFactory: () => worker });
  const firstUpdates = [];
  const secondUpdates = [];
  const firstPromise = controller.calculate(request(), {
    onProgress: (progress) => firstUpdates.push(progress),
  });
  const firstId = sent.find((message) => message.type === EQUITY_WORKER_MESSAGES.CALCULATE).requestId;
  const secondPromise = controller.calculate(request({ samples: 50_000 }), {
    onProgress: (progress) => secondUpdates.push(progress),
  });
  const calculateMessages = sent.filter((message) => message.type === EQUITY_WORKER_MESSAGES.CALCULATE);
  const secondId = calculateMessages[1].requestId;

  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.PROGRESS,
    requestId: firstId,
    progress: { completed: 100_000, total: 100_000, fraction: 1 },
  } });
  assert.equal(firstUpdates.length, 1, 'only the initial preparation state is retained');

  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.RESULT,
    requestId: firstId,
    result: { ok: false, error: { code: 'aborted' } },
  } });
  assert.equal(controller.getCurrentRequestId(), secondId);

  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.PROGRESS,
    requestId: secondId,
    progress: { completed: 50_000, total: 50_000, fraction: 1 },
  } });
  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.RESULT,
    requestId: secondId,
    result: { ok: true, trials: 50_000 },
  } });

  assert.equal((await firstPromise).error.code, 'aborted');
  assert.equal((await secondPromise).trials, 50_000);
  assert.equal(secondUpdates.at(-1).percentage, 100);
  assert.equal(controller.getCurrentRequestId(), null);
});

test('manual cancellation hides post-cancel progress without mutating Equity inputs', async () => {
  const sent = [];
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage(message) { sent.push(message); },
    terminate() {},
  };
  const controller = createEquityController({ workerFactory: () => worker });
  const updates = [];
  const calculation = controller.calculate(request(), {
    onProgress: (progress) => updates.push(progress),
  });
  const requestId = sent.find((message) => message.type === EQUITY_WORKER_MESSAGES.CALCULATE).requestId;
  assert.equal(controller.cancel(), true);
  assert.equal(controller.getCurrentRequestId(), null);
  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.PROGRESS,
    requestId,
    progress: { completed: 100_000, total: 100_000, fraction: 1 },
  } });
  worker.onmessage({ data: {
    type: EQUITY_WORKER_MESSAGES.RESULT,
    requestId,
    result: { ok: false, error: { code: 'aborted' } },
  } });

  assert.equal((await calculation).error.code, 'aborted');
  assert.equal(updates.length, 1);
  assert.match(logic, /function cancelEquityCalculation\(\)[\s\S]*equityCalculationGeneration \+= 1/);
  assert.doesNotMatch(
    logic.slice(logic.indexOf('function cancelEquityCalculation()'), logic.indexOf('function clearEquityResults(')),
    /app\.equity\.(?:players|board|dead)\s*=/,
  );
});
