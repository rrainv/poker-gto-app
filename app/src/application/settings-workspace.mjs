// SETTINGS-001: the Settings workspace. A mounted controller on #settingsMode:
//   mount(container, deps) -> { dispose, refreshLanguage, handleKey, setVisible, ... }
// Three zones: category rail, searchable controls stream, sticky live preview.
// Controls apply instantly through the controllers the app already owns (theme,
// card presentation, sound, motion, language, answer mode); this module adds
// the navigation, search, "modified" markers with per-row reset, the preview
// and the data counts. It stores nothing and computes no poker maths: the
// preview is built from the shared drill components with a labelled sample.
import {
  createActionCard,
  createMixBar,
  createSourceTierLabel,
} from '../ui/drill-components.mjs';
import { countLocalData } from './settings-data-counts.mjs';
import { getHelpLinks } from './legal-notices.mjs';
import {
  DEFAULT_SETTINGS_CATEGORY,
  SETTINGS_CATEGORY_IDS,
  createSettingsRowAdapters,
  normalizeSettingsCategory,
  resolveSettingsView,
} from './settings-model.mjs';

export const SETTINGS_WORKSPACE_SCHEMA_VERSION = 'settings-workspace/v1';

const PANEL_ENTER_MS = 380;
const LANGUAGE_SAMPLE_TEMPLATE = '{first} or {second} · close';
// One card of every suit across the flop and hero, so the four-colour setting shows.
const PREVIEW_FLOP = Object.freeze([['K', 'h'], ['9', 'c'], ['4', 'd']]);
const PREVIEW_HERO = Object.freeze([['Q', 's'], ['J', 's']]);
const PREVIEW_MIX = Object.freeze([
  Object.freeze({ kind: 'aggressive', name: 'Raise', value: 60 }),
  Object.freeze({ kind: 'passive', name: 'Call', value: 30 }),
  Object.freeze({ kind: 'fold', name: 'Fold', value: 10 }),
]);

export function mountSettingsWorkspace(container, deps = {}) {
  if (!container?.querySelector) throw new TypeError('A Settings container is required');
  const doc = container.ownerDocument;
  const translate = deps.translate ?? ((key, values) => interpolate(key, values));
  const setTimer = deps.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
  const clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer));
  const listeners = [];
  const q = (selector) => container.querySelector(selector);
  const qa = (selector) => [...container.querySelectorAll(selector)];

  const workspace = q('#settingsWorkspace');
  const stream = q('#settingsStream');
  const tabList = q('.settings-category-list');
  const glide = q('.settings-category-glide');
  const tabs = qa('.settings-category-tab[data-settings-category]');
  const panels = qa('[data-settings-panel]');
  const searchInput = q('#settingsSearch');
  const modifiedFilter = q('#settingsModifiedFilter');
  const modifiedLabel = q('#settingsModifiedLabel');
  const statusRegion = q('#settingsSearchStatus');
  const emptyState = q('#settingsEmpty');
  const emptyTitle = q('#settingsEmptyTitle');
  const emptyClear = q('#settingsEmptyClear');
  if (!workspace || !stream || tabs.length === 0 || panels.length === 0) {
    throw new Error('Settings markup is incomplete');
  }

  let disposed = false;
  let visible = false;
  let activeCategory = DEFAULT_SETTINGS_CATEGORY;
  let query = '';
  let modifiedOnly = false;
  let adapters = [];
  let enterTimer = null;
  let enteringPanel = null;
  let languageSwapTimer = null;
  let countsSequence = 0;
  let refreshQueued = false;

  const locale = () => deps.locale?.() ?? 'en';
  const listen = (target, type, listener, options) => {
    target?.addEventListener?.(type, listener, options);
    listeners.push([target, type, listener, options]);
  };

  // ── Rows ────────────────────────────────────────────────────────────────
  // A "unit" is anything the search can find: a preference row, a shortcut
  // line, or an Account & Data block.
  const unitSelector = '[data-setting-id], .settings-key-row';
  let units = [];
  function collectUnits() {
    units = qa(unitSelector).map((element, index) => {
      const panel = element.closest('[data-settings-panel]');
      return {
        element,
        id: element.dataset.settingId || `key-${index}`,
        category: panel?.dataset.settingsPanel ?? DEFAULT_SETTINGS_CATEGORY,
        group: element.closest('[data-settings-group]'),
        panel,
      };
    });
  }

  function unitText(unit) {
    if (unit.text === undefined) {
      unit.text = `${unit.element.textContent} ${unit.element.dataset.settingsKeywords ?? ''}`;
    }
    return unit.text;
  }

  function refreshAdapters() {
    adapters = createSettingsRowAdapters({
      theme: deps.theme?.() ?? null,
      cards: deps.cards?.() ?? null,
      sound: deps.sound?.() ?? null,
      motion: deps.motion?.() ?? null,
      language: deps.language ?? null,
      answerMode: deps.answerMode ?? null,
    });
  }

  function adapterFor(id) {
    return adapters.find((adapter) => adapter.id === id) ?? null;
  }

  function modifiedState(unit) {
    const adapter = adapterFor(unit.id);
    if (!adapter) return false;
    try {
      return Boolean(adapter.isModified());
    } catch (error) {
      deps.reportError?.(error);
      return false;
    }
  }

  // ── View: category / search / modified filter ──────────────────────────
  function render({ announce = false } = {}) {
    if (disposed) return;
    const view = resolveSettingsView({
      rows: units.filter((unit) => !unit.element.hidden).map((unit) => ({
        id: unit.id,
        category: unit.category,
        text: unitText(unit),
        modified: modifiedState(unit),
      })),
      category: activeCategory,
      query,
      modifiedOnly,
      locale: locale(),
    });

    // Moment 34: the value bubble rides the thumb (position follows the value).
    const volume = q('#audioMasterVolume');
    if (volume) {
      const fill = Math.min(1, Math.max(0, Number(volume.value) / 100));
      volume.closest('.settings-slider')?.style.setProperty('--settings-fill', String(fill));
    }

    // Markers and per-row reset.
    units.forEach((unit) => {
      const modified = modifiedState(unit);
      if (adapterFor(unit.id)) {
        unit.element.dataset.modified = String(modified);
        const reset = unit.element.querySelector('[data-settings-reset]');
        if (reset) reset.hidden = !modified;
      }
    });

    // Filter and per-category counts.
    const total = view.modifiedTotal;
    if (modifiedOnly && total === 0) {
      modifiedOnly = false;
      render({ announce });
      return;
    }
    workspace.dataset.settingsModifiedCount = String(total);
    if (modifiedFilter) {
      modifiedFilter.disabled = total === 0;
      modifiedFilter.setAttribute('aria-pressed', String(modifiedOnly));
      modifiedFilter.dataset.active = String(modifiedOnly);
    }
    if (modifiedLabel) {
      modifiedLabel.textContent = total === 0
        ? translate('Nothing modified')
        : translate('Modified · {count}', { count: total });
      modifiedLabel.removeAttribute('data-i18n');
    }
    qa('[data-settings-count]').forEach((badge) => {
      const count = view.modifiedByCategory[badge.dataset.settingsCount] ?? 0;
      badge.hidden = count === 0;
      badge.textContent = count === 0 ? '' : String(count);
      badge.setAttribute('aria-label', count === 0 ? '' : translate('Modified · {count}', { count }));
    });

    // Stream.
    workspace.dataset.settingsView = view.view;
    const searching = view.view === 'search';
    panels.forEach((panel) => {
      const category = panel.dataset.settingsPanel;
      const show = searching ? view.matchedCategories.has(category) : category === view.activeCategory;
      panel.hidden = !show;
    });
    units.forEach((unit) => {
      unit.element.dataset.settingsFiltered = String(!view.visibleRowIds.has(unit.id));
    });
    // A search narrows to matching units; a group or panel with none vanishes.
    qa('[data-settings-group]').forEach((group) => {
      const any = units.some((unit) => unit.group === group && view.visibleRowIds.has(unit.id));
      group.dataset.settingsFiltered = String(searching && !any);
    });
    if (!searching) units.forEach((unit) => { unit.element.dataset.settingsFiltered = 'false'; });
    tabs.forEach((tab) => {
      const selected = tab.dataset.settingsCategory === view.activeCategory;
      tab.classList.toggle('active', selected && !searching);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    placeGlide();

    const queryText = query.trim();
    if (emptyState) {
      emptyState.hidden = !view.empty;
      if (view.empty && emptyTitle) {
        emptyTitle.textContent = queryText
          ? translate('No settings match “{query}”.', { query: queryText })
          : translate('Nothing is changed from the defaults.');
      }
    }
    if (announce && statusRegion) {
      statusRegion.textContent = searching
        ? (view.empty
          ? (queryText ? translate('No settings match “{query}”.', { query: queryText }) : translate('Nothing is changed from the defaults.'))
          : translate('{count} settings shown', { count: view.matchCount }))
        : '';
    }
    renderDataCountsIfNeeded(view);
  }

  function scheduleRender() {
    if (refreshQueued || disposed) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      if (!disposed && visible) render();
    });
  }

  // ── Category tabs, glide and panel entrance (moment 32) ────────────────
  function placeGlide() {
    if (!glide) return;
    const target = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true' && tab.classList.contains('active'));
    if (!target) {
      glide.style.opacity = '0';
      return;
    }
    glide.style.opacity = '1';
    glide.style.height = `${target.offsetHeight}px`;
    glide.style.transform = `translateY(${target.offsetTop}px)`;
  }

  function endPanelEntrance() {
    if (enterTimer !== null) clearTimer(enterTimer);
    enterTimer = null;
    if (enteringPanel) enteringPanel.classList.remove('is-entering');
    enteringPanel = null;
    delete stream.dataset.settingsTravel;
  }

  function activate(category, { focus = false, resetScroll = true, clearSearch = true } = {}) {
    const next = normalizeSettingsCategory(category);
    const previous = activeCategory;
    const order = SETTINGS_CATEGORY_IDS;
    if (clearSearch) {
      query = '';
      modifiedOnly = false;
      if (searchInput) searchInput.value = '';
    }
    activeCategory = next;
    workspace.dataset.settingsCategory = next;
    render({ announce: false });
    if (next !== previous || clearSearch) {
      endPanelEntrance();
      const panel = panels.find((entry) => entry.dataset.settingsPanel === next);
      if (panel && visible && next !== previous) {
        stream.dataset.settingsTravel = order.indexOf(next) < order.indexOf(previous) ? 'back' : 'forward';
        panel.classList.add('is-entering');
        enteringPanel = panel;
        // Removed by timeout as well as by animationend (never rely on one).
        enterTimer = setTimer(endPanelEntrance, PANEL_ENTER_MS + 120);
      }
    }
    if (resetScroll && deps.scrollContainer) deps.scrollContainer()?.scrollTo?.({ top: 0, behavior: 'auto' });
    if (focus) tabs.find((tab) => tab.dataset.settingsCategory === next)?.focus({ preventScroll: true });
    if (next === 'account' && visible) void loadCounts();
    return next;
  }

  tabs.forEach((tab, index) => {
    listen(tab, 'click', () => activate(tab.dataset.settingsCategory));
    listen(tab, 'keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex == null) return;
      event.preventDefault();
      activate(tabs[nextIndex].dataset.settingsCategory, { focus: true });
    });
  });

  // ── Search and the modified filter ──────────────────────────────────────
  listen(searchInput, 'input', () => {
    query = searchInput.value;
    render({ announce: true });
  });
  listen(searchInput, 'keydown', (event) => {
    if (event.key !== 'Escape' || !searchInput.value) return;
    event.preventDefault();
    event.stopPropagation();
    query = '';
    searchInput.value = '';
    render({ announce: true });
  });
  listen(modifiedFilter, 'click', () => {
    modifiedOnly = !modifiedOnly;
    render({ announce: true });
  });
  listen(emptyClear, 'click', () => {
    query = '';
    modifiedOnly = false;
    if (searchInput) searchInput.value = '';
    render({ announce: true });
    searchInput?.focus({ preventScroll: true });
  });

  // ── Per-row reset ───────────────────────────────────────────────────────
  listen(container, 'click', (event) => {
    const button = event.target.closest?.('[data-settings-reset]');
    if (!button || !container.contains(button)) return;
    const unit = units.find((entry) => entry.element.contains(button));
    const adapter = unit ? adapterFor(unit.id) : null;
    if (!adapter) return;
    try {
      adapter.reset();
    } catch (error) {
      deps.reportError?.(error);
    }
    render({ announce: false });
    if (statusRegion) statusRegion.textContent = translate('Reset to default');
    // The reset button just hid itself: keep focus on the row's own control.
    const control = unit.element.querySelector(
      'button:not([data-settings-reset]):not([hidden]), input, [href]',
    );
    (control ?? tabs.find((tab) => tab.dataset.settingsCategory === unit.category))?.focus?.({ preventScroll: true });
  });

  // Any instant-apply control may have changed a preference: re-read markers
  // after the control's own handler ran.
  ['click', 'input', 'change'].forEach((type) => listen(container, type, scheduleRender));
  const rootElement = doc.documentElement;
  ['riverline:themechange', 'riverline:motionchange', 'riverline:cardpresentationchange'].forEach((type) => {
    listen(rootElement, type, scheduleRender);
    listen(deps.eventTarget ?? doc.defaultView, type, scheduleRender);
  });

  // ── Theme: built-ins are immutable; "Duplicate & customise" copies one ──
  listen(q('#themeDuplicateAndCustomise'), 'click', () => {
    const theme = deps.theme?.();
    if (!theme?.duplicateTheme) return;
    const copy = theme.duplicateTheme();
    if (copy) theme.beginEdit?.();
    scheduleRender();
  });

  // ── Language cards with a real sample line in each language ────────────
  const languageButtons = qa('[data-language-option]');
  function renderLanguageSamples() {
    const resolve = deps.resolveTranslation;
    languageButtons.forEach((button) => {
      const language = button.dataset.languageOption;
      const sample = button.querySelector('[data-language-sample]');
      if (!sample) return;
      if (!resolve) {
        sample.textContent = '';
        return;
      }
      const template = resolve(LANGUAGE_SAMPLE_TEMPLATE, language)?.value ?? LANGUAGE_SAMPLE_TEMPLATE;
      const first = resolve('Call', language)?.value ?? 'Call';
      const second = resolve('Raise', language)?.value ?? 'Raise';
      sample.textContent = interpolate(template, { first, second });
    });
  }
  function syncLanguageCards() {
    const current = deps.language?.get?.() ?? 'en';
    languageButtons.forEach((button) => {
      const selected = button.dataset.languageOption === current;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('active', selected);
    });
  }
  languageButtons.forEach((button) => {
    listen(button, 'click', () => {
      deps.language?.set?.(button.dataset.languageOption);
      syncLanguageCards();
    });
  });

  // ── Help & guide ────────────────────────────────────────────────────────
  listen(q('#settingsOpenGuide'), 'click', () => deps.openGuide?.());

  // ── About & legal: help links only when the owner has supplied them ────
  const helpLinks = q('#settingsHelpLinks');
  function renderHelpLinks() {
    if (!helpLinks) return;
    const links = (deps.helpLinks ?? getHelpLinks)(locale());
    helpLinks.replaceChildren(...links.map((entry) => {
      const item = doc.createElement('li');
      const anchor = doc.createElement('a');
      anchor.href = entry.href;
      anchor.textContent = entry.name;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      item.append(anchor);
      return item;
    }));
    helpLinks.hidden = links.length === 0;
  }

  // ── Account & Data counts ──────────────────────────────────────────────
  const countsList = q('#settingsDataCounts');
  const countsNote = q('#settingsDataCountsNote');
  let counts = null;
  function renderDataCounts() {
    if (!countsList) return;
    const format = new Intl.NumberFormat(locale());
    qa('[data-count]').forEach((row) => {
      const value = counts?.[row.dataset.count];
      const output = row.querySelector('dd');
      if (!output) return;
      output.textContent = Number.isSafeInteger(value) ? format.format(value) : '—';
      output.dir = 'ltr';
    });
    if (countsNote) {
      const unknown = counts && Object.values(counts).some((value) => value === null);
      countsNote.hidden = !unknown;
      countsNote.textContent = unknown ? translate('Some counts could not be read in this browser.') : '';
    }
  }
  function renderDataCountsIfNeeded(view) {
    if (view.matchedCategories.has('account') && counts === null && visible
      && countsList?.dataset.countsState !== 'loading') void loadCounts();
  }
  async function loadCounts() {
    if (!countsList || disposed) return;
    const sequence = ++countsSequence;
    countsList.dataset.countsState = 'loading';
    try {
      const result = await (deps.loadCounts ?? (() => countLocalData({ indexedDB: doc.defaultView?.indexedDB })))();
      if (disposed || sequence !== countsSequence) return;
      counts = result;
      countsList.dataset.countsState = 'ready';
    } catch (error) {
      if (disposed || sequence !== countsSequence) return;
      counts = Object.freeze({});
      countsList.dataset.countsState = 'error';
      deps.reportError?.(error);
    }
    renderDataCounts();
  }

  // ── Preview, built from the shared drill components ────────────────────
  const previewBoard = q('#settingsPreviewBoard');
  const previewActions = q('#settingsPreviewActions');
  const previewMix = q('#settingsPreviewMix');
  const previewSource = q('#settingsPreviewSource');
  function previewCard(rank, suit) {
    const card = doc.createElement('span');
    card.className = `settings-card-face riverline-card card--known card--suit-${suit}`;
    card.dataset.cardSize = 'picker';
    card.setAttribute('dir', 'ltr');
    const presentation = deps.cards?.();
    const rankStyle = presentation?.get?.()?.rankStyle ?? 'poker';
    if (presentation?.appendCardFaceContents) presentation.appendCardFaceContents(card, { rank, suit, rankStyle });
    else card.textContent = rank;
    card.dataset.previewRank = rank;
    card.dataset.previewSuit = suit;
    return card;
  }
  function previewBack() {
    const back = doc.createElement('span');
    back.className = 'settings-card-back riverline-card-back';
    back.dataset.cardSize = 'picker';
    return back;
  }
  function previewRow(labelKey, cards, className = '') {
    const row = doc.createElement('div');
    row.className = `settings-preview-row ${className}`.trim();
    const label = doc.createElement('span');
    label.className = 'settings-preview-label';
    label.textContent = labelKey;
    const strip = doc.createElement('div');
    strip.className = 'settings-preview-cards';
    strip.append(...cards);
    // The hero row reads cards first, then "You · BTN" below them.
    if (className.includes('settings-preview-hero')) row.append(strip, label);
    else row.append(label, strip);
    return row;
  }
  function renderPreview() {
    if (!previewBoard || !previewActions || !previewMix || !previewSource) return;
    // The flop face up, the turn and river face down; the hero's two cards face up.
    const table = doc.createElement('div');
    table.className = 'settings-preview-table';
    table.append(previewRow(translate('Flop'), [
      ...PREVIEW_FLOP.map(([rank, suit]) => previewCard(rank, suit)),
      previewBack(),
      previewBack(),
    ]));
    previewBoard.replaceChildren(
      table,
      previewRow(translate('You · {position}', { position: 'BTN' }), PREVIEW_HERO.map(([rank, suit]) => previewCard(rank, suit)), 'settings-preview-hero'),
    );

    const keys = { fold: 'F', call: 'C', raise: 'R' };
    previewActions.replaceChildren(
      createActionCard(doc, { type: 'fold', kind: 'fold', name: translate('Fold'), keyLabel: keys.fold }),
      createActionCard(doc, { type: 'call', kind: 'passive', name: translate('Call'), keyLabel: keys.call }),
      createActionCard(doc, { type: 'raise', kind: 'aggressive', name: translate('Raise'), keyLabel: keys.raise }),
    );
    previewActions.querySelectorAll('button').forEach((button) => {
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
    });

    const percent = new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 });
    previewMix.replaceChildren(createMixBar(doc, {
      segments: PREVIEW_MIX.map((segment) => ({
        kind: segment.kind,
        value: segment.value,
        name: translate(segment.name),
        valueText: percent.format(segment.value / 100),
        title: `${translate(segment.name)} ${percent.format(segment.value / 100)}`,
      })),
      ariaLabel: translate('Sample mix'),
    }));
    // The theme's primary and secondary buttons, as the app draws them.
    const buttons = doc.createElement('div');
    buttons.className = 'settings-preview-buttons';
    buttons.append(
      Object.assign(doc.createElement('span'), { className: 'ui-button ui-button--primary settings-preview-button', textContent: translate('Confirm') }),
      Object.assign(doc.createElement('span'), { className: 'ui-button ui-button--secondary settings-preview-button', textContent: translate('Cancel') }),
    );
    previewSource.replaceChildren(
      createSourceTierLabel(doc, {
        text: `${translate('Heuristic baseline')} · ${translate('Estimated')}`,
        tier: 'estimated',
      }),
      buttons,
    );
  }
  listen(deps.eventTarget ?? doc.defaultView, 'riverline:cardpresentationchange', () => {
    if (visible) renderPreview();
  });

  // ── Language change: text crossfade with a short blur bridge (moment 36) ─
  function onLanguageChange() {
    if (disposed) return;
    collectUnits();
    renderLanguageSamples();
    syncLanguageCards();
    renderPreview();
    renderHelpLinks();
    renderDataCounts();
    render();
    if (!visible) return;
    stream.dataset.settingsLanguageSwap = 'true';
    if (languageSwapTimer !== null) clearTimer(languageSwapTimer);
    languageSwapTimer = setTimer(() => {
      delete stream.dataset.settingsLanguageSwap;
      languageSwapTimer = null;
    }, PANEL_ENTER_MS + 120);
  }
  listen(deps.eventTarget ?? doc.defaultView, 'riverline:languagechange', onLanguageChange);

  // ── Keys ────────────────────────────────────────────────────────────────
  // Escape: clear the search first, then leave Settings. Open popovers (the
  // colour picker, a disclosure) keep their own Escape.
  function handleKey(event) {
    if (disposed || !visible || event.defaultPrevented) return false;
    if (event.key !== 'Escape' || event.altKey || event.ctrlKey || event.metaKey) return false;
    const picker = doc.querySelector('#riverlineColorPicker');
    if (picker && !picker.hidden) return false;
    // A running tour and the Help panel own their Escape.
    if (doc.querySelector('[data-tutorial-layer="active"], .tutorial-chooser')) return false;
    const target = event.target;
    if (target && target !== doc && target !== doc.body && target !== doc.documentElement && !container.contains(target)) return false;
    if (searchInput && (query || modifiedOnly)) {
      query = '';
      modifiedOnly = false;
      searchInput.value = '';
      render({ announce: true });
      return true;
    }
    deps.closeSettings?.();
    return true;
  }
  listen(doc, 'keydown', (event) => {
    if (handleKey(event)) event.preventDefault();
  });

  // Resize: the glide is positioned from layout, so re-place it.
  listen(doc.defaultView, 'resize', placeGlide);

  // ── Lifecycle ───────────────────────────────────────────────────────────
  collectUnits();
  refreshAdapters();
  renderLanguageSamples();
  syncLanguageCards();
  renderHelpLinks();
  render();

  const controller = {
    schemaVersion: SETTINGS_WORKSPACE_SCHEMA_VERSION,
    activate,
    getActiveCategory: () => activeCategory,
    getSearch: () => query,
    refreshLanguage: onLanguageChange,
    handleKey,
    /** Re-read the controllers (they may install after this module mounts). */
    refreshAdapters() {
      refreshAdapters();
      render();
    },
    setVisible(isVisible, { category = null } = {}) {
      if (disposed) return;
      visible = Boolean(isVisible);
      container.dataset.settingsVisible = String(visible);
      if (!visible) {
        endPanelEntrance();
        return;
      }
      refreshAdapters();
      collectUnits();
      renderLanguageSamples();
      syncLanguageCards();
      renderPreview();
      query = '';
      modifiedOnly = false;
      if (searchInput) searchInput.value = '';
      activeCategory = normalizeSettingsCategory(category ?? activeCategory);
      workspace.dataset.settingsCategory = activeCategory;
      counts = null;
      render();
      if (activeCategory === 'account') void loadCounts();
      doc.defaultView?.requestAnimationFrame?.(placeGlide);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      endPanelEntrance();
      if (languageSwapTimer !== null) clearTimer(languageSwapTimer);
      countsSequence += 1;
      listeners.splice(0).forEach(([target, type, listener, options]) => {
        target?.removeEventListener?.(type, listener, options);
      });
    },
  };
  return controller;
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (token, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
  ));
}

export { mountSettingsWorkspace as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineSettingsWorkspace', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: SETTINGS_WORKSPACE_SCHEMA_VERSION,
      mount: mountSettingsWorkspace,
    }),
    writable: false,
  });
}
