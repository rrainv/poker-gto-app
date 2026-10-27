// SHELL-002: sidebar variant 4 and its hub screens (P1-01, P1-02).
// The sidebar groups workspaces into Study, Tools and Library; each group's
// label opens a hub screen with one card per workspace. A card shows a
// "continue" line only from facts the app already holds (Home's view model
// and the context lines workspaces already published to the header); the hub
// computes nothing and starts no strategy, Equity or persistence work.

export const SHELL_NAVIGATION_SCHEMA_VERSION = 'shell-navigation/v1';

export const HUB_DESTINATIONS = Object.freeze({
  study: Object.freeze(['training', 'personal-strategy', 'guide']),
  tools: Object.freeze(['hand', 'analyze', 'equity']),
  library: Object.freeze(['saved']),
});

export function isHubDestination(destination) {
  return Object.hasOwn(HUB_DESTINATIONS, destination);
}

export function hubForDestination(destination) {
  return Object.keys(HUB_DESTINATIONS).find((hub) => HUB_DESTINATIONS[hub].includes(destination)) ?? null;
}

const joinFacts = (parts) => (Array.isArray(parts) ? parts.filter((part) => typeof part === 'string' && part.trim()).join(' · ') : '');

/**
 * One line per hub card, or null when the app knows nothing to continue.
 * - Hand: a live in-memory hand (Home's continue item), with the facts the
 *   Hand header already shows.
 * - Personal Strategy: a resumable calibration from Home's view model.
 * - Training, Analyze: the context line those workspaces already published,
 *   only for a workspace the player opened this session (otherwise it is the
 *   default setup, not something to continue).
 * - Saved: the most recent saved item's title from Home's view model.
 * Learn and Equity have no continue state today.
 */
export function resolveHubContinuations({
  homeModel = null,
  headerContext = () => [],
  visited = new Set(),
  translate = (key) => key,
} = {}) {
  const lines = new Map();
  const continueItems = homeModel?.sections?.continue?.items ?? [];

  if (continueItems.some((item) => item?.kind === 'live_hand')) {
    const facts = joinFacts(headerContext('hand'));
    lines.set('hand', facts
      ? translate('Hand in progress · {facts}', { facts })
      : translate('Hand in progress'));
  }

  const calibration = continueItems.find((item) => item?.kind === 'range_calibration');
  if (calibration && Number.isInteger(calibration.answeredCount) && Number.isInteger(calibration.totalCount)) {
    lines.set('personal-strategy', translate('{answered} of {total} directly answered', {
      answered: calibration.answeredCount,
      total: calibration.totalCount,
    }));
  }

  for (const destination of ['training', 'analyze']) {
    if (!visited.has(destination)) continue;
    const facts = joinFacts(headerContext(destination));
    if (facts) lines.set(destination, facts);
  }

  const recent = homeModel?.sections?.recent;
  const latest = recent?.status === 'ready' ? recent.items?.[0] : null;
  if (typeof latest?.title === 'string' && latest.title.trim()) {
    lines.set('saved', translate('Last saved: {title}', { title: latest.title.trim() }));
  }
  return lines;
}

/**
 * Up/Down (and Home/End) move focus between sidebar buttons in visual order.
 * Optional convenience on top of the normal Tab order; focus moves only.
 */
export function nextNavigationIndex(key, index, count) {
  if (count <= 0) return -1;
  switch (key) {
    case 'ArrowDown': return (index + 1) % count;
    case 'ArrowUp': return (index - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return -1;
  }
}

export function createShellNavigation({ document, translate = (key) => key, header = () => null } = {}) {
  let activeHub = null;
  let lastHomeModel = null;
  const visited = new Set();

  const hubList = (hub) => document.querySelector(`#hubMode .hub-card-list[data-hub="${hub}"]`);

  function renderContinuations() {
    if (!activeHub) return;
    const controller = header();
    const lines = resolveHubContinuations({
      homeModel: lastHomeModel,
      headerContext: (destination) => controller?.getContext?.(destination) ?? [],
      visited,
      translate,
    });
    hubList(activeHub)?.querySelectorAll('[data-hub-continue]').forEach((slot) => {
      const line = lines.get(slot.dataset.hubContinue) ?? '';
      // Facts may hold poker tokens and user-named items: one isolated island.
      slot.replaceChildren();
      if (line) {
        const text = document.createElement('bdi');
        text.textContent = line;
        slot.append(text);
      }
      slot.hidden = !line;
    });
  }

  function showHub(hub, { homeModel = lastHomeModel } = {}) {
    if (!isHubDestination(hub)) return false;
    activeHub = hub;
    lastHomeModel = homeModel;
    document.querySelectorAll('#hubMode .hub-card-list[data-hub]').forEach((list) => {
      list.hidden = list.dataset.hub !== hub;
    });
    const mode = document.querySelector('#hubMode');
    if (mode) mode.dataset.hub = hub;
    renderContinuations();
    return true;
  }

  function openDestination(destination) {
    document.querySelector(`.mode-nav-item[data-navigation-id="${destination}"]`)?.click();
  }

  function handleNavigationKeydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const items = [...document.querySelectorAll('.mode-navigation .mode-nav-item')]
      .filter((item) => !item.hidden && !item.disabled);
    const index = items.indexOf(event.target.closest?.('.mode-nav-item'));
    if (index < 0) return;
    const next = nextNavigationIndex(event.key, index, items.length);
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
  }

  function install() {
    const navigation = document.querySelector('.mode-navigation');
    navigation?.addEventListener('keydown', handleNavigationKeydown);
    // Every route (sidebar, hub cards, in-app links) clicks a sidebar button.
    navigation?.addEventListener('click', (event) => {
      const destination = event.target.closest?.('.mode-nav-item[data-navigation-id]')?.dataset.navigationId;
      if (destination) visited.add(destination);
    });
    document.querySelector('#hubMode')?.addEventListener('click', (event) => {
      const card = event.target.closest?.('.hub-card[data-hub-target]');
      if (card) openDestination(card.dataset.hubTarget);
    });
  }

  return Object.freeze({
    schemaVersion: SHELL_NAVIGATION_SCHEMA_VERSION,
    install,
    showHub,
    getActiveHub: () => activeHub,
    refreshLanguage: renderContinuations,
  });
}

if (typeof window !== 'undefined' && window.document) {
  const navigation = createShellNavigation({
    document: window.document,
    translate: (key, parameters) => window.t?.(key, parameters) ?? key,
    header: () => window.RiverlineWorkspaceHeader ?? null,
  });
  if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', navigation.install, { once: true });
  else navigation.install();
  window.addEventListener('riverline:languagechange', () => navigation.refreshLanguage());
  Object.defineProperty(window, 'RiverlineShellNavigation', {
    configurable: true,
    enumerable: false,
    value: navigation,
    writable: false,
  });
}
