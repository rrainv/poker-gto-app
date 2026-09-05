import { validateRiverlineIdentity, validateRiverlineDomainOwnershipBinding } from './domain.mjs';
import { validateProviderIdentityMapping } from '../authentication/domain.mjs';

export const LIFECYCLE_TRANSITION_SCHEMA_VERSION = 'riverline-identity-transition/v1';
export const transitionIsActive = (value) => !['locally_finalized', 'cancelled'].includes(value.phase);

// Reservations are account-registry records only, never domain data or credentials.
export function validateLifecycleTransition(value) {
  if (!value || value.schemaVersion !== LIFECYCLE_TRANSITION_SCHEMA_VERSION
    || typeof value.transitionId !== 'string' || !value.transitionId
    || !['move', 'keep_separate'].includes(value.choice)
    || !['prepared', 'binding_remote', 'remote_bound', 'locally_finalized', 'recovery_required', 'cancelled'].includes(value.phase)
    || !Number.isSafeInteger(value.generation) || value.generation < 0) {
    throw new TypeError('Invalid lifecycle transition journal');
  }
  const keys = ['schemaVersion', 'transitionId', 'choice', 'phase', 'generation', 'guest', 'guestBindings', 'account', 'replacement', 'mapping'];
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.sort())) {
    throw new TypeError('Unsupported lifecycle transition fields');
  }
  validateProviderIdentityMapping(value.mapping);
  validateRiverlineIdentity(value.guest);
  validateRiverlineIdentity(value.account.identity);
  if (value.guest.kind !== 'device_guest' || value.account.identity.kind !== 'authenticated_account'
    || value.mapping.riverlineIdentityId !== value.account.identity.identityId
    || value.account.identity.localDeviceIdentityId !== value.guest.localDeviceIdentityId
    || !Array.isArray(value.guestBindings) || value.guestBindings.length !== 3
    || !Array.isArray(value.account.bindings) || value.account.bindings.length !== 3) {
    throw new TypeError('Inconsistent lifecycle identity reservation');
  }
  value.guestBindings.forEach(validateRiverlineDomainOwnershipBinding);
  value.account.bindings.forEach(validateRiverlineDomainOwnershipBinding);
  if (value.choice === 'move') {
    if (value.account.identity.identityId !== value.guest.identityId || !value.replacement) {
      throw new TypeError('Promotion must preserve the Guest identity');
    }
    validateRiverlineIdentity(value.replacement.identity);
    if (value.replacement.identity.kind !== 'device_guest'
      || value.replacement.identity.identityId === value.guest.identityId
      || value.replacement.identity.localDeviceIdentityId !== value.guest.localDeviceIdentityId) {
      throw new TypeError('Invalid replacement Guest');
    }
    if (!Array.isArray(value.replacement.bindings) || value.replacement.bindings.length !== 3) {
      throw new TypeError('Replacement Guest requires every domain binding');
    }
    value.replacement.bindings.forEach(validateRiverlineDomainOwnershipBinding);
    for (const before of value.guestBindings) {
      const after = value.account.bindings.find((binding) => binding.domain === before.domain);
      if (!after || before.bindingId !== after.bindingId
        || before.domainOwnerId !== after.domainOwnerId || before.storageScope !== after.storageScope
        || JSON.stringify(before.domainOwnerRef) !== JSON.stringify(after.domainOwnerRef)) {
        throw new TypeError('Promotion cannot change domain storage ownership');
      }
    }
  } else if (value.replacement !== null || value.account.identity.identityId === value.guest.identityId) {
    throw new TypeError('Keep Separate requires a distinct account');
  }
  return value;
}
