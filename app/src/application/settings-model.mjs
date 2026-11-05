// SETTINGS-001: the pure rules of the Settings workspace. No DOM, no storage:
// which rows are visible for a category, a search and the "modified" filter,
// how many rows differ from their default, and how search text is matched.
// The workspace controller feeds it rows and renders the answer.

export const SETTINGS_MODEL_SCHEMA_VERSION = 'settings-model/v1';

export const SETTINGS_CATEGORY_IDS = Object.freeze([
  'appearance',
  'audio',
  'language',
  'help',
  'shortcuts',
  'account',
  'about',
]);
export const DEFAULT_SETTINGS_CATEGORY = 'appearance';

// Categories whose rows are real, changeable preferences. Shortcuts is a list
// and Account & Data holds status and a guarded action; neither has a default
// to compare against, so neither takes part in "modified".
export const PREFERENCE_CATEGORY_IDS = Object.freeze(['appearance', 'audio', 'language', 'help']);

export function normalizeSettingsCategory(value) {
  return SETTINGS_CATEGORY_IDS.includes(value) ? value : DEFAULT_SETTINGS_CATEGORY;
}

/** Lower-cased, trimmed, whitespace-collapsed search text (locale-aware). */
export function normalizeSearchText(value, locale = undefined) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase(locale)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every space-separated word of the query must occur in the row text. */
export function matchesSearch(rowText, query, locale = undefined) {
  const needle = normalizeSearchText(query, locale);
  if (!needle) return true;
  const haystack = normalizeSearchText(rowText, locale);
  return needle.split(' ').every((word) => haystack.includes(word));
}

/**
 * Decide what the stream shows.
 *
 * rows: [{ id, category, text, modified }] (text = label + hint + keywords)
 * - No query and no filter: the active category only, every row of it.
 * - A query or the filter: rows across all categories that match; a category
 *   with no matching row disappears from the stream.
 */
export function resolveSettingsView({
  rows = [],
  category = DEFAULT_SETTINGS_CATEGORY,
  query = '',
  modifiedOnly = false,
  locale = undefined,
} = {}) {
  const active = normalizeSettingsCategory(category);
  const needle = normalizeSearchText(query, locale);
  const searching = needle !== '' || modifiedOnly;
  const modifiedByCategory = Object.fromEntries(SETTINGS_CATEGORY_IDS.map((id) => [id, 0]));
  let modifiedTotal = 0;
  rows.forEach((row) => {
    if (!row.modified) return;
    modifiedByCategory[row.category] = (modifiedByCategory[row.category] ?? 0) + 1;
    modifiedTotal += 1;
  });

  const visibleRowIds = new Set();
  const matchedCategories = new Set();
  rows.forEach((row) => {
    const inScope = searching ? true : row.category === active;
    if (!inScope) return;
    if (modifiedOnly && !row.modified) return;
    if (!matchesSearch(row.text, needle, locale)) return;
    visibleRowIds.add(row.id);
    matchedCategories.add(row.category);
  });

  return Object.freeze({
    schemaVersion: SETTINGS_MODEL_SCHEMA_VERSION,
    view: searching ? 'search' : 'category',
    activeCategory: active,
    visibleRowIds,
    matchedCategories,
    modifiedByCategory: Object.freeze(modifiedByCategory),
    modifiedTotal,
    matchCount: visibleRowIds.size,
    empty: searching && visibleRowIds.size === 0,
  });
}

/**
 * Whether a preference differs from its default. Values are compared as
 * primitives; an adapter that cannot read its current value is "not modified"
 * (unknown is never treated as changed).
 */
export function differsFromDefault(current, defaultValue) {
  if (current === undefined || current === null) return false;
  return current !== defaultValue;
}

/**
 * The adapters that read and restore each row's default. Every dependency is a
 * live controller the app already owns; a missing one just omits its rows, so
 * nothing here invents a setting.
 */
export function createSettingsRowAdapters({
  theme = null,
  cards = null,
  sound = null,
  motion = null,
  language = null,
  answerMode = null,
  defaults = {},
} = {}) {
  const base = {
    theme: 'midnight',
    cards: { fourColor: true, rankStyle: 'poker', faceStyle: 'minimal', backStyle: 'riverline' },
    sound: { enabled: true, masterVolume: 0.72, pokerSoundsEnabled: true, studySoundsEnabled: true },
    language: 'en',
    answerMode: 'select',
    ...defaults,
  };
  const adapters = [];
  const add = (id, category, isModified, reset) => adapters.push(Object.freeze({ id, category, isModified, reset }));

  if (theme?.getTheme && theme?.apply) {
    add('workstation-theme', 'appearance',
      () => differsFromDefault(theme.getTheme(), base.theme),
      () => { theme.apply(base.theme); });
  }
  if (cards?.get && cards?.apply) {
    const cardRow = (id, key) => add(id, 'appearance',
      () => differsFromDefault(cards.get()?.[key], base.cards[key]),
      () => { cards.apply({ [key]: base.cards[key] }); });
    cardRow('card-suit-colors', 'fourColor');
    cardRow('card-rank-style', 'rankStyle');
    cardRow('card-face-style', 'faceStyle');
    cardRow('card-back-style', 'backStyle');
  }
  if (sound?.getPreferences) {
    const soundRow = (id, key, apply) => add(id, 'audio',
      () => {
        const value = sound.getPreferences()?.[key];
        // Volume is stored as a fraction; compare to the nearest percent.
        return key === 'masterVolume'
          ? differsFromDefault(Math.round(value * 100), Math.round(base.sound[key] * 100))
          : differsFromDefault(value, base.sound[key]);
      },
      () => { apply(base.sound[key]); });
    if (sound.setEnabled) soundRow('audio-enabled', 'enabled', (value) => sound.setEnabled(value));
    if (sound.setMasterVolume) soundRow('audio-volume', 'masterVolume', (value) => sound.setMasterVolume(value));
    if (sound.setCategoryEnabled) {
      soundRow('audio-poker', 'pokerSoundsEnabled', (value) => sound.setCategoryEnabled('poker', value));
      soundRow('audio-study', 'studySoundsEnabled', (value) => sound.setCategoryEnabled('study', value));
    }
  }
  if (motion?.getPreference && motion?.apply) {
    // The default is "match this device": no stored choice.
    add('motion', 'audio',
      () => motion.getPreference() != null,
      () => { motion.apply(null); });
  }
  if (language?.get && language?.set) {
    add('language', 'language',
      () => differsFromDefault(language.get(), base.language),
      () => { language.set(base.language); });
  }
  if (answerMode?.get && answerMode?.set) {
    add('training-answer-mode', 'help',
      () => differsFromDefault(answerMode.get(), base.answerMode),
      () => { answerMode.set(base.answerMode); });
  }
  return Object.freeze(adapters);
}
