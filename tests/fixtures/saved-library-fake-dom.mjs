// Minimal delegated-event DOM for mounting the Saved library controller in Node.
// Supports only what the controller uses: data-attribute selectors, bubbling,
// focus, form-control properties, and listener accounting for dispose checks.

const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const dataKey = (attribute) => (attribute.startsWith('data-') ? camel(attribute.slice(5)) : null);

class FakeText {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this._text = String(text);
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
  remove() { this.parentNode?._detach(this); }
}

class FakeListenerTarget {
  constructor() { this.listeners = []; }
  addEventListener(type, listener, capture = false) {
    this.listeners.push({ type, listener, capture: capture === true || capture?.capture === true });
  }
  removeEventListener(type, listener, capture = false) {
    const wanted = capture === true || capture?.capture === true;
    const index = this.listeners.findIndex((entry) => entry.type === type && entry.listener === listener && entry.capture === wanted);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  _invoke(event) {
    for (const entry of [...this.listeners]) if (entry.type === event.type) entry.listener(event);
  }
}

export class FakeElement extends FakeListenerTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.nodeType = 1;
    this.tagName = String(tagName).toLowerCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this.dataset = {};
    this.attributes = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.className = '';
    this.id = '';
    this.value = '';
    this.checked = false;
    this._text = '';
    this._innerHTML = '';
  }
  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }
  get childElementCount() { return this.children.length; }
  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node === this.ownerDocument.body;
  }
  get options() { return this.children.filter((node) => node.tagName === 'option'); }
  get textContent() { return this._text + this.childNodes.map((node) => node.textContent).join(''); }
  set textContent(value) { this._detachAll(); this._text = String(value); }
  set innerHTML(value) { this._detachAll(); this._innerHTML = String(value); }
  get innerHTML() { return this._innerHTML; }
  _detach(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
  }
  _detachAll() {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    this._text = '';
    this._innerHTML = '';
  }
  _adopt(node) {
    const child = typeof node === 'string' ? new FakeText(node, this.ownerDocument) : node;
    child.parentNode?._detach(child);
    child.parentNode = this;
    return child;
  }
  appendChild(node) { this.childNodes.push(this._adopt(node)); return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  prepend(...nodes) { this.childNodes.unshift(...nodes.map((node) => this._adopt(node))); }
  replaceChildren(...nodes) { this._detachAll(); this.append(...nodes); }
  remove() { this.parentNode?._detach(this); }
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
  setAttribute(name, value) {
    const key = dataKey(name);
    if (key) this.dataset[key] = String(value);
    else if (name === 'id' || name === 'class') this[name === 'class' ? 'className' : 'id'] = String(value);
    else this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    const key = dataKey(name);
    if (key) return Object.hasOwn(this.dataset, key) ? this.dataset[key] : null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) {
    const key = dataKey(name);
    if (key) delete this.dataset[key];
    else this.attributes.delete(name);
  }
  matches(selector) {
    const match = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(selector.trim());
    if (!match) throw new Error(`Fake DOM supports attribute selectors only: ${selector}`);
    const value = this.getAttribute(match[1]);
    return value !== null && (match[2] === undefined || value === match[2]);
  }
  closest(selector) {
    for (let node = this; node && node.nodeType === 1; node = node.parentNode) if (node.matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => node.children.forEach((child) => {
      if (child.matches(selector)) found.push(child);
      visit(child);
    });
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 40, width: 100, height: 40 }; }
}

export function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

export function createFakeDom() {
  const timers = new Map();
  let nextTimer = 1;
  const window = new FakeListenerTarget();
  Object.assign(window, {
    innerWidth: 1920,
    innerHeight: 1080,
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const document = new FakeListenerTarget();
  Object.assign(document, {
    defaultView: window,
    activeElement: null,
    documentElement: { dir: 'ltr', dataset: {} },
    createElement: (tagName) => new FakeElement(tagName, document),
    createTextNode: (text) => new FakeText(text, document),
  });
  document.body = new FakeElement('body', document);

  function dispatch(target, type, init = {}) {
    const event = {
      type,
      target,
      relatedTarget: init.relatedTarget ?? null,
      key: init.key,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    if (target === document || target === window) {
      target._invoke(event);
      return event;
    }
    for (let node = target; node; node = node.parentNode) node._invoke(event);
    document._invoke(event);
    return event;
  }

  return {
    window,
    document,
    dispatch,
    timers,
    pendingTimers: () => timers.size,
    flushTimers() {
      let ran = 0;
      while (timers.size) {
        const [id, timer] = timers.entries().next().value;
        timers.delete(id);
        timer.callback();
        ran += 1;
      }
      return ran;
    },
    listenerCount() {
      const count = (target) => target.listeners.length;
      const all = [document.body, ...descendants(document.body)];
      return count(window) + count(document) + all.reduce((sum, node) => sum + count(node), 0);
    },
  };
}
