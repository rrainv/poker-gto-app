import { renderNodeCoach, createNodeCoachHandoff, assertNodeCoachHandoffCurrent } from '../personal-strategy/node-coach.mjs';
import { mountExploitTeacher } from './exploit-teacher-workspace.mjs';
import { mountAdvancedEquity } from './advanced-equity-workspace.mjs';
import { createPersonalEquityRequest } from './weighted-equity-consumers.mjs';
import { mountPersonalOpponentStudy } from './opponent-learning-workspace.mjs';
import { createRangeAnalysisFacts } from './range-analysis.mjs';
import { continuePersonalHandNode, inspectPersonalActionBranch, personalExactAmountFromBb, comparePersonalNodeStudies } from './personal-hand-study.mjs';
import { createExactIntentAction, exactActionKey } from '../personal-strategy/exact-node-intent.mjs';
import { continuationCopy, renderPersonalRangeMutations, personalNodeRegionLabel } from './personal-hand-continuation-language.mjs';

// Ephemeral form drafts only. The application owns node identity, legal actions,
// range propagation, evidence heads and all durable writes.
const COPY = {
  start: ['Teach through a hand', 'Обучение через раздачу', 'ללמד דרך יד'],
  loading: ['Reading this hand…', 'Загрузка раздачи…', 'טוען את היד…'],
  unavailable: ['Choose a BTN first-in setup without antes or collection to study this line.', 'Для этой линии выберите BTN первым в банк без анте и сборов.', 'כדי ללמוד את הקו הזה בחרו BTN ראשון בקופה ללא אנטה או גבייה.'],
  path: ['BTN opens to 2.5bb → BB calls → flop → BB checks', 'BTN открывает 2.5bb → BB коллирует → флоп → BB чекает', 'BTN פותח ל־2.5bb ← BB משווה ← פלופ ← BB עושה צ׳ק'],
  assumption: ['This line studies your intended range. The BB call and check are supplied assumptions; no opponent range is inferred.', 'Эта линия изучает ваш задуманный диапазон. Колл и чек BB заданы как условия; диапазон соперника не выводится.', 'הקו בוחן את הטווח שהתכוונתם לשחק. ההשוואה והצ׳ק של BB הם הנחות נתונות; לא מוסק טווח יריב.'],
  preflop: ['1. Teach the exact opening size', '1. Укажите частоту для точного размера открытия', '1. למדו את גודל הפתיחה המדויק'],
  class: ['Starting hand', 'Стартовая рука', 'יד התחלתית'],
  frequency: ['Raise to 2.5bb (%)', 'Рейз до 2.5bb (%)', 'העלאה ל־2.5bb (%)'],
  remainder: ['The remaining frequency is Fold. Enter your intention for this size explicitly.', 'Остальная частота — фолд. Укажите своё намерение именно для этого размера.', 'יתר התדירות היא קיפול. הזינו במפורש את הכוונה שלכם לגודל הזה.'],
  old: ['Earlier action-family answer', 'Прежний ответ о типе действия', 'תשובה קודמת על סוג הפעולה'],
  noSize: ['The earlier answer does not identify a raise size.', 'В прежнем ответе не указан размер рейза.', 'התשובה הקודמת אינה מזהה גודל העלאה.'],
  saveOpen: ['Save this opening intention', 'Сохранить намерение открытия', 'שמירת כוונת הפתיחה'],
  flop: ['2. Teach the reached flop', '2. Опишите игру на достигнутом флопе', '2. למדו את הפלופ שאליו הגעתם'],
  empty: ['Teach a positive opening frequency to bring known combinations to this flop. Unmapped hands remain unknown.', 'Укажите положительную частоту открытия, чтобы известные комбинации дошли до флопа. Неописанные руки остаются неизвестными.', 'הזינו תדירות פתיחה חיובית כדי להביא צירופים ידועים לפלופ. ידיים שלא מופו נשארות לא ידועות.'],
  combo: ['Exact combination', 'Точная комбинация', 'צירוף מדויק'],
  precision: ['Answer detail', 'Точность ответа', 'רמת פירוט התשובה'],
  preferred: ['Preferred action', 'Предпочтительное действие', 'פעולה מועדפת'],
  exact: ['Exact frequencies', 'Точные частоты', 'תדירויות מדויקות'],
  choose: ['Choose an action', 'Выберите действие', 'בחרו פעולה'],
  check: ['Check', 'Чек', 'צ׳ק'],
  bet: ['Bet', 'Ставка', 'הימור'],
  raise: ['Raise to', 'Рейз до', 'העלאה ל־'],
  fold: ['Fold', 'Фолд', 'קיפול'],
  pot: ['pot', 'банка', 'קופה'],
  allin: ['All-in', 'Олл-ин', 'אול אין'],
  exactNote: ['Enter all percentages; the total must be 100%.', 'Введите все проценты; сумма должна быть 100%.', 'הזינו את כל האחוזים; הסכום חייב להיות 100%.'],
  preferredNote: ['A preferred action does not imply 100% frequency.', 'Предпочтительное действие не означает частоту 100%.', 'פעולה מועדפת אינה מעידה על תדירות של 100%.'],
  saveFlop: ['Save this flop intention', 'Сохранить намерение на флопе', 'שמירת הכוונה בפלופ'],
  saved: ['Intention saved. Earlier answers remain in history.', 'Намерение сохранено. Прежние ответы остаются в истории.', 'הכוונה נשמרה. התשובות הקודמות נשארות בהיסטוריה.'],
  error: ['Nothing was saved. Check the inputs or reopen this hand after changing the selection.', 'Ничего не сохранено. Проверьте поля или откройте раздачу заново после изменения выбора.', 'דבר לא נשמר. בדקו את השדות או פתחו מחדש את היד לאחר שינוי הבחירה.'],
  return: ['Return to preflop mapping', 'Вернуться к карте префлопа', 'חזרה למיפוי פרפלופ'],
  known: ['Known reached combinations', 'Известные достигшие комбинации', 'צירופים ידועים שהגיעו'],
  unknown: ['Unknown combinations', 'Неизвестные комбинации', 'צירופים לא ידועים'],
  blocked: ['Removed by the board', 'Исключены картами борда', 'הוסרו בגלל הלוח'],
  evidence: ['Current node intentions', 'Намерения в этой точке', 'כוונות בנקודה הנוכחית'],
  concepts: ['Explore a concept', 'Разобрать понятие', 'לחקור מושג'],
  dependencies: ['What this claim would require', 'Что требуется для такого вывода', 'מה נדרש לטענה הזאת'],
  continuation: ['Continue studying', 'Продолжить изучение', 'המשך לימוד'],
  current: ['Saved intention here', 'Сохранённое намерение здесь', 'כוונה שמורה כאן'],
};

export function personalHandCopy(key, language = 'en') {
  return COPY[key]?.[{ en: 0, ru: 1, he: 2 }[language] ?? 0] ?? key;
}

export function parsePersonalHandPercent(value) {
  if (String(value).trim() === '') throw new RangeError('A percentage is required');
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new RangeError('Invalid percentage');
  return number / 100;
}

export function mountPersonalStrategyHandWorkspace({ root, application, getScope, language = () => 'en', onTeach,
  signal } = {}) {
  if (!root) return Object.freeze({ invalidate() {}, dispose() {} });
  const lifecycle = new AbortController();
  let renderLifecycle = new AbortController();
  let generation = 0, loadVersion = 0, study = null, studyToken = null, busy = false, selectedClass = null, selectedCombo = null;
  let activeNode = null, recentCombos = [];
  const lang = () => typeof language === 'function' ? language() : language;
  const copy = (key) => personalHandCopy(key, lang());
  const cc = (key, values) => continuationCopy(key, lang(), values);
  const currentNode = () => study.node ?? study.flopNode;
  const doc = root.ownerDocument ?? document;
  const el = (tag, text, className) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const scopeKey = () => JSON.stringify(getScope());
  const current = (token) => !lifecycle.signal.aborted && token.generation === generation && token.scope === scopeKey();
  const capture = () => ({ generation, scope: scopeKey() });
  const listen = (node, event, handler) => node.addEventListener(event, handler, { signal: renderLifecycle.signal });
  const button = (key) => { const node = el('button', copy(key), 'ui-button ui-button--secondary'); node.type = 'button'; return node; };
  const label = (key, input) => { const node = el('label', copy(key), 'personal-hand-field'); node.append(input); return node; };
  const option = (value, text) => { const node = el('option', text); node.value = value; return node; };
  const percent = () => { const node = el('input'); node.type = 'number'; node.min = '0'; node.max = '100'; node.step = 'any'; node.required = true; node.inputMode = 'decimal'; return node; };
  let status, focusTeaching = null, focusConcept = null;
  function shell() {
    renderLifecycle.abort(); renderLifecycle = new AbortController();
    root.replaceChildren(); root.dir = lang() === 'he' ? 'rtl' : 'ltr';
    focusTeaching = focusConcept = null;
    status = el('p', '', 'personal-hand-status'); status.role = 'status'; status.ariaLive = 'polite';
    root.append(status);
  }
  function reset() {
    shell(); const start = button('start'); start.dataset.handAction = 'start';
    listen(start, 'click', () => { if (!busy) return load(); }); root.append(start);
  }
  function invalidate() {
    generation += 1; study = studyToken = null; busy = false; selectedClass = selectedCombo = null;
    activeNode = null; recentCombos = [];
    if (!lifecycle.signal.aborted) reset();
  }
  function actionLabel(descriptor) {
    const type = descriptor.action.type;
    const amount = descriptor.amountMilliBb ?? descriptor.action.amountToMilliBb;
    const index = study.actions.findIndex(candidate => candidate.action.type === type
      && candidate.action.amountToMilliBb === descriptor.action.amountToMilliBb);
    const fraction = type === 'bet' ? study.actionSizeHints?.[index]?.potFraction : null;
    const sizing = Number.isFinite(fraction) ? ` (≈${Math.round(fraction * 100).toLocaleString(lang())}% ${copy('pot')})` : '';
    return `${type === 'call' ? cc('call') : copy(type === 'all_in' ? 'allin' : type)}${amount !== null && amount !== undefined && type !== 'check' && type !== 'fold' ? ` ${(amount / 1000).toLocaleString(lang(), { maximumFractionDigits: 3 })}bb` : ''}${sizing}`;
  }
  function currentIntent(node, subject) {
    const ids = new Set(headIds(node, subject));
    const records = (study.exactNodeIntents ?? []).filter((record) => ids.has(record.id));
    return records.length ? `${copy('current')}: ${records.map((record) => record.precision === 'exact'
      ? record.distribution.map((item) => `${actionLabel(item.action)} ${(item.probability * 100).toLocaleString(lang())}%`).join(' / ')
      : `${copy('preferred')}: ${actionLabel(record.preferredAction)}`).join(' · ')}${records.some(record => record.provenance?.contextNote) ? ` · ${records.map(record => record.provenance?.contextNote ?? '').filter(Boolean).join(' · ')}` : ''}` : '';
  }
  function headIds(node, subject) {
    const records = study.exactNodeIntents ?? [];
    const superseded = new Set(records.flatMap((record) => record.supersedesEvidenceIds ?? []));
    return records.filter((record) => !superseded.has(record.id)
      && record.node?.fingerprint === node.fingerprint
      && JSON.stringify(record.subject) === JSON.stringify(subject)).map((record) => record.id);
  }
  async function save(payload, form) {
    if (busy || !study) return;
    if (!studyToken || !current(studyToken)) { status.textContent = copy('error'); return; }
    const token = capture(); busy = true;
    const submit = form.querySelector?.('button[type="submit"]'); if (submit) submit.disabled = true;
    try {
      application.lifecycleScope?.assertCurrent();
      await application.savePersonalHandIntent(getScope(), { ...payload,
        approachSnapshot: study.approachSnapshot,
        supersedesEvidenceIds: headIds(payload.node, payload.subject) });
      if (!current(token)) return;
      if (payload.subject.kind === 'combo') recentCombos = [...recentCombos, payload.subject.comboId].slice(-16);
      await load(); if (current(token)) { status.textContent = copy('saved'); status.tabIndex = -1; status.focus(); }
    } catch { if (current(token)) status.textContent = copy('error'); }
    finally { if (current(token)) { busy = false; if (submit) submit.disabled = false; } }
  }
  function renderPreflop(target = root) {
    const section = el('section', undefined, 'personal-hand-stage'); section.append(el('h4', copy('preflop')));
    const form = el('form'); const select = el('select'); select.dataset.handField = 'class';
    select.append(...study.preflopCandidates.map((item) => option(item.handClass, item.handClass)));
    select.value = selectedClass && study.preflopCandidates.some((item) => item.handClass === selectedClass)
      ? selectedClass : study.preflopCandidates[0]?.handClass ?? '';
    const previous = el('p'), saved = el('p'); const frequency = percent(); frequency.dataset.handField = 'open-frequency';
    const update = () => {
      selectedClass = select.value; frequency.value = '';
      const candidate = study.preflopCandidates.find((item) => item.handClass === select.value);
      saved.textContent = currentIntent(study.preflopNode, { kind: 'hand_class', handClass: select.value });
      previous.textContent = candidate?.legacyRaiseFrequency !== null && candidate?.legacyRaiseFrequency !== undefined
        ? `${copy('old')}: ${(candidate.legacyRaiseFrequency * 100).toLocaleString(lang())}%. ${copy('noSize')}` : copy('noSize');
    };
    listen(select, 'change', update); update();
    const submit = button('saveOpen'); submit.type = 'submit';
    form.append(label('class', select), saved, previous, label('frequency', frequency), el('p', copy('remainder')), submit);
    listen(form, 'submit', async (event) => {
      event.preventDefault();
      try {
        const probability = parsePersonalHandPercent(frequency.value);
        await save({ node: study.preflopNode, subject: { kind: 'hand_class', handClass: select.value }, precision: 'exact',
          distribution: [{ action: study.preflopAction, probability }, { action: study.preflopFoldAction, probability: 1 - probability }], preferredAction: null }, form);
      } catch { status.textContent = copy('error'); }
    });
    section.append(form); target.append(section);
  }
  function renderFlop() {
    const section = el('section', undefined, 'personal-hand-stage'); section.append(el('h4', cc('teach')));
    const availableActions = [...study.actions];
    const questions = study.study?.questions ?? [];
    if (!questions.length) { section.append(el('p', currentNode().street && currentNode().street !== 'flop' ? cc('noReach') : copy('empty'))); root.append(section); return; }
    const form = el('form'); const select = el('select'); select.dataset.handField = 'combo';
    select.append(...questions.map((question) => option(question.comboId, `${question.cards.join(' ')} · ${question.handClass}`)));
    select.value = selectedCombo && questions.some((item) => item.comboId === selectedCombo) ? selectedCombo : questions[0].comboId;
    selectedCombo = select.value;
    const precision = el('select'); precision.dataset.handField = 'precision';
    precision.append(option('dominant', copy('preferred')), option('exact', copy('exact')));
    const fields = el('div'), saved = el('p'), questionText = el('p', '', 'personal-coach-question');
    const note = el('textarea'); note.maxLength = 2000; note.dataset.handField = 'context-note';
    let preferred, inputs;
    const renderInputs = () => {
      fields.replaceChildren(); inputs = [];
      saved.textContent = currentIntent(currentNode(), { kind: 'combo', comboId: select.value });
      const selectedQuestion = questions.find(item => item.comboId === select.value);
      questionText.textContent = `${selectedQuestion?.region ? `${personalNodeRegionLabel(selectedQuestion.region, lang())} · ` : ''}${cc(selectedQuestion?.questionKind ?? 'action_boundary')}`;
      if (precision.value === 'exact') {
        fields.append(el('p', copy('exactNote')));
        for (const action of availableActions) {
          const input = percent(); input.dataset.handField = 'mix-frequency'; inputs.push({ action, input });
          const row = el('label', `${actionLabel(action)} (%)`, 'personal-hand-field'); row.append(input); fields.append(row);
        }
      } else {
        preferred = el('select'); preferred.required = true; preferred.dataset.handField = 'preferred';
        preferred.append(option('', copy('choose')), ...availableActions.map((action, index) => option(String(index), actionLabel(action))));
        fields.append(label('preferred', preferred), el('p', copy('preferredNote')));
      }
    };
    let teacher = null;
    const teacherRoot = el('div');
    const handFactsCache = new Map();
    const renderTeacher = () => {
      teacher?.dispose(); teacher = null;
      const question = questions.find(item => item.comboId === select.value);
      if (!question?.decisionContext) return;
      if (!handFactsCache.has(question.comboId)) handFactsCache.set(question.comboId,
        createRangeAnalysisFacts({ decisionContext: question.decisionContext }));
      teacher = mountExploitTeacher({ root: teacherRoot, decisionContext: question.decisionContext,
        rangeAnalysisFacts: handFactsCache.get(question.comboId), language: lang(), signal: renderLifecycle.signal,
        personalStrategy: { approachSnapshot: study.approachSnapshot, nodeFingerprint: currentNode().fingerprint,
          trajectoryFingerprint: study.trajectory?.fingerprint ?? null, evidenceRefs: question.evidenceRefs ?? [], precision: question.precision,
          selectedHand: { comboId: question.comboId, precision: question.precision,
            distribution: question.distribution, preferredAction: question.preferredAction, region: question.region } },
        onMap: ({ action }) => {
          if (!studyToken || !current(studyToken)) return;
          if (action === 'teachRegion') focusTeaching?.(question.region);
          else select.focus();
        } });
      focusConcept = conceptId => teacher?.openConcept(({ bluff_catch: 'bluff_catcher', small_block_bet: 'small_bet', blocker_quality: 'blockers' })[conceptId] ?? conceptId);
    };
    listen(select, 'change', () => { selectedCombo = select.value; note.value = ''; renderInputs(); renderTeacher(); });
    listen(precision, 'change', renderInputs); renderInputs();
    focusTeaching = (regionId = null) => {
      const candidate = questions.find(question => (!regionId || question.region === regionId) && question.precision !== 'exact')
        ?? questions.find(question => !regionId || question.region === regionId);
      if (candidate) { select.value = candidate.comboId; selectedCombo = candidate.comboId; renderInputs(); renderTeacher(); select.focus(); }
    };
    const custom = el('details'); custom.append(el('summary', cc('custom')));
    const size = el('input'); size.type = 'number'; size.step = '0.001'; size.min = '0'; size.dataset.handField = 'custom-size';
    const sizeLabel = el('label', cc('custom')); sizeLabel.append(size);
    const addSize = button('choose'); addSize.textContent = cc('add'); addSize.dataset.handAction = 'add-size';
    listen(addSize, 'click', () => {
      try {
        if (!studyToken || !current(studyToken) || !size.value.trim()) return;
        const action = createExactIntentAction(currentNode(), study.contextFacts?.legal.raise.available ? 'raise' : 'bet', personalExactAmountFromBb(size.value));
        if (!availableActions.some(item => exactActionKey(item) === exactActionKey(action))) availableActions.push(action);
        renderInputs();
      } catch { status.textContent = cc('invalid'); }
    });
    custom.append(sizeLabel, addSize);
    const noteDetails = el('details'); noteDetails.append(el('summary', cc('note')), el('p', cc('noteHelp')));
    const noteLabel = el('label', cc('note')); noteLabel.append(note); noteDetails.append(noteLabel);
    const submit = button('saveFlop'); submit.textContent = cc('save'); submit.type = 'submit';
    form.append(questionText, label('combo', select), saved, label('precision', precision), fields, custom, noteDetails, submit);
    listen(form, 'submit', async (event) => {
      event.preventDefault();
      try {
        let distribution = null, preferredAction = null;
        if (precision.value === 'exact') {
          distribution = inputs.map(({ action, input }) => ({ action, probability: parsePersonalHandPercent(input.value) }));
          if (Math.abs(distribution.reduce((sum, item) => sum + item.probability, 0) - 1) > 1e-10) throw new RangeError('Mix total');
        } else {
          if (!preferred.value) throw new RangeError('Choose an action');
          preferredAction = availableActions[Number(preferred.value)];
        }
        await save({ node: currentNode(), subject: { kind: 'combo', comboId: select.value },
          precision: precision.value, distribution, preferredAction, contextNote: note.value }, form);
      } catch { status.textContent = copy('error'); }
    });
    const another = button('choose'); another.textContent = cc('another'); another.dataset.handAction = 'another-region';
    listen(another, 'click', () => {
      const selected = questions.find(item => item.comboId === select.value);
      const candidate = questions.find(item => item.region !== selected?.region && !recentCombos.includes(item.comboId))
        ?? questions.find(item => item.comboId !== select.value);
      if (candidate) { recentCombos = [...recentCombos, select.value].slice(-16); select.value = selectedCombo = candidate.comboId; note.value = ''; renderInputs(); renderTeacher(); select.focus(); }
    });
    section.append(form, another, teacherRoot); root.append(section); renderTeacher();
  }
  function renderContext() {
    if (!study.contextFacts) return;
    const facts = study.contextFacts, section = el('section', undefined, 'personal-hand-stage');
    section.append(el('h4', `${cc('context')} · ${cc(facts.street)}`), el('p', cc('potStack', { pot: facts.potBb, stack: facts.heroStackBb, position: facts.heroPosition })));
    const history = el('details'); history.append(el('summary', cc('history')));
    for (const action of facts.history) {
      const position = facts.players.find(player => player.playerId === action.playerId)?.position ?? action.playerId;
      const amount = action.amountToMilliBb ?? action.amountMilliBb;
      history.append(el('p', `${action.street ? cc(action.street) : ''} · ${position} · ${action.type === 'call' ? cc('call') : copy(action.type === 'all_in' ? 'allin' : action.type)}${amount != null ? ` ${amount / 1000}bb` : ''}`));
    }
    section.append(history); root.append(section);
  }
  function renderRange() {
    if (!study.mutations) return;
    const section = el('section', undefined, 'personal-hand-stage'), facts = study.study.facts;
    section.append(el('h4', cc('range')), el('p', cc('coverage', { positive: facts.knownPositiveCombos, unknown: facts.unknownReachCombos, mapped: facts.mappedCombos, unmapped: facts.unknownPolicyCombos })));
    const detail = el('details'); detail.append(el('summary', cc('inspect')));
    for (const line of renderPersonalRangeMutations(study.mutations, lang())) detail.append(el('p', line));
    for (const region of facts.regions) detail.append(el('p', cc('region', { region: personalNodeRegionLabel(region.id, lang()),
      mapped: region.mappedCombos, total: region.eligibleCombos, unknown: region.unknownPolicyCombos })));
    for (const entry of study.study.entries) detail.append(el('p', `${entry.cards.join(' ')} · ${entry.handClass} · ${copy(entry.precision === 'dominant' ? 'preferred' : entry.precision === 'exact' ? 'exact' : 'unknown')} · ${entry.priorWeight.toLocaleString(lang(), { maximumFractionDigits: 6 })}`));
    section.append(detail);
    if (study.trajectory) {
      const equityRoot = el('div'); section.append(equityRoot);
      mountAdvancedEquity({ root: equityRoot, language: lang, signal: renderLifecycle.signal,
        getRequest: () => createPersonalEquityRequest({ trajectory: study.trajectory,
          opponent: { id: 'opponent', kind: 'uniform_unknown' } }) });
    }
    if (study.comparisonApproaches?.length) {
      const compare = el('details'); compare.append(el('summary', cc('comparison')), el('p', cc('comparisonNote')));
      const select = el('select'); select.append(...study.comparisonApproaches.map(item => option(item.id,item.name)));
      const label = el('label', cc('comparison')); label.append(select);
      const run = button('choose'); run.textContent = cc('comparison'); run.dataset.handAction = 'compare';
      const output = el('p'); output.role = 'status';
      const renderSignal = renderLifecycle.signal;
      listen(run, 'click', async () => {
        if (!studyToken || !current(studyToken) || run.disabled) return;
        const token = capture(), node = currentNode(), modeId = select.value; run.disabled = true;
        try {
          const other = await application.getPersonalHandStudy({ ...getScope(), modeId }, { node, board: node.board.slice(0,3), resume: false });
          if (renderSignal.aborted || !current(token) || select.value !== modeId) return;
          if (!other.available) throw new Error('Comparison unavailable');
          const counts = other.study.facts;
          output.textContent = `${study.comparisonApproaches.find(item => item.id === modeId).name}: ${cc('coverage', { positive: counts.knownPositiveCombos, unknown: counts.unknownReachCombos, mapped: counts.mappedCombos, unmapped: counts.unknownPolicyCombos })} ${cc('compared', comparePersonalNodeStudies(study, other))}`;
        } catch { if (!renderSignal.aborted && current(token)) output.textContent = copy('error'); }
        finally { run.disabled = false; }
      });
      listen(select, 'change', () => { output.textContent = ''; });
      compare.append(label, run, output); section.append(compare);
    }
    root.append(section);
  }
  function renderContinuation() {
    if (!study.contextFacts) return;
    const section = el('section', undefined, 'personal-hand-stage'); section.append(el('p', cc('branchNote')));
    const actions = el('select'); actions.dataset.handField = 'branch-action';
    actions.append(...study.actions.map((action,index) => option(String(index), actionLabel(action))));
    const actionLabelNode = el('label', copy('choose')); actionLabelNode.append(actions); section.append(actionLabelNode);
    const cards = el('select'); cards.dataset.handField = 'next-card';
    cards.append(...study.contextFacts.availableCards.map(card => option(card, card)));
    const cardLabel = el('label', cc('card')); cardLabel.append(cards);
    const opponent = el('input'); opponent.type = 'number'; opponent.min = '0'; opponent.step = '0.001'; opponent.dataset.handField = 'opponent-bet';
    const opponentLabel = el('label', cc('opponent')); opponentLabel.append(opponent);
    const advanced = el('details'); advanced.append(el('summary', cc('opponent')), opponentLabel);
    if (currentNode().street !== 'river') section.append(cardLabel, advanced);
    const advance = button('continuation'); advance.textContent = cc('advance'); advance.dataset.handAction = 'advance';
    listen(advance, 'click', async () => {
      if (busy || !studyToken || !current(studyToken)) return;
      try {
        const result = continuePersonalHandNode({ node: currentNode(), action: study.actions[Number(actions.value)], card: cards.value,
          opponentBetMilliBb: opponent.value.trim() ? personalExactAmountFromBb(opponent.value) : null });
        if (!result.available) {
          const facts = inspectPersonalActionBranch({ study, action: study.actions[Number(actions.value)] });
          status.textContent = `${cc('selectedBranch', facts)} ${cc('terminal')}`; return;
        }
        selectedCombo = null; recentCombos = []; await load(result.node);
      } catch { status.textContent = cc('invalid'); }
    });
    section.append(advance);
    const prior = el('details'); prior.append(el('summary', cc('previous')));
    const nodes = [...new Map([study.flopNode, ...study.stages.filter(stage => stage.node.street !== 'preflop').map(stage => stage.node), ...study.resumableNodes]
      .map(node => [node.fingerprint,node])).values()];
    for (const node of nodes) {
      const revisit = button('continuation'); revisit.textContent = `${cc(node.street)} · ${node.board.join(' ')} · ${node.history.length}`;
      listen(revisit, 'click', async () => { if (!busy && studyToken && current(studyToken)) { selectedCombo = null; recentCombos = []; await load(node); } }); prior.append(revisit);
    }
    section.append(prior); root.append(section);
  }
  function render() {
    shell();
    if (study.available === false) { status.textContent = copy('unavailable'); return; }
    root.append(el('p', cc('path'), 'personal-hand-path'));
    const board = el('p', (currentNode()?.board ?? ['Qs', '8c', '4h']).join(' '), 'personal-hand-board'); board.dir = 'ltr'; root.append(board);
    root.append(el('p', copy('assumption')));
    renderContext();
    if (study.study?.questions?.length && study.contextFacts) {
      const preflop = el('details'); preflop.append(el('summary', copy('preflop')));
      renderPreflop(preflop); root.append(preflop);
    } else renderPreflop();
    renderRange(); renderFlop();
    if (study.study) {
      const opponentRoot = el('section', undefined, 'personal-hand-stage'); root.append(opponentRoot);
      mountPersonalOpponentStudy({ root: opponentRoot, study, language: lang(), signal: renderLifecycle.signal,
        regionLabel: id => personalNodeRegionLabel(id, lang()),
        onTeach: id => { if (studyToken && current(studyToken)) focusTeaching?.(id); } });
    }
    renderContinuation();
    if (study.coach) {
      const rendered = renderNodeCoach(study.coach, { language: lang() });
      root.append(el('p', rendered.summary), el('p', rendered.coverage, 'personal-hand-coverage'), el('p', rendered.caution));
      for (const [index, lesson] of rendered.lessons.entries()) {
        const card = el(index === 0 ? 'article' : 'details', undefined, 'personal-coach-card');
        card.append(el(index === 0 ? 'h4' : 'summary', lesson.noticed), el('p', lesson.why),
          el('p', lesson.question, 'personal-coach-question'), el('p', lesson.explanation));
        const more = el('details'); more.append(el('summary', copy('dependencies')), el('p', lesson.whatChanges),
          el('p', lesson.coverage), el('p', lesson.unavailable)); card.append(more); root.append(card);
        if (focusTeaching) {
          const teach = button('saveFlop'); teach.textContent = rendered.handoffs.find(item => item.destination === 'teach_riverline').label;
          listen(teach, 'click', () => { if (studyToken && current(studyToken)) focusTeaching(lesson.regionId); }); card.append(teach);
        }
      }
      const concepts = el('details'); concepts.append(el('summary', copy('concepts')));
      for (const concept of rendered.concepts) {
        const row = el('details'); row.append(el('summary', concept.title), el('p', concept.question, 'personal-coach-question'),
          el('p', concept.explanation), el('p', concept.whatChanges), el('p', concept.unavailable));
        const dependencies = el('details'); dependencies.append(el('summary', copy('dependencies')));
        const list = el('ul'); list.append(...concept.dependencies.map((item) => el('li', `${item.label}: ${item.availability}`)));
        dependencies.append(list); row.append(dependencies); concepts.append(row);
        if (focusConcept && !['polarization','value_bluff_composition','scare_card','exploit'].includes(concept.id)) {
          const open = button('concepts'); open.dataset.handConcept = concept.id;
          listen(open, 'click', () => { if (studyToken && current(studyToken)) focusConcept(concept.id); }); row.append(open);
        }
      }
      root.append(concepts);
      const handoffs = el('details'); handoffs.append(el('summary', copy('continuation')));
      for (const handoff of rendered.handoffs) {
        if (handoff.availability === 'available') {
          const request = createNodeCoachHandoff(study.coach, handoff.destination);
          const action = button('continuation'); action.textContent = handoff.label;
          action.disabled = handoff.destination === 'teach_riverline' && !focusTeaching;
          listen(action, 'click', () => {
            if (!studyToken || !current(studyToken)) { status.textContent = copy('error'); return; }
            assertNodeCoachHandoffCurrent(request, study.coach);
            if (handoff.destination === 'teach_riverline') focusTeaching?.();
            else { concepts.open = true; concepts.tabIndex = -1; concepts.focus(); }
          });
          handoffs.append(action);
        } else handoffs.append(el('p', `${handoff.label}: ${handoff.availabilityLabel} · ${handoff.unavailableReason}`));
      }
      root.append(handoffs);
    }
    const back = button('return'); listen(back, 'click', () => onTeach?.({ handClass: selectedClass, intent: 'mapping' })); root.append(back);
  }
  async function load(requestedNode = activeNode) {
    const token = capture(); if (!getScope() || lifecycle.signal.aborted) return;
    const requestVersion = ++loadVersion;
    busy = true; status.textContent = copy('loading');
    try {
      const value = await application.getPersonalHandStudy(getScope(), { node: requestedNode,
        ...(requestedNode ? { board: requestedNode.board.slice(0,3) } : {}), recentCombos });
      if (!current(token) || requestVersion !== loadVersion) return;
      study = value; activeNode = value.node ?? null; studyToken = token; render();
    } catch { if (current(token) && requestVersion === loadVersion) { reset(); status.textContent = copy('error'); } }
    finally { if (current(token) && requestVersion === loadVersion) busy = false; }
  }
  function dispose() { if (lifecycle.signal.aborted) return; generation += 1; study = null; root.replaceChildren(); renderLifecycle.abort(); lifecycle.abort(); }
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose(); else reset();
  return Object.freeze({ invalidate, dispose });
}
