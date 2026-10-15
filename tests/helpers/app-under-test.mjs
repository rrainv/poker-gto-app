// TEST-HYGIENE-001: one entry point for behavioural tests of the web app.
//
//   indexDocument()  - app/index.html parsed into the mini DOM (static markup)
//   appStyleSheet()  - app/styles.css parsed into a cascade model
//   bootApp()        - the whole app (index.html + bootstraps + logic.js) running
//
// Prefer these over reading source text: assert what the markup contains,
// what a selector resolves to, or what the running app does.

import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseHTML, visibleText, parseFragment } from './mini-dom.mjs';
import { appStyleSheet, StyleSheetModel } from './css-model.mjs';

export { bootApp } from './browser-app.mjs';
export { appStyleSheet, StyleSheetModel, parseFragment, visibleText };

const INDEX_URL = new URL('../../app/index.html', import.meta.url);

let staticIndex = null;
/** Static (unbooted) app/index.html as a queryable document; shared, do not mutate. */
export function indexDocument() {
  staticIndex ||= parseHTML(fs.readFileSync(INDEX_URL, 'utf8'));
  return staticIndex;
}

/** A fresh, mutable parse of app/index.html. */
export function freshIndexDocument() {
  return parseHTML(fs.readFileSync(INDEX_URL, 'utf8'));
}

/** Element by id in the static document, asserting it exists. */
export function element(id, document = indexDocument()) {
  const found = document.getElementById(id);
  assert.ok(found, `#${id} exists in app/index.html`);
  return found;
}

/** First element matching a selector, asserting it exists. */
export function one(selector, root = indexDocument()) {
  const found = root.querySelector(selector);
  assert.ok(found, `${selector} exists`);
  return found;
}

/** Normalized text content. */
export function text(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Whether an element precedes another in document order. */
export function precedes(first, second) {
  const order = (node) => {
    const path = [];
    for (let current = node; current?.parentNode; current = current.parentNode) {
      path.unshift(current.parentNode.childNodes.indexOf(current));
    }
    return path;
  };
  const left = order(first);
  const right = order(second);
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index];
  }
  return left.length < right.length;
}

/**
 * Assert the cascaded value of a CSS property for an exact selector.
 * `expected` may be a string (exact, whitespace-normalized) or a RegExp.
 */
export function assertDeclared(selector, property, expected, environment = {}, sheet = appStyleSheet()) {
  const actual = sheet.declared(selector, property, environment);
  const message = `${selector} { ${property} } at ${JSON.stringify(environment)}`;
  if (expected instanceof RegExp) assert.match(actual ?? '', expected, message);
  else assert.equal(actual, expected, message);
}

/** Assert the cascaded value of a property on a DOM element. */
export function assertCascaded(node, property, expected, options = {}, sheet = appStyleSheet()) {
  const actual = sheet.cascaded(node, property, options);
  const label = node.id ? `#${node.id}` : `<${node.localName} class="${node.className}">`;
  const message = `${label} { ${property} } with ${JSON.stringify(options)}`;
  if (expected instanceof RegExp) assert.match(actual ?? '', expected, message);
  else assert.equal(actual, expected, message);
}

/**
 * Count StrategyProvider resolves made by the page. Pass `probe.beforeScripts`
 * to bootApp(): the page's RiverlineStrategy bridge is wrapped as it is
 * installed so every provider it creates records resolve() calls while
 * `probe.count(fn)` runs. (The bridge and its providers are frozen, so they
 * are re-exposed as frozen copies with a counting resolve.)
 */
export function strategyProviderProbe() {
  const resolves = [];
  // Options each page provider was created with (in creation order).
  const providerOptions = [];
  let counting = false;
  return {
    resolves,
    providerOptions,
    beforeScripts(window) {
      const define = Object.defineProperty;
      Object.defineProperty = function instrumented(target, property, descriptor) {
        if (target === window && property === 'RiverlineStrategy' && descriptor?.value) {
          Object.defineProperty = define;
          const bridge = descriptor.value;
          const wrapped = Object.freeze({
            ...bridge,
            createProvider(options) {
              providerOptions.push(options);
              const provider = bridge.createProvider(options);
              return Object.freeze({
                ...provider,
                resolve(decisionContext, ...rest) {
                  if (counting) resolves.push(decisionContext);
                  return provider.resolve(decisionContext, ...rest);
                },
              });
            },
          });
          return define(target, property, { ...descriptor, value: wrapped });
        }
        return define(target, property, descriptor);
      };
    },
    /** Run `callback` (sync or async) and return the contexts resolved meanwhile. */
    async count(callback) {
      resolves.length = 0;
      counting = true;
      try {
        await callback();
      } finally {
        counting = false;
      }
      return [...resolves];
    },
  };
}
