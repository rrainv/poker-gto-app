export const FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION =
  'full-hand-presentation-timing-policy/v1';
export const FULL_HAND_PRESENTATION_ORCHESTRATOR_RESULT_SCHEMA_VERSION =
  'full-hand-presentation-orchestrator-result/v1';

export const DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY = Object.freeze({
  schemaVersion: FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION,
  profile: 'normal',
  botThinkingMs: 750,
  chanceLeadMs: 180,
  actionSettleMs: 340,
  streetRevealMs: 600,
  reducedMotion: Object.freeze({
    botThinkingMs: 180,
    chanceLeadMs: 0,
    actionSettleMs: 0,
    streetRevealMs: 0,
  }),
});

const BOUNDARY_STATUSES = new Set(['awaiting_hero', 'terminal', 'error']);

function defaultWait(durationMs) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, durationMs));
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function requireTimingPolicy(policy) {
  if (policy?.schemaVersion !== FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION
    || policy.profile !== 'normal') {
    throw new TypeError(`Expected ${FULL_HAND_PRESENTATION_TIMING_POLICY_SCHEMA_VERSION}`);
  }
  for (const key of ['botThinkingMs', 'chanceLeadMs', 'actionSettleMs', 'streetRevealMs']) {
    if (!Number.isFinite(policy[key]) || policy[key] < 0
      || !Number.isFinite(policy.reducedMotion?.[key])
      || policy.reducedMotion[key] < 0) {
      throw new RangeError(`Full-Hand presentation timing ${key} must be nonnegative`);
    }
  }
  return policy;
}

function actorFromSnapshot(snapshot) {
  const actorId = snapshot?.state?.actingPlayerId;
  const actor = snapshot?.state?.players?.find((player) => player.playerId === actorId);
  if (!actor) return null;
  return Object.freeze({
    playerId: actor.playerId,
    seat: actor.seat,
    position: actor.position,
    isHero: actor.playerId === snapshot.heroPlayerId,
  });
}

export function createFullHandPresentationCue(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('A Full-Hand snapshot is required for a presentation cue');
  }
  if (snapshot.status === 'awaiting_hero') {
    return Object.freeze({ kind: 'hero_turn', actor: actorFromSnapshot(snapshot) });
  }
  if (snapshot.status === 'terminal') {
    return Object.freeze({ kind: 'hand_complete', actor: null });
  }
  if (snapshot.status === 'error') {
    return Object.freeze({ kind: 'error', actor: null });
  }
  if (snapshot.status !== 'advancing') {
    return Object.freeze({ kind: 'waiting', actor: actorFromSnapshot(snapshot) });
  }
  if (snapshot.state?.phase === 'betting') {
    const actor = actorFromSnapshot(snapshot);
    return Object.freeze({ kind: actor?.isHero ? 'hero_boundary' : 'bot_thinking', actor });
  }
  if (snapshot.state?.phase === 'terminal') {
    return Object.freeze({ kind: 'terminal_boundary', actor: null });
  }
  if (snapshot.state?.phase === 'chance') {
    return Object.freeze({
      kind: snapshot.state.pendingChance?.type === 'deal_hole'
        ? 'dealing_private_cards'
        : 'dealing_street',
      actor: null,
      pendingChanceType: snapshot.state.pendingChance?.type ?? null,
    });
  }
  if (snapshot.state?.phase === 'showdown') {
    return Object.freeze({ kind: 'resolving_showdown', actor: null });
  }
  return Object.freeze({ kind: 'waiting', actor: null });
}

export function createFullHandEventCue(event) {
  if (!event || typeof event !== 'object') return Object.freeze({ kind: 'waiting' });
  if (event.transitionKind === 'action') {
    return Object.freeze({
      kind: event.kind === 'hero_action' ? 'hero_action' : 'bot_action',
      actor: event.actor ?? null,
      chosenAction: event.chosenAction ?? null,
    });
  }
  const kind = {
    private_deal: 'private_cards_dealt',
    flop_deal: 'flop_dealt',
    turn_deal: 'turn_dealt',
    river_deal: 'river_dealt',
    private_reveal: 'showdown_cards_revealed',
    showdown_resolution: 'showdown_resolved',
  }[event.transitionKind] || 'waiting';
  return Object.freeze({ kind, actor: event.actor ?? null });
}

function timingValue(policy, reducedMotion, key) {
  return reducedMotion ? policy.reducedMotion[key] : policy[key];
}

function eventSettleDuration(policy, reducedMotion, event) {
  return timingValue(
    policy,
    reducedMotion,
    event?.transitionKind === 'action' ? 'actionSettleMs' : 'streetRevealMs',
  );
}

function result(status, epoch, snapshot = null) {
  return Object.freeze({
    schemaVersion: FULL_HAND_PRESENTATION_ORCHESTRATOR_RESULT_SCHEMA_VERSION,
    status,
    epoch,
    snapshot,
  });
}

/**
 * Paces presentation around one canonical automated transition at a time.
 * All poker mutations remain behind advanceOne(); callbacks receive immutable
 * snapshots and presentation facts only.
 */
export function createFullHandTrainingPresentationOrchestrator({
  getSnapshot,
  advanceOne,
  renderCue,
  renderTransition,
  renderBoundary,
  setInputLocked,
  wait = defaultWait,
  timingPolicy = DEFAULT_FULL_HAND_PRESENTATION_TIMING_POLICY,
  prefersReducedMotion = () => false,
} = {}) {
  requireFunction(getSnapshot, 'getSnapshot');
  requireFunction(advanceOne, 'advanceOne');
  requireFunction(renderCue, 'renderCue');
  requireFunction(renderTransition, 'renderTransition');
  requireFunction(renderBoundary, 'renderBoundary');
  requireFunction(setInputLocked, 'setInputLocked');
  requireFunction(wait, 'wait');
  requireFunction(prefersReducedMotion, 'prefersReducedMotion');
  const policy = requireTimingPolicy(timingPolicy);
  let epoch = 0;

  const controller = {
    invalidate() {
      epoch += 1;
      return epoch;
    },

    async run({ initialTransition = null } = {}) {
      const runEpoch = ++epoch;
      const reducedMotion = prefersReducedMotion() === true;
      const isCurrent = () => epoch === runEpoch;
      setInputLocked(true, { epoch: runEpoch, reducedMotion });

      if (initialTransition) {
        const currentSnapshot = getSnapshot();
        await Promise.resolve(renderTransition({
          cue: createFullHandEventCue(initialTransition.event),
          event: initialTransition.event,
          previousSnapshot: initialTransition.previousSnapshot,
          snapshot: currentSnapshot,
          motionEnabled: !reducedMotion,
          epoch: runEpoch,
        }));
        if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
        await wait(eventSettleDuration(policy, reducedMotion, initialTransition.event));
        if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
      }

      while (isCurrent()) {
        const snapshot = getSnapshot();
        const cue = createFullHandPresentationCue(snapshot);

        if (BOUNDARY_STATUSES.has(snapshot.status)) {
          await Promise.resolve(renderBoundary({
            cue,
            snapshot,
            motionEnabled: !reducedMotion,
            epoch: runEpoch,
          }));
          if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
          setInputLocked(snapshot.status !== 'awaiting_hero', {
            epoch: runEpoch,
            reducedMotion,
          });
          return result(snapshot.status, runEpoch, snapshot);
        }

        if (snapshot.status !== 'advancing') {
          return result('not_ready', runEpoch, snapshot);
        }

        await Promise.resolve(renderCue({ cue, snapshot, epoch: runEpoch }));
        if (!isCurrent()) return result('stale', runEpoch, getSnapshot());

        if (cue.kind === 'bot_thinking') {
          await wait(timingValue(policy, reducedMotion, 'botThinkingMs'));
          if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
        } else if (['dealing_private_cards', 'dealing_street', 'resolving_showdown']
          .includes(cue.kind)) {
          await wait(timingValue(policy, reducedMotion, 'chanceLeadMs'));
          if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
        }

        const previousSnapshot = snapshot;
        const step = await Promise.resolve(advanceOne());
        if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
        if (!step?.ok) {
          const failedSnapshot = step?.snapshot ?? getSnapshot();
          await Promise.resolve(renderBoundary({
            cue: createFullHandPresentationCue(failedSnapshot),
            snapshot: failedSnapshot,
            motionEnabled: false,
            epoch: runEpoch,
          }));
          return result('error', runEpoch, failedSnapshot);
        }

        if (step.event) {
          await Promise.resolve(renderTransition({
            cue: createFullHandEventCue(step.event),
            event: step.event,
            previousSnapshot,
            snapshot: step.snapshot,
            motionEnabled: !reducedMotion,
            epoch: runEpoch,
          }));
          if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
          await wait(eventSettleDuration(policy, reducedMotion, step.event));
          if (!isCurrent()) return result('stale', runEpoch, getSnapshot());
        }
      }

      return result('stale', runEpoch, getSnapshot());
    },
  };

  return Object.freeze(controller);
}
