// EXTRACT-HOME-001: the Home workspace (HOME-001 / HOME-002A), moved out of
// core/logic.js as a mounted controller. Rendering of the account/guest
// panels, Continue, Review, Recent and the Review Mistakes link, the Home vs
// Saved destination presentation, the refresh sequence and 80 ms coalescing
// timer, and Home's delegated clicks all live here. Home does no poker maths
// and owns no Saved, Hand or Analyze state: it renders the view model
// window.RiverlineHome loads (home-workspace-bootstrap.mjs) and hands actions
// back to logic.js through injected callbacks.
//
// mount(container, deps) returns { dispose, refreshLanguage, handleKey,
// setVisible } plus the hooks logic.js calls: refresh, schedule, render,
// applyDestination, ownerChanged and getModel.
//
// Owner fences (unchanged from logic.js): every load carries a sequence
// number; ownerChanged(), a newer refresh and dispose() bump it, and a load
// that resolves with an old number, or after Home stopped being the active
// workspace, is dropped. schedule({ clearPrivateState }) clears private Home
// content at once (through deps.clearOwnerPresentation) before the delayed
// load. Each load goes through deps.load(), which reads window.RiverlineHome
// at call time (logic.js callHomeBridge).
//
// deps (all injected, never the whole window.app):
//   translate(key, values)      UI translation
//   locale()                    current UI language ('en', 'ru', 'he')
//   load()                      Promise of the Home view model (window.RiverlineHome.load)
//   activeMode(), activeDestination()   shell lookups ('home', 'saved', ...)
//   welcomeVisible()            true while the first-use welcome orientation shows
//   header()                    window.RiverlineWorkspaceHeader, or undefined
//   tutorials()                 window.RiverlineTutorials, or undefined
//   navigate(destination)       product navigation
//   showSavedMistakes()         Saved with the mistakes filter
//   returnToLiveHand()          back to the in-memory Hand
//   openAccount()               account panel (sync issue review)
//   openSavedItem(id, control)  Saved-open orchestration (stays in logic.js)
//   syncSavedLibraryVisibility()  Saved library show/hide for the destination
//   clearOwnerPresentation()    logic.js owner-change reset (calls ownerChanged())
//   reportError(error)          console report for a failed load
//   setTimer(fn, ms), clearTimer(id)    optional; default to the global timers
import { savedItemRecency, savedItemTitle } from './saved-item-presentation.mjs';

export const HOME_WORKSPACE_SCHEMA_VERSION = 'home-workspace-controller/v1';
export const HOME_REFRESH_DELAY_MS = 80;

export function resolveHomeDestinationPresentation(destination, {
  sessionMode = 'account',
  hasContinuation = false,
} = {}) {
  const normalizedDestination = destination === 'saved' ? 'saved' : 'home';
  const guest = sessionMode === 'guest';
  const visibleSections = normalizedDestination === 'saved'
    ? ['library']
    : guest
      ? ['guest', 'continue', 'review', 'recent']
      : ['overview', 'continue', 'review', 'recent'];
  return Object.freeze({
    destination: normalizedDestination,
    visibleSections: Object.freeze(visibleSections),
    guestCopy: normalizedDestination === 'saved'
      ? Object.freeze({
        eyebrow: 'Saved study',
        title: 'Saved Hands & Spots',
        primary: 'Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode. Guest data does not sync.',
        secondary: 'Signing in does not enable sync or cloud backup.',
      })
      : Object.freeze({
        eyebrow: 'Guest Mode',
        title: 'Riverline is ready to use',
        primary: 'Analyze hands, train decisions, and calculate Equity without an account.',
        secondary: 'Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode. Guest data does not sync.',
      }),
  });
}

export function homeSyncCopy(sync) {
  if (sync?.status === 'error') return ['Sync issue', 'Study data remains available on this device.'];
  if (!sync || sync.status === 'unavailable') return ['Saved on this device', 'Cloud study sync is unavailable.'];
  if (sync.state === 'conflict') return ['Conflict needs attention', '{count} conflicts need review.'];
  if (sync.state === 'error') return ['Sync issue', 'Study data remains available on this device.'];
  if (sync.state === 'syncing') return ['Syncing', 'Updating your enabled study domains.'];
  if (sync.state === 'offline') {
    return sync.pendingCount > 0
      ? ['Offline', '{count} changes waiting. They will sync when Riverline is online.']
      : ['Offline', 'Study data remains available on this device.'];
  }
  if (sync.state === 'synced') return ['Synced', 'Enabled study data is up to date.'];
  if (sync.state === 'auth_paused') return ['Sync paused', 'Sign in again to continue study sync.'];
  return ['Saved on this device', 'Cloud study sync is not enabled.'];
}

export function homeSavedItemFacts(item, translate, locale = 'en') {
  const t = translate;
  const facts = [];
  if (Number.isInteger(item.tableSize)) facts.push(t('{count}-handed', { count: item.tableSize }));
  if (item.heroPosition) facts.push(item.heroPosition);
  if (item.street) facts.push(t(item.street[0].toUpperCase() + item.street.slice(1)));
  if (Number.isFinite(item.stackBb)) facts.push(`${item.stackBb} bb`);
  if (Number.isFinite(item.potBb)) facts.push(`${t('Pot')} ${item.potBb} bb`);
  if (item.kind === 'spot') {
    facts.push(item.derivation === 'scenario' ? t('Scenario') : t('Hand-derived'));
  }
  const recency = savedItemRecency(item.updatedAt, locale);
  if (recency) facts.push(`${t('Updated')} ${recency}`);
  return facts;
}

// The fallback a failed load renders: Continue empty, every list in error.
const LOAD_FAILURE_MODEL = Object.freeze({
  sections: Object.freeze({
    continue: Object.freeze({ status: 'ready', items: Object.freeze([]) }),
    recent: Object.freeze({ status: 'error' }),
    review: Object.freeze({ reviewLater: Object.freeze({ status: 'error' }), mistakes: Object.freeze({ status: 'error' }) }),
    personalStrategy: Object.freeze({ status: 'error' }),
  }),
});

export function mountHomeWorkspace(container, deps) {
  const document = container.ownerDocument;
  const byId = (id) => document.getElementById(id);
  const t = (key, values) => deps.translate(key, values);
  const setTimer = deps.setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => globalThis.clearTimeout(id));

  let model = null;
  let refreshSequence = 0;
  let refreshTimer = null;
  let disposed = false;

  function setTranslated(element, key) {
    if (!element) return;
    element.dataset.i18n = key;
    element.textContent = t(key);
  }

  function applyDestination(destination = deps.activeDestination()) {
    const content = byId('homeWorkspaceContent');
    const state = resolveHomeDestinationPresentation(destination, {
      sessionMode: content?.dataset.sessionMode || model?.sessionMode || 'account',
      hasContinuation: content?.dataset.hasContinuation === 'true',
    });
    container.dataset.productDestination = state.destination;
    const labelKey = state.destination === 'saved' ? 'Saved study' : 'Home dashboard';
    container.dataset.i18nAriaLabel = labelKey;
    container.setAttribute('aria-label', t(labelKey));
    if (content) content.dataset.productDestination = state.destination;

    const sections = {
      overview: byId('homeAccountOverview'),
      guest: byId('homeGuestAccount'),
      continue: byId('homeContinueContent')?.closest('.home-section'),
      review: byId('homeReviewContent')?.closest('.home-section'),
      recent: byId('homeRecentContent')?.closest('.home-section'),
      library: byId('savedLibrarySection'),
    };
    const visible = new Set(state.visibleSections);
    Object.entries(sections).forEach(([key, section]) => {
      if (section) section.hidden = !visible.has(key);
    });
    // Study Inbox is Home's lazy disclosure; it does not belong to the Saved library.
    const studyInbox = byId('studyInboxPanel');
    if (studyInbox) studyInbox.hidden = state.destination === 'saved';
    deps.syncSavedLibraryVisibility();

    setTranslated(byId('homeGuestAccountEyebrow'), state.guestCopy.eyebrow);
    setTranslated(byId('homeGuestAccountTitle'), state.guestCopy.title);
    setTranslated(byId('homeGuestAccountPrimary'), state.guestCopy.primary);
    setTranslated(byId('homeGuestAccountSecondary'), state.guestCopy.secondary);
    return state;
  }

  function emptyState(messageKey, error = false) {
    const message = document.createElement('p');
    message.className = error ? 'home-error-state' : 'home-empty-state';
    message.textContent = t(messageKey);
    return message;
  }

  function emptyAction(messageKey, actionKey, destination, { primary = false } = {}) {
    const root = document.createElement('div');
    root.className = 'home-empty-state';
    const message = document.createElement('p');
    message.textContent = t(messageKey);
    const action = document.createElement('button');
    action.type = 'button';
    action.className = `ui-button ${primary ? 'ui-button--primary' : 'ui-button--quiet'}`;
    action.dataset.homeDestination = destination;
    action.textContent = t(actionKey);
    root.append(message, action);
    return root;
  }

  function createSavedItemElement(item, { compact = false } = {}) {
    const itemTitle = savedItemTitle(item, t);
    const row = document.createElement('article');
    row.className = 'home-saved-item';
    const main = document.createElement('div');
    main.className = 'home-saved-item-main';
    const titleRow = document.createElement('div');
    titleRow.className = 'home-saved-item-title-row';
    const kind = document.createElement('span');
    kind.className = 'home-saved-item-kind';
    kind.textContent = t(item.kind === 'hand' ? 'Saved Hand' : 'Saved Spot');
    const title = document.createElement('strong');
    title.dir = 'auto';
    title.textContent = itemTitle;
    titleRow.append(kind, title);
    main.appendChild(titleRow);

    const meta = document.createElement('div');
    meta.className = 'home-saved-item-meta poker-data-token';
    meta.dir = 'ltr';
    homeSavedItemFacts(item, t, deps.locale()).forEach((fact) => {
      const token = document.createElement('span');
      token.textContent = fact;
      meta.appendChild(token);
    });
    main.appendChild(meta);

    const badges = document.createElement('div');
    badges.className = 'home-saved-item-badges';
    if (item.hasNote) {
      const note = document.createElement('span');
      note.className = 'home-saved-badge';
      note.textContent = t('Note');
      badges.appendChild(note);
    }
    if (item.reviewState === 'review_later') {
      const review = document.createElement('span');
      review.className = 'home-saved-badge home-saved-badge--review';
      review.textContent = t('Review later');
      badges.appendChild(review);
    }
    if (item.isMistake) {
      const mistake = document.createElement('span');
      mistake.className = 'home-saved-badge home-saved-badge--mistake';
      mistake.textContent = t('Marked as a mistake');
      badges.appendChild(mistake);
    }
    if (item.tags.length > 0) {
      const tags = document.createElement('span');
      tags.className = 'home-saved-badge';
      tags.dir = 'auto';
      tags.textContent = item.tags.slice(0, 2).join(' · ');
      badges.appendChild(tags);
    }
    if (badges.childElementCount > 0) main.appendChild(badges);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = `ui-button ${compact ? 'ui-button--quiet' : 'ui-button--secondary'} home-open-button`;
    open.dataset.homeSavedId = item.id;
    const action = t(item.kind === 'hand' ? 'Open replay' : 'Open spot');
    open.textContent = action;
    open.setAttribute('aria-label', `${action}: ${itemTitle}`);
    row.append(main, open);
    return row;
  }

  function renderContinue(section) {
    const root = byId('homeContinueContent');
    if (!root) return;
    root.replaceChildren();
    const hasContinuation = Boolean(section?.items?.length);
    setTranslated(byId('homeContinueEyebrow'), hasContinuation ? 'Pick up where you left off' : 'Your next action');
    setTranslated(byId('homeContinueTitle'), hasContinuation ? 'Continue' : 'Start study');
    if (!section?.items?.length) {
      root.appendChild(emptyAction('Play or reconstruct a legal hand.', 'Start a Hand', 'hand', { primary: true }));
      return;
    }
    const list = document.createElement('div');
    list.className = 'home-continue-list';
    section.items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = item.kind === 'live_hand'
        ? 'home-calibration-card home-live-hand-card'
        : 'home-calibration-card';
      const title = document.createElement('strong');
      title.textContent = t(item.kind === 'live_hand' ? 'Live Hand' : 'Personal Strategy');
      const context = document.createElement('p');
      context.dir = 'auto';
      if (item.kind === 'live_hand') {
        context.textContent = t('Your current in-memory hand is ready to continue.');
      } else {
        const facts = [item.profileName, item.modeName];
        if (Number.isInteger(item.context?.tableSize)) {
          facts.push(t('{count}-handed', { count: item.context.tableSize }));
        }
        context.textContent = facts.join(' · ');
      }
      const progress = document.createElement('p');
      if (item.kind === 'range_calibration') {
        progress.textContent = t('{answered} of {total} directly answered', {
          answered: item.answeredCount, total: item.totalCount,
        });
      }
      const actions = document.createElement('div');
      actions.className = 'home-calibration-actions';
      const resume = document.createElement('button');
      resume.type = 'button';
      // One accent action per view: only the first continuation is primary.
      resume.className = `ui-button ${index === 0 ? 'ui-button--primary' : 'ui-button--secondary'}`;
      if (item.kind === 'live_hand') resume.dataset.homeAction = 'return-live-hand';
      else resume.dataset.homeDestination = 'personal-strategy';
      resume.textContent = t(item.kind === 'live_hand' ? 'Return to live hand' : 'Resume calibration');
      actions.appendChild(resume);
      card.append(title, context);
      if (progress.textContent) card.appendChild(progress);
      card.appendChild(actions);
      list.appendChild(card);
    });
    root.appendChild(list);
  }

  function renderRecent(section) {
    const root = byId('homeRecentContent');
    if (!root) return;
    root.replaceChildren();
    if (section?.status === 'error') {
      root.appendChild(emptyState('Saved items could not be loaded.', true));
      return;
    }
    if (!section?.items?.length) {
      root.appendChild(emptyAction('No saved study yet.', 'Analyze a Hand', 'analyze'));
      return;
    }
    section.items.forEach((item) => root.appendChild(createSavedItemElement(item)));
  }

  function renderReviewGroup(root, titleKey, section, emptyKey) {
    const group = document.createElement('section');
    group.className = 'home-review-group';
    const heading = document.createElement('h3');
    heading.textContent = t(titleKey);
    const list = document.createElement('div');
    list.className = 'home-review-list';
    if (section?.status === 'error') list.appendChild(emptyState('Saved items could not be loaded.', true));
    else if (!section?.items?.length) list.appendChild(emptyState(emptyKey));
    else section.items.forEach((item) => list.appendChild(createSavedItemElement(item, { compact: true })));
    group.append(heading, list);
    root.appendChild(group);
  }

  function renderReview(section) {
    const root = byId('homeReviewContent');
    if (!root) return;
    root.replaceChildren();
    renderReviewGroup(root, 'Review later', section?.reviewLater, 'Nothing marked for review.');
    renderReviewGroup(root, 'Marked as a mistake', section?.mistakes, 'No mistakes marked.');
  }

  function renderAccountOverview(next) {
    const overview = byId('homeAccountOverview');
    if (!overview) return;
    const guest = next.sessionMode === 'guest';
    overview.hidden = guest;
    if (guest) return;
    const profile = next.identity?.profile;
    const displayName = byId('homeIdentityDisplayName');
    const username = byId('homeIdentityUsername');
    displayName.textContent = profile?.displayName || t('Riverline player');
    username.textContent = profile?.username ? `@${profile.username}` : '';
    username.hidden = !profile?.username;
    const syncRoot = byId('homeSyncStatus');
    const [labelKey, detailKey] = homeSyncCopy(next.sync);
    syncRoot.dataset.state = next.sync?.state || 'unavailable';
    byId('homeSyncStatusLabel').textContent = t(labelKey);
    byId('homeSyncStatusDetail').textContent = t(detailKey, {
      count: next.sync?.conflictCount || next.sync?.pendingCount || 0,
    });
    byId('homeSyncReview').hidden = !['conflict', 'error'].includes(next.sync?.state);
  }

  // SHELL-001: Home's Destinations panel was removed (its links duplicated the
  // sidebar). "Review Mistakes" survives as a link in the Review section header,
  // shown under the same rule as before (at least one marked mistake).
  function renderReviewMistakesLink(next) {
    const link = byId('homeReviewMistakesLink');
    if (!link) return;
    link.hidden = !(next.sections.quickStart?.destinations || []).includes('review_mistakes');
  }

  function render(next) {
    model = next;
    const guest = next.sessionMode === 'guest';
    const restricted = [
      byId('homeReviewContent')?.closest('.home-section'),
      byId('homeRecentContent')?.closest('.home-section'),
    ];
    restricted.forEach((section) => { if (section) section.hidden = false; });
    const guestAccount = byId('homeGuestAccount');
    if (guestAccount) guestAccount.hidden = !guest;
    // The Home tour's first step explains the session panel that is shown.
    const overviewPanels = [guestAccount, byId('homeAccountOverview')];
    overviewPanels.forEach((panel) => panel?.removeAttribute('data-tutorial-anchor'));
    overviewPanels[guest ? 0 : 1]?.setAttribute('data-tutorial-anchor', 'home-overview');
    renderAccountOverview(next);
    // The Home description lives in Help; the header context names the session.
    deps.header()?.setDescription('home', guest
      ? 'Your learning workspace is saved on this device.'
      : 'Your saved study, review queue, and next useful action.');
    deps.header()?.setContext('home', guest
      ? [t('Guest Mode')]
      : [next.identity?.profile?.displayName || t('Riverline player'), t(homeSyncCopy(next.sync)[0])]);
    // SHELL-002: the header chip names the selected Game and Approach that
    // Home's view model already loaded (nothing extra is read).
    const personalStrategy = next.sections.personalStrategy;
    if (personalStrategy?.status === 'ready' && personalStrategy.selectedProfile) {
      deps.header()?.setPlayContext?.({
        game: personalStrategy.selectedProfile.displayName,
        approach: personalStrategy.selectedMode?.displayName || '',
      });
    }
    renderReviewMistakesLink(next);
    renderContinue(next.sections.continue);
    renderRecent(next.sections.recent);
    renderReview(next.sections.review);
    const workspace = byId('homeWorkspace');
    const loading = byId('homeLoadingState');
    const content = byId('homeWorkspaceContent');
    if (content) content.dataset.sessionMode = guest ? 'guest' : 'account';
    if (content) content.dataset.hasContinuation = String(Boolean(next.sections.continue?.items?.length));
    if (workspace) workspace.setAttribute('aria-busy', 'false');
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
    applyDestination();
    const tutorialWorkspace = deps.activeDestination() === 'saved' ? 'saved' : 'home';
    deps.tutorials()?.offerForWorkspace?.(tutorialWorkspace, workspace);
  }

  function beginLoading() {
    const workspace = byId('homeWorkspace');
    const loading = byId('homeLoadingState');
    const content = byId('homeWorkspaceContent');
    if (workspace) workspace.setAttribute('aria-busy', 'true');
    if (loading) loading.hidden = false;
    if (content) content.hidden = true;
  }

  // The Home part of logic.js's owner-change reset (clearSavedOwnerPresentation):
  // in-flight loads become stale and private content leaves the DOM.
  function ownerChanged() {
    ++refreshSequence;
    model = null;
    byId('homeWorkspaceContent')?.setAttribute('hidden', '');
    byId('homeReviewContent')?.replaceChildren();
    byId('homeContinueContent')?.replaceChildren();
    byId('homeRecentContent')?.replaceChildren();
  }

  async function refresh({ preserveVisible = false } = {}) {
    if (disposed || deps.welcomeVisible()) return;
    const sequence = ++refreshSequence;
    if (!preserveVisible || !model) beginLoading();
    try {
      const next = await deps.load();
      if (sequence !== refreshSequence || deps.activeMode() !== 'home') return;
      render(next);
    } catch (error) {
      if (sequence !== refreshSequence) return;
      deps.reportError(error);
      render(LOAD_FAILURE_MODEL);
    }
  }

  function schedule({ clearPrivateState = false } = {}) {
    model = null;
    if (clearPrivateState) deps.clearOwnerPresentation();
    if (refreshTimer !== null) {
      clearTimer(refreshTimer);
      refreshTimer = null;
    }
    if (disposed || deps.activeMode() !== 'home' || deps.welcomeVisible()) return;
    if (clearPrivateState) beginLoading();
    refreshTimer = setTimer(() => {
      refreshTimer = null;
      void refresh();
    }, HOME_REFRESH_DELAY_MS);
  }

  function onClick(event) {
    const target = event.target;
    if (!target?.closest) return;
    const destinationControl = target.closest('[data-home-destination]');
    if (destinationControl) {
      const destination = destinationControl.dataset.homeDestination;
      // The link sits in the Review section header, so it opens every
      // marked mistake in Saved rather than scrolling to itself.
      if (destination === 'review_mistakes') deps.showSavedMistakes();
      else deps.navigate(destination);
      return;
    }
    const action = target.closest('[data-home-action]');
    if (action?.dataset.homeAction === 'return-live-hand') {
      void deps.returnToLiveHand();
      return;
    }
    if (action?.dataset.homeAction === 'review-sync') {
      deps.openAccount();
      return;
    }
    const savedItem = target.closest('[data-home-saved-id]');
    if (savedItem) void deps.openSavedItem(savedItem.dataset.homeSavedId, savedItem);
  }
  container.addEventListener('click', onClick);

  return {
    schemaVersion: HOME_WORKSPACE_SCHEMA_VERSION,
    refresh,
    schedule,
    render,
    applyDestination,
    ownerChanged,
    getModel: () => model,
    // Re-render the last model in the current language (no new load). The card
    // presentation refresh uses the same path.
    refreshLanguage() {
      if (!disposed && deps.activeMode() === 'home' && model) render(model);
    },
    // Home has no keys of its own (native buttons and a native <details>).
    handleKey: () => false,
    // Shown: apply the destination and reload, keeping the last model on screen
    // while the load runs. Hidden: nothing to do; a load that resolves while
    // Home is hidden is dropped by refresh().
    setVisible(visible, { destination } = {}) {
      if (!visible || disposed) return;
      applyDestination(destination);
      void refresh({ preserveVisible: Boolean(model) });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++refreshSequence;
      if (refreshTimer !== null) clearTimer(refreshTimer);
      refreshTimer = null;
      model = null;
      container.removeEventListener('click', onClick);
    },
  };
}

export { mountHomeWorkspace as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineHomeWorkspace', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: HOME_WORKSPACE_SCHEMA_VERSION,
      mount: mountHomeWorkspace,
      resolveDestinationPresentation: resolveHomeDestinationPresentation,
      syncCopy: homeSyncCopy,
      savedItemFacts: homeSavedItemFacts,
    }),
    writable: false,
  });
}
