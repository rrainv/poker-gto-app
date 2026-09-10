import { getPersonalStrategyActionSetForContext } from '../personal-strategy/action-contract.mjs';
import { personalNodeActions, personalNodeContext } from './personal-hand-study.mjs';
import { exactActionKey, canonicalIntentContent } from '../personal-strategy/exact-node-intent.mjs';

// All saved answers, independently of the Teacher's question ranking. Render one page at a time.
export function mountPersonalEvidenceReview({ root, history, application, scope, t, assertCurrent, onSaved }) {
  const doc = root.ownerDocument ?? document;
  const el = (tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const titleCase = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  const actionLabel = action => `${t(titleCase(action.action?.type ?? action.type))}${action.amountMilliBb != null ? ` ${action.amountMilliBb / 1000} bb` : ''}`;
  const records = [...(history.rangeObservations ?? []).map(record => ({ kind: 'direct', record })), ...(history.exactNodeIntents ?? []).map(record => ({ kind: 'exact', record }))].reverse();
  const superseded = new Set(records.flatMap(({ record }) => record.supersedesEvidenceIds ?? [record.revision?.supersedesObservationId]).filter(Boolean));
  const filter = el('input'); filter.type = 'search'; filter.placeholder = t('Find a hand or street'); filter.setAttribute('aria-label', t('Find a hand or street'));
  const list = el('div'), editor = el('section'), more = el('button', t('Show more')); more.type = 'button'; more.className = 'ui-button ui-button--quiet';
  root.append(filter, list, more, editor);
  let limit = 20;
  const subject = record => record.handClass ?? record.subject?.handClass ?? record.subject?.comboId;
  const describe = record => record.state === 'retracted' ? t('Retracted') : record.frequencies ? record.frequencies.map(entry => `${actionLabel(entry.action)} ${Math.round(entry.probability * 10000) / 100}%`).join(' / ')
    : record.distribution ? record.distribution.map(entry => `${actionLabel(entry.action)} ${Math.round(entry.probability * 10000) / 100}%`).join(' / ')
      : `${t('Preferred action')}: ${actionLabel(record.preferredAction ?? record.dominantAction ?? { type: 'unknown' })}`;
  function open({ kind, record }) {
    assertCurrent(); editor.replaceChildren();
    const exact = kind === 'exact';
    const heads = exact ? history.exactNodeIntents.filter(item => !superseded.has(item.id)
      && item.setupVersion === record.setupVersion && item.approachVersion === record.approachVersion
      && item.node.fingerprint === record.node.fingerprint && canonicalIntentContent(item.subject) === canonicalIntentContent(record.subject)) : [];
    editor.append(el('h4', `${t('Correct answer')}: ${subject(record)}`), el('p', describe(record)));
    if (exact) {
      const context = personalNodeContext(record.node);
      editor.append(el('p', `${context.heroPosition} · ${context.board.join(' ')} · ${t('Pot')}: ${context.potBb} bb`));
      const historyDetail = el('details'), summary = el('summary', t('Action history')); historyDetail.append(summary);
      for (const action of context.history) historyDetail.append(el('p', `${t(titleCase(action.street))} · ${context.players.find(player => player.playerId === action.playerId)?.position ?? ''} · ${actionLabel({ type: action.type, amountMilliBb: action.amountMilliBb })}`));
      editor.append(historyDetail);
      for (const head of heads) editor.append(el('p', `${t('Current answer')}: ${describe(head)}`));
    }
    if (heads.length > 1) editor.append(el('p', t('Conflicting answers. This correction replaces the current answers for this hand and node.')));
    const actions = exact ? [...personalNodeActions(record.node)] : getPersonalStrategyActionSetForContext(record.context).legalActions;
    if (exact) for (const entry of heads.flatMap(item => item.distribution?.map(entry => entry.action) ?? [item.preferredAction])) if (entry && !actions.some(action => exactActionKey(action) === exactActionKey(entry))) actions.push(entry);
    const form = el('form'), precision = el('select'), fields = el('div'), status = el('p'); status.role = 'status';
    const option = (value, text) => { const node = el('option', text); node.value = value; return node; };
    precision.append(option('dominant', t('Preferred action')), option('exact', t('Exact mix')));
    const precisionLabel = el('label', t('Answer type')); precisionLabel.append(precision);
    let preferred, inputs;
    function renderFields() {
      fields.replaceChildren(); inputs = [];
      if (precision.value === 'dominant') {
        preferred = el('select'); preferred.required = true; preferred.append(option('', t('Choose action')));
        actions.forEach((action, index) => preferred.append(option(String(index), actionLabel(action))));
        const label = el('label', t('Preferred action')); label.append(preferred); fields.append(label, el('p', t('Preferred action does not mean 100%.')));
      } else for (const action of actions) {
        const input = el('input'); input.type = 'number'; input.min = '0'; input.max = '100'; input.step = 'any'; input.required = true; input.value = '0';
        const label = el('label', `${actionLabel(action)} (%)`); label.append(input); fields.append(label); inputs.push({ action, input });
      }
    }
    precision.addEventListener('change', renderFields); renderFields();
    const save = el('button', t('Save correction')); save.type = 'submit'; save.className = 'ui-button ui-button--primary';
    form.append(precisionLabel, fields, save, status); editor.append(form);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (save.disabled) return;
      save.disabled = true;
      try {
        assertCurrent();
        const distribution = precision.value === 'exact' ? inputs.map(({ action, input }) => ({ action, probability: Number(input.value) / 100 })) : null;
        if (distribution && Math.abs(distribution.reduce((sum, item) => sum + item.probability, 0) - 1) > 0.000001) throw new RangeError('mix');
        if (exact) await application.correctPersonalHandEvidence(scope, { recordId: record.id, expectedHeadIds: heads.map(item => item.id), precision: precision.value,
          distribution, preferredAction: distribution ? null : actions[Number(preferred.value)] });
        else await application.recordPersonalStrategyMatrixEvidence(null, { ...scope, context: record.context, handClass: record.handClass,
          actionType: distribution ? null : actions[Number(preferred.value)].type,
          mix: distribution ? Object.fromEntries(distribution.map(item => [item.action.type, item.probability * 100])) : null });
        assertCurrent(); await onSaved();
      } catch { try { assertCurrent(); status.textContent = t('Your change was not saved. Check the fields and try again.'); } catch { /* Owner or Approach changed. */ } }
      finally { save.disabled = false; }
    });
    precision.focus();
  }
  function render() {
    const query = filter.value.toLowerCase();
    const filtered = records.filter(({ record }) => `${subject(record)} ${record.node?.street ?? 'preflop'} ${describe(record)} ${record.node?.board?.join(' ') ?? ''}`.toLowerCase().includes(query));
    list.replaceChildren();
    for (const entry of filtered.slice(0, limit)) {
      const { record } = entry, row = el('article');
      row.append(el('strong', `${subject(record)} · ${t(titleCase(record.node?.street ?? 'preflop'))}`), el('p', `${record.node?.board?.join(' ') ?? record.context?.heroPosition ?? ''} · ${describe(record)}`), el('small', `${record.createdAt} · ${t(superseded.has(record.id) ? 'Superseded' : record.state === 'retracted' ? 'Retracted' : 'Current answer')}`));
      const correct = el('button', t('Correct answer')); correct.type = 'button'; correct.className = 'ui-button ui-button--quiet'; correct.dataset.correctEvidence = record.id;
      correct.addEventListener('click', () => open(entry)); row.append(correct); list.append(row);
    }
    more.hidden = filtered.length <= limit;
    if (!filtered.length) list.append(el('p', t('No saved answers match this filter.')));
  }
  filter.addEventListener('input', () => { limit = 20; render(); }); more.addEventListener('click', () => { limit += 20; render(); }); render();
}
