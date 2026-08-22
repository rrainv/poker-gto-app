import { hexToRgb, normalizeHexColor } from './presentation-theme.mjs';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function rgbToHsv({ r, g, b }) {
  const channels = [r, g, b].map((value) => clamp(Number(value) || 0, 0, 255) / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta > 0) {
    if (maximum === channels[0]) hue = 60 * (((channels[1] - channels[2]) / delta) % 6);
    else if (maximum === channels[1]) hue = 60 * (((channels[2] - channels[0]) / delta) + 2);
    else hue = 60 * (((channels[0] - channels[1]) / delta) + 4);
  }
  return {
    h: hue < 0 ? hue + 360 : hue,
    s: maximum === 0 ? 0 : (delta / maximum) * 100,
    v: maximum * 100,
  };
}

export function hsvToHex({ h, s, v }) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = clamp(Number(s) || 0, 0, 100) / 100;
  const value = clamp(Number(v) || 0, 0, 100) / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = value - chroma;
  let channels;
  if (hue < 60) channels = [chroma, x, 0];
  else if (hue < 120) channels = [x, chroma, 0];
  else if (hue < 180) channels = [0, chroma, x];
  else if (hue < 240) channels = [0, x, chroma];
  else if (hue < 300) channels = [x, 0, chroma];
  else channels = [chroma, 0, x];
  return `#${channels.map((channel) => Math.round((channel + offset) * 255)
    .toString(16).padStart(2, '0')).join('')}`;
}

export function hexToHsv(value) {
  const rgb = hexToRgb(value);
  return rgb ? rgbToHsv(rgb) : null;
}

export function createRiverlineColorPicker({
  dialog,
  triggers = [],
  title = null,
  saturationValue = null,
  saturationValueHandle = null,
  hue = null,
  hexInput = null,
  currentPreview = null,
  newPreview = null,
  presets = [],
  applyButton = null,
  cancelButton = null,
  getColor = () => '#000000',
  onPreview = () => {},
  onApply = () => {},
  onCancel = () => {},
  translate = (key) => key,
} = {}) {
  if (!dialog) throw new TypeError('A color picker dialog is required');

  const triggerList = [...triggers];
  const presetList = [...presets];
  const listeners = [];
  let activeTrigger = null;
  let activeToken = null;
  let originalColor = null;
  let draftColor = null;
  let draftHsv = { h: 0, s: 0, v: 0 };
  let pointerId = null;

  function setPreview(element, value) {
    element?.style?.setProperty?.('--picker-preview-color', value);
    if (element) element.dataset.color = value;
  }

  function renderVisuals() {
    draftColor = hsvToHex(draftHsv);
    if (hexInput) {
      hexInput.value = draftColor.toUpperCase();
      hexInput.setAttribute?.('aria-invalid', 'false');
    }
    if (hue) hue.value = String(Math.round(draftHsv.h * 1000) / 1000);
    const pureHue = hsvToHex({ h: draftHsv.h, s: 100, v: 100 });
    saturationValue?.style?.setProperty?.('--picker-hue', pureHue);
    saturationValueHandle?.style?.setProperty?.('--picker-saturation', `${draftHsv.s}%`);
    saturationValueHandle?.style?.setProperty?.('--picker-value', `${100 - draftHsv.v}%`);
    saturationValue?.setAttribute?.('aria-valuenow', String(Math.round((draftHsv.s + draftHsv.v) / 2)));
    saturationValue?.setAttribute?.('aria-valuetext', `${Math.round(draftHsv.s)}% / ${Math.round(draftHsv.v)}%`);
    setPreview(newPreview, draftColor);
    if (applyButton) applyButton.disabled = false;
  }

  function syncVisuals({ preview = true } = {}) {
    renderVisuals();
    if (preview && activeToken) onPreview(activeToken, draftColor);
    return draftColor;
  }

  function setDraft(value, options = {}) {
    const normalized = normalizeHexColor(value);
    if (!normalized) return false;
    draftHsv = hexToHsv(normalized);
    syncVisuals(options);
    return true;
  }

  function refreshTitle() {
    if (!title || !activeTrigger) return;
    title.textContent = translate(activeTrigger.dataset.labelKey ?? 'Choose color');
  }

  function open(trigger) {
    const token = trigger?.dataset?.themeColorToken;
    if (!dialog.hidden && activeToken) close({ apply: false, restoreFocus: false });
    const current = normalizeHexColor(getColor(token));
    if (!token || !current) return false;
    if (activeTrigger && activeTrigger !== trigger) activeTrigger.setAttribute?.('aria-expanded', 'false');
    activeTrigger = trigger;
    activeToken = token;
    originalColor = current;
    setPreview(currentPreview, current);
    setDraft(current, { preview: false });
    refreshTitle();
    dialog.hidden = false;
    dialog.dataset.colorToken = token;
    trigger.setAttribute?.('aria-expanded', 'true');
    dialog.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    saturationValue?.focus?.();
    return true;
  }

  function endPointerInteraction({ release = true } = {}) {
    if (pointerId === null) return;
    if (release) saturationValue?.releasePointerCapture?.(pointerId);
    pointerId = null;
  }

  function close({ apply = false, restoreFocus = true } = {}) {
    if (!activeToken || dialog.hidden) return false;
    const trigger = activeTrigger;
    const token = activeToken;
    const color = draftColor;
    const original = originalColor;
    endPointerInteraction();
    dialog.hidden = true;
    delete dialog.dataset.colorToken;
    trigger?.setAttribute?.('aria-expanded', 'false');
    activeTrigger = null;
    activeToken = null;
    originalColor = null;
    if (apply) onApply(token, color);
    else onCancel(token, original);
    if (restoreFocus) trigger?.focus?.();
    return true;
  }

  function updateSaturationValue(clientX, clientY) {
    const bounds = saturationValue?.getBoundingClientRect?.();
    if (!bounds?.width || !bounds?.height) return;
    const rtl = saturationValue.ownerDocument?.documentElement?.dir === 'rtl';
    const right = Number.isFinite(bounds.right) ? bounds.right : bounds.left + bounds.width;
    const horizontal = rtl ? (right - clientX) : (clientX - bounds.left);
    draftHsv.s = clamp((horizontal / bounds.width) * 100, 0, 100);
    draftHsv.v = clamp((1 - ((clientY - bounds.top) / bounds.height)) * 100, 0, 100);
    syncVisuals();
  }

  function bind(target, type, listener, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    listeners.push([target, type, listener, options]);
  }

  function focusableElements() {
    return [...(dialog.querySelectorAll?.('button:not([disabled]), input:not([disabled]), [tabindex="0"]') ?? [])]
      .filter((element) => !element.hidden);
  }

  triggerList.forEach((trigger) => bind(trigger, 'click', () => open(trigger)));
  presetList.forEach((preset) => bind(preset, 'click', () => setDraft(preset.dataset.colorPickerPreset)));
  bind(hue, 'input', () => {
    draftHsv.h = clamp(Number(hue.value), 0, 360);
    syncVisuals();
  });
  bind(hexInput, 'input', () => {
    const valid = setDraft(hexInput.value);
    if (!valid) {
      hexInput.setAttribute?.('aria-invalid', 'true');
      if (applyButton) applyButton.disabled = true;
    }
  });
  bind(hexInput, 'keydown', (event) => {
    if (event.key !== 'Enter' || applyButton?.disabled) return;
    event.preventDefault();
    close({ apply: true });
  });
  bind(saturationValue, 'pointerdown', (event) => {
    if (pointerId !== null && pointerId !== event.pointerId) return;
    event.preventDefault();
    pointerId = event.pointerId;
    saturationValue.setPointerCapture?.(pointerId);
    updateSaturationValue(event.clientX, event.clientY);
  });
  bind(saturationValue, 'pointermove', (event) => {
    if (pointerId !== event.pointerId) return;
    updateSaturationValue(event.clientX, event.clientY);
  });
  bind(saturationValue, 'pointerup', (event) => {
    if (pointerId !== event.pointerId) return;
    updateSaturationValue(event.clientX, event.clientY);
    endPointerInteraction();
  });
  bind(saturationValue, 'pointercancel', (event) => {
    if (pointerId !== event.pointerId) return;
    endPointerInteraction();
  });
  bind(saturationValue, 'lostpointercapture', (event) => {
    if (pointerId !== event.pointerId) return;
    endPointerInteraction({ release: false });
  });
  bind(saturationValue, 'keydown', (event) => {
    const amount = event.shiftKey ? 5 : 1;
    const rtl = saturationValue.ownerDocument?.documentElement?.dir === 'rtl';
    if (event.key === 'ArrowLeft') draftHsv.s = clamp(draftHsv.s + (rtl ? amount : -amount), 0, 100);
    else if (event.key === 'ArrowRight') draftHsv.s = clamp(draftHsv.s + (rtl ? -amount : amount), 0, 100);
    else if (event.key === 'ArrowDown') draftHsv.v = clamp(draftHsv.v - amount, 0, 100);
    else if (event.key === 'ArrowUp') draftHsv.v = clamp(draftHsv.v + amount, 0, 100);
    else return;
    event.preventDefault();
    syncVisuals();
  });
  bind(applyButton, 'click', () => close({ apply: true }));
  bind(cancelButton, 'click', () => close({ apply: false }));
  bind(dialog, 'keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close({ apply: false });
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    const active = dialog.ownerDocument?.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus?.();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus?.();
    }
  });

  function refreshLabels() {
    refreshTitle();
  }

  function destroy() {
    listeners.splice(0).forEach(([target, type, listener, options]) => {
      target.removeEventListener?.(type, listener, options);
    });
  }

  return Object.freeze({
    cancel: () => close({ apply: false }),
    destroy,
    getColor: () => draftColor,
    getToken: () => activeToken,
    isOpen: () => !dialog.hidden,
    open,
    refreshLabels,
    setDraft,
  });
}
