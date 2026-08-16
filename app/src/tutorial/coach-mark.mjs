const VIEWPORT_MARGIN = 12;
const TARGET_GAP = 14;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function candidatePlacement(name, target, panel, gap) {
  if (name === 'top') return { top: target.top - panel.height - gap, left: target.left + ((target.width - panel.width) / 2) };
  if (name === 'right') return { top: target.top + ((target.height - panel.height) / 2), left: target.right + gap };
  if (name === 'left') return { top: target.top + ((target.height - panel.height) / 2), left: target.left - panel.width - gap };
  return { top: target.bottom + gap, left: target.left + ((target.width - panel.width) / 2) };
}

function candidateFits(candidate, panel, viewport, margin) {
  return candidate.top >= margin
    && candidate.left >= margin
    && candidate.top + panel.height <= viewport.height - margin
    && candidate.left + panel.width <= viewport.width - margin;
}

export function computeCoachMarkPlacement({
  targetRect,
  panelSize,
  viewport,
  preference = 'auto',
  margin = VIEWPORT_MARGIN,
  gap = TARGET_GAP,
} = {}) {
  const target = {
    top: Number(targetRect?.top) || 0,
    right: Number(targetRect?.right) || 0,
    bottom: Number(targetRect?.bottom) || 0,
    left: Number(targetRect?.left) || 0,
    width: Number(targetRect?.width) || 0,
    height: Number(targetRect?.height) || 0,
  };
  const panel = {
    width: Math.min(Number(panelSize?.width) || 0, Math.max(0, viewport.width - (margin * 2))),
    height: Math.min(Number(panelSize?.height) || 0, Math.max(0, viewport.height - (margin * 2))),
  };
  const order = preference === 'auto' || preference === 'center'
    ? ['bottom', 'top', 'right', 'left']
    : [preference, ...['bottom', 'top', 'right', 'left'].filter((name) => name !== preference)];
  for (const name of order) {
    const candidate = candidatePlacement(name, target, panel, gap);
    if (candidateFits(candidate, panel, viewport, margin)) {
      return Object.freeze({ mode: name, top: candidate.top, left: candidate.left });
    }
  }
  const targetCenterY = target.top + (target.height / 2);
  const fallbackTop = targetCenterY < viewport.height / 2
    ? viewport.height - panel.height - margin
    : margin;
  return Object.freeze({
    mode: 'center',
    top: clamp(fallbackTop, margin, viewport.height - panel.height - margin),
    left: clamp((viewport.width - panel.width) / 2, margin, viewport.width - panel.width - margin),
  });
}

export function computeSpotlightRect({ targetRect, viewport, pad = 6 } = {}) {
  const width = Math.max(0, Number(viewport?.width) || 0);
  const height = Math.max(0, Number(viewport?.height) || 0);
  const top = clamp((Number(targetRect?.top) || 0) - pad, 0, height);
  const left = clamp((Number(targetRect?.left) || 0) - pad, 0, width);
  const right = clamp((Number(targetRect?.right) || 0) + pad, 0, width);
  const bottom = clamp((Number(targetRect?.bottom) || 0) + pad, 0, height);
  return Object.freeze({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
}

function elementUsable(element) {
  if (!element?.isConnected) return false;
  const rect = element.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

function fullyInViewport(rect, viewport) {
  return rect.top >= VIEWPORT_MARGIN
    && rect.left >= VIEWPORT_MARGIN
    && rect.bottom <= viewport.height - VIEWPORT_MARGIN
    && rect.right <= viewport.width - VIEWPORT_MARGIN;
}

export function createCoachMarkSurface({
  document = globalThis.document,
  window = globalThis.window,
  translate = (key, parameters) => globalThis.t?.(key, parameters) ?? key,
  fallbackFocus = () => document?.querySelector?.('.mode-nav-item[aria-current="page"]'),
} = {}) {
  let elements = null;
  let active = null;
  let focusBeforeTutorial = null;
  let resizeObserver = null;
  let layoutFrame = 0;
  let renderSequence = 0;
  let focusOnNextLayout = false;
  const diagnostics = { shows: 0, layouts: 0, targetLosses: 0, activeListeners: 0 };

  function createButton(className, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-button ${className}`;
    button.dataset.tutorialAction = action;
    return button;
  }

  function ensureElements() {
    if (elements) return elements;
    const layer = document.createElement('div');
    layer.className = 'tutorial-layer';
    layer.dataset.tutorialLayer = 'active';
    const spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';
    spotlight.setAttribute('aria-hidden', 'true');
    const panel = document.createElement('section');
    panel.className = 'tutorial-coach overlay-surface';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'tutorialCoachTitle');
    panel.setAttribute('aria-describedby', 'tutorialCoachBody');
    panel.tabIndex = -1;
    const step = document.createElement('p');
    step.className = 'tutorial-step-count';
    step.setAttribute('aria-live', 'polite');
    const title = document.createElement('h2');
    title.id = 'tutorialCoachTitle';
    const body = document.createElement('p');
    body.id = 'tutorialCoachBody';
    body.className = 'tutorial-coach-body';
    const interaction = document.createElement('p');
    interaction.className = 'tutorial-interaction-note';
    interaction.hidden = true;
    const actions = document.createElement('div');
    actions.className = 'tutorial-actions';
    const back = createButton('ui-button--quiet', 'back');
    const skip = createButton('ui-button--quiet', 'skip');
    const next = createButton('ui-button--primary', 'next');
    actions.append(back, skip, next);
    panel.append(step, title, body, interaction, actions);
    layer.append(spotlight, panel);
    layer.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-tutorial-action]')?.dataset.tutorialAction;
      if (!action || !active) return;
      if (action === 'back') active.onBack();
      else if (action === 'skip') active.onSkip();
      else if (action === 'finish') active.onFinish();
      else active.onNext();
    });
    elements = { layer, spotlight, panel, step, title, body, interaction, back, skip, next };
    return elements;
  }

  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function loseTarget() {
    if (!active) return;
    diagnostics.targetLosses += 1;
    const callback = active.onTargetLost;
    active = null;
    callback();
  }

  function layout() {
    layoutFrame = 0;
    if (!active || !elements) return;
    if (!elementUsable(active.target)) return loseTarget();
    diagnostics.layouts += 1;
    const targetRect = active.target.getBoundingClientRect();
    const pad = active.step.emphasis === 'none' ? 0 : 6;
    const spotlightRect = computeSpotlightRect({ targetRect, viewport: viewport(), pad });
    Object.assign(elements.spotlight.style, {
      top: `${spotlightRect.top}px`,
      left: `${spotlightRect.left}px`,
      width: `${spotlightRect.width}px`,
      height: `${spotlightRect.height}px`,
    });
    elements.spotlight.dataset.emphasis = active.step.emphasis;
    const panelRect = elements.panel.getBoundingClientRect();
    const placement = computeCoachMarkPlacement({
      targetRect,
      panelSize: panelRect,
      viewport: viewport(),
      preference: active.step.placement,
    });
    elements.panel.dataset.placement = placement.mode;
    elements.panel.style.top = `${placement.top}px`;
    elements.panel.style.left = `${placement.left}px`;
    elements.panel.style.visibility = 'visible';
    if (focusOnNextLayout) {
      focusOnNextLayout = false;
      elements.panel.focus({ preventScroll: true });
    }
  }

  function scheduleLayout() {
    if (!active || layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(layout);
  }

  function onKeyDown(event) {
    if (!active || event.defaultPrevented) return;
    const tagName = event.target?.tagName;
    const typing = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      active.onSkip();
    } else if (!typing && (event.key === 'ArrowRight' || event.key === 'PageDown')) {
      event.preventDefault();
      active.onNext();
    } else if (!typing && (event.key === 'ArrowLeft' || event.key === 'PageUp')) {
      event.preventDefault();
      active.onBack();
    }
  }

  function addActiveListeners() {
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('scroll', scheduleLayout, true);
    window.addEventListener('keydown', onKeyDown, true);
    diagnostics.activeListeners = 3;
  }

  function removeActiveListeners() {
    window.removeEventListener('resize', scheduleLayout);
    window.removeEventListener('scroll', scheduleLayout, true);
    window.removeEventListener('keydown', onKeyDown, true);
    diagnostics.activeListeners = 0;
    resizeObserver?.disconnect?.();
    resizeObserver = null;
    if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
  }

  function settleAndLayout(sequence, shouldScroll) {
    if (shouldScroll) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      active.target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (active && sequence === renderSequence) layout();
    }));
  }

  function show(configuration) {
    const firstShow = !active;
    active = configuration;
    diagnostics.shows += 1;
    renderSequence += 1;
    const sequence = renderSequence;
    const ui = ensureElements();
    if (firstShow) {
      focusBeforeTutorial = document.activeElement;
      document.body.appendChild(ui.layer);
      addActiveListeners();
    }
    focusOnNextLayout = true;
    ui.panel.style.visibility = 'hidden';
    ui.step.textContent = translate('Step {current} of {total}', {
      current: configuration.stepIndex + 1,
      total: configuration.stepCount,
    });
    ui.title.textContent = translate(configuration.step.titleKey);
    ui.body.textContent = translate(configuration.step.bodyKey);
    ui.interaction.hidden = !configuration.step.interactionRequired;
    ui.interaction.textContent = configuration.step.interactionLabelKey
      ? translate(configuration.step.interactionLabelKey)
      : '';
    ui.back.textContent = translate('Back');
    ui.back.disabled = configuration.stepIndex === 0;
    ui.skip.textContent = translate('Skip');
    const last = configuration.stepIndex === configuration.stepCount - 1;
    ui.next.dataset.tutorialAction = last ? 'finish' : 'next';
    ui.next.textContent = translate(last ? 'Finish' : 'Next');
    ui.next.hidden = configuration.step.interactionRequired;
    resizeObserver?.disconnect?.();
    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(scheduleLayout);
      resizeObserver.observe(configuration.target);
      resizeObserver.observe(ui.panel);
    }
    const targetRect = configuration.target.getBoundingClientRect();
    settleAndLayout(sequence, !fullyInViewport(targetRect, viewport()));
  }

  function hide({ restoreFocus = true } = {}) {
    renderSequence += 1;
    active = null;
    focusOnNextLayout = false;
    removeActiveListeners();
    elements?.layer?.remove?.();
    elements = null;
    const target = focusBeforeTutorial?.isConnected ? focusBeforeTutorial : fallbackFocus();
    focusBeforeTutorial = null;
    if (restoreFocus) target?.focus?.({ preventScroll: true });
  }

  return Object.freeze({
    schemaVersion: 'tutorial-coach-mark/v1',
    show,
    hide,
    diagnostics: () => Object.freeze({ ...diagnostics, active: Boolean(active), pendingLayout: Boolean(layoutFrame) }),
  });
}
