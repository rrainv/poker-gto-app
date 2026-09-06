import { renderIntentInterpretation } from '../personal-strategy/intent-interpretation.mjs';
import { createPersonalRangeLanguageFacts, renderPersonalRangeLanguageFacts,
  comparePersonalRangeLanguageFacts, renderPersonalRangeComparison, personalRangeRegionLabel } from '../personal-strategy/range-language-facts.mjs';
import { choosePersonalTeachingNext, comparePersonalStrategyWithSource } from './personal-strategy-intelligence.mjs';
import { createPersonalCoach, createPersonalCoachRequest, renderPersonalCoachLesson } from '../personal-strategy/coach.mjs';
import { mountPersonalStrategyHandWorkspace } from './personal-strategy-hand-workspace.mjs';


export function renderPersonalMappingCoverage(target, coverage, t) {
  if (!target) return;
  const labels = { unknown: 'Not explored', partial: 'Partly mapped', initially_sampled: 'Initial map', conflict: 'Conflict' };
  target.replaceChildren(...(coverage?.families ?? []).map((family) => {
    const row = document.createElement('li');
    const name = document.createElement('span'); name.textContent = t(family.labelKey);
    const state = document.createElement('strong'); state.textContent = t(labels[family.state] ?? 'Partly mapped');
    row.dataset.coverageState = family.state; row.append(name, state); return row;
  }));
}

// Presentation/application adapter over the existing service. It never opens
// storage, resolves poker facts locally, or persists drafts/chat transcripts.
export function mountPersonalStrategyUnderstanding({ root, application, getScope, getSelection, getWorkspace,
  onRefresh, onTeach, onMatrix, getTeachingHand = () => null, t, language, signal } = {}) {
  const q = (id) => root.querySelector(`#${id}`);
  const lifecycle = new AbortController();
  const handWorkspace = mountPersonalStrategyHandWorkspace({ root: q('personalHandWorkspace'), application,
    getScope, t, language, onTeach, onMatrix, signal: lifecycle.signal });
  signal?.addEventListener('abort', () => dispose(), { once: true });
  let generation = 0, draftVersion = 0, loadVersion = 0, nextVersion = 0, preview = null, correctionIds = [], exceptionTo = null;
  let qualitative = [], facts = null, matrix = null, next = null, busy = false;
  let recentHands = [], contextHand = null;
  let coachEvidence = null, coachCandidates = [], coach = null, coachComparison = null;
  let coachAvailable = false;
  const key = () => JSON.stringify(getScope());
  const current = (version, scopeKey) => !lifecycle.signal.aborted && version === generation && key() === scopeKey;
  const capture = () => ({ version: generation, scopeKey: key() });
  const assertCurrent = ({ version, scopeKey }) => {
    application.lifecycleScope?.assertCurrent();
    if (!current(version, scopeKey)) throw new Error('stale_personal_strategy_scope');
  };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, action, id) => {
    const node = element('button', t(text), 'ui-button ui-button--tertiary');
    node.type = 'button'; node.dataset.intentAction = action; if (id) node.dataset.evidenceId = id;
    return node;
  };
  function lines(id, values) { q(id).replaceChildren(...values.map((value) => element('li', value))); }
  function error(caught) {
    q('personalIntentError').textContent = t(String(caught?.message).includes('stale')
      ? 'The selected context changed. Preview your intention again.'
      : 'Your change was not saved. Check the fields and try again.');
  }
  function discardPreview() {
    draftVersion += 1;
    if (preview) { try { application.discardQualitativeIntent(preview); } catch { /* Revoked scopes already make the draft unusable. */ } }
    preview = null; q('personalIntentPreview').hidden = true;
  }
  function resetCorrection() {
    correctionIds = []; exceptionTo = null;
    q('personalCorrectionTarget').hidden = true;
    q('personalCancelCorrection').hidden = true;
  }
  function invalidate() {
    handWorkspace.invalidate();
    generation += 1; busy = false;
    discardPreview(); resetCorrection(); qualitative = []; facts = matrix = next = null;
    recentHands = []; contextHand = null;
    coachEvidence = coach = coachComparison = null; coachCandidates = [];
    coachAvailable = false;
    q('personalCoachCards')?.replaceChildren();
    if (q('personalContextInputDisclosure')) q('personalContextInputDisclosure').open = false;
    for (const id of ['personalIntentStatements', 'personalRangeSummary', 'personalRangeFacts', 'personalComparisonSummary', 'personalHistoryContent', 'personalUnderstandingCoverage']) q(id)?.replaceChildren();
    q('personalIntentText').value = ''; q('personalIntentScopeNote').value = '';
    q('personalComparisonFacts').textContent = ''; q('personalIntentError').textContent = '';
    for (const id of ['personalUnderstandingScope', 'personalUnderstandingStatus', 'personalTeachReason', 'personalApproachError']) q(id).textContent = '';
    q('personalComparisonApproach').replaceChildren();
    q('personalCompareSource').disabled = false; q('personalCompareApproach').disabled = true;
    q('personalTeachNext').disabled = true;
    q('personalConfirmIntent').disabled = false;
  }
  function active() {
    const scope = getScope();
    const entry = getWorkspace().profiles.find((item) => item.profile.id === scope?.profileId);
    return { entry, approach: entry?.modes.find((item) => item.id === scope?.modeId) };
  }
  function scopeLabel(statedScope) {
    const context = statedScope?.context;
    const family = { preflop_rfi: 'First in / Unopened pot', preflop_facing_limp: 'Facing limp',
      preflop_facing_open: 'Facing open', preflop_facing_3bet: 'Facing 3-bet',
      preflop_facing_4bet: 'Facing 4-bet', preflop_bb_option: 'BB option' }[context?.decisionFamily];
    const label = statedScope?.kind === 'approach' ? t('This Approach broadly') : context
      ? `${context.tableSize}-max · ${context.heroPosition} · ${context.stack?.valueBb ?? context.effectiveStackBb}bb · ${t(family ?? 'Selected decision context')}`
      : t('Selected decision context');
    return `${label}${statedScope?.handClass ? ` (${statedScope.handClass})` : ''}${statedScope?.description ? ` · ${statedScope.description}` : ''}`;
  }
  function renderStatements() {
    const superseded = new Set(qualitative.flatMap((record) => record.supersedesEvidenceIds));
    const { entry } = active();
    const heads = qualitative.filter((record) => !superseded.has(record.id));
    q('personalIntentStatements').replaceChildren(...heads.map((record) => {
      const card = element('article', undefined, 'personal-intent-card');
      const quote = element('blockquote', record.originalWording); quote.dir = 'auto';
      const previousSetup = entry.profile.versionHistory.find((item) => item.setupVersion === record.statedScope?.setupVersion);
      const changedAssumptions = previousSetup && JSON.stringify(previousSetup.setupAssumptions) !== JSON.stringify(entry.profile.setupAssumptions);
      const label = changedAssumptions ? 'Needs revalidation' : record.unresolvedTerms.length ? 'Confirmed tendency · boundaries unresolved' : 'Confirmed qualitative tendency';
      card.append(element('strong', t(label)), quote);
      card.append(element('p', scopeLabel(record.statedScope)));
      if (record.provenance?.exceptionTo) card.append(element('p', t('Explicit exception; the original statement remains in history.')));
      const actions = element('div', undefined, 'personal-inline-actions');
      actions.append(button("That's not what I meant", 'correct', record.id), button('Narrow the scope', 'narrow', record.id), button('Add an exception', 'exception', record.id));
      const details = element('details'); details.append(element('summary', t('Evidence and interpretation')));
      const raw = element('pre', JSON.stringify(record, null, 2)); raw.dir = 'ltr'; details.append(raw);
      card.append(actions, details); return card;
    }));
    if (!heads.length) q('personalIntentStatements').append(element('p', t('Add context or an exception')));
  }
  async function renderNext() {
    if (!getScope() || lifecycle.signal.aborted) return;
    const token = capture(), requestVersion = ++nextVersion;
    const userTopic = q('personalTeachTopic').value || null;
    const provisional = preview;
    q('personalTeachNext').disabled = true;
    try {
      const projection = await application.getRangeMappingProjection(getScope(), {
        focus: userTopic ?? provisional?.followupTopic ?? null, recentHands,
      });
      if (!current(token.version, token.scopeKey) || requestVersion !== nextVersion) return;
      next = choosePersonalTeachingNext({ candidates: projection.candidates, userTopic, provisional });
      coachAvailable = projection.available !== false;
      coachCandidates = projection.candidates;
      if (projection.evidenceFingerprint && projection.evidenceFingerprint !== coachEvidence?.evidenceFingerprint) {
        coachAvailable = false; coach = null;
      }
      renderCoach();
      renderPersonalMappingCoverage(q('personalUnderstandingCoverage'), projection.coverage, t);
      q('personalMapRange').textContent = t(projection.coverage?.initialMapReady ? 'Refine this range' : 'Map this range');
      q('personalTeachReason').textContent = t(next.reasonKey);
      q('personalTeachNext').disabled = !next.candidate;
    } catch (caught) { if (current(token.version, token.scopeKey) && requestVersion === nextVersion) error(caught); }
  }
  function renderCoach() {
    const target = q('personalCoachCards');
    if (!target || !coachEvidence) return;
    if (!coachAvailable) {
      coach = null;
      target.replaceChildren(element('p', t('Coaching needs current first-in preflop evidence. Refresh this selection to continue.')));
      return;
    }
    coach = createPersonalCoach({ evidenceView: coachEvidence, candidates: coachCandidates, comparison: coachComparison });
    target.replaceChildren(...coach.opportunities.map((opportunity, index) => {
      const lesson = renderPersonalCoachLesson(opportunity, { t, language: language() });
      const card = element(index === 0 ? 'article' : 'details', undefined, `personal-coach-card ${index === 0 ? 'personal-coach-card--primary' : 'personal-coach-card--secondary'}`);
      card.append(element(index === 0 ? 'h4' : 'summary', lesson.title));
      const context = element('p', `${lesson.region} `, 'personal-coach-region'); const hand = element('bdi', lesson.handClass, 'personal-coach-hand'); hand.dir = 'ltr'; context.append(hand);
      card.append(context, element('p', lesson.explanation, 'personal-coach-reason'), element('p', lesson.question, 'personal-coach-question'));
      const actions = element('div', undefined, 'personal-inline-actions');
      const act = button(opportunity.suggestedAction.destination === 'matrix' ? 'Inspect this answer' : 'Teach this hand', 'coach');
      if (index === 0) act.className = 'ui-button ui-button--secondary personal-coach-primary-action';
      act.dataset.coachId = opportunity.id; actions.append(act);
      if (lesson.variation) {
        const variation = button('Try a nearby hand', 'coach'); variation.dataset.coachId = opportunity.id;
        variation.dataset.coachVariation = 'true'; actions.append(variation);
      }
      card.append(actions);
      const details = element('details', undefined, 'personal-coach-support'); details.append(element('summary', t('What would change this?')),
        element('p', lesson.whatChanges), element('p', lesson.coverage, 'personal-coach-precision'));
      const raw = element('pre', JSON.stringify(opportunity.envelope, null, 2)); raw.dir = 'ltr';
      const evidence = element('details'); evidence.append(element('summary', t('Evidence and interpretation')), raw);
      details.append(evidence); card.append(details); return card;
    }));
    if (!coach.opportunities.length) target.append(element('p', t('No unresolved coaching question in this selection.')));
  }
  function renderRange() {
    const insights = renderPersonalRangeLanguageFacts(facts, { language: language(), withPresentation: true });
    q('personalRangeSummary').replaceChildren(...insights.map((insight, index) => {
      const startsGroup = index === 0 || insights[index - 1].kind !== insight.kind;
      const row = element('li', undefined, `personal-insight-row${startsGroup ? ' personal-insight-row--group-start' : ''}`);
      row.dataset.insightKind = insight.kind;
      row.append(element('span', startsGroup ? insight.label : '', 'personal-insight-label'), element('p', insight.text));
      return row;
    }));
    const details = document.createDocumentFragment();
    for (const region of facts.regions) {
      const row = element('details'); row.append(element('summary', `${personalRangeRegionLabel(region.id, language())} · ${region.directClasses}/${region.totalClasses}`));
      const raw = element('pre', JSON.stringify(region, null, 2)); raw.dir = 'ltr'; row.append(raw); details.append(row);
    }
    q('personalRangeFacts').replaceChildren(details);
  }
  async function load() {
    const scope = getScope(); if (!scope || lifecycle.signal.aborted) return;
    handWorkspace.invalidate();
    const token = capture();
    const expectedLoadVersion = ++loadVersion;
    coach = coachEvidence = coachComparison = null; coachCandidates = [];
    coachAvailable = false;
    q('personalCoachCards')?.replaceChildren();
    q('personalUnderstandingStatus').textContent = t('Reading your intended evidence…');
    try {
      const [evidenceView, statements, projection] = await Promise.all([
        application.getEvidenceView(scope), application.getQualitativeEvidence(scope), application.getPersonalStrategyMatrixProjection(scope),
      ]);
      if (!current(token.version, token.scopeKey) || expectedLoadVersion !== loadVersion) return;
      qualitative = statements; matrix = projection;
      coachEvidence = evidenceView;
      facts = createPersonalRangeLanguageFacts({ evidenceView });
      const { entry, approach } = active();
      const selection = getSelection();
      q('personalUnderstandingScope').textContent = `${entry.profile.displayName} · ${approach.displayName} · ${selection.context.heroPosition} · ${selection.context.effectiveStackBb}bb`;
      const counts = projection.cells.reduce((total, cell) => { total[cell.status] = (total[cell.status] ?? 0) + 1; return total; }, {});
      q('personalUnderstandingStatus').textContent = t('{direct} specified · {supported} supported estimates · {tentative} tentative · {transferred} transferred · {unknown} unknown · {conflict} conflicts', {
        direct: counts.directly_known ?? 0, supported: counts.inferred_high ?? 0, transferred: counts.transferred ?? 0,
        tentative: (counts.inferred_medium ?? 0) + (counts.uncertain ?? 0), unknown: counts.unknown ?? 0, conflict: counts.conflicting ?? 0,
      });
      renderStatements(); renderRange(); await renderNext();
      if (!current(token.version, token.scopeKey) || expectedLoadVersion !== loadVersion) return;
      q('personalComparisonApproach').replaceChildren(...getWorkspace().profiles.flatMap((other) => other.modes
        .filter((mode) => mode.id !== approach.id).map((mode) => {
          const option = element('option', `${other.profile.displayName} · ${mode.displayName}`);
          option.value = JSON.stringify({ profileId: other.profile.id, modeId: mode.id }); option.dir = 'auto'; return option;
        })));
      q('personalCompareApproach').disabled = !q('personalComparisonApproach').options.length;
    } catch (caught) { if (current(token.version, token.scopeKey) && expectedLoadVersion === loadVersion) { error(caught); q('personalUnderstandingStatus').textContent = t('Understanding unavailable'); } }
  }
  async function previewIntent(event) {
    event?.preventDefault(); if (busy) return;
    const token = capture(); busy = true; discardPreview(); const expectedDraftVersion = draftVersion;
    try {
      const value = await application.previewQualitativeIntent(getScope(), {
        text: q('personalIntentText').value, language: language(), handClass: contextHand, scopeKind: q('personalIntentScope').value,
        scopeDescription: q('personalIntentScopeNote').value, supersedesEvidenceIds: correctionIds, exceptionTo,
      });
      if (!current(token.version, token.scopeKey) || draftVersion !== expectedDraftVersion) { application.discardQualitativeIntent(value); return; }
      preview = value;
      const rendered = renderIntentInterpretation(value, language());
      lines('personalPreviewStatements', [...rendered.statements, `${t('Applies to')}: ${scopeLabel(value.statedScope)}`]);
      q('personalPreviewUncertainty').textContent = rendered.uncertainty;
      q('personalPreviewFollowup').textContent = rendered.followup;
      q('personalIntentPreview').hidden = false; q('personalIntentError').textContent = '';
      await renderNext(); q('personalPreviewTitle').focus();
    } catch (caught) { if (current(token.version, token.scopeKey)) error(caught); }
    finally { if (current(token.version, token.scopeKey)) busy = false; }
  }
  async function confirmIntent() {
    if (busy || !preview) return;
    const token = capture(); const expectedDraftVersion = draftVersion; busy = true; q('personalConfirmIntent').disabled = true;
    try {
      await application.confirmQualitativeIntent(preview);
      if (!current(token.version, token.scopeKey)) return;
      if (draftVersion === expectedDraftVersion) {
        preview = null; q('personalIntentPreview').hidden = true; resetCorrection();
        q('personalIntentText').value = ''; q('personalIntentScopeNote').value = '';
      }
      q('personalIntentError').textContent = '';
      await load(); q('personalIntentText').focus();
    } catch (caught) { if (current(token.version, token.scopeKey)) error(caught); }
    finally { if (current(token.version, token.scopeKey)) { busy = false; q('personalConfirmIntent').disabled = false; } }
  }
  function beginCorrection(record, kind = 'correct') {
    q('personalContextInputDisclosure').open = true; contextHand = record.statedScope?.handClass ?? null;
    discardPreview(); correctionIds = kind === 'exception' ? [] : [record.id]; exceptionTo = kind === 'exception' ? record.id : null;
    q('personalIntentText').value = kind === 'exception' ? '' : record.originalWording;
    q('personalIntentScope').value = record.statedScope?.kind ?? 'decision';
    q('personalIntentScopeNote').value = kind === 'exception' ? '' : record.statedScope?.description ?? '';
    q('personalCorrectionTarget').textContent = `${t(kind === 'exception' ? 'Add an exception to' : 'Will supersede after confirmation')}: “${record.originalWording}” · ${scopeLabel(record.statedScope)} · ${record.id}`;
    q('personalCorrectionTarget').hidden = false; q('personalCancelCorrection').hidden = false;
    (kind === 'narrow' ? q('personalIntentScopeNote') : q('personalIntentText')).focus();
  }
  async function compare(source = false) {
    if (!facts || busy) return;
    const token = capture(); busy = true;
    coachComparison = null; renderCoach();
    q('personalCompareSource').disabled = true; q('personalCompareApproach').disabled = true;
    lines('personalComparisonSummary', [t('Comparing compatible evidence…')]);
    try {
      const { entry, approach } = active(); let comparison, rightName;
      if (source) comparison = await comparePersonalStrategyWithSource({ facts, scope: getScope(), selection: getSelection().context,
        assertCurrent: () => assertCurrent(token) });
      else {
        const target = JSON.parse(q('personalComparisonApproach').value);
        const other = getWorkspace().profiles.find((item) => item.profile.id === target.profileId);
        rightName = `${other.profile.displayName} · ${other.modes.find((item) => item.id === target.modeId).displayName}`;
        const otherFacts = createPersonalRangeLanguageFacts({ evidenceView: await application.getEvidenceView({ ...target, context: getScope().context }) });
        comparison = comparePersonalRangeLanguageFacts(facts, otherFacts);
        comparison = { ...comparison, setupAssumptions: { left: entry.profile.setupAssumptions, right: other.profile.setupAssumptions },
          basis: 'same_exact_decision_context_across_named_setups' };
      }
      assertCurrent(token);
      coachComparison = comparison; renderCoach();
      lines('personalComparisonSummary', renderPersonalRangeComparison(comparison, { language: language(), leftName: approach.displayName, rightName }));
      q('personalComparisonFacts').textContent = JSON.stringify(comparison, null, 2);
    } catch (caught) { if (current(token.version, token.scopeKey)) { lines('personalComparisonSummary', [t('Comparison unavailable for this context.')]); error(caught); } }
    finally { if (current(token.version, token.scopeKey)) { busy = false; q('personalCompareSource').disabled = false; q('personalCompareApproach').disabled = !q('personalComparisonApproach').options.length; } }
  }
  async function loadHistory() {
    if (!q('personalVersionHistory').open || !getScope()) return;
    const token = capture();
    try {
      const history = await application.getApproachHistory(getScope()); assertCurrent(token);
      const content = element('div');
      content.append(element('p', `${t('Approach version')}: ${history.mode.approachVersion} · ${t('Evidence revision')}: ${history.revision}`));
      const superseded = new Set(history.qualitativeEvidence.flatMap((record) => record.supersedesEvidenceIds));
      for (const record of [...history.qualitativeEvidence].reverse()) {
        const row = element('article'); row.append(element('p', `${record.createdAt} · ${t(superseded.has(record.id) ? 'Superseded' : 'Confirmed qualitative tendency')} · ${record.originalWording}`));
        if (superseded.has(record.id)) row.append(button('Restore through a new correction', 'restore', record.id));
        content.append(row);
      }
      const details = element('details'); details.append(element('summary', t('Complete version and evidence facts')));
      const raw = element('pre', JSON.stringify(history, null, 2)); raw.dir = 'ltr'; details.append(raw); content.append(details);
      q('personalHistoryContent').replaceChildren(content);
    } catch (caught) { if (current(token.version, token.scopeKey)) error(caught); }
  }
  function listen(id, event, handler) { q(id).addEventListener(event, handler, { signal: lifecycle.signal }); }
  listen('personalIntentForm', 'submit', previewIntent);
  listen('personalContextInputDisclosure', 'toggle', () => {
    if (q('personalContextInputDisclosure').open && !q('personalIntentText').value.trim()) contextHand = getTeachingHand();
  });
  listen('personalConfirmIntent', 'click', confirmIntent);
  for (const id of ['personalIntentText', 'personalIntentScopeNote', 'personalIntentScope']) listen(id, 'input', () => { discardPreview(); return renderNext(); });
  listen('personalReviseIntent', 'click', () => { discardPreview(); q('personalIntentText').focus(); return renderNext(); });
  listen('personalNarrowScope', 'click', () => { discardPreview(); q('personalIntentScopeNote').focus(); return renderNext(); });
  listen('personalCancelCorrection', 'click', () => { discardPreview(); resetCorrection(); q('personalIntentText').value = ''; });
  listen('personalGiveExample', 'click', () => onMatrix());
  listen('personalMapRange', 'click', () => onTeach({ handClass: preview ? next?.candidate?.handClass : null,
    intent: 'mapping', focus: q('personalTeachTopic').value || null }));
  listen('personalTeachTopic', 'change', renderNext);
  listen('personalCoachCards', 'click', async (event) => {
    const target = event.target.closest('[data-intent-action="coach"]');
    if (!target || busy) return;
    const opportunity = coach?.opportunities.find((entry) => entry.id === target.dataset.coachId);
    if (!opportunity) return;
    const token = capture(); busy = true;
    try {
      const evidence = await application.getEvidenceView(getScope()); assertCurrent(token);
      const comparedEvidence = opportunity.supporting.rightScope
        ? await application.getEvidenceView(opportunity.supporting.rightScope) : null;
      assertCurrent(token);
      const request = createPersonalCoachRequest(opportunity, { scope: getScope(), evidenceFingerprint: evidence.evidenceFingerprint,
        comparisonEvidenceFingerprint: comparedEvidence?.evidenceFingerprint ?? null,
        variation: target.dataset.coachVariation === 'true',
        destination: target.dataset.coachVariation === 'true' ? 'teach_riverline' : opportunity.suggestedAction.destination });
      if (request.destination === 'matrix') await onMatrix(request.target.handClass);
      else { recentHands.push(request.target.handClass); await onTeach({ ...request.target, coachRequest: request }); }
    } catch (caught) { if (current(token.version, token.scopeKey)) { error(caught); await load(); } }
    finally { if (current(token.version, token.scopeKey)) busy = false; }
  });
  listen('personalTeachNext', 'click', () => {
    if (!next?.candidate) return;
    if (next.action === 'inspect') onMatrix(next.candidate.handClass);
    else { recentHands.push(next.candidate.handClass); onTeach({ handClass: next.candidate.handClass,
      intent: 'mapping', focus: q('personalTeachTopic').value || null }); }
  });
  listen('personalIntentStatements', 'click', (event) => {
    const target = event.target.closest('[data-intent-action]'); if (!target || busy) return;
    const record = qualitative.find((item) => item.id === target.dataset.evidenceId);
    if (record) beginCorrection(record, target.dataset.intentAction);
  });
  listen('personalHistoryContent', 'click', (event) => {
    const target = event.target.closest('[data-intent-action="restore"]'); if (!target || busy) return;
    const record = qualitative.find((item) => item.id === target.dataset.evidenceId); if (!record) return;
    // Find the current descendants of this exact correction chain only.
    const descendants = new Set([record.id]); let changed = true;
    while (changed) { changed = false; for (const item of qualitative) if (!descendants.has(item.id) && item.supersedesEvidenceIds.some((id) => descendants.has(id))) { descendants.add(item.id); changed = true; } }
    const superseded = new Set(qualitative.flatMap((item) => item.supersedesEvidenceIds));
    beginCorrection(record);
    correctionIds = qualitative.filter((item) => descendants.has(item.id) && !superseded.has(item.id)).map((item) => item.id);
    q('personalCorrectionTarget').textContent = `${t('Will supersede after confirmation')}: ${correctionIds.join(', ')} · ${scopeLabel(record.statedScope)} · ${record.originalWording}`;
  });
  listen('personalCompareApproach', 'click', () => compare(false)); listen('personalCompareSource', 'click', () => compare(true));
  listen('personalVersionHistory', 'toggle', loadHistory);
  function dispose() { if (lifecycle.signal.aborted) return; invalidate(); lifecycle.abort(); }
  function openContext() { if (!q('personalIntentText').value.trim()) contextHand = getTeachingHand(); q('personalContextInputDisclosure').open = true; q('personalIntentText').focus(); }
  return Object.freeze({ load, invalidate, dispose, openContext, getState: () => ({ preview, facts, next, coach, generation }) });
}
