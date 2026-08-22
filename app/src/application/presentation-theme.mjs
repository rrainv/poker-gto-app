export const PRESENTATION_THEME_SCHEMA_VERSION = 'presentation-theme-customization/v1';
export const PRESENTATION_THEME_STORAGE_KEY = 'appTheme';
export const PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY = 'riverline_presentation_theme_customization';
export const DEFAULT_PRESENTATION_THEME = 'midnight';

export const PRESENTATION_THEMES = Object.freeze([
  Object.freeze({
    id: 'midnight',
    name: 'Riverline Midnight',
    preview: Object.freeze({ accent: '#42ad7b', surface: '#101311', felt: '#285a45' }),
    tone: 'dark',
  }),
  Object.freeze({
    id: 'graphite',
    name: 'Riverline Graphite',
    preview: Object.freeze({ accent: '#7897c8', surface: '#14171a', felt: '#3f5964' }),
    tone: 'dark',
  }),
  Object.freeze({
    id: 'daylight',
    name: 'Riverline Daylight',
    preview: Object.freeze({ accent: '#267457', surface: '#ebe7df', felt: '#477765' }),
    tone: 'light',
  }),
]);

const THEME_BY_ID = new Map(PRESENTATION_THEMES.map((theme) => [theme.id, theme]));
const CUSTOM_PROPERTY_NAMES = Object.freeze([
  '--accent-primary', '--accent-primary-hover', '--accent-secondary',
  '--border-focus', '--selection-background', '--selection-border',
  '--text-on-accent', '--primary', '--primary-hover', '--primary-rgb',
  '--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated',
  '--surface-interactive', '--surface-interactive-hover', '--surface-inset',
  '--border-subtle', '--border-default', '--border-strong', '--bg', '--panel', '--panel2',
  '--line', '--theme-gradient', '--page-glow', '--poker-felt-accent',
]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const roundByte = (value) => Math.round(clamp(value, 0, 255));

export function normalizePresentationTheme(value) {
  return THEME_BY_ID.has(value) ? value : DEFAULT_PRESENTATION_THEME;
}

export function normalizeHexColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${[...trimmed.slice(1)].map((part) => `${part}${part}`).join('')}`;
  }
  return null;
}

export function hexToRgb(value) {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[roundByte(r), roundByte(g), roundByte(b)]
    .map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl({ r, g, b }) {
  const channels = [r, g, b].map((value) => value / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const lightness = (maximum + minimum) / 2;
  if (maximum === minimum) return { h: 0, s: 0, l: lightness * 100 };
  const delta = maximum - minimum;
  const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
  let hue;
  if (maximum === channels[0]) hue = 60 * (((channels[1] - channels[2]) / delta) % 6);
  else if (maximum === channels[1]) hue = 60 * (((channels[2] - channels[0]) / delta) + 2);
  else hue = 60 * (((channels[0] - channels[1]) / delta) + 4);
  return { h: hue < 0 ? hue + 360 : hue, s: saturation * 100, l: lightness * 100 };
}

function hslToRgb({ h, s, l }) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - (chroma / 2);
  let channels;
  if (hue < 60) channels = [chroma, x, 0];
  else if (hue < 120) channels = [x, chroma, 0];
  else if (hue < 180) channels = [0, chroma, x];
  else if (hue < 240) channels = [0, x, chroma];
  else if (hue < 300) channels = [x, 0, chroma];
  else channels = [chroma, 0, x];
  return { r: (channels[0] + offset) * 255, g: (channels[1] + offset) * 255, b: (channels[2] + offset) * 255 };
}

function hslToHex(value) {
  return rgbToHex(hslToRgb(value));
}

export function mixHexColors(first, second, weight = 0.5) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  if (!a || !b) return null;
  const amount = clamp(weight, 0, 1);
  return rgbToHex({
    r: a.r + ((b.r - a.r) * amount),
    g: a.g + ((b.g - a.g) * amount),
    b: a.b + ((b.b - a.b) * amount),
  });
}

function relativeLuminance(value) {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b]
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

export function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  if (a === null || b === null) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function ensureContrast(color, background, target, tone) {
  if (contrastRatio(color, background) >= target) return color;
  const destination = tone === 'light' ? '#000000' : '#ffffff';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexColors(color, destination, step * 0.05);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return destination;
}

function readableTextOn(background) {
  const dark = '#07120d';
  const light = '#ffffff';
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}

function guardedAccent(value, theme, surface) {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  const hsl = rgbToHsl(hexToRgb(normalized));
  const restrained = hslToHex({ h: hsl.h, s: clamp(hsl.s, 18, 72), l: clamp(hsl.l, 28, 68) });
  return ensureContrast(restrained, surface, 3, theme.tone);
}

function guardedSurface(value, theme) {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  const hsl = rgbToHsl(hexToRgb(normalized));
  const range = theme.tone === 'light' ? [86, 94] : [6, 16];
  return hslToHex({ h: hsl.h, s: clamp(hsl.s, 0, 24), l: clamp(hsl.l, range[0], range[1]) });
}

function guardedFelt(value, theme) {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  const hsl = rgbToHsl(hexToRgb(normalized));
  const lightness = theme.tone === 'light' ? clamp(hsl.l, 27, 54) : clamp(hsl.l, 18, 46);
  return hslToHex({ h: hsl.h, s: clamp(hsl.s, 16, 58), l: lightness });
}

function deriveSurfacePalette(surface, theme) {
  const hsl = rgbToHsl(hexToRgb(surface));
  const colorAt = (lightness, saturation = hsl.s) => hslToHex({
    h: hsl.h,
    s: saturation,
    l: clamp(lightness, 2, 98),
  });
  if (theme.tone === 'light') {
    return {
      canvas: surface,
      shell: colorAt(hsl.l - 4),
      panel: colorAt(hsl.l + 3, hsl.s * 0.78),
      elevated: colorAt(hsl.l + 5, hsl.s * 0.68),
      interactive: colorAt(hsl.l - 2),
      hover: colorAt(hsl.l - 7),
      inset: colorAt(hsl.l - 4),
      borderDefault: colorAt(hsl.l - 18, hsl.s * 0.62),
      borderStrong: colorAt(hsl.l - 30, hsl.s * 0.55),
      glow: colorAt(hsl.l - 3),
    };
  }
  return {
    canvas: surface,
    shell: colorAt(hsl.l + 2),
    panel: colorAt(hsl.l + 4),
    elevated: colorAt(hsl.l + 7),
    interactive: colorAt(hsl.l + 8),
    hover: colorAt(hsl.l + 12),
    inset: colorAt(hsl.l + 3),
    borderDefault: colorAt(hsl.l + 18, hsl.s * 0.62),
    borderStrong: colorAt(hsl.l + 28, hsl.s * 0.55),
    glow: colorAt(hsl.l + 9),
  };
}

export function normalizeThemeCustomization(value, themeId) {
  const theme = THEME_BY_ID.get(normalizePresentationTheme(themeId));
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const surface = guardedSurface(value.surface, theme);
  const background = surface ?? theme.preview.surface;
  const accent = guardedAccent(value.accent, theme, background);
  const felt = guardedFelt(value.felt, theme);
  const customization = {};
  if (accent) customization.accent = accent;
  if (surface) customization.surface = surface;
  if (felt) customization.felt = felt;
  return Object.keys(customization).length ? Object.freeze(customization) : null;
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // Presentation still applies when browser storage is unavailable.
  }
}

function readCustomizations(storage) {
  const stored = readStorage(storage, PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY);
  if (stored === null) return { byTheme: {}, repair: false };
  let candidate;
  try {
    candidate = JSON.parse(stored);
  } catch {
    return { byTheme: {}, repair: true };
  }
  if (candidate?.schemaVersion !== PRESENTATION_THEME_SCHEMA_VERSION
    || !candidate.byTheme || typeof candidate.byTheme !== 'object' || Array.isArray(candidate.byTheme)) {
    return { byTheme: {}, repair: true };
  }
  const byTheme = {};
  let repair = false;
  Object.entries(candidate.byTheme).forEach(([themeId, value]) => {
    if (!THEME_BY_ID.has(themeId)) {
      repair = true;
      return;
    }
    const normalized = normalizeThemeCustomization(value, themeId);
    if (normalized) byTheme[themeId] = normalized;
    if (!normalized || JSON.stringify(value) !== JSON.stringify(normalized)) repair = true;
  });
  return { byTheme, repair };
}

function persistCustomizations(storage, byTheme) {
  writeStorage(storage, PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY, JSON.stringify({
    schemaVersion: PRESENTATION_THEME_SCHEMA_VERSION,
    byTheme,
  }));
}

function setCustomProperty(root, name, value) {
  root.style?.setProperty?.(name, value);
}

function clearCustomProperties(root) {
  CUSTOM_PROPERTY_NAMES.forEach((name) => root.style?.removeProperty?.(name));
}

function applyCustomProperties(root, theme, customization) {
  clearCustomProperties(root);
  if (!customization) return;
  if (customization.surface) {
    const palette = deriveSurfacePalette(customization.surface, theme);
    setCustomProperty(root, '--surface-canvas', palette.canvas);
    setCustomProperty(root, '--surface-shell', palette.shell);
    setCustomProperty(root, '--surface-panel', palette.panel);
    setCustomProperty(root, '--surface-elevated', palette.elevated);
    setCustomProperty(root, '--surface-interactive', palette.interactive);
    setCustomProperty(root, '--surface-interactive-hover', palette.hover);
    setCustomProperty(root, '--surface-inset', palette.inset);
    setCustomProperty(root, '--border-subtle', `color-mix(in srgb, ${palette.borderDefault} 34%, transparent)`);
    setCustomProperty(root, '--border-default', palette.borderDefault);
    setCustomProperty(root, '--border-strong', palette.borderStrong);
    setCustomProperty(root, '--bg', palette.canvas);
    setCustomProperty(root, '--panel', palette.panel);
    setCustomProperty(root, '--panel2', palette.interactive);
    setCustomProperty(root, '--line', palette.borderDefault);
    setCustomProperty(root, '--theme-gradient', palette.elevated);
    setCustomProperty(root, '--page-glow', palette.glow);
  }
  if (customization.accent) {
    const hoverTarget = theme.tone === 'light' ? '#000000' : '#ffffff';
    const hover = mixHexColors(customization.accent, hoverTarget, 0.14);
    const secondary = mixHexColors(customization.accent, theme.tone === 'light' ? '#5d6963' : '#b9c7c0', 0.44);
    const rgb = hexToRgb(customization.accent);
    setCustomProperty(root, '--accent-primary', customization.accent);
    setCustomProperty(root, '--accent-primary-hover', hover);
    setCustomProperty(root, '--accent-secondary', secondary);
    setCustomProperty(root, '--border-focus', customization.accent);
    setCustomProperty(root, '--selection-background', `color-mix(in srgb, ${customization.accent} 22%, transparent)`);
    setCustomProperty(root, '--selection-border', customization.accent);
    setCustomProperty(root, '--text-on-accent', readableTextOn(customization.accent));
    setCustomProperty(root, '--primary', customization.accent);
    setCustomProperty(root, '--primary-hover', hover);
    setCustomProperty(root, '--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
  if (customization.felt) setCustomProperty(root, '--poker-felt-accent', customization.felt);
}

export function createPresentationThemeController({
  root,
  storage,
  themeGrid = null,
  accentInput = null,
  surfaceInput = null,
  feltInput = null,
  resetButton = null,
  status = null,
  translate = (key) => key,
} = {}) {
  if (!root?.dataset) throw new TypeError('A theme root element is required');

  const inputs = { accent: accentInput, surface: surfaceInput, felt: feltInput };
  const listeners = [];
  let gridListeners = [];
  let byTheme = {};
  let currentThemeId = DEFAULT_PRESENTATION_THEME;

  function currentTheme() {
    return THEME_BY_ID.get(currentThemeId);
  }

  function currentCustomization() {
    return byTheme[currentThemeId] ?? null;
  }

  function announce() {
    const view = root.ownerDocument?.defaultView;
    const ThemeEvent = view?.CustomEvent ?? globalThis.CustomEvent;
    if (typeof root.dispatchEvent !== 'function' || typeof ThemeEvent !== 'function') return;
    root.dispatchEvent(new ThemeEvent('riverline:themechange', {
      bubbles: true,
      detail: Object.freeze({ theme: currentThemeId, customized: Boolean(currentCustomization()) }),
    }));
  }

  function syncControls() {
    const theme = currentTheme();
    const customization = currentCustomization();
    if (inputs.accent) inputs.accent.value = customization?.accent ?? theme.preview.accent;
    if (inputs.surface) inputs.surface.value = customization?.surface ?? theme.preview.surface;
    if (inputs.felt) inputs.felt.value = customization?.felt ?? theme.preview.felt;
    if (resetButton) resetButton.disabled = !customization;
    if (status) status.textContent = customization
      ? translate('Custom theme colors are active. Contrast guardrails are applied automatically.')
      : translate('Using built-in theme defaults.');
    root.dataset.themeCustomized = String(Boolean(customization));
    themeGrid?.querySelectorAll?.('[data-theme-id]').forEach((button) => {
      const selected = button.dataset.themeId === currentThemeId;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
  }

  function renderThemeGrid() {
    const documentRef = themeGrid?.ownerDocument;
    if (!themeGrid || !documentRef?.createElement) return;
    gridListeners.forEach(([target, type, listener]) => target.removeEventListener?.(type, listener));
    gridListeners = [];
    themeGrid.replaceChildren();
    PRESENTATION_THEMES.forEach((theme) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'theme-swatch-btn';
      button.dataset.themeId = theme.id;
      button.style.setProperty('--swatch-bg', theme.preview.surface);
      button.style.setProperty('--swatch-accent', theme.preview.accent);
      button.setAttribute('aria-pressed', 'false');
      const dot = documentRef.createElement('span');
      dot.className = 'theme-swatch-dot';
      const name = documentRef.createElement('span');
      name.className = 'theme-swatch-name';
      name.textContent = translate(theme.name);
      button.append(dot, name);
      const listener = () => apply(theme.id);
      button.addEventListener('click', listener);
      gridListeners.push([button, 'click', listener]);
      themeGrid.append(button);
    });
  }

  function commit({ persist = true, announce: shouldAnnounce = true } = {}) {
    const customization = currentCustomization();
    root.dataset.theme = currentThemeId;
    applyCustomProperties(root, currentTheme(), customization);
    syncControls();
    if (persist) {
      writeStorage(storage, PRESENTATION_THEME_STORAGE_KEY, currentThemeId);
      persistCustomizations(storage, byTheme);
    }
    if (shouldAnnounce) announce();
    return currentThemeId;
  }

  function apply(value, options = {}) {
    currentThemeId = normalizePresentationTheme(value);
    return commit(options);
  }

  function customize(partial, options = {}) {
    const merged = { ...(currentCustomization() ?? {}), ...partial };
    const normalized = normalizeThemeCustomization(merged, currentThemeId);
    if (normalized) byTheme[currentThemeId] = normalized;
    else delete byTheme[currentThemeId];
    commit(options);
    return currentCustomization();
  }

  function reset(options = {}) {
    delete byTheme[currentThemeId];
    commit(options);
    return null;
  }

  function restore() {
    const storedTheme = readStorage(storage, PRESENTATION_THEME_STORAGE_KEY);
    currentThemeId = normalizePresentationTheme(storedTheme);
    const storedCustomizations = readCustomizations(storage);
    byTheme = storedCustomizations.byTheme;
    commit({ persist: false, announce: false });
    if (storedTheme !== null && storedTheme !== currentThemeId) {
      writeStorage(storage, PRESENTATION_THEME_STORAGE_KEY, currentThemeId);
    }
    if (storedCustomizations.repair) persistCustomizations(storage, byTheme);
    return currentThemeId;
  }

  function bindInput(name, input) {
    if (!input) return;
    const listener = () => customize({ [name]: input.value });
    input.addEventListener?.('input', listener);
    listeners.push([input, 'input', listener]);
  }

  function init() {
    renderThemeGrid();
    restore();
    bindInput('accent', inputs.accent);
    bindInput('surface', inputs.surface);
    bindInput('felt', inputs.felt);
    if (resetButton) {
      const listener = () => reset();
      resetButton.addEventListener?.('click', listener);
      listeners.push([resetButton, 'click', listener]);
    }
    return controller;
  }

  function refreshLabels() {
    renderThemeGrid();
    syncControls();
  }

  function destroy() {
    listeners.splice(0).forEach(([element, type, listener]) => element.removeEventListener?.(type, listener));
    gridListeners.splice(0).forEach(([element, type, listener]) => element.removeEventListener?.(type, listener));
  }

  const controller = Object.freeze({
    apply,
    customize,
    destroy,
    getCustomization: currentCustomization,
    getTheme: () => currentThemeId,
    init,
    refreshLabels,
    reset,
    restore,
  });
  return controller;
}
