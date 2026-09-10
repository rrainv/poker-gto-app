// Runs before CSS. This cache is only a render derivative of the exact saved library.
(function () {
  const root = document.documentElement;
  try {
    const cache = JSON.parse(localStorage.getItem('riverline_theme_prepaint'));
    if (cache?.version === 'beta-b-1'
      && cache.library === localStorage.getItem('riverline_presentation_theme_customization')
      && ['midnight', 'graphite', 'daylight'].includes(cache.theme)
      && cache.properties && typeof cache.properties === 'object') {
      root.dataset.theme = cache.theme;
      root.dataset.presentationThemeId = cache.themeId;
      root.dataset.themeKind = cache.kind;
      for (const [name, value] of Object.entries(cache.properties)) {
        if (/^(--[a-z0-9-]+|color-scheme)$/.test(name) && typeof value === 'string'
          && /^[a-z0-9#(),.%\s-]+$/i.test(value) && !/url/i.test(value)) root.style.setProperty(name, value);
      }
      return;
    }
  } catch (_) { /* Storage-disabled startup still resolves through the theme owner. */ }
  root.dataset.themePending = 'true';
  // Fail open if the module cannot load; never leave the app permanently hidden.
  setTimeout(() => { delete root.dataset.themePending; }, 1200);
})();
