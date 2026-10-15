// TEST-HYGIENE-001: a dependency-free DOM for behavioural tests.
//
// It parses real markup (app/index.html, rendered innerHTML) into a tree that
// supports the DOM surface Riverline uses: selectors, attributes, dataset,
// classList, style, events with capture/bubble, focus, form controls and
// templates. It deliberately has no layout engine: geometry reads return zero.

import { matchesSelector, parseSelector, matchesComplex } from './selector-engine.mjs';

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title']);
const AUTO_CLOSE = {
  p: new Set(['p', 'div', 'section', 'ul', 'ol', 'table', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form', 'nav', 'aside', 'article', 'dl', 'fieldset', 'figure', 'main', 'pre', 'blockquote']),
  li: new Set(['li']),
  option: new Set(['option', 'optgroup']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  tr: new Set(['tr']),
  td: new Set(['td', 'th', 'tr']),
  th: new Set(['td', 'th', 'tr']),
};
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', times: '×', middot: '·', hellip: '…', mdash: '—', ndash: '–', larr: '←', rarr: '→', uarr: '↑', darr: '↓', copy: '©', bull: '•', minus: '−', plusmn: '±', check: '✓', hearts: '♥', spades: '♠', diams: '♦', clubs: '♣', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', thinsp: ' ', ensp: ' ', emsp: ' ', zwj: '‍', zwnj: '‌', lrm: '‎', rlm: '‏', deg: '°', le: '≤', ge: '≥', ne: '≠', infin: '∞', para: '¶', sect: '§', half: '½', frac12: '½' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
      return String.fromCodePoint(code);
    }
    return Object.hasOwn(ENTITIES, body) ? ENTITIES[body] : match;
  });
}

function escapeText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}

function escapeAttribute(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;');
}

const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/* ---------------------------------------------------------------- events */

export class Event {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.composed = Boolean(init.composed);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.isTrusted = false;
    this.timeStamp = Date.now();
    this._stop = false;
    this._stopImmediate = false;
    this._path = [];
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
  stopImmediatePropagation() { this._stop = true; this._stopImmediate = true; }
  composedPath() { return [...this._path]; }
  get returnValue() { return !this.defaultPrevented; }
}
export class CustomEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.detail = init.detail ?? null; }
}
export class UIEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.detail = init.detail ?? 0; this.view = init.view ?? null; }
}
export class FocusEvent extends UIEvent {
  constructor(type, init = {}) { super(type, init); this.relatedTarget = init.relatedTarget ?? null; }
}
export class MouseEvent extends UIEvent {
  constructor(type, init = {}) {
    super(type, init);
    for (const key of ['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY', 'offsetX', 'offsetY', 'movementX', 'movementY', 'button', 'buttons']) this[key] = init[key] ?? 0;
    for (const key of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']) this[key] = Boolean(init[key]);
    this.relatedTarget = init.relatedTarget ?? null;
  }
  getModifierState(key) { return Boolean(this[`${key.toLowerCase()}Key`]); }
}
export class PointerEvent extends MouseEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
    this.width = init.width ?? 1;
    this.height = init.height ?? 1;
    this.pressure = init.pressure ?? 0;
  }
}
export class WheelEvent extends MouseEvent {
  constructor(type, init = {}) { super(type, init); this.deltaX = init.deltaX ?? 0; this.deltaY = init.deltaY ?? 0; this.deltaMode = init.deltaMode ?? 0; }
}
export class KeyboardEvent extends UIEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.repeat = Boolean(init.repeat);
    this.isComposing = Boolean(init.isComposing);
    for (const key of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']) this[key] = Boolean(init[key]);
  }
  getModifierState(key) { return Boolean(this[`${key.toLowerCase()}Key`]); }
}
export class InputEvent extends UIEvent {
  constructor(type, init = {}) { super(type, init); this.data = init.data ?? null; this.inputType = init.inputType ?? ''; this.isComposing = Boolean(init.isComposing); }
}
export class SubmitEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.submitter = init.submitter ?? null; }
}

export class EventTarget {
  constructor() { this._listeners = new Map(); }
  addEventListener(type, listener, options = {}) {
    if (!listener) return;
    const capture = options === true || Boolean(options?.capture);
    const list = this._listeners.get(type) || [];
    if (list.some((entry) => entry.listener === listener && entry.capture === capture)) return;
    const entry = { listener, capture, once: Boolean(options?.once), passive: Boolean(options?.passive) };
    list.push(entry);
    this._listeners.set(type, list);
    const signal = options?.signal;
    if (signal) {
      if (signal.aborted) this.removeEventListener(type, listener, options);
      else signal.addEventListener?.('abort', () => this.removeEventListener(type, listener, options));
    }
  }
  removeEventListener(type, listener, options = {}) {
    const capture = options === true || Boolean(options?.capture);
    const list = this._listeners.get(type);
    if (!list) return;
    const index = list.findIndex((entry) => entry.listener === listener && entry.capture === capture);
    if (index >= 0) list.splice(index, 1);
  }
  listenerCount(type) { return (this._listeners.get(type) || []).length; }
  _invokeListeners(event, phase) {
    const list = [...(this._listeners.get(event.type) || [])];
    for (const entry of list) {
      if (phase === 'capture' && !entry.capture) continue;
      if (phase === 'bubble' && entry.capture) continue;
      if (entry.once) this.removeEventListener(event.type, entry.listener, { capture: entry.capture });
      event.currentTarget = this;
      const handler = typeof entry.listener === 'function' ? entry.listener : entry.listener.handleEvent?.bind(entry.listener);
      try {
        handler?.call(this, event);
      } catch (error) {
        const reporter = globalThis.__miniDomErrors;
        if (reporter) reporter.push(error);
        else throw error;
      }
      if (event._stopImmediate) return;
    }
    // Inline on<event> handler properties.
    const inline = this[`on${event.type}`];
    if (phase !== 'capture' && typeof inline === 'function' && !Object.hasOwn(Object.getPrototypeOf(this), `on${event.type}`)) {
      event.currentTarget = this;
      inline.call(this, event);
    }
  }
  _eventParent() { return null; }
  dispatchEvent(event) {
    if (!(event instanceof Event)) throw new TypeError('dispatchEvent expects a mini-dom Event');
    event.target = this;
    const path = [];
    for (let node = this._eventParent(); node; node = node._eventParent()) path.push(node);
    event._path = [this, ...path];
    event.eventPhase = 1;
    for (let index = path.length - 1; index >= 0 && !event._stop; index -= 1) path[index]._invokeListeners(event, 'capture');
    event.eventPhase = 2;
    if (!event._stop) this._invokeListeners(event, 'capture');
    if (!event._stop) this._invokeListeners(event, 'bubble');
    if (event.bubbles) {
      event.eventPhase = 3;
      for (const node of path) {
        if (event._stop) break;
        node._invokeListeners(event, 'bubble');
      }
    }
    event.eventPhase = 0;
    event.currentTarget = null;
    return !event.defaultPrevented;
  }
}

/* ----------------------------------------------------------------- nodes */

export class Node extends EventTarget {
  constructor(ownerDocument) {
    super();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
  }
  static get ELEMENT_NODE() { return 1; }
  static get TEXT_NODE() { return 3; }
  static get COMMENT_NODE() { return 8; }
  static get DOCUMENT_NODE() { return 9; }
  static get DOCUMENT_FRAGMENT_NODE() { return 11; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes.at(-1) || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  get previousSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.childNodes;
    return siblings[siblings.indexOf(this) - 1] || null;
  }
  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node.nodeType === 9;
  }
  _eventParent() { return this.parentNode || (this.nodeType === 9 ? this.defaultView : null); }
  hasChildNodes() { return this.childNodes.length > 0; }
  getRootNode() { let node = this; while (node.parentNode) node = node.parentNode; return node; }
  contains(other) {
    for (let node = other; node; node = node.parentNode) if (node === this) return true;
    return false;
  }
  _adopt(node) {
    if (node.nodeType === 11) return [...node.childNodes].map((child) => { node._detach(child); return child; });
    if (node.parentNode) node.parentNode._detach(node);
    return [node];
  }
  _detach(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    this.ownerDocument?._noteMutation?.(this, 'childList', null, null, { addedNodes: [], removedNodes: [node] });
  }
  _insertAt(index, nodes) {
    for (const node of nodes) node.parentNode = this;
    this.childNodes.splice(index, 0, ...nodes);
    this.ownerDocument?._noteMutation?.(this, 'childList', null, null, { addedNodes: nodes, removedNodes: [] });
  }
  appendChild(node) { this._insertAt(this.childNodes.length, this._adopt(node)); return node; }
  insertBefore(node, reference) {
    if (!reference) return this.appendChild(node);
    const nodes = this._adopt(node);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) throw new Error('insertBefore: reference is not a child');
    this._insertAt(index, nodes);
    return node;
  }
  removeChild(node) {
    if (node.parentNode !== this) throw new Error('removeChild: not a child');
    this._detach(node);
    return node;
  }
  replaceChild(next, previous) {
    this.insertBefore(next, previous);
    this.removeChild(previous);
    return previous;
  }
  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.data;
    return this.childNodes.filter((node) => node.nodeType !== 8).map((node) => node.textContent).join('');
  }
  set textContent(value) {
    for (const node of [...this.childNodes]) this._detach(node);
    const text = value == null ? '' : String(value);
    if (text) this._insertAt(0, [this.ownerDocument.createTextNode(text)]);
  }
  normalize() {}
}

export class Text extends Node {
  constructor(data, ownerDocument) { super(ownerDocument); this.nodeType = 3; this.nodeName = '#text'; this.data = String(data); }
  get nodeValue() { return this.data; }
  set nodeValue(value) { this.data = String(value); }
  get wholeText() { return this.data; }
  cloneNode() { return new Text(this.data, this.ownerDocument); }
  remove() { this.parentNode?._detach(this); }
}

export class Comment extends Node {
  constructor(data, ownerDocument) { super(ownerDocument); this.nodeType = 8; this.nodeName = '#comment'; this.data = String(data); }
  cloneNode() { return new Comment(this.data, this.ownerDocument); }
  remove() { this.parentNode?._detach(this); }
}

class ParentMixin extends Node {
  get children() { return this.childNodes.filter((node) => node.nodeType === 1); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { return this.children.at(-1) || null; }
  _toNodes(items) {
    return items.map((item) => (item instanceof Node ? item : this.ownerDocument.createTextNode(String(item))));
  }
  append(...items) { for (const node of this._toNodes(items)) this.appendChild(node); }
  prepend(...items) {
    const first = this.firstChild;
    for (const node of this._toNodes(items)) this.insertBefore(node, first);
  }
  replaceChildren(...items) {
    for (const node of [...this.childNodes]) this._detach(node);
    this.append(...items);
  }
  // Descendant elements in document order (iterative; template contents excluded).
  _descendants() {
    const result = [];
    const stack = [];
    for (let index = this.childNodes.length - 1; index >= 0; index -= 1) stack.push(this.childNodes[index]);
    while (stack.length) {
      const node = stack.pop();
      if (node.nodeType !== 1) continue;
      result.push(node);
      const children = node.childNodes;
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return result;
  }
  _byIdFastPath(selector) {
    const match = /^#([A-Za-z_][\w-]*)$/.exec(selector);
    if (!match) return undefined;
    const document = this.nodeType === 9 ? this : this.ownerDocument;
    const found = document?.getElementById?.(match[1]) ?? null;
    if (found && this.nodeType !== 9 && !(this !== found && this.contains(found))) return this._scanById(match[1]);
    return found;
  }
  _scanById(id) {
    for (const element of this._descendants()) if (element.id === id) return element;
    return null;
  }
  querySelectorAll(selector, context = {}) {
    const parsed = parseSelector(selector);
    const scope = this.nodeType === 1 ? this : null;
    const result = [];
    const matchContext = { scope, ...context };
    for (const element of this._descendants()) {
      for (const complex of parsed) {
        if (matchesComplex(element, complex, matchContext)) { result.push(element); break; }
      }
    }
    Object.defineProperty(result, 'item', { value: (index) => result[index] ?? null });
    return result;
  }
  querySelector(selector) {
    if (this.isConnected || this.nodeType === 9) {
      const fast = this._byIdFastPath(selector);
      if (fast !== undefined) return fast;
    }
    const parsed = parseSelector(selector);
    const scope = this.nodeType === 1 ? this : null;
    const matchContext = { scope };
    for (const element of this._descendants()) {
      for (const complex of parsed) if (matchesComplex(element, complex, matchContext)) return element;
    }
    return null;
  }
  getElementsByTagName(name) {
    const tag = name.toLowerCase();
    return [...this._descendants()].filter((element) => tag === '*' || element.localName === tag);
  }
  getElementsByClassName(names) {
    const wanted = names.split(/\s+/).filter(Boolean);
    return [...this._descendants()].filter((element) => wanted.every((name) => element.classList.contains(name)));
  }
}

export class DocumentFragment extends ParentMixin {
  constructor(ownerDocument) { super(ownerDocument); this.nodeType = 11; this.nodeName = '#document-fragment'; }
  getElementById(id) { return [...this._descendants()].find((element) => element.id === id) || null; }
  cloneNode(deep = false) {
    const clone = new DocumentFragment(this.ownerDocument);
    if (deep) for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
    return clone;
  }
  get innerHTML() { return this.childNodes.map(serializeNode).join(''); }
}

class DOMTokenList {
  constructor(element, attribute) { this._element = element; this._attribute = attribute; }
  _read() {
    const text = this._element.getAttribute(this._attribute) || '';
    if (this._cacheText !== text) {
      this._cacheText = text;
      this._cache = text.split(/\s+/).filter(Boolean);
      this._cacheSet = new Set(this._cache);
    }
    return this._cache;
  }
  _write(tokens) { this._element.setAttribute(this._attribute, [...new Set(tokens)].join(' ')); }
  get length() { return this._read().length; }
  get value() { return this._element.getAttribute(this._attribute) || ''; }
  item(index) { return this._read()[index] ?? null; }
  contains(token) { this._read(); return this._cacheSet.has(token); }
  add(...tokens) { const current = this._read(); this._write([...current, ...tokens.filter((token) => !current.includes(token))]); }
  remove(...tokens) {
    if (!this._element.hasAttribute(this._attribute)) return;
    this._write(this._read().filter((token) => !tokens.includes(token)));
  }
  toggle(token, force) {
    const has = this.contains(token);
    const next = force === undefined ? !has : Boolean(force);
    if (next && !has) this.add(token);
    if (!next && has) this.remove(token);
    return next;
  }
  replace(previous, next) {
    if (!this.contains(previous)) return false;
    this._write(this._read().map((token) => (token === previous ? next : token)));
    return true;
  }
  forEach(callback) { this._read().forEach(callback); }
  [Symbol.iterator]() { return this._read()[Symbol.iterator](); }
  toString() { return this.value; }
}

export function parseInlineStyle(text) {
  const declarations = new Map();
  for (const chunk of String(text || '').split(';')) {
    const colon = chunk.indexOf(':');
    if (colon < 0) continue;
    const name = chunk.slice(0, colon).trim();
    let value = chunk.slice(colon + 1).trim();
    let priority = '';
    if (/!important$/i.test(value)) { priority = 'important'; value = value.replace(/\s*!important$/i, ''); }
    if (name) declarations.set(name.startsWith('--') ? name : name.toLowerCase(), { value, priority });
  }
  return declarations;
}

function createStyleDeclaration(element) {
  const target = {
    _map() { return parseInlineStyle(element.getAttribute('style')); },
    _commit(map) {
      const text = [...map].map(([name, { value, priority }]) => `${name}: ${value}${priority ? ' !important' : ''};`).join(' ');
      if (text) element.setAttribute('style', text);
      else element.removeAttribute('style');
    },
    setProperty(name, value, priority = '') {
      const map = this._map();
      if (value == null || value === '') map.delete(name);
      else map.set(name, { value: String(value), priority: priority === 'important' ? 'important' : '' });
      this._commit(map);
    },
    removeProperty(name) {
      const map = this._map();
      const previous = map.get(name)?.value ?? '';
      map.delete(name);
      this._commit(map);
      return previous;
    },
    getPropertyValue(name) { return this._map().get(name)?.value ?? ''; },
    getPropertyPriority(name) { return this._map().get(name)?.priority ?? ''; },
    item(index) { return [...this._map().keys()][index] ?? ''; },
    get length() { return this._map().size; },
    get cssText() { return element.getAttribute('style') || ''; },
    set cssText(value) { if (value) element.setAttribute('style', String(value)); else element.removeAttribute('style'); },
  };
  return new Proxy(target, {
    get(object, key) {
      if (typeof key !== 'string' || key in object) return Reflect.get(object, key);
      if (/^\d+$/.test(key)) return object.item(Number(key));
      return object.getPropertyValue(key.startsWith('--') ? key : kebab(key));
    },
    set(object, key, value) {
      if (typeof key !== 'string' || key in object) return Reflect.set(object, key, value);
      object.setProperty(key.startsWith('--') ? key : kebab(key), value);
      return true;
    },
  });
}

function createDataset(element) {
  return new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      const value = element.getAttribute(`data-${kebab(key)}`);
      return value === null ? undefined : value;
    },
    set(_, key, value) { element.setAttribute(`data-${kebab(key)}`, String(value)); return true; },
    deleteProperty(_, key) { element.removeAttribute(`data-${kebab(key)}`); return true; },
    has(_, key) { return element.hasAttribute(`data-${kebab(String(key))}`); },
    ownKeys() {
      return [...element._attributes.keys()].filter((name) => name.startsWith('data-')).map((name) => camel(name.slice(5)));
    },
    getOwnPropertyDescriptor(_, key) {
      const value = element.getAttribute(`data-${kebab(String(key))}`);
      return value === null ? undefined : { value, enumerable: true, configurable: true, writable: true };
    },
  });
}

const STRING_REFLECTIONS = {
  id: 'id', className: 'class', title: 'title', lang: 'lang', dir: 'dir', name: 'name', placeholder: 'placeholder',
  role: 'role', htmlFor: 'for', alt: 'alt', rel: 'rel', target: 'target', accessKey: 'accesskey', autocomplete: 'autocomplete',
  inputMode: 'inputmode', enterKeyHint: 'enterkeyhint', pattern: 'pattern', min: 'min', max: 'max', step: 'step',
  accept: 'accept', action: 'action', method: 'method', download: 'download', slot: 'slot', popover: 'popover',
};
const BOOLEAN_REFLECTIONS = {
  hidden: 'hidden', disabled: 'disabled', required: 'required', readOnly: 'readonly', multiple: 'multiple',
  autofocus: 'autofocus', inert: 'inert', open: 'open', noValidate: 'novalidate', defaultChecked: 'checked',
  defaultSelected: 'selected', draggable: 'draggable', spellcheck: 'spellcheck',
};
const ARIA_PROPERTIES = ['Label', 'Hidden', 'Expanded', 'Pressed', 'Selected', 'Checked', 'Current', 'Disabled', 'Live', 'Busy', 'Modal', 'Controls', 'Describedby', 'Labelledby', 'Valuenow', 'Valuemin', 'Valuemax', 'Valuetext', 'Orientation', 'Haspopup', 'Atomic', 'Sort', 'Level', 'Roledescription', 'Description', 'Invalid', 'Readonly', 'Required', 'Multiselectable', 'Placeholder', 'Keyshortcuts', 'Posinset', 'Setsize', 'Colcount', 'Rowcount', 'Colindex', 'Rowindex', 'Relevant'];

let uid = 0;
const LOWER_NAMES = new Map();
function lowerName(name) {
  const lower = String(name).toLowerCase();
  if (typeof name === 'string' && LOWER_NAMES.size < 5000) LOWER_NAMES.set(name, lower);
  return lower;
}

export class Element extends ParentMixin {
  constructor(tagName, ownerDocument, namespaceURI = 'http://www.w3.org/1999/xhtml') {
    super(ownerDocument);
    this.nodeType = 1;
    this.namespaceURI = namespaceURI;
    this.localName = namespaceURI === 'http://www.w3.org/1999/xhtml' ? String(tagName).toLowerCase() : String(tagName);
    this._attributes = new Map();
    this._uid = uid += 1;
    this.classList = new DOMTokenList(this, 'class');
    this.dataset = createDataset(this);
    this.style = createStyleDeclaration(this);
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this._value = undefined;
    this._checked = undefined;
    this._selected = undefined;
    this.indeterminate = false;
    this._content = null;
    this._rect = null;
  }
  // HTML elements report upper-case tag names (as browsers do); SVG keeps case.
  get tagName() { return this.namespaceURI === 'http://www.w3.org/1999/xhtml' ? this.localName.toUpperCase() : this.localName; }
  get nodeName() { return this.tagName; }
  get attributes() {
    const list = [...this._attributes].map(([name, value]) => ({ name, value, localName: name, nodeName: name }));
    return Object.assign(list, { getNamedItem: (name) => list.find((item) => item.name === name) || null });
  }
  getAttributeNames() { return [...this._attributes.keys()]; }
  getAttribute(name) {
    const key = LOWER_NAMES.get(name) ?? lowerName(name);
    return this._attributes.has(key) ? this._attributes.get(key) : null;
  }
  getAttributeNS(_, name) { return this.getAttribute(name); }
  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    const previous = this.getAttribute(key);
    this._attributes.set(key, String(value));
    if (key === 'value' && this._value === undefined && this.localName === 'option') this._value = undefined;
    this.ownerDocument?._noteMutation?.(this, 'attributes', key, previous);
  }
  setAttributeNS(_, name, value) { this.setAttribute(name, value); }
  removeAttribute(name) {
    const key = String(name).toLowerCase();
    if (!this._attributes.has(key)) return;
    const previous = this._attributes.get(key);
    this._attributes.delete(key);
    this.ownerDocument?._noteMutation?.(this, 'attributes', key, previous);
  }
  removeAttributeNS(_, name) { this.removeAttribute(name); }
  hasAttribute(name) { return this._attributes.has(LOWER_NAMES.get(name) ?? lowerName(name)); }
  hasAttributes() { return this._attributes.size > 0; }
  toggleAttribute(name, force) {
    const has = this.hasAttribute(name);
    const next = force === undefined ? !has : Boolean(force);
    if (next && !has) this.setAttribute(name, '');
    if (!next && has) this.removeAttribute(name);
    return next;
  }
  get tabIndex() {
    const value = this.getAttribute('tabindex');
    if (value !== null) return Number(value);
    return ['a', 'button', 'input', 'select', 'textarea'].includes(this.localName) ? 0 : -1;
  }
  set tabIndex(value) { this.setAttribute('tabindex', String(value)); }
  get type() {
    if (this.localName === 'button') return (this.getAttribute('type') || 'submit').toLowerCase();
    if (this.localName === 'input') return (this.getAttribute('type') || 'text').toLowerCase();
    if (this.localName === 'select') return this.multiple ? 'select-multiple' : 'select-one';
    if (this.localName === 'textarea') return 'textarea';
    return this.getAttribute('type') || '';
  }
  set type(value) { this.setAttribute('type', value); }
  get href() { return this.getAttribute('href') || ''; }
  set href(value) { this.setAttribute('href', value); }
  get src() { return this.getAttribute('src') || ''; }
  set src(value) { this.setAttribute('src', value); }
  get value() {
    if (this.localName === 'select') {
      const selected = this.options.find((option) => option.selected) || (this.multiple ? null : this.options.find((option) => !option.disabled));
      return selected ? selected.value : '';
    }
    if (this.localName === 'option') return this.hasAttribute('value') ? this.getAttribute('value') : this.textContent.trim();
    if (this.localName === 'textarea') return this._value ?? this.textContent;
    if (this._value !== undefined) return this._value;
    if (this.localName === 'input' && ['checkbox', 'radio'].includes(this.type)) return this.getAttribute('value') ?? 'on';
    if (this.localName === 'input' && this.type === 'range') {
      return this.getAttribute('value') ?? String((Number(this.getAttribute('min') ?? 0) + Number(this.getAttribute('max') ?? 100)) / 2);
    }
    return this.getAttribute('value') ?? '';
  }
  set value(next) {
    if (this.localName === 'select') {
      for (const option of this.options) option._selected = option.value === String(next);
      return;
    }
    if (this.localName === 'option') { this.setAttribute('value', next); return; }
    let text = next == null ? '' : String(next);
    if (this.localName === 'input' && this.type === 'range') {
      const min = Number(this.getAttribute('min') ?? 0);
      const max = Number(this.getAttribute('max') ?? 100);
      const numeric = Number(text);
      if (Number.isFinite(numeric)) text = String(Math.min(max, Math.max(min, numeric)));
    }
    this._value = text;
  }
  get valueAsNumber() { const number = Number(this.value); return this.value === '' ? Number.NaN : number; }
  set valueAsNumber(next) { this.value = String(next); }
  get defaultValue() { return this.getAttribute('value') ?? ''; }
  set defaultValue(next) { this.setAttribute('value', next); }
  get checked() { return this._checked ?? this.hasAttribute('checked'); }
  set checked(next) {
    this._checked = Boolean(next);
    if (this._checked && this.type === 'radio' && this.name) {
      const scope = this.closest('form') || this.ownerDocument;
      for (const peer of scope.querySelectorAll(`input[type="radio"]`)) {
        if (peer !== this && peer.name === this.name) peer._checked = false;
      }
    }
  }
  get selected() { return this._selected ?? this.hasAttribute('selected'); }
  set selected(next) {
    const select = this.closest('select');
    if (next && select && !select.multiple) for (const option of select.options) option._selected = false;
    this._selected = Boolean(next);
  }
  get options() { return this.localName === 'select' ? this.querySelectorAll('option') : undefined; }
  get selectedOptions() { return this.localName === 'select' ? this.options.filter((option) => option.selected) : undefined; }
  get selectedIndex() {
    if (this.localName !== 'select') return undefined;
    const options = this.options;
    const index = options.findIndex((option) => option.selected);
    if (index >= 0) return index;
    return this.multiple ? -1 : options.findIndex((option) => !option.disabled);
  }
  set selectedIndex(index) { this.options.forEach((option, position) => { option._selected = position === index; }); }
  get form() { return this.closest('form'); }
  get labels() { return this.id ? this.ownerDocument.querySelectorAll(`label[for="${this.id}"]`) : []; }
  get content() {
    if (this.localName !== 'template') return undefined;
    if (!this._content) this._content = new DocumentFragment(this.ownerDocument);
    return this._content;
  }
  get elements() { return this.localName === 'form' || this.localName === 'fieldset' ? this.querySelectorAll('input, select, textarea, button') : undefined; }
  get innerHTML() {
    const nodes = this.localName === 'template' ? this.content.childNodes : this.childNodes;
    if (RAW_TEXT_ELEMENTS.has(this.localName)) return nodes.map((node) => node.data ?? '').join('');
    return nodes.map(serializeNode).join('');
  }
  set innerHTML(markup) {
    const target = this.localName === 'template' ? this.content : this;
    for (const node of [...target.childNodes]) target._detach(node);
    if (RAW_TEXT_ELEMENTS.has(this.localName)) { this.textContent = markup; return; }
    const nodes = parseFragmentNodes(String(markup ?? ''), this.ownerDocument);
    target._insertAt(0, nodes);
  }
  get outerHTML() { return serializeNode(this); }
  set outerHTML(markup) {
    const nodes = parseFragmentNodes(String(markup), this.ownerDocument);
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    parent._detach(this);
    parent._insertAt(index, nodes);
  }
  // HTMLOptionElement.text / HTMLAnchorElement.text / HTMLScriptElement.text.
  get text() {
    if (this.localName === 'option') return this.textContent.replace(/\s+/g, ' ').trim();
    if (['a', 'script', 'title'].includes(this.localName)) return this.textContent;
    return undefined;
  }
  set text(value) { this.textContent = value; }
  get index() { return this.localName === 'option' ? (this.closest('select')?.options.indexOf(this) ?? 0) : undefined; }
  get label() { return this.localName === 'option' ? (this.getAttribute('label') ?? this.text) : this.getAttribute('label') ?? ''; }
  get innerText() { return this.textContent; }
  set innerText(value) { this.textContent = value; }
  get outerText() { return this.textContent; }
  insertAdjacentHTML(position, markup) {
    const nodes = parseFragmentNodes(String(markup), this.ownerDocument);
    this._insertAdjacentNodes(position, nodes);
  }
  insertAdjacentElement(position, element) { this._insertAdjacentNodes(position, this._adopt(element)); return element; }
  insertAdjacentText(position, text) { this._insertAdjacentNodes(position, [this.ownerDocument.createTextNode(text)]); }
  _insertAdjacentNodes(position, nodes) {
    const where = position.toLowerCase();
    if (where === 'beforebegin') this.parentNode._insertAt(this.parentNode.childNodes.indexOf(this), nodes);
    else if (where === 'afterbegin') this._insertAt(0, nodes);
    else if (where === 'beforeend') this._insertAt(this.childNodes.length, nodes);
    else if (where === 'afterend') this.parentNode._insertAt(this.parentNode.childNodes.indexOf(this) + 1, nodes);
    else throw new Error(`Bad insertAdjacent position ${position}`);
  }
  get nextElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    return siblings[siblings.indexOf(this) - 1] || null;
  }
  before(...items) { const nodes = this._toNodes(items); for (const node of nodes) this.parentNode.insertBefore(node, this); }
  after(...items) {
    const next = this.nextSibling;
    const parent = this.parentNode;
    for (const node of this._toNodes(items)) parent.insertBefore(node, next);
  }
  replaceWith(...items) {
    const parent = this.parentNode;
    if (!parent) return;
    const next = this.nextSibling;
    parent._detach(this);
    for (const node of this._toNodes(items)) parent.insertBefore(node, next);
  }
  remove() { this.parentNode?._detach(this); }
  matches(selector, context = {}) { return matchesSelector(this, selector, context); }
  webkitMatchesSelector(selector) { return this.matches(selector); }
  closest(selector) {
    for (let node = this; node?.nodeType === 1; node = node.parentNode) if (node.matches(selector)) return node;
    return null;
  }
  cloneNode(deep = false) {
    const clone = this.ownerDocument.createElementNS(this.namespaceURI, this.localName);
    for (const [name, value] of this._attributes) clone._attributes.set(name, value);
    if (this._value !== undefined) clone._value = this._value;
    if (this._checked !== undefined) clone._checked = this._checked;
    if (deep) {
      for (const child of this.childNodes) clone.appendChild(child.cloneNode(true));
      if (this._content) clone._content = this._content.cloneNode(true);
    }
    return clone;
  }
  get isContentEditable() { return this.getAttribute('contenteditable') === 'true' || this.getAttribute('contenteditable') === ''; }
  // Interaction ---------------------------------------------------------
  click() {
    if (this.disabled && ['button', 'input', 'select', 'textarea'].includes(this.localName)) return;
    const toggles = this.localName === 'input' && ['checkbox', 'radio'].includes(this.type);
    const previous = this.checked;
    if (toggles) this.checked = this.type === 'radio' ? true : !previous;
    const view = this.ownerDocument.defaultView;
    const event = new (view?.MouseEvent || MouseEvent)('click', { bubbles: true, cancelable: true, composed: true, detail: 1 });
    const allowed = this.dispatchEvent(event);
    if (toggles) {
      if (!allowed) { this.checked = previous; return; }
      if (previous !== this.checked) {
        this.dispatchEvent(new (view?.Event || Event)('input', { bubbles: true }));
        this.dispatchEvent(new (view?.Event || Event)('change', { bubbles: true }));
      }
      return;
    }
    if (!allowed) return;
    if (this.localName === 'label') {
      const control = this.getAttribute('for') ? this.ownerDocument.getElementById(this.getAttribute('for')) : this.querySelector('input, select, textarea, button');
      if (control && control !== this) control.click();
      return;
    }
    if (this.localName === 'summary' && this.parentNode?.localName === 'details') {
      this.parentNode.toggleAttribute('open');
      this.parentNode.dispatchEvent(new (view?.Event || Event)('toggle'));
      return;
    }
    if ((this.localName === 'button' && this.type === 'submit') || (this.localName === 'input' && this.type === 'submit')) {
      const form = this.form;
      if (form) form.requestSubmit(this);
    }
  }
  requestSubmit(submitter = null) {
    const view = this.ownerDocument.defaultView;
    this.dispatchEvent(new (view?.SubmitEvent || SubmitEvent)('submit', { bubbles: true, cancelable: true, submitter }));
  }
  submit() {}
  reset() {
    for (const control of this.querySelectorAll('input, select, textarea')) {
      control._value = undefined;
      control._checked = undefined;
      for (const option of control.options || []) option._selected = undefined;
    }
    this.dispatchEvent(new Event('reset', { bubbles: true }));
  }
  focus(options = {}) {
    const document = this.ownerDocument;
    if (!this.isConnected || document.activeElement === this) return;
    const previous = document.activeElement;
    if (previous && previous !== document.body) previous.blur({ relatedTarget: this });
    document._activeElement = this;
    document._lastFocusOptions = options;
    const view = document.defaultView;
    this.dispatchEvent(new (view?.FocusEvent || FocusEvent)('focus', { relatedTarget: previous }));
    this.dispatchEvent(new (view?.FocusEvent || FocusEvent)('focusin', { bubbles: true, relatedTarget: previous }));
  }
  blur({ relatedTarget = null } = {}) {
    const document = this.ownerDocument;
    if (document.activeElement !== this) return;
    document._activeElement = null;
    const view = document.defaultView;
    this.dispatchEvent(new (view?.FocusEvent || FocusEvent)('blur', { relatedTarget }));
    this.dispatchEvent(new (view?.FocusEvent || FocusEvent)('focusout', { bubbles: true, relatedTarget }));
  }
  select() {}
  setSelectionRange() {}
  setCustomValidity(message) { this._validationMessage = String(message); }
  get validationMessage() { return this._validationMessage || ''; }
  checkValidity() { return !this._validationMessage; }
  reportValidity() { return this.checkValidity(); }
  get validity() { return { valid: !this._validationMessage, customError: Boolean(this._validationMessage) }; }
  showModal() { this.setAttribute('open', ''); this._modal = true; }
  show() { this.setAttribute('open', ''); this._modal = false; }
  close(returnValue) {
    if (returnValue !== undefined) this.returnValue = returnValue;
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this._modal = false;
    this.dispatchEvent(new Event('close'));
  }
  showPopover() { this._popoverOpen = true; }
  hidePopover() { this._popoverOpen = false; }
  togglePopover() { this._popoverOpen = !this._popoverOpen; }
  // Geometry (no layout engine) ----------------------------------------
  setTestRect(rect) { this._rect = { x: 0, y: 0, width: 0, height: 0, ...rect }; return this; }
  getBoundingClientRect() {
    const rect = this._rect || this.ownerDocument?.defaultView?.__layoutRect?.(this) || { x: 0, y: 0, width: 0, height: 0 };
    return { ...rect, left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height, toJSON() { return this; } };
  }
  getClientRects() {
    const rect = this.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 ? [rect] : [];
  }
  get offsetWidth() { return this.getBoundingClientRect().width; }
  get offsetHeight() { return this.getBoundingClientRect().height; }
  get offsetLeft() { return this._rect?.x ?? 0; }
  get offsetTop() { return this._rect?.y ?? 0; }
  get offsetParent() { return this.parentElement; }
  get clientWidth() { return this._rect?.width ?? 0; }
  get clientHeight() { return this._rect?.height ?? 0; }
  get scrollWidth() { return this._scrollWidth ?? this.clientWidth; }
  set scrollWidth(value) { this._scrollWidth = value; }
  get scrollHeight() { return this._scrollHeight ?? this.clientHeight; }
  set scrollHeight(value) { this._scrollHeight = value; }
  scrollIntoView(options) { this._scrolledIntoView = options ?? true; }
  scrollTo(x, y) { if (typeof x === 'object') { this.scrollLeft = x.left ?? this.scrollLeft; this.scrollTop = x.top ?? this.scrollTop; } else { this.scrollLeft = x; this.scrollTop = y; } }
  scrollBy() {}
  scroll(x, y) { this.scrollTo(x, y); }
  setPointerCapture(pointerId) { this._pointerCapture = pointerId; }
  releasePointerCapture() { this._pointerCapture = undefined; }
  hasPointerCapture(pointerId) { return this._pointerCapture === pointerId; }
  animate(keyframes, options) {
    const animation = {
      keyframes, options, playState: 'finished', onfinish: null, oncancel: null,
      finished: Promise.resolve(), cancel() {}, finish() {}, play() {}, pause() {}, reverse() {},
      addEventListener() {}, removeEventListener() {},
    };
    (this.ownerDocument._animations ||= []).push({ element: this, keyframes, options });
    return animation;
  }
  getAnimations() { return []; }
  attachShadow() { throw new Error('mini-dom: shadow DOM is not supported'); }
  getContext() { return this.ownerDocument.defaultView?.__canvasContext?.(this) ?? null; }
  toDataURL() { return 'data:,'; }
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
}

for (const [property, attribute] of Object.entries(STRING_REFLECTIONS)) {
  Object.defineProperty(Element.prototype, property, {
    get() { return this.getAttribute(attribute) ?? ''; },
    set(value) { this.setAttribute(attribute, value); },
    configurable: true,
  });
}
for (const [property, attribute] of Object.entries(BOOLEAN_REFLECTIONS)) {
  Object.defineProperty(Element.prototype, property, {
    get() { return this.hasAttribute(attribute); },
    set(value) { this.toggleAttribute(attribute, Boolean(value)); },
    configurable: true,
  });
}
for (const name of ARIA_PROPERTIES) {
  Object.defineProperty(Element.prototype, `aria${name}`, {
    get() { return this.getAttribute(`aria-${name.toLowerCase()}`); },
    set(value) { if (value == null) this.removeAttribute(`aria-${name.toLowerCase()}`); else this.setAttribute(`aria-${name.toLowerCase()}`, value); },
    configurable: true,
  });
}

export class Document extends ParentMixin {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.nodeName = '#document';
    this.defaultView = null;
    this.readyState = 'complete';
    this.visibilityState = 'visible';
    this.hidden = false;
    this._activeElement = null;
    this._mutationObservers = new Set();
    this.fonts = { ready: Promise.resolve(), status: 'loaded', addEventListener() {}, check: () => true, load: async () => [] };
    this.cookie = '';
    this.title = '';
  }
  get documentElement() { return this.children.find((node) => node.localName === 'html') || this.children[0] || null; }
  get head() { return this.documentElement?.children.find((node) => node.localName === 'head') || null; }
  get body() { return this.documentElement?.children.find((node) => node.localName === 'body') || null; }
  get activeElement() { return this._activeElement && this._activeElement.isConnected ? this._activeElement : this.body; }
  get dir() { return this.documentElement?.getAttribute('dir') || ''; }
  get baseURI() { return this.defaultView?.location?.href || 'about:blank'; }
  get URL() { return this.baseURI; }
  set dir(value) { this.documentElement?.setAttribute('dir', value); }
  createElement(tagName) { return new Element(tagName, this); }
  createElementNS(namespace, tagName) { return new Element(tagName, this, namespace || 'http://www.w3.org/1999/xhtml'); }
  createTextNode(text) { return new Text(text, this); }
  createComment(text) { return new Comment(text, this); }
  createDocumentFragment() { return new DocumentFragment(this); }
  createRange() {
    const document = this;
    return {
      selectNodeContents() {}, setStart() {}, setEnd() {}, collapse() {},
      createContextualFragment(markup) {
        const fragment = new DocumentFragment(document);
        fragment._insertAt(0, parseFragmentNodes(markup, document));
        return fragment;
      },
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0 }),
      getClientRects: () => [],
    };
  }
  createTreeWalker(root, whatToShow = 0xffffffff) {
    const nodes = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1 && whatToShow & 1) nodes.push(child);
        if (child.nodeType === 3 && whatToShow & 4) nodes.push(child);
        if (child.nodeType === 1) visit(child);
      }
    };
    visit(root);
    let index = -1;
    return { currentNode: root, nextNode() { index += 1; this.currentNode = nodes[index] || null; return this.currentNode; } };
  }
  importNode(node, deep) { return node.cloneNode(deep); }
  adoptNode(node) { return node; }
  getElementById(id) {
    const key = String(id);
    this._idCache ||= new Map();
    const cached = this._idCache.get(key);
    if (cached && cached.getAttribute('id') === key && cached.getRootNode() === this) return cached;
    const found = this._scanById(key);
    if (found) this._idCache.set(key, found);
    else this._idCache.delete(key);
    return found;
  }
  getElementsByName(name) { return [...this._descendants()].filter((element) => element.getAttribute('name') === name); }
  getSelection() { return { removeAllRanges() {}, addRange() {}, toString: () => '', rangeCount: 0 }; }
  hasFocus() { return true; }
  elementFromPoint() { return null; }
  elementsFromPoint() { return []; }
  execCommand() { return false; }
  startViewTransition(callback) {
    const done = Promise.resolve().then(() => callback?.());
    return { finished: done, ready: done, updateCallbackDone: done, skipTransition() {} };
  }
  _noteMutation(target, type, attributeName, oldValue, nodes = { addedNodes: [], removedNodes: [] }) {
    this._version = (this._version || 0) + 1;
    if (!this._mutationObservers.size) return;
    for (const observer of this._mutationObservers) observer._record(target, type, attributeName, oldValue, nodes);
  }
}

/* --------------------------------------------------------------- parsing */

function parseAttributes(source) {
  const attributes = [];
  const pattern = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes.push([match[1].toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')]);
  }
  return attributes;
}

export function parseFragmentNodes(markup, document) {
  const root = new DocumentFragment(document);
  const stack = [root];
  const current = () => stack.at(-1);
  const container = (node) => (node.localName === 'template' ? node.content : node);
  const append = (node) => {
    const parent = current();
    node.parentNode = container(parent) === parent ? parent : container(parent);
    container(parent).childNodes.push(node);
  };
  let index = 0;
  const length = markup.length;
  while (index < length) {
    const open = markup.indexOf('<', index);
    if (open < 0) { append(new Text(decodeEntities(markup.slice(index)), document)); break; }
    if (open > index) append(new Text(decodeEntities(markup.slice(index, open)), document));
    if (markup.startsWith('<!--', open)) {
      const close = markup.indexOf('-->', open + 4);
      const end = close < 0 ? length : close;
      append(new Comment(markup.slice(open + 4, end), document));
      index = close < 0 ? length : close + 3;
      continue;
    }
    if (markup[open + 1] === '!' || markup[open + 1] === '?') {
      const close = markup.indexOf('>', open);
      index = close < 0 ? length : close + 1;
      continue;
    }
    if (markup[open + 1] === '/') {
      const close = markup.indexOf('>', open);
      const name = markup.slice(open + 2, close).trim().toLowerCase();
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].localName === name) { stack.length = depth; break; }
      }
      index = close + 1;
      continue;
    }
    if (!/[a-zA-Z]/.test(markup[open + 1] || '')) {
      append(new Text('<', document));
      index = open + 1;
      continue;
    }
    // Find the end of the start tag, respecting quoted attribute values.
    let cursor = open + 1;
    let quote = null;
    while (cursor < length) {
      const char = markup[cursor];
      if (quote) { if (char === quote) quote = null; } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
      cursor += 1;
    }
    const body = markup.slice(open + 1, cursor);
    const nameMatch = body.match(/^[^\s/>]+/);
    const tagName = nameMatch[0].toLowerCase();
    const selfClosing = /\/\s*$/.test(body);
    const attributeSource = body.slice(nameMatch[0].length).replace(/\/\s*$/, '');
    const parentTag = current().localName;
    if (AUTO_CLOSE[parentTag]?.has(tagName)) stack.pop();
    const namespace = tagName === 'svg' || stack.some((node) => node.namespaceURI === 'http://www.w3.org/2000/svg') ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml';
    const element = new Element(namespace === 'http://www.w3.org/2000/svg' ? nameMatch[0] : tagName, document, namespace);
    for (const [name, value] of parseAttributes(attributeSource)) if (!element._attributes.has(name)) element._attributes.set(name, value);
    append(element);
    index = cursor + 1;
    if (RAW_TEXT_ELEMENTS.has(tagName) && !selfClosing) {
      const close = markup.toLowerCase().indexOf(`</${tagName}`, index);
      const end = close < 0 ? length : close;
      const text = markup.slice(index, end);
      if (text) {
        const node = new Text(tagName === 'textarea' || tagName === 'title' ? decodeEntities(text) : text, document);
        node.parentNode = element;
        element.childNodes.push(node);
      }
      index = close < 0 ? length : markup.indexOf('>', close) + 1;
      continue;
    }
    if (!VOID_ELEMENTS.has(tagName) && !selfClosing) stack.push(element);
  }
  const nodes = root.childNodes;
  for (const node of nodes) node.parentNode = null;
  return nodes;
}

export function parseHTML(markup) {
  const document = new Document();
  const nodes = parseFragmentNodes(markup.replace(/^﻿/, ''), document);
  let html = nodes.find((node) => node.nodeType === 1 && node.localName === 'html');
  if (!html) {
    html = document.createElement('html');
    const body = document.createElement('body');
    html.appendChild(body);
    for (const node of nodes) body.appendChild(node);
  }
  document.appendChild(html);
  return document;
}

export function serializeNode(node) {
  if (node.nodeType === 3) {
    const parent = node.parentNode;
    return parent && RAW_TEXT_ELEMENTS.has(parent.localName) && parent.localName !== 'textarea' && parent.localName !== 'title' ? node.data : escapeText(node.data);
  }
  if (node.nodeType === 8) return `<!--${node.data}-->`;
  if (node.nodeType === 11) return node.childNodes.map(serializeNode).join('');
  const attributes = [...node._attributes].map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('');
  const open = `<${node.localName}${attributes}>`;
  if (VOID_ELEMENTS.has(node.localName)) return open;
  const children = node.localName === 'template' ? node.content.childNodes : node.childNodes;
  return `${open}${children.map(serializeNode).join('')}</${node.localName}>`;
}

/** Visible text of an element tree: skips hidden subtrees, scripts and styles. */
export function visibleText(element) {
  if (element.nodeType === 3) return element.data;
  if (element.nodeType !== 1 && element.nodeType !== 11) return '';
  if (element.nodeType === 1 && (element.hidden || ['script', 'style', 'template'].includes(element.localName))) return '';
  return element.childNodes.map(visibleText).join('');
}

/** Parse a markup snippet (e.g. a rendered template string) into a detached container. */
export function parseFragment(markup, document = parseHTML('<html><body></body></html>')) {
  const container = document.createElement('div');
  container.innerHTML = markup;
  document.body.appendChild(container);
  return container;
}
