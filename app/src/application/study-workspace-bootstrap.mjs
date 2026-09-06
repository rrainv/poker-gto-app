import { createStudyInboxReader } from './study-inbox.mjs';
import { renderDeepReview, renderStudyInbox } from './study-workspace.mjs';
import { studyCopy } from './study-language.mjs';
import { createContextFromSelection, createIdentityScopedRangeCalibrationApplication } from './range-calibration-service.mjs';
import { readHandImportStudy } from './hand-import-study.mjs';

export async function readSelectedPersonalConflicts(identity) {
  const scope = await identity.captureLifecycleScope('personal_strategy'); scope.assertCurrent();
  const app = createIdentityScopedRangeCalibrationApplication(scope.domainOwnerBinding, { lifecycleScope: scope });
  try {
    const workspace = await app.readWorkspace(); scope.assertCurrent();
    const profileId = workspace.preferences.selectedProfileId;
    const preference = workspace.preferences.byProfile[profileId];
    if (!preference) return [];
    const selected = { profileId, modeId: preference.activeModeId, context: createContextFromSelection(preference.context) };
    const view = await app.getEvidenceView(selected); scope.assertCurrent();
    return view.points.filter(point => point.conflict).map(point => ({
      id: point.conflict.conflictId, handClass: point.handClass, context: selected.context,
      scope: view.scope, evidenceIds: point.sourceEvidenceIds,
    }));
  } finally { await app.repository.close(); }
}

export function installStudyWorkspaceBridge(browserWindow) {
  const roots = new Set(); let epoch = 0, reviewState = null, inboxOptions = null, inboxFlight = 0;
  const identity = () => browserWindow.RiverlineAccountIdentity;
  const generation = () => identity()?.getLifecycleState?.().lifecycleGeneration;
  const language = () => browserWindow.appLang || 'en';
  const reader = createStudyInboxReader({ captureScope: () => identity().captureLifecycleScope(),
    memory: () => browserWindow.RiverlineTrainingMemory, saved: () => browserWindow.RiverlineSavedStudyObjects,
    readConflicts: () => readSelectedPersonalConflicts(identity()) });

  async function loadInbox(options = inboxOptions) {
    if (!options) return;
    inboxOptions = options; roots.add(options.root);
    const request = ++inboxFlight, owner = generation();
    const current = () => request === inboxFlight && owner === generation() && options.root.isConnected;
    options.root.textContent = studyCopy('loading', language());
    try {
      const model = await reader.load();
      if (!current()) return;
      renderStudyInbox({ ...options, model, language: language(), isCurrent: current });
    } catch { if (current()) options.root.textContent = studyCopy('partial', language()); }
  }
  function clear() {
    epoch++; inboxFlight++; reviewState = null;
    for (const root of roots) root.replaceChildren();
  }
  browserWindow.addEventListener('riverline:identitychange', clear);
  browserWindow.addEventListener('riverline:authchange', clear);

  function renderReview(options) {
    const { root, review } = options; roots.add(root);
    if (review.status !== 'ready') { root.replaceChildren(); return; }
    const owner = generation();
    if (!reviewState || reviewState.handId !== review.handId || reviewState.owner !== owner || reviewState.epoch !== epoch) {
      reviewState = { handId: review.handId, owner, epoch, evidence: {}, records: new Map(), loaded: false, pending: true, unavailable: [] };
    }
    const state = reviewState; state.options = options;
    const current = () => state === reviewState && owner === generation() && root.isConnected;
    const paint = () => {
      if (!current()) return;
      const renderedDecisionId = state.options.review.selectedDecision.decisionId;
      const paintId = state.paintId = (state.paintId ?? 0) + 1;
      const selectedCurrent = () => current() && state.paintId === paintId && state.options.review.selectedDecision.decisionId === renderedDecisionId;
      renderDeepReview({ ...state.options, evidence: state.evidence, evidencePending: state.pending,
        evidenceUnavailable: state.unavailable, language: language(), isCurrent: selectedCurrent,
        onAction: async (action, delta) => {
          if (!selectedCurrent()) return;
          const record = state.records.get(delta.decisionId);
          if (action === 'inspect') {
            const inspection = state.inspection = (state.inspection ?? 0) + 1;
            const inspectionCurrent = () => current() && state.inspection === inspection
              && state.options.review.selectedDecision.decisionId === delta.decisionId;
            const input = await state.options.getPersonalInput(record);
            if (!inspectionCurrent()) return;
            if (!input) return 'unavailable';
            const personal = await readHandImportStudy(input, { identity: identity() });
            if (!inspectionCurrent()) return;
            state.evidence[delta.decisionId] = { ...state.evidence[delta.decisionId], personal };
            paint(); return;
          }
          if (['practice', 'similar'].includes(action) && !record) return 'practiceLimit';
          if (action === 'teach') return 'teachLimit';
          if (action === 'unresolved') return null;
          return state.options.onAction(action, delta, record);
        } });
    };
    paint();
    if (state.loaded) return;
    state.loaded = true;
    void (async () => {
      const scope = await identity().captureLifecycleScope(); scope.assertCurrent();
      const results = await Promise.allSettled([
        Promise.all([browserWindow.RiverlineSavedStudyObjects.listForReview({ limit: 50 }),
          browserWindow.RiverlineSavedStudyObjects.listRecent({ limit: 50 })]),
        options.getMemoryRecords?.() ?? Promise.resolve([]),
      ]);
      scope.assertCurrent(); if (!current()) return;
      state.pending = false;
      state.unavailable = results.flatMap((result, index) => result.status === 'rejected'
        ? [index === 0 ? 'saved_study_objects' : 'training_memory'] : []);
      const saved = results[0].status === 'fulfilled' ? results[0].value.flat() : [];
      const records = results[1].status === 'fulfilled' ? results[1].value : [];
      for (const decision of review.decisions) {
        const object = saved.find(object => object.source.sourceId === `${review.handId}:${decision.decisionId}`);
        const record = records.find(record => record.decisionSource.handId === review.handId
          && record.decisionSource.replayPoint?.eventSequence === decision.replayFrameTarget.eventSequence);
        if (record) state.records.set(decision.decisionId, record);
        state.evidence[decision.decisionId] = { ...state.evidence[decision.decisionId],
          annotations: object?.annotations, studyMetadata: record?.studyMetadata, learningEvidence: record?.learningEvidence };
      }
      paint();
    })().catch(() => { if (current()) { state.pending = false;
      state.unavailable = ['saved_study_objects', 'training_memory']; paint(); } });
  }
  const bridge = Object.freeze({ renderReview, loadInbox, copy: studyCopy,
    invalidate() { epoch++; reviewState = null; if (inboxOptions?.root?.isConnected && inboxOptions.visible?.()) void loadInbox(); },
    clear });
  Object.defineProperty(browserWindow, 'RiverlineStudy', { configurable: true, value: bridge });
  return bridge;
}
if (typeof window !== 'undefined') installStudyWorkspaceBridge(window);
