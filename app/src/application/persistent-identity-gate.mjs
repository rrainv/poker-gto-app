export const PERSISTENT_IDENTITY_GATE_STATE_SCHEMA_VERSION = 'riverline-persistent-identity-gate-state/v1';

export class PersistentIdentityRequiredError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PersistentIdentityRequiredError';
    this.code = code;
  }
}

function persistentIdentityFailure(code, message) {
  return new PersistentIdentityRequiredError(code, message);
}

export function createPersistentIdentityGate({ authentication } = {}) {
  if (!authentication?.ready || !authentication?.getState || !authentication?.subscribe) {
    throw new TypeError('PersistentIdentityGate requires the authentication service');
  }
  const listeners = new Set();
  let pending = null;
  let state = Object.freeze({
    schemaVersion: PERSISTENT_IDENTITY_GATE_STATE_SCHEMA_VERSION,
    status: 'idle',
    intent: null,
    noticeCode: null,
  });

  function publish(changes) {
    state = Object.freeze({ ...state, ...changes });
    for (const listener of listeners) listener(state);
    return state;
  }

  async function resumePending() {
    if (!pending || authentication.getState().status !== 'signed_in') return;
    const request = pending;
    pending = null;
    publish({ status: 'resuming', intent: request.intent, noticeCode: null });
    try {
      const result = await request.resumeAction();
      publish({ status: 'idle', intent: null, noticeCode: null });
      request.resolve(result);
    } catch (error) {
      publish({ status: 'idle', intent: null, noticeCode: error?.code ?? 'resume_failed' });
      request.reject(error);
    }
  }

  authentication.subscribe((next) => {
    if (pending && (next.status === 'recovery_required'
      || (next.status === 'guest' && ['authentication_cancelled', 'signed_out', 'signout_incomplete'].includes(next.noticeCode)))) {
      const request = pending;
      pending = null;
      publish({ status: 'idle', intent: null, noticeCode: 'persistent_identity_cancelled' });
      request.reject(persistentIdentityFailure('persistent_identity_cancelled', 'The pending account action was cancelled.'));
    }
    void resumePending();
  });

  async function requirePersistentIdentity({ intent, resumeAction } = {}) {
    if (typeof intent !== 'string' || !intent.trim()) {
      throw new TypeError('Persistent identity intent is required');
    }
    if (typeof resumeAction !== 'function') {
      throw new TypeError('Persistent identity resumeAction must be a function');
    }
    await authentication.ready();
    if (authentication.getState().status === 'signed_in') return resumeAction();
    if (pending) {
      throw persistentIdentityFailure(
        'persistent_identity_busy',
        'Another account-required action is already waiting for sign-in.',
      );
    }
    return new Promise((resolve, reject) => {
      pending = { intent: intent.trim(), resumeAction, resolve, reject };
      publish({ status: 'required', intent: intent.trim(), noticeCode: null });
    });
  }

  return Object.freeze({
    requirePersistentIdentity,
    getState: () => state,
    hasPendingIntent: () => pending !== null,
    cancelPendingIntent() {
      if (!pending) return false;
      const request = pending;
      pending = null;
      publish({ status: 'idle', intent: null, noticeCode: 'persistent_identity_cancelled' });
      request.reject(persistentIdentityFailure(
        'persistent_identity_cancelled',
        'The account-required action was cancelled before anything was saved.',
      ));
      return true;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Gate listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
