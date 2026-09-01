import {
  AUTH_PROVIDER_NAMES,
  createAuthProviderIdentity,
} from './domain.mjs';

export class AuthProviderError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AuthProviderError';
    this.code = code;
  }
}

function providerFailure(code, message, cause = null) {
  return new AuthProviderError(code, message, cause);
}

function normalizedTimestamp(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Authentication clock returned an invalid date');
  return date.toISOString();
}

function decodeJwtRole(value) {
  if (typeof value !== 'string' || value.split('.').length !== 3) return null;
  try {
    const payload = value.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded)).role ?? null;
  } catch {
    return null;
  }
}

export function normalizeSupabasePublicConfiguration(config) {
  if (!config || typeof config !== 'object') throw new TypeError('Supabase public configuration is required');
  let url;
  try { url = new URL(config.supabaseUrl); } catch { throw new TypeError('Supabase URL is invalid'); }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) throw new TypeError('Supabase URL must use HTTPS outside local development');
  if (typeof config.supabasePublishableKey !== 'string' || !config.supabasePublishableKey.trim()) {
    throw new TypeError('Supabase publishable key is required');
  }
  const publishableKey = config.supabasePublishableKey.trim();
  if (/^sb_secret_/i.test(publishableKey) || decodeJwtRole(publishableKey) === 'service_role') {
    throw new TypeError('A Supabase service-role secret must never be used in Riverline');
  }
  return Object.freeze({
    supabaseUrl: url.origin,
    supabasePublishableKey: publishableKey,
    providerTenantId: url.origin,
  });
}

export function createSupabaseBrowserClientDefinition(config) {
  const configuration = normalizeSupabasePublicConfiguration(config);
  const storageSuffix = configuration.providerTenantId.replace(/[^A-Za-z0-9._-]/g, '_');
  const options = Object.freeze({
    auth: Object.freeze({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: `riverline.auth.supabase.${storageSuffix}.v1`,
    }),
  });
  return Object.freeze({
    configuration,
    options,
    identity: JSON.stringify({
      supabaseUrl: configuration.supabaseUrl,
      supabasePublishableKey: configuration.supabasePublishableKey,
      auth: options.auth,
    }),
  });
}

function timeout(promise, timeoutMs) {
  let timeoutId;
  const expiry = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(providerFailure(
      'provider_unavailable',
      'The authentication provider did not respond in time.',
    )), timeoutMs);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timeoutId));
}

function errorCode(error, fallback = 'authentication_failed') {
  const message = String(error?.message || '');
  if (fallback === 'authentication_failed'
    && (error?.status === 400 || error?.status === 401 || error?.status === 403
      || /invalid.*credentials|invalid.*login|email.*password|user.*not.*found/i.test(message))) {
    return 'invalid_credentials';
  }
  if (fallback === 'signup_failed'
    && /already.*registered|already.*exists|user.*exists|email.*taken/i.test(message)) {
    return 'signup_conflict';
  }
  if (error?.status === 401 || error?.status === 403
    || /expired|invalid.*token|session.*missing|refresh_token_not_found/i.test(message)) {
    return 'session_expired';
  }
  if (/network|fetch|offline|timeout|failed to fetch/i.test(message)) {
    return 'provider_unavailable';
  }
  return fallback;
}

function sanitizedFailure(error, fallback = 'authentication_failed') {
  const code = errorCode(error, fallback);
  const messages = {
    authentication_failed: 'Authentication failed. Check the credentials and try again.',
    invalid_credentials: 'The supplied sign-in credentials were not accepted.',
    session_expired: 'The authentication session expired.',
    provider_unavailable: 'Sign-in is unavailable while the provider cannot be reached.',
    signup_failed: 'Account creation failed. Check the details and try again.',
    signup_conflict: 'Account creation could not use the supplied details.',
    signout_failed: 'The provider session could not be fully closed.',
  };
  return providerFailure(code, messages[code] ?? messages.authentication_failed, error);
}

function displayNameFromUser(user) {
  for (const value of [user?.user_metadata?.display_name, user?.user_metadata?.full_name, user?.user_metadata?.name]) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
  }
  return null;
}

function providerIdentity(user, configuration, clock) {
  if (!user || typeof user.id !== 'string' || !user.id) {
    throw providerFailure('authentication_failed', 'The provider returned an invalid authenticated user.');
  }
  return createAuthProviderIdentity({
    provider: AUTH_PROVIDER_NAMES.SUPABASE,
    providerTenantId: configuration.providerTenantId,
    providerSubject: user.id,
    email: typeof user.email === 'string' && user.email ? user.email : null,
    displayName: displayNameFromUser(user),
    authenticatedAt: normalizedTimestamp(clock),
  });
}

export function createSupabaseAuthProviderAdapter({
  config,
  client = null,
  clientFactory = globalThis.supabase?.createClient,
  clock = () => new Date(),
  timeoutMs = 5000,
} = {}) {
  const configuration = normalizeSupabasePublicConfiguration(config);
  const authClient = client ?? createSupabaseBrowserClient({ config, clientFactory });
  if (!authClient?.auth) throw new TypeError('Supabase client does not expose Auth');

  async function requireUser(operation, fallback) {
    let result;
    try { result = await timeout(operation(), timeoutMs); } catch (error) { throw sanitizedFailure(error, fallback); }
    if (result?.error) throw sanitizedFailure(result.error, fallback);
    const user = result?.data?.user ?? result?.data?.session?.user;
    return providerIdentity(user, configuration, clock);
  }

  return Object.freeze({
    provider: AUTH_PROVIDER_NAMES.SUPABASE,
    providerTenantId: configuration.providerTenantId,
    isAvailable: () => true,
    async signInWithPassword({ email, password } = {}) {
      return requireUser(
        () => authClient.auth.signInWithPassword({ email, password }),
        'authentication_failed',
      );
    },
    async signUpWithPassword({ email, password, username = null, displayName = null } = {}) {
      let result;
      try {
        const options = username && displayName
          ? { data: { username, username_normalized: username, display_name: displayName } }
          : undefined;
        result = await timeout(authClient.auth.signUp({ email, password, ...(options ? { options } : {}) }), timeoutMs);
      } catch (error) {
        throw sanitizedFailure(error, 'signup_failed');
      }
      if (result?.error) throw sanitizedFailure(result.error, 'signup_failed');
      if (!result?.data?.session) {
        return Object.freeze({ status: 'confirmation_required', email });
      }
      return providerIdentity(result.data.session.user ?? result.data.user, configuration, clock);
    },
    async restoreSession() {
      let sessionResult;
      try { sessionResult = await timeout(authClient.auth.getSession(), timeoutMs); }
      catch (error) { throw sanitizedFailure(error); }
      if (sessionResult?.error) throw sanitizedFailure(sessionResult.error);
      if (!sessionResult?.data?.session) return null;
      return requireUser(() => authClient.auth.getUser(), 'session_expired');
    },
    async refreshSession() {
      return requireUser(() => authClient.auth.refreshSession(), 'session_expired');
    },
    async signOut() {
      try {
        const globalResult = await timeout(authClient.auth.signOut({ scope: 'global' }), timeoutMs);
        if (!globalResult?.error) return;
        const localResult = await authClient.auth.signOut({ scope: 'local' });
        if (localResult?.error) throw localResult.error;
      } catch (error) {
        try {
          const localResult = await authClient.auth.signOut({ scope: 'local' });
          if (!localResult?.error) return;
        } catch { /* surface the original sanitized failure */ }
        throw sanitizedFailure(error, 'signout_failed');
      }
    },
  });
}

export function createSupabaseBrowserClient({
  config,
  clientFactory = globalThis.supabase?.createClient,
} = {}) {
  const definition = createSupabaseBrowserClientDefinition(config);
  if (typeof clientFactory !== 'function') {
    throw new TypeError('The official Supabase browser client is unavailable');
  }
  const client = clientFactory(
    definition.configuration.supabaseUrl,
    definition.configuration.supabasePublishableKey,
    definition.options,
  );
  if (!client?.auth) throw new TypeError('Supabase client does not expose Auth');
  return client;
}
