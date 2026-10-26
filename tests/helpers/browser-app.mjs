// TEST-HYGIENE-001: boots the real Riverline web app (app/index.html, its
// module bootstraps and classic scripts, including app/src/core/logic.js)
// inside Node on the mini DOM, so tests can drive behaviour instead of
// matching source text.
//
// The process global becomes the browser window (as in a page), so a test
// file may boot the app once. Timers and animation frames are fake and are
// advanced explicitly with `flush()` / `advance(ms)`.

import fs from 'node:fs';
import vm from 'node:vm';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as dom from './mini-dom.mjs';
import { appStyleSheet } from './css-model.mjs';
import { createFakeIndexedDB, IDBKeyRange } from './fake-indexeddb.mjs';

const APP_ROOT = new URL('../../app/', import.meta.url);
// Platform path of app/ with forward slashes: stack frames show either a file
// URL (modules) or a platform path (classic scripts); both contain this once
// backslashes are normalized.
const APP_ROOT_PATH = fileURLToPath(APP_ROOT).replace(/\\/g, '/');

/** Whether a stack frame line belongs to the given app file (e.g. 'src/core/logic.js'), on any platform. */
export function frameIsAppFile(frame, appRelativePath) {
  return String(frame || '').replace(/\\/g, '/').includes(`${APP_ROOT_PATH}${appRelativePath}`);
}

/* ----------------------------------------------------------- fake timers */

function createClock(start = Date.parse('2026-09-01T12:00:00.000Z')) {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  const clock = {
    wallStart: start,
    get now() { return now; },
    setTimeout(callback, delay = 0, ...args) {
      const id = nextId += 1;
      timers.set(id, { id, at: now + Math.max(0, Number(delay) || 0), callback, args, interval: null });
      return id;
    },
    setInterval(callback, delay = 0, ...args) {
      const id = nextId += 1;
      const interval = Math.max(1, Number(delay) || 0);
      timers.set(id, { id, at: now + interval, callback, args, interval });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) {
      const id = nextId += 1;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    pendingTimers() { return timers.size; },
    pendingFrames() { return frames.size; },
    runFrames() {
      const batch = [...frames];
      frames.clear();
      for (const [, callback] of batch) callback(now);
      return batch.length;
    },
    /** Run timers due within `ms` (in order), including ones they schedule. */
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.values()].filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        now = due.at;
        if (due.interval) due.at += due.interval;
        else timers.delete(due.id);
        due.callback(...due.args);
      }
      now = target;
    },
  };
  clock.clearInterval = clock.clearTimeout;
  return clock;
}

/* -------------------------------------------------------------- storage */

export function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] ?? null; },
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
    _entries() { return Object.fromEntries(map); },
  };
}

/* ------------------------------------------------------------ observers */

function observerClass(registry) {
  return class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); registry.add(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); registry.delete(this); }
    takeRecords() { return []; }
  };
}

function mutationObserverClass(document) {
  return class MutationObserver {
    constructor(callback) { this.callback = callback; this.records = []; this.options = new Map(); this.scheduled = false; }
    observe(target, options = {}) { this.options.set(target, options); document._mutationObservers.add(this); }
    disconnect() { this.options.clear(); document._mutationObservers.delete(this); }
    takeRecords() { const records = this.records; this.records = []; return records; }
    _record(target, type, attributeName, oldValue, nodes) {
      for (const [root, options] of this.options) {
        if (!(root === target || (options.subtree && root.contains(target)))) continue;
        if (type === 'attributes' && !options.attributes && !options.attributeFilter) continue;
        if (type === 'attributes' && options.attributeFilter && !options.attributeFilter.includes(attributeName)) continue;
        if (type === 'childList' && !options.childList) continue;
        this.records.push({ type, target, attributeName, oldValue, addedNodes: [...nodes.addedNodes], removedNodes: [...nodes.removedNodes] });
        if (!this.scheduled) {
          this.scheduled = true;
          queueMicrotask(() => {
            this.scheduled = false;
            const records = this.takeRecords();
            if (records.length) this.callback(records, this);
          });
        }
        return;
      }
    }
  };
}

/* ---------------------------------------------------------------- window */

function mediaQueryEvaluator(environment) {
  return (query) => {
    const listeners = new Set();
    let matches = false;
    try {
      const sheet = appStyleSheet();
      const probe = { type: 'media', query: query.replace(/^\s*@media\s*/, '') };
      matches = sheet && probe.query ? (() => {
        const { conditionsApply } = environment.__conditions;
        return conditionsApply([probe], sheet.environment(environment.media));
      })() : false;
    } catch {
      matches = false;
    }
    return {
      matches, media: query, onchange: null,
      addEventListener: (_, listener) => listeners.add(listener),
      removeEventListener: (_, listener) => listeners.delete(listener),
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    };
  };
}

const ELEMENT_INTERFACES = ['HTMLElement', 'HTMLDivElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement',
  'HTMLTextAreaElement', 'HTMLFormElement', 'HTMLAnchorElement', 'HTMLSpanElement', 'HTMLCanvasElement', 'HTMLImageElement',
  'HTMLTemplateElement', 'HTMLDialogElement', 'HTMLLabelElement', 'HTMLOptionElement', 'HTMLTableElement', 'HTMLDetailsElement',
  'HTMLMediaElement', 'HTMLAudioElement', 'SVGElement', 'SVGSVGElement'];

function installGlobals(target, { document, clock, storage, sessionStorage, environment, errors, url }) {
  const assign = (name, value) => Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: true });
  assign('window', target);
  assign('self', target);
  assign('document', document);
  document.defaultView = target;
  for (const name of ['Event', 'CustomEvent', 'UIEvent', 'FocusEvent', 'MouseEvent', 'PointerEvent', 'WheelEvent', 'KeyboardEvent', 'InputEvent', 'SubmitEvent', 'Node', 'Text', 'Comment', 'Element', 'Document', 'DocumentFragment', 'EventTarget']) {
    assign(name, dom[name]);
  }
  for (const name of ELEMENT_INTERFACES) assign(name, dom.Element);
  assign('setTimeout', clock.setTimeout);
  assign('clearTimeout', clock.clearTimeout);
  assign('setInterval', clock.setInterval);
  assign('clearInterval', clock.clearInterval);
  assign('requestAnimationFrame', clock.requestAnimationFrame);
  assign('cancelAnimationFrame', clock.cancelAnimationFrame);
  assign('requestIdleCallback', (callback) => clock.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 1));
  assign('cancelIdleCallback', clock.clearTimeout);
  assign('localStorage', storage);
  assign('sessionStorage', sessionStorage);
  assign('innerWidth', environment.width);
  assign('innerHeight', environment.height);
  assign('outerWidth', environment.width);
  assign('outerHeight', environment.height);
  assign('devicePixelRatio', 1);
  assign('scrollX', 0);
  assign('scrollY', 0);
  assign('pageXOffset', 0);
  assign('pageYOffset', 0);
  assign('screen', { width: environment.width, height: environment.height, availWidth: environment.width, availHeight: environment.height, orientation: { type: 'landscape-primary', addEventListener() {} } });
  assign('scrollTo', () => {});
  assign('scrollBy', () => {});
  assign('scroll', () => {});
  assign('focus', () => {});
  assign('blur', () => {});
  assign('print', () => {});
  assign('alert', () => {});
  assign('confirm', () => environment.confirm ?? true);
  assign('prompt', () => environment.prompt ?? null);
  assign('open', () => null);
  assign('close', () => {});
  assign('getSelection', () => document.getSelection());
  assign('matchMedia', mediaQueryEvaluator(environment));
  assign('getComputedStyle', (element, pseudoElement = null) => computedStyle(element, pseudoElement, environment));
  assign('ResizeObserver', observerClass(environment.resizeObservers));
  assign('IntersectionObserver', observerClass(environment.intersectionObservers));
  assign('MutationObserver', mutationObserverClass(document));
  assign('DOMParser', class { parseFromString(markup) { return dom.parseHTML(markup); } });
  assign('CSS', { escape: (value) => String(value).replace(/([^\w-])/g, '\\$1'), supports: () => true });
  assign('Image', class extends dom.Element { constructor() { super('img', document); } });
  assign('Audio', class { constructor() { this.paused = true; } play() { return Promise.resolve(); } pause() {} load() {} addEventListener() {} });
  assign('location', Object.assign(new URL(url), { assign() {}, replace() {}, reload() {} }));
  assign('history', { length: 1, state: null, pushState() {}, replaceState() {}, back() {}, forward() {}, go() {} });
  assign('addEventListener', dom.EventTarget.prototype.addEventListener);
  assign('removeEventListener', dom.EventTarget.prototype.removeEventListener);
  assign('dispatchEvent', dom.EventTarget.prototype.dispatchEvent);
  assign('_invokeListeners', dom.EventTarget.prototype._invokeListeners);
  assign('_eventParent', () => null);
  assign('_listeners', new Map());
  assign('listenerCount', dom.EventTarget.prototype.listenerCount);
  assign('__miniDomErrors', errors);
  assign('__canvasContext', (canvas) => canvasContext(canvas));
  assign('__layoutRect', layoutRect(document, environment));
  assign('fetch', async () => { throw new Error('network disabled in tests'); });
  assign('indexedDB', createFakeIndexedDB());
  assign('IDBKeyRange', IDBKeyRange);
  Object.defineProperty(target, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (riverline-test-dom) Firefox/140.0', language: environment.language || 'en-US',
      languages: [environment.language || 'en-US'], platform: 'Linux', onLine: true, hardwareConcurrency: 4,
      maxTouchPoints: 0, clipboard: { writeText: async () => {} }, vibrate: () => false, storage: undefined,
      userAgentData: undefined, mediaDevices: undefined,
    },
    writable: true, configurable: true,
  });
}

/**
 * Approximate layout: there is no layout engine, but code that asks whether
 * an element is rendered (tutorial anchors, focus traps) gets a non-zero box
 * for connected elements that neither are hidden nor resolve to display:none
 * (self or ancestors). Sizes are nominal. Results are memoized per DOM version.
 */
function layoutRect(document, environment) {
  const selfCache = new WeakMap();
  const cache = new WeakMap();
  // The element itself generates a box (ignoring ancestors).
  const rendersSelf = (element) => {
    if (!element || element.nodeType !== 1) return true;
    const memo = selfCache.get(element);
    if (memo && memo.version === document._version) return memo.value;
    let value = !element.hasAttribute('hidden') && element.style.getPropertyValue('display') !== 'none';
    if (value) value = appStyleSheet().cascaded(element, 'display', { environment: environment.media }) !== 'none';
    selfCache.set(element, { version: document._version, value });
    return value;
  };
  const rendered = (element) => {
    if (!element || element.nodeType !== 1) return true;
    if (element === document.documentElement) return true;
    const memo = cache.get(element);
    if (memo && memo.version === document._version) return memo.value;
    const value = element.isConnected && rendersSelf(element) && rendered(element.parentNode);
    cache.set(element, { version: document._version, value });
    return value;
  };
  return Object.assign((element) => (rendered(element) ? { x: 0, y: 0, width: 120, height: 24 } : null), { rendersSelf });
}

function canvasContext() {
  const noop = () => {};
  return new Proxy({ canvas: null, measureText: (text) => ({ width: String(text).length * 7 }), getImageData: () => ({ data: [] }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), createPattern: () => null }, {
    get(object, key) { return key in object ? object[key] : noop; },
    set(object, key, value) { object[key] = value; return true; },
  });
}

function computedStyle(element, pseudoElement, environment) {
  const sheet = appStyleSheet();
  const options = { environment: environment.media, pseudoElement: pseudoElement ? pseudoElement.replace(/^:+/, '') : null };
  const read = (property) => {
    if (!element || element.nodeType !== 1) return '';
    if (property === 'display' && element.hidden && !sheet.cascaded(element, 'display', options)) return 'none';
    try {
      return sheet.resolved(element, property, options) ?? '';
    } catch {
      return '';
    }
  };
  return new Proxy({ getPropertyValue: read }, {
    get(object, key) {
      if (key === 'getPropertyValue') return read;
      if (typeof key !== 'string') return undefined;
      return read(key.startsWith('--') ? key : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    },
  });
}

/* ---------------------------------------------------------------- scripts */

function scriptSources(document) {
  return document.querySelectorAll('script[src]').map((script) => ({
    src: script.getAttribute('src').replace(/\?.*$/, ''),
    module: script.getAttribute('type') === 'module',
  }));
}

export const DEFAULT_SKIP_SCRIPTS = Object.freeze([
  // Third-party bundle; the app treats a missing Supabase client as signed-out/offline.
  'node_modules/@supabase/supabase-js/dist/umd/supabase.js',
]);

let booted = null;

/**
 * Boot the app once per process. Options:
 *  - width/height: viewport (also used for media queries)
 *  - storage: initial localStorage entries
 *  - oriented: false to start as a first-time user (welcome orientation unseen)
 *  - language: navigator language
 *  - media: extra media environment (reducedMotion, ...)
 *  - skipScripts: script srcs not to run
 *  - beforeScripts(window): hook to install fakes before scripts run
 *  - init: run DOMContentLoaded + the app's deferred init (default true)
 *  - allowBootErrors: collect listener errors raised while booting in
 *    `bootErrors` instead of failing the boot (for tests that assert on them)
 *
 * Errors thrown by page event listeners (which the mini DOM catches, as a
 * browser reports them without stopping dispatch) fail the test: every
 * harness interaction (click, setValue, key, dispatch, settle, flush,
 * advance, waitFor) throws if new errors were raised, and a final check runs
 * when the test file ends. A test that expects errors wraps the interaction in
 * `app.expectErrors(async () => ...)`, which returns them.
 */
export async function bootApp(options = {}) {
  if (booted) {
    if (options && Object.keys(options).length) throw new Error('bootApp() may only be configured once per test process');
    return booted;
  }
  const html = fs.readFileSync(new URL('index.html', APP_ROOT), 'utf8');
  const document = dom.parseHTML(html);
  document.readyState = 'loading';
  const clock = createClock();
  const errors = [];
  const { conditionsApply } = await import('./css-model.mjs');
  const environment = {
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    language: options.language,
    media: { width: options.width ?? 1920, height: options.height ?? 1080, ...(options.media || {}) },
    resizeObservers: new Set(),
    intersectionObservers: new Set(),
    __conditions: { conditionsApply },
  };
  const initialStorage = { ...(options.storage || {}) };
  // Returning user by default: the first-use welcome orientation is complete.
  if (options.oriented !== false && !('riverline.welcomeOrientation.v1' in initialStorage)) {
    initialStorage['riverline.welcomeOrientation.v1'] = JSON.stringify({
      schemaVersion: 'welcome-orientation/v1', localOwnerId: 'local', status: 'completed',
      completedAt: '2026-09-01T00:00:00.000Z', completionReason: 'test_boot', destination: 'home',
    });
  }
  const storage = createStorage(initialStorage);
  const session = createStorage(options.sessionStorage);
  const url = new URL('index.html', APP_ROOT).href;
  installGlobals(globalThis, { document, clock, storage, sessionStorage: session, environment, errors, url });
  const realDate = Date;
  const consoleErrors = [];
  const originalError = console.error;
  console.error = (...args) => { consoleErrors.push(args); if (options.verbose) originalError(...args); };
  const originalWarn = console.warn;
  console.warn = (...args) => { if (options.verbose) originalWarn(...args); };
  // The page's diagnostic logging is captured, not printed (pass verbose: true to see it).
  const consoleLogs = [];
  const appSource = new URL('../../app/', import.meta.url).pathname;
  const fromApp = () => (new Error().stack || '').split('\n')[3]?.includes(appSource);
  for (const method of ['log', 'info', 'debug']) {
    const original = console[method];
    console[method] = (...args) => {
      if (!fromApp() || options.verbose) original(...args);
      else consoleLogs.push(args);
    };
  }

  options.beforeScripts?.(globalThis);

  const skip = new Set([...DEFAULT_SKIP_SCRIPTS, ...(options.skipScripts || [])]);
  // A skipped script the page appends at runtime fails to load, as a missing
  // file would in a browser (the page awaits its load/error outcome).
  const appendToHead = document.head.appendChild.bind(document.head);
  document.head.appendChild = (node) => {
    const src = node?.localName === 'script' ? node.getAttribute('src')?.replace(/\?.*$/, '') : null;
    appendToHead(node);
    if (src && skip.has(src)) queueMicrotask(() => node.onerror?.(new dom.Event('error')));
    return node;
  };
  const sources = scriptSources(document);
  // Classic non-deferred scripts run first, then module/defer scripts in order
  // (modules and deferred classic scripts share document order).
  const immediate = sources.filter((script) => !script.module && !document.querySelector(`script[src^="${script.src}"]`).hasAttribute('defer'));
  const deferred = sources.filter((script) => !immediate.includes(script));
  if (!process.emitWarning.__riverlineFiltered) {
    // The harness's dynamic-import loader option is flagged experimental;
    // keep that one warning out of the app's captured console output.
    const emitWarning = process.emitWarning;
    process.emitWarning = Object.assign(function filtered(warning, ...rest) {
      if (String(warning?.message ?? warning).includes('USE_MAIN_CONTEXT_DEFAULT_LOADER')) return undefined;
      return emitWarning.call(process, warning, ...rest);
    }, { __riverlineFiltered: true });
  }
  const runClassic = (src) => {
    const file = new URL(src, APP_ROOT);
    const code = fs.readFileSync(file, 'utf8');
    // Classic scripts' dynamic import() resolves through Node's default loader
    // (the same module instances the page's module scripts use).
    vm.runInThisContext(code, { filename: fileURLToPath(file), importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER });
  };
  for (const script of immediate) if (!skip.has(script.src)) runClassic(script.src);
  for (const script of deferred) {
    if (skip.has(script.src)) continue;
    // Modules are singletons, as in the page. A test file that boots the app
    // must not import a self-installing bootstrap before bootApp() (it would
    // have run without a window); import it after booting instead.
    try {
      if (script.module) await import(new URL(script.src, APP_ROOT).href);
      else runClassic(script.src);
    } catch (error) {
      error.message = `${error.message}\n[bootApp] while loading ${script.src}. If a bridge is missing, the test file`
        + ' probably imported a self-installing bootstrap module before bootApp(); import it after booting instead.';
      throw error;
    }
  }
  document.readyState = 'interactive';
  const harness = createHarness({ document, clock, errors, consoleErrors, storage, environment, realDate });
  const boot = async () => {
    if (options.init !== false) {
      document.dispatchEvent(new dom.Event('DOMContentLoaded', { bubbles: true }));
      document.readyState = 'complete';
      globalThis.dispatchEvent(new dom.Event('load'));
      await harness.settle();
    }
  };
  if (options.allowBootErrors) {
    harness.bootErrors = await harness.expectErrors(boot);
  } else {
    await boot();
    harness.checkErrors('while booting');
  }
  // Last line of defence for errors raised outside harness interactions
  // (e.g. timers advanced by the test's own code).
  after(() => harness.checkErrors('by the end of the test file'));
  booted = harness;
  return harness;
}

function describe(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes = [...(element.classList || [])].slice(0, 2).map((name) => `.${name}`).join('');
  return `<${element.localName}${id}${classes}>`;
}

function createHarness({ document, clock, errors, consoleErrors, storage, environment }) {
  let expecting = 0;
  const harness = {
    window: globalThis,
    document,
    clock,
    errors,
    consoleErrors,
    storage,
    environment,
    $: (selector) => document.querySelector(selector),
    $$: (selector) => document.querySelectorAll(selector),
    byId: (id) => document.getElementById(id),
    /** Evaluate an expression in the page's global scope (sees logic.js consts). */
    evaluate: (expression) => vm.runInThisContext(expression),
    /**
     * Throw if page listeners raised errors that no `expectErrors` consumed.
     * The errors are cleared so one failure does not cascade into later tests.
     */
    checkErrors(context = 'during the last interaction') {
      if (expecting || !errors.length) return;
      const raised = errors.splice(0);
      throw new Error(`page listener raised ${raised.length} uncaught error(s) ${context}:\n`
        + raised.map((error) => `  ${error?.stack || error}`).join('\n'), { cause: raised[0] });
    },
    /** Run `fn` allowing page listener errors; returns the errors it raised. */
    async expectErrors(fn) {
      const before = errors.length;
      expecting += 1;
      try {
        await fn();
      } finally {
        expecting -= 1;
      }
      return errors.splice(before);
    },
    /** Call a page-global function (e.g. a logic.js function declaration). */
    call: (name, ...args) => {
      const fn = vm.runInThisContext(name);
      if (typeof fn !== 'function') throw new TypeError(`${name} is not a page function`);
      return fn(...args);
    },
    /** Let promises, timers (up to `ms`) and animation frames run. */
    async settle(ms = 1000) {
      for (let round = 0; round < 20; round += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        clock.runFrames();
        clock.advance(Math.ceil(ms / 20));
        await new Promise((resolve) => setImmediate(resolve));
      }
      clock.runFrames();
      await new Promise((resolve) => setImmediate(resolve));
      harness.checkErrors();
    },
    /**
     * Settle until `predicate()` is truthy, bounded by real time (work that
     * resolves outside the fake clock, e.g. module-level async strategy
     * resolution, can take longer under parallel test load). Throws on timeout.
     */
    async waitFor(predicate, description = 'condition', { timeoutMs = 10000, stepMs = 50 } = {}) {
      const deadline = performance.now() + timeoutMs;
      for (;;) {
        const value = predicate();
        if (value) return value;
        if (performance.now() > deadline) throw new Error(`waitFor: timed out after ${timeoutMs}ms waiting for ${description}`);
        await harness.settle(stepMs);
      }
    },
    async flush() {
      for (let round = 0; round < 5; round += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        clock.runFrames();
        clock.advance(0);
      }
      harness.checkErrors();
    },
    advance(ms) { clock.advance(ms); clock.runFrames(); harness.checkErrors(); },
    /**
     * A user click. Like a pointer, it can only reach an element that is
     * shown, not inert and not behind an open modal dialog; otherwise this
     * throws (pass `{ force: true }` to dispatch anyway, e.g. to test a guard).
     * A disabled control ignores the click, as in browsers.
     */
    async click(target, { force = false } = {}) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      if (!element) throw new Error(`click: no element for ${target}`);
      if (!force) {
        const reason = harness.unclickableReason(element);
        if (reason) throw new Error(`click: ${describe(element)} is not clickable (${reason})`);
      }
      element.click();
      await harness.flush();
      return element;
    },
    /** Which element (self or ancestor) hides `element`, and how. */
    hiddenBy(element) {
      const sheet = appStyleSheet();
      for (let node = element; node?.nodeType === 1; node = node.parentNode) {
        const where = node === element ? 'itself' : describe(node);
        if (node.hasAttribute('hidden')) return `${where} has the hidden attribute`;
        if (node.style.getPropertyValue('display') === 'none') return `${where} has inline display:none`;
        const explain = {};
        if (sheet.cascaded(node, 'display', { environment: environment.media, explain }) === 'none') {
          const conditions = explain.rule?.conditions?.map((entry) => `@${entry.type} ${entry.query ?? ''}`).join(' ') || '';
          return `${where} is display:none by "${explain.rule?.selectorText}"${conditions ? ` (${conditions.trim()})` : ''}`;
        }
      }
      return 'visibility:hidden';
    },
    /** Why a user could not click `element` (null when they could). */
    unclickableReason(element) {
      if (!element.isConnected) return 'not connected';
      if (element.closest('[inert]')) return 'inert';
      if (!dom.isRendered(element)) return `not shown: ${harness.hiddenBy(element)}`;
      const modal = document.querySelectorAll('dialog[open]').find((dialog) => dialog._modal);
      if (modal && !modal.contains(element)) return 'behind an open modal dialog';
      return null;
    },
    async setValue(target, value, { events = ['input', 'change'] } = {}) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      if (!element) throw new Error(`setValue: no element for ${target}`);
      element.value = value;
      for (const type of events) element.dispatchEvent(new dom.Event(type, { bubbles: true }));
      await harness.flush();
      return element;
    },
    async key(target, key, init = {}) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      element.dispatchEvent(new dom.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
      element.dispatchEvent(new dom.KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...init }));
      await harness.flush();
    },
    /**
     * Wrap page-global functions (logic.js function declarations) with call
     * counters. Calls made by the page itself go through the wrapper.
     */
    spy(names) {
      const calls = {};
      const originals = {};
      const sequence = [];
      for (const name of names) {
        const original = globalThis[name];
        if (typeof original !== 'function') throw new TypeError(`spy: ${name} is not a page function`);
        originals[name] = original;
        calls[name] = [];
        globalThis[name] = function spied(...args) {
          calls[name].push(args);
          sequence.push(name);
          return original.apply(this, args);
        };
      }
      return {
        calls,
        /** Names in call order. */
        sequence,
        count: (name) => calls[name].length,
        total: () => Object.values(calls).reduce((sum, list) => sum + list.length, 0),
        reset() { for (const name of names) calls[name].length = 0; sequence.length = 0; },
        restore() { for (const name of names) globalThis[name] = originals[name]; },
      };
    },
    /**
     * Proxy `target` and record the property keys read directly (immediate
     * caller frame) by the given app file. Callers should also assert a key
     * the file is known to read, so an empty set cannot pass vacuously.
     */
    trackReads(target, appFile = 'src/core/logic.js') {
      const reads = new Set();
      const proxy = new Proxy(target, {
        get(object, key, receiver) {
          if (frameIsAppFile((new Error().stack || '').split('\n')[2], appFile)) reads.add(key);
          return Reflect.get(object, key, receiver);
        },
      });
      return { proxy, reads };
    },
    /** Choose cards through the real card-set picker UI and apply them. */
    async pickCards(editTarget, cards) {
      await harness.click(editTarget);
      for (const card of cards) await harness.click(`[data-deck-card="${card}"]`);
      await harness.click('#cardSetPickerApply');
      await harness.settle(200);
    },
    /** Start a canonical Hand with Hero's private cards and begin betting. */
    async startHand(heroCards = ['As', 'Kd']) {
      await harness.navigate('hand');
      const current = harness.call('callPlaybookStateBridge', 'getState');
      if (current) {
        // A finished hand offers New hand; a live one is aborted (the confirm
        // dialog answers yes).
        const finished = current.phase === 'terminal' || current.terminal?.isTerminal === true;
        const newHand = harness.document.getElementById('handCompletedNewHandButton');
        await harness.click(finished && newHand && harness.isShown(newHand) ? newHand : '#handResetButton');
        await harness.settle(300);
        if (harness.call('callPlaybookStateBridge', 'getState')) {
          harness.call('callPlaybookStateBridge', 'resetHand');
          harness.call('resetCanonicalHandDraft');
          harness.call('renderCanonicalHandWorkspace');
        }
      }
      await harness.click('#handStartButton');
      await harness.settle(300);
      await harness.pickCards('[data-card-set-edit="hand-seat-0"]', heroCards);
      await harness.click('#handDealHoleButton');
      await harness.settle(300);
    },
    /** Commit board cards for the pending Hand street. */
    async dealBoard(cards) {
      await harness.pickCards('[data-card-set-edit="hand-board-chance"]', cards);
      await harness.click('#handDealBoardButton');
      await harness.settle(300);
    },
    async handAction(type) {
      await harness.click(`[data-canonical-action="${type}"]`);
      await harness.settle(300);
    },
    /**
     * Whether an element is shown: connected, and neither it nor an ancestor
     * is hidden (attribute, inline or stylesheet display:none) or
     * visibility:hidden.
     */
    isShown(node) {
      return Boolean(node?.isConnected) && dom.isRendered(node);
    },
    training: {
      /** Choose a Training mode and start a session (confirming over an active one). */
      async start(mode = 'focused') {
        if (harness.$('.riverline-shell').dataset.activeMode !== 'training') await harness.navigate('training');
        await harness.click(`[data-training-session-mode="${mode}"]`);
        // While a Full Hand is live or complete, its own New Hand control
        // replaces the setup one.
        const newHand = ['trainingNewHand', 'trainingFullHandLiveNewHand', 'trainingFullHandNewHand']
          .map((id) => harness.byId(id)).find((button) => harness.isShown(button));
        if (!newHand) throw new Error('No shown Training New Hand control');
        await harness.click(newHand);
        await harness.settle(500);
      },
      answerButtons() {
        return harness.$$('#trainingMode .training-action-button[data-action]')
          .filter((button) => harness.isShown(button) && !button.disabled);
      },
      /** Answer with the given action type (or the first available one). */
      async answer(type) {
        const buttons = harness.training.answerButtons();
        const button = (type && buttons.find((candidate) => candidate.dataset.action === type)) || buttons[0];
        if (!button) throw new Error('No Training answer is available');
        const fullHand = harness.$('.training-workspace')?.dataset.trainingFullHandPhase === 'live';
        await harness.click(button);
        await harness.settle(500);
        // Strategy resolution can finish outside the fake clock under load.
        if (!fullHand) await harness.waitFor(() => globalThis.app.training.currentEvaluation, 'the Training answer to be evaluated');
        return button.dataset.action;
      },
      async next() {
        await harness.click('#trainingNextHandBtn');
        await harness.settle(500);
      },
      /** Play a Full Hand to completion, checking/calling where possible. */
      async playFullHand() {
        await harness.training.start('full_hand');
        const workspace = harness.$('.training-workspace');
        for (let round = 0; round < 200 && workspace.dataset.trainingFullHandPhase === 'live'; round += 1) {
          await harness.settle(1000);
          if (workspace.dataset.trainingState !== 'ready') continue;
          const buttons = harness.training.answerButtons();
          const pick = buttons.find((button) => button.dataset.action === 'check')
            || buttons.find((button) => button.dataset.action === 'call') || buttons[0];
          if (pick) await harness.click(pick);
        }
        if (workspace.dataset.trainingFullHandPhase !== 'complete') throw new Error(`Full Hand did not complete (${workspace.dataset.trainingFullHandPhase})`);
      },
    },
    async navigate(destination) {
      await harness.click(`.mode-nav-item[data-navigation-id="${destination}"]`);
      await harness.settle(200);
    },
    dispatch(target, event) {
      const element = typeof target === 'string' ? document.querySelector(target) : target;
      const result = element.dispatchEvent(event);
      harness.checkErrors();
      return result;
    },
    visibleText: dom.visibleText,
  };
  return harness;
}

export { dom };
