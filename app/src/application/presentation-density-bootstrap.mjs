import { createPresentationDensityController } from './presentation-density.mjs';
import { createPresentationLayoutController } from './presentation-layout.mjs';
import { createPresentationThemeController } from './presentation-theme.mjs';
import { createRiverlineColorPicker } from './riverline-color-picker.mjs';
import { createCardPresentationController } from './card-presentation.mjs';

function activeLayoutWorkspace() {
  return document.querySelector('.mode-nav-item.active[data-navigation-id]')?.dataset.navigationId
    ?? 'unsupported';
}

function initializePresentationPreferences() {
  const themeController = createPresentationThemeController({
    root: document.documentElement,
    storage: window.localStorage,
    builtInGrid: document.querySelector('#themeSwatchGrid'),
    customGrid: document.querySelector('#customThemeGrid'),
    customEmpty: document.querySelector('#customThemeEmpty'),
    colorTriggers: document.querySelectorAll('[data-theme-color-token]'),
    resetTokenButtons: document.querySelectorAll('[data-reset-theme-token]'),
    nameInput: document.querySelector('#customThemeName'),
    saveButton: document.querySelector('#saveCustomTheme'),
    duplicateButton: document.querySelector('#duplicateTheme'),
    renameButton: document.querySelector('#renameCustomTheme'),
    deleteButton: document.querySelector('#deleteCustomTheme'),
    resetButton: document.querySelector('#resetThemeCustomization'),
    status: document.querySelector('#themeCustomizationStatus'),
    translate: (key) => window.t?.(key) ?? key,
  }).init();

  const colorPicker = createRiverlineColorPicker({
    dialog: document.querySelector('#riverlineColorPicker'),
    triggers: document.querySelectorAll('[data-theme-color-token]'),
    title: document.querySelector('#riverlineColorPickerTitle'),
    saturationValue: document.querySelector('#themeColorSaturationValue'),
    saturationValueHandle: document.querySelector('#themeColorSaturationValueHandle'),
    hue: document.querySelector('#themeColorHue'),
    hexInput: document.querySelector('#themeColorHex'),
    currentPreview: document.querySelector('#themeColorCurrentPreview'),
    newPreview: document.querySelector('#themeColorNewPreview'),
    presets: document.querySelectorAll('[data-color-picker-preset]'),
    applyButton: document.querySelector('#themeColorApply'),
    cancelButton: document.querySelector('#themeColorCancel'),
    getColor: (token) => themeController.getColors()[token],
    onPreview: (token, value) => themeController.preview({ [token]: value }),
    onApply: (token, value) => themeController.customize({ [token]: value }),
    onCancel: () => themeController.cancelPreview(),
    translate: (key) => window.t?.(key) ?? key,
  });

  const densityController = createPresentationDensityController({
    root: document.documentElement,
    storage: window.localStorage,
    buttons: document.querySelectorAll('[data-density-option]'),
    compactDisclosures: document.querySelectorAll('[data-density-collapse-in-compact]'),
  }).init();

  const cardPresentationController = createCardPresentationController({
    root: document.documentElement,
    storage: window.localStorage,
    eventTarget: window,
    fourColorToggle: document.querySelector('#fourColorDeckToggle'),
    faceStyleButtons: document.querySelectorAll('[data-card-face-style]'),
    backStyleButtons: document.querySelectorAll('[data-card-back-style]'),
    rankStyleButtons: document.querySelectorAll('[data-card-rank-style]'),
  }).init();

  const layoutController = createPresentationLayoutController({
    root: document.documentElement,
    storage: window.localStorage,
    buttons: document.querySelectorAll('[data-layout-preset-option]'),
    control: document.querySelector('[data-layout-preset-field]'),
    initialWorkspace: activeLayoutWorkspace(),
  }).init();

  let workspaceSyncQueued = false;
  const syncLayoutWorkspace = () => {
    if (workspaceSyncQueued) return;
    workspaceSyncQueued = true;
    queueMicrotask(() => {
      workspaceSyncQueued = false;
      layoutController.setWorkspace(activeLayoutWorkspace());
    });
  };
  const navigation = document.querySelector('.mode-navigation');
  if (navigation && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(syncLayoutWorkspace);
    observer.observe(navigation, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  window.RiverlinePresentationDensity = densityController;
  window.RiverlinePresentationLayout = layoutController;
  window.RiverlinePresentationTheme = themeController;
  window.RiverlineCardPresentation = cardPresentationController;
  window.RiverlineColorPicker = colorPicker;
  document.documentElement.addEventListener('riverline:themechange', () => {
    if (colorPicker.isOpen()) colorPicker.cancel();
  });
  window.addEventListener('riverline:languagechange', () => {
    themeController.refreshLabels();
    colorPicker.refreshLabels();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePresentationPreferences, { once: true });
} else {
  initializePresentationPreferences();
}
