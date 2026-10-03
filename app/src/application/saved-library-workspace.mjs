// SAVED-LIBRARY-001: the Saved destination's own bounded library query, state,
// search/filter/sort and rendering. logic.js only mounts and routes it.
// SAVED-COMPOSITION-002: one toolbar row, dense list rows and a sticky inspector
// beside the list (selection never moves the list). SavedStudyObject v1 remains
// the authority; nothing here is persisted. The only writes are delegated:
// Edit opens the existing transactional editor and Archive calls the Saved service.
import { createHomeSavedItem } from './home-view-model.mjs';
import { createSavedPokerPreview } from './saved-poker-preview.mjs';
import {
  savedItemFactGrid,
  savedItemKindLabelKey,
  savedItemMetaFacts,
  savedItemTitle,
} from './saved-item-presentation.mjs';
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
const REVIEW_STATE_LABELS = Object.freeze({ none: 'None', review_later: 'Review later', resolved: 'Resolved' });
const SORT_LABELS = Object.freeze({ updated: 'Recently updated', created: 'Recently created' });
const ROW_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`Saved library requires ${label}`);
}

export function mountSavedLibrary(container, deps = {}) {
  if (!container?.ownerDocument) throw new TypeError('Saved library requires a mounted container');
  requireFunction(deps.savedService?.listRecent, 'a bounded Saved listRecent query');
  requireFunction(deps.translate, 'a translate function');
  requireFunction(deps.openItem, 'the Saved open controller');

  const doc = container.ownerDocument;
  const view = doc.defaultView;
  const t = (key, parameters) => deps.translate(key, parameters);
  const presentation = deps.presentation ?? {};
  const itemTitle = (item) => (presentation.itemTitle ?? ((value) => savedItemTitle(value, t)))(item);
  const itemFacts = (item) => (presentation.itemFacts ?? ((value) => savedItemMetaFacts(value, t)))(item);
  const recency = (iso) => presentation.recency?.(iso) ?? '';
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
  let confirmingArchiveId = null;
  let archivingId = null;
  let actionMessage = null;
  let previewOwner = null;
  let currentView = null;
  const rowNodes = new Map();

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

  // Toolbar controls are built once so typing and filter focus survive re-rendering.
  const searchLabel = el('label', 'saved-library-search ui-field');
  const searchCaption = el('span', 'sr-only');
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
    const chip = button('saved-library-category ui-chip', undefined, { variant: 'filter', savedCategory: category });
    chip.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true">${CATEGORY_ICONS[category]}</svg>`;
    const label = el('span');
    const count = el('strong', 'ui-chip-count', '0');
    count.dataset.savedCategoryCount = category;
    chip.append(label, count);
    categories.appendChild(chip);
    categoryButtons.set(category, { button: chip, label, count });
  }

  function selectFilter(attribute) {
    const label = el('label', 'saved-library-filter ui-field');
    const caption = el('span', 'sr-only');
    const select = el('select', 'control-select');
    select.dataset[attribute] = '';
    label.append(caption, select);
    return { label, caption, select };
  }
  const review = selectFilter('savedLibraryReview');
  const tag = selectFilter('savedLibraryTag');
  const sort = selectFilter('savedLibrarySort');
  for (const [value] of Object.entries(REVIEW_LABELS)) review.select.appendChild(Object.assign(el('option'), { value }));
  for (const [value] of Object.entries(SORT_LABELS)) sort.select.appendChild(Object.assign(el('option'), { value }));

  // "Mistakes only" is a toggle chip (aria-pressed), not a checkbox.
  const mistakes = button('saved-library-toggle ui-chip', undefined, { variant: 'filter', savedLibraryMistakes: '' });
  const mistakesCaption = el('span');
  mistakes.appendChild(mistakesCaption);

  const clearButton = button('ui-button saved-library-clear', undefined, { variant: 'quiet', size: 'sm', savedLibraryClear: '' });

  const statusLine = el('p', 'saved-library-status');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');

  const filters = el('div', 'saved-library-filters');
  filters.setAttribute('role', 'group');
  filters.append(review.label, tag.label, sort.label, mistakes, clearButton);
  controlsSlot.append(searchLabel, categories, filters, statusLine);

  const boundNote = el('p', 'saved-library-bound-note');
  boundNote.dataset.savedLibraryBound = '';
  const layout = el('div', 'saved-library-layout saved-split');
  const listSurface = el('div', 'saved-list-surface panel');
  const list = el('div', 'saved-list');
  list.dataset.savedLibraryList = '';
  // Column header row, aligned with the row grid (visual only; rows carry their own labels).
  const listHead = el('div', 'saved-list-head');
  listHead.setAttribute('aria-hidden', 'true');
  const headAside = el('span', 'saved-row-aside');
  const headCells = { cards: el('span'), title: el('span'), review: el('span'), time: el('span') };
  headAside.append(headCells.review, headCells.time);
  listHead.append(headCells.cards, headCells.title, headAside);
  const HEAD_KEYS = Object.freeze({ cards: 'Cards', title: 'Title', review: 'Review', time: 'Updated' });
  listSurface.append(listHead, list);
  const detail = el('aside', 'saved-library-detail saved-inspector panel');
  detail.id = 'savedLibraryDetail';
  detail.setAttribute('aria-labelledby', 'savedLibraryDetailTitle');
  detail.hidden = true;
  layout.append(listSurface, detail);
  bodySlot.append(boundNote, layout);

  function localizeControls() {
    searchCaption.textContent = t('Search Saved');
    searchInput.placeholder = t('Search title, note, or tag');
    searchInput.setAttribute('aria-label', t('Search Saved'));
    categories.setAttribute('aria-label', t('Saved categories'));
    for (const [category, parts] of categoryButtons) parts.label.textContent = t(CATEGORY_LABELS[category]);
    review.caption.textContent = t('Review state');
    review.select.setAttribute('aria-label', t('Review state'));
    [...review.select.options].forEach((option) => { option.textContent = t(REVIEW_LABELS[option.value]); });
    tag.caption.textContent = t('Tag');
    tag.select.setAttribute('aria-label', t('Tag'));
    sort.caption.textContent = t('Sort');
    sort.select.setAttribute('aria-label', t('Sort'));
    [...sort.select.options].forEach((option) => { option.textContent = t(SORT_LABELS[option.value]); });
    mistakesCaption.textContent = t('Mistakes only');
    filters.setAttribute('aria-label', t('Library filters'));
    clearButton.textContent = t('Clear');
    clearButton.setAttribute('aria-label', t('Clear search and filters'));
    for (const [key, cell] of Object.entries(headCells)) cell.textContent = t(HEAD_KEYS[key]);
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

  function stateBadges(item, { includeNote = true } = {}) {
    const row = el('span', 'saved-row-states');
    const badge = (key, tone) => {
      const node = el('span', 'ui-badge', t(key));
      if (tone) node.dataset.tone = tone;
      row.appendChild(node);
    };
    if (includeNote && item.hasNote) badge('Note', 'neutral');
    if (item.reviewState === 'review_later') badge('Review later', 'caution');
    if (item.isMistake) badge('Marked as a mistake', 'danger');
    return row;
  }

  function createItemElement(item) {
    const control = button('saved-library-item ui-row', undefined, { savedSelectId: item.id, savedKind: item.kind });
    control.setAttribute('aria-controls', detail.id);
    control.setAttribute('aria-label', `${t('View details')}: ${itemTitle(item)}`);
    const cards = el('span', 'saved-row-cards');
    if (item.kind === 'hand' || item.kind === 'spot') cards.appendChild(createPokerPreview(item, { variant: 'row' }));
    const copy = el('span', 'saved-library-item-copy');
    const identity = el('span', 'saved-row-title ui-row-title');
    const title = el('strong', '', itemTitle(item));
    title.dir = 'auto';
    identity.append(el('span', 'saved-row-kind', t(item.kind === 'hand' ? 'Hand' : item.kind === 'spot' ? 'Spot' : 'Saved item')), title);
    // Facts are separate isolated spans so mixed labels and numbers read correctly in RTL;
    // separators are their own items between them, so they follow the row direction.
    const meta = el('span', 'saved-row-meta ui-row-meta');
    itemFacts(item).forEach((fact, index) => {
      if (index > 0) {
        const separator = el('i', 'saved-fact-separator', '·');
        separator.setAttribute('aria-hidden', 'true');
        meta.appendChild(separator);
      }
      const part = el('span', 'saved-row-fact', fact);
      part.dir = 'auto';
      meta.appendChild(part);
    });
    copy.append(identity, meta);
    // States and time share one end-aligned column, leaving the title room at 1366.
    const aside = el('span', 'saved-row-aside');
    aside.append(stateBadges(item), el('span', 'saved-row-time', recency(item.updatedAt)));
    control.append(cards, copy, aside);
    rowNodes.set(item.id, control);
    return control;
  }

  function itemTruth(item) {
    if (item.kind === 'hand') return 'Canonical Hand · read-only replay';
    if (item.derivation === 'scenario') return 'Scenario study snapshot · no canonical Hand history';
    if (item.kind === 'spot') return 'Decision snapshot · Hand history unavailable';
    return 'This saved object type is unavailable in this Riverline version.';
  }

  function reviewable(item) {
    return item.kind === 'hand' && item.handComplete === true && item.heroDecisionCount > 0;
  }

  function inspectorSection(labelKey, content) {
    const section = el('section', 'saved-inspector-section');
    section.append(el('h3', 'saved-inspector-label', t(labelKey)), content);
    return section;
  }

  function renderEmptyInspector() {
    const empty = el('div', 'saved-inspector-empty');
    empty.dataset.savedInspectorEmpty = '';
    empty.append(
      el('p', '', t('Select a saved item to inspect it.')),
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
    const kind = el('span', 'ui-badge saved-inspector-kind', t(savedItemKindLabelKey(item)));
    kind.dataset.tone = 'neutral';
    const title = el('h2', 'saved-inspector-title', itemTitle(item));
    title.id = 'savedLibraryDetailTitle';
    title.dir = 'auto';
    headCopy.append(kind, title, el('p', 'saved-library-truth', t(itemTruth(item))));
    const close = button('ui-button saved-library-detail-close', t('Close'), { variant: 'quiet', size: 'sm', savedDetailClose: 'true' });
    close.setAttribute('aria-label', t('Close details'));
    head.append(headCopy, close);

    const body = el('div', 'saved-inspector-body');
    if (item.kind === 'hand' || item.kind === 'spot') body.appendChild(createPokerPreview(item, { variant: 'detail' }));
    const facts = el('dl', 'ui-facts saved-inspector-facts');
    (presentation.itemFactGrid?.(item) ?? savedItemFactGrid(item, t, { updated: recency(item.updatedAt) }))
      .forEach((fact) => {
        const row = el('div');
        row.dataset.savedFact = fact.key;
        const value = el('dd', '', fact.value);
        value.dir = 'auto';
        row.append(el('dt', '', fact.label), value);
        facts.appendChild(row);
      });
    body.appendChild(facts);

    const reviewLine = el('p', 'saved-inspector-value');
    reviewLine.dataset.savedReviewState = item.reviewState;
    reviewLine.textContent = t(REVIEW_STATE_LABELS[item.reviewState] ?? 'None');
    const reviewGroup = el('div', 'saved-inspector-inline');
    reviewGroup.append(reviewLine, stateBadges({ ...item, reviewState: 'none' }, { includeNote: false }));
    body.appendChild(inspectorSection('Review state', reviewGroup));

    const note = el('p', item.note ? 'saved-inspector-note' : 'saved-inspector-note saved-inspector-muted', item.note || t('No note yet.'));
    note.dir = 'auto';
    body.appendChild(inspectorSection('Study note', note));

    const tags = el('div', 'saved-inspector-tags');
    if (item.tags.length) {
      item.tags.forEach((value) => {
        const tagElement = el('span', 'ui-chip', value);
        tagElement.dataset.variant = 'tag';
        tagElement.dir = 'auto';
        tags.appendChild(tagElement);
      });
    } else {
      tags.appendChild(el('span', 'saved-inspector-muted', t('No tags')));
    }
    body.appendChild(inspectorSection('Tags', tags));

    const actions = el('div', 'saved-inspector-actions');
    const supported = item.kind === 'hand' || item.kind === 'spot';
    const open = button('ui-button saved-library-open',
      t(item.kind === 'hand' ? 'Open replay' : item.kind === 'spot' ? 'Open spot' : 'Unavailable'),
      { variant: 'primary', savedLibraryOpen: item.id });
    open.disabled = !supported;
    open.setAttribute('aria-label', `${open.textContent}: ${itemTitle(item)}`);
    actions.appendChild(open);
    if (reviewable(item)) {
      actions.appendChild(button('ui-button', t('Review decisions'), { variant: 'secondary', savedLibraryReview: item.id }));
    }
    if (deps.editItem) actions.appendChild(button('ui-button', t('Edit'), { variant: 'quiet', savedLibraryEdit: item.id }));
    if (deps.archiveItem) {
      const archive = button('ui-button saved-inspector-archive', t('Archive'), { variant: 'danger', savedLibraryArchive: item.id });
      archive.dataset.emphasis = 'quiet';
      archive.disabled = archivingId === item.id;
      actions.appendChild(archive);
    }

    detail.append(head, body, actions);
    if (confirmingArchiveId === item.id) {
      const confirmation = el('div', 'saved-inspector-confirm ui-callout');
      confirmation.dataset.tone = 'caution';
      confirmation.dataset.savedArchiveConfirmation = item.id;
      confirmation.setAttribute('role', 'alert');
      const choices = el('div', 'saved-inspector-confirm-actions');
      const confirm = button('ui-button', t('Confirm archive'), { variant: 'danger', size: 'sm', savedArchiveConfirm: item.id });
      confirm.disabled = archivingId === item.id;
      choices.append(confirm, button('ui-button', t('Keep saved item'), { variant: 'quiet', size: 'sm', savedArchiveKeep: item.id }));
      confirmation.append(el('p', '', t('Archive this saved item? It will be removed from active saved items.')), choices);
      detail.appendChild(confirmation);
    }
    if (actionMessage?.id === item.id) {
      const message = el('p', 'home-error-state', t(actionMessage.key));
      message.setAttribute('role', 'alert');
      detail.appendChild(message);
    }
  }

  function libraryEmptyState() {
    const root = el('div', 'home-empty-state saved-empty-state');
    const action = button('ui-button ui-button--primary', t('Analyze a Hand'), { savedLibraryNavigate: 'analyze' });
    root.append(
      el('h3', '', t('Keep a decision worth returning to')),
      el('p', '', t('Choose something you intentionally kept, inspect its stored facts, and reopen it for study.')),
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
    const action = button('ui-button ui-button--secondary', t('Clear search and filters'), { savedLibraryClear: '' });
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

  // Selection changes update row attributes and the inspector only; the list is
  // never rebuilt, so the list does not move and focus stays on the row.
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
  const FOCUS_KEYS = Object.freeze(['savedLibraryOpen', 'savedLibraryReview', 'savedLibraryEdit', 'savedLibraryArchive', 'savedDetailClose', 'savedArchiveConfirm', 'savedArchiveKeep']);
  const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  function captureFocus() {
    const active = doc.activeElement;
    if (!active?.dataset || !container.contains(active)) return null;
    if (active.dataset.savedSelectId !== undefined) return { row: active.dataset.savedSelectId };
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
    review.select.value = query.review;
    sort.select.value = query.sort;
    mistakes.setAttribute('aria-pressed', String(query.mistakesOnly));
    clearButton.disabled = !savedLibraryQueryIsFiltered(query) && !searchInput.value.trim();
    list.setAttribute('aria-label', t('Saved study objects'));
    list.replaceChildren();
    rowNodes.clear();
    container.dataset.libraryStatus = status;

    if (status !== 'ready') {
      currentView = null;
      hidePreview();
      renderCategories(null);
      renderTagOptions([]);
      boundNote.hidden = true;
      statusLine.textContent = '';
      expandedId = null;
      confirmingArchiveId = null;
      renderDetail(null);
      list.dataset.libraryState = status;
      layout.dataset.savedLayout = 'message';
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
    deps.publishContext?.(statusLine.textContent ? [statusLine.textContent] : []);

    if (model.status !== 'results') {
      expandedId = null;
      confirmingArchiveId = null;
      layout.dataset.savedLayout = 'message';
      renderDetail(null);
      if (model.status === 'empty') list.appendChild(libraryEmptyState());
      else if (model.status === 'kind_empty') list.appendChild(kindEmptyState(query.kind));
      else list.appendChild(noResultsState());
      return;
    }
    layout.dataset.savedLayout = 'split';
    syncInspectorBound();
    if (!model.results.some((item) => item.id === expandedId)) expandedId = null;
    if (confirmingArchiveId !== expandedId) confirmingArchiveId = null;
    model.results.forEach((item) => list.appendChild(createItemElement(item)));
    applySelection();
  }

  function rowFor(id) {
    return id ? rowNodes.get(id) ?? null : null;
  }

  function focusItem(id) {
    rowFor(id)?.focus();
  }

  function select(id, { focus = true } = {}) {
    hidePreview();
    if (expandedId !== id) {
      confirmingArchiveId = null;
      actionMessage = null;
    }
    expandedId = id;
    applySelection();
    if (focus) focusItem(id);
  }

  function closeInspector() {
    const previousId = expandedId;
    expandedId = null;
    confirmingArchiveId = null;
    actionMessage = null;
    applySelection();
    focusItem(previousId);
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
  }

  function openPrimary(id, control) {
    return void deps.openItem(id, control, { handReview: 'none' });
  }

  async function archive(id) {
    if (!deps.archiveItem || archivingId) return;
    const owner = generation;
    archivingId = id;
    actionMessage = null;
    applySelection();
    try {
      await deps.archiveItem(id);
      if (owner !== generation) return;
      archivingId = null;
      confirmingArchiveId = null;
      // The archived item leaves the list; focus moves to the neighbouring row.
      const results = currentView?.results ?? [];
      const index = results.findIndex((item) => item.id === id);
      const neighbour = results[index + 1]?.id ?? results[index - 1]?.id ?? null;
      items = items.filter((item) => item.id !== id);
      loadedCount = Math.max(0, loadedCount - 1);
      expandedId = null;
      render();
      if (neighbour && rowFor(neighbour)) focusItem(neighbour);
      else searchInput.focus();
      invalidate();
    } catch (error) {
      if (owner !== generation) return;
      archivingId = null;
      actionMessage = { id, key: 'Archive failed' };
      applySelection();
      deps.reportError?.(error);
    }
  }

  function onClick(event) {
    const target = event.target;
    if (target.closest?.('[data-saved-library-clear]')) return clearQuery();
    if (target.closest?.('[data-saved-library-mistakes]')) return applyQuery({ mistakesOnly: !query.mistakesOnly });
    const navigate = target.closest?.('[data-saved-library-navigate]');
    if (navigate) return deps.navigate?.(navigate.dataset.savedLibraryNavigate);
    const category = target.closest?.('[data-saved-category]');
    if (category) return applyQuery({ kind: category.dataset.savedCategory }, { resetExpanded: true });
    if (target.closest?.('[data-saved-detail-close]')) return closeInspector();
    const open = target.closest?.('[data-saved-library-open]');
    if (open) return openPrimary(open.dataset.savedLibraryOpen, open);
    const reviewAction = target.closest?.('[data-saved-library-review]');
    if (reviewAction) return void deps.openItem(reviewAction.dataset.savedLibraryReview, reviewAction, { handReview: 'open' });
    const edit = target.closest?.('[data-saved-library-edit]');
    if (edit) return void deps.editItem?.(edit.dataset.savedLibraryEdit, edit);
    const archiveAction = target.closest?.('[data-saved-library-archive]');
    if (archiveAction) {
      confirmingArchiveId = archiveAction.dataset.savedLibraryArchive;
      applySelection();
      return detail.querySelector('[data-saved-archive-keep]')?.focus();
    }
    if (target.closest?.('[data-saved-archive-keep]')) {
      confirmingArchiveId = null;
      applySelection();
      return detail.querySelector('[data-saved-library-archive]')?.focus();
    }
    const confirm = target.closest?.('[data-saved-archive-confirm]');
    if (confirm) return void archive(confirm.dataset.savedArchiveConfirm);
    const selection = target.closest?.('[data-saved-select-id]');
    if (selection) return select(selection.dataset.savedSelectId);
    return undefined;
  }

  // Rows: Up/Down/Home/End move the selection, Enter opens the row's item.
  function onRowKeydown(event) {
    const row = event.target?.closest?.('[data-saved-select-id]');
    if (!row || !visible) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = currentView?.results.find((candidate) => candidate.id === row.dataset.savedSelectId);
      if (item && (item.kind === 'hand' || item.kind === 'spot')) openPrimary(item.id, row);
      return;
    }
    if (!ROW_KEYS.has(event.key)) return;
    const results = currentView?.status === 'results' ? currentView.results : [];
    if (!results.length) return;
    event.preventDefault();
    const index = results.findIndex((item) => item.id === row.dataset.savedSelectId);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? results.length - 1
        : Math.min(results.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)));
    select(results[next].id);
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !visible) return;
    // Escape inside another surface (an open editor dialog) belongs to that surface.
    const target = event.target;
    if (target && target !== doc && target !== doc.body && !container.contains(target)) return;
    if (hidePreview()) {
      event.preventDefault();
      return;
    }
    if (confirmingArchiveId) {
      event.preventDefault();
      confirmingArchiveId = null;
      applySelection();
      detail.querySelector('[data-saved-library-archive]')?.focus();
      return;
    }
    if (!expandedId) return;
    event.preventDefault();
    closeInspector();
  }

  function onPreviewEnter(event) {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner && (event.type === 'focusin' || owner !== previewOwner)) showPreview(owner);
  }

  const listeners = [
    [container, 'click', onClick],
    [container, 'input', onInput],
    [container, 'change', onChange],
    [container, 'keydown', onRowKeydown],
    [container, 'pointerover', onPreviewEnter],
    [container, 'focusin', onPreviewEnter],
    [container, 'pointerout', handlePreviewExit],
    [container, 'focusout', handlePreviewExit],
    [doc, 'keydown', onKeydown],
    [view, 'resize', hidePreview],
    [view, 'resize', syncInspectorBound],
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
    // SHELL-001: Home's "Review Mistakes" link opens the library showing only
    // items marked as a mistake (an existing filter; other filters reset).
    showMistakesOnly() {
      if (disposed) return;
      cancelSearchTimer();
      searchInput.value = '';
      query = createSavedLibraryQuery({ mistakesOnly: true });
      expandedId = null;
      hidePreview();
      render();
    },
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
      confirmingArchiveId = null;
      archivingId = null;
      actionMessage = null;
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
      rowNodes.clear();
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
