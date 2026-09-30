// SAVED-TRAINING-HISTORY-001: the Saved destination's "Saved items | Training history"
// toggle and the read-only Training history view. Training Memory stays the sole owner
// of answered-decision evidence; the only write is an explicit "Save as Spot" through
// the existing Saved service. logic.js only mounts and routes it.
import {
  formatTrainingMemoryDate,
  trainingMemoryContextSummary,
  trainingMemoryModeLabelKey,
} from './training-memory-row-format.mjs';
import {
  SAVED_TRAINING_HISTORY_LIMIT,
  buildSavedTrainingHistorySpotInput,
  createSavedTrainingHistoryQuery,
  createSavedTrainingHistoryView,
  partitionSavedTrainingHistory,
  projectSavedTrainingHistoryItem,
  savedTrainingHistoryQueryIsFiltered,
  savedTrainingHistorySpotObjectId,
} from './saved-training-history.mjs';
import { createSavedPokerPreview } from './saved-poker-preview.mjs';

export const SAVED_TRAINING_HISTORY_WORKSPACE_SCHEMA_VERSION = 'saved-training-history-workspace/v1';
export const SAVED_VIEWS = Object.freeze(['items', 'training']);

const VIEW_LABELS = Object.freeze({ items: 'Saved items', training: 'Training history' });
const MODE_LABELS = Object.freeze({ all: 'All', varied: 'Varied', focused: 'Focused', full_hand: 'Full Hand' });

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`Saved Training history requires ${label}`);
}

export function mountSavedTrainingHistory(container, deps = {}) {
  if (!container?.ownerDocument) throw new TypeError('Saved Training history requires a mounted container');
  requireFunction(deps.getTrainingMemory, 'a Training Memory accessor');
  requireFunction(deps.savedService?.getById, 'a Saved getById lookup');
  requireFunction(deps.savedService?.saveHandDerivedSpot, 'the Saved Hand-derived Spot builder');
  requireFunction(deps.translate, 'a translate function');
  requireFunction(deps.openRedrill, 'the Training Memory re-drill route');

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  const t = (key, parameters) => deps.translate(key, parameters);
  const locale = () => deps.locale?.() || 'en';
  const setTimer = deps.timers?.set ?? ((callback, delay) => view.setTimeout(callback, delay));
  const clearTimer = deps.timers?.clear ?? ((id) => view.clearTimeout(id));
  const limit = deps.limit ?? SAVED_TRAINING_HISTORY_LIMIT;
  const coalesceMs = deps.coalesceMs ?? 80;
  const library = deps.library ?? null;
  const gateFor = deps.presentationGate ?? undefined;

  let disposed = false;
  let visible = false;
  let selectedView = 'items';
  let dirty = true;
  let generation = 0;
  let loadSequence = 0;
  let loadInFlight = false;
  let loadTimer = null;
  let status = 'idle';
  let items = [];
  let bounded = false;
  let withheldCount = 0;
  let query = createSavedTrainingHistoryQuery();
  let expandedId = null;
  let currentView = null;
  let actionMessage = null;
  // Session-only knowledge of which decisions already have a Saved Spot.
  const savedStates = new Map();

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const createdSlots = [];
  function slot(attribute, className, { first = false } = {}) {
    const existing = container.querySelector(`[${attribute}]`);
    if (existing) return existing;
    const created = el('div', className);
    created.setAttribute(attribute, '');
    if (first) container.prepend(created);
    else container.appendChild(created);
    createdSlots.push(created);
    return created;
  }
  const toggleSlot = slot('data-saved-view-toggle', 'saved-view-toggle', { first: true });
  const historySlot = slot('data-saved-training-history', 'saved-training-history');
  const librarySlots = () => ['data-saved-library-controls', 'data-saved-library-body']
    .map((attribute) => container.querySelector(`[${attribute}]`))
    .filter(Boolean);

  // One two-option control: native radios give arrow-key selection and one tab stop.
  const toggleGroup = el('div', 'saved-view-toggle-group');
  toggleGroup.setAttribute('role', 'radiogroup');
  const radioName = `savedView-${Math.random().toString(36).slice(2, 10)}`;
  const toggleOptions = new Map();
  for (const option of SAVED_VIEWS) {
    const label = el('label', 'saved-view-option');
    const input = el('input');
    input.type = 'radio';
    input.name = radioName;
    input.value = option;
    input.dataset.savedViewOption = option;
    const caption = el('span');
    label.append(input, caption);
    toggleGroup.appendChild(label);
    toggleOptions.set(option, { input, caption });
  }
  toggleSlot.replaceChildren(toggleGroup);

  const localNote = el('p', 'saved-training-local-note');
  localNote.dataset.trainingHistoryLocal = '';
  const modes = el('div', 'saved-library-categories saved-training-modes');
  modes.setAttribute('role', 'group');
  const modeButtons = new Map();
  for (const mode of Object.keys(MODE_LABELS)) {
    const button = el('button', 'saved-library-category');
    button.type = 'button';
    button.dataset.trainingHistoryMode = mode;
    const label = el('span');
    const count = el('strong', '', '0');
    count.dataset.trainingHistoryCount = mode;
    button.append(label, count);
    modes.appendChild(button);
    modeButtons.set(mode, { button, label, count });
  }
  function checkbox(attribute) {
    const label = el('label', 'saved-library-toggle');
    const input = el('input');
    input.type = 'checkbox';
    input.dataset[attribute] = '';
    const caption = el('span');
    label.append(input, caption);
    return { label, input, caption };
  }
  const unsure = checkbox('trainingHistoryUnsure');
  const queued = checkbox('trainingHistoryQueued');
  const clearButton = el('button', 'ui-button ui-button--quiet saved-library-clear');
  clearButton.type = 'button';
  clearButton.dataset.trainingHistoryClear = '';
  const filters = el('div', 'saved-library-filters');
  filters.setAttribute('role', 'group');
  filters.append(unsure.label, queued.label, clearButton);
  const controls = el('div', 'saved-library-controls saved-training-controls');
  controls.append(modes, filters);

  const boundNote = el('p', 'saved-library-bound-note');
  boundNote.dataset.trainingHistoryBound = '';
  const withheldNote = el('p', 'saved-training-withheld-note');
  withheldNote.dataset.trainingHistoryWithheld = '';
  const statusLine = el('p', 'saved-library-status');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  const layout = el('div', 'saved-library-layout');
  const list = el('div', 'home-saved-list saved-training-list');
  list.dataset.trainingHistoryList = '';
  const detail = el('aside', 'saved-library-detail saved-training-detail');
  detail.id = 'savedTrainingHistoryDetail';
  detail.setAttribute('aria-labelledby', 'savedTrainingHistoryDetailTitle');
  detail.hidden = true;
  layout.append(list, detail);
  historySlot.replaceChildren(localNote, controls, boundNote, withheldNote, statusLine, layout);

  function localizeControls() {
    toggleGroup.setAttribute('aria-label', t('Saved view'));
    for (const [option, parts] of toggleOptions) {
      parts.caption.textContent = t(VIEW_LABELS[option]);
      parts.input.checked = option === selectedView;
    }
    localNote.textContent = t('Training history is stored on this device and is not synced to your account.');
    modes.setAttribute('aria-label', t('Training mode'));
    for (const [mode, parts] of modeButtons) parts.label.textContent = t(MODE_LABELS[mode]);
    unsure.caption.textContent = t('Marked Unsure');
    queued.caption.textContent = t('Queued for review or revisit');
    filters.setAttribute('aria-label', t('Training history filters'));
    clearButton.textContent = t('Clear filters');
  }

  function applyView() {
    const trainingShown = selectedView === 'training';
    librarySlots().forEach((node) => { node.hidden = trainingShown; });
    historySlot.hidden = !trainingShown;
    container.dataset.savedView = selectedView;
  }

  function modeDate(item) {
    return `${t(trainingMemoryModeLabelKey(item.mode))} · ${formatTrainingMemoryDate(item.answeredAt, locale())}`;
  }

  function actionText(item) {
    if (!item.action?.type) return t('No answer recorded');
    const label = deps.actionLabel ? deps.actionLabel(item.record) : item.action.type;
    return `${t('Chosen action')}: ${label}`;
  }

  function reviewText(item) {
    const due = item.review.dueAt ? formatTrainingMemoryDate(item.review.dueAt, locale()) : null;
    if (item.review.kind === 'revisit') return due ? t('Revisit due {date}', { date: due }) : t('Revisit requested');
    if (item.review.kind === 'queued') return due ? t('In review queue · due {date}', { date: due }) : t('In review queue');
    if (item.review.kind === 'reviewed') return t('Reviewed');
    return null;
  }

  // Cards show a plain historical label; the technical id@version appears in detail only.
  function sourceLabelElement(item, className) {
    const line = el('span', className, t(item.sourceLabelKey));
    line.dir = 'auto';
    return line;
  }

  function technicalSourceElement(item) {
    const line = el('span', 'saved-training-technical-source');
    line.dir = 'auto';
    if (!item.source) {
      line.textContent = t('Source unavailable');
      return line;
    }
    const token = el('bdi', 'poker-data-token', `${item.source.id}@${item.source.version}`);
    token.dir = 'ltr';
    line.append(el('span', '', `${t('Technical source')}: `), token);
    return line;
  }

  // Same shared card-tile component as Saved items, from the frozen record's cards.
  function pokerPreview(item, variant = 'compact') {
    return createSavedPokerPreview(doc, item, {
      variant,
      translate: t,
      getCardPresentation: deps.getCardPresentation,
      getCardRankStyle: deps.getCardRankStyle,
    });
  }

  function badges(item) {
    const row = el('span', 'home-saved-item-badges saved-training-badges');
    if (item.unsure) row.appendChild(el('span', 'home-saved-badge home-saved-badge--review', t('Marked Unsure')));
    const review = reviewText(item);
    if (review) row.appendChild(el('span', 'home-saved-badge', review));
    if (savedStates.get(item.id) === 'saved') {
      const saved = el('span', 'home-saved-badge saved-training-saved-badge', `✓ ${t('Saved as a Spot')}`);
      saved.dataset.trainingHistorySaved = item.id;
      row.appendChild(saved);
    }
    return row;
  }

  function summaryLines(item) {
    try {
      return trainingMemoryContextSummary(item.context, t);
    } catch {
      return { cards: t('Decision example unavailable'), spot: '' };
    }
  }

  function createItemElement(item, expanded) {
    const control = el('button', 'saved-library-item saved-training-item');
    control.type = 'button';
    control.dataset.trainingHistoryId = item.id;
    control.dataset.trainingMode = item.mode;
    control.setAttribute('aria-expanded', String(expanded));
    control.setAttribute('aria-controls', detail.id);
    if (expanded) control.dataset.expanded = 'true';
    control.appendChild(pokerPreview(item));
    const copy = el('span', 'saved-library-item-copy');
    const identity = el('span', 'home-saved-item-title-row');
    identity.append(el('span', 'home-saved-item-kind', t(trainingMemoryModeLabelKey(item.mode))),
      el('strong', '', formatTrainingMemoryDate(item.answeredAt, locale())));
    const summary = summaryLines(item);
    // Like Saved items' meta row: one isolated span per fact, so mixed translated labels
    // and numbers read correctly in RTL. Separators are their own flex items, outside
    // the isolated facts, so they follow the row direction.
    // Not a poker-data-token: that class forces the whole row LTR under RTL.
    const meta = el('span', 'home-saved-item-meta saved-training-spot');
    (summary.spotParts ?? [summary.spot]).forEach((fact, index) => {
      if (index > 0) {
        const separator = el('i', 'saved-training-fact-separator', '·');
        separator.setAttribute('aria-hidden', 'true');
        meta.appendChild(separator);
      }
      const part = el('span', 'saved-training-fact', fact);
      part.dir = 'auto';
      meta.appendChild(part);
    });
    const action = el('span', 'saved-training-action', actionText(item));
    copy.append(identity, meta, action, badges(item), sourceLabelElement(item, 'saved-training-source'));
    control.setAttribute('aria-label', `${t('View details')}: ${modeDate(item)} · ${summary.cards}`);
    control.appendChild(copy);
    return control;
  }

  function actionButton(labelKey, className, attribute, value) {
    const button = el('button', className, t(labelKey));
    button.type = 'button';
    button.dataset[attribute] = value;
    return button;
  }

  function renderDetail(item) {
    detail.replaceChildren();
    if (!item) {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    const head = el('header', 'saved-library-detail-head');
    const headCopy = el('div');
    const title = el('h3', '', t('Answered Training decision'));
    title.id = 'savedTrainingHistoryDetailTitle';
    headCopy.append(el('span', 'home-saved-item-kind', modeDate(item)), title,
      el('p', 'saved-library-truth', t('Training Memory evidence · read-only')));
    const close = el('button', 'ui-button ui-button--quiet saved-library-detail-close', t('Close'));
    close.type = 'button';
    close.dataset.trainingHistoryClose = 'true';
    close.setAttribute('aria-label', t('Close details'));
    head.append(headCopy, close);
    detail.appendChild(head);
    detail.appendChild(pokerPreview(item, 'detail'));
    const summary = summaryLines(item);
    const facts = el('div', 'saved-library-detail-facts');
    (summary.spotParts ?? [summary.spot]).forEach((fact) => {
      const part = el('span', 'saved-training-fact', fact);
      part.dir = 'auto';
      facts.appendChild(part);
    });
    facts.appendChild(el('span', '', actionText(item)));
    detail.appendChild(facts);
    detail.appendChild(badges(item));
    const history = el('p', 'saved-training-history-source');
    history.dir = 'auto';
    history.appendChild(sourceLabelElement(item, ''));
    // The existing Memory row's frozen truth title; never re-resolved or upgraded.
    const truth = deps.historicalTruthTitle?.(item.record);
    if (truth) history.appendChild(el('span', '', ` · ${truth}`));
    detail.appendChild(history);
    const technical = el('p', 'saved-training-history-technical');
    technical.appendChild(technicalSourceElement(item));
    detail.appendChild(technical);

    const actions = el('div', 'saved-training-actions');
    actions.append(
      actionButton('Same Spot', 'ui-button ui-button--secondary', 'trainingHistoryRedrill', 'same_spot'),
      actionButton('Similar Spot', 'ui-button ui-button-ghost', 'trainingHistoryRedrill', 'similar_spot'),
    );
    const savedState = savedStates.get(item.id);
    if (savedState === 'saved') {
      const saved = el('p', 'saved-training-save-state', `✓ ${t('Saved as a Spot. It appears under Saved items.')}`);
      saved.dataset.trainingHistorySaved = item.id;
      actions.appendChild(saved);
    } else if (savedState === 'archived') {
      actions.appendChild(el('p', 'saved-training-save-state', t('A Spot saved from this decision was archived.')));
    } else {
      const save = actionButton(savedState === 'saving' ? 'Saving…' : 'Save as Spot', 'ui-button ui-button--primary',
        'trainingHistorySave', item.id);
      save.disabled = savedState === 'saving' || savedState === 'checking';
      actions.appendChild(save);
    }
    detail.appendChild(actions);
    if (actionMessage?.id === item.id) {
      const message = el('p', 'home-error-state', t(actionMessage.key));
      message.setAttribute('role', 'alert');
      detail.appendChild(message);
    }
  }

  function emptyState() {
    const root = el('div', 'home-empty-state');
    const action = el('button', 'ui-button ui-button--primary', t('Start Training'));
    action.type = 'button';
    action.dataset.trainingHistoryNavigate = 'training';
    root.append(
      el('h3', '', t('No answered Training decisions yet')),
      el('p', '', t('Decisions you answer in Training will appear here.')),
      action,
    );
    return root;
  }

  function noResultsState() {
    const empty = el('div', 'home-empty-state saved-library-category-empty saved-library-no-results');
    const action = el('button', 'ui-button ui-button--secondary', t('Clear filters'));
    action.type = 'button';
    action.dataset.trainingHistoryClear = '';
    empty.append(
      el('strong', '', t('No Training decisions match these filters.')),
      action,
    );
    return empty;
  }

  function render() {
    if (disposed) return;
    localizeControls();
    applyView();
    unsure.input.checked = query.unsureOnly;
    queued.input.checked = query.queuedOnly;
    clearButton.disabled = !savedTrainingHistoryQueryIsFiltered(query);
    list.setAttribute('aria-label', t('Answered Training decisions'));
    list.replaceChildren();
    container.dataset.trainingHistoryStatus = status;

    if (status !== 'ready') {
      currentView = null;
      for (const [mode, parts] of modeButtons) {
        parts.button.setAttribute('aria-pressed', String(mode === query.mode));
        parts.count.textContent = '0';
      }
      boundNote.hidden = true;
      withheldNote.hidden = true;
      statusLine.textContent = '';
      renderDetail(null);
      list.dataset.trainingHistoryState = status;
      if (status === 'error') {
        list.appendChild(el('p', 'home-error-state', t('Training history could not be loaded.')));
      } else if (status === 'loading' || status === 'idle') {
        list.appendChild(el('p', 'home-empty-state saved-library-loading', t('Loading Training history…')));
      }
      return;
    }

    const model = createSavedTrainingHistoryView({ items, bounded, limit, withheldCount, query });
    currentView = model;
    for (const [mode, parts] of modeButtons) {
      parts.button.setAttribute('aria-pressed', String(mode === query.mode));
      parts.count.textContent = String(model.counts[mode] ?? 0);
    }
    modes.dataset.countScope = model.countScope;
    boundNote.hidden = !model.bounded;
    boundNote.replaceChildren();
    if (model.bounded) {
      boundNote.append(
        el('span', '', t('Showing the {count} most recently answered decisions.', { count: items.length + withheldCount })),
        doc.createTextNode(' '),
        el('span', '', t('Counts cover shown items only.')),
      );
    }
    withheldNote.hidden = model.withheldCount === 0;
    withheldNote.textContent = model.withheldCount
      ? t('Decisions from your unfinished Full Hand appear here after that Hand finishes.')
      : '';
    statusLine.textContent = model.status === 'empty' || model.status === 'withheld_only' ? ''
      : model.filtered
        ? t('Showing {shown} of {total}', { shown: model.resultCount, total: model.totalCount })
        : t('Showing all {total}', { total: model.totalCount });
    list.dataset.trainingHistoryState = model.status;

    if (model.status !== 'results') {
      expandedId = null;
      renderDetail(null);
      if (model.status === 'empty') list.appendChild(emptyState());
      else if (model.status === 'no_results') list.appendChild(noResultsState());
      return;
    }
    if (!model.results.some((item) => item.id === expandedId)) expandedId = null;
    model.results.forEach((item) => list.appendChild(createItemElement(item, item.id === expandedId)));
    renderDetail(model.results.find((item) => item.id === expandedId));
  }

  function focusItem(id) {
    if (!id) return;
    [...list.querySelectorAll('[data-training-history-id]')].find((node) => node.dataset.trainingHistoryId === id)?.focus();
  }

  function trainingVisible() {
    return visible && selectedView === 'training';
  }

  function cancelLoadTimer() {
    if (loadTimer !== null) clearTimer(loadTimer);
    loadTimer = null;
  }

  function scheduleLoad(delay = coalesceMs) {
    if (disposed) return;
    cancelLoadTimer();
    loadTimer = setTimer(() => {
      loadTimer = null;
      void load();
    }, delay);
  }

  async function load() {
    if (disposed || loadInFlight || !trainingVisible()) return;
    const owner = generation;
    const sequence = ++loadSequence;
    const current = () => !disposed && owner === generation && sequence === loadSequence;
    dirty = false;
    loadInFlight = true;
    if (status !== 'ready') {
      status = 'loading';
      render();
    }
    let scope = null;
    try {
      scope = (await deps.captureScope?.()) ?? null;
      scope?.assertCurrent();
      if (!current()) return;
      await deps.whenReady?.();
      scope?.assertCurrent();
      if (!current()) return;
      const memory = deps.getTrainingMemory();
      if (typeof memory?.listRecentAnsweredDecisions !== 'function') {
        const error = new Error('Training Memory history is unavailable');
        error.code = 'training_memory_history_unavailable';
        throw error;
      }
      const page = await memory.listRecentAnsweredDecisions({ limit });
      scope?.assertCurrent();
      if (!current()) return;
      const partition = partitionSavedTrainingHistory(page?.decisions, page?.sessions, gateFor);
      items = partition.visible.map(projectSavedTrainingHistoryItem);
      withheldCount = partition.withheldCount;
      bounded = page?.bounded === true;
      status = 'ready';
    } catch (error) {
      if (!current()) return;
      if (scope && typeof scope.isCurrent === 'function' && !scope.isCurrent()) {
        // Stale owner scope: discard without adopting anything and retry for the current owner.
        dirty = true;
        return;
      }
      items = [];
      withheldCount = 0;
      bounded = false;
      status = 'error';
      deps.reportError?.(error);
    } finally {
      if (sequence === loadSequence) loadInFlight = false;
      if (current()) {
        if (trainingVisible()) render();
        if (trainingVisible() && dirty) scheduleLoad();
      }
    }
  }

  function itemById(id) {
    return items.find((item) => item.id === id) ?? null;
  }

  // Bounded single Saved lookup, only after the user opens one decision's detail.
  // The caller marks the decision 'checking' before rendering, so Save stays disabled until known.
  async function checkSavedState(item) {
    const owner = generation;
    try {
      const objectId = await savedTrainingHistorySpotObjectId(item.id);
      if (owner !== generation) return;
      const existing = await deps.savedService.getById(objectId);
      if (owner !== generation) return;
      savedStates.set(item.id, !existing ? 'unsaved' : existing.lifecycle?.state === 'archived' ? 'archived' : 'saved');
    } catch (error) {
      if (owner !== generation) return;
      savedStates.set(item.id, 'unsaved');
      deps.reportError?.(error);
    }
    if (owner === generation && trainingVisible()) render();
  }

  async function saveAsSpot(id) {
    const item = itemById(id);
    const state = savedStates.get(id);
    if (!item || ['saving', 'saved', 'archived', 'checking'].includes(state)) return;
    const owner = generation;
    savedStates.set(id, 'saving');
    actionMessage = null;
    render();
    let scope = null;
    try {
      scope = (await deps.captureScope?.()) ?? null;
      scope?.assertCurrent();
      if (owner !== generation) return;
      const objectId = await savedTrainingHistorySpotObjectId(id);
      if (owner !== generation) return;
      const existing = await deps.savedService.getById(objectId);
      scope?.assertCurrent();
      if (owner !== generation) return;
      if (existing) {
        savedStates.set(id, existing.lifecycle?.state === 'archived' ? 'archived' : 'saved');
      } else {
        // Training Memory reconstructs the exact canonical pre-action state (no write).
        const sameSpot = await deps.getTrainingMemory().createSameSpot(id);
        scope?.assertCurrent();
        if (owner !== generation) return;
        const input = buildSavedTrainingHistorySpotInput(item.record, sameSpot?.exercise?.pokerState);
        const saved = await deps.savedService.saveHandDerivedSpot({ ...input, operation: { id: objectId } });
        scope?.assertCurrent();
        if (owner !== generation) return;
        if (!saved?.object || saved.object.id !== objectId) throw new Error('Saved Spot identity changed');
        savedStates.set(id, 'saved');
      }
    } catch (error) {
      if (owner !== generation) return;
      savedStates.set(id, 'unsaved');
      actionMessage = { id, key: 'This decision could not be saved as a Spot.' };
      deps.reportError?.(error);
    }
    if (owner === generation && trainingVisible()) render();
  }

  function setView(next) {
    if (!SAVED_VIEWS.includes(next) || next === selectedView) {
      render();
      return;
    }
    selectedView = next;
    render();
    if (selectedView === 'training') {
      library?.hide();
      if (visible) {
        // No Training Memory change signal exists, so each show reloads the view.
        cancelLoadTimer();
        void load();
      }
    } else {
      cancelLoadTimer();
      if (visible) library?.show();
    }
  }

  function clearQuery() {
    query = createSavedTrainingHistoryQuery();
    expandedId = null;
    render();
    // The activating Clear control is now disabled or removed; keep focus in the view.
    modeButtons.get('all')?.button.focus?.();
  }

  function onChange(event) {
    const target = event.target;
    if (target?.dataset?.savedViewOption !== undefined && target.checked) return setView(target.value);
    if (target === unsure.input) {
      query = createSavedTrainingHistoryQuery({ ...query, unsureOnly: unsure.input.checked });
      return render();
    }
    if (target === queued.input) {
      query = createSavedTrainingHistoryQuery({ ...query, queuedOnly: queued.input.checked });
      return render();
    }
    return undefined;
  }

  function onClick(event) {
    const target = event.target;
    if (target.closest?.('[data-training-history-clear]')) return clearQuery();
    const navigate = target.closest?.('[data-training-history-navigate]');
    if (navigate) return deps.navigate?.(navigate.dataset.trainingHistoryNavigate);
    const mode = target.closest?.('[data-training-history-mode]');
    if (mode) {
      query = createSavedTrainingHistoryQuery({ ...query, mode: mode.dataset.trainingHistoryMode });
      expandedId = null;
      return render();
    }
    if (target.closest?.('[data-training-history-close]')) {
      const previousId = expandedId;
      expandedId = null;
      render();
      return focusItem(previousId);
    }
    const redrill = target.closest?.('[data-training-history-redrill]');
    if (redrill && expandedId) return void deps.openRedrill(expandedId, redrill.dataset.trainingHistoryRedrill);
    const save = target.closest?.('[data-training-history-save]');
    if (save) return void saveAsSpot(save.dataset.trainingHistorySave);
    const selection = target.closest?.('[data-training-history-id]');
    if (selection) {
      const id = selection.dataset.trainingHistoryId;
      expandedId = expandedId === id ? null : id;
      actionMessage = null;
      const item = expandedId ? itemById(expandedId) : null;
      const needsCheck = Boolean(item) && !savedStates.has(item.id);
      if (needsCheck) savedStates.set(item.id, 'checking');
      render();
      focusItem(id);
      if (needsCheck) void checkSavedState(item);
    }
    return undefined;
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !trainingVisible() || !expandedId) return;
    const previousId = expandedId;
    expandedId = null;
    render();
    focusItem(previousId);
  }

  const listeners = [
    [container, 'click', onClick],
    [container, 'change', onChange],
    [doc, 'keydown', onKeydown],
  ];
  listeners.forEach(([target, type, listener]) => target.addEventListener(type, listener));

  render();

  return Object.freeze({
    schemaVersion: SAVED_TRAINING_HISTORY_WORKSPACE_SCHEMA_VERSION,
    show() {
      if (disposed) return;
      visible = true;
      render();
      if (selectedView === 'items') {
        library?.show();
        return;
      }
      library?.hide();
      dirty = true;
      if (!loadInFlight) {
        cancelLoadTimer();
        void load();
      }
    },
    hide() {
      if (disposed) return;
      visible = false;
      library?.hide();
      if (loadTimer !== null) {
        cancelLoadTimer();
        dirty = true;
      }
    },
    invalidate() {
      if (disposed) return;
      dirty = true;
      if (trainingVisible()) scheduleLoad();
    },
    ownerChanged() {
      if (disposed) return;
      generation += 1;
      loadSequence += 1;
      loadInFlight = false;
      cancelLoadTimer();
      items = [];
      withheldCount = 0;
      bounded = false;
      status = 'idle';
      dirty = true;
      query = createSavedTrainingHistoryQuery();
      expandedId = null;
      actionMessage = null;
      savedStates.clear();
      selectedView = 'items';
      render();
      if (visible) library?.show();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      loadSequence += 1;
      cancelLoadTimer();
      listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
      items = [];
      currentView = null;
      savedStates.clear();
      librarySlots().forEach((node) => { node.hidden = false; });
      toggleSlot.replaceChildren();
      historySlot.replaceChildren();
      createdSlots.forEach((node) => node.remove());
      delete container.dataset.savedView;
      delete container.dataset.trainingHistoryStatus;
    },
    getState() {
      return Object.freeze({
        view: selectedView,
        status,
        visible,
        dirty,
        disposed,
        itemCount: items.length,
        withheldCount,
        bounded,
        expandedId,
        query,
        savedStates: Object.freeze(Object.fromEntries(savedStates)),
        model: currentView,
      });
    },
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineSavedTrainingHistory', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({ schemaVersion: SAVED_TRAINING_HISTORY_WORKSPACE_SCHEMA_VERSION, mount: mountSavedTrainingHistory }),
    writable: false,
  });
}
