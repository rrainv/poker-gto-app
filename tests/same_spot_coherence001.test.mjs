import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  createTrainingSameSpotLifecycle,
} from '../app/src/application/training-same-spot-lifecycle.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sameSpotFlow = logic.slice(
  logic.indexOf('async function openTrainingMemorySameSpot('),
  logic.indexOf('async function openTrainingMemoryRedrill('),
);
const answerFlow = logic.slice(
  logic.indexOf('function handleTrainingGuess('),
  logic.indexOf('function replayTrainingExercise('),
);

test('standalone Same Spot is explicit and separate from ordinary session state', () => {
  const lifecycle = createTrainingSameSpotLifecycle();
  const state = lifecycle.begin({
    sourceDecisionRecordId: 'historical-decision',
  });
  assert.equal(state.active, true);
  assert.equal(state.sourceDecisionRecordId, 'historical-decision');
  lifecycle.markAnswered();
  assert.equal(lifecycle.release().answered, true);
  assert.equal(lifecycle.getState().active, false);
});

test('Same Spot presentation is read-only and never impersonates Focused Drill', () => {
  assert.match(html, /id="trainingSameSpotSetup"[^>]+hidden/);
  assert.match(html, /Re-drill from Training Memory/);
  assert.match(html, /id="trainingSameSpotStreet"/);
  assert.match(html, /id="trainingSameSpotPosition"/);
  assert.match(html, /id="trainingSameSpotTable"/);
  assert.match(html, /id="trainingSameSpotStack"/);
  assert.match(html, /id="trainingSameSpotFacing"/);
  assert.match(html, /id="trainingSameSpotExit"/);
  assert.match(html, /data-i18n="Back to Training"/);
  assert.doesNotMatch(html, /Return to session/);
  assert.doesNotMatch(sameSpotFlow, /setTrainingSessionMode\('focused'/);
  assert.doesNotMatch(sameSpotFlow, /TrainingPracticePlanner|generatePlanned|strategyProvider/);
  assert.match(sameSpotFlow, /startTemporaryTrainingMemoryReviewSession\(\{/);
  assert.match(sameSpotFlow, /mode: 'review'/);
  assert.match(sameSpotFlow, /attemptKind: 'redrill'/);
});

test('Same Spot answer is linked, completes review evidence, and stays headline-neutral', () => {
  assert.match(sameSpotFlow, /parentDecisionRecordId: recordId,[\s\S]*redrillKind: 'same_spot'/);
  assert.match(answerFlow, /currentAttemptKind !== 'replay'[\s\S]*currentAttemptKind !== 'redrill'/);
  assert.match(answerFlow, /markSameSpotAnswered/);
  assert.match(answerFlow, /finishTrainingMemorySession\('completed'\)/);
  assert.doesNotMatch(answerFlow, /markReviewed|reviewAgain|updateStudyMetadata/);
});

test('standalone Same Spot exit drains its review, returns idle, and refreshes Memory', () => {
  const exitFlow = logic.slice(
    logic.indexOf('function exitTrainingSameSpot('),
    logic.indexOf('function recordTrainingExerciseShown('),
  );
  assert.match(exitFlow, /released\.answered \? 'completed' : 'abandoned'/);
  const orderedSteps = [
    'await Promise.resolve(cleanup)',
    'discardSameSpotMemoryRuntime()',
    'returnSameSpotToIdleTraining()',
    'await refreshTrainingMemoryPanel()',
  ];
  orderedSteps.reduce((priorIndex, step) => {
    const index = exitFlow.indexOf(step);
    assert.ok(index > priorIndex, `${step} must follow the prior lifecycle step`);
    return index;
  }, -1);
  assert.doesNotMatch(logic, /captureSuspendedTrainingState|restoreSuspendedTraining|reacquireSuspendedTrainingMemory|captureSessionState|restoreSessionState/);
});

test('owner invalidation releases Same Spot and restores only ordinary idle presentation', () => {
  const ownerCleanup = extractFunction(logic, 'clearTrainingMemoryOwnerPresentation');
  assert.match(ownerCleanup, /sameSpotWasActive/);
  assert.match(ownerCleanup, /releaseSameSpot/);
  assert.match(ownerCleanup, /clearTrainingSessionState\(\)/);
  assert.match(ownerCleanup, /showOrdinaryTrainingSetupAfterSameSpot\(\)/);
  assert.doesNotMatch(ownerCleanup, /beginSameSpot|startTemporaryTrainingMemoryReviewSession/);
});

test('frozen earlier evidence and this try remain separately labelled', () => {
  assert.match(html, /data-i18n="Earlier answer"/);
  assert.match(html, /data-i18n="This try"/);
  assert.match(logic, /sameSpotSourceRole[\s\S]*'Historical heuristic baseline'[\s\S]*'Historical selected reference'/);
  assert.match(sameSpotFlow, /callTrainingMemoryBridge\('createSameSpot', recordId, \{ handoff \}\)/);
  assert.match(sameSpotFlow, /callTrainingMemoryBridge\('getDecision', recordId\)/);
  assert.doesNotMatch(sameSpotFlow, /generateSimilarSpot|resolve\(/);
});

function extractFunction(source, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

for (const mode of ['varied', 'focused', 'full_hand']) {
  test(`active ${mode} blocks Same Spot before any session or planner mutation`, async () => {
    const openSameSpot = extractFunction(logic, 'openTrainingMemorySameSpot');
    const calls = [];
    const sandbox = {
      trainingSessionIsActive: () => true,
      setTrainingMemoryStatus: (message) => calls.push(['status', message]),
      callTrainingMemoryBridge: (...args) => calls.push(['memory', ...args]),
      callTrainingServiceBridge: (...args) => calls.push(['training', ...args]),
    };
    vm.runInNewContext(`${openSameSpot}; this.result = openTrainingMemorySameSpot('record');`, sandbox);
    assert.equal(await sandbox.result, null);
    assert.deepEqual(calls, [[
      'status',
      'Finish or leave your current session before re-drilling this spot.',
    ]]);
  });
}

test('Same Spot never changes or starts a planner mode', () => {
  assert.doesNotMatch(sameSpotFlow, /startPracticeSession|generatePlanned|setTrainingSessionMode/);
  assert.ok(
    sameSpotFlow.indexOf('trainingSessionIsActive()')
      < sameSpotFlow.indexOf("callTrainingMemoryBridge('createSameSpot'"),
  );
});

test('a settled Memory persistence handle cannot block idle Same Spot', () => {
  const isActive = extractFunction(logic, 'trainingSessionIsActive');
  const sandbox = {
    app: { training: {
      memorySessionPromise: Promise.resolve({ id: 'settled-session' }),
      practiceSession: null,
    } },
    document: {
      querySelector: () => ({ dataset: { trainingState: 'idle' } }),
    },
  };
  vm.runInNewContext(`${isActive}; this.result = trainingSessionIsActive();`, sandbox);
  assert.equal(sandbox.result, false);
});

test('canonical ordinary Training states still block Same Spot without relying on Memory writes', () => {
  const isActive = extractFunction(logic, 'trainingSessionIsActive');
  for (const trainingState of ['generating', 'automating', 'ready', 'grading', 'feedback']) {
    const sandbox = {
      app: { training: { memorySessionPromise: null, practiceSession: null } },
      document: {
        querySelector: () => ({ dataset: { trainingState } }),
      },
    };
    vm.runInNewContext(`${isActive}; this.result = trainingSessionIsActive();`, sandbox);
    assert.equal(sandbox.result, true, trainingState);
  }
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.textContent = '';
  }

  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  click() { this.listeners.get('click')?.forEach((listener) => listener({ currentTarget: this })); }
}

function renderedSameSpotButton(openRedrill) {
  const memoryButton = extractFunction(logic, 'trainingMemoryButton');
  const renderDecision = logic.slice(
    logic.indexOf('function renderTrainingMemoryDecisionItem('),
    logic.indexOf('async function populateTrainingMemorySessionDecisions('),
  );
  const sandbox = {
    document: { createElement: (tagName) => new FakeElement(tagName) },
    app: { training: { memoryGeneration: 0 } },
    t: (value) => value,
    trainingMemoryButton: undefined,
    trainingMemoryDecisionSummary: () => new FakeElement('div'),
    trainingMemoryPresentationGate: () => ({ feedbackEmbargoed: false }),
    truthPresentation: () => ({ title: 'Not assessed' }),
    requireStrategyProviderBridge: () => ({ historicalTruth: () => null }),
    trainingMemoryComparisonLabel: (value) => value,
    trainingActionLabel: (value) => value,
    openTrainingMemoryRedrill: openRedrill,
    queueTrainingMemoryWrite: async () => null,
    callTrainingMemoryBridge: () => null,
    refreshTrainingMemoryPanel() {},
    TRAINING_MEMORY_REASON_LABELS: {},
  };
  const record = {
    id: 'decision-record-1',
    status: 'answered',
    decisionContext: {},
    userResponse: { action: { type: 'check' } },
    strategyEvidence: null,
    studyMetadata: { review: false },
    reviewState: { state: 'pending' },
  };
  const context = { ...sandbox, record };
  vm.runInNewContext(
    `${memoryButton}; ${renderDecision}; this.item = renderTrainingMemoryDecisionItem(this.record);`,
    context,
  );
  const find = (element) => element.textContent === 'Same Spot'
    ? element
    : element.children.map(find).find(Boolean);
  return find(context.item);
}

test('rendered and rerendered Recent-session Same Spot actions resolve the live launch path once', async () => {
  const calls = [];
  let bridgeReady = false;
  const openRedrill = (recordId, kind) => {
    calls.push({ recordId, kind, bridgeReady });
  };
  const first = renderedSameSpotButton(openRedrill);
  const rerendered = renderedSameSpotButton(openRedrill);
  bridgeReady = true;
  rerendered.click();
  await Promise.resolve();
  assert.deepEqual(calls, [{
    recordId: 'decision-record-1',
    kind: 'same_spot',
    bridgeReady: true,
  }]);
  assert.ok(first);
});

test('idle Same Spot calls createSameSpot once and opens the standalone lifecycle', async () => {
  const openSameSpot = extractFunction(logic, 'openTrainingMemorySameSpot');
  const lifecycle = createTrainingSameSpotLifecycle();
  const calls = [];
  const exercise = { id: 'same-spot-exercise', seed: 17 };
  const historical = { id: 'decision-record-1' };
  const app = { training: {
    memoryGeneration: 4,
    memoryWritePromise: Promise.resolve(),
    memoryPendingOrigin: null,
    memoryRedrillNote: '',
    sameSpotHistoricalRecord: null,
  } };
  const sandbox = {
    app,
    trainingSessionIsActive: () => false,
    setTrainingMemoryStatus: (value) => calls.push(['status', value]),
    async callTrainingMemoryBridge(method, recordId) {
      calls.push(['memory', method, recordId]);
      if (method === 'createSameSpot') return { exercise };
      if (method === 'getDecision') return historical;
      return null;
    },
    callTrainingServiceBridge(method, input) {
      calls.push(['training', method]);
      if (method === 'beginSameSpot') return lifecycle.begin(input);
      if (method === 'loadExercise') return { ok: true, exercise: input };
      return null;
    },
    setTrainingWorkspaceState() {},
    setFullHandTrainingPhase() {},
    clearTrainingExercisePresentation() {},
    startTemporaryTrainingMemoryReviewSession() {},
    renderCanonicalTrainingExercise() {},
    renderSameSpotSetup() {},
    renderSameSpotComparison() {},
    trainingSameSpotIsActive: () => lifecycle.getState().active,
    exitTrainingSameSpot: async () => null,
    $: () => null,
    window: { matchMedia: () => ({ matches: true }) },
  };
  vm.runInNewContext(
    `${openSameSpot}; this.result = openTrainingMemorySameSpot('decision-record-1');`,
    sandbox,
  );
  assert.equal((await sandbox.result).exercise, exercise);
  assert.equal(calls.filter((entry) => entry[1] === 'createSameSpot').length, 1);
  assert.equal(lifecycle.getState().active, true);
  assert.equal(lifecycle.getState().sourceDecisionRecordId, 'decision-record-1');
});
