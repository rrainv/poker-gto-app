// SAVED-TRAINING-HISTORY-001: the Saved destination's "Saved items | Training history"
// toggle and the read-only Training history view. Training Memory stays the sole owner
// of answered-decision evidence; the only write is an explicit "Save as Spot" through
// the existing Saved service. logic.js only mounts and routes it.
// SAVED-COMPOSITION-002: the same toolbar row, dense rows and sticky inspector as
// Saved items; the inspector's primary action is Same Spot.
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
import { savedItemAutoTitle } from './saved-item-presentation.mjs';

export const SAVED_TRAINING_HISTORY_WORKSPACE_SCHEMA_VERSION = 'saved-training-history-workspace/v1';
export const SAVED_VIEWS = Object.freeze(['items', 'training']);

const VIEW_LABELS = Object.freeze({ items: 'Saved items', training: 'Training history' });
const MODE_LABELS = Object.freeze({ all: 'All', varied: 'Varied', focused: 'Focused', full_hand: 'Full Hand' });
const ROW_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);
// Keyboard browsing coalesces the one bounded Saved lookup per opened decision.
const SAVED_STATE_CHECK_DELAY_MS = 160;

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
  let checkTimer = null;
  let pendingCheckId = null;
  let status = 'idle';
  let items = [];
  let bounded = false;
  let withheldCount = 0;
  let query = createSavedTrainingHistoryQuery();
  let expandedId = null;
  let currentView = null;
  let actionMessage = null;
  const rowNodes = new Map();
  // Session-only knowledge of which decisions already have a Saved Spot.
  const savedStates = new Map();

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, data = {}) => {
    const node = el('button', className, text);
    node.type = 'button';
    Object.assign(node.dataset, data);
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
  const controlsSlot = slot('data-saved-training-controls', 'saved-library-controls saved-training-controls');
  const historySlot = slot('data-saved-training-history', 'saved-training-history');
  const librarySlots = () => ['data-saved-library-controls', 'data-saved-library-body']
    .map((attribute) => container.querySelector(`[${attribute}]`))
    .filter(Boolean);

  // One two-option control: native radios give arrow-key selection and one tab stop.
  const toggleGroup = el('div', 'saved-view-toggle-group ui-tabs');
  toggleGroup.setAttribute('role', 'radiogroup');
  const radioName = `savedView-${Math.random().toString(36).slice(2, 10)}`;
  const toggleOptions = new Map();
  for (const option of SAVED_VIEWS) {
    const label = el('label', 'saved-view-option ui-tabs-item');
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

  const modes = el('div', 'saved-library-categories saved-training-modes');
  modes.setAttribute('role', 'group');
  const modeButtons = new Map();
  for (const mode of Object.keys(MODE_LABELS)) {
    const chip = button('saved-library-category ui-chip', undefined, { variant: 'filter', trainingHistoryMode: mode });
    const label = el('span');
    const count = el('strong', 'ui-chip-count', '0');
    count.dataset.trainingHistoryCount = mode;
    chip.append(label, count);
    modes.appendChild(chip);
    modeButtons.set(mode, { button: chip, label, count });
  }
  // Unsure and review-queue filters are toggle chips (aria-pressed).
  function toggleChip(attribute) {
    const chip = button('saved-library-toggle ui-chip', undefined, { variant: 'filter', [attribute]: '' });
    const caption = el('span');
    chip.appendChild(caption);
    return { button: chip, caption };
  }
  const unsure = toggleChip('trainingHistoryUnsure');
  const queued = toggleChip('trainingHistoryQueued');
  const clearButton = button('ui-button saved-library-clear', undefined, { variant: 'quiet', size: 'sm', trainingHistoryClear: '' });
  const statusLine = el('p', 'saved-library-status');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  const filters = el('div', 'saved-library-filters');
  filters.setAttribute('role', 'group');
  filters.append(unsure.button, queued.button, clearButton);
  controlsSlot.replaceChildren(modes, filters, statusLine);

  const localNote = el('p', 'saved-training-local-note');
  localNote.dataset.trainingHistoryLocal = '';
  const boundNote = el('p', 'saved-library-bound-note');
  boundNote.dataset.trainingHistoryBound = '';
  const withheldNote = el('p', 'saved-training-withheld-note');
  withheldNote.dataset.trainingHistoryWithheld = '';
  const layout = el('div', 'saved-library-layout saved-split');
  const listSurface = el('div', 'saved-list-surface panel');
  const list = el('div', 'saved-list saved-training-list');
  list.dataset.trainingHistoryList = '';
  // Column header row, aligned with the row grid (visual only; rows carry their own labels).
  const listHead = el('div', 'saved-list-head');
  listHead.setAttribute('aria-hidden', 'true');
  const headAside = el('span', 'saved-row-aside');
  const headCells = { cards: el('span'), title: el('span'), review: el('span'), time: el('span') };
  headAside.append(headCells.review, headCells.time);
  listHead.append(headCells.cards, headCells.title, headAside);
  const HEAD_KEYS = Object.freeze({ cards: 'Cards', title: 'Decision', review: 'Review', time: 'Answered' });
  listSurface.append(listHead, list);
  const detail = el('aside', 'saved-library-detail saved-training-detail saved-inspector panel');
  detail.id = 'savedTrainingHistoryDetail';
  detail.setAttribute('aria-labelledby', 'savedTrainingHistoryDetailTitle');
  detail.hidden = true;
  layout.append(listSurface, detail);
  historySlot.replaceChildren(localNote, boundNote, withheldNote, layout);

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
    clearButton.textContent = t('Clear');
    clearButton.setAttribute('aria-label', t('Clear filters'));
    for (const [key, cell] of Object.entries(headCells)) cell.textContent = t(HEAD_KEYS[key]);
  }

  function applyView() {
    const trainingShown = selectedView === 'training';
    librarySlots().forEach((node) => { node.hidden = trainingShown; });
    controlsSlot.hidden = !trainingShown;
    historySlot.hidden = !trainingShown;
    container.dataset.savedView = selectedView;
  }

  function modeDate(item) {
    return `${t(trainingMemoryModeLabelKey(item.mode))} · ${formatTrainingMemoryDate(item.answeredAt, locale())}`;
  }

  function actionLabel(item) {
    return deps.actionLabel ? deps.actionLabel(item.record) : item.action.type;
  }

  function actionText(item) {
    if (!item.action?.type) return t('No answer recorded');
    return `${t('Chosen action')}: ${actionLabel(item)}`;
  }

  function reviewText(item) {
    const due = item.review.dueAt ? formatTrainingMemoryDate(item.review.dueAt, locale()) : null;
    if (item.review.kind === 'revisit') return due ? t('Revisit due {date}', { date: due }) : t('Revisit requested');
    if (item.review.kind === 'queued') return due ? t('In review queue · due {date}', { date: due }) : t('In review queue');
    if (item.review.kind === 'reviewed') return t('Reviewed');
    return null;
  }

  // The decision's title uses the Saved auto-title rule over its frozen DecisionContext.
  function itemTitle(item) {
    const context = item.context ?? {};
    return savedItemAutoTitle({
      kind: 'spot',
      heroCards: item.heroCards,
      heroPosition: context.heroPosition,
      street: context.street,
      aggressorPosition: context.priorActionSummary?.aggressorPosition ?? null,
    }, t);
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
    const token = el('bdi', 'poker-data-token technical-id', `${item.source.id}@${item.source.version}`);
    token.dir = 'ltr';
    line.append(el('span', '', `${t('Technical source')}: `), token);
    return line;
  }

  // Same shared card-tile component as Saved items, from the frozen record's cards.
  function pokerPreview(item, variant = 'row') {
    return createSavedPokerPreview(doc, item, {
      variant,
      translate: t,
      getCardPresentation: deps.getCardPresentation,
      getCardRankStyle: deps.getCardRankStyle,
    });
  }

  function badges(item) {
    const row = el('span', 'home-saved-item-badges saved-training-badges saved-row-states');
    const badge = (text, tone) => {
      const node = el('span', 'ui-badge', text);
      if (tone) node.dataset.tone = tone;
      row.appendChild(node);
      return node;
    };
    if (item.unsure) badge(t('Marked Unsure'), 'caution');
    const review = reviewText(item);
    if (review) badge(review, 'neutral');
    if (savedStates.get(item.id) === 'saved') {
      const saved = badge(`✓ ${t('Saved as a Spot')}`, 'positive');
      saved.className = `${saved.className} saved-training-saved-badge`;
      saved.dataset.trainingHistorySaved = item.id;
    }
    return row;
  }

  function summaryLines(item) {
    try {
      return trainingMemoryContextSummary(item.context, t, { facing: 'summary' });
    } catch {
      return { cards: t('Decision example unavailable'), spot: '' };
    }
  }

  function factsElement(item, className) {
    // One isolated span per fact, so mixed translated labels and numbers read correctly
    // in RTL. Separators are their own flex items, outside the isolated facts.
    const meta = el('span', className);
    const summary = summaryLines(item);
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
    return meta;
  }

  function createItemElement(item) {
    const control = button('saved-library-item saved-training-item ui-row', undefined, {
      trainingHistoryId: item.id,
      trainingMode: item.mode,
    });
    control.setAttribute('aria-controls', detail.id);
    const cards = el('span', 'saved-row-cards');
    cards.appendChild(pokerPreview(item));
    const copy = el('span', 'saved-library-item-copy');
    const identity = el('span', 'saved-row-title ui-row-title');
    const title = el('strong', '', itemTitle(item));
    title.dir = 'auto';
    identity.append(el('span', 'saved-row-kind', t(trainingMemoryModeLabelKey(item.mode))), title);
    const meta = factsElement(item, 'home-saved-item-meta saved-training-spot ui-row-meta');
    const action = el('span', 'saved-training-action ui-row-meta', actionText(item));
    copy.append(identity, meta, action, sourceLabelElement(item, 'saved-training-source'));
    const summary = summaryLines(item);
    control.setAttribute('aria-label', `${t('View details')}: ${modeDate(item)} · ${summary.cards}`);
    const aside = el('span', 'saved-row-aside');
    aside.append(badges(item), el('span', 'saved-row-time', formatTrainingMemoryDate(item.answeredAt, locale())));
    control.append(cards, copy, aside);
    rowNodes.set(item.id, control);
    return control;
  }

  function renderEmptyInspector() {
    const empty = el('div', 'saved-inspector-empty');
    empty.dataset.savedInspectorEmpty = '';
    empty.append(
      el('p', '', t('Select an answered decision to inspect it.')),
      el('p', 'saved-inspector-hint', t('Up and Down move the selection; Enter opens it.')),
    );
    detail.appendChild(empty);
  }

  function renderDetail(item) {
    detail.replaceChildren();
    if (status !== 'ready' || currentView?.status !== 'results') {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    detail.dataset.savedInspectorState = item ? 'selected' : 'empty';
    if (!item) {
      renderEmptyInspector();
      return;
    }
    const head = el('div', 'saved-library-detail-head saved-inspector-head');
    const headCopy = el('div');
    const kind = el('span', 'ui-badge saved-inspector-kind', t('Answered Training decision'));
    kind.dataset.tone = 'neutral';
    const title = el('h2', 'saved-inspector-title', itemTitle(item));
    title.id = 'savedTrainingHistoryDetailTitle';
    title.dir = 'auto';
    headCopy.append(kind, title,
      el('p', 'saved-library-truth', `${modeDate(item)} · ${t('Training Memory evidence · read-only')}`));
    const close = button('ui-button saved-library-detail-close', t('Close'), { variant: 'quiet', size: 'sm', trainingHistoryClose: 'true' });
    close.setAttribute('aria-label', t('Close details'));
    head.append(headCopy, close);

    const body = el('div', 'saved-inspector-body');
    body.appendChild(pokerPreview(item, 'detail'));
    const facts = el('div', 'saved-inspector-spot');
    facts.appendChild(factsElement(item, 'saved-training-spot'));
    body.appendChild(facts);
    const answer = el('dl', 'ui-facts saved-inspector-facts');
    const fact = (key, labelKey, value) => {
      const row = el('div');
      row.dataset.savedFact = key;
      const valueNode = el('dd', '', value);
      valueNode.dir = 'auto';
      row.append(el('dt', '', t(labelKey)), valueNode);
      answer.appendChild(row);
    };
    fact('action', 'Chosen action', item.action?.type ? actionLabel(item) : t('No answer recorded'));
    fact('mode', 'Training mode', t(trainingMemoryModeLabelKey(item.mode)));
    fact('answered', 'Answered', formatTrainingMemoryDate(item.answeredAt, locale()));
    body.appendChild(answer);
    body.appendChild(badges(item));
    const history = el('p', 'saved-training-history-source');
    history.dir = 'auto';
    history.appendChild(sourceLabelElement(item, ''));
    // The existing Memory row's frozen truth title; never re-resolved or upgraded.
    const truth = deps.historicalTruthTitle?.(item.record);
    if (truth) history.appendChild(el('span', '', ` · ${truth}`));
    body.appendChild(history);
    const technical = el('p', 'saved-training-history-technical');
    technical.appendChild(technicalSourceElement(item));
    body.appendChild(technical);

    const actions = el('div', 'saved-training-actions saved-inspector-actions');
    actions.append(
      button('ui-button', t('Same Spot'), { variant: 'primary', trainingHistoryRedrill: 'same_spot' }),
      button('ui-button', t('Similar Spot'), { variant: 'secondary', trainingHistoryRedrill: 'similar_spot' }),
    );
    const savedState = savedStates.get(item.id);
    if (savedState === 'saved') {
      const saved = el('p', 'saved-training-save-state', `✓ ${t('Saved as a Spot. It appears under Saved items.')}`);
      saved.dataset.trainingHistorySaved = item.id;
      actions.appendChild(saved);
    } else if (savedState === 'archived') {
      actions.appendChild(el('p', 'saved-training-save-state', t('A Spot saved from this decision was archived.')));
    } else {
      const save = button('ui-button', t(savedState === 'saving' ? 'Saving…' : 'Save as Spot'),
        { variant: 'secondary', trainingHistorySave: item.id });
      save.disabled = savedState === 'saving' || savedState === 'checking';
      actions.appendChild(save);
    }
    detail.append(head, body, actions);
    if (actionMessage?.id === item.id) {
      const message = el('p', 'home-error-state', t(actionMessage.key));
      message.setAttribute('role', 'alert');
      detail.appendChild(message);
    }
  }

  function emptyState() {
    const root = el('div', 'home-empty-state saved-empty-state');
    const action = button('ui-button ui-button--primary', t('Start Training'), { trainingHistoryNavigate: 'training' });
    root.append(
      el('h3', '', t('No answered Training decisions yet')),
      el('p', '', t('Decisions you answer in Training will appear here.')),
      action,
    );
    return root;
  }

  function noResultsState() {
    const empty = el('div', 'home-empty-state saved-library-category-empty saved-library-no-results');
    const action = button('ui-button ui-button--secondary', t('Clear filters'), { trainingHistoryClear: '' });
    empty.append(
      el('strong', '', t('No Training decisions match these filters.')),
      action,
    );
    return empty;
  }

  // Selection updates row attributes and the inspector only; the list never moves.
  function applySelection() {
    const results = currentView?.status === 'results' ? currentView.results : [];
    const anchor = expandedId ?? results[0]?.id ?? null;
    for (const [id, node] of rowNodes) {
      const selected = id === expandedId;
      node.setAttribute('aria-expanded', String(selected));
      node.setAttribute('aria-current', String(selected));
      if (selected) node.dataset.expanded = 'true';
      else delete node.dataset.expanded;
      node.tabIndex = id === anchor ? 0 : -1;
    }
    renderDetail(results.find((item) => item.id === expandedId));
  }

  // A re-render (reload after an edit, a save) replaces the focused row or inspector
  // control; focus returns to its replacement so keyboard position is kept.
  const FOCUS_KEYS = Object.freeze(['trainingHistoryRedrill', 'trainingHistorySave', 'trainingHistoryClose']);
  const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  function captureFocus() {
    const active = doc.activeElement;
    if (!active?.dataset || !container.contains(active)) return null;
    if (active.dataset.trainingHistoryId !== undefined) return { row: active.dataset.trainingHistoryId };
    const key = FOCUS_KEYS.find((name) => active.dataset[name] !== undefined);
    return key ? { key } : null;
  }
  function restoreFocus(token) {
    if (!token || (doc.activeElement?.isConnected && container.contains(doc.activeElement))) return;
    const target = token.row ? rowNodes.get(token.row) : detail.querySelector(`[data-${kebab(token.key)}]`);
    // A control that no longer exists (Save replaced by its saved state) yields to the row.
    (target ?? rowNodes.get(expandedId))?.focus();
  }

  // The inspector fits the viewport from where the list starts (the toolbar may wrap),
  // so its actions are visible without scrolling; measured on render and resize.
  function syncInspectorBound() {
    if (layout.dataset.savedLayout !== 'split' || typeof layout.getBoundingClientRect !== 'function') return;
    const top = Math.max(0, Math.round(layout.getBoundingClientRect().top + (view.scrollY || 0)));
    layout.style.setProperty?.('--saved-inspector-top', `${top}px`);
  }

  function render() {
    const focus = captureFocus();
    renderView();
    restoreFocus(focus);
  }

  function renderView() {
    if (disposed) return;
    localizeControls();
    applyView();
    unsure.button.setAttribute('aria-pressed', String(query.unsureOnly));
    queued.button.setAttribute('aria-pressed', String(query.queuedOnly));
    clearButton.disabled = !savedTrainingHistoryQueryIsFiltered(query);
    list.setAttribute('aria-label', t('Answered Training decisions'));
    list.replaceChildren();
    rowNodes.clear();
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
      if (trainingVisible()) deps.publishContext?.([]);
      layout.dataset.savedLayout = 'message';
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
    // The header context follows the shown view (SHELL-001 Saved context).
    if (trainingVisible()) deps.publishContext?.(statusLine.textContent ? [statusLine.textContent] : []);

    if (model.status !== 'results') {
      expandedId = null;
      layout.dataset.savedLayout = 'message';
      renderDetail(null);
      if (model.status === 'empty') list.appendChild(emptyState());
      else if (model.status === 'no_results') list.appendChild(noResultsState());
      return;
    }
    layout.dataset.savedLayout = 'split';
    syncInspectorBound();
    if (!model.results.some((item) => item.id === expandedId)) expandedId = null;
    model.results.forEach((item) => list.appendChild(createItemElement(item)));
    applySelection();
  }

  function focusItem(id) {
    if (id) rowNodes.get(id)?.focus();
  }

  function trainingVisible() {
    return visible && selectedView === 'training';
  }

  function cancelLoadTimer() {
    if (loadTimer !== null) clearTimer(loadTimer);
    loadTimer = null;
  }

  // Dropping a deferred lookup also drops its 'checking' marker, so the row is
  // checked again when it is selected next.
  function cancelCheckTimer() {
    if (checkTimer !== null) clearTimer(checkTimer);
    checkTimer = null;
    if (pendingCheckId !== null && savedStates.get(pendingCheckId) === 'checking') savedStates.delete(pendingCheckId);
    pendingCheckId = null;
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

  function select(id, { deferCheck = false } = {}) {
    if (expandedId !== id) actionMessage = null;
    expandedId = id;
    const item = itemById(id);
    cancelCheckTimer();
    const needsCheck = Boolean(item) && !savedStates.has(item.id);
    if (needsCheck) savedStates.set(item.id, 'checking');
    applySelection();
    focusItem(id);
    if (!needsCheck) return;
    if (!deferCheck) {
      void checkSavedState(item);
      return;
    }
    // Held arrow keys pass rows quickly; only the row the user stops on is looked up.
    pendingCheckId = item.id;
    checkTimer = setTimer(() => {
      checkTimer = null;
      pendingCheckId = null;
      void checkSavedState(item);
    }, SAVED_STATE_CHECK_DELAY_MS);
  }

  function closeInspector() {
    const previousId = expandedId;
    cancelCheckTimer();
    expandedId = null;
    actionMessage = null;
    applySelection();
    focusItem(previousId);
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
    return undefined;
  }

  function onClick(event) {
    const target = event.target;
    if (target.closest?.('[data-training-history-clear]')) return clearQuery();
    if (target.closest?.('[data-training-history-unsure]')) {
      query = createSavedTrainingHistoryQuery({ ...query, unsureOnly: !query.unsureOnly });
      return render();
    }
    if (target.closest?.('[data-training-history-queued]')) {
      query = createSavedTrainingHistoryQuery({ ...query, queuedOnly: !query.queuedOnly });
      return render();
    }
    const navigate = target.closest?.('[data-training-history-navigate]');
    if (navigate) return deps.navigate?.(navigate.dataset.trainingHistoryNavigate);
    const mode = target.closest?.('[data-training-history-mode]');
    if (mode) {
      query = createSavedTrainingHistoryQuery({ ...query, mode: mode.dataset.trainingHistoryMode });
      expandedId = null;
      return render();
    }
    if (target.closest?.('[data-training-history-close]')) return closeInspector();
    const redrill = target.closest?.('[data-training-history-redrill]');
    if (redrill && expandedId) return void deps.openRedrill(expandedId, redrill.dataset.trainingHistoryRedrill);
    const save = target.closest?.('[data-training-history-save]');
    if (save) return void saveAsSpot(save.dataset.trainingHistorySave);
    const selection = target.closest?.('[data-training-history-id]');
    if (selection) return select(selection.dataset.trainingHistoryId);
    return undefined;
  }

  // Rows: Up/Down/Home/End move the selection; Enter opens the decision as Same Spot.
  function onRowKeydown(event) {
    const row = event.target?.closest?.('[data-training-history-id]');
    if (!row || !trainingVisible()) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      return void deps.openRedrill(row.dataset.trainingHistoryId, 'same_spot');
    }
    if (!ROW_KEYS.has(event.key)) return undefined;
    const results = currentView?.status === 'results' ? currentView.results : [];
    if (!results.length) return undefined;
    event.preventDefault();
    const index = results.findIndex((item) => item.id === row.dataset.trainingHistoryId);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? results.length - 1
        : Math.min(results.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
    return select(results[next].id, { deferCheck: true });
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !trainingVisible() || !expandedId) return;
    const target = event.target;
    if (target && target !== doc && target !== doc.body && !container.contains(target)) return;
    event.preventDefault();
    closeInspector();
  }

  const listeners = [
    [container, 'click', onClick],
    [container, 'change', onChange],
    [container, 'keydown', onRowKeydown],
    [doc, 'keydown', onKeydown],
    [view, 'resize', syncInspectorBound],
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
      cancelCheckTimer();
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
      cancelCheckTimer();
      listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
      items = [];
      currentView = null;
      rowNodes.clear();
      savedStates.clear();
      librarySlots().forEach((node) => { node.hidden = false; });
      toggleSlot.replaceChildren();
      controlsSlot.replaceChildren();
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
