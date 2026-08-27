import {
  createSupabaseAuthProviderAdapter,
  createSupabaseBrowserClient,
  resolveRiverlineAuthConfig,
} from '../authentication/index.mjs';
import './account-identity-bootstrap.mjs';
import { createSupabaseAccountProfileRepository } from '../account-profile/index.mjs';
import { createAuthenticationService } from './authentication-service.mjs';
import { createPersistentIdentityGate } from './persistent-identity-gate.mjs';

function translated(key) {
  return globalThis.t?.(key) ?? key;
}

function setTranslatedText(element, key) {
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = translated(key);
}

function authNoticeKey(state) {
  if (state.noticeCode === 'invalid_credentials') return 'Email or password is incorrect. For privacy, Riverline does not confirm whether an account exists.';
  if (state.noticeCode === 'signup_conflict') return 'An account could not be created with these details. Try signing in or use another email.';
  if (state.noticeCode === 'signup_failed') return 'Account creation failed. Check the details and try again.';
  if (state.noticeCode === 'provider_unavailable') return 'Sign-in is temporarily unavailable. Check the connection and try again.';
  if (state.noticeCode === 'session_expired') return 'Your sign-in session expired. Sign in again.';
  if (state.noticeCode === 'username_unavailable') return 'That username is unavailable.';
  if (state.noticeCode === 'invalid_profile') return 'Check the username and display name.';
  if (state.noticeCode === 'profile_identity_conflict') return 'This account is bound to a different Riverline identity. No local data was changed.';
  if (state.noticeCode === 'signout_incomplete') return 'Signed out locally, but the provider could not be reached.';
  if (state.noticeCode === 'link_failed') return 'Account linking failed. Your existing data was left untouched.';
  if (state.noticeCode === 'display_name_saved') return 'Display name saved.';
  const keys = {
    initializing: 'Checking authentication status…',
    authenticating: 'Signing in…',
    linking: 'Linking account safely…',
    signed_in: 'Signed in. Study data remains on this device.',
    guest: state.noticeCode === 'provider_not_configured'
      ? 'Guest Mode. Sign-in is unavailable until Supabase public configuration is added.'
      : 'Guest Mode. Study history is not saved.',
    confirmation_required: 'Check your email to confirm the account, then sign in.',
    authentication_failed: 'Authentication failed. Check the details and try again.',
    profile_setup_required: 'Complete the required profile to continue.',
    identity_conflict: 'Account identity conflict. No local data was changed.',
    link_required: 'Choose whether to claim existing data or start separately.',
  };
  return keys[state.status] ?? '';
}

function authNoticeIsError(state) {
  return state.status === 'authentication_failed'
    || state.status === 'identity_conflict'
    || ['invalid_credentials', 'signup_conflict', 'signup_failed', 'provider_unavailable',
      'session_expired', 'username_unavailable', 'invalid_profile', 'profile_identity_conflict',
      'signout_incomplete', 'link_failed'].includes(state.noticeCode);
}

function focusableIn(element) {
  return [...element.querySelectorAll(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )].filter((entry) => !entry.hidden && !entry.closest('[hidden]') && entry.getClientRects().length > 0);
}

function cloneLinkModal(browserWindow) {
  let modal = browserWindow.document.querySelector('#accountLinkModal');
  if (modal) return modal;
  const template = browserWindow.document.querySelector('#accountLinkModalTemplate');
  if (!template) return null;
  browserWindow.document.body.append(template.content.cloneNode(true));
  modal = browserWindow.document.querySelector('#accountLinkModal');
  browserWindow.RiverlineI18n?.translateNode?.(modal);
  return modal;
}

function initials(value) {
  const characters = [...String(value ?? '').trim()];
  return (characters[0] || 'G').toLocaleUpperCase();
}

function bindAuthenticationUi(browserWindow, service, gate) {
  const document = browserWindow.document;
  const accountModal = document.querySelector('#accountProfileModal');
  const linkModal = cloneLinkModal(browserWindow);
  const menuButton = document.querySelector('#accountMenuButton');
  const menu = document.querySelector('#accountMenu');
  const signInForm = document.querySelector('#accountSignInForm');
  const signUpForm = document.querySelector('#accountSignUpForm');
  const setupForm = document.querySelector('#accountProfileSetupForm');
  const profileForm = document.querySelector('#accountDisplayNameForm');
  let focusBeforeAccount = null;
  let focusBeforeLink = null;
  let openedForGate = false;

  function setAuthStatus(key, { error = false } = {}) {
    const status = document.querySelector('#accountAuthStatus');
    setTranslatedText(status, key);
    if (!status) return;
    status.dataset.tone = error ? 'error' : 'neutral';
    status.setAttribute('role', error ? 'alert' : 'status');
    status.setAttribute('aria-live', error ? 'assertive' : 'polite');
  }

  function closeMenu({ restoreFocus = false } = {}) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuButton?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) menuButton?.focus();
  }

  function openMenu() {
    if (!menu || !menuButton) return;
    menu.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
  }

  function openAccount({ forGate = false } = {}) {
    if (!accountModal) return;
    closeMenu();
    if (accountModal.hidden) focusBeforeAccount = document.activeElement;
    openedForGate ||= forGate;
    accountModal.hidden = false;
    accountModal.classList.add('show');
    document.body.classList.add('modal-open');
    browserWindow.RiverlineI18n?.translateNode?.(accountModal);
    browserWindow.requestAnimationFrame(() => {
      const state = service.getState();
      const target = state.status === 'signed_in'
        ? document.querySelector('#accountDisplayName')
        : state.status === 'profile_setup_required'
          ? document.querySelector('#accountSetupUsername')
          : document.querySelector('#accountSignInEmail');
      target?.focus();
    });
  }

  function closeAccount({ restoreFocus = true, cancelIntent = true } = {}) {
    if (!accountModal || accountModal.hidden) return;
    accountModal.classList.remove('show');
    accountModal.hidden = true;
    if (linkModal?.hidden !== false) document.body.classList.remove('modal-open');
    if (cancelIntent && openedForGate) gate.cancelPendingIntent();
    openedForGate = false;
    if (restoreFocus) focusBeforeAccount?.focus?.({ preventScroll: true });
    focusBeforeAccount = null;
  }

  function openLink(state) {
    if (!linkModal) return;
    linkModal.querySelector('#accountLinkEmail').textContent = state.email ?? '';
    linkModal.querySelector('#accountLinkCurrent').hidden = !state.canLinkCurrentLocalData;
    if (linkModal.hidden) {
      focusBeforeLink = document.activeElement;
      linkModal.hidden = false;
      linkModal.classList.add('show');
      document.body.classList.add('modal-open');
      browserWindow.requestAnimationFrame(() => focusableIn(linkModal)[0]?.focus());
    }
  }

  function closeLink({ restoreFocus = true } = {}) {
    if (!linkModal || linkModal.hidden) return;
    linkModal.classList.remove('show');
    linkModal.hidden = true;
    if (accountModal?.hidden !== false) document.body.classList.remove('modal-open');
    if (restoreFocus) focusBeforeLink?.focus?.({ preventScroll: true });
    focusBeforeLink = null;
  }

  async function cancelLink() {
    gate.cancelPendingIntent();
    await service.cancelPendingAuthentication();
    closeLink({ restoreFocus: false });
    closeAccount();
  }

  function setBusy(busy) {
    for (const control of accountModal?.querySelectorAll('button, input') ?? []) control.disabled = busy;
    for (const control of linkModal?.querySelectorAll('button') ?? []) control.disabled = busy;
  }

  function render(state) {
    const signedIn = state.status === 'signed_in' && Boolean(state.profile);
    const profile = state.profile;
    const displayName = profile?.displayName ?? translated('Guest');
    const username = profile ? `@${profile.username}` : translated('Not signed in');
    const busy = ['initializing', 'authenticating', 'linking'].includes(state.status);

    document.querySelector('#accountMenuAvatar').textContent = initials(displayName);
    document.querySelector('#accountMenuLabel').textContent = displayName;
    document.querySelector('#accountMenuDisplayName').textContent = signedIn ? displayName : translated('Guest Mode');
    document.querySelector('#accountMenuUsername').textContent = username;
    setTranslatedText(document.querySelector('#accountMenuOpenProfile'), signedIn ? 'Account / Profile' : 'Sign in or create account');
    document.querySelector('#accountMenuSwitch').hidden = !signedIn;
    document.querySelector('#accountMenuSignOut').hidden = !signedIn;

    const settings = document.querySelector('#settingsAccountProfile');
    settings?.setAttribute('aria-busy', String(busy));
    if (settings) settings.dataset.accountState = signedIn ? 'signed-in' : 'guest';
    setTranslatedText(document.querySelector('#settingsAccountKicker'), signedIn ? 'Signed in' : 'Guest Mode');
    document.querySelector('#settingsAccountName').textContent = displayName;
    setTranslatedText(document.querySelector('#settingsAccountBadge'), signedIn ? 'Signed in' : 'Not signed in');
    document.querySelector('#settingsAccountBadge')?.classList.toggle('status-badge--available', signedIn);
    document.querySelector('#settingsAccountBadge')?.classList.toggle('status-badge--neutral', !signedIn);
    setTranslatedText(
      document.querySelector('#settingsAccountDescription'),
      signedIn
        ? 'Study data is separated by this account on this device. Cloud sync is not enabled.'
        : 'Guest study history is not saved. Device settings remain available.',
    );

    document.querySelector('#accountGuestForms').hidden = signedIn || state.status === 'profile_setup_required';
    setupForm.hidden = state.status !== 'profile_setup_required';
    document.querySelector('#accountSignedInProfile').hidden = !signedIn;
    if (signedIn) {
      document.querySelector('#accountProfileDisplayName').textContent = profile.displayName;
      document.querySelector('#accountProfileUsername').textContent = `@${profile.username}`;
      document.querySelector('#accountProfileEmail').textContent = state.email ?? '';
      if (document.activeElement !== document.querySelector('#accountDisplayName')) {
        document.querySelector('#accountDisplayName').value = profile.displayName;
      }
    }
    setAuthStatus(authNoticeKey(state), { error: authNoticeIsError(state) });
    setBusy(busy);
    if (state.status === 'link_required') openLink(state);
    else if (state.status !== 'linking') closeLink({ restoreFocus: false });
    browserWindow.dispatchEvent(new CustomEvent('riverline:authchange', {
      detail: { status: state.status, signedIn },
    }));
  }

  signInForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!signInForm.reportValidity()) return;
    const password = document.querySelector('#accountSignInPassword');
    const credentials = {
      email: document.querySelector('#accountSignInEmail').value.trim(),
      password: password.value,
    };
    password.value = '';
    await service.signInWithPassword(credentials);
  });

  signUpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!signUpForm.reportValidity()) return;
    const password = document.querySelector('#accountSignUpPassword');
    const confirmation = document.querySelector('#accountSignUpPasswordConfirm');
    if (password.value !== confirmation?.value) {
      password.setAttribute('aria-invalid', 'true');
      confirmation?.setAttribute('aria-invalid', 'true');
      setAuthStatus('Passwords do not match.', { error: true });
      confirmation?.focus();
      return;
    }
    password.removeAttribute('aria-invalid');
    confirmation?.removeAttribute('aria-invalid');
    const credentials = {
      email: document.querySelector('#accountSignUpEmail').value.trim(),
      username: document.querySelector('#accountSignUpUsername').value,
      displayName: document.querySelector('#accountSignUpDisplayName').value,
      password: password.value,
    };
    password.value = '';
    if (confirmation) confirmation.value = '';
    await service.signUpWithPassword(credentials);
  });

  setupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!setupForm.reportValidity()) return;
    await service.completeProfileSetup({
      username: document.querySelector('#accountSetupUsername').value,
      displayName: document.querySelector('#accountSetupDisplayName').value,
    });
  });

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    try {
      await service.updateDisplayName(document.querySelector('#accountDisplayName').value);
    } catch (error) {
      setAuthStatus('Display name could not be saved.', { error: true });
    }
  });

  async function useAnotherAccount() {
    await service.signOut();
    openAccount();
    document.querySelector('#accountSignInEmail')?.focus();
  }

  menuButton?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  menuButton?.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openMenu();
    focusableIn(menu)[0]?.focus();
  });
  document.querySelector('#accountMenuOpenProfile')?.addEventListener('click', () => openAccount());
  document.querySelector('#accountMenuSwitch')?.addEventListener('click', () => void useAnotherAccount());
  document.querySelector('#accountMenuSignOut')?.addEventListener('click', () => void service.signOut());
  document.querySelector('#settingsOpenAccount')?.addEventListener('click', () => openAccount());
  document.querySelector('#homeGuestSignIn')?.addEventListener('click', () => openAccount());
  document.querySelector('#accountProfileClose')?.addEventListener('click', () => closeAccount());
  accountModal?.addEventListener('click', (event) => {
    if (event.target === accountModal) closeAccount();
  });
  document.querySelector('#accountSignOut')?.addEventListener('click', () => void service.signOut().then(() => closeAccount()));
  document.querySelector('#accountUseAnother')?.addEventListener('click', () => void useAnotherAccount());
  linkModal?.querySelector('#accountLinkCurrent')?.addEventListener('click', () => void service.linkCurrentLocalData());
  linkModal?.querySelector('#accountStartSeparate')?.addEventListener('click', () => void service.startSeparately());
  for (const selector of ['#accountLinkClose', '#accountLinkCancel']) {
    linkModal?.querySelector(selector)?.addEventListener('click', () => void cancelLink());
  }
  linkModal?.addEventListener('click', (event) => {
    if (event.target === linkModal) void cancelLink();
  });

  document.addEventListener('click', (event) => {
    if (!menu?.hidden && !document.querySelector('#accountHeaderControl')?.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (!linkModal?.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        void cancelLink();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = focusableIn(linkModal);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
      return;
    }
    if (!accountModal?.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAccount();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = focusableIn(accountModal);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
      return;
    }
    if (!menu?.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });

  browserWindow.addEventListener('riverline:openaccount', () => openAccount());
  browserWindow.addEventListener('riverline:languagechange', () => render(service.getState()));
  service.subscribe(render);
  gate.subscribe((gateState) => {
    if (gateState.status === 'required') openAccount({ forGate: true });
    if (openedForGate && gateState.status === 'idle' && service.getState().status === 'signed_in') {
      closeAccount({ cancelIntent: false });
    }
  });
  void service.initialize().then(render);
}

export async function installAuthenticationBridge(browserWindow, options = {}) {
  if (!browserWindow?.RiverlineAccountIdentity) return null;
  const config = options.config ?? await resolveRiverlineAuthConfig(browserWindow);
  let client = options.client ?? null;
  let providerAdapter = options.providerAdapter ?? null;
  let profileRepository = options.profileRepository ?? null;
  if (config && (!providerAdapter || !profileRepository)) {
    try {
      client ??= createSupabaseBrowserClient({ config, clientFactory: options.clientFactory });
      providerAdapter ??= createSupabaseAuthProviderAdapter({ config, client });
      profileRepository ??= createSupabaseAccountProfileRepository({ client });
    } catch {
      providerAdapter = null;
      profileRepository = null;
    }
  }
  const service = options.service ?? createAuthenticationService({
    accountIdentity: options.accountIdentity ?? browserWindow.RiverlineAccountIdentity,
    providerAdapter,
    profileRepository,
  });
  const gate = options.persistentIdentityGate ?? createPersistentIdentityGate({ authentication: service });
  const initialization = service.initialize();
  const bridge = Object.freeze({
    schemaVersion: 'riverline-authentication-bridge/v2',
    ready: () => initialization,
    getState: () => service.getState(),
    getKnownIdentities: () => service.getKnownIdentities(),
    signInWithPassword: (credentials) => service.signInWithPassword(credentials),
    signUpWithPassword: (credentials) => service.signUpWithPassword(credentials),
    completeProfileSetup: (profile) => service.completeProfileSetup(profile),
    linkCurrentLocalData: () => service.linkCurrentLocalData(),
    startSeparately: () => service.startSeparately(),
    updateDisplayName: (value) => service.updateDisplayName(value),
    cancelPendingAuthentication: () => service.cancelPendingAuthentication(),
    signOut: () => service.signOut(),
    switchToGuest: () => service.switchToGuest(),
    subscribe: (listener) => service.subscribe(listener),
    openAccount: () => browserWindow.dispatchEvent(new CustomEvent('riverline:openaccount')),
  });
  Object.defineProperty(browserWindow, 'RiverlineAuthentication', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  Object.defineProperty(browserWindow, 'RiverlinePersistentIdentity', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: 'riverline-persistent-identity-gate/v1',
      requirePersistentIdentity: (request) => gate.requirePersistentIdentity(request),
      getState: () => gate.getState(),
      cancelPendingIntent: () => gate.cancelPendingIntent(),
      subscribe: (listener) => gate.subscribe(listener),
    }),
    writable: false,
  });
  browserWindow.RiverlineAccountIdentity.subscribe(({ identity, reason }) => {
    browserWindow.dispatchEvent(new CustomEvent('riverline:identitychange', {
      detail: { identityId: identity.identityId, reason },
    }));
  });
  const bind = () => bindAuthenticationUi(browserWindow, service, gate);
  if (browserWindow.document.readyState === 'loading') {
    browserWindow.document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else bind();
  return bridge;
}

if (typeof window !== 'undefined') await installAuthenticationBridge(window);
