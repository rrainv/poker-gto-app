export const PRESENTATION_THEME_SCHEMA_VERSION = 'presentation-theme-library/v2';
export const PRESENTATION_THEME_STORAGE_KEY = 'riverline_presentation_theme_customization';
export const PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY = PRESENTATION_THEME_STORAGE_KEY;
export const LEGACY_PRESENTATION_THEME_STORAGE_KEY = 'appTheme';
export const DEFAULT_PRESENTATION_THEME = 'midnight';
export const CUSTOM_THEME_VERSION = 1;

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
const SUPPORTED_COLOR_TOKENS = Object.freeze(['accent', 'surface', 'felt']);
const CUSTOM_THEME_ID_PATTERN = /^custom-[a-z0-9_-]{1,72}$/i;
const CUSTOM_THEME_NAME_LIMIT = 48;
const CUSTOM_THEME_LIMIT = 64;
const LEGACY_SCHEMA_VERSION = 'presentation-theme-customization/v1';
const CUSTOM_PROPERTY_NAMES = Object.freeze([
  'color-scheme',
  '--accent-primary', '--accent-primary-hover', '--accent-secondary',
  '--border-focus', '--selection-background', '--selection-border',
  '--text-on-accent', '--primary', '--primary-hover', '--primary-rgb',
  '--text-primary', '--text-secondary', '--text-muted', '--text-disabled', '--text', '--muted',
  '--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated',
  '--surface-interactive', '--surface-interactive-hover', '--surface-inset',
  '--border-subtle', '--border-default', '--border-strong', '--bg', '--panel', '--panel2',
  '--line', '--theme-gradient', '--page-glow', '--poker-felt-accent',
]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const roundByte = (value) => Math.round(clamp(value, 0, 255));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

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

function readableTextOn(background) {
  const dark = '#07120d';
  const light = '#ffffff';
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}

function surfaceTone(background) {
  return readableTextOn(background) === '#07120d' ? 'light' : 'dark';
}

function ensureContrastAcross(color, backgrounds, target, tone) {
  const validBackgrounds = backgrounds.filter((background) => normalizeHexColor(background));
  if (validBackgrounds.every((background) => contrastRatio(color, background) >= target)) return color;
  const destination = tone === 'light' ? '#07120d' : '#ffffff';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mixHexColors(color, destination, step * 0.05);
    if (validBackgrounds.every((background) => contrastRatio(candidate, background) >= target)) return candidate;
  }
  return destination;
}

function deriveTextPalette(palette) {
  const backgrounds = [palette.canvas, palette.panel, palette.elevated, palette.interactive, palette.inset];
  const dark = '#07120d';
  const light = '#ffffff';
  const minimumContrast = (color) => Math.min(...backgrounds.map((background) => contrastRatio(color, background)));
  const primary = minimumContrast(dark) >= minimumContrast(light) ? dark : light;
  return {
    primary,
    secondary: ensureContrastAcross(mixHexColors(primary, palette.canvas, 0.18), backgrounds, 4.5, palette.tone),
    muted: ensureContrastAcross(mixHexColors(primary, palette.canvas, 0.34), backgrounds, 4.5, palette.tone),
    disabled: ensureContrastAcross(mixHexColors(primary, palette.canvas, 0.48), backgrounds, 3, palette.tone),
  };
}

function deriveSurfacePalette(surface) {
  const hsl = rgbToHsl(hexToRgb(surface));
  const tone = surfaceTone(surface);
  const colorAt = (lightness, saturation = hsl.s) => hslToHex({
    h: hsl.h,
    s: saturation,
    l: clamp(lightness, 2, 98),
  });
  const palette = tone === 'light'
    ? {
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
    }
    : {
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
  const borderBackgrounds = [palette.canvas, palette.panel, palette.interactive];
  return {
    ...palette,
    tone,
    borderDefault: ensureContrastAcross(palette.borderDefault, borderBackgrounds, 3, tone),
    borderStrong: ensureContrastAcross(palette.borderStrong, borderBackgrounds, 4.5, tone),
  };
}

export function normalizeThemeCustomization(value, themeId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const customization = {};
  for (const token of SUPPORTED_COLOR_TOKENS) {
    const normalized = normalizeHexColor(value[token]);
    if (normalized) customization[token] = normalized;
  }
  return Object.keys(customization).length ? Object.freeze(customization) : null;
}

export function normalizeCustomThemeName(value, fallback = 'Custom theme') {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const safeFallback = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'Custom theme';
  return (normalized || safeFallback).slice(0, CUSTOM_THEME_NAME_LIMIT);
}

export function uniqueCustomThemeName(value, themes = [], excludeId = null) {
  const requested = normalizeCustomThemeName(value);
  const used = new Set(themes
    .filter((theme) => theme.id !== excludeId)
    .map((theme) => normalizeCustomThemeName(theme.name).toLocaleLowerCase()));
  if (!used.has(requested.toLocaleLowerCase())) return requested;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = ` (${index})`;
    const candidate = `${requested.slice(0, CUSTOM_THEME_NAME_LIMIT - suffix.length)}${suffix}`;
    if (!used.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${requested.slice(0, CUSTOM_THEME_NAME_LIMIT - 7)} (copy)`;
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

function removeStorage(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // A stale legacy preference is harmless when storage is read-only.
  }
}

function defaultLibrary(activeThemeId = DEFAULT_PRESENTATION_THEME) {
  return { activeThemeId: normalizePresentationTheme(activeThemeId), customThemes: [], draftsByTheme: {} };
}

function validIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function builtInBaseFor(themeId, themeMap, seen = new Set()) {
  if (THEME_BY_ID.has(themeId)) return THEME_BY_ID.get(themeId);
  if (seen.has(themeId)) return THEME_BY_ID.get(DEFAULT_PRESENTATION_THEME);
  seen.add(themeId);
  const custom = themeMap.get(themeId);
  return custom
    ? builtInBaseFor(custom.baseThemeId, themeMap, seen)
    : THEME_BY_ID.get(DEFAULT_PRESENTATION_THEME);
}

function effectiveOverridesFor(themeId, themeMap, seen = new Set()) {
  if (THEME_BY_ID.has(themeId)) return {};
  if (seen.has(themeId)) return {};
  seen.add(themeId);
  const custom = themeMap.get(themeId);
  if (!custom) return {};
  const inherited = effectiveOverridesFor(custom.baseThemeId, themeMap, seen);
  return normalizeThemeCustomization(
    { ...inherited, ...custom.overrides },
    builtInBaseFor(themeId, themeMap).id,
  ) ?? {};
}

function repairCustomThemes(rawThemes, now) {
  if (!Array.isArray(rawThemes)) return { customThemes: [], repair: true };
  const customThemes = [];
  const ids = new Set();
  let repair = rawThemes.length > CUSTOM_THEME_LIMIT;
  rawThemes.slice(0, CUSTOM_THEME_LIMIT).forEach((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || !CUSTOM_THEME_ID_PATTERN.test(raw.id ?? '') || ids.has(raw.id)) {
      repair = true;
      return;
    }
    ids.add(raw.id);
    const createdAt = validIsoDate(raw.createdAt) ?? now;
    const updatedAt = validIsoDate(raw.updatedAt) ?? createdAt;
    const name = uniqueCustomThemeName(raw.name, customThemes);
    const theme = {
      id: raw.id,
      name,
      baseThemeId: typeof raw.baseThemeId === 'string' ? raw.baseThemeId : DEFAULT_PRESENTATION_THEME,
      overrides: raw.overrides,
      version: CUSTOM_THEME_VERSION,
      createdAt,
      updatedAt,
    };
    if (name !== raw.name || raw.version !== CUSTOM_THEME_VERSION
      || createdAt !== raw.createdAt || updatedAt !== raw.updatedAt) repair = true;
    customThemes.push(theme);
  });

  const themeMap = new Map(customThemes.map((theme) => [theme.id, theme]));
  customThemes.forEach((theme) => {
    if (!THEME_BY_ID.has(theme.baseThemeId) && !themeMap.has(theme.baseThemeId)) {
      theme.baseThemeId = DEFAULT_PRESENTATION_THEME;
      repair = true;
    }
    const visited = new Set([theme.id]);
    let cursor = themeMap.get(theme.baseThemeId);
    while (cursor) {
      if (visited.has(cursor.id)) {
        theme.baseThemeId = DEFAULT_PRESENTATION_THEME;
        repair = true;
        break;
      }
      visited.add(cursor.id);
      cursor = themeMap.get(cursor.baseThemeId);
    }
  });
  customThemes.forEach((theme) => {
    const normalized = normalizeThemeCustomization(theme.overrides, builtInBaseFor(theme.id, themeMap).id) ?? {};
    if (JSON.stringify(normalized) !== JSON.stringify(theme.overrides)) repair = true;
    theme.overrides = normalized;
  });
  return { customThemes, repair };
}

function readThemeLibrary(storage, now) {
  const stored = readStorage(storage, PRESENTATION_THEME_STORAGE_KEY);
  const legacyActive = readStorage(storage, LEGACY_PRESENTATION_THEME_STORAGE_KEY);
  if (stored === null) {
    return { library: defaultLibrary(legacyActive), repair: legacyActive !== null };
  }
  let candidate;
  try {
    candidate = JSON.parse(stored);
  } catch {
    return { library: defaultLibrary(), repair: true };
  }

  if (candidate?.schemaVersion === LEGACY_SCHEMA_VERSION
    && candidate.byTheme && typeof candidate.byTheme === 'object' && !Array.isArray(candidate.byTheme)) {
    return {
      library: defaultLibrary(legacyActive),
      repair: true,
    };
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
    || candidate.schemaVersion !== PRESENTATION_THEME_SCHEMA_VERSION) {
    return { library: defaultLibrary(), repair: true };
  }

  const repairedThemes = repairCustomThemes(candidate.customThemes, now);
  const themeMap = new Map(repairedThemes.customThemes.map((theme) => [theme.id, theme]));
  const draftsByTheme = {};
  let repair = repairedThemes.repair;
  if (!candidate.draftsByTheme || typeof candidate.draftsByTheme !== 'object'
    || Array.isArray(candidate.draftsByTheme)) repair = true;
  Object.entries(candidate.draftsByTheme ?? {}).forEach(([themeId, raw]) => {
    // v2 once persisted mutable drafts against built-in IDs. Built-ins are now
    // immutable, and unsaved editor state is deliberately runtime-only.
    if (themeId || raw) repair = true;
  });
  const activeThemeId = THEME_BY_ID.has(candidate.activeThemeId) || themeMap.has(candidate.activeThemeId)
    ? candidate.activeThemeId
    : DEFAULT_PRESENTATION_THEME;
  if (activeThemeId !== candidate.activeThemeId) repair = true;
  return {
    library: { activeThemeId, customThemes: repairedThemes.customThemes, draftsByTheme },
    repair,
  };
}

function serializeThemeLibrary(library) {
  return JSON.stringify({
    schemaVersion: PRESENTATION_THEME_SCHEMA_VERSION,
    activeThemeId: library.activeThemeId,
    customThemes: library.customThemes,
    draftsByTheme: library.draftsByTheme,
  });
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
  const activeSurface = customization.surface ?? theme.preview.surface;
  const surfacePalette = deriveSurfacePalette(activeSurface);
  if (customization.surface) {
    const palette = surfacePalette;
    const text = deriveTextPalette(palette);
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
    setCustomProperty(root, '--text-primary', text.primary);
    setCustomProperty(root, '--text-secondary', text.secondary);
    setCustomProperty(root, '--text-muted', text.muted);
    setCustomProperty(root, '--text-disabled', text.disabled);
    setCustomProperty(root, '--text', text.primary);
    setCustomProperty(root, '--muted', text.muted);
    setCustomProperty(root, 'color-scheme', palette.tone);
  }
  if (customization.accent) {
    const hoverTarget = readableTextOn(customization.accent);
    const hover = mixHexColors(customization.accent, hoverTarget, 0.14);
    const secondary = mixHexColors(customization.accent, hoverTarget, 0.44);
    const rgb = hexToRgb(customization.accent);
    setCustomProperty(root, '--accent-primary', customization.accent);
    setCustomProperty(root, '--accent-primary-hover', hover);
    setCustomProperty(root, '--accent-secondary', secondary);
    setCustomProperty(root, '--text-on-accent', readableTextOn(customization.accent));
    setCustomProperty(root, '--primary', customization.accent);
    setCustomProperty(root, '--primary-hover', hover);
    setCustomProperty(root, '--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }
  if (customization.accent || customization.surface) {
    const activeAccent = customization.accent ?? theme.preview.accent;
    const focusBackgrounds = [surfacePalette.canvas, surfacePalette.panel, surfacePalette.interactive];
    const focus = ensureContrastAcross(activeAccent, focusBackgrounds, 3, surfacePalette.tone);
    setCustomProperty(root, '--border-focus', focus);
    setCustomProperty(root, '--selection-background', `color-mix(in srgb, ${focus} 24%, transparent)`);
    setCustomProperty(root, '--selection-border', focus);
  }
  if (customization.felt) setCustomProperty(root, '--poker-felt-accent', customization.felt);
}

function makeThemeId(createId) {
  const candidate = String(createId?.() ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `custom-${candidate || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function defaultIdFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPresentationThemeController({
  root,
  storage,
  builtInGrid = null,
  customGrid = null,
  customEmpty = null,
  colorTriggers = [],
  resetTokenButtons = [],
  nameInput = null,
  saveButton = null,
  editButton = null,
  saveChangesButton = null,
  cancelEditButton = null,
  duplicateButton = null,
  renameButton = null,
  deleteButton = null,
  resetButton = null,
  status = null,
  translate = (key) => key,
  now = () => new Date().toISOString(),
  createId = defaultIdFactory,
} = {}) {
  if (!root?.dataset) throw new TypeError('A theme root element is required');

  const triggers = [...colorTriggers];
  const tokenResetButtons = [...resetTokenButtons];
  const listeners = [];
  let gridListeners = [];
  let library = defaultLibrary();
  let nameInputDirty = false;
  let editSession = null;

  function themeMap() {
    return new Map(library.customThemes.map((theme) => [theme.id, theme]));
  }

  function customTheme(themeId = library.activeThemeId) {
    return library.customThemes.find((theme) => theme.id === themeId) ?? null;
  }

  function baseTheme(themeId = library.activeThemeId) {
    return builtInBaseFor(themeId, themeMap());
  }

  function ownOverrides(themeId = library.activeThemeId) {
    const custom = customTheme(themeId);
    if (editSession?.themeId === themeId) return editSession.overrides;
    return custom?.overrides ?? {};
  }

  function storedCustomization(themeId = library.activeThemeId) {
    const custom = customTheme(themeId);
    if (!custom) return null;
    const effective = effectiveOverridesFor(custom.id, themeMap());
    return Object.keys(effective).length ? Object.freeze({ ...effective }) : null;
  }

  function currentCustomization() {
    if (editSession?.themeId === library.activeThemeId) {
      const effective = normalizeThemeCustomization(
        { ...editSession.inheritedOverrides, ...editSession.overrides },
        baseTheme().id,
      ) ?? {};
      return Object.keys(effective).length
        ? Object.freeze(effective)
        : null;
    }
    return storedCustomization();
  }

  function currentColors() {
    return Object.freeze({ ...baseTheme().preview, ...(currentCustomization() ?? {}) });
  }

  function persistLibrary() {
    writeStorage(storage, PRESENTATION_THEME_STORAGE_KEY, serializeThemeLibrary(library));
    removeStorage(storage, LEGACY_PRESENTATION_THEME_STORAGE_KEY);
  }

  function announce() {
    const view = root.ownerDocument?.defaultView;
    const ThemeEvent = view?.CustomEvent ?? globalThis.CustomEvent;
    if (typeof root.dispatchEvent !== 'function' || typeof ThemeEvent !== 'function') return;
    root.dispatchEvent(new ThemeEvent('riverline:themechange', {
      bubbles: true,
      detail: Object.freeze({
        theme: baseTheme().id,
        themeId: library.activeThemeId,
        customized: Boolean(currentCustomization()),
        customTheme: Boolean(customTheme()),
      }),
    }));
  }

  function renderThemeButton(documentRef, theme, isCustom) {
    const colors = isCustom
      ? { ...builtInBaseFor(theme.id, themeMap()).preview, ...effectiveOverridesFor(theme.id, themeMap()) }
      : theme.preview;
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = `theme-swatch-btn${isCustom ? ' theme-swatch-btn--custom' : ''}`;
    button.dataset.themeId = theme.id;
    button.style.setProperty('--swatch-bg', colors.surface);
    button.style.setProperty('--swatch-accent', colors.accent);
    button.setAttribute('aria-pressed', 'false');
    const copy = documentRef.createElement('span');
    copy.className = 'theme-swatch-copy';
    const dot = documentRef.createElement('span');
    dot.className = 'theme-swatch-dot';
    const name = documentRef.createElement('span');
    name.className = 'theme-swatch-name';
    name.dir = 'auto';
    if (isCustom) name.textContent = theme.name;
    else name.textContent = translate(theme.name);
    copy.append(dot, name);
    button.append(copy);
    const listener = () => apply(theme.id);
    button.addEventListener('click', listener);
    gridListeners.push([button, 'click', listener]);
    return button;
  }

  function renderThemeLibrary() {
    gridListeners.forEach(([target, type, listener]) => target.removeEventListener?.(type, listener));
    gridListeners = [];
    const builtInDocument = builtInGrid?.ownerDocument;
    if (builtInGrid && builtInDocument?.createElement) {
      builtInGrid.replaceChildren(...PRESENTATION_THEMES.map((theme) => renderThemeButton(builtInDocument, theme, false)));
    }
    const customDocument = customGrid?.ownerDocument;
    if (customGrid && customDocument?.createElement) {
      customGrid.replaceChildren(...library.customThemes.map((theme) => renderThemeButton(customDocument, theme, true)));
    }
    if (customEmpty) customEmpty.hidden = library.customThemes.length > 0;
  }

  function syncControls() {
    const colors = currentColors();
    const editing = editSession?.themeId === library.activeThemeId;
    triggers.forEach((trigger) => {
      const token = trigger.dataset.themeColorToken;
      const value = colors[token];
      if (!value) return;
      trigger.style?.setProperty?.('--theme-color-value', value);
      trigger.dataset.colorValue = value;
      trigger.setAttribute?.('aria-label', `${translate(trigger.dataset.labelKey ?? token)}: ${value}`);
      trigger.disabled = !editing;
      const valueElement = trigger.querySelector?.('[data-theme-color-value]');
      if (valueElement) valueElement.textContent = value.toUpperCase();
    });
    const own = ownOverrides();
    tokenResetButtons.forEach((button) => {
      button.disabled = !editing || !hasOwn(own, button.dataset.resetThemeToken);
    });
    const custom = customTheme();
    if (editButton) editButton.disabled = editing;
    if (saveChangesButton) saveChangesButton.disabled = !editing;
    if (cancelEditButton) cancelEditButton.disabled = !editing;
    if (saveButton) saveButton.disabled = !editing;
    if (duplicateButton) duplicateButton.disabled = editing;
    if (renameButton) renameButton.disabled = !editing || !custom;
    if (deleteButton) deleteButton.disabled = editing || !custom;
    if (resetButton) resetButton.disabled = !editing || Object.keys(own).length === 0;
    if (nameInput) {
      nameInput.disabled = !editing;
      if (!nameInputDirty) nameInput.value = editSession?.name ?? custom?.name ?? '';
    }
    root.dataset.themeCustomized = String(Boolean(currentCustomization()));
    root.dataset.themeEditing = String(editing);
    builtInGrid?.querySelectorAll?.('[data-theme-id]').forEach((button) => {
      const selected = button.dataset.themeId === library.activeThemeId;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
    customGrid?.querySelectorAll?.('[data-theme-id]').forEach((button) => {
      const selected = button.dataset.themeId === library.activeThemeId;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
    if (status) {
      status.textContent = editing
        ? translate(custom
          ? 'Editing a saved custom theme. Changes remain temporary until Save.'
          : 'Editing a built-in preview. Save creates a new custom theme; the built-in stays unchanged.')
        : translate(custom ? 'Using a saved custom theme.' : 'Using built-in theme defaults.');
    }
  }

  function commit({ persist = true, announce: shouldAnnounce = true, render = true } = {}) {
    const base = baseTheme();
    root.dataset.theme = base.id;
    root.dataset.presentationThemeId = library.activeThemeId;
    root.dataset.themeKind = customTheme() ? 'custom' : 'built-in';
    delete root.dataset.themePreview;
    applyCustomProperties(root, base, currentCustomization());
    if (render) renderThemeLibrary();
    syncControls();
    if (persist) persistLibrary();
    if (shouldAnnounce) announce();
    return library.activeThemeId;
  }

  function apply(value, options = {}) {
    const exists = THEME_BY_ID.has(value) || Boolean(customTheme(value));
    editSession = null;
    library.activeThemeId = exists ? value : DEFAULT_PRESENTATION_THEME;
    nameInputDirty = false;
    return commit(options);
  }

  function beginEdit() {
    if (editSession?.themeId === library.activeThemeId) return getEditState();
    const custom = customTheme();
    editSession = {
      themeId: library.activeThemeId,
      inheritedOverrides: custom
        ? { ...effectiveOverridesFor(custom.baseThemeId, themeMap()) }
        : {},
      overrides: { ...(custom?.overrides ?? {}) },
      name: custom?.name ?? '',
    };
    nameInputDirty = false;
    commit({ persist: false, render: false });
    return getEditState();
  }

  function cancelEdit() {
    if (!editSession) return false;
    editSession = null;
    nameInputDirty = false;
    commit({ persist: false, render: false });
    return true;
  }

  function normalizedProspective(partial) {
    const accepted = Object.fromEntries(Object.entries(partial ?? {})
      .filter(([key]) => SUPPORTED_COLOR_TOKENS.includes(key)));
    const effective = { ...(currentCustomization() ?? {}), ...accepted };
    return normalizeThemeCustomization(effective, baseTheme().id) ?? {};
  }

  function preview(partial) {
    const prospective = normalizedProspective(partial);
    root.dataset.themePreview = 'true';
    applyCustomProperties(root, baseTheme(), prospective);
    return Object.freeze({ ...baseTheme().preview, ...prospective });
  }

  function cancelPreview() {
    delete root.dataset.themePreview;
    applyCustomProperties(root, baseTheme(), currentCustomization());
    return currentColors();
  }

  function customize(partial, options = {}) {
    const accepted = Object.fromEntries(Object.entries(partial ?? {})
      .filter(([key]) => SUPPORTED_COLOR_TOKENS.includes(key)));
    if (Object.keys(accepted).length === 0) return currentCustomization();
    if (!editSession || editSession.themeId !== library.activeThemeId) beginEdit();
    editSession.overrides = normalizeThemeCustomization(
      { ...editSession.overrides, ...accepted },
      baseTheme().id,
    ) ?? {};
    commit({ ...options, persist: false, render: false });
    return currentCustomization();
  }

  function resetToken(token, options = {}) {
    if (!SUPPORTED_COLOR_TOKENS.includes(token)) return currentCustomization();
    if (!editSession || editSession.themeId !== library.activeThemeId) return currentCustomization();
    const next = { ...editSession.overrides };
    delete next[token];
    editSession.overrides = next;
    commit({ ...options, persist: false, render: false });
    return currentCustomization();
  }

  function reset(options = {}) {
    if (!editSession || editSession.themeId !== library.activeThemeId) return currentCustomization();
    editSession.overrides = {};
    commit({ ...options, persist: false, render: false });
    return currentCustomization();
  }

  function nextThemeId() {
    const used = new Set(library.customThemes.map((theme) => theme.id));
    let candidate = makeThemeId(createId);
    let attempt = 2;
    while (used.has(candidate)) {
      candidate = `${makeThemeId(createId)}-${attempt}`;
      attempt += 1;
    }
    return candidate;
  }

  function addCustomTheme(name, { sourceThemeId = library.activeThemeId, sourceOverrides = null } = {}) {
    if (library.customThemes.length >= CUSTOM_THEME_LIMIT) return null;
    const sourceCustom = customTheme(sourceThemeId);
    const sourceBase = builtInBaseFor(sourceThemeId, themeMap());
    const resolvedOverrides = sourceOverrides ?? (sourceCustom
      ? effectiveOverridesFor(sourceThemeId, themeMap())
      : {});
    const timestamp = now();
    const theme = {
      id: nextThemeId(),
      name: uniqueCustomThemeName(name, library.customThemes),
      baseThemeId: THEME_BY_ID.has(sourceThemeId) || sourceCustom ? sourceThemeId : sourceBase.id,
      overrides: normalizeThemeCustomization(resolvedOverrides, sourceBase.id) ?? {},
      version: CUSTOM_THEME_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    library.customThemes.push(theme);
    library.activeThemeId = theme.id;
    editSession = null;
    nameInputDirty = false;
    commit();
    return Object.freeze({ ...theme, overrides: Object.freeze({ ...theme.overrides }) });
  }

  function saveAsNew(name = nameInput?.value) {
    if (!editSession || editSession.themeId !== library.activeThemeId) return null;
    return addCustomTheme(name || editSession.name, {
      sourceThemeId: library.activeThemeId,
      sourceOverrides: currentCustomization() ?? {},
    });
  }

  function duplicateTheme(themeId = library.activeThemeId, name = null) {
    const source = customTheme(themeId) ?? THEME_BY_ID.get(themeId);
    if (!source) return null;
    const proposed = name || `${source.name.replace(/^Riverline /, '')} ${translate('Copy')}`;
    return addCustomTheme(proposed, { sourceThemeId: themeId });
  }

  function saveEdit(name = nameInput?.value) {
    if (!editSession || editSession.themeId !== library.activeThemeId) return null;
    const custom = customTheme();
    if (!custom) return saveAsNew(name);
    custom.overrides = normalizeThemeCustomization(editSession.overrides, baseTheme().id) ?? {};
    custom.name = uniqueCustomThemeName(name || editSession.name, library.customThemes, custom.id);
    custom.version += 1;
    custom.updatedAt = now();
    editSession = null;
    nameInputDirty = false;
    commit();
    return Object.freeze({ ...custom, overrides: Object.freeze({ ...custom.overrides }) });
  }

  function renameTheme(themeId = library.activeThemeId, name = nameInput?.value) {
    const custom = customTheme(themeId);
    if (!custom || editSession?.themeId !== themeId) return null;
    editSession.name = uniqueCustomThemeName(name, library.customThemes, custom.id);
    nameInputDirty = false;
    syncControls();
    return editSession.name;
  }

  function deleteTheme(themeId = library.activeThemeId) {
    const target = customTheme(themeId);
    if (!target) return false;
    const beforeMap = themeMap();
    const childAppearances = new Map(library.customThemes
      .filter((theme) => theme.baseThemeId === target.id)
      .map((theme) => [theme.id, effectiveOverridesFor(theme.id, beforeMap)]));
    library.customThemes = library.customThemes.filter((theme) => theme.id !== target.id);
    const afterMap = themeMap();
    library.customThemes.forEach((theme) => {
      if (theme.baseThemeId !== target.id) return;
      theme.baseThemeId = THEME_BY_ID.has(target.baseThemeId) || afterMap.has(target.baseThemeId)
        ? target.baseThemeId
        : DEFAULT_PRESENTATION_THEME;
      theme.overrides = normalizeThemeCustomization(
        childAppearances.get(theme.id),
        builtInBaseFor(theme.id, afterMap).id,
      ) ?? {};
      theme.version += 1;
      theme.updatedAt = now();
    });
    if (library.activeThemeId === target.id) {
      library.activeThemeId = THEME_BY_ID.has(target.baseThemeId) || afterMap.has(target.baseThemeId)
        ? target.baseThemeId
        : DEFAULT_PRESENTATION_THEME;
    }
    editSession = null;
    nameInputDirty = false;
    commit();
    return true;
  }

  function restore() {
    const stored = readThemeLibrary(storage, now());
    library = stored.library;
    editSession = null;
    commit({ persist: false, announce: false });
    if (stored.repair) persistLibrary();
    return library.activeThemeId;
  }

  function init() {
    restore();
    if (nameInput) {
      const listener = () => {
        nameInputDirty = true;
        if (editSession?.themeId === library.activeThemeId) editSession.name = nameInput.value;
      };
      nameInput.addEventListener?.('input', listener);
      listeners.push([nameInput, 'input', listener]);
    }
    if (editButton) {
      const listener = () => beginEdit();
      editButton.addEventListener?.('click', listener);
      listeners.push([editButton, 'click', listener]);
    }
    if (saveChangesButton) {
      const listener = () => saveEdit();
      saveChangesButton.addEventListener?.('click', listener);
      listeners.push([saveChangesButton, 'click', listener]);
    }
    if (cancelEditButton) {
      const listener = () => cancelEdit();
      cancelEditButton.addEventListener?.('click', listener);
      listeners.push([cancelEditButton, 'click', listener]);
    }
    if (saveButton) {
      const listener = () => saveAsNew();
      saveButton.addEventListener?.('click', listener);
      listeners.push([saveButton, 'click', listener]);
    }
    if (duplicateButton) {
      const listener = () => duplicateTheme(library.activeThemeId, nameInputDirty ? nameInput?.value : null);
      duplicateButton.addEventListener?.('click', listener);
      listeners.push([duplicateButton, 'click', listener]);
    }
    if (renameButton) {
      const listener = () => renameTheme();
      renameButton.addEventListener?.('click', listener);
      listeners.push([renameButton, 'click', listener]);
    }
    if (deleteButton) {
      const listener = () => deleteTheme();
      deleteButton.addEventListener?.('click', listener);
      listeners.push([deleteButton, 'click', listener]);
    }
    if (resetButton) {
      const listener = () => reset();
      resetButton.addEventListener?.('click', listener);
      listeners.push([resetButton, 'click', listener]);
    }
    tokenResetButtons.forEach((button) => {
      const listener = () => resetToken(button.dataset.resetThemeToken);
      button.addEventListener?.('click', listener);
      listeners.push([button, 'click', listener]);
    });
    return controller;
  }

  function refreshLabels() {
    renderThemeLibrary();
    syncControls();
  }

  function destroy() {
    listeners.splice(0).forEach(([element, type, listener]) => element.removeEventListener?.(type, listener));
    gridListeners.splice(0).forEach(([element, type, listener]) => element.removeEventListener?.(type, listener));
  }

  function getEditState() {
    if (!editSession) return null;
    return Object.freeze({
      themeId: editSession.themeId,
      name: editSession.name,
      overrides: Object.freeze({ ...editSession.overrides }),
      effectiveOverrides: Object.freeze({ ...(currentCustomization() ?? {}) }),
    });
  }

  const controller = Object.freeze({
    apply,
    beginEdit,
    cancelEdit,
    cancelPreview,
    customize,
    deleteTheme,
    destroy,
    duplicateTheme,
    getBaseTheme: () => baseTheme().id,
    getColors: currentColors,
    getCustomization: currentCustomization,
    getEditState,
    getLibrary: () => Object.freeze({
      activeThemeId: library.activeThemeId,
      customThemes: Object.freeze(library.customThemes.map((theme) => Object.freeze({
        ...theme,
        overrides: Object.freeze({ ...theme.overrides }),
      }))),
      draftsByTheme: Object.freeze({ ...library.draftsByTheme }),
    }),
    getTheme: () => library.activeThemeId,
    init,
    preview,
    refreshLabels,
    renameTheme,
    reset,
    resetToken,
    restore,
    saveEdit,
    saveAsNew,
  });
  return controller;
}
