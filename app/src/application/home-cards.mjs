// HOME-001: the pure decisions behind the Home card grid. No DOM, no poker
// maths: given the Home view model it says which cards show, in which column,
// what the session plan contains and which "noticed" items pass the sample
// gates. home-workspace.mjs renders the result.
//
// Rules (docs/design/decisions/OWNER_DECISIONS.md, HOME RULES):
//  - at most 6 cards, adaptive slot merging (a card with nothing to show is
//    left out, never a blank placeholder);
//  - plan-vs-played shows from n >= 8 hands, drift against a mixed baseline
//    from n >= 20; below the gate the honest empty state shows instead;
//  - nothing due is said plainly, never invented work.

export const HOME_CARD_LIMIT = 6;
export const HOME_SESSION_STEP_LIMIT = 3;
export const HOME_NOTICED_LIMIT = 2;
export const HOME_PLAN_VS_PLAYED_MIN_HANDS = 8;
export const HOME_DRIFT_MIN_HANDS = 20;

// Presentation tiers for "how many hands is this based on". Below the gate
// nothing shows, so the lowest tier starts at the plan-vs-played gate.
export function homeSampleTier(hands) {
  if (!Number.isInteger(hands) || hands < HOME_PLAN_VS_PLAYED_MIN_HANDS) return null;
  if (hands < 15) return 'small';
  if (hands < 30) return 'medium';
  return 'large';
}

function passesGate(item) {
  if (!item || typeof item !== 'object') return false;
  const hands = item.sampleSize;
  if (!Number.isInteger(hands)) return false;
  if (item.kind === 'plan_vs_played') return hands >= HOME_PLAN_VS_PLAYED_MIN_HANDS;
  if (item.kind === 'drift') return hands >= HOME_DRIFT_MIN_HANDS && item.baseline === 'mixed';
  return false;
}

// Played hands only: an item from drills, reviews or any other source never
// passes, whatever its size.
export function selectNoticedItems(section) {
  if (section?.status !== 'ready' || !Array.isArray(section.items)) return [];
  return section.items
    .filter((item) => item.source === 'played_hands' && passesGate(item))
    .slice(0, HOME_NOTICED_LIMIT);
}

function listItems(section) {
  return section?.status !== 'error' && Array.isArray(section?.items) ? section.items : [];
}

function sectionFailed(section) {
  return section?.status === 'error';
}

export function homeNightIsShown(model) {
  const night = model?.sections?.nightAfter;
  return night?.status === 'ready' && Boolean(night.night);
}

// First visit: there is nothing of the person's own to show yet.
export function homeVisitState(model) {
  const sections = model?.sections ?? {};
  if (listItems(sections.continue).length > 0) return 'returning';
  if (listItems(sections.recent).length > 0) return 'returning';
  if (listItems(sections.review?.reviewLater).length > 0) return 'returning';
  if (listItems(sections.review?.mistakes).length > 0) return 'returning';
  if (sectionFailed(sections.recent) || sectionFailed(sections.review?.reviewLater)
    || sectionFailed(sections.review?.mistakes)) return 'returning';
  if (homeNightIsShown(model)) return 'returning';
  if (sections.personalStrategy?.status === 'ready' && sections.personalStrategy.answeredCount > 0) return 'returning';
  return 'first_visit';
}

// The session plan is built only from things that exist: items the person
// marked for another look, then a quick drill as the always-available step.
export function deriveSessionPlan(model) {
  const sections = model?.sections ?? {};
  const steps = [];
  for (const item of listItems(sections.review?.reviewLater)) {
    if (steps.length >= HOME_SESSION_STEP_LIMIT - 1) break;
    steps.push({ id: `review:${item.id}`, kind: 'review_later', savedId: item.id, itemKind: item.kind, item });
  }
  for (const item of listItems(sections.review?.mistakes)) {
    if (steps.length >= HOME_SESSION_STEP_LIMIT - 1) break;
    if (steps.some((step) => step.savedId === item.id)) continue;
    steps.push({ id: `review:${item.id}`, kind: 'marked', savedId: item.id, itemKind: item.kind, item });
  }
  const failed = sectionFailed(sections.review?.reviewLater) || sectionFailed(sections.review?.mistakes);
  if (failed) {
    return Object.freeze({ state: 'unavailable', dueCount: 0, steps: Object.freeze([{ id: 'practice', kind: 'practice', destination: 'training' }]) });
  }
  const dueCount = steps.length;
  steps.push({ id: 'practice', kind: 'practice', destination: 'training' });
  return Object.freeze({
    state: dueCount > 0 ? 'steps' : 'nothing_due',
    dueCount,
    steps: Object.freeze(steps),
  });
}

// Layout estimate in CSS pixels at the 1920 reference (head, padding and the
// fixed row heights of home-workspace.mjs). Only used to split the cards into
// two columns of about equal height; the real heights come from the DOM.
const ROW_PX = 56;
function estimateCardHeight(id, model, state) {
  const sections = model?.sections ?? {};
  switch (id) {
    case 'welcome': return 176;
    case 'continue': return 120 + 70 * Math.max(1, listItems(sections.continue).length);
    case 'session': {
      if (state === 'first_visit') return 265;
      const plan = deriveSessionPlan(model);
      return plan.state === 'steps' ? 130 + ROW_PX * plan.steps.length + 50 : 170;
    }
    case 'night': return state === 'first_visit' || !homeNightIsShown(model) ? 170 : 259;
    case 'noticed': {
      const shown = selectNoticedItems(sections.noticed).length;
      return shown === 0 ? 150 : 90 + 110 * shown;
    }
    case 'review': {
      const rows = Math.min(3, new Set([
        ...listItems(sections.review?.reviewLater), ...listItems(sections.review?.mistakes),
      ].map((item) => item.id)).size);
      return 100 + ROW_PX * Math.max(1, rows);
    }
    case 'recent': return 90 + ROW_PX * Math.max(1, Math.min(5, listItems(sections.recent).length));
    default: return 200;
  }
}

// Which cards show and where. The lead card opens the start column. The rest
// are split so the two columns end about together; among equally balanced
// splits the one closest to reading order (start column first) wins.
export function planHomeCards(model) {
  const sections = model?.sections ?? {};
  const state = homeVisitState(model);
  const order = [];
  if (state === 'first_visit') {
    order.push('welcome', 'session', 'night', 'noticed');
  } else {
    if (listItems(sections.continue).length > 0) order.push('continue');
    order.push('session');
    if (homeNightIsShown(model)) order.push('night');
    order.push('noticed');
    const reviewShown = listItems(sections.review?.reviewLater).length > 0
      || listItems(sections.review?.mistakes).length > 0
      || sectionFailed(sections.review?.reviewLater) || sectionFailed(sections.review?.mistakes);
    if (reviewShown) order.push('review');
    const recentShown = listItems(sections.recent).length > 0 || sectionFailed(sections.recent);
    if (recentShown) order.push('recent');
  }
  const cards = order.slice(0, HOME_CARD_LIMIT);
  const height = cards.map((id) => estimateCardHeight(id, model, state));
  const total = height.reduce((sum, value) => sum + value, 0);
  let best = null;
  for (let mask = 1; mask < (1 << cards.length); mask += 1) {
    if (!(mask & 1)) continue; // the first card always opens the start column
    if (mask === (1 << cards.length) - 1) continue; // never leave the end column empty
    const startHeight = height.reduce((sum, value, index) => sum + ((mask >> index) & 1 ? value : 0), 0);
    const diff = Math.abs(total - 2 * startHeight);
    // Ties: prefer more cards early (closer to reading order).
    if (!best || diff < best.diff - 1 || (Math.abs(diff - best.diff) <= 1 && mask > best.mask)) best = { mask, diff };
  }
  const startMask = best?.mask ?? 1;
  const start = cards.filter((_, index) => (startMask >> index) & 1);
  const end = cards.filter((_, index) => !((startMask >> index) & 1));
  return Object.freeze({ state, cards: Object.freeze(cards), start: Object.freeze(start), end: Object.freeze(end) });
}

// 'morning' 05-11, 'afternoon' 12-17, 'evening' otherwise.
export function homeGreetingPart(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}
