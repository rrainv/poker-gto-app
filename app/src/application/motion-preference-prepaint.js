// Runs before CSS so the first paint already uses the effective Motion mode.
// motion-preference.mjs owns the setting; this only mirrors its resolution.
(function () {
  const root = document.documentElement;
  let preference = null;
  try {
    preference = localStorage.getItem('riverline_motion_preference');
  } catch (_) { /* Storage-disabled startup follows the system setting. */ }
  if (!['instant', 'faster', 'standard', 'reduced'].includes(preference)) preference = null;
  const systemReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  root.dataset.motionMode = preference ?? (systemReduced ? 'reduced' : 'standard');
  root.dataset.motionSource = preference ? 'user' : 'system';
})();
