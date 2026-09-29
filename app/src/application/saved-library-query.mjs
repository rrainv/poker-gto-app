// DOM-free Saved library query: search, filters, sort, counts and view-state
// selection over one already-loaded bounded set of Home saved items. It reads
// no repository and persists nothing; SavedStudyObject v1 remains the authority.
import { normalizeSavedStudyTag } from '../saved-study-objects/domain.mjs';

export const SAVED_LIBRARY_QUERY_SCHEMA_VERSION = 'saved-library-query/v1';
export const SAVED_LIBRARY_VIEW_SCHEMA_VERSION = 'saved-library-view/v1';
export const SAVED_LIBRARY_LIMIT = 200;
export const SAVED_LIBRARY_KINDS = Object.freeze(['all', 'hands', 'spots']);
export const SAVED_LIBRARY_REVIEW_FILTERS = Object.freeze(['any', 'review_later', 'resolved']);
export const SAVED_LIBRARY_SORTS = Object.freeze(['updated', 'created']);

const FIELD_SEPARATOR = '\u0001';
const searchTextCache = new WeakMap();

export function normalizeSavedLibrarySearchText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ё/gu, 'е')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function savedLibrarySearchTokens(value) {
  const normalized = normalizeSavedLibrarySearchText(value);
  return normalized ? normalized.split(' ') : [];
}

export function savedLibraryTagKey(tag) {
  try {
    return normalizeSavedStudyTag(tag).key;
  } catch {
    return null;
  }
}

export function createSavedLibraryQuery({
  text = '',
  kind = 'all',
  review = 'any',
  mistakesOnly = false,
  tag = null,
  sort = 'updated',
} = {}) {
  return Object.freeze({
    schemaVersion: SAVED_LIBRARY_QUERY_SCHEMA_VERSION,
    text: typeof text === 'string' ? text : '',
    kind: SAVED_LIBRARY_KINDS.includes(kind) ? kind : 'all',
    review: SAVED_LIBRARY_REVIEW_FILTERS.includes(review) ? review : 'any',
    mistakesOnly: mistakesOnly === true,
    tag: typeof tag === 'string' && tag ? tag : null,
    sort: SAVED_LIBRARY_SORTS.includes(sort) ? sort : 'updated',
  });
}

export function clearSavedLibraryQuery(query) {
  return createSavedLibraryQuery({ sort: query?.sort });
}

export function savedLibraryQueryHasNonKindFilters(query) {
  return savedLibrarySearchTokens(query?.text).length > 0
    || (query?.review ?? 'any') !== 'any'
    || query?.mistakesOnly === true
    || Boolean(query?.tag);
}

export function savedLibraryQueryIsFiltered(query) {
  return savedLibraryQueryHasNonKindFilters(query) || (query?.kind ?? 'all') !== 'all';
}

function itemSearchText(item) {
  if (searchTextCache.has(item)) return searchTextCache.get(item);
  const text = [item.title, item.note, ...(Array.isArray(item.tags) ? item.tags : [])]
    .filter((value) => typeof value === 'string' && value)
    .map(normalizeSavedLibrarySearchText)
    .join(FIELD_SEPARATOR);
  if (item && typeof item === 'object') searchTextCache.set(item, text);
  return text;
}

export function savedLibraryItemMatchesSearch(item, tokens) {
  if (!tokens.length) return true;
  const text = itemSearchText(item);
  return tokens.every((token) => text.includes(token));
}

function itemTagKeys(item) {
  return (Array.isArray(item.tags) ? item.tags : []).map(savedLibraryTagKey).filter(Boolean);
}

function matchesKind(item, kind) {
  if (kind === 'hands') return item.kind === 'hand';
  if (kind === 'spots') return item.kind === 'spot';
  return true;
}

export function filterSavedLibraryItems(items, query) {
  const normalized = createSavedLibraryQuery(query);
  const tokens = savedLibrarySearchTokens(normalized.text);
  return (Array.isArray(items) ? items : []).filter((item) => matchesKind(item, normalized.kind)
    && (normalized.review === 'any' || item.reviewState === normalized.review)
    && (!normalized.mistakesOnly || item.isMistake === true)
    && (!normalized.tag || itemTagKeys(item).includes(normalized.tag))
    && savedLibraryItemMatchesSearch(item, tokens));
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortSavedLibraryItems(items, sort = 'updated') {
  const field = sort === 'created' ? 'createdAt' : 'updatedAt';
  const secondary = field === 'createdAt' ? 'updatedAt' : 'createdAt';
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => (
    timestamp(right[field]) - timestamp(left[field])
    || timestamp(right[secondary]) - timestamp(left[secondary])
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function savedLibraryKindCounts(items) {
  const source = Array.isArray(items) ? items : [];
  return Object.freeze({
    all: source.length,
    hands: source.filter((item) => item.kind === 'hand').length,
    spots: source.filter((item) => item.kind === 'spot').length,
  });
}

export function savedLibraryTagOptions(items, selectedTag = null) {
  const options = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    for (const display of Array.isArray(item.tags) ? item.tags : []) {
      const key = savedLibraryTagKey(display);
      if (!key) continue;
      const option = options.get(key) ?? { key, display, count: 0 };
      option.count += 1;
      options.set(key, option);
    }
  }
  if (selectedTag && !options.has(selectedTag)) {
    options.set(selectedTag, { key: selectedTag, display: selectedTag, count: 0 });
  }
  return Object.freeze([...options.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((option) => Object.freeze(option)));
}

export function createSavedLibraryView({
  items = [],
  loadedCount = Array.isArray(items) ? items.length : 0,
  limit = SAVED_LIBRARY_LIMIT,
  query = createSavedLibraryQuery(),
} = {}) {
  const source = Array.isArray(items) ? items : [];
  const normalized = createSavedLibraryQuery(query);
  const bounded = Number.isInteger(loadedCount) && loadedCount >= limit;
  const results = sortSavedLibraryItems(filterSavedLibraryItems(source, normalized), normalized.sort);
  let status = 'results';
  if (!source.length) status = 'empty';
  else if (!results.length) {
    status = normalized.kind !== 'all' && !savedLibraryQueryHasNonKindFilters(normalized)
      ? 'kind_empty'
      : 'no_results';
  }
  return Object.freeze({
    schemaVersion: SAVED_LIBRARY_VIEW_SCHEMA_VERSION,
    status,
    bounded,
    limit,
    countScope: bounded ? 'shown' : 'library',
    counts: savedLibraryKindCounts(source),
    totalCount: source.length,
    resultCount: results.length,
    results: Object.freeze(results),
    tagOptions: savedLibraryTagOptions(source, normalized.tag),
    filtered: savedLibraryQueryIsFiltered(normalized),
    query: normalized,
  });
}
