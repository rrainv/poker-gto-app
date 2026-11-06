// TRAINING-FULLHAND-001: the Full Hand decision dock ("felt apron").
// Action tickets (name, keycap, amount) sit directly under the felt; a sizes
// row (the raise ladder: amount, share of the pot, SPR after it) and a
// label-sized Confirm share the next row. Select + confirm by default, with
// the one-time "answer with one click" prompt shared with the quick drill.
// Every number comes from the canonical legal-action spec, the sizing model or
// the domain size-fact selector, already formatted by the host; nothing here
// does poker maths or parses numbers out of text.
//
// Controller interface (AGENTS.md module rule):
//   mount(container, deps) -> { dispose, refreshLanguage, handleKey, setVisible, ... }
// `deps` are injected; the module never reaches for window.app.

export const FULL_HAND_DOCK_SCHEMA_VERSION = 'full-hand-decision-dock/v1';

const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const SIZED_TYPES = Object.freeze(['bet', 'raise']);
const ACTION_KEYS = Object.freeze({
  fold: ['f'], check: ['c'], call: ['c'], bet: ['b', 'r'], raise: ['r', 'b'], all_in: ['a'],
});
const ACTION_KIND = Object.freeze({
  fold: 'fold', check: 'passive', call: 'passive', bet: 'aggressive', raise: 'aggressive', all_in: 'all-in',
});

/**
 * The tickets for one decision, in table order, from the canonical legal-action
 * spec. Pure; unavailable actions never appear.
 */
export function projectFullHandTickets(legalActions) {
  if (!legalActions) return [];
  const entries = {
    fold: legalActions.fold, check: legalActions.check, call: legalActions.call,
    bet: legalActions.bet, raise: legalActions.raise, all_in: legalActions.allIn,
  };
  return ACTION_ORDER.filter((type) => entries[type]?.available).map((type) => Object.freeze({
    type,
    kind: ACTION_KIND[type],
    key: ACTION_KEYS[type][0].toUpperCase(),
    sized: SIZED_TYPES.includes(type),
    amountMilliBb: type === 'call' ? entries.call.commitMilliBb
      : type === 'all_in' ? entries.all_in.amountToMilliBb : null,
    range: SIZED_TYPES.includes(type)
      ? Object.freeze({ minToMilliBb: entries[type].minToMilliBb, maxToMilliBb: entries[type].maxToMilliBb })
      : null,
  }));
}

/** The action type a key selects among the tickets on screen, or null. */
export function fullHandActionForKey(key, availableTypes = []) {
  const pressed = String(key || '').toLowerCase();
  const ordered = ACTION_ORDER.filter((type) => availableTypes.includes(type));
  return ordered.find((type) => ACTION_KEYS[type][0] === pressed)
    || ordered.find((type) => ACTION_KEYS[type].includes(pressed))
    || null;
}

/** The ladder's sizes: presets (never the all-in ticket) with the domain facts. */
export function projectFullHandSizes(sizingModel, actionType) {
  const presets = sizingModel?.actions?.[actionType]?.presets ?? [];
  return presets.filter((preset) => preset.kind !== 'all_in').map((preset) => Object.freeze({
    presetId: preset.presetId,
    amountToMilliBb: preset.amountToMilliBb,
    potShare: Number.isFinite(preset.potShare) ? preset.potShare : null,
    sprAfterCalled: Number.isFinite(preset.sprAfterCalled) ? preset.sprAfterCalled : null,
  }));
}

export function mount(container, deps) {
  const doc = container.ownerDocument;
  const t = (key, values) => deps.translate(key, values);
  const components = () => deps.components();
  const listeners = [];
  let disposed = false;
  let unsubscribe = null;
  let holdTimer = null;
  const state = {
    decisionId: null, tickets: [], selected: null, sizes: [], sizeIndex: -1,
    custom: null, locked: false,
  };

  const ticketsEl = container.querySelector('[data-fh-tickets]');
  const sizesEl = container.querySelector('[data-fh-sizes]');
  const confirmMount = container.querySelector('[data-fh-confirm]');
  const promptEl = container.querySelector('[data-fh-prompt]');
  let confirmButton = null;

  function listen(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  // Re-renders replace nodes; drop the listeners of nodes that left the page.
  function pruneListeners() {
    for (let index = listeners.length - 1; index >= 0; index -= 1) {
      const { target, type, handler } = listeners[index];
      if (target.isConnected === false) {
        target.removeEventListener(type, handler);
        listeners.splice(index, 1);
      }
    }
  }

  const store = () => deps.answerStore();
  const oneClick = () => store()?.mode() === 'one_click';
  const ready = () => !state.locked && deps.isReady();
  const ticketOf = (type) => state.tickets.find((ticket) => ticket.type === type) || null;

  function actionName(type) { return deps.actionName(type); }
  // An amount stays one left-to-right island inside a translated sentence (Hebrew).
  const isolate = (text) => `⁦${text}⁩`;
  const amountText = (milliBb) => isolate(deps.formatAmount(milliBb));

  function sizeLabel(size) {
    return { amountText: deps.formatAmount(size.amountToMilliBb) };
  }

  function currentSize() {
    if (state.custom) return state.custom;
    return state.sizeIndex >= 0 ? state.sizes[state.sizeIndex] : null;
  }

  function ticketText(ticket) {
    if (ticket.sized) {
      const size = state.selected === ticket.type ? currentSize() : null;
      if (size) return { amountText: deps.formatAmount(size.amountToMilliBb), detail: '' };
      return {
        amountText: t('{min} to {max}', {
          min: amountText(ticket.range.minToMilliBb),
          max: amountText(ticket.range.maxToMilliBb),
        }),
        detail: t('Choose size'),
      };
    }
    return { amountText: ticket.amountMilliBb === null ? '' : deps.formatAmount(ticket.amountMilliBb), detail: '' };
  }

  function renderTickets() {
    if (!ticketsEl) return;
    pruneListeners();
    ticketsEl.replaceChildren(...state.tickets.map((ticket) => {
      const name = actionName(ticket.type);
      const { amountText, detail } = ticketText(ticket);
      const card = components().createActionCard(doc, {
        type: ticket.type, kind: ticket.kind, name, amountText, detail, keyLabel: ticket.key,
        selected: state.selected === ticket.type,
        ariaLabel: amountText ? `${name}, ${amountText}` : name,
      });
      listen(card, 'click', () => choose(ticket.type));
      return card;
    }));
    ticketsEl.dataset.actionCount = String(state.tickets.length);
    components().selectActionCard(ticketsEl, state.selected);
    ticketsEl.dataset.hasSelection = String(Boolean(state.selected));
  }

  function refreshTicketTexts() {
    ticketsEl?.querySelectorAll('.rl-action-card').forEach((card) => {
      const ticket = ticketOf(card.dataset.action);
      if (!ticket?.sized) return;
      const { amountText, detail } = ticketText(ticket);
      const amount = card.querySelector('.rl-action-card__amount');
      const note = card.querySelector('.rl-action-card__detail');
      amount?.replaceChildren(components().pokerIsland(doc, amountText));
      note?.replaceChildren(detail ? components().pokerIsland(doc, detail) : doc.createTextNode(' '));
    });
  }

  function renderSizes() {
    if (!sizesEl) return;
    pruneListeners();
    sizesEl.replaceChildren();
    sizesEl.dataset.mode = state.selected && ticketOf(state.selected)?.sized ? 'ladder' : 'hint';
    if (sizesEl.dataset.mode === 'hint') {
      const hint = doc.createElement('p');
      hint.className = 'rl-fh-dock__keys';
      hint.textContent = t('Keys: F fold · C check or call · R raise · A all-in · 1-9 size · Enter confirm');
      sizesEl.append(hint);
      return;
    }
    const type = state.selected;
    const label = t('{action} to', { action: actionName(type) });
    const ladder = components().createSizeLadder(doc, {
      label,
      selectedIndex: state.custom ? -1 : state.sizeIndex,
      sizes: state.sizes.map((size) => ({
        amountText: deps.formatAmount(size.amountToMilliBb),
        shareText: size.potShare === null ? '' : deps.formatShare(size.potShare),
        sprText: size.sprAfterCalled === null ? '' : deps.formatSpr(size.sprAfterCalled),
        ariaLabel: [deps.formatAmount(size.amountToMilliBb),
          size.potShare === null ? '' : deps.formatShare(size.potShare),
          size.sprAfterCalled === null ? '' : deps.formatSpr(size.sprAfterCalled)].filter(Boolean).join(', '),
      })),
    });
    ladder.querySelectorAll('.rl-ladder__size').forEach((button) => {
      listen(button, 'click', () => chooseSize(Number(button.dataset.sizeIndex)));
    });
    ladder.append(buildCustomEntry(type));
    sizesEl.append(ladder);
  }

  function buildCustomEntry(type) {
    const wrap = doc.createElement('label');
    wrap.className = 'rl-ladder__custom';
    const text = doc.createElement('span');
    text.textContent = t('Other size');
    const input = doc.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.className = 'rl-ladder__input';
    input.setAttribute('aria-label', t('{action} to, in big blinds', { action: actionName(type) }));
    deps.bindNumberInput?.(input);
    const unit = doc.createElement('span');
    unit.textContent = 'bb';
    const status = doc.createElement('span');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    wrap.append(text, input, unit, status);
    const apply = ({ commit = false } = {}) => {
      if (!input.value.trim()) {
        input.removeAttribute('aria-invalid');
        status.textContent = '';
        if (state.custom) { state.custom = null; refreshAfterSizeChange(); }
        return;
      }
      const result = deps.validateSize(type, input.value);
      input.setAttribute('aria-invalid', String(!result?.valid));
      status.textContent = result?.message || '';
      wrap.title = result?.valid ? '' : (result?.message || '');
      if (!result?.valid) {
        if (state.custom) { state.custom = null; refreshAfterSizeChange(); }
        return;
      }
      const facts = deps.sizeFacts(result.amountToMilliBb) || {};
      state.custom = {
        amountToMilliBb: result.amountToMilliBb,
        potShare: Number.isFinite(facts.potShare) ? facts.potShare : null,
        sprAfterCalled: Number.isFinite(facts.sprAfterCalled) ? facts.sprAfterCalled : null,
      };
      state.sizeIndex = -1;
      sizesEl.querySelectorAll('.rl-ladder__size').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      refreshAfterSizeChange();
      if (commit) submit();
    };
    listen(input, 'input', () => apply());
    listen(input, 'keydown', (event) => {
      if (event.key !== 'Enter' || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      apply({ commit: true });
    });
    return wrap;
  }

  function refreshAfterSizeChange() {
    refreshTicketTexts();
    updateConfirm();
  }

  function renderConfirm() {
    if (!confirmMount) return;
    if (!confirmButton) {
      confirmButton = components().createConfirmButton(doc, { label: t('Choose an action') });
      confirmButton.id = 'trainingFullHandConfirm';
      listen(confirmButton, 'click', () => submit());
      confirmMount.replaceChildren(confirmButton);
    }
    updateConfirm();
  }

  function confirmLabel() {
    const ticket = state.selected ? ticketOf(state.selected) : null;
    if (!ticket) return { label: t('Choose an action'), complete: false };
    const name = actionName(ticket.type);
    if (ticket.sized) {
      const size = currentSize();
      if (!size) return { label: t('Choose a size'), complete: false };
      return {
        label: t('Confirm {action} {amount}', { action: name, amount: amountText(size.amountToMilliBb) }),
        complete: true,
      };
    }
    return {
      label: ticket.amountMilliBb !== null && ticket.type !== 'fold'
        ? t('Confirm {action} {amount}', { action: name, amount: amountText(ticket.amountMilliBb) })
        : t('Confirm {action}', { action: name }),
      complete: true,
    };
  }

  function updateConfirm() {
    if (!confirmButton) return;
    const { label, complete } = confirmLabel();
    confirmButton.hidden = oneClick();
    components().updateConfirmButton(confirmButton, { label, disabled: !complete || !ready() });
    renderPrompt();
  }

  function renderPrompt() {
    if (!promptEl) return;
    const show = store()?.shouldPrompt() && ready() && sizesEl?.dataset.mode === 'hint';
    if (!show) { promptEl.replaceChildren(); return; }
    if (promptEl.childElementCount) return;
    const prompt = components().createAnswerModePrompt(doc, {
      text: t("Don't want to confirm?"),
      acceptLabel: t('Answer with one click'),
      keepLabel: t('Keep confirming'),
    });
    listen(prompt.querySelector('[data-answer-prompt="one_click"]'), 'click', () => {
      store().setMode('one_click', { fromPrompt: true });
      deps.toast?.(t('One click is on. Change it any time under Feel or in Settings.'));
    });
    listen(prompt.querySelector('[data-answer-prompt="keep"]'), 'click', () => store().dismissPrompt());
    promptEl.replaceChildren(prompt);
  }

  function choose(type) {
    if (!ready() || !ticketOf(type)) return;
    const ticket = ticketOf(type);
    state.selected = type;
    state.custom = null;
    state.sizeIndex = -1;
    state.sizes = ticket.sized ? projectFullHandSizes(deps.getSizingModel(), type) : [];
    components().selectActionCard(ticketsEl, type);
    refreshTicketTexts();
    renderSizes();
    updateConfirm();
    if (ticket.sized) {
      sizesEl?.querySelector('.rl-ladder__size')?.focus?.({ preventScroll: true });
    } else if (oneClick()) submit();
  }

  function chooseSize(index) {
    if (!ready() || !state.selected || !ticketOf(state.selected)?.sized) return;
    if (index < 0 || index >= state.sizes.length) return;
    state.sizeIndex = index;
    state.custom = null;
    components().selectLadderSize(sizesEl.querySelector('.rl-ladder'), index);
    refreshAfterSizeChange();
    if (oneClick()) submit();
  }

  function submit() {
    if (!ready() || !state.selected) return;
    const ticket = ticketOf(state.selected);
    const size = ticket?.sized ? currentSize() : null;
    if (!ticket || (ticket.sized && !size)) return;
    if (store()?.mode() === 'select') store().recordConfirm();
    if (confirmButton && !confirmButton.hidden) components().markConfirmed(confirmButton);
    deps.onSubmit(ticket.type, size ? size.amountToMilliBb : null);
  }

  /** Render the dock for the current Hero decision (call again after a language change). */
  function render() {
    if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
    const decision = deps.getDecision();
    if (!decision?.legalActions) { clear(); return; }
    const sameDecision = state.decisionId === decision.decisionId;
    state.decisionId = decision.decisionId;
    state.tickets = projectFullHandTickets(decision.legalActions);
    if (!sameDecision || !ticketOf(state.selected)) {
      state.selected = null; state.sizeIndex = -1; state.custom = null; state.sizes = [];
    } else if (ticketOf(state.selected)?.sized) {
      state.sizes = projectFullHandSizes(deps.getSizingModel(), state.selected);
    }
    renderTickets();
    renderSizes();
    if (confirmButton) components().markConfirmed(confirmButton, false);
    renderConfirm();
    container.dataset.fhState = 'decision';
  }

  function clear() {
    state.decisionId = null; state.tickets = []; state.selected = null;
    state.sizes = []; state.sizeIndex = -1; state.custom = null;
    ticketsEl?.replaceChildren();
    sizesEl?.replaceChildren();
    promptEl?.replaceChildren();
    if (confirmButton) components().markConfirmed(confirmButton, false);
    container.dataset.fhState = 'idle';
  }

  function lock(locked) {
    state.locked = Boolean(locked);
    container.dataset.fhLocked = String(state.locked);
    // While opponents act the tickets of the last decision would be stale: clear them.
    // Motion never delays poker truth (the answer is already recorded), but a pointer
    // confirm holds the closed-to-a-check button for a beat so moment 2 can be seen;
    // keyboard, Instant and Reduced motion clear at once (deps.confirmHoldMs() is 0).
    if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
    const hold = state.locked && state.decisionId !== null && confirmButton?.dataset.confirmed === 'true'
      ? Number(deps.confirmHoldMs?.() ?? 0) : 0;
    if (hold > 0) {
      container.dataset.fhState = 'confirming';
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!state.locked) return;
        clear();
        container.dataset.fhState = 'waiting';
      }, hold);
    } else if (state.locked && state.decisionId !== null) {
      clear();
      container.dataset.fhState = 'waiting';
    } else if (state.locked) container.dataset.fhState = 'waiting';
    ticketsEl?.querySelectorAll('button').forEach((button) => { button.disabled = state.locked; });
    sizesEl?.querySelectorAll('button, input').forEach((control) => { control.disabled = state.locked; });
    updateConfirm();
  }

  // DESIGN_SYSTEM keyboard contract: F fold, C check/call, B/R bet or raise,
  // A all-in, digits pick a size, Enter confirms. Keys never animate (the
  // shared data-motion-input rule drops transitions). Returns true when handled.
  function handleKey(event) {
    if (!ready() || !state.tickets.length) return false;
    const key = String(event.key || '').toLowerCase();
    const type = fullHandActionForKey(key, state.tickets.map((ticket) => ticket.type));
    if (type) { choose(type); return true; }
    if (/^[1-9]$/.test(event.key) && state.selected && ticketOf(state.selected)?.sized) {
      chooseSize(Number(event.key) - 1);
      return true;
    }
    if (event.key === 'Enter' && event.target?.tagName !== 'BUTTON' && confirmLabel().complete) {
      submit();
      return true;
    }
    if (event.key === 'Escape' && state.selected) {
      state.selected = null; state.sizeIndex = -1; state.custom = null; state.sizes = [];
      components().selectActionCard(ticketsEl, null);
      refreshTicketTexts();
      renderSizes();
      updateConfirm();
      return true;
    }
    return false;
  }

  function refreshLanguage() {
    if (state.decisionId === null) return;
    const selected = state.selected;
    const sizeIndex = state.sizeIndex;
    const custom = state.custom;
    render();
    if (selected && ticketOf(selected)) {
      state.selected = selected;
      state.sizes = ticketOf(selected).sized ? projectFullHandSizes(deps.getSizingModel(), selected) : [];
      state.sizeIndex = sizeIndex;
      state.custom = custom;
      renderTickets();
      renderSizes();
      updateConfirm();
    }
  }

  function setVisible(visible) {
    container.hidden = !visible;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (holdTimer !== null) { clearTimeout(holdTimer); holdTimer = null; }
    for (const { target, type, handler } of listeners.splice(0)) target.removeEventListener(type, handler);
    unsubscribe?.();
    unsubscribe = null;
  }

  unsubscribe = store()?.subscribe(() => { if (state.decisionId !== null) updateConfirm(); }) ?? null;

  return {
    dispose, refreshLanguage, handleKey, setVisible,
    render, clear, lock,
    selected: () => state.selected,
    selectedSize: () => currentSize(),
  };
}
