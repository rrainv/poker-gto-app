const { contextBridge } = require('electron');

function publicValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

contextBridge.exposeInMainWorld('RiverlineRuntimeConfig', Object.freeze({
  supabaseUrl: publicValue('RIVERLINE_AUTH_SUPABASE_URL'),
  supabasePublishableKey: publicValue('RIVERLINE_AUTH_SUPABASE_PUBLISHABLE_KEY'),
}));

