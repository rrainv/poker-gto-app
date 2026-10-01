// `riverline:authchange` carries `detail.ownerKey`: the authentication status,
// signed-in flag and lifecycle identity/generation it describes. Presentation
// re-renders (language, theme) never publish. Consumers that clear private
// owner state use the guard below so a repeated publish for the same owner is
// not treated as an owner change. Events without an ownerKey (legacy/tests)
// always count as a change, so real fencing never weakens.
export function authenticationOwnerKey(state, lifecycle) {
  return JSON.stringify([
    state?.status ?? null,
    state?.status === 'signed_in' && Boolean(state?.profile),
    lifecycle?.status ?? null,
    lifecycle?.identityId ?? null,
    lifecycle?.lifecycleGeneration ?? null,
  ]);
}

export function createAuthenticationOwnerChangeGuard() {
  let lastOwnerKey;
  return function authenticationOwnerChanged(event) {
    const ownerKey = event?.detail?.ownerKey;
    if (typeof ownerKey === 'string' && ownerKey === lastOwnerKey) return false;
    lastOwnerKey = ownerKey;
    return true;
  };
}
