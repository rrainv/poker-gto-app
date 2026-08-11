import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_RANKS,
  CARD_SUITS,
  EQUITY_ERROR_CODES,
  EQUITY_METHODS,
  EQUITY_REQUEST_SCHEMA_VERSION,
  EQUITY_RESULT_SCHEMA_VERSION,
  EXACT_EQUITY_COMBINATION_LIMIT,
  calculateEquity,
  calculateEquityExact,
  calculateEquityMonteCarlo,
  estimateEquityCombinations,
  validateEquityRequest,
} from '../shared/poker-domain/index.js';
import { createEquityController } from '../app/src/application/equity-controller.mjs';
import {
  EQUITY_WORKER_MESSAGES,
  createEquityWorkerMessageHandler,
} from '../app/src/application/equity-worker-runtime.mjs';
import { installEquityModeBridge } from '../app/src/application/equity-mode-bootstrap.mjs';

const DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

function equityRequest({
  players = [
    { id: 'hero', cards: ['As', 'Ad'] },
    { id: 'villain', cards: ['Kh', 'Kd'] },
  ],
  board = ['2c', '7d', '9h', 'Js', '3c'],
  deadCards = [],
  method = EQUITY_METHODS.AUTO,
  samples = 1000,
  seed = 12345,
} = {}) {
  return {
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    players,
    board,
    deadCards,
    method,
    samples,
    seed,
  };
}

function deadCardsExcluding(excluded, count) {
  const excludedSet = new Set(excluded);
  return DECK.filter((card) => !excludedSet.has(card)).slice(0, count);
}

function assertCompleteResult(result, expectedPlayers) {
  assert.equal(result.schemaVersion, EQUITY_RESULT_SCHEMA_VERSION);
  assert.equal(result.players.length, expectedPlayers);
  assert.ok(result.trials > 0);
  let equitySum = 0;
  for (const player of result.players) {
    assert.ok(player.equity >= 0 && player.equity <= 1);
    assert.ok(player.winProbability >= 0 && player.winProbability <= 1);
    assert.ok(player.tieProbability >= 0 && player.tieProbability <= 1);
    assert.equal(player.wins + player.ties + player.losses, result.trials);
    equitySum += player.equity;
  }
  assert.ok(Math.abs(equitySum - 1) < 1e-12, `equity sum was ${equitySum}`);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.players), true);
}

test('EquityRequest v1 accepts 2 through 10 stable players and rejects 1 or 11', () => {
  for (const count of [2, 6, 8, 10]) {
    const validation = validateEquityRequest(equityRequest({
      players: Array.from({ length: count }, (_, index) => ({
        id: `P${index}`,
        cards: null,
      })),
      board: [],
    }));
    assert.equal(validation.ok, true, `${count} players`);
    assert.equal(validation.request.players.length, count);
  }
  for (const count of [1, 11]) {
    const validation = validateEquityRequest(equityRequest({
      players: Array.from({ length: count }, (_, index) => ({ id: `P${index}`, cards: null })),
      board: [],
    }));
    assert.equal(validation.ok, false);
    assert.equal(validation.error.code, EQUITY_ERROR_CODES.INVALID_REQUEST);
  }
});

test('validation rejects invalid, partial, duplicate, overlapping, and overlong card inputs', () => {
  const fixtures = [
    equityRequest({ players: [{ id: 'H', cards: ['as', 'Ad'] }, { id: 'V', cards: null }] }),
    equityRequest({ players: [{ id: 'H', cards: ['As'] }, { id: 'V', cards: null }] }),
    equityRequest({ board: ['2c', '7d', '9h', 'Js', '3c', '4c'] }),
  ];
  for (const fixture of fixtures) {
    const validation = validateEquityRequest(fixture);
    assert.equal(validation.ok, false);
    assert.equal(validation.error.code, EQUITY_ERROR_CODES.INVALID_REQUEST);
  }

  for (const fixture of [
    equityRequest({ players: [{ id: 'H', cards: ['As', 'Ad'] }, { id: 'V', cards: ['As', 'Kd'] }] }),
    equityRequest({ board: ['As', '7d', '9h', 'Js', '3c'] }),
    equityRequest({ deadCards: ['As'] }),
    equityRequest({ deadCards: ['4c', '4c'] }),
  ]) {
    const validation = validateEquityRequest(fixture);
    assert.equal(validation.ok, false);
    assert.equal(validation.error.code, EQUITY_ERROR_CODES.DUPLICATE_CARD);
  }
});

test('validation rejects impossible remaining-deck capacity without materializing unknown cards', () => {
  const request = equityRequest({
    players: Array.from({ length: 10 }, (_, index) => ({ id: `P${index}`, cards: null })),
    board: [],
    deadCards: DECK.slice(0, 28),
  });
  const validation = validateEquityRequest(request);
  assert.equal(validation.ok, false);
  assert.equal(validation.error.code, EQUITY_ERROR_CODES.IMPOSSIBLE_DECK);
});

test('request IDs, methods, seeds, and sample bounds are validated structurally', () => {
  const fixtures = [
    equityRequest({ players: [{ id: 'P0', cards: null }, { id: 'P0', cards: null }], board: [] }),
    { ...equityRequest(), method: 'sometimes' },
    { ...equityRequest(), samples: 0 },
    { ...equityRequest(), samples: 1_000_001 },
    { ...equityRequest(), seed: -1 },
    { ...equityRequest(), seed: 0x1_0000_0000 },
  ];
  for (const fixture of fixtures) {
    const validation = validateEquityRequest(fixture);
    assert.equal(validation.ok, false);
    assert.equal(validation.error.code, EQUITY_ERROR_CODES.INVALID_REQUEST);
  }
});

test('validation creates an immutable snapshot and leaves the caller request unchanged', () => {
  const request = equityRequest();
  const before = structuredClone(request);
  const validation = validateEquityRequest(request);
  assert.deepEqual(request, before);
  assert.notEqual(validation.request, request);
  assert.equal(Object.isFrozen(validation.request), true);
  assert.equal(Object.isFrozen(validation.request.players[0].cards), true);
});

test('exact fully-known river has one realization and uses distinct win, tie, and equity fields', () => {
  const result = calculateEquityExact(equityRequest());
  assertCompleteResult(result, 2);
  assert.equal(result.method, EQUITY_METHODS.EXACT);
  assert.equal(result.trials, 1);
  assert.deepEqual(result.players.map((player) => player.equity), [1, 0]);
  assert.deepEqual(result.players.map((player) => player.tieProbability), [0, 0]);
});

test('fully-known terminal states take the exact fast path even when Monte Carlo is requested', () => {
  const result = calculateEquityMonteCarlo(equityRequest({
    method: EQUITY_METHODS.MONTE_CARLO,
    samples: 1000,
  }));
  assert.equal(result.method, EQUITY_METHODS.EXACT);
  assert.equal(result.trials, 1);
});

test('exact known HU turn and flop enumerate every legal final board', () => {
  const turn = calculateEquityExact(equityRequest({ board: ['2c', '7d', '9h', 'Js'] }));
  const flop = calculateEquityExact(equityRequest({ board: ['2c', '7d', '9h'] }));
  assert.equal(turn.trials, 44);
  assert.equal(flop.trials, 990);
  assertCompleteResult(turn, 2);
  assertCompleteResult(flop, 2);
});

test('exact enumeration materializes one unknown river opponent without replacement', () => {
  const request = equityRequest({
    players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'villain', cards: null }],
  });
  const estimate = estimateEquityCombinations(request);
  const result = calculateEquityExact(request);
  assert.equal(estimate.combinations, 990);
  assert.equal(result.trials, 990);
  assertCompleteResult(result, 2);
});

test('exact enumeration supports several unknown seats when dead cards make the space small', () => {
  const known = ['As', 'Ad', '2c', '7d', '9h', 'Js', '3c'];
  const request = equityRequest({
    players: [
      { id: 'hero', cards: ['As', 'Ad'] },
      { id: 'villain-1', cards: null },
      { id: 'villain-2', cards: null },
    ],
    deadCards: deadCardsExcluding(known, 39),
  });
  const estimate = estimateEquityCombinations(request);
  const result = calculateEquityExact(request);
  assert.equal(estimate.combinations, 90);
  assert.equal(result.trials, 90);
  assertCompleteResult(result, 3);
});

test('three-way exact tie awards one-third equity rather than a full win', () => {
  const result = calculateEquityExact(equityRequest({
    players: [
      { id: 'P0', cards: ['2c', '3d'] },
      { id: 'P1', cards: ['4c', '5d'] },
      { id: 'P2', cards: ['6c', '7d'] },
    ],
    board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
  }));
  assert.deepEqual(result.players.map((player) => player.wins), [0, 0, 0]);
  assert.deepEqual(result.players.map((player) => player.ties), [1, 1, 1]);
  for (const player of result.players) assert.equal(player.equity, 1 / 3);
  assertCompleteResult(result, 3);
});

test('exact multiway winner and dead-card exclusion preserve deterministic counts', () => {
  const base = equityRequest({
    players: [
      { id: 'P0', cards: ['Ah', 'Qh'] },
      { id: 'P1', cards: ['9s', '9d'] },
      { id: 'P2', cards: ['Kh', 'Kd'] },
    ],
    board: ['2h', '5h', '9h', 'Kc', '3d'],
  });
  const winner = calculateEquityExact(base);
  assert.deepEqual(winner.players.map((player) => player.equity), [1, 0, 0]);

  const turn = equityRequest({ board: ['2c', '7d', '9h', 'Js'], deadCards: ['4c'] });
  assert.equal(estimateEquityCombinations(turn).combinations, 43);
  assert.equal(calculateEquityExact(turn).trials, 43);
});

test('fixed-seed Monte Carlo is reproducible and a different seed changes the path', () => {
  const request = equityRequest({
    players: [{ id: 'hero', cards: ['As', 'Kd'] }, { id: 'villain', cards: null }],
    board: ['2c', '7d', '9h'],
    method: EQUITY_METHODS.MONTE_CARLO,
    samples: 1000,
    seed: 77,
  });
  const first = calculateEquityMonteCarlo(request);
  const second = calculateEquityMonteCarlo(structuredClone(request));
  const different = calculateEquityMonteCarlo({ ...request, seed: 78 });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.players, different.players);
  assert.equal(first.metadata.seed, 77);
});

test('Monte Carlo benchmark sanity, mixed unknown seats, and requested samples are honored', () => {
  const headsUp = calculateEquityMonteCarlo(equityRequest({
    board: [], method: EQUITY_METHODS.MONTE_CARLO, samples: 5000, seed: 11,
  }));
  assert.equal(headsUp.trials, 5000);
  assert.equal(headsUp.metadata.samplesCompleted, 5000);
  assert.ok(headsUp.players[0].equity > 0.75 && headsUp.players[0].equity < 0.9);

  const mixed = calculateEquityMonteCarlo(equityRequest({
    players: [
      { id: 'P0', cards: ['As', 'Kd'] },
      { id: 'P1', cards: ['Qh', 'Qd'] },
      { id: 'P2', cards: null },
      { id: 'P3', cards: null },
    ],
    board: ['2c', '7d', '9h'],
    method: EQUITY_METHODS.MONTE_CARLO,
    samples: 750,
    seed: 55,
  }));
  assert.equal(mixed.trials, 750);
  assert.equal(mixed.metadata.unknownPlayers, 2);
  assertCompleteResult(mixed, 4);
});

test('Monte Carlo never samples dead cards', () => {
  const known = ['As', 'Ad', 'Kh', 'Kd', '2c', '7d', '9h', 'Js'];
  const onlyAvailableRiver = 'Ac';
  const deadCards = DECK.filter((card) => !known.includes(card) && card !== onlyAvailableRiver);
  const request = equityRequest({
    players: [
      { id: 'hero', cards: ['As', 'Ad'] },
      { id: 'villain', cards: ['Kh', 'Kd'] },
    ],
    board: ['2c', '7d', '9h', 'Js'],
    deadCards,
    method: EQUITY_METHODS.MONTE_CARLO,
    samples: 25,
    seed: 99,
  });
  const exact = calculateEquityExact({ ...request, method: EQUITY_METHODS.EXACT });
  const sampled = calculateEquityMonteCarlo(request);
  assert.equal(deadCards.length, 43);
  assert.equal(exact.trials, 1);
  assert.equal(sampled.trials, 25);
  assert.deepEqual(
    sampled.players.map((player) => player.equity),
    exact.players.map((player) => player.equity),
  );
});

test('Monte Carlo supports 2, 6, 8, and 10 players with bounded normalized results', () => {
  for (const count of [2, 6, 8, 10]) {
    const result = calculateEquityMonteCarlo(equityRequest({
      players: [
        { id: 'P0', cards: ['As', 'Ad'] },
        ...Array.from({ length: count - 1 }, (_, index) => ({ id: `P${index + 1}`, cards: null })),
      ],
      board: ['2c', '7d', '9h'],
      method: EQUITY_METHODS.MONTE_CARLO,
      samples: 100,
      seed: 100 + count,
    }));
    assertCompleteResult(result, count);
  }
});

test('Monte Carlo counts guaranteed ties separately from split equity', () => {
  const result = calculateEquityMonteCarlo(equityRequest({
    players: [
      { id: 'P0', cards: ['Kc', '2c'] },
      { id: 'P1', cards: ['Kd', '3c'] },
    ],
    board: ['As', 'Ah', 'Ad', 'Ac'],
    method: EQUITY_METHODS.MONTE_CARLO,
    samples: 100,
    seed: 1,
  }));
  assert.deepEqual(result.players.map((player) => player.tieProbability), [1, 1]);
  assert.deepEqual(result.players.map((player) => player.equity), [0.5, 0.5]);
  assert.equal(result.metadata.splitPotTrials, 100);
});

test('auto selects exact for small spaces and Monte Carlo above the central threshold', async () => {
  const small = await calculateEquity(equityRequest({ board: ['2c', '7d', '9h', 'Js'] }));
  const largeRequest = equityRequest({
    players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'villain', cards: null }],
    board: [],
    method: EQUITY_METHODS.AUTO,
    samples: 50,
  });
  const largeEstimate = estimateEquityCombinations(largeRequest);
  const large = await calculateEquity(largeRequest);
  assert.equal(small.method, EQUITY_METHODS.EXACT);
  assert.equal(largeEstimate.exactFeasible, false);
  assert.ok(BigInt(largeEstimate.combinationsText) > BigInt(EXACT_EQUITY_COMBINATION_LIMIT));
  assert.equal(large.method, EQUITY_METHODS.MONTE_CARLO);
  assert.equal(large.metadata.estimatedCombinationsText, largeEstimate.combinationsText);
});

test('explicit exact above the safety limit returns a structured failure without simulating', () => {
  const result = calculateEquityExact(equityRequest({
    players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'villain', cards: null }],
    board: [],
    method: EQUITY_METHODS.EXACT,
  }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, EQUITY_ERROR_CODES.EXACT_LIMIT_EXCEEDED);
  assert.equal(result.error.details.exactCombinationLimit, EXACT_EQUITY_COMBINATION_LIMIT);
});

test('async calculation reports batched progress and cancellation as a structured failure', async () => {
  const abortController = new AbortController();
  const progress = [];
  const result = await calculateEquity(equityRequest({
    board: [], method: EQUITY_METHODS.MONTE_CARLO, samples: 1000,
  }), {
    signal: abortController.signal,
    batchSize: 50,
    yieldControl: async () => {},
    onProgress(snapshot) {
      progress.push(snapshot);
      if (snapshot.completed >= 100) abortController.abort();
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, EQUITY_ERROR_CODES.ABORTED);
  assert.equal(result.error.details.completed, 100);
  assert.deepEqual(progress.map((entry) => entry.completed), [0, 50, 100]);
  assert.equal(Object.isFrozen(progress[0]), true);
});

test('canonical worker protocol preserves request/result schemas and progress messages', async () => {
  const messages = [];
  const handler = createEquityWorkerMessageHandler({
    postMessage(message) { messages.push(message); },
  });
  await handler({
    type: EQUITY_WORKER_MESSAGES.CALCULATE,
    requestId: 'request-1',
    request: equityRequest({ board: ['2c', '7d', '9h', 'Js'] }),
  });
  assert.equal(messages[0].type, EQUITY_WORKER_MESSAGES.PROGRESS);
  assert.equal(messages.at(-1).type, EQUITY_WORKER_MESSAGES.RESULT);
  assert.equal(messages.at(-1).requestId, 'request-1');
  assert.equal(messages.at(-1).result.schemaVersion, EQUITY_RESULT_SCHEMA_VERSION);
});

test('canonical worker cancellation aborts a running Monte Carlo request', async () => {
  const messages = [];
  const handler = createEquityWorkerMessageHandler({
    postMessage(message) { messages.push(message); },
  });
  const running = handler({
    type: EQUITY_WORKER_MESSAGES.CALCULATE,
    requestId: 'request-cancel',
    request: equityRequest({ board: [], method: EQUITY_METHODS.MONTE_CARLO, samples: 5000 }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await handler({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId: 'request-cancel' });
  await running;
  const result = messages.find((message) => message.type === EQUITY_WORKER_MESSAGES.RESULT)?.result;
  assert.equal(result.ok, false);
  assert.equal(result.error.code, EQUITY_ERROR_CODES.ABORTED);
});

test('controller supplies an effective seed and cancels its prior in-process request', async () => {
  const requests = [];
  const signals = [];
  const controller = createEquityController({
    workerFactory: () => null,
    seedSource: () => 9876,
    calculateInProcess(request, options) {
      requests.push(request);
      signals.push(options.signal);
      return new Promise((resolve) => {
        options.signal.addEventListener('abort', () => resolve({
          ok: false,
          error: { code: EQUITY_ERROR_CODES.ABORTED },
        }), { once: true });
        if (requests.length === 2) resolve(calculateEquityExact({ ...request, method: EQUITY_METHODS.EXACT }));
      });
    },
  });
  const first = controller.calculate({ ...equityRequest(), seed: undefined });
  const second = controller.calculate({ ...equityRequest(), seed: undefined });
  assert.equal((await first).error.code, EQUITY_ERROR_CODES.ABORTED);
  assert.equal((await second).schemaVersion, EQUITY_RESULT_SCHEMA_VERSION);
  assert.equal(signals[0].aborted, true);
  assert.equal(requests[0].seed, 9876);
});

test('controller converts worker-boundary and in-process exceptions into structured failures', async () => {
  const workerController = createEquityController({
    workerFactory: () => ({
      postMessage() { throw new Error('clone failed'); },
      terminate() {},
    }),
  });
  const workerFailure = await workerController.calculate(equityRequest());
  assert.equal(workerFailure.ok, false);
  assert.equal(workerFailure.error.code, EQUITY_ERROR_CODES.INTERNAL_ERROR);

  const inProcessController = createEquityController({
    workerFactory: () => null,
    calculateInProcess() { throw new Error('calculation failed'); },
  });
  const inProcessFailure = await inProcessController.calculate(equityRequest());
  assert.equal(inProcessFailure.ok, false);
  assert.equal(inProcessFailure.error.code, EQUITY_ERROR_CODES.INTERNAL_ERROR);
});

test('browser bridge exposes canonical estimate, calculate, cancel, status, and worker state operations', () => {
  const calls = [];
  const controller = {
    estimate(request) { calls.push(['estimate', request]); return { ok: true, combinations: 1 }; },
    calculate(request, options) { calls.push(['calculate', request, options]); return Promise.resolve({}); },
    cancel() { calls.push(['cancel']); return true; },
    getCurrentRequestId() { return 'request-1'; },
    isWorkerBacked() { return true; },
  };
  const browserWindow = {};
  const bridge = installEquityModeBridge(browserWindow, { controller });
  assert.equal(browserWindow.RiverlineEquity, bridge);
  assert.deepEqual(bridge.estimate(equityRequest()), { ok: true, combinations: 1 });
  assert.equal(bridge.getCurrentRequestId(), 'request-1');
  assert.equal(bridge.isWorkerBacked(), true);
  assert.equal(bridge.cancel(), true);
  assert.deepEqual(calls.map(([operation]) => operation), ['estimate', 'cancel']);
});

test('Equity production path imports canonical semantics and contains no random evaluator copy', () => {
  const service = fs.readFileSync(new URL('../shared/poker-domain/equity.js', import.meta.url), 'utf8');
  const worker = fs.readFileSync(new URL('../app/src/application/equity-worker.mjs', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../app/src/application/equity-worker-runtime.mjs', import.meta.url), 'utf8');
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  assert.match(service, /import \{ evaluateSeven \} from '\.\/evaluator\.js'/);
  assert.doesNotMatch(service + worker + runtime, /Math\.random|function scoreFive|function evaluate5/);
  assert.match(logic, /callEquityServiceBridge\('calculate', request/);
  assert.match(logic, /callEquityServiceBridge\('estimate', equityRequestFromCurrentInputs\(\)/);
  assert.doesNotMatch(logic.slice(
    logic.indexOf('function equityRequestFromCurrentInputs'),
    logic.indexOf('function renderEquityResult'),
  ), /scoreSeven|Math\.random|PokerState|DecisionContext/);
  assert.match(logic, /Maximum of ten players/);
  assert.match(html, /id="progress"/);
  assert.match(html, /id="cancelEquity"/);
  assert.match(css, /--series-8:/);
  assert.match(css, /--series-9:/);
  assert.doesNotMatch(service + runtime, /Playbook|Training|PokerState/);
});
