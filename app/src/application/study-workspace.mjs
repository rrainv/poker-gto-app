import { projectDecisionDelta, selectImportantDecisions } from './decision-delta.mjs';
import { studyCopy } from './study-language.mjs';
import { describeOpponentPolicy } from './opponent-policy-language.mjs';
import { strategyTruthPresentation } from './strategy-truth.mjs';

function elements(root, language, translate) {
  const copy = key => studyCopy(key, language) ?? translate(key);
  const node = (tag, text) => { const el = root.ownerDocument.createElement(tag); if (text != null) el.textContent = text; return el; };
  const line = (parent, text) => parent.append(node('p', text));
  const token = text => { const el = node('bdi', text); el.dir = 'ltr'; return el; };
  const button = (parent, key, handler) => {
    const el = node('button', copy(key)); el.type = 'button'; el.className = 'ui-button ui-button--secondary';
    el.dataset.studyControl = key;
    el.addEventListener('click', handler); parent.append(el); return el;
  };
  root.dir = language === 'he' ? 'rtl' : 'ltr'; root.className = 'study-workspace';
  return { copy, node, line, token, button };
}

export function renderDeepReview({ root, review, evidence = {}, language = 'en', translate = key => key,
  onSelect, onAction, evidencePending = false, evidenceUnavailable = [], isCurrent = () => true } = {}) {
  const disclosureState = new Map([...root.querySelectorAll?.('[data-study-disclosure]') ?? []]
    .map(element => [element.dataset.studyDisclosure, element.open]));
  const active = root.ownerDocument.activeElement;
  const focusedControl = root.contains?.(active) ? active?.dataset?.studyControl : null;
  root.replaceChildren();
  if (review?.status !== 'ready') return;
  const { copy, node, line, token, button } = elements(root, language, translate);
  const deltas = review.decisions.map(decision => projectDecisionDelta(decision, {
    importProvenance: review.importProvenance,
    strategyBasis: review.source === 'training_full_hand' ? 'historical' : 'current', ...evidence[decision.decisionId] }));
  root.append(node('h3', copy('deep')));
  if (evidencePending) line(root, copy('loading'));
  if (evidenceUnavailable.length) line(root, `${copy('partial')} ${evidenceUnavailable.map(copy).join(' · ')}`);
  const priorities = selectImportantDecisions(deltas);
  if (!priorities.length && !evidencePending) line(root, copy('empty'));
  const list = node('ol');
  for (const delta of priorities) {
    const item = node('li');
    const select = button(item, 'open', () => { if (isCurrent()) onSelect(delta.decisionIndex); });
    select.dataset.studyControl = `decision:${delta.decisionIndex}`;
    select.textContent = `${delta.decisionIndex + 1} · ${copy(delta.street)}`;
    line(item, copy(delta.reasons[0].code)); list.append(item);
  }
  root.append(list);
  const policy = node('details'); policy.append(node('summary', copy('why'))); line(policy, copy('priorityPolicy')); root.append(policy);
  policy.dataset.studyDisclosure = 'priority';
  const delta = deltas.find(item => item.decisionId === review.selectedDecision.decisionId);
  const selected = node('section'); selected.dataset.decisionDelta = delta.decisionId;
  if (delta.reasons.length) for (const reason of delta.reasons) line(selected, copy(reason.code));
  if (delta.situational) line(selected, copy('marked'));
  const roles = node('details'); roles.append(node('summary', copy('details')));
  roles.dataset.studyDisclosure = `${delta.decisionId}:evidence`;
  for (const [key, role] of Object.entries(delta.roles)) {
    const part = node('section'); part.dataset.deltaRole = key; part.append(node('h4', copy(key)));
    if (role.availability === 'unavailable') line(part, copy(role.reason ?? 'unavailable'));
    else if (key === 'observedAction') line(part, copy(role.evidence.type));
    else if (key === 'personalIntent') {
      line(part, copy(role.evidence.intendedAction));
      line(part, copy('inspected'));
      if (role.evidence.selection) line(part, `${role.evidence.selection.setupName} · ${role.evidence.selection.approachName}`);
      // Preferred action is qualitative; no invented 100% frequency.
      if (Array.isArray(role.evidence.frequency)) for (const entry of role.evidence.frequency) {
        const p = node('p', copy(entry.action.type));
        p.append(token(` ${Math.round(entry.probability * 1000) / 10}%`)); part.append(p);
      }
    } else if (key === 'opponentPolicy') {
      const description = describeOpponentPolicy(role.evidence.configuration, language);
      line(part, description);
    } else if (key === 'exploitAnalysis') line(part, copy('exploit'));
    else if (key === 'normativeAssessment') line(part, translate(strategyTruthPresentation(role.evidence).title));
    else {
      line(part, copy(role.basis === 'historical' ? 'historicalSource' : 'currentSource'));
      part.append(token(`${role.evidence.source.id} · ${role.evidence.source.version ?? ''}`));
      for (const action of role.evidence.distribution) {
        const p = node('p', copy(action.type)); p.append(token(` ${Math.round(action.probability * 1000) / 10}%`)); part.append(p);
      }
      if (key === 'heuristicBaseline') line(part, copy('baseline'));
    }
    roles.append(part);
  }
  // Observed action stays visible while optional evidence layers remain collapsed.
  line(selected, `${copy('observedAction')}: ${copy(delta.roles.observedAction.evidence.type)}`);
  selected.append(roles);
  const actions = node('div'); actions.className = 'study-actions';
  const feedback = node('p'); feedback.setAttribute('aria-live', 'polite');
  for (const key of ['later', 'practice', 'similar', 'inspect', 'situational', 'save']) {
    const control = button(actions, key, async () => {
      if (!isCurrent()) return;
      control.disabled = true;
      try { const message = await onAction(key, delta); if (isCurrent()) feedback.textContent = message ? copy(message) : ''; }
      catch { if (isCurrent()) feedback.textContent = copy('unavailable'); }
      finally { if (isCurrent()) control.disabled = false; }
    });
    control.disabled = evidencePending && ['practice', 'similar'].includes(key);
  }
  const more = node('details'); more.append(node('summary', copy('change')));
  more.dataset.studyDisclosure = `${delta.decisionId}:personal`;
  for (const key of ['change', 'teach', 'unresolved', ...(delta.roles.opponentPolicy.availability === 'available' ? ['policy'] : [])]) {
    button(more, key, async () => { if (isCurrent()) { const message = await onAction(key, delta); if (isCurrent()) feedback.textContent = message ? copy(message) : ''; } });
  }
  selected.append(actions, more, feedback); root.append(selected);
  for (const element of root.querySelectorAll?.('[data-study-disclosure]') ?? []) {
    if (disclosureState.has(element.dataset.studyDisclosure)) element.open = disclosureState.get(element.dataset.studyDisclosure);
  }
  if (focusedControl) [...root.querySelectorAll?.('[data-study-control]') ?? []]
    .find(element => element.dataset.studyControl === focusedControl)?.focus({ preventScroll: true });
  return deltas;
}

export function renderStudyInbox({ root, model, language = 'en', translate = key => key, onOpen, isCurrent = () => true }) {
  root.replaceChildren(); const { copy, node, line, token, button } = elements(root, language, translate);
  root.append(node('h3', copy('next')));
  line(root, copy('bounded'));
  if (model.unavailable.length) line(root, `${copy('partial')} ${model.unavailable.map(copy).join(' · ')}`);
  if (!model.recommendation) { line(root, copy('emptyInbox')); return; }
  const title = item => typeof item.title === 'string' && item.title ? item.title
    : item.title?.street ? `${copy(item.title.street)} · ${item.title.position ?? ''}` : copy(item.owner);
  const row = (item, parent) => {
    parent.append(node('h4', title(item)));
    for (const reason of item.reasons) line(parent, copy(reason));
    const detail = node('details'); detail.append(node('summary', copy('details')));
    line(detail, `${copy('owner')}: ${copy(item.owner)}`);
    const source = node('p', `${copy('source')}: `); source.append(token(item.source)); detail.append(source);
    const priority = node('p', `${copy('priority')}: `); priority.append(token(item.priority)); detail.append(priority);
    const sourcePriority = node('p', `${copy('ownerPriority')}: `); sourcePriority.append(token(item.ownerPriority)); detail.append(sourcePriority);
    if (item.dueAt) { const due = node('p', `${copy('due')}: `); due.append(token(item.dueAt)); detail.append(due); }
    if (item.context) line(detail, [copy(item.context.street), item.context.heroPosition, item.context.heroCards?.join(' ')].filter(Boolean).join(' · '));
    if (item.sourceFacts.importProvenance) {
      const p = item.sourceFacts.importProvenance;
      detail.append(token(`${p.sourceHandId} · ${p.parserVersion} · ${p.reconstructionVersion}`));
    }
    parent.append(detail);
    const open = async kind => {
      if (!isCurrent()) return;
      try { await onOpen(item, kind); } catch { if (isCurrent()) line(parent, copy('unavailable')); }
    };
    button(parent, item.destination.kind === 'training' ? 'practice' : 'open', () => open('same_spot'));
    if (item.destination.kind === 'training') button(parent, 'similar', () => open('similar_spot'));
  };
  const next = node('section'); next.dataset.studyRecommendation = model.recommendation.id;
  row(model.recommendation, next); root.append(next);
  const queue = node('details'); queue.append(node('summary', `${copy('inbox')} · ${model.items.length}`));
  const list = node('ol');
  for (const item of model.items) { const li = node('li'); li.dataset.studyItem = item.id; row(item, li); list.append(li); }
  queue.append(list); root.append(queue);
  for (const pattern of model.patterns) {
    const detail = node('details'); detail.append(node('summary', `${copy('pattern')} ${pattern.count}`));
    line(detail, copy(pattern.context.street));
    detail.append(token(`${pattern.context.heroPosition} · ${pattern.handClass} · ${pattern.context.effectiveStackBb} bb`));
    for (const id of pattern.sample) detail.append(token(id)); root.append(detail);
  }
}
