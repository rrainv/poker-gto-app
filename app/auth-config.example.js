// Browser-only local development. Copy to app/auth-config.js (gitignored).
// These are public client values. Never place a service-role secret here.
globalThis.RiverlineAuthConfig = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
});

