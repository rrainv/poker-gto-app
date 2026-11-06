// TRAINING-QUICK-001: shared drill components (P1-24). Built for Training
// first and meant for Home, Analyze and Review: action card + Confirm, the
// one-time "answer with one click" prompt, fact tile with derivation,
// source/tier label, verdict, mix bar, collapsible panel card, session dots
// and finish ring. Components take already-translated, already-formatted
// text: they never do poker maths and never parse numbers out of text.
// Motion lives in app/styles.css (data-motion="drill", tempo 0.7); keyboard
// input is instant through the shared data-motion-input rule.

export const DRILL_COMPONENTS_VERSION = 'riverline-drill-components/v1';
export const ANSWER_MODE_STORAGE_KEY = 'riverline_training_answer_mode';
export const ANSWER_MODES = Object.freeze(['select', 'one_click']);
// P1-03: the prompt appears after a few confirmed answers (two in the prototype).
export const ANSWER_MODE_PROMPT_AFTER = 2;
// Rows cope with any count: past this many decisions the dots become a count.
export const SESSION_DOTS_MAX = 20;
// Labels sit inside mix segments only when the segment can hold them.
export const MIX_LABEL_MIN_PERCENT = 15;

const SVG_NS = 'http://www.w3.org/2000/svg';

function h(doc, tag, attrs = {}, ...children) {
  const node = doc.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === false || value === null || value === undefined) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(typeof child === 'string' ? doc.createTextNode(child) : child);
  });
  return node;
}

function svg(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

let uid = 0;
function nextId(prefix) {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** A poker token kept left-to-right inside any text direction. */
export function pokerIsland(doc, text, className = '') {
  return h(doc, 'bdi', { dir: 'ltr', class: `poker-island ${className}`.trim(), text });
}

// ── Source / tier label (D-31) ─────────────────────────────────────────────
/** One combined label per surface: source + tier + scope ("Heuristic baseline · Estimated"). */
export function createSourceTierLabel(doc, { text, tier = 'estimated', reason = '' } = {}) {
  return h(doc, 'span', {
    class: 'rl-source-tier',
    'data-tier': tier,
    title: reason || null,
    text,
  });
}

// ── Fact tile with derivation ──────────────────────────────────────────────
/**
 * A number tile. The derivation shows on hover (fine pointer) and on keyboard
 * focus or tap; `locked` keeps the value hidden until the answer (Hard).
 */
export function createFactTile(doc, { value, label, derivation = '', locked = false, lockedText = '', name = '', scope = '' } = {}) {
  const derivationId = nextId('rl-fact-derivation');
  const tile = h(doc, 'div', {
    class: 'rl-fact-tile',
    'data-fact': name || null,
    'data-locked': locked ? 'true' : null,
    tabindex: derivation ? '0' : null,
    role: 'group',
    'aria-describedby': derivation ? derivationId : null,
  },
  h(doc, 'strong', { class: 'rl-fact-tile__value' }, locked ? lockedText : pokerIsland(doc, value)),
  h(doc, 'span', { class: 'rl-fact-tile__label', text: label }),
  // Scope tag ("Exact · price only"): what the number is based on (ANALYZE-001a).
  scope ? h(doc, 'span', { class: 'rl-fact-tile__scope', text: scope }) : null,
  derivation ? h(doc, 'span', { class: 'rl-fact-tile__derivation', id: derivationId, role: 'tooltip', text: derivation }) : null);
  tile.setAttribute('aria-label', `${label}: ${locked ? lockedText : value}`);
  return tile;
}

/**
 * Moment 4 (rolling digits): each character rolls in, 60 ms apart. The value
 * is set before any motion, so it is never stale.
 */
export function setRollingText(doc, element, text, { roll = true, plain = false } = {}) {
  const next = String(text);
  if (element.dataset.rollValue === next) return;
  const previous = element.dataset.rollValue;
  element.dataset.rollValue = next;
  if (!roll || previous === undefined) {
    element.replaceChildren(doc.createTextNode(next));
    return;
  }
  // `plain` keeps textContent equal to the value (no hidden duplicate for
  // assistive technology), for surfaces whose value is read back as text.
  element.replaceChildren(...[...next].map((character, index) => {
    const span = h(doc, 'span', { class: 'rl-roll-digit', text: character, 'aria-hidden': plain ? null : 'true' });
    span.style.setProperty('--rl-roll-index', String(index));
    return span;
  }), plain ? null : h(doc, 'span', { class: 'sr-only', text: next }));
}

// ── Action card + Confirm (P1-03) ──────────────────────────────────────────
export function createActionCard(doc, {
  type, kind = 'aggressive', name, amountText = '', detail = '', keyLabel = '', selected = false, ariaLabel = '',
} = {}) {
  // Moment 1: the accent border draws around the card (a conic sweep masked
  // to the card's own rounded border, so it follows the radius).
  const ring = h(doc, 'span', { class: 'rl-action-card__ring', 'aria-hidden': 'true' });
  const check = h(doc, 'span', { class: 'rl-action-card__check', 'aria-hidden': 'true' });
  const checkGlyph = svg(doc, 'svg', { viewBox: '0 0 24 24', focusable: 'false' });
  checkGlyph.append(svg(doc, 'path', { d: 'M5 12l5 5 9-10' }));
  check.append(checkGlyph);
  return h(doc, 'button', {
    type: 'button',
    class: 'rl-action-card',
    'data-action': type,
    'data-kind': kind,
    'aria-pressed': selected ? 'true' : 'false',
    'aria-keyshortcuts': keyLabel || null,
    'aria-label': ariaLabel || null,
  },
  ring,
  check,
  h(doc, 'span', { class: 'rl-action-card__name' },
    h(doc, 'span', { text: name }),
    keyLabel ? h(doc, 'kbd', { class: 'rl-key', text: keyLabel }) : null),
  h(doc, 'span', { class: 'rl-action-card__amount' }, amountText ? pokerIsland(doc, amountText) : ' '),
  h(doc, 'span', { class: 'rl-action-card__detail' }, detail ? pokerIsland(doc, detail) : ' '));
}

/** Select one card in a group; the others step back. */
export function selectActionCard(group, type) {
  group.dataset.hasSelection = type ? 'true' : 'false';
  group.querySelectorAll('.rl-action-card').forEach((card) => {
    card.setAttribute('aria-pressed', String(card.dataset.action === type));
  });
}

/** Size presets for raises (digits 1–n). Used where the size is part of the answer. */
export function createSizesRow(doc, { label, sizes = [], selectedIndex = -1 } = {}) {
  return h(doc, 'div', { class: 'rl-sizes', role: 'group', 'aria-label': label },
    h(doc, 'span', { class: 'rl-sizes__label', text: label }),
    sizes.map((size, index) => h(doc, 'button', {
      type: 'button',
      class: 'rl-size',
      'data-size-index': String(index),
      'aria-pressed': String(index === selectedIndex),
      'aria-keyshortcuts': String(index + 1),
    }, pokerIsland(doc, size), h(doc, 'kbd', { class: 'rl-key', text: String(index + 1) }))));
}

export function createConfirmButton(doc, { label, disabled = true } = {}) {
  return h(doc, 'button', {
    type: 'button',
    class: 'rl-confirm',
    'aria-keyshortcuts': 'Enter',
    disabled,
  }, h(doc, 'span', { class: 'rl-confirm__label', text: label }),
  h(doc, 'kbd', { class: 'rl-key rl-key--on-accent', text: 'Enter' }),
  confirmCheck(doc));
}

// Moment 2: on confirm the button closes to a round check (see .rl-confirm[data-confirmed]).
function confirmCheck(doc) {
  const check = h(doc, 'span', { class: 'rl-confirm__check', 'aria-hidden': 'true' });
  const glyph = svg(doc, 'svg', { viewBox: '0 0 24 24', focusable: 'false' });
  glyph.append(svg(doc, 'path', { d: 'M5 12l5 5 9-10' }));
  check.append(glyph);
  return check;
}

/** A changed label crossfades in (the swap attribute restarts the animation). */
export function updateConfirmButton(button, { label, disabled }) {
  button.disabled = disabled;
  const labelNode = button.querySelector('.rl-confirm__label');
  if (labelNode && labelNode.textContent !== label) {
    const changed = labelNode.textContent !== '';
    labelNode.textContent = label;
    if (changed) labelNode.dataset.swap = labelNode.dataset.swap === 'a' ? 'b' : 'a';
  }
}

/** Moment 2: the pointer path morphs Confirm into a round check. */
export function markConfirmed(button, confirmed = true) {
  if (confirmed) button.dataset.confirmed = 'true';
  else delete button.dataset.confirmed;
}

/** P1-03 one-time inline prompt: quiet, non-modal, never repeats once answered. */
export function createAnswerModePrompt(doc, { text, acceptLabel, keepLabel } = {}) {
  return h(doc, 'div', { class: 'rl-answer-prompt', role: 'group', 'aria-label': text },
    h(doc, 'span', { text }),
    h(doc, 'button', { type: 'button', class: 'rl-pill', 'data-answer-prompt': 'one_click', text: acceptLabel }),
    h(doc, 'button', { type: 'button', class: 'rl-pill', 'data-answer-prompt': 'keep', text: keepLabel }));
}

/**
 * The stored answer mode (Settings › Training). Select + confirm by default;
 * after ANSWER_MODE_PROMPT_AFTER confirmed answers the prompt is offered once.
 */
export function createAnswerModeStore({ storage = null, key = ANSWER_MODE_STORAGE_KEY } = {}) {
  let state = { mode: 'select', confirms: 0, promptAnswered: false };
  try {
    const parsed = JSON.parse(storage?.getItem?.(key) || 'null');
    if (parsed && typeof parsed === 'object') {
      state = {
        mode: ANSWER_MODES.includes(parsed.mode) ? parsed.mode : 'select',
        confirms: Number.isInteger(parsed.confirms) && parsed.confirms > 0 ? parsed.confirms : 0,
        promptAnswered: parsed.promptAnswered === true,
      };
    }
  } catch {
    // Unreadable storage keeps the defaults for this visit.
  }
  const listeners = new Set();
  const save = () => {
    try { storage?.setItem?.(key, JSON.stringify(state)); } catch { /* the choice still applies this visit */ }
    listeners.forEach((listener) => listener({ ...state }));
  };
  return Object.freeze({
    mode: () => state.mode,
    setMode(mode, { fromPrompt = false } = {}) {
      if (!ANSWER_MODES.includes(mode)) return;
      state = { ...state, mode, promptAnswered: state.promptAnswered || fromPrompt || mode === 'one_click' };
      save();
    },
    recordConfirm() {
      if (state.mode !== 'select') return;
      state = { ...state, confirms: state.confirms + 1 };
      save();
    },
    dismissPrompt() {
      state = { ...state, promptAnswered: true };
      save();
    },
    shouldPrompt: () => state.mode === 'select' && !state.promptAnswered && state.confirms >= ANSWER_MODE_PROMPT_AFTER,
    snapshot: () => ({ ...state }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}

// ── Verdict + mix bar (dominance rule, 5% rounding) ────────────────────────
/** Two states only: dominant (display size) or "A or B · close". */
export function createVerdict(doc, { kind, text } = {}) {
  return h(doc, 'p', { class: 'rl-verdict', 'data-verdict': kind || 'unavailable', text });
}

/**
 * A thick mix bar: action colours, labels inside segments that can hold them,
 * a "you" tick below the bar (never across a label). The bar is a
 * left-to-right data island in every language (P1-30).
 */
export function createMixBar(doc, { segments = [], youAtPercent = null, youLabel = '', ariaLabel = '' } = {}) {
  const bar = h(doc, 'div', { class: 'rl-mix', dir: 'ltr', role: 'img', 'aria-label': ariaLabel });
  segments.forEach((segment, index) => {
    const node = h(doc, 'span', {
      class: 'rl-mix__segment',
      'data-kind': segment.kind,
      title: segment.title || null,
    }, segment.value < MIX_LABEL_MIN_PERCENT ? ''
      // Name and share are isolated separately so either language reads in bar order.
      : segment.name && segment.valueText
        ? [h(doc, 'bdi', { text: segment.name }), ' ', pokerIsland(doc, segment.valueText)]
        : segment.label);
    node.style.setProperty('--rl-mix-share', `${segment.value}%`);
    node.style.setProperty('--rl-mix-index', String(index));
    bar.append(node);
  });
  if (Number.isFinite(youAtPercent)) {
    const tick = h(doc, 'div', { class: 'rl-mix__you', 'aria-hidden': 'true' }, h(doc, 'span', { text: youLabel }));
    tick.style.setProperty('--rl-you-at', `${youAtPercent}%`);
    bar.append(tick);
  }
  return bar;
}

// ── Collapsible panel card ─────────────────────────────────────────────────
export function createPanelCard(doc, { id, title, summary = '', open = false, locked = false, body = null } = {}) {
  const regionId = `${id}-body`;
  const toggle = h(doc, 'button', {
    type: 'button',
    class: 'rl-panel-card__toggle',
    'aria-expanded': String(open),
    'aria-controls': regionId,
  },
  h(doc, 'span', { class: 'rl-panel-card__title', text: title }),
  h(doc, 'span', { class: 'rl-panel-card__summary', text: summary }),
  h(doc, 'span', { class: 'rl-panel-card__chevron', 'aria-hidden': 'true' }));
  const region = h(doc, 'div', { class: 'rl-panel-card__body', id: regionId, role: 'region', 'aria-label': title, hidden: !open });
  if (body) region.append(body);
  const card = h(doc, 'section', {
    class: 'rl-panel-card',
    'data-panel': id,
    'data-open': String(open),
    'data-locked': locked ? 'true' : 'false',
  }, toggle, region);
  return card;
}

/**
 * Moment 7: opening grows the body to its content (rows fade in turn);
 * closing shrinks it, then hides it. Without motion (Instant, keyboard,
 * Reduced, or no layout engine) the body hides at once.
 */
export function setPanelCardOpen(card, open) {
  card.dataset.open = String(open);
  card.querySelector('.rl-panel-card__toggle')?.setAttribute('aria-expanded', String(open));
  const region = card.querySelector('.rl-panel-card__body');
  if (!region) return;
  card.classList.remove('is-closing');
  card.classList.toggle('is-opening', open);
  if (open) {
    region.hidden = false;
    return;
  }
  card.classList.add('is-closing');
  const view = card.ownerDocument?.defaultView;
  const seconds = parseFloat(view?.getComputedStyle?.(region)?.animationDuration || '0') || 0;
  const finish = () => {
    if (card.dataset.open === 'true') return;
    card.classList.remove('is-closing');
    region.hidden = true;
  };
  if (seconds <= 0.001 || region.hidden) {
    finish();
    return;
  }
  const onEnd = (event) => {
    if (event.target !== region) return;
    region.removeEventListener('animationend', onEnd);
    finish();
  };
  region.addEventListener('animationend', onEnd);
  view.setTimeout(finish, seconds * 1000 + 80);
}

// ── Session dots + finish ring (moment 11) ─────────────────────────────────
/**
 * One dot per decision: inside fills, outside turns into a brass square, the
 * current one is outlined. Long or open sessions show a count instead.
 */
export function createSessionDots(doc, { total = null, results = [], countText = '', ariaLabel = '' } = {}) {
  const bounded = Number.isInteger(total) && total > 0 && total <= SESSION_DOTS_MAX;
  const list = h(doc, 'ol', { class: 'rl-session-dots', 'aria-label': ariaLabel, 'data-variant': bounded ? 'dots' : 'count' });
  if (!bounded) {
    list.append(h(doc, 'li', { class: 'rl-session-dots__count' }, pokerIsland(doc, countText)));
    return list;
  }
  for (let index = 0; index < total; index += 1) {
    const result = results[index];
    list.append(h(doc, 'li', {
      class: 'rl-session-dot',
      'data-state': result === true ? 'inside' : result === false ? 'outside' : index === results.length ? 'current' : 'pending',
      'data-latest': index === results.length - 1 ? 'true' : null,
    }));
  }
  return list;
}

/** The finish ring: draws to the inside share and counts up (CSS @property). */
export function createFinishRing(doc, { inside = 0, total = 0, label = '' } = {}) {
  const share = total > 0 ? Math.round((inside / total) * 1000) / 10 : 0;
  const ring = svg(doc, 'svg', { class: 'rl-finish-ring__svg', viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false' });
  ring.append(
    svg(doc, 'circle', { class: 'rl-finish-ring__track', cx: '60', cy: '60', r: '48', pathLength: '100' }),
    svg(doc, 'circle', { class: 'rl-finish-ring__fill', cx: '60', cy: '60', r: '48', pathLength: '100', transform: 'rotate(-90 60 60)' }),
  );
  const node = h(doc, 'div', { class: 'rl-finish-ring', role: 'img', 'aria-label': label },
    ring,
    h(doc, 'span', { class: 'rl-finish-ring__count', dir: 'ltr', 'aria-hidden': 'true' },
      h(doc, 'span', { class: 'rl-finish-ring__inside' }),
      h(doc, 'span', { text: `/ ${total}` })));
  node.style.setProperty('--rl-ring-share', String(share));
  node.style.setProperty('--rl-ring-inside', String(inside));
  return node;
}
