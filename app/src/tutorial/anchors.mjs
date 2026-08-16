export const TUTORIAL_ANCHOR_ATTRIBUTE = 'data-tutorial-anchor';
const ANCHOR_PATTERN = /^[a-z][a-z0-9]*(?:[-:.][a-z0-9]+)*$/;

function elementIsVisible(element, readStyle) {
  if (!element?.isConnected) return false;
  const rect = element.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const style = readStyle?.(element);
  return !style || (style.display !== 'none' && style.visibility !== 'hidden');
}

export function createTutorialAnchorRegistry({
  root = globalThis.document,
  getComputedStyle = globalThis.getComputedStyle,
} = {}) {
  return Object.freeze({
    schemaVersion: 'tutorial-anchor-registry/v1',
    resolve(anchor) {
      if (typeof anchor !== 'string' || !ANCHOR_PATTERN.test(anchor)) {
        return Object.freeze({ status: 'missing', anchor, element: null });
      }
      const element = root?.querySelector?.(`[${TUTORIAL_ANCHOR_ATTRIBUTE}="${anchor}"]`) ?? null;
      if (!element) return Object.freeze({ status: 'missing', anchor, element: null });
      if (!elementIsVisible(element, getComputedStyle)) {
        return Object.freeze({ status: 'hidden', anchor, element });
      }
      return Object.freeze({ status: 'ready', anchor, element });
    },
  });
}

