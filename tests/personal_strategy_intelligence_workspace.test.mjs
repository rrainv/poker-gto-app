import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountPersonalStrategyUnderstanding } from '../app/src/application/personal-strategy-understanding-workspace.mjs';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

// Behavioral DOM adapter, deliberately without layout/browser claims. It keeps
// event propagation, select options, focus, text nodes and listener cancellation
// observable while the real application owns evidence/persistence/projections.
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.listeners = new Map(); this.hidden = false; this.disabled = false; this._text = ''; this._value = null; this.parentElement = null; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set value(value) { this._value = String(value); }
  get value() { return this._value ?? (this.tagName === 'SELECT' ? this.options[0]?.value ?? '' : ''); }
  get options() { return this.children.filter((c) => c.tagName === 'OPTION'); }
  append(...nodes) { for (const node of nodes) { if (node.tagName === 'FRAGMENT') this.append(...node.children); else { node.parentElement = this; this.children.push(node); } } }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  addEventListener(kind, handler, options = {}) { const rows = this.listeners.get(kind) ?? []; rows.push({ handler, signal: options.signal }); this.listeners.set(kind, rows); }
  async fire(kind, target = this) { const event = { target, preventDefault() {} }; for (const row of this.listeners.get(kind) ?? []) if (!row.signal?.aborted) await row.handler(event); }
  focus() { fakeDocument.activeElement = this; }
  closest(selector) {
    const action = selector.match(/data-intent-action="([^"]+)"/)?.[1];
    if (this.dataset.intentAction && (!action || action === this.dataset.intentAction)) return this;
    return this.parentElement?.closest(selector) ?? null;
  }
}
const fakeDocument = { activeElement: null, createElement: (tag) => new Element(tag), createDocumentFragment: () => new Element('fragment') };
function dom() {
  const source = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  const ids = new Map();
  for (const match of source.matchAll(/<([a-z0-9-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const node = new Element(match[1]); node.id = match[3]; node.hidden = /\shidden(?:\s|=|$)/.test(match[2]);
    node.type = match[2].match(/\btype="([^"]+)"/)?.[1] ?? '';
    ids.set(node.id, node);
  }
  const root = { querySelector: (selector) => ids.get(selector.slice(1)) ?? null };
  const get = (id) => { assert.ok(ids.has(id), `Real HTML contains ${id}`); return ids.get(id); };
  get('personalIntentScope').value = 'decision'; get('personalTeachTopic').value = '';
  return { root, get, source };
}
const selection = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0, anteType: 'none', anteBb: 0 };
function deferred() { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; }
const descend = (node, predicate) => node.children.flatMap((child) => [ ...(predicate(child) ? [child] : []), ...descend(child, predicate) ]);
async function fixture({ intercept = (app) => app, language = 'en', teachingHand = null } = {}) {
  const values = new Map(); let next = 0, tick = 0;
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  const database = createMemoryPersonalStrategyDatabase();
  const makeApp = () => createRangeCalibrationApplication({ storage, database, idFactory: (prefix) => `${prefix}-ui-${++next}`,
    clock: () => new Date(Date.parse('2026-09-05T12:00:00Z') + tick++ * 1000) });
  const app = makeApp();
  const bundle = await app.createProfile({ displayName: 'Private context', modeNames: ['Intent A', 'Intent B'], setupAssumptions: selection });
  let scope = { profileId: bundle.profile.id, modeId: bundle.modes[0].id, context: createContextFromSelection(selection) };
  const workspace = await app.readWorkspace();
  const calls = { teach: [], matrix: [] }, signalController = new AbortController();
  const screen = dom();
  const options = { root: screen.root, application: intercept(app), getScope: () => scope,
    getSelection: () => ({ context: selection }), getTeachingHand: () => teachingHand, getWorkspace: () => workspace, onRefresh: async () => {},
    onTeach: (value) => calls.teach.push(value), onMatrix: (value) => calls.matrix.push(value),
    t: (text, fields = {}) => text.replace(/\{([^}]+)\}/g, (all, key) => fields[key] ?? all), language: () => language, signal: signalController.signal };
  const controller = mountPersonalStrategyUnderstanding(options);
  return { app, makeApp, bundle, get scope() { return scope; }, setScope: (nextScope) => { scope = nextScope; }, workspace,
    ...screen, controller, calls, signalController, remount: (application = makeApp()) => mountPersonalStrategyUnderstanding({ ...options, application }) };
}

test('optional question context binds this hand, while mapping reasons and coverage stay evidence-based', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture({ teachingHand: 'K9s' }); await f.controller.load();
    assert.ok(f.get('personalUnderstandingCoverage').children.length >= 10);
    assert.match(f.get('personalUnderstandingCoverage').textContent, /Not explored/);
    assert.doesNotMatch(f.get('personalTeachReason').textContent, /^[AKQJT2-9]{2}[so]?\s*[·|]|mappingPriority|structural_range_mapping/);
    f.controller.openContext();
    assert.equal(f.get('personalContextInputDisclosure').open, true);
    f.get('personalIntentText').value = "I'd call this against weaker players";
    await f.get('personalIntentForm').fire('submit');
    assert.equal(f.controller.getState().preview.statedScope.handClass, 'K9s');
    assert.match(f.get('personalPreviewStatements').textContent, /K9s/);
    await f.get('personalConfirmIntent').fire('click');
    assert.equal((await f.app.getQualitativeEvidence(f.scope))[0].statedScope.handClass, 'K9s');
    assert.equal((await f.app.getEvidenceView(f.scope)).summary.directlyAnsweredHandCount, 0);
    f.get('personalTeachTopic').value = 'pair_boundary'; await f.get('personalTeachTopic').fire('change');
    await f.get('personalTeachNext').fire('click');
    assert.equal(f.calls.teach.at(-1).intent, 'mapping');
    assert.equal(f.calls.teach.at(-1).focus, 'pair_boundary');
    assert.equal(f.calls.teach.at(-1).handClass.length, 2);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('Coach routes a concrete question and variation through Teach Riverline and clears on owner change', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture(); await f.controller.load();
    const opportunity = f.controller.getState().coach.opportunities[0];
    const controls = descend(f.get('personalCoachCards'), (node) => node.dataset.coachId === opportunity.id);
    assert.ok(controls.length >= 1);
    assert.match(f.get('personalCoachCards').textContent, /unanswered hands|boundary/);
    await f.get('personalCoachCards').fire('click', controls[0]);
    assert.equal(f.calls.teach.at(-1).handClass, opportunity.region.handClass);
    assert.equal(f.calls.teach.at(-1).intent, 'mapping');
    if (opportunity.lesson.variation) {
      await f.get('personalCoachCards').fire('click', controls[1]);
      assert.equal(f.calls.teach.at(-1).handClass, opportunity.lesson.variation.handClass);
    }
    f.signalController.abort();
    assert.equal(f.get('personalCoachCards').textContent, '');
    const count = f.calls.teach.length;
    await f.get('personalCoachCards').fire('click', controls[0]);
    assert.equal(f.calls.teach.length, count);
  } finally { globalThis.document = original; }
});

test('Coach rejects an old card after evidence changes before click', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    let stale = false;
    const f = await fixture({ intercept: (app) => ({ ...app, getEvidenceView: async (...args) => {
      const evidence = await app.getEvidenceView(...args);
      return stale ? { ...evidence, evidenceFingerprint: 'new-evidence' } : evidence;
    } }) });
    await f.controller.load();
    const button = descend(f.get('personalCoachCards'), (node) => node.dataset.intentAction === 'coach')[0];
    stale = true;
    await f.get('personalCoachCards').fire('click', button);
    assert.equal(f.calls.teach.length, 0);
    assert.match(f.get('personalIntentError').textContent, /context changed/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('Coach clears failed comparison cards and rejects changed evidence in the compared Approach', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    let comparedMode = null, changed = false, fail = false;
    const f = await fixture({ intercept: (app) => ({ ...app, getEvidenceView: async (scope) => {
      if (scope.modeId === comparedMode && fail) throw new Error('read failed');
      const evidence = await app.getEvidenceView(scope);
      return changed && scope.modeId === comparedMode ? { ...evidence, evidenceFingerprint: 'changed-right' } : evidence;
    } }) });
    comparedMode = f.bundle.modes[1].id;
    for (const [index, actionType] of [[0, 'fold'], [1, 'raise']]) {
      const state = await f.app.startOrResumeSession({ selectedProfileId: f.scope.profileId, activeModeId: f.bundle.modes[index].id,
        context: selection, forcedHandClass: 'AA', intent: 'quick' });
      await f.app.answerCalibrationQuestion(state, { actionType });
    }
    await f.controller.load(); await f.get('personalCompareApproach').fire('click');
    const opportunity = f.controller.getState().coach.opportunities.find((entry) => entry.kind === 'approach_difference');
    assert.ok(opportunity);
    const act = descend(f.get('personalCoachCards'), (node) => node.dataset.coachId === opportunity.id)[0];
    changed = true;
    await f.get('personalCoachCards').fire('click', act);
    assert.equal(f.calls.teach.length, 0);
    assert.ok(f.controller.getState().coach.opportunities.every((entry) => entry.kind !== 'approach_difference'));
    changed = false; await f.get('personalCompareApproach').fire('click');
    assert.ok(f.controller.getState().coach.opportunities.some((entry) => entry.kind === 'approach_difference'));
    fail = true; await f.get('personalCompareApproach').fire('click');
    assert.match(f.get('personalComparisonSummary').textContent, /unavailable/);
    assert.ok(f.controller.getState().coach.opportunities.every((entry) => entry.kind !== 'approach_difference'));
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('real UI form previews, confirms, corrects and reloads intended statements through application evidence', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture(); await f.controller.load();
    assert.match(f.get('personalUnderstandingScope').textContent, /Intent A/);
    f.get('personalIntentText').value = "I don't like weak offsuit hands";
    await f.get('personalIntentForm').fire('submit');
    assert.equal(f.get('personalIntentPreview').hidden, false);
    assert.match(f.get('personalPreviewStatements').textContent, /don't like weak offsuit hands/);
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 0);
    await f.get('personalConfirmIntent').fire('click');
    assert.match(f.get('personalIntentStatements').textContent, /Confirmed tendency/);
    const correct = descend(f.get('personalIntentStatements'), (node) => node.dataset.intentAction === 'correct')[0];
    assert.equal(correct.tagName, 'BUTTON'); assert.equal(correct.type, 'button');
    await f.get('personalIntentStatements').fire('click', correct);
    assert.equal(f.get('personalCorrectionTarget').hidden, false);
    assert.match(f.get('personalCorrectionTarget').textContent, /Will supersede after confirmation/);
    f.get('personalIntentText').value = 'Only against small opens';
    await f.get('personalIntentText').fire('input');
    await f.get('personalIntentForm').fire('submit');
    await f.get('personalConfirmIntent').fire('click');
    assert.match(f.get('personalIntentStatements').textContent, /Only against small opens/);
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 2);
    f.controller.dispose(); const remounted = f.remount(); await remounted.load();
    assert.match(f.get('personalIntentStatements').textContent, /Only against small opens/);
    f.get('personalVersionHistory').open = true; await f.get('personalVersionHistory').fire('toggle');
    assert.match(f.get('personalHistoryContent').textContent, /Superseded/);
    assert.match(f.get('personalHistoryContent').textContent, /don't like weak offsuit hands/);
    remounted.dispose();
  } finally { globalThis.document = original; }
});

test('editing displayed preview discards it and provisional follow-up never becomes durable intent', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture(); await f.controller.load();
    f.get('personalIntentText').value = 'I avoid weak offsuit hands'; await f.get('personalIntentForm').fire('submit');
    assert.equal(f.controller.getState().next.provisional, true);
    assert.ok(f.controller.getState().next.candidate.handClass.endsWith('o'));
    await f.get('personalTeachNext').fire('click');
    assert.ok(f.calls.teach.at(-1).handClass.endsWith('o'));
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 0);
    f.get('personalIntentText').value = 'I prefer suited hands'; await f.get('personalIntentText').fire('input');
    assert.equal(f.controller.getState().preview, null);
    assert.equal(f.get('personalIntentPreview').hidden, true);
    await f.get('personalConfirmIntent').fire('click');
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 0);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('editing text while interpretation is pending cannot publish or confirm the old preview', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred();
    const f = await fixture({ intercept: (app) => ({ ...app, async previewQualitativeIntent(...args) {
      const result = await app.previewQualitativeIntent(...args); started.release(); await gate.promise; return result;
    } }) }); await f.controller.load();
    f.get('personalIntentText').value = 'Old statement'; const pending = f.get('personalIntentForm').fire('submit'); await started.promise;
    f.get('personalIntentText').value = 'Corrected statement'; await f.get('personalIntentText').fire('input');
    gate.release(); await pending;
    assert.equal(f.controller.getState().preview, null);
    assert.equal(f.get('personalIntentPreview').hidden, true);
    await f.get('personalConfirmIntent').fire('click');
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 0);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('scope transition discards delayed preview and preserves the new Approach projection', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred();
    const f = await fixture({ intercept: (app) => ({ ...app, async previewQualitativeIntent(...args) {
      const result = await app.previewQualitativeIntent(...args); started.release(); await gate.promise; return result;
    } }) }); await f.controller.load();
    f.get('personalIntentText').value = 'Private intention for A'; const pending = f.get('personalIntentForm').fire('submit'); await started.promise;
    f.setScope({ ...f.scope, modeId: f.bundle.modes[1].id }); f.controller.invalidate(); await f.controller.load();
    gate.release(); await pending;
    assert.equal(f.controller.getState().preview, null);
    assert.match(f.get('personalUnderstandingScope').textContent, /Intent B/);
    assert.doesNotMatch(f.get('personalIntentStatements').textContent, /Private intention for A/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('editing a new statement while a confirmed write completes preserves the new draft text', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred();
    const f = await fixture({ intercept: (app) => ({ ...app, async confirmQualitativeIntent(...args) {
      const result = await app.confirmQualitativeIntent(...args); started.release(); await gate.promise; return result;
    } }) }); await f.controller.load();
    f.get('personalIntentText').value = 'Confirmed first statement'; await f.get('personalIntentForm').fire('submit');
    const pending = f.get('personalConfirmIntent').fire('click'); await started.promise;
    f.get('personalIntentText').value = 'New unfinished thought'; await f.get('personalIntentText').fire('input');
    gate.release(); await pending;
    assert.equal(f.get('personalIntentText').value, 'New unfinished thought');
    assert.match(f.get('personalIntentStatements').textContent, /Confirmed first statement/);
    assert.equal((await f.app.getQualitativeEvidence(f.scope)).length, 1);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('delayed old evidence read cannot overwrite a newly selected Approach', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred(); let first = true;
    const f = await fixture({ intercept: (app) => ({ ...app, async getQualitativeEvidence(scope) {
      const result = await app.getQualitativeEvidence(scope); if (first) { first = false; started.release(); await gate.promise; } return result;
    } }) });
    await f.app.confirmQualitativeIntent(await f.app.previewQualitativeIntent(f.scope, { text: 'Old private statement' }));
    const pending = f.controller.load(); await started.promise;
    f.setScope({ ...f.scope, modeId: f.bundle.modes[1].id }); f.controller.invalidate(); await f.controller.load();
    gate.release(); await pending;
    assert.match(f.get('personalUnderstandingScope').textContent, /Intent B/);
    assert.doesNotMatch(f.get('personalIntentStatements').textContent, /Old private statement/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('an older same-Approach read arriving last cannot erase a newer understanding refresh', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred(); let first = true;
    const f = await fixture({ intercept: (app) => ({ ...app, async getQualitativeEvidence(scope) {
      const result = await app.getQualitativeEvidence(scope);
      if (first) { first = false; started.release(); await gate.promise; }
      return result;
    } }) });
    const olderLoad = f.controller.load(); await started.promise;
    await f.app.confirmQualitativeIntent(await f.app.previewQualitativeIntent(f.scope, { text: 'New evidence in the same Approach' }));
    await f.controller.load();
    assert.match(f.get('personalIntentStatements').textContent, /New evidence in the same Approach/);
    gate.release(); await olderLoad;
    assert.match(f.get('personalIntentStatements').textContent, /New evidence in the same Approach/);
    assert.doesNotMatch(f.get('personalIntentStatements').textContent, /No qualitative intention confirmed/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('comparison presents inspectable facts and uses action differences without a normative judgment', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture();
    for (const [index, actionType] of [[0, 'fold'], [1, 'raise']]) {
      const state = await f.app.startOrResumeSession({ selectedProfileId: f.scope.profileId, activeModeId: f.bundle.modes[index].id,
        context: selection, forcedHandClass: 'AA', intent: 'quick' });
      await f.app.answerCalibrationQuestion(state, { actionType });
    }
    await f.controller.load(); await f.get('personalCompareApproach').fire('click');
    assert.match(f.get('personalComparisonSummary').textContent, /preferred continues|preferred actions/);
    const comparison = JSON.parse(f.get('personalComparisonFacts').textContent);
    assert.equal(comparison.kind, 'personal_to_personal');
    assert.equal(comparison.regions.find((r) => r.id === 'pairs').permission.normative, false);
    assert.ok(descend(f.get('personalRangeFacts'), (node) => node.tagName === 'PRE').length);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('restoring historical wording supersedes only its correction chain and preserves unrelated intentions', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture();
    const first = await f.app.confirmQualitativeIntent(await f.app.previewQualitativeIntent(f.scope, { text: 'Original preference' }));
    const correction = await f.app.confirmQualitativeIntent(await f.app.previewQualitativeIntent(f.scope,
      { text: 'Corrected preference', supersedesEvidenceIds: [first.id] }));
    const unrelated = await f.app.confirmQualitativeIntent(await f.app.previewQualitativeIntent(f.scope, { text: 'Independent intention' }));
    await f.controller.load();
    f.get('personalVersionHistory').open = true; await f.get('personalVersionHistory').fire('toggle');
    const restore = descend(f.get('personalHistoryContent'), (node) => node.dataset.intentAction === 'restore' && node.dataset.evidenceId === first.id)[0];
    await f.get('personalHistoryContent').fire('click', restore);
    assert.equal(f.get('personalIntentText').value, 'Original preference');
    await f.get('personalIntentForm').fire('submit'); await f.get('personalConfirmIntent').fire('click');
    const history = await f.app.getQualitativeEvidence(f.scope);
    assert.equal(history.length, 4);
    const restored = history.find((record) => record.id !== first.id && record.originalWording === first.originalWording);
    assert.deepEqual(restored.supersedesEvidenceIds, [correction.id]);
    assert.ok(!history.some((record) => record.supersedesEvidenceIds.includes(unrelated.id)));
    assert.match(f.get('personalIntentStatements').textContent, /Independent intention/);
    assert.match(f.get('personalIntentStatements').textContent, /Original preference/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('late comparison results cannot repopulate the previous scope and new comparison controls recover', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const gate = deferred(), started = deferred(); let pause = false, delayed = false;
    const f = await fixture({ intercept: (app) => ({ ...app, async getEvidenceView(scope) {
      const result = await app.getEvidenceView(scope);
      if (pause && !delayed) { delayed = true; started.release(); await gate.promise; }
      return result;
    } }) }); await f.controller.load();
    pause = true;
    const pending = f.get('personalCompareApproach').fire('click'); await started.promise;
    f.setScope({ ...f.scope, modeId: f.bundle.modes[1].id }); f.controller.invalidate(); await f.controller.load();
    gate.release(); await pending;
    assert.equal(f.get('personalComparisonSummary').textContent, '');
    assert.equal(f.get('personalComparisonFacts').textContent, '');
    assert.equal(f.get('personalCompareApproach').disabled, false);
    assert.equal(f.get('personalCompareSource').disabled, false);
    assert.match(f.get('personalUnderstandingScope').textContent, /Intent B/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('user wording is rendered as text with automatic direction and raw evidence remains LTR', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture({ language: 'he' }); await f.controller.load();
    const wording = 'אני לא אוהב <img src=x onerror=alert(1)> ידיים אוף סוט';
    f.get('personalIntentText').value = wording; await f.get('personalIntentForm').fire('submit');
    await f.get('personalConfirmIntent').fire('click');
    const quotes = descend(f.get('personalIntentStatements'), (node) => node.tagName === 'BLOCKQUOTE');
    assert.equal(quotes[0].textContent, wording); assert.equal(quotes[0].dir, 'auto');
    assert.equal(descend(f.get('personalIntentStatements'), (node) => node.tagName === 'IMG').length, 0);
    const raw = descend(f.get('personalIntentStatements'), (node) => node.tagName === 'PRE')[0];
    assert.equal(raw.dir, 'ltr');
    assert.match(JSON.parse(raw.textContent).originalWording, /לא/);
    f.controller.dispose();
  } finally { globalThis.document = original; }
});

test('owner abort immediately clears the previous understanding identity, counts and pending output', async () => {
  const original = globalThis.document; globalThis.document = fakeDocument;
  try {
    const f = await fixture(); await f.controller.load();
    assert.match(f.get('personalUnderstandingScope').textContent, /Private context/);
    f.signalController.abort();
    assert.equal(f.get('personalUnderstandingScope').textContent, '');
    assert.equal(f.get('personalUnderstandingStatus').textContent, '');
    assert.equal(f.get('personalTeachReason').textContent, '');
    assert.equal(f.get('personalIntentStatements').textContent, '');
    assert.equal(f.controller.getState().preview, null);
  } finally { globalThis.document = original; }
});
