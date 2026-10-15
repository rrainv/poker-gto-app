import test from 'node:test';
import assert from 'node:assert/strict';
import { indexDocument, precedes, text } from './helpers/app-under-test.mjs';
import { startFreshPersonalRangeMapping } from '../app/src/application/range-calibration-workspace.mjs';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

test('fresh Approach opens one concrete mapping question, while pause/reload and populated scopes stay under user control', async () => {
  const memory = new Map(); let id = 0;
  const app = createRangeCalibrationApplication({ database: createMemoryPersonalStrategyDatabase(),
    storage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
    idFactory: (prefix) => `${prefix}-mapping-ui-${++id}` });
  const bundle = await app.createProfile({ displayName: 'Saturday private game' });
  const context = { environment: 'custom', effectiveStackBb: 100, tableSize: 6, heroPosition: 'BTN', actionAware: true };
  const startedScopes = new Set(); let starts = 0;
  const input = { view: 'understanding', session: null, directCount: 0, scopeKey: 'fresh', startedScopes,
    onStart: async ({ intent }) => {
      starts += 1;
      return app.startOrResumeSession({ selectedProfileId: bundle.profile.id, activeModeId: bundle.modes[0].id, context, intent });
    } };
  const state = await startFreshPersonalRangeMapping(input);
  assert.ok(state.prompt.handClass);
  assert.ok(state.progressAssessment.coverage);
  assert.equal(state.progressAssessment.questionBudget, null);
  assert.equal(startFreshPersonalRangeMapping(input), null);
  const paused = await app.pauseSession(state);
  assert.equal(startFreshPersonalRangeMapping({ ...input, startedScopes: new Set(), session: paused.session }), null);
  assert.equal(startFreshPersonalRangeMapping({ ...input, startedScopes: new Set(), directCount: 3 }), null);
  assert.equal(startFreshPersonalRangeMapping({ ...input, startedScopes: new Set(), view: 'matrix' }), null);
  assert.equal(starts, 1);
  const evidence = await app.getEvidenceView({ profileId: bundle.profile.id, modeId: bundle.modes[0].id, context: createContextFromSelection(context) });
  assert.equal(evidence.summary.directlyAnsweredHandCount, 0);
});

test('first-use composition puts concrete teaching before secondary understanding and keeps optional fields disclosed', () => {
  // TEST-HYGIENE-001: queries the parsed templates instead of slicing index.html.
  // Protects: question view precedes the understanding panel; context input is
  // a disclosed optional field; no fixed question-count promises; the profile
  // modal shows name/table/stack before the advanced disclosure and keeps
  // description/format/assumptions/approach names inside it.
  const document = indexDocument();
  const workspace = document.getElementById('rangeCalibrationTemplate').content;
  assert.ok(precedes(workspace.getElementById('calibrationQuestionView'), workspace.getElementById('calibrationUnderstandingPanel')));
  const disclosure = workspace.getElementById('personalContextInputDisclosure');
  assert.equal(disclosure.tagName, 'details');
  assert.match(text(disclosure.querySelector(':scope > summary')), /^Add context or an exception/);
  assert.ok(workspace.getElementById('personalQuestionAddContext'));
  assert.doesNotMatch(text(workspace), /about five|5 questions|About 30 questions|Up to 75 questions|Question \d+ of \d+/i);
  const modal = document.getElementById('calibrationProfileModalTemplate').content;
  const advanced = modal.getElementById('personalSetupAdvanced');
  for (const id of ['calibrationProfileDisplayName', 'personalSetupTable', 'personalSetupStack']) {
    assert.ok(precedes(modal.getElementById(id), advanced), `${id} precedes the advanced fields`);
  }
  for (const id of ['calibrationProfileDescription', 'personalSetupFormat', 'personalSetupAssumptions', 'personalApproachNameFields']) {
    assert.ok(precedes(advanced, modal.getElementById(id)), `${id} follows the advanced fields`);
  }
});
