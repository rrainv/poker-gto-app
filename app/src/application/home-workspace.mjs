// EXTRACT-HOME-001 / HOME-001: the Home workspace, a mounted controller. It
// renders the greeting, the account/guest strip and up to six cards (Continue
// or Welcome, Today's session, the night after, What Riverline noticed,
// Review, Recent; which cards show is decided by home-cards.mjs), the Home vs
// Saved destination presentation, the refresh sequence and 80 ms coalescing
// timer, and Home's delegated clicks. Home does no poker maths
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
//   now()                       optional; the clock for the greeting (default new Date())
import { savedItemRecency, savedItemTitle } from './saved-item-presentation.mjs';
import {
  HOME_PLAN_VS_PLAYED_MIN_HANDS,
  deriveSessionPlan,
  homeGreetingPart,
  homeSampleTier,
  planHomeCards,
  selectNoticedItems,
} from './home-cards.mjs';

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
      ? ['guest', 'greeting', 'cards']
      : ['overview', 'greeting', 'cards'];
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

// How long the opening motion owns the cards container. A timeout, not
// animationend, clears it (MOCKUP_QA 1: never rely only on animation events).
export const HOME_ENTRANCE_MS = 1900;
export const HOME_COMPACT_ROW_LIMIT = 3;
export const HOME_RECENT_ROW_LIMIT = 5;

const CARD_IDS = Object.freeze({
  welcome: 'homeWelcomeCard',
  continue: 'homeContinueCard',
  session: 'homeSessionCard',
  night: 'homeNightCard',
  noticed: 'homeNoticedCard',
  review: 'homeReviewCard',
  recent: 'homeRecentCard',
});

const CARD_CONTENT_IDS = Object.freeze({
  welcome: 'homeWelcomeActions',
  continue: 'homeContinueContent',
  session: 'homeSessionContent',
  night: 'homeNightContent',
  noticed: 'homeNoticedContent',
  review: 'homeReviewContent',
  recent: 'homeRecentContent',
});

export function mountHomeWorkspace(container, deps) {
  const document = container.ownerDocument;
  const byId = (id) => document.getElementById(id);
  const t = (key, values) => deps.translate(key, values);
  const setTimer = deps.setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => globalThis.clearTimeout(id));
  const now = () => (deps.now ? deps.now() : new Date());

  let model = null;
  let refreshSequence = 0;
  let refreshTimer = null;
  let entranceTimer = null;
  let entrancePending = true;
  let lastInput = 'pointer';
  let disposed = false;

  function setTranslated(element, key) {
    if (!element) return;
    element.dataset.i18n = key;
    element.textContent = t(key);
  }

  // Cards: the elements, looked up at call time (the markup is static).
  const card = (id) => byId(CARD_IDS[id]);

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
      greeting: byId('homeGreeting'),
      cards: byId('homeCards'),
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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function emptyState(messageKey, error = false) {
    return el('p', error ? 'home-error-state' : 'home-empty-state', t(messageKey));
  }

  // One solid primary action per view (docs/design/decisions HOME RULES): the
  // render decides which button is primary and passes it here.
  function button(label, { primary = false, quiet = false, destination, action, savedId } = {}) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = `ui-button ${primary ? 'ui-button--primary' : quiet ? 'ui-button--quiet' : 'ui-button--secondary'}`;
    if (destination) control.dataset.homeDestination = destination;
    if (action) control.dataset.homeAction = action;
    if (savedId) control.dataset.homeSavedId = savedId;
    control.textContent = label;
    return control;
  }

  // A fixed-height row that is one native button (no controls nested inside).
  function row({ lead, title, titleAuto = false, sub, label, destination, savedId }) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'home-row';
    if (destination) control.dataset.homeDestination = destination;
    if (savedId) control.dataset.homeSavedId = savedId;
    if (label) control.setAttribute('aria-label', label);
    if (lead) control.append(el('span', 'home-row-lead', lead));
    const copy = el('span', 'home-row-copy');
    const heading = el('strong', 'home-row-title', title);
    if (titleAuto) heading.dir = 'auto';
    copy.append(heading);
    if (sub) {
      const subline = el('span', 'home-row-sub');
      // Parts are plain text, or { text, island } for poker data (an LTR island in Hebrew).
      (Array.isArray(sub) ? sub : [sub]).forEach((part, index) => {
        if (index) subline.append(' · ');
        if (typeof part === 'string') {
          subline.append(part);
          return;
        }
        const island = el('span', part.island ? 'poker-data-token' : null, part.text);
        if (part.island) island.dir = 'ltr';
        subline.append(island);
      });
      copy.append(subline);
    }
    control.append(copy);
    return control;
  }

  function savedRow(item, { reasonKey = null, lead = null } = {}) {
    const itemTitle = savedItemTitle(item, t);
    const facts = homeSavedItemFacts(item, t, deps.locale());
    const kind = t(item.kind === 'hand' ? 'Saved Hand' : 'Saved Spot');
    const action = t(item.kind === 'hand' ? 'Open replay' : 'Open spot');
    return row({
      lead,
      title: itemTitle,
      titleAuto: true,
      sub: reasonKey ? [`${t(reasonKey)} · ${kind}`] : [kind, { text: facts.slice(0, 2).join(' · '), island: true }],
      label: `${action}: ${itemTitle}`,
      savedId: item.id,
    });
  }

  function greetingTitle(next) {
    const part = homeGreetingPart(now());
    const name = next.sessionMode === 'guest' ? '' : (next.identity?.profile?.displayName || '');
    const base = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' }[part];
    return name ? t(`${base}, {name}`, { name }) : t(base);
  }

  function renderGreeting(next) {
    const title = byId('homeGreetingTitle');
    const sub = byId('homeGreetingSub');
    if (title) {
      title.textContent = greetingTitle(next);
      title.dir = 'auto';
    }
    if (sub) {
      let text = '';
      try {
        text = new Intl.DateTimeFormat(deps.locale() || 'en', { weekday: 'long', month: 'long', day: 'numeric' }).format(now());
      } catch (_) {
        text = '';
      }
      sub.textContent = text;
    }
    // Read-only context: the selected Game and Approach Home already loaded.
    // Changing the format belongs with Table rules (M2), not here.
    const chip = byId('homeContextChip');
    if (chip) {
      const strategy = next.sections.personalStrategy;
      const ready = strategy?.status === 'ready' && strategy.selectedProfile;
      chip.hidden = !ready;
      chip.replaceChildren();
      if (ready) {
        const game = el('bdi', null, strategy.selectedProfile.displayName);
        game.dir = 'auto';
        chip.append(game);
        if (strategy.selectedMode?.displayName) {
          chip.append(' · ');
          const approach = el('bdi', null, strategy.selectedMode.displayName);
          approach.dir = 'auto';
          chip.append(approach);
        }
      }
    }
  }

  function renderWelcome() {
    setTranslated(byId('homeWelcomeTitle'), "Let's start with a few quick spots");
    setTranslated(byId('homeWelcomeText'), 'A short drill shows how Riverline works. You can stop at any time.');
    const actions = byId('homeWelcomeActions');
    actions.replaceChildren(button(t('Start the first drill'), { primary: true, destination: 'training' }));
  }

  function renderContinue(section) {
    const root = byId('homeContinueContent');
    if (!root) return;
    root.replaceChildren();
    const items = section?.items ?? [];
    items.forEach((item, index) => {
      const entry = el('div', item.kind === 'live_hand' ? 'home-continue-item home-continue-item--live' : 'home-continue-item');
      const copy = el('div', 'home-continue-copy');
      copy.append(el('strong', 'home-continue-title', t(item.kind === 'live_hand' ? 'Live Hand' : 'Personal Strategy')));
      if (item.kind === 'live_hand') {
        copy.append(el('p', 'home-continue-context', t('Your current in-memory hand is ready to continue.')));
      } else {
        const facts = [item.profileName, item.modeName];
        if (Number.isInteger(item.context?.tableSize)) facts.push(t('{count}-handed', { count: item.context.tableSize }));
        const context = el('p', 'home-continue-context', facts.join(' · '));
        context.dir = 'auto';
        copy.append(context);
        const total = item.totalCount;
        if (Number.isFinite(total) && total > 0) {
          const bar = el('div', 'home-progress');
          bar.setAttribute('role', 'progressbar');
          bar.setAttribute('aria-valuemin', '0');
          bar.setAttribute('aria-valuemax', String(total));
          bar.setAttribute('aria-valuenow', String(item.answeredCount));
          bar.setAttribute('aria-label', t('{answered} of {total} directly answered', { answered: item.answeredCount, total }));
          const fill = el('i');
          fill.style.setProperty('--home-progress', String(Math.min(1, Math.max(0, item.answeredCount / total))));
          bar.append(fill);
          copy.append(bar);
          copy.append(el('p', 'home-continue-progress', t('{answered} of {total} directly answered', {
            answered: item.answeredCount, total,
          })));
        }
      }
      // Resuming is the one solid action while something is in progress; the
      // session below is then secondary.
      const resume = button(t(item.kind === 'live_hand' ? 'Return to live hand' : 'Resume calibration'), {
        primary: index === 0,
        destination: item.kind === 'live_hand' ? undefined : 'personal-strategy',
        action: item.kind === 'live_hand' ? 'return-live-hand' : undefined,
      });
      entry.append(copy, resume);
      root.append(entry);
    });
  }

  function renderSession(next, plan, { continuing }) {
    const content = byId('homeSessionContent');
    content.replaceChildren();
    if (plan.state === 'first_visit') {
      setTranslated(byId('homeSessionEyebrow'), 'Where to begin');
      setTranslated(byId('homeSessionTitle'), 'Three things to try');
      const list = el('div', 'home-rows');
      list.append(
        row({ lead: '1', title: t('Practice a few spots'), sub: t('Decisions in a short drill'), destination: 'training' }),
        row({ lead: '2', title: t('Reconstruct a hand you remember'), sub: t('Step through each street'), destination: 'hand' }),
        row({ lead: '3', title: t('Analyze a spot'), sub: t("Build a situation and see the baseline's mix"), destination: 'analyze' }),
      );
      content.append(list);
      return;
    }
    const session = deriveSessionPlan(next);
    setTranslated(byId('homeSessionEyebrow'), "Today's session");
    if (session.state === 'unavailable') {
      setTranslated(byId('homeSessionTitle'), 'Saved items could not be loaded.');
      const actions = el('div', 'home-card-actions');
      actions.append(button(t('Practice a quick drill'), { primary: !continuing, destination: 'training' }));
      content.append(actions);
      return;
    }
    if (session.state === 'nothing_due') {
      setTranslated(byId('homeSessionTitle'), 'Nothing is due');
      content.append(el('p', 'home-card-text', t('Nothing is marked for another look. Practice when you want to.')));
      content.append(el('div', 'home-card-actions'));
      content.lastChild.append(button(t('Practice a quick drill'), { primary: !continuing, destination: 'training' }));
      return;
    }
    setTranslated(byId('homeSessionTitle'), 'Picked from what you saved');
    const list = el('div', 'home-rows');
    session.steps.forEach((step, index) => {
      if (step.kind === 'practice') {
        list.append(row({
          lead: String(index + 1), title: t('Practice a quick drill'), sub: t('A few spots in Training'), destination: 'training',
        }));
        return;
      }
      const reasonKey = step.kind === 'review_later' ? 'Marked for review later' : 'Marked as a mistake';
      list.append(savedRow(step.item, { reasonKey, lead: String(index + 1) }));
    });
    content.append(list);
    const first = session.steps[0];
    const actions = el('div', 'home-card-actions');
    actions.append(button(t("Start today's session"), {
      primary: !continuing,
      destination: first.kind === 'practice' ? 'training' : undefined,
      savedId: first.kind === 'practice' ? undefined : first.savedId,
    }));
    content.append(actions);
  }

  function renderNight(next, plan) {
    const content = byId('homeNightContent');
    content.replaceChildren();
    setTranslated(byId('homeNightEyebrow'), 'Game night');
    if (plan.state === 'first_visit' || !next.sections.nightAfter?.night) {
      setTranslated(byId('homeNightTitle'), 'Keep score with friends');
      content.append(el('p', 'home-card-text', t('Buy-ins, rebuys and a fair settle-up at the end of the night.')));
      const actions = el('div', 'home-card-actions');
      actions.append(button(t('Open game night'), { destination: 'home-game' }));
      content.append(actions);
      return;
    }
    const night = next.sections.nightAfter.night;
    const active = night.state === 'active';
    setTranslated(byId('homeNightEyebrow'), active ? 'Game night in progress' : 'The night after');
    const title = byId('homeNightTitle');
    title.removeAttribute('data-i18n');
    title.textContent = night.title || t('Game night');
    title.dir = 'auto';
    // Only stored facts: a value that is not known is left out, never zero.
    const tiles = el('div', 'home-tiles');
    const tile = (value, labelKey) => {
      const entry = el('div', 'home-tile');
      entry.append(el('strong', 'home-tile-value', value), el('span', 'home-tile-label', t(labelKey)));
      tiles.append(entry);
    };
    tile(String(night.playerCount), 'Players');
    if (!active && night.transferCount !== null) tile(String(night.transferCount), 'Transfers to settle');
    if (!active && night.settledText) tile(night.settledText, 'Moved in the settle-up');
    content.append(tiles);
    const when = savedItemRecency(night.endedAt || night.updatedAt, deps.locale());
    if (when) content.append(el('p', 'home-card-text', t(active ? 'Updated {when}' : 'Finished {when}', { when })));
    const actions = el('div', 'home-card-actions');
    actions.append(button(t('Open game night'), { destination: 'home-game' }));
    content.append(actions);
  }

  function renderNoticed(next) {
    const content = byId('homeNoticedContent');
    content.replaceChildren();
    const section = next.sections.noticed;
    if (section?.status === 'error') {
      content.append(emptyState('Saved items could not be loaded.', true));
      return;
    }
    const items = selectNoticedItems(section);
    if (items.length === 0) {
      content.append(el('p', 'home-card-text', t('Nothing to report yet.')));
      content.append(el('p', 'home-card-note', t(
        'Riverline compares your plan with the hands you play once there are at least {count} of them.',
        { count: HOME_PLAN_VS_PLAYED_MIN_HANDS },
      )));
      return;
    }
    const list = el('div', 'home-noticed-list');
    items.forEach((item) => {
      // The whole item is the link to its spots (one native control, nothing nested).
      const entry = el(item.destination ? 'button' : 'div', 'home-noticed-item');
      if (item.destination) {
        entry.type = 'button';
        entry.dataset.homeDestination = item.destination;
        entry.setAttribute('aria-label', `${t('Look at the spots')}: ${item.spotLabel}`);
      }
      const title = el('strong', 'home-noticed-title');
      const island = el('bdi', null, item.spotLabel);
      island.dir = 'auto';
      title.append(island);
      const evidence = item.kind === 'drift'
        ? t('Played {played}% over {total} hands · plan {plan}%', {
          played: item.playedPercent, total: item.sampleSize, plan: item.planPercent,
        })
        : t('Played {played} of {total} hands · your plan {plan}%', {
          played: item.playedCount, total: item.sampleSize, plan: item.planPercent,
        });
      const tier = homeSampleTier(item.sampleSize);
      const sourceKey = `${item.kind === 'drift' ? 'Played hands · mixed baseline' : 'Played hands · your plan'} · ${tier} sample`;
      entry.append(title, el('span', 'home-noticed-evidence', evidence), el('span', 'home-noticed-source', t(sourceKey)));
      list.append(entry);
    });
    content.append(list);
  }

  function renderReview(next) {
    const root = byId('homeReviewContent');
    if (!root) return;
    root.replaceChildren();
    const reviewLater = next.sections.review?.reviewLater;
    const mistakes = next.sections.review?.mistakes;
    if (reviewLater?.status === 'error' || mistakes?.status === 'error') {
      root.append(emptyState('Saved items could not be loaded.', true));
      return;
    }
    const entries = [];
    (reviewLater?.items ?? []).forEach((item) => entries.push({ item, reasonKey: 'Review later' }));
    (mistakes?.items ?? []).forEach((item) => {
      if (!entries.some((entry) => entry.item.id === item.id)) entries.push({ item, reasonKey: 'Marked as a mistake' });
    });
    const list = el('div', 'home-rows');
    entries.slice(0, HOME_COMPACT_ROW_LIMIT).forEach(({ item, reasonKey }) => list.append(savedRow(item, { reasonKey })));
    root.append(list);
  }

  function renderRecent(section) {
    const root = byId('homeRecentContent');
    if (!root) return;
    root.replaceChildren();
    if (section?.status === 'error') {
      root.append(emptyState('Saved items could not be loaded.', true));
      return;
    }
    const list = el('div', 'home-rows');
    (section?.items ?? []).slice(0, HOME_RECENT_ROW_LIMIT).forEach((item) => list.append(savedRow(item)));
    root.append(list);
  }

  function renderAccountOverview(next) {
    const overview = byId('homeAccountOverview');
    if (!overview) return;
    const guest = next.sessionMode === 'guest';
    overview.hidden = guest;
    const displayName = byId('homeIdentityDisplayName');
    const username = byId('homeIdentityUsername');
    if (guest) {
      // A guest view must not keep a previous owner's identity in hidden DOM.
      displayName.textContent = '';
      username.textContent = '';
      username.hidden = true;
      return;
    }
    const profile = next.identity?.profile;
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
  // sidebar). "Review Mistakes" survives as a link in the Review card header,
  // shown under the same rule as before (at least one marked mistake).
  function renderReviewMistakesLink(next) {
    const link = byId('homeReviewMistakesLink');
    if (!link) return;
    link.hidden = !(next.sections.quickStart?.destinations || []).includes('review_mistakes');
  }

  // Places the shown cards in the two columns and hides the rest. A card with
  // nothing to show is not placed at all (no blank placeholder).
  function layoutCards(plan) {
    const start = byId('homeColumnStart');
    const end = byId('homeColumnEnd');
    const shown = new Set(plan.cards);
    Object.keys(CARD_IDS).forEach((id) => {
      const element = card(id);
      if (!element) return;
      element.hidden = !shown.has(id);
      // A card that is left out keeps no content (nothing stale, nothing private).
      if (!shown.has(id)) byId(CARD_CONTENT_IDS[id])?.replaceChildren();
    });
    plan.start.forEach((id) => start.append(card(id)));
    plan.end.forEach((id) => end.append(card(id)));
    // Reading order across the two columns: row by row, start column first.
    const rows = Math.max(plan.start.length, plan.end.length);
    let order = 0;
    for (let index = 0; index < rows; index += 1) {
      [plan.start[index], plan.end[index]].forEach((id) => {
        if (id) card(id).style.setProperty('--home-card-order', String(order++));
      });
    }
    // The last card of each column takes the column's spare height.
    [plan.start, plan.end].forEach((ids) => {
      ids.forEach((id, index) => { card(id).dataset.columnLast = String(index === ids.length - 1); });
    });
    const cards = byId('homeCards');
    if (cards) {
      cards.dataset.visitState = plan.state;
      cards.dataset.cardCount = String(plan.cards.length);
      cards.dataset.singleColumn = String(plan.end.length === 0);
    }
  }

  function playEntrance() {
    const cards = byId('homeCards');
    if (!cards || !entrancePending) return;
    entrancePending = false;
    // Keyboard-driven opening is instant (frequency decides motion).
    if (lastInput === 'keyboard') return;
    cards.classList.add('home-cards--enter');
    if (entranceTimer !== null) clearTimer(entranceTimer);
    entranceTimer = setTimer(() => {
      entranceTimer = null;
      cards.classList.remove('home-cards--enter');
    }, HOME_ENTRANCE_MS);
  }

  function render(next) {
    model = next;
    const guest = next.sessionMode === 'guest';
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
    const plan = planHomeCards(next);
    const continuing = plan.cards.includes('continue');
    renderGreeting(next);
    layoutCards(plan);
    if (plan.cards.includes('welcome')) renderWelcome();
    if (continuing) renderContinue(next.sections.continue);
    renderSession(next, plan, { continuing: continuing || plan.state === 'first_visit' });
    if (plan.cards.includes('night')) renderNight(next, plan);
    renderNoticed(next);
    if (plan.cards.includes('review')) renderReview(next);
    if (plan.cards.includes('recent')) renderRecent(next.sections.recent);
    const workspace = byId('homeWorkspace');
    const loading = byId('homeLoadingState');
    const content = byId('homeWorkspaceContent');
    if (content) content.dataset.sessionMode = guest ? 'guest' : 'account';
    if (content) content.dataset.hasContinuation = String(continuing);
    if (workspace) workspace.setAttribute('aria-busy', 'false');
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
    applyDestination();
    if (deps.activeDestination() !== 'saved') playEntrance();
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
  // in-flight loads become stale and everything private leaves the DOM, the
  // workspace header included (HOME-HEADER-OWNER-LEAK) and the hidden identity
  // fields (HOME-HIDDEN-IDENTITY-LEAK).
  function ownerChanged() {
    ++refreshSequence;
    model = null;
    byId('homeWorkspaceContent')?.setAttribute('hidden', '');
    [
      'homeContinueContent', 'homeSessionContent', 'homeNightContent', 'homeNoticedContent',
      'homeReviewContent', 'homeRecentContent', 'homeWelcomeActions', 'homeContextChip',
    ].forEach((id) => byId(id)?.replaceChildren());
    ['homeGreetingTitle', 'homeGreetingSub', 'homeNightTitle', 'homeIdentityDisplayName', 'homeIdentityUsername']
      .forEach((id) => { const node = byId(id); if (node) node.textContent = ''; });
    byId('homeContextChip')?.setAttribute('hidden', '');
    const header = deps.header();
    header?.setContext?.('home', []);
    header?.setPlayContext?.(null);
    entrancePending = true;
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
      // The link sits in the Review card header, so it opens every
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
  // The opening motion follows how Home was opened: a key press is instant.
  const onKeyInput = () => { lastInput = 'keyboard'; };
  const onPointerInput = () => { lastInput = 'pointer'; };
  document.addEventListener('keydown', onKeyInput, true);
  document.addEventListener('pointerdown', onPointerInput, true);

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
      if (disposed) return;
      if (!visible) {
        // The next opening plays the entrance again.
        entrancePending = true;
        return;
      }
      applyDestination(destination);
      void refresh({ preserveVisible: Boolean(model) });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++refreshSequence;
      if (refreshTimer !== null) clearTimer(refreshTimer);
      if (entranceTimer !== null) clearTimer(entranceTimer);
      refreshTimer = null;
      entranceTimer = null;
      model = null;
      container.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyInput, true);
      document.removeEventListener('pointerdown', onPointerInput, true);
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
