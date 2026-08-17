function configured(value) {
  return typeof value === 'string' && Boolean(value.trim()) ? value.trim() : null;
}

function publicConfigFrom(value) {
  if (!value || typeof value !== 'object') return null;
  const supabaseUrl = configured(value.supabaseUrl);
  const supabasePublishableKey = configured(value.supabasePublishableKey);
  return supabaseUrl && supabasePublishableKey
    ? Object.freeze({ supabaseUrl, supabasePublishableKey })
    : null;
}

export async function resolveRiverlineAuthConfig(browserWindow = globalThis) {
  const injected = publicConfigFrom(browserWindow.RiverlineRuntimeConfig)
    ?? publicConfigFrom(browserWindow.RiverlineAuthConfig);
  if (injected) return injected;
  try {
    await import('../../auth-config.js');
  } catch {
    return null;
  }
  return publicConfigFrom(browserWindow.RiverlineAuthConfig);
}

