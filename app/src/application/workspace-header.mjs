// SHELL-001: one 56px workspace header bar per workspace.
// Title + context line on the start side; mode switch, source badge, Learn,
// Help and Account on the end side. The context line only joins facts that a
// workspace already rendered (no strategy, Equity or state computation here);
// the source badge follows the placement rule below and never changes when a
// workspace reveals strategy information.

export const WORKSPACE_HEADER_SCHEMA_VERSION = 'workspace-header/v1';
export const WORKSPACE_CONTEXT_SEPARATOR = ' · ';

// Destinations whose header hosts the existing Hand/Scenario mode switch.
export const MODE_SWITCH_DESTINATIONS = Object.freeze(['hand', 'analyze']);

/**
 * The strategy source badge appears only where strategy content is shown:
 * Analyze; Hand while its review surface is open (never during live play);
 * Training once an answer's feedback or the Full Hand review is visible; and
 * Personal Strategy while a comparison surface is open.
 */
export function shouldShowSourceBadge({
  destination = null,
  handReviewOpen = false,
  trainingFeedbackShown = false,
  trainingFullHandPhase = 'off',
  personalComparisonOpen = false,
} = {}) {
  switch (destination) {
    // Each strategy surface names its source once in-surface (OWNER-19 / QA-SHELL-004).
    case 'analyze':
    case 'hand':
    case 'training':
    case 'personal-strategy':
      return false;
    default: return false;
  }
}

export function normalizeWorkspaceContext(parts) {
  if (!Array.isArray(parts)) return Object.freeze([]);
  return Object.freeze(parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean));
}

export function formatWorkspaceContext(parts) {
  return normalizeWorkspaceContext(parts).join(WORKSPACE_CONTEXT_SEPARATOR);
}

// SHELL-002: the context chip names the Game and Approach the app already
// knows (published by Home's view model or Personal Strategy). Read-only;
// Table rules join it in M2. One whole-string template per shape.
export const PLAY_CONTEXT_TEMPLATES = Object.freeze({
  gameAndApproach: 'Game: {game} · Approach: {approach}',
  game: 'Game: {game}',
});

export function normalizePlayContext(value) {
  const game = typeof value?.game === 'string' ? value.game.trim() : '';
  const approach = typeof value?.approach === 'string' ? value.approach.trim() : '';
  if (!game) return null;
  return Object.freeze({ game, approach });
}

export function playContextTemplate(context) {
  if (!context) return null;
  return context.approach ? PLAY_CONTEXT_TEMPLATES.gameAndApproach : PLAY_CONTEXT_TEMPLATES.game;
}

function elementShown(element) {
  if (!element || element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
  return Boolean(element.getClientRects?.().length);
}

export function readSourceBadgeState(document, destination) {
  return {
    destination,
    handReviewOpen: elementShown(document.querySelector('#handReviewSurface')),
    trainingFeedbackShown: elementShown(document.querySelector('#trainingFeedback')),
    trainingFullHandPhase: document.querySelector('#trainingWorkspace')?.dataset.trainingFullHandPhase || 'off',
    personalComparisonOpen: Boolean(document.querySelector('#calibrationMode .personal-comparison[open]')
      && elementShown(document.querySelector('#calibrationMode .personal-comparison'))),
  };
}

export function createWorkspaceHeaderController({ document, translate = (key) => key, schedule = null } = {}) {
  const contexts = new Map();
  const descriptions = new Map();
  const defaultDescriptions = new Map();
  let destination = null;
  let playContext = null;
  let badgeFrame = null;
  const defer = schedule ?? ((callback) => (document.defaultView?.requestAnimationFrame
    ? document.defaultView.requestAnimationFrame(callback)
    : setTimeout(callback, 0)));

  function renderContext() {
    const line = document.querySelector('#workspaceContext');
    if (!line) return;
    const parts = contexts.get(destination) ?? [];
    line.replaceChildren();
    parts.forEach((part, index) => {
      if (index) line.append(WORKSPACE_CONTEXT_SEPARATOR);
      // Each fact is direction-isolated so poker data stays LTR inside Hebrew.
      const fact = document.createElement('bdi');
      fact.textContent = part;
      line.append(fact);
    });
    line.hidden = parts.length === 0;
  }

  function renderPlayContext() {
    const chip = document.querySelector('#workspacePlayContext');
    if (!chip) return;
    chip.replaceChildren();
    const key = playContextTemplate(playContext);
    if (key) {
      // The translated template keeps its placeholders; user-named values are
      // inserted as direction-isolated islands so the sentence stays whole.
      translate(key).split(/(\{game\}|\{approach\})/).forEach((piece) => {
        if (piece === '{game}' || piece === '{approach}') {
          const value = document.createElement('bdi');
          value.dir = 'auto';
          value.textContent = piece === '{game}' ? playContext.game : playContext.approach;
          chip.append(value);
        } else if (piece) chip.append(piece);
      });
    }
    chip.hidden = !key;
  }

  function renderSourceBadge() {
    badgeFrame = null;
    const badge = document.querySelector('#strategySourceStatus');
    if (!badge) return;
    badge.hidden = !shouldShowSourceBadge(readSourceBadgeState(document, destination));
  }

  function refreshSourceBadge({ immediate = false } = {}) {
    if (immediate) { renderSourceBadge(); return; }
    if (badgeFrame !== null) return;
    badgeFrame = defer(renderSourceBadge);
  }

  function renderModeSwitch() {
    const slot = document.querySelector('#workspaceModeSwitch');
    if (slot) slot.hidden = !MODE_SWITCH_DESTINATIONS.includes(destination);
  }

  return Object.freeze({
    schemaVersion: WORKSPACE_HEADER_SCHEMA_VERSION,
    activate(nextDestination, { titleKey = null, descriptionKey = '' } = {}) {
      destination = nextDestination;
      const title = document.querySelector('#workspaceTitle');
      if (title && titleKey) {
        title.dataset.i18n = titleKey;
        title.textContent = translate(titleKey);
      }
      defaultDescriptions.set(nextDestination, descriptionKey || '');
      renderContext();
      renderModeSwitch();
      refreshSourceBadge({ immediate: true });
      // The destination's view becomes visible after activation; settle once more.
      refreshSourceBadge();
    },
    setContext(target, parts) {
      const next = normalizeWorkspaceContext(parts);
      const previous = contexts.get(target);
      if (previous && previous.length === next.length && previous.every((part, index) => part === next[index])) return;
      contexts.set(target, next);
      if (target === destination) renderContext();
    },
    getContext(target = destination) {
      return contexts.get(target) ?? Object.freeze([]);
    },
    setPlayContext(value) {
      const next = normalizePlayContext(value);
      if (next?.game === playContext?.game && next?.approach === playContext?.approach) return;
      playContext = next;
      renderPlayContext();
    },
    getPlayContext() { return playContext; },
    // The chip's labels are code-owned text: re-rendered on a language switch.
    refreshLanguage() { renderPlayContext(); },
    // A workspace may replace its Help description (e.g. Home for Guests).
    setDescription(target, key) {
      if (key) descriptions.set(target, key);
      else descriptions.delete(target);
    },
    getDescription(target = destination) {
      return descriptions.get(target) || defaultDescriptions.get(target) || '';
    },
    getDestination() { return destination; },
    refreshSourceBadge,
  });
}

if (typeof window !== 'undefined' && window.document) {
  const controller = createWorkspaceHeaderController({
    document: window.document,
    translate: (key, parameters) => window.t?.(key, parameters) ?? key,
  });
  // The badge rule reads presentation state that other workspaces toggle
  // (hidden/open attributes). Observing those few nodes keeps the rule in one
  // place without touching reveal timing or calling any strategy service.
  const observeBadgeInputs = () => {
    const targets = [
      window.document.querySelector('#handReviewSurface'),
      window.document.querySelector('#trainingFeedback'),
      window.document.querySelector('#trainingWorkspace'),
      window.document.querySelector('#calibrationMode .personal-comparison'),
    ].filter(Boolean);
    if (!targets.length || typeof window.MutationObserver !== 'function') return;
    const observer = new window.MutationObserver(() => controller.refreshSourceBadge());
    targets.forEach((target) => observer.observe(target, {
      attributes: true,
      attributeFilter: ['hidden', 'open', 'aria-hidden', 'data-training-full-hand-phase'],
    }));
  };
  if (window.document.readyState === 'loading') window.document.addEventListener('DOMContentLoaded', observeBadgeInputs, { once: true });
  else observeBadgeInputs();
  window.addEventListener('riverline:languagechange', () => controller.refreshLanguage());
  Object.defineProperty(window, 'RiverlineWorkspaceHeader', {
    configurable: true,
    enumerable: false,
    value: controller,
    writable: false,
  });
}
