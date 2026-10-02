// SAVED-LIBRARY-001: the Saved destination's own bounded library query, state,
// search/filter/sort and rendering. logic.js only mounts and routes it.
// SavedStudyObject v1 remains the authority; nothing here is persisted.
import { createHomeSavedItem } from './home-view-model.mjs';
import { createSavedPokerPreview } from './saved-poker-preview.mjs';
import {
  SAVED_LIBRARY_LIMIT,
  clearSavedLibraryQuery,
  createSavedLibraryQuery,
  createSavedLibraryView,
  savedLibraryQueryIsFiltered,
} from './saved-library-query.mjs';

export const SAVED_LIBRARY_WORKSPACE_SCHEMA_VERSION = 'saved-library-workspace/v1';

const CATEGORY_ICONS = Object.freeze({
  all: '<rect x="2.5" y="2.5" width="6" height="6" rx="1"></rect><rect x="11.5" y="2.5" width="6" height="6" rx="1"></rect><rect x="2.5" y="11.5" width="6" height="6" rx="1"></rect><rect x="11.5" y="11.5" width="6" height="6" rx="1"></rect>',
  hands: '<rect x="5.5" y="2.5" width="10" height="14" rx="2"></rect><path d="M5.5 5.5h-1a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6"></path><path d="M10.5 8.5c0-1.8 3-1.8 3 0 0 1.4-1.5 2.1-1.5 2.1s-1.5-.7-1.5-2.1Z"></path>',
  spots: '<circle cx="10" cy="10" r="7.5"></circle><circle cx="10" cy="10" r="3"></circle><path d="M10 1v3M10 16v3M1 10h3M16 10h3"></path>',
});
const CATEGORY_LABELS = Object.freeze({ all: 'All', hands: 'Hands', spots: 'Spots' });
const REVIEW_LABELS = Object.freeze({ any: 'Any review state', review_later: 'Review later', resolved: 'Resolved' });
const SORT_LABELS = Object.freeze({ updated: 'Recently updated', created: 'Recently created' });

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`Saved library requires ${label}`);
}

export function mountSavedLibrary(container, deps = {}) {
  if (!container?.ownerDocument) throw new TypeError('Saved library requires a mounted container');
  requireFunction(deps.savedService?.listRecent, 'a bounded Saved listRecent query');
  requireFunction(deps.translate, 'a translate function');
  requireFunction(deps.presentation?.itemTitle, 'an item title helper');
  requireFunction(deps.presentation?.itemFacts, 'an item facts helper');
  requireFunction(deps.openItem, 'the Saved open controller');

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  const t = (key, parameters) => deps.translate(key, parameters);
  const itemTitle = (item) => deps.presentation.itemTitle(item);
  const itemFacts = (item) => deps.presentation.itemFacts(item);
  const setTimer = deps.timers?.set ?? ((callback, delay) => view.setTimeout(callback, delay));
  const clearTimer = deps.timers?.clear ?? ((id) => view.clearTimeout(id));
  const mapItem = deps.mapItem ?? createHomeSavedItem;
  const limit = deps.limit ?? SAVED_LIBRARY_LIMIT;
  const debounceMs = deps.searchDebounceMs ?? 150;
  const coalesceMs = deps.coalesceMs ?? 80;
  const overlay = deps.overlay ?? null;

  let disposed = false;
  let visible = false;
  let dirty = true;
  let generation = 0;
  let loadSequence = 0;
  let loadInFlight = false;
  let loadTimer = null;
  let searchTimer = null;
  let status = 'idle';
  let items = [];
  let loadedCount = 0;
  let query = createSavedLibraryQuery();
  let expandedId = null;
  let previewOwner = null;
  let currentView = null;

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const createdSlots = [];
  function slot(attribute, className) {
    const existing = container.querySelector(`[${attribute}]`);
    if (existing) return existing;
    const created = el('div', className);
    created.setAttribute(attribute, '');
    container.appendChild(created);
    createdSlots.push(created);
    return created;
  }
  const controlsSlot = slot('data-saved-library-controls', 'saved-library-controls');
  const bodySlot = slot('data-saved-library-body', 'saved-library-body');

  // Controls are built once so typing and filter focus survive re-rendering.
  const searchLabel = el('label', 'saved-library-search');
  const searchCaption = el('span');
  const searchInput = el('input');
  searchInput.type = 'search';
  searchInput.dir = 'auto';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.dataset.savedLibrarySearch = '';
  searchLabel.append(searchCaption, searchInput);

  const categories = el('div', 'saved-library-categories');
  categories.setAttribute('role', 'group');
  const categoryButtons = new Map();
  for (const category of Object.keys(CATEGORY_LABELS)) {
    const button = el('button', 'saved-library-category ui-chip');
    button.type = 'button';
    button.dataset.variant = 'filter';
    button.dataset.savedCategory = category;
    button.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${CATEGORY_ICONS[category]}</svg>`;
    const label = el('span');
    const count = el('strong', 'ui-chip-count', '0');
    count.dataset.savedCategoryCount = category;
    button.append(label, count);
    categories.appendChild(button);
    categoryButtons.set(category, { button, label, count });
  }

  function selectFilter(attribute) {
    const label = el('label', 'saved-library-filter');
    const caption = el('span');
    const select = el('select');
    select.dataset[attribute] = '';
    label.append(caption, select);
    return { label, caption, select };
  }
  const review = selectFilter('savedLibraryReview');
  const tag = selectFilter('savedLibraryTag');
  const sort = selectFilter('savedLibrarySort');
  for (const [value] of Object.entries(REVIEW_LABELS)) review.select.appendChild(Object.assign(el('option'), { value }));
  for (const [value] of Object.entries(SORT_LABELS)) sort.select.appendChild(Object.assign(el('option'), { value }));

  const mistakes = el('label', 'saved-library-toggle ui-check');
  const mistakesInput = el('input');
  mistakesInput.type = 'checkbox';
  mistakesInput.dataset.savedLibraryMistakes = '';
  const mistakesCaption = el('span');
  mistakes.append(mistakesInput, mistakesCaption);

  const clearButton = el('button', 'ui-button ui-button--quiet saved-library-clear');
  clearButton.type = 'button';
  clearButton.dataset.savedLibraryClear = '';

  const filters = el('div', 'saved-library-filters');
  filters.setAttribute('role', 'group');
  filters.append(review.label, mistakes, tag.label, sort.label, clearButton);
  controlsSlot.append(searchLabel, categories, filters);

  const boundNote = el('p', 'saved-library-bound-note');
  boundNote.dataset.savedLibraryBound = '';
  const statusLine = el('p', 'saved-library-status');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');
  const layout = el('div', 'saved-library-layout');
  const list = el('div', 'home-saved-list');
  list.dataset.savedLibraryList = '';
  const detail = el('aside', 'saved-library-detail');
  detail.id = 'savedLibraryDetail';
  detail.setAttribute('aria-labelledby', 'savedLibraryDetailTitle');
  detail.hidden = true;
  layout.append(list, detail);
  bodySlot.append(boundNote, statusLine, layout);

  function localizeControls() {
    searchCaption.textContent = t('Search Saved');
    searchInput.placeholder = t('Title, note, or tag');
    categories.setAttribute('aria-label', t('Saved categories'));
    for (const [category, parts] of categoryButtons) parts.label.textContent = t(CATEGORY_LABELS[category]);
    review.caption.textContent = t('Review state');
    [...review.select.options].forEach((option) => { option.textContent = t(REVIEW_LABELS[option.value]); });
    tag.caption.textContent = t('Tag');
    sort.caption.textContent = t('Sort');
    [...sort.select.options].forEach((option) => { option.textContent = t(SORT_LABELS[option.value]); });
    mistakesCaption.textContent = t('Mistakes only');
    filters.setAttribute('aria-label', t('Library filters'));
    clearButton.textContent = t('Clear filters');
    clearButton.setAttribute('aria-label', t('Clear search and filters'));
  }

  // Card tiles come from the shared Saved preview builder (also used by Training history).
  function createPokerPreview(item, { variant = 'compact' } = {}) {
    return createSavedPokerPreview(doc, item, {
      variant,
      translate: t,
      getCardPresentation: deps.getCardPresentation,
      getCardRankStyle: deps.getCardRankStyle,
    });
  }

  function hidePreview() {
    const wasVisible = Boolean(overlay && !overlay.hidden);
    previewOwner = null;
    if (overlay) {
      overlay.hidden = true;
      overlay.replaceChildren();
      overlay.removeAttribute('data-placement');
    }
    return wasVisible;
  }

  function positionPreview(owner) {
    const margin = 12;
    const gap = 8;
    const ownerRect = owner.getBoundingClientRect();
    overlay.style.maxWidth = `${Math.max(0, view.innerWidth - (margin * 2))}px`;
    const overlayRect = overlay.getBoundingClientRect();
    const preferredX = doc.documentElement.dir === 'rtl' ? ownerRect.right - overlayRect.width : ownerRect.left;
    const left = Math.min(Math.max(margin, preferredX), Math.max(margin, view.innerWidth - overlayRect.width - margin));
    const below = ownerRect.bottom + gap;
    const above = ownerRect.top - overlayRect.height - gap;
    const useAbove = below + overlayRect.height > view.innerHeight - margin && above >= margin;
    const top = useAbove
      ? above
      : Math.min(Math.max(margin, below), Math.max(margin, view.innerHeight - overlayRect.height - margin));
    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.top = `${Math.round(top)}px`;
    overlay.dataset.placement = useAbove ? 'above' : 'below';
    overlay.style.visibility = 'visible';
  }

  function showPreview(owner) {
    const item = items.find((candidate) => candidate.id === owner?.dataset.savedSelectId);
    if (!overlay || !visible || !item || (item.kind !== 'hand' && item.kind !== 'spot')
      || owner.getAttribute('aria-expanded') === 'true') {
      hidePreview();
      return;
    }
    overlay.replaceChildren(
      el('span', 'saved-library-quick-label', t(item.derivation === 'scenario' ? 'Scenario snapshot' : 'Hand snapshot')),
      createPokerPreview(item, { variant: 'quick' }),
    );
    overlay.hidden = false;
    overlay.style.visibility = 'hidden';
    previewOwner = owner;
    positionPreview(owner);
  }

  function handlePreviewExit(event) {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner && owner === previewOwner && !owner.contains(event.relatedTarget)) hidePreview();
  }

  function createItemElement(item, expanded) {
    const control = el('button', 'saved-library-item');
    control.type = 'button';
    control.dataset.savedSelectId = item.id;
    control.dataset.savedKind = item.kind;
    control.setAttribute('aria-expanded', String(expanded));
    control.setAttribute('aria-controls', detail.id);
    control.setAttribute('aria-label', `${t('View details')}: ${itemTitle(item)}`);
    if (expanded) control.dataset.expanded = 'true';
    if (item.kind === 'hand' || item.kind === 'spot') control.appendChild(createPokerPreview(item));
    const copy = el('span', 'saved-library-item-copy');
    const identity = el('span', 'home-saved-item-title-row');
    const title = el('strong', '', itemTitle(item));
    title.dir = 'auto';
    identity.append(el('span', 'home-saved-item-kind', t(item.kind === 'hand' ? 'Hand' : item.kind === 'spot' ? 'Spot' : 'Saved item')), title);
    const meta = el('span', 'home-saved-item-meta poker-data-token');
    meta.dir = 'ltr';
    itemFacts(item).slice(0, 4).forEach((fact) => meta.appendChild(el('span', '', fact)));
    copy.append(identity, meta);
    if (item.reviewState === 'review_later' || item.isMistake) {
      copy.appendChild(el('span', 'saved-library-item-review', t(item.isMistake ? 'Marked as a mistake' : 'Review later')));
    }
    control.appendChild(copy);
    return control;
  }

  function itemTruth(item) {
    if (item.kind === 'hand') return 'Canonical Hand · read-only replay';
    if (item.derivation === 'scenario') return 'Scenario study snapshot · no canonical Hand history';
    if (item.kind === 'spot') return 'Decision snapshot · Hand history unavailable';
    return 'This saved object type is unavailable in this Riverline version.';
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
    const title = el('h3', '', itemTitle(item));
    title.id = 'savedLibraryDetailTitle';
    title.dir = 'auto';
    headCopy.append(
      el('span', 'home-saved-item-kind', t(item.kind === 'hand' ? 'Saved Hand' : item.kind === 'spot' ? 'Saved Spot' : 'Saved item')),
      title,
      el('p', 'saved-library-truth', t(itemTruth(item))),
    );
    const close = el('button', 'ui-button ui-button--quiet saved-library-detail-close', t('Close'));
    close.type = 'button';
    close.dataset.savedDetailClose = 'true';
    close.setAttribute('aria-label', t('Close details'));
    head.append(headCopy, close);
    detail.appendChild(head);
    if (item.kind === 'hand' || item.kind === 'spot') detail.appendChild(createPokerPreview(item, { variant: 'detail' }));
    const facts = el('div', 'saved-library-detail-facts poker-data-token');
    facts.dir = 'ltr';
    itemFacts(item).forEach((fact) => facts.appendChild(el('span', '', fact)));
    detail.appendChild(facts);
    if (item.note) {
      const note = el('section', 'saved-library-note');
      const noteCopy = el('p', '', item.note);
      noteCopy.dir = 'auto';
      note.append(el('h4', '', t('Study note')), noteCopy);
      detail.appendChild(note);
    }
    if (item.tags.length || item.reviewState === 'review_later' || item.isMistake) {
      const annotations = el('div', 'home-saved-item-badges');
      if (item.reviewState === 'review_later') annotations.appendChild(el('span', 'home-saved-badge home-saved-badge--review', t('Review later')));
      if (item.isMistake) annotations.appendChild(el('span', 'home-saved-badge home-saved-badge--mistake', t('Marked as a mistake')));
      item.tags.forEach((value) => {
        const tagElement = el('span', 'home-saved-badge', value);
        tagElement.dir = 'auto';
        annotations.appendChild(tagElement);
      });
      detail.appendChild(annotations);
    }
    const supported = item.kind === 'hand' || item.kind === 'spot';
    const action = el('button', 'ui-button ui-button--primary saved-library-open',
      t(item.kind === 'hand' ? 'Open Hand' : item.kind === 'spot' ? 'Open Spot' : 'Unavailable'));
    action.type = 'button';
    action.dataset.savedLibraryOpen = item.id;
    action.disabled = !supported;
    action.setAttribute('aria-label', `${action.textContent}: ${itemTitle(item)}`);
    detail.appendChild(action);
  }

  function libraryEmptyState() {
    const root = el('div', 'home-empty-state');
    const action = el('button', 'ui-button ui-button--primary', t('Analyze a Hand'));
    action.type = 'button';
    action.dataset.savedLibraryNavigate = 'analyze';
    root.append(
      el('h3', '', t('Keep a decision worth returning to')),
      el('p', '', t('Saved Hands and Spots you intentionally keep will appear here.')),
      action,
    );
    return root;
  }

  function kindEmptyState(kind) {
    const empty = el('div', 'home-empty-state saved-library-category-empty');
    if (kind === 'hands') {
      empty.append(el('strong', '', t('No saved Hands yet.')), el('p', '', t('Save a Hand from Hand or Review to keep it for later study.')));
    } else {
      empty.append(el('strong', '', t('No saved Spots yet.')), el('p', '', t('Save a Spot from Analyze or Review to keep it for later study.')));
    }
    return empty;
  }

  function noResultsState() {
    const empty = el('div', 'home-empty-state saved-library-category-empty saved-library-no-results');
    const action = el('button', 'ui-button ui-button--secondary', t('Clear search and filters'));
    action.type = 'button';
    action.dataset.savedLibraryClear = '';
    empty.append(
      el('strong', '', t('Nothing matches your search and filters.')),
      el('p', '', t('Every loaded Saved item was excluded by the current search or filters.')),
      action,
    );
    return empty;
  }

  function renderTagOptions(options) {
    const selected = query.tag ?? '';
    const signature = JSON.stringify([t('All tags'), options.map((option) => [option.key, option.display])]);
    if (tag.select.dataset.signature !== signature) {
      tag.select.replaceChildren(Object.assign(el('option', '', t('All tags')), { value: '' }));
      options.forEach((option) => {
        const element = el('option', '', option.display);
        element.value = option.key;
        tag.select.appendChild(element);
      });
      tag.select.dataset.signature = signature;
    }
    tag.select.value = selected;
    tag.select.disabled = options.length === 0;
  }

  function renderCategories(model) {
    for (const [category, parts] of categoryButtons) {
      parts.button.setAttribute('aria-pressed', String(category === query.kind));
      parts.count.textContent = String(model?.counts?.[category] ?? 0);
    }
    categories.dataset.countScope = model?.countScope ?? 'library';
    if (model?.bounded) categories.setAttribute('aria-label', `${t('Saved categories')} · ${t('Counts cover shown items only.')}`);
  }

  function render() {
    if (disposed) return;
    localizeControls();
    review.select.value = query.review;
    sort.select.value = query.sort;
    mistakesInput.checked = query.mistakesOnly;
    clearButton.disabled = !savedLibraryQueryIsFiltered(query) && !searchInput.value.trim();
    list.setAttribute('aria-label', t('Saved study objects'));
    list.replaceChildren();
    container.dataset.libraryStatus = status;

    if (status !== 'ready') {
      currentView = null;
      hidePreview();
      renderCategories(null);
      renderTagOptions([]);
      boundNote.hidden = true;
      statusLine.textContent = '';
      expandedId = null;
      renderDetail(null);
      list.dataset.libraryState = status;
      if (status === 'error') {
        list.appendChild(el('p', 'home-error-state', t('Saved items could not be loaded.')));
      } else {
        list.appendChild(el('p', 'home-empty-state saved-library-loading', t('Loading your Saved library…')));
      }
      return;
    }

    const model = createSavedLibraryView({ items, loadedCount, limit, query });
    currentView = model;
    renderCategories(model);
    renderTagOptions(model.tagOptions);
    boundNote.hidden = !model.bounded;
    boundNote.replaceChildren();
    if (model.bounded) {
      boundNote.append(
        el('span', '', t('Showing the {count} most recently updated items.', { count: limit })),
        doc.createTextNode(' '),
        el('span', '', t('Counts cover shown items only.')),
      );
    }
    statusLine.textContent = model.status === 'empty' ? ''
      : model.filtered
        ? t('Showing {shown} of {total}', { shown: model.resultCount, total: model.totalCount })
        : t('Showing all {total}', { total: model.totalCount });
    list.dataset.libraryState = model.status;

    if (model.status !== 'results') {
      expandedId = null;
      renderDetail(null);
      if (model.status === 'empty') list.appendChild(libraryEmptyState());
      else if (model.status === 'kind_empty') list.appendChild(kindEmptyState(query.kind));
      else list.appendChild(noResultsState());
      return;
    }
    if (!model.results.some((item) => item.id === expandedId)) expandedId = null;
    model.results.forEach((item) => list.appendChild(createItemElement(item, item.id === expandedId)));
    renderDetail(model.results.find((item) => item.id === expandedId));
  }

  function focusItem(id) {
    if (!id) return;
    [...list.querySelectorAll('[data-saved-select-id]')].find((node) => node.dataset.savedSelectId === id)?.focus();
  }

  function cancelLoadTimer() {
    if (loadTimer !== null) clearTimer(loadTimer);
    loadTimer = null;
  }

  function cancelSearchTimer() {
    if (searchTimer !== null) clearTimer(searchTimer);
    searchTimer = null;
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
    if (disposed || loadInFlight) return;
    const owner = generation;
    const sequence = ++loadSequence;
    const current = () => !disposed && owner === generation && sequence === loadSequence;
    dirty = false;
    loadInFlight = true;
    if (status !== 'ready') {
      status = 'loading';
      if (visible) render();
    }
    let scope = null;
    try {
      scope = (await deps.captureScope?.()) ?? null;
      scope?.assertCurrent();
      if (!current()) return;
      await deps.whenReady?.();
      scope?.assertCurrent();
      if (!current()) return;
      const objects = await deps.savedService.listRecent({ limit });
      scope?.assertCurrent();
      if (!current()) return;
      const mapped = [];
      for (const object of Array.isArray(objects) ? objects : []) {
        try { mapped.push(mapItem(object)); } catch { /* malformed rows stay out of the view, as on Home */ }
      }
      items = mapped;
      loadedCount = Array.isArray(objects) ? objects.length : 0;
      status = 'ready';
    } catch (error) {
      if (!current()) return;
      if (scope && typeof scope.isCurrent === 'function' && !scope.isCurrent()) {
        // Stale owner scope: discard without adopting anything and retry for the current owner.
        dirty = true;
        return;
      }
      items = [];
      loadedCount = 0;
      status = 'error';
      deps.reportError?.(error);
    } finally {
      if (sequence === loadSequence) loadInFlight = false;
      if (current()) {
        if (visible) render();
        if (visible && dirty) scheduleLoad();
      }
    }
  }

  function applyQuery(changes, { resetExpanded = false } = {}) {
    query = createSavedLibraryQuery({ ...query, ...changes });
    if (resetExpanded) expandedId = null;
    hidePreview();
    render();
  }

  function clearQuery() {
    cancelSearchTimer();
    searchInput.value = '';
    query = clearSavedLibraryQuery(query);
    expandedId = null;
    hidePreview();
    render();
    // The activating Clear control is now disabled or removed; keep keyboard focus in the library.
    searchInput.focus();
  }

  function onInput(event) {
    if (event.target !== searchInput) return;
    clearButton.disabled = !savedLibraryQueryIsFiltered(query) && !searchInput.value.trim();
    cancelSearchTimer();
    searchTimer = setTimer(() => {
      searchTimer = null;
      applyQuery({ text: searchInput.value });
    }, debounceMs);
  }

  function onChange(event) {
    if (event.target === review.select) applyQuery({ review: review.select.value });
    else if (event.target === tag.select) applyQuery({ tag: tag.select.value || null });
    else if (event.target === sort.select) applyQuery({ sort: sort.select.value });
    else if (event.target === mistakesInput) applyQuery({ mistakesOnly: mistakesInput.checked });
  }

  function onClick(event) {
    const target = event.target;
    if (target.closest?.('[data-saved-library-clear]')) return clearQuery();
    const navigate = target.closest?.('[data-saved-library-navigate]');
    if (navigate) return deps.navigate?.(navigate.dataset.savedLibraryNavigate);
    const category = target.closest?.('[data-saved-category]');
    if (category) return applyQuery({ kind: category.dataset.savedCategory }, { resetExpanded: true });
    if (target.closest?.('[data-saved-detail-close]')) {
      const previousId = expandedId;
      expandedId = null;
      render();
      return focusItem(previousId);
    }
    const open = target.closest?.('[data-saved-library-open]');
    if (open) return void deps.openItem(open.dataset.savedLibraryOpen, open);
    const selection = target.closest?.('[data-saved-select-id]');
    if (selection) {
      const id = selection.dataset.savedSelectId;
      hidePreview();
      expandedId = expandedId === id ? null : id;
      render();
      return focusItem(id);
    }
    return undefined;
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !visible) return;
    if (hidePreview()) {
      event.preventDefault();
      return;
    }
    if (!expandedId) return;
    const previousId = expandedId;
    expandedId = null;
    render();
    focusItem(previousId);
  }

  function onPreviewEnter(event) {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner && (event.type === 'focusin' || owner !== previewOwner)) showPreview(owner);
  }

  const listeners = [
    [container, 'click', onClick],
    [container, 'input', onInput],
    [container, 'change', onChange],
    [container, 'pointerover', onPreviewEnter],
    [container, 'focusin', onPreviewEnter],
    [container, 'pointerout', handlePreviewExit],
    [container, 'focusout', handlePreviewExit],
    [doc, 'keydown', onKeydown],
    [view, 'resize', hidePreview],
    [view, 'scroll', hidePreview, true],
  ];
  listeners.forEach(([target, type, listener, capture]) => target.addEventListener(type, listener, capture === true));

  function invalidate() {
    if (disposed) return;
    dirty = true;
    if (visible) scheduleLoad();
  }
  // Local saves, annotation edits, archives and imports commit without a window event;
  // the Saved service's post-commit mutation signal marks the library dirty.
  const unsubscribeMutations = typeof deps.savedService.subscribeLocalMutations === 'function'
    ? deps.savedService.subscribeLocalMutations(() => invalidate())
    : null;

  render();

  return Object.freeze({
    schemaVersion: SAVED_LIBRARY_WORKSPACE_SCHEMA_VERSION,
    show() {
      if (disposed) return;
      visible = true;
      if (dirty && !loadInFlight) {
        cancelLoadTimer();
        void load();
        return;
      }
      render();
    },
    hide() {
      if (disposed) return;
      visible = false;
      if (loadTimer !== null) {
        cancelLoadTimer();
        dirty = true;
      }
      hidePreview();
    },
    invalidate,
    ownerChanged() {
      if (disposed) return;
      generation += 1;
      loadSequence += 1;
      loadInFlight = false;
      cancelLoadTimer();
      cancelSearchTimer();
      items = [];
      loadedCount = 0;
      status = 'idle';
      dirty = true;
      query = createSavedLibraryQuery();
      searchInput.value = '';
      expandedId = null;
      hidePreview();
      render();
      if (visible) scheduleLoad();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      loadSequence += 1;
      cancelLoadTimer();
      cancelSearchTimer();
      listeners.forEach(([target, type, listener, capture]) => target.removeEventListener(type, listener, capture === true));
      unsubscribeMutations?.();
      if (previewOwner) hidePreview();
      items = [];
      currentView = null;
      controlsSlot.replaceChildren();
      bodySlot.replaceChildren();
      createdSlots.forEach((node) => node.remove());
      delete container.dataset.libraryStatus;
    },
    getState() {
      return Object.freeze({
        status,
        visible,
        dirty,
        disposed,
        itemCount: items.length,
        loadedCount,
        expandedId,
        query,
        view: currentView,
      });
    },
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineSavedLibrary', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({ schemaVersion: SAVED_LIBRARY_WORKSPACE_SCHEMA_VERSION, mount: mountSavedLibrary }),
    writable: false,
  });
}
