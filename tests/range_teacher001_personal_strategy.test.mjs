import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  DIRECT_EVIDENCE_SOURCES,
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  RFI_CALIBRATION_INTENTS,
  RFI_SELECTION_INTENTS,
  assessCalibrationProgress,
  rankCalibrationCandidates,
} from '../app/src/personal-strategy/rfi-question-selection.mjs';
import {
  RANGE_TEACHER_SESSION_PRESETS,
  createRangeTeacherView,
} from '../app/src/personal-strategy/range-teacher-view.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import {
  CALIBRATION_ENVIRONMENTS,
  createContextFromSelection,
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';

const PROFILE_ID = 'teacher-profile';
const MODE_ID = 'teacher-mode';
const T0 = Date.parse('2026-08-18T22:00:00.000Z');
const CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'riverline-home-v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});
let sequence = 0;

function direct(handClass, actionType, overrides = {}) {
  sequence += 1;
  return createRangeObservation({
    id: overrides.id ?? `teacher-evidence-${sequence}`,
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? CONTEXT,
    handClass,
    dominantAction: actionType === null ? null : { type: actionType },
    frequencies: overrides.frequencies ?? null,
    evidenceSource: overrides.evidenceSource,
    actionGroupId: overrides.actionGroupId,
    createdAt: new Date(T0 + sequence * 1000).toISOString(),
  });
}

function teacher(rangeObservations = [], options = {}) {
  const evidenceView = createPersonalStrategyEvidenceView({
    profileId: options.profileId ?? PROFILE_ID,
    modeId: options.modeId ?? MODE_ID,
    context: options.context ?? CONTEXT,
    rangeObservations,
    trainingObservations: [],
  });
  const snapshot = createPersonalStrategySnapshot(evidenceView);
  const candidateRanking = rankCalibrationCandidates(snapshot, {
    selectionIntent: options.selectionIntent ?? RFI_SELECTION_INTENTS.GENERAL,
  });
  const progressAssessment = assessCalibrationProgress(snapshot, {
    intent: RFI_CALIBRATION_INTENTS.STANDARD,
    rankedCandidates: candidateRanking,
  });
  return createRangeTeacherView({
    snapshot,
    evidenceView,
    candidateRanking,
    progressAssessment,
    dismissedSuggestionIds: options.dismissedSuggestionIds ?? [],
  });
}

test('fresh sparse profile produces a truthful unknown-region recommendation', () => {
  const view = teacher();
  assert.equal(view.schemaVersion, 'range-teacher-view/v1');
  assert.equal(view.summary.directCount, 0);
  assert.equal(view.summary.unknownCount, 169);
  assert.ok(view.sparseRegions.length > 0);
  assert.equal(view.recommendedAction.kind, 'explore_sparse_region');
  assert.equal(Object.hasOwn(view.summary, 'confidence'), false);
  assert.equal(JSON.stringify(view).includes('completePercent'), false);
});

test('suited-K and pair boundaries become deterministic local clusters', () => {
  const suited = teacher([
    direct('K9s', ACTION_TYPES.RAISE),
    direct('K7s', ACTION_TYPES.FOLD),
  ]);
  const kx = suited.importantBoundaries.find((cluster) => cluster.centerCandidates.includes('K8s'));
  assert.ok(kx);
  assert.equal(kx.family, 'suited_k');
  assert.equal(kx.strength, 'high');
  assert.ok(kx.directEvidenceIds.length >= 2);

  const pairs = teacher([
    direct('55', ACTION_TYPES.RAISE),
    direct('33', ACTION_TYPES.FOLD),
  ]);
  const pair = pairs.importantBoundaries.find((cluster) => cluster.centerCandidates.includes('44'));
  assert.ok(pair);
  assert.equal(pair.family, 'pocket_pairs');
  assert.equal(pair.familyType, 'pair');
});

test('separate boundary islands stay separate and stable', () => {
  const evidence = [
    direct('K9s', ACTION_TYPES.RAISE), direct('K7s', ACTION_TYPES.FOLD),
    direct('Q9s', ACTION_TYPES.RAISE), direct('Q7s', ACTION_TYPES.FOLD),
  ];
  const first = teacher(evidence);
  const second = teacher(evidence);
  assert.ok(first.importantBoundaries.some((cluster) => cluster.family === 'suited_k'));
  assert.ok(first.importantBoundaries.some((cluster) => cluster.family === 'suited_q'));
  assert.deepEqual(first, second);
});

test('contradictions remain unaveraged and can be left unresolved for the session', () => {
  const evidence = [
    direct('K8s', ACTION_TYPES.RAISE, { id: 'teacher-conflict-raise' }),
    direct('K8s', ACTION_TYPES.FOLD, { id: 'teacher-conflict-fold' }),
  ];
  const view = teacher(evidence);
  assert.equal(view.contradictionHotspots.length, 1);
  assert.equal(view.contradictionHotspots[0].evidence.length, 2);
  assert.equal(view.contradictionHotspots[0].announcedState, 'conflicting');
  assert.deepEqual(new Set(view.contradictionHotspots[0].evidence.map((entry) => entry.dominantAction)), new Set(['raise', 'fold']));
  const suggestionId = view.recommendedAction.suggestionId;
  const dismissed = teacher(evidence, { dismissedSuggestionIds: [suggestionId] });
  assert.notEqual(dismissed.recommendedAction?.suggestionId, suggestionId);
});

test('exact-mix opportunities include unresolved boundaries and dominant-only Builder evidence', () => {
  const unresolved = teacher([
    direct('K9s', ACTION_TYPES.RAISE),
    direct('K7s', ACTION_TYPES.FOLD),
  ]);
  assert.ok(unresolved.exactMixRefinementCandidates.some((entry) => entry.handClass === 'K8s'));

  const builder = teacher([
    direct('K9s', ACTION_TYPES.RAISE),
    direct('K8s', ACTION_TYPES.RAISE, {
      evidenceSource: DIRECT_EVIDENCE_SOURCES.RANGE_BUILDER,
      actionGroupId: 'builder-group-teacher',
    }),
    direct('K7s', ACTION_TYPES.FOLD),
  ]);
  const k8 = builder.exactMixRefinementCandidates.find((entry) => entry.handClass === 'K8s');
  assert.ok(k8);
  assert.equal(k8.sourceKind, 'range_builder');
  assert.equal(builder.recentChanges.some((entry) => (
    entry.sourceKind === 'range_builder' && entry.handClasses.includes('K8s')
  )), true);
  assert.equal(builder.highValueNextQuestions.some((entry) => entry.handClass === 'K8s'), false);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

async function configured(name) {
  let id = 0;
  let tick = 0;
  const mutations = [];
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name }),
    idFactory: (prefix) => `${prefix}-${++id}`,
    clock: () => new Date(T0 + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: 'Teacher profile',
    description: '',
    environment: CALIBRATION_ENVIRONMENTS.HOME,
    modeNames: ['Standard', 'Cautious', 'Pressure'],
  });
  mutations.length = 0;
  const contextSelection = {
    environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  };
  const scope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: createContextFromSelection(contextSelection),
  };
  return { application, bundle, contextSelection, mutations, scope };
}

test('Teacher session presets route through the existing Calibration session and 002C bias', async () => {
  const { application, contextSelection, mutations, scope } = await configured('range-teacher-routing');
  await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'K9s', actionType: ACTION_TYPES.RAISE,
  });
  await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'K7s', actionType: ACTION_TYPES.FOLD,
  });
  mutations.length = 0;
  const state = await application.startOrResumeSession({
    selectedProfileId: scope.profileId,
    activeModeId: scope.modeId,
    context: contextSelection,
    rangeTeacherPreset: RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES,
    forcedHandClass: 'K8s',
  });
  assert.equal(state.prompt.handClass, 'K8s');
  assert.equal(state.session.cursor.selectionIntent, RFI_SELECTION_INTENTS.BOUNDARY_FOCUS);
  assert.equal(state.session.cursor.rangeTeacherPreset, RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES);
  const resumed = await application.startOrResumeSession({
    selectedProfileId: scope.profileId,
    activeModeId: scope.modeId,
    context: contextSelection,
    continueAfterStop: true,
  });
  assert.equal(resumed.session.cursor.selectionIntent, RFI_SELECTION_INTENTS.BOUNDARY_FOCUS);
  assert.equal(resumed.session.cursor.rangeTeacherPreset, RANGE_TEACHER_SESSION_PRESETS.BOUNDARIES);
  assert.ok(mutations.every((mutation) => mutation.entities.every((entity) => (
    entity.schemaVersion === 'calibration-session/v1'
  ))));
  const before = await application.repository.loadSnapshot();
  assert.equal(before.rangeObservations.length, 2, 'launching Teacher does not create strategy evidence');
});

test('Teacher is scope-isolated, source-derived, and never becomes sync/persistence truth', async () => {
  const { application, bundle, scope } = await configured('range-teacher-scope-cloud');
  await application.recordPersonalStrategyMatrixEvidence(null, {
    ...scope, handClass: 'AA', actionType: ACTION_TYPES.RAISE,
  });
  const first = await application.getRangeTeacherView(scope);
  const otherMode = await application.getRangeTeacherView({ ...scope, modeId: bundle.modes[1].id });
  assert.equal(first.summary.directCount, 1);
  assert.equal(otherMode.summary.directCount, 0);
  const portable = await application.exportPortable();
  assert.doesNotMatch(JSON.stringify(portable), /range-teacher-view|boundary-cluster|suggestedActions/);
  const syncEntities = await application.repository.listSyncEntities();
  assert.doesNotMatch(JSON.stringify(syncEntities), /range-teacher-view|boundary-cluster|suggestedActions/);
});

test('Teacher architecture and UI seam contain no Training grading or strategy-provider authority', async () => {
  const [teacherSource, serviceSource, workspaceSource, html, css, localeSource, tutorialSource] = await Promise.all([
    readFile(new URL('../app/src/personal-strategy/range-teacher-view.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-service.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/tutorial/current-app-tutorials.mjs', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(teacherSource, /StrategyProvider|TrainingResult|grade|correct|incorrect|GTO|Equity|HoldemWeightedRange/);
  assert.doesNotMatch(teacherSource, /saveRangeObservation|IndexedDB|repository/);
  assert.match(serviceSource, /getProjectionBundle\(scope\)/);
  assert.match(serviceSource, /requestRangeTeacherSession/);
  assert.match(workspaceSource, /getRangeTeacherView/);
  assert.match(workspaceSource, /requestRangeTeacherSession/);
  assert.doesNotMatch(workspaceSource, /StrategyProvider|TrainingResult|gradeAnswer/);
  assert.match(html, /role="tab"[^>]+aria-controls="calibrationTeacherPanel"/);
  assert.match(html, /id="calibrationUnderstandingTab"[^>]+aria-selected="true"[^>]+aria-controls="calibrationUnderstandingPanel"/);
  assert.match(html, /id="calibrationTeacherTab"[^>]*hidden/);
  assert.match(html, /id="calibrationMatrixTab"[^>]+aria-selected="false"[^>]+aria-controls="calibrationMatrixPanel"[^>]+data-i18n="Matrix Edit"/);
  const understandingTag = html.match(/<section[^>]+id="calibrationUnderstandingPanel"[^>]*>/)?.[0];
  assert.ok(understandingTag);
  assert.doesNotMatch(understandingTag, /\bhidden\b/);
  assert.ok(html.indexOf('id="calibrationUnderstandingPanel"') < html.indexOf('id="calibrationTeacherPanel"'));
  assert.match(html, /id="personalUnderstandingTitle"[^>]+data-i18n="What Riverline understands"/);
  assert.match(html, /id="calibrationTeacherStatus"[^>]+aria-live="polite"/);
  assert.match(html, /class="calibration-teacher-sections"[^>]+role="region"[^>]+aria-labelledby="calibrationTeacherTitle"[^>]+tabindex="0"/);
  assert.match(html, /data-teacher-preset="boundaries"/);
  assert.match(css, /\.calibration-teacher-summary/);
  assert.match(css, /\.calibration-personal-column\s*\{[^}]*display:\s*grid[^}]*align-content:\s*start/);
  assert.match(css, /data-personal-view="understanding"\][^\n]+\.calibration-personal-column\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.personal-understanding-columns\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.calibration-teacher-panel\s*\{[^}]*gap:\s*var\(--space-3\)[^}]*padding:\s*clamp\(var\(--space-3\), 1\.1vw, var\(--space-4\)\)[^}]*overflow:\s*visible/);
  assert.match(css, /\.calibration-teacher-sections\s*\{[^}]*gap:\s*var\(--space-2\)[^}]*align-items:\s*start/);
  assert.match(css, /\.calibration-teacher-sections > section\s*\{[^}]*padding:\s*var\(--space-2\)/);
  assert.doesNotMatch(css, /\.calibration-teacher-sections\s*\{[^}]*overflow:\s*auto/);
  assert.match(css, /@media \(min-width: 1500px\)[\s\S]*?\.calibration-matrix-grid\s*\{[^}]*--personal-matrix-cell:\s*clamp\(34px, 2\.05vw, 40px\)/);
  assert.match(localeSource, /Range Teacher/);
  assert.match(tutorialSource, /personal-understanding/);
  assert.match(tutorialSource, /personal-matrix-edit/);
});
