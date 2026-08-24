export const RIVERLINE_MOTION_SCHEMA_VERSION = 'riverline-motion/v1';

export const RIVERLINE_MOTION_DURATIONS = Object.freeze({
  instant: 0,
  fast: 110,
  normal: 170,
  poker_settle: 240,
});

const INTENT_BY_EVENT_TYPE = Object.freeze({
  card_dealt: Object.freeze({ kind: 'card_deal', duration: 'poker_settle', travel: true }),
  board_revealed: Object.freeze({ kind: 'board_reveal', duration: 'poker_settle', travel: true }),
  hole_cards_revealed: Object.freeze({ kind: 'card_reveal', duration: 'normal', travel: false }),
  action_fold: Object.freeze({ kind: 'fold_retreat', duration: 'fast', travel: true }),
  action_check: Object.freeze({ kind: 'action_settle', duration: 'fast', travel: false }),
  action_call: Object.freeze({ kind: 'action_settle', duration: 'normal', travel: false }),
  action_bet: Object.freeze({ kind: 'action_settle', duration: 'normal', travel: false }),
  action_raise: Object.freeze({ kind: 'action_settle', duration: 'poker_settle', travel: false }),
  action_all_in: Object.freeze({ kind: 'action_settle', duration: 'poker_settle', travel: false }),
  chips_committed: Object.freeze({ kind: 'chips_commit', duration: 'poker_settle', travel: true }),
  pot_collected: Object.freeze({ kind: 'pot_collect', duration: 'poker_settle', travel: true }),
  pot_awarded: Object.freeze({ kind: 'pot_award', duration: 'poker_settle', travel: true }),
  actor_changed: Object.freeze({ kind: 'actor_transition', duration: 'normal', travel: false }),
  street_advanced: Object.freeze({ kind: 'street_advance', duration: 'normal', travel: false }),
  showdown_started: Object.freeze({ kind: 'showdown_settle', duration: 'normal', travel: false }),
  hand_completed: Object.freeze({ kind: 'hand_complete', duration: 'normal', travel: false }),
  review_decision_selected: Object.freeze({ kind: 'review_selection', duration: 'fast', travel: false }),
});

function frozenIntent(event, intent, reducedMotion) {
  const duration = reducedMotion ? 'instant' : intent.duration;
  return Object.freeze({
    schemaVersion: RIVERLINE_MOTION_SCHEMA_VERSION,
    eventId: event.eventId,
    active: reducedMotion ? intent.travel !== true : true,
    kind: intent.kind,
    duration,
    durationMs: RIVERLINE_MOTION_DURATIONS[duration],
    travel: reducedMotion ? false : intent.travel,
  });
}

export function motionIntentForExperienceEvent(event, { reducedMotion = false } = {}) {
  if (event?.schemaVersion !== 'experience-event/v1') {
    throw new TypeError('Riverline motion requires experience-event/v1');
  }
  const intent = INTENT_BY_EVENT_TYPE[event.type];
  if (!intent) {
    return Object.freeze({
      schemaVersion: RIVERLINE_MOTION_SCHEMA_VERSION,
      eventId: event.eventId,
      active: false,
      kind: 'none',
      duration: 'instant',
      durationMs: 0,
      travel: false,
    });
  }
  return frozenIntent(event, intent, reducedMotion === true);
}

