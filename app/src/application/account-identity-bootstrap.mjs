import { RIVERLINE_DISPLAY_NAME_MAX_LENGTH } from '../account-identity/index.mjs';
import { createAccountIdentityService } from './account-identity-service.mjs';

function translated(key) {
  return globalThis.t?.(key) ?? key;
}

function setText(element, key) {
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = translated(key);
}

function bindAccountProfileUi(browserWindow, service, initialization) {
  const root = browserWindow.document?.querySelector('#settingsAccountProfile');
  if (!root) return;
  const form = root.querySelector('#accountDisplayNameForm');
  const input = root.querySelector('#accountDisplayName');
  const preview = root.querySelector('#accountDisplayNamePreview');
  const submit = root.querySelector('#accountDisplayNameSubmit');
  const status = root.querySelector('#accountProfileStatus');

  root.setAttribute('aria-busy', 'true');
  setText(status, 'Loading local profile…');

  initialization.then(async () => {
    const identity = await service.getActiveIdentity();
    input.value = identity.displayName;
    preview.textContent = identity.displayName;
    root.dataset.accountState = 'ready';
    root.setAttribute('aria-busy', 'false');
    status.textContent = '';
    status.removeAttribute('data-i18n');
  }).catch(() => {
    root.dataset.accountState = 'error';
    root.setAttribute('aria-busy', 'false');
    input.disabled = true;
    submit.disabled = true;
    setText(status, 'Local profile storage is unavailable. Your existing study data was left untouched.');
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    input.setAttribute('aria-invalid', 'false');
    setText(status, 'Saving…');
    try {
      const identity = await service.setDisplayName(input.value);
      input.value = identity.displayName;
      preview.textContent = identity.displayName;
      setText(status, 'Display name saved.');
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) {
        input.setAttribute('aria-invalid', 'true');
        setText(status, `Enter a display name from 1 to ${RIVERLINE_DISPLAY_NAME_MAX_LENGTH} characters.`);
        input.focus();
      } else {
        setText(status, 'Local profile storage is unavailable. Your existing study data was left untouched.');
      }
    } finally {
      submit.disabled = false;
    }
  });
}

export function installAccountIdentityBridge(browserWindow, options = {}) {
  if (!browserWindow) return null;
  const service = options.service ?? createAccountIdentityService({
    storage: options.storage,
    database: options.database,
    clock: options.clock,
    idFactory: options.idFactory,
    defaultDisplayName: options.defaultDisplayName,
  });
  const initialization = service.initialize();
  const bridge = Object.freeze({
    schemaVersion: 'riverline-account-bridge/v2',
    initialize: () => initialization,
    ensureDeviceGuestIdentity: () => service.ensureDeviceGuestIdentity(),
    ensureLocalIdentity: () => service.ensureLocalIdentity(),
    getActiveIdentity: () => service.getActiveIdentity(),
    getActiveIdentityId: () => service.getActiveIdentityId(),
    getLifecycleState: () => service.getLifecycleState(),
    captureLifecycleScope: (domain) => service.captureLifecycleScope(domain),
    isCurrentLifecycleScope: (scope) => service.isCurrentLifecycleScope(scope),
    assertCurrentLifecycleScope: (scope) => service.assertCurrentLifecycleScope(scope),
    getProfileSummary: () => service.getProfileSummary(),
    listKnownIdentities: () => service.listKnownIdentities(),
    reserveIdentityId: () => service.reserveIdentityId(),
    getDomainOwnership: (domain) => service.getDomainOwnership(domain),
    getProviderIdentityMapping: (providerIdentity) => service.getProviderIdentityMapping(providerIdentity),
    activateProviderIdentity: (providerIdentity) => service.activateProviderIdentity(providerIdentity),
    getPendingLifecycleTransition: () => service.getPendingLifecycleTransition(),
    runFirstSignInTransition: (provider, options) => service.runFirstSignInTransition(provider, options),
    requireRecovery: (error) => service.requireRecovery(error),
    setDisplayName: (value) => service.setDisplayName(value),
    activateDeviceGuest: () => service.activateDeviceGuest(),
    activateLocalIdentity: () => service.activateLocalIdentity(),
    subscribe: (listener) => service.subscribe(listener),
  });
  Object.defineProperty(browserWindow, 'RiverlineAccountIdentity', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installAccountIdentityBridge(window);
