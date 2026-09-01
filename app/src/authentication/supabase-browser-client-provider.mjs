import {
  createSupabaseBrowserClientDefinition,
  createSupabaseBrowserClient,
} from './supabase-auth-provider.mjs';

const runtimeClients = new WeakMap();

function runtimeKey(browserWindow) {
  if ((typeof browserWindow !== 'object' || browserWindow === null)
    && typeof browserWindow !== 'function') {
    throw new TypeError('A browser runtime is required to own the Supabase client');
  }
  return browserWindow;
}

export function getRiverlineSupabaseBrowserClient({
  browserWindow = globalThis,
  config,
  clientFactory = browserWindow?.supabase?.createClient,
} = {}) {
  if (!config) return null;
  const key = runtimeKey(browserWindow);
  const requested = createSupabaseBrowserClientDefinition(config);
  const owned = runtimeClients.get(key);
  if (owned) {
    if (owned.identity !== requested.identity) {
      throw new Error('Riverline does not support Supabase client reconfiguration within one browser runtime');
    }
    return owned.client;
  }
  const client = createSupabaseBrowserClient({ config: requested.configuration, clientFactory });
  runtimeClients.set(key, Object.freeze({ identity: requested.identity, client }));
  return client;
}
